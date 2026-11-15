# -*- coding: utf-8 -*-
"""SUMAR UN SERVIDOR A LA LIGA: LO MECÁNICO, EN UN COMANDO.

    python herramientas/sumar_servidor.py FVS 1283205153624952975 "Freestyle Versus"              qué haría
    python herramientas/sumar_servidor.py FVS 1283205153624952975 "Freestyle Versus" --aplicar    lo hace

Dlx, 12/10/2026 («4. dale»): sumar FVS fueron unos quince pasos a mano. Esto hace los que no piden ninguna decisión:

    datos/servidores.json        la entrada, SIN confirmar (confirmar es de Dlx: con eso la Liga lo cuenta)
    datos/bot_en.json            el bot está ahí
    datos/estrellas.json         0 estrellas del Interserver
    datos/colores_sv_marca.json  un gris de espera, marcado «a mano: falta» (el color sale del logo, a ojo)
    las listas del código        multiplicadores, que_cambio, rehacer, tanda_servidores, rankings, cruzar_miembros,
                                 servidores_de, el mapa y el Worker

y al final corre `herramientas/servidor_completo.py`, que dice si quedó algo afuera.

⚠️ LO QUE NO HACE, A PROPÓSITO, porque son decisiones: el tag, la carta de Servidor (`los_nueve.defs()`), el logo y el
escudo (`procesar_logos.py`, `escudos_cuadrados.py`, `comun/escudos.py`), quién es quién en sus llaves
(`akas_a_mano.json`), si se cuentan sus ligas (`categorias_fuera`), confirmarlo, la invitación (`bot/invitaciones.py
--crear --aplicar`, después de esto) y la bienvenida. Al terminar las lista.
⚠️ Y LA SIGLA NO PUEDE EXISTIR: si ya está en `servidores.json`, no toca nada.

🏷️ `--tier N` (15/11/2026, al sumar FMS Ceuta como Tier 3): escribe el `tier` con el que arranca —sin él, un servidor que
Dlx no tocó en el Dashboard arranca en Tier 1 y sus llaves suman al Competitivo— y, con **3**, lo deja SIN carta de
Servidor (Dlx, 04/11: «FDS y LKR son tier 3, no tienen eso. Tier 2 si lo tienen»): `sinCarta` en el Worker y FUERA de
las listas de camisetas (`bot/que_cambio.py`, `bot/rehacer.py`). 🔴 Por no saber esto, DDS entró a esa lista con su alta
(08/11) y cada vuelta de `dibujar` perdió la Servidor de la tanda entera hasta que se sacó a mano.

    python herramientas/sumar_servidor.py CEU 1513624656538636459 "FMS Ceuta" --tier 3 --aplicar
"""
import io
import json
import os
import re
import subprocess
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

#: las listas de camisetas de la carta de Servidor: un servidor SIN carta (Tier 3) no va (ver `--tier` arriba)
CAMISETAS = ('bot/que_cambio.py', 'bot/rehacer.py')
#: (archivo, cómo encontrar la lista, cómo agregar). `{sv}`, `{g}` y `{n}` son la sigla, el guild y el nombre.
LISTAS = (
    ('bot/multiplicadores.py', r"^SERVIDORES = \((.*)\)$", 'final'),
    ('bot/que_cambio.py', r"^SERVIDORES = \((.*)\)$", 'orden'),
    ('bot/rehacer.py', r"^SERVIDORES = \((.*)\)$", 'orden'),
    ('bot/tanda_servidores.py', r"^ORDEN = \[(.*)\]$", 'final'),
    ('sheet/rankings.py', r"^SERVIDORES = \((.*)\)$", 'final'),
)


def _leer(rel):
    return io.open(os.path.join(BASE, rel), encoding='utf-8').read()


def _escribir(rel, s):
    io.open(os.path.join(BASE, rel), 'w', encoding='utf-8', newline='\n').write(s)


def _tupla(s, patron, como, sv):
    """La línea de la lista con `sv` agregado, o `None` si ya estaba o no se encontró."""
    m = re.search(patron, s, re.M)
    if not m:
        return None
    items = re.findall(r"'([^']*)'", m.group(1))
    if sv in items:
        return s
    nuevos = sorted(items + [sv]) if como == 'orden' else items + [sv]
    adentro = ', '.join("'%s'" % x for x in nuevos)
    return s[:m.start(1)] + adentro + s[m.end(1):]


def plan(sv, g, nombre, tier=None):
    """`[(archivo, contenido nuevo)]` y `[(qué, detalle)]` para mostrar. Con `tier` 3, sin carta de Servidor."""
    cambios, avisos = [], []
    sin_carta = tier == 3
    d = json.loads(_leer('datos/servidores.json'))
    if sv in (d.get('servidores') or {}):
        raise SystemExit('   🔴 %s ya está en datos/servidores.json: no toco nada' % sv)
    d['servidores'][sv] = {'nombre': nombre, 'guild_id': g, 'en_el_sheet': False, 'confirmado': False, 'sigla': sv,
                           'nota': 'sumado con herramientas/sumar_servidor.py: falta confirmar (Dlx), el tag, la carta, '
                                   'el logo y la invitación'}
    if tier in (1, 2, 3):
        d['servidores'][sv]['tier'] = tier
    cambios.append(('datos/servidores.json', json.dumps(d, ensure_ascii=False, indent=1) + '\n'))
    b = json.loads(_leer('datos/bot_en.json'))
    if sv not in b:
        cambios.append(('datos/bot_en.json', json.dumps(b + [sv], ensure_ascii=False)))
    e = json.loads(_leer('datos/estrellas.json'))
    if isinstance(e, dict) and sv not in (e.get('estrellas_por_servidor') or {}):
        e.setdefault('estrellas_por_servidor', {})[sv] = 0
        cambios.append(('datos/estrellas.json', json.dumps(e, ensure_ascii=False, indent=1) + '\n'))
    c = json.loads(_leer('datos/colores_sv_marca.json'))
    if sv not in (c.get('usar') or {}):
        c.setdefault('usar', {})[sv] = '#9AA0A6'
        c.setdefault('de_donde_sale', {})[sv] = 'a mano: falta (un gris de espera, de herramientas/sumar_servidor.py)'
        cambios.append(('datos/colores_sv_marca.json', json.dumps(c, ensure_ascii=False, indent=1) + '\n'))
    for rel, patron, como in LISTAS:
        if sin_carta and rel in CAMISETAS:
            continue
        s = _leer(rel)
        n = _tupla(s, patron, como, sv)
        if n is None:
            avisos.append((rel, 'no encontré la lista: agregalo a mano'))
        elif n != s:
            cambios.append((rel, n))
    # las de dos columnas (sigla, guild): después de la última
    for rel, ancla in (('herramientas/cruzar_miembros.py', r"(\n\s*\('[A-Z]+', '\d+'\))\]"),
                       ('herramientas/servidores_de.py', r"(\('[A-Z]+', '\d+'\))\)\n")):
        s = _leer(rel)
        if "('%s', '%s')" % (sv, g) in s:
            continue
        ms = list(re.finditer(ancla, s))
        if not ms:
            avisos.append((rel, 'no encontré la lista de guilds: agregalo a mano'))
            continue
        m = ms[-1]
        sep = ',\n         ' if rel.endswith('cruzar_miembros.py') else ', '
        s = s[:m.end(1)] + "%s('%s', '%s')" % (sep, sv, g) + s[m.end(1):]
        if rel.endswith('servidores_de.py'):
            s = re.sub(r"^(SOLO_PADRON = \{)(.*)(\})$", lambda q: q.group(1) + q.group(2) + ", '%s'" % sv + q.group(3),
                       s, count=1, flags=re.M)
        cambios.append((rel, s))
    s = _leer('bot/worker.js')
    if "sv: '%s'" % sv not in s:
        m = re.search(r"(\n  \{ sv: '[A-Z]+',[^\n]*\},\n)(\];)", s)
        if m:
            s = (s[:m.end(1)] + "  { sv: '%s', nombre: '%s', guild: '%s', invita: '', sigla: '%s'%s },\n"
                 % (sv, nombre, g, sv, ', sinCarta: true' if sin_carta else '') + s[m.end(1):])
            cambios.append(('bot/worker.js', s))
        else:
            avisos.append(('bot/worker.js', 'no encontré SERVIDORES: agregalo a mano'))
    s = _leer('bot/paginas/mapa_datos.js')
    m = re.search(r"^[ \t]*partes: \[\['DRA', 'DRA'[^\n]*$", s, re.M)
    if m and "['%s'," % sv not in m.group(0):
        linea = m.group(0)
        i = linea.rindex(']]')
        s = s[:m.start()] + linea[:i] + "], ['%s', '%s', ''" % (sv, nombre) + linea[i:] + s[m.end():]
        cambios.append(('bot/paginas/mapa_datos.js', s))
    elif not m:
        avisos.append(('bot/paginas/mapa_datos.js', 'no encontré los servidores del mapa: agregalo a mano'))
    return cambios, avisos


FALTA = ('confirmarlo en datos/servidores.json («confirmado»: true) — con eso la Liga lo cuenta',
         'el tag («tag») y la sigla de la carta si no es la misma',
         'la invitación: python bot/invitaciones.py --crear --aplicar (y --inscripciones --crear --aplicar)',
         'el logo y el escudo: herramientas/procesar_logos.py, herramientas/escudos_cuadrados.py, comun/escudos.py',
         'la carta de Servidor: 03_Servidor/disenos/los_nueve.py (defs) y el color de datos/colores_sv_marca.json',
         'quién es quién en sus llaves: datos/akas_a_mano.json (por_servidor, no_confundir)',
         'si sus ligas cuentan: categorias_fuera en datos/servidores.json',
         'desplegar el Worker (python bot/desplegar.py) y la bienvenida')


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    # el valor de `--tier` no es uno de los tres de la sigla, el guild y el nombre
    a = [x for i, x in enumerate(sys.argv[1:], 1) if not x.startswith('--') and sys.argv[i - 1] != '--tier']
    if len(a) != 3 or not re.match(r'^[A-Z]{2,5}$', a[0]) or not a[1].isdigit():
        print(__doc__)
        return 2
    sv, g, nombre = a
    tier = None
    if '--tier' in sys.argv:
        i = sys.argv.index('--tier')
        tier = int(sys.argv[i + 1]) if i + 1 < len(sys.argv) and sys.argv[i + 1] in ('1', '2', '3') else None
        if tier is None:
            print('   🔴 --tier pide 1, 2 o 3')
            return 2
    cambios, avisos = plan(sv, g, nombre, tier)
    print('\n══ SUMAR %s (%s) ══\n' % (sv, nombre))
    for rel, _s in cambios:
        print('   %s %s' % ('✅' if '--aplicar' in sys.argv else '·', rel))
    for rel, q in avisos:
        print('   ⚠️ %s: %s' % (rel, q))
    if '--aplicar' not in sys.argv:
        print('\n   (nada escrito: corré con --aplicar)')
        return 0
    for rel, s in cambios:
        _escribir(rel, s)
    print('\n── ¿quedó en todos los lugares? ──')
    subprocess.run([sys.executable, os.path.join(BASE, 'herramientas', 'servidor_completo.py')], cwd=BASE)
    print('\n── lo que falta, y es decisión ──')
    for x in FALTA:
        print('   · ' + x)
    return 0


if __name__ == '__main__':
    sys.exit(main())
