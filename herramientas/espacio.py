# -*- coding: utf-8 -*-
"""📦 CUÁNTO ESPACIO QUEDA: el repo en GitHub y R2 contra sus límites, y los archivos de cada temporada.
    python herramientas/espacio.py          mide y avisa: sale con 1 si algo pasó su alarma (la auditoría te manda el DM)
    python herramientas/espacio.py --auto   el self-check, sin red

Dlx, 12/11/2026, a «¿cuántas temporadas puede la página aguantar de información?» y la medición de ese día: *«dale,
agrega la alarma a la auditoría semanal.. aunque recuerda q va haber un ranking histórico tmb para el competitivo, elo y
temporada»*.

LO QUE SE MIDIÓ ESE DÍA, Y POR QUÉ LAS ALARMAS ESTÁN DONDE ESTÁN
-----------------------------------------------------------------
    el repo en GitHub   174 MB   crece ~1,5–2 MB por día (el historial: cada commit del ciclo, el código y la página)
                                 GitHub recomienda menos de 1 GB → la alarma, en 700 MB (unos 7 meses de aviso)
    R2 (cartas, fotos)  636 MB   10 GB gratis → la alarma, en 7 GB. Lo llena la GENTE (~1,5 MB por persona con cartas,
                                 contando todo) y no las temporadas: cada una pisa las cartas y sólo suma sus fotos
    KV                  970 claves de 1 GB: no crece por temporada; su límite es el de escrituras por día (otro asunto)

⚠️ Cada corrida del ciclo baja sólo la versión de hoy del repo (`actions/checkout` sin historial), así que lo que crezca
el historial NO lo hace más lento: lo que hay que vigilar es el tamaño, no el tiempo.

🏛️ Y LOS ARCHIVOS DE CADA TEMPORADA NO SE PUEDEN PERDER. Los rankings históricos —el Competitivo, el ELO y la
Temporada acumulados— se calculan de los `datos/t1_…`, `datos/t2_…` de cada temporada pasada (`comun/temporada.TODAS`).
Un ranking histórico pesa poco: una fila por persona, como una vitrina. Lo que no tiene arreglo es que falte una
temporada. Por eso esto también falla si falta alguno de esos archivos.

⚠️ NO PODER MEDIR NO ES ESTAR LLENO: si GitHub o Cloudflare no contestan, avisa y sale con 0. Una alarma que suena
porque se cayó la red se deja de mirar.
"""
import io
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (BASE, os.path.join(BASE, 'bot'), os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

REPO = 'underraponline-lgtm/underlegends'
MB = 1024 * 1024
#: `{qué: (alarma, límite, de dónde sale el límite)}`, en bytes
ALARMAS = {'repo': (700 * MB, 1024 * MB, 'GitHub recomienda menos de 1 GB'),
           'r2': (7 * 1024 * MB, 10 * 1024 * MB, 'R2 gratis: 10 GB')}
#: 📏 de dónde sale el ritmo del repo: el público nació el 24/09/2026 con 102 MB (ver CLAUDE.md, «Git»)
NACIO = ('2026-09-24', 102 * MB)


def ritmo_por_dia(ahora_bytes, hoy, nacio=NACIO):
    """Cuántos bytes por día creció en promedio desde que nació. Pura."""
    import datetime as dt
    dias = (dt.date.fromisoformat(hoy) - dt.date.fromisoformat(nacio[0])).days
    return (ahora_bytes - nacio[1]) / dias if dias > 0 else 0.0


def dias_hasta(ahora_bytes, umbral, por_dia):
    """En cuántos días llega a `umbral` a ese ritmo, o `None` si no crece. Pura."""
    if ahora_bytes >= umbral:
        return 0
    if por_dia <= 0:
        return None
    return int((umbral - ahora_bytes) / por_dia)


def renglon(que, ahora_bytes, por_dia=None):
    """`(texto, pasó_la_alarma)` de una medida. Pura."""
    alarma, limite, de = ALARMAS[que]
    paso = ahora_bytes >= alarma
    txt = '%s %-5s %8.0f MB   %3.0f %% del límite (%s)' % ('🔴' if paso else '✅', que, ahora_bytes / MB,
                                                            100 * ahora_bytes / limite, de)
    if por_dia:
        d = dias_hasta(ahora_bytes, alarma, por_dia)
        txt += ' · crece ~%.1f MB/día%s' % (por_dia / MB, '' if d is None else
                                            (', llega a la alarma en ~%d días' % d if d else ''))
    return txt, paso


def medir_repo():
    """Lo que GitHub dice que pesa el repo, en bytes (`size` viene en KB), o `None`."""
    import requests
    h = {'Accept': 'application/vnd.github+json'}
    tok = os.environ.get('GITHUB_TOKEN') or os.environ.get('GH_TOKEN')
    if tok:
        h['Authorization'] = 'Bearer ' + tok
    try:
        r = requests.get('https://api.github.com/repos/%s' % REPO, headers=h, timeout=30)
        return int(r.json()['size']) * 1024 if r.status_code == 200 else None
    except (ValueError, KeyError, OSError):
        return None


def r2_de(respuesta, bucket='cartas'):
    """Los bytes de `bucket` en una respuesta de la analítica de Cloudflare (lo más nuevo), o `None`. Pura."""
    try:
        acc = respuesta['data']['viewer']['accounts'][0]
        for g in acc.get('r2StorageAdaptiveGroups') or []:
            if g['dimensions']['bucketName'] == bucket:
                return int(g['max']['payloadSize']) + int(g['max'].get('metadataSize') or 0)
    except (KeyError, IndexError, TypeError, ValueError):
        pass
    return None


def medir_r2():
    """Lo que ocupa R2, en bytes, o `None`. La analítica de Cloudflare: sólo lectura, no gasta ningún cupo."""
    import datetime as dt
    import requests
    tok = os.environ.get('CLOUDFLARE_API_TOKEN')
    if not tok:
        try:
            for linea in io.open(os.path.join(BASE, '.env'), encoding='utf-8'):
                if linea.strip().startswith('CLOUDFLARE_API_TOKEN='):
                    tok = linea.split('=', 1)[1].strip().strip('"\'')
        except OSError:
            pass
    if not tok:
        return None
    import subir_datos as SD
    hoy = dt.date.today()
    q = ('query($a:String!,$i:Date!,$f:Date!){viewer{accounts(filter:{accountTag:$a}){'
         'r2StorageAdaptiveGroups(limit:20,filter:{date_geq:$i,date_lt:$f},orderBy:[date_DESC])'
         '{max{payloadSize metadataSize} dimensions{date bucketName}}}}}')
    try:
        r = requests.post('https://api.cloudflare.com/client/v4/graphql', headers={'Authorization': 'Bearer ' + tok},
                          timeout=40, json={'query': q, 'variables': {
                              'a': SD.CUENTA, 'i': (hoy - dt.timedelta(days=3)).isoformat(),
                              'f': (hoy + dt.timedelta(days=1)).isoformat()}})
        return r2_de(r.json())
    except (ValueError, OSError):
        return None


def faltan_temporadas(base=BASE, todas=None):
    """🏛️ `[ruta]` de los archivos de cada temporada (`comun/temporada.TODAS`) que no están: de ahí salen los rankings
    históricos. Vacío si están todos."""
    import espejo_t1 as EJ
    if todas is None:
        from comun.temporada import TODAS as todas
    return [a for t in todas for a in EJ.archivos(temp=t, base=base) if not os.path.exists(os.path.join(base, a))]


def main():
    import datetime as dt
    print('\n══ CUÁNTO ESPACIO QUEDA ══\n')
    mal = 0
    repo = medir_repo()
    if repo is None:
        print('   ⚠️ repo  no pude preguntarle a GitHub cuánto pesa: no es una alarma')
    else:
        txt, paso = renglon('repo', repo, ritmo_por_dia(repo, dt.date.today().isoformat()))
        print('   ' + txt)
        mal += paso
    r2 = medir_r2()
    if r2 is None:
        print('   ⚠️ r2    no pude leer la analítica de Cloudflare: no es una alarma')
    else:
        txt, paso = renglon('r2', r2)
        print('   ' + txt)
        mal += paso
    faltan = faltan_temporadas()
    print('   %s los archivos de cada temporada, de donde salen los rankings históricos%s'
          % ('🔴' if faltan else '✅', ': FALTAN ' + ', '.join(faltan[:5]) if faltan else ''))
    mal += bool(faltan)
    if mal:
        print('\n   🔴 algo pasó su alarma. Las salidas, en el encabezado de herramientas/espacio.py y en NOVEDADES\n')
    else:
        print('\n   todo con espacio\n')
    return 1 if mal else 0


def _self_check():
    import tempfile
    print('\n══ CUÁNTO ESPACIO QUEDA (self-check, sin red) ══\n')
    fallas = 0

    def ok(c, q):
        nonlocal fallas
        fallas += not c
        print('   %s %s' % ('✅' if c else '🔴', q))

    por_dia = ritmo_por_dia(174 * MB, '2026-11-12')
    ok(abs(por_dia / MB - 72 / 49) < 0.01, 'el ritmo: 102 → 174 MB del 24/09 al 12/11 son ~1,5 MB por día')
    ok(dias_hasta(174 * MB, 700 * MB, por_dia) == int(526 * MB / por_dia) and dias_hasta(800 * MB, 700 * MB, 1) == 0
       and dias_hasta(10, 20, 0) is None, 'los días hasta la alarma, y 0 si ya pasó, y nada si no crece')
    t_ok, p_ok = renglon('repo', 174 * MB, por_dia)
    t_mal, p_mal = renglon('r2', int(7.5 * 1024 * MB))
    ok(not p_ok and t_ok.startswith('✅') and '17 % del límite' in t_ok and 'llega a la alarma' in t_ok
       and p_mal and t_mal.startswith('🔴'), 'el renglón: verde debajo de la alarma, rojo arriba, con el % del límite')
    resp = {'data': {'viewer': {'accounts': [{'r2StorageAdaptiveGroups': [
        {'max': {'payloadSize': 600 * MB, 'metadataSize': 1 * MB}, 'dimensions': {'date': '2026-11-12', 'bucketName': 'cartas'}},
        {'max': {'payloadSize': 5, 'metadataSize': 0}, 'dimensions': {'date': '2026-11-12', 'bucketName': 'otro'}}]}]}}}
    ok(r2_de(resp) == 601 * MB and r2_de({'errors': ['x']}) is None and r2_de(resp, 'nada') is None,
       'R2: el bucket de las cartas, sumando los metadatos; sin respuesta o sin bucket, nada (no es una alarma)')
    with tempfile.TemporaryDirectory() as tmp:
        os.makedirs(os.path.join(tmp, 'datos'))
        import espejo_t1 as EJ
        for a in EJ.archivos(temp='t1', base=tmp):
            io.open(os.path.join(tmp, a), 'w', encoding='utf-8').write('{}')
        completas = faltan_temporadas(base=tmp, todas=('t1',))
        os.remove(os.path.join(tmp, 'datos', 't1_resultados.json'))
        falta = faltan_temporadas(base=tmp, todas=('t1',))
        sin_t2 = faltan_temporadas(base=tmp, todas=('t1', 't2'))
    ok(completas == [] and falta == ['datos/t1_resultados.json'] and 'datos/t2_lista.json' in sin_t2,
       '🏛️ los archivos de cada temporada: si falta uno, se dice cuál (de ahí salen los rankings históricos)')
    ok(faltan_temporadas() == [], '🏛️ y hoy están todos los de las temporadas que hubo')
    print('\n   %s\n' % ('✅ todo bien' if not fallas else '🔴 %d mal' % fallas))
    return 1 if fallas else 0


if __name__ == '__main__':
    sys.exit(_self_check() if '--auto' in sys.argv else main())
