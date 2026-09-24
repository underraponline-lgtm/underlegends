"""DESPLIEGA EL WORKER SIN WRANGLER.

    python bot/desplegar.py            sube worker.js y deja la URL lista
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

    with io.open(os.path.join(SCR, 'worker.js'), encoding='utf-8') as f:
        codigo = f.read()

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
    tok = env.get('DISCORD_TOKEN')
    if tok:
        meta['bindings'].append(
            {'type': 'secret_text', 'name': 'DISCORD_TOKEN', 'text': tok})
        print('  · DISCORD_TOKEN va como secret_text (/numeral cambia el apodo al toque)')
    else:
        print('  ⚠️ sin DISCORD_TOKEN en .env: /numeral anota la preferencia pero')
        print('     el apodo lo cambia recien sincronizar_puesto.py')
    print('\nsubiendo %d bytes...' % len(codigo.encode('utf-8')))
    pedir(s, 'PUT', '/accounts/%s/workers/scripts/%s' % (cid, NOMBRE),
          files={
              'metadata': (None, json.dumps(meta), 'application/json'),
              'worker.js': ('worker.js', codigo.encode('utf-8'),
                            'application/javascript+module'),
          })
    print('  ✅ subido')

    # Sin esto el Worker existe pero no tiene URL publica, y el sintoma es
    # confuso: Discord dice que no puede verificar el endpoint porque no hay
    # nada escuchando, no porque la firma este mal.
    pedir(s, 'POST', '/accounts/%s/workers/scripts/%s/subdomain' % (cid, NOMBRE),
          json={'enabled': True, 'previews_enabled': False})
    print('  ✅ publicado en workers.dev')

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
    local = io.open(os.path.join(BASE, 'bot', 'worker.js'),
                    encoding='utf-8').read()
    try:
        r = sesion.get('%s/accounts/%s/workers/scripts/%s' % (API, cid, NOMBRE),
                       timeout=60)
        arriba = r.text
    except Exception as e:                                   # noqa: BLE001
        print('  ⚠️ no pude bajar el desplegado (%s)' % e)
        return
    # ⚠️ DESENVOLVER UN MULTIPART A OJO FALLA DOS VECES, Y LAS DOS CALLADO.
    # Este verificador existe para no creerle a un «200 ✅», así que un
    # falso positivo suyo es peor que no tenerlo: se termina ignorando.
    #
    #   1 · el cierre NO se busca como «el último \n--». `worker.js` tiene
    #       comentarios cuya línea arranca con `--`, así que el corte caía
    #       adentro del script. Se lee el boundary de la primera línea.
    #   2 · el separador de cabecera es **`\r\n\r\n`**, no `\n\n`. Con
    #       `find('\n\n')` el corte se iba a la primera línea en blanco del
    #       comentario inicial del Worker y **se comía 1.492 caracteres**,
    #       o sea que reportaba «no es el del repo» sobre dos archivos
    #       idénticos. Medido: decía 99.785 contra 101.277.
    if arriba.startswith('--'):
        borde = arriba.split('\n', 1)[0].strip()
        corte, salto = -1, 0
        for sep in ('\r\n\r\n', '\n\n'):
            i = arriba.find(sep)
            if i >= 0 and (corte < 0 or i < corte):
                corte, salto = i, len(sep)
        if corte >= 0:
            arriba = arriba[corte + salto:]
        fin = arriba.rfind('\n' + borde)
        if fin > 0:
            arriba = arriba[:fin]
    a = re.sub(r'\s+', ' ', arriba).strip()
    b = re.sub(r'\s+', ' ', local).strip()
    if a == b:
        print('  repo  ✅ lo que está arriba es `bot/worker.js`')
    else:
        print('  repo  🔴 EL DESPLEGADO NO ES EL DEL REPO '
              '(%d vs %d bytes). Corré `python bot/desplegar.py`.'
              % (len(a), len(b)))


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


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
