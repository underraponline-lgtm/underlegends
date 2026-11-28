# -*- coding: utf-8 -*-
"""🔒 ¿Alguien que NO es nuestro bot dio el rol Miembro de DRA a una persona nueva?

Dlx, 28/11/2026: *«apaga lo de los 21 días, que verifiquen con el panel»*. Hasta ese día Sapphire («Join Roles») y
Carl-bot («Temp role») daban Miembro —o sea, la verificación— exactamente 21 días después de entrar, tuviera país o no:
el portón se abría solo. Eso se apaga en los paneles de esos bots, que la API de Discord no deja tocar, así que lo único
que se puede hacer desde acá es **preguntar si sigue pasando**. Lee el registro de auditoría de DRA y cuenta los Miembro
puestos por otros bots desde `DESDE`.

⚠️ NO CUENTA lo que sí vale: ULAYA (el panel de #verificate-aqui y la página), las personas (un admin a mano) y los
«devolver al que vuelve» —Role Persist de Utili, Sticky roles de Carl-bot—: le devuelven el Miembro a quien ya lo tenía.

    python herramientas/miembro_automatico.py          el informe; sale con 1 si alguno sigue dándolo
    python herramientas/miembro_automatico.py --auto   el self-check, sin red
"""
import datetime
import io
import os
import sys

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
GUILD = '841017460341604382'
MIEMBRO = '1101257512273055745'
ULAYA = '1550026808404217926'
#: desde cuándo tiene que estar apagado (28/11/2026, 12:15 PM ET: Dlx «creo que ya debería estar»)
DESDE = datetime.datetime(2026, 11, 28, 17, 15, tzinfo=datetime.timezone.utc)
#: los motivos de «devolverle lo que tenía», que no son verificaciones nuevas
DEVOLVER = ('role persist', 'sticky')


def _token():
    t = os.environ.get('DISCORD_TOKEN') or ''
    if t:
        return t.strip()
    try:
        with io.open(os.path.join(BASE, '.env'), encoding='utf-8') as f:
            for l in f:
                if l.strip().startswith('DISCORD_TOKEN'):
                    return l.split('=', 1)[1].strip().strip('"\'')
    except OSError:
        pass
    return ''


def cuando(snowflake):
    return datetime.datetime.fromtimestamp(((int(snowflake) >> 22) + 1420070400000) / 1000, datetime.timezone.utc)


def sospechosas(entradas, bots, desde=DESDE):
    """De las entradas del registro (tipo 25), las que dieron Miembro siendo otro bot, después de `desde` y sin ser un
    «devolver». `bots` es el conjunto de ids de usuario que son bots. Devuelve `[(quien_dio, motivo, cuando)]`."""
    out = []
    for e in entradas:
        quien = str(e.get('user_id') or '')
        if quien == ULAYA or quien not in bots:
            continue
        motivo = (e.get('reason') or '').lower()
        if any(k in motivo for k in DEVOLVER):
            continue
        t = cuando(e['id'])
        if t < desde:
            continue
        for ch in e.get('changes') or ():
            if ch.get('key') == '$add' and any(str(r.get('id')) == MIEMBRO for r in ch.get('new_value') or ()):
                out.append((quien, e.get('reason') or '', t))
    return out


def leer(paginas=20):
    import requests
    t = _token()
    if not t:
        raise RuntimeError('falta DISCORD_TOKEN')
    h = {'Authorization': 'Bot ' + t}
    entradas, bots, nombres, antes = [], set(), {}, None
    for _ in range(paginas):
        url = 'https://discord.com/api/v10/guilds/%s/audit-logs?action_type=25&limit=100' % GUILD
        d = requests.get(url + ('&before=' + antes if antes else ''), headers=h, timeout=30).json()
        es = d.get('audit_log_entries') or []
        for u in d.get('users') or ():
            nombres[u['id']] = u.get('username')
            if u.get('bot'):
                bots.add(u['id'])
        entradas += es
        if not es or cuando(es[-1]['id']) < DESDE:
            break
        antes = es[-1]['id']
    return entradas, bots, nombres


def _auto():
    def sf(t):
        return str((int(t.timestamp() * 1000) - 1420070400000) << 22)
    luego = DESDE + datetime.timedelta(hours=1)
    antes = DESDE - datetime.timedelta(hours=1)
    dar = {'key': '$add', 'new_value': [{'id': MIEMBRO}]}
    es = [
        {'id': sf(luego), 'user_id': 'saph', 'reason': 'Join Roles', 'changes': [dar]},           # ❌ sigue
        {'id': sf(antes), 'user_id': 'carl', 'reason': 'Temp role', 'changes': [dar]},            # antes de apagar
        {'id': sf(luego), 'user_id': ULAYA, 'reason': 'Liga Global', 'changes': [dar]},           # nuestro panel
        {'id': sf(luego), 'user_id': 'utili', 'reason': 'Role Persist', 'changes': [dar]},        # devolver
        {'id': sf(luego), 'user_id': 'carl', 'reason': 'Added Roles from AutoRoles/MuteRoles/StickyRoles', 'changes': [dar]},
        {'id': sf(luego), 'user_id': 'dlx', 'reason': '', 'changes': [dar]},                     # una persona
        {'id': sf(luego), 'user_id': 'carl', 'reason': 'Temp role', 'changes': [{'key': '$add', 'new_value': [{'id': '9'}]}]},
    ]
    s = sospechosas(es, {'saph', 'carl', 'utili', ULAYA})
    assert [x[0] for x in s] == ['saph'], s
    print('✅ cuenta sólo a otro bot dándolo después de apagar; no a ULAYA, ni devolver, ni a una persona')


if __name__ == '__main__':
    if '--auto' in sys.argv:
        _auto()
        sys.exit(0)
    es, bots, nombres = leer()
    s = sospechosas(es, bots)
    print('🔒 Miembro puesto por otros bots desde el', DESDE.strftime('%d/%m %H:%M UTC') + ':', len(s))
    for quien, motivo, t in s[:20]:
        print('   🔴', nombres.get(quien, quien), '·', motivo or '(sin motivo)', '·', t.strftime('%d/%m %H:%M UTC'))
    if s:
        print('   ↳ sigue prendido: apagar el Miembro automático en el panel de ese bot (Join Roles / Temp role)')
    sys.exit(1 if s else 0)
