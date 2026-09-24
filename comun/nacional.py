# -*- coding: utf-8 -*-
"""EL OVR NACIONAL — la media geometrica entre tu Score y el de tu pais.

    from comun.nacional import ovr_nacional, tabla
    tabla(competitivo_pool, mundial)   -> {'Konan': 99, 'Am': 70, ...}

    python comun/nacional.py           el self-check

POR QUE VIVE ACA
----------------
Estaba en `04_Pais/generar.py`, que era su unico usuario. Desde el 20/09/2026
lo necesita tambien `bot/subir_datos.py`, para mandarle a KV el numero que el
`/versus` compara — y ahi hay exactamente dos caminos:

    copiar la formula        -> dos implementaciones que un dia se separan
    importar 04_Pais/generar -> arrastra `maqueta` entero, que dibuja cartas

El primero es la forma que mas veces rompio este proyecto. El segundo hace que
subir datos a KV dependa del modulo que arma HTML. Asi que sale de los dos y
vive donde ya viven las demas definiciones compartidas.

⚠️ **EL NUMERO DE LA CARTA Y EL DEL VERSUS TIENEN QUE SER EL MISMO.** Es la
razon entera de este archivo. Si el bot dijera «Konan 99» y la carta dibujara
otra cosa, el que mira las dos cosas juntas no sabria cual creer — y ninguna
de las dos fallaria.

LA FORMULA (N3 de docs/pais_hallazgos.md)
-----------------------------------------
    g = raiz(Score x ScoreSeleccion)
    OVR = PISO + raiz( g / raiz(mejorScore x mejorSeleccion) ) x ALTO

⚠️ **LOS DOS MAXIMOS SALEN DEL POOL, ASI QUE SE MUEVEN.** Es lo que
`docs/t1_que_se_mueve.md` llama «se recalibra solo», con su trampa: si entra
alguien que rompe el record, **todos los demas bajan sin haber hecho nada**.
Por eso `tabla()` los calcula de una sola pasada sobre el pool que le pasan, y
no los recibe por separado: dos llamadas con maximos distintos darian dos OVR
distintos para la misma persona.

⚠️ **SIN `score_seleccion` NO HAY OVR, Y ESO ES `None`, NO CERO.** Un cero se
dibuja y se compara; un `None` hace que la carta ponga «—» y que el versus
diga que no se puede. Es «sin dato no hay pieza» aplicado a un numero.
"""
import io
import json
import math
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)

# El piso y el alto del rango en que cae el OVR Nacional: da entre 40 y 99.
PISO, ALTO = 40, 59


def ovr_nacional(score, score_pais, mejor_score, mejor_pais):
    """El OVR Nacional de una persona, redondeado. `None` si no se puede.

    🔴 SIN UN MEJOR CONTRA QUIEN NORMALIZAR NO HAY NUMERO, y esto tiraba
    `ZeroDivisionError`. El OVR Nacional es la media geometrica entre tu
    Score y el de tu seleccion, dividida por la media de los dos mejores:
    con el pool competitivo en **0** —el estado de una temporada recien
    arrancada— `mejor_score` es 0 y la division revienta.

    Medido el 22/09/2026: el generador de Pais moria acá en cuanto entro
    la primera persona al pool de temporada sin estar en el competitivo.

    ⚠️ DEVOLVER `None` NO ES UN PARCHE: es la respuesta. El docstring de
    este archivo ya lo dice —*«un `None` hace que la carta ponga “—” y
    que el versus diga que no se puede»*—. Quien no tiene Score no tiene
    OVR Nacional, igual que SEG, TER, DNA y DIN. Un 40 —el piso— seria
    inventar un dato y ponerlo al lado de los de verdad.
    """
    try:
        if not (score and score_pais and mejor_score and mejor_pais):
            return None
        g = math.sqrt(score * score_pais)
        return round(PISO
                     + math.sqrt(g / math.sqrt(mejor_score * mejor_pais)) * ALTO)
    except (TypeError, ValueError, ZeroDivisionError):
        return None


def seleccion(mundial):
    """{codigo de pais -> Score Seleccion}, de `datos/mundial.json`."""
    return {k: v.get('score_seleccion')
            for k, v in (mundial.get('competitivos') or {}).items()}


def tabla(comp, mundial):
    """{nombre -> OVR Nacional o None} para todo el pool competitivo.

    ⚠️ DE UNA SOLA PASADA, con los maximos del pool que se le pasa. Ver el
    encabezado: pedirle los maximos por separado seria dejar que dos llamadas
    contesten distinto para la misma persona.
    """
    sel = seleccion(mundial)
    if not comp or not sel:
        return {}
    mejor_score = max(x['score'] for x in comp)
    mejor_pais = max(v for v in sel.values() if v)
    out = {}
    for c in comp:
        sp = sel.get(c.get('cc'))
        out[c['raw']] = (ovr_nacional(c['score'], sp, mejor_score, mejor_pais)
                         if sp else None)
    return out


def _j(nombre):
    with io.open(os.path.join(BASE, 'datos', nombre), encoding='utf-8') as f:
        return json.load(f)


def _self_check():
    print('EL OVR NACIONAL\n')
    comp = _j('competitivo_pool.json')
    t = tabla(comp, _j('mundial.json'))
    con = {k: v for k, v in t.items() if v is not None}
    print('  del pool de %d, con OVR Nacional: %d' % (len(comp), len(con)))
    if not con:
        # 🔴 SIN POOL ESTE CHEQUEO NO PUEDE CONTESTAR, Y SALIA EN VERDE.
        # Volvia `None` y quien lo llamaba lo leia como «todo bien»:
        # `herramientas/chequeo_que_no_chequea.py` lo marco como ciego
        # el 22/09, justo despues del reset —le rompio `PISO` y el
        # chequeo no se entero, porque no tenia ni una fila que medir—.
        #
        # ⚠️ Decirlo NO es lo mismo que fallar. El pool vacio es lo
        # correcto entre el reset y el primer evento de la T1, asi que
        # esto avisa y devuelve 0: lo que no puede hacer es afirmar que
        # comprobo algo.
        # la marca la lee `herramientas/chequeo_que_no_chequea.py`
        print('\n  ⚠️ SIN DATOS PARA MEDIR: el pool está vacío, no hay a '
              'quién\n     medirle el OVR Nacional. No es un fallo.')
        return 0
    top = sorted(con.items(), key=lambda x: -x[1])[:5]
    print('  los cinco mas altos: %s'
          % ', '.join('%s %d' % (k, v) for k, v in top))
    print('  el mas bajo: %s' % min(con.items(), key=lambda x: x[1])[0])
    print('  rango: %d a %d   (el techo teorico es %d)'
          % (min(con.values()), max(con.values()), PISO + ALTO))

    # ⚠️ LO QUE DE VERDAD IMPORTA: que de lo mismo que la carta. `CLAUDE.md`
    # dice «Da un solo 99 (Konan), Am pasa de 99 a 70». Si algun dia esto se
    # separa de 04_Pais, se separa acá y no en produccion.
    unos = [k for k, v in con.items() if v == 99]
    print('\n  con 99: %d  (%s)' % (len(unos), ', '.join(unos) or '—'))
    print('  Am: %s   (CLAUDE.md dice 70)' % con.get('Am', '—'))
    mal = [k for k, v in con.items() if not (PISO <= v <= PISO + ALTO)]
    print('\n  %s' % ('todo bien' if not mal
                      else 'FUERA DE RANGO: %s' % ', '.join(mal[:6])))


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    _self_check()
