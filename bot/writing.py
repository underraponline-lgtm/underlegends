# -*- coding: utf-8 -*-
"""✍️ EL WRITING CHALLENGE DE FFA: cada fecha, quién quedó dónde, y lo que eso paga en la Liga.

    python bot/writing.py            qué leyó de Discord y qué pagaría, sin escribir nada
    python bot/writing.py --aplicar  y lo deja en datos/writing.json (lo corre el ciclo, paso 2b0)
    python bot/writing.py --auto     el self-check, sin red ni archivos

Dlx, 14/10/2026: el FFA Writing Challenge *«cuenta para la Liga»*, con **puntos de Temporada y puntos de Tienda y
insignia y quizás misión de la semana también**.

QUÉ ES (relevado el 14/10/2026 leyendo el canal «✦✏️︱ffa-writing-challange» de FFA)
-------------------------------------------------------------------------------
Cada fecha el organizador publica «# ✍️ FFA WRITING CHALLENGE — FECHA N ✍️» con una imagen; la gente contesta con su
rima, firmada con su nombre y su bandera («Lvel 🇻🇪 | …»); el público vota con 🔥 y las rimas con ❌ *«no van a sumar
nada a la tabla»*. Al final sale un posteo de RESULTADOS:

    # FFA WRITING CHALLANGE
    > FECHA 2
    **1. *JAHNO "El MELOMANÍACO"  🇦🇷***`5 pts.`
    **2. *LVEL 🇻🇪***`4 pts.`

⚠️ EL PUESTO LO DICE EL POSTEO, NO LOS PUNTOS: en la Fecha 1 Lvel y Cinexfilo empatan en 3 y el organizador los puso
1.º y 2.º. Acá no se desempata nada.

LO QUE PAGA (los números, acá arriba: van con el rebalanceo del final, como `misiones.PUNTOS`)
- **Temporada**, por fecha: 1.º `PUNTOS[1]`, 2.º `PUNTOS[2]`, 3.º `PUNTOS[3]`, el resto de los que figuran `PARTICIPA`.
  Se suma como las misiones (`rankings.sumar_writing()`): una corrida atrás, y **NUNCA al Competitivo** ni como duelo.
- **Tienda**, por fecha: `TIENDA[1..3]` y `TIENDA_PARTICIPA`, por el camino de siempre: `precios.para_objeto()` lo
  lleva al Durable Object en `precios:resolucion` (`wr`), con una clave por fecha y persona, y el objeto lo REEMPLAZA
  entero en cada corrida (como el Most Wanted): releer el canal no paga dos veces.
- **Insignias** (`bot/insignias.py`): ✍️ Pluma de oro a quien gana una fecha; 🖋️ Pluma a quien participa en
  `PLUMA_FECHAS` o más.
- **Misión de la semana** (`bot/misiones.py`, `WRITING_DESDE`): «Participá del Writing Challenge», sólo las semanas en
  que se anuncia una fecha.

⚠️ CON 0 PUNTOS NO SE COBRA (`CERO_COBRA`): en las dos fechas medidas, los que quedaron en 0 son exactamente las rimas
con ❌ —Molusco en la 1, Mati Cerna y Perfume Chakal en la 2—, que el organizador anuló: *«no van a sumar nada»*. Se
guardan igual, como lo que son: participaron y no sumaron.

⚠️ UNA FECHA SE CUENTA UNA VEZ: la clave es su NÚMERO. «FECHA 1 REPRISE» repitió la 1 porque *«se borraron los
mensajes anteriores»*: si algún día aparecieran los resultados de las dos, gana el posteo más nuevo. Y un posteo
editado se vuelve a leer y reemplaza al guardado.

QUIÉN ES QUIÉN — LA IDENTIDAD NO SE ADIVINA
- El nombre del posteo se busca como en el resto de la Liga: la Lista (`datos/padron.json`, que el paso 2 acaba de
  refrescar), los AKAs (`rankings.canon()`, la cadena entera) y, si no está ahí, el pool de la Temporada. Con dos
  personas del mismo nombre, decide la bandera; si no alcanza, no se elige.
- Y su rima: el mensaje del canal firmado con ese nombre (o cuya cuenta se llama así). Su CUENTA confirma: si el
  nombre da una persona y la cuenta otra, es un CHOQUE y no se paga nada hasta que alguien lo mire.
- Si el nombre no está en ningún lado, la cuenta resuelve SÓLO si se llama como el nombre del posteo. Un seudónimo
  («Perfume Chakal», publicado desde la cuenta de Cronox) queda como está escrito y se informa: puede ser un AKA, pero
  eso lo dice Dlx.
- Lo que queda sin resolver se guarda tal cual (`sin_resolver`) y se vuelve a intentar en cada corrida: el día que
  entra el AKA, se paga.

⚠️ SIN LOS MENSAJES: el repo es público. Se guarda cada fecha —quién, qué puesto, qué bandera, de qué cuenta y de qué
mensajes sale—, nunca la rima.

⚠️ NO MIRA SÓLO LO LEÍDO HOY: las fechas guardadas quedan (el canal se lee de a `PAGINAS`), y si una relectura no
llega a ver la rima de alguien, se queda con lo que se había visto (`_juntar()`).
"""
import datetime as dt
import io
import json
import os
import re
import sys
import time
import unicodedata

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

SALIDA = os.path.join(BASE, 'datos', 'writing.json')

#: el canal «✦✏️︱ffa-writing-challange» de FFA (guild en `datos/servidores.json`)
SV = 'FFA'
CANAL = '1551050637280673792'
#: cuántas páginas de 100 se leen por corrida, y cuántas la primera vez (el canal entero tenía 28 mensajes el 14/10)
PAGINAS, PAGINAS_PRIMERA = 1, 5

# ── los números, todos acá ───────────────────────────────────────────────
#: puntos de Temporada por puesto; el resto de los que figuran en los resultados, `PARTICIPA`
PUNTOS = {1: 1000, 2: 600, 3: 400}
PARTICIPA = 150
#: Puntos de Tienda por puesto, y por participar
TIENDA = {1: 500, 2: 300, 3: 200}
TIENDA_PARTICIPA = 50
#: ¿cobra quien quedó con 0 puntos? No: son las rimas que el organizador anuló con ❌ (ver arriba)
CERO_COBRA = False
#: 🖋️ cuántas fechas (cobradas) hacen falta para la insignia «Pluma»
PLUMA_FECHAS = 3

#: el título de los dos posteos: «CHALLENGE» en el anuncio y «CHALLANGE» en los resultados
TITULO = re.compile(r'WRITING\s+CHALL[AE]NGE', re.I)
FECHA = re.compile(r'\bFECHA\s*#?\s*(\d{1,3})\b(\s*REPRISE)?', re.I)
BANDERA = re.compile('[\U0001F1E6-\U0001F1FF]{2}')
#: lo que no es nombre: emojis, el ZWJ y el selector de variación (🏳️‍⚧️ son cuatro), y los indicadores regionales
EMOJI = re.compile('[%s]' % ''.join('%s-%s' % (chr(a), chr(b)) if b else chr(a) for a, b in (
    (0x1F000, 0x1FAFF), (0x2600, 0x27BF), (0x2B00, 0x2BFF), (0x200D, 0), (0xFE0F, 0), (0x1F1E6, 0x1F1FF))))
CUSTOM = re.compile(r'<a?:\w+:\d+>')
#: los puntos de una fila: `5 pts.` adentro de un bloque de código, o al final de la línea
PTS_CODIGO = re.compile(r'`\s*(\d+(?:[.,]\d+)?)\s*pts?\.?\s*`', re.I)
PTS_FINAL = re.compile(r'(\d+(?:[.,]\d+)?)\s*pts?\.?\s*$', re.I)
FILA = re.compile(r'^\s*(\d{1,3})\s*[.)º°-]\s*(.+?)\s*$')


def _iso(t):
    return t.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def _de_iso(s):
    return dt.datetime.fromisoformat(str(s).replace('Z', '+00:00'))


def _nfkc(t):
    return unicodedata.normalize('NFKC', str(t or ''))


def _k(t):
    """Para comparar dos nombres: `comun.claves.clave()` sobre NFKC (la negrita matemática de una cuenta,
    «𝘾𝙍𝙊𝙉𝙊𝙓», es CRONOX), sin emojis propios ni banderas."""
    from comun.claves import clave
    t = EMOJI.sub(' ', CUSTOM.sub(' ', _nfkc(t)))
    k = clave(t) if t.strip() else ''
    return k if any(c.isalnum() for c in t) else ''


def banderas(t):
    """`['ar', 've']`: las banderas de país de un texto, en orden."""
    return [''.join(chr(ord(c) - 0x1F1E6 + 97) for c in b) for b in BANDERA.findall(str(t or ''))]


def limpio(t):
    """El nombre como se muestra: sin markdown, emojis ni banderas; las comillas del apodo se quedan."""
    t = EMOJI.sub(' ', CUSTOM.sub(' ', _nfkc(t)))
    t = re.sub(r'[*_~`|>]', ' ', t)
    return re.sub(r'\s+', ' ', t).strip(' .-:')


def candidatos(nombre):
    """Las formas de buscar un nombre: entero, sin el apodo entre comillas y el apodo solo (sin «El»/«La»).
    `JAHNO "El MELOMANÍACO"` -> `JAHNO "El MELOMANÍACO"`, `JAHNO`, `El MELOMANÍACO`, `MELOMANÍACO`."""
    n = limpio(nombre)
    out = [n]
    m = re.search(r'["“”«»](.+?)["“”«»]', n)
    if m:
        base = re.sub(r'\s+', ' ', n.replace(m.group(0), ' ')).strip()
        apodo = m.group(1).strip()
        out += [base, apodo, re.sub(r'^(?:el|la|los|las)\s+', '', apodo, flags=re.I)]
    return [x for i, x in enumerate(out) if x and x not in out[:i]]


# ── los dos posteos del organizador ──────────────────────────────────────
def filas(content):
    """`[(puesto, nombre, banderas, puntos)]` de un posteo de resultados, en el orden del posteo.

    Una fila es «N. NOMBRE 🇦🇷 `P pts.`» con cualquier markdown alrededor; el MVP y «LA MEJOR RIMA» no tienen puesto y
    no son filas."""
    out = []
    for linea in str(content or '').split('\n'):
        m = PTS_CODIGO.search(linea)
        if m:
            resto = linea[:m.start()] + ' ' + linea[m.end():]
        else:
            sin = re.sub(r'[*_~`|]', ' ', linea).rstrip()
            m = PTS_FINAL.search(sin)
            if not m:
                continue
            resto = sin[:m.start()]
        resto = re.sub(r'[*_~`|>]', ' ', resto)
        f = FILA.match(resto)
        if not f:
            continue
        nombre = limpio(f.group(2))
        if not nombre or not any(c.isalnum() for c in nombre):
            continue
        try:
            pts = float(m.group(1).replace(',', '.'))
        except ValueError:
            continue
        out.append((int(f.group(1)), nombre, banderas(f.group(2)), int(pts) if pts == int(pts) else pts))
    return out


def fecha_de(content):
    """`(número, etiqueta)` de la fecha de un posteo («FECHA 1 REPRISE» -> `(1, '1 REPRISE')`), o `None`."""
    m = FECHA.search(_nfkc(content))
    if not m:
        return None
    return int(m.group(1)), (m.group(1) + (' REPRISE' if m.group(2) else ''))


def es_resultados(content):
    return bool(TITULO.search(_nfkc(content))) and fecha_de(content) is not None and len(filas(content)) >= 2


def es_anuncio(content):
    return bool(TITULO.search(_nfkc(content))) and fecha_de(content) is not None and not filas(content)


def firma(content):
    """Con qué nombre está firmada una rima: lo de antes de la primera bandera, o de la primera «|», en la primera
    línea con letras. «Krish 🇪🇸 I yo estoy…» -> `Krish`; «VEPG🏳️‍⚧️» -> `VEPG`."""
    for linea in str(content or '').split('\n'):
        l = _nfkc(linea)
        if not any(c.isalnum() for c in l):
            continue
        b = BANDERA.search(l)
        if b:
            l = l[:b.start()]
        elif '|' in l:
            l = l.split('|', 1)[0]
        return limpio(l)[:60]
    return ''


def _es_aviso(content):
    """Lo del organizador que no es una rima: los títulos y los «@everyone»."""
    c = str(content or '').lstrip()
    return c.startswith('#') or '@everyone' in c or '@here' in c


def _de_quien(msgs, nombre):
    """El mensaje (la rima) de ese nombre entre `msgs`: `(mensaje, por_cuenta)` o `(None, False)`.

    Firmada con el nombre —entero, o sus primeras palabras: «Dlx Freestyle» es DLX—, o desde una cuenta que se llama
    así (la rima de Lewito no lleva firma). ⚠️ Si dos cuentas distintas calzan, ninguna: no se elige."""
    cs = {_k(x) for x in candidatos(nombre)} - {''}
    por_firma, por_cuenta = [], []
    for m in msgs:
        f = firma(m.get('content'))
        pal = f.split()
        pref = {_k(' '.join(pal[:i])) for i in range(1, min(len(pal), 4) + 1)}
        cuentas = {_k(x) for x in (m.get('an') or [])} - {''}
        if cs & cuentas:
            por_cuenta.append(m)
        elif _k(f) in cs or cs & pref:
            por_firma.append(m)
    for grupo, cuenta in ((por_cuenta, True), (por_firma, False)):
        autores = {m.get('a') for m in grupo}
        if len(autores) == 1:
            return grupo[-1], cuenta
        if len(autores) > 1:
            return None, False
    return None, False


def fechas_de(msgs):
    """`{número: fecha}` de los posteos de resultados entre `msgs` (del más viejo al más nuevo).

    Cada fila lleva lo que se vio de su rima: el mensaje (`rima`), la cuenta (`cuenta`), si la cuenta se llama como el
    nombre (`cn`) y si tenía ❌ (`x`). La ventana de las rimas va del anuncio de esa fecha (o del resultado anterior) al
    resultado."""
    msgs = sorted(msgs, key=lambda m: int(m['id']))
    anuncio, out, ult_res = {}, {}, None
    for m in msgs:
        c = m.get('content') or ''
        if es_anuncio(c):
            anuncio[fecha_de(c)[0]] = m
            continue
        if not es_resultados(c):
            continue
        n, etiqueta = fecha_de(c)
        an = anuncio.get(n)
        desde = int(an['id']) if an else (int(ult_res['id']) if ult_res else 0)
        ventana = [x for x in msgs if desde < int(x['id']) < int(m['id']) and not _es_aviso(x.get('content'))]
        res = []
        for p, nombre, bs, pts in filas(c):
            r, cn = _de_quien(ventana, nombre)
            e = {'p': p, 'n': nombre, 'b': bs, 'pts': pts}
            if r:
                e.update(rima=r['id'], cuenta=r.get('a') or '', cn=cn)
                if '❌' in (r.get('rx') or []):
                    e['x'] = True
            res.append(e)
        out[n] = {'fecha': etiqueta, 'n': n, 'msg': m['id'], 't': m['t'], 'ed': m.get('ed') or '',
                  'anuncio': an['id'] if an else '', 'anuncio_t': an['t'] if an else '', 'org': m.get('a') or '',
                  'res': res}
        ult_res = m
    return out


def _juntar(viejas, nuevas):
    """Las fechas guardadas con las recién leídas: la nueva reemplaza a la de su número, pero lo que se había visto de
    una rima (la cuenta) se conserva si esta vez la ventana no llegó a verla."""
    out = {str(k): v for k, v in (viejas or {}).items()}
    for n, f in (nuevas or {}).items():
        v = out.get(str(n))
        if v and v.get('msg') == f.get('msg'):
            antes = {e.get('n'): e for e in v.get('res') or []}
            for e in f.get('res') or []:
                a = antes.get(e.get('n')) or {}
                if not e.get('cuenta') and a.get('cuenta'):
                    for k in ('rima', 'cuenta', 'cn', 'x'):
                        if k in a:
                            e[k] = a[k]
            if not f.get('anuncio') and v.get('anuncio'):
                f['anuncio'], f['anuncio_t'] = v['anuncio'], v.get('anuncio_t') or ''
        elif v and int(v.get('msg') or 0) > int(f.get('msg') or 0):
            continue                                     # lo guardado es más nuevo (otra versión de la fecha)
        out[str(n)] = f
    return out


# ── quién es quién ───────────────────────────────────────────────────────
def indice(padron=None, pool=None):
    """Lo que hace falta para resolver: `{'pad': {clave: [filas]}, 'did': {discord: fila}, 'pool': {clave: [raw]},
    'pool_did': {discord: raw}}`, de `datos/padron.json` y `datos/temporada_pool.json` si no vienen."""
    from comun.claves import clave

    def _json(n):
        try:
            with io.open(os.path.join(BASE, 'datos', n), encoding='utf-8') as f:
                return json.load(f) or []
        except (OSError, ValueError):
            return []
    padron = _json('padron.json') if padron is None else padron
    pool = _json('temporada_pool.json') if pool is None else pool
    ix = {'pad': {}, 'did': {}, 'pool': {}, 'pool_did': {}}
    for x in padron:
        raw = str(x.get('raw') or '').strip()
        if raw:
            ix['pad'].setdefault(clave(raw), []).append(x)
            d = str(x.get('discord_id') or '').strip()
            if d.isdigit():
                ix['did'].setdefault(d, x)
    for p in pool:
        raw = str(p.get('raw') or '').strip()
        if raw:
            ix['pool'].setdefault(_k(raw) or clave(raw), []).append(raw)
            d = str(p.get('discord_id') or '').strip()
            if d.isdigit():
                ix['pool_did'].setdefault(d, raw)
    return ix


def _iso_de(pais):
    try:
        from padron_t1 import PAIS_ISO
    except Exception:                                    # noqa: BLE001
        return ''
    return PAIS_ISO.get(str(pais or '').strip(), '')


def por_nombre(nombre, bs, ix, canon=None):
    """`(persona, fila_del_padron)` de un nombre, o `(None, None)`; `('?', None)` si hay más de uno y la bandera no
    decide. Como el resto de la Liga: la Lista, después la cadena de AKAs (`canon`) y, al final, el pool."""
    from comun.claves import clave
    canon = canon or (lambda x: x)
    for v in candidatos(nombre):
        for q in (v, canon(v)):
            fs = ix['pad'].get(clave(q)) or ix['pad'].get(_k(q)) or []
            if len(fs) > 1 and bs:
                fs = [f for f in fs if _iso_de(f.get('pais')) in bs] or fs
            if len(fs) == 1:
                return fs[0]['raw'], fs[0]
            if len(fs) > 1:
                return '?', None
        ps = ix['pool'].get(_k(v)) or ix['pool'].get(_k(canon(v))) or []
        if len(set(ps)) == 1:
            return ps[0], None
    return None, None


def resolver(fechas, ix=None, canon=None):
    """Le pone a cada fila `persona` (o nada), `did` (para la Tienda) y `como` (`nombre+cuenta`, `nombre`, `cuenta`,
    `choque`, `bandera`, `dudoso`, o vacío). Devuelve `[(fecha, nombre, por qué)]`: lo que quedó sin resolver."""
    ix = ix or indice()
    sin = []
    for f in (fechas or {}).values():
        for e in f.get('res') or []:
            for k in ('persona', 'did', 'como', 'pista'):
                e.pop(k, None)
            pn, fila = por_nombre(e['n'], e.get('b') or [], ix, canon)
            cuenta = str(e.get('cuenta') or '')
            fc = ix['did'].get(cuenta) if cuenta else None
            pc = (fc or {}).get('raw') or (ix['pool_did'].get(cuenta) if cuenta else None)
            d_fila = str((fila or {}).get('discord_id') or '').strip()
            if pn == '?':
                e['como'], por = 'dudoso', 'hay más de uno con ese nombre y la bandera no decide'
            elif pn and pc and pn != pc:
                e['como'], por = 'choque', 'el nombre es %s y la rima la publicó la cuenta de %s' % (pn, pc)
            elif pn and cuenta and not pc and d_fila.isdigit() and d_fila != cuenta:
                e['como'], por = 'choque', 'el nombre es %s y la rima la publicó otra cuenta, que no está en la Lista' % pn
            elif pn:
                iso = _iso_de((fila or {}).get('pais'))
                if not pc and iso and e.get('b') and iso not in e['b']:
                    e['como'], por = 'bandera', 'el nombre es %s, pero su país no es el de la bandera' % pn
                else:
                    e['persona'], e['como'], por = pn, ('nombre+cuenta' if pc else 'nombre'), ''
            elif pc and e.get('cn'):
                e['persona'], e['como'], por = pc, 'cuenta', ''
            elif pc:
                e['como'], por = '', 'no está en la Lista; la rima la publicó la cuenta de %s' % pc
                e['pista'] = pc
            elif cuenta:
                e['como'], por = '', 'no está en la Lista, y su cuenta tampoco'
            else:
                e['como'], por = '', 'no está en la Lista y no encontré su rima'
            if e.get('persona'):
                # la Tienda: su Discord de la Lista; si no tiene, el del pool; y si tampoco, la cuenta de su rima
                # cuando esa cuenta es la suya (confirmada por la Lista o porque se llama como él)
                d = d_fila if d_fila.isdigit() else str((fc or {}).get('discord_id') or '').strip()
                if not d.isdigit():
                    d = next((k for k, v in ix['pool_did'].items() if v == e['persona']), '')
                if not d and cuenta and (pc == e['persona'] or e.get('cn')):
                    d = cuenta
                if d:
                    e['did'] = d
            else:
                sin.append((f.get('fecha'), e['n'], por))
    return sin


# ── lo que paga ──────────────────────────────────────────────────────────
def cobra(e):
    """¿Esa fila cobra? Con puntos (o con `CERO_COBRA`)."""
    return CERO_COBRA or (e.get('pts') or 0) > 0


def paga(p):
    """`(puntos de Temporada, Puntos de Tienda)` del puesto `p`."""
    return PUNTOS.get(p, PARTICIPA), TIENDA.get(p, TIENDA_PARTICIPA)


def _de_fecha(f):
    """`{persona: fila}` de una fecha, una vez por persona (si figura dos veces, su mejor puesto)."""
    out = {}
    for e in f.get('res') or []:
        q = e.get('persona')
        if q and cobra(e) and (q not in out or e['p'] < out[q]['p']):
            out[q] = e
    return out


def _de_temporada(d, temp):
    for f in ((d or {}).get('fechas') or {}).values():
        if temp is None or str(f.get('temp') or 'prueba') == str(temp):
            yield f


def suma(d=None, temp=None, canon=None, es_troll=None):
    """`{persona: puntos}` de Temporada de la temporada `temp` (la de ahora si no viene). Con el nombre canónico
    (`canon`, el de la vitrina) y sin los troll."""
    import multiplicadores as MU
    d = leer() if d is None else d
    temp = MU.temporada_actual() if temp is None else temp
    canon = canon or (lambda x: x)
    es_troll = es_troll or (lambda x: False)
    out = {}
    for f in _de_temporada(d, temp):
        for q, e in _de_fecha(f).items():
            q = canon(q)
            if q and not es_troll(q):
                out[q] = out.get(q, 0) + paga(e['p'])[0]
    return out


def tienda(d=None, temp=None):
    """`{'<temporada>:f<N>:<discord>': [discord, puntos, ms]}` para `precios.para_objeto()`: la Tienda de la temporada.

    🔑 LA CLAVE ES FECHA + PERSONA: una sola vez por fecha, y el objeto la reemplaza entera en cada corrida (`wr:`,
    en `resolverPrecios()` de `bot/avisos.js`). Sólo la temporada de ahora: con la siguiente, lo de ésta deja de
    mandarse y el objeto lo borra, como el Most Wanted (`precios.tienda_mw()`)."""
    import multiplicadores as MU
    d = leer() if d is None else d
    temp = MU.temporada_actual() if temp is None else temp
    out = {}
    for f in _de_temporada(d, temp):
        ms = int(_de_iso(f['t']).timestamp() * 1000)
        for q, e in _de_fecha(f).items():
            did = str(e.get('did') or '')
            if did.isdigit():
                k = '%s:f%s:%s' % (f.get('temp') or temp, f['n'], did)
                m = paga(e['p'])[1]
                if k not in out or m > out[k][1]:
                    out[k] = [did, m, ms]
    return out


def plumas(d=None):
    """`(ganadores, fechas)`: quién ganó alguna fecha y en cuántas cobró cada uno, de todas las temporadas (las
    insignias quedan para siempre)."""
    d = leer() if d is None else d
    oro, cuenta = set(), {}
    for f in ((d or {}).get('fechas') or {}).values():
        for q, e in _de_fecha(f).items():
            cuenta[q] = cuenta.get(q, 0) + 1
            if e['p'] == 1:
                oro.add(q)
    return oro, cuenta


def semanas(d=None, canon=None, es_troll=None):
    """`[(instante del anuncio, número, {quiénes cobraron})]`, para la misión de la semana (`bot/misiones.py`). El
    instante es el del anuncio: la fecha «pasa» la semana en que se anuncia, aunque los resultados lleguen después."""
    d = leer() if d is None else d
    canon = canon or (lambda x: x)
    es_troll = es_troll or (lambda x: False)
    out = []
    for f in ((d or {}).get('fechas') or {}).values():
        t = f.get('anuncio_t') or f.get('t')
        try:
            t = _de_iso(t)
        except (TypeError, ValueError):
            continue
        qs = {canon(q) for q in _de_fecha(f)}
        out.append((t, f['n'], {q for q in qs if q and not es_troll(q)}))
    return sorted(out, key=lambda x: x[0])


# ── Discord ──────────────────────────────────────────────────────────────
def _mensajes(s, paginas):
    """Los mensajes del canal, del más viejo al más nuevo: `[{id, t, ed, a, an, content, rx}]`. Sólo lo que hace
    falta: `a` es la cuenta, `an` sus nombres y `rx` los emojis de sus reacciones."""
    out, antes = [], None
    for _ in range(paginas):
        url = 'https://discord.com/api/v10/channels/%s/messages?limit=100%s' % (CANAL, '&before=' + antes if antes else '')
        r = s.get(url, timeout=30)
        if r.status_code == 429:
            time.sleep(float((r.json() or {}).get('retry_after') or 2) + 0.5)
            r = s.get(url, timeout=30)
        if r.status_code != 200:
            print('   ⚠️ el canal del Writing contestó %s' % r.status_code)
            return None if not out else out
        ms = r.json()
        if not ms:
            break
        for m in ms:
            a = m.get('author') or {}
            out.append({'id': str(m['id']), 't': str(m.get('timestamp') or '')[:19] + 'Z',
                        'ed': str(m.get('edited_timestamp') or '')[:19], 'a': str(a.get('id') or ''),
                        'an': [x for x in (a.get('username'), a.get('global_name')) if x],
                        'content': m.get('content') or '',
                        'rx': [((x.get('emoji') or {}).get('name') or '') for x in m.get('reactions') or []]})
        antes = str(ms[-1]['id'])
        if len(ms) < 100:
            break
        time.sleep(0.3)
    return sorted(out, key=lambda m: int(m['id']))


def leer(ruta=None):
    """`datos/writing.json`, o `{}`."""
    try:
        with io.open(ruta or SALIDA, encoding='utf-8') as f:
            return json.load(f) or {}
    except (OSError, ValueError):
        return {}


def armar(fechas, sin=None):
    """Lo que va a `datos/writing.json`, con la temporada y la semana de cada fecha."""
    import multiplicadores as MU
    fechas = {str(k): v for k, v in fechas.items()}
    for f in fechas.values():
        f['temp'] = MU.temporada_actual(_de_iso(f['t']))
        f['sem'] = MU.periodo(_de_iso(f.get('anuncio_t') or f['t']))[0]
    return {'_leeme': 'El Writing Challenge de FFA: cada fecha, quién quedó dónde y de qué cuenta. Lo arma '
                      'bot/writing.py en el ciclo (paso 2b0); las reglas y los números viven ahí. Sin las rimas: el '
                      'repo es público. `res`: p puesto, n nombre como lo escribió el organizador, b banderas, pts, '
                      'persona (vacío: sin resolver), did (para la Tienda), como (de dónde salió), rima/cuenta (el '
                      'mensaje y la cuenta que lo publicó), x (tenía ❌). Una fecha por número: la más nueva gana.',
            'canal': CANAL, 'sv': SV,
            't': _iso(dt.datetime.now(dt.timezone.utc)),
            'fechas': dict(sorted(fechas.items(), key=lambda kv: int(kv[0]))),
            'sin_resolver': [list(x) for x in (sin or [])]}


def correr(aplicar=False, msgs=None):
    """Lee el canal, junta con lo guardado, resuelve y (con `aplicar`) escribe. ⚠️ SI NO SE PUEDE LEER EL CANAL, NO
    ESCRIBE NADA: un archivo vacío le sacaría a todos lo cobrado por una corrida."""
    import rankings as RK
    viejo = leer()
    if msgs is None:
        import escuchar as E
        msgs = _mensajes(E.sesion(), PAGINAS if viejo.get('fechas') else PAGINAS_PRIMERA)
    if msgs is None:
        print('   ⚠️ no pude leer el canal del Writing: queda lo de la corrida anterior')
        return None
    fechas = _juntar(viejo.get('fechas'), fechas_de(msgs))
    sin = resolver(fechas, canon=RK.canon)
    d = armar(fechas, sin)
    # ⚠️ LA HORA SE MUEVE SÓLO SI CAMBIÓ ALGO: el ciclo commitea `datos/` cada media hora, y un `t` nuevo en cada
    # corrida sería un commit de este archivo cada vez sin que pase nada
    if viejo.get('t') and {k: v for k, v in viejo.items() if k != 't'} == \
            json.loads(json.dumps({k: v for k, v in d.items() if k != 't'}, ensure_ascii=False)):
        d['t'] = viejo['t']
    if aplicar:
        with io.open(SALIDA, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(d, f, ensure_ascii=False, indent=1)
            f.write('\n')
    return d


def informe(d):
    """Lo que se imprime: cada fecha, quién cobra qué, y lo que quedó sin resolver. En el log del ciclo se ven sólo
    los renglones con ✍️ y ⚠️ (`pipeline.corre(mostrar=…)`): el resumen y cuántos quedaron sin resolver."""
    fs = list((d.get('fechas') or {}).values())
    if fs:
        u = fs[-1]
        print('   ✍️ %d fecha(s) guardada(s) · la última, FECHA %s (%s): %d participantes' % (
            len(fs), u.get('fecha'), (u.get('t') or '')[:10], len(u.get('res') or [])))
    else:
        print('   ✍️ todavía no hay resultados del Writing Challenge')
    for f in fs:
        print('   FECHA %s (%s, %s) · %d participantes' % (f.get('fecha'), (f.get('t') or '')[:10],
                                                       f.get('temp'), len(f.get('res') or [])))
        for e in f.get('res') or []:
            t, ti = paga(e['p']) if cobra(e) and e.get('persona') else (0, 0)
            print('      %2d. %-26s %4s pts  → %-14s %-13s %5s Temp · %4s Tienda%s' % (
                e['p'], e['n'][:26], e['pts'], (e.get('persona') or '—')[:14], e.get('como') or 'sin resolver',
                t or '—', ti if ti and e.get('did') else '—', '  ❌' if e.get('x') else ''))
    sin = d.get('sin_resolver') or []
    if sin:
        print('\n   ⚠️ %d sin resolver (quedan como están escritos; se pagan el día que se sepa quién es):' % len(sin))
        for fe, n, por in sin:
            print('      FECHA %-10s %-24s %s' % (fe, n[:24], por))


# ── self-check ───────────────────────────────────────────────────────────
#: los dos posteos de resultados de verdad (14/10/2026), sin la rima del MVP
FIX_F1 = ('# FFA WRITING CHALLANGE\n\n> FECHA 1 REPRISE\n\n**1. *LVEL 🇻🇪***`3 pts.`\n**2. *CINEXFILO 🇻🇪***`3 pts.`\n'
          '**3. *ELSOOLAR 🇨🇴***`2 pts.`\n**4. *ADRIANEX 🇪🇸***`1 pts.`\n**5. *KRISH 🇪🇸***`1 pts.`\n'
          '**6. *MOLUSCO 🇦🇷***`0 pts.`\n\n||@everyone||')
FIX_F2 = ('# FFA WRITING CHALLANGE\n\n> FECHA 2\n\n**1. *JAHNO "El MELOMANÍACO"  🇦🇷***`5 pts.`\n'
          '**2. *LVEL 🇻🇪***`4 pts.`\n**3. *ELSOOLAR 🇨🇴***`3 pts.`\n**4. *CINEXFILO 🇻🇪***`3 pts.`\n'
          '**5. *KRISH 🇪🇸***`2 pts.`\n**6. *DLX 🇺🇸***`2 pts.`\n**7. *VEPG🏳️‍⚧️***`1 pts.`\n**8. *ZAIK 🇪🇸***`1 pts.`\n'
          '**9. *LEWITO 🇦🇷***`1 pts.`\n**10. *MONY RAP 🇲🇽***`1 pts.`\n**11. *ADRIANEX 🇪🇸***`1 pts.`\n'
          '**12. *N1K🇵🇪***`1 pts.`\n**13. *MOLUSCO 🇦🇷***`0 pts.`\n**14. *MATI CERNA 🇦🇷***`0 pts.`\n'
          '**15. *PERFUME CHAKAL 🇨🇱🇵🇪***`0 pts.`\n\n- MVP: **JAHNO "El MELOMANÍACO"**  🇦🇷\n\n- LA MEJOR RIMA: \n'
          '**"(la rima)"**')
FIX_ANUNCIO = '# <:FFA:1>✍️ FFA WRITING CHALLENGE — FECHA %s ✍️<:FFA:1>\n\n@everyone\n\n¡Demuestra tu nivel con el lápiz!'


def _self_check():
    print('\n══ EL WRITING CHALLENGE ══\n')
    mal = 0

    def ok(c, q, extra=''):
        nonlocal mal
        mal += not c
        print('   %s %s%s' % ('✅' if c else '🔴', q, ('  ' + str(extra)[:300]) if extra and not c else ''))

    f1, f2 = filas(FIX_F1), filas(FIX_F2)
    ok(len(f1) == 6 and f1[0] == (1, 'LVEL', ['ve'], 3) and f1[1][:2] == (2, 'CINEXFILO') and f1[5] == (6, 'MOLUSCO', ['ar'], 0),
       'la Fecha 1: seis filas, el puesto del posteo aunque Lvel y Cinexfilo empaten en 3', f1)
    ok(len(f2) == 15 and f2[0] == (1, 'JAHNO "El MELOMANÍACO"', ['ar'], 5) and f2[6][:2] == (7, 'VEPG')
       and f2[11] == (12, 'N1K', ['pe'], 1) and f2[14] == (15, 'PERFUME CHAKAL', ['cl', 'pe'], 0),
       'la Fecha 2: quince filas; el apodo entre comillas se queda, 🏳️‍⚧️ no es una bandera de país, dos banderas', f2)
    ok(fecha_de(FIX_F1) == (1, '1 REPRISE') and fecha_de(FIX_F2) == (2, '2') and es_resultados(FIX_F2)
       and not es_resultados(FIX_ANUNCIO % '2') and es_anuncio(FIX_ANUNCIO % '2 REPRISE'),
       'la fecha y su REPRISE; el anuncio («CHALLENGE») no es un resultado («CHALLANGE»)')
    ok(candidatos('JAHNO "El MELOMANÍACO"') == ['JAHNO "El MELOMANÍACO"', 'JAHNO', 'El MELOMANÍACO', 'MELOMANÍACO'],
       'un nombre con apodo se busca entero, sin el apodo y por el apodo')
    ok(firma('Krish 🇪🇸 I yo estoy ganando') == 'Krish' and firma('CINEXFILO 🇻🇪 | Esto es') == 'CINEXFILO'
       and firma('VEPG🏳️‍⚧️ \n\nSe hacen') == 'VEPG' and firma('\n**Amore mio, el mundo es mio') == 'Amore mio, el mundo es mio',
       'la firma de una rima: antes de la bandera, o de la «|»')
    # la ventana y las cuentas, con cuentas de mentira
    ORG = '900'

    def M(i, content, a, an=(), rx=()):
        return {'id': str(i), 't': '2026-10-07T%02d:00:00Z' % (i % 24), 'ed': '', 'a': a, 'an': list(an),
                'content': content, 'rx': list(rx)}
    msgs = [M(10, FIX_ANUNCIO % '2', ORG, ['org']),
            M(11, 'Lvel 🇻🇪\n\nEl rayo…', '101', ['lvel_free', 'Lvel_free']),
            M(12, '**Amore mio, el mundo es mio**', '102', ['l3wito', 'Lewito']),
            M(13, 'Dlx Freestyle 🇺🇸\n\nPara ser flash…', '103', ['itsdlx', 'Dlxmouche']),
            M(14, 'Perfume chakal 🇨🇱 | **Este dice…**', '104', ['cronoxzito', '- 𝘾𝙍𝙊𝙉𝙊𝙓 🇨🇱'], ['🔥', '❌']),
            M(15, 'Jahno "El MELOMANÍACO"  🇦🇷 | \n"I am…', '105', ['jahnoesremelomaniaco', 'Melómano']),
            M(16, 'Mony rap 🇲🇽\n\nReading…', '106', ['monyrocha', 'Mony']),
            M(17, '# @everyone ES HORA DE REACCIONAR', ORG, ['org']),
            M(20, FIX_F2, ORG, ['org'])]
    fs = fechas_de(msgs)
    r = {e['n']: e for e in fs[2]['res']}
    ok(list(fs) == [2] and fs[2]['anuncio'] == '10' and fs[2]['msg'] == '20' and len(fs[2]['res']) == 15,
       'una fecha: su anuncio, su resultado y las quince filas', fs)
    ok(r['LVEL'].get('cuenta') == '101' and r['LEWITO'].get('cuenta') == '102' and r['LEWITO'].get('cn')
       and r['DLX'].get('cuenta') == '103' and r['PERFUME CHAKAL'].get('cuenta') == '104' and r['PERFUME CHAKAL'].get('x')
       and r['JAHNO "El MELOMANÍACO"'].get('cuenta') == '105' and not r['MOLUSCO'].get('cuenta'),
       'cada fila con su rima: por la firma, por las primeras palabras («Dlx Freestyle») o por la cuenta (Lewito, sin '
       'firma); la ❌ se anota; sin rima (Molusco), sin cuenta', {k: (v.get('cuenta'), v.get('cn')) for k, v in r.items()})
    # la Lista de mentira: Lvel, Lewito, DLX, melomaniaco (con AKA «jahno»), Cronox, dos Volk
    pad = [{'raw': 'Lvel', 'pais': 'Venezuela', 'discord_id': '101'}, {'raw': 'LEWITO', 'pais': 'Argentina', 'discord_id': '102'},
           {'raw': 'DLX', 'pais': 'Estados Unidos', 'discord_id': '103'}, {'raw': 'Cronox', 'pais': 'Chile', 'discord_id': '104'},
           {'raw': 'melomaniaco', 'pais': 'Argentina', 'discord_id': '105'}, {'raw': 'Molusco', 'pais': 'Argentina', 'discord_id': '107'},
           {'raw': 'Krish', 'pais': 'España', 'discord_id': '108'}]
    pool = [{'raw': '🏳️‍⚧️ VEPG 🏳️‍⚧️', 'discord_id': ''}, {'raw': 'Lvel', 'discord_id': '101'}]
    ix = indice(pad, pool)
    aka = {'jahno': 'melomaniaco'}
    canon = lambda x: aka.get(_k(x), x)                  # noqa: E731
    sin = resolver(fs, ix, canon)
    ok(r['LVEL'].get('persona') == 'Lvel' and r['LVEL'].get('como') == 'nombre+cuenta' and r['LVEL'].get('did') == '101',
       'Lvel: el nombre y la cuenta dicen lo mismo', r['LVEL'])
    ok(r['JAHNO "El MELOMANÍACO"'].get('persona') == 'melomaniaco' and r['JAHNO "El MELOMANÍACO"'].get('did') == '105',
       'JAHNO es melomaniaco por su AKA, y su cuenta lo confirma', r['JAHNO "El MELOMANÍACO"'])
    ok(r['VEPG'].get('persona') == '🏳️‍⚧️ VEPG 🏳️‍⚧️' and not r['VEPG'].get('did'),
       'VEPG no está en la Lista pero sí en la Temporada: suma ahí, y sin Discord no cobra Tienda', r['VEPG'])
    ok(not r['PERFUME CHAKAL'].get('persona') and r['PERFUME CHAKAL'].get('pista') == 'Cronox'
       and not r['MONY RAP'].get('persona'),
       'un seudónimo publicado desde otra cuenta NO se adivina (queda la pista); quien no está en ningún lado, tampoco',
       [r['PERFUME CHAKAL'], r['MONY RAP']])
    ok(r['MOLUSCO'].get('persona') == 'Molusco' and r['MOLUSCO'].get('como') == 'nombre' and r['MOLUSCO'].get('did') == '107',
       'sin rima, el nombre alcanza (Molusco), y la Tienda va a su Discord de la Lista', r['MOLUSCO'])
    ok({x[1] for x in sin} >= {'PERFUME CHAKAL', 'MONY RAP'}, 'lo que no se resolvió se informa', sin)
    # el choque y la bandera
    fs2 = {9: {'fecha': '9', 'n': 9, 't': '2026-10-20T00:00:00Z', 'res': [
        {'p': 1, 'n': 'KRISH', 'b': ['es'], 'pts': 3, 'cuenta': '101', 'cn': False},
        {'p': 2, 'n': 'Volk', 'b': ['co'], 'pts': 2}, {'p': 3, 'n': 'Volk', 'b': ['ar'], 'pts': 1},
        {'p': 4, 'n': 'Lvel', 'b': ['mx'], 'pts': 1}]}}
    ix2 = indice(pad + [{'raw': 'Volk', 'pais': 'México'}, {'raw': 'volk', 'pais': 'Colombia', 'discord_id': '109'}], pool)
    resolver(fs2, ix2, canon)
    e9 = fs2[9]['res']
    ok(e9[0].get('como') == 'choque' and not e9[0].get('persona'),
       'el nombre dice Krish y la rima la publicó la cuenta de Lvel: choque, y no se paga', e9[0])
    ok(e9[1].get('persona') == 'volk' and e9[1].get('did') == '109' and e9[2].get('como') == 'dudoso',
       'dos Volk: decide la bandera (🇨🇴 es volk); con una bandera que no es de ninguno, no se elige', e9[1:3])
    ok(e9[3].get('como') == 'bandera' and not e9[3].get('persona'),
       'Lvel con 🇲🇽 y sin cuenta que lo confirme: no se da por Lvel 🇻🇪', e9[3])
    # lo que paga (la temporada de cada fecha sale de su instante: acá se fija a mano, para no depender del arranque)
    d = armar(fs, sin)
    d['fechas']['2']['temp'] = 'prueba'
    sm = suma(d, 'prueba')
    ok(sm.get('melomaniaco') == PUNTOS[1] and sm.get('Lvel') == PUNTOS[2] and sm.get('DLX') == PARTICIPA
       and 'Molusco' not in sm and 'MONY RAP' not in sm,
       'la Temporada: 1.º %d, 2.º %d, el resto %d; con 0 puntos (la ❌) no se cobra; sin resolver, nada'
       % (PUNTOS[1], PUNTOS[2], PARTICIPA), sm)
    ok(suma(d, 't9') == {} and suma(d, 'prueba', es_troll=lambda q: q == 'DLX').get('DLX') is None,
       'sólo la temporada pedida, y sin los troll')
    td = tienda(d, 'prueba')
    ok(td.get('prueba:f2:105', [0, 0])[:2] == ['105', TIENDA[1]] and td.get('prueba:f2:101', [0, 0])[1] == TIENDA[2]
       and td.get('prueba:f2:103', [0, 0])[1] == TIENDA_PARTICIPA and not any(k.endswith(':107') for k in td)
       and len(td) == len([e for e in d['fechas']['2']['res'] if e.get('did') and cobra(e)]),
       'la Tienda: una clave por fecha y persona, al Discord de cada uno; sin Discord o con 0 puntos, nada', td)
    # una fecha se cuenta UNA vez: releer el canal entero (dos veces) no agrega nada
    j = _juntar(_juntar(d['fechas'], fechas_de(msgs)), fechas_de(msgs))
    resolver(j, ix, canon)
    ok(len(j) == 1 and suma({'fechas': j}, 'prueba') == sm and tienda({'fechas': j}, 'prueba') == td,
       'releer el canal dos veces da los mismos puntos y la misma Tienda', suma({'fechas': j}, 'prueba'))
    viejo = {'2': dict(d['fechas']['2'])}
    viejo['2']['res'] = [dict(e) for e in d['fechas']['2']['res']]
    sin_rimas = [m for m in msgs if m['id'] in ('10', '20')]
    j2 = _juntar(viejo, fechas_de(sin_rimas))
    ok(next(e for e in j2['2']['res'] if e['n'] == 'LVEL').get('cuenta') == '101',
       'si una relectura no llega a ver la rima, se queda con la cuenta que ya se había visto')
    otra = fechas_de(msgs + [M(30, FIX_F2.replace('**2. *LVEL', '**2. *KRISH').replace('**5. *KRISH', '**5. *LVEL'), ORG)])
    j3 = _juntar(d['fechas'], otra)
    ok(len(j3) == 1 and j3['2']['msg'] == '30' and _juntar(j3, {2: fs[2]})['2']['msg'] == '30',
       'otro posteo de la misma fecha la reemplaza (gana el más nuevo), y uno más viejo no la pisa')
    oro, cuantas = plumas({'fechas': {'1': {'n': 1, 'res': [{'p': 1, 'persona': 'Lvel', 'pts': 3}]},
                                      '2': d['fechas']['2']}})
    ok(oro == {'Lvel', 'melomaniaco'} and cuantas.get('Lvel') == 2 and 'Molusco' not in cuantas,
       'las plumas: quién ganó una fecha y en cuántas cobró cada uno', (oro, cuantas))
    sem = semanas(d)
    ok(len(sem) == 1 and sem[0][1] == 2 and 'Lvel' in sem[0][2] and 'Molusco' not in sem[0][2],
       'para la misión: la semana del anuncio y quiénes cobraron', sem)
    print('\n   %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    a = sys.argv[1:]
    if '--auto' in a:
        return 1 if _self_check() else 0
    print('\n══ EL WRITING CHALLENGE DE FFA ══\n')
    d = correr(aplicar='--aplicar' in a)
    if d is None:
        return 0
    informe(d)
    if '--aplicar' not in a:
        print('\n   (simulacro: no escribí nada — `--aplicar`)')
    print('')
    return 0


if __name__ == '__main__':
    raise SystemExit(main() or 0)
