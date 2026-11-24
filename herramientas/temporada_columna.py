# -*- coding: utf-8 -*-
"""📏 LA COLUMNA DE LA CARTA DE TEMPORADA, MEDIDA (24/11/2026, el plan A: «acomoda bien las cosas… ajusta todo que se
vea bien»).

    python herramientas/temporada_columna.py            mide todas las cartas del pool y dice la peor de cada cosa
    python herramientas/temporada_columna.py Makmah Six sólo ésas
    python herramientas/temporada_columna.py --foto     y deja una hoja con las peores (salida_columna.png, no se sube)

Dibuja las cartas de verdad (`01_Temporada/normal_v3.card()`) en Chromium y mide, en cada una:

  · AIRE: de lo último de la columna de la izquierda (la crew, el servidor o la bandera) al nombre. Se mide contra la
    TINTA del nombre (el rectángulo del texto, no su caja, que va de borde a borde) y sólo si se tocan a lo ancho: un
    nombre corto no llega a la columna.
  · CENTRO: cuánto se corre la letra respecto del puesto que tiene arriba (`#1`, `#145`, «SSS»…).
  · TAMAÑOS: que la bandera, el servidor y la crew no se salgan de la carta.

Medir y no mirar: la regla de CLAUDE.md. La peor carta no es la que uno tiene a mano.
"""
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE)
#: el aire mínimo entre la columna y la tinta del nombre, en px de la carta (300 de ancho)
AIRE_MIN = 8
#: cuánto se puede correr la letra del centro del puesto
CENTRO_MAX = 1.5

MEDIR = r"""() => [...document.querySelectorAll('.card')].map((c) => {
  const R = (e) => e ? e.getBoundingClientRect() : null;
  const cr = R(c);
  const izq = [...c.querySelectorAll('.c-left > *')].map(R).filter((r) => r && r.height);
  const fondo = Math.max(...izq.map((r) => r.bottom));
  const der = Math.max(...izq.map((r) => r.right)), izqx = Math.min(...izq.map((r) => r.left));
  const nm = c.querySelector('.c-name');
  const rg = document.createRange(); rg.selectNodeContents(nm);
  const t = rg.getBoundingClientRect();
  const choca = t.left < der && t.right > izqx;
  const num = R(c.querySelector('.c-pos .c-num')), rk = R(c.querySelector('.c-pos .c-rank'));
  return { n: nm.textContent.trim(), aire: choca ? Math.round((t.top - fondo) * 10) / 10 : null,
    hasta: Math.round((fondo - cr.top) * 10) / 10,
    centro: num && rk ? Math.round(((rk.left + rk.right) / 2 - (num.left + num.right) / 2) * 10) / 10 : null,
    afuera: izq.some((r) => r.left < cr.left || r.right > cr.right),
    piezas: izq.length };
})"""


def main(args):
    import importlib.util as iu
    from playwright.sync_api import sync_playwright
    os.chdir(os.path.join(BASE, '01_Temporada'))
    sp = iu.spec_from_file_location('nv3', os.path.join(BASE, '01_Temporada', 'normal_v3.py'))
    m = iu.module_from_spec(sp)
    sp.loader.exec_module(m)
    pool = json.load(open(os.path.join(BASE, 'datos', 'temporada_pool.json'), encoding='utf-8'))
    pedidos = [a for a in args if not a.startswith('--')]
    gente = [c for c in pool if not pedidos or c['raw'] in pedidos]
    css = open(os.path.join(BASE, '01_Temporada', 'normal_v3.css'), encoding='utf-8').read()
    html = ('<!DOCTYPE html><html><head><meta charset="UTF-8"><style>%s body{background:#07070C;margin:0;padding:10px}'
            '.rack{display:flex;flex-wrap:wrap;gap:12px} .tag{display:none}</style></head><body><div class="rack">%s</div>'
            '</body></html>') % (css, ''.join(m.card(c) for c in gente))
    tmp = os.path.join(BASE, 'salida_columna.html')
    open(tmp, 'w', encoding='utf-8').write(html)
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 1300, 'height': 900})
        pg.goto('file:///' + tmp.replace('\\', '/'))
        pg.wait_for_timeout(2500)
        pg.evaluate('document.fonts.ready')
        xs = pg.evaluate(MEDIR)
        if '--foto' in args:
            peores = sorted([x for x in xs if x['aire'] is not None], key=lambda x: x['aire'])[:6]
            nombres = {x['n'] for x in peores}
            pg.evaluate("(ns) => document.querySelectorAll('.card').forEach((c) => { if (!ns.includes(c.querySelector('.c-name').textContent.trim())) c.parentElement.remove(); })",
                        list(nombres))
            pg.screenshot(path=os.path.join(BASE, 'salida_columna.png'), full_page=True)
        b.close()
    os.remove(tmp)
    con = [x for x in xs if x['aire'] is not None]
    peor = min(con, key=lambda x: x['aire']) if con else None
    cen = [x for x in xs if x['centro'] is not None]
    peorc = max(cen, key=lambda x: abs(x['centro'])) if cen else None
    print('   %d cartas · la columna llega hasta %.0f px (de 438)' % (len(xs), max(x['hasta'] for x in xs)))
    mal = []
    if peor:
        ok = peor['aire'] >= AIRE_MIN
        print('   %s el menor aire entre la columna y el nombre: %.1f px (%s, %d piezas) · mínimo %d · %d nombres llegan a la columna'
              % ('✅' if ok else '🔴', peor['aire'], peor['n'], peor['piezas'], AIRE_MIN, len(con)))
        if not ok:
            mal.append('aire')
    else:
        print('   ✅ ningún nombre llega a la columna')
    if peorc:
        ok = abs(peorc['centro']) <= CENTRO_MAX
        print('   %s la letra, corrida del centro del puesto: %.1f px como mucho (%s)' % ('✅' if ok else '🔴', peorc['centro'], peorc['n']))
        if not ok:
            mal.append('centro')
    fuera = [x['n'] for x in xs if x['afuera']]
    print('   %s nada de la columna se sale de la carta%s' % ('🔴' if fuera else '✅', ': ' + ', '.join(fuera[:5]) if fuera else ''))
    if fuera:
        mal.append('afuera')
    return not mal


if __name__ == '__main__':
    sys.exit(0 if main(sys.argv[1:]) else 1)
