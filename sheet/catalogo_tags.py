# -*- coding: utf-8 -*-
"""🏷️ EL CATÁLOGO DE LOS TAGS — cuáles hay en cada tarjeta, qué pide cada uno y cuál tiene cada persona.

    python sheet/catalogo_tags.py          cuántos tienen cada TAG hoy, sobre `datos/`
    python sheet/catalogo_tags.py --auto   el self-check: el catálogo contra las cuatro cascadas de verdad

Dlx, 19/10/2026, a «un catálogo de TAGs en la Guía: hoy sólo viven en el código; una lista con cada TAG, qué pide y
cuáles tenés vos los convierte en algo para coleccionar»: *«me gusta todo»*. Lo muestra la Guía (`web/src/guia.jsx`);
viaja en el payload (`subir_web._tags()`).

🔑 LA CASCADA MANDA, EL CATÁLOGO LA DESCRIBE. Los TAGs viven en cada carta (`01_Temporada/normal_v3.tag()`,
`02_Competitivo/v2/gencomp.TAG()`, `comun/titulos.elegir()` y `04_Pais/maqueta.tag()`); acá está sólo lo que se le
cuenta a la gente. ⚠️ Y PARA QUE NO SE DESPEGUEN, EL SELF-CHECK LEE LAS CUATRO CASCADAS CON `ast` y compara: un TAG
nuevo sin su línea acá, o una línea de un TAG que ya no existe, pone CI en rojo. Es la regla de «un default que no es la
decisión es un bug que no avisa», aplicada a un texto.

⚠️ EN EL ORDEN DE LA CASCADA: el primero que se cumple gana, así que el orden también le dice a la gente cuál pesa más.
"""
import ast
import collections
import io
import json
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _p in (RAIZ, os.path.join(RAIZ, 'bot'), os.path.dirname(os.path.abspath(__file__))):
    if _p not in sys.path:
        sys.path.insert(0, _p)

#: los niveles, como los dibujan las cartas: t1 dorado, t2 púrpura, t3 azul, t4 gris
NIVELES = {'t1': 'Legendario', 't2': 'Épico', 't3': 'Raro', 't4': 'Común'}

#: `{carta: [(TAG, nivel, qué pide)]}`, en el orden de su cascada. `%d` es un número que cambia («x3», «DE 25»)
CATALOGO = {
    'temporada': [
        ('👑 DINASTÍA', 't1', 'Ganar 20 eventos en la temporada.'),
        ('💀 REGICIDA', 't1', 'Cazar a El Rey del Most Wanted.'),
        ('🛡️ INTOCABLE', 't1', 'Que te busquen en el Most Wanted y sobrevivir.'),
        ('🗺️ CONQUISTADOR', 't1', 'Salir campeón en 2 servidores distintos.'),
        ('💯 BICENTENARIO', 't1', '200.000 puntos en la temporada.'),
        ('⭐ DECACAMPEÓN', 't1', 'Ganar 10 eventos.'),
        ('🎯 CAZADOR CAZADO', 't1', 'Cazar a alguien en el Most Wanted y que también te cacen.'),
        ('🔥 EN LLAMAS', 't1', 'Una racha de 7 o más (si tu Servidor ya lo dice, acá va otro).'),
        ('📋 SEMANA PERFECTA x%d', 't1', 'Completar las Misiones de 2 semanas o más.'),
        ('🎯 CAZARRECOMPENSAS', 't2', 'Entre cazas y precios por cabeza cobrados, 2 o más.'),
        ('🏃 FUGITIVO', 't2', 'Que te busquen 2 veces o más y que nunca te cacen.'),
        ('📜 SE BUSCA', 't2', 'Estar suelto en el Most Wanted de esta semana.'),
        ('💰 CABEZA CON PRECIO', 't2', 'Que alguien ponga precio por tu cabeza.'),
        ('🐺 LOBO SOLITARIO', 't2', 'Cazar a un buscado sin ayuda.'),
        ('💯 CENTENARIO', 't2', '100.000 puntos en la temporada.'),
        ('⭐ PENTACAMPEÓN', 't2', 'Ganar 5 eventos.'),
        ('⚡ RELÁMPAGO', 't2', 'Ganar 2 eventos en la misma semana.'),
        ('🗳️ FAVORITO DEL PÚBLICO', 't2', 'Que el público te vote ganador 5 veces en el bot en vivo.'),
        ('💎 CREW DE ÉLITE', 't2', 'Estar en una crew de Diamante o más.'),
        ('🚪 DEBUT CON CORONA', 't2', 'Ganar tu primer evento.'),
        ('🐦‍🔥 FÉNIX', 't2', 'Que te revivan en una llave y llegar a la final.'),
        ('🥈 SIEMPRE EN LA FINAL', 't2', '3 segundos puestos o más, con 1 título como mucho.'),
        ('📆 PODIO CADA SEMANA', 't2', 'Podio en todas las semanas que ya terminaron.'),
        ('🚀 COHETE', 't2', 'Subir 20 puestos o más desde el lunes.'),
        ('⚡ MARATONISTA', 't2', '5 días con 2 eventos o más.'),
        ('🔺 REY DE LOS TRÍOS', 't2', 'Ganar 5 batallas de a tres.'),
        ('🏁 SEMIFINALISTA SERIAL', 't2', 'Llegar a 5 semifinales.'),
        ('🌱 PROMESA', 't2', 'Hacer podio en tus primeros 14 días.'),
        ('📋 SEMANA PERFECTA', 't2', 'Completar las Misiones de una semana.'),
        ('🌍 TROTAMUNDOS', 't3', 'Jugar en 4 servidores o más.'),
        ('👥 FUNDADOR DE CREW', 't3', 'Armar tu crew y que pase su primera semana.'),
        ('🧟 RESUCITADO', 't3', 'Que te revivan en una llave.'),
        ('👑 CAMPEÓN x%d', 't3', 'Ganar un evento (si tu Servidor ya dice 🏆 CAMPEÓN, acá va otro).'),
        ('📈 EN ASCENSO', 't3', 'Subir de división.'),
        ('🎖️ CURTIDO', 't3', 'Jugar 20 eventos.'),
        ('📅 INFALTABLE', 't3', 'Jugar todas las semanas que ya terminaron.'),
        ('🧳 VIAJERO', 't3', 'Jugar en 3 servidores.'),
        ('🥉 AL PODIO', 't3', 'Hacer un podio.'),
        ('🔟 DOBLE DÍGITO', 't4', 'Jugar 10 eventos.'),
        ('🆕 DEBUTANTE', 't4', 'Haber debutado hace 14 días o menos.'),
        ('🎤 COMPETIDOR', 't4', 'El de todos los que juegan.'),
    ],
    'competitivo': [
        ('🏆 #1 COMPETITIVO', 't1', 'Ser el #1 del Competitivo.'),
        ('🥇 TOP 3', 't1', 'Estar en el top 3 del Competitivo.'),
        ('🧊 SANGRE FRÍA', 't1', 'Ganar 3 finales o más, y 3 de cada 4.'),
        ('⭐ TOP 10', 't1', 'Estar en el top 10 del Competitivo.'),
        ('🗡️ MATAGIGANTES', 't2', 'Ganarle un duelo a alguien con dos letras más que tú.'),
        ('🎯 FRANCOTIRADOR', 't2', 'Ganar el 65 % de tus duelos, con 15 o más jugados.'),
        ('😈 BESTIA NEGRA', 't2', 'Ganarle 3 veces al mismo rival sin perder nunca.'),
        ('🔁 VENGADOR', 't2', 'Perder con alguien y después ganarle (2 veces).'),
        ('🤜 CLÁSICO', 't2', 'Cruzarte 4 veces o más con el mismo rival.'),
        ('🥈 A UN PASO', 't2', 'Perder 3 finales o más, con 1 ganada como mucho.'),
        ('⚔️ DUELISTA', 't2', '10 duelos ganados, contra 8 rivales distintos (si tu Servidor ya lo dice, acá va otro).'),
        ('🎯 COMPLETO', 't2', 'Las cinco dimensiones en 20 o más.'),
        ('🧭 REGULAR', 't3', 'Tu mejor dimensión es la Constancia, con 50 o más.'),
        ('⚡ EFICIENTE', 't3', 'Tu mejor dimensión es la Eficiencia, con 40 o más.'),
        ('🌐 TODOTERRENO', 't3', 'Tu mejor dimensión es la Diversidad, con 40 o más.'),
        ('👊 DOMINADOR', 't3', 'Tu mejor dimensión es el Dominio, con 40 o más.'),
        ('🔥 RACHERO', 't3', 'Tu mejor dimensión es la Racha, con 40 o más.'),
        ('🤝 SIN MIEDO', 't3', 'Enfrentar a 14 rivales distintos.'),
        ('🎟️ RECIÉN CLASIFICADO', 't4', 'Entrar al Competitivo (11 eventos o menos).'),
        ('🎤 CLASIFICADO', 't4', 'El de todos los del Competitivo.'),
    ],
    'servidor': [
        ('🧳 VISITANTE ILUSTRE', 't3', 'En la carta de un servidor que no es el tuyo, con podio ahí.'),
        ('🎟️ DE VISITA', 't4', 'En la carta de un servidor que no es el tuyo.'),
        ('👑 DUEÑO DE CASA', 't1', 'Ser el #1 de tu servidor (con 3 o más).'),
        ('🏰 FORTALEZA', 't1', 'Ganar 3 eventos en tu servidor.'),
        ('⭐ TOP DEL SERVIDOR', 't1', 'Estar en el 10 % de arriba de tu servidor.'),
        ('🪓 VERDUGO DEL DUEÑO', 't1', 'Ganarle al #1 de tu servidor.'),
        ('🛡️ INVICTO EN CASA', 't1', '3 duelos o más en tu servidor, todos ganados.'),
        ('🔥 EN LLAMAS', 't2', 'Una racha de 3 o más en tu servidor.'),
        ('🏟️ FINALISTA DE CASA', 't2', 'Llegar a 3 finales en tu servidor.'),
        ('⚔️ DUELISTA', 't2', '8 duelos o más en tu servidor, con el 65 % ganados.'),
        ('🏛️ PILAR', 't2', 'Jugar 15 eventos en tu servidor.'),
        ('🔑 LLAVE DE LA CASA', 't2', 'Jugar la mitad o más de los eventos de tu servidor.'),
        ('📜 BUSCADO EN CASA', 't2', 'Ser el Dueño de Casa del Most Wanted.'),
        ('🏆 CAMPEÓN', 't2', 'Ganar un evento en tu servidor.'),
        ('🧱 FUNDADOR', 't3', 'Haber jugado el primer evento de tu servidor.'),
        ('🏅 PODIOS', 't3', '2 podios en tu servidor.'),
        ('📆 HABITUÉ', 't3', 'Jugar 5 eventos en tu servidor.'),
        ('🌱 RECIÉN LLEGADO', 't4', 'Tu primer evento en ese servidor fue hace 7 días o menos.'),
        ('🎤 DE LA CASA', 't4', 'El de todos los de ese servidor.'),
    ],
    'pais': [
        ('INMORTAL', 't1', '3 títulos mundiales (desde la T2).'),
        ('LEYENDA MUNDIAL', 't1', '2 títulos mundiales (desde la T2).'),
        ('DOBLE CORONA', 't1', 'Campeón mundial y nacional (desde la T2).'),
        ('CAMPEÓN DEL MUNDO', 't1', 'Un título mundial (desde la T2).'),
        ('DINASTÍA NACIONAL', 't1', '3 títulos nacionales (desde la T2).'),
        ('BICAMPEÓN NACIONAL', 't1', '2 títulos nacionales (desde la T2).'),
        ('REY DE SU PAÍS', 't1', 'Campeón nacional y #1 de tu país (desde la T2).'),
        ('CAMPEÓN NACIONAL', 't1', 'Un título nacional (desde la T2).'),
        ('EL MEJOR DE %d', 't1', 'Ser el #1 de tu país, con 20 o más.'),
        ('ORGULLO NACIONAL', 't1', 'Ser el único campeón de tu país en la temporada.'),
        ('PRIMER CAMPEÓN', 't1', 'Ser el primero de tu país en salir campeón en la temporada.'),
        ('INTRATABLE', 't1', 'Ser el #1 de tu país con el 70 % de duelos ganados.'),
        ('Nº1 DEL PAÍS', 't1', 'Ser el #1 de tu país.'),
        ('INVICTO NACIONAL', 't1', '3 duelos o más contra compatriotas, todos ganados.'),
        ('PODIO Y PUNTERÍA', 't2', 'Ser #2 o #3 de tu país con el 65 % de duelos ganados.'),
        ('PODIO NACIONAL', 't2', 'Ser #2 o #3 de tu país.'),
        ('REY DEL DERBI', 't2', 'Ganar 5 duelos contra compatriotas.'),
        ('CONQUISTA AFUERA', 't2', 'Ganar 15 duelos contra rivales de otros países.'),
        ('SIN FRONTERAS', 't2', 'Enfrentar a rivales de 7 países.'),
        ('INTERNACIONAL', 't2', 'Ganarle a rivales de 5 países.'),
        ('EMBAJADOR', 't2', 'Jugar en 4 servidores o más.'),
        ('PIONERO', 't2', 'Ser el primero de tu país en debutar en la temporada.'),
        ('MEJOR AFUERA', 't2', 'Ganar 10 % más contra otros países que contra compatriotas.'),
        ('FUERTE EN CASA', 't2', 'Ganar 10 % más contra compatriotas que contra otros países.'),
        ('TITULAR FIJO', 't2', 'Estar en el 25 % de arriba de tu país con el 60 % de duelos ganados.'),
        ('GANA AFUERA', 't2', 'El 65 % de duelos ganados, con 25 eventos.'),
        ('BANDERA VIVA', 't2', '20 podios.'),
        ('EN RACHA', 't2', 'Una racha de 8 o más.'),
        ('KILÓMETROS', 't2', 'Jugar 40 eventos.'),
        ('SELECCIONABLE', 't3', 'Estar en el 25 % de arriba de tu país.'),
        ('MEDIA TABLA', 't3', 'Estar en la mitad de arriba de tu país.'),
        ('DA LA CARA', 't3', 'Jugar 12 eventos.'),
        ('SIN RANKING', 't4', 'Todavía sin puesto en tu país.'),
        ('REPRESENTANTE', 't4', 'El de todos los que tienen la de País.'),
    ],
}

#: de dónde sale cada cascada: (archivo, función, si sus `return` son `(id, texto, nivel)`)
CASCADAS = {
    'temporada': ('01_Temporada/normal_v3.py', 'tag', False),
    'competitivo': ('02_Competitivo/v2/gencomp.py', 'TAG', False),
    'servidor': ('comun/titulos.py', 'elegir', True),
    'pais': ('04_Pais/maqueta.py', 'tag', False),
}


def _texto(nodo):
    """El texto de un TAG en el código: una cadena, o `'… %d' % algo` (queda con el `%d`)."""
    if isinstance(nodo, ast.Constant) and isinstance(nodo.value, str):
        return nodo.value
    if isinstance(nodo, ast.BinOp) and isinstance(nodo.op, ast.Mod) and isinstance(nodo.left, ast.Constant):
        return nodo.left.value
    return None


def literales(carta):
    """Los TAGs que la cascada de `carta` puede devolver, leídos del código con `ast`: `{(texto, nivel)}`. Los de la
    Competitiva por su arquetipo salen de `DIMS_TAG` (vuelven como variable, no como texto)."""
    archivo, funcion, con_id = CASCADAS[carta]
    with io.open(os.path.join(RAIZ, archivo), encoding='utf-8') as f:
        arbol = ast.parse(f.read())
    out = set()
    for nodo in ast.walk(arbol):
        if isinstance(nodo, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'DIMS_TAG' for t in nodo.targets):
            for e in getattr(nodo.value, 'elts', []):
                if isinstance(e, ast.Tuple) and len(e.elts) == 3:
                    out.add((e.elts[2].value, 't3'))
        if isinstance(nodo, ast.FunctionDef) and nodo.name == funcion:
            for r in ast.walk(nodo):
                if isinstance(r, ast.Return) and isinstance(r.value, ast.Tuple):
                    els = r.value.elts
                    if len(els) != (3 if con_id else 2):
                        continue
                    nivel = els[-1].value if isinstance(els[-1], ast.Constant) else None
                    t = _texto(els[-2])
                    if t and nivel in NIVELES:
                        out.add((t, nivel))
    return out


def clave_tag(texto):
    """El texto de la cascada como está en el catálogo: «📋 SEMANA PERFECTA x3» → «… x%d», «EL MEJOR DE 25» → «… %d»."""
    return re.sub(r'(?<=\sx)\d+$|(?<=DE )\d+$', '%d', str(texto or ''))


def indices():
    """`{carta: {texto: i}}` para pasar de lo que devuelve una cascada a su lugar en el catálogo."""
    return {c: {t: i for i, (t, _n, _p) in enumerate(xs)} for c, xs in CATALOGO.items()}


def de_cada_uno():
    """`{clave: [temporada, competitivo, servidor, país]}`: el lugar en el catálogo del TAG que hoy muestra cada carta de
    cada uno, o -1. Corre las cuatro cascadas de verdad sobre `datos/`, como `hechos_tags.contar()`."""
    import importlib.util
    import hechos_tags as H
    from comun.claves import clave as K
    D = H.cargar()
    T = H._j('temporada_pool.json', []) or []
    C = H._j('competitivo_pool.json', []) or []
    if not T:
        return {}
    ht, hc, hp = H.temporada(T, D, comp=C), H.competitivo(C, D), H.pais(C, T, D)

    def mod(carpeta, archivo, nombre):
        antes = os.getcwd()
        os.chdir(os.path.join(RAIZ, carpeta))
        try:
            spec = importlib.util.spec_from_file_location(nombre, os.path.join(RAIZ, carpeta, archivo))
            m = importlib.util.module_from_spec(spec)
            _so = sys.stdout
            sys.stdout = io.StringIO()
            try:
                spec.loader.exec_module(m)
            finally:
                sys.stdout = _so
            return m
        finally:
            os.chdir(antes)

    ix = indices()
    out = collections.defaultdict(lambda: [-1, -1, -1, -1])
    nv3 = mod('01_Temporada', 'normal_v3.py', '_cat_nv3')
    for f in T:
        if f.get('ev'):
            t, _n = nv3.tag(dict(f, tg_t=ht.get(K(f['raw']), {})))
            out[K(f['raw'])][0] = ix['temporada'].get(clave_tag(t), -1)
    gc = mod(os.path.join('02_Competitivo', 'v2'), 'gencomp.py', '_cat_gc')
    for f in C:
        if f.get('rango'):
            t, _n = gc.TAG(dict(f, tg_c=hc.get(K(f['raw']), {})))
            out[K(f['raw'])][1] = ix['competitivo'].get(clave_tag(t), -1)
    from comun import titulos as TIT
    ps = H.con_hechos(D['ps'], C, D)
    for f in C:
        x = (ps.get(f['raw']) or {}).get(f.get('sv'))
        if not x:
            continue
        a, _s, b = str(f.get('pos_sv') or '').partition('/')
        _i, t, _n = TIT.elegir(dict(pos_sv=int(a) if a.isdigit() else 0, total_sv=int(b) if b.isdigit() else 0,
                                    titulos=x.get('oro', 0), podios=x.get('pod', 0), racha=x.get('racha') or '0/0',
                                    duelos=x.get('duelos') or '0/0', eventos=x.get('ev', 0), hechos=x.get('tg') or {}, casa=True))
        out[K(f['raw'])][2] = ix['servidor'].get(clave_tag(t), -1)
    from comun.requisitos import falta
    mq = mod('04_Pais', 'maqueta.py', '_cat_mq')
    tt = {x['raw']: x for x in T}
    for f in C:
        if falta('pais', f) is not None:
            continue
        t0 = tt.get(f['raw'], {})
        h = dict(hp.get(K(f['raw']), {}), srv=t0.get('srv', 0))
        txt, _n = mq.tag(f.get('pos_pais') or '', 0, 0, t0.get('ev', f.get('ev', 0)), t0.get('pod', 0), f.get('wr') or '0%',
                         f.get('rch_max', 0), '%d/%d' % (f.get('dna_v', 0), f.get('dna_t', 0)),
                         '%d/%d' % (f.get('din_v', 0), f.get('din_t', 0)), h)
        out[K(f['raw'])][3] = ix['pais'].get(clave_tag(txt), -1)
    return dict(out)


#: 📦 la copia del catálogo que se baja con la Guía (y no con el lobby, que baja todo el mundo): `--web` la escribe y el
#: self-check se pone rojo si no es igual a `CATALOGO`
WEB = os.path.join(RAIZ, 'web', 'src', 'tags_catalogo.json')


def web_json():
    return json.dumps({'_leeme': 'Copia de CATALOGO de sheet/catalogo_tags.py: se rehace con `python sheet/catalogo_tags.py --web`. '
                                 'No se edita a mano: el self-check la compara.', 'niveles': NIVELES,
                       'cat': {c: [list(x) for x in xs] for c, xs in CATALOGO.items()}}, ensure_ascii=False, indent=1) + '\n'


def para_web(de=None):
    """Lo que viaja en el payload: el lugar en el catálogo del TAG de cada carta de cada uno (sólo quien tiene alguno).
    El catálogo en sí va con la Guía (`WEB`): en el lobby eran 4 KB comprimidos más para todo el que entra."""
    return {k: v for k, v in (de or {}).items() if any(i >= 0 for i in v)}


def _self_check():
    mal = 0

    def ok(c, que):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', que))

    print('\n══ EL CATÁLOGO DE LOS TAGS ══\n')
    for carta in CATALOGO:
        codigo = literales(carta)
        cat = {(t, n) for t, n, _p in CATALOGO[carta]}
        falta = sorted(codigo - cat)
        sobra = sorted(cat - codigo)
        ok(not falta and not sobra, '%s: %d TAGs, el catálogo y la cascada dicen lo mismo%s%s' % (
            carta, len(cat), ('  · faltan en el catálogo: %s' % falta) if falta else '', ('  · ya no existen: %s' % sobra) if sobra else ''))
        ok(len({t for t, _n, _p in CATALOGO[carta]}) == len(CATALOGO[carta]), '%s: ningún TAG dos veces' % carta)
        ok(all(p.endswith('.') and len(p) <= 110 for _t, _n, p in CATALOGO[carta]), '%s: lo que pide cada uno, en una frase corta' % carta)
    ok(clave_tag('📋 SEMANA PERFECTA x3') == '📋 SEMANA PERFECTA x%d' and clave_tag('EL MEJOR DE 25') == 'EL MEJOR DE %d'
       and clave_tag('👑 CAMPEÓN x2') == '👑 CAMPEÓN x%d' and clave_tag('🎤 COMPETIDOR') == '🎤 COMPETIDOR', 'los TAGs con número')
    w = para_web({'ana': [0, -1, 2, -1], 'bea': [-1, -1, -1, -1]})
    ok(list(w) == ['ana'], 'al payload: sólo quien tiene alguno')
    try:
        with io.open(WEB, encoding='utf-8') as f:
            igual = f.read() == web_json()
    except OSError:
        igual = False
    ok(igual, 'la copia de la Guía (web/src/tags_catalogo.json) es la de acá: si no, `python sheet/catalogo_tags.py --web`')
    print('\n   %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        sys.exit(1 if _self_check() else 0)
    if '--web' in sys.argv:
        with io.open(WEB, 'w', encoding='utf-8', newline='\n') as f:
            f.write(web_json())
        print('   ✅', WEB)
        sys.exit(0)
    de = de_cada_uno()
    cu = collections.Counter()
    for v in de.values():
        for c, i in zip(CATALOGO, v):
            if i >= 0:
                cu[(c, CATALOGO[c][i][0])] += 1
    for (c, t), n in sorted(cu.items()):
        print('   %-12s %-30s %4d' % (c, t, n))
    print('\n   %d personas con algún TAG' % len(de))
