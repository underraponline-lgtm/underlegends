# -*- coding: utf-8 -*-
"""🎬 LOS SHORTS SALEN SOLOS (Dlx, 24/11/2026: «conéctalo al ciclo»). Mira el canal de Logs de DRA y, cuando ULAYA terminó
de entregar la grabación de un evento (el encabezado «🎙️ Grabación · …» y, después, su `batallas.json`), lanza el trabajo
`procesar`, que baja, escucha, elige, fabrica y sube los shorts de ese evento. Lo corre el ciclo, paso 2b8j.

🔑 UNO POR VEZ. `procesar` tiene su grupo de `concurrency`, y GitHub deja UNO esperando por grupo: un tercero pisa al que
esperaba. Así que si ya hay uno corriendo o en cola no se pide otro: queda para la corrida siguiente, media hora después.

🔑 EL PRIMER DÍA NO PROCESA EL PASADO. Sin `datos/shorts_eventos.json`, todo lo que ya está en Logs se anota como visto y
no se lanza nada: los shorts son de lo que se juegue desde ahora.

🔁 SI ULAYA NO SEPARÓ LAS BATALLAS (25/11/2026), igual se procesa: con su habla.json, el trabajo las separa después
(bot/rearmar_batallas.mjs). Se espera a que ULAYA deje de reintentar (su último «No pude separar…» sin «Vuelvo a probar») o
dos horas.

♻️ UNA SEGUNDA VUELTA SI SALIÓ MAL (25/11/2026): se anota qué corrida se lanzó; cuando termina, si falló o no sacó ningún
short, se lanza UNA vez más con el código de ese momento (Puristas del 24/11 salió vacío por un arreglo que llegó tarde y
se relanzó a mano). Dos veces mal: queda anotado y no se insiste.

🌙 A CUALQUIER HORA, TAMBIÉN DE MADRUGADA (Dlx, 26/11/2026: «que GitHub haga todo eso cuando sea, pero que lo de la
madrugada no lo interrumpa»). Lo corría el ciclo, que duerme de 3 a 11 AM ET: lo que ULAYA entregaba a esa hora quedaba
trabado hasta las 11. Ahora lo corre `.github/workflows/shorts.yml` cada media hora, todo el día, y lanza en cuanto
puede. Lo único que espera a la mañana es el DM a Dlx por una que salió mal (de madrugada no se manda nada a Discord).
⚠️ Se leen las entregas de las últimas `HORAS_ATRAS` y no los últimos 100 mensajes de Logs: en una noche cargada, una
grabación que esperó su turno ya quedó muy atrás.
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


HORAS_ATRAS = 40        # cuánto de Logs se lee: de la grabación de la tarde a la madrugada siguiente, y una noche de más


def mensajes():
    """Los mensajes de Logs de las últimas `HORAS_ATRAS`, del más viejo al más nuevo (de a 100, hasta 15 páginas)."""
    import datetime as dt
    corte = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=HORAS_ATRAS)).isoformat()[:19]
    out, antes = [], None
    for _ in range(15):
        u = 'https://discord.com/api/v10/channels/%s/messages?limit=100' % LOGS + ('&before=%s' % antes if antes else '')
        r = urllib.request.Request(u, headers={'Authorization': 'Bot ' + _token(), 'User-Agent': 'DiscordBot (liga, 1)'})
        ms = json.loads(urllib.request.urlopen(r, timeout=20).read().decode('utf-8'))
        if not ms:
            break
        out += ms
        antes = ms[-1]['id']
        if ms[-1]['timestamp'][:19] < corte:
            break
    return list(reversed(out))


def entregas(ms):
    """[(id del encabezado, hora UTC 'AAAA-MM-DDTHH:MM', lista)] en orden. Lista: llegó su batallas.json, o llegó su
    habla.json y ULAYA ya no va a reintentar (o pasaron dos horas)."""
    import datetime as dt
    xs = []
    for m in ms:
        if m['author']['id'] != ULAYA:
            continue
        txt = m.get('content') or ''
        if txt.startswith(ENCABEZADO):
            xs.append({'id': m['id'], 't': m['timestamp'][:16], 'guion': False, 'habla': False, 'reintenta': False})
            continue
        if not xs:
            continue
        nombres = [a['filename'] for a in m.get('attachments', [])]
        if 'batallas.json' in nombres:
            xs[-1]['guion'] = True
        if 'habla.json' in nombres:
            xs[-1]['habla'] = True
        if txt.startswith('⚔️ No pude separar'):
            xs[-1]['reintenta'] = 'Vuelvo a probar' in txt
    ahora = dt.datetime.now(dt.timezone.utc)
    out = []
    for x in xs:
        viejo = (ahora - dt.datetime.fromisoformat(x['t'] + ':00+00:00')).total_seconds() > 7200
        out.append([x['id'], x['t'], x['guion'] or (x['habla'] and (not x['reintenta'] or viejo))])
    return out


def _gh(*a):
    r = subprocess.run(['gh'] + list(a), capture_output=True, text=True, timeout=120, env=GH, encoding='utf-8', errors='replace')
    return r.stdout if r.returncode == 0 else None


def resultado(run):
    """('corriendo', None) · ('bien', n listos) · ('mal', n listos o None). Deja en `ULTIMO_AUDIOS` cuántas batallas
    subió en audio (`archivo_reels.audios()` lo imprime), o None si la corrida no lo dijo"""
    global ULTIMO_AUDIOS
    ULTIMO_AUDIOS = None
    j = _gh('run', 'view', str(run), '-R', REPO, '--json', 'status,conclusion')
    if not j:
        return 'corriendo', None
    j = json.loads(j)
    if j.get('status') != 'completed':
        return 'corriendo', None
    log = _gh('run', 'view', str(run), '-R', REPO, '--log') or ''
    import re
    n = [int(x) for x in re.findall(r'(\d+) listos', log)]
    n = n[-1] if n else None
    au = [int(x) for x in re.findall(r'(\d+) batallas en audio', log)]
    ULTIMO_AUDIOS = au[-1] if au else None
    return ('bien' if j.get('conclusion') == 'success' and n else 'mal'), n


def lanzar(t):
    """Lanza procesar para la hora t; devuelve el id de la corrida (o None si no se pudo)."""
    import time
    if _gh('workflow', 'run', 'procesar.yml', '-R', REPO, '-f', 'desde=' + t) is None:
        return None
    time.sleep(6)
    j = _gh('run', 'list', '-R', REPO, '-w', 'procesar.yml', '-L', '1', '--json', 'databaseId')
    try:
        return json.loads(j)[0]['databaseId']
    except Exception:
        return 0


def ocupado():
    """¿hay un `procesar` corriendo o esperando? Si gh no contesta, se toma como que sí: mejor tarde que pisado."""
    try:
        r = subprocess.run(['gh', 'run', 'list', '-R', REPO, '-w', 'procesar.yml', '-L', '5', '--json', 'status'],
                           capture_output=True, text=True, timeout=60, env=GH)
        return r.returncode != 0 or any(x['status'] != 'completed' for x in json.loads(r.stdout or '[]'))
    except Exception:
        return True


def _madrugada():
    import madrugada
    return madrugada.en_ventana()


def _hora_et(t):
    """«24/11 10:01 PM» de la hora de la entrega (UTC)"""
    import datetime as dt, zoneinfo
    try:
        x = dt.datetime.fromisoformat(str(t).replace('Z', '+00:00'))
        x = x if x.tzinfo else x.replace(tzinfo=dt.timezone.utc)
        return x.astimezone(zoneinfo.ZoneInfo('America/New_York')).strftime('%d/%m %I:%M %p').replace(' 0', ' ')
    except Exception:
        return str(t)


ULTIMO_AUDIOS = None


def main():
    hay = os.path.exists(ESTADO)
    E = json.load(open(ESTADO, encoding='utf-8')) if hay else {'vistos': {}}
    xs = entregas(mensajes())
    if not hay:
        for i, t, _ in xs:
            E['vistos'][i] = {'t': t, 'como': 'semilla'}
        print('🎬 primera vez: %d grabaciones ya en Logs, anotadas sin procesar' % len(xs))
    else:
        # ♻️ cómo salieron las que se lanzaron
        rehacer = []
        for i, v in E['vistos'].items():
            if v.get('como') not in ('pedido', 'reintento') or not v.get('run') or v.get('res'):
                continue
            est, n = resultado(v['run'])
            if est == 'corriendo':
                continue
            v['res'], v['listos'] = est, n
            if ULTIMO_AUDIOS is not None:
                v['audios'] = ULTIMO_AUDIOS
            if est == 'mal' and v['como'] == 'pedido':
                v['rehacer'] = True            # queda anotada: si hay otra corriendo, la segunda vuelta espera su turno
            print('🎬 la corrida de una grabación terminó: %s (%s shorts)' % (est, n if n is not None else '?'))
            # 🚨 EL ROBOT NO FALLA CALLADO (Dlx, 25/11: «all of them»): si la segunda vuelta también salió mal, o salieron
            # shorts pero ninguna batalla en audio, UN DM a Dlx con la corrida. Por pantalla, sólo que se avisó
            falla = ('salió mal dos veces: %s shorts' % (n if n is not None else 0)) if est == 'mal' and v['como'] == 'reintento' \
                else ('salieron %d shorts pero ninguna batalla en audio' % n) if est == 'bien' and ULTIMO_AUDIOS == 0 else ''
            if falla:
                v['falla'] = falla             # de madrugada no se avisa: se avisa de día (abajo)
            if falla and APLICAR and not v.get('avisado') and not _madrugada():
                try:
                    import alertar
                    alertar.dm('🚨 Una grabación de ULAYA (%s ET) %s.\nLa corrida: https://github.com/%s/actions/runs/%s'
                               % (_hora_et(v['t']), falla, REPO, v['run']))
                    v['avisado'] = True
                    print('🚨 aviso a Dlx: una grabación no salió bien')
                except Exception as e:
                    print('🚨 sin aviso:', type(e).__name__)
        rehacer = [(i, v['t']) for i, v in E['vistos'].items() if v.get('rehacer')]
        # 📨 el DM de una que salió mal de madrugada, ya de día (ver arriba)
        if APLICAR and not _madrugada():
            for v in E['vistos'].values():
                if v.get('falla') and not v.get('avisado'):
                    try:
                        import alertar
                        alertar.dm('🚨 Una grabación de ULAYA (%s ET) %s.\nLa corrida: https://github.com/%s/actions/runs/%s'
                                   % (_hora_et(v['t']), v['falla'], REPO, v['run']))
                        v['avisado'] = True
                    except Exception as e:
                        print('🚨 sin aviso:', type(e).__name__)
        nuevas = [(i, t) for i, t, lista in xs if lista and i not in E['vistos']]
        # «llegando»: sólo las de menos de dos horas (una entrega vieja sin batallas.json ni habla.json no llega nunca)
        import datetime as dt
        hace2h = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=2)).isoformat()[:16]
        esperando = sum(1 for i, t, lista in xs if not lista and i not in E['vistos'] and t >= hace2h)
        fila = [(i, t, 'reintento') for i, t in rehacer] + [(i, t, 'pedido') for i, t in nuevas]
        if not fila:
            print('🎬 ninguna grabación nueva' + (' (%d llegando)' % esperando if esperando else ''))
        elif ocupado():
            print('🎬 %d grabaciones para procesar; hay un procesar en marcha: queda para la próxima corrida' % len(fila))
        else:
            i, t, como = fila[0]
            if APLICAR:
                run = lanzar(t)
                if run is None:
                    print('⚠️ no se pudo lanzar procesar: queda para la próxima corrida')
                    return
                E['vistos'][i] = {'t': t, 'como': como, 'run': run}
            print('🎬 procesar lanzado para 1 grabación' + (' (segunda vuelta)' if como == 'reintento' else '')
                  + (' (sin --aplicar: no se lanzó)' if not APLICAR else '')
                  + (' · %d más en la fila' % (len(fila) - 1) if len(fila) > 1 else ''))
    if APLICAR:
        json.dump(E, open(ESTADO, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
