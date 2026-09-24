# -*- coding: utf-8 -*-
"""¿ESTAN LOS OCHO ROLES DE RANGO EN DISCORD? Se pregunta, no se supone.

    python herramientas/roles_de_rango.py          los busca en DRA
    python herramientas/roles_de_rango.py --auto   el self-check, sin red

🔴 EXISTE PORQUE `CLAUDE.md` DIJO «SON SEIS» DURANTE DIAS DESPUES DE QUE
FUERAN OCHO. Dlx, 23/09/2026: *«esos 6 roles ya es cosa vieja q te
olvidaste actualizar… son 8»*. Y tenia razon: los ocho estaban creados
—`Rango SSS` hasta `Rango E`, posiciones 107 a 100 y en orden— mientras
dos documentos los seguian listando como la unica tarea manual
pendiente del proyecto.

⚠️ EL PROBLEMA NO ES EL DATO VIEJO, ES QUE ERA UNA AFIRMACION SIN
CHEQUEO. `CLAUDE.md` trae una tabla de «donde vive el rango» con cinco
filas y una columna «se arregla»; cuatro se comprobaban solas y la de
los roles decia «a mano». Lo que no se pregunta no se entera de que ya
se hizo — es el mismo error que la guia documenta al reves (un numero
que se arrastra sin volver a medirlo).

🔑 Y LOS NOMBRES ESTAN EN NEGRITA MATEMATICA: `𝐑𝐚𝐧𝐠𝐨 𝐒𝐒𝐒` no es
`Rango SSS`, son puntos de codigo distintos (U+1D400 y siguientes).
`.upper()` no los toca y `isalnum()` dice que si, asi que buscarlos por
nombre da **cero** y parece que no existen. Me paso en la primera
corrida. `unicodedata.normalize('NFKD', …)` los devuelve a ASCII.
"""
import io
import os
import re
import sys
import unicodedata

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, BASE)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

from comun.rangos import ORDEN                           # noqa: E402

#: DRA. Es el guild del portón; está inventariado en `ACCESOS.md`.
GUILD = '841017460341604382'

#: `◢◤👑◥◣ 𝐑𝐚𝐧𝐠𝐨 𝐒𝐒𝐒 ◢◤👑◥◣` -> `RANGO SSS`
_SOLO = re.compile(r'[^A-Za-z ]')
_ROL = re.compile(r'RANGO\s+(SSS|SS|S|A|B|C|D|E)$')


def plano(nombre):
    """El nombre sin decoración y sin negrita matemática. Ver el módulo."""
    t = unicodedata.normalize('NFKD', str(nombre or ''))
    return re.sub(r'\s+', ' ', _SOLO.sub('', t)).strip().upper()


def de_rango(nombre):
    """El rango que nombra ese rol, o `None`."""
    m = _ROL.search(plano(nombre))
    return m.group(1) if m else None


def _token():
    t = os.environ.get('DISCORD_TOKEN') or ''
    if t:
        return t.strip()
    try:
        with io.open(os.path.join(BASE, '.env'), encoding='utf-8') as f:
            for l in f:
                if l.strip().startswith('DISCORD_TOKEN'):
                    return l.split('=', 1)[1].strip().strip('"\'')
    except OSError:
        pass
    return ''


def buscar(guild=None):
    """`{rango: (id, posicion, nombre)}` de lo que hay en Discord."""
    import requests
    t = _token()
    if not t:
        raise RuntimeError('falta DISCORD_TOKEN')
    r = requests.get('https://discord.com/api/v10/guilds/%s/roles'
                     % (guild or GUILD),
                     headers={'Authorization': 'Bot ' + t}, timeout=30)
    r.raise_for_status()
    out = {}
    for x in r.json():
        rg = de_rango(x.get('name'))
        if rg:
            out[rg] = (x['id'], x['position'], x['name'])
    return out


def _self_check():
    print('\n  roles_de_rango.py — self-check\n')
    mal = 0

    def ok(cond, que):
        nonlocal mal
        mal += not cond
        print('   %s %s' % ('ok' if cond else '🔴', que))

    # 🔴 LA NEGRITA MATEMATICA. Es lo que hizo que la primera busqueda
    # diera cero y pareciera que los roles no existian.
    ok(plano('◢◤👑◥◣ 𝐑𝐚𝐧𝐠𝐨 𝐒𝐒𝐒 ◢◤👑◥◣') == 'RANGO SSS',
       'la negrita matemática se normaliza  %r'
       % plano('◢◤👑◥◣ 𝐑𝐚𝐧𝐠𝐨 𝐒𝐒𝐒 ◢◤👑◥◣'))
    ok('𝐒𝐒𝐒'.upper() != 'SSS',
       'y `.upper()` sola NO alcanza (por eso hace falta NFKD)')

    for n, esp in (('◢◤⚓◥◣ 𝐑𝐚𝐧𝐠𝐨 𝐄 ◢◤⚓◥◣', 'E'),
                   ('Rango A', 'A'),
                   ('◢◤🐉◥◣ 𝐑𝐚𝐧𝐠𝐨 𝐒 ◢◤🐉◥◣', 'S')):
        ok(de_rango(n) == esp, 'reconoce %-10r -> %s' % (n[:10], esp))

    # ⚠️ y no se pasa de listo: un rol que sólo dice «Rango» no es ninguno
    for n in ('╚⏤《 R A N G O 》⏤╝', 'Rangos', '🧢﹒Rapero', ''):
        ok(de_rango(n) is None, 'NO confunde %r' % n[:18])

    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


def main():
    if '--auto' in sys.argv:
        return _self_check()
    print('\n══ LOS ROLES DE RANGO EN DISCORD ══\n')
    try:
        hay = buscar()
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ no pude preguntarle a Discord: %s\n' % str(e)[:90])
        return 0            # sin red no se afirma nada
    faltan = [r for r in ORDEN if r not in hay]
    for rg in ORDEN:
        if rg in hay:
            i, pos, n = hay[rg]
            print('   ✅ %-4s pos %-4s id %-20s %s' % (rg, pos, i, n[:30]))
        else:
            print('   🔴 %-4s NO EXISTE en el servidor' % rg)
    print('\n   %d de %d' % (len(ORDEN) - len(faltan), len(ORDEN)))

    # 🔴 Y QUE EL ORDEN DEL SERVIDOR SEA EL DEL PROYECTO. Un `Rango E`
    # por encima de `Rango SSS` no falla en ningún lado y le da a la
    # gente el color equivocado en la lista de miembros.
    if not faltan:
        pos = [hay[r][1] for r in ORDEN]
        bien = pos == sorted(pos, reverse=True)
        print('   %s el orden en el servidor es el de comun/rangos.py'
              % ('✅' if bien else '🔴 %s' % pos))
        if not bien:
            print('')
            return 1
    print('')
    return 1 if faltan else 0


if __name__ == '__main__':
    raise SystemExit(main() or 0)
