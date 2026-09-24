"""¿ESTA TODO ARRIBA Y COINCIDE? — la revision de punta a punta.

    python bot/verificar.py            todo
    python bot/verificar.py --rapido   sin pedir las 700 URLs

Pregunta lo mismo que preguntaria una persona usando el bot, pero contra los
servicios de verdad. Existe porque **las tres maneras de romper esto son
silenciosas**:

  · una carta que no subio    -> Discord muestra un hueco y NO avisa
  · KV que quedo viejo        -> el bot manda a una URL que ya no existe
  · el Worker sin desplegar   -> el repo dice una cosa y el aire otra

Ninguna de las tres tira un error en ningun lado. Es el mismo criterio que
`herramientas/puedo_generar.py`: **correr la cosa de verdad**.

⚠️ LAS URL SE CONSTRUYEN IGUAL QUE EN EL WORKER, a mano, no se leen del
inventario. Si las dos formulas se separan, esto tiene que fallar — un
verificador que le pregunta al mismo archivo que escribio la subida no
verifica nada.
"""
import concurrent.futures as cf
import io
import json
import os
import sys
import time

import requests

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)

CUENTA = 'a85733396fd158a8e9660b02e20f33c8'
KV_NS = 'a87399a3a0b647b0803aa90509ccce56'
R2 = 'https://pub-70d5821d06a8432c9cffd0c102195000.r2.dev'
WORKER = 'https://liga-global-bot.liga-global-ul.workers.dev'
NOMBRE = 'liga-global-bot'

# ⚠️ COPIADO DEL WORKER A PROPOSITO. Ver el docstring.
CARTAS = ('temporada', 'competitivo', 'servidor', 'pais')

mal = []


def ok(que, cond, detalle=''):
    print('  %s  %s%s' % ('OK  ' if cond else 'MAL ', que,
                          ('   ' + detalle) if detalle else ''))
    if not cond:
        mal.append(que)


def env(clave):
    for l in io.open(os.path.join(BASE, '.env'), encoding='utf-8'):
        if l.strip().startswith(clave + '='):
            return l.split('=', 1)[1].strip().strip('"\'')
    sys.exit('falta %s en .env' % clave)


def sesion():
    s = requests.Session()
    s.headers['Authorization'] = 'Bearer ' + env('CLOUDFLARE_API_TOKEN')
    return s


def main():
    rapido = '--rapido' in sys.argv
    s = sesion()

    print('\n1. EL WORKER\n')
    g = requests.get(WORKER, timeout=20)
    ok('el endpoint contesta', g.status_code == 200, 'GET %d' % g.status_code)
    p = requests.post(WORKER, data='{}', timeout=20)
    # ⚠️ 401 NO ES UN FALLO, ES EL REQUISITO: Discord PRUEBA que rechaces una
    # firma invalida antes de aceptar la URL. Con 200 la rechaza igual.
    ok('rechaza una firma invalida', p.status_code == 401, 'POST %d' % p.status_code)

    r = s.get('https://api.cloudflare.com/client/v4/accounts/%s/workers/scripts/%s'
              % (CUENTA, NOMBRE), timeout=30)
    arriba = r.text
    local = io.open(os.path.join(SCR, 'worker.js'), encoding='utf-8').read()
    igual = False
    if '/**' in arriba and '};' in arriba:
        cuerpo = arriba[arriba.index('/**'):arriba.rindex('};') + 2]
        igual = (cuerpo.replace('\r\n', '\n').strip()
                 == local.replace('\r\n', '\n').strip())
    ok('lo desplegado es lo del repo', igual,
       '' if igual else 'falta correr bot/desplegar.py')

    print('\n2. KV\n')
    def kv(k):
        rr = s.get('https://api.cloudflare.com/client/v4/accounts/%s/storage/kv/'
                   'namespaces/%s/values/%s' % (CUENTA, KV_NS, k), timeout=30)
        return rr.text if rr.status_code == 200 else None

    crudo = kv('meta')
    ok('`meta` se lee', bool(crudo))
    meta = json.loads(crudo) if crudo else {}
    print('       %s' % crudo)
    svs = meta.get('svs') or []
    ok('tiene sello', bool(meta.get('sello')), str(meta.get('sello')))

    inv = {}
    pinv = os.path.join(BASE, 'datos', 'cartas_r2.json')
    if os.path.exists(pinv):
        with io.open(pinv, encoding='utf-8') as f:
            inv = json.load(f)
    # ⚠️ El inventario y KV tienen que decir lo mismo. Si KV dice que FFA esta
    # listo y el inventario no, alguien escribio `svs` a mano.
    listos = None
    for cs in inv.values():
        suyos = {c[3:].upper() for c in cs if c.startswith('sv-')}
        listos = suyos if listos is None else (listos & suyos)
    listos = sorted(listos or [])
    # ⚠️ `meta.svs` DEJO DE DECIDIR NADA EL 19/09/2026: es la INTERSECCION de
    # los servidores que tienen TODAS las personas, y con 472 se vacia porque
    # los 331 nuevos tienen DRA y FFA y nada mas. El Worker ahora pregunta por
    # `p:<n>.svc`, que es por persona. Se sigue comparando porque el campo
    # existe y un dia puede volver a usarse, pero vacio es lo correcto.
    ok('`svs` coincide con el inventario', sorted(svs) == listos,
       'KV %s  ·  inventario %s%s' % (svs, listos,
                                      '   (vacio es lo esperado hoy)'
                                      if not listos else ''))

    padron = os.path.join(BASE, 'datos', 'padron.json')
    gente = []
    if os.path.exists(padron):
        with io.open(padron, encoding='utf-8') as f:
            gente = json.load(f)
    ok('el padron tiene gente', len(gente) > 0, '%d' % len(gente))

    print('\n3. LA TABLA DE SERVIDORES\n')
    # ⚠️ ESTE ES EL LUGAR DONDE SE AVISA QUE FALTAN LINKS, y no el mensaje que
    # le llega a quien usa el bot. La primera version le contestaba «todavia no
    # tengo el link, pedíselo a un admin» a cualquiera que eligiera un servidor
    # — una frase que el que la lee no puede accionar, en cada cambio. Un aviso
    # va donde esta el que puede hacer algo.
    tab = {}
    pt = os.path.join(BASE, 'datos', 'servidores.json')
    if os.path.exists(pt):
        with io.open(pt, encoding='utf-8') as f:
            tab = json.load(f).get('servidores') or {}
    sin_guild = [k for k, v in tab.items() if not v.get('guild_id')]
    sin_link = [k for k, v in tab.items() if not v.get('invitacion')]
    # No son fallos: son cosas que Dlx tiene que dar. Se listan, no se rompen.
    print('  %d servidor(es) sin guild_id: %s' % (len(sin_guild), ', '.join(sin_guild) or '-'))
    print('       -> ahi `/card` no puede abrir en «el servidor donde escribiste»')
    print('  %d servidor(es) sin invitacion: %s' % (len(sin_link), ', '.join(sin_link) or '-'))
    print('       -> ahi el bot no manda invitacion; no inventa un link')

    # ⚠️ TENER UN LINK NO ES QUE EL LINK ANDE. Lo de arriba solo mira que la
    # celda no este vacia. Una invitacion de Discord se puede revocar, caducar
    # o quedarse sin usos en cualquier momento, y cuando eso pasa **nada falla
    # de este lado**: el bot manda el link igual y la persona cae en «Invite
    # Invalid». Es el mismo caso que el de URBF, que apuntaba a otro servidor
    # y se descubrio cruzandolo — solo que ese error nace roto y este se rompe
    # despues, asi que verificarlo una vez no alcanza.
    #
    # No pide token: `GET /invites/<codigo>` es publico.
    muertos, otro, eterno = [], [], 0
    for k, v in tab.items():
        # ⚠️ `link`, NO `inv`: `inv` es el INVENTARIO de cartas, cargado
        # arriba y usado en la seccion 4. Llamar igual a la invitacion lo
        # pisaba y la 4 reventaba con un AttributeError a cien lineas de
        # distancia. Pasó al escribir este bloque, el 18/09/2026.
        link = v.get('invitacion')
        if not link:
            continue
        rr = requests.get('https://discord.com/api/v10/invites/%s?with_expiration=true'
                          % link.rstrip('/').split('/')[-1], timeout=20)
        if not rr.ok:
            muertos.append(k)
            continue
        j = rr.json()
        if v.get('guild_id') and (j.get('guild') or {}).get('id') != v['guild_id']:
            otro.append('%s -> %s' % (k, (j.get('guild') or {}).get('name', '?')))
        elif not j.get('expires_at'):
            eterno += 1
    ok('las invitaciones siguen vivas', not muertos and not otro,
       ('%d sin caducidad' % eterno) if not muertos and not otro
       else ' · '.join(filter(None, [
           ('🔴 MUERTAS: ' + ', '.join(muertos)) if muertos else '',
           ('🔴 LLEVAN A OTRO SERVIDOR: ' + ', '.join(otro)) if otro else ''])))
    if muertos or otro:
        print('       -> el bot manda ese link y la persona no entra. Hay que')
        print('          pedir uno nuevo y ponerlo en datos/servidores.json')
        print('          Y EN bot/worker.js, que tiene su copia.')

    # ⚠️ TENER EL guild_id NO ES ESTAR ADENTRO, y confundirlos cuesta caro:
    # `datos/servidores.json` listaba el guild de DRA desde el primer dia y el
    # bot no estuvo en DRA hasta el 18/09/2026 — 404 al pedirlo. O sea que
    # `/card` ahi no contestaba nada y la tabla daba a entender lo contrario.
    # Se pregunta, no se supone. Siguen los siete que faltan.
    tok = None
    try:
        tok = env('DISCORD_TOKEN')
    except SystemExit:
        pass
    #
    # ⚠️ Y LO QUE FALLA NO ES «FALTAN SERVIDORES»: ES «ESTA Y NO CONTESTA».
    # La primera version exigia los nueve, o sea que estaba en rojo desde el
    # dia uno y lo iba a estar por meses — Dlx: «de momento solo estara en FFA
    # y DRA». Un rojo permanente no es una alarma, es ruido: cuando el noveno
    # entre nadie va a estar mirando esta linea.
    #
    # El que si es invisible es el otro: **meter el bot son DOS pasos** —el
    # link y `registrar.mjs`— y el segundo no falla, calla. El bot entra,
    # aparece en la lista de miembros, y `/card` simplemente no existe ahi.
    # Desde afuera se ve igual que un bot roto. Eso es lo que se exige.
    if tok:
        cab = {'Authorization': 'Bot ' + tok}
        app = env('DISCORD_APP_ID')
        rg = requests.get('https://discord.com/api/v10/applications/%s/commands' % app,
                          headers=cab, timeout=20)
        globales = [c['name'] for c in rg.json()] if rg.ok else []

        adentro, afuera, mudos = [], [], []
        for k, v in tab.items():
            if not v.get('guild_id'):
                continue
            rr = requests.get('https://discord.com/api/v10/guilds/%s' % v['guild_id'],
                              headers=cab, timeout=20)
            if not rr.ok:
                afuera.append(k)
                continue
            adentro.append(k)
            if globales:
                continue          # los globales valen en todos, no hay que mirar
            rc = requests.get(
                'https://discord.com/api/v10/applications/%s/guilds/%s/commands'
                % (app, v['guild_id']), headers=cab, timeout=20)
            if not rc.ok or not rc.json():
                mudos.append(k)

        print('  el bot esta adentro de: %s' % (', '.join(adentro) or '-'))
        if afuera:
            print('       todavia sin invitar: %s' % ', '.join(afuera))
            print('       -> el link de cada uno: node bot/registrar.mjs --invitar')
        ok('donde esta adentro, tiene comandos', not mudos,
           ('%d comando(s) global(es): valen en todos' % len(globales)) if globales
           else ('por servidor%s' % (('  ·  🔴 MUDO en: ' + ', '.join(mudos))
                                     if mudos else ', y los %d los tienen' % len(adentro))))
        if mudos:
            print('       -> el bot esta ahi y `/card` no existe. Se arregla con:')
            for k in mudos:
                print('          node bot/registrar.mjs --sv=%s' % k)

    print('\n4. KV CONTRA EL INVENTARIO\n')
    # ⚠️ `cs` DICE QUE BOTONES DIBUJA EL BOT. Si KV quedo viejo, el bot ofrece
    # una carta que ya no esta (hueco) o esconde una que si (boton de menos).
    # Se comprueba sobre los que tienen algo raro, no sobre las 138: una
    # lectura de KV por persona son 138 peticiones y lo que importa es que el
    # caso distinto este bien.
    raros = sorted(q for q, cs in inv.items()
                   if sorted(c for c in cs if c in CARTAS) != sorted(CARTAS))
    print('  %d persona(s) sin las cuatro cartas: %s'
          % (len(raros), ', '.join(raros) or '-'))
    # 🔴 Y QUIEN NO PASA EL PORTON NO ESTA EN KV **A PROPOSITO**. Desde el
    # 22/09/2026 lo que alguien debe tener lo decide `bot/verificados.py`,
    # no lo que quedo en R2: R2 guarda 480 personas y el porton deja 319.
    # Medido ese dia, este chequeo marcaba MAL a **108** por tener la clave
    # vacia — que es exactamente lo correcto.
    try:
        import verificados as _V
        import construir_padron as _PAD
        from comun.claves import clave as _CL
        _ver, _cu = _V.cargar()
        pasan = ({_CL(p['raw']) for p in _PAD.cargar() if _V.pasa(p, _ver)}
                 if _ver is not None else None)
    except Exception as e:                               # noqa: BLE001
        print('  ⚠️ no pude leer el portón (%s): no filtro' % str(e)[:50])
        pasan = None
    if pasan is not None:
        fuera = [q for q in raros if q not in pasan]
        raros = [q for q in raros if q in pasan]
        print('  %d de esos no pasan el portón: su clave de KV está vacía '
              'a propósito' % len(fuera))

    for q in raros[:8]:
        crudo_q = kv('p:' + q)
        enkv = sorted((json.loads(crudo_q).get('cs') or []) if crudo_q else [])
        # 🔴 «TIENE SERVIDOR» NO ES «TIENE `servidor.webp`». Los 331 que
        # entraron con la Servidor desbloqueada no tienen esa clave — tienen
        # `sv-dra` y `sv-ffa`, que son cartas de servidor igual. Este chequeo
        # comparaba contra `CARTAS` a secas y marcaba MAL a las 331, o sea 400
        # falsos positivos que tapaban los hallazgos de verdad. Un verificador
        # que grita siempre no lo mira nadie.
        real = sorted(set(c for c in inv[q] if c in CARTAS)
                      | ({'servidor'} if any(c.startswith('sv-') for c in inv[q])
                         else set()))
        # 🔴 LAS DOS DIRECCIONES NO SON LO MISMO, Y ANTES SE PEDIA
        # IGUALDAD. Comparar `enkv == real` da por roto cualquier sobrante
        # de R2, y desde el 22/09 eso es la norma: 235 personas tienen su
        # `pais.webp` de antes del requisito nuevo —3 duelos nacionales, 3
        # internacionales y bandera—, que nadie cumple todavia. `cs` no la
        # ofrece, que es lo correcto, y el archivo queda arriba sin servirse.
        #
        # Solo una direccion rompe algo:
        #
        #   KV ofrece y R2 no tiene  ->  🔴 el boton existe y da 404
        #   R2 tiene y KV no ofrece  ->  ⚠️ sobra un archivo, no se sirve
        #
        # Es la misma correccion que el par «servidor == sv-dra» de mas
        # abajo: el chequeo tenia razon en el hecho y no en el significado.
        rotas = sorted(set(enkv) - set(real))
        sobran = sorted(set(real) - set(enkv))
        ok('  `cs` de %s no ofrece nada que falte' % q, not rotas,
           'KV ofrece %s y R2 no las tiene' % rotas if rotas
           else 'KV %s' % enkv)
        if sobran:
            print('       en R2 y no ofrecidas (no las merece hoy): %s'
                  % ', '.join(sobran))
        print('       le falta: %s' % ', '.join(sorted(set(CARTAS) - set(real))))

    print('\n5. LAS CARTAS EN R2\n')
    # ⚠️ SE PREGUNTA SOLO POR LO QUE EL BOT PUEDE PEDIR. Mark no tiene carta de
    # Pais —no tiene pais, «sin dato no hay pieza»— y desde que el Worker mira
    # `cs` tampoco le dibuja ese boton. Contar esa URL como rota haria que el
    # verificador este en rojo para siempre por algo que esta bien, y un
    # verificador que siempre falla no lo mira nadie.
    quienes = sorted(inv)
    urls = []
    for q in quienes:
        for c in CARTAS:
            if c in inv[q]:
                urls.append((q, c, '%s/%s/%s.webp' % (R2, q, c)))
        for sv in svs:
            urls.append((q, 'sv-' + sv.lower(),
                         '%s/%s/sv-%s.webp' % (R2, q, sv.lower())))
    print('  %d URL de %d persona(s)%s' %
          (len(urls), len(quienes), '  (muestra)' if rapido else ''))
    if rapido:
        urls = urls[::max(1, len(urls) // 40)][:40]

    # 🔴 SE REINTENTA, Y NO ES PROLIJIDAD: SIN ESTO DA FALSA ALARMA.
    # Medido el 21/09/2026 en Actions: **169 de 852 «rotas»**, y las 169
    # respondian 200 con contenido real al pedirlas de a una. Los
    # nombres salian agrupados alfabeticamente —six, skratch, snow,
    # soneto...— que es la firma de un limite de tasa, no de archivos
    # que faltan: `r2.dev` es el dominio gratis y throttlea.
    #
    # ⚠️ Y UNA FALSA ALARMA ES TAN MALA COMO NO CHEQUEAR. Este archivo ya
    # lo tiene escrito: *«un verificador que siempre falla no lo mira
    # nadie»*. Con 169 rotas inventadas, el dia que falte una de verdad
    # se pierde en el ruido.
    def pedir(u):
        ultimo = (0, 'sin intentar')
        for intento in range(3):
            try:
                rr = requests.get(u[2], timeout=30, stream=True)
                n = int(rr.headers.get('content-length') or 0)
                rr.close()
                # un 404 es definitivo: no se reintenta, falta de verdad
                if rr.status_code == 404:
                    return u, 404, n
                if rr.status_code == 200:
                    return u, 200, n
                ultimo = (rr.status_code, n)
            except Exception as e:                       # noqa: BLE001
                ultimo = (0, str(e)[:40])
            time.sleep(0.4 * (intento + 1))
        return u, ultimo[0], ultimo[1]

    rotas = []
    with cf.ThreadPoolExecutor(max_workers=16) as pool:
        for u, cod, n in pool.map(pedir, urls):
            if cod != 200 or not isinstance(n, int) or n < 1024:
                rotas.append((u[0], u[1], cod, n))
    # ⚠️ SE SEPARAN LAS QUE FALTAN DE LAS QUE NO CONTESTARON. Son dos
    # problemas distintos y solo el primero es de las cartas: un 404 es
    # un archivo que no esta, y un 0 despues de tres intentos es la red
    # o el limite de tasa. Mezclarlos fue lo que hizo el informe inutil.
    faltan = [r for r in rotas if r[2] == 404]
    mudas = [r for r in rotas if r[2] != 404]
    ok('todas las cartas responden', not faltan,
       '' if not faltan else '%d que NO están (404)' % len(faltan))
    if mudas:
        print('       ⚠️ %d no contestaron en 3 intentos (red o límite de '
              'tasa de r2.dev), no es que falten' % len(mudas))
    por_carta = {}
    for q, c, cod, n in faltan:
        por_carta.setdefault(c, []).append(q)
    for c, qs in sorted(por_carta.items()):
        print('       %-14s falta(n) %d: %s' % (c, len(qs), ', '.join(qs[:6])))

    print('\n6. EL CONTENIDO, SIN BAJAR NADA\n')
    # ⚠️ UN 200 NO PRUEBA QUE LA CARTA SEA LA QUE TIENE QUE SER. La seccion de
    # arriba prueba que el archivo EXISTE; esta pregunta si es el correcto, y
    # los dos errores que importan no se ven de ninguna otra forma:
    #
    #   · que las 138 de un servidor sean la MISMA carta -> el bucle se
    #     desincronizo entre la persona y el archivo
    #   · que la carta de TWR de alguien sea identica a la de TFC -> el `--sv`
    #     no se aplico y se subio nueve veces la misma
    #
    # El listado de R2 trae `etag`, que es el MD5 del contenido. O sea que
    # esto es una auditoria de contenido que no baja un solo byte.
    import sys as _sys
    _sys.path.insert(0, SCR)
    from subir_cartas import sesion as _ses, listar as _listar
    todos = _listar(_ses())
    ok('R2 responde el listado', bool(todos), '%d objetos' % len(todos))

    # ⚠️ LA CUENTA ES SOBRE LO QUE SE SIRVE, NO SOBRE LO QUE HAY. Al pasar a
    # webp quedaron los 1.793 PNG viejos en el bucket: contarlos daba «3.586
    # objetos, esperado 1.793» y eso no es un error, es basura que todavia no
    # se limpio. Un chequeo que confunde «sobra» con «falta» deja de servir
    # para lo unico que importa acá, que es si FALTA una carta.
    # 🔴 Y DESDE EL 20/09 HAY UNA TERCERA CATEGORIA: LAS FOTOS. `bot/fotos.py`
    # guarda el avatar de cada uno en `fotos/<temporada>/` **del mismo
    # bucket**, y no son cartas. Contarlas daba «3.527 webp en R2 · 3.220 en
    # el inventario» —307 de mas, que son exactamente las fotos— y encima
    # disparaba el chequeo de «sospechosamente chico» con 172 nombres, porque
    # un avatar pesa menos de 20 KB **y tiene que pesar menos**.
    #
    # ⚠️ Es la tercera vez que este mismo chequeo confunde una categoria con
    # otra, y el comentario de arriba ya lo dice: un chequeo que grita por
    # algo que esta bien se termina ignorando, y entonces no sirve para lo
    # unico que importa, que es si FALTA una carta. Se separan, no se
    # excluyen en silencio: si algun dia sobran o faltan fotos, hay que
    # poder verlo.
    fotos = [o for o in todos if o['key'].startswith('fotos/')]
    resto = [o for o in todos if not o['key'].startswith('fotos/')]
    objs = [o for o in resto if o['key'].endswith('.webp')]
    viejos = [o for o in resto if not o['key'].endswith('.webp')]
    if fotos:
        print('  %d foto(s) en fotos/, %.1f MB: no son cartas y no se cuentan '
              'acá' % (len(fotos), sum(int(o['size']) for o in fotos) / 1024 ** 2))
    # 🔴 LA CUENTA NO SE PUEDE ADIVINAR CON UNA MULTIPLICACION, y desde el
    # 19/09/2026 menos que nunca. La formula era
    # `personas x (4 cartas + los servidores listos)`, y eso asumia que todos
    # tienen lo mismo. Hoy no: los 138 del pool tienen 4 + 9, los 331 nuevos
    # tienen 2 + 2 bloqueadas, y los que no tienen pais no tienen esa. Daba
    # «3.220 webp · esperado 1.554» y sonaba a que faltaban 1.700 cartas
    # cuando en realidad SOBRABAN — o sea que el chequeo mentia en la
    # direccion mas asustadora.
    #
    # Lo que si se puede afirmar: el inventario que el pipeline dejo y lo que
    # R2 sirve tienen que dar el MISMO numero. Eso se cuenta, no se deduce.
    esperado = sum(len(v) for v in inv.values())
    ok('la cuenta de las que se sirven da exacta', len(objs) == esperado,
       '%d webp en R2 · %d en el inventario del pipeline' % (len(objs), esperado))
    if viejos:
        print('  %d objeto(s) que ya no se sirven, %.2f GB: se pueden borrar'
              % (len(viejos), sum(int(o['size']) for o in viejos) / 1024 ** 3))

    # ⚠️ Desde el 17/09/2026 se sirve WEBP. Las .png que queden son de antes
    # y no las pide nadie: se cuentan aparte para que no ensucien el resto.
    objs = [o for o in objs if o['key'].endswith('.webp')]
    notw = [o['key'] for o in objs
            if (o.get('http_metadata') or {}).get('contentType') != 'image/webp']
    ok('todos son image/webp', not notw, ', '.join(notw[:4]))
    # ⚠️ El piso baja a 20 KB: una webp de 138 KB es lo normal ahora, asi que
    # el umbral viejo de 100 KB marcaria todas. Lo que busca este chequeo es
    # el archivo TRUNCADO, no el liviano.
    chicos = [o['key'] for o in objs if int(o['size']) < 20 * 1024]
    ok('ninguno sospechosamente chico', not chicos,
       '%d bajo 20 KB: %s' % (len(chicos), ', '.join(chicos[:4])))

    # etag repetido DENTRO de una persona = las nueve son el mismo dibujo
    por_persona, por_carta = {}, {}
    for o in objs:
        q, _, c = o['key'].rpartition('/')
        por_persona.setdefault(q, []).append((c[:-5], o['etag']))
        por_carta.setdefault(c[:-5], {}).setdefault(o['etag'], []).append(q)
    #
    # ⚠️ HAY UN PAR QUE SI PUEDE SER IDENTICO, Y SABERLO ES LA MITAD DEL
    # CHEQUEO: `servidor` (la propia) contra `sv-<tu propio servidor>`. Son la
    # misma carta dibujada dos veces, y se diferencian SOLO en el puesto, que
    # la version por servidor borra. O sea que para quien NO TIENE PUESTO
    # —menos de tres personas en su servidor: NFK, Marcos y Vandu— salen
    # identicas, y eso es correcto.
    #
    # El Worker ademas nunca pide `sv-<el tuyo>`: `urlServidor()` manda a
    # `servidor.png` cuando el servidor pedido es el propio. Asi que ese
    # archivo existe y no lo sirve nadie.
    crudos, esperados = [], 0
    for q, lista in por_persona.items():
        vistos = {}
        for c, et in lista:
            if et in vistos:
                crudos.append((q, vistos[et], c))
            vistos[et] = c
    clones = []
    for q, a, b in crudos:
        cq = kv('p:' + q)
        # ⚠️ `svp`, NO `sv`. Desde el 19/09 `sv` es donde ESTAS —lo dice
        # Discord— y `svp` donde JUGASTE —el argmax del Sheet—. La carta
        # propia se dibuja contra `svp`, asi que comparando con `sv` este
        # chequeo marcaba como «clon por error» a nfk y vandu, que juegan en
        # URBF y estan en DRA: su `servidor.webp` y su `sv-urbf.webp` SON la
        # misma carta, y eso es correcto.
        d = json.loads(cq) if cq else {}
        # 🔴 `or`, NO `is not None` — y la diferencia es vacío contra
        # ausente. `svp` **existe y vale `''`** para todo el que no
        # compitió, así que `is not None` se quedaba con la cadena vacía
        # en vez de caer a `sv`, y entonces `if suyo and ...` fallaba y
        # el par legítimo se contaba como clon.
        #
        # Con el pool en cero eso es **todo el mundo**: medido el
        # 22/09/2026, la auditoría semanal marcó **319 de 319** como
        # «dos cartas idénticas por error» cuando las 319 son el caso
        # que el comentario de arriba describe como correcto.
        #
        # ⚠️ Una alarma que se dispara para el 100 % no es una alarma.
        # Y ésta corre **semanal y desatendida**, que es donde menos se
        # nota que dejó de servir.
        #
        # La preferencia sigue siendo `svp` cuando lo hay —es contra
        # dónde se dibuja la carta propia—; `sv` es el respaldo para
        # quien todavía no jugó, que es contra lo que se dibujó la suya.
        suyo = (d.get('svp') or d.get('sv') or '').lower()
        par = {a, b}
        if suyo and par == {'servidor', 'sv-' + suyo}:
            esperados += 1          # la propia contra la de su propio servidor
        else:
            clones.append('%s: %s == %s' % (q, a, b))
    ok('nadie tiene dos cartas identicas por error', not clones,
       ('%d: %s' % (len(clones), ' · '.join(clones[:3]))) if clones
       else '%d par(es) esperado(s): la propia contra la de su propio servidor'
            % esperados)

    # etag repetido DENTRO de un tipo de carta = dos personas con el mismo PNG
    mezclas = []
    for c, porhash in por_carta.items():
        for et, quienes in porhash.items():
            if len(quienes) > 1:
                mezclas.append('%s: %s' % (c, ', '.join(quienes[:4])))
    ok('nadie comparte carta con otro', not mezclas,
       '%d: %s' % (len(mezclas), ' · '.join(mezclas[:3])))

    # ⚠️ EL SELLO TIENE QUE SER POSTERIOR A LA ULTIMA SUBIDA. Si un archivo se
    # subio DESPUES de escribir `meta`, su URL no cambio y Discord puede seguir
    # sirviendo la version vieja de su cache. Es el bug del 17/09 otra vez, por
    # la puerta de atras: el orden importa, no solo que exista el sello.
    from datetime import datetime, timezone
    ultima = max(o['last_modified'] for o in objs)
    loc = (datetime.fromisoformat(ultima.replace('Z', '+00:00'))
           .astimezone().strftime('%Y%m%d%H%M'))
    # ⚠️ SE RELEE ANTES DE DAR ROJO. KV es EVENTUALMENTE CONSISTENTE: una
    # lectura a segundos de la escritura puede devolver el valor viejo, y este
    # verificador corre justo despues del pipeline. Paso el 17/09: dijo
    # «sello 202609172226 · ultima subida 202609172319» y el sello YA era el
    # 2319. Un chequeo que da rojo por su propia prisa entrena a ignorarlo,
    # que es lo unico que no puede pasarle a un verificador.
    sello = str(meta.get('sello', ''))
    if sello < loc:
        time.sleep(8)
        crudo2 = kv('meta')
        if crudo2:
            sello = str(json.loads(crudo2).get('sello', ''))
    ok('el sello es posterior a la ultima subida', sello >= loc,
       'sello %s · ultima subida %s' % (sello, loc))

    print('\n7. CUANTO PESA Y CUANTO TARDA\n')
    # ⚠️ ESTO NO ES UN FALLO, ES LO QUE EXPLICA UN «A VECES NO CARGA».
    # Dlx lo reporto el 17/09: «a veces hay algunas fotos que no carga». Las
    # 1.793 URL responden 200 —la seccion 5 lo comprueba— asi que lo que falla
    # no es que el archivo no este: es cuanto tarda en llegar.
    #
    # Dos cosas medidas ese dia:
    #   · `pub-*.r2.dev` NO manda `cache-control` NI `cf-cache-status`. Es el
    #     dominio de desarrollo de R2 y no cachea en el borde: cada pedido va
    #     al bucket. Un dominio propio si cachearia.
    #
    # ✅ DECIDIDO EL 18/09/2026 Y NO ES UN PENDIENTE: se queda en r2.dev. Dlx:
    # «de momento no pagare nada», y un dominio propio pide un dominio propio.
    # Lo que importa es que **casi no cuesta nada dejarlo asi**, y eso se
    # entendio mal antes: se habia dicho que el dominio ademas sacaria el
    # `[971] Please wait and consider throttling`, y es FALSO. Ese error sale
    # de `api.cloudflare.com` —la API de administracion, en la subida y el
    # borrado masivo—, no de servir por `pub-*.r2.dev`. Un dominio propio no
    # lo toca.
    #
    # Y la caché de borde da menos de lo que parece: quien pide estas URL es
    # el proxy de Discord, que cachea por su cuenta y por URL —de ahi el `?v=`
    # del sello—. O sea que el bucket recibe cada URL una vez, no una por
    # persona que mira la carta. Este numero mide lo que tardamos NOSOTROS en
    # comprobar, no lo que espera la gente.
    #   · las cartas pesan 1,14 MB de media. En un telefono con datos, eso es
    #     la diferencia entre que aparezca al toque y que a veces no aparezca.
    #
    # WEBP q90 las deja en ~140 KB, un 87% menos, y al 100% son
    # indistinguibles (diferencia media 1,29 por canal). Ver el commit.
    import statistics
    import concurrent.futures as cf2
    pocas = [u for u in urls[:24]]
    def cronometrar(u):
        t0 = time.time()
        try:
            rr = requests.get(u[2], timeout=45)
            return time.time() - t0, rr.status_code, len(rr.content)
        except Exception:
            return time.time() - t0, 0, 0
    with cf2.ThreadPoolExecutor(max_workers=12) as pool:
        med = list(pool.map(cronometrar, pocas))
    ts = [t for t, _, _ in med]
    pesos = [n for _, _, n in med if n]
    print('  %d pedidos a la vez  ·  mediana %.2fs  ·  max %.2fs'
          % (len(med), statistics.median(ts), max(ts)))
    print('  peso medio %.2f MB  ·  el mas pesado %.2f MB'
          % (sum(pesos) / len(pesos) / 1024 / 1024, max(pesos) / 1024 / 1024))
    una = requests.get(pocas[0][2], timeout=45)
    hh = {k.lower(): v for k, v in una.headers.items()}
    print('  cache-control: %s  ·  cf-cache-status: %s'
          % (hh.get('cache-control', '(no manda)'), hh.get('cf-cache-status', '(no manda)')))
    if not hh.get('cache-control'):
        print('       -> r2.dev no cachea en el borde: cada pedido va al bucket')
        print('          (decidido: se queda asi. Discord cachea por su cuenta')
        print('           y un dominio propio pide pagar uno. Ver el comentario)')

    print('\n8. EL WORKER EJECUTADO CONTRA ESTOS DATOS\n')
    # ⚠️ ES LA PREGUNTA QUE NINGUNA DE LAS SEIS DE ARRIBA HACE. Todo lo
    # anterior mira los servicios; esto CORRE el Worker con los datos de
    # verdad y comprueba cada URL que construye. Sin esto, `norm()` —que esta
    # escrito dos veces, en Python y en JavaScript— puede separarse para un
    # nombre con tilde y nadie se entera hasta que esa persona tira /card.
    import subprocess
    subprocess.run([sys.executable, os.path.join(SCR, 'volcar_kv.py')],
                   cwd=BASE, stdout=subprocess.DEVNULL)
    for guion, que in (('probar_local.mjs', 'las pruebas del Worker'),
                       ('simular.mjs', 'el Worker contra los datos reales')):
        # ⚠️ SI FALTA `node`, SE DICE Y SE SIGUE. `subprocess.run` con un
        # ejecutable que no existe levanta `FileNotFoundError`, y eso
        # tumbaba la auditoria entera **despues** de ocho secciones que ya
        # habian corrido bien: el informe se perdia por una dependencia
        # de los dos ultimos chequeos. Importa desde que esto corre en
        # Actions, donde el runner lo pone y podria dejar de ponerlo.
        try:
            r = subprocess.run(['node', os.path.join(SCR, guion)], cwd=BASE,
                               capture_output=True, text=True,
                               encoding='utf-8', errors='replace')
        except OSError as e:
            ok(que, False, 'no pude correr node (%s)' % str(e)[:60])
            continue
        ultima = [l for l in (r.stdout or '').splitlines() if l.strip()][-1:]
        ok(que, r.returncode == 0, (ultima[0] if ultima else '').strip()[:96])

    print('\n9. LO QUE ESTA GUARDADO Y NO LEE NADIE\n')
    # 🔴 LAS OCHO DE ARRIBA PREGUNTAN «¿esta todo lo que hace falta?» Y
    # NINGUNA PREGUNTA LA INVERSA: que hay guardado de mas. No es una
    # curiosidad de limpieza — lo que sobra son **caras de personas
    # reales** en un bucket publico, y una cara guardada de mas no la
    # reclama nadie porque nadie sabe que esta.
    #
    # Medido el 22/09/2026: 19 personas tenian DOS fotos, bajo dos
    # grafias del mismo nombre. El mecanismo esta en `fotos.py` —salta
    # lo que «ya esta» mirando el archivo, asi que con la clave nueva no
    # encontraba la vieja y subia una segunda— y nadie borraba la
    # primera. Ninguna de las ocho secciones lo veia, porque las ocho
    # miran si falta.
    #
    # ⚠️ AVISA Y NO BORRA. `bot/olvidar.py --sueltas` es el que borra, a
    # mano. Un borrador dentro de la auditoria —que corre en el ciclo—
    # es un `rm` por hora: el dia que la regla de «cual es la viva» se
    # equivoque, se lleva las caras antes de que nadie lo lea.
    try:
        sys.path.insert(0, SCR)
        import olvidar as OLV
        s_olv = OLV.sesion()
        inv = OLV.inventario(s_olv)
        vol = os.path.join(SCR, '_kv_volcado.json')
        vivas = set()
        if os.path.exists(vol):
            with io.open(vol, encoding='utf-8') as f:
                _v = json.load(f)
            vivas = {OLV.norm(str(_v[k])) for k in _v if k.startswith('d:')}
        sin = [g for g in inv if g not in vivas]
        # 🔴 SE MIDE CON `sueltas()` Y NO CONTANDO GRAFIAS DOBLES, y la
        # diferencia es si esta alarma sirve. Hay un par —`aze_gian` y
        # `azegian`— donde NINGUNA de las dos esta en KV, asi que
        # `--sueltas` se niega a elegir cual borrar, a proposito. Contar
        # dobles dejaria esta linea en rojo **para siempre** pidiendo un
        # arreglo que el unico script que puede hacerlo rechaza. Es la
        # regla que ya esta escrita en `secretos_en_git.py`: una alarma
        # que pide el arreglo equivocado hace daño.
        d = OLV.sueltas(s_olv)
        ok('ninguna grafía muerta de foto', not d,
           '%d: %s -> `python bot/olvidar.py --sueltas`'
           % (len(d), ', '.join(k.rsplit('/', 1)[-1] for _v2, k in d[:5]))
           if d else '')
        # ⚠️ ESTO NO ES UN FALLO Y POR ESO NO USA `ok()`. Son personas
        # que no pasan el porton hoy y pueden pasar mañana: su carta
        # guardada es un estado, no basura. Se cuenta para que el numero
        # no crezca sin que nadie lo mire.
        print('  ·    %d persona(s) con carta que KV no indexa '
              '(no pasan el portón)' % len(sin))
    except Exception as e:                             # noqa: BLE001
        ok('lo guardado de más', False, 'no pude mirarlo: %s' % str(e)[:70])

    print('\n%s\n' % ('TODO BIEN' if not mal else 'FALLA: ' + ' · '.join(mal)))
    return 1 if mal else 0


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    sys.exit(main())
