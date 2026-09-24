"""
SILUETA DEL ESCUDO — Liga Global
=================================

🔴 NO REDIBUJAR ESTA FORMA.

No fue dibujada a ojo. Se trazó píxel por píxel del PNG de la plantilla real:
    canal alfa → contorno → simplificación (Douglas-Peucker, tolerancia 0.18)

Intentos previos con `clip-path: polygon()` fallaron durante horas porque polygon
solo une puntos con LÍNEAS RECTAS, y la carta de FIFA tiene curvas.

Datos duros de la forma (medidos, no estimados):
  · viewBox 300 x 485  →  proporción 0.619
    (durante semanas se usó 0.714, que era el error de fondo)
  · el tope tiene TRES picos: ~36%, 50% y ~64% del ancho, con dos valles
  · los laterales son verticales entre el 16% y el 84% de la altura
  · abajo cierra en V al centro

CONTORNO INTERIOR
-----------------
`IN` se generó desplazando cada punto por su propia NORMAL, no escalando el
exterior — escalar deforma las esquinas y el grosor deja de ser parejo.

⚠️ Aun así, NO usar `IN` para dibujar el marco: en los valles del tope las
normales se cruzan y aparece un artefacto con forma de bigote.

EL MARCO SE DIBUJA CON STROKE RECORTADO:

    <clipPath id="c"><path d="OUT"/></clipPath>
    <g clip-path="url(#c)">
      <path d="OUT" stroke="acento" stroke-width="27"/>   <!-- filete interior -->
      <path d="OUT" stroke="base"   stroke-width="23"/>   <!-- hueco -->
      <path d="OUT" stroke="metal"  stroke-width="18"/>   <!-- banda -->
    </g>

Como todo son trazos sobre la MISMA curva, no hay cruces posibles.
`IN` y `LINE` quedan disponibles por si sirven para otra cosa.
"""

import os

_DIR = os.path.dirname(os.path.abspath(__file__))


def _leer(nombre):
    ruta = os.path.join(_DIR, nombre)
    if not os.path.exists(ruta):
        raise FileNotFoundError(
            "Falta %s en %s.\n"
            "Los tres .txt del contorno (shield_out / shield_in / shield_line) "
            "tienen que estar en la misma carpeta que shield.py." % (nombre, _DIR)
        )
    d = open(ruta, encoding='utf-8').read().strip()
    if not d.startswith('M'):
        raise ValueError("%s no parece un path SVG (debería empezar con 'M')" % nombre)
    return d


OUT  = _leer('shield_out.txt')    # contorno exterior — el que se usa para clip y stroke
IN   = _leer('shield_in.txt')     # interior, desplazado por normal (ver aviso arriba)
LINE = _leer('shield_line.txt')   # filete decorativo interno

VW, VH = 300, 485                 # el viewBox. La proporción NO se cambia.


# ── referencias de altura, medidas sobre la forma real ──
# Sirven para ubicar contenido sin volver a medir.
LATERAL_RECTO_DESDE = 0.16   # arriba de esto la carta se angosta (corona)
LATERAL_RECTO_HASTA = 0.84   # abajo de esto la carta cierra en punta
PICOS_X             = (0.36, 0.50, 0.64)   # los tres picos del tope


if __name__ == '__main__':
    print("Silueta cargada correctamente")
    print("  viewBox     : %d x %d  (proporción %.3f)" % (VW, VH, VW / VH))
    print("  exterior    : %d caracteres" % len(OUT))
    print("  interior    : %d caracteres" % len(IN))
    print("  filete      : %d caracteres" % len(LINE))
    print("  lateral recto entre el %.0f%% y el %.0f%% de la altura"
          % (LATERAL_RECTO_DESDE * 100, LATERAL_RECTO_HASTA * 100))
