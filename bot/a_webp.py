"""PASAR LAS CARTAS QUE YA ESTAN EN R2 DE PNG A WEBP.

    python bot/a_webp.py --ver        que habria que convertir
    python bot/a_webp.py --aplicar    convierte y sube

Se corre UNA vez. De aca en adelante `bot/subir_cartas.py` ya sube webp.

POR QUE
-------
Dlx, 17/09/2026: «a veces hay algunas fotos que no carga». Las URL responden
200 todas —`bot/verificar.py` las prueba una por una— asi que lo que falla no
es que el archivo no este: es cuanto tarda en llegar a un telefono.

    1.793 objetos · 1,99 GB · 1,14 MB de media
    `pub-*.r2.dev` NO manda cache-control ni cf-cache-status: no cachea en el
    borde, cada pedido va al bucket
    24 pedidos a la vez -> mediana 1,97 s, maximo 5,21 s

⚠️ **PNG ES EL FORMATO EQUIVOCADO PARA ESTA CARTA, Y SE PUEDE MEDIR.** PNG no
pierde nada: predice cada pixel desde el de al lado y guarda la diferencia.
Eso es excelente con colores planos y malo con fotos y degrades. La carta de
Konan tiene **72.560 colores distintos** y solo el **57,7%** de sus pixeles es
identico a su vecino — o sea que casi la mitad es justo lo que PNG no sabe
comprimir.

    PNG optimizado    1043 KB   -5%     no vale la pena
    WEBP sin perdida   677 KB   -38%
    WEBP q90           138 KB   -87%    <- este

⚠️ **ES CON PERDIDA Y ESO SE MIDIO, NO SE SUPUSO.** Sobre la carta entera:
diferencia media de **1,24 sobre 255** por canal, y solo el **3,48%** de los
pixeles cambia mas de 8/255. El mapa de diferencia amplificado x20 es negro en
todo el fondo, la piel y los degrades: lo unico que se ve son los CONTORNOS.
Es lo que hace un compresor con perdida — gasta bits en los bordes y ahorra en
la superficie lisa. Dlx miro la comparacion: «la verdad yo lo veo igual».

⚠️ **LA TRANSPARENCIA SE CONSERVA, Y ERA LO UNICO QUE PODIA ROMPER LA CARTA.**
Verificado: sale RGBA y las cuatro esquinas quedan en alfa 0. Una carta que
pierde el alfa se vuelve un rectangulo sobre el fondo de Discord.

⚠️ **Y NO SE PIERDE EL ORIGINAL.** Lo que se convierte es la copia que se
sirve; el master lo vuelve a hacer el generador cuando haga falta, a la escala
que se pida.

⚠️ **CAMBIAR LA EXTENSION CAMBIA LA URL, Y ESO ES UN EFECTO QUERIDO.** Discord
cachea por URL: al pasar a `.webp` vuelve a bajar todo sin que haga falta
mover el sello. Justo hoy eso destraba las 276 cartas con las caras que se
subieron con la cuota de KV agotada.
"""
import concurrent.futures as cf
import io
import os
import sys
import time

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)

# ⚠️ NO HAY UNA COPIA ACA. La calidad y el esfuerzo viven en
# `bot/subir_cartas.py` y se importan en `main()`, junto con el resto.
# Tenerlos escritos dos veces deja que una conversion salga distinta de la
# otra sin que nada falle — el bug del divisor, otra vez.


def main():
    import requests
    from PIL import Image
    from subir_cartas import (sesion, listar, API, PUBLICA, _ok,
                              CALIDAD, ESFUERZO)

    aplicar = '--aplicar' in sys.argv
    s = sesion()
    objs = [o for o in listar(s) if o['key'].endswith('.png')]
    total = sum(int(o['size']) for o in objs)
    print('\n%d PNG en R2 · %.2f GB\n' % (len(objs), total / 1024 ** 3))
    if not aplicar:
        print('  (nada hecho — corré con --aplicar)\n')
        return

    import threading
    local = threading.local()
    hechos, fallos, nuevo = [], [], []

    def una(o):
        if not hasattr(local, 's'):
            local.s = sesion()
        clave = o['key']
        destino = clave[:-4] + '.webp'
        for intento in range(3):
            try:
                r = requests.get('%s/%s' % (PUBLICA, clave), timeout=60)
                if r.status_code != 200 or len(r.content) < 1024:
                    raise IOError('bajada %d' % r.status_code)
                im = Image.open(io.BytesIO(r.content)).convert('RGBA')
                b = io.BytesIO()
                im.save(b, 'WEBP', quality=CALIDAD,
                        method=ESFUERZO)
                datos = b.getvalue()
                # ⚠️ NO SE SUBE ALGO QUE PERDIO EL ALFA. Una carta sin
                # transparencia se ve como un rectangulo en Discord, y eso no
                # da error: sale mal y ya.
                if Image.open(io.BytesIO(datos)).mode != 'RGBA':
                    raise IOError('perdio el alfa')
                pr = local.s.put('%s/objects/%s' % (API, destino), data=datos,
                                 headers={'Content-Type': 'image/webp'},
                                 timeout=60)
                if _ok(pr, destino) is None:
                    raise IOError('la API rechazo la subida')
                return clave, len(r.content), len(datos), None
            except Exception as e:
                if intento == 2:
                    return clave, 0, 0, str(e)[:60]
                time.sleep(1.5 * (intento + 1))

    t0 = time.time()
    with cf.ThreadPoolExecutor(max_workers=12) as pool:
        for clave, antes, despues, err in pool.map(una, objs):
            if err:
                fallos.append((clave, err))
            else:
                hechos.append((antes, despues))
                if len(hechos) % 100 == 0:
                    print('   %d de %d...' % (len(hechos), len(objs)))

    a = sum(x for x, _ in hechos)
    d = sum(y for _, y in hechos)
    print('\n  %d convertidas en %.1f min' % (len(hechos), (time.time() - t0) / 60))
    print('  %.2f GB  ->  %.2f GB   (-%.0f%%)'
          % (a / 1024 ** 3, d / 1024 ** 3, 100 * (1 - d / a) if a else 0))
    if fallos:
        print('  ⚠️ %d fallaron:' % len(fallos))
        for k, e in fallos[:8]:
            print('     %-30s %s' % (k, e))
    print('')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
