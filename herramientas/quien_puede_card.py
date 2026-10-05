# -*- coding: utf-8 -*-
"""¿POR QUE ESTA PERSONA NO TIENE CARTA? En una corrida.

    python herramientas/quien_puede_card.py            los que compiten
    python herramientas/quien_puede_card.py Masino Tam  por nombre
    python herramientas/quien_puede_card.py --todos     el padron entero
    python herramientas/quien_puede_card.py --auto      el self-check

🔴 EXISTE PORQUE LA PREGUNTA SE CONTESTA EN CUATRO LUGARES. Alguien
compite, no le sale la carta, y averiguar por que pide cruzar el padron
(¿tiene Discord ID?), `verificados.json` (¿tiene el rol?), el inventario
de R2 (¿esta dibujada?) y KV (¿el bot la indexa?). Cuatro archivos para
una pregunta que se hace todas las semanas.

⚠️ Y LAS CUATRO RESPUESTAS SE VEN IGUAL DESDE DISCORD: `/card` contesta
lo mismo. Es la forma que este repo ya se comio con los siete que
estaban verificados y no tenian carta — *«la respuesta equivocada con la
cara de la correcta»*.

⚠️ NO ES UN FALLO QUE ALGUIEN NO PASE. Medido el 23/09/2026 sobre los
**40** que compiten en la T1: 17 con `/card`, 16 sin Discord ID en el
padron y 7 con ID pero sin el rol. Los 23 necesitan **una accion
humana** —registrarse o verificarse—, no un arreglo. Lo que esta
herramienta evita es buscarlo a mano cada vez.

🔑 Y DESDE EL 05/10/2026 LO DECIDE `verificados.puede()`, CARTA POR CARTA (2.41: sin verificarse, ninguna; la
Servidor al verificarse; la Temporada con el nivel 1 del Pase; quien ya las tenía las conserva hasta la T1). Hasta la
revisión de ese día esto aplicaba todavía la regla del 29/09 —«las LIBRES»—: a los que no se verificaron los contaba
como «no se toca» y a los verificados sin el nivel 1 les daba la Temporada por buena.

🔴 LA CLAVE DE KV ES `p:<nombre normalizado>`, NO EL DISCORD ID. Buscar
por ID devuelve 404 para todo el mundo y parece que el bot no tiene a
nadie: me paso, dos veces seguidas, antes de mirar una clave de verdad.
Por eso acá se usa `comun.claves.clave()` y no se escribe el formato.
"""
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, BASE)
sys.path.insert(0, os.path.join(BASE, 'bot'))
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

from comun.claves import clave as CL                     # noqa: E402


def _json(*partes):
    try:
        with io.open(os.path.join(BASE, *partes), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def estado(nombres=None, con_kv=True):
    """`[(nombre, estado, detalle)]`. `estado` es la razón, no un bool."""
    padron = _json('datos', 'padron.json') or []
    ver = _json('datos', 'verificados.json') or {}
    ids = set(str(x) for x in (ver.get('ids') or []))
    inv = _json('datos', 'cartas_r2.json') or {}
    per = {p.get('raw'): p for p in padron if p.get('raw')}
    import verificados as VER

    if nombres is None:
        pool = _json('datos', 'temporada_pool.json') or []
        nombres = [x.get('raw') for x in pool if x.get('raw')]

    en_kv = _kv(set(CL(n) for n in nombres)) if con_kv else None
    out = []
    for n in nombres:
        k = CL(n)
        p = per.get(n)
        if p is None:
            out.append((n, 'sin padrón', 'no está en `datos/padron.json`'))
            continue
        did = str(p.get('discord_id') or '')
        pasa = VER.pasa(p, ids)
        # 🔑 CARTA POR CARTA, con `puede()`: las que le tocan hoy
        cartas = [c for c in ('temporada', 'servidor', 'competitivo', 'pais') if VER.puede(p, ids, c)]
        try:
            import construir_padron as _PAD
            fuera = (did and did in VER._olvidados()) or _PAD.norm(n) in VER._intocables()
        except Exception:                                # noqa: BLE001
            fuera = False
        if fuera:
            out.append((n, 'no se toca',
                        'está en la Lista, pero es de los que no se tocan '
                        '(`no_verificar`, trolls) o pidió salir'))
        elif not cartas:
            out.append((n, 'sin Discord ID' if not did else 'sin verificar',
                        ('no tiene Discord ID en el padrón' if not did else 'ID %s, sin el rol en DRA' % did)
                        + ': sin verificarse no tiene tarjetas (se verifica en la página, entrando con Discord)'))
        elif not inv.get(k):
            out.append((n, 'sin dibujar',
                        'le tocan %s y no hay nada en R2 — esto SÍ es un fallo del ciclo' % ', '.join(cartas)))
        elif en_kv is not None and k not in en_kv:
            out.append((n, 'sin indexar',
                        'tiene cartas en R2 y KV no la indexa — esto SÍ es '
                        'un fallo'))
        elif not pasa:
            out.append((n, 'conserva', 'sin verificar, conserva %s hasta la T1' % ', '.join(cartas)))
        else:
            out.append((n, 'ok', ', '.join(sorted(inv.get(k) or {}))[:60]
                        + ('' if 'temporada' in cartas else ' · sin la Temporada: le falta el nivel 1 del Pase')))
    return out


def _kv(claves):
    """Cuáles de esas claves existen en KV. `set()` si no se puede."""
    try:
        import requests
        import subir_datos as SD
        tok = ''
        for l in io.open(os.path.join(BASE, '.env'), encoding='utf-8'):
            if l.strip().startswith('CLOUDFLARE_API_TOKEN='):
                tok = l.split('=', 1)[1].strip().strip('"\'')
        if not tok:
            return None
        h = {'Authorization': 'Bearer ' + tok}
        hay, cursor = set(), ''
        while True:
            u = '%s/keys?limit=1000%s' % (SD.API,
                                          ('&cursor=' + cursor) if cursor else '')
            j = requests.get(u, headers=h, timeout=60).json()
            for k in j.get('result', []):
                if k['name'].startswith('p:'):
                    hay.add(k['name'][2:])
            cursor = (j.get('result_info') or {}).get('cursor') or ''
            if not cursor:
                break
        return hay & claves if claves else hay
    except Exception:                                    # noqa: BLE001
        return None


#: qué razones son un problema NUESTRO y cuáles piden una acción humana.
#:
#: ⚠️ LA DISTINCION ES EL PUNTO DE LA HERRAMIENTA. «No se registró» y «el
#: ciclo no la dibujó» se ven igual desde Discord y son cosas opuestas:
#: una se arregla hablando con la persona y la otra mirando el log.
NUESTRO = ('sin dibujar', 'sin indexar')


def _self_check():
    print('\n  quien_puede_card.py — self-check\n')
    mal = 0

    def ok(cond, que):
        nonlocal mal
        mal += not cond
        print('   %s %s' % ('ok' if cond else '🔴', que))

    r = dict((n, e) for n, e, _d in estado(con_kv=False))
    ok(bool(r), 'contesta por los que compiten (%d)' % len(r))
    razones = set(r.values())
    ok(razones <= {'ok', 'sin padrón', 'no se toca', 'sin Discord ID', 'sin verificar', 'conserva',
                   'sin dibujar', 'sin indexar'},
       'todas las razones son conocidas  %s' % sorted(razones))
    # 🔴 UN NOMBRE INVENTADO NO PUEDE SALIR «ok»
    r2 = estado(['__NO_EXISTE__'], con_kv=False)
    ok(r2 and r2[0][1] == 'sin padrón', 'un nombre inventado cae en `sin padrón`')
    ok(not (set(NUESTRO) & {'sin Discord ID', 'sin verificar', 'no se toca', 'conserva'}),
       'registrarse y verificarse NO cuentan como fallo nuestro')
    # 🔑 DESDE EL 05/10/2026 (Dlx: «sin verificarse, ninguna tarjeta»): quien no pasa el portón y no conserva las
    # suyas hasta la T1 no tiene ninguna (ver `verificados.puede()`)
    import verificados as VER
    per = {'raw': 'Prueba', 'discord_id': '1', 'pais': 'Chile'}
    ok(not VER.puede(per, set(), 'temporada') and not VER.puede(per, set(), 'servidor')
       and not VER.puede(per, set(), 'competitivo'),
       'sin el rol y sin nada que conservar: ninguna')
    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


def main():
    if '--auto' in sys.argv:
        return _self_check()
    pedidos = [a for a in sys.argv[1:] if not a.startswith('-')]
    if '--todos' in sys.argv:
        padron = _json('datos', 'padron.json') or []
        pedidos = [p.get('raw') for p in padron if p.get('raw')]
    r = estado(pedidos or None)

    import collections
    cont = collections.Counter(e for _n, e, _d in r)
    print('\n══ QUIÉN PUEDE USAR `/card` ══\n')
    print('   sobre %d persona(s)\n' % len(r))
    for e, n in cont.most_common():
        marca = '🔴' if e in NUESTRO else ('✅' if e == 'ok' else '·')
        print('   %s %-16s %d' % (marca, e, n))
    malas = [(n, e, d) for n, e, d in r if e in NUESTRO]
    if malas:
        print('\n   🔴 lo que SÍ es un fallo nuestro:')
        for n, e, d in malas[:20]:
            print('      %-14s %-14s %s' % (n, e, d))
    else:
        print('\n   ✅ ninguno falta por culpa del ciclo')
    otras = [(n, e) for n, e, _d in r if e not in NUESTRO and e != 'ok']
    if otras:
        print('\n   lo que pide una acción de la persona:')
        for e in sorted(set(x[1] for x in otras)):
            quienes = [n for n, x in otras if x == e]
            print('      %-16s %d  %s%s'
                  % (e, len(quienes), ', '.join(quienes[:8]),
                     '…' if len(quienes) > 8 else ''))
    print('')
    return 0


if __name__ == '__main__':
    raise SystemExit(main() or 0)
