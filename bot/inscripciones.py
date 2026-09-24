# -*- coding: utf-8 -*-
"""QUIEN SE INSCRIBIO, CON SU DISCORD ID VERIFICADO.

    python bot/inscripciones.py            que encontro, sin escribir nada
    python bot/inscripciones.py --canales  solo el ranking de canales
    python bot/inscripciones.py --auto     el self-check

🔴 POR QUE ESTO VALE MAS QUE CUALQUIER ALGORITMO DE NOMBRES.

Una inscripcion es **un mensaje que escribio la propia persona**, asi que
el `author.id` es su **Discord ID firmado por Discord**. Exacto, sin
adivinar.

Y esa es la unica forma de conseguirlo. Medido el 21/09/2026 cruzando los
**371 del padron sin Discord ID** contra los 2.705 miembros de DRA:

    coincidencia exacta y unica     11  ( 3 %)
    exacta pero AMBIGUA             10
    parecida (>=0.86)               27
    sin nada parecido              323  (87 %)

El 3 %. Por el canal, el 100 % — y sin margen de error, porque no es un
parecido sino la cuenta que escribio. El caso que lo muestra: `tnor` se
inscribe desde la cuenta `tenor_25499`. Ningun algoritmo une eso.

EL CANAL SE RECONOCE POR SU FORMA, NO POR SU NOMBRE
----------------------------------------------------
Una inscripcion es *una palabra*: no tiene firma propia como la llave.
Pero el canal si — cada uno escribe UNA vez, corto, y muchos con bandera.

Medido sobre los 72 canales con actividad de personas:

    FFA  ✦📝︱inscripciones          0,647
    DRA  〢🥇〉competenciasᵀᴵᴱᴿ¹      0,441
    DRA  〢🥈〉competenciasᵀᴵᴱᴿ²      0,352
    ── salto ──
         💬 chat-general            0,150

**Los tres de arriba son los tres reales**, y el cuarto esta a menos de
la mitad. Y otra vez el nombre no servia: los de DRA se llaman
`competenciasᵀᴵᴱᴿ¹`, no «inscripciones».

⚠️ **LA SEPARACION ES BUENA PERO NO ES LA DE LAS LLAVES.** El detector de
llaves da 28 de 1.728 con cero falsos positivos; este da un puntaje
continuo con un salto de 2,3x. Por eso lo que sale de aca **no se
escribe en el padron sin confirmar** — ver abajo.

QUE CONFIRMA UNA INSCRIPCION: HABER COMPETIDO
-----------------------------------------------
En el mismo canal hay charla mezclada. De la muestra real de DRA:

    saiko 🇨🇱            <- inscripcion
    te imaginas         <- charla, del MISMO autor
    Kourier 🇲🇽          <- inscripcion
    CHECk estoy haciendo una prueba pero...   <- charla del organizador

La bandera separa la mitad y el resto es ambiguo. Pero hay una prueba que
no es heuristica: **si esa persona aparece despues en la llave, compitio**.
Eso no es un parecido, es evidencia. Por eso `cruzar()` marca como
`confirmada` solo a quien aparece en el plantel de una llave del mismo
servidor, y el resto queda en `dudosa`.

⚠️ **EL TROLEO NO ROMPE ESTO, Y CONVIENE SABER POR QUE.** Dlx: *«a veces
la gente trollea y pone akas tontos y banderas falsas»*. Un AKA tonto
sigue siendo **su** AKA atado a **su** ID: como se quiera llamar es
moderacion, no un problema de datos. La **bandera falsa si importa** —de
ahi salen la carta de Pais y el OVR Nacional— y por eso, cuando la
persona ya tiene pais en el padron y declara otro, esto **no lo pisa**:
lo manda a `Pendientes`.
"""
import collections
import re
import statistics
import sys
import os
import time
import unicodedata

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)
sys.path.insert(0, os.path.join(BASE, 'sheet'))
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

import escuchar as E                                     # noqa: E402

BANDERA = re.compile('([\U0001F1E6-\U0001F1FF]{2})')
EMOJI_P = re.compile(r'<a?:(\w+):\d+>')
ABIERTAS = re.compile(r'inscri\w*\s+(abiert|open)', re.I)

# el corte del puntaje de canal. El cuarto candidato real esta en 0,150 y
# el tercero verdadero en 0,352: 0,30 cae en el medio del salto.
CORTE = 0.30
# menos que esto no alcanza para juzgar la forma del canal
MIN_MSJ = 6


def _bandera(txt):
    """El codigo de pais de dos letras, de un emoji unicode o uno del server.

    ⚠️ LOS DOS CAMINOS HACEN FALTA. Medido: 47 % usa la bandera unicode y
    hay quien usa el emoji PERSONALIZADO del servidor —
    `Kravitz<a:COSTARICA:1340260308148555826>`—, donde el pais esta en el
    NOMBRE del emoji y no en el caracter.
    """
    m = BANDERA.search(txt or '')
    if m:
        # 🇦🇷 son dos «regional indicator»: restarles el offset da AR
        return ''.join(chr(ord(c) - 0x1F1E6 + ord('A')) for c in m.group(1))
    for nom in EMOJI_P.findall(txt or ''):
        n = unicodedata.normalize('NFKD', nom).upper()
        if len(n) >= 4 and n.isalpha():
            return n            # 'COSTARICA' — se resuelve contra el padron
    return None


def _aka(txt):
    """El nombre, sin la bandera ni adornos. '' si no parece un nombre."""
    t = BANDERA.sub(' ', txt or '')
    t = EMOJI_P.sub(' ', t)
    t = re.sub(r'<@[&!]?\d+>|@everyone|@here', ' ', t)
    t = ''.join(c for c in t if not (0x1F000 <= ord(c) <= 0x1FAFF))
    t = re.sub(r'[*_`~|#>]', ' ', t)
    return re.sub(r'\s+', ' ', t).strip()


def parece_inscripcion(txt):
    """(bool, motivo). Una inscripcion es un nombre corto, no una frase."""
    t = (txt or '').strip()
    if not t:
        return False, 'vacío'
    if '@everyone' in t or '@here' in t or '<@&' in t:
        return False, 'aviso del organizador'
    if ABIERTAS.search(t):
        return False, 'abre la inscripción'
    aka = _aka(t)
    if not aka:
        # sólo bandera, sin nombre
        return False, 'sin nombre'
    if len(aka) > 28:
        return False, 'demasiado largo'
    # ⚠️ TRES PALABRAS YA ES UNA FRASE. Medido en la muestra de DRA: las
    # inscripciones son de una o dos (`saiko`, `LIL DRAKO`, `Mco`) y la
    # charla de tres para arriba (`te imaginas` pasa, y por eso hace falta
    # el cruce con la llave — ver `cruzar()`).
    if len(aka.split()) > 3:
        return False, 'parece una frase'
    return True, 'nombre corto'


def _clase_de(guild_id):
    """'liga', 'identidad' o 'desconocido'. Sale de datos/servidores.json."""
    import io as _io
    import json as _json
    p = os.path.join(BASE, 'datos', 'servidores.json')
    try:
        with _io.open(p, encoding='utf-8') as f:
            d = _json.load(f)
    except (OSError, ValueError):
        return 'desconocido'
    for grupo, etiqueta in (('servidores', 'liga'),
                            ('solo_identidad', 'identidad')):
        for v in (d.get(grupo) or {}).values():
            if isinstance(v, dict) and str(v.get('guild_id')) == str(guild_id):
                return etiqueta
    return 'desconocido'


def puntaje_canal(msgs):
    """Que tan «canal de inscripciones» es. Ver el encabezado."""
    ms = [m for m in msgs if not (m.get('author') or {}).get('bot')]
    if len(ms) < MIN_MSJ:
        return 0.0
    autores = {(m.get('author') or {}).get('id') for m in ms}
    largos = [len((m.get('content') or '').strip()) for m in ms]
    cortos = sum(1 for l in largos if 0 < l <= 30)
    conb = sum(1 for m in ms if _bandera(m.get('content') or ''))
    unicos = len(autores) / float(len(ms))
    return unicos * (cortos / float(len(ms))) * (0.4 + conb / float(len(ms)))


def barrer(s, por_canal=40):
    """[(servidor, canal, puntaje, [inscripciones])] de todo lo que hay.

    ⚠️ LA LISTA DE CANALES SALE DE `escuchar._canales()`, no de acá. Era
    la misma enumeración escrita dos veces —guilds, canales, filtrar por
    `type in (0, 5)`— y este repo ya tiene medido lo que cuesta eso: el
    fallback de los escudos vivía triplicado, a `gencomp.py` le faltó, y
    un `KeyError: 'URBF'` tumbó las 138 cartas por 2 personas. Dos copias
    de un recorrido es una copia que un día mira un canal menos.

    ⚠️ ACÁ SÍ SE MIRA TODO, SIEMPRE. `escuchar` alterna cadencias porque
    ya sabe dónde aparecen las llaves; los canales de inscripción todavía
    no están medidos y este comando existe justamente para encontrarlos.
    """
    out, n_ch = [], 0
    for cid, canal, servidor, guild in E._canales(s):
        c = {'id': cid, 'name': canal}
        g = {'id': guild, 'name': servidor}
        n_ch += 1
        rr = s.get('https://discord.com/api/v10/channels/%s/messages'
                   % cid, params={'limit': por_canal}, timeout=30)
        if rr.status_code != 200:
            continue
        ms = rr.json()
        p = puntaje_canal(ms)
        ins = []
        if p >= CORTE:
            for m in ms:
                if (m.get('author') or {}).get('bot'):
                    continue
                txt = m.get('content') or ''
                ok, _ = parece_inscripcion(txt)
                if not ok:
                    continue
                ins.append({
                    'discord_id': (m.get('author') or {}).get('id'),
                    'usuario': (m.get('author') or {}).get('username'),
                    'aka': _aka(txt),
                    'cc': _bandera(txt),
                    'guild': g['id'], 'servidor': g['name'],
                    # 🔴 DE QUE CLASE DE SERVIDOR VIENE, Y NO ES UN
                    # DETALLE. LIVONIA y CONFED estan en
                    # `solo_identidad` — *«para: sacar Discord ID,
                    # nada mas»*—: el bot esta ahi para leer quien es
                    # quien, no para tomar sus eventos.
                    #
                    # ⚠️ El Discord ID de una inscripcion suya SIRVE
                    # igual: es identidad, que es justo para lo que
                    # esta el bot ahi. El **AKA** es lo dudoso — como
                    # se llama alguien en su servidor no tiene por
                    # que ser su nombre en la Liga— asi que viaja
                    # etiquetado y quien escriba el padron decide.
                    #
                    # Hoy no se da el caso: los tres canales
                    # detectados son de FFA y DRA. Se etiqueta ahora
                    # para que el dia que pase sea una decision y no
                    # un descuido.
                    'clase': _clase_de(g['id']),
                    'canal': c['name'], 'cuando': m.get('timestamp'),
                })
        out.append({'servidor': g['name'], 'canal': c['name'],
                    'canal_id': c['id'], 'guild': g['id'],
                    'puntaje': p, 'inscripciones': ins})
        time.sleep(0.05)
    return out, n_ch


def cruzar(inscripciones, llaves):
    """Marca `confirmada` a quien despues aparece compitiendo en una llave.

    🔴 ESTO NO ES UNA HEURISTICA MAS, ES EVIDENCIA. La charla mezclada en
    el canal se parece a una inscripcion —`te imaginas` son dos palabras
    cortas— y ningun filtro de texto la separa del todo. Pero quien
    **compitio** aparece en el plantel, y quien tiro una frase al aire no.
    """
    import llaves_a_entrada as L
    por_guild = collections.defaultdict(set)
    for h in llaves:
        por_guild[h['guild']] |= L.plantel(h['texto'])
    for i in inscripciones:
        i['confirmada'] = E.norm(i['aka']) in por_guild.get(i['guild'], set())
    return inscripciones


def _self_check():
    casos = [
        ('un nombre con bandera', 'Cinexfilo 🇻🇪', True),
        ('un nombre solo', 'tnor', True),
        ('dos palabras', 'LIL DRAKO🇪🇨', True),
        ('aviso del organizador', '@everyone 1 CUPO MASS', False),
        ('abre inscripciones', '# INSCRIPCIONES ABIERTAS', False),
        ('charla', 'CHECk estoy haciendo una prueba pero si hay inscritos', False),
        ('vacío', '   ', False),
    ]
    mal = 0
    print('\n  qué es una inscripción')
    for que, txt, esperado in casos:
        ok, motivo = parece_inscripcion(txt)
        bien = ok == esperado
        mal += not bien
        print('   %s %-24s %-5s  (%s)' % ('✅' if bien else '🔴', que,
                                          'sí' if ok else 'no', motivo))

    print('\n  la bandera')
    band = [('unicode', 'Cinexfilo 🇻🇪', 'VE'),
            ('del servidor', 'Kravitz<a:COSTARICA:1340260308148555826>',
             'COSTARICA'),
            ('sin bandera', 'tnor', None)]
    for que, txt, esperado in band:
        got = _bandera(txt)
        ok = got == esperado
        mal += not ok
        print('   %s %-16s -> %s' % ('✅' if ok else '🔴', que, got))

    print('\n  el AKA, sin la bandera')
    for txt, esperado in (('Cinexfilo 🇻🇪', 'Cinexfilo'),
                          ('Kravitz<a:COSTARICA:1340260308148555826>', 'Kravitz'),
                          ('Axinu🇨🇴', 'Axinu')):
        got = _aka(txt)
        ok = got == esperado
        mal += not ok
        print('   %s %-42s -> %r' % ('✅' if ok else '🔴', txt[:42], got))
    return mal


def main():
    if '--auto' in sys.argv:
        print('\n══ INSCRIPCIONES ══')
        return 1 if _self_check() else 0

    print('\n══ QUIEN SE INSCRIBIO, CON SU DISCORD ID ══\n')
    s = E.sesion()
    canales, n_ch = barrer(s)
    arriba = sorted(canales, key=lambda x: -x['puntaje'])
    print('   %d canales mirados\n' % n_ch)
    print('   %-12s %-30s %7s %6s' % ('servidor', 'canal', 'puntaje', 'insc'))
    for c in arriba[:8]:
        marca = '←' if c['puntaje'] >= CORTE else ' '
        print('   %-12s %-30s %7.3f %6d %s'
              % (c['servidor'][:12], c['canal'][:30], c['puntaje'],
                 len(c['inscripciones']), marca))

    if '--canales' in sys.argv:
        print('')
        return 0

    todas = [i for c in canales for i in c['inscripciones']]
    print('\n   %d inscripción(es) en %d canal(es) por encima de %.2f'
          % (todas and len(todas) or 0,
             sum(1 for c in canales if c['puntaje'] >= CORTE), CORTE))

    # completo a proposito: esto se corre a mano para ver el panorama,
    # y cruzar contra las llaves de dos canales conocidos daria menos
    # confirmadas sin decir por que.
    llaves, _info = E.escuchar(s, forzar=True)
    cruzar(todas, llaves)
    conf = [i for i in todas if i['confirmada']]
    print('   %d confirmada(s) por haber competido en una llave\n' % len(conf))

    con_cc = sum(1 for i in todas if i['cc'])
    print('   con bandera declarada     %d de %d' % (con_cc, len(todas)))
    print('   con Discord ID            %d de %d  ← todas, por definición'
          % (sum(1 for i in todas if i['discord_id']), len(todas)))
    print('\n   ejemplos:')
    for i in todas[:10]:
        print('     %-18s %-16s %-4s %s'
              % (i['usuario'][:18], i['aka'][:16], i['cc'] or '—',
                 '✅ compitió' if i['confirmada'] else ''))
    print('')
    return 0


if __name__ == '__main__':
    sys.exit(main())
