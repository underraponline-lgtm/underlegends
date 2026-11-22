# -*- coding: utf-8 -*-
"""🎤 EL RETO DEL DEBUT: quien juega su primer evento de la temporada tiene 7 días para jugar otro, y gana Tienda.

    python bot/debutantes.py            qué pasaría: los retos, los avisos y los mensajes, sin mandar nada
    python bot/debutantes.py --aplicar  guarda el estado, encola los avisos de la página y manda los mensajes
    python bot/debutantes.py --auto     el self-check

Dlx, 12/10/2026, a «"Volvé a jugar" para los que debutan»: *«sí, pero también haz que ULAYA los mencione en el chat
general explicándoles ese reto»*, y a cuánto, cuándo y dónde: *«ahí tú ves», «como veas», «como veas»*. Va contra el
problema que más pesa en la Liga: el 42 % jugó una sola vez (ver la memoria de retención).

LAS TRES PATAS
  · el aviso de la página (`bot/avisos_personales.py`, su cola de KV): «jugá otro antes del X y te llevás Y» al
    debutar, y «reto cumplido» al cumplirlo. Sólo a quien tiene su Discord: el aviso va por cuenta.
  · los Puntos de Tienda: viajan con lo demás que paga Tienda, en `precios:resolucion` (`precios.para_objeto()`,
    bloque `deb`), enteros en cada corrida; el objeto los reemplaza, así una llave corregida no paga dos veces.
  · el mensaje de ULAYA en el chat del servidor donde debutó: UNO POR DÍA por servidor, con todos los de ese día,
    y sólo donde el bot en vivo está prendido (`ajustes.en_vivo`, el interruptor del Dashboard y de /settings).
    El texto lo aprobó Dlx el 12/10/2026 (*«1. dale»*): hablar en el chat de un servidor es hablar en nombre de la
    Liga, así que si se cambia, se le muestra antes. `python bot/debutantes.py` muestra el que saldría.
    Y lo cambió el 04/11/2026 (*«Dale»*): medido, el reto no movió a nadie (con Discord, 40 % antes y 41 % con él) y lo que
    sí pesa es tener otro evento cerca. Ahora primero dice qué sigue, y a dónde ir.

⚠️ SÓLO LOS DEBUTS DESDE `DESDE`: el reto se anuncia ese día, y quien debutó antes nunca lo vio.
⚠️ «OTRO EVENTO» ES OTRO NÚMERO, aunque sea el mismo día: el reto pide volver a jugar, no volver otro día.
"""
import datetime as dt
import hashlib
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path[:0] = [SCR, os.path.join(BASE, 'sheet'), BASE]

ESTADO = os.path.join(BASE, 'datos', 'debutantes.json')
#: desde cuándo cuenta un debut (el día que se anunció el reto, en ET)
DESDE = dt.datetime(2026, 10, 12, 22, tzinfo=dt.timezone.utc)
DIAS = 7
PREMIO = 1000
#: el mensaje del chat: Dlx aprobó el texto el 12/10/2026 («1. dale»)
CHAT = True
WEB = 'https://underlegends.pages.dev/freestyle-rap/'


def _et(t):
    return t - dt.timedelta(hours=4)


def _dia(t):
    """«lunes 19/10», en ET."""
    d = _et(t)
    return '%s %s' % (['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'][d.weekday()],
                      d.strftime('%d/%m'))


def retos(evs, dids=None, desde=DESDE, ahora=None):
    """`{raw: {...}}`: el reto de cada uno que debutó desde `desde`. Pura: la prueba el self-check.

    `evs` son los eventos de la temporada de `most_wanted.cargar_todo()`, en orden, con `fase` = quiénes jugaron."""
    dids = dids or {}
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    jugados = {}
    for e in evs:
        for raw in e.get('fase') or {}:
            jugados.setdefault(raw, []).append(e)
    out = {}
    for raw, es in jugados.items():
        es = sorted(es, key=lambda e: (e['t'], e['n']))
        d = es[0]
        if d['t'] < desde:
            continue
        vence = d['t'] + dt.timedelta(days=DIAS)
        otro = next((e for e in es[1:] if e['n'] != d['n'] and e['t'] <= vence), None)
        out[raw] = {'did': dids.get(raw, ''), 'sv': d.get('sv') or '', 'n': d['n'], 'evento': d.get('nombre') or '',
                    'debut': d['t'].isoformat(timespec='seconds'), 'vence': vence.isoformat(timespec='seconds'),
                    'cumplido': otro['t'].isoformat(timespec='seconds') if otro else '',
                    'con': otro['n'] if otro else None,
                    'vencido': not otro and ahora > vence}
    return out


def tienda(estado):
    """`{id: [discord_id, puntos, ms]}` para `precios.para_objeto()`: los retos cumplidos de quien tiene Discord."""
    out = {}
    for raw, r in (estado.get('retos') or {}).items():
        if r.get('cumplido') and str(r.get('did') or '').isdigit():
            t = dt.datetime.fromisoformat(r['cumplido'])
            out['%s:%s' % (r['debut'][:10], r['did'])] = [r['did'], PREMIO, int(t.timestamp() * 1000)]
    return out


def _id(*partes):
    return hashlib.sha1('|'.join(str(p) for p in ('debut',) + partes).encode()).hexdigest()[:16]


def avisos_pagina(nuevos, cumplidos):
    """Los avisos de la página, con el formato de `avisos_personales`: al debutar y al cumplir."""
    out = []
    ahora = dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')
    for raw, r in nuevos:
        if r.get('did'):
            out.append({'id': _id(r['did'], 'reto', r['debut'][:10]), 'quien': r['did'],
                        'titulo': '🎤 Jugaste tu primer evento en la Liga',
                        'cuerpo': 'Reto: juega otro antes del %s y te llevas %s Puntos de Tienda.'
                                  % (_dia(dt.datetime.fromisoformat(r['vence'])), '{:,}'.format(PREMIO).replace(',', '.')),
                        'url': WEB + 'eventos', 't': ahora})
    for raw, r in cumplidos:
        if r.get('did'):
            out.append({'id': _id(r['did'], 'cumplido', r['debut'][:10]), 'quien': r['did'],
                        'titulo': '✅ Reto cumplido: +%s Puntos de Tienda' % '{:,}'.format(PREMIO).replace(',', '.'),
                        'cuerpo': 'Volviste a jugar en tu primera semana. Ya están en tu billetera.',
                        'url': WEB + 'tienda', 't': ahora})
    return out


def _link(sv):
    """Los eventos de la Liga, con la vista previa de ese servidor si existe (`bot/paginas/s/<sv>/eventos/`)."""
    if sv and os.path.exists(os.path.join(BASE, 'bot', 'paginas', 's', sv.lower(), 'eventos', 'index.html')):
        return 'https://underlegends.pages.dev/s/%s/eventos/' % sv.lower()
    return WEB + 'eventos'


def _norm(s):
    """Un nombre para comparar: sin banderas ni emoji, sin espacios ni signos, en minúscula («Mc uchiha 🇮🇹» → «mcuchiha»)."""
    return ''.join(ch for ch in str(s or '').lower() if ch.isalnum())


def cuentas_inscritas(gente_evs, Q=None):
    """`{n_evento: {nombre_normalizado: cuenta}}`: quién se anotó a SÍ MISMO en cada evento, para mencionar a un debutante
    que todavía no tiene su Discord en la Lista (Dlx, 19/11/2026: «intenta mencionar a la gente»).

    ⚠️ UNA INSCRIPCIÓN NO SIEMPRE ES DEL AUTOR (el staff anota a otros): vale sólo la cuenta que en ese evento anotó UN
    nombre, y que no es la cuenta de OTRA persona de la Lista (`Q`: nombre → Discord ID). Ante la duda, no se menciona:
    va en negrita, como antes."""
    de_otro = {}
    for n, i in (Q or {}).items():
        de_otro.setdefault(str(i), set()).add(_norm(n))
    out = {}
    for ev, x in (gente_evs or {}).items():
        ins = [y for y in (x or {}).get('ins') or [] if isinstance(y, dict) and y.get('cuenta')]
        por_cuenta = {}
        for y in ins:
            por_cuenta.setdefault(str(y['cuenta']), set()).add(_norm(y.get('es') or y.get('t')))
        m = {}
        for cuenta, nombres in por_cuenta.items():
            if len(nombres) != 1:
                continue
            nombre = next(iter(nombres))
            if not nombre or (cuenta in de_otro and nombre not in de_otro[cuenta]):
                continue
            m[nombre] = cuenta
        if m:
            out[str(ev)] = m
    return out


def mensaje_chat(gente, sv='', cuentas=None):
    """El mensaje del chat de un servidor: `(cuerpo, [discord_ids], texto)`. `gente` = `[(raw, reto)]` de ese servidor;
    `cuentas` = `cuentas_inscritas()`.

    ✂️ REHECHO EL 19/11/2026, MÁS CORTO (Dlx, con la captura del de FFA: *«remakear la segunda imagen porque mucho spam,
    e intenta mencionar a la gente»*). Era tres renglones y la vista previa grande del link de los eventos, que ocupaba
    más que todo el resto:
    - DOS RENGLONES: la bienvenida con los nombres y, en chico, el reto;
    - LA MENCIÓN, también para quien todavía no tiene su Discord en la Lista, si se anotó él mismo en el evento con el
      que debutó (`cuentas_inscritas()`); si no se sabe, en negrita;
    - EL LINK, UN BOTÓN («Próximos eventos», el de su servidor, `_link()`), sin vista previa.
    Antes (04/11/2026, *«Dale»*): «Lo que sigue: en la Liga se juega casi todas las noches…» y el link suelto."""
    ids, nombres = [], []
    for raw, r in gente:
        i = r.get('did') or ((cuentas or {}).get(str(r.get('n'))) or {}).get(_norm(raw))
        if i:
            if str(i) not in ids:
                ids.append(str(i))
            nombres.append('<@%s>' % i)
        else:
            nombres.append('**%s**' % raw)
    quien = nombres[0] if len(nombres) == 1 else ', '.join(nombres[:-1]) + ' y ' + nombres[-1]
    vence = min(dt.datetime.fromisoformat(r['vence']) for _raw, r in gente)
    varios = len(gente) > 1
    texto = ('🎤 **¡%s a la Liga Global!** %s %s su primer evento.\n'
             '-# 🎁 %s otro antes del %s y %s **%s Puntos de Tienda**: cualquier servidor cuenta.'
             % ('Bienvenidos' if varios else 'Bienvenida', quien, 'jugaron' if varios else 'jugó',
                'Jueguen' if varios else 'Juega', _dia(vence), 'se llevan' if varios else 'te llevas',
                '{:,}'.format(PREMIO).replace(',', '.')))
    boton = {'type': 2, 'style': 5, 'label': 'Próximos eventos', 'emoji': {'name': '📅'}, 'url': _link(sv)}
    cuerpo = {'content': texto[:1900], 'components': [{'type': 1, 'components': [boton]}],
              'allowed_mentions': {'parse': [], 'users': ids[:20]}}
    return cuerpo, ids[:20], texto


# 🌙 LA BIENVENIDA VA ADENTRO DEL AVISO DE GANADORES (Dlx, 22/11/2026: «make sure we are not that spammy»). Desde
# `NOCHE_DESDE`, el evento con el que alguien debuta tiene su aviso de ganadores en el mismo chat, media hora después:
# la bienvenida se le suma a ese mensaje (`aviso_ganadores.correr()`, con `del_evento()` y `marcar_chat()`) en vez de
# salir sola. Si ese aviso no sale (sin campeón, apagado, sin chat) o pasa un día, sale sola como siempre
ESPERA_GANADORES_H = 24


def _esperar_ganadores(r, ahora, avisos=None):
    """True si la bienvenida de este debut la va a llevar el aviso de ganadores de su evento: todavía no se mandó, es
    desde `NOCHE_DESDE`, y el debut tiene menos de `ESPERA_GANADORES_H` horas. `avisos`: `datos/avisos_ganadores.json`."""
    try:
        from notas import NOCHE_DESDE
    except Exception:                                    # noqa: BLE001
        return False
    if not str(r.get('n') or '').isdigit() or int(r['n']) < NOCHE_DESDE:
        return False
    if avisos is None:
        try:
            with io.open(os.path.join(BASE, 'datos', 'avisos_ganadores.json'), encoding='utf-8') as f:
                avisos = (json.load(f) or {}).get('avisados') or {}
        except (OSError, ValueError):
            avisos = {}
    est = avisos.get(str(r['n']))
    if isinstance(est, str):
        return False                    # ese aviso no sale (sin campeón, apagado, sin chat…): la bienvenida va sola
    if isinstance(est, dict):
        return True                     # ya salió: la llevaba él
    try:
        return (ahora - dt.datetime.fromisoformat(r['debut'])).total_seconds() < ESPERA_GANADORES_H * 3600
    except (KeyError, ValueError, TypeError):
        return False


def del_evento(ev):
    """`[(raw, reto)]` de quienes debutaron en ese evento y todavía no se nombraron en el chat."""
    return [(raw, r) for raw, r in sorted((_leer().get('retos') or {}).items())
            if str(r.get('n')) == str(ev) and not r.get('chat') and not r.get('cumplido') and not r.get('vencido')]


def marcar_chat(raws, hoy):
    """Anota que la bienvenida de esos ya salió (en el aviso de ganadores)."""
    d = _leer()
    rs = d.get('retos') or {}
    for raw in raws:
        if raw in rs:
            rs[raw]['chat'] = hoy
    _guardar({'retos': rs, 'chats': d.get('chats') or {}})


def _leer():
    try:
        with io.open(ESTADO, encoding='utf-8') as f:
            return json.load(f) or {}
    except (OSError, ValueError):
        return {}


def _guardar(d):
    d['_leeme'] = ('El reto del debut (bot/debutantes.py): quién debutó desde el 12/10/2026 a las 6 PM ET, cuándo vence, si lo '
                   'cumplió y qué ya se avisó. Dlx, 12/10/2026.')
    with io.open(ESTADO, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(d, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write('\n')


def _mandar_chat(canal, cuerpo):
    """Al chat, mencionando SÓLO a los debutantes (nunca @here ni roles: `cuerpo['allowed_mentions']`)."""
    import escuchar as E
    s = E.sesion()
    r = s.post('https://discord.com/api/v10/channels/%s/messages' % canal, json=cuerpo)
    return r.status_code in (200, 201), r.status_code


def correr(aplicar=False, ahora=None):
    import most_wanted as MW
    import precios as PR
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    pool, evs, _R = MW.cargar_todo()
    viejo = _leer()
    antes = viejo.get('retos') or {}
    nuevo = retos(evs, PR.discords(pool), ahora=ahora)
    # lo ya avisado se conserva: la página y el chat, una vez cada uno
    for raw, r in nuevo.items():
        a = antes.get(raw) or {}
        for k in ('avisado', 'avisado_cumplido', 'chat'):
            if a.get(k):
                r[k] = a[k]
    nuevos = [(raw, r) for raw, r in nuevo.items() if not r.get('avisado') and not r['cumplido'] and not r['vencido']]
    cumplidos = [(raw, r) for raw, r in nuevo.items() if r['cumplido'] and not r.get('avisado_cumplido')]
    print('\n══ 🎤 EL RETO DEL DEBUT ══\n')
    print('   %d debut(s) desde el %s · %d cumplido(s) · %d nuevo(s) para avisar · %d cumplido(s) para avisar'
          % (len(nuevo), _dia(DESDE), sum(1 for r in nuevo.values() if r['cumplido']), len(nuevos), len(cumplidos)))
    # el chat: uno por día por servidor, con los que todavía no se nombraron
    hoy = _et(ahora).strftime('%Y-%m-%d')
    chats = viejo.get('chats') or {}
    por_sv = {}
    esperan = 0
    for raw, r in nuevo.items():
        if not r.get('chat') and not r['cumplido'] and not r['vencido'] and r['sv']:
            if _esperar_ganadores(r, ahora):
                esperan += 1
                continue
            por_sv.setdefault(r['sv'], []).append((raw, r))
    if esperan:
        print('   🌙 %d bienvenida(s) van adentro del aviso de ganadores de su evento' % esperan)
    salida = []
    import drops_merito as DM
    try:
        cuentas = cuentas_inscritas(json.load(io.open(os.path.join(BASE, 'datos', 'gente_eventos.json'), encoding='utf-8')),
                                    DM.quienes())
    except (OSError, ValueError):
        cuentas = {}
    for sv, gente in sorted(por_sv.items()):
        if chats.get(sv) == hoy:
            continue
        cuerpo, ids, texto = mensaje_chat(gente, sv, cuentas)
        salida.append((sv, gente, cuerpo, ids))
        print('\n   💬 %s%s:\n      %s' % (sv, '' if CHAT else ' (apagado: CHAT = False)', texto.replace('\n', '\n      ')))
    if not aplicar:
        return 0
    import avisos_personales as AP
    items = avisos_pagina(nuevos, cumplidos)
    if items and AP.encolar(items):
        for _raw, r in nuevos:
            r['avisado'] = hoy
        for _raw, r in cumplidos:
            r['avisado_cumplido'] = hoy
        print('   ✅ %d aviso(s) a la página' % len(items))
    if CHAT and salida:
        import avisar as AV
        import multiplicadores as MU
        canales = AV.canales_chat() or {}
        vivo = ((MU.ajustes_dueno() or {}).get('en_vivo') or {})
        for sv, gente, cuerpo, ids in salida:
            if vivo.get(sv) is not True or not canales.get(sv):
                print('   · %s: el bot en vivo está apagado ahí, no se manda' % sv)
                continue
            ok, cod = _mandar_chat(canales[sv], cuerpo)
            print('   %s %s: %s' % ('✅' if ok else '⚠️', sv, 'mandado' if ok else 'no salió (%d)' % cod))
            if ok:
                chats[sv] = hoy
                for _raw, r in gente:
                    r['chat'] = hoy
    _guardar({'retos': nuevo, 'chats': chats})
    return 0


def _self_check():
    mal = 0
    u = dt.timezone.utc
    t = lambda d, h=22: dt.datetime(2026, 10, d, h, tzinfo=u)       # noqa: E731
    evs = [{'n': 1, 't': t(10), 'sv': 'FFA', 'nombre': 'Viejo', 'fase': {'Ana': 'Campeón'}},
           {'n': 2, 't': t(14), 'sv': 'FFA', 'nombre': 'A', 'fase': {'Ana': 'Cuartos', 'Beto': 'Octavos', 'Caro': 'R32'}},
           {'n': 3, 't': t(14, 23), 'sv': 'DDF', 'nombre': 'B', 'fase': {'Beto': 'Cuartos'}},
           {'n': 4, 't': t(25), 'sv': 'FFA', 'nombre': 'C', 'fase': {'Caro': 'Cuartos'}}]
    r = retos(evs, {'Beto': '123456'}, ahora=t(26))
    _a = dt.datetime(2026, 11, 22, 6, tzinfo=u)
    _r = lambda n, h: {'n': n, 'debut': (_a - dt.timedelta(hours=h)).isoformat()}  # noqa: E731
    casos = [
        ('🌙 un debut de la noche espera al aviso de ganadores', _esperar_ganadores(_r(675, 1), _a, {})),
        ('🌙 antes de NOCHE_DESDE, la bienvenida sale sola', not _esperar_ganadores(_r(600, 1), _a, {})),
        ('🌙 si el aviso de ganadores no sale, la bienvenida sale sola', not _esperar_ganadores(_r(675, 1), _a, {'675': 'sin_chat'})),
        ('🌙 si ya salió, no se repite', _esperar_ganadores(_r(675, 30), _a, {'675': {'msg': '1'}})),
        ('🌙 pasado un día sin aviso, sale sola', not _esperar_ganadores(_r(675, 30), _a, {})),
        ('quien debutó antes del reto no tiene reto', 'Ana' not in r),
        ('otro evento el mismo día cuenta: Beto cumple', r['Beto']['cumplido'] and r['Beto']['con'] == 3),
        ('pasados los 7 días no cuenta: Caro venció', not r['Caro']['cumplido'] and r['Caro']['vencido']),
        ('la Tienda paga sólo a quien cumplió y tiene Discord',
         list(tienda({'retos': r}).values()) == [['123456', PREMIO, int(t(14, 23).timestamp() * 1000)]]),
        ('el mensaje menciona por cuenta y nombra al que no tiene',
         mensaje_chat([('Beto', r['Beto']), ('Caro', r['Caro'])])[1] == ['123456']
         and '<@123456>' in mensaje_chat([('Beto', r['Beto']), ('Caro', r['Caro'])])[2]
         and '**Caro**' in mensaje_chat([('Beto', r['Beto']), ('Caro', r['Caro'])])[2]),
        ('el mensaje no menciona a nadie más que a los debutantes: ni @here ni @everyone, y `parse` vacío',
         '@here' not in mensaje_chat([('Beto', r['Beto'])])[2] and '@everyone' not in mensaje_chat([('Beto', r['Beto'])])[2]
         and mensaje_chat([('Beto', r['Beto'])])[0]['allowed_mentions'] == {'parse': [], 'users': ['123456']}),
        ('✂️ (19/11) el link es un BOTÓN «Próximos eventos» con la sigla de su servidor, no un link suelto con vista previa',
         mensaje_chat([('Beto', r['Beto'])], 'URBF')[0]['components'][0]['components'][0]['url'].endswith('/s/urbf/eventos/')
         and mensaje_chat([('Beto', r['Beto'])], 'ZZZ')[0]['components'][0]['components'][0]['url'].endswith('/freestyle-rap/eventos')
         and 'http' not in mensaje_chat([('Beto', r['Beto'])], 'URBF')[0]['content']),
        ('✂️ dos renglones: la bienvenida y el reto en chico',
         mensaje_chat([('Beto', r['Beto'])])[2].count(chr(10)) == 1 and chr(10) + '-# 🎁' in mensaje_chat([('Beto', r['Beto'])])[2]),
        ('a varios les habla en plural',
         'Bienvenidos' in mensaje_chat([('Beto', r['Beto']), ('Caro', r['Caro'])])[2] and 'jugaron' in mensaje_chat([('Beto', r['Beto']), ('Caro', r['Caro'])])[2]
         and 'Bienvenida' in mensaje_chat([('Beto', r['Beto'])])[2] and 'te llevas' in mensaje_chat([('Beto', r['Beto'])])[2]),
        ('la mención de quien se anotó a sí mismo en su evento de debut, aunque no esté en la Lista',
         '<@900>' in mensaje_chat([('Caro', r['Caro'])], '', cuentas_inscritas(
             {str(r['Caro']['n']): {'ins': [{'cuenta': '900', 'es': 'Caro 🇨🇱', 't': 'Caro 🇨🇱'}]}}))[2]),
        ('una cuenta que anotó a dos personas (staff) no se usa, ni la de otra persona de la Lista',
         cuentas_inscritas({'5': {'ins': [{'cuenta': '901', 'es': 'Caro'}, {'cuenta': '901', 'es': 'Dani'}]}}) == {}
         and cuentas_inscritas({'5': {'ins': [{'cuenta': '123456', 'es': 'Caro'}]}}, {'Beto': '123456'}) == {}),
    ]
    for que, ok in casos:
        mal += not ok
        print('   %s %s' % ('✅' if ok else '🔴', que))
    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        sys.exit(_self_check())
    sys.exit(correr(aplicar='--aplicar' in sys.argv))
