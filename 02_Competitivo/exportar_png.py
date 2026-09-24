"""PNG de una carta con TODO lo que sobresale.
   Los chips van en right:-11px y los rombos en left:-10/-13px, o sea que
   viven FUERA de la caja de .card. Capturar el elemento los recorta.
   Hay que calcular la union de la carta con todos sus hijos y recortar ahi."""
import os as _o, sys as _s
# ⚠️ cp1252 no puede escribir un emoji, y el unico de este archivo esta
# en la linea que avisa que un avatar no cargo. Sin esto, el exportador
# termina bien cuando todo anda y se cae cuando hay algo que decir.
try:
    _s.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass
RAIZ = _o.path.dirname(_o.path.abspath(__file__))
_s.path.insert(0, _o.path.dirname(RAIZ))
from comun import respaldo
def _r(*p): return _o.path.join(RAIZ, *p)

UA={'User-Agent':'Mozilla/5.0'}
_cache={}
FALLIDAS={}   # url -> motivo, de todo lo que no se pudo embeber
def embed_all(html):
    """Chromium no llega al CDN desde el entorno: se embebe todo en base64.

       Lo que no baja queda anotado en FALLIDAS y se avisa al terminar. Antes
       se ponia src="" y listo: la carta salia sin foto y nadie se enteraba."""
    def emb(m):
        u=m.group(1)
        if u not in _cache:
            try:
                r=requests.get(u,headers=UA,timeout=30)
                if r.status_code!=200:
                    # la copia del repo antes de rendirse: ver comun/respaldo.py
                    _x=respaldo.para(u)
                    if _x: _cache[u]=_x; return 'src="%s"'%_x
                    FALLIDAS[u]='HTTP %d'%r.status_code; return 'src=""'
                _cache[u]='data:%s;base64,%s'%(r.headers.get('content-type','image/png').split(';')[0],
                                               base64.b64encode(r.content).decode())
            except Exception as e:
                _x=respaldo.para(u)
                if _x: _cache[u]=_x; return 'src="%s"'%_x
                FALLIDAS[u]=type(e).__name__; return 'src=""'
        return 'src="%s"'%_cache[u]
    return re.sub(r'src="(https?://[^"]+)"', emb, html)


def avisar_fallidas():
    """Sin esto la carta sale incompleta en silencio."""
    if not FALLIDAS: return
    print('AVISO: %d recurso(s) no se pudieron bajar, van con src="" (la carta '
          'sale sin esa imagen):' % len(FALLIDAS))
    for u,motivo in FALLIDAS.items():
        print('   %-10s %s' % (motivo,u))
    print('   Un 404 en un avatar suele ser que la persona cambio su foto: la URL')
    print('   del pool guarda un hash de Discord que caduca. Ver CLAUDE.md.')



import json, re, shutil, subprocess, asyncio, sys, base64, requests
from playwright.async_api import async_playwright

# el pool vive en datos/, una sola fuente de verdad: si cada carpeta tiene su
# copia, refrescar desde el Sheet no cambia las cartas y no avisa.
def _d(*p): return _o.path.join(_o.path.dirname(RAIZ), 'datos', *p)
def _pool():
    return {d['raw']:d for d in json.load(open(_d('competitivo_pool.json'), encoding='utf-8'))}


def armar_html(quien, D, callado=False):
    """Deja `_kn.html` listo para capturar. Devuelve su ruta.

    ⚠️ SEPARADO DEL NAVEGADOR A PROPOSITO, para poder exportar muchas con un
    solo Chromium: arrancarlo cuesta ~5 s. `03_Servidor/generar.py` y
    `04_Pais/exportar_png.py` ya lo hacian asi; este y el de Temporada eran
    los dos que faltaban.

    ⚠️ Lo que NO se movio: el calculo de la union y el recorte. Eso se queda
    tal cual estaba, porque cada numero de ahi costo una medicion.
    """
    shutil.copy(_r('comp.json'), _r('_cp2.json'))
    try:
        # ⚠️ LA COPIA DEL REPO ANTES DE ESCRIBIR comp.json, no despues.
        # `embed_all()` rescata del repo lo que da 404, pero eso solo actua
        # sobre `src="http..."`: a quien NO tiene URL en el pool no hay nada
        # que rescatarle y la carta salia con la inicial teniendo la foto en
        # disco. Le pasaba a 82 de 101. La regla vive en respaldo.avatar().
        # 🔴 QUIEN NO ESTA EN EL POOL SE DICE, NO SE REVIENTA. Esto hacia
        # `D[quien]` directo y tiraba `KeyError: 'Konan'` — un mensaje que
        # no dice **por que** no esta, y con el pool en cero no esta
        # nadie: la T1 arranco de cero el 22/09/2026 y cualquier llamada a
        # este exportador moria asi.
        #
        # ⚠️ NO LO TAPABA EL CICLO: `que_cambio.emitibles()` no pide la
        # Competitiva de quien no esta en el pool, asi que el crash
        # esperaba a quien la corriera a mano. Es el mismo caso que
        # `04_Pais/generar.py`, que moria en un `max()` vacio.
        #
        # ⚠️ Y NO CAMBIA NINGUN REQUISITO. El de la Competitiva son 10
        # eventos y vive en `comun/requisitos.py`; esto solo distingue
        # «no cumple» de «el pool esta vacio», que se veian igual.
        if quien not in D:
            raise SystemExit(
                '\n   %r no está en datos/competitivo_pool.json.\n'
                '   El pool tiene %d persona(s)%s\n'
                % (quien, len(D),
                   ': la temporada arrancó de cero, así que todavía no hay\n'
                   '   a quién dibujarle. No es un fallo.' if not D
                   else '. Probá con uno de: ' + ', '.join(sorted(D)[:6])))
        _p = dict(D[quien])
        _p['av'] = respaldo.avatar(_p.get('raw') or quien, _p.get('av') or '')
        json.dump([_p], open(_r('comp.json'),'w',encoding='utf-8'),
                  ensure_ascii=False, indent=1)
        # sys.executable y no 'python3': en Windows ese nombre es el stub de
        # la Store.
        _g=subprocess.run([sys.executable, _r('v2','gencomp.py')],
                          capture_output=True,text=True)
    finally:
        shutil.copy(_r('_cp2.json'), _r('comp.json'))  # restaurar SIEMPRE
        # ⚠️ Y BORRAR EL RESPALDO. Si queda, la proxima corrida lo pisa antes
        # de leerlo y el `finally` restaura una copia de esta corrida en vez de
        # la original — o sea que el mecanismo que protege comp.json deja de
        # protegerlo despues de la primera vez. Ademas `auditar.py` lo marcaba
        # como archivo duplicado, que es como se noto.
        try:
            _o.remove(_r('_cp2.json'))
        except OSError:
            pass
    if _g.returncode:
        raise SystemExit('gencomp.py fallo (codigo %d):\n%s'
                         % (_g.returncode, (_g.stderr or _g.stdout).strip()))

    h=open(_r('salida','tarjeta_competitiva.html'),encoding='utf-8').read()
    h=re.sub(r"@import url\([^)]*\);",'',h)
    # ⚠️ comun/fonts/, no 02_Competitivo/fonts/: habia una copia identica por
    # carta y la regla del proyecto es que lo compartido vive en comun/.
    h=h.replace('<style>','<style>'+open(_r('..','comun','fonts','embed.css'), encoding='utf-8').read(),1)
    open(_r('_kn.html'),'w',encoding='utf-8').write(embed_all(h))
    if not callado:
        avisar_fallidas()
    return _r('_kn.html')


async def _capturar(pg, SALIDA, callado=False):
        await pg.goto('file://'+_r('_kn.html')); await pg.wait_for_timeout(1200)
        await pg.add_style_tag(content='.card{filter:none!important}'
                                       'body{background:transparent!important}')
        await pg.wait_for_timeout(400)
        c=await pg.query_selector('.card')
        cb=await c.bounding_box()
        # union de la carta con todo lo que cuelga de ella
        x0,y0,x1,y1 = cb['x'], cb['y'], cb['x']+cb['width'], cb['y']+cb['height']
        # OJO: .rays tiene inset:-22% y su caja se sale 66px a cada lado,
        # pero queda recortada por el clip-path del escudo. Todo lo que vive
        # dentro de .clip no cuenta: solo importa lo que cuelga por fuera,
        # que son los chips (right:-11px) y los rombos (left:-10/-13px).
        for e in await c.query_selector_all('*'):
            # ademas de .clip, hay que saltear el SVG del marco: sus <path>
            # tienen stroke-width 27 y la caja se sale 54px a cada lado,
            # aunque el clip-path los recorte contra la silueta.
            saltar = await e.evaluate(
                "n=>!!n.closest('.clip') || n.namespaceURI!=='http://www.w3.org/1999/xhtml'")
            if saltar: continue
            k=await e.bounding_box()
            if not k or k['width']==0: continue
            x0=min(x0,k['x']); y0=min(y0,k['y'])
            x1=max(x1,k['x']+k['width']); y1=max(y1,k['y']+k['height'])
        if not callado:
            print('carta   : %.0f x %.0f' % (cb['width'], cb['height']))
            print('con todo: %.0f x %.0f   sobresale izq %.0f der %.0f arriba %.0f abajo %.0f'
                  % (x1-x0, y1-y0, cb['x']-x0, x1-(cb['x']+cb['width']),
                     cb['y']-y0, y1-(cb['y']+cb['height'])))
        m=4
        _o.makedirs(_o.path.dirname(SALIDA) or '.', exist_ok=True)
        await pg.screenshot(path=SALIDA, omit_background=True,
                            clip={'x':x0-m,'y':y0-m,'width':x1-x0+2*m,'height':y1-y0+2*m})


def _revisar(SALIDA, callado=False):
    """Las cuatro esquinas tienen que estar transparentes: si una esta opaca,
    lo que se capturo es una caja y no la silueta."""
    import numpy as np
    from PIL import Image
    a=np.array(Image.open(SALIDA).convert('RGBA')); H,W,_=a.shape
    sano = all(a[y,x,3]<10 for y,x in [(2,2),(2,W-3),(H-3,2),(H-3,W-3)])
    if not callado:
        print('PNG %dx%d  esquinas transparentes: %s' % (W,H,sano))
    return sano


async def _navegador(p):
    b=await p.chromium.launch(args=['--no-sandbox'])
    pg=await b.new_page(viewport={'width':760,'height':860}, device_scale_factor=3)
    return b, pg


async def main(quien, salida):
    armar_html(quien, _pool())
    async with async_playwright() as p:
        b, pg = await _navegador(p)
        await _capturar(pg, salida)
        await b.close()
    _revisar(salida)


async def varias(quienes, patron):
    """Un solo Chromium para muchas. `patron` lleva %s con el nombre."""
    D=_pool()
    hechas, malas = [], []
    async with async_playwright() as p:
        b, pg = await _navegador(p)
        for q in quienes:
            if q not in D:
                malas.append((q,'no esta en el pool')); continue
            sal = patron % q
            armar_html(q, D, callado=True)
            await _capturar(pg, sal, callado=True)
            if not _revisar(sal, callado=True):
                malas.append((q,'esquina opaca: se capturo una caja'))
            else:
                hechas.append(sal)
                print('   %-18s %s' % (q[:18], _o.path.basename(sal)))
        await b.close()
    for q,por in malas:
        print('   ⚠️ %-18s %s' % (q[:18], por))
    return hechas


def _patron():
    """El destino de siempre, con %s para el nombre."""
    return _o.path.join(_o.path.dirname(_o.path.abspath(__file__)),
                        'salida', 'competitivo_%s.png')


if __name__ == '__main__':
    if len(sys.argv)>1 and sys.argv[1]=='--todas':
        pat = sys.argv[2] if len(sys.argv)>2 else _patron()
        asyncio.run(varias(sorted(_pool()), pat))
    else:
        args = [a for a in sys.argv[1:] if not a.startswith('-')] or ['Konan']
        # 🔴 VARIOS NOMBRES SON VARIOS NOMBRES, NO UN NOMBRE Y UNA RUTA.
        # Ver el comentario largo en `01_Temporada/exportar_png.py`: los
        # dos tenian el mismo bug y costo 38 cartas el 23/09/2026.
        # Competitivo se llevo 28 de esas 38 porque su tanda es la mas
        # grande.
        if len(args) == 2 and args[1].lower().endswith('.png'):
            asyncio.run(main(args[0], args[1]))
        elif len(args) == 1:
            # ⚠️ El mismo destino y el mismo nombre que `--todas` — ver el
            # porque en 01_Temporada/exportar_png.py.
            asyncio.run(main(args[0], _patron() % args[0]))
        else:
            asyncio.run(varias(args, _patron()))
