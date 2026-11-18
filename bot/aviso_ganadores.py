"""🏆 EL AVISO DESPUÉS DE CADA EVENTO, EN EL CHAT GENERAL DE SU SERVIDOR (Discord, tanda 2, 17/11/2026).

    python bot/aviso_ganadores.py            # qué se mandaría (no manda nada)
    python bot/aviso_ganadores.py --aplicar  # lo manda (lo corre el ciclo, paso 2b4c)
    python bot/aviso_ganadores.py --auto     # el self-check

Dlx, 17/11/2026: *«después del evento, al campeón se le avisa de su premio o drop mencionándolo en el chat general y a
todos los que hayan ganado, y la opción de que se pueda abrir algunos drops en el mismo Discord»*; *«el aviso
post-evento en el chat general: prendido en todos los socios, el dueño lo apaga»*; y *«menciona a quien gana un drop»*
(sólo se puede mencionar a quien tiene su Discord en la Lista; el resto va nombrado con cómo vincularse).

- UNO POR EVENTO, después de que el ciclo reparte sus drops (paso 2b4b): campeón y podio de `Resultados` y los batacazos
  de `1v1`, con las MISMAS reglas que `drops_merito.py` (lo que dice el aviso es lo que se dio).
- EN EL CHAT GENERAL DEL SERVIDOR DEL EVENTO, con la misma regla que `chats.chat_general()`. Sólo socios donde está el bot.
- MENCIONA SÓLO A LOS GANADORES con su cuenta en la Lista (`allowed_mentions.users`, nunca @everyone ni roles). Los
  demás, en negrita y con `/vincular`: si se vinculan en `VENTANA_DIAS`, el drop les llega igual (`drops_merito`).
- BOTONES (desde el 18/11/2026): UNO POR GANADOR Y POR PREMIO, con su nombre, que sólo abre esa persona
  (`dd:<drop|star|nido>:x:<id>`, worker.js); el del Nido le pasa el link de la página, donde se abre. Y «Ver mis drops»
  (`?drops=1`). Antes eran «Abrir mi Drop / Star» sin dueño, y cualquiera abría los suyos desde el aviso de otro.
- EL FORMATO, el de los anuncios de la Liga (Componentes V2): un recuadro con el color del servidor.
- LO APAGA EL STAFF de cada servidor en su panel (`ganadores` en `cfg:<guild>`, prendido de entrada).
- UNA SOLA VEZ: `datos/avisos_ganadores.json` (en `ARCHIVOS` de bot/ci/guardar.sh). La primera vez se siembra con lo que
  ya hay y no se avisa nada para atrás. Sólo eventos de los últimos `DIAS`.
"""
import datetime as dt
import io
import json
import os
import re
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path[:0] = [SCR, os.path.join(BASE, 'sheet'), BASE]

ESTADO = os.path.join(BASE, 'datos', 'avisos_ganadores.json')
API = 'https://discord.com/api/v10'
WEB_DROPS = 'https://underlegends.pages.dev/freestyle-rap/?drops=1'
#: un evento procesado tarde (una corrección de días después) no se anuncia: sería ruido en el chat
DIAS = 2
#: el tope de menciones de Discord es 100; un evento no tiene tantos ganadores
MENCIONES = 40


def _j(p, d):
    try:
        with io.open(p, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return d


def _guardar(x):
    x['_leeme'] = ('El aviso de los ganadores de cada evento en el chat general de su servidor (bot/aviso_ganadores.py, '
                   'Discord tanda 2, 17/11/2026): qué eventos ya se avisaron, dónde y con qué mensaje. «semilla»: los que ya '
                   'estaban cuando arrancó, que no se avisan.')
    with io.open(ESTADO, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(x, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write('\n')


def _md(s):
    """Un nombre que no rompa el markdown de Discord (ni lo use para mencionar)"""
    return re.sub(r'([*_~`|>\\])', r'\\\1', str(s or '')).replace('@', '@​')


class _Todos(dict):
    """Un `Q` de `drops_merito` que deja pasar a todos con su nombre (para nombrar también a quien no tiene cuenta)"""

    def get(self, k, d=None):
        return k

    def __getitem__(self, k):
        return k


def ganadores(res, duelos, Q, desde):
    """`{ev: {'camp': (nombre, tipo), 'pod': [nombre], 'bat': [(ganador, perdedor)]}}` con las reglas de `drops_merito`.
    `res` y `duelos`: las hojas con su cabecera. `Q`: nombre → Discord ID (para el Nido de la semana, que va por cuenta)"""
    import drops_merito as DM
    todos = DM.de_resultados(res, _Todos(), desde=desde)
    reales = {(x['q'], x['o']): x['k'] for x in DM.de_resultados(res, Q, desde=desde)}
    out = {}
    for x in todos:
        o = x['o'].split(':')
        ev = o[1]
        e = out.setdefault(ev, {'camp': None, 'pod': [], 'bat': [], 'd': x.get('d', '')})
        if o[0] == 'camp':
            q = Q.get(x['q'])
            e['camp'] = (x['q'], reales.get((q, x['o']), x['k']) if q else x['k'])
        elif o[0] == 'pod':
            e['pod'].append(x['q'])
    # los batacazos: el nombre del perdedor, de la hoja (el origen lo trae recortado)
    i, cab = DM._cabecera(duelos, 'Ganador')
    nombres = {}
    if i is not None:
        c = {k: cab.index(k) for k in ('Evento #', 'Perdedor') if k in cab}
        for f in duelos[i + 1:]:
            if len(f) > max(c.values() or [0]):
                nombres[(str(f[c['Evento #']]), DM._llave(f[c['Perdedor']]))] = str(f[c['Perdedor']])
    for x in DM.de_duelos(duelos, _Todos(), desde=desde):
        _b, ev, perd = x['o'].split(':', 2)
        e = out.setdefault(ev, {'camp': None, 'pod': [], 'bat': [], 'd': x.get('d', '')})
        e['bat'].append((x['q'], nombres.get((ev, perd), perd)))
    return out


#: los colores de cada servidor (la barra del recuadro); sin color, el magenta de la marca
COLOR_UL = 0xE41373
#: un botón por ganador y por premio: hasta tantos (Discord deja 5 por fila y 40 piezas por mensaje)
BOTONES = 10


def _titulo(evento):
    """El nombre del evento sin el adorno del organizador: «__ NEW GENESIS __» salía con los guiones a la vista (Dlx,
    18/11/2026, con la captura del aviso de FFA)."""
    t = str(evento or '').strip()
    if not t or t.startswith('('):
        return ''
    return re.sub(r'^[\s_*~|`]+|[\s_*~|`]+$', '', t).strip()


def _sv_info(sv):
    """`(nombre del servidor, color)`, de `datos/servidores.json` y `datos/colores_sv_marca.json`."""
    svs = (_j(os.path.join(BASE, 'datos', 'servidores.json'), {}) or {}).get('servidores') or {}
    col = ((_j(os.path.join(BASE, 'datos', 'colores_sv_marca.json'), {}) or {}).get('usar') or {}).get(sv) or ''
    try:
        c = int(str(col).lstrip('#'), 16) if col else COLOR_UL
    except ValueError:
        c = COLOR_UL
    return (svs.get(sv) or {}).get('nombre') or sv, c


def _oficiales():
    """`{discord_id: nombre de la Lista, sin bandera}`: el nombre que va en cada botón. La hoja de resultados trae a veces la
    clave («rodrilp») y el botón tiene que decir «Rodri LP», como el ranking."""
    out = {}
    for r in _j(os.path.join(BASE, 'datos', 'padron.json'), []) or []:
        did = str(r.get('discord_id') or '').strip()
        n = re.sub('[\U0001F1E6-\U0001F1FF]', '', str(r.get('raw') or '')).strip()
        if did and n and did not in out:
            out[did] = n
    return out


def mensaje(evento, sv, g, Q, miembros, oficiales=None):
    """`(componentes, ids, texto)` del aviso de un evento: un mensaje de Componentes V2 (`flags` 32768) con su texto
    plano para la consola. `g`: lo de `ganadores()`; `Q`: nombre → Discord ID; `miembros`: los IDs de DRA (los drops
    por ganar se abren siendo miembro). Sin campeón, `None`.

    🎨 REHECHO EL 18/11/2026 (Dlx, con la captura del primero, el de NEW GENESIS: «asegúrate también que estos botones
    sólo los abran las respectivas personas… y remakear ese texto también»). Era texto suelto con «Abrir mi Drop» y
    «Abrir mi Star» sin dueño: cualquiera que tuviera un drop guardado abría el SUYO desde el aviso de otro. Ahora:
    - el formato de los anuncios de la Liga (la v1.07): un recuadro con la barra del color del servidor, el evento
      arriba, el campeón, los premios y la letra chica;
    - UN BOTÓN POR GANADOR Y POR PREMIO, con su nombre («Drop · Oasis»), que sólo abre esa persona (`dd:<tipo>:x:<id>`:
      el Worker contesta «eso es de otra persona» a los demás). El Nido no se abre en Discord: su botón le manda el
      link de la página, sólo a él (`dd:nido`);
    - el título sin el adorno del organizador (`_titulo()`).
    """
    if not g.get('camp'):
        return None
    ids, sin, botones = [], [], []

    def quien(n):
        i = Q.get(n)
        if i:
            if i not in ids:
                ids.append(i)
            return '<@%s>' % i
        if n not in sin:
            sin.append(n)
        return '**%s**' % _md(n)

    def boton(tipo, n):
        i = Q.get(n)
        cid = 'dd:%s:x:%s' % (tipo, i) if i else ''
        if not i or len(botones) >= BOTONES or any(b['custom_id'] == cid for b in botones):
            return
        emoji, nombre = {'nido': ('🥚', 'Nido'), 'drop': ('🎁', 'Drop'), 'star': ('⚡', 'Star')}[tipo]
        botones.append({'type': 2, 'style': 1 if tipo != 'nido' else 2, 'label': ('%s · %s' % (nombre, (oficiales or {}).get(i) or n))[:80],
                        'emoji': {'name': emoji}, 'custom_id': cid})

    def y(xs):
        xs = list(xs)
        return xs[0] if len(xs) == 1 else ', '.join(xs[:-1]) + ' y ' + xs[-1]

    titulo = _titulo(evento)
    nombre_sv, color = _sv_info(sv) if sv else ('', COLOR_UL)
    camp, tipo = g['camp']
    cabeza = '## 🏆 %s\n-# %s' % (_md(titulo) if titulo else 'Terminó el evento',
                                  ('Terminó en **%s**' % _md(nombre_sv)) if nombre_sv else 'Terminó')
    corona = '👑 **Campeón:** %s\n%s Se lleva un **%s** por el título.' % (
        quien(camp), '🥚' if tipo == 'nido' else '🎁', 'Nido' if tipo == 'nido' else 'Drop')
    boton('nido' if tipo == 'nido' else 'drop', camp)
    premios = []
    if g.get('pod'):
        premios.append('🎁 **Drop** por el podio: %s' % y(quien(n) for n in g['pod']))
        for n in g['pod']:
            boton('drop', n)
    for gan, perd in g.get('bat') or []:
        premios.append('⚡ **Star** por el batacazo: %s, que le ganó a **%s**' % (quien(gan), _md(perd)))
        boton('star', gan)
    chica = ['-# Cada botón lo abre sólo quien ganó, y también se abre en la página.']
    if sin:
        chica.append('-# 🔗 %s: vincula tu cuenta con `/vincular` en los próximos 14 días y lo que ganaste es tuyo.'
                     % y('**%s**' % _md(n) for n in sin))
    if any(i not in miembros for i in ids):
        chica.append('-# 🔒 Si todavía no eres Miembro de DRA, tu drop te espera guardado hasta que te vincules: `/vincular`.')
    adentro = [{'type': 10, 'content': cabeza}, {'type': 10, 'content': corona}]
    if premios:
        adentro += [{'type': 14, 'divider': True, 'spacing': 1}, {'type': 10, 'content': '\n'.join(premios)}]
    filas = [botones[i:i + 5] for i in range(0, len(botones), 5)]
    adentro += [{'type': 1, 'components': f} for f in filas]
    adentro += [{'type': 14, 'divider': False, 'spacing': 1}, {'type': 10, 'content': '\n'.join(chica)},
                {'type': 1, 'components': [{'type': 2, 'style': 5, 'label': 'Ver mis drops', 'emoji': {'name': '🐉'}, 'url': WEB_DROPS}]}]
    comps = [{'type': 17, 'accent_color': color, 'components': adentro}]
    texto = '\n'.join([cabeza, corona] + premios + ['[%s]' % ' '.join(b['label'] for b in botones)] + chica)
    return comps, ids[:MENCIONES], texto


def _cfg(gid):
    """El panel de ese servidor (`cfg:<guild>` de KV): `{}` si nunca lo tocó, `None` si no se puede saber."""
    try:
        import subir_datos as SD
        r = SD.sesion().get('%s/values/cfg:%s' % (SD.API, gid), timeout=20)
    except Exception:                                    # noqa: BLE001
        return None
    if r.status_code == 404:
        return {}
    if r.status_code != 200:
        return None
    try:
        return r.json() or {}
    except ValueError:
        return None


def _fecha(s, hoy):
    """`dd/mm` de la hoja → fecha (del año que corresponde)"""
    try:
        d, m = (int(x) for x in str(s).split('/')[:2])
        f = dt.date(hoy.year, m, d)
        return f if f <= hoy + dt.timedelta(days=1) else dt.date(hoy.year - 1, m, d)
    except (ValueError, TypeError):
        return None


def correr(aplicar=False):
    import drops_merito as DM
    import espejo_t1 as ES
    import zoneinfo
    hoy = dt.datetime.now(zoneinfo.ZoneInfo('America/New_York')).date()
    estado = _j(ESTADO, None)
    hoja = lambda h: DM._hoja(ES, h)                     # noqa: E731
    evs = hoja('Eventos Procesados')
    cab = [str(c) for c in (evs[0] if evs else [])]
    if '#' not in cab:
        print('   🏆 el aviso de los ganadores: no encuentro los eventos procesados')
        return 0
    c = {k: cab.index(k) for k in ('#', 'Evento', 'Servidor', 'Fecha') if k in cab}
    eventos = {str(f[c['#']]): f for f in evs[1:] if len(f) > max(c.values())}
    if estado is None:
        # 🌱 la primera vez: lo que ya hay no se avisa (sería una pared de mensajes de eventos viejos)
        if aplicar:
            _guardar({'avisados': {ev: 'semilla' for ev in eventos}})
        print('   🏆 el aviso de los ganadores: arranca de cero (%d eventos sembrados, ninguno se avisa)' % len(eventos))
        return 0
    avisados = estado.get('avisados') or {}
    Q = DM.quienes()
    G = ganadores(hoja('Resultados'), hoja('1v1'), Q, hoy - dt.timedelta(days=DIAS + 1))
    nuevos = []
    for ev, f in eventos.items():
        if ev in avisados or ev not in G:
            continue
        fe = _fecha(f[c['Fecha']], hoy)
        if not fe or (hoy - fe).days > DIAS:
            continue
        nuevos.append((ev, str(f[c['Evento']] or ''), str(f[c['Servidor']] or '').upper()))
    if not nuevos:
        print('   🏆 el aviso de los ganadores: nada nuevo')
        return 0
    miembros = set(str(x) for x in ((_j(os.path.join(BASE, 'datos', 'verificados.json'), {}) or {}).get('ids') or []))
    oficiales = _oficiales()
    import chats as CH
    svs = dict(CH.servidores())
    s = None
    canales = {}
    for ev, nombre, sv in sorted(nuevos, key=lambda x: int(x[0]) if x[0].isdigit() else 0):
        m = mensaje(nombre, sv, G[ev], Q, miembros, oficiales)
        if not m:
            avisados[ev] = 'sin_campeon'
            continue
        comps, ids, texto = m
        print('\n   🏆 #%s %s (%s) · %d mención(es)\n      %s' % (ev, nombre, sv, len(ids), texto.replace('\n', '\n      ')))
        if not aplicar:
            continue
        gid = svs.get(sv)
        if not gid:
            avisados[ev] = 'sin_bot'
            print('      · %s no es un socio con el bot: no se manda' % sv)
            continue
        cfg = _cfg(gid)
        if cfg is None:
            print('      ⚠️ %s: no sé si lo apagaron (sin Cloudflare): queda para la próxima' % sv)
            continue
        if cfg.get('ganadores') is False:
            avisados[ev] = 'apagado'
            print('      · %s: apagado en su panel' % sv)
            continue
        if s is None:
            import escuchar as E
            s = E.sesion()
        if sv not in canales:
            import escuchar as E
            r = s.get('%s/guilds/%s/channels' % (API, gid), timeout=20)
            cs = r.json() if r.status_code == 200 else []
            canales[sv] = CH.chat_general(cs, E.categorias_staff(cs) | E.categorias_fuera(gid)) if cs else None
        canal = canales[sv]
        canal = canal.get('id') if isinstance(canal, dict) else canal
        if not canal:
            avisados[ev] = 'sin_chat'
            print('      · %s: sin chat general' % sv)
            continue
        # 🎨 Componentes V2 (`flags` 32768): sin `content`, todo va en el recuadro. Las menciones del texto suenan igual
        # (`allowed_mentions.users`: sólo los ganadores)
        r = s.post('%s/channels/%s/messages' % (API, canal), json={
            'flags': 32768, 'components': comps, 'allowed_mentions': {'parse': [], 'users': ids}})
        if r.status_code in (200, 201):
            avisados[ev] = {'sv': sv, 'canal': str(canal), 'msg': str((r.json() or {}).get('id') or ''), 'dia': hoy.isoformat()}
            print('      ✅ mandado')
        else:
            print('      ⚠️ no salió (%s): queda para la próxima' % r.status_code)
    if aplicar:
        _guardar({'avisados': avisados})
    return 0


def _self_check():
    mal = 0

    def ok(c, t):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', t))

    print('\n══ 🏆 EL AVISO DE LOS GANADORES ══\n')
    res = [['Evento #', 'Fecha', 'Servidor', 'Rapero', 'Posición'],
           ['700', '17/11/2026', 'FFA', 'Ana', 'Campeón'], ['700', '17/11/2026', 'FFA', 'Beto', 'Subcampeón'],
           ['700', '17/11/2026', 'FFA', 'Caro*', 'Tercero'], ['701', '17/11/2026', 'FFA', 'Ana', 'Campeón']]
    duelos = [['Evento #', 'Fecha', 'Ganador', 'Perdedor']] + [['600', '10/11/2026', 'Fuerte', 'Debil%d' % i] for i in range(12)] + \
             [['700', '17/11/2026', 'Beto', 'Fuerte']]
    Q = {'Ana': '111111', 'Beto': '222222'}
    desde = dt.date(2026, 11, 1)
    G = ganadores(res, duelos, Q, desde)
    ok(G['700']['camp'] == ('Ana', 'nido') and G['701']['camp'] == ('Ana', 'drop'), 'el primer título de la semana es un Nido y el segundo un Drop, como en drops_merito')
    ok(set(G['700']['pod']) == {'Beto', 'Caro*'} and ('Beto', 'Fuerte') in G['700']['bat'], 'el podio y el batacazo, con el nombre del perdedor')
    comps, ids, t = mensaje('__ TOKYO VOL 27 __', 'FFA', G['700'], Q, {'111111'})
    todo = json.dumps(comps, ensure_ascii=False)
    bots = [b for c in comps[0]['components'] if c['type'] == 1 for b in c['components']]
    ok(comps[0]['type'] == 17 and comps[0]['accent_color'] == 0x26045B and '<@111111>' in todo and '<@222222>' in todo
       and ids == ['111111', '222222'], 'un recuadro con el color del servidor; menciona sólo a quien tiene su cuenta, una vez cada uno')
    ok('## 🏆 TOKYO VOL 27' in todo and '__' not in t.split('\n')[0], 'el título sin los «__» del organizador')
    ok('**Caro\\\\*' in todo and '/vincular' in todo, 'quien no tiene cuenta va en negrita (escapado) y con cómo vincularse')
    ok('Miembro de DRA' in todo, 'y si alguno no es de DRA, que su drop lo espera')
    cids = [b.get('custom_id') for b in bots]
    ok(cids[:3] == ['dd:nido:x:111111', 'dd:drop:x:222222', 'dd:star:x:222222'] and 'dd:drop:x:' not in cids
       and any(b.get('url') == WEB_DROPS for b in bots) and [b.get('label') for b in bots][:3] == ['Nido · Ana', 'Drop · Beto', 'Star · Beto'],
       'un botón por ganador y premio, con su nombre y su dueño (Caro no tiene cuenta: sin botón); ninguno sin dueño')
    c2, _i2, t2 = mensaje('(sin titulo)', 'LKR', {'camp': ('Ana', 'drop'), 'pod': [], 'bat': []}, Q, {'111111'})
    t2j = json.dumps(c2, ensure_ascii=False)
    ok('Terminó el evento' in t2j and 'dd:star' not in t2j and 'Miembro de DRA' not in t2j and 'dd:drop:x:111111' in t2j,
       'sin título, «Terminó el evento»; sin batacazos, sin Star; todos de DRA, sin el candado; el campeón con su Drop')
    ok(_titulo('**__ NEW GENESIS __**') == 'NEW GENESIS' and _titulo('(sin titulo)') == '', 'el adorno del título se va')
    c3, _i3, _t3 = mensaje('X', 'FFA', {'camp': ('rodrilp', 'drop'), 'pod': [], 'bat': []}, {'rodrilp': '333333'}, set(), {'333333': 'Rodri LP'})
    ok('Drop · Rodri LP' in json.dumps(c3, ensure_ascii=False), 'el botón con el nombre de la Lista, no con la clave de la hoja')
    ok(mensaje('X', 'FFA', {'camp': None, 'pod': ['Ana'], 'bat': []}, Q, set()) is None, 'sin campeón, no hay aviso')
    ok(_md('@everyone') == '@​everyone', 'un nombre con @ no puede mencionar a nadie')
    ok(_fecha('17/11', dt.date(2026, 11, 18)) == dt.date(2026, 11, 17) and _fecha('31/12', dt.date(2027, 1, 1)) == dt.date(2026, 12, 31),
       'la fecha de la hoja (dd/mm), también la del año anterior')
    print('\n   %s' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return 1 if mal else 0


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if '--auto' in sys.argv:
        return _self_check()
    return correr(aplicar='--aplicar' in sys.argv)


if __name__ == '__main__':
    sys.exit(main())
