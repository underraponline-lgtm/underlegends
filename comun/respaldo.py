"""Cuando el CDN de Discord no responde, la copia que ya está en el repo.

    from comun.respaldo import para
    para('https://cdn.discordapp.com/avatars/894.../15ba....png?size=128')
    # -> 'data:image/png;base64,...'  (03_Servidor/disenos/_avatares/valen.png)
    para('https://cdn.discordapp.com/icons/4923.../a_84e....png?size=128')
    # -> 'data:image/png;base64,...'  (comun/logos_sv/sv_sr.png)
    para(cualquier_otra)  # -> None

POR QUE EXISTE
--------------
⚠️ **Las cartas se dibujaban sin foto teniendo la foto en el repo.** Hay nueve
avatares bajados en `03_Servidor/disenos/_avatares/` —versionados, no son un
caché— y sólo la carta de País los usaba. Las otras tres piden la URL del pool,
se comen un 404 porque el hash de Discord caduca, y caen en la inicial.

Y no es sólo la foto: el escudo del servidor también sale del CDN
(`comun/escudos.py` → `LOGO`), y el de **SR** ya da 404. Su silueta está en
`comun/logos_sv/sv_sr.png` desde siempre.

Medido sobre la carta Servidor de Juasmio: **6 imágenes fallaban**, 5 avatares
y el escudo de SR. Cuatro de esos cinco avatares están en disco.

⚠️ **ESTO NO ARREGLA LOS AVATARES, LOS TAPA.** El arreglo de fondo sigue siendo
pedírselos a Discord al generar, con el hash actual, y eso necesita el token
del bot. Acá sólo se usa lo que ya hay para que la carta **se pueda mirar**.

⚠️ **Y NO ES EL MISMO RECORTE.** La URL del pool trae `?size=128` y el
exportador de Temporada la reescribe a `?size=512`; los archivos de disco se
bajaron con el tamaño que tenían ese día. Una carta con respaldo puede verse
más blanda que la misma carta con el CDN vivo. Es a propósito: se prefiere una
foto blanda a ninguna foto.
"""
import base64
import json
import os
import re
import unicodedata

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)

# ⚠️ LAS FOTOS VIVEN EN 03_Servidor/disenos/ Y NO EN comun/, que es donde
# tocaría por la regla del proyecto. No se mueven acá porque `avatares.py` de
# esa carpeta las lee por ruta para sus hojas de muestra: mover la carpeta es
# una tanda aparte, con su verificación. Este módulo apunta a donde están.
FOTOS = os.path.join(BASE, '03_Servidor', 'disenos', '_avatares')


def _TEMPORADA_FOTOS():
    """La carpeta de la temporada en curso. Import perezoso a propósito.

    ⚠️ `comun/respaldo.py` lo importan las cuatro cartas y varias
    herramientas. Un import de módulo arriba obligaría a que `temporada.py`
    exista siempre; así, si alguien se lleva este archivo suelto, sigue
    andando con las nueve de antes.
    """
    try:
        from comun.temporada import carpeta_fotos
        return carpeta_fotos()
    except Exception:                                    # noqa: BLE001
        return os.path.join(SCR, 'fotos', 't1')
# ⚠️ av_valen.png NO ESTA EN _avatares Y SI CUENTA. Es la única copia que queda
# de esa foto —su URL ya da 404— y es la que usan todas las hojas de diseño de
# la Servidor.
SUELTAS = {'valen': os.path.join(BASE, '03_Servidor', 'disenos', 'av_valen.png')}

_cache = {}


def _norm(s):
    s = unicodedata.normalize('NFD', str(s).lower())
    return ''.join(c for c in s if c.isalnum())


def _uri(ruta):
    if ruta not in _cache:
        ext = os.path.splitext(ruta)[1].lower().lstrip('.')
        with open(ruta, 'rb') as f:
            _cache[ruta] = ('data:image/%s;base64,%s'
                            % ('jpeg' if ext in ('jpg', 'jpeg') else ext,
                               base64.b64encode(f.read()).decode()))
    return _cache[ruta]


def foto(nombre):
    """La foto de esa persona si está en disco, en base64. Si no, None.

    🔴 PRIMERO LA FOTO DE LA TEMPORADA, Y ESO CAMBIA LA ESCALA DEL PROBLEMA.
    Hasta el 20/09/2026 acá había **nueve** fotos versionadas a mano, o sea
    el 6,5 % de 138: la carta que 129 personas iban a ver era la de la
    inicial gigante. `bot/fotos.py` las pide a Discord en bloque y las
    congela en R2; `--espejo` las baja a `comun/fotos/<temporada>/`. Medido
    ese día: **307 de 443**.

    ⚠️ EL ORDEN IMPORTA Y ES ÉSTE. La de la temporada gana porque es la que
    se capturó *para esta temporada*, con la cara que la persona tenía
    cuando entró — que es lo que la Histórica va a necesitar. Las nueve
    viejas quedan de red: son de gente que puede no estar en DRA, y ahí el
    espejo no llega.

    ⚠️ Y SI NO HAY ESPEJO, ESTO NO FALLA: sigue de largo a lo de antes. Un
    `--espejo` que no se corrió tiene que dar la carta de ayer, no un error.
    """
    n = _norm(nombre)
    tem = os.path.join(_TEMPORADA_FOTOS(), n + '.webp')
    if os.path.exists(tem):
        return _uri(tem)
    if n in SUELTAS and os.path.exists(SUELTAS[n]):
        return _uri(SUELTAS[n])
    if not os.path.isdir(FOTOS):
        return None
    for f in sorted(os.listdir(FOTOS)):
        raiz, ext = os.path.splitext(f)
        if ext.lower() in ('.png', '.jpg', '.jpeg', '.webp') and _norm(raiz) == n:
            return _uri(os.path.join(FOTOS, f))
    return None


def hay_foto(av):
    """¿Ese valor es una foto dibujable? http:// o data:, las dos.

    🔴 ES LA MISMA LINEA MAL ESCRITA EN TRES ARCHIVOS, Y POR ESO VIVE ACA.
    Decidir foto-o-inicial con `av.startswith('http')` **tira el `data:` URI
    del respaldo en silencio**: la foto esta en disco, se pasa bien, y la
    carta dibuja la inicial igual.

        01_Temporada/normal_v3.py     arreglado el 16/09 con su propio _hay_foto
        02_Competitivo/v2/gencomp.py  seguia roto — es el que Dlx vio
        03_Servidor/normal_gen.py     el layout viejo, roto tambien

    `CLAUDE.md` daba el primero por resuelto, y eso tapo los otros dos: como
    la carta de Temporada ya salia bien, nadie volvio a buscar la linea.
    Ahora hay una sola definicion y las tres la importan.
    """
    av = str(av or '')
    return av.startswith('http') or av.startswith('data:')


def avatar(nombre, url=''):
    """De dónde sale la cara de esa persona. **La copia del repo GANA.**

    🔴 ANTES ERA AL REVÉS Y ESO DEJABA SIN CARA A 82 DE 101. La Temporada y la
    Competitiva sólo preguntaban por el repo **para rescatar una URL rota**:

        if c['av'].startswith('http'):        # <- la puerta
            if la_url_no_responde():
                c['av'] = respaldo.foto(...)

    O sea que a quien **no tiene URL en el pool** —que es el caso de toda la
    gente nueva, y de los 101 que se bajaron por Discord ID— esa rama no lo
    alcanzaba nunca: la carta salía con la inicial teniendo la foto en disco.
    La Servidor y la de País no tenían esa puerta, y por eso las mismas
    personas salían **con cara en dos cartas y sin cara en las otras dos**.
    Dlx lo vio en la suya el 17/09/2026; medido después: 82 de 101.

    ⚠️ Y EL ORDEN NUEVO NO ES SÓLO «QUE FUNCIONE»: la copia del repo es
    **mejor dato**. La URL del pool trae un hash que Discord invalida cuando
    la persona cambia su foto —y `?size=128` clavado—; el repo tiene lo que
    bajó `herramientas/bajar_avatares.py` **pidiéndoselo a Discord por el ID,
    a 512**. Preferir el repo es preferir la foto de hoy sobre una de julio.

    ⚠️ Devuelve un `data:` URI, no un `http:`. Quien decida foto-o-inicial con
    `av.startswith('http')` lo va a tirar en silencio — ya pasó en
    `normal_v3.py`, que ahora usa `_hay_foto()`.
    """
    return foto(nombre) or (url if _url_suya(nombre, url) else '') or ''


def _url_suya(nombre, url):
    """¿Esa URL de Discord lleva el ID de ESA persona?

    🔴 CINCO DE LAS VEINTE URLs DEL POOL SON DE OTRO, Y ESTABA ESCRITO.
    `sheet/construir_pool_temporada.py` lo dice en su propio docstring —«6 de
    los 20 que hay estan rotos, **cinco porque eran prestados**»— y el builder
    las arrastra de una corrida a la siguiente desde entonces:

        la url de Tam        lleva el ID de Bloody
        la url de Krtman     lleva el ID de Bloody
        la url de Jupiter    lleva el ID de MCO
        la url de Rayo       lleva el ID de MCO
        la url de Provenza   lleva el ID de Vize

    Eran fotos puestas a mano para mirar el diseño. Mientras la carta caía en
    la inicial no se notaba; el dia que una de esas URLs respondiera, la carta
    de Tam mostraria la cara de Bloody. Y eso no se ve leyendo el codigo: se
    ve comparando el numero de adentro de la URL contra el Discord ID.

    ⚠️ SE EXIGE PRUEBA, NO AUSENCIA DE SOSPECHA: la URL vale solo si su ID es
    el que el padron le da a esa persona. Sin ID cargado no hay con que
    comparar, asi que no se usa — y eso no cuesta nada, porque medido hoy la
    URL vieja rescata a CERO personas: las que tienen foto la tienen en disco.
    """
    url = str(url or '')
    if not url.startswith('http'):
        return False
    m = re.search(r'/avatars/(\d+)/', url)
    if not m:
        return False
    return m.group(1) == _discord_id(nombre)


_IDS = None


def _discord_id(nombre):
    global _IDS
    if _IDS is None:
        _IDS = {}
        p = os.path.join(BASE, 'datos', 'padron.json')
        if os.path.exists(p):
            with open(p, encoding='utf-8') as f:
                for x in json.load(f):
                    if x.get('discord_id'):
                        _IDS[_norm(x['raw'])] = x['discord_id']
    return _IDS.get(_norm(nombre))


_POR_URL = None


def _mapa():
    """{la URL que guarda el pool -> el respaldo en disco}.

    Se arma de los DOS pools porque la carta Servidor y la de Temporada leen
    de uno y la Competitiva y la de País del otro, y las URLs pueden diferir:
    `construir_pool_competitivo.py` rescata los avatares del JSON anterior.
    """
    global _POR_URL
    if _POR_URL is not None:
        return _POR_URL
    import json
    from comun.escudos import LOGO, DIR_LOGOS
    m = {}
    for arch in ('temporada_pool.json', 'competitivo_pool.json'):
        p = os.path.join(BASE, 'datos', arch)
        if not os.path.exists(p):
            continue
        with open(p, encoding='utf-8') as f:
            for x in json.load(f):
                av = (x.get('av') or '').split('?')[0]
                if av.startswith('http'):
                    m.setdefault(av, x['raw'])
    # el escudo de cada servidor: su silueta procesada
    esc = {}
    for sv, ident in LOGO.items():
        ruta = os.path.join(DIR_LOGOS, 'sv_%s.png' % sv.lower())
        if os.path.exists(ruta):
            esc['https://cdn.discordapp.com/icons/%s.png' % ident] = ruta
    _POR_URL = (m, esc)
    return _POR_URL


def para(url):
    """El respaldo en disco de esa URL del CDN, o None si no hay.

    ⚠️ Se compara SIN la query: la misma foto se pide con `?size=128` y con
    `?size=512` según la carta, y el `size` no es parte del hash.
    """
    base = str(url).split('?')[0]
    gente, escudos = _mapa()
    if base in escudos:
        return _uri(escudos[base])
    nom = gente.get(base)
    return foto(nom) if nom else None


def _self_check():
    import json
    gente, escudos = _mapa()
    en_disco = [os.path.splitext(f)[0] for f in os.listdir(FOTOS)] \
        if os.path.isdir(FOTOS) else []
    print('RESPALDOS EN DISCO\n')
    print('  fotos            %d  (%s)' % (len(en_disco), ', '.join(en_disco)))
    print('  sueltas          %d  (%s)' % (len(SUELTAS), ', '.join(SUELTAS)))
    print('  escudos          %d' % len(escudos))
    print('  URLs del pool    %d' % len(gente))
    tapadas = sum(1 for u, n in gente.items() if foto(n))
    print('\n  URLs del pool con respaldo: %d de %d' % (tapadas, len(gente)))
    p = os.path.join(BASE, 'datos', 'competitivo_pool.json')
    if os.path.exists(p):
        with open(p, encoding='utf-8') as f:
            pool = json.load(f)
        con = sum(1 for x in pool if foto(x['raw']))
        print('  del pool de 138, con foto en disco: %d' % con)
    falta = [sv for sv in ('DRA', 'FTN', 'TFC', 'SR', 'TWR', 'FRZ')
             if not any(sv.lower() in v.lower() for v in escudos.values())]
    print('  escudos sin silueta local:', ', '.join(falta) or 'ninguno')


if __name__ == '__main__':
    import sys
    sys.path.insert(0, BASE)
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    _self_check()
