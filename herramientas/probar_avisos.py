# -*- coding: utf-8 -*-
"""¿LLEGAN LOS AVISOS DE VERDAD? De punta a punta, sin un teléfono.

    python herramientas/probar_avisos.py              contra el hub
    python herramientas/probar_avisos.py <url base>   contra otra URL

🔴 EXISTE PORQUE «EL WORKER CONTESTÓ 201» NO DICE QUE ALGUIEN RECIBIÓ ALGO.
Entre el Worker y una pantalla hay un servicio de push que valida la firma
VAPID, un cifrado que el navegador tiene que poder abrir y un proxy de Pages
en el medio. Cualquiera de los tres puede fallar callado: el Worker ve un
201 y el teléfono tira el mensaje porque no lo puede descifrar.

Así que esto HACE DE NAVEGADOR, con el servicio de push de Mozilla —el que
usa Firefox—, que habla un protocolo abierto por WebSocket:

    1 · se registra en Mozilla con la clave pública VAPID del Worker
    2 · se anota en el hub como cualquier dispositivo (`/api/avisos/alta`)
    3 · pide una de prueba (`/api/avisos/probar`)
    4 · la recibe de Mozilla, la DESCIFRA con su propia clave y la lee
    5 · se borra: `/api/avisos/baja` y `unregister` en Mozilla

Si el paso 4 dice lo que el Worker mandó, la cadena entera anda: firma,
cifrado, proxy, Durable Object y servicio de push.

⚠️ SE ANOTA CON UN SERVIDOR QUE NO EXISTE (`ZZZ`) para que ningún evento
real le llegue mientras corre. Y se borra al final aunque algo falle.

⚠️ EL CLIENTE WEBSOCKET ESTA ESCRITO ACA, sin dependencias: son cuarenta
líneas de RFC 6455 contra instalar un paquete en cada máquina y en CI.
"""
import base64
import json
import os
import socket
import ssl
import struct
import sys
import time
import uuid

import requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

HUB = 'https://underlegends.pages.dev'
MOZILLA = 'push.services.mozilla.com'


def b64u(b):
    return base64.urlsafe_b64encode(b).rstrip(b'=').decode('ascii')


def de64u(s):
    return base64.urlsafe_b64decode(s + '=' * (-len(s) % 4))


# ── un WebSocket mínimo (RFC 6455), del lado cliente ─────────────────
class WS:
    def __init__(self, host):
        crudo = socket.create_connection((host, 443), timeout=20)
        self.s = ssl.create_default_context().wrap_socket(crudo, server_hostname=host)
        clave = base64.b64encode(os.urandom(16)).decode()
        self.s.sendall((
            'GET / HTTP/1.1\r\nHost: %s\r\nUpgrade: websocket\r\n'
            'Connection: Upgrade\r\nSec-WebSocket-Key: %s\r\n'
            'Sec-WebSocket-Version: 13\r\n'
            'Sec-WebSocket-Protocol: push-notification\r\n'
            'Origin: https://%s\r\n\r\n' % (host, clave, host)).encode())
        cab = b''
        while b'\r\n\r\n' not in cab:
            trozo = self.s.recv(1)
            if not trozo:
                raise RuntimeError('Mozilla cortó el saludo')
            cab += trozo
        if b' 101 ' not in cab.split(b'\r\n', 1)[0]:
            raise RuntimeError('Mozilla no aceptó el WebSocket: %r' % cab[:80])

    def _leer(self, n):
        out = b''
        while len(out) < n:
            trozo = self.s.recv(n - len(out))
            if not trozo:
                raise RuntimeError('se cortó la conexión')
            out += trozo
        return out

    def mandar(self, d, op=1):
        datos = json.dumps(d).encode() if op == 1 else d
        cab = bytes([0x80 | op])
        n = len(datos)
        if n < 126:
            cab += bytes([0x80 | n])
        elif n < 65536:
            cab += bytes([0x80 | 126]) + struct.pack('>H', n)
        else:
            cab += bytes([0x80 | 127]) + struct.pack('>Q', n)
        m = os.urandom(4)
        self.s.sendall(cab + m + bytes(b ^ m[i % 4] for i, b in enumerate(datos)))

    def recibir(self, espera=30):
        self.s.settimeout(espera)
        while True:
            b0, b1 = self._leer(2)
            op, n = b0 & 0x0F, b1 & 0x7F
            if n == 126:
                n = struct.unpack('>H', self._leer(2))[0]
            elif n == 127:
                n = struct.unpack('>Q', self._leer(8))[0]
            datos = self._leer(n)
            if op == 9:                      # ping -> pong
                self.mandar(datos, op=10)
                continue
            if op == 8:
                raise RuntimeError('Mozilla cerró la conexión')
            if op == 1:
                return json.loads(datos.decode())

    def cerrar(self):
        try:
            self.mandar(b'', op=8)
            self.s.close()
        except Exception:                                    # noqa: BLE001
            pass


# ── lo que hace el navegador al recibir (RFC 8291 §3.4) ─────────────────
def hkdf(sal, ikm, info, n):
    return HKDF(algorithm=hashes.SHA256(), length=n, salt=sal, info=info).derive(ikm)


def descifrar(cuerpo, privada, publica, auth):
    sal, rs, idlen = cuerpo[:16], struct.unpack('>I', cuerpo[16:20])[0], cuerpo[20]
    as_pub = cuerpo[21:21 + idlen]
    cifrado = cuerpo[21 + idlen:]
    otra = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), as_pub)
    ecdh = privada.exchange(ec.ECDH(), otra)
    ikm = hkdf(auth, ecdh, b'WebPush: info\x00' + publica + as_pub, 32)
    cek = hkdf(sal, ikm, b'Content-Encoding: aes128gcm\x00', 16)
    nonce = hkdf(sal, ikm, b'Content-Encoding: nonce\x00', 12)
    claro = AESGCM(cek).decrypt(nonce, cifrado, None).rstrip(b'\x00')
    if not claro.endswith(b'\x02'):
        raise RuntimeError('falta el delimitador de último registro (rs=%d)' % rs)
    return claro[:-1].decode('utf-8')


def main():
    base = (sys.argv[1] if len(sys.argv) > 1 else HUB).rstrip('/')
    api = base + ('/api/avisos' if 'pages.dev' in base else '/avisos')
    print('contra: %s' % api)
    clave = requests.get(api + '/clave', timeout=20).json()['clave']
    print('  1 · la clave pública del Worker: %s…' % clave[:16])

    privada = ec.generate_private_key(ec.SECP256R1())
    publica = privada.public_key().public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    auth = os.urandom(16)

    ws = WS(MOZILLA)
    endpoint = ''
    canal = str(uuid.uuid4())
    try:
        ws.mandar({'messageType': 'hello', 'uaid': '', 'use_webpush': True, 'broadcasts': {}})
        hola = ws.recibir()
        if hola.get('status') != 200:
            raise RuntimeError('Mozilla no saludó: %s' % hola)
        ws.mandar({'messageType': 'register', 'channelID': canal, 'key': clave})
        reg = ws.recibir()
        endpoint = reg.get('pushEndpoint') or ''
        if reg.get('status') != 200 or not endpoint:
            raise RuntimeError('Mozilla no registró: %s' % reg)
        print('  2 · registrado en Mozilla: %s…' % endpoint[:60])

        r = requests.post(api + '/alta', timeout=20, json={
            'sub': {'endpoint': endpoint, 'keys': {'p256dh': b64u(publica), 'auth': b64u(auth)}},
            'svs': ['ZZZ'],
        })
        print('  3 · alta en el hub: %d %s' % (r.status_code, r.text[:80]))
        if r.status_code != 200:
            return 1

        t0 = time.time()
        r = requests.post(api + '/probar', timeout=30, json={'endpoint': endpoint})
        print('  4 · el Worker mandó la de prueba: %d %s' % (r.status_code, r.text[:80]))
        if r.status_code != 200 or not r.json().get('ok'):
            return 1

        def esperar():
            while True:
                m = ws.recibir(espera=60)
                if m.get('messageType') == 'notification':
                    break
            ws.mandar({'messageType': 'ack', 'updates': [
                {'channelID': m['channelID'], 'version': m['version'], 'code': 100}]})
            return descifrar(de64u(m.get('data') or ''), privada, publica, auth)

        texto = esperar()
        print('  5 · llegó en %.1f s y se descifró: %s' % (time.time() - t0, texto))
        if json.loads(texto).get('tipo') != 'prueba':
            print('\n❌ llegó algo que no es la de prueba')
            return 1

        # 🔑 EL CAMINO DE UN ANUNCIO DE VERDAD: cola, alarma, lote, filtro.
        # `probar` manda directo; esto pasa por donde pasa un evento.
        t0 = time.time()
        r = requests.post(api + '/simular', timeout=20, json={})
        print('  6 · un anuncio de mentira del servidor de prueba: %d %s'
              % (r.status_code, r.text[:60]))
        if r.status_code == 429:
            print('\n✅ LOS AVISOS LLEGAN (el simulacro ya se usó en estos cinco '
                  'minutos: corré de nuevo en un rato para probar la cola).')
            return 0
        if r.status_code != 200:
            return 1
        texto = esperar()
        d = json.loads(texto)
        print('  7 · llegó por la cola en %.1f s: %s' % (time.time() - t0, texto))
        ok = d.get('tipo') == 'evento' and d.get('sv') == 'ZZZ'
        print('\n%s' % ('✅ LOS AVISOS LLEGAN: firma, cifrado, proxy, cola y servicio de '
                        'push andan.' if ok else '❌ por la cola llegó otra cosa'))
        return 0 if ok else 1
    except Exception as e:                                   # noqa: BLE001
        print('\n❌ %s' % e)
        return 1
    finally:
        if endpoint:
            try:
                requests.post(api + '/baja', timeout=20, json={'endpoint': endpoint})
                ws.mandar({'messageType': 'unregister', 'channelID': canal})
                print('  · borrado: del hub y de Mozilla')
            except Exception:                                # noqa: BLE001
                pass
        ws.cerrar()


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    sys.exit(main())
