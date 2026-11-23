# -*- coding: utf-8 -*-
"""📜 LA HISTORIA DE CADA UNO, PARA EL RANKING GLOBAL: sus títulos de toda la carrera, sus batallas y sus medallas.

    python bot/global_historia.py --ver        lee unos pocos en vivo y los muestra, sin escribir
    python bot/global_historia.py --aplicar    lee los que faltan o tienen más de 7 días y escribe bot/paginas/global_historia.json
    python bot/global_historia.py --auto       el self-check, sin red

Dlx, 23/11/2026: *«crea perfiles para los pros o plazas, y ahí agrega sus historias, como Gazir ganó la FMS World Series…
para que todos tengan un perfil al menos»*. El ranking global cuenta sólo la T1 (Dlx, 20/11: *«que se acople a lo que es
la T1»*): esto NO suma puntos. Es la ficha: lo que cada uno ganó antes, para saber quién es quién.

DE DÓNDE: el perfil de Freestylestats (`/profile/<usuario>`), que Dlx aprobó leer (20/11: *«úsalo»*). La página es Next.js
y trae en su árbol serializado (`self.__next_f.push`) la lista entera de títulos (`"titles":[…]`, lo que abre «Ver
todos»), y en el texto las jornadas, batallas, victorias y medallas.

A QUIÉN: a todos los de `bot/paginas/global.json` que tienen perfil allá. El usuario sale (1) de las batallas que ya leyó
`global_fuente_fstats.py` (`fstats:<usuario>` en `datos/global_batallas.json`) o (2) del nombre, y en ese caso SÓLO si
el perfil se llama igual: un nombre adivinado que cae en otra persona se descarta (unir de más es el error caro).

⚠️ SÓLO LOS RESULTADOS. El perfil trae nombre real, fecha y lugar de nacimiento: no se guardan. Y con calma: una pausa de
`PAUSA` segundos entre pedido y pedido, y cada perfil se vuelve a leer recién a los `VIEJO` días.
"""
import datetime as dt
import json
import os
import re
import sys
import time
import unicodedata

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
GLOBAL = os.path.join(BASE, 'bot', 'paginas', 'global.json')
BATALLAS = os.path.join(BASE, 'datos', 'global_batallas.json')
SALIDA = os.path.join(BASE, 'bot', 'paginas', 'global_historia.json')
URL = 'https://freestylestats.com/profile/'
PAUSA = 1.5
VIEJO = 7
TOPE = 260          # perfiles por corrida, como mucho


def norm(s):
    s = unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]', '', s)


def _flight(html):
    """El árbol serializado de Next.js, ya sin escapes."""
    trozos = re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)', html, flags=re.S)
    crudo = ''.join(trozos)
    try:
        return json.loads('"' + crudo.replace('\n', '\\n') + '"')
    except ValueError:
        return crudo.encode('utf-8', 'ignore').decode('unicode_escape', 'ignore')


def _array(s, i):
    """El arreglo JSON que arranca en `s[i]` (un «[»), contando corchetes fuera de las comillas."""
    hondo, dentro, esc = 0, False, False
    for j in range(i, len(s)):
        c = s[j]
        if dentro:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == '"':
                dentro = False
            continue
        if c == '"':
            dentro = True
        elif c == '[':
            hondo += 1
        elif c == ']':
            hondo -= 1
            if hondo == 0:
                return s[i:j + 1]
    return None


def _titulo(x):
    """Un título de Freestylestats → `[puesto, competencia, temporada, jornada]` (jornada '' si es la temporada entera)."""
    md = x.get('matchday') or {}
    se = md.get('season') or x.get('season') or {}
    co = se.get('competition') or {}
    padre = (co.get('parent') or {}).get('name') or ''
    nom = co.get('name') or ''
    comp = (padre + ' ' + nom).strip() if padre and padre.lower() not in nom.lower() else (nom or padre)
    temp = (se.get('name') or '').replace(' / ', '/')
    return [int(x.get('position') or 0), comp, temp, md.get('name') or '']


def leer_perfil(html):
    """Lo que se guarda de un perfil: `{n, s, j, b, v, m: [oro, plata, bronce], t: [[puesto, comp, temp, jornada]…]}`, o None
    si la página es la de «no existe». Nunca el nombre real ni el nacimiento."""
    m = re.search(r'<title>([^<]*)</title>', html)
    tit = m.group(1) if m else ''
    if not tit or '404' in tit:
        return None
    m = re.match(r'\s*(.*?)\s*\(@([^)]+)\)', tit)
    nombre, slug = (m.group(1), m.group(2)) if m else (tit.split('|')[0].strip(), '')
    texto = re.sub(r'<[^>]+>', '\n', re.sub(r'<script.*?</script>', '', html, flags=re.S))
    L = [x.strip() for x in texto.split('\n') if x.strip()]
    def tras(rotulo, desde=0):
        for i in range(desde, len(L) - 1):
            if L[i] == rotulo and i > 0 and re.match(r'^[\d.]+$', L[i - 1]):
                return int(L[i - 1].replace('.', ''))
        return None
    # «Freestyler | 114 | jornadas / | 424 | batallas»: lo del freestyler va antes de la parte de «Juez»
    fin = next((i for i, x in enumerate(L) if x == 'Juez'), len(L))
    Lf = L[:fin]
    def tras_f(rotulo):
        for i in range(1, len(Lf)):
            if Lf[i].startswith(rotulo) and re.match(r'^[\d.]+$', Lf[i - 1]):
                return int(Lf[i - 1].replace('.', ''))
        return None
    j, b, v = tras_f('jornadas'), tras_f('batallas'), tras_f('victorias')
    med = [tras('Medalla de oro'), tras('Medalla de plata'), tras('Medalla de bronce')]
    titulos = []
    s = _flight(html)
    i = s.find('"titles":[')
    if i >= 0:
        arr = _array(s, i + len('"titles":'))
        try:
            titulos = [_titulo(x) for x in json.loads(arr or '[]') if isinstance(x, dict)]
        except ValueError:
            titulos = []
    titulos = [t for t in titulos if t[0] in (1, 2, 3) and t[1]]
    # el mejor primero; a igual puesto, lo más nuevo primero (la temporada «2025/2026» ordena como texto)
    titulos.sort(key=lambda t: (t[0], [-int(x) for x in re.findall(r'\d{4}', t[2])[:1]] or [0]))
    return {'n': nombre, 's': slug, 'j': j, 'b': b, 'v': v, 'm': [x or 0 for x in med], 't': titulos}


def candidatos(G, batallas):
    """`{clave del ranking: [usuarios de Freestylestats a probar]}`: el leído en las batallas primero, después el nombre."""
    fs = {}
    for x in batallas:
        for lado in ('a', 'b'):
            p = x.get(lado) or {}
            if str(p.get('id', '')).startswith('fstats:'):
                fs.setdefault(norm(p.get('nombre')), (p['id'][7:], p.get('pais') or ''))
    # ⚠️ HOMÓNIMOS: dos del ranking con el mismo nombre (Abel de Argentina y Abel de Ecuador) no se llevan el mismo perfil:
    # con un nombre repetido, el país tiene que coincidir (23/11/2026)
    repetidos = {}
    for g in G:
        repetidos[norm(g.get('n'))] = repetidos.get(norm(g.get('n')), 0) + 1
    out = {}
    for g in G:
        k, n = g.get('k'), norm(g.get('n'))
        if not k or not n:
            continue
        hit = fs.get(n)
        seguro = hit[0] if hit and (repetidos.get(n, 0) < 2 or (hit[1] and hit[1] == g.get('cc'))) else None
        if hit and not seguro:
            continue
        if seguro:
            out[k] = [(seguro, True)]
        elif g.get('esc') == 'pro':
            # un pro sin batallas leídas allá: se prueba por el nombre, y vale sólo si el perfil se llama igual
            if repetidos.get(n, 0) < 2:
                out[k] = [(n, False)] + ([(n + 'mc', False)] if not n.endswith('mc') else [])
    return out


#: en un evento por equipos varios ganan el mismo oro, y eso no es una duda
EQUIPOS = re.compile(r'2\s?vs\s?2|3\s?vs\s?3|equipo|pandilla|duo|dúo|parejas', re.I)


def marcar_dudas(P):
    """⚠️ UN MISMO ORO PARA DOS PERSONAS: Freestylestats tiene errores a la vista (23/11/2026: Red Bull Internacional 2024 lo
    tenían Chuty y Gazir). Si dos o más tienen el 1.º de la misma competencia, temporada y jornada, a todos se les marca
    «en duda» (quinto valor 1) en vez de elegir uno: no se sabe cuál está bien. Devuelve cuántos títulos marcó"""
    duenos = {}
    for k, x in P.items():
        for t in x.get('t') or []:
            if t[0] == 1 and not EQUIPOS.search(t[1] + ' ' + t[3]):
                duenos.setdefault((t[1], t[2], t[3]), set()).add(k)
    n = 0
    for k, x in P.items():
        for t in x.get('t') or []:
            dudoso = t[0] == 1 and len(duenos.get((t[1], t[2], t[3]), ())) > 1
            del t[4:]
            if dudoso:
                t.append(1)
                n += 1
    return n


def correr(aplicar, pocos=0):
    import requests
    G = json.load(open(GLOBAL, encoding='utf-8'))['g']
    try:
        bat = json.load(open(BATALLAS, encoding='utf-8'))['batallas']
    except (OSError, ValueError):
        bat = []
    try:
        viejo = json.load(open(SALIDA, encoding='utf-8'))
    except (OSError, ValueError):
        viejo = {}
    P = dict(viejo.get('p') or {})
    nombres = {g['k']: g.get('n') for g in G if g.get('k')}
    hoy = dt.date.today()
    cand = candidatos(G, bat)
    # primero los pros y lo que nunca se leyó; lo leído hace menos de `VIEJO` días se deja
    orden = sorted(cand, key=lambda k: (k in P, (P.get(k) or {}).get('u', '')))
    s = requests.Session()
    s.headers['User-Agent'] = 'UnderLegends-ranking/1.0 (+https://underlegends.pages.dev)'
    leidos, nuevos, sin = 0, 0, []
    for k in orden:
        x = P.get(k)
        if x and x.get('u') and (hoy - dt.date.fromisoformat(x['u'])).days < VIEJO:
            continue
        if leidos >= (pocos or TOPE):
            break
        hallado = None
        for slug, seguro in cand[k]:
            try:
                r = s.get(URL + slug, timeout=25)
            except requests.RequestException:
                r = None
            leidos += 1
            time.sleep(PAUSA)
            if not r or r.status_code != 200:
                continue
            per = leer_perfil(r.content.decode('utf-8', 'ignore'))
            if not per:
                continue
            # un usuario adivinado por el nombre vale sólo si el perfil se llama igual
            if not seguro and norm(per['n']) != norm(nombres.get(k)):
                continue
            hallado = per
            break
        if hallado:
            hallado.pop('n', None)
            hallado['u'] = hoy.isoformat()
            nuevos += 1 if k not in P else 0
            P[k] = hallado
        else:
            sin.append(k)
    marcar_dudas(P)
    out = {'_leeme': 'La historia de cada uno en el ranking global (bot/global_historia.py): sus títulos de toda la carrera '
                     '(t: [puesto, competencia, temporada, jornada]), jornadas (j), batallas (b), victorias (v) y medallas '
                     '(m: oro, plata, bronce), de Freestylestats. No suma puntos: el ranking cuenta sólo la T1. Sin nombre '
                     'real ni nacimiento, a propósito.',
           't': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'), 'fuente': 'https://freestylestats.com',
           'p': {k: P[k] for k in sorted(P)}}
    print('📜 historia: %d perfiles (%d nuevos), %d pedidos, %d sin perfil allá' % (len(P), nuevos, leidos, len(sin)))
    if aplicar:
        with open(SALIDA, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
        print('   escrito', os.path.relpath(SALIDA, BASE))
    else:
        for k in list(P)[:6]:
            x = P[k]
            print('  ', k, '·', x.get('b'), 'batallas ·', x.get('m'), '·', [' '.join(map(str, t)) for t in x['t'][:3]])
    return out


def auto():
    ok = True
    def chk(c, msg):
        nonlocal ok
        print(('  ✅ ' if c else '  ❌ ') + msg)
        ok = ok and c
    flight = json.dumps('x"titles":[{"id":"1","position":1,"matchday":null,"season":{"name":"2025 / 2026","competition":'
                        '{"name":"World Series","parent":{"name":"FMS"}}}},{"id":"2","position":2,"matchday":{"name":"Regional '
                        'Madrid","season":{"name":"2022","competition":{"name":"España","parent":{"name":"Red Bull Batalla"}}}},'
                        '"season":null},{"id":"3","position":1,"matchday":{"name":"Regional Zaragoza","season":{"name":"2026 / '
                        '2027","competition":{"name":"España","parent":{"name":"Red Bull Batalla"}}}},"season":null}]')[1:-1]
    html = ('<title>Gazir (@gazir) | Freestyle Stats</title><div>Nombre real</div><div>Alguien Real</div>'
            '<div>Freestyler</div><div>114</div><div>jornadas /</div><div>424</div><div>batallas</div>'
            '<div>368</div><div>victorias</div><div>15</div><div>Medalla de oro</div><div>12</div><div>Medalla de plata</div>'
            '<div>6</div><div>Medalla de bronce</div><div>Juez</div><div>4</div><div>jornadas /</div><div>68</div><div>batallas</div>'
            '<script>self.__next_f.push([1,"' + flight + '"])</script>')
    p = leer_perfil(html)
    chk(p and p['s'] == 'gazir' and p['j'] == 114 and p['b'] == 424 and p['v'] == 368 and p['m'] == [15, 12, 6],
        'el perfil: jornadas, batallas y victorias del freestyler (no las de juez) y las medallas')
    chk(p and p['t'][0] == [1, 'Red Bull Batalla España', '2026/2027', 'Regional Zaragoza'] and p['t'][1] == [1, 'FMS World Series', '2025/2026', '']
        and p['t'][-1][0] == 2, 'los títulos: competencia con su madre, temporada, jornada; oros primero y lo más nuevo arriba')
    chk('Alguien Real' not in json.dumps(p, ensure_ascii=False), 'el nombre real no se guarda')
    chk(leer_perfil('<title>Error 404 | Freestyle Stats</title>') is None, 'la página de «no existe» es None')
    P = {'a': {'t': [[1, 'RB Internacional', '2024', 'Final'], [1, 'FMS España', '2020/2021', '']]}, 'b': {'t': [[1, 'RB Internacional', '2024', 'Final']]}}
    P['c'] = {'t': [[1, 'God Level 2vs2', '2019', 'Perú']]}
    P['d'] = {'t': [[1, 'God Level 2vs2', '2019', 'Perú']]}
    chk(marcar_dudas(P) == 2 and P['a']['t'][0] == [1, 'RB Internacional', '2024', 'Final', 1] and len(P['a']['t'][1]) == 4,
        'un mismo oro en dos personas: los dos «en duda»; el que es de uno solo, limpio')
    G = [{'k': 'gazir', 'n': 'Gazir', 'esc': 'pro'}, {'k': 'airon', 'n': 'Airon', 'esc': 'plaza'}, {'k': 'nadie', 'n': 'Nadie', 'esc': 'plaza'}]
    bat = [{'a': {'id': 'fstats:aironpunchline', 'nombre': 'Airon'}, 'b': {'id': 'fms:1', 'nombre': 'X'}},
           {'a': {'id': 'fstats:abel', 'nombre': 'Abel', 'pais': 'ar'}, 'b': {'id': 'fms:2', 'nombre': 'Y'}}]
    G += [{'k': 'abel', 'n': 'Abel', 'esc': 'pro', 'cc': 'ar'}, {'k': 'abel-ec', 'n': 'Abel', 'esc': 'plaza', 'cc': 'ec'}]
    c = candidatos(G, bat)
    chk(c.get('abel') == [('abel', True)] and 'abel-ec' not in c, 'homónimos: el perfil va al del mismo país, y el otro se queda sin')
    chk(c.get('airon') == [('aironpunchline', True)] and c.get('gazir')[0] == ('gazir', False) and 'nadie' not in c,
        'a quién: el usuario leído en las batallas (seguro), un pro por su nombre (a verificar), y nadie más')
    print('✅ todo bien' if ok else '❌ algo falló')
    return ok


if __name__ == '__main__':
    if '--auto' in sys.argv:
        sys.exit(0 if auto() else 1)
    correr('--aplicar' in sys.argv, pocos=0 if '--aplicar' in sys.argv else 6)
