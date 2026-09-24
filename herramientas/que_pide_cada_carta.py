# -*- coding: utf-8 -*-
"""QUE DATO NECESITA CADA TARJETA. Medido, no leido.

    python herramientas/que_pide_cada_carta.py          la tabla
    python herramientas/que_pide_cada_carta.py --md     para pegar en un doc

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

⚠️ Y SE CORRE SOBRE VARIAS PERSONAS, no una. Konan tiene crew, pais, titulos
y racha; quien no tenga algo hace que su rama no se ejecute y ese campo no
aparece. Con una sola persona la lista sale corta y parece completa.
"""
import importlib.util
import io
import json
import os
import sys
from collections import defaultdict

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, BASE)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

VISTO = defaultdict(lambda: defaultdict(set))    # carta -> clave -> {'dura'|'opcional'}
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


# ── cuantas personas se dibujan de cada carta ──
# ⚠️ No una: ver el encabezado. Se toman las primeras N del pool, que ya
# vienen ordenadas por puesto, mas unas cuantas del final — los de arriba
# tienen todo y los de abajo tienen huecos, y los huecos son los que
# activan las ramas con `.get()`.
N = 25


def muestra(xs):
    return xs[:N] + xs[-N:]


def temporada():
    _CARTA[0] = 'Temporada'
    m = cargar('01_Temporada', 'normal_v3.py', 'nv3')
    for p in muestra(pool('temporada_pool.json')):
        try:
            m.card(p)
        except Exception:                        # noqa: BLE001
            pass


def competitivo():
    _CARTA[0] = 'Competitiva'
    m = cargar(os.path.join('02_Competitivo', 'v2'), 'gencomp.py', 'gc')
    for i, p in enumerate(muestra(pool('competitivo_pool.json'))):
        try:
            m.card(p, i)
        except Exception:                        # noqa: BLE001
            pass


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
    for p in muestra(gente):
        try:
            g.fila(p)
        except Exception:                        # noqa: BLE001
            pass
    return gente


def servidor():
    _por_la_puerta('03_Servidor', 'generar.py', 'svg', 'Servidor')


def pais():
    _por_la_puerta('04_Pais', 'generar.py', 'pag', 'Pais')


def main():
    for f in (temporada, competitivo, servidor, pais):
        try:
            f()
        except Exception as e:                   # noqa: BLE001
            print('   ⚠️ %s: %s' % (f.__name__, str(e)[:70]))
    _CARTA[0] = None

    cartas = ['Temporada', 'Competitiva', 'Servidor', 'Pais']
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
        # avisa que el mapa esta viejo y dice «regeneralo»; si al hacerlo
        # sale un mensaje que culpa a los generadores, lo que sigue es
        # revisar generadores que estan bien. Con los pools vacios no hay
        # nada que regenerar y hay que esperar a que la T1 tenga datos.
        vacios = []
        for n in ('temporada_pool.json', 'competitivo_pool.json'):
            try:
                with io.open(os.path.join(BASE, 'datos', n),
                             encoding='utf-8') as f:
                    if not json.load(f):
                        vacios.append(n)
            except (OSError, ValueError):
                vacios.append(n + ' (no se pudo leer)')
        if vacios:
            print('\n   ⚠️ no hay a quien dibujar: %s en 0.' % ' y '.join(vacios))
            print('      No es un fallo de los generadores — el mapa NO se')
            print('      puede volver a medir hasta que la T1 tenga datos, y')
            print('      el que hay en disco queda como esta.\n')
            return 2
        print('\n   🔴 los generadores corrieron y no pidieron ni un campo,')
        print('      teniendo pool. Eso si es un fallo suyo.\n')
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

    # ⚠️ SE GUARDA PARA QUE OTROS NO TENGAN QUE VOLVER A MEDIRLO. Medir
    # cuesta dibujar las cuatro cartas —minutos— y la respuesta sólo cambia
    # cuando cambia un generador. `bot/que_cambio.py` la usa para decidir
    # qué carta quedó vieja cuando un campo del pool se movió: si cambió
    # `pts`, la Temporada y nada más.
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
