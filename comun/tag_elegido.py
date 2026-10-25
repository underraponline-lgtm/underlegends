# -*- coding: utf-8 -*-
"""🏷️ EL TAG QUE CADA UNO ELIGIÓ PARA CADA CARTA (Dlx, 25/10/2026: «que los tags de abajo sean personalizables en cada
tarjeta, si uno desbloquea uno claro… que pueda elegir el que desee desde el inventario», y a los cuatro grupos, «sí,
sirve así»).

Los TAGs se parten en cuatro grupos (`GRUPO` de `sheet/catalogo_tags.py`):
  · ♾️ para siempre   — pasó una vez y nadie te lo quita (REGICIDA, CAMPEÓN, FUNDADOR…)
  · 📅 de temporada   — se mide dentro de la temporada (DINASTÍA, PILAR, HABITUÉ…): se pone hasta que termina
  · ✨ edición limitada — se gana sólo en una ventana (los títulos del Pase de la T1)
  · 🎯 de estado      — dice cómo estás hoy (EN LLAMAS, TOP DEL SERVIDOR…): no se guarda, sale solo mientras se cumple

El inventario lo llena el ciclo (`bot/tags_inventario.py`) con lo que tu carta mostró; lo que elegiste lo guarda el
objeto de avisos, y el ciclo lo deja acá ya revisado contra tu inventario: `datos/tags_elegidos.json`, con la forma
`{clave: {carta: [texto, nivel]}}`. Las cuatro cartas sólo preguntan `para(carta, clave)`: si no eligió nada (o
«automático»), `None` y la cascada de siempre.

⚠️ El TAG elegido entra al sello de la carta (`bot/que_cambio.huellas()`): elegir otro la redibuja.
"""
import io
import json
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARCH = os.path.join(RAIZ, 'datos', 'tags_elegidos.json')
NIVELES = ('t1', 't2', 't3', 't4')
_cache = None


def todos():
    """`{clave: {carta: [texto, nivel]}}`, o `{}` sin archivo."""
    global _cache
    if _cache is None:
        try:
            with io.open(ARCH, encoding='utf-8') as f:
                d = json.load(f)
            _cache = d if isinstance(d, dict) else {}
        except (OSError, ValueError):
            _cache = {}
    return _cache


def para(carta, clave):
    """`(texto, nivel)` del TAG que `clave` eligió para `carta`, o `None` (y va la cascada)."""
    x = (todos().get(str(clave or '')) or {}).get(carta)
    if isinstance(x, list) and len(x) == 2 and x[0] and x[1] in NIVELES:
        return (str(x[0]), x[1])
    return None


if __name__ == '__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    _cache = {'ana': {'temporada': ['💀 REGICIDA', 't1'], 'servidor': ['x', 'mal']}}
    ok = para('temporada', 'ana') == ('💀 REGICIDA', 't1') and para('servidor', 'ana') is None and para('pais', 'nadie') is None
    print(('✅' if ok else '🔴') + ' el TAG elegido: el bueno pasa, uno con nivel raro no, y sin elegir va la cascada')
    sys.exit(0 if ok else 1)
