# -*- coding: utf-8 -*-
"""🔎 QUIÉN ES QUIÉN, SOLO: EL DISCORD ID DE QUIEN JUEGA SIN TENERLO, BUSCADO EN TODOS LOS SERVIDORES (paso 1a1).

    python bot/autoidentificar.py              qué haría: lee Discord, no escribe
    python bot/autoidentificar.py --aplicar    lo escribe (SÓLO EN GITHUB: un solo escritor de la Lista)
    python bot/autoidentificar.py --ya         sin esperar las 3 horas entre vueltas
    python bot/autoidentificar.py --sembrar    arma `datos/inscritos_hist.json` del historial de git (una vez)
    python bot/autoidentificar.py --auto       el self-check, sin red

Dlx, 12/11/2026: *«Quiero que hagas una autoidentificación de usuarios en general… como tiene permisos de bot en la
mayoría de servidores haz que busques tú también usuarios así de frente»*, y *«yo no voy a decidir nada… haz todo tú»*.

QUÉ HACE, EN CADA VUELTA (cada 3 horas, dentro del ciclo)
---------------------------------------------------------
1. GUARDA LAS INSCRIPCIONES PARA SIEMPRE (`datos/inscritos_hist.json`). 🔴 Los organizadores VACÍAN el canal de
   inscripciones después de cada evento —medido el 12/11/2026: de 4.000 que guardaba `datos/anuncios.json`, en
   Discord quedaban 813— y `anuncios.json` se queda con las últimas 4.000. Una inscripción es la única prueba de que
   ESA cuenta usó ESE nombre, así que se guarda compacta: mensaje, servidor, cuenta, nombre y bandera.
2. BAJA LOS MIEMBROS DE TODOS LOS SERVIDORES DONDE ESTÁ EL BOT (22, ~21.600 cuentas, ~45 pedidos).
3. CRUZA con `herramientas/identificar.py` —las mismas pruebas y guardas que se midieron— y escribe SÓLO lo que pasa
   `identificar.automatico()`: «seguro», sin veto, con una prueba DIRECTA (se anotó con ese nombre o el host lo mencionó
   con él) y algo más (el nombre de Discord igual, o anotado dos veces).

🧪 MEDIDO ANTES DE PRENDERLO (12/11/2026), con los 536 que ya tienen ID, corridos como si no lo tuvieran: la regla eligió
288 veces; 279 la cuenta de la Lista, 5 otra cuenta de la misma persona, 3 donde el ID de la Lista parece mal puesto
y 1 dudosa (una cuenta anotada dos veces con ese nombre que la Lista no tiene). Ningún error claro.

QUÉ ESCRIBE
-----------
· Quien está en la Lista sin ID: su ID (`lista_raperos.poner_id()`, que no pisa nada ni pone un ID que ya es de otro).
· Quien jugó sin estar en la Lista: una fila nueva con su ID (`agregar_varios()`). El país sólo si la bandera de su
  cuenta coincide con la de sus resultados: en FFA se anotan con banderas de broma, y un país mal puesto mueve la
  carta de País. Si no coincide va vacío y lo llena `autoverificar.py` con los roles, que es su trabajo.
· Lo deja en `datos/autoidentificar.json` → `hechos`, con las pruebas: para saber qué ID puso la máquina y deshacerlo.

LO QUE NO HACE, A PROPÓSITO
---------------------------
· 🔒 NO VERIFICA A NADIE. `autoverificar.py` le da el Miembro de DRA a quien tiene ID, está en DRA y tiene país; un ID
  puesto por esto queda afuera de eso (`sin_miembro()`) hasta que Dlx diga lo contrario. Verificar es el portón de las
  cartas, y esa regla no se cambia por interpretación ([[identidad-no-se-interpreta]]).
· NO UNE NOMBRES. «Otro nombre de alguien de la Lista» (la cuenta que lo anotó ya tiene fila) se cuenta y se deja: la
  misma cuenta puede estar anotando a un amigo, y unir mueve puntos.
· NO PISA UN ID. Si la Lista ya tiene uno, no se toca, aunque las pruebas digan otra cosa.
· EN UNA PC NO ESCRIBE: los resultados y la Lista los escribe sólo GitHub ([[sheet-no-en-la-corrida]]).

TOPES
-----
Hasta `TOPE` por vuelta; el resto queda para la siguiente. Si de golpe salen más de `FRENO`, no escribe ninguno y le
llega un DM a Dlx: eso no es el goteo de cada día, es algo que se rompió.
"""
import datetime
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, os.path.join(BASE, 'sheet'), os.path.join(BASE, 'herramientas'), BASE):
    if _p not in sys.path:
        sys.path.insert(0, _p)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

HIST = os.path.join(BASE, 'datos', 'inscritos_hist.json')
MEMORIA = os.path.join(BASE, 'datos', 'autoidentificar.json')
ANUNCIOS = os.path.join(BASE, 'datos', 'anuncios.json')
LLAVES_ID = os.path.join(BASE, 'datos', 'identidad_llaves.json')

TOPE = 10
FRENO = 40
CADA_H = 3


def _ahora_et():
    import zoneinfo
    return datetime.datetime.now(zoneinfo.ZoneInfo('America/New_York'))


def madrugada(t):
    """De 3 a 11 AM ET: ni el ciclo ni el vigía corren, y no se manda nada a Discord (Dlx, 27/09/2026)."""
    return 3 <= t.hour < 11


def _leer(ruta, defecto):
    try:
        with io.open(ruta, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return defecto


def _escribir(ruta, d):
    tmp = ruta + '.tmp'
    with io.open(tmp, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(d, f, ensure_ascii=False, indent=0, separators=(',', ':'))
        f.write('\n')
    os.replace(tmp, ruta)


# ── 1. las inscripciones, para siempre ──────────────────────────────────────────────────────────────────────────────
LEEME_HIST = ('Cada inscripción que el bot vio, para siempre: [mensaje, servidor, cuenta, nombre normalizado, '
              'banderas]. Los organizadores vacían el canal después de cada evento y datos/anuncios.json guarda las '
              'últimas 4.000; esto es lo único que se acuerda de que ESA cuenta usó ESE nombre. Lo escribe '
              'bot/autoidentificar.py (paso 1a1) y lo lee herramientas/identificar.py.')


def fila_hist(i):
    """`[msg_id, sv, cuenta, nombre, banderas]` de una inscripción de `anuncios.json`, o `None` si no es anotarse."""
    import identificar as I
    if not (i.get('msg_id') and i.get('discord_id')):
        return None
    n = I.nombre_de_mensaje(i.get('texto'))
    if not n:
        return None
    return [str(i['msg_id']), i.get('servidor') or '', str(i['discord_id']), n, ''.join(sorted(I.cc_de(i.get('texto'))))]


def sumar_hist(hist, inscr):
    """Le suma a `hist` (filas) las inscripciones nuevas. Devuelve cuántas entraron."""
    vistos = {f[0] for f in hist}
    n = 0
    for i in inscr:
        f = fila_hist(i)
        if f and f[0] not in vistos:
            hist.append(f)
            vistos.add(f[0])
            n += 1
    hist.sort(key=lambda f: int(f[0]))
    return n


def como_inscripciones(hist):
    """Las filas guardadas, con la forma que espera `identificar.indices()`."""
    return [{'msg_id': f[0], 'servidor': f[1], 'discord_id': f[2], 'texto': f[3], 'canal': ''} for f in hist]


def guardar_hist(inscr_nuevas):
    d = _leer(HIST, {}) or {}
    hist = d.get('filas') or []
    n = sumar_hist(hist, inscr_nuevas)
    if n or not os.path.exists(HIST):
        _escribir(HIST, {'_leeme': LEEME_HIST, 'filas': hist})
    return hist, n


def sembrar():
    """Una vez: todo lo que el historial de git se acuerda (`identificar.inscripciones_de_git()`)."""
    import identificar as I
    sys.argv.append('--historia')
    viejas = I.inscripciones_de_git()
    hist, n = guardar_hist(viejas + ((_leer(ANUNCIOS, {}) or {}).get('inscripciones') or []))
    print('   %d inscripciones guardadas (%d nuevas)' % (len(hist), n))


# ── 2 y 3. buscar ───────────────────────────────────────────────────────────────────────────────────────────────────
def _token():
    t = os.environ.get('DISCORD_TOKEN')
    if t:
        return t
    for l in io.open(os.path.join(BASE, '.env'), encoding='utf-8'):
        if l.strip().startswith('DISCORD_TOKEN='):
            return l.split('=', 1)[1].strip().strip('"\'')
    raise RuntimeError('falta DISCORD_TOKEN')


def menciones_de_llaves():
    """`[(nombre, cuenta, sv, 0)]` de `datos/identidad_llaves.json`: los renglones «NOMBRE <@id>» de cada llave."""
    out = []
    for k, v in ((_leer(LLAVES_ID, {}) or {}).get('eventos') or {}).items():
        sv = (k.split('|') + ['', ''])[1]
        for n, did in (v.get('menciones') or {}).items():
            if n and did:
                out.append((n, str(did), sv, 0))
    return out


def candidatos(sinr, hechos):
    """`[(raw, resultado)]` de lo que pasa la regla automática y no se hizo ya."""
    ya = set(hechos)
    return [(raw, r) for raw, r in sorted(sinr.items()) if r.get('auto') and r['mejor']['id'] not in ya]


def resumen_pruebas(m):
    t = []
    n = len({x[1] for x in (m["pr"].get("insc") or [])})
    if n:
        t.append('se anotó así %d vez/veces' % n)
    if m['pr'].get('menc'):
        t.append('el host lo mencionó así')
    if m['pr'].get('usuario'):
        t.append('su usuario de Discord')
    elif m['pr'].get('apodo'):
        t.append('su apodo o nombre visible')
    if 'bandera' in m['tipos']:
        t.append('la misma bandera')
    return ' + '.join(t)


def pais_nuevo(r, cuenta):
    """El país de una fila nueva: sólo si la bandera de la cuenta coincide con la de sus resultados."""
    cc = sorted(set(r.get('cc') or []) & set((cuenta or {}).get('cc') or []))
    return cc[0] if len(cc) == 1 else ''


def correr(aplicar=False):
    import identificar as I
    import lista_raperos as LR
    import construir_padron as PAD
    mem = _leer(MEMORIA, {}) or {}
    mem.setdefault('_leeme', 'Lo que bot/autoidentificar.py hizo solo: `hechos` = {cuenta: quién, cuándo (ET), qué se '
                   'escribió y con qué pruebas}. Un ID de acá no verifica a nadie (autoverificar.sin_miembro).')
    hechos = mem.setdefault('hechos', {})
    ahora = _ahora_et()

    # 1. las inscripciones de esta corrida, a la memoria permanente (siempre: es barato y no espera a nadie)
    hist, nuevas = guardar_hist((_leer(ANUNCIOS, {}) or {}).get('inscripciones') or [])
    print('   inscripciones guardadas: %d (+%d)' % (len(hist), nuevas))

    ultima = mem.get('ultima')
    if ultima and '--ya' not in sys.argv:
        try:
            if (ahora - datetime.datetime.fromisoformat(ultima)).total_seconds() < CADA_H * 3600:
                print('   la última búsqueda fue a las %s: la próxima, %d h después' % (ultima[11:16], CADA_H))
                return 0
        except ValueError:
            pass

    # 2. los miembros de todos los servidores
    s = I._sesion(_token())
    import contextlib
    with contextlib.redirect_stdout(io.StringIO()):
        mi = I.bajar_miembros(s)
    cuentas = len({d for g in mi.values() for d in g['ms']})
    if cuentas < 1000:
        print('   ⚠️ Discord devolvió %d cuentas: no busco con una lista rota' % cuentas)
        return 0
    print('   %d cuentas en %d servidores' % (cuentas, len(mi)))

    # 3. cruzar
    ctx = I.contexto(mi, {}, como_inscripciones(hist), menciones_de_llaves())
    sinr = I.buscar(ctx)
    cands = candidatos(sinr, hechos)
    niveles = {}
    for r in sinr.values():
        niveles[r['nivel']] = niveles.get(r['nivel'], 0) + 1
    print('   sin ID: %d · %s' % (len(sinr), ' · '.join('%s %d' % kv for kv in sorted(niveles.items()))))
    print('   🤖 para escribir solos: %d' % len(cands))
    mem['ultima'] = ahora.isoformat(timespec='minutes')
    mem['ultimo_conteo'] = dict(niveles, sin_id=len(sinr), auto=len(cands))

    if len(cands) > FRENO:
        msg = ('🔎 autoidentificar: salieron %d IDs de golpe (el tope es %d). No escribí ninguno: eso no es el goteo '
               'de cada día. Mirar con `python herramientas/identificar.py`.' % (len(cands), FRENO))
        print('   🔴 ' + msg)
        if aplicar and not madrugada(ahora):
            try:
                import alertar
                alertar.alertar('autoidentificar_freno', msg)
            except Exception as e:                                            # noqa: BLE001
                print('   ⚠️ no pude avisar: %s' % str(e)[:60])
        _escribir(MEMORIA, mem)
        return 0

    en_lista = {PAD.norm(p['raw']): p for p in ctx['pad']}
    ids, nuevos = [], []
    for raw, r in cands[:TOPE]:
        m = r['mejor']
        c = ctx['ix']['cuenta'].get(m['id']) or {}
        por = resumen_pruebas(m)
        print('   + %-24s @%s · %s' % (raw[:24], c.get('u', '?'), por))
        if PAD.norm(raw) in en_lista:
            ids.append((raw, m['id'], por))
        else:
            nombre = PAD.limpio(raw)
            nuevos.append((nombre, pais_nuevo(r, c), m['id'], '🔎 autoidentificado %s: %s' % (ahora.strftime('%d/%m'), por)))
    if len(cands) > TOPE:
        print('   (%d más, en la próxima vuelta)' % (len(cands) - TOPE))

    import espejo_t1 as EJ
    if not aplicar or not EJ._en_github():
        if aplicar:
            print('   🔒 en una PC no se escribe la Lista: sólo GitHub ([[sheet-no-en-la-corrida]])')
        else:
            print('   (nada escrito — en el ciclo corre con --aplicar)')
        if aplicar or '--memoria' in sys.argv:
            _escribir(MEMORIA, mem)
        return 0

    hechos_ahora = []
    for raw, did, por in ids:
        try:
            if LR.poner_id(raw, did, aplicar=True):
                hechos[did] = {'n': raw, 'cuando': ahora.strftime('%d/%m/%Y %I:%M %p ET'), 'como': 'id', 'por': por}
                hechos_ahora.append(raw)
        except Exception as e:                                                # noqa: BLE001
            print('   ⚠️ %s: %s' % (raw, str(e)[:80]))
    if nuevos:
        try:
            filas = LR.agregar_varios(nuevos, aplicar=True)
            for nombre, cc, did, nota in nuevos:
                if did in filas:
                    hechos[did] = {'n': nombre, 'cuando': ahora.strftime('%d/%m/%Y %I:%M %p ET'), 'como': 'fila nueva',
                                   'por': nota.split(': ', 1)[-1], 'pais': cc}
                    hechos_ahora.append(nombre)
        except Exception as e:                                                # noqa: BLE001
            print('   ⚠️ las filas nuevas: %s' % str(e)[:80])
    _escribir(MEMORIA, mem)
    # 🌙 de 3 a 11 AM ET no se manda nada a Discord ([[madrugada-sin-ciclo]]): queda en `hechos`
    if hechos_ahora and not madrugada(ahora):
        try:
            import alertar
            alertar.normal('🔎 Identificados solos (%d): %s. Sin verificar: eso sigue siendo el Miembro de DRA.'
                           % (len(hechos_ahora), ', '.join(hechos_ahora)))
        except Exception:                                                     # noqa: BLE001
            pass
    print('   ✅ %d escritos' % len(hechos_ahora))
    return len(hechos_ahora)


def sin_miembro():
    """🔒 Las cuentas cuyo ID puso esta máquina: `autoverificar.py` no las verifica (Dlx decide eso al final)."""
    return set(((_leer(MEMORIA, {}) or {}).get('hechos') or {}).keys())


# ── self-check ──────────────────────────────────────────────────────────────────────────────────────────────────────
def _auto():
    ok = lambda c, m: (None if c else sys.exit('autoidentificar: ' + m))      # noqa: E731
    f = fila_hist({'msg_id': '1555', 'servidor': 'FFA', 'discord_id': '42', 'texto': 'Pichulamc 🇦🇷'})
    ok(f == ['1555', 'FFA', '42', 'pichulamc', 'ar'], 'fila_hist: %r' % f)
    ok(fila_hist({'msg_id': '1', 'servidor': 'FFA', 'discord_id': '42', 'texto': '¿empieza?'}) is None, 'charla')
    ok(fila_hist({'msg_id': '1', 'servidor': 'FFA', 'texto': 'Benji'}) is None, 'sin cuenta')
    h = [['10', 'FFA', '1', 'a', '']]
    n = sumar_hist(h, [{'msg_id': '10', 'servidor': 'FFA', 'discord_id': '1', 'texto': 'A'},
                       {'msg_id': '5', 'servidor': 'DDF', 'discord_id': '2', 'texto': 'Bea 🇨🇱'}])
    ok(n == 1 and [x[0] for x in h] == ['5', '10'], 'sumar_hist no repite y ordena: %r' % h)
    ok(como_inscripciones(h)[0]['texto'] == 'bea', 'como_inscripciones')
    # lo ya hecho no se vuelve a proponer, y sólo entra lo automático
    s = {'A': {'auto': True, 'mejor': {'id': '1'}}, 'B': {'auto': True, 'mejor': {'id': '2'}},
         'C': {'auto': False, 'mejor': {'id': '3'}}}
    ok([r for r, _ in candidatos(s, {'2': {}})] == ['A'], 'candidatos')
    ok(pais_nuevo({'cc': ['ar']}, {'cc': {'ar', 'cl'}}) == 'ar', 'país que coincide')
    ok(pais_nuevo({'cc': ['sn']}, {'cc': {'ar'}}) == '', 'bandera de broma: sin país')
    ok(pais_nuevo({'cc': ['ar', 'cl']}, {'cc': {'ar', 'cl'}}) == '', 'dos países: no se elige')
    m = {'pr': {'insc': [("FFA", 0, "borrado:"), ("FFA", 1, "borrado:")], 'apodo': ['a']}, 'tipos': ['insc', 'nombre', 'bandera']}
    ok(resumen_pruebas(m) == 'se anotó así 2 vez/veces + su apodo o nombre visible + la misma bandera', resumen_pruebas(m))
    import identificar as I
    I._auto()
    print('autoidentificar: self-check ok')


def main():
    if '--auto' in sys.argv:
        return _auto()
    if '--sembrar' in sys.argv:
        return sembrar()
    correr(aplicar='--aplicar' in sys.argv)


if __name__ == '__main__':
    main()
