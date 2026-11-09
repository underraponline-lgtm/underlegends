# -*- coding: utf-8 -*-
"""🖼️ LOS AFICHES DEL VIGÍA: el anuncio que es sólo una imagen, leído en un minuto o dos y no en la próxima corrida.

    python bot/afiches.py           la tarea `afiche.yml`: lee lo que el vigía dejó en la cola y le devuelve el texto
    python bot/afiches.py --auto    el self-check, sin red

🔑 Dlx, 09/11/2026, a «el vigía no lee afiches: entran con el ciclo, cada media hora»: *«arreglemos eso»*.

CÓMO
1. El vigía (`anotar()` en `bot/avisos.js`) ve un mensaje de un canal de eventos que no es un anuncio, con una imagen y
   poco texto (`esAfiche()`, la misma regla que `anuncios.pide_ocr()`), y lo deja en la cola (`encolarAfiche()`).
2. Lanza esta tarea (`lanzarAfiches()`), una a la vez y no más de una cada 3 minutos.
3. Esta tarea pide la cola (`/avisos/afiches`), baja cada mensaje y su imagen de Discord, se la pasa a la IA del Worker
   (`/avisos/ocr`, la misma del ciclo: `anuncios.texto_de_imagen()`) y le devuelve el texto con los rótulos de una
   plantilla (`/avisos/afiche`): el vigía lo vuelve a pasar por `anotar()` como si el organizador lo hubiera escrito.

⚠️ POR QUÉ GITHUB Y NO EL WORKER: Discord le contesta 403 a Cloudflare cuando el Worker pide la imagen (ver
`leer-afiches` en las notas del proyecto). Desde GitHub baja bien, como en el ciclo.

⚠️ NO GUARDA NADA EN EL REPO: lo leído no va a `datos/ocr_anuncios.json`, que es del ciclo. El ciclo puede volver a leer
el mismo afiche más tarde; son pocos por día y el cupo de la IA alcanza (10.000 neuronas, ver `anuncios.OCR_TOPE`).
"""
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

API = 'https://discord.com/api/v10'


def texto_para(m, leido):
    """Lo que el vigía tiene que leer: el texto del afiche con sus rótulos y, abajo, lo que el organizador escribió. Es lo
    mismo que arma el ciclo (`anuncios.leer()`). `''` si el afiche no dijo nada."""
    import anuncios as A
    leido = str(leido or '').strip()
    if not leido:
        return ''
    return A.rotular_afiche(leido) + '\n' + str((m or {}).get('content') or '')


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        return _self_check()
    import requests
    import anuncios as A
    import clave_ciclo as CC
    import fotos as F
    ck = CC.clave(F.env('DISCORD_TOKEN'))
    h = {'x-lg-ciclo': ck, 'content-type': 'application/json'}
    r = requests.post(A.WORKER + '/avisos/afiches', data='{}', headers=h, timeout=30)
    if r.status_code != 200:
        print('   ⚠️ no pude pedir la cola de afiches (%s)' % r.status_code)
        return 1
    pend = (r.json() or {}).get('pendientes') or []
    print('\n══ 🖼️ LOS AFICHES DEL VIGÍA: %d en la cola ══\n' % len(pend))
    s = A._sesion()
    cuenta = [0]
    for p in pend:
        m = s.get('%s/channels/%s/messages/%s' % (API, p.get('canal'), p.get('id')), timeout=30)
        leido = ''
        if m.status_code == 200 and A.imagen_de(m.json()):
            leido = A.texto_de_imagen(m.json(), {'msgs': {}}, cuenta)
        texto = texto_para(m.json() if m.status_code == 200 else {}, leido)
        r = requests.post(A.WORKER + '/avisos/afiche', data=json.dumps({'id': p.get('id'), 'texto': texto},
                                                                       ensure_ascii=False).encode('utf-8'),
                          headers=h, timeout=30)
        res = r.json() if r.status_code == 200 else {}
        # 🔒 el repo es público: el log dice el servidor y si avisó, no qué decía el afiche
        print('   %-5s %s  %s' % (p.get('sv') or '', p.get('id'),
                                 'avisó' if res.get('aviso') else 'leído, sin aviso' if texto else
                                 'sin texto' if m.status_code == 200 else 'no lo pude bajar (%s)' % m.status_code))
    print('')
    return 0


def _self_check():
    mal = 0

    def ok(c, que):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', que))

    print('\n  los afiches del vigía\n')
    t = texto_para({'content': '@everyone'}, 'VALHALLA\nVOL1\nDOMINGO 4 DE OCTUBRE\n7PM CHILE')
    ok(t.startswith('# VALHALLA VOL1') and 'HORARIO: 7PM CHILE' in t and t.endswith('@everyone'),
       'el texto del afiche va con sus rótulos y, abajo, lo que escribió el organizador')
    ok(texto_para({'content': 'x'}, '   ') == '', 'un afiche que no dijo nada no se manda como texto')
    import anuncios as A
    a = A.parsear({'id': '1', 'timestamp': '2026-10-04T18:00:00', 'author': {'global_name': 'x'},
                   'content': texto_para({'content': '@everyone'}, 'VALHALLA\nVOL1\nDOMINGO 4 DE OCTUBRE\n7PM CHILE')},
                  'ACAD', 'torneos')
    ok(bool(a) and a.get('nombre') == 'VALHALLA VOL1', 'y el lector de anuncios lo lee como el de VALHALLA del ciclo')
    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


if __name__ == '__main__':
    sys.exit(main())
