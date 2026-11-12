"""🔎 LA VERIFICACIÓN DE LLAVES: lo que un organizador podría falsificar, y qué se ve en «Ver llave».

🔑 Dlx, 11/11/2026: *«necesitamos agregar un sistema de verificación a lo que es las llaves, debido a que cualquier
organizador también puede falsificar cosas»*, por DDF: Adriagner publicó la #605 a las 12:09 AM ET, la completó a las
12:15 (siete batallas en seis minutos), salió campeón, y a la 1:06 PM la volvió a publicar con un nombre cambiado (#607).
A las ideas: *«me gustan todas, exceptuando la 3»* (la confirmación del que perdió), y *«2. depende del nivel de confianza
del organizador y su tier de peligro»*.

Lo que había antes protegía de OTRA cosa: `llave_de_broma()` retiene a quien NO es organizador, y desde la R5 (13/10)
quien tiene rol en su servidor pasa directo. Esto cubre al organizador.

📏 MEDIDO SOBRE LAS 246 LLAVES DE LA T1 (11/11/2026, las del ranking más las tres falsas):

| señal | llaves | qué son |
|---|---|---|
| el organizador gana su propia llave | 3 | justo las falsas (#567, #605, #607), **ninguna más** |
| copia de otra (misma final, ≥60 % de la misma gente, ±2 días) | 4 | la #607 y tres de FFA contadas dos veces |
| el organizador juega sin ganar | 14 | casi todas de Artezzy en FDS y de Okam en FFA: normal |
| menos de 1 minuto por batalla | 15 | llaves que se publican completas al terminar: normal |

Por eso **retienen sólo las dos fuertes** —y la de un organizador OBSERVADO (una trampa confirmada) que juega su llave—
y las débiles se MUESTRAN en «Ver llave» sin frenar nada (Dlx, a la propuesta: «construye la verificación de llaves»).

⚠️ LA CONFIANZA BAJA CON UNA TRAMPA CONFIRMADA, NO SUBE CON LA CANTIDAD: Adriagner llevaba 8 llaves cuando hizo la #567
y 11 cuando hizo la #605. Los observados están en `datos/organizadores_observados.json`, por huella (no la cuenta), y
se agregan a mano cuando Dlx saca una llave por falsa.

⚠️ «SIN ANUNCIO» Y «LA LLAMADA» NO RETIENEN: no se pueden medir hacia atrás (los anuncios viejos se borran de
`datos/anuncios.json` y la llamada dura 14 días), así que no hay con qué fijar un umbral. Se muestran.
"""
import datetime as dt
import io
import json
import os
import re
import sys
import unicodedata

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)

#: la llave copiada: cuánto de la misma gente tiene que tener (con la misma final) y en cuántos días
COPIA_GENTE = .6
COPIA_DIAS = 2
#: o, sin la misma final, cuánto de las mismas batallas y cuántas como mínimo
COPIA_BATALLAS = .6
COPIA_MIN_BATALLAS = 3
#: de acá en adelante el organizador observado no puede sumar una llave suya en la que juega sin que Dlx la mire
OBSERVADOS = os.path.join(BASE, 'datos', 'organizadores_observados.json')
#: lo que ve «Ver llave» de cada llave procesada; `sheet/llaves_web.py` lo cuelga de su evento como `ver`
SALIDA = os.path.join(BASE, 'datos', 'verificacion_llaves.json')


def norm(s):
    """Para comparar nombres: sin paréntesis, emojis, banderas ni mayúsculas."""
    s = unicodedata.normalize('NFKD', re.sub(r'\(.*?\)', '', str(s or '')))
    return ''.join(c for c in s.lower() if c.isalnum() and ord(c) < 0x2000)


def _miembros(lado):
    return {norm(x) for x in re.split(r',|\+|&|/', str(lado or '')) if norm(x)}


def campeon(filas):
    """Los nombres (normalizados) del lado que ganó la final, o un set vacío si la llave no la dice."""
    for f in filas or []:
        if str(f.get('ronda') or '').lower() == 'final' and f.get('ganador'):
            return _miembros(f['ganador'])
    return set()


def final_de(filas):
    for f in filas or []:
        if str(f.get('ronda') or '').lower() == 'final' and f.get('ladoA') and f.get('ladoB'):
            return tuple(sorted((norm(f['ladoA']), norm(f['ladoB']))))
    return None


def gente(filas):
    return {m for f in filas or [] for lado in (f.get('ladoA'), f.get('ladoB')) for m in _miembros(lado)}


def batallas(filas):
    return {tuple(sorted((norm(f.get('ladoA')), norm(f.get('ladoB'))))) for f in filas or []
            if f.get('ladoA') and f.get('ladoB')}


_PAD = []


def nombres_de(did):
    """Los nombres del padrón de una cuenta de Discord, normalizados."""
    if not _PAD:
        try:
            with io.open(os.path.join(BASE, 'datos', 'padron.json'), encoding='utf-8') as f:
                pad = json.load(f) or []
        except (OSError, ValueError):
            pad = []
        idx = {}
        for p in pad:
            if p.get('discord_id'):
                for k in ('raw', 'full'):
                    if norm(p.get(k)):
                        idx.setdefault(str(p['discord_id']), set()).add(norm(p[k]))
        _PAD.append(idx)
    return _PAD[0].get(str(did or ''), set())


def autores(g):
    """`[(cuenta, usuario)]` de quien publicó los mensajes de la llave (sin bots)."""
    vistos, out = set(), []
    for h in g.get('llaves') or []:
        did = str(h.get('autor_id') or '')
        if did and did not in vistos and not h.get('bot'):
            vistos.add(did)
            out.append((did, str(h.get('autor') or '')))
    return out


def organizador(g, filas):
    """'gana' si quien publicó la llave es el campeón, 'juega' si está en la llave, '' si no."""
    camp, todos = campeon(filas), gente(filas)
    est = ''
    for did, usuario in autores(g):
        suyos = nombres_de(did) | ({norm(usuario)} if norm(usuario) else set())
        if suyos & camp:
            return 'gana'
        if suyos & todos:
            est = 'juega'
    return est


def _ms(iso):
    try:
        t = dt.datetime.fromisoformat(str(iso).replace('Z', '+00:00'))
    except ValueError:
        return None
    if t.tzinfo is None:
        t = t.replace(tzinfo=dt.timezone.utc)
    return int(t.timestamp() * 1000)


def minutos(g):
    """De la primera publicación al último cambio, en minutos. `None` si no se sabe."""
    ts = [x for h in g.get('llaves') or [] for x in (_ms(h.get('cuando')), _ms(h.get('editado'))) if x]
    t0 = min((_ms(h.get('cuando')) for h in g.get('llaves') or [] if _ms(h.get('cuando'))), default=None)
    return round((max(ts) - t0) / 60000) if ts and t0 else None


def _ms_link(link):
    try:
        return (int(str(link).rstrip('/').split('/')[-1]) >> 22) + 1420070400000
    except ValueError:
        return None


def previas(archivo=None):
    """Las llaves ya cargadas de `datos/llaves_t1.json`, como `{n: {sv, dia, final, gente, batallas, t}}`."""
    try:
        with io.open(archivo or os.path.join(BASE, 'datos', 'llaves_t1.json'), encoding='utf-8') as f:
            d = json.load(f) or {}
    except (OSError, ValueError):
        return {}
    out = {}
    for n, v in d.items():
        if not str(n).isdigit() or not isinstance(v, dict):
            continue
        filas = [{'ronda': str(r.get('r') or '').lower(), 'ladoA': b[0][0], 'ladoB': b[0][1], 'ganador': b[1]}
                 for r in v.get('rondas') or [] for b in r.get('b') or []
                 if isinstance(b, list) and b and isinstance(b[0], list) and len(b[0]) == 2]
        if 'final' not in {f['ronda'] for f in filas} and filas:
            ult = (v.get('rondas') or [{}])[-1]
            if str(ult.get('r') or '').lower().startswith('final'):
                for f in filas[-len(ult.get('b') or []):]:
                    f['ronda'] = 'final'
        out[int(n)] = {'sv': v.get('sv'), 'dia': v.get('dia'), 'clave': (v.get('nombre'), v.get('sv'), v.get('fecha')),
                       'final': final_de(filas), 'gente': gente(filas), 'batallas': batallas(filas),
                       'msgs': {str(l).rstrip('/').split('/')[-1] for l in v.get('links') or []},
                       't': min([x for x in (_ms_link(l) for l in v.get('links') or []) if x] or [None],
                                key=lambda x: x or 9e18)}
    return out


def _dia(iso):
    try:
        return dt.date.fromisoformat(str(iso)[:10])
    except ValueError:
        return None


def copia_de(filas, sv, dia, t0, clave, prev, msgs=()):
    """El número de la llave ya cargada de la que ésta es copia, o `None`.

    Copia = mismo servidor, ±`COPIA_DIAS` días, publicada ANTES que ésta, y con la misma final y al menos `COPIA_GENTE`
    de la misma gente —la #607 era la #605 con un nombre cambiado— o con `COPIA_BATALLAS` de las mismas batallas.

    ⚠️ QUÉ ES «LA MISMA LLAVE» LO DICEN LOS MENSAJES, NO EL NOMBRE. El ciclo relee cada llave varias veces y no es copia de
    sí misma; pero la #534 y la #480 tenían el MISMO nombre y la misma fecha y eran dos cargas del mismo evento, de dos
    mensajes distintos. Y por nombre, un espacio de más haría que una llave releída se tomara por copia de sí misma —y se
    retuvieran todas—. Si comparten un mensaje de Discord, es la misma; si no trae mensajes, se compara la clave."""
    fin, gen, bat = final_de(filas), gente(filas), batallas(filas)
    d0 = _dia(dia)
    for n, p in sorted((prev or {}).items(), key=lambda x: (isinstance(x[0], str), str(x[0]))):
        if (set(msgs) & p.get('msgs', set())) or ((not msgs or not p.get('msgs')) and p['clave'] == clave):
            continue
        if p['sv'] != sv or not d0 or not _dia(p['dia']):
            continue
        if abs((_dia(p['dia']) - d0).days) > COPIA_DIAS:
            continue
        if t0 and p['t'] and p['t'] >= t0:
            continue
        if fin and fin == p['final'] and gen and p['gente'] and len(gen & p['gente']) / len(gen | p['gente']) >= COPIA_GENTE:
            return n
        if bat and p['batallas']:
            comun = len(bat & p['batallas'])
            if comun >= COPIA_MIN_BATALLAS and comun / len(bat | p['batallas']) >= COPIA_BATALLAS:
                return n
    return None


def observados():
    try:
        with io.open(OBSERVADOS, encoding='utf-8') as f:
            return set((json.load(f) or {}).get('huellas') or [])
    except (OSError, ValueError):
        return set()


def huella_de(did):
    sys.path.insert(0, SCR)
    import anuncios as AN
    return AN.huella_cuenta(str(did))


def revisar(g, filas, nom, sv, fec, dia, prev=None, obs=None):
    """`(motivo para retener o None, lo que ve «Ver llave»)`.

    Retiene: el organizador gana su propia llave; es copia de otra ya cargada; o la publica un organizador observado y
    juega en ella. Lo demás sólo se muestra."""
    org = organizador(g, filas)
    t0 = min([x for x in (_ms(h.get('cuando')) for h in g.get('llaves') or []) if x] or [None], key=lambda x: x or 9e18)
    msgs = {str(h.get('msg_id')) for h in g.get('llaves') or [] if h.get('msg_id')}
    cop = copia_de(filas, sv, dia, t0, (nom, sv, fec), prev if prev is not None else previas(), msgs)
    obs = observados() if obs is None else obs
    obsv = any(huella_de(did) in obs for did, _ in autores(g))
    mins = minutos(g)
    # `v`: está verificada (aunque todo dé limpio, la franja de «Ver llave» sale); `obs` NO se muestra en la página
    ver = {'v': 1, **{k: v for k, v in (('min', mins), ('org', org), ('copia', cop), ('obs', 1 if obsv else 0)) if v is not None and v != '' and v != 0}}
    quien = ', '.join(u or did for did, u in autores(g)) or 'quien la publicó'
    if org == 'gana':
        return ('la publicó %s y sale campeón de su propia llave%s. Es lo que tenían las tres falsas de la T1 (#567, #605, '
                '#607) y ninguna otra. Si se jugó de verdad, «Sí cuenta»'
                % (quien, ' (completa %d min después de publicarla)' % mins if mins is not None else '')), ver
    if cop:
        return ('es casi la misma llave que %s (misma final o las mismas batallas, %s): parece la misma cargada dos '
                'veces. Si es otro evento, «Sí cuenta»' % ('la #%d' % cop if isinstance(cop, int) else '«%s», de esta misma corrida' % cop, sv)), ver
    if obsv and org:
        return ('la publicó %s, que tiene una llave sacada por falsa, y juega en ésta. Si se jugó de verdad, «Sí cuenta»'
                % quien), ver
    return None, ver


def sumar(prev, clave, filas, sv, dia, g):
    """Suma a `prev` una llave de ESTA corrida que entró, para que la siguiente del mismo lote se compare con ella: si la
    #605 y la #607 llegaran en la misma vuelta, ninguna de las dos estaría todavía en `datos/llaves_t1.json`."""
    prev[clave[0]] = {'sv': sv, 'dia': dia, 'clave': clave, 'final': final_de(filas), 'gente': gente(filas),
                      'batallas': batallas(filas), 'msgs': {str(h.get('msg_id')) for h in g.get('llaves') or [] if h.get('msg_id')},
                      't': min([x for x in (_ms(h.get('cuando')) for h in g.get('llaves') or []) if x] or [None],
                               key=lambda x: x or 9e18)}


def guardar(ver_por_clave, archivo=SALIDA):
    """Suma lo de esta corrida a `datos/verificacion_llaves.json` (`evento|servidor|fecha` -> `ver`)."""
    try:
        with io.open(archivo, encoding='utf-8') as f:
            d = json.load(f) or {}
    except (OSError, ValueError):
        d = {}
    d.setdefault('_leeme', 'Lo que ve «Ver llave» de cada llave procesada (bot/verificar_llaves.py): min = de la primera '
                           'publicación al último cambio; org = el organizador «juega» o «gana»; copia = la llave de la que '
                           'es copia; obs = la publicó un organizador observado. Lo cuelga sheet/llaves_web.py como «ver».')
    ev = d.setdefault('eventos', {})
    antes = json.dumps(ev, sort_keys=True, ensure_ascii=False)
    ev.update(ver_por_clave)
    if json.dumps(ev, sort_keys=True, ensure_ascii=False) != antes or not os.path.exists(archivo):
        with io.open(archivo, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(d, f, ensure_ascii=False, indent=1, sort_keys=True)
            f.write('\n')


def leer(archivo=SALIDA):
    try:
        with io.open(archivo, encoding='utf-8') as f:
            return (json.load(f) or {}).get('eventos') or {}
    except (OSError, ValueError):
        return {}


# ── self-check ───────────────────────────────────────────────────────────
def _self_check():
    mal = []

    def ok(c, que):
        print('  %s %s' % ('✅' if c else '❌', que))
        if not c:
            mal.append(que)

    _PAD[:] = [{'1316490165836972104': {'adriagner'}, '9': {'teito'}}]
    F = lambda a, b, g, r='cuartos': {'ronda': r, 'ladoA': a, 'ladoB': b, 'ganador': g}
    llave605 = [F('Adriagner🇳🇮', 'Tormen🇳🇮', 'Adriagner🇳🇮'), F('Teito', 'Sourlate🇳🇮', 'Sourlate🇳🇮'),
                F('Evangeline🇧🇴', 'Miniboy🇨🇱', 'Miniboy🇨🇱'), F('Goblin🇳🇮', 'CJ🇨🇴', 'Goblin🇳🇮'),
                F('Adriagner', 'Sourlate', 'Adriagner', 'semifinales'), F('Goblin', 'Miniboy', 'Goblin', 'semifinales'),
                F('Adriagner', 'Goblin', 'Adriagner', 'final')]
    g = {'llaves': [{'autor_id': '1316490165836972104', 'autor': 'adriagner', 'msg_id': '605', 'cuando': '2026-11-11T05:09:00+00:00',
                     'editado': '2026-11-11T05:15:00+00:00'}]}
    m, v = revisar(g, llave605, 'EL ULTIMO DIA DE DDF', 'DDF', '11/11', '2026-11-11', prev={}, obs=set())
    ok(m and 'campeón de su propia llave' in m and v.get('org') == 'gana' and v.get('min') == 6,
       'el organizador que gana su propia llave se retiene (la #605: seis minutos)')
    # la #607: la misma llave, con Sourlate cambiado por Mitosis, publicada después
    prev = {605: {'sv': 'DDF', 'dia': '2026-11-11', 'clave': ('EL ULTIMO DIA DE DDF', 'DDF', '11/11'),
                  'final': final_de(llave605), 'gente': gente(llave605), 'batallas': batallas(llave605),
                  'msgs': {'605'}, 't': _ms('2026-11-11T05:09:00+00:00')}}
    l607 = [dict(f, ladoA=f['ladoA'].replace('Sourlate🇳🇮', 'Mitosis').replace('Sourlate', 'Mitosis'),
                 ladoB=f['ladoB'].replace('Sourlate🇳🇮', 'Mitosis').replace('Sourlate', 'Mitosis'),
                 ganador=f['ganador'].replace('Sourlate🇳🇮', 'Mitosis')) for f in llave605]
    g7 = {'llaves': [{'autor_id': '55', 'autor': 'otro', 'msg_id': '607', 'cuando': '2026-11-11T18:06:00+00:00'}]}
    m7, v7 = revisar(g7, l607, 'EL ULTIMO DDF', 'DDF', '11/11', '2026-11-11', prev=prev, obs=set())
    ok(m7 and 'la #605' in m7 and v7.get('copia') == 605, 'la copia de otra llave ya cargada se retiene (la #607)')
    g5 = {'llaves': [{'autor_id': '55', 'autor': 'otro', 'msg_id': '605', 'cuando': '2026-11-11T05:09:00+00:00'}]}
    ok(revisar(g5, llave605, 'EL ULTIMO DIA DE DDF ', 'DDF', '11/11', '2026-11-11', prev=prev, obs=set())[0] is None,
       'la misma llave releída —el mismo mensaje— no es copia de sí misma, aunque el nombre cambie un espacio')
    g8 = {'llaves': [{'autor_id': '55', 'autor': 'otro', 'msg_id': '608', 'cuando': '2026-11-11T18:06:00+00:00'}]}
    ok(revisar(g8, llave605, 'EL ULTIMO DIA DE DDF', 'DDF', '11/11', '2026-11-11', prev=prev, obs=set())[1].get('copia') == 605,
       'y otro mensaje con el mismo nombre y la misma llave SÍ es copia (la #534 y la #480)')
    ok(revisar(g7, l607, 'EL ULTIMO DDF', 'FFA', '11/11', '2026-11-11', prev=prev, obs=set())[0] is None
       and revisar(g7, l607, 'EL ULTIMO DDF', 'DDF', '15/11', '2026-11-15', prev=prev, obs=set())[0] is None,
       'otro servidor u otra semana no es copia')
    gj = {'llaves': [{'autor_id': '9', 'autor': 'teito', 'cuando': '2026-11-11T05:09:00+00:00'}]}
    mj, vj = revisar(gj, llave605, 'X', 'DDF', '11/11', '2026-11-11', prev={}, obs=set())
    ok(mj is None and vj.get('org') == 'juega', 'el organizador que juega sin ganar NO se retiene: sólo se muestra')
    mo, _ = revisar(gj, llave605, 'X', 'DDF', '11/11', '2026-11-11', prev={}, obs={huella_de('9')})
    ok(mo and 'sacada por falsa' in mo, 'pero si es un organizador observado, sí')
    gn = {'llaves': [{'autor_id': '77', 'autor': 'nadie', 'cuando': '2026-11-11T05:09:00+00:00'}]}
    ok(revisar(gn, llave605, 'X', 'DDF', '11/11', '2026-11-11', prev={}, obs={huella_de('77')})[0] is None,
       'el observado que no juega su llave pasa')
    ok(organizador({'llaves': [{'autor_id': '1316490165836972104', 'autor': 'x'}]},
                   [F('Ana, Adriagner', 'Beto, Caro', 'Ana, Adriagner', 'final')]) == 'gana',
       'en una de equipos, ganar con su equipo también es ganar')
    ok(campeon([]) == set() and organizador(gn, []) == '', 'sin final no hay campeón ni nada que retener')
    _PAD[:] = []
    print('\n  %s' % ('todo ok' if not mal else '%d fallaron' % len(mal)))
    return not mal


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    sys.exit(0 if _self_check() else 1)
