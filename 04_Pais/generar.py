"""La carta de País con datos de verdad, no con la maqueta.

`maqueta.py` dibuja la carta y trae once hojas comparativas, pero su GENTE son
DOS personas escritas a mano —Konan con los números redondeados y KAIRO, que no
existe—. Este archivo es el que arma las 138 desde `datos/`.

    python 04_Pais/generar.py --auditar        que se puede llenar y que no
    python 04_Pais/generar.py Konan            una carta
    python 04_Pais/generar.py Konan Bloody Am  varias, en una hoja
    python 04_Pais/generar.py --todas          las 138

⚠️ **NO INVENTA NADA.** Lo que no tiene dato sale como `—` y `--auditar` lo
lista. Eso hace que el agujero se vea en la carta en vez de esconderse detrás
de un número plausible, que es lo que hacía DEMO_NAC.

De dónde sale cada pieza
------------------------

| pieza | fuente | cubre |
|---|---|---|
| nombre, país, servidor | `competitivo_pool.json` | 138 / 137 |
| rango | `competitivo_pool.json` · **nunca el de temporada** | 138 |
| OVR Nacional | se calcula acá (N3) | 137 |
| puesto en el país | `pos_pais`, umbral 3 | 126 |
| puesto en el rango | se calcula acá, umbral 3 | 137 |
| puesto en el servidor | `pos_sv`, umbral 3 | 135 |
| eventos, podios, oros, semis | `temporada_pool.json` | 138 |
| win rate, racha | `competitivo_pool.json` | 138 |
| crew | `crews.json` | 31 |
| foto | `comun/respaldo.py` (repo + espejo de R2) | **112** |
| SEG, TER | `temporada_pool.json` | **138** |
| DNA, DIN | `competitivo_pool.json`, desde `1v1` | depende de los duelos |
| trofeos nacional y mundial | — | **0**, arrancan en T2 |

⚠️ **EL RANGO SALE DEL COMPETITIVO Y LOS DOS POOLS NO COINCIDEN.** Konan es SSS
en el competitivo y SS en el de temporada; si esta carta leyera el de temporada,
la misma persona tendría dos rangos distintos en dos cartas. Es la primera regla
de CLAUDE.md y acá es fácil de romper porque los dos JSON traen la columna con
el mismo nombre.
"""
import argparse
import asyncio
import base64
import json
import math
import os
import sys
import unicodedata

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)

import maqueta as MQ

DATOS = os.path.join(BASE, 'datos')
SALIDA = os.path.join(SCR, 'salida')


def _j(nombre):
    with open(os.path.join(DATOS, nombre), encoding='utf-8') as f:
        return json.load(f)


def norm(s):
    """El nombre sin acentos, espacios ni mayúsculas, para cruzar listas.

    ⚠️ Los nombres vienen escritos distinto en cada archivo: el pool los trae
    del Sheet y `crews.json` los trae de cómo los escribió Dlx a mano. Cruzar
    por el texto tal cual deja crews afuera sin avisar.
    """
    s = unicodedata.normalize('NFD', str(s).lower())
    return ''.join(c for c in s if c.isalnum())


# ══ EL OVR NACIONAL ══
# ⚠️ ES N3 Y ESTA ELEGIDO POR MEDICION, no por gusto: `docs/pais_hallazgos.md`
# compara ocho candidatos contra tres pruebas —cuanto se despega de las otras
# dos cartas, cuanta gente queda en el tope, y si contradice a pos_pais—. Lo
# que hay que saber para no "arreglarlo":
#
#   · N2 (contra el mejor de la Liga) NO REORDENA A NADIE: cero personas
#     cambian de puesto respecto del Score, o sea que la carta de Pais seria
#     la Competitiva repintada.
#   · N1 (contra el mejor de tu pais) pone 17 personas en 99, y cuatro de
#     ellas son el unico de su pais. Es el "1 de 1" que el umbral de 3 existe
#     para evitar.
#   · N4 (por puntos) separa mejor pero CONTRADICE LA PASTILLA: 97 de 126
#     cambian de puesto, asi que la carta mostraria el 5o mejor numero de
#     Argentina con una pastilla que dice 25o.
#
# N3 es la media geometrica entre tu Score y el Score Seleccion de tu pais,
# normalizada contra el maximo posible. Su gracia es que el factor del pais es
# CONSTANTE dentro de un pais, asi que el orden interno no cambia y pos_pais
# —que se calcula por Score— sigue diciendo la verdad.
#
# ⚠️ Y NO NECESITA CREDENCIALES. El score_seleccion de la hoja se reconstruye
# del pool con una diferencia maxima de 0.04 en los 17 paises; `mundial.json`
# ya lo trae calculado y es de donde se lee.
# ⚠️ LA FORMULA SE MUDO A `comun/nacional.py` Y ACA SOLO SE IMPORTA. Desde el
# 20/09/2026 tiene un segundo usuario: `bot/subir_datos.py`, que le manda a KV
# el numero que compara el `/versus`. Las dos alternativas eran copiarla —la
# forma que mas veces rompio este proyecto— o que subir datos a KV importara
# este archivo, que arrastra `maqueta` entero.
#
# ⚠️ Y ES LO MISMO, MEDIDO: las 137 cartas de Pais salen identicas byte a byte
# despues de la mudanza. El self-check de `comun/nacional.py` comprueba ademas
# los dos numeros que `CLAUDE.md` deja escritos — un solo 99 (Konan) y Am en 70.
from comun.nacional import PISO, ALTO, ovr_nacional   # noqa: E402,F401


# ══ LAS DIECISEIS STATS NACIONALES ══
# El orden es el que espera maqueta.carta(), que lo desarma por indice:
#
#   0 de   1 dif  2 mej  3 sub  4 sel  5 pico 6 tmp  7 nac
#   8 podn 9 seg  10 ter 11 dni 12 dna 13 din 14 evn 15 evi
#
# ⚠️ LA CARTA USA SEIS: EVN, SEG, EVI, TER, DNA, DIN. Las otras diez son de los
# juegos que se probaron y quedaron escritos en JUEGOS; van en `—` porque
# ninguna tiene fuente y porque nadie las dibuja.
SIN = '—'


def stats_nacionales(c, t):
    """Las seis del bloque, con lo que hay. Lo que no hay va en `—`.

    ⚠️ **CUATRO DE LAS SEIS NO TIENEN FUENTE HOY**, y no es un descuido del
    pipeline: es que la competencia que las genera no existe. La Fecha FIFA y
    la Copa de Naciones arrancan en T2.

    EVN · eventos nacionales
        **Cero para las 138.** No hay ninguna competencia de país todavía, así
        que el cero es correcto y no un hueco: jugaste en cero eventos
        nacionales porque no hubo ninguno.

    EVI · eventos internacionales
        `ev` del pool de temporada. ⚠️ **Es una decisión, no un dato crudo**:
        hoy TODA la competencia es de servidor, o sea afuera de tu país, así
        que los eventos que jugaste son todos internacionales. El día que haya
        brackets nacionales este número deja de ser `ev` y hay que partirlo.

    SEG · TER · segundos y terceros puestos
        ✅ **SÍ EXISTEN, y esto decía que no.** Medido el 20/09/2026: el Sheet
        tiene las columnas `🥈` y `🥉` con **131 y 83 personas con valor**, y
        `construir_pool_temporada.py` **ya las leía** — para sumarlas en `pod`
        y descartar el desglose una línea después.

        O sea que el dato estaba en el Sheet, entraba al pipeline y se tiraba
        adentro del mismo bucle. La versión anterior de este párrafo razonaba
        bien sobre una premisa falsa: *«el pool trae `oro` y `pod` y nada
        más»*. Traía eso porque el builder guardaba eso.

        ⚠️ Un `0` acá **es una respuesta**, no un hueco: significa que esa
        persona no tiene segundos puestos. El `—` se reserva para cuando el
        pool es viejo y no trae el campo.

    DNA · DIN · duelos ganados contra compatriota / contra extranjero
        ✅ **YA EXISTEN, desde el 22/09/2026, y esto decía que no.** Decía
        que los duelos «ni siquiera guardan de qué país era el rival» — y
        era cierto hasta que `construir_pool_competitivo.clasificar_duelos()`
        empezó a cruzar cada fila de `1v1` contra el país del padrón.

        ⚠️ Y ahora `dna_t` no es sólo una stat: **es el requisito de esta
        carta**. Dlx, 22/09: *«País mínimo 3 duelos con una persona de la
        misma nacionalidad que tú»*.

        ⚠️ Un duelo sin país de los DOS lados no entra en ninguno de los
        dos, así que `dna_t + din_t` puede ser menor que `duel_t`.
    """
    # ⚠️ `SIN` SOLO SI EL CAMPO NO ESTA, no si vale 0. Son dos cosas
    # distintas: «no tenés segundos puestos» es un dato y `—` es «no sé».
    # Un pool viejo —de antes de que el builder los guardara— no trae la
    # clave, y ahí sí corresponde el guión.
    seg = t['seg'] if 'seg' in t else SIN
    ter = t['ter'] if 'ter' in t else SIN

    # ✅ DNA Y DIN DEJARON DE SER `—` EL 22/09/2026. El docstring de
    # arriba decía que los duelos «ni siquiera guardan de qué país era
    # el rival», y eso ya no es cierto: `construir_pool_competitivo`
    # cruza cada duelo de `1v1` contra el país del padrón y deja
    # `dna_v/dna_t` y `din_v/din_t`. Ver `clasificar_duelos()`.
    #
    # ⚠️ EL FORMATO ES `ganados/jugados`, como el resto del bloque.
    # ⚠️ Y `SIN` SÓLO SI EL CAMPO NO ESTÁ: `0/0` es un dato —«no
    # peleaste ninguno»— y `—` es «no sé». Un pool de antes del 22/09
    # no trae la clave, y ahí sí corresponde el guión.
    def _par(v, tt):
        return ('%d/%d' % (int(c.get(v) or 0), int(c.get(tt) or 0))
                if tt in c else SIN)

    dna, din = _par('dna_v', 'dna_t'), _par('din_v', 'din_t')
    return (SIN,) * 9 + (seg, ter, SIN, dna, din, 0, t['ev'])
    #      0..8          seg  ter  dni  dna  din  evn  evi


# ══ EL PUESTO DENTRO DEL RANGO ══
# ⚠️ MISMO UMBRAL DE 3 QUE PAIS, SERVIDOR Y CREW. CLAUDE.md lo dice para los
# tres casilleros del pie y la razon vale igual acá: ser "1 de 1" no informa.
#
# ⚠️ Y EL QUE SE QUEDA SIN NUMERO ES KONAN. SSS tiene UNA sola persona, asi que
# el mejor de la Liga es el unico de las 138 a quien no se le dibuja. Parece un
# bug y es la regla funcionando.
UMBRAL = 3


def puestos_en_rango(gente):
    por_rango = {}
    for p in gente:
        por_rango.setdefault(p['rango'], []).append(p)
    out = {}
    for rg, lista in por_rango.items():
        if len(lista) < UMBRAL:
            continue
        for n, p in enumerate(sorted(lista, key=lambda x: -x['score']), 1):
            out[p['raw']] = n
    return out


# ══ LA FOTO ══
# ⚠️ VIVE EN comun/respaldo.py, NO ACA. Esta funcion estaba escrita dos veces
# —una en esta carta y otra en el respaldo que usan las otras tres— y la del
# comun ademas conoce `av_valen.png`, que esta suelto y es la unica copia que
# queda de esa foto. Dos copias daban 9 y 10.
#
# Eran 10 de 138 y hoy son 112 (20/09/2026). No se puede mejorar desde aca:
# la columna `av` del pool
# guarda un link de cdn.discordapp.com con un hash que Discord invalida cuando
# la persona cambia su foto, y el Sheet NO los tiene —el builder los rescata
# del JSON anterior, o sea de si mismo—. Lo unico que lo arregla es pedirselos
# a Discord al generar, con el token del bot.
# ⚠️ `avatar()` Y NO `foto()`: la regla de de-donde-sale-la-cara tiene que
# ser LA MISMA en las cuatro cartas. `foto()` mira solo el repo, asi que
# quien tuviera copia en el repo NO y url viva en el pool SI salia con cara
# en dos cartas y sin cara en las otras dos — el espejo exacto del bug que
# Dlx reporto el 17/09. Hoy le pasa a una sola persona y su url ademas esta
# muerta, pero la asimetria es la que vuelve.
from comun.respaldo import avatar as foto


# ══ ARMAR LA GENTE ══
def cargar():
    """Las 138 con todo resuelto, en el orden del pool competitivo."""
    comp = _j('competitivo_pool.json')
    temp = {x['raw']: x for x in _j('temporada_pool.json')}
    mund = _j('mundial.json')['competitivos']
    # ⚠️ LAS CREWS SALEN DE comun/crews.py, que es el unico que las lee. Esto
    # estaba escrito acá, en gencomp.py, en el builder y en todos_sv.py — y
    # dos de esas cuatro copias tenian una lista de 2026-07 con 13 personas.
    # ⚠️ Y SE BUSCA CON SU NORMALIZACION, no con la de este archivo. Las
    # claves las pone ese modulo; dos funciones parecidas que se separan un dia
    # hacen desaparecer la crew sin avisar.
    from comun.crews import DE_CADA_UNO as de_crew, norm as cnorm

    # 🔴 `default=0` Y NO `max()` A SECAS. Con el pool vacio —que es el
    # estado de una temporada recien arrancada, no un caso raro— esto
    # tiraba `ValueError: max() iterable argument is empty` y el generador
    # de Pais **no arrancaba**. Medido el 22/09/2026, con el pool en 0:
    # `04_Pais/generar.py --auditar` moria en esta linea.
    #
    # ⚠️ NO LO TAPABA EL CICLO PORQUE NO LO LLAMA: hoy nadie cumple el
    # requisito de Pais, asi que `emitibles()` no la pide. O sea que el
    # crash esperaba al primero que entre al pool con pais — o a quien
    # corriera la herramienta a mano, que es como aparecio.
    #
    # Con 0 el `out` sale vacio y las divisiones de abajo no llegan a
    # correr: no hay a quien dibujarle. Devolver una lista vacia es la
    # respuesta correcta a «no hay nadie», y es lo que los otros tres
    # generadores ya hacen.
    mejor_score = max((x['score'] for x in comp), default=0)
    mejor_pais = max((v['score_seleccion'] for v in mund.values()), default=0)
    en_rango = puestos_en_rango(comp)

    out = []
    # 🔴 LA UNION DE LOS DOS POOLS, Y ESTO RECORRIA SOLO EL COMPETITIVO.
    #
    # Era lo mismo mientras los dos tenian la misma gente —el corte unico
    # de 8—; el 16/09/2026 los requisitos se partieron y esta carta pide
    # **bandera + 3 duelos nacionales + 3 internacionales**, que no tiene
    # nada que ver con los 10 eventos del Competitivo.
    #
    # ⚠️ EL SINTOMA ERA UN NO-OP EN SILENCIO. Medido el 22/09 con el
    # primer evento de la T1 cargado: pool de temporada 6, competitivo 0,
    # y `generar.py --todas` salia con **codigo 0, sin imprimir nada y sin
    # tocar el HTML**. No fallaba: no encontraba a nadie porque miraba el
    # pool equivocado.
    #
    # ⚠️ EL RANGO SIGUE SALIENDO DEL COMPETITIVO, «nunca el de temporada»
    # —es la regla del proyecto y la tabla de arriba lo dice—. Quien no
    # esta en ese pool entra con el rango vacio, que es el hueco que la
    # carta ya sabe dibujar, igual que SEG, TER, DNA y DIN.
    porcomp = {x['raw']: x for x in comp}
    orden = list(comp) + [temp[n] for n in temp if n not in porcomp]
    for base in orden:
        c = dict(base)
        c.setdefault('rango', '')
        c.setdefault('sv', '')
        c.setdefault('score', 0)
        c.setdefault('cc', '')
        c.setdefault('ev', 0)
        t = temp.get(c['raw'], {})
        sp = mund.get(c['cc'], {}).get('score_seleccion')
        out.append({
            'nombre': c['raw'],
            'cc': c['cc'],
            'rango': c['rango'],
            'sv': c['sv'],
            'crew': de_crew.get(cnorm(c['raw'])),
            'pos_pais': c.get('pos_pais') or '',
            'pos_rg': en_rango.get(c['raw'], ''),
            'pos_sv': c.get('pos_sv') or '',
            'ovr': (ovr_nacional(c['score'], sp, mejor_score, mejor_pais)
                    if sp else None),
            'sem': t.get('sem', 0),
            'evt': t.get('ev', c['ev']),
            'pod': t.get('pod', 0),
            'cam': t.get('oro', 0),
            'win': c.get('wr', '0%'),
            'rch': c.get('rch_max', 0),
            'duelos': ('%d/%d' % (c['duel_v'], c['duel_t'])
                       if c.get('duel_real') else ''),
            'foto': foto(c['raw'], c.get('av') or ''),
            'stats': stats_nacionales(c, t or c),
            # ⚠️ CERO Y CERO PARA LAS 138. Los dos trofeos son placeholders de
            # una competencia que arranca en T2, y con cero el casillero NO SE
            # DIBUJA —"sin dato no hay pieza"—. O sea que hoy la columna
            # izquierda tiene TRES casilleros, no cinco, y eso es correcto.
            'tro_nac': 0,
            'tro_mun': 0,
            'score': c['score'],
        })
    return out


def fila(p):
    """La tupla de 19 campos que espera maqueta.carta()."""
    return (p['nombre'].upper(), p['cc'], p['rango'], p['sv'], p['crew'],
            p['pos_pais'], p['ovr'], p['sem'], p['evt'], p['pod'], p['cam'],
            p['win'], p['rch'], p['pos_rg'], p['pos_sv'], p['duelos'], '',
            p['tro_nac'], p['tro_mun'])


# ══ DIBUJAR ══
def montar(gente, cols=0):
    """Pone la gente en maqueta y devuelve (html, alto, ancho).

    ⚠️ `.rack` es un flex de UNA fila, que es lo que las hojas comparativas
    necesitan. Con 138 cartas eso da 45.000 px de ancho, o sea 135.000 al
    escalar por 3, y Chromium no captura eso: hay que envolver. Por eso el
    ancho de la grilla se escribe acá y no se toca el CSS de la maqueta.
    """
    MQ.GENTE = [fila(p) for p in gente]
    MQ.NAC = {p['nombre'].upper(): p['stats'] for p in gente}
    MQ.FOTOS = [p['foto'] for p in gente]
    # ⚠️ TODO SALE DE MQ.PRESET, NADA ESCRITO A MANO. Antes esta llamada
    # repetia los trece valores elegidos, o sea que eran DOS copias de la
    # misma decision. En la Servidor esa forma ya costo una carta mal
    # dibujada: el divisor estaba decidido en F y el generador heredo la A.
    P = MQ.PRESET
    LW = round(MQ.W * P['lane'] / 100)
    h = MQ.alto_de(P['remate'], P['acorta'])
    sil = "path('%s')" % MQ.silueta(P['acorta'], P['remate'])
    cuerpo = ''.join(MQ.carta_preset(i, LW) for i in range(len(MQ.GENTE)))
    cols = cols or len(gente)
    filas = -(-len(gente) // cols)
    extra = ('.rack{display:flex;flex-wrap:wrap;gap:26px;width:%dpx}'
             % (cols * (MQ.W + 26)))
    html = ('<!DOCTYPE html><meta charset="utf-8"><style>'
            + MQ.CSSF(h, sil, 'combo-r2') + extra
            + '</style><div class="rack">' + cuerpo + '</div>')
    return html, filas * (h + 26) + 60, cols * (MQ.W + 26) + 40


# ══ CUANTAS SALIERON DE VERDAD ══
# ⚠️ CHROMIUM TIRA CARTAS EN SILENCIO CUANDO LA HOJA ES MUY GRANDE, y esto no
# es una teoria: medido con las 137 en grilla de 12,
#
#   | escala | píxeles       | dibujadas |
#   |--------|---------------|-----------|
#   | 1      | 3952 × 5196   | 137 / 137 |
#   | 2      | 7904 × 10392  | 137 / 137 |
#   | **3**  | 11856 × 15588 | **96 / 137** |
#
# A escala 3 las últimas 41 salen en BLANCO: el PNG pesa 37 MB, tiene el alto
# correcto y no hay ningún error. O sea que una hoja de control que no cuente
# lo que pintó estaría dando por buenas 137 cartas de las que vio 96.
#
# Por eso no se elige una escala: se dibuja, SE CUENTAN, y si faltan se baja.
FONDO = (11, 11, 18)


def _pintadas(png, alto_c, ancho_c, cols, escala):
    """Cuántas cartas tienen tinta, contando bloques por fila de la grilla."""
    from PIL import Image
    import numpy as np
    Image.MAX_IMAGE_PIXELS = None
    a = np.asarray(Image.open(png).convert('RGB')).astype(np.int16)
    dif = np.abs(a - np.array(FONDO)).max(axis=2)
    paso, n = int(alto_c * escala), 0
    for r in range(-(-len(MQ.GENTE) // cols)):
        y0 = int(26 * escala) + r * paso
        col = dif[y0:y0 + int((alto_c - 26) * escala)].max(axis=0) > 6
        d = np.diff(np.concatenate(([0], col.astype(int), [0])))
        n += int((d == 1).sum())
    return n


async def dibujar(gente, salida, cols=0):
    os.makedirs(SALIDA, exist_ok=True)
    cols = cols or len(gente)
    dest = os.path.join(SALIDA, salida)
    original = MQ.ESCALA
    try:
        for escala in (original, 2, 1):
            MQ.ESCALA = escala
            html, alto, ancho = montar(gente, cols)
            with open(os.path.join(SALIDA, 'pais.html'), 'w',
                      encoding='utf-8') as f:
                f.write(html)
            await MQ.disparar(html, ancho, alto, dest, '_generar.html')
            if len(gente) == 1:
                return
            n = _pintadas(dest, MQ.alto_de('recta', 0) + 26, ancho, cols, escala)
            if n >= len(gente):
                if escala != original:
                    print('   (a escala %d; a %d Chromium las tiraba)'
                          % (escala, original))
                return
            print('   escala %d: salieron %d de %d, bajo la escala'
                  % (escala, n, len(gente)))
        raise SystemExit('no se pudieron dibujar las %d ni a escala 1'
                         % len(gente))
    finally:
        MQ.ESCALA = original


# ══ LA AUDITORIA ══
def auditar(gente):
    """Que se puede llenar hoy y que no. Cuenta, no opina."""
    n = len(gente)
    banderas = {os.path.splitext(f)[0]
                for f in os.listdir(os.path.join(SCR, 'banderas_carta'))}
    escudos = {os.path.splitext(f)[0][3:].upper()
               for f in os.listdir(os.path.join(BASE, 'comun', 'escudos_cuad'))}

    def cuenta(f):
        return sum(1 for p in gente if f(p))

    filas = [
        ('el nombre',              cuenta(lambda p: p['nombre'])),
        ('el pais',                cuenta(lambda p: p['cc'])),
        ('la bandera en disco',    cuenta(lambda p: p['cc'] in banderas)),
        ('el rango',               cuenta(lambda p: p['rango'])),
        ('el escudo del servidor', cuenta(lambda p: p['sv'].upper() in escudos)),
        ('el OVR Nacional',        cuenta(lambda p: p['ovr'])),
        ('el puesto en el pais',   cuenta(lambda p: p['pos_pais'])),
        ('el puesto en el rango',  cuenta(lambda p: p['pos_rg'])),
        ('el puesto en el sv',     cuenta(lambda p: p['pos_sv'])),
        ('el TAG',                 n),
        ('EVN · eventos nac.',     n),
        ('EVI · eventos int.',     cuenta(lambda p: p['stats'][15] != SIN)),
        ('SEG · segundos',         cuenta(lambda p: p['stats'][9] != SIN)),
        ('TER · terceros',         cuenta(lambda p: p['stats'][10] != SIN)),
        ('DNA · duelos nac.',      cuenta(lambda p: p['stats'][12] != SIN)),
        ('DIN · duelos int.',      cuenta(lambda p: p['stats'][13] != SIN)),
        ('el trofeo nacional',     cuenta(lambda p: p['tro_nac'])),
        ('el trofeo mundial',      cuenta(lambda p: p['tro_mun'])),
        ('la crew',                cuenta(lambda p: p['crew'])),
        ('la foto',                cuenta(lambda p: p['foto'])),
    ]
    ancho = max(len(x) for x, _ in filas)
    print('QUE SE PUEDE LLENAR HOY, SOBRE LAS %d\n' % n)
    # 🔴 CON EL POOL EN CERO NO SE DIVIDE, SE DICE. Esto hacía `k / n` y
    # tiraba `ZeroDivisionError` justo después del `max()` vacío de
    # `cargar()`: dos crashes en el mismo camino, los dos por la misma
    # causa —una temporada recién arrancada— y el segundo escondido
    # detrás del primero.
    #
    # ⚠️ «0 de 0» no es «0 %», es «no hay con qué medir». Imprimir la
    # barra vacía diría que ninguna pieza se puede llenar, cuando lo que
    # pasa es que no hay a quién llenársela. Es la misma distinción que
    # `comun/requisitos.py` hace desde hoy.
    #
    # ⚠️ Y ESTO NO CAMBIA NINGÚN REQUISITO. Los de cada carta están
    # cerrados y viven en `comun/requisitos.py`; acá sólo se arregla que
    # el generador no explote cuando todavía no hay nadie.
    if not n:
        print('  ⚠️ el pool está vacío: no hay a quién dibujarle, así que')
        print('     no hay nada que medir. No es un fallo — la T1 arrancó')
        print('     de cero, y se vuelve a medir solo cuando entre el')
        print('     primero con país.')
        print('')
        return
    for nom, k in filas:
        barra = '#' * round(k / n * 28)
        print('  %-*s  %3d/%d  %5.1f%%  %s'
              % (ancho, nom, k, n, 100 * k / n, barra))

    sin_pais = [p['nombre'] for p in gente if not p['cc']]
    if sin_pais:
        print('\n  sin pais, o sea sin carta:', ', '.join(sin_pais))
    faltan = sorted({p['cc'] for p in gente if p['cc']
                     and p['cc'] not in banderas})
    if faltan:
        print('  paises sin bandera en disco:', ', '.join(faltan))
    print('\n  ✅ SEG y TER se llenaron el 20/09/2026. Estaban en el Sheet')
    print('     (columnas 🥈 y 🥉) y el builder las leía para sumarlas en')
    print('     `pod` y tirar el desglose una línea después.')
    print('\n  ⚠️ DNA, DIN y los dos trofeos siguen en cero, y NO es un bug')
    print('     del pipeline: los duelos no guardan de qué país era el rival,')
    print('     y la Copa de Naciones arranca en T2. Ver stats_nacionales().')
    print('\n  ⚠️ EVN en 0 para las 138 también es correcto: jugaste en cero')
    print('     eventos nacionales porque todavía no hubo ninguno.')


# ══ UNA POR PAIS ══
# ⚠️ ES LA HOJA QUE DECIDE EL FONDO, y por eso vive acá y no en un script
# suelto. Cada bandera se comporta distinto contra la foto, el velo y las
# stats: la carta se mira en las dieciséis o no se mira.
#
# Se toma **el mejor de cada país** y no uno al azar: así la hoja también
# muestra el caso del `#1`, que es el que no tiene a dónde subir.
ORDEN_PAISES = ['ar', 'cl', 'co', 'mx', 've', 'pe', 'es', 'uy',
                'ec', 'bo', 'do', 'gt', 'hn', 'pa', 'pr', 'us']


def uno_por_pais(gente):
    mejor = {}
    for p in sorted(gente, key=lambda x: -x['score']):
        if p['cc'] and p['cc'] not in mejor:
            mejor[p['cc']] = p
    resto = [c for c in sorted(mejor) if c not in ORDEN_PAISES]
    return [mejor[c] for c in ORDEN_PAISES + resto if c in mejor]


# ⚠️ CARAS PRESTADAS, Y LA HOJA LO DICE. Nacio cuando solo 10 de 138 tenian
# foto en disco —hoy son 112—,
# así que con datos reales quince de las dieciséis salen con la inicial y la
# hoja no sirve para mirar cómo se comporta la foto contra la bandera —que es
# justo lo que hay que mirar—. `--caras` reparte las que hay más los cuatro
# casos armados de `avatares.py` (oscura, clara, contraste, ruidosa), que para
# juzgar un fundido son mejores que caras lindas: aíslan la variable.
#
# ⚠️ NO ES LA CARTA DE NADIE. Ninguna de esas caras es de la persona que dice
# el nombre. Es una hoja de diseño y por eso está detrás de una bandera, no en
# el camino normal: `generar.py Konan` sigue dibujando lo que Konan tiene.
def prestar_caras(elegidos):
    sys.path.insert(0, os.path.join(BASE, '03_Servidor', 'disenos'))
    import avatares
    L = [u for _e, u in avatares.lista() if u]
    for i, p in enumerate(elegidos):
        p['foto'] = L[i % len(L)]
    return len(L)


def main():
    ap = argparse.ArgumentParser(description='La carta de Pais con datos reales')
    ap.add_argument('quien', nargs='*', help='nombres; vacio = auditar')
    ap.add_argument('--todas', action='store_true')
    ap.add_argument('--paises', action='store_true',
                    help='una carta por pais, con el mejor de cada uno')
    ap.add_argument('--caras', action='store_true',
                    help='con --paises: reparte caras de muestra. NO son de esa gente')
    ap.add_argument('--auditar', action='store_true')
    ap.add_argument('--salida', default='pais.png')
    ap.add_argument('--cols', type=int, default=0,
                    help='cuantas por fila; 0 = todas en una')
    a = ap.parse_args()

    gente = cargar()
    if a.auditar or not (a.quien or a.todas or a.paises):
        auditar(gente)
        return

    if a.paises:
        elegidos = uno_por_pais(gente)
        if a.salida == 'pais.png':
            a.salida = 'paises.png'
        a.cols = a.cols or 8
        if a.caras:
            n = prestar_caras(elegidos)
            print('⚠️ caras de muestra: %d repartidas entre %d cartas. NINGUNA es'
                  % (n, len(elegidos)))
            print('   de la persona que dice el nombre — es una hoja de diseño.')
    elif a.todas:
        elegidos = [p for p in gente if p['cc']]
    else:
        por_nombre = {norm(p['nombre']): p for p in gente}
        elegidos, faltan = [], []
        for q in a.quien:
            p = por_nombre.get(norm(q))
            (elegidos if p else faltan).append(p if p else q)
        if faltan:
            print('no estan en el pool: %s' % ', '.join(faltan))
            return
    sin = [p['nombre'] for p in elegidos if not p['cc']]
    if sin:
        print('⚠️ sin pais, no se les emite carta: %s' % ', '.join(sin))
        elegidos = [p for p in elegidos if p['cc']]
    if not elegidos:
        return
    asyncio.run(dibujar(elegidos, a.salida,
                        a.cols or (12 if len(elegidos) > 12 else 0)))


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
