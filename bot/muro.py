# -*- coding: utf-8 -*-
"""EL MURO DE PUBLICACIONES: lo que pasa en la Liga, contado solo, y los anuncios de los servidores.

    python bot/muro.py --auto     el self-check, sin red ni archivos

Lo corre `bot/subir_web.py --aplicar` (paso 2c del ciclo), porque necesita la
tabla que arma ahí: `publicar(payload)` anota lo nuevo en `datos/muro.json` y
sube el muro a KV (`web:muro`), sólo si cambió. La página lo pide al abrir
Publicaciones (`/api/muro`): no viaja en el lobby.

Dlx, 28/09/2026, a «¿qué va en Publicaciones?»: *«sí un muro automático, pero
anuncios de todos los servidores también»*. El muro automático es la idea del
27/09: lo arma la Liga con lo que el ciclo ya calcula, no le pide nada a
nadie y cuenta los hechos en tercera persona («X ganó…»), nunca «en nombre
de» alguien.

LO QUE ENTRA
- 🏆 los campeones de cada evento procesado (las llaves);
- ⬆️ quien sube de rango, y 🎖️ quien consigue su primer rango;
- 🃏 quien desbloquea una tarjeta;
- 🎯 las cazas del Most Wanted, 🛡️ quien sobrevive y 🗳️ El Elegido;
- 💰 los precios por cabeza cobrados;
- 🎟️ quien llega a un nivel del Pase de rapero que se publica, y quien lo
  completa (Dlx, 06/10/2026: «5. c»), de `datos/pase_niveles.json`;
- 🥇 los premios de la semana;
- 📢 los anuncios de eventos de todos los servidores (`datos/anuncios.json`),
  y 📰 las novedades de la Liga en DRA;
- 🖼️ el último flyer de cada liga de los servidores (`bot/ligas.py`), si ya
  está en R2 (Dlx, 14/10/2026: «Flyers en Publicaciones e Historias»);
- 🏟️ lo que pasa en esas ligas (Dlx, 16/10/2026, «publicaciones solas»): quién
  llega invicto a 5, quién toma la punta y quién sale campeón (`ligas.hitos()`
  y el Salón de campeones), con 👏 Felicitar;
- 📣 las promociones de los raperos de la Lista en el canal de promoción de
  cada socio (`bot/promos.py`, Dlx 16/10/2026): música y video, dos por persona.

⚠️ SUBIR DE RANGO Y DESBLOQUEAR NO SE PUEDEN RECALCULAR: son un cambio entre
dos corridas. Por eso se anotan en `datos/muro.json` (con cómo estaba cada uno)
y el resto se vuelve a armar en cada corrida desde su fuente. La primera vez
que se ve a alguien sólo se anota cómo está: si no, el muro arrancaría con
cien «desbloqueó» que no pasaron hoy.

⚠️ LO DE LA PRUEBA NO ENTRA EN LA TEMPORADA: desde el arranque, lo de antes
no se muestra (Dlx, 25/09/2026: lo jugado en la prueba *«se borra»*).
"""
import datetime as dt
import hashlib
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

SALIDA = os.path.join(BASE, 'datos', 'muro.json')
#: la clave de KV que lee la página (por el Worker, `/muro`)
CLAVE = 'web:muro'
#: cuántas publicaciones viajan, y cuántos cambios (rango, tarjeta) se guardan
VIAJAN, GUARDA = 80, 400
#: los anuncios y lo demás, de hasta cuántos días atrás
DIAS = 21
#: los nombres de las tarjetas, como los dice la página
TARJETA = {'temporada': 'Temporada', 'competitivo': 'Competitiva', 'servidor': 'Servidor', 'pais': 'País'}


def _iso(t):
    return t.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def _de_iso(s):
    s = str(s or '').strip()
    if not s:
        return None
    try:
        t = dt.datetime.fromisoformat(s.replace('Z', '+00:00'))
    except ValueError:
        return None
    # ⚠️ los anuncios guardan la hora de Discord sin zona: es UTC
    return t if t.tzinfo else t.replace(tzinfo=dt.timezone.utc)


def _j(*p):
    try:
        with io.open(os.path.join(BASE, *p), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def _base(rg):
    """«A+» -> «A»: el tramo, sin el signo del subrango."""
    return str(rg or '').rstrip('+-−').strip()


def _nivel(rg):
    """Más es mejor: E es 1, SSS es 8. Sin rango, 0."""
    from comun.rangos import ORDEN
    b = _base(rg)
    return len(ORDEN) - ORDEN.index(b) if b in ORDEN else 0


# ── lo que se vuelve a armar en cada corrida ─────────────────────────────
def campeones(llaves, instantes):
    """🏆 el campeón (o el equipo) de cada evento procesado."""
    out = []
    for n, L in (llaves or {}).items():
        if not str(n).isdigit():
            continue
        ms = instantes.get(int(n)) if instantes else None
        t = dt.datetime.fromtimestamp(ms / 1000, dt.timezone.utc) if ms else _de_iso((L.get('dia') or '') + 'T23:00:00')
        camp = [r[0] for r in L.get('tabla') or [] if len(r) > 1 and r[1] == 'Campeón']
        if camp and t:
            out.append({'tipo': 'campeon', 't': _iso(t), 'quien': camp, 'ev': L.get('nombre') or '',
                        'sv': L.get('sv') or '', 'll': int(n), 'part': L.get('participantes') or 0})
    return out


def most_wanted(mw):
    """🎯 las cazas, 🛡️ quien sobrevivió y 🗳️ El Elegido, de la temporada del período de ahora."""
    import most_wanted as MW
    out = []
    for per in MW.periodos(mw or {}):
        for b in per.get('buscados') or []:
            if b.get('cat') == 'elegido' and per.get('elegido'):
                out.append({'tipo': 'elegido', 't': per['elegido'], 'quien': [b['n']],
                            'votos': b.get('votos') or 0, 'de': b.get('de') or 0})
            if b.get('caza'):
                c = b['caza']
                por = c.get('por') or []
                out.append({'tipo': 'caza', 't': c.get('t') or per.get('fin') or '', 'quien': [y['n'] for y in por],
                            'a': b['n'], 'cat': b.get('cn') or '', 'ev': c.get('evento') or '',
                            'sv': c.get('sv') or '', 'pts': sum(y.get('cobra') or 0 for y in por)})
            elif b.get('estado') == 'sobrevivio' and per.get('fin'):
                out.append({'tipo': 'sobrevivio', 't': per['fin'], 'quien': [b['n']], 'cat': b.get('cn') or '',
                            'pts': b.get('paga') or 0})
    return out


def precios_cobrados(pr):
    """💰 los precios por cabeza que alguien cobró."""
    out = []
    for x in (pr or {}).get('precios') or []:
        if x.get('e') == 'cazado' and x.get('ev'):
            out.append({'tipo': 'precio', 't': x['ev'].get('t') or '', 'quien': [y[0] for y in x.get('por') or []],
                        'a': x.get('cabeza') or '', 'ev': x['ev'].get('nombre') or '', 'sv': x['ev'].get('sv') or '',
                        'pts': x.get('monto') or 0})
    return out


def pase(niv, tabla):
    """🎟️ quien llegó a un nivel del Pase que se publica (`pase.PUBLICAR`), con
    su hora, de los hitos que trae `bot/pase.py` del objeto.

    ⚠️ SÓLO QUIEN TIENE PERFIL: el hito trae la clave (no el nombre: el objeto
    no los tiene) y el nombre sale de la tabla. Sin perfil no hay publicación
    —«sin dato no hay pieza»—: no se inventa cómo se llama.
    """
    import pase as PA
    nombres = {f['k']: f['n'] for f in tabla or [] if f.get('k') and f.get('n')}
    out = []
    for h in (niv or {}).get('hitos') or []:
        if not isinstance(h, list) or len(h) < 4 or not isinstance(h[1], int) or not isinstance(h[2], int):
            continue
        k = str(h[3] or '')
        if k not in nombres:
            continue
        t = dt.datetime.fromtimestamp(h[2] / 1000, dt.timezone.utc)
        tipo, valor = PA.ESPECIALES.get(h[1], ('', ''))
        x = {'tipo': 'pase', 't': _iso(t), 'quien': [nombres[k]], 'ks': [k], 'nivel': h[1],
             'temp': str(niv.get('temp') or ''), 'completo': h[1] >= PA.NIVELES}
        if tipo in ('titulo', 'insignia') and not x['completo']:
            x['premio'] = valor
        out.append(x)
    return out


def sorteos(niv, tabla):
    """🎟️ el ganador de cada sorteo del Pase premium (Dlx, 25/10/2026: «dale pero en publicaciones»), con lo que hace
    falta para repetir la cuenta: cuántos entraron, cuántos boletos y la semilla. Sólo con perfil, como `pase()`."""
    nombres = {f['k']: f['n'] for f in tabla or [] if f.get('k') and f.get('n')}
    out = []
    for s in (niv or {}).get('sorteos') or []:
        if not isinstance(s, list) or len(s) < 6 or not isinstance(s[2], int) or s[1] not in nombres:
            continue
        t = dt.datetime.fromtimestamp(s[2] / 1000, dt.timezone.utc)
        out.append({'tipo': 'sorteo', 't': _iso(t), 'quien': [nombres[s[1]]], 'ks': [s[1]], 'sorteo': s[0],
                    'personas': s[3], 'boletos': s[4], 'semilla': s[5]})
    return out


def premios(mult):
    """🥇 los premios de cada semana que cerró."""
    out = []
    for s in (mult or {}).get('semanas') or []:
        ps = s.get('premios_semana')
        if ps and s.get('fin'):
            x = {'tipo': 'premios', 't': s['fin']}
            for k in ('figura', 'revelacion', 'cazador', 'servidor'):
                if ps.get(k):
                    x[k] = ps[k]
            out.append(x)
    return out


# ── 🌙 el resumen de cada noche ──────────────────────────────────────────
# Dlx lo aprobó el 07/10/2026 —un solo mensaje al cierre de la noche con los campeones, quién subió de puesto y las
# sorpresas— y nunca se hizo; el 09/11, a «¿dónde va?»: *«publicaciones y en un canal de DRA que ahí te diré»*. Esto
# es lo de Publicaciones; el canal, cuando lo diga.
#
# LA NOCHE de D va de las 12 PM de D a las 3 AM de D+1 (ET), que es cuando para el ciclo (ver `madrugada-sin-ciclo`).
# ⚠️ LO QUE DEPENDE DE UN «ANTES» SE GUARDA: el puesto de cada uno al empezar la noche (`noche_antes` en
# `datos/muro.json`, la primera corrida después de las 12 PM) y el resumen de cada noche (`noches`), que se rehace en
# cada corrida hasta las 12 PM del día siguiente —una llave que entra tarde también cuenta— y después queda.
# ⚠️ EL TIPO ES `resnoche` Y NO `noche`: el tipo es también la clase de la publicación, y `.noche` es el tema oscuro
# de la página (estilo.css): la caja salía negra con letra negra. ⚠️ NO VA EN `DE_ALGUIEN`: no lleva `ks` (las claves van adentro de cada renglón), así el objeto no lo lee como «ganó
# alguien que sigues» y no manda un segundo aviso por cada campeón.
NOCHE_EMPIEZA_H, NOCHE_TERMINA_H = 12, 3
#: cuántas noches se guardan, y desde cuántos puestos se cuenta una subida
NOCHES_GUARDA, SUBE_MIN = 14, 5
#: cuántos van en cada renglón del resumen
NOCHE_TOPE = 3


def _et():
    import zoneinfo
    return zoneinfo.ZoneInfo('America/New_York')


def noche_activa(ahora):
    """La fecha (ET) de la noche que se está armando: hoy desde las 12 PM, si no la de ayer."""
    et = ahora.astimezone(_et())
    return et.date() if et.hour >= NOCHE_EMPIEZA_H else et.date() - dt.timedelta(days=1)


def ventana_noche(d):
    """`(desde, hasta)` en UTC de la noche del día `d`: de las 12 PM de `d` a las 3 AM del día siguiente (ET)."""
    tz = _et()
    desde = dt.datetime(d.year, d.month, d.day, NOCHE_EMPIEZA_H, tzinfo=tz)
    m = d + dt.timedelta(days=1)
    hasta = dt.datetime(m.year, m.month, m.day, NOCHE_TERMINA_H, tzinfo=tz)
    return desde.astimezone(dt.timezone.utc), hasta.astimezone(dt.timezone.utc)


def puestos(pool):
    """`{nombre normalizado: puesto en el Ranking Temporada}` del pool (`datos/temporada_pool.json`)."""
    out = {}
    for r in pool or []:
        if isinstance(r, dict) and r.get('pos'):
            for n in (r.get('raw'), r.get('full')):
                if _norm(n):
                    out.setdefault(_norm(n), int(r['pos']))
    return out


def resumen_noche(d, llaves, instantes, antes, ahora_pos, tabla):
    """🌙 El resumen de la noche `d`, o `None` si esa noche no hubo eventos. Pura.

    `antes` y `ahora_pos` son `{nombre normalizado: puesto}` al empezar la noche y ahora; `tabla`, la del lobby (para la
    clave del perfil). Lleva: los campeones de cada evento, los que más sumaron, los que más subieron en el Ranking
    Temporada (de `SUBE_MIN` puestos para arriba) y las sorpresas: el campeón en su primer evento de la temporada y el
    que gana su primer título."""
    desde, hasta = ventana_noche(d)
    evs, previos = [], []
    for n, L in (llaves or {}).items():
        if not str(n).isdigit() or not isinstance(L, dict):
            continue
        ms = (instantes or {}).get(int(n))
        t = dt.datetime.fromtimestamp(ms / 1000, dt.timezone.utc) if ms else None
        en = desde <= t < hasta if t else L.get('dia') == d.isoformat()
        if en:
            evs.append((t or desde, int(n), L))
        elif (t and t < desde) or (not t and (L.get('dia') or '') < d.isoformat()):
            previos.append(L)
    if not evs:
        return None
    evs.sort(key=lambda x: (x[0], x[1]))
    k = lambda nombre: k_de(nombre, tabla) or ''  # noqa: E731
    jugados, titulos = set(), set()
    for L in previos:
        for r in L.get('tabla') or []:
            if r and _norm(r[0]):
                jugados.add(_norm(r[0]))
                if len(r) > 1 and r[1] == 'Campeón':
                    titulos.add(_norm(r[0]))
    campeones, suma, sorpresas, vistos = [], {}, [], set()
    for _t, n, L in evs:
        camp = [r[0] for r in L.get('tabla') or [] if len(r) > 1 and r[1] == 'Campeón']
        if camp:
            campeones.append({'ev': L.get('nombre') or '', 'sv': L.get('sv') or '', 'll': n,
                              'quien': [[c, k(c)] for c in camp]})
        for r in L.get('tabla') or []:
            if len(r) > 2 and isinstance(r[2], (int, float)) and _norm(r[0]):
                x = suma.setdefault(_norm(r[0]), [r[0], 0, 0])
                x[1] += r[2]
                x[2] += 1
        for c in camp:
            q = _norm(c)
            if not q or q in vistos:
                continue
            vistos.add(q)
            if q not in jugados:
                sorpresas.append({'n': c, 'k': k(c), 'que': 'debut', 'ev': L.get('nombre') or ''})
            elif q not in titulos:
                sorpresas.append({'n': c, 'k': k(c), 'que': 'primer', 'ev': L.get('nombre') or '',
                                  'desde': (antes or {}).get(q)})
            jugados.add(q)
            titulos.add(q)
    suman = sorted(suma.values(), key=lambda x: (-x[1], x[0]))[:NOCHE_TOPE]
    suben = []
    for q, pos in (ahora_pos or {}).items():
        a = (antes or {}).get(q)
        if a and pos and a - pos >= SUBE_MIN and q in suma:
            suben.append((a - pos, pos, suma[q][0], a))
    suben.sort(key=lambda x: (-x[0], x[1]))
    return {'tipo': 'resnoche', 't': _iso(hasta), 'dia': d.isoformat(), 'eventos': len(evs),
            'part': sum(int(L.get('participantes') or len(L.get('tabla') or [])) for _t, _n, L in evs),
            'campeones': campeones,
            'suman': [{'n': n, 'k': k(n), 'pts': p, 'ev': e} for n, p, e in suman],
            'suben': [{'n': n, 'k': k(n), 'de': a, 'a': p} for _s, p, n, a in suben[:NOCHE_TOPE]],
            'sorpresas': sorpresas[:NOCHE_TOPE]}


def noches(guardado, ahora, fuentes, tabla):
    """`(publicaciones, noche_antes, noches)`: el resumen de las últimas noches, con lo que hay que guardar. Si algo
    falla, nada: nunca frena el muro."""
    viejas = dict((guardado or {}).get('noches') or {})
    antes = (guardado or {}).get('noche_antes') or {}
    try:
        d = noche_activa(ahora)
        pos = puestos(fuentes.get('pool'))
        if antes.get('dia') != d.isoformat() and pos:
            antes = {'dia': d.isoformat(), 'pos': pos}
        if antes.get('dia') == d.isoformat():
            r = resumen_noche(d, fuentes.get('llaves'), fuentes.get('instantes'), antes.get('pos'), pos, tabla)
            if r:
                viejas[d.isoformat()] = r
        viejas = dict(sorted(viejas.items())[-NOCHES_GUARDA:])
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ el muro sin el resumen de la noche (%s)' % str(e)[:80])
    return list(viejas.values()), antes, viejas


def crews_suben(ct, vivas):
    """🏆 Las crews que subieron de tier al cerrar cada semana (`bot/crews_tiers.py`, su `hist`: `[sem, crew, de, a,
    puntos]`). Dlx, 19/10/2026, a «el primer cierre de tiers pasa en silencio»: «me gusta todo». Sólo las que SUBEN: que
    una crew baje no es una noticia para publicar (a su gente le llega a la campana). La hora es la del cierre: el lunes
    siguiente, a las 11 AM ET."""
    try:
        from zoneinfo import ZoneInfo
        et = ZoneInfo('America/New_York')
    except Exception:                                    # noqa: BLE001
        et = dt.timezone(dt.timedelta(hours=-4))
    nombres = (ct or {}).get('nombres') or ['Bronce', 'Plata', 'Oro', 'Platino', 'Diamante', 'Maestro', 'Leyenda']
    try:
        import crews_tiers as CT
        nombres = [t[0] for t in CT.TIERS]
        diamante = CT.TARJETA
    except Exception:                                    # noqa: BLE001
        diamante = 4
    viva = {c.get('id'): c for c in (vivas or {}).get('crews') or []}
    out = []
    for h in (ct or {}).get('hist') or []:
        if not isinstance(h, list) or len(h) < 5 or not isinstance(h[2], int) or not isinstance(h[3], int) or h[3] <= h[2]:
            continue
        c = viva.get(h[1])
        if not c:
            continue
        try:
            cierre = dt.datetime.combine(dt.date.fromisoformat(h[0]) + dt.timedelta(days=7), dt.time(11), et)
        except ValueError:
            continue
        x = {'tipo': 'crewtier', 't': _iso(cierre.astimezone(dt.timezone.utc)), 'crew': h[1], 'nombre': c.get('nombre') or h[1],
             'tier': h[3], 'tn': nombres[h[3]] if 0 <= h[3] < len(nombres) else '', 'pts': int(h[4] or 0), 'sem': h[0]}
        if h[3] == diamante:
            x['tarjeta'] = True
        # 🛡️ o el escudo armado (`esc:…`, 29/10/2026): lo dibuja la página
        if str(c.get('logo') or '').startswith(('https://', 'esc:')):
            x['logo'] = c['logo']
        out.append(x)
    return out


def anuncios(an):
    """📢 los anuncios de eventos de todos los servidores."""
    out = []
    for a in (an or {}).get('anuncios') or []:
        t = _de_iso(a.get('cuando'))
        if not t or not a.get('nombre'):
            continue
        x = {'tipo': 'anuncio', 't': _iso(t), 'ev': a['nombre'], 'sv': a.get('servidor') or ''}
        if a.get('guild_id') and a.get('canal_id') and a.get('msg_id'):
            x['link'] = 'https://discord.com/channels/%s/%s/%s' % (a['guild_id'], a['canal_id'], a['msg_id'])
        for k, c in (('modalidad', 'mod'), ('premios', 'pre')):
            if a.get(k):
                x[c] = str(a[k])[:80]
        # ⚠️ EL ORGANIZADOR, LIMPIO: el «Organiza:» a veces dice «yo» o «staff»,
        # que no es nadie (la misma regla que la Copa de la Liga)
        org = _org(a.get('organizador'))
        if org:
            x['org'] = org[:60]
        out.append(x)
    return out


def flyers(lg, svs=None):
    """🖼️ el último afiche de cada liga de los servidores (`bot/ligas.py`, Dlx 14/10/2026: «Flyers en Publicaciones e
    Historias»). SÓLO el que está en R2 (`url`): el link de Discord vence, y un afiche roto es peor que ninguno.

    Uno por liga —el más nuevo—: las FMH publican uno por batalla (cinco por jornada), y cinco afiches de la misma liga
    seguidos tapaban el resto del muro (Dlx: «no sobrecargar»). `svs`: `{sigla: {guild_id}}`, para el link."""
    import ligas as LG
    if svs is None:
        svs = (_j('datos', 'servidores.json') or {}).get('servidores') or {}
    out = []
    for lid, x in ((lg or {}).get('ligas') or {}).items():
        fl = x.get('flyer') or {}
        # ⚠️ y sólo de una liga que ya está en Ligas (con una batalla cerrada): «Ver la liga» tiene que llevar a algún lado
        if not fl.get('url') or not _de_iso(fl.get('t')) or not any(len(b) > 5 and b[5] for b in x.get('batallas') or []):
            continue
        L = LG.LIGAS.get(lid) or {}
        sv = x.get('sv') or L.get('sv') or ''
        y = {'tipo': 'flyer', 't': _iso(_de_iso(fl['t'])), 'liga': lid, 'ln': x.get('n') or L.get('n') or lid, 'sv': sv,
             'img': fl['url'], 'w': fl.get('w') or 0, 'h': fl.get('h') or 0}
        if fl.get('tit'):
            y['tit'] = str(fl['tit'])[:90]
        g = (svs.get(sv) or {}).get('guild_id')
        if g and L.get('an') and fl.get('id'):
            y['link'] = 'https://discord.com/channels/%s/%s/%s' % (g, L['an'], fl['id'])
        out.append(y)
    return out


def _org(s):
    try:
        import multiplicadores as MU
        return MU._org(s or '')
    except Exception:                                    # noqa: BLE001
        return str(s or '').strip()


def novedades(nov):
    """📰 lo que anunció la Liga en DRA (lo mismo que el Inicio, `_novedades()`)."""
    return [{'tipo': 'liga', 't': x['t'], 'tit': x.get('tit') or '', 'tx': x.get('tx') or '',
             'link': x.get('link') or ''} for x in nov or [] if x.get('t')]


# ── lo que se anota: los cambios entre corridas ──────────────────────────
def cambios(estado, tabla, ahora):
    """`(publicaciones, estado nuevo)`: quién subió de rango y quién desbloqueó una tarjeta.

    `estado` es `{clave: {rg, c}}` de la corrida anterior. ⚠️ A QUIEN NO
    ESTABA SE LO ANOTA SIN PUBLICAR NADA: la primera vez no hay «antes».
    """
    t = _iso(ahora)
    nuevo, pubs = {}, []
    for f in tabla or []:
        k = f.get('k')
        if not k:
            continue
        rg, cs = f.get('rg') or '', sorted(f.get('c') or [])
        nuevo[k] = {'rg': rg, 'c': cs}
        antes = (estado or {}).get(k)
        if antes is None:
            continue
        if _nivel(rg) > _nivel(antes.get('rg')):
            pubs.append({'tipo': 'rango', 't': t, 'quien': [f['n']], 'rg': _base(rg),
                         'primero': not _nivel(antes.get('rg'))})
        for c in cs:
            if c not in (antes.get('c') or []) and c in TARJETA:
                pubs.append({'tipo': 'tarjeta', 't': t, 'quien': [f['n']], 'carta': c})
    # quien no vino esta vez (salió del ranking) conserva lo último que se supo
    for k, v in (estado or {}).items():
        nuevo.setdefault(k, v)
    return pubs, nuevo


# ── la identidad de cada publicación: para 👏 Felicitar ──────────────────
def id_de(x):
    """12 letras hex, las mismas en cada corrida. Las usa 👏 Felicitar (`validarAplauso()` en `bot/avisos.js`).

    ⚠️ SALE DE LO QUE HACE A ESA PUBLICACIÓN, NO DEL JSON ENTERO: la llave del
    campeón, la cabeza de la caza, el cambio y cuándo se anotó. Un nombre
    corregido o una caza con otro cazador sigue siendo la misma publicación,
    y no pierde los aplausos que ya tenía.
    """
    tipo = x.get('tipo') or ''
    if tipo == 'campeon' and x.get('ll'):
        partes = [tipo, str(x['ll'])]
    elif tipo in ('caza', 'precio'):
        partes = [tipo, x.get('a') or '', x.get('t') or '']
    elif tipo in ('anuncio', 'liga', 'flyer') and x.get('link'):
        partes = [tipo, x['link']]
    elif tipo == 'flyer':
        # 🖼️ sin link (el servidor sin guild): la liga y la imagen, que lleva el id del mensaje
        partes = [tipo, x.get('liga') or '', x.get('img') or '']
    elif tipo == 'mesaward':
        # 🏆 qué mes y qué categoría: uno por cada una
        partes = [tipo, x.get('mes') or '', x.get('cat') or '']
    elif tipo == 'promo':
        # 📣 el mensaje y el link: la misma promo es la misma publicación en cada corrida
        partes = [tipo, x.get('pid') or x.get('url') or '']
    elif tipo == 'ligahito':
        # 🏟️ qué pasó, en qué liga, quién y cuándo: el mismo hito sale igual en cada corrida
        partes = [tipo, x.get('que') or '', x.get('liga') or '', '|'.join(x.get('quien') or []), x.get('t') or '']
    elif tipo == 'crewtier':
        # 🏆 qué crew, qué semana y a qué tier: una por cierre
        partes = [tipo, x.get('crew') or '', x.get('sem') or '', str(x.get('tier') or '')]
    elif tipo == 'sorteo':
        # 🎟️ un sorteo tiene un solo ganador: el id del sorteo alcanza
        partes = [tipo, x.get('sorteo') or '']
    elif tipo == 'resnoche':
        # 🌙 una por noche: se rehace hasta el mediodía siguiente y sigue siendo la misma publicación
        partes = [tipo, x.get('dia') or '']
    elif tipo == 'pase':
        # 🎟️ de quién (su perfil), de qué temporada y qué nivel: llega una sola vez
        partes = [tipo, x.get('temp') or '', str(x.get('nivel') or ''), (x.get('ks') or [''])[0] or '|'.join(x.get('quien') or [])]
    else:
        partes = [tipo, x.get('t') or '', '|'.join(x.get('quien') or []), x.get('rg') or '', x.get('carta') or '',
                  x.get('ev') or '', x.get('tit') or '']
    return hashlib.sha1('\x1f'.join(partes).encode('utf-8')).hexdigest()[:12]


def con_ids(items):
    """Cada publicación con su `id`; la misma identidad dos veces es una sola (queda la primera: la más nueva)."""
    out, vistos = [], set()
    for x in items:
        i = id_de(x)
        if i in vistos:
            continue
        vistos.add(i)
        out.append(dict(x, id=i))
    return out


# ── de quién es cada publicación: para los seguidores ────────────────────
#: las publicaciones que son de alguien. Los anuncios y las novedades no son de nadie
DE_ALGUIEN = ('campeon', 'rango', 'tarjeta', 'caza', 'sobrevivio', 'elegido', 'precio', 'premios', 'pase', 'sorteo', 'ligahito',
              'promo', 'mesaward')
#: los premios de la semana que son de una persona (el de servidor no)
PREMIOS = ('figura', 'revelacion', 'cazador')


def _norm(s):
    """El nombre para comparar: lo mismo que `normNombre()` de la página."""
    import unicodedata
    return ''.join(c for c in unicodedata.normalize('NFKD', str(s or '')).lower() if c.isalnum())


def _banderas(s):
    """Los países de las banderas de un nombre («Ana 🇦🇷» -> ['ar']), como `banderasDe()`."""
    out, par = [], ''
    for ch in str(s or ''):
        c = ord(ch)
        if 0x1F1E6 <= c <= 0x1F1FF:
            par += chr(c - 0x1F1E6 + 97)
            if len(par) == 2:
                out.append(par)
                par = ''
    return out


def k_de(n, tabla):
    """La clave del perfil de ese nombre, igual que `kDe()` de la página; `''` si no es seguro."""
    exacto = [f for f in tabla or [] if f.get('k') and f.get('n') == n]
    if exacto:
        return exacto[0]['k']
    c = [f for f in tabla or [] if f.get('k') and _norm(f.get('n')) == _norm(n)]
    if len(c) == 1:
        return c[0]['k']
    ccs = _banderas(n)
    m = [f for f in c if str(f.get('cc') or '').lower() in ccs]
    return m[0]['k'] if len(m) == 1 else ''


def con_claves(items, tabla, entera=None):
    """Cada publicación que es de alguien, con la clave de su perfil (`ks`).

    🔑 PARA LOS SEGUIDORES (Dlx, 28/09/2026: *«sí, hay que hacer eso»*). El
    Durable Object lee este muro y le avisa a quien sigue a esa persona
    (`seguidos()` en `bot/avisos.js`). Allá no hay tabla para pasar de un
    nombre a un perfil; acá sí. Y así no hace falta otra clave de KV: el muro
    ya se escribe sólo si cambió.

    ⚠️ `ks` VA ALINEADO CON `quien` —una clave por nombre, `''` si no se
    sabe—; en los premios es `{figura|revelacion|cazador: clave}`. Son las
    claves de los links `#/r/<clave>`: públicas, como el muro. Ningún
    Discord ID.

    📣 `entera`: la tabla con quien no entra en la del lobby, sólo para las promos (revisión del 04/11/2026). Sin su
    clave, quien no estaba entre los 200 no veía su promo en la Tienda y el objeto contestaba «no es tuya» al alargarla.
    Las demás siguen con la del lobby: su publicación se dibuja con la carta de su fila, que la página no tiene.
    """
    out = []
    for x in items:
        # ⚠️ la que ya trae su clave (las del Pase: salen de la clave, no del nombre) no se vuelve a buscar
        if x.get('tipo') not in DE_ALGUIEN or x.get('ks'):
            out.append(x)
            continue
        y = dict(x)
        if x['tipo'] == 'premios':
            ks = {r: k_de(x[r][0], tabla) for r in PREMIOS if x.get(r)}
            ks = {r: k for r, k in ks.items() if k}
        else:
            t = (entera or tabla) if x['tipo'] == 'promo' else tabla
            ks = [k_de(n, t) for n in x.get('quien') or []]
            ks = ks if any(ks) else None
        if ks:
            y['ks'] = ks
        out.append(y)
    return out


def _fuentes():
    """De dónde sale lo que se vuelve a armar en cada corrida."""
    import llaves_web as LW
    regs = LW.leer()
    return {'llaves': regs, 'instantes': LW.instantes(regs), 'mw': _j('datos', 'mw.json'),
            'precios': _j('datos', 'precios.json'), 'mult': _j('datos', 'multiplicadores.json'),
            'anuncios': _j('datos', 'anuncios.json'), 'pase': _j('datos', 'pase_niveles.json'),
            'ligas': _j('datos', 'ligas.json'), 'promos': _j('datos', 'promos.json'),
            'crews_tiers': _j('datos', 'crews_tiers.json'), 'crews_vivas': _j('datos', 'crews_vivas.json'),
            # 🌙 el puesto de cada uno, para «quién subió» en el resumen de la noche (`noches()`)
            'pool': _j('datos', 'temporada_pool.json')}


def _arranque(ahora):
    """El arranque de la temporada en curso, si ya pasó; `None` si no."""
    try:
        from comun.temporada import arranque
        a = arranque()
        a = dt.datetime.fromisoformat(a) if a else None
        return a if a and a <= ahora else None
    except Exception:                                    # noqa: BLE001
        return None


#: 📰 en el perfil de cada uno, hasta cuántas publicaciones suyas viajan (las más nuevas)
POR_PERSONA = 40


def de_cada_uno(p, guardado=None, ahora=None, fuentes=None, tope=POR_PERSONA):
    """📰 `{clave: [publicación, …]}`: las publicaciones de cada uno de TODA la temporada, la más nueva primero.

    🔑 Dlx, 13/10/2026: *«pon ahí las publicaciones de cada uno que el bot publica… no todas claramente pero con la
    opción de ver todas»*. El muro trae sólo las de los últimos `DIAS` días y `VIAJAN` en total; acá van todas las de
    cada uno desde el arranque (hasta `tope`), con su `id` —se felicitan igual que en Publicaciones— y sus `ks`.
    Viajan en los perfiles (`mu`, ver `bot/subir_web.py`): no hay otra clave de KV.

    ⚠️ Lee lo que `publicar()` acaba de guardar: los cambios (rango, tarjeta) ya están anotados y no se repiten.
    """
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    guardado = guardado if guardado is not None else (_j('datos', 'muro.json') or {})
    fuentes = fuentes if fuentes is not None else _fuentes()
    # 📣 en el perfil, más promos de cada uno que en el muro (`PROMOS_PERFIL`)
    todo, _estado, _anotados = _todo(p, guardado, ahora, fuentes, promos_por=PROMOS_PERFIL)
    desde = _arranque(ahora)
    visto, lista = set(), []
    for x in todo:
        if x.get('tipo') not in DE_ALGUIEN:
            continue
        t = _de_iso(x.get('t'))
        if not t or (desde and t < desde) or t > ahora + dt.timedelta(hours=1):
            continue
        clave = json.dumps(x, sort_keys=True, ensure_ascii=False)
        if clave in visto:
            continue
        visto.add(clave)
        lista.append(x)
    lista.sort(key=lambda x: x['t'], reverse=True)
    out = {}
    for x in con_claves(con_ids(lista), p.get('tabla')):
        ks = x.get('ks')
        ks = list(ks.values()) if isinstance(ks, dict) else (ks or [])
        for k in dict.fromkeys(k for k in ks if k):
            if len(out.setdefault(k, [])) < tope:
                out[k].append(x)
    return out


#: 📣 cuántas promos de cada uno van a su perfil (en el muro, `promos.POR_PERSONA`)
PROMOS_PERFIL = 8


def _todo(p, guardado, ahora, fuentes, promos_por=None):
    """`(todas las publicaciones sin filtrar, estado nuevo, cambios anotados)`."""
    pubs, estado = cambios(guardado.get('estado'), p.get('tabla'), ahora)
    anotados = (guardado.get('cambios') or []) + pubs
    anotados = anotados[-GUARDA:]
    todo = (anotados + campeones(fuentes.get('llaves'), fuentes.get('instantes'))
            + most_wanted(fuentes.get('mw')) + precios_cobrados(fuentes.get('precios'))
            + premios(fuentes.get('mult')) + anuncios(fuentes.get('anuncios'))
            + pase(fuentes.get('pase'), p.get('tabla')) + sorteos(fuentes.get('pase'), p.get('tabla'))
            + novedades(p.get('novedades'))
            + flyers(fuentes.get('ligas'), fuentes.get('svs')) + ligas_hitos(fuentes.get('ligas'))
            + promos_muro(fuentes.get('promos'), ahora, promos_por) + mes_muro()
            + crews_suben(fuentes.get('crews_tiers'), fuentes.get('crews_vivas')))
    return todo, estado, anotados


def mes_muro():
    """🏆 Los ganadores de los MES AWARDS (`bot/mes_awards.py`). Si algo falla, ninguno: nunca frena el muro."""
    try:
        import mes_awards as MA
        return MA.muro()
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ el muro sin los MES AWARDS (%s)' % str(e)[:80])
        return []


def promos_muro(d, ahora, por=None):
    """📣 Las promociones de los servidores (`bot/promos.py`). Si algo falla, ninguna: nunca frena el muro."""
    if not d:
        return []
    try:
        import promos as PR
        return PR.para_muro(d, ahora, por or PR.POR_PERSONA, PR.GUARDA if por else PR.AL_MURO, respaldo=not por)
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ el muro sin las promos (%s)' % str(e)[:80])
        return []


def ligas_hitos(lg):
    """🏟️ Lo que pasa en las ligas de los servidores: invicto, la punta y el campeón (`bot/ligas.py`). Si algo falla,
    nada: nunca frena el muro."""
    if not lg:
        return []
    try:
        import ligas as LG
        return LG.hitos(lg) + LG.campeones_hitos(d=lg)
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ el muro sin las ligas (%s)' % str(e)[:80])
        return []


def _tabla_entera(p, perfiles):
    """La tabla del lobby y las filas de quien no entra en ella, que viajan en su perfil (`subir_web._perfiles_extra()`)."""
    extra = [(v or {}).get('f') for v in ((perfiles or {}).get('p') or {}).values()]
    return (p.get('tabla') or []) + [f for f in extra if f and not f.get('solo')]


def armar(p, guardado=None, ahora=None, fuentes=None, perfiles=None, permisos=None):
    """`(muro para la página, lo que se guarda)` con el payload del lobby `p`.

    `fuentes` es para el self-check: `{llaves, instantes, mw, precios, mult, anuncios}`. `permisos`, de quién se puede
    usar la cara en los comentarios simulados (`comentarios_sim.permisos()`); sin ellos, todos con la etiqueta.
    """
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    guardado = guardado if guardado is not None else (_j('datos', 'muro.json') or {})
    if fuentes is None:
        fuentes = _fuentes()
    todo, estado, anotados = _todo(p, guardado, ahora, fuentes)
    # 🌙 y el resumen de cada noche, con su «antes» guardado: ver `noches()`
    ns, n_antes, n_guarda = noches(guardado, ahora, fuentes, p.get('tabla'))
    todo = todo + ns
    # desde cuándo: lo de los últimos días, y nunca lo de antes del arranque
    desde = ahora - dt.timedelta(days=DIAS)
    a = _arranque(ahora)
    if a and a > desde:
        desde = a
    visto, lista = set(), []
    # 📣 una promo está hasta su `hasta` (la semana, lo alargado en la Tienda o el respaldo del círculo: `bot/promos.py`),
    # aunque sea de antes de `desde`
    sigue = lambda x: x.get('tipo') == 'promo' and (_de_iso(x.get('hasta')) or ahora) > ahora  # noqa: E731
    for x in todo:
        t = _de_iso(x.get('t'))
        if not t or (t < desde and not sigue(x)) or t > ahora + dt.timedelta(hours=1):
            continue
        clave = json.dumps(x, sort_keys=True, ensure_ascii=False)
        if clave in visto:
            continue
        visto.add(clave)
        lista.append(x)
    lista.sort(key=lambda x: x['t'], reverse=True)
    muro = {'_leeme': 'El muro de Publicaciones: lo arma bot/muro.py desde bot/subir_web.py (paso 2c).',
            # 📣 y las promos que siguen viajan aunque pasen de `VIAJAN`: una alargada en la Tienda es vieja y pagó
            'items': con_claves([x for i, x in enumerate(con_ids(lista)) if i < VIAJAN or sigue(x)], p.get('tabla'), _tabla_entera(p, perfiles))}
    # 💬 Y LOS COMENTARIOS SIMULADOS de cada publicación (Dlx, 12/11/2026: «Sí, constrúyelo»): ver bot/comentarios_sim.py.
    # ⚠️ Después de los ids y las claves: el `id` no los mira, así felicitar y comentar siguen apuntando a lo mismo
    try:
        import comentarios_sim as CS
        try:
            import fotos as _FT
            oc = _FT.ocultas(None).get('nombres') or []
        except Exception:                                # noqa: BLE001
            oc = []
        muro['items'] = CS.poner(muro['items'], p.get('tabla'), permisos or CS.permisos(None), ahora,
                                 (fuentes or {}).get('llaves'), oc)
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ los comentarios simulados: %s' % str(e)[:80])
    guardar = {'_leeme': 'El muro de Publicaciones: cómo estaba cada uno (rango y tarjetas) y los cambios '
                         'que se anotaron. Lo escribe bot/muro.py; lo demás del muro se arma en cada corrida.',
               'estado': estado, 'cambios': anotados, 'noche_antes': n_antes, 'noches': n_guarda}
    return muro, guardar


def publicar(p, subir=None, perfiles=None):
    """Arma el muro, lo guarda y lo sube a KV. `subir` es `subir_web.subir`."""
    # 💬 los permisos de los comentarios, de KV (`cm:permisos`); sin token o sin red, la copia (`comentarios_sim.permisos()`)
    perm = None
    try:
        import comentarios_sim as CS
        import fotos as _FT
        tk = _FT.env('CLOUDFLARE_API_TOKEN', obligatorio=False)
        if tk:
            import requests as _rq
            s = _rq.Session()
            s.headers['Authorization'] = 'Bearer ' + tk
            perm = CS.permisos(s)
    except Exception:                                    # noqa: BLE001
        perm = None
    muro, guardar = armar(p, perfiles=perfiles, permisos=perm)
    with io.open(SALIDA, 'w', encoding='utf-8') as f:
        json.dump(guardar, f, ensure_ascii=False, indent=0)
    ok = subir(muro, solo_si_cambio=True, clave=CLAVE) if subir else None
    return ok, len(muro['items'])


# ── self-check ───────────────────────────────────────────────────────────
def _self_check():
    print('\n══ EL MURO DE PUBLICACIONES ══\n')
    mal = 0

    def ok(c, que):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', que))

    ahora = dt.datetime(2026, 10, 14, 15, tzinfo=dt.timezone.utc)
    ms = lambda d, h: int(dt.datetime(2026, 10, d, h, tzinfo=dt.timezone.utc).timestamp() * 1000)
    tabla = [{'k': 'ana', 'n': 'Ana', 'rg': 'B+', 'c': ['temporada', 'competitivo']},
             {'k': 'bea', 'n': 'Bea', 'rg': 'C', 'c': ['temporada']},
             {'k': 'cid', 'n': 'Cid', 'rg': '', 'c': ['temporada']}]
    antes = {'ana': {'rg': 'C+', 'c': ['temporada']}, 'bea': {'rg': 'C-', 'c': ['temporada']},
             'dan': {'rg': 'A', 'c': []}}
    pubs, est = cambios(antes, tabla, ahora)
    tipos = sorted((x['tipo'], x['quien'][0], x.get('rg') or x.get('carta')) for x in pubs)
    ok(tipos == [('rango', 'Ana', 'B'), ('tarjeta', 'Ana', 'competitivo')],
       'Ana subió de C a B y desbloqueó la Competitiva; Bea sólo cambió el signo  %s' % tipos)
    ok('cid' in est and not [x for x in pubs if x['quien'] == ['Cid']],
       'a quien no estaba se lo anota sin publicar nada (la primera vez no hay antes)')
    ok(est.get('dan') == {'rg': 'A', 'c': []}, 'y quien no vino conserva lo último que se supo')
    p2, _e = cambios({'bea': {'rg': '', 'c': ['temporada']}}, tabla, ahora)
    ok([x['primero'] for x in p2 if x['tipo'] == 'rango'] == [True], 'el primer rango se marca como primero')
    fuentes = {
        'llaves': {'7': {'nombre': 'COPA', 'sv': 'SR', 'dia': '2026-10-13', 'participantes': 16,
                         'tabla': [['Ana', 'Campeón', 5000], ['Bea', 'Subcampeón', 3750]]},
                   '1': {'nombre': 'VIEJO', 'sv': 'FFA', 'dia': '2026-09-01',
                         'tabla': [['Zoe', 'Campeón', 5000]]}},
        'instantes': {7: ms(13, 22), 1: ms(1, 22) - 30 * 86400000},
        'mw': {'actual': {'id': 'x', 'temporada': 't1', 'fin': '2026-10-19T15:00:00Z', 'elegido': '2026-10-12T15:22:00Z',
                          'buscados': [{'n': 'Bea', 'cat': 'rey', 'cn': 'El Rey', 'estado': 'cazado',
                                        'caza': {'t': '2026-10-13T22:00:00Z', 'evento': 'COPA', 'sv': 'SR',
                                                 'por': [{'n': 'Ana', 'cobra': 9500}]}},
                                       {'n': 'Cid', 'cat': 'elegido', 'cn': 'El Elegido', 'votos': 5, 'de': 9}]}},
        'precios': {'precios': [{'e': 'cazado', 'cabeza': 'Bea', 'monto': 3000, 'por': [['Ana', 3000]],
                                 'ev': {'nombre': 'COPA', 'sv': 'SR', 't': '2026-10-13T22:00:00Z'}},
                                {'e': 'activo', 'cabeza': 'Cid', 'monto': 500}]},
        'mult': {'semanas': [{'fin': '2026-10-12T15:00:00Z', 'premios_semana': {'figura': ['Ana', 12000]}}]},
        'anuncios': {'anuncios': [{'nombre': 'SNAKE ARENA', 'servidor': 'SR', 'cuando': '2026-10-14T12:00:00',
                                   'guild_id': '1', 'canal_id': '2', 'msg_id': '3', 'organizador': 'Nacho'}]},
        'pase': {'temp': 't1', 'hitos': [['111', 10, ms(13, 20), 'ana'], ['222', 30, ms(13, 21), 'nadie'],
                                         ['333', 10, ms(13, 22), '']],
                 'sorteos': [['premium-t1', 'ana', ms(13, 23), 12, 20, 'ab' * 32], ['otro', 'nadie', ms(13, 23), 1, 1, 'c']]},
        # 🖼️ el flyer de una liga: sólo el que está en R2
        'ligas': {'ligas': {'fmh-espana': {'n': 'FMH España', 'sv': 'URBF', 'flyer': {
            'id': '55', 't': '2026-10-14T13:47:43Z', 'tit': 'MTZ vs ORTIZ', 'url': 'https://r2/ligas/fmh-espana/55.webp',
            'w': 720, 'h': 900}, 'batallas': [['1', '2026-10-13T20:00:00Z', 6, 'MTZ', 'ORTIZ', 'ORTIZ', 'directa', '']]},
            'fms-peru': {'n': 'FMS Perú', 'sv': 'DDF', 'flyer': {'id': '56', 't': '2026-10-14T12:00:00Z'},
                         'batallas': [['2', '2026-10-13T20:00:00Z', 1, 'A', 'B', 'A', 'directa', '']]},
            # una liga con afiche y sin ninguna batalla cerrada todavía no está en Ligas: su flyer no va
            'fms-world-series': {'n': 'FMS World Series', 'sv': 'DDF', 'flyer': {
                'id': '57', 't': '2026-10-14T12:00:00Z', 'url': 'https://r2/ligas/ws/57.webp'},
                'batallas': [['3', '2026-10-13T20:00:00Z', 1, 'A', 'B', '', '', '']]}}},
        'svs': {'URBF': {'guild_id': '9'}},
        # 🏆 una crew que sube y otra que baja (la que baja no se publica)
        'crews_tiers': {'hist': [['2026-10-05', 'KS', 0, 1, 31000], ['2026-10-05', 'Otra', 1, 0, 100]]},
        'crews_vivas': {'crews': [{'id': 'KS', 'nombre': 'Knowledge Sombrío', 'logo': 'https://r2/logos-crews/a.webp'},
                                  {'id': 'Otra', 'nombre': 'Otra'}]}}
    muro, guardar = armar({'tabla': tabla, 'novedades': [{'t': '2026-10-14T13:00:00Z', 'tit': 'Hola',
                                                          'tx': 'la Liga', 'link': 'x'}]},
                          guardado={'estado': antes, 'cambios': []}, ahora=ahora, fuentes=fuentes)
    ts = [x['tipo'] for x in muro['items']]
    ok(set(ts) == {'rango', 'tarjeta', 'campeon', 'caza', 'elegido', 'precio', 'premios', 'anuncio', 'liga', 'pase',
                   'flyer', 'crewtier', 'sorteo'},
       'entra todo: rango, tarjeta, campeón, caza, El Elegido, precio, premios, anuncio, novedades, el Pase y los flyers  %s'
       % sorted(set(ts)))
    fy = [x for x in muro['items'] if x['tipo'] == 'flyer']
    ok(len(fy) == 1 and fy[0]['img'] == 'https://r2/ligas/fmh-espana/55.webp' and fy[0]['ln'] == 'FMH España'
       and fy[0]['link'] == 'https://discord.com/channels/9/1512167830919839844/55' and fy[0]['tit'] == 'MTZ vs ORTIZ'
       and 'ks' not in fy[0] and fy[0]['id'] == id_de(dict(fy[0], tit='otro', t='x')),
       '🖼️ el flyer de una liga: sólo el que está en R2, con el link a su mensaje, de nadie, y su id es el del mensaje  %s' % fy)
    ct = [x for x in muro['items'] if x['tipo'] == 'crewtier']
    ok(len(ct) == 1 and ct[0]['nombre'] == 'Knowledge Sombrío' and ct[0]['tn'] == 'Plata' and ct[0]['t'] == '2026-10-12T15:00:00Z'
       and ct[0]['logo'].endswith('a.webp') and 'ks' not in ct[0],
       '🏆 la crew que sube de tier, con la hora del cierre (lunes 11 AM ET); la que baja no se publica  %s' % ct)
    pa = [x for x in muro['items'] if x['tipo'] == 'pase']
    ok(len(pa) == 1 and pa[0]['quien'] == ['Ana'] and pa[0]['ks'] == ['ana'] and pa[0]['nivel'] == 10
       and pa[0]['premio'] == 'De la casa' and pa[0]['completo'] is False and pa[0]['t'] == '2026-10-13T20:00:00Z',
       '🎟️ el Pase: Ana llegó al 10 («De la casa»); quien no tiene perfil (o no está en la tabla) no sale  %s' % pa)
    so = [x for x in muro['items'] if x['tipo'] == 'sorteo']
    ok(len(so) == 1 and so[0]['quien'] == ['Ana'] and so[0]['ks'] == ['ana'] and so[0]['personas'] == 12
       and so[0]['boletos'] == 20 and so[0]['semilla'] == 'ab' * 32,
       '🎟️ el sorteo del premium: el ganador con su perfil, cuántos entraron y la semilla; sin perfil no sale  %s' % so)
    ok(id_de(dict(pa[0], quien=['Ana 🇦🇷'], t='otra')) == pa[0]['id'],
       'y su id sale de su perfil, la temporada y el nivel: un nombre corregido no le borra los aplausos')
    ok([x['t'] for x in muro['items']] == sorted((x['t'] for x in muro['items']), reverse=True),
       'lo más nuevo arriba')
    ok(not [x for x in muro['items'] if x.get('ev') == 'VIEJO'], 'lo de hace más de %d días no entra' % DIAS)
    an = [x for x in muro['items'] if x['tipo'] == 'anuncio'][0]
    ok(an['t'] == '2026-10-14T12:00:00Z' and an['link'] == 'https://discord.com/channels/1/2/3' and an['org'] == 'Nacho',
       'el anuncio, con su link a Discord y la hora de Discord leída como UTC')
    ok(len(guardar['cambios']) == 2 and guardar['estado']['ana']['rg'] == 'B+',
       'se guardan los cambios y cómo quedó cada uno, para la próxima')
    m2, _g2 = armar({'tabla': tabla}, guardado=guardar, ahora=ahora + dt.timedelta(minutes=30), fuentes={})
    ok(sorted(x['tipo'] for x in m2['items']) == ['rango', 'tarjeta'],
       'en la corrida siguiente los cambios siguen ahí y no se repiten')
    ok(json.dumps(muro) and 'discord_id' not in json.dumps(muro), 'y ningún Discord ID viaja')
    # 🔑 las claves, para los seguidores
    por = {x['tipo']: x for x in muro['items']}
    ok(por['campeon'].get('ks') == ['ana'] and por['caza'].get('ks') == ['ana'] and por['rango'].get('ks') == ['ana'],
       'cada publicación de alguien lleva la clave de su perfil, alineada con los nombres')
    ok(por['premios'].get('ks') == {'figura': 'ana'} and 'ks' not in por['anuncio'] and 'ks' not in por['liga'],
       'los premios, por premio; los anuncios y las novedades no son de nadie')
    # 👏 el id de cada publicación, para Felicitar
    ids = [x.get('id') or '' for x in muro['items']]
    ok(all(len(i) == 12 and all(c in '0123456789abcdef' for c in i) for i in ids) and len(set(ids)) == len(ids),
       'cada publicación lleva su id (12 hex) y no se repite  %s' % ids[:3])
    rid = lambda m, tipo: [x['id'] for x in m['items'] if x['tipo'] == tipo]
    ok(rid(m2, 'rango') == rid(muro, 'rango') and rid(m2, 'tarjeta') == rid(muro, 'tarjeta'),
       'y es el mismo en la corrida siguiente (los aplausos no se pierden)')
    caza = [x for x in muro['items'] if x['tipo'] == 'caza'][0]
    ok(id_de(dict(caza, quien=['Otro'], pts=1)) == caza['id'] and
       id_de({'tipo': 'campeon', 'll': 7, 'quien': ['Ana'], 't': 'x'}) == id_de({'tipo': 'campeon', 'll': 7, 'quien': ['Bea']}),
       'una caza con otro cazador, o un campeón con el nombre corregido, sigue siendo la misma publicación')
    dos = con_ids([{'tipo': 'campeon', 'll': 7, 't': '2', 'quien': ['Ana']}, {'tipo': 'campeon', 'll': 7, 't': '1', 'quien': ['Ana ']}])
    ok(len(dos) == 1 and dos[0]['t'] == '2', 'la misma publicación dos veces es una: queda la más nueva')
    t2 = [{'k': 'volk', 'n': 'Volk', 'cc': 'mx'}, {'k': 'volk-co', 'n': 'volk', 'cc': 'co'},
          {'k': 'lazaro', 'n': 'Lázaro', 'cc': 'cu'}]
    ok([k_de(n, t2) for n in ('Volk', 'volk', 'VOLK 🇨🇴', 'VOLK', 'lazaro 🇨🇺', 'Nadie')]
       == ['volk', 'volk-co', 'volk-co', '', 'lazaro', ''],
       'el nombre se lleva a la clave como en la página: exacto, sin tildes ni banderas, y la bandera desempata')
    # 🌙 el resumen de la noche (09/11/2026)
    nd = dt.date(2026, 11, 8)
    et = lambda d, h, m=0: int(dt.datetime(2026, 11, d, h, m, tzinfo=_et()).timestamp() * 1000)  # noqa: E731
    ll = {'10': {'nombre': 'VIEJA', 'sv': 'FFA', 'dia': '2026-11-01', 'tabla': [['Ana', 'Campeón', 7500], ['Bea', 'Subcampeón', 5000]]},
          '11': {'nombre': 'K.O.M', 'sv': 'FFA', 'dia': '2026-11-08', 'tabla': [['Bea', 'Campeón', 7500], ['Ana', 'Subcampeón', 5000]]},
          '12': {'nombre': 'LA DE MADRUGADA', 'sv': 'DDF', 'dia': '2026-11-09', 'tabla': [['Eli', 'Campeón', 5000], ['Ana', 'Semifinal', 2000]]},
          '13': {'nombre': 'LA DEL OTRO DÍA', 'sv': 'SR', 'dia': '2026-11-09', 'tabla': [['Cid', 'Campeón', 5000]]}}
    ins = {10: et(1, 21), 11: et(8, 21), 12: et(9, 1, 30), 13: et(9, 20)}
    tb = [{'k': 'ana', 'n': 'Ana'}, {'k': 'bea', 'n': 'Bea'}]
    r = resumen_noche(nd, ll, ins, {'ana': 9, 'bea': 40, 'eli': 300}, {'ana': 8, 'bea': 20, 'eli': 120}, tb)
    ok(r and r['eventos'] == 2 and [c['ev'] for c in r['campeones']] == ['K.O.M', 'LA DE MADRUGADA']
       and r['t'] == '2026-11-09T08:00:00Z' and r['campeones'][0]['quien'] == [['Bea', 'bea']],
       'la noche del 08/11 va de las 12 PM a las 3 AM del 09 (ET): la de la 1:30 AM entra, la del 09 a la noche no')
    ok([x['n'] for x in r['suman']] == ['Bea', 'Ana', 'Eli'] and r['suman'][1]['pts'] == 7000 and r['suman'][1]['ev'] == 2,
       'los que más sumaron esa noche, con cuántos eventos jugaron')
    ok([(x['n'], x['de'], x['a']) for x in r['suben']] == [('Eli', 300, 120), ('Bea', 40, 20)],
       'los que más subieron en el Ranking, de 5 puestos para arriba (Ana subió 1: no)')
    ok([(x['n'], x['que'], x.get('desde')) for x in r['sorpresas']] == [('Bea', 'primer', 40), ('Eli', 'debut', None)],
       'las sorpresas: el primer título de la temporada (Bea, desde el 40) y el campeón en su primer evento (Eli)')
    ok(resumen_noche(dt.date(2026, 11, 5), ll, ins, {}, {}, tb) is None, 'una noche sin eventos no tiene resumen')
    ok(noche_activa(dt.datetime(2026, 11, 9, 16, tzinfo=dt.timezone.utc)) == dt.date(2026, 11, 8)
       and noche_activa(dt.datetime(2026, 11, 9, 17, 30, tzinfo=dt.timezone.utc)) == dt.date(2026, 11, 9),
       'hasta las 12 PM ET se sigue armando la noche de ayer; desde ahí, la de hoy')
    g = {'noche_antes': {'dia': '2026-11-08', 'pos': {'ana': 9, 'bea': 40, 'eli': 300}}}
    f6 = {'llaves': ll, 'instantes': ins, 'pool': [{'raw': 'Ana', 'pos': 8}, {'raw': 'Bea', 'pos': 20}, {'raw': 'Eli', 'pos': 120}]}
    its, na, ng = noches(g, dt.datetime(2026, 11, 9, 16, tzinfo=dt.timezone.utc), f6, tb)
    its2, na2, ng2 = noches({'noche_antes': na, 'noches': ng}, dt.datetime(2026, 11, 9, 18, tzinfo=dt.timezone.utc), f6, tb)
    ok(len(its) == 1 and na['dia'] == '2026-11-08' and na2['dia'] == '2026-11-09' and na2['pos']['bea'] == 20
       and '2026-11-08' in ng2 and 'resnoche' not in DE_ALGUIEN and 'ks' not in its[0],
       'a las 12 PM se guarda cómo empieza la noche nueva y la de ayer queda; no lleva `ks`: no avisa a los seguidores')
    ok(id_de(dict(r, part=99)) == id_de(r), 'el resumen que se rehace sigue siendo la misma publicación')
    print('\n   %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal


def main():
    if '--auto' in sys.argv[1:]:
        return 1 if _self_check() else 0
    print(__doc__.split('\n\n')[0])
    return 0


if __name__ == '__main__':
    raise SystemExit(main() or 0)
