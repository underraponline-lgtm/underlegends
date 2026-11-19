# -*- coding: utf-8 -*-
"""🎯 ¿EL TUTORIAL SEÑALA BIEN? Corre el corto y cada capítulo, paso por paso, en un navegador de verdad.

    python herramientas/tuto_medir.py                 contra la página publicada
    python herramientas/tuto_medir.py --local         con lo construido acá (bot/paginas), sobre los datos publicados
    python herramientas/tuto_medir.py --auto          para CI: rojo si algún paso falla (prueba dos veces cada recorrido)
    python herramientas/tuto_medir.py --fotos DIR     y una foto por paso
    python herramientas/tuto_medir.py --casos 1333-noche,390-clara,360-noche

Nació el 19/11/2026 (Dlx: «se mueven las pantallas pero selecciona más las cosas», y a la A de la maqueta: «asegúrate que
todo esté bien y que se acople si actualizamos o remakeamos esto»). `tuto_marcas.py` mira el CÓDIGO: que cada `data-tuto`
exista en alguna página. Esto mira la PÁGINA, que es donde falló: las marcas existían y casi todas estaban sobre una
sección entera, así que el velo no tenía nada que tapar. Un paso FALLA si:

    · no encontró su marca (se encendió el título de la página, el repuesto de tutorial.jsx, o nada)
    · lo encendido se sale de la pantalla
    · la carta tapa lo encendido
    · lo encendido pasa del 45 % de la pantalla
    · la página tiró un error

Los capítulos salen de `web/src/capitulos.js`: uno nuevo se mide solo. Corre en web.yml después de cada despliegue,
o sea cada vez que cambia la página: si una página se rehace y su marca se pierde o cae sobre algo enorme, se pone rojo.
"""
import json
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAG = os.path.join(RAIZ, 'bot', 'paginas')
WEB = os.environ.get('LG_WEB_RAIZ') or 'https://underlegends.pages.dev'
TOPE = 0.45   # lo encendido, como mucho, de la pantalla


def capitulos():
    t = open(os.path.join(RAIZ, 'web', 'src', 'capitulos.js'), encoding='utf-8').read()
    return re.findall(r"\{ id: '([a-z0-9-]+)', ruta:", t)


def servir(route, req):
    u = req.url
    if '/inicio/' in u:
        f = os.path.join(PAG, 'inicio', *u.split('/inicio/', 1)[1].split('?')[0].split('/'))
        if os.path.isfile(f):
            ct = 'text/css' if f.endswith('.css') else 'application/json' if f.endswith('.json') else 'application/javascript'
            return route.fulfill(path=f, headers={'content-type': ct, 'cache-control': 'no-store'})
    if req.resource_type == 'document' and u.startswith(WEB) and '/api/' not in u:
        return route.fulfill(path=os.path.join(PAG, 'index.html'), headers={'content-type': 'text/html; charset=utf-8'})
    return route.continue_()


# lo que se ve de un paso: la luz (las esquinas a y d), la carta y si se tapan
MED = r"""() => { const s = document.querySelector('#inicio-nuevo').shadowRoot;
  const R = (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; };
  if (!s.querySelector('.rc')) return {abierto: false};
  const caja = s.querySelector('.rc-caja'), ea = s.querySelector('.rc-esq.a'), ed = s.querySelector('.rc-esq.d');
  const n = (s.querySelector('.rc-cab small') || {}).textContent || null;
  const k = (s.querySelector('.rc-cab .rc-k') || {}).textContent || '';
  let L = null;
  if (ea && ed) { const a = ea.getBoundingClientRect(), d = ed.getBoundingClientRect(); L = [a.left, a.top, d.left - a.left, d.top - a.top]; }
  return {abierto: true, n, k, luz: L, caja: caja ? R(caja) : null, vw: innerWidth, vh: innerHeight};
}"""
SIG = r"""() => { const s = document.querySelector('#inicio-nuevo').shadowRoot; const b = s.querySelector('.rc-caja .rc-acc .rc-sig'); if (b) b.click(); return !!b; }"""


def fallas(m):
    """Lo que está mal en un paso medido (lista vacía: bien)"""
    if not m.get('luz'):
        return ['sin luz']
    x, y, w, h = m['luz']
    vw, vh = m['vw'], m['vh']
    out = []
    if x < -2 or y < -2 or x + w > vw + 2 or y + h > vh + 2:
        out.append('se sale de la pantalla')
    c = m.get('caja')
    if c:
        ix = max(0, min(x + w, c[0] + c[2]) - max(x, c[0]))
        iy = max(0, min(y + h, c[1] + c[3]) - max(y, c[1]))
        if ix * iy > 0.01 * w * h:
            out.append('la carta tapa el %d %%' % round(100 * ix * iy / max(1, w * h)))
    if w * h > TOPE * vw * vh:
        out.append('enciende el %d %% de la pantalla' % round(100 * w * h / (vw * vh)))
    return out


def recorrer(pg, que, avisos, fotos, caso):
    """Un recorrido entero: [(n, k, fallas)]"""
    avisos.clear()
    pg.evaluate("window.dispatchEvent(new CustomEvent('lg:tour', {detail: %s}))" % json.dumps(que))
    pg.wait_for_timeout(3800)
    out = []
    for j in range(10):
        m = pg.evaluate(MED)
        if not m.get('abierto'):
            if not out:
                out.append(('-', que, ['no se abrió']))
            break
        if m.get('n') is None:   # la ventana del final
            break
        f = fallas(m)
        if avisos:
            f.append('sin marca: ' + avisos[-1])
            avisos.clear()
        if fotos:
            pg.screenshot(path=os.path.join(fotos, '%s_%s_%d.png' % (caso, que.replace(':', '-'), j + 1)))
        out.append((m['n'], m['k'], f))
        if not pg.evaluate(SIG):
            break
        pg.wait_for_timeout(2000)
    pg.keyboard.press('Escape')
    pg.wait_for_timeout(400)
    return out


def correr(casos, local, fotos, auto):
    from playwright.sync_api import sync_playwright
    malos = []
    total = 0
    with sync_playwright() as p:
        br = p.chromium.launch()
        for caso in casos:
            w, tema = caso.split('-')
            w = int(w)
            ctx = br.new_context(viewport={'width': w, 'height': 900 if w > 700 else 844}, is_mobile=w < 600, has_touch=w < 600)
            # alguien que ya vino (sin la intro ni la bienvenida), con el tema del caso
            ctx.add_init_script("""try { const n = Date.now(); localStorage.setItem('lg:visita', String(n)); localStorage.setItem('lg:carga', String(n));
              localStorage.setItem('lg:tuto', JSON.stringify({t: n - 90 * 864e5, nuevo: false, tour: 'fin', pasos: 'fin', c: {}, notas: {}, bienv: true, aviso_tuto: 1}));
              localStorage.setItem('lg:cambios', '999.99'); localStorage.setItem('lg:tema', '%s'); } catch (e) {}""" % tema)
            if local:
                ctx.route('**/*', servir)
            pg = ctx.new_page()
            errs, avisos = [], []
            pg.on('pageerror', lambda e: errs.append(str(e)[:160]))
            pg.on('console', lambda m: avisos.append(m.text.split('marca ', 1)[-1].split(':')[0]) if '[tutorial] no está la marca' in m.text else None)
            pg.goto(WEB + '/freestyle-rap', wait_until='domcontentloaded', timeout=60000)
            pg.wait_for_timeout(7000)
            for que in ['corto'] + ['cap:' + c for c in capitulos()]:
                pasos = recorrer(pg, que, avisos, fotos, caso)
                # una segunda vuelta antes de dar rojo: una página que tardó en bajar no es un tutorial roto
                if auto and any(f for _, _, f in pasos):
                    pasos = recorrer(pg, que, avisos, fotos, caso)
                for n, k, f in pasos:
                    total += 1
                    if f:
                        malos.append((caso, que, n, k, f))
            if errs:
                malos.append((caso, '-', '-', 'la página', ['error: ' + e for e in errs[:3]]))
            ctx.close()
        br.close()
    return total, malos


def _self_check():
    caps = capitulos()
    assert len(caps) >= 9 and 'ranking' in caps and 'cuenta' in caps, caps
    base = {'vw': 1000, 'vh': 800, 'caja': [0, 700, 300, 90]}
    assert fallas(dict(base, luz=[10, 10, 100, 50])) == []
    assert fallas(dict(base, luz=None)) == ['sin luz']
    assert 'se sale de la pantalla' in fallas(dict(base, luz=[10, 700, 100, 200]))
    assert any(x.startswith('la carta tapa') for x in fallas(dict(base, luz=[10, 650, 100, 100])))
    assert any(x.startswith('enciende') for x in fallas(dict(base, luz=[0, 0, 1000, 500])))


if __name__ == '__main__':
    _self_check()
    a = sys.argv[1:]
    fotos = a[a.index('--fotos') + 1] if '--fotos' in a else None
    if fotos:
        os.makedirs(fotos, exist_ok=True)
    casos = a[a.index('--casos') + 1].split(',') if '--casos' in a else ['1333-noche', '390-clara']
    total, malos = correr(casos, '--local' in a, fotos, '--auto' in a)
    if malos:
        print('❌ %d de %d pasos del tutorial no señalan bien:' % (len(malos), total))
        for caso, que, n, k, f in malos:
            print('   · %-11s %-20s %-6s %-22s %s' % (caso, que, n, k, '; '.join(f)))
        print('   Pon la marca (`data-tuto`) en una pieza chica de esa página, o cambia el paso en web/src/capitulos.js.')
        sys.exit(1 if '--auto' in a else 0)
    print('✅ los %d pasos del tutorial señalan algo chico, entero y sin taparlo (%s)' % (total, ', '.join(casos)))
