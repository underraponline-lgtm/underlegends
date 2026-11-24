# -*- coding: utf-8 -*-
"""🎬 LOS SHORTS SALEN SOLOS (Dlx, 24/11/2026: «conéctalo al ciclo»). Mira el canal de Logs de DRA y, cuando ULAYA terminó
de entregar la grabación de un evento (el encabezado «🎙️ Grabación · …» y, después, su `batallas.json`), lanza el trabajo
`procesar`, que baja, escucha, elige, fabrica y sube los shorts de ese evento. Lo corre el ciclo, paso 2b8j.

🔑 UNO POR VEZ. `procesar` tiene su grupo de `concurrency`, y GitHub deja UNO esperando por grupo: un tercero pisa al que
esperaba. Así que si ya hay uno corriendo o en cola no se pide otro: queda para la corrida siguiente, media hora después.

🔑 EL PRIMER DÍA NO PROCESA EL PASADO. Sin `datos/shorts_eventos.json`, todo lo que ya está en Logs se anota como visto y
no se lanza nada: los shorts son de lo que se juegue desde ahora.

🔇 El registro del repo público se ve desde afuera: acá sólo salen cuentas.
Uso: python bot/shorts_eventos.py [--aplicar]   (sin --aplicar dice qué haría)"""
import json
import os
import subprocess
import sys
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ESTADO = os.path.join(RAIZ, 'datos', 'shorts_eventos.json')
LOGS, ULAYA = '1504110449535483924', '1550026808404217926'
ENCABEZADO = '🎙️ **Grabación** · '
REPO = os.environ.get('GITHUB_REPOSITORY') or 'underraponline-lgtm/underlegends'
APLICAR = '--aplicar' in sys.argv
# el token del trabajo llega como GH_PROCESAR (ciclo.yml) y sólo lo ve gh: un GH_TOKEN en el entorno del ciclo entero lo
# tomaría desplegar.py como el del Worker. En esta PC, gh usa su propia sesión
GH = dict(os.environ, **({'GH_TOKEN': os.environ['GH_PROCESAR']} if os.environ.get('GH_PROCESAR') else {}))


def _token():
    t = os.environ.get('DISCORD_TOKEN') or ''
    f = os.path.join(RAIZ, '.env')
    if not t and os.path.exists(f):
        for l in open(f, encoding='utf-8'):
            if l.startswith('DISCORD_TOKEN='):
                t = l.split('=', 1)[1].strip().strip('"')
    return t


def mensajes():
    r = urllib.request.Request('https://discord.com/api/v10/channels/%s/messages?limit=100' % LOGS,
                               headers={'Authorization': 'Bot ' + _token(), 'User-Agent': 'DiscordBot (liga, 1)'})
    return list(reversed(json.loads(urllib.request.urlopen(r, timeout=20).read().decode('utf-8'))))


def entregas(ms):
    """[(id del encabezado, hora UTC 'AAAA-MM-DDTHH:MM', completa)] en orden: completa = ya llegó su batallas.json"""
    xs = []
    for m in ms:
        if m['author']['id'] != ULAYA:
            continue
        if (m.get('content') or '').startswith(ENCABEZADO):
            xs.append([m['id'], m['timestamp'][:16], False])
        elif xs and any(a['filename'] == 'batallas.json' for a in m.get('attachments', [])):
            xs[-1][2] = True
    return xs


def ocupado():
    """¿hay un `procesar` corriendo o esperando? Si gh no contesta, se toma como que sí: mejor tarde que pisado."""
    try:
        r = subprocess.run(['gh', 'run', 'list', '-R', REPO, '-w', 'procesar.yml', '-L', '5', '--json', 'status'],
                           capture_output=True, text=True, timeout=60, env=GH)
        return r.returncode != 0 or any(x['status'] != 'completed' for x in json.loads(r.stdout or '[]'))
    except Exception:
        return True


def main():
    hay = os.path.exists(ESTADO)
    E = json.load(open(ESTADO, encoding='utf-8')) if hay else {'vistos': {}}
    xs = entregas(mensajes())
    if not hay:
        for i, t, _ in xs:
            E['vistos'][i] = {'t': t, 'como': 'semilla'}
        print('🎬 primera vez: %d grabaciones ya en Logs, anotadas sin procesar' % len(xs))
    else:
        nuevas = [(i, t) for i, t, lista in xs if lista and i not in E['vistos']]
        esperando = sum(1 for i, t, lista in xs if not lista and i not in E['vistos'])
        if not nuevas:
            print('🎬 ninguna grabación nueva' + (' (%d llegando)' % esperando if esperando else ''))
            return
        if ocupado():
            print('🎬 %d grabaciones nuevas; hay un procesar en marcha: queda para la próxima corrida' % len(nuevas))
            return
        i, t = nuevas[0]
        if APLICAR:
            r = subprocess.run(['gh', 'workflow', 'run', 'procesar.yml', '-R', REPO, '-f', 'desde=' + t],
                               capture_output=True, text=True, timeout=60, env=GH)
            if r.returncode:
                print('⚠️ no se pudo lanzar procesar: queda para la próxima corrida')
                return
            E['vistos'][i] = {'t': t, 'como': 'pedido'}
        print('🎬 procesar lanzado para 1 grabación' + (' (sin --aplicar: no se lanzó)' if not APLICAR else '')
              + (' · %d más en la fila' % (len(nuevas) - 1) if len(nuevas) > 1 else ''))
    if APLICAR:
        json.dump(E, open(ESTADO, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
