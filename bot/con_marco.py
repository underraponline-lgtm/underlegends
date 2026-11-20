# -*- coding: utf-8 -*-
"""🖼️ LAS CARTAS CON SU MARCO, EN LA IMAGEN: `<clave>/<carta>-m.webp` en R2, para /card y la descarga.

    python bot/con_marco.py --quienes "DLX"              saca la foto, la sube y le avisa al objeto
    python bot/con_marco.py --quienes "DLX" --simulacro  la saca y la deja en salida_marcos/, sin subir
    python bot/con_marco.py --auto                       self-check

Dlx, 26/10/2026: *«pon la decoración en mi tarjeta»*. El marco del Pase se dibuja en la página (`ConMarco`, en
web/src/marcos.jsx: la corona, el talón, la camiseta o la cadena…), así que en la imagen de la carta no estaba: /card y la
descarga salían sin él. Este script abre la carta sola con su marco (`#/marco/<clave>/<carta>/<servidor>/<país>`,
web/src/marco_solo.jsx) con Chromium, le saca una foto con fondo transparente y la sube al lado de la carta.

⚠️ ES LA MISMA PIEZA QUE SE VE EN EL PERFIL, no un segundo dibujo en Python: si el marco cambia en la página, cambia acá
solo. Dos dibujos del mismo marco serían el bug de «un default que no es la decisión», con la página y Discord mostrando
cosas distintas.

⚠️ LA FOTO MIDE LA UNIÓN de todo lo que se pinta (la corona sobresale por arriba, el talón por el costado), como los
exportadores de las cartas: un recorte a la caja de la carta se comería justo la decoración.

🔑 EL OBJETO ANOTA CON QUÉ MARCO SE SACÓ (`/avisos/redibujo-listo`, `marcos`): /card usa la `-m` sólo mientras ése siga
siendo tu marco. Si cambias de marco, vuelve a la carta sin marco hasta la foto nueva, que pide el mismo cambio.
"""
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

#: la página; `LG_WEB` la cambia para probar contra la copia local
WEB = os.environ.get('LG_WEB') or 'https://underlegends.pages.dev/freestyle-rap'
CARTAS = ('temporada', 'competitivo', 'pais', 'servidor')
SALIDA = os.path.join(BASE, 'salida_marcos')
#: la carta se dibuja a 300 px (la misma que «completa» en `ConMarco`) y se fotografía a 3× → 900 px, como las cartas
ESCALA = 3

# 🎞️ LA FOTO SE MUEVE COMO EN LA PÁGINA (20/11/2026, Dlx: «no podemos ponernos efectos en las tarjetas porque salen en PNG,
# no en GIF donde el efecto se puede poner… asegúrate que cuando mostremos el comando de tarjeta todo se vea y funcione
# correctamente… y que se vea bien en el celular»). Los efectos de carta de la Tienda (C1…C17) y el marco del Pase (su
# brillo que barre y sus destellos) son animaciones de CSS: la foto quieta las congelaba en un cuadro cualquiera. Ahora,
# si algo de la carta se mueve, se FILMA: se congelan todas sus animaciones y se las adelanta cuadro por cuadro con
# `currentTime` (exacto, no depende de lo rápida que sea la máquina) y sale un WebP ANIMADO, con transparencia entera.
#   · WebP y no GIF, MEDIDO EN SU CELULAR: Discord mueve los dos, pero el GIF tiene transparencia de todo o nada y le dejaba
#     un círculo detrás a cada destello (el halo, cortado), y pesaba 9 veces más (C2: 382 KB contra 3,4 MB)
#   · LA VUELTA: el mínimo común múltiplo de lo que tarda cada animación (con `alternate`, el doble), si entra en
#     `TOPE_LOOP`; si no (el marco: 5,5 s y 2,4 s), la más larga, y el final se funde con el principio en `FUNDIDO` cuadros
#   · FILMADA A 2× (600 px de carta), en otra página: Discord no la muestra más ancha, a 3× pesaba más del doble, y el
#     filtro SVG del contorno del marco hacía que cada cuadro tardara 4 s (a 2×, 1,8)
FPS = 15
FPS_LARGO = 10      # la vuelta pasa de 3 s (con el filtro del marco, cada cuadro cuesta)
TOPE_LOOP = 6000    # ms
FUNDIDO = 6         # cuadros
ESCALA_ANIM = 2
PESO_MAX = 2500000  # bytes: más que esto, se saltea un cuadro de cada dos y baja la calidad


def _j(*p, defecto=None):
    try:
        with io.open(os.path.join(BASE, *p), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return defecto


def pases_publicos():
    """Lo público del Pase: `m` (`{clave: [marco, estilo, serie]}`, quienes tienen marco) y `tp` (lo que cada uno se puso
    en la Tienda, `{clave: {ranura: pieza}}`)."""
    import requests
    try:
        r = requests.get('https://underlegends.pages.dev/api/avisos/pases', timeout=30)
        return (r.json() or {}) if r.status_code == 200 else {}
    except (OSError, ValueError):
        return {}


def marcos_publicos():
    """`{clave: [marco, estilo, serie]}` de quienes tienen marco puesto (lo público del Pase)."""
    return pases_publicos().get('m') or {}


def firma_de(m, tc):
    """🖼️🃏 Lo que lleva la foto: el marco (`marco|estilo`) y, desde la tanda 3b de la Tienda, el efecto de carta (`|C1`;
    sin marco, `-|-|C1`). ⚠️ La misma cuenta que `firmaImagen()` en bot/avisos.js: si no coinciden, /card nunca la usa"""
    if not m and not tc:
        return ''
    return ('%s|%s' % (m[0], m[1]) if m else '-|-') + ('|' + tc if tc else '')


def datos_de(raw):
    """`(clave, servidor, país, [cartas])` de alguien, para la ruta de la foto. El servidor y el país, como los dibuja su
    carta: del pool si compite, del padrón si no (el primero de `servidores_de.json`, como `03_Servidor/generar.py`)."""
    from comun.claves import clave
    k = clave(raw)
    pool = {x.get('raw'): x for x in (_j('datos', 'temporada_pool.json', defecto=[]) or [])}
    sv, cc = '', ''
    if raw in pool:
        sv, cc = pool[raw].get('sv') or '', str(pool[raw].get('cc') or '').lower()
    else:
        p = next((x for x in (_j('datos', 'padron.json', defecto=[]) or []) if x.get('raw') == raw), None)
        if p:
            sv = ((_j('datos', 'servidores_de.json', defecto={}) or {}).get(str(p.get('discord_id') or '')) or [''])[0]
            import subir_web as SW
            cc = ((SW._banderas(p.get('full') or '') or [''])[0] or '').lower()
    tiene = (_j('datos', 'cartas_r2.json', defecto={}) or {}).get(k) or {}
    return k, sv, cc, [c for c in CARTAS if c in tiene]


def abrir(pag, k, carta, sv, cc):
    """Abre la carta sola con su marco y deja todo transparente alrededor. Devuelve la caja a fotografiar (con `prop`, el
    alto / ancho de la carta sola), o `None` si no lleva nada puesto."""
    pag.goto('%s/marco/%s/%s/%s/%s' % (WEB, k, carta, sv or '-', cc or '-'), wait_until='domcontentloaded', timeout=45000)
    # listo: la carta cargó y el marco ya se sabe (ver marco_solo.jsx)
    pag.wait_for_function("""() => { const h = document.querySelector('#inicio-nuevo');
        const m = h && h.shadowRoot && h.shadowRoot.querySelector('.ms');
        return m && m.dataset.listo === '1'; }""", timeout=45000)
    # 🎞️ y que la pantalla de carga ya se haya ido: mientras tapa, la página tiene sus animaciones apagadas
    # (`.app.tapado`) y la foto saldría quieta aunque la carta se mueva
    try:
        pag.wait_for_function("() => document.documentElement.classList.contains('lg-fuera') || "
                              "!document.getElementById('lg-carga')", timeout=15000)
    except Exception:                                    # noqa: BLE001
        pass
    pag.wait_for_timeout(600)
    # 📐 la carta entera adentro de la caja, o se vuelve a medir: una vez (20/11/2026, el dragón C15) se midió antes de que
    # la carta terminara de acomodarse y la foto salió cortada a la altura del número. Tres intentos; si no, no va
    for _ in range(3):
        c = pag.evaluate(JS_CAJA)
        if not c or (c['carta'][3] > 50 and c['carta'][1] + c['carta'][3] <= c['height'] + 1):
            return c
        pag.wait_for_timeout(800)
    raise ValueError('la carta no entra entera en la foto')


#: la caja a fotografiar, con todo transparente alrededor (ver `abrir()`)
JS_CAJA = """() => {
        // todo transparente alrededor, y nada de la página vieja encima
        const st = document.createElement('style');
        st.textContent = 'html,body{background:transparent!important} body *{visibility:hidden!important} #inicio-nuevo{visibility:visible!important}';
        document.head.appendChild(st);
        const raiz = document.querySelector('#inicio-nuevo').shadowRoot;
        const ms = raiz.querySelector('.ms');
        if (ms.dataset.marco !== '1') return null;
        // la unión de todo lo que se pinta (la corona y las alas salen de la caja de la carta), CON MARGEN: el
        // contorno del marco es un filtro SVG que pinta por fuera de las cajas, y medir sólo las cajas cortaba
        // el pie (Dlx, 26/10/2026: «se sigue cortando un poquito el espacio de abajo»). El recorte justo lo
        // hace Python después, por el alfa de lo que de verdad se pintó
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const e of ms.querySelectorAll('*')) {
          if (e.closest('.mk-defs')) continue;
          const r = e.getBoundingClientRect();
          if (r.width < 1 || r.height < 1) continue;
          x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
        }
        const img = ms.querySelector('.ms-img').getBoundingClientRect();
        const M = 60;
        const x = Math.max(0, x0 - M), y = Math.max(0, y0 - M);
        // y dónde está la carta sola dentro de la foto (para `limitar()`)
        return { x, y, width: x1 - x0 + 2 * M, height: y1 - y0 + 2 * M, prop: img.height / img.width,
                 carta: [img.left - x, img.top - y, img.width, img.height] };
    }"""


def fotos(trabajos):
    """`trabajos`: `[(clave, carta, servidor, país)]`. Devuelve `{(clave, carta): ruta}` de las que salieron: un PNG
    (quieta) o un WebP animado."""
    from playwright.sync_api import sync_playwright
    os.makedirs(SALIDA, exist_ok=True)
    out = {}
    with sync_playwright() as pw:
        nav = pw.chromium.launch()
        pag = nav.new_page(viewport={'width': 900, 'height': 1100}, device_scale_factor=ESCALA)
        # 🎞️ la que filma, a `ESCALA_ANIM`: el contorno del marco es un filtro SVG que se vuelve a dibujar en cada cuadro,
        # y a 3× cada uno tardaba 4 s (medido con el de Embajador: 375 s una carta); a 2×, 1,8 s
        cine = None
        for k, carta, sv, cc in trabajos:
            try:
                caja = abrir(pag, k, carta, sv, cc)
                if not caja:
                    print('   · %s/%s: sin marco puesto' % (k, carta))
                    continue
                prop, cj = caja.pop('prop'), caja.pop('carta')
                # 🎞️ si algo se mueve (el efecto de la Tienda, el marco), se filma; si no, la foto de siempre
                if pag.evaluate(JS_QUIETAS):
                    cine = cine or nav.new_page(viewport={'width': 900, 'height': 1100}, device_scale_factor=ESCALA_ANIM)
                    ruta = os.path.join(SALIDA, '%s_%s.webp' % (k, carta))
                    n = filmar_carta(cine, k, carta, sv, cc, prop, ruta)
                    print('   ✅ %s/%s · animada, %d cuadros, %d KB' % (k, carta, n, os.path.getsize(ruta) // 1024))
                else:
                    ruta = os.path.join(SALIDA, '%s_%s.png' % (k, carta))
                    pag.screenshot(path=ruta, clip=caja, omit_background=True)
                    recortar(ruta, prop, carta=[v * ESCALA for v in cj])
                    print('   ✅ %s/%s' % (k, carta))
                out[(k, carta)] = ruta
            except Exception as e:                       # noqa: BLE001
                print('   ⚠️ %s/%s: %s' % (k, carta, str(e)[:90]))
        nav.close()
    return out


#: 🎞️ en la página: termina lo que se está moviendo una sola vez (una entrada, una transición: si no, los primeros cuadros
#: salen con un velo), congela todo lo que se repite DENTRO DE LA CARTA (`.ms`) y devuelve lo que tarda en volver al
#: principio cada una (con `alternate`, el doble). `[]` si nada se mueve: va la foto de siempre
JS_QUIETAS = """() => {
    const raiz = document.querySelector('#inicio-nuevo').shadowRoot, ms = raiz.querySelector('.ms');
    const todas = [...document.getAnimations(), ...raiz.getAnimations()];
    for (const a of todas) {
      const t = a.effect && a.effect.getTiming();
      if (t && t.iterations !== Infinity) { try { a.finish(); } catch (e) {} }
    }
    const dentro = (a) => { const e = a.effect && a.effect.target; return !!(e && ms.contains(e)); };
    const rep = raiz.getAnimations().filter((a) => a.effect && a.effect.getTiming().iterations === Infinity && dentro(a));
    window.__lgFilmar = rep.map((a) => { a.pause(); return [a, Number(a.currentTime) || 0]; });
    return rep.map((a) => { const t = a.effect.getTiming();
      return Math.round((Number(t.duration) || 0) * (/alternate/.test(t.direction) ? 2 : 1)); }).filter((d) => d >= 100);
}"""


def vuelta(periodos):
    """Cuánto dura la vuelta entera (ms) y si cierra justa: el mínimo común múltiplo de los períodos (en décimas) si entra en
    `TOPE_LOOP`; si no, el más largo (cortado en el tope), y entonces el final se funde con el principio."""
    import math
    ds = sorted(set(max(1, int(round(p / 100.0))) for p in periodos if p > 0))
    if not ds:
        return 0, True
    m = 1
    for d in ds:
        m = m * d // math.gcd(m, d)
    if m * 100 <= TOPE_LOOP:
        return m * 100, True
    return min(ds[-1] * 100, TOPE_LOOP), False


def filmar(pag, caja, periodos):
    """Los cuadros de una vuelta, en PNG (bytes), con la página congelada (`JS_QUIETAS`). Si la vuelta no cierra justa,
    `FUNDIDO` cuadros más, los que siguen al final, para fundirlos con el principio. Devuelve (cuadros, ms por cuadro,
    cuántos son del fundido)."""
    L, justa = vuelta(periodos)
    fps = FPS if L <= 3000 else FPS_LARGO
    n = max(2, int(round(L / 1000.0 * fps)))
    extra = 0 if justa else FUNDIDO
    cuadros = []
    for i in range(n + extra):
        pag.evaluate('(t) => { for (const [a, c] of window.__lgFilmar) a.currentTime = c + t; }', i * float(L) / n)
        cuadros.append(pag.screenshot(clip=caja, omit_background=True, type='png'))
    return cuadros, int(round(float(L) / n)), extra


#: 📐 CUÁNTO PUEDE SALIRSE UN EFECTO POR CADA COSTADO DE LA CARTA, en la foto de /card (en anchos de carta), y en cuánto se
#: desvanece donde se corta. Dlx, 20/11/2026, mirando en su celular la niebla (C3): *«este último es pequeñísimo»*. Se salía
#: un 35 % por lado, la foto quedaba más ancha que alta (1035 × 888) y Discord achicaba todo para que entrara: la carta
#: salía chiquita. El dragón (C15, 25 % por lado) se veía bien: ése es el tope. En la página el efecto no cambia
SALE_MAX = 0.25
DESVANECE = 0.07


def limitar(x0, x1, carta):
    """El recorte de costado a costado (`x0`, `x1`, en píxeles de la foto) sin pasar de `SALE_MAX` anchos de carta por
    cada lado de la carta (`[x, y, ancho, alto]`). Devuelve `(x0, x1, corta_izq, corta_der)`."""
    if not carta or carta[2] <= 0:
        return x0, x1, False, False
    cx, cw = carta[0], carta[2]
    izq, der = int(round(cx - SALE_MAX * cw)), int(round(cx + cw + SALE_MAX * cw))
    return max(x0, izq), min(x1, der), x0 < izq, x1 > der


def desvanecer(im, izq, der, ancho):
    """El alfa de `im` se apaga en `ancho` píxeles en cada costado que se cortó: la niebla no termina en una línea recta."""
    from PIL import Image, ImageChops
    ancho = max(1, min(int(ancho), im.width // 2))
    if not (izq or der):
        return im
    fila = [255] * im.width
    for i in range(ancho):
        v = int(round(255.0 * (i + 1) / (ancho + 1)))
        if izq:
            fila[i] = min(fila[i], v)
        if der:
            fila[im.width - 1 - i] = min(fila[im.width - 1 - i], v)
    m = Image.new('L', (im.width, 1))
    m.putdata(fila)
    m = m.resize((im.width, im.height))
    r, g, b, a = im.split()
    return Image.merge('RGBA', (r, g, b, ImageChops.multiply(a, m)))


def filmar_carta(cine, k, carta, sv, cc, prop, ruta):
    """La carta animada de `k` en `ruta`, filmada en la página `cine` (a `ESCALA_ANIM`). Devuelve cuántos cuadros quedaron."""
    c2 = abrir(cine, k, carta, sv, cc)
    c2.pop('prop')
    cj = c2.pop('carta')
    return animada(filmar(cine, c2, cine.evaluate(JS_QUIETAS)), prop, ruta, [v * ESCALA_ANIM for v in cj])


def animada(filmado, prop, ruta, carta=None, aire=6):
    """Arma el WebP animado: el mismo recorte para todos los cuadros (lo que se pintó en CUALQUIERA, con `aire`), el aire a
    los costados si queda más alta que la carta (como `recortar()`; los cuadros ya vienen a `ESCALA_ANIM`), el final fundido con el
    principio si hace falta, y más liviana si pasa de `PESO_MAX`. Devuelve cuántos cuadros quedaron."""
    from PIL import Image
    cuadros, ms, extra = filmado
    ims = [Image.open(io.BytesIO(b)).convert('RGBA') for b in cuadros]
    caja = None
    for im in ims:
        bb = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
        if bb:
            caja = bb if not caja else (min(caja[0], bb[0]), min(caja[1], bb[1]), max(caja[2], bb[2]), max(caja[3], bb[3]))
    if not caja:
        raise ValueError('la carta no se pintó en ningún cuadro')
    W, H = ims[0].size
    x0, y0, x1, y1 = max(0, caja[0] - aire), max(0, caja[1] - aire), min(W, caja[2] + aire), min(H, caja[3] + aire)
    x0, x1, ci, cd = limitar(x0, x1, carta)
    w, h = x1 - x0, y1 - y0
    # y la carta entera en los cuadros: si se pintó menos de lo que mide, algo se midió antes de tiempo y no va
    if carta and h < carta[3] * 0.95:
        raise ValueError('la carta salió cortada (%d de %d px de alto)' % (h, carta[3]))
    ancho = int(round(h / prop)) if prop and h / float(w) > prop else w
    out = []
    for im in ims:
        im = desvanecer(im.crop((x0, y0, x1, y1)), ci, cd, DESVANECE * carta[2] if carta else 0)
        if ancho != w:
            lienzo = Image.new('RGBA', (ancho, h), (0, 0, 0, 0))
            lienzo.alpha_composite(im, ((ancho - w) // 2, 0))
            im = lienzo
        out.append(im)
    # 🔁 la vuelta que no cierra justa: los primeros cuadros pasan de lo que seguía al final a lo que eran, de a poco
    if extra:
        n = len(out) - extra
        for i in range(extra):
            out[i] = Image.blend(out[n + i], out[i], (i + 1.0) / (extra + 1))
        out = out[:n]

    def guardar(cs, dur, q):
        cs[0].save(ruta, save_all=True, append_images=cs[1:], duration=dur, loop=0, quality=q, method=4, lossless=False)
        return os.path.getsize(ruta)

    if guardar(out, ms, 75) > PESO_MAX:
        out, ms = out[::2], ms * 2
        guardar(out, ms, 65)
    chk = Image.open(ruta)
    if not getattr(chk, 'is_animated', False) or chk.mode != 'RGBA':
        raise ValueError('el WebP no quedó animado con transparencia')
    return len(out)


def subir_animada(s, ruta, clave, intentos=3):
    """Sube el WebP animado TAL CUAL: `subir_cartas.subir()` lo volvería a comprimir desde una imagen quieta y quedaría sólo
    el primer cuadro. Devuelve (bytes, md5) o (None, por qué), como aquél."""
    import hashlib
    import subir_cartas as SC
    with open(ruta, 'rb') as f:
        datos = f.read()
    if len(datos) < 1024:
        return None, 'pesa %d bytes' % len(datos)
    for _ in range(intentos):
        try:
            r = s.put('%s/objects/%s' % (SC.API, clave), data=datos, headers={'Content-Type': 'image/webp'}, timeout=120)
            if SC._ok(r, clave) is not None:
                return len(datos), hashlib.md5(datos).hexdigest()[:8]
        except Exception as e:                           # noqa: BLE001
            print('   ⚠️ %s: %s' % (clave, str(e)[:80]))
    return None, 'no subió'


def recortar(ruta, prop, aire=6, carta=None):
    """Recorta la foto a lo que de verdad se pintó (por el alfa) con `aire` px de margen, y si queda más alta que la
    carta sola (`prop` = alto / ancho) le agrega aire transparente a los costados: Discord recorta lo que pasa de cierto
    alto (Dlx, 26/10/2026: «la parte de abajo en el discord se cortó un poco»). Con `carta` (dónde está la carta sola, en
    píxeles de la foto), lo que se sale por los costados se corta en `SALE_MAX` y se desvanece (`limitar()`)."""
    from PIL import Image
    im = Image.open(ruta).convert('RGBA')
    caja = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    if not caja:
        return
    x0, y0, x1, y1 = max(0, caja[0] - aire), max(0, caja[1] - aire), min(im.width, caja[2] + aire), min(im.height, caja[3] + aire)
    x0, x1, ci, cd = limitar(x0, x1, carta)
    im = desvanecer(im.crop((x0, y0, x1, y1)), ci, cd, DESVANECE * carta[2] if carta else 0)
    w = im.width
    if prop and im.height / float(w) > prop:
        w = int(round(im.height / prop))
    if w != im.width:
        lienzo = Image.new('RGBA', (w, im.height), (0, 0, 0, 0))
        lienzo.alpha_composite(im, ((w - im.width) // 2, 0))
        im = lienzo
    im.save(ruta)


def subir(hechas):
    """Sube cada foto como `<clave>/<carta>-m.webp`: la quieta (PNG) convertida, la animada tal cual. Devuelve las que
    subieron."""
    import subir_cartas as SC
    s = SC.sesion()
    ok = []
    for (k, carta), ruta in hechas.items():
        clave_r2 = '%s/%s-m.webp' % (k, carta)
        r = subir_animada(s, ruta, clave_r2) if ruta.endswith('.webp') else SC.subir(s, ruta, clave_r2)
        if r[0]:
            ok.append((k, carta))
        else:
            print('   ⚠️ %s/%s no subió: %s' % (k, carta, r[1]))
    return ok


def correr(quienes, simulacro=False):
    """Las fotos de `quienes` (nombres) que tienen marco puesto. Devuelve `{clave: {firma, cartas}}` para el objeto."""
    pp = pases_publicos()
    pub, tp = pp.get('m') or {}, pp.get('tp') or {}
    trabajos, firma = [], {}
    for raw in quienes:
        k, sv, cc, cartas = datos_de(raw)
        m = pub.get(k)
        tc = str((tp.get(k) or {}).get('carta') or '')
        if not (m or tc) or not cartas:
            continue
        firma[k] = firma_de(m, tc)
        trabajos += [(k, c, sv, cc) for c in cartas]
    if not trabajos:
        print('   🖼️ nadie con marco en esta tanda')
        return {}
    print('   🖼️ %d carta(s) con marco' % len(trabajos))
    hechas = fotos(trabajos)
    if simulacro:
        print('   (simulacro: quedaron en %s)' % SALIDA)
        return {}
    subidas = subir(hechas)
    out = {}
    for k, c in subidas:
        out.setdefault(k, {'firma': firma[k], 'cartas': []})['cartas'].append(c)
    return out


def avisar(marcos):
    """Le dice al objeto qué cartas tienen su foto con marco, y con cuál (ver `redibujoListo()` en bot/avisos.js)."""
    if not marcos:
        return True
    import requests
    import fotos as F
    import clave_ciclo as CC
    from alertar import WORKER
    tok = F.env('DISCORD_TOKEN', obligatorio=False)
    if not tok:
        return False
    r = requests.post(WORKER + '/avisos/redibujo-listo', headers={'x-lg-ciclo': CC.clave(tok), 'content-type': 'application/json'},
                      data=json.dumps({'quienes': [], 'marcos': marcos}, ensure_ascii=False).encode('utf-8'), timeout=25)
    return r.status_code == 200


def _self_check():
    mal = 0

    def ok(c, t):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', t))

    print('\n══ LAS CARTAS CON MARCO ══\n')
    ok(set(CARTAS) == {'temporada', 'competitivo', 'pais', 'servidor'}, 'las cuatro cartas')
    ok(ESCALA * 300 == 900, 'la foto sale del mismo ancho que las cartas (900 px)')
    # 🃏 la firma: igual a la de antes sin efecto (las fotos que ya están siguen valiendo) y con el efecto de la Tienda al final
    ok(firma_de(['plata', 'camiseta'], '') == 'plata|camiseta' and firma_de(['plata', 'camiseta'], 'C1') == 'plata|camiseta|C1'
       and firma_de(None, 'C1') == '-|-|C1' and firma_de(None, '') == '', 'la firma de la foto: el marco y el efecto de carta')
    # 🎞️ la vuelta de la foto animada: justa cuando entra, la más larga con fundido cuando no
    ok(vuelta([2200] * 14) == (2200, True), 'un efecto de un solo ritmo (C2: 2,2 s) cierra justo')
    ok(vuelta([2600, 3000]) == (3000, False), 'dos ritmos que no cierran en el tope (C15) van con fundido')
    ok(vuelta([1800, 3600 * 2]) == (TOPE_LOOP if 7200 > TOPE_LOOP else 7200, 7200 <= TOPE_LOOP),
       'el «alternate» cuenta la ida y la vuelta')
    ok(vuelta([1200, 1800]) == (3600, True), 'el mínimo común múltiplo, cuando entra')
    ok(vuelta([]) == (0, True), 'sin animaciones, sin vuelta')
    # 📐 lo que se sale por los costados: la niebla (35 % por lado) se corta en `SALE_MAX`; el dragón (25 %) queda
    ok(limitar(0, 1035, [210, 20, 600, 850]) == (60, 960, True, True), 'la niebla se corta en un cuarto de carta por lado')
    ok(limitar(150, 906, [153, 20, 600, 850]) == (150, 903, False, True) and limitar(160, 760, [160, 0, 600, 850])[2:] == (False, False),
       'lo que apenas se sale no se toca')
    ok(limitar(0, 900, None) == (0, 900, False, False), 'sin saber dónde está la carta, no se corta nada')
    ok(ESCALA_ANIM <= ESCALA and FUNDIDO >= 2 and PESO_MAX > 10 ** 6, 'la animada: más chica que la quieta, fundido y tope')
    # y la animada se arma de verdad: dos cuadros distintos → un WebP animado con transparencia
    try:
        import tempfile
        from PIL import Image
        cs = []
        for c in ((255, 0, 0, 255), (0, 0, 255, 255), (0, 255, 0, 255)):
            # con un borde suave, como el de una carta de verdad: con transparencia de todo o nada, Pillow (12.3) arma
            # el WebP animado SIN alfa y lo transparente sale negro (`animada()` lo frena: no la sube)
            im = Image.new('RGBA', (90, 120), (0, 0, 0, 0))
            im.paste(Image.new('RGBA', (62, 92), c[:3] + (110,)), (14, 14))
            im.paste(Image.new('RGBA', (60, 90), c), (15, 15))
            b = io.BytesIO(); im.save(b, 'PNG'); cs.append(b.getvalue())
        ruta = os.path.join(tempfile.mkdtemp(), 'x.webp')
        n = animada((cs, 100, 1), 1.5, ruta)
        im = Image.open(ruta)
        ok(n == 2 and getattr(im, 'is_animated', False) and im.mode == 'RGBA', 'el WebP animado sale con sus cuadros y su transparencia')
    except Exception as e:                               # noqa: BLE001
        ok(False, 'el WebP animado: %s' % str(e)[:80])
    print('\n   %s' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return 1 if mal else 0


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if '--auto' in sys.argv:
        return _self_check()
    q = sys.argv[sys.argv.index('--quienes') + 1] if '--quienes' in sys.argv else ''
    from redibujo import nombres
    m = correr(nombres(q), '--simulacro' in sys.argv)
    if '--simulacro' in sys.argv:
        return 0
    return 0 if avisar(m) else 1


if __name__ == '__main__':
    sys.exit(main())
