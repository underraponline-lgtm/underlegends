"""QUE MUESTRA LA CARTA SERVIDOR: la lista completa, con lo que hay y lo que falta.

Dlx: "te acuerdas de las cosas que quiero que esta tarjeta del servidor
muestre? duelos, rachas x servidor tmb, numero de eventos participados,
podios, campeonatos... luego que mas".

Y el contexto que cambia como leer esto: "actualmente no tenemos datos pero
se construira con el tiempo para los servidores que añadan nuestro bot".

⚠️ ENTONCES ESTO NO ES UN INVENTARIO DE LO QUE SE PUEDE DIBUJAR HOY: ES LA
ESPECIFICACION DE LO QUE EL PIPELINE TIENE QUE PRODUCIR. Al reves de las
otras tandas, aca el diseño va primero y el dato lo persigue.

Por eso cada campo se marca con TRES cosas distintas, que se confunden
facil:

    GLOBAL    existe hoy, para toda la Liga
    POR SV    existe hoy, partido por servidor
    FUENTE    de donde saldria el dato por servidor

⚠️ La diferencia entre "existe global" y "existe por servidor" es TODO el
trabajo. Casi todo existe global. Casi nada existe por servidor.
"""
import collections
import json
import os
import sys

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
sys.path.insert(0, BASE)

# (etiqueta, clave en competitivo, clave en temporada, donde iria, fuente)
CAMPOS = [
    ('OVR del servidor',    None,        None,     'columna',
     'puntos de ese sv (el Sheet los tiene, el builder los tira)'),
    ('Puesto en el sv',     'pos_sv',    None,     'columna',
     'ya existe'),
    ('Eventos en el sv',    'ev',        'ev',     'columna',
     'el bot, o partir Ev por servidor'),
    ('Podios en el sv',     None,        'pod',    'columna',
     'el bot, o partir los emojis de podio por servidor'),
    ('Campeonatos en el sv', None,       'oro',    'columna',
     'el bot, o partir 🥇 por servidor'),
    ('Racha en el sv',      'rch_act',   'racha',  'columna',
     'el bot: no se puede partir, una racha es una secuencia'),
    ('Duelos en el sv',     'duel_real', None,     'columna',
     'el acumulador de duelos, que no esta montado'),
    ('Rango competitivo',   'rango',     'rango',  'pie · figura',
     'ya existe, y es global por regla'),
    ('Pais',                'cc',        'cc',     'pie · bandera',
     'ya existe'),
    ('Escudo del servidor', 'sv',        'sv',     'emblema',
     'ya existe'),
    ('Estrellas Interserver', None,      None,     'emblema',
     'datos/estrellas.json, ya existe'),
    ('Nombre',              'raw',       'raw',    'sobre el pie',
     'ya existe'),
]


def cob(pool, k):
    if not k:
        return None
    n = sum(1 for p in pool if p.get(k) not in (None, '', 0, '0'))
    return n, len(pool)


def main():
    comp = json.load(open(os.path.join(BASE, 'datos', 'competitivo_pool.json'),
                          encoding='utf-8'))
    temp = json.load(open(os.path.join(BASE, 'datos', 'temporada_pool.json'),
                          encoding='utf-8'))

    print('=' * 78)
    print('LO QUE LA CARTA SERVIDOR TIENE QUE MOSTRAR')
    print('=' * 78)
    print()
    print('  %-22s %-14s %-9s %s'
          % ('que', 'donde va', 'global hoy', 'por servidor hoy'))
    print('  ' + '-' * 74)
    faltan = []
    for etq, kc, kt, donde, fuente in CAMPOS:
        c = cob(comp, kc) or cob(temp, kt)
        g = '%d/%d' % c if c else 'no'
        por_sv = 'SI' if etq in ('Puesto en el sv', 'Rango competitivo',
                                 'Pais', 'Escudo del servidor',
                                 'Estrellas Interserver', 'Nombre') else 'NO'
        if por_sv == 'NO':
            faltan.append((etq, fuente))
        print('  %-22s %-14s %-9s %s' % (etq, donde, g, por_sv))

    print("""
  ⚠️ LEER LA ULTIMA COLUMNA, NO LA ANTEPENULTIMA. Casi todo existe GLOBAL.
  Lo que la carta necesita es POR SERVIDOR, y ahi la respuesta es NO en
  casi todo. Esa diferencia es el trabajo entero.
""")
    print('  HAY QUE CONSTRUIR %d COSAS:' % len(faltan))
    for etq, fuente in faltan:
        print('     %-24s <- %s' % (etq, fuente))

    # los casos especiales que no son "partir un numero"
    print("""
  ⚠️ Y DOS DE ESAS NO SE PUEDEN "PARTIR", HAY QUE MEDIRLAS DE NUEVO:

    LA RACHA   una racha es una SECUENCIA de resultados seguidos. No se
               puede repartir un 12 global entre servidores: si ganaste 3 en
               TFC, 4 en SR y 5 en TFC, tu racha en TFC no es 8, son dos
               rachas de 3 y 5. Hay que recorrer los eventos en ORDEN, y
               eso el Sheet no lo da: da totales.

    LOS DUELOS hoy duel_real esta en %d de %d y ADEMAS es global. El
               acumulador que los produce no esta montado. Es la unica de
               la lista que no existe ni siquiera global.
""" % (sum(1 for p in comp if p.get('duel_real')), len(comp)))

    print('=' * 78)
    print('CUANTO ENTRA, Y QUE PASA SI ENTRA TODO')
    print('=' * 78)
    print("""
  La columna mide 56 px de ancho por unos 170 de alto util. Ahi entran
  comodos UN numero grande y TRES piezas chicas. La lista de arriba tiene
  SIETE cosas para la columna.

  ⚠️ Y si entran las siete, la Servidor se convierte en la Competitiva con
  otro fondo. La Competitiva ya lleva 6 stats en fila y 4 pastillas al
  costado; si esta lleva 7 numeros mas, las dos cartas de la misma persona
  dicen lo mismo con distinta decoracion.

  LO QUE PROPONGO PARA CORTAR, y el criterio es uno solo: QUE SOLO ENTRE LO
  QUE NO SE PUEDE SABER EN OTRA CARTA.

    ENTRAN
      OVR del servidor      es EL numero de esta carta, no existe en otra
      Puesto en el sv       "3o de 24", ya existe y ya tiene umbral de 3
      Campeonatos en el sv  un titulo de ESE servidor. Es lo que un aliado
                            quiere ver de los suyos, y no esta en ninguna
                            otra carta
      Racha en el sv        es lo mas "de ese servidor" que hay: dice que
                            estas jugando ahi AHORA, no que jugaste alguna vez

    NO ENTRAN, y por que
      Eventos en el sv      queda dicho por el OVR, que lo lleva adentro con
                            peso 20%. Un numero que ya esta contado.
      Podios en el sv       lo mismo: entra en el OVR con peso 16%. Y si
                            estan los campeonatos, el podio es su version
                            floja.
      Duelos en el sv       no existe ni global. Si algun dia existe, entra
                            en lugar de los podios, no ademas.

  ⚠️ NO ES QUE SOBREN: es que el OVR YA LOS CONTIENE. Ponerlos al lado es
  mostrar el mismo hecho dos veces y hacer que la carta parezca mas llena
  sin decir mas.
""")

    print('=' * 78)
    print('LO QUE YO AGREGARIA, QUE NO ESTA EN TU LISTA')
    print('=' * 78)
    print("""
  DESDE CUANDO ESTAS EN ESE SERVIDOR.  Es el unico dato que un servidor
  aliado tiene y la Liga no: Discord sabe la fecha en que cada uno entro.
  No lo puede dar el Sheet ni el acumulador — sale del bot, gratis, sin
  calcular nada. Y es exactamente lo que hace que la carta se sienta DE ESE
  SERVIDOR y no una carta de la Liga con el logo cambiado.

  ⚠️ Y una que NO agregaria aunque tiente: el Win% del servidor. Es una tasa,
  y con mediana de 5 eventos por servidor una tasa es ruido — el mismo
  motivo por el que el ranking va por acumulacion y no por calidad.
""")


if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    main()
