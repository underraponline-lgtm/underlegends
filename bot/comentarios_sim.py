"""Los comentarios simulados de Publicaciones (12/11/2026).

🔑 Dlx, a la maqueta de los comentarios: «Sí, constrúyelo». Debajo de cada publicación del muro salen de 0 a 3
comentarios cortos para que no se vea vacío y la gente se anime a contestar. Los arma el ciclo, acá, con frases
armadas y los datos de cada publicación —nunca una IA que escribe lo que quiera—, y viajan adentro del muro
(`cm` de cada publicación, `bot/muro.py`).

⚠️ CON LA CARA DE ALGUIEN REAL SÓLO SEGÚN SU PERMISO (`cm:permisos` en KV, lo deja `espejarPermisos()` de
bot/avisos.js). Dlx le pregunta a cada uno y lo marca en su Dashboard; la persona lo apaga en Mi cuenta:

    «si»          su cara y su nombre, sin etiqueta
    sin preguntar con la etiqueta «simulado», pegada al nombre
    «no»          no aparece nunca

Y no aparecen nunca: quien ocultó su foto, el dueño de la publicación, quien jugó ese evento (nada contra quien le
ganó ese día) ni nadie más de dos veces el mismo día. Las frases son picantes pero de joda: ni insultos, ni la vida
privada de nadie.

⚠️ DETERMINISTA: la misma publicación da los mismos comentarios en cada corrida (la semilla es su `id`), así el
muro no cambia solo y no gasta escrituras de KV. Los que tienen la hora en el futuro los esconde la página hasta
que llega.

    python bot/comentarios_sim.py     el self-check
"""
import datetime as dt
import hashlib
import io
import json
import os
import random

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)

#: la copia de los permisos para correr sin red. ⚠️ GITIGNOREADA, como la de las fotos ocultas: quién dijo que no es
#: un dato de esa persona y no va al repo
COPIA = os.path.join(BASE, 'comun', 'fotos', 'cm_permisos.json')
CLAVE_KV = 'cm:permisos'

#: los personajes de la Liga (llevan la pastilla «Liga»): clave, nombre
PERSONAJES = [('eh', 'El Hype'), ('ul', 'ULAYA'), ('ej', 'El Jurado')]
#: cuántos comentarios como mucho por publicación, según qué es
CUANTOS = {'campeon': (2, 3), 'ligahito': (1, 3), 'caza': (1, 2), 'rango': (1, 2), 'pase': (0, 2), 'elegido': (1, 2),
           'premios': (1, 3), 'resnoche': (1, 2), 'anuncio': (1, 2), 'sobrevivio': (1, 2), 'mesaward': (1, 3)}
#: ⚠️ las cartas nuevas no: van en un grupo de a muchas y no llevan hilo en la página
#: en cuáles comenta también un personaje
CON_PERSONAJE = {'campeon', 'anuncio', 'resnoche', 'premios', 'caza', 'mesaward'}
#: cuántas veces puede aparecer la misma persona el mismo día
POR_DIA = 2
#: quién cuenta como activo: jugó en los últimos días
ACTIVO_DIAS = 14

# ── las frases ───────────────────────────────────────────────────────────
# {q} el dueño de la publicación, {ev} el evento, {a} el cazado, {rg} el rango, {ln} la liga, {n} un número
GENTE = {
    'campeon': ['esa final estuvo pesadísima 🔥', '{q} vino con todo hoy', 'lo vi venir desde octavos',
                'la próxima {ev} los quiero ver contra nosotros 👀', 'qué nivel, felicidades {q}',
                'se lo merecía, venía entrenando fuerte', 'ese cierre en la final no lo vi venir',
                'nadie frena a {q} esta semana', 'me perdí la final, ¿alguien la grabó?', 'a esto le decimos nivel'],
    'ligahito': ['{q} se adueñó de {ln}', 'merecidísimo, la liga entera lo vio venir', 'qué temporada de {q} 🔥',
                 'el que quiera la corona de {ln} que la venga a buscar'],
    'caza': ['cazar a {a} no es para cualquiera', 'eso fue una cacería 🎯', '{a} va a querer revancha',
             'buen botín, {q}', 'la próxima cabeza grande es la tuya, ojo'],
    'rango': ['merecido, venía subiendo hace rato', 'rango {rg} y va por más', 'se nota el cambio, felicidades',
              'ahora a cuidar esa letra', 'subiendo como espuma 📈'],
    'pase': ['nivel {n} ya, qué ritmo', 'el Pase no se completa solo, bien ahí', 'voy atrás tuyo, espérame'],
    'elegido': ['la gente habló', 'buena elección, a ver si sobrevive 👀', 'esto se pone bueno'],
    'premios': ['bien merecido lo de {q}', 'semana de {q}, nadie discute', 'a ver quién se lo lleva la que viene'],
    'resnoche': ['qué noche, {n} eventos', 'me quedé con ganas de más', 'la de anoche estuvo buenísima'],
    'anuncio': ['me anoto', '¿alguien arma equipo conmigo?', 'ahí estaré', 'esta no me la pierdo',
                '¿a qué hora arranca de verdad?', 'vamos con todo hoy'],
    'tarjeta': ['qué buena quedó esa carta', 'la carta te queda bien', 'ya era hora de esa carta'],
    'sobrevivio': ['sobrevivir al Most Wanted tiene mérito', 'nadie lo pudo cazar', 'escurridizo 👀'],
    'precio': ['buen precio el de esa cabeza', 'cobró como corresponde'],
    'mesaward': ['bien merecido', 'el mes fue de {q}', 'nadie discute este premio'],
}
LIGA = {
    'campeon': ['{q} suma otro título. ¿Quién la frena?', 'Felicita al campeón: le llega al teléfono.',
                'Ya está la llave completa de {ev}: tócala arriba.'],
    'anuncio': ['Recuerda activar la campana para que te avise cuando arranque.',
                'Los que juegan esta suben puntos para la Temporada.', '¿Quién se anota primero?'],
    'resnoche': ['Noche movida en la Liga. Hoy hay más.', 'Los resultados ya están en el Ranking.'],
    'premios': ['Los premios de la semana ya están en el Salón.', 'La semana que viene, ¿quién?'],
    'caza': ['Cabeza cobrada. El Most Wanted se mueve.', 'Ojo: los buscados cambian cada semana.'],
    'mesaward': ['Los MES AWARDS se votan en la página.', 'Ya está en el Salón de la fama.'],
}


def _norm(s):
    import unicodedata
    s = unicodedata.normalize('NFKD', str(s or ''))
    return ''.join(c for c in s if c.isalnum()).lower()


def _de_iso(s):
    try:
        return dt.datetime.fromisoformat(str(s).replace('Z', '+00:00'))
    except (TypeError, ValueError):
        return None


def _iso(t):
    return t.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def permisos(s=None):
    """`{'si': set(claves), 'no': set(claves)}`. Con `s` (una sesión de Cloudflare) se lee KV y se guarda la copia; sin
    `s`, la copia. ⚠️ SIN COPIA Y SIN KV, NADIE: todos «sin preguntar», o sea con la etiqueta. Es lo seguro."""
    d = None
    if s is not None:
        try:
            import subir_datos as SD
            r = s.get('%s/values/%s' % (SD.API, CLAVE_KV), timeout=30)
            if r.status_code == 404:
                d = {}
            elif r.status_code == 200:
                d = r.json() or {}
            if d is not None:
                os.makedirs(os.path.dirname(COPIA), exist_ok=True)
                with io.open(COPIA, 'w', encoding='utf-8') as f:
                    json.dump({'si': sorted(d.get('si') or []), 'no': sorted(d.get('no') or [])}, f)
        except Exception:                                # noqa: BLE001
            d = None
    if d is None:
        try:
            with io.open(COPIA, encoding='utf-8') as f:
                d = json.load(f) or {}
        except (OSError, ValueError):
            d = {}
    return {'si': {str(k) for k in d.get('si') or []}, 'no': {str(k) for k in d.get('no') or []}}


def _participantes(llaves):
    """`{número de llave: {nombres normalizados}}`: quien jugó cada evento."""
    out = {}
    for num, ll in (llaves or {}).items():
        ns = set()
        for r in (ll or {}).get('rondas') or []:
            for b in r.get('b') or []:
                for n in (b[0] if b and isinstance(b[0], list) else []):
                    ns.add(_norm(n))
        try:
            out[int(num)] = ns
        except (TypeError, ValueError):
            pass
    return out


def _quien_a(x):
    q = [str(n) for n in (x.get('quien') or [])]
    if x.get('tipo') == 'premios' and x.get('figura'):
        q = [str(x['figura'][0])]
    return q


def _relleno(x):
    q = _quien_a(x)
    n = x.get('nivel') or x.get('eventos') or x.get('votos') or ''
    return {'q': (q[0] if q else '').strip(), 'ev': str(x.get('ev') or '').strip(), 'a': str(x.get('a') or '').strip(),
            'rg': str(x.get('rg') or ''), 'ln': str(x.get('ln') or 'la liga'), 'n': str(n)}


def _frase(lista, x, rng, usadas):
    r = _relleno(x)
    ok = []
    for f in lista:
        # una frase que pide un dato que esta publicación no tiene no sale
        if any('{%s}' % c in f and not r[c] for c in r):
            continue
        if f in usadas:
            continue
        ok.append(f)
    if not ok:
        return ''
    f = rng.choice(ok)
    usadas.add(f)
    return f.format(**r)


def poner(items, tabla, perm=None, ahora=None, llaves=None, ocultas=None):
    """Le pone a cada publicación sus comentarios simulados (`cm`): `[[i, clave, nombre, texto, hora, etiqueta]]`, con
    la etiqueta `''` (dijo que sí), `'s'` (simulado: sin preguntar) o `'l'` (personaje de la Liga). Devuelve la lista
    nueva; no toca la de entrada."""
    perm = perm or {'si': set(), 'no': set()}
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    ocultas = {_norm(n) for n in (ocultas or [])}
    jugaron = _participantes(llaves)
    gente = [f for f in tabla or [] if f.get('k') and f.get('av') and f.get('ult') and f['k'] not in perm['no']
             and _norm(f.get('n')) not in ocultas]
    por_dia = {}
    out = []
    # de la más vieja a la más nueva, así el tope por día no cambia cuando entra una publicación nueva
    orden = sorted(range(len(items)), key=lambda i: str(items[i].get('t') or ''))
    nuevos = {}
    for i in orden:
        x = items[i]
        tipo = x.get('tipo')
        t0 = _de_iso(x.get('t'))
        if tipo not in CUANTOS or not t0 or not x.get('id'):
            continue
        rng = random.Random(int(hashlib.sha256(('cm:' + x['id']).encode()).hexdigest()[:12], 16))
        lo, hi = CUANTOS[tipo]
        cuantos = rng.randint(lo, hi)
        if not cuantos:
            continue
        fuera = {k for k in (x.get('ks') or []) if isinstance(x.get('ks'), list) and k}
        if isinstance(x.get('ks'), dict):
            fuera |= set(x['ks'].values())
        nombres_fuera = {_norm(n) for n in _quien_a(x)} | {_norm(n) for n in x.get('podio') or []}
        if x.get('ll') in jugaron:
            nombres_fuera |= jugaron[x['ll']]
        if x.get('a'):
            nombres_fuera.add(_norm(x['a']))
        dia = t0.strftime('%Y-%m-%d')
        # ⚠️ ACTIVO CONTRA LA FECHA DE LA PUBLICACIÓN, no contra hoy: contra hoy, los comentarios de una publicación
        # vieja cambiarían de un día para el otro. `ult` sólo avanza, así que quien entró no sale
        desde = (t0 - dt.timedelta(days=ACTIVO_DIAS)).strftime('%Y-%m-%d')
        cands = [f for f in gente if str(f['ult'][0]) >= desde and f['k'] not in fuera
                 and _norm(f.get('n')) not in nombres_fuera and por_dia.get((dia, f['k']), 0) < POR_DIA]
        # 🎯 primero los de su mismo servidor, y los que más juegan
        sv = x.get('sv')
        pesos = [(3 if sv and f.get('sv') == sv else 1) * (1 + min(int(f.get('ev') or 0), 60) / 20) for f in cands]
        cms, usadas = [], set()
        personaje = tipo in CON_PERSONAJE and rng.random() < 0.4
        t = t0
        for j in range(cuantos):
            t = t + dt.timedelta(minutes=rng.randint(12, 90) if j == 0 else rng.randint(30, 300))
            if personaje and j == cuantos - 1:
                pk, pn = PERSONAJES[rng.randrange(len(PERSONAJES))]
                tx = _frase(LIGA.get(tipo) or [], x, rng, usadas)
                if tx:
                    cms.append([j, pk, pn, tx, _iso(t), 'l'])
                continue
            if not cands:
                break
            f = rng.choices(cands, weights=pesos, k=1)[0]
            ix = cands.index(f)
            cands.pop(ix)
            pesos.pop(ix)
            tx = _frase(GENTE.get(tipo) or [], x, rng, usadas)
            if not tx:
                continue
            por_dia[(dia, f['k'])] = por_dia.get((dia, f['k']), 0) + 1
            cms.append([j, f['k'], f['n'], tx, _iso(t), '' if f['k'] in perm['si'] else 's'])
        if cms:
            nuevos[i] = [[n] + c[1:] for n, c in enumerate(cms)]
    for i, x in enumerate(items):
        if i in nuevos:
            y = dict(x)
            y['cm'] = nuevos[i]
            out.append(y)
        else:
            out.append(x)
    return out


# ── self-check ───────────────────────────────────────────────────────────
def _self_check():
    print('\n══ LOS COMENTARIOS SIMULADOS ══\n')
    fallas = 0

    def ok(c, m):
        nonlocal fallas
        print(('   ✓ ' if c else '   🔴 ') + m)
        fallas += 0 if c else 1

    ahora = dt.datetime(2026, 11, 12, 12, tzinfo=dt.timezone.utc)
    tabla = [{'n': n, 'k': n.lower(), 'av': '1/a', 'sv': 'FFA' if i % 2 else 'DDF', 'ev': 10 + i,
              'ult': ['2026-11-10', 'Octavos']} for i, n in enumerate(
        ['Oasis', 'Makmah', 'Snow', 'Panchok', 'Erian', 'Verc', 'Tam', 'Kminant', 'Agus', 'Vandu'])]
    tabla.append({'n': 'Viejo', 'k': 'viejo', 'av': '1/a', 'sv': 'FFA', 'ev': 50, 'ult': ['2026-09-01', 'Final']})
    tabla.append({'n': 'SinFoto', 'k': 'sinfoto', 'av': '', 'sv': 'FFA', 'ev': 50, 'ult': ['2026-11-11', 'Final']})
    items = [{'tipo': 'campeon', 'id': '%012x' % i, 't': '2026-11-%02dT04:00:00Z' % (2 + i % 9), 'quien': ['Tam'],
              'ks': ['tam'], 'ev': 'COPA %d' % i, 'sv': 'FFA', 'll': 900 + i} for i in range(30)]
    items += [{'tipo': 'anuncio', 'id': 'a%011x' % i, 't': '2026-11-11T20:00:00Z', 'ev': 'VOL %d' % i, 'sv': 'FFA'}
              for i in range(5)]
    llaves = {str(900 + i): {'rondas': [{'b': [[['Tam', 'Kminant'], 'Tam', '']]}]} for i in range(30)}
    perm = {'si': {'oasis'}, 'no': {'makmah'}}
    a = poner(items, tabla, perm, ahora, llaves, ocultas=['Agus'])
    b = poner(items, tabla, perm, ahora, llaves, ocultas=['Agus'])
    ok(a == b, 'la misma entrada da los mismos comentarios (el muro no cambia solo)')
    cms = [c for x in a for c in x.get('cm') or []]
    ok(len(cms) > 30, 'salen comentarios (%d en %d publicaciones)' % (len(cms), len(items)))
    ok(all(c[1] != 'makmah' for c in cms), 'quien dijo que no no aparece nunca')
    ok(all(c[1] != 'agus' for c in cms), 'quien ocultó su foto no aparece')
    ok(all(c[1] not in ('viejo', 'sinfoto') for c in cms), 'ni quien no juega hace semanas ni quien no tiene foto')
    ok(all(c[1] not in ('tam', 'kminant') for x in a if x['tipo'] == 'campeon' for c in x.get('cm') or []),
       'ni el dueño ni quien jugó ese evento')
    ok(all((c[5] == '') == (c[1] == 'oasis') for c in cms if c[5] != 'l'), 'sin etiqueta sólo quien dijo que sí')
    ok(all(c[5] == 's' for c in cms if c[5] != 'l' and c[1] != 'oasis'), 'los demás llevan «simulado»')
    ok(any(c[5] == 'l' for c in cms), 'y comentan los personajes de la Liga')
    cuenta = {}
    for x in a:
        for c in x.get('cm') or []:
            if c[5] != 'l':
                k = (x['t'][:10], c[1])
                cuenta[k] = cuenta.get(k, 0) + 1
    ok(max(cuenta.values()) <= POR_DIA, 'nadie más de %d veces por día' % POR_DIA)
    ok(all('{' not in c[3] for c in cms), 'ninguna frase queda con un hueco sin llenar')
    ok(all(x.get('cm') is None for x in items), 'no toca la lista de entrada')
    sin = poner(items, tabla, None, ahora, llaves)
    ok(all(c[5] in ('s', 'l') for x in sin for c in x.get('cm') or []),
       'sin permisos (sin red y sin copia), todos con la etiqueta')
    print('\n%s\n' % ('✅ todo bien' if not fallas else '🔴 %d fallas' % fallas))
    return fallas


if __name__ == '__main__':
    import sys
    sys.exit(1 if _self_check() else 0)
