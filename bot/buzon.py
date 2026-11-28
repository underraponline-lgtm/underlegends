# -*- coding: utf-8 -*-
"""📬 EL BUZÓN EN HILOS PRIVADOS DE DRA: la parte del ciclo (paso 2b4b3). Las reglas viven en `bot/buzon.js`.

    python bot/buzon.py              qué haría esta ronda (no anota nada, no toca Discord)
    python bot/buzon.py --aplicar    la ronda: borra los hilos de más de 48 h y abre los nuevos
    python bot/buzon.py --auto       el self-check (sin red): el freno de 429, lo que se confirma y lo que se suelta

🧪 LA PRUEBA CON DLX (28/11/2026, «solo conmigo por hoy día y por horas, y simulemos como si fuese activo»): mientras
dure `PRUEBA` de bot/buzon.js (hasta las 11:59 PM ET del 28/11; después se apaga solo), el buzón corre sólo para Dlx.

    python bot/buzon.py --simular              un aviso de cada clase en la campana de Dlx, y la ronda en el momento
    python bot/buzon.py --simular --tanda 2    de a cinco (1, 2 o 3), así el hilo los muestra enteros
    python bot/buzon.py --simular --tipos pase,drops
    python bot/buzon.py --limpiar-simulacion   saca lo simulado (campana, hilos en Discord y el «No me avises más»)

🎨🎁 Desde el 28/11/2026 el hilo sale con la franja de DRA, una imagen por aviso y tres botones que dan algo —«Reclama tu
drop diario», «La vitrina de hoy», «Mi tarjeta»— (bot/buzon_vista.js, bot/buzon_botones.js). Las imágenes las sube
`python bot/buzon_img.py --publicar`; sin eso el hilo sale igual, sin franja ni cuadritos. ⚠️ Los botones NO son
simulados: el drop del día que reclamas en el hilo de prueba es el tuyo de verdad.

Los simulados viven sólo en la campana (clave `sim:`): no dan XP, ni drops, ni puntos. Simular otra vez antes de las 24 h
muestra la regla: lo nuevo espera y se junta en el próximo hilo. Para ver otra tanda ya, limpiar primero.

El objeto elige a quién y arma el mensaje —con la MISMA bandeja que la campana de la página— y deja la ronda
reservada; acá se le piden los hilos a Discord y se le confirma qué salió. ¿Por qué acá y no en el vigía? El vigía
comparte 50 subpedidos por minuto con la lectura de los canales, y cada hilo son tres pedidos a Discord: crear el
hilo privado, sumar a la persona y el mensaje (que la menciona: sólo le suena a ella).

🔴 NUNCA UN DM: sólo `channels/<canal>/threads`, `thread-members` y `messages` del hilo (herramientas/sin_dm.py).
⚠️ Para todos, apagado mientras `ENCENDIDO = false` en bot/buzon.js (salvo la `PRUEBA` de hoy, sólo con Dlx):
el objeto contesta `encendido: false` y esto no hace nada.
⚠️ Nunca frena el ciclo: lo que no salió vuelve en la ronda siguiente.
"""
import json
import os
import sys
import time

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import clave_ciclo as CC  # noqa: E402

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

WORKER = 'https://liga-global-bot.liga-global-ul.workers.dev'
API = 'https://discord.com/api/v10'
#: entre hilo e hilo: Discord no publica el tope de crear hilos, y diez por hora con aire no se acercan a nada
PAUSA = 1.2


def _pedir(s, metodo, url, razon, cuerpo=None, intentos=5):
    """Un pedido a Discord respetando el 429 (`retry_after`). Devuelve la respuesta o `None`."""
    for _ in range(intentos):
        try:
            r = s.request(metodo, url, json=cuerpo, timeout=20,
                          headers={'X-Audit-Log-Reason': razon} if razon else None)
        except OSError:
            return None
        if r.status_code == 429:
            try:
                espera = float(r.json().get('retry_after', 1))
            except (ValueError, AttributeError):
                espera = 1.0
            time.sleep(min(espera, 30) + 0.3)
            continue
        return r
    return None


def _es_emoji(c):
    o = ord(c)
    return o >= 0x1F000 or 0x2600 <= o <= 0x27BF or o in (0xFE0F, 0x200D) or 0x1F3FB <= o <= 0x1F3FF


def estilo_hilo(nombre_canal, emoji='📬', texto='tus avisos'):
    """🎨 El nombre del hilo con el estilo de su canal (Dlx, 28/11/2026: «que se adapte al estilo de los canales que tiene
    alrededor»): `💬˚┊conversacion` → `📬˚┊tus avisos`. Se queda con el adorno entre el emoji del canal y su nombre; si el
    canal no tiene adorno, `📬 tus avisos`."""
    n = str(nombre_canal or '')
    i = 0
    while i < len(n) and _es_emoji(n[i]):
        i += 1
    j = i
    while j < len(n) and not n[j].isalnum():
        j += 1
    adorno = n[i:j] if i > 0 else ''
    return emoji + (adorno if adorno.strip() else ' ') + texto


def abrir(s, canal, razon, x):
    """Un hilo: crear (privado, sin invitar), sumar a la persona, el mensaje. El ID del hilo, o `None`.
    Si el hilo se creó y el mensaje no salió, se borra: un hilo vacío con la persona adentro no sirve de nada."""
    r = _pedir(s, 'POST', '%s/channels/%s/threads' % (API, canal), razon,
               {'name': x['nombre'][:90], 'type': 12, 'invitable': False, 'auto_archive_duration': 1440})
    if r is None or r.status_code not in (200, 201):
        return None
    hilo = str(r.json().get('id') or '')
    if not hilo:
        return None
    sumo = _pedir(s, 'PUT', '%s/channels/%s/thread-members/%s' % (API, hilo, x['quien']), razon)
    m = _pedir(s, 'POST', '%s/channels/%s/messages' % (API, hilo), None, x['msg'])
    if sumo is None or sumo.status_code not in (200, 204) or m is None or m.status_code not in (200, 201):
        _pedir(s, 'DELETE', '%s/channels/%s' % (API, hilo), razon)
        return None
    return hilo


def borrar(s, razon, hilo):
    """`True` si el hilo ya no está (borrado ahora, o ya no existía)."""
    r = _pedir(s, 'DELETE', '%s/channels/%s' % (API, hilo), razon)
    return r is not None and r.status_code in (200, 204, 404)


def _hora_et(ms):
    import datetime as dt
    try:
        from zoneinfo import ZoneInfo
        z = ZoneInfo('America/New_York')
    except Exception:                                     # noqa: BLE001
        z = dt.timezone(dt.timedelta(hours=-5))
    return dt.datetime.fromtimestamp(ms / 1000, z).strftime('%d/%m %I:%M %p ET')


def correr(s, w, aplicar, forzar=False):
    """`w(cuerpo) -> dict` le habla al objeto; `s` es la sesión de Discord. Devuelve el resumen."""
    r = w({'fase': 'ronda', 'simular': not aplicar, 'forzar': bool(forzar)})
    if not r or r.get('error'):
        print('   ⚠️ el objeto no contestó la ronda: %s' % (r or {}).get('error', 'sin respuesta'))
        return None
    if not r.get('encendido'):
        print('   ⏸️ el buzón está apagado (ENCENDIDO en bot/buzon.js): nada que hacer')
        return {'apagado': True}
    for k, txt in (('espera', 'ya hubo ronda en esta hora'), ('fuera_de_hora', 'fuera de horario: sólo se borran los viejos'),
                   ('sin_miembros', 'sin la lista de miembros del Pase: no le escribo a nadie')):
        if r.get(k):
            print('   🔵 %s' % txt)
    abrir_ = r.get('abrir') or []
    viejos = r.get('borrar') or []
    print('   📬 %d hilo(s) para abrir · %d para borrar · %s vivos · %s esperan%s'
          % (len(abrir_), len(viejos), r.get('vivos', '—'), r.get('esperan', '—'), ' · 🧪 prueba' if r.get('prueba') else ''))
    for e in r.get('en24') or []:
        print('      ⏳ %d aviso(s) esperan la regla de las 24 h: van juntos en el próximo hilo, desde el %s'
              % (e.get('n', 0), _hora_et(e.get('libre', 0))))
    if not aplicar:
        for x in abrir_[:10]:
            print('      abriría uno con %d aviso(s)' % x.get('n', 0))
        return {'abrir': len(abrir_), 'borrar': len(viejos), 'simulado': True}
    hechos = {'fase': 'hecho', 'abiertos': [], 'fallidos': [], 'borrados': []}
    for v in viejos:
        if borrar(s, r.get('razon'), v['hilo']):
            hechos['borrados'].append(v['rid'])
    nombre = None
    if abrir_:
        rc = _pedir(s, 'GET', '%s/channels/%s' % (API, r['canal']), None)
        if rc is not None and rc.status_code == 200:
            nombre = estilo_hilo(rc.json().get('name'))
    for x in abrir_:
        if nombre:
            x = dict(x, nombre=nombre)
        hilo = abrir(s, r['canal'], r.get('razon'), x)
        if hilo:
            hechos['abiertos'].append({'rid': x['rid'], 'hilo': hilo})
        else:
            hechos['fallidos'].append(x['rid'])
        time.sleep(PAUSA)
    c = w(hechos) or {}
    print('   ✅ abiertos %d · no salieron %d (vuelven en la próxima) · borrados %d%s'
          % (len(hechos['abiertos']), len(hechos['fallidos']), len(hechos['borrados']),
             '' if c.get('ok') else ' · ⚠️ el objeto no tomó la confirmación'))
    return {'abiertos': len(hechos['abiertos']), 'fallidos': len(hechos['fallidos']), 'borrados': len(hechos['borrados'])}


def main():
    if '--auto' in sys.argv:
        return 1 if _self_check() else 0
    import requests
    import fotos as F
    tok = F.env('DISCORD_TOKEN', obligatorio=False)
    if not tok:
        print('   ⚠️ sin DISCORD_TOKEN: el buzón no corre')
        return 0
    k = CC.clave(tok)
    s = requests.Session()
    s.headers['Authorization'] = 'Bot ' + tok

    def w(cuerpo):
        try:
            x = requests.post(WORKER + '/avisos/buzon', data=json.dumps(cuerpo, ensure_ascii=False).encode('utf-8'),
                              headers={'x-lg-ciclo': k, 'content-type': 'application/json'}, timeout=30)
            return x.json() if x.ok else {'error': 'http %s' % x.status_code}
        except (OSError, ValueError) as e:
            return {'error': str(e)[:80]}

    if '--limpiar-simulacion' in sys.argv:
        return limpiar(s, w)
    if '--simular' in sys.argv:
        return simular_prueba(s, w)
    correr(s, w, '--aplicar' in sys.argv)
    return 0


def _valor(flag):
    if flag in sys.argv:
        i = sys.argv.index(flag)
        return sys.argv[i + 1] if i + 1 < len(sys.argv) else ''
    return ''


def simular_prueba(s, w, tanda=None, tipos=None):
    """🧪 Los avisos de prueba a la campana de Dlx y la ronda en el momento (sin esperar la hora ni el horario)."""
    tanda = tanda if tanda is not None else (int(_valor('--tanda')) if _valor('--tanda').isdigit() else 0)
    tipos = tipos if tipos is not None else [t for t in _valor('--tipos').split(',') if t]
    x = w({'fase': 'simular', 'tanda': tanda, 'tipos': tipos})
    if not x or not x.get('ok'):
        print('   ⚠️ no pude simular: %s' % (x or {}).get('error', 'sin respuesta'))
        return 1
    print('   🧪 %d aviso(s) simulados en la campana: %s' % (x['n'], ', '.join(c[4:] for c in x['claves'])))
    correr(s, w, True, forzar=True)
    return 0


def limpiar(s, w):
    """🧹 Saca lo simulado del objeto y borra de Discord los hilos que lo llevaban."""
    x = w({'fase': 'limpiar'})
    if not x or not x.get('ok'):
        print('   ⚠️ no pude limpiar: %s' % (x or {}).get('error', 'sin respuesta'))
        return 1
    n = sum(1 for h in x.get('borrar') or [] if borrar(s, x.get('razon'), h['hilo']))
    print('   🧹 %d aviso(s) simulados fuera de la campana · %d hilo(s) borrados de Discord' % (x.get('avisos', 0), n))
    return 0


def _self_check():
    mal = 0

    def ok(c, que):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', que))

    print('\n  buzon.py — la parte del ciclo, sin red\n')

    class R:
        def __init__(self, st, j=None):
            self.status_code, self._j = st, j or {}

        def json(self):
            return self._j

    class S:
        """Un Discord de mentira: anota cada pedido; `guion` dice qué contesta cada ruta."""
        def __init__(self, guion):
            self.pedidos, self.guion = [], guion

        def request(self, metodo, url, json=None, timeout=None, headers=None):
            ruta = url.replace(API, '')
            self.pedidos.append((metodo, ruta, json, headers))
            for (m, pre), resp in list(self.guion.items()):
                if m == metodo and ruta.startswith(pre):
                    if isinstance(resp, list):
                        return resp.pop(0) if len(resp) > 1 else resp[0]
                    return resp
            return R(404)

    global PAUSA
    PAUSA = 0
    msg = {'flags': 32768, 'components': [], 'allowed_mentions': {'users': ['111111111111111111']}}
    ronda = {'encendido': True, 'canal': '882088482284122212', 'guild': '841017460341604382', 'razon': 'Liga Global: buzón',
             'abrir': [{'rid': 'a:1', 'quien': '111111111111111111', 'nombre': '📬 Tus avisos', 'msg': msg, 'n': 2},
                       {'rid': 'b:1', 'quien': '222222222222222222', 'nombre': '📬 Tus avisos', 'msg': msg, 'n': 1}],
             'borrar': [{'rid': 'v:1', 'hilo': '900000000000000001'}, {'rid': 'v:2', 'hilo': '900000000000000002'}]}
    al = []

    def w(c):
        al.append(c)
        return ronda if c['fase'] == 'ronda' else {'ok': True}

    s = S({('POST', '/channels/882088482284122212/threads'): [R(429, {'retry_after': 0}), R(201, {'id': '700000000000000001'}),
                                                              R(201, {'id': '700000000000000002'})],
           ('PUT', '/channels/700000000000000001/thread-members/'): R(204),
           ('POST', '/channels/700000000000000001/messages'): R(200, {'id': '1'}),
           ('PUT', '/channels/700000000000000002/thread-members/'): R(204),
           ('POST', '/channels/700000000000000002/messages'): R(403),
           ('DELETE', '/channels/900000000000000001'): R(204),
           ('DELETE', '/channels/900000000000000002'): R(404),
           ('DELETE', '/channels/700000000000000002'): R(204)})
    x = correr(s, w, True)
    h = al[-1]
    ok(x == {'abiertos': 1, 'fallidos': 1, 'borrados': 2}, 'uno abre, uno falla (el mensaje no salió) y los dos viejos se van: %s' % x)
    ok(h['abiertos'] == [{'rid': 'a:1', 'hilo': '700000000000000001'}] and h['fallidos'] == ['b:1'],
       'al objeto: el que salió con su hilo, el que no para soltarlo')
    ok(h['borrados'] == ['v:1', 'v:2'], 'un hilo que ya no existía (404) cuenta como borrado')
    crear = [p for p in s.pedidos if p[0] == 'POST' and p[1].endswith('/threads')]
    ok(len(crear) == 3 and crear[1][2]['type'] == 12 and crear[1][2]['invitable'] is False,
       'el 429 se espera y se repite; el hilo es privado (12) y nadie más puede invitar')
    ok(('DELETE', '/channels/700000000000000002', None, {'X-Audit-Log-Reason': 'Liga Global: buzón'}) in s.pedidos,
       'el hilo cuyo mensaje no salió se borra: no queda un hilo vacío')
    ok(not any('users/@me' in p[1] for p in s.pedidos), 'ningún pedido abre un DM')
    # apagado y simulado: no toca Discord
    s2 = S({})
    ok(correr(s2, lambda c: {'encendido': False}, True) == {'apagado': True} and not s2.pedidos, 'apagado: no toca Discord')
    s3 = S({})
    al.clear()
    y = correr(s3, w, False)
    ok(y['simulado'] and not s3.pedidos and al[0].get('simular') is True and len(al) == 1,
       'sin --aplicar: le pide al objeto que simule y no toca Discord')
    # 🧪 simular: primero los avisos, después la ronda FORZADA (sin esperar la hora) que abre el hilo
    al.clear()
    s4 = S({('POST', '/channels/882088482284122212/threads'): R(201, {'id': '700000000000000009'}),
            ('PUT', '/channels/700000000000000009/thread-members/'): R(204),
            ('POST', '/channels/700000000000000009/messages'): R(200, {'id': '1'}),
            ('DELETE', '/channels/'): R(204)})

    def w2(c):
        al.append(c)
        if c['fase'] == 'simular':
            return {'ok': True, 'n': 5, 'claves': ['sim:a', 'sim:b', 'sim:c', 'sim:d', 'sim:e']}
        if c['fase'] == 'limpiar':
            return {'ok': True, 'avisos': 5, 'borrar': [{'rid': 'sim:x', 'hilo': '700000000000000009'}],
                    'razon': 'Liga Global: buzón'}
        if c['fase'] == 'ronda':
            return dict(ronda, abrir=ronda['abrir'][:1], borrar=[])
        return {'ok': True}
    ok(simular_prueba(s4, w2, tanda=2, tipos=[]) == 0 and [c['fase'] for c in al] == ['simular', 'ronda', 'hecho']
       and al[0]['tanda'] == 2 and al[1]['forzar'] is True, '--simular: los avisos, la ronda forzada y la confirmación')
    al.clear()
    ok(limpiar(s4, w2) == 0 and ('DELETE', '/channels/700000000000000009', None,
                                 {'X-Audit-Log-Reason': 'Liga Global: buzón'}) in s4.pedidos,
       '--limpiar-simulacion: los saca del objeto y borra su hilo de Discord')
    print('\n  %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal


if __name__ == '__main__':
    sys.exit(main())
