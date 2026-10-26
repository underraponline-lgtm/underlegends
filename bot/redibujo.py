# -*- coding: utf-8 -*-
"""⚡ EL REDIBUJO A PEDIDO: las cartas de unas pocas personas, ya, sin esperar la vuelta del ciclo.

    python bot/redibujo.py --quienes "DLX,Oasis"     redibuja y sube sus cartas, y le avisa al objeto
    python bot/redibujo.py --quienes "DLX" --simulacro   dibuja y no sube
    python bot/redibujo.py --auto                    self-check

Dlx, 26/10/2026: *«cambié el título… pero no veo ningún cambio en mi tarjeta… intenta que esos cambios sean casi de
inmediato… que tengan cooldown y filtro para evitar que abusen del sistema»*.

🔑 CÓMO ANDA. Elegir un TAG en el Inventario (`tagElige()` del objeto) anota un pedido (`pedirRedibujo()`); el vigía de
cada minuto (`redibujos()`) larga `.github/workflows/carta.yml` con los nombres y este script: trae lo elegido
(`tags_inventario.py`), dibuja con los MISMOS dibujadores del ciclo (`pipeline.COMO`), sube sólo los PNG de esta corrida y
le avisa al objeto (`/avisos/redibujo-listo`), que le cambia la versión a esas cartas (`vr`): `/card` y la página piden la
URL nueva, y Discord no sirve la vieja de su caché.

⏱️ EL FRENO VIVE EN EL OBJETO (`REDIBUJO_ESPERA`, `REDIBUJO_DIA`): un redibujo cada 10 minutos por persona y 6 por día.
Pedir de más no hace nada: el pedido queda uno solo, para cuando se cumpla la espera.

⚠️ NO SELLA. El sello es del ciclo: en su vuelta ve el TAG nuevo en la huella (`que_cambio.huellas()`) y la vuelve a
dibujar igual. Es una carta de más por pedido, a cambio de no tocar `datos/` fuera del ciclo (dos commits al mismo archivo
chocan).
"""
import io
import json
import os
import subprocess
import sys
import time

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

#: el tope de personas por pedido: más que esto es un abuso o un error
TOPE = 10


def nombres(txt):
    """`"DLX, Oasis"` -> `['DLX', 'Oasis']`, sin repetidos, sin vacíos y con tope."""
    out = []
    for x in str(txt or '').split(','):
        x = x.strip()
        if x and x not in out and len(x) <= 60:
            out.append(x)
    return out[:TOPE]


def dibujar(quienes):
    """Corre los cuatro dibujadores con esos nombres. Devuelve los PNG nuevos (escritos después del arranque)."""
    from pipeline import COMO
    corte = time.time() - 1
    for carta, (script, carpeta, _pref) in COMO.items():
        r = subprocess.run([sys.executable] + script + quienes, cwd=BASE, capture_output=True, text=True,
                           encoding='utf-8', errors='replace')
        print('   %s %s' % ('✅' if r.returncode == 0 else '⚠️', carta))
    nuevos = []
    for _c, (_s, carpeta, _p) in COMO.items():
        d = os.path.join(BASE, carpeta)
        for f in os.listdir(d) if os.path.isdir(d) else []:
            ruta = os.path.join(d, f)
            if f.endswith('.png') and os.path.getmtime(ruta) >= corte:
                nuevos.append(ruta)
    return nuevos


def listo(quienes):
    """Le avisa al objeto que esas cartas están arriba: les cambia la versión y cierra el pedido."""
    import requests
    import fotos as F
    import clave_ciclo as CC
    from alertar import WORKER
    tok = F.env('DISCORD_TOKEN', obligatorio=False)
    if not tok:
        return False
    r = requests.post(WORKER + '/avisos/redibujo-listo', headers={'x-lg-ciclo': CC.clave(tok), 'content-type': 'application/json'},
                      data=json.dumps({'quienes': quienes}, ensure_ascii=False).encode('utf-8'), timeout=25)
    return r.status_code == 200


def correr(quienes, simulacro=False):
    if not quienes:
        print('   nadie a quien redibujar')
        return 0
    print('⚡ redibujo a pedido: %d persona(s)' % len(quienes))
    # lo mismo que prepara el ciclo antes de dibujar: Chromium y las caras desde R2 (sin el espejo, sale la inicial)
    import navegador
    navegador.hace_falta()
    from pipeline import bajar_las_caras
    bajar_las_caras()
    # lo elegido, fresco del objeto (el TAG que acaba de cambiar)
    subprocess.run([sys.executable, 'bot/tags_inventario.py', '--aplicar'], cwd=BASE, capture_output=True)
    pngs = dibujar(quienes)
    print('   %d PNG' % len(pngs))
    if simulacro or not pngs:
        return 0 if pngs else 1
    r = subprocess.run([sys.executable, 'bot/subir_cartas.py'] + pngs, cwd=BASE, capture_output=True, text=True,
                       encoding='utf-8', errors='replace')
    print('   %s subidas' % ('✅' if r.returncode == 0 else '⚠️'))
    ok = listo(quienes)
    print('   %s el objeto se enteró' % ('✅' if ok else '⚠️'))
    return 0 if r.returncode == 0 and ok else 1


def _self_check():
    mal = 0

    def ok(c, t):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', t))

    print('\n══ EL REDIBUJO A PEDIDO ══\n')
    ok(nombres(' DLX , Oasis,DLX,, ') == ['DLX', 'Oasis'], 'los nombres: sin espacios, sin repetidos, sin vacíos')
    ok(len(nombres(','.join('n%d' % i for i in range(40)))) == TOPE, 'y con tope: %d por pedido' % TOPE)
    from pipeline import COMO
    ok(set(COMO) == {'temporada', 'competitivo', 'pais', 'servidor'}, 'dibuja con los mismos dibujadores del ciclo')
    print('\n   %s' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return 1 if mal else 0


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if '--auto' in sys.argv:
        return _self_check()
    q = sys.argv[sys.argv.index('--quienes') + 1] if '--quienes' in sys.argv else ''
    return correr(nombres(q), '--simulacro' in sys.argv)


if __name__ == '__main__':
    sys.exit(main())
