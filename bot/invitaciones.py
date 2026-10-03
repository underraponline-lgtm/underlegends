# -*- coding: utf-8 -*-
"""LAS INVITACIONES DE LA LIGA: una permanente por servidor, y cuántos entraron por ella.

    python bot/invitaciones.py                    en seco: qué canal y qué haría
    python bot/invitaciones.py --crear --aplicar  crea las que faltan (a mano)
    python bot/invitaciones.py --contar --aplicar cuántos entraron (el ciclo, 2b5)
    python bot/invitaciones.py --auto             el self-check

🔑 Dlx, 29/09/2026: *«tú puedes crear una permanente, ¿no? De hecho, si
puedes, crea una invitación permanente para cada servidor, y de esta manera
podemos reconocer cuántas personas se unieron por ti, la Liga Global»*.

Cada servidor donde está el bot tiene UNA invitación que creó el bot: sin
vencimiento, sin tope de usos, al canal de bienvenida. Es la que muestran
«Mundo» y el bot (`servidores.json` → `invitacion`, y `SERVIDORES` en
`bot/worker.js`), así que quien entra desde la Liga entra por ella, y sus
`uses` son la cuenta. La de antes queda en `invitacion_antes`.

⚠️ CREAR ES A MANO, CONTAR ES DEL CICLO. Una invitación es algo que queda en
el servidor de otro: si un admin la borra, el ciclo lo avisa y no la vuelve a
crear sola.

⚠️ CONTAR PIDE «GESTIONAR SERVIDOR». Discord da los `uses` sólo a quien
puede listar las invitaciones: el bot es admin en DRA, FFA, SR y URBF. En FFS
sólo puede crear invitaciones, así que ahí la cuenta queda en blanco —no en
cero— hasta que le den ese permiso.

⚠️ «SE UNIÓ POR LA LIGA» NO ES «SE QUEDÓ»: `uses` cuenta entradas, y quien se
va no la resta.
"""
import datetime as dt
import io
import json
import os
import re
import sys
import unicodedata
import urllib.parse

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path[:0] = [os.path.join(BASE, 'bot'), os.path.join(BASE, 'sheet'), BASE]

SERVIDORES = os.path.join(BASE, 'datos', 'servidores.json')
BOT_EN = os.path.join(BASE, 'datos', 'bot_en.json')
CUENTA = os.path.join(BASE, 'datos', 'invitaciones.json')
API = 'https://discord.com/api/v10'
MOTIVO = 'Liga Global: invitación permanente para contar quién llega desde la Liga'
VER = 1 << 10               # VIEW_CHANNEL
ADMIN = 1 << 3


def _json(ruta, defecto):
    try:
        with io.open(ruta, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return defecto


def _guardar(ruta, dato):
    with io.open(ruta, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(dato, f, ensure_ascii=False, indent=1)
        f.write('\n')


def _n(s):
    """El nombre de un canal sin la letra de fantasía: `𝐑𝐄𝐆𝐋𝐀𝐒` -> `reglas`."""
    s = unicodedata.normalize('NFKD', str(s or ''))
    return ''.join(c for c in s if c.isalnum()).lower()


def la_ve_todos(canal, gid, base):
    """¿@everyone ve ese canal? El permiso del rol, con los del canal encima."""
    p = int(base or 0)
    if p & ADMIN:
        return True
    for o in canal.get('permission_overwrites') or []:
        if str(o.get('id')) == str(gid):
            p = (p & ~int(o.get('deny') or 0)) | int(o.get('allow') or 0)
    return bool(p & VER)


def elegir_canal(guild, canales, base):
    """El canal al que lleva la invitación: bienvenida, reglas o el del sistema.

    ⚠️ SÓLO UNO QUE @everyone PUEDA VER: una invitación a un canal que el que
    llega no ve lo deja en otro que no eligió nadie.
    """
    gid = guild.get('id')
    texto = [c for c in canales if c.get('type') in (0, 5)
             and la_ve_todos(c, gid, base)]
    por_id = {c['id']: c for c in texto}
    for c in sorted(texto, key=lambda c: c.get('position') or 0):
        if any(w in _n(c.get('name')) for w in ('bienven', 'welcome')):
            return c
    for cid in (guild.get('rules_channel_id'), guild.get('system_channel_id')):
        if cid and cid in por_id:
            return por_id[cid]
    return texto[0] if texto else None


def _sesion():
    import escuchar as E
    return E.sesion()


def servidores_del_bot():
    """`[(sv, entrada)]` de los servidores de la Liga donde está el bot."""
    d = _json(SERVIDORES, {})
    en = set(_json(BOT_EN, []) or [])
    return [(sv, x) for sv, x in (d.get('servidores') or {}).items()
            if sv in en and x.get('guild_id') and x.get('confirmado')]


def crear(aplicar=False):
    s = _sesion()
    d = _json(SERVIDORES, {})
    hoy = dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%d')
    hechas = 0
    for sv, x in servidores_del_bot():
        gid = x['guild_id']
        if (x.get('invitacion_liga') or {}).get('codigo'):
            print('   %-5s ya tiene la suya: %s' % (sv, x['invitacion_liga']['codigo']))
            continue
        g = s.get('%s/guilds/%s' % (API, gid), timeout=30).json()
        roles = {r['id']: r for r in s.get('%s/guilds/%s/roles' % (API, gid), timeout=30).json()}
        chs = s.get('%s/guilds/%s/channels' % (API, gid), timeout=30).json()
        c = elegir_canal(g, chs, (roles.get(gid) or {}).get('permissions'))
        if not c:
            print('   %-5s 🔴 no hay un canal que vean todos' % sv)
            continue
        print('   %-5s -> #%s' % (sv, c.get('name')))
        if not aplicar:
            continue
        r = s.post('%s/channels/%s/invites' % (API, c['id']), timeout=30,
                   headers={'X-Audit-Log-Reason': urllib.parse.quote(MOTIVO)},
                   json={'max_age': 0, 'max_uses': 0, 'temporary': False, 'unique': True})
        if not r.ok:
            print('         🔴 Discord dijo %d: %s' % (r.status_code, r.text[:120]))
            continue
        cod = r.json().get('code')
        e = d['servidores'][sv]
        viejo = e.get('invitacion') or ''
        if viejo and viejo.rstrip('/').split('/')[-1] != cod and not e.get('invitacion_antes'):
            e['invitacion_antes'] = viejo
        e['invitacion'] = 'https://discord.gg/%s' % cod
        e['invitacion_liga'] = {'codigo': cod, 'canal': c.get('name'), 'canal_id': c['id'],
                                'creada': hoy}
        hechas += 1
        print('         ✅ https://discord.gg/%s' % cod)
    if hechas:
        d['_invitacion_liga_leeme'] = (
            'invitacion_liga: la invitación permanente que creó el bot en cada servidor '
            '(Dlx, 29/09/2026: «crea una invitación permanente para cada servidor, y de esta '
            'manera podemos reconocer cuántas personas se unieron por ti la Liga Global»). '
            'Es la de `invitacion`; la de antes quedó en `invitacion_antes`. Cuántos '
            'entraron: datos/invitaciones.json (bot/invitaciones.py --contar).')
        _guardar(SERVIDORES, d)
        print('\n   ✅ %d invitación(es) nueva(s) en datos/servidores.json' % hechas)
        print('   ⚠️ copiá las mismas a SERVIDORES de bot/worker.js y desplegá')
    return hechas


# ── «INSCRIBITE YA»: una invitación más por servidor, al canal donde se anota ─────────────────────────────────────
#
# 🔑 Dlx, 03/10/2026, sobre el botón del aviso de `eventos-hoy`: *«que sea el link de invitación al canal… el de
# inscripciones mejor… porque la gente no puede entrar de esa forma»* (un link a un mensaje sólo abre si ya estás en
# el servidor), y a «el bot tiene que crear una invitación permanente a ese canal en cada servidor»: *«1. a»*.
#
# ⚠️ UNA POR CANAL DE INSCRIPCIONES, NO UNA POR SERVIDOR: Urban tiene uno para sus torneos y otro para la Red Bull
# Cabrana, y FFS uno para FFS Bull y otro para las Plazas. El botón elige la de la misma categoría que el anuncio
# (`invitacionPara()` de `bot/avisos.js`). Sin ningún canal de inscripciones —DRA se anota con el botón de la tarjeta
# del anuncio—, el canal de eventos donde anuncia.
#
# ⚠️ CREAR SIGUE SIENDO A MANO (`--inscripciones --crear --aplicar`), como la de bienvenida: queda en el servidor de
# otro. Viajan al vigía en `meta` (`bot/subir_datos.py`) y a la página en el payload (`bot/subir_web.py`).
MOTIVO_INSC = 'Liga Global: invitación permanente al canal de inscripciones, para el botón «Inscribite ya»'
EVENTOS_INSC = re.compile(r'evento|torneo|competenc', re.I)


def canales_inscripcion(chs, gid, base, fuera=(), anunciados=()):
    """Los canales a los que lleva «Inscribite ya»: los de inscripciones que ve @everyone, fuera de las categorías de
    staff y de las que el servidor declara afuera; sin ninguno, los de eventos donde el servidor anunció algo."""
    import anuncios as A
    staff = {str(c.get('id')) for c in chs if c.get('type') == 4 and
             A.STAFF.search(unicodedata.normalize('NFKD', c.get('name') or ''))}
    no = staff | {str(i) for i in fuera}

    def sirve(c):
        n = unicodedata.normalize('NFKD', c.get('name') or '')
        return (c.get('type') in (0, 5) and not A.STAFF.search(n) and str(c.get('parent_id') or '') not in no
                and la_ve_todos(c, gid, base))
    insc = [c for c in chs if sirve(c) and A.PATRON_INSC.search(unicodedata.normalize('NFKD', c.get('name') or ''))]
    if insc:
        return sorted(insc, key=lambda c: c.get('position') or 0)
    # ⚠️ sólo los de eventos y competencias, no los de novedades ni anuncios (lo mismo que escucha el vigía): DRA tiene un
    # anuncio en «novedades», y ahí no se anota nadie. Y su canal de competencias no lo ve @everyone, así que DRA queda
    # sin ninguna: el botón usa la invitación del servidor («Entrar al servidor»)
    an = {str(i) for i in anunciados}
    return [c for c in chs if sirve(c) and str(c.get('id')) in an and
            EVENTOS_INSC.search(unicodedata.normalize('NFKD', c.get('name') or ''))]


def crear_inscripcion(aplicar=False):
    s = _sesion()
    d = _json(SERVIDORES, {})
    anuncios = _json(os.path.join(BASE, 'datos', 'anuncios.json'), {})
    anuncios = anuncios if isinstance(anuncios, list) else (anuncios.get('anuncios') or [])
    hoy = dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%d')
    hechas = 0
    for sv, x in servidores_del_bot():
        gid = x['guild_id']
        roles = {r['id']: r for r in s.get('%s/guilds/%s/roles' % (API, gid), timeout=30).json()}
        chs = s.get('%s/guilds/%s/channels' % (API, gid), timeout=30).json()
        ya = {str(i.get('canal_id')): i for i in (x.get('invitaciones_inscripcion') or [])}
        cs = canales_inscripcion(chs, gid, (roles.get(gid) or {}).get('permissions'),
                                 (x.get('categorias_fuera') or {}).get('ids') or (),
                                 [a.get('canal_id') for a in anuncios if a.get('servidor') == sv])
        if not cs:
            print('   %-5s 🔴 ni un canal de inscripciones ni uno de eventos con anuncios' % sv)
            continue
        for c in cs:
            if str(c['id']) in ya:
                print('   %-5s #%s ya tiene la suya: %s' % (sv, c.get('name'), ya[str(c['id'])]['codigo']))
                continue
            print('   %-5s -> #%s' % (sv, c.get('name')))
            if not aplicar:
                continue
            r = s.post('%s/channels/%s/invites' % (API, c['id']), timeout=30,
                       headers={'X-Audit-Log-Reason': urllib.parse.quote(MOTIVO_INSC)},
                       json={'max_age': 0, 'max_uses': 0, 'temporary': False, 'unique': True})
            if not r.ok:
                print('         🔴 Discord dijo %d: %s' % (r.status_code, r.text[:120]))
                continue
            cod = r.json().get('code')
            d['servidores'][sv].setdefault('invitaciones_inscripcion', []).append(
                {'codigo': cod, 'canal': c.get('name'), 'canal_id': str(c['id']),
                 'categoria_id': str(c.get('parent_id') or ''), 'creada': hoy})
            hechas += 1
            print('         ✅ https://discord.gg/%s' % cod)
    if hechas:
        d['_invitaciones_inscripcion_leeme'] = (
            'invitaciones_inscripcion: las invitaciones permanentes que creó el bot a cada canal de inscripciones '
            '(o, sin ninguno, al de eventos donde se anota), para el botón «Inscribite ya» (Dlx, 03/10/2026: «1. a»). '
            'El botón elige la de la misma categoría que el anuncio: ver invitacionPara() de bot/avisos.js.')
        _guardar(SERVIDORES, d)
        print('\n   ✅ %d invitación(es) nueva(s) en datos/servidores.json' % hechas)
    return hechas


def contar(aplicar=False):
    """`{sv: {codigo, usos}}`, y lo guarda si cambió. `usos` None = sin permiso."""
    s = _sesion()
    antes = _json(CUENTA, {}).get('servidores') or {}
    out, avisos = {}, []
    for sv, x in servidores_del_bot():
        cod = (x.get('invitacion_liga') or {}).get('codigo')
        if not cod:
            continue
        r = s.get('%s/guilds/%s/invites' % (API, x['guild_id']), timeout=30)
        if r.status_code in (401, 403):
            out[sv] = {'codigo': cod, 'usos': None, 'por_que': 'el bot no puede ver sus invitaciones'}
            continue
        if not r.ok:
            print('   %-5s ⚠️ Discord dijo %d: queda lo de antes' % (sv, r.status_code))
            if sv in antes:
                out[sv] = antes[sv]
            continue
        inv = {i.get('code'): i for i in r.json() or []}
        if cod not in inv:
            out[sv] = {'codigo': cod, 'usos': (antes.get(sv) or {}).get('usos'),
                       'por_que': 'la invitación ya no existe'}
            avisos.append('%s: la invitación de la Liga (%s) ya no existe' % (sv, cod))
            continue
        out[sv] = {'codigo': cod, 'usos': int(inv[cod].get('uses') or 0)}
    for sv, v in sorted(out.items()):
        print('   %-5s %s  %s' % (sv, v['codigo'],
                                  '%d entraron por la Liga' % v['usos'] if v.get('usos') is not None
                                  else '— (%s)' % v.get('por_que')))
    for a in avisos:
        print('   🔴 %s' % a)
    if aplicar and out != antes:
        _guardar(CUENTA, {'_leeme': 'Cuántos entraron a cada servidor por la invitación permanente '
                                    'de la Liga (`uses` de Discord). Lo escribe bot/invitaciones.py '
                                    '--contar en cada corrida, sólo si cambió. usos null = el bot no '
                                    'puede ver las invitaciones de ese servidor (falta «Gestionar '
                                    'servidor»). Dlx, 29/09/2026.',
                          'servidores': out})
        print('   ✅ datos/invitaciones.json')
    return out


def _self_check():
    print('\n══ LAS INVITACIONES DE LA LIGA ══\n')
    mal = 0

    def ok(que, cond, det=''):
        nonlocal mal
        print('   %s %s%s' % ('✅' if cond else '🔴', que, ('  ' + str(det)) if det else ''))
        mal += 0 if cond else 1
    g = {'id': '1', 'rules_channel_id': '11', 'system_channel_id': '12'}
    oculto = [{'id': '1', 'deny': str(VER), 'allow': '0'}]
    chs = [{'id': '10', 'type': 0, 'name': '「😇」𝐁𝐈𝐄𝐍𝐕𝐄𝐍𝐈𝐃𝐀👋', 'position': 3},
           {'id': '11', 'type': 0, 'name': 'reglas', 'position': 1},
           {'id': '12', 'type': 0, 'name': 'chat', 'position': 2},
           {'id': '13', 'type': 4, 'name': 'bienvenida (categoría)', 'position': 0}]
    ok('elige el de bienvenida, aunque venga en letra de fantasía',
       (elegir_canal(g, chs, VER) or {}).get('id') == '10')
    chs[0]['permission_overwrites'] = oculto
    ok('pero no si @everyone no lo ve: cae en el de reglas',
       (elegir_canal(g, chs, VER) or {}).get('id') == '11')
    ok('y el admin ve todo', la_ve_todos(chs[0], '1', ADMIN))
    ok('sin ningún canal visible, ninguno',
       elegir_canal(g, [dict(c, permission_overwrites=oculto) for c in chs], VER) is None)
    ok('la invitación de cada servidor del bot es la de la Liga (servidores.json)',
       all((x.get('invitacion_liga') or {}).get('codigo') and
           x.get('invitacion', '').endswith(x['invitacion_liga']['codigo'])
           for _sv, x in servidores_del_bot()) or not any(
           x.get('invitacion_liga') for _sv, x in servidores_del_bot()),
       ', '.join(sv for sv, x in servidores_del_bot() if not x.get('invitacion_liga')) or '')
    # «Inscribite ya»: los canales de inscripciones que ve @everyone; sin ninguno, el de eventos con anuncios
    ci = [{'id': '20', 'type': 4, 'name': '𝐒𝐓𝐀𝐅𝐅'}, {'id': '21', 'type': 0, 'name': '《📑》𝙄𝙣𝙨𝙘𝙧𝙞𝙥𝙘𝙞𝙤𝙣𝙚𝙨', 'parent_id': '30'},
          {'id': '22', 'type': 0, 'name': 'inscripciones-staff', 'parent_id': '30'},
          {'id': '23', 'type': 0, 'name': 'inscripciones', 'parent_id': '20'},
          {'id': '24', 'type': 0, 'name': '〢⭐〉competenciasMIx', 'parent_id': '31'}]
    ok('«Inscribite ya»: el de inscripciones en letra de fantasía, no los de staff',
       [c['id'] for c in canales_inscripcion(ci, '1', VER)] == ['21'])
    ok('ni uno de una categoría que el servidor declara afuera',
       canales_inscripcion(ci, '1', VER, fuera=['30'], anunciados=['24'])[0]['id'] == '24')
    ok('sin canal de inscripciones, el de eventos donde anunció (DRA)',
       [c['id'] for c in canales_inscripcion(ci[:1] + ci[3:], '1', VER, anunciados=['24'])] == ['24'])
    print('\n   %s\n' % ('todo ok' if not mal else '🔴 %d mal' % mal))
    return 1 if mal else 0


def main():
    if '--auto' in sys.argv:
        return _self_check()
    aplicar = '--aplicar' in sys.argv
    if '--contar' in sys.argv:
        print('\n══ ¿CUÁNTOS ENTRARON POR LA LIGA? ══\n')
        contar(aplicar)
        return 0
    if '--inscripciones' in sys.argv:
        print('\n══ «INSCRIBITE YA»: LAS INVITACIONES A LOS CANALES DE INSCRIPCIONES%s ══\n'
              % ('' if aplicar and '--crear' in sys.argv else ' (en seco)'))
        crear_inscripcion(aplicar and '--crear' in sys.argv)
        return 0
    print('\n══ LAS INVITACIONES DE LA LIGA%s ══\n' % ('' if aplicar and '--crear' in sys.argv
                                                     else ' (en seco)'))
    crear(aplicar and '--crear' in sys.argv)
    return 0


if __name__ == '__main__':
    sys.exit(main())
