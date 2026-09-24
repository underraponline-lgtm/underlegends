"""
EL ESCUDO DE CADA SERVIDOR — un solo lugar para las tres cartas
===============================================================

    from comun.escudos import escudo, LOGO
    escudo('TFC', dir_logos)   # -> URL del icono de Discord
    escudo('URBF', dir_logos)  # -> data:image/png;base64,... (su silueta)

POR QUE VIVE ACA Y NO EN CADA GENERADOR
---------------------------------------
Antes esto estaba escrito TRES VECES, una por carta. El fallback para los
servidores sin icono de Discord se agrego a `normal_v3.py` (Temporada) y a
`normal_gen.py` (Servidor) el mismo dia, y `gencomp.py` (Competitivo) quedo
afuera: seguia haciendo `LOGO[sv]` directo.

El resultado fue un `KeyError: 'URBF'` que **tumbaba la generacion entera del
pool de 138 por 2 personas**. Con la muestra de 8 no aparecia nunca, asi que
la carta se podia dar por terminada sin enterarse.

Si esto vuelve a estar duplicado, el proximo servidor sin icono va a romper
solo algunas de las tres cartas y va a costar encontrarlo de nuevo.

QUE SERVIDORES NO TIENEN ICONO
------------------------------
URBF, EFA y FFA. Para ellos se usa la silueta procesada de `comun/logos_sv/`,
que sale de `herramientas/procesar_logos.py`. Si manana alguno consigue icono
de Discord, se agrega a LOGO y las tres cartas lo toman solas.

Las siluetas tambien estaban triplicadas, una copia por carta, identicas. El
criterio ahora es: **lo que es de una carta vive en su carpeta, lo que
comparten las tres vive en `comun/`.** Los estilos, por ejemplo, son solo de la
Competitiva y se quedan en `02_Competitivo/v2/estilos/`.
"""
import base64
import os

# la carpeta canonica de siluetas, al lado de este archivo
DIR_LOGOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logos_sv')

# El id del servidor y el hash del icono, tal como los sirve el CDN de Discord.
LOGO = {
    'DRA': '841017460341604382/1850334cb7d80902e889f679694a1713',
    'FTN': '1331924080835694655/79d5d1f815a977e394c4178af6ebcc0a',
    'TFC': '1043611686524944404/a_0eec14355e982c396c994f8d3510fa3d',
    'SR':  '492346406976356374/a_84efb8f7f3a2d4d9af024149fcfbb09c',
    'TWR': '1115145044127666196/cf3638283222e016b59f25f57e7a1ee0',
    'FRZ': '838593179187544064/f55de8e5e5604b2a1813bb03cae9a9ad',
}

# los que hay que buscar como silueta si no estan en LOGO
SIN_ICONO = ['URBF', 'EFA', 'FFA']

_cache = {}   # dir_logos -> {sv: data-uri}


def _siluetas(dir_logos):
    """Las siluetas de una carpeta, en base64. Se leen una sola vez."""
    if dir_logos in _cache:
        return _cache[dir_logos]
    sil = {}
    if dir_logos and os.path.isdir(dir_logos):
        for sv in SIN_ICONO + list(LOGO):
            ruta = os.path.join(dir_logos, 'sv_%s.png' % sv.lower())
            if os.path.exists(ruta):
                sil[sv] = ('data:image/png;base64,'
                           + base64.b64encode(open(ruta, 'rb').read()).decode())
    _cache[dir_logos] = sil
    return sil


def escudo(sv, dir_logos=None):
    """La URL del escudo del servidor, o su silueta si no hay icono cargado.

    Devuelve '' si no hay ninguna de las dos, en vez de reventar: una carta
    sin escudo se ve mal, pero no frena la generacion de las otras 137.
    """
    if sv in LOGO:
        return 'https://cdn.discordapp.com/icons/%s.png?size=128' % LOGO[sv]
    return _siluetas(dir_logos or DIR_LOGOS).get(sv, '')


def _self_check():
    """Que los nueve servidores tengan escudo. Devuelve cuantos fallan.

    🔴 ESTE MODULO ERA EL UNICO DE `comun/` SIN CHEQUEO NI `__main__`, y
    es justo el que tiene el desastre documentado: `gencomp.py` hacia
    `LOGO[sv]` directo y eso fue **`KeyError: 'URBF'` tumbando las 138
    por 2 personas**. Con la muestra de 8 no aparecia nunca, asi que la
    carta se podia dar por terminada sin enterarse.

    ⚠️ `escudo()` DEVUELVE `''` EN SILENCIO A PROPOSITO — «una carta sin
    escudo se ve mal, pero no frena las otras 137»— y esa decision es
    correcta **en tiempo de dibujo**. Pero si nadie pregunta nunca, el
    silencio deja de ser una red y pasa a ser el problema: la carta sale,
    sin escudo, para siempre. Por eso el lugar donde tiene que gritar es
    este.

    ⚠️ Y LA LISTA DE SERVIDORES SALE DE `datos/servidores.json`, no de
    `LOGO`. Preguntarle a `LOGO` por los servidores que `LOGO` conoce es
    la comparacion consigo misma que este repo ya se comio cuatro veces
    en un dia. El dia que entre un servidor nuevo, va a estar en el JSON
    y no aca — y eso es exactamente lo que hay que detectar.
    """
    import json
    print('LOS ESCUDOS DE LOS SERVIDORES\n')
    raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    p = os.path.join(raiz, 'datos', 'servidores.json')
    try:
        with open(p, encoding='utf-8') as f:
            svs = sorted(k for k, v in (json.load(f).get('servidores') or
                                        {}).items() if isinstance(v, dict))
    except (OSError, ValueError) as e:
        print('  🔴 no pude leer %s: %s' % (os.path.basename(p), str(e)[:50]))
        return 1
    print('  %d servidores en datos/servidores.json' % len(svs))
    print('  %d con icono de Discord · %d que van por silueta\n'
          % (len(LOGO), len(SIN_ICONO)))

    mal = 0
    for sv in svs:
        u = escudo(sv)
        de = ('icono de Discord' if sv in LOGO
              else 'silueta' if u else '')
        if not u:
            print('  🔴 %-6s SIN ESCUDO — no está en LOGO y no hay '
                  'sv_%s.png' % (sv, sv.lower()))
            mal += 1
        else:
            print('  ✅ %-6s %s' % (sv, de))

    # ⚠️ AL REVES TAMBIEN: alguien listado acá que ya no es un servidor
    # de la Liga. No es grave —sobra— pero avisa que las dos listas se
    # separaron, que es como empieza el otro problema.
    sobran = sorted((set(LOGO) | set(SIN_ICONO)) - set(svs))
    if sobran:
        print('\n  ⚠️ listados acá y no en servidores.json: %s'
              % ', '.join(sobran))

    if mal:
        print('\n  🔴 %d servidor(es) dibujarían la carta SIN escudo, y'
              '\n     `escudo()` devuelve \'\' sin avisar: no se vería '
              'hasta mirar la carta.' % mal)
    else:
        print('\n  ✅ los %d tienen escudo' % len(svs))
    return mal


if __name__ == '__main__':
    import sys
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    sys.exit(1 if _self_check() else 0)
