"""El nombre se achica solo cuando hace falta, igual en las tres cartas.

La Competitiva ya lo resolvia con clases por largo en su card.css:

    .n6   1.86rem      hasta  6 letras
    .n8   1.72rem      hasta  8
    .n10  1.55rem      hasta 10
    .n12  1.38rem      mas

Estaba solo ahi, dentro de gencomp.py. Traido a comun/ porque es una regla
de las TRES cartas, no de una: si cada carta la reimplementa, tarde o
temprano se separan y el mismo nombre sale de dos tamaños distintos en dos
cartas de la misma persona.

⚠️ El escalon es POR LARGO, no por ancho medido. Es aproximado a proposito:
medir el ancho real exigiria renderizar antes de decidir, y con 138 nombres
eso es una vuelta de render por carta. Los cuatro escalones alcanzan porque
la fuente es de ancho parejo y los nombres son cortos.
"""

# (hasta cuantas letras, rem) — de la Competitiva, card.css:154-157
ESCALONES = ((6, 1.86), (8, 1.72), (10, 1.55), (99, 1.38))

# ── donde va, por carta ──────────────────────────────────────────────────
# El TAMAÑO es una regla de las tres; la POSICION no, cada carta tiene su
# alto. Esta aca igual para que no quede suelta en los scripts: la de la
# Servidor se movio tres veces —280 -> 281 -> 281.6 -> 282.4— y ya estaba en
# dos archivos. Un numero decidido que vive en dos lados se separa solo.
Y = {
    'servidor': 282.4,      # de 405. 280 -> 281 -> 281.6 -> 282.4
}
BASE_REM = {'servidor': 1.6}


def rem(nombre, base=1.86):
    """El tamaño en rem para ese nombre, escalado si `base` no es el de la
    Competitiva. La Servidor usa el nombre mas chico, asi que pasa su base y
    los cuatro escalones se achican en la misma proporcion."""
    L = len(nombre.strip())
    for tope, r in ESCALONES:
        if L <= tope:
            return round(r * base / ESCALONES[0][1], 3)
    return round(ESCALONES[-1][1] * base / ESCALONES[0][1], 3)


def clase(nombre):
    """La clase de la Competitiva, para cuando se quiere el CSS y no el rem."""
    L = len(nombre.strip())
    return 'n6' if L <= 6 else 'n8' if L <= 8 else 'n10' if L <= 10 else 'n12'


if __name__ == '__main__':
    print('%-14s %-6s %-8s %s' % ('nombre', 'letras', 'clase', 'rem a base 1.6'))
    print('-' * 46)
    for n in ('Bau', 'Valen', 'Konan', 'Humildad', 'Juasmio', 'Meteoro',
              'Provenza', 'Krtman', 'Bloody'):
        print('%-14s %-6d %-8s %.3f' % (n, len(n), clase(n), rem(n, 1.6)))
