"""LOS ICONOS de la columna de la Servidor.

DEFINICION CANONICA. Los primeros los dibuje de apuro dentro del script de
diseño —un trofeo hecho de rectangulos, una llama que era una gota, un
"blanco" de circulos concentricos para eventos— y a 15 px no se distinguian
entre si. Aca estan hechos en serio y en un solo lugar.

⚠️ CADA UNO LLEVA DOS CAMINOS, NO UNO. El de afuera es la silueta y el de
adentro es la luz. Una silueta plana a 15 px se lee como mancha; con una
cara mas clara adentro se lee como objeto. Es la misma decision que ya
tomaron las figuras de rango en comun/rangos.py y las estrellas del emblema.

⚠️ Y LA LUZ ENTRA DE ARRIBA A LA IZQUIERDA, igual que en las estrellas, en
las figuras de rango y en el escudo. Que dos piezas de la misma carta tengan
el sol en lugares distintos se nota aunque nadie sepa decir por que.

EL DE EVENTOS ES UN MICROFONO, y no un calendario ni un blanco. Un evento
aca es una batalla: el objeto que la representa es el microfono. Un
calendario diria "una fecha", que es otra cosa.
"""

# (silueta, luz) en un viewBox de 24x24. La luz va DENTRO de la silueta.
ICONOS = {
    # corona: el campeonato. Tres puntas con sus perlas y la banda de abajo.
    'campeonatos': (
        'M2.6 7.4 L7 12.4 L12 3.6 L17 12.4 L21.4 7.4 L19.6 18.2 H4.4 Z '
        'M4.2 19.6 H19.8 V22 H4.2 Z',
        'M4.6 9.6 L7.2 12.6 L12 6.2 V16.4 H6 Z'),
    # copa: el podio. Boca ancha, asas a los costados, pie y base.
    'podios': (
        'M8 2.6 H16 V4 H19.4 V6.6 C19.4 9.6 17.4 11.2 15.4 11.6 '
        'C14.9 13.2 13.8 14.1 12.9 14.4 V16.6 H15.2 V18.6 H8.8 V16.6 '
        'H11.1 V14.4 C10.2 14.1 9.1 13.2 8.6 11.6 '
        'C6.6 11.2 4.6 9.6 4.6 6.6 V4 H8 Z '
        'M8 5.6 H6.2 V6.6 C6.2 8.4 7 9.3 8 9.7 Z '
        'M16 5.6 H17.8 V6.6 C17.8 8.4 17 9.3 16 9.7 Z '
        'M7.4 19.8 H16.6 L17.6 21.8 H6.4 Z',
        'M9.4 4.1 H12 V13 C11 12.6 10 11.6 9.7 10 '
        'C9.5 8.6 9.4 6.4 9.4 4.1 Z'),
    # llama: lengua exterior y nucleo
    'racha': (
        'M12 1.4 C13.4 5.6 16.8 7.4 17.9 10.8 C19 14.4 16.6 21.2 12 22.4 '
        'C7.4 21.2 5 14.4 6.1 10.8 C6.8 8.5 8.6 7.6 9.6 5.2 '
        'C10.4 7 11.4 4 12 1.4 Z',
        'M11.4 3.6 C11.2 6.4 9.4 8 8.6 10.4 C7.8 13 8.8 16.4 11 18.2 '
        'C9.4 15 9.6 12.2 10.6 10 C11.2 8.6 11.6 6.2 11.4 3.6 Z'),
    # espadas cruzadas: hoja, guarda y pomo en cada una
    'duelos': (
        'M4.2 2.2 L7 2.2 L16.4 14.2 L17.8 13.1 L19.6 15.4 L15.6 18.5 '
        'L13.8 16.2 L15.2 15.1 L5.8 3.1 Z '
        'M19.8 2.2 L17 2.2 L7.6 14.2 L6.2 13.1 L4.4 15.4 L8.4 18.5 '
        'L10.2 16.2 L8.8 15.1 L18.2 3.1 Z',
        'M5.4 3.4 L6.4 3.4 L14.4 13.6 L13.4 14.4 Z'),
    # microfono: capsula, rejilla, arco y pie
    'eventos': (
        'M12 1.8 C10.2 1.8 8.8 3.2 8.8 5 V11.2 C8.8 13 10.2 14.4 12 14.4 '
        'C13.8 14.4 15.2 13 15.2 11.2 V5 C15.2 3.2 13.8 1.8 12 1.8 Z '
        'M5.6 10.2 H7.4 V11.4 C7.4 14 9.5 16.1 12 16.1 '
        'C14.5 16.1 16.6 14 16.6 11.4 V10.2 H18.4 V11.4 '
        'C18.4 15 15.7 17.6 12.9 17.9 V20.2 H15.8 V22 H8.2 V20.2 '
        'H11.1 V17.9 C8.3 17.6 5.6 15 5.6 11.4 Z',
        'M10.2 3.8 C10.6 3.2 11.2 2.9 11.9 2.9 V12.4 '
        'C11 12.4 10.2 11.8 10.2 10.6 Z'),
}

# ⚠️ PODIOS Y CAMPEONATOS SON DOS COSAS, Y UNA CONTIENE A LA OTRA. En el
# Sheet, pod = oro + plata + bronce y oro = solo los primeros puestos, o sea
# que TODO campeonato es tambien un podio. Si la carta muestra los dos, hay
# que leerlos anidados: "3 podios, 1 campeonato" quiere decir que de esos
# tres, uno fue ganado. Si algun dia se quiere que no se solapen, hay que
# restar el oro del podio EN EL BUILDER y decirlo aca.
# ⚠️ CAMPEONATOS primero y PODIOS despues: lo mas alto va arriba. Y la
# etiqueta pasa a TITULOS porque "CAMPEONATOS" son 11 letras contra 5-7 de
# todas las demas, asi que su fila se leia como el doble de larga aunque la
# tipografia fuera la misma. Dlx: "tiene que ser algo average como los de
# abajo". TITULOS son 7, que es justo el promedio de las otras cuatro.
ORDEN = ['campeonatos', 'podios', 'racha', 'duelos', 'eventos']
ETIQUETA = {'podios': 'PODIOS', 'campeonatos': 'TÍTULOS', 'racha': 'RACHA',
            'duelos': 'DUELOS', 'eventos': 'EVENTOS'}


def svg(k, lado=15, opacidad=1.0):
    """El icono, con su silueta y su luz."""
    sil, luz = ICONOS[k]
    return (f'<svg viewBox="0 0 24 24" width="{lado}" height="{lado}" '
            f'style="opacity:{opacidad}">'
            f'<path d="{sil}" fill="#fff" fill-rule="evenodd"/>'
            f'<path d="{luz}" fill="#fff" opacity=".55"/></svg>')


if __name__ == '__main__':
    import sys
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    print('LOS ICONOS DE LA COLUMNA')
    for k in ORDEN:
        sil, luz = ICONOS[k]
        print('  %-9s %-9s silueta %4d car · luz %3d car'
              % (k, ETIQUETA[k], len(sil), len(luz)))
    print('\n  ⚠️ Cada uno lleva DOS caminos: silueta y luz. Una silueta plana')
    print('     a 15 px se lee como mancha; con una cara clara adentro se lee')
    print('     como objeto. La luz entra de arriba a la izquierda, igual que')
    print('     en las estrellas, las figuras de rango y el escudo.')
    print('\n  El de eventos es un MICROFONO: un evento aca es una batalla.')
    print('  Un calendario diria "una fecha", que es otra cosa.')
