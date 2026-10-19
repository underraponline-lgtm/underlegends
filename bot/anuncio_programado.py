# -*- coding: utf-8 -*-
"""📣 UN ANUNCIO QUE SALE SOLO, EN LA CORRIDA DE UNA HORA: lo que está en `datos/anuncio_programado.json`.

    python bot/anuncio_programado.py            muestra lo que mandaría y cuándo, sin mandar nada
    python bot/anuncio_programado.py --aplicar  si ya es la hora y no salió, lo manda (paso 2c3 del ciclo)
    python bot/anuncio_programado.py --auto     el self-check, sin red ni archivos

Dlx, 19/10/2026, antes de irse a dormir, sobre el anuncio de las crews: *«publícalo tú automáticamente en la corrida de
las 1pm»*. La PC se apaga, así que lo manda el ciclo, desde Actions.

QUÉ MANDA: cada anuncio tiene una ventana (`desde`–`hasta`, con su zona) y sus mensajes, en orden, a los canales de
novedades de cada servidor (`canales.<SV>.novedades` de `datos/servidores.json`, los mismos de `herramientas/
anunciar.py`). El primero va con `@here` (`aqui`) y los demás sin mención: un segundo ping en el mismo canal notificaría
dos veces a la misma gente. Los textos van como LISTAS DE LÍNEAS: sin barras que escapar al escribirlos a mano.

⚠️ UN ANUNCIO QUE NO DEDUPLICA ES UNA PARED DE MENSAJES (CLAUDE.md). El ciclo corre cada media hora, así que dos
seguros: lo mandado se anota en el mismo archivo (que está en `ARCHIVOS` de `bot/ci/guardar.sh`) y, ANTES de mandar,
se miran los últimos mensajes del canal: si el bot ya publicó uno con la `marca` de ese mensaje, no se repite —aunque
el runner haya perdido lo anotado—.
⚠️ PASADA LA VENTANA NO SALE: si a la 1 PM Discord no contestó, reintenta en la corrida siguiente, pero no a la
madrugada ni al otro día.
⚠️ `"pausado": true` en el anuncio lo frena sin borrar nada (se puede cambiar desde github.com, en el archivo).
"""
import datetime as dt
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE):
    if _p not in sys.path:
        sys.path.insert(0, _p)

RUTA = os.path.join(BASE, 'datos', 'anuncio_programado.json')
API = 'https://discord.com/api/v10'
TOPE = 2000


def _json(ruta, defecto=None):
    try:
        with io.open(ruta, encoding='utf-8') as f:
            return json.load(f)
    except Exception:                                    # noqa: BLE001
        return defecto


def texto(m):
    """El texto de un mensaje: sus líneas, y `@here` arriba si lo lleva."""
    t = '\n'.join(m.get('lineas') or [])
    return ('@here\n\n' + t) if m.get('aqui') else t


def en_ventana(a, ahora):
    """¿Es la hora de este anuncio? `desde` y `hasta` en ISO con su zona."""
    if a.get('pausado'):
        return False
    try:
        return dt.datetime.fromisoformat(a['desde']) <= ahora < dt.datetime.fromisoformat(a['hasta'])
    except Exception:                                    # noqa: BLE001
        return False


def canales(sv_lista):
    sv = _json(os.path.join(BASE, 'datos', 'servidores.json'), {}) or {}
    return [(s, ((sv.get('canales') or {}).get(s) or {}).get('novedades')) for s in sv_lista]


def pendientes(a, mandados):
    """Los `(servidor, número de mensaje)` que faltan de este anuncio, en orden: canal por canal, todos sus mensajes."""
    hechos = (mandados or {}).get(a['id']) or {}
    return [(s, i) for s in a.get('servidores') or [] for i in range(len(a.get('mensajes') or []))
            if str(i) not in (hechos.get(s) or {})]


def ya_esta(ultimos, marca, bot_id):
    """¿El bot ya publicó en el canal un mensaje con esa marca? (el seguro que sobrevive al runner)."""
    for m in ultimos or []:
        if (m.get('author') or {}).get('id') == bot_id and marca and marca in (m.get('content') or ''):
            return m.get('id')
    return None


def mandar(aplicar=True):
    d = _json(RUTA, {}) or {}
    ahora = dt.datetime.now(dt.timezone.utc)
    mandados = d.setdefault('mandados', {})
    tocar = [a for a in d.get('anuncios') or [] if en_ventana(a, ahora) and pendientes(a, mandados)]
    if not tocar:
        return 0
    if not aplicar:
        for a in tocar:
            print('   📣 %s: tocaría mandar %d mensaje(s)' % (a['id'], len(pendientes(a, mandados))))
        return 0
    import requests
    import fotos as F
    h = {'Authorization': 'Bot ' + F.env('DISCORD_TOKEN'), 'Content-Type': 'application/json'}
    yo = requests.get(API + '/users/@me', headers=h, timeout=20).json().get('id')
    hechos = 0
    for a in tocar:
        ch_de = dict(canales(a.get('servidores') or []))
        # 🛡️ si un mensaje no salió en un canal, los que siguen en ESE canal esperan a la corrida siguiente: si no, el
        # segundo saldría antes que el primero, el del @here (la revisión del 19/10/2026)
        trabados = set()
        for s, i in pendientes(a, mandados):
            if s in trabados:
                continue
            ch = ch_de.get(s)
            m = a['mensajes'][i]
            if not ch:
                trabados.add(s)
                print('   🔴 %s: no hay canales.%s.novedades' % (a['id'], s))
                continue
            ult = requests.get('%s/channels/%s/messages?limit=30' % (API, ch), headers=h, timeout=20)
            mid = ya_esta(ult.json() if ult.status_code == 200 else [], m.get('marca'), yo)
            if not mid:
                cuerpo = {'content': texto(m), 'allowed_mentions': {'parse': ['everyone'] if m.get('aqui') else []}}
                r = requests.post('%s/channels/%s/messages' % (API, ch), headers=h, data=json.dumps(cuerpo), timeout=30)
                if r.status_code not in (200, 201):
                    print('   🔴 %s → %s: Discord contestó %s %s' % (a['id'], s, r.status_code, r.text[:160]))
                    trabados.add(s)
                    continue
                mid = r.json().get('id')
                hechos += 1
                print('   📣 %s → %s: https://discord.com/channels/%s/%s' % (a['id'], s, ch, mid))
            mandados.setdefault(a['id'], {}).setdefault(s, {})[str(i)] = mid
            with io.open(RUTA, 'w', encoding='utf-8', newline='\n') as f:
                f.write(json.dumps(d, ensure_ascii=False, indent=1) + '\n')
    return hechos


def _auto():
    mal = []

    def ok(c, t):
        if not c:
            mal.append(t)
            print('  🔴 ' + t)

    a = {'id': 'x', 'desde': '2026-10-19T13:00:00-04:00', 'hasta': '2026-10-19T22:00:00-04:00', 'servidores': ['DRA', 'FFA'],
         'mensajes': [{'aqui': True, 'marca': 'M1', 'lineas': ['hola']}, {'marca': 'M2', 'lineas': ['chau']}]}
    et = dt.timezone(dt.timedelta(hours=-4))
    ok(not en_ventana(a, dt.datetime(2026, 10, 19, 12, 59, tzinfo=et)) and en_ventana(a, dt.datetime(2026, 10, 19, 13, 7, tzinfo=et))
       and not en_ventana(a, dt.datetime(2026, 10, 20, 3, 0, tzinfo=et)), 'sale en su ventana, no antes ni a la madrugada')
    ok(not en_ventana(dict(a, pausado=True), dt.datetime(2026, 10, 19, 13, 7, tzinfo=et)), '«pausado» lo frena')
    ok(pendientes(a, {}) == [('DRA', 0), ('DRA', 1), ('FFA', 0), ('FFA', 1)]
       and pendientes(a, {'x': {'DRA': {'0': '1', '1': '2'}}}) == [('FFA', 0), ('FFA', 1)], 'lo anotado no se vuelve a mandar')
    ok(texto(a['mensajes'][0]).startswith('@here\n\n') and texto(a['mensajes'][1]) == 'chau', '@here sólo en el primero')
    ok(ya_esta([{'author': {'id': 'B'}, 'content': 'algo M1 algo', 'id': '9'}], 'M1', 'B') == '9'
       and ya_esta([{'author': {'id': 'otro'}, 'content': 'M1', 'id': '9'}], 'M1', 'B') is None, 'si el bot ya lo publicó, no se repite')
    # los de verdad: que entren en un mensaje y tengan marca
    d = _json(RUTA, {}) or {}
    for x in d.get('anuncios') or []:
        for i, m in enumerate(x.get('mensajes') or []):
            ok(len(texto(m)) <= TOPE, '%s #%d: %d caracteres, el tope de Discord es %d' % (x['id'], i, len(texto(m)), TOPE))
            ok(m.get('marca') and m['marca'] in texto(m), '%s #%d: sin marca (o la marca no está en el texto)' % (x['id'], i))
        ok(en_ventana(dict(x, pausado=False), dt.datetime.fromisoformat(x['desde'])), '%s: la ventana está al revés' % x['id'])
    print('  ✅ anuncio programado: todo bien' if not mal else '\n  🔴 %d mal' % len(mal))
    return not mal


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        sys.exit(0 if _auto() else 1)
    if '--aplicar' in sys.argv:
        mandar(True)
    else:
        d = _json(RUTA, {}) or {}
        for a in d.get('anuncios') or []:
            print('%s · de %s a %s%s · %s' % (a['id'], a['desde'], a['hasta'], ' · PAUSADO' if a.get('pausado') else '',
                                            ', '.join(a.get('servidores') or [])))
            for i, m in enumerate(a.get('mensajes') or []):
                print('\n── mensaje %d (%d caracteres)%s ──\n%s' % (i + 1, len(texto(m)), ' · con @here' if m.get('aqui') else '', texto(m)))
            print('\nya mandados: %s' % json.dumps((d.get('mandados') or {}).get(a['id']) or {}))
