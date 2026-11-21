# -*- coding: utf-8 -*-
"""LOS GOLPES Y EL 1 DE CADA BARRA, CON EL MODELO ENTRENADO DE beat_this (CPJKU, JKU Linz, MIT).

    <python con beat-this> golpes_ia.py <beat original> [...]      imprime JSON: golpes y unos (el 1 de cada barra)

Dlx, 21/11/2026: la cuenta de ULAYA va en los 4 golpes de la 4.ª barra, y el MC entra en el 1 siguiente. Medido ese
día: mi detector casero (ritmo.py) encontraba bien el tempo y las barras de la intro, pero en los beats hechos con
samples confundía el 1 con un contratiempo (en Cartas y Bukovosky el bajo entra en el «y» del 4, y en Achimega la caja
cae donde él decía «1»). beat_this es un modelo entrenado en miles de temas para encontrar justamente eso: los golpes
y el 1 de cada barra (https://github.com/CPJKU/beat_this, ISMIR 2024).

⚠️ NO VIVE EN EL REPO NI EN RAILWAY: PyTorch (127 MB) y el modelo «final0» (78 MB, de la nube de JKU, se baja solo la
primera vez) van en un entorno aparte, `C:\\Users\\tonyd\\.bt` (ruta corta a propósito: Windows corta a 260
caracteres y PyTorch trae archivos con rutas larguísimas). Lo corre `hacer_beat.py` cuando se suma un beat; lo que
queda en el repo es el recorte con la cuenta adentro.

El audio entra decodificado por ffmpeg (mono, 22 050 Hz): así no depende de cómo lea archivos torchaudio.
"""
import json
import subprocess
import sys

import numpy as np


def pcm(ruta, hz=22050):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', ruta, '-ac', '1', '-ar', str(hz), '-f', 'f32le', '-'],
                       capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32).copy(), hz


def main():
    from beat_this.inference import Audio2Beats
    a2b = Audio2Beats(checkpoint_path='final0', device='cpu', dbn=False)
    out = {}
    for ruta in sys.argv[1:]:
        x, hz = pcm(ruta)
        golpes, unos = a2b(x, hz)
        out[ruta] = {'golpes': [round(float(t), 4) for t in golpes], 'unos': [round(float(t), 4) for t in unos]}
    json.dump(out, sys.stdout)


if __name__ == '__main__':
    main()
