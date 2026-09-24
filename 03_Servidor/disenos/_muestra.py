# -*- coding: utf-8 -*-
"""LA CARA DE MUESTRA DE LAS HOJAS DE DISEÑO, Y UN CARTEL SI NO ESTA.

🔴 POR QUE EXISTE: 44 SCRIPTS TENIAN LA MISMA LINEA.

    FOTO = b64(os.path.join(SCR, "av_valen.png"))

Cuarenta y cuatro veces, identica, al nivel del modulo — o sea que
**importar** cualquiera de esos scripts leia del disco la foto de una
persona real. Costaba dos cosas distintas:

1. **Tiraba el generador de PRODUCCION.** `03_Servidor/generar.py` importa
   `todos_sv` -> `los_nueve`, y `paneles` por `borde`. Sin `av_valen.png`
   en disco, la carta Servidor de las 59 personas **no se dibujaba**, con
   un `FileNotFoundError` adentro de un `import`. Aparecio armando el
   arbol del repo publico, donde esa foto no va justamente porque es de
   alguien.

2. **Y dejaba 44 scripts que revientan en un clon limpio.** El repo
   publico no lleva la foto, asi que quien clone y corra cualquier hoja de
   diseño se come el mismo error. Un repo publico donde la mitad de los
   scripts no arranca no sirve de nada.

⚠️ **ES PEREZOSA A PROPOSITO.** Importar un modulo no tiene que tocar el
disco: lo que decide si hace falta la cara es *dibujar una hoja*, no
*importar*. Es la misma regla que ya siguen el navegador y el espejo de
las caras en `bot/pipeline.py` — la precondicion es dibujar, no arrancar.

⚠️ **Y SI FALTA, EL CARTEL LO DICE.** Poner otra foto con el mismo nombre
en silencio seria peor que fallar: el que compara una hoja contra la
referencia veria otra cara y no sabria por que. El cartel dice «MUESTRA ·
no es una foto real».

⚠️ **Y NO VIVE EN `los_nueve.py`**, que seria el lugar obvio. Importar
`los_nueve` corre su `defs()` al nivel del modulo, o sea que arma los
nueve fondos y lee las veinte texturas: cuesta cientos de ms para pedir
una cara. Este modulo no importa nada pesado.
"""
import base64
import io
import os

SCR = os.path.dirname(os.path.abspath(__file__))

#: La foto que se usa cuando esta. No representa a nadie que hoy se pueda
#: volver a bajar: su URL del CDN de Discord da 404 desde agosto de 2026,
#: asi que este archivo es la unica copia que queda de esa foto — y por eso
#: tampoco va al repo publico.
ARCHIVO = os.path.join(SCR, 'av_valen.png')

_cache = None


def cara_muestra():
    """La cara de muestra como data URI. Una sola vez por proceso."""
    global _cache
    if _cache is not None:
        return _cache
    if os.path.exists(ARCHIVO):
        datos = io.open(ARCHIVO, 'rb').read()
        _cache = 'data:image/png;base64,' + base64.b64encode(datos).decode()
        return _cache
    _cache = _cartel()
    return _cache


def _cartel():
    """Un cuadro que DICE que no es una foto, del tamaño de un avatar."""
    from PIL import Image, ImageDraw
    im = Image.new('RGB', (256, 256), (34, 37, 46))
    d = ImageDraw.Draw(im)
    # una silueta, para que la hoja se lea como una hoja con cara
    d.ellipse((88, 54, 168, 134), fill=(62, 67, 80))
    d.ellipse((48, 148, 208, 300), fill=(62, 67, 80))
    d.text((92, 206), 'MUESTRA', fill=(152, 158, 172))
    d.text((60, 222), 'no es una foto real', fill=(112, 118, 132))
    b = io.BytesIO()
    im.save(b, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


if __name__ == '__main__':
    hay = os.path.exists(ARCHIVO)
    u = cara_muestra()
    print('\n  av_valen.png %s' % ('está' if hay else 'NO está'))
    print('  cara_muestra() -> %s… (%d caracteres)' % (u[:40], len(u)))
    print('  %s\n' % ('la foto' if hay else 'el cartel de MUESTRA'))
