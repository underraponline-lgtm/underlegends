# -*- coding: utf-8 -*-
"""🎟️ LOS ROLES DE DRA POR NIVEL DEL PASE (28/11/2026, paso 9 del plan del sábado). Y el motor que comparten con los de
crew (`bot/roles_crew.py`).

    python bot/roles_pase.py            qué cambiaría (sólo lee Discord)
    python bot/roles_pase.py --ciclo    desde el ciclo (paso 2b4b2): sólo DRA, con tope de cambios por vuelta
    python bot/roles_pase.py --aplicar  a mano, sin tope (la primera vez, o al cambiar de temporada)
    python bot/roles_pase.py --auto     el self-check, sin red

🔑 DLX, 28/11/2026: «Crea 50 roles por el pase». UN ROL POR NIVEL, del 1 al 50 (`pase.NIVELES`), y cada uno lleva SÓLO
el de su nivel de hoy: subir es cambiar uno por otro (se saca el viejo y se pone el nuevo). Se llaman como los demás de
DRA, en negrita matemática: «◢◤🎟️◥◣ 𝐏𝐚𝐬𝐞 𝟏𝟕 ◢◤🎟️◥◣» (`nombre_nivel()`; los números van en U+1D7CE…).

LOS IDS NO SE ESCRIBEN A MANO: los crea `herramientas/crear_roles_liga.py --pase --aplicar` (con el OK de Dlx) y los
deja en `datos/roles_pase.json`, que es lo que lee esto (`tabla()`). Con uno solo de los 50 faltando, no corre: a esa
gente le faltaría su rol y no hay uno «de abajo» que sea el suyo.

Medido el 28/11/2026 sobre `datos/pase_niveles.json` y DRA: 253 Miembros con nivel 1 o más (156 en 1–9, 69 en 10–19,
23 en 20–29, 4 en 30–49 y 1 en 50). O sea que LA PRIMERA SINCRONIZACIÓN SON 253 CAMBIOS: más que el tope del ciclo, así
que va a mano con `--aplicar` (unos 2 minutos, con el freno de Discord). Después, una vuelta mueve sólo a quien subió.

LAS REGLAS:
  · UN SOLO ROL POR PERSONA, el de su nivel: no se acumulan.
  · SÓLO MIEMBROS DE DRA (verificados, `verificados.ROL_MIEMBRO`): quien deja de serlo pierde el suyo.
  · EL BOT SÓLO TOCA SUS PROPIOS ROLES: los 50 de la tabla. Nunca otro rol de nadie.
  · SIN COLOR NI PERMISOS (los crea así la herramienta): el color del nombre sigue siendo el del RANGO. Van juntos,
    justo debajo de los del Pase que ya existen (║🎟️Pase Premium 🎟️║ y ║🎟️Pase T 🎟️║), del 50 arriba al 1 abajo.
  · AL CAMBIAR DE TEMPORADA los niveles vuelven a 0 y todos pierden el suyo: cientos de cambios, más que el tope, así
    que el ciclo no los hace solo y lo dice. Se corre a mano con `--aplicar`.
  · El motivo en el registro de auditoría: «Liga Global: nivel del Pase».
"""
import io
import json
import os
import sys
import time

AQUI = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(AQUI)
sys.path.insert(0, AQUI)

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

API = 'https://discord.com/api/v10'
GUILD_DRA = '841017460341604382'
ROL_MIEMBRO = '1101257512273055745'     # = verificados.ROL_MIEMBRO (el self-check lo compara)
RAZON = 'Liga Global: nivel del Pase'
#: cuántos cambios hace sola una vuelta del ciclo; más es raro (la primera vez, otra temporada): eso va a mano
TOPE_CICLO = 40
#: cuántos niveles tiene el Pase (= `pase.NIVELES`; el self-check lo compara)
NIVELES = 50
#: dónde viven los IDs: lo escribe `herramientas/crear_roles_liga.py --pase --aplicar`
ARCHIVO = os.path.join(BASE, 'datos', 'roles_pase.json')
EMOJI = '🎟️'


def negrita(t):
    """A la negrita matemática de Discord: letras (U+1D400…) y números (U+1D7CE…); lo demás queda como está."""
    out = []
    for c in t:
        if 'A' <= c <= 'Z':
            out.append(chr(0x1D400 + ord(c) - 65))
        elif 'a' <= c <= 'z':
            out.append(chr(0x1D41A + ord(c) - 97))
        elif '0' <= c <= '9':
            out.append(chr(0x1D7CE + ord(c) - 48))
        else:
            out.append(c)
    return ''.join(out)


def nombre_nivel(n):
    """«◢◤🎟️◥◣ 𝐏𝐚𝐬𝐞 𝟏𝟕 ◢◤🎟️◥◣»: el molde de los roles de DRA."""
    return '◢◤%s◥◣ %s ◢◤%s◥◣' % (EMOJI, negrita('Pase %d' % n), EMOJI)


def tabla(ruta=None):
    """`{nivel: id del rol}` de `datos/roles_pase.json` (vacío si no está)."""
    try:
        with io.open(ruta or ARCHIVO, encoding='utf-8') as f:
            d = json.load(f) or {}
        return {int(k): str(v) for k, v in (d.get('niveles') or {}).items() if str(v).isdigit()}
    except (OSError, ValueError):
        return {}


def guardar_tabla(ids, ruta=None):
    """Escribe `datos/roles_pase.json` con `{nivel: id}` (lo llama la herramienta que los crea)."""
    d = {'_leeme': 'Los 50 roles de DRA por nivel del Pase (Dlx, 28/11/2026: «Crea 50 roles por el pase»): nivel -> ID '
                   'del rol. Lo escribe herramientas/crear_roles_liga.py --pase --aplicar y lo lee bot/roles_pase.py. '
                   'Son IDs de roles, no de personas.',
         'guild': GUILD_DRA, 'niveles': {str(k): str(v) for k, v in sorted(ids.items())}}
    with io.open(ruta or ARCHIVO, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(d, f, ensure_ascii=False, indent=1)
        f.write('\n')


def activo(t):
    """¿Están los 50? Con uno faltando, no corre (ver arriba)."""
    return all(t.get(n) for n in range(1, NIVELES + 1))


def rol_de(nivel, t):
    """El rol del nivel de hoy (los de más del último, el último), o `''` con nivel 0."""
    n = min(int(nivel or 0), NIVELES)
    return str(t.get(n) or '') if n >= 1 else ''


# ═══ el motor, el mismo para los roles de crew ═══════════════════════════════════════════════════════════════════════
def plan(deberia, gestionados, miembros):
    """Qué cambiar: `[{id, poner, sacar}]`. `deberia` es `{discord_id: rol}` (quien no está, ninguno), `gestionados`
    los roles que este sistema reparte, `miembros` `{discord_id: miembro de Discord}`. Sólo mira y toca `gestionados`:
    cualquier otro rol de la persona queda como está."""
    gest = {str(r) for r in gestionados if r}
    out = []
    for did, m in miembros.items():
        tiene = [str(r) for r in (m.get('roles') or []) if str(r) in gest]
        quiere = str(deberia.get(did) or '')
        poner = quiere if quiere and quiere not in tiene else ''
        sacar = [r for r in tiene if r != quiere]
        if poner or sacar:
            out.append({'id': did, 'poner': poner, 'sacar': sacar})
    return out


def _rol(s, metodo, uid, rid, razon):
    """Poner o sacar un rol respetando el 429 (`retry_after`): un 429 no es un error, es «espera»."""
    u = '%s/guilds/%s/members/%s/roles/%s' % (API, GUILD_DRA, uid, rid)
    for _ in range(6):
        r = s.request(metodo, u, timeout=20, headers={'X-Audit-Log-Reason': razon})
        if r.status_code == 429:
            try:
                espera = float(r.json().get('retry_after', 1))
            except Exception:                                 # noqa: BLE001
                espera = 1.0
            time.sleep(min(espera, 30) + 0.3)
            continue
        time.sleep(0.35)
        return r.status_code in (200, 201, 204, 404)
    return False


def miembros_dra(s):
    """`{discord_id: miembro}` de DRA (de a mil, con el cursor por número: ver `roles_rango.miembros()`)."""
    out, after = {}, '0'
    while True:
        r = s.get('%s/guilds/%s/members' % (API, GUILD_DRA), params={'limit': 1000, 'after': after}, timeout=40)
        if r.status_code == 429:
            time.sleep(float(r.json().get('retry_after', 1)) + .3)
            continue
        if r.status_code != 200:
            raise RuntimeError('no pude listar DRA: %s' % r.status_code)
        lote = r.json()
        for m in lote:
            did = (m.get('user') or {}).get('id')
            if did:
                out[did] = m
        if len(lote) < 1000:
            break
        after = max(((m.get('user') or {}).get('id', '0') for m in lote), key=int)
        time.sleep(0.25)
    return out


def aplicar(s, cambios, razon):
    """Hace el plan. Devuelve cuántos salieron enteros."""
    hechos = 0
    for c in cambios:
        bien = all(_rol(s, 'DELETE', c['id'], r, razon) for r in c['sacar'])
        if c['poner']:
            bien = _rol(s, 'PUT', c['id'], c['poner'], razon) and bien
        hechos += 1 if bien else 0
    return hechos


def sesion():
    import requests
    import fotos as F
    s = requests.Session()
    s.headers['Authorization'] = 'Bot ' + F.env('DISCORD_TOKEN')
    return s


def correr(nombre, deberia, gestionados, razon, ciclo, hacer, s=None, ms=None):
    """Lo común de los dos: lista DRA, arma el plan, lo muestra y, si toca, lo hace. Devuelve el plan."""
    s = s or sesion()
    ms = ms if ms is not None else miembros_dra(s)
    p = plan(deberia, gestionados, ms)
    pon = sum(1 for c in p if c['poner'])
    sac = sum(len(c['sacar']) for c in p)
    print('   %s: %d deberían tener uno · %d cambios (%d a poner, %d a sacar)' % (nombre, len(deberia), len(p), pon, sac))
    if not hacer or not p:
        return p
    if ciclo and len(p) > TOPE_CICLO:
        print('   ⚠️ %d cambios en una vuelta: más de %d no se hacen solos (¿la primera vez? ¿otra temporada?). A mano: '
              '`python bot/%s.py --aplicar`' % (len(p), TOPE_CICLO, nombre))
        return p
    print('   ✅ %d de %d' % (aplicar(s, p, razon), len(p)))
    return p


# ═══ lo del Pase ═════════════════════════════════════════════════════════════════════════════════════════════════════
def deberia_pase(niveles, ms, t):
    """`{discord_id: rol}`: los Miembros de DRA con nivel 1 o más, cada uno con el rol de su nivel."""
    out = {}
    for did, nivel in (niveles or {}).items():
        m = ms.get(str(did))
        if not m or ROL_MIEMBRO not in (m.get('roles') or []):
            continue
        rid = rol_de(nivel, t)
        if rid:
            out[str(did)] = rid
    return out


def main():
    if '--auto' in sys.argv:
        return 1 if _self_check() else 0
    t = tabla()
    if not activo(t):
        print('   ⏸️ roles del Pase apagados: datos/roles_pase.json tiene %d de los %d roles '
              '(los crea `herramientas/crear_roles_liga.py --pase --aplicar`)' % (len(t), NIVELES))
        return 0
    import pase as PA
    d = PA.leer_niveles()
    if not d:
        print('   ⚠️ sin datos/pase_niveles.json: no toco nada')
        return 0
    ciclo = '--ciclo' in sys.argv
    s = sesion()
    try:
        ms = miembros_dra(s)
    except RuntimeError as e:
        print('   ⚠️ %s: no toco nada' % e)
        return 0
    correr('roles_pase', deberia_pase(d['niveles'], ms, t), list(t.values()), RAZON, ciclo,
           ciclo or '--aplicar' in sys.argv, s=s, ms=ms)
    return 0


def _self_check():
    mal = 0

    def ok(c, que):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', que))

    print('\n  roles_pase.py — los roles por nivel del Pase, sin red\n')
    import verificados as VER
    import pase as PA
    ok(ROL_MIEMBRO == VER.ROL_MIEMBRO and GUILD_DRA == VER.GUILD_DRA, 'el Miembro y DRA son los de bot/verificados.py')
    ok(NIVELES == PA.NIVELES, 'un rol por cada nivel del Pase: %d' % PA.NIVELES)
    ok(nombre_nivel(17) == '◢◤🎟️◥◣ 𝐏𝐚𝐬𝐞 𝟏𝟕 ◢◤🎟️◥◣', 'el nombre, en negrita matemática también los números: %s' % nombre_nivel(17))
    import unicodedata
    ok(all(''.join(c for c in unicodedata.normalize('NFKD', nombre_nivel(n)) if c.isalnum() or c == ' ').strip() == 'Pase %d' % n
           for n in range(1, NIVELES + 1)), 'normalizado (NFKD) cada nombre es «Pase N»: así se encuentran los que ya existen')
    ok(len({nombre_nivel(n) for n in range(1, NIVELES + 1)}) == NIVELES, 'los 50 nombres son distintos')
    t0 = tabla()
    ok(not t0 or len(t0) == NIVELES, 'datos/roles_pase.json: vacío (apagado) o con los 50 (%d)' % len(t0))
    ok(not activo({n: '1' for n in range(1, NIVELES)}) and activo({n: str(n) for n in range(1, NIVELES + 1)}),
       'con uno faltando, apagado; con los 50, prendido')
    T = {n: str(100 + n) for n in range(1, NIVELES + 1)}
    ok([rol_de(n, T) for n in (0, 1, 17, 50, 51)] == ['', '101', '117', '150', '150'],
       'el rol es el del nivel de hoy: 0 nada, 17 el 17, de 50 para arriba el 50')
    import tempfile
    tmp = os.path.join(tempfile.mkdtemp(), 'r.json')
    guardar_tabla(T, tmp)
    ok(tabla(tmp) == T, 'lo que escribe la herramienta es lo que se lee')
    M = '1101257512273055745'
    ms = {'1': {'roles': [M]}, '2': {'roles': [M, '11', '999']}, '3': {'roles': [M, '12', '11']},
          '4': {'roles': ['12']}, '5': {'roles': [M, '13']}, '6': {'roles': [M]}}
    T = {n: str(10 + n) for n in range(1, NIVELES + 1)}         # el nivel n es el rol 10+n
    ms = {'1': {'roles': [M]}, '2': {'roles': [M, '11', '999']}, '3': {'roles': [M, '22', '11']},
          '4': {'roles': ['22']}, '5': {'roles': [M, '30']}, '6': {'roles': [M]}}
    deb = deberia_pase({'1': 12, '2': 1, '3': 13, '4': 30, '5': 20, '6': 0, '7': 50}, ms, T)
    ok(deb == {'1': '22', '2': '11', '3': '23', '5': '30'},
       'deberían: los Miembros con nivel, el rol de SU nivel (el 4 no es Miembro, el 6 tiene 0, el 7 no está en DRA)')
    p = {c['id']: c for c in plan(deb, list(T.values()), ms)}
    ok(p['1'] == {'id': '1', 'poner': '22', 'sacar': []}, 'uno nuevo: se le pone el suyo')
    ok('2' not in p, 'quien ya tiene el suyo: no se toca (y su rol 999, que no es nuestro, tampoco)')
    ok(p['3'] == {'id': '3', 'poner': '23', 'sacar': ['22', '11']}, 'subió del 12 al 13: el 23 entra y se van los viejos')
    ok(p['4'] == {'id': '4', 'poner': '', 'sacar': ['22']}, 'dejó de ser Miembro: pierde el suyo')
    ok('5' not in p and '6' not in p, 'los que están bien o no tienen nada, nada')
    ok(all(r in set(T.values()) for c in p.values() for r in c['sacar'] + [c['poner']] if r),
       'sólo se ponen y sacan roles de la tabla')

    class S:
        def __init__(self):
            self.n = 0

        def request(self, *a, **k):
            self.n += 1
            return type('R', (), {'status_code': 204})()
    s = S()
    q = correr('roles_pase', {str(i): '11' for i in range(TOPE_CICLO + 1)}, ['11'], RAZON, True, True,
               s=s, ms={str(i): {'roles': [M]} for i in range(TOPE_CICLO + 1)})
    ok(len(q) == TOPE_CICLO + 1 and s.n == 0, 'en el ciclo, más de %d cambios no se hacen solos' % TOPE_CICLO)
    print('\n  %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal


if __name__ == '__main__':
    sys.exit(main())
