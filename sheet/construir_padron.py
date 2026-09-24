"""EL PADRON: quien es cada uno, con su Discord ID.

    python sheet/construir_padron.py        -> datos/padron.json

Lee la hoja **Lista de Raperos** del Sheet **Operativo**, que es otra planilla
distinta del Sheet Oficial que leen los otros tres builders.

⚠️ **ESTA PLANILLA EXISTIA Y EL PIPELINE NO LA CONOCIA.** Hasta el 17/09/2026
todo el proyecto leia solo el Oficial, y por eso `CLAUDE.md` decia que los
avatares *«se estan muriendo y nada los repone»* y que *«no se puede refrescar
desde el Sheet, porque el Sheet no los tiene»*. No los tiene **ese** Sheet. El
Operativo tiene **Discord ID** y **Avatar**, y ademas el pais en su propia
columna en vez de pegado al nombre como emoji.

Es la cuarta vez que aparece la misma forma en este proyecto: **el dato estaba
y el pipeline no iba a buscarlo**.

QUE TRAE, MEDIDO EL 17/09/2026
------------------------------
    870 personas en la Lista
    138 de 138 de los que tienen carta estan ahi
    101 de 138 con Discord ID
     94 de 138 con una URL de avatar guardada

⚠️ **EL DISCORD ID VALE MUCHO MAS QUE LA URL GUARDADA.** Medido sobre 25:

    las URLs del Sheet        21 de 25 vivas   (16% ya muertas, y siguen cayendo)
    pedir la foto con el ID   25 de 25         y NO PUEDE CADUCAR

La URL guarda un hash que Discord invalida cuando la persona cambia su foto.
El ID no cambia nunca, asi que con el ID + el token del bot se pide **la foto
de hoy**. Es el arreglo que `CLAUDE.md` viene pidiendo hace meses y que estaba
bloqueado esperando justamente el token.

LA CABECERA SE BUSCA POR SU ROTULO, NO POR SU FILA
--------------------------------------------------
⚠️ Hoy esta en la fila 9, pero **eso es una consecuencia de cuanta decoracion
tiene encima**, no una decision. Tres de los cuatro builders viejos la tienen
clavada como `v[15]` o `c[11]` y se rompen si la planilla se corre una fila.
`construir_pool_mundial.py` la busca por rotulo y sobrevive; este hace lo
mismo. Ver `docs/sheet_estructura.md`.
"""
import json
import os
import re
import sys
import unicodedata

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)

# ⚠️ NO ES EL MISMO SHEET QUE LOS OTROS BUILDERS. El Oficial es la vitrina
# publica; el Operativo es donde se cargan los eventos y vive el padron.
OPERATIVO = '1DFar2NSlC9YvkMQ_uKzLmfOrmthJ1lp-l3exP0NFHm8'
HOJA = 'Lista de Raperos'
SALIDA = os.path.join(BASE, 'datos', 'padron.json')

# Las que tienen que estar para que la fila sea la cabecera.
CLAVES = ('Rapero', 'Discord ID')

# Lo que Google devuelve cuando la celda esta "en duda", que no es un dato.
VACIOS = {'', '?', '❓', '❌'}


def norm(s):
    """Misma normalizacion que comun/respaldo.py, para que crucen."""
    s = re.sub(r'[\U0001F1E6-\U0001F1FF]', '', str(s)).replace('❓', '')
    s = unicodedata.normalize('NFD', s.strip().lower())
    return ''.join(c for c in s if c.isalnum())


def limpio(s):
    """El nombre sin la bandera ni los signos, tal como lo usa el pool."""
    return re.sub(r'[\U0001F1E6-\U0001F1FF]', '', str(s)).replace('❓', '').strip()


def _cabecera(filas, claves=CLAVES, mirar=25):
    """La cabecera de LA LISTA, no la de la primera cosa que se le parezca.

    🔴 BUSCAR LA PRIMERA NO ALCANZA, Y ESTUVO MAL DESDE QUE SE ESCRIBIO.
    Arriba de la lista hay un **panel de busqueda**: una caja donde se escribe
    un nombre y debajo salen las coincidencias, **con su propia cabecera
    identica**. Medido el 17/09/2026:

        fila 1   🔍 Buscar rapero:  |  Dlx
        fila 2   Rapero | Bandera | SV | Verificado | Discord ID | ...   <- panel
        fila 3-6 las coincidencias
        fila 8   "Mostrando 4 de 4 coincidencias"
        fila 9   Rapero | Bandera | SV | Verificado | Discord ID | ...   <- LA LISTA
        fila 10+ las 870 personas

    Tomando la primera, el padron se comia como personas **las coincidencias
    de la ultima busqueda que alguien hizo**, mas la linea «Mostrando N de N»
    y la cabecera de la fila 9 —que entraba como un rapero llamado «Rapero»
    con el Discord ID «Discord ID»—.

    ⚠️ LO GRAVE NO ES EL NUMERO, ES DE QUE DEPENDE: el contenido del padron
    dependia de **lo que alguien hubiera tipeado en una celda**. El dia que la
    busqueda fuera «Konan», Konan entraba dos veces y la copia del panel
    pisaba a la de verdad en `por_nombre()`. Ya estaba pasando con **OG**, que
    si esta entre los 138.

    La regla nueva no usa numeros de fila: de todas las candidatas se queda
    con **la que tiene mas gente debajo**. El panel muestra unas pocas; la
    lista, cientos. Si mañana el panel se mueve o aparece otro, sigue andando.
    """
    cands = [i for i, r in enumerate(filas[:mirar])
             if all(c in [x.strip() for x in r] for c in claves)]
    if not cands:
        raise LookupError(
            'no encontre la cabecera: ninguna de las primeras %d filas de "%s" '
            'tiene %s. Si la planilla cambio, hay que mirarla.'
            % (mirar, HOJA, ' y '.join(claves)))

    def cuantos(i):
        """Nombres seguidos debajo de esa cabecera, hasta la siguiente."""
        fin = min([c for c in cands if c > i] or [len(filas)])
        return sum(1 for r in filas[i + 1:fin] if r and str(r[0]).strip())

    mejor = max(cands, key=cuantos)
    if len(cands) > 1:
        print('   ⚠️ %d cabeceras iguales en la hoja (filas %s). Se usa la de '
              'la fila %d, que tiene %d nombres debajo; las otras son paneles.'
              % (len(cands), ', '.join(str(c + 1) for c in cands),
                 mejor + 1, cuantos(mejor)))
    return mejor


def _dato(fila, i):
    if i is None or len(fila) <= i:
        return ''
    v = (fila[i] or '').strip()
    return '' if v in VACIOS else v


# Un snowflake de Discord tiene 17 a 20 digitos. Los que quedan afuera se
# guardan aparte para que `main()` los cante.
RECHAZADOS = []


def _id_discord(v, quien):
    """El Discord ID, o '' si lo que hay en la celda no puede serlo.

    🔴 UN ID TIPEADO EN UNA CELDA DE NUMERO SE DESTRUYE DENTRO DEL SHEET, y
    esto no lo arregla: lo DETECTA. Google Sheets guarda los numeros como
    `double`, que es exacto hasta 2**53 = 9.007.199.254.740.992 — dieciseis
    digitos. Un snowflake de hoy tiene diecinueve. O sea que en cuanto la
    celda no esta formateada como texto, **los ultimos digitos se pierden al
    escribirlos**, antes de que este script exista.

    Encontrado el 18/09/2026 en `aze gian`, cuya celda decia
    `1.94176670318592E+17`. Reconstruido da 194176670318592000, que como
    snowflake es del 19/06/2016: era un ID de verdad y le faltan tres digitos.

    ⚠️ LO QUE SE VE ES EL CASO AMABLE. La notacion cientifica aparece porque
    la columna es angosta; con la columna ancha, la misma celda muestra
    diecinueve digitos **ya redondeados** y se lee como un ID perfecto que no
    es de nadie — o, peor, que es de otro. Por eso ademas de la forma, hay que
    preguntarle a Discord: `herramientas/ids_cruzados.py`.

    ⚠️ Y SE DESCARTA, NO SE ARREGLA. Los digitos perdidos no se pueden
    adivinar. Dejar el roto seria peor que no tener nada: `/card` sin
    argumentos busca por ID, asi que un ID que no es de nadie es una persona
    que el bot no reconoce, y un ID que cayo encima de otro es la carta
    equivocada. Sin dato no hay pieza, tambien aca.

    ⚠️ Se arregla EN EL SHEET: formatear la columna como **texto plano** y
    volver a pegar el ID. Formatearla despues no lo devuelve — el numero ya
    se guardo redondeado.
    """
    if not v:
        return ''
    s = v.replace(' ', '')
    if s.isdigit() and 17 <= len(s) <= 20:
        return s
    RECHAZADOS.append((quien, v))
    return ''


def leer():
    """El padron, desde el Sheet. Pide creds.json."""
    import gspread
    from google.oauth2.service_account import Credentials
    cred = os.path.join(BASE, 'creds.json')
    if not os.path.exists(cred):
        sys.exit('falta creds.json en la raiz del proyecto')
    gc = gspread.authorize(Credentials.from_service_account_file(
        cred, scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']))
    from reintentar import leer as _leer_reint   # ver `sheet/reintentar.py`
    # ⚠️ con `lambda`: `open_by_key` y `worksheet` tambien pegan a la API
    v = _leer_reint(lambda: gc.open_by_key(OPERATIVO).worksheet(HOJA).get_all_values())

    i = _cabecera(v)
    H = [x.strip() for x in v[i]]
    col = lambda n: H.index(n) if n in H else None
    iR, iB = col('Rapero'), col('Bandera')
    iS, iV = col('SV'), col('Verificado')
    iD, iA = col('Discord ID'), col('Avatar')
    iN = col('Notas')

    gente = []
    for r in v[i + 1:]:
        full = (r[iR] or '').strip() if len(r) > iR else ''
        if not full:
            continue
        gente.append({
            'full': full,
            'raw': limpio(full),
            # ⚠️ el pais viene EN SU COLUMNA, no pegado al nombre como emoji.
            # Es lo que el Sheet Oficial no tiene y hay que parsear a mano.
            'pais': _dato(r, iB),
            'sv': _dato(r, iS),
            'verificado': _dato(r, iV),
            'discord_id': _id_discord(_dato(r, iD), full),
            'av_sheet': _dato(r, iA),
            'notas': _dato(r, iN),
        })
    return gente


def heredar_de_alias(gente):
    """Si la fila REAL no tiene un dato y su alias si, se lo lleva.

    🔴 EL DISCORD ID VIVIA EN LA FILA EQUIVOCADA Y COSTABA LA TARJETA.
    `datos/akas.json` dice que `KRT` es `Krtman`, asi que todo el sistema
    canoniza a `Krtman` — y **el Discord ID esta en la fila `KRT`**.
    Medido el 24/09/2026 contra el porton de identidad:

        KRT      id=1359316127901024357   pasa=True
        Krtman   id=—                     pasa=False

    La misma persona pasa con el nombre que el sistema NO usa y falla con
    el que si. `/card` le contesta «todavia no estas verificado» a alguien
    que lo esta — la respuesta equivocada con la cara de la correcta, que
    es exactamente lo que ya paso con los siete de `cartas_r2`. Lo mismo
    con `Lzz`/`Luzzano`.

    ⚠️ `construir_akas.py` YA LO AVISA en cada corrida —*«🔴 2 persona(s)
    que FIGURAN SIN DISCORD ID Y LO TIENEN»*— y termina en *«se arregla
    uniendo las dos filas en el Sheet»*, o sea esperando a una persona.
    Lleva dias impreso. El objetivo del proyecto es que esto se mantenga
    solo, asi que el sistema lo absorbe y el aviso queda para el dia que
    haya que unir las filas de verdad.

    ⚠️ SOLO RELLENA HUECOS, NUNCA PISA. Si las dos filas tienen el dato y
    **no coinciden**, no se elige: se avisa. Es el caso de
    `Santz`=1201718668463972363 contra `Santos`=975234612953497651, dos
    IDs distintos para lo que el mapa declara una sola persona — o sobra
    uno o son dos personas, y adivinar ahi le da a alguien la tarjeta de
    otro. Eso lo contesta Dlx, no un script.

    ⚠️ Y NO BORRA LA FILA DEL ALIAS. Sigue habiendo dos filas en el
    padron; lo que cambia es que la buena ya no esta coja. Borrar es una
    decision sobre el Sheet de Dlx.
    """
    import unicodedata

    def _k(x):
        return ''.join(c for c in unicodedata.normalize('NFKD', str(x or ''))
                       if c.isalnum()).lower()

    try:
        with open(os.path.join(BASE, 'datos', 'akas.json'),
                  encoding='utf-8') as f:
            al = (json.load(f) or {}).get('alias') or {}
    except (OSError, ValueError):
        # ⚠️ sin mapa no hay alias que seguir, y quedarse sin padron
        # porque falta un json seria mucho peor
        return gente, [], []

    def real(n):
        # siguiendo la cadena, igual que `rankings.canon()`
        vis, act = set(), n
        for _ in range(8):
            k = _k(act)
            if k in vis or k not in al:
                break
            vis.add(k)
            act = al[k]
        return act

    por = {}
    for x in gente:
        por.setdefault(_k(x.get('raw')), x)

    #: los campos que se pueden heredar. `full` y `raw` NO: son la
    #: identidad de esa fila, y copiarlos fusionaria dos filas sin
    #: decidirlo.
    CAMPOS = ('discord_id', 'pais', 'verificado', 'sv', 'av_sheet')
    movidos, choques = [], []
    for x in gente:
        r = real(x.get('raw'))
        if _k(r) == _k(x.get('raw')):
            continue
        destino = por.get(_k(r))
        if destino is None:
            continue
        for c in CAMPOS:
            a, b = (x.get(c) or ''), (destino.get(c) or '')
            if a and not b:
                destino[c] = a
                movidos.append((x.get('raw'), destino.get('raw'), c, a))
            elif a and b and a != b and c == 'discord_id':
                choques.append((x.get('raw'), destino.get('raw'), a, b))
    return gente, movidos, choques


def cargar():
    """El padron ya guardado. NO pide credenciales — es lo que usan los
    generadores y el bajador de avatares."""
    if not os.path.exists(SALIDA):
        return []
    with open(SALIDA, encoding='utf-8') as f:
        return json.load(f)


def por_nombre(gente=None):
    """{nombre normalizado: fila}. Con el mismo norm() que respaldo.py."""
    return {norm(p['raw']): p for p in (gente if gente is not None else cargar())}


def main():
    gente = leer()
    gente, movidos, choques = heredar_de_alias(gente)
    if movidos:
        print('   %d dato(s) que estaban en la fila del ALIAS y la fila '
              'real no tenia:' % len(movidos))
        for a, b, c, v in movidos[:8]:
            print('      %-12s -> %-12s %-12s %s'
                  % (a, b, c, str(v)[:24]))
    if choques:
        print('   🔴 %d con DOS Discord ID distintos — no se elige, '
              'lo decide Dlx:' % len(choques))
        for a, b, ia, ib in choques:
            print('      %-12s=%s  vs  %-12s=%s' % (a, ia, b, ib))
    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    with open(SALIDA, 'w', encoding='utf-8') as f:
        json.dump(gente, f, ensure_ascii=False, indent=1)
    print('-> %s   %d personas' % (os.path.relpath(SALIDA, BASE), len(gente)))

    # 🔴 PRIMERO LO ROTO. Va arriba de los porcentajes a proposito: un ID que
    # el Sheet destruyo no baja ningun numero —la celda esta llena— asi que
    # debajo de «Discord ID 332 · 38.2%» no se ve nunca.
    if RECHAZADOS:
        print('\n   🔴 %d celda(s) de Discord ID que NO son un ID:' % len(RECHAZADOS))
        for quien, v in RECHAZADOS:
            cien = 'e+' in v.lower()
            print('      %-22s %s%s' % (quien, v,
                  '   <- el Sheet lo guardo como NUMERO y perdio digitos'
                  if cien else ''))
        print('      -> se descartan: los digitos perdidos no se adivinan.')
        print('      -> en el Sheet: formatear esa columna como TEXTO PLANO y')
        print('         volver a pegar el ID. Formatearla despues no lo devuelve.')

    n = len(gente)
    print('\n   lleno, sobre las %d:' % n)
    for k, et in (('pais', 'pais'), ('sv', 'servidor'),
                  ('verificado', 'verificado'), ('discord_id', 'Discord ID'),
                  ('av_sheet', 'avatar')):
        c = sum(1 for p in gente if p[k])
        print('     %-12s %4d   %5.1f%%' % (et, c, 100 * c / max(n, 1)))

    # ⚠️ El numero que importa no es sobre 870 sino sobre los que TIENEN
    # CARTA. Medir sobre el padron entero da una foto optimista de un
    # problema que solo existe para 138 personas.
    p = os.path.join(BASE, 'datos', 'competitivo_pool.json')
    if not os.path.exists(p):
        return
    with open(p, encoding='utf-8') as f:
        pool = json.load(f)
    idx = por_nombre(gente)
    esta = sum(1 for x in pool if norm(x['raw']) in idx)
    con_id = sum(1 for x in pool if idx.get(norm(x['raw']), {}).get('discord_id'))
    print('\n   y sobre los %d que TIENEN CARTA:' % len(pool))
    print('     en el padron   %4d' % esta)
    print('     con Discord ID %4d   <- las fotos que se pueden pedir a Discord'
          % con_id)
    faltan = [x['raw'] for x in pool
              if not idx.get(norm(x['raw']), {}).get('discord_id')]
    if faltan:
        print('\n   sin Discord ID (%d): %s%s'
              % (len(faltan), ', '.join(faltan[:12]),
                 ' …' if len(faltan) > 12 else ''))


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
