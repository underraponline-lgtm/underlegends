# -*- coding: utf-8 -*-
"""LA MADRUGADA, SIN CICLO: de 3 a 11 AM ET no corre ninguna sincronización.

    python bot/madrugada.py --evento schedule   `corre=true|false` para GitHub
    python bot/madrugada.py --auto              el self-check, sin red

Dlx, 25/09/2026: *«después de las 3am EST hasta las 11am EST que haya un
retraso digamos de cada 4 horas para que hayan 2 pasados o incluso una.
Debido a que a esas horas en sí los eventos no hay ninguno»*.

Y después, el mismo día: *«durante las 3am EST y 11am EST no se hará
ninguna sincronización para ahorrar más»*.

LA REGLA
--------
De 3:00 a 10:59 AM ET **no corre el ciclo**: la última corrida es la de las
2:52 y la siguiente la de las 11:22. Hasta el 25/09/2026 corría a las 6:52 y
a las 10:52; se sacaron las dos. Menos commits del ciclo, menos minutos de
Actions, menos lecturas del Sheet y de Discord.

⚠️ EL VIGÍA DE LOS AVISOS NO SE TOCA: sigue cada minuto. Casi no cuesta
—vive en el Worker, no en Actions— y es lo que avisa en el acto si alguna
vez hay un evento a esa hora. Esto frena el ciclo, no los avisos.

⚠️ LA HORA ES LA DEL ESTE DE VERDAD, con el cambio de horario: un cron de
GitHub no sabe de EDT y EST, así que la decisión no puede vivir en el
`schedule:` del `.yml`. La toma este archivo, con `zoneinfo`.

⚠️ LA VENTANA VIVE EN DOS LUGARES —acá y en `MADRUGADA` de `bot/worker.js`,
que es el que dispara a los :22 y :52— y el self-check los compara. Si
alguien cambia uno solo, CI se pone rojo.

QUIÉN LA MIRA
-------------
  bot/worker.js      no dispara el ciclo fuera de los dos horarios
  ciclo.yml          el cron de respaldo de GitHub (:07 y :37) no corre en
                     la ventana: los dos horarios los cubre el Worker
  bot/alertar.py     el disparador puede callarse ~8 h y media sin que sea un fallo
"""
import datetime
import io
import os
import re
import sys

SCR = os.path.dirname(os.path.abspath(__file__))

#: la ventana, en horas del este: [DESDE, HASTA)
DESDE, HASTA = 3, 11
#: las horas de la ventana en que sí corre (a los :52, la segunda mitad).
#: Vacío desde el 25/09/2026: ninguna.
HORAS = ()
#: lo máximo que puede callarse el disparador, en minutos: 2:52 -> 11:22 son
#: 510, más el margen de la alerta de siempre
PAUSA_MADRUGADA = 510 + 20
PAUSA_NORMAL = 75


def _este(t=None):
    t = t or datetime.datetime.now(datetime.timezone.utc)
    try:
        import zoneinfo
        return t.astimezone(zoneinfo.ZoneInfo('America/New_York'))
    except Exception:                                    # noqa: BLE001
        return t.astimezone(datetime.timezone(datetime.timedelta(hours=-4)))


def en_ventana(t=None):
    """¿Es de madrugada, en hora del este?"""
    return DESDE <= _este(t).hour < HASTA


def toca_ciclo(t=None):
    """¿Corre el ciclo en este disparo del Worker? Lo mismo que `tocaCiclo()`."""
    e = _este(t)
    if not DESDE <= e.hour < HASTA:
        return True
    return e.hour in HORAS and e.minute >= 30


def pausa_max(t=None):
    """Cuántos minutos puede tener la última marca del disparador sin que
    sea un fallo: en la madrugada, la pausa entre las dos corridas."""
    e = _este(t)
    # hasta las 11:30, porque la primera corrida normal es la de las 11:22
    if DESDE <= e.hour < HASTA or (e.hour == HASTA and e.minute < 30):
        return PAUSA_MADRUGADA
    return PAUSA_NORMAL


def _self_check():
    print('')
    print('  madrugada.py — self-check')
    print('')
    mal = 0

    def ok(cond, que):
        nonlocal mal
        mal += not cond
        print('   %s %s' % ('ok' if cond else '🔴', que))

    utc = datetime.timezone.utc
    # 25/09/2026 es horario de verano: ET = UTC-4
    f = lambda h, m: datetime.datetime(2026, 9, 25, h + 4, m, tzinfo=utc)
    ok(toca_ciclo(f(2, 52)), '2:52 AM corre (la última antes de la ventana)')
    ok(not toca_ciclo(f(3, 22)) and not toca_ciclo(f(5, 52)), '3:22 y 5:52 AM no')
    ok(not toca_ciclo(f(6, 52)) and not toca_ciclo(f(10, 52)), '6:52 y 10:52 AM tampoco')
    ok(toca_ciclo(f(11, 22)), '11:22 AM vuelve a lo de siempre')
    ok(sum(toca_ciclo(f(h, m)) for h in range(3, 11) for m in (22, 52)) == 0,
       'en la ventana no corre NINGUNA vez')
    # en invierno (EST, UTC-5) la ventana sigue siendo la misma hora local
    inv = datetime.datetime(2026, 12, 15, 5 + 5, 52, tzinfo=utc)
    ok(not toca_ciclo(inv) and toca_ciclo(inv.replace(hour=11 + 5, minute=22)),
       'en invierno (EST) la ventana sigue a la misma hora local')
    ok(pausa_max(f(9, 0)) == PAUSA_MADRUGADA and pausa_max(f(14, 0)) == PAUSA_NORMAL,
       'la alerta del disparador espera más de madrugada')

    # ⚠️ LA MISMA VENTANA EN EL WORKER, que es el que dispara
    with io.open(os.path.join(SCR, 'worker.js'), encoding='utf-8') as fh:
        js = fh.read()
    m = re.search(r'MADRUGADA = \{ desde: (\d+), hasta: (\d+), horas: \[([\d, ]*)\] \}', js)
    igual = bool(m) and (int(m.group(1)), int(m.group(2))) == (DESDE, HASTA) and \
        tuple(int(x) for x in m.group(3).split(',') if x.strip()) == HORAS
    ok(igual, 'el Worker dispara con la misma ventana  %s'
       % (m.group(0) if m else 'no encontré MADRUGADA en worker.js'))
    print('')
    print('   %s' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return 1 if mal else 0


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    a = sys.argv[1:]
    if '--auto' in a:
        return _self_check()
    if '--evento' in a:
        ev = a[a.index('--evento') + 1] if a.index('--evento') + 1 < len(a) else ''
        # ⚠️ SÓLO EL CRON DE GITHUB SE FRENA. Lo que dispara el Worker ya
        # pasó por `tocaCiclo()`, y lo que dispara Dlx a mano, corre.
        corre = ev != 'schedule' or not en_ventana()
        print('corre=%s' % ('true' if corre else 'false'))
        if not corre:
            print('   (madrugada: de 3 a 11 AM ET no corre ninguna sincronización)',
                  file=sys.stderr)
        return 0
    print('en la ventana: %s · toca ciclo: %s' % (en_ventana(), toca_ciclo()))
    return 0


if __name__ == '__main__':
    raise SystemExit(main() or 0)
