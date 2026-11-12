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


def volcar(hoja, cabecera, filas):
    """El texto del archivo: siempre el mismo para lo mismo, una fila por línea."""
    lineas = [json.dumps(list(f), ensure_ascii=False) for f in filas]
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


def espejar(aplicar=False):
    """Lee las tres hojas y las deja en datos/. Devuelve `{hoja: 'igual' | 'cambió' | 'no'}`."""
    from escribir import Hoja
    import resultados as RES
    out = {}
    for hoja in HOJAS:
        h = Hoja(hoja)
        cru = RES._filas_crudas(h)
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
        try:
            with io.open(ruta(hoja), encoding='utf-8', newline='') as f:
                ya = f.read()
        except OSError:
            ya = None
        if ya == texto:
            print('   %-20s igual (%d fila(s))' % (hoja, len(cru)))
            out[hoja] = 'igual'
            continue
        entran, salen, cambian = resumen((viejo or {}).get('filas') or [], cru)
        print('   %-20s %d fila(s) · eventos: %d nuevo(s), %d cambiado(s), %d que ya no está(n)%s'
              % (hoja, len(cru), len(entran), len(cambian), len(salen),
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
        cru = RES._filas_crudas(Hoja(hoja))
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
