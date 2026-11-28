# -*- coding: utf-8 -*-
"""🐣 LOS EVENTOS DE NUEVOS DAN EL PASE PREMIUM DE LA TEMPORADA (28/11/2026).

    python bot/premium_nuevos.py           qué eventos son de nuevos y a quién le tocaría, sin mandar nada
    python bot/premium_nuevos.py --auto    el self-check, sin red ni archivos

Dlx, 28/11/2026: *«puedes tener 1 temporada gratis de pase premium si participas en eventos nuevos»*. Los eventos de
nuevos salen de «Para los nuevos» (bot/nuevos.js: Competencia, Cypher, Dinámica, Entrenamiento), y el staff después los
corre como eventos de verdad. Para saber cuáles son:

  · LOS MARCA DLX en el Dashboard (`web/src/dash_nuevos.jsx`), como los de estilo: el ajuste `eventos_nuevos`,
    `{clave: 1}`, con la clave del número del evento si ya se jugó o `a:<id del mensaje del anuncio>` si todavía no
    (`eventos_estilo.claves()`). Con `{clave: 0}` saca uno que se detectó solo.
  · Y SE DETECTAN SOLOS (`auto()`): un evento de DRA anunciado en el canal «evento-nuevos» (`CANAL_NUEVOS`, el mismo
    de `bot/verificar_dc.js`) o cuyo nombre dice que es para los nuevos (`NOMBRE`: «evento de nuevos», «para los
    nuevos», «novatos», «principiantes», «primerizos»). «nuevos» solo NO alcanza: «nuevos talentos» no es esto.

Corre adentro de `bot/subir_web.py` (paso 2c), al lado de los de estilo: le pone `nv: 1` a cada evento de nuevos del
calendario y deja `datos/eventos_nuevos.json` con lo marcado resuelto a número de evento. Después `bot/pase.py`
(`vales()`) cruza esos números con los resultados de la temporada (`datos/<temporada>_resultados.json`) y el Discord ID
del padrón (`pase.buscador()`), y le manda al objeto `nuevos_prem`: `[{q, ll}]`, UNO por persona. El objeto da el Premium
una vez por temporada (`nuevosCiclo()` de bot/premium_regalos.js): el vale `nuevos:<temp>:<id>` es la marca.

⚠️ SIN AJUSTES (el Worker no contestó) NO SE TOCA EL ARCHIVO, como en los de estilo: un Worker caído no es «Dlx sacó
las marcas». Lo detectado solo se sigue marcando igual.
⚠️ JUGÓ = ESTÁ EN LOS RESULTADOS DE ESE EVENTO, con cualquier puesto. Quien no tiene Discord ID en el padrón no recibe
nada esta vuelta: entra en la que aparezca (el vale no se repite).
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
ARCH = os.path.join(BASE, 'datos', 'eventos_nuevos.json')
LEEME = ('🐣 Los eventos de nuevos: lo que marcó Dlx en el Dashboard (`marcados`, por número o por `a:<id del anuncio>`, '
         '1 = es, 0 = no es) y lo detectado solo, resuelto a número de evento (`eventos`: número → «dlx» o «auto»). Lo '
         'escribe bot/premium_nuevos.py desde bot/subir_web.py; lo lee bot/pase.py para el Pase Premium de los que jugaron')
#: el canal «✦🐣・evento-nuevos» de DRA (= `CANAL_NUEVOS` de bot/verificar_dc.js)
CANAL_NUEVOS = '1516285712805265519'
NOMBRE = re.compile(r'evento\s+(de|para)\s+(los\s+)?nuevos|para\s+(los\s+)?nuevos|novatos?|principiantes?|primerizos?',
                    re.IGNORECASE)
_CANAL = re.compile(r'/channels/[0-9]+/([0-9]{15,22})/[0-9]{15,22}/?$')
_CLAVE = re.compile(r'^(a:[0-9]{15,22}|[0-9]{1,6})$')
_NUM = re.compile(r'^[0-9]{1,6}$')


def claves(item):
    """Las claves de un evento del calendario: las mismas de los eventos de estilo."""
    import eventos_estilo as EE
    return EE.claves(item)


def auto(item):
    """¿Se detecta solo como de nuevos? Sólo los de DRA (ahí se juegan siempre): por el canal del anuncio o el nombre."""
    if str(item.get('sv') or '') != 'DRA':
        return False
    m = _CANAL.search(str(item.get('link') or ''))
    return bool((m and m.group(1) == CANAL_NUEVOS) or NOMBRE.search(str(item.get('n') or '')))


def limpio(marcados):
    if not isinstance(marcados, dict):
        return {}
    return {str(k): v for k, v in marcados.items() if _CLAVE.match(str(k)) and v in (0, 1)}


def resolver(calendario, marcados):
    """Marca el calendario (`nv: 1`) y devuelve `{número: 'dlx' | 'auto'}` de lo que ya se jugó. Lo marcado con 1 por
    número cuenta aunque no esté en el calendario; un 0 gana sobre lo detectado solo."""
    marcados = limpio(marcados)
    eventos = {k: 'dlx' for k, v in marcados.items() if v == 1 and not k.startswith('a:')}
    for it in calendario or []:
        ks = claves(it)
        dice = next((marcados[k] for k in ks if k in marcados), None)
        si = dice == 1 or (dice is None and auto(it))
        if not si:
            if dice == 0 and it.get('ll') and _NUM.match(str(it['ll'])):
                eventos.pop(str(it['ll']), None)
            continue
        it['nv'] = 1
        if it.get('ll') and _NUM.match(str(it['ll'])):
            eventos[str(it['ll'])] = 'dlx' if dice == 1 else 'auto'
    for k, v in marcados.items():
        if v == 0 and not k.startswith('a:'):
            eventos.pop(k, None)
    return dict(sorted(eventos.items(), key=lambda x: int(x[0])))


def _antes():
    try:
        with io.open(ARCH, encoding='utf-8') as f:
            d = json.load(f)
        return d if isinstance(d, dict) else {}
    except (OSError, ValueError):
        return {}


def marcar(calendario, aj=None, escribir=True):
    """Desde `bot/subir_web.py`, con los ajustes del Dashboard ya leídos (`aj`). Sin ajustes, se marca el calendario con
    lo último que se supo y no se escribe nada. `escribir` es el `--aplicar` de subir_web."""
    antes = _antes()
    if aj is None:
        resolver(calendario, antes.get('marcados') or {})
        return None
    marcados = limpio(aj.get('eventos_nuevos') or {})
    eventos = resolver(calendario, marcados)
    # lo que ya estaba resuelto y salió del calendario (las semanas pasan) sigue valiendo, salvo que Dlx lo saque
    for k, v in (antes.get('eventos') or {}).items():
        if _NUM.match(str(k)) and k not in eventos and marcados.get(k) != 0 and v in ('dlx', 'auto'):
            eventos[k] = v
    eventos = dict(sorted(eventos.items(), key=lambda x: int(x[0])))
    nuevo = {'_leeme': LEEME, 'marcados': dict(sorted(marcados.items())), 'eventos': eventos}
    if escribir and ({k: v for k, v in antes.items() if k != '_leeme'} != {k: v for k, v in nuevo.items() if k != '_leeme'}
                     or not antes):
        with io.open(ARCH, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(nuevo, f, ensure_ascii=False, indent=1)
            f.write('\n')
        if eventos or antes.get('eventos'):
            print('   🐣 eventos de nuevos: %d marcados en el Dashboard, %d ya jugados' % (len(marcados), len(eventos)))
    return eventos


def quienes(eventos, filas, quien_es):
    """`[{q, ll}]`: uno por Discord ID, con el primer evento de nuevos que jugó. Pura. `filas` las de los resultados
    (`[n, fecha, sv, escala, rapero, …]`), `quien_es` `nombre -> discord_id | None` (`pase.buscador()`)."""
    out = {}
    for f in sorted((f for f in filas or [] if len(f) > 4 and str(f[0]) in (eventos or {})), key=lambda f: int(f[0])):
        q = quien_es(f[4])
        if q and re.match(r'^[0-9]{5,25}$', str(q)) and str(q) not in out:
            out[str(q)] = {'q': str(q), 'll': str(f[0])}
    return sorted(out.values(), key=lambda x: (int(x['ll']), x['q']))


def vales():
    """Lo que `bot/pase.py` le manda al objeto (`nuevos_prem`). Nunca frena el Pase: si algo falla, esta vuelta no da."""
    try:
        import pase as PA
        import precios as PR
        from comun.temporada import ACTUAL
        eventos = (_antes().get('eventos') or {})
        if not eventos:
            return []
        with io.open(os.path.join(BASE, 'datos', '%s_resultados.json' % ACTUAL), encoding='utf-8') as f:
            filas = (json.load(f) or {}).get('filas') or []
        with io.open(os.path.join(BASE, 'datos', 'temporada_pool.json'), encoding='utf-8') as f:
            pool = json.load(f) or []
        return quienes(eventos, filas, PA.buscador(PR.discords(pool)))
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ el Pase Premium de los eventos de nuevos no sale en esta vuelta: %s' % str(e)[:120])
        return []


def _self_check():
    mal = 0

    def ok(c, que):
        nonlocal mal
        print('   %s %s' % ('✅' if c else '❌', que))
        mal += 0 if c else 1

    A = 'https://discord.com/channels/841017460341604382/2222222222222222222/1440000000000000001'
    B = 'https://discord.com/channels/841017460341604382/%s/1440000000000000002' % CANAL_NUEVOS
    C = 'https://discord.com/channels/841017460341604382/2222222222222222222/1440000000000000003'
    cal = [{'n': 'Competencia para los nuevos', 'sv': 'DRA', 'link': A, 'll': 700},
           {'n': 'Cypher del sábado', 'sv': 'DRA', 'link': B, 'll': 0},
           {'n': 'Nuevos talentos vol 3', 'sv': 'DRA', 'link': C, 'll': 701},
           {'n': 'Torneo de novatos', 'sv': 'FFA', 'link': C, 'll': 702},
           {'n': 'Batalla de principiantes', 'sv': 'DRA', 'link': C, 'll': 703},
           {'n': 'Domingo de rap', 'sv': 'DRA', 'link': C, 'll': 704}]
    ev = resolver(cal, {'704': 1, '703': 0, '999': 1, 'raro': 1, '705': 7})
    ok(cal[0].get('nv') == 1 and cal[1].get('nv') == 1, 'se detectan solos: por el nombre y por el canal «evento-nuevos»')
    ok('nv' not in cal[2] and 'nv' not in cal[3], '«nuevos talentos» no es de nuevos, y otro servidor tampoco')
    ok('nv' not in cal[4] and '703' not in ev, 'un 0 de Dlx gana sobre lo detectado solo')
    ok(cal[5].get('nv') == 1 and ev.get('704') == 'dlx' and ev.get('999') == 'dlx' and ev.get('700') == 'auto',
       'lo marcado por Dlx cuenta (aunque no esté en el calendario) y lo detectado queda como «auto»')
    ok(sorted(ev) == ['700', '704', '999'], 'a número: sólo lo jugado (el anuncio sin llave todavía no), nada raro')
    ok(limpio({'a:1440000000000000001': 1, '12': 0, 'x': 1, '13': 2}) == {'a:1440000000000000001': 1, '12': 0},
       'el ajuste: claves de estilo y valores 0 o 1')
    filas = [[700, '28/11', 'DRA', '8', 'Ana', 'ar', 'Campeón'], [700, '28/11', 'DRA', '8', 'Beto', 'cl', '2.º'],
             [704, '29/11', 'DRA', '8', 'Ana', 'ar', '3.º'], [704, '29/11', 'DRA', '8', 'Sin ID', 'mx', '4.º'],
             [650, '20/11', 'DRA', '8', 'Cora', 'co', 'Campeón']]
    ids = {'Ana': '600000000000000001', 'Beto': '600000000000000002', 'Cora': '600000000000000003'}
    qs = quienes({'700': 'auto', '704': 'dlx'}, filas, ids.get)
    ok(qs == [{'q': '600000000000000001', 'll': '700'}, {'q': '600000000000000002', 'll': '700'}],
       'los que jugaron: uno por persona (el primero), sin el que no tiene Discord ID ni los de otro evento')
    ok(quienes({}, filas, ids.get) == [], 'sin eventos de nuevos, nadie')
    print('   %s' % ('todo bien' if not mal else '%d mal' % mal))
    return 1 if mal else 0


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    if '--auto' in sys.argv:
        sys.exit(_self_check())
    print(__doc__.split('\n')[0])
    d = _antes()
    print('   marcados: %s · ya jugados: %s' % (d.get('marcados') or {}, d.get('eventos') or {}))
    print('   le tocaría a %d' % len(vales()))
