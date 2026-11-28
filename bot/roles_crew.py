# -*- coding: utf-8 -*-
"""👥 TU CREW = TU ROL EN DRA (28/11/2026, paso 9 del plan del sábado), DETRÁS DE UNA BANDERA.

    python bot/roles_crew.py            qué cambiaría (sólo lee Discord)
    python bot/roles_crew.py --ciclo    desde el ciclo (paso 2b4b2), con el tope de bot/roles_pase.py
    python bot/roles_crew.py --aplicar  a mano, sin tope
    python bot/roles_crew.py --auto     el self-check, sin red

LO MEDIDO EL 28/11/2026 (`datos/crews_vivas.json` y `datos/crews_tiers.json`): **7 crews y 29 personas**, las 29 con
Discord ID en el padrón. Por tier: Follombia (11) en **Diamante**, KS (2) en Oro, Desierto de Atacama (3) en Plata,
METRICOS (4) en Bronce, y VENECOMAFIA, YOUNG PROSPECTS y Rap tico (3 cada una) sin tier todavía. En DRA no hay ningún
rol de crew de la gente: el único con «Crew» en el nombre es 𝐂𝐫𝐞𝐰 𝐔𝐋, que es del staff.

LA RECOMENDACIÓN (espera a Dlx): UN ROL SÓLO PARA LAS CREWS EN DIAMANTE O MÁS (`MIN_TIER`), que es donde ya se
desbloquea la tarjeta de crew (`TARJETA` de bot/crews_tiers.py). Hoy sería 1 rol para 11 personas. Un rol por cada
crew serían 7 hoy y hasta las que se armen (20 personas máx. cada una): la lista de roles de DRA ya tiene 134, y una
crew de 2 con rol propio no dice nada. Y que el rol se GANE (subir a Diamante) lo hace premio, no trámite.

LAS REGLAS, las mismas del Pase (el motor es `bot/roles_pase.py`):
  · una crew por persona, así que un rol de crew por persona; sólo Miembros de DRA;
  · el bot sólo toca los roles de `ROLES`; si la crew baja de `MIN_TIER`, sus miembros lo pierden;
  · ⚠️ EL NOMBRE NO DICE «Crew» (lo arma `herramientas/crear_roles_liga.py --crew`): «𝐂𝐫𝐞𝐰 𝐔𝐋» es el staff, y
    «𝐂𝐫𝐞𝐰 𝐅𝐨𝐥𝐥𝐨𝐦𝐛𝐢𝐚» se leería como otro staff. Va «◢◤👥◥◣ 𝐅𝐨𝐥𝐥𝐨𝐦𝐛𝐢𝐚 ◢◤👥◥◣», sin color.
  · apagado mientras `ENCENDIDO` sea `False`.
  · El motivo en el registro de auditoría: «Liga Global: crew».
"""
import io
import json
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(AQUI)
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.join(BASE, 'sheet'))
import roles_pase as RP  # noqa: E402

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

# ═══ ✏️ LA BANDERA Y LA TABLA: `{id de la crew: id del rol en DRA}` ══════════════════════════════════════════════════
ENCENDIDO = False
#: desde qué tier de crew hay rol: 4 = Diamante (`crews_tiers.TIERS`)
MIN_TIER = 4
ROLES = {}
RAZON = 'Liga Global: crew'


def leer():
    """`(crews, tiers)` de `datos/`: las crews de la gente (sin Discord IDs) y el tier de cada una."""
    with io.open(os.path.join(BASE, 'datos', 'crews_vivas.json'), encoding='utf-8') as f:
        crews = json.load(f).get('crews') or []
    try:
        with io.open(os.path.join(BASE, 'datos', 'crews_tiers.json'), encoding='utf-8') as f:
            tiers = json.load(f).get('tier') or {}
    except (OSError, ValueError):
        tiers = {}
    return crews, tiers


def con_rol(crews, tiers, min_tier=MIN_TIER):
    """Las crews que llevan rol: tier `min_tier` o más."""
    return [c for c in crews if isinstance(tiers.get(c.get('id')), int) and tiers[c['id']] >= min_tier]


def deberia_crew(crews, tiers, roles, id_de, ms, min_tier=MIN_TIER):
    """`{discord_id: rol}`: los Miembros de DRA de las crews con rol. `id_de(clave)` da el Discord ID de un perfil."""
    out = {}
    for c in con_rol(crews, tiers, min_tier):
        rid = str(roles.get(c['id']) or '')
        if not rid:
            continue
        for g in c.get('gente') or []:
            did = id_de(g[0])
            m = ms.get(str(did or ''))
            if m and RP.ROL_MIEMBRO in (m.get('roles') or []):
                out[str(did)] = rid
    return out


def id_por_clave():
    """`clave -> discord_id` por el padrón (el mismo `norm()` que usan las cartas)."""
    import construir_padron as PAD
    idx = PAD.por_nombre()
    return lambda k: (idx.get(PAD.norm(k)) or {}).get('discord_id') or ''


def medir():
    """Los números de hoy, sin red: cuántas crews, cuánta gente, por tier, y cuántas llevarían rol."""
    import crews_tiers as CT
    crews, tiers = leer()
    print('   %d crews · %d personas' % (len(crews), sum(len(c.get('gente') or []) for c in crews)))
    for c in sorted(crews, key=lambda c: -len(c.get('gente') or [])):
        t = tiers.get(c['id'])
        print('     %-24s %2d  %s' % (c.get('nombre', c['id'])[:24], len(c.get('gente') or []),
                                    CT.TIERS[t][0] if isinstance(t, int) and 0 <= t < len(CT.TIERS) else 'sin tier'))
    cr = con_rol(crews, tiers)
    print('   con rol (%s o más): %d crews, %d personas' % (CT.TIERS[MIN_TIER][0], len(cr),
                                                           sum(len(c.get('gente') or []) for c in cr)))
    return cr


def main():
    if '--auto' in sys.argv:
        return 1 if _self_check() else 0
    cr = medir()
    if not ENCENDIDO:
        print('   ⏸️ roles de crew apagados (`ENCENDIDO` en bot/roles_crew.py)')
        return 0
    faltan = [c['id'] for c in cr if not str(ROLES.get(c['id']) or '').isdigit()]
    if faltan:
        print('   ⚠️ crews con rol que todavía no lo tienen creado: %s (`herramientas/crear_roles_liga.py --crew --aplicar`)'
              % ', '.join(faltan))
    ciclo = '--ciclo' in sys.argv
    crews, tiers = leer()
    s = RP.sesion()
    try:
        ms = RP.miembros_dra(s)
    except RuntimeError as e:
        print('   ⚠️ %s: no toco nada' % e)
        return 0
    RP.correr('roles_crew', deberia_crew(crews, tiers, ROLES, id_por_clave(), ms), list(ROLES.values()), RAZON, ciclo,
              ciclo or '--aplicar' in sys.argv, s=s, ms=ms)
    return 0


def _self_check():
    mal = 0

    def ok(c, que):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', que))

    print('\n  roles_crew.py — un rol por crew de Diamante o más, sin red\n')
    import crews_tiers as CT
    ok(CT.TIERS[MIN_TIER][0] == 'Diamante' and MIN_TIER == CT.TARJETA, 'el rol arranca en Diamante, donde se abre la tarjeta')
    M = RP.ROL_MIEMBRO
    crews = [{'id': 'A', 'gente': [['ana', 'lider', 0], ['beto', 'miembro', 0]]},
             {'id': 'B', 'gente': [['caro', 'lider', 0]]}, {'id': 'C', 'gente': [['dani', 'lider', 0]]}]
    tiers = {'A': 4, 'B': 3, 'C': 5}
    ids = {'ana': '1', 'beto': '2', 'caro': '3', 'dani': '4'}
    ms = {'1': {'roles': [M]}, '2': {'roles': []}, '3': {'roles': [M, '30']}, '4': {'roles': [M]}}
    ok([c['id'] for c in con_rol(crews, tiers)] == ['A', 'C'], 'llevan rol las de Diamante o más (B es Platino)')
    deb = deberia_crew(crews, tiers, {'A': '10', 'B': '30', 'C': ''}, ids.get, ms)
    ok(deb == {'1': '10'}, 'sólo Miembros, sólo crews con rol creado (C todavía no tiene): %s' % deb)
    p = {c['id']: c for c in RP.plan(deb, ['10', '30'], ms)}
    ok(p.get('3') == {'id': '3', 'poner': '', 'sacar': ['30']}, 'la crew bajó de Diamante: sus miembros pierden el rol')
    ok(p.get('1') == {'id': '1', 'poner': '10', 'sacar': []} and '2' not in p, 'el Miembro lo recibe; quien no es Miembro, no')
    ok(not ENCENDIDO or ROLES, 'encendido sólo con la tabla puesta')
    print('\n  %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal


if __name__ == '__main__':
    sys.exit(main())
