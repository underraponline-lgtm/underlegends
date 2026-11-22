# -*- coding: utf-8 -*-
"""🕕 LA TAREA DE LA PC: las promos nuevas se bajan solas cada 6 horas (22/11/2026).

Dlx, a «¿programo en tu PC que las promos nuevas se bajen solas?»: *«Dale»* y *«las 2 juntas»* (esto, y el video de la
promo adentro de su historia mientras no tiene recorte: `PromoVideo` de web/src/arriba.jsx).

YouTube no deja bajar desde GitHub (ver `sonidos_promos.py`), así que corre en la PC de Dlx, en el Programador de tareas
de Windows: `\\LigaGlobal\\SonidosPromos`, cada 6 horas y, si la PC estaba apagada a esa hora, en cuanto se prende.

Cada vez:
  1. pone al día SU copia del repo con lo último de `main` (los canales y la Lista de hoy, y la herramienta de hoy). Es
     una copia aparte, en %LOCALAPPDATA%\\LigaGlobal\\tareas, con sólo herramientas/, bot/, comun/ y datos/: nunca toca
     una carpeta donde alguien esté trabajando
  2. corre `herramientas/sonidos_promos.py --hacer` con las claves del .env que se le dio al instalar (`LG_ENV`)
  3. deja lo que pasó en `sonidos_promos.log`, al lado de la copia (los últimos 400 renglones)

Sin ventana (`pythonw`), y como mucho 40 minutos por vuelta. En R2 sólo escribe `sonidos/`: nada de KV ni de datos/.

    python herramientas/sonidos_promos_tarea.py --instalar --env <ruta al .env>   # copia, programa y corre una vez
    python herramientas/sonidos_promos_tarea.py --correr                          # una vuelta, como la tarea
    python herramientas/sonidos_promos_tarea.py --sacar                           # saca la tarea (la copia queda)

⚠️ Si el proyecto se muda de carpeta, el .env cambia de lugar: volver a correr `--instalar --env <la ruta nueva>`. El log
lo dice («falta DISCORD_TOKEN»).
"""
import datetime as dt
import json
import os
import shutil
import subprocess
import sys
from zoneinfo import ZoneInfo

URL = 'https://github.com/underraponline-lgtm/underlegends.git'
# ⚠️ EN LA CARPETA DEL USUARIO Y NO EN %LOCALAPPDATA% (22/11/2026): instalada desde la app de Claude, que está empaquetada
# (MSIX), Windows desvía lo que se escribe en AppData\Local a una carpeta propia del paquete
# (`AppData\Local\Packages\Claude_…\LocalCache`). Desde adentro de la app se ve igual; la tarea programada corre afuera y no
# encontraba nada («can't open file …\LocalCache\…\sonidos_promos_tarea.py»). La carpeta del usuario no se desvía
DIR = os.path.join(os.path.expanduser('~'), 'LigaGlobal', 'tareas')
CLON = os.path.join(DIR, 'underlegends')
LOG = os.path.join(DIR, 'sonidos_promos.log')
CONF = os.path.join(DIR, 'sonidos_promos.json')
#: lo que la copia trae (patrones de sparse-checkout sin «cono»): todo lo de Python que la herramienta puede importar y los
#: datos, pero NO la página construida (`bot/paginas/`, 53 MB que cambian en cada publicación y que esto no usa). Medido al
#: instalar: con `bot/` entera la copia pesaba 204 MB
CARPETAS = ['/herramientas/', '/comun/', '/datos/', '/bot/', '!/bot/paginas/']
TAREA, RUTA_TAREA = 'SonidosPromos', '\\LigaGlobal\\'
NO_VENTANA = 0x08000000 if os.name == 'nt' else 0


def _git(*a, **kw):
    git = shutil.which('git') or 'git'
    return subprocess.run([git, *a], capture_output=True, text=True, encoding='utf-8', errors='replace', creationflags=NO_VENTANA, **kw)


def anotar(texto):
    os.makedirs(DIR, exist_ok=True)
    ahora = dt.datetime.now(ZoneInfo('America/New_York')).strftime('%Y-%m-%d %I:%M %p ET')
    viejo = []
    if os.path.exists(LOG):
        with open(LOG, encoding='utf-8', errors='replace') as f:
            viejo = f.read().splitlines()
    nuevo = viejo + ['── %s' % ahora] + [l for l in texto.splitlines() if l.strip()]
    with open(LOG, 'w', encoding='utf-8') as f:
        f.write('\n'.join(nuevo[-400:]) + '\n')


def poner_al_dia():
    """La copia aparte, al día con main. Devuelve un texto para el log."""
    if not os.path.isdir(os.path.join(CLON, '.git')):
        os.makedirs(DIR, exist_ok=True)
        r = _git('clone', '--filter=blob:none', '--no-checkout', '--depth', '1', URL, CLON)
        if r.returncode:
            return 'no pude copiar el repo: ' + r.stderr[-200:]
        _git('-C', CLON, 'sparse-checkout', 'set', '--no-cone', *CARPETAS)
        r = _git('-C', CLON, 'checkout', 'main')
        return 'copia nueva del repo' if not r.returncode else 'no pude armar la copia: ' + r.stderr[-200:]
    r = _git('-C', CLON, 'fetch', '--depth', '1', 'origin', 'main')
    if r.returncode:
        return 'no pude traer main (sigo con lo que había): ' + r.stderr[-160:]
    # es una copia sólo para esto: lo de main gana siempre (y los patrones, los de esta versión)
    _git('-C', CLON, 'sparse-checkout', 'set', '--no-cone', *CARPETAS)
    _git('-C', CLON, 'reset', '--hard', 'origin/main')
    return 'al día con main (%s)' % _git('-C', CLON, 'rev-parse', '--short', 'HEAD').stdout.strip()


def correr():
    conf = {}
    if os.path.exists(CONF):
        with open(CONF, encoding='utf-8') as f:
            conf = json.load(f)
    linea = poner_al_dia()
    env = dict(os.environ)
    if conf.get('env'):
        env['LG_ENV'] = conf['env']
    env['PYTHONIOENCODING'] = 'utf-8'
    # ffmpeg vive donde lo deja winget, que no siempre está en el PATH de una tarea
    winget = os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Microsoft', 'WinGet', 'Links')
    env['PATH'] = winget + os.pathsep + env.get('PATH', '')
    py = sys.executable.replace('pythonw.exe', 'python.exe')
    try:
        r = subprocess.run([py, os.path.join(CLON, 'herramientas', 'sonidos_promos.py'), '--hacer'], cwd=CLON, env=env,
                           capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=40 * 60, creationflags=NO_VENTANA)
        salida = '\n'.join(l for l in (r.stdout + '\n' + r.stderr).splitlines() if not l.startswith('[download]'))
        anotar('%s\n%s\nterminó con %d' % (linea, salida[-6000:], r.returncode))
        return r.returncode
    except subprocess.TimeoutExpired:
        anotar('%s\n⚠️ pasó de 40 minutos: se cortó' % linea)
        return 1


def _ps(script):
    return subprocess.run(['powershell', '-NoProfile', '-NonInteractive', '-Command', script], capture_output=True, text=True,
                          encoding='utf-8', errors='replace', creationflags=NO_VENTANA)


def instalar(env_path):
    if not env_path or not os.path.exists(env_path):
        sys.exit('falta --env <ruta al .env> (con DISCORD_TOKEN y CLOUDFLARE_API_TOKEN)')
    os.makedirs(DIR, exist_ok=True)
    with open(CONF, 'w', encoding='utf-8') as f:
        json.dump({'env': os.path.abspath(env_path)}, f, ensure_ascii=False)
    print('   ', poner_al_dia())
    pyw = os.path.join(os.path.dirname(sys.executable), 'pythonw.exe')
    if not os.path.exists(pyw):
        pyw = sys.executable
    arg = '"%s" --correr' % os.path.join(CLON, 'herramientas', 'sonidos_promos_tarea.py')
    r = _ps("$a = New-ScheduledTaskAction -Execute '%s' -Argument '%s' -WorkingDirectory '%s';"
            "$t = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Hours 6);"
            "$s = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries "
            "-ExecutionTimeLimit (New-TimeSpan -Minutes 40) -MultipleInstances IgnoreNew;"
            "Register-ScheduledTask -TaskName '%s' -TaskPath '%s' -Action $a -Trigger $t -Settings $s "
            "-Description 'Liga Global: baja las promos nuevas y las sube a R2 para que suenen en la pagina (herramientas/sonidos_promos.py)' -Force | Out-Null;"
            "(Get-ScheduledTask -TaskName '%s' -TaskPath '%s').State"
            % (pyw, arg.replace("'", "''"), CLON, TAREA, RUTA_TAREA, TAREA, RUTA_TAREA))
    print('    tarea %s%s: %s' % (RUTA_TAREA, TAREA, (r.stdout.strip() or r.stderr.strip()[-300:])))
    return 0 if r.returncode == 0 and r.stdout.strip() else 1


def sacar():
    r = _ps("Unregister-ScheduledTask -TaskName '%s' -TaskPath '%s' -Confirm:$false" % (TAREA, RUTA_TAREA))
    print('    sacada' if r.returncode == 0 else r.stderr[-300:])
    return r.returncode


if __name__ == '__main__':
    a = sys.argv[1:]
    if '--instalar' in a:
        sys.exit(instalar(a[a.index('--env') + 1] if '--env' in a and a.index('--env') + 1 < len(a) else ''))
    if '--sacar' in a:
        sys.exit(sacar())
    if '--correr' in a:
        sys.exit(correr())
    print(__doc__)
