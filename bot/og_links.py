# -*- coding: utf-8 -*-
"""🎁 LAS MINIATURAS DE LOS LINKS CORTOS: `og/crew/<slug>.jpg`, `og/ref/<slug>.jpg` y `og/perfil/<slug>.jpg` en R2, 1200 × 630.

🖼️ Y DESDE EL 17/11/2026 LA DEL LINK DE CADA PERFIL (la tanda 2 del remake de Tu cuenta; Dlx, de la vista previa: «debería
ser prebuilded»): su fondo de «Tu perfil» (Tus fondos), su carta y su nombre, para los de la tabla con carta. Son muchas:
se arman hasta `MAX_PERFIL` por corrida, primero las que nunca se armaron, y las demás en la siguiente.

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
DISENO = 'v2'
#: cuántos carteles de perfil por corrida: la primera vez son unos 200 y cada uno es una foto de Chromium (~1 s)
MAX_PERFIL = 40


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


#: el diseño de la miniatura del link de invitación: el mismo `DISENO_REF` de web/src/og_link.jsx (`data-d`). Cambiarlo rearma
#: sólo ésas, no las crews ni los perfiles; y si la página publicada todavía dice otro, la foto se saltea
DISENO_REF = 'ref-4b-cab'
#: países que no se toman en cuenta (Dlx, 22/09/2026: «Emiratos y Brasil no deberían existir»)
SIN_PAIS = ('ae', 'br', 'no')


def _vitrina(L, ahora=None):
    """Lo que muestra la miniatura del link de invitación, redondeado para abajo para que no se rearme por una unidad: los
    torneos de los últimos 7 días del calendario (a la decena), las personas de los servidores (`comunidad.personas`, al
    millar) y los 12 países con más raperos. La misma regla que `vitrinaRef()` de web/src/og_link.jsx."""
    import datetime
    ahora = ahora or datetime.datetime.now(datetime.timezone.utc)
    desde = ahora - datetime.timedelta(days=7)
    t = 0
    for c in (L or {}).get('calendario') or []:
        try:
            x = datetime.datetime.fromisoformat(str((c or {}).get('t') or (c or {}).get('cuando') or '').replace('Z', '+00:00'))
        except ValueError:
            continue
        if x.tzinfo and desde <= x <= ahora:
            t += 1
    try:
        m = int(((L or {}).get('comunidad') or {}).get('personas') or 0)
    except (TypeError, ValueError):
        m = 0
    ps = [p for p in (L or {}).get('paises') or [] if isinstance(p, dict) and p.get('cc') and p['cc'] not in SIN_PAIS]
    ps.sort(key=lambda p: -(p.get('n') or 0))
    return {'t': t // 10 * 10, 'm': m // 1000 * 1000, 'b': [p['cc'] for p in ps[:12]]}


def _carta(k, f, cartas):
    """La URL de la primera carta que tiene (`ORDEN_CARTA`), con su versión, o ''."""
    vs = f.get('cv').split('.') if isinstance(f.get('cv'), str) else []
    for c in ORDEN_CARTA:
        if c in (f.get('c') or []):
            i = cartas.index(c) if c in cartas else -1
            v = vs[i] if 0 <= i < len(vs) else ''
            return '%s/%s/%s.webp%s' % (PUBLICA, k, c, ('?v=' + v) if v else '')
    return ''


def trabajos():
    """`[(tipo, slug, huella, ruta)]` de todo lo que hay hoy: las crews y los links abiertos esta temporada. `ruta` es lo
    que va después de `#/og/` (ver `dibujar()`). La huella es de lo que la miniatura muestra: si no cambió, no se saca.

    ⚠️ A QUIEN INVITA SE LO BUSCA TAMBIÉN EN LOS PERFILES: el lobby trae sólo la tabla de los 200 primeros, y la primera
    miniatura salió sin la tarjeta de Dlx (#228). El nombre y la carta viajan en la ruta (`?n=`, `?c=`): la página
    tampoco lo tiene en su tabla."""
    from urllib.parse import quote
    import avisar
    out = []
    cw = _get(avisar.WORKER + '/avisos/crews') or {}
    for c in cw.get('crews') or []:
        s = slug_og(c.get('id'))
        if not s:
            continue
        datos = {'n': c.get('nombre'), 's': c.get('sigla'), 'l': c.get('logo'), 'g': len(c.get('gente') or []), 'd': c.get('desc')}
        out.append(('crew', s, _huella(datos), 'crew/' + quote(str(c.get('id')), safe='')))
    ks = (_get(avisar.WORKER + '/avisos/ref-links', ciclo=True) or {}).get('ks') or []
    L = _get(avisar.WORKER + '/lobby?json=1', timeout=40) or {}
    cartas = L.get('cartas') or []
    if ks:
        filas = {f.get('k'): f for f in (L.get('tabla') or []) if isinstance(f, dict)}
        if any(k not in filas for k in ks):
            P = (_get(avisar.WORKER + '/perfiles', timeout=60) or {}).get('p') or {}
            for k in ks:
                if k not in filas and isinstance((P.get(k) or {}).get('f'), dict):
                    filas[k] = P[k]['f']
        V = _vitrina(L)
        for k in ks:
            f = filas.get(k) or {}
            # la «4b» (17/11/2026): los números y las banderas entran en la huella, ya redondeados; `d` es el diseño de
            # ésta sola, así cambiarlo no rearma las crews ni los perfiles
            r = {'k': k, 'n': f.get('n') or k, 'carta': _carta(k, f, cartas), 'd': DISENO_REF, **V}
            ruta = 'ref/%s?n=%s&c=%s&t=%d&m=%d&b=%s' % (quote(k, safe=''), quote(str(r['n']), safe=''), quote(r['carta'], safe=''),
                                                     V['t'], V['m'], ','.join(V['b']))
            out.append(('ref', slug_og(k), _huella(r), ruta))
    # 🖼️ el cartel del link de cada perfil: los de la tabla con carta. La huella es todo lo que el cartel muestra
    fondos = (_get(avisar.WORKER + '/avisos/fondos') or {}).get('f') or {}
    for f in L.get('tabla') or []:
        k = (f or {}).get('k')
        carta = _carta(k, f or {}, cartas)
        if not k or not carta or not slug_og(k):
            continue
        r = {'k': k, 'n': f.get('n'), 'carta': carta, 'pos': f.get('pos'), 'ovr': f.get('ovr'), 'rg': f.get('rg'), 'cc': f.get('cc'),
             'sv': f.get('sv'), 'fondo': fondos.get(k)}
        out.append(('perfil', slug_og(k), _huella(r), 'perfil/' + quote(k, safe='')))
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
    import navegador
    navegador.hace_falta()                               # Chromium, sólo si hay algo que sacar (bot/navegador.py)
    from playwright.sync_api import sync_playwright
    from PIL import Image
    os.makedirs(SALIDA, exist_ok=True)
    out = {}
    with sync_playwright() as pw:
        nav = pw.chromium.launch()
        pag = nav.new_page(viewport={'width': 1200, 'height': 630}, device_scale_factor=1)
        for tipo, slug, _h, ruta in lista:
            try:
                pag.goto('%s/og/%s' % (WEB, ruta), wait_until='domcontentloaded', timeout=45000)
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
                # ⚠️ la «4b» va en la huella: si la página publicada todavía es la de antes (el ciclo corrió antes de que se
                # desplegara la web), la foto saldría vieja con la huella nueva y no se volvería a sacar nunca. Se saltea
                # y se reintenta en la corrida siguiente
                if tipo == 'ref' and pag.evaluate("() => document.querySelector('#inicio-nuevo').shadowRoot.querySelector('.og').dataset.d || ''") != DISENO_REF:
                    print('   · %s/%s: la página publicada todavía es la de antes' % (tipo, slug))
                    continue
                # las fuentes: el nombre se vuelve a medir cuando llegan (og_link.jsx), y medido antes se salía
                pag.evaluate('() => document.fonts.ready.then(() => 1)')
                pag.wait_for_timeout(500)
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
    # 🖼️ los carteles de perfil, de a `MAX_PERFIL`: primero los que nunca se armaron
    pf = [t for t in faltan if t[0] == 'perfil']
    if len(pf) > MAX_PERFIL and not solo:
        pf.sort(key=lambda t: t[1] in (est.get('perfil') or {}))
        quedan = set(id(t) for t in pf[:MAX_PERFIL])
        faltan = [t for t in faltan if t[0] != 'perfil' or id(t) in quedan]
    print('   🎁 miniaturas de los links: %d crews, links y perfiles, %d para armar ahora (%d perfiles esperan)'
          % (len(todos), len(faltan), max(0, len(pf) - MAX_PERFIL) if not solo else 0))
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
    f0 = {'k': 'ana', 'c': ['servidor', 'temporada'], 'cv': 'a1.b2'}
    ok(_carta('ana', f0, ['temporada', 'servidor']) == PUBLICA + '/ana/temporada.webp?v=a1' and _carta('x', {}, []) == '',
       'la carta del cartel: la primera en el orden de la vista previa, con su versión; sin carta, nada')
    import datetime
    hoy = datetime.datetime(2026, 11, 18, 3, 0, tzinfo=datetime.timezone.utc)
    cal = [{'t': (hoy - datetime.timedelta(hours=h)).strftime('%Y-%m-%dT%H:%M:%SZ')} for h in range(0, 42 * 4, 4)]
    cal.append({'t': (hoy - datetime.timedelta(days=9)).strftime('%Y-%m-%dT%H:%M:%SZ')})     # fuera de la semana
    L0 = {'calendario': cal, 'comunidad': {'personas': 21386},
          'paises': [{'cc': 'ar', 'n': 171}, {'cc': 'br', 'n': 900}, {'cc': 'co', 'n': 76}, {'cc': 'cl', 'n': 93}, {'cc': 'ae', 'n': 5}]}
    V = _vitrina(L0, hoy)
    ok(V == {'t': 40, 'm': 21000, 'b': ['ar', 'cl', 'co']},
       'la miniatura del link: 42 torneos en 7 días → 40, 21.386 → 21.000, banderas por raperos y sin Emiratos ni Brasil (%s)' % V)
    ok(_vitrina({}, hoy) == {'t': 0, 'm': 0, 'b': []}, 'sin lobby, ceros y sin banderas (la página esconde lo que no llega)')
    with io.open(os.path.join(BASE, 'web', 'src', 'og_link.jsx'), encoding='utf-8') as f:
        mj = re.search(r"export const DISENO_REF = '([^']+)'", f.read())
    ok(mj is not None and mj.group(1) == DISENO_REF,
       'DISENO_REF es el mismo acá y en og_link.jsx (si no, la página nunca «es la de ahora» y no sale ninguna foto)')
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
