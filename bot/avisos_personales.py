# -*- coding: utf-8 -*-
"""LOS AVISOS DE CADA UNO: subiste de rango, desbloqueaste una tarjeta.

    python bot/avisos_personales.py            qué avisaría, sin tocar nada
    python bot/avisos_personales.py --aplicar  deja la cola en KV y guarda el estado
    python bot/avisos_personales.py --auto     el self-check, sin red

🔑 Dlx, 25/09/2026, a las ideas de Mi cuenta: «todas». La cuarta: que te
llegue un aviso al celular cuando te pasa algo a vos.

CÓMO VIAJA, SIN NINGÚN SECRETO NUEVO
------------------------------------
El ciclo ya escribe KV con su llave. Deja la cola en `avisos:personales` y el
vigía del Worker —que corre cada minuto— la lee, la manda a los dispositivos
que esa persona vinculó y la borra (`personales()` en `bot/avisos.js`). Una
ruta para que el ciclo le hable al Worker habría pedido un secreto compartido
nuevo, y los tokens nuevos quedaron para el final (Dlx).

QUÉ AVISA
---------
· 🃏 una tarjeta que pasó a tenerse. Sale de `cs` de `subir_datos.armar()`,
  que ya pregunta a R2 y al requisito: cuando llega el aviso, la carta está.
· 🏅 el primer rango —a los 10 eventos, la misma puerta que la carta— y
  📈 cada vez que sube.

⚠️ BAJAR DE RANGO NO SE AVISA. Es un dato público —está en la página— pero un
aviso al celular para decirte que bajaste no suma. Si Dlx lo quiere, es una
línea: `AVISA_BAJADA`.

⚠️ LA PRIMERA VEZ QUE SE VE A ALGUIEN NO SE LE AVISA NADA: se anota cómo está.
Sin eso, la primera corrida le diría a 331 personas «desbloqueaste tu
Servidor».

⚠️ LA COLA SALE PARA TODOS Y LA FILTRA EL OBJETO: acá no se sabe quién vinculó
un dispositivo. Quien no vinculó ninguno no recibe nada; su aviso se descarta
allá.
"""
import hashlib
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (BASE, SCR, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

ESTADO = os.path.join(BASE, 'datos', 'avisos_personales.json')
#: la misma clave que `COLA_PERSONAL` de `bot/avisos.js`
COLA = 'avisos:personales'
WEB = 'https://underlegends.pages.dev/#/r/'
AVISA_BAJADA = False
#: cómo se nombra cada carta en un aviso: «tu tarjeta Competitiva»
NOMBRE = {'temporada': 'de Temporada', 'competitivo': 'Competitiva',
          'pais': 'de País', 'servidor': 'de Servidor'}
#: de peor a mejor. El signo de A a D es un tercio del tramo (`CLAUDE.md`)
ORDEN = ['E', 'D−', 'D', 'D+', 'C−', 'C', 'C+', 'B−', 'B', 'B+',
         'A−', 'A', 'A+', 'S', 'SS', 'SSS']


def _rg(x):
    """La letra con el signo menos de verdad (U+2212), como `ORDEN`."""
    return str(x or '').strip().replace('-', '−')


def _nivel(x):
    x = _rg(x)
    return ORDEN.index(x) if x in ORDEN else -1


def _id(*partes):
    return hashlib.sha1('|'.join(str(p) for p in partes).encode('utf-8')).hexdigest()[:16]


def _ahora_iso():
    import datetime as _dt
    return _dt.datetime.now(_dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def eventos(antes, hoy):
    """Los avisos entre dos estados `{did: {'k', 'n', 'rg', 'cs'}}`. Una lista.

    ⚠️ QUIEN NO ESTABA EN `antes` NO RECIBE NADA: es la primera vez que se lo
    ve, y lo que tiene no es novedad para él.
    """
    out = []
    t = _ahora_iso()
    for did, h in sorted(hoy.items()):
        a = antes.get(did)
        if a is None:
            continue
        url = WEB + (h.get('k') or '')
        for c in sorted(set(h.get('cs') or []) - set(a.get('cs') or [])):
            out.append({'id': _id(did, 'carta', c), 'quien': did,
                        'titulo': '🃏 Desbloqueaste tu tarjeta %s' % NOMBRE.get(c, c),
                        'cuerpo': 'Ya está en tu perfil y en /card.', 'url': url})
        ra, rh = _rg(a.get('rg')), _rg(h.get('rg'))
        if rh and rh != ra:
            if not ra:
                out.append({'id': _id(did, 'rango', rh), 'quien': did,
                            'titulo': '🏅 Ya tenés rango: %s' % rh,
                            'cuerpo': 'Llegaste a los eventos del Competitivo: tu rango es %s.' % rh,
                            'url': url})
            elif _nivel(rh) > _nivel(ra):
                out.append({'id': _id(did, 'rango', rh), 'quien': did,
                            'titulo': '📈 Subiste a rango %s' % rh,
                            'cuerpo': 'Antes eras %s. Mirá tu perfil.' % ra, 'url': url})
            elif AVISA_BAJADA:
                out.append({'id': _id(did, 'baja', rh), 'quien': did,
                            'titulo': '📉 Ahora sos rango %s' % rh,
                            'cuerpo': 'Antes eras %s.' % ra, 'url': url})
    # ⚠️ CON FECHA: el objeto no manda lo de más de una semana, y la cola se
    # recorta por fecha (`encolar()`), porque ya no se borra al leerla
    for e in out:
        e['t'] = t
    return out


def estado_de_hoy():
    """`{discord_id: {'k': clave, 'n': nombre, 'rg': letra, 'cs': [cartas]}}`.

    🔑 LAS CARTAS SALEN DE `subir_datos.armar()`, lo mismo que el bot sirve:
    `cs` ya mira R2 y el requisito. Y la letra, de la misma puerta que la
    web y la carta (`subir_web._letra()`: nada debajo de 10 eventos).
    """
    import subir_datos as SD
    from comun.claves import clave as _clave
    from comun.requisitos import minimo
    pares, _n, _c = SD.armar()
    cs, clave_de = {}, {}
    for p in pares:
        k, v = p.get('key') or '', p.get('value')
        if k.startswith('p:'):
            try:
                cs[k[2:]] = json.loads(v)
            except (TypeError, ValueError):
                pass
        elif k.startswith('d:'):
            clave_de[k[2:]] = v
    pide = minimo('competitivo', 'ev')
    letra = {}
    try:
        with io.open(os.path.join(BASE, 'datos', 'temporada_pool.json'), encoding='utf-8') as f:
            for x in json.load(f):
                if x.get('raw') and (x.get('ev') or 0) >= pide and x.get('rango'):
                    letra[_clave(x['raw'])] = _rg(x['rango'])
    except (OSError, ValueError):
        pass
    out = {}
    for did, k in clave_de.items():
        p = cs.get(k) or {}
        out[did] = {'k': k, 'n': p.get('n') or '', 'rg': letra.get(k, ''),
                    'cs': sorted(p.get('cs') or [])}
    return out


def _leer_estado():
    try:
        with io.open(ESTADO, encoding='utf-8') as f:
            return json.load(f).get('gente')
    except (OSError, ValueError):
        return None


def _guardar_estado(hoy):
    """Sólo lo que hace falta comparar: la letra y las cartas."""
    gente = {did: {'rg': h['rg'], 'cs': h['cs']} for did, h in sorted(hoy.items())}
    with io.open(ESTADO, 'w', encoding='utf-8', newline='\n') as f:
        json.dump({'_leeme': 'Cómo estaba cada uno la última vez que se miró: la letra de rango y '
                             'las tarjetas que tiene. Lo escribe bot/avisos_personales.py para '
                             'saber qué avisar (subiste de rango, desbloqueaste una tarjeta).',
                   'gente': gente}, f, ensure_ascii=False, indent=0, sort_keys=True)


def encolar(nuevos):
    """Suma los avisos a la cola de KV. `True` si quedó escrita.

    ⚠️ SE LEE LA COLA ANTES DE ESCRIBIR, por `bulk/get` —el de a una da el
    valor viejo justo después de escribir, ver `subir_datos.py`—: si el vigía
    todavía no la leyó, lo de la corrida anterior no se pierde. Y repetir no
    hace daño: el objeto anota cada aviso en `hechos` antes de mandarlo.
    """
    import requests
    import subir_datos as SD
    import fotos as F
    s = requests.Session()
    s.headers['Authorization'] = 'Bearer ' + F.env('CLOUDFLARE_API_TOKEN')
    previa = []
    try:
        r = s.post('%s/bulk/get' % SD.API, json={'keys': [COLA]}, timeout=30)
        v = ((r.json().get('result') or {}).get('values') or {}).get(COLA)
        v = v.get('value') if isinstance(v, dict) else v
        previa = json.loads(v) if isinstance(v, str) else (v or [])
    except (ValueError, OSError):
        previa = []
    # ⚠️ LO DE MÁS DE UNA SEMANA SE VA: el objeto ya no borra la cola
    import datetime as _dt
    desde = (_dt.datetime.now(_dt.timezone.utc) - _dt.timedelta(days=7)).strftime('%Y-%m-%dT%H:%M:%SZ')
    previa = [a for a in previa if isinstance(a, dict) and str(a.get('t') or '') >= desde]
    ya = {a.get('id') for a in previa}
    cola = previa + [a for a in nuevos if a['id'] not in ya]
    r = s.put('%s/values/%s' % (SD.API, COLA),
              files={'value': (None, json.dumps(cola[-200:], ensure_ascii=False)),
                     'metadata': (None, '{}')}, timeout=30)
    return r.status_code == 200


def main():
    aplicar = '--aplicar' in sys.argv
    hoy = estado_de_hoy()
    antes = _leer_estado()
    print('\n══ LOS AVISOS DE CADA UNO ══\n')
    print('   %d persona(s) con Discord ID y tarjeta' % len(hoy))
    if antes is None:
        print('   primera vez: anoto cómo está cada uno y no aviso nada')
        if aplicar:
            _guardar_estado(hoy)
            print('   ✅ %s' % os.path.relpath(ESTADO, BASE))
        return 0
    evs = eventos(antes, hoy)
    for e in evs[:20]:
        print('   %-20s %s' % (hoy[e['quien']]['n'][:20], e['titulo']))
    if len(evs) > 20:
        print('   … y %d más' % (len(evs) - 20))
    if not evs:
        print('   nada nuevo para avisar')
    if not aplicar:
        print('\n   (simulacro: no toqué nada — corré con --aplicar)\n')
        return 0
    if evs and not encolar(evs):
        # ⚠️ SI LA COLA NO SE PUDO ESCRIBIR, EL ESTADO NO SE GUARDA: así la
        # próxima corrida vuelve a encontrar los mismos cambios y los manda.
        print('   ⚠️ no pude dejar la cola en KV: lo intento en la próxima corrida')
        return 0
    _guardar_estado(hoy)
    print('   ✅ %d aviso(s) en la cola · estado guardado' % len(evs))
    return 0


def _self_check():
    print('')
    print('  avisos_personales.py — self-check, sin red')
    print('')
    mal = 0

    def ok(cond, que):
        nonlocal mal
        mal += not cond
        print('   %s %s' % ('ok' if cond else '🔴', que))

    base = {'k': 'konan', 'n': 'Konan', 'rg': '', 'cs': ['servidor']}
    ok(eventos({}, {'1': base}) == [], 'a quien se ve por primera vez no se le avisa nada')
    ok(eventos({'1': base}, {'1': base}) == [], 'sin cambios, nada')
    e = eventos({'1': base}, {'1': dict(base, cs=['servidor', 'temporada'])})
    ok(len(e) == 1 and 'Temporada' in e[0]['titulo'] and e[0]['url'].endswith('#/r/konan'),
       'una tarjeta nueva, un aviso con el link al perfil')
    e = eventos({'1': base}, {'1': dict(base, rg='B')})
    ok(len(e) == 1 and e[0]['titulo'] == '🏅 Ya tenés rango: B', 'el primer rango')
    e = eventos({'1': dict(base, rg='B')}, {'1': dict(base, rg='A-')})
    ok(len(e) == 1 and e[0]['titulo'] == '📈 Subiste a rango A−', 'subir, con el signo bien escrito')
    ok(eventos({'1': dict(base, rg='A')}, {'1': dict(base, rg='B+')}) == [], 'bajar no se avisa')
    ok(eventos({'1': dict(base, rg='A−')}, {'1': dict(base, rg='A-')}) == [],
       'el mismo rango escrito con otro guion no es un cambio')
    a = eventos({'1': base}, {'1': dict(base, rg='S')})
    b = eventos({'1': base}, {'1': dict(base, rg='S')})
    ok(a[0]['id'] == b[0]['id'], 'el mismo aviso tiene el mismo id (el objeto no lo repite)')
    ok(_nivel('SSS') > _nivel('A+') > _nivel('A') > _nivel('A−') > _nivel('E'), 'el orden de los rangos')
    print('')
    print('   %s' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return 1 if mal else 0


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    sys.exit(_self_check() if '--auto' in sys.argv else main())
