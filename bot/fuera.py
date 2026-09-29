# -*- coding: utf-8 -*-
"""LAS TARJETAS DE QUIEN SE FUE, A LA SEMANA.

    python bot/fuera.py             qué anotaría y qué borraría (no toca nada)
    python bot/fuera.py --aplicar   anota, desanota y borra lo vencido
    python bot/fuera.py --auto      el self-check, sin red

🔑 Dlx, 27/09/2026: *«que sus tarjetas se borren después de 1 semana si se
va. Así para no ir borrando y rehacer todo»*. Quien deja de pasar el portón
—sale de DRA, pierde el Miembro, se queda sin país— ya no las ve en el bot
ni en la página (KV y el payload lo filtran), pero sus tarjetas seguían en
R2 **para siempre**. Medido ese día: 612 personas con tarjetas en R2 y 279
que no pasan el portón.

⚠️ UNA SEMANA SEGUIDA, Y NO UNA SEMANA EN TOTAL. El reloj arranca el
primer día que alguien no pasa y se borra si vuelve a pasar: quien sale y
vuelve a los tres días conserva todo, que es exactamente el «para no ir
borrando y rehacer todo». Y el reloj vive en `datos/fuera_desde.json`, que
`bot/ci/guardar.sh` commitea: un reloj que no sobrevive al runner arranca
de cero cada media hora y no vence nunca.

⚠️ SÓLO LAS TARJETAS. La foto (`fotos/<temporada>/`) se queda: es la cara de
esa temporada, la necesita la Histórica, y si la persona vuelve se usa de
nuevo. Borrar TODO lo de alguien es otra cosa y tiene su herramienta, que
se pide: `/borrar-mis-datos` (ver `bot/olvidar.py`).

⚠️ NO SE BORRA NADA QUE NO SE PUEDA REHACER. Una tarjeta sale de los
datos: si la persona vuelve a pasar el portón, el ciclo se la dibuja de
nuevo en la corrida siguiente —es el camino de «quien se verifica hoy»—.

🔑 Y VA POR CARTA DESDE EL 29/09/2026. Dlx aprobó que la Temporada y la
Servidor sean de todos los que jugaron y están en la Lista, verificados o no
(«Dale»). A quien está en la Lista y no pasa el portón le sobran sólo la
Competitiva, la de País y sus Bloqueadas: el reloj corre por ésas y al vencer
se borran ésas. Antes se borraba la carpeta entera — y ese 4/10 se iban las
Temporadas de 57 personas que ahora sí pueden tenerlas.

🔴 Y FRENA SI EL PORTÓN SE CAE. Si `datos/verificados.json` no está, o si de
una corrida a la otra pasan la mitad de los que pasaban, no es que se fue
media Liga: es que Discord no contestó bien. En ese caso no se anota a
nadie, que es la misma regla de `subir_datos.borrar_sobrantes()`.
"""
import datetime
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (BASE, SCR, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

#: los días seguidos sin pasar el portón antes de borrar sus tarjetas
DIAS = 7
#: cuántas personas se borran como mucho por corrida: el primer vencimiento
#: puede ser de cientos, y no hace falta hacerlo de un saque
TOPE = 60
ARCHIVO = os.path.join(BASE, 'datos', 'fuera_desde.json')
INVENTARIO = os.path.join(BASE, 'datos', 'cartas_r2.json')


def hoy_et():
    """La fecha de hoy en hora del este, que es la de la Liga."""
    try:
        from zoneinfo import ZoneInfo
        return datetime.datetime.now(ZoneInfo('America/New_York')).date()
    except Exception:                                    # noqa: BLE001
        return (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=4)).date()


def libre(carta):
    """¿Esta carta del inventario es de las LIBRES? `sv-*` son las camisetas de la
    Servidor y `bloq-temporada` la Bloqueada de la Temporada."""
    import verificados as VERIF
    base = carta[len('bloq-'):] if carta.startswith('bloq-') else carta
    return base in VERIF.LIBRES or carta.startswith('sv-')


def sobran(cartas, pasa, en_lista):
    """Las cartas del inventario que esa persona ya no puede tener: ninguna si pasa
    el portón, las que no son libres si está en la Lista, y todas si no."""
    if pasa:
        return []
    if en_lista:
        return sorted(c for c in cartas if not libre(c))
    return sorted(cartas)


def estado(claves, pasa, hoy, previo):
    """`(desde, vencidas)`: el reloj de cada uno y a quién ya le toca.

    `claves` son las carpetas de R2 con tarjetas, `pasa(clave)` el portón y
    `previo` el `{clave: 'AAAA-MM-DD'}` de la corrida anterior. Quien pasa
    sale del reloj; quien no pasa conserva su fecha o arranca hoy.
    """
    desde = {}
    for k in claves:
        if pasa(k):
            continue
        d = previo.get(k)
        try:
            datetime.date.fromisoformat(d)
        except (TypeError, ValueError):
            d = hoy.isoformat()
        desde[k] = d
    vencidas = sorted(k for k, d in desde.items()
                      if (hoy - datetime.date.fromisoformat(d)).days >= DIAS)
    return desde, vencidas


def leer():
    try:
        with io.open(ARCHIVO, encoding='utf-8') as f:
            return json.load(f) or {}
    except (OSError, ValueError):
        return {}


def claves_r2(urls):
    """Las claves de los objetos de R2 a partir de sus URL públicas."""
    out = []
    for u in (urls or {}).values():
        k = str(u).split('.r2.dev/', 1)[-1] if '.r2.dev/' in str(u) else ''
        if k and '/' in k:
            out.append(k)
    return out


def main():
    aplicar = '--aplicar' in sys.argv
    import construir_padron as PAD
    import verificados as VERIF
    print('\n══ LAS TARJETAS DE QUIEN SE FUE (a los %d días) ══\n' % DIAS)
    try:
        with io.open(INVENTARIO, encoding='utf-8') as f:
            inv = json.load(f) or {}
    except (OSError, ValueError):
        print('   sin datos/cartas_r2.json: no hay inventario que mirar.\n')
        return 0
    verif, _cuando = VERIF.cargar()
    if verif is None:
        print('   ⚠️ sin datos/verificados.json no se sabe quién pasa: no anoto a nadie.\n')
        return 0
    idx = PAD.por_nombre()
    pasa = lambda k: VERIF.pasa(idx.get(k, {}), verif)          # noqa: E731
    # 🔑 POR CARTA: lo que le sobra a cada uno. El reloj corre mientras le sobre algo.
    sobran_de = lambda k: sobran(inv.get(k) or {}, pasa(k),     # noqa: E731
                                 VERIF.puede(idx.get(k, {}), verif, 'temporada'))
    en_regla = lambda k: not sobran_de(k)                       # noqa: E731
    # ⚠️ EL FRENO SIGUE MIRANDO EL PORTÓN: si pasan la mitad que ayer, no se fue
    # media Liga, se cayó Discord.
    pasan = sum(1 for k in inv if pasa(k))
    ant = leer()
    if ant.get('pasaban') and pasan < ant['pasaban'] * 0.5:
        print('   🔴 pasan el portón %d y la corrida anterior pasaban %d: eso no es gente'
              '\n      yéndose, es el portón que no se pudo leer bien. No anoto a nadie.\n'
              % (pasan, ant['pasaban']))
        return 0
    hoy = hoy_et()
    desde, vencidas = estado(inv, en_regla, hoy, ant.get('desde') or {})
    nuevos = sorted(set(desde) - set(ant.get('desde') or {}))
    volvieron = sorted(set(ant.get('desde') or {}) - set(desde))
    print('   con tarjetas en R2: %d · pasan el portón: %d · con el reloj andando: %d'
          % (len(inv), pasan, len(desde)))
    if nuevos:
        print('   %d empiezan a contar hoy' % len(nuevos))
    if volvieron:
        print('   %d volvieron a pasar (o ya no tienen tarjetas): salen del reloj' % len(volvieron))
    if desde and not vencidas:
        prox = min(datetime.date.fromisoformat(d) for d in desde.values()) + datetime.timedelta(DIAS)
        print('   el primer vencimiento es el %s' % prox.strftime('%d/%m/%Y'))
    borradas = list(ant.get('borradas') or [])
    if vencidas:
        lote = vencidas[:TOPE]
        print('   %d cumplieron %d días: %s%s'
              % (len(vencidas), DIAS, ', '.join(lote[:8]), '…' if len(lote) > 8 else ''))
        if aplicar:
            import olvidar as OLV
            s = OLV.sesion()
            quitar = {k: sobran_de(k) for k in lote}
            claves = [c for k in lote
                      for c in claves_r2({x: u for x, u in (inv.get(k) or {}).items() if x in quitar[k]})]
            idos, quedan = OLV.borrar_r2(s, claves)
            print('   R2: %d de %d objetos borrados%s'
                  % (idos, len(claves), (' · 🔴 quedan %d' % len(quedan)) if quedan else ''))
            no_del_todo = {q.rpartition('/')[0] for q in quedan}
            listas = [k for k in lote if k not in no_del_todo]
            for k in listas:
                # 🔑 SE SACAN LAS QUE SOBRABAN, no la persona: a quien está en la
                # Lista le quedan la Temporada y la Servidor.
                for x in quitar[k]:
                    (inv.get(k) or {}).pop(x, None)
                if not inv.get(k):
                    inv.pop(k, None)
                desde.pop(k, None)
                borradas.append([k, hoy.isoformat()])
            # el inventario sin ellos: si no, la corrida siguiente los vuelve
            # a encontrar y los intenta borrar otra vez
            with io.open(INVENTARIO, 'w', encoding='utf-8', newline='\n') as f:
                json.dump(inv, f, ensure_ascii=False, indent=1)
            print('   %d persona(s): se les borraron las que ya no pueden tener' % len(listas))
    if aplicar:
        with io.open(ARCHIVO, 'w', encoding='utf-8', newline='\n') as f:
            json.dump({'_leeme': 'El reloj de bot/fuera.py: desde qué día cada carpeta de R2 '
                                 'no pasa el portón. A los %d días seguidos se borran sus '
                                 'tarjetas (Dlx, 27/09/2026). No se edita a mano.' % DIAS,
                       'desde': dict(sorted(desde.items())), 'pasaban': pasan,
                       'cuando': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
                       'borradas': borradas[-200:]},
                      f, ensure_ascii=False, indent=1)
    else:
        print('\n   (simulacro: no anoté ni borré nada — agregá `--aplicar`)')
    print('')
    return 0


def _self_check():
    mal = 0
    hoy = datetime.date(2026, 10, 4)
    previo = {'ida': '2026-09-27', 'reciente': '2026-10-01', 'volvio': '2026-09-20',
              'rara': 'no-es-fecha'}
    pasan = {'volvio', 'siempre'}
    desde, venc = estado(['ida', 'reciente', 'volvio', 'rara', 'nueva', 'siempre'],
                         lambda k: k in pasan, hoy, previo)
    casos = [
        ('a los 7 días seguidos se borra', venc == ['ida']),
        ('con 3 días, todavía no', 'reciente' in desde and 'reciente' not in venc),
        ('quien volvió a pasar sale del reloj', 'volvio' not in desde),
        ('quien no pasa por primera vez arranca hoy', desde.get('nueva') == '2026-10-04'),
        ('una fecha ilegible arranca de nuevo, no se borra', desde.get('rara') == '2026-10-04'),
        ('quien pasa nunca entra', 'siempre' not in desde),
        ('en la Lista sin verificar: le sobran la Competitiva, la de País y sus Bloqueadas',
         sobran(['temporada', 'servidor', 'sv-ffa', 'competitivo', 'pais', 'bloq-competitivo',
                 'bloq-pais', 'bloq-temporada'], False, True)
         == ['bloq-competitivo', 'bloq-pais', 'competitivo', 'pais']),
        ('fuera de la Lista: le sobran todas',
         sobran(['temporada', 'servidor'], False, False) == ['servidor', 'temporada']),
        ('verificado: no le sobra ninguna', sobran(['temporada', 'competitivo'], True, True) == []),
        ('las claves salen de la URL pública',
         claves_r2({'temporada': 'https://pub-x.r2.dev/7po/temporada.webp', 'mal': 'sin-r2'})
         == ['7po/temporada.webp']),
    ]
    print('\n══ el reloj de quien se fue ══\n')
    for que, ok in casos:
        mal += not ok
        print('   %s %s' % ('✅' if ok else '🔴', que))
    print('')
    return mal


if __name__ == '__main__':
    if '--auto' in sys.argv:
        sys.exit(1 if _self_check() else 0)
    sys.exit(main())
