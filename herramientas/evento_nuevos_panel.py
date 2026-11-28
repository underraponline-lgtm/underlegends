# -*- coding: utf-8 -*-
"""🐣 EL PANEL «PARA LOS NUEVOS», en DRA (28/11/2026).

    python herramientas/evento_nuevos_panel.py             qué haría, sin tocar nada
    python herramientas/evento_nuevos_panel.py --publicar  lo publica UNA vez (o pone al día el que ya está)
    python herramientas/evento_nuevos_panel.py --auto      el self-check, sin red

    🔁 EL PANEL «DE REGRESO», para los inactivos (28/11/2026), lo mismo con `--vuelve`:
    python herramientas/evento_nuevos_panel.py --vuelve                     qué haría (el canal, sus permisos y el panel)
    python herramientas/evento_nuevos_panel.py --vuelve --crear             crea el canal «✦🔁・de-regreso» si no está
    python herramientas/evento_nuevos_panel.py --vuelve --publicar          publica el panel UNA vez (o lo pone al día)

Por qué: el 80 % juega un evento y se va, y cuando Dlx les ofreció a mano a los nuevos «un evento sólo para los que
empiezan», el 95 % dijo que sí. El panel junta a los interesados solo (`bot/nuevos.js`) en cuatro actividades —Competencia,
Cypher, Dinámica y Entrenamiento, cada una con su grupo (`ACTIVIDADES`)— y avisa al staff cuando una tiene grupo.

QUÉ HACE, Y NADA MÁS
--------------------
· 🔎 busca en DRA el canal que termina en «evento-nuevos» (el del panel) y el que termina en «recibidor» (el del
  staff, privado) POR NOMBRE, como se decidió: los emojis del principio cambian, el final no. Si hay más de uno, se
  descarta el que está en el ARCHIVO (`herramientas/dra_hub.py` archivó uno viejo con ese nombre); si sigue habiendo
  dos, no hace nada y lo dice.
· 📌 con `--publicar`, se lo pide al objeto (`/avisos/nuevos-panel`, con la clave del ciclo): si ya hay un panel en
  ese canal y sigue ahí, lo EDITA; si no, publica UNO y lo anota. Correrlo dos veces no deja dos paneles.

⚠️ EL MENSAJE LO ARMA EL OBJETO (`panelMsg()` en bot/nuevos.js), no esta herramienta: el panel vive en un solo lugar y
lo edita el objeto con cada clic. Si se escribiera acá también, serían dos copias que se separan.
⚠️ Sólo LEE de Discord (los canales de DRA); lo único que escribe lo escribe el objeto, y sólo con `--publicar`.

🔁 «DE REGRESO» (`--vuelve`): Dlx, 28/11/2026, *«quizás canales diferentes para ellos»*. El canal termina en
«de-regreso» y vive en EVENTOS DRA, debajo de «evento-nuevos». Lo ven SÓLO el rol Inactivo (el que sincroniza
`bot/inactivos.py`) y el staff —los mismos roles que ven 〢chat-staff y los de «evento-nuevos»—; nadie escribe (el panel
es un mensaje que se edita), el bot sí. Con `--crear` es lo ÚNICO que esta herramienta escribe en Discord ella misma: el
canal, una vez (si ya está, no hace nada). Quién se anota lo decide el objeto con la lista del ciclo (`regreso_inact`).
"""
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE, os.path.join(BASE, 'bot')):
    if _p not in sys.path:
        sys.path.insert(0, _p)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

GUILD = '841017460341604382'
API = 'https://discord.com/api/v10'
PANEL = 'evento-nuevos'
STAFF = 'recibidor'  # •「🚪」recibidor (28/11: el canal se llama así, en singular)
#: 🔁 el panel «De regreso»: dónde, con qué nombre (estilo `✦<emoji>・<nombre>` de EVENTOS DRA) y su tema
VUELVE = 'de-regreso'
NOMBRE_VUELVE = '✦🔁・de-regreso'
TEMA_VUELVE = 'Para los que vuelven: sólo para quien hace 45 días o más que no juega. Anótate y te avisamos cuando haya grupo.'
CAT_EVENTOS = 'eventosdra'
STAFF_CANAL = 'chatstaff'
#: los permisos de Discord que se usan
VER, ESCRIBIR, LINKS, HISTORIAL = 1 << 10, 1 << 11, 1 << 14, 1 << 16
UA = 'DiscordBot (https://underlegends.pages.dev, 1)'


def elegir(canales, fin):
    """El canal de texto cuyo nombre termina en `fin`. `(canal, motivo)`: canal None si no hay o hay más de uno.
    Los que viven en una categoría ARCHIVO no cuentan si hay otro (son los que se sacaron de la vista)."""
    cats = {c['id']: c.get('name') or '' for c in canales if c.get('type') == 4}
    cand = [c for c in canales if c.get('type') in (0, 5) and str(c.get('name') or '').endswith(fin)]
    if len(cand) > 1:
        vivos = [c for c in cand if 'ARCHIVO' not in cats.get(c.get('parent_id') or '', '').upper()]
        cand = vivos or cand
    if not cand:
        return None, 'no hay ningún canal que termine en «%s»' % fin
    if len(cand) > 1:
        return None, 'hay %d canales que terminan en «%s»: %s' % (len(cand), fin, ', '.join(c['name'] for c in cand))
    return cand[0], ''


def norm(s):
    import unicodedata
    s = unicodedata.normalize('NFKD', str(s or '')).lower()
    return ''.join(c for c in s if c.isalnum())


def permisos_vuelve(canales, rol_inactivo, bot_id, guild=GUILD):
    """🔁 Los permisos del canal «De regreso»: nadie lo ve salvo el rol Inactivo (ver y leer, no escribir) y el staff (los
    roles de «evento-nuevos» tal cual, y los que ven 〢chat-staff, para ver y leer); el bot ve, escribe y lee. Pura."""
    ow = {guild: {'id': guild, 'type': 0, 'allow': '0', 'deny': str(VER | ESCRIBIR)},
          rol_inactivo: {'id': rol_inactivo, 'type': 0, 'allow': str(VER | HISTORIAL), 'deny': str(ESCRIBIR)}}
    nu, _m = elegir(canales, PANEL)
    for o in (nu or {}).get('permission_overwrites') or []:
        if o['type'] == 0 and o['id'] not in ow:
            ow[o['id']] = {'id': o['id'], 'type': 0, 'allow': str(o['allow']), 'deny': str(o['deny'])}
    staff = next((c for c in canales if c.get('type') == 0 and STAFF_CANAL in norm(c.get('name'))), None)
    for o in (staff or {}).get('permission_overwrites') or []:
        if o['type'] == 0 and o['id'] not in ow and int(o['allow']) & VER:
            ow[o['id']] = {'id': o['id'], 'type': 0, 'allow': str(VER | HISTORIAL), 'deny': '0'}
    if bot_id:
        ow[bot_id] = {'id': bot_id, 'type': 1, 'allow': str(VER | ESCRIBIR | LINKS | HISTORIAL), 'deny': '0'}
    return list(ow.values())


def canal_vuelve(canales, rol_inactivo, bot_id):
    """🔁 Lo que se le manda a Discord para crear el canal: en EVENTOS DRA, debajo de «evento-nuevos». `(cuerpo, motivo)`."""
    cat = next((c for c in canales if c.get('type') == 4 and CAT_EVENTOS in norm(c.get('name'))), None)
    if not cat:
        return None, 'no encuentro la categoría EVENTOS DRA'
    nu, _m = elegir(canales, PANEL)
    cuerpo = {'name': NOMBRE_VUELVE, 'type': 0, 'parent_id': cat['id'], 'topic': TEMA_VUELVE,
              'permission_overwrites': permisos_vuelve(canales, rol_inactivo, bot_id)}
    if nu and nu.get('parent_id') == cat['id']:
        cuerpo['position'] = int(nu.get('position') or 0) + 1
    return cuerpo, ''


def _token():
    tok = os.environ.get('DISCORD_TOKEN')
    if tok:
        return tok
    import fotos as F
    return F.env('DISCORD_TOKEN')


def main(publicar, vuelve=False, crear=False):
    import requests
    import clave_ciclo as CC
    from alertar import WORKER
    tok = _token()
    r = requests.get('%s/guilds/%s/channels' % (API, GUILD), headers={'Authorization': 'Bot ' + tok, 'User-Agent': UA},
                     timeout=20)
    if r.status_code != 200:
        print('🔴 Discord no me dio los canales de DRA (%s)' % r.status_code)
        return 1
    canales = r.json()
    cab_dc = {'Authorization': 'Bot ' + tok, 'User-Agent': UA}
    if vuelve:
        import inactivos as INA
        rr = requests.get('%s/guilds/%s/roles' % (API, GUILD), headers=cab_dc, timeout=20)
        rol, mr = INA.rol_inactivo(rr.json() if rr.status_code == 200 else [])
        if not rol:
            print('🔴 ' + mr)
            return 1
        print('💤 el rol Inactivo: %s (%s)' % (rol['name'], rol['id']))
        panel, mp = elegir(canales, VUELVE)
        if not panel and mp.startswith('hay '):
            print('🔴 ' + mp)
            return 1
        if not panel:
            bot_id = (requests.get(API + '/users/@me', headers=cab_dc, timeout=20).json() or {}).get('id', '')
            cuerpo, mc = canal_vuelve(canales, rol['id'], bot_id)
            if not cuerpo:
                print('🔴 ' + mc)
                return 1
            print('➕ el canal «%s» no está: va en EVENTOS DRA%s, con estos permisos:' % (
                NOMBRE_VUELVE, (' (posición %s)' % cuerpo['position']) if 'position' in cuerpo else ''))
            for o in cuerpo['permission_overwrites']:
                print('     %s %s · ve %s · escribe %s' % ('rol' if o['type'] == 0 else 'bot', o['id'],
                      'sí' if int(o['allow']) & VER else 'no', 'sí' if int(o['allow']) & ESCRIBIR else 'no'))
            if not crear:
                print('\n(sin --crear no lo creo; sin canal no hay dónde publicar el panel)')
                return 0
            rc = requests.post('%s/guilds/%s/channels' % (API, GUILD), json=cuerpo, timeout=30,
                               headers=dict(cab_dc, **{'X-Audit-Log-Reason': 'Liga Global: canal De regreso (Dlx)'}))
            if rc.status_code not in (200, 201):
                print('🔴 Discord no lo creó (%s): %s' % (rc.status_code, rc.text[:200]))
                return 1
            panel = rc.json()
            print('✅ creado: #%s (%s)' % (panel['name'], panel['id']))
        staff, ms = elegir(canales, STAFF)
    else:
        panel, mp = elegir(canales, PANEL)
        staff, ms = elegir(canales, STAFF)
    if not panel or not staff:
        print('🔴 ' + (mp or ms))
        return 1
    print('🐣 el panel va en   #%s (%s)' % (panel['name'], panel['id']))
    print('📣 el staff, en     #%s (%s)' % (staff['name'], staff['id']))
    cab = {'x-lg-ciclo': CC.clave(tok)}
    hoy = {}
    try:
        rl = requests.get(WORKER + '/avisos/nuevos-lista', headers=cab, timeout=25)
        hoy = rl.json() if rl.status_code == 200 else {}
    except Exception:
        hoy = {}
    if vuelve and hoy:
        hoy = hoy.get('vuelve') or {}
        print('   inactivos que mandó el ciclo: %s' % hoy.get('inactivos', '—'))
    p = hoy.get('panel') or {}
    if hoy:
        for a in hoy.get('actividades') or []:
            print('   %s %s: %s de %s' % (a.get('emoji', ''), a.get('nombre', ''), a.get('n', 0), a.get('meta', a.get('grupo'))))
    if p.get('msg') and p.get('canal') == panel['id']:
        print('   ya hay un panel anotado (mensaje %s): se EDITA, no se publica otro' % p['msg'])
    elif hoy:
        print('   no hay panel anotado en ese canal: se publica UNO')
    else:
        print('   ⚠️ no pude preguntarle al objeto si ya hay panel (¿el Worker sin desplegar?)')
    if not publicar:
        print('\n(sin --publicar no toco nada)')
        return 0
    rp = requests.post(WORKER + '/avisos/nuevos-panel', headers=dict(cab, **{'content-type': 'application/json'}),
                       data=json.dumps(dict({'canal': panel['id'], 'staff': staff['id'], 'publicar': True},
                                            **({'tipo': 'vuelve'} if vuelve else {}))), timeout=30)
    try:
        j = rp.json()
    except ValueError:
        j = {}
    if rp.status_code != 200 or not j.get('ok'):
        print('🔴 no se pudo (%s): %s' % (rp.status_code, j))
        return 1
    print('✅ %s · https://discord.com/channels/%s/%s/%s' % ('publicado' if j.get('nuevo') else 'puesto al día', GUILD,
                                                            panel['id'], j.get('msg')))
    return 0


def _self_check():
    fallas = 0

    def ok(c, que):
        nonlocal fallas
        print(('  ✅ ' if c else '  ❌ ') + que)
        fallas += 0 if c else 1
    cs = [{'id': '1', 'type': 4, 'name': '📦 ╣ ARCHIVO ═════'}, {'id': '2', 'type': 4, 'name': '🏁 ╣ EMPIEZA AQUÍ'},
          {'id': '10', 'type': 0, 'name': 'evento-nuevos', 'parent_id': '1'},
          {'id': '11', 'type': 0, 'name': '✦🐣・evento-nuevos', 'parent_id': '2'},
          {'id': '12', 'type': 0, 'name': '•「🚪」recibidor'}, {'id': '13', 'type': 2, 'name': 'voz-recibidor'}]
    c, _ = elegir(cs, PANEL)
    ok(c and c['id'] == '11', 'el del ARCHIVO no cuenta si hay otro')
    c, _ = elegir(cs, STAFF)
    ok(c and c['id'] == '12', 'sólo canales de texto')
    c, m = elegir(cs + [{'id': '14', 'type': 0, 'name': 'otro-evento-nuevos', 'parent_id': '2'}], PANEL)
    ok(c is None and 'hay 2' in m, 'con dos posibles, ninguno')
    c, m = elegir([], PANEL)
    ok(c is None and 'no hay' in m, 'sin canal, lo dice')
    # 🔁 «De regreso»: el canal y sus permisos
    cs2 = [x for x in cs if x['id'] != '11'] + [
        {'id': '3', 'type': 4, 'name': '🎪 ╣ EVENTOS DRA ═════════'},
        {'id': '20', 'type': 0, 'name': '✦🐣・evento-nuevos', 'parent_id': '3', 'position': 25,
         'permission_overwrites': [{'id': GUILD, 'type': 0, 'allow': '66560', 'deny': '2048'},
                                   {'id': '70', 'type': 0, 'allow': '183296', 'deny': '0'}]},
        {'id': '21', 'type': 0, 'name': '╏🪽╏chat-staff', 'permission_overwrites': [
            {'id': GUILD, 'type': 0, 'allow': '0', 'deny': '1049600'}, {'id': '71', 'type': 0, 'allow': '1024', 'deny': '0'},
            {'id': '72', 'type': 0, 'allow': '0', 'deny': '1024'}]}]
    cu, _m = canal_vuelve(cs2, '99', '55')
    ow = {o['id']: o for o in cu['permission_overwrites']}
    ok(cu['name'] == '✦🔁・de-regreso' and cu['parent_id'] == '3' and cu['position'] == 26, 'el canal va en EVENTOS DRA, debajo de evento-nuevos')
    ok(bool(int(ow[GUILD]['deny']) & VER) and bool(int(ow['99']['allow']) & VER) and bool(int(ow['99']['deny']) & ESCRIBIR),
       'nadie lo ve salvo el rol Inactivo, que lee y no escribe')
    ok('70' in ow and bool(int(ow['71']['allow']) & VER) and '72' not in ow, 'el staff (los de evento-nuevos y los que ven chat-staff) lo ve')
    ok(ow['55']['type'] == 1 and bool(int(ow['55']['allow']) & ESCRIBIR), 'el bot escribe (el panel)')
    c, _m = elegir(cs2 + [{'id': '22', 'type': 0, 'name': '✦🔁・de-regreso', 'parent_id': '3'}], VUELVE)
    ok(c and c['id'] == '22', 'el canal se encuentra por cómo termina: «de-regreso»')
    print('todo ok' if not fallas else '%d fallas' % fallas)
    return 1 if fallas else 0


if __name__ == '__main__':
    if '--auto' in sys.argv:
        sys.exit(_self_check())
    sys.exit(main('--publicar' in sys.argv, vuelve='--vuelve' in sys.argv, crear='--crear' in sys.argv))
