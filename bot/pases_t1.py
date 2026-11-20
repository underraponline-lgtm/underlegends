# -*- coding: utf-8 -*-
"""🎟️ LOS PASES QUE REGALA CADA TIER 1 (el plan de los tiers; Dlx, 20/11/2026: «Los asigno yo»).

Cada mes Dlx le asigna a cada servidor Tier 1, desde el Dashboard, cuántos Pases premium regala y en qué eventos (el
ajuste `pases_t1`: `{SV: {mes: 'AAAA-MM', n, ev: [clave, …]}}`, la clave como la de los eventos de estilo: su número o
`a:<id del anuncio>`). El campeón de cada uno de esos eventos se lleva un Pase premium: un vale en su Inventario
(`premium_vale` del objeto, el mismo camino que los campeones de liga: `pase.vales_campeones()`), que usa cuando quiere.

    python bot/pases_t1.py --auto     el self-check

DÓNDE QUEDA: `datos/pases_t1.json` (`{mes, eventos: {número: sigla}}`, lo que ya se resolvió a número con el calendario,
desde `bot/subir_web.py`) y los vales, con el paquete del Pase (`pase.armar()` → `vales`).

⚠️ VALE SÓLO EL MES EN CURSO y SÓLO EVENTOS DE ESE SERVIDOR (el `sv` del calendario). Si Dlx marcó más eventos que Pases,
se los llevan los campeones de los primeros `n` que se jugaron.
"""
import io
import json
import os
import re
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE):
    if _p not in sys.path:
        sys.path.insert(0, _p)
ARCH = os.path.join(BASE, 'datos', 'pases_t1.json')
LEEME = ('🎟️ Los eventos cuyos campeones se llevan un Pase premium de regalo de un Tier 1, del mes en curso (`bot/pases_t1.py`): '
         'el ajuste `pases_t1` del Dashboard resuelto a número de evento con el calendario')
CLAVE = re.compile(r'^(a:[0-9]{15,22}|[0-9]{1,6})$')


def claves(it):
    """Las claves de un evento del calendario: su número y el id de su anuncio (como `eventos_estilo.claves()`)."""
    out = []
    if it.get('ll') and re.match(r'^[0-9]{1,6}$', str(it['ll'])):
        out.append(str(it['ll']))
    m = re.search(r'/([0-9]{15,22})/?$', str(it.get('link') or ''))
    if m:
        out.append('a:' + m.group(1))
    return out


def resolver(calendario, pases, mes):
    """`{número: sigla}` de los eventos ya jugados (con llave) que dan un Pase este mes. Pura."""
    out = {}
    for sv, x in (pases or {}).items():
        if not isinstance(x, dict) or str(x.get('mes') or '') != mes or not re.match(r'^[A-Z]{2,6}$', str(sv)):
            continue
        quiero = {str(k) for k in (x.get('ev') or []) if CLAVE.match(str(k))}
        for it in calendario or []:
            if str(it.get('sv') or '') != sv or not it.get('ll') or not re.match(r'^[0-9]{1,6}$', str(it['ll'])):
                continue
            if quiero & set(claves(it)):
                out[str(it['ll'])] = sv
    return dict(sorted(out.items(), key=lambda kv: int(kv[0])))


def _mes():
    import datetime as dt
    import zoneinfo
    return dt.datetime.now(zoneinfo.ZoneInfo('America/New_York')).strftime('%Y-%m')


def marcar(calendario, aj=None, escribir=True):
    """Desde `bot/subir_web.py`, con el calendario de la temporada. Sin ajustes (el Worker no contestó), no toca nada."""
    if aj is None:
        try:
            import multiplicadores as MU
            aj = MU.ajustes_dueno()
        except Exception as e:                           # noqa: BLE001
            print('   ⚠️ los Pases de los Tier 1: %s' % str(e)[:80])
            return None
    if aj is None:
        return None
    mes = _mes()
    eventos = resolver(calendario, aj.get('pases_t1') or {}, mes)
    nuevo = {'_leeme': LEEME, 'mes': mes, 'cupos': {sv: int((x or {}).get('n') or 0) for sv, x in sorted((aj.get('pases_t1') or {}).items())
                                                    if isinstance(x, dict) and str(x.get('mes') or '') == mes},
             'eventos': eventos}
    antes = _j(ARCH, {})
    if escribir and {k: v for k, v in antes.items() if k != '_leeme'} != {k: v for k, v in nuevo.items() if k != '_leeme'}:
        with io.open(ARCH, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(nuevo, f, ensure_ascii=False, indent=1)
            f.write('\n')
        if eventos:
            print('   🎟️ Pases de los Tier 1: %d evento(s) ya jugados dan Pase' % len(eventos))
    return eventos


def _j(ruta, defecto):
    try:
        with io.open(ruta, encoding='utf-8') as f:
            d = json.load(f)
        return d if isinstance(d, type(defecto)) else defecto
    except (OSError, ValueError):
        return defecto


def vales(d, llaves, clave_de):
    """🎟️ `[{o, k, m}]`: un Pase premium para el campeón de cada evento que da Pase, hasta los `cupos` de su servidor (los
    primeros que se jugaron). `o` (`liga:pt1:<número>`) es lo que el objeto no repite. Sin perfil, todavía no sale. Pura."""
    cupos, usados, out = dict((d or {}).get('cupos') or {}), {}, []
    for n, sv in sorted(((d or {}).get('eventos') or {}).items(), key=lambda kv: int(kv[0])):
        L = (llaves or {}).get(str(n)) or {}
        camp = next((f[0] for f in L.get('tabla') or [] if f and len(f) > 1 and str(f[1]).lower().startswith('campe')), None)
        if not camp or usados.get(sv, 0) >= int(cupos.get(sv) or 0):
            continue
        k = clave_de(camp)
        if not k:
            continue
        usados[sv] = usados.get(sv, 0) + 1
        nom = str(L.get('nombre') or ('el evento #%s' % n))[:60]
        out.append({'o': 'liga:pt1:%s' % n, 'k': k, 'm': ('Pase de regalo de %s: campeón de %s' % (sv, nom))[:120]})
    return out


def vales_ciclo():
    """Lo de arriba con los archivos de `datos/`, para `pase.armar()`. Nunca frena el Pase."""
    try:
        from comun.claves import clave
        return vales(_j(ARCH, {}), _j(os.path.join(BASE, 'datos', 'llaves_t1.json'), {}), clave)
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ los Pases de regalo de los Tier 1 no salen en esta vuelta: %s' % str(e)[:100])
        return []


def _self_check():
    mal = 0

    def ok(c, q):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '❌', q))
    cal = [{'sv': 'FFA', 'll': 700, 'link': 'https://discord.com/channels/1/2/111111111111111111'},
           {'sv': 'FFA', 'll': 701, 'link': 'https://discord.com/channels/1/2/222222222222222222'},
           {'sv': 'DDF', 'll': 702, 'link': 'https://discord.com/channels/1/2/333333333333333333'},
           {'sv': 'FFA', 'link': 'https://discord.com/channels/1/2/444444444444444444'}]
    pa = {'FFA': {'mes': '2026-11', 'n': 1, 'ev': ['a:111111111111111111', '701', 'a:333333333333333333', 'a:444444444444444444']},
          'DDF': {'mes': '2026-10', 'n': 1, 'ev': ['702']}}
    r = resolver(cal, pa, '2026-11')
    ok(r == {'700': 'FFA', '701': 'FFA'}, 'los eventos de SU servidor, ya jugados y de este mes (el de DDF es de otro mes; el de otro '
       'servidor no cuenta aunque Dlx lo marque) %s' % r)
    ll = {'700': {'nombre': 'LA COPA', 'tabla': [['Ana', 'Campeón', 3]]}, '701': {'tabla': [['Bea', 'Campeón', 3]]}}
    v = vales({'cupos': {'FFA': 1}, 'eventos': r}, ll, lambda n: n.lower())
    ok(v == [{'o': 'liga:pt1:700', 'k': 'ana', 'm': 'Pase de regalo de FFA: campeón de LA COPA'}],
       'con 1 Pase, se lo lleva el campeón del primero que se jugó %s' % v)
    ok(len(vales({'cupos': {'FFA': 2}, 'eventos': r}, ll, lambda n: n.lower())) == 2 and not vales({'cupos': {}, 'eventos': r}, ll, str.lower),
       'con 2, los dos; sin cupo, ninguno')
    ok(not vales({'cupos': {'FFA': 1}, 'eventos': r}, ll, lambda n: ''), 'sin perfil todavía, no sale')
    print('   %s' % ('todo bien' if not mal else '%d mal' % mal))
    return 1 if mal else 0


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        sys.exit(_self_check())
    print(json.dumps(_j(ARCH, {}), ensure_ascii=False, indent=1))
