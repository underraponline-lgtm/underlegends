# -*- coding: utf-8 -*-
"""LAS CLAVES VAPID DE LOS AVISOS, UNA SOLA VEZ.

    python bot/avisos_claves.py        las crea en .env si no están; si
                                       están, sólo muestra la pública

VAPID (RFC 8292) es cómo un servicio de push —Google, Mozilla, Apple—
sabe que la notificación la manda el mismo que pidió la suscripción. Es un
par P-256: la **pública** viaja a cada navegador al suscribirse y la
**privada** firma cada envío desde el Worker.

⚠️ NO LA EMITE NADIE: LA INVENTA ESTE PROYECTO, como `FOTOS_SAL`. Por eso
no hay que pedirle nada a Dlx ni crear nada en ningún panel — y por eso
mismo, si se pierde, no hay dónde recuperarla. Va en `.env` y en
`ACCESOS.md`, sección 5c.

🔴 NO SE ROTA CON LOS DEMAS TOKENS AL FINAL. Cada suscripción queda atada
a la clave pública con la que se hizo: cambiarla deja a TODOS sin avisos.
La página se re-suscribe sola la próxima vez que alguien la abre —compara
la clave de su suscripción contra la del Worker—, pero quien no vuelva a
entrar deja de recibir y nadie se entera. Se rota sólo si la privada se
filtra.

⚠️ POR ESO ESTE SCRIPT NUNCA PISA. Si `.env` ya tiene las dos, muestra la
pública y sale. Para rotar a propósito hay que borrarlas a mano, que es la
fricción correcta para algo que no se deshace.
"""
import base64
import io
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
ENV = os.path.join(BASE, '.env')


def b64u(b):
    return base64.urlsafe_b64encode(b).rstrip(b'=').decode('ascii')


def leer_env():
    d = {}
    if os.path.exists(ENV):
        with io.open(ENV, encoding='utf-8') as f:
            for linea in f:
                linea = linea.strip()
                if linea and not linea.startswith('#') and '=' in linea:
                    k, v = linea.split('=', 1)
                    d[k.strip()] = v.strip().strip('"\'')
    return d


def main():
    env = leer_env()
    if env.get('VAPID_PUBLICA') and env.get('VAPID_PRIVADA'):
        print('ya están en .env — no se tocan.')
        print('pública: %s' % env['VAPID_PUBLICA'])
        return 0
    if env.get('VAPID_PUBLICA') or env.get('VAPID_PRIVADA'):
        sys.exit('🔴 .env tiene UNA de las dos claves VAPID. Eso no se arregla '
                 'generando otra: buscá la que falta en ACCESOS.md (5c).')
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    k = ec.generate_private_key(ec.SECP256R1())
    privada = b64u(k.private_numbers().private_value.to_bytes(32, 'big'))
    publica = b64u(k.public_key().public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint))
    with io.open(ENV, 'a', encoding='utf-8') as f:
        f.write('\n# Avisos de eventos (Web Push). NO se rotan con los demás:\n'
                '# ver bot/avisos_claves.py y ACCESOS.md 5c.\n'
                'VAPID_PUBLICA=%s\nVAPID_PRIVADA=%s\n' % (publica, privada))
    print('✅ claves nuevas en .env')
    print('pública: %s' % publica)
    print('⚠️ copiá las dos a ACCESOS.md (sección 5c) antes de desplegar.')
    return 0


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    sys.exit(main())
