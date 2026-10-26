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


def _j(*p, defecto=None):
    try:
        with io.open(os.path.join(BASE, *p), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return defecto


def marcos_publicos():
    """`{clave: [marco, estilo, serie]}` de quienes tienen marco puesto (lo público del Pase)."""
    import requests
    try:
        r = requests.get('https://underlegends.pages.dev/api/avisos/pases', timeout=30)
        return (r.json() or {}).get('m') or {} if r.status_code == 200 else {}
    except (OSError, ValueError):
        return {}


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


def fotos(trabajos):
    """`trabajos`: `[(clave, carta, servidor, país)]`. Devuelve `{(clave, carta): ruta del PNG}` de las que salieron."""
    from playwright.sync_api import sync_playwright
    os.makedirs(SALIDA, exist_ok=True)
    out = {}
    with sync_playwright() as pw:
        nav = pw.chromium.launch()
        pag = nav.new_page(viewport={'width': 900, 'height': 1100}, device_scale_factor=ESCALA)
        for k, carta, sv, cc in trabajos:
            try:
                pag.goto('%s/marco/%s/%s/%s/%s' % (WEB, k, carta, sv or '-', cc or '-'), wait_until='domcontentloaded', timeout=45000)
                # listo: la carta cargó y el marco ya se sabe (ver marco_solo.jsx)
                pag.wait_for_function("""() => { const h = document.querySelector('#inicio-nuevo');
                    const m = h && h.shadowRoot && h.shadowRoot.querySelector('.ms');
                    return m && m.dataset.listo === '1'; }""", timeout=45000)
                pag.wait_for_timeout(600)
                caja = pag.evaluate("""() => {
                    // todo transparente alrededor, y nada de la página vieja encima
                    const st = document.createElement('style');
                    st.textContent = 'html,body{background:transparent!important} body *{visibility:hidden!important} #inicio-nuevo{visibility:visible!important}';
                    document.head.appendChild(st);
                    const raiz = document.querySelector('#inicio-nuevo').shadowRoot;
                    const ms = raiz.querySelector('.ms');
                    if (ms.dataset.marco !== '1') return null;
                    // la unión de todo lo que se pinta: la corona y el talón salen de la caja de la carta
                    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
                    for (const e of ms.querySelectorAll('*')) {
                      if (e.closest('.mk-defs')) continue;
                      const r = e.getBoundingClientRect();
                      if (r.width < 1 || r.height < 1) continue;
                      x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
                    }
                    // 📐 Y CON LA PROPORCIÓN DE LA CARTA SOLA, como mucho (Dlx, 26/10/2026: «la parte de abajo en el discord
                    // se cortó un poco»): Discord recorta lo que pasa de cierto alto, y la corona hacía la Competitiva más
                    // alta que la carta. Si el marco la estira hacia arriba o abajo, se agrega aire transparente a los costados
                    const img = ms.querySelector('.ms-img').getBoundingClientRect();
                    let x = x0 - 4, y = y0 - 4, w = x1 - x0 + 8, h = y1 - y0 + 8;
                    const prop = img.height / img.width;
                    if (h / w > prop) { const nw = h / prop; x -= (nw - w) / 2; w = nw; }
                    return { x: Math.max(0, x), y: Math.max(0, y), width: w, height: h };
                }""")
                if not caja:
                    print('   · %s/%s: sin marco puesto' % (k, carta))
                    continue
                ruta = os.path.join(SALIDA, '%s_%s.png' % (k, carta))
                pag.screenshot(path=ruta, clip=caja, omit_background=True)
                out[(k, carta)] = ruta
                print('   ✅ %s/%s' % (k, carta))
            except Exception as e:                       # noqa: BLE001
                print('   ⚠️ %s/%s: %s' % (k, carta, str(e)[:90]))
        nav.close()
    return out


def subir(hechas):
    """Sube cada PNG como `<clave>/<carta>-m.webp`. Devuelve las que subieron."""
    import subir_cartas as SC
    s = SC.sesion()
    ok = []
    for (k, carta), ruta in hechas.items():
        r = SC.subir(s, ruta, '%s/%s-m.webp' % (k, carta))
        if r[0]:
            ok.append((k, carta))
        else:
            print('   ⚠️ %s/%s no subió: %s' % (k, carta, r[1]))
    return ok


def correr(quienes, simulacro=False):
    """Las fotos de `quienes` (nombres) que tienen marco puesto. Devuelve `{clave: {firma, cartas}}` para el objeto."""
    pub = marcos_publicos()
    trabajos, firma = [], {}
    for raw in quienes:
        k, sv, cc, cartas = datos_de(raw)
        m = pub.get(k)
        if not m or not cartas:
            continue
        firma[k] = '%s|%s' % (m[0], m[1])
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
