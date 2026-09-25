# -*- coding: utf-8 -*-
"""LA LISTA DE RAPEROS: agregar a alguien, ponerle su ID y fusionar dobles.

    python sheet/lista_raperos.py --fusionar                 qué fusionaría
    python sheet/lista_raperos.py --fusionar --aplicar       lo hace
    python sheet/lista_raperos.py --agregar NOMBRE CC ID ["nota"] [--aplicar]
    python sheet/lista_raperos.py --id NOMBRE ID [--aplicar]
    python sheet/lista_raperos.py --sacar-no-confundir A B [--aplicar]

Sin `--aplicar` no escribe nada: dice qué haría.

🔴 NACE DE LAS RESPUESTAS DE DLX DEL 25/09/2026, que piden tocar la Lista
de maneras que ningún script sabía hacer:

    #2   CJ es @cj_kloke_                  -> ponerle su Discord ID
    #5   Solar entra con su ID             -> una fila nueva
    #11  quien usa /card y no está, entra  -> una fila nueva, sola
    #12  «fusionalas, pero guarda las diferentes akas»

⚠️ NUNCA TOCA DE LA COLUMNA K PARA LA DERECHA. Ahí vive el panel
`📊 Totales` (ver `panel_padron.py`), pegado a las filas de datos: escribir
«la fila entera» lo pisaría. Todo va de A a J.

⚠️ RESPALDO ANTES DE ESCRIBIR, siempre, en `docs/respaldo_ids_lista_*.json`
—ignorado por git, porque trae Discord IDs de gente—. Y después se relee:
`escribir.poner()` comprueba lo que quedó, no confía en el 200.

⚠️ FUSIONAR NO BORRA EL ALIAS DE NINGUN LADO QUE IMPORTE. La fila doble es
doble justamente porque la hoja AKAs ya dice «X es Y»: esa línea se queda,
así que las llaves que escriban X siguen cayendo en Y. Lo que se va es la
segunda fila de la Lista —la que hacía contar a la misma persona dos
veces—, y antes de irse le pasa a la otra lo que ésta no tenía: el ID, el
país, la foto, la verificación y sus notas.

⚠️ DOS IDS DISTINTOS NO SE FUSIONAN. Si la fila doble y la real tienen
cada una un Discord ID y no son el mismo, son dos cuentas: eso lo decide
Dlx, no este script. Se avisa y se saltea.
"""
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)

import construir_padron as PAD  # noqa: E402

HOJA = 'Lista de Raperos'
HOJA_AKAS = 'AKAs'
#: las columnas de la Lista que este script puede escribir, de A a J
COLUMNAS = ('Rapero', 'Bandera', 'SV', 'Verificado', 'Discord ID', 'Avatar',
            'Notas', 'Nombre', 'País', 'Crew')
#: de peor a mejor: una fusión se queda con la mejor de las dos
VERIFICADO = ('', '❌', '❓', '✅')


def _E():
    import escribir as E
    return E


def _ahora_et():
    import datetime as d
    import zoneinfo as z
    t = d.datetime.now(z.ZoneInfo('America/New_York'))
    return t.strftime('%d/%m/%Y ') + t.strftime('%I:%M %p').lstrip('0') + ' ET'


def _rango(hoja, a1):
    return "'%s'!%s" % (hoja, a1)


def leer(hoja=HOJA):
    """Los valores de la hoja, como los ve la gente (texto formateado)."""
    E = _E()
    from urllib.parse import quote
    r = E._pedir('GET', '/values/%s' % quote(_rango(hoja, 'A1:J4000')))
    return r.get('values') or []


def mapa(v):
    """(índice de la cabecera, {columna: índice})."""
    i = PAD._cabecera(v)
    cab = [x.strip() for x in v[i]]
    return i, {c: cab.index(c) for c in COLUMNAS if c in cab}


def _celda(fila, j):
    return (fila[j] if j is not None and j < len(fila) else '').strip()


def filas_de(v, nombre):
    """[(número de fila, fila)] de quien se llama así (sin bandera ni tildes)."""
    i, col = mapa(v)
    n = PAD.norm(nombre)
    return [(k + 1, f) for k, f in enumerate(v) if k > i
            and PAD.norm(PAD.limpio(_celda(f, col['Rapero']))) == n]


def respaldar(v, que):
    import datetime as d
    import zoneinfo as z
    t = d.datetime.now(z.ZoneInfo('America/New_York')).strftime('%Y%m%d_%H%M')
    p = os.path.join(BASE, 'docs', 'respaldo_ids_lista_%s_%s.json' % (t, que))
    with io.open(p, 'w', encoding='utf-8') as f:
        json.dump(v, f, ensure_ascii=False)
    print('   respaldo -> %s' % os.path.relpath(p, BASE))


def _bandera(cc):
    cc = (cc or '').lower()
    if len(cc) != 2 or not cc.isalpha():
        return ''
    return chr(0x1F1E6 + ord(cc[0]) - 97) + chr(0x1F1E6 + ord(cc[1]) - 97)


def _pais_de(v, cc):
    """El nombre del país como lo escribe la Lista, sacado de la Lista."""
    i, col = mapa(v)
    for f in v[i + 1:]:
        if _celda(f, col.get('País')).lower() == cc.lower() and _celda(f, col.get('Bandera')):
            return _celda(f, col['Bandera'])
    return ''


def _id_usado(v, did, salvo=None):
    i, col = mapa(v)
    for k, f in enumerate(v):
        if k > i and k + 1 != salvo and _celda(f, col.get('Discord ID')) == did:
            return k + 1, _celda(f, col['Rapero'])
    return None


# ── agregar ────────────────────────────────────────────────────────────
def agregar(nombre, cc, did, nota='', aplicar=False):
    """Una fila nueva al final de la Lista. Devuelve el número de fila o None."""
    v = leer()
    i, col = mapa(v)
    if filas_de(v, nombre):
        print('   ⚠️ «%s» ya está en la Lista (fila %d): no se agrega'
              % (nombre, filas_de(v, nombre)[0][0]))
        return None
    if did:
        otro = _id_usado(v, did)
        if otro:
            print('   ⚠️ el ID %s ya es de «%s» (fila %d): no se agrega'
                  % (did, otro[1], otro[0]))
            return None
    ultima = max(k + 1 for k, f in enumerate(v) if k > i and _celda(f, col['Rapero']))
    n = ultima + 1
    fila = [''] * len(COLUMNAS)
    pon = lambda c, x: fila.__setitem__(COLUMNAS.index(c), x)
    pon('Rapero', ('%s %s' % (nombre, _bandera(cc))).strip())
    pon('Bandera', _pais_de(v, cc))
    pon('Verificado', '❓')
    pon('Discord ID', did or '')
    pon('Notas', nota)
    pon('Nombre', nombre)
    pon('País', (cc or '').lower())
    print('   fila %d  %s' % (n, ' | '.join(fila)))
    if not aplicar:
        return n
    respaldar(v, 'agregar')
    _E().poner(_rango(HOJA, 'A%d:J%d' % (n, n)), [fila])
    print('   ✅ agregado')
    return n


# ── poner un Discord ID ────────────────────────────────────────────────
def poner_id(nombre, did, aplicar=False):
    v = leer()
    i, col = mapa(v)
    fs = filas_de(v, nombre)
    if len(fs) != 1:
        print('   ⚠️ «%s» está %d veces en la Lista: no sé a cuál ponerle el ID'
              % (nombre, len(fs)))
        return False
    n, f = fs[0]
    ya = _celda(f, col['Discord ID'])
    if ya == did:
        print('   ya tenía ese ID')
        return True
    if ya:
        print('   ⚠️ «%s» ya tiene otro ID (%s): eso lo decide Dlx' % (nombre, ya))
        return False
    otro = _id_usado(v, did, salvo=n)
    if otro:
        print('   ⚠️ el ID %s ya es de «%s» (fila %d)' % (did, otro[1], otro[0]))
        return False
    letra = chr(ord('A') + col['Discord ID'])
    print('   fila %d  %s  ->  %s%d = %s' % (n, _celda(f, col['Rapero']), letra, n, did))
    if aplicar:
        respaldar(v, 'id')
        _E().poner(_rango(HOJA, '%s%d' % (letra, n)), [[did]])
        print('   ✅ puesto')
    return True


# ── fusionar dobles ────────────────────────────────────────────────────
def dobles():
    """[(alias, real)] como los cuenta `construir_akas.py` en cada corrida."""
    with io.open(os.path.join(BASE, 'datos', 'akas.json'), encoding='utf-8') as f:
        alias = json.load(f).get('alias') or {}
    padron = PAD.cargar()
    nombres = {PAD.norm(p['raw']) for p in padron}
    return [(p['raw'], alias[PAD.norm(p['raw'])]) for p in padron
            if PAD.norm(p['raw']) in alias
            and PAD.norm(alias[PAD.norm(p['raw'])]) in nombres
            and PAD.norm(alias[PAD.norm(p['raw'])]) != PAD.norm(p['raw'])]


def _mezcla(real, doble, col, alias_full):
    """La fila real con lo que la doble tenía y ella no. None si chocan IDs."""
    out = list(real) + [''] * (len(COLUMNAS) - len(real))
    out = out[:len(COLUMNAS)]
    for c in ('Bandera', 'SV', 'Discord ID', 'Avatar', 'País', 'Crew'):
        j = col.get(c)
        if j is None:
            continue
        a, b = _celda(real, j), _celda(doble, j)
        if c == 'Discord ID' and a and b and a != b:
            return None
        if not a and b:
            out[j] = b
    j = col.get('Verificado')
    if j is not None:
        a, b = _celda(real, j), _celda(doble, j)
        ra = VERIFICADO.index(a) if a in VERIFICADO else 0
        rb = VERIFICADO.index(b) if b in VERIFICADO else 0
        out[j] = b if rb > ra else a
    j = col.get('Notas')
    if j is not None:
        partes = [x for x in (_celda(real, j), _celda(doble, j)) if x]
        partes.append('fusionada con «%s» (Dlx, %s)' % (alias_full, _ahora_et()))
        vistas = []
        for x in partes:
            if x not in vistas:
                vistas.append(x)
        out[j] = ' · '.join(vistas)[:480]
    return out


def fusionar(aplicar=False):
    v = leer()
    i, col = mapa(v)
    plan, cambios, borrar = [], [], []
    for a, r in dobles():
        fa, fr = filas_de(v, a), filas_de(v, r)
        if len(fr) != 1 or not fa:
            print('   ⚠️ %s -> %s: %d fila(s) del alias y %d del real; se saltea'
                  % (a, r, len(fa), len(fr)))
            continue
        nr, real = fr[0]
        fila = real
        for na, doble in fa:
            m = _mezcla(fila, doble, col, _celda(doble, col['Rapero']))
            if m is None:
                print('   ⚠️ %s -> %s: tienen DOS Discord ID distintos; se saltea'
                      % (a, r))
                break
            fila = m
            borrar.append(na)
        else:
            cambios.append((nr, fila))
            plan.append((a, r, nr, [n for n, _ in fa]))
    for a, r, nr, ns in plan:
        print('   %-12s -> %-12s  queda la fila %d, se va la %s'
              % (a, r, nr, ', '.join(str(x) for x in ns)))
    for nr, fila in cambios:
        print('      fila %d: %s' % (nr, ' | '.join(fila[:8])[:150]))
    if not aplicar or not plan:
        print('\n   %d fusión(es)%s' % (len(plan), '' if aplicar else ' — nada escrito (falta --aplicar)'))
        return plan
    respaldar(v, 'fusion')
    E = _E()
    # 1 · primero las filas reales, con lo que heredan (antes de borrar:
    # borrar corre los números de las filas de abajo)
    E._pedir('POST', '/values:batchUpdate', json={
        'valueInputOption': 'RAW',
        'data': [{'range': _rango(HOJA, 'A%d:J%d' % (nr, nr)), 'values': [fila]}
                 for nr, fila in cambios]})
    # 2 · después las dobles, de abajo para arriba en un solo pedido
    meta = E._pedir('GET', '?fields=sheets.properties')
    sid = next(s['properties']['sheetId'] for s in meta['sheets']
               if s['properties']['title'] == HOJA)
    E._pedir('POST', ':batchUpdate', json={'requests': [
        {'deleteDimension': {'range': {'sheetId': sid, 'dimension': 'ROWS',
                                       'startIndex': n - 1, 'endIndex': n}}}
        for n in sorted(set(borrar), reverse=True)]})
    # 3 · y se relee: cada alias tiene que haber desaparecido y cada real seguir
    v2 = leer()
    mal = [a for a, r, _, _ in plan if filas_de(v2, a) or len(filas_de(v2, r)) != 1]
    if mal:
        print('   🔴 después de fusionar no cierra: %s' % mal)
    else:
        print('   ✅ %d fusionada(s); la Lista quedó con %d fila(s) menos'
              % (len(plan), len(set(borrar))))
    return plan


# ── la hoja AKAs ───────────────────────────────────────────────────────
def sacar_no_confundir(a, b, aplicar=False):
    """Borra de AKAs el par «NO CONFUNDIR» a/b (y su motivo). Sólo esas celdas."""
    v = leer(HOJA_AKAS)
    par = {PAD.norm(PAD.limpio(a)), PAD.norm(PAD.limpio(b))}
    for k, f in enumerate(v):
        for j in range(len(f) - 1):
            if {PAD.norm(PAD.limpio(f[j])), PAD.norm(PAD.limpio(f[j + 1]))} == par \
                    and all(PAD.limpio(x) for x in f[j:j + 2]):
                letra = chr(ord('A') + j)
                fin = chr(ord('A') + j + 2)
                print('   AKAs fila %d  %s:%s  %s' % (k + 1, letra, fin, f[j:j + 3]))
                if aplicar:
                    respaldar(v, 'akas')
                    _E().poner(_rango(HOJA_AKAS, '%s%d:%s%d' % (letra, k + 1, fin, k + 1)),
                               [['', '', '']])
                    print('   ✅ sacado')
                return True
    print('   no encontré el par %s / %s en AKAs' % (a, b))
    return False


def main():
    args = [a for a in sys.argv[1:] if a != '--aplicar']
    aplicar = '--aplicar' in sys.argv
    if not args or args[0] == '--fusionar':
        fusionar(aplicar)
    elif args[0] == '--agregar' and len(args) >= 4:
        agregar(args[1], args[2], args[3], args[4] if len(args) > 4 else '', aplicar)
    elif args[0] == '--id' and len(args) == 3:
        poner_id(args[1], args[2], aplicar)
    elif args[0] == '--sacar-no-confundir' and len(args) == 3:
        sacar_no_confundir(args[1], args[2], aplicar)
    else:
        print(__doc__)


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    main()
