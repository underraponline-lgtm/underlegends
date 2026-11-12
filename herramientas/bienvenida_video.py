"""El video de fondo de la bienvenida: los tramos, cómo se arma y cómo se sube a R2.

🎬 Dlx, 12/11/2026: «un video en blanco y negro de fondo… de gente rapeando en cámara lenta que cambien», y a la
maqueta: «está muchísimo mejor». Los links de los suyos los pasó él («Sombra … Eucalipto»); los demás salieron de
buscar en YouTube a los 741 del ranking y quedarse con los videos en los que el RIVAL también es de los nuestros
(«los conozco a todos esos excepto a Andres #50, pero se ven legit»).

⚠️ EL VIDEO NO VA AL REPO: son caras de gente real, y el historial de un repo público las vuelve permanentes, también
para quien después se vaya (la misma razón que `comun/fotos/`). Vive en R2, bajo `bienvenida/`, y la página lo pide de
ahí (`liga.d.r2`). Si un rapero pide salir, se rearma sin su tramo y se vuelve a subir.

⚠️ LOS CLIPS SON DE OTROS CANALES. La bienvenida los nombra (`CREDITOS`, que la página lee de acá vía
`bienvenida/creditos.json`): BVS Network, Liga Inmortal, DEM Battles…

uso:
  python herramientas/bienvenida_video.py --armar <carpeta>   # baja los tramos y arma el montaje (yt-dlp + ffmpeg)
  python herramientas/bienvenida_video.py --armar <carpeta> --hd   # el de 1280 × 720, para la compu
  python herramientas/bienvenida_video.py --subir <carpeta>   # sube montaje, póster y cuadros a R2
  python herramientas/bienvenida_video.py                     # sólo lista los tramos

⚙️ `--armar` pide yt-dlp (pip) y ffmpeg (winget Gyan.FFmpeg) instalados; `--subir`, CLOUDFLARE_API_TOKEN en el
entorno o en el `.env` de la raíz. Ninguno corre en el ciclo: el video se arma una vez por temporada.
"""
import io, json, os, subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMP = 't1'                      # una versión por temporada: la de la T2 no pisa la de la T1
CLAVE = 'bienvenida/%s/' % TEMP
CUENTA = 'a85733396fd158a8e9660b02e20f33c8'
API_R2 = 'https://api.cloudflare.com/client/v4/accounts/%s/r2/buckets/cartas' % CUENTA

# (video de YouTube, segundo de arranque, quién, canal). El orden es el del montaje: alterna día y noche y países
TRAMOS = [
    ('B2OyIluaMF8', 104, 'Kain', 'BVS Network'),
    ('eariGFs-TEM', 115, 'SOL', 'BLDC Freestyle'),
    ('7lIj3Cva3qc', 100, 'Zaylax', 'BVS Network'),
    ('kommY3DfdJQ', 150, 'Sombra', 'BVS Network'),          # Dlx: «subir otro clip de Sombra» (primer plano, rapeando)
    ('CD9HicZ0bU4', 644, 'Panchok', 'DEM Battles'),
    ('NWO5AIKRzHw', 280, 'Makma', 'Falcon Music Colima'),
    ('TV_ED82CTSY', 458, 'Velatz y Oasis', 'Liga Inmortal'),
    ('dlfZzEmTmqU', 247, 'Kourier', 'KO Liga de Batallas'),
    ('FS4Tgq_L7-Q', 144, 'Ragna', 'Centro Freestyle'),
    ('kommY3DfdJQ', 30, 'Sombra', 'BVS Network'),
    ('Ots-VZArPec', 101, 'Masino', 'Liga Inmortal'),
    ('hR4EH1DvwKA', 312, 'Liberia', 'El Potrero'),
    ('VPmTbzBQw_U', 201, 'ARDEAN', 'Sailuker'),
    ('B2OyIluaMF8', 46, 'Heat', 'BVS Network'),
    ('TFEKarAqshA', 59, 'BTRX', 'Brócoli Cup'),
    ('4lhocjDBorw', 84, 'Eucalipto', 'Amazonas Freestyle'),
    ('SAcJNMMufRc', 151, 'Letrao y Berrun', 'Liga Inmortal'),
    ('fw6yDSUo288', 301, 'Sombra, Heat y Jere', 'BVS Network'),
    ('g7CiQ8fjo5A', 204, 'Sainos y Chase', 'Combate Mortal Freestyle'),
    ('B8113ZFfbzI', 140, 'Guty y Andres', 'Skyline Freestyle'),
]
SEG, LENTO, XF, W, H = 1.5, 2.0, 0.4, 640, 360   # 1,5 s del original, cámara lenta ×2, fundidos de 0,4 s
# 💡 LOS OSCUROS, MÁS CLAROS (Dlx, 12/11/2026: «a los que están un poco oscuros podrías subirles un poquito el brillo»).
# Se mide el gris medio de cada tramo y, si queda por debajo de LUZ, se le sube con gamma hasta ahí: los claros no se
# tocan, y la gamma levanta los medios sin quemar las luces (subir el brillo parejo lavaba los negros)
LUZ, GAMMA_MAX = 92, 1.9
# ⚠️ AL REARMAR, subir `VV` en web/src/bienvenida.jsx: se sube con el mismo nombre y si no, se sigue viendo el de antes
QUIETOS = (7.4, 20.2, 42.6)                         # los cuadros que rellenan «LIGA GLOBAL»
CREDITOS = sorted({t[3] for t in TRAMOS}, key=lambda c: (-sum(1 for t in TRAMOS if t[3] == c), c))


def ffmpeg():
    links = os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe')
    return links if os.path.exists(links) else 'ffmpeg'


def correr(args):
    r = subprocess.run([ffmpeg(), '-v', 'error', '-y'] + args, capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stderr[-800:])


def luz(src, desde):
    """El gris medio (0–255) de 1,5 s de un video, para saber cuánto subirle."""
    r = subprocess.run([ffmpeg(), '-v', 'error', '-ss', str(desde), '-t', str(SEG), '-i', src, '-vf',
                        'scale=320:-2,format=gray,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-', '-f', 'null', '-'],
                       capture_output=True, text=True)
    v = [float(l.split('=')[1]) for l in r.stdout.splitlines() if 'YAVG=' in l]
    return sum(v) / len(v) if v else 255.0


def gamma_para(y):
    import math
    if y >= LUZ or y <= 1:
        return 1.0
    return round(min(GAMMA_MAX, math.log(y / 255) / math.log(LUZ / 255)), 2)


def armar(dst, hd=False):
    """`hd`: 1280 × 720 para la compu (Dlx, 12/11/2026: «el video no está en HD»: a 640 × 360 en una pantalla de
    1.454 px se ve cada píxel). El de 640 queda para el teléfono, donde pesa menos y no se nota."""
    w, h, alto, crf, nombre = (1280, 720, 720, 35, 'montaje-hd') if hd else (W, H, 480, 34, 'montaje')
    crudos = os.path.join(dst, 'crudos' + ('-hd' if hd else ''))
    os.makedirs(crudos, exist_ok=True)
    # ⚡ SÓLO EL PEDAZO DE CADA VIDEO (`--download-sections`): de 3 s antes a 5 s después del tramo, no el video entero.
    # En 480p los 23 enteros eran 588 MB. `--force-keyframes-at-cuts` corta en el segundo exacto: sin eso arranca en el
    # keyframe de antes y el tramo saldría corrido
    for i, (vid, t, _, _) in enumerate(TRAMOS):
        sal = os.path.join(crudos, '%02d.mp4' % i)
        if not os.path.exists(sal):
            subprocess.run([sys.executable, '-m', 'yt_dlp', '-f', 'bv*[height<=%d][ext=mp4]/bv*[height<=%d]' % (alto, alto),
                            '--no-playlist', '--ffmpeg-location', os.path.dirname(ffmpeg()) or '.',
                            '--download-sections', '*%d-%d' % (max(0, t - 3), t + 5), '--force-keyframes-at-cuts',
                            '-o', sal, '--', vid], check=True)
    partes = []
    for i, (vid, t, quien, _) in enumerate(TRAMOS):
        p = os.path.join(dst, 'p%02d.mp4' % i)
        # el pedazo arranca 3 s antes del tramo (o en el 0, si el tramo empieza antes del segundo 3)
        desde = min(3, t)
        g = gamma_para(luz(os.path.join(crudos, '%02d.mp4' % i), desde))
        vf = ('scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,setpts=%s*PTS,'
              'minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:vsbmc=1,format=gray,eq=contrast=1.12:brightness=-0.03:gamma=%s'
              % (w, h, w, h, LENTO, g))
        # (`-ss` y `-t` ANTES de `-i`, como opciones de la entrada: el tramo arranca en 0 y dura 1,5 s del original. Después
        # de `-i` cortaban lo ya estirado, a la mitad, y los fundidos quedaban fuera de tiempo: el HD salió de 3 s y 234 KB)
        correr(['-ss', str(desde), '-t', str(SEG), '-i', os.path.join(crudos, '%02d.mp4' % i), '-an', '-vf', vf,
                '-c:v', 'libx264', '-crf', '14', '-preset', 'fast', '-pix_fmt', 'yuv420p', p])
        partes.append(p)
        print(i, quien, 'gamma %s' % g if g > 1 else '')
    ins, fil, prev, off = [], [], '0:v', 0.0
    for p in partes:
        ins += ['-i', p]
    for i in range(1, len(partes)):
        off += SEG * LENTO - XF
        fil.append('[%s][%d:v]xfade=transition=fade:duration=%s:offset=%.3f[x%d]' % (prev, i, XF, off, i))
        prev = 'x%d' % i
    final = os.path.join(dst, nombre + '.mp4')
    # el grano NO va en el video: lo pone la página encima (en el video, el grano es lo que más pesa)
    correr(ins + ['-filter_complex', ';'.join(fil), '-map', '[%s]' % prev, '-an', '-c:v', 'libx264', '-crf', str(crf),
                  '-preset', 'veryslow', '-tune', 'grain', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', final])
    if not hd:
        correr(['-ss', '1', '-i', final, '-frames:v', '1', '-q:v', '4', os.path.join(dst, 'poster.jpg')])
        for n, t in enumerate(QUIETOS, 1):
            correr(['-ss', str(t), '-i', final, '-frames:v', '1', '-q:v', '3', os.path.join(dst, 'quieto%d.jpg' % n)])
    for p in partes:
        os.remove(p)
    print('listo: %s (%d KB). Los crudos quedan en %s: bórralos al terminar' % (final, os.path.getsize(final) // 1024, crudos))


def token():
    if os.environ.get('CLOUDFLARE_API_TOKEN'):
        return os.environ['CLOUDFLARE_API_TOKEN']
    p = os.path.join(BASE, '.env')
    if os.path.exists(p):
        for linea in io.open(p, encoding='utf-8'):
            if linea.strip().startswith('CLOUDFLARE_API_TOKEN='):
                return linea.split('=', 1)[1].strip().strip('"\'')
    sys.exit('falta CLOUDFLARE_API_TOKEN (entorno o .env)')


def subir(src):
    import requests
    s = requests.Session()
    s.headers['Authorization'] = 'Bearer ' + token()
    tipos = {'.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.json': 'application/json'}
    archivos = ['montaje.mp4', 'montaje-hd.mp4', 'poster.jpg'] + ['quieto%d.jpg' % n for n in range(1, len(QUIETOS) + 1)]
    faltan = [a for a in archivos if not os.path.exists(os.path.join(src, a))]
    if faltan:
        sys.exit('faltan en %s: %s' % (src, ', '.join(faltan)))
    cosas = [(a, open(os.path.join(src, a), 'rb').read()) for a in archivos]
    # 🎬 los créditos viajan con el video: si mañana se rearma con otros clips, la página nombra los de ese video
    cosas.append(('creditos.json', json.dumps({'canales': CREDITOS, 'tramos': len(TRAMOS)}, ensure_ascii=False).encode('utf-8')))
    for nombre, datos in cosas:
        r = s.put('%s/objects/%s%s' % (API_R2, CLAVE, nombre), data=datos,
                  headers={'Content-Type': tipos[os.path.splitext(nombre)[1]]}, timeout=120)
        print('%-14s %7d KB  %s' % (nombre, len(datos) // 1024, 'ok' if r.status_code < 300 else '%s %s' % (r.status_code, r.text[:120])))
        if r.status_code >= 300:
            sys.exit(1)


if __name__ == '__main__':
    if '--armar' in sys.argv:
        armar(sys.argv[sys.argv.index('--armar') + 1], hd='--hd' in sys.argv)
    elif '--subir' in sys.argv:
        subir(sys.argv[sys.argv.index('--subir') + 1])
    else:
        for i, (vid, t, quien, canal) in enumerate(TRAMOS):
            print('%2d  %-20s %-26s https://youtu.be/%s?t=%d' % (i, quien, canal, vid, t))
        print('\ncréditos:', ' · '.join(CREDITOS))
