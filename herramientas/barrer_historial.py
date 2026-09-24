# -*- coding: utf-8 -*-
"""¿HAY ALGUNA CLAVE EN EL HISTORIAL DE GIT? Se corre ANTES del primer push.

    python herramientas/barrer_historial.py

🔴 `.gitignore` PROTEGE DE ACA EN ADELANTE, NO HACIA ATRAS. Es la regla que
`CLAUDE.md` ya escribe sobre `creds.json`: *«si alguna vez entra al repo, no
alcanza con borrarla en el commit siguiente — queda en el historial y hay que
rotarla en Google Cloud»*. Este repo nunca se empujo, asi que el primer push
manda **todos los commits de una vez**: un archivo que hoy esta ignorado pero
que entro en el commit 3 sube igual, y en ese momento ya es publico.

Por eso esto mira **cada version de cada archivo que alguna vez estuvo en un
commit**, no el arbol de trabajo.

⚠️ NO ALCANZA CON BUSCAR LOS NOMBRES DE ARCHIVO. Una clave pegada dentro de un
`.py` de hace tres semanas no se llama `creds.json`. Se busca el CONTENIDO.

⚠️ Y NO ALCANZA CON MIRAR EL ULTIMO COMMIT DE CADA ARCHIVO: lo que importa es
si estuvo ALGUNA VEZ. Un archivo agregado y borrado despues sigue en el
historial y sigue subiendo.
"""
import os
import re
import subprocess
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Cada patron esta por algo que este proyecto de verdad maneja.
PATRONES = [
    ('clave privada de Google', re.compile(r'-----BEGIN [A-Z ]*PRIVATE KEY-----')),
    ('cuenta de servicio (json)', re.compile(r'"type"\s*:\s*"service_account"')),
    ('clave de API de Google', re.compile(r'\bAIza[\w-]{35}\b')),
    ('token de bot de Discord', re.compile(r'\b[MNO][\w-]{22,}\.[\w-]{6}\.[\w-]{25,}\b')),
    ('webhook de Discord', re.compile(r'discord(?:app)?\.com/api/webhooks/\d+/\S+')),
    ('token de Cloudflare', re.compile(r'\b[A-Za-z0-9_-]{40}\b(?=.{0,40}(?i:cloudflare))')),
    ('token de GitHub', re.compile(r'\bgh[pousr]_[A-Za-z0-9]{36,}\b')),
    ('clave AWS', re.compile(r'\bAKIA[0-9A-Z]{16}\b')),
    ('asignacion sospechosa', re.compile(
        r'(?i)(?:^|\s)(?:token|secret|api_?key|password|passwd)\s*[:=]\s*'
        r'[\'"][A-Za-z0-9_\-./+]{16,}[\'"]')),
]
# lo que NO es secreto aunque lo parezca
PERMITIDO = re.compile(
    r'(?i)(ejemplo|example|tu_token|<[^>]+>|xxx+|\.\.\.|placeholder|aca_va)')


def git(*args):
    r = subprocess.run(['git'] + list(args), cwd=BASE, capture_output=True)
    return r.stdout


def main():
    if not os.path.isdir(os.path.join(BASE, '.git')):
        sys.exit('no es un repo git')
    commits = git('rev-list', '--all').decode().split()
    print('\n  %d commit(s) en el historial' % len(commits))

    # todos los blobs que alguna vez existieron, con el nombre que tuvieron
    salida = git('rev-list', '--objects', '--all').decode('utf-8', 'replace')
    blobs = {}
    for linea in salida.splitlines():
        p = linea.split(' ', 1)
        if len(p) == 2 and p[1].strip():
            blobs.setdefault(p[0], p[1])
    print('  %d objeto(s) con nombre a revisar' % len(blobs))

    # ⚠️ TAMBIEN LOS ARCHIVOS QUE HOY ESTAN IGNORADOS PERO ESTUVIERON DENTRO.
    # Es el caso que este barrido existe para encontrar.
    nombres = {}
    for sha, nom in blobs.items():
        base = os.path.basename(nom)
        if base in ('creds.json', '.env') or base.endswith('.pem'):
            nombres.setdefault(base, []).append(nom)

    hallazgos, revisados = [], 0
    for sha, nom in blobs.items():
        if nom.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.woff2',
                                 '.ttf', '.ico', '.gif', '.zip')):
            continue
        datos = git('cat-file', '-p', sha)
        if not datos or len(datos) > 3_000_000:
            continue
        revisados += 1
        try:
            txt = datos.decode('utf-8', 'replace')
        except Exception:
            continue
        for que, pat in PATRONES:
            for m in pat.finditer(txt):
                ctx = txt[max(0, m.start() - 40):m.end() + 40]
                if PERMITIDO.search(ctx):
                    continue
                hallazgos.append((nom, que, m.group(0)[:44]))
                break

    print('  %d blob(s) de texto revisados\n' % revisados)

    if nombres:
        print('  🔴 ARCHIVOS QUE HOY SE IGNORAN PERO ESTUVIERON EN UN COMMIT:')
        for base, dondes in sorted(nombres.items()):
            print('     %s   (%s)' % (base, ', '.join(sorted(set(dondes))[:3])))
        print('')

    if not hallazgos:
        print('  ✅ NADA. Ningún commit del historial contiene una clave.\n')
        return 0
    print('  🔴 %d HALLAZGO(S):\n' % len(hallazgos))
    vistos = set()
    for nom, que, muestra in hallazgos:
        if (nom, que) in vistos:
            continue
        vistos.add((nom, que))
        print('     %-46s %s' % (nom, que))
        print('        %s…' % muestra)
    print('\n  ⚠️ NO EMPUJAR hasta resolverlo. Y si alguna es real, no alcanza')
    print('     con borrarla: hay que ROTARLA donde se emitió.\n')
    return 1


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    sys.exit(main())
