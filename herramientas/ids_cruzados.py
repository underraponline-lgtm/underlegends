# -*- coding: utf-8 -*-
"""¿EL DISCORD ID DE CADA UNO ES REALMENTE SUYO?

    python herramientas/ids_cruzados.py            los del padron
    python herramientas/ids_cruzados.py --kv       los que el bot tiene cargados

⚠️ ESTO NO ES UNA DUPLICACION Y POR ESO NINGUN CHEQUEO LO VEIA. El padron ya
se revisa contra si mismo: nadie tiene dos IDs, ningun ID apunta a dos
personas, y `sheet/arreglar_operativo.py` no escribe un ID que ya este puesto.
Todo eso da verde con un ID **bien formado y de otra persona**. La unica forma
de saber de quien es una cuenta es **preguntarle a Discord**.

⚠️ Y CUESTA DOS COSAS A LA VEZ, las dos calladas:

  1. `/card` sin argumentos te busca por TU ID -> esa cuenta recibe la carta
     de OTRO. No falla: sale una carta perfecta con el nombre equivocado.
  2. `bajar_avatares.py` pide la foto POR ID -> la cara de esa cuenta termina
     impresa en la carta del otro. Es el bug de los «avatares prestados» que
     ya esta documentado, pero entrando por la puerta del ID en vez de por la
     de una URL vieja.

COMO SE DETECTA, EN DOS PASOS, Y EL SEGUNDO ES EL QUE MANDA:

  1. se le pregunta a Discord el `username` y el `global_name` de cada ID, y
     se mira si alguno **es el nombre de OTRA persona del padron**;
  2. a los que salieron marcados se les pregunta **el APODO que tienen en los
     servidores de la Liga**, que es el que pone el staff.

🔴 EL PASO 1 SOLO SE EQUIVOCA MUCHO, Y ASI NACIO ESTA HERRAMIENTA. El
18/09/2026 marco 9 de 332 y se dieron por buenas; el apodo desmintio **cinco
de las seis** mas fuertes de una:

    la cuenta malasiafighter   se apoda "🐉 | Liberia"      -> el padron bien
    la cuenta kidbuu02124      se apoda "🐉 | Lord Viruzz"  -> el padron bien
    la cuenta lizeninn.        se apoda "🐉 | Mito"         -> el padron bien
    la cuenta hijo.de.la.selva se apoda "🐉 | Polosport"    -> el padron bien
    la cuenta ezequiel010988   se apoda "🐉 | Zekki"        -> el padron bien

O sea que el handle de Discord de una persona coincide con el nombre de OTRO
competidor mucho mas seguido de lo que parece — son nombres cortos de rap, se
repiten. **El handle dice como se llama la cuenta; el apodo dice a quien
reconoce el servidor.** Lo segundo es lo que estamos preguntando.

⚠️ EL APODO SE PIDE SOLO A LOS MARCADOS, no a los 332: son dos peticiones por
persona y por servidor, y preguntarlo para todos serian miles. Lo que decide
la respuesta es el puñado que quedo en duda.

⚠️ SOSPECHA, NO SENTENCIA, y ahora menos todavia. Dos personas se pueden
llamar parecido de verdad —Gus y Agus existen los dos, y los dos tienen cuenta
de Agustin—. La herramienta **no toca nada**: ordena por cuanta evidencia hay
y la ultima palabra es de Dlx.
"""
import io
import json
import os
import re
import sys
import time

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, os.path.join(BASE, 'sheet'))

API = 'https://discord.com/api/v10'


def env(clave):
    p = os.path.join(BASE, '.env')
    for l in io.open(p, encoding='utf-8'):
        if l.strip().startswith(clave + '='):
            return l.split('=', 1)[1].strip().strip('"\'')
    sys.exit('falta %s en .env' % clave)


def cuenta(s, did):
    """Username y global_name de esa cuenta, o None si no existe."""
    for _ in range(4):
        r = s.get('%s/users/%s' % (API, did), timeout=20)
        if r.status_code == 429:
            time.sleep(float(r.json().get('retry_after', 1)) + .2)
            continue
        if r.status_code != 200:
            return None
        j = r.json()
        return (j.get('username') or '', j.get('global_name') or '')
    return None


def main():
    import requests
    import construir_padron as PAD

    padron = PAD.cargar()
    if not padron:
        sys.exit('falta datos/padron.json:  python sheet/construir_padron.py')

    # Todo nombre conocido -> la persona. Se indexa `raw` y `full` porque el
    # nick de Discord puede ser cualquiera de los dos.
    conocidos = {}
    for p in padron:
        for n in (p.get('raw'), p.get('full')):
            if n:
                conocidos.setdefault(PAD.norm(n), p)
    tiene_id = {PAD.norm(p['raw']): bool(p.get('discord_id')) for p in padron}

    if '--kv' in sys.argv:
        kv = json.load(io.open(os.path.join(BASE, 'bot', '_kv_volcado.json'),
                               encoding='utf-8'))
        pares = [(v, k[2:]) for k, v in kv.items() if k.startswith('d:')]
        de = 'el volcado de KV'
    else:
        pares = [(p['raw'], p['discord_id']) for p in padron if p.get('discord_id')]
        de = 'datos/padron.json'

    s = requests.Session()
    s.headers['Authorization'] = 'Bot ' + env('DISCORD_TOKEN')

    print('\n%d Discord ID, de %s\n' % (len(pares), de))
    cruzados, muertos, suyos = [], [], 0
    for quien, did in sorted(pares):
        c = cuenta(s, did)
        if c is None:
            muertos.append((quien, did))
            continue
        user, glob = c
        mio = PAD.norm(quien)
        if PAD.norm(user) == mio or PAD.norm(glob) == mio:
            suyos += 1
            continue
        for cand in (user, glob):
            n = PAD.norm(cand)
            otro = conocidos.get(n)
            if n and otro and PAD.norm(otro['raw']) != mio:
                cruzados.append((quien, did, user, glob, otro['raw'],
                                 tiene_id.get(PAD.norm(otro['raw']), False)))
                break

    # ── PASO 2: EL APODO, QUE ES EL QUE MANDA ────────────────────────────
    # Solo a los marcados. Ver el docstring: el paso 1 solo se equivoco en 5
    # de 6 la primera vez que se corrio.
    guilds = []
    r = s.get('%s/users/@me/guilds' % API, timeout=20)
    if r.ok:
        guilds = [((g.get('name') or g['id'])[:18], g['id']) for g in r.json()]

    def apodos(did):
        """Como lo llama cada servidor de la Liga donde el bot esta adentro."""
        out = []
        for nom, gid in guilds:
            for _ in range(3):
                rr = s.get('%s/guilds/%s/members/%s' % (API, gid, did), timeout=20)
                if rr.status_code == 429:
                    time.sleep(float(rr.json().get('retry_after', 1)) + .2)
                    continue
                break
            if rr.ok:
                nick = (rr.json() or {}).get('nick') or ''
                if nick:
                    out.append((nom, nick))
        return out

    confirmados, dudosos = [], []
    for fila in cruzados:
        mio = PAD.norm(fila[0])
        vistos = apodos(fila[1])
        # ⚠️ EL APODO SE PARTE ANTES DE NORMALIZAR, y esto costo un caso.
        # `norm()` tira todo lo que no es alfanumerico, asi que «#5 | Gus»
        # queda «5gus» y deja de ser igual a «gus». Con un `in` se arreglaba
        # pero habia que pedir un largo minimo —para que «ana» no entre en
        # «juana»— y justo «gus» tiene tres letras: se caia por el guardia
        # puesto para otra cosa. Partiendo por los separadores que la gente
        # usa de verdad, «#5 | Gus» da ['5','Gus'] y la igualdad vuelve a
        # alcanzar, sin umbral y sin poder equivocarse hacia adentro.
        piezas = [mio] and []
        for g, n_ in vistos:
            piezas.append((g, n_, [PAD.norm(t) for t in re.split(r'[|/·,#-]+', n_)]
                           + [PAD.norm(n_)]))
        dice_mio = [(g, n_) for g, n_, ts in piezas if mio and mio in ts]
        (confirmados if dice_mio else dudosos).append(
            (fila, dice_mio[0] if dice_mio else None, vistos))
    cruzados = [f for f, _, _ in dudosos]
    apodo_de = {f[1]: v for f, _, v in dudosos}

    if confirmados:
        print('  %d que el paso 1 marcaba y EL APODO DESMIENTE:' % len(confirmados))
        for fila, (g, nick), _ in confirmados:
            print('     %-16s ok: en %s se apoda "%s"' % (fila[0], g, nick))

    # ⚠️ ORDENADO POR EVIDENCIA. El que la cuenta se llame como OTRO que no
    # tiene ID es el caso de «se escribio en la fila de al lado»; si el otro
    # ya tiene el suyo, lo mas probable es que sean dos personas que se llaman
    # parecido de verdad y esto sea ruido.
    cruzados.sort(key=lambda x: (x[5], x[0]))

    print('  %d coinciden con su nombre de Liga' % suyos)
    print('  %d no se parecen, y eso es normal: el nick de Discord es otro'
          % (len(pares) - suyos - len(cruzados) - len(muertos)))
    if muertos:
        print('\n  🔴 %d ID QUE NO EXISTEN EN DISCORD' % len(muertos))
        for q, d in muertos:
            print('     %-18s %s' % (q, d))

    if not cruzados:
        print('\n  ✅ ninguna cuenta se llama como otra persona del padron\n')
        return 0

    print('\n  🔴 %d SOSPECHA(S): la cuenta se llama como OTRA persona\n' % len(cruzados))
    for q, d, user, glob, otro, otro_tiene in cruzados:
        print('     el padron le da a %s  el ID %s' % (q, d))
        print('       esa cuenta es  "%s" / "%s"  ->  se llama como %s'
              % (user, glob or '-', otro))
        print('       %s' % ('%s ya tiene su propio ID: puede ser ruido, dos '
                             'nombres parecidos' % otro if otro_tiene else
                             '🔴 %s NO TIENE ID. Encaja con «se escribio una '
                             'fila mas abajo».' % otro))
        print('       si esta mal: %s recibe la carta de %s, y la cara de esa '
              'cuenta\n                    esta impresa en la carta de %s.'
              % (otro, q, q))
        ap = apodo_de.get(d) or []
        print('       apodo en la Liga: %s' % ('  ·  '.join(
            '%s: "%s"' % (g, n) for g, n in ap) if ap
            else 'ninguno — no esta en DRA ni en FFA, o no tiene apodo'))
        print('')
    print('  No se toca nada: quien es quien lo sabe Dlx, no Discord.')
    print('  Se arregla en el Sheet Operativo y despues:')
    print('     python sheet/construir_padron.py')
    print('     python herramientas/bajar_avatares.py --forzar')
    print('     python bot/rehacer.py <los afectados>\n')
    return 1


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    sys.exit(main())
