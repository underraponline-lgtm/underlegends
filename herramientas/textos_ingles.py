# -*- coding: utf-8 -*-
"""🇬🇧 LOS TEXTOS DE LA PÁGINA QUE FALTAN EN INGLÉS (la vista `/en`, web/src/ingles.js).

    python herramientas/textos_ingles.py            recorre la página publicada y deja salida_ingles/faltan.json
    python herramientas/textos_ingles.py --local    con lo construido acá (bot/paginas/inicio), sobre la página publicada
    python herramientas/textos_ingles.py --cel      a ancho de teléfono: tiene textos que la compu no muestra (se suma a lo otro)
    python herramientas/textos_ingles.py --auto     self-check: el diccionario tiene los mismos huecos en cada lado

Recorre cada página como alguien que ya vino (sin intro), EN CASTELLANO, y junta cada texto del shadow root (y los
`placeholder`, `title` y `aria-label`, y el título de la pestaña) como CLAVE: corre en la página el mismo
web/src/ingles_base.js que usa el traductor, con los nombres del lobby, así una clave de acá es la misma que busca la
página. Un texto con « · » deja también cada parte. Lo que no está en web/src/ingles.json va a `faltan.json`, con un
ejemplo y las páginas donde salió, para traducirlo.

⚠️ El diccionario lleva `{n}` (un número) y `{p}` (un nombre de la Liga) en los MISMOS lugares en los dos lados: una
traducción con un hueco de más o de menos no se usa (`rellenar()` devuelve `null`) y el texto queda en castellano.
"""
import io
import json
import os
import re
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIC = os.path.join(BASE, 'web', 'src', 'ingles.json')
BASE_JS = os.path.join(BASE, 'web', 'src', 'ingles_base.js')
SALIDA = os.path.join(BASE, 'salida_ingles')
WEB = os.environ.get('LG_WEB_RAIZ') or 'https://underlegends.pages.dev'
RUTAS = ['/freestyle-rap', '/freestyle-rap/ranking', '/freestyle-rap/ranking/competitivo', '/freestyle-rap/ranking/duelos',
         '/freestyle-rap/ranking/podios', '/freestyle-rap/ranking/rachas', '/freestyle-rap/ranking/paises', '/freestyle-rap/ranking/crews',
         '/freestyle-rap/eventos', '/freestyle-rap/ligas', '/freestyle-rap/ligas/fmh-espana', '/freestyle-rap/tarjetas',
         '/freestyle-rap/pase', '/freestyle-rap/tienda', '/freestyle-rap/publicaciones', '/freestyle-rap/socios', '/freestyle-rap/guia',
         '/freestyle-rap/salon', '/freestyle-rap/crews', '/freestyle-rap/r/makmah', '/freestyle-rap/r/oasis', '/freestyle-rap/sv/FFA',
         '/freestyle-rap/sv/DDF', '/freestyle-rap/pais/ar', '/freestyle-rap/llave/660', '/cuenta', '/freestyle-rap/invitar',
         '/freestyle-rap/r/erian', '/freestyle-rap/r/pichulamc', '/freestyle-rap/r/valen', '/freestyle-rap/sv/LKR',
         '/freestyle-rap/sv/URBF', '/freestyle-rap/pais/co', '/freestyle-rap/pais/cl', '/freestyle-rap/ligas/snake-generations',
         '/freestyle-rap/llave/652', '/freestyle-rap/crew/Follombia', '/freestyle-rap/ranking/mw', '/freestyle-rap/ranking/actividad',
         '/freestyle-rap/ranking/misiones', '/freestyle-rap/ranking/ligas']

JUNTAR = r"""async () => {
  const L = await fetch('/api/lobby', { headers: { accept: 'application/json' } }).then((r) => r.json()).catch(() => null);
  const rx = rxHuecos(nombresDe(L));
  const out = {};
  const anotar = (crudo) => {
    const t = String(crudo).replace(/\s+/g, ' ').trim();
    if (!t || !/\p{L}/u.test(t)) return;
    const todo = [t].concat(t.includes(' · ') ? t.split(' · ') : []);
    for (const x of todo) {
      const { k } = normalizar(x, rx);
      if (/\p{L}/u.test(k.replace(/\{[np]\}/g, '')) && !out[k]) out[k] = x;
    }
  };
  const pasear = (n) => {
    const w = document.createTreeWalker(n, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let x;
    while ((x = w.nextNode())) {
      if (x.nodeType === 3) {
        const p = x.parentElement;
        if (!p || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(p.tagName)) continue;
        anotar(x.nodeValue);
      } else {
        for (const a of ['placeholder', 'title', 'aria-label']) { const v = x.getAttribute(a); if (v) anotar(v); }
        if (x.shadowRoot) pasear(x.shadowRoot);
      }
    }
  };
  const h = document.querySelector('#inicio-nuevo');
  if (h && h.shadowRoot) pasear(h.shadowRoot);
  anotar(document.title);
  return out;
}"""


def leer_dic():
    try:
        with io.open(DIC, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def huecos(t):
    return (len(re.findall(r'\{n\}', t)), len(re.findall(r'\{p\}', t)))


def recorrer(local=False, cel=False):
    from playwright.sync_api import sync_playwright
    # ⚠️ Playwright corre el init script en su propio ámbito: las funciones se cuelgan de `window` a mano
    js = (io.open(BASE_JS, encoding='utf-8').read().replace('export function ', 'function ')
          + '\nwindow.rxHuecos = rxHuecos; window.normalizar = normalizar; window.nombresDe = nombresDe;')
    claves = {}
    ini = os.path.join(BASE, 'bot', 'paginas', 'inicio')
    with sync_playwright() as p:
        br = p.chromium.launch()
        # ⚠️ el teléfono tiene textos propios (el menú de tu cuenta, los consejos de la barra de abajo): se recorre aparte, con --cel
        ctx = (br.new_context(viewport={'width': 390, 'height': 844}, locale='es-ES', is_mobile=True, has_touch=True) if cel
               else br.new_context(viewport={'width': 1440, 'height': 900}, locale='es-ES'))
        # alguien que ya vino, en castellano: sin la pantalla de carga larga, sin bienvenida ni tutorial
        ctx.add_init_script("""try { const n = Date.now(); localStorage.removeItem('lg:lang'); localStorage.setItem('lg:visita', String(n));
          localStorage.setItem('lg:carga', String(n)); localStorage.setItem('lg:tuto', JSON.stringify({t: n - 90 * 864e5, nuevo: false,
          tour: 'fin', pasos: 'fin', c: {}, notas: {}, bienv: true})); } catch (e) {}""")
        ctx.add_init_script(js)
        if local:
            def servir(route, req):
                nom = req.url.split('/inicio/', 1)[1].split('?')[0]
                f = os.path.join(ini, *nom.split('/'))
                if os.path.isfile(f):
                    ct = 'text/css' if f.endswith('.css') else 'font/woff2' if f.endswith('.woff2') else 'application/javascript'
                    route.fulfill(path=f, headers={'content-type': ct, 'cache-control': 'no-store'})
                else:
                    route.continue_()
            ctx.route('**/inicio/**', servir)
        pg = ctx.new_page()
        for r in RUTAS:
            pg.goto(WEB + r, wait_until='domcontentloaded', timeout=60000)
            pg.wait_for_timeout(4500)
            for _ in range(8):
                pg.mouse.wheel(0, 1500)
                pg.wait_for_timeout(300)
            for k, ej in pg.evaluate(JUNTAR).items():
                c = claves.setdefault(k, {'ej': ej, 'pags': []})
                if r not in c['pags']:
                    c['pags'].append(r)
            print('  %-38s %5d claves en total' % (r, len(claves)))
        br.close()
    return claves


def _self_check():
    malos = 0

    def ok(c, que):
        nonlocal malos
        print('  %s %s' % ('✅' if c else '❌', que))
        if not c:
            malos += 1
    d = leer_dic()
    mal = [k for k, v in d.items() if not isinstance(v, str) or huecos(k) != huecos(v)]
    ok(not mal, 'cada traducción tiene los mismos huecos que su clave ({n} números, {p} nombres): %d de %d%s'
       % (len(d) - len(mal), len(d), (' — mal: ' + ' | '.join(mal[:3])) if mal else ''))
    vacias = [k for k, v in d.items() if isinstance(v, str) and not v.strip()]
    ok(not vacias, 'ninguna traducción vacía')
    js = io.open(BASE_JS, encoding='utf-8').read()
    ok("'{p}'" in js and "'{n}'" in js, 'ingles_base.js arma las claves con {p} y {n}, como el diccionario')
    print('\n%s' % ('✅ el diccionario en inglés' if not malos else '❌ %d falla(s)' % malos))
    return 1 if malos else 0


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        return _self_check()
    claves = recorrer(local='--local' in sys.argv, cel='--cel' in sys.argv)
    d = leer_dic()
    faltan = [{'k': k, 'ej': v['ej'], 'pags': v['pags']} for k, v in sorted(claves.items()) if k not in d]
    os.makedirs(SALIDA, exist_ok=True)
    with io.open(os.path.join(SALIDA, 'faltan.json'), 'w', encoding='utf-8') as f:
        json.dump(faltan, f, ensure_ascii=False, indent=0)
    print('\n  %d claves en la página · %d ya en inglés · %d faltan → salida_ingles/faltan.json'
          % (len(claves), len(claves) - len(faltan), len(faltan)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
