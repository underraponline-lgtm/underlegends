# -*- coding: utf-8 -*-
"""🔗 LOS ROLES VINCULADOS DE DISCORD: qué datos de la Liga puede pedir un rol.

    python bot/roles_vinculados.py --ver         lo que la app tiene registrado hoy
    python bot/roles_vinculados.py --registrar   registra los de abajo (con el bot; se puede repetir)
    python bot/roles_vinculados.py --auto        el self-check (sin red)

Dlx, 19/10/2026: «dale», a «los roles vinculados (Linked Roles): el rango de la Liga en el perfil de Discord». Un
servidor arma un rol con requisitos —«Rango de la Liga ≥ 5», «Verificado en la Liga»— y Discord se lo da solo a quien
cumple. Esto le dice a Discord QUÉ se puede pedir; los valores de cada persona los escribe el Worker cuando pasa por
`/vincular` (`cuentaRol()` en bot/worker.js, con el permiso de esa persona: nunca se guarda ninguno).

⚠️ LAS CLAVES SON UN CONTRATO CON EL WORKER: `rango`, `eventos`, `nivel` y `verificado`. Si se cambia una acá, se
cambia allá, o Discord guarda un dato que ningún rol pide.

⚠️ FALTA UN PASO QUE ES DE DLX (no se puede hacer por la API): en el portal de Discord, la app → General Information
→ «Linked Roles Verification URL» = https://underlegends.pages.dev/vincular/. Sin eso Discord no muestra la app en los
requisitos de los roles. Y cada servidor arma sus roles: Ajustes del servidor → Roles → el rol → Vínculos.
"""
import json
import os
import re
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

APP = '1550026808404217926'
#: 2 = entero «mayor o igual», 7 = sí/no («igual a»). Nombres y descripciones como los ve el dueño de un servidor
DATOS = [
    {'type': 2, 'key': 'rango', 'name': 'Rango de la Liga',
     'description': 'Tu rango competitivo, del 1 (E) al 8 (SSS): 1 E · 2 D · 3 C · 4 B · 5 A · 6 S · 7 SS · 8 SSS'},
    {'type': 2, 'key': 'eventos', 'name': 'Eventos de la temporada',
     'description': 'Cuántos eventos de la Liga Global jugaste en la temporada'},
    {'type': 2, 'key': 'nivel', 'name': 'Nivel del Pase de rapero',
     'description': 'Tu nivel del Pase de rapero (es de los miembros de DRA)'},
    {'type': 7, 'key': 'verificado', 'name': 'Verificado en la Liga',
     'description': 'Pasaste la verificación de la Liga Global'},
]


def validos(ds):
    """¿Los acepta Discord? Hasta 5, clave a-z0-9_ de 1 a 50, nombre hasta 100 y descripción hasta 200."""
    return (0 < len(ds) <= 5 and len({d['key'] for d in ds}) == len(ds)
            and all(re.fullmatch(r'[a-z0-9_]{1,50}', d['key']) and 0 < len(d['name']) <= 100
                    and 0 < len(d['description']) <= 200 and d['type'] in (1, 2, 3, 4, 5, 6, 7, 8) for d in ds))


def _token():
    tok = os.environ.get('DISCORD_TOKEN', '')
    if not tok:
        try:
            with open(os.path.join(BASE, '.env'), encoding='utf-8') as f:
                for ln in f:
                    if ln.startswith('DISCORD_TOKEN='):
                        tok = ln.split('=', 1)[1].strip().strip('"\'')
        except OSError:
            pass
    if not tok:
        sys.exit('falta DISCORD_TOKEN (en .env o en el entorno)')
    return tok


def _pedir(metodo, cuerpo=None):
    import requests
    r = requests.request(metodo, 'https://discord.com/api/v10/applications/%s/role-connections/metadata' % APP,
                         headers={'Authorization': 'Bot ' + _token(), 'content-type': 'application/json'},
                         json=cuerpo, timeout=30)
    if r.status_code >= 300:
        sys.exit('Discord dijo %d: %s' % (r.status_code, r.text[:200]))
    return r.json()


def _self_check():
    print('\n══ LOS ROLES VINCULADOS ══\n')
    mal = 0
    ok = validos(DATOS) and [d['key'] for d in DATOS] == ['rango', 'eventos', 'nivel', 'verificado']
    print('   %s los cuatro datos tienen la forma que Discord acepta, con las claves que escribe el Worker' % ('✅' if ok else '🔴'))
    mal += not ok
    try:
        with open(os.path.join(BASE, 'bot', 'worker.js'), encoding='utf-8') as f:
            w = f.read()
        m = re.search(r'const datos = \{([^}]*)\}', w)
        ok2 = bool(m) and all(re.search(r'\b%s\b' % k, m.group(1)) for k in ('rango', 'eventos', 'nivel', 'verificado'))
    except OSError:
        ok2 = False
    print('   %s y el Worker escribe esas mismas cuatro (`cuentaRol()`)' % ('✅' if ok2 else '🔴'))
    mal += not ok2
    print('\n   %s\n' % ('todo bien' if not mal else '%d mal' % mal))
    return mal


if __name__ == '__main__':
    if '--auto' in sys.argv:
        sys.exit(1 if _self_check() else 0)
    if '--registrar' in sys.argv:
        if not validos(DATOS):
            sys.exit('los datos no tienen la forma que Discord acepta')
        hoy = _pedir('PUT', DATOS)
        print('✅ registrados: %s' % ', '.join(d['key'] for d in hoy))
    elif '--ver' in sys.argv:
        print(json.dumps(_pedir('GET'), ensure_ascii=False, indent=1))
    else:
        print(__doc__)
