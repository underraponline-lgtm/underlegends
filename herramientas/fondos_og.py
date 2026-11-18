# -*- coding: utf-8 -*-
"""🎬 LOS FONDOS DE LAS MINIATURAS TIPO CINE (18/11/2026): un momento real de batalla, en blanco y negro, ya encuadrado
para 1200 × 630 con la cara arriba y fuera del texto, en R2 (`og/fondos/<temporada>/<clave>.webp`, 1800 × 945).

    python herramientas/fondos_og.py            hornea los fondos de `FONDOS` y los sube
    python herramientas/fondos_og.py inicio pais   sólo ésos
    python herramientas/fondos_og.py --ver      los deja en salida_og/fondos/, sin subir (para mirarlos)

Dlx, 18/11/2026, de las miniaturas de las páginas: *«en general me gusta más eso de estilo cine»*, *«alzar el brillo a
algunas y que te asegures que se vea la persona un poco»*, *«evitemos repetir personas»* y *«elige frames nítidos»*.
Las maquetas (las 20 páginas y la invitación): https://claude.ai/artifact/AB6H3Gn4nU7GK8iy12wwPL. Las dibuja la página
(`web/src/og_link.jsx`, `Cine` y `Ref`) y les saca la foto `bot/og_links.py`, en el ciclo; esto sólo prepara el fondo.

🎞️ DE DÓNDE SALEN LOS CUADROS (`og/cuadros/<temporada>/<cuadro>.webp`, en blanco y negro): de los momentos de «La
batalla» de la pantalla de carga (web/carga.json) y de los tramos de la intro que ya tienen su segundo marcado
(herramientas/bienvenida_video.py: Velatz, Ardean, BTRX, Jere, Guty, DEM, Liga Inmortal…), más el de Oasis con la boca
cerrada. De cada momento se tomó el cuadro MÁS NÍTIDO midiendo la cara cuadro por cuadro en el segundo de alrededor, y
los de 1080p pasaron por Real-ESRGAN ×4 (como la pantalla de carga). La marca de agua del canal va borroneada.
⚠️ NO VAN AL REPO: son caras de gente real. Viven en R2, como los fondos de la pantalla de carga.

👤 UNA PERSONA DISTINTA EN CADA PÁGINA. Las de servidor y país (con carta a la derecha) rotan entre los fondos de
`COLUMNA`; las de llave y liga (afiche, sin carta), entre los de `AFICHE` (ver `fondo_de()`).

📐 Cada fondo es un RECORTE del cuadro (fracciones x0, y0, x1, y1) y su LUZ (brillo; el contraste va siempre a 1,04).
Los recortes se midieron sobre las maquetas: la cara arriba, los ojos nunca debajo del texto ni de una carta.
"""
import io
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, 'herramientas'))
sys.path.insert(0, BASE)
from comun.temporada import ACTUAL  # noqa: E402

PUBLICA = 'https://pub-70d5821d06a8432c9cffd0c102195000.r2.dev'
TAM = (1800, 945)

#: clave: (cuadro, x0, y0, x1, y1, luz). Las claves de las páginas son las de `PAGINAS` de bot/paginas/_worker.js
FONDOS = {
    'inicio': ('kainheat3n', 0.0533, 0.3221, 0.72, 0.9447, 1.0),           # Heat (BVS Network)
    'ranking': ('kourier', 0.375, 0.35, 1.0, 0.9333, 1.45),                # Kourier (KO Liga de Batallas)
    'eventos': ('sombra4n', 0.0863, 0.1651, 0.8006, 0.8317, 1.0),          # Sombra (BVS Network)
    'ligas': ('ardean', 0.1506, 0.1122, 0.8649, 0.7788, 1.0),              # Sailuker
    'tarjetas': ('velatz', 0.1731, 0.1128, 0.9423, 0.8303, 1.0),           # Liga Inmortal
    'pase': ('zaylax3', 0.0, 0.3333, 0.7143, 1.0, 1.22),                   # BVS Network
    'tienda': ('sol3', 0.1673, 0.2646, 0.8815, 0.9312, 1.22),              # Sol (Estrellas del Flow)
    'publicaciones': ('sol2', 0.0, 0.2334, 0.8, 0.9799, 1.3),              # Estrellas del Flow
    'socios': ('kainheatn', 0.0887, 0.1947, 0.803, 0.8614, 1.0),           # Kain (BVS Network)
    'guia': ('jere', 0.0983, 0.0652, 0.765, 0.6877, 1.0),                  # BVS Network
    'salon': ('oasis', 0.0, 0.2031, 0.7407, 0.8946, 1.0),                  # Oasis, con la boca cerrada
    'crews': ('capucha_cruz', 0.05, 0.2102, 0.675, 0.7935, 1.0),           # Liga Inmortal
    'cuenta': ('gorro_gris', 0.315, 0.2185, 0.815, 0.6852, 1.0),           # Combate Mortal Freestyle
    'cambios': ('btrx_lentes', 0.0205, 0.0583, 0.7897, 1.0, 1.0),          # Brócoli Cup
    'socio': ('guty', 0.0, 0.0746, 0.7407, 0.7662, 1.0),                   # Skyline Freestyle
    'pais': ('liberia2', 0.4118, 0.3467, 1.0, 0.8955, 1.35),               # Liberia (El Potrero)
    'servidor': ('zaylax2', 0.194, 0.3333, 0.9083, 1.0, 1.22),             # Zaylax (BVS Network)
    'llave': ('makma4', 0.0224, 0.2141, 0.7917, 0.9317, 1.4),              # el rival de Makmah (Falcon Music Colima)
    'perfil': ('makma2', 0.225, 0.2614, 0.9393, 0.928, 1.22),              # Makmah (Falcon Music Colima)
    'liga': ('camo', 0.0875, 0.1787, 0.7125, 0.762, 1.0),                  # DEM Battles
    'invita_a': ('ardean_rival', 0.1899, 0.1249, 0.9042, 0.7915, 1.25),    # la invitación con carta (Sailuker)
    'invita_b': ('sombra5_b', 0.0, 0.2646, 0.7143, 0.9312, 1.35),          # la invitación sin carta (BVS Network)
}
#: los de la cara arriba al medio, para las que llevan carta a la derecha (servidor y país)
COLUMNA = ('servidor', 'pais', 'ranking', 'tarjetas', 'socios', 'guia', 'perfil')
#: los de afiche, para las que llevan el título a lo ancho (llave y liga)
AFICHE = ('llave', 'liga', 'eventos', 'ligas', 'crews', 'cuenta', 'cambios', 'socio', 'pase', 'tienda', 'publicaciones')


def fondo_de(tipo, i):
    """Qué fondo lleva la `i`-ésima de un tipo: servidor y país rotan entre `COLUMNA` (el país arranca en el suyo, Liberia
    en El Potrero), llave y liga entre `AFICHE`. Lo usa bot/og_links.py"""
    if tipo == 'sv':
        return COLUMNA[i % len(COLUMNA)]
    if tipo == 'pais':
        return COLUMNA[(i + 1) % len(COLUMNA)]
    if tipo == 'liga':
        return AFICHE[(i + 1) % len(AFICHE)]
    return AFICHE[i % len(AFICHE)]


def hornear(clave):
    """El fondo de `clave`, de 1800 × 945, desde su cuadro de R2"""
    import requests
    from PIL import Image, ImageEnhance
    cuadro, x0, y0, x1, y1, luz = FONDOS[clave]
    r = requests.get('%s/og/cuadros/%s/%s.webp' % (PUBLICA, ACTUAL, cuadro), timeout=60)
    r.raise_for_status()
    im = Image.open(io.BytesIO(r.content)).convert('L')
    w, h = im.size
    c = im.crop((round(x0 * w), round(y0 * h), round(x1 * w), round(y1 * h))).resize(TAM, Image.LANCZOS)
    c = ImageEnhance.Contrast(ImageEnhance.Brightness(c).enhance(luz)).enhance(1.04)
    buf = io.BytesIO()
    c.convert('RGB').save(buf, 'WEBP', quality=88, method=6)
    return buf.getvalue()


def _self_check():
    malos = 0

    def ok(c, que):
        nonlocal malos
        print('  %s %s' % ('✅' if c else '❌', que))
        if not c:
            malos += 1
    ok(all(0 <= v[1] < v[3] <= 1 and 0 <= v[2] < v[4] <= 1 for v in FONDOS.values()), 'cada recorte está adentro de su cuadro')
    ok(all(c in FONDOS for c in COLUMNA + AFICHE), 'los fondos que rotan existen')
    personas = [v[0] for k, v in FONDOS.items()]
    ok(len(personas) == len(set(personas)), 'una persona distinta en cada fondo (%d)' % len(set(personas)))
    ok(fondo_de('sv', 0) == 'servidor' and fondo_de('pais', 0) == 'pais' and fondo_de('llave', 0) == 'llave' and fondo_de('liga', 0) == 'liga',
       'el primero de cada tipo lleva el suyo (el servidor de la maqueta, Liberia para el país…)')
    print('\n%s' % ('✅ los fondos de cine' if not malos else '❌ %d falla(s)' % malos))
    return 1 if malos else 0


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        return _self_check()
    claves = [a for a in sys.argv[1:] if not a.startswith('--')] or list(FONDOS)
    ver = '--ver' in sys.argv
    if ver:
        d = os.path.join(BASE, 'salida_og', 'fondos')
        os.makedirs(d, exist_ok=True)
        for k in claves:
            with open(os.path.join(d, k + '.webp'), 'wb') as f:
                f.write(hornear(k))
            print('  ·', k)
        return 0
    import requests
    import bienvenida_video as bv
    s = requests.Session()
    s.headers['Authorization'] = 'Bearer ' + bv.token()
    malos = 0
    for k in claves:
        datos = hornear(k)
        r = s.put('%s/objects/og/fondos/%s/%s.webp' % (bv.API_R2, ACTUAL, k), data=datos, headers={'Content-Type': 'image/webp'}, timeout=120)
        print('  %s %-14s %d KB' % ('✅' if r.status_code < 300 else '🔴 %d' % r.status_code, k, len(datos) // 1024))
        malos += r.status_code >= 300
    return 1 if malos else 0


if __name__ == '__main__':
    sys.exit(main())
