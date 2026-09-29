# -*- coding: utf-8 -*-
"""📣 LO QUE LA GENTE AVISA QUE ESTÁ MAL EN UNA LLAVE, A ✅ DECIDIR.

    python bot/reportes.py             qué pasaría (no escribe nada)
    python bot/reportes.py --aplicar   lo anota en `Pendientes`
    python bot/reportes.py --auto      self-check, sin red

🔑 Dlx, 28/09/2026, a «"Reportar un error" en cada llave: quien ve mal su
batalla la marca desde la página y va a ✅ Decidir, nunca por DM»: *«ok»*.
La página lo manda al Worker (`/api/avisos/reportar`) con la sesión de Mi
cuenta —quién es lo dice Discord—, el objeto lo guarda y deja los últimos en
KV (`reportes`), y esto los anota en `Pendientes` como «Reporte». ✅ Decidir
los muestra en la sección de su evento, con «Ya lo revisé».

⚠️ SIN MEMORIA PROPIA, A PROPÓSITO: `pendientes.anotar_varios()` no repite una
fila con el mismo detalle, y el detalle lleva el número del reporte (`#<id>`).
Leer la misma cola en cada corrida no duplica nada.

⚠️ NUNCA POR DM, y el Discord ID de quien reportó no se escribe en la hoja:
va su nombre de la Lista, o «una cuenta de Discord».
"""
import datetime as dt
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (BASE, SCR, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

#: la clave de KV que escribe el objeto (`colaReportes()` en `bot/avisos.js`)
COLA = 'reportes'
#: qué se puede reportar: las mismas claves que `QUE_REPORTE` del Worker
QUE = {'ganador': 'El ganador está mal', 'gente': 'Falta o sobra alguien',
       'nombre': 'Un nombre está mal', 'otro': 'Otra cosa'}


def leer():
    """La cola de KV, o `None` si no se pudo leer (no es lo mismo que vacía)."""
    import requests
    import subir_datos as SD
    import fotos as F
    s = requests.Session()
    s.headers['Authorization'] = 'Bearer ' + F.env('CLOUDFLARE_API_TOKEN')
    try:
        # ⚠️ POR `bulk/get`, como `avisos_personales.encolar()`: el de a una da
        # el valor viejo un rato después de escribir
        r = s.post('%s/bulk/get' % SD.API, json={'keys': [COLA]}, timeout=30)
        v = ((r.json().get('result') or {}).get('values') or {}).get(COLA)
        v = v.get('value') if isinstance(v, dict) else v
        return json.loads(v) if isinstance(v, str) else (v or [])
    except (ValueError, OSError):
        return None


def _nombres():
    """`{discord_id: nombre}` de la Lista."""
    try:
        with io.open(os.path.join(BASE, 'datos', 'padron.json'), encoding='utf-8') as f:
            return {str(r.get('discord_id')): (r.get('raw') or r.get('full'))
                    for r in json.load(f) or [] if r.get('discord_id')}
    except (OSError, ValueError):
        return {}


def _et(ms):
    try:
        from zoneinfo import ZoneInfo
        t = dt.datetime.fromtimestamp(int(ms) / 1000, ZoneInfo('America/New_York'))
    except Exception:                                    # noqa: BLE001
        return ''
    return t.strftime('%d/%m ') + t.strftime('%I:%M %p').lstrip('0') + ' ET'


def filas(cola, nombres):
    """`[(tipo, origen, detalle, match)]` para `pendientes.anotar_varios()`."""
    out = []
    for r in cola or []:
        if not isinstance(r, dict) or not r.get('id'):
            continue
        llave = str(r.get('llave') or '')
        origen = 'evento #%s' % llave if llave.isdigit() else 'llave en vivo'
        texto = str(r.get('texto') or '').strip()
        bat = str(r.get('batalla') or '').strip()
        det = '%s%s%s · #%s' % (QUE.get(r.get('que'), QUE['otro']), (': ' + texto) if texto else '',
                                (' · ' + bat) if bat else '', r['id'])
        quien = nombres.get(str(r.get('quien') or '')) or 'una cuenta de Discord'
        out.append(('Reporte', origen, det[:400], ('Lo mandó %s, %s' % (quien, _et(r.get('t')))).strip(', ')))
    return out


def _self_check():
    print('\n  reportes.py — self-check\n')
    mal = 0

    def ok(c, que):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('ok' if c else '🔴', que))

    cola = [{'id': 7, 'quien': '111', 'llave': '370', 'que': 'ganador', 'texto': 'la final la ganó Paria',
             'batalla': '', 't': 1759118400000},
            {'id': 8, 'quien': '222', 'llave': 'v:1554310239942213663', 'que': 'otro', 'texto': 'x' * 500,
             'batalla': 'octavos', 't': 1759118400000},
            {'quien': '333', 'llave': '1', 'que': 'otro'}]
    fs = filas(cola, {'111': 'Hassan'})
    ok(len(fs) == 2, 'un reporte sin número no entra')
    ok(fs[0][:3] == ('Reporte', 'evento #370', 'El ganador está mal: la final la ganó Paria · #7'),
       'el de un evento, con su número y lo que dijo  %s' % (fs[0][:3],))
    ok(fs[0][3].startswith('Lo mandó Hassan, ') and 'ET' in fs[0][3], 'con quién lo mandó, por su nombre')
    ok(fs[1][1] == 'llave en vivo' and fs[1][3].startswith('Lo mandó una cuenta de Discord')
       and len(fs[1][2]) <= 400, 'el de una llave en vivo, sin el ID de quien lo mandó, y corto')
    ok(filas(cola, {}) == filas(cola, {}), 'la misma cola da las mismas filas: `anotar_varios` no repite')
    try:
        import pendientes as P
        ok('Reporte' in P.TIPOS, '«Reporte» es un tipo de `Pendientes`')
    except Exception as e:                               # noqa: BLE001
        ok(False, 'no pude leer pendientes.TIPOS (%s)' % str(e)[:40])
    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


def main():
    if '--auto' in sys.argv:
        return _self_check()
    print('\n══ 📣 LOS REPORTES DE LA PÁGINA, A ✅ DECIDIR ══\n')
    cola = leer()
    if cola is None:
        print('   ⚠️ no pude leer la cola de KV: sigo sin reportes')
        return 0
    fs = filas(cola, _nombres())
    print('   %d reporte(s) en la cola' % len(fs))
    for _t, o, d, m in fs[-8:]:
        print('      %-14s %s  (%s)' % (o[:14], d[:90], m[:40]))
    if '--aplicar' not in sys.argv or not fs:
        if fs:
            print('\n   (simulacro: no escribí nada — corré con --aplicar)\n')
        return 0
    import pendientes as P
    k = P.anotar_varios(fs)
    print('   ✅ %d nuevo(s) en `Pendientes` (%d ya estaban)' % (k, len(fs) - k))
    return 0


if __name__ == '__main__':
    sys.exit(main())
