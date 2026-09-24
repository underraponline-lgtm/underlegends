# -*- coding: utf-8 -*-
"""DE QUE PAIS ES CADA UNO, SEGUN SU ROL EN DISCORD. La regla de Dlx.

    python sheet/pais_por_rol.py            que cambiaria, NO escribe
    python sheet/pais_por_rol.py --aplicar  corrige la columna `Pais`
    python sheet/pais_por_rol.py --todos    tambien los que ya coinciden

🔴 LA REGLA, TAL COMO LA DIJO DLX (21/09/2026)

    «Si hay 2 nacionalidades y una de ellas es USA pues gana USA. Ahora
    en si el sheet deberia ser cambiado basado en el rol q tenga los
    servidores, pero dando prioridad a DRA.»

O sea, en orden:

    1. si alguna de las dos es **USA**, gana USA
    2. si no, manda el **rol de pais en DRA**
    3. si no esta en DRA o no tiene rol, queda la columna `Pais`

⚠️ **POR QUE EL ROL Y NO EL EMOJI DEL NOMBRE.** El emoji viaja pegado al
nombre y lo escribe la persona; el rol se lo da el servidor. Es el mismo
criterio que ya uso `bot/cartas_nuevas.py` para el servidor: *«estar en
un servidor es un hecho que Discord sabe; deducirlo de los puntos era
adivinar»*.

CORRIDO EL 21/09/2026 SOBRE LAS 28 CONTRADICCIONES: NO CAMBIA NINGUNA
---------------------------------------------------------------------
    19   el rol de DRA CONFIRMA la columna
     0   el rol difiere de la columna
     2   hay un USA en juego, y la columna ya dice `us`
     7   no esta en DRA o no tiene rol -> queda la columna

O sea que la columna `Pais` **ya cumple las dos reglas** y no habia nada
que arreglar. Esto existe igual por dos motivos: para poder volver a
contestarlo cuando entre gente nueva, y porque **la regla tenia que
quedar en el codigo y no en la cabeza de alguien** — es la primera
leccion escrita en `CLAUDE.md`.

🔴 ACA DECIA «DRA NO TIENE ROL DE USA» Y ERA FALSO. Lo tiene:
`🔵﹒U.S.`. Lo que pasaba es que **faltaba en la tabla `ROLES`**, junto
con `Costa R.` y `Puerto R.` — los tres abreviados con punto, o sea que
quien armo la lista busco nombres completos y estos tres no matchearon.
DRA tiene **21** roles de pais y la tabla tenia 18.

⚠️ **UN HUECO EN LA TABLA SE HABIA ESCRITO COMO UN HECHO SOBRE EL
SERVIDOR.** Y no es un detalle de redaccion: la regla 1 de Dlx —«si hay
dos y una es USA, gana USA»— quedo documentada como imposible de
cumplir, cuando lo unico que faltaba era una linea. Lo encontro el por
haber dicho «fijate bien»; leyendo el archivo no aparece, porque el
archivo afirmaba lo contrario con total seguridad.

⚠️ Por eso `verificar_roles()` compara la tabla contra la API y avisa si
DRA tiene un rol de pais que no esta. Una tabla de 18 paises se ve
completa.
"""
import json
import os
import sys
import time

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)
sys.path.insert(0, os.path.join(BASE, 'bot'))
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

import requests                                          # noqa: E402

# Los 18 roles de pais de DRA, leidos de su API el 21/09/2026.
# ⚠️ Van los ID y no los nombres: un rol se renombra —«🔵﹒Chile» a
# «Chile»— y el ID no cambia. Buscar por nombre se rompe en silencio.
ROLES = {
    '843368716846759958': 'pe', '843689607703035956': 'ec',
    '843689607078215691': 'co', '843368724793917451': 'ar',
    '843846193746018315': 'bo', '843689611791564812': 'cl',
    '843689608088125520': 've', '843689606104481794': 'es',
    '843689611615928330': 'mx', '843846196300349490': 'hn',
    '843846217510551622': 'gt', '843847085685342269': 'uy',
    '843846218563977277': 'ni', '1509052769410220096': 'br',
    '843847238740213760': 'sv', '843846221243744257': 'cu',
    '843689610642718741': 'pa', '843847088072556554': 'py',
    # 🔴 ESTOS TRES FALTABAN, Y LOS TRES ESTAN ABREVIADOS CON PUNTO.
    # Dlx, 21/09: *«DRA si tiene rol de USA. Fijate bien»*. Lo tiene, y
    # la tabla decia 18 cuando DRA tiene **21** roles de pais: quien la
    # armo busco nombres completos y `U.S.`, `Costa R.` y `Puerto R.` no
    # matchearon.
    #
    # ⚠️ NO FALLABA, CALLABA. Una tabla de 18 paises se ve completa, y
    # los que tenian uno de estos tres roles quedaban «sin rol en DRA» y
    # se caian a la columna del Sheet.
    #
    # ⚠️ Y ESTE ERA EL PEOR DE LOS TRES QUE FALTABA. El encabezado de
    # este mismo archivo afirmaba que «DRA NO TIENE ROL DE USA, asi que
    # la regla 1 no se puede resolver por rol» — o sea que un hueco en la
    # tabla se habia escrito como si fuera un hecho sobre el servidor, y
    # la regla que Dlx puso PRIMERA quedo documentada como imposible.
    '843846195168018433': 'us',   # 🔵﹒U.S.
    '843846220135923732': 'cr',   # 🔴﹒Costa R.
    '847499144108441640': 'pr',   # ⚪﹒Puerto R.
    '843846221181091870': 'do',   # ⚪﹒Republica D.
}
# ⚠️ SON CUATRO Y LOS CUATRO ESTAN ABREVIADOS CON PUNTO. Al tercero lo
# encontre buscando «U.S.» y al cuarto recien cuando deje de adivinar la
# forma del nombre y liste los roles que NO estaban en la tabla. La
# abreviatura es el patron: `U.S.`, `Costa R.`, `Puerto R.`,
# `Republica D.` — ninguno matchea el nombre completo del pais.


def verificar_roles():
    """Roles de pais que DRA tiene y `ROLES` no. Lista de (id, nombre).

    🔴 EXISTE PORQUE LA TABLA SE QUEDO CORTA Y NADIE SE ENTERO. Tenia 18
    de los 21, y los tres que faltaban —`U.S.`, `Costa R.`, `Puerto R.`—
    son justamente los abreviados con punto: quien la armo busco nombres
    completos. Los que tenian uno de esos roles quedaban «sin rol en
    DRA» y se caian a la columna del Sheet, sin un error que mirar.

    🔴 NO DECIDE: LISTA CANDIDATOS. Y eso es a proposito, porque intente
    decidir dos veces y me equivoque las dos:

      · primero por «nombre de pais completo» — asi se perdieron los
        cuatro abreviados con punto
      · despues por la FORMA del nombre, con un regex de circulo+`﹒`.
        Ese regex tenia el codepoint equivocado (U+FE50 en vez de
        U+FE52) y matcheaba **cero** roles: devolvia «no falta ninguno»
        sin haber mirado nada. **Un chequeo que no puede fallar no es un
        chequeo**, y fue la segunda vez en el dia que escribi uno asi.

    Con el separador correcto son 37 roles y 16 no son paises —
    `Productor`, `Freestyler`, `Inactivo`—, o sea que tampoco alcanza
    como firma. **No hay forma confiable**, y una lista de paises tiene
    el mismo problema que causo todo esto: la que se escriba hoy no va a
    tener el pais que agreguen mañana.

    Asi que devuelve los roles que comparten el estilo de DRA y **no
    estan en la tabla**, para que una persona mire. Son 16 nombres: se
    leen de un vistazo, y este chequeo habria encontrado los cuatro.
    """
    h = {'Authorization': 'Bot ' + _token()}
    with open(os.path.join(BASE, 'datos', 'servidores.json'),
              encoding='utf-8') as f:
        guild = json.load(f)['servidores']['DRA']['guild_id']
    r = requests.get('https://discord.com/api/v10/guilds/%s/roles' % guild,
                     headers=h, timeout=60)
    if r.status_code != 200:
        raise IOError('%s: %s' % (r.status_code, r.text[:120]))
    # U+FE52, SMALL FULL STOP: el separador que DRA usa en sus roles.
    # Sacado de la API, no escrito de memoria — ver arriba.
    SEP = '﹒'
    return [(x['id'], x['name']) for x in r.json()
            if SEP in x['name'] and x['id'] not in ROLES]


def _token():
    from desplegar import entorno
    t = entorno().get('DISCORD_TOKEN')
    if not t:
        sys.exit('falta DISCORD_TOKEN en .env')
    return t


def roles_de_dra():
    """{discord_id: [iso, ...]} de los miembros de DRA.

    ⚠️ EN BLOQUE, mil por llamada: la lista de miembros trae los roles
    adentro de cada uno, asi que son tres llamadas y no 2.700. Es lo
    mismo que hace `bot/fotos.py` con los avatares.
    """
    h = {'Authorization': 'Bot ' + _token()}
    with open(os.path.join(BASE, 'datos', 'servidores.json'),
              encoding='utf-8') as f:
        guild = json.load(f)['servidores']['DRA']['guild_id']
    out, after = {}, None
    while True:
        u = ('https://discord.com/api/v10/guilds/%s/members?limit=1000'
             % guild)
        if after:
            u += '&after=' + after
        r = requests.get(u, headers=h, timeout=60)
        if r.status_code != 200:
            raise IOError('%s: %s' % (r.status_code, r.text[:120]))
        b = r.json()
        if not b:
            break
        for m in b:
            out[m['user']['id']] = [ROLES[x] for x in m.get('roles', [])
                                    if x in ROLES]
        after = b[-1]['user']['id']
        if len(b) < 1000:
            break
        time.sleep(0.3)
    return out


import re as _re                                         # noqa: E402

_BANDERA = _re.compile('([\U0001F1E6-\U0001F1FF]{2})')


# Los paises que el proyecto sabe dibujar. Sale de los archivos, no de
# una lista escrita: `04_Pais/banderas/` ES la respuesta a «existe ese
# pais para nosotros».
def _conocidos():
    d = os.path.join(BASE, '04_Pais', 'banderas')
    try:
        return {os.path.splitext(f)[0].lower()
                for f in os.listdir(d) if f.endswith('.png')}
    except OSError:
        return set()


# ⚠️ BANDERAS MAL TIPEADAS QUE SE CORRIGEN POR EL TEXTO DEL ROL. Ver
# `_iso_del_nombre`: el rol de España de LIVONIA es `⌜🇪🇦⌟╢España` — usa
# 🇪🇦 (E+A, Ceuta y Melilla) en vez de 🇪🇸. La bandera esta mal y el texto
# esta bien, asi que el texto gana.
_POR_TEXTO = (
    ('espa', 'es'), ('spain', 'es'), ('argentin', 'ar'), ('chile', 'cl'),
    ('colombi', 'co'), ('ecuador', 'ec'), ('méxic', 'mx'),
    ('mexic', 'mx'), ('venezuel', 've'), ('perú', 'pe'), ('peru', 'pe'),
    ('uruguay', 'uy'), ('bolivia', 'bo'), ('paraguay', 'py'),
    ('panam', 'pa'), ('guatemal', 'gt'), ('honduras', 'hn'),
    ('nicaragua', 'ni'), ('salvador', 'sv'), ('costa', 'cr'), ('cuba', 'cu'),
    ('puerto', 'pr'), ('dominic', 'do'), ('republica d', 'do'),
    ('estados', 'us'), ('u.s', 'us'), ('usa', 'us'), ('brasil', 'br'),
    ('brazil', 'br'),
)


def _iso_del_nombre(nombre):
    """`🇻🇪 ⬌ VENEZUELA` -> 've'. None si no se puede saber.

    🔴 LA BANDERA NO SIEMPRE ES LA DEL PAIS QUE DICE EL TEXTO. El rol de
    España de LIVONIA es `⌜🇪🇦⌟╢España`: **🇪🇦 es Ceuta y Melilla**, no
    España. Alguien escribio E+A en vez de E+S.

    ⚠️ Y ESO NO FALLABA, PRODUCIA UN PAIS QUE NO EXISTE. Derivando solo de
    la bandera, las **61 personas** con ese rol quedaban en `ea` — un
    codigo que no esta en `04_Pais/banderas/`, asi que su carta de Pais
    saldria sin bandera. Hoy no se nota porque este script solo toca
    contradicciones y no llena huecos; el dia que los llene, se notaria
    en 61 cartas a la vez.

    Por eso el resultado **se valida contra los paises que el proyecto
    sabe dibujar**, y si la bandera da uno que no existe, manda el texto
    del nombre del rol.
    """
    m = _BANDERA.search(nombre or '')
    cc = None
    if m:
        cc = ''.join(chr(ord(c) - 0x1F1E6 + ord('A'))
                     for c in m.group(1)).lower()
    conocidos = _conocidos()
    if cc and (not conocidos or cc in conocidos):
        return cc
    # la bandera falta o no es un pais que sepamos dibujar: probar el texto
    bajo = (nombre or '').lower()
    for pedazo, iso in _POR_TEXTO:
        if pedazo in bajo:
            return iso
    return None


def roles_de_otros():
    """{servidor: {discord_id: [iso, ...]}} de FFA y LIVONIA.

    ⚠️ ACA EL MAPA SE DERIVA DE LA BANDERA Y EN DRA VA POR ID, y la
    diferencia no es capricho: los roles de DRA se llaman `🔴﹒Perú` —con
    un circulo de color, no una bandera— asi que no hay de donde sacar el
    pais salvo una tabla a mano. Los de FFA y LIVONIA si llevan la
    bandera (`🇻🇪 ⬌ 𝐕𝐄𝐍𝐄𝐙𝐔𝐄𝐋𝐀`), que es un identificador mejor que el
    texto porque no depende del idioma ni de la tipografia.

    ⚠️ Y SE IMPRIME CUANTOS ROLES SALIERON DE CADA UNO. Si alguien le
    saca la bandera al nombre de un rol, este mapa lo pierde en silencio;
    ver el numero bajar es la unica forma de enterarse.
    """
    h = {'Authorization': 'Bot ' + _token()}
    with open(os.path.join(BASE, 'datos', 'servidores.json'),
              encoding='utf-8') as f:
        d = json.load(f)
    quiero = {}
    for g, k in (('servidores', 'FFA'), ('solo_identidad', 'LIVONIA')):
        v = (d.get(g) or {}).get(k)
        if v and v.get('guild_id'):
            quiero[k] = v['guild_id']

    out = {}
    for nom, guild in quiero.items():
        r = requests.get('https://discord.com/api/v10/guilds/%s/roles' % guild,
                         headers=h, timeout=60)
        if r.status_code != 200:
            print('   ⚠️ %s: no pude leer los roles (%s)' % (nom, r.status_code))
            continue
        mapa = {}
        for x in r.json():
            c = _iso_del_nombre(x['name'])
            if c:
                mapa[x['id']] = c
        if not mapa:
            print('   ⚠️ %s: ningún rol con bandera en el nombre' % nom)
            continue
        gente, after = {}, None
        while True:
            u = ('https://discord.com/api/v10/guilds/%s/members?limit=1000'
                 % guild)
            if after:
                u += '&after=' + after
            rr = requests.get(u, headers=h, timeout=60)
            if rr.status_code != 200:
                break
            b = rr.json()
            if not b:
                break
            for m in b:
                cs = sorted({mapa[x] for x in m.get('roles', []) if x in mapa})
                if cs:
                    gente[m['user']['id']] = cs
            after = b[-1]['user']['id']
            if len(b) < 1000:
                break
        print('   %-8s %2d roles de país · %4d con país' % (nom, len(mapa),
                                                            len(gente)))
        out[nom] = gente
    return out


def decidir(columna, emoji, rol, otros=()):
    """(pais, por_que) segun la regla. `rol` son los de DRA, `otros` el resto.

    🔴 «LOS SERVIDORES», EN PLURAL, Y ANTES ERA SOLO DRA. Dlx dijo *«el
    sheet deberia ser cambiado basado en el rol q tenga los servidores,
    pero dando prioridad a DRA»* y esto leia **unicamente** DRA. Es la
    forma que este repo documenta tres veces: la decision estaba tomada
    y el codigo implementaba la mitad.

    Medido el 21/09/2026 leyendo tambien FFA y LIVONIA:

        FFA      10 roles de pais ·  246 miembros con pais
        LIVONIA  21 roles de pais ·  677 miembros con pais
        del padron reciben pais de ahi          169
        de esos, HOY SIN PAIS                     8   <- ganancia neta
        con USA entre varios                      2

    ⚠️ **Y ESOS DOS SON JUSTO LA REGLA 1, QUE HOY NO PUEDE DISPARARSE.**
    Este archivo ya lo decia: *«DRA NO TIENE ROL DE USA, asi que la regla
    1 no se puede resolver por rol»*. **LIVONIA y FFA si lo tienen.** O
    sea que la regla que Dlx escribio primero era la unica sin forma de
    cumplirse, y la arregla mirar los otros servidores.

    ⚠️ LIVONIA ES `solo_identidad` Y ESO NO LO EXCLUYE: sus eventos no
    cuentan para la Liga, pero su rol de pais es exactamente lo que ese
    servidor esta ahi para dar — *«sacar Discord ID y banderas»*.

    El orden: USA gana · DRA manda · despues los otros · al final la
    columna.
    """
    # 1 · USA gana, venga de donde venga
    todos = set(rol) | {c for v in (otros or {}).values() for c in v}
    if 'us' in (columna, emoji) or 'us' in todos:
        return 'us', 'regla USA'
    # 2 · el rol de DRA
    if len(rol) == 1:
        return rol[0], 'rol de DRA'
    if len(rol) > 1:
        # ⚠️ NO SE ELIGE UNO: dos roles de pais es una contradiccion en
        # Discord, no un empate que este script pueda romper.
        return None, 'tiene %d roles de país: %s' % (len(rol), '/'.join(rol))
    # 3 · los otros servidores, con DRA ausente
    sueltos = {c for v in (otros or {}).values() for c in v}
    if len(sueltos) == 1:
        de = ', '.join(sorted(k for k, v in (otros or {}).items() if v))
        return sueltos.pop(), 'rol de %s' % de
    if len(sueltos) > 1:
        return None, ('%d países entre los otros servidores: %s'
                      % (len(sueltos), '/'.join(sorted(sueltos))))
    # 4 · queda lo que hay
    return columna, 'sin rol en ningún servidor'


def main():
    aplicar = '--aplicar' in sys.argv
    todos = '--todos' in sys.argv
    from padron import contradicciones

    print('\n══ EL PAÍS, SEGÚN EL ROL DE LOS SERVIDORES ══\n')
    print('   1· gana USA  ·  2· el rol de DRA  ·  3· los otros  '
          '·  4· la columna\n')
    try:
        mi = roles_de_dra()
    except Exception as e:                               # noqa: BLE001
        print('   🔴 no pude leer los miembros de DRA: %s\n' % str(e)[:80])
        return 1
    con = sum(1 for v in mi.values() if v)
    print('   DRA      %2d roles de país · %4d con país' % (len(ROLES), con))
    # ⚠️ QUE LA TABLA NO SE HAYA QUEDADO CORTA. Ver `verificar_roles()`:
    # ya pasó, con los tres roles abreviados con punto, y no dio error.
    try:
        faltan = verificar_roles()
        if faltan:
            print('   ⚠️ %d rol(es) de DRA con el estilo de los de país y '
                  'fuera de la tabla.' % len(faltan))
            print('      ¿Alguno es un país? Los cuatro que faltaban estaban '
                  'abreviados con punto:')
            print('      %s' % ' · '.join(n for _, n in faltan)[:150])
            print('      Si alguno lo es, va a ROLES o esa gente cae a la '
                  'columna.')
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ no pude comprobar la tabla de roles: %s' % str(e)[:50])
    # ⚠️ SI LOS OTROS FALLAN, NO SE CAE: DRA es la fuente principal y el
    # resto suma. Quedarse sin país por un 500 de Discord en un servidor
    # secundario seria peor que no mirarlo.
    try:
        otros = roles_de_otros()
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ no pude leer FFA/LIVONIA (%s): sigo con DRA sola'
              % str(e)[:50])
        otros = {}
    print('')

    c = contradicciones()
    cambios, iguales, dudosos = [], 0, []
    for x in c:
        rol = mi.get(x['discord_id'], []) if x['discord_id'] else []
        suyos = {}
        if x['discord_id']:
            for sv, gente in otros.items():
                v = gente.get(x['discord_id'])
                if v:
                    suyos[sv] = v
        nuevo, por = decidir(x['columna'], x['emoji'], rol, suyos)
        if nuevo is None:
            dudosos.append((x['nombre'], por))
            continue
        if nuevo == x['columna']:
            iguales += 1
            if todos:
                print('      %-14s %s   (%s)' % (x['nombre'][:14], nuevo, por))
        else:
            cambios.append((x['nombre'], x['columna'], nuevo, por))

    print('   %d de %d ya están bien' % (iguales, len(c)))
    if dudosos:
        print('\n   ⚠️ %d con más de un rol de país (no los toco):' % len(dudosos))
        for n, p in dudosos:
            print('      %-14s %s' % (n[:14], p))
    if not cambios:
        print('\n   ✅ ningún cambio: la columna `País` ya cumple la regla.\n')
        return 0

    print('\n   %d para cambiar:' % len(cambios))
    for n, a, b, p in cambios:
        print('      %-14s %s -> %s   (%s)' % (n[:14], a, b, p))
    if not aplicar:
        print('\n   (simulacro: no escribí nada — corré con --aplicar)\n')
        return 0
    print('\n   ⚠️ escribir la columna `País` del padrón todavía no está')
    print('      implementado: hoy no hace falta (0 cambios) y un escritor')
    print('      sin caso de prueba es uno que nadie verificó.\n')
    return 1


if __name__ == '__main__':
    sys.exit(main())
