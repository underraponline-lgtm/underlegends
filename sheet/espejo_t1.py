# -*- coding: utf-8 -*-
"""LAS TRES HOJAS DE DATOS DEL OPERATIVO, EN `datos/`. La etapa 1 de sacar el Sheet del medio.

    python sheet/espejo_t1.py              qué cambiaría, sin escribir nada
    python sheet/espejo_t1.py --aplicar    copia `Resultados`, `1v1` y `Eventos Procesados` a datos/ (el ciclo, 2g)
    python sheet/espejo_t1.py --comparar   el Sheet contra los archivos, celda por celda, sin escribir
    python sheet/espejo_t1.py --auto       el self-check, sin red (CI)

🔑 POR QUÉ (Dlx, 11/11/2026). *«¿Es necesario el Google Sheet a este punto?… yo ya no uso el Google Sheet»*, y a la
propuesta de sacarlo por etapas: *«si es que lo que estás proponiendo mejorará todo el sistema y optimizará todo pues
adelante, pero asegúrate de que todo esté bien»*. El Sheet nació como la vitrina de la Liga; con la página es sólo la
base de datos del ciclo, y como base de datos se nos rompió varias veces: `Entrada` llegó a 1.233.156 filas y frenó la
carga del 07 al 09/11 (`escribir.Hoja.recortar()`), el 11/11 la #471 y el ciclo se pisaron usando `Entrada` como mesa
de paso, cada corrida gasta ~2 de sus 10 minutos leyendo y escribiendo el Sheet, y las cartas salen de una vuelta
Sheet → vitrina → Sheet → pool.

LAS ETAPAS, Y CADA UNA SE PASA SÓLO SI DA LO MISMO
---------------------------------------------------
1. **Esto**: el ciclo sigue escribiendo el Sheet y además deja las tres hojas acá, tal cual. Nada lee estos archivos
   todavía; se mira que sigan iguales corrida tras corrida (`--comparar`).
2. Los lectores (las vitrinas, los pools, el padrón…) pasan a leer de acá, de a uno, comparando que lo que calculan
   salga idéntico.
3. Quien escribe (`procesar_entrada`, `resultados`) escribe acá primero, y el Sheet pasa a ser la copia.
4. La Lista, los AKAs y `Config`, lo mismo. Al final Dlx elige: espejo de sólo lectura o se apaga.

⚠️ EL VALOR DE VERDAD, NO LO QUE SE VE. Se guarda lo de `resultados._filas_crudas()` (`UNFORMATTED_VALUE`: los
números, números) y lo visible sale de ahí (`visible()`). Medido el 11/11/2026 sobre las 5.453 filas de las tres hojas:
las dos lecturas dan **0 celdas distintas**, así que no se pierde nada. Y cada `--aplicar` lo vuelve a medir: si algún
día una celda se ve distinta de su valor (un formato de número, una fecha), lo dice en vez de copiar algo que los
lectores leerían distinto.

⚠️ EL ORDEN DE LAS FILAS ES EL DEL SHEET. `rankings.py` ordena por evento y fecha, pero DENTRO de un evento manda el
orden de las filas (la racha de duelos): por eso es una lista y no un mapa por evento.

⚠️ UNA FILA POR LÍNEA Y SIN HORA ADENTRO. El ciclo commitea esto cada media hora: con una línea por fila, un evento
nuevo es un diff de veinte líneas y no un archivo entero; y sin la hora de la copia, una corrida sin cambios no escribe
nada (`guardar.sh` dice «nada cambió»).

🔴 NUNCA ACHICA A MENOS DE LA MITAD. Una lectura que vuelve vacía o cortada es el Sheet fallando, no la Liga perdiendo
la mitad de sus resultados: se planta y lo dice. La temporada que arranca de cero tiene sus propios archivos
(`t2_…`), así que el caso legítimo no pasa por acá.
"""
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path[:0] = [SCR, BASE]
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

from comun.temporada import ACTUAL                          # noqa: E402

#: hoja del Operativo -> nombre del archivo (`datos/<temporada>_<nombre>.json`)
HOJAS = {'Resultados': 'resultados', '1v1': '1v1', 'Eventos Procesados': 'eventos'}
#: una lectura que trae menos que esto de lo que ya había no se copia (ver el encabezado)
PISO = 0.5


def ruta(hoja, temp=ACTUAL, base=BASE):
    return os.path.join(base, 'datos', '%s_%s.json' % (temp, HOJAS[hoja]))


def visible(c):
    """Lo que el Sheet MUESTRA de un valor de verdad (lo que da `Hoja.filas()`)."""
    if isinstance(c, bool):
        return 'TRUE' if c else 'FALSE'
    if isinstance(c, float) and c.is_integer():
        return str(int(c))
    return str(c)


def normal(f):
    """La fila como la devuelve el Sheet al leerla: sin las celdas vacías del final, `None` como vacío y un `1250.0`
    como `1250` (la API no manda «.0»). Así lo que deja quien escribe y lo que copia el paso 2g dan el mismo texto."""
    f = ['' if c is None else (int(c) if isinstance(c, float) and c.is_integer() else c) for c in f]
    while f and f[-1] == '':
        f.pop()
    return f


def volcar(hoja, cabecera, filas):
    """El texto del archivo: siempre el mismo para lo mismo, una fila por línea."""
    lineas = [json.dumps(normal(f), ensure_ascii=False) for f in filas]
    return ('{\n "hoja": %s,\n "cabecera": %s,\n "filas": [\n%s\n ]\n}\n'
            % (json.dumps(hoja, ensure_ascii=False), json.dumps(list(cabecera), ensure_ascii=False),
               ',\n'.join('  ' + x for x in lineas))) if filas else (
        '{\n "hoja": %s,\n "cabecera": %s,\n "filas": []\n}\n'
        % (json.dumps(hoja, ensure_ascii=False), json.dumps(list(cabecera), ensure_ascii=False)))


def leer(hoja, temp=ACTUAL, base=BASE):
    """`{'hoja', 'cabecera', 'filas'}` del archivo, o `None` si todavía no hay."""
    try:
        with io.open(ruta(hoja, temp, base), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def crudas(hoja, temp=ACTUAL, base=BASE):
    """Las filas con su valor de verdad, como `resultados._filas_crudas()`."""
    d = leer(hoja, temp, base)
    return [list(f) for f in (d or {}).get('filas') or []]


def filas(hoja, temp=ACTUAL, base=BASE):
    """Las filas como se ven, como `Hoja(hoja).filas()`."""
    return [[visible(c) for c in f] for f in crudas(hoja, temp, base)]


#: 🔎 LA PRUEBA DE LA ETAPA 2 (11/11/2026). Prendida, `fuente()` lee el archivo Y el Sheet, los compara, y si dan
#: distinto usa el Sheet —todavía es la fuente— y lo dice en rojo: lo que calcula cada lector sale idéntico a antes por
#: construcción. Se apaga, y con eso el Sheet deja de leerse, cuando varias corridas seguidas del ciclo dieron «igual»
#: en todos los lectores (se ve en el log: una línea por hoja y por proceso).
CONTROL = True
#: lo que ya se comparó en este proceso, `{hoja: igual}`: un lector que pide la misma hoja dos veces la dice una vez
_VISTO = {}


def fuente(hoja, lector='', base=BASE):
    """🗄️ Las filas de `hoja` como las da `Hoja(hoja).filas()`, pero desde datos/: lo que usan los lectores en vez de
    leer el Sheet (etapa 2). Sin archivo, el Sheet. Con `CONTROL`, ver arriba."""
    mio = filas(hoja, base=base) if leer(hoja, base=base) is not None else None
    if mio is not None and not CONTROL:
        return mio
    from escribir import Hoja
    sh = [[str(c) for c in f] for f in Hoja(hoja).filas()]
    de = ' (%s)' % lector if lector else ''
    if mio is None:
        print('   ⚠️ %s: no está en datos/, leo el Sheet%s' % (hoja, de))
        return sh
    igual = sh == mio
    if _VISTO.get(hoja) != igual:
        print('   %s %s desde datos/: %s%s' % ('🗄️' if igual else '🔴', hoja, 'igual al Sheet' if igual else
              'DISTINTO del Sheet (%d contra %d filas): uso el Sheet' % (len(mio), len(sh)), de))
    _VISTO[hoja] = igual
    return mio if igual else sh


def _num(f):
    return visible(f[0]).strip() if f else ''


def resumen(antes, ahora):
    """Qué cambió, por evento: `(entran, salen, cambian)` como conjuntos de números."""
    def por_ev(fs):
        d = {}
        for f in fs:
            d.setdefault(_num(f), []).append(json.dumps(f, ensure_ascii=False))
        return d
    a, b = por_ev(antes), por_ev(ahora)
    return (set(b) - set(a), set(a) - set(b), {n for n in set(a) & set(b) if a[n] != b[n]})


def decidir(hoja, viejo, nuevas):
    """`(escribir, motivo)`: si una lectura nueva puede reemplazar al archivo. Pura."""
    antes = len((viejo or {}).get('filas') or [])
    if antes and len(nuevas) < antes * PISO:
        return False, ('🔴 %s: el Sheet trajo %d fila(s) y el archivo tiene %d. Una caída así es el Sheet fallando: '
                       'no la copio' % (hoja, len(nuevas), antes))
    return True, ''


def _texto_de(p):
    try:
        with io.open(p, encoding='utf-8', newline='') as f:
            return f.read().replace('\r\n', '\n')
    except OSError:
        return None


def al_escribir(hoja, cabecera, filas, base=BASE):
    """🖊️ Lo llaman los que escriben estas hojas (`resultados.reescribir()` y `renombrar_varios()`) con la tabla
    ENTERA que acaban de dejar en el Sheet: el archivo queda al día en el mismo momento, no al final de la corrida,
    que es lo que necesita un lector que lea de acá en la misma corrida (etapa 2). `True` si cambió el archivo.
    ⚠️ NUNCA LEVANTA: si no puede, lo dice y lo copia el paso 2g. El Sheet sigue siendo la fuente en esta etapa."""
    if hoja not in HOJAS:
        return None
    try:
        fs = [normal(f) for f in filas if any(str(c).strip() for c in f)]
        p = ruta(hoja, base=base)
        viejo = leer(hoja, base=base)
        ok, motivo = decidir(hoja, viejo, fs)
        if not ok:
            print('   ' + motivo)
            return None
        texto = volcar(hoja, cabecera, fs)
        if _texto_de(p) == texto:
            return False
        with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
            f.write(texto)
        return True
    except Exception as e:                                 # noqa: BLE001
        print('   ⚠️ no pude dejar %s en datos/ (%s): lo copia el paso 2g' % (hoja, str(e)[:80]))
        return None


def espejar(aplicar=False):
    """Lee las tres hojas y las deja en datos/. Devuelve `{hoja: 'igual' | 'cambió' | 'no'}`."""
    from escribir import Hoja
    import resultados as RES
    out = {}
    for hoja in HOJAS:
        h = Hoja(hoja)
        cru = [normal(f) for f in RES._filas_crudas(h)]
        # ⚠️ lo que se ve tiene que ser lo que sale del valor de verdad: si no, los lectores leerían otra cosa
        vis = h.filas()
        emul = [[visible(c) for c in f] for f in cru]
        distintas = sum(1 for a, b in zip(vis, emul) if [str(x) for x in a] != b) + abs(len(vis) - len(emul))
        if distintas:
            print('   🔴 %s: %d fila(s) se ven distinto de su valor de verdad: no la copio (ver el encabezado)'
                  % (hoja, distintas))
            out[hoja] = 'no'
            continue
        viejo = leer(hoja)
        ok, motivo = decidir(hoja, viejo, cru)
        if not ok:
            print('   ' + motivo)
            out[hoja] = 'no'
            continue
        texto = volcar(hoja, h.cabecera, cru)
        ya = _texto_de(ruta(hoja))
        if ya == texto:
            print('   %-20s igual (%d fila(s))' % (hoja, len(cru)))
            out[hoja] = 'igual'
            continue
        entran, salen, cambian = resumen((viejo or {}).get('filas') or [], cru)
        # 🔴 desde que los que escriben dejan el archivo (`al_escribir()`), acá tiene que dar siempre «igual»: si no,
        # alguien escribió el Sheet por otro camino, y en la etapa 2 un lector habría leído algo viejo
        print('   %s%-20s %d fila(s) · eventos: %d nuevo(s), %d cambiado(s), %d que ya no está(n)%s'
              % ('🔴 atrasado: ' if viejo else '', hoja, len(cru), len(entran), len(cambian), len(salen),
                 '' if aplicar else '  [sin --aplicar: no escribo]'))
        if aplicar:
            with io.open(ruta(hoja), 'w', encoding='utf-8', newline='\n') as f:
                f.write(texto)
        out[hoja] = 'cambió'
    return out


def comparar():
    """El Sheet contra los archivos. 0 si son iguales."""
    from escribir import Hoja
    import resultados as RES
    malas = 0
    for hoja in HOJAS:
        cru = [normal(f) for f in RES._filas_crudas(Hoja(hoja))]
        mio = crudas(hoja)
        if cru == mio:
            print('   ✅ %-20s igual: %d fila(s)' % (hoja, len(mio)))
            continue
        malas += 1
        entran, salen, cambian = resumen(mio, cru)
        print('   🔴 %-20s el Sheet %d fila(s), el archivo %d · en el Sheet y no acá: %s · cambian: %s · acá y no '
              'en el Sheet: %s' % (hoja, len(cru), len(mio), sorted(entran)[:8], sorted(cambian)[:8], sorted(salen)[:8]))
    return 1 if malas else 0


def _self_check():
    import tempfile
    fallas = 0

    def ok(cond, que):
        nonlocal fallas
        print('   %s %s' % ('✅' if cond else '🔴', que))
        if not cond:
            fallas += 1

    cab = ['Evento #', 'Fecha', 'Rapero', 'Puntos', 'Notas']
    fs = [[471, '14/10', 'Teito', 1250], [471, '14/10', 'Geoka', 1250.0, 'Nadie siguió'], [472, '15/10', 'Ñandú 🇦🇷', 833.5]]
    t = volcar('Resultados', cab, fs)
    d = json.loads(t)
    ok(d['filas'] == [list(f) for f in fs] and d['cabecera'] == cab and volcar('Resultados', cab, d['filas']) == t,
       'volcar y leer dan lo mismo, y volcar lo leído da el mismo texto (sin hora adentro)')
    ok(t.count('\n') == len(fs) + 6 and '"Ñandú 🇦🇷"' in t, 'una fila por línea, sin escapar los acentos ni las banderas')
    ok(json.loads(volcar('1v1', cab, []))['filas'] == [], 'una hoja vacía es un archivo válido')
    ok([visible(c) for c in [471, 1250.0, 833.5, '', True, '14/10']] == ['471', '1250', '833.5', '', 'TRUE', '14/10'],
       'lo visible: los enteros sin «.0», el resto tal cual')
    e, s, c = resumen(fs, [fs[0], [471, '14/10', 'Geoka', 1250, 'x'], [473, '16/10', 'Otro', 1]])
    ok(e == {'473'} and s == {'472'} and c == {'471'}, 'el resumen dice qué eventos entran, salen y cambian')
    ok(decidir('R', {'filas': fs * 10}, fs)[0] is False and decidir('R', {'filas': fs}, fs[:2])[0] is True
       and decidir('R', None, [])[0] is True, 'nunca achica a menos de la mitad; sin archivo, copia lo que haya')
    with tempfile.TemporaryDirectory() as tmp:
        os.makedirs(os.path.join(tmp, 'datos'))
        with io.open(ruta('Resultados', 't9', tmp), 'w', encoding='utf-8', newline='\n') as f:
            f.write(t)
        ok(crudas('Resultados', 't9', tmp) == [list(x) for x in fs]
           and filas('Resultados', 't9', tmp)[1] == ['471', '14/10', 'Geoka', '1250', 'Nadie siguió']
           and leer('1v1', 't9', tmp) is None and filas('1v1', 't9', tmp) == [],
           'los archivos se leen como el Sheet: crudas, visibles, y sin archivo no hay filas')
    ok(normal([471, 1250.0, '', 'x', '', None]) == [471, 1250, '', 'x'] and normal(['', '']) == [],
       'una fila como la devuelve el Sheet: sin vacías al final, «1250.0» es 1250')
    with tempfile.TemporaryDirectory() as tmp:
        os.makedirs(os.path.join(tmp, 'datos'))
        pad = [list(f) + [''] * (5 - len(f)) for f in fs]
        r1 = al_escribir('Resultados', cab, pad, base=tmp)
        r2 = al_escribir('Resultados', cab, fs, base=tmp)
        mal = al_escribir('Resultados', cab, fs[:1], base=tmp)
        r4 = al_escribir('Resultados', cab, fs + [[473, '16/10', 'Otro', 1.0, '']], base=tmp)
        ok(r1 is True and r2 is False and mal is None and len(crudas('Resultados', base=tmp)) == 4 and r4 is True
           and crudas('Resultados', base=tmp)[3] == [473, '16/10', 'Otro', 1]
           and al_escribir('Lista de Raperos', cab, fs, base=tmp) is None,
           'quien escribe deja el archivo: con relleno o sin él es el mismo texto, no lo achica y sólo las tres hojas')
    # 🔎 fuente(): con la prueba prendida compara con el Sheet (acá, uno de mentira) y si dan distinto gana el Sheet
    global CONTROL
    import types
    real, ctrl = sys.modules.get('escribir'), CONTROL
    hoja_falsa = {'filas': [['471', '14/10', 'Teito', '1250'], ['471', '14/10', 'Geoka', '1250', 'Nadie siguió']]}
    falso = types.ModuleType('escribir')
    falso.Hoja = lambda nombre: types.SimpleNamespace(filas=lambda: [list(f) for f in hoja_falsa['filas']])
    sys.modules['escribir'] = falso
    try:
        with tempfile.TemporaryDirectory() as tmp:
            os.makedirs(os.path.join(tmp, 'datos'))
            sin = fuente('Resultados', base=tmp)
            al_escribir('Resultados', cab, fs[:2], base=tmp)
            _VISTO.clear()
            igual = fuente('Resultados', base=tmp)
            hoja_falsa['filas'] = hoja_falsa['filas'] + [['472', '15/10', 'Nuevo', '1']]
            distinto = fuente('Resultados', base=tmp)
            CONTROL = False
            hoja_falsa['filas'] = []
            apagado = fuente('Resultados', base=tmp)
        ok(sin == [['471', '14/10', 'Teito', '1250'], ['471', '14/10', 'Geoka', '1250', 'Nadie siguió']]
           and igual == sin and len(distinto) == 3 and distinto[2][2] == 'Nuevo' and apagado == sin,
           'fuente(): sin archivo lee el Sheet; igual, el archivo; distinto, el Sheet; con la prueba apagada, sólo el archivo')
    finally:
        CONTROL = ctrl
        _VISTO.clear()
        if real is not None:
            sys.modules['escribir'] = real
        else:
            sys.modules.pop('escribir', None)
    ok(set(HOJAS) == {'Resultados', '1v1', 'Eventos Procesados'}
       and ruta('1v1').endswith(os.path.join('datos', ACTUAL + '_1v1.json')), 'las tres hojas, con la temporada en el nombre')
    print('\n   %s' % ('✅ todo bien' if not fallas else '🔴 %d mal' % fallas))
    return 1 if fallas else 0


def main():
    a = sys.argv[1:]
    if '--auto' in a:
        return _self_check()
    if '--comparar' in a:
        print('\n══ EL SHEET CONTRA datos/ ══\n')
        return comparar()
    print('\n══ EL OPERATIVO, EN datos/ (etapa 1) ══\n')
    r = espejar(aplicar='--aplicar' in a)
    # ⚠️ NUNCA FRENA EL CICLO: una hoja que no se copia queda como estaba, y lo dice arriba
    return 0 if r else 0


if __name__ == '__main__':
    sys.exit(main())
