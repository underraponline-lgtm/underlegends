# -*- coding: utf-8 -*-
"""LOS MULTIPLICADORES DE LA SEMANA: cuánto vale un punto de Temporada en cada servidor.

    python bot/multiplicadores.py            el de esta semana, sin escribir nada
    python bot/multiplicadores.py --aplicar  sortea si hace falta y escribe
                                             datos/multiplicadores.json (paso 0b)
    python bot/multiplicadores.py --auto     el self-check, sin red ni archivos

Dlx, 27/09/2026: *«cada semana haya un multiplicador de puntos que tú vas a
decidir randomamente… FFA va a dar x1 de puntos pero los eventos de Snake
Rap darán 2x esta semana y los eventos de URBF darán x5… luego podríamos dar
debuffs también»*. Y a las tres preguntas: *«me gusta hasta x5»*, el debuff
*«sí, a cualquiera»*, y *«desde ya»*.

LAS REGLAS (todas acá arriba: Dlx va a rebalancear al final)
------------------------------------------------------------
- Cada lunes a las 11 AM ET se sortea uno por servidor de la Liga: los que
  el bot lee (`datos/bot_en.json`). Si el bot entra a otro, entra al sorteo.
- Uno sale **fuerte**: ×2 o ×3, y ×5 más o menos una semana de cada cuatro.
- Uno puede salir **×0,5** —el debuff—, cualquiera.
- El resto, ×1, ×1,5 o ×2.

🔴 NUNCA TOCA EL COMPETITIVO: se aplica al sumar los Puntos de la Temporada
(`rankings.agregar_temporada()`), y el Score lee `Resultados` sin
multiplicar. Tampoco multiplica el Most Wanted: su recompensa es la suya.

⚠️ LO SORTEADO SE GUARDA Y NO SE VUELVE A SORTEAR. Los puntos de un evento
usan el multiplicador de la semana en que se jugó, para siempre: si mañana
cambian las reglas, lo de antes no se mueve.

⚠️ EL PRIMERO ARRANCÓ A MITAD DE SEMANA («desde ya», domingo 27/09), y
arrancó en el momento del sorteo: lo jugado antes esa semana no se
multiplica, porque cuando se jugó no había multiplicadores.

⚠️ Y EL ARRANQUE DE LA TEMPORADA CORTA LA SEMANA, como en el Most Wanted: la
de la prueba termina a las 00:00 ET del arranque y la primera de la
temporada va de ahí al lunes de la semana siguiente (ver `periodo()`).
"""
import datetime as dt
import hashlib
import io
import json
import os
import random
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE):
    if _p not in sys.path:
        sys.path.insert(0, _p)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

SALIDA = os.path.join(BASE, 'datos', 'multiplicadores.json')

# ── los números, todos acá ───────────────────────────────────────────────
#: la semana arranca el lunes a esta hora del este (como el Most Wanted)
ARRANCA_H = 11
#: el fuerte de la semana: (valor, peso). ×5 una semana de cada cuatro
FUERTE = ((2, 45), (3, 30), (5, 25))
#: la chance de que alguno salga ×0,5, y cuánto vale
DEBUFF, DEBUFF_X = 0.6, 0.5
#: los demás
RESTO = ((1, 50), (1.5, 35), (2, 15))
#: si el bot no dice en qué servidores está, estos
SERVIDORES = ('DRA', 'FFA', 'SR', 'URBF')
#: una semana que empieza a menos de esto después del arranque se junta con la anterior
JUNTAR = dt.timedelta(days=3)

ET = None


def _et():
    global ET
    if ET is None:
        try:
            import zoneinfo
            ET = zoneinfo.ZoneInfo('America/New_York')
        except Exception:                                # noqa: BLE001
            ET = dt.timezone(dt.timedelta(hours=-4))
    return ET


def _iso(t):
    return t.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def _de_iso(s):
    return dt.datetime.fromisoformat(str(s).replace('Z', '+00:00'))


def _arranque():
    """El arranque de la temporada (00:00 ET de su primer día), o `None`."""
    from comun.temporada import arranque
    a = arranque()
    return dt.datetime.fromisoformat(a) if a else None


def _lunes(t):
    """El lunes a las `ARRANCA_H` ET más reciente que no pasa de `t`."""
    e = t.astimezone(_et())
    ini = e.replace(hour=ARRANCA_H, minute=0, second=0, microsecond=0)
    if e < ini:
        ini -= dt.timedelta(days=1)
    return (ini - dt.timedelta(days=ini.weekday())).astimezone(dt.timezone.utc)


def periodo(ahora=None, a=None):
    """`(id, inicio, fin)` de la semana que contiene a `ahora`, en UTC.

    De lunes a lunes a las 11 AM ET. ⚠️ EL ARRANQUE DE LA TEMPORADA ES UN
    CORTE: la semana que lo cruza termina ahí, y la siguiente empieza ahí.
    Si esa siguiente quedara de horas (el arranque es un lunes a las 00:00 y
    la semana empieza a las 11), se junta con la otra: una «semana» de once
    horas en plena madrugada no sirve para nada.
    """
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    a = _arranque() if a is None else a
    ini = _lunes(ahora)
    fin = ini + dt.timedelta(days=7)
    if a and ini <= a < fin:
        if ahora < a:
            fin = a
        else:
            ini = a
    if a and a <= ini < a + JUNTAR:
        ini = a
    if a and a <= fin < a + JUNTAR and ini == a:
        fin += dt.timedelta(days=7)
    return ini.astimezone(_et()).strftime('%Y-%m-%d'), ini, fin


def servidores():
    """Los servidores que entran al sorteo: donde está el bot."""
    try:
        with io.open(os.path.join(BASE, 'datos', 'bot_en.json'), encoding='utf-8') as f:
            svs = [s for s in json.load(f) or [] if isinstance(s, str) and s]
        return sorted(set(svs)) or list(SERVIDORES)
    except (OSError, ValueError):
        return list(SERVIDORES)


def _pesado(rnd, opciones):
    tot = sum(p for _v, p in opciones)
    x = rnd.uniform(0, tot)
    for v, p in opciones:
        x -= p
        if x <= 0:
            return v
    return opciones[-1][0]


def sortear(svs, semilla):
    """`{servidor: multiplicador}`: uno fuerte, quizás un ×0,5, y el resto.

    Con la misma semilla sale lo mismo (el id de la semana): se puede volver
    a mirar. Pero lo que vale es lo GUARDADO, no lo que sale de acá.
    """
    rnd = random.Random(hashlib.sha256(('mult' + semilla).encode()).hexdigest())
    svs = sorted(svs)
    rnd.shuffle(svs)
    out = {}
    if not svs:
        return out
    out[svs[0]] = _pesado(rnd, FUERTE)
    resto = svs[1:]
    if resto and rnd.random() < DEBUFF:
        out[resto[0]] = DEBUFF_X
        resto = resto[1:]
    for sv in resto:
        out[sv] = _pesado(rnd, RESTO)
    return out


def leer(ruta=None):
    """`datos/multiplicadores.json`, o `{}`."""
    try:
        with io.open(ruta or SALIDA, encoding='utf-8') as f:
            return json.load(f) or {}
    except (OSError, ValueError):
        return {}


def actual(d=None, ahora=None):
    """La semana guardada que contiene a `ahora`, o `None`."""
    d = leer() if d is None else d
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    for s in d.get('semanas') or []:
        if _de_iso(s['inicio']) <= ahora < _de_iso(s['fin']):
            return s
    return None


def factor_de(d=None):
    """Una función `(servidor, instante) -> multiplicador`, con lo guardado.

    `instante` es un `datetime` con zona. Fuera de toda semana sorteada, o en
    un servidor que no entró, vale 1.

    ⚠️ SI EL ARCHIVO ESTÁ PERO NO SE PUEDE LEER, REVIENTA: sumar sin
    multiplicar una corrida bajaría los puntos de todos y los volvería a
    subir en la siguiente, con las tarjetas redibujándose dos veces. Mejor
    que la vitrina no se escriba esa vez.
    """
    if d is None:
        if os.path.exists(SALIDA):
            with io.open(SALIDA, encoding='utf-8') as f:
                d = json.load(f) or {}
        else:
            d = {}
    semanas = [(_de_iso(s['inicio']), _de_iso(s['fin']), s.get('sv') or {})
               for s in d.get('semanas') or []]

    def factor(sv, instante):
        if not instante or not sv:
            return 1
        for ini, fin, m in semanas:
            if ini <= instante < fin:
                return m.get(sv, 1)
        return 1
    return factor


def correr(ahora=None, aplicar=False):
    """Si la semana de ahora no tiene sorteo, lo hace. Devuelve el archivo."""
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    d = leer()
    semanas = d.get('semanas') or []
    pid, ini, fin = periodo(ahora)
    if not any(s.get('id') == pid for s in semanas):
        try:
            from comun.temporada import ACTUAL
            a = _arranque()
            temp = ACTUAL if a and ahora >= a else 'prueba'
        except Exception:                                # noqa: BLE001
            temp = 'prueba'
        semanas.append({
            'id': pid,
            # 🔑 el primero de todos arranca en el sorteo, no el lunes: ver arriba
            'inicio': _iso(ini if semanas else max(ini, ahora)),
            'fin': _iso(fin), 'temporada': temp, 'sorteado': _iso(ahora),
            'sv': sortear(servidores(), pid)})
    out = {'_leeme': 'Los multiplicadores de cada semana: los sortea bot/multiplicadores.py '
                     '(paso 0b del ciclo) y NO se vuelven a sortear. Las reglas viven en ese archivo.',
           'semanas': semanas}
    if aplicar:
        with io.open(SALIDA, 'w', encoding='utf-8') as f:
            json.dump(out, f, ensure_ascii=False, indent=1)
    return out


# ── self-check ───────────────────────────────────────────────────────────
def _self_check():
    print('\n══ MULTIPLICADORES ══\n')
    mal = 0

    def ok(c, que):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', que))

    et = _et()
    a = dt.datetime(2026, 10, 5, 0, 0, tzinfo=et).astimezone(dt.timezone.utc)
    en = lambda m, d, h, mi=0: dt.datetime(2026, m, d, h, mi, tzinfo=et)
    pid, ini, fin = periodo(en(9, 30, 15), a)
    ok(pid == '2026-09-28' and ini == en(9, 28, 11) and fin == en(10, 5, 0),
       'la semana de la prueba va del lunes 28 a las 11 al arranque (00:00 del 5)  %s' % pid)
    p1 = periodo(en(10, 5, 0, 22), a)
    p2 = periodo(en(10, 5, 11, 22), a)
    ok(p1 == p2 and p1[1] == en(10, 5, 0) and p1[2] == en(10, 12, 11),
       'la primera de la temporada va del arranque al lunes 12 a las 11, a cualquier hora del 5')
    pid, ini, fin = periodo(en(10, 14, 15), a)
    ok(pid == '2026-10-12' and (fin - ini).days == 7, 'y después, de lunes a lunes  %s' % pid)
    pid, ini, fin = periodo(en(11, 3, 12), a)
    ok(fin.astimezone(et).hour == 11, 'cruzando el cambio de horario sigue a las 11 AM ET')

    svs = ['DRA', 'FFA', 'SR', 'URBF']
    m = sortear(svs, '2026-10-12')
    vals = sorted(m.values())
    ok(set(m) == set(svs) and max(vals) >= 2 and sum(1 for v in vals if v < 1) <= 1,
       'uno por servidor, uno fuerte y como mucho un ×0,5  %s' % m)
    ok(sortear(svs, '2026-10-12') == m, 'con la misma semilla, lo mismo')
    n5 = sum(1 for i in range(400) if 5 in sortear(svs, 's%d' % i).values())
    nd = sum(1 for i in range(400) if DEBUFF_X in sortear(svs, 's%d' % i).values())
    ok(60 <= n5 <= 140 and 180 <= nd <= 300,
       'en 400 semanas: ×5 en %d (una de cada cuatro) y un ×0,5 en %d' % (n5, nd))

    # el factor: sólo dentro de la semana, sólo el servidor que salió
    d = {'semanas': [{'id': 'x', 'inicio': _iso(en(9, 27, 12)), 'fin': _iso(en(9, 28, 11)),
                      'sv': {'SR': 2, 'URBF': 0.5}}]}
    f = factor_de(d)
    ok(f('SR', en(9, 27, 20)) == 2 and f('URBF', en(9, 27, 20)) == 0.5 and f('FFA', en(9, 27, 20)) == 1,
       'dentro de la semana, cada servidor con el suyo; el que no salió, ×1')
    ok(f('SR', en(9, 27, 11)) == 1 and f('SR', en(9, 28, 11)) == 1,
       'antes del sorteo y desde el lunes a las 11, ×1 (no se aplica para atrás)')
    ok(f('SR', None) == 1, 'un evento sin fecha, ×1')
    print('\n   %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal


def main():
    a = sys.argv[1:]
    if '--auto' in a:
        return 1 if _self_check() else 0
    out = correr(aplicar='--aplicar' in a)
    s = actual(out)
    print('\n══ LOS MULTIPLICADORES ══\n')
    if not s:
        print('   (ninguna semana sorteada cubre este momento)\n')
        return 0
    print('   semana %s · %s → %s ET' % (s['id'], _de_iso(s['inicio']).astimezone(_et()).strftime('%d/%m %H:%M'),
                                         _de_iso(s['fin']).astimezone(_et()).strftime('%d/%m %H:%M')))
    for sv, x in sorted(s['sv'].items(), key=lambda kv: -kv[1]):
        print('      %-5s ×%s' % (sv, ('%g' % x).replace('.', ',')))
    if '--aplicar' not in a:
        print('\n   (simulacro: no escribí nada — `--aplicar`)')
    print()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
