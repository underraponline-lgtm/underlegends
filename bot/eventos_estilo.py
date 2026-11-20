# -*- coding: utf-8 -*-
"""🎭 LOS EVENTOS DE ESTILO QUE MARCA DLX, del Dashboard al calendario y a los niveles (17/11/2026).

    python bot/eventos_estilo.py --auto    el self-check

Dlx, 17/11/2026: a cómo se marca un evento de DRA como evento de estilo, *«B, desde el Dashboard»*; y *«que se pueda
marcar antes»*. Lo marca en el Dashboard (`web/src/dash_estilos.jsx`) y queda en sus ajustes como `eventos_estilo`,
`{clave: estilo}`: la clave es el **número** del evento si ya se jugó, o `a:<id del mensaje de su anuncio>` si todavía no.

Esto corre adentro de `bot/subir_web.py` (paso 2c), justo después de armar el calendario —que ya sabe qué anuncio es de
qué llave (`llaves_web.cruzar()`)— y hace dos cosas:

  · le pone `je` (el NOMBRE del estilo) a cada evento marcado del calendario, para que la página lo diga en Eventos;
  · deja `datos/eventos_estilo.json` con lo marcado ya resuelto a número de evento: `{"eventos": {"653": "flow"}}`.
    Con eso y los resultados, `bot/juegos.py` (paso 2f3) sube los niveles.

⚠️ SIN AJUSTES (el Worker no contestó) NO SE TOCA EL ARCHIVO: se marca el calendario con lo último que se supo. Un
Worker caído no es «Dlx sacó las marcas».
"""
import io
import json
import os
import re
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARCH = os.path.join(BASE, 'datos', 'eventos_estilo.json')
LEEME = ('🎭 Los eventos de estilo que marcó Dlx en el Dashboard (`marcados`, por número o por `a:<id del anuncio>`) y '
         'lo mismo resuelto a número de evento (`eventos`). Lo escribe bot/eventos_estilo.py desde bot/subir_web.py; lo '
         'lee bot/juegos.py para los niveles')
_ANUNCIO = re.compile(r'/([0-9]{15,22})/?$')


def claves(item):
    """Con qué claves puede estar marcado un evento del calendario: su número y el id de su anuncio (como la página)."""
    out = []
    # ⚠️ sólo un NÚMERO DE EVENTO (hasta 6 cifras): la llave de un servidor que no suma (Tier 2 y 3,
    # `datos/llaves_sin_sumar.json`) trae en `ll` su registro (`126047346`), que no es un evento (lo encontró la prueba del Dashboard, 17/11/2026). Ése va por su anuncio
    if item.get('ll') and re.match(r'^[0-9]{1,6}$', str(item['ll'])):
        out.append(str(item['ll']))
    m = _ANUNCIO.search(str(item.get('link') or ''))
    if m:
        out.append('a:' + m.group(1))
    return out


def _limpio(marcados, catalogo):
    if not isinstance(marcados, dict):
        return {}
    return {str(k): v for k, v in marcados.items()
            if re.match(r'^(a:[0-9]{15,22}|[0-9]{1,6})$', str(k)) and v in catalogo}


def resolver(calendario, marcados, catalogo, socios=None):
    """Marca el calendario (`je`) y devuelve `{número: estilo}` de lo que ya se jugó. Lo marcado directo por número
    cuenta aunque no esté en el calendario.

    🎭 `socios` `{sigla: {clave: estilo}}`: lo que marcó el dueño de un Tier 1 o 2 desde su panel (20/11/2026, el plan de
    los tiers: «el Tier 2 da 1 evento de estilo por mes»). Vale SÓLO para eventos de su servidor (`sv` del calendario) y
    nunca por número suelto: un número que no está en el calendario no se sabe de quién es. Lo de Dlx gana."""
    marcados = _limpio(marcados, catalogo)
    socios = {str(sv): _limpio(m, catalogo) for sv, m in (socios or {}).items() if isinstance(m, dict)}
    eventos = {k: v for k, v in marcados.items() if not k.startswith('a:')}
    for it in calendario or []:
        est = next((marcados[k] for k in claves(it) if k in marcados), None)
        if not est:
            mio = socios.get(str(it.get('sv') or '')) or {}
            est = next((mio[k] for k in claves(it) if k in mio), None)
        if not est:
            continue
        it['je'] = catalogo[est][0]                     # el NOMBRE, listo para la página: no carga el catálogo
        if it.get('ll') and re.match(r'^[0-9]{1,6}$', str(it['ll'])):
            eventos[str(it['ll'])] = est
    return dict(sorted(eventos.items(), key=lambda x: int(x[0])))


def _antes():
    try:
        with io.open(ARCH, encoding='utf-8') as f:
            d = json.load(f)
        return d if isinstance(d, dict) else {}
    except (OSError, ValueError):
        return {}


def marcar(calendario, aj=None, escribir=True):
    """Lo de arriba, desde `bot/subir_web.py`. `aj` son los ajustes del Dashboard; sin ellos se piden, y si el Worker no
    contesta se usa lo último que se supo y no se escribe nada. `escribir` es el `--aplicar` de subir_web: sin él,
    sólo se marca el calendario."""
    sys.path.insert(0, os.path.join(BASE, '02_Competitivo', 'v2'))
    import estilos_juego as EJ
    if aj is None:
        try:
            import multiplicadores as MU
            aj = MU.ajustes_dueno()
        except Exception as e:                           # noqa: BLE001
            print('   ⚠️ los eventos de estilo: %s' % str(e)[:80])
            aj = None
    antes = _antes()
    if aj is None:
        resolver(calendario, antes.get('marcados') or {}, EJ.CATALOGO)
        return None
    marcados = _limpio(aj.get('eventos_estilo') or {}, EJ.CATALOGO)
    socios = {sv: _limpio(m, EJ.CATALOGO) for sv, m in (aj.get('estilo_socios') or {}).items() if isinstance(m, dict)}
    eventos = resolver(calendario, marcados, EJ.CATALOGO, socios)
    nuevo = {'_leeme': LEEME, 'marcados': dict(sorted(marcados.items())), 'eventos': eventos}
    if any(socios.values()):
        nuevo['socios'] = {sv: dict(sorted(m.items())) for sv, m in sorted(socios.items()) if m}
    if escribir and ({k: v for k, v in antes.items() if k != '_leeme'} != {k: v for k, v in nuevo.items() if k != '_leeme'}
                     or not antes):
        with io.open(ARCH, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(nuevo, f, ensure_ascii=False, indent=1)
            f.write('\n')
        if marcados or antes.get('marcados'):
            print('   🎭 eventos de estilo: %d marcados, %d ya jugados' % (len(marcados), len(eventos)))
    return eventos


def _self_check():
    sys.path.insert(0, os.path.join(BASE, '02_Competitivo', 'v2'))
    import estilos_juego as EJ
    mal = 0

    def ok(c, que):
        nonlocal mal
        print('   %s %s' % ('✅' if c else '❌', que))
        mal += 0 if c else 1

    A = 'https://discord.com/channels/1/2/1440000000000000001'
    B = 'https://discord.com/channels/1/2/1440000000000000002'
    cal = [{'n': 'Noche de Punchline', 'sv': 'DRA', 'link': A, 'll': 0},
           {'n': 'Ya jugado', 'sv': 'DRA', 'link': B, 'll': 653},
           {'n': 'Sin marcar', 'sv': 'DRA', 'link': 'x', 'll': 654}]
    ev = resolver(cal, {'a:1440000000000000001': 'punchline', 'a:1440000000000000002': 'flow', '700': 'frio',
                        '701': 'inventado', 'raro': 'flow'}, EJ.CATALOGO)
    ok(cal[0].get('je') == 'Punchline' and cal[1].get('je') == 'Flow' and 'je' not in cal[2],
       'el calendario lleva el estilo en lo marcado, por anuncio o por número, y en nada más')
    ok(ev == {'653': 'flow', '700': 'frio'},
       'a número: el anuncio que ya tiene su llave pasa a su número; lo marcado por número cuenta aunque no esté; lo raro no')
    ok(claves({'ll': 5, 'link': A}) == ['5', 'a:1440000000000000001'] and claves({'ll': 0, 'link': 'nada'}) == [],
       'las claves de un evento son su número y su anuncio, como en la página (`dash_estilos.jsx`)')
    viva = [{'n': 'L VS MOSQUI', 'sv': 'LKR', 'link': A, 'll': 126047346}]
    ok(claves(viva[0]) == ['a:1440000000000000001'] and resolver(viva, {'a:1440000000000000001': 'flow'}, EJ.CATALOGO) == {}
       and viva[0].get('je') == 'Flow',
       'una llave en vivo (su registro en `ll`, no un número de evento) va por su anuncio y no se toma por evento')
    print('   %s' % ('todo bien' if not mal else '%d mal' % mal))
    return 1 if mal else 0


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    if '--auto' in sys.argv:
        sys.exit(_self_check())
    print(__doc__)
