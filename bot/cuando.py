# -*- coding: utf-8 -*-
"""CUANDO EMPIEZA, DE VERDAD. De «EN 30 MINUTOS» a una hora.

    python bot/cuando.py            lo que sale de los anuncios de hoy
    python bot/cuando.py --auto     el self-check, sin red

🔴 EXISTE PARA LA CUENTA ATRAS. Dlx, 23/09/2026: *«quizas el appscript
dentro del oficial sheet puede hacer un countdown del tiempo que
pongamos? entonces si dice en 30m pues cada segundo va restando»*. Para
restar hace falta un **instante**, y lo que el anuncio trae es una
frase.

⚠️ ESTO CONTRADICE A `anuncios.py` A PROPOSITO, Y CONVIENE LEER POR QUE.
Su encabezado dice: *«el HORARIO es texto libre —"EN 30 MINUTOS",
"ahora"— asi que NO se convierte a una fecha. Inventar un timestamp a
partir de "ahora" seria poner un dato plausible donde hay una frase»*.
Eso era correcto **mientras el timestamp saliera de la nada**. No es el
caso: sale de **dos datos que los dos estan registrados** —la hora del
mensaje (`cuando`, que la da Discord) y el desfase que el mensaje
declara—. «EN 30 MINUTOS» publicado a las 01:30 es la 01:00 + 30, no una
suposicion.

⚠️ LA REGLA QUE SE MANTIENE ES LA OTRA: lo que no se puede derivar
devuelve `None` y no se muestra ninguna cuenta. Un reloj que corre hacia
una hora inventada es peor que no tener reloj.

🔴 LAS HORAS ABSOLUTAS NO SE PARSEAN, Y ES UNA DECISION. «a las 21:00»
no dice **de donde**: la Liga es de Argentina, Chile, Colombia, España y
México, que son cinco husos. Un anuncio a las 21:00 de Madrid y otro a
las 21:00 de Bogotá son siete horas distintas, y el error no se ve — sale
una cuenta atrás perfectamente formada que termina cuando no es. Lo
relativo («en 30») no tiene ese problema: es relativo al mensaje, y la
hora del mensaje la pone Discord en UTC.
"""
import datetime as _dt
import io
import json
import os
import re
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

#: «EN 30 MINUTOS», «EN 15 MIN», «en 15», «EN 2 HORAS», «en media hora».
#:
#: ⚠️ EL NUMERO SIN UNIDAD SON MINUTOS, y sale de los datos, no de una
#: preferencia: medido sobre los 25 anuncios reales, los que dicen «EN
#: 15» a secas son avisos de que falta un rato para empezar. Nadie
#: anuncia un evento «en 15 horas» sin escribir «horas».
_EN = re.compile(r'\ben\s+(\d{1,3})\s*(m|min|mins|minuto|minutos|'
                 r'h|hs|hr|hrs|hora|horas)?\b', re.I)
_MEDIA = re.compile(r'\ben\s+media\s+hora\b', re.I)
_AHORA = re.compile(r'\b(ahora|ya|empez(ando|amos)|arrancamos|'
                    r'comenzamos|en\s+vivo)\b', re.I)

_HORAS = ('h', 'hs', 'hr', 'hrs', 'hora', 'horas')

#: Mas alla de esto, la frase no habla del arranque.
#:
#: ⚠️ ES UN TOPE DE CORDURA, no un filtro de vigencia. «EN 300» es casi
#: seguro un cupo mal leido o parte de otra frase; cinco horas de aviso
#: existen, cinco dias no se anuncian con «en».
TOPE_MIN = 60 * 12


def desfase(horario):
    """Minutos desde el anuncio hasta el evento. `None` si no se sabe.

    `0` es «ahora», que **no** es lo mismo que `None`: uno dice que
    empieza al publicarse y el otro que no se puede saber.
    """
    t = str(horario or '').strip()
    if not t:
        return None
    if _MEDIA.search(t):
        return 30
    m = _EN.search(t)
    if m:
        n = int(m.group(1))
        unidad = (m.group(2) or '').lower()
        mins = n * 60 if unidad in _HORAS else n
        return mins if 0 < mins <= TOPE_MIN else None
    # ⚠️ «ahora» SE PREGUNTA DESPUES DE «en N», y no antes. «en 15 ya
    # arrancamos» trae las dos cosas, y la que manda es la que da el
    # numero: contestar 0 ahi adelantaría el evento un cuarto de hora.
    if _AHORA.search(t):
        return 0
    return None


def ahora_utc():
    """El ahora en UTC, naive — el mismo formato que `cuando`.

    ⚠️ `utcnow()` esta deprecado y devuelve naive; `now(timezone.utc)`
    devuelve aware. Mezclar los dos revienta al restarlos, asi que se
    normaliza a naive en un solo lugar.
    """
    return _dt.datetime.now(_dt.timezone.utc).replace(tzinfo=None)


def _leer_iso(s):
    """`'2026-09-23T01:30:41'` -> datetime naive UTC. `None` si no."""
    t = str(s or '')[:19]
    try:
        return _dt.datetime.strptime(t, '%Y-%m-%dT%H:%M:%S')
    except ValueError:
        return None


#: la marca de tiempo de Discord: `<t:1790109000>` o `<t:1790109000:F>`
_MARCA = re.compile(r'<t:(\d{9,11})(?::[tTdDfFR])?>')


def momento(anuncio):
    """Cuándo arranca ese anuncio, en ISO UTC. `None` si no se puede.

    `anuncio` es un dict de `bot/anuncios.py`: usa `horario` y `cuando`.

    ⚠️ LA MARCA DE DISCORD GANA A TODO: es la hora exacta que el propio
    Discord le muestra a cada uno en su zona. Snake Rap la usa —«INICIO
    DEL TORNEO: <t:1790109000:F>»—, y no depende de cuándo se publicó el
    anuncio como «EN 30 MINUTOS».
    """
    m = _MARCA.search(str(anuncio.get('horario') or ''))
    if m:
        return _dt.datetime.fromtimestamp(int(m.group(1)), _dt.timezone.utc) \
            .replace(tzinfo=None).strftime('%Y-%m-%dT%H:%M:%S')
    d = desfase(anuncio.get('horario'))
    if d is None:
        return None
    t = _leer_iso(anuncio.get('cuando'))
    if t is None:
        return None
    return (t + _dt.timedelta(minutes=d)).strftime('%Y-%m-%dT%H:%M:%S')


def proximos(anuncios, ahora=None, cuantos=3, margen_min=0):
    """Los que todavía no empezaron, del más cercano al más lejano.

    🔴 SOLO LOS FUTUROS, Y ESE ES EL PUNTO DE LA FUNCION. Medido sobre
    los 25 anuncios reales: **«Lamanija 4x4 · EN 15» se publicó el 21/09
    a las 05:23**, o sea que su cuenta atrás terminó hace dos días. Una
    lista que no filtre muestra un contador en negativo, o peor, uno que
    diga «en 15 minutos» para siempre porque se recalcula desde una
    frase en vez de desde una hora.

    ⚠️ `margen_min` deja pasar los que arrancaron recién: un evento que
    empezó hace diez minutos sigue siendo la respuesta correcta a «¿qué
    está pasando?». Con 0 se van en cuanto cruzan la hora.
    """
    ahora = ahora or ahora_utc()
    corte = ahora - _dt.timedelta(minutes=margen_min)
    out = []
    for a in anuncios or ():
        iso = momento(a)
        if not iso:
            continue
        t = _leer_iso(iso)
        if t is None or t < corte:
            continue
        out.append((iso, a))
    out.sort(key=lambda x: x[0])
    # 🔴 EL ANUNCIO ENTERO, NO SIETE CLAVES. Esto devolvía un dict armado a
    # mano y `bot/subir_web.py` le pedía `msg_id`, `guild_id`, `canal_id`,
    # `modalidad` y `premios`, que no estaban: «Lo que viene» salía sin el
    # link que Dlx pidió, sin modalidad ni premio, y sin excluirse de «Lo que
    # pasó». Y `cupos` se leía de una clave que el anuncio no tiene: la suya
    # es `cupos_texto`. Encontrado por la auditoría del 25/09/2026.
    #
    # ⚠️ `cuando` pasa a ser el ARRANQUE; el de la publicación queda en
    # `publicado`.
    return [dict(a, cuando=iso, publicado=a.get('cuando') or '',
                 nombre=a.get('nombre') or 'sin nombre',
                 servidor=a.get('servidor') or '', horario=a.get('horario') or '',
                 faltan_min=int((_leer_iso(iso) - ahora).total_seconds() // 60),
                 cupos=a.get('cupos_texto') or a.get('cupos') or '',
                 inscripciones=a.get('inscripciones') or '')
            for iso, a in out[:cuantos]]


def texto_falta(minutos):
    """`95` -> `'1 h 35 min'`. Para la vitrina, que no tiene segundos."""
    if minutos is None:
        return ''
    if minutos <= 0:
        return 'ahora'
    h, m = divmod(int(minutos), 60)
    if h and m:
        return '%d h %d min' % (h, m)
    if h:
        return '%d h' % h
    return '%d min' % m


def _cargar():
    try:
        with io.open(os.path.join(BASE, 'datos', 'anuncios.json'),
                     encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def _self_check():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:                                    # noqa: BLE001
        pass
    print('\n  cuando.py — self-check\n')
    mal = 0

    def ok(cond, que):
        nonlocal mal
        mal += not cond
        print('   %s %s' % ('ok' if cond else '🔴', que))

    # 🔴 LAS FRASES SON LAS REALES, sacadas de datos/anuncios.json. Un
    # parser probado con las frases que uno inventa acierta siempre.
    print('  las frases que aparecen de verdad')
    casos = [
        ('EN 30 MINUTOS', 30), ('en 15 se abren inscripciones', 15),
        ('EN 15', 15), ('EN 15 __', 15), ('ahora', 0), ('Ahora', 0),
        ('', None), (None, None),
        ('EN 2 HORAS', 120), ('en media hora', 30), ('en 1 hora', 60),
        ('EN 45 MIN', 45),
    ]
    for t, esp in casos:
        d = desfase(t)
        ok(d == esp, '%-32r -> %s' % (t, d if d is not None else '— (no se sabe)'))

    print('\n  lo que NO se convierte, a propósito')
    for t in ('a las 21:00', 'mañana', 'el sábado', 'cuando se llene',
              'EN 9999', '??'):
        ok(desfase(t) is None, '%-22r no da ninguna hora' % t)

    # ⚠️ «en 15 ya arrancamos» tiene las dos señales y gana el número
    ok(desfase('en 15 ya arrancamos') == 15,
       'con número y «ya», manda el número')

    print('\n  de la frase a la hora')
    a = {'horario': 'EN 30 MINUTOS', 'cuando': '2026-09-23T01:30:41'}
    ok(momento(a) == '2026-09-23T02:00:41', 'anuncio 01:30 + 30 min = 02:00')
    ok(momento({'horario': 'ahora', 'cuando': '2026-09-23T03:13:45'})
       == '2026-09-23T03:13:45', '«ahora» es la hora del propio mensaje')
    ok(momento({'horario': 'EN 30', 'cuando': 'basura'}) is None,
       'sin hora de mensaje no hay cuenta')
    ok(momento({'horario': '', 'cuando': '2026-09-23T01:30:41'}) is None,
       'sin frase tampoco')
    # la de Snake Rap: la marca de Discord, exacta y sin mirar `cuando`
    ok(momento({'horario': '<t:1790109000:F>', 'cuando': 'basura'})
       == '2026-09-22T20:30:00', 'la marca <t:…> de Snake Rap es la hora exacta')

    print('\n  solo los que todavía no pasaron')
    ahora = _dt.datetime(2026, 9, 23, 2, 0, 0)
    ann = [
        {'nombre': 'ya pasó', 'horario': 'EN 15',
         'cuando': '2026-09-21T05:23:14'},          # el caso real de Lamanija
        {'nombre': 'en 30', 'horario': 'EN 30 MINUTOS',
         'cuando': '2026-09-23T02:00:00'},
        {'nombre': 'en 10', 'horario': 'EN 10',
         'cuando': '2026-09-23T02:00:00'},
        {'nombre': 'sin hora', 'horario': '', 'cuando': '2026-09-23T02:00:00'},
    ]
    p = proximos(ann, ahora=ahora)
    ok([x['nombre'] for x in p] == ['en 10', 'en 30'],
       'ordena por cercanía y deja fuera el pasado y el que no se sabe: %s'
       % [x['nombre'] for x in p])
    ok(p[0]['faltan_min'] == 10, 'y dice cuántos minutos faltan (%s)'
       % p[0]['faltan_min'])

    # 🔴 EL DE HACE DOS DIAS NO PUEDE ENTRAR. Es el que destapa que la
    # cuenta se calcula desde una HORA y no desde la frase: parseando la
    # frase cada vez, «EN 15» diria «en 15 minutos» para siempre.
    ok(all(x['nombre'] != 'ya pasó' for x in p),
       'un «EN 15» del 21/09 no dice «en 15 minutos» hoy')

    print('\n  el texto de la vitrina')
    for m, esp in ((95, '1 h 35 min'), (60, '1 h'), (5, '5 min'),
                   (0, 'ahora'), (-3, 'ahora'), (None, '')):
        ok(texto_falta(m) == esp, '%-5s -> %r' % (m, texto_falta(m)))

    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


def main():
    if '--auto' in sys.argv:
        return _self_check()
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:                                    # noqa: BLE001
        pass
    d = _cargar()
    ann = d.get('anuncios') or []
    print('\n  %d anuncio(s) guardados · leídos %s\n'
          % (len(ann), d.get('cuando', '?')))
    con, sin = 0, 0
    for a in ann:
        iso = momento(a)
        if iso:
            con += 1
        else:
            sin += 1
    print('  %d con hora deducible · %d sin ella\n' % (con, sin))
    p = proximos(ann, cuantos=5, margen_min=30)
    if not p:
        print('  no hay ninguno por empezar.\n')
        print('  ⚠️ Es lo esperable si los anuncios son viejos: la cuenta')
        print('     sale de la hora del mensaje, no de la frase.\n')
        return 0
    print('  los que vienen:\n')
    for x in p:
        print('   %-38s %-6s  %s  (decía «%s»)'
              % (x['nombre'][:38], x['servidor'],
                 texto_falta(x['faltan_min']), x['horario']))
    print('')
    return 0


if __name__ == '__main__':
    raise SystemExit(main() or 0)
