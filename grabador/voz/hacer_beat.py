# -*- coding: utf-8 -*-
"""SUMAR UN BEAT A LA PRUEBA DE MICRO: un recorte de ~30 s, listo para Discord, acreditado a su beatmaker.

    python hacer_beat.py <archivo.mp3|wav|…> --beatmaker "Azerbeats" --titulo "Nombre del beat"
                         [--desde 12] [--largo 30] [--uso-libre] [--fuente <link>] [--carpeta <dir>]

Dlx, 21/11/2026: *«que ULAYA reproduzca un beat para que el MC pruebe»* y *«tenemos permisos de estos beatmakers»*.

⚠️ SÓLO CON PERMISO: el beatmaker tiene que estar en `datos/beatmakers.json` (los que dieron permiso), o el beat tiene
que decir «Free» o «Uso libre» en el título o la descripción, y entonces se marca `--uso-libre`. Si no, no se agrega.

⚠️ EL ARCHIVO LO PASA DLX O SALE DEL LINK DE DESCARGA DEL MISMO BEATMAKER. No se baja de YouTube.

Lo que hace:
  · corta `--largo` segundos desde `--desde` (sin `--desde`, salta la intro: arranca donde el beat ya suena fuerte)
  · lo deja en −22 LUFS: debajo de la voz de ULAYA (−16) y de la del MC, como en una batalla
  · fundido de entrada 0,3 s y de salida 1,5 s
  · Ogg Opus 48 kHz estéreo, cuadros de 20 ms, 96 kbps: Discord lo manda tal cual
  · lo anota en `beats/beats.json` (archivo, título, beatmaker, fuente, si es de uso libre)
"""
import argparse
import json
import os
import re
import subprocess
import sys
import unicodedata

AQUI = os.path.dirname(os.path.abspath(__file__))
PERMISOS = os.path.join(AQUI, '..', '..', 'datos', 'beatmakers.json')


def clave(n):
    n = re.sub(r'\(.*?\)', '', n or '')
    n = unicodedata.normalize('NFKD', n).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]', '', n.lower())


def con_permiso(beatmaker):
    """El nombre como figura en datos/beatmakers.json, o None si no está."""
    lista = json.load(open(PERMISOS, encoding='utf-8'))['beatmakers']
    return next((b['nombre'] for b in lista if clave(b['nombre']) == clave(beatmaker)), None)


def donde_arranca(ruta, largo):
    """El primer segundo en el que el beat ya suena fuerte (salta intros habladas o en silencio)."""
    r = subprocess.run(['ffmpeg', '-nostats', '-i', ruta, '-af', 'ebur128', '-f', 'null', '-'],
                       capture_output=True, text=True, encoding='utf-8', errors='replace')
    filas = re.findall(r't:\s*([0-9.]+).*?S:\s*(-?[0-9.]+|-inf)', r.stderr)
    puntos = [(float(t), float(s)) for t, s in filas if s != '-inf']
    if not puntos:
        return 0.0
    pico = max(s for _, s in puntos)
    total = puntos[-1][0]
    for t, s in puntos:
        if s >= pico - 8 and t + largo <= total:
            return max(0.0, round(t - 3, 1))      # 3 s antes de llegar a pleno, para que entre con su golpe
    return 0.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('archivo')
    ap.add_argument('--beatmaker', required=True)
    ap.add_argument('--titulo', required=True)
    ap.add_argument('--desde', type=float)
    ap.add_argument('--largo', type=float, default=30)
    ap.add_argument('--uso-libre', action='store_true', help='el beat dice Free o Uso libre (de cualquier beatmaker)')
    ap.add_argument('--fuente', default='', help='de dónde salió (el link del beatmaker)')
    ap.add_argument('--carpeta', default=os.path.join(AQUI, 'beats'))
    a = ap.parse_args()

    nombre = con_permiso(a.beatmaker)
    if not nombre and not a.uso_libre:
        print('❌ %s no está en datos/beatmakers.json. Si el beat dice «Free» o «Uso libre», va con --uso-libre.' % a.beatmaker)
        return 1
    nombre = nombre or a.beatmaker
    desde = a.desde if a.desde is not None else donde_arranca(a.archivo, a.largo)
    os.makedirs(a.carpeta, exist_ok=True)
    archivo = '%s-%s.ogg' % (clave(nombre), clave(a.titulo)[:30] or 'beat')
    salida = os.path.join(a.carpeta, archivo)
    fin = a.largo - 1.5
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(desde), '-t', str(a.largo), '-i', a.archivo,
                    '-af', 'afade=t=in:d=0.3,afade=t=out:st=%s:d=1.5,loudnorm=I=-22:TP=-2:LRA=11,aresample=48000' % fin,
                    '-ac', '2', '-c:a', 'libopus', '-b:a', '96k', '-frame_duration', '20', salida], check=True)

    man = os.path.join(a.carpeta, 'beats.json')
    doc = json.load(open(man, encoding='utf-8')) if os.path.exists(man) else {
        '_leeme': ['Los beats de la prueba de micro (grabador/microfono.js), hechos con voz/hacer_beat.py.',
                   'Sólo de beatmakers de datos/beatmakers.json o de beats «Free»/«Uso libre». Se acreditan al final de la prueba.'],
        'beats': []}
    doc['beats'] = [b for b in doc['beats'] if b.get('archivo') != archivo] + [{
        'archivo': archivo, 'titulo': a.titulo, 'beatmaker': nombre, 'uso_libre': bool(a.uso_libre),
        'fuente': a.fuente, 'desde_s': desde}]
    json.dump(doc, open(man, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
    print('✅ %s · desde %.1f s · %.0f KB · %d beats en total' % (archivo, desde, os.path.getsize(salida) / 1e3, len(doc['beats'])))
    return 0


if __name__ == '__main__':
    sys.exit(main())
