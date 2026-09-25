"""DESPLIEGA EL WORKER SIN WRANGLER.

    python bot/desplegar.py            sube worker.js + avisos.js y deja la URL lista
    python bot/desplegar.py --ver      solo mira el estado, no toca nada

⚠️ **POR QUE NO USA WRANGLER.** Wrangler pide **Node 22** y en esta maquina hay
**18**. Pero wrangler no hace magia: por debajo le manda un `PUT` con el script
a la API de Cloudflare, y eso se puede hacer con el Python que ya esta
instalado. El resultado es el mismo Worker.

Cuando Node suba a 22, `npx wrangler deploy` y esto quedan equivalentes; este
archivo se puede seguir usando o borrar.

⚠️ **EL TOKEN VA EN `.env`, QUE ESTA IGNORADO.** Es un token de Cloudflare
acotado a **Workers Scripts** y **R2** — no toca dominios, ni DNS, ni
facturacion — y se revoca desde My Profile -> API Tokens.

⚠️ **LA PUBLIC KEY NO ES UN SECRETO Y VA COMO `plain_text`.** Es la clave
publica de la app de Discord: **verifica** firmas, no puede firmar. Discord se
la muestra a cualquiera. Si algun dia entra un valor que SI sea secreto, va
como `secret_text`, no aca.
"""
import io
import json
import os
import re
import sys

try:
    import requests
except ImportError:
    sys.exit('falta requests:  pip install requests')

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
API = 'https://api.cloudflare.com/client/v4'

NOMBRE = 'liga-global-bot'
# El namespace de KV donde `bot/subir_datos.py` escribe una clave por persona.
BUCKET_R2 = 'cartas'

KV_ID = 'a87399a3a0b647b0803aa90509ccce56'
# La fecha de compatibilidad congela el comportamiento del runtime. Se elige
# una vez y no se mueve sola: si cambiara con cada deploy, el Worker podria
# comportarse distinto sin que nadie haya tocado el codigo.
COMPAT = '2026-09-16'

#: los módulos del Worker. `worker.js` es el principal: Cloudflare busca ahí
#: las clases de los Durable Objects, y por eso re-exporta `Avisos`.
MODULOS = ('worker.js', 'avisos.js')

#: 🔑 LAS MIGRACIONES DE DURABLE OBJECTS, EN ORDEN Y PARA SIEMPRE. Una clase
#: con estado no se crea, se MIGRA: Cloudflare guarda en qué etiqueta está
#: el Worker y sólo acepta los pasos que faltan. Mandar `v1` otra vez
#: cuando ya está es un error; no mandarlo la primera vez, también. Por eso
#: se pregunta la etiqueta de arriba en cada deploy — ver `migracion()`.
#:
#: ⚠️ NUNCA SE BORRA UN PASO DE ACA. Para cambiar algo se agrega uno nuevo
#: al final (`v2`, …). Y `new_sqlite_classes`, no `new_classes`: el plan
#: gratis sólo tiene Durable Objects con SQLite.
MIGRACIONES = [('v1', {'new_sqlite_classes': ['Avisos']})]


# La temporada sale de un solo lugar; ver el binding de abajo.
sys.path.insert(0, os.path.dirname(SCR))
from comun.temporada import ACTUAL as TEMPORADA  # noqa: E402
from comun.temporada import sal_fotos as _sal  # noqa: E402
SAL_FOTOS = _sal()

def entorno():
    env = dict(os.environ)
    p = os.path.join(BASE, '.env')
    if os.path.exists(p):
        with io.open(p, encoding='utf-8') as f:
            for linea in f:
                linea = linea.strip()
                if not linea or linea.startswith('#') or '=' not in linea:
                    continue
                k, v = linea.split('=', 1)
                env[k.strip()] = v.strip().strip('"\'')
    return env


def pedir(sesion, metodo, ruta, **kw):
    r = sesion.request(metodo, API + ruta, **kw)
    try:
        j = r.json()
    except Exception:
        sys.exit('Cloudflare contesto algo que no es JSON (%d):\n%s'
                 % (r.status_code, r.text[:400]))
    if not j.get('success'):
        print('\n⚠️  %s %s -> %d' % (metodo, ruta, r.status_code))
        for e in j.get('errors') or []:
            print('    [%s] %s' % (e.get('code'), e.get('message')))
            # El mensaje de Cloudflare para un token mal armado no dice que le
            # falta un permiso: dice "authentication error" y nada mas.
            if e.get('code') in (10000, 9109):
                print('    -> suele ser el token: revisa que tenga '
                      'Workers Scripts · Edit')
        sys.exit(1)
    return j['result']


def main():
    solo_ver = '--ver' in sys.argv
    env = entorno()
    token = env.get('CLOUDFLARE_API_TOKEN')
    clave = env.get('DISCORD_PUBLIC_KEY')
    if not token:
        sys.exit('falta CLOUDFLARE_API_TOKEN en .env')
    if not clave:
        sys.exit('falta DISCORD_PUBLIC_KEY en .env')

    s = requests.Session()
    s.headers['Authorization'] = 'Bearer ' + token

    cuentas = pedir(s, 'GET', '/accounts')
    if not cuentas:
        sys.exit('el token no ve ninguna cuenta')
    cuenta = cuentas[0]
    cid = cuenta['id']
    print('cuenta:  %s' % cuenta['name'])

    # El subdominio *.workers.dev se elige UNA vez por cuenta, y el nombre es
    # una decision de Dlx: queda en la URL publica del bot. Por eso esto avisa
    # en vez de inventarlo.
    sub = pedir(s, 'GET', '/accounts/%s/workers/subdomain' % cid)
    nombre_sub = (sub or {}).get('subdomain')
    if not nombre_sub:
        print('\n⚠️  La cuenta todavia no tiene subdominio *.workers.dev.')
        print('    Se elige una sola vez y queda en la URL publica del bot,')
        print('    asi que lo elegis vos: en el panel, Compute -> Workers,')
        print('    la primera vez te lo pide.')
        sys.exit(1)
    url = 'https://%s.%s.workers.dev' % (NOMBRE, nombre_sub)
    print('url:     %s' % url)

    if solo_ver:
        ver_vivo(url)
        ver_igual(s, cid)
        ver_servidores()
        return

    # ⚠️ ANTES DE SUBIR, NO DESPUES. Ver ver_servidores().
    ver_servidores()

    meta = {
        'main_module': 'worker.js',
        'compatibility_date': COMPAT,
        'bindings': [
            {'type': 'plain_text', 'name': 'DISCORD_PUBLIC_KEY', 'text': clave},
            # ⚠️ SIN ESTE BINDING, `env.KV` es undefined y el Worker revienta
            # en la primera lectura — pero recien cuando alguien usa /card, no
            # al desplegar. El despliegue diria 200 igual.
            {'type': 'kv_namespace', 'name': 'KV', 'namespace_id': KV_ID},
            # 🔴 R2, PARA QUE `/foto` PUEDA GUARDAR. Sin este binding el
            # comando contesta «todavia no esta enchufado» en vez de fallar
            # adentro del waitUntil, donde el error no lo ve nadie.
            {'type': 'r2_bucket', 'name': 'CARTAS', 'bucket_name': BUCKET_R2},
            # 🔴 LA TEMPORADA, SACADA DE `comun/temporada.py`. Es la regla que
            # este repo documenta tres veces: la decision en un lugar y el
            # codigo leyendola de ahi. Escrita tambien en worker.js, el dia
            # que arranque la T2 una de las dos se queda vieja **sin avisar**
            # y las fotos se guardan en la carpeta equivocada.
            {'type': 'plain_text', 'name': 'TEMPORADA', 'text': TEMPORADA},
            # 🔴 LA SAL DE LA RUTA DE LAS FOTOS. Sale del mismo lugar que
            # la temporada —`comun/temporada.py`— porque el Worker escribe
            # la foto cuando alguien usa `/foto` y tiene que dar con la
            # MISMA ruta que usa el pipeline al leerlas. Si las dos no
            # coinciden, la foto se guarda donde nadie la busca y la carta
            # sale con la inicial sin que nada falle.
            {'type': 'plain_text', 'name': 'FOTOS_SAL', 'text': SAL_FOTOS},
        ],
    }

    # 🔔 LOS AVISOS DE EVENTOS: el Durable Object y las claves VAPID.
    # Ver `bot/avisos.js`. El objeto guarda las suscripciones y lo ya
    # avisado en SQLite —no en KV, que tiene 1.000 escrituras por día para
    # toda la cuenta— y las claves firman y cifran cada notificación.
    meta['bindings'].append({'type': 'durable_object_namespace',
                             'name': 'AVISOS', 'class_name': 'Avisos'})
    vpub, vpriv = env.get('VAPID_PUBLICA'), env.get('VAPID_PRIVADA')
    if vpub and vpriv:
        meta['bindings'] += [
            {'type': 'plain_text', 'name': 'VAPID_PUBLICA', 'text': vpub},
            {'type': 'secret_text', 'name': 'VAPID_PRIVADA', 'text': vpriv},
        ]
        print('  · VAPID: los avisos firman y cifran')
    else:
        # 🔴 MISMA TRAMPA QUE EL GH_TOKEN, PERO PEOR: sin la privada el
        # Worker no puede firmar, y las suscripciones están atadas a ESA
        # pública. Un deploy desde una máquina sin `.env` completo dejaría a
        # todos sin avisos sin que nada falle a la vista.
        if 'VAPID_PRIVADA' in _nombres_arriba(s, cid):
            print('\n  🔴 EL WORKER TIENE VAPID_PRIVADA Y ESTE DEPLOY SE LA SACA.')
            print('     Las suscripciones quedan atadas a esa clave: sin ella,')
            print('     nadie vuelve a recibir un aviso. Está en ACCESOS.md (5c).')
            return 1
        print('  ⚠️ sin VAPID en .env: la campana no se puede activar')
        print('     (python bot/avisos_claves.py las crea, una sola vez)')
    mig = migracion(s, cid)
    if mig:
        meta['migrations'] = mig
        print('  · migración de Durable Objects -> %s' % mig['new_tag'])

    # ⚠️ EL TOKEN DEL BOT VA COMO `secret_text`, NUNCA COMO `plain_text`.
    # Un `plain_text` se lee entero desde el panel y desde la API; un
    # `secret_text` se escribe y no se vuelve a leer.
    #
    # Dlx, 19/09/2026: «no es a proposito, yo te los di para que lo guardes
    # hasta que terminemos todo esto y ahi si lo reiniciamos el token». O sea
    # que el «cero secretos en el borde» que dice CLAUDE.bot.md describia el
    # estado de ese dia, no una regla: lo que SI es regla es que el token se
    # rota al final. Con el token adentro, `/numeral` cambia el apodo al
    # instante en vez de esperar a la proxima corrida del sincronizador.
    #
    # ⚠️ ES OPCIONAL A PROPOSITO. Si no esta en .env el Worker igual anda:
    # `/numeral` guarda la preferencia y avisa que se aplica despues. Asi el
    # dia que el token se rote y todavia no este cargado, nada se rompe.
    # 🔴 EL DISPARADOR DEL CICLO, PORQUE EL CRON DE GITHUB NO DISPARA.
    # Medido el 24/09/2026: de las ranuras horarias que estaban LIBRES,
    # `schedule` en Actions disparo el **11 %**. Es best effort y GitHub lo
    # descarta bajo carga; no se arregla desde adentro. Un Cron Trigger de
    # Cloudflare si es puntual y entra en el plan gratis.
    #
    # ⚠️ EL TOKEN VA COMO `secret_text`, igual que el de Discord: abre los
    # repos, asi que no puede leerse desde el panel.
    #
    # ⚠️ Y ES OPCIONAL A PROPOSITO. Sin el, el Worker sigue contestando
    # `/card` igual y el ciclo queda con el cron de GitHub solo — que es
    # exactamente el estado de antes, no uno peor.
    ght = env.get('GH_TOKEN')
    ghr = env.get('GH_REPO')
    if ght and ghr:
        meta['bindings'] += [
            {'type': 'secret_text', 'name': 'GH_TOKEN', 'text': ght},
            {'type': 'plain_text', 'name': 'GH_REPO', 'text': ghr},
        ]
        print('  · GH_TOKEN + GH_REPO: el Worker dispara el ciclo por cron')
    else:
        # 🔴 Y SI EL WORKER YA TENIA EL TOKEN, ESTE DEPLOY LO BORRA. El
        # `PUT` del script **reemplaza la lista entera de bindings**, igual
        # que la API de Apps Script reemplaza el proyecto entero: mandar
        # menos no es «dejar como estaba», es borrar. El deploy diria 200,
        # el cron seguiria agendado, y cada media hora dispararia contra un
        # Worker sin token — o sea que el ciclo se detiene y lo unico que
        # avisa es un `disparador.ultimo` con `ok:false` en
        # `/avisos/estado` (antes `cron:ultimo` en KV) que nadie mira.
        #
        # ⚠️ Se pregunta a la nube y no al `.env`, porque la pregunta es
        # «¿que va a perder este deploy?» y eso sólo lo sabe lo que está
        # arriba.
        # ⚠️ NO PASA POR `pedir()` A PROPOSITO: esa funcion hace `sys.exit(1)`
        # cuando Cloudflare dice que no, y un guardian que mata el deploy
        # porque no pudo *consultar* es peor que el problema que vigila.
        tenia = False
        try:
            r = s.get('%s/accounts/%s/workers/scripts/%s/bindings'
                      % (API, cid, NOMBRE), timeout=30)
            tenia = any(x.get('name') == 'GH_TOKEN'
                        for x in (r.json().get('result') or []))
        except Exception as e:                               # noqa: BLE001
            print('  ⚠️ no pude preguntar qué bindings tiene el Worker (%s):'
                  '\n     no sé si este deploy borra algo' % str(e)[:60])
        if tenia:
            print('\n  🔴 EL WORKER YA TIENE GH_TOKEN Y ESTE DEPLOY SE LO SACA.')
            print('     El `PUT` reemplaza los bindings: mandar menos los borra.')
            print('     El cron seguiría agendado y dispararía en vano.')
            print('     Poné GH_TOKEN y GH_REPO en .env y volvé a correr esto.')
            return 1
        print('  ⚠️ sin GH_TOKEN/GH_REPO en .env: el ciclo queda sólo con el')
        print('     cron de GitHub, que dispara 1 de cada 9 veces')

    tok = env.get('DISCORD_TOKEN')
    if tok:
        meta['bindings'].append(
            {'type': 'secret_text', 'name': 'DISCORD_TOKEN', 'text': tok})
        print('  · DISCORD_TOKEN va como secret_text (/numeral cambia el apodo al toque)')
    else:
        print('  ⚠️ sin DISCORD_TOKEN en .env: /numeral anota la preferencia pero')
        print('     el apodo lo cambia recien sincronizar_puesto.py')
    # ⚠️ SON DOS MODULOS DESDE EL 24/09/2026: `worker.js` importa
    # `avisos.js`. Si se sube uno solo, el import no resuelve y Cloudflare
    # rechaza el script entero — falla fuerte, que es lo bueno de este caso.
    partes = {'metadata': (None, json.dumps(meta), 'application/json')}
    total = 0
    for mod in MODULOS:
        with io.open(os.path.join(SCR, mod), encoding='utf-8') as f:
            b = f.read().encode('utf-8')
        partes[mod] = (mod, b, 'application/javascript+module')
        total += len(b)
    print('\nsubiendo %d bytes en %d módulos...' % (total, len(MODULOS)))
    pedir(s, 'PUT', '/accounts/%s/workers/scripts/%s' % (cid, NOMBRE),
          files=partes)
    print('  ✅ subido')

    # Sin esto el Worker existe pero no tiene URL publica, y el sintoma es
    # confuso: Discord dice que no puede verificar el endpoint porque no hay
    # nada escuchando, no porque la firma este mal.
    pedir(s, 'POST', '/accounts/%s/workers/scripts/%s/subdomain' % (cid, NOMBRE),
          json={'enabled': True, 'previews_enabled': False})
    print('  ✅ publicado en workers.dev')

    # 🔴 EL CRON SE REGISTRA APARTE DEL SCRIPT, y eso es una trampa: subir
    # un `worker.js` con `scheduled()` adentro **no** lo agenda. El handler
    # queda ahi sin que nadie lo llame nunca, y no hay error en ningun
    # lado — el deploy dice 200 igual. Es la forma que este repo persigue:
    # sale bien y no hace nada.
    #
    # ⚠️ OFFSET 15 MINUTOS DEL DE GITHUB (`7,37` alla, `22,52` aca), a
    # proposito. No lo reemplaza: se le suma. Con los dos vivos el ciclo
    # arranca cada 15 min; si uno muere entero, sigue cada 30. Un disparo
    # de mas no cuesta: el `concurrency` del workflow lo pone en fila, y en
    # un repo publico los minutos son gratis.
    #
    # ⚠️ ES UN PUT Y REEMPLAZA LA LISTA ENTERA. Mandar uno solo borra los
    # demas, igual que la API de Apps Script con sus cuatro archivos.
    #
    # 🔔 Y DESDE EL 24/09/2026 SON DOS: el vigía de los avisos corre cada
    # minuto. Su expresión sale de `avisos.js` (`CRON_VIGIA`) y no se
    # escribe acá: el Worker distingue los dos crons comparando contra esa
    # constante, así que si las dos copias difirieran, el vigía caería en
    # la rama del disparador y escribiría en KV cada minuto.
    crons = [{'cron': cron_vigia()}]
    if ght and ghr:
        crons.insert(0, {'cron': '22,52 * * * *'})
    pedir(s, 'PUT',
          '/accounts/%s/workers/scripts/%s/schedules' % (cid, NOMBRE),
          json=crons)
    for c in crons:
        print('  ✅ cron registrado: %s' % c['cron'])
    if ght and ghr:
        print('     22,52: dispara el ciclo, 15 min corrido del de GitHub '
              '(:07 y :37)')
    else:
        print('  · sin el disparador del ciclo: falta GH_TOKEN/GH_REPO')
    print('     %s: el vigía de los avisos' % cron_vigia())

    ver_vivo(url)
    ver_igual(s, cid)
    print('\nAhora: portal de Discord -> tu app -> General Information ->')
    print('Interactions Endpoint URL:\n\n    %s\n' % url)


def ver_servidores():
    """La tabla del Worker contra `datos/servidores.json`, que es la que manda.

    🔴 LA MISMA TABLA VIVE EN DOS LUGARES, y el propio `worker.js` lo dice:
    *«acá está copiado porque el Worker no puede leer archivos del repo»*.
    Copiado está bien —no hay alternativa— pero **nada comprobaba que las
    dos copias digan lo mismo**, y este proyecto ya tiene tres casos
    documentados de una decisión que vive en un lado mientras el código lee
    de otro.

    Y ya habían divergido: el 20/09/2026 `TFC` y `URBF` tenían **la sigla
    como nombre** en los dos —donde el Sheet dice «The Freestyle Community»
    y «Urban Freestyle Battles»—, así que el menú de servidores del bot le
    mostraba «TFC» a la gente de TFC.

    ⚠️ **FRENA EL DESPLIEGUE en vez de avisar.** Un aviso en una corrida que
    imprime treinta líneas no lo lee nadie, y esto es lo único que pasa
    entre el archivo y producción. Los `guild_id` son lo que hace andar «la
    carta del servidor donde escribiste»: uno mal copiado no falla, abre la
    carta de otro servidor.
    """
    import re as _re
    p = os.path.join(BASE, 'datos', 'servidores.json')
    if not os.path.exists(p):
        return
    with io.open(p, encoding='utf-8') as f:
        tabla = (json.load(f) or {}).get('servidores') or {}
    js = io.open(os.path.join(SCR, 'worker.js'), encoding='utf-8').read()
    enel = {}
    for m in _re.finditer(r"\{\s*sv:\s*'([^']+)',\s*nombre:\s*'([^']*)',"
                          r"\s*guild:\s*'([^']*)'", js):
        enel[m.group(1)] = (m.group(2), m.group(3))
    if not enel:
        sys.exit('no encontré la tabla de servidores en worker.js. '
                 'Si cambió de forma, hay que actualizar ver_servidores().')
    malos = []
    for sv, v in tabla.items():
        nom, gid = v.get('nombre', ''), str(v.get('guild_id') or '')
        if sv not in enel:
            malos.append('%s no está en worker.js' % sv)
            continue
        jn, jg = enel[sv]
        if jn != nom:
            malos.append('%s nombre: json %r · worker %r' % (sv, nom, jn))
        if jg != gid:
            malos.append('%s guild_id: json %r · worker %r' % (sv, gid, jg))
    for sv in enel:
        if sv not in tabla:
            malos.append('%s está en worker.js y no en el json' % sv)
    if malos:
        print('\n🔴 worker.js y datos/servidores.json no dicen lo mismo:')
        for m in malos:
            print('   %s' % m)
        print('\n   El json es el que manda. No despliego.')
        sys.exit(1)
    print('  · %d servidores: worker.js coincide con datos/servidores.json'
          % len(tabla))


def cron_vigia():
    """La expresión del cron del vigía, de su único lugar: `avisos.js`."""
    with io.open(os.path.join(SCR, 'avisos.js'), encoding='utf-8') as f:
        m = re.search(r"CRON_VIGIA\s*=\s*'([^']+)'", f.read())
    if not m:
        sys.exit('no encontré CRON_VIGIA en bot/avisos.js')
    return m.group(1)


def _nombres_arriba(s, cid):
    """Los nombres de los bindings del Worker desplegado; vacío si no se sabe.

    ⚠️ NO PASA POR `pedir()` A PROPOSITO, por lo mismo que el guardián del
    GH_TOKEN: un guardián que mata el deploy porque no pudo *consultar* es
    peor que el problema que vigila.
    """
    try:
        r = s.get('%s/accounts/%s/workers/scripts/%s/bindings'
                  % (API, cid, NOMBRE), timeout=30)
        return {x.get('name') for x in (r.json().get('result') or [])}
    except Exception as e:                                   # noqa: BLE001
        print('  ⚠️ no pude preguntar qué bindings tiene el Worker (%s)'
              % str(e)[:60])
        return set()


def migracion(s, cid):
    """Los pasos de `MIGRACIONES` que al Worker de arriba le faltan, o None.

    La etiqueta actual viene en la lista de scripts de la cuenta
    (`migration_tag`), que es de donde la saca wrangler.
    """
    tag = None
    try:
        r = s.get('%s/accounts/%s/workers/scripts' % (API, cid), timeout=30)
        for x in (r.json().get('result') or []):
            if x.get('id') == NOMBRE:
                tag = x.get('migration_tag') or None
    except Exception as e:                                   # noqa: BLE001
        # si no se sabe, se manda todo: Cloudflare rechaza un paso repetido
        # con un error claro, que es mejor que no crear la clase
        print('  ⚠️ no pude leer la etiqueta de migración (%s)' % str(e)[:60])
    tags = [t for t, _ in MIGRACIONES]
    if tag == tags[-1]:
        return None
    faltan = MIGRACIONES[tags.index(tag) + 1:] if tag in tags else MIGRACIONES
    m = {'new_tag': tags[-1], 'steps': [paso for _, paso in faltan]}
    if tag:
        m['old_tag'] = tag
    return m


def _partes(texto):
    """`{módulo: código}` de lo que baja la API, que viene en multipart.

    ⚠️ DESENVOLVER UN MULTIPART A OJO FALLA DOS VECES, Y LAS DOS CALLADO.

      1 · el cierre NO se busca como «el último \\n--». `worker.js` tiene
          comentarios cuya línea arranca con `--`. Se corta por el borde
          entero, que se lee de la primera línea y es aleatorio.
      2 · el separador de cabecera es **`\\r\\n\\r\\n`**, no `\\n\\n`. Con
          `find('\\n\\n')` el corte se iba a la primera línea en blanco del
          comentario inicial del Worker y **se comía 1.492 caracteres**:
          reportaba «no es el del repo» sobre dos archivos idénticos.
    """
    if not texto.startswith('--'):
        return {'worker.js': texto}
    borde = texto.split('\n', 1)[0].strip()
    out = {}
    for trozo in texto.split(borde)[1:]:
        if trozo.startswith('--'):
            break                                   # el cierre: `--borde--`
        corte, salto = -1, 0
        for sep in ('\r\n\r\n', '\n\n'):
            i = trozo.find(sep)
            if i >= 0 and (corte < 0 or i < corte):
                corte, salto = i, len(sep)
        if corte < 0:
            continue
        cab, cuerpo = trozo[:corte], trozo[corte + salto:]
        m = re.search(r'name="([^"]+)"', cab)
        if m:
            out[m.group(1)] = cuerpo
    return out


def ver_igual(sesion, cid):
    """¿Lo que está ARRIBA es lo que hay en el repo?

    🔴 `--ver` DECIA «GET 200 ✅» Y ESO NO CONTESTA LA PREGUNTA. Un Worker
    de hace tres días contesta 200 igual. El 20/09/2026 el desplegado tenía
    `/foto` y `/owner` —así que todo parecía al día— y le faltaban los tres
    `try/catch` del arreglo de esa misma mañana: en producción, un fallo
    del CDN, de R2 o de la cuota de KV dejaba a la persona mirando «está
    pensando…» para siempre. **El arreglo existía en el repo y no en
    Discord**, que es el estado más fácil de no notar.

    ⚠️ Lo que baja la API viene envuelto en **multipart**, así que un
    `==` contra el archivo da distinto aunque sea el mismo script. Se
    compara el cuerpo.
    """
    try:
        r = sesion.get('%s/accounts/%s/workers/scripts/%s' % (API, cid, NOMBRE),
                       timeout=60)
        # 🔴 `r.content` EN UTF-8, NO `r.text`. El multipart viene sin
        # `charset` y requests ADIVINA: el 24/09/2026 adivinó cirílico,
        # «—» salió «вҖ”» y el chequeo dijo «EL DESPLEGADO NO ES EL DEL
        # REPO» sobre dos archivos idénticos. Hasta ese deploy había
        # adivinado bien, que es lo peor que puede hacer una adivinanza.
        arriba = _partes(r.content.decode('utf-8', 'replace'))
    except Exception as e:                                   # noqa: BLE001
        print('  ⚠️ no pude bajar el desplegado (%s)' % e)
        return
    for mod in MODULOS:
        local = io.open(os.path.join(SCR, mod), encoding='utf-8').read()
        a = ' '.join((arriba.get(mod) or '').split())
        b = ' '.join(local.split())
        if a == b:
            print('  repo  ✅ lo que está arriba es `bot/%s`' % mod)
        elif mod not in arriba:
            print('  repo  🔴 ARRIBA NO ESTA `%s`. Corré `python bot/desplegar.py`.'
                  % mod)
        else:
            print('  repo  🔴 `%s` DESPLEGADO NO ES EL DEL REPO (%d vs %d bytes). '
                  'Corré `python bot/desplegar.py`.' % (mod, len(a), len(b)))


def ver_vivo(url):
    """Contra el Worker de verdad, no contra la respuesta de la API."""
    print('\ncomprobando...')
    try:
        r = requests.get(url, timeout=25)
    except Exception as e:
        print('  ⚠️ no responde todavia (%s). Suele tardar unos segundos.' % e)
        return
    ok = 'endpoint esta vivo' in r.text or 'endpoint está vivo' in r.text
    print('  GET  %d  %s' % (r.status_code, '✅' if ok else '⚠️ contesto otra cosa'))
    if not ok:
        print('       %s' % r.text[:160])
        return
    # El chequeo que importa: Discord PRUEBA con una firma mala y espera 401.
    r2 = requests.post(url, data='{"type":1}', timeout=25, headers={
        'x-signature-ed25519': '00' * 64, 'x-signature-timestamp': '1'})
    print('  POST %d  %s' % (r2.status_code,
                             '✅ rechaza firmas falsas' if r2.status_code == 401
                             else '⚠️ deberia ser 401'))
    # 🔔 el vigía de los avisos: ¿late? Recién desplegado puede no haber
    # corrido todavía —el cron es cada minuto—, así que eso no es un error.
    try:
        j = requests.get(url + '/avisos/estado', timeout=25).json()
        v = j.get('vigia') or {}
        if v.get('t'):
            print('  AVISOS %s  vigía hace %ss · %d canal(es) · %d suscripción(es)%s'
                  % ('✅' if j.get('ok') else '⚠️', v.get('hace_s'),
                     len(v.get('canales') or []), j.get('suscripciones') or 0,
                     (' · errores: %s' % v.get('errores')) if v.get('errores') else ''))
        else:
            print('  AVISOS ·  el vigía todavía no corrió (cron de cada minuto)')
    except Exception as e:                                   # noqa: BLE001
        print('  AVISOS ⚠️  no contestó /avisos/estado (%s)' % str(e)[:60])


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
