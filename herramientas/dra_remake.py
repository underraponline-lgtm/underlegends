# -*- coding: utf-8 -*-
"""EL REMAKE DE DRA, PASO A PASO (Dlx, 11/11/2026: «mejoraremos esto y haremos el remake de los canales y del servidor de
DRA», «primero vamos paso a paso», y después «sigamos con el remake»).

    python herramientas/dra_remake.py              qué haría el paso 1, sin tocar nada
    python herramientas/dra_remake.py --aplicar    lo hace (sólo de 11 AM a 3 AM ET), con respaldo antes
    python herramientas/dra_remake.py --auto       el self-check, sin red

PASO 1 · LO QUE ESTÁ ROTO (medido el 11/11/2026, sólo GET)
---------------------------------------------------------
· 🧭 EL ONBOARDING lleva a canales que nadie ve o que ya no existen: de sus 27 canales por defecto, 2 están borrados y 5
  ocultos para @everyone (asistencia, competencias MIX, formato-visuales, llaves-veredictos y ranking-interserver, que
  está en el archivo). Quien entra los tiene «marcados» y no los ve. Se sacan; las preguntas no se tocan.
· 👋 LA PANTALLA DE BIENVENIDA tiene un botón, «Mira los eventos programados semanalmente», a un canal borrado. Pasa a
  llevar a `〢🔥〉eventos-hoy`, que es lo que ese botón prometía. Los otros botones quedan igual.
· 📦 DOS CANALES DEL ARCHIVO SE SIGUEN VIENDO: ffa-competencias y ranking-interserver. `dra_hub.py` (13/10) los movió
  con `lock_permissions`, y ese campo Discord sólo lo lee al reordenar canales (`PATCH /guilds/{id}/channels`), no al
  editar uno (`PATCH /channels/{id}`): se ignoró callado y los dos se quedaron con sus permisos de antes. Ahora se les
  copian los permisos de la categoría del archivo, que es lo que «sincronizar» quiere decir.

⚠️ NADA SE BORRA, y el onboarding y la bienvenida se guardan antes en `docs/respaldo_dra/` (con la hora ET): si algo
sale mal, se vuelve a subir lo de ahí. Después de aplicar, se vuelve a leer y se compara: las preguntas del onboarding
tienen que quedar idénticas.
⚠️ EL ONBOARDING SE MANDA ENTERO (la API lo reemplaza con lo que le mandes), con cada opción con `emoji_id` /
`emoji_name` / `emoji_animated` y no el objeto `emoji` que devuelve el GET: así lo pide Discord para escribir.
⚠️ Y PIDE UN MÍNIMO: 7 canales por defecto, 5 donde @everyone pueda escribir. Si sacando los rotos quedara por debajo,
no se manda y lo dice.
"""
import datetime as dt
import io
import json
import os
import sys
from urllib.parse import quote

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

import dra_hub as H  # noqa: E402  la conexión, el horario y el token: uno solo

GUILD = H.GUILD
VER, ESCRIBIR = H.VER, H.ESCRIBIR
MOTIVO = 'Liga Global: remake de DRA, paso 1, arreglar lo roto (Dlx, 11/11/2026)'
RESPALDO = os.path.join(BASE, 'docs', 'respaldo_dra')
#: adónde va cada botón de la bienvenida que apuntaba a un canal borrado, según lo que promete: `(palabras, canal, texto
#: nuevo o None para dejar el suyo)`. Son dos: «Mira los eventos programados semanalmente» y «Pregunta cualquier duda»
EVENTOS_HOY = '1500690475089399858'
TICKET = '1498326838576156904'
BIENVENIDA = [(('evento', 'program', 'semana'), EVENTOS_HOY, 'Los eventos de hoy de toda la Liga'),
              (('duda', 'pregunt', 'ayuda', 'soporte'), TICKET, None)]


def destino_bienvenida(desc):
    """`(canal, texto)` para un botón roto de la bienvenida según lo que dice, o `None` si no se sabe adónde va. Pura."""
    t = (desc or '').lower()
    for palabras, canal, texto in BIENVENIDA:
        if any(p in t for p in palabras):
            return canal, texto or desc
    return None
#: lo que pide Discord para que el onboarding siga prendido
MIN_DEFECTO, MIN_ESCRIBIR = 7, 5


class Discord(H.Discord):
    def __init__(self, aplicar):
        super().__init__(aplicar)
        self.h['X-Audit-Log-Reason'] = quote(MOTIVO)


def puede(c, base, roles=()):
    """`(ve, escribe)` de @everyone (más `roles`) en el canal `c`, con `base` = los permisos del rol @everyone. Pura."""
    p = int(base)
    ow = {o['id']: o for o in c.get('permission_overwrites') or []}
    if GUILD in ow:
        p = (p & ~int(ow[GUILD]['deny'])) | int(ow[GUILD]['allow'])
    a = n = 0
    for r in roles:
        if r in ow:
            a |= int(ow[r]['allow'])
            n |= int(ow[r]['deny'])
    p = (p & ~n) | a
    return bool(p & VER), bool(p & ESCRIBIR)


def opcion_para_escribir(op):
    """Una opción del onboarding como la pide la escritura: `emoji_*` sueltos en vez del objeto `emoji`. Pura."""
    o = {k: op[k] for k in ('id', 'title', 'description', 'channel_ids', 'role_ids') if k in op}
    e = op.get('emoji') or {}
    if e.get('id'):
        o['emoji_id'] = e['id']
    if e.get('name'):
        o['emoji_name'] = e['name']
    if e.get('animated'):
        o['emoji_animated'] = True
    return o


def onboarding_para_escribir(onb, defecto):
    """El onboarding entero para el PUT, con `defecto` como canales por defecto. Pura."""
    return {
        'prompts': [{k: p[k] for k in ('id', 'type', 'title', 'single_select', 'required', 'in_onboarding') if k in p}
                    | {'options': [opcion_para_escribir(o) for o in p.get('options') or []]}
                    for p in onb.get('prompts') or []],
        'default_channel_ids': defecto,
        'enabled': onb.get('enabled', True),
        'mode': onb.get('mode', 0),
    }


def huella_preguntas(onb):
    """Lo que no tiene que cambiar de las preguntas: título, obligatoria, y de cada opción título, roles y canales."""
    return [(p.get('title'), p.get('required'), p.get('single_select'), p.get('in_onboarding'),
             [(o.get('title'), sorted(o.get('role_ids') or []), sorted(o.get('channel_ids') or []),
               (o.get('emoji') or {}).get('id') or (o.get('emoji') or {}).get('name') or o.get('emoji_id') or o.get('emoji_name'))
              for o in p.get('options') or []])
            for p in onb.get('prompts') or []]


def respaldar(nombre, dato):
    os.makedirs(RESPALDO, exist_ok=True)
    from zoneinfo import ZoneInfo
    t = dt.datetime.now(ZoneInfo('America/New_York')).strftime('%Y%m%d_%H%M')
    p = os.path.join(RESPALDO, '%s_%s.json' % (nombre, t))
    with io.open(p, 'w', encoding='utf-8') as f:
        json.dump(dato, f, ensure_ascii=False, indent=1)
    return p


def paso1(d):
    chs = d.get('/guilds/%s/channels' % GUILD)
    roles = d.get('/guilds/%s/roles' % GUILD)
    base = next(r['permissions'] for r in roles if r['id'] == GUILD)
    por = {c['id']: c for c in chs}
    arch = next((c for c in chs if c['type'] == 4 and 'ARCHIVO' in c['name']), None)
    nombre = lambda i: (por.get(i) or {}).get('name') or ('(borrado %s)' % i)  # noqa: E731

    print('\n🧭 el onboarding: los canales por defecto')
    onb = d.get('/guilds/%s/onboarding' % GUILD)
    viejos = list(onb.get('default_channel_ids') or [])
    quedan, salen, suman = [], [], []
    for i in viejos:
        c = por.get(i)
        if not c:
            salen.append((i, 'ya no existe'))
        elif arch and c.get('parent_id') == arch['id']:
            salen.append((i, 'está en el archivo'))
        elif c['type'] == 4 and not puede(c, base)[0]:
            # 🏆 UNA CATEGORÍA OCULTA CON CANALES ABIERTOS (LIGA GLOBAL: @everyone no ve la categoría, cada canal se abre
            # solo). Discord la rechaza entera («DEFAULT_CHANNEL_REQUIRES_EVERYONE_ACCESS», 11/11/2026, 10:28 PM ET):
            # va cada canal visible suyo en su lugar, así siguen marcados para quien entra
            salen.append((i, 'categoría oculta: van sus canales visibles'))
            for h in sorted((x for x in chs if x.get('parent_id') == i and x['type'] != 4 and puede(x, base)[0]),
                            key=lambda x: x['position']):
                if h['id'] not in viejos and h['id'] not in suman:
                    suman.append(h['id'])
        elif not puede(c, base)[0]:
            salen.append((i, 'nadie sin rol lo ve'))
        else:
            quedan.append(i)
    for i, por_que in salen:
        print('  − %s · %s' % (nombre(i), por_que))
    for i in suman:
        print('  + %s' % nombre(i))
    quedan += suman
    escriben = [i for i in quedan if por[i]['type'] in (0, 5, 15) and puede(por[i], base)[1]]
    print('  quedan %d (antes %d), %d donde @everyone escribe' % (len(quedan), len(viejos), len(escriben)))
    if salen:
        if len(quedan) < MIN_DEFECTO or len(escriben) < MIN_ESCRIBIR:
            print('  ⚠️ quedaría por debajo de lo que pide Discord (%d y %d): no se manda' % (MIN_DEFECTO, MIN_ESCRIBIR))
        else:
            if d.aplicar:
                print('  💾 respaldo: %s' % os.path.relpath(respaldar('onboarding', onb), BASE))
            r = d.cambio('sacar %d canales rotos de los que el onboarding marca por defecto' % len(salen), 'PUT',
                         '/guilds/%s/onboarding' % GUILD, onboarding_para_escribir(onb, quedan))
            if r is not None:
                nuevo = d.get('/guilds/%s/onboarding' % GUILD)
                igual = huella_preguntas(nuevo) == huella_preguntas(onb)
                print('  %s las preguntas quedaron %s' % ('✅' if igual else '🔴', 'idénticas' if igual else
                                                        'DISTINTAS: volver a subir el respaldo'))

    print('\n👋 la pantalla de bienvenida')
    w = d.get('/guilds/%s/welcome-screen' % GUILD)
    canales = []
    cambia = False
    for x in w.get('welcome_channels') or []:
        if x.get('channel_id') not in por:
            dst = destino_bienvenida(x.get('description'))
            if not dst:
                print('  ⚠️ «%s» lleva a un canal borrado y no sé adónde va: se saca' % x.get('description'))
                cambia = True
                continue
            print('  ↻ «%s» lleva a un canal borrado → %s, «%s»' % (x.get('description'), nombre(dst[0]), dst[1]))
            x = dict(x, channel_id=dst[0], description=dst[1])
            cambia = True
        canales.append({k: x[k] for k in ('channel_id', 'description', 'emoji_id', 'emoji_name') if x.get(k) is not None})
    if cambia:
        if d.aplicar:
            print('  💾 respaldo: %s' % os.path.relpath(respaldar('bienvenida', w), BASE))
        d.cambio('arreglar el botón de la bienvenida que llevaba a un canal borrado', 'PATCH',
                 '/guilds/%s/welcome-screen' % GUILD, {'welcome_channels': canales})
    else:
        print('  nada roto')

    print('\n📦 el archivo: lo que se sigue viendo')
    if not arch:
        print('  (no hay categoría ARCHIVO)')
        return 0
    sync = [{k: o[k] for k in ('id', 'type', 'allow', 'deny')} for o in arch.get('permission_overwrites') or []]
    for c in chs:
        if c.get('parent_id') == arch['id'] and puede(c, base)[0]:
            d.cambio('ocultar %s: copiarle los permisos del archivo' % c['name'], 'PATCH', '/channels/%s' % c['id'],
                     {'permission_overwrites': sync})
    print('\n  %s\n' % ('aplicado' if d.aplicar else '%d cambio(s). Nada se tocó: con --aplicar se hace.' % len(d.hechos)))
    return 0


def _self_check():
    mal = 0

    def ok(c, que):
        nonlocal mal
        print('   %s %s' % ('✅' if c else '❌', que))
        mal += 0 if c else 1
    base = str(1 << 11)              # @everyone sin VER, con ESCRIBIR (como DRA)
    abierto = {'permission_overwrites': [{'id': GUILD, 'type': 0, 'allow': str(VER), 'deny': '0'}]}
    cerrado = {'permission_overwrites': []}
    lectura = {'permission_overwrites': [{'id': GUILD, 'type': 0, 'allow': str(VER), 'deny': str(ESCRIBIR)}]}
    ok(puede(abierto, base) == (True, True) and puede(cerrado, base) == (False, True) and puede(lectura, base) == (True, False),
       '@everyone sin vista en la base: lo abre el permiso del canal, y «sólo lectura» se ve sin escribir')
    op = {'id': '1', 'title': 'Hombre', 'description': '', 'channel_ids': ['9'], 'role_ids': ['8'],
          'emoji': {'id': None, 'name': '➜', 'animated': False}}
    w = opcion_para_escribir(op)
    ok('emoji' not in w and w['emoji_name'] == '➜' and 'emoji_id' not in w and w['role_ids'] == ['8'],
       'una opción se escribe con emoji_name/emoji_id sueltos, no con el objeto emoji')
    onb = {'prompts': [{'id': 'p', 'type': 0, 'title': 'T', 'single_select': True, 'required': False, 'in_onboarding': True,
                        'options': [op]}], 'default_channel_ids': ['1', '2'], 'enabled': True, 'mode': 1}
    pu = onboarding_para_escribir(onb, ['1'])
    ok(pu['default_channel_ids'] == ['1'] and pu['mode'] == 1 and pu['prompts'][0]['options'][0]['emoji_name'] == '➜',
       'el onboarding sale entero (preguntas, modo, prendido) con los canales nuevos')
    ok(huella_preguntas(onb) == huella_preguntas(dict(onb, prompts=[dict(onb['prompts'][0], options=[w])])),
       'la huella de las preguntas es la misma leída (emoji) que escrita (emoji_name): se puede comparar antes y después')
    ok(destino_bienvenida('Mira Los Eventos Programados Semanalmente!') == (EVENTOS_HOY, 'Los eventos de hoy de toda la Liga')
       and destino_bienvenida('Pregunta Cualquier Duda Que Tengas!') == (TICKET, 'Pregunta Cualquier Duda Que Tengas!')
       and destino_bienvenida('Chatea Con Los Demás!') is None,
       'cada botón roto de la bienvenida va a lo que promete: los eventos a eventos-hoy, las dudas a ticket-soporte')
    print('\n   %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return 1 if mal else 0


def main():
    if '--auto' in sys.argv:
        return _self_check()
    aplicar = '--aplicar' in sys.argv
    if aplicar and H.madrugada():
        print('De 3 a 11 AM ET no se toca DRA (la madrugada). Córrelo después de las 11.')
        return 1
    if not H._token():
        print('Falta el token del bot (.env o DISCORD_TOKEN).')
        return 1
    return paso1(Discord(aplicar))


if __name__ == '__main__':
    sys.exit(main())
