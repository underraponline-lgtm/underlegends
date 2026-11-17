# -*- coding: utf-8 -*-
"""🎁 LAS MINIATURAS DE LOS LINKS CORTOS: `og/crew/<slug>.jpg` y `og/ref/<slug>.jpg` en R2, 1200 × 630.

    python bot/og_links.py --subir     arma las que cambiaron y las sube (el ciclo, al final de dibujar)
    python bot/og_links.py --seco      dice cuáles armaría, sin abrir el navegador ni subir
    python bot/og_links.py --ver X     arma sólo la crew o el link X en salida_og/, sin subir (para mirarla)
    python bot/og_links.py --auto      self-check

Dlx, 17/11/2026: *«que el link de invitación de la crew sea más corto para no asustar y que tenga un thumbnail
personalizable, o sea de la crew en este caso, y en este caso el referral también»*, y a la pregunta de dónde sale la
imagen: *«armada sola»*. Nadie sube nada: la de una crew lleva su logo, su nombre, su sigla y cuántos son; la de un link de
referido, «X te invita» con su tarjeta.

La DIBUJA LA PÁGINA (`#/og/<tipo>/<id>`, web/src/og_link.jsx) y acá se le saca la foto, como `bot/con_marco.py`: el
escudo armado de una crew existe sólo ahí (escudo.jsx), y dibujarlo de nuevo en Python serían dos dibujos de lo mismo.

La vista previa la da `bot/paginas/_worker.js` (`vistaCrew()`, `vistaRef()`) a los bots de Discord, WhatsApp y demás,
preguntando si la imagen ya está (HEAD). Si todavía no está, usa el logo o la tarjeta: nada se rompe por esperar.

⚠️ EL SLUG ES EL MISMO EN LOS DOS LADOS: `slug_og()` acá y `slugOg()` en _worker.js. El self-check los compara con los
mismos casos.

⚠️ SE ARMA SÓLO LO QUE CAMBIÓ: la huella de lo que se dibuja (nombre, sigla, logo, cuántos; nombre y tarjeta) queda en
`datos/og_links.json`, que va en `ARCHIVOS` de `bot/ci/guardar.sh`. Sin eso cada corrida volvería a subir todas.
"""
import hashlib
import io
import json
import os
import re
import sys
import unicodedata

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE):
    if _p not in sys.path:
        sys.path.insert(0, _p)

ESTADO = os.path.join(BASE, 'datos', 'og_links.json')
#: la página publicada; `LG_WEB` la cambia para probar contra la copia local (como bot/con_marco.py)
WEB = os.environ.get('LG_WEB') or 'https://underlegends.pages.dev/freestyle-rap'
SALIDA = os.path.join(BASE, 'salida_og')
PUBLICA = 'https://pub-70d5821d06a8432c9cffd0c102195000.r2.dev'
ORDEN_CARTA = ('temporada', 'servidor', 'competitivo', 'pais')
#: cambia esto y se rearman todas (el diseño entra en la huella)
DISENO = 'v1'


def slug_og(x):
    """El mismo de `slugOg()` en bot/paginas/_worker.js: sin tildes, minúsculas, todo lo que no es letra o número a «-»."""
    s = unicodedata.normalize('NFD', str(x or ''))
    s = ''.join(c for c in s if not unicodedata.category(c).startswith('M')).lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')[:60]


def _huella(d):
    return hashlib.sha1(json.dumps([DISENO, d], ensure_ascii=False, sort_keys=True).encode('utf-8')).hexdigest()[:16]


def _get(url, ciclo=False, timeout=25):
    import requests
    h = {'accept': 'application/json'}
    if ciclo:
        import avisar
        import clave_ciclo as CC
        t = avisar._token()
        if not t:
            return None
        h['x-lg-ciclo'] = CC.clave(t)
    try:
        r = requests.get(url, headers=h, timeout=timeout)
        return r.json() if r.ok else None
    except Exception:                                    # noqa: BLE001
        return None


def trabajos():
    """`[(tipo, slug, huella, id)]` de todo lo que hay hoy: las crews (`id` de la crew) y los links abiertos esta temporada
    (`id` = la clave). La huella es de lo que la miniatura muestra: si no cambió, no se vuelve a sacar."""
    import avisar
    out = []
    cw = _get(avisar.WORKER + '/avisos/crews') or {}
    for c in cw.get('crews') or []:
        s = slug_og(c.get('id'))
        if not s:
            continue
        datos = {'n': c.get('nombre'), 's': c.get('sigla'), 'l': c.get('logo'), 'g': len(c.get('gente') or []), 'd': c.get('desc')}
        out.append(('crew', s, _huella(datos), str(c.get('id'))))
    ks = (_get(avisar.WORKER + '/avisos/ref-links', ciclo=True) or {}).get('ks') or []
    if ks:
        L = _get(avisar.WORKER + '/lobby?json=1', timeout=40) or {}
        filas = {f.get('k'): f for f in (L.get('tabla') or []) if isinstance(f, dict)}
        cartas = L.get('cartas') or []
        for k in ks:
            f = filas.get(k) or {}
            carta = ''
            for c in ORDEN_CARTA:
                if c in (f.get('c') or []):
                    i = cartas.index(c) if c in cartas else -1
                    v = f.get('cv').split('.')[i] if isinstance(f.get('cv'), str) and i >= 0 and i < len(f.get('cv').split('.')) else ''
                    carta = '%s/%s/%s.webp%s' % (PUBLICA, k, c, ('?v=' + v) if v else '')
                    break
            r = {'k': k, 'n': f.get('n') or k, 'carta': carta}
            out.append(('ref', slug_og(k), _huella(r), k))
    return out


def _leer_estado():
    try:
        with io.open(ESTADO, encoding='utf-8') as f:
            d = json.load(f)
        return d if isinstance(d, dict) else {}
    except (OSError, ValueError):
        return {}


def dibujar(lista):
    """`{(tipo, slug): ruta del JPG}` de las que salieron: la foto de `#/og/<tipo>/<id>` (web/src/og_link.jsx), con un
    navegador para todas. Una que la página no sabe dibujar (la ruta todavía no está publicada) no sale y se reintenta."""
    from urllib.parse import quote
    import navegador
    navegador.hace_falta()                               # Chromium, sólo si hay algo que sacar (bot/navegador.py)
    from playwright.sync_api import sync_playwright
    from PIL import Image
    os.makedirs(SALIDA, exist_ok=True)
    out = {}
    with sync_playwright() as pw:
        nav = pw.chromium.launch()
        pag = nav.new_page(viewport={'width': 1200, 'height': 630}, device_scale_factor=1)
        for tipo, slug, _h, ident in lista:
            try:
                pag.goto('%s/og/%s/%s' % (WEB, tipo, quote(ident, safe='')), wait_until='domcontentloaded', timeout=45000)
                pag.wait_for_function("""() => { const h = document.querySelector('#inicio-nuevo');
                    const o = h && h.shadowRoot && h.shadowRoot.querySelector('.og');
                    return o && o.dataset.listo === '1'; }""", timeout=45000)
                falta = pag.evaluate("""() => {
                    const st = document.createElement('style');
                    st.textContent = 'body *{visibility:hidden!important} #inicio-nuevo{visibility:visible!important}';
                    document.head.appendChild(st);
                    return document.querySelector('#inicio-nuevo').shadowRoot.querySelector('.og').dataset.falta === '1'; }""")
                if falta:
                    print('   · %s/%s: la página no lo encontró' % (tipo, slug))
                    continue
                pag.wait_for_timeout(400)
                png = os.path.join(SALIDA, '%s_%s.png' % (tipo, slug))
                pag.screenshot(path=png, clip={'x': 0, 'y': 0, 'width': 1200, 'height': 630})
                jpg = png[:-4] + '.jpg'
                Image.open(png).convert('RGB').save(jpg, 'JPEG', quality=88, optimize=True)
                out[(tipo, slug)] = jpg
            except Exception as e:                       # noqa: BLE001
                print('   ⚠️ %s/%s: %s' % (tipo, slug, str(e)[:90]))
        nav.close()
    return out


def subir(hechas):
    import subir_cartas as SC
    s = SC.sesion()
    ok = []
    for (tipo, slug), ruta in hechas.items():
        with open(ruta, 'rb') as f:
            datos = f.read()
        clave = 'og/%s/%s.jpg' % (tipo, slug)
        try:
            r = s.put('%s/objects/%s' % (SC.API, clave), data=datos, headers={'Content-Type': 'image/jpeg'}, timeout=60)
            if SC._ok(r, clave) is not None:
                ok.append((tipo, slug))
        except Exception as e:                           # noqa: BLE001
            print('   ⚠️ %s no subió: %s' % (clave, str(e)[:80]))
    return ok


def correr(seco=False, solo=None):
    est = _leer_estado()
    todos = trabajos()
    if solo:
        todos = [t for t in todos if t[1] == slug_og(solo)]
    faltan = [t for t in todos if solo or (est.get(t[0]) or {}).get(t[1]) != t[2]]
    print('   🎁 miniaturas de los links: %d crews y links, %d cambiaron' % (len(todos), len(faltan)))
    if seco or not faltan:
        for t in faltan[:20]:
            print('      · %s/%s' % (t[0], t[1]))
        return 0
    hechas = dibujar(faltan)
    if solo:
        for (tipo, slug), ruta in hechas.items():
            print('      ✅ %s' % ruta)
        return 0
    subidas = subir(hechas)
    huellas = {(t[0], t[1]): t[2] for t in faltan}
    for tipo, slug in subidas:
        est.setdefault(tipo, {})[slug] = huellas[(tipo, slug)]
    with io.open(ESTADO, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(est, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write('\n')
    print('      ✅ %d subidas de %d' % (len(subidas), len(faltan)))
    return 0


def _self_check():
    malos = 0

    def ok(c, que):
        nonlocal malos
        print('  %s %s' % ('✅' if c else '❌', que))
        if not c:
            malos += 1
    # los mismos casos que `slugOg()` en _worker.js (medidos con node el 17/11/2026)
    ok(slug_og('La Fórmula Crew') == 'la-formula-crew' and slug_og('Ñandú_7') == 'nandu-7' and slug_og('  --  ') == ''
       and slug_og('Follombia') == 'follombia', 'el slug es el de _worker.js: sin tildes, minúsculas, «-» entre palabras')
    a = _huella({'n': 'X', 'g': 3})
    ok(a == _huella({'g': 3, 'n': 'X'}) and a != _huella({'n': 'X', 'g': 4}), 'la huella no depende del orden y cambia con los datos')
    with io.open(os.path.join(BASE, 'bot', 'ci', 'guardar.sh'), encoding='utf-8') as f:
        ok('datos/og_links.json' in f.read(), 'datos/og_links.json va en ARCHIVOS de guardar.sh (si no, cada corrida sube todas)')
    print('\n%s' % ('✅ las miniaturas de los links' if not malos else '❌ %d falla(s)' % malos))
    return 1 if malos else 0


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:                                    # noqa: BLE001
        pass
    a = sys.argv[1:]
    if '--auto' in a:
        return _self_check()
    if '--ver' in a:
        i = a.index('--ver')
        return correr(solo=a[i + 1] if i + 1 < len(a) else '')
    if '--subir' in a:
        return correr()
    if '--seco' in a:
        return correr(seco=True)
    print(__doc__)
    return 0


if __name__ == '__main__':
    sys.exit(main())
