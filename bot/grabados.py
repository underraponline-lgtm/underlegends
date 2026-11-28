# -*- coding: utf-8 -*-
"""🎙️💎 LOS EVENTOS GRABADOS, DEL LADO DEL MOTOR (28/11/2026, el paso 7 del plan del sábado).

Dlx, 27/11: «30 s gratis de cada ronda, tu propia batalla completa gratis, el evento entero para Premium (audio servido
por el Worker, no link público)». La regla y el Worker viven en `bot/grabados.js`; esto es lo que hace el motor
(`procesar.yml`, GitHub Actions) con lo que YA tiene en la mano después de `archivo_reels.audios()`:

  1. por cada batalla que separó (el m4a sin los vacíos y su `detalle()`), corta el ADELANTO de 30 s con `-c copy`
     (`cortar_previa()`: sin volver a codificar, en el runner de GitHub y no en Railway) y su letra de esos 30 s
     (`det_previa()`);
  2. sube los cuatro archivos a un lugar PRIVADO de R2 (`prefijo()`): el bucket `BUCKET_GRABADOS` si existe; si no, el
     de las cartas bajo `grab/<evento>-<32 hex al azar>/`, una clave que no se puede adivinar y que nunca sale del Worker;
  3. registra el evento en el Worker (`POST /grabados/registrar`, con la clave del ciclo): qué batallas, quién rapeó
     cada una (los Discord ID de `personas` del batallas.json de ULAYA) y dónde está la grabación entera en Logs
     (el mismo `grab-*.json` que ya va a KV `grab:<llave>` para el staff).

🔑 EL GRABADOR (Railway) NO CAMBIA. Todo lo que hace falta ya sale en su entrega: la mezcla, `habla.json` y
`batallas.json` con los IDs. Cortar acá y no allá es la regla del plan Hobby: nada pesado nuevo en Railway, y nada
que obligue a reiniciarlo.

🔑 UNA SOLA LLAMADA DESDE EL MOTOR: `desde_motor()`. El motor (repo privado) la importa de este checkout: `procesar.yml`
baja el repo público en la raíz y el motor en `m/`, y corre con `UL_RAIZ=$GITHUB_WORKSPACE`, así que
`sys.path.insert(0, UL_RAIZ/bot)` + `import grabados` encuentra este archivo (y él a `subir_cartas` y `clave_ciclo`).
⚠️ Por eso ESTE archivo tiene que estar en main ANTES que el cambio del motor: si no, el motor dice «grabados: falta» y
ese evento queda sin audio (nunca vuelve a lo público).

🗝️ EL ÍNDICE PRIVADO DEL MOTOR (`indice_leer()`/`indice_guardar()`): el evento entero de YouTube y las portadas de
Instagram leían `reels/audios.json` público para encontrar cada batalla. Ahora leen lo mismo de una clave que sólo calcula
quien tiene el token del bot (`clave_indice()`), por la API de R2 y no por r2.dev.

⚠️ LOS DOS LADOS LEEN IGUAL EL REGISTRO: `bot/grabados_casos.json` trae una entrada del motor y el registro que tiene
que salir; `--auto` lo arma acá y `bot/grabados_prueba.mjs` lo limpia con `limpiarRegistro()` del Worker. Si uno
cambia la forma y el otro no, CI se pone rojo.

Uso:
    python bot/grabados.py --auto                 el self-check, sin red (corta un adelanto de verdad si hay ffmpeg)
    python bot/grabados.py --config               lo que hay (días que se guarda cada cosa, el foro)
    python bot/grabados.py --config dias_entera=30 dias_previa=90 dias_evento=30 foro=true mejor_libre=true
    python bot/grabados.py --podar                borra lo vencido (lo hace solo también en cada registro)
    (el foro de DRA: un post por servidor, bot/grabados_foro.py; `foro=true` lo prende)
"""
import io
import json
import os
import secrets
import shutil
import subprocess
import sys
import tempfile

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
CASOS = os.path.join(SCR, 'grabados_casos.json')
WORKER = 'https://liga-global-bot.liga-global-ul.workers.dev'
PREVIA_S = 30
#: las mismas cotas que `limpiarRegistro()` de bot/grabados.js
MAX_BATALLAS, MAX_IDS, MAX_PARTES = 60, 8, 12

def _env(clave):
    v = os.environ.get(clave)
    if v:
        return v
    p = os.path.join(BASE, '.env')
    if os.path.exists(p):
        for linea in io.open(p, encoding='utf-8'):
            if linea.strip().startswith(clave + '='):
                return linea.split('=', 1)[1].strip().strip('"\'')
    return ''


def bucket():
    """`('g', nombre)` si hay un bucket privado (`BUCKET_GRABADOS`); si no, `('c', 'cartas')`."""
    b = _env('BUCKET_GRABADOS')
    return ('g', b) if b else ('c', 'cartas')


def prefijo(ev, bk, azar=None):
    """Dónde van los archivos de un evento. En el bucket privado, `grab/<ev>/`; en el público, con 128 bits al azar."""
    if bk == 'g':
        return 'grab/%s/' % ev
    return 'grab/%s-%s/' % (ev, azar or secrets.token_hex(16))


def cortar_previa(entrada, salida, desde=0.0, largo=PREVIA_S):
    """✂️ El adelanto: `largo` s desde `desde`, sin volver a codificar (AAC: cada cuadro se puede cortar)."""
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', '%.2f' % max(0.0, desde), '-i', entrada, '-t', '%.2f' % largo,
                    '-c', 'copy', '-movflags', '+faststart', salida], check=True)
    return salida


def det_previa(D, desde=0.0, largo=PREVIA_S):
    """La letra, los turnos y el calor de esos 30 s, corridos a 0: el adelanto no lleva la letra de la batalla entera."""
    if not isinstance(D, dict):
        return None
    hasta = desde + largo
    corre = lambda xs: [[round(x[0] - desde, 2)] + list(x[1:]) for x in xs or [] if desde <= float(x[0]) < hasta]
    cal = D.get('calor') or []
    return {'turnos': corre(D.get('turnos')), 'letra': corre(D.get('letra')),
            'calor': cal[int(desde // 5):int(hasta // 5) + 1]}


def ids_de(b):
    """Los Discord ID de quienes rapearon esa batalla (`personas` de ULAYA: `[[{n, id}], …]`), sin repetir."""
    out = []
    for lado in b.get('personas') or []:
        for p in lado or []:
            i = str((p or {}).get('id') or '')
            if i.isdigit() and 15 <= len(i) <= 22 and i not in out:
                out.append(i)
    return out[:MAX_IDS]


def armar(ev, ll, sv, dia, batallas, archivos, nombre='', g='', ini=0, partes=None, mejor=None, bk='c', mejor_det=None):
    """📦 El registro para el Worker. `batallas`: `[(k, b)]` con `b` del guion de ULAYA; `archivos`: `{k: {entera, previa,
    det, detp}}` con `{k: clave R2, s: bytes, dur?}`. `partes`: el `grab-*.json` del motor (`{c, m, d}`)."""
    bs = []
    for k, b in batallas[:MAX_BATALLAS]:
        a = archivos.get(k) or {}
        if not a.get('entera') and not a.get('previa'):
            continue
        dur = (a.get('entera') or {}).get('dur') or round(float(b.get('hasta') or 0) - float(b.get('desde') or 0))
        x = {'k': int(k), 'r': b.get('r') or '', 'nombres': list(b.get('nombres') or []), 'ids': ids_de(b), 'dur': int(dur)}
        if b.get('desde') is not None:
            x['desde'] = round(float(b['desde']), 1)
        for q in ('entera', 'previa', 'det', 'detp'):
            if a.get(q):
                x[q] = a[q]
        bs.append(x)
    out = {'v': 1, 'ev': ev, 'll': str(ll), 'sv': sv or '', 'nombre': nombre or '', 'dia': dia or '', 'bk': bk, 'batallas': bs}
    if g:
        out['g'] = str(g)
    if ini:
        out['ini'] = int(ini)
    if partes and partes.get('c') and partes.get('m'):
        out['partes'] = {'c': str(partes['c']), 'm': [str(m) for m in partes['m']][:MAX_PARTES], 'dur': int(partes.get('d') or 0)}
    if mejor:
        out['mejor'] = mejor
        if mejor_det:
            out['mejor_det'] = mejor_det
    return out


def _api(bk, nombre):
    import subir_cartas as SC
    return 'https://api.cloudflare.com/client/v4/accounts/%s/r2/buckets/%s' % (SC.CUENTA, nombre), SC


def _subir(s, api, clave, ruta, tipo):
    with open(ruta, 'rb') as f:
        r = s.put('%s/objects/%s' % (api, clave), data=f.read(), headers={'Content-Type': tipo, 'Cache-Control': 'private, no-store'}, timeout=300)
    if not r.ok:
        raise RuntimeError('R2 %d' % r.status_code)
    return {'k': clave, 's': os.path.getsize(ruta)}


def _duracion(ruta):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', ruta],
                       capture_output=True, text=True)
    try:
        return float(r.stdout.strip() or 0)
    except ValueError:
        return 0.0


def _al_worker(ruta, cuerpo):
    import requests
    from clave_ciclo import clave
    r = requests.post(WORKER + ruta, data=json.dumps(cuerpo, ensure_ascii=False).encode('utf-8'),
                      headers={'content-type': 'application/json', 'x-lg-ciclo': clave(_env('DISCORD_TOKEN'))}, timeout=60)
    try:
        return r.status_code, r.json()
    except ValueError:
        return r.status_code, {}


#: cuánto queda una fila en el índice del motor: lo mismo que lo entero en el Worker (`CFG0.dias_entera`); el permiso lo
#: decide siempre el Worker, esto es sólo para que el motor (YouTube, portadas) encuentre los archivos mientras existen
DIAS_INDICE = 30


def clave_indice(token=None):
    """🗝️ Dónde guarda el motor SU índice de lo que subió (`reels/audios.json` tenía lo mismo, público): una clave de R2 que
    sólo calcula quien tiene el token del bot. Sin token no hay clave: nunca se escribe en un lugar adivinable."""
    t = token if token is not None else _env('DISCORD_TOKEN')
    if not t:
        return ''
    import hashlib
    return 'grab/_m-%s/indice.json' % hashlib.sha256(('lg-grab-indice:' + t).encode('utf-8')).hexdigest()[:32]


def _sesion_api():
    bk, nb = bucket()
    api, SC = _api(bk, nb)
    return bk, api, SC, SC.sesion()


def indice_leer():
    """Las filas del índice privado del motor, con la forma de las de `reels/audios.json` (`url`, `det`, `nombres`…),
    vigentes. `[]` si no hay o no se puede leer. ⚠️ `url` sirve para bajarlo sólo con el bucket de las cartas (`bk: 'c'`);
    con el bucket privado, se baja por la API con `clave`/`clave_det`."""
    k = clave_indice()
    if not k:
        return []
    try:
        _bk, api, _SC, s = _sesion_api()
        r = s.get('%s/objects/%s' % (api, k), timeout=30)
        A = r.json() if r.status_code == 200 else []
    except Exception:
        return []
    import datetime as dt
    ahora = dt.datetime.now(dt.timezone.utc).isoformat()[:16]
    return [x for x in A if isinstance(x, dict) and (x.get('hasta') or '') > ahora]


def filas_indice(cuerpo, publica):
    """Las filas del índice para un registro armado (`armar()`): una por batalla entera y una para lo mejor de la noche."""
    import datetime as dt
    hasta = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=DIAS_INDICE)).isoformat()[:16]
    url = (lambda k: '%s/%s' % (publica, k) if k and cuerpo.get('bk') == 'c' else '')
    base = {'ev': cuerpo['ev'], 'sv': cuerpo.get('sv') or '', 'dia': cuerpo.get('dia') or '', 'll': cuerpo.get('ll') or None,
            'evento': cuerpo.get('nombre') or '', 'hasta': hasta}
    out = []
    for b in cuerpo.get('batallas') or []:
        e, d = b.get('entera') or {}, b.get('det') or {}
        if not e.get('k'):
            continue
        out.append(dict(base, k=b['k'], url=url(e['k']), det=url(d.get('k')), clave=e['k'], clave_det=d.get('k') or '',
                        nombres=b.get('nombres') or [], ronda=b.get('r') or '', dur=e.get('dur') or b.get('dur') or 0))
    m = cuerpo.get('mejor') or {}
    if m.get('k'):
        md = cuerpo.get('mejor_det') or {}
        out.append(dict(base, k='mejor', mejor=True, url=url(m['k']), det=url(md.get('k')), clave=m['k'], clave_det=md.get('k') or '',
                        nombres=[], ronda='', dur=m.get('dur') or 0))
    return out


def indice_guardar(ev, filas):
    """Reemplaza las filas de `ev` en el índice privado (y saca las vencidas). Devuelve si se pudo."""
    k = clave_indice()
    if not k:
        return False
    try:
        _bk, api, _SC, s = _sesion_api()
        A = [x for x in indice_leer() if x.get('ev') != ev] + list(filas)
        r = s.put('%s/objects/%s' % (api, k), data=json.dumps(A, ensure_ascii=False).encode('utf-8'),
                  headers={'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store'}, timeout=60)
        return bool(r.ok)
    except Exception:
        return False


def desde_motor(ev, sv, dia, guion, hechas, grab=None, ll=None, nombre='', mejor_m4a=None, mejor_json=None):
    """🔌 La llamada del motor. `hechas`: `[(k, b, ruta_m4a, detalle)]`, lo que `archivo_reels.audios()` ya armó; `grab`:
    la ruta del `grab-*.json` (o el dict); `ll`: el número de la llave (lo calcula el motor, `llave_de()`).

    Sube todo al lugar privado SIEMPRE, deja las filas en el índice privado del motor (para el evento entero de YouTube y
    las portadas) y, si se sabe la llave, lo registra en el Worker —sin llave la página no tendría dónde mostrarlo—.
    Devuelve `(status, respuesta)`; nunca hace fallar al motor: si algo sale mal lo dice y devuelve `(0, {error})`."""
    try:
        if not hechas:
            return 0, {'error': 'sin batallas'}
        bk, api, SC, s = _sesion_api()
        pre = prefijo(ev, bk)
        tmp = tempfile.mkdtemp(prefix='grab-')
        archivos = {}
        try:
            for k, b, m4a, D in hechas:
                a = {}
                a['entera'] = dict(_subir(s, api, pre + '%d.m4a' % k, m4a, 'audio/mp4'), dur=round(_duracion(m4a)))
                p = os.path.join(tmp, '%dp.m4a' % k)
                cortar_previa(m4a, p)
                a['previa'] = dict(_subir(s, api, pre + '%dp.m4a' % k, p, 'audio/mp4'), dur=PREVIA_S)
                if D:
                    for q, x in (('det', D), ('detp', det_previa(D))):
                        f = os.path.join(tmp, '%d%s.json' % (k, q))
                        with open(f, 'w', encoding='utf-8') as fh:
                            json.dump(x, fh, ensure_ascii=False)
                        a[q] = _subir(s, api, pre + '%d%s.json' % (k, 'd' if q == 'det' else 'dp'), f, 'application/json; charset=utf-8')
                archivos[k] = a
            mj = dict(_subir(s, api, pre + 'mejor.m4a', mejor_m4a, 'audio/mp4'), dur=round(_duracion(mejor_m4a))) if mejor_m4a and os.path.exists(mejor_m4a) else None
            mjd = _subir(s, api, pre + 'mejor.json', mejor_json, 'application/json; charset=utf-8') if mj and mejor_json and os.path.exists(mejor_json) else None
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
        partes = grab if isinstance(grab, dict) else (json.load(open(grab, encoding='utf-8')) if grab and os.path.exists(grab) else None)
        ini = 0
        try:      # cuándo arrancó la grabación, del batallas.json de ULAYA (`inicio`, ISO)
            import datetime as dt
            ini = int(dt.datetime.fromisoformat(str((guion or {}).get('inicio') or '').replace('Z', '+00:00')).timestamp() * 1000)
        except ValueError:
            ini = 0
        cuerpo = armar(ev, ll or '', sv, dia, [(k, b) for k, b, _, _ in hechas], archivos, nombre=nombre or next(
            (b.get('evento') for _, b, _, _ in hechas if b.get('evento')), ''), g=(guion or {}).get('servidor') or '', ini=ini,
            partes=partes, mejor=mj, bk=bk, mejor_det=mjd)
        ok_i = indice_guardar(ev, filas_indice(cuerpo, SC.PUBLICA))
        if not ll:
            print('grabados: %d batallas subidas, sin llave: no se registran (índice %s)' % (len(cuerpo['batallas']), 'ok' if ok_i else 'NO'))
            return 0, {'error': 'sin llave'}
        st, j = _al_worker('/grabados/registrar', cuerpo)
        print('grabados: %d batallas · %s · índice %s' % (len(cuerpo['batallas']), 'registrado' if st == 200 else 'el Worker dijo %d' % st,
                                                         'ok' if ok_i else 'NO'))
        return st, j
    except Exception as e:      # el motor sigue con lo suyo
        print('grabados: no pude', type(e).__name__)
        return 0, {'error': type(e).__name__}


# ── EL SELF-CHECK ────────────────────────────────────────────────────────────────────────────────────────────────────
def _auto():
    fallas = []
    C = json.load(io.open(CASOS, encoding='utf-8'))
    E = C['entrada']
    out = armar(E['ev'], E['ll'], E['sv'], E['dia'], [(x['k'], x['b']) for x in E['batallas']],
                {int(k): v for k, v in E['archivos'].items()}, nombre=E['nombre'], g=E['g'], ini=E['ini'], partes=E['partes'],
                mejor=E.get('mejor'), bk=E['bk'])
    if out != C['registro']:
        fallas.append('armar() no da el registro de grabados_casos.json:\n   ' + json.dumps(out, ensure_ascii=False)[:400])
    if ids_de({'personas': [[{'n': 'A', 'id': '123456789012345678'}], [{'n': 'B', 'id': 'x'}, {'n': 'C', 'id': '123456789012345678'}]]}) != ['123456789012345678']:
        fallas.append('ids_de(): sin repetir y sólo IDs')
    k1 = clave_indice('tok-a')
    if not k1.startswith('grab/_m-') or k1 == clave_indice('tok-b') or clave_indice('') != '' or k1 != clave_indice('tok-a'):
        fallas.append('clave_indice(): sale del token (igual con el mismo, distinta con otro) y sin token no hay')
    R = C['registro']
    F = filas_indice(R, 'https://pub')
    if [x['k'] for x in F] != [1, 2, 'mejor'] or F[0]['url'] != 'https://pub/' + R['batallas'][0]['entera']['k'] or F[0]['nombres'] != ['Ana', 'Bea']:
        fallas.append('filas_indice(): una por batalla entera y lo mejor de la noche, con la forma de reels/audios.json: %r' % F[:1])
    if any(x['url'] for x in filas_indice(dict(R, bk='g'), 'https://pub')):
        fallas.append('filas_indice(): con el bucket privado no hay url pública')
    p1, p2 = prefijo('ev1', 'c'), prefijo('ev1', 'c')
    if p1 == p2 or len(p1) != len('grab/ev1-') + 32 + 1 or prefijo('ev1', 'g') != 'grab/ev1/':
        fallas.append('prefijo(): en el bucket público, 128 bits al azar cada vez; en el privado, sin azar')
    D = {'turnos': [[0, 'Ana'], [28.5, 'Bea'], [61, 'Ana']], 'letra': [[1, 'hola'], [31, 'chau']], 'calor': [1, 2, 3, 4, 5, 6, 7, 8, 9, 9]}
    dp = det_previa(D)
    if dp['turnos'] != [[0, 'Ana'], [28.5, 'Bea']] or dp['letra'] != [[1, 'hola']] or len(dp['calor']) != 7:
        fallas.append('det_previa(): sólo los 30 s: %r' % dp)
    if det_previa(D, desde=30)['letra'] != [[1.0, 'chau']]:
        fallas.append('det_previa(): corrido a 0 desde donde arranca')
    # ✂️ un adelanto de verdad, si hay ffmpeg: de un tono de 75 s, 30 s y sin volver a codificar
    if shutil.which('ffmpeg') and shutil.which('ffprobe'):
        t = tempfile.mkdtemp(prefix='grab-auto-')
        try:
            ent, sal = os.path.join(t, 'b.m4a'), os.path.join(t, 'p.m4a')
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=75', '-ac', '1',
                            '-c:a', 'aac', '-b:a', '40k', ent], check=True)
            cortar_previa(ent, sal)
            dur = _duracion(sal)
            if not 29.0 <= dur <= 30.6:
                fallas.append('cortar_previa(): duró %.2f s' % dur)
            if os.path.getsize(sal) > os.path.getsize(ent) * 0.5:
                fallas.append('cortar_previa(): el adelanto pesa más de la mitad que la batalla')
        finally:
            shutil.rmtree(t, ignore_errors=True)
    else:
        print('  ⓘ sin ffmpeg: el corte no se prueba')
    for f in fallas:
        print('🔴 ' + f)
    print('todo ok · grabados' if not fallas else '%d fallas' % len(fallas))
    return 1 if fallas else 0


def main():
    a = sys.argv[1:]
    if '--auto' in a:
        return _auto()
    if '--config' in a:
        cambio = {}
        for x in a[a.index('--config') + 1:]:
            if '=' not in x:
                continue
            k, v = x.split('=', 1)
            cambio[k] = (v.lower() == 'true') if v.lower() in ('true', 'false') else int(v)
        st, j = _al_worker('/grabados/config', cambio)
        print(st, json.dumps(j, ensure_ascii=False))
        return 0 if st == 200 else 1
    if '--podar' in a:
        st, j = _al_worker('/grabados/podar', {})
        print(st, json.dumps(j, ensure_ascii=False))
        return 0 if st == 200 else 1
    print(__doc__)
    return 0


if __name__ == '__main__':
    sys.exit(main())
