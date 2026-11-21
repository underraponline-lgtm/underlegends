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

El pitido no es una frase: lo arma ffmpeg (880 Hz, 0,25 s).
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
    if not a.solo or a.solo == 'pitido':
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=880:duration=0.25:sample_rate=48000',
                        '-af', 'afade=t=in:d=0.02,afade=t=out:st=0.2:d=0.05,volume=-6dB', '-ac', '2', '-c:a', 'libopus',
                        '-b:a', '64k', '-frame_duration', '20', os.path.join(AQUI, 'pitido.ogg')], check=True)
        print('  ✅ pitido')
    return 0


if __name__ == '__main__':
    sys.exit(main())
