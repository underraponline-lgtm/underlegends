# -*- coding: utf-8 -*-
"""EL APODO DE CADA UNO EN DISCORD, EN TODA LA LIGA: EL ESTILO QUE ELIGIÓ CON `/apodo` (o el de por defecto).

🏷️ DESDE EL 18/11/2026 SON SEIS ESTILOS Y NO SÓLO EL «#N» (Dlx: *«que hayan opciones… gente que está en una crew…
las siglas y luego el nombre»*): «#23 | FLB | Bloody», «40º | FLB | Bloody», «💎 | FLB | Bloody», «🇨🇴 | FLB | Bloody»,
«B- | FLB | Bloody» y «Bloody». Cómo se arma cada uno vive en `bot/apodo.py` (con su gemelo en JS para `/apodo`); acá se
juntan las piezas de cada uno (`piezas()`), se decide el estilo (`estilo_de()`) y se pone. Quien nunca eligió lleva el 1,
**el #N y la crew** (Dlx: *«#N y la crew»*), salvo donde el servidor lo apagó con `/settings`. Y las piezas de todos van a
KV (`apodos`), para que `/apodo` cambie el apodo al toque sin esperar esta vuelta.

Lo que sigue es la historia del «#N», que sigue valiendo para el estilo 1.

EL «#PUESTO» DEL RANKING COMPETITIVO EN EL APODO, EN TODA LA LIGA.

    python herramientas/sincronizar_puesto.py             muestra el plan
    python herramientas/sincronizar_puesto.py --aplicar   cambia los apodos
    python herramientas/sincronizar_puesto.py --ciclo     lo mismo, desde el ciclo (paso 2b6)
    python herramientas/sincronizar_puesto.py --revertir  deshace la ultima tanda
    python herramientas/sincronizar_puesto.py --auto      el self-check

🔴 DLX, 29/09/2026: *«los que tienen el # … el nombre automáticamente debería
cambiar … ÚNICAMENTE a las personas que están en el competitivo… esto en toda
la liga»*. Tres cosas cambiaron ese día:

  · QUIEN NO ESTÁ EN EL COMPETITIVO PIERDE EL «#N». Hasta acá se lo
    reportaba y no se lo tocaba («elegirle una marca nueva sería inventar la
    convención del servidor»): se le saca el número y queda su nombre, sin
    marca nueva. Medido ese día: 139 apodos con un número de la
    pre-temporada —57 en DRA y 82 en FFA— y en la T1 tienen número dos.
  · EN TODOS LOS SERVIDORES DE LA LIGA donde está el bot, no sólo DRA y FFA.
  · EL NÚMERO SALE DEL POOL, no del Sheet: `datos/competitivo_pool.json`,
    `pos` hasta `total` —los que pasan la puerta de 10 eventos y son
    miembros, el mismo número de la vitrina y de la carta—. Así corre solo
    en el ciclo, sin la cuenta de servicio.

⚠️ LOS RESPALDOS VAN A `.cache/`, NO A `docs/`: tienen Discord IDs y apodos, y
`docs/` es público. Los tres del 19/09 estaban commiteados.

Dlx, 19/09/2026: el `#` del apodo pasa de salir del **Ranking Temporada (top
30)** a salir del **Ranking Competitivo (los 138)**. Son rankings distintos, asi
que los numeros cambian: Konan era #7 por Temporada y es **#1** por Competitivo.

⚠️ EL NUMERO NO SE CALCULA: SE LEE. La hoja «Ranking Competitivo» del Oficial
ya trae su columna `#` (y al lado una «Posición # Temporada», que es de donde
salian los apodos viejos). Ordenar por Score a mano daria casi lo mismo y
«casi» es el problema: si el Sheet desempata distinto, los apodos dejan de
coincidir con lo que la gente ve en el ranking.

⚠️ EL NOMBRE SALE DE DRA, EN LOS DOS SERVIDORES. Dlx, 19/09/2026: *«los nombres
se basan tmb en DRA, o sea Bloody en DRA, Bloody; entonces en FFA ## | Bloody»*.
Los apodos de DRA son «<marca> | <nombre>» —«🐉 | Vandu», «#7 | Konan»—: se
toma ese nombre y se le cambia la marca por «#N».

La primera version conservaba el apodo DE CADA SERVIDOR, y eso partia la
identidad en dos: Bloody quedaba «#22 | Bloody» en DRA y «#22 | Slenderman» en
FFA, que es el nombre que el se habia puesto alla. DRA es la referencia, asi
que el mismo nombre va a los dos lados.

Si no esta en DRA o no tiene apodo ahi, se usa el nombre del ranking.

⚠️ QUIEN TIENE «#N» Y YA NO ESTA EN EL RANKING SE REPORTA, NO SE TOCA. Su
numero quedo viejo, pero elegirle una marca nueva (🐉? 👤?) seria inventar la
convencion del servidor.

⚠️ GUARDA EL APODO ANTERIOR de cada uno en `docs/apodos_<fecha>.json`, y
`--revertir` los devuelve. Cambiar el nombre que ve todo un servidor tiene que
poder deshacerse.

⚠️ TRES COSAS QUE DISCORD NO DEJA, y no son errores: el apodo tope son 32
caracteres (se recorta), al DUEÑO del servidor no se le puede cambiar nunca, y
a quien tenga un rol mas alto que el del bot tampoco. Se reportan y se saltean.

🔴 QUIEN LLEVA EL «#N» SE DECIDE ENTRE DOS, Y SON TRES ESTADOS.
Dlx, 19/09/2026: *«si un usuario estaba en on y después yo lo apago, gana el
usuario y conserva su apodo, porque eso es algo suyo. Si no lo usaron, siguen
lo que deciden los admins»*.

    la persona eligio con /puesto   ->  manda ella, siempre
    la persona no eligio            ->  manda el servidor (/settings)
    el servidor tampoco             ->  prendido, como venia andando

⚠️ POR ESO LA CLAVE GUARDA `on: true|false` Y NO ALCANZA CON QUE EXISTA. La
primera version usaba la PRESENCIA de `poff:<guild>:<id>` como «apagado», y eso
no distingue «lo prendió a proposito» de «nunca lo toco» — sin esa distincion
la regla de arriba no se puede escribir. Hoy la clave es `pnick:<guild>:<id>` y
NO EXISTIR es el tercer estado.

⚠️ Y ES POR SERVIDOR: se puede llevar en DRA y no en FFA.

Las dos decisiones viven en el KV del Worker (`pnick:` y `cfg:`), que es donde
las escriben `/puesto` y `/settings`; este script las lee antes de armar el
plan y las aplica, porque cambiar un apodo se hace con el token.

⚠️ NO ALCANZA CON SALTEARLO: hay que SACARLE el «#N» si lo tiene. Si sólo se
lo dejara afuera del plan, quien pidió que se lo saquen se quedaría con el
número viejo puesto para siempre, que es justo lo contrario de lo que pidió.
"""
import io
import json
import os
import re
import sys
import time

import requests

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, os.path.join(BASE, 'sheet'))
sys.path.insert(0, os.path.join(BASE, 'bot'))
sys.path.insert(0, BASE)
import apodo as AP  # noqa: E402

API = 'https://discord.com/api/v10'
CACHE = os.path.join(BASE, '.cache')
# el KV del Worker, donde `/puesto` guarda quien no quiere su numero
CUENTA = 'a85733396fd158a8e9660b02e20f33c8'
KV = 'a87399a3a0b647b0803aa90509ccce56'
KV_API = ('https://api.cloudflare.com/client/v4/accounts/%s/storage/kv/namespaces/%s'
          % (CUENTA, KV))
def _servidores():
    """[(sv, guild)] de la Liga donde está el bot: el «#N» va en todos (Dlx, 29/09)."""
    try:
        d = json.load(io.open(os.path.join(BASE, 'datos', 'servidores.json'), encoding='utf-8'))
        en = set(json.load(io.open(os.path.join(BASE, 'datos', 'bot_en.json'), encoding='utf-8')))
    except (OSError, ValueError):
        return [('DRA', '841017460341604382'), ('FFA', '1468472442925092958')]
    out = [(sv, x['guild_id']) for sv, x in (d.get('servidores') or {}).items()
           if sv in en and x.get('confirmado') and x.get('guild_id')]
    # DRA primero: el nombre sale de ahí (ver `nombre_de`)
    return sorted(out, key=lambda t: t[0] != 'DRA')


GUILDS = tuple(_servidores())
# ⚠️ EL ID VIVE EN `sheet/planillas.py`, NO ACA. Estaba copiado en
# cinco archivos: hoy coinciden y por eso no se nota, pero **la T1
# estrena planilla nueva** y ese dia el que se olvide de actualizar su
# copia lee la planilla vieja y devuelve datos validos de la temporada
# equivocada. No falla: miente.
from planillas import OFICIAL  # noqa: E402

#: ⏱️ los segundos que el ciclo le da a este paso por corrida (ver el bucle de `main()`)
PRESUPUESTO_CICLO = 180
HOJA = 'Ranking Competitivo'
TOPE = 32


def env(clave):
    for l in io.open(os.path.join(BASE, '.env'), encoding='utf-8'):
        if l.strip().startswith(clave + '='):
            return l.split('=', 1)[1].strip().strip('"\'')
    sys.exit('falta %s en .env' % clave)


def sin_bandera(s):
    return re.sub(r'[\U0001F1E6-\U0001F1FF‍️]', '', s).strip()


def numerados(pool=None):
    """{discord_id: (puesto, nombre)} de quienes tienen número en el Competitivo.

    `pos` hasta `total` del pool: pasan la puerta de 10 eventos Y son miembros
    (`construir_pool_competitivo.puestos_competitivo()`). Quien pasa la
    puerta y no es miembro queda después, sin número: fuera de concurso.
    """
    if pool is None:
        try:
            pool = json.load(io.open(os.path.join(BASE, 'datos', 'competitivo_pool.json'),
                                     encoding='utf-8'))
        except (OSError, ValueError):
            return {}
    out = {}
    for p in pool or []:
        n, t, did = p.get('pos'), p.get('total'), str(p.get('discord_id') or '')
        if did and n and t and int(n) <= int(t):
            out[did] = (int(n), sin_bandera(p.get('raw') or p.get('full') or ''))
    return out


def _json(nombre, defecto):
    try:
        return json.load(io.open(os.path.join(BASE, 'datos', nombre), encoding='utf-8'))
    except (OSError, ValueError):
        return defecto


def piezas(comp=None, temp=None, divs=None, crews=None, vivas=None):
    """{discord_id: {c, t, e, b, r, k}} — lo que cada uno PUEDE llevar en el apodo (`bot/apodo.armar()`), y las siglas
    de las crews. Sale de los mismos archivos que las cartas y la página:

        c  el #N del Competitivo y r su rango (pasa la puerta de 10 y es miembro: `pos` hasta `total`)
        t  el puesto de la Temporada («40º», `pos` hasta `total` del pool de Temporada)
        e  la división del ELO (0 Mítico … 5 Hierro: el grupo de `datos/divisiones.json`, sólo en modo ELO)
        b  el país · k la sigla de su crew (`datos/crews.json` + `crews_vivas.json`)

    Lo que alguien no tiene no está, y entonces esa parte del apodo no va."""
    from comun.claves import clave as norm
    comp = _json('competitivo_pool.json', []) if comp is None else comp
    temp = _json('temporada_pool.json', []) if temp is None else temp
    divs = _json('divisiones.json', {}) if divs is None else divs
    crews = (_json('crews.json', {}).get('crews') or {}) if crews is None else crews
    vivas = (_json('crews_vivas.json', {}).get('crews') or {}) if vivas is None else vivas
    out, did_de = {}, {}

    def num(p):
        try:
            return int(p['pos']) if p.get('pos') and p.get('total') and int(p['pos']) <= int(p['total']) else 0
        except (TypeError, ValueError):
            return 0
    for pool, cual in ((comp, 'c'), (temp, 't')):
        for p in pool or []:
            did = str(p.get('discord_id') or '')
            if not did:
                continue
            x = out.setdefault(did, {})
            did_de.setdefault(norm(p.get('raw') or p.get('full') or ''), did)
            n = num(p)
            if n:
                x[cual] = n
                if cual == 'c' and (p.get('subrango') or p.get('rango')):
                    x['r'] = str(p.get('subrango') or p.get('rango'))
            if p.get('cc') and not x.get('b'):
                x['b'] = str(p['cc']).lower()
    if (divs or {}).get('modo') == 'elo':
        for i, grupo in enumerate(divs.get('divs') or []):
            for tabla in grupo or []:
                for fila in tabla or []:
                    did = did_de.get(norm(fila[0] if fila else ''))
                    if did and i < len(AP.ELO):
                        out[did]['e'] = i
    vv = vivas.values() if isinstance(vivas, dict) else vivas
    sigla_de = {}
    for c in vv or []:
        if c.get('sigla'):
            sigla_de[c.get('id')] = sigla_de[c.get('nombre')] = str(c['sigla']).upper()
    for crew, gente in (crews or {}).items():
        sg = sigla_de.get(crew)
        for m in gente or []:
            did = did_de.get(norm(m))
            if sg and did:
                out[did]['k'] = sg
    return {d: x for d, x in out.items() if x}, sorted(set(sigla_de.values()))


def estilo_de(did, gid, globales, personas, servidores):
    """El estilo que rige para alguien en un servidor. 🔴 LO DE LA PERSONA GANA (Dlx, 19/09/2026: *«gana el usuario…
    porque eso es algo suyo»*): lo que eligió con `/apodo` o en su perfil (`apodo:<id>`, para todos los servidores);
    si no, lo que eligió con el `/numeral` de antes en ESE servidor (`pnick:`: prendido = 1, apagado = 6); si no, lo del
    servidor (`/settings` apagado = 6) y si tampoco, el de por defecto (1, el #N y la crew)."""
    g = AP.estilo_valido(globales.get(did))
    if g:
        return g
    v = personas.get((gid, did))
    if v is not None:
        return AP.POR_DEFECTO if v else AP.SOLO_NOMBRE
    return AP.POR_DEFECTO if servidores.get(gid, True) else AP.SOLO_NOMBRE


def decidir(actual, p, estilo, base, siglas):
    """Lo que se pone en cada apodo: vive en `bot/apodo.decidir()`, que es el gemelo del que usa `/apodo`."""
    return AP.decidir(actual, p, estilo, base, siglas)


def ranking():
    """[(puesto, nombre)] leido de la vitrina, sin calcular nada.

    🏆 DESDE EL 12/11/2026 LA VITRINA ES SU ARCHIVO (etapa 5b de sacar el Sheet): `datos/t1_vitrina_competitivo.json`.
    El Sheet quedó congelado, y leerlo daría el # de esa noche para siempre. `espejo_t1.fuente_vitrina()` decide."""
    import espejo_t1 as EJ

    def del_sheet():
        import gspread
        from google.oauth2.service_account import Credentials
        gc = gspread.authorize(Credentials.from_service_account_file(
            os.path.join(BASE, 'creds.json'),
            scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']))
        return gc.open_by_key(OFICIAL).worksheet(HOJA).get_all_values()
    v = EJ.fuente_vitrina(HOJA, del_sheet, 'el # del apodo')
    cab = next(i for i, f in enumerate(v) if '#' in [x.strip() for x in f]
               and 'Rapero' in [x.strip() for x in f])
    H = [x.strip() for x in v[cab]]
    iN, iR = H.index('#'), H.index('Rapero')
    out = []
    for f in v[cab + 1:]:
        if len(f) <= iR:
            continue
        n, r = f[iN].strip(), f[iR].strip()
        if n.isdigit() and r:
            out.append((int(n), sin_bandera(r)))
    return out


def bajar(s, gid):
    out, after = {}, '0'
    while True:
        r = s.get('%s/guilds/%s/members' % (API, gid),
                  params={'limit': 1000, 'after': after}, timeout=40)
        if r.status_code == 429:
            time.sleep(float(r.json().get('retry_after', 1)) + .3)
            continue
        if r.status_code != 200:
            sys.exit('no pude listar %s: %s' % (gid, r.status_code))
        lote = r.json()
        if not lote:
            break
        for m in lote:
            did = (m.get('user') or {}).get('id')
            if did:
                out[did] = m
        # 🔴 `key=int` NO ES COSMETICO. Los snowflakes tienen 17, 18 y 19
        # digitos, y `max()` sobre cadenas compara alfabeticamente: asi
        # '999999999999999999' le gana a '1000000000000000000', que es
        # mayor de verdad, y el cursor RETROCEDE. Medido en DRA: 4 paginas
        # y 3.069 filas para 2.707 personas — 362 pedidas dos veces. El
        # conjunto salia bien de casualidad (los `set` deduplican), pero
        # combinado con `break` en una pagina corta puede cortar antes de
        # llegar al final.
        after = max(((m.get('user') or {}).get('id', '0') for m in lote), key=int)
        time.sleep(0.25)
    return out


def poner_apodo(s, gid, did, apodo):
    for _ in range(5):
        r = s.patch('%s/guilds/%s/members/%s' % (API, gid, did),
                    headers={'Content-Type': 'application/json',
                             'X-Audit-Log-Reason': 'Liga Global: tu apodo (/apodo)'},
                    data=json.dumps({'nick': apodo}), timeout=20)
        if r.status_code == 429:
            time.sleep(float(r.json().get('retry_after', 1)) + .3)
            continue
        if r.status_code in (200, 204):
            return True, ''
        try:
            return False, '%s %s' % (r.status_code, r.json().get('message', ''))
        except Exception:
            return False, str(r.status_code)
    return False, 'rate limit'


def _leer_kv(prefijo, tok):
    """{clave: valor} de todo lo que empiece con ese prefijo."""
    s = requests.Session()
    s.headers['Authorization'] = 'Bearer ' + tok
    claves, cursor = [], None
    while True:
        p = {'prefix': prefijo, 'limit': 1000}
        if cursor:
            p['cursor'] = cursor
        j = s.get(KV_API + '/keys', params=p, timeout=30).json()
        if not j.get('success'):
            raise RuntimeError(str(j.get('errors'))[:120])
        claves += [k['name'] for k in j.get('result', [])]
        cursor = (j.get('result_info') or {}).get('cursor')
        if not cursor:
            break
    out = {}
    # ⚠️ POR `bulk/get` Y NO DE A UNA. El endpoint de a una sirve una copia
    # CACHEADA —ya hizo perder media hora en subir_datos.py— y ademas serian
    # cientos de llamadas.
    for i in range(0, len(claves), 100):
        r = s.post(KV_API + '/bulk/get', json={'keys': claves[i:i + 100]}, timeout=30)
        if r.ok:
            out.update(((r.json().get('result') or {}).get('values') or {}))
    return out


def _token_cf():
    """El token de Cloudflare de `.env`, o ''. ⚠️ NO SE USA env() ACÁ: hace sys.exit si falta la clave, y SystemExit no
    lo atrapa `except Exception`. Faltar el token de Cloudflare no puede tumbar una sincronización de apodos que no lo
    necesita."""
    try:
        for l in io.open(os.path.join(BASE, '.env'), encoding='utf-8'):
            if l.strip().startswith('CLOUDFLARE_API_TOKEN='):
                return l.split('=', 1)[1].strip().strip('"\'')
    except Exception:
        pass
    return ''


def cuerpo_piezas(pz, siglas, nombres=None):
    """Lo que va a KV (`apodos`): `{v, s: siglas, p: {id: [c, t, e, b, r, k, nombre]}}`, con 0, -1 o '' donde no tiene
    la pieza. El nombre es el BASE —el de DRA, el mismo que usa esta vuelta—: si `/apodo` usara el de cada servidor, la
    vuelta siguiente le «corregiría» el nombre a quien lo acaba de pedir. Ordenado, así dos corridas con lo mismo dan el
    mismo texto y no se vuelve a escribir."""
    nombres = nombres or {}
    return json.dumps({'v': 1, 's': list(siglas), 'p': {d: [x.get('c') or 0, x.get('t') or 0, x['e'] if 'e' in x else -1,
                                                            x.get('b') or '', x.get('r') or '', x.get('k') or '',
                                                            nombres.get(d) or '']
                                                        for d, x in sorted(pz.items())}},
                      ensure_ascii=False, separators=(',', ':'), sort_keys=True)


def publicar_piezas(pz, siglas, nombres=None):
    """🏷️ LAS PIEZAS DE CADA UNO, A KV (`apodos`), para que `/apodo` (bot/worker.js) cambie el apodo AL TOQUE en el
    servidor donde se pidió —con `bot/apodo.js`, que arma lo mismo que `bot/apodo.py`— en vez de esperar esta vuelta.
    Sólo se escribe si cambió: cada escritura gasta del cupo de 1.000 por día de KV, y las piezas cambian cuando se
    procesa un evento, no en cada corrida. Si no se puede, se avisa y se sigue: `/apodo` dice entonces que se aplica en
    la próxima vuelta."""
    tok = _token_cf()
    if not tok:
        print('   ⚠️ sin CLOUDFLARE_API_TOKEN: las piezas no van a KV (/apodo aplicará en la próxima vuelta)')
        return
    cuerpo = cuerpo_piezas(pz, siglas, nombres)
    try:
        if _leer_kv('apodos', tok).get('apodos') == cuerpo:
            print('   las piezas de los apodos en KV: al día (%d personas)' % len(pz))
            return
        r = requests.put(KV_API + '/values/apodos', headers={'Authorization': 'Bearer ' + tok},
                         data=cuerpo.encode('utf-8'), timeout=30)
        print('   %s las piezas de los apodos a KV: %d personas, %.1f KB' % (
            '✅' if r.ok else '⚠️ (%s) no pude subir' % r.status_code, len(pz), len(cuerpo.encode('utf-8')) / 1024))
    except Exception as e:                                # noqa: BLE001
        print('   ⚠️ no pude subir las piezas de los apodos a KV (%s)' % str(e)[:60])


def quien_lleva_numero():
    """{(guild, discord_id) -> True/False}, cruzando persona y servidor.

    🔴 SON TRES ESTADOS Y NO DOS. Dlx, 19/09/2026: *«si un usuario estaba en on
    y después yo lo apago, gana el usuario y conserva su apodo, porque eso es
    algo suyo. Si no lo usaron, siguen lo que deciden los admins»*.

        la persona eligio  ->  manda ella, siempre
        la persona no      ->  manda el servidor (`cfg:<guild>.nick`)
        el servidor tampoco ->  prendido, que es como venia andando

    Devuelve SOLO lo que difiere del default, para no tener que enumerar a los
    4.000 miembros: la clave existe cuando alguien —persona o servidor— dijo
    algo distinto de «prendido».

    ⚠️ SI KV NO CONTESTA, SE SIGUE SIN LAS PREFERENCIAS Y SE AVISA. Frenar la
    sincronizacion entera porque una API de terceros esta caida seria peor: lo
    unico que se pierde es que un puñado de apodos vuelva a llevar el numero,
    y la proxima corrida lo corrige. Lo que NO se hace es callarlo.
    """
    tok = _token_cf()
    if not tok:
        print('   ⚠️ sin CLOUDFLARE_API_TOKEN en .env — sigo sin las preferencias')
        return {}, {}, {}
    try:
        personas = {}
        for k, v in _leer_kv('pnick:', tok).items():
            partes = k.split(':')
            if len(partes) != 3:
                continue
            try:
                personas[(partes[1], partes[2])] = bool(json.loads(v).get('on'))
            except Exception:
                pass
        globales = {}
        for k, v in _leer_kv('apodo:', tok).items():
            try:
                e = AP.estilo_valido(json.loads(v).get('e'))
            except Exception:
                e = None
            if e:
                globales[k.split(':', 1)[1]] = e
        servidores = {}
        for k, v in _leer_kv('cfg:', tok).items():
            gid = k.split(':', 1)[1]
            try:
                servidores[gid] = json.loads(v).get('nick', True) is not False
            except Exception:
                pass
        return personas, servidores, globales
    except Exception as e:
        print('   ⚠️ no pude leer las preferencias de KV (%s) — sigo sin ellas' % str(e)[:60])
        return {}, {}, {}


def _self_check():
    print('\n══ 🏷️ LOS APODOS (el estilo de cada uno, o el #N y la crew) ══\n')
    mal = 0

    def ok(que, cond, det=''):
        nonlocal mal
        print('   %s %s%s' % ('✅' if cond else '🔴', que, ('  ' + str(det)) if det else ''))
        mal += 0 if cond else 1
    pool = [{'raw': 'Hassan', 'pos': 1, 'total': 2, 'discord_id': '1'},
            {'raw': 'Makmah', 'pos': 2, 'total': 2, 'discord_id': '2'},
            {'raw': 'Velatz', 'pos': 3, 'total': 2, 'discord_id': '3'},
            {'raw': 'Oasis 🇨🇱', 'pos': 4, 'total': 2, 'discord_id': '4'},
            {'raw': 'Sin ID', 'pos': 1, 'total': 2}]
    n = numerados(pool)
    ok('número sólo para quien pasa la puerta y es miembro (pos hasta total)',
       n == {'1': (1, 'Hassan'), '2': (2, 'Makmah')}, n)
    ok('sin nadie en el Competitivo, nadie tiene número', numerados([]) == {})

    # las piezas de cada uno, de los mismos archivos que las cartas
    comp = [{'raw': 'Bloody', 'pos': 23, 'total': 85, 'subrango': 'B-', 'cc': 'co', 'discord_id': '10'},
            {'raw': 'Vandu', 'pos': 90, 'total': 85, 'subrango': 'C', 'cc': 'co', 'discord_id': '11'}]
    temp = [{'raw': 'Bloody', 'pos': 40, 'total': 258, 'cc': 'co', 'discord_id': '10'},
            {'raw': 'Vandu', 'pos': 300, 'total': 258, 'cc': 'co', 'discord_id': '11'},
            {'raw': 'Liberia', 'pos': 3, 'total': 258, 'cc': 'ar', 'discord_id': '12'}]
    divs = {'modo': 'elo', 'divs': [[[]], [[['Bloody', 1200]]], [[]], [[]], [[]], [[['Vandu', 990]]]]}
    crews = {'Follombia': ['Bloody', 'Vandu']}
    vivas = {'Follombia': {'id': 'Follombia', 'nombre': 'Follombia', 'sigla': 'FLB'}}
    pz, sg = piezas(comp, temp, divs, crews, vivas)
    ok('Bloody: #23, 40º, Diamante, Colombia, B- y FLB',
       pz.get('10') == {'c': 23, 't': 40, 'e': 1, 'b': 'co', 'r': 'B-', 'k': 'FLB'}, pz.get('10'))
    ok('Vandu, fuera de los numerados: sin #N, sin 40º y sin rango; Hierro y su crew',
       pz.get('11') == {'b': 'co', 'e': 5, 'k': 'FLB'}, pz.get('11'))
    ok('Liberia: sólo el puesto de la Temporada y el país', pz.get('12') == {'t': 3, 'b': 'ar'}, pz.get('12'))
    ok('las siglas de las crews salen de crews_vivas', sg == ['FLB'], sg)
    ok('fuera del modo ELO no hay piedra', 'e' not in piezas(comp, temp, {'divs': divs['divs']}, crews, vivas)[0]['10'])

    # quién manda: lo de la persona, después el /numeral de antes, después el servidor, después el 1
    G = {'10': 3}
    P = {('g1', '10'): False, ('g1', '11'): False, ('g2', '11'): True}
    S = {'g3': False}
    ok('/apodo le gana a todo', estilo_de('10', 'g1', G, P, S) == 3)
    ok('el /numeral apagado de antes, en ese servidor, es «solo el nombre»', estilo_de('11', 'g1', {}, P, S) == AP.SOLO_NOMBRE)
    ok('el /numeral prendido de antes es el 1', estilo_de('11', 'g2', {}, P, S) == 1)
    ok('un servidor que lo apagó con /settings: solo el nombre para quien no eligió', estilo_de('12', 'g3', {}, P, S) == 6)
    ok('y si nadie dijo nada, el 1: el #N y la crew', estilo_de('12', 'g9', {}, P, S) == 1)

    # qué se pone
    b = pz['10']
    ok('con el 1: «#23 | FLB | Bloody», aunque hoy tenga el 🐉 de DRA',
       decidir('🐉 | Bloody', b, 1, 'Bloody', sg) == '#23 | FLB | Bloody')
    ok('con «solo el nombre» se le sacan las marcas de la Liga', decidir('#23 | FLB | Bloody', b, 6, 'Bloody', sg) == 'Bloody')
    ok('… y la marca de otro no se toca', decidir('🐉 | Bloody', b, 6, 'Bloody', sg) == '🐉 | Bloody')
    ok('… ni la bandera que alguien se puso solo (sin piezas: ni bandera ni letra son nuestras)',
       decidir('🇫🇷 | Valᴺᴷ', None, 1, 'Valᴺᴷ', sg) == '🇫🇷 | Valᴺᴷ')
    ok('… y la suya, del estilo 4, sí se va con «solo el nombre»', decidir('🇨🇴 | FLB | Bloody', b, 6, 'Bloody', sg) == 'Bloody')
    ok('… y a quien no tiene apodo no se le pone uno', decidir('', b, 6, 'Bloody', sg) == '')
    ok('quien ya no tiene ninguna pieza pierde la marca vieja', decidir('#12 | OG', None, 1, 'OG', sg) == 'OG')
    ok('y un apodo que era sólo «#5» queda sin apodo', decidir('#5', None, 1, '', sg) is None)
    ok('el estilo 2 sin puesto de Temporada lleva la crew sola (el # no se cuela)',
       decidir('', {'c': 23, 'k': 'FLB'}, 2, 'Bloody', sg) == 'FLB | Bloody')
    ok('las piezas a KV: una lista por persona, -1 sin ELO', json.loads(cuerpo_piezas({'12': {'t': 3, 'b': 'ar'}}, sg))
       == {'v': 1, 's': ['FLB'], 'p': {'12': [0, 3, -1, 'ar', '', '', '']}})
    ok('va a todos los servidores de la Liga donde está el bot, DRA primero',
       GUILDS and GUILDS[0][0] == 'DRA' and len(GUILDS) >= 2, [g for g, _ in GUILDS])
    print('\n   %s\n' % ('todo ok' if not mal else '🔴 %d mal' % mal))
    return 1 if mal else 0


def main():
    import requests
    if '--auto' in sys.argv:
        sys.exit(_self_check())

    s = requests.Session()
    s.headers['Authorization'] = 'Bot ' + env('DISCORD_TOKEN')

    if '--revertir' in sys.argv:
        resp = sorted((f, d) for d in (CACHE, os.path.join(BASE, 'docs')) if os.path.isdir(d)
                      for f in os.listdir(d) if f.startswith('apodos_'))
        if not resp:
            sys.exit('no hay respaldo de apodos que revertir')
        resp = [(f, d) for f, d in resp]
        f_, d_ = max(resp, key=lambda x: x[0].split('_')[-2:])
        datos = json.load(io.open(os.path.join(d_, f_), encoding='utf-8'))
        resp = [f_]
        print('\nrevirtiendo %d apodo(s) desde %s\n' % (len(datos['cambios']), resp[-1]))
        n = 0
        for c in datos['cambios']:
            ok, _ = poner_apodo(s, c['guild'], c['id'], c['antes'] or None)
            n += 1 if ok else 0
            time.sleep(0.4)
        print('  revertidos: %d de %d\n' % (n, len(datos['cambios'])))
        return

    print('\nlo que cada uno puede llevar en el apodo (pools, divisiones y crews)...')
    puesto_de = numerados()          # discord_id -> (puesto, nombre)
    PZ, siglas = piezas()
    nombre_pool = {}
    for p in _json('temporada_pool.json', []) + _json('competitivo_pool.json', []):
        if p.get('discord_id'):
            nombre_pool[str(p['discord_id'])] = sin_bandera(p.get('raw') or p.get('full') or '')
    sin_id = []
    print('   %d con #N · %d con puesto en la Temporada · %d con división del ELO · %d con crew (%s)' % (
        len(puesto_de), sum(1 for x in PZ.values() if x.get('t')), sum(1 for x in PZ.values() if 'e' in x),
        sum(1 for x in PZ.values() if x.get('k')), ', '.join(siglas) or '—'))

    miembros, duenos = {}, {}
    for sv, gid in GUILDS:
        print('\nbajando miembros de %s...' % sv)
        miembros[sv] = bajar(s, gid)
        print('   %d miembros' % len(miembros[sv]))
        try:
            duenos[gid] = str(s.get('%s/guilds/%s' % (API, gid), timeout=20).json().get('owner_id') or '')
        except Exception:                                 # noqa: BLE001
            duenos[gid] = ''

    # ⚠️ EL NOMBRE ES EL DE DRA, PARA TODOS LOS SERVIDORES. Sin esto la misma
    # persona queda con dos nombres distintos: «#22 | Bloody» en DRA y
    # «#22 | Slenderman» en FFA. Desde el 18/11 es lo que va después de la
    # ÚLTIMA barra («#23 | FLB | Bloody» -> «Bloody»), no de la primera.
    def nombre_de(did):
        return AP.nombre_de((miembros.get('DRA', {}).get(did) or {}).get('nick') or '') or nombre_pool.get(did, '')

    print('\nleyendo lo que eligió cada uno (/apodo, el /numeral de antes) y cada servidor (/settings)...')
    eleccion, por_servidor, globales = quien_lleva_numero()
    print('   %d eligieron con /apodo · %d con el /numeral de antes · %d servidor(es) configurado(s)'
          % (len(globales), len(eleccion), len(por_servidor)))
    for gid, on in sorted(por_servidor.items()):
        nom = next((s for s, g in GUILDS if g == gid), gid)
        print('      %-5s las marcas del apodo, por defecto %s'
              % (nom, 'PRENDIDAS' if on else 'APAGADAS (sólo el nombre)'))

    plan, viejos, ocultos = [], [], 0
    poder = {}                       # los servidores donde el bot no puede tocar apodos
    for sv, gid in GUILDS:
        for did, m in miembros[sv].items():
            actual = m.get('nick') or ''
            p = PZ.get(did)
            if not p and not (actual and AP.solo_nuestras(actual, siglas)):
                continue
            # 👑 al dueño de un servidor Discord no le deja cambiar el apodo a nadie, y su 403 en el PRIMER intento de un
            # servidor lo daba por «el bot no puede cambiar apodos acá» y salteaba a todos los demás (ver `poder`)
            if did == duenos.get(gid):
                continue
            # 🔴 LA PRECEDENCIA, EN UN SOLO LUGAR (`estilo_de()`): lo de la persona gana; si no eligió, el servidor; si
            # tampoco, el 1 (el #N y la crew). Y QUÉ SE PONE, en otro (`decidir()`): a quien no lleva marca se le SACAN
            # las nuestras —si sólo se lo salteara, la marca vieja le quedaría para siempre— y a quien no tiene apodo no
            # se le pone uno
            est = estilo_de(did, gid, globales, eleccion, por_servidor)
            nuevo = decidir(actual, p, est, nombre_de(did), siglas)
            if (nuevo or '') == actual:
                continue
            if est == AP.SOLO_NOMBRE:
                ocultos += 1
            if not p:
                viejos.append((sv, actual, (m.get('user') or {}).get('username')))
            plan.append({'guild': gid, 'sv': sv, 'id': did, 'antes': actual, 'nuevo': nuevo, 'estilo': est,
                         'oculto': est == AP.SOLO_NOMBRE, 'sin_numero': not p,
                         'user': (m.get('user') or {}).get('username')})

    print('\n  ✅ apodos a cambiar: %d   ·   con «solo el nombre» (elegido o del servidor): %d'
          % (len(plan), ocultos))
    for c in [x for x in plan if not x.get('sin_numero')][:45]:
        print('     [%s] %-24s -> %-26s estilo %d'
              % (c['sv'], (c['antes'] or '(sin apodo)')[:24], (c['nuevo'] or '(sin apodo)')[:26], c['estilo']))
    if len(plan) > 45:
        print('     … y %d mas' % (len(plan) - 45))
    print('  ✂️  llevan una marca de la Liga y ya no tienen con qué: se les saca: %d' % len(viejos))
    for sv, ap, u in viejos[:30]:
        print('     [%s] %-24s @%s' % (sv, ap[:24], u))
    if len(viejos) > 30:
        print('     … y %d mas' % (len(viejos) - 30))
    if sin_id:
        print('  ❔ en el ranking pero sin Discord ID: %d' % len(sin_id))
        print('     %s' % ', '.join(sin_id[:18]))

    if '--aplicar' not in sys.argv and '--ciclo' not in sys.argv:
        print('\n  (nada cambiado — corré con --aplicar)\n')
        return
    publicar_piezas(PZ, siglas, {d: nombre_de(d) for d in PZ})
    if not plan:
        print('\n  ✅ nada que cambiar\n')
        return

    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, 'apodos_%s.json' % time.strftime('%Y%m%d_%H%M'))
    json.dump({'cuando': time.strftime('%Y-%m-%d %H:%M'), 'cambios': plan},
              io.open(p, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
    print('\n  respaldo -> %s' % os.path.relpath(p, BASE))

    ok, fallos = 0, []
    pudo = {}
    t0 = time.time()
    for i, c in enumerate(plan):
        # ⏱️ EN EL CICLO, CON PRESUPUESTO (17/11/2026). Cuando entra alguien arriba (Over en el #6) se corren cientos de
        # números a la vez: 351 apodos son 7 minutos, el trabajo `escuchar` se pasó de sus 20 y se cortó DOS veces sin
        # guardar nada —ni la web, ni los resultados, ni las notas—. Un apodo que tarda media hora más no importa; una
        # corrida que no guarda, sí. Lo que falta se pone en la próxima (el plan se rearma solo)
        if '--ciclo' in sys.argv and time.time() - t0 > PRESUPUESTO_CICLO:
            print('   ⏱️ se acabó el tiempo de este paso (%d s): quedan %d para la próxima corrida' % (PRESUPUESTO_CICLO, len(plan) - i))
            break
        # ⚠️ UN SERVIDOR QUE NO DEJA (FFS: el bot no puede cambiar apodos) se
        # intenta una vez y se saltea entero, no cien
        if poder.get(c['guild']) is False:
            fallos.append((c['sv'], c['user'], 'el bot no puede cambiar apodos ahí'))
            continue
        bien, err = poner_apodo(s, c['guild'], c['id'], c['nuevo'])
        # 🔴 POR SERVIDOR, NO POR CORRIDA (17/11/2026): era `and not ok`, o sea «si todavía no cambió NINGÚN apodo en toda
        # la corrida». Con DRA primero, `ok` ya era > 0 y CH, DDS y CEU se intentaban de a uno: 269 «403» por corrida,
        # 270–620 intentos cada media hora, y la de las 4:22 PM se pasó de los 20 minutos y se cortó sin guardar nada.
        # Un servidor donde ya se cambió alguno sí sigue: ahí un 403 es la jerarquía de roles de UNA persona
        if not bien and err.startswith('403') and 'Missing Permissions' in err and not pudo.get(c['guild']):
            poder[c['guild']] = False
        if bien:
            pudo[c['guild']] = True
            ok += 1
            if ok % 25 == 0:
                print('   %d de %d...' % (ok, len(plan)))
        else:
            fallos.append((c['sv'], c['user'], err))
        time.sleep(0.4)
    print('\n  ✅ apodos puestos: %d de %d' % (ok, len(plan)))
    for sv, u, e in fallos:
        print('     ⚠️ [%s] %-20s %s' % (sv, u, e))
    print('')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
