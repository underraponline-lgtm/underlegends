# -*- coding: utf-8 -*-
"""🐣 EL PANEL DEL EVENTO DE NUEVOS, en DRA (28/11/2026).

    python herramientas/evento_nuevos_panel.py             qué haría, sin tocar nada
    python herramientas/evento_nuevos_panel.py --publicar  lo publica UNA vez (o pone al día el que ya está)
    python herramientas/evento_nuevos_panel.py --auto      el self-check, sin red

Por qué: el 80 % juega un evento y se va, y cuando Dlx les ofreció a mano a los nuevos «un evento sólo para los que
empiezan», el 95 % dijo que sí. El panel junta a los interesados solo (`bot/nuevos.js`) y avisa al staff cuando son 8.

QUÉ HACE, Y NADA MÁS
--------------------
· 🔎 busca en DRA el canal que termina en «evento-nuevos» (el del panel) y el que termina en «recibidores» (el del
  staff, privado) POR NOMBRE, como se decidió: los emojis del principio cambian, el final no. Si hay más de uno, se
  descarta el que está en el ARCHIVO (`herramientas/dra_hub.py` archivó uno viejo con ese nombre); si sigue habiendo
  dos, no hace nada y lo dice.
· 📌 con `--publicar`, se lo pide al objeto (`/avisos/nuevos-panel`, con la clave del ciclo): si ya hay un panel en
  ese canal y sigue ahí, lo EDITA; si no, publica UNO y lo anota. Correrlo dos veces no deja dos paneles.

⚠️ EL MENSAJE LO ARMA EL OBJETO (`panelMsg()` en bot/nuevos.js), no esta herramienta: el panel vive en un solo lugar y
lo edita el objeto con cada clic. Si se escribiera acá también, serían dos copias que se separan.
⚠️ Sólo LEE de Discord (los canales de DRA); lo único que escribe lo escribe el objeto, y sólo con `--publicar`.
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


def _token():
    tok = os.environ.get('DISCORD_TOKEN')
    if tok:
        return tok
    import fotos as F
    return F.env('DISCORD_TOKEN')


def main(publicar):
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
    p = hoy.get('panel') or {}
    if hoy:
        print('   anotados hoy: %s de %s' % (hoy.get('n', 0), hoy.get('meta', 8)))
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
                       data=json.dumps({'canal': panel['id'], 'staff': staff['id'], 'publicar': True}), timeout=30)
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
    print('todo ok' if not fallas else '%d fallas' % fallas)
    return 1 if fallas else 0


if __name__ == '__main__':
    if '--auto' in sys.argv:
        sys.exit(_self_check())
    sys.exit(main('--publicar' in sys.argv))
