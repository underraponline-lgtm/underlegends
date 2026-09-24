"""A qué crew pertenece cada uno — un solo lugar para las cuatro cartas.

    from comun.crews import DE_CADA_UNO, puestos, norm
    DE_CADA_UNO[norm('Bloody')]        -> 'Follombia'
    puestos(pool)[norm('Bloody')]      -> ('Follombia', 2, 7)

POR QUE VIVE ACA
----------------
⚠️ **Estaba escrito CUATRO veces, y dos de esas cuatro estaban viejas.** El
mismo diccionario de 13 personas aparecía en `sheet/construir_pool_competitivo.py`
y en `02_Competitivo/v2/gencomp.py`, mientras `datos/crews.json` —que Dlx pasó
el **20/08/2026**— tiene **48 personas y 16 crews**. Las otras dos copias
(`04_Pais/generar.py` y `03_Servidor/disenos/todos_sv.py`) sí leían el JSON,
así que **la misma persona tenía una crew en una carta y otra en otra**.

Medido contra el pool de 138, con el dict viejo:

| | |
|---|---|
| con crew en el JSON y sin rombo en la Competitiva | **24** |
| con la crew EQUIVOCADA | **2** — Juanpa y Kyss, que figuraban en Follombia |
| con una crew que el JSON ya no les da | 5 |

Es exactamente lo que `CLAUDE.md` dice del escudo del servidor: *«si esto se
vuelve a duplicar, el próximo va a romper sólo algunas cartas y va a costar
encontrarlo de nuevo»*. Acá no rompió nada — dibujó otra cosa, en silencio.

⚠️ **NO TODAS LAS CREWS TIENEN LOGO.** Hay dos en `comun/logos_crew/`
—Follombia y KS— y dieciséis en el JSON. Quien no tiene logo no lleva pieza, y
eso es la regla de siempre: *sin dato no hay pieza*. Esto **no** es un motivo
para volver al dict viejo: el dict viejo tampoco los dibujaba, sólo que además
mentía sobre dos.

⚠️ **EL UMBRAL DE 3 RIGE IGUAL QUE EN PAÍS Y SERVIDOR.** Ser «1 de 1» no dice
nada. Medido sobre el pool de 138, sólo **4 de 16** crews llegan a tres
miembros con carta, así que la mayoría lleva el logo sin número — igual que la
bandera de quien es el único de su país.

⚠️ **ALIAS.** `datos/crews.json` avisa: alguien que figura «fuera del pool»
puede ser un ALIAS y no una ausencia. La hoja AKAs del Operativo resuelve
`kibak -> valen`, y este cruce NO los resuelve. Antes de dar por ausente a
alguien, pasarlo por AKAs.
"""
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
RUTA = os.path.join(BASE, 'datos', 'crews.json')

# el umbral de 3, el mismo de pais, servidor y crew
MIN_GRUPO = 3


sys.path.insert(0, BASE)
from comun.claves import clave as norm      # noqa: E402,F401

# 🔴 ACA HABIA UNA COPIA, Y ERA LA CUARTA. El nombre sin banderas ni acentos se
# calculaba con `[^a-z0-9]`, que **borra** el alfabeto que no es latino en vez
# de conservarlo. Medido sobre los 870 nombres reales del padron y los dos
# pools: **Ржунимагу** quedaba en la cadena vacia y **TøKīØ🦠🧠** en `tki`. La
# clave vacia es la peor, porque no falla: se fusiona con cualquier otro vacio,
# y es exactamente lo que metio cuatro cartas en dos archivos.
#
# Hoy no colisiona nadie **porque hay un solo nombre que cae en vacio**. Con
# dos, colisionan. El padron crecio de 486 a 499 esta semana.
#
# ⚠️ EL FALLBACK CAMBIA DE `''` A `'sinnombre'` Y ESO ES SEGURO ACA: los tres
# lugares que llaman a `norm()` ya descartan la fila en blanco antes, con
# `if not r[0].strip(): continue`. Nada mira si el resultado es vacio.


def _cargar():
    if not os.path.exists(RUTA):
        return {}, {}
    with open(RUTA, encoding='utf-8') as f:
        d = json.load(f)['crews']
    de_cada = {}
    for crew, miembros in d.items():
        for m in miembros:
            de_cada[norm(m)] = crew
    return d, de_cada


CREWS, DE_CADA_UNO = _cargar()


def puestos(pool, clave='raw', score='score'):
    """{nombre normalizado: (crew, puesto, total)} por Score.

    ⚠️ **Sólo cuentan los que TIENEN carta.** Un puesto contra gente que no
    está en el pool no se puede explicar dentro de la carta. Y con menos de
    `MIN_GRUPO` el puesto va en 0, que es como se dibuja «sin número».
    """
    por = {}
    for x in pool:
        cr = DE_CADA_UNO.get(norm(x[clave]))
        if cr:
            por.setdefault(cr, []).append(x)
    out = {}
    for cr, v in por.items():
        v = sorted(v, key=lambda x: -float(x.get(score) or 0))
        for i, x in enumerate(v, 1):
            out[norm(x[clave])] = (cr, i if len(v) >= MIN_GRUPO else 0, len(v))
    return out


def _self_check():
    print('LAS CREWS\n')
    print('  crews en %s: %d' % (os.path.relpath(RUTA, BASE), len(CREWS)))
    print('  personas listadas: %d' % len(DE_CADA_UNO))
    p = os.path.join(BASE, 'datos', 'competitivo_pool.json')
    if not os.path.exists(p):
        return
    with open(p, encoding='utf-8') as f:
        pool = json.load(f)
    pu = puestos(pool)
    print('  del pool de %d, con crew: %d' % (len(pool), len(pu)))
    grandes = sorted({(c, t) for c, _, t in pu.values() if t >= MIN_GRUPO},
                     key=lambda x: -x[1])
    print('  crews que llegan a %d con carta: %d  (%s)'
          % (MIN_GRUPO, len(grandes),
             ', '.join('%s %d' % g for g in grandes) or '—'))
    logos = os.path.join(BASE, 'logos_crew') if False else \
        os.path.join(SCR, 'logos_crew')
    hay = {os.path.splitext(f)[0] for f in os.listdir(logos)} \
        if os.path.isdir(logos) else set()
    sin = sorted({c for c, _, _ in pu.values()} - hay)
    print('  con logo: %s' % (', '.join(sorted(hay)) or '—'))
    print('  sin logo (no llevan pieza): %d  (%s)' % (len(sin), ', '.join(sin)))

    # 🔴 Y ACA SE VERIFICA, QUE HASTA HOY NO PASABA. Todo lo de arriba
    # **reporta**: cuenta y lista, pero nunca afirma nada. Vaciando
    # `CREWS` entero seguia en verde. Lo detecto
    # `herramientas/chequeo_que_no_chequea.py`.
    #
    # Se guardan las dos formas en que esto ya se rompio o se puede
    # romper, las dos **sin dar error**:
    mal = 0

    # 1 · un nombre de crew mal escrito en la lista de personas deja a
    #     esa persona en una crew que no existe: se queda sin puesto y
    #     sin logo, y nadie se entera.
    huerfanas = sorted({c for c in DE_CADA_UNO.values() if c not in CREWS})
    if huerfanas:
        print('\n  🔴 %d persona(s) apuntan a una crew que no está en CREWS: %s'
              % (sum(1 for c in DE_CADA_UNO.values() if c in huerfanas),
                 ', '.join(huerfanas)))
        mal += 1

    # 2 · LA IDENTIDAD Y EL NUMERO TIENEN QUE SALIR DEL MISMO LADO. Es la
    #     regla escrita en `CLAUDE.md`, y su caso fue Bloody: figuraba
    #     **5/9** cuando con la lista de Dlx es **2/9**, porque la crew
    #     venia de un lado y el puesto de otro. Si `puestos()` le da un
    #     total que no es el tamaño de su crew, volvio a pasar.
    raros = []
    for _q, (crew, puesto, total) in pu.items():
        real = len(CREWS.get(crew) or ())
        if total > real:
            raros.append((crew, total, real))
    if raros:
        print('  🔴 %d crew(s) con un total mayor que su lista:' % len(raros))
        for c, t, r in raros[:5]:
            print('     %-14s puestos dice /%d y CREWS tiene %d' % (c, t, r))
        mal += 1

    # 3 · si hay crews cargadas, alguien del pool tiene que tener puesto.
    #     Cero con `CREWS` lleno es que el cruce de nombres dejo de
    #     funcionar — y el circulo de crew desaparece de las 138 cartas.
    # ⚠️ PERO CON EL POOL VACIO ESTO NO PUEDE CONTESTAR, y decia que si.
    # Despues del reset del 22/09 nadie recibe puesto porque **no hay
    # nadie**, y el chequeo lo leia como «el cruce de nombres se
    # rompió»: una alarma roja todas las semanas por el estado correcto
    # del sistema. `SIN DATOS PARA MEDIR` es la marca que lee
    # `herramientas/chequeo_que_no_chequea.py`.
    if not pool:
        print('  ⚠️ SIN DATOS PARA MEDIR: el pool está vacío, así que no '
              'puedo\n     comprobar el cruce con las crews. No es un fallo.')
    elif CREWS and not pu:
        print('  🔴 hay %d crews cargadas y NADIE del pool recibe puesto: '
              'el cruce de nombres se rompió' % len(CREWS))
        mal += 1

    if not mal:
        print('\n  ✅ los nombres cierran, los totales coinciden con las '
              'listas\n     y el cruce con el pool da %d' % len(pu))
    return mal


if __name__ == '__main__':
    import sys
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    # el codigo de salida tiene que reflejarlo: un chequeo que avisa
    # por pantalla y sale con 0 es invisible para cualquier script
    sys.exit(1 if _self_check() else 0)
