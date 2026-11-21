# -*- coding: utf-8 -*-
"""SUMAR UN BEAT A LA PRUEBA DE MICRO: 4 barras de beat, ULAYA cuenta en la 4.ª y el MC entra en el 1 siguiente.

    python hacer_beat.py <beat original.mp3|webm|wav|…> --beatmaker "Azerbeats" --titulo "Nombre del beat"
                         [--entra <barra>] [--uso-libre] [--fuente <link>] [--carpeta <dir>]

Dlx, 21/11/2026: *«que ULAYA reproduzca un beat para que el MC pruebe»*, *«tenemos permisos de estos beatmakers»*, y
a la primera versión: *«ULAYA tiene que decir 3 2 1 y tiempo sobre el beat… no en cualquier momento del beat, sino
cuando la 4.ª barra va a acabar»*. Cómo es eso y cómo se encuentra cada barra: `ritmo.py`.

⚠️ SÓLO CON PERMISO: el beatmaker tiene que estar en `datos/beatmakers.json`, o el beat tiene que decir «Free» o «Uso
libre» (y va `--uso-libre`). Si no, no se agrega. Al repo va el recorte con su crédito, nunca el tema entero.

Lo que arma:
  · desde 4 barras antes de la entrada del MC hasta `DESPUES_S` después (barras enteras, para que el micro escuche 20 s
    con beat), con fundido de salida
  · en los 4 golpes de la 4.ª barra, «¡Tres!» «¡Dos!» «¡Uno!» «¡Tiempo!» (voz/cuenta/, la versión A que eligió Dlx),
    cada palabra con su «centro de percepción» sobre el golpe (`ritmo.pcentro()`)
  · el beat a −22 LUFS medido en lo que rapea el MC (la intro queda más baja, como es), las palabras ~13 dB arriba
  · Ogg Opus 48 kHz estéreo, cuadros de 20 ms, 96 kbps: Discord lo manda tal cual
  · lo anota en `beats/beats.json`: crédito, BPM, dónde entra el MC (`entra_s`) y dónde cae cada palabra
Y COMPRUEBA LO QUE ARMÓ: cada palabra tiene que sonar al menos 6 dB más fuerte que ese mismo golpe una barra antes.
"""
import argparse
import json
import math
import os
import re
import subprocess
import sys
import unicodedata

import numpy as np

import ritmo

AQUI = os.path.dirname(os.path.abspath(__file__))
PERMISOS = os.path.join(AQUI, '..', '..', 'datos', 'beatmakers.json')
BEAT_LUFS = -22
DESPUES_S = 21            # beat después de la entrada, como mínimo: el micro escucha hasta 20 s
PALABRA_DB_MIN = 6


def clave(n):
    n = re.sub(r'\(.*?\)', '', n or '')
    n = unicodedata.normalize('NFKD', n).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]', '', n.lower())


def con_permiso(beatmaker):
    """El nombre como figura en datos/beatmakers.json, o None si no está."""
    lista = json.load(open(PERMISOS, encoding='utf-8'))['beatmakers']
    return next((b['nombre'] for b in lista if clave(b['nombre']) == clave(beatmaker)), None)


def lufs(ruta, desde, hasta):
    r = subprocess.run(['ffmpeg', '-nostats', '-ss', str(desde), '-to', str(hasta), '-i', ruta, '-af', 'ebur128',
                        '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='replace')
    return float(re.findall(r'I:\s*(-?[0-9.]+) LUFS', r.stderr)[-1])


def db(x, a, b, hz):
    s = x[max(0, int(a * hz)):int(b * hz)]
    return 20 * math.log10(math.sqrt(float(np.mean(s.astype(np.float64) ** 2)) + 1e-12))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('archivo')
    ap.add_argument('--beatmaker', required=True)
    ap.add_argument('--titulo', required=True)
    ap.add_argument('--entra', type=int, help='la barra (desde 0, la primera del tema) donde entra el MC')
    ap.add_argument('--uso-libre', action='store_true', help='el beat dice Free o Uso libre (de cualquier beatmaker)')
    ap.add_argument('--fuente', default='', help='de dónde salió (el link del beatmaker)')
    ap.add_argument('--carpeta', default=os.path.join(AQUI, 'beats'))
    a = ap.parse_args()

    nombre = con_permiso(a.beatmaker)
    if not nombre and not a.uso_libre:
        print('❌ %s no está en datos/beatmakers.json. Si el beat dice «Free» o «Uso libre», va con --uso-libre.' % a.beatmaker)
        return 1
    nombre = nombre or a.beatmaker

    m = ritmo.analizar(a.archivo, a.entra)
    per, entra = m['periodo'], m['t_entra']
    barra = 4 * per
    ini = entra - 4 * barra - 0.03
    if ini < 0:
        print('❌ no hay 4 barras antes de la entrada (barra %d): probar con --entra %d' % (m['entra'], m['entra'] + 4))
        return 1
    fin = entra + math.ceil(DESPUES_S / barra) * barra
    largo = fin - ini
    cuenta = [entra - (4 - i) * per - ini for i in range(4)]
    ganancia = BEAT_LUFS - lufs(a.archivo, entra, fin)
    palabras = [os.path.join(AQUI, 'cuenta', p + '.wav') for p in ritmo.PALABRAS]
    centros = [ritmo.pcentro(w) for w in palabras]

    os.makedirs(a.carpeta, exist_ok=True)
    archivo = '%s-%s.ogg' % (clave(nombre), clave(a.titulo)[:30] or 'beat')
    salida = os.path.join(a.carpeta, archivo)
    filtros = ['[0:a]afade=t=in:d=0.03,volume=%.2fdB,afade=t=out:st=%.3f:d=1.5,aresample=48000,'
               'aformat=channel_layouts=stereo[b]' % (ganancia, largo - 1.5)]
    for i, (c, pc) in enumerate(zip(cuenta, centros)):
        ms = max(0, round((c - pc) * 1000))
        filtros.append('[%d:a]aresample=48000,pan=stereo|c0=c0|c1=c0,dynaudnorm=f=75:g=3:p=0.8,volume=2,'
                       'adelay=%d|%d[w%d]' % (i + 1, ms, ms, i))
    filtros.append('[b][w0][w1][w2][w3]amix=inputs=5:normalize=0:duration=first,alimiter=limit=0.95')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', '%.3f' % ini, '-t', '%.3f' % largo, '-i', a.archivo,
                    *sum((['-i', w] for w in palabras), []), '-filter_complex', ';'.join(filtros),
                    '-ac', '2', '-c:a', 'libopus', '-b:a', '96k', '-frame_duration', '20', salida], check=True)

    # la comprobación: cada palabra, contra el mismo golpe una barra antes (donde no hay palabra)
    x = ritmo.pcm(salida)
    sobre = [round(db(x, c - 0.03, c + 0.3, ritmo.HZ) - db(x, c - barra - 0.03, c - barra + 0.3, ritmo.HZ), 1)
             for c in cuenta]
    ok = min(sobre) >= PALABRA_DB_MIN

    man = os.path.join(a.carpeta, 'beats.json')
    doc = json.load(open(man, encoding='utf-8')) if os.path.exists(man) else {
        '_leeme': ['Los beats de la prueba de micro (grabador/microfono.js), hechos con voz/hacer_beat.py.',
                   'Sólo de beatmakers de datos/beatmakers.json o de beats «Free»/«Uso libre». Se acreditan al final.'],
        'beats': []}
    doc['_leeme'] = ['Los beats de la prueba de micro (grabador/microfono.js), hechos con voz/hacer_beat.py.',
                     'Sólo de beatmakers de datos/beatmakers.json o de beats «Free»/«Uso libre». Se acreditan al final.',
                     'Cada uno trae la cuenta de ULAYA adentro, en la 4.ª barra: entra_s es el 1 donde entra el MC y',
                     'cuenta_s los cuatro golpes de «¡Tres! ¡Dos! ¡Uno! ¡Tiempo!» (segundos desde el principio del archivo).']
    doc['beats'] = [b for b in doc['beats'] if b.get('archivo') != archivo] + [{
        'archivo': archivo, 'titulo': a.titulo, 'beatmaker': nombre, 'uso_libre': bool(a.uso_libre), 'fuente': a.fuente,
        'bpm': round(m['bpm'], 2), 'golpe_s': round(per, 4), 'entra_s': round(entra - ini, 3),
        'cuenta_s': [round(c, 3) for c in cuenta], 'desde_s': round(ini, 3), 'barra_entrada': m['entra'],
        'detector': m['detector'], 'palabras_db': sobre}]
    json.dump(doc, open(man, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
    print('%s %-30s %5.1f BPM · desde %6.2f s del tema · cuenta en %s · entra el MC a los %.2f s · %.0f KB · palabras'
          ' sobre el beat: %s dB · %s'
          % ('✅' if ok else '❌', archivo, m['bpm'], ini, ' '.join('%.2f' % c for c in cuenta), entra - ini,
             os.path.getsize(salida) / 1e3, ' '.join('%+.0f' % s for s in sobre), m['detector']))
    return 0 if ok else 2


if __name__ == '__main__':
    sys.exit(main())
