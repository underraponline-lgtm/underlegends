"""La 4b con nombres de verdad, del más corto al más largo: qué pasa hoy (nombre pegado a «TE INVITA») y con la regla
propuesta (el nombre en su línea, achicado hasta 34 px, en dos líneas si hace falta y con «…» al final si ni así entra)."""
import io
import os

from PIL import Image
from playwright.sync_api import sync_playwright

AQUI = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(AQUI, 'thumb_medido', 'largos')
os.makedirs(OUT, exist_ok=True)
BASE = io.open(os.path.join(AQUI, 'thumb_medido', 'ThCap2.html'), encoding='utf-8').read()
NOMBRES = ['DLX', 'Makmah', 'PICHULAMC', 'Mr Still Ballin', 'Lautaro la sinceridad', 'Ydimekemeamasaunqueseamentira',
           'Nombre de prueba con cuarenta y seis letras xx']
VIEJO_TAG = '<span class="tag" style="position:absolute;left:40px;top:28px">DLX te invita</span>'
VIEJA_CARTA = 'style="left:74px;top:116px;width:226px;transform:rotate(-4deg)"'

# la regla: un bloque arriba a la izquierda (el nombre y «TE INVITA») y la carta llena lo que queda hasta «Liga Global»
REGLA = '''<div id="quien" style="position:absolute;left:40px;top:28px;width:342px;display:flex;flex-direction:column;align-items:flex-start;gap:0">
<span id="nom" class="tag" style="display:block;max-width:342px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-bottom:4px">{n}</span>
<span class="tag" style="display:block;padding-top:2px">te invita</span>
</div>'''
SCRIPT = '''<script>
document.fonts.ready.then(() => {
  const q = document.getElementById('quien'), n = document.getElementById('nom'), c = document.querySelector('.carta');
  const solo = n.textContent + ' te invita';
  // 1) cabe todo en una línea a 54 px: una sola etiqueta, como la 4b guardada
  n.textContent = solo; n.style.fontSize = '54px';
  if (n.scrollWidth <= n.clientWidth) { q.children[1].remove(); }
  else {
    n.textContent = solo.replace(/ te invita$/, '');
    // 2) el nombre en su línea, de 54 a 44 px
    let f = 54;
    while (n.scrollWidth > n.clientWidth && f > 44) { f -= 1; n.style.fontSize = f + 'px'; }
    // 3) ni a 44 entra: dos líneas por palabras, a 44; si aun así no entra (una palabra sola), «…»
    if (n.scrollWidth > n.clientWidth && /\\s/.test(n.textContent)) {
      n.style.whiteSpace = 'normal'; n.style.display = '-webkit-box'; n.style.webkitLineClamp = '2'; n.style.webkitBoxOrient = 'vertical';
      n.style.lineHeight = '1.02';
    }
  }
  // la carta: de lo que queda entre el bloque y «Liga Global»
  const liga = [...document.querySelectorAll('.bc')].find((e) => /Liga Global/i.test(e.textContent));
  const arriba = q.getBoundingClientRect().bottom + 14, abajo = liga.getBoundingClientRect().top - 16;
  const alto = Math.min(330, abajo - arriba), ancho = Math.round(alto * 0.685);
  c.style.width = ancho + 'px'; c.style.top = arriba + 'px'; c.style.left = Math.round(40 + (330 - ancho) / 2) + 'px';
  document.body.dataset.listo = '1';
});
</script>'''

with sync_playwright() as p:
    br = p.chromium.launch()
    pg = br.new_page(viewport={'width': 1200, 'height': 630})
    hoy, regla = [], []
    for i, n in enumerate(NOMBRES):
        for modo in ('hoy', 'regla'):
            if modo == 'hoy':
                h = BASE.replace(VIEJO_TAG, VIEJO_TAG.replace('DLX te invita', n + ' te invita'))
            else:
                h = BASE.replace(VIEJO_TAG, REGLA.format(n=n)).replace('</body>', SCRIPT + '</body>')
            f = os.path.join(OUT, '%s_%d.html' % (modo, i))
            io.open(f, 'w', encoding='utf-8').write(h)
            pg.goto('file:///' + f.replace(os.sep, '/'))
            pg.wait_for_selector('body[data-listo]', timeout=8000) if modo == 'regla' else pg.wait_for_timeout(700)
            pg.wait_for_timeout(300)
            png = f.replace('.html', '.png')
            pg.locator('.th').screenshot(path=png)
            sale = pg.evaluate("() => { const t = document.querySelector('.tag'); const r = t.getBoundingClientRect(); return Math.round(r.right); }")
            (hoy if modo == 'hoy' else regla).append(png)
            print(modo, n, 'la etiqueta llega a x=%d (la columna termina en 390)' % sale)
    br.close()

W = 20 + 400 + 20 + 400 + 20
H = 40 + len(NOMBRES) * 230
hoja = Image.new('RGB', (W, H), (49, 51, 56))
for i, (a, b) in enumerate(zip(hoy, regla)):
    y = 40 + i * 230
    hoja.paste(Image.open(a).convert('RGB').resize((400, 210), Image.LANCZOS), (20, y))
    hoja.paste(Image.open(b).convert('RGB').resize((400, 210), Image.LANCZOS), (440, y))
hoja.save(os.path.join(OUT, 'hoja_largos.png'))
print('hoja', os.path.join(OUT, 'hoja_largos.png'))
