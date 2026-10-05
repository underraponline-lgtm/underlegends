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

🔑 Y DESDE EL 05/10/2026 LO DECIDE `verificados.puede()`, CARTA POR CARTA. La regla del 29/09 se cambió ese día
(Dlx: «C», «B»): sin verificarse, ninguna; la Temporada con el nivel 1 del Pase; y quien ya las tenía las CONSERVA
hasta la T1 (`datos/conservan.json`). Con la regla vieja escrita acá —«en la Lista = Temporada y Servidor»— a quien
conserva sólo la Servidor se le contaban TODAS como sobrantes, y a los 7 días se le borraba la que tiene derecho a
tener. Ahora sobra lo que `puede()` le niega: las camisetas (`sv-*`) son la Servidor y cada Bloqueada, su carta.

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


def carta_de(archivo):
    """Qué carta es un archivo del inventario: `sv-*` son las camisetas de la Servidor y
    `bloq-x` la Bloqueada de x."""
    if archivo.startswith('sv-'):
        return 'servidor'
    return archivo[len('bloq-'):] if archivo.startswith('bloq-') else archivo


def sobran(cartas, puede):
    """Las cartas del inventario que esa persona ya no puede tener: las que `puede(carta)` le niega."""
    return sorted(c for c in cartas if not puede(carta_de(c)))


def estado(sobran_por, hoy, previo):
    """`(desde, vencidas)`: el reloj de CADA CARTA que le sobra a alguien, y a cuáles ya les toca.

    `sobran_por` es `{clave: [cartas que le sobran hoy]}` y `previo` lo de la corrida anterior, `{clave: {carta:
    'AAAA-MM-DD'}}` —o, del formato de antes, `{clave: 'AAAA-MM-DD'}`, que vale para todas las suyas—. La que deja de
    sobrar sale del reloj; la que sobra por primera vez arranca hoy. `vencidas` es `[(clave, carta)]`.

    🔴 POR CARTA Y NO POR PERSONA (revisión del 05/10/2026): con un reloj por persona, al vencer se borraba todo lo
    que le sobrara ESE día, también lo que había empezado a sobrar tres días antes —quien conserva sus cartas hasta la
    T1 y tenía la Competitiva corriendo desde el 8 perdía la Temporada y la Servidor el 15, no el 19—.
    """
    desde, vencidas = {}, []
    for k, cartas in sobran_por.items():
        if not cartas:
            continue
        ant = previo.get(k)
        fila = {}
        for c in cartas:
            d = ant.get(c) if isinstance(ant, dict) else ant
            try:
                datetime.date.fromisoformat(d)
            except (TypeError, ValueError):
                d = hoy.isoformat()
            fila[c] = d
            if (hoy - datetime.date.fromisoformat(d)).days >= DIAS:
                vencidas.append((k, c))
        desde[k] = fila
    return desde, sorted(vencidas)


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
    # 🔑 POR CARTA, con `puede()`: lo que le sobra a cada uno, y cada carta con su reloj (ver `estado()`)
    sobran_de = lambda k: sobran(inv.get(k) or {},              # noqa: E731
                                 lambda c: VERIF.puede(idx.get(k, {}), verif, c))
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
    desde, vencidas = estado({k: sobran_de(k) for k in inv}, hoy, ant.get('desde') or {})
    nuevos = sorted(set(desde) - set(ant.get('desde') or {}))
    volvieron = sorted(set(ant.get('desde') or {}) - set(desde))
    print('   con tarjetas en R2: %d · pasan el portón: %d · con el reloj andando: %d'
          % (len(inv), pasan, len(desde)))
    if nuevos:
        print('   %d empiezan a contar hoy' % len(nuevos))
    if volvieron:
        print('   %d volvieron a pasar (o ya no tienen tarjetas): salen del reloj' % len(volvieron))
    if desde and not vencidas:
        prox = min(datetime.date.fromisoformat(d) for f in desde.values() for d in f.values()) + datetime.timedelta(DIAS)
        print('   el primer vencimiento es el %s' % prox.strftime('%d/%m/%Y'))
    borradas = list(ant.get('borradas') or [])
    if vencidas:
        quitar = {}
        for k, c in vencidas:
            quitar.setdefault(k, []).append(c)
        lote = sorted(quitar)[:TOPE]
        print('   %d tarjeta(s) de %d persona(s) cumplieron %d días: %s%s'
              % (len(vencidas), len(quitar), DIAS, ', '.join(lote[:8]), '…' if len(lote) > 8 else ''))
        if aplicar:
            import olvidar as OLV
            s = OLV.sesion()
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
                    (desde.get(k) or {}).pop(x, None)
                if not inv.get(k):
                    inv.pop(k, None)
                if not desde.get(k):
                    desde.pop(k, None)
                borradas.append([k, hoy.isoformat()])
            # el inventario sin ellos: si no, la corrida siguiente los vuelve
            # a encontrar y los intenta borrar otra vez
            with io.open(INVENTARIO, 'w', encoding='utf-8', newline='\n') as f:
                json.dump(inv, f, ensure_ascii=False, indent=1)
            print('   %d persona(s): se les borraron las que ya no pueden tener' % len(listas))
    if aplicar:
        with io.open(ARCHIVO, 'w', encoding='utf-8', newline='\n') as f:
            json.dump({'_leeme': 'El reloj de bot/fuera.py: desde qué día le sobra cada tarjeta a cada carpeta de '
                                 'R2 (`verificados.puede()`). A los %d días seguidos se borra esa tarjeta '
                                 '(Dlx, 27/09/2026). No se edita a mano.' % DIAS,
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
    # `previo` mezcla el formato de antes (una fecha por persona) con el de ahora (una por carta)
    previo = {'ida': '2026-09-27', 'reciente': '2026-10-01', 'volvio': '2026-09-20',
              'rara': 'no-es-fecha', 'mixta': {'competitivo': '2026-09-27', 'temporada': '2026-10-01'}}
    sobran_por = {'ida': ['competitivo'], 'reciente': ['pais'], 'volvio': [], 'rara': ['pais'],
                  'nueva': ['temporada'], 'mixta': ['competitivo', 'temporada', 'servidor']}
    desde, venc = estado(sobran_por, hoy, previo)
    casos = [
        ('a los 7 días seguidos se borra', ('ida', 'competitivo') in venc),
        ('con 3 días, todavía no', 'reciente' in desde and not any(k == 'reciente' for k, _c in venc)),
        ('quien volvió a pasar sale del reloj', 'volvio' not in desde),
        ('quien no pasa por primera vez arranca hoy', desde.get('nueva') == {'temporada': '2026-10-04'}),
        ('una fecha ilegible arranca de nuevo, no se borra', desde.get('rara') == {'pais': '2026-10-04'}),
        ('🔴 cada carta con su reloj: vence la que lleva 7 días, no las que empezaron a sobrar después',
         ('mixta', 'competitivo') in venc and ('mixta', 'temporada') not in venc and ('mixta', 'servidor') not in venc
         and desde['mixta']['servidor'] == '2026-10-04'),
        ('sólo vencen las que tienen que vencer', venc == [('ida', 'competitivo'), ('mixta', 'competitivo')]),
        ('conserva la Temporada y la Servidor: le sobran la Competitiva, la de País y sus Bloqueadas',
         sobran(['temporada', 'servidor', 'sv-ffa', 'competitivo', 'pais', 'bloq-competitivo',
                 'bloq-pais', 'bloq-temporada'], lambda c: c in ('temporada', 'servidor'))
         == ['bloq-competitivo', 'bloq-pais', 'competitivo', 'pais']),
        ('🔴 conserva SÓLO la Servidor: se le queda, con sus camisetas (la regla vieja se la borraba)',
         sobran(['temporada', 'servidor', 'sv-ffa', 'sv-dra'], lambda c: c == 'servidor') == ['temporada']),
        ('verificado sin el nivel 1 del Pase: le sobra la Temporada y nada más',
         sobran(['temporada', 'servidor', 'competitivo', 'bloq-temporada'], lambda c: c != 'temporada')
         == ['bloq-temporada', 'temporada']),
        ('fuera de la Lista: le sobran todas',
         sobran(['temporada', 'servidor'], lambda c: False) == ['servidor', 'temporada']),
        ('verificado con todo: no le sobra ninguna', sobran(['temporada', 'competitivo'], lambda c: True) == []),
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
