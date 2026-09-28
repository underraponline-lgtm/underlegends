# -*- coding: utf-8 -*-
"""LO QUE ATA AL LECTOR DE LLAVES DE PYTHON CON EL DE LA PÁGINA (EN VIVO).

    python bot/llaves_casos.py --auto              Python sigue dando lo anotado (CI)
    python bot/llaves_casos.py --armar <scan>      rehace los casos desde un barrido guardado

🔑 LAS LLAVES EN VIVO SE LEEN EN EL NAVEGADOR. Dlx, 27/09/2026: *«llaves en
vivo… como las notificaciones, que se chequean cada 1 minuto»*. El vigía del
Worker guarda cada minuto el texto de las llaves que se están jugando —sin
leerlas: el Worker tiene 10 ms— y la página las lee con
`bot/paginas/llave_vivo.js`, una copia en JS de las reglas de
`escuchar.traducir()` y `escuchar.rondas_de()`.

⚠️ ESTE ARCHIVO ES EL CONTRATO, igual que `bot/avisos_casos.py` para los
anuncios. `bot/llaves_casos.json` guarda llaves reales —de FFA, Snake Rap y
Urban Freestyle— y las rondas que Python saca de cada una:

    python bot/llaves_casos.py --auto   ->  Python todavía da eso
    node bot/llave_vivo_prueba.mjs      ->  la página da lo mismo

Si alguien toca el lector de un lado solo, CI se pone rojo en el otro.

⚠️ SÓLO LAS RONDAS, NO LOS PUNTOS NI LOS GANADORES DUDOSOS. La llave en vivo
no suma nada —los puntos siguen saliendo del ciclo— y el que decide quién
pasó con parecidos y con el padrón es Python. Lo que la página tiene que
leer igual es la forma: qué rondas hay y quiénes pelean en cada batalla.

⚠️ LAS MENCIONES VAN TAPADAS (`<@1>`): el repo es público.
"""
import io
import json
import os
import re
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass
CASOS = os.path.join(SCR, 'llaves_casos.json')

import escuchar as E  # noqa: E402

#: 🔑 FORMAS QUE LAS LLAVES REALES TODAVÍA NO TRAEN, recortadas del
#: self-check de `escuchar.py`: cada una es algo que el lector ya sabe leer.
INVENTADOS = [
    ('Snake Rap: marcos 「」 y el equipo sin +',
     '🗽 __**GENESIS BATTLES**__ 🗽\n╭──╯  <:EYE:1> 𝙲𝚄𝙰𝚁𝚃𝙾𝚂 <:EYE:1> ╰──╮\n'
     '**「HASSAN🇦🇷」**<:VS6:2>「RAYITO🇲🇽」<:VS6:2>**「ABYSSUS🇵🇦」**\n'
     '╭──╯ <:coronavacia:3> 𝙵𝙸𝙽𝙰𝙻 <:coronavacia:3> ╰──╮\n'
     '**「HASSAN🇦🇷 ABYSSUS🇵🇦」**<:VS6:2>「DYNOCO🇦🇷 **GEOKA🇦🇷」**\n'
     '◆ <:1erPuesto:4> HASSAN🇦🇷 ABYSSUS🇵🇦\n'),
    ('Snake Rap: el cuarto entre paréntesis y el tercer puesto de encabezado',
     '🎙️ __**RAP EXHIBITION 1/8**__ 🎙️\n➠ 『CUARTOS』\n'
     '●[ tkl ]<:ins:6>[ cardozo ]<:ins:6>[ deluxe ] <:ins:6> ( MCO ) \n'
     '➠ 『SEMIFINAL』\n➢ 〈ANTORCHA OLÍMPICA〉<:VS1:12>〈POLLO SPORT〉\n'
     '➢ 〈LZZ〉<:VS1:12>〈ZETA〉\n➠ 『3er Y 4º PUESTO』\n\n➢ 〈POLLO SPORT〉<:VS1:12>〈LZZ〉\n'
     '➠ 『FINAL』\n➢ 〈ANTORCHA OLÍMPICA〉<:VS1:12>〈ZETA〉\n'),
    ('FFA: la bandera en emoji propio y el refuerzo entre paréntesis',
     '# DESGRACIAS EN TOKYO VOL.13\n`[ SEMIFINALES ]`\n'
     '⌞MAKMA 🇻🇪 + SNOW 🇨🇴⌝ 🆚 ⌞NEO 🇦🇷 + ENEK 🇪🇸⌝\n'
     '[PRR 🇦🇴] [SIX 🇦🇷] 🆚 [SNOW 🇨🇴] [VELATZ 🇨🇱]\n'
     '⌞fokox⌝ <:VSF:17> ⌞Sin limites⌝ <:VSF:17> nhp\n'
     '`[ FINAL ]`\n「Number <a:Uruguay:14>」<:1E_Bandido_UL:15>「Guess <a:ARG:16>」\n'
     '**CAMPEON:**Hassan🇪🇬 +\n(BLOODY) [Cj] [Zignos]'),
    ('Urban Freestyle: equipos con espacios',
     '# CUARTOS\nHASSAN 🆚 GUTY\nSEBITAS 🆚 AGUSTIN\nPOLLO SPORT 🆚 NC\nPOLLO 🆚 MIA\n'
     '# FINAL\nHASSAN SEBITAS 🆚 POLLO SPORT\n'),
    # 🔴 los huecos de la plantilla no son nombres (SEVEN STREET DUPLAS, 27/09)
    ('FFA: la plantilla a medio llenar, con los huecos vacíos',
     '`[ CUARTOS ]`\n\n**⌞Abyssus🇵🇦  + Erian🇵🇦⌝**  <:VSF:17>  ⌞Geekto🇦🇷 + **Lewito🇦🇷⌝ **\n⌞EIDP🇺🇾 + **Bloddy🇨🇴⌝**  <:VSF:17>  **⌞Hassan🇦🇷 + Molusco🇦🇷⌝ **\n\n`[ SEMIFINALES ]`\n\n**⌞Abyssus🇵🇦 + Erian🇵🇦 + Lewito🇦🇷⌝** <:VSF:17> ⌞  ⌝\n⌞⌝  <:VSF:17>  ⌞⌝\n\n`[ 3ER PUESTO ]`\n\n⌞ + ⌝  <:VSF:17>  ⌞ + ⌝\n\n`[ FINAL ]`\n\n［ ］ 𝙑𝙎 ［ ］\n'),
    ('FFA: el negrito entre la bandera y el &',
     '▪️ **⚖️[•CUARTOS DE FINAL•]📰**\n'
     '▪️   [**FULLY🇨🇱&DXG🇲🇽**] 📰 [SCOT🇦🇷&TRRRR🇯🇲]\n'
     '▪️**📰[•SEMI - FINAL•]⚖️**\n'
     '▪️   [**FULLY🇨🇱**&DXG🇲🇽] ⚖️ [**SNOW🇨🇴**&VELATZ🇨🇱]\n'
     '▪️**👨🏻‍⚖️[•GRAN - FINAL•]🔚**\n'
     '▪️   [FULLY🇨🇱&SNOW🇨🇴] 📰 [MAKMA🇻🇪&PRRR🇦🇴]\n'),
]


def rondas(texto):
    """Lo que la página tiene que leer igual: `[[ronda, [[lados…]…]]…]`."""
    return [[r, [list(b) for b in bs]] for r, bs in E.rondas_de(E.traducir(E.plano(texto)))]


def tapar(texto):
    """Las menciones tapadas, numeradas en el orden en que aparecen."""
    ids = {}
    return re.sub(r'<@!?(\d+)>', lambda m: '<@%d>' % ids.setdefault(m.group(1), len(ids) + 1),
                  texto or '')


def armar(scan):
    """Los casos, desde un barrido guardado (`{servidores: {sv: {canales, hilos}}}`)."""
    with io.open(scan, encoding='utf-8') as f:
        d = json.load(f)
    casos = []
    for sv in ('FFA', 'SR', 'URBF'):
        info = (d.get('servidores') or {}).get(sv) or {}
        vistos = 0
        for c in (info.get('canales') or []) + (info.get('hilos') or []):
            if 'llave' not in (c.get('name') or '').lower() and 'llave' not in \
                    __import__('unicodedata').normalize('NFKD', c.get('name') or '').lower():
                continue
            for m in c.get('mensajes') or []:
                t = tapar(m.get('content') or '')
                if not E.es_llave(E.traducir(E.plano(t))) or vistos >= 5:
                    continue
                casos.append({'que': '%s · %s' % (sv, m.get('id')), 'texto': t, 'rondas': rondas(t)})
                vistos += 1
    for que, t in INVENTADOS:
        casos.append({'que': que, 'texto': t, 'rondas': rondas(t)})
    with io.open(CASOS, 'w', encoding='utf-8', newline='\n') as f:
        json.dump({'_leeme': 'El contrato entre escuchar.py y bot/paginas/llave_vivo.js. '
                             'Se rehace con `python bot/llaves_casos.py --armar <scan>`.',
                   'casos': casos}, f, ensure_ascii=False, indent=1)
    print('%d casos en %s' % (len(casos), os.path.relpath(CASOS, BASE)))


def _self_check():
    with io.open(CASOS, encoding='utf-8') as f:
        casos = json.load(f)['casos']
    mal = 0
    print('\n══ el lector de llaves: Python contra lo anotado ══\n')
    for c in casos:
        ok = rondas(c['texto']) == c['rondas']
        mal += not ok
        print('   %s %s' % ('✅' if ok else '🔴', c['que']))
    print('')
    return mal


if __name__ == '__main__':
    if '--auto' in sys.argv:
        sys.exit(1 if _self_check() else 0)
    if '--armar' in sys.argv:
        armar(sys.argv[sys.argv.index('--armar') + 1])
        sys.exit(0)
    print(__doc__)
