# -*- coding: utf-8 -*-
"""LO QUE ATA AL LECTOR DE ANUNCIOS DE PYTHON CON EL DEL WORKER.

    python bot/avisos_casos.py --auto      Python sigue dando lo anotado (CI)
    python bot/avisos_casos.py --armar     rehace los casos desde Discord

🔴 EL MISMO LECTOR VIVE EN DOS IDIOMAS, Y NO HAY FORMA DE EVITARLO. El
ciclo lee los anuncios con `bot/anuncios.py` + `bot/cuando.py`; los avisos
de eventos los lee el Worker cada minuto con `bot/avisos.js`, porque
esperar al ciclo es avisar tarde (ver el encabezado de `avisos.js`). Un
Worker no corre Python.

⚠️ ESTE ARCHIVO ES EL CONTRATO. `bot/avisos_casos.json` guarda mensajes
reales de los canales de eventos y lo que Python saca de cada uno:

    python bot/avisos_casos.py --auto   ->  Python todavía da eso
    node bot/avisos_prueba.mjs          ->  el Worker da lo mismo

Los dos corren en CI. Si alguien toca el lector de un lado solo, el otro
se pone rojo — que es la diferencia entre «dos copias» y «dos copias que se
desincronizan sin avisar», la forma que este repo ya documentó cinco veces.

⚠️ SI EL CAMBIO EN PYTHON ES A PROPOSITO, se corre `--armar` y se mira el
diff del JSON: ahí se ve qué anuncios cambian de lectura. Después hay que
llevar el mismo cambio a `avisos.js` hasta que la prueba de Node pase.

⚠️ LAS MENCIONES VAN TAPADAS (`<@1>`). No cambian la lectura —
`_limpio()` las borra antes de mirar nada— y así el repo público no guarda
IDs de Discord de nadie.
"""
import io
import json
import os
import re
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
CASOS = os.path.join(SCR, 'avisos_casos.json')

import anuncios as A  # noqa: E402
import cuando as CU  # noqa: E402

#: los canales de eventos que hoy tienen anuncios, con su servidor
CANALES = [('FFA', '1487206325602484295'), ('SR', '863208020900184084'),
           ('DRA', '1501086026729521202'), ('DRA', '1500690475089399858')]

#: 🔑 LOS BORDES QUE LOS MENSAJES REALES TODAVIA NO TRAEN. Cada uno es una
#: forma que el lector de Python ya sabe leer y el de JS tiene que imitar.
INVENTADOS = [
    '# COPA DE PRUEBA\n`MODALIDAD: 1vs1`\n`HORARIO: en media hora`',
    '**• 🉐 ╎ LA GRAN FINAL ╎ 🉐 •**\n**ORGANIZADOR**: <@123>\n'
    'CUPOS: 12/16\nHORARIO: EN 2 HORAS',
    '## TORNEO SNAKE\n◾️ **INICIO DEL TORNEO**: <t:1790109000:F>\n'
    '◾️ **MODALIDAD**: 2vs2',
    'EL EVENTO\nMODALIDAD: libre\nHORARIO: en 15 ya arrancamos',
    'EL EVENTO II\nMODALIDAD: libre\nHORARIO: ya arrancamos',
    'A LAS NUEVE\nMODALIDAD: libre\nHORARIO: 21:00 hora argentina',
    'SOLO UN CAMPO\nMODALIDAD: libre',
    '▬▬▬▬▬▬▬\n# __MUY__ **NOMBRADO**\n__`ORGANIZADOR:`__ @alguien_\n'
    '__`PREMIOS:`__ **rol**\n__`HORARIO: EN 300`__',
    'ÑORGANIZADOR: x\nTITULO LARGO ' + 'X' * 90 + '\nCUPOS: 8\nRANGO: todos',
    '🔥🔥\nMODALIDAD: 4x4\nPREMIOS: nada',
    '# Evento con' + chr(0xa0) + 'espacio raro\nMODALIDAD:' + chr(0xa0) +
    'libre' + chr(0x2003) + '\nHORARIO:' + chr(0x3000) + 'EN 10 MIN',
    'NOCHE DE FREE\nhorario: en vivo\nmodalidad: libre',
    # 🔑 LOS FORMATOS DE CADA SERVIDOR (25/09/2026), calcados de los reales:
    # el lector ancho de `anuncios.campos_lineas()`. Ver su encabezado.
    '## Torneo 🏆: Plaza Underground ##\n\n## Organizador 💼: <@1>  ##\n\n'
    '## Modalidad 🆚️: 1 vs 1##\n\n## Cupos 👥️: 8 ##\n\n## Fecha 📅: Hoy ##\n\n@everyone',
    '( NITRO KINGS )\n｡.｡:+* ﾟ ゜ﾟ +:｡.｡:+ ﾟ\n〔𝐎𝐑𝐆𝐀𝐍𝐈𝐙𝐀𝐃𝐎𝐑〕: <@1>\n\n'
    '〔𝐑𝐀𝐍𝐆𝐎〕: 3\n\n〔𝐌𝐎𝐃𝐀𝐋𝐈𝐃𝐀𝐃〕: TORNEO\n\n'
    '  〔𝐈𝐍𝐈𝐂𝐈𝐎 𝐃𝐄𝐋 𝐄𝐕𝐄𝐍𝐓𝐎〕: EN 15 MINUTOS\n@everyone',
    '❪ 🗽 ❫『**__GENESIS BATTLES__**』❪ 🗽 ❫ \nFecha 6\n▰▰▰▰▰\n\n'
    ' 》<:tg2:1>   ↝**__CUPOS__**: ♾️\n\n 》🥋   ↝**__MODALIDAD__**: PANDILLAS\n'
    '》🧑‍⚖️   ↝**__ORGANIZADO POR__**: <@1> \n\n'
    ' 》<:calendario:1>   ↝**__HORA INSCRIPCIONES__**: 20:00 🇨🇱\n\n'
    '**__INICIO__**: 20:30 🇨🇱\n## FECHA 6',
    '# <:CorazonLleno:1> ¡5 VIDAS LEGENDS - Edición #5! <:CorazonLleno:1> \n'
    '▬▬▬▬▬\n\nCinco participantes.\n\n'
    '**<a:calendario:1> FECHA:** Hoy, Lunes 20 Jul.\n\n'
    '**<a:reloj_gif_UL:1> HORARIO:**\n<a:Mexico:1> 16:00\n<a:Argentina:1> 19:00\n\n'
    '<a:ping_UL:1> @everyone',
    '# 🌌 BELLAS ARTES VOL8🌌\n\n🗓️ **Detalles de la Batalla**\n\n'
    '● FECHA:  HOY PE MANO\n\n● HORA: EN 20 MINUTOS\n\n'
    '- **PREMIO** ROL CAMPEÓN, PUNTOS RANKING\n\n● FORMATO: ⚔️  1VS1\n\n'
    '- **RANGO** PLATA III🥈\n\n- **ORGANIZADOR** \n<@1> <@1> ',
    '# <:1E_Dragon1_UL:1> RAMDOM <:1E_Dragon1_UL:1> \n\n'
    'Esta competencia será al azar\n\nHORARIOS\n🇦🇷🇺🇾 | 20:30hs\n'
    '🇲🇽| 17:30 hs\n\nLas inscripciones estarán abiertas en 5 horas <#1> \n@everyone',
    '📆 - 𝐅𝐄𝐂𝐇𝐀 - 📆\n\n*<t:1788470340:d>*\n\n'
    '<:reloj_snk:1> - 𝐇𝐎𝐑𝐀 𝐈𝐍𝐒𝐂𝐑𝐈𝐏𝐂𝐈𝐎𝐍𝐄𝐒 - <:reloj_snk:1>\n\n*<t:1788470428:t>*',
    '▬▬▬▬▬\n## <:REGLAS:1> **FIRE RAP** <:REGLAS:1>\n▬▬▬▬▬\n\n'
    '📆 - 𝐅𝐄𝐂𝐇𝐀 - 📆\n\n*<t:1788470340:d>*\n\n'
    '<:organizador:1> - 𝐎𝐑𝐆𝐀𝐍𝐈𝐙𝐀𝐃𝐎𝐑 - <:organizador:1>\n\n*Velatz 🇨🇱 <@1> *\n\n'
    '<:tg:1> - 𝐂𝐔𝐏𝐎𝐒 - <:tg:1>\n\n*12/16*',
    '** • ╎<:FireP:1> _"𝐋𝐀 𝐒𝐔𝐏𝐄𝐑𝐕𝐈𝐕𝐄𝐍𝐂𝐈𝐀 𝐃𝐄𝐋 𝐌𝐀𝐒 𝐅𝐔𝐄𝐑𝐓𝐄 #4"_ ╎ • **\n'
    '💻  __`ORGANIZADOR:`__ yo\n🎫 __`CUPOS:`__ 16\n⌚ __`HORARIO:`__ aora',
    '# ***[👑] POLO RALPH LAUREN PRECICLO [👑]***\n\n'
    '⚙️*〔𝐎𝐑𝐆𝐀𝐍𝐈𝐙𝐀𝐃𝐎𝐑〕: @nachonc_ \n\n🎟️*〔𝐂𝐔𝐏𝐎𝐒〕:*16\n\n'
    ' 🎤 *〔𝐈𝐍𝐈𝐂𝐈𝐎 𝐃𝐄𝐋 𝐄𝐕𝐄𝐍𝐓𝐎〕:*apenas se llenen',
    # y lo que NO es un anuncio aunque lo parezca
    '▬▬▬▬▬\n⚜️  SUPLENTES ⚜️\n- <a:MEXICO:1> `MTZ` <a:MEXICO:1>\n▬▬▬▬▬\n'
    '⌚ __`𝐇𝐎𝐑𝐀𝐑𝐈𝐎:`__ ⭐ 5:30PM HORA MEXICO CENTRAL ⭐\n'
    '💻  __`ORGANIZADOR:`__ <@1>\n👨‍⚖️ __`JURADO:`__ <@1>\n@everyone',
    '@everyone \n\nEN 5 MINUTOS ARRANCAMOS VAYAN UNIENDOSE\n\nhttps://discord.gg/x',
    'Probando…',
    '🎉 <@1> ¡FELICIDADES! Eres el flamante **Campeón de RAPEROS DOGS** 🏆',
    '@everyone QUEDA POSTERGADA LA FECHA PARA MAÑANA',
]


def tapar(txt):
    """Las menciones sin su número: no cambian la lectura y no se guardan."""
    txt = re.sub(r'<@!?\d+>', '<@1>', txt or '')
    txt = re.sub(r'<@&\d+>', '<@&1>', txt)
    return re.sub(r'<#\d+>', '<#1>', txt)


def leer(m):
    """Lo que Python saca de un mensaje: lo mismo que tiene que dar el JS."""
    a = A.parsear(m, 'X', 'x')
    return {
        'es': bool(a),
        'nombre': a['nombre'] if a else '',
        'horario': a['horario'] if a else '',
        'ini': CU.momento(a) if a else None,
    }


def armar():
    s = A._sesion()
    casos = []
    for sv, cid in CANALES:
        r = s.get('https://discord.com/api/v10/channels/%s/messages' % cid,
                  params={'limit': 15}, timeout=25)
        if r.status_code != 200:
            print('  %s: %d' % (sv, r.status_code))
            continue
        for m in r.json():
            casos.append({'sv': sv, 'id': m['id'], 'timestamp': m['timestamp'],
                          'content': tapar(m.get('content'))})
    for i, t in enumerate(INVENTADOS):
        casos.append({'sv': 'INV', 'id': 'inv%d' % i,
                      'timestamp': '2026-09-24T20:00:00.000000+00:00',
                      'content': t})
    for c in casos:
        c['espera'] = leer(c)
    with io.open(CASOS, 'w', encoding='utf-8') as f:
        json.dump({'casos': casos}, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('%d casos (%d anuncios) -> %s' % (
        len(casos), sum(1 for c in casos if c['espera']['es']),
        os.path.relpath(CASOS, BASE)))


def auto():
    with io.open(CASOS, encoding='utf-8') as f:
        casos = json.load(f)['casos']
    mal = 0
    for c in casos:
        hoy = leer(c)
        if hoy != c['espera']:
            mal += 1
            print('  ❌ %s %s\n     anotado %s\n     hoy     %s'
                  % (c['sv'], c['id'], c['espera'], hoy))
    anuncios = sum(1 for c in casos if c['espera']['es'])
    if mal:
        print('❌ %d de %d casos cambiaron de lectura en Python.' % (mal, len(casos)))
        print('   Si fue a propósito: `--armar`, mirar el diff, y llevar el')
        print('   mismo cambio a bot/avisos.js hasta que pase la prueba de Node.')
        return 1
    print('✅ Python lee los %d casos como están anotados (%d anuncios).'
          % (len(casos), anuncios))
    # que los casos cubran algo: si alguien los vacía, la prueba de Node
    # pasaría sin comparar nada
    assert len(casos) >= 30 and anuncios >= 15, 'muy pocos casos'
    assert any(c['espera']['ini'] is None and c['espera']['es'] for c in casos)
    assert any('<t:' in (c['espera']['horario'] or '') for c in casos)
    return 0


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--armar' in sys.argv:
        armar()
    sys.exit(auto())
