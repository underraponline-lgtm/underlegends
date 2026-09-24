# -*- coding: utf-8 -*-
"""UN LADO DE LA LLAVE PUEDE SER UN EQUIPO. Como se parte y como suma.

    python sheet/equipos.py        el self-check con los casos reales

🔴 DLX, 22/09/2026: «se reparten entre los 3 pero no cuenta para Duelos».
Son **dos reglas y son separadas**:

  · los puntos del puesto se **dividen** entre los integrantes
  · la batalla **no** entra a `1v1`, asi que no mueve el win%, ni DNA/DIN,
    ni nada que se mida por duelos

Un 3v3 no es comparable con un 1v1 en ninguna de las dos cosas. Sumarle a
cada uno el puesto completo infla el evento; contar la batalla como duelo
le da a una persona un duelo que no peleo sola.

🔴 Y HASTA HOY EL LECTOR NO SABIA QUE EXISTIAN. El primer evento de la T1
—#349, «EL RAP FECHA 5», FFA, un 3v3— entro con el **equipo entero como
un rapero**:

    Resultados:  «Sin límites 🇵🇪+Trot🇪🇸+Soneto 🇪🇨»   Cuartos   2500
    1v1:         «sosa+papa+ bna🇯🇴» vs «marto🇦🇷+ erian 🇵🇦 + melomaniaco»

O sea: **nadie individual sumo un punto**, dos «nombres» cayeron en
`Pendientes` como desconocidos —porque no son personas— y cuatro duelos
quedaron registrados entre entidades que no existen. Y no fallo nada: las
filas se escribieron, el evento quedo ✅ y el Ranking siguio en blanco.

⚠️ PARTIR POR `+` ES SEGURO, MEDIDO. Ni un nombre del padron (875) ni un
alias de `AKAs` (185) contiene `+`. Si algun dia entra uno, este archivo
es el unico lugar que hay que tocar.

⚠️ Y LOS CARACTERES DEL DIBUJO DEL BRACKET SE CAEN ACA. El lector trajo
`⌞Hassan🇪🇬 +` y `⌞sosa+papa+ bna🇯🇴⌝`: `⌞` y `⌝` son parte del **dibujo**
de la llave, no del nombre. Medido: ningun nombre real tiene un caracter
de dibujo (los unicos sobre U+2000 son 🦠 🧠 👑, de tres nicks).

🔴 UN `+` SUELTO AL FINAL NO ES UN INDIVIDUO: ES UN EQUIPO CORTADO. Es el
caso de `⌞Hassan🇪🇬 +`, donde el lector perdio a los otros dos. Tratarlo
como una persona le daria a Hassan **el puesto completo de un equipo**,
que es exactamente el error que estas reglas evitan, disfrazado de dato
limpio. Por eso `integrantes()` devuelve tambien si quedo cortado, y
quien lo llame tiene que mandarlo a `Pendientes` en vez de cargarlo.
"""
import re
import sys

#: Lo que el dibujo de la llave mete y no es parte de ningun nombre.
#: `⌞⌟⌜⌝` son esquinas, `└┘┌┐│─├┤┬┴┼` cajas, `╭╮╯╰` redondeadas.
DIBUJO = '⌞⌟⌜⌝└┘┌┐│─├┤┬┴┼╭╮╯╰║═╔╗╚╝▏▕'
_DIBUJO = re.compile('[' + re.escape(DIBUJO) + ']')

#: Los separadores de integrantes.
#:
#: 🔴 LOS DOS, Y EL SEGUNDO ES EL QUE EXPLICA TODO ESTO. La coma ya estaba:
#: `motor.equipo()` partia por coma desde siempre y `sumar()` ya dividia los
#: puntos, y `resultados._filas_uno()` ya descartaba del `1v1` los lados con
#: coma. O sea que **las dos reglas de Dlx ya estaban implementadas** — y
#: nunca se activaron, porque la gente escribe `sosa+papa+bna` y no
#: `sosa, papa, bna`. Es la forma que `CLAUDE.md` llama «un default que no es
#: la decision»: la decision vivia en el codigo con el formato equivocado.
#:
#: ⚠️ `&` y ` y ` NO se parten, a proposito: partir de mas junta a dos
#: personas distintas en una, y eso es peor que no partir. Ver el self-check.
SEPS = ('+', ',')
SEP = '+'                       # el que usa la gente; se deja por claridad

# 🔴 EL PARENTESIS TAMBIEN SEPARA, Y NO SABERLO INVENTO PERSONAS. Medido el
# 24/09/2026 sobre los lados reales de las llaves de la T1, hay 14 con
# paréntesis y **todos** tienen la forma `A(B)` o `A(B+C)`:
#
#     nhp(sinlimites+fleivacheck)        gekto🇦🇷(chianluka+makma+nhp)
#     Hassan🇮🇶(tam+kc)                  SAITO🇨🇴(blody🇨🇴+cj)
#     Makma 🇻🇪(vandu)                   money maker(cj)
#
# Partir sólo por `+` daba `nhp(sinlimites` y `fleivacheck)` — **las dos
# mitades del mismo nombre, con el paréntesis desbalanceado**— y cada pedazo
# se volvía una persona en `Resultados`, en el pool, en la vitrina y en la
# web. De ahí salieron `papa`, `money maker(cj)` y `El ultra knowledge
# instintivo 🇬🇦`.
#
# ⚠️ ESTO NO DECIDE QUE SIGNIFICA EL PARENTESIS, y a propósito. Puede ser
# «a quién eliminó» o una batalla a varias bandas; no se sabe y no hace
# falta saberlo. Lo único que se arregla es la **tokenización**: bajo
# cualquiera de las dos lecturas, `nhp(sinlimites` no es un nombre. Con el
# paréntesis como separador salen `nhp`, `sinlimites` y `fleivacheck`, que
# son tres nombres reales — estrictamente mejor que antes en los dos casos.
#
# 🔑 Y LO QUE HAY ADENTRO ES **A QUIEN LE GANO**, medido, no supuesto. La
# primera versión de esto trató el paréntesis como un separador de equipo
# —`gekto(chianluka+makma)` -> tres personas— y eso movió el ranking
# entero: los puntos se reparten entre los integrantes, así que el ganador
# cobraba un tercio y sus dos víctimas cobraban el resto. CJ pasó a #1 con
# 2 eventos.
#
# Lo que lo resolvió fue mirar la progresión de una llave:
#
#     cuartos       gekto🇦🇷(chianluka🇦🇷)      vs  Makma 🇻🇪
#     semifinales   gekto🇦🇷(chianluka+makma)   vs  nhp(sinlimites+…)
#
# El paréntesis **crece cada ronda, y le agrega justo al que acaba de
# vencer**. Un equipo no gana integrantes a mitad de torneo. Igual
# `hassan(tam)` -> `Hassan(tam+kc)` -> `Hassan(tam+kc+cj)`.
#
# ⚠️ ASI QUE SE BORRA ENTERO y el competidor es lo que va ANTES. No se
# pierde a nadie: cada vencido aparece como su propio lado en la batalla
# donde perdió, que es donde le corresponde.
#
# ⚠️ Y SE BORRA **ANTES** DE PARTIR POR `+`. `makma + tam + agus(yinn)` es
# el equipo de tres que le ganó a yinn: partir primero metería a yinn de
# cuarto integrante y le repartiría puntos que no ganó.
_PAREN = re.compile(r'[(（][^)）]*[)）]?')


def limpiar(s):
    """Un nombre sin los caracteres del dibujo de la llave."""
    return _DIBUJO.sub('', str(s or '')).strip()


def integrantes(lado):
    """`(nombres, cortado)` de un lado de la llave.

    Un lado individual devuelve `([ese nombre], False)`. Un equipo
    devuelve sus integrantes. `cortado` es True cuando hay un separador
    sin nada al lado —el lector perdio integrantes— y entonces **esto no
    se carga**: va a `Pendientes`.
    """
    s = limpiar(lado)
    if not s:
        return [], False
    # ⚠️ EL PARENTESIS SE NORMALIZA A `+` ANTES DE MIRAR SI HAY SEPARADOR.
    # Ver `CIERRA` arriba: `Makma 🇻🇪(vandu)` no tiene ningún `+` ni `,`, así
    # que con el chequeo viejo salía como UN nombre llamado
    # `Makma 🇻🇪(vandu)` — y ése también era una persona inventada.
    # 🔴 EL PARENTESIS SE BORRA ENTERO, NO SEPARA. Ver `CIERRA` arriba.
    s = _PAREN.sub('', s).strip()
    if not s:
        return [], False
    if not any(x in s for x in SEPS):
        return [s], False
    # se parte por todos los separadores a la vez: `sosa+papa, bna` es un
    # equipo de tres y no de dos con uno pegado
    trozos = [s]
    for x in SEPS:
        trozos = [t for p in trozos for t in p.split(x)]
    trozos = [limpiar(t) for t in trozos]
    nombres = [t for t in trozos if t]
    # un trozo vacio significa un separador sin nombre: el lado vino cortado
    cortado = len(nombres) != len(trozos)
    return nombres, cortado


def es_equipo(lado):
    n, _ = integrantes(lado)
    return len(n) > 1


def reparto(puntos, cuantos):
    """Los puntos de UN integrante. Dlx: «se reparten entre los 3».

    ⚠️ SE DEVUELVE EL COCIENTE EXACTO Y NO SE REDONDEA ACA. Redondear
    tres veces 2500/3 da 833·3 = 2499 y el evento pierde un punto, o da
    834·3 = 2502 y gana dos. Quien escriba la fila decide como presentarlo;
    lo que este archivo garantiza es que la suma sea la que fue.
    """
    try:
        cuantos = int(cuantos)
        if cuantos < 1:
            return 0.0
        return float(puntos) / cuantos
    except (TypeError, ValueError):
        return 0.0


def cuenta_como_duelo(lado_a, lado_b):
    """¿Esta batalla va a `1v1`? Solo si los dos lados son una persona.

    ⚠️ LOS **DOS** LADOS. Un 1v3 no es un duelo tampoco, y aunque hoy no
    exista ese formato, preguntar por uno solo deja la puerta abierta a
    que entre sin que nadie lo decida.
    """
    return not (es_equipo(lado_a) or es_equipo(lado_b))


def _self_check():
    print('\n══ EQUIPOS ══\n')
    mal = 0

    # los cinco lados reales del evento #349
    casos = [
        ('makma 🇻🇪 + tam 🇻🇪 + agus🇦🇷', 3, False),
        ('Sin límites 🇵🇪+Trot🇪🇸+Soneto 🇪🇨', 3, False),
        ('sosa+papa+ bna🇯🇴', 3, False),
        ('marto🇦🇷+ erian 🇵🇦 + melomaniaco', 3, False),
        ('Snow🇨🇴 + Velatz🇨🇱 + yinn', 3, False),
        ('⌞sosa+papa+ bna🇯🇴⌝', 3, False),
        # 🔴 el cortado: un `+` sin nada al lado
        ('⌞Hassan🇪🇬 +', 1, True),
        # y los individuales, que no se tocan
        ('Konan', 1, False),
        ('Bloody 🇨🇴', 1, False),
        ('TøKīØ🦠🧠', 1, False),
        # la coma, que es lo que el motor ya soportaba
        ('Konan, Bloody', 2, False),
        ('sosa+papa, bna🇯🇴', 3, False),
    ]
    print('   %-34s %-8s %s' % ('lado', 'sale', 'cortado'))
    for lado, n, cort in casos:
        nn, cc = integrantes(lado)
        ok = len(nn) == n and cc == cort
        mal += not ok
        print('   %s %-32s %-8s %s'
              % ('✅' if ok else '🔴', lado[:32], len(nn),
                 'SI' if cc else 'no'))

    print('')
    # 🔴 EL CORTADO NO PUEDE PASAR POR INDIVIDUO. Es el caso que le daría
    # a Hassan el puesto completo de un equipo de tres.
    nn, cc = integrantes('⌞Hassan🇪🇬 +')
    ok = cc is True and len(nn) == 1
    print('   %s un `+` suelto avisa que está cortado' % ('✅' if ok else '🔴'))
    mal += not ok

    # el reparto
    pruebas = [(2500, 3, 2500.0 / 3), (2500, 1, 2500.0), (0, 3, 0.0),
               (2500, 0, 0.0)]
    todo = all(abs(reparto(p, c) - e) < 1e-9 for p, c, e in pruebas)
    print('   %s el puesto se reparte (2500/3 = %.2f, y la suma da %.0f)'
          % ('✅' if todo else '🔴', reparto(2500, 3), reparto(2500, 3) * 3))
    mal += not todo

    # los duelos
    duelos = [(('Konan', 'Bloody'), True),
              (('sosa+papa', 'Konan'), False),
              (('Konan', 'a+b+c'), False),
              (('a+b', 'c+d'), False)]
    todo = all(cuenta_como_duelo(a, b) is e for (a, b), e in duelos)
    print('   %s solo cuenta como duelo si los DOS lados son una persona'
          % ('✅' if todo else '🔴'))
    mal += not todo

    # ⚠️ `&` y ` y ` NO se parten: partir de mas junta a dos personas en
    # una. Se deja escrito como prueba para que nadie lo "arregle" sin
    # decidirlo.
    n1, _ = integrantes('Snow & Velatz')
    n2, _ = integrantes('Juan y Pedro')
    ok = len(n1) == 1 and len(n2) == 1
    print('   %s `&` y « y » NO parten: partir de más junta a dos en una'
          % ('✅' if ok else '🔴'))
    mal += not ok

    # el dibujo del bracket
    ok = limpiar('⌞Hassan🇪🇬⌝') == 'Hassan🇪🇬'
    print('   %s los caracteres del dibujo de la llave se caen'
          % ('✅' if ok else '🔴 %r' % limpiar('⌞Hassan🇪🇬⌝')))
    mal += not ok

    print('\n   %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    raise SystemExit(_self_check())
