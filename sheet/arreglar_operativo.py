"""ARREGLAR DOS COSAS EN EL OPERATIVO. Es el UNICO script que ESCRIBE.

    python sheet/arreglar_operativo.py             muestra que haria
    python sheet/arreglar_operativo.py --aplicar   lo hace

⚠️ TODOS LOS DEMAS PIDEN `spreadsheets.readonly` Y ESTE NO. Es a proposito que
sea uno solo y que haya que pedirselo con `--aplicar`: el Sheet es la fuente de
verdad de la Liga y lo usan personas, no nada mas este pipeline.

QUE ARREGLA
-----------
1. **El panel de busqueda** (filas 1 a 8). Dlx: *«si yo te dije que habia un
   panel de busqueda, que tengas cuidado con eso que puede malograr todo...
   ahora no creo que necesitemos eso, asi que lo puedes borrar»*.

2. **El Discord ID de Dlx**, que esta cargado en el rapero equivocado.

⚠️ **SE BORRA EL CONTENIDO, NO SE BORRAN LAS FILAS. Y ESA DIFERENCIA ES TODO.**
Borrar 8 filas corre las 870 personas ocho lugares hacia arriba, y el Apps
Script del Sheet **no esta en este repo**, asi que no hay manera de comprobar
si escribe contra filas fijas. Si lo hace, empieza a escribir sobre la persona
equivocada y no avisa. Vaciando las celdas el panel desaparece igual y **ningun
numero de fila se mueve**.

Si despues se comprueba que el Apps Script no usa filas fijas, borrar las ocho
filas vacias es un click y ya no rompe nada.

⚠️ **GUARDA UNA COPIA ANTES DE TOCAR**, con valores Y formulas, en
`docs/respaldo_operativo_<fecha>.json`. El panel es formulas: una vez
borradas no se reconstruyen solas.
"""
import io
import json
import os
import sys
import time

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)

import construir_padron as PAD                                    # noqa: E402

# Lo que se toca, en A1. El panel vive arriba de la cabecera de verdad.
PANEL = 'A1:R8'

# La columna de cada cosa, por si la hoja cambia: se resuelven por rotulo.
COL_ID, COL_AV = 'Discord ID', 'Avatar'

# ⚠️ EL ID DE DLX ESTA EN `jklnkmmkm`, NO EN `DLX`. Medido el 17/09/2026
# buscando el ID celda por celda en las 12 hojas del Operativo y las 8 del
# Oficial: aparece una sola vez, en la fila 345.
MUDANZAS = [
    # (de quien, a quien, por que)
    ('jklnkmmkm', 'DLX', 'Dlx lo cargo a mano y quedo en el rapero equivocado'),
]

# ⚠️ IDs QUE `herramientas/buscar_ids.py` ENCONTRO EN DISCORD y que Dlx aprobo.
# Coinciden EXACTO: el nombre de Discord de esa persona normaliza igual que su
# nombre en la Liga, y esta en FFA.
#
# 🔴 Y SE COMPRUEBAN TRES COSAS ANTES DE ESCRIBIR, porque una coincidencia de
# nombre NO ES UNA PRUEBA:
#
#   1. que la persona exista en el padron
#   2. que su celda `Discord ID` este VACIA — no se pisa nada
#   3. que ese ID **no sea ya de otra persona**
#
# La tercera atrapo uno: `fullylo4ded` en Discord tiene el ID que el padron le
# da a **Oasis**. O se renombro, o el Sheet tiene mal el de Oasis — en
# cualquier caso escribirlo le habria dado a Fullylo4ded la identidad de otro,
# y el bot le habria mostrado la carta equivocada sin fallar nunca.
IDS = [
    ('Assuan', '1266557884058046507'),
    ('Andy', '853130894663745549'),
    ('Miniboy', '950011515434573824'),
    ('NC', '1523082259870257315'),
    ('Iguana', '818314359218241567'),
    ('Mark', '1471344428064178248'),
    ('Sin Limites', '1508623564285149357'),
]


def servicio():
    import gspread
    from google.oauth2.service_account import Credentials
    cred = os.path.join(BASE, 'creds.json')
    if not os.path.exists(cred):
        sys.exit('falta creds.json en la raiz del proyecto')
    # ⚠️ EL UNICO LUGAR DEL PROYECTO CON PERMISO DE ESCRITURA.
    return gspread.authorize(Credentials.from_service_account_file(
        cred, scopes=['https://www.googleapis.com/auth/spreadsheets']))


def main():
    aplicar = '--aplicar' in sys.argv
    gc = servicio()
    ws = gc.open_by_key(PAD.OPERATIVO).worksheet(PAD.HOJA)
    val = ws.get_all_values()
    frm = ws.get(PANEL, value_render_option='FORMULA')

    cab = PAD._cabecera(val)
    H = [x.strip() for x in val[cab]]
    iID, iAV = H.index(COL_ID), H.index(COL_AV)
    letra = lambda i: chr(ord('A') + i)

    print('\nHOJA «%s» — %d filas · cabecera de la lista en la %d\n'
          % (PAD.HOJA, len(val), cab + 1))

    # ── que se va a mover ────────────────────────────────────────────────
    def fila_de(nombre):
        for n, r in enumerate(val):
            if n > cab and r and PAD.norm(PAD.limpio(r[0])) == PAD.norm(nombre):
                return n
        return None

    plan = []
    for desde, hacia, por in MUDANZAS:
        a, b = fila_de(desde), fila_de(hacia)
        if a is None or b is None:
            print('  ⚠️ no encontre %s o %s — no se toca'
                  % (desde if a is None else hacia, ''))
            continue
        did = val[a][iID] if len(val[a]) > iID else ''
        av = val[a][iAV] if len(val[a]) > iAV else ''
        yaesta = (val[b][iID] if len(val[b]) > iID else '')
        print('  MUDANZA  %s' % por)
        print('     de   fila %-5d %-20s id=%s' % (a + 1, val[a][0][:20], did or '-'))
        print('     a    fila %-5d %-20s id=%s' % (b + 1, val[b][0][:20], yaesta or '-'))
        if not did:
            print('     -> no hay nada que mover'); continue
        if yaesta and yaesta != did:
            print('     ⚠️ el destino YA TIENE otro id. No se pisa.'); continue
        plan.append((a, b, did, av))

    print('\n  PANEL     %s  (%d fila(s) de la 1 a la 8, se VACIAN, no se borran)'
          % (PANEL, 8))
    for n, r in enumerate(val[:8]):
        if any(str(c).strip() for c in r):
            print('     fila %d: %s' % (n + 1, ' | '.join(
                str(c)[:26] for c in r[:5] if str(c).strip())))

    # ── los Discord ID nuevos ────────────────────────────────────────────
    porid = {}
    for n, r in enumerate(val):
        if n > cab and len(r) > iID and r[iID].strip():
            porid[r[iID].strip()] = r[0]
    nuevos = []
    print('\n  DISCORD ID NUEVOS')
    for nom, did in IDS:
        f = fila_de(nom)
        if f is None:
            print('     ⚠️ %-13s no esta en la lista' % nom); continue
        tiene = val[f][iID].strip() if len(val[f]) > iID else ''
        dueno = porid.get(did)
        if tiene:
            print('     ⚠️ %-13s fila %-5d YA TIENE %s — no se pisa' % (nom, f + 1, tiene))
        elif dueno:
            print('     ⚠️ %-13s ese id YA ES DE %s — no se escribe' % (nom, dueno))
        else:
            print('     %-13s fila %-5d <- %s' % (nom, f + 1, did))
            nuevos.append((f, did))

    if not aplicar:
        print('\n  (nada escrito — corré con --aplicar)\n')
        return

    # ── respaldo ─────────────────────────────────────────────────────────
    resp = {
        'cuando': time.strftime('%Y-%m-%d %H:%M'),
        'hoja': PAD.HOJA,
        'panel_rango': PANEL,
        'panel_valores': val[:8],
        'panel_formulas': frm,
        'mudanzas': [{'de_fila': a + 1, 'a_fila': b + 1, 'id': did, 'avatar': av}
                     for a, b, did, av in plan],
        'ids_nuevos': [{'fila': f + 1, 'id': did, 'antes': ''} for f, did in nuevos],
    }
    p = os.path.join(BASE, 'docs',
                     'respaldo_operativo_%s.json' % time.strftime('%Y%m%d_%H%M'))
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(resp, f, ensure_ascii=False, indent=1)
    print('\n  respaldo -> %s' % os.path.relpath(p, BASE))

    # ── escribir ─────────────────────────────────────────────────────────
    for a, b, did, av in plan:
        ws.update([[did, av]], '%s%d:%s%d' % (letra(iID), b + 1, letra(iAV), b + 1),
                  raw=False)
        ws.batch_clear(['%s%d:%s%d' % (letra(iID), a + 1, letra(iAV), a + 1)])
        print('  ✅ id y avatar movidos de la fila %d a la %d' % (a + 1, b + 1))

    for f, did in nuevos:
        # ⚠️ raw=False para que Sheets NO lo interprete como numero. Un entero
        # de 18 digitos no entra en un double: se guardaria como
        # 1.94176670318592e+17 y los ultimos digitos se pierden PARA SIEMPRE.
        # Ya paso con `aze gian`, cuyo ID hoy es irrecuperable desde el Sheet.
        ws.update([[str(did)]], '%s%d' % (letra(iID), f + 1), raw=False)
    if nuevos:
        print('  ✅ %d Discord ID escritos' % len(nuevos))

    # ── comprobar contra la hoja, no contra lo que creemos ──────────────
    time.sleep(2)
    v2 = ws.get_all_values()
    cands = [n + 1 for n, r in enumerate(v2[:25])
             if all(c in [x.strip() for x in r] for c in PAD.CLAVES)]
    print('\n  COMPROBANDO')
    print('     cabeceras que quedan: %s  %s'
          % (cands, '✅' if len(cands) == 1 else '⚠️'))
    print('     personas bajo la cabecera: %d'
          % sum(1 for r in v2[cands[0]:] if r and r[0].strip()))
    for a, b, did, av in plan:
        print('     fila %d id=%r   ·   fila %d id=%r'
              % (b + 1, v2[b][iID], a + 1, v2[a][iID] if len(v2[a]) > iID else ''))
    print('')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
