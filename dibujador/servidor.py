# -*- coding: utf-8 -*-
"""🎨 EL DIBUJADOR: las imágenes del bot en segundos, en Railway (21/11/2026).

Dlx, a «imágenes al instante»: *«dale»*. El VS del bot en vivo, /perfil, /vitrina, /afiche y /llave los dibuja
`bot/kit.py` en una tarea de GitHub (`kit.yml`), que tarda de 1 a 5 minutos en arrancar y terminar: medido ese día,
de 20 tareas 7 pasaron los 170 s, y el «dibujar y contestar» solo llegó a 234. Por eso el cruce del bot en vivo
esperaba su imagen hasta 6 minutos. Acá el mismo `kit.py` corre en un servicio prendido todo el día, con Chromium ya
instalado: dibujar es abrir el navegador y sacar la foto.

⚠️ NO HAY UNA COPIA DEL DIBUJO ACÁ. El servicio baja el repo público (`underlegends`, sin credenciales) y corre
`python bot/kit.py --tipo … --sv … --id …`, lo mismo que la tarea de GitHub. Antes de cada dibujo, si pasaron
`AL_DIA_S`, se pone al día con `main`: así el dibujo y los datos son los de ahora y no los del día que se desplegó.
Este servicio sólo se vuelve a construir cuando cambia `dibujador/` (`watchPatterns` en railway.json).

⚠️ GITHUB SIGUE DE RESPALDO (Dlx: *«combinar… que eso también se quede en cualquier caso de error»*). El Worker le
pide primero a este servicio (`pedirDibujo()` en bot/avisos.js); si no contesta 202, o lo pedido sigue esperando a
los 90 s (`DIBUJADOR_PLAZO`), prende la tarea de GitHub como siempre.

    POST /dibujar   {"tipo": "vs"|"img"|"afiche"|"llave", "sv": "FFA", "id": "<hex>"}   con `x-lg-ciclo`
    GET  /salud     si está vivo, si ya bajó el repo y cuánto hay en la cola

🔑 SIN SECRETO NUEVO: el pedido trae la clave del ciclo (`sha256('lg-ciclo:' + DISCORD_TOKEN)`, bot/clave_ciclo.py),
que este servicio calcula con el mismo token. Variables de Railway: `DISCORD_TOKEN` y `CLOUDFLARE_API_TOKEN` (subir a
R2, como `bot/subir_cartas.py`). `PORT` la pone Railway.
"""
import hashlib
import hmac
import http.server
import json
import os
import queue
import re
import subprocess
import sys
import threading
import time
from datetime import datetime
from zoneinfo import ZoneInfo

REPO_URL = 'https://github.com/underraponline-lgtm/underlegends.git'
REPO = os.environ.get('REPO_DIR', '/srv/underlegends')
#: cada cuánto, como mucho, se pone al día con `main` antes de dibujar (el ciclo commitea datos cada media hora)
AL_DIA_S = 300
#: lo más que espera un dibujo; la tarea de GitHub tiene 12 minutos para todo
TOPE_S = 300
COLA_MAX = 40
TIPOS = ('vs', 'img', 'afiche', 'llave')
#: los que se llevan TODA la cola de su servidor (`correr_vs()`, `correr_img()`): con uno esperando alcanza
DE_COLA = ('vs', 'img')
ET = ZoneInfo('America/New_York')

TOKEN = os.environ.get('DISCORD_TOKEN', '').strip()
CLAVE = hashlib.sha256(('lg-ciclo:' + TOKEN).encode('utf-8')).hexdigest() if TOKEN else ''

cola = queue.Queue()
esperan = set()           # (tipo, sv) de los que se llevan su cola y todavía no arrancaron
candado = threading.Lock()
estado = {'listo': False, 'al_dia': 0.0, 'requisitos': '', 'hechos': 0, 'fallas': 0, 'ultimo': ''}


def anotar(*x):
    print(datetime.now(ET).strftime('%H:%M:%S') + ' ET', *x, flush=True)


def correr(args, tope=600, donde=None):
    return subprocess.run(args, cwd=donde, capture_output=True, text=True, timeout=tope, encoding='utf-8', errors='replace')


def _hash(ruta):
    try:
        return hashlib.sha256(open(ruta, 'rb').read()).hexdigest()
    except OSError:
        return ''


def al_dia(forzar=False):
    """El repo, al día con `main`, y sus dependencias si `requirements.txt` cambió."""
    if not forzar and time.time() - estado['al_dia'] < AL_DIA_S:
        return
    if not os.path.isdir(os.path.join(REPO, '.git')):
        r = correr(['git', 'clone', '--depth', '1', REPO_URL, REPO])
        if r.returncode:
            raise RuntimeError('no pude bajar el repo: ' + r.stderr[-300:])
    else:
        r = correr(['git', 'fetch', '--depth', '1', 'origin', 'main'], donde=REPO)
        if r.returncode:
            raise RuntimeError('no pude ponerme al día: ' + r.stderr[-300:])
        correr(['git', 'reset', '--hard', 'FETCH_HEAD'], donde=REPO)
    req = os.path.join(REPO, 'requirements.txt')
    h = _hash(req)
    if h != estado['requisitos']:
        r = correr([sys.executable, '-m', 'pip', 'install', '-q', '--disable-pip-version-check', '-r', req], tope=900)
        if r.returncode:
            raise RuntimeError('pip: ' + r.stderr[-300:])
        estado['requisitos'] = h
    # 🔑 lo que kit.py lee de `.env` (bot/escuchar.py `_env()`, bot/subir_cartas.py `env()`): sólo lo que usa
    with open(os.path.join(REPO, '.env'), 'w', encoding='utf-8') as f:
        for k in ('DISCORD_TOKEN', 'CLOUDFLARE_API_TOKEN'):
            if os.environ.get(k):
                f.write('%s=%s\n' % (k, os.environ[k].strip()))
    estado['al_dia'] = time.time()
    r = correr(['git', 'log', '-1', '--format=%h %s'], donde=REPO)
    anotar('📥 al día con main:', r.stdout.strip()[:90])


def trabajar():
    while True:
        try:
            al_dia(forzar=True)
            estado['listo'] = True
            break
        except Exception as e:                           # noqa: BLE001
            anotar('🔴 no pude prepararme, pruebo de nuevo en 60 s:', str(e)[:200])
            time.sleep(60)
    anotar('✅ listo para dibujar')
    while True:
        tipo, sv, id_ = cola.get()
        with candado:
            esperan.discard((tipo, sv))
        t = time.time()
        try:
            al_dia()
        except Exception as e:                           # noqa: BLE001
            anotar('⚠️ sigo con el repo de antes:', str(e)[:160])
        try:
            r = correr([sys.executable, 'bot/kit.py', '--tipo', tipo, '--sv', sv, '--id', id_], tope=TOPE_S, donde=REPO)
            ok = r.returncode == 0
            lineas = [x for x in (r.stdout or '').splitlines() if x.strip()]
            resumen = ' / '.join(x.strip() for x in lineas[-3:])[:300]
            if not ok:
                resumen += ' · ' + (r.stderr or '').strip()[-300:]
        except subprocess.TimeoutExpired:
            ok, resumen = False, 'se pasó de %d s' % TOPE_S
        estado['hechos' if ok else 'fallas'] += 1
        estado['ultimo'] = datetime.now(ET).strftime('%H:%M:%S')
        anotar('%s %s %s en %.1f s · %s' % ('🖼️' if ok else '🔴', tipo, sv, time.time() - t, resumen))


class Pedidos(http.server.BaseHTTPRequestHandler):
    server_version = 'dibujador'

    def _json(self, codigo, cuerpo):
        b = json.dumps(cuerpo).encode('utf-8')
        self.send_response(codigo)
        self.send_header('content-type', 'application/json')
        self.send_header('content-length', str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def log_message(self, *a):                          # el registro lo lleva `anotar()`
        pass

    def do_GET(self):
        if self.path.split('?')[0] in ('/', '/salud'):
            return self._json(200, {'ok': True, 'listo': estado['listo'], 'cola': cola.qsize(),
                                    'hechos': estado['hechos'], 'fallas': estado['fallas'], 'ultimo': estado['ultimo']})
        return self._json(404, {'error': 'no existe'})

    def do_POST(self):
        if self.path != '/dibujar':
            return self._json(404, {'error': 'no existe'})
        if not CLAVE or not hmac.compare_digest(self.headers.get('x-lg-ciclo', ''), CLAVE):
            return self._json(401, {'error': 'clave'})
        try:
            n = int(self.headers.get('content-length') or 0)
            d = json.loads(self.rfile.read(min(n, 2048)).decode('utf-8')) if 0 < n <= 2048 else {}
        except (ValueError, UnicodeDecodeError):
            d = {}
        tipo, sv, id_ = str(d.get('tipo') or ''), str(d.get('sv') or ''), str(d.get('id') or '')
        # (los mismos moldes que pide `kit.py` al arrancar: lo que no pasa, ni se encola)
        if tipo not in TIPOS or not re.match(r'^[A-Z]{2,5}$', sv) or not re.match(r'^[a-f0-9]{16,40}$', id_):
            return self._json(400, {'error': 'datos'})
        if not estado['listo']:
            return self._json(503, {'error': 'preparando'})
        with candado:
            if tipo in DE_COLA and (tipo, sv) in esperan:
                return self._json(202, {'ok': True, 'ya': True})
            if cola.qsize() >= COLA_MAX:
                return self._json(503, {'error': 'llena'})
            if tipo in DE_COLA:
                esperan.add((tipo, sv))
            cola.put((tipo, sv, id_))
        return self._json(202, {'ok': True, 'cola': cola.qsize()})


def main():
    if not CLAVE:
        anotar('❌ falta DISCORD_TOKEN (en Railway: Variables)')
        sys.exit(1)
    if not os.environ.get('CLOUDFLARE_API_TOKEN'):
        anotar('⚠️ falta CLOUDFLARE_API_TOKEN: dibujo, pero no puedo subir a R2')
    threading.Thread(target=trabajar, daemon=True).start()
    puerto = int(os.environ.get('PORT') or 8080)
    anotar('🎨 escuchando en el puerto %d' % puerto)
    http.server.ThreadingHTTPServer(('0.0.0.0', puerto), Pedidos).serve_forever()


if __name__ == '__main__':
    main()
