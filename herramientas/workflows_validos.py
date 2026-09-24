# -*- coding: utf-8 -*-
"""QUE LOS WORKFLOWS SEAN VALIDOS PARA GITHUB, NO SOLO PARA PyYAML.

    python herramientas/workflows_validos.py

🔴 EXISTE PORQUE MI PROPIO CHEQUEO DIO VERDE Y GITHUB DIJO QUE NO. El
24/09/2026, partiendo el ciclo en dos, el `ciclo.yml` quedó con **dos
claves `jobs:`**. `yaml.safe_load` lo acepta sin una palabra —se queda
con la última— así que el chequeo pasó, se commiteó, se pusheó, y recién
al disparar la corrida apareció:

    failed to parse workflow: 'jobs' is already defined

⚠️ **Un validador que dice que sí donde el de verdad dice que no es peor
que no validar**: da permiso para pushear. Es la misma forma que
`herramientas/chequeo_que_no_chequea.py` persigue del otro lado.

Lo que mira, y por qué cada cosa:

- **claves repetidas**, en cualquier nivel — el caso que lo hizo nacer;
- que cada workflow tenga `jobs` y al menos uno;
- que un `needs` apunte a un job que existe — un typo ahí deja el job
  esperando a nadie, y GitHub lo reporta recién al correr;
- que un `uses:` local apunte a un archivo que está — `./.github/
  actions/preparar` sin su `action.yml` falla en el runner, no antes;
- que los `run:` de una composite action traigan `shell:`, que es
  obligatorio ahí y no en un workflow;
- **que la hora anotada al lado de un cron sea la que de verdad cae.**
  El cron de GitHub es siempre UTC y no hay forma de escribir «9 AM
  EST», así que la única manera de que se entienda es anotarlo al
  lado — y una anotación que nadie comprueba se queda vieja el día que
  alguien mueve la hora UTC. Se miran EST **y** EDT por separado, que
  son una hora distintas y se alternan dos veces al año.
"""
import io
import os
import re
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass


def cargador():
    """Un `SafeLoader` que se planta con una clave repetida."""
    import yaml

    class Estricto(yaml.SafeLoader):
        pass

    def _mapa(loader, node, deep=False):
        vistas = set()
        for k, _v in node.value:
            c = loader.construct_object(k, deep=deep)
            if c in vistas:
                raise yaml.constructor.ConstructorError(
                    None, None, 'clave repetida: %r' % (c,), k.start_mark)
            vistas.add(c)
        return yaml.SafeLoader.construct_mapping(loader, node, deep)

    Estricto.add_constructor(
        yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, _mapa)
    return Estricto


#: `# ... = 09:00 EDT` / `= 08:00 EST` al lado de un cron
_HORA = re.compile(r'=\s*(\d{1,2}):(\d{2})\s*(EDT|EST)')
_CRON = re.compile(r"^\s*-\s*cron:\s*['\"]([^'\"]+)['\"]", re.M)


def horas_dichas(texto):
    """Que dicen los comentarios que cae cada cron, y que cae de verdad.

    🔴 UN COMENTARIO CON UNA HORA ES UN DATO, Y LOS DATOS SE QUEDAN
    VIEJOS. El cron de GitHub es siempre UTC y no hay forma de escribir
    «9 AM EST», asi que la unica manera de que se entienda es anotarlo
    al lado — y una anotacion que nadie comprueba es exactamente lo que
    este repo persigue: se mueve la hora UTC, el comentario se queda, y
    el que lo lee calcula mal.

    ⚠️ SE COMPRUEBAN LAS DOS, EST Y EDT. La costa este cambia dos veces
    al año: EDT es UTC−4 y EST UTC−5. Anotar una sola seria correcto
    seis meses y estaria una hora corrido los otros seis.
    """
    mal = []
    for m in _CRON.finditer(texto):
        campos = m.group(1).split()
        if len(campos) != 5 or campos[1] == '*':
            continue                      # pide un intervalo, no una hora
        try:
            hh = int(campos[1])
        except ValueError:
            continue
        # el comentario vive en las lineas de ARRIBA del cron
        antes = texto[:m.start()].split('\n')[-14:]
        for h, mi, z in _HORA.findall('\n'.join(antes)):
            real = (hh - (4 if z == 'EDT' else 5)) % 24
            if int(h) != real:
                mal.append('el cron de las %02d UTC dice %s:%s %s y son las '
                           '%02d:%s' % (hh, h, mi, z, real, campos[0].zfill(2)))
    return mal


def archivos():
    out = []
    for d in ('.github/workflows', '.github/actions'):
        for raiz, _ds, fs in os.walk(os.path.join(BASE, d)):
            for f in fs:
                if f.endswith(('.yml', '.yaml')):
                    out.append(os.path.join(raiz, f))
    return sorted(out)


def revisar(p, Estricto):
    """`[problema]` de ese archivo. Vacío si está bien."""
    import yaml
    rel = os.path.relpath(p, BASE).replace('\\', '/')
    try:
        d = yaml.load(io.open(p, encoding='utf-8'), Estricto)
    except Exception as e:                               # noqa: BLE001
        return ['no parsea: %s' % str(e).replace('\n', ' ')[:90]]
    if not isinstance(d, dict):
        return ['no es un mapa']
    mal = []

    # ── una composite action ──
    if 'runs' in d and (d.get('runs') or {}).get('using') == 'composite':
        for i, s in enumerate((d['runs'].get('steps') or []), 1):
            if 'run' in s and not s.get('shell'):
                mal.append('paso %d (%s) tiene `run` sin `shell`'
                           % (i, s.get('name') or '?'))
        return mal

    # ── las horas anotadas al lado de cada cron ──
    mal += horas_dichas(io.open(p, encoding='utf-8').read())

    # ── un workflow ──
    jobs = d.get('jobs')
    if not isinstance(jobs, dict) or not jobs:
        return ['no tiene `jobs`']
    for n, j in jobs.items():
        if not isinstance(j, dict):
            mal.append('el job %r no es un mapa' % n)
            continue
        ns = j.get('needs')
        for x in ([ns] if isinstance(ns, str) else (ns or [])):
            if x not in jobs:
                mal.append('el job %r espera a %r, que no existe' % (n, x))
        if not j.get('steps') and not j.get('uses'):
            mal.append('el job %r no tiene `steps`' % n)
        bajado = False
        for s in (j.get('steps') or []):
            u = (s or {}).get('uses') or ''
            if u.startswith('actions/checkout'):
                bajado = True
            if u.startswith('./'):
                # ⚠️ UN `uses` LOCAL SE RESUELVE EN EL RUNNER, no al
                # pushear: si la carpeta no está, el fallo aparece a mitad
                # de corrida y con un mensaje que no nombra el workflow.
                hay = any(os.path.exists(os.path.join(BASE, u[2:], f))
                          for f in ('action.yml', 'action.yaml'))
                if not hay:
                    mal.append('el job %r usa %s y ahí no hay action.yml'
                               % (n, u))
                # 🔴 Y TIENE QUE IR **DESPUES** DEL CHECKOUT. Esta regla
                # no la tenía y me costó una corrida: el archivo existía
                # en el repo —mi chequeo miraba eso y daba verde— pero la
                # action se lee del **disco del runner**, así que sin
                # checkout previo no está ahí. GitHub lo dice entero:
                #
                #   Can't find 'action.yml' … Did you forget to run
                #   actions/checkout before running your local action?
                #
                # ⚠️ Existir y estar disponible son dos preguntas
                # distintas, y yo estaba contestando la fácil.
                elif not bajado:
                    mal.append('el job %r usa %s ANTES de actions/checkout: '
                               'la action se lee del disco del runner' % (n, u))
    return mal


def main():
    try:
        Estricto = cargador()
    except ImportError:
        print('\n  ⚠️ falta pyyaml (`pip install pyyaml`)\n')
        return 0
    fs = archivos()
    print('\n══ LOS WORKFLOWS ══\n')
    mal = 0
    for p in fs:
        ps = revisar(p, Estricto)
        rel = os.path.relpath(p, BASE).replace('\\', '/')
        if ps:
            mal += len(ps)
            print('   🔴 %s' % rel)
            for x in ps:
                print('      %s' % x)
        else:
            print('   ✅ %s' % rel)
    print('\n   %s\n' % ('los %d están bien' % len(fs) if not mal
                         else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


if __name__ == '__main__':
    raise SystemExit(main())
