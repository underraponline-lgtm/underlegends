"""¿DE QUE LADO CONVIENE LA COLUMNA, SEGUN LAS FOTOS REALES?

Dlx pregunto si probar todo del lado izquierdo. La consistencia con las otras
dos cartas ya empuja para ese lado —las dos ponen su numero a la izquierda—,
pero hay una segunda pregunta que solo contestan los avatares: LA COLUMNA TAPA
UN TERCIO DE LA FOTO, y conviene que tape el lado menos importante.

⚠️ NO SE MIDE "DONDE ESTA LA CARA": eso pide un detector y seria otro
proyecto. Se mide DONDE ESTA EL DETALLE, que es lo que se pierde al taparlo.
Una foto de retrato tiene el detalle en el centro y los bordes lisos; si un
lado trae sistematicamente mas detalle que el otro, taparlo cuesta mas.

El detalle se estima con la variacion local de luz (gradiente). Es grosero a
proposito: la pregunta no es cuanto detalle hay, es de que lado hay MAS.
"""
import os
import sys

import numpy as np
from PIL import Image

SCR = os.path.dirname(os.path.abspath(__file__))
DIR = os.path.join(SCR, '_avatares')
# la columna ocupa COL_ANCHO+COL_DER = 76 de 300, o sea el 25% de un lado
BANDA = 0.25


def detalle(a):
    """Gradiente medio: cuanto cambia la luz de pixel a pixel."""
    g = a.astype(float)
    dx = np.abs(np.diff(g, axis=1)).mean(axis=1)
    dy = np.abs(np.diff(g, axis=0)).mean(axis=0)
    return dx.mean(), dy.mean()


def main():
    if not os.path.isdir(DIR):
        print('no hay _avatares/')
        return
    fs = [f for f in os.listdir(DIR) if f.endswith('.png')]
    if not fs:
        print('no hay PNG en _avatares/')
        return
    izq_gana = der_gana = 0
    difs = []
    print('   %-14s %8s %8s   %s' % ('avatar', 'izq', 'der', 'mas detalle'))
    print('   ' + '-' * 48)
    for f in sorted(fs):
        a = np.array(Image.open(os.path.join(DIR, f)).convert('L')).astype(float)
        w = a.shape[1]
        b = int(w * BANDA)
        di = np.abs(np.diff(a[:, :b], axis=1)).mean()
        dd = np.abs(np.diff(a[:, w - b:], axis=1)).mean()
        tot = di + dd or 1
        dif = 100 * (dd - di) / tot
        difs.append(dif)
        if dd > di:
            der_gana += 1
        else:
            izq_gana += 1
        print('   %-14s %8.2f %8.2f   %s %+.0f%%'
              % (f[:14], di, dd, 'der' if dd > di else 'izq', dif))
    print('   ' + '-' * 48)
    n = len(fs)
    print('   mas detalle a la izquierda: %d de %d' % (izq_gana, n))
    print('   mas detalle a la derecha:   %d de %d' % (der_gana, n))
    print('   diferencia media: %+.1f%% (positivo = la derecha trae mas)'
          % np.mean(difs))
    print("""
   ⚠️ COMO SE LEE ESTO. Si el reparto es parejo —mitad y mitad, y la media
   cerca de cero— entonces LAS FOTOS NO DECIDEN NADA y la pregunta vuelve a
   ser de consistencia: las otras dos cartas ponen el numero a la izquierda.

   Si un lado gana claro, ese es el lado que conviene TAPAR con la columna,
   no el contrario: se tapa donde hay menos que ver.""")
    n_muestra = n
    if n_muestra < 12:
        print("""
   ⚠️ Y OJO CON EL TAMAÑO DE LA MUESTRA: son %d avatares sobre 138. Alcanza
   para ver si hay un sesgo grosero, no para afinar. Si el reparto sale
   parejo, esa conclusion es solida —no hay señal—; si sale torcido, hay que
   mirarlo con mas fotos antes de mover nada.""" % n_muestra)


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
