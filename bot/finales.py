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

🛡️ SIN PERMISO EN EL CANAL DE LA LLAVE, AL CHAT DE STAFF (Dlx, 11/11/2026: *«Chat de staff, Panel del socio»*). En 14 de
55 llaves Discord dijo 403 —ACADEMIA, LKR y DDS no dejan escribir al bot en su canal de llaves— y la duda le llegaba a
Dlx: la #491 entre ellas. Ahora se prueba en el chat de staff de ese servidor (`canales_staff()`), con los mismos
botones y el link a la llave; y la pregunta sale también en el panel del socio (`publicar()` → `#/socio`).

⏳ EL ÚLTIMO RECURSO, A LAS 48 HORAS (Dlx, 11/11/2026: *«48 h»*, a la pregunta de cuánto esperar). Lo que nadie marcó
`VENCE_H` horas después de preguntar se cierra con «Nadie siguió»: los de esa batalla cobran la ronda, nadie gana el
duelo, y quien aparece más adelante cobra hasta donde llegó (`motor`, `cobra:`). LA FINAL NUNCA: sigue esperando en
✅ Decidir. Y sólo lo que se preguntó de verdad (`t_pregunta`): si el bot no pudo escribir en ningún lado, nadie tuvo la
chance de contestar y la duda sigue siendo de Dlx.

🗑️ Y SI FALTA LA MITAD DE LA LLAVE O MÁS, LA LLAVE NO CUENTA (Dlx, 11/11/2026: *«La mitad o más»*; antes, *«si una llave
tiene bastantes errores que se descarte automáticamente y se le notifique al organizador»*). Se cuenta sobre la llave
entera como la leyó el bot (`datos/llaves_t1.json`), descontando lo que ya se decidió, y a la misma hora del último
recurso: el organizador tuvo sus 48 h. Se le avisa contestando a su llave (o en el chat de staff) y a Logs. Medido el
11/11/2026 sobre las 243 llaves de la T1: hoy caería una sola, la #562 de LKR (7 de 8).

⚠️ UNA VEZ POR LLAVE, PARA SIEMPRE (`datos/finales.json`, lo guarda `bot/ci/guardar.sh`): sin eso cada corrida
volvería a mencionar al organizador. Sólo llaves de los últimos `DIAS` días, y como mucho `TOPE` mensajes por corrida.
"""
import datetime
import io
import json
import os
import re
import sys
import unicodedata
import clave_ciclo as CC  # noqa: E402  la clave del ciclo, en un solo lugar

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ESTADO = os.path.join(BASE, 'datos', 'finales.json')
API = 'https://discord.com/api/v10'
DIAS = 14
TOPE = 5
MAX_PREGUNTAS = 4
#: la llave sin final se pregunta después de esta hora quieta (las demás, apenas tienen campeón)
PREGUNTA_H = 1
#: ⏳ el último recurso: lo que nadie marcó en estas horas se cierra con «Nadie siguió» (Dlx, 11/11/2026: «48 h»)
VENCE_H = 48
#: 🗑️ y la llave no cuenta si a esa hora le falta el ganador de esta parte o más (Dlx, 11/11/2026: «la mitad o más»)
DESCARTE = 0.5
#: 🛡️ las que quedaron sin permiso antes del chat de staff se vuelven a preguntar ahí sólo si son de estas últimas horas
#: (lo mismo que una pregunta nueva: `llaves_a_entrada.PREGUNTA_MAX_H`)
REPREGUNTA_H = 48
#: dónde quedó cada llave del ranking como la leyó el bot (para contar cuánto le falta)
LLAVES = os.path.join(BASE, 'datos', 'llaves_t1.json')
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
    # 🕐 la hora del este de verdad (con el cambio de horario): «-4 h» fijo daba una hora de más de noviembre a marzo
    from zoneinfo import ZoneInfo
    t = datetime.datetime.now(ZoneInfo('America/New_York'))
    return t.strftime('%Y-%m-%d %I:%M %p ET').replace(' 0', ' ')


def _ts(t=None):
    """El instante en UTC, para contar las 48 h (`preguntada` es para leer, en ET)."""
    return (t or datetime.datetime.now(datetime.timezone.utc)).isoformat(timespec='seconds')


def _de_ts(x):
    try:
        t = datetime.datetime.fromisoformat(str(x or '').replace('Z', '+00:00'))
    except ValueError:
        return None
    return t if t.tzinfo else t.replace(tzinfo=datetime.timezone.utc)


def _guild(sv):
    """El guild de un servidor de la Liga (`datos/servidores.json`), o ''."""
    try:
        with io.open(os.path.join(BASE, 'datos', 'servidores.json'), encoding='utf-8') as f:
            return str((((json.load(f) or {}).get('servidores') or {}).get(sv) or {}).get('guild_id') or '')
    except (OSError, ValueError):
        return ''


#: 🛡️ el staff de un servidor: la categoría o el canal lo dicen (lo mismo que `escuchar.STAFF`)
STAFF = re.compile(r'staff|moderat|admin|organiz', re.I)
#: lo que vive en una categoría de staff y no es para charlar
NO_ES_CHAT = re.compile(r'regla|anunci|\blogs?\b|registro|jerarq|ticket|postula|sanci|\bban|warn|reporte|votaci|bienven', re.I)


def _n(x):
    return unicodedata.normalize('NFKD', str(x or ''))


def canales_staff(canales):
    """🛡️ Pura. Los canales de texto donde preguntarle al staff, el mejor primero, hasta tres: los de una categoría de
    staff o con «staff»/«organiz» en el nombre, sin los que no son para charlar, y antes los que dicen «chat». Medido el
    11/11/2026: ACADEMIA «organizar-eventos», LKR «canal-de-staff-y-organizadores» y DDS «𝐂𝐇𝐀𝐓-𝐎𝐑𝐆𝐀𝐍𝐈𝐙𝐀𝐂𝐈𝐎𝐍» (la negrita
    matemática se lee con NFKD, como los roles de rango)."""
    cats = {str(c.get('id')) for c in canales or [] if c.get('type') == 4 and STAFF.search(_n(c.get('name')))}
    out = []
    for c in canales or []:
        n = _n(c.get('name'))
        if c.get('type') != 0 or NO_ES_CHAT.search(n):
            continue
        en_cat = str(c.get('parent_id') or '') in cats
        if not (en_cat or STAFF.search(n)):
            continue
        pts = (2 if re.search(r'chat|general|charla', n, re.I) else 0) + (2 if STAFF.search(n) else 0) + (1 if en_cat else 0)
        out.append((-pts, int(c.get('position') or 0), str(c.get('id'))))
    return [x[2] for x in sorted(out)][:3]


def _token():
    sys.path.insert(0, os.path.join(BASE, 'bot'))
    import avisar
    return avisar._token()


def _cual(p):
    return '%s: %s' % (str(p['ronda']).capitalize(), ' vs '.join(str(x).strip() for x in p['lados']))


#: 🗣️ LO PRIMERO QUE LEE EL ORGANIZADOR (Dlx, 13/10/2026: «que sea más fácil de entender eso de los organizadores
#: cuando el bot pregunta y menciona al organizador que no entiende… hazlo más sencillo y explica qué cosa está
#: haciendo»). La versión de antes arrancaba con el nombre del evento y «la llave no dice quién ganó»: quien no sabe
#: qué es este bot no entendía por qué lo mencionaban ni qué tenía que hacer. Ahora, en este orden: quién es el bot,
#: qué está haciendo con SU llave, qué le falta, y qué tocar
SALUDO = ('🏁 <@%s> ¡hola! Soy el bot de la **Liga Global**: estoy pasando los resultados de **%s** al ranking de la '
          'Liga.')
SALUDO_STAFF = ('🏁 <@%s> ¡hola! Soy el bot de la **Liga Global**: estoy pasando los resultados de **%s** al ranking '
                'de la Liga. No puedo escribir en el canal de la llave, así que pregunto acá: [ver la llave](%s).')
#: ⏳ el pie dice qué pasa si nadie contesta (Dlx, 11/11/2026: «48 h» y «la mitad o más»)
PIE = ('-# Lo puede marcar quien publicó la llave o alguien del staff. Tienen 48 horas: después, lo que falte lo cierra '
       'la Liga, y si falta la mitad de la llave o más, la llave no cuenta para el ranking.')


def link_llave(f, guild=''):
    """El link al mensaje de la llave, o ''."""
    g = guild or _guild(f.get('sv'))
    return 'https://discord.com/channels/%s/%s/%s' % (g, f['canal'], f['llave']) if g and f.get('canal') else ''


def _por_staff(m, f, guild):
    """La misma pregunta para el chat de staff: sin contestar a la llave (vive en otro canal) y con su link."""
    m = dict(m)
    m.pop('message_reference', None)
    m['content'] = m['content'].replace(SALUDO % (f['autor'], nombre_de(f)),
                                        SALUDO_STAFF % (f['autor'], nombre_de(f), link_llave(f, guild)), 1)
    return m


def nombre_de(f):
    """Cómo se nombra la llave en el mensaje: su evento o, si no tiene título, «tu llave del 10/11»."""
    ev = str(f.get('evento') or '').strip()
    return ev if ev and not ev.lower().startswith('(sin t') else 'tu llave del %s' % (f.get('fecha') or 'último evento')


def mensaje(f):
    """El mensaje: el texto, los componentes y a quién se menciona (sólo al organizador)."""
    ps = f['preguntas'][:MAX_PREGUNTAS]
    base = 'dud:%s:%s' % (f['llave'], f['autor'])
    saludo = SALUDO % (f['autor'], nombre_de(f))
    if len(ps) == 1 and len(ps[0]['lados']) == 2:
        p = ps[0]
        texto = (saludo + '\nEn tu llave no encontré quién ganó %s: **%s** vs **%s**.\n👉 **Toca el nombre de quien '
                 'ganó** y listo.' % ('la final' if 'final' in str(p['ronda']).lower()
                                      else 'una batalla de %s' % str(p['ronda']).lower(), p['lados'][0], p['lados'][1]))
        filas = [{'type': 1, 'components': [
            {'type': 2, 'style': 1, 'label': str(p['lados'][j]).strip()[:80], 'custom_id': '%s:0:%s' % (base, LETRAS[j])}
            for j in range(2)]}]
    else:
        texto = (saludo + '\nEn tu llave no encontré quién ganó %s.\n👉 **Abre cada menú de abajo y elige quién ganó '
                 'esa batalla.**%s' % ('una batalla' if len(ps) == 1 else '%d batallas' % len(ps),
                                       '' if all('final' in str(p['ronda']).lower() for p in ps)
                                       else ' Si alguien no se presentó o lo reemplazaron, elige «Nadie siguió».'))
        filas = []
        for i, p in enumerate(ps):
            ops = [{'label': str(x).strip()[:100], 'value': LETRAS[j]} for j, x in enumerate(p['lados'][:24])]
            if 'final' not in str(p['ronda']).lower():
                ops.append({'label': 'Nadie siguió (fue reemplazado o no se presentó)', 'value': NADIE_V})
            filas.append({'type': 1, 'components': [{'type': 3, 'custom_id': '%s:%d' % (base, i),
                                                     'placeholder': _cual(p)[:150], 'options': ops}]})
    return {
        'content': texto + '\n' + PIE,
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


def _postear(requests, cab, canal, m):
    """`(código, id)` de mandar `m` a `canal`; `(None, '')` si no hubo red."""
    try:
        r = requests.post('%s/channels/%s/messages' % (API, canal), headers=cab, data=json.dumps(m), timeout=20)
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ preguntas: %s' % str(e)[:60])
        return None, ''
    if r.status_code in (200, 201):
        return r.status_code, str(r.json().get('id') or '')
    print('   ⚠️ preguntas: Discord dijo %s %s' % (r.status_code, r.text[:80]))
    return r.status_code, ''


def _al_staff(requests, cab, f, m):
    """🛡️ `(id del mensaje, canal)` de la pregunta en el chat de staff del servidor, o `('', '')`."""
    g = _guild(f.get('sv'))
    if not g:
        return '', ''
    try:
        r = requests.get('%s/guilds/%s/channels' % (API, g), headers=cab, timeout=20)
        cs = r.json() if r.ok else []
    except Exception:                                    # noqa: BLE001
        cs = []
    for c in canales_staff(cs if isinstance(cs, list) else []):
        cod, mid = _postear(requests, cab, c, _por_staff(m, f, g))
        if mid:
            return mid, c
    return '', ''


def preguntar(llaves):
    """Manda las preguntas nuevas. `llaves`: `[{llave, canal, autor, evento, sv, fecha, cuando, preguntas:
    [{ronda, lados}]}]`, la final primero. Sin permiso en el canal de la llave, al chat de staff; y las que quedaron
    sin permiso antes de que existiera eso, una vez, mientras sean de los últimos `DIAS` días."""
    estado = _cargar()
    nuevas = para_preguntar(llaves, estado)
    hoy = datetime.datetime.now(datetime.timezone.utc)
    # ⚠️ las viejas, sólo si están frescas (`REPREGUNTA_H`): con los datos del 11/11/2026 eran 12, nueve de LKR y dos de
    # hace 11 días, y todas juntas son una pared en el chat de su staff. Lo de antes queda en el panel del socio
    viejas = [f for f in estado.values() if isinstance(f, dict) and f.get('sin_permiso') and not f.get('staff_probado')
              and not f.get('retirada') and _de_ts(f.get('cuando'))
              and (hoy - _de_ts(f.get('cuando'))).total_seconds() <= REPREGUNTA_H * 3600
              and len(f.get('respondidas') or {}) < len(f.get('preguntas') or [])]
    if not nuevas and not viejas:
        return 0
    import requests
    t = _token()
    if not t:
        print('   ⚠️ preguntas al organizador: sin token')
        return 0
    cab = {'Authorization': 'Bot ' + t, 'Content-Type': 'application/json'}
    n = 0
    for f in nuevas:
        m = mensaje(f)
        cod, mid = _postear(requests, cab, f['canal'], m)
        canal, donde = f['canal'], 'llave'
        if cod is None or (cod != 403 and not mid):
            continue
        if cod == 403:
            # 🛡️ sin permiso en el canal de la llave: el chat de staff (Dlx, 11/11/2026)
            mid, canal = _al_staff(requests, cab, f, m)
            donde = 'staff' if mid else ''
        estado[str(f['llave'])] = dict(f, pregunta=mid, canal_pregunta=canal if mid else '', donde=donde,
                                       preguntada=_ahora(), t_pregunta=_ts() if mid else '',
                                       sin_permiso=not mid, staff_probado=cod == 403, respondidas={})
        n += 1
        print('   🏁 le pregunté a <@%s> %d batalla(s) de %s · %s%s' % (
            f['autor'], len(f['preguntas']), f['evento'], f['sv'],
            ' (en el chat de staff)' if donde == 'staff' else '' if mid else ' — sin permiso en ningún canal'))
    for f in viejas[:TOPE]:
        f['staff_probado'] = True
        sin = {str(i) for i in (f.get('respondidas') or {})}
        g = dict(f, preguntas=[p for i, p in enumerate(f['preguntas']) if str(i) not in sin])
        if len(g['preguntas']) != len(f['preguntas']):
            continue        # los números de la pregunta tienen que ser los mismos: con alguna contestada, no
        mid, canal = _al_staff(requests, cab, f, mensaje(f))
        if mid:
            f.update(pregunta=mid, canal_pregunta=canal, donde='staff', sin_permiso=False, t_pregunta=_ts(),
                     preguntada=_ahora())
            n += 1
            print('   🛡️ %s · %s: sin permiso en su canal de llaves, se lo pregunté al staff' % (f['evento'], f['sv']))
    _guardar(estado)
    return n


# ── ⏳ EL ÚLTIMO RECURSO Y EL DESCARTE ─────────────────────────────────────────────────────────────────────────────────

def vencidas(estado, ahora):
    """Pura. Las llaves que se preguntaron de verdad hace `VENCE_H` horas o más y todavía no se cerraron."""
    out = []
    for k, f in (estado or {}).items():
        if not isinstance(f, dict) or f.get('retirada') or f.get('cerrada'):
            continue
        t = _de_ts(f.get('t_pregunta'))
        if t and (ahora - t).total_seconds() >= VENCE_H * 3600:
            out.append(k)
    return out


def llave_de(llaves, k):
    """La llave del ranking (`datos/llaves_t1.json`) cuyo link es el mensaje `k`, o `None`."""
    for x in (llaves or {}).values():
        if isinstance(x, dict) and any(str(u).rstrip('/').endswith('/' + str(k)) for u in x.get('links') or []):
            return x
    return None


def sin_ganador(L, f, decididas, DEC):
    """`(sin ganador, batallas)` de la llave `L`, sin contar lo que ya se decidió (en ✅ Decidir o por el organizador).
    La clave se arma con el nombre de la llave y con el de la pregunta: pueden no ser el mismo.

    🔴 SIN GANADOR ES LO QUE EL LECTOR MARCÓ «sin ganador» (la revisión del 11/11/2026): una batalla sin nombre en el
    ganador también puede ser un «nadie siguió» ya aplicado (`cobra: …`), un trío donde pasan dos o un campeón elegido.
    Contándolas, una llave contestada entera podía descartarse a las 48 h. Medido sobre las llaves del 11/11: 12
    «nadie siguió» ya decididos no coincidían con su clave en `decisiones.json`."""
    tot = sin = 0
    for r in L.get('rondas') or []:
        for b in r.get('b') or []:
            tot += 1
            if b[1] or 'sin ganador' not in str((b[2] if len(b) > 2 else '') or '').lower():
                continue
            ks = {DEC.clave_batalla(DEC.detalle_batalla(ev, L.get('sv'), L.get('fecha'), r.get('r'), b[0]))
                  for ev in (L.get('nombre'), f.get('evento'))}
            if not ks & decididas:
                sin += 1
    return sin, tot


def forma_ok(L):
    """🔎 ¿El cuadro tiene forma de llave? A lo sumo dos batallas en la final (la final y el tercer puesto). Sin esto, una llave que el BOT leyó mal se descartaba como si el organizador no
    hubiera marcado nada: la #562 de LKR (Freestyle Master Series ZZZ, 02/11) quedó con sus 8 batallas en «Final», y 7
    «sin ganador» son un error de lectura, no del organizador. Medido el 11/11/2026, armando la maqueta de ✅ Decidir.

    ⚠️ SÓLO LA FINAL, A PROPÓSITO. Se probó también «ninguna ronda con más batallas que la anterior» y marcaba 10 de 240
    llaves sanas: los Filtros y las Clasificatorias van antes con pocas batallas, la doble eliminación tiene 14 en la de
    perdedores y GG SANGRERAP 6 tiene 2 octavos por los pases directos. Con la final sola caen 2: la #562 y la IRLANDA
    FREESTYLE de FRZ (3 finales), que sólo quiere decir que ésa no se descarta sola."""
    fin = [len(r.get('b') or []) for r in L.get('rondas') or [] if str(r.get('r') or '').strip().lower() == 'final']
    return all(n <= 2 for n in fin)


def cerrar(estado, llaves, dd, ahora, DEC):
    """⏳ Pura sobre `estado` y `dd` (las cambia en el lugar). `[(llave, 'no cuenta' | 'nadie siguió', n, sin, tot)]`."""
    hecho = []
    for k in vencidas(estado, ahora):
        f = estado[k]
        L = llave_de(llaves, k)
        if L and not forma_ok(L):
            # 🔎 la leyó mal el bot: ni se descarta ni se cierra nada; queda en ✅ Decidir y se avisa una vez a Logs
            f['cerrada'] = {'como': 'mal leída', 't': _ahora()}
            hecho.append((k, 'mal leída', 0, 0, 0))
            continue
        sin, tot = sin_ganador(L, f, set((dd.get('batallas') or {}).keys()), DEC) if L else (0, 0)
        # ⚠️ con el nombre de la LLAVE (`llaves_t1`), que es el que muestra «Llaves y fondos» para volver a contarla: el de la
        # pregunta puede ser el título crudo («__ Cuentas Pendientes V.1 __») y entonces no se podía deshacer
        clave_ev = '%s · %s · %s' % ((L or {}).get('nombre') or f['evento'], f['sv'], f['fecha'])
        ya = (dd.get('eventos') or {}).get(clave_ev) or {}
        contestadas = len(f.get('respondidas') or {}) >= len(f.get('preguntas') or [])
        if tot and sin / tot >= DESCARTE and ya.get('decision') != 'cuenta' and not contestadas:
            # sin pisar el campeón o el «paga» que ya tenga, y nunca contra un «cuenta» de Dlx
            dd.setdefault('eventos', {})[clave_ev] = dict(ya, **{
                'decision': 'no cuenta', 'cuando': _ahora(), 'por': 'bot/finales.py (descarte a las %d h)' % VENCE_H,
                'nota': '%d de %d batallas sin ganador %d h después de preguntar (Dlx, 11/11/2026: «la mitad o más»)'
                        % (sin, tot, VENCE_H)})
            f['cerrada'] = {'como': 'no cuenta', 't': _ahora(), 'sin': sin, 'tot': tot}
            hecho.append((k, 'no cuenta', 0, sin, tot))
            continue
        n = 0
        f.setdefault('respondidas', {})
        for i, p in enumerate(f.get('preguntas') or []):
            if str(i) in f['respondidas'] or not DEC.se_cierra_sola(p['ronda']):
                continue        # 🏆 ni la final, ni la semi, ni el tercer puesto: siguen en ✅ Decidir
            det = DEC.detalle_batalla(f['evento'], f['sv'], f['fecha'], p['ronda'], p['lados'])
            ck = DEC.clave_batalla(det)
            ya = (dd.get('batallas') or {}).get(ck)
            if ya:
                f['respondidas'][str(i)] = ya.get('ganador') or ''
                continue
            dd.setdefault('batallas', {})[ck] = {
                'ganador': DEC.NADIE, 'batalla': det, 'cuando': _ahora(),
                'por': 'bot/finales.py: nadie la marcó en %d h' % VENCE_H,
                'nota': 'el último recurso (Dlx, 11/11/2026: «48 h»): cobran la ronda y no hay duelo'}
            f['respondidas'][str(i)] = DEC.NADIE
            f.setdefault('resp', {})[str(i)] = {'por': '48h', 't': int(ahora.timestamp() * 1000)}
            n += 1
        f['cerrada'] = {'como': 'nadie siguió', 't': _ahora(), 'n': n, 'sin': sin, 'tot': tot}
        hecho.append((k, 'nadie siguió', n, sin, tot))
    return hecho


def texto_descarte(f, sin, tot):
    """Lo que se le dice al organizador cuando su llave no cuenta."""
    return ('🏁 <@%s> **%s** no va a contar para el ranking de la **Liga Global**: a la llave le faltó quién ganó %d de '
            'sus %d batallas, y nadie lo marcó en %d horas.\n-# Si fue un error, escríbele a un Moderador de la Liga y '
            'la vuelve a contar.' % (f['autor'], nombre_de(f), sin, tot, VENCE_H))


def cerrar_vencidas():
    """⏳ El último recurso y el descarte, con lo de hoy: escribe `datos/decisiones.json` y `datos/finales.json`, le avisa
    al organizador de cada llave que no cuenta y deja todo en Logs. Devuelve lo hecho."""
    estado = _cargar()
    ahora = datetime.datetime.now(datetime.timezone.utc)
    if not vencidas(estado, ahora):
        return []
    sys.path[:0] = [os.path.join(BASE, 'sheet')]
    import decidir as DEC
    try:
        with io.open(LLAVES, encoding='utf-8') as fh:
            llaves = json.load(fh) or {}
    except (OSError, ValueError):
        llaves = {}
    dd = DEC._decisiones()
    # 🔴 si `decisiones.json` existe y no se pudo leer, `_decisiones()` da {} y escribirlo de vuelta lo borraría entero
    if not dd and os.path.exists(DEC.DECISIONES) and os.path.getsize(DEC.DECISIONES) > 2:
        print('   ⚠️ finales: no pude leer decisiones.json; no cierro nada esta corrida')
        return []
    hecho = cerrar(estado, llaves, dd, ahora, DEC)
    if not hecho:
        return []
    with io.open(DEC.DECISIONES, 'w', encoding='utf-8', newline='\n') as fh:
        json.dump(dd, fh, ensure_ascii=False, indent=1)
        fh.write('\n')
    _guardar(estado)
    lineas = []
    t = _token()
    import requests
    cab = {'Authorization': 'Bot ' + t, 'Content-Type': 'application/json'} if t else None
    for k, como, n, sin, tot in hecho:
        f = estado[k]
        cual = '%s · %s · %s' % (f['evento'], f['sv'], f['fecha'])
        if como == 'no cuenta':
            print('   🗑️ %s no cuenta: %d de %d batallas sin ganador a las %d h' % (cual, sin, tot, VENCE_H))
            lineas.append('🗑️ **%s** no cuenta: %d de %d batallas sin ganador a las %d h. Si fue un error, se vuelve a '
                          'contar en «Llaves y fondos» del Dashboard.' % (cual, sin, tot, VENCE_H))
            if cab:
                m = {'content': texto_descarte(f, sin, tot), 'allowed_mentions': {'users': [f['autor']], 'replied_user': False}}
                if f.get('donde') == 'llave':
                    m['message_reference'] = {'message_id': f['llave'], 'channel_id': f['canal'], 'fail_if_not_exists': False}
                _postear(requests, cab, f.get('canal_pregunta') or f['canal'], m)
        elif como == 'mal leída':
            print('   🔎 %s: el cuadro no tiene forma de llave; no se cierra ni se descarta' % cual)
            lineas.append('🔎 **%s**: a las %d h el cuadro no tiene forma de llave (¿la leyó mal el bot?). No se cerró ni se '
                          'descartó: queda en ✅ Decidir.' % (cual, VENCE_H))
        elif n:
            print('   ⏳ %s: %d batalla(s) con «Nadie siguió» a las %d h' % (cual, n, VENCE_H))
            lineas.append('⏳ **%s**: %d batalla(s) cerradas con «Nadie siguió» (nadie las marcó en %d h).' % (cual, n, VENCE_H))
    if lineas:
        try:
            sys.path.insert(0, os.path.join(BASE, 'bot'))
            import alertar
            alertar.normal('\n'.join(lineas))
        except Exception as e:                           # noqa: BLE001
            print('   ⚠️ finales: no pude avisar a Logs (%s)' % str(e)[:60])
    return hecho


# ── 📊 LO QUE ESPERA RESPUESTA, PARA EL PANEL DEL SOCIO ──────────────────────────────────────────────────────────────

def para_panel(estado, ahora):
    """📊 Pura. `{sv: [{k, evento, fecha, ronda, lados, link, autor, vence}]}`: cada batalla preguntada que nadie marcó,
    de los últimos `DIAS` días (la final, también después de las 48 h: sigue esperando). `vence` en ms, o 0."""
    out = {}
    for k, f in sorted((estado or {}).items()):
        if not isinstance(f, dict) or f.get('retirada') or (f.get('cerrada') or {}).get('como') == 'no cuenta':
            continue
        c = _de_ts(f.get('cuando'))
        if not c or (ahora - c).days > DIAS:
            continue
        t = _de_ts(f.get('t_pregunta'))
        vence = int((t + datetime.timedelta(hours=VENCE_H)).timestamp() * 1000) if t else 0
        for i, p in enumerate(f.get('preguntas') or []):
            if str(i) in (f.get('respondidas') or {}):
                continue
            out.setdefault(f.get('sv') or '', []).append({
                'k': '%s:%d' % (k, i), 'evento': f.get('evento') or '', 'fecha': f.get('fecha') or '',
                'ronda': str(p.get('ronda') or ''), 'lados': [str(x).strip() for x in p.get('lados') or []][:24],
                'link': f.get('link') or '', 'autor': f.get('autor') or '', 'vence': vence,
                'nadie': 'final' not in str(p.get('ronda') or '').lower() or 'semi' in str(p.get('ronda') or '').lower()})
    return out


def _nombres():
    """`{discord_id: nombre}` de la Lista (`datos/padron.json`), para nombrar a cada organizador."""
    try:
        with io.open(os.path.join(BASE, 'datos', 'padron.json'), encoding='utf-8') as fh:
            return {str(x.get('discord_id')): str(x.get('full') or x.get('raw') or '')
                    for x in json.load(fh) or [] if isinstance(x, dict) and x.get('discord_id')}
    except (OSError, ValueError):
        return {}


def resumen(estado, nombres=None):
    """📊 ORGANIZADORES (Dlx, 11/11/2026: «Organizadores», de las ideas para el Dashboard). Pura. Por servidor: cuántas
    llaves y batallas se preguntaron, cuántas contestó alguien (el organizador o el staff), cuántas cerró el ciclo a las
    48 h, en cuántas no pudo escribir en ningún lado y en cuántas preguntó en el chat de staff, cuántas se descartaron y
    cuánto tardan en contestar (la mediana, en minutos, de las que tienen hora: desde el 11/11/2026). Por organizador:
    lo mismo, para ver quién nunca contesta. Sin Discord ID: el nombre de la Lista o «sin nombre en la Lista»."""
    nombres = nombres or {}
    sv, org = {}, {}
    for k, f in sorted((estado or {}).items()):
        if not isinstance(f, dict) or f.get('retirada') or not f.get('preguntas'):
            continue
        q = len(f['preguntas'])
        resp = f.get('resp') or {}
        nadie48 = sum(1 for v in resp.values() if (v or {}).get('por') == '48h')
        alguien = len(f.get('respondidas') or {}) - nadie48
        t0 = _de_ts(f.get('t_pregunta'))
        tardas = [int(((v or {}).get('t') or 0) / 60000 - t0.timestamp() / 60) for v in resp.values()
                  if t0 and (v or {}).get('por') in ('org', 'otro') and (v or {}).get('t')]
        sin = bool(f.get('sin_permiso'))
        cer = (f.get('cerrada') or {}).get('como') or ''
        for d, clave, base in ((sv, f.get('sv') or '?', {'sv': f.get('sv') or '?'}),
                               (org, str(f.get('autor') or ''), {'n': nombres.get(str(f.get('autor') or '')) or 'sin nombre en la Lista',
                                                                  'sv': f.get('sv') or '?'})):
            x = d.setdefault(clave, dict(base, llaves=0, batallas=0, contestadas=0, nadie48=0, sin_permiso=0, staff=0,
                                         descartadas=0, _t=[]))
            x['llaves'] += 1
            x['batallas'] += q
            x['contestadas'] += max(0, alguien)
            x['nadie48'] += nadie48
            x['sin_permiso'] += 1 if sin else 0
            x['staff'] += 1 if f.get('donde') == 'staff' else 0
            x['descartadas'] += 1 if cer == 'no cuenta' else 0
            x['_t'] += [t for t in tardas if t >= 0]

    def cerrar_t(x):
        ts = sorted(x.pop('_t'))
        x['tarda_min'] = ts[len(ts) // 2] if ts else None
        return x
    lsv = sorted((cerrar_t(x) for x in sv.values()), key=lambda x: (-x['batallas'], x['sv']))
    lorg = sorted((cerrar_t(x) for x in org.values()), key=lambda x: (-(x['batallas'] - x['contestadas']), -x['batallas'], x['n']))
    return {'sv': lsv, 'org': lorg[:20]}


def publicar():
    """📊 Le deja al objeto lo que espera respuesta (`/avisos/finales-pend`, con la clave del ciclo), para el panel de
    cada socio. Una escritura por corrida, a una fila del objeto: no gasta KV."""
    estado = _cargar()
    pend = para_panel(estado, datetime.datetime.now(datetime.timezone.utc))
    for xs in pend.values():
        for x in xs:
            f = estado.get(x['k'].split(':')[0]) or {}
            x['link'] = link_llave(f) if f else ''
    try:
        import requests
        t = _token()
        if not t:
            return 0
        import avisar
        r = requests.post(avisar.WORKER + '/avisos/finales-pend', headers={'x-lg-ciclo': CC.clave(t), 'content-type':
                          'application/json'}, data=json.dumps({'pend': pend, 'org': resumen(estado, _nombres())}), timeout=20)
        if not r.ok:
            print('   ⚠️ finales: el panel del socio no recibió las preguntas (%s)' % r.status_code)
            return 0
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ finales: el panel del socio no recibió las preguntas (%s)' % str(e)[:60])
        return 0
    return sum(len(x) for x in pend.values())


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
            # 📊 quién y cuándo, para «Organizadores» del Dashboard: el que publicó la llave u otro (staff, Dlx)
            f.setdefault('resp', {})[str(i)] = {'por': 'org' if str(x.get('quien') or '') == str(f.get('autor') or '') else 'otro',
                                                't': int(x.get('t') or 0)}
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
    if not (m['content'].startswith('🏁 <@832733202769641554>') and 'Soy el bot de la **Liga Global**' in m['content']
            and 'la final: **Mathias 🇪🇸** vs **Rfran 🇪🇸**' in m['content'] and 'Toca el nombre' in m['content']):
        malos.append('el mensaje: la mención primero, quién es el bot, qué falta y qué tocar (%r)' % m['content'][:120])
    ids = [c['custom_id'] for c in m['components'][0]['components']]
    if ids != ['dud:1553507758240964609:832733202769641554:0:a', 'dud:1553507758240964609:832733202769641554:0:b']:
        malos.append('una sola final: dos botones (%s)' % ids)
    f2 = dict(f, preguntas=[{'ronda': 'FINAL', 'lados': ['A', 'B']}, {'ronda': 'CUARTOS', 'lados': ['C', 'D', 'E']},
                            {'ronda': 'OCTAVOS', 'lados': ['F', 'G']}, {'ronda': 'OCTAVOS', 'lados': ['H', 'I']},
                            {'ronda': 'OCTAVOS', 'lados': ['J', 'K']}])
    m2 = mensaje(f2)
    if 'quién ganó 4 batallas' not in m2['content'] or 'Nadie siguió' not in m2['content']:
        malos.append('varias: cuántas y qué hacer con el menú (%r)' % m2['content'][:200])
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
    malos += _prueba_nuevo()
    for x in malos:
        print('   ❌ %s' % x)
    print('   %s preguntas al organizador: el mensaje, los botones, el menú y cuándo; el chat de staff, las 48 h y el '
          'descarte' % ('❌' if malos else '✅'))
    return bool(malos)


def _prueba_nuevo():
    malos = []
    # 🛡️ el chat de staff, con los canales reales de los tres servidores sin permiso (11/11/2026)
    cs = [{'id': '1', 'type': 4, 'name': '🛠 〕𝐒𝐓𝐀𝐅𝐅'}, {'id': '2', 'type': 0, 'name': '💎〕𝐉𝐄𝐑𝐀𝐑𝐐𝐔𝐈𝐀', 'parent_id': '1'},
          {'id': '3', 'type': 0, 'name': '𝐂𝐇𝐀𝐓-𝐎𝐑𝐆𝐀𝐍𝐈𝐙𝐀𝐂𝐈𝐎𝐍', 'parent_id': '1'}, {'id': '4', 'type': 0, 'name': 'general'},
          {'id': '5', 'type': 0, 'name': 'reglas-staff', 'parent_id': '1'}, {'id': '6', 'type': 2, 'name': 'staff voz'}]
    if canales_staff(cs) != ['3']:
        malos.append('el chat de staff: la negrita, sin jerarquía ni reglas, sin el general (%s)' % canales_staff(cs))
    if canales_staff([{'id': '9', 'type': 0, 'name': 'canal-de-staff-y-organizadores'},
                      {'id': '8', 'type': 0, 'name': 'organizar-eventos'}]) != ['8', '9']:
        malos.append('LKR y la ACADEMIA: sin categoría, por el nombre del canal')
    f = {'llave': '77', 'canal': '55', 'autor': '33', 'evento': 'X', 'sv': 'ACAD', 'fecha': '19/10',
         'preguntas': [{'ronda': 'CUARTOS', 'lados': ['A + B', 'C + D']}]}
    m = _por_staff(mensaje(f), f, '11')
    if 'message_reference' in m or 'https://discord.com/channels/11/55/77' not in m['content'] or '48 horas' not in m['content']:
        malos.append('la pregunta al staff: sin contestar a la llave, con su link y las 48 h')

    # ⏳ las 48 h y el descarte, con la #491 (3 de 15 sin ganador) y una como la #562 (7 de 8)
    class D:
        NADIE = '(nadie siguió)'

        @staticmethod
        def detalle_batalla(ev, sv, fe, r, lados):
            return '|'.join([ev, sv, fe, str(r).lower()] + sorted(lados))

        clave_batalla = staticmethod(lambda d: d.lower())
        se_cierra_sola = staticmethod(lambda r: str(r).lower() in ('r32', 'octavos', 'cuartos'))
    ahora = datetime.datetime(2026, 11, 11, 20, tzinfo=datetime.timezone.utc)
    hace = lambda h: _ts(ahora - datetime.timedelta(hours=h))  # noqa: E731
    bat = lambda lados, g='': [lados, g, '' if g else 'sin ganador: espera en ✅ Decidir']  # noqa: E731
    l491 = {'nombre': 'FATS', 'sv': 'ACAD', 'fecha': '19/10', 'links': ['https://discord.com/channels/1/2/491'],
            'rondas': [{'r': 'Octavos', 'b': [bat(['a', 'b'], 'a')] * 6 + [bat(['d', 'l', 'i']), bat(['m', 'j', 'e'])]},
                       {'r': 'Cuartos', 'b': [bat(['x', 'y'], 'x')] * 3 + [bat(['MAJ + MINI', 'MCO + MATH'])]},
                       {'r': 'Semifinales', 'b': [bat(['p', 'q'], 'p')] * 2}, {'r': 'Final', 'b': [bat(['u', 'v'], 'u')]}]}
    l562 = {'nombre': 'ZZZ', 'sv': 'LKR', 'fecha': '07/11', 'links': ['https://discord.com/channels/1/2/562'],
            'rondas': [{'r': 'Cuartos', 'b': [bat(['a', 'b'])] * 4}, {'r': 'Semifinales', 'b': [bat(['c', 'd'])] * 2},
                       {'r': 'Final', 'b': [bat(['g', 'h'], 'g'), bat(['e', 'f'])]}]}
    est = {'491': dict(f, llave='491', evento='FATS', fecha='19/10', t_pregunta=hace(49), respondidas={'1': 'd'},
                       preguntas=[{'ronda': 'CUARTOS', 'lados': ['MAJ + MINI', 'MCO + MATH']},
                                  {'ronda': 'OCTAVOS', 'lados': ['d', 'l', 'i']},
                                  {'ronda': 'OCTAVOS', 'lados': ['m', 'j', 'e']}]),
           '562': dict(f, llave='562', evento='ZZZ', sv='LKR', fecha='07/11', t_pregunta=hace(50), respondidas={},
                       preguntas=[{'ronda': 'FINAL', 'lados': ['e', 'f']}]),
           'joven': dict(f, llave='joven', t_pregunta=hace(47), respondidas={}),
           'nunca': dict(f, llave='nunca', t_pregunta='', sin_permiso=True, respondidas={})}
    if sorted(vencidas(est, ahora)) != ['491', '562']:
        malos.append('vencen sólo las preguntadas de verdad hace 48 h o más (%s)' % sorted(vencidas(est, ahora)))
    dd = {'batallas': {D.clave_batalla(D.detalle_batalla('FATS', 'ACAD', '19/10', 'octavos', ['d', 'l', 'i'])): {'ganador': 'd'}}}
    h = cerrar(est, {'491': l491, '562': l562}, dd, ahora, D)
    hm = {x[0]: x for x in h}
    if hm.get('562', ())[1:] != ('no cuenta', 0, 7, 8) or dd['eventos'].get('ZZZ · LKR · 07/11', {}).get('decision') != 'no cuenta':
        malos.append('la #562: 7 de 8 sin ganador no cuenta (%s)' % (hm.get('562'),))
    if hm.get('491', ())[1:] != ('nadie siguió', 2, 2, 15):
        malos.append('la #491: 2 de 15 sin ganador (la de octavos ya decidida), cierra cuartos y la otra de octavos (%s)'
                     % (hm.get('491'),))
    nadies = [v for v in dd['batallas'].values() if v.get('ganador') == D.NADIE]
    if len(nadies) != 2 or est['491']['respondidas'].get('0') != D.NADIE:
        malos.append('el último recurso escribe «Nadie siguió» en decisiones.json (%d)' % len(nadies))
    if vencidas(est, ahora + datetime.timedelta(hours=5)) != ['joven']:
        malos.append('lo cerrado no se vuelve a cerrar, y la joven vence a su hora')
    # 🔎 la #562 de verdad: las 8 batallas en «Final». Ni descarte ni «Nadie siguió»
    mala = {'nombre': 'ZZZ', 'sv': 'LKR', 'fecha': '02/11', 'links': ['https://discord.com/channels/1/2/mala'],
            'rondas': [{'r': 'Final', 'b': [bat(['g', 'h'], 'g')] + [bat(['e', 'f'])] * 7}]}
    e3 = {'mala': dict(f, llave='mala', t_pregunta=hace(50), respondidas={}, preguntas=[{'ronda': 'FINAL', 'lados': ['e', 'f']}])}
    d3 = {}
    h3 = cerrar(e3, {'x': mala}, d3, ahora, D)
    if [x[1] for x in h3] != ['mal leída'] or d3 or not forma_ok(l491) or not forma_ok(l562) or forma_ok(mala):
        malos.append('una llave sin forma de llave (todo en «Final») no se descarta ni se cierra: la leyó mal el bot')
    fin = dict(f, llave='fin', t_pregunta=hace(60), cuando=hace(61), respondidas={},
               preguntas=[{'ronda': 'FINAL', 'lados': ['a', 'b']}, {'ronda': 'SEMIS', 'lados': ['c', 'd']}])
    e2 = {'fin': fin}
    cerrar(e2, {}, {}, ahora, D)
    if fin['respondidas']:
        malos.append('ni la final ni la semifinal se cierran solas (la revisión del 11/11: la semi decide quién juega la final)')
    # 🔴 lo ya resuelto no cuenta como «sin ganador»: un «nadie siguió» aplicado (`cobra:`) o un trío donde pasan dos
    lres = {'nombre': 'R', 'sv': 'FFA', 'fecha': '01/11', 'rondas': [{'r': 'Cuartos', 'b': [
        [['a + b', 'c + d'], '', 'cobra: a + b; cobra: c + d; nadie siguió: ✅ Decidir'], [['e', 'f', 'g'], 'e, f', 'pasan 2'],
        [['h', 'i'], '', 'sin ganador: espera en ✅ Decidir']]}]}
    if sin_ganador(lres, {'evento': 'R'}, set(), D) != (1, 3):
        malos.append('sin ganador es sólo lo que el lector marcó así (%s)' % (sin_ganador(lres, {'evento': 'R'}, set(), D),))
    pp = para_panel(dict(e2, joven=dict(est['joven'], cuando=hace(10))), ahora)
    ks = sorted(x['k'] for xs in pp.values() for x in xs)
    if ks != ['fin:0', 'fin:1', 'joven:0'] or not all(x['vence'] for xs in pp.values() for x in xs):
        malos.append('el panel del socio: lo que nadie marcó, la final también, con cuándo vence (%s)' % ks)
    if nombre_de({'evento': '(sin titulo)', 'fecha': '10/11'}) != 'tu llave del 10/11' or nombre_de(f) != 'X':
        malos.append('la llave sin título se nombra por su fecha')
    # 📊 Organizadores: por servidor y por organizador, con quién contestó y cuánto tardó
    eo = {'a': {'sv': 'FFA', 'autor': '1', 'preguntas': [{}, {}], 'respondidas': {'0': 'x', '1': 'y'}, 't_pregunta': hace(10),
                'resp': {'0': {'por': 'org', 't': int((ahora - datetime.timedelta(hours=9)).timestamp() * 1000)},
                         '1': {'por': '48h', 't': 1}}},
          'b': {'sv': 'FFA', 'autor': '2', 'preguntas': [{}], 'respondidas': {}, 'sin_permiso': True},
          'c': {'sv': 'LKR', 'autor': '2', 'preguntas': [{}], 'respondidas': {'0': 'z'}, 'donde': 'staff', 'cerrada': {'como': 'no cuenta'}},
          'r': {'sv': 'LKR', 'autor': '3', 'preguntas': [{}], 'retirada': 'x'}}
    ro = resumen(eo, {'1': 'Ana 🇦🇷'})
    rf = next(x for x in ro['sv'] if x['sv'] == 'FFA')
    if (rf['llaves'], rf['batallas'], rf['contestadas'], rf['nadie48'], rf['sin_permiso'], rf['tarda_min']) != (2, 3, 1, 1, 1, 60) \
            or next(x for x in ro['org'] if x['n'] == 'sin nombre en la Lista')['batallas'] != 2 \
            or next(x for x in ro['sv'] if x['sv'] == 'LKR')['descartadas'] != 1 or len(ro['sv']) != 2:
        malos.append('Organizadores: por servidor y por organizador, sin las retiradas (%s)' % ro)
    if 'Moderador' not in texto_descarte(est['562'], 7, 8) or '<@33>' not in texto_descarte(est['562'], 7, 8):
        malos.append('el aviso del descarte: al organizador, con qué hacer si fue un error')
    return malos


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
