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
import sys
import unicodedata
import urllib.parse

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
    print('\n══ LAS INVITACIONES DE LA LIGA%s ══\n' % ('' if aplicar and '--crear' in sys.argv
                                                     else ' (en seco)'))
    crear(aplicar and '--crear' in sys.argv)
    return 0


if __name__ == '__main__':
    sys.exit(main())
