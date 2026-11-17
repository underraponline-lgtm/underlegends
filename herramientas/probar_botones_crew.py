"""🧪 ¿Funciona cada botón de las crews? (15/11/2026, Dlx: «asegúrate que todos los botones de crew funcionen»). La página construida (bot/paginas), con la cuenta y el objeto simulados: cada clic
tiene que mandar al objeto la acción que corresponde. Nada llega al objeto de verdad: /api/avisos/crew* se contesta acá.

    python herramientas/probar_botones_crew.py      (antes, `npx vite build` en web/: prueba lo construido)
"""
import json, os, sys, time, mimetypes
from urllib.parse import urlparse, quote
from playwright.sync_api import sync_playwright

try:
    sys.stdout.reconfigure(encoding='utf-8')  # la consola de Windows no es UTF-8 y los nombres traen tildes y emojis
except Exception:
    pass

PAG = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'bot', 'paginas')
PROD = 'https://underlegends.pages.dev'
S = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'salida_botones_crew')
os.makedirs(S, exist_ok=True)
AHORA = int(time.time() * 1000)
DIA = 86400000
CREW = 'Desierto de Atacama'
CREW_OBJ = {'id': CREW, 'nombre': CREW, 'sigla': 'CZT', 'entrada': 'invitacion', 'oficial': False, 'creada': AHORA - 2 * DIA,
            'reps': [], 'gente': [['oasis', 'lider', AHORA - 2 * DIA], ['snow', 'colider', AHORA - DIA], ['six', 'veterano', AHORA - DIA],
                                  ['makmah', 'miembro', AHORA - DIA, AHORA + 3 * DIA]],
            'vence': 0, 'logo': 'esc:escudo.corona.e41373.0e0e10', 'desc': 'Del barrio pa’l mundo', 'req': {'rg': 'B', 'ev': 5}, 'fund': 'oasis'}
OTRA = {'id': 'Follombia', 'nombre': 'Follombia', 'sigla': 'FLB', 'entrada': 'pedido', 'oficial': True, 'creada': AHORA - 30 * DIA, 'reps': [],
        'gente': [['prosu', 'lider', 1], ['vlade', 'miembro', 1]], 'vence': 0, 'logo': '', 'desc': 'La crew de Colombia', 'req': {}, 'fund': ''}
LISTA = {'t': AHORA, 'max': 20, 'precio': 2500, 'ranking': {'modo': 'reps', 'n': 5}, 'crews': [CREW_OBJ, OTRA]}


def mia_lider():
    return {'ok': True, 'de': 'oasis', 'rol': 'lider', 'crew': CREW_OBJ, 'pedidos': [{'k': 'liberia', 't': AHORA - DIA}],
            'invitados': [{'k': 'tam', 'de': 'oasis', 't': AHORA - 3 * DIA}], 'links': [], 'max': 20, 'precio': 2500,
            'precio_nombre': 1000, 'precio_logo': 1000, 'saldo': 9000, 'espera_ms': 0, 'inv': [], 'ped': [], 'recibe': True}


def mia_afuera(con_inv=False):
    return {'ok': True, 'de': 'erian', 'crew': None, 'max': 20, 'precio': 2500, 'saldo': 9000, 'espera_ms': 0, 'recibe': True,
            'inv': [{'crew': CREW, 'de': 'oasis', 't': AHORA - DIA, 'nombre': CREW}] if con_inv else [], 'ped': []}


def correr(pw, quien, mia, ruta, pasos):
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={'width': 1375, 'height': 1000}, bypass_csp=True)
    mandados = []

    def servir(route, request):
        u = urlparse(request.url)
        if u.netloc != 'liga.test':
            return route.continue_()
        if u.path == '/api/avisos/crews':
            return route.fulfill(status=200, body=json.dumps(LISTA), headers={'content-type': 'application/json'})
        if u.path == '/api/avisos/crew-mia':
            return route.fulfill(status=200, body=json.dumps(mia), headers={'content-type': 'application/json'})
        if u.path == '/api/avisos/crew':
            d = request.post_data_json or {}
            d = {k: v for k, v in d.items() if k not in ('token',)}
            mandados.append(d)
            r = {'ok': True}
            if d.get('accion') == 'link_crear':
                r.update(cod='abcdefghjk', vence=AHORA + 7 * DIA, max=d.get('max', 0))
            if d.get('accion') == 'crear':
                r.update(crew=d.get('nombre'), saldo=6500, precio=2500, vence=0, logo='ok')
            return route.fulfill(status=200, body=json.dumps(r), headers={'content-type': 'application/json'})
        if u.path.startswith('/api/'):
            if request.method != 'GET':
                return route.fulfill(status=200, body='{"ok":true}', headers={'content-type': 'application/json'})
            return route.fulfill(response=route.fetch(url=PROD + u.path + ('?' + u.query if u.query else '')))
        p = os.path.join(PAG, u.path.lstrip('/').replace('/', os.sep))
        if not os.path.isfile(p):
            p = os.path.join(PAG, 'index.html')
        tipo = 'text/javascript' if p.endswith('.js') else (mimetypes.guess_type(p)[0] or 'application/octet-stream')
        route.fulfill(status=200, body=open(p, 'rb').read(), headers={'content-type': tipo})

    ctx.route('**/*', servir)
    dc = {'id': '700000000000000001', 'clave': quien, 'n': quien.capitalize()}
    ctx.add_init_script("try{localStorage.setItem('lg:visita','2026-11-10');localStorage.setItem('lg:carga',String(Date.now()));"
                        "localStorage.setItem('lg:cambios',JSON.stringify('9.99'));localStorage.setItem('lg:tuto',JSON.stringify({hecho:1}));"
                        "localStorage.setItem('lg:dc'," + json.dumps(json.dumps(dc)) + ")}catch(e){}")
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://liga.test' + ruta, wait_until='load')
    pg.wait_for_function("document.documentElement.classList.contains('lg-fuera')", timeout=40000)
    pg.wait_for_timeout(3500)
    R = pg.locator('#inicio-nuevo')
    resultados = []
    for nombre, hacer, espera in pasos:
        antes = len(mandados)
        try:
            hacer(pg, R)
            pg.wait_for_timeout(700)
            nuevos = mandados[antes:]
            ok = espera(nuevos) if callable(espera) else (espera in [json.dumps(x, sort_keys=True) for x in nuevos])
            resultados.append((ok, nombre, nuevos))
        except Exception as e:
            resultados.append((False, nombre, 'ERROR ' + str(e)[:160]))
    pg.screenshot(path=os.path.join(S, 'crew_%s.png' % quien), full_page=False)
    b.close()
    return resultados, errs


def boton(texto, n=0):
    return lambda pg, R: R.get_by_role('button', name=texto, exact=True).nth(n).click()


def dos_toques(texto, confirmar, n=0):
    def f(pg, R):
        R.get_by_role('button', name=texto, exact=True).nth(n).click()
        pg.wait_for_timeout(200)
        R.get_by_role('button', name=confirmar, exact=True).first.click()
    return f


def es(**kw):
    return lambda xs: any(all(x.get(k) == v for k, v in kw.items()) for x in xs)


def texto(t):
    return lambda pg, R: R.get_by_text(t).first.wait_for(timeout=4000)


ruta_crew = '/freestyle-rap/crew/' + quote(CREW)

with sync_playwright() as pw:
    # ⚙️ 16/11/2026: el panel de quien manda se mudó a su página, Ajustes, una sección por pantalla (crew2.jsx)
    def en(sec, f):
        def g(pg, R):
            pg.evaluate("(h) => { location.hash = h }", '#/crew/' + quote(CREW) + '/ajustes/' + sec)
            pg.wait_for_timeout(700)
            return f(pg, R)
        return g
    pasos_lider = [
        ('se ven los consejos', en('consejos', texto('Consejos para tu crew')), lambda xs: True),
        ('consejo «Abrirla» abre la crew', en('consejos', boton('Abrirla')), es(accion='entrada', entrada='abierta')),
        ('«Copiar el link» arma uno hasta que se llene', en('invitar', boton('Copiar el link')), es(accion='link_crear', max=0)),
        ('Invitar a un sugerido', en('invitar', lambda pg, R: R.locator('.cw-sug li .btn').first.click()), es(accion='invitar')),
        ('Cancelar una invitación (dos toques)', en('invitar', dos_toques('Cancelar', '¿Cancelarla?')), es(accion='desinvitar', a='tam')),
        ('Aceptar un pedido', en('pedidos', lambda pg, R: R.locator('#cw-pedidos .btn.verde').first.click()), es(accion='decidir', a='liberia', si=True)),
        ('Rechazar un pedido', en('pedidos', lambda pg, R: R.locator('#cw-pedidos .btn.borde2').first.click()), es(accion='decidir', a='liberia', si=False)),
        ('Cambiar el rango', en('gente', lambda pg, R: R.get_by_label('El rango de Six', exact=False).select_option('miembro')), es(accion='rol', a='six', rol='miembro')),
        ('Hacer Líder (dos toques)', en('gente', dos_toques('Hacer Líder', '¿Seguro?')), es(accion='lider')),
        ('Sacar (dos toques)', en('gente', dos_toques('Sacar', '¿Sacarlo?')), es(accion='sacar')),
        ('Elegir un representante', en('reps', lambda pg, R: R.locator('#cw-reps input[type=checkbox]').first.click()), es(accion='reps')),
        ('Cómo se entra: con pedido', en('entrada', lambda pg, R: R.locator('input[name=cw-entrada]').nth(1).click()), es(accion='entrada', entrada='pedido')),
        ('Requisitos: guardar', en('entrada', lambda pg, R: (R.locator('#cw-req + form select').select_option('A'), R.locator('#cw-req + form button[type=submit]').click())),
         lambda xs: any(x.get('accion') == 'req' and x.get('req', {}).get('rg') == 'A' for x in xs)),
        ('El nombre: guardar', en('crew', lambda pg, R: (R.get_by_label('La sigla').fill('CZD'), R.get_by_role('button', name='Guardar · 1.000').click())),
         es(accion='nombre', sigla='CZD')),
        # 🧩 16/11/2026: con un escudo, la pestaña abre en «Armar escudo»; se elige una división y se guarda el código largo
        ('El escudo armado', en('crew', lambda pg, R: (R.get_by_role('radio', name='Partido').click(), pg.wait_for_timeout(200),
                                             R.get_by_role('button', name='Usar este escudo · 1.000').click())),
         lambda xs: any(x.get('accion') == 'logo' and str(x.get('escudo', '')).startswith('esc:escudo.corona.e41373.0e0e10.partido.fino.') for x in xs)),
        ('Pestaña «Subir mi logo»', en('crew', lambda pg, R: (R.get_by_role('tab', name='🖼️ Subir mi logo').click(), pg.wait_for_timeout(200),
                                                   R.locator('.cw-logo-el input[type=file]').count())),
         lambda xs: True),
        ('La descripción: guardar', en('crew', lambda pg, R: (R.get_by_label('La descripción de la crew').fill('Los del desierto, rimando fuerte'),
                                                    R.locator('form:has(textarea[aria-label="La descripción de la crew"]) button').click())),
         es(accion='desc', desc='Los del desierto, rimando fuerte')),
        ('Más links: uno para 5', en('invitar', lambda pg, R: (R.locator('.cw-mas-links summary').click(), pg.wait_for_timeout(200),
                                                 R.get_by_label('Para cuántos sirve el link').select_option('5'), R.get_by_role('button', name='Armar link').click())),
         es(accion='link_crear', max=5)),
    ]
    pasos_afuera = [
        ('Aceptar la invitación', boton('Aceptar la invitación'), es(accion='responder', crew=CREW, si=True)),
        ('No, gracias', boton('No, gracias'), es(accion='responder', crew=CREW, si=False)),
    ]
    pasos_link = [('Entrar con el link', boton('Entrar con el link'), es(accion='link_unirse', cod='abcdefghjk'))]
    pasos_pedir = [('Pedir entrar a otra crew', lambda pg, R: R.get_by_role('button', name='Pedir entrar').first.click(), es(accion='pedir', crew='Follombia'))]
    pasos_cuenta = [('Recibir invitaciones: apagar', lambda pg, R: R.get_by_label('Recibir invitaciones de otras crews').click(), es(accion='pref_inv', si=False))]
    pasos_fundar = [('Fundar una crew', lambda pg, R: (R.locator('.cw-armar input').first.fill('Los del Sur'), R.get_by_role('button', name='Fundar · 2.500 Puntos de Tienda').click()),
                     lambda xs: any(x.get('accion') == 'crear' and x.get('nombre') == 'Los del Sur' and str(x.get('escudo', '')).startswith('esc:') for x in xs))]
    total, fallas = 0, 0
    casos = [('oasis', mia_lider(), ruta_crew, pasos_lider), ('erian', mia_afuera(True), ruta_crew, pasos_afuera),
             ('erian', mia_afuera(), ruta_crew + '?u=abcdefghjk', pasos_link), ('erian', mia_afuera(), '/freestyle-rap/crew/Follombia', pasos_pedir),
             ('oasis', mia_lider(), '/cuenta/crew', pasos_cuenta), ('erian', mia_afuera(), '/freestyle-rap/crews?armar=1', pasos_fundar)]
    for quien, mia, ruta, pasos in casos:
        res, errs = correr(pw, quien, mia, ruta, pasos)
        print('\n── %s en %s' % (quien, ruta))
        for ok, nombre, nuevos in res:
            total += 1
            fallas += 0 if ok else 1
            print(('   ✓ ' if ok else '   🔴 ') + nombre + ('' if ok else '  → ' + json.dumps(nuevos, ensure_ascii=False)[:220]))
        if errs:
            print('   errores de la página:', errs[:3])
    print('\n%d de %d bien' % (total - fallas, total))
    sys.exit(1 if fallas else 0)
