# -*- coding: utf-8 -*-
"""📸 LAS FOTOS DEL RANKING GLOBAL (21/11/2026).

    python bot/global_fotos.py --probar DIR   baja y recorta las fotos de la tabla publicada en DIR (no sube nada)
    python bot/global_fotos.py --auto         self-check

Dlx, 21/11/2026: *«agrega fotos de perfil a los que puedas»* (y antes, de los gigantes: *«simplemente usamos fotos y ya
está»*). Los de la Liga ya tienen la suya (Discord, `liga.quien()` en la página); esto es para los de afuera:

    · fms.tv: la foto oficial de cada MC de sus ligas (`acf.grid_image`), un recorte con fondo transparente. Da dos
      piezas: el círculo de las listas (la cara, de arriba al centro) y el RETRATO entero, para el podio y el gigante.
    · Freestylestats: la foto de perfil. Su servidor de archivos la recorta y la achica (`?width=256&height=256&fit=cover`).

La oficial de fms.tv gana (la elige `identidades()` en global_ranking.py). YouTube y UrbanStreet no tienen foto por
persona: esos quedan con la inicial.

⚠️ LAS FOTOS VAN A R2, NUNCA AL REPO. La página no puede cargar imágenes de fms.tv ni de Freestylestats (su CSP sólo
deja Discord, YouTube y nuestro R2), y las fotos de gente real en el historial público quedarían para siempre, también
de quien después se vaya (CLAUDE.md). En el repo queda sólo `datos/global_fotos.json`: de qué foto salió cada archivo de
R2, así cada foto se baja UNA vez y la semana siguiente no se vuelve a pedir.

⚠️ SUBE SÓLO LA CORRIDA DE LOS LUNES (`global.yml`, con `--leer` y la credencial de Cloudflare en `.env`). Sin
credencial, `aplicar()` pone las que ya están subidas y no baja nada.
"""
import hashlib
import io
import json
import os
import sys
import time

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE not in sys.path:
    sys.path.insert(0, BASE)

MANIFIESTO = os.path.join(BASE, 'datos', 'global_fotos.json')
PUBLICA = 'https://pub-70d5821d06a8432c9cffd0c102195000.r2.dev'
CARPETA = 'global/fotos/'
CIRCULO = 256      # el lado del círculo (se dibuja a ~64 px como mucho: el doble para pantallas densas)
RETRATO = 520      # el alto del retrato de fms.tv (el podio lo dibuja a ~200 px)
LIMITE = 400       # fotos nuevas por corrida, como mucho
UA = {'User-Agent': 'Mozilla/5.0 (ranking global de freestyle)'}


def _leer():
    try:
        with io.open(MANIFIESTO, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def _escribir(m):
    with io.open(MANIFIESTO, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(m, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write('\n')


def clave(src):
    return hashlib.sha1(src.encode('utf-8')).hexdigest()[:16]


def es_fms(src):
    return 'fms.tv/' in src


def pedir_url(src):
    """Lo que se baja: Freestylestats ya recortado por su servidor; fms.tv, el original (el recorte es nuestro)."""
    if 'assets.freestylestats.com' in src:
        return src.split('?')[0] + '?width=%d&height=%d&fit=cover&format=webp' % (CIRCULO, CIRCULO)
    return src


def procesar(datos, src):
    """`(círculo, retrato o None)` en webp. El círculo de fms.tv es la cara: un cuadrado arriba al centro del recorte
    (el nombre va escrito abajo, en la foto, y no tiene que entrar)."""
    from PIL import Image
    im = Image.open(io.BytesIO(datos))
    im.load()
    retrato = None
    if es_fms(src):
        im = im.convert('RGBA')
        w, h = im.size
        lado = int(round(w * 0.70))
        x0, y0 = (w - lado) // 2, 0  # desde arriba: en varios recortes la cabeza toca el borde (Mecha)
        cara = im.crop((x0, y0, x0 + lado, y0 + lado))
        # el círculo va sobre un fondo: sin alfa, para que la cara no quede flotando en una lista clara
        fondo = Image.new('RGBA', cara.size, (24, 24, 26, 255))
        fondo.alpha_composite(cara)
        circ = fondo.convert('RGB').resize((CIRCULO, CIRCULO), Image.LANCZOS)
        r = im.resize((max(1, int(round(w * RETRATO / float(h)))), RETRATO), Image.LANCZOS) if h > RETRATO else im
        b = io.BytesIO()
        r.save(b, 'WEBP', quality=86, method=6)
        retrato = b.getvalue()
    else:
        im = im.convert('RGB')
        w, h = im.size
        lado = min(w, h)
        # una foto vertical tiene la cara arriba: el cuadrado sale del tercio de arriba, no del centro
        x0, y0 = (w - lado) // 2, 0 if h > w else (h - lado) // 2
        circ = im.crop((x0, y0, x0 + lado, y0 + lado)).resize((CIRCULO, CIRCULO), Image.LANCZOS)
    b = io.BytesIO()
    circ.save(b, 'WEBP', quality=84, method=6)
    return b.getvalue(), retrato


def _bajar(src):
    import requests
    r = requests.get(pedir_url(src), headers=UA, timeout=40)
    r.raise_for_status()
    if not r.headers.get('content-type', '').startswith('image/'):
        raise ValueError('no es una imagen: %s' % r.headers.get('content-type'))
    return r.content


def _sesion_r2():
    """La sesión de la API de R2, o None si no hay credencial (fuera de la corrida de los lunes)."""
    import requests
    import fotos as F
    tok = os.environ.get('CLOUDFLARE_API_TOKEN') or F.env('CLOUDFLARE_API_TOKEN', obligatorio=False)
    if not tok:
        return None
    s = requests.Session()
    s.headers['Authorization'] = 'Bearer ' + tok
    return s


def aplicar(out, fotos_de, subir=False, bajar=None, subir_a=None):
    """Pone `ft` (el círculo) y `fr` (el retrato, sólo de fms.tv) en cada fila de `out['g']` que tenga foto.

    `fotos_de`: {clave de la persona: la foto de origen}. Con `subir`, baja, recorta y sube las que no estén en el
    manifiesto (hasta `LIMITE`). `bajar` y `subir_a` se cambian en el self-check."""
    man = _leer()
    nuevas, malas = 0, []
    r2 = None
    if subir:
        bot = os.path.join(BASE, 'bot')
        if bot not in sys.path:
            sys.path.insert(0, bot)
        r2 = subir_a or _sesion_r2()
        if not r2:
            print('📸 sin credencial de Cloudflare: sólo las fotos que ya están subidas')
    for g in out.get('g') or []:
        src = fotos_de.get(g['k'])
        if not src:
            continue
        if src not in man and r2 and nuevas < LIMITE:
            try:
                circ, ret = procesar((bajar or _bajar)(src), src)
                k = clave(src)
                pares = [(CARPETA + k + '.webp', circ)] + ([(CARPETA + k + '-r.webp', ret)] if ret else [])
                for ruta, datos in pares:
                    if callable(r2):
                        r2(ruta, datos)
                    else:
                        import fotos as F
                        mal = F.subir(r2, ruta, datos)
                        if mal:
                            raise RuntimeError(mal)
                man[src] = {'c': pares[0][0], 'r': pares[1][0] if ret else None, 't': time.strftime('%Y-%m-%d')}
                nuevas += 1
                time.sleep(0.15)  # sin apurar a los servidores de afuera
            except Exception as e:  # noqa: BLE001 — una foto que no baja no frena el ranking: queda la inicial
                malas.append('%s (%s)' % (g['n'], str(e)[:60]))
        x = man.get(src)
        if x:
            g['ft'] = PUBLICA + '/' + x['c']
            if x.get('r'):
                g['fr'] = PUBLICA + '/' + x['r']
    if nuevas:
        _escribir(man)
    if subir:
        con = sum(1 for g in out.get('g') or [] if g.get('ft'))
        print('📸 %d fotos nuevas · %d personas con foto de afuera%s' % (
            nuevas, con, (' · no bajaron %d: %s' % (len(malas), ', '.join(malas[:5]))) if malas else ''))
    return nuevas


def probar(carpeta):
    """Baja y recorta las fotos que la tabla publicada pediría, en `carpeta`, sin subir nada (para mirarlas)."""
    sys.path.insert(0, os.path.join(BASE, 'bot'))
    import global_ranking as G
    previo = G._leer(G.BATALLAS, {}) or {}
    pros = G.pros_de(previo.get('plantel') or [], G._leer(G.PROS, {}))
    bs = G.deduplicar(previo.get('batallas') or [])
    de_id, personas = G.identidades(bs, previo.get('mvp') or [], G._leer(G.ALIAS, {}), extra=pros)
    os.makedirs(carpeta, exist_ok=True)
    n = 0
    for p in personas.values():
        if p.get('fo') and not p.get('lg'):
            circ, ret = procesar(_bajar(p['fo']), p['fo'])
            with open(os.path.join(carpeta, p['k'] + '.webp'), 'wb') as f:
                f.write(circ)
            if ret:
                with open(os.path.join(carpeta, p['k'] + '-r.webp'), 'wb') as f:
                    f.write(ret)
            n += 1
    print('%d fotos en %s' % (n, carpeta))


def _self_check():
    from PIL import Image
    mal = []
    # un recorte de fms.tv (vertical, con alfa) da círculo y retrato; una foto de perfil, sólo el círculo
    a = Image.new('RGBA', (424, 557), (0, 0, 0, 0))
    a.paste((200, 30, 30, 255), (100, 40, 320, 300))
    b = io.BytesIO()
    a.save(b, 'PNG')
    circ, ret = procesar(b.getvalue(), 'https://cdn.fms.tv/x/VENS.png')
    ci, re_ = Image.open(io.BytesIO(circ)), Image.open(io.BytesIO(ret))
    if ci.size != (CIRCULO, CIRCULO) or re_.size[1] != RETRATO or re_.mode != 'RGBA':
        mal.append('fms.tv: círculo %r, retrato %r %s' % (ci.size, re_.size, re_.mode))
    p = Image.new('RGB', (600, 900), (10, 120, 200))
    b = io.BytesIO()
    p.save(b, 'JPEG')
    circ, ret = procesar(b.getvalue(), 'https://assets.freestylestats.com/assets/abc')
    if ret is not None or Image.open(io.BytesIO(circ)).size != (CIRCULO, CIRCULO):
        mal.append('Freestylestats: sólo el círculo, de %d' % CIRCULO)
    if 'fit=cover' not in pedir_url('https://assets.freestylestats.com/assets/abc'):
        mal.append('Freestylestats se pide ya recortado')
    # aplicar(): con lo ya subido pone `ft`/`fr`; sube sólo lo nuevo, una vez; sin foto, nada
    global MANIFIESTO
    viejo = MANIFIESTO
    import tempfile
    MANIFIESTO = os.path.join(tempfile.mkdtemp(), 'm.json')
    try:
        subidas = []
        a.save(b := io.BytesIO(), 'PNG')
        out = {'g': [{'k': 'vens', 'n': 'Vens'}, {'k': 'nadie', 'n': 'Nadie'}]}
        fotos = {'vens': 'https://cdn.fms.tv/x/VENS.png'}
        aplicar(out, fotos, subir=True, bajar=lambda s: b.getvalue(), subir_a=lambda r, d: subidas.append(r))
        g = out['g']
        if not (g[0].get('ft', '').startswith(PUBLICA) and g[0].get('fr') and 'ft' not in g[1] and len(subidas) == 2):
            mal.append('aplicar con subida: %r · %r' % (g, subidas))
        out2 = {'g': [{'k': 'vens', 'n': 'Vens'}]}
        aplicar(out2, fotos, subir=True, bajar=lambda s: 1 / 0, subir_a=lambda r, d: subidas.append(r))
        if out2['g'][0].get('ft') != g[0]['ft'] or len(subidas) != 2:
            mal.append('la segunda vez no se baja ni se sube: %r' % subidas)
        out3 = {'g': [{'k': 'vens', 'n': 'Vens'}]}
        aplicar(out3, fotos, subir=False)
        if out3['g'][0].get('ft') != g[0]['ft']:
            mal.append('sin credencial, pone las que ya están subidas')
    finally:
        MANIFIESTO = viejo
    for m in mal:
        print('🔴 ' + m)
    print('✅ global_fotos: bien' if not mal else '🔴 global_fotos: %d problemas' % len(mal))
    return 1 if mal else 0


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if '--auto' in sys.argv:
        sys.exit(_self_check())
    if '--probar' in sys.argv:
        probar(sys.argv[sys.argv.index('--probar') + 1])
