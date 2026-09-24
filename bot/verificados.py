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

O sea que para tener **cualquier** carta hacen falta TRES cosas, y
ninguna es de rendimiento:

    1. `discord_id` cargado en el padron
    2. pais (bandera) en el padron
    3. el rol **Miembro** de DRA, que es lo que se da al verificarse

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
