# -*- coding: utf-8 -*-
"""🌍 EL RANKING GLOBAL: TODOS LOS FREESTYLERS, DE LA LIGA A LOS GIGANTES, EN UNA SOLA TABLA.

    python bot/global_ranking.py              recalcula con lo guardado (datos/global_batallas.json) y muestra el top
    python bot/global_ranking.py --leer       lee las fuentes y recalcula: lo corre `global.yml` una vez por semana
    python bot/global_ranking.py --ver Mecha  por qué esa persona está donde está
    python bot/global_ranking.py --auto       self-check, sin red

Dlx, 20/11/2026: *«el sistema del ranking global, donde habrá todos y donde la gente se podrá comparar con gigantes y
descubrir así a otras personas del under»*; *«todo automatizado… que se actualice cada semana, no a diario»*.

🔑 LA FÓRMULA, CERRADA EL 20/11/2026 (*«sí, cerrémosla con esos dos ajustes»*). Los números son el punto de partida:
  · BATALLA = peso del evento × fuerza del rival × resultado × ronda (+ extras). *«vs QUIÉN cuenta más, y si GANA cuenta
    más que si yo le gano a CHISTEMC en Discord en octavos»*.
  · TÍTULO = 0,5 × lo que sumaste en ese camino + peso × 1,25 por batalla ganada en él. Finalista 40 %, semi 20 %. En FMS,
    el MVP de cada jornada cuenta como ganarla (*«jornada por jornada»*).
  · Cuentan tus 10 mejores batallas y tus 10 mejores títulos, sólo dentro de la temporada (`comun/temporada.py`):
    *«que se acople a lo que es la T1»*.
  · Lo que no se gana rapeando no cuenta: ni vistas ni seguidores (además, YouTube lo prohíbe para sus datos).

⚠️ LA FUERZA DEL RIVAL SALE DEL MISMO RANKING. Al arrancar nadie tiene puntos, así que empieza en una semilla según dónde
compite (`SEMILLA_TIPO`, el ELO de la Liga y `datos/global_semillas.json` para los gigantes conocidos) y después se mezcla
con sus puntos en tres vueltas. Sin semilla, la primera semana todos los rivales valdrían lo mismo.

⚠️ EN LA DUDA, DOS PERFILES. Unir a dos personas distintas mezcla dos historiales; separar de más sólo deja un perfil
partido, que se arregla con `datos/global_alias.json` o cuando la persona reclama su perfil. Por eso FMS y Freestylestats
se unen solos por nombre (los pros tienen nombres únicos), y la Liga con los de afuera, sólo a mano.

⚠️ UNA FUENTE QUE FALLA NO BORRA LO SUYO: si una no contesta, se quedan sus batallas de la semana anterior y se avisa.
"""
import datetime as dt
import importlib
import io
import json
import math
import os
import sys
import zoneinfo

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from comun import claves  # noqa: E402
from comun import temporada  # noqa: E402

ET = zoneinfo.ZoneInfo('America/New_York')
BATALLAS = os.path.join(BASE, 'datos', 'global_batallas.json')
ALIAS = os.path.join(BASE, 'datos', 'global_alias.json')
SEMILLAS = os.path.join(BASE, 'datos', 'global_semillas.json')
SALIDA = os.path.join(BASE, 'bot', 'paginas', 'global.json')
#: 🔗 lo poco que necesita la vista previa del link de una ficha (24/11/2026): `{clave: [nombre, país, grupo, puesto]}`.
#: El Worker de Pages (`vistaGlobal()` en bot/paginas/_worker.js) lo lee en cada vista previa, y `global.json` entero
#: (300 KB) le costaba 4 ms de CPU de los 10 que tiene: éste son ~40 KB
VISTA = os.path.join(BASE, 'bot', 'paginas', 'global_vista.json')
# 🎬 el índice chico de Reels (24/11/2026): la vista previa de cada link (`vistaReel` de _worker.js) y la fila del Inicio
REELS_VISTA = os.path.join(BASE, 'bot', 'paginas', 'reels_vista.json')
PROS = os.path.join(BASE, 'datos', 'global_pros.json')
#: 📜 la carrera de cada uno (bot/global_historia.py, de Freestylestats): sus podios y la foto de su perfil
HISTORIA = os.path.join(BASE, 'bot', 'paginas', 'global_historia.json')
FOTO_FS = 'https://assets.freestylestats.com/assets/'
#: 🏷️ los grupos a mano (25/11/2026): `{"suma": {clave: [grupo…]}, "saca": {clave: [grupo…]}}`. Ver `grupos_de()`
GRUPOS = os.path.join(BASE, 'datos', 'global_grupos.json')
SEMILLA_PRO = 7.5  # quien es pro arranca, como mínimo, como un MC de FMS

# Las fuentes, en orden de preferencia cuando dos traen la misma batalla.
FUENTES = (('fms', 'global_fuente_fms'), ('fstats', 'global_fuente_fstats'), ('youtube', 'global_fuente_youtube'),
           ('urbanstreet', 'global_fuente_urbanstreet'), ('liga', 'global_fuente_liga'))
AFUERA = {'fms', 'fstats', 'youtube', 'urbanstreet', 'pro'}  # las de fuera de la Liga: se unen solas por el nombre
# Las que fechan aproximado: YouTube por el día en que se SUBIÓ el video, UrbanStreet a veces por el día de la nota.
FECHA_APROX = {'youtube', 'urbanstreet'}

# Lo que pesa cada evento (Dlx, 20/11/2026).
# ⚠️ LA LIGA PASÓ DE 0,3 A 0,15 Y LOS TÍTULOS CUENTAN LOS 3 MEJORES (antes 10), el 21/11/2026, por la auditoría que
# pidió Dlx: *«asegúrate que la fórmula esté bien, luego no quiero quejas como "ese malísimo está encima de X"»*. Con
# 0,3 y 10 títulos, 36 de la Liga quedaban arriba de algún pro que en la T1 ya le ganó a alguien en FMS o en un
# nacional de Red Bull (Oasis #23, arriba de Gazir): diez títulos chicos de Discord sumaban más que dos victorias de
# FMS. Con 0,15 y 3, ninguno (medido sobre la corrida del 20/11, `herramientas/global_auditar.py`). Es su regla
# aplicada: *«nunca lo alcanzarías a menos que rapees o tengas resultados en eventos grandes»*. La Liga sigue arriba
# de lo más bajo («bajo pero no el más bajo»).
PESO = {'rb_internacional': 10, 'fms_internacional': 10, 'world_cup': 10,
        'fms_jornada': 5, 'rb_nacional': 5,
        'rb_regional': 2, 'plazas_final': 2, 'independiente': 2,
        'plaza': 0.75, 'liga': 0.15, 'liga_chica': 0.06, 'resto': 0.06}
PRO = {'rb_internacional', 'fms_internacional', 'world_cup', 'fms_jornada', 'rb_nacional'}
PLAZA = {'rb_regional', 'plazas_final', 'independiente', 'plaza'}

RONDA = {'final': 2.0, 'semifinal': 1.5, 'cuartos': 1.2, 'tercer': 1.2}  # el resto vale 1
GANA, GANA_REPLICA, PIERDE_REPLICA = 1.0, 0.67, 0.2
FUERA_DE_ESCENA = 0.10
TITULO_CAMINO, TITULO_POR_GANADA = 0.5, 1.25
FINALISTA, SEMIFINALISTA = 0.4, 0.2
MEJORES = 10
MEJORES_TITULOS = 3
VUELTAS = 3

# La fuerza con la que arranca cada uno según dónde compite (1 a 10). Se queda la más alta.
SEMILLA_TIPO = {'rb_internacional': 8, 'fms_internacional': 8, 'world_cup': 8, 'fms_jornada': 7.5,
                'rb_nacional': 5, 'rb_regional': 3.5, 'plazas_final': 3.5, 'independiente': 3.5, 'plaza': 3}
FINALISTA_NACIONAL = 6.5
SEMILLA_LIGA = (1.5, 4.5)  # del ELO más bajo al más alto de la Liga
SEMILLA_NADA = 2.0


def _leer(ruta, si_no=None):
    try:
        with io.open(ruta, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return si_no


def _escribir(ruta, datos, compacto=False):
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    tmp = ruta + '.tmp'
    with io.open(tmp, 'w', encoding='utf-8', newline='\n') as f:
        if compacto:
            json.dump(datos, f, ensure_ascii=False, separators=(',', ':'))
        else:
            json.dump(datos, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write('\n')
    os.replace(tmp, ruta)


def ahora_et():
    return dt.datetime.now(ET).replace(microsecond=0)


# ── 1. Leer ──────────────────────────────────────────────────────────────────────────────────────────────────────────
def leer_fuentes(red=True, previo=None, solo=None):
    """`(batallas, mvps, semillas_liga, estado, plantel)`. Una fuente que falla deja lo suyo de la semana anterior."""
    desde, hasta = temporada.FECHAS[temporada.ACTUAL]
    previo = previo or {}
    batallas, mvps, semillas, estado, plantel = [], [], {}, {}, []
    for nombre, modulo in FUENTES:
        if solo and nombre not in solo:
            continue
        av, ok = [], True
        try:
            r = importlib.import_module(modulo).leer(desde, hasta, red=red) or {}
        except Exception as e:  # noqa: BLE001 — cualquier error de una fuente se avisa y se sigue con las demás
            r, ok = {}, False
            av.append('no pude leerla (%s: %s)' % (type(e).__name__, str(e)[:160]))
        bs = list(r.get('batallas') or [])
        viejas = [b for b in previo.get('batallas') or [] if b.get('fuente') == nombre]
        if not bs and viejas:
            av.append('no trajo nada: quedan las %d batallas de la vez anterior' % len(viejas))
            bs, ok = viejas, False
            mvps.extend(m for m in previo.get('mvp') or [] if m.get('fuente') in (nombre, 'urbanroosters'))
        else:
            mvps.extend(r.get('mvp') or [])
        batallas.extend(bs)
        semillas.update(r.get('semillas') or {})
        # El plantel de las ligas pro (hoy sólo FMS): sin él, quien todavía no jugó en la T1 no aparece.
        pl = list(r.get('plantel') or [])
        if not pl:
            pl = [p for p in previo.get('plantel') or [] if str(p.get('id', '')).startswith(nombre + ':')]
        plantel.extend(pl)
        av.extend(r.get('avisos') or [])
        estado[nombre] = {'n': len(bs), 'ok': ok, 'av': av[:40]}
    return batallas, mvps, semillas, estado, plantel


# ── 2. Juntar lo repetido ────────────────────────────────────────────────────────────────────────────────────────────
def _lado(b, lado, de_id=None):
    """Quién es un lado: la persona si ya se sabe (`de_id`), si no la clave del nombre escrito."""
    return (de_id or {}).get(b[lado]['id']) or claves.clave(b[lado]['nombre'])


def _par(b, de_id=None):
    return frozenset((_lado(b, 'a', de_id), _lado(b, 'b', de_id)))


def _familia(tipo):
    t = str(tipo or '')
    if t.startswith('rb_') or t == 'plazas_final':
        return 'rb'
    if t.startswith('fms_') or t == 'world_cup':
        return 'fms'
    if t.startswith('liga'):
        return 'liga'
    return 'calle'  # plaza, independiente, resto: lo que no es ni Red Bull, ni FMS, ni la Liga


def _par_igual_orden(x, y, de_id=None):
    """Si las dos fuentes escriben la batalla con los mismos lados (A de una es A de la otra). Si no, el `gana`
    de una es el contrario en la otra."""
    return _lado(x, 'a', de_id) == _lado(y, 'a', de_id)


def _dia(s):
    try:
        return dt.date.fromisoformat(str(s)[:10])
    except ValueError:
        return None


#: 🎬 el video de cada batalla (24/11/2026, Dlx: «subir como cuadrados de videos tanto horizontales y verticales al perfil de
#: sus batallas… aquí sí lo podemos hacer»): el id de YouTube de su dirección (`watch?v=`, `youtu.be/` o `/shorts/`, que es
#: vertical). Sólo el id: la política de YouTube no deja guardar más que eso de sus videos (ver el research del 20/11)
import re as _re
_YT = _re.compile(r'(?:youtube\.com/(?:watch\?(?:.*&)?v=|shorts/|embed/)|youtu\.be/)([A-Za-z0-9_-]{11})')
#: cuántos videos por persona viajan en `global.json` (los más nuevos)
VIDEOS_MAX = 24


def video_de(b):
    """`(id, vertical)` del video de YouTube de una batalla, o None"""
    u = str(b.get('url') or '')
    m = _YT.search(u)
    return (m.group(1), '/shorts/' in u) if m else None


def deduplicar(batallas, de_id=None):
    """La misma batalla en dos fuentes es UNA, con las dos como prueba. Se queda la de la fuente preferida.

    Mismo par de raperos, misma ronda y a un día o menos: una jornada de FMS que también lista Freestylestats no
    puede contar dos veces.

    `de_id`: la segunda pasada, ya sabiendo quién es quién. ⚠️ YouTube escribe «AIRON PUNCHLINE» y Freestylestats
    «Airon»: por el nombre son dos pares distintos, así que Airon contaba dos veces su octavos contra Hunter en Red
    Bull Colombia (21/11/2026). Por persona es el mismo par.
    """
    orden = {n: i for i, (n, _) in enumerate(FUENTES)}
    por_par, ids = {}, set()
    for b in sorted(batallas, key=lambda x: orden.get(x.get('fuente'), 9)):
        if b.get('id') in ids:  # la misma fila dos veces de la misma fuente (una página leída dos veces)
            continue
        ids.add(b.get('id'))
        b = dict(b)
        b['fuentes'] = sorted(set(b.get('fuentes') or [b.get('fuente')]))
        d = _dia(b['evento'].get('fecha'))
        clave = _par(b, de_id)
        igual = None
        for otra in por_par.get(clave, []):
            d2 = _dia(otra['evento'].get('fecha'))
            if otra['fuente'] == b['fuente'] or not (d and d2):
                continue
            # Una ronda que una fuente no sabe (None) no separa: es la misma batalla si lo demás coincide.
            if otra.get('ronda') and b.get('ronda') and otra['ronda'] != b['ronda']:
                continue
            # Con una fuente de fecha aproximada se pide además la misma familia de evento, y hasta 30 días. Familia y
            # no tipo: UrbanStreet marca «independiente» lo que no reconoce, y para YouTube ese mismo evento es «plaza».
            aprox = bool(FECHA_APROX & {otra['fuente'], b['fuente']})
            if abs((d - d2).days) <= (30 if aprox else 1) and (
                    not aprox or _familia(otra['evento'].get('tipo')) == _familia(b['evento'].get('tipo'))):
                igual = otra
                break
        if igual:
            igual['fuentes'] = sorted(set(igual['fuentes']) | set(b['fuentes']))
            # 🎬 la batalla de FMS se queda con su video de YouTube si otra fuente lo trae
            if not video_de(igual) and video_de(b):
                igual['url_video'] = b.get('url')
            for campo in ('votos', 'replica', 'pts', 'gana', 'ronda'):
                if igual.get(campo) is None and b.get(campo) is not None:
                    igual[campo] = b[campo] if campo != 'gana' or _par_igual_orden(igual, b, de_id) else (
                        'b' if b['gana'] == 'a' else 'a')
            continue
        por_par.setdefault(clave, []).append(b)
    return [b for lista in por_par.values() for b in lista]


# ── 3. Quién es quién ────────────────────────────────────────────────────────────────────────────────────────────────
LIGAS_FMS = {'spain': 'España', 'mexico': 'México', 'peru': 'Perú', 'argentina': 'Argentina', 'chile': 'Chile',
             'colombia': 'Colombia', 'caribe': 'Caribe'}


def pros_de(plantel, a_mano):
    """Quién es PRO: el plantel de las ligas FMS que lista fms.tv y los grupos de `datos/global_pros.json` (las
    internacionales y los campeones nacionales de Red Bull). `[{id, nombre, pais, por}]`, uno por nombre.

    ⚠️ Dlx, 21/11/2026: «KG es profesional, está en la liga de FMS Perú… asegúrate a quién metes en cada tag». Antes el
    grupo salía de los eventos de la ventana, y KG —que en la T1 sólo jugó plazas y Supremacía— salía de plaza.
    """
    out, por_clave = [], {}
    for p in plantel or []:
        ligas = [l for l in p.get('ligas') or [] if l not in ('internacional', 'fswc')]
        if not ligas:  # «MÉXICO» del Freestyle World Cup es una selección, no una persona
            continue
        por = 'FMS ' + ', '.join(LIGAS_FMS.get(l, l.capitalize()) for l in ligas)
        x = {'id': p['id'], 'nombre': p['nombre'], 'pais': p.get('pais'), 'por': [por], 'foto': p.get('foto') or ''}
        out.append(x)
        por_clave.setdefault(claves.clave(p['nombre']), x)
    for g in (a_mano or {}).get('grupos') or []:
        for nombre, cc in g.get('gente') or []:
            k = claves.clave(nombre)
            if k in por_clave:
                if g['por'] not in por_clave[k]['por']:
                    por_clave[k]['por'].append(g['por'])
                continue
            x = {'id': 'pro:' + k, 'nombre': nombre, 'pais': cc, 'por': [g['por']]}
            out.append(x)
            por_clave[k] = x
    return out


def identidades(batallas, mvps, alias=None, extra=None):
    """`(de_id, personas)`: de cada id de fuente a la clave global, y los datos de cada persona.

    `extra`: gente que entra aunque no tenga batallas en la ventana (los pros de `pros_de()`): «habrá todos».
    """
    alias = alias or {}
    une = dict((alias.get('une') or {}))  # {id de fuente: id de fuente al que se une}
    separa = {frozenset(x) for x in alias.get('separa') or [] if len(x) == 2}
    ids = {}
    for p in extra or []:
        ids.setdefault(p['id'], {'nombre': p['nombre'], 'pais': p.get('pais'),
                                 'fuente': p['id'].split(':', 1)[0], 'otros': set(), 'foto': p.get('foto') or ''})
    for b in batallas:
        for lado in ('a', 'b'):
            p = b[lado]
            ids.setdefault(p['id'], {'nombre': p['nombre'], 'pais': p.get('pais'), 'fuente': b['fuente'],
                                     'otros': set(), 'foto': ''})
            if p.get('pais') and not ids[p['id']]['pais']:
                ids[p['id']]['pais'] = p['pais']
            if p.get('foto') and not ids[p['id']].get('foto'):
                ids[p['id']]['foto'] = p['foto']
            ids[p['id']]['otros'].add(b[('b' if lado == 'a' else 'a')]['id'])
    for m in mvps:
        q = m.get('quien') or {}
        if q.get('id'):
            ids.setdefault(q['id'], {'nombre': q.get('nombre'), 'pais': q.get('pais'), 'fuente': 'fms', 'otros': set()})

    def raiz(i, vistos=()):
        j = une.get(i)
        return raiz(j, vistos + (i,)) if j and j not in vistos and j in ids else i

    grupo = {}
    pros = {}
    for i, x in ids.items():
        r = raiz(i)
        if r != i:
            grupo[i] = r
            continue
        if x['fuente'] in AFUERA:
            # El nombre y, si la fuente tiene uno, su «usuario»: Freestylestats escribe «1Tobi» con el usuario `tobi`,
            # que es como lo llama fms.tv («TOBI»). Con el nombre solo serían dos perfiles.
            ks = {claves.clave(x['nombre'])}
            suf = i.split(':', 1)[-1]
            if suf and not suf.isdigit() and ':' not in suf:
                ks.add(claves.clave(suf))
            ks.discard('')
            candidatos = [o for kk in ks for o in pros.get(kk, [])]
            for otro in candidatos:
                xo = ids[otro]
                if xo['fuente'] == x['fuente'] or frozenset((i, otro)) in separa:
                    continue
                if x['pais'] and xo['pais'] and x['pais'] != xo['pais']:
                    continue
                if i in xo['otros']:  # se enfrentaron: son dos
                    continue
                grupo[i] = otro
                break
            else:
                for kk in ks:
                    pros.setdefault(kk, []).append(i)
                grupo[i] = i
        else:
            grupo[i] = i
    de_id, personas, usadas = {}, {}, {}
    for i in ids:
        r = grupo.get(i, i)
        while grupo.get(r, r) != r:
            r = grupo[r]
        if r not in personas:
            x = ids[r]
            base = ('l-' if x['fuente'] == 'liga' else '') + (claves.clave(x['nombre']) or 'x')
            k = base
            if k in usadas:
                k = '%s-%s' % (base, x['pais'] or len(usadas))
            usadas[k] = r
            personas[r] = {'k': k, 'n': x['nombre'], 'cc': x['pais'], 'ids': [],
                           'lg': claves.clave(x['nombre']) if x['fuente'] == 'liga' else None, 'fo': ''}
        personas[r]['ids'].append(i)
        # 📸 la foto: la oficial de fms.tv gana a la de Freestylestats (global_fotos.py la baja, la recorta y la sube)
        f = ids[i].get('foto') or ''
        if f and (not personas[r]['fo'] or (ids[i]['fuente'] in ('fms', 'pro') and 'fms.tv' in f
                                            and 'fms.tv' not in personas[r]['fo'])):
            personas[r]['fo'] = f
        # El nombre más prolijo: «Mecha» y no «MECHA» (fms.tv escribe todo en mayúsculas).
        if personas[r]['n'].isupper() and ids[i]['nombre'] and not ids[i]['nombre'].isupper():
            personas[r]['n'] = ids[i]['nombre']
        if not personas[r]['cc'] and ids[i]['pais']:
            personas[r]['cc'] = ids[i]['pais']
        if ids[i]['fuente'] == 'liga':
            personas[r]['lg'] = claves.clave(ids[i]['nombre'])
        de_id[i] = personas[r]['k']
    return de_id, {p['k']: p for p in personas.values()}


# ── 3b. Los grupos de cada uno: puede ser más de uno ─────────────────────────────────────────────────────────────────
ORDEN_GRUPOS = ('pro', 'plaza', 'liga')
#: lo que cuenta como «jugó plazas»: la plaza y el Torneo de Plazas de Red Bull. ⚠️ NO `PLAZA` entero: ahí están también
#: las internacionales independientes (Combate Mortal, Verso Final, Supremacía) y los regionales de Red Bull, que pesan
#: como una plaza grande pero no son una plaza. Con `PLAZA`, Mecha salía «Pro · Plaza» por Combate Mortal
JUGO_PLAZA = {'plaza', 'plazas_final'}


def pro_por_carrera(h):
    """🏆 ¿ES PRO POR LO QUE HIZO, NO SÓLO POR ESTA TEMPORADA? (25/11/2026, Dlx: *«que los tags q tenga uno no se defina en
    la temporada actual sino en su histórica, por ejemplo RODAMIENTO es pro no es plazas, mira su historial»*). Rodamiento
    fue 3.º de FMS Chile 2024/25 y 2.º de la final nacional de Red Bull Chile 2020, y en la T1 sólo jugó plazas.

    De sus podios (`t` de global_historia.json: [puesto, competencia, temporada, jornada]), los que hacen pro:
      · un podio en una liga FMS (no FMS Under, que es la de ascenso), la FMS Internacional o la FMS World Series
      · un podio en la FINAL NACIONAL de Red Bull, o en la Red Bull Internacional
      · un podio en God Level
    ⚠️ Sólo cambia el grupo que se muestra: la fuerza con la que arranca sigue saliendo de la escena de la T1.
    Devuelve las razones («3.º en FMS Chile 2024/2025»), en el orden de la historia (el mejor puesto primero); [] si no."""
    out = []
    for t in (h or {}).get('t') or []:
        if not isinstance(t, list) or len(t) < 3 or t[0] not in (1, 2, 3):
            continue
        puesto, comp, temp = t[0], str(t[1] or ''), str(t[2] or '')
        jor = str(t[3] or '') if len(t) > 3 else ''
        fms = comp.startswith('FMS ') and not comp.startswith('FMS Under')
        rb = comp.startswith('Red Bull Batalla') and ('Internacional' in comp or jor.lower().startswith('final nacional'))
        gl = comp.startswith('God Level')
        if not (fms or rb or gl):
            continue
        que = comp + (' ' + temp if temp else '') + (' (final nacional)' if rb and 'Internacional' not in comp else '')
        out.append('Campeón de ' + que if puesto == 1 else '%d.º en %s' % (puesto, que))
    return out


def grupos_de(k, p, escena, tipos, a_mano=None, pro_hist=False):
    """🏷️ LOS GRUPOS DE ALGUIEN, TODOS LOS QUE TIENE (25/11/2026). Dlx: *«asegurate q uno pueda tener los 3 tags al mismo
    tiempo o 2 tmb, x ejemplo oasis va a plazas, es plazas y liga»*.

    `escena` (pro, plaza o liga) sigue siendo UNA: es la que decide con qué fuerza arranca y el castigo de jugar fuera
    de tu escena (`FUERA_DE_ESCENA`), y eso no cambia. Esto es lo que se MUESTRA y por lo que se filtra:
      · pro: si su escena es pro o es pro por su carrera (`pro_por_carrera()`, `pro_hist`)
      · plaza («Under» en la página): si NO es pro y su escena es plaza o jugó una plaza (`JUGO_PLAZA`). Un pro que juega
        plazas sigue siendo sólo pro (Dlx, 25/11/2026: *«RODAMIENTO es pro no es plazas»*)
      · liga: si es alguien de la Liga (`lg`): un pro o uno de plaza unidos a su perfil de la Liga (global_alias.json)
      · y lo de `datos/global_grupos.json` a mano (`suma` / `saca`): Oasis juega plazas, pero sus plazas no están en
        ninguna fuente que leamos
    `tipos`: los tipos de evento de sus batallas."""
    gs = set()
    # pro por esta temporada o por su carrera (`pro_por_carrera()`), y un pro NO es también under: «es pro, no es plazas»
    if escena == 'pro' or pro_hist:
        gs.add('pro')
    elif escena == 'plaza' or (set(tipos or ()) & JUGO_PLAZA):
        gs.add('plaza')
    if p.get('lg') or escena == 'liga':
        gs.add('liga')
    a_mano = a_mano or {}
    gs |= {x for x in (a_mano.get('suma') or {}).get(k, []) if x in ORDEN_GRUPOS}
    gs -= set((a_mano.get('saca') or {}).get(k, []))
    if not gs:
        gs.add(escena)
    return [x for x in ORDEN_GRUPOS if x in gs]


# ── 4. La fuerza con la que arranca cada uno ─────────────────────────────────────────────────────────────────────────
def semillas_iniciales(batallas, de_id, personas, elo_liga=None, a_mano=None, pro_keys=None):
    """`(s0, escena)`. La escena NO sale de dónde jugó en la ventana sino de quién es: pro si está en `pros_de()`,
    plaza si es de afuera de la Liga, Liga si es de la Liga. Jugar una final nacional de Red Bull no te hace pro."""
    s0, escena = {}, {}
    pro_keys = set(pro_keys or ())
    for k, p in personas.items():
        escena[k] = 'pro' if k in pro_keys else 'liga' if p.get('lg') and all(
            i.startswith('liga:') for i in p['ids']) else 'plaza'
        if k in pro_keys:
            s0[k] = SEMILLA_PRO
    for b in batallas:
        t = b['evento'].get('tipo')
        for lado in ('a', 'b'):
            k = de_id[b[lado]['id']]
            v = SEMILLA_TIPO.get(t)
            if t == 'rb_nacional' and b.get('ronda') == 'final':
                v = FINALISTA_NACIONAL
            if v:
                s0[k] = max(s0.get(k, 0), v)
    elo = {de_id[i]: e for i, e in (elo_liga or {}).items() if i in de_id and e is not None}
    if elo:
        orden = sorted(elo.values())
        lo, hi = SEMILLA_LIGA
        for k, e in elo.items():
            pct = sum(1 for x in orden if x <= e) / float(len(orden))
            s0[k] = max(s0.get(k, 0), lo + (hi - lo) * pct)
    for nombre, v in ((a_mano or {}).get('fuerza') or {}).items():
        for p in personas.values():
            if claves.clave(p['n']) == claves.clave(nombre) and not p.get('lg'):
                s0[p['k']] = max(s0.get(p['k'], 0), float(v))
    for k in personas:
        s0.setdefault(k, SEMILLA_NADA if escena.get(k) != 'liga' else SEMILLA_LIGA[0])
    return s0, escena


# ── 5. El cálculo ────────────────────────────────────────────────────────────────────────────────────────────────────
def _resultado(b, lado, fuerza_yo, fuerza_rival):
    if b.get('gana') == lado:
        return 'GR' if b.get('replica') else 'G', (GANA_REPLICA if b.get('replica') else GANA)
    if b.get('gana') and b.get('replica') and fuerza_rival > fuerza_yo:
        return 'PR', PIERDE_REPLICA
    return 'P', 0.0


def _margen(b, lado):
    v = b.get('votos')
    if not v or len(v) != 2 or b.get('gana') != lado:
        return 0.0
    yo, el = (v[0], v[1]) if lado == 'a' else (v[1], v[0])
    if (yo or 0) + (el or 0) <= 0:
        return 0.0
    r = (yo - el) / float(yo + el)
    return 0.10 if r >= 0.99 else 0.05 if r >= 0.5 else 0.0


def puntos(batallas, mvps, de_id, personas, s0, escena):
    """`{clave: {...}}` con el total, las batallas que cuentan y los títulos, y la fuerza final."""
    fuerza = dict(s0)
    for _ in range(VUELTAS):
        out = _una_vuelta(batallas, mvps, de_id, personas, fuerza, escena)
        tope = max([x['p'] for x in out.values()] + [1e-9])
        fuerza = {k: 0.5 * s0.get(k, SEMILLA_NADA) + 0.5 * (1 + 9 * math.sqrt(max(out[k]['p'], 0) / tope))
                  for k in personas}
    out = _una_vuelta(batallas, mvps, de_id, personas, fuerza, escena)
    for k in out:
        out[k]['f'] = round(fuerza.get(k, SEMILLA_NADA), 2)
    return out


def _una_vuelta(batallas, mvps, de_id, personas, fuerza, escena):
    por = {k: {'bat': [], 'tit': [], 'camino': {}} for k in personas}
    finales = {}
    for b in batallas:
        ev = b['evento']
        w = PESO.get(ev.get('tipo'), PESO['resto'])
        r = RONDA.get(b.get('ronda'), 1.0)
        ka, kb = de_id[b['a']['id']], de_id[b['b']['id']]
        for lado, yo, el in (('a', ka, kb), ('b', kb, ka)):
            cod, res = _resultado(b, lado, fuerza.get(yo, SEMILLA_NADA), fuerza.get(el, SEMILLA_NADA))
            extra = _margen(b, lado)
            if res > 0:
                otro_cc, mi_cc = personas[el].get('cc'), personas[yo].get('cc')
                if escena.get(el) != escena.get(yo) or (otro_cc and mi_cc and otro_cc != mi_cc):
                    extra += FUERA_DE_ESCENA
            p = w * fuerza.get(el, SEMILLA_NADA) * res * r * (1 + extra)
            por[yo]['bat'].append((p, ev['id'], b.get('ronda'), el, cod, len(b.get('fuentes') or [1])))
            c = por[yo]['camino'].setdefault(ev['id'], [0.0, 0])
            c[0] += p
            c[1] += 1 if cod in ('G', 'GR') else 0
        if b.get('ronda') in ('final', 'semifinal') and b.get('gana') in ('a', 'b') and ev.get('tipo') != 'fms_jornada':
            gana, pierde = (ka, kb) if b['gana'] == 'a' else (kb, ka)
            # ⚠️ Un evento puede traer MÁS DE UNA FINAL: YouTube junta dos ediciones subidas la misma semana
            # («LA VILLURCA FREESTYLE · 1v1», 21/11/2026). Con un solo campeón por evento, el segundo le pisaba el
            # título al primero; ahora cada final da el suyo.
            f = finales.setdefault(ev['id'], {'w': w, 'finales': [], 'semi': []})
            if b['ronda'] == 'final':
                f['finales'].append((gana, pierde))
            else:
                f['semi'].append(pierde)

    def titulo(k, ev_id, w):
        run, ganadas = por[k]['camino'].get(ev_id, [0.0, 0])
        return TITULO_CAMINO * run + w * TITULO_POR_GANADA * ganadas

    for ev_id, f in finales.items():
        for campeon, finalista in f['finales']:
            por[campeon]['tit'].append((titulo(campeon, ev_id, f['w']), ev_id, 1))
            por[finalista]['tit'].append((FINALISTA * titulo(finalista, ev_id, f['w']), ev_id, 2))
        for k in f['semi']:
            por[k]['tit'].append((SEMIFINALISTA * titulo(k, ev_id, f['w']), ev_id, 3))
    for m in mvps:
        q = (m.get('quien') or {}).get('id')
        k = de_id.get(q)
        ev = m.get('evento') or {}
        if k and ev.get('id'):
            por[k]['tit'].append((titulo(k, ev['id'], PESO.get(ev.get('tipo'), PESO['fms_jornada'])), ev['id'], 'MVP'))

    out = {}
    for k, x in por.items():
        bat = sorted(x['bat'], key=lambda t: -t[0])
        tit = sorted(x['tit'], key=lambda t: -t[0])
        pb = sum(t[0] for t in bat[:MEJORES])
        pt = sum(t[0] for t in tit[:MEJORES_TITULOS])
        out[k] = {'p': pb + pt, 'pb': pb, 'pt': pt, 'nb': min(len(bat), MEJORES), 'jb': len(bat),
                  'bat': bat[:MEJORES], 'tit': tit[:MEJORES_TITULOS]}
    return out


# ── 6. Armar la salida ───────────────────────────────────────────────────────────────────────────────────────────────
def armar(batallas, mvps, semillas_liga, estado, alias=None, a_mano=None, cuando=None, pros=None, subir_fotos=False,
          grupos=None, historia=None):
    batallas = deduplicar(batallas)
    de_id, personas = identidades(batallas, mvps, alias, extra=pros)
    batallas = deduplicar(batallas, de_id)  # otra vez, por persona: dos fuentes que escriben distinto el nombre
    por_pro = {}
    for p in pros or []:
        k = de_id.get(p['id'])
        if k:
            por_pro.setdefault(k, [])
            por_pro[k] += [x for x in p['por'] if x not in por_pro[k]]
    # Quien juega una jornada de FMS en la temporada está en una liga FMS: es pro, lo liste fms.tv o no. ⚠️ 21/11/2026:
    # Metalingüística, Animus y Lema jugaban FMS Chile y FMS Colombia 2026/27 y salían de plaza, porque el plantel de
    # fms.tv todavía no los traía.
    for b in batallas:
        if b['evento'].get('tipo') == 'fms_jornada':
            liga = (b['evento'].get('nombre') or 'FMS').split(' · ')[0]
            for lado in ('a', 'b'):
                k = de_id[b[lado]['id']]
                por_pro.setdefault(k, [])
                if not por_pro[k]:
                    por_pro[k].append(liga)
    s0, escena = semillas_iniciales(batallas, de_id, personas, semillas_liga, a_mano, pro_keys=por_pro)
    calc = puntos(batallas, mvps, de_id, personas, s0, escena)
    eventos, ev_i = [], {}
    for b in sorted(batallas, key=lambda x: (x['evento'].get('fecha') or '', x['evento']['id'])):
        e = b['evento']
        if e['id'] not in ev_i:
            ev_i[e['id']] = len(eventos)
            eventos.append([e['id'], e.get('nombre'), e.get('tipo'), e.get('fecha'), e.get('pais')])
    # 🎬 los videos de cada uno: `[id, evento, rival, ganó (1/0), vertical (1/0)]`, del más nuevo al más viejo
    videos = {}
    for b in sorted(batallas, key=lambda x: x['evento'].get('fecha') or '', reverse=True):
        vv = video_de(b) or video_de({'url': b.get('url_video')})
        if not vv:
            continue
        ka, kb = de_id.get(b['a']['id']), de_id.get(b['b']['id'])
        for yo, el, lado in ((ka, kb, 'a'), (kb, ka, 'b')):
            if yo and el:
                xs = videos.setdefault(yo, [])
                if not any(x[0] == vv[0] for x in xs):
                    xs.append([vv[0], ev_i[b['evento']['id']], el, 1 if b.get('gana') == lado else 0, 1 if vv[1] else 0])
    # 🏷️ los tipos de evento de cada uno, para sus grupos (`grupos_de()`)
    tipos = {}
    for b in batallas:
        for lado in ('a', 'b'):
            tipos.setdefault(de_id[b[lado]['id']], set()).add(b['evento'].get('tipo'))
    gente, fotos_de = [], {}
    H = (historia or {}).get('p') or {}
    for k, c in calc.items():
        p = personas[k]
        if p.get('fo') and not p.get('lg'):
            fotos_de[k] = p['fo']
        elif not p.get('lg') and (H.get(k) or {}).get('fo'):
            # 📸 sin foto de sus batallas, la de su perfil de Freestylestats (Bnet, Nekroos, Almendrades: pros sin T1)
            fotos_de[k] = FOTO_FS + H[k]['fo']
        gente.append({'k': k, 'n': p['n'], 'cc': p.get('cc'), 'esc': escena.get(k, 'liga'), 'lg': p.get('lg'),
                      'p': round(c['p'], 1), 'pb': round(c['pb'], 1), 'pt': round(c['pt'], 1),
                      'nb': c['nb'], 'jb': c['jb'], 'f': c['f'],
                      'b': [[ev_i[e], r, el, cod, round(pts, 1), nf] for pts, e, r, el, cod, nf in c['bat'] if pts > 0],
                      't': [[ev_i[e], puesto, round(pts, 1)] for pts, e, puesto in c['tit'] if pts > 0]})
        # `gs` sólo si dice más que `esc` (la página lee `g.gs || [g.esc]`): son 1.261 filas en un archivo que se baja entero
        ph = pro_por_carrera(H.get(k)) if gente[-1]['esc'] != 'pro' else []
        gs = grupos_de(k, p, gente[-1]['esc'], tipos.get(k), grupos, pro_hist=bool(ph))
        if gs != [gente[-1]['esc']]:
            gente[-1]['gs'] = gs
        if por_pro.get(k):
            gente[-1]['por'] = por_pro[k][:3]
        elif ph:
            gente[-1]['por'] = ph[:3]  # por qué es pro, si lo es por su carrera: «3.º en FMS Chile 2024/2025»  # por qué es pro: «FMS Chile», «FMS Internacional 2026»…
        if videos.get(k):
            gente[-1]['v'] = videos[k][:VIDEOS_MAX]
    gente.sort(key=lambda g: (-g['p'], -g['jb'], g['n'].lower()))
    # 📱 los shorts de los canales (24/11/2026, Dlx: «suma una fuente de shorts para los verticales»): no suman puntos, van
    # a la pestaña «Videos» de quien nombran (`atar()` de bot/global_fuente_shorts.py). `vs`: [id, canal, [otros]], y el
    # canal es su lugar en `cs`
    cs = []
    try:
        import global_fuente_shorts as GS
        canales = {c['slug']: c['nombre'] for c in (json.load(io.open(os.path.join(BASE, 'datos', 'global_canales.json'),
                                                                        encoding='utf-8')).get('canales') or [])}
        ci = {}
        for k, xs in GS.atar(GS.guardados(), gente).items():
            g = next((x for x in gente if x['k'] == k), None)
            if not g:
                continue
            for vid, canal, otros, *tit in xs:
                if canal not in ci:
                    ci[canal] = len(cs)
                    cs.append(canales.get(canal, canal))
                g.setdefault('vs', []).append([vid, ci[canal], otros] + (tit[:1] if tit and tit[0] else []))
    except Exception as e:                               # noqa: BLE001 — sin shorts, el ranking sale igual
        print('⚠️ los shorts no se ataron: %s' % str(e)[:100])
    d0, d1 = temporada.FECHAS[temporada.ACTUAL]
    out = {'v': 1, 't': (cuando or ahora_et()).isoformat(), 'temporada': temporada.ACTUAL, 'ventana': [d0, d1],
           'formula': {'peso': PESO, 'ronda': RONDA, 'mejores': MEJORES, 'mejores_titulos': MEJORES_TITULOS}, 'fu': estado, 'ev': eventos, 'g': gente,
           'cs': cs}
    # 📸 las fotos, con lo que ya está subido (datos/global_fotos.json). Bajar y subir las nuevas es de `correr()`
    import global_fotos
    global_fotos.aplicar(out, fotos_de, subir=subir_fotos)
    return out


def correr(red=False, escribir=True):
    previo = _leer(BATALLAS, {}) or {}
    if red:
        try:
            import global_fuente_shorts as GS
            sh, av = GS.actualizar(aplicar=escribir)
            print('📱 shorts: %d guardados%s' % (len(sh), (' · ' + '; '.join(av[:3])) if av else ''))
        except Exception as e:                           # noqa: BLE001 — sin shorts nuevos quedan los guardados
            print('⚠️ los shorts no se leyeron: %s' % str(e)[:100])
        # 🎞️ los videos horizontales cortos (25/11/2026, Dlx: «videos horizontales… que no duren bastante», hasta 5 min): la
        # columna izquierda de Reels en la compu. Tampoco suman puntos
        try:
            import global_fuente_clips as GC
            cl, av = GC.actualizar(aplicar=escribir)
            print('🎞️ clips: %d guardados%s' % (len(cl), (' · ' + '; '.join(av[:3])) if av else ''))
        except Exception as e:                           # noqa: BLE001 — sin clips nuevos quedan los guardados
            print('⚠️ los clips no se leyeron: %s' % str(e)[:100])
    if red:
        batallas, mvps, semillas, estado, plantel = leer_fuentes(True, previo)
        if escribir:
            _escribir(BATALLAS, {'batallas': batallas, 'mvp': mvps, 'semillas': semillas, 'fu': estado,
                                 'plantel': plantel, 't': ahora_et().isoformat()})
    else:
        batallas, mvps = previo.get('batallas') or [], previo.get('mvp') or []
        semillas, estado = previo.get('semillas') or {}, previo.get('fu') or {}
        plantel = previo.get('plantel') or []
        if not batallas:
            # Sin nada guardado, sólo la Liga, que sale de los archivos del ciclo. Las de afuera sin red leen sus
            # casos de prueba: una foto vieja que no puede llegar al ranking de verdad.
            batallas, mvps, semillas, estado, plantel = leer_fuentes(False, previo, solo={'liga'})
    out = armar(batallas, mvps, semillas, estado, _leer(ALIAS, {}), _leer(SEMILLAS, {}),
                pros=pros_de(plantel, _leer(PROS, {})), subir_fotos=red and escribir, grupos=_leer(GRUPOS, {}),
                historia=_leer(HISTORIA, {}))
    flechas(out, _leer(SALIDA, {}))
    if escribir:
        _escribir(SALIDA, out, compacto=True)
        _escribir(VISTA, vista_de(out), compacto=True)
        _escribir(REELS_VISTA, reels_vista(out), compacto=True)
        try:
            import global_fuente_clips as GC
            canales = {c['slug']: c['nombre'] for c in GC.canales_todos()}   # 🤝 con los de los socios
            GC.escribir_web(GC.para_la_web(GC.guardados(), out.get('g') or [], canales))
        except Exception as e:                           # noqa: BLE001 — sin clips, Reels sale igual
            print('⚠️ los clips no se ataron: %s' % str(e)[:100])
    return out


def vista_de(out):
    """`{clave: [nombre, país, grupo, puesto]}` de la tabla, para la vista previa de cada ficha. El puesto es el de la
    página (`preparar()` de web/src/global.jsx): su lugar en la tabla si tiene puntos, y 0 si todavía no."""
    v = {}
    for i, g in enumerate((out or {}).get('g') or []):
        if isinstance(g, dict) and g.get('k') and g.get('n'):
            v[g['k']] = [g['n'], g.get('cc') or '', g.get('esc') or '', i + 1 if (g.get('p') or 0) > 0 else 0]
    return v


def reels_vista(out, n_inicio=12):
    """`{o: [ids], r: {id: [título, canal, «Nombre vs Nombre»]}}`: cada short una vez, con todos los que nombra, en el
    orden del feed de web/src/reels.jsx (`armar()`): por RONDAS —uno de cada persona en el orden de la tabla, después el
    segundo de cada una—. `o` son los primeros `n_inicio`, para la fila «Reels de la semana» del Inicio; `r` los tiene
    a todos, para la vista previa de cualquier link"""
    out = out or {}
    cs = out.get('cs') or []
    G = [g for g in (out.get('g') or []) if isinstance(g, dict) and g.get('k')]
    nom = {g['k']: g.get('n') or g['k'] for g in G}
    vistos, filas = {}, []
    for g in G:
        for s in g.get('vs') or []:
            vid = s[0]
            if vid not in vistos:
                ks = [g['k']] + [k for k in (s[2] if len(s) > 2 else []) if k in nom and k != g['k']]
                vistos[vid] = len(filas)
                filas.append({'vid': vid, 'ks': ks, 'canal': cs[s[1]] if isinstance(s[1], int) and s[1] < len(cs) else '',
                              't': s[3] if len(s) > 3 else ''})
    ronda = {}
    for f in filas:
        k = f['ks'][0]
        f['ronda'] = ronda.get(k, 0)
        ronda[k] = f['ronda'] + 1
    orden = sorted(range(len(filas)), key=lambda i: (filas[i]['ronda'], i))
    # nunca dos seguidos del mismo canal ni de la misma persona, como el feed
    o, resto = [], [filas[i] for i in orden]
    while resto and len(o) < n_inicio:
        ant = o[-1] if o else None
        j = next((j for j, f in enumerate(resto) if not ant or (f['canal'] != ant['canal'] and not set(f['ks']) & set(ant['ks']))), 0)
        o.append(resto.pop(j))
    return {'o': [f['vid'] for f in o],
            'r': {f['vid']: [f['t'], f['canal'], ' vs '.join(nom[k] for k in f['ks'][:3])] for f in filas}}


def _lunes(iso):
    d = _dia(iso)
    return d - dt.timedelta(days=d.weekday()) if d else None


def flechas(out, viejo):
    """Cuántos puestos subió o bajó cada uno desde la tabla de la SEMANA ANTERIOR (`mv`: + sube, − baja, 'n' nuevo).

    La tabla se recalcula también entre semana (un cambio de código, una fuente nueva): esas corridas no son «la semana
    anterior», así que se compara siempre contra la última tabla de una semana distinta, que viaja en `antes`
    ({clave: puesto}) y `antes_t`. Sin semana anterior no hay flechas: la página dice cuándo arrancan.
    """
    viejo = viejo or {}
    if viejo.get('g') and _lunes(viejo.get('t')) and _lunes(out['t']) and _lunes(viejo['t']) < _lunes(out['t']):
        antes = {g['k']: i + 1 for i, g in enumerate(viejo['g']) if g.get('p', 0) > 0}
        antes_t = viejo['t']
    else:
        antes, antes_t = viejo.get('antes') or {}, viejo.get('antes_t')
    if not antes:
        return out
    out['antes'], out['antes_t'] = antes, antes_t
    for i, g in enumerate(out['g']):
        if g['p'] > 0:
            g['mv'] = antes[g['k']] - (i + 1) if g['k'] in antes else 'n'
    return out


# ── 7. Self-check ────────────────────────────────────────────────────────────────────────────────────────────────────
def _b(fuente, ev, tipo, fecha, ronda, a, b, gana, replica=None, votos=None, pa=None, pb=None):
    return {'id': '%s:%s:%s:%s|%s' % (fuente, ev, ronda, a, b), 'fuente': fuente,
            'evento': {'id': ev, 'nombre': ev, 'tipo': tipo, 'fecha': fecha, 'pais': None}, 'ronda': ronda,
            'a': {'nombre': a, 'id': '%s:%s' % (fuente, claves.clave(a)), 'pais': pa},
            'b': {'nombre': b, 'id': '%s:%s' % (fuente, claves.clave(b)), 'pais': pb},
            'gana': gana, 'replica': replica, 'votos': votos, 'pts': None}


def _self_check():
    mal = []
    # 🎬 el video: sólo un id de YouTube, y el de /shorts/ es vertical
    if (video_de({'url': 'https://www.youtube.com/watch?v=-ilbryedj5U'}) != ('-ilbryedj5U', False)
            or video_de({'url': 'https://youtube.com/shorts/abcdefghijk'}) != ('abcdefghijk', True)
            or video_de({'url': 'https://youtu.be/abcdefghijk?t=3'}) != ('abcdefghijk', False)
            or video_de({'url': 'https://fms.tv/batalla/1'}) is not None):
        mal.append('video_de() no lee bien las direcciones de YouTube')
    # 🔗 la vista previa de cada ficha: el puesto es el de la tabla y quien no sumó va en 0
    vv = vista_de({'g': [{'k': 'a', 'n': 'A', 'cc': 'ar', 'esc': 'pro', 'p': 9.5}, {'k': 'b', 'n': 'B', 'esc': 'plaza', 'p': 0},
                         {'k': '', 'n': 'Sin clave', 'p': 3}]})
    if vv != {'a': ['A', 'ar', 'pro', 1], 'b': ['B', '', 'plaza', 0]}:
        mal.append('vista_de() no arma la vista previa como la página: %r' % vv)
    # 🏷️ los grupos: puede tener los tres; la escena sigue siendo una
    G = grupos_de
    casos = [(G('a', {}, 'plaza', {'plaza'}), ['plaza']),
             (G('rife', {}, 'pro', {'fms_jornada', 'plaza'}), ['pro']),
             (G('rodamiento', {}, 'plaza', {'plaza'}, pro_hist=True), ['pro']),
             (G('mecha', {}, 'pro', {'fms_jornada', 'independiente', 'rb_regional'}), ['pro']),
             (G('l-oasis', {'lg': 'oasis'}, 'liga', {'liga'}, {'suma': {'l-oasis': ['plaza']}}), ['plaza', 'liga']),
             (G('x', {'lg': 'x'}, 'pro', {'fms_jornada', 'plazas_final'}), ['pro', 'liga']),
             (G('l-y', {'lg': 'y'}, 'liga', {'liga'}), ['liga']),
             (G('z', {}, 'plaza', {'plaza'}, {'saca': {'z': ['plaza']}, 'suma': {'z': ['inventado']}}), ['plaza'])]
    rod = {'t': [[1, 'Combate Freestyle Internacional', '2021/2022', 'Final'], [2, 'Red Bull Batalla Chile', '2026/2027', 'Regional Centro'],
                 [2, 'Red Bull Batalla Chile', '2020', 'Final nacional'], [3, 'FMS Chile', '2024/2025', 'Jornada 5 (Finals)'],
                 [1, 'FMS Under', '2023', 'Jornada 1'], [3, 'Red Bull Batalla Chile', '2019', 'Semifinal Santiago']]}
    casos.append((pro_por_carrera(rod), ['2.º en Red Bull Batalla Chile 2020 (final nacional)', '3.º en FMS Chile 2024/2025']))
    casos.append((pro_por_carrera({'t': [[1, 'Copa Federación Chile', '2020/2021', 'Final'], [1, 'FMS Under', '2023', 'J1'],
                                         [2, 'Red Bull Batalla Chile', '2026/2027', 'Regional Centro']]}), []))
    casos.append((pro_por_carrera({'t': [[1, 'God Level Fest', '2019', 'Final'], [2, 'Red Bull Batalla Internacional', '2025/2026', 'Final']]}),
                  ['Campeón de God Level Fest 2019', '2.º en Red Bull Batalla Internacional 2025/2026']))
    for i, (vino, quiero) in enumerate(casos):
        if vino != quiero:
            mal.append('grupos_de() caso %d: %r, tenía que dar %r' % (i, vino, quiero))
    bs = []
    # Un MC de FMS que gana 4 batallas (dos jornadas) contra rivales de FMS…
    for j, (r1, r2) in enumerate((('Rival1', 'Rival2'), ('Rival3', 'Rival4'))):
        for r in (r1, r2):
            bs.append(_b('fms', 'fms-co-j%d' % (j + 1), 'fms_jornada', '2026-10-1%d' % j, 'jornada', 'Pro', r, 'a',
                         votos=[5, 0]))
        bs.append(_b('fms', 'fms-co-j%d' % (j + 1), 'fms_jornada', '2026-10-1%d' % j, 'jornada', r1, r2, 'a',
                     votos=[3, 2]))
    # …contra uno de la Liga que gana 15 eventos chicos de Discord.
    for i in range(15):
        bs.append(_b('liga', 'liga-%d' % i, 'liga', '2026-10-%02d' % (i + 1), 'final', 'Grinder', 'Flojo%d' % i, 'a'))
    # Y la misma batalla en dos fuentes cuenta una vez.
    bs.append(_b('fms', 'fms-co-j1', 'fms_jornada', '2026-10-10', 'jornada', 'Rival1', 'Rival2', 'a', votos=[3, 2]))
    bs.append(_b('fstats', 'fstats-x', 'fms_jornada', '2026-10-11', 'jornada', 'Rival2', 'Rival1', 'b'))
    mvps = [{'evento': {'id': 'fms-co-j1', 'tipo': 'fms_jornada'}, 'quien': {'nombre': 'Pro', 'id': 'fms:pro'}}]
    out = armar(bs, mvps, {}, {}, cuando=dt.datetime(2026, 11, 23, 17, tzinfo=ET))
    g = {x['n']: x for x in out['g']}
    if not (g['Pro']['p'] > g['Grinder']['p']):
        mal.append('cuatro victorias de FMS tienen que pasar a 15 títulos chicos de la Liga: %s contra %s'
                   % (g['Pro']['p'], g['Grinder']['p']))
    if g['Grinder']['nb'] != MEJORES or len(g['Grinder']['t']) != MEJORES_TITULOS:
        mal.append('cuentan sólo las %d mejores batallas y los %d mejores títulos: %r'
                   % (MEJORES, MEJORES_TITULOS, (g['Grinder']['nb'], len(g['Grinder']['t']))))
    dos = [_b('youtube', 'yt-dos', 'plaza', '2026-10-05', 'final', 'Uno', 'Dos', 'a'),
           _b('youtube', 'yt-dos', 'plaza', '2026-10-05', 'final', 'Tres', 'Cuatro', 'b')]
    g2 = {x['n']: x for x in armar(dos, [], {}, {}, cuando=dt.datetime(2026, 11, 23, 17, tzinfo=ET))['g']}
    if not (any(t[1] == 1 for t in g2['Uno']['t']) and any(t[1] == 1 for t in g2['Cuatro']['t'])):
        mal.append('un evento con dos finales da dos títulos, uno por final')
    # YouTube escribe «AIRON PUNCHLINE» y Freestylestats «Airon» (usuario `aironpunchline`): una persona, una batalla.
    fs = _b('fstats', 'rb-co', 'rb_nacional', '2026-10-17', 'octavos', 'Airon', 'Hunter', 'a', pa='co', pb='co')
    fs['a']['id'] = 'fstats:aironpunchline'
    yt = _b('youtube', 'yt-rb-co', 'rb_nacional', '2026-10-05', 'octavos', 'AIRON PUNCHLINE', 'HUNTER', 'a', pa='co',
            pb='co')
    g3 = {x['n']: x for x in armar([fs, yt], [], {}, {}, cuando=dt.datetime(2026, 11, 23, 17, tzinfo=ET))['g']}
    if len(g3) != 2 or g3.get('Airon', {}).get('jb') != 1:
        mal.append('la misma batalla con el nombre escrito distinto cuenta una vez: %r'
                   % {n: x['jb'] for n, x in g3.items()})
    # Quien juega una jornada de FMS es pro aunque fms.tv todavía no lo liste.
    g4 = {x['n']: x for x in armar([_b('fms', 'FMS Chile 2026/27 · Jornada 1', 'fms_jornada', '2026-10-25', 'jornada',
                                       'Nuevo', 'Otro', 'a')], [], {}, {},
                                    cuando=dt.datetime(2026, 11, 23, 17, tzinfo=ET))['g']}
    if g4['Nuevo']['esc'] != 'pro' or g4['Otro']['esc'] != 'pro' or g4['Nuevo'].get('por') != ['FMS Chile 2026/27']:
        mal.append('quien juega una jornada de FMS es pro: %r' % {n: (x['esc'], x.get('por')) for n, x in g4.items()})
    # Las flechas: contra la tabla de la semana anterior, nunca contra una corrida de la misma semana.
    t1 = {'t': '2026-11-16T17:00:00-05:00', 'g': [{'k': 'a', 'p': 9}, {'k': 'b', 'p': 5}]}
    t2 = flechas({'t': '2026-11-23T17:00:00-05:00', 'g': [{'k': 'b', 'p': 9}, {'k': 'a', 'p': 5}, {'k': 'c', 'p': 1}]},
                 t1)
    t3 = flechas({'t': '2026-11-25T17:00:00-05:00', 'g': [{'k': 'b', 'p': 9}, {'k': 'c', 'p': 6}, {'k': 'a', 'p': 5}]},
                 t2)
    if [g.get('mv') for g in t2['g']] != [1, -1, 'n'] or [g.get('mv') for g in t3['g']] != [1, 'n', -2]             or flechas({'t': '2026-11-23T17:00:00-05:00', 'g': [{'k': 'a', 'p': 9}]}, {}).get('antes'):
        mal.append('las flechas salen de la semana anterior: %r / %r' % ([g.get('mv') for g in t2['g']],
                                                                         [g.get('mv') for g in t3['g']]))
    if not any(t[1] == 'MVP' for t in g['Pro']['t']):
        mal.append('el MVP de la jornada cuenta como un título')
    # Una fuente sin ronda ni ganador se junta con la que sí los trae, y el ganador se da vuelta si los lados van al
    # revés.
    sin = _b('urbanstreet', 'us-x', 'rb_nacional', '2026-10-05', None, 'Cami', 'Dora', None)
    con = _b('fstats', 'fs-x', 'rb_nacional', '2026-10-02', 'final', 'Dora', 'Cami', 'a')
    junta = deduplicar([sin, con])
    if len(junta) != 1 or junta[0]['ronda'] != 'final' or junta[0]['fuentes'] != ['fstats', 'urbanstreet']:
        mal.append('una batalla sin ronda de UrbanStreet se junta con la de Freestylestats: %r'
                   % [(j['ronda'], j['fuentes']) for j in junta])
    con2 = _b('fstats', 'fs-y', 'rb_nacional', '2026-10-02', 'final', 'Eva', 'Flor', None)
    sin2 = _b('urbanstreet', 'us-y', 'rb_nacional', '2026-10-03', 'final', 'Flor', 'Eva', 'a')
    j2 = deduplicar([con2, sin2])
    if len(j2) != 1 or j2[0]['gana'] != 'b':
        mal.append('el ganador que llega de otra fuente con los lados al revés se da vuelta: %r' % [j['gana'] for j in j2])
    dups = [b for b in deduplicar(bs) if _par(b) == frozenset(('rival1', 'rival2'))]
    if len(dups) != 1 or dups[0]['fuentes'] != ['fms', 'fstats']:
        mal.append('la misma batalla en FMS y Freestylestats es una sola, con las dos fuentes: %r'
                   % [d.get('fuentes') for d in dups])
    # El margen de los jueces: 5-0 vale más que 3-2.
    a = _b('fms', 'e', 'fms_jornada', '2026-10-10', 'jornada', 'X', 'Y', 'a', votos=[5, 0])
    c = _b('fms', 'e', 'fms_jornada', '2026-10-10', 'jornada', 'X', 'Y', 'a', votos=[3, 2])
    if not (_margen(a, 'a') > _margen(c, 'a') == 0):
        mal.append('el margen: 5-0 suma, 3-2 no')
    # Perder con réplica contra alguien más fuerte suma un poco; perder directo, nada.
    pr = _b('fms', 'e', 'fms_jornada', '2026-10-10', 'jornada', 'X', 'Y', 'b', replica=True)
    if _resultado(pr, 'a', 3, 8)[1] != PIERDE_REPLICA or _resultado(pr, 'a', 8, 3)[1] != 0:
        mal.append('perder con réplica suma sólo contra alguien más fuerte')
    # Quién es pro sale de quién ES, no de dónde jugó en la ventana: KG jugó plazas y es pro (FMS Internacional);
    # un MC de plaza que llegó a una final nacional de Red Bull sigue siendo de plaza; y un pro sin batallas en la T1
    # aparece igual, con 0.
    pros = pros_de([{'id': 'fms:1', 'nombre': 'Pro', 'pais': None, 'ligas': ['colombia']}],
                   {'grupos': [{'por': 'Red Bull Internacional', 'gente': [['KG', 'pe'], ['Quieto', 'pe']]}]})
    kb = [_b('youtube', 'yt-raptablo', 'plaza', '2026-10-01', 'final', 'KG', 'Plazero', 'a'),
          _b('fstats', 'rb-pe', 'rb_nacional', '2026-10-02', 'final', 'Plazero', 'Otro', 'a')]
    o2 = armar(bs + kb, mvps, {}, {}, cuando=dt.datetime(2026, 11, 23, 17, tzinfo=ET), pros=pros)
    g2 = {x['n']: x for x in o2['g']}
    if g2['KG']['esc'] != 'pro' or g2['Plazero']['esc'] != 'plaza' or g2['Pro']['esc'] != 'pro':
        mal.append('los grupos: KG pro, Plazero plaza, Pro pro: %r' % [(n, g2[n]['esc']) for n in ('KG', 'Plazero', 'Pro')])
    kgs = [x for x in o2['g'] if x['n'] == 'KG']
    if len(kgs) != 1 or kgs[0]['p'] <= 0:
        mal.append('KG de la lista de pros y KG de las batallas son UNA persona, con sus puntos: %r'
                   % [(x['esc'], x['p']) for x in kgs])
    if 'Quieto' not in g2 or g2['Quieto']['p'] != 0 or g2['Quieto']['esc'] != 'pro':
        mal.append('un pro sin batallas en la T1 aparece con 0: %r' % g2.get('Quieto'))
    if g2['Grinder']['esc'] != 'liga':
        mal.append('el de la Liga es de la Liga: %r' % g2['Grinder']['esc'])
    # En la duda, dos perfiles: la Liga no se une sola con un pro del mismo nombre.
    de_id, pers = identidades([_b('liga', 'l', 'liga', '2026-10-01', 'final', 'Sol', 'Luna', 'a'),
                               _b('fms', 'f', 'fms_jornada', '2026-10-01', 'jornada', 'Sol', 'Rival1', 'a')], [])
    if de_id['liga:sol'] == de_id['fms:sol']:
        mal.append('un «Sol» de la Liga y uno de FMS no se unen solos')
    for m in mal:
        print('🔴', m)
    print('✅ global_ranking: bien' if not mal else '🔴 global_ranking: %d problemas' % len(mal))
    return 1 if mal else 0


def _ver(out, quien):
    q = claves.clave(quien)
    ev = out['ev']
    for i, g in enumerate(out['g']):
        if claves.clave(g['n']) == q or g['k'] == quien:
            print('#%d %s (%s, %s): %.1f = %.1f de batallas (%d de %d) + %.1f de títulos · fuerza %.1f'
                  % (i + 1, g['n'], g['cc'] or '—', g['esc'], g['p'], g['pb'], g['nb'], g['jb'], g['pt'], g['f']))
            nombres = {x['k']: x['n'] for x in out['g']}
            for e, r, el, cod, pts, nf in g['b']:
                print('   %6.1f  %s · %s · %s %s%s' % (pts, ev[e][1], r, cod, nombres.get(el, el),
                                                       '' if nf > 1 else ' (una fuente)'))
            for e, puesto, pts in g['t']:
                print('   %6.1f  título: %s · %s' % (pts, ev[e][1], {1: 'campeón', 2: 'final', 3: 'semi'}.get(puesto,
                                                                                                        puesto)))
            return
    print('no encontré a «%s»' % quien)


def main():
    if '--auto' in sys.argv:
        sys.exit(_self_check())
    out = correr(red='--leer' in sys.argv, escribir='--no-escribir' not in sys.argv)
    if '--ver' in sys.argv:
        i = sys.argv.index('--ver')
        _ver(out, ' '.join(sys.argv[i + 1:]))
        return
    for n, e in out['fu'].items():
        print('fuente %-6s %4d batallas %s%s' % (n, e.get('n', 0), '' if e.get('ok', True) else '⚠️ ',
                                               ('· ' + e['av'][0]) if e.get('av') else ''))
    print('%d personas, %d eventos' % (len(out['g']), len(out['ev'])))
    for i, g in enumerate(out['g'][:20]):
        print('%3d. %-22s %-3s %-5s %7.1f  (batallas %.1f · títulos %.1f)' % (i + 1, g['n'][:22], g['cc'] or '',
                                                                         g['esc'], g['p'], g['pb'], g['pt']))


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    main()
