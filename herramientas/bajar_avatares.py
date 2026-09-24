"""Guardar en disco la foto de cada rapero.

    python herramientas/bajar_avatares.py            las del pool con carta
    python herramientas/bajar_avatares.py --todos    las 876 del padron
    python herramientas/bajar_avatares.py --forzar   vuelve a bajar las que ya estan

    -> 03_Servidor/disenos/_avatares/

⚠️ **HAY DOS MANERAS Y UNA ES MUCHO MEJOR. Medido sobre 25 el 17/09/2026:**

    A · la URL guardada        21 de 25 vivas   16% ya muertas, y siguen cayendo
    B · pedirsela a Discord     25 de 25        NO PUEDE CADUCAR

La URL guarda un **hash** que Discord invalida en cuanto la persona cambia su
foto. Por eso `CLAUDE.md` medía *«6 caídos de 20 en julio, 11 el 04/08»*: ese
número sólo podía empeorar, porque cada rebuild arrastraba las mismas URLs
muriéndose.

El **Discord ID no cambia nunca**. Con el ID + el token del bot se pide el hash
**de hoy**, así que la foto que se baja siempre es la actual. Es el arreglo de
fondo que el proyecto venía pidiendo y que estaba bloqueado esperando el token
— que existe desde el 17/09/2026.

⚠️ **Y los IDs no estaban donde los buscábamos.** No están en el Sheet Oficial;
están en la hoja **Lista de Raperos** del Sheet **Operativo**, que el pipeline
no conocía. Los trae `sheet/construir_padron.py` a `datos/padron.json`.

El camino A queda como respaldo para quien no tiene ID: **101 de 138 lo
tienen**, así que los otros 37 siguen dependiendo de su URL vieja.

⚠️ **NO se guarda un archivo vacío.** Un PNG de 0 bytes en esa carpeta después
se lee como avatar válido y la carta sale en blanco sin avisar.
"""
import io
import json
import os
import re
import sys
import time
import urllib.request

SCR = os.path.dirname(os.path.abspath(__file__))
# ⚠️ Antes esto era una ruta ABSOLUTA a la máquina de Dlx. `CLAUDE.md` dice
# que las rutas son relativas al script para que el proyecto se pueda mover;
# este archivo era la excepción y nadie se enteraba hasta moverlo.
BASE = os.path.dirname(SCR)
DST = os.path.join(BASE, '03_Servidor', 'disenos', '_avatares')

# ⚠️ EL POOL TRAE ?size=128 CLAVADO Y ESO SE VEIA COMO "no se ve HD". La foto
# se dibuja a 345 px de ancho, o sea que se agrandaba 2.7 veces. El `size` no
# es parte del hash, asi que se puede reescribir a 512.
#
# 🔴 ACA DECIA «trae la misma foto cuatro veces mas grande» Y ES FALSO, y lo
# desmiente la medicion que esta CUATRO LINEAS MAS ABAJO en este mismo
# comentario: «256 px, 79 personas — es lo que subieron ellas». Las dos
# frases convivieron sin que nadie las cruzara.
#
# `size` es un TOPE, no un pedido: el CDN devuelve lo que la persona subio y
# nada mas. Re-medido el 20/09/2026 pidiendo cinco tamaños del mismo hash,
# Konan y Afidu topan en 256 y 170 pase lo que pase. El salto real es
# 128 -> 256, o sea el doble: la carta pasa de agrandar 2.7x a 1.35x. Se gana
# la mitad del problema y no hay forma de ganar el resto.
#
# ⚠️ Y SUBE A 1024 EL 18/09/2026, PERO SÓLO LE SIRVE AL 15%. Dlx: *«hay alguna
# forma de subirle la calidad a los avatares?»*. Medido sobre las 107 que hay
# en disco, pidiéndolas a 512:
#
#     256 px   79 personas      <- la mayoría, y es lo que subieron ellas
#     <512     91 de 107 (85%)
#     512      16               <- éstas topaban en NUESTRO pedido
#     >512      0
#
# **Discord devuelve el original cuando es más chico que lo pedido**, así que
# los 91 de abajo ya estaban al máximo: ahí no hay nada que ganar y pedir más
# no cambia un byte. Los 16 que dan exactamente 512 son los únicos que estaban
# topando contra este número, y ésos sí mejoran.
#
# ⚠️ LO QUE ESTO **NO** ARREGLA, Y CONVIENE NO PROMETERLO: la carta dibuja la
# foto a 345 px CSS y se exporta a escala 3–4, o sea ~1.035–1.380 px de
# dispositivo. Una foto de 256 se agranda **cuatro o cinco veces** y va a
# verse blanda haga lo que haga el pipeline. Eso es lo que esa persona subió
# a Discord, y la única forma de arreglarlo es que suba una más grande.
#
# ⚠️ Y NO SE SUBE MÁS DE 1024 PORQUE EMPIEZA A COSTAR SIN DAR: probado con
# Adrianex, de 512 a 1024 el archivo pasa de 251 KB a 1.204 KB y la diferencia
# real contra el de 512 agrandado es 0,66 sobre 255 — o sea que Discord está
# estirando, no agregando. RZ en cambio pasa de 512 a 720 con +2,02 de
# diferencia real: ése sí tenía más.
TAM = 1024

API = 'https://discord.com/api/v10'
CDN = 'https://cdn.discordapp.com'


def _env(clave):
    p = os.path.join(BASE, '.env')
    if not os.path.exists(p):
        return ''
    for linea in io.open(p, encoding='utf-8'):
        if linea.strip().startswith(clave + '='):
            return linea.split('=', 1)[1].strip().strip('"\'')
    return ''


def con_tam(url, n=TAM):
    if 'size=' in url:
        return re.sub(r'size=\d+', 'size=%d' % n, url)
    return url + ('&' if '?' in url else '?') + 'size=%d' % n


def _ancho(p):
    try:
        from PIL import Image
        return Image.open(p).size[0]
    except Exception:
        return 0


def limpio(nombre):
    n = re.sub(r'[^\w\s-]', '', nombre, flags=re.UNICODE).strip()
    return re.sub(r'\s+', '_', n).lower() or 'sin_nombre'


def _bajar(url):
    req = urllib.request.Request(con_tam(url))
    req.add_header('User-Agent', 'Mozilla/5.0')
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read()


def url_actual(sesion, discord_id, token):
    """La URL de la foto de HOY, preguntandole a Discord. None si no tiene."""
    for intento in range(4):
        r = sesion.get('%s/users/%s' % (API, discord_id),
                       headers={'Authorization': 'Bot ' + token}, timeout=20)
        # ⚠️ Discord limita por ritmo y contesta 429 con cuanto esperar. Sin
        # esto, una tanda de 101 se corta por la mitad y parece que la gente
        # no tiene foto.
        if r.status_code == 429:
            time.sleep(float(r.json().get('retry_after', 1)) + 0.2)
            continue
        if r.status_code != 200:
            return None
        h = r.json().get('avatar')
        # Los animados empiezan con a_; se pide .png igual y Discord devuelve
        # un cuadro fijo, que es lo que la carta necesita.
        return '%s/avatars/%s/%s.png?size=%d' % (CDN, discord_id, h, TAM) if h else None
    return None


def main():
    import requests
    sys.path.insert(0, os.path.join(BASE, 'sheet'))
    import construir_padron as PAD

    todos = '--todos' in sys.argv
    forzar = '--forzar' in sys.argv

    padron = PAD.cargar()
    if not padron:
        sys.exit('falta datos/padron.json:  python sheet/construir_padron.py')
    idx = PAD.por_nombre(padron)

    if todos:
        gente = [(p['full'], p['raw'], p.get('discord_id'), p.get('av_sheet'))
                 for p in padron]
    else:
        with open(os.path.join(BASE, 'datos', 'competitivo_pool.json'),
                  encoding='utf-8') as f:
            pool = json.load(f)
        gente = []
        for x in pool:
            p = idx.get(PAD.norm(x['raw']), {})
            gente.append((x.get('full', x['raw']), x['raw'],
                          p.get('discord_id'), p.get('av_sheet') or x.get('av')))

    token = _env('DISCORD_TOKEN')
    if not token:
        print('⚠️  sin DISCORD_TOKEN en .env: sólo puedo usar las URLs viejas,')
        print('    que es el camino que se muere solo. Ver el docstring.\n')

    os.makedirs(DST, exist_ok=True)
    s = requests.Session()
    por_id = por_url = ya = 0
    sin_nada, caidos = [], []

    for full, raw, did, av in gente:
        destino = os.path.join(DST, limpio(raw) + '.png')
        # ⚠️ "ya está" mira el ANCHO de la imagen, no si el archivo existe: una
        # tanda vieja guardó 128 y hay que volver a bajarlos a 512. Con un
        # chequeo de existencia, el arreglo no llega a ninguno de los guardados.
        if (not forzar and os.path.exists(destino)
                and os.path.getsize(destino) > 1024 and _ancho(destino) >= TAM):
            ya += 1
            continue

        url, via = None, ''
        if did and token:
            url = url_actual(s, did, token)
            via = 'id'
        if not url and av:
            url, via = av, 'url'
        if not url:
            sin_nada.append(raw)
            continue

        try:
            datos = _bajar(url)
            if len(datos) < 1024:
                caidos.append((raw, via, 'respuesta de %d bytes' % len(datos)))
                continue
            with open(destino, 'wb') as f:
                f.write(datos)
            print('   %-4s %-18s %6.1f KB' % (via, raw[:18], len(datos) / 1024))
            if via == 'id':
                por_id += 1
            else:
                por_url += 1
        except Exception as e:
            caidos.append((raw, via, getattr(e, 'code', str(e)[:30])))

    print()
    for n, via, m in caidos:
        print('   CAIDO  %-18s (%s) %s' % (n[:18], via, m))
    if sin_nada:
        print('\n   sin ID ni URL (%d): %s%s'
              % (len(sin_nada), ', '.join(sin_nada[:14]),
                 ' …' if len(sin_nada) > 14 else ''))
    print('\n   por ID %d   ·   por URL vieja %d   ·   ya estaban %d   ·   caídos %d'
          % (por_id, por_url, ya, len(caidos)))
    n = len([f for f in os.listdir(DST) if f.lower().endswith('.png')])
    print('   EN DISCO AHORA: %d fotos' % n)
    print('-> %s' % os.path.relpath(DST, BASE))


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
