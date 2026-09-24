# -*- coding: utf-8 -*-
"""LOS OCHO RANGOS EN EL WEBAPP PUBLICO. El ultimo de los cinco lugares.

    python sheet/webapp_rangos.py            el diff, NO escribe
    python sheet/webapp_rangos.py --aplicar  lo sube al Apps Script

🔴 EL `Index.html` DEL WEBAPP PINTA SEIS RANGOS A MANO.

Es lo ultimo que queda de la lista de `CLAUDE.md`, y su propio comentario
lo confiesa:

    RANGOS — derivados del Score del Ranking Competitivo.
    ...
    Si cambian los umbrales en la Guia, cambiarlos ACA tambien.

Esa frase es la instruccion manual que nunca se cumple, y por eso el
proyecto tiene la regla de una sola fuente. Hoy la pagina publica dice:

    S 65 · A 47 · B 36 · C 23 · D 17 · E      y minimo 8 eventos

y las tarjetas dicen otra cosa. Alguien abre el ranking, ve «A», tira
`/card` y le sale «B».

QUE CAMBIA
----------
`RANK_TIERS`, `RANK_COLOR` y `MIN_EV_RANGO`, los tres **generados desde el
repo**: los umbrales y los colores de `comun/rangos.py`, el minimo de
eventos de `comun/requisitos.py`.

⚠️ EL MINIMO PASA DE 8 A 10, y no es un ajuste cosmetico: es el requisito
real de la Competitiva (`REQUISITOS['competitivo'] = 10`). La pagina usa
ese numero en once lugares —«Falta N EV», el recuadro del win rate— asi
que hoy le esta diciendo a gente con 8 y 9 eventos que ya tiene rango
cuando la tarjeta no se lo da.

⚠️ LOS NOMBRES PASAN A SER LOS MATERIALES. Hoy son «Élite · Muy alto ·
Alto · Medio · Bajo · Inicial», que son seis descripciones para seis
tramos: con ocho hay que inventar dos. Los materiales —amatista,
diamante, oro, rubi, esmeralda, zafiro, plata, bronce— ya son los nombres
canonicos de `comun/rangos.py` y son **lo que se ve en la tarjeta**, asi
que la pagina y la carta pasan a decir lo mismo.

⚠️ ESTO TOCA UNA PAGINA PUBLICA. El original esta commiteado en
`docs/appscript_oficial/Index.html`, asi que volver atras es subir ese
archivo. El script muestra el diff antes de escribir y **verifica leyendo**
que lo que quedo arriba es lo que mando.
"""
import difflib
import io
import os
import re
import sys

import requests

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

from comun.rangos import UMBRAL, ORDEN, ACENTO, MATERIAL     # noqa: E402
from comun.requisitos import REQUISITOS, minimo                      # noqa: E402

SID = '1QFNhlyu4_HbcSSJq_FYUTPcw_wzLcv77X857688FJl_bheAFW86pIM8Y'
API = 'https://script.googleapis.com/v1/projects/%s' % SID
CREDS = os.path.join(BASE, 'creds.json')

TILDES = {'rubi': 'Rubí'}


def token(escritura=False):
    """El token para hablarle al Apps Script.

    🔴 PARA ESCRIBIR, LA CUENTA DE SERVICIO NO SIRVE. Devuelve
    `403 User has not enabled the Apps Script API`, que es un
    interruptor **por usuario** y una cuenta de servicio no tiene donde
    activarlo. Reintentado el 20 y el 21/09/2026: el mismo 403.

    Por eso, si hay un token de OAuth —el que deja
    `python sheet/autorizar.py`— se usa ese: las llamadas corren **como
    Dlx**, que si puede activar el interruptor.

    ⚠️ LEER SIGUE SALIENDO DE LA CUENTA DE SERVICIO. Funciona, no pide
    que nadie autorice nada, y asi el simulacro —que es lo que se corre
    noventa veces— no depende de un token que puede no estar.
    """
    if escritura:
        try:
            from autorizar import credenciales
            cred = credenciales(interactivo=False)
        except Exception:                                # noqa: BLE001
            cred = None
        if cred is not None:
            return cred.token
        print('   ⚠️ no hay token de OAuth: pruebo con la cuenta de '
              'servicio, que hasta hoy da 403.')
        print('      Para arreglarlo: python sheet/autorizar.py')
    from google.oauth2.service_account import Credentials
    import google.auth.transport.requests as gtr
    sc = ['https://www.googleapis.com/auth/script.projects'
          if escritura else
          'https://www.googleapis.com/auth/script.projects.readonly']
    c = Credentials.from_service_account_file(CREDS, scopes=sc)
    c.refresh(gtr.Request())
    return c.token


def bloque():
    """Las tres constantes, generadas desde el repo."""
    u = dict(UMBRAL)
    tiers = []
    for r in ORDEN:
        mat = MATERIAL.get(r, r)
        nom = TILDES.get(mat, mat.capitalize())
        # 🔴 LA COMA DESPUES DEL NUMERO. La primera version usaba `%-3d` y
        # generaba `min: 82  color:` — **sin coma**, o sea un error de
        # sintaxis en una pagina publica. Lo agarro el simulacro porque
        # imprime el diff; si el script escribiera directo, el WebApp se
        # caia entero por un `%d`. Por eso el numero y su coma se arman
        # juntos y despues se rellena.
        tiers.append("  { rank: %-6s min: %-4s color: '%s', name: '%s' }"
                     % ("'%s'," % r, '%d,' % u.get(r, 0), ACENTO[r], nom))
    colores = ', '.join("%s:'%s'" % (r, ACENTO[r]) for r in ORDEN)
    # ⚠️ `minimo()` y no `REQUISITOS['competitivo'][0]`. Ver su docstring:
    # ese indice daba 10 cuando cada carta tenia una sola condicion y paso
    # a dar la tupla entera cuando Pais paso a pedir tres. Rompio ESTE
    # archivo, que es el que publica la pagina publica.
    minev = minimo('competitivo', 'ev')
    return (
        'const RANK_TIERS = [\n' + ',\n'.join(tiers) + '\n];\n'
        + 'const RANK_COLOR = { ' + colores + ' };\n'
        + 'const MIN_EV_RANGO = %d;' % minev)


VIEJO = re.compile(
    r'const RANK_TIERS = \[.*?\];\s*'
    r'const RANK_COLOR = \{[^}]*\};\s*'
    r'const MIN_EV_RANGO = \d+;', re.S)


def publicar(desc):
    """Crea una version y la pone en la implementacion que YA existe.

    🔴 ESCRIBIR EL CODIGO NO CAMBIA LO QUE VE LA GENTE. Apps Script sirve
    una **version desplegada**, no lo que hay en el editor: el `/exec`
    sigue devolviendo la foto vieja hasta que se publica una nueva. Y eso
    **no falla** — el archivo esta bien, la pagina miente, y el sintoma
    es «pegué el parche y no pasó nada».

    ⚠️ SE ACTUALIZA LA QUE EXISTE, NO SE CREA OTRA. Un despliegue nuevo
    genera **otra URL**, y la que la gente tiene guardada seguiria
    mostrando lo de antes. Se busca el despliegue que tiene un webApp y
    se le cambia la version.

    ⚠️ Y SE SALTEA `@HEAD`. Todo proyecto tiene un despliegue especial
    que apunta al editor —el de `/dev`, para probar—: ese no es el
    publico y ademas no se puede actualizar.
    """
    h = {'Authorization': 'Bearer ' + token(True),
         'Content-Type': 'application/json'}
    r = requests.post(API + '/versions', headers=h,
                      json={'description': desc}, timeout=60)
    if r.status_code >= 300:
        return None, 'no pude crear la versión: %s %s' % (r.status_code,
                                                          r.text[:140])
    ver = r.json()['versionNumber']

    r = requests.get(API + '/deployments', headers=h, timeout=60)
    if r.status_code >= 300:
        return None, 'no pude listar los despliegues: %s' % r.text[:140]
    objetivo = None
    for d in r.json().get('deployments', []):
        cfg = d.get('deploymentConfig', {})
        if cfg.get('versionNumber') is None:
            continue                     # @HEAD, el de /dev
        if any(e.get('webApp') for e in d.get('entryPoints') or []):
            objetivo = d
            break
    if objetivo is None:
        return ver, ('creé la versión %d pero no encontré un despliegue web '
                     'que actualizar: publicala a mano una vez' % ver)

    did = objetivo['deploymentId']
    cfg = objetivo['deploymentConfig']
    r = requests.put('%s/deployments/%s' % (API, did), headers=h, timeout=60,
                     json={'deploymentConfig': {
                         'scriptId': SID, 'versionNumber': ver,
                         'manifestFileName': cfg.get('manifestFileName',
                                                     'appsscript'),
                         'description': cfg.get('description', '')}})
    if r.status_code >= 300:
        return ver, 'creé la versión %d pero no pude publicarla: %s %s' % (
            ver, r.status_code, r.text[:140])
    url = ''
    for e in r.json().get('entryPoints') or []:
        if e.get('webApp'):
            url = e['webApp'].get('url', '')
    return ver, url


def bajar(escritura=False):
    r = requests.get(API + '/content',
                     headers={'Authorization': 'Bearer ' + token(escritura)},
                     timeout=60)
    r.raise_for_status()
    return r.json()


def main():
    aplicar = '--aplicar' in sys.argv
    proyecto = bajar()
    archivos = proyecto['files']
    idx = next((f for f in archivos if f['name'] == 'Index'), None)
    if not idx:
        sys.exit('no encontré Index.html en el proyecto')
    src = idx['source']

    m = VIEJO.search(src)
    if not m:
        sys.exit('no encontré el bloque RANK_TIERS/RANK_COLOR/MIN_EV_RANGO. '
                 '¿Lo editaron a mano? No toco nada.')

    nuevo_bloque = bloque()
    nuevo = src[:m.start()] + nuevo_bloque + src[m.end():]

    # ⚠️ SI YA ESTA IGUAL, NO SE PUBLICA. Sin esto `--aplicar` sube y
    # publica **siempre**, tambien cuando el bloque de arriba ya es el
    # mismo: a mano se nota poco, pero atado a un push (ver
    # `.github/workflows/rangos.yml`) deja una version nueva de Apps
    # Script por cada commit que toque `comun/`, y el historial de
    # despliegues —que es donde se mira «cuando cambio el rango»— se
    # llena de versiones identicas. Salir temprano y decirlo es la
    # respuesta correcta, y ademas hace que el workflow sea seguro de
    # correr de mas.
    if nuevo == src:
        print('\n══ EL BLOQUE DE RANGOS DEL WEBAPP ══\n')
        print('   ✅ ya está igual a comun/rangos.py: no hay nada que '
              'publicar\n')
        return 0

    print('\n══ EL BLOQUE DE RANGOS DEL WEBAPP ══\n')
    for l in difflib.unified_diff(m.group(0).splitlines(),
                                  nuevo_bloque.splitlines(),
                                  'como está', 'como queda', lineterm='', n=0):
        print('   %s' % l[:110])

    # ⚠️ SE COMPRUEBA QUE EL CAMBIO SEA SOLO ESE. Un regex sobre 105 KB de
    # HTML puede comerse mas de lo que se ve; comparar los tamaños fuera
    # del bloque lo detecta.
    antes_fuera = len(src) - len(m.group(0))
    despues_fuera = len(nuevo) - len(nuevo_bloque)
    print('\n   el resto del archivo: %d bytes antes, %d después  %s'
          % (antes_fuera, despues_fuera,
             '✅ intacto' if antes_fuera == despues_fuera else '🔴 CAMBIÓ'))
    if antes_fuera != despues_fuera:
        sys.exit(1)

    if not aplicar:
        print('\n   (simulacro: no escribí nada — corré con --aplicar)\n')
        return 0

    for f in archivos:
        if f['name'] == 'Index':
            f['source'] = nuevo
    r = requests.put(API + '/content',
                     headers={'Authorization': 'Bearer ' + token(True),
                              'Content-Type': 'application/json'},
                     json={'files': archivos}, timeout=90)
    if r.status_code >= 300:
        sys.exit('no pude subirlo: %s %s' % (r.status_code, r.text[:250]))
    print('\n   ✅ subido')

    # ⚠️ SE VERIFICA LEYENDO. Un 200 dice que la API acepto el cuerpo, no
    # que el archivo de arriba sea el que se mando.
    arriba = next(f['source'] for f in bajar()['files'] if f['name'] == 'Index')
    if arriba == nuevo:
        print('   ✅ verificado: lo que está arriba es lo que mandé')
    else:
        sys.exit('🔴 lo que quedó arriba NO es lo que mandé')

    # ⚠️ Y SE PUBLICA, QUE ES EL PASO QUE SE OLVIDA. Ver `publicar()`.
    from datetime import date
    ver, res = publicar('rangos desde comun/rangos.py · %s'
                        % date.today().isoformat())
    if ver is None:
        print('   🔴 %s' % res)
        print('      El código está bien; falta publicarlo a mano:')
        print('      Deploy → Manage deployments → ✏️ → New version\n')
        return 1
    if res.startswith('http'):
        print('   ✅ publicado como versión %d' % ver)
        print('      %s' % res)
    else:
        print('   ⚠️ %s' % res)
    print('')
    return 0


if __name__ == '__main__':
    sys.exit(main())
