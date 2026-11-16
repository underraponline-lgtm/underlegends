"""📏 ¿Está todo bien posicionado en Ligas? (15/11/2026, Dlx: «asegúrate que todo esté bien posicionado»). La portada y la
página de cada liga, construidas (bot/paginas; antes `npx vite build` en web/), con /api de la página de verdad. En 6 anchos:
lo que sale de la pantalla, el texto cortado sin «…», el texto que se pisa (sólo lo que se VE: lo recortado y lo de más
alto de la fuente no cuenta) y los huecos de la cartelera. Las ligas de la lista son una por estado; si dejan de existir,
pasar otras como argumento.
    python herramientas/medir_ligas.py [--fotos] [--dc=<clave>] [/freestyle-rap/ligas/<id> ...]
"""
import json, os, sys, mimetypes
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

try:
    sys.stdout.reconfigure(encoding='utf-8')  # la consola de Windows no es UTF-8 y los nombres traen tildes y emojis
except Exception:
    pass

PAG = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'bot', 'paginas')
PROD = 'https://underlegends.pages.dev'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'salida_medir_ligas')
os.makedirs(OUT, exist_ok=True)
ANCHOS = [(1920, 1080), (1375, 900), (1024, 768), (768, 1024), (393, 852), (360, 780)]
RUTAS = [a for a in sys.argv[1:] if not a.startswith('--')] or [
    '/freestyle-rap/ligas', '/freestyle-rap/ligas/fds-peru', '/freestyle-rap/ligas/fds-mexico', '/freestyle-rap/ligas/fmh-espana',
    '/freestyle-rap/ligas/fmh-carimex', '/freestyle-rap/ligas/lkr-fms-plaza', '/freestyle-rap/ligas/ddf-dimension-word-series-26',
    '/freestyle-rap/ligas/fzl']
FOTOS = '--fotos' in sys.argv
DC = None
for a in sys.argv:
    if a.startswith('--dc='):
        k = a[5:]
        DC = {'id': '700000000000000009', 'clave': k, 'n': k}

MEDIR = r"""
() => {
  const R = document.querySelector('#inicio-nuevo').shadowRoot;
  const W = document.documentElement.clientWidth;
  const out = { docW: document.documentElement.scrollWidth, W, fuera: [], corte: [], pisa: [], huecos: [], vacios: [] };
  const zonas = [...R.querySelectorAll('.lq3-osc,.lq3-tuyas,#lq3-todas,.lp3-h,.lp3-tabs,.lpg-pest,#lgp-otras,.lgf-dsec,.cf')];
  if (!zonas.length) { out.sin = true; return out; }
  const nom = (el) => (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : el.tagName.toLowerCase());
  const camino = (el) => { const xs = []; for (let p = el; p && xs.length < 3 && p !== R; p = p.parentElement) xs.unshift(nom(p)); return xs.join(' > '); };
  const visible = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && +s.opacity > 0.05; };
  const deslizable = (el) => { for (let p = el.parentElement; p && p !== R; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth + 1) return p; if (p.classList.contains('lq3-ticker')) return p; } return null; };
  const todos = zonas.flatMap((z) => [z, ...z.querySelectorAll('*')]);
  // 1) lo que sale del ancho de la pantalla, fuera de lo que se desliza
  for (const el of todos) {
    if (!visible(el) || el.closest('svg')) continue;
    const r = el.getBoundingClientRect();
    if ((r.right > W + 1 || r.left < -1) && !deslizable(el)) out.fuera.push(camino(el) + ' [' + Math.round(r.left) + '..' + Math.round(r.right) + ']');
  }
  // 2) cortado: una caja que recorta y cuyo contenido no entra (salvo lo que corta a propósito con «…» o line-clamp)
  for (const el of todos) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
    if (/(auto|scroll)/.test(s.overflowX) || /(auto|scroll)/.test(s.overflowY)) continue;
    if (el.classList.contains('lq3-ticker')) continue;
    if (s.webkitLineClamp && s.webkitLineClamp !== 'none') continue;
    const h = el.scrollHeight - el.clientHeight, w = el.scrollWidth - el.clientWidth;
    if (h > 2) out.corte.push('alto ' + h + 'px: ' + camino(el));
    if (w > 2 && s.textOverflow !== 'ellipsis' && !el.classList.contains('lq3-t')) out.corte.push('ancho ' + w + 'px: ' + camino(el));
  }
  // 3) texto que se pisa: los renglones de texto de dos elementos distintos que se cruzan
  const rs = [];
  for (const el of todos) {
    if (!visible(el) || el.closest('.lq3-ticker') || el.closest('svg')) continue;
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      // lo que se ve del renglón: recortado por las cajas que recortan (y por el line-clamp), y del alto de su línea, no de la
      // caja de la fuente (Anton mide 1,5 em de alto con line-height 1, y dos renglones parejos «se pisaban» sin tocarse)
      const cs = getComputedStyle(el); const lh = parseFloat(cs.lineHeight);
      for (const r0 of rg.getClientRects()) {
        let L = r0.left, T = r0.top, Rr = r0.right, B = r0.bottom;
        if (lh && B - T > lh) { const d = (B - T - lh) / 2; T += d; B -= d; }
        for (let p = el; p && p !== R; p = p.parentElement) {
          const s = getComputedStyle(p);
          if (s.overflowX !== 'visible' || s.overflowY !== 'visible' || (s.webkitLineClamp && s.webkitLineClamp !== 'none')) {
            const q = p.getBoundingClientRect(); L = Math.max(L, q.left); T = Math.max(T, q.top); Rr = Math.min(Rr, q.right); B = Math.min(B, q.bottom);
          }
        }
        if (Rr - L > 1 && B - T > 1) rs.push([el, { left: L, top: T, right: Rr, bottom: B }]);
      }
    }
  }
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const [a, ra] = rs[i], [b, rb] = rs[j];
    if (a === b || a.contains(b) || b.contains(a)) continue;
    const x = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), y = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (x > 2 && y > 3) { out.pisa.push(camino(a) + ' «' + a.textContent.trim().slice(0, 18) + '» × ' + camino(b) + ' «' + b.textContent.trim().slice(0, 18) + '»'); if (out.pisa.length > 12) break; }
  }
  // 4) huecos de la cartelera: celdas sin nada en la grilla
  for (const g of R.querySelectorAll('.lq3-bento')) {
    const s = getComputedStyle(g); const cols = s.gridTemplateColumns.split(' ').length; const gap = parseFloat(s.columnGap) || 0; const rgap = parseFloat(s.rowGap) || 0;
    const gr = g.getBoundingClientRect(); const pl = parseFloat(s.paddingLeft) || 0;
    const cw = (gr.width - pl - (parseFloat(s.paddingRight) || 0) - gap * (cols - 1)) / cols;
    // las filas de verdad (con minmax cada una mide distinto): dónde arranca cada una
    const altos = s.gridTemplateRows.split(' ').map(parseFloat); const tops = []; let y0 = gr.top + (parseFloat(s.paddingTop) || 0);
    for (const a of altos) { tops.push(y0); y0 += a + rgap; }
    const filaDe = (y) => { let k = 0; tops.forEach((t, i) => { if (y >= t - 2) k = i; }); return k; };
    const occ = new Set(); let filas = 0;
    for (const c of g.children) {
      const r = c.getBoundingClientRect();
      const c0 = Math.round((r.left - gr.left - pl) / (cw + gap)), cs = Math.round((r.width + gap) / (cw + gap));
      const r0 = filaDe(r.top), rsp = filaDe(r.bottom - 3) - r0 + 1;
      for (let a = 0; a < rsp; a++) for (let b = 0; b < cs; b++) occ.add((r0 + a) + ':' + (c0 + b));
      filas = Math.max(filas, r0 + rsp);
    }
    for (let a = 0; a < filas; a++) for (let b = 0; b < cols; b++) if (!occ.has(a + ':' + b)) out.huecos.push('fila ' + (a + 1) + ' col ' + (b + 1) + ' de ' + cols);
  }
  // 5) lo grande y vacío: en cada cuadro de la cartelera, el alto sin nada encima (después del texto y antes del título)
  for (const t of R.querySelectorAll('.lq3-t')) {
    const r = t.getBoundingClientRect(); let tope = r.bottom;
    for (const c of t.children) { const s = getComputedStyle(c); if (s.position === 'absolute') continue; tope = Math.min(tope, c.getBoundingClientRect().top); }
    const libre = tope - r.top - 44; if (libre > r.height * 0.45) out.vacios.push(nom(t) + ' libre ' + Math.round(libre) + ' de ' + Math.round(r.height));
  }
  return out;
}
"""


def servir_con(ctx):
    def servir(route, request):
        u = urlparse(request.url)
        if u.netloc != 'liga.test':
            return route.continue_()
        if u.path.startswith('/api/'):
            if request.method != 'GET':
                return route.fulfill(status=200, body='{"ok":true}', headers={'content-type': 'application/json'})
            try:
                return route.fulfill(response=route.fetch(url=PROD + u.path + ('?' + u.query if u.query else '')))
            except Exception:
                return route.fulfill(status=502, body='{}')
        p = os.path.join(PAG, u.path.lstrip('/').replace('/', os.sep))
        if not os.path.isfile(p):
            p = os.path.join(PAG, 'index.html')
        tipo = 'text/javascript' if p.endswith('.js') else (mimetypes.guess_type(p)[0] or 'application/octet-stream')
        route.fulfill(status=200, body=open(p, 'rb').read(), headers={'content-type': tipo})
    ctx.route('**/*', servir)


def main():
    malos = 0
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for (w, h) in ANCHOS:
            movil = w < 768
            ctx = b.new_context(viewport={'width': w, 'height': h}, bypass_csp=True, device_scale_factor=1, has_touch=movil, is_mobile=movil)
            servir_con(ctx)
            ini = ("try{localStorage.setItem('lg:visita','2026-11-10');localStorage.setItem('lg:carga',String(Date.now()));"
                   "localStorage.setItem('lg:cambios',JSON.stringify('9.99'));localStorage.setItem('lg:tuto',JSON.stringify({hecho:1}));")
            if DC:
                ini += "localStorage.setItem('lg:dc'," + json.dumps(json.dumps(DC)) + ");"
            ctx.add_init_script(ini + "}catch(e){}")
            pg = ctx.new_page()
            errs = []
            pg.on('pageerror', lambda e: errs.append('pageerror ' + str(e)[:160]))
            pg.on('console', lambda m: errs.append('console ' + m.text[:160]) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
            for ruta in RUTAS:
                errs.clear()
                pg.goto('http://liga.test' + ruta, wait_until='load')
                try:
                    pg.wait_for_function("document.documentElement.classList.contains('lg-fuera')", timeout=40000)
                    pg.locator('.lq3-osc, .lp3-h').first.wait_for(timeout=20000)
                except Exception as e:
                    print(w, ruta, 'NO CARGA', str(e)[:120]); malos += 1; continue
                pg.wait_for_timeout(1800)
                # que bajen las imágenes perezosas: recorrer la página
                alto = pg.evaluate("document.documentElement.scrollHeight")
                for y in range(0, alto, h):
                    pg.evaluate(f"scrollTo(0,{y})"); pg.wait_for_timeout(60)
                pg.evaluate("scrollTo(0,0)"); pg.wait_for_timeout(500)
                m = pg.evaluate(MEDIR)
                nombre = ruta.rstrip('/').split('/')[-1]
                problemas = []
                if m.get('sin'):
                    problemas.append('sin zonas de Ligas')
                if m['docW'] > m['W'] + 1:
                    problemas.append('la página se desliza de costado: %d > %d' % (m['docW'], m['W']))
                for k in ('fuera', 'corte', 'pisa', 'huecos', 'vacios'):
                    for x in m[k][:8]:
                        problemas.append(k + ': ' + x)
                problemas += errs[:5]
                print('%5d %-32s %s' % (w, nombre, 'ok' if not problemas else ''))
                for p in problemas:
                    print('        ' + p)
                malos += len(problemas)
                if FOTOS:
                    pg.screenshot(path=os.path.join(OUT, '%s_%d.png' % (nombre, w)), full_page=True)
            ctx.close()
        b.close()
    print('problemas:', malos)


if __name__ == '__main__':
    main()
