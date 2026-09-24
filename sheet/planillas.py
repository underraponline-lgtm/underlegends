# -*- coding: utf-8 -*-
"""LAS DOS PLANILLAS, EN UN SOLO LUGAR.

    python sheet/planillas.py        cuales son y quien las copia

    from planillas import OFICIAL, operativo
    operativo()                      # el del Apps Script, cacheado

🔴 EL ID DEL OFICIAL ESTABA CLAVADO EN SEIS ARCHIVOS.

`construir_pool_temporada`, `construir_pool_competitivo`,
`construir_pool_mundial`, `explorar_sheet`, `sincronizar_puesto` y
`appscript` tienen cada uno su copia de la misma cadena de 44
caracteres. Ninguna discrepa hoy — por eso no se nota— y esa es
exactamente la forma que este proyecto documenta tres veces: **un dato
con dueño copiado a varios lugares no falla, se desincroniza**. Cuando
la T1 estrene su planilla, el que se olvide de actualizar va a leer la
vieja y devolver datos validos de la temporada equivocada.

⚠️ **Y NO ES HIPOTETICO ACA: LA T1 ESTRENA PLANILLA.** `CLAUDE.md` lo
dice arriba de todo — *«la T1 arranca de cero en un Sheet nuevo, "T1
Ranking Global"»*. O sea que este ID **va a cambiar**, y ese es
justamente el dia en que seis copias se convierten en un bug.

⚠️ **EL DEL OPERATIVO NO SE CLAVA, SE PREGUNTA.** Sale del proyecto de
Apps Script al que esta atado —ver `explorar_operativo.id_operativo()`,
que ademas lo cachea— y aca solo se reexporta para que quien necesite
las dos tenga un unico sitio al que ir.

✅ **LAS CINCO YA ESTAN MIGRADAS** (21/09/2026). Se hizo de a una y
verificando: los dos builders del pool se corrieron despues de cambiar y
dejaron `temporada_pool.json` y `competitivo_pool.json` **byte a byte
identicos**, que es la prueba de que el cambio no movio nada.

🔴 **Y POR ESO `verificar()` YA NO COMPARA VALORES: BUSCA COPIAS
NUEVAS.** Ahora que los cinco importan de aca, preguntarles «¿tu SHEET
es igual a OFICIAL?» es preguntarle a una variable si es igual a si
misma — siempre da que si. **Un chequeo que no puede fallar no es un
chequeo**, y este repo ya se comio uno igual: el de los scopes de OAuth,
que comparaba una lista consigo misma y decia que alcanzaba.

Lo que si puede pasar es que alguien vuelva a pegar la cadena en un
archivo nuevo. Eso es lo que se busca, por texto, en todo el repo.
"""
import importlib
import io
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

# ⚠️ EL DE LA PRE-TEMPORADA. Cuando exista «T1 Ranking Global» se cambia
# ACA y en ningun otro lado — que es todo el punto de este archivo.
OFICIAL = '1sDo89FTvnI6FOtz6KSK0jAtDBtJHsB7N54wNLLae62U'

# los cinco que ANTES tenian la cadena pegada. Se deja la lista para que
# el chequeo pueda decir «este ya estaba migrado» en vez de solo contar.
MIGRADOS = (
    'sheet/construir_pool_temporada.py',
    'sheet/construir_pool_competitivo.py',
    'sheet/construir_pool_mundial.py',
    'sheet/explorar_sheet.py',
    'herramientas/sincronizar_puesto.py',
)

# ⚠️ ESTOS NO CUENTAN COMO COPIA. `appscript.py` la tiene en una lista de
# «IDs que NO son secretos» —es documentacion de que se puede loguear, no
# un lector— y los .md la citan como dato. Excluirlos por nombre y no por
# heuristica: una exclusion que adivina deja pasar la que importa.
NO_SON_LECTORES = ('sheet/planillas.py', 'herramientas/appscript.py')


def operativo():
    """El ID del Operativo. Se pregunta, no se clava. Cacheado."""
    from explorar_operativo import id_operativo
    return id_operativo()


def verificar(callado=False):
    """Busca la cadena pegada en algun .py que no sea este. Devuelve las malas.

    🔴 BUSCA COPIAS NUEVAS, NO COMPARA VALORES. Ver el encabezado: desde
    que los cinco importan de aca, comparar `SHEET` contra `OFICIAL` es
    comparar una variable consigo misma y siempre da que si.
    """
    malas = []
    for raiz, dirs, arcs in os.walk(BASE):
        dirs[:] = [d for d in dirs
                   if d not in ('.git', '__pycache__', 'disenos', 'salida',
                                'node_modules', 'sheet_respaldo')]
        for a in arcs:
            if not a.endswith('.py'):
                continue
            rel = os.path.relpath(os.path.join(raiz, a), BASE)
            rel = rel.replace(os.sep, '/')
            if rel in NO_SON_LECTORES:
                continue
            try:
                t = io.open(os.path.join(raiz, a), encoding='utf-8').read()
            except OSError:
                continue
            if OFICIAL in t:
                malas.append(rel)
    if not callado:
        for m in MIGRADOS:
            print('   %s %-42s importa de acá'
                  % ('✅' if m not in malas else '🔴', m))
    return malas


def main():
    print('\n══ LAS DOS PLANILLAS ══\n')
    print('   Oficial    %s' % OFICIAL)
    try:
        print('   Operativo  %s   (del Apps Script)' % operativo())
    except Exception as e:                               # noqa: BLE001
        print('   Operativo  🔴 %s' % str(e)[:70])
    print('\n   ── los cinco que antes la tenían pegada ──')
    malas = verificar()
    if malas:
        print('\n   🔴 %d archivo(s) tienen el ID pegado otra vez:' % len(malas))
        for ruta in malas:
            print('      %s' % ruta)
        print('\n   Una copia que se aparta lee OTRA planilla y devuelve datos')
        print('   válidos de la temporada equivocada. No falla: miente.')
        print('   Cambialo por `from planillas import OFICIAL`.\n')
        return 1
    print('\n   ✅ ninguna copia suelta en todo el repo.')
    print('      El día que la T1 estrene planilla, se cambia acá y nada más.\n')
    return 0


if __name__ == '__main__':
    sys.exit(main())
