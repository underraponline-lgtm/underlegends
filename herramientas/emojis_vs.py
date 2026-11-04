# -*- coding: utf-8 -*-
"""LOS CUADRADOS DE CADA SERVIDOR, PARA LA FICHA DE «VER ESTADÍSTICAS».

    python herramientas/emojis_vs.py --auto      el self-check, sin tocar nada
    python herramientas/emojis_vs.py --aplicar   sube a Discord los que falten y reescribe `VS_SV` en bot/avisos.js

🟦 Dlx, 04/11/2026, a los cuadrados de la ficha: la imagen del VS ya los lleva del color de cada servidor, y Discord trae sólo
siete colores de cuadrado (turquesa, ninguno). Son emojis de la aplicación: no ocupan lugar en ningún servidor y el bot los
puede usar en cualquiera.

⚠️ EL COLOR NO VIVE ACÁ: sale de `kit.camiseta()`, el mismo del VS. `kit._self_check()` compara `VS_SV` contra ella, así que si
un color cambia, CI avisa hasta que se vuelva a correr esto. Y si el color de un emoji cambió, se borra y se sube de nuevo:
Discord no deja reemplazar la imagen.
"""
import base64
import io
import json
import os
import re
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE)
sys.path.insert(0, os.path.join(BASE, 'bot'))
import kit  # noqa: E402

API = 'https://discord.com/api/v10'
JS = os.path.join(BASE, 'bot', 'avisos.js')


def servidores():
    """`{SV: (color de la franja, color del cuadrado)}` de todos los confirmados."""
    with io.open(os.path.join(BASE, 'datos', 'servidores.json'), encoding='utf-8') as f:
        d = json.load(f)
    todos = d.get('servidores', d)
    out = {}
    for sv, v in todos.items():
        if isinstance(v, dict) and v.get('confirmado'):
            ca = kit.camiseta(kit._sv_datos(sv))
            out[sv] = (ca['placa'], ca['a'])
    return out


def png(color):
    from PIL import Image, ImageDraw
    im = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle((8, 8, 119, 119), radius=18, fill=color)
    b = io.BytesIO()
    im.save(b, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode('ascii')


def bloque(mapa):
    filas = ['  %s: [0x%s, \'%s\'],' % (sv, franja.lstrip('#').upper(), emoji) for sv, (franja, emoji) in sorted(mapa.items())]
    return '// VS_SV:inicio\nconst VS_SV = {\n%s\n};\n// VS_SV:fin' % '\n'.join(filas)


def escribir(mapa):
    s = io.open(JS, encoding='utf-8', newline='').read()
    crlf = '\r\n' in s
    s = s.replace('\r\n', '\n')
    nuevo, n = re.subn(r'// VS_SV:inicio\n.*?// VS_SV:fin', lambda _m: bloque(mapa), s, flags=re.S)
    if n != 1:
        raise SystemExit('no encuentro el bloque VS_SV en bot/avisos.js')
    if crlf:
        nuevo = nuevo.replace('\n', '\r\n')
    io.open(JS, 'w', encoding='utf-8', newline='').write(nuevo)


def aplicar():
    import requests
    env = {}
    for ruta in (os.path.join(BASE, '.env'), os.path.join(os.path.dirname(BASE), '..', '..', '..', 'underlegends', '.env')):
        if os.path.exists(ruta):
            for l in io.open(ruta, encoding='utf-8'):
                m = re.match(r'\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$', l)
                if m:
                    env.setdefault(m.group(1), m.group(2).strip('"\''))
    tok, app = os.environ.get('DISCORD_TOKEN') or env.get('DISCORD_TOKEN'), os.environ.get('DISCORD_APP_ID') or env.get('DISCORD_APP_ID')
    if not tok or not app:
        raise SystemExit('falta DISCORD_TOKEN o DISCORD_APP_ID')
    h = {'Authorization': 'Bot ' + tok}
    r = requests.get('%s/applications/%s/emojis' % (API, app), headers=h, timeout=30)
    r.raise_for_status()
    hay = {e['name']: e for e in r.json().get('items', [])}
    mapa = {}
    for sv, (franja, cuadro) in sorted(servidores().items()):
        # el color va en el nombre: si cambia, es otro emoji
        nombre = 'vs_%s_%s' % (sv.lower(), cuadro.lstrip('#').lower())
        viejos = [e for n, e in hay.items() if n.startswith('vs_%s_' % sv.lower()) and n != nombre]
        for e in viejos:
            requests.delete('%s/applications/%s/emojis/%s' % (API, app, e['id']), headers=h, timeout=30).raise_for_status()
            print('   🗑️ %s' % e['name'])
        e = hay.get(nombre)
        if not e:
            rr = requests.post('%s/applications/%s/emojis' % (API, app), headers=h, json={'name': nombre, 'image': png(cuadro)}, timeout=30)
            if not rr.ok:
                raise SystemExit('%s: %s %s' % (sv, rr.status_code, rr.content[:200].decode('utf-8', 'replace')))
            e = rr.json()
            print('   ✅ subido %s' % nombre)
        mapa[sv] = (franja, '<:%s:%s>' % (nombre, e['id']))
    escribir(mapa)
    print('   VS_SV: %d servidores' % len(mapa))


def self_check():
    sv = servidores()
    ok = all(re.fullmatch(r'#[0-9A-Fa-f]{6}', c) for par in sv.values() for c in par) and png('#26B3A6').startswith('data:image/png')
    print('  ✅ los colores de cada servidor salen de la camiseta' if ok else '  🔴 un color no es válido')
    b = bloque({'FRZ': ('#8FE8E0', '<:vs_frz_8fe8e0:1>')})
    ok2 = "FRZ: [0x8FE8E0, '<:vs_frz_8fe8e0:1>']," in b
    print('  ✅ el bloque se escribe bien' if ok2 else '  🔴 el bloque salió mal')
    return ok and ok2


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    if '--aplicar' in sys.argv:
        aplicar()
    else:
        sys.exit(0 if self_check() else 1)
