"""LA BLOQUEADA — el estado de quien todavía no tiene carta.

    python comun/bloqueada.py            una muestra de cuatro
    python comun/bloqueada.py --quien X  si hay datos/bloqueados.json

⚠️ **NO ES UNA SÉPTIMA CARTA: ES UN ESTADO.** Lo dice `CLAUDE.md` desde el
principio. Es la respuesta a quien pide una carta y todavía no llega.

⚠️ **YA NO HAY UN SOLO CORTE DE 8**, y este archivo lo decía hasta el
16/09/2026. Son **cuatro requisitos**, uno por carta, en `comun/requisitos.py`:
Temporada 2 eventos · Competitivo 10 · País 1 evento nacional · Servidor
—por ahora— nada. El 8 sigue siendo el filtro del **pool** (138 de 735), que es
otra cosa: **el requisito bloquea la carta, no el dato**.

⚠️ **Y la Servidor ya tiene el suyo, y es el primero CON PARÁMETRO.** Como el
bot muestra la carta del servidor **donde estás parado** (ver `CLAUDE.bot.md`),
la pregunta dejó de ser *«¿llegás?»* y pasó a ser *«¿llegás **acá**?»*. El
requisito es **1 evento en ESE servidor**, así que `html()` acepta `sv=`.

⚠️ **Antes de eso, `html(..., carta='servidor')` reventaba con
`ZeroDivisionError`**: el requisito valía 0 y la barra hacía `100 * ev / meta`.
Nadie lo llamaba así porque la Servidor no pedía nada — y con la T1 arrancando
de cero pasaba a ser **lo primero que se ejecuta**, porque `/card` abre en la
Servidor cuando la Competitiva está bloqueada. Ahora son dos cosas separadas:
la Servidor tiene su requisito, y **pedir la Bloqueada de una carta que no pide
nada avisa en vez de dividir por cero**.

⚠️ **Todavía no hay con qué contestarlo**: `ev_por_sv` no está en el pool
porque el builder lee las 7 columnas por servidor **sólo para el argmax y tira
los valores**. `comun/requisitos.py` **revienta con un mensaje claro** en vez de
devolver 0 — un 0 diría *«no jugaste ahí»*, y la verdad es *«no sé»*.

QUÉ MUESTRA, Y POR QUÉ TAN POCO
-------------------------------
Nombre, bandera, foto, y **cuántos eventos te faltan**. Nada más.

⚠️ **Sin número y sin rango, a propósito.** Es la primera regla del proyecto —
*el número de cada carta mide lo que esa carta mide*— y acá no hay nada que
medir: el corte de 8 eventos es justo el que desbloquea el Win%, el rango
competitivo y la carta. Poner un número igual sería inventarlo.

⚠️ **Pero la bandera y la foto SÍ van.** `CLAUDE.md`: *«la bandera es
identidad, el número es ranking»*. Quién sos no depende de cuántos eventos
jugaste; qué tan bueno sos, sí. Es la misma razón por la que el círculo de la
bandera se dibuja aunque seas el único de tu país.

LA SILUETA ES EL **ÓVALO** (`FORMA = 'ovalo'`)
----------------------------------------------
⚠️ **Y que sea otra forma es parte del mensaje.** Una Bloqueada con la silueta
de la Temporada se lee como *una carta de Temporada rota*; con una forma propia
se lee como *todavía no*. El día que alguien llegue al requisito, lo que recibe
cambia de forma, no sólo de color.

⚠️ **Nació con el BISELADO y eso no alcanzaba**, aunque era la única silueta
libre de `comun/siluetas.py`. El biselado **es** una forma de carta, así que se
leía como *una carta rota* — justo lo que había que evitar. Dlx: *«quiero que
las bloqueadas tengan una forma distinta a las 4 tarjetas, puede ser ovaladas»*.
Una forma que no es de carta se lee como **todavía no**.

⚠️ **La forma cambia cuánto espacio hay**: un óvalo se come las esquinas y a la
altura del pie el ancho útil cae a la mitad. Por eso cada entrada de `FORMAS`
trae **su margen** y no alcanza con cambiar el `clip-path`.

⚠️ Si se decide que la Bloqueada herede la silueta de la carta pedida —una
Bloqueada de País con forma de País—, `silueta=` ya lo acepta. Esa decisión no
está tomada.

DE DÓNDE SALEN LOS BLOQUEADOS
-----------------------------
⚠️ **HOY NO SALEN DE NINGÚN LADO, Y ESO NO SE ARREGLA ACÁ.**
`sheet/construir_pool_temporada.py` los descarta con un `continue` en cuanto ve
`Ev < 8`, así que **los 597 no quedan en `datos/`**. El builder ya deja
`datos/bloqueados.json` cuando se lo corre, pero eso pide el Sheet: hasta el
próximo refresco, esta carta se mira con la muestra de abajo.
"""
import base64
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, BASE)

from comun.siluetas import Silueta, BISELADO
from comun import nombre as NOM
from comun import requisitos as REQ

# ══ LA FORMA ══
# ⚠️ TIENE QUE SER DISTINTA DE LAS CUATRO, Y ESE ES TODO EL PUNTO. Dlx: "quiero
# que las tarjetas bloqueadas tengan una forma distinta a las 4 tarjetas que
# hemos hecho hasta ahora, puede ser ovaladas por ejemplo". Nacio con el
# BISELADO —la unica silueta libre del catalogo— y eso no alcanza: el biselado
# ES una forma de carta, asi que una Bloqueada con esa silueta se lee como una
# carta ROTA. Con una forma que no es de carta se lee como TODAVIA NO.
#
# ⚠️ Y LA FORMA CAMBIA CUANTO ESPACIO HAY. Un ovalo se come las esquinas: a la
# altura del pie, el ancho util cae a la mitad. Por eso cada forma trae su
# MARGEN —cuanto hay que meter el contenido— y no alcanza con cambiar el
# clip-path.
FORMAS = {
    'ovalo':    (Silueta('ovalo', 300, 438, 'ellipse(50% 50% at 50% 50%)',
                         'Bloqueada', 'Dlx: "puede ser ovaladas"'), 16),
    'pildora':  (Silueta('pildora', 300, 438,
                         'inset(0 0 0 0 round 150px)', 'Bloqueada',
                         'capsula: el radio es la mitad del ancho'), 11),
    'hexagono': (Silueta('hexagono', 300, 438,
                         'polygon(50% 0%, 100% 25%, 100% 75%, '
                         '50% 100%, 0% 75%, 0% 25%)', 'Bloqueada',
                         'seis lados, nada que ver con una carta'), 13),
    'biselado': (BISELADO, 0),
}
FORMA = 'ovalo' 

# ⚠️ YA NO HAY UN SOLO CORTE. Esta carta nacio con META = 8 clavado, que era el
# unico requisito del proyecto. Dlx lo partio en cuatro el 16/09/2026 —2 para
# Temporada, 10 para Competitivo, 1 evento NACIONAL para Pais, nada para
# Servidor— asi que la Bloqueada tiene que saber DE QUE CARTA te bloquea: la
# barra, el conteo y el texto salen de ahi. Ver comun/requisitos.py.
# Dlx, 19/09/2026: «es tarjeta competitiva no competitivo». Las cuatro
# concuerdan con «carta», que es femenino. La clave sigue siendo `competitivo`
# porque es el id de R2 y de KV.
DE_QUE = {'temporada': 'TEMPORADA', 'competitivo': 'COMPETITIVA',
          'pais': 'PAÍS', 'servidor': 'SERVIDOR'}

# ⚠️ GRIS Y NO EL COLOR DE UN RANGO. Los ocho colores de `comun/rangos.py` son
# ocho niveles; el bloqueado no está en ninguno, está antes. Darle el de E
# —bronce— diría que es el peor, y no es eso: es que todavía no se sabe.
FONDO = ('linear-gradient(168deg,#3A3D46 0%,#22242C 34%,'
         '#15161C 68%,#0B0C10 100%)')
LINEA = 'rgba(255,255,255,.20)'
TINTA = '#C9CCD6'

# ⚠️ MUESTRA, hasta que el builder deje datos/bloqueados.json. Los cuatro casos
# que la carta tiene que aguantar: el que recién arranca, el que está al borde,
# el que no tiene país y el nombre largo.
# ⚠️ EL NOMBRE MAS LARGO DEL POOL ES DE **11**: Fullylo4ded, Lord Viruzz y Sin
# Limites. Probe con uno de 16 y se salia de la carta, pero ese caso no existe:
# la muestra usa 11, que es el peor real, y la escalera de comun/nombre.py lo
# aguanta. Si algun dia entra uno mas largo, este es el que hay que actualizar.
MUESTRA = [
    ('Nuevo', 'ar', 1, 'temporada'),
    ('Casi', 'co', 9, 'competitivo'),
    ('Sin País', '', 0, 'pais'),
    ('Fullylo4ded', 'cl', 5, 'competitivo'),
]


def _b64(p):
    with open(p, 'rb') as f:
        return 'data:image/png;base64,' + base64.b64encode(f.read()).decode()


UL = _b64(os.path.join(BASE, '01_Temporada', 'ul_blanco.png'))

# ⚠️ EL CANDADO ES UN PATH, NO UN EMOJI. Un 🔒 lo dibuja la fuente del sistema:
# cambia de forma entre Windows, Discord y el navegador, y en el PNG exportado
# sale el que tenga Chromium ese día. Ver la nota de las fuentes en CLAUDE.md.
CANDADO = ('<svg viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="1.7" '
           'stroke-linecap="round" stroke-linejoin="round">'
           '<rect x="4.5" y="10.5" width="15" height="10.5" rx="2.2"/>'
           '<path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>'
           '<circle cx="12" cy="15.6" r="1.5"/></svg>')


def html(nom, cc='', ev=0, foto=None, silueta=None, carta='temporada',
         sv=None, persona=None):
    """La carta bloqueada de una persona, para la carta que pidio.

    `sv` es el codigo del servidor y **solo lo usa la carta Servidor**, cuyo
    requisito es por servidor: *1 evento en ESE servidor*.

    🔴 `persona` ES LA FILA DEL POOL, Y CON UN REQUISITO COMPUESTO ES LO
    UNICO QUE DA LA RESPUESTA CORRECTA. Sin ella esto tomaba la
    **primera** condicion y el `ev` que le pasara quien llama, y con
    Pais —que desde el 22/09 pide tres cosas— eso mezclaba peras con
    manzanas: le decia *«0/1 BANDERA ASIGNADA»* a gente que **sí**
    tiene bandera, porque el `ev` que llegaba era un conteo de eventos.
    Medido antes de dibujar: habria salido mal en las 446.

    ⚠️ Y LA CULPA ERA DE DECIDIR DOS VECES. `bloqueadas.plan()` ya
    llama a `falta()` para saber si esta bloqueada; acá se volvia a
    derivar la etiqueta por otro camino. Con `persona`, el que decide
    **cual** condicion mostrar es el mismo `falta()` las dos veces.

    Sin `persona` se cae al comportamiento viejo, que sigue siendo
    correcto para las cartas de una sola condicion.
    """
    from comun.banderas import src as bandera
    cs = REQ.condiciones(carta)
    meta = cs[0][0] if cs else 0
    cual = 0
    if persona is not None:
        cual = REQ.cual_falta(carta, persona, sv)
        if cual is None:
            raise ValueError('"%s" no esta bloqueada para esa persona: '
                             'cumple todas sus condiciones' % carta)
        meta, campo, _q = cs[cual]
        ev = REQ.cuanto(persona, campo, sv)
    # ⚠️ SIN REQUISITO NO HAY BLOQUEADA, y eso no es un caso a dibujar: es un
    # error de quien llama. Si una carta no pide nada, nadie puede estar
    # bloqueado de ella. Antes esto no se preguntaba y la barra de progreso
    # hacia `100 * ev / meta` con meta en 0 -> ZeroDivisionError, que no decia
    # nada de lo que estaba pasando.
    if not meta:
        raise ValueError(
            'la carta "%s" no pide nada: nadie puede estar bloqueado de ella'
            % carta)
    ev = max(0, min(meta, int(ev or 0)))
    falta = meta - ev
    unidad = REQ.como_se_dice(carta, meta, sv, cual)
    uno_falta = REQ.como_se_dice(carta, falta, sv, cual)
    ban = bandera(cc)
    # ⚠️ EL NOMBRE USA LA MISMA ESCALERA QUE LAS OTRAS CUATRO. Si esta carta
    # tuviera la suya, el mismo nombre saldría de dos tamaños distintos según
    # si llegaste a los 8 eventos o no.
    rem = NOM.rem(nom)
    foto_html = ('<img src="%s">' % foto if foto
                 else '<b class="ini">%s</b>' % nom[0].upper())
    return (
        '<div class="bloq">'
        '<div class="bg"></div><div class="tex"></div>'
        '<div class="foto">%s</div>'
        '<div class="velo"></div>'
        '<div class="candado">%s</div>'
        '<div class="nom" style="font-size:%.2frem">%s</div>'
        '<div class="cual">CARTA %s</div>'
        '<div class="rule"></div>'
        '<div class="prog"><i style="width:%.1f%%"></i></div>'
        '<div class="cuenta"><b>%d</b><span>/%d %s</span></div>'
        '<div class="falta">%s</div>'
        '<div class="pie">%s<img class="ul" src="%s"></div>'
        '<div class="marco"></div>'
        '</div>'
    ) % (foto_html, CANDADO % TINTA, rem, nom.upper(),
         DE_QUE.get(carta.lower(), carta.upper()),
         100 * ev / meta, ev, meta, unidad,
         'TE FALTA %d %s' % (falta, uno_falta) if falta == 1
         else 'TE FALTAN %d %s' % (falta, uno_falta),
         ('<img class="ban" src="%s">' % ban) if ban else '', UL)


def css(silueta=None, margen=None):
    if silueta is None:
        silueta, margen = FORMAS[FORMA]
    if margen is None:
        margen = 0
    W, H = silueta.w, silueta.h
    M = margen
    return """
.bloq{position:relative;width:%(W)dpx;height:%(H)dpx;overflow:hidden;
  clip-path:%(SIL)s;-webkit-clip-path:%(SIL)s;
  font-family:Archivo,LigaEmoji,system-ui;color:%(T)s}
.bloq .bg{position:absolute;inset:0;background:%(FONDO)s}
/* la trama diagonal es la misma idea del rayado de las otras: da superficie
   sin competir. Va MUY baja, 4%%: acá no hay nada que deba pelearle. */
.bloq .tex{position:absolute;inset:0;
  background:repeating-linear-gradient(48deg,rgba(255,255,255,.04) 0 1px,
    transparent 1px 7px)}
/* ⚠️ LA FOTO VA APAGADA Y DETRAS DEL VELO, no ausente. Sos vos, pero todavía
   no es tu carta. A color competiría con el candado, que es el dato. */
.bloq .foto{position:absolute;top:0;left:0;right:0;height:52%%;overflow:hidden;
  display:flex;align-items:center;justify-content:center;
  -webkit-mask-image:linear-gradient(180deg,#000 0,#000 58%%,transparent 100%%);
  mask-image:linear-gradient(180deg,#000 0,#000 58%%,transparent 100%%)}
/* ⚠️ EL APAGADO VA EN LA FOTO, NO EN EL CONTENEDOR. Lo tenia en .foto con
   opacity:.34, y eso MULTIPLICA: la inicial, que ya va al 10%%, terminaba al
   3.4%% y no se veia. Son dos piezas distintas —una foto que hay que apagar y
   una inicial que ya nace tenue— y cada una lleva lo suyo. */
.bloq .foto img{width:100%%;height:100%%;object-fit:cover;object-position:50%% 22%%;
  filter:grayscale(1) contrast(.9);opacity:.34}
.bloq .ini{font-size:7rem;font-weight:900;color:rgba(255,255,255,.085);
  line-height:1}
.bloq .velo{position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(8,9,13,.20) 0%%,rgba(8,9,13,.55) 46%%,
    rgba(8,9,13,.86) 100%%)}
/* ⚠️ EL CANDADO VA ENCIMA DE LA INICIAL Y ESO SE VE. La inicial esta centrada
   en la mitad de arriba y el candado tambien: se superponen. Se deja a
   proposito —la inicial es fondo, el candado es el dato— pero por eso la
   inicial baja a 8.5%%: a 10%% se le notaba el trazo cruzando el candado. */
.bloq .candado{position:absolute;left:50%%;top:19%%;transform:translateX(-50%%);
  width:74px;height:74px;opacity:.92;
  filter:drop-shadow(0 3px 10px rgba(0,0,0,.75))}
.bloq .nom{position:absolute;left:0;right:0;top:44%%;text-align:center;
  font-weight:900;letter-spacing:1.4px;color:#EDEEF3;
  text-shadow:0 2px 10px rgba(0,0,0,.7)}
/* ⚠️ LA CARTA QUE SE PIDIO VA ESCRITA, y antes no hacia falta. Con un solo
   corte de 8 la Bloqueada era una sola; con cuatro requisitos distintos, la
   misma persona puede tener la Temporada y no la Competitiva, asi que la
   carta tiene que decir CUAL le falta o no se entiende que esta bloqueado. */
.bloq .cual{position:absolute;left:0;right:0;top:51.5%%;text-align:center;
  font-size:.58rem;font-weight:800;letter-spacing:2.2px;opacity:.42}
.bloq .rule{position:absolute;left:%(M)s%%;right:%(M)s%%;top:56.5%%;height:1px;
  background:linear-gradient(90deg,transparent,%(L)s,transparent)}
/* ⚠️ LA BARRA ES EL UNICO DATO DE LA CARTA, asi que ocupa el lugar que en las
   otras ocupa el bloque de stats. */
.bloq .prog{position:absolute;left:%(M)s%%;right:%(M)s%%;top:62%%;height:7px;
  border-radius:4px;background:rgba(255,255,255,.10);overflow:hidden}
.bloq .prog i{display:block;height:100%%;border-radius:4px;
  background:linear-gradient(90deg,#8D93A3,#D6DAE4)}
.bloq .cuenta{position:absolute;left:0;right:0;top:66.5%%;text-align:center}
.bloq .cuenta b{font-size:2.5rem;font-weight:900;line-height:1;color:#EDEEF3}
.bloq .cuenta span{font-size:.62rem;font-weight:800;letter-spacing:1.6px;
  opacity:.62;margin-left:5px}
.bloq .falta{position:absolute;left:0;right:0;top:77%%;text-align:center;
  font-size:.62rem;font-weight:800;letter-spacing:1.5px;opacity:.55}
.bloq .pie{position:absolute;left:0;right:0;bottom:6.5%%;
  display:flex;align-items:center;justify-content:center;gap:12px}
.bloq .ban{width:30px;height:20px;border-radius:3px;object-fit:cover;
  opacity:.85;box-shadow:0 2px 6px rgba(0,0,0,.5)}
.bloq .ul{height:17px;opacity:.5}
.bloq .marco{position:absolute;inset:0;pointer-events:none;
  clip-path:%(SIL)s;-webkit-clip-path:%(SIL)s;
  box-shadow:inset 0 0 0 2px rgba(255,255,255,.14),
             inset 0 0 26px rgba(0,0,0,.55)}
""" % {'W': W, 'H': H, 'SIL': silueta.css, 'FONDO': FONDO, 'T': TINTA,
       'L': LINEA, 'M': M}


def bloqueados():
    """Los que no llegan a los 8, si el builder ya los dejó."""
    p = os.path.join(BASE, 'datos', 'bloqueados.json')
    if not os.path.exists(p):
        return None
    with open(p, encoding='utf-8') as f:
        return json.load(f)


async def hoja(gente, salida, forma=None):
    forma = forma or FORMA
    silueta, margen = FORMAS[forma]
    from playwright.async_api import async_playwright
    with open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
              encoding='utf-8') as f:
        fuentes = f.read()
    cuerpo = ''.join(html(n, cc, ev, silueta=silueta, carta=ct)
                     for n, cc, ev, ct in gente)
    pag = ('<!DOCTYPE html><meta charset="utf-8"><style>' + fuentes
           + css(silueta, margen)
           + 'body{background:#0B0B12;margin:0;padding:26px;'
             'display:flex;gap:24px}</style>' + cuerpo)
    tmp = os.path.join(SCR, '_bloq.html')
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(pag)
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(
            viewport={'width': len(gente) * (silueta.w + 24) + 40,
                      'height': silueta.h + 60}, device_scale_factor=3)
        await pg.goto('file://' + tmp.replace(os.sep, '/'))
        await pg.wait_for_timeout(700)
        await pg.screenshot(path=salida, full_page=True)
        await b.close()
    os.remove(tmp)
    print('->', os.path.relpath(salida, BASE))


async def comparar_formas(salida):
    """La misma persona en las cuatro formas, para elegir mirando."""
    from playwright.async_api import async_playwright
    with open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
              encoding='utf-8') as f:
        fuentes = f.read()
    n, cc, ev, ct = ('Fullylo4ded', 'cl', 5, 'competitivo')
    css_all, cuerpo = '', ''
    for k, (sil, m) in FORMAS.items():
        css_all += css(sil, m).replace('.bloq', '.f-%s .bloq' % k)
        cuerpo += ('<div class="col"><div class="f-%s">%s</div>'
                   '<div class="et">%s</div></div>'
                   % (k, html(n, cc, ev, silueta=sil, carta=ct), k.upper()))
    pag = ('<!DOCTYPE html><meta charset="utf-8"><style>' + fuentes + css_all
           + 'body{background:#0B0B12;margin:0;padding:26px;display:flex;gap:24px}'
             '.et{color:#EDEDF5;font-family:Archivo,LigaEmoji,system-ui;font-size:12px;'
             'font-weight:800;letter-spacing:1.4px;text-align:center;'
             'margin-top:12px}</style>' + cuerpo)
    tmp = os.path.join(SCR, '_formas.html')
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(pag)
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 4 * 324 + 60, 'height': 520},
                              device_scale_factor=3)
        await pg.goto('file://' + tmp.replace(os.sep, '/'))
        await pg.wait_for_timeout(700)
        await pg.screenshot(path=salida, full_page=True)
        await b.close()
    os.remove(tmp)
    print('->', os.path.relpath(salida, BASE))


def main():
    import argparse
    import asyncio
    ap = argparse.ArgumentParser(description='La carta Bloqueada')
    ap.add_argument('--salida', default=os.path.join(SCR, 'bloqueada.png'))
    ap.add_argument('--forma', default=FORMA, choices=list(FORMAS))
    ap.add_argument('--formas', action='store_true',
                    help='la misma carta en las cuatro formas')
    a = ap.parse_args()
    reales = bloqueados()
    if reales:
        gente = [(x['raw'], x.get('cc', ''), x.get('ev', 0), 'temporada')
                 for x in reales[:4]]
        print('%d bloqueados en datos/bloqueados.json' % len(reales))
    else:
        gente = MUESTRA
        print('⚠️ datos/bloqueados.json no existe todavia: va la MUESTRA.')
        print('   Los 597 que no llegan a 8 eventos los descarta')
        print('   sheet/construir_pool_temporada.py, que ya los deja escritos')
        print('   la proxima vez que se corra — y eso pide el Sheet.')
    if a.formas:
        asyncio.run(comparar_formas(a.salida))
        return
    asyncio.run(hoja(gente, a.salida, a.forma))


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
