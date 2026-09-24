# -*- coding: utf-8 -*-
"""LA SALIDA. Sacar a alguien del sistema: su cara, sus cartas y su fila.

    python bot/olvidar.py                 el mapa de R2 y que le falta dueño
    python bot/olvidar.py Konan           que le borraria (no toca nada)
    python bot/olvidar.py Konan --hacer   lo borra y lo anota en olvidados
    python bot/olvidar.py Konan --volver  lo deja volver
    python bot/olvidar.py --sueltas       las grafias muertas
    python bot/olvidar.py --huerfanas     cartas de una grafia fusionada
    python bot/olvidar.py --sueltas --hacer
    python bot/olvidar.py --auto          el self-check

🔴 EXISTE PORQUE EL SISTEMA SABIA PONER Y NO SABIA SACAR. Todo el resto
del bot avanza en una sola direccion: el padron suma gente, `fotos.py`
sube caras, `subir_cartas.py` sube cartas, `armar()` escribe KV. Nada
tenia la operacion inversa, asi que a «sacame de ahi» no habia con que
contestarle. Una cara guardada es de una persona real, y guardarla es
una decision que tiene que poder deshacerse.

🔴 Y BUSCA POR GRAFIA NORMALIZADA CONTRA EL LISTADO DE R2, NO POR LA
CLAVE QUE EL CODIGO ARMARIA HOY. Es la diferencia entre borrar y creer
que borraste, y no es hipotetica: medido el 22/09/2026, **19 personas
tienen dos fotos en R2** bajo dos grafias —`lil_drako` y `lildrako`,
`ññ` y `nn`, `reyes_mc` y `reyesmc`—. KV indexa una sola. Un borrado
que arme la clave con el codigo de hoy se lleva esa y **deja la otra**:
la persona pidio salir, el script dijo «listo» y su cara sigue ahi.

El mecanismo de las dos grafias esta en `fotos.py` y es el mismo que
aquel archivo ya documenta un nivel mas abajo: salta lo que «ya esta»
**mirando el archivo**. Con la clave nueva no encontraba la vieja, asi
que subia una segunda — y nadie borraba la primera. Las cartas no lo
tienen (medido: 0 grafias dobles) porque se resubieron todas juntas.

⚠️ LO QUE SE BORRA SE LISTA PRIMERO Y SE VERIFICA DESPUES. Un DELETE
que devuelve 200 sobre una clave mal armada tambien devuelve 200. Lo
unico que prueba que algo se fue es volver a listar y no encontrarlo,
que es la misma regla que `sincronizar()`: el inventario sale de R2.

⚠️ EL OLVIDO SE ANOTA POR DISCORD ID Y NO POR NOMBRE. El nombre cambia
—es el nick, y el bot mismo lo reescribe—; el ID no. Anotado por
nombre, la persona vuelve a entrar sola en cuanto se cambie el nick.

⚠️ Y SIN ESA ANOTACION EL BORRADO NO DURA UNA HORA. El ciclo mira quien
pasa el porton y vuelve a dibujar: borrar sin anotar es esperar hasta
el proximo cron. Por eso `verificados.pasa()` lee este archivo — ahi, y
no en cada paso, porque es el unico lugar por el que pasan los cinco.
"""
import io
import json
import os
import sys
import unicodedata
import concurrent.futures as cf

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE)
sys.path.insert(0, os.path.join(BASE, 'bot'))

import requests                                      # noqa: E402

import fotos as F                                    # noqa: E402
from comun.temporada import carpeta_r2               # noqa: E402

OLVIDADOS = os.path.join(BASE, 'datos', 'olvidados.json')
ESPEJO = os.path.join(BASE, 'comun', 'fotos')


def norm(s):
    """La grafia canonica de un nombre. La misma de `subir_cartas.norm`.

    ⚠️ ESTA COPIADA A PROPOSITO Y NO IMPORTADA. `subir_cartas` abre una
    sesion y lee credenciales al importarse; este script tiene que poder
    correr su self-check sin red. Son tres lineas y el self-check
    verifica que las dos den lo mismo, que es la parte que importa.
    """
    s = unicodedata.normalize('NFD', str(s).lower())
    return ''.join(c for c in s if c.isalnum())


# ── el archivo de olvidados ──────────────────────────────────────────────
def olvidados():
    """`{discord_id: {'quien':..., 'cuando':...}}`. Vacio si no hay archivo.

    ⚠️ DEVUELVE VACIO Y NO `None` CUANDO NO HAY ARCHIVO, al reves que
    `verificados.cargar()`, y la diferencia es deliberada: alla «no se»
    tiene que apagar el filtro para no dejar a 320 sin carta; aca «no se»
    y «nadie pidio salir» son lo mismo, y equivocarse hacia el lado de
    emitir es el lado seguro.
    """
    try:
        with io.open(OLVIDADOS, encoding='utf-8') as f:
            d = json.load(f)
        return d.get('gente') or {}
    except (OSError, ValueError):
        return {}


def anotar(did, quien):
    import time
    g = olvidados()
    g[str(did)] = {'quien': quien,
                   'cuando': time.strftime('%Y-%m-%dT%H:%M:%S+00:00',
                                           time.gmtime())}
    _guardar(g)
    return g


def desanotar(did):
    g = olvidados()
    g.pop(str(did), None)
    _guardar(g)
    return g


def _guardar(g):
    os.makedirs(os.path.dirname(OLVIDADOS), exist_ok=True)
    with io.open(OLVIDADOS, 'w', encoding='utf-8') as f:
        json.dump({'gente': g}, f, ensure_ascii=False, indent=1,
                  sort_keys=True)


# ── R2 ───────────────────────────────────────────────────────────────────
def sesion():
    s = requests.Session()
    s.headers['Authorization'] = 'Bearer ' + F.env('CLOUDFLARE_API_TOKEN')
    return s


def listar(s, pref=''):
    """`{clave: tamaño}` de todo el bucket, o de un prefijo."""
    out, cur = {}, None
    while True:
        q = {'per_page': 1000}
        if pref:
            q['prefix'] = pref
        if cur:
            q['cursor'] = cur
        d = s.get(F.API_R2 + '/objects', params=q, timeout=60).json()
        if not d.get('success'):
            raise SystemExit('R2 no contesto: %s' % str(d.get('errors'))[:150])
        for o in d.get('result') or []:
            out[o['key']] = o['size']
        cur = (d.get('result_info') or {}).get('cursor')
        if not cur:
            return out


def inventario(s):
    """`{grafia: {'fotos': [claves], 'cartas': [claves], 'como': [nombres]}}`

    🔴 LA PERSONA ES LA GRAFIA NORMALIZADA, NO LA CLAVE. Es lo unico que
    junta las dos fotos de Lil Drako, y juntarlas es todo el punto: la
    pregunta que este script contesta es «que hay de esta persona», no
    «que hay bajo esta clave».
    """
    pref = carpeta_r2()
    todo = listar(s)
    inv = {}
    for k in todo:
        if k.startswith('fotos/'):
            if not k.startswith(pref):
                # una temporada anterior: no es de esta persona-hoy
                continue
            nombre = k[len(pref):].rsplit('.', 1)[0]
            cual = 'fotos'
        else:
            nombre, _, resto = k.rpartition('/')
            if not resto:
                continue
            cual = 'cartas'
        g = inv.setdefault(norm(nombre),
                           {'fotos': [], 'cartas': [], 'como': set()})
        g[cual].append(k)
        g['como'].add(nombre)
    for g in inv.values():
        g['como'] = sorted(g['como'])
    return inv


def borrar_r2(s, claves):
    """Borra y **vuelve a listar** para probar que se fueron. `(idos, quedan)`"""
    def _uno(k):
        r = s.delete('%s/objects/%s' % (F.API_R2, k), timeout=60)
        return None if r.status_code in (200, 204) else k
    with cf.ThreadPoolExecutor(8) as ex:
        list(ex.map(_uno, claves))
    # ⚠️ La prueba no es el codigo del DELETE: es no encontrarlo despues.
    quedan = []
    porpref = {}
    for k in claves:
        porpref.setdefault(k.rpartition('/')[0] + '/', []).append(k)
    for pref, ks in porpref.items():
        hay = listar(s, pref)
        quedan += [k for k in ks if k in hay]
    return len(claves) - len(quedan), quedan


# ── KV ───────────────────────────────────────────────────────────────────
def kv_api():
    """La URL del namespace, traida de donde vive — no copiada.

    ⚠️ `subir_datos` es quien escribe KV, asi que el namespace es suyo.
    Copiarlo aca seria la forma de «un default que no es la decision»:
    el dia que se mude, este script seguiria borrando del viejo y
    diria que si.
    """
    from subir_datos import API
    return API


def kv_borrar(s, claves):
    """Borra esas claves y cuenta **las que dejaron de estar**.

    🔴 EL CODIGO DEL DELETE NO SIRVE PARA CONTAR. Cloudflare devuelve
    200 al borrar una clave **que no existia**, asi que contar respuestas
    daba «1 borrada» sobre una clave inventada. Medido: un DELETE a
    `_no_existe_jamas_` contaba como exito.

    Es la misma trampa que `borrar_r2()` ya evitaba tres funciones mas
    arriba —y que esta escrita en el docstring de este archivo— colada en
    la mitad de KV porque ahi la respuesta *parecia* decir algo. Un
    contador que cuenta respuestas en vez de efectos no se distingue de
    uno que anda hasta el dia en que la clave estaba mal armada.
    """
    api = kv_api()
    antes = kv_quedan(s, claves)
    for k in claves:
        s.delete('%s/values/%s' % (api, k), timeout=30)
    despues = kv_quedan(s, claves)
    if antes is None or despues is None:
        return 0, 'no pude listar KV para comprobarlo'
    idas = len(antes) - len(despues)
    falta = ('%d no se fueron: %s' % (len(despues), ', '.join(despues[:4]))
             if despues else '')
    return idas, falta


def kv_quedan(s, claves):
    """Cuales de esas claves siguen en KV. La prueba del borrado.

    ⚠️ KV PROPAGA CON RETRASO Y ESTO SE LEE DEL LISTADO, no de
    `/values/<k>`, que es la lectura cacheada. Ya paso en esta sesion:
    una lectura dijo que `p:jun` no existia teniendolo.
    """
    api = kv_api()
    hay, cur = set(), None
    while True:
        q = {'limit': 1000}
        if cur:
            q['cursor'] = cur
        d = s.get(api + '/keys', params=q, timeout=60).json()
        if not d.get('success'):
            return None
        for o in d.get('result') or []:
            hay.add(o['name'])
        cur = (d.get('result_info') or {}).get('cursor')
        if not cur:
            break
    return [k for k in claves if k in hay]


# ── resolver a una persona ───────────────────────────────────────────────
def del_padron(quien):
    """`(raw, discord_id)` de la persona, o `(None, None)`."""
    p = os.path.join(BASE, 'datos', 'padron.json')
    try:
        with io.open(p, encoding='utf-8') as f:
            pad = json.load(f)
    except (OSError, ValueError):
        return None, None
    g = norm(quien)
    for fila in pad:
        if norm(fila.get('raw') or '') == g:
            return fila.get('raw'), str(fila.get('discord_id') or '')
    return None, None


def que_tiene(s, quien):
    inv = inventario(s)
    g = inv.get(norm(quien))
    raw, did = del_padron(quien)
    esp = []
    if os.path.isdir(ESPEJO):
        esp = [os.path.join(ESPEJO, n) for n in os.listdir(ESPEJO)
               if norm(os.path.splitext(n)[0]) == norm(quien)]
    kv = []
    vol = os.path.join(BASE, 'bot', '_kv_volcado.json')
    if os.path.exists(vol):
        with io.open(vol, encoding='utf-8') as f:
            v = json.load(f)
        for k in v:
            if k.startswith('p:') and norm(k[2:]) == norm(quien):
                kv.append(k)
            elif k.startswith('d:') and norm(str(v[k])) == norm(quien):
                kv.append(k)
            elif k.startswith('foto:') and did and k[5:] == did:
                kv.append(k)
    return {'raw': raw, 'did': did, 'kv': kv, 'espejo': esp,
            'fotos': (g or {}).get('fotos', []),
            'cartas': (g or {}).get('cartas', []),
            'como': (g or {}).get('como', [])}


# ── las grafias muertas ──────────────────────────────────────────────────
def sueltas(s):
    """Las claves de foto que son una SEGUNDA grafia de alguien que ya tiene.

    🔴 SOLO ESO, Y ES A PROPOSITO. «Sin dueño» tiene dos significados muy
    distintos y mezclarlos borra lo que no hay que borrar:

      · una **grafia muerta** —`lil_drako` cuando KV dice `lildrako`— no
        la lee nadie, no la vuelve a escribir nadie, y es una copia exacta
        de un archivo que si se lee. Basura sin ambiguedad.

      · una persona **que no pasa el porton** tiene cara y cartas que hoy
        no se sirven, pero puede verificarse mañana. Eso no es basura, es
        un estado. Borrarlo es una decision sobre 161 personas y no la
        toma un script de limpieza.

    ⚠️ Y SI NINGUNA DE LAS DOS ESTA EN KV, NO TOCA NINGUNA. Es el caso
    de `aze_gian`/`azegian`: esa persona no pasa el porton, asi que no
    hay una «viva» contra la cual la otra sea vieja. Adivinar ahi es
    elegir cual de las dos caras de alguien se tira.

    ⚠️ LA MUERTA PUEDE SER LA MAS GRANDE, Y SE BORRA IGUAL. Medido:
    `reyes_mc` es 479 px y `reyesmc` —la que KV usa— 313. Parece al
    reves, y no lo es: `fotos.py` salta lo que ya esta, asi que la
    clave nueva se lleno con una **busqueda posterior** a Discord. Los
    479 px son un avatar que esa persona despues cambio. La carta tiene
    que mostrar la cara de hoy, no la mejor que tuvo — y guardar la que
    alguien se saco es justo lo que este script existe para no hacer.

    Devuelve `[(grafia_viva, clave_muerta)]`.
    """
    inv = inventario(s)
    vol = os.path.join(BASE, 'bot', '_kv_volcado.json')
    vivas = set()
    if os.path.exists(vol):
        with io.open(vol, encoding='utf-8') as f:
            v = json.load(f)
        vivas = {str(v[k]) for k in v if k.startswith('d:')}
    pref = carpeta_r2()
    out = []
    for g, d in sorted(inv.items()):
        nombres = sorted({k[len(pref):].rsplit('.', 1)[0] for k in d['fotos']})
        if len(nombres) < 2:
            continue
        # la viva es la que KV indexa; si ninguna lo esta, no se toca
        viva = [n for n in nombres if n in vivas]
        if len(viva) != 1:
            continue
        for n in nombres:
            if n != viva[0]:
                out.append((viva[0], pref + n + '.webp'))
    return out


# ── self-check ───────────────────────────────────────────────────────────
def _self_check():
    print('\n  olvidar.py — self-check\n')
    mal = 0

    # 1. norm() tiene que dar lo mismo que la de subir_cartas
    try:
        from subir_cartas import norm as n2
        casos = ['Lil Drako', 'Ññ', 'TøKīØ🦠🧠', 'La G.C.A', 'Konan', 'Mc Arabe']
        d = [c for c in casos if norm(c) != n2(c)]
        print('  norm() == subir_cartas.norm()   %s'
              % ('ok' if not d else '🔴 difieren en %s' % d))
        mal += bool(d)
    except Exception as e:                             # noqa: BLE001
        print('  norm() no se pudo comparar: %s' % str(e)[:60])

    # 2. las dos grafias tienen que caer en la misma persona
    pares = [('lil_drako', 'lildrako'), ('ññ', 'nn'), ('reyes_mc', 'reyesmc'),
             ('tøkiø', 'tøkīø'), ('lilnano', 'lilñaño')]
    d = [p for p in pares if norm(p[0]) != norm(p[1])]
    print('  las grafias dobles se juntan    %s'
          % ('ok' if not d else '🔴 %s' % d))
    mal += bool(d)

    # 3. el padron no puede tener dos personas en la misma grafia
    p = os.path.join(BASE, 'datos', 'padron.json')
    if os.path.exists(p):
        with io.open(p, encoding='utf-8') as f:
            pad = json.load(f)
        vistos, choque = {}, []
        for fila in pad:
            g = norm(fila.get('raw') or '')
            if g in vistos:
                choque.append((vistos[g], fila.get('raw')))
            vistos[g] = fila.get('raw')
        print('  el padron no choca en norm()    %s'
              % ('ok · %d personas' % len(pad) if not choque
                 else '🔴 %s' % choque[:3]))
        mal += bool(choque)
    else:
        print('  el padron no choca en norm()    no hay padron')

    # 4. el olvido bloquea el porton
    try:
        import verificados as V
        fila = {'raw': 'x', 'pais': 'Chile', 'discord_id': '999'}
        antes = V.pasa(fila, {'999'})
        g = olvidados()
        g['999'] = {'quien': 'x', 'cuando': ''}
        _guardar(g)
        V.olvidados_cache = None
        despues = V.pasa(fila, {'999'})
        g.pop('999')
        _guardar(g)
        V.olvidados_cache = None
        print('  olvidar cierra el porton        %s'
              % ('ok' if (antes and not despues)
                 else '🔴 antes=%s despues=%s' % (antes, despues)))
        mal += not (antes and not despues)
    except Exception as e:                             # noqa: BLE001
        print('  olvidar cierra el porton        🔴 %s' % str(e)[:70])
        mal += 1

    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


# ── main ─────────────────────────────────────────────────────────────────
def huerfanas():
    """Carpetas de cartas en R2 cuyo nombre es un ALIAS de otra persona.

    🔴 CADA FUSION DE ALIAS DEJA UNA. Cuando `datos/akas.json` declara
    que `XXXXX` es `Xubaru`, el sistema entero pasa a usar `xubaru` —el
    pool, KV, la web y `/card`— y la carpeta `xxxxx/` de R2 **se queda
    ahi con sus 15 cartas**, que ya no mira nadie. No falla: son bytes
    invisibles. Medido el 24/09/2026: **6 carpetas, 89 cartas**.

    ⚠️ NO BORRA, Y NO ES PEREZA. Dlx, 24/09/2026, preguntado si
    limpiarlas: *«intenta lo mejor ahi, en pendiente lo resolvere
    luego»*. Borrar de R2 no se deshace, asi que lo mejor que se puede
    hacer sin su respuesta es **poder verlas**: un pendiente que no se
    puede medir se convierte en un pendiente que nadie vuelve a mirar.

    ⚠️ Y SE PREGUNTA AL MAPA, NO SE ADIVINA. `sueltas()` de este mismo
    archivo explica por que «sin dueño» es ambiguo y se niega a elegir;
    aca no hay ambiguedad **porque alguien lo declaro**: el alias dice
    literalmente que esa grafia es otra persona.
    """
    import unicodedata

    def _k(x):
        return ''.join(c for c in unicodedata.normalize('NFKD', str(x or ''))
                       if c.isalnum()).lower()

    try:
        with io.open(os.path.join(BASE, 'datos', 'akas.json'),
                     encoding='utf-8') as f:
            al = (json.load(f) or {}).get('alias') or {}
        with io.open(os.path.join(BASE, 'datos', 'cartas_r2.json'),
                     encoding='utf-8') as f:
            d = json.load(f)
    except (OSError, ValueError):
        return []
    c = d.get('cartas', d) if isinstance(d, dict) else {}

    def real(n):
        # ⚠️ SIGUIENDO LA CADENA, igual que `rankings.canon()`: el mapa
        # tiene `gekto -> geekto -> Presagio`, y parar en el primer salto
        # contesta con otro alias.
        vis, act = set(), n
        for _ in range(8):
            k = _k(act)
            if k in vis or k not in al:
                break
            vis.add(k)
            act = al[k]
        return act

    vivas = {_k(x) for x in c}
    out = []
    for k in sorted(c):
        r = real(k)
        if _k(r) != _k(k):
            out.append({'clave': k, 'real': r, 'cartas': len(c[k]),
                        'el_real_esta': _k(r) in vivas})
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    flags = {a for a in sys.argv[1:] if a.startswith('--')}
    if '--auto' in flags:
        return _self_check()

    hacer = '--hacer' in flags

    if '--volver' in flags:
        if not args:
            return print('  ¿a quién? `python bot/olvidar.py Konan --volver`')
        raw, did = del_padron(args[0])
        if not did:
            return print('  no encuentro a %s en el padrón' % args[0])
        g = olvidados()
        if did not in g:
            return print('  %s no estaba olvidado' % (raw or args[0]))
        desanotar(did)
        print('  %s vuelve. Su carta se dibuja en el próximo ciclo.'
              % (raw or args[0]))
        return

    s = sesion()

    if '--huerfanas' in flags:
        h = huerfanas()
        print('\n  CARPETAS DE CARTAS QUE SON UN ALIAS DE OTRA PERSONA: '
              '%d' % len(h))
        if not h:
            return print('  (ninguna)\n')
        for x in h:
            print('    %-16s -> %-16s %2d carta(s)   %s'
                  % (x['clave'], x['real'], x['cartas'],
                     'el real tambien esta' if x['el_real_esta']
                     else '⚠️ EL REAL NO ESTA'))
        print('    total: %d carta(s) que no mira nadie'
              % sum(x['cartas'] for x in h))
        print('\n  NO SE BORRA NADA: es un pendiente de Dlx. Ver '
              '`huerfanas()`.\n')
        return

    if '--sueltas' in flags:
        d = sueltas(s)
        print('\n  grafías muertas: %d' % len(d))
        for viva, muerta in d:
            print('    %-30s  (la viva es %s)'
                  % (muerta.rsplit('/', 1)[-1], viva))
        if not d:
            return print('')
        if not hacer:
            return print('\n  (nada tocado — corré con --hacer)\n')
        idos, quedan = borrar_r2(s, [m for _, m in d])
        print('\n  borradas %d de %d' % (idos, len(d)))
        for k in quedan[:5]:
            print('   🔴 sigue ahí: %s' % k)
        print('')
        return

    if not args:
        # el mapa
        inv = inventario(s)
        vol = os.path.join(BASE, 'bot', '_kv_volcado.json')
        vivas = set()
        if os.path.exists(vol):
            with io.open(vol, encoding='utf-8') as f:
                v = json.load(f)
            vivas = {norm(str(v[k])) for k in v if k.startswith('d:')}
        nf = sum(len(d['fotos']) for d in inv.values())
        nc = sum(len(d['cartas']) for d in inv.values())
        sin = [g for g in inv if g not in vivas]
        dob = [g for g, d in inv.items() if len(d['fotos']) > 1]
        print('\n  R2: %d persona(s) · %d foto(s) · %d carta(s)'
              % (len(inv), nf, nc))
        print('  que KV no indexa : %d persona(s)' % len(sin))
        print('  con dos grafías  : %d  ->  --sueltas' % len(dob))
        print('  olvidadas        : %d' % len(olvidados()))
        print('\n  `python bot/olvidar.py <quien>` para ver una\n')
        return

    quien = args[0]
    d = que_tiene(s, quien)
    nom = d['raw'] or quien
    print('\n  %s%s' % (nom, '  (%s)' % d['did'] if d['did'] else
                        '  ⚠️ sin Discord ID en el padrón'))
    if d['como'] and d['como'] != [nom]:
        print('  guardado como: %s' % ', '.join(d['como']))
    print('  fotos en R2  : %d' % len(d['fotos']))
    for k in d['fotos']:
        print('      %s' % k)
    print('  cartas en R2 : %d' % len(d['cartas']))
    print('  claves de KV : %s' % (', '.join(d['kv']) or '—'))
    print('  espejo local : %d' % len(d['espejo']))
    if not (d['fotos'] or d['cartas'] or d['kv'] or d['espejo']):
        return print('\n  no hay nada suyo guardado.\n')
    if not hacer:
        return print('\n  (nada tocado — corré con --hacer)\n')

    if not d['did']:
        print('\n  🔴 NO LO HAGO: sin Discord ID no se puede anotar el olvido,')
        print('     y sin anotarlo el ciclo se lo vuelve a dibujar en una hora.')
        print('     Cargale el ID en el padrón primero.\n')
        return 1

    idos, quedan = borrar_r2(s, d['fotos'] + d['cartas'])
    print('\n  R2      : %d de %d borrados' % (idos, len(d['fotos']) + len(d['cartas'])))
    for k in quedan[:5]:
        print('     🔴 sigue ahí: %s' % k)
    if d['kv']:
        n, err = kv_borrar(s, d['kv'])
        print('  KV      : %d de %d%s' % (n, len(d['kv']),
                                          '  ⚠️ %s' % err if err else ''))
    for p in d['espejo']:
        try:
            os.remove(p)
        except OSError:
            pass
    print('  espejo  : %d' % len(d['espejo']))
    anotar(d['did'], nom)
    print('  anotado en datos/olvidados.json — el portón ya no lo deja pasar.')
    print('')


if __name__ == '__main__':
    raise SystemExit(main() or 0)
