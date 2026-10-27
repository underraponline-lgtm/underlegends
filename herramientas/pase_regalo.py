# -*- coding: utf-8 -*-
"""🎫 DARLE EL PASE PREMIUM DE REGALO: el rol «Pase Premium» (`pase.ROL_REGALO`) en DRA.

    python herramientas/pase_regalo.py Konan Axinu …            dry-run: a quién, con qué cuenta
    python herramientas/pase_regalo.py Konan Axinu … --aplicar  lo asigna

Dlx, 27/10/2026: *«estas personas deberían tener el pase de rapero t1… daselas»* — el top 3 del Competitivo y de la
Temporada de la pre-temporada (Konan, Axinu, Abyssus · Bloody, Valen, MCO), que antes iba a ser de la T2: *«cambié de
opinión, no será t2 sino t1»*.

⚠️ EL PREMIUM ES EL ROL, no una lista: `verificados.refrescar()` deja a quienes lo tienen en datos/pase_premium.json y
el Pase se desbloquea solo en la corrida siguiente. Por eso esto sólo pone el rol, y sólo SUMA: nunca saca nada.

⚠️ EL ID SALE DEL PADRÓN Y SE CORROBORA CONTRA DISCORD, como `dar_verificado.py`: si el apodo o el usuario de esa cuenta
en DRA no se llama como el rapero, no se toca y se avisa. Quien no está en DRA no puede recibir el rol.
"""
import os
import sys
import time

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path[:0] = [SCR, os.path.join(BASE, 'sheet'), os.path.join(BASE, 'bot')]

import dar_verificado as DV                                   # noqa: E402


def main():
    import requests
    import construir_padron as PAD
    from pase import ROL_REGALO
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    aplicar = '--aplicar' in sys.argv
    nombres = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not nombres:
        sys.exit(__doc__)
    padron = PAD.cargar()
    por_norm = {}
    for p in padron:
        n = PAD.norm(p.get('raw') or p.get('nombre') or '')
        if n:
            por_norm.setdefault(n, []).append(p)
    s = requests.Session()
    s.headers['Authorization'] = 'Bot ' + DV.env('DISCORD_TOKEN')
    mal = 0
    for nombre in nombres:
        ps = [p for p in por_norm.get(PAD.norm(nombre)) or [] if str(p.get('discord_id') or '').isdigit()]
        if len(ps) != 1:
            print('  🔴 %-10s %s' % (nombre, 'no está en el padrón con Discord' if not ps else 'hay %d con ese nombre' % len(ps)))
            mal += 1
            continue
        did = str(ps[0]['discord_id'])
        m, est = DV.miembro(s, DV.DRA, did)
        if est != 'ok':
            print('  🔴 %-10s %s: no está en DRA (%s)' % (nombre, did, est))
            mal += 1
            continue
        u = m.get('user') or {}
        if not DV.corrobora(nombre, m.get('nick'), u.get('username'), u.get('global_name'), PAD.norm):
            print('  🔴 %-10s %s: la cuenta se llama «%s» / «%s», no se toca' % (nombre, did, m.get('nick'), u.get('username')))
            mal += 1
            continue
        if ROL_REGALO in (m.get('roles') or []):
            print('  ✓ %-10s %s (%s): ya lo tenía' % (nombre, did, u.get('username')))
            continue
        if not aplicar:
            print('  · %-10s %s (%s): se lo daría' % (nombre, did, u.get('username')))
            continue
        ok = DV.dar_rol(s, DV.DRA, did, ROL_REGALO)
        print('  %s %-10s %s (%s)' % ('✅' if ok else '🔴', nombre, did, u.get('username')))
        mal += not ok
        time.sleep(DV.PAUSA)
    return 1 if mal else 0


if __name__ == '__main__':
    sys.exit(main())
