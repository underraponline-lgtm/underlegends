# -*- coding: utf-8 -*-
"""¿ENTRÓ ALGÚN SECRETO AL REPO? Mira el árbol Y todo el historial.

    python herramientas/secretos_en_git.py

🔴 POR QUE MIRA EL HISTORIAL Y NO SOLO LOS ARCHIVOS DE HOY. `CLAUDE.md` lo
dice de `creds.json`: *«si alguna vez entra al repo, no alcanza con borrarla
en el commit siguiente — queda en el historial»*. Un chequeo que sólo mira
`git status` da verde el día después de la filtración, que es justo cuando
hace falta que grite.

⚠️ NO LEE UNA LISTA DE SECRETOS ESCRITA A MANO. Toma los valores de `.env`,
`creds.json` y `oauth_token.json` **al correr**, así que un secreto nuevo
queda cubierto sin tocar este archivo. Es la regla del proyecto: una decisión
que vive en dos lugares discrepa.

🔴 Y DISTINGUE LO QUE ES PUBLICO. `DISCORD_PUBLIC_KEY` y `MEE6_PUBLIC_KEY`
están en `.env` y **no son secretos**: sirven para *verificar* la firma
Ed25519 de lo que manda Discord, no para actuar. La del bot está versionada
en `bot/wrangler.toml` a propósito.

⚠️ Un chequeo que las marca es peor que no tenerlo: la primera corrida de
esto dijo «2 FILTRADOS — hay que rotar», y rotarlas habría significado
resetear el par de claves de la app y **romper la verificación del Worker**.
Una alarma que pide el arreglo equivocado hace daño.

Ver `ACCESOS.md` (gitignoreado) para el inventario completo.
"""
import io
import json
import os
import subprocess
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)

# 🔴 LO QUE ESTA EN `.env` Y NO ES SECRETO. Ver el docstring: marcar esto
# como filtrado pide un arreglo que rompe el Worker.
PUBLICOS = {
    'DISCORD_PUBLIC_KEY': 'verifica la firma de Discord · va en wrangler.toml',
    'MEE6_PUBLIC_KEY':    'idem, de la app de MEE6',
    'DISCORD_APP_ID':     'un ID, es público',
    'MEE6_APP_ID':        'un ID, es público',
    'DISCORD_GUILD_PRUEBA': 'el guild de FFA, es público',
}

# Debajo de esto no se busca: un valor corto da coincidencias por casualidad
# (los snowflakes de 18-19 dígitos aparecen en `datos/` de a cientos).
MINIMO = 24


def del_env():
    out = {}
    p = os.path.join(BASE, '.env')
    if not os.path.exists(p):
        return out
    for l in io.open(p, encoding='utf-8'):
        l = l.strip()
        if l and not l.startswith('#') and '=' in l:
            k, v = l.split('=', 1)
            out[k.strip()] = v.strip()
    return out


def de_los_json():
    """Los pedazos de `creds.json` y `oauth_token.json` que sí son secretos."""
    out = {}
    p = os.path.join(BASE, 'creds.json')
    if os.path.exists(p):
        d = json.load(io.open(p, encoding='utf-8'))
        # ⚠️ La private_key entera trae saltos de linea escapados, asi que
        # se busca un trozo del medio: `git grep` es por linea.
        pk = (d.get('private_key') or '').replace('\\n', '\n')
        cuerpo = ''.join(pk.split('\n')[1:-2])[:60]
        if cuerpo:
            out['creds.json · private_key'] = cuerpo
        if d.get('private_key_id'):
            out['creds.json · private_key_id'] = d['private_key_id']
    p = os.path.join(BASE, 'oauth_token.json')
    if os.path.exists(p):
        d = json.load(io.open(p, encoding='utf-8'))
        for k in ('refresh_token', 'client_secret', 'token'):
            if d.get(k) and len(str(d[k])) >= MINIMO:
                out['oauth_token.json · %s' % k] = str(d[k])
    return out


def en_git(valor):
    """(en el árbol, en el historial) — las dos preguntas, por separado."""
    arbol = subprocess.run(['git', 'grep', '-l', '-F', valor],
                           cwd=BASE, capture_output=True, text=True,
                           encoding='utf-8', errors='replace').stdout.strip()
    hist = subprocess.run(['git', 'log', '--all', '-S', valor, '--oneline'],
                          cwd=BASE, capture_output=True, text=True,
                          encoding='utf-8', errors='replace').stdout.strip()
    return arbol, hist


def main():
    print('\n══ ¿HAY ALGUN SECRETO EN GIT? ══\n')

    # 🔴 PRIMERO: QUE LOS ARCHIVOS DE CREDENCIALES ESTEN IGNORADOS. Es la
    # comprobación que `CLAUDE.md` pide antes del primer commit de cada
    # sesión, y acá se hace sola.
    print('  los archivos:')
    faltan = 0
    # 🔴 SON CINCO, Y ESTA LISTA DECIA CUATRO. `oauth_client.json` trae el
    # `client_secret` del OAuth de Apps Script —35 caracteres, vivo— y no
    # estaba. Lo encontro `herramientas/repo_publico.py` el 24/09/2026
    # mirando el disco en vez de mirar git: esta ignorado en
    # `.gitignore:168`, asi que no hubo filtracion, **pero nadie
    # comprobaba que siguiera ignorado**. Una linea borrada de
    # `.gitignore` y el secreto entra sin que nada grite.
    #
    # ⚠️ CLAUDE.md tambien dice «los cuatro archivos». Queda corregido
    # ahi; el numero vive aca.
    for f in ('.env', 'creds.json', 'oauth_token.json', 'oauth_client.json',
              'ACCESOS.md'):
        r = subprocess.run(['git', 'check-ignore', '-q', f], cwd=BASE)
        existe = os.path.exists(os.path.join(BASE, f))
        if r.returncode == 0:
            print('    ✅ %-18s ignorado%s'
                  % (f, '' if existe else '  (no existe todavía)'))
        else:
            faltan += 1
            print('    🔴 %-18s NO ESTA IGNORADO' % f)

    secretos = {}
    for k, v in del_env().items():
        if k in PUBLICOS or len(v) < MINIMO:
            continue
        secretos['.env · %s' % k] = v
    secretos.update(de_los_json())

    print('\n  los valores (%d, de .env y los dos json):' % len(secretos))
    malo = []
    for etq, v in sorted(secretos.items()):
        arbol, hist = en_git(v)
        if arbol or hist:
            malo.append((etq, arbol, hist))
            print('    🔴 %-32s' % etq)
            if arbol:
                print('         en el árbol:     %s' % arbol.replace('\n', ', ')[:70])
            if hist:
                print('         en el historial: %s' % hist.splitlines()[0][:70])
        else:
            print('    ✅ %-32s no está' % etq)

    if PUBLICOS:
        print('\n  no se buscan, porque NO son secretos:')
        for k, por in sorted(PUBLICOS.items()):
            print('    ·  %-22s %s' % (k, por))

    print('')
    if faltan:
        print('  🔴 %d archivo(s) de credenciales sin ignorar. Arreglar ESO '
              'primero.\n' % faltan)
    if malo:
        print('  🔴 %d SECRETO(S) EN GIT.\n' % len(malo))
        print('  Borrarlos del commit siguiente NO alcanza: quedan en el')
        print('  historial. Hay que ROTARLOS. El orden está en ACCESOS.md.\n')
        return 1
    if faltan:
        return 1
    print('  ✅ ningún secreto en el árbol ni en el historial\n')
    return 0


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    sys.exit(main())
