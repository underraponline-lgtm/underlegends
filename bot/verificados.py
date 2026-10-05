# -*- coding: utf-8 -*-
"""QUIEN PUEDE TENER CARTA. El porton de identidad, en un solo lugar.

    python bot/verificados.py            mide y reescribe datos/verificados.json
    python bot/verificados.py --ver      solo mide, no escribe
    python bot/verificados.py --auto     el self-check

🔴 DLX, 19/09 Y 22/09/2026, LA MISMA REGLA DICHA DOS VECES:

    «para alguien tener tarjeta necesita estar si o si en DRA, estar
     verificado y con ID tambien, aparte de los requisitos q ya tiene»

    «el requisito para tener una tarjeta, cualquier tarjeta, es estar
     verificado en DRA — o sea ID y bandera»

O sea que para pasar el portón hacen falta TRES cosas, y ninguna es de
rendimiento:

    1. `discord_id` cargado en el padron
    2. pais (bandera) en el padron
    3. el rol **Miembro** de DRA, que es lo que se da al verificarse

🔑 Y DESDE EL 29/09/2026 EL PORTÓN YA NO ES PARA TODAS LAS CARTAS. Dlx,
con el número delante —de los 185 que jugaron tenían carta 79; así, 147—:
*«Dale»*. **La Temporada y la Servidor son de todos los que jugaron y están
en la Lista**, verificados o no; la Competitiva, la de País y las que vengan
siguen pidiendo las tres. Lo contesta `puede(persona, verificados, carta)`;
`pasa()` sigue siendo «verificado en DRA» para todo lo que no es una carta
(el número oficial del ranking, las crews, la cuenta de la portada).

⚠️ ESTO NO ES UN REQUISITO DE CARTA Y POR ESO NO VIVE EN
`comun/requisitos.py`. Alla se mide **desempeño**, que sale del Sheet y
se contesta con un numero sin pedirle nada a nadie. Esto se le pregunta
a **Discord**, y mezclarlos obligaria a aquel modulo a tener red y un
token para contestar lo que hoy contesta con una resta.

🔴 Y HASTA HOY ESTABA MEDIDO Y NO LO APLICABA NADIE.
`herramientas/en_dra.py` lo calcula desde el 19/09 y ahi muere: imprime
el numero y nadie lo lee. `docs/sheet_t1.md` dice que el pool de la T1
se filtra asi. El resultado, medido el 22/09:

    cartas en R2 hoy          469 personas
    las que pasan el porton   319

o sea **150 personas con carta que no deberian tenerla**. Un requisito
que se mide y no se aplica no es un requisito: es una estadistica.

⚠️ LO QUE PASA CON ESAS 150 YA ESTA RESUELTO EN EL BOT. Al salir de KV,
`/card` cae en la rama de «todavia no estas» y manda el mensaje con los
dos botones —entrar a DRA y verificarse—, que es exactamente lo que
Dlx pidio. No hay nada que escribir de ese lado.

POR QUE UN ARCHIVO Y NO UNA CONSULTA
-------------------------------------
⚠️ LA LISTA DE MIEMBROS DE DRA SON 2.712 PERSONAS Y TRES LLAMADAS. Si
cada paso que necesita saber quien esta verificado se lo pregunta a
Discord, el ciclo hace eso una vez por paso y depende de que Discord
conteste para poder dibujar. Se pregunta **una vez por corrida** y lo
demas lee `datos/verificados.json`.

⚠️ Y SI DISCORD NO CONTESTA, SE USA EL ANTERIOR. Un corte de Discord no
puede sacarle la carta a 319 personas: eso seria convertir una falla
ajena en un cambio de datos. El archivo viejo sigue siendo la mejor
respuesta disponible, y el que lo lee se entera de cuando se escribio.
"""
import io
import json
import os
import sys
import time

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)
sys.path.insert(0, os.path.join(BASE, 'sheet'))
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

import requests                                          # noqa: E402

SALIDA = os.path.join(BASE, 'datos', 'verificados.json')

# 🔴 EL ROL «MIEMBRO» DE DRA, que es el que se da al verificarse. Dlx
# lo paso el 19/09: *«tener el rol de 1101257512273055745 en DRA»*.
#
# 🔴 Y SÓLO ESE. Dlx, 24/09/2026: *«El rol de verificado es miembro en DRA
# únicamente»*. Ese mismo día se probó sumar el `Miembro 🐍` de Snake Rap
# —se había leído «autoverificar» como «que su rol también verifique»— y
# se sacó a las pocas horas. De Snake Rap, como de FFA, se saca el ID y
# nada más: ver `herramientas/cruzar_miembros.py`.
ROL_MIEMBRO = '1101257512273055745'
GUILD_DRA = '841017460341604382'


def _env(clave):
    for l in io.open(os.path.join(BASE, '.env'), encoding='utf-8'):
        if l.strip().startswith(clave + '='):
            return l.split('=', 1)[1].strip().strip('"\'')
    sys.exit('falta %s en .env' % clave)


def _miembros(s):
    """{discord_id: [roles]} de DRA, paginado.

    ⚠️ EL CURSOR VA POR `int` Y NO POR TEXTO. Los snowflakes tienen 17,
    18 y 19 digitos y `max()` sobre cadenas compara alfabeticamente: asi
    '999…' (18) le gana a '1000…' (19), que es mayor de verdad, y el
    cursor **retrocede**. Esta medido en `herramientas/roles_rango.py`.
    """
    out, after = {}, '0'
    while True:
        r = s.get('https://discord.com/api/v10/guilds/%s/members' % GUILD_DRA,
                  params={'limit': 1000, 'after': after}, timeout=40)
        if r.status_code == 429:
            time.sleep(float(r.json().get('retry_after', 1)) + .3)
            continue
        if r.status_code != 200:
            raise RuntimeError('no pude listar DRA: %s %s'
                               % (r.status_code, r.text[:120]))
        lote = r.json()
        if not lote:
            break
        for m in lote:
            did = (m.get('user') or {}).get('id')
            if did:
                out[did] = m.get('roles') or []
        after = max(((m.get('user') or {}).get('id', '0') for m in lote),
                    key=int)
        if len(lote) < 1000:
            break
        time.sleep(0.25)
    return out


#: `{discord_id: ...}` de quien pidio salir. `None` = todavia no se leyo.
#: Se cachea porque `pasa()` se llama una vez por persona por paso.
olvidados_cache = None


def _olvidados():
    global olvidados_cache
    if olvidados_cache is None:
        try:
            with io.open(os.path.join(BASE, 'datos', 'olvidados.json'),
                         encoding='utf-8') as f:
                olvidados_cache = json.load(f).get('gente') or {}
        except (OSError, ValueError):
            olvidados_cache = {}
    return olvidados_cache


def pasa(persona, verificados):
    """¿Esta persona puede tener carta? Las tres condiciones, y el olvido.

    `persona` es una fila del padron y `verificados` el conjunto de
    Discord ID con el rol Miembro.

    🔴 EL OLVIDO SE PREGUNTA ACA Y NO EN CADA PASO. Son cinco los que
    llaman a esta funcion —el ciclo, el sello, KV, la Servidor y
    `verificar.py`— y el dia que sean seis, el sexto lo hereda. Un
    borrado que hay que acordarse de respetar en cada lugar nuevo es un
    borrado que dura hasta el proximo lugar nuevo.

    ⚠️ Y VA **ANTES** DE LAS TRES CONDICIONES a proposito. Quien pidio
    salir puede seguir teniendo ID, pais y el rol: nada de eso se le
    toca —sacarle el pais del padron le romperia la fila a la Liga, que
    es otra cosa— asi que si se preguntara despues, pasaria igual. Ver
    `bot/olvidar.py`.
    """
    did = str(persona.get('discord_id') or '')
    if did and did in _olvidados():
        return False
    return bool(did) and bool((persona.get('pais') or '').strip()) \
        and did in verificados


# 🔑 DLX, 29/09/2026, 4:46 PM ET: «Dale», con el número delante —de los 185
# que jugaron tenían carta 79, y con esto 147—. LA TEMPORADA Y LA SERVIDOR
# SON DE TODOS LOS QUE JUGARON Y ESTÁN EN LA LISTA, verificados o no. La
# Competitiva, la de País y las que vengan (Prime, Histórica) siguen pidiendo
# el portón entero.
#
# ⚠️ «JUGARON» NO SE PREGUNTA ACÁ: lo pone cada carta con su requisito
# (`comun/requisitos.py` — la Temporada pide 1 participación y la Servidor
# sale del servidor donde más jugaste). Esto contesta sólo la identidad.
LIBRES = ('temporada', 'servidor')

#: Los nombres que no reciben las LIBRES aunque estén en la Lista: los de
#: `no_verificar` (BNA, baneado; los de broma; las identidades sin confirmar)
#: y los trolls de `decidir.no_rankear()`. Es la misma lista que saltea
#: `bot/autoverificar.py`: a quien no se verifica tampoco se le regala carta.
#: `None` = todavía no se leyó.
intocables_cache = None


def _intocables():
    global intocables_cache
    if intocables_cache is None:
        out = set()
        try:
            import construir_padron as _PAD
            with io.open(os.path.join(BASE, 'datos', 'identidades.json'), encoding='utf-8') as f:
                out |= {_PAD.norm(k) for k in (json.load(f).get('no_verificar') or {})}
            try:
                import decidir as _DEC
                out |= {_PAD.norm(x) for x in _DEC.no_rankear()}
            except Exception:                            # noqa: BLE001
                pass
        except (OSError, ValueError, ImportError):
            pass
        intocables_cache = out
    return intocables_cache


#: 🔑 LA CUENTA DE DLX (la misma `DUENO` de `bot/avisos.js`): fuera de las reglas de quién tiene carta. Dlx,
#: 05/10/2026, a «sin verificarse, ninguna tarjeta»: *«dale. pero a mí no porque así pruebo las cosas»*
DUENO = '739338101603696681'
#: `datos/conservan.json` y `datos/pase_niveles.json`, leídos una vez. `None` = todavía no se leyó
conservan_cache = None
niveles_cache = None


def _conservan():
    """`{carta: set(claves)}` de quien conserva su carta con la regla de antes, o `{}` si ya pasó su fecha.

    Dlx, 05/10/2026: «B» —quien ya tiene su Temporada (y su Servidor) la conserva; lo nuevo va con la regla nueva—.
    Es una foto de ese día (`datos/conservan.json`) y vale hasta el arranque de la T1, cuando todas vuelven a cero.
    """
    global conservan_cache
    if conservan_cache is None:
        conservan_cache = {}
        try:
            import datetime as _dt
            with io.open(os.path.join(BASE, 'datos', 'conservan.json'), encoding='utf-8') as f:
                d = json.load(f) or {}
            hasta = d.get('hasta') or ''
            if hasta and _dt.datetime.now(_dt.timezone.utc) < _dt.datetime.fromisoformat(hasta):
                conservan_cache = {c: set(d.get(c) or ()) for c in ('temporada', 'servidor')}
        except (OSError, ValueError):
            conservan_cache = {}
    return conservan_cache


def nivel_pase(did):
    """El nivel de alguien en el Pase de la temporada (`datos/pase_niveles.json`, lo trae `bot/pase.py`), o 0."""
    global niveles_cache
    if niveles_cache is None:
        niveles_cache = {}
        try:
            with io.open(os.path.join(BASE, 'datos', 'pase_niveles.json'), encoding='utf-8') as f:
                d = json.load(f) or {}
            # 🔴 SÓLO LOS DEL PASE DE ESTA TEMPORADA (revisión del 05/10/2026): el día que arranca la T1, hasta que el
            # ciclo traiga los nuevos, el archivo todavía dice los de la prueba, y esos no ganan la Temporada de la T1
            temp = str(d.get('temp') or '')
            try:
                import multiplicadores as _MU
                esperada = str(_MU.temporada_actual() or '')
            except Exception:                            # noqa: BLE001
                esperada = temp
            if temp and temp.lower() == esperada.lower():
                niveles_cache = d.get('niveles') or {}
        except (OSError, ValueError):
            niveles_cache = {}
    return int(niveles_cache.get(str(did or ''), 0) or 0)


def puede(persona, verificados, carta):
    """¿Esta persona puede tener ESA carta? (`persona` es una fila del padrón)

    🔑 DESDE EL 05/10/2026 (Dlx: «C», «1. dale», «3. A», «4. nivel 1», «B»):
    - **sin verificarse, ninguna**: la Servidor pide el portón (verificarse en la página te mete en DRA), y la
      Temporada, el portón y **el nivel 1 del Pase** —es su recompensa— (`nivel_pase()`). Quien llega sin haber
      jugado la recibe con «—» y se llena con su primer evento.
    - **quien ya las tenía las conserva** hasta la T1 (`_conservan()`).
    - **Dlx, fuera de todas** (`DUENO`): así prueba las cosas.
    - La Competitiva y la de País, como siempre: el portón (y sus requisitos, en `comun/requisitos.py`).
    Esto reemplaza a «las LIBRES» del 29/09/2026 (Temporada y Servidor para todos los que jugaron, verificados o no).

    ⚠️ `pasa()` NO CAMBIA Y POR ESO ESTO ES OTRA FUNCIÓN. «Verificado en DRA»
    lo siguen preguntando el número oficial del ranking, las crews, la cuenta
    de verificados de la portada y la Competitiva: si `pasa()` se abriera,
    todos ellos se abrirían con ella sin que nadie lo decidiera.

    ⚠️ EL OLVIDO VALE PARA TODAS: quien pidió salir no tiene ninguna.
    """
    did = str(persona.get('discord_id') or '')
    if did and did in _olvidados():
        return False
    nombre = (persona.get('raw') or persona.get('full') or '').strip()
    if did and did == DUENO and nombre:
        return True
    if carta in LIBRES and nombre:
        try:
            import construir_padron as _PAD
            k = _PAD.norm(nombre)
            if k in _intocables():
                return False
            if k in _conservan().get(carta, ()):
                return True
        except ImportError:
            pass
    if carta == 'temporada':
        return pasa(persona, verificados) and nivel_pase(did) >= 1
    return pasa(persona, verificados)


def cartas_de(persona, verificados, todas=('temporada', 'competitivo', 'servidor', 'pais')):
    """Las cartas que esta persona puede tener, en el orden dado."""
    return [c for c in todas if puede(persona, verificados, c)]


def cargar():
    """`(conjunto de discord_id, cuando se escribio)`. `(None, '')` si no hay.

    🔴 DEVUELVE `None` Y NO UN CONJUNTO VACIO CUANDO EL ARCHIVO NO ESTA,
    y la diferencia es todo. Un conjunto vacio quiere decir «nadie esta
    verificado» y dejaria a **las 319 sin carta**; `None` quiere decir
    «no se», y quien lo lee tiene que decidir qué hacer con eso — que
    es no filtrar.
    """
    try:
        with io.open(SALIDA, encoding='utf-8') as f:
            d = json.load(f)
        return set(d.get('ids') or ()), d.get('cuando') or ''
    except (OSError, ValueError):
        return None, ''


def por_nombre():
    """`f(nombre) -> bool`: ¿quien se llama así pasa el portón? `None` si no se sabe.

    🔑 UN SOLO LUGAR PARA «ES MIEMBRO». Lo preguntan la página (qué
    tarjeta se muestra), las vitrinas del Sheet y los dos pools (quién
    lleva número), y el nombre se normaliza igual que el padrón
    (`construir_padron.norm`). Si cada uno lo armara por su lado, el día
    que uno cambie la normalización la página diría «#3» y la carta «—».

    ⚠️ `None` NO ES «NADIE», igual que `cargar()`: sin el archivo no se
    sabe quién es miembro, y el que pregunta no filtra.
    """
    ids, _c = cargar()
    if ids is None:
        return None
    try:
        import construir_padron as _PAD
    except ImportError:
        sys.path.insert(0, os.path.join(BASE, 'sheet'))
        import construir_padron as _PAD
    pasan = {_PAD.norm(x['raw']) for x in _PAD.cargar()
             if x.get('raw') and pasa(x, ids)}
    return lambda nombre: _PAD.norm(nombre or '') in pasan


def numerar(nombres, oficial):
    """El puesto oficial de cada uno, en el orden dado: `[1, 2, None, 3, …]`.

    🔑 «FUERA DE CONCURSO» (Dlx, 27/09/2026): nadie desaparece del
    ranking, pero **el número es de los miembros** —*«tampoco quiero
    desaparecer a todos del ranking»* y, a la propuesta, *«me gusta la
    idea»*—. Quien no pasa el portón queda en su lugar por mérito, sin
    número (`None`), y los miembros se numeran seguido: si Velatz (#3 por
    puntos) no es miembro, PichulaMc pasa a ser el #3.

    ⚠️ LAS CUENTAS NO SE TOCAN: el OVR y el Score se siguen calculando con
    todos. Esto sólo decide quién lleva número.

    ⚠️ `oficial=None` (no se sabe quién es miembro) numera a todos, como
    antes: sin el dato no se le saca el puesto a nadie.
    """
    out, n = [], 0
    for x in nombres:
        if oficial is None or oficial(x):
            n += 1
            out.append(n)
        else:
            out.append(None)
    return out


def guardar(ids, miembros=0):
    """Escribe el archivo con ese conjunto de IDs.

    🔴 SEPARADA DE `refrescar()` PARA PODER DESHACER. El ciclo compara el
    conjunto nuevo contra el de ayer y, si cayo mas de un 20 %, vuelve a
    escribir el viejo — el mismo guardian que ya tienen el padron y los
    pools, por el mismo motivo: si Discord devuelve una pagina
    incompleta, el porton **no falla**, se cierra sobre gente que si esta
    verificada y deja de emitirle carta. Sin una forma de volver atras,
    detectarlo seria avisar de un daño ya hecho.
    """
    ids = sorted(ids)
    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    with io.open(SALIDA, 'w', encoding='utf-8') as f:
        json.dump({'guild': GUILD_DRA, 'rol': ROL_MIEMBRO,
                   'cuando': time.strftime('%Y-%m-%dT%H:%M:%S+00:00',
                                           time.gmtime()),
                   'miembros': miembros or len(ids), 'ids': ids},
                  f, ensure_ascii=False, indent=1)
    return set(ids)


def refrescar(s=None):
    """Le pregunta a Discord y reescribe el archivo. `(conjunto, miembros)`."""
    if s is None:
        s = requests.Session()
        s.headers['Authorization'] = 'Bot ' + _env('DISCORD_TOKEN')
    ms = _miembros(s)
    ids = sorted(d for d, roles in ms.items() if ROL_MIEMBRO in roles)
    guardar(ids, len(ms))
    return set(ids), len(ms)


def _self_check():
    """Que las tres condiciones sean tres, y que falte una alcance."""
    mal = 0
    print('\n══ EL PORTON DE IDENTIDAD ══\n')
    ver = {'111', '222'}
    casos = [
        ('las tres', {'discord_id': '111', 'pais': 'Argentina'}, True),
        ('sin bandera', {'discord_id': '111', 'pais': ''}, False),
        ('sin ID', {'discord_id': '', 'pais': 'Argentina'}, False),
        # 🔴 EL CASO QUE SEPARA ESTE PORTON DE «tener los datos
        # cargados»: la persona esta entera en el padron y **no esta
        # verificada en DRA**. Si esto pasara, el porton no seria un
        # porton, seria una comprobacion de que el padron esta lleno.
        ('todo cargado pero sin el rol de DRA',
         {'discord_id': '999', 'pais': 'Chile'}, False),
        ('sin nada', {}, False),
    ]
    for que, p, esp in casos:
        ok = pasa(p, ver) == esp
        mal += not ok
        print('   %s %-38s -> %s'
              % ('✅' if ok else '🔴', que,
                 'tiene carta' if pasa(p, ver) else 'no'))

    # 🔴 EL OLVIDO, QUE ES LA CUARTA CONDICION Y LA UNICA QUE NO SE
    # MIDE CONTRA DISCORD. Se prueba acá y no en `olvidar.py` porque el
    # que puede perderla es **este** archivo: si alguien reescribe
    # `pasa()` mirando solo las tres de arriba, el borrado deja de
    # durar y nada falla — la persona vuelve a tener carta en una hora.
    global olvidados_cache
    guardo_c = olvidados_cache
    entero = {'discord_id': '111', 'pais': 'Argentina'}
    olvidados_cache = {}
    antes = pasa(entero, ver)
    olvidados_cache = {'111': {'quien': 'x'}}
    despues = pasa(entero, ver)
    olvidados_cache = guardo_c
    ok = antes and not despues
    mal += not ok
    print('   %s %-38s -> %s'
          % ('✅' if ok else '🔴', 'el que pidió salir, con las tres',
             'no' if not despues else '🔴 TIENE CARTA IGUAL'))

    # 🔑 DESDE EL 05/10/2026 (Dlx: «C», «B», «a mí no»): sin verificarse ninguna, salvo quien las conserva hasta la
    # T1; la Temporada pide además el nivel 1 del Pase; Dlx, fuera de todas. Y el olvido, para todas. Con las cachés
    # armadas acá y no con los archivos de verdad, que cambian todos los días
    print('')
    global conservan_cache, niveles_cache
    guardo_cv, guardo_nv = conservan_cache, niveles_cache
    conservan_cache = {'temporada': {'oasis'}, 'servidor': {'oasis'}}
    niveles_cache = {'111': 1}
    oasis = {'raw': 'Oasis', 'discord_id': '979', 'pais': 'Chile'}   # en la Lista, sin el rol de DRA: conserva
    nuevo = {'raw': 'Nuevo', 'discord_id': '980', 'pais': 'Chile'}   # sin el rol y sin nada que conservar
    h = {'raw': 'H', 'discord_id': '111', 'pais': 'Argentina'}       # verificado, nivel 1 en el Pase
    m = {'raw': 'M', 'discord_id': '222', 'pais': 'Argentina'}       # verificado, sin nivel
    dlx = {'raw': 'DLX', 'discord_id': DUENO, 'pais': ''}            # sin rol ni país: igual tiene las cuatro
    libres = [
        ('sin verificar, las conserva: Temporada', oasis, 'temporada', True),
        ('sin verificar, las conserva: Servidor', oasis, 'servidor', True),
        ('sin verificar, las conserva: Competitiva', oasis, 'competitivo', False),
        ('sin verificar y nuevo: Temporada', nuevo, 'temporada', False),
        ('sin verificar y nuevo: Servidor', nuevo, 'servidor', False),
        ('sin ID ni país, pero en la Lista: Temporada', {'raw': 'Kip'}, 'temporada', False),
        ('fuera de la Lista: Temporada', {}, 'temporada', False),
        ('verificado con nivel 1: Temporada', h, 'temporada', True),
        ('verificado sin nivel: Temporada', m, 'temporada', False),
        ('verificado sin nivel: Servidor', m, 'servidor', True),
        ('verificado: Competitiva', h, 'competitivo', True),
        ('Dlx, sin rol ni país: Competitiva', dlx, 'competitivo', True),
    ]
    for que, p, carta, esp in libres:
        ok = puede(p, ver, carta) == esp
        mal += not ok
        print('   %s %-44s -> %s' % ('✅' if ok else '🔴', que, 'la tiene' if puede(p, ver, carta) else 'no'))
    conservan_cache, niveles_cache = guardo_cv, guardo_nv
    guardo_c = olvidados_cache
    olvidados_cache = {'979': {'quien': 'x'}}
    ok = not puede(oasis, ver, 'temporada')
    olvidados_cache = guardo_c
    mal += not ok
    print('   %s %-44s -> %s' % ('✅' if ok else '🔴', 'el que pidió salir: Temporada', 'no' if ok else '🔴 LA TIENE'))
    # los de `no_verificar` (BNA, baneado) tampoco reciben las libres
    global intocables_cache
    guardo_i = intocables_cache
    intocables_cache = {'bna'}
    ok = not puede({'raw': 'BNA', 'discord_id': '5', 'pais': 'Chile'}, ver, 'temporada')
    intocables_cache = guardo_i
    mal += not ok
    print('   %s %-44s -> %s' % ('✅' if ok else '🔴', 'el baneado (no_verificar): Temporada', 'no' if ok else '🔴 LA TIENE'))

    # ⚠️ `cargar()` SIN ARCHIVO TIENE QUE DAR `None`, NO UN CONJUNTO
    # VACIO. Vacio significaria «nadie verificado» y dejaria a las 319
    # sin carta; `None` significa «no se» y el que lee no filtra.
    global SALIDA
    guardo, SALIDA = SALIDA, os.path.join(BASE, 'datos', '_no_existe_.json')
    try:
        ids, _c = cargar()
        ok = ids is None
        mal += not ok
        print('\n   %s sin archivo, `cargar()` da None y no un conjunto vacío'
              % ('✅' if ok else '🔴'))
    finally:
        SALIDA = guardo

    # 🔑 «FUERA DE CONCURSO»: los miembros se numeran seguido y el resto
    # queda en su lugar sin número; sin saber quién es miembro, todos numeran
    es = {'Hassan', 'Makmah', 'PichulaMc'}.__contains__
    orden = ['Hassan', 'Makmah', 'Velatz', 'PichulaMc']
    ok = numerar(orden, es) == [1, 2, None, 3]
    mal += not ok
    print('\n   %s fuera de concurso: Velatz sin número, PichulaMc #3  %s'
          % ('✅' if ok else '🔴', numerar(orden, es)))
    ok = numerar(orden, None) == [1, 2, 3, 4]
    mal += not ok
    print('   %s sin saber quién es miembro, numeran todos' % ('✅' if ok else '🔴'))

    ids, cuando = cargar()
    if ids is None:
        print('   ⚠️ SIN DATOS PARA MEDIR: todavía no se corrió '
              '`bot/verificados.py`')
    else:
        print('   ·  el archivo de hoy: %d verificados (%s)'
              % (len(ids), cuando[:16]))
    print('')
    return mal


def main():
    if '--auto' in sys.argv:
        return 1 if _self_check() else 0

    import construir_padron as PAD
    print('\n══ QUIEN PUEDE TENER CARTA ══\n')
    if '--ver' in sys.argv:
        ids, cuando = cargar()
        if ids is None:
            print('   no hay `datos/verificados.json` todavía\n')
            return 1
        print('   del archivo del %s: %d verificados' % (cuando[:16], len(ids)))
    else:
        ids, cuantos = refrescar()
        print('   DRA: %d miembros · %d con el rol Miembro' % (cuantos, len(ids)))
        print('   -> %s' % os.path.relpath(SALIDA, BASE))

    g = PAD.cargar()
    con = [x for x in g if pasa(x, ids)]
    print('\n   sobre el padrón de %d:' % len(g))
    for que, n in (
        ('con Discord ID', sum(1 for x in g if x.get('discord_id'))),
        ('con bandera', sum(1 for x in g if (x.get('pais') or '').strip())),
        ('con el rol Miembro',
         sum(1 for x in g if str(x.get('discord_id') or '') in ids)),
    ):
        print('     %-22s %4d' % (que, n))
    print('     %-22s %4d   ← pueden tener carta' % ('LAS TRES', len(con)))
    print('')
    return 0


if __name__ == '__main__':
    sys.exit(main())
