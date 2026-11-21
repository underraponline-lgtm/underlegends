# -*- coding: utf-8 -*-
"""🎧 LOS BEATS DE LAS HISTORIAS: los instrumentales de verdad que suenan en las historias de la página (21/11/2026).

Dlx, 21/11/2026: *«ahí a la sesión principal le añadí la lista de beatmakers permitidos… puedes usar beats así… para
que algunas historias también tengan beats así. Pero también intenta integrar bien las instrumentales en las
historias»*.

    python herramientas/beats_historias.py              # qué hay y qué falta, sin bajar nada
    python herramientas/beats_historias.py --hacer      # baja lo que falta, recorta y deja la lista de la página
    python herramientas/beats_historias.py --auto       # self-check

⚠️ SÓLO CON PERMISO, como la prueba de micro (`grabador/voz/hacer_beat.py`): el beatmaker tiene que estar en
`datos/beatmakers.json`, o el beat tiene que decir «Free» o «Uso libre» (y entonces va `uso_libre`). Cada beat se
acredita en la historia que lo toca, con el link a su video.

Lo que hace con cada uno de `ELEGIDOS`:
  · lo baja de YouTube con yt-dlp, sólo el audio, a una carpeta temporal (el original NO entra al repo)
  · busca dónde arranca de verdad (`donde_arranca()` de hacer_beat.py: salta la intro) y corta `LARGO` segundos
  · lo deja en −16 LUFS (todos igual de fuerte: la página baja el volumen general) con fundidos cortitos en las puntas
    para que no hagan clic; los fundidos largos los hace la página, que cruza un beat con el siguiente
  · AAC de 96 kbps en `.m4a` (Safari, Chrome y Firefox lo tocan) en `bot/paginas/beats/`
  · y escribe `web/src/beats_lista.json`: por estilo (boombap, trap, drill), archivo, título, beatmaker y link

Los estilos son los de las historias (`beatDe()` de web/src/arriba.jsx): boom bap para lo que se festeja, drill para lo
que es pelea, trap para el chat que explota, el rango y tu servidor.
"""
import importlib.util
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARPETA = os.path.join(BASE, 'bot', 'paginas', 'beats')
LISTA = os.path.join(BASE, 'web', 'src', 'beats_lista.json')
#: cuántos segundos de cada beat: una tanda de historias del mismo estilo dura eso o menos; si dura más, la página cruza
#: al siguiente beat del mismo estilo
LARGO = 42
ESTILOS = ('boombap', 'trap', 'drill')

#: 🎚️ LOS ELEGIDOS, a mano, de los canales de los beatmakers con permiso (21/11/2026: se buscó el canal de los 51 de
#: `datos/beatmakers.json` y se miraron sus beats): `(id de YouTube, estilo, título, beatmaker, uso libre)`.
#: ⚠️ NUNCA uno con música de otro adentro, aunque el beatmaker tenga permiso: los «remake» y los «remix» de canciones
#: (Undbts, IroníaZka), ni los que samplean algo conocido (el Chavo del 8, Pac-Man). El permiso es del beatmaker, no de
#: la canción que usó. Doce beatmakers, cinco o seis por estilo, para que no suene siempre el mismo
ELEGIDOS = [
    # 🏆 boom bap: lo que se festeja (campeón, títulos, premios, debut, felicitaciones)
    ('ldB0NsRR7FI', 'boombap', 'Mamma Mia', 'Azerbeats', False),
    ('Xj2mSVi8nuU', 'boombap', 'Ghetto Boyz', 'Denek Beats', True),
    ('yjfmSl-zrBQ', 'boombap', 'Cell Phones', 'LethalNeedleBeats', True),
    ('n8pcg_I3_6Y', 'boombap', 'Love and Shit', 'Viruz Beatmaker', True),
    ('AWVhgT_6U5k', 'boombap', '1938', 'Lauto Beats', True),
    ('u2jc4sovPMQ', 'boombap', 'Achimega', 'DJ Bootrax', False),
    # ⚔️ drill: lo que es pelea (desafíos, cara a cara, polémica, cazas, finales)
    ('GlYx0rVW_2E', 'drill', 'El Abismo', 'Jd Beats', True),
    ('2jgBgHaauOw', 'drill', 'Andrómeda', '7mobeats', False),
    ('eoSW8pn3_54', 'drill', 'Hollow', 'Deejay Santy', False),
    ('Tgg0ukxgsUA', 'drill', 'Chernobyl', 'Denek Beats', True),
    ('7bkwA2n_8VA', 'drill', 'Devil Drill', "Alejandre's Beats", True),
    # 🔥 trap: el chat que explota, el raid, el rango, tu servidor y tu crew
    ('6H87vrztX8Y', 'trap', 'Surf', 'Aelat Beats', True),
    ('2-TnW6usTok', 'trap', 'Slow Wind', 'Lauto Beats', True),
    ('uxvQHo26NUg', 'trap', 'Ghost City', 'Eznar Beats', False),
    ('kdQouGTJwzc', 'trap', 'Hijōshiki', 'Jd Beats', True),
    ('V4czXKXrBj8', 'trap', 'Beat Trap #2', 'ZkN', True),
]


def _hacer_beat():
    """Las funciones de la prueba de micro: el permiso y dónde arranca el beat (una sola regla para los dos usos)."""
    ruta = os.path.join(BASE, 'grabador', 'voz', 'hacer_beat.py')
    spec = importlib.util.spec_from_file_location('hacer_beat', ruta)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def archivo_de(beatmaker, titulo, clave):
    return '%s-%s.m4a' % (clave(beatmaker)[:24], clave(titulo)[:28] or 'beat')


def bajar(vid, dir_):
    import yt_dlp
    o = {'quiet': True, 'no_warnings': True, 'format': 'bestaudio/best', 'outtmpl': os.path.join(dir_, '%(id)s.%(ext)s'),
         'noplaylist': True, 'socket_timeout': 30}
    with yt_dlp.YoutubeDL(o) as y:
        info = y.extract_info('https://www.youtube.com/watch?v=' + vid, download=True)
        return y.prepare_filename(info)


def recortar(origen, salida, desde):
    fin = LARGO - 0.4
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(desde), '-t', str(LARGO), '-i', origen,
                    '-af', 'afade=t=in:d=0.05,afade=t=out:st=%s:d=0.4,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100' % fin,
                    '-ac', '2', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', salida], check=True)


def lista(elegidos, clave):
    out = {e: [] for e in ESTILOS}
    for vid, estilo, titulo, bm, libre in elegidos:
        out[estilo].append({'a': archivo_de(bm, titulo, clave), 't': titulo, 'b': bm, 'u': 'https://youtu.be/' + vid,
                            **({'libre': 1} if libre else {})})
    return out


def correr(hacer=False):
    hb = _hacer_beat()
    faltan, sin_permiso = [], []
    for vid, estilo, titulo, bm, libre in ELEGIDOS:
        if estilo not in ESTILOS:
            sin_permiso.append((titulo, 'estilo «%s» no existe' % estilo))
            continue
        if not hb.con_permiso(bm) and not libre:
            sin_permiso.append((titulo, '%s no está en datos/beatmakers.json' % bm))
            continue
        if not os.path.exists(os.path.join(CARPETA, archivo_de(bm, titulo, hb.clave))):
            faltan.append((vid, estilo, titulo, bm, libre))
    for t, por in sin_permiso:
        print('   ❌ %s: %s' % (t, por))
    print('   🎧 %d elegidos · %d ya recortados · faltan %d' % (len(ELEGIDOS), len(ELEGIDOS) - len(faltan) - len(sin_permiso), len(faltan)))
    if sin_permiso:
        return 1
    if not hacer:
        return 0
    os.makedirs(CARPETA, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix='beats_')
    try:
        for vid, estilo, titulo, bm, libre in faltan:
            try:
                origen = bajar(vid, tmp)
                desde = hb.donde_arranca(origen, LARGO)
                salida = os.path.join(CARPETA, archivo_de(bm, titulo, hb.clave))
                recortar(origen, salida, desde)
                print('   ✅ %-34s %-8s desde %5.1f s · %4.0f KB' % (os.path.basename(salida), estilo, desde, os.path.getsize(salida) / 1e3))
            except Exception as e:                       # noqa: BLE001
                print('   ⚠️ %s (%s): %s' % (titulo, vid, str(e)[:120]))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    hechos = [e for e in ELEGIDOS if os.path.exists(os.path.join(CARPETA, archivo_de(e[3], e[2], hb.clave)))]
    with io.open(LISTA, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(lista(hechos, hb.clave), f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('   📝 web/src/beats_lista.json: %s' % ', '.join('%s %d' % (e, sum(1 for x in hechos if x[1] == e)) for e in ESTILOS))
    return 0


def _self_check():
    malos = 0

    def ok(c, que):
        nonlocal malos
        print('  %s %s' % ('✅' if c else '❌', que))
        malos += 0 if c else 1
    hb = _hacer_beat()
    ok(all(e[1] in ESTILOS for e in ELEGIDOS), 'cada elegido tiene un estilo de las historias')
    ok(all(hb.con_permiso(e[3]) or e[4] for e in ELEGIDOS), 'todos con permiso: el beatmaker en datos/beatmakers.json o de uso libre')
    ok(len({e[0] for e in ELEGIDOS}) == len(ELEGIDOS), 'ningún beat dos veces')
    try:
        doc = json.load(io.open(LISTA, encoding='utf-8'))
    except (OSError, ValueError):
        doc = {}
    archivos = [x['a'] for e in ESTILOS for x in doc.get(e, [])]
    ok(all(os.path.exists(os.path.join(CARPETA, a)) for a in archivos), 'cada beat de la lista de la página está en bot/paginas/beats/')
    sueltos = [f for f in (os.listdir(CARPETA) if os.path.isdir(CARPETA) else []) if f.endswith('.m4a') and f not in archivos]
    ok(not sueltos, 'y no queda ningún recorte sin su crédito en la lista %s' % sueltos[:3])
    ok(all(x.get('b') and x.get('u') for e in ESTILOS for x in doc.get(e, [])), 'cada beat de la página lleva su beatmaker y su link')
    print('\n%s' % ('✅ los beats de las historias' if not malos else '❌ %d falla(s)' % malos))
    return 1 if malos else 0


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:                                    # noqa: BLE001
        pass
    a = sys.argv[1:]
    sys.exit(_self_check() if '--auto' in a else correr(hacer='--hacer' in a))
