# -*- coding: utf-8 -*-
"""LA HOJA AKAs DEL OPERATIVO -> datos/akas.json

    python sheet/construir_akas.py        lee el Sheet y guarda el JSON

⚠️ ESTA HOJA EXISTIA DESDE SIEMPRE Y NADIE LA LEIA. `comun/crews.py` la
nombra hace meses —*«la hoja AKAs del Operativo resuelve kibak -> valen, y este
cruce NO los resuelve»*— y ahi quedo: una decision escrita en un lugar y el
codigo leyendo otro, que es la forma que `CLAUDE.md` documenta tres veces.

Lo que costaba: **la misma persona contada dos veces**. Oasis y Fullylo4ded son
uno solo (Dlx, 18/09/2026), y el padron los trae como dos filas — una con
Discord ID y la otra sin. O sea que los conteos de «cuantos sin ID» y «cuantos
perderian la carta» estaban inflados, y `herramientas/ids_cruzados.py` marcaba
como ID cruzado lo que era un alias.

⚠️ TRAE DOS TABLAS Y LA SEGUNDA ES LA IMPORTANTE. A la izquierda va
`Alias -> Nombre Real`. A la derecha va **«⚠️ NO CONFUNDIR»**: pares que
parecen la misma persona y NO lo son, con el motivo —`Blood 🇧🇴` contra
`Bloody 🇨🇴`, `7 🇨🇴` contra `7po 🇨🇱`, `Reyes 🇨🇴` contra `Reyes Mc 🇨🇱`—.

Eso segundo es un **guardia contra unir de mas**, y no es hipotetico: el
18/09/2026 una heuristica de parecido de nombres marco 9 IDs como cruzados y
**seis eran falsos**. Una lista de «estos dos se parecen y son distintos» es
exactamente lo que le faltaba.

⚠️ LAS DOS TABLAS ESTAN UNA AL LADO DE LA OTRA Y NO ARRANCAN EN LA MISMA FILA.
La de la izquierda tiene su cabecera en la fila 0 y la de la derecha en la
fila 1, asi que leer «de la fila 1 en adelante» mete `Persona 1 | Persona 2`
como si fuera un par de gente. Se busca cada cabecera por su nombre.
"""
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)

SALIDA = os.path.join(BASE, 'datos', 'akas.json')
HOJA = 'AKAs'


def _celda(fila, i):
    return (fila[i] or '').strip() if (i is not None and len(fila) > i) else ''


def _donde(v, texto, hasta=4):
    """(fila, columna) de la cabecera que contiene `texto`. None si no esta."""
    for f in range(min(hasta, len(v))):
        for c, x in enumerate(v[f]):
            if texto.lower() in (x or '').strip().lower():
                return f, c
    return None


def leer():
    """Las dos tablas, desde el Sheet. Pide creds.json."""
    import gspread
    from google.oauth2.service_account import Credentials
    import construir_padron as PAD

    cred = os.path.join(BASE, 'creds.json')
    if not os.path.exists(cred):
        sys.exit('falta creds.json en la raiz del proyecto')
    gc = gspread.authorize(Credentials.from_service_account_file(
        cred, scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']))
    v = gc.open_by_key(PAD.OPERATIVO).worksheet(HOJA).get_all_values()

    pares, cuidado = [], []

    pos = _donde(v, 'Alias')
    if pos:
        f, c = pos
        real = _donde(v, 'Nombre Real')
        cr = real[1] if real else c + 1
        for fila in v[f + 1:]:
            a, r = _celda(fila, c), _celda(fila, cr)
            if a and r:
                pares.append([a, r])

    pos = _donde(v, 'Persona 1')
    if pos:
        f, c = pos
        for fila in v[f + 1:]:
            a, b = _celda(fila, c), _celda(fila, c + 1)
            if a and b:
                cuidado.append([a, b, _celda(fila, c + 2)])

    return pares, cuidado


A_MANO = os.path.join(BASE, 'datos', 'akas_a_mano.json')


def a_mano():
    """Lo que Dlx dijo por chat y el Sheet todavia no sabe. `(pares, cuidado)`

    🔴 EXISTE PORQUE LA DECISION LLEGABA Y NO TENIA DONDE CAER. Este
    mismo archivo nombra en su docstring a **Oasis y Fullylo4ded** como
    el caso que lo motivo —Dlx, 18/09/2026— y el 22/09 `datos/akas.json`
    seguia sin el par: la hoja del Sheet nunca se edito. Medido ese dia,
    los dos tenian **su set completo de 16 cartas** en R2, o sea una
    persona contada dos veces por el sistema entero.

    Es la forma que `CLAUDE.md` llama «un default que no es la decision»:
    la decision existia en un lugar —la conversacion, y hasta el
    docstring de acá— y el codigo leia otro.

    ⚠️ SE SUMA, NO REEMPLAZA. El Sheet sigue siendo la fuente; esto es
    lo que le falta. Y va **al final** para que gane, porque el motivo
    de escribirlo a mano es siempre que lo de alla esta viejo.
    """
    try:
        with io.open(A_MANO, encoding='utf-8') as f:
            d = json.load(f)
    except (OSError, ValueError):
        return [], []
    return ([p for p in (d.get('pares') or ()) if len(p) == 2],
            [c for c in (d.get('no_confundir') or ()) if len(c) >= 2])


def _avisos(pares, norm):
    """Lo que esta raro en la tabla. No se arregla: se dice."""
    mal = []
    # el mismo alias apuntando a dos personas distintas
    visto = {}
    for a, r in pares:
        k = norm(a)
        if k in visto and norm(visto[k]) != norm(r):
            mal.append('el alias "%s" apunta a "%s" y tambien a "%s"'
                       % (a, visto[k], r))
        visto[k] = r
    # ⚠️ CADENAS: si `A -> B` y `B -> C`, quien resuelva una sola vez se queda
    # en B. Se avisan SIEMPRE, porque una cadena puede ser un error de carga;
    # y además `_aplanar()` las resuelve en el mapa, porque avisar solo no
    # alcanzaba: ver ahí.
    reales = {norm(r) for _, r in pares}
    for a, r in pares:
        if norm(r) in {norm(x) for x, _ in pares} and norm(a) != norm(r):
            destino = next((y for x, y in pares if norm(x) == norm(r)), None)
            if destino and norm(destino) != norm(r):
                mal.append('cadena: "%s" -> "%s" -> "%s"' % (a, r, destino))
    # un alias que tambien figura como nombre real de otro
    for a, _ in pares:
        if norm(a) in reales and not any(norm(x) == norm(a) and norm(y) == norm(a)
                                         for x, y in pares):
            pass
    return mal


def _aplanar(alias, norm):
    """Cada alias apuntando a su nombre FINAL, no a otro alias.

    🔴 SEIS LECTORES DEL MAPA DABAN UN SOLO SALTO, y cinco lo seguían
    hasta el final. Medido el 25/09/2026 con la única cadena de hoy
    —`gekto -> geekto` (a mano) y `geekto -> Presagio` (la hoja)—:
    `rankings.canon()`, `llaves_a_entrada`, `olvidar.huerfanas()`,
    `construir_padron` y `subir_datos` contestaban **Presagio**;
    `decidir.py`, `registrar_ids.py`, `altas_desde_inscripciones.py`,
    `lista_raperos.dobles()` y `resolver()` de acá contestaban **geekto**,
    que ya no es nadie: se fusionó esa madrugada. Y `motor.py` contestaba
    una u otra **según el orden del dict** — hoy Presagio, de casualidad.

    ⚠️ SE ARREGLA ACÁ Y NO EN LOS SEIS. Es el mismo embudo que `canon()`
    explica para las vitrinas: puesto en cada lector, el séptimo que se
    escriba vuelve a dar un salto. Con el mapa ya plano, un salto **es**
    el final, y los que siguen la cadena terminan en el primero.

    ⚠️ LA CADENA SE SIGUE AVISANDO: aplanar no es esconder. `_avisos()`
    mira `pares`, que queda tal cual la escribió la hoja.

    ⚠️ CON TOPE Y CON MEMORIA, como `canon()`: `a -> b -> a` es un ciclo
    declarado mal, y `bna -> BNA` apunta a sí mismo con otra caja.
    """
    out = {}
    for k, r in alias.items():
        vis, act = {k}, r
        for _ in range(8):
            nk = norm(act)
            if nk in vis or nk not in alias:
                break
            vis.add(nk)
            act = alias[nk]
        out[k] = act
    return out


def cargar():
    """Lo ya guardado. NO pide credenciales."""
    if not os.path.exists(SALIDA):
        return {}
    with io.open(SALIDA, encoding='utf-8') as f:
        return json.load(f)


def resolver(nombre, datos=None):
    """El nombre real de alguien, o el mismo nombre si no es un alias."""
    import construir_padron as PAD
    d = datos if datos is not None else cargar()
    return (d.get('alias') or {}).get(PAD.norm(nombre), nombre)


def son_distintos(a, b, datos=None):
    """True si la hoja dice EXPRESAMENTE que esos dos NO son la misma persona."""
    import construir_padron as PAD
    d = datos if datos is not None else cargar()
    na, nb = PAD.norm(a), PAD.norm(b)
    for x, y, _ in (d.get('no_confundir') or []):
        if {PAD.norm(x), PAD.norm(y)} == {na, nb}:
            return True
    return False


def main():
    import construir_padron as PAD

    pares, cuidado = leer()
    mp, mc = a_mano()

    # 🔴 LO QUE DLX DIJO POR CHAT LE GANA A LA HOJA EN LAS DOS
    # DIRECCIONES, y hasta el 24/09/2026 ganaba en una sola. Un `pares` a
    # mano retractaba el «no confundir» de la hoja —es lo que hizo falta
    # con Makma/Makmah— pero un `no_confundir` a mano NO retractaba un
    # par de la hoja: se sumaba a la lista y el par seguia fusionando.
    #
    # El caso que lo destapo: la hoja `AKAs` dice `Santz -> Santos`, y
    # Dlx, 24/09/2026: *«Santz y Santos son diferentes»*. Tienen dos
    # Discord ID distintos (1201718668463972363 y 975234612953497651), o
    # sea que eran dos cuentas de dos personas y el sistema las contaba
    # como una. Con la regla vieja no habia forma de deshacerlo desde el
    # repo: habia que esperar a que alguien editara la hoja.
    #
    # ⚠️ Y SI LO MANUAL SE CONTRADICE A SI MISMO, GANA «NO CONFUNDIR».
    # Es el error barato: dos personas contadas por separado se arreglan
    # declarando el alias; una persona que se lleva los puntos y la
    # tarjeta de otra ya salio publicada.
    _k = lambda a, b: frozenset((PAD.norm(a), PAD.norm(b)))
    man_p = {_k(a, r) for a, r in mp}
    man_c = {_k(c[0], c[1]) for c in mc}
    choque_manual = man_p & man_c
    if choque_manual:
        print('   🔴 akas_a_mano.json dice las dos cosas de %d par(es): '
              'gana NO CONFUNDIR' % len(choque_manual))
        mp = [x for x in mp if _k(*x) not in choque_manual]
        man_p -= choque_manual
    pares_retr = [x for x in pares if _k(*x) in man_c]
    pares = [x for x in pares if _k(*x) not in man_c]
    for a, r in pares_retr:
        print('   🔁 RETRACTADO el alias de la hoja %s -> %s: Dlx dijo '
              'que son distintos' % (a, r))

    # ⚠️ AL FINAL, PARA QUE GANE. Ver `a_mano()`.
    pares = pares + [p for p in mp if p not in pares]
    cuidado = cuidado + [c for c in mc if c not in cuidado]

    # 🔴 UN PAR NO PUEDE SER «LA MISMA PERSONA» Y «NO CONFUNDIR» A LA VEZ,
    # y hasta el 24/09/2026 podía: las dos listas se armaban por separado y
    # nada las cruzaba. El caso que lo destapó es Makma/Makmah — la hoja
    # AKAs del Sheet los tenía como «⚠️ NO CONFUNDIR · DOS Makmahs (Dlx)» y
    # Dlx dijo por chat que **son la misma persona**.
    #
    # ⚠️ GANA `pares`, Y SE DICE EN VOZ ALTA. `alias` se arma sólo desde
    # `pares`, así que la contradicción no rompía nada visible — dejaba una
    # anotación diciendo lo contrario de lo que el código hace, que es peor
    # que un error: es documentación que miente.
    #
    # ⚠️ Es la única forma de RETRACTAR algo de la hoja desde el repo. Todo
    # lo demás de `akas_a_mano.json` suma; esto resta, porque la hoja se
    # edita a mano y una decisión nueva de Dlx no puede esperar a eso.
    _pn = {frozenset((PAD.norm(a), PAD.norm(r))) for a, r in pares}
    retractados = [c for c in cuidado
                   if frozenset((PAD.norm(c[0]), PAD.norm(c[1]))) in _pn]
    cuidado = [c for c in cuidado if c not in retractados]

    alias = {}
    for a, r in pares:
        alias[PAD.norm(a)] = r
    # ⚠️ Plano: cada alias apunta al nombre final. Ver `_aplanar()`.
    alias = _aplanar(alias, PAD.norm)

    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    with io.open(SALIDA, 'w', encoding='utf-8', newline='\n') as f:
        json.dump({'_leeme': [
            'La hoja AKAs del Operativo. La construye sheet/construir_akas.py.',
            'alias: nombre normalizado -> como se escribe de verdad.',
            'no_confundir: pares que PARECEN la misma persona y NO lo son.',
        ], 'alias': alias, 'pares': pares, 'no_confundir': cuidado},
            f, ensure_ascii=False, indent=1)

    print('-> %s' % os.path.relpath(SALIDA, BASE))
    print('   %d alias  ·  %d pares marcados NO CONFUNDIR'
          % (len(alias), len(cuidado)))
    for c in retractados:
        print('   🔁 RETRACTADO el «no confundir» de %s / %s' % (c[0], c[1]))
        print('      (%s) — hay un par que dice que son la misma persona.'
              % (c[2] if len(c) > 2 else 'sin motivo anotado'))
        print('      ⚠️ Sacarlo también de la hoja AKAs del Operativo, o '
              'vuelve\n         a entrar en cada corrida.')

    for m in _avisos(pares, PAD.norm):
        print('   ⚠️  %s' % m)

    # ⚠️ EL NUMERO QUE IMPORTA: cuantos del padron son en realidad otro que ya
    # esta. Cada uno de esos es una persona contada dos veces en todo lo demas.
    padron = PAD.cargar()
    if not padron:
        return
    nombres = {PAD.norm(p['raw']) for p in padron}
    dobles = [(p['raw'], alias[PAD.norm(p['raw'])]) for p in padron
              if PAD.norm(p['raw']) in alias
              and PAD.norm(alias[PAD.norm(p['raw'])]) in nombres
              and PAD.norm(alias[PAD.norm(p['raw'])]) != PAD.norm(p['raw'])]
    print('\n   %d fila(s) del padron son un alias de OTRA fila del padron:'
          % len(dobles))
    idx = PAD.por_nombre(padron)
    # ⚠️ NO ALCANZA CON DECIR «ESTAN DUPLICADOS»: lo que cuesta plata es DONDE
    # quedo el Discord ID. Si esta en la fila del alias y no en la del nombre
    # real, todo el pipeline —que busca por el nombre real— cree que esa
    # persona no tiene ID. Es la firma del proyecto: el dato estaba y nadie
    # iba a buscarlo ahi.
    rescatables, dos_ids = [], []
    for a, r in dobles:
        ia = (idx.get(PAD.norm(a)) or {}).get('discord_id') or ''
        ir = (idx.get(PAD.norm(r)) or {}).get('discord_id') or ''
        marca = ''
        if ia and not ir:
            marca = '   <- el ID esta en el ALIAS, y el pipeline busca por el real'
            rescatables.append((r, ia))
        elif ia and ir and ia != ir:
            marca = '   <- DOS ID DISTINTOS para la misma persona'
            dos_ids.append((a, ia, r, ir))
        print('      %-14s es %-14s  alias:%-20s real:%s%s'
              % (a, r, ia or '—', ir or '—', marca))
    if dobles:
        print('   -> cada una se cuenta dos veces en los pools y en los conteos')
    if rescatables:
        print('\n   🔴 %d persona(s) que FIGURAN SIN DISCORD ID Y LO TIENEN:'
              % len(rescatables))
        for r, i in rescatables:
            print('      %-16s %s' % (r, i))
        print('      -> se arregla uniendo las dos filas en el Sheet')
    if dos_ids:
        print('\n   🔴 %d con DOS ID distintos — alguno sobra o es de otro:'
              % len(dos_ids))
        for a, ia, r, ir in dos_ids:
            print('      %s=%s   vs   %s=%s' % (a, ia, r, ir))


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
