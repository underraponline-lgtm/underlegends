# -*- coding: utf-8 -*-
"""LA CARTA DE PAIS DE LOS QUE TIENEN PAIS Y NO TIENEN CARTA.

    python bot/paises_nuevos.py                      el plan, sin dibujar nada
    python bot/paises_nuevos.py --generar            las que faltan
    python bot/paises_nuevos.py --generar --rehacer  TAMBIEN las que ya estan
    python bot/paises_nuevos.py --generar --limite=50

🔴 EL REQUISITO DE PAIS CAMBIO EL 19/09/2026 Y POR ESO ESTO EXISTE. Antes pedia
«1 evento nacional», que **no cumple nadie** —no hubo ninguno, arrancan en la
T2— asi que bloqueaba a las 735 personas para siempre. Dlx: *«la de paises
tiene que tener un pais asignado en el sheet... esa tarjeta calcula en base a
nacionales, por eso es tarjeta de paises»*. O sea que lo nacional es lo que la
carta MIDE, no lo que la desbloquea.

⚠️ SALEN CON LOS NUMEROS EN «—», Y ESO ES LO CORRECTO. Estas 309 personas no
tienen Score, asi que no tienen OVR Nacional ni puesto en su pais. La carta ya
sabe dibujar el hueco —lo hace desde el 16/09 para SEG, TER, DNA, DIN y los dos
trofeos— y `CLAUDE.md` lo dice: *«el agujero se ve en la carta en vez de
esconderse detras de un numero plausible»*.

⚠️ EL PAIS SALE DEL PADRON Y EL CODIGO SE CRUZA. El padron guarda «Perú» y la
carta pide «pe»; el mapa se arma cruzando el `cc` del pool con el nombre del
padron, igual que en `cartas_nuevas.py` y `bloqueadas.py`. Escribir la tabla a
mano seria la cuarta copia de lo mismo.

⚠️ ES RESUMIBLE. Salta lo que ya esta dibujado, asi que se puede cortar.
"""
import asyncio
import importlib.util
import io
import json
import os
import re
import sys
import time

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, BASE)
sys.path.insert(0, os.path.join(BASE, 'sheet'))

from comun.claves import clave as CLAVE   # noqa: E402

SALIDA = os.path.join(BASE, '04_Pais', 'salida')


def _slug(s):
    """La clave de esa persona. Vive en `comun/claves.py`, no aca.

    🔴 ESTA FUNCION ESTUVO MAL DE TRES MANERAS DISTINTAS EN UN SOLO DIA, y
    ninguna tiraba un error. Con `[^a-z0-9]`: **Ññ** y **Ржунимагу** quedaban
    en la cadena vacia y sus cartas se pisaban entre si; **Lázaro** quedaba en
    `lzaro` y se subia a una clave que el bot nunca consulta. Copiar la regla
    era el problema, asi que ahora hay una sola.
    """
    return CLAVE(s)
def mapa_cc():
    import construir_padron as PAD
    idx = {PAD.norm(x['raw']): x for x in PAD.cargar()}
    m = {}
    with io.open(os.path.join(BASE, 'datos', 'competitivo_pool.json'),
                 encoding='utf-8') as f:
        for x in json.load(f):
            pais = (idx.get(PAD.norm(x['raw'])) or {}).get('pais')
            if pais and x.get('cc'):
                m.setdefault(pais.strip(), x['cc'])
    return m


def plan(rehacer=False):
    """[persona] lista para dibujar, de los que tienen pais y no tienen carta.

    ⚠️ `rehacer` INCLUYE TAMBIEN A LOS QUE YA LA TIENEN. El filtro de «no
    tiene carta» esta en DOS lugares —aca, mirando el inventario de R2, y en
    `main()`, mirando el PNG en disco— y saltear por cualquiera de los dos
    deja las cartas viejas arriba el dia que cambia el dibujo. Hay que
    desactivar los dos o `--rehacer` no hace nada, que fue exactamente lo
    que paso al arreglar el `'rango': 'E'`: el flag estaba, el filtro de
    aca seguia y el plan daba cero.
    """
    import construir_padron as PAD
    from comun import respaldo
    with io.open(os.path.join(BASE, 'datos', 'cartas_r2.json'), encoding='utf-8') as f:
        inv = json.load(f)
    idx = PAD.por_nombre()
    cc_de = mapa_cc()
    donde = {}
    p = os.path.join(BASE, 'datos', 'servidores_de.json')
    if os.path.exists(p):
        with io.open(p, encoding='utf-8') as f:
            donde = json.load(f)

    # 🔴 QUIEN TIENE SCORE NO ES DE ESTE SCRIPT, Y CON `--rehacer` ESO PASA
    # DE SER OBVIO A SER CRITICO. Sin `--rehacer` nunca se cruzan: los del
    # pool ya tienen su carta y se saltean por eso. Con `--rehacer` entran
    # **438** en vez de 303, y las 138 del pool se redibujarian con la fila
    # sintetica de aca abajo — `rango: ''`, `ovr: None`, todas las stats en
    # «—»—, o sea que Konan perderia su SSS y su 99. Y no fallaria: saldrian
    # 138 cartas validas, vacias, y se subirian encima de las buenas.
    #
    # Las de ellos las hace `04_Pais/generar.py`, que lee los pools.
    con_score = set()
    with io.open(os.path.join(BASE, 'datos', 'competitivo_pool.json'),
                 encoding='utf-8') as f:
        for x in json.load(f):
            con_score.add(PAD.norm(x['raw']))

    out, sin_pais = [], 0
    for k in sorted(inv):
        if k in con_score:
            continue
        if 'pais' in inv[k] and not rehacer:
            continue
        per = idx.get(k) or {}
        nom = per.get('raw') or k
        cc = cc_de.get((per.get('pais') or '').strip(), '')
        if not cc:
            sin_pais += 1
            continue
        # 🔴 EL `sv` VACIO REVIENTA LA TANDA ENTERA, NO SOLO ESA CARTA.
        # `maqueta.py:1462` arma la ruta del escudo con `sv_%s.png`, asi que un
        # codigo vacio busca `sv_.png` y tira FileNotFoundError — y `exportar()`
        # trabaja de a 24, asi que la excepcion se lleva puesto todo lo que
        # venia despues: **una persona costo 58 cartas**. El unico caso es Soto,
        # que tiene cartas de servidor en R2 y ya no esta en ninguno de los dos
        # servidores: se fue despues de que se las dibujaran.
        #
        # Se cae a donde SI estuvo —la carta de servidor que ya tiene subida—
        # antes que a un default inventado.
        svs = donde.get(per.get('discord_id') or '', [])
        if not svs:
            svs = sorted(c[3:].upper() for c in inv[k] if c.startswith('sv-'))
        # ⚠️ LOS TIPOS SALEN DE `generar.cargar()`, NO DE LA INTUICION. Armarlo
        # «con ceros» reventaba dos veces seguidas y ninguno de los dos errores
        # decia lo que pasaba:
        #   `stats={}`   -> KeyError: 0     (es una TUPLA de 16, se lee por indice)
        #   `rch='0/0'`  -> str >= int      (la racha es un ENTERO, no «a/b»)
        # Los puestos son cadenas «1/33», el win trae el «%» adentro y la crew
        # vacia es None. Copiar la forma de una fila de verdad es la unica
        # manera de no ir descubriendo los campos de a uno.
        out.append({
            'nombre': nom, 'raw': nom, 'cc': cc,
            # 🔴 NI 'E' NI 0: LAS DOS AFIRMABAN UNA MEDICION QUE NO SE HIZO.
            # Acá decía `'rango': 'E', 'ovr': 0`, y esta gente **no tiene
            # Score** — por eso está acá—. `CLAUDE.md` lo dice de las dos:
            #
            #   · del rango: *«darle el bronce diría que es el peor, y no es
            #     eso — es que todavía no se sabe»*. E es bronce, el último
            #     de los ocho: 309 personas veían que el bot las llamaba las
            #     peores por no haber competido.
            #   · del número: *«poner un número igual sería inventarlo»*. Un
            #     0 dice «te medimos y diste cero»; un «—» dice «todavía no
            #     hay nada que medir».
            #
            # `04_Pais/generar.py:246` ya devolvía `None` para este mismo
            # caso. Eran dos caminos hacia la misma carta con dos respuestas
            # distintas, y el que ganaba era el que no había leído la regla.
            'rango': '', 'ovr': None, 'sv': (svs[0] if svs else ''),
            'crew': None, 'pos_pais': '', 'pos_sv': '', 'pos_rg': '',
            'evt': 0, 'pod': 0, 'sem': 0, 'cam': 0, 'win': '', 'rch': 0,
            'duelos': '', 'tro_nac': 0, 'tro_mun': 0, 'score': 0.0,
            # catorce guiones y dos ceros: EVN y EVI son los unicos dos que se
            # saben, y valen 0 porque esta gente no jugo nada todavia.
            'stats': ('—',) * 14 + (0, 0),
            'foto': respaldo.avatar(nom, ''),
        })
    return out, sin_pais


def main():
    rehacer = '--rehacer' in sys.argv
    gente, sin_pais = plan(rehacer)
    os.makedirs(SALIDA, exist_ok=True)
    # ⚠️ `--rehacer` REDIBUJA AUNQUE EL PNG ESTE. Saltear por «el archivo
    # existe» es la trampa que este repo documenta tres veces —**contar lo
    # que hay en disco no es contar lo que salió**—: el archivo viejo de
    # alguien se llama igual que el nuevo, así que el día que cambia el
    # dibujo este script dice «no queda nada» y deja las 303 cartas viejas.
    # Pasó el 21/09/2026 al arreglar el `'rango': 'E', 'ovr': 0` de acá
    # arriba: el arreglo estaba y no llegaba a ninguna carta.
    pend = [p for p in gente
            if rehacer or not os.path.exists(
                os.path.join(SALIDA, 'pais_%s.png' % _slug(p['raw'])))]
    print('\n%d con pais y sin carta   ·   %d sin pais (no se les emite)'
          % (len(gente), sin_pais))
    print('   ya dibujadas: %d   ·   faltan: %d%s'
          % (len(gente) - len(pend), len(pend),
             '   (--rehacer: se redibujan todas)' if rehacer else ''))

    if '--generar' not in sys.argv:
        print('\n  (nada dibujado — corré con --generar)\n')
        return
    lim = next((int(a.split('=')[1]) for a in sys.argv if a.startswith('--limite=')), None)
    if lim:
        pend = pend[:lim]
    if not pend:
        print('\n  no queda nada\n')
        return

    # 🔴 EL QUE SACA EL PNG TRANSPARENTE ES `exportar_png.py`, NO `generar.py`.
    # `generar.dibujar()` arma las HOJAS comparativas, que llevan fondo: las
    # 300 primeras salieron **rectangulares** y la subida las rechazó una por
    # una con «la webp perdió el alfa». El chequeo de alfa de `subir_cartas.py`
    # fue lo único que lo agarró — 300 rectángulos en Discord no dan error, se
    # ven mal y ya. `CLAUDE.md` ya distinguía los tres archivos de esta carta;
    # yo agarré el del medio.
    os.chdir(os.path.join(BASE, '04_Pais'))
    spec = importlib.util.spec_from_file_location('paisexp', 'exportar_png.py')
    E = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(E)

    t0 = time.time()
    hechos = asyncio.run(E.exportar(pend))
    malos = 0
    for nombre, arch, _ in hechos:
        r = E.revisar(os.path.join(E.G.SALIDA, arch))
        # las mismas dos trampas que el exportador de siempre: el rectangulo
        # y el vacio. Un PNG con las esquinas opacas no es una silueta.
        if r['esquinas_opacas'] > 8 or r['tinta'] < .3:
            malos += 1
            print('   ⚠️ %s: %s' % (nombre, 'rectangular'
                                    if r['esquinas_opacas'] > 8 else 'casi vacío'))
    print('\n  ✅ %d de %d   ·   %d con problemas   (%.0f min)\n'
          % (len(hechos) - malos, len(pend), malos, (time.time() - t0) / 60))


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
