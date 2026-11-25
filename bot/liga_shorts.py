# -*- coding: utf-8 -*-
"""📱 LOS SHORTS DE LA LIGA, PARA LA PÁGINA «REELS»: los videos verticales de los canales de los socios, atados a quien
nombran.

    python bot/liga_shorts.py              lee los canales y dice qué ataría, sin escribir nada (10 ejemplos)
    python bot/liga_shorts.py --aplicar    lee si toca (una vez por día, en hora del este) y escribe los dos archivos
    python bot/liga_shorts.py --aplicar --ya   lee aunque hoy ya se haya leído
    python bot/liga_shorts.py --sin-red    arma la salida con lo guardado, sin preguntarle a YouTube
    python bot/liga_shorts.py --auto       el self-check, sin red

24/11/2026, para la página nueva de Reels: el Ranking global ya trae los shorts de los canales grandes
(`bot/global_fuente_shorts.py`); éstos son los de los canales de NUESTROS socios (`datos/videos_canales.json`, los mismos
de `bot/videos.py`), atados a la gente de la Liga. Se lee la pestaña pública «Shorts» de cada canal con
`global_fuente_shorts.leer_canal()` —sin clave de la API— y lo nuevo se suma a `datos/liga_shorts_fuente.json`
(id, título, servidor y canal; lo nuevo arriba; hasta `GUARDAR`).

CÓMO SE ATA UN SHORT A ALGUIEN («en la duda, a nadie»: unir de más es el error caro, es la cara de otro)
  · el título de un short es libre («MINUTAZO DE X», «X LE RESPONDE A Y»), así que no se buscan los lados de un «vs»
    como en `videos.py`: se busca cada nombre ENTERO como palabra suelta, como `global_fuente_shorts.atar()`;
  · sin los hashtags: los canales etiquetan nombres que no salen en el video;
  · los nombres largos primero («Fat Tony» no es también «Tony»), de 4 letras o más, y no una palabra común;
  · un nombre de famoso (`sheet/famosos.py`) no va a nadie: «ACZINO» en un short es Aczino, no quien se anotó así;
  · y la regla de `videos.quien()`: con bandera, la de su país; sin bandera, tiene que haber jugado en el servidor de
    ese canal o ser miembro. Dos de la Lista con el mismo nombre y sin bandera que los separe: a nadie;
  · un título con más de `MAX_NOMBRADOS` nombres es un compilado: a nadie.

QUIÉN SALE: sólo quien tiene perfil en la página (el pool de la Temporada, con la clave de `subir_web._clave()`, que
separa a los que chocan) y no pidió salir (`verificados._olvidados()`). Viaja sin caras: la página ya las tiene.

⚠️ `bot/paginas/liga_shorts.json` NO SE COMMITEA EN EL CICLO: `guardar.sh` sólo guarda `datos/*.json` (y lo mira
`chequeos.yml`). Lo que sobrevive al runner es la fuente; la salida se rehace en cada corrida desde ella, sin red, y su
`t` es el de la última lectura y no el de la corrida, así que sale igual byte a byte mientras nada cambie y el hash de
`bot/paginas/` no despliega de más.

⚠️ YOUTUBE NO DEJA SACAR MÉTRICAS DE SUS DATOS: sólo el id, el título limpio (`titulo_web()`) y de qué canal es.
"""
import datetime as dt
import io
import json
import os
import re
import sys
import time

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (BASE, os.path.join(BASE, 'sheet'), SCR):
    if _p not in sys.path:
        sys.path.insert(0, _p)

CANALES = os.path.join(BASE, 'datos', 'videos_canales.json')
FUENTE = os.path.join(BASE, 'datos', 'liga_shorts_fuente.json')
SALIDA = os.path.join(BASE, 'bot', 'paginas', 'liga_shorts.json')
GUARDAR = 1500       # cuántos shorts se guardan como mucho (los más nuevos)
POR_PERSONA = 12     # cuántos viajan por persona
MAX_NOMBRADOS = 3    # un título que nombra a más es un compilado
MIN_LETRAS = 4       # un nombre más corto es casi siempre otra cosa («Sol», «Rey», «Lil»)
PAUSA = 1.0          # ~1 pedido por segundo, como global_fuente_shorts.py

_BANDERA = re.compile('[\U0001F1E6-\U0001F1FF]{2}')
_MARCA = 'qqbb%sqq'                                  # la bandera, como palabra, para que sobreviva a `norm()`
#: además de `global_fuente_shorts.COMUNES`: palabras que pueden ser el nombre de alguien y salen en cualquier título
MAS_COMUNES = {
    'para', 'como', 'esto', 'este', 'esta', 'pero', 'cuando', 'donde', 'quien', 'nunca', 'siempre', 'ahora', 'hace',
    'tiene', 'sabe', 'mira', 'miren', 'vamos', 'dale', 'bien', 'malo', 'mala', 'loco', 'loca', 'vida', 'muerte', 'amor',
    'odio', 'alma', 'cielo', 'noche', 'sangre', 'guerra', 'oro', 'plata', 'bronce', 'gran', 'nuevo', 'nueva', 'primera',
    'primero', 'segunda', 'segundo', 'ultimo', 'ultima', 'solo', 'sola', 'unico', 'unica', 'real', 'verdad', 'mentira',
    'fake', 'team', 'crew', 'squad', 'gang', 'clan', 'familia', 'family', 'under', 'legends', 'legend', 'versus', 'cypher',
    'hood', 'cypherhood', 'snake', 'future', 'series', 'roosters', 'evento', 'eventos', 'torneo', 'copa', 'show', 'live',
    'vivo', 'directo', 'reaccion', 'peor', 'momento', 'momentos', 'clip', 'clips', 'parte', 'game', 'money', 'dinero',
    'barrio', 'ciudad', 'ronda', 'rondas', 'octavos', 'cuartos', 'semifinal', 'semis', 'nivel', 'respuesta', 'ataque',
    'golpe', 'base', 'beat', 'beats', 'verso', 'versos', 'tecnica', 'easy', 'mode', 'hard', 'minutos', 'segundos',
    'rapero', 'raperos', 'rapera', 'mc', 'mcs', 'puro', 'pura', 'flow', 'estilo', 'duelo', 'duelos', 'clasico', 'gana',
    'gano', 'pierde', 'perdio', 'humillo', 'destruye', 'destruyo', 'responde', 'respondio', 'otro', 'otra', 'todos',
    'nadie', 'algo', 'mucho', 'mucha', 'poco', 'tanto', 'cada', 'sobre', 'entre', 'hasta', 'desde', 'contra', 'sin',
    'with', 'from', 'this', 'that', 'what', 'best', 'free', 'style', 'battle', 'battles', 'world', 'tiktok', 'youtube',
    'viral', 'parati', 'fyp', 'xyzbca', 'video', 'videos',
}


def _iso(par):
    return ''.join(chr(ord(c) - 0x1F1E6 + 97) for c in par)


def _texto(titulo):
    """El título para buscar nombres: sin hashtags, normalizado, con cada bandera como una palabra (`qqbbarqq`)."""
    import global_fuente_shorts as GS
    t = re.sub(r'#\S+', ' ', str(titulo or ''))
    t = _BANDERA.sub(lambda m: ' %s ' % (_MARCA % _iso(m.group())), t)
    return ' ' + GS.norm(t) + ' '


def _apto(forma):
    """¿Esta forma de un nombre se puede buscar en un título libre? Ver el docstring del módulo."""
    import global_fuente_shorts as GS
    try:
        import famosos as F
    except Exception:                                    # noqa: BLE001
        F = None
    pl = forma.replace(' ', '')
    if len(pl) < MIN_LETRAS or pl.isdigit() or forma in GS.COMUNES or forma in MAS_COMUNES or pl in MAS_COMUNES:
        return False
    if F and (F.es_famoso(forma) or F.plano(forma) in F._PLANOS):
        return False
    return True


def formas_de(padron, alias_de, pares=()):
    """`{forma normalizada: clave}`: cómo se puede escribir a cada uno en un título. Los nombres de la Lista y sus alias
    (`alias_de`, que ya viene en clave); `pares` = `[[alias como se escribe, real]]` de `datos/akas.json`, para los alias
    de varias palabras. Una forma que da dos claves no se busca."""
    import global_fuente_shorts as GS
    from comun.claves import clave
    cand = {}
    reales = {p.get('raw') for p in padron if p.get('raw')}
    for p in padron:
        if p.get('raw'):
            cand.setdefault(GS.norm(p['raw']), set()).add(clave(p['raw']))
    for a, real in (alias_de or {}).items():
        if real in reales:
            cand.setdefault(GS.norm(a), set()).add(clave(a))
    for par in pares or ():
        if len(par) >= 2 and par[1] in reales and clave(par[0]) in (alias_de or {}):
            cand.setdefault(GS.norm(par[0]), set()).add(clave(par[0]))
    return {f: next(iter(ks)) for f, ks in cand.items() if f and len(ks) == 1 and _apto(f)}


def atar(shorts, formas, idx, svs, k_de):
    """`[(short, [claves de la Liga])]` de los shorts que nombran a alguien. `shorts` = `[[vid, título, sv, cid]…]`;
    `formas` de `formas_de()`; `idx` y `svs` de `videos.indice()`; `k_de(raw)` -> la clave de su perfil o `None`.
    También devuelve, aparte, los que se descartaron con el porqué: `(atados, dudas)`."""
    import videos as V
    orden = sorted(formas, key=lambda f: -len(f))
    # el nombre entero, y la bandera si va pegada detrás («CARLOS 🇲🇽»): es la que separa a dos que se llaman igual
    pats = [(f, re.compile(r'(?<= )' + re.escape(f) + r'(?: (qqbb[a-z]{2}qq))?(?= )')) for f in orden]
    atados, dudas = [], []
    for sh in shorts:
        vid, tit, sv = sh[0], sh[1], sh[2]
        t = _texto(tit)
        vistos = []                                      # (forma, iso)

        def tomar(m, f):
            iso = m.group(1)[4:6] if m.group(1) else ''
            vistos.append((f, iso))
            return ' · '
        for f, p in pats:
            if (' ' + f + ' ') in t or (' ' + f + ' qqbb') in t:
                t = p.sub(lambda m, f=f: tomar(m, f), t)
        if not vistos:
            continue
        if len({f for f, _ in vistos}) > MAX_NOMBRADOS:
            dudas.append((tit, 'compilado: %d nombres' % len({f for f, _ in vistos})))
            continue
        ks, fuera = [], []
        for f, iso in vistos:
            raw = V.quien(formas[f], iso, sv, idx, svs)
            k = k_de(raw) if raw else None
            if k:
                if k not in ks:
                    ks.append(k)
            else:
                fuera.append('%s%s%s' % (f, (' ' + iso) if iso else '', ' (sin perfil)' if raw else ''))
        if fuera:
            dudas.append((tit, 'sin dueño seguro: ' + ', '.join(fuera)))
        if ks:
            atados.append((sh, ks))
    return atados, dudas


#: 🤝 los shorts de un socio que no nombran a nadie de la Liga, por servidor (los más nuevos)
POR_SERVIDOR = 30


def _nombres_sv():
    """`{sigla: nombre}` de los servidores CONFIRMADOS de la Liga (datos/servidores.json): un ex socio no presta su nombre"""
    try:
        S = json.load(io.open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'datos', 'servidores.json'),
                              encoding='utf-8')).get('servidores') or {}
    except (OSError, ValueError):
        return {}
    return {k: v.get('nombre') or k for k, v in S.items() if isinstance(v, dict) and v.get('confirmado')}


def salida(atados, canales, gente, visto, shorts=None, nombres_sv=None):
    """El json de la página: `{t, cs, g: [{k, n, cc, sv, vs: [[vid, canal, [otros], título]…]}]}`. `gente[k]` = la fila
    del pool; `canales` = la lista de `videos_canales.json`."""
    import global_fuente_shorts as GS
    ci = {c['id']: i for i, c in enumerate(canales)}
    por = {}
    for sh, ks in atados:
        for k in ks:
            xs = por.setdefault(k, [])
            if len(xs) < POR_PERSONA:
                xs.append([sh[0], ci.get(sh[3], -1) if len(sh) > 3 else -1, [x for x in ks if x != k], GS.titulo_web(sh[1])])
    g = []
    for k, vs in por.items():
        p = gente.get(k) or {}
        g.append({'k': k, 'n': p.get('raw') or k, 'cc': (p.get('cc') or '').lower(), 'sv': p.get('sv') or '', 'vs': vs})
    g.sort(key=lambda x: (-len(x['vs']), x['n'].lower()))
    out = {'t': visto, 'cs': [c.get('nombre') or c['id'] for c in canales], 'g': g}
    # 🤝 LOS QUE NO NOMBRAN A NADIE, A NOMBRE DE SU SERVIDOR (Dlx, 25/11/2026: «Yes», a mostrar los shorts de los socios que no
    # nombran a nadie de la Liga con el logo y el nombre del servidor). `s`: [[vid, canal, sigla, título]]; `svn`: {sigla: nombre}.
    # Sólo de servidores confirmados (un ex socio, no), hasta `POR_SERVIDOR` por servidor, lo nuevo primero
    if shorts:
        nsv = _nombres_sv() if nombres_sv is None else nombres_sv
        ya = {sh[0] for sh, _ks in atados}
        s, cuantos = [], {}
        for sh in shorts:
            sv = sh[2] if len(sh) > 2 else ''
            if sh[0] in ya or sv not in nsv or cuantos.get(sv, 0) >= POR_SERVIDOR:
                continue
            cuantos[sv] = cuantos.get(sv, 0) + 1
            s.append([sh[0], ci.get(sh[3], -1) if len(sh) > 3 else -1, sv, GS.titulo_web(sh[1])])
        if s:
            out['s'] = s
            out['svn'] = {k: nsv[k] for k in cuantos}
    return out


# ── leer los canales ─────────────────────────────────────────────────────────────────────────────────────────────────
def _et():
    from zoneinfo import ZoneInfo
    return ZoneInfo('America/New_York')


def _ahora_et():
    return dt.datetime.now(dt.timezone.utc).astimezone(_et())


def toca(fuente):
    """¿Toca leer? Una vez por día, en hora del este: si la última lectura fue otro día."""
    try:
        v = dt.datetime.fromisoformat(fuente.get('visto') or '')
    except ValueError:
        return True
    return v.astimezone(_et()).date() != _ahora_et().date()


def leer(canales, viejo):
    """Lee la pestaña «Shorts» de cada canal y la junta con lo guardado: lo nuevo arriba —intercalado entre canales por
    su lugar en cada pestaña, que es lo más parecido a «del más nuevo al más viejo» sin fechas—. Un canal que falla no
    tumba a los demás. Devuelve `(shorts, {canal: cuántos leyó}, avisos)`"""
    import global_fuente_shorts as GS
    ya = {x[0] for x in viejo}
    por_canal, leidos, avisos = [], {}, []
    for c in canales:
        try:
            xs = GS.leer_canal(c['id'])
        except Exception as e:                           # noqa: BLE001
            avisos.append('%s (%s): no pude leer sus shorts (%s)' % (c.get('nombre'), c['sv'], str(e)[:80]))
            continue
        leidos[c.get('nombre') or c['id']] = len(xs)
        por_canal.append([[vid, t, c['sv'], c['id']] for vid, t in xs if vid not in ya])
        time.sleep(PAUSA)
    nuevos, vistos = [], set()
    for i in range(max([len(x) for x in por_canal] or [0])):
        for xs in por_canal:
            if i < len(xs) and xs[i][0] not in vistos:
                vistos.add(xs[i][0])
                nuevos.append(xs[i])
    return (nuevos + [list(x) for x in viejo])[:GUARDAR], leidos, avisos


def _json(ruta, defecto):
    try:
        return json.load(io.open(ruta, encoding='utf-8'))
    except (OSError, ValueError):
        return defecto


def _contexto():
    """Lo que hace falta para atar: el índice de `videos.py` armado igual que en `videos.correr()`, las formas, y la clave
    de perfil de cada `raw`."""
    import motor
    import videos as V
    from comun.claves import clave
    padron = _json(os.path.join(BASE, 'datos', 'padron.json'), [])
    svde = _json(os.path.join(BASE, 'datos', 'servidores_de.json'), {})
    r, _n = motor._resolvedor()
    nombres = {clave(p.get('raw')) for p in padron if p.get('raw')}
    alias_de = {k: v for k, v in (getattr(r, 'padron', None) or {}).items() if k not in nombres}
    jugo = {}
    for x in (_json(os.path.join(BASE, 'datos', 'llaves_t1.json'), {}) or {}).values():
        if isinstance(x, dict):
            for fila in x.get('tabla') or []:
                q = r(fila[0]) if fila else None
                if q:
                    jugo.setdefault(q, set()).add(x.get('sv'))
    idx, svs = V.indice(padron, alias_de, svde, jugo)
    pares = (_json(os.path.join(BASE, 'datos', 'akas.json'), {}) or {}).get('pares') or []
    formas = formas_de(padron, alias_de, pares)
    # 👤 quién tiene perfil: el pool de la Temporada, con la clave de la página (`subir_web._clave`, que separa choques)
    try:
        import subir_web as S
        _k = S._clave
    except Exception:                                    # noqa: BLE001
        _k = lambda p: clave(p.get('raw'))               # noqa: E731
    try:
        import verificados as VER
        olv = set(VER._olvidados() or {})
    except Exception:                                    # noqa: BLE001
        olv = set()
    did_pad = {p.get('raw'): str(p.get('discord_id') or '') for p in padron if p.get('raw')}
    por_raw = {}
    for p in _json(os.path.join(BASE, 'datos', 'temporada_pool.json'), []) or []:
        if p.get('raw'):
            por_raw.setdefault(p['raw'], []).append(p)
    gente = {}
    raw_k = {}
    for raw, ps in por_raw.items():
        if len(ps) != 1:                                 # dos filas con el mismo nombre exacto: no se sabe cuál
            continue
        did = str(ps[0].get('discord_id') or did_pad.get(raw) or '')
        if did and did in olv:
            continue
        k = _k(ps[0])
        raw_k[raw] = k
        gente[k] = ps[0]
    return formas, idx, svs, raw_k.get, gente


def correr(aplicar=False, red=True, ya=False):
    cfg = _json(CANALES, {})
    canales = cfg.get('canales') or []
    fuente = _json(FUENTE, {}) or {}
    viejo = fuente.get('s') or []
    leer_hoy = red and (ya or not aplicar or toca(fuente))
    if leer_hoy:
        shorts, leidos, avisos = leer(canales, viejo)
        visto = _ahora_et().isoformat(timespec='seconds')
        for n, c in leidos.items():
            print('   📱 %-26s %3d shorts en su pestaña' % (n[:26], c))
        for a in avisos:
            print('   ⚠️', a)
        if not leidos:
            print('   ⚠️ no pude leer ningún canal: queda lo guardado')
            shorts, visto = viejo, fuente.get('visto') or ''
    else:
        shorts, visto = viejo, fuente.get('visto') or ''
        print('   📱 los shorts de la Liga: hoy ya se leyeron, armo con lo guardado (%d)' % len(shorts))
    formas, idx, svs, k_de, gente = _contexto()
    atados, dudas = atar(shorts, formas, idx, svs, k_de)
    out = salida(atados, canales, gente, visto, shorts)
    print('   📱 %d shorts guardados · %d atados a alguien · %d persona(s) · %d a nombre de su servidor'
          % (len(shorts), len(atados), len(out['g']), len(out.get('s') or [])))
    nom = {k: (gente.get(k) or {}).get('raw') or k for k in gente}
    if not aplicar:
        for sh, ks in atados[:10]:
            print('      %-60s → %s' % (sh[1][:60], ', '.join(nom.get(k, k) for k in ks)))
        print('   🤔 descartados (%d), los primeros:' % len(dudas))
        for t, por in dudas[:10]:
            print('      %-60s · %s' % (t[:60], por))
        return 0
    if leer_hoy and shorts is not viejo:
        with io.open(FUENTE, 'w', encoding='utf-8', newline='\n') as f:
            json.dump({'_leeme': 'Los shorts de los canales de los socios (bot/liga_shorts.py, 24/11/2026): [id, título, '
                                 'servidor, canal], lo nuevo arriba. Se atan a la gente en bot/paginas/liga_shorts.json.',
                       'visto': visto, 's': shorts}, f, ensure_ascii=False, separators=(',', ':'))
            f.write('\n')
        print('   ✅ datos/liga_shorts_fuente.json')
    txt = json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '\n'
    if (io.open(SALIDA, encoding='utf-8').read() if os.path.exists(SALIDA) else '') != txt:
        with io.open(SALIDA, 'w', encoding='utf-8', newline='\n') as f:
            f.write(txt)
        print('   ✅ bot/paginas/liga_shorts.json (%d KB)' % (len(txt.encode('utf-8')) // 1024))
    else:
        print('   bot/paginas/liga_shorts.json: igual que antes')
    return 0


def _self_check():
    import videos as V
    mal = 0
    padron = [{'raw': 'Oasis', 'pais': 'Chile'}, {'raw': 'Snow', 'pais': 'Colombia'}, {'raw': 'Carlos', 'pais': 'México'},
              {'raw': 'Deuxs', 'pais': 'Chile'}, {'raw': 'Rubik', 'pais': 'Chile'}, {'raw': 'Zeta', 'pais': 'Chile'},
              {'raw': 'Fat Tony', 'pais': 'Chile'}, {'raw': 'Tony', 'pais': 'Chile'}, {'raw': 'Aczino', 'pais': 'Chile'},
              {'raw': 'Once', 'pais': 'Chile'}]
    try:
        from padron_t1 import PAIS_ISO
        iso_ok = PAIS_ISO.get('Chile') == 'cl'
    except Exception:                                    # noqa: BLE001
        iso_ok = False
    jugo = {'Oasis': {'FFA'}, 'Snow': {'FFA'}, 'Carlos': {'FFA'}, 'Deuxs': {'FVS'}, 'Rubik': {'FFA'}, 'Zeta': {'FFA'},
            'Fat Tony': {'FFA'}, 'Tony': {'FFA'}, 'Aczino': {'FFA'}, 'Once': {'FFA'}}
    idx, svs = V.indice(padron, {}, {}, jugo)
    formas = formas_de(padron, {})
    k_de = lambda raw: raw.lower().replace(' ', '')     # noqa: E731
    sh = [['v1', 'OASIS LE RESPONDE A SNOW 🔥 #shorts', 'FFA', 'c1'],
          ['v2', 'CARLOS 🇨🇱 NO PERDONA', 'FFA', 'c1'],
          ['v3', 'MINUTAZO DE DEUXS', 'FFA', 'c1'],
          ['v4', 'QUÉ RIMA 🔥 #oasis #snow', 'FFA', 'c1'],
          ['v5', 'OASIS SNOW RUBIK Y ZETA EN UNA NOCHE', 'FFA', 'c1'],
          ['v6', 'FAT TONY ES BICAMPEÓN', 'FFA', 'c1'],
          ['v7', 'ACZINO Y ONCE EN LA FINAL', 'FFA', 'c1'],
          ['v8', 'CARLOS 🇲🇽 CIERRA LA FINAL', 'FFA', 'c1'],
          ['v9', 'DEUXS EN SU CASA', 'FVS', 'c2']]
    at, dudas = atar(sh, formas, idx, svs, k_de)
    A = {s[0]: ks for s, ks in at}
    casos = [
        ('las banderas del padrón se leen (padron_t1.PAIS_ISO)', iso_ok),
        ('un short que nombra a dos va a los dos', A.get('v1') == ['oasis', 'snow']),
        ('con bandera que no es la de su país: a nadie', 'v2' not in A),
        ('con la bandera de su país, sí', A.get('v8') == ['carlos']),
        ('sin bandera y de otro servidor: a nadie', 'v3' not in A),
        ('sin bandera y de su servidor, sí', A.get('v9') == ['deuxs']),
        ('un nombre que sólo está en un hashtag no cuenta', 'v4' not in A),
        ('un compilado de más de tres: a nadie', 'v5' not in A and any(t.startswith('OASIS SNOW') for t, _ in dudas)),
        ('«FAT TONY» es Fat Tony y no también Tony', A.get('v6') == ['fattony']),
        ('un famoso y una palabra común no se buscan', 'v7' not in A and 'aczino' not in formas and 'once' not in formas),
    ]
    gente = {'oasis': {'raw': 'Oasis', 'cc': 'CL', 'sv': 'FFA'}, 'snow': {'raw': 'Snow', 'cc': 'co', 'sv': 'FFA'}}
    out = salida(at, [{'id': 'c1', 'nombre': 'Canal 1'}, {'id': 'c2', 'nombre': 'Canal 2'}], gente, '2026-11-24T12:00:00-05:00')
    o = next((x for x in out['g'] if x['k'] == 'oasis'), {})
    casos.append(('la salida: la forma de global.json, con el otro y el título limpio',
                  out['cs'] == ['Canal 1', 'Canal 2'] and o.get('cc') == 'cl' and o.get('n') == 'Oasis'
                  and o.get('vs') == [['v1', 0, ['snow'], 'OASIS LE RESPONDE A SNOW']]))
    # 🤝 los que no nombran a nadie, a nombre de su servidor: sólo de un socio confirmado (CH ya no lo es)
    sh2 = sh + [['v10', 'QUÉ NOCHE EN LA FINAL', 'FFA', 'c1'], ['v11', 'LO MEJOR DE LA SEMANA', 'CH', 'c2']]
    o2 = salida(at, [{'id': 'c1', 'nombre': 'Canal 1'}, {'id': 'c2', 'nombre': 'Canal 2'}], gente, '2026-11-24T12:00:00-05:00',
                sh2, {'FFA': 'Free for All', 'FVS': 'Freestyle Versus'})
    s2 = {x[0]: x for x in o2.get('s') or []}
    casos.append(('los que no nombran a nadie van a nombre de su servidor (confirmado), sin repetir los atados',
                  'v10' in s2 and s2['v10'][2] == 'FFA' and 'v11' not in s2 and 'v1' not in s2
                  and o2.get('svn', {}).get('FFA') == 'Free for All'))
    viejo = {'visto': (_ahora_et() - dt.timedelta(days=1)).isoformat()}
    casos.append(('una vez por día: ayer toca, hoy no', toca(viejo) and not toca({'visto': _ahora_et().isoformat()})))
    for que, ok in casos:
        mal += not ok
        print('   %s %s' % ('✅' if ok else '🔴', que))
    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        sys.exit(_self_check())
    sys.exit(correr(aplicar='--aplicar' in sys.argv, red='--sin-red' not in sys.argv, ya='--ya' in sys.argv))
