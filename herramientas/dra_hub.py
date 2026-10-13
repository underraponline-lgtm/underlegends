# -*- coding: utf-8 -*-
"""DRA, EL CENTRO DE LA LIGA GLOBAL: la estructura de canales (Dlx, 13/10/2026).

    python herramientas/dra_hub.py              qué haría, sin tocar nada
    python herramientas/dra_hub.py --aplicar    lo hace (sólo de 11 AM a 3 AM ET)
    python herramientas/dra_hub.py --auto       el self-check, sin red

🔑 Dlx, 13/10/2026: *«¿te acordás que DRA sería el hub? … acá irían los paneles con el ranking, paneles de most
wanted… que DRA sea el centro de la Liga Global»*, *«planeá: qué canales quitaremos, agregaremos, cambiaremos,
renombraremos»*, y al plan: *«1. Visible 2. Archivar. Creá una categoría y ahí mové todo 3. Sí 4. Imagen con botones»*.

QUÉ HACE, Y NADA MÁS
--------------------
· 📦 una categoría ARCHIVO, oculta, abajo de todo, y ahí se mueven los canales que se quitan (sincronizados con ella:
  quedan ocultos). Nada se borra: si alguno hace falta, se saca de ahí.
· ✏️ renombra tres categorías (EMPEZÁ ACÁ, EVENTOS DRA, ENTRENAMIENTO) y «rankings-liga-global» → «liga-global».
· 👁️ Most Wanted y próximos-eventos, visibles para todos (sólo lectura). ⚠️ En próximos-eventos no alcanza con abrir
  @everyone: los roles de rango tenían la vista negada y una negación de rol le gana al permiso de @everyone.
· ➕ tres canales en LIGA GLOBAL: ranking y esta-semana (paneles, sólo lectura) y tu-tarjeta (para /card y /versus).
· 🎚️ los tiers de las competencias, por los ocho rangos: I = SSS·SS·S, II = A·B, III = C·D·E. Los permisos de
  personas sueltas que ya estaban se quedan.

⚠️ IDEMPOTENTE: mira cómo está DRA antes de cada cambio y hace sólo lo que falta. Correrlo dos veces no crea dos
canales ni dos categorías. Los ids que crea quedan en `datos/dra_hub.json`, para los paneles (`bot/paneles_dra.py`).
⚠️ NO MUEVE EL ORDEN DE LAS CATEGORÍAS: el chat general y lo demás quedan donde la gente los conoce.
⚠️ Cada cambio lleva su motivo en el registro de auditoría de Discord.
"""
import io
import json
import os
import sys
import time
from urllib.parse import quote

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

GUILD = '841017460341604382'
API = 'https://discord.com/api/v10'
SALIDA = os.path.join(BASE, 'datos', 'dra_hub.json')
MOTIVO = 'Liga Global: DRA como centro de la Liga (Dlx, 13/10/2026)'
VER, ESCRIBIR, HISTORIAL, COMANDOS = 1 << 10, 1 << 11, 1 << 16, 1 << 31

# ── lo decidido ────────────────────────────────────────────────────────
#: las categorías que cambian de nombre (por id) y el nombre nuevo
CATEGORIAS = {
    '1506094294120005644': '🏁 ╣ EMPEZÁ ACÁ ══════════',
    '1511754900026032139': '🎪 ╣ EVENTOS DRA ═════════',
    '1498325342170120323': '🧠 ╣ ENTRENAMIENTO ═══════',
}
#: los canales que cambian de nombre
RENOMBRAR = {'1498326749748924416': '〢📣〉liga-global'}
#: los que se archivan: sin mensajes hace meses, ocultos y vacíos, o repetidos por otro
ARCHIVAR = {
    '1506094465691947038': 'tutorial-guia: oculto y sin un solo mensaje',
    '1516285712805265519': 'evento-nuevos: oculto y sin un solo mensaje',
    '1506177887256973394': 'ul-gremio: oculto y sin un solo mensaje',
    '1498326774537519315': 'ranking-interserver: 91 días sin mensajes; lo reemplaza #ranking',
    '1516367700648136814': 'buscar-batalla: 103 días sin mensajes',
    '1540173711934619718': 'ffa-competencias: eventos-hoy ya trae los eventos de FFA',
}
ARCHIVO = '📦 ╣ ARCHIVO ═════════════'
#: los que pasan a verse (sólo lectura)
VISIBLES = {'1500262299112439839': 'most-wanted', '1533515291605336247': 'proximos-eventos'}
LIGA_GLOBAL = '1498325135277686826'
#: los canales nuevos de LIGA GLOBAL: clave → (nombre, tema, sólo lectura)
NUEVOS = {
    'ranking': ('〢🏆〉ranking', 'Los rankings de la Liga Global, al día: el bot los actualiza solo. Todo en underlegends.pages.dev', True),
    'esta_semana': ('〢📅〉esta-semana', 'Lo de esta semana: multiplicadores, el evento dorado, las Misiones y las encuestas abiertas', True),
    'tu_tarjeta': ('〢🃏〉tu-tarjeta', 'Acá: /card para ver tu tarjeta y /versus para compararte con alguien', False),
}
#: el orden adentro de LIGA GLOBAL, de arriba abajo (por id o por clave de NUEVOS)
ORDEN_LIGA = ['1504107096159817919', '1498326749748924416', 'ranking', '1500262299112439839', 'esta_semana',
              '1500690475089399858', '1504106780819722391', 'tu_tarjeta']
#: los tiers: canal → las letras que lo ven
TIERS = {
    '1501079748049240085': ('SSS', 'SS', 'S'),
    '1501079800985554994': ('A', 'B'),
    '1501079814084493342': ('C', 'D', 'E'),
}


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


class Discord:
    """Lo mínimo para hablar con Discord, con el motivo en cada cambio. `aplicar=False` no manda nada que cambie."""

    def __init__(self, aplicar):
        import requests
        self.r = requests
        self.aplicar = aplicar
        self.h = {'Authorization': 'Bot ' + _token(), 'Content-Type': 'application/json',
                  'X-Audit-Log-Reason': quote(MOTIVO)}
        self.hechos = []

    def get(self, ruta):
        x = self.r.get(API + ruta, headers=self.h, timeout=30)
        x.raise_for_status()
        return x.json()

    def cambio(self, que, metodo, ruta, cuerpo=None):
        self.hechos.append(que)
        if not self.aplicar:
            print('  · ' + que)
            return None
        for _ in range(3):
            x = self.r.request(metodo, API + ruta, headers=self.h, timeout=30,
                               data=json.dumps(cuerpo) if cuerpo is not None else None)
            if x.status_code == 429:
                time.sleep(float((x.json() or {}).get('retry_after') or 2) + 0.5)
                continue
            if x.status_code >= 400:
                print('  ✗ %s → %s %s' % (que, x.status_code, x.text[:200]))
                return None
            print('  ✓ ' + que)
            time.sleep(0.4)
            return x.json() if x.text else {}
        return None


def roles_de_rango(roles):
    """`{letra: id}` de los ocho roles de rango (en negrita matemática: ver `roles_de_rango.plano()`)."""
    import roles_de_rango as RR
    out = {}
    for r in roles:
        m = RR._ROL.search(RR.plano(r['name']).upper().strip())
        if m:
            out[m.group(1)] = r['id']
    return out


def overwrite(c, oid):
    return next((o for o in c.get('permission_overwrites') or [] if o['id'] == oid), None)


def poner(d, c, oid, tipo, allow_add=0, allow_quitar=0, deny_add=0, deny_quitar=0, que=''):
    """Un permiso de un canal, tocando sólo esos bits. Si queda igual, no hace nada."""
    o = overwrite(c, oid) or {'allow': '0', 'deny': '0'}
    a0, d0 = int(o.get('allow') or 0), int(o.get('deny') or 0)
    a1 = (a0 | allow_add) & ~allow_quitar & ~deny_add
    d1 = (d0 | deny_add) & ~deny_quitar & ~allow_add
    if (a1, d1) == (a0, d0):
        return
    d.cambio(que, 'PUT', '/channels/%s/permissions/%s' % (c['id'], oid), {'type': tipo, 'allow': str(a1), 'deny': str(d1)})


def plan(d):
    """Mira DRA y hace (o muestra) lo que falta."""
    chs = d.get('/guilds/%s/channels' % GUILD)
    roles = d.get('/guilds/%s/roles' % GUILD)
    por = {c['id']: c for c in chs}
    rg = roles_de_rango(roles)
    hecho = {}
    try:
        with io.open(SALIDA, encoding='utf-8') as f:
            hecho = json.load(f)
    except (OSError, ValueError):
        hecho = {}

    print('\n📦 el archivo')
    arch = next((c for c in chs if c['type'] == 4 and c['name'] == ARCHIVO), None) or por.get(hecho.get('archivo') or '')
    if not arch:
        fondo = max(c['position'] for c in chs if c['type'] == 4) + 1
        arch = d.cambio('crear la categoría «%s», oculta, abajo de todo' % ARCHIVO, 'POST', '/guilds/%s/channels' % GUILD,
                        {'name': ARCHIVO, 'type': 4, 'position': fondo,
                         'permission_overwrites': [{'id': GUILD, 'type': 0, 'allow': '0', 'deny': str(VER)}]})
    if arch:
        hecho['archivo'] = arch['id']
    for cid, por_que in ARCHIVAR.items():
        c = por.get(cid)
        if not c:
            print('  (no está: %s)' % por_que)
            continue
        if arch and c.get('parent_id') == arch.get('id'):
            continue
        d.cambio('archivar %s (%s)' % (c['name'], por_que), 'PATCH', '/channels/%s' % cid,
                 {'parent_id': (arch or {}).get('id'), 'lock_permissions': True})

    print('\n✏️ los nombres')
    for cid, nombre in list(CATEGORIAS.items()) + list(RENOMBRAR.items()):
        c = por.get(cid)
        if c and c['name'] != nombre:
            d.cambio('«%s» → «%s»' % (c['name'], nombre), 'PATCH', '/channels/%s' % cid, {'name': nombre})

    print('\n👁️ visibles para todos, sólo lectura')
    for cid, n in VISIBLES.items():
        c = por.get(cid)
        if not c:
            continue
        poner(d, c, GUILD, 0, allow_add=VER | HISTORIAL, deny_add=ESCRIBIR, que='%s: @everyone lo ve y no escribe' % n)
        # una negación de rol le gana al permiso de @everyone: las de los roles de rango se sacan
        for letra, rid in rg.items():
            o = overwrite(c, rid)
            if o and int(o.get('deny') or 0) & VER:
                poner(d, c, rid, 0, deny_quitar=VER, que='%s: Rango %s ya no tiene la vista negada' % (n, letra))

    print('\n➕ los canales nuevos de LIGA GLOBAL')
    for clave, (nombre, tema, lectura) in NUEVOS.items():
        c = por.get(hecho.get(clave) or '') or next((x for x in chs if x['name'] == nombre), None)
        if not c:
            allow = VER | HISTORIAL | (0 if lectura else (ESCRIBIR | COMANDOS))
            deny = ESCRIBIR if lectura else 0
            c = d.cambio('crear %s (%s)' % (nombre, 'sólo lectura' if lectura else 'se escribe'), 'POST',
                         '/guilds/%s/channels' % GUILD,
                         {'name': nombre, 'type': 0, 'parent_id': LIGA_GLOBAL, 'topic': tema,
                          'rate_limit_per_user': 0 if lectura else 10,
                          'permission_overwrites': [{'id': GUILD, 'type': 0, 'allow': str(allow), 'deny': str(deny)}]})
        if c:
            hecho[clave] = c['id']
            por[c['id']] = c

    print('\n↕️ el orden de LIGA GLOBAL')
    ids = [hecho.get(x, x) for x in ORDEN_LIGA]
    ids = [x for x in ids if x in por]
    actual = sorted((c for c in chs if c.get('parent_id') == LIGA_GLOBAL), key=lambda c: c['position'])
    if [c['id'] for c in actual] != ids:
        base = min([c['position'] for c in actual] or [0])
        d.cambio('ordenar LIGA GLOBAL: ' + ' · '.join(por[x]['name'] for x in ids), 'PATCH', '/guilds/%s/channels' % GUILD,
                 [{'id': x, 'position': base + i} for i, x in enumerate(ids)])

    print('\n🎚️ los tiers por los ocho rangos')
    for cid, letras in TIERS.items():
        c = por.get(cid)
        if not c:
            continue
        for letra, rid in sorted(rg.items()):
            if letra in letras:
                poner(d, c, rid, 0, allow_add=VER, deny_quitar=VER, que='%s: lo ve Rango %s' % (c['name'], letra))
            else:
                o = overwrite(c, rid)
                if o and int(o.get('allow') or 0) & VER:
                    poner(d, c, rid, 0, allow_quitar=VER, que='%s: Rango %s ya no' % (c['name'], letra))

    if d.aplicar:
        hecho['t'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        with io.open(SALIDA, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(hecho, f, ensure_ascii=False, indent=1, sort_keys=True)
            f.write('\n')
    print('\n%d cambio(s) %s' % (len(d.hechos), 'hechos' if d.aplicar else 'por hacer (sin tocar nada: --aplicar)'))
    return 0


def madrugada():
    """De 3 a 11 AM ET no se toca DRA (Dlx, 27/09/2026: la madrugada)."""
    import datetime as dt
    try:
        from zoneinfo import ZoneInfo
        h = dt.datetime.now(ZoneInfo('America/New_York')).hour
    except Exception:                                    # noqa: BLE001
        h = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=4)).hour
    return 3 <= h < 11


def _self_check():
    mal = 0

    def ok(c, que):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('ok' if c else '🔴', que))

    print('\n  dra_hub.py — self-check, sin red\n')
    ok(set(TIERS['1501079748049240085']) | set(TIERS['1501079800985554994']) | set(TIERS['1501079814084493342'])
       == {'SSS', 'SS', 'S', 'A', 'B', 'C', 'D', 'E'}, 'los tres tiers cubren los ocho rangos, sin repetir')
    ok(not set(ARCHIVAR) & (set(VISIBLES) | set(RENOMBRAR) | set(TIERS)), 'lo que se archiva no se toca de otra forma')
    ok(all(isinstance(x, str) for x in ORDEN_LIGA) and set(NUEVOS) <= set(ORDEN_LIGA), 'los canales nuevos tienen lugar')

    class Falso:
        aplicar, hechos = False, []

        def cambio(self, que, *a):
            self.hechos.append(que)
    f = Falso()
    c = {'id': '1', 'permission_overwrites': [{'id': GUILD, 'allow': '0', 'deny': str(VER | ESCRIBIR)}]}
    poner(f, c, GUILD, 0, allow_add=VER, deny_add=ESCRIBIR, que='x')
    ok(f.hechos == ['x'], 'abrir la vista con la escritura negada es un cambio')
    c2 = {'id': '1', 'permission_overwrites': [{'id': GUILD, 'allow': str(VER), 'deny': str(ESCRIBIR)}]}
    f.hechos = []
    poner(f, c2, GUILD, 0, allow_add=VER, deny_add=ESCRIBIR, que='y')
    ok(f.hechos == [], 'si ya está así, no hace nada (correrlo dos veces no cambia nada)')
    print('\n   %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return 1 if mal else 0


def main():
    if '--auto' in sys.argv:
        return _self_check()
    aplicar = '--aplicar' in sys.argv
    if aplicar and madrugada():
        print('De 3 a 11 AM ET no se toca DRA (la madrugada). Correlo después de las 11.')
        return 1
    if not _token():
        print('Falta el token del bot (.env o DISCORD_TOKEN).')
        return 1
    return plan(Discord(aplicar))


if __name__ == '__main__':
    sys.exit(main())
