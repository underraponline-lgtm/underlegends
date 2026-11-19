# -*- coding: utf-8 -*-
"""🏷️ EL APODO DE CADA UNO EN DISCORD: SEIS ESTILOS (Dlx, 18/11/2026).

    python bot/apodo.py --auto     el self-check: los casos de `bot/apodo_casos.json`

Dlx: *«estaba pensando que hayan 2 opciones apodos, en vez del comando de numeración sea otro… que tengas opciones e
incluso para combinar, por ejemplo gente que está en una crew… las siglas y luego el nombre»*. A las preguntas: las cuatro
piezas (el #N, la crew, la bandera y el rango) y *«tendremos que meter algo para temporada también… me gusta eso de # para
el competitivo»* → la Temporada con «40º»; separadas con barras, *«#23 | FLB | Bloody»*; por defecto, *«#N y la crew»*;
*«tampoco que hayan bastantes combinaciones… y que el ELO se muestre con un emoji»* → seis estilos listos y una piedra
por división del ELO.

    1  #23 | FLB | Bloody     el puesto del Competitivo (el de siempre) — POR DEFECTO
    2  40º | FLB | Bloody     el puesto de la Temporada
    3  💎 | FLB | Bloody      la división del ELO
    4  🇨🇴 | FLB | Bloody      tu bandera
    5  B- | FLB | Bloody      tu rango del Competitivo
    6  Bloody                 solo el nombre

⚠️ UNA PIEZA QUE NO TIENES NO VA, Y NO DEJA UNA BARRA SUELTA: sin crew, «#23 | Bloody»; sin número, «FLB | Bloody»; sin
ninguna de las dos, el nombre solo. El #N y la letra son de quien entró al Competitivo (10 eventos y miembro, `pos` hasta
`total`), como siempre.

⚠️ ESTE ARCHIVO TIENE UN GEMELO EN JS, `bot/apodo.js`: el ciclo (`herramientas/sincronizar_puesto.py`) arma el apodo de
todos y `/apodo` (bot/worker.js) lo cambia al toque en el servidor donde lo pediste. Si arman distinto, el ciclo
«corrige» lo que el bot acaba de poner, cada media hora. Los dos pasan los mismos casos de `bot/apodo_casos.json`: si se
toca uno y no el otro, CI se pone rojo (`bot/apodo_prueba.mjs` y este `--auto`).

⚠️ DISCORD CORTA EL APODO EN 32: se acorta EL NOMBRE, nunca la marca ni la sigla. Se mide en unidades de UTF-16 (lo que
cuenta `.length` en JS): con un emoji adelante es un poco más estricto que contar letras, y así ningún apodo que armamos
puede rebotar por largo.
"""
import io
import json
import os
import re
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CASOS = os.path.join(BASE, 'bot', 'apodo_casos.json')

#: (número, nombre corto, ejemplo). El ejemplo es Bloody: #23 del Competitivo, 40º en la Temporada, Diamante en el ELO,
#: Colombia, B- y Follombia (FLB)
ESTILOS = (
    (1, 'Competitivo', '#23 | FLB | Bloody'),
    (2, 'Temporada', '40º | FLB | Bloody'),
    (3, 'ELO', '💎 | FLB | Bloody'),
    (4, 'Bandera', '🇨🇴 | FLB | Bloody'),
    (5, 'Rango', 'B- | FLB | Bloody'),
    (6, 'Solo el nombre', 'Bloody'),
)
POR_DEFECTO = 1
SOLO_NOMBRE = 6
#: la piedra de cada división del ELO, de arriba abajo: el orden de `bot/divisiones.PIEDRAS` (Mítico, Diamante, Rubí,
#: Zafiro, Jade, Hierro). Dlx eligió las piedras (18/11/2026) sobre los corazones y los círculos de color
ELO = ('🔮', '💎', '♦️', '🔷', '🟢', '⚙️')
TOPE = 32
SEP = ' | '

_RI = '\U0001F1E6-\U0001F1FF'
_BANDERA = re.compile('^[%s]{2}$' % _RI)
_RANGO = re.compile(r'^(SSS|SS|S|[ABCD][+-]?|E)$')
_PUESTO = re.compile(r'^#\s*\d+$')
_TEMPORADA = re.compile(r'^\d+\s*º$')
_ELO = {e.replace('️', '') for e in ELO}


def largo(s):
    """El largo como lo cuenta JS (`.length`): unidades de UTF-16."""
    return len(s.encode('utf-16-le')) // 2


def bandera(cc):
    """«co» -> 🇨🇴 · lo que no son dos letras -> ''."""
    cc = str(cc or '').strip().lower()
    if not re.match(r'^[a-z]{2}$', cc):
        return ''
    return ''.join(chr(0x1F1E6 + ord(c) - 97) for c in cc)


def sin_bandera(s):
    return re.sub('[%s]' % _RI, '', s or '').strip()


def recortar(nombre, cabe):
    """El nombre hasta `cabe` unidades de UTF-16, sin partir un emoji ni dejar media bandera."""
    out, n = [], 0
    for ch in nombre:
        w = largo(ch)
        if n + w > cabe:
            break
        out.append(ch)
        n += w
    t = ''.join(out)
    # media bandera: una cantidad impar de letras regionales al final
    cola = len(t) - len(t.rstrip(''.join(chr(c) for c in range(0x1F1E6, 0x1F200))))
    if cola % 2:
        t = t[:-1]
    return t.rstrip()


def adelante(estilo, p):
    """La marca de adelante de ese estilo con esas piezas, o '' si no la tiene."""
    p = p or {}
    if estilo == 1 and p.get('c'):
        return '#%d' % int(p['c'])
    if estilo == 2 and p.get('t'):
        return '%dº' % int(p['t'])
    if estilo == 3 and isinstance(p.get('e'), int) and 0 <= p['e'] < len(ELO):
        return ELO[p['e']]
    if estilo == 4:
        return bandera(p.get('b'))
    if estilo == 5 and p.get('r'):
        return str(p['r'])
    return ''


def armar(estilo, nombre, piezas):
    """El apodo: «<marca> | <SIGLA> | <nombre>», con lo que haya. `piezas`: {c: #N, t: puesto de la Temporada, e: división
    del ELO (0 Mítico … 5 Hierro), b: país, r: rango, k: sigla de la crew}."""
    estilo = estilo if estilo in (1, 2, 3, 4, 5, 6) else POR_DEFECTO
    p = piezas or {}
    marca = adelante(estilo, p)
    sigla = '' if estilo == SOLO_NOMBRE else str(p.get('k') or '').strip()
    nombre = (nombre or '').strip()
    if estilo == 4 and marca:
        nombre = sin_bandera(nombre)          # la bandera ya va adelante
    partes = [x for x in (marca, sigla) if x]
    if not partes:
        return recortar(nombre, TOPE)
    pre = SEP.join(partes)
    if not nombre:
        return pre[:TOPE]
    return pre + SEP + recortar(nombre, TOPE - largo(pre + SEP))


def es_nuestra(seg, siglas=(), piezas=None):
    """¿Es una marca que pone la Liga? El #N, el «40º», una piedra o la sigla de una crew, siempre. ⚠️ Una bandera o una
    letra sola, SÓLO si son las de esa persona (`piezas`): mucha gente lleva su bandera adelante por su cuenta («🇫🇷 |
    Valᴺᴷ»), y sacársela le borra el país del apodo —que es de donde `autoverificar.py` lo lee cuando no hay rol—. Medido
    el 18/11/2026: sin esto, el primer plan le sacaba la bandera a uno que nunca eligió nada."""
    s = (seg or '').strip()
    if not s:
        return False
    p = piezas or {}
    if _BANDERA.match(s):
        return bool(p.get('b')) and s == bandera(p.get('b'))
    if _RANGO.match(s):
        return bool(p.get('r')) and s == str(p.get('r'))
    return bool(_PUESTO.match(s) or _TEMPORADA.match(s) or s.replace('️', '') in _ELO
                or s.upper() in {str(x).upper() for x in siglas if x})


def nombre_de(apodo):
    """El nombre de un apodo: lo que va después de la última barra. «#23 | FLB | Bloody» -> «Bloody» · «🐉 | Vandu» ->
    «Vandu» · «#5» -> «» (un apodo que era sólo el número) · «Bloody» -> «Bloody»."""
    a = (apodo or '').strip()
    if _PUESTO.match(a):
        return ''
    return a.split('|')[-1].strip()


def solo_nuestras(apodo, siglas=(), piezas=None):
    """¿Todo lo que va antes del nombre lo puso la Liga? (Si no, hay una marca de otro —el 🐉 de DRA— y a quien no tiene
    ninguna pieza no se le toca.) Un apodo sin barras no tiene marcas: False."""
    a = (apodo or '').strip()
    if _PUESTO.match(a):
        return True
    partes = a.split('|')
    return len(partes) > 1 and all(es_nuestra(x, siglas, piezas) for x in partes[:-1])


def decidir(actual, p, estilo, base, siglas=()):
    """El apodo nuevo, o `actual` si no hay que tocarlo; `None` = sin apodo (queda el nombre de la cuenta).

    · Con una marca para poner (el estilo y lo que tiene dan algo más que el nombre), se pone, con `base` (el nombre de
      DRA): como siempre con el «#N», reemplaza la marca que hubiera.
    · Si no, se le SACAN las marcas de la Liga y nada más: a quien no tiene apodo no se le pone uno, y la marca de otro
      (el 🐉 de DRA, la bandera que alguien se puso solo) no se toca."""
    actual = actual or ''
    if p:
        nuevo = armar(estilo, base, p)
        if nuevo != armar(SOLO_NOMBRE, base, p):
            return nuevo
    if actual and solo_nuestras(actual, siglas, p):
        return nombre_de(actual) or None
    return actual


def estilo_valido(v):
    try:
        v = int(v)
    except (TypeError, ValueError):
        return None
    return v if v in (1, 2, 3, 4, 5, 6) else None


def _self_check():
    print('\n══ 🏷️ EL APODO: LOS SEIS ESTILOS ══\n')
    mal = 0

    def ok(que, cond, det=''):
        nonlocal mal
        print('   %s %s%s' % ('✅' if cond else '🔴', que, ('  ' + str(det)) if det else ''))
        mal += 0 if cond else 1
    casos = json.load(io.open(CASOS, encoding='utf-8'))
    for c in casos['armar']:
        sale = armar(c['estilo'], c['nombre'], c.get('piezas'))
        ok('%s → «%s»' % (c['que'], c['sale']), sale == c['sale'], 'salió «%s»' % sale if sale != c['sale'] else '')
        ok('   y entra en 32', largo(sale) <= TOPE, largo(sale))
    for c in casos['nombre']:
        n, s = nombre_de(c['apodo']), solo_nuestras(c['apodo'], casos['siglas'], c.get('piezas'))
        ok('«%s» → nombre «%s», %s' % (c['apodo'], c['nombre'], 'sólo marcas nuestras' if c['nuestras'] else 'no sólo nuestras'),
           n == c['nombre'] and s == c['nuestras'], (n, s) if (n, s) != (c['nombre'], c['nuestras']) else '')
    for c in casos['decidir']:
        sale = decidir(c['actual'], c.get('piezas'), c['estilo'], c['base'], casos['siglas'])
        ok('%s → %s' % (c['que'], json.dumps(c['sale'], ensure_ascii=False)), sale == c['sale'],
           'salió %s' % json.dumps(sale, ensure_ascii=False) if sale != c['sale'] else '')
    ok('seis estilos, el 1 por defecto y el 6 sin marcas', [e[0] for e in ESTILOS] == [1, 2, 3, 4, 5, 6]
       and POR_DEFECTO == 1 and SOLO_NOMBRE == 6)
    ok('los ejemplos de los estilos salen de `armar()` con las piezas de Bloody',
       all(armar(n, 'Bloody', casos['bloody']) == ej for n, _, ej in ESTILOS))
    # ⚠️ el orden del ELO es el de las divisiones: si alguien las reordena allá, acá cambia el emoji de todos
    try:
        sys.path.insert(0, os.path.join(BASE, 'bot'))
        import divisiones as DV
        ok('una piedra por división del ELO, en el mismo orden', len(ELO) == len(DV.PIEDRAS), DV.PIEDRAS)
    except Exception as e:                                # noqa: BLE001
        ok('una piedra por división del ELO', False, e)
    print('\n   %s\n' % ('todo ok' if not mal else '🔴 %d mal' % mal))
    return 1 if mal else 0


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    if '--auto' in sys.argv:
        sys.exit(_self_check())
    for n, t, ej in ESTILOS:
        print('%d  %-16s %s' % (n, t, ej))
