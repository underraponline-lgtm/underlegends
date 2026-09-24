# -*- coding: utf-8 -*-
"""BAJAR EL APPS SCRIPT DE LA PLANILLA, Y BARRERLO ANTES DE GUARDARLO.

    python herramientas/appscript.py                     el MOTOR, solo lo lee
    python herramientas/appscript.py --guardar           lo escribe en docs/
    python herramientas/appscript.py oficial             el WebApp publico
    python herramientas/appscript.py oficial --guardar

⚠️ SON DOS PROYECTOS DISTINTOS. Ver el comentario de `PROYECTOS` mas abajo:
pedir el equivocado no falla, devuelve otra cosa.

🔴 POR QUE EXISTE. `docs/sheet_estructura.md` lo venia diciendo desde julio:
*«el Sheet no es la fuente: es una VITRINA. Todo se calcula afuera»* y *«hay un
Apps Script en la foto — el buscador de perfiles no es una formula, es
codigo»*. Ese codigo era el unico pedazo del sistema que no se podia leer desde
el repo, asi que todo lo que hace estaba descrito de oido.

COMO SE CONSIGUIO EL ACCESO (20/09/2026), porque son CUATRO cosas y saltearse
una da un error que no dice cual falta:

  1. Apps Script API habilitada en el proyecto `liga-global` de Cloud Console
  2. el interruptor POR USUARIO de script.google.com/home/usersettings
  3. la planilla compartida como **Editor** con la cuenta de servicio
  4. el Script ID, que es del PROYECTO y no de la planilla

⚠️ EL PASO 2 NO SE VE DESDE ACA. Es un toggle de la cuenta de Google, no del
proyecto, y se llama casi igual que el 1. Si falta, el 1 no alcanza.

⚠️ SE PIDE `script.projects.readonly`. Este script LEE; no publica, no
despliega y no toca la planilla. El scope de solo lectura es lo que garantiza
que un error de tipeo no reescriba el WebApp de la Liga.

EL BARRIDO
----------
⚠️ LO QUE ENTRA AL REPO QUEDA EN EL HISTORIAL. Es la regla de `creds.json`
—*«no alcanza con borrarla en el commit siguiente»*— y vale igual para esto:
un Apps Script suele traer IDs de despliegue, claves y URLs privadas. Por eso
`--guardar` es un paso aparte y el barrido corre SIEMPRE, incluso si no vas a
guardar.
"""
import io
import json
import os
import re
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, BASE)

# 🔴 SON DOS PROYECTOS Y ESTE ARCHIVO TENIA UNO SOLO, ESCRITO A MANO.
# El 20/09/2026 me costo una vuelta entera: baje «el Apps Script», lo compare
# contra `docs/appscript_operativo/` y salio que TODO diferia — `General.gs`,
# `WebApp.gs` e `Index.html` «no estaban en el repo». No era que el repo
# estuviera desactualizado: **estaba mirando el otro proyecto**.
#
#   1QFNhlyu...  -> Oficial    General.gs · WebApp.gs · Index.html
#                               el buscador publico. ⚠️ Su Index.html es el
#                               que pinta SEIS rangos a mano (ver CLAUDE.md)
#   1feyyQOB...  -> Operativo  Code.gs, 837 lineas: procesarEvento,
#                               calcularPuntos, escribirLogs. EL MOTOR
#
# El `parentId` que devuelve el API es lo que los distingue, y no hace falta
# saberlo de antemano: lo dice Google.
#
# ⚠️ El default es el MOTOR, porque es el que importa. El otro se pide por
# nombre.
PROYECTOS = {
    'operativo': ('1feyyQOBLptt7HEsfA9uXhL29bv_WNrN3U4B0IB5lktPR4hC-Bijhr7v5',
                  'appscript_operativo'),
    'oficial': ('1QFNhlyu4_HbcSSJq_FYUTPcw_wzLcv77X857688FJl_bheAFW86pIM8Y',
                'appscript_oficial'),
}
_CUAL = next((a for a in sys.argv[1:] if a in PROYECTOS), 'operativo')
SID, _CARPETA = PROYECTOS[_CUAL]
SALIDA = os.path.join(BASE, 'docs', _CARPETA)
EXT = {'SERVER_JS': '.gs', 'HTML': '.html', 'JSON': '.json'}

# ⚠️ CADA PATRON ESTA POR UN MOTIVO CONCRETO, no por completitud:
#   AKfycb…  el ID de un despliegue de web app: quien lo tenga puede invocarla
#   AIza…    una clave de API de Google
#   1//, ya29 tokens OAuth
#   -----BEGIN  una clave privada pegada en el codigo
#   MT…/discord  un token de bot de Discord
SOSPECHAS = [
    ('ID de despliegue', re.compile(r'\bAKfycb[\w-]{20,}')),
    ('clave de API de Google', re.compile(r'\bAIza[\w-]{35}')),
    ('token OAuth', re.compile(r'\bya29\.[\w.-]{20,}|\b1//[\w-]{20,}')),
    ('clave privada', re.compile(r'-----BEGIN [A-Z ]*PRIVATE KEY-----')),
    ('token de Discord', re.compile(r'\b[MNO][\w-]{23,}\.[\w-]{6}\.[\w-]{27,}')),
    ('webhook de Discord', re.compile(r'discord(?:app)?\.com/api/webhooks/\S+')),
    ('URL de despliegue', re.compile(r'script\.google\.com/macros/s/[\w-]+')),
    ('contraseña escrita', re.compile(
        r'(?i)\b(?:password|passwd|secret|api_?key|token)\s*[:=]\s*[\'"][^\'"]{6,}')),
]
# el ID de la planilla no es un secreto: ya esta en CLAUDE.md y en los builders
NO_ES_SECRETO = {'1sDo89FTvnI6FOtz6KSK0jAtDBtJHsB7N54wNLLae62U'}


def bajar():
    from google.oauth2.service_account import Credentials
    import google.auth.transport.requests as gtr
    import requests
    cred = Credentials.from_service_account_file(
        os.path.join(BASE, 'creds.json'),
        scopes=['https://www.googleapis.com/auth/script.projects.readonly'])
    cred.refresh(gtr.Request())
    r = requests.get('https://script.googleapis.com/v1/projects/%s/content' % SID,
                     headers={'Authorization': 'Bearer ' + cred.token}, timeout=60)
    if not r.ok:
        e = r.json().get('error', {})
        sys.exit('  ❌ HTTP %d  %s\n     %s\n\n  Revisá los cuatro pasos del '
                 'encabezado de este archivo.'
                 % (r.status_code, e.get('status'), str(e.get('message'))[:200]))
    return r.json().get('files') or []


def barrer(archivos):
    """[(archivo, que, muestra)] de todo lo que parece un secreto."""
    hallazgos = []
    for f in archivos:
        src = f.get('source') or ''
        for que, pat in SOSPECHAS:
            for m in pat.finditer(src):
                t = m.group(0)
                if any(x in t for x in NO_ES_SECRETO):
                    continue
                linea = src[:m.start()].count('\n') + 1
                hallazgos.append((f.get('name'), que, linea,
                                  t[:46] + ('…' if len(t) > 46 else '')))
    return hallazgos


def main():
    archivos = bajar()
    print('\n  proyecto: %s   (%s)' % (_CUAL, SID[:18] + '...'))
    print('  se guarda en: docs/%s/' % _CARPETA)
    # ⚠️ SE IMPRIME CUAL, y no es adorno: bajar el proyecto equivocado da una
    # lista de archivos perfectamente valida que no es la que se busca.
    print('\n  %d archivo(s) en el proyecto:\n' % len(archivos))
    for f in archivos:
        src = f.get('source') or ''
        print('     %-12s %-10s %7d chars   %5d lineas'
              % (f.get('name'), f.get('type'), len(src), src.count('\n') + 1))

    h = barrer(archivos)
    print('\n  BARRIDO DE SECRETOS: %s' % ('nada' if not h else '%d hallazgo(s)' % len(h)))
    for nom, que, ln, muestra in h:
        print('     🔴 %s:%d  %s' % (nom, ln, que))
        print('        %s' % muestra)

    if '--guardar' not in sys.argv:
        print('\n  (no escribí nada — corré con --guardar)\n')
        return
    if h:
        print('\n  ⚠️ NO LO GUARDO con hallazgos sin resolver. Lo que entra al')
        print('     repo queda en el historial, igual que creds.json.\n')
        return
    os.makedirs(SALIDA, exist_ok=True)
    for f in archivos:
        p = os.path.join(SALIDA, f['name'] + EXT.get(f.get('type'), '.txt'))
        io.open(p, 'w', encoding='utf-8', newline='\n').write(f.get('source') or '')
        print('     -> %s' % os.path.relpath(p, BASE))
    print('')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
