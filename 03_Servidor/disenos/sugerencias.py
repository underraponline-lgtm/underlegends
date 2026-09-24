"""Sugerencias para las dos ideas abiertas, medidas contra los datos reales.

Dlx pidio dejar sugerencias preparadas antes de que se corte el contexto.

⚠️ NO SON IDEAS SUELTAS: cada una esta contrastada con el reparto real de la
gente. Una escalera de veinte escalones suena bien y despues resulta que
dieciocho estan vacios; eso solo se ve contando.
"""
import collections
import json
import os
import sys

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
sys.path.insert(0, BASE)


def main():
    comp = json.load(open(os.path.join(BASE, 'datos', 'competitivo_pool.json'),
                          encoding='utf-8'))
    temp = json.load(open(os.path.join(BASE, 'datos', 'temporada_pool.json'),
                          encoding='utf-8'))
    T = {t['raw'].lower(): t for t in temp}
    oro = sorted(t['oro'] for t in temp)
    pod = sorted(t['pod'] for t in temp)
    n = len(oro)

    print('=' * 70)
    print('IDEA 2 · LA ESCALERA DEL SERVIDOR: cuanta gente entra en cada escalon')
    print('=' * 70)
    print('''
   Las capturas que paso Dlx tienen 20 y 40 escalones. Antes de copiar una
   forma asi conviene ver cuanta gente hay para repartir.

   ⚠️ Y hay que medirlo sobre los CAMPEONATOS GLOBALES, porque los de cada
   servidor todavia no existen. El reparto por servidor va a ser MAS chico
   que este, no mas grande: es la cota optimista.
''')
    print('   campeonatos (oro) de las %d personas del pool:' % n)
    for q in (10, 25, 50, 75, 90, 95, 99):
        print('      percentil %-3d %3d' % (q, oro[min(n - 1, q * n // 100)]))
    print('      maximo        %3d' % oro[-1])
    c = collections.Counter(oro)
    print('\n   cuantos tienen exactamente:')
    for k in sorted(c)[:12]:
        print('      %2d campeonatos  %3d personas  %s' % (k, c[k], '#' * min(c[k], 50)))
    if len(c) > 12:
        print('      ...y %d valores mas hasta %d' % (len(c) - 12, max(c)))

    print('''
   ⚠️ LO QUE ESTO DICE. Con la mitad de la gente en un puñado de valores
   bajos, una escalera de 20 escalones deja a casi todos en los dos
   primeros y los de arriba vacios. Y eso es sobre el total GLOBAL: partido
   por servidor, peor.
''')
    # cuantos escalones tienen sentido: que cada uno agarre >= 8 personas
    print('   ESCALERA QUE SI SE LLENA, hecha por percentiles y no por')
    print('   numeros redondos —asi cada escalon agarra gente de verdad—:\n')
    cortes = [oro[int(n * f)] for f in (.30, .55, .75, .88, .96)]
    # deduplicar conservando orden
    vistos, lim = set(), []
    for v in cortes:
        if v not in vistos:
            vistos.add(v); lim.append(v)
    nombres = ['RAPERO', 'CAMPEON', 'MAESTRO', 'LEYENDA', 'DIOS', 'MITO'][:len(lim)+1]
    ant = -1
    for i, nom in enumerate(nombres):
        if i == 0:
            cuantos = sum(1 for v in oro if v <= lim[0])
            print('      %-9s  hasta %2d campeonatos   %3d personas  (%.0f%%)'
                  % (nom, lim[0], cuantos, 100*cuantos/n))
            ant = lim[0]
        elif i < len(lim):
            cuantos = sum(1 for v in oro if ant < v <= lim[i])
            print('      %-9s  %2d a %2d               %3d personas  (%.0f%%)'
                  % (nom, ant+1, lim[i], cuantos, 100*cuantos/n))
            ant = lim[i]
        else:
            cuantos = sum(1 for v in oro if v > ant)
            print('      %-9s  %2d o mas              %3d personas  (%.0f%%)'
                  % (nom, ant+1, cuantos, 100*cuantos/n))

    print('''
   ⚠️ CINCO O SEIS ESCALONES, NO VEINTE. Y los cortes salen del reparto, no
   de numeros lindos: si se ponen en 1-3-5-8-11 como la captura, el reparto
   real deja el 70% en el primero.
''')
    print('=' * 70)
    print('PERO HAY UN PROBLEMA MAS GRANDE, Y ES EL QUE DECIDE')
    print('=' * 70)
    cero = sum(1 for v in oro if v == 0)
    print('''
   ⚠️ %d DE %d PERSONAS TIENEN CERO CAMPEONATOS: el %.0f%%.

   Una escalera por campeonatos le da el escalon de abajo a cuatro de cada
   diez, y a los diez de FRZ, FTN, TWR y RZ juntos —donde casi nadie gano
   nada— les da el mismo escalon a todos. La escalera no los ordena: los
   empata.

   Y esto es sobre el TOTAL GLOBAL. Los campeonatos DE CADA SERVIDOR son un
   pedazo de estos, asi que el porcentaje de ceros solo puede subir.
''' % (cero, n, 100 * cero / n))

    # la alternativa: escalera por PUESTO dentro del servidor
    por_sv = collections.Counter(p['sv'] for p in comp)
    con_pos = sum(1 for p in comp if p.get('pos_sv'))
    print('''   LA ALTERNATIVA QUE SI SE LLENA SIEMPRE: escalera por PUESTO dentro
   del servidor, no por cantidad. El puesto existe por construccion —si hay
   diez personas hay un 1º y un 10º— asi que ningun escalon queda vacio y
   ninguno se lleva al 40%%.

   Hoy pos_sv lo tienen %d de %d.
''' % (con_pos, len(comp)))
    tramos = [('CAMPEON', .00, .05), ('LEYENDA', .05, .20), ('ELITE', .20, .40),
              ('VETERANO', .40, .70), ('RAPERO', .70, 1.01)]
    cuenta = {t[0]: 0 for t in tramos}
    for p in comp:
        # ⚠️ pos_sv NO es un numero: es el texto "1/18", puesto Y total juntos.
        # El total sale de ahi, no de contar el pool —el builder ya aplico el
        # umbral de 3 y dejo vacios a los que no llegan—.
        crudo = p.get('pos_sv') or ''
        if '/' not in crudo:
            continue
        ps, tot = (int(v) for v in crudo.split('/'))
        if tot < 3:
            continue
        f = (ps - 1) / tot
        for nom, a, b in tramos:
            if a <= f < b:
                cuenta[nom] += 1
                break
    vis = sum(cuenta.values())
    print('   %-10s %-16s %s' % ('escalon', 'que es', 'gente'))
    print('   ' + '-' * 52)
    for nom, a, b in tramos:
        print('   %-10s %-16s %3d  (%2.0f%%)  %s'
              % (nom, 'top %d%%' % (b * 100), cuenta[nom],
                 100 * cuenta[nom] / max(vis, 1), '#' * (cuenta[nom] // 2)))
    print('   ' + '-' * 52)
    print('   %-27s %3d' % ('con escalon', vis))
    print('''
   ⚠️ NINGUNO VACIO Y NINGUNO CON EL 40%. Y ademas se defiende solo: "sos
   top 5% de tu servidor" quiere decir lo mismo en un servidor de 79 que en
   uno de 6, mientras que "3 campeonatos" quiere decir cosas distintas.

   ⚠️ LA CONTRA, Y HAY QUE DECIRLA: un escalon por puesto SE PUEDE PERDER.
   Si entra alguien mejor te corre para abajo sin que vos hicieras nada. Los
   campeonatos no se pierden nunca. Las escaleras de Discord que paso Dlx son
   todas de las que no se pierden, y eso no es casualidad: son roles, y un
   rol que se cae solo genera reclamos.

   Sale caro de las dos formas, asi que es una decision de Dlx y no una
   medicion: ¿la escalera dice DONDE ESTAS HOY o DONDE LLEGASTE ALGUNA VEZ?
''')
    print('=' * 70)
    print('IDEA 1 · EL TAG — y por que puede ser LA MISMA PIEZA que la idea 2')
    print('=' * 70)
    print('''
   ⚠️ ESTO CONVIENE MIRARLO ANTES DE HACER LAS DOS. El TAG de la Temporada
   dice "DINASTIA" y el de la Competitiva "#1 COMPETITIVO": los dos son EL
   NOMBRE DE UN LOGRO. Y la idea 2 —un rango del servidor que diga CAMPEON o
   LEYENDA— tambien es el nombre de un logro.

   Si se hacen las dos, la carta va a llevar DOS pastillas que dicen lo
   mismo con distinta palabra. Lo mas probable es que sean UNA sola pieza:

     · si el TAG dice el rango del servidor  -> es la idea 2, con el formato
       de TAG que ya usan las otras dos cartas
     · si el TAG dice otra cosa              -> hay que decir cual, y que no
       sea el rango

   TRES COSAS QUE PODRIA DECIR EL TAG SI NO ES EL RANGO, y las tres existen
   o casi:

     "#1 DE TFC"          el mejor del servidor. Sale de pos_sv, que YA
                          EXISTE (135 de 138). Es lo unico de esta lista
                          que se puede dibujar hoy.
     "CAMPEON INTERSERVER" si gano un Interserver. Sale de
                          datos/estrellas.json, que ya existe, pero hoy
                          es POR SERVIDOR y no por persona: habria que
                          saber QUIEN lo gano, no que servidor.
     "FUNDADOR"           por antiguedad en el servidor. Solo el bot.

   ⚠️ Y OJO CON EL ULTIMO ESCALON. Si el TAG es "#1 DE TFC", en URBF y DRA
   —2 y 1 personas— seria "#1 de 2" y "#1 de 1". El umbral de 3 ya rige
   pos_sv, asi que en esos dos el TAG simplemente no se dibuja. Igual que
   el puesto.
''')
    print('=' * 70)
    print('DONDE IRIA, SI ENTRA')
    print('=' * 70)
    print('''
   La Competitiva pone su rango JUSTO DEBAJO DEL NUMERO, y eso es lo que
   Dlx senalo. En nuestra carta debajo del numero arrancan las cinco filas
   de la columna, en y=118, y el numero termina en ~90: quedan 28 px.

   ⚠️ Una pastilla de TAG mide unos 17 px de alto con su padding. Entra,
   pero deja 5 px de cada lado, o sea PEGADA. Para que respire hay dos
   caminos y los dos cuestan algo:

     · subir la primera fila de 118 a 128  -> el bloque se apreta abajo:
       hoy quedan 30.2 px hasta el divisor, quedarian 20.2
     · sacar una fila                      -> volver a cinco es volver a
       elegir cual sale

   Hay una tercera que no cuesta nada y vale considerarla: que el rango NO
   sea una pastilla sino UNA LINEA DE TEXTO, como el "SSS" de la Temporada
   —que va debajo del 83 sin pastilla—. Ocupa 8 px en vez de 17 y entra sin
   mover nada.
''')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
