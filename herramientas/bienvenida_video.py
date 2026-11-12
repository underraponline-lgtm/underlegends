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
QUIETOS = (7.4, 20.2, 42.6)                         # los cuadros que rellenan «LIGA GLOBAL»
CREDITOS = sorted({t[3] for t in TRAMOS}, key=lambda c: (-sum(1 for t in TRAMOS if t[3] == c), c))


def ffmpeg():
    links = os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe')
    return links if os.path.exists(links) else 'ffmpeg'


def correr(args):
    r = subprocess.run([ffmpeg(), '-v', 'error', '-y'] + args, capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stderr[-800:])


def armar(dst):
    crudos = os.path.join(dst, 'crudos')
    os.makedirs(crudos, exist_ok=True)
    ids = sorted({t[0] for t in TRAMOS})
    subprocess.run([sys.executable, '-m', 'yt_dlp', '-f', 'bv*[height<=480][ext=mp4]/bv*[height<=480]', '--no-playlist',
                    '-o', os.path.join(crudos, '%(id)s.%(ext)s'), '--'] + ids, check=True)
    partes = []
    for i, (vid, t, quien, _) in enumerate(TRAMOS):
        p = os.path.join(dst, 'p%02d.mp4' % i)
        vf = ('scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,setpts=%s*PTS,'
              'minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:vsbmc=1,format=gray,eq=contrast=1.12:brightness=-0.03'
              % (W, H, W, H, LENTO))
        correr(['-ss', str(t), '-t', str(SEG), '-i', os.path.join(crudos, vid + '.mp4'), '-an', '-vf', vf,
                '-c:v', 'libx264', '-crf', '14', '-preset', 'fast', '-pix_fmt', 'yuv420p', p])
        partes.append(p)
        print(i, quien)
    ins, fil, prev, off = [], [], '0:v', 0.0
    for p in partes:
        ins += ['-i', p]
    for i in range(1, len(partes)):
        off += SEG * LENTO - XF
        fil.append('[%s][%d:v]xfade=transition=fade:duration=%s:offset=%.3f[x%d]' % (prev, i, XF, off, i))
        prev = 'x%d' % i
    final = os.path.join(dst, 'montaje.mp4')
    # el grano NO va en el video: lo pone la página encima (en el video, el grano es lo que más pesa)
    correr(ins + ['-filter_complex', ';'.join(fil), '-map', '[%s]' % prev, '-an', '-c:v', 'libx264', '-crf', '34',
                  '-preset', 'veryslow', '-tune', 'grain', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', final])
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
    archivos = ['montaje.mp4', 'poster.jpg'] + ['quieto%d.jpg' % n for n in range(1, len(QUIETOS) + 1)]
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
        armar(sys.argv[sys.argv.index('--armar') + 1])
    elif '--subir' in sys.argv:
        subir(sys.argv[sys.argv.index('--subir') + 1])
    else:
        for i, (vid, t, quien, canal) in enumerate(TRAMOS):
            print('%2d  %-20s %-26s https://youtu.be/%s?t=%d' % (i, quien, canal, vid, t))
        print('\ncréditos:', ' · '.join(CREDITOS))
