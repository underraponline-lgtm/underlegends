"""📖 Los pedidos del Dashboard, SIN quién los mandó (26/11/2026). Sólo lee.

    python herramientas/pedidos_ver.py            todos los que muestra el Dashboard (los abiertos primero)
    python herramientas/pedidos_ver.py falla      sólo los de un tipo (falla, carta, puntos, premio, otro…)

Lo que trae el Worker (`pedidosLeer()` de bot/avisos.js): tipo, texto, fecha y estado. Nunca el Discord ID, el perfil, la
prueba ni quién lo resolvió: es para encontrar bugs, no personas. Con la clave del ciclo, como los demás pasos.
"""
import datetime as dt
import os
import sys
import zoneinfo

import requests

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'bot'))
import clave_ciclo as CC  # noqa: E402
import fotos as F  # noqa: E402

WORKER = 'https://liga-global-bot.liga-global-ul.workers.dev'
ET = zoneinfo.ZoneInfo('America/New_York')


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    tipo = (sys.argv[1:] or [''])[0]
    r = requests.get(WORKER + '/avisos/pedidos-leer', headers={'x-lg-ciclo': CC.clave(F.env('DISCORD_TOKEN'))}, timeout=30)
    if r.status_code != 200:
        sys.exit('❌ el Worker contestó %s: ¿está desplegado con /avisos/pedidos-leer?' % r.status_code)
    ps = [p for p in r.json().get('pedidos') or [] if not tipo or p.get('tipo') == tipo]
    print('%d pedido(s)%s\n' % (len(ps), ' de tipo ' + tipo if tipo else ''))
    for p in ps:
        cuando = dt.datetime.fromtimestamp((p.get('t') or 0) / 1000, ET).strftime('%d/%m %I:%M %p')
        estado = {'': 'ABIERTO', 'si': 'aprobado', 'no': 'rechazado', 'hecho': 'hecho'}.get(p.get('estado'), p.get('estado'))
        print('#%s · %s · %s · %s' % (p.get('id'), p.get('tipo'), cuando, estado))
        print('   ' + str(p.get('texto') or '').replace('\n', '\n   '))
        if p.get('nota'):
            print('   nota: ' + p['nota'])
        print()


if __name__ == '__main__':
    main()
