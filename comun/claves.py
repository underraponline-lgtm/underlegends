# -*- coding: utf-8 -*-
"""LA CLAVE DE UNA PERSONA — un solo lugar, porque ya fallo tres veces hoy.

    from comun.claves import clave
    clave('Lázaro')      -> 'lazaro'
    clave('Ржунимагу')   -> 'ржунимагу'
    clave('Ññ')          -> 'nn'

    python comun/claves.py    el self-check

🔴 EL MISMO NOMBRE SE CONVIERTE A CLAVE EN **DOCE** LUGARES DEL PROYECTO, y el
19/09/2026 tres de ellos discreparon en un mismo dia:

  1. El Worker buscaba con `[^a-z0-9]` y Python escribia con `isalnum()`. Para
     **Ржунимагу** el Worker armaba la clave vacia: la carta existia como
     `p:ржунимагу` y el bot contestaba «no tengo cartas» teniendolas.
  2. `_slug()` de los generadores dejaba en `''` a **Ññ** y a **Ржунимагу**,
     asi que sus cuatro cartas se escribieron en dos archivos, pisandose.
  3. El mismo `_slug()` borra la `á` entera en vez de convertirla: **Lázaro**
     quedo subido a `lzaro/` y el bot busca `lazaro/`. Seis cartas de tres
     personas quedaron en R2 donde nadie las va a pedir.

Los tres son el mismo error con distinta ropa, y ninguno tira una excepcion:
la carta se sube, el archivo se escribe, el bot contesta. Por eso vive aca.

LA REGLA
--------
NFD, minusculas, y se conserva **todo lo alfanumerico de cualquier alfabeto**.

⚠️ NFD Y NO NFKD. NFD separa la tilde de la letra y la tilde se cae sola por
no ser alfanumerica, asi que `á` -> `a`. NFKD ademas convierte la negrita
matematica y los superindices, que en un nombre propio **son parte del
nombre**: no es lo mismo buscar roles —donde hay que ver a traves del
adorno— que identificar a una persona.

⚠️ `[a-z0-9]` ES EL CRITERIO EQUIVOCADO y es el que causo los tres. Tira el
cirilico, el japones y las tildes; `isalnum()` los conserva.

⚠️ Y NUNCA DEVUELVE VACIO. Dos personas de la Liga no tienen ni una letra
ASCII. Si el resultado quedara vacio, sus cartas se pisan entre si.
"""
import re
import sys
import unicodedata

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

# las banderas y el interrogante que el Sheet mete en algunos nombres
_ADORNO = re.compile(r'[\U0001F1E6-\U0001F1FF]')


def clave(nombre):
    """El identificador de esa persona: el mismo en R2, en KV y en disco."""
    s = _ADORNO.sub('', str(nombre or '')).replace('❓', '')
    s = unicodedata.normalize('NFD', s.strip().lower())
    out = ''.join(c for c in s if c.isalnum())
    # ⚠️ el fallback NO puede depender del nombre, o dos vacios distintos
    # darian la misma clave otra vez. Si esto llega a pasar, que se note.
    return out or 'sinnombre'


# El JS tiene que dar lo mismo. Vive en `norm()` de bot/worker.js.
#
# 🔴 ESTA LINEA DECIA «y hay un test que compara los dos sobre esta misma
# lista» Y EL TEST NO EXISTIA. O sea que la unica defensa contra el bug que
# este archivo entero existe para evitar era una frase. Ahora si existe:
#
#     python herramientas/claves_js_vs_py.py
#
# Lee el `norm` del worker.js de verdad —no una copia reescrita, que seria la
# tercera— y lo corre con node sobre estos CASOS mas los 870 nombres reales.
# Verificado que FALLA con las dos versiones que ya rompieron: marca 5 de 7
# con el `[a-z0-9]` original y 4 de 7 con el que no tenia fallback.
CASOS = [
    ('Lázaro', 'lazaro'),
    ('Lilñaño', 'lilnano'),
    ('Ржунимагу', 'ржунимагу'),
    ('Ññ', 'nn'),
    ('Indígena', 'indigena'),
    ('Géminis', 'geminis'),
    ('Céim', 'ceim'),
    ('Ginecólogo Equino', 'ginecologoequino'),
    ('Konan', 'konan'),
    ('Lil Drako', 'lildrako'),
    ('7', '7'),
    ('Ac3nto', 'ac3nto'),
    ('MC-Arepa', 'mcarepa'),
    ('日本語', '日本語'),
    ('Val ⚡', 'val'),
    ('Am 🌍', 'am'),
]


def _self_check():
    print('\nLA CLAVE DE CADA NOMBRE\n')
    mal = 0
    for n, esperado in CASOS:
        d = clave(n)
        ok = d == esperado
        mal += 0 if ok else 1
        print('  %s %-20s -> %-18s %s'
              % ('✅' if ok else '❌', n, d, '' if ok else '(esperaba %s)' % esperado))

    # ⚠️ LO QUE DE VERDAD IMPORTA: que la clave coincida con la que ya usan el
    # padron y el subidor. Si este modulo se desvia de ellos, empeora.
    import os
    BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, os.path.join(BASE, 'sheet'))
    try:
        import construir_padron as PAD
        dist = [(n, clave(n), PAD.norm(n)) for n, _ in CASOS if clave(n) != PAD.norm(n)]
        print('\n  contra sheet/construir_padron.norm: %s'
              % ('igual en los %d' % len(CASOS) if not dist else dist))
        mal += len(dist)
    except Exception as e:
        print('\n  (no pude comparar con el padron: %s)' % str(e)[:60])

    print('\n  %s\n' % ('todo bien' if not mal else '%d diferencia(s)' % mal))
    return mal


if __name__ == '__main__':
    sys.exit(1 if _self_check() else 0)
