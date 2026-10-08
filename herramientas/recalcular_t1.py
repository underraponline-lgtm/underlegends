# -*- coding: utf-8 -*-
"""LA T1 ENTERA, VUELTA A LEER Y A PAGAR CON EL SISTEMA DE HOY — SIN ESCRIBIR NADA.

    python herramientas/recalcular_t1.py             # mide: quién sube, quién baja, qué evento entra o sale
    python herramientas/recalcular_t1.py --json X    # y deja el detalle en X

Dlx, 08/10/2026: *«recalcula todo con el sistema actual… antes había problemas porque el sistema antiguo aún
estaba»*. A «¿recalculo los 72 eventos con las reglas de hoy?», *«A»*: primero medirlo y mostrar quién cambia.

CÓMO
1. Una copia del repo (un worktree de HEAD) con `datos/` copiado: lo que el lector anota de paso —los canales, las
   fases, el OCR— queda en la copia y se borra con ella. Ni el repo de verdad ni el Sheet se tocan: el Sheet sólo
   se LEE (`Eventos Procesados`, `Resultados`, `Config`, el padrón).
2. El lector de hoy (`llaves_a_entrada.main()`, en simulacro) con la historia ENTERA de cada canal desde el inicio
   de la temporada. ⚠️ El ciclo mira los últimos 25 mensajes de cada canal (`escuchar.barrer()`), y en FFA eso es
   menos de una semana: acá se pide de a 100 con `before` hasta pasar `comun/temporada.INICIO`.
3. Cada evento, por el motor de hoy (`motor.procesar()`), con el número que ya tiene en `Eventos Procesados`.
4. Contra `Resultados`: por persona (los puntos de los eventos, sin el Most Wanted, que va aparte) y por evento.

⚠️ LO QUE NO SE ENCUENTRA EN DISCORD NO «SALE»: una llave borrada, una cargada de #veredictos que ya no está o una
decidida a mano quedan como están. La lista los separa para no confundir «cambió» con «no la pude leer».
"""
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class _Resp:
    """Una respuesta armada con todos los mensajes juntos, como la que espera `escuchar.barrer()`."""
    status_code = 200

    def __init__(self, ms):
        self._ms = ms

    def json(self):
        return self._ms


class Paginador:
    """La sesión de Discord, pero los mensajes de un canal vienen TODOS desde `desde`, de a 100 con `before`."""

    def __init__(self, s, desde):
        self.s, self.desde, self.pedidos = s, desde, 0

    def __getattr__(self, k):
        return getattr(self.s, k)

    def _pedir(self, url, params=None, **k):
        r = None
        for _ in range(8):
            self.pedidos += 1
            r = self.s.get(url, params=params, **k)
            if r.status_code != 429:
                return r
            try:
                espera = float(r.json().get('retry_after', 1))
            except ValueError:
                espera = 1.0
            time.sleep(espera + 0.25)
        return r

    def get(self, url, params=None, **k):
        if not re.search(r'/channels/\d+/messages$', url) or not params or set(params) != {'limit'}:
            return self._pedir(url, params, **k)
        todos, antes = [], None
        while True:
            p = {'limit': 100}
            if antes:
                p['before'] = antes
            r = self._pedir(url, p, **k)
            if r.status_code != 200:
                return r if not todos else _Resp(todos)
            ms = r.json() or []
            todos += ms
            if len(ms) < 100 or str(ms[-1].get('timestamp') or '')[:19] < self.desde:
                return _Resp(todos)
            antes = ms[-1]['id']


def _hijo(salida):
    """Corre ADENTRO de la copia: lee, paga y compara."""
    raiz = os.getcwd()
    sys.path[:0] = [os.path.join(raiz, 'bot'), os.path.join(raiz, 'sheet'), raiz]
    from comun import temporada as TEMP
    import escuchar as E
    desde = TEMP.INICIO[:19]
    real = E.sesion
    pag = []

    def _sesion():
        p = Paginador(real(), desde)
        pag.append(p)
        return p

    E.sesion = _sesion
    _esc = E.escuchar
    E.escuchar = lambda s, forzar=None, por_canal=25: _esc(s, forzar=True, por_canal=100)
    import llaves_a_entrada as L
    sys.argv = ['llaves_a_entrada.py']
    L.main()
    U = L.ULTIMA
    filas = U.get('filas') or []

    import motor
    import procesar_entrada as PE
    from escribir import Hoja
    evs = PE.agrupar(filas)
    ya = PE.numeros_por_evento(Hoja('Eventos Procesados'))
    tab, mods = motor.tablas(), motor.modificadores()
    resolver, _n = motor._resolvedor()
    nuevos = {}
    sin_numero = []
    for (nombre, sv, fecha), bs in evs.items():
        n = ya.get((nombre, sv, fecha))
        try:
            ev = motor.procesar(bs, num=n or 0, fecha=fecha, servidor=sv, tab=tab, mods=mods, resolver=resolver)
        except ValueError as e:
            sin_numero.append([nombre, sv, fecha, 'el motor no pudo: %s' % e])
            continue
        clave = str(n) if n else 'nuevo:%s|%s|%s' % (nombre, sv, fecha)
        nuevos[clave] = {'nombre': nombre, 'sv': sv, 'fecha': fecha, 'n': n, 'filas': bs,
                         'pts': {r['rapero']: int(r['puntos']) for r in ev['resultados']},
                         'pos': {r['rapero']: r['posicion'] for r in ev['resultados']},
                         'avisos': ev['avisos'], 'sin_resolver': ev['sin_resolver']}
    # lo de hoy: `Resultados` = [n, fecha, sv, escala, rapero, cc, posición, puntos, mw, total]
    hoy = {}
    for f in Hoja('Resultados').filas():
        f = list(f) + [''] * 10
        n = str(f[0]).strip()
        if not n.isdigit():
            continue
        try:
            p = int(float(str(f[7]).replace(',', '.') or 0))
        except ValueError:
            p = 0
        d = hoy.setdefault(n, {'fecha': str(f[1]), 'sv': str(f[2]), 'pts': {}, 'pos': {}})
        d['pts'][str(f[4]).strip()] = d['pts'].get(str(f[4]).strip(), 0) + p
        d['pos'][str(f[4]).strip()] = str(f[6])
    nombres = {str(v): k for k, v in ya.items()}
    out = {'hoy': hoy, 'nuevos': nuevos, 'nombres': {k: list(v) for k, v in nombres.items()},
           'sin_numero': sin_numero, 'pedidos': sum(p.pedidos for p in pag),
           'en_curso': [list(x[:2]) for x in U.get('en_curso') or []],
           'incompletos': [list(x[:3]) for x in U.get('incompletos') or []],
           'ya_cargadas': [list(map(str, x[:4])) for x in U.get('ya_cargadas') or []],
           'descartados': [list(x[:3]) for x in U.get('descartados') or []],
           'retenidos': [list(map(str, x[:4])) for x in U.get('retenidos') or []],
           'dudas': len(U.get('dudas') or [])}
    with io.open(salida, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False)
    return 0


def _dia(f):
    """`'dd/mm'` -> número de día del año (para comparar fechas cercanas), o `None`."""
    try:
        dd, mm = str(f).split('/')[:2]
        return (int(mm) - 1) * 31 + int(dd)
    except ValueError:
        return None


def _parecido(a, b):
    """Cuánta gente comparten dos eventos, sobre el más chico (0 a 1)."""
    a, b = set(a), set(b)
    return len(a & b) / max(1, min(len(a), len(b)))


def emparejar(d):
    """🔴 LO LEÍDO CON OTRO NOMBRE O FECHA ES EL MISMO EVENTO, y lo cargado dos veces, un duplicado.

    La primera corrida dio «(sin título) FFA 06/10» como un evento que entraba —15 con puntos, PRAISERIZA +10.000—:
    era el #412 (PRITTY FREE CLASIFICATORIA 3, 05/10), que el ciclo nombró por su anuncio. Y el #397 (DESGRACIAS EN
    TOKYO VOL 22) «no se pudo volver a leer» porque es el MISMO que el #404 (VOL 22 pandillas): 11 de 13 en común y
    los mismos puntos, cargado dos veces. Por la clave (nombre, servidor, fecha) no se ve ninguna de las dos cosas;
    por la gente en común, sí. Mismo servidor, a menos de 3 días."""
    hoy, nuevos = d['hoy'], d['nuevos']
    usados = {k for k in nuevos if not k.startswith('nuevo:')}
    for k in [k for k in list(nuevos) if k.startswith('nuevo:')]:
        e = nuevos[k]
        cands = sorted(((_parecido(e['pts'], h['pts']), n) for n, h in hoy.items()
                        if n not in usados and h['sv'] == e['sv'] and _dia(h['fecha']) is not None
                        and _dia(e['fecha']) is not None and abs(_dia(h['fecha']) - _dia(e['fecha'])) <= 3),
                       reverse=True)
        if cands and cands[0][0] >= 0.6:
            n = cands[0][1]
            nuevos[n] = dict(e, n=int(n), antes=k)
            del nuevos[k]
            usados.add(n)
    dups = {}
    for n in [n for n in hoy if n not in usados]:
        h = hoy[n]
        for m in usados:
            o = hoy.get(m)
            if (o and o['sv'] == h['sv'] and _dia(o['fecha']) is not None and _dia(h['fecha']) is not None
                    and abs(_dia(o['fecha']) - _dia(h['fecha'])) <= 3 and _parecido(h['pts'], o['pts']) >= 0.8
                    and sorted(h['pts'].values()) == sorted(o['pts'].values())):
                dups[n] = m
                break
    d['duplicados'] = dups
    return d


def _informe(d, detalle=None):
    d = emparejar(d)
    hoy, nuevos = d['hoy'], d['nuevos']
    nombres = d['nombres']
    dups = d.get('duplicados') or {}
    print('\n══ LA T1, VUELTA A PAGAR CON EL SISTEMA DE HOY (nada se escribió) ══\n')
    print('   %d pedidos a Discord · %d evento(s) hoy en `Resultados` · %d leídos de nuevo'
          % (d['pedidos'], len(hoy), len(nuevos)))
    # por persona
    tot_h, tot_n = {}, {}
    for n, e in hoy.items():
        for q, p in e['pts'].items():
            tot_h[q] = tot_h.get(q, 0) + p
    leidos = {k for k in nuevos if not k.startswith('nuevo:')}
    no_leidos = sorted((n for n in hoy if n not in leidos and n not in dups), key=int)
    for k, e in nuevos.items():
        for q, p in e['pts'].items():
            tot_n[q] = tot_n.get(q, 0) + p
    # lo que no se pudo volver a leer queda como está; el duplicado sale
    for n in no_leidos:
        for q, p in hoy[n]['pts'].items():
            tot_n[q] = tot_n.get(q, 0) + p
    cambios = sorted(((tot_n.get(q, 0) - tot_h.get(q, 0), q) for q in set(tot_h) | set(tot_n)
                      if tot_n.get(q, 0) != tot_h.get(q, 0)), key=lambda x: (-abs(x[0]), x[1]))
    # por evento
    ev_cambian = []
    for k, e in sorted(nuevos.items(), key=lambda kv: (kv[0].startswith('nuevo:'), kv[0])):
        if k.startswith('nuevo:'):
            continue
        h = hoy.get(k, {'pts': {}})
        if h['pts'] != e['pts']:
            mas = {q: e['pts'].get(q, 0) - h['pts'].get(q, 0) for q in set(h['pts']) | set(e['pts'])
                   if e['pts'].get(q, 0) != h['pts'].get(q, 0)}
            ev_cambian.append((k, e, mas))
    entran = [(k, e) for k, e in nuevos.items() if k.startswith('nuevo:')]
    d['_cambian'] = [k for k, _e, _m in ev_cambian]
    print('   %d persona(s) cambian · %d evento(s) cambian · %d entran · %d duplicado(s) · %d no se pudieron volver '
          'a leer\n' % (len(cambios), len(ev_cambian), len(entran), len(dups), len(no_leidos)))
    if dups:
        print('   -- cargados dos veces: el primero sale --')
        for n, m in sorted(dups.items(), key=lambda x: int(x[0])):
            a, b = nombres.get(n) or ['?'], nombres.get(m) or ['?']
            print('   #%-4s %-30s es el #%s %s · %d con puntos'
                  % (n, str(a[0])[:30], m, str(b[0])[:30], len(hoy[n]['pts'])))
        print('')
    if ev_cambian:
        print('   -- los eventos que cambian --')
        for k, e, mas in ev_cambian:
            print('   #%-4s %-30s %-5s %s' % (k, e['nombre'][:30], e['sv'], e['fecha']))
            for q, v in sorted(mas.items(), key=lambda x: -abs(x[1]))[:8]:
                print('          %-22s %+7d   %s → %s' % (q[:22], v, hoy.get(k, {}).get('pos', {}).get(q, '—'),
                                                         e['pos'].get(q, '—')))
            if len(mas) > 8:
                print('          … y %d más' % (len(mas) - 8))
    if entran:
        print('\n   -- eventos que hoy no están y entrarían --')
        for k, e in entran:
            print('   %-36s %-5s %s  · %d con puntos' % (e['nombre'][:36], e['sv'], e['fecha'], len(e['pts'])))
    if no_leidos:
        print('\n   -- no se pudieron volver a leer (quedan como están) --')
        for n in no_leidos:
            nm = nombres.get(n) or ['?', hoy[n]['sv'], hoy[n]['fecha']]
            print('   #%-4s %-30s %-5s %s' % (n, str(nm[0])[:30], nm[1], nm[2]))
    if cambios:
        print('\n   -- por persona: los puntos de los eventos (sin Most Wanted) --')
        for v, q in cambios[:40]:
            print('   %-24s %+8d   (%d → %d)' % (q[:24], v, tot_h.get(q, 0), tot_n.get(q, 0)))
        if len(cambios) > 40:
            print('   … y %d más' % (len(cambios) - 40))
    for k, t in (('en_curso', 'en curso, sin campeón'), ('incompletos', 'incompletos: van a Pendientes'),
                 ('ya_cargadas', 'ya cargadas con otro nombre'), ('descartados', 'Dlx dijo que no cuentan'),
                 ('retenidos', 'retenidos por la guía')):
        if d.get(k):
            print('\n   -- %s --' % t)
            for x in d[k]:
                print('   %s' % ' · '.join(str(y) for y in x))
    if detalle:
        with io.open(detalle, 'w', encoding='utf-8') as f:
            json.dump(d, f, ensure_ascii=False, indent=1)
        print('\n   el detalle, en %s' % detalle)
    print('')


def aplicar(d):
    """Lo medido, a las hojas. Dlx, 08/10/2026, al informe: *«1. A»* —todo, también el #359—.

    · LOS QUE CAMBIAN: sus filas a `Entrada`, con el nombre, el servidor y la fecha con que ya están cargados —así
      conservan su número y `procesar_entrada.py` los REEMPLAZA en vez de sumar otro—, y se procesan como en el ciclo
      (`--aplicar --limpiar`).
    · LOS CARGADOS DOS VECES: a `sacar` de `datos/decisiones.json`, como cuando Dlx contesta «es el mismo evento»
      en ✅ Decidir (`decidir.numeros_a_sacar()`): el ciclo los saca en la corrida siguiente.
    · LO QUE ENTRARÍA (un evento que no está): no se toca acá. Si es de verdad, el ciclo lo carga.

    ⚠️ NO A LAS :22 NI A LAS :52: el ciclo escribe las mismas hojas y `datos/`."""
    sys.path[:0] = [os.path.join(BASE, 'bot'), os.path.join(BASE, 'sheet'), BASE]
    from procesar_entrada import COL_A, CAMPOS
    from escribir import Hoja
    import decidir as DEC
    filas = []
    for n in d.get('_cambian') or []:
        nom, sv, fe = (d['nombres'].get(n) or [None, None, None])[:3]
        e = d['nuevos'].get(n) or {}
        if not nom or not e.get('filas'):
            print('   ⚠️ #%s: no sé con qué nombre está cargado, no lo toco' % n)
            continue
        filas += [dict(f, evento=nom, servidor=sv, fecha=fe) for f in e['filas']]
    if filas:
        h = Hoja('Entrada')
        desplazo = ord(COL_A.upper()) - ord('A')
        h.agregar([[''] * desplazo + [f.get(c, '') for c in CAMPOS] for f in filas], dry=False)
        print('   ✅ %d fila(s) de %d evento(s) en `Entrada`' % (len(filas), len(d.get('_cambian') or [])))
    dups = d.get('duplicados') or {}
    if dups:
        dd = DEC._decisiones()
        for n, m in dups.items():
            nom, sv, fe = (d['nombres'].get(n) or ['', '', ''])[:3]
            dd.setdefault('sacar', {})[str(n)] = {'es': int(m), 'nombre': nom, 'sv': sv, 'fecha': fe,
                                                  'cuando': DEC._ahora_et(), 'por': 'Dlx (chat)',
                                                  'nota': 'el recálculo de la T1 (08/10/2026, «1. A»): es el #%s '
                                                          'otra vez, con la misma gente y los mismos puntos' % m}
        with io.open(DEC.DECISIONES, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(dd, f, ensure_ascii=False, indent=1)
            f.write('\n')
        print('   ✅ %d duplicado(s) a `sacar` (datos/decisiones.json): salen en la corrida siguiente' % len(dups))
    if filas:
        r = subprocess.run([sys.executable, os.path.join(BASE, 'sheet', 'procesar_entrada.py'), '--aplicar', '--limpiar'],
                           cwd=BASE, env=dict(os.environ, PYTHONIOENCODING='utf-8'))
        if r.returncode != 0:
            raise SystemExit('   🔴 procesar_entrada.py no terminó bien: mirá `Entrada`')


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--hijo' in sys.argv:
        return _hijo(sys.argv[sys.argv.index('--hijo') + 1])
    detalle = sys.argv[sys.argv.index('--json') + 1] if '--json' in sys.argv else None
    # el informe otra vez, de un detalle ya guardado: sin volver a leer Discord (tarda y son ~1.500 pedidos)
    if '--informe' in sys.argv:
        with io.open(sys.argv[sys.argv.index('--informe') + 1], encoding='utf-8') as f:
            d = json.load(f)
        _informe(d)
        if '--aplicar' in sys.argv:
            aplicar(d)
        return 0
    tmp = tempfile.mkdtemp(prefix='recalcular_t1_')
    copia = os.path.join(tmp, 'copia')
    salida = os.path.join(tmp, 'salida.json')
    try:
        subprocess.run(['git', 'worktree', 'add', '--detach', '-q', copia, 'HEAD'], cwd=BASE, check=True)
        # lo que no está commiteado todavía (el código de esta misma corrida), y los `datos/` de ahora
        dif = subprocess.run(['git', 'diff', '--name-only', 'HEAD'], cwd=BASE, capture_output=True, text=True).stdout
        for rel in [x for x in dif.split('\n') if x.strip() and not x.startswith('datos/')] + ['herramientas/recalcular_t1.py']:
            src = os.path.join(BASE, rel)
            if os.path.isfile(src):
                shutil.copy(src, os.path.join(copia, rel))
        shutil.rmtree(os.path.join(copia, 'datos'), ignore_errors=True)
        shutil.copytree(os.path.join(BASE, 'datos'), os.path.join(copia, 'datos'))
        for x in ('creds.json', '.env', 'oauth_token.json', '.cache'):
            if os.path.exists(os.path.join(BASE, x)):
                if os.path.isdir(os.path.join(BASE, x)):
                    shutil.copytree(os.path.join(BASE, x), os.path.join(copia, x))
                else:
                    shutil.copy(os.path.join(BASE, x), os.path.join(copia, x))
        r = subprocess.run([sys.executable, os.path.join(copia, 'herramientas', 'recalcular_t1.py'), '--hijo', salida],
                           cwd=copia, capture_output=True, text=True, encoding='utf-8', errors='replace',
                           env=dict(os.environ, PYTHONIOENCODING='utf-8'))
        if r.returncode != 0 or not os.path.exists(salida):
            print(r.stdout[-3000:])
            print(r.stderr[-3000:])
            raise SystemExit('   🔴 el recálculo no terminó')
        with io.open(salida, encoding='utf-8') as f:
            d = json.load(f)
        _informe(d, detalle)
        if '--aplicar' in sys.argv:
            aplicar(d)
    finally:
        subprocess.run(['git', 'worktree', 'remove', '--force', copia], cwd=BASE, capture_output=True)
        shutil.rmtree(tmp, ignore_errors=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
