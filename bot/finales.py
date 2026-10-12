# -*- coding: utf-8 -*-
"""🏁 ¿QUIÉN GANÓ LA FINAL? SE LE PREGUNTA A QUIEN PUBLICÓ LA LLAVE, CON DOS BOTONES.

    python bot/finales.py --auto      el self-check (sin red)
    python bot/finales.py             qué hay preguntado y qué se contestó (sólo lee)

Dlx, 12/10/2026: *«hazlo interactivo, osea con 2 botones y menciona al organizador, osea el de la llave misma»*.
Lo que más llega a ✅ Decidir es una final sin ganador escrito —FVS UNDER, POESÍA CRUDA—, y quien sabe quién ganó es
el que organizó. Cuando una llave lleva `QUIETA_H` horas sin campeón (`llaves_a_entrada`, los «incompletos») y su
última ronda es una batalla de dos, el ciclo contesta a la llave en su mismo canal:

    🏁 **FVS UNDER** — @zamo1., la llave no dice quién ganó la final: **Mathias** vs **Rfran**. ¿Quién ganó?
    [ Mathias ] [ Rfran ]

El click lo atiende el Worker (`que === 'fin'` en `bot/worker.js`): vale el del organizador, el del staff del
servidor o el de Dlx, y queda en el objeto (`finalElegir()` en `bot/avisos.js`). La corrida siguiente lo trae
(`/avisos/finales`) y lo escribe en `datos/decisiones.json` como cualquier batalla decidida en ✅ Decidir, y la llave
se carga con su campeón.

⚠️ UNA PREGUNTA POR LLAVE, PARA SIEMPRE: lo preguntado vive en `datos/finales.json` (lo guarda el ciclo:
`bot/ci/guardar.sh`). Sin eso cada corrida volvería a mencionar al organizador.
⚠️ SÓLO LLAVES DE LOS ÚLTIMOS `DIAS` DÍAS: mencionar a alguien por una final de hace tres semanas es ruido.
⚠️ Y COMO MUCHO `TOPE` POR CORRIDA, por si un lector roto deja veinte llaves «sin campeón» de golpe.
"""
import datetime
import io
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ESTADO = os.path.join(BASE, 'datos', 'finales.json')
API = 'https://discord.com/api/v10'
DIAS = 14
TOPE = 5


def _cargar():
    try:
        with io.open(ESTADO, encoding='utf-8') as f:
            return json.load(f) or {}
    except (OSError, ValueError):
        return {}


def _guardar(d):
    d['_leeme'] = ('Las finales sin campeón que el ciclo le preguntó a quien publicó la llave, con dos botones '
                   '(bot/finales.py). Una por llave, por su ID: así nunca se pregunta dos veces. Dlx, 12/10/2026.')
    with io.open(ESTADO, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(d, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write('\n')


def _ahora():
    t = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=4)
    return t.strftime('%Y-%m-%d %I:%M %p ET').replace(' 0', ' ')


def _token():
    sys.path.insert(0, os.path.join(BASE, 'bot'))
    import avisar
    return avisar._token()


def mensaje(f):
    """El cuerpo de la pregunta: el texto, los dos botones y a quién se menciona (sólo al organizador)."""
    lados = [str(x).strip() for x in f['lados']]
    return {
        'content': ('🏁 **%s** — <@%s>, la llave no dice quién ganó la %s: **%s** vs **%s**. ¿Quién ganó?\n'
                    '-# Lo marca quien publicó la llave o el staff. Con eso suma al ranking de la Liga.'
                    % (f['evento'], f['autor'], str(f.get('ronda') or 'final').lower(), lados[0], lados[1])),
        'components': [{'type': 1, 'components': [
            {'type': 2, 'style': 1, 'label': lados[i][:80], 'custom_id': 'fin:%s:%s:%s' % (f['llave'], f['autor'], ab)}
            for i, ab in ((0, 'a'), (1, 'b'))]}],
        'message_reference': {'message_id': f['llave'], 'channel_id': f['canal'], 'fail_if_not_exists': False},
        'allowed_mentions': {'users': [f['autor']], 'replied_user': False},
    }


def para_preguntar(finales, estado, hoy=None):
    """Las de `finales` que se preguntan esta corrida: nuevas, de dos lados, con organizador y de los últimos `DIAS`."""
    hoy = hoy or datetime.datetime.now(datetime.timezone.utc)
    out = []
    for f in finales:
        if str(f.get('llave')) in estado or len(f.get('lados') or ()) != 2 or not str(f.get('autor') or '').isdigit():
            continue
        try:
            t = datetime.datetime.fromisoformat(str(f.get('cuando') or '').replace('Z', '+00:00'))
        except ValueError:
            continue
        if t.tzinfo is None:
            t = t.replace(tzinfo=datetime.timezone.utc)
        if (hoy - t).days > DIAS:
            continue
        out.append(f)
    return out[:TOPE]


def preguntar(finales):
    """Manda las preguntas nuevas. `finales`: `[{llave, canal, autor, evento, sv, fecha, ronda, lados, cuando}]`."""
    estado = _cargar()
    nuevas = para_preguntar(finales, estado)
    if not nuevas:
        return 0
    import requests
    t = _token()
    if not t:
        print('   ⚠️ finales: sin token, no pregunto')
        return 0
    cab = {'Authorization': 'Bot ' + t, 'Content-Type': 'application/json'}
    n = 0
    for f in nuevas:
        try:
            r = requests.post('%s/channels/%s/messages' % (API, f['canal']), headers=cab,
                              data=json.dumps(mensaje(f)), timeout=20)
        except Exception as e:                           # noqa: BLE001
            print('   ⚠️ finales: %s · %s' % (f['evento'], str(e)[:60]))
            continue
        if r.status_code not in (200, 201):
            print('   ⚠️ finales: %s · Discord dijo %s' % (f['evento'], r.status_code))
            # 🔴 sin permiso de escribir ahí no se reintenta cada hora: queda anotada igual
            if r.status_code != 403:
                continue
        estado[str(f['llave'])] = dict(f, pregunta=(r.json().get('id') if r.status_code in (200, 201) else ''),
                                       preguntada=_ahora(), sin_permiso=r.status_code == 403)
        n += 1
        print('   🏁 pregunté la final de %s · %s a <@%s>' % (f['evento'], f['sv'], f['autor']))
    _guardar(estado)
    return n


def respuestas():
    """`{id de la llave: {nombre, lado, quien, t}}` del objeto, o `{}`."""
    try:
        import hashlib
        import requests
        t = _token()
        if not t:
            return {}
        sys.path.insert(0, os.path.join(BASE, 'bot'))
        import avisar
        k = hashlib.sha256(('lg-ciclo:' + t).encode('utf-8')).hexdigest()
        r = requests.get(avisar.WORKER + '/avisos/finales', headers={'x-lg-ciclo': k}, timeout=20)
        d = r.json() if r.ok else {}
        return d if isinstance(d, dict) else {}
    except Exception:                                    # noqa: BLE001
        return {}


def aplicar_respuestas(resp=None):
    """Lo que contestaron los organizadores, a `datos/decisiones.json` (`batallas`). Devuelve cuántas."""
    estado = _cargar()
    pend = {k: f for k, f in estado.items() if isinstance(f, dict) and not f.get('ganador')}
    if not pend:
        return 0
    resp = respuestas() if resp is None else resp
    sys.path[:0] = [os.path.join(BASE, 'sheet')]
    import decidir as DEC
    dd = DEC._decisiones()
    n = 0
    for k, f in pend.items():
        x = resp.get(k)
        if not x or x.get('nombre') not in [str(l).strip()[:80] for l in f['lados']]:
            continue
        gano = next(l for l in f['lados'] if str(l).strip()[:80] == x['nombre'])
        det = DEC.detalle_batalla(f['evento'], f['sv'], f['fecha'], f.get('ronda') or 'FINAL', f['lados'])
        dd.setdefault('batallas', {})[DEC.clave_batalla(det)] = {
            'ganador': gano, 'batalla': det, 'cuando': _ahora(),
            'por': 'el organizador, con el botón (<@%s>)' % x.get('quien', ''),
            'nota': 'bot/finales.py: la llave no decía quién ganó y se lo preguntó a quien la publicó'}
        f['ganador'] = gano
        n += 1
        print('   🏁 %s · %s: ganó %s (lo marcó %s)' % (f['evento'], f['sv'], gano, x.get('quien', '')))
    if n:
        with io.open(DEC.DECISIONES, 'w', encoding='utf-8', newline='\n') as fh:
            json.dump(dd, fh, ensure_ascii=False, indent=1)
            fh.write('\n')
        _guardar(estado)
    return n


def _self_check():
    malos = []
    hoy = datetime.datetime(2026, 10, 12, 12, tzinfo=datetime.timezone.utc)
    f = {'llave': '1553507758240964609', 'canal': '1337126410354950195', 'autor': '832733202769641554',
         'evento': 'FVS UNDER', 'sv': 'FVS', 'fecha': '26/09', 'ronda': 'FINAL', 'lados': ['Mathias 🇪🇸', 'Rfran 🇪🇸'],
         'cuando': '2026-10-05T20:45:00+00:00'}
    m = mensaje(f)
    if m['allowed_mentions'] != {'users': ['832733202769641554'], 'replied_user': False}:
        malos.append('menciona a alguien más que al organizador')
    ids = [c['custom_id'] for c in m['components'][0]['components']]
    if ids != ['fin:1553507758240964609:832733202769641554:a', 'fin:1553507758240964609:832733202769641554:b']:
        malos.append('los botones: %s' % ids)
    if any(len(x) > 100 for x in ids):
        malos.append('un custom_id pasa de 100')
    if [x['llave'] for x in para_preguntar([f], {}, hoy)] != [f['llave']]:
        malos.append('una final de hace 7 días no se pregunta')
    if para_preguntar([f], {f['llave']: {}}, hoy):
        malos.append('se pregunta dos veces la misma llave')
    if para_preguntar([dict(f, cuando='2026-09-20T00:00:00+00:00')], {}, hoy):
        malos.append('se pregunta una de hace más de %d días' % DIAS)
    if para_preguntar([dict(f, lados=['A', 'B', 'C'])], {}, hoy):
        malos.append('una de tres lados no tiene dos botones')
    if len(para_preguntar([dict(f, llave=str(i)) for i in range(10)], {}, hoy)) != TOPE:
        malos.append('el tope por corrida')
    for x in malos:
        print('   ❌ %s' % x)
    print('   %s finales: la pregunta, los botones y cuándo se pregunta' % ('❌' if malos else '✅'))
    return bool(malos)


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        return 1 if _self_check() else 0
    estado = {k: v for k, v in _cargar().items() if isinstance(v, dict)}
    print('%d preguntada(s)' % len(estado))
    for k, f in sorted(estado.items(), key=lambda x: x[1].get('preguntada', '')):
        print('   %s · %s · %s → %s' % (f['evento'], f['sv'], f.get('preguntada', ''), f.get('ganador') or 'sin contestar'))
    return 0


if __name__ == '__main__':
    sys.exit(main())
