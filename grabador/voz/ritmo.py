# -*- coding: utf-8 -*-
"""EL RITMO DE UN BEAT: dónde cae cada golpe, dónde empieza cada barra y en qué barra entra el MC.

    python ritmo.py <beat original.mp3|webm|wav|…> [...]     imprime lo que encontró y lo que comprobó

Dlx, 21/11/2026: *«ULAYA tiene que decir 3 2 1 dentro del beat, no en cualquier momento del beat, sino cuando la 4.ª
barra va a acabar»*. Cómo funciona eso (research de ese día):

  · un beat de rap va en 4/4: una BARRA son 4 golpes. En el boom bap el bombo cae en el 1 y el 3 y la caja en el 2 y 4
  · el MC rapea una línea por barra, y las barras van de a 4 (un «patrón»: Red Bull lo llama así). Entra en el 1
  · el beat arranca con una intro (4, 8 o 16 barras) y la batería entra completa en el 1 de un patrón: ahí entra el MC
  · el presentador cuenta en la ÚLTIMA barra antes de eso, una palabra por golpe: «¡Tres!» (1), «¡Dos!» (2),
    «¡Uno!» (3), «¡Tiempo!» (4), y el MC entra en el 1 siguiente

CÓMO SE ENCUENTRA, Y POR QUÉ ASÍ (medido sobre los seis beats de la prueba de micro, DJ Bootrax y ZkN):
  1. LOS GOLPES Y EL 1 DE CADA BARRA los da beat_this (`golpes_ia.py`), un modelo entrenado para eso. ⚠️ Mi detector
     casero no alcanzaba: en Cartas y Bukovosky tomaba el bajo que entra en el «y» del 4 (medio golpe antes) y en
     Achimega tomaba el 2 (la caja) por el 1. Y su comprobación («hay un ataque a menos de 35 ms de cada golpe») daba
     100 % igual, porque entre golpe y golpe también hay platillo: no distinguía nada. En los tres limpios (Nunca
     olvidar, 3000KM, Rest in Peace) el modelo y el bombo medido coinciden a menos de 20 ms
  2. el modelo dice que los seis ARRANCAN EN EL 1 DE LA BARRA 1: las barras se cuentan desde el primer golpe, y los
     patrones de a 4 desde ahí (las caídas medidas caen en las barras 4, 8 y 16)
  3. EN QUÉ BARRA ENTRA EL MC: el primer patrón que suena a pleno (grave + volumen a menos de `PLENO_MARGEN` del cuerpo
     del tema) y que sube al menos `SALTO_MIN` contra el anterior. ⚠️ No «el golpe con el mayor salto»: en tres de los
     seis la batería SUBE durante la barra anterior y llega completa en el 1, y el mayor salto caía en el 2
  4. LO PRECISO: una recta por los golpes del modelo alrededor de la entrada (16 antes, 32 después): el modelo marca
     cuadros de 20 ms y la recta los promedia. La cuenta va hacia atrás desde el 1 de la entrada

Sin el modelo (si falta `C:\\Users\\tonyd\\.bt`) usa la grilla casera y LO DICE: esa cuenta hay que escucharla.
Si para algún beat lo automático no es lo musical: `hacer_beat.py --entra <barra>`.
"""
import os
import subprocess
import sys

import numpy as np

HZ = 22050
CUADRO, SALTO = 1024, 256
FPS = HZ / SALTO
BPM_MIN, BPM_MAX, BPM_PREFERIDO = 65, 130, 90
PLENO_MARGEN = 8       # un patrón «a pleno» suena a menos de esto (dB de grave + volumen) del cuerpo del tema
SALTO_MIN = 6          # y entra con un salto de al menos esto contra el patrón anterior
AQUI = os.path.dirname(os.path.abspath(__file__))
PY_IA = r'C:\Users\tonyd\.bt\env\Scripts\python.exe'
PALABRAS = ['tres', 'dos', 'uno', 'tiempo']      # voz/cuenta/<palabra>.wav: la versión A, la que eligió Dlx


def pcm(ruta):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', ruta, '-ac', '1', '-ar', str(HZ), '-f', 'f32le', '-'],
                       capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32)


def espectro(x):
    n = 1 + (len(x) - CUADRO) // SALTO
    win = np.hanning(CUADRO)[None, :]
    mag = np.empty((n, CUADRO // 2 + 1), dtype=np.float32)
    for i in range(0, n, 4000):                       # de a pedazos: el tema entero no entra de una en memoria
        j = np.arange(i, min(n, i + 4000))
        idx = np.arange(CUADRO)[None, :] + SALTO * j[:, None]
        mag[i:i + len(j)] = np.abs(np.fft.rfft(x[idx] * win, axis=1))
    return mag, np.fft.rfftfreq(CUADRO, 1 / HZ)


def flujo(mag, f, lo, hi):
    """Cuánto sube la energía de esa banda de un cuadro al siguiente: los ataques."""
    b = (f >= lo) & (f < hi)
    lm = np.log1p(1000 * mag[:, b])
    d = np.maximum(0, np.diff(lm, axis=0)).sum(axis=1)
    d = d - np.convolve(d, np.ones(16) / 16, mode='same')
    return np.concatenate([[0], np.maximum(d, 0)])


def pico_cerca(env, t, rad=0.06):
    i0, i1 = max(0, int((t - rad) * FPS)), min(len(env), int((t + rad) * FPS) + 1)
    if i1 <= i0:
        return None, 0.0
    j = i0 + int(np.argmax(env[i0:i1]))
    return j / FPS, float(env[j])


def golpes_ia(ruta):
    """(golpes, unos) del modelo, o None si el entorno del modelo no está en esta PC."""
    if not os.path.exists(PY_IA):
        return None
    import json
    r = subprocess.run([PY_IA, '-X', 'utf8', os.path.join(AQUI, 'golpes_ia.py'), ruta], capture_output=True)
    if r.returncode:
        print('⚠️ el modelo no corrió:', r.stderr.decode('utf-8', 'replace').strip().splitlines()[-1:])
        return None
    d = json.loads(r.stdout.decode('utf-8'))[ruta]
    return np.array(d['golpes']), np.array(d['unos'])


def grilla_casera(todo, inicio, dur):
    """Tempo y fase sin el modelo (autocorrelación + la fase que más ataques junta). Sirve para ubicar barras."""
    a, b = int(inicio * FPS), int(min(dur, inicio + 90) * FPS)
    e = todo[a:b] - todo[a:b].mean()
    ac = np.correlate(e, e, mode='full')[len(e) - 1:]
    lags = np.arange(len(ac))
    bpm = 60 * FPS / np.maximum(lags, 1)
    peso = np.exp(-0.5 * (np.log2(np.maximum(bpm, 1) / BPM_PREFERIDO) / 0.5) ** 2)
    lag = int(np.argmax(np.where((bpm >= BPM_MIN) & (bpm <= BPM_MAX), ac * peso, -np.inf)))
    p, q, r = ac[lag - 1], ac[lag], ac[lag + 1]
    lag_f = lag + (0.5 * (p - r) / (p - 2 * q + r) if (p - 2 * q + r) else 0)
    mejor, fase = -1.0, 0.0
    for d in np.arange(0, lag_f, 0.5):
        pos = (a + d + lag_f * np.arange(int((b - a - d) / lag_f))).astype(int)
        s = todo[pos[pos < len(todo)]].sum()
        if s > mejor:
            mejor, fase = s, d
    return lag_f / FPS, (a + fase) / FPS


def recta(golpes, desde, hasta):
    """Período y fase de la recta por los golpes de ese tramo.

    ⚠️ El período NO sale de la mediana de las distancias: el modelo marca cuadros de 20 ms, así que en Rest in Peace
    (80 BPM justos, 0,750 s) las distancias alternaban 0,74 y 0,76 y la mediana daba 81,08 BPM. Un 1,3 % de error en
    48 golpes es medio golpe: cada golpe quedaba numerado mal y la recta salía con ±418 ms. Se prueba cada período y
    queda el que más golpes del modelo junta a menos de 30 ms; la recta va sólo por esos."""
    g = golpes[(golpes >= desde) & (golpes <= hasta)]
    m = float(np.median(np.diff(g)))
    mejor = (-1, m)
    for p in np.arange(0.97 * m, 1.03 * m, 0.00005):
        desv = np.abs(((g - g[0] + p / 2) % p) - p / 2)
        n = int((desv < 0.03).sum())
        if n > mejor[0]:
            mejor = (n, p)
    p = mejor[1]
    k = np.round((g - g[0]) / p)
    dentro = np.abs(g - (g[0] + k * p)) < 0.045
    per, t0 = np.polyfit(k[dentro], g[dentro], 1)
    return float(per), float(t0), [round(1000 * v, 1) for v in (g[dentro] - (t0 + k[dentro] * per))]


def ataque(x, t, rad, lo=30, hi=11000):
    """El ataque más fuerte de esa banda entre t-rad y t+rad, con un paso de 3 ms y el tiempo en el CENTRO de la
    ventana: (segundo, fuerza). ⚠️ `pico_cerca()` da el comienzo del cuadro, 23 ms antes: sirve para ubicar, no para
    medir un corrimiento."""
    n, h = 512, 64
    i0 = max(0, int((t - rad - 0.06) * HZ))
    seg = x[i0:int((t + rad + 0.06) * HZ)]
    if len(seg) < n * 2:
        return t, 0.0
    m = 1 + (len(seg) - n) // h
    idx = np.arange(n)[None, :] + h * np.arange(m)[:, None]
    f = np.fft.rfftfreq(n, 1 / HZ)
    b = (f >= lo) & (f < hi)
    lm = np.log1p(1000 * np.abs(np.fft.rfft(seg[idx] * np.hanning(n)[None, :], axis=1))[:, b])
    d = np.concatenate([[0], np.maximum(0, np.diff(lm, axis=0)).sum(axis=1)])
    ts = (i0 + h * np.arange(m) + n / 2) / HZ
    ok = (ts >= t - rad) & (ts <= t + rad)
    if not ok.any():
        return t, 0.0
    j = np.flatnonzero(ok)[int(np.argmax(d[ok]))]
    return float(ts[j]), float(d[j])


def analizar(ruta, entra_barra=None):
    x = pcm(ruta)
    mag, f = espectro(x)
    dur = len(x) / HZ
    todo = flujo(mag, f, 30, 11000)
    tot = 20 * np.log10(np.sqrt((mag ** 2).sum(axis=1)) + 1e-9)
    grave = 20 * np.log10(mag[:, (f >= 30) & (f < 150)].sum(axis=1) + 1e-9)
    inicio = float(np.argmax(tot >= tot.max() - 40) / FPS)          # dónde empieza a sonar

    ia = golpes_ia(ruta)
    if ia is not None:
        golpes, unos = ia
        per, t0, _ = recta(golpes, inicio, inicio + 120)
        # el 1: la posición en la barra que más 1 del modelo junta
        k_unos = np.round((unos[unos < inicio + 120] - t0) / per).astype(int)
        fase = int(np.bincount(k_unos % 4, minlength=4).argmax())
        detector = 'beat_this'
    else:
        print('⚠️ sin el modelo (C:\\Users\\tonyd\\.bt): grilla casera. Esta cuenta HAY QUE ESCUCHARLA antes de subirla')
        per, t0 = grilla_casera(todo, inicio, dur)
        golpes, unos, fase = None, None, 0
        detector = 'casero'
    # el 1 de la barra 0. Con el modelo, su primer 1 (⚠️ no «desde que suena»: la intro de Bukovosky es tan suave que
    # «suena» daba 2,9 s y todas las barras quedaban corridas una). Sin el modelo, el primer golpe desde que suena
    if unos is not None:
        k0 = int(round((unos[0] - t0) / per))
    else:
        k0 = int(np.ceil((inicio - 0.08 - t0) / per))
        k0 += (fase - k0) % 4
    primero = t0 + k0 * per
    golpe = lambda k: primero + k * per
    barra = 4 * per

    # el nivel de cada barra (grave + volumen) y de cada patrón de 4
    fr = lambda t: min(len(tot) - 1, max(0, int(t * FPS)))
    nb = int((dur - primero) / barra)
    L = np.array([grave[fr(golpe(4 * i)):fr(golpe(4 * i + 4))].mean() + tot[fr(golpe(4 * i)):fr(golpe(4 * i + 4))].mean()
                  for i in range(nb)])
    M = lambda i: float(L[i:i + 4].mean())
    cuerpo = [M(i) for i in range(0, nb - 4, 4) if 25 <= golpe(4 * i) <= 120] or [M(i) for i in range(0, nb - 4, 4)]
    pleno = float(np.median(cuerpo))
    if entra_barra is None:
        candidatos = [i for i in range(4, nb - 8, 4) if golpe(4 * i) <= 90]
        entra_barra = next((i for i in candidatos if M(i) >= pleno - PLENO_MARGEN and M(i) - M(i - 4) >= SALTO_MIN), None)
        if entra_barra is None:
            entra_barra = next((i for i in candidatos if M(i) >= pleno - PLENO_MARGEN), 4)
    t_aprox = golpe(4 * entra_barra)

    # lo preciso: la recta por los golpes del modelo alrededor de la entrada
    res, de_ia = [], None
    if golpes is not None:
        per, t0l, res = recta(golpes, t_aprox - 16.5 * per, t_aprox + 32.5 * per)
        t_entra = t0l + round((t_aprox - t0l) / per) * per
        de_ia = round(1000 * float(unos[np.argmin(abs(unos - t_entra))] - t_entra))   # el 1 del modelo más cercano
    else:
        t_entra = t_aprox
    # ⚠️ EL MODELO MARCA EL GOLPE 10-30 ms DESPUÉS DEL ATAQUE REAL (medido el 21/11 en los seis, siempre tarde), y lo
    # que el oído toma como golpe es el ataque. Se mide el ataque de los 32 golpes desde la entrada (los de la batería,
    # que son claros) y, si el corrimiento es parejo, la grilla se corre eso
    offs = np.array([ataque(x, t_entra + j * per, 0.05)[0] - (t_entra + j * per) for j in range(32)])
    corr = float(np.median(offs))
    parejo = float(np.median(np.abs(offs - corr)))
    corrido = 0.0
    if parejo < 0.02 and abs(corr) < 0.045:
        corrido = corr
        t_entra += corr
    # y la comprobación: el ataque real más cercano a cada golpe de la cuenta y a la entrada, ya corrida
    ataques = [round(1000 * (ataque(x, t_entra - j * per, 0.05)[0] - (t_entra - j * per))) for j in (4, 3, 2, 1, 0)]
    return {'detector': detector, 'bpm': 60 / per, 'periodo': per, 'primero': primero, 'entra': int(entra_barra),
            't_entra': float(t_entra), 'residuos_ms': res, 'uno_del_modelo_ms': de_ia, 'ataques_ms': ataques,
            'corrido_ms': round(1000 * corrido), 'parejo_ms': round(1000 * parejo),
            'patrones': [round(M(i) - pleno, 1) for i in range(0, min(nb - 4, 40), 4)], 'dur': dur}


def pcentro(wav):
    """El «centro de percepción» de una palabra: donde su volumen llega a la mitad del máximo (s desde el principio).
    Es el punto que se pone sobre el golpe: el oído ubica una palabra por su vocal, no por la primera consonante."""
    x = pcm(wav)
    v = np.sqrt(np.convolve(x.astype(np.float64) ** 2, np.ones(220) / 220, mode='same'))     # 10 ms
    return float(np.argmax(v >= 0.5 * v.max()) / HZ)


if __name__ == '__main__':
    for r in sys.argv[1:]:
        m = analizar(r)
        print('%-18s [%s] %6.2f BPM · entra el MC en la barra %d: %.3f s · golpes del modelo contra la recta: ±%.0f ms'
              ' · el 1 del modelo a %s ms · corrida al ataque %+d ms (parejo ±%d) · ataque real en la cuenta y la'
              ' entrada: %s ms · patrones contra el cuerpo: %s'
              % (os.path.basename(r)[:18], m['detector'], m['bpm'], m['entra'], m['t_entra'],
                 max(map(abs, m['residuos_ms'])) if m['residuos_ms'] else -1, m['uno_del_modelo_ms'],
                 m['corrido_ms'], m['parejo_ms'], ' '.join('%+d' % v for v in m['ataques_ms']),
                 ' '.join('%+.0f' % v for v in m['patrones'])))
