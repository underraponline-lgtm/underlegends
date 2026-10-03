# -*- coding: utf-8 -*-
"""LA SIGLA QUE SE LEE DE CADA SERVIDOR, para lo que el bot escribe.

    from siglas import sigla
    sigla('SR')  ->  'SNK'

🔤 Dlx, 03/10/2026: *«cambia el esto de SNAKE RAP de SR a SNK queda mejor y
de URBF a URB»*. Sale de `datos/servidores.json` (`sigla`), el mismo dato que
usan la página (`siglaDe()` de `web/src/liga.js`) y el menú de /card
(`SERVIDORES` de `bot/worker.js`).

⚠️ EL CÓDIGO SIGUE SIENDO LA CLAVE. SR y URBF son las claves de los colores,
los logos, las cartas en R2, las columnas del Sheet y los links que ya
circulan: esto cambia sólo lo que se LEE. Sin `sigla`, la sigla es el código.

⚠️ VIVE EN `bot/` Y NO EN `comun/` A PROPÓSITO: todo `comun/` entra en la
huella de las cartas (`comun/huella_codigo.py`), y tocarlo redibuja las de
todos por un dato que ninguna carta dibuja.
"""
import io
import json
import os

_BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_S = None


def sigla(sv):
    """La sigla que se lee de `sv`; el código mismo si no tiene otra."""
    global _S
    if _S is None:
        try:
            with io.open(os.path.join(_BASE, 'datos', 'servidores.json'), encoding='utf-8') as f:
                _S = {k: v['sigla'] for k, v in (json.load(f).get('servidores') or {}).items()
                      if isinstance(v, dict) and v.get('sigla')}
        except (OSError, ValueError):
            _S = {}
    return _S.get(sv) or sv


if __name__ == '__main__':
    import sys
    ok = sigla('SR') == 'SNK' and sigla('URBF') == 'URB' and sigla('FFA') == 'FFA' and sigla('') == ''
    print('✅ SR se lee SNK, URBF se lee URB, el resto como su código' if ok else '❌ las siglas no son las de servidores.json')
    sys.exit(0 if ok else 1)
