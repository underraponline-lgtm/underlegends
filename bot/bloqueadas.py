# -*- coding: utf-8 -*-
"""LAS CARTAS BLOQUEADAS DE CADA PERSONA, una por cada carta que no llega.

    python bot/bloqueadas.py             el plan, sin dibujar nada
    python bot/bloqueadas.py --generar   las dibuja
    python bot/bloqueadas.py --generar --limite=100

Dlx, 19/09/2026, mirando la carta de Lil Drako: *«faltan los otros botones
no?»*. Le salía UN botón —Servidor— porque es la única carta que tiene. Las
otras tres no estaban, y no estar no explica nada.

🔴 «NO EXISTE» Y «TODAVÍA NO» SON DOS COSAS, Y HASTA HOY SE VEÍAN IGUAL.
`CLAUDE.bot.md` decidió **quitar** el botón de la carta que no está, y el caso
que justificó esa regla fue **Mark, que no tiene país**: su carta de País no se
emite a propósito —«sin dato no hay pieza»— y dibujarle el botón daba un hueco.
Pero Lil Drako sí puede tener Temporada: le faltan 2 eventos. Ahí no hay nada
ausente, hay algo **pendiente**, y para eso el proyecto ya tenía dibujada la
Bloqueada… que el bot no estaba usando.

    no existe  (Mark / País)        -> el botón se saca. La regla de antes.
    todavía no (Drako / Temporada)  -> el botón va, y lleva a la Bloqueada.

⚠️ UNA POR CARTA, NO UNA GENÉRICA. La Bloqueada muestra CUÁNTO FALTA, y falta
distinto para cada una: a Drako le faltan 2 eventos para la Temporada y 10 para
la Competitiva. Una sola imagen tendría que elegir un número y mentir en los
otros dos botones.

⚠️ LA SERVIDOR NO ENTRA. Su requisito es «1 evento en ESE servidor» y el pool
no trae `ev_por_sv` —el builder lee las 7 columnas sólo para el argmax y tira
los valores—, así que `comun/requisitos.py` revienta a propósito en vez de
contestar 0. Hasta que ese dato exista, la Servidor se emite siempre.

✅ EL PAÍS ENTRÓ EL 22/09/2026, Y ACÁ DECÍA QUE QUEDABA AFUERA. El párrafo
anterior argumentaba que bloquearlo «marcaría una diferencia que no existe»,
y era cierto **mientras su requisito fuera «1 evento nacional»**: no hubo
ninguno, así que los 138 del pool estaban tan lejos de cumplirlo como los 331.
Un requisito que nadie puede cumplir no separa a nadie.

Dlx lo cambió ese día: **3 duelos nacionales + 3 internacionales + bandera
asignada**. Eso sí se puede cumplir y sí se puede medir —`clasificar_duelos()`
cruza cada duelo contra el país del padrón—, así que hay progreso que mostrar,
que es de lo que habla la Bloqueada.

⚠️ Y EL PAÍS SE SALTEA A QUIEN NO TIENE PAÍS. Es el caso de Mark: no está
bloqueado, es que no hay carta que emitirle. Bloquearlo diría que le falta
jugar algo, y lo que le falta es un dato.

⚠️ SU CONTENIDO ES UN CONTADOR, Y POR ESO TIENE SELLO. «2/3 DUELOS
NACIONALES» cambia cada vez que la persona compite y el nombre del archivo no.
Ver `_sello_de()`: se hashea el HTML, no los datos sueltos.
"""
import asyncio
import io
import json
import os
import hashlib
import re
import sys
import time
import unicodedata

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, BASE)
sys.path.insert(0, os.path.join(BASE, 'sheet'))

from comun import bloqueada as BL      # noqa: E402
from comun.claves import clave as CLAVE   # noqa: E402
from comun import requisitos as REQ    # noqa: E402

SALIDA = os.path.join(BASE, 'bot', 'salida', 'bloqueadas')
# la Servidor queda afuera por lo que dice el encabezado
# 🔴 PAIS ENTRA EL 22/09/2026, y hasta ese día no correspondía. Su
# requisito era «tener país», que es identidad y no logro: quien lo
# cumplía ya tenía la carta y quien no, no podía hacer nada para
# ganársela — no había progreso que mostrar, que es de lo que habla la
# Bloqueada. Con el requisito nuevo —3 duelos nacionales, 3
# internacionales y bandera— sí lo hay.
#
# ⚠️ SERVIDOR SIGUE AFUERA Y NO ES UN OLVIDO. No pide nada, así que
# nadie puede estar bloqueado de ella: `comun/bloqueada.py` levanta
# `ValueError` si se le pide una, a propósito.
CARTAS = ('temporada', 'competitivo', 'pais')

# ⚠️ 24 Y NO 8, MEDIDO EL 22/09/2026 con el código de verdad y verificando
# cada PNG —esquinas transparentes y tinta, los dos errores que este formato
# admite sin quejarse—:
#
#     por tanda    s/carta    PNG sanos
#         8          0.59      8 de 8
#        24          0.39     24 de 24
#        48          0.39     48 de 48
#        80          0.45     80 de 80
#
# Lo caro no es dibujar, es **arrancar Chromium**: con 8 se arranca 180 veces
# para las 1.440 filas del plan. La curva se aplana en 24 y a 80 empieza a
# subir de nuevo.
#
# ⚠️ EL 8 VENÍA DE LA CARTA DE PAÍS Y AHÍ ESTÁ BIEN. Esas son grandes y su
# hoja de control llega a 11.856 × 15.588, donde Chromium **tira cartas en
# blanco sin avisar** —96 de 137 medidas—; por eso trabaja de a 24. La
# Bloqueada es chica y no tiene foto ni fondo. Copiar el número de la otra
# carta era copiar su límite sin su motivo.
POR_TANDA = 24


def _slug(s):
    """La clave de esa persona. Vive en `comun/claves.py`, no aca.

    🔴 ESTA FUNCION ESTUVO MAL DE TRES MANERAS DISTINTAS EN UN SOLO DIA, y
    ninguna tiraba un error. Con `[^a-z0-9]`: **Ññ** y **Ржунимагу** quedaban
    en `''` y sus cartas se pisaban entre si; **Lázaro** quedaba en `lzaro` y
    se subia a una clave que el bot nunca consulta. Copiar la regla era el
    problema, asi que ahora hay una sola.
    """
    return CLAVE(s)

SELLOS = os.path.join(BASE, 'datos', 'bloqueadas_selladas.json')


_FOTOS = {}


def _foto(nom, per):
    """La cara de esa persona como `data:` URI, o None (sale la inicial).

    🔴 FALTABA, Y ESTABA DECIDIDA. `CLAUDE.md`: *«la bandera y la foto SÍ
    van… la foto va apagada y detrás del velo — sos vos, pero todavía no
    es tu carta»*. `comun/bloqueada.py` tiene su CSS afinado y el pipeline
    baja el espejo de caras «porque la Bloqueada lleva foto» — y este
    archivo nunca se la pasaba a `html()`. Las 1.625 publicadas salían con
    la inicial. Lo encontró la revisión del 24/09/2026 mirando la de
    Hassan, que tiene foto en las otras cartas y una «H» en ésta.

    ⚠️ La misma regla que las otras cuatro cartas: `respaldo.avatar()`, que
    prefiere la copia del repo y sólo acepta una URL si lleva el ID de esa
    persona. Una por nombre y por corrida: el sello y el dibujo la piden
    los dos.
    """
    if nom not in _FOTOS:
        try:
            from comun import respaldo as RS
            _FOTOS[nom] = RS.avatar(nom, (per or {}).get('av') or '') or None
        except Exception:                                # noqa: BLE001
            _FOTOS[nom] = None
    return _FOTOS[nom]


def _sello_de(t, css):
    """El hash de lo que esa Bloqueada VA A DIBUJAR.

    🔴 SE HASHEA EL HTML, NO LOS DATOS SUELTOS. La Bloqueada muestra un
    contador —«2/3 DUELOS NACIONALES»— y ese texto sale de
    `requisitos.cual_falta()`, que mira varios campos y puede cambiar de
    condicion: quien ya tiene sus 3 duelos nacionales pasa a mostrar los
    internacionales. Hashear `ev` y poco mas dejaria afuera justo el
    numero que se ve.

    Hashear el HTML tapa las dos mitades de una sola vez: si cambia el
    dato **o** cambia como se dibuja, cambia el sello. Es la misma regla
    que `comun/huella_codigo.py` aplica a las otras cuatro cartas
    —`<datos>:<codigo>`— resuelta acá de la forma mas directa que hay,
    porque acá el HTML es barato de generar y la carta no.
    """
    _k, nom, cc, ev, carta, per = t
    # ⚠️ CON LA FOTO ADENTRO: si alguien cambia su cara con `/foto`, su
    # Bloqueada también se tiene que redibujar, y eso lo ve sólo un sello
    # que incluya la foto.
    html = BL.html(nom, cc, ev, foto=_foto(nom, per),
                   silueta=BL.FORMAS[BL.FORMA][0], carta=carta, persona=per)
    h = hashlib.sha1()
    h.update(html.encode('utf-8'))
    h.update(css)
    return h.hexdigest()[:16]


def sellos_viejos():
    try:
        with io.open(SELLOS, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def guardar_sellos(d):
    with io.open(SELLOS, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(d, f, ensure_ascii=False, indent=1, sort_keys=True)


def inventario():
    p = os.path.join(BASE, 'datos', 'cartas_r2.json')
    with io.open(p, encoding='utf-8') as f:
        return json.load(f)


def cc_de_pais():
    """{nombre de país -> código de 2 letras}, deducido de los datos que hay.

    ⚠️ EL PADRÓN GUARDA EL PAÍS POR NOMBRE Y LA CARTA PIDE EL CÓDIGO. Sin este
    cruce, los 331 salían con `cc` vacío y **sin bandera** — y la bandera es lo
    único que la Bloqueada conserva a propósito: «la bandera es identidad, el
    número es ranking». Es el mismo mapa que usa `bot/cartas_nuevas.py`, sacado
    de cruzar el `cc` del pool con el nombre del padrón, para no escribir a
    mano una tabla que después discrepe.
    """
    import construir_padron as PAD
    idx = {PAD.norm(x['raw']): x for x in PAD.cargar()}
    mapa = {}
    with io.open(os.path.join(BASE, 'datos', 'competitivo_pool.json'),
                 encoding='utf-8') as f:
        for x in json.load(f):
            pais = (idx.get(PAD.norm(x['raw'])) or {}).get('pais')
            if pais and x.get('cc'):
                mapa.setdefault(pais.strip(), x['cc'])

    # 🔴 Y SI EL POOL ESTA VACIO, ESTE MAPA QUEDA VACIO Y **NADIE TIENE
    # BANDERA**. Medido el 22/09, justo después del reset: las 469
    # cartas de País se saltearon con el motivo «no tiene país», cuando
    # el país lo tienen 747 personas en el padrón — lo que faltaba era
    # el traductor de nombre a código, que se derivaba del pool.
    #
    # ⚠️ Es la misma forma que el bug de los avatares: **el dato estaba
    # y el pipeline lo tiraba**, sólo que acá el que se vació fue el
    # intermediario. Y le pegaba justo a la bandera, que es lo único
    # que la Bloqueada conserva a propósito — *«la bandera es
    # identidad, el número es ranking»*.
    #
    # El respaldo es la tabla de `sheet/pais_por_rol.py`, que resuelve
    # por TEXTO y no por emoji. No se copia: se importa.
    try:
        sys.path.insert(0, os.path.join(BASE, 'sheet'))
        from pais_por_rol import _iso_del_nombre
        for x in PAD.cargar():
            pais = (x.get('pais') or '').strip()
            if pais and pais not in mapa:
                iso = _iso_del_nombre(pais)
                if iso:
                    mapa[pais] = iso
    except Exception:                                    # noqa: BLE001
        pass          # sin el respaldo se sigue con lo que dé el pool
    return mapa


def plan():
    """[(clave, nombre, cc, ev, carta)] de todo lo que hay que dibujar."""
    import construir_padron as PAD
    inv = inventario()
    idx = PAD.por_nombre()
    mapa_cc = cc_de_pais()
    pools = {}
    for f in ('competitivo_pool.json', 'temporada_pool.json'):
        with io.open(os.path.join(BASE, 'datos', f), encoding='utf-8') as fh:
            for x in json.load(fh):
                pools.setdefault(PAD.norm(x['raw']), {}).update(x)

    out, sin_pais = [], 0
    for k in sorted(inv):
        tiene = inv[k]
        p = pools.get(k) or {}
        per = idx.get(k) or {}
        nom = p.get('raw') or per.get('raw') or k
        cc = p.get('cc') or mapa_cc.get((per.get('pais') or '').strip()) or ''
        ev = int(p.get('ev') or 0)
        for c in CARTAS:
            # 🔴 MANDA EL REQUISITO, NO EL INVENTARIO DE R2. Acá decía
            # `if c in tiene: continue  # ya la tiene de verdad`, y tener
            # el archivo arriba **no es** haberla ganado: es que alguna
            # corrida la dibujó. Medido el 21/09/2026: **21 de los 22**
            # que no llegan a los 10 eventos tienen su Competitiva
            # normal en R2, y como `cs` sale del inventario y le gana a
            # `bl`, el bot se la sirve. O sea que el requisito está
            # implementado en `comun/requisitos.py`, tiene self-check,
            # está decidido en `CLAUDE.md` —«22 pierden la carta»— y no
            # lo aplicaba ningún eslabón.
            #
            # ⚠️ Es la misma forma que este repo ya documenta tres
            # veces: **contar lo que hay en disco no es contar lo que
            # salió**. Acá al revés y peor — el inventario se tomaba por
            # autoridad sobre si la carta estaba *merecida*.
            #
            # 🔴 Y ES LO QUE HACE QUE EL DÍA DEL RESET FUNCIONE. Cuando
            # la T1 arranque en cero, nadie llega a ningún requisito
            # numérico y **todos** tienen carta vieja en R2: con la
            # condición de antes no se dibujaba una sola Bloqueada y el
            # bot seguía sirviendo las cartas de la pre-temporada.
            # 🔴 EL REQUISITO DECIDE SIEMPRE, TAMBIEN SIN DATOS — y acá
            # había una segunda condición que lo deshacía:
            #
            #     if not p and c in tiene: continue   # «mando lo que hay»
            #
            # O sea: sin fila en el pool, si la carta ya estaba en R2 se
            # servía esa. Eso es **exactamente** lo que el comentario de
            # arriba dice que no puede pasar el día del reset, escrito
            # una línea más abajo. Medido el 22/09, después de resetear:
            # con el pool en 0 nadie tiene `p`, así que no se dibujaba
            # **ni una sola** Bloqueada y el bot seguía sirviendo las
            # 2.558 cartas de la pre-temporada.
            #
            # ⚠️ Tenía sentido cuando el pool estaba lleno: ahí `not p`
            # quería decir «esta persona está fuera del ranking». Hoy
            # quiere decir «la temporada no empezó», que es lo
            # contrario — y la diferencia no se ve en el código, se ve
            # en los datos.
            #
            # `falta(c, {})` da 0 en todos los campos, o sea bloqueada,
            # que es la respuesta correcta para quien no compitió.
            if REQ.falta(c, p) is None:
                continue                      # la cumple: le toca la normal
            # 🔴 PAIS SIN PAIS **SI** SE BLOQUEA, DESDE EL 22/09/2026, y
            # el que cambió fue el requisito. Acá decía «se omite» con
            # este argumento: *«no está bloqueado, es que no hay carta
            # que emitirle; bloquearlo diría que le falta jugar algo, y
            # lo que le falta es un dato»*.
            #
            # Era cierto mientras el requisito no hablara de la
            # bandera. Ahora la pide explícitamente, así que no tener
            # país **es** una de las tres condiciones sin cumplir — y
            # la Bloqueada lo dice con todas las letras: «0/1 BANDERA
            # ASIGNADA». Eso es accionable: alguien le carga el país.
            #
            # ⚠️ Y OMITIRLO DEJABA A 23 PERSONAS SIN BOTON, que es lo
            # que encontró `mudos()`. Un botón que no está no dice «te
            # falta la bandera», no dice nada.
            #
            # ⚠️ La bandera en sí sigue sin dibujarse cuando no hay —
            # «sin dato no hay pieza»—; eso es la pieza, no la carta.
            if c == 'pais' and not cc:
                sin_pais += 1
            # 🔴 VA LA FILA, no sólo `ev`. Con un requisito compuesto
            # —País pide tres— el `ev` solo no alcanza para saber qué
            # condición falta, y `bloqueada.html()` terminaba mostrando
            # la primera: «0/1 BANDERA ASIGNADA» a gente con bandera.
            # Ver `comun/requisitos.cual_falta()`.
            out.append((k, nom, cc, ev, c, dict(p, cc=cc)))
    return out, sin_pais


async def dibujar(tanda, destinos):
    """Una página con varias cartas y un PNG transparente por cada una."""
    from playwright.async_api import async_playwright
    silueta, margen = BL.FORMAS[BL.FORMA]
    with io.open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                 encoding='utf-8') as f:
        fuentes = f.read()
    cuerpo = ''.join(
        '<div class="uno">%s</div>'
        % BL.html(nom, cc, ev, foto=_foto(nom, per), silueta=silueta,
                  carta=c, persona=per)
        for _, nom, cc, ev, c, per in tanda)
    pag = ('<!DOCTYPE html><meta charset="utf-8"><style>' + fuentes
           + BL.css(silueta, margen)
           # ⚠️ FONDO TRANSPARENTE Y SIN SOMBRA DE PÁGINA. El PNG cae en
           # Discord sobre lo que haya; un fondo oscuro acá se vería como un
           # rectángulo alrededor de la silueta.
           + 'body{background:transparent;margin:0;padding:0;display:flex;gap:0}'
             '.uno{background:transparent}</style>' + cuerpo)
    tmp = os.path.join(SCR, '_bloq_tanda.html')
    with io.open(tmp, 'w', encoding='utf-8') as f:
        f.write(pag)
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(
            viewport={'width': max(400, len(tanda) * silueta.w + 40),
                      'height': silueta.h + 40},
            device_scale_factor=3)
        await pg.goto('file://' + tmp.replace(os.sep, '/'))
        await pg.wait_for_timeout(500)
        nodos = await pg.query_selector_all('.uno')
        if len(nodos) != len(tanda):
            raise RuntimeError('dibujé %d nodos y esperaba %d'
                               % (len(nodos), len(tanda)))
        for nodo, dest in zip(nodos, destinos):
            await nodo.screenshot(path=dest, omit_background=True)
        await b.close()
    os.remove(tmp)


def faltan_en_r2():
    """(cuántas Bloqueadas faltan publicadas, cuántas hacen falta).

    🔴 EXISTE PARA QUE `sheet/resetear.py` PUEDA PREGUNTARLO. El reset es
    irreversible y el orden importa: `CLAUDE.md` y el checklist de la T1
    dicen que esto va **primero**, porque sin las Bloqueadas publicadas
    la carta desaparece —`cs` la suelta al caer el requisito y `bl` no la
    tiene— y al usuario se le va el botón. Un orden que vive sólo en un
    documento es un orden que alguien va a invertir a las tres de la
    mañana del día del reset.

    ⚠️ SE PREGUNTA POR R2 Y NO POR EL DISCO. El pipeline borra los PNG
    después de subirlos: mirar la carpeta da por faltante lo que ya está
    publicado, y un PNG viejo se llama igual que el nuevo. Es la misma
    regla que `main()` tiene escrita más abajo.
    """
    todo, _ = plan()
    inv = inventario()
    faltan = [t for t in todo
              if ('bloq-' + t[4]) not in (inv.get(t[0]) or {})]
    return len(faltan), len(todo)


def mudos(todo=None):
    """Quién se quedaría SIN carta y SIN Bloqueada. `[]` si nadie.

    🔴 ESTE ES EL INVARIANTE QUE FALLÓ EL 22/09 Y QUE NADIE MIRABA.
    Para cada carta con requisito, una persona tiene que tener **una de
    las dos cosas**: la carta —porque lo cumple— o la Bloqueada —porque
    no—. Si no tiene ninguna, en el bot **el botón desaparece**: no dice
    «te falta esto», no dice nada.

    ⚠️ Y DESAPARECER ES LO MÁS PARECIDO A FUNCIONAR QUE HAY. Un botón
    que no está no tira error, no deja rastro en ningún log y desde
    afuera se lee como «esa carta no es para mí». Por eso el checklist
    de la T1 dice que las Bloqueadas van **primero** — y por eso hacía
    falta poder preguntarlo en vez de recordarlo.

    ⚠️ SERVIDOR NO CUENTA: no pide nada, así que nunca está bloqueada.
    """
    if todo is None:
        todo, _ = plan()
    inv = inventario()
    plan_de = {}
    for k, _n, _cc, _ev, c, _p in todo:
        plan_de.setdefault(k, set()).add(c)
    out = []
    for k, tiene in sorted(inv.items()):
        for c in CARTAS:
            if not REQ.condiciones(c):
                continue
            if c in tiene:
                continue                      # la carta de verdad
            if ('bloq-' + c) in tiene:
                continue                      # su Bloqueada, ya publicada
            if c in plan_de.get(k, ()):
                continue                      # la va a tener al dibujar
            out.append((k, c))
    return out


def main():
    todo, sin_pais = plan()
    os.makedirs(SALIDA, exist_ok=True)
    pend = [(t, os.path.join(SALIDA, 'bloq-%s_%s.png' % (t[4], _slug(t[1]))))
            for t in todo]
    # ⚠️ «YA ESTA» ES ESTAR EN R2, NO TENER EL PNG. El disco es un
    # intermedio —el pipeline borra los PNG despues de subirlos— asi que
    # preguntar solo por el archivo da por faltante lo que ya esta
    # publicado y lo redibuja de gratis. Le paso a `cartas_nuevas.py`, que
    # decia «faltan 464» de cartas que estaban todas arriba.
    #
    # ⚠️ AL REVES TAMBIEN CUENTA: un PNG viejo en la carpeta se llama
    # igual que el nuevo, asi que el disco solo tampoco sirve para decir
    # «ya esta hecho». El inventario de R2 es lo publicado; los dos
    # juntos son «no hace falta volver a dibujarlo».
    inv = inventario()

    # 🔴 Y «YA ESTA» TAMPOCO ES «DICE LO MISMO QUE HOY». Hasta el
    # 22/09/2026 la condicion era solo presencia —en R2 o en disco— y la
    # Bloqueada es la unica carta cuyo contenido es un **contador**:
    # «2/3 DUELOS NACIONALES». Ese numero cambia cada vez que la persona
    # compite, y el nombre del archivo no. O sea que se dibujaba una vez
    # y se quedaba con el numero de ese dia **para siempre**, mostrandole
    # a alguien que le faltan 3 duelos cuando ya tiene 2.
    #
    # ⚠️ Es la misma forma que este repo documenta para las otras cuatro
    # —«una cache que mira los datos no ve el codigo»— pero al reves: acá
    # la cache no miraba **nada**, solo si el archivo estaba.
    #
    # El sello es el hash del HTML que esa carta va a dibujar, asi que
    # cubre el dato y el dibujo de una sola vez. Ver `_sello_de()`.
    css = BL.css(*BL.FORMAS[BL.FORMA]).encode('utf-8')
    viejos = sellos_viejos()
    hoy = {}
    faltan = []
    for t, d in pend:
        nombre = os.path.basename(d)[:-4]        # sin el .png
        sello = _sello_de(t, css)
        hoy[nombre] = sello
        publicada = ('bloq-' + t[4]) in (inv.get(t[0]) or {})
        if not publicada and not os.path.exists(d):
            faltan.append((t, d))                # nunca se dibujo
        elif viejos.get(nombre) != sello:
            faltan.append((t, d))                # cambio lo que dice
    cambiaron = len(faltan) - sum(
        1 for t, d in faltan
        if ('bloq-' + t[4]) not in (inv.get(t[0]) or {})
        and not os.path.exists(d))

    from collections import Counter
    print('\n%d cartas bloqueadas en total' % len(todo))
    for c, n in sorted(Counter(t[4] for t in todo).items()):
        print('   %-12s %d' % (c, n))
    print('   (%d de las de País son de gente sin bandera: su Bloqueada '
          'dice justamente eso)' % sin_pais)
    # 🔴 EL INVARIANTE: carta o Bloqueada, nunca ninguna de las dos.
    # Ver `mudos()`. Se pregunta siempre, no sólo al generar: el día
    # que alguien se quede sin las dos, el botón desaparece y eso no
    # deja rastro en ningún lado.
    sin_nada = mudos(todo)
    if sin_nada:
        from collections import Counter as _C
        c2 = _C(c for _k, c in sin_nada)
        print('\n   🔴 %d caso(s) sin carta NI Bloqueada: el botón '
              'desaparece' % len(sin_nada))
        for c, n in sorted(c2.items()):
            print('      %-12s %d' % (c, n))
        for k, c in sin_nada[:5]:
            print('      p.ej. %s / %s' % (k, c))
    else:
        print('   ✅ nadie se queda sin carta ni Bloqueada')
    print('   ya dibujadas: %d   ·   faltan: %d'
          % (len(pend) - len(faltan), len(faltan)))
    if cambiaron:
        print('   de esas, %d ya estaban pero CAMBIO lo que dicen'
              % cambiaron)
    if not viejos:
        # ⚠️ La primera corrida no tiene con que comparar. Se dice,
        # porque «0 cambiaron» y «no se» se ven igual.
        print('   (primera corrida con sello: no hay con qué '
              'comparar todavía)')

    if '--generar' not in sys.argv:
        print('\n  (nada dibujado — corré con --generar)\n')
        return
    lim = next((int(a.split('=')[1]) for a in sys.argv if a.startswith('--limite=')), None)
    if lim:
        faltan = faltan[:lim]
    if not faltan:
        print('\n  no queda nada\n')
        return
    # 🔑 EL NAVEGADOR, RECIEN ACA: ya se sabe que hay algo que dibujar.
    # El pipeline lo pedía antes de contar y lo bajaba en toda corrida
    # quieta. Ver `bot/navegador.py`.
    import navegador
    navegador.hace_falta()

    t0, hechas = time.time(), 0
    # 🔴 SE SELLA POR TANDA Y SE SELLA **LA TANDA QUE SALIO**. Dos cosas
    # distintas, las dos mal en la primera version:
    #
    #  1. `faltan[:hechas]` toma las PRIMERAS `hechas` filas, no las que
    #     salieron. Si la tanda 3 falla y la 4 anda, sellaba la 3 —dando
    #     por buena una carta que no se dibujo— y dejaba sin sellar la 4.
    #     Es la forma que este repo documenta tres veces, con el contador
    #     mirando el lugar equivocado.
    #  2. Sellar al final significa que una corrida interrumpida no deja
    #     NADA. Son 9 a 14 minutos: alcanza con que se cierre la consola.
    salvados = dict(sellos_viejos())
    for i in range(0, len(faltan), POR_TANDA):
        lote = faltan[i:i + POR_TANDA]
        try:
            asyncio.run(dibujar([t for t, _ in lote], [d for _, d in lote]))
        except Exception as e:
            print('   ⚠️ tanda %d: %s' % (i // POR_TANDA, str(e)[:90]))
            continue
        # ⚠️ Y SE COMPRUEBA QUE EL ARCHIVO ESTE. `dibujar()` puede volver
        # sin excepcion y sin haber escrito una de las 24 — Chromium lo
        # hace con hojas grandes y no avisa.
        for t, d in lote:
            if not os.path.exists(d):
                print('   ⚠️ no salio: %s' % os.path.basename(d))
                continue
            salvados[os.path.basename(d)[:-4]] = hoy[os.path.basename(d)[:-4]]
            hechas += 1
        guardar_sellos(salvados)
        if hechas and hechas % 96 < POR_TANDA:
            seg = (time.time() - t0) / max(1, hechas)
            print('   %d de %d   ·   %.2f s/carta   ·   faltan ~%d min'
                  % (hechas, len(faltan), seg,
                     (len(faltan) - hechas) * seg / 60))
    print('\n  ✅ %d de %d   (%.0f min)\n'
          % (hechas, len(faltan), (time.time() - t0) / 60))


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
