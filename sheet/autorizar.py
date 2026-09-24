# -*- coding: utf-8 -*-
"""AUTORIZAR UNA VEZ PARA PODER ESCRIBIR EL APPS SCRIPT.

    python sheet/autorizar.py          abre el navegador y guarda el token
    python sheet/autorizar.py --ver    dice si el token sirve, sin pedir nada

🔴 POR QUE HACE FALTA: LA CUENTA DE SERVICIO NO PUEDE ESCRIBIR.

`herramientas/appscript.py` puede **leer** el Apps Script con
`creds.json`, pero al escribir devuelve:

    403 User has not enabled the Apps Script API.
        Enable it by visiting script.google.com/home/usersettings

Ese interruptor es **por usuario**, y el «usuario» de esa llamada es
`liga-global-bot@…iam.gserviceaccount.com`: una cuenta que **no tiene
donde hacer clic**. Reintentado el 20 y el 21/09/2026, el mismo 403.

La salida es que las llamadas corran **como Dlx**, que si puede activar
el interruptor. Eso es OAuth de aplicacion instalada: se autoriza una
vez en el navegador y queda un *refresh token* que ya no vence.

⚠️ **NO REEMPLAZA A `creds.json`.** La cuenta de servicio sigue siendo
la que lee y escribe las **planillas** — eso funciona y no se toca. Esto
es solo para el Apps Script, que es el unico que la rechaza.

QUE QUEDA EN DISCO, Y POR QUE LOS DOS ESTAN IGNORADOS
------------------------------------------------------
    oauth_client.json   lo que baja la consola al crear el cliente
    oauth_token.json    el refresh token — **este es el que da acceso**

⚠️ El segundo es el que importa: con el se escribe el Apps Script sin
volver a pedir permiso. Misma regla que `creds.json` — si entra al
historial no alcanza con borrarlo despues, hay que rotar el cliente en
Google Cloud. Los dos estan en `.gitignore`.

⚠️ **EL SCOPE ES EL MINIMO QUE ALCANZA.** `script.projects` deja leer y
escribir el codigo del proyecto, y nada mas: no toca Drive, ni el
correo, ni las planillas. Pedir `drive` «por las dudas» seria darle a
este token permiso sobre todo el Drive de Dlx para editar un archivo.
"""
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

CLIENTE = os.path.join(BASE, 'oauth_client.json')
TOKEN = os.path.join(BASE, 'oauth_token.json')
# ⚠️ DOS SCOPES Y NO UNO, Y EL SEGUNDO ES EL QUE CIERRA EL CICLO.
# `script.projects` deja escribir el codigo; `script.deployments` deja
# **publicarlo**. Sin el segundo, subir el Index.html no cambia nada de
# lo que ve la gente: Apps Script sirve una VERSION DESPLEGADA, no el
# editor, asi que el paso que falta es justo el que se olvida — y
# cuando se olvida la pagina miente sin que nada falle.
#
# ⚠️ Siguen siendo los minimos: no tocan Drive, ni el correo, ni las
# planillas. Solo los proyectos de Apps Script y sus despliegues.
SCOPES = ['https://www.googleapis.com/auth/script.projects',
          'https://www.googleapis.com/auth/script.deployments']


def credenciales(interactivo=True):
    """Las credenciales de OAuth, refrescadas. `None` si no hay token.

    ⚠️ REFRESCA SOLO Y VUELVE A GUARDAR. Un access token dura una hora;
    el refresh token no vence. Sin esto, el segundo dia falla con un
    `invalid_grant` que no dice que hay que renovar nada.
    """
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request

    cred, dados = None, set()
    if os.path.exists(TOKEN):
        try:
            cred = Credentials.from_authorized_user_file(TOKEN, SCOPES)
            # 🔴 LOS SCOPES SE LEEN DEL ARCHIVO, NO DEL OBJETO.
            # `from_authorized_user_file(ruta, SCOPES)` **fija**
            # `cred.scopes` a los que se le pasan, no a los que Google
            # concedio: comparar contra eso es comparar una lista
            # consigo misma y siempre da que alcanza. Medido el
            # 21/09/2026 — el token solo tenia `script.projects` y el
            # chequeo decia que estaba bien.
            dados = set(json.load(io.open(TOKEN, encoding='utf-8'))
                        .get('scopes') or ())
        except Exception:                                # noqa: BLE001
            cred = None
    # ⚠️ UN TOKEN CON MENOS SCOPES **PARECE VALIDO**. `valid` mira que no
    # este vencido, no que alcance para lo que se le va a pedir: sin
    # esto, desplegar falla con `403 insufficient authentication scopes`
    # mucho despues, y el mensaje no dice que hay que volver a autorizar.
    if cred and set(SCOPES) - dados:
        if not interactivo:
            return None
        print('   el token que hay no alcanza para los permisos nuevos: '
              'vuelvo a pedir autorización')
        cred = None
    if cred and cred.valid:
        return cred
    if cred and cred.expired and cred.refresh_token:
        cred.refresh(Request())
        _guardar(cred)
        return cred
    if not interactivo:
        return None

    if not os.path.exists(CLIENTE):
        sys.exit('falta %s — bajalo de Google Cloud Console:\n'
                 '  Google Auth Platform -> Clients -> el cliente de '
                 'escritorio -> Download JSON' % os.path.basename(CLIENTE))
    from google_auth_oauthlib.flow import InstalledAppFlow
    flow = InstalledAppFlow.from_client_secrets_file(CLIENTE, SCOPES)
    # ⚠️ `prompt='consent'` FUERZA QUE VENGA EL REFRESH TOKEN. Sin eso,
    # si ya autorizaste antes, Google devuelve solo un access token de una
    # hora y el archivo queda sin `refresh_token` — anda hoy y falla
    # mañana, que es la peor forma de fallar.
    cred = flow.run_local_server(port=0, prompt='consent',
                                 authorization_prompt_message=
                                 '\n   Abriendo el navegador para autorizar…\n'
                                 '   Si dice «Google hasn\'t verified this '
                                 'app»: Advanced -> Go to … (unsafe).\n',
                                 success_message=
                                 'Listo, ya podés cerrar esta pestaña.')
    _guardar(cred)
    return cred


def _guardar(cred):
    with io.open(TOKEN, 'w', encoding='utf-8') as f:
        f.write(cred.to_json())
    try:
        os.chmod(TOKEN, 0o600)
    except OSError:
        pass


def probar(cred):
    """Lee el proyecto del Oficial. Devuelve (ok, que_paso)."""
    import requests
    from webapp_rangos import SID
    r = requests.get('https://script.googleapis.com/v1/projects/%s/content'
                     % SID,
                     headers={'Authorization': 'Bearer ' + cred.token},
                     timeout=60)
    if r.status_code == 200:
        n = len(r.json().get('files', []))
        return True, 'leí el proyecto: %d archivo(s)' % n
    if r.status_code == 403 and 'has not enabled' in r.text:
        return False, ('sigue el 403 del interruptor. Entrá a '
                       'script.google.com/home/usersettings y activá '
                       '«Google Apps Script API»')
    return False, '%s %s' % (r.status_code, r.text[:120])


def main():
    print('\n══ AUTORIZAR PARA ESCRIBIR EL APPS SCRIPT ══\n')
    if '--ver' in sys.argv:
        cred = credenciales(interactivo=False)
        if not cred:
            print('   no hay token todavía. Corré `python sheet/autorizar.py`\n')
            return 1
        ok, que = probar(cred)
        print('   %s %s\n' % ('✅' if ok else '🔴', que))
        return 0 if ok else 1

    for f, q in ((CLIENTE, 'el cliente de OAuth'),):
        print('   %-22s %s' % (os.path.basename(f),
                               'está' if os.path.exists(f) else '🔴 falta'))
    cred = credenciales()
    print('\n   ✅ token guardado en %s' % os.path.basename(TOKEN))
    ok, que = probar(cred)
    print('   %s %s' % ('✅' if ok else '🔴', que))
    if ok:
        print('\n   Ya puedo subir el parche: '
              '`python sheet/webapp_rangos.py --aplicar`\n')
    else:
        print('')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
