# -*- coding: utf-8 -*-
"""¿LOS SELF-CHECK CHEQUEAN ALGO? Se les rompe el dato y se ve si avisan.

    python herramientas/chequeo_que_no_chequea.py
    python herramientas/chequeo_que_no_chequea.py --ver   solo cuales hay

🔴 POR QUE EXISTE: EN UN SOLO DIA ESCRIBI TRES QUE NO PODIAN FALLAR.

    · el de los scopes de OAuth comparaba una lista consigo misma
    · `planillas.verificar()` comparaba `SHEET` contra `OFICIAL` despues
      de que `SHEET` pasara a importarse **de** `OFICIAL`
    · `pais_por_rol.verificar_roles()` tenia el codepoint equivocado en
      su regex —U+FE50 en vez de U+FE52— y matcheaba **cero** roles: el
      resultado era «no falta ninguno» sin haber mirado nada

Los tres pasaban en verde. Un chequeo que no puede fallar es peor que no
tenerlo: ocupa el lugar del que si serviria y nadie vuelve a mirarlo.

COMO SE PRUEBA UN CHEQUEO: ROMPIENDOLE EL DATO
------------------------------------------------
A cada modulo se le **muta una constante en memoria** —no se toca el
archivo— y se corre su `_self_check()`. Si no se queja, ese chequeo no
esta mirando esa constante.

⚠️ **NO MIDE «ESTA BIEN ESCRITO», MIDE «SE ENTERA».** Un self-check
puede ser util y no cubrir la constante que este script elige; eso sale
como «no la mira», que es informacion, no una acusacion. Lo que importa
es la lista de los que **no se enteran de nada**.

⚠️ **SE MUTA EN MEMORIA Y SE RESTAURA SIEMPRE**, incluso si el chequeo
revienta. Tocar los archivos para esto seria arriesgar el repo para
probar una herramienta.
"""
import importlib
import io
import os
import sys
import traceback

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, BASE)
sys.path.insert(0, os.path.join(BASE, 'comun'))
sys.path.insert(0, os.path.join(BASE, 'sheet'))
sys.path.insert(0, os.path.join(BASE, 'bot'))
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

# 🔴 LA MARCA QUE UN CHEQUEO IMPRIME CUANDO NO TIENE DATOS. Ver
# `probar()`: sin esto, un pool vacio se lee como un guardian ciego.
SIN_DATOS = 'SIN DATOS PARA MEDIR'

# modulo -> (constante a romper, como romperla)
#
# ⚠️ SE ELIGE UNA CONSTANTE QUE EL CHEQUEO DEBERIA MIRAR, no cualquiera.
# Romper algo que al chequeo no le incumbe no prueba nada.
QUE_ROMPER = {
    'comun.rangos':     ('UMBRAL', lambda v: [(r, n + 7) for r, n in v]),
    # ⚠️ SE LE ROMPE EL **CAMPO**, NO EL UMBRAL, y la diferencia importa.
    # La primera version subia todos los umbrales a 99 y marcaba el
    # chequeo como ciego — pero cambiar un umbral es una decision
    # legitima de la Liga y el chequeo **no debe** rechazarla. El que si
    # es un bug es un nombre de campo mal escrito: `cuanto()` lo resuelve
    # a 0 sin fallar y esa carta desaparece para todos.
    #
    # Mi propia herramienta estaba midiendo la cosa equivocada, que es
    # justo lo que este repo documenta que se parece a medir bien.
    # ⚠️ DESDE EL 22/09 CADA CARTA TIENE UNA **LISTA** DE CONDICIONES —
    # Pais pide tres— asi que se le rompe el campo de **todas**. Romper
    # solo la primera dejaria sin probar las otras dos, que es donde un
    # typo se esconde mejor.
    'comun.requisitos': ('REQUISITOS',
                         lambda v: {k: [(n, 'campo_que_no_existe', q)
                                        for n, _c, q in cs]
                                    for k, cs in v.items()}),
    'comun.huella_codigo': ('CARPETAS',
                            lambda v: {k: ('noexiste',) for k in v}),
    'comun.crews':      ('CREWS', lambda v: {}),
    'comun.escudos':    ('SIN_ICONO', lambda v: []),
    'comun.banderas':   ('DIR', lambda v: '/no/existe'),
    # `rangos.verificar()` compara los umbrales contra `gencomp.py`: si
    # se mueve uno, tiene que gritar. Es el dato mas delicado del
    # proyecto —el rango es uno solo por persona— y la primera version
    # de esta herramienta ni lo miraba, por buscar un solo nombre de
    # funcion.
    'comun.rangos':     ('UMBRAL', lambda v: [(r, n + 7) for r, n in v]),
    'comun.respaldo':   ('FOTOS', lambda v: '/no/existe'),
    'comun.nacional':   ('PISO', lambda v: (v or 0) + 40),
    # ⚠️ SE LE ROMPE EL PLAZO Y NO `MEMORIA`, y no es lo mismo. El
    # chequeo de la cadencia se apunta a un archivo temporal para no
    # pisar la memoria de verdad, asi que romper `MEMORIA` no lo tocaria
    # y saldria «no la mira» sin que eso signifique nada. El plazo si lo
    # mira: con 0 h el barrido nunca es dirigido y el ahorro desaparece.
    'bot.escuchar':     ('HORAS_BARRIDO', lambda v: 0),
    # ⚠️ SE LE VACIA `ARRASTRE`, que es el conjunto que impide que una
    # columna de la vitrina se borre en silencio. Sin el, `sin_dueno()`
    # tiene que marcar `Rapero` y `Rango` como huerfanas — y si no las
    # marca, el escritor puede vaciar una hoja publica sin fallar.
    'sheet.rankings':   ('ARRASTRE', lambda v: ()),
    # ⚠️ `IGUAL` ES EL CORTE QUE DECIDE SI DOS MENSAJES SON EL MISMO
    # EVENTO. Subido a 0,999 la llave reposteada deja de agruparse, y
    # entonces entra dos veces con dos numeros — el unico error de esa
    # cadena que no se arregla volviendo a correr. Si el chequeo no se
    # entera, no esta mirando el caso que dice mirar.
    'bot.llaves_a_entrada': ('IGUAL', lambda v: 0.999),
}


def _silencio(fn):
    """Corre `fn` tragandose lo que imprima. Devuelve (salida, excepcion)."""
    viejo = sys.stdout
    buf = io.StringIO()
    sys.stdout = buf
    err = None
    try:
        r = fn()
    except BaseException as e:                       # noqa: BLE001
        r, err = None, e
    finally:
        sys.stdout = viejo
    return buf.getvalue(), r, err


def _se_quejo(salida, ret, err):
    """¿El chequeo avisó de algo?

    🔴 EL VALOR DE RETORNO NO SE MIRA, Y ESA FUE LA CUARTA VUELTA DE
    ESTA HERRAMIENTA. El repo usa dos convenciones opuestas:

        `_self_check()`          devuelve **cuántas fallaron** -> 8 es malo
        `rangos.verificar()`     devuelve **cuántas comprobó** -> 8 es bueno

    Tratando «entero ≠ 0» como queja, `verificar()` parecía quejarse
    siempre, y con eso el conteo agregado daba **igual con el dato roto
    que con el sano**: el módulo del rango —el dato más delicado del
    proyecto— salía como ciego cuando no lo es.

    Las dos formas que **no** son ambiguas son levantar una excepción y
    escribir 🔴. Las dos las usa el repo, así que alcanza con esas y no
    hay que adivinar la convención de cada función.
    """
    if err is not None:
        return True                     # reventó: se enteró
    return '🔴' in salida               # o lo dijo


def probar(nombre, const, romper):
    try:
        mod = importlib.import_module(nombre)
    except Exception as e:                           # noqa: BLE001
        return 'no importa', str(e)[:60]
    # ⚠️ NO TODOS SE LLAMAN `_self_check`. `comun/rangos.py` tiene
    # `verificar()`, y la primera version de esta herramienta lo daba por
    # «sin chequeo» — o sea que el modulo con el dato mas delicado del
    # proyecto, los umbrales de rango, quedaba fuera de la auditoria sin
    # que nada lo dijera. Buscar un solo nombre es la misma clase de
    # error que buscar nombres completos de pais.
    #
    # ⚠️ Y SE LLAMAN **TODAS**, NO LA PRIMERA. `comun/rangos.py` tiene
    # `verificar()` —los colores— y `verificar_umbrales()` —los numeros—,
    # y quedarse con la primera decia que el modulo no mira los umbrales
    # cuando si los mira, en la otra. Elegir una de varias es adivinar.
    fns = [getattr(mod, n) for n in
           ('_self_check', 'verificar', 'verificar_umbrales', 'comprobar',
            'probar')
           if callable(getattr(mod, n, None))]
    if not fns:
        return 'sin self-check', ''

    def fn():
        # ⚠️ SE IMPRIME LO QUE IMPRIMAN, no se traga. La version anterior
        # las corria dentro de `_silencio()` y devolvia solo un conteo:
        # con eso la salida quedaba vacia siempre y la comparacion
        # «cambio lo que imprime» dejaba de funcionar — dos modulos que
        # SI se enteraban pasaron a marcarse como ciegos. Romper la
        # herramienta arreglandola es el mismo error que mide.
        # ⚠️ LA QUEJA SE REEMITE, NO SE CUENTA. La version anterior
        # atrapaba la excepcion de la sub-funcion y devolvia un numero —
        # y como `_se_quejo()` ya no mira los numeros, la señal se perdia
        # entre las dos capas: `verificar_umbrales()` reventaba de verdad
        # y el agregador lo reportaba como «no se entero».
        #
        # Tres capas y en cada una perdi la señal de una forma distinta.
        # Por eso ahora se vuelve a escribir el 🔴, que es el unico canal
        # que `_se_quejo()` entiende.
        n = 0
        for f in fns:
            salida, ret, err = _silencio(f)
            sys.stdout.write(salida)
            if _se_quejo(salida, ret, err):
                n += 1
                sys.stdout.write('🔴 %s: %s\n'
                                 % (f.__name__, str(err or '')[:60]))
        return n
    if not hasattr(mod, const):
        return 'sin la constante %s' % const, ''

    # 1 · como esta hoy, para tener con que comparar
    s1, r1, e1 = _silencio(fn)

    # 2 · roto
    original = getattr(mod, const)
    try:
        setattr(mod, const, romper(original))
        s2, r2, e2 = _silencio(fn)
    finally:
        setattr(mod, const, original)                # SIEMPRE se restaura

    # 🔴 DOS CONVENCIONES, Y CONFUNDIRLAS ME DIO UN FALSO POSITIVO.
    # `_self_check()` devuelve **cuantas fallaron**, asi que 8 es malo.
    # `rangos.verificar()` devuelve **cuantas comprobo**, asi que 8 es
    # bueno — levanta excepcion cuando algo esta mal. Mirando solo el
    # numero, marque como roto el modulo del dato mas delicado del
    # proyecto.
    #
    # Lo que vale para las dos: **si la salida cambia, se entero**. Es
    # mas tosco y no depende de adivinar la convencion de cada funcion.
    # 🔴 «CIEGO» Y «SIN DATOS» NO SON LO MISMO, y confundirlos hacía
    # fallar la auditoría entera. Despues del reset del 22/09 el pool
    # queda vacio a proposito —es lo correcto entre el reset y el
    # primer evento de la T1— y un chequeo que no tiene ni una fila que
    # medir no puede enterarse de nada. Eso no es un guardian roto: es
    # un guardian sin nada que vigilar todavia.
    #
    # ⚠️ EL MODULO LO DECLARA, no se adivina. Los chequeos que dependen
    # del pool imprimen `SIN_DATOS` cuando esta vacio; sin esa marca,
    # esto no puede distinguir «no mira la constante» de «no habia nada
    # que mirar», y elegiria mal justo el dia del reset.
    if SIN_DATOS in s1:
        return 'sin datos para medir', const
    if _se_quejo(s1, r1, e1):
        # ya "se queja" sin tocar nada: la convencion del numero no
        # aplica. Se cae a comparar salidas, que sigue siendo valido.
        cambio = (s1, r1, type(e1)) != (s2, r2, type(e2))
        return ('se entera (por la salida)' if cambio
                else 'NO se entera'), const
    return ('se entera' if _se_quejo(s2, r2, e2)
            or s1 != s2 else 'NO se entera'), const


def main():
    print('\n══ ¿LOS SELF-CHECK CHEQUEAN ALGO? ══\n')
    if '--ver' in sys.argv:
        for m in sorted(QUE_ROMPER):
            print('   %s' % m)
        return 0
    print('   se le rompe una constante en memoria y se ve si avisa\n')
    ciegos, sin_datos = [], []
    for nombre in sorted(QUE_ROMPER):
        const, romper = QUE_ROMPER[nombre]
        estado, extra = probar(nombre, const, romper)
        icono = {'se entera': '✅', 'NO se entera': '🔴',
                 'sin datos para medir': '⚠️'}.get(estado, '·')
        print('   %s %-24s %-26s %s' % (icono, nombre.split('.')[-1],
                                        estado, extra))
        if estado == 'sin datos para medir':
            sin_datos.append((nombre, const))
        if estado == 'NO se entera':
            ciegos.append((nombre, const))
    if ciegos:
        print('\n   🔴 %d chequeo(s) no se enteran de que su dato cambió:'
              % len(ciegos))
        for n, c in ciegos:
            print('      %s  (rompí %s y siguió en verde)' % (n, c))
        print('\n   Eso no quiere decir que estén mal escritos: quiere decir')
        print('   que esa constante no la miran. Si debería mirarla, el')
        print('   chequeo tiene un agujero del tamaño de esa constante.\n')
        return 1
    # ⚠️ NO SE AFIRMA LO QUE NO SE MIDIO. «Todos se enteran» con dos
    # chequeos que no tuvieron datos es la misma mentira cómoda que
    # esta herramienta existe para encontrar, escrita por la
    # herramienta misma.
    if sin_datos:
        print('\n   ✅ los %d que se pudieron medir se enteran'
              % (len(QUE_ROMPER) - len(sin_datos)))
        print('   ⚠️ %d SIN COMPROBAR por falta de datos: %s'
              % (len(sin_datos), ', '.join(n.split('.')[-1]
                                           for n, _c in sin_datos)))
        print('      Se vuelven a medir solos cuando el pool tenga gente.\n')
        return 0
    print('\n   ✅ todos se enteran\n')
    return 0


if __name__ == '__main__':
    sys.exit(main())
