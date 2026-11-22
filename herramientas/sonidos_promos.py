# -*- coding: utf-8 -*-
"""🔊 LAS PROMOS SUENAN: las canciones e instrumentales que la gente de la Liga promociona, sonando en la página (22/11/2026).

Dlx, a «¿cómo usamos las canciones de los canales de promoción?»: *«B, que suenen en sus promos y tmb en otras historias
o publicaciones así como instagram que algunas tienen sonido»*. O sea:
  · cada PROMO suena con un pedazo de su propia canción (su historia y su publicación), con su crédito y su link
  · los INSTRUMENTALES que alguien promociona se suman a los beats de las demás historias y publicaciones
  · las canciones con voz, sólo en su propia promo: de fondo de otra cosa le cambiarían el sentido a las dos

    python herramientas/sonidos_promos.py            # qué hay y qué falta, sin bajar ni subir nada
    python herramientas/sonidos_promos.py --hacer    # baja lo que falta, recorta, sube a R2 y deja la lista en R2
    python herramientas/sonidos_promos.py --auto     # self-check, sin red

⚠️ SE CORRE DESDE UNA PC, NO EN EL CICLO: YouTube no deja bajar desde los runners de GitHub (probado el 22/11/2026 con
tres videos: «Sign in to confirm you're not a bot»), y saltarlo pide las cookies de una cuenta, que es un secreto nuevo.
Por eso todo vive en R2 y no en el repo: una promo nueva suena en cuanto alguien corre esto, sin commitear ni
recompilar la página. Y R2 se borra de verdad; el historial de git no.

DE DÓNDE SALEN (las reglas de `bot/promos.py`, el mismo lector):
  · los canales de promoción que ya encuentra el ciclo (`canales` de `datos/promos.json`), `HISTORIA_D` días hacia atrás
  · SÓLO lo que publicó alguien de la Lista con su Discord ID (`promos.promo_de()`): nadie de afuera usa a la Liga
  · sólo YouTube y SoundCloud (Spotify no se puede bajar); afuera las batallas, los videos con invitados que no son la
    persona (`ft.`), y lo que el Dashboard sacó (`quitar`): si alguien pide salir, se saca ahí y la próxima corrida borra
    su recorte

QUÉ ES CADA UNO: instrumental si el título lo dice (beat, instrumental, type beat, base de rap, prod.) y no es un video
con invitados; si además dice su estilo (boom bap, trap, drill) entra al banco de beats de ese estilo. Lo demás es una
canción: suena sólo en su promo.

LO QUE DEJA EN R2 (bucket `cartas`, el público):
  · `sonidos/promos/<id>.m4a`: 30 s de cada canción (desde donde arranca de verdad, sin la intro) y 42 s de cada
    instrumental, a −16 LUFS como los beats, AAC 96 kbps
  · `sonidos/lista.json`: `{t, promos: {<id>: {a, t, b, u, i?}}, beats: {boombap: [...], trap: [...], drill: [...]}}`. La
    página la pide al abrir las historias (`web/src/beats.js`, `cargarExtras()`)
"""
import datetime as dt
import io
import json
import os
import re
import shutil
import sys
import tempfile
import time

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, 'bot'))
sys.path.insert(0, os.path.join(BASE, 'herramientas'))
sys.path.insert(0, BASE)

#: cuántos días hacia atrás se miran los canales, y cuánto dura cada recorte
HISTORIA_D = 180
LARGO_CANCION, LARGO_INSTR = 30, 42
#: lo que no entra: duración rara, batallas, videos con invitados
MIN_S, MAX_S = 45, 900
INSTR = re.compile(r'\bbeats?\b|instrumental|type\s*beat|base\s+de\s+rap|\bprod\b\.?|\bpista\b', re.I)
CON_OTROS = re.compile(r'\bft\b\.?|\bfeat\b\.?|\bx\s+@', re.I)
#: lo que es un tema aunque diga «beat» (22/11/2026: «Debe entender beat 808 audio official de filozico» es una canción)
CANCION = re.compile(r'audio\s+off?ici?al|video\s+off?ici?al|official\s+(audio|video)|visuali[sz]er|lyric|letra|\(ep\)|\b[aá]lbum\b|\balbum\b', re.I)
BATALLA = re.compile(r'\bvs\b\.?|batalla|octavos|cuartos|semifinal|\bfinal\b|jornada|\bfms\b|red\s*bull|minuto\s+(a\s+sangre|libre)', re.I)
ESTILO = [('drill', re.compile(r'drill', re.I)), ('boombap', re.compile(r'boom\s*-?\s*bap|boombap|old\s*school', re.I)),
          ('trap', re.compile(r'\btrap\b|808', re.I))]
PREFIJO = 'sonidos/promos/'
LISTA_R2 = 'sonidos/lista.json'


def env(k):
    """Del entorno, del .env que diga `LG_ENV` (la tarea programada: ver sonidos_promos_tarea.py) o del .env del repo."""
    if os.environ.get(k):
        return os.environ[k]
    p = os.environ.get('LG_ENV')
    if p and os.path.exists(p):
        for linea in io.open(p, encoding='utf-8'):
            if linea.strip().startswith(k + '='):
                return linea.split('=', 1)[1].strip().strip('"\'')
    import fotos as F
    return F.env(k)


def clase(titulo):
    """`('instrumental' | 'cancion' | '', estilo)`: '' es que no entra (una batalla)."""
    t = titulo or ''
    if BATALLA.search(t):
        return '', ''
    if INSTR.search(t) and not CON_OTROS.search(t) and not CANCION.search(t):
        return 'instrumental', next((k for k, r in ESTILO if r.search(t)), '')
    return 'cancion', ''


def clave_de(x):
    """El nombre del recorte: el id de YouTube, o uno armado con el link de SoundCloud."""
    if x.get('vid'):
        return x['vid']
    import hashlib
    return 'sc' + hashlib.sha1(x['url'].encode('utf-8')).hexdigest()[:12]


def leer_canales(dias=HISTORIA_D):
    """Las promos de los canales de promoción de los últimos `dias`, con las reglas de bot/promos.py."""
    import promos as P
    viejo = P.leer()
    canales = viejo.get('canales') or {}
    import requests
    s = requests.Session()
    s.headers['Authorization'] = 'Bot ' + env('DISCORD_TOKEN')
    ids = P._padron_ids()
    corte = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=dias)).strftime('%Y-%m-%dT%H:%M:%S')
    out = {}
    for sv, cids in canales.items():
        for cid in cids:
            antes = ''
            for _ in range(20):
                q = '%s/channels/%s/messages?limit=100' % (P.API, cid) + ('&before=%s' % antes if antes else '')
                r = s.get(q, timeout=25)
                if r.status_code == 429:
                    time.sleep(float(r.json().get('retry_after', 1)) + 0.3)
                    continue
                if r.status_code != 200:
                    print('   ⚠️ %s: no puedo leer su canal de promoción (%d)' % (sv, r.status_code))
                    break
                ms = r.json() or []
                if not ms:
                    break
                for m in ms:
                    for x in P.promo_de(m, sv, ids):
                        if x['plat'] in ('yt', 'sc') and x['t'] >= corte:
                            out.setdefault(clave_de(x), x)
                antes = ms[-1]['id']
                if str(ms[-1].get('timestamp') or '') < corte:
                    break
    quitar = {P._clave_url(u) for u in viejo.get('quitar') or []}
    return {k: x for k, x in out.items() if P._clave_url(x['url']) not in quitar}, quitar


def limpio(t):
    """El título para el crédito: sin «(Visualizer)», «(Video Lyric)», «audio oficial de…» ni lo que va después de «|»."""
    o = (t or '').strip()
    t = re.sub(r'\s*[\(\[][^\)\]]*(visuali|lyric|video|audio|ofici|offici|\bep\b|prod)[^\)\]]*[\)\]]', '', o, flags=re.I)
    t = re.sub(r'\s*(audio|video)\s+off?ici?al.*$', '', t, flags=re.I)
    t = re.split(r'\s*\|\|?\s*', t)[0]
    t = re.sub(r'\s+', ' ', t).strip(' -·|')
    return t or o


def ficha(x):
    """Título, artista y duración desde la plataforma (sin bajar el audio)."""
    import yt_dlp
    u = 'https://www.youtube.com/watch?v=' + x['vid'] if x.get('vid') else x['url']
    with yt_dlp.YoutubeDL({'quiet': True, 'no_warnings': True, 'skip_download': True, 'socket_timeout': 30}) as y:
        i = y.extract_info(u, download=False)
    return {'t': limpio(i.get('track') or i.get('title') or ''), 'titulo': i.get('title') or '', 'b': (i.get('artist') or i.get('uploader') or '').strip(),
            'd': i.get('duration') or 0, 'u': 'https://youtu.be/' + x['vid'] if x.get('vid') else x['url']}


def recortar(origen, salida, desde, largo):
    import subprocess
    fin = largo - 0.6
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(desde), '-t', str(largo), '-i', origen,
                    '-af', 'afade=t=in:d=0.3,afade=t=out:st=%s:d=0.6,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100' % fin,
                    '-ac', '2', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', salida], check=True)


def r2():
    import requests
    import fotos as F
    s = requests.Session()
    s.headers['Authorization'] = 'Bearer ' + env('CLOUDFLARE_API_TOKEN')
    return s, F.API_R2


def r2_subir(s, api, clave, datos, tipo):
    for n in range(3):
        r = s.put('%s/objects/%s' % (api, clave), data=datos, headers={'Content-Type': tipo}, timeout=60)
        if r.status_code < 300:
            return True
        time.sleep(1.5 * (n + 1))
    print('   ⚠️ R2 %s: %s %s' % (clave, r.status_code, r.text[:80]))
    return False


def r2_lista_vieja():
    import requests
    import fotos as F
    pub = 'https://pub-70d5821d06a8432c9cffd0c102195000.r2.dev/'
    try:
        r = requests.get(pub + LISTA_R2, timeout=20)
        return r.json() if r.status_code == 200 else {}
    except Exception:                                    # noqa: BLE001
        return {}


def armar_lista(fichas):
    """La lista que lee la página, a partir de `{clave: ficha con 'clase' y 'estilo'}` (sólo las que tienen recorte)."""
    promos, beats = {}, {'boombap': [], 'trap': [], 'drill': []}
    for k, f in sorted(fichas.items(), key=lambda kv: kv[1].get('desde_t', ''), reverse=True):
        e = {'a': PREFIJO + k + '.m4a', 't': f['t'][:60], 'b': f['b'][:40], 'u': f['u']}
        if f['clase'] == 'instrumental':
            e['i'] = 1
        promos[k] = e
        if f['clase'] == 'instrumental' and f.get('estilo') in beats:
            beats[f['estilo']].append({kk: e[kk] for kk in ('a', 't', 'b', 'u')})
    return {'t': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'promos': promos, 'beats': beats}


def combinar(vieja, nueva, en_canales, sin_ficha):
    """🛡️ La lista que se sube y lo que se borra, sin perder nada por una falla (22/11/2026: la primera vuelta de la tarea
    programada corrió sin yt-dlp, no leyó ninguna ficha, subió una lista vacía y borró los 16 recortes).

    `vieja`: la lista que está en R2; `nueva`: la armada con lo que salió bien esta vez; `en_canales`: las claves que siguen
    en los canales; `sin_ficha`: las que no se pudieron mirar esta vez. Devuelve `(lista, sobra, frenado)`:
      · lo que no se pudo mirar pero sigue en los canales y ya tenía recorte queda como estaba
      · se borra sólo lo que ya no está en la lista: salió de los canales, lo sacó el Dashboard o ahora no entra
      · y si eso es más de la mitad de lo que había (y más de 3), no se borra nada: es más probable una falla que una
        limpieza, y un recorte de más no le hace daño a nadie"""
    viejas = (vieja or {}).get('promos') or {}
    lista = {'t': nueva['t'], 'promos': dict(nueva['promos']), 'beats': {e: list(v) for e, v in nueva['beats'].items()}}
    for k in sin_ficha:
        if k in viejas and k in en_canales and k not in lista['promos']:
            lista['promos'][k] = viejas[k]
            for e, xs in ((vieja or {}).get('beats') or {}).items():
                lista['beats'].setdefault(e, []).extend(x for x in xs if x.get('a') == PREFIJO + k + '.m4a')
    sobra = sorted(set(viejas) - set(lista['promos']))
    frenado = len(sobra) > 3 and len(sobra) * 2 > len(viejas)
    return lista, ([] if frenado else sobra), frenado


def correr(hacer=False):
    from beats_historias import bajar, donde_arranca
    # 🛡️ sin yt-dlp no se puede mirar ninguna: no se toca R2 (ver `combinar()`)
    try:
        import yt_dlp  # noqa: F401
    except ImportError:
        print('   ❌ falta yt-dlp (pip install yt-dlp): no toco nada en R2')
        return 1
    items, quitar = leer_canales()
    if not items:
        print('   ❌ no leí ninguna promo de los canales: no toco nada en R2')
        return 1
    vieja = r2_lista_vieja()
    hechos = set((vieja.get('promos') or {}).keys())
    print('   📣 %d promo(s) de YouTube y SoundCloud en %d días, de gente de la Lista · %d ya con sonido en R2'
          % (len(items), HISTORIA_D, len(hechos & set(items))))
    fichas, sin_ficha = {}, set()
    for k, x in items.items():
        try:
            f = ficha(x)
        except Exception as e:                           # noqa: BLE001
            print('   ⚠️ %s: sin ficha (%s)' % (x['url'][:50], str(e)[:80]))
            sin_ficha.add(k)
            continue
        c, est = clase(f['titulo'])
        if not c or not (MIN_S <= (f['d'] or 0) <= MAX_S):
            print('   ·  fuera: %-50s (%s)' % (f['titulo'][:50], 'batalla' if not c else '%ss' % f['d']))
            continue
        f.update({'clase': c, 'estilo': est, 'quien': x['quien'], 'sv': x['sv'], 'desde_t': x['t']})
        fichas[k] = f
        print('   %s %-12s %-8s %-46s %s' % ('✅' if k in hechos else '➕', c, est or '—', f['titulo'][:46], x['quien'][:16]))
    if not hacer:
        return 0
    if len(sin_ficha) == len(items):
        print('   ❌ no pude mirar ninguna (¿YouTube, la red, yt-dlp viejo?): no toco nada en R2')
        return 1
    s, api = r2()
    tmp = tempfile.mkdtemp(prefix='promos_')
    try:
        for k, f in fichas.items():
            if k in hechos:
                continue
            try:
                origen = bajar(items[k]['vid'], tmp) if items[k].get('vid') else _bajar_url(items[k]['url'], tmp)
                largo = LARGO_INSTR if f['clase'] == 'instrumental' else LARGO_CANCION
                desde = donde_arranca(origen, largo)
                salida = os.path.join(tmp, k + '.m4a')
                recortar(origen, salida, desde, largo)
                with open(salida, 'rb') as fh:
                    ok = r2_subir(s, api, PREFIJO + k + '.m4a', fh.read(), 'audio/mp4')
                print('   %s %-12s desde %5.1f s · %s' % ('⬆️' if ok else '⚠️', k, desde, f['titulo'][:50]))
                if ok:
                    hechos.add(k)
            except Exception as e:                       # noqa: BLE001
                print('   ⚠️ %s: %s' % (f['titulo'][:40], str(e)[:120]))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    # ⚠️ con la ficha de ESTA vuelta y los recortes que hay: lo que ya tenía recorte y no se pudo mirar queda (`combinar()`)
    nueva = armar_lista({k: f for k, f in fichas.items() if k in hechos})
    lista, sobra, frenado = combinar(vieja, nueva, set(items), sin_ficha)
    ok = r2_subir(s, api, LISTA_R2, json.dumps(lista, ensure_ascii=False).encode('utf-8'), 'application/json')
    if ok:
        for k in sobra:
            s.delete('%s/objects/%s' % (api, PREFIJO + k + '.m4a'), timeout=30)
    if frenado:
        print('   🛑 sobraban más de la mitad de los recortes: no borré ninguno (es más probable una falla que una limpieza)')
    print('   📝 %s · %d con sonido · beats: %s · borrados %d' % ('lista en R2' if ok else '⚠️ la lista NO se subió', len(lista['promos']),
          ', '.join('%s %d' % (e, len(v)) for e, v in lista['beats'].items()), len(sobra) if ok else 0))
    return 0 if ok else 1


def _bajar_url(u, dir_):
    import yt_dlp
    o = {'quiet': True, 'no_warnings': True, 'format': 'bestaudio/best', 'outtmpl': os.path.join(dir_, '%(id)s.%(ext)s'),
         'noplaylist': True, 'socket_timeout': 30}
    with yt_dlp.YoutubeDL(o) as y:
        i = y.extract_info(u, download=True)
        return y.prepare_filename(i)


def _self_check():
    malos = 0

    def ok(c, que):
        nonlocal malos
        print('  %s %s' % ('✅' if c else '❌', que))
        malos += 0 if c else 1
    ok(clase('Beat 808 oscuro | Prod. Alguien') == ('instrumental', 'trap'), 'un beat con «808» es instrumental de trap')
    ok(clase('Debe entender beat 808 audio official de filozico')[0] == 'cancion', 'pero si dice «audio oficial» es un tema, aunque diga beat')
    ok(clase('RUBIK - HIPNOSIS (Visualizer)') == ('cancion', ''), 'un tema es una canción: suena sólo en su promo')
    ok(clase('Hawler x @kiorOnTheBeat - K vamo a hacer')[0] == 'cancion', 'una colaboración es canción, nunca instrumental del banco')
    ok(clase('Beat Boom Bap ft. Alguien')[0] == 'cancion', 'con invitados no entra al banco de beats')
    ok(clase('CRATER VS MAKMA | OCTAVOS DE FINAL')[0] == '', 'una batalla no suena: no es una canción')
    ok(clase('Base de rap boom bap "Sky"') == ('instrumental', 'boombap'), 'una base de boom bap entra a su estilo')
    ok(clase('Instrumental oscuro') == ('instrumental', ''), 'un instrumental sin estilo suena en su promo, no en el banco')
    l = armar_lista({'abc': {'t': 'X', 'b': 'Y', 'u': 'https://youtu.be/abc', 'clase': 'instrumental', 'estilo': 'drill'},
                     'def': {'t': 'Z', 'b': 'W', 'u': 'https://youtu.be/def', 'clase': 'cancion', 'estilo': ''}})
    ok(set(l['promos']) == {'abc', 'def'} and [x['a'] for x in l['beats']['drill']] == ['sonidos/promos/abc.m4a'] and not l['beats']['trap'],
       'la lista: todas en `promos`, y en `beats` sólo los instrumentales con estilo')
    ok(l['promos']['abc'].get('i') == 1 and 'i' not in l['promos']['def'], 'y marca cuáles son instrumentales')
    ok([limpio(x) for x in ('RUBIK - HIPNOSIS (Visualizer)', 'Debe entender beat 808 audio official de filozico',
                            'PARADOJAS MAL DESCRITAS | DLOSCORIA', '7PO- LA MENTE (Video Lyric)', 'Estaba Dicho.  (EP)')]
       == ['RUBIK - HIPNOSIS', 'Debe entender beat 808', 'PARADOJAS MAL DESCRITAS', '7PO- LA MENTE', 'Estaba Dicho.'],
       'el crédito sin «(Visualizer)», «audio oficial de…» ni lo de después de «|»')
    # 🛡️ el 22/11/2026 una vuelta sin yt-dlp borró los 16: lo que no se pudo mirar no se borra, y un borrado masivo se frena
    v = {'promos': {k: {'a': PREFIJO + k + '.m4a', 't': k, 'b': 'x', 'u': 'u'} for k in 'abcdefgh'},
         'beats': {'drill': [{'a': PREFIJO + 'b.m4a', 't': 'b', 'b': 'x', 'u': 'u'}]}}
    n = armar_lista({'a': {'t': 'A', 'b': 'x', 'u': 'u', 'clase': 'cancion', 'estilo': ''}})
    l2, so, fr = combinar(v, n, set('abcdefgh'), set('bcdefgh'))
    ok(set(l2['promos']) == set('abcdefgh') and not so and not fr and l2['beats']['drill'],
       'lo que ya tenía recorte y no se pudo mirar esta vez queda, con su lugar en los beats')
    l3, so, fr = combinar(v, n, set('abcdefgh') - {'h'}, set('bcdefg'))
    ok(so == ['h'] and not fr, 'lo que salió de los canales sí se borra')
    l4, so, fr = combinar(v, armar_lista({}), set('ab'), set())
    ok(fr and so == [], 'y si iba a borrar más de la mitad, no borra nada')
    print('\n%s' % ('✅ los sonidos de las promos' if not malos else '❌ %d falla(s)' % malos))
    return 1 if malos else 0


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:                                    # noqa: BLE001
        pass
    a = sys.argv[1:]
    sys.exit(_self_check() if '--auto' in a else correr(hacer='--hacer' in a))
