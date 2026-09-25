# -*- coding: utf-8 -*-
"""LAS ALERTAS: por DM a Dlx si algo se traba; lo normal, al canal de Logs.

    python bot/alertar.py --ciclo JOB --estado success|failure [--run URL] [--salud]
    python bot/alertar.py --salud          mira lo que late solo
    python bot/alertar.py --normal "texto" un aviso de rutina al canal de Logs
    python bot/alertar.py --probar         un DM de prueba

🔴 LA REGLA ES DE DLX, 25/09/2026: *«por DM a mí únicamente. Si es algo
normal avísalo en el canal donde mencionas cosas con el repo de sync»*.
O sea dos salidas y ninguna más: lo que está roto le llega a él solo, en
privado; lo de rutina va al canal de Logs, el mismo donde `avisar.py`
anuncia las llaves y el repo de sync deja sus resúmenes.

⚠️ UNA ALERTA QUE SE REPITE CADA MEDIA HORA ES UNA PARED DE MENSAJES. Es
la misma lección que `avisar.py` con las llaves —*«avisar una vez, y
editar»*—: cada problema tiene una clave, y la misma clave no se vuelve a
mandar en 6 horas. Y cuando se arregla solo, llega UN mensaje diciendo
que volvió: sin eso, el silencio de después no se distingue de que la
alerta dejó de funcionar.

⚠️ EL ESTADO SOBREVIVE AL RUNNER: vive en `datos/alertas.json`, que
`bot/ci/guardar.sh` guarda. Un dedup que se olvida en cada corrida no es
un dedup (el aviso de llaves ya pasó por eso).

⚠️ NUNCA HACE FALLAR AL CICLO: si no puede mandar, lo dice y sale bien.
Una alerta que tumba lo que vigila es peor que no tenerla.
"""
import datetime
import io
import json
import os
import re
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
ESTADO = os.path.join(BASE, 'datos', 'alertas.json')
API = 'https://discord.com/api/v10'
WORKER = 'https://liga-global-bot.liga-global-ul.workers.dev'
#: cuánto se calla una alerta que ya se mandó
SILENCIO_H = 6
#: la cuota de KV es de 1.000 escrituras por día para toda la cuenta
KV_AVISO = 900


def _ahora():
    return datetime.datetime.now(datetime.timezone.utc)


def _et(t=None):
    import zoneinfo
    t = (t or _ahora()).astimezone(zoneinfo.ZoneInfo('America/New_York'))
    return t.strftime('%d/%m ') + t.strftime('%I:%M %p').lstrip('0') + ' ET'


def dueno():
    """El Discord ID de Dlx, del Worker —su único lugar—, no copiado acá."""
    with io.open(os.path.join(SCR, 'worker.js'), encoding='utf-8') as f:
        m = re.search(r"const DUENO = '(\d+)'", f.read())
    return m.group(1) if m else ''


def canal_logs():
    import avisar
    return avisar.CANAL


def _discord():
    import requests
    import fotos as F
    tok = F.env('DISCORD_TOKEN', obligatorio=False)
    if not tok:
        return None
    s = requests.Session()
    s.headers['Authorization'] = 'Bot ' + tok
    s.headers['Content-Type'] = 'application/json'
    return s


def _mandar(s, canal, texto):
    r = s.post('%s/channels/%s/messages' % (API, canal), timeout=20,
               data=json.dumps({'content': texto[:1900],
                                'allowed_mentions': {'parse': []}}))
    return r.status_code == 200, r.status_code


def dm(texto):
    s = _discord()
    if not s:
        print('   ⚠️ sin DISCORD_TOKEN: no puedo mandar el DM')
        return False
    try:
        r = s.post('%s/users/@me/channels' % API, timeout=20,
                   data=json.dumps({'recipient_id': dueno()}))
        if r.status_code != 200:
            print('   ⚠️ no pude abrir el DM con Dlx (%d)' % r.status_code)
            return False
        ok, cod = _mandar(s, r.json()['id'], texto)
        if not ok:
            print('   ⚠️ el DM no salió (%d)' % cod)
        return ok
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ el DM no salió (%s)' % str(e)[:80])
        return False


def normal(texto):
    s = _discord()
    if not s:
        return False
    try:
        ok, cod = _mandar(s, canal_logs(), texto)
        if not ok:
            print('   ⚠️ el aviso al canal de Logs no salió (%d)' % cod)
        return ok
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ el aviso al canal de Logs no salió (%s)' % str(e)[:80])
        return False


# ── el recuerdo de lo que ya se avisó ─────────────────────────────────
def _leer():
    try:
        with io.open(ESTADO, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def _guardar(d):
    with io.open(ESTADO, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(d, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write('\n')


def alertar(clave, texto):
    """Un problema. Se manda si es nuevo o si pasaron 6 h desde el último."""
    d = _leer()
    ya = d.get(clave)
    if ya:
        t = datetime.datetime.fromisoformat(ya['t'])
        if (_ahora() - t).total_seconds() < SILENCIO_H * 3600:
            print('   (%s ya se avisó a las %s: me callo)' % (clave, _et(t)))
            return False
    ok = dm('🔴 ' + texto)
    if ok:
        d[clave] = {'t': _ahora().isoformat(), 'texto': texto[:300]}
        _guardar(d)
        print('   📨 DM a Dlx: %s' % texto[:90])
    return ok


def resuelto(clave, texto):
    """Si esa clave estaba avisada, UN mensaje de que volvió, y se olvida."""
    d = _leer()
    if clave not in d:
        return False
    if dm('✅ ' + texto):
        d.pop(clave, None)
        _guardar(d)
        print('   📨 DM a Dlx: %s' % texto[:90])
        return True
    return False


def recordar(clave, texto):
    """Un recordatorio que pidió Dlx: se manda UNA vez y queda anotado.

    ⚠️ NO ES UNA ALERTA: `alertar()` repite cada 6 h mientras el problema
    siga, y un recordatorio repetido es una pared de mensajes por algo que
    no está roto.
    """
    d = _leer()
    if d.get('recordado:' + clave):
        return False
    ok = dm('🔔 ' + texto)
    if ok:
        d['recordado:' + clave] = {'t': _ahora().isoformat(), 'texto': texto[:300]}
        _guardar(d)
        print('   📨 recordatorio a Dlx: %s' % texto[:90])
    return ok


# ── lo que late solo ──────────────────────────────────────────────────
def salud():
    """El vigía de avisos, el disparador del ciclo y la cuota de KV."""
    import requests
    # 1 · el vigía de avisos: late cada minuto en el Worker
    j = {}
    try:
        j = requests.get(WORKER + '/avisos/estado', timeout=25).json()
        v = j.get('vigia') or {}
        if j.get('ok'):
            resuelto('vigia', 'El vigía de avisos volvió a latir.')
        else:
            hace = v.get('hace_s')
            alertar('vigia', 'El vigía de avisos no anda: %s. Los avisos de '
                    'eventos no están saliendo. (%s)' % (
                        ('no late hace %d min' % (hace // 60)) if hace
                        else (', '.join(v.get('errores') or []) or v.get('error')
                              or 'no hay latido'), _et()))
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ no pude preguntarle al vigía (%s)' % str(e)[:80])
    # 2 · el disparador del ciclo: el cron del Worker a los :22 y :52
    try:
        import fotos as F
        tok = F.env('CLOUDFLARE_API_TOKEN', obligatorio=False)
        if tok:
            s = requests.Session()
            s.headers['Authorization'] = 'Bearer ' + tok
            import cuotas as C
            import desplegar as D
            # 🔑 LA MARCA VIVE EN EL DURABLE OBJECT desde el 25/09/2026 (ver
            # `marcarDisparo()` en `avisos.js`) y llega con el estado del
            # vigía, que ya se pidió arriba. ⚠️ KV QUEDA DE RESPALDO: es
            # donde el Worker la escribe si el objeto no contesta, y donde
            # estaba antes de ese cambio.
            c = (j.get('disparador') or {}).get('ultimo') or None
            if not c:
                r = s.get('https://api.cloudflare.com/client/v4/accounts/%s/storage/kv/'
                          'namespaces/%s/values/cron:ultimo' % (C.CUENTA, D.KV_ID),
                          timeout=25)
                if r.status_code == 200:
                    c = json.loads(r.content.decode('utf-8'))
            if c:
                t = datetime.datetime.fromisoformat(c['t'].replace('Z', '+00:00'))
                viejo = (_ahora() - t).total_seconds() / 60
                # 🌙 de madrugada el disparador se calla ~4 h a propósito:
                # ver `bot/madrugada.py`
                import madrugada as MD
                if viejo > MD.pausa_max() or not c.get('ok'):
                    alertar('disparador', 'El disparador del ciclo no anda: su último '
                            'intento fue %s (%s). El ciclo queda sólo con el cron de '
                            'GitHub, que dispara 1 de cada 9 veces.'
                            % (_et(t), 'ok' if c.get('ok') else 'falló: %s' % c.get('estado')))
                else:
                    resuelto('disparador', 'El disparador del ciclo volvió a andar.')
            # 3 · la cuota de KV del día (se agotó el 24/09 y congeló el hub)
            usado = (C.kv_hoy(s) or {}).get('write')
            if usado is not None and usado >= KV_AVISO:
                alertar('kv', 'KV lleva %d escrituras hoy de 1.000: si se agotan, el '
                        'hub y /card se congelan hasta las 8 PM ET.' % usado)
            elif usado is not None:
                resuelto('kv', 'La cuota de KV volvió a tener margen (%d hoy).' % usado)
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ no pude mirar el disparador ni KV (%s)' % str(e)[:80])
    # 4 · 🔔 A7, EL SCORE A 40–99. Dlx, 25/09/2026: «aplicalo en otro
    # momento… hazme recordar, ahora no». El momento importa: mientras
    # nadie tenga 10 eventos no hay letras, y cambiar la escala no le mueve
    # nada a nadie; después se la mueve a mitad de temporada. Por eso avisa
    # cuando el primero llega a 8, y una sola vez.
    try:
        with io.open(os.path.join(BASE, 'datos', 'temporada_pool.json'), encoding='utf-8') as f:
            pool = json.load(f)
        top = max(pool, key=lambda p: p.get('ev') or 0) if pool else None
        if top and (top.get('ev') or 0) >= 8:
            recordar('a7', 'Lo que me pediste recordarte: **A7**, llevar el Score del '
                     'Competitivo a 40–99. **%s ya tiene %d eventos**: cuando alguien llega a '
                     '10 tiene letra, y cambiar la escala después se la mueve a mitad de '
                     'temporada. Si va, decime y lo aplico junto con los umbrales de los '
                     '8 rangos.' % (top.get('raw'), top.get('ev')))
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ no pude mirar el recordatorio de A7 (%s)' % str(e)[:80])


def main():
    a = sys.argv[1:]
    val = lambda k: a[a.index(k) + 1] if k in a and a.index(k) + 1 < len(a) else ''
    if '--probar' in a:
        ok = dm('✅ Prueba: las alertas del ciclo te llegan por acá, y sólo a vos. '
                'Lo normal va al canal de Logs. (%s)' % _et())
        print('   %s' % ('DM mandado' if ok else 'no salió'))
        return
    if '--normal' in a:
        normal(val('--normal'))
        return
    if '--ciclo' in a:
        job, estado, run = val('--ciclo'), val('--estado'), val('--run')
        que = ('La auditoría semanal' if job == 'auditoria'
               else 'El ciclo, en «%s»,' % job)
        if estado == 'failure':
            alertar('ciclo:' + job, '%s falló (%s).%s' % (
                que, _et(), ('\n' + run) if run else ''))
        elif estado == 'cancelled':
            # 🔴 UN TRABAJO QUE SE CUELGA NO SALE «failure»: GitHub lo corta al
            # llegar a `timeout-minutes` y lo marca «cancelled», y este paso
            # sólo miraba las otras dos palabras. O sea que el caso más mudo
            # —Chromium trabado, la red colgada— era justo el que no avisaba.
            # Y el de crecer: el redibujo entero del 25/09 tardó 53,5 min
            # contra un tope de 120, con 331 personas.
            # ⚠️ Lo sellado queda: las cartas se sellan por tanda, así que
            # un corte pierde sólo la tanda en curso y la próxima sigue.
            alertar('ciclo:' + job, '%s se cortó antes de terminar (%s): llegó a su '
                    'tiempo máximo o alguien la canceló. Lo que alcanzó a sellar queda; '
                    'el resto sigue en la próxima corrida.%s' % (
                        que, _et(), ('\n' + run) if run else ''))
        elif estado == 'success':
            resuelto('ciclo:' + job, '%s volvió a andar (%s).' % (que, _et()))
    if '--salud' in a:
        salud()


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    try:
        main()
    except Exception as e:                               # noqa: BLE001
        # ⚠️ nunca tumba al ciclo
        print('   ⚠️ alertar.py: %s' % str(e)[:120])
