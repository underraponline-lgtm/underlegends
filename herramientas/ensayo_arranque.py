# -*- coding: utf-8 -*-
"""EL ARRANQUE DE LA TEMPORADA, ENSAYADO ANTES DE QUE PASE.

    python herramientas/ensayo_arranque.py            el ensayo entero
    python herramientas/ensayo_arranque.py --sin-red  sin el simulacro del Sheet

🔑 Dlx, 28/09/2026, a «ensayar el 5/10 antes de que llegue»: *«dale, pero
probablemente se extienda por la apelación que tenemos que hacer»*. Por eso
NADA ACÁ TIENE LA FECHA ESCRITA: sale de `comun/temporada.py` (`FECHAS` y
`FOTO_LIBRE`), y el ensayo sirve para la fecha que diga ahí el día que se
corra. Si la fecha se mueve, se cambia ahí —y se vuelve a desplegar el Worker
con `bot/desplegar.py`, que recibe la temporada y la ventana de la foto—.

🔴 EXISTE PORQUE EL ARRANQUE PASA A LAS 00:00 ET Y NADIE VA A ESTAR MIRANDO.
A esa hora cambian solas varias cosas a la vez —las llaves que cuentan, el
Most Wanted, la semana de multiplicadores, la encuesta del ×2—, y el paso 0
del ciclo archiva y vacía la fase de prueba en el Sheet. Cada pieza tiene su
self-check con su fecha; lo que no tenía nadie es la pregunta de conjunto:
«¿qué va a hacer cada una a esa hora?». Esto se la hace a cada una, con su
propio `ahora=`, sin tocar el reloj de nadie.

⚠️ NO ESCRIBE NADA: ni el Sheet (el paso 0 va en simulacro), ni KV, ni R2,
ni `datos/`. Sólo lee.
"""
import datetime as dt
import io
import json
import os
import subprocess
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _p in (BASE, os.path.join(BASE, 'bot'), os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

from comun import temporada as T      # noqa: E402

UTC = dt.timezone.utc


def _et():
    try:
        from zoneinfo import ZoneInfo
        return ZoneInfo('America/New_York')
    except Exception:                                    # noqa: BLE001
        return dt.timezone(dt.timedelta(hours=-4))


def et(t):
    """Un instante en hora del este, como lo lee Dlx: «lun 05/10 12:00 AM ET»."""
    if not t:
        return '—'
    if isinstance(t, str):
        t = dt.datetime.fromisoformat(t.replace('Z', '+00:00'))
    e = t.astimezone(_et())
    dias = ('lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom')
    return '%s %s %s ET' % (dias[e.weekday()], e.strftime('%d/%m'), e.strftime('%I:%M %p').lstrip('0'))


def _json(*partes):
    try:
        with io.open(os.path.join(BASE, *partes), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def cuando():
    """El arranque, el fin, la foto y cuánto falta."""
    a = T.arranque()
    if not a:
        print('   🔴 la temporada %s no tiene fecha en comun/temporada.py' % T.ACTUAL)
        return None
    ta = dt.datetime.fromisoformat(a)
    ahora = dt.datetime.now(UTC)
    fin = (T.FECHAS.get(T.ACTUAL) or ('', ''))[1]
    print('   la %s arranca    %s   (%s)' % (T.ACTUAL.upper(), et(ta),
          ('en %.1f días' % ((ta - ahora).total_seconds() / 86400)) if ta > ahora else 'YA ARRANCÓ'))
    print('   termina          %s' % (fin or '—'))
    print('   foto libre hasta %s' % et(T.foto_libre_hasta()))
    ya = (_json('datos', 'arranque.json') or {}).get(T.ACTUAL)
    print('   paso 0 del ciclo %s' % ('ya se hizo: %s' % et(ya) if ya else
                                      'todavía no: lo hace la primera corrida después del arranque'))
    return ta


def relojes(ta):
    """Qué contesta cada pieza con fecha un minuto antes y un minuto después."""
    antes, despues = ta - dt.timedelta(minutes=1), ta + dt.timedelta(minutes=1)
    lunes = ta + dt.timedelta(hours=11, minutes=1)      # el primer lunes a las 11 AM ET
    filas = []
    import most_wanted as MW
    filas.append(('Most Wanted', MW.tipo_de(antes), MW.tipo_de(despues),
                  'diario en la prueba, semanal en la temporada'))
    try:
        s = MW.siguiente(despues)
        filas.append(('  el Elegido que se vota', '—', '%s (%s → %s)' % (s[0], et(s[1]), et(s[2])) if s else 'nada',
                      'desde el arranque se vota la primera semana'))
    except Exception as e:                               # noqa: BLE001
        filas.append(('  el Elegido que se vota', '?', 'no pude (%s)' % str(e)[:40], ''))
    import multiplicadores as MU
    pa, pd = MU.periodo(antes), MU.periodo(despues)
    filas.append(('multiplicadores: la semana', '%s → %s' % (et(pa[1]), et(pa[2])),
                  '%s → %s' % (et(pd[1]), et(pd[2])), 'el arranque corta la semana; la nueva se sortea ahí'))
    import encuestas as EN
    for q, t in (('el ×2 de la semana', despues), ('el ×2, el lunes', lunes)):
        x = EN.x2(t)
        filas.append(('  ' + q, '', ('%s · se vota hasta %s · %s' % (x['id'], et(x['hasta']), ', '.join(x['op'])))
                      if x else 'no hay', ''))
    print('')
    print('   %-28s %-24s %s' % ('', 'un minuto antes', 'un minuto después'))
    for q, a, d, por in filas:
        print('   %-28s %-24s %s' % (q, str(a)[:24], d))
        if por:
            print('   %-28s %s' % ('', '↳ ' + por))


def llaves(ta):
    """Los eventos de la prueba que dejan de contar."""
    ll = _json('datos', 'llaves_t1.json') or {}
    dia = ta.astimezone(_et()).date().isoformat()
    prueba = [r for r in ll.values() if isinstance(r, dict) and str(r.get('dia') or '') < dia]
    gente = {str(f[0]) for r in prueba for f in (r.get('tabla') or []) if f}
    print('   %d evento(s) de la fase de prueba —con %d nombres en sus tablas— se archivan'
          % (len(prueba), len(gente)))
    print('   y `inicio()` pasa a %s: sus llaves dejan de leerse aunque se editen' % et(ta))
    print('   ⚠️ el pool queda en CERO: «0 de 0» es un estado, no un error (CLAUDE.md)')


def fuera():
    """Las tarjetas de quien no pasa el portón, con la fecha en que se borran."""
    import fuera as F
    d = (_json('datos', 'fuera_desde.json') or {})
    desde = d.get('desde') if isinstance(d.get('desde'), dict) else d
    por_dia = {}
    for _k, v in (desde or {}).items():
        try:
            f = dt.date.fromisoformat(str(v)[:10]) + dt.timedelta(days=F.DIAS)
        except ValueError:
            continue
        por_dia[f] = por_dia.get(f, 0) + 1
    if not por_dia:
        print('   nadie en la cuenta')
        return
    for f in sorted(por_dia)[:4]:
        print('   %s   %d persona(s) sin pasar el portón pierden sus tarjetas' % (f.strftime('%d/%m'), por_dia[f]))


def paso0(sin_red):
    """El paso 0 del ciclo, en simulacro: qué archiva y vacía."""
    if sin_red:
        print('   (salteado: --sin-red)')
        return
    r = subprocess.run([sys.executable, os.path.join(BASE, 'sheet', 'resetear.py'), '--prueba'],
                       capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=240)
    for l in (r.stdout or '').splitlines():
        if l.strip() and 'ARRANQUE' not in l:
            print('   ' + l.strip())
    if r.returncode:
        print('   🔴 el simulacro salió con %d: %s' % (r.returncode, (r.stderr or '').strip()[-200:]))


def a_mano():
    print('   si la fecha se mueve (la apelación):')
    print('     1. `FECHAS` y `FOTO_LIBRE` en comun/temporada.py —un solo lugar—')
    print('     2. python bot/desplegar.py   (el Worker recibe TEMPORADA y FOTO_LIBRE_HASTA)')
    print('     3. este ensayo otra vez, y NOVEDADES')


def main():
    print('\n══ EL ARRANQUE DE LA TEMPORADA, ENSAYADO ══\n')
    ta = cuando()
    if not ta:
        return 1
    print('\n── a las 00:00 ET, cada pieza con fecha ──')
    relojes(ta)
    print('\n── las llaves ──')
    llaves(ta)
    print('\n── el paso 0 del ciclo: el Sheet (simulacro) ──')
    paso0('--sin-red' in sys.argv)
    print('\n── las tarjetas de quien no pasa el portón ──')
    fuera()
    print('\n── lo que va a mano ──')
    a_mano()
    print('')
    return 0


if __name__ == '__main__':
    sys.exit(main())
