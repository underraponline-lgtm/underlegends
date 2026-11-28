# -*- coding: utf-8 -*-
"""🧹 LAS BATALLAS ENTERAS QUE QUEDARON PÚBLICAS, FUERA (28/11/2026, el paso 7; Dlx: «Sí, con la regla nueva»).

Hasta el 28/11/2026 el motor dejaba cada batalla entera en R2 PÚBLICO: `reels/audios/<ev>/<k>.m4a`, su letra
(`<k>.json`), lo mejor de la noche (`mejor.m4a`/`mejor.json`) y la lista `reels/audios.json`, que la página leía sin
preguntar nada. Con la regla nueva —30 s para todos, tu batalla entera, todo el evento con el Premium— eso es justo lo
que no puede quedar: cualquiera con el link (o con la lista) oía cualquier batalla entera durante 15 días.

Lo nuevo va por bot/grabados.py (motor) y bot/grabados.js (Worker); esto borra lo viejo. Sin `--aplicar` sólo dice qué
borraría (lee R2 por la API, no toca nada).

⚠️ EL ORDEN IMPORTA: primero el motor nuevo (archivo_reels.audios() → grabados.desde_motor(), en main del repo privado) y
recién después `--aplicar`. Al revés, el próximo `procesar` vuelve a dejar batallas públicas.
⚠️ La lista se deja como `[]` (y no se borra): el motor viejo la lee y la reescribe, y una página vieja en caché que la pida
recibe «nada» en vez de un 404.
⚠️ Lo que deja de estar: «El evento entero» y el ♫ de las llaves viejas (sin registro privado no hay audio, a propósito) y
la entrada de esas batallas al evento entero de YouTube si se rearma (el motor ya lee su índice privado).

Uso:
    python herramientas/grabados_publicos.py            qué borraría: cuántos objetos, cuántos MB, de qué eventos
    python herramientas/grabados_publicos.py --aplicar  lo borra (y deja reels/audios.json en [])
    python herramientas/grabados_publicos.py --auto     el self-check, sin red
"""
import io
import json
import os
import sys
import time

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, os.path.join(BASE, 'bot'))
PREFIJO = 'reels/audios/'
LISTA = 'reels/audios.json'


def plan(objetos, lista):
    """Qué se borra: todo lo que cuelga de `reels/audios/` (también lo huérfano, que la lista ya no nombra), agrupado por
    evento. `objetos`: `[{key, size}]` de la API; `lista`: las filas de reels/audios.json. Nunca nada fuera del prefijo."""
    borrar = sorted(o['key'] for o in objetos if str(o.get('key', '')).startswith(PREFIJO) and o['key'] != LISTA)
    peso = sum(int(o.get('size') or 0) for o in objetos if o.get('key') in set(borrar))
    por_ev = {}
    for k in borrar:
        ev = k[len(PREFIJO):].split('/', 1)[0]
        por_ev[ev] = por_ev.get(ev, 0) + 1
    nombrados = {'%s%s/%s.m4a' % (PREFIJO, x.get('ev'), x.get('k')) for x in lista or [] if isinstance(x, dict)}
    huerfanos = [k for k in borrar if k.endswith('.m4a') and k not in nombrados]
    return {'borrar': borrar, 'mb': round(peso / 1e6, 1), 'eventos': por_ev, 'filas': len(lista or []), 'huerfanos': len(huerfanos)}


def _listar(s, api):
    todos, cursor, espera = [], None, 0
    while True:
        pars = {'per_page': 1000, 'prefix': PREFIJO}
        if cursor:
            pars['cursor'] = cursor
        r = s.get(api + '/objects', params=pars, timeout=60)
        j = r.json()
        if not j.get('success'):
            if 971 in [e.get('code') for e in (j.get('errors') or [])] and espera < 6:
                time.sleep(4 * (espera + 1))
                espera += 1
                continue
            raise IOError('listar falló: %s' % (j.get('errors') or r.status_code))
        todos += j.get('result') or []
        cursor = (j.get('result_info') or {}).get('cursor')
        if not cursor:
            return todos


def main():
    import subir_cartas as SC
    s = SC.sesion()
    objetos = _listar(s, SC.API)
    r = s.get('%s/objects/%s' % (SC.API, LISTA), timeout=30)
    try:
        lista = r.json() if r.status_code == 200 else []
    except ValueError:
        lista = []
    P = plan(objetos, lista)
    print('reels/audios.json: %d filas · reels/audios/: %d objetos, %.1f MB, %d eventos (%d m4a que la lista ya no nombra)' % (
        P['filas'], len(P['borrar']), P['mb'], len(P['eventos']), P['huerfanos']))
    for ev, n in sorted(P['eventos'].items()):
        print('   %-40s %3d objetos' % (ev, n))
    if '--aplicar' not in sys.argv:
        print('\n(no borré nada: con --aplicar se borran y la lista queda en [])')
        return 0
    malos = 0
    for i, k in enumerate(P['borrar'], 1):
        d = s.delete('%s/objects/%s' % (SC.API, k), timeout=30)
        if not d.ok:
            malos += 1
        if i % 50 == 0:
            time.sleep(1)
    w = s.put('%s/objects/%s' % (SC.API, LISTA), data=b'[]', headers={'Content-Type': 'application/json; charset=utf-8',
                                                                      'Cache-Control': 'max-age=60'}, timeout=30)
    print('borrados %d de %d · la lista %s' % (len(P['borrar']) - malos, len(P['borrar']), 'en []' if w.ok else 'NO se pudo vaciar'))
    return 1 if malos or not w.ok else 0


def _auto():
    objetos = [{'key': 'reels/audios/ffa-1/1.m4a', 'size': 2_000_000}, {'key': 'reels/audios/ffa-1/1.json', 'size': 9000},
               {'key': 'reels/audios/ffa-1/mejor.m4a', 'size': 1_000_000}, {'key': 'reels/audios/viejo/3.m4a', 'size': 500_000},
               {'key': 'reels/audios.json', 'size': 100}, {'key': 'reels/archivo/ffa-1/1.mp4', 'size': 7_000_000},
               {'key': 'fotos/t1/konan.webp', 'size': 30_000}]
    lista = [{'ev': 'ffa-1', 'k': 1}, {'ev': 'ffa-1', 'k': 'mejor'}]
    P = plan(objetos, lista)
    fallas = []
    if P['borrar'] != ['reels/audios/ffa-1/1.json', 'reels/audios/ffa-1/1.m4a', 'reels/audios/ffa-1/mejor.m4a', 'reels/audios/viejo/3.m4a']:
        fallas.append('plan(): sólo lo de reels/audios/ (ni la lista, ni los shorts, ni las fotos): %r' % P['borrar'])
    if P['mb'] != 3.5 or P['eventos'] != {'ffa-1': 3, 'viejo': 1} or P['huerfanos'] != 1 or P['filas'] != 2:
        fallas.append('plan(): peso, eventos y huérfanos: %r' % {k: v for k, v in P.items() if k != 'borrar'})
    for f in fallas:
        print('🔴 ' + f)
    print('todo ok · grabados_publicos' if not fallas else '%d fallas' % len(fallas))
    return 1 if fallas else 0


if __name__ == '__main__':
    sys.exit(_auto() if '--auto' in sys.argv else main())
