"""BORRAR DE R2 LOS PNG QUE YA NO SIRVE NADIE.

    python bot/limpiar_png.py             dice cuantos y comprueba
    python bot/limpiar_png.py --aplicar   los borra

Desde el 17/09/2026 el bot sirve **webp**. Los PNG que quedaron son de antes y
ninguna URL del Worker los pide.

⚠️ SE COMPRUEBA ANTES DE BORRAR, Y ESA ES TODA LA GRACIA. Borrar en R2 no
tiene papelera. Asi que primero se exige que **cada PNG tenga su webp arriba**:
si falta aunque sea una, no se borra nada. Sin eso, un fallo silencioso en la
conversion se volveria una carta perdida — y las cartas se pueden regenerar,
pero enterarse dos semanas despues es otra cosa.

⚠️ Y NO ALCANZA CON CONTAR. Se comprueba clave por clave: `konan/pais.png`
solo se borra si existe `konan/pais.webp`. Contar 1.793 de cada lado daria el
mismo numero aunque estuvieran cruzados.
"""
import concurrent.futures as cf
import os
import sys
import threading

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)


def main():
    from subir_cartas import sesion, listar, API, _ok

    aplicar = '--aplicar' in sys.argv
    s = sesion()
    objs = listar(s)
    png = [o['key'] for o in objs if o['key'].endswith('.png')]
    webp = {o['key'] for o in objs if o['key'].endswith('.webp')}
    peso = sum(int(o['size']) for o in objs if o['key'].endswith('.png'))

    print('\n%d PNG · %.2f GB   ·   %d webp arriba' % (len(png), peso / 1024 ** 3, len(webp)))
    if not png:
        print('  no hay nada que borrar\n')
        return

    huerfanos = [k for k in png if k[:-4] + '.webp' not in webp]
    if huerfanos:
        print('\n  🔴 %d PNG NO TIENEN SU WEBP. NO SE BORRA NADA.' % len(huerfanos))
        for k in huerfanos[:10]:
            print('     %s' % k)
        print('\n  Hay que convertirlos antes: python bot/a_webp.py --aplicar\n')
        return
    print('  ✅ los %d tienen su webp — clave por clave, no por cuenta' % len(png))

    if not aplicar:
        print('\n  (nada borrado — corré con --aplicar)\n')
        return

    local = threading.local()

    # ⚠️ CON FRENO Y REINTENTO. Con 12 hilos a fondo, R2 contesta
    # `[971] Please wait and consider throttling your request speed` y deja
    # 383 de 1.793 sin borrar. No es un fallo de datos —las webp ni se
    # tocan— pero deja el bucket a medio limpiar y hay que volver a pasar.
    # El error PIDE literalmente que bajes el ritmo: hacerle caso sale mas
    # barato que reintentar a ciegas.
    import time as _t

    def borra(k, intentos=4):
        if not hasattr(local, 's'):
            local.s = sesion()
        for n in range(intentos):
            r = local.s.delete('%s/objects/%s' % (API, k), timeout=45)
            try:
                j = r.json()
            except Exception:
                j = {}
            if j.get('success'):
                return k, True
            codigos = [e.get('code') for e in (j.get('errors') or [])]
            if 971 not in codigos:
                return k, False
            _t.sleep(2 * (n + 1))          # el 971 pide esperar, no insistir
        return k, False

    hechos, fallos = 0, []
    with cf.ThreadPoolExecutor(max_workers=4) as pool:
        for k, bien in pool.map(borra, png):
            if bien:
                hechos += 1
                if hechos % 200 == 0:
                    print('   %d de %d...' % (hechos, len(png)))
            else:
                fallos.append(k)
    print('\n  %d borrados · %.2f GB liberados' % (hechos, peso / 1024 ** 3))
    if fallos:
        print('  ⚠️ %d no se pudieron borrar: %s' % (len(fallos), fallos[:4]))
    print('')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
