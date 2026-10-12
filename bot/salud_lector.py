# -*- coding: utf-8 -*-
"""📊 CÓMO LEYÓ EL BOT LAS LLAVES DE CADA SERVIDOR, UNA VEZ POR SEMANA — al canal de Logs.

    python bot/salud_lector.py --ver         el informe de la semana que terminó, sin mandar nada
    python bot/salud_lector.py --publicar    lo manda, una vez por semana (el lunes desde las 11 AM ET)
    python bot/salud_lector.py --auto        el self-check

Dlx, 12/10/2026, a «un resumen semanal de cómo lee cada servidor: qué porcentaje entró solo y cuántas necesitaron
✅ Decidir»: *«Si me gusta»*. Por servidor, la semana de lunes 11 AM a lunes 11 AM (la misma de los multiplicadores):

    eventos     las llaves que entraron al ranking (`datos/llaves_t1.json`)
    solos       las que entraron sin ninguna batalla sin ganador (`datos/batallas_sin_ganador.json`)
    finales     las finales que se le preguntaron al organizador con botones, y cuántas contestó (`datos/finales.json`)

🔎 Y LOS NOMBRES QUE PUEDEN SER OTRA PERSONA: el de alguien de la Lista que NO está en el servidor del evento, cuando
en ese servidor hay UNA cuenta que se llama así. Es el caso de «Astral» en FVS UNDER (12/10/2026): la Lista lo juntaba
con el Astral 🇲🇽, que no está en FVS, y en FVS está «astralito.», apodo «astral». ⚠️ Es una alerta y no un arreglo:
la identidad no se interpreta, se pregunta. Necesita el caché de apodos del ciclo (`.cache/apodos_discord.json`).
"""
import datetime as dt
import io
import json
import os
import re
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ESTADO = os.path.join(BASE, 'datos', 'salud_lector.json')
ET = dt.timezone(dt.timedelta(hours=-4))


def _leer(rel, defecto):
    try:
        with io.open(os.path.join(BASE, rel), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return defecto


def _norm(s):
    import unicodedata
    return ''.join(c for c in unicodedata.normalize('NFKD', str(s or '')) if c.isalnum()).lower()


def semana(ahora=None):
    """`(desde, hasta)` de la semana que terminó: de lunes 11 AM ET a lunes 11 AM ET."""
    ahora = (ahora or dt.datetime.now(dt.timezone.utc)).astimezone(ET)
    lunes = (ahora - dt.timedelta(days=ahora.weekday())).replace(hour=11, minute=0, second=0, microsecond=0)
    if ahora < lunes:
        lunes -= dt.timedelta(days=7)
    return lunes - dt.timedelta(days=7), lunes


def _dia(s):
    try:
        return dt.datetime.strptime(str(s)[:10], '%Y-%m-%d').replace(hour=12, tzinfo=ET)
    except ValueError:
        return None


def _nombres(ev):
    for r in ev.get('rondas') or []:
        for b in r.get('b') or []:
            for lado in (b[0] if b and isinstance(b[0], list) else []):
                for n in re.split(r'\s*[,+&]\s*', str(lado or '')):
                    if n.strip():
                        yield n.strip()


def dudosos(eventos, padron, svs_de, apodos, donde):
    """`[(nombre, evento, sv, quién de la Lista)]`: ver el docstring del módulo."""
    por_nombre = {}
    for p in padron or []:
        k = _norm(re.sub('[\U0001F1E6-\U0001F1FF]', '', p.get('raw') or p.get('full') or ''))
        if k and p.get('discord_id'):
            por_nombre.setdefault(k, []).append(p)
    out, vistos = [], set()
    for ev in eventos:
        sv = ev.get('sv') or ''
        for n in _nombres(ev):
            k = _norm(re.sub('[\U0001F1E6-\U0001F1FF]', '', n))
            ps = por_nombre.get(k) or []
            if len(k) < 3 or len(ps) != 1 or (k, sv) in vistos:
                continue
            d = str(ps[0]['discord_id'])
            suyos = list(svs_de.get(d) or []) or list(donde.get(d) or [])
            if not suyos or sv in suyos:
                continue
            otros = [x for x in (apodos.get(k) or ()) if x != d and sv in (svs_de.get(x) or donde.get(x) or [])]
            if len(otros) == 1:
                vistos.add((k, sv))
                out.append((n, ev.get('nombre') or '', sv, ps[0].get('full') or ps[0].get('raw') or ''))
    return out


def armar(ahora=None, llaves=None, sin_ganador=None, finales=None, dudas_id=None):
    """`(título, líneas)` del informe de la semana que terminó."""
    desde, hasta = semana(ahora)
    llaves = _leer('datos/llaves_t1.json', {}) if llaves is None else llaves
    sin_ganador = (_leer('datos/batallas_sin_ganador.json', {}) or {}).get('batallas') or [] \
        if sin_ganador is None else sin_ganador
    finales = _leer('datos/finales.json', {}) if finales is None else finales
    eventos = [v for v in llaves.values() if isinstance(v, dict) and _dia(v.get('dia')) and desde <= _dia(v['dia']) < hasta]
    con_duda = set()
    for x in sin_ganador:
        p = [y.strip() for y in str(x).split(' · ')]
        if len(p) >= 3:
            con_duda.add((_norm(p[0]), p[1], p[2]))
    por_sv = {}
    for ev in eventos:
        c = por_sv.setdefault(ev.get('sv') or '?', {'ev': 0, 'solos': 0, 'preg': 0, 'cont': 0})
        c['ev'] += 1
        # ⚠️ «SOLO» ES SIN AYUDA: ni una batalla que siga abierta (`batallas_sin_ganador.json`, que sólo guarda lo de
        # hoy) ni una que se haya decidido a mano —la llave guardada la marca «✅ Decidir»—. Sin lo segundo, lo que
        # Dlx ya contestó contaba como leído solo, y la primera corrida dio 100 % en todos los servidores
        a_mano = any('✅ Decidir' in str(b[2]) for r in ev.get('rondas') or [] for b in r.get('b') or [] if len(b) > 2)
        if not a_mano and (_norm(ev.get('nombre')), ev.get('sv'), ev.get('fecha')) not in con_duda:
            c['solos'] += 1
    for f in finales.values():
        if not isinstance(f, dict):
            continue
        t = _dia((f.get('preguntada') or '')[:10])
        if t and desde <= t < hasta + dt.timedelta(days=1):
            c = por_sv.setdefault(f.get('sv') or '?', {'ev': 0, 'solos': 0, 'preg': 0, 'cont': 0})
            c['preg'] += 1
            c['cont'] += bool(f.get('ganador'))
    titulo = '📊 Cómo leyó el bot las llaves · %s → %s' % (desde.strftime('%d/%m'), hasta.strftime('%d/%m'))
    if not por_sv:
        return titulo, ['Ninguna llave entró esta semana.']
    ls = []
    for sv, c in sorted(por_sv.items(), key=lambda x: -x[1]['ev']):
        pct = (' (%d %%)' % round(100.0 * c['solos'] / c['ev'])) if c['ev'] else ''
        lin = '**%s** · %d evento(s), %d solo(s)%s' % (sv, c['ev'], c['solos'], pct)
        if c['preg']:
            lin += ' · %d final(es) preguntada(s), %d contestada(s)' % (c['preg'], c['cont'])
        ls.append(lin)
    tot = sum(c['ev'] for c in por_sv.values())
    sol = sum(c['solos'] for c in por_sv.values())
    if tot:
        ls.append('**En total** · %d de %d entraron solos (%d %%)' % (sol, tot, round(100.0 * sol / tot)))
    dud = dudas_id if dudas_id is not None else _dudosos_de(eventos)
    if dud:
        ls.append('')
        ls.append('🔎 **Nombres que pueden ser otra persona** (la Lista los junta con alguien que no está en ese servidor):')
        for n, ev, sv, quien in dud[:10]:
            ls.append('• «%s» en %s (%s): la Lista dice %s; en %s hay otra cuenta que se llama así' % (n, ev, sv, quien, sv))
    return titulo, ls


def _dudosos_de(eventos):
    crudo = _leer('.cache/apodos_discord.json', {}) or {}
    apodos = {}
    for did, ns in (crudo.get('nombres') or {}).items():
        for n in ns or []:
            k = _norm(re.sub('[\U0001F1E6-\U0001F1FF]', '', n))
            if len(k) >= 3:
                apodos.setdefault(k, set()).add(str(did))
    donde = {str(d): list(s or []) for d, s in (crudo.get('servidores') or {}).items()}
    if not apodos:
        return []
    return dudosos(eventos, _leer('datos/padron.json', []), _leer('datos/servidores_de.json', {}), apodos, donde)


def publicar(ahora=None):
    """Lo manda una vez por semana: el lunes desde las 11 AM ET. Devuelve si mandó."""
    desde, hasta = semana(ahora)
    est = _leer('datos/salud_lector.json', {}) or {}
    if est.get('semana') == hasta.strftime('%Y-%m-%d'):
        return False
    sys.path.insert(0, os.path.join(BASE, 'bot'))
    import avisar
    titulo, ls = armar(ahora)
    if not avisar.mandar(titulo, ls, canal=avisar.CANAL):
        print('   ⚠️ el informe del lector no salió: se reintenta en la próxima')
        return False
    with io.open(ESTADO, 'w', encoding='utf-8', newline='\n') as f:
        json.dump({'_leeme': 'La última semana que bot/salud_lector.py mandó al canal de Logs (una por semana).',
                   'semana': hasta.strftime('%Y-%m-%d')}, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('   📊 mandé cómo leyó el bot las llaves de la semana')
    return True


def _self_check():
    malos = []
    ahora = dt.datetime(2026, 10, 12, 16, 0, tzinfo=dt.timezone.utc)   # lunes 12, 12 PM ET
    d, h = semana(ahora)
    if (d.strftime('%d/%m %H'), h.strftime('%d/%m %H')) != ('05/10 11', '12/10 11'):
        malos.append('la semana: %s → %s' % (d, h))
    d2, h2 = semana(dt.datetime(2026, 10, 12, 13, 0, tzinfo=dt.timezone.utc))   # lunes 9 AM ET: la anterior
    if h2.strftime('%d/%m') != '05/10':
        malos.append('el lunes antes de las 11 todavía es la semana anterior')
    llaves = {'1': {'sv': 'FFA', 'dia': '2026-10-06', 'nombre': 'A', 'fecha': '06/10', 'rondas': []},
              '2': {'sv': 'FFA', 'dia': '2026-10-07', 'nombre': 'B', 'fecha': '07/10', 'rondas': []},
              '3': {'sv': 'FVS', 'dia': '2026-10-08', 'nombre': 'C', 'fecha': '08/10', 'rondas': []},
              '4': {'sv': 'FFA', 'dia': '2026-09-28', 'nombre': 'viejo', 'fecha': '28/09', 'rondas': []}}
    t, ls = armar(ahora, llaves, ['B · FFA · 07/10 · cuartos · x 🆚 y'], {}, [])
    todo = '\n'.join(ls)
    if '**FFA** · 2 evento(s), 1 solo(s) (50 %)' not in todo or '**FVS** · 1 evento(s), 1 solo(s) (100 %)' not in todo:
        malos.append('los números por servidor:\n' + todo)
    if '2 de 3' not in todo:
        malos.append('el total')
    ev = [{'sv': 'FVS', 'nombre': 'FVS UNDER', 'rondas': [{'b': [[['Astral', 'Drexx'], 'Drexx', '']]}]}]
    pad = [{'raw': 'Astral', 'full': 'Astral 🇲🇽', 'discord_id': '916'}, {'raw': 'Drexx', 'full': 'Drexx 🇵🇪', 'discord_id': '115'}]
    svs = {'916': ['DRA'], '115': ['DRA', 'FVS'], '138': ['FVS']}
    dd = dudosos(ev, pad, svs, {'astral': {'916', '138'}, 'drexx': {'115'}}, {})
    if [x[0] for x in dd] != ['Astral']:
        malos.append('el nombre que puede ser otra persona: %s' % dd)
    if dudosos(ev, pad, svs, {'astral': {'916'}}, {}):
        malos.append('sin otra cuenta en ese servidor no es una alerta')
    for m in malos:
        print('   ❌ %s' % m)
    print('   %s el informe semanal del lector' % ('❌' if malos else '✅'))
    return bool(malos)


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        return 1 if _self_check() else 0
    if '--publicar' in sys.argv:
        publicar()
        return 0
    t, ls = armar()
    print(t)
    print('\n'.join(ls))
    return 0


if __name__ == '__main__':
    sys.exit(main())
