"""SUBIR A KV LO QUE EL WORKER NECESITA SABER.

    python bot/subir_datos.py            escribe todo
    python bot/subir_datos.py --ver      lee un par de claves, no escribe

⚠️ **UNA CLAVE POR PERSONA, NO UN BLOB.** Es la decisión de `CLAUDE.bot.md` y
el motivo es el límite que manda: **10 ms de CPU por request**. Esperar red no
gasta, pero **parsear sí**. Si el Worker se bajara un JSON con las 138 y le
hiciera `JSON.parse` en cada comando, se pasa — y el problema vuelve
disfrazado, porque "leer de KV" suena a que ya se respetó la regla.

Con `p:konan` lee un valor chico y parsea un objeto.

QUÉ SE ESCRIBE
--------------
    p:<nombre>        los datos de esa persona
    d:<discord_id>    a qué nombre corresponde ese ID
    meta              el sello de la corrida y cuántos hay

⚠️ **`d:` ES LO QUE HACE ANDAR `/card` SIN ESCRIBIR NADA.** La interacción trae
el ID de quien la usó; con este índice el bot sabe quién es. Hoy alcanza para
**101 de 138** — los que tienen el ID cargado en el Operativo.

⚠️ **LOS LÍMITES DE ESCRITURA DE KV SON 1.000 POR DÍA**, y por eso el reparto
es *el pipeline escribe, el Worker sólo lee*. Una corrida completa son ~240
escrituras: entra cómodo, pero no da para escribir desde el Worker.

⚠️ **EL VALOR ES CHICO A PROPÓSITO.** Cada campo que se agregue lo paga el
Worker en parseo, 138 veces por comando que se use. Lo que no decide qué
dibujar, no va.
"""
import io
import json
import os
import sys
import time

import requests

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, os.path.join(BASE, 'sheet'))

CUENTA = 'a85733396fd158a8e9660b02e20f33c8'
KV = 'a87399a3a0b647b0803aa90509ccce56'
API = ('https://api.cloudflare.com/client/v4/accounts/%s/storage/kv/namespaces/%s'
       % (CUENTA, KV))

# El requisito de la Competitiva, que decide en qué carta abre `/card`.
# ⚠️ Vive en comun/requisitos.py; acá se lee de ahí y no se copia el número.
sys.path.insert(0, BASE)
from comun.requisitos import REQUISITOS  # noqa: E402
from comun.requisitos import falta as REQ_FALTA  # noqa: E402
from comun.rangos import UMBRAL  # noqa: E402
sys.path.insert(0, SCR)
import verificados as VERIF  # noqa: E402

# ⚠️ LOS SEIS TRAMOS VIEJOS DEL SHEET. No son una alternativa ni una opción:
# son lo que la columna `Rango` del Sheet y los roles de Discord dicen HOY,
# mientras las cartas usan los ocho de `comun/rangos.py`. Están acá para
# poder MEDIR el desfase en vez de recitarlo — ver `desfase_rangos()`.
UMBRAL_VIEJO = [('S', 65), ('A', 47), ('B', 36), ('C', 23), ('D', 17)]


def _letra(score, tabla):
    for r, t in tabla:
        if score >= t:
            return r
    return 'E'


def desfase_rangos(gente):
    """Cuántas personas llevan una letra en el Sheet y otra en su carta.

    ⚠️ SE CALCULA, NO SE ESCRIBE. CLAUDE.md dice «26 de 138», medido contra el
    Sheet en vivo el 16/09/2026. Ese número **envejece**: cambia con cada
    persona que entra y con cada Score que se mueve. Un `/owner` que lo
    recitara estaría mintiendo la primera vez que el pool se refresque.

    ⚠️ Y NO HACE FALTA LEER EL SHEET. Sus seis tramos son una función del
    Score y el Sheet **no calcula nada** —cero fórmulas, es una vitrina—, así
    que las dos letras salen del mismo número que ya está acá.
    """
    n = 0
    for x in gente:
        try:
            sc = float(x.get('score'))
        except (TypeError, ValueError):
            continue
        if _letra(sc, UMBRAL) != _letra(sc, UMBRAL_VIEJO):
            n += 1
    return n


def env(clave):
    for linea in io.open(os.path.join(BASE, '.env'), encoding='utf-8'):
        if linea.strip().startswith(clave + '='):
            return linea.split('=', 1)[1].strip().strip('"\'')
    sys.exit('falta %s en .env' % clave)


def sesion():
    s = requests.Session()
    s.headers['Authorization'] = 'Bearer ' + env('CLOUDFLARE_API_TOKEN')
    return s


def _ok(r, que):
    try:
        j = r.json()
    except Exception:
        print('  ⚠️ %s -> %d %s' % (que, r.status_code, r.text[:140]))
        return None
    if not j.get('success'):
        for e in j.get('errors') or []:
            print('  ⚠️ %s  [%s] %s' % (que, e.get('code'), str(e.get('message'))[:120]))
        return None
    return j.get('result')


def _n(x, dec=0):
    """Un número limpio, o None si no hay dato. `''` y 0 no son lo mismo."""
    if x is None or x == '':
        return None
    try:
        f = float(str(x).replace('%', '').replace(',', '').strip())
    except (TypeError, ValueError):
        return None
    return round(f, dec) if dec else int(round(f))


def versus_de(k, c, t, nac):
    """Los números que `/versus` compara, uno por categoría.

    ⚠️ **UNA CATEGORÍA SÓLO ENTRA SI TIENE SU NÚMERO CABEZA.** Sin Score no
    hay versus competitivo, y mandar el resto igual haría que el bot dibujara
    una tabla de sub-stats debajo de un veredicto que no puede dar. Es «sin
    dato no hay pieza» aplicado a esto.

    ⚠️ **LA SERVIDOR NO TIENE NÚMERO PROPIO Y POR ESO VA POR PUESTO.** Medido:
    `03_Servidor/generar.py:136` toma el `ovr` del pool de TEMPORADA — está
    comentado ahí mismo como «los cuatro prestados». O sea que un versus de
    Servidor por OVR daría exactamente lo mismo que uno de Temporada, y las
    dos categorías dejarían de medir cosas distintas. Lo que sí es de ese
    servidor es **tu puesto ahí**.
    """
    out = {}
    # ── Temporada: el OVR, y los cinco que lo componen ──────────────────────
    # PTS 36% · EVT 20% · WR 16% · POD 16% · CAZ 12%. Son los cinco de la
    # fórmula, no cinco elegidos a gusto: así la tabla explica el veredicto.
    ovr = _n(t.get('ovr'))
    if ovr:
        out['t'] = {'ovr': ovr, 'pts': _n(t.get('pts')), 'ev': _n(t.get('ev')),
                    'wr': _n(t.get('wr'), 1), 'pod': _n(t.get('pod')),
                    'caz': _n(t.get('caz'))}
    # ── Competitiva: el Score y las cinco dimensiones ───────────────────────
    sc = _n(c.get('score'), 1)
    if sc:
        out['c'] = {'sc': sc, 'ef': _n(c.get('E')), 'co': _n(c.get('C')),
                    'dm': _n(c.get('Dm')), 'te': _n(c.get('T')),
                    'di': _n(c.get('V'))}
    # ── País: el OVR Nacional y tu puesto dentro del país ───────────────────
    # ⚠️ `None` Y NO 0 CUANDO NO HAY Score Selección. Ver comun/nacional.py.
    on = nac.get(c.get('raw'))
    if on:
        # ⚠️ `arc_pais` POR EL MISMO MOTIVO QUE `arc_sv`, abajo: «1/33» contra
        # «6/25» son puestos en paises de distinto tamaño. Konan es 1 de 33 en
        # Argentina y Bloody 6 de 25 en Colombia — el 1 y el 6 no se restan.
        out['p'] = {'ovr': on, 'pos': c.get('pos_pais') or '',
                    'arc': _n(c.get('arc_pais'))}
    # ── Servidor: el puesto, y el percentil para poder compararlos ──────────
    # ⚠️ `arc_sv` NO ES DECORACIÓN: «1/18» contra «3/26» son puestos en
    # poblaciones distintas y el más chico no es el mejor. El percentil los
    # pone en la misma escala; el puesto se manda igual porque es lo que la
    # persona reconoce de su carta.
    if c.get('pos_sv'):
        out['s'] = {'pos': c['pos_sv'], 'arc': _n(c.get('arc_sv')),
                    'ev': _n(c.get('ev'))}
    return out


# los dos prefijos que este script es dueño de escribir. Todo lo demás
# que vive en KV —`reg:`, `cfg:`, `foto:`, `pnick:`, `meta`— lo escribe
# otro y no se toca.
#
# ⚠️ `pnick:` EMPIEZA CON `p` Y NO ES NUESTRO. Por eso se compara el
# prefijo con los dos puntos y no la primera letra: `k.startswith('p')`
# habría borrado la configuración de apodos.
MIOS = ('p:', 'd:')


def limpiar_huerfanas(s, pares):
    """Borra de KV las `p:`/`d:` que esta corrida ya no escribe.

    🔴 SIN ESTO EL PORTON NO FILTRA NADA. `subir_datos` sólo escribía, y
    una clave que deja de escribirse **se queda en KV con su valor
    viejo**: el bot la sigue leyendo y sigue sirviendo esa carta. O sea
    que sacar a alguien del conjunto no lo sacaba del bot.

    Medido el 22/09, aplicando el portón de identidad: KV tenía 469
    `p:` y la corrida escribía 312. Las **157** restantes habrían
    seguido contestando como si nada, y el filtro habría sido decorado.

    ⚠️ ES LA MISMA FORMA QUE ESTE REPO DOCUMENTA UNA Y OTRA VEZ —lo
    viejo dado por bueno— pero en el único lugar donde no se ve: lo que
    no se escribe no deja rastro en el log de lo que sí.

    ⚠️ Y UN BUILD VACIO NO PUEDE VACIAR KV. Si `armar()` sale mal y
    devuelve dos personas, esto borraría las otras 310 y el bot se
    quedaría sin nada que servir. Por eso frena si tendría que borrar
    más de la mitad: es el mismo guardián que el de los pools, por el
    mismo motivo.
    """
    quedan = {p['key'] for p in pares}
    claves, cursor = [], ''
    while True:
        r = s.get('%s/keys' % API,
                  params={'limit': 1000, 'cursor': cursor}, timeout=40).json()
        if not r.get('success'):
            print('  ⚠️ no pude listar KV: no limpio nada')
            return 0
        claves += [k['name'] for k in (r.get('result') or [])]
        cursor = (r.get('result_info') or {}).get('cursor') or ''
        if not cursor:
            break
    sobran = [k for k in claves
              if k.startswith(MIOS) and k not in quedan]
    if not sobran:
        print('  ✅ no sobra ninguna clave vieja en KV')
        return 0
    nuestras = [k for k in claves if k.startswith(MIOS)]
    if len(sobran) > len(nuestras) / 2:
        print('  🔴 borraría %d de %d claves: eso no parece un cambio real.'
              % (len(sobran), len(nuestras)))
        print('     No limpio nada. Mirá `armar()` antes de insistir.')
        return 0
    print('  %d clave(s) vieja(s) que ya no corresponden: las borro'
          % len(sobran))
    for i in range(0, len(sobran), 1000):
        lote = sobran[i:i + 1000]
        if _ok(s.delete(API + '/bulk', json=lote), 'borrar %d' % i) is None:
            print('  ⚠️ no pude borrar la tanda %d' % (i // 1000 + 1))
            return i
    # ⚠️ SE VERIFICA VOLVIENDO A PREGUNTAR, como todo lo demás del repo:
    # un 200 dice que la API aceptó el pedido, no que la clave se fue.
    r = s.get('%s/keys' % API, params={'limit': 1000}, timeout=40).json()
    vivas = {k['name'] for k in (r.get('result') or [])}
    qued = [k for k in sobran if k in vivas]
    print('  %s %d borrada(s)%s'
          % ('✅' if not qued else '🔴', len(sobran) - len(qued),
             '' if not qued else ' · %d siguen ahí' % len(qued)))
    return len(sobran)


def armar():
    import construir_padron as PAD
    with open(os.path.join(BASE, 'datos', 'competitivo_pool.json'),
              encoding='utf-8') as f:
        comp = json.load(f)
    with open(os.path.join(BASE, 'datos', 'temporada_pool.json'),
              encoding='utf-8') as f:
        temp = {x['raw']: x for x in json.load(f)}
    idx = PAD.por_nombre()

    # ⚠️ EL OVR NACIONAL SE PIDE, NO SE CALCULA ACÁ. Vive en
    # `comun/nacional.py` junto con sus dos máximos, que salen del pool y se
    # mueven cuando el pool cambia: calcularlo en dos lugares daría dos
    # números distintos para la misma persona el día que uno de los dos se
    # quede con un máximo viejo. Es el mismo archivo que lee `04_Pais`.
    from comun.nacional import tabla as tabla_nacional
    mundial = {}
    pm = os.path.join(BASE, 'datos', 'mundial.json')
    if os.path.exists(pm):
        with open(pm, encoding='utf-8') as f:
            mundial = json.load(f)
    nac = tabla_nacional(comp, mundial)

    inventario = leer_inventario()
    donde = servidores_de()

    # ⚠️ LA GENTE YA NO SON LOS 138 DEL POOL. Dlx, 19/09/2026: la Servidor va
    # desbloqueada para todos, y «todos» es la Lista de Raperos. Lil Drako
    # tenia su carta dibujada y subida a R2 y el bot le contestaba «todavia no
    # esta en la Liga», porque este script solo recorria el pool competitivo.
    # Ahora recorre TODO EL QUE TIENE ALGUNA CARTA EN R2 — que es exactamente
    # la pregunta que el bot hace— y el pool solo aporta los numeros de los que
    # compitieron.
    # 🔴 EL PORTON DE IDENTIDAD, Y ESTE ES EL UNICO LUGAR DONDE SE
    # APLICA. Dlx, 22/09/2026: *«el requisito para tener una tarjeta,
    # cualquier tarjeta, es estar verificado en DRA — o sea ID y
    # bandera»*, que repite lo del 19/09. Son tres condiciones:
    # `discord_id`, pais, y el rol Miembro de DRA.
    #
    # ⚠️ ESTABA MEDIDO DESDE EL 19/09 Y NO LO APLICABA NADIE.
    # `herramientas/en_dra.py` lo calculaba e imprimia, y ahi moria.
    # Medido el 22/09: R2 tiene cartas de **469** personas y el porton
    # deja **319** — o sea 150 con carta que no deberian tenerla. Un
    # requisito que se mide y no se aplica es una estadistica.
    #
    # ⚠️ VA ACA Y NO EN `comun/requisitos.py` porque alla se mide
    # desempeño —sale del Sheet, se contesta con una resta— y esto se
    # le pregunta a Discord. Y va en **este** paso porque KV es lo que
    # decide qué sirve el bot: filtrar antes de dibujar ahorraria
    # dibujos, pero filtrar acá es lo que hace que la regla valga.
    #
    # ⚠️ A LOS QUE QUEDAN AFUERA NO HAY QUE DECIRLES NADA NUEVO: al
    # salir de KV, `/card` cae en la rama de «todavia no estas» y manda
    # el mensaje con los dos botones —entrar a DRA y verificarse—, que
    # es exactamente lo que Dlx pidio.
    verif, cuando_ver = VERIF.cargar()
    if verif is None:
        # 🔴 `None` NO ES UN CONJUNTO VACIO. Sin el archivo no se sabe
        # quien esta verificado, y filtrar por un conjunto vacio dejaria
        # a las 319 sin carta. No saber no puede costar mas caro que
        # saber que no.
        print('  ⚠️ falta datos/verificados.json: NO filtro por identidad.'
              '\n     Corré `python bot/verificados.py`.')
    else:
        print('  el portón de identidad: %d verificados (%s)'
              % (len(verif), cuando_ver[:16]))

    por_pool = {PAD.norm(x['raw']): x for x in comp}

    # 🔴 EL INVENTARIO DE R2 **UNION** LOS QUE PASAN EL PORTON, no solo el
    # inventario. Hasta el 22/09/2026 esto recorria `sorted(inventario)` y
    # nada mas, o sea que para entrar a KV habia que **ya tener una carta
    # subida**.
    #
    # Es el mismo huevo y gallina que tenia `03_Servidor/generar.py`, y se
    # nota con el unico caso que importa durante una prueba: **quien se
    # verifica hoy**. Medido ese dia: 319 pasan el porton y se escribian
    # **312**. Los siete que faltaban tenian Discord ID, pais y el rol
    # Miembro; su unica falta era no tener todavia una carta en R2. El bot
    # les contestaba «todavia no estas verificado» — la respuesta
    # equivocada con la cara de la correcta.
    #
    # ⚠️ NO ALCANZABA CON ARREGLAR EL GENERADOR. Aunque ahora se les
    # dibuje, el primer ciclo sube la carta **despues** de armar KV, asi
    # que sin esta union entrarian recien al ciclo siguiente: una hora de
    # «no estas verificado» para alguien que acaba de verificarse.
    #
    # La union no afloja el porton: el filtro de abajo sigue siendo el
    # mismo para todos. Lo que cambia es de donde sale la lista de
    # candidatos — de quien PUEDE tener carta, no de quien YA la tiene.
    _padron = PAD.cargar()
    del_porton = {PAD.norm(p['raw']) for p in _padron
                  if verif is not None and VERIF.pasa(p, verif)}
    # 🔴 LOS QUE YA ESTAN CARGADOS Y NO PASAN. Ver el comentario de
    # `cargados` en `meta`, mas abajo: sin esto el Worker les promete una
    # carga que ya esta hecha. Se arma acá, donde el porton ya se
    # pregunto, en vez de volver a recorrer el padron.
    cargados_sin_carta = {
        str(p.get('discord_id')) for p in _padron
        if str(p.get('discord_id') or '')
        and not (verif is not None and VERIF.pasa(p, verif))}
    candidatos = sorted(set(inventario) | del_porton)
    nuevos = len(del_porton - set(inventario))
    if nuevos:
        print('  %d pasan el portón y todavía no tienen carta en R2: '
              'igual van a KV' % nuevos)

    gente, fuera = [], 0
    for k in candidatos:
        p_id = idx.get(k, {})
        if verif is not None and not VERIF.pasa(p_id, verif):
            fuera += 1
            continue
        x = por_pool.get(k)
        if x is None:
            p = p_id
            if not p:
                continue                  # esta en R2 y no en el padron: se salta
            x = {'raw': p.get('raw') or k, 'sv': '', 'cc': '', 'ev': 0}
        gente.append((k, x))
    if fuera:
        print('  %d con carta en R2 que NO pasan el portón: no van a KV'
              % fuera)

    pares, con_id = [], 0
    por_id, dup_id = {}, []
    for k, x in gente:
        p = idx.get(k, {})
        t = temp.get(x['raw'], {})
        ev = int(t.get('ev') or x.get('ev') or 0)
        # 🔴 EN QUE SERVIDORES ESTA, PREGUNTADO A DISCORD. El `sv` del pool es
        # el argmax de siete columnas de puntos, no un servidor: por eso a Dlx
        # —«yo soy de DRA»— le salia TWR, y a Lil Drako, Fontana. Si Discord
        # sabe donde esta, se usa eso; si no lo sabe, se cae al del pool, que
        # es lo unico que queda.
        svs = donde.get(p.get('discord_id') or '', [])
        # 🔴 LA FILA CON LA QUE SE PREGUNTA EL REQUISITO, ARMADA UNA VEZ.
        # Tiene que traer lo de los TRES lados o el requisito contesta mal:
        # el padrón aporta `pais` —que es como `tiene_pais()` reconoce a los
        # 303 que entraron por `paises_nuevos.py`, porque su fila sintética
        # tiene `cc` vacío—, la temporada aporta `mw` —que `actividad()`
        # suma— y el competitivo el resto. `ev` va resuelto al final porque
        # los dos pools lo traen con valores distintos.
        #
        # ⚠️ Preguntar con la fila cruda le sacaba la carta de País a esos
        # 303. Probado antes de aplicarlo.
        req_fila = dict(p)
        req_fila.update(t)
        req_fila.update(x)
        req_fila['ev'] = ev
        valor = {
            'n': x['raw'],                       # como se escribe el nombre
            # ⚠️ `sv` ES EL DEFAULT PARA CUANDO NO HAY SERVIDOR EN EL PAYLOAD,
            # o sea los mensajes directos. Es el primero de `svs`, que vienen
            # ordenados por prioridad con DRA adelante.
            'sv': (svs[0] if svs else (x.get('sv') or t.get('sv') or '')),
            # 🔴 `svp` ES EL SERVIDOR DEL POOL, Y NO ES LO MISMO QUE `sv`.
            # `sv` pasó a ser dónde ESTÁS (Discord); `svp` es el argmax de las
            # 7 columnas de puntos, que es el único servidor donde tu `pos_sv`
            # existe. La carta `<n>/servidor.webp` lleva ese puesto y las
            # `sv-<codigo>` lo tiran a cero —ver `con_camiseta()` en
            # 03_Servidor/generar.py—, asi que hay que saber cuál es cuál o el
            # Worker sirve la carta sin puesto a quien sí lo tiene. Medido:
            # los 138 del pool lo perdieron cuando `sv` cambió de significado.
            'svp': (x.get('sv') or t.get('sv') or ''),
            # 🔴 Y SI NO LO TRAE NINGUNO DE LOS DOS, SE DEDUCE DEL PAIS.
            # El padrón guarda el país por **nombre** (`pais`) y no tiene
            # columna `cc`, así que `p.get('cc')` es siempre `None`: el
            # único que traía el código era el pool. Con el pool vacío
            # —o para quien no está en él— **todas las claves salían con
            # `cc: ''`**, o sea sin bandera, teniendo el país cargado.
            # Medido el 22/09 sobre `p:konan`: país Argentina en el
            # padrón, `cc` vacío en KV.
            #
            # `_CC_DE_PAIS` es la misma tabla que usa la Bloqueada, y
            # sale de cruzar el pool contra el padrón en vez de estar
            # escrita a mano — para que no discrepen.
            'cc': (x.get('cc') or p.get('cc')
                   or _cc_de(p.get('pais')) or ''),
            'ev': ev,
            # ⚠️ No se guarda "competitiva: true": se guarda `ev` y el Worker
            # compara contra el requisito. Si el 10 cambia, cambia en un lugar
            # y no hay que reescribir las 138 claves.
            #
            # ⚠️ `cs` ES LA EXCEPCION A ESO, Y ES POR UN AGUJERO MEDIDO.
            # No todas las personas tienen las cuatro cartas: **Mark no tiene
            # Pais** porque no tiene pais, y «sin dato no hay pieza» — su
            # carta no se emite, a proposito, lo dice CLAUDE.md. El Worker
            # construye la URL con el nombre y no consulta nada, asi que le
            # dibujaba igual el boton de Pais y al apretarlo salia un hueco.
            # Discord no avisa de una imagen que no carga.
            #
            # Esto NO se puede derivar de otro campo: es lo que hay en R2, y
            # lo unico que lo sabe es el inventario de la ultima subida. Es la
            # forma de siempre — el dato estaba y el pipeline no iba a
            # buscarlo — aplicada al bot.
            # ⚠️ «TIENE SERVIDOR» NO ES «TIENE `servidor.webp`». Los 331 que
            # entraron con la Servidor desbloqueada no tienen esa clave: tienen
            # `sv-dra` y `sv-ffa`, que son cartas de servidor igual. Mirando
            # sólo `ORDEN_CARTAS`, a Lil Drako le salía `cs: []` — o sea CERO
            # botones, la carta que sí tiene escondida detrás de una lista
            # vacía. Es la forma de siempre: el dato estaba y la pregunta no
            # iba a buscarlo.
            # 🔴 Y DESDE EL 21/09/2026, TAMBIÉN EL REQUISITO. Estar en R2 y
            # estar ganada son dos cosas: medido ese día, **21 de los 22**
            # que no llegan a los 10 eventos tenían su Competitiva normal
            # arriba y el bot se la servía. `comun/requisitos.py` lo
            # implementa, tiene self-check, y `CLAUDE.md` dice «22 pierden
            # la carta» — no lo aplicaba ningún eslabón de la cadena.
            #
            # ⚠️ EL FILTRO VA ACÁ Y NO EN EL WORKER. La regla vive en
            # Python; en JS habría que reescribir `falta()`, o sea una
            # segunda copia de los umbrales — exactamente lo que este
            # proyecto documenta que se queda viejo. El comentario de acá
            # arriba decía que *«el Worker compara `ev` contra el
            # requisito»*: no lo hace, `g.ev` sólo se imprime.
            #
            # ⚠️ Y AL SALIR DE `cs` ENTRA EN `bl`: `bloqueada()` del Worker
            # es «está en bl y NO en cs», así que la persona no pierde el
            # botón, le lleva a la Bloqueada que dice cuánto le falta.
            'cs': [c for c in ORDEN_CARTAS
                   if (c in inventario.get(k, {})
                       or (c == 'servidor' and any(x.startswith('sv-')
                                                   for x in inventario.get(k, {}))))
                   and REQ_FALTA(c, req_fila) is None],
            # 🔴 QUE CARTAS DE SERVIDOR TIENE **ESTA** PERSONA, no cuáles hay
            # para todos. Antes esto vivía en `meta.svs`, que es la
            # INTERSECCIÓN: un servidor entraba sólo si lo tenían las 138. Con
            # 469 personas la intersección se vacía —los 331 nuevos tienen DRA
            # y FFA y nada más— y el menú quedaría con los nueve bloqueados
            # para todo el mundo. Es por persona porque el dato es por persona.
            'svc': sorted(c[3:].upper() for c in inventario.get(k, {})
                          if c.startswith('sv-')),
        }
        # 🔴 LAS BLOQUEADAS QUE TIENE SUBIDAS. Sin esto el Worker no puede
        # distinguir «no existe» de «todavía no», y las dos hacen desaparecer
        # el botón: a Lil Drako le salía UNO solo. Con `bl` el botón va y
        # lleva a una carta que dice cuánto le falta.
        bl = sorted(c[5:] for c in inventario.get(k, {}) if c.startswith('bloq-'))
        if bl:
            valor['bl'] = bl
        # ⚠️ `svs` SOLO SI SE SABE. Una lista vacía y «no lo averigüé» son
        # cosas distintas, y el Worker tiene que poder distinguirlas para
        # caer al comportamiento viejo en vez de decidir sobre nada.
        if svs:
            valor['svs'] = svs
        # 🔴 LOS NÚMEROS QUE COMPARA `/versus`. Dlx, 20/09/2026: *«la idea es
        # que no muestre las tarjetas. La cosa es hacer quién gana»*.
        #
        # ⚠️ UNO POR CATEGORÍA, Y CADA UNO EL DE **SU** CARTA. Es la primera
        # regla del proyecto —«el número de cada carta mide lo que esa carta
        # mide»— y es también el motivo por el que Dlx pidió que no se pueda
        # cruzar Competitiva contra Temporada: son escalas distintas.
        #
        # ⚠️ Y SALEN DE DONDE LAS SACA LA CARTA, no de una cuenta nueva acá.
        # Si el bot dijera «Konan 99» y la carta dibujara otra cosa, el que
        # mira las dos juntas no sabría cuál creer — y ninguna fallaría. Por
        # eso el OVR Nacional viene de `comun/nacional.py`, que es de donde
        # ahora lo lee también `04_Pais/generar.py`.
        v = versus_de(k, x, temp.get(x['raw'], {}), nac)
        if v:
            valor['vs'] = v
        pares.append({'key': 'p:' + k, 'value': json.dumps(valor, ensure_ascii=False)})
        did = p.get('discord_id')
        if did:
            # 🔴 DOS PERSONAS CON EL MISMO ID ES UNA QUE SE QUEDA SIN
            # CARTA, Y EN SILENCIO. La clave `d:<id>` es un mapa: el
            # segundo pisa al primero en KV y el dueño de esa cuenta
            # recibe la carta del otro. Medido el 21/09/2026 sobre el
            # padrón: **1 de 498** —`979878316846768139` figura como
            # Oasis y como Fullylo4ded—.
            #
            # ⚠️ NO SE ELIGE ACÁ CUÁL ES. Cuál de los dos es realmente
            # esa cuenta es identidad, o sea del padrón y de quien lo
            # escribe. Lo que sí es de este paso es **no pisar sin
            # avisar**: se reporta y el que quedó afuera queda dicho.
            #
            # 🔴 PERO SI LOS AKAs YA LO DICEN, MANDAN ELLOS, y no el orden de
            # las filas. Medido el 24/09/2026: de tres IDs repetidos, dos
            # salían bien de casualidad y uno al revés — «luzzano se queda
            # sin carta, gana lzz», con `lzz -> Luzzano` en los AKAs. Los
            # puntos se cargan con el nombre real, así que el día que
            # compita su `/card` abriría la fila vacía.
            if did in por_id:
                otro = por_id[did]
                dup_id.append((did, otro, k))
                if _es_alias_de(k, otro):
                    con_id += 1
                    continue
            por_id[did] = k
            pares.append({'key': 'd:' + did, 'value': k})
            con_id += 1

    # 🔴 ¿ARRANCÓ LA TEMPORADA? Dlx, 22/09/2026: *«cuando el plazo está
    # abierto no hay necesidad de que el usuario necesite el rol especial
    # en DRA, pero cuando la temporada haya iniciado sí es necesario»*.
    # Es de `/foto`: mientras no arrancó, cambiar la cara es libre; después
    # vale una por temporada y el rol es lo que saltea el límite.
    #
    # ⚠️ SE DERIVA, NO SE ESCRIBE. Un booleano a mano es una fecha más que
    # alguien tiene que acordarse de mover —y este repo ya se comió tres
    # veces la forma «la decisión está en un lado y el código la lee de
    # otro»—. «Arrancó» quiere decir que **alguien compitió**, que es
    # exactamente tener gente en el pool de temporada. El día del primer
    # evento esto se da vuelta solo.
    #
    # ⚠️ Y NO ES `gente`: ése cuenta a quien puede TENER carta —320 hoy con
    # el pool en 0—. Lo que decide es haber competido.
    arrancada = bool(temp)
    pares.append({'key': 'meta', 'value': json.dumps({
        'sello': time.strftime('%Y%m%d%H%M'),
        'arrancada': arrancada,
        # cuántos tienen carta, no cuántos compitieron. Ver el comentario del
        # `return` de esta función.
        'gente': len(gente),
        'con_id': con_id,
        # 🔴 QUIEN YA ESTA CARGADO EN EL PADRON Y AUN ASI NO TIENE CARTA.
        # Son los que tienen Discord ID en el padron y no entran a KV —hoy
        # 184: 156 que no se verificaron en DRA y 28 sin bandera—. El
        # Worker no los distingue de un desconocido, porque los dos estan
        # igual de ausentes de KV, y les contestaba lo mismo: *«Ya te
        # anoté ✍️ — un admin te va a cargar»*.
        #
        # ⚠️ ESO ES PROMETER ALGO YA HECHO. A esa persona no le falta que
        # un admin la cargue: ya está cargada. Le falta **verificarse**,
        # que es una accion suya. Medido el 22/09/2026 con Xclusivo, el
        # unico que quedaba en la cola `reg:` despues de vaciarla: ID y
        # pais en el padron, sin el rol de DRA, esperando a alguien que
        # no tenia nada que hacer.
        #
        # ⚠️ VA UNA LISTA EN `meta` Y NO UNA CLAVE POR PERSONA. Serian
        # 184 escrituras por corrida contra un presupuesto de 1.000 al
        # dia, o sea que el ciclo solo entraria cinco veces. Asi son
        # ~4 KB dentro de un valor que hoy pesa 0,4.
        'cargados': sorted(cargados_sin_carta),
        # ⚠️ ACÁ HABÍA UN `req_competitivo` SUELTO Y NO LO LEÍA NADIE. Era de
        # antes de que viajaran los cuatro, y quedó al lado de `req` diciendo
        # lo mismo con otro nombre. No podía discrepar —los dos salen de
        # `REQUISITOS`— pero un campo que parece la fuente y no lo es es de
        # dónde salen las copias: el próximo que lo lea va a creer que ahí
        # vive el número. El de competitivo está en `req.competitivo.n`.
        #
        # 🔴 LOS CUATRO REQUISITOS VIAJAN A KV PARA QUE `/help` NO MIENTA.
        # Un texto de ayuda escrito a mano en el Worker se desactualiza el día
        # que cambia una regla, y no avisa: el 19/09 la Temporada pasó de «2
        # eventos» a «1 participación» y el País dejó de pedir eventos. Un
        # `/help` hardcodeado ya estaría diciendo lo viejo. Saliendo de
        # `comun/requisitos.py` —que es la fuente— el help se corrige solo en
        # la próxima corrida del pipeline.
        # 🔴 VIAJAN **TODAS** LAS CONDICIONES, Y ANTES VIAJABA UNA.
        # Hasta el 22/09/2026 iba `cs[0]` —la primera declarada— con el
        # argumento de que `/help` muestra una linea por carta. El
        # problema es cual quedaba: la primera de Pais es **la bandera**,
        # asi que el help decia *«País — 1 bandera asignada»* cuando la
        # carta pide bandera **y** 3 duelos nacionales **y** 3
        # internacionales. Alguien con bandera leia que le alcanzaba,
        # tiraba `/card` y le salia una Bloqueada pidiendo duelos.
        #
        # ⚠️ Es exactamente lo que el comentario de arriba dice que hay
        # que evitar —«un help a mano se desactualiza y no avisa»— pero
        # un piso mas abajo: la fuente estaba bien y lo que se mandaba
        # era un recorte suyo. Un dato correcto recortado miente igual
        # que uno viejo, y encima parece recien traido.
        #
        # ⚠️ `n` Y `que` SE QUEDAN AUNQUE YA NO SE USEN. El Worker
        # desplegado hoy los lee; si `meta` se actualiza antes que el
        # Worker —y se actualiza cada hora, mientras el Worker se
        # despliega a mano— `/help` se quedaria sin requisitos. Los dos
        # campos viejos cuestan 40 bytes y hacen que el orden de los dos
        # despliegues deje de importar.
        'req': {c: {'n': cs[0][0],
                    'que': cs[0][2][0 if cs[0][0] == 1 else 1],
                    'todos': [[n, et[0 if n == 1 else 1]]
                              for n, _campo, et in cs]}
                for c, cs in REQUISITOS.items() if cs and cs[0][0]},
        # 🔴 LOS OCHO TRAMOS, PARA QUE `/owner` NO LOS TENGA ESCRITOS.
        # Mismo motivo que `req`: el rango es **la** regla del proyecto —una
        # sola letra por persona, igual en sus cuatro cartas— y el único lugar
        # donde vive de verdad es `comun/rangos.py`. Un `/owner rangos` con la
        # tabla a mano en el Worker sería la quinta copia, y este repo ya se
        # comió esa forma tres veces en un día.
        #
        # ⚠️ `desfase` ES EL NÚMERO QUE HAY QUE MIRAR, y se vuelve a medir en
        # cada corrida: cuántos ven una letra en el ranking y otra en su
        # carta. El día que el Sheet adopte los ocho, baja solo a cero — y si
        # alguien lo rompe, sube solo. No hay que acordarse de actualizarlo.
        'rangos': {
            'umbral': UMBRAL,
            'viejo': UMBRAL_VIEJO,
            'desfase': desfase_rangos([x for _, x in gente]),
        },
        # ⚠️ QUE SERVIDORES TIENEN SU CARTA ARRIBA. Se MIDE contra el
        # inventario de R2 en vez de escribirse a mano: el Worker no puede
        # preguntarle a R2 si un objeto existe —serian 10 ms y una consulta
        # por boton—, asi que pregunta esto.
        'svs': servidores_listos(),
        # ⚠️ EN QUÉ SERVIDORES ES MIEMBRO EL BOT. Es lo que deja que el menú
        # diga «no estás en FFA» cuando lo sabe y «el bot todavía no está en
        # TWR» cuando no puede saberlo. Sin esto las dos salían como «no tiene
        # carta», que es el síntoma que ve el bot y no la causa.
        'bot_en': bot_en(),
    })})
    # 🔴 ACÁ SE DEVOLVÍA `len(comp)`, O SEA 138, Y SE IMPRIMÍA COMO «138
    # personas». Pero desde el 19/09 la gente son TODOS LOS QUE TIENEN ALGUNA
    # CARTA EN R2 —469— y el pool competitivo es sólo quien además compitió.
    # Las claves escritas eran las 469 correctas; el número impreso decía 138.
    #
    # ⚠️ NO ERA COSMÉTICO: la corrida de hoy imprimió «138 personas» justo
    # después de que el pipeline pasara de 138 a 469, o sea que se leía como
    # que se habían perdido 331. Hubo que ir a preguntarle a KV para ver que
    # estaban. Un contador que mide otra cosa que la que dice es una alarma
    # falsa, y una alarma falsa gasta lo mismo que una de verdad.
    if dup_id:
        # ⚠️ SE DICE QUIÉN GANÓ DE VERDAD: con los AKAs de por medio ya no
        # es siempre «el segundo». Y los que decidieron los AKAs son un
        # aviso, no una alarma: la cuenta llega a la carta correcta, lo
        # que sobra es una fila repetida en el padrón.
        por_alias = [(d, a, b) for d, a, b in dup_id if _es_alias_de(b, a)]
        print('  %s %d Discord ID repetido(s) en el padrón%s'
              % ('⚠️' if len(por_alias) == len(dup_id) else '🔴',
                 len(dup_id), ' — los AKAs deciden %d' % len(por_alias)
                 if por_alias else ': el segundo pisa al primero en KV'))
        for did, antes, ahora in dup_id[:6]:
            if _es_alias_de(ahora, antes):
                print('     %-20s gana %s: los AKAs dicen que %s es él'
                      % (did, antes, ahora))
            else:
                print('     %-20s %s se queda sin carta, gana %s'
                      % (did, antes, ahora))
    return pares, len(gente), con_id


# El orden en que el bot dibuja los botones. Vive tambien en `worker.js`.
ORDEN_CARTAS = ('temporada', 'competitivo', 'servidor', 'pais')


def servidores_de():
    """{discord_id -> [servidores donde está]}, medido contra Discord.

    ⚠️ SI FALTA, SE SIGUE SIN ÉL Y SE AVISA. Lo escribe
    `herramientas/servidores_de.py --json`, que pide el token; sin el archivo
    cada persona se queda con el `sv` del pool, que es el comportamiento
    anterior. Lo que no se hace es fallar en silencio y subir 469 claves con
    el servidor equivocado.
    """
    p = os.path.join(BASE, 'datos', 'servidores_de.json')
    if not os.path.exists(p):
        print('  ⚠️ falta datos/servidores_de.json — el `sv` sale del pool')
        print('     (lo arma: python herramientas/servidores_de.py --json)')
        return {}
    with io.open(p, encoding='utf-8') as f:
        return json.load(f)


def bot_en():
    """Los servidores donde el bot es miembro. Lo mide servidores_de.py.

    ⚠️ SI FALTA, SE DEVUELVE VACÍO Y EL WORKER ASUME QUE ESTÁ EN TODOS — que
    es como se comportaba antes de que esto existiera. Una lista vacía diría
    «no está en ninguno» y le pondría el cartel de «el bot no está acá» hasta
    a DRA, que es donde vive.
    """
    p = os.path.join(BASE, 'datos', 'bot_en.json')
    if not os.path.exists(p):
        return []
    with io.open(p, encoding='utf-8') as f:
        return json.load(f)


_CC_CACHE = {}


_ALIAS = {}


def _es_alias_de(a, b):
    """¿Los AKAs dicen que `a` es otro nombre de `b`? Claves de KV."""
    if not _ALIAS:
        try:
            with io.open(os.path.join(BASE, 'datos', 'akas.json'),
                         encoding='utf-8') as f:
                _ALIAS.update({_llave(k): _llave(v) for k, v in
                               (json.load(f).get('alias') or {}).items()})
        except (OSError, ValueError):
            _ALIAS['_'] = ''
    # ⚠️ LA CADENA ENTERA: `gekto -> geekto -> Presagio`
    visto, x = set(), _llave(a)
    while x in _ALIAS and x not in visto:
        visto.add(x)
        x = _ALIAS[x]
        if x == _llave(b):
            return True
    return False


def _llave(s):
    """Un nombre como clave de comparación: sólo letras y números."""
    import unicodedata
    s = unicodedata.normalize('NFKD', str(s or ''))
    return ''.join(c for c in s if c.isalnum()).lower()


def _cc_de(pais):
    """El código de 2 letras de ese país, o `''`.

    ⚠️ LA TABLA NO SE ESCRIBE A MANO: sale de cruzar el `cc` del pool con
    el nombre del padrón, que es lo que ya hace `bot/bloqueadas.cc_de_pais()`.
    Dos tablas escritas a mano en dos archivos discrepan; ésta no puede.

    ⚠️ Y SI EL POOL ESTÁ VACÍO la tabla sale vacía, que es honesto: sin un
    solo cruce no hay de dónde deducir el código. `pais_por_rol` la completa
    con los que sí conoce.
    """
    if not pais:
        return ''
    if not _CC_CACHE:
        try:
            import bloqueadas as _BQ
            _CC_CACHE.update(_BQ.cc_de_pais())
        except Exception:                                # noqa: BLE001
            _CC_CACHE['_'] = ''
    return _CC_CACHE.get(str(pais).strip(), '')


def leer_inventario():
    p = os.path.join(BASE, 'datos', 'cartas_r2.json')
    if not os.path.exists(p):
        return {}
    with io.open(p, encoding='utf-8') as f:
        return json.load(f)


def servidores_listos():
    """Los codigos de servidor cuya carta esta en R2 PARA TODAS las personas.

    ⚠️ ES UNA LISTA Y NO UN BOOLEANO, Y ESO COSTO UNA VUELTA. Primero fue
    `por_servidor: true/false`. No sirve: las tandas se suben de a un servidor,
    asi que con FFA subido y TWR no, el booleano tiene que decir False —o el
    menu manda a una URL que no esta— y entonces FFA tampoco anda, que era
    justo lo que habia que arreglar.

    ⚠️ Y ES INTERSECCION, NO UNION. Un servidor entra solo si lo tienen TODAS:
    si a uno le falta, ese uno ve un hueco. Discord no avisa de una imagen que
    no carga, asi que el error se ve recien cuando lo reporta una persona.

    ⚠️ SE PREGUNTA POR EL DATO, NO POR LA INTENCION. `datos/cartas_r2.json` es
    lo que dejo la ultima subida.
    """
    mapa = leer_inventario()
    if not mapa:
        return []
    comun = None
    for cartas in mapa.values():
        suyos = {c[3:].upper() for c in cartas if c.startswith('sv-')}
        comun = suyos if comun is None else (comun & suyos)
        if not comun:
            return []
    return sorted(comun)


#: hasta dónde escribe este script en un día. Lo que queda hasta 1.000 es
#: la reserva de la web (`web:lobby`, una escritura por corrida que cambia)
TOPE_DIA = 850
#: si no se puede saber cuánto se usó hoy, cuánto escribe una corrida
SIN_DATO = 300


def presupuesto(s, pares, usadas=None):
    """`(las que se escriben ahora, cuántas quedan para después)`.

    🔴 EL 24/09/2026 LA CUOTA SE AGOTÓ Y EL HUB SE QUEDÓ CONGELADO. 1.117
    escrituras de 1.000: sumar y sacar a 104 personas del portón fueron
    ~400 de golpe, y a las 7:52 PM ET la web —una sola clave— no pudo
    subirse. El diff-writer ya existía: lo que faltaba era que una corrida
    no pudiera gastar lo que el resto del día necesita.

    ⚠️ LO QUE NO ENTRA NO SE PIERDE: sigue siendo distinto de lo que hay
    arriba, así que la corrida siguiente lo vuelve a encontrar. Un cambio
    grande se reparte en varias corridas en vez de congelar la web.

    ⚠️ `meta` VA PRIMERO: es el sello con el que Discord sirve las cartas
    nuevas, y sin él lo demás no se ve.
    """
    if usadas is None:
        try:
            from cuotas import kv_hoy
            usadas = kv_hoy(s).get('write')
        except Exception:                                # noqa: BLE001
            usadas = None
    libre = (TOPE_DIA - usadas) if usadas is not None else SIN_DATO
    libre = max(libre, 1)          # `meta` entra siempre
    if len(pares) <= libre:
        if usadas is not None:
            print('  presupuesto de KV: %d usadas hoy, %d libres para este '
                  'script' % (usadas, TOPE_DIA - usadas))
        return pares, 0
    orden = sorted(pares, key=lambda p: p['key'] != 'meta')
    ahora, despues = orden[:libre], orden[libre:]
    print('  ⚠️ presupuesto de KV: %s hoy; escribo %d y dejo %d para las '
          'corridas siguientes' % ('%d usadas' % usadas if usadas is not None
                                   else 'no sé cuántas', len(ahora), len(despues)))
    return ahora, len(despues)


def solo_las_que_cambiaron(s, pares):
    """De las 241, las que KV todavia no tiene igual.

    🔴 ESTO EXISTE PORQUE LA CUOTA SE ACABO DE VERDAD. El 17/09/2026 la API
    contesto `[10048] your account has reached the free usage limit for this
    operation for today`: 1.209 escrituras sobre un limite de 1.000. El sello
    no se escribio, y sin sello nuevo Discord sigue sirviendo las cartas
    viejas de su cache — o sea que 276 cartas recien subidas quedaron
    invisibles por UNA clave que no entro.

    ⚠️ Y LA CULPA NO ERA DEL VOLUMEN, ERA DE REESCRIBIR LO QUE YA ESTABA.
    Cada corrida mandaba las 241 aunque no hubiera cambiado ninguna. Dos
    refrescos en un dia son 482 escrituras para, casi siempre, cero cambios.

    ⚠️ LAS LECTURAS SON OTRA CUOTA Y SOBRAN: 100.000 por dia contra 1.000 de
    escritura, y hoy se usaron 1.712. O sea que leer las 241 para no escribir
    ninguna sale practicamente gratis. Cambiar escrituras por lecturas es el
    intercambio que este limite pide.

    `--todas` fuerza la escritura completa, para cuando se sospecha que KV
    quedo raro.
    """

    # 🔴 POR `bulk/get` Y NO POR `/values/<clave>`, y este modulo ya
    # tenia medido por que: el endpoint de a una **da el valor viejo**
    # justo despues de escribir. Esta escrito treinta lineas mas abajo
    # —«imprimio el sello VIEJO un segundo despues»— y sin embargo esta
    # funcion, que es la que decide QUE SE ESCRIBE, seguia leyendo por
    # ahi.
    #
    # ⚠️ Y LA DIRECCION DEL ERROR ES LA MALA. Si la lectura vieja
    # coincide con lo que se iba a escribir, la clave se da por igual y
    # **no se escribe** — el dato se queda viejo y la corrida informa
    # «nada cambio». Es el mismo modo de falla que el sello del ciclo.
    #
    # ⚠️ Y ADEMAS SON 7 REQUESTS EN VEZ DE 625. `bulk/get` acepta 100
    # claves por llamada, asi que el hilo de 12 obreros deja de hacer
    # falta.
    def _lote(ks):
        r = s.post('%s/bulk/get' % API, json={'keys': ks}, timeout=40)
        try:
            v = (r.json().get('result') or {}).get('values') or {}
        except ValueError:
            return {}
        return {k: (x.get('value') if isinstance(x, dict) else x)
                for k, x in v.items()}

    arriba_de = {}
    for i in range(0, len(pares), 100):
        arriba_de.update(_lote([p['key'] for p in pares[i:i + 100]]))

    distintas = []
    for par, arriba in ((p, arriba_de.get(p['key'])) for p in pares):
            # ⚠️ Se comparan los OBJETOS, no las cadenas: json.dumps puede
            # cambiar el orden de las claves entre versiones de Python y
            # entonces "todo cambio" sin que cambiara nada.
            try:
                igual = arriba is not None and json.loads(arriba) == json.loads(par['value'])
            except (ValueError, TypeError):
                igual = arriba == par['value']      # `d:<id>` guarda texto pelado
            if not igual:
                distintas.append(par)
    return distintas


def main():
    s = sesion()

    if '--ver' in sys.argv:
        # 🔴 ESTO LEÍA POR `/values/<clave>` Y ESE ENDPOINT MIENTE. Lo dice el
        # comentario de la comprobación de más abajo, en este mismo archivo:
        # sirve una copia cacheada. O sea que el modo que existe para MIRAR
        # qué hay en KV era el único que quedó leyendo del lugar equivocado.
        #
        # Medido hoy: recién escrito el sello `202609200020`, `--ver` seguía
        # mostrando `202609192350` y el `req_competitivo` que ya se había
        # borrado, mientras `bulk/get` sobre las mismas claves devolvía lo
        # nuevo. Es el mismo rato perdido que el comentario de abajo cuenta,
        # repetido porque el arreglo llegó a un camino y no al otro.
        claves = ['meta', 'p:konan', 'p:bloody']
        r = s.post('%s/bulk/get' % API, json={'keys': claves}, timeout=30)
        vals = ((r.json().get('result') or {}).get('values') or {}) if r.ok else {}
        for k in claves:
            v = vals.get(k)
            print('  %-12s %s' % (k, (json.dumps(v, ensure_ascii=False)
                                      if not isinstance(v, str) else v)[:150]
                                  if v is not None else '— no está'))
        return

    pares, n, con_id = armar()

    # ⚠️ `--solo-meta` NO ES UN ATAJO: ES EL PRESUPUESTO DE KV. Son 1.000
    # escrituras por dia y una corrida completa son 240. Subir una tanda de
    # cartas no cambia los datos de nadie — cambia QUE SERVIDORES ESTAN LISTOS,
    # que es una sola clave. Con nueve tandas, la diferencia es 2.160
    # escrituras contra 9.
    # 🔴 `--solo-meta` NO LIMPIA HUERFANAS, Y ESTO NO ES UN DETALLE.
    #
    # `limpiar_huerfanas()` borra de KV toda clave que no este en la lista
    # que se le pasa. En este modo la lista es **una sola clave**, `meta`,
    # asi que pasarsela significaria «las otras 912 sobran». No llegaria a
    # pasar —el guardian de la mitad lo frena— pero frenar en el guardian
    # no es funcionar: es que el ultimo cable no se corto.
    #
    # ⚠️ Y HASTA HOY NI SIQUIERA LLEGABA AHI: `todas_las_claves` se asigna
    # en la rama de abajo, asi que este modo reventaba con
    # `UnboundLocalError` en la ultima linea. Medido el 22/09: la tanda de
    # DRA dibujo y subio sus **311 cartas**, y despues murio en este
    # llamado — con lo cual `meta` no se escribio y la tanda de FFA
    # nunca arranco. El trabajo estaba hecho y una variable lo tiro.
    #
    # El modo escribe una clave; su autoridad es esa clave. `None` dice
    # «no se cuales son todas», que es la verdad.
    solo_meta = '--solo-meta' in sys.argv
    todas_las_claves = None
    if solo_meta:
        pares = [p for p in pares if p['key'] == 'meta']
        print('ESCRIBIENDO SOLO `meta`\n')
        print('  %s\n' % pares[0]['value'])
    else:
        print('ESCRIBIENDO EN KV\n')
        print('  %d personas  +  %d indices de Discord ID  +  meta' % (n, con_id))
        pedidas = len(pares)
        # 🔴 LAS CLAVES QUE **CORRESPONDEN**, no las que se escriben.
        # `limpiar_huerfanas()` borra lo que no está en este conjunto, y
        # pasarle la lista ya filtrada por `solo_las_que_cambiaron()`
        # significaría «todo lo que no cambió sobra». Medido el 22/09:
        # con la lista filtrada quería borrar **600 de 912** —incluidas
        # las 312 personas válidas que simplemente no habían cambiado—.
        # Lo frenó el guardián de la mitad, que existe justo para esto.
        todas_las_claves = list(pares)
        if '--todas' not in sys.argv:
            pares = solo_las_que_cambiaron(s, pares)
        print('  %d de %d claves cambiaron  ->  %d escritura(s) de las 1.000 diarias\n'
              % (len(pares), pedidas, len(pares)))
        if not pares:
            print('  nada que escribir: KV ya dice lo mismo.\n')
            return
        pares, diferidas = presupuesto(s, pares)
        if diferidas:
            # ⚠️ sin limpiar huérfanas: borrar también gasta escrituras, y
            # lo que no entró hoy entra en las corridas siguientes
            todas_las_claves = None

    # La API acepta hasta 10.000 por tanda; se manda de a 1.000 para que un
    # error diga en qué tanda pasó.
    subidas = 0
    for i in range(0, len(pares), 1000):
        lote = pares[i:i + 1000]
        if _ok(s.put(API + '/bulk', json=lote), 'bulk %d' % i) is None:
            sys.exit(1)
        subidas += len(lote)
        print('  tanda %-3d  %d claves' % (i // 1000 + 1, len(lote)))

    print('\n  ✅ %d claves escritas' % subidas)
    if todas_las_claves is None:
        print('  (no limpio huérfanas: esta corrida no vio todas las claves)')
    else:
        limpiar_huerfanas(s, todas_las_claves)

    # ⚠️ Se comprueba LEYENDO, no confiando en el 200 de la escritura.
    #
    # 🔴 Y SE LEE POR `bulk/get`, NO POR `/values/<clave>`. El endpoint de a
    # una sirve una copia CACHEADA: el 19/09/2026 esta comprobación mostró a
    # Konan con su `sv` viejo —TWR— justo después de escribirle DRA, y el
    # escritor por diferencia, que lee por el mismo camino, decía que ya estaba
    # bien. Dos lecturas de la misma clave contestando distinto es lo que hace
    # perder media hora buscando una escritura que nunca falló. `bulk/get`
    # devuelve el valor de verdad.
    # ⚠️ Y AUN ASÍ PUEDE TARDAR UN INSTANTE. El 20/09 esta comprobación,
    # corriendo con `bulk/get`, imprimió el sello VIEJO un segundo después de
    # una escritura que sí había entrado — la misma clave leída de nuevo a los
    # pocos segundos ya traía el nuevo. O sea que `bulk/get` da el valor real
    # y no el de la caché de `/values/`, pero **no es de lectura inmediata**.
    # Si lo de abajo se ve viejo, volver a leer antes de dar nada por perdido.
    print('\ncomprobando...')
    r = s.post('%s/bulk/get' % API, json={'keys': ['meta', 'p:konan']}, timeout=30)
    vals = ((r.json().get('result') or {}).get('values') or {}) if r.ok else {}
    for k in ('meta', 'p:konan'):
        print('  %-10s %s' % (k, str(vals.get(k, '— no está'))[:140]))


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
