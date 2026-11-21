# -*- coding: utf-8 -*-
"""LA VOZ DE ULAYA PARA LA PRUEBA DE MICRO: las frases de `frases.json` -> un .ogg por clave, listo para Discord.

    python hacer_voz.py --piper <python con piper-tts> --modelo <es_AR-daniela-high.onnx>
    python hacer_voz.py --piper ... --modelo ... --solo hola      una sola frase

Dlx, 21/11/2026: la prueba de micro le habla a quien entra (*«que el bot te diga en voz qué tienes que hacer»*), con
Piper (*«gratis y natural»*) y voz de mujer: **es_AR-daniela-high** (rhasspy/piper-voices, corpus de openslr.org/61,
CC BY-SA 4.0 — pide citarla, por eso va en `frases.json` y acá).

⚠️ PIPER Y LA VOZ NO VIVEN EN EL REPO, sólo lo que generan: el programa (GPL) y el modelo (114 MB) se bajan aparte, en
una carpeta fuera del proyecto. Las frases ya hechas son ~30 KB cada una y son lo único que necesita Railway: el
grabador no habla en el momento, reproduce estos archivos.

⚠️ EL FORMATO ES EL QUE DISCORD RECIBE SIN VOLVER A CODIFICAR: Ogg Opus, 48 kHz, estéreo, cuadros de 20 ms. Así
`@discordjs/voice` los manda tal cual (`StreamType.OggOpus`) y no hace falta instalar ningún codificador de Opus en
Railway. A −16 LUFS, con 0,3 s de aire al principio: el primer paquete que manda un bot a veces se pierde.

La cuenta («Tres. Dos. Uno. ¡Tiempo!») no es una frase: cada palabra va en su segundo (`cuenta()`).
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))


def a_ogg(entrada_args, salida):
    """Lo que entre (un wav o un filtro de ffmpeg) -> Ogg Opus como lo pide Discord."""
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *entrada_args,
                    '-af', 'adelay=300|300,loudnorm=I=-16:TP=-1.5:LRA=7,aresample=48000',
                    '-ac', '2', '-c:a', 'libopus', '-b:a', '64k', '-frame_duration', '20', salida], check=True)


#: 🥊 LA CUENTA DE BATALLA (Dlx, 21/11/2026: «el bot tendría que decir 3 2 1 como una batalla real para dar la cuenta
#: regresiva»). Cada palabra se dice por separado y se pone en su segundo: dicha de corrido, Piper la apura y no suena
#: a cuenta. Un poco más rápida (`length_scale` 0,85) y «¡Tiempo!» al final; el beat entra apenas termina.
CUENTA = [('Tres.', 0.0), ('Dos.', 0.9), ('Uno.', 1.8), ('¡Tiempo!', 2.7)]


def cuenta(a):
    with tempfile.TemporaryDirectory() as tmp:
        ins, filtros = [], []
        for i, (palabra, seg) in enumerate(CUENTA):
            wav = os.path.join(tmp, 'c%d.wav' % i)
            subprocess.run([a.piper, '-m', 'piper', '-m', a.modelo, '--length-scale', '0.85', '-f', wav, '--', palabra],
                           check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            ins += ['-i', wav]
            ms = int(seg * 1000)
            # sin el silencio que Piper deja antes y después de cada palabra, así cae justo en su segundo
            filtros.append('[%d:a]silenceremove=start_periods=1:start_threshold=-45dB,areverse,'
                           'silenceremove=start_periods=1:start_threshold=-45dB,areverse,adelay=%d|%d[c%d]' % (i, ms, ms, i))
        mezcla = os.path.join(tmp, 'cuenta.wav')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', *ins, '-filter_complex',
                        ';'.join(filtros) + ';' + ''.join('[c%d]' % i for i in range(len(CUENTA)))
                        + 'amix=inputs=%d:normalize=0:duration=longest' % len(CUENTA), mezcla], check=True)
        a_ogg(['-i', mezcla], os.path.join(AQUI, 'cuenta.ogg'))
    print('  ✅ cuenta     %5.1f KB' % (os.path.getsize(os.path.join(AQUI, 'cuenta.ogg')) / 1e3))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--piper', required=True, help='el python que tiene piper-tts instalado')
    ap.add_argument('--modelo', required=True, help='es_AR-daniela-high.onnx (con su .onnx.json al lado)')
    ap.add_argument('--solo', help='una sola clave')
    a = ap.parse_args()
    frases = {k: v for k, v in json.load(open(os.path.join(AQUI, 'frases.json'), encoding='utf-8')).items()
              if not k.startswith('_') and (not a.solo or k == a.solo)}
    with tempfile.TemporaryDirectory() as tmp:
        for clave, texto in frases.items():
            wav = os.path.join(tmp, clave + '.wav')
            subprocess.run([a.piper, '-m', 'piper', '-m', a.modelo, '-f', wav, '--', texto], check=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            a_ogg(['-i', wav], os.path.join(AQUI, clave + '.ogg'))
            print('  ✅ %-9s %5.1f KB' % (clave, os.path.getsize(os.path.join(AQUI, clave + '.ogg')) / 1e3))
    if not a.solo or a.solo == 'cuenta':
        cuenta(a)
    return 0


if __name__ == '__main__':
    sys.exit(main())
