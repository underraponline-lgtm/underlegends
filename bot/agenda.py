# -*- coding: utf-8 -*-
"""📅 LO AGENDADO CON /agendar, COMO UN ANUNCIO MÁS.

    python bot/agenda.py            lo que hay agendado, sin escribir nada
    python bot/agenda.py --aplicar  y lo deja en datos/agenda.json (lo corre el ciclo)
    python bot/agenda.py --auto     el self-check, sin red ni archivos

Dlx, 12/10/2026, a las ideas para que haya eventos anunciados con tiempo (*«la mayoría de servidores anuncian eventos
instantáneos… casi no hay muchos futuros»*): *«5. … D»*. El staff de un servidor escribe `/agendar` con el día, la
hora y el país de esa hora; el Worker lo guarda en el objeto (`agendar()` de `bot/avisos.js`) y esto lo trae.

🔑 SE VUELVE UN ANUNCIO, NO UNA COSA APARTE. `como_anuncios()` lo convierte en la misma forma que `datos/anuncios.json`,
con la hora como la marca de Discord (`<t:…:F>`), que `cuando.momento()` lee exacta. Así el calendario, el «suele
jugar», el premio por anunciar con tiempo (`multiplicadores.con_tiempo()`) y el cruce con su llave (`llaves_web.cruzar()`)
lo tratan igual que a un anuncio, sin una regla nueva en cada uno.

⚠️ Y EL ANUNCIO DE VERDAD GANA: si el servidor después lo anuncia en su canal —el mismo servidor, a ±3 horas, con una
palabra propia del nombre en común—, lo agendado no se duplica.
"""
import datetime as dt
import hashlib
import io
import json
import os
import re
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

SALIDA = os.path.join(BASE, 'datos', 'agenda.json')
WORKER = 'https://liga-global-bot.liga-global-ul.workers.dev'
#: a cuántas horas de un anuncio de verdad del mismo servidor, lo agendado es el mismo evento
MISMO_H = 3
_GENERICAS = {'vol', 'volumen', 'fecha', 'edicion', 'copa', 'torneo', 'evento', 'batalla', 'batallas', 'liga', 'free',
              'freestyle', 'rap', 'gran', 'final', 'the', 'del', 'los', 'las'}


def _iso(ms):
    return dt.datetime.fromtimestamp(ms / 1000, dt.timezone.utc).replace(tzinfo=None).strftime('%Y-%m-%dT%H:%M:%S')


def _palabras(s):
    import unicodedata
    t = unicodedata.normalize('NFKD', str(s or '').lower())
    t = ''.join(c for c in t if not unicodedata.combining(c))
    return {w for w in re.findall(r'[a-z0-9]+', t) if len(w) >= 4 and w not in _GENERICAS}


def _ini(x):
    import cuando as CU
    try:
        return dt.datetime.fromisoformat(str(CU.momento(x) or '')[:19])
    except ValueError:
        return None


def como_anuncios(anuncios=None, agenda=None):
    """Lo agendado, como anuncios (`datos/anuncios.json`), sin lo que ya anunció el servidor de verdad."""
    agenda = (leer().get('agenda') or []) if agenda is None else agenda
    reales = []
    for x in anuncios or []:
        if x.get('agenda'):
            continue
        t = _ini(x)
        if t:
            reales.append((x.get('servidor'), t, _palabras(x.get('nombre')), str(x.get('nombre') or '').strip().lower()))
    out = []
    for a in agenda:
        ini = dt.datetime.fromtimestamp(a['ini'] / 1000, dt.timezone.utc).replace(tzinfo=None)
        pa, na = _palabras(a['nombre']), a['nombre'].strip().lower()
        if any(sv == a['sv'] and abs((t - ini).total_seconds()) <= MISMO_H * 3600 and (n == na or (pa & p))
               for sv, t, p, n in reales):
            continue
        out.append({'nombre': a['nombre'], 'servidor': a['sv'], 'canal': '', 'msg_id': 'ag-%s' % a['id'],
                    'cuando': _iso(a['t']), 'guild_id': a.get('g') or '', 'canal_id': '', 'organizador': '',
                    'horario': '<t:%d:F>' % (a['ini'] // 1000), 'modalidad': a.get('formato') or '', 'fecha': '',
                    'premios': '', 'rango': '', 'cupos_texto': '', 'agenda': True})
    return out


def leer(ruta=None):
    try:
        with io.open(ruta or SALIDA, encoding='utf-8') as f:
            return json.load(f) or {}
    except (OSError, ValueError):
        return {}


def correr(aplicar=False):
    import requests
    import fotos as F
    tok = F.env('DISCORD_TOKEN', obligatorio=False)
    if not tok:
        print('   ⚠️ sin DISCORD_TOKEN: no traigo la agenda')
        return 0
    k = hashlib.sha256(('lg-ciclo:' + tok).encode('utf-8')).hexdigest()
    try:
        r = requests.get(WORKER + '/avisos/agenda-ciclo', headers={'x-lg-ciclo': k}, timeout=30)
        ag = (r.json() or {}).get('agenda') if r.ok else None
    except (OSError, ValueError) as e:
        print('   ⚠️ la agenda no contestó (%s)' % str(e)[:60])
        return 0
    if ag is None:
        print('   ⚠️ la agenda no contestó (%s)' % r.status_code)
        return 0
    # sin quién lo agendó: el repo es público
    ag = [{k2: v for k2, v in a.items() if k2 != 'quien'} for a in ag]
    ahora = dt.datetime.now(dt.timezone.utc).timestamp() * 1000
    print('   📅 %d agendado(s), %d por venir' % (len(ag), sum(1 for a in ag if a['ini'] > ahora)))
    for a in ag:
        if a['ini'] > ahora:
            print('      %-5s %-30s %s' % (a['sv'], a['nombre'][:30], _iso(a['ini'])))
    if aplicar:
        with io.open(SALIDA, 'w', encoding='utf-8', newline='\n') as f:
            json.dump({'_leeme': 'Lo agendado con /agendar (bot/agenda.py): cada evento con su hora en ms UTC (`ini`) y '
                                 'cuándo se agendó (`t`). Se vuelve un anuncio más con `como_anuncios()`.',
                       'agenda': ag}, f, ensure_ascii=False, indent=1)
            f.write('\n')
    return 0


def _self_check():
    print('\n══ LA AGENDA ══\n')
    mal = 0

    def ok(c, q, extra=''):
        nonlocal mal
        mal += not c
        print('   %s %s%s' % ('✅' if c else '🔴', q, ('  ' + extra) if extra and not c else ''))
    t0 = int(dt.datetime(2026, 10, 12, 20, tzinfo=dt.timezone.utc).timestamp() * 1000)
    ini = int(dt.datetime(2026, 10, 18, 23, tzinfo=dt.timezone.utc).timestamp() * 1000)
    ag = [{'id': 1, 'sv': 'SR', 'g': '1', 'nombre': 'Copa Serpiente 3', 'ini': ini, 'formato': '1vs1', 't': t0},
          {'id': 2, 'sv': 'FFA', 'g': '2', 'nombre': 'La Previa', 'ini': ini, 'formato': '', 't': t0}]
    an = como_anuncios([], ag)
    import cuando as CU
    ok(len(an) == 2 and CU.momento(an[0]) == '2026-10-18T23:00:00' and an[0]['agenda'] and an[0]['modalidad'] == '1vs1',
       'lo agendado es un anuncio, con su hora exacta (la marca de Discord)', str(an[:1]))
    real = [{'nombre': 'COPA SERPIENTE 3 🐍', 'servidor': 'SR', 'cuando': '2026-10-17T20:00:00', 'horario': '<t:%d:F>' % (ini // 1000 + 3600)}]
    an2 = como_anuncios(real, ag)
    ok([x['nombre'] for x in an2] == ['La Previa'], 'si el servidor lo anuncia de verdad, lo agendado no se duplica')
    otro = [{'nombre': 'COPA SERPIENTE 3', 'servidor': 'FFA', 'cuando': '2026-10-17T20:00:00', 'horario': '<t:%d:F>' % (ini // 1000)}]
    ok(len(como_anuncios(otro, ag)) == 2, 'el mismo nombre en otro servidor es otro evento')
    import multiplicadores as MU
    pub = dt.datetime.fromisoformat(an[0]['cuando'])
    ok((dt.datetime.fromisoformat(CU.momento(an[0])) - pub).total_seconds() >= MU.DESTACADO_H * 3600,
       'agendado seis días antes: cuenta como anunciado con tiempo')
    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        sys.exit(_self_check())
    sys.exit(correr(aplicar='--aplicar' in sys.argv))
