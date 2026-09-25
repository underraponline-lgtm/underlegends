# -*- coding: utf-8 -*-
"""CHROMIUM, SOLO CUANDO HAY ALGO QUE DIBUJAR.

🔴 VIVE ACA Y NO EN `pipeline.py` DESDE EL 24/09/2026, porque la regla se
rompió teniéndola ahí. El paso 5b —las Bloqueadas— corre en TODAS las
corridas, también en las quietas, y llamaba a esto **antes** de saber si
había algo que dibujar. Medido en la corrida de las 9:22 PM ET: bajó
Chromium y 427 fotos, 43 s de 168, para terminar en «no queda nada».

Ahora lo pide quien sabe si va a dibujar: `bloqueadas.py` después de
contar lo que falta, y el pipeline en el paso de las cuatro cartas.
"""
import os
import subprocess
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

_HECHO = [False]


def hace_falta():
    """Baja Chromium si no está. Idempotente dentro de un proceso.

    🔴 SE BAJABA EN TODA CORRIDA Y EL 97 % NO DIBUJA NADA. Estaba en el
    paso `instalar` del `.yml` como
    `playwright install --with-deps chromium`.

    Medido el 22/09/2026 sobre una corrida quieta de verdad: el job entero
    son **62 s** y ese paso **36** — el 58 %. Con el cron cada hora son 23
    corridas quietas por día bajando un navegador que no se usa: **~7 h
    por mes** de las 33 que da el plan.

    ⚠️ Es la misma regla que ya sigue `bajar_las_caras()`: la precondición
    es **dibujar**, no «correr en Actions». Puesta en el workflow queda
    bien para ese llamador y mal para el otro — y acá el otro llamador es
    el 97 % de las veces.

    ⚠️ FUERA DE ACTIONS NO HACE NADA. En una máquina donde Playwright ya
    tiene su navegador, `install` termina enseguida; pero `--with-deps`
    pide sudo y en Windows no aplica, así que se prueba primero si ya está
    y sólo se baja si falta.
    """
    if _HECHO[0]:
        return
    _HECHO[0] = True
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as pw:
            if os.path.exists(pw.chromium.executable_path):
                return                     # ya está: no hay nada que bajar
    except Exception:                                    # noqa: BLE001
        pass
    print('      bajando Chromium (sólo cuando hay que dibujar)…')
    args = [sys.executable, '-m', 'playwright', 'install']
    if os.environ.get('GITHUB_ACTIONS'):
        args.append('--with-deps')
    args.append('chromium')
    r = subprocess.run(args, cwd=BASE, capture_output=True, text=True,
                       encoding='utf-8', errors='replace')
    if r.returncode:
        print('      ⚠️ no pude instalar el navegador: %s'
              % (r.stderr or '').strip().splitlines()[-1][:90])
