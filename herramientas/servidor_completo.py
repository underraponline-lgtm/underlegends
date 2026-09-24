# -*- coding: utf-8 -*-
"""¿ALGUN SERVIDOR FALTA EN ALGUNO DE LOS CINCO LUGARES DONDE TIENE QUE ESTAR?

    python herramientas/servidor_completo.py

🔴 UN SERVIDOR NO VIVE EN UN ARCHIVO, VIVE EN CINCO. Guardar el logo no
alcanza: si falta en uno solo, algo se rompe o se dibuja mal **sin avisar**.

⚠️ Y YA PASO, con el caso mas caro del proyecto: **URBF no estaba en el
`LOGO` de `comun/escudos.py`**, asi que `gencomp.py` hacia `LOGO[sv]` directo
y tiraba `KeyError: 'URBF'` — **las 138 cartas caidas por 2 personas**. Con
la muestra de 8 no aparecia nunca, asi que la carta se podia dar por
terminada sin enterarse.

LOS CINCO LUGARES
-----------------

    comun/logos_color/<sv>.*        el logo a color. ⚠️ La extension NO es
                                    siempre `.png`: FFA y FTN son `.jpg`.
                                    Buscar por `<sv>.png` da dos falsos
                                    faltantes — me paso escribiendo esto.
    comun/escudos_cuad/sv_<sv>.png  el escudo que dibuja la carta
    comun/logos_sv/sv_<sv>.png      la SILUETA, que es el fallback de
                                    `escudos.escudo()` para los servidores
                                    sin icono de Discord (URBF, EFA, FFA).
                                    Sin esto devuelve '' y la carta sale sin
                                    escudo, sin un error
    datos/colores_sv_marca.json     su color de marca, bajo la clave `usar`
    datos/estrellas.json            sus Interserver ganados, bajo
                                    `estrellas_por_servidor`

⚠️ ESTO VIENE DE `herramientas/alta_rz.py`, QUE QUEDO MUERTO. Ese script daba
de alta a Rap Zone en los cinco lugares; Dlx cerro RZ el 22/09/2026 —*«RZ ya
no existe»*— asi que el script no tiene a quien dar de alta. **Lo que no
murio es su lista**, y por eso vive aca: el conocimiento era la lista de
lugares, no el servidor.

⚠️ LO QUE ESTE CHEQUEO NO PUEDE VER, y conviene saberlo: el pool sale del
Google Sheet y el servidor de cada rapero se deriva de sus columnas. Un
servidor puede estar completo en los cinco lugares y **no recibir una sola
carta** porque no esta en la planilla. Eso lo contesta el Sheet, no el disco.
"""
import glob
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, BASE)


def _j(*p):
    with io.open(os.path.join(BASE, *p), encoding='utf-8') as f:
        return json.load(f)


def cuales():
    """Los servidores DE CARTA, de `datos/servidores.json`.

    ⚠️ NO una lista escrita a mano acá: `solo_identidad` —LIVONIA, CONFED—
    no son de carta y no tienen que tener nada de esto. Escribir los nueve
    a mano es el bug que este archivo existe para encontrar, un nivel
    arriba.
    """
    d = _j('datos', 'servidores.json')
    return sorted((d.get('servidores') or {}).keys())


def falta(sv):
    """Los lugares donde ese servidor NO esta. `[]` si esta completo."""
    b = sv.lower()
    col = (_j('datos', 'colores_sv_marca.json').get('usar') or {})
    est = (_j('datos', 'estrellas.json')
           .get('estrellas_por_servidor') or {})
    hay = [
        # ⚠️ glob y no `.png`: ver el encabezado.
        ('logo a color', bool(glob.glob(
            os.path.join(BASE, 'comun', 'logos_color', b + '.*')))),
        ('escudo de la carta', os.path.exists(os.path.join(
            BASE, 'comun', 'escudos_cuad', 'sv_%s.png' % b))),
        ('silueta (el fallback)', os.path.exists(os.path.join(
            BASE, 'comun', 'logos_sv', 'sv_%s.png' % b))),
        ('color de marca', sv in col or b in col),
        ('estrellas', sv in est or b in est),
    ]
    return [q for q, ok in hay if not ok]


def main():
    svs = cuales()
    print('\n══ LOS %d SERVIDORES DE CARTA, EN SUS CINCO LUGARES ══\n' % len(svs))
    mal = {}
    for sv in svs:
        f = falta(sv)
        if f:
            mal[sv] = f
        print('  %s %-6s %s' % ('🔴' if f else '✅', sv,
                                'falta: ' + ', '.join(f) if f else 'completo'))

    # ⚠️ LO QUE SOBRA TAMBIEN SE DICE. Un servidor dado de baja deja sus
    # archivos, y despues alguien los encuentra y no sabe si son de algo
    # vivo. RZ es el caso de hoy.
    col = (_j('datos', 'colores_sv_marca.json').get('usar') or {})
    sobran = sorted(k for k in col if k.upper() not in svs and not k.startswith('_'))
    if sobran:
        print('\n  ⓘ con color de marca y sin ser servidor de carta: %s'
              % ', '.join(sobran))
        print('     (no rompe nada; es un servidor dado de baja que dejó '
              'sus archivos)')

    print('')
    if mal:
        print('  🔴 %d servidor(es) incompleto(s). Lo que falta NO tira un '
              'error:\n     la carta sale sin escudo, o sin color, o se cae '
              'con KeyError\n     recién con la persona que juega ahí.\n'
              % len(mal))
        return 1
    print('  ✅ los %d están en los cinco lugares\n' % len(svs))
    return 0


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    sys.exit(main())
