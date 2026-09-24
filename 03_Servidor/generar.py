"""La carta Servidor — el diseño de verdad, con gente del pool.

    python 03_Servidor/generar.py Juasmio          -> salida/sv_juasmio.png
    python 03_Servidor/generar.py Konan Axinu Bloody
    python 03_Servidor/generar.py --lista          quiénes tienen servidor

⚠️ **ESTE NO ES `normal_gen.py`, Y ESA ES TODA LA RAZÓN DE QUE EXISTA.**
`normal_gen.py` + `normal_card.css` son **el layout viejo** de la Normal —lo
dice `03_Servidor/NOTAS.md`: *«todo lo del color por servidor y el logo grande
se probó en scripts sueltos y no está aplicado a estos archivos todavía»*—.
O sea que el exportador sacaba una carta que ya nadie estaba diseñando: sin
escudo en la punta, sin fondo del servidor, sin la columna.

El diseño acordado vivía sólo dentro de `disenos/todos_sv.py`, que dibuja los
diez servidores en una hoja de exploración. Sus piezas sí están cerradas y
son canónicas (`comun/siluetas`, `divisor`, `emblema`, `brillo`, `marco`,
`rangos`, `iconos`, `pie`, `nombre`, `escudos`, y `los_nueve.defs()`), pero
**nadie las ensamblaba para una persona**. Eso hace este archivo.

⚠️ **SIGUE SIN SER LA VERSIÓN FINAL.** `disenos/ESTADO.md` lo dice arriba de
todo: **falta el marco** y hay dos ideas abiertas (un TAG propio y un rango
del servidor). Esto dibuja la carta *vigente*, no la terminada.

DE DÓNDE SALE CADA NÚMERO
-------------------------
Nueve de los catorce campos son reales. Los otros cuatro **no existen en
ningún pool** y van con el valor GLOBAL como relleno, avisando en cada corrida.

| campo | de dónde | ¿real? |
|---|---|---|
| nombre, país, servidor | `competitivo_pool.json` | sí |
| rango | `competitivo_pool.json` · **nunca el de temporada** | sí |
| puesto y total en el servidor | `pos_sv`, umbral 3 | sí |
| puesto en el país | `pos_pais`, umbral 3 | sí |
| puesto dentro del rango | se calcula acá, umbral 3 | sí |
| crew y puesto en la crew | `crews.json`, por Score | sí |
| racha | `rch_act/rch_max` | sí |
| duelos | `duel_v/duel_t` | **4 de 138** |
| **OVR del servidor** | — | **no** |
| **títulos, podios y eventos EN ESE SERVIDOR** | — | **no** |

⚠️ **EL OVR DEL SERVIDOR NO EXISTE Y NO SE ARREGLA ACÁ.** El Sheet sí tiene un
número por servidor —las 7 columnas de Ranking Temporada— pero
`construir_pool_temporada.py` las lee **sólo** para el argmax y **tira los
valores**. Hay que tocar el builder, no la carta. Está escrito en
`disenos/ESTADO.md` con las tres maneras de resolverlo y cuál rompe qué.

Mientras tanto se usa el OVR de temporada, que **no** es lo que la carta dice
que mide. Va marcado en el aviso de cada corrida para que nadie lo publique
creyendo que es del servidor.
"""
import argparse
import asyncio
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
DISENOS = os.path.join(SCR, 'disenos')
sys.path.insert(0, BASE)
sys.path.insert(0, DISENOS)

import todos_sv as TS
from comun import respaldo

# ⚠️ LA LINEA DEL DIVISOR VA EN F, Y ESTO SE ESCRIBE ACA PORQUE YA FALLO UNA
# VEZ. `todos_sv.py` lee `--div=` de sys.argv al importarse, asi que un
# generador que no lo diga hereda lo que tenga el script ese dia. Nacio
# heredando 'A' —una raya de 1.9 px del acento— y la carta salio con otra
# linea que la decidida. F es la que empalma con el marco en las dos puntas.
DIV = next((a.split('=')[1] for a in sys.argv if a.startswith('--div=')), 'F')
TS.DIV_GROSOR, TS.DIV_COLOR, TS.DIV_OPAC = TS.DIV_OPS[DIV]

SALIDA = os.path.join(SCR, 'salida')

# los cuatro que no existen, para el aviso
PRESTADOS = ('el OVR (va el de temporada)', 'los títulos', 'los podios',
             'los eventos')


def _j(*p):
    with open(os.path.join(BASE, 'datos', *p), encoding='utf-8') as f:
        return json.load(f)


def _par(v):
    """'5/25' -> (5, 25). '' -> (0, 0), que es como se dibuja sin puesto."""
    if not v:
        return 0, 0
    a, _, b = str(v).partition('/')
    try:
        return int(a), int(b or 0)
    except ValueError:
        return 0, 0


# ⚠️ MISMO UMBRAL DE 3 QUE PAÍS, SERVIDOR Y CREW. Ser "1 de 1" no informa, y
# la regla ya rige los tres círculos del pie en las otras cartas.
UMBRAL = 3


def puestos_en_rango(comp):
    """{nombre: (puesto, total)} dentro de su rango, por Score."""
    por = {}
    for x in comp:
        por.setdefault(x['rango'], []).append(x)
    out = {}
    for lista in por.values():
        if len(lista) < UMBRAL:
            continue
        orden = sorted(lista, key=lambda x: -x['score'])
        for n, x in enumerate(orden, 1):
            out[x['raw']] = (n, len(orden))
    return out


def _en_que_servidores():
    """{nombre normalizado: [codigos]} de Discord. `{}` si no se sabe."""
    try:
        donde = _j('servidores_de.json')
    except (OSError, ValueError):
        return {}
    sys.path.insert(0, os.path.join(BASE, 'sheet'))
    import construir_padron as PAD
    return {PAD.norm(x['raw']): donde.get(str(x.get('discord_id') or '')) or []
            for x in PAD.cargar()}


def cargar():
    comp = _j('competitivo_pool.json')
    _svs = _en_que_servidores()
    temp = {x['raw']: x for x in _j('temporada_pool.json')}
    rango_de = puestos_en_rango(comp)
    out = []
    for c in comp:
        t = temp.get(c['raw'], {})
        p_sv, tot_sv = _par(c.get('pos_sv'))
        p_pa, tot_pa = _par(c.get('pos_pais'))
        out.append({
            'nombre': c['raw'],
            'sv': c['sv'],
            'rango': c['rango'],
            'cc': c['cc'],
            'pos_sv': p_sv, 'tot_sv': tot_sv,
            'pos_pais': p_pa, 'tot_pais': tot_pa or 24,
            'rango_pos': rango_de.get(c['raw'], (0, 0)),
            # ── los cuatro prestados ──
            'ovr': t.get('ovr', 0),
            'titulos': t.get('oro', 0),
            'podios': t.get('pod', 0),
            'eventos': t.get('ev', c['ev']),
            # ── reales otra vez ──
            'racha': '%s/%s' % (c.get('rch_act', 0), c.get('rch_max', 0)),
            'duelos': ('%d/%d' % (c['duel_v'], c['duel_t'])
                       if c.get('duel_real') else '0/0'),
            # ⚠️ `avatar()` y no `foto()`: la misma regla que las otras
            # tres. Ver comun/respaldo.avatar() y el comentario de
            # 04_Pais/generar.py.
            'foto': respaldo.avatar(c['raw'], c.get('av') or ''),
            'svs': _svs.get(_slug(c['raw'])) or ([c['sv']] if c['sv'] else []),
        })
    out += _los_de_cero({p['nombre'] for p in out})
    return out


def _los_de_cero(ya):
    """Los que pueden tener carta y no estan en el pool, en `—`.

    🔴 SIN ESTO, EL QUE NO COMPITIO EN ESTA TEMPORADA SE QUEDA CON LA
    CARTA DE LA ANTERIOR. `cargar()` sale del pool competitivo, asi que
    despues del reset del 22/09 no devolvia a **nadie** — y las cartas
    viejas siguen en R2, servidas tal cual. Una carta que no se
    redibuja no falla: muestra los numeros del año pasado.

    ⚠️ VA `—` Y NO 0, y lo decidio Dlx el 19/09 mirando justamente la
    primera carta de alguien sin competir: *«un - esta mejor; 0 no
    deberia existir»*. El layout ya lo sabe hacer —`sin_datos = not
    evt` en `todos_sv.py`— y la regla esta escrita en `val()`: cero es
    «compiti y no gane», y `—` es «todavia no jugue».

    ⚠️ Y SIN RANGO NO VA LA GEMA. El rango sale del Score competitivo,
    que no existe, asi que no hay ninguno — ni siquiera el peor. El
    fondo de la carta lo da el SERVIDOR, no el rango, asi que la carta
    sigue entera.

    ⚠️ SE FILTRA POR EL PORTON DE IDENTIDAD. Dibujarle una carta a
    quien no puede tenerla es trabajo tirado, y encima quedaria en R2
    tentando a algun paso a servirla. Ver `bot/verificados.py`.
    """
    sys.path.insert(0, os.path.join(BASE, 'bot'))
    sys.path.insert(0, os.path.join(BASE, 'sheet'))
    import verificados as VERIF
    import construir_padron as PAD
    verif, _cuando = VERIF.cargar()
    if verif is None:
        return []                 # sin el archivo no se inventa a nadie
    # 🔴 SE RECORRE EL PADRON, NO EL INVENTARIO DE R2 — y hasta el
    # 22/09/2026 era al reves: `for k in sorted(inv)`, con `inv =
    # cartas_r2.json`. O sea que la lista de **a quien hay que dibujarle**
    # salia de **a quien ya se le habia dibujado**.
    #
    # Eso es un huevo y una gallina, y se nota justo con el caso que
    # importa: **quien se verifica hoy no recibe su primera carta nunca**.
    # El sistema sabia refrescar cartas y no sabia emitirlas.
    #
    # Medido el dia que aparecio: 319 pasan el porton de identidad y
    # **312** se dibujaban. Los siete que faltaban —KRT, Bull12r, Makmah,
    # elzurdo, yinn, Flennzs y MILICA— tienen Discord ID, pais y el rol
    # Miembro de DRA. Les faltaba una sola cosa: no tener ya una carta.
    #
    # ⚠️ Y NO FALLABA. `/card` les contestaba «todavia no estas
    # verificado» a siete personas que si lo estaban, que es la
    # respuesta equivocada con la cara de la correcta. Es la misma forma
    # que el bug de los avatares: **el dato estaba y el pipeline lo
    # tiraba**.
    #
    # El inventario de R2 sigue sirviendo, pero para otra pregunta: que
    # hay subido. Quien tiene que tener carta lo decide el porton.
    idx_pad = PAD.cargar()
    try:
        donde = _j('servidores_de.json')
    except (OSError, ValueError):
        print('   ⚠️ falta datos/servidores_de.json: no sé en qué servidor '
              'está cada uno,\n      así que no dibujo las de cero. Lo arma:'
              '\n      python herramientas/servidores_de.py --json')
        return []
    ccs = _cc_por_pais()
    out = []
    for p in sorted(idx_pad, key=lambda x: PAD.norm(x['raw'])):
        if not VERIF.pasa(p, verif):
            continue
        nom = p.get('raw') or ''
        if not nom or nom in ya:
            continue
        # 🔴 EL SERVIDOR SALE DE `datos/servidores_de.json`, NO DEL
        # PADRON. La columna `Sv` del Sheet **esta vacia en 134 de
        # 138** —lo dice `CLAUDE.md` entre las tres trampas— asi que
        # leerla de ahi daba 16 personas de 312. El archivo dice en que
        # servidores de Discord esta cada uno, que es lo que la carta
        # necesita: la Servidor es la del servidor donde escribiste.
        sv = (donde.get(str(p.get('discord_id') or '')) or [''])[0]
        if not sv:
            continue
        out.append({
            'nombre': nom, 'sv': sv, 'rango': '',
            'cc': ccs.get((p.get('pais') or '').strip(), ''),
            'pos_sv': 0, 'tot_sv': 0, 'pos_pais': 0, 'tot_pais': 24,
            'rango_pos': (0, 0),
            'ovr': 0, 'titulos': 0, 'podios': 0, 'eventos': 0,
            'racha': '0/0', 'duelos': '0/0',
            'foto': respaldo.avatar(nom, ''),
            'svs': donde.get(str(p.get('discord_id') or '')) or [sv],
        })
    return out


def _cc_por_pais():
    """{nombre de pais -> iso}. La misma tabla que usa la Bloqueada."""
    try:
        sys.path.insert(0, os.path.join(BASE, 'bot'))
        import bloqueadas as BQ
        return BQ.cc_de_pais()
    except Exception:                                    # noqa: BLE001
        return {}


def fila(p):
    """La tupla de 14 campos que desarma todos_sv.carta()."""
    return (p['nombre'].upper(), p['sv'], p['rango'], p['cc'],
            p['pos_sv'], p['pos_pais'], p['tot_sv'], p['ovr'],
            p['podios'], p['titulos'], p['racha'], p['duelos'],
            p['eventos'], False)


class _Fotos:
    """El mismo API que `avatares` pero con la foto de cada uno.

    ⚠️ `todos_sv.carta()` pide `avatares.para(i)`, que REPARTE fotos de prueba
    para juzgar el diseño. Dibujando gente de verdad eso pondría la cara de
    otro. Devuelve None cuando no hay foto. Aca decia «el caso de 128 de
    138» y desde el 20/09/2026 es al reves: 112 tienen y 26 no.
    (el numero de hoy: herramientas/puedo_generar.py)
    """
    def __init__(self, gente):
        self.g = gente

    def cuantas(self):
        return len(self.g)

    def para(self, i):
        return ('real', self.g[min(i, len(self.g) - 1)]['foto'])


def montar(gente):
    TS.GENTE = [fila(p) for p in gente]
    TS.TOTALES_PAIS = {i: p['tot_pais'] for i, p in enumerate(gente)}
    TS.PUESTO_RANGO = {i: p['rango_pos'] for i, p in enumerate(gente)}
    TS.avatares = _Fotos(gente)


async def dibujar(gente, prefijo='sv'):
    """`prefijo` nombra el archivo: 'sv' la propia, 'sv-twr' la de TWR.

    ⚠️ EL NOMBRE DEL ARCHIVO ES LA CLAVE EN R2, y por eso se decide acá y no
    al subir. `bot/subir_cartas.py` lo lee y arma `konan/servidor.png` o
    `konan/sv-twr.png`, que es exactamente lo que el Worker construye sin
    consultar nada. Si el prefijo cambia, el bot pide una URL que no existe y
    Discord muestra un hueco sin avisar.
    """
    from playwright.async_api import async_playwright
    montar(gente)
    with open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
              encoding='utf-8') as f:
        fuentes = f.read()
    os.makedirs(SALIDA, exist_ok=True)
    # ⚠️ UN ARCHIVO TEMPORAL POR CARTA, NO UNO SOLO REESCRITO.
    # Antes esto reusaba `_sv.html` en cada vuelta, y en Windows eso revienta
    # con `[Errno 22] Invalid argument` cuando Chromium todavia tiene abierto
    # el de la vuelta anterior. Con 3 cartas no llega a pasar; con 138 se
    # corto a las 18 y el resto no se genero. El numero de vuelta en el nombre
    # lo resuelve sin cambiar nada de lo que se dibuja.
    hechos, temporales = [], []
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': TS.W, 'height': TS.ALTO},
                              device_scale_factor=TS.ESCALA)
        for i, p in enumerate(gente):
            # ⚠️ EL PID TAMBIEN, NO SOLO EL NUMERO DE VUELTA. Con `_sv_0.html`
            # a secas, DOS CORRIDAS A LA VEZ escriben el mismo archivo y en
            # Windows eso revienta con `[Errno 22] Invalid argument` mientras
            # el otro Chromium lo tiene abierto. Paso: `puedo_generar.py`
            # corriendo de fondo y una tanda por delante se pisaron, y la
            # carta que fallo parecia una regresion del generador.
            tmp = os.path.join(SCR, '_sv_%d_%d.html' % (os.getpid(), i))
            temporales.append(tmp)
            with open(tmp, 'w', encoding='utf-8') as f:
                f.write('<!DOCTYPE html><html><head><meta charset="UTF-8">'
                        '<style>' + fuentes + TS.CSS + '</style></head><body>'
                        + TS.carta(i, 'g%d' % i) + '</body></html>')
            await pg.goto('file://' + tmp.replace(os.sep, '/'))
            # ⚠️ SE ESPERA LO QUE IMPORTA, NO UN NUMERO. Aca habia un
            # `wait_for_timeout(350)`, que es un valor puesto a ojo: si la
            # pagina tardaba mas, la tarjeta salia con la fuente del sistema o
            # con un hueco donde va el avatar, y si tardaba menos se regalaban
            # los milisegundos igual.
            #
            # Lo que de verdad mueve el dibujo son dos cosas: las fuentes —si
            # no estan listas, el texto se acomoda distinto— y las imagenes
            # —si no cargaron, queda el hueco—. Esperar exactamente eso
            # termina en cuanto pasa.
            #
            # Medido sobre 6 tarjetas: 2.54 -> 2.20 s por tarjeta, 13 % menos,
            # y las seis salen IDENTICAS byte a byte. Si no salieran iguales
            # no seria una optimizacion, seria un rediseño con otro nombre.
            await pg.evaluate('''async () => {
                await document.fonts.ready;
                await Promise.all([...document.images]
                    .filter(i => !i.complete)
                    .map(i => new Promise(r => { i.onload = i.onerror = r; })));
            }''')
            d = os.path.join(SALIDA, '%s_%s.png' % (prefijo, _slug(p['nombre'])))
            await pg.screenshot(path=d, omit_background=True)
            hechos.append(d)
        await b.close()
    for t in temporales:
        try:
            os.remove(t)
        except OSError:
            pass          # que no se caiga la corrida por un temporal colgado
    # ⚠️ RECORTAR NO ES COSMETICA: ES TAMAÑO EN DISCORD. El feed recorta por
    # ALTO y ajusta el ancho segun la proporcion del ARCHIVO, asi que cada
    # pixel transparente de mas hace la carta mas chica en el chat. Lo explica
    # todos_sv.recortar(), que ademas usa una caja COMUN para las que se pidan
    # juntas: si cada una se recorta a su borde salen de tamaños distintos y
    # dejan de verse como un set.
    TS.recortar(hechos)
    return hechos


def _slug(n):
    return respaldo._norm(n)


# ⚠️ LA MISMA CARTA CON LA CAMISETA DE OTRO SERVIDOR. Dlx, 17/09/2026: `/card`
# tiene que abrir en la carta **del servidor donde escribiste**, y eso vale
# aunque no sea el tuyo. O sea que cada persona necesita una carta por
# servidor, no una sola.
#
# ⚠️ SE BORRA EL PUESTO, Y ES EL UNICO CAMPO QUE CAMBIA. De un servidor donde
# no jugaste no se puede saber que puesto tenes — no existe. Todo lo demas de
# la carta es de la PERSONA (rango, pais, crew, racha, duelos) y viaja igual.
# Poner el puesto del servidor propio seria decir que sos 3º de TWR sin haber
# entrado nunca.
#
# ⚠️ Y LOS CUATRO PRESTADOS SIGUEN PRESTADOS. El OVR, los titulos, los podios
# y los eventos ya eran globales en la carta propia —`PRESTADOS`, arriba—
# porque el builder tira las 7 columnas por servidor. Acá pasa exactamente lo
# mismo, ni mejor ni peor: el dia que el builder las guarde, se arreglan las
# dos de una.
def con_camiseta(p, sv):
    q = dict(p)
    q['sv'] = sv
    q['pos_sv'], q['tot_sv'] = 0, 0
    return q


def main():
    ap = argparse.ArgumentParser(description='La carta Servidor, diseño vigente')
    ap.add_argument('quien', nargs='*')
    ap.add_argument('--lista', action='store_true')
    # ⚠️ `--todas` EXISTE PARA NO PASAR 138 NOMBRES POR LA LINEA DE COMANDOS.
    # No es comodidad: los nombres con espacio —"Lord Viruzz"— se parten en dos
    # argumentos y el generador dice "no estan en el pool: Lord, Viruzz". Ya
    # paso, y `sheet/sync.py` lo documenta con "Lil Junior" -> "Lil".
    ap.add_argument('--todas', action='store_true')
    # ⚠️ El servidor de la carta, cuando NO es el propio. Ver con_camiseta().
    ap.add_argument('--sv', default='', metavar='CODIGO',
                    help='dibujar la carta con los colores de ESE servidor')
    ap.add_argument('--div', default='F', help=argparse.SUPPRESS)
    a = ap.parse_args()

    gente = cargar()
    if a.lista or (not a.quien and not a.todas):
        print('SERVIDOR DE CADA UNO (%d)\n' % len(gente))
        for p in sorted(gente, key=lambda x: (x['sv'], -x['pos_sv'] or 0)):
            print('   %-6s %-14s rango %-3s  %s en el servidor'
                  % (p['sv'], p['nombre'], p['rango'],
                     '%d/%d' % (p['pos_sv'], p['tot_sv'])
                     if p['pos_sv'] else 'sin puesto'))
        return

    por = {_slug(p['nombre']): p for p in gente}
    if a.todas:
        elegidos = list(gente)
        # 🔴 CON `--sv=X`, SOLO LOS QUE ESTAN EN X. `/card` abre en la
        # carta del servidor **donde escribiste**, y sólo se puede
        # escribir en un servidor donde estás: la carta de TWR de
        # alguien que no está en TWR no se la puede pedir nadie.
        #
        # Medido el 22/09: dibujar la matriz entera son 312 x 9 = 2.808
        # cartas y las alcanzables son **510** —114 personas están en un
        # servidor y 198 en dos—. Las otras 2.298 son horas de render
        # para archivos que nadie va a pedir.
        if a.sv:
            code = a.sv.upper()
            elegidos = [p for p in elegidos
                        if code in [s.upper() for s in (p.get('svs') or [])]]
    else:
        faltan = [q for q in a.quien if _slug(q) not in por]
        if faltan:
            raise SystemExit('no estan en el pool: %s' % ', '.join(faltan))
        elegidos = [por[_slug(q)] for q in a.quien]

    prefijo = 'sv'
    if a.sv:
        sv = a.sv.upper()
        # ⚠️ SE PREGUNTA A `los_nueve.defs()` Y NO A `datos/colores_sv.json`.
        # El JSON tiene SEIS servidores y los fondos cerrados son DIEZ: FFA,
        # EFA, URBF y RZ están en `defs()` y no en el JSON. Validar contra el
        # JSON rechazaría justo FFA, que es donde corre el bot — y el fondo
        # existe. Es la regla de CLAUDE.md: la definición canónica de los
        # nueve fondos es `defs()`, no los scripts de exploración.
        if sv not in TS.DEFS:
            raise SystemExit('no conozco el servidor "%s". Los que hay: %s'
                             % (sv, ', '.join(sorted(TS.DEFS))))
        elegidos = [con_camiseta(p, sv) for p in elegidos]
        prefijo = 'sv-%s' % sv.lower()

    hechos = asyncio.run(dibujar(elegidos, prefijo))
    if len(hechos) > 12:
        print('   %d cartas en %s  (prefijo %s)'
              % (len(hechos), os.path.relpath(SALIDA, BASE), prefijo))
    else:
        for p, f in zip(elegidos, hechos):
            print('   %-14s %-5s  %s' % (p['nombre'], p['sv'],
                                         os.path.relpath(f, BASE)))
    print('\n⚠️ cuatro numeros de la columna NO son de ese servidor, porque no')
    print('   existen en ningun pool: %s.' % ', '.join(PRESTADOS))
    print('   Van los globales para poder MIRAR la carta. Ver el docstring y')
    print('   03_Servidor/disenos/ESTADO.md.')
    sin = [p['nombre'] for p in elegidos if not p['foto']]
    if sin:
        print('   sin foto en disco: %s' % ', '.join(sin))


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
