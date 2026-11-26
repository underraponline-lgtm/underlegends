# -*- coding: utf-8 -*-
"""🎬 AUTORIZAR UNA VEZ PARA SUBIR VIDEOS AL CANAL DE YOUTUBE (Dlx, 25/11/2026: «dale x youtube»).

    python herramientas/youtube_autorizar.py          abre el navegador, entras con la cuenta DUEÑA del canal y aceptas
    python herramientas/youtube_autorizar.py --ver    dice a qué canal sube el permiso guardado, sin pedir nada
    python herramientas/youtube_autorizar.py --solo-mirar   abre la pantalla de consentimiento para sacarle captura (la
                                                     auditoría de YouTube la pide, 26/11/2026) y NO guarda nada: el
                                                     token que ya anda —el del secreto YOUTUBE_TOKEN— no se toca

Es el mismo camino que `sheet/autorizar.py` (el del Apps Script): OAuth de aplicación instalada con el cliente de escritorio
del proyecto `liga-global` (`oauth_client.json`, ya en disco). Se autoriza UNA vez en el navegador y queda un refresh
token en `youtube_token.json`; la contraseña nunca pasa por acá.

⚠️ DOS COSAS EN LA CONSOLA DE GOOGLE ANTES DE CORRERLO (proyecto liga-global):
  1. Activar «YouTube Data API v3».
  2. En «Google Auth Platform → Audience», que la app esté «In production» y no «Testing»: en Testing el refresh token
     VENCE A LOS 7 DÍAS y la subida se cae sola una semana después. Sin verificar está bien para uso propio: Google
     muestra «Google hasn't verified this app» → Advanced → Go to liga-global (unsafe). Es la app del proyecto.

⚠️ POR QUÉ DOS PERMISOS Y NO MÁS: `youtube.upload` deja subir videos (y nada más: no borra, no edita lo que ya está) y
`youtube.readonly` deja comprobar a QUÉ canal sube (`--ver`). No se pide `youtube` entero: ese permiso borra videos.

⚠️ `youtube_token.json` ES UN SECRETO: está en `.gitignore` y lo busca `herramientas/secretos_en_git.py`. Si entra al
historial no alcanza con borrarlo: se revoca en myaccount.google.com/permissions y se vuelve a autorizar.

⚠️ SUBIDO POR API, SALE PRIVADO: YouTube deja privado todo lo que sube una app que no pasó su auditoría (gratis, tarda).
Hasta entonces el robot sube en privado y Dlx lo pasa a público, o se espera la aprobación.
"""
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
# 🔑 la app de YouTube vive en su propio proyecto de Google Cloud («YT AUTO», de una cuenta de Dlx): su cliente de escritorio
# va en `youtube_client.json`. Sin él, el de `liga-global` (`oauth_client.json`), cuya consola Dlx no tiene a mano. El proyecto
# de la app y la cuenta dueña del canal pueden ser cuentas distintas: la del canal es la que entra en el navegador
CLIENTE = next((p for p in (os.path.join(BASE, 'youtube_client.json'), os.path.join(BASE, 'oauth_client.json')) if os.path.exists(p)),
               os.path.join(BASE, 'youtube_client.json'))
TOKEN = os.path.join(BASE, 'youtube_token.json')
SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly']


def _guardar(cred):
    with io.open(TOKEN, 'w', encoding='utf-8') as f:
        f.write(cred.to_json())
    try:
        os.chmod(TOKEN, 0o600)
    except OSError:
        pass


def credencial(interactivo=False):
    """La credencial guardada (renovada si hace falta), o la pide en el navegador si `interactivo`. `None` si no hay."""
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    cred = None
    if os.path.exists(TOKEN) and '--solo-mirar' not in sys.argv:     # mirar: siempre la pantalla, sin leer el guardado
        cred = Credentials.from_authorized_user_file(TOKEN, SCOPES)
        # (como en sheet/autorizar.py: los permisos se leen del archivo, no de lo que se pide)
        dados = set(json.load(io.open(TOKEN, encoding='utf-8')).get('scopes') or ())
        if set(SCOPES) - dados:
            cred = None if interactivo else cred
    if cred and cred.valid:
        return cred
    if cred and cred.expired and cred.refresh_token:
        try:
            cred.refresh(Request())
            _guardar(cred)
            return cred
        except Exception as e:                           # noqa: BLE001
            print('   ⚠️ el permiso guardado ya no sirve (%s): hay que volver a autorizar' % str(e)[:80])
            cred = None
    if not interactivo:
        return None
    if not os.path.exists(CLIENTE):
        sys.exit('falta youtube_client.json (Google Cloud, proyecto YT AUTO → Google Auth Platform → Clientes → el de escritorio → Descargar JSON)')
    from google_auth_oauthlib.flow import InstalledAppFlow
    flow = InstalledAppFlow.from_client_secrets_file(CLIENTE, SCOPES)
    # `prompt='consent'` fuerza que venga el refresh token (sin eso, si ya autorizaste, sólo llega uno de una hora)
    cred = flow.run_local_server(port=0, prompt='consent', access_type='offline',
                                 authorization_prompt_message='\n   Abriendo el navegador. Entra con la cuenta DUEÑA del canal y, si '
                                 'te pregunta, elige el canal Under Legends.\n   Si dice «Google hasn\'t verified this app»: '
                                 'Advanced → Go to liga-global (unsafe).\n',
                                 success_message='Listo: ya puedes cerrar esta pestaña.')
    if '--solo-mirar' in sys.argv:
        print('   📸 listo: el permiso de prueba NO se guardó; el de siempre sigue igual')
        sys.exit(0)
    _guardar(cred)
    return cred


def canales(cred):
    """Los canales a los que sube este permiso: `[(id, título)]`."""
    import requests
    r = requests.get('https://www.googleapis.com/youtube/v3/channels', params={'part': 'snippet', 'mine': 'true'},
                     headers={'Authorization': 'Bearer ' + cred.token}, timeout=30)
    if r.status_code == 403 and 'accessNotConfigured' in r.text:
        sys.exit('🔴 falta activar «YouTube Data API v3» en el proyecto liga-global de Google Cloud')
    r.raise_for_status()
    return [(x['id'], x['snippet']['title']) for x in r.json().get('items') or []]


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    ver = '--ver' in sys.argv
    cred = credencial(interactivo=not ver)
    if not cred:
        print('   ❌ no hay permiso guardado para YouTube: corre `python herramientas/youtube_autorizar.py`')
        return 1
    cs = canales(cred)
    if not cs:
        print('   ⚠️ esa cuenta no tiene canal: vuelve a correrlo y elige la cuenta (o la cuenta de marca) del canal')
        return 1
    for cid, t in cs:
        print('   ✅ sube a: %s (%s)' % (t, cid))
    print('   🔑 guardado en youtube_token.json (ignorado por git)' if not ver else '   (sin pedir nada)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
