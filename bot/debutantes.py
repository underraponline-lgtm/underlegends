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
                        'cuerpo': 'Reto: jugá otro antes del %s y te llevás %s Puntos de Tienda.'
                                  % (_dia(dt.datetime.fromisoformat(r['vence'])), '{:,}'.format(PREMIO).replace(',', '.')),
                        'url': WEB + 'eventos', 't': ahora})
    for raw, r in cumplidos:
        if r.get('did'):
            out.append({'id': _id(r['did'], 'cumplido', r['debut'][:10]), 'quien': r['did'],
                        'titulo': '✅ Reto cumplido: +%s Puntos de Tienda' % '{:,}'.format(PREMIO).replace(',', '.'),
                        'cuerpo': 'Volviste a jugar en tu primera semana. Ya están en tu billetera.',
                        'url': WEB + 'tienda', 't': ahora})
    return out


def mensaje_chat(gente, sv=''):
    """El mensaje del chat de un servidor: `(texto, [discord_ids])`. `gente` = `[(raw, reto)]` de ese servidor.

    🖼️ El link lleva `?sv=<SIGLA>` (Dlx, 12/10/2026: «que la foto de portada tenga temática de ese servidor»): la
    vista previa que arma Discord sale con la imagen de ese servidor (`ogDeServidor()` de bot/paginas/_worker.js)."""
    nombres = ['<@%s>' % r['did'] if r.get('did') else '**%s**' % raw for raw, r in gente]
    if len(nombres) > 1:
        quien = ', '.join(nombres[:-1]) + ' y ' + nombres[-1]
    else:
        quien = nombres[0]
    vence = min(dt.datetime.fromisoformat(r['vence']) for _raw, r in gente)
    texto = ('🎤 **Bienvenida a la Liga Global:** %s %s su primer evento.\n'
             '**Reto:** %s otro evento antes del %s y %s **%s Puntos de Tienda**. Cualquier servidor de la Liga '
             'cuenta. Lo siguen en %s'
             % (quien, 'jugaron' if len(gente) > 1 else 'jugó', 'jueguen' if len(gente) > 1 else 'jugá',
                _dia(vence), 'se llevan' if len(gente) > 1 else 'te llevás',
                '{:,}'.format(PREMIO).replace(',', '.'), WEB.rstrip('/') + ('?sv=' + sv if sv else '')))
    return texto, [r['did'] for _raw, r in gente if r.get('did')]


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


def _mandar_chat(canal, texto, ids):
    """Al chat, mencionando SÓLO a los debutantes (nunca @here ni roles)."""
    import escuchar as E
    s = E.sesion()
    r = s.post('https://discord.com/api/v10/channels/%s/messages' % canal,
               json={'content': texto[:1900], 'allowed_mentions': {'parse': [], 'users': ids[:20]}})
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
    for raw, r in nuevo.items():
        if not r.get('chat') and not r['cumplido'] and not r['vencido'] and r['sv']:
            por_sv.setdefault(r['sv'], []).append((raw, r))
    salida = []
    for sv, gente in sorted(por_sv.items()):
        if chats.get(sv) == hoy:
            continue
        texto, ids = mensaje_chat(gente, sv)
        salida.append((sv, gente, texto, ids))
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
        for sv, gente, texto, ids in salida:
            if vivo.get(sv) is not True or not canales.get(sv):
                print('   · %s: el bot en vivo está apagado ahí, no se manda' % sv)
                continue
            ok, cod = _mandar_chat(canales[sv], texto, ids)
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
    casos = [
        ('quien debutó antes del reto no tiene reto', 'Ana' not in r),
        ('otro evento el mismo día cuenta: Beto cumple', r['Beto']['cumplido'] and r['Beto']['con'] == 3),
        ('pasados los 7 días no cuenta: Caro venció', not r['Caro']['cumplido'] and r['Caro']['vencido']),
        ('la Tienda paga sólo a quien cumplió y tiene Discord',
         list(tienda({'retos': r}).values()) == [['123456', PREMIO, int(t(14, 23).timestamp() * 1000)]]),
        ('el mensaje menciona por cuenta y nombra al que no tiene',
         mensaje_chat([('Beto', r['Beto']), ('Caro', r['Caro'])])[1] == ['123456']
         and '<@123456>' in mensaje_chat([('Beto', r['Beto']), ('Caro', r['Caro'])])[0]
         and '**Caro**' in mensaje_chat([('Beto', r['Beto']), ('Caro', r['Caro'])])[0]),
        ('el mensaje no menciona a nadie más que a los debutantes: ni @here ni @everyone',
         '@here' not in mensaje_chat([('Beto', r['Beto'])])[0] and '@everyone' not in mensaje_chat([('Beto', r['Beto'])])[0]),
        ('el link del chat de un servidor lleva su sigla: la vista previa sale con su imagen',
         mensaje_chat([('Beto', r['Beto'])], 'URBF')[0].endswith('/freestyle-rap?sv=URBF')),
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
