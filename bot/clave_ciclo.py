"""🔑 La clave del ciclo: lo que el Worker pide en `x-lg-ciclo` para lo que sólo hace el ciclo.

Es `sha256(PREFIJO + DISCORD_TOKEN)`, y el Worker la calcula igual (`claveCiclo()` en `bot/avisos.js`). Abre lo
que escribe en nombre de la Liga: el Pase (`/avisos/pase-ciclo`), los datos de cada persona para /card
(`/avisos/personas-ciclo`), el cierre del bot en vivo, la imagen del kit y la lectura de afiches.

⚠️ VIVÍA ESCRITA CATORCE VECES, en diez archivos, hasta el 13/10/2026. Ese día se supo que estaba en el repo
público desde el 08/10 —`texto_de_imagen()` en `anuncios.py` la usaba como clave de la memoria de lo leído— y
cambiarla pedía tocar los catorce a la vez y el Worker. Ahora es una sola cuenta acá y otra en el Worker, y
`--auto` comprueba que las dos usen el mismo `PREFIJO`: si no coinciden, el Worker le contesta «no existe» a todo
lo del ciclo, y eso no lo ve nadie hasta que algo deja de moverse.

⚠️ El prefijo NO es un secreto: está acá y en el Worker, los dos públicos. El secreto es el token. Cambiarlo
invalida una clave que se filtró sin tocar el token, porque la nueva sólo la saca quien tiene el token.

    python bot/clave_ciclo.py --auto   # el mismo prefijo acá y en el Worker
"""
import hashlib
import os
import re
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

PREFIJO = 'lg-ciclo:'


def clave(token):
    """La clave para `x-lg-ciclo`. Igual que `claveCiclo()` del Worker: sin recortar nada del token."""
    return hashlib.sha256((PREFIJO + str(token or '')).encode('utf-8')).hexdigest()


def _prefijo_del_worker():
    js = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'avisos.js')
    with open(js, encoding='utf-8') as f:
        m = re.search(r"const\s+PREFIJO_CICLO\s*=\s*'([^']*)'", f.read())
    return m.group(1) if m else None


def _auto():
    w = _prefijo_del_worker()
    if w is None:
        print('🔴 no encontré PREFIJO_CICLO en bot/avisos.js: el Worker ya no lo declara así')
        return 1
    if w != PREFIJO:
        print('🔴 el prefijo de la clave del ciclo no coincide: acá %r, en el Worker %r. El Worker le diría «no existe»'
              ' a todo lo del ciclo.' % (PREFIJO, w))
        return 1
    # la cuenta conocida, para que un cambio en la función se note
    if clave('x') != hashlib.sha256((PREFIJO + 'x').encode('utf-8')).hexdigest() or clave(None) != clave(''):
        print('🔴 clave() no hace la cuenta del Worker')
        return 1
    print('todo ok · el mismo prefijo acá y en el Worker')
    return 0


if __name__ == '__main__':
    if '--auto' in sys.argv:
        sys.exit(_auto())
    print(__doc__)
