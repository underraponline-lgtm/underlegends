# -*- coding: utf-8 -*-
"""🏁 LO QUE EL LECTOR NO ENTENDIÓ DE UNA LLAVE, SE LE PREGUNTA A QUIEN LA PUBLICÓ — CON BOTONES O UN MENÚ.

    python bot/finales.py --auto      el self-check (sin red)
    python bot/finales.py             qué hay preguntado y qué se contestó (sólo lee)

Dlx, 12/10/2026: *«hazlo interactivo, osea con 2 botones y menciona al organizador, osea el de la llave misma»*, y
después: *«si el bot no entendió muy bien la llave en algunas cosas, que le pregunte al organizador… al finalizar el
evento, o sea casi de inmediato, pero que sea algo sencillo, tampoco tantas preguntas… con botones o con menú»*.

CUÁNDO (lo decide `llaves_a_entrada`):
    · la llave ya tiene campeón y le quedaron batallas sin ganador: en la corrida siguiente;
    · le falta la final: cuando lleva `PREGUNTA_H` hora sin que nadie la toque (antes eran 12 h a ✅ Decidir).

CÓMO: UN mensaje por llave, contestando a la llave en su canal y mencionando sólo a quien la publicó, con hasta
`MAX_PREGUNTAS` batallas —la final primero—. Una sola de dos lados va con dos botones; si son varias, un menú por
batalla con sus lados y «Nadie siguió». Cada respuesta se tacha del mensaje (`que === 'dud'` en `bot/worker.js`), queda
en el objeto (`finalElegir()` en `bot/avisos.js`) y la corrida siguiente la pasa a `datos/decisiones.json` como una
batalla decidida en ✅ Decidir. Lo que no se pregunta —o no se contesta— sigue yendo a ✅ Decidir como siempre.

⚠️ UNA VEZ POR LLAVE, PARA SIEMPRE (`datos/finales.json`, lo guarda `bot/ci/guardar.sh`): sin eso cada corrida
volvería a mencionar al organizador. Sólo llaves de los últimos `DIAS` días, y como mucho `TOPE` mensajes por corrida.
"""
import datetime
import io
import json
import os
import sys
import clave_ciclo as CC  # noqa: E402  la clave del ciclo, en un solo lugar

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ESTADO = os.path.join(BASE, 'datos', 'finales.json')
API = 'https://discord.com/api/v10'
DIAS = 14
TOPE = 5
MAX_PREGUNTAS = 4
#: la llave sin final se pregunta después de esta hora quieta (las demás, apenas tienen campeón)
PREGUNTA_H = 1
#: el valor del menú para «nadie siguió» (`decidir.NADIE`)
NADIE_V = 'z'
LETRAS = 'abcdefghijklmnopqrstuvwxy'


def _cargar():
    try:
        with io.open(ESTADO, encoding='utf-8') as f:
            return json.load(f) or {}
    except (OSError, ValueError):
        return {}


def _guardar(d):
    d['_leeme'] = ('Las llaves que el ciclo no entendió y se las preguntó a quien las publicó, con botones o un menú '
                   '(bot/finales.py). Una vez por llave, por su ID: así nunca se pregunta dos veces. Dlx, 12/10/2026.')
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


def _cual(p):
    return '%s: %s' % (str(p['ronda']).capitalize(), ' vs '.join(str(x).strip() for x in p['lados']))


def mensaje(f):
    """El mensaje: el texto, los componentes y a quién se menciona (sólo al organizador)."""
    ps = f['preguntas'][:MAX_PREGUNTAS]
    base = 'dud:%s:%s' % (f['llave'], f['autor'])
    if len(ps) == 1 and len(ps[0]['lados']) == 2:
        p = ps[0]
        texto = ('🏁 **%s** — <@%s>, la llave no dice quién ganó %s: **%s** vs **%s**. ¿Quién ganó?'
                 % (f['evento'], f['autor'], 'la final' if 'final' in str(p['ronda']).lower()
                    else 'esta batalla (%s)' % str(p['ronda']).lower(), p['lados'][0], p['lados'][1]))
        filas = [{'type': 1, 'components': [
            {'type': 2, 'style': 1, 'label': str(p['lados'][j]).strip()[:80], 'custom_id': '%s:0:%s' % (base, LETRAS[j])}
            for j in range(2)]}]
    else:
        texto = ('🏁 **%s** — <@%s>, no pude leer quién ganó %d batalla(s) de la llave. ¿Me ayudás?'
                 % (f['evento'], f['autor'], len(ps)))
        filas = []
        for i, p in enumerate(ps):
            ops = [{'label': str(x).strip()[:100], 'value': LETRAS[j]} for j, x in enumerate(p['lados'][:24])]
            if 'final' not in str(p['ronda']).lower():
                ops.append({'label': 'Nadie siguió (fue reemplazado o no se presentó)', 'value': NADIE_V})
            filas.append({'type': 1, 'components': [{'type': 3, 'custom_id': '%s:%d' % (base, i),
                                                     'placeholder': _cual(p)[:150], 'options': ops}]})
    return {
        'content': texto + '\n-# Lo marca quien publicó la llave o el staff. Con eso la llave entra al ranking de la Liga.',
        'components': filas,
        'message_reference': {'message_id': f['llave'], 'channel_id': f['canal'], 'fail_if_not_exists': False},
        'allowed_mentions': {'users': [f['autor']], 'replied_user': False},
    }


def para_preguntar(llaves, estado, hoy=None):
    """Las de `llaves` que se preguntan esta corrida: nuevas, con organizador, con algo que preguntar y recientes."""
    hoy = hoy or datetime.datetime.now(datetime.timezone.utc)
    out = []
    for f in llaves:
        if (str(f.get('llave')) in estado or not f.get('preguntas') or not str(f.get('autor') or '').isdigit()
                or not str(f.get('canal') or '').isdigit()):
            continue
        try:
            t = datetime.datetime.fromisoformat(str(f.get('cuando') or '').replace('Z', '+00:00'))
        except ValueError:
            continue
        if t.tzinfo is None:
            t = t.replace(tzinfo=datetime.timezone.utc)
        if (hoy - t).days > DIAS:
            continue
        out.append(dict(f, preguntas=f['preguntas'][:MAX_PREGUNTAS]))
    return out[:TOPE]


def preguntar(llaves):
    """Manda las preguntas nuevas. `llaves`: `[{llave, canal, autor, evento, sv, fecha, cuando, preguntas:
    [{ronda, lados}]}]`, la final primero."""
    estado = _cargar()
    nuevas = para_preguntar(llaves, estado)
    if not nuevas:
        return 0
    import requests
    t = _token()
    if not t:
        print('   ⚠️ preguntas al organizador: sin token')
        return 0
    cab = {'Authorization': 'Bot ' + t, 'Content-Type': 'application/json'}
    n = 0
    for f in nuevas:
        try:
            r = requests.post('%s/channels/%s/messages' % (API, f['canal']), headers=cab,
                              data=json.dumps(mensaje(f)), timeout=20)
        except Exception as e:                           # noqa: BLE001
            print('   ⚠️ preguntas: %s · %s' % (f['evento'], str(e)[:60]))
            continue
        if r.status_code not in (200, 201):
            print('   ⚠️ preguntas: %s · Discord dijo %s %s' % (f['evento'], r.status_code, r.text[:80]))
            # 🔴 sin permiso de escribir ahí no se reintenta cada media hora: queda anotada igual
            if r.status_code != 403:
                continue
        estado[str(f['llave'])] = dict(f, pregunta=(r.json().get('id') if r.status_code in (200, 201) else ''),
                                       preguntada=_ahora(), sin_permiso=r.status_code == 403, respondidas={})
        n += 1
        print('   🏁 le pregunté a <@%s> %d batalla(s) de %s · %s' % (f['autor'], len(f['preguntas']), f['evento'], f['sv']))
    _guardar(estado)
    return n


def respuestas():
    """`{'<llave>:<i>': {nombre, v, quien, t}}` del objeto, o `{}`."""
    try:
        import requests
        t = _token()
        if not t:
            return {}
        import avisar
        k = CC.clave(t)
        r = requests.get(avisar.WORKER + '/avisos/finales', headers={'x-lg-ciclo': k}, timeout=20)
        d = r.json() if r.ok else {}
        return d if isinstance(d, dict) else {}
    except Exception:                                    # noqa: BLE001
        return {}


def pendientes(estado):
    """Las llaves con preguntas sin aplicar. ⚠️ NUNCA UNA RETIRADA (`retirada` en `datos/finales.json`): la pregunta
    sigue en Discord con su menú, y un clic tardío no tiene que entrar al ranking. El 12/10/2026 se retiraron las de
    tres llaves que juntaban gente sin «+» (Fecha Rempalago Vol. 64, DENME MODERADOR LPM y Cuentas Pendientes V.1):
    ver `llaves_a_entrada.junta_sin_mas()`."""
    return {k: f for k, f in estado.items() if isinstance(f, dict) and not f.get('retirada')
            and len(f.get('respondidas') or {}) < len(f.get('preguntas') or [])}


def aplicar_respuestas(resp=None):
    """Lo que contestaron los organizadores, a `datos/decisiones.json` (`batallas`). Devuelve cuántas."""
    estado = _cargar()
    pend = pendientes(estado)
    if not pend:
        return 0
    resp = respuestas() if resp is None else resp
    sys.path[:0] = [os.path.join(BASE, 'sheet')]
    import decidir as DEC
    dd = DEC._decisiones()
    n = 0
    for k, f in pend.items():
        for i, p in enumerate(f['preguntas']):
            x = resp.get('%s:%d' % (k, i))
            if str(i) in (f.get('respondidas') or {}) or not x:
                continue
            v = str(x.get('v') or '')
            if v == NADIE_V:
                gano = DEC.NADIE
            elif len(v) == 1 and v in LETRAS[:len(p['lados'])]:
                gano = p['lados'][LETRAS.index(v)]
            else:
                continue
            det = DEC.detalle_batalla(f['evento'], f['sv'], f['fecha'], p['ronda'], p['lados'])
            dd.setdefault('batallas', {})[DEC.clave_batalla(det)] = {
                'ganador': gano, 'batalla': det, 'cuando': _ahora(),
                'por': 'el organizador, con %s (<@%s>)' % ('el botón' if v in 'ab' and len(f['preguntas']) == 1
                                                           else 'el menú', x.get('quien', '')),
                'nota': 'bot/finales.py: el lector no entendió esa batalla y se la preguntó a quien publicó la llave'}
            f.setdefault('respondidas', {})[str(i)] = gano
            n += 1
            print('   🏁 %s · %s · %s: %s (lo marcó %s)' % (f['evento'], f['sv'], p['ronda'], gano, x.get('quien', '')))
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
         'evento': 'FVS UNDER', 'sv': 'FVS', 'fecha': '26/09', 'cuando': '2026-10-05T20:45:00+00:00',
         'preguntas': [{'ronda': 'FINAL', 'lados': ['Mathias 🇪🇸', 'Rfran 🇪🇸']}]}
    m = mensaje(f)
    if m['allowed_mentions'] != {'users': ['832733202769641554'], 'replied_user': False}:
        malos.append('menciona a alguien más que al organizador')
    ids = [c['custom_id'] for c in m['components'][0]['components']]
    if ids != ['dud:1553507758240964609:832733202769641554:0:a', 'dud:1553507758240964609:832733202769641554:0:b']:
        malos.append('una sola final: dos botones (%s)' % ids)
    f2 = dict(f, preguntas=[{'ronda': 'FINAL', 'lados': ['A', 'B']}, {'ronda': 'CUARTOS', 'lados': ['C', 'D', 'E']},
                            {'ronda': 'OCTAVOS', 'lados': ['F', 'G']}, {'ronda': 'OCTAVOS', 'lados': ['H', 'I']},
                            {'ronda': 'OCTAVOS', 'lados': ['J', 'K']}])
    m2 = mensaje(f2)
    sel = [r['components'][0] for r in m2['components']]
    if len(sel) != MAX_PREGUNTAS or any(c['type'] != 3 for c in sel):
        malos.append('varias: un menú por batalla, como mucho %d' % MAX_PREGUNTAS)
    if [o['value'] for o in sel[1]['options']] != ['a', 'b', 'c', NADIE_V] or NADIE_V in [o['value'] for o in sel[0]['options']]:
        malos.append('las opciones: los lados y «nadie siguió», que la final no lleva')
    if any(len(c['custom_id']) > 100 for c in sel):
        malos.append('un custom_id pasa de 100')
    if [x['llave'] for x in para_preguntar([f], {}, hoy)] != [f['llave']]:
        malos.append('una llave de hace 7 días no se pregunta')
    if para_preguntar([f], {f['llave']: {}}, hoy):
        malos.append('se pregunta dos veces la misma llave')
    if para_preguntar([dict(f, cuando='2026-09-20T00:00:00+00:00')], {}, hoy):
        malos.append('se pregunta una de hace más de %d días' % DIAS)
    if len(para_preguntar([dict(f, llave=str(i)) for i in range(10)], {}, hoy)) != TOPE:
        malos.append('el tope por corrida')
    if pendientes({'1': dict(f, retirada='junta sin «+»'), '2': f}) != {'2': f}:
        malos.append('una pregunta retirada no se aplica aunque la contesten')
    for x in malos:
        print('   ❌ %s' % x)
    print('   %s preguntas al organizador: el mensaje, los botones, el menú y cuándo' % ('❌' if malos else '✅'))
    return bool(malos)


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        return 1 if _self_check() else 0
    estado = {k: v for k, v in _cargar().items() if isinstance(v, dict)}
    print('%d llave(s) preguntada(s)' % len(estado))
    for k, f in sorted(estado.items(), key=lambda x: x[1].get('preguntada', '')):
        print('   %s · %s · %s → %d de %d contestadas' % (f['evento'], f['sv'], f.get('preguntada', ''),
                                                       len(f.get('respondidas') or {}), len(f.get('preguntas') or [])))
    return 0


if __name__ == '__main__':
    sys.exit(main())
