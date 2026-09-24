"""Los nueve escudos, todos con la misma calidad, tamano y circunferencia.

EL PROBLEMA: cada archivo viene distinto. TFC es 291x261 y su marca ocupa
casi todo; FT es 1080x1080 con el circulo centrado y aire alrededor; SR y
URBF son transparentes, asi que dentro de un circulo se ve el color de la
carta detras y no se leen como moneda. Puestos todos al mismo ancho, unos
llenan y otros flotan.

LA SOLUCION: normalizar por TINTA, no por caja. Se recorta al contenido, se
escala para que la tinta cubra la MISMA fraccion del disco en los nueve, y se
compone sobre un disco opaco del color de fondo del propio logo. Salida
uniforme: 512x512, disco completo, misma proporcion de marca.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SRC = os.path.join(BASE, 'comun', 'logos_color')
DST = os.path.join(BASE, 'comun', 'escudos_norm')
os.makedirs(DST, exist_ok=True)

LADO = 512
OCUPA = 0.70        # que fraccion del diametro ocupa la tinta, igual en los nueve

# fondo del disco cuando el logo es transparente y no trae uno propio
FONDO_MANUAL = {'SR': (26, 18, 8), 'URBF': (22, 22, 28), 'FRZ': (10, 20, 24)}


def caja_tinta(a):
    """La caja de lo que NO es fondo."""
    h, w = a.shape[:2]
    if (a[:, :, 3] < 250).mean() > 0.02:
        m = a[:, :, 3] > 40
    else:
        borde = np.concatenate([a[0, :, :3], a[-1, :, :3], a[:, 0, :3], a[:, -1, :3]])
        fondo = np.median(borde, axis=0)
        m = np.abs(a[:, :, :3].astype(int) - fondo).sum(axis=2) > 55
    ys, xs = np.where(m)
    if not len(xs):
        return 0, 0, w, h
    # 99.4% central: ignora salpicaduras suelta
    x0, x1 = np.percentile(xs, [0.3, 99.7]).astype(int)
    y0, y1 = np.percentile(ys, [0.3, 99.7]).astype(int)
    return x0, y0, x1, y1


def color_disco(sv, a):
    if (a[:, :, 3] < 250).mean() > 0.02:
        return FONDO_MANUAL.get(sv, (20, 20, 26))
    b = np.concatenate([a[0, :, :3], a[-1, :, :3], a[:, 0, :3], a[:, -1, :3]])
    return tuple(np.median(b, axis=0).astype(int))


print('%-6s %-12s %-18s %-9s %s' % ('sv', 'origen', 'caja de tinta', 'escala', 'disco'))
print('-' * 66)
for f in sorted(os.listdir(SRC)):
    sv = os.path.splitext(f)[0].upper()
    if sv.endswith('_ALT') or sv.endswith('_ANIMADO') or f.lower().endswith('.gif'):
        continue      # el gif se guarda por si la carta alguna vez es animada
    im = Image.open(os.path.join(SRC, f)).convert('RGBA')
    a = np.array(im)
    x0, y0, x1, y1 = caja_tinta(a)
    mw, mh = max(x1-x0, 1), max(y1-y0, 1)
    rec = im.crop((x0, y0, x1+1, y1+1))

    # escalar para que el lado mayor de la tinta ocupe OCUPA del diametro
    esc = (LADO * OCUPA) / max(mw, mh)
    nw, nh = max(int(mw*esc), 1), max(int(mh*esc), 1)
    rec = rec.resize((nw, nh), Image.LANCZOS)

    # disco opaco
    disco = Image.new('RGBA', (LADO, LADO), (0, 0, 0, 0))
    d = ImageDraw.Draw(disco)
    col = color_disco(sv, a)
    d.ellipse([0, 0, LADO-1, LADO-1], fill=col + (255,))

    # un pelo de brillo arriba, para que se lea como moneda y no como parche
    br = Image.new('L', (LADO, LADO), 0)
    ImageDraw.Draw(br).ellipse([int(LADO*.10), int(LADO*.04), int(LADO*.90), int(LADO*.52)], fill=42)
    br = br.filter(ImageFilter.GaussianBlur(LADO*0.10))
    disco = Image.alpha_composite(disco, Image.merge('RGBA', (
        Image.new('L', (LADO, LADO), 255), Image.new('L', (LADO, LADO), 255),
        Image.new('L', (LADO, LADO), 255), br)))

    disco.alpha_composite(rec, ((LADO-nw)//2, (LADO-nh)//2))

    # recortar al circulo, por si el brillo se paso
    mask = Image.new('L', (LADO, LADO), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, LADO-1, LADO-1], fill=255)
    out = Image.new('RGBA', (LADO, LADO), (0, 0, 0, 0))
    out.paste(disco, (0, 0), mask)
    out.save(os.path.join(DST, 'sv_%s.png' % sv.lower()))

    print('%-6s %-12s %-18s %-9s %s' % (sv, '%dx%d' % im.size, '%dx%d' % (mw, mh),
                                        '%.2fx' % esc, '#%02X%02X%02X' % col))

print()
print('-> comun/escudos_norm/  ·  9 discos de %dx%d, tinta al %.0f%% en todos'
      % (LADO, LADO, OCUPA*100))
