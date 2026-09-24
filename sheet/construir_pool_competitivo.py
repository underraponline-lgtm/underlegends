"""
CONSTRUIR EL POOL COMPETITIVO desde el Google Sheet
====================================================

Lee "Ranking Competitivo" y "Ranking Temporada" y escribe
`datos/competitivo_pool.json`, que es lo que consume la carta Competitiva.

    python3 sheet/construir_pool_competitivo.py

Necesita `creds.json` en la raiz. Corre DESPUES de construir_pool_temporada.py,
porque le pide prestados el WR, la racha y los avatares.

QUE CALCULA
-----------
- el subrango con signo (A+, A, A-, ...) partiendo cada tramo en tercios
- el puesto dentro del pais, del servidor y de la crew, siempre por Score
- los duelos NO salen del Sheet: viven en el acumulador. Si ya habia un
  competitivo_pool.json, se rescatan de ahi; si no, quedan en 0/0.

DE DONDE SALE CADA COSA
-----------------------
Competitivo: Score, Confianza, Ev y las 5 dimensiones (cabecera fila 12)
Temporada:   Win% y la racha, que es texto 'actual/maxima' (cabecera fila 16)
"""
import json
import os
import re
import sys
from collections import defaultdict

# 🔴 SIN ESTO, EL AVISO DE ERROR ES EL QUE REVIENTA. En Windows el
# stdout sale en cp1252, asi que `print('⚠️ no pude leer 1v1…')`
# —la unica linea con emoji de este modulo, y esta en el `except`—
# levanta `UnicodeEncodeError` y tumba el builder. O sea que el camino
# que existe para *seguir* cuando el Sheet falla es el que mata la
# corrida, y solo en la maquina de casa: en Actions es UTF-8 y no pasa.
# Es el guardia que tienen los otros 40 modulos del repo; este era el
# unico que imprime emoji y no lo tenia.
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

import gspread
from google.oauth2.service_account import Credentials

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# ⚠️ ESTA LINEA ES LO QUE PERMITE **IMPORTAR** ESTE MODULO, no sólo
# correrlo. Ver el mismo comentario en `construir_pool_temporada.py`:
# `python sheet/foo.py` pone `sheet/` en `sys.path[0]` solo, así que
# `from planillas import …` andaba de prestado.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# ⚠️ EL ID VIVE EN `sheet/planillas.py`, NO ACA. Estaba copiado en
# cinco archivos: hoy coinciden y por eso no se nota, pero **la T1
# estrena planilla nueva** y ese dia el que se olvide de actualizar su
# copia lee la planilla vieja y devuelve datos validos de la temporada
# equivocada. No falla: miente.
from planillas import OFICIAL as SHEET  # noqa: E402

# El rango sale del Score. Siempre. Los mismos umbrales en las tres cartas.
UMBRAL = [('SSS', 82), ('SS', 73), ('S', 62), ('A', 48),
          ('B', 37), ('C', 26), ('D', 18)]
# Solo A, B, C y D llevan signo. SSS, SS, S y E van sin.
LIMITES = [('SSS', 82, 101), ('SS', 73, 82), ('S', 62, 73), ('A', 48, 62),
           ('B', 37, 48), ('C', 26, 37), ('D', 18, 26), ('E', 0, 18)]
CON_SIGNO = {'A', 'B', 'C', 'D'}

# ⚠️ SALE DE datos/crews.json, NO DE UN DICT ACA. Habia uno escrito a mano con
# 13 personas, de antes de que Dlx pasara la lista el 20/08/2026 con 48. Y como
# el builder es EL QUE DEJA `crew` y `pos_crew` en el pool, ese dict viejo
# significaba que ningun rebuild iba a traer las crews nuevas: el arreglo no
# estaba en re-correr el builder, estaba aca. Ver comun/crews.py.
import sys as _sys
_sys.path.insert(0, RAIZ)
from comun.crews import DE_CADA_UNO as CREWS

MIN_GRUPO = 3      # con menos de 3, el puesto dentro del grupo no dice nada


def num(x):
    try:
        return float(str(x).replace(',', '').replace('%', '').strip() or 0)
    except ValueError:
        return 0.0


from comun.claves import clave as norm      # noqa: E402,F401

# 🔴 ERA UNA COPIA CON `[^a-z0-9]`, Y ESTE ARCHIVO ES LA FUENTE DE TODO.
# Medido sobre los 870 nombres reales: **Ржунимагу** salia con la clave
# vacia y **TøKīØ** con `tki`. La clave es lo que cruza esta hoja con la
# de Temporada, con el padron, con las crews y con R2 — o sea que una
# clave equivocada acá no rompe una carta, desconecta a esa persona
# de todo.
#
# Y la vacia es peor que la equivocada: dos vacios son **la misma persona**.
# Hoy hay uno solo, asi que no colisiona; el dia que entre un segundo nombre
# sin letras latinas, dos personas comparten fila y el pool no avisa.


def bandera(s):
    m = re.findall(r'[\U0001F1E6-\U0001F1FF]{2}', s)
    return ''.join(chr(ord(c) - 0x1F1E6 + ord('a')) for c in m[0]) if m else ''


def subrango(score):
    for k, a, b in LIMITES:
        if a <= score < b:
            if k not in CON_SIGNO:
                return k
            t = (b - a) / 3.0
            return k + '-' if score < a + t else (k if score < a + 2 * t else k + '+')
    return 'E'


def clasificar_duelos(filas, pais_de):
    """Las filas de `1v1` -> (todos, nacionales, internacionales).

    Devuelve `({k: (ganados, jugados)}, {k: [g, j]}, {k: [g, j]})`.

    🔴 ES UNA FUNCION Y NO CODIGO SUELTO PORQUE HOY NO SE PUEDE PROBAR
    CONTRA DATOS. `1v1` quedó vacía con el reset del 22/09, así que el
    camino que decide **el requisito de la carta País** no se ejecuta
    con nada real hasta el primer evento de la T1 — y ahí se estrenaría.
    Con la función aparte, su self-check la ejercita todos los días.

    ⚠️ UN DUELO SIN PAIS DE LOS DOS LADOS NO CUENTA PARA NINGUNO DE LOS
    DOS. No es lo mismo «peleó contra un extranjero» que «no sé de dónde
    es el rival»: meterlo en internacional infla el denominador de gente
    cuyo rival simplemente no está en el padrón.

    ⚠️ Y EL TOTAL SIGUE CONTANDO ESOS DUELOS. `duel_t` es «cuántos
    peleaste» y eso no depende de saber de dónde era el otro; lo que no
    se puede clasificar se cuenta en el total y en ninguno de los dos
    lados. Por eso `dna_t + din_t` puede ser menor que `duel_t`, y es
    correcto.
    """
    gan, jug = defaultdict(int), defaultdict(int)
    nac = defaultdict(lambda: [0, 0])
    inter = defaultdict(lambda: [0, 0])
    for f in filas:
        f = list(f) + [''] * 9
        a, b, g = (str(f[4]).strip(), str(f[5]).strip(), str(f[6]).strip())
        if not (a and b and g):
            continue
        ka, kb, kg = norm(a), norm(b), norm(g)
        jug[ka] += 1
        jug[kb] += 1
        gan[kg] += 1
        pa, pb = pais_de.get(ka, ''), pais_de.get(kb, '')
        if not (pa and pb):
            continue
        donde = nac if pa == pb else inter
        donde[ka][1] += 1
        donde[kb][1] += 1
        if kg in (ka, kb):
            donde[kg][0] += 1
    return ({k: (gan.get(k, 0), n) for k, n in jug.items()}, nac, inter)


def _self_check():
    """Que el corte nacional/internacional parta lo que dice partir."""
    mal = 0
    print('\n══ EL CORTE NACIONAL / INTERNACIONAL ══\n')
    pais = {'ana': 'Argentina', 'bea': 'Argentina',
            'cyn': 'Chile', 'dia': ''}
    F = lambda a, b, g: ['1', '', '', '', a, b, g, '', '']   # noqa: E731
    filas = [
        F('Ana', 'Bea', 'Ana'),      # nacional, gana Ana
        F('Ana', 'Bea', 'Bea'),      # nacional, gana Bea
        F('Ana', 'Cyn', 'Ana'),      # internacional, gana Ana
        F('Ana', 'Dia', 'Ana'),      # Dia no tiene país: no se clasifica
    ]
    todos, nac, inter = clasificar_duelos(filas, pais)
    casos = [
        ('Ana peleó 4 en total', todos['ana'] == (3, 4)),
        ('de esos, 2 nacionales y ganó 1', nac['ana'] == [1, 2]),
        ('1 internacional y lo ganó', inter['ana'] == [1, 1]),
        # 🔴 EL QUE NO SE PUEDE CLASIFICAR NO VA A NINGUN LADO
        ('el duelo contra quien no tiene país no entra en ninguno',
         nac['ana'][1] + inter['ana'][1] == 3 < todos['ana'][1]),
        ('y al rival sin país no se le inventa nada',
         nac['dia'] == [0, 0] and inter['dia'] == [0, 0]),
        ('Bea: 2 nacionales, 1 ganado', nac['bea'] == [1, 2]),
        ('Cyn: 1 internacional, 0 ganados', inter['cyn'] == [0, 1]),
        ('y Cyn no tiene nacionales', nac['cyn'] == [0, 0]),
    ]
    for que, ok in casos:
        mal += not ok
        print('   %s %s' % ('✅' if ok else '🔴', que))

    # 🔴 EL REQUISITO DE PAIS SE MIDE CONTRA ESTO, asi que se comprueba
    # que el campo que `comun/requisitos.py` pide sea el que esto llena.
    sys.path.insert(0, RAIZ)
    from comun.requisitos import condiciones, falta
    # ⚠️ PAIS PIDE TRES DESDE EL 22/09 —nacionales, internacionales y
    # bandera— asi que esto comprueba que **los dos campos de duelos**
    # que este modulo llena sean los que el requisito mira. Mirar solo
    # el primero dejaria `din_t` sin cubrir, que es donde un typo se
    # esconde mejor: daria 0 para todos y la carta no saldria nunca.
    campos = [c for _m, c, _q in condiciones('pais')]
    for c in ('dna_t', 'din_t'):
        ok = c in campos
        mal += not ok
        print('\n   %s el requisito de País mira %r' % ('✅' if ok else '🔴', c))
    for dna, din, esp in ((2, 9, False), (3, 2, False), (3, 3, True)):
        fila = {'dna_t': dna, 'din_t': din, 'cc': 'ar'}
        libre = falta('pais', fila) is None
        ok = libre == esp
        mal += not ok
        print('   %s %d nacional(es) y %d internacional(es): %s'
              % ('✅' if ok else '🔴', dna, din,
                 'la carta sale' if libre else 'bloqueada'))
    print('')
    return mal


def main():
    creds = os.path.join(RAIZ, 'creds.json')
    if not os.path.exists(creds):
        print('falta creds.json en la raiz del proyecto'); return

    # solo lectura: este script lee el Sheet y escribe JSON local. Ver
    # explorar_sheet.py para el porque.
    sc = ['https://www.googleapis.com/auth/spreadsheets.readonly']
    gc = gspread.authorize(Credentials.from_service_account_file(creds, scopes=sc))
    sh = gc.open_by_key(SHEET)

    # de Temporada: WR y racha
    from reintentar import leer as _leer_reint   # ver `sheet/reintentar.py`
    # ⚠️ con `lambda`: ver el mismo comentario en construir_pool_temporada
    t = _leer_reint(lambda: sh.worksheet('Ranking Temporada').get_all_values())
    # 🔴 LA CABECERA SE BUSCA. Ver `_cabecera()` en
    # `construir_pool_temporada.py`: la fila 16 describe el DISENIO de la
    # hoja, no el dato, y el dia que la vitrina se rehaga con la cabecera
    # arriba este `.index()` revienta con `ValueError`.
    from construir_pool_temporada import _cabecera
    fit, Ht = _cabecera(t, 'Rapero', 'Puntos')
    ct = lambda n: Ht.index(n)
    WR, RCH = {}, {}
    for r in [x for x in t[fit + 1:] if x and x[0].strip()]:
        k = norm(r[ct('Rapero')])
        WR[k] = r[ct('Win%')].strip()
        p = str(r[ct('🔥')]).split('/')          # texto, no numero
        RCH[k] = (int(num(p[0])), int(num(p[1])) if len(p) > 1 else 0)

    # lo que ya teniamos: duelos y avatares, que no estan en el Sheet
    DUE, AV = {}, {}
    prev = os.path.join(RAIZ, 'datos', 'competitivo_pool.json')
    if os.path.exists(prev):
        for x in json.load(open(prev, encoding='utf-8')):
            k = norm(x['full'])
            if x.get('duel_t'):
                DUE[k] = (x['duel_v'], x['duel_t'])
            if x.get('av', '').startswith('http'):
                AV[k] = x['av']

    # 🔴 Y AHORA LOS DUELOS PUEDEN SALIR DE UN REGISTRO DE VERDAD.
    #
    # Lo de arriba se rescata **del JSON anterior**, o sea de si mismo: cada
    # rebuild arrastra los mismos 4 de 138 y el numero solo puede quedarse
    # igual. `duel_t` y `duel_v` son **obligatorios en tres de las cuatro
    # tarjetas** y el resto muestra `0/0`.
    #
    # La hoja `1v1` del Operativo es el registro por combate, y desde el
    # 20/09/2026 se llena sola con `sheet/procesar_entrada.py`. Cuando tiene
    # filas, manda ella; cuando esta vacia, no pasa nada y sigue el rescate
    # de siempre.
    #
    # ⚠️ NO SE MEZCLAN. Un rapero sale del `1v1` **o** del JSON viejo, nunca
    # sumando los dos: el JSON viejo ya incluye combates que pueden estar
    # tambien en la hoja, y sumarlos contaria dos veces sin que nada falle.
    # El registro gana porque es el unico que se puede auditar.
    # 🔴 Y EL CORTE NACIONAL / INTERNACIONAL SALE DE ACA. Dlx,
    # 22/09/2026: *«País mínimo 3 duelos con una persona de la misma
    # nacionalidad que tú»* y *«me gustaría que el de países mire
    # principalmente los duelos nacionales e internacionales»*. O sea
    # que esto deja de ser un adorno de la carta y pasa a ser **el
    # requisito** y la base de su número.
    #
    # ⚠️ EL PAIS DEL RIVAL NO ESTA EN `1v1`: se resuelve cruzando el
    # nombre contra el padrón, que es donde vive el país. Por eso
    # `docs/sheet_t1.md` pide que `datos_duelos` guarde `a` y `b` como
    # `discord_id` — con el ID el cruce es exacto; con el nombre es un
    # parecido, y un parecido que falla **no inventa un duelo, pierde
    # uno**, que es la dirección segura.
    #
    # ⚠️ UN DUELO SIN PAIS DE LOS DOS LADOS NO CUENTA PARA NINGUNO DE
    # LOS DOS. No es lo mismo «peleó contra un extranjero» que «no sé
    # de dónde es el rival»: meterlo en internacional infla el
    # denominador de gente cuyo rival simplemente no está en el padrón.
    DE_1V1, NAC, INT = {}, defaultdict(lambda: [0, 0]), defaultdict(lambda: [0, 0])
    try:
        from padron import seguro as _pad_seguro          # noqa: F401
        from escribir import Hoja as _Hoja
        import construir_padron as _PAD
        pais_de = {_PAD.norm(x['raw']): (x.get('pais') or '').strip()
                   for x in _PAD.cargar()}
        h1 = _Hoja('1v1')
        DE_1V1, NAC, INT = clasificar_duelos(h1.filas(), pais_de)
        if DE_1V1:
            print('   la hoja `1v1` tiene duelos de %d persona(s): mandan ella'
                  % len(DE_1V1))
            DUE.update(DE_1V1)
        else:
            print('   la hoja `1v1` está vacía: los duelos siguen saliendo '
                  'del JSON anterior')
    except Exception as e:                                # noqa: BLE001
        print('   ⚠️ no pude leer `1v1` (%s): sigo con el JSON anterior'
              % str(e)[:60])

    # 🔴 LAS FILAS SE CALCULAN, NO SE LEEN DE LA VITRINA. `Ranking
    # Competitivo` sólo lista a los de **10+ eventos** desde el
    # 23/09/2026 —decisión de Dlx—, así que usarla como fuente de datos
    # deja este pool en **0 personas**. Y este pool alimenta las cartas
    # de **País y Servidor**, que no piden 10 eventos: sin él, el OVR
    # Nacional sale de un Score cero y el orden dentro del rango queda
    # todo empatado.
    #
    # ⚠️ NO ALCANZABA CON UN FALLBACK PARA CUANDO ESTA VACIA. El día que
    # diez personas crucen el umbral, la vitrina tendría diez filas y
    # este pool se quedaría con **esas diez**, tirando a las demás —el
    # mismo bug, más tarde y más difícil de ver. Por eso se calcula
    # siempre, con `piso=0`.
    #
    # ⚠️ Y ES LA MISMA FUNCION QUE ESCRIBE LA VITRINA, con otro piso:
    # una sola definición del Score y de las cinco dimensiones.
    from escribir import Hoja as _Hoja
    import rankings as _RK
    _res = _Hoja('Resultados').filas()
    _uno = _Hoja('1v1').filas()
    _ag = _RK.agregar(_res, _uno)
    _por_pts = sorted(_ag.items(), key=lambda kv: -int(kv[1].get('Puntos') or 0))
    _orden = {k: i for i, (k, _v) in enumerate(_por_pts, 1)}
    _svde = {k: v.get('Sv', '') for k, v in _ag.items()}
    Hc = list(_RK.CAB_COMPETITIVO)
    filas = _RK.tabla_competitivo(_res, _orden, _svde, piso=0)
    print('   %d fila(s) calculadas (la vitrina filtra en 10 ev; '
          'el pool las necesita todas)' % len(filas))
    cc = lambda n: Hc.index(n)

    # 🔴 LA IDENTIDAD SALE DEL PADRON, NO DEL NOMBRE. Ver sheet/padron.py:
    # `Lista de Raperos` tiene `Nombre`, `País` (ISO) y `Crew` en columnas
    # limpias. Deducir el pais del emoji pegado al nombre funciona hasta que
    # alguien lo escriba distinto — y ya falla en tres personas, donde el
    # padron y el emoji dicen paises diferentes.
    #
    # ⚠️ `seguro()` devuelve {} si el padron no responde, y entonces todo
    # esto cae en lo que se deducia antes. Un pipeline que se queda sin
    # pools porque una hoja nueva no contesta es peor que uno que deduce.
    from padron import seguro as _padron
    PAD = _padron()
    if PAD:
        print('   padrón: %d personas, %d con país'
              % (len(PAD), sum(1 for d in PAD.values() if d.get('cc'))))

    pool = []
    for r in filas:
        k = norm(r[cc('Rapero')])
        nom = re.sub(r'[\U0001F1E6-\U0001F1FF]', '', r[cc('Rapero')]).replace('❓', '').strip()
        _p = PAD.get(k, {})
        d = DUE.get(k, (0, 0))
        ra = RCH.get(k, (0, 0))
        score = num(r[cc('Score')])
        pool.append({
            'full': r[cc('Rapero')].strip(), 'raw': nom,
            # el padron primero; si no lo tiene, lo de siempre
            'cc': _p.get('cc') or bandera(r[cc('Rapero')]),
            'sv': r[cc('Sv')].strip(),
            # 🔴 TRES CAMPOS QUE ANTES NO ESTABAN EN EL POOL. `crew` vivia
            # solo en comun/crews.py y las cartas la sacaban de ahi; los
            # otros dos son el corte de identidad de la T1 —discord_id +
            # verificado— que hoy se MIDE y todavia no filtra.
            'crew': _p.get('crew', ''),
            'discord_id': _p.get('discord_id', ''),
            'verificado': bool(_p.get('verificado')),
            'ev': int(num(r[cc('Ev')])), 'score': score,
            'conf': num(r[cc('Confianza')]),
            'E': int(num(r[cc('⚡ Eficiencia')])), 'C': int(num(r[cc('🎯 Consistencia')])),
            'Dm': int(num(r[cc('👑 Dominancia')])), 'T': int(num(r[cc('🔥 Racha')])),
            'V': int(num(r[cc('🌍 Diversidad')])),
            'wr': WR.get(k, '0%'), 'rch_act': ra[0], 'rch_max': ra[1],
            'duel_v': d[0], 'duel_t': d[1], 'duel_real': k in DUE,
            # 🔴 LOS CUATRO QUE LA CARTA PAIS PEDIA Y NADIE LE DABA.
            # `DNA` y `DIN` son ganados/jugados contra rival de tu misma
            # nacionalidad y contra el resto. Estaban en el diseño desde
            # el principio y daban `—` en las 138 porque el pool no los
            # traía; desde el 22/09 además **`dna_t` es el requisito**
            # de la carta: Dlx pidió mínimo 3 duelos nacionales.
            'dna_v': NAC[k][0], 'dna_t': NAC[k][1],
            'din_v': INT[k][0], 'din_t': INT[k][1],
            'pos': int(num(r[cc('#')])), 'total': len(filas),
            'rango': next((x for x, u in UMBRAL if score >= u), 'E'),
            'subrango': subrango(score),
            'ovr': 0, 'av': AV.get(k, ''),
        })

    # puesto dentro del pais, del servidor y de la crew. Los tres por Score,
    # para que los tres numeros de la carta sean comparables entre si.
    # El umbral de MIN_GRUPO vale para los TRES circulos, no solo para la crew:
    # ser "1 de 1" no dice nada, sea en una crew, en un pais o en un servidor.
    # DRA tiene 1 persona y URBF 2, asi que el servidor tenia el mismo problema.
    # Los tres se calculan igual a proposito: si no, dejan de ser comparables.
    for campo, clave in [('cc', 'pais'), ('sv', 'sv')]:
        g = defaultdict(list)
        for d in pool:
            g[d[campo] or '??'].append(d)
        for _, v in g.items():
            v.sort(key=lambda x: -x['score'])
            for i, d in enumerate(v):
                d['pos_' + clave] = ('%d/%d' % (i + 1, len(v))
                                     if len(v) >= MIN_GRUPO else '')
                d['arc_' + clave] = round(100 * (len(v) - i) / len(v)) if len(v) >= 5 else 0

    g = defaultdict(list)
    for d in pool:
        cr = CREWS.get(norm(d['raw']))
        if cr:
            d['crew'] = cr
            g[cr].append(d)
    for cr, v in g.items():
        v.sort(key=lambda x: -x['score'])
        for i, d in enumerate(v):
            d['pos_crew'] = '%d/%d' % (i + 1, len(v)) if len(v) >= MIN_GRUPO else ''

    salida = os.path.join(RAIZ, 'datos', 'competitivo_pool.json')
    os.makedirs(os.path.dirname(salida), exist_ok=True)
    json.dump(pool, open(salida, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    from collections import Counter
    print('%d raperos' % len(pool))
    print('subrangos:', dict(Counter(d['subrango'] for d in pool)))
    print('con duelos reales: %d | con avatar: %d' %
          (sum(1 for d in pool if d['duel_real']), sum(1 for d in pool if d['av'])))
    print('->', salida)


if __name__ == '__main__':
    if '--auto' in sys.argv:
        sys.exit(1 if _self_check() else 0)
    main()
