"""LAS CARTAS DE SERVIDOR DE LAS 138, EN LOS NUEVE SERVIDORES.

    python bot/tanda_servidores.py              todo lo que falte
    python bot/tanda_servidores.py DRA TWR      solo esos
    python bot/tanda_servidores.py --listar      que hay y que falta

Cada persona necesita una carta POR servidor, no una sola: `/card` abre en la
carta **del servidor donde escribiste**, y eso vale aunque no sea el tuyo.

    <quien>/servidor.png     la propia   (prefijo `sv`)
    <quien>/sv-<codigo>.png  la de X     (prefijo `sv-x`)

⚠️ **SE BORRA LA TANDA DESPUES DE SUBIRLA.** Son 138 x 1.6 MB por servidor,
o sea ~2 GB si se dejan las nueve en `03_Servidor/salida/`. R2 es la copia
que importa; el disco local es un intermedio.

⚠️ **LA PROPIA VA PRIMERO Y NO ES OPCIONAL.** Las 138 que ya estan en R2 se
generaron antes de dos arreglos: la bandera que desaparecia con menos de tres
personas en tu servidor, y la caja de recorte comun. Sin rehacerlas, cambiar
de servidor en el menu hace que la carta cambie de TAMAÑO en el chat.

⚠️ **AL FINAL SE ESCRIBE SOLO `meta`, NO LAS 138.** KV da 1.000 escrituras por
dia y una corrida completa de `subir_datos.py` son 240. Lo unico que cambia
despues de subir cartas es que servidores estan listos.
"""
import io
import json
import os
import subprocess
import sys
import time

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
SALIDA = os.path.join(BASE, '03_Servidor', 'salida')

# ⚠️ EL ORDEN NO ES ALFABETICO Y ES A PROPOSITO: primero la propia —que
# arregla las 138 que ya estan arriba—, despues los dos servidores donde el
# bot VIVE (DRA y FFA), que son los unicos donde hoy puede funcionar «la carta
# del servidor donde escribiste». El resto solo se alcanza por el menu.
ORDEN = ['', 'DRA', 'FFA', 'TFC', 'TWR', 'SR', 'FTN', 'FRZ', 'URBF', 'EFA']


def listas():
    p = os.path.join(BASE, 'datos', 'cartas_r2.json')
    if not os.path.exists(p):
        return {}
    with io.open(p, encoding='utf-8') as f:
        return json.load(f)


def cuantas(mapa, clave):
    return sum(1 for cs in mapa.values() if clave in cs)


def del_pool(sv=''):
    """A cuanta gente hay que dibujarle la carta de Servidor HOY.

    ⚠️ NO UN 138 ESCRITO A MANO. Ese numero es de la pre-temporada y
    `CLAUDE.md` avisa que no describe la T1: el Sheet arranca de cero y el
    pool va a crecer. Un techo escrito se convierte en un chequeo que pasa
    siempre -o que falla siempre- el dia que el pool cambie de tamanio.

    🔴 Y TAMPOCO ES EL LARGO DEL POOL, que es lo que decia hasta el
    22/09. La Servidor **no tiene requisito** —se le emite a todo el
    que pueda tener carta—, asi que el pool es una cota de otra cosa.
    Medido el dia del reset: con el pool en 0 este modulo imprimio
    *«el pool son 0»* y marco los nueve servidores con ✅, dando por
    hecho que no faltaba nada mientras R2 tenia 1.706 cartas de la
    pre-temporada listas para servirse.

    Es la forma que este repo ya documenta tres veces —contar lo que
    hay en disco no es contar lo que salio— con el contador mirando un
    tercer lugar que no era ninguno de los dos.

    Ahora sale de `03_Servidor/generar.cargar()`, que es exactamente la
    lista que el generador va a dibujar: los del pool mas los que pasan
    el porton de identidad y todavia no compitieron.
    """
    sys.path.insert(0, os.path.join(BASE, '03_Servidor'))
    sys.path.insert(0, os.path.join(BASE, '03_Servidor', 'disenos'))
    import generar as GEN
    gente = GEN.cargar()
    if not sv:
        return len(gente)
    # ⚠️ Y POR SERVIDOR SON MENOS, porque solo se dibuja a quien ESTA
    # ahi: la carta de TWR de alguien que no esta en TWR no se la puede
    # pedir nadie. Medido: la matriz entera son 2.808 y las
    # alcanzables 510.
    code = sv.upper()
    return sum(1 for p in gente
               if code in [s.upper() for s in (p.get('svs') or [])])


def corre(args):
    print('   $ ' + ' '.join(args))
    r = subprocess.run([sys.executable] + args, cwd=BASE)
    if r.returncode:
        raise SystemExit('fallo: %s' % ' '.join(args))


def una(sv):
    """Genera, sube y borra la tanda de un servidor. '' = la propia."""
    prefijo = 'sv' if not sv else 'sv-%s' % sv.lower()
    t0 = time.time()
    print('\n=== %s ===' % (sv or 'LA PROPIA'))
    gen = ['03_Servidor/generar.py', '--todas']
    if sv:
        gen.append('--sv=%s' % sv)
    # ⚠️ EL CORTE SE TOMA ANTES DE GENERAR. Ver el filtro de abajo.
    # 2 s de margen entre `time.time()` y el mtime del sistema de archivos.
    t_corte = time.time() - 2
    corre(gen)

    # ⚠️ Se listan los archivos en Python y no con un comodin del shell: en
    # Windows el shell no expande `*`, y pasar 138 rutas sueltas es lo que ya
    # partio "Lord Viruzz" en dos argumentos una vez.
    #
    # 🔴 Y SE LISTA LO DE ESTA CORRIDA, NO LO QUE HAY EN LA CARPETA. El
    # 20/09/2026 habia 379 `sv-dra_*.png` ahi: 144 recien dibujados y 235 del
    # 19/09 de gente que no esta en el pool. Los 379 se subian, y el chequeo
    # de abajo —«al menos 138»— daba por bueno cualquier faltante porque las
    # sobras tapaban el hueco. Es la misma forma que `bot/generar_todas.py`
    # tenia en el conteo y `bot/subir_cartas.py` en las claves repetidas: el
    # nombre del archivo no distingue la carta de hoy de la de anteayer, y el
    # mtime si.
    todos = sorted(f for f in os.listdir(SALIDA)
                   if f.startswith(prefijo + '_') and f.endswith('.png')
                   # 'sv_' no debe tragarse 'sv-ffa_'
                   and (sv or not f.startswith('sv-')))
    hechos = [f for f in todos
              if os.path.getmtime(os.path.join(SALIDA, f)) >= t_corte]
    if len(todos) != len(hechos):
        print('   (%d archivo(s) viejos en la carpeta, no se suben)'
              % (len(todos) - len(hechos)))
    tope = del_pool(sv)
    if len(hechos) != tope:
        raise SystemExit('salieron %d de %d en %s'
                         % (len(hechos), tope, sv or 'propia'))
    # ⚠️ EN TANDAS: LA LINEA DE COMANDOS TIENE TECHO. Windows corta en
    # 32.768 caracteres y cada ruta absoluta mide ~86, o sea que arriba
    # de unas 380 el comando revienta con un error del sistema operativo
    # que no dice nada util.
    #
    # Con 138 entra —12 KB— asi que hoy no falla. Pero el padron tiene
    # **875** y el pool de la T1 sale de ahi: el dia que pase de 380
    # esto se cae, y se caeria justo en la corrida grande. Un limite que
    # se alcanza de a poco no avisa cuando se cruza.
    rutas = [os.path.join(SALIDA, f) for f in hechos]
    POR_TANDA = 200
    for i in range(0, len(rutas), POR_TANDA):
        corre(['bot/subir_cartas.py'] + rutas[i:i + POR_TANDA])

    # ⚠️ SE BORRA TODO EL PREFIJO, no solo lo que se subio. La carpeta
    # es un intermedio -R2 es la copia que importa- y dejar las sobras las
    # hace crecer corrida a corrida, que es como llegaron a ser 235.
    for f in todos:
        try:
            os.remove(os.path.join(SALIDA, f))
        except OSError:
            pass

    # ⚠️ SE ENCIENDE DESPUES DE CADA SERVIDOR, NO AL FINAL DE LOS NUEVE.
    # Antes `meta` se escribia una sola vez al terminar todo, y eso hacia que
    # una corrida interrumpida —la maquina se duerme, se corta la luz— dejara
    # arriba en R2 tres servidores completos que el bot seguia sin ofrecer.
    # El trabajo estaba hecho y una sola clave sin escribir lo tapaba.
    #
    # Cuesta una escritura de KV por servidor: nueve en vez de una, sobre
    # 1.000 por dia. `servidores_listos()` sigue siendo una interseccion, asi
    # que un servidor a medias no se enciende igual.
    corre(['bot/subir_datos.py', '--solo-meta'])
    print('   %s listo en %.1f min' % (sv or 'la propia', (time.time() - t0) / 60))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('-')]
    mapa = listas()

    if '--listar' in sys.argv:
        tope = del_pool()
        print('QUE HAY EN R2 (el pool son %d)\n' % tope)
        for sv in ORDEN:
            clave = 'servidor' if not sv else 'sv-%s' % sv.lower()
            n = cuantas(mapa, clave)
            # ⚠️ EL TECHO ES POR SERVIDOR: solo se le dibuja a quien
            # ESTA ahi. Comparar los nueve contra los 312 marcaba
            # «faltan 174» en siete servidores donde no hay nadie.
            tope = del_pool(sv)
            if not tope:
                print('  %-18s %3d  ·  no hay nadie en ese servidor'
                      % (sv or '(la propia)', n))
                continue
            # ⚠️ PUEDE HABER MAS QUE EL POOL, y no es un error: en R2 estan
            # tambien las de los bloqueados y las de gente que dejo el pool.
            # Con `== tope` esos servidores salian con ⚠️ teniendo de mas.
            print('  %-18s %3d  %s'
                  % (sv or '(la propia)', n,
                     '✅' if n >= tope else '⚠️ faltan %d' % (tope - n)))
        return

    pedidos = [a.upper() for a in args] if args else ORDEN
    for sv in pedidos:
        una('' if sv in ('', 'PROPIA') else sv)

    # ⚠️ UNA escritura, no 240. Ver el docstring.
    corre(['bot/subir_datos.py', '--solo-meta'])


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
