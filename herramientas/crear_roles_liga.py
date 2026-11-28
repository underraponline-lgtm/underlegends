# -*- coding: utf-8 -*-
"""🛠️ CREAR LOS ROLES DEL PASE (Y, CUANDO TOQUE, LOS DE CREW) EN DRA (28/11/2026, paso 9). SIN `--aplicar` NO CREA NADA.

    python herramientas/crear_roles_liga.py --pase              qué crearía, dónde y cómo quedaría el orden (sólo lee)
    python herramientas/crear_roles_liga.py --pase --aplicar    crea los que faltan, los ordena y escribe datos/roles_pase.json
    python herramientas/crear_roles_liga.py --crew [--aplicar]  lo mismo con las crews de Diamante o más (hoy, apagado:
                                                                Dlx, 28/11: «de momento no»)
    python herramientas/crear_roles_liga.py --auto              el self-check, sin red

🔑 DLX, 28/11/2026: «Crea 50 roles por el pase». Un rol por nivel, «◢◤🎟️◥◣ 𝐏𝐚𝐬𝐞 𝟏𝟕 ◢◤🎟️◥◣» (`roles_pase.nombre_nivel()`).
⚠️ CREAR UN ROL LO VE TODO EL SERVIDOR Y NO HAY «DESHACER» (lo mismo que `roles_rango.py --crear`).

LO QUE HACE CON `--aplicar`, EN ORDEN:
  1. LOS QUE YA EXISTEN NO SE VUELVEN A CREAR: se buscan normalizando con NFKD (`plano()`), porque «𝐏𝐚𝐬𝐞 𝟏𝟕» y
     «Pase 17» son el mismo para nosotros y distintos para `==`. Correrlo dos veces no duplica nada.
  2. EL TOPE: Discord deja 250 roles por servidor. Si con los nuevos se pasa de `TOPE_ROLES` (240), NO CREA NINGUNO:
     media escalera de roles sería peor que ninguna.
  3. SIN COLOR, SIN PERMISOS, SIN SEPARAR EN LA LISTA Y SIN MENCIÓN: el color del nombre sigue siendo el del rango.
  4. EL ORDEN, EN UN SOLO PEDIDO: juntos, justo debajo de los roles del Pase que ya existen (║🎟️Pase Premium 🎟️║ y
     ║🎟️Pase T 🎟️║), del 50 arriba al 1 abajo. Se arma el orden entero y se mandan sólo los que se mueven
     (`posiciones()`); si alguno estuviera arriba del rol del bot —que no lo puede mover—, no se manda nada y lo dice.
  5. LOS IDS A `datos/roles_pase.json` (`roles_pase.guardar_tabla()`): nada que pegar a mano. Ese archivo hay que
     commitearlo para que el ciclo lo vea.
"""
import os
import sys
import time
import unicodedata

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, os.path.join(BASE, 'bot'))
sys.path.insert(0, os.path.join(BASE, 'sheet'))
sys.path.insert(0, SCR)
import roles_pase as RP  # noqa: E402

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

API = 'https://discord.com/api/v10'
GUILD = RP.GUILD_DRA
TOPE_ROLES = 240
EMOJI_CREW = '👥'
RAZON = 'Liga Global: roles del Pase'


def plano(s):
    """Sin adornos ni negrita (NFKD): lo mismo que `roles_rango.plano()`."""
    s = unicodedata.normalize('NFKD', s or '')
    return ''.join(c for c in s if c.isalnum() or c.isspace()).upper().strip()


def que_crear(roles, quiero):
    """`quiero`: `[(clave, nombre)]`. Devuelve `[(clave, nombre, id existente o '')]`."""
    por = {plano(r['name']): r['id'] for r in roles}
    return [(k, n, por.get(plano(n), '')) for k, n in quiero]


def ancla(roles):
    """Debajo de qué rol van: el más bajo de los del Pase que ya están (no nuestros). `None` si no hay ninguno."""
    nuestros = {plano(RP.nombre_nivel(n)) for n in range(1, RP.NIVELES + 1)}
    pase = [r for r in roles if 'PASE' in plano(r['name']).split() and plano(r['name']) not in nuestros]
    return min(pase, key=lambda r: (r['position'], int(r['id']))) if pase else None


def posiciones(roles, nuevos_desc, ancla_id):
    """El orden entero con `nuevos_desc` (del 50 al 1) justo debajo de `ancla_id`: `[{id, position}]` de los que cambian.
    @everyone (posición 0) no se toca. Arriba gana el número más alto, como en Discord."""
    nuevos = [str(x) for x in nuevos_desc]
    resto = sorted((r for r in roles if r['position'] > 0 and str(r['id']) not in nuevos),
                   key=lambda r: (-r['position'], -int(r['id'])))
    orden = []
    for r in resto:
        orden.append(str(r['id']))
        if str(r['id']) == str(ancla_id):
            orden.extend(nuevos)
    if str(ancla_id) not in orden:
        orden.extend(nuevos)
    actual = {str(r['id']): r['position'] for r in roles}
    total = len(orden)
    return [{'id': rid, 'position': total - i} for i, rid in enumerate(orden) if actual.get(rid) != total - i]


def pedidos_pase():
    return [(str(n), RP.nombre_nivel(n)) for n in range(1, RP.NIVELES + 1)]


def pedidos_crew():
    import roles_crew as RC
    crews, tiers = RC.leer()
    return [(c['id'], '◢◤%s◥◣ %s ◢◤%s◥◣' % (EMOJI_CREW, RP.negrita(c.get('nombre') or c['id']), EMOJI_CREW))
            for c in RC.con_rol(crews, tiers)]


def _pedir(s, metodo, url, **kw):
    for _ in range(6):
        r = s.request(metodo, url, timeout=30, **kw)
        if r.status_code != 429:
            return r
        try:
            espera = float(r.json().get('retry_after', 1))
        except Exception:                                 # noqa: BLE001
            espera = 1.0
        time.sleep(min(espera, 30) + 0.3)
    return r


def main():
    if '--auto' in sys.argv:
        return 1 if _self_check() else 0
    pase = '--pase' in sys.argv
    if not pase and '--crew' not in sys.argv:
        print(__doc__)
        return 0
    aplicar = '--aplicar' in sys.argv
    quiero = pedidos_pase() if pase else pedidos_crew()
    import requests
    import fotos as F
    s = requests.Session()
    s.headers['Authorization'] = 'Bot ' + F.env('DISCORD_TOKEN')
    roles = _pedir(s, 'GET', '%s/guilds/%s/roles' % (API, GUILD)).json()
    plan = que_crear(roles, quiero)
    faltan = [x for x in plan if not x[2]]
    a = ancla(roles)
    print('\n  DRA tiene %d roles · se crearían %d · quedarían %d (tope nuestro %d, el de Discord 250)'
          % (len(roles), len(faltan), len(roles) + len(faltan), TOPE_ROLES))
    print('  van debajo de: %s (posición %s)\n' % (a['name'] if a else '— (al fondo)', a['position'] if a else '—'))
    for k, n, ya in plan[:3] + ([('…', '', '')] if len(plan) > 6 else []) + plan[-3:]:
        if k == '…':
            print('   …')
            continue
        print('   %-10s %-30s %s' % (k, n, 'ya existe: ' + ya if ya else ('se crea' if aplicar else 'se crearía')))
    if len(roles) + len(faltan) > TOPE_ROLES:
        print('\n  🔴 pasaría de %d roles: no creo ninguno' % TOPE_ROLES)
        return 1
    if not aplicar:
        print('\n  (no creé nada: --aplicar los crea, con el OK de Dlx)\n')
        return 0
    ids = {k: ya for k, _n, ya in plan if ya}
    for k, n, ya in faltan:
        r = _pedir(s, 'POST', '%s/guilds/%s/roles' % (API, GUILD), headers={'X-Audit-Log-Reason': RAZON},
                   json={'name': n, 'color': 0, 'hoist': False, 'mentionable': False, 'permissions': '0'})
        if not r.ok:
            print('   ❌ %s: %d %s' % (k, r.status_code, r.text[:110]))
            continue
        ids[k] = str(r.json()['id'])
        time.sleep(0.4)
    print('\n  ✅ %d creados · %d ya estaban · %d de %d con ID' % (len(ids) - (len(plan) - len(faltan)),
                                                                len(plan) - len(faltan), len(ids), len(plan)))
    # el orden, en un solo pedido
    roles = _pedir(s, 'GET', '%s/guilds/%s/roles' % (API, GUILD)).json()
    a = ancla(roles)
    desc = [ids[k] for k, _n, _y in reversed(plan) if k in ids]
    cambios = posiciones(roles, desc, a['id'] if a else '')
    me = _pedir(s, 'GET', '%s/users/@me' % API).json()
    yo = _pedir(s, 'GET', '%s/guilds/%s/members/%s' % (API, GUILD, me['id'])).json()
    pos = {str(r['id']): r['position'] for r in roles}
    techo = max((pos.get(str(x), 0) for x in yo.get('roles') or []), default=0)
    arriba = [c for c in cambios if pos.get(c['id'], 0) >= techo or c['position'] >= techo]
    if arriba:
        print('  ⚠️ %d rol(es) del orden quedan arriba del rol del bot: no muevo nada, se ordenan a mano' % len(arriba))
    elif cambios:
        r = _pedir(s, 'PATCH', '%s/guilds/%s/roles' % (API, GUILD), headers={'X-Audit-Log-Reason': RAZON}, json=cambios)
        print('  %s orden: %d roles movidos en un pedido' % ('✅' if r.ok else '❌ %d' % r.status_code, len(cambios)))
    if pase:
        RP.guardar_tabla({int(k): v for k, v in ids.items()})
        print('  📝 datos/roles_pase.json: %d de %d (commitearlo para que el ciclo lo vea)' % (len(ids), RP.NIVELES))
    else:
        print('  para pegar en ROLES de bot/roles_crew.py:')
        for k, v in ids.items():
            print("     %r: '%s'," % (k, v))
    return 0


def _self_check():
    mal = 0

    def ok(c, que):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', que))

    print('\n  crear_roles_liga.py — sin red\n')
    ok(plano('◢◤🎟️◥◣ 𝐏𝐚𝐬𝐞 𝟏𝟕 ◢◤🎟️◥◣') == 'PASE 17', 'se busca normalizado (NFKD)')
    roles = [{'id': '7', 'name': RP.nombre_nivel(10), 'position': 5}, {'id': '8', 'name': 'otra cosa', 'position': 4}]
    ok(que_crear(roles, [('10', RP.nombre_nivel(10)), ('20', RP.nombre_nivel(20))]) ==
       [('10', RP.nombre_nivel(10), '7'), ('20', RP.nombre_nivel(20), '')], 'el que ya existe se usa; el otro se crea')
    ok([k for k, _ in pedidos_pase()] == [str(n) for n in range(1, 51)], 'los 50 niveles')
    # el orden: DRA de mentira con los dos del Pase y tres nuevos creados al fondo
    R = [{'id': '0', 'name': '@everyone', 'position': 0}, {'id': '900', 'name': 'Dueño', 'position': 9},
         {'id': '800', 'name': 'Bots', 'position': 8}, {'id': '700', 'name': '║🎟️Pase Premium 🎟️║', 'position': 7},
         {'id': '600', 'name': '║🎟️Pase T 🎟️║', 'position': 6}, {'id': '500', 'name': 'Orgas', 'position': 5},
         {'id': '400', 'name': 'PINGS', 'position': 4},
         {'id': '13', 'name': RP.nombre_nivel(3), 'position': 3}, {'id': '12', 'name': RP.nombre_nivel(2), 'position': 2},
         {'id': '11', 'name': RP.nombre_nivel(1), 'position': 1}]
    a = ancla(R)
    ok(a and a['id'] == '600', 'van debajo del más bajo de los del Pase que ya existen (Pase T), no de los nuestros')
    c = posiciones(R, ['13', '12', '11'], '600')
    fin = {r['id']: r['position'] for r in R}
    fin.update({x['id']: x['position'] for x in c})
    orden = [k for k, _ in sorted(fin.items(), key=lambda x: -x[1]) if k != '0']
    ok(orden == ['900', '800', '700', '600', '13', '12', '11', '500', '400'], 'del 3 arriba al 1 abajo, justo debajo: %s' % orden)
    ok({x['id'] for x in c} == {'13', '12', '11', '500', '400'} and all(x['id'] not in ('900', '800', '700', '600') for x in c),
       'en un pedido, sólo los que se mueven (nada de lo de arriba)')
    ok(posiciones([{'id': k, 'name': '', 'position': v} for k, v in fin.items()], ['13', '12', '11'], '600') == [],
       'correrlo otra vez no mueve nada')
    ok(all('CREW' not in plano(n) for _, n in pedidos_crew()), 'el rol de una crew no dice «Crew» (𝐂𝐫𝐞𝐰 𝐔𝐋 es el staff)')
    print('\n  %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal


if __name__ == '__main__':
    sys.exit(main())
