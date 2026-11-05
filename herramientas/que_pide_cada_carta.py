# -*- coding: utf-8 -*-
"""QUE DATO NECESITA CADA TARJETA. Medido, no leido.

    python herramientas/que_pide_cada_carta.py          la tabla, y REESCRIBE el mapa
    python herramientas/que_pide_cada_carta.py --md     para pegar en un doc, y lo reescribe igual
    python herramientas/que_pide_cada_carta.py --auto   rojo si a una carta le falta un dato. No escribe
    python herramientas/que_pide_cada_carta.py --json   lo mismo, para `bot/alertar.py`. No escribe

🔴 POR QUE NO SE LEE EL CODIGO. La pregunta «que necesita cada carta» se
puede contestar leyendo los generadores, y asi es como se contesta mal: hay
campos que se piden dentro de un `if`, otros con `.get()` y un default que
esconde que faltan, y otros que una funcion intermedia pide y nunca usa.
Este proyecto ya se comio tres veces la misma forma —la decision en un lado
y el codigo leyendo otra cosa—, y el unico que la encuentra es **generar la
carta y mirar que toco**.

COMO FUNCIONA
-------------
Cada entrada del pool se envuelve en un dict que **anota cada clave que
alguien le pide**. Despues se dibuja la carta de verdad —las cuatro, con
gente de verdad— y lo que queda anotado es la respuesta.

⚠️ SE ANOTA TAMBIEN EL `.get()` CON DEFAULT, y es el caso que importa: un
`p.get('crew', '')` no falla cuando el campo no esta, asi que **el Sheet
puede no tenerlo y la carta sale igual, peor**. Esos salen marcados
`opcional` — son justo los que hay que decidir si el Sheet nuevo los trae.

⚠️ Y SE CORRE SOBRE TODAS LAS PERSONAS, no una. Konan tiene crew, pais, titulos
y racha; quien no tenga algo hace que su rama no se ejecute y ese campo no
aparece. Con una sola persona la lista sale corta y parece completa.

🔴 CON LA MUESTRA TAMBIÉN SALÍA CORTA (04/11/2026). Se dibujaban 50, las 25 de
arriba y las 25 de abajo, porque medir «costaba minutos». Cuesta ~7 s con las ~600
de hoy, sin credenciales y sin red. Y el 14/10 la muestra perdió `arc_sv` y
`pos_sv`: desde el 13/10 la Competitiva sólo se los pide a quien eligió servidor,
ninguno de esos 50 activaba esa parte y salieron del mapa. Con el código de hoy y
33 fotos de `datos/` del 15/10 al 04/11, el pool entero dio siempre lo mismo y la
muestra los perdió en dos.

QUIÉN AVISA SI EL MAPA QUEDÓ CORTO
----------------------------------
`--auto`, en CI: rojo si una carta pide un dato que el mapa no tiene. Si sigue
faltando a las 24 h, `bot/alertar.py` le manda un DM a Dlx (`mapa_corto()`).

🔴 NINGUNO DE LOS DOS ESCRIBE EL MAPA, A PROPÓSITO. Sumarle o sacarle un campo a una
carta le cambia la parte de datos del sello a todas las suyas, y la próxima vuelta
las redibuja: el 04/11/2026 fueron las 222 Competitivas, por dos datos que se ven en
14 de ellas y uno que nadie del pool tiene. Cuándo se paga eso lo decide Dlx, y lo
corre una sesión a mano. Antes de escribir, esto dice qué entra, qué sale y cuánto cuesta.
"""
import importlib.util
import io
import json
import os
import sys
import time
from collections import defaultdict

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, BASE)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

CARTAS = ('Temporada', 'Competitiva', 'Servidor', 'Pais')
MAPA = os.path.join(BASE, 'datos', 'campos_por_carta.json')
VISTO = defaultdict(lambda: defaultdict(set))    # carta -> clave -> {'dura'|'opcional'}
DIBUJADAS = defaultdict(lambda: {'n': 0, 'mal': 0, 'error': ''})    # carta -> cuántas, cuántas reventaron y la primera
_CARTA = [None]


class Espia(dict):
    """Un dict que anota quien le pide que."""

    def __getitem__(self, k):
        if _CARTA[0]:
            VISTO[_CARTA[0]][k].add('dura')
        return dict.__getitem__(self, k)

    def get(self, k, *a):
        if _CARTA[0]:
            # ⚠️ `get(k)` sin default tambien es opcional: devuelve None y
            # no revienta. Lo que lo hace duro es `p[k]`.
            VISTO[_CARTA[0]][k].add('opcional')
        return dict.get(self, k, *a)

    def __contains__(self, k):
        if _CARTA[0]:
            VISTO[_CARTA[0]][k].add('opcional')
        return dict.__contains__(self, k)


def pool(nombre):
    with io.open(os.path.join(BASE, 'datos', nombre), encoding='utf-8') as f:
        return [Espia(x) for x in json.load(f)]


def cargar(carpeta, archivo, nombre_mod):
    antes = os.getcwd()
    os.chdir(os.path.join(BASE, carpeta))
    try:
        spec = importlib.util.spec_from_file_location(nombre_mod, archivo)
        m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(m)
        return m
    finally:
        os.chdir(antes)


def _dibujar(f, *a):
    """Dibuja una y anota cómo le fue.

    🔴 ERA `except: pass`, Y UNA CARTA QUE REVIENTA PIDE MENOS. Reventada para todos,
    deja un mapa corto que parece completo: la carta pierde esos campos, le cambian
    todos los sellos y queda ciega justo a esos datos, sin un solo error.
    """
    d = DIBUJADAS[_CARTA[0]]
    d['n'] += 1
    try:
        f(*a)
    except Exception as e:                       # noqa: BLE001
        d['mal'] += 1
        d['error'] = d['error'] or '%s: %s' % (type(e).__name__, str(e)[:70])


def temporada():
    _CARTA[0] = 'Temporada'
    m = cargar('01_Temporada', 'normal_v3.py', 'nv3')
    for p in pool('temporada_pool.json'):
        _dibujar(m.card, p)


def competitivo():
    _CARTA[0] = 'Competitiva'
    m = cargar(os.path.join('02_Competitivo', 'v2'), 'gencomp.py', 'gc')
    for i, p in enumerate(pool('competitivo_pool.json')):
        _dibujar(m.card, p, i)


# 🔴 SERVIDOR Y PAIS NO RECIBEN EL POOL: LO LEEN ELLOS. Su `fila(p)` toma
# un dict **ya transformado** por `cargar()`, cuyos campos son derivados y
# no existen en el Sheet. Pasarle el pool crudo a `fila()` da un campo y
# parece que la carta no necesita nada — me pasó en la primera corrida.
#
# Lo que hay que espiar es la puerta por donde entra el pool: `_j()`.
def _por_la_puerta(carpeta, archivo, mod, etq):
    _CARTA[0] = etq
    g = cargar(carpeta, archivo, mod)
    viejo = g._j

    def espiado(nombre, *a, **k):
        out = viejo(nombre, *a, **k)
        if isinstance(out, list):
            return [Espia(x) if isinstance(x, dict) else x for x in out]
        return out

    g._j = espiado
    antes = os.getcwd()
    os.chdir(os.path.join(BASE, carpeta))
    try:
        gente = g.cargar()
    finally:
        os.chdir(antes)
        g._j = viejo
    # y la tupla, por si pide algo que `cargar()` no tocó
    for p in gente:
        _dibujar(g.fila, p)
    return gente


def servidor():
    _por_la_puerta('03_Servidor', 'generar.py', 'svg', 'Servidor')


def pais():
    _por_la_puerta('04_Pais', 'generar.py', 'pag', 'Pais')


def pools_vacios():
    """Los pools sin nadie, o que no se pudieron leer."""
    vacios = []
    for n in ('temporada_pool.json', 'competitivo_pool.json'):
        try:
            with io.open(os.path.join(BASE, 'datos', n), encoding='utf-8') as f:
                if not json.load(f):
                    vacios.append(n)
        except (OSError, ValueError):
            vacios.append(n + ' (no se pudo leer)')
    return vacios


def medir():
    """Dibuja las cuatro con el espía. Devuelve {carta: por qué no se pudo medir}. No escribe nada."""
    rotas = {}
    for c, f in zip(CARTAS, (temporada, competitivo, servidor, pais)):
        try:
            f()
        except Exception as e:                   # noqa: BLE001
            rotas[c] = '%s: %s' % (type(e).__name__, str(e)[:70])
            print('   ⚠️ %s: %s' % (f.__name__, rotas[c]))
    _CARTA[0] = None
    # 🔴 «NO PIDIÓ NADA» SÓLO ES UN FALLO SI HABÍA POOL. La Servidor y la de País dibujan también a los de fuera del pool, así
    # que con los dos en 0 corren enteras sin pasar por el espía. Eso es un estado: «0 de 0» no es «0 %»
    hay_pool = len(pools_vacios()) < 2
    for c in CARTAS:
        d = DIBUJADAS[c]
        if c in rotas or not d['n']:
            continue
        if d['mal'] == d['n']:
            rotas[c] = d['error']
        elif hay_pool and not VISTO[c]:
            rotas[c] = 'no pidió ni un campo, teniendo pool'
    return rotas


def leer_mapa():
    try:
        with io.open(MAPA, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def comparar(medido, mapa):
    """(faltan, sobran), por carta y sólo de las que se midieron.

    ⚠️ NO PESAN IGUAL. Lo que falta no dispara nada: su carta se queda vieja en silencio,
    y por eso da rojo. Lo que sobra sólo vigila de más: redibuja cuando no hacía falta.
    """
    faltan, sobran = {}, {}
    for c, campos in medido.items():
        pide, tiene = set(campos), set(mapa.get(c) or ())
        if pide - tiene:
            faltan[c] = sorted(pide - tiene)
        if tiene - pide:
            sobran[c] = sorted(tiene - pide)
    return faltan, sobran


def se_perderian(mapa, rotas, dibujadas):
    """Las cartas que el mapa conoce y esta corrida no pudo medir: escribirlo las dejaría sin campos.

    🔴 Y UNA CARTA SIN CAMPOS LE CAMBIA EL SELLO A TODAS LAS SUYAS Y NO VUELVE A VER NADA. Hasta el 04/11/2026
    bastaba con que otra carta pidiera algo para escribir igual.
    """
    return sorted(c for c, campos in mapa.items() if campos and (c in rotas or not dibujadas.get(c, {}).get('n')))


def precio():
    """{carta: cuántas tiene selladas}: las que redibuja la próxima vuelta si se le suma o se le saca un campo.

    ⚠️ Un campo más es una línea más en el hash de cada persona, aunque a ella no le cambie un píxel
    (`que_cambio.huellas()`). Medido el 04/11/2026: 222 selladas, 222 redibujadas.
    """
    # ⚠️ RECIÉN ACÁ, DESPUÉS DE DIBUJAR: con `bot/` en el path antes de cargar las cartas, un módulo suyo podría tapar a otro
    sys.path.insert(0, os.path.join(BASE, 'bot'))
    import que_cambio as QC
    try:
        with io.open(QC.SELLO, encoding='utf-8') as f:
            sello = (json.load(f) or {}).get('cartas') or {}
    except (OSError, ValueError):
        sello = {}
    return {c: sum(1 for v in sello.values() if r2 in v) for c, r2 in QC.COMO_R2.items()}


def informe():
    """La medición de hoy contra el mapa. No escribe nada: lo leen `--auto` y `bot/alertar.py`."""
    rotas = medir()
    mapa = leer_mapa()
    cartas = mapa.get('cartas') or {}
    if not cartas:
        rotas['mapa'] = 'falta datos/campos_por_carta.json'
    medido = {c: VISTO[c] for c in CARTAS if VISTO[c] and c not in rotas}
    faltan, sobran = comparar(medido, cartas)
    return {'medido': mapa.get('medido', '?'), 'faltan': faltan, 'sobran': sobran, 'rotas': rotas, 'precio': precio()}


def _casos():
    """Lo que tiene que valer siempre, sin dibujar nada. Cuántos dieron mal."""
    mal = []

    def ok(cond, que):
        print('   %s %s' % ('✅' if cond else '🔴', que))
        if not cond:
            mal.append(que)

    f, s = comparar({'A': ['x', 'y']}, {'A': ['x']})
    ok(f == {'A': ['y']} and not s, 'lo que la carta pide y el mapa no tiene, falta')
    f, s = comparar({'A': ['x']}, {'A': ['x', 'y']})
    ok(not f and s == {'A': ['y']}, 'lo que el mapa tiene de más no falta: sólo sobra')
    f, s = comparar({}, {'A': ['x']})
    ok(not f and not s, 'una carta que no se midió no se compara')
    ok(se_perderian({'A': {'x': []}, 'B': {'y': []}}, {'A': 'reventó'}, {'A': {'n': 3}, 'B': {'n': 3}}) == ['A'],
       'no se escribe si una carta reventó')
    ok(se_perderian({'A': {'x': []}}, {}, {'A': {'n': 0}}) == ['A'], 'ni si se quedó sin gente')
    ok(not se_perderian({'A': {'x': []}}, {}, {'A': {'n': 3}}), 'medida entera, sí')
    _CARTA[0] = '_caso'
    e = Espia({'a': 1})
    _ = e['a'], e.get('b'), 'c' in e
    _CARTA[0] = None
    v = VISTO.pop('_caso')
    ok(v == {'a': {'dura'}, 'b': {'opcional'}, 'c': {'opcional'}}, 'el espía anota `p[k]` como dura, y `.get()` e `in` como opcional')
    d = DIBUJADAS['_caso']
    _CARTA[0] = '_caso'
    _dibujar(lambda: {}['x'])
    _dibujar(lambda: None)
    _CARTA[0] = None
    DIBUJADAS.pop('_caso')
    ok(d['n'] == 2 and d['mal'] == 1 and d['error'].startswith('KeyError'), 'una carta que revienta se cuenta, y sigue con la próxima')
    return len(mal)


def _auto():
    """🔴 EL AVISO EN CI: rojo si una carta pide un dato que el mapa no tiene. No escribe ni redibuja nada.

    ⚠️ NO COMPARA HUELLAS DE CÓDIGO. `que_cambio.mapa_viejo()` se prendió el 19/10/2026 y siguió igual hasta el 04/11, en
    los 14 commits que tocaron código de cartas, y sólo uno sumó un campo. Una alarma siempre prendida no se mira.
    """
    print('\n══ LO QUE LAS CARTAS PIDEN Y EL MAPA NO TIENE ══\n')
    mal = _casos()
    t0 = time.time()
    inf = informe()
    print('')
    for c in CARTAS:
        d = DIBUJADAS[c]
        print('   %-12s %2d datos · %d dibujadas' % (c, len(VISTO[c]), d['n']))
        # ⚠️ NO ES ROJO: el resto de la carta se midió igual, y esa persona ya va a reventar al dibujarla de verdad
        if d['mal'] and c not in inf['rotas']:
            print('      ⚠️ a %d de %d les revienta (%s)' % (d['mal'], d['n'], d['error']))
    print('   medido en %.1f s\n' % (time.time() - t0))
    for c, por in sorted(inf['rotas'].items()):
        print('   🔴 %s no se pudo medir: %s' % (c, por))
    for c in CARTAS:
        ks = inf['faltan'].get(c)
        if ks:
            print('   🔴 %s pide %d que el mapa no tiene: %s' % (c, len(ks), ', '.join(ks)))
            print('      Si cambian, esa carta no se redibuja y nadie se entera.')
            print('      Arreglarlo redibuja una vez las %d que tiene selladas.' % inf['precio'].get(c, 0))
            # 🔎 el `for` de CI lo guarda en un grupo plegado: así también sale arriba de la corrida
            if os.environ.get('GITHUB_ACTIONS'):
                print('::error::%s pide datos que campos_por_carta.json no tiene: %s' % (c, ', '.join(ks)))
    if inf['faltan']:
        print('\n   Se arregla con `python herramientas/que_pide_cada_carta.py`, a mano y con el OK de Dlx.')
        print('   Si se deja para después, esto sigue en rojo hasta entonces.')
    for c, ks in sorted(inf['sobran'].items()):
        print('   ⚠️ %s ya no pide: %s. Vigila de más y no da rojo; sacarlo también la redibuja.' % (c, ', '.join(ks)))
    if not any(VISTO[c] for c in CARTAS) and not inf['rotas']:
        # un pool vacío es un estado, no un fallo: ver `medir()` y el `if not todas` de `main()`
        print('   ⚠️ no hay a quien dibujar: con los pools en 0 no hay con qué medir.')
    elif not (inf['faltan'] or inf['rotas']):
        print('   ✅ el mapa del %s tiene todo lo que piden' % inf['medido'])
    print('')
    return 1 if (mal or inf['faltan'] or inf['rotas']) else 0


def main():
    if '--auto' in sys.argv:
        return _auto()
    if '--json' in sys.argv:
        # ⚠️ LA ÚLTIMA LÍNEA, Y LO DE ANTES NO VALE: `gencomp.py` imprime al importarse
        inf = informe()
        print(json.dumps({k: inf[k] for k in ('faltan', 'sobran', 'rotas', 'precio')}, ensure_ascii=False))
        return 0
    rotas = medir()

    cartas = list(CARTAS)
    todas = sorted({k for c in cartas for k in VISTO[c]})
    if not todas:
        # 🔴 LA CAUSA CASI SIEMPRE NO ES LA QUE DECIA ESTE MENSAJE. Se
        # leia «los generadores no llegaron a dibujar», que suena a que
        # reventaron —y si revientan, el `except` de arriba ya imprimio
        # cual y por que—. Lo normal es que **no haya a quien dibujar**:
        # con los pools en 0, las cuatro cartas corren enteras, no piden
        # ni un campo y salen sin error.
        #
        # ⚠️ IMPORTA PORQUE MANDA A ARREGLAR OTRA COSA. `que_cambio.py`
        # avisaba que el mapa estaba viejo y decia «regeneralo»; si al hacerlo
        # sale un mensaje que culpa a los generadores, lo que sigue es
        # revisar generadores que estan bien. Con los pools vacios no hay
        # nada que regenerar y hay que esperar a que la T1 tenga datos.
        vacios = pools_vacios()
        if vacios:
            print('\n   ⚠️ no hay a quien dibujar: %s en 0.' % ' y '.join(vacios))
            print('      No es un fallo de los generadores — el mapa NO se')
            print('      puede volver a medir hasta que la T1 tenga datos, y')
            print('      el que hay en disco queda como esta.\n')
            return 2
        print('\n   🔴 los generadores corrieron y no pidieron ni un campo,')
        print('      teniendo pool. Eso si es un fallo suyo.\n')
        return 1

    viejo = leer_mapa().get('cartas') or {}
    perdidas = se_perderian(viejo, rotas, DIBUJADAS)
    if perdidas:
        print('\n   🔴 no escribo el mapa: %s no se pudo medir (%s).' % (
            ' y '.join(perdidas), '; '.join(rotas.get(c, 'sin gente') for c in perdidas)))
        print('      Quedaría sin campos y se redibujarían todas sus cartas.\n')
        return 1

    md = '--md' in sys.argv
    print('\n══ QUE CAMPO DEL POOL PIDE CADA CARTA ══\n')
    sep = ' | ' if md else '  '
    enc = '%-14s' % 'campo' + sep + sep.join('%-12s' % c for c in cartas)
    print('   ' + enc)
    if md:
        print('   ' + '|'.join(['---'] * 5))
    else:
        print('   ' + '-' * len(enc))
    for k in todas:
        fila = ['%-14s' % k]
        for c in cartas:
            tipos = VISTO[c].get(k)
            if not tipos:
                m = ''
            elif 'dura' in tipos:
                m = '● obligatoria'
            else:
                m = '○ opcional'
            fila.append('%-12s' % m)
        print('   ' + sep.join(fila))

    print('\n   ● la pide con `p[campo]`: si falta, la carta revienta')
    print('   ○ la pide con `.get()`: si falta, sale una carta peor **sin avisar**')

    # 🔴 ANTES DE ESCRIBIR, LO QUE VA A PASAR. El 04/11/2026 este mapa le sumó tres campos a la
    # Competitiva sin que nadie los mirara, y se redibujaron las 222 cuando a Dlx le habíamos dicho
    # que esa carta no se tocaba. Sólo pasa al pushearlo: hay tiempo de decírselo.
    entran, salen = comparar({c: VISTO[c] for c in cartas}, viejo)
    plata = precio()
    print('\n   Lo que hace este mapa cuando se pushee:')
    if not (entran or salen):
        print('   los campos no cambian: no se redibuja nada')
    for c in cartas:
        if entran.get(c) or salen.get(c):
            print('   🔴 %-12s entran: %s · salen: %s' % (
                c, ', '.join(entran.get(c) or ['—']), ', '.join(salen.get(c) or ['—'])))
            print('      la próxima vuelta redibuja una vez las %d que tiene selladas' % plata.get(c, 0))

    # ⚠️ SE GUARDA PORQUE EL SELLO SE ARMA CON ESTO, no porque medir sea caro.
    # `bot/que_cambio.py` la usa para decidir qué carta quedó vieja cuando un
    # campo del pool se movió: si cambió `pts`, la Temporada y nada más.
    #
    # ⚠️ Es una CACHE, no una fuente: se regenera corriendo esto. Por eso
    # lleva la fecha adentro — una cache sin fecha no se distingue de un
    # dato, y este repo ya tiene tres casos de eso.
    # 🔴 Y LA HUELLA DEL CODIGO CON QUE SE MIDIO, QUE ES LO QUE DEJA
    # SABER SI QUEDO VIEJA. `que_cambio.mapa_viejo()` contestaba eso
    # comparando **mtime**, y un `git checkout` le pone a todos los
    # archivos la hora del checkout: en Actions —que es donde corre el
    # ciclo— la comparacion no detectaba nada, nunca. La huella viaja
    # dentro del JSON, asi que sobrevive al clone.
    import io as _io
    import json as _json
    from datetime import date as _date
    from comun import huella_codigo as _hc
    dest = os.path.join(BASE, 'datos', 'campos_por_carta.json')
    with _io.open(dest, 'w', encoding='utf-8') as f:
        _json.dump({'medido': _date.today().isoformat(),
                    'como': 'herramientas/que_pide_cada_carta.py',
                    'codigo': _hc.todas(),
                    'cartas': {c: {k: sorted(v) for k, v in VISTO[c].items()}
                               for c in cartas}},
                   f, ensure_ascii=False, indent=1, sort_keys=True)
    print('\n   -> %s' % os.path.relpath(dest, BASE))
    print('')
    for c in cartas:
        duras = sorted(k for k, t in VISTO[c].items() if 'dura' in t)
        opc = sorted(k for k, t in VISTO[c].items() if 'dura' not in t)
        print('   %-12s %2d obligatorias · %2d opcionales' % (c, len(duras), len(opc)))
    print('')
    return 0


if __name__ == '__main__':
    sys.exit(main())
