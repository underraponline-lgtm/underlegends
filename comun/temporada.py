# -*- coding: utf-8 -*-
"""EN QUE TEMPORADA ESTAMOS. Un solo lugar.

    from comun.temporada import ACTUAL, carpeta_fotos
    ACTUAL            # 't1'
    carpeta_fotos()   # .../comun/fotos/t1

POR QUE ES UN MODULO Y NO UNA CONSTANTE SUELTA
----------------------------------------------
🔴 Porque este repo ya se comio tres veces la misma forma en un dia: **la
decision existe en un lado y el codigo la lee de otro**. La temporada va a
aparecer en la ruta de las fotos, en el nombre del Sheet, en las claves de
KV y en la carta Historica; escrita cuatro veces, el dia que arranque la T2
alguna se va a quedar en 't1' y **no va a avisar** — va a salir una carta
valida con la cara de la temporada pasada.

⚠️ CAMBIAR ESTO NO BORRA NADA, Y ESA ES LA GRACIA. Las fotos de la T1 viven
en `fotos/t1/` y ahi se quedan cuando esto diga `t2`. Es lo que quiere decir
«congelada por temporada»: la Historica necesita la cara que cada uno tenia
en cada temporada, no la ultima.
"""
import os

SCR = os.path.dirname(os.path.abspath(__file__))

# 🔴 EL UNICO LUGAR. Al arrancar la T2 se cambia aca y nada mas.
ACTUAL = 't1'

# 🔴 DESDE CUANDO CUENTA ESTA TEMPORADA. Es la hora del reset del
# 22/09/2026, en UTC.
#
# ⚠️ SIN ESTO EL RESET SE DESHACE SOLO, y en la primera corrida. Los
# canales de llaves de Discord siguen teniendo las **25 llaves de la
# pre-temporada** —la mas nueva es del 21/09— y el lector las detecta
# igual de bien que a una nueva. El dia que `llaves_a_entrada.py`
# empiece a escribir, esas 25 entran a `Entrada`, se procesan y
# **repueblan las hojas que se acaban de vaciar**. No falla: al
# contrario, funciona perfecto y deja la T1 arrancando con los datos
# que se borraron a proposito.
#
# ⚠️ ES LA FECHA DE **PUBLICACION** DEL MENSAJE, no la de su ultima
# edicion. El 96 % de las llaves se edita despues —a veces dias— asi
# que una llave de la pre editada hoy seguiria siendo de la pre. Es la
# misma razon por la que `_ddmm()` usa `timestamp`.
INICIO = '2026-09-22T00:00:00+00:00'

# Las temporadas que existieron, en orden. La pre-temporada NO esta: Dlx,
# 16/09/2026, «esa info sera borrada e inutilizada, era info de prueba».
TODAS = ('t1',)


# 🔴 EL SELLO QUE VA IMPRESO EN LA CARTA, al costado. Dlx: *«la de
# temporada y competitiva se pueden sacar de PRE, pero ese PRE sera T1
# cuando empiece la nueva temporada»*.
#
# ⚠️ ESTABA ESCRITO A MANO EN **CUATRO** ARCHIVOS —`normal_v3.py`,
# `gencomp.py`, `todos_sv.py` y `maqueta.py`— y los cuatro decian en su
# comentario *«un solo lugar para cambiarlo»*. Eran cuatro lugares, y
# el dia del reset las cuatro cartas siguieron diciendo **PRE** con la
# T1 ya empezada. No fallaba: imprimia la temporada equivocada.
#
# Ahora sale de `ACTUAL`, que es el unico lugar donde la temporada vive
# de verdad.
SELLO = ACTUAL.upper()


def carpeta_fotos(cual=None):
    """Donde vive el espejo local de las fotos de esa temporada.

    ⚠️ ES UN CACHE, NO LA FUENTE. La fuente es R2 (`fotos/<temporada>/`), que
    es donde la foto queda congelada de verdad. Esta carpeta esta en
    `.gitignore` a proposito: son 10,4 MB de fotos de personas reales y
    meterlas en el historial de git las vuelve permanentes, tambien para
    quien despues se vaya. Se llena con `python bot/fotos.py --espejo`.
    """
    return os.path.join(SCR, 'fotos', cual or ACTUAL)


def sal_fotos():
    """El tramo impredecible de la ruta de las fotos. `''` si no está puesto.

    🔴 POR QUE EXISTE. El bucket de R2 es **público** —tiene que serlo: las
    cartas se muestran en Discord y Discord las trae él mismo desde su
    proxy— y hasta el 22/09/2026 la foto de cada uno vivía en
    `fotos/t1/<clave>.webp`. O sea que **sabiendo el nombre de alguien se
    bajaba su cara**, desde cualquier lado, sin credenciales.

    ⚠️ LO QUE ESTÁ MAL NO ES QUE LA CARA SE VEA. Es su avatar de Discord:
    cualquiera del servidor lo ve. Lo que agregaba R2 es **permanencia y
    enlazabilidad** — una copia fuera de contexto, hotlinkeable, que
    sobrevive a que la persona se vaya. Es exactamente lo que `CLAUDE.md`
    no quiso para git: *«el historial las volvería permanentes, también
    para quien después se vaya»*.

    ⚠️ Y ALCANZA CON QUE LA CLAVE NO SE ADIVINE, porque el bucket **no se
    puede enumerar**: medido el 22/09, pedir `/`, `/fotos/` o
    `/fotos/t1/` devuelve 404. Sin listado y sin clave adivinable no hay
    por dónde entrar. Por eso no hace falta un bucket aparte — que
    significaría infraestructura nueva y un segundo lugar donde las
    credenciales se desincronizan.

    ⚠️ LAS CARTAS NO LLEVAN SAL, a propósito. Se comparten en Discord: que
    su URL sea adivinable es el costo de que el bot funcione, y lo que
    muestran —puesto y país— es lo que la persona va a publicar igual.
    La cara no.
    """
    v = os.environ.get('FOTOS_SAL', '').strip()
    if v:
        return v
    # ⚠️ El `.env` no está cargado en todos los llamadores, así que se lee
    # del archivo si hace falta. Sin él se devuelve '' y la ruta queda como
    # la vieja: eso mantiene andando a quien todavía no tiene el valor, en
    # vez de escribir en una carpeta equivocada y perder las fotos.
    p = os.path.join(os.path.dirname(SCR), '.env')
    try:
        with open(p, encoding='utf-8') as f:
            for l in f:
                if l.startswith('FOTOS_SAL='):
                    return l.split('=', 1)[1].strip()
    except OSError:
        pass
    return ''


def carpeta_r2(cual=None):
    """El prefijo de R2 donde viven las fotos de esa temporada."""
    s = sal_fotos()
    return 'fotos/%s%s/' % ((s + '-') if s else '', cual or ACTUAL)


def clave_foto(nombre, cual=None):
    """La clave de R2 de la foto de esa persona en esa temporada."""
    return '%s%s.webp' % (carpeta_r2(cual), nombre)


def _self_check():
    """Que la temporada diga lo mismo en los tres lugares donde vive.

    🔴 CAMBIAR `ACTUAL` NO ROMPE NADA HOY Y ROMPE TODO MAÑANA, y por eso
    hace falta preguntarlo. El dia que esto diga `t2`:

      · `carpeta_fotos()` y `clave_foto()` apuntan a `fotos/t2/`, que
        **va a estar vacio** hasta que se corra `bot/fotos.py`
      · `comun/respaldo.py` busca la cara ahi, no la encuentra, y cae a
        la inicial — en las 138 cartas, sin un solo error
      · el Worker sirve `fotos/t2/<quien>.webp`, que da 404

    Nada de eso falla: sale una carta valida con la inicial gigante. Es
    exactamente el bug que este proyecto ya se comio con los avatares y
    que costo 93 de 112 cartas.

    ⚠️ Y EL BINDING DEL WORKER ES EL QUE MAS FACIL SE OLVIDA. Vive en
    Cloudflare, no en el repo: `bot/desplegar.py` lo inyecta al
    desplegar, asi que cambiar `ACTUAL` **y no volver a desplegar** deja
    al bot pidiendo la temporada vieja mientras las cartas se dibujan
    con la nueva. El Worker tiene un default de `'t1'` —para que un
    deploy viejo sin binding no escriba en `fotos/undefined/`— y ese
    default es justo lo que hace silencioso el olvido.
    """
    import json
    print('LA TEMPORADA\n')
    print('  ACTUAL       %s' % ACTUAL)
    print('  TODAS        %s' % ', '.join(TODAS))
    mal = 0

    if ACTUAL not in TODAS:
        print('  🔴 ACTUAL no está en TODAS: la Histórica no la va a ver')
        mal += 1

    carp = carpeta_fotos()
    n = len(os.listdir(carp)) if os.path.isdir(carp) else 0
    print('  espejo local %s  (%d foto(s))'
          % (os.path.relpath(carp, os.path.dirname(SCR)), n))
    if not n:
        # no es un fallo: esta gitignoreado y en un clone limpio no esta
        print('               ⚠️ vacío — se llena con '
              '`python bot/fotos.py --espejo`')

    # 🔴 R2 ES LA FUENTE: si ahi no hay fotos de ESTA temporada, las
    # cartas salen con la inicial y nada avisa.
    try:
        raiz = os.path.dirname(SCR)
        import sys as _s
        _s.path.insert(0, os.path.join(raiz, 'bot'))
        import requests
        import fotos as _F
        s = requests.Session()
        s.headers['Authorization'] = 'Bearer ' + _F.env('CLOUDFLARE_API_TOKEN')
        hay = _F.ya_en_r2(s)
        # 🔴 EL PREFIJO SALE DE `carpeta_r2()`. Armarlo a mano aca dio
        # «R2 no tiene NINGUNA foto de esta temporada» el dia que se
        # agrego la sal — con las 443 arriba. Tercer lugar donde pasa
        # lo mismo en una hora: por eso hay UNA funcion.
        mias = [k for k in hay if k.startswith(carpeta_r2())]
        otras = len(hay) - len(mias)
        print('  en R2        %d foto(s) en %s  (%d de otras '
              'temporadas)' % (len(mias), carpeta_r2(), otras))
        if not mias:
            print('  🔴 R2 no tiene NINGUNA foto en %s: las ' % carpeta_r2() +
                  'cartas\n     saldrían con la inicial, sin fallar. '
                  'Corré `python bot/fotos.py --bajar`.')
            mal += 1
    except Exception as e:                               # noqa: BLE001
        print('  ·  R2: no pude preguntar (%s)' % str(e)[:44])

    # 🔴 EL BINDING DEL WORKER, QUE VIVE EN CLOUDFLARE Y NO EN EL REPO.
    #
    # ⚠️ LA CUENTA SE PREGUNTA, NO SE LEE DEL .env: no hay ninguna clave
    # de cuenta ahi —`desplegar.py` la saca de `GET /accounts`— y buscar
    # una que no existe daba `None`, con eso una URL invalida y un 404
    # que se leia como «el Worker no tiene el binding».
    visto_worker = False
    try:
        import desplegar as _D
        tok = _D.entorno().get('CLOUDFLARE_API_TOKEN')
        s2 = requests.Session()
        s2.headers['Authorization'] = 'Bearer ' + tok
        API = 'https://api.cloudflare.com/client/v4'
        ctas = (s2.get('%s/accounts' % API, timeout=30).json()
                .get('result') or [])
        cta = ctas[0]['id'] if ctas else None
        r = s2.get('%s/accounts/%s/workers/scripts/%s/settings'
                   % (API, cta, _D.NOMBRE), timeout=30)
        if r.status_code == 200:
            bind = {b.get('name'): b.get('text')
                    for b in (r.json().get('result') or {}).get('bindings', [])}
            suya = bind.get('TEMPORADA')
            visto_worker = True
            igual = suya == ACTUAL
            print('  el Worker    TEMPORADA=%s  %s'
                  % (suya or '(sin binding)', '✅' if igual else '🔴'))
            if not igual:
                print('  🔴 el bot pide la temporada %r y las cartas se '
                      'dibujan\n     con %r. Volvé a desplegar: '
                      '`python bot/desplegar.py`' % (suya or 't1', ACTUAL))
                mal += 1
        else:
            print('  ·  el Worker: no pude leer sus bindings (%s)'
                  % r.status_code)
    except Exception as e:                               # noqa: BLE001
        print('  ·  el Worker: no pude preguntar (%s)' % str(e)[:44])

    print('')
    if mal:
        return mal
    # ⚠️ SE DICE SOLO LO QUE SE COMPROBO. La primera version cerraba con
    # «dice lo mismo en el repo, en R2 y en el bot» aunque la consulta al
    # Worker hubiera fallado — o sea afirmando lo que no habia mirado,
    # que es el mismo error que este chequeo existe para encontrar.
    if visto_worker:
        print('  ✅ la temporada dice lo mismo en el repo, en R2 y en el bot')
    else:
        print('  ✅ el repo y R2 coinciden')
        print('  ⚠️ al Worker no se le pudo preguntar: su binding queda '
              'sin comprobar')
    return 0


if __name__ == '__main__':
    import sys
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    sys.exit(1 if _self_check() else 0)
