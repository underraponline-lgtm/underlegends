"""Que mas puede entrar en la columna, y que necesita cada cosa.

Dlx: "de momento quiero que me des ideas de como podemos hacer, que otras
cosas podemos meter aca? por ejemplo quizas ranking de estilo por el
servidor tmb?".

⚠️ LA PREGUNTA DEL ESTILO TIENE UN NUMERO QUE LA DECIDE, y conviene verlo
antes de dibujar nada. Un ranking de estilo DENTRO del servidor parte el
pool dos veces: primero por servidor y despues por estilo. Este script mide
cuanta gente queda en cada pedazo.

Y el proyecto ya tiene la regla que aplica: el UMBRAL DE 3 de los circulos
de abajo. Ser "1 de 1" no dice nada, y por eso pos_sv queda vacio cuando el
grupo no llega a tres. Un ranking que deje a casi todos en grupos de uno no
es un ranking: es una etiqueta con un numero al lado.
"""
import collections
import json
import os
import sys

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
sys.path.insert(0, BASE)
MIN = 3
N_ESTILOS = 16


def main():
    pool = json.load(open(os.path.join(BASE, 'datos', 'competitivo_pool.json'),
                          encoding='utf-8'))
    por_sv = collections.Counter(p['sv'] for p in pool)

    print('=' * 70)
    print('EL RANKING DE ESTILO POR SERVIDOR: cuanta gente queda en cada pedazo')
    print('=' * 70)
    print("""
   Hay 16 estilos (herramientas/extraer_estilos.py) y 7 servidores con
   gente. Partir por los dos deja 112 casilleros para 138 personas.
""")
    print('   %-6s %6s   %s' % ('sv', 'gente', 'si se reparte entre 16 estilos'))
    print('   ' + '-' * 60)
    tot_ok = 0
    for sv, n in por_sv.most_common():
        med = n / N_ESTILOS
        # cuantos estilos tendrian 3 o mas, si la gente se repartiera pareja
        ok = N_ESTILOS if med >= MIN else 0
        # reparto realista: unos pocos estilos concentran
        est_con3 = max(0, int(n / (MIN * 2)))
        tot_ok += min(est_con3, N_ESTILOS)
        print('   %-6s %6d   %.1f por estilo   ->  %d estilos llegarian a %d'
              % (sv, n, med, min(est_con3, N_ESTILOS), MIN))
    print('   ' + '-' * 60)
    print('   %-6s %6d' % ('total', sum(por_sv.values())))
    print("""
   ⚠️ CON 79 PERSONAS —TFC, EL MAS GRANDE— TOCAN A 4.9 POR ESTILO. Y ese es
   el mejor caso: en FTN son 0.7, en FRZ 0.3, en DRA 0.06. Un "1º de tu
   estilo en tu servidor" seria, en casi todos, 1º de 1.

   Y el proyecto ya decidio que eso no vale: es la misma regla del umbral de
   3 por la que pos_sv queda vacio en URBF y DRA.
""")
    print('=' * 70)
    print('Y ADEMAS: ESTILO_DE ESTA VACIO')
    print('=' * 70)
    print("""
   CLAUDE.md lo dice: "ESTILO_DE esta vacio: nadie tiene estilo asignado.
   Los 16 iconos estan listos y toman el color de la carta."

   O sea que hoy NADIE tiene estilo. No es que falte el ranking: falta el
   dato de base. Asignar 138 estilos es un trabajo de criterio, no de
   codigo, y lo tiene que hacer alguien que conozca a los 138.

   ⚠️ Pero eso mismo lo vuelve la mejor idea de la lista POR OTRO LADO: el
   ESTILO SOLO —sin ranking— no necesita ningun umbral. "Sos de tal estilo"
   vale igual seas 1 de 1 o 1 de 79. Y los 16 iconos ya existen, ya toman el
   color de la carta, y hoy NO SE USAN EN NINGUNA CARTA.
""")
    print('=' * 70)
    print('LO QUE PODRIA ENTRAR, Y QUE NECESITA CADA COSA')
    print('=' * 70)
    print("""
   YA EXISTE EL DATO, se puede hacer hoy
   -------------------------------------
   · nada. Los cinco numeros de la columna necesitan el builder.

   NECESITA EL BUILDER (partir lo que el Sheet ya tiene por servidor)
   -----------------------------------------------------------------
   · OVR del servidor, titulos, podios, eventos      <- los cuatro de hoy

   NECESITA EL BOT (no se puede partir, hay que medirlo de nuevo)
   -------------------------------------------------------------
   · racha en el servidor      una racha es una SECUENCIA, no un total
   · desde cuando estas ahi    Discord sabe la fecha de ingreso, el Sheet no
   · cuantos eventos organizo  ese servidor, no la persona

   NECESITA UNA DECISION HUMANA ANTES QUE CODIGO
   ---------------------------------------------
   · el ESTILO de cada uno     ESTILO_DE esta vacio, son 138 a mano

   NO EXISTE NI GLOBAL
   -------------------
   · duelos     duel_real esta en 4 de 138, y el acumulador no esta montado


   ⚠️ MI RECOMENDACION, Y EL CRITERIO ES UNO SOLO: la columna mide CUANTO
   HICISTE ACA. El estilo no es cuanto: es QUIEN SOS, igual que la bandera y
   el rango. Si entra, entra AL PIE —la zona de la identidad— y no a la
   columna.

   Y entra SIN ranking. El icono solo, al lado de la bandera. Es identidad
   pura, no necesita umbral, y usa 16 piezas que ya estan hechas y hoy no se
   ven en ninguna carta del juego.
""")


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
