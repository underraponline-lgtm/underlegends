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
    ('MULTIVERSE: solo o en equipo de cualquier tamaño, 8v1, 2v2 y 1v3 (Dlx, 28/09/2026)',
     '# ▪️ [•CUARTOS DE FINAL•]\n'
     '▪️   [ALFA 🇦🇷 + BRAVO 🇨🇱 + CHARLIE 🇨🇴 + DELTA 🇻🇪 + ECO 🇵🇪 + FOX 🇲🇽 + GOLF 🇪🇸'
     ' + HOTEL 🇺🇾] 🆚 [SOLO 🇦🇷]\n'
     '▪️   [UNO 🇨🇴 + DOS 🇨🇱] 🆚 [TRES 🇻🇪 + CUATRO 🇵🇪]\n'
     '▪️   [CINCO 🇦🇷] 🆚 [SEIS 🇲🇽 + SIETE 🇪🇸 + OCHO 🇺🇾]\n'
     'SIN MARCO + CON UNO + Y OTRO + Y OTRO MAS 🆚 SUELTO\n'
     '# ▪️ [• FINAL•]\n'
     '# ▪️ [ALFA 🇦🇷 + BRAVO 🇨🇱 + CHARLIE 🇨🇴 + DELTA 🇻🇪 + ECO 🇵🇪 + FOX 🇲🇽 + GOLF 🇪🇸'
     ' + HOTEL 🇺🇾]  🆚 [TRES 🇻🇪 + CUATRO 🇵🇪]\n'),
    ('Urban Freestyle: `[ CYPHER ]` con grupos de tres antes de los cuartos (POESÍA CRUDA, 01/10/2026)',
     '# [ 𝓟𝓞𝓔𝓢Í𝓐 𝓒𝓡𝓤𝓓𝓐 🖊️ ]\n\n`[ CYPHER ]`\n'
     '⌞PICHULAMC 🇦🇷⌝   vs.   ⌞Júpiter 🇲🇽⌝  vs.   ⌞Riferian 🇵🇦⌝\n'
     '⌞⌝   vs.   ⌞  ⌝  vs.   ⌞  ⌝\n'
     '⌞Bsk 🇦🇷⌝   vs.   ⌞Cinexfilo 🇻🇪⌝  vs.   ⌞El Hombre Eyau 🇦🇷⌝\n\n'
     '`[ CUARTOS ]`\n⌞PICHULAMC 🇦🇷⌝   vs.   ⌞Júpiter 🇲🇽⌝\n⌞⌝   vs.   ⌞  ⌝\n\n'
     '`[ FINAL ]`\n ⌞⌝   vs.   ⌞  ⌝\n\n@everyone\n'),
    ('FFA: el refuerzo adentro del marco y la «R» suelta (VOL 18 2VS2, 30/09/2026)',
     '# ▪️ [•OCTAVOS DE FINAL•]\n'
     '▪️   [PICHULITA 🇦🇷 + SIX 🇦🇷 R] 🆚 [CRONOX 🇨🇱 + RICKYFORT 🇦🇷 R]\n'
     '▪️   [ABYSSUS 🇨🇦 + OASIS 🇨🇦] 🆚 [NC 🇦🇷 + GOCHO 🇨🇴 R]\n'
     '# ▪️ [• FINAL•]\n'
     '# ▪️ [(EZE 🇦🇷) PICHULITA 🇦🇷 + SIX 🇦🇷]  🆚 [OASIS 🇨🇦 + ABYSSUS 🇨🇦 (ZIGNOS 🇩🇴)]\n'),
    ('Urban Freestyle: -SEMI FINALES-, en plural y con espacio (28/09/2026)',
     '## COMPE DEL VACILE #1🤙\n## -CUARTOS-\n'
     '**{Cinexfilo🇻🇪} VS {Steven🇨🇴}**\n**{Yeyox🇲🇽} VS {Panchok 🇨🇱}**\n'
     '## -SEMI FINALES-\n**{Cinexfilo🇻🇪} VS {Panchok🇨🇱}**\n'
     '## -FINAL-\n**{Juasmio🇨🇴} VS {Panchok🇨🇱}**\n'),
    ('Urban Freestyle: marcos con llaves {x}, COMPE DEL VACILE #1 (28/09/2026)',
     '## COMPE DEL VACILE #1🤙\n# -----------------------------\n## -OCTAVOS-\n'
     '**{MHS🇦🇷} VS {Cinexfilo🇻🇪}**\n**{Adachi 🇻🇪} VS {Steven🇨🇴}**\n'
     '# -----------------------------\n## -CUARTOS-\n'
     '**{Cinexfilo🇻🇪} VS {Steven🇨🇴}**\n**{Juasmio🇨🇴} VS {}**\n'
     '## -FINAL-\n**{} VS {}**\n**CAMPEÓN 🏆:**\n'),
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
    ('FFA: el podio con medallas al pie (`🏆 |X`) y la 🥉 sola de encabezado (ONE PIECE, 30/09)',
     '# ••• SEMIFINALES •••\n•••[Ana 🇦🇷] VS [Bea 🇨🇱]•••\n\n•••[Cami 🇻🇪] VS [Dora 🇲🇽]•••\n▬▬▬▬▬▬\n# ••• 🥉  •••\n•••[Bea 🇨🇱] VS [Dora 🇲🇽]•••\n▬▬▬▬▬▬\n# 🔱☄️   ••• FINAL ••• ☄️ 🔱\n•••[Ana 🇦🇷] VS [Cami 🇻🇪]•••\n▬▬▬▬▬▬\n\n# 🏆  |Cami 🇻🇪\n## 🥈 |Ana 🇦🇷 \n### 🥉 |Bea 🇨🇱 + Dora 🇲🇽'),
    ('FFA: el cruce que espera rival, `⌞Geoka⌝ VS ⌞⌝`, no se pega con el de abajo (Dos Generaciones Vol 2, 01/10)',
     '`[ CUARTOS ]`\n\n⌞Soneto 🇪🇨⌝  <:VSF:17>  ⌞Oasis🇨🇱⌝ \n⌞Six🇦🇷⌝  <:VSF:17>  ⌞Sosa🇨🇱⌝ \n⌞Geoka 🇦🇷⌝  <:VSF:17>  ⌞⌝\n⌞Cinexfilo 🇻🇪⌝  <:VSF:17>  ⌞⌝  \n\n`[ SEMIFINALES ]`\n\n⌞⌝ <:VSF:17> ⌞⌝\n⌞⌝ <:VSF:17> ⌞⌝\n'),
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
    # ⚠️ LOS DE #VEREDICTOS SE QUEDAN: no salen de un barrido de llaves
    try:
        with io.open(CASOS, encoding='utf-8') as f:
            ver = json.load(f).get('veredictos') or []
    except (OSError, ValueError):
        ver = []
    with io.open(CASOS, 'w', encoding='utf-8', newline='\n') as f:
        json.dump({'_leeme': 'El contrato entre escuchar.py y bot/paginas/llave_vivo.js. '
                             'Se rehace con `python bot/llaves_casos.py --armar <scan>`; '
                             'los de #veredictos, con `--veredictos <que> <filas.json>`.',
                   'casos': casos, 'veredictos': ver}, f, ensure_ascii=False, indent=1)
    print('%d casos en %s' % (len(casos), os.path.relpath(CASOS, BASE)))


def vidas(filas):
    """Lo que la página tiene que leer igual de #veredictos: cada evento de
    vidas con sus batallas `[[A, B], ganador, nota]`, en orden."""
    return [{'n': e['n'], 'ronda': e['ronda'], 'terminada': e['terminada'],
             'batallas': [[list(b[0]), b[1], b[2]] for b in e['batallas']]}
            for e in E.veredictos(filas)]


def armar_veredictos(que, archivo):
    """Agrega (o rehace) un caso de #veredictos desde un json de filas
    `{id, canal, sv, g, autor, pub, ed, texto}`.

    ⚠️ LOS AUTORES VAN TAPADOS (`j1`, `j2`…), como las menciones: el repo es
    público, y para el lector sólo importa que sean distintos.
    """
    with io.open(archivo, encoding='utf-8') as f:
        filas = json.load(f)
    alias = {}
    for x in filas:
        x['autor'] = 'j%d' % alias.setdefault(x.get('autor') or '', len(alias) + 1) \
            if x.get('autor') else ''
        x['texto'] = tapar(x.get('texto') or '')
    with io.open(CASOS, encoding='utf-8') as f:
        d = json.load(f)
    ver = [c for c in d.get('veredictos') or [] if c['que'] != que]
    ver.append({'que': que, 'filas': filas, 'eventos': vidas(filas)})
    d['veredictos'] = ver
    with io.open(CASOS, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(d, f, ensure_ascii=False, indent=1)
    print('%d caso(s) de veredictos en %s' % (len(ver), os.path.relpath(CASOS, BASE)))


#: 🔑 LAS NAVES DE FUNA QUE PASÓ DLX (29/09/2026): la fase de eliminación y el
#: podio con medallas, que la página tiene que leer igual que el ciclo. Son de
#: la pre-temporada y los nombres son los de las capturas; el rol del aviso
#: va con un id inventado.
FUNA = [
    ('Anything Goes Vol.15: 『』, sin ❌, final de tres y CAMPEON/SUBCAMPEON/TERCER LUGAR',
     '⚕️Anything Goes. Vol.15 Nave de Funa⚕️\n\n<@&1> ▋\n\n[ FASE DE ELIMINACIÓN ]\n\n'
     '『 Xplicit🇨🇱』\n『Rbk 🇻🇪』\n『Mco 🇦🇷』\n『Corrta🇯🇵』\n『Argenfifa🇦🇷』\n'
     '『sin limites🇵🇪』\n『Roda🇦🇹』\n『Khalil 🇨🇱』\n『 Matioo 🇪🇨 』\n『Laura 🇦🇷 』\n'
     '『Trot🇪🇸』\n『Kyle🇵🇪』\n『Kinkross🇪🇸』\n『NC🇦🇷』\n\n[ FINAL ]\n\n'
     '⌞ Argenfifa 🇦🇷 ⌝ 🆚 ⌞ NC🇦🇷 ⌝ 🆚 ⌞ sin limites🇵🇪 ⌝\n\n<@&1> ▋\n\n'
     'CAMPEON: NC🇦🇷\nSUBCAMPEON: sin limites🇵🇪\nTERCER LUGAR: Argenfifa 🇦🇷'),
    ('Revo 2/5: «1 - [x] ❌», final de dos y el podio con medallas',
     'nave de funa:\n\n1 - [Black demon] ❌\n2 - [Darkomc] ❌\n3 - [Saiko] ❌\n4 - [Tam]\n'
     '5 - [Corazón de fleiva] ❌\n6 - [Diego] ❌\n7 - [Joba] ❌\n8 - [silence] ❌\n9 - [multi]\n'
     '10 - [Chekerau] ❌\n11 - [Guess]\n12 - [xubaru] ❌\n13 - [kyron] ❌\n14 - [dnk] ❌\n'
     '15 - [mussito] ❌\n16 - [rodopro] ❌\n\nFinal\n\n[Guess] 🆚 [tam]\n\n🥇 tam\n🥈 guess\n🥉 multi'),
    ('Revo 15/5: la cita de Discord, «⌞ x ⌝❌» y sin podio todavía',
     '[ NAVE DE FUNA ]\n\n<@&1> ▋\n\n[ FASE DE ELIMINACIÓN ]\n\n> ⌞ Dnk🇦🇷 ⌝ ❌\n'
     '> ⌞ Pwopwo🇦🇷 ⌝❌\n> ⌞ Heat🇵🇷 ⌝\n> ⌞ Sombra🇵🇷 ⌝\n> ⌞ Xubaru🇻🇪 ⌝ ❌\n> ⌞ Dryk🇵🇪 ⌝❌\n'
     '> ⌞ Blue🇵🇦 ⌝ ❌\n> ⌞ Bonais🇻🇪 ⌝ ❌\n> ⌞ Arkane🇵🇷 ⌝\n> ⌞ Valentin🇦🇷 ⌝ ❌\n'
     '> ⌞ Rodas🇵🇷 ⌝ ❌\n> ⌞ Nz🇲🇽 ⌝ ❌\n\n[ FINAL ]\n\n⌞ Heat🇵🇷 ⌝ 🆚 ⌞ Arkane🇵🇷 ⌝\n\n<@&1> ▋'),
]


def funa(texto):
    """Lo que la página tiene que leer igual de una nave de funa."""
    fu = E.funa_de(texto)
    return {'fase': [[n, c] for n, c in fu] if fu else None,
            'medallas': {str(k): v for k, v in sorted(E.medallas_de(texto).items())}}


def armar_funa():
    """Rehace la lista `funa` del contrato, sin tocar las demás."""
    with io.open(CASOS, encoding='utf-8') as f:
        d = json.load(f)
    d['funa'] = [dict({'que': q, 'texto': t}, **funa(t)) for q, t in FUNA]
    with io.open(CASOS, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(d, f, ensure_ascii=False, indent=1)
    print('%d caso(s) de nave de funa en %s' % (len(d['funa']), os.path.relpath(CASOS, BASE)))


def _self_check():
    with io.open(CASOS, encoding='utf-8') as f:
        d = json.load(f)
    casos = d['casos']
    mal = 0
    print('\n══ el lector de llaves: Python contra lo anotado ══\n')
    for c in casos:
        ok = rondas(c['texto']) == c['rondas']
        mal += not ok
        print('   %s %s' % ('✅' if ok else '🔴', c['que']))
    for c in d.get('veredictos') or []:
        ok = vidas(c['filas']) == c['eventos']
        mal += not ok
        print('   %s veredictos: %s' % ('✅' if ok else '🔴', c['que']))
    for c in d.get('funa') or []:
        ok = funa(c['texto']) == {'fase': c['fase'], 'medallas': c['medallas']}
        mal += not ok
        print('   %s nave de funa: %s' % ('✅' if ok else '🔴', c['que']))
    print('')
    return mal


if __name__ == '__main__':
    if '--auto' in sys.argv:
        sys.exit(1 if _self_check() else 0)
    if '--armar' in sys.argv:
        armar(sys.argv[sys.argv.index('--armar') + 1])
        sys.exit(0)
    if '--veredictos' in sys.argv:
        i = sys.argv.index('--veredictos')
        armar_veredictos(sys.argv[i + 1], sys.argv[i + 2])
        sys.exit(0)
    if '--funa' in sys.argv:
        armar_funa()
        sys.exit(0)
    print(__doc__)
