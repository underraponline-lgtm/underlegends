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
  python herramientas/bienvenida_video.py --armar <carpeta> --480  # el de 854 × 480, para pantallas grandes
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
    # 👩 SOL ES ELLA (Dlx, 12/11/2026, con el link: «la mujer de la derecha es SOL»): la de rulos y remera POLO CLUB.
    # Hasta la 4.66 este tramo era de «JOSEMA MAYNUN LIONZHOK VS SOL GUILLE WA» (eariGFs-TEM), un 3v3 de Perú elegido
    # SÓLO porque el título decía «SOL»: era otra persona. ⚠️ Un nombre en el título no es la persona: el tramo se
    # confirma mirándolo, o lo confirma Dlx
    ('dMamevsP5ZQ', 167, 'Sol', 'Estrellas del Flow'),
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
# 🎞️ LA CÁMARA LENTA: ×2, Y LOS CUADROS QUE FALTAN LOS INVENTA RIFE (Dlx, 12/11/2026, viendo las cuatro maneras
# lado a lado: «haz el RIFE ×2 entonces»). El camino, porque cada paso se cayó por algo que se ve:
#   · hasta la 4.64, `minterpolate` en modo `mci`: estiraba manos y caras al moverse rápido («a veces distorsionado»);
#   · 4.66–4.68, repetir cada cuadro real: nada se deforma, pero los grabados a 30 quedan en 15 cuadros reales por
#     segundo y se nota el salto («se nota bastante, y más en el primer video»);
#   · desde ahora, RIFE (rife-ncnn-vulkan, IA en la tarjeta de video): ×2 fluido, y en el tramo de las manos que se
#     deformaba la mano avanza entera cuadro a cuadro. Comparado contra ×1,25 sin inventar y RIFE ×1,6.
# Los grabados a 60 no pasan por RIFE: tienen los cuadros de verdad. Revisado antes de usarlo (12/11, con el sí de
# Dlx): un .exe que sólo usa Windows y Vulkan, sin red ni scripts. Vive fuera del repo, en RIFE_DIR
RIFE_DIR = os.environ.get('RIFE_DIR') or os.path.join(os.environ.get('LOCALAPPDATA', ''), 'rife-ncnn-vulkan-20221029')
RIFE_MODELO = 'rife-v4.6'
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


def fps_de(src):
    """Los cuadros por segundo de un video (ffprobe, al lado de ffmpeg)."""
    probe = os.path.join(os.path.dirname(ffmpeg()), 'ffprobe.exe')
    r = subprocess.run([probe if os.path.exists(probe) else 'ffprobe', '-v', 'error', '-select_streams', 'v:0',
                        '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', src], capture_output=True, text=True)
    # la primera línea y sin la coma del final: con algunos videos ffprobe escribe `60/1,` (medido con el de Guty y Andres)
    a, _, b = (r.stdout.strip().splitlines() or [''])[0].strip(' ,').partition('/')
    return float(a) / float(b or 1) if a else 30.0


def distintos_por_segundo(src, desde):
    """Cuántos cuadros DISTINTOS por segundo tiene el tramo. ⚠️ No es lo mismo que los cuadros del archivo: el de Liberia
    dice 59,94 y trae 30 distintos, cada uno dos veces (subido a 60 desde una cámara de 30). Tomado como de 60, iba sin
    RIFE y en cámara lenta quedaba en 15 cuadros reales por segundo: Dlx, 12/11/2026, «el frame de Liberia está muy
    laggeado». Medido con `mpdecimate` sobre el mismo SEG que se usa."""
    import re
    r = subprocess.run([ffmpeg(), '-v', 'info', '-ss', str(desde), '-t', str(SEG), '-i', src, '-an',
                        '-vf', 'scale=320:-2,mpdecimate=hi=200:lo=100:frac=0.5,showinfo', '-f', 'null', '-'], capture_output=True, text=True)
    return len(re.findall(r'showinfo.*n:\s*\d+', r.stderr)) / SEG


def rife(src, desde, vf_caja, dst_mp4, vf_tono, antes=''):
    """El tramo con los cuadros intermedios de RIFE: SEG del original, hasta SEG × LENTO × 30 cuadros (3 s a 30)."""
    import shutil, tempfile
    exe = os.path.join(RIFE_DIR, 'rife-ncnn-vulkan.exe')
    if not os.path.exists(exe):
        sys.exit('🔴 falta RIFE en %s (o RIFE_DIR): sin él la cámara lenta vuelve a saltar' % RIFE_DIR)
    tmp = tempfile.mkdtemp(prefix='rife_')
    ent, sal = os.path.join(tmp, 'in'), os.path.join(tmp, 'out')
    os.makedirs(ent); os.makedirs(sal)
    try:
        correr(['-ss', str(desde), '-t', str(SEG), '-i', src, '-an', '-vf', (antes + ',' if antes else '') + vf_caja, os.path.join(ent, '%06d.png')])
        r = subprocess.run([exe, '-i', ent, '-o', sal, '-n', str(int(round(SEG * LENTO * 30))), '-m', os.path.join(RIFE_DIR, RIFE_MODELO)],
                           capture_output=True, text=True, cwd=RIFE_DIR)
        if r.returncode or not os.listdir(sal):
            sys.exit('🔴 RIFE falló: ' + (r.stderr or r.stdout)[-600:])
        correr(['-framerate', '30', '-i', os.path.join(sal, '%08d.png'), '-vf', vf_tono,
                '-c:v', 'libx264', '-crf', '14', '-preset', 'fast', '-pix_fmt', 'yuv420p', dst_mp4])
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def gamma_para(y):
    import math
    if y >= LUZ or y <= 1:
        return 1.0
    return round(min(GAMMA_MAX, math.log(y / 255) / math.log(LUZ / 255)), 2)


def armar(dst, grande=False):
    """`grande`: 854 × 480 para las pantallas grandes. Fue 1280 × 720 en la 4.59 (Dlx: «el video no está en HD»), 960 × 540
    en la 4.66 (Dlx: «no se nota mucho el HD… un intermedio entre 720p y 480»: con el mismo peso, 720p tenía que comprimir
    tanto, crf 35, que se perdía lo que ganaba en píxeles) y 480p el mismo día (Dlx: «480 so the MB is lower but the
    quality almost the same»). Medido: a la medida de una pantalla de 1.454 px, 540p crf 28, 480p crf 28 y 480p crf 30 no
    se distinguen, y pesan 6,5, 5,6 y 4,4 MB. El de 640 × 360 queda para las pantallas chicas. Los dos salen de los
    originales en 1080p."""
    w, h, crf, nombre = (854, 480, 30, 'montaje-480') if grande else (W, H, 31, 'montaje')
    alto = 1080
    crudos = os.path.join(dst, 'crudos')
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
        src = os.path.join(crudos, '%02d.mp4' % i)
        fps = fps_de(src)
        reales = distintos_por_segundo(src, desde) if fps >= 50 else fps
        g = gamma_para(luz(src, desde))
        caja = 'scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d' % (w, h, w, h)
        tono = 'format=gray,eq=contrast=1.12:brightness=-0.03:gamma=%s' % g
        if reales >= 50:
            # (`-ss` y `-t` ANTES de `-i`, como opciones de la entrada: el tramo arranca en 0 y dura 1,5 s del original.
            # Después de `-i` cortaban lo ya estirado, a la mitad, y los fundidos quedaban fuera de tiempo)
            correr(['-ss', str(desde), '-t', str(SEG), '-i', src, '-an', '-vf', '%s,setpts=%s*PTS,fps=30,%s' % (caja, LENTO, tono),
                    '-c:v', 'libx264', '-crf', '14', '-preset', 'fast', '-pix_fmt', 'yuv420p', p])
        elif fps >= 50:
            # «de 60» con cuadros repetidos: uno de cada dos (los de verdad) y RIFE, como uno de 30
            rife(src, desde, caja, p, tono, antes='fps=%g' % (fps / 2))
        else:
            rife(src, desde, caja, p, tono)
        partes.append(p)
        print(i, quien, '%g cps (%g distintos)' % (fps, round(reales, 1)), 'real' if reales >= 50 else 'RIFE', 'gamma %s' % g if g > 1 else '')
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
    if not grande:
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
    archivos = ['montaje.mp4', 'montaje-480.mp4', 'poster.jpg'] + ['quieto%d.jpg' % n for n in range(1, len(QUIETOS) + 1)]
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
        armar(sys.argv[sys.argv.index('--armar') + 1], grande='--480' in sys.argv)
    elif '--subir' in sys.argv:
        subir(sys.argv[sys.argv.index('--subir') + 1])
    else:
        for i, (vid, t, quien, canal) in enumerate(TRAMOS):
            print('%2d  %-20s %-26s https://youtu.be/%s?t=%d' % (i, quien, canal, vid, t))
        print('\ncréditos:', ' · '.join(CREDITOS))
