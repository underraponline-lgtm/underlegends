# -*- coding: utf-8 -*-
"""QUE NO CIERRA ENTRE EL SHEET, EL PADRON, R2 Y KV.

    python herramientas/auditar_datos.py

Los cuatro guardan lo mismo visto desde angulos distintos, y por eso pueden
discrepar sin que nada falle:

    el Sheet    la fuente. No se mira aca (pide credenciales).
    datos/      los pools y el padron que salieron de el.
    R2          las cartas dibujadas.
    KV          lo que el bot lee para decidir que dibujar.

⚠️ NINGUNA DE ESTAS DISCREPANCIAS TIRA UN ERROR. Una carta que sobra no
molesta a nadie, una que falta sale como hueco, y un dato viejo se dibuja
igual de lindo. Por eso hay que preguntarlas.

⚠️ NO TOCA NADA. Solo lee y cuenta.
"""
import io
import json
import os
import sys
from collections import Counter

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, BASE)
sys.path.insert(0, os.path.join(BASE, 'sheet'))

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass


def _j(*p):
    q = os.path.join(BASE, *p)
    if not os.path.exists(q):
        return None
    with io.open(q, encoding='utf-8') as f:
        return json.load(f)


def main():
    import construir_padron as PAD
    pad = PAD.cargar()
    idx = {PAD.norm(x['raw']): x for x in pad}
    comp = {PAD.norm(x['raw']): x for x in (_j('datos', 'competitivo_pool.json') or [])}
    temp = {PAD.norm(x['raw']): x for x in (_j('datos', 'temporada_pool.json') or [])}
    r2 = _j('datos', 'cartas_r2.json') or {}

    print('\n══ LOS CUATRO CONJUNTOS ══\n')
    print('  padron          %4d' % len(pad))
    print('  pool temporada  %4d' % len(temp))
    print('  pool competitivo%4d' % len(comp))
    print('  con carta en R2 %4d' % len(r2))

    print('\n══ QUIEN ESTA EN UNO Y NO EN OTRO ══\n')
    # ⚠️ UNA CARTA EN R2 DE ALGUIEN QUE NO ESTA EN EL PADRON no se borra sola
    # y el bot no la va a servir nunca: es peso muerto que ademas confunde
    # cualquier conteo.
    huerfanas = sorted(set(r2) - set(idx))
    print('  carta en R2 pero NO en el padron:  %d%s'
          % (len(huerfanas), ('   ' + ', '.join(huerfanas[:8])) if huerfanas else ''))
    sin_carta = sorted(set(comp) - set(r2))
    print('  en el pool competitivo y SIN carta: %d%s'
          % (len(sin_carta), ('   ' + ', '.join(sin_carta[:8])) if sin_carta else ''))
    fuera = sorted(set(comp) - set(idx))
    print('  en el pool y NO en el padron:       %d%s'
          % (len(fuera), ('   ' + ', '.join(fuera[:8])) if fuera else ''))

    print('\n══ FILAS REPETIDAS EN EL PADRON ══\n')
    # el mismo nombre normalizado en dos filas: el ID de una pisa al de la otra
    c = Counter(PAD.norm(x['raw']) for x in pad)
    rep = {k: n for k, n in c.items() if n > 1}
    print('  nombres que aparecen mas de una vez: %d' % len(rep))
    for k, n in sorted(rep.items())[:10]:
        quienes = [x['raw'] for x in pad if PAD.norm(x['raw']) == k]
        ids = {x.get('discord_id') or '—' for x in pad if PAD.norm(x['raw']) == k}
        print('     %-16s x%d  %s   ids: %s' % (k, n, quienes, ', '.join(sorted(ids))))

    print('\n══ UN DISCORD ID EN DOS PERSONAS ══\n')
    # ⚠️ ES EL ERROR MAS CARO DEL PADRON: el bot busca `d:<id>` y devuelve UNA
    # sola persona, asi que alguien ve la carta de otro.
    porid = {}
    for x in pad:
        if x.get('discord_id'):
            porid.setdefault(x['discord_id'], []).append(x['raw'])
    ch = {k: v for k, v in porid.items() if len(v) > 1}
    print('  IDs compartidos: %d' % len(ch))
    for k, v in sorted(ch.items())[:10]:
        print('     %-20s %s' % (k, ', '.join(v)))

    print('\n══ EL POOL CONTRA EL PADRON ══\n')
    # CLAUDE.md avisa que el pool trae `crew` y `pos_crew` viejos
    import comun.crews as CR
    dist = []
    for k, x in comp.items():
        suya = CR.crew_de(x['raw']) if hasattr(CR, 'crew_de') else None
        if suya is not None and (x.get('crew') or None) != (suya or None):
            dist.append((x['raw'], x.get('crew'), suya))
    print('  la crew del pool difiere de comun/crews.py en: %d' % len(dist))
    for n, a, b in dist[:8]:
        print('     %-16s pool=%-12s crews.py=%s' % (n, a or '—', b or '—'))

    print('\n══ ARCHIVOS DE datos/ QUE NADIE LEE ══\n')
    # ⚠️ UN JSON QUE NADIE ABRE ES UNA COPIA VIEJA ESPERANDO QUE ALGUIEN LA
    # LEA POR ERROR. Ya paso en este proyecto con los pools por carpeta.
    usados = set()
    for raiz, dirs, fs in os.walk(BASE):
        dirs[:] = [d for d in dirs if d not in ('__pycache__', 'node_modules', '.git')]
        for f in fs:
            if not f.endswith(('.py', '.js', '.mjs')):
                continue
            try:
                s = io.open(os.path.join(raiz, f), encoding='utf-8').read()
            except Exception:
                continue
            for j in os.listdir(os.path.join(BASE, 'datos')):
                if j in s:
                    usados.add(j)
    todos = set(os.listdir(os.path.join(BASE, 'datos')))
    nadie = sorted(todos - usados)
    print('  %d de %d archivos de datos/ no los nombra ningun script:'
          % (len(nadie), len(todos)))
    for f in nadie:
        p = os.path.join(BASE, 'datos', f)
        kb = os.path.getsize(p) / 1024 if os.path.isfile(p) else 0
        print('     %-28s %8.1f KB' % (f, kb))
    print('')


if __name__ == '__main__':
    main()
