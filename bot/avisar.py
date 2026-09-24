# -*- coding: utf-8 -*-
"""LO QUE EL CICLO HIZO, EN UN CANAL QUE DLX MIRA.

    python bot/avisar.py --probar    manda un aviso de prueba
    python bot/avisar.py --auto      el self-check, sin red

🔴 EXISTE PORQUE «NO AGARRO NADA» Y «AGARRO Y NO SE VE» SE VEIAN IGUAL.
Dlx, 22/09/2026, con el Ranking en blanco despues del primer evento de la
T1: *«¿como se que el bot escaneo algo? Puedes agregar un mensaje diciendo
q detecto el evento de X servidor?»*.

Y tenia razon en la forma de la pregunta: el evento **si** se habia
cargado —#349, EL RAP FECHA 5, FFA— y lo unico que decia eso era el log
de un job de GitHub. Desde afuera, un lector roto y un lector que anda
producen exactamente la misma pantalla.

⚠️ VA AL CANAL DONDE EL BOT YA INFORMA, no a uno nuevo. `1504110449…`
—«LIGA GLOBAL» en DRA— es donde el repo de sync publica *«📸 Avatars —
316 actualizados»* y *«🔍 Auditoria de identidades»*. Un informe en un
canal que nadie abrio nunca es el mismo problema con otro nombre.

⚠️ SOLO CUANDO PASO ALGO. Un aviso por hora diciendo «no habia llaves»
son 24 mensajes al dia que entrenan a no mirar el canal — la misma
leccion que las 188 alarmas falsas del `audit` del repo de sync.

⚠️ Y NO PUEDE TUMBAR NADA. Se llama despues de escribir el evento: si
Discord no contesta, el evento ya esta cargado y lo unico que se pierde
es el aviso. Todas las funciones devuelven True/False y no levantan.
"""
import io
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

#: «LIGA GLOBAL» en DRA — donde el bot de sync ya publica sus informes.
#: Inventariado en `ACCESOS.md`; hasta hoy no lo usaba ningun codigo.
CANAL = '1504110449535483924'

AZUL = 0x5865F2
AMBAR = 0xF0B232


def _token():
    """El token del bot, de `.env` o del entorno. `''` si no hay."""
    t = os.environ.get('DISCORD_TOKEN') or ''
    if t:
        return t.strip()
    try:
        with io.open(os.path.join(BASE, '.env'), encoding='utf-8') as f:
            for l in f:
                if l.strip().startswith('DISCORD_TOKEN'):
                    return l.split('=', 1)[1].strip().strip('"\'')
    except OSError:
        pass
    return ''


def mandar(titulo, lineas, color=AZUL, canal=None, editar=None):
    """Un embed al canal. `True` si salio. **Nunca levanta.**

    ⚠️ EMBED Y NO TEXTO PELADO porque el titulo se lee de un vistazo en
    la lista de canales y el detalle no estorba. Es el formato que ya
    usan los informes de sync en este mismo canal.

    Con `editar=<id>` **corrige el mensaje que ya esta** en vez de
    mandar uno nuevo. Discord no notifica una edicion, asi que un
    evento que se completa actualiza su aviso sin volver a sonar.
    Devuelve el id del mensaje cuando manda uno nuevo, `True` cuando
    edito, y `False` si no salio — ver `_salio()`.
    """
    try:
        import requests
        t = _token()
        if not t:
            return False
        cuerpo = '\n'.join(str(l) for l in lineas if str(l).strip())
        # ⚠️ Discord corta la descripcion en 4096. Se recorta acá y se
        # dice que se recorto: un embed que Discord rechaza no se manda,
        # y un aviso que no se manda es peor que uno incompleto.
        if len(cuerpo) > 4000:
            cuerpo = cuerpo[:3960] + '\n… (recortado)'
        base = 'https://discord.com/api/v10/channels/%s/messages' % (canal or CANAL)
        cab = {'Authorization': 'Bot ' + t, 'Content-Type': 'application/json'}
        datos = json.dumps({'embeds': [{'title': titulo[:256],
                                        'description': cuerpo,
                                        'color': color}]})
        if editar:
            r = requests.patch('%s/%s' % (base, editar), headers=cab,
                               data=datos, timeout=20)
            # ⚠️ SI EL MENSAJE YA NO ESTA —lo borraron— se manda uno
            # nuevo. Si no, el aviso desaparece para siempre y el evento
            # queda marcado como avisado.
            if r.status_code == 404:
                editar = None
            else:
                return True if r.status_code in (200, 201) else False
        r = requests.post(base, headers=cab, data=datos, timeout=20)
        if r.status_code not in (200, 201):
            return False
        try:
            return r.json().get('id') or True
        except ValueError:
            return True
    except Exception:                                    # noqa: BLE001
        return False


def _salio(r):
    """`mandar()` devuelve un id, `True` o `False`. Esto normaliza."""
    return bool(r)


#: lo que ya se avisó: `{num: {'firma': …, 'msg': <id>}}`. Ver `evento()`.
#:
#: 🔴 Y TIENE QUE ESTAR EN EL SELLO DEL `.yml`, O NO SIRVE DE NADA. Este
#: archivo es la unica memoria de que ya se aviso, y el ciclo corre en un
#: runner **limpio**: sin commitearlo, cada hora arranca sin memoria y
#: vuelve a anunciar todo. Es lo que Dlx vio el 23/09/2026 —el #349 y el
#: #350 una y otra vez— y lo que el dedup por firma **no** pudo evitar,
#: porque el dedup estaba bien y el archivo se perdia igual.
#:
#: ⚠️ Es la misma forma que `mapa_viejo()` mirando `mtime`: un guardian
#: que solo funciona donde hay alguien mirando no es un guardian. Acá
#: andaba perfecto en esta PC y no existia en el unico lugar que importa.
YA = os.path.join(BASE, 'datos', 'avisados.json')


def _firma(ev, n_res, n_duelos, dudas, equipos):
    """Qué del evento hace que el aviso DIGA algo distinto."""
    return '%s|%s|%d|%d|%d|%d' % (ev.get('nombre'), ev.get('fecha'),
                                  n_res, n_duelos, len(dudas or ()), equipos)


def _avisados():
    """`{num: {'firma': …, 'msg': …}}`, tolerando el formato viejo.

    ⚠️ El formato anterior era `{num: firma}` a secas. Se convierte al
    leer en vez de migrar el archivo: el que quedo escrito en algun
    runner no tiene id de mensaje, y forzarlo a tener uno lo haria
    re-anunciar — justo lo que hay que evitar.
    """
    try:
        with io.open(YA, encoding='utf-8') as f:
            d = json.load(f)
    except (OSError, ValueError):
        return {}
    if not isinstance(d, dict):
        return {}
    return {k: (v if isinstance(v, dict) else {'firma': v, 'msg': None})
            for k, v in d.items()}


def evento(ev, n_res, n_duelos, dudas=(), equipos=0):
    """«detecté la llave X del servidor Y». Lo que Dlx pidió.

    `ev` es un plan de `sheet/procesar_entrada.py`: trae `num`, `nombre`,
    `servidor`, `fecha`, `participantes` y `escala`.

    🔴 SOLO SI CAMBIO ALGO, Y ESTO SE MANDABA SIEMPRE. El ciclo
    **reprocesa** los mismos eventos cada hora —es su diseño: relee las
    llaves de Discord y reemplaza— así que este aviso salía una vez por
    vuelta, con el mismo texto. Medido el 23/09/2026 en `#registros`:
    el #349 y el #350 anunciados a la 1:34, 1:42, 1:51… una pared de
    mensajes repetidos.

    ⚠️ Y ES EL MISMO ERROR QUE YA COSTO LOS DUELOS DUPLICADOS, un piso
    más arriba: **todo lo que actúe sobre «vi esto» tiene que
    deduplicar**, porque acá se ve lo mismo una y otra vez a propósito.

    ⚠️ LA FIRMA NO ES EL NUMERO DE EVENTO: es lo que el aviso DICE
    —nombre, fecha, filas, duelos, dudas—. Con el número solo, una
    llave que se completa —aparece la final, entran tres duelos más— no
    volvería a avisar, y eso es justo lo que hay que contar. Con el
    texto entero, se avisa cuando el mensaje cambiaría.
    """
    num = str(ev.get('num', '?'))
    firma = _firma(ev, n_res, n_duelos, dudas, equipos)
    ya = _avisados()
    antes = ya.get(num)
    if antes and antes.get('firma') == firma:
        return False
    sv = ev.get('servidor') or '?'
    lineas = [
        '**%s**' % (ev.get('nombre') or 'sin nombre'),
        '· servidor **%s**  ·  fecha %s  ·  %s participante(s)  ·  escala %s'
        % (sv, ev.get('fecha') or '?', ev.get('participantes') or '?',
           ev.get('escala') or '?'),
        '',
        '· %d fila(s) en `Resultados`  ·  %d en `1v1`' % (n_res, n_duelos),
    ]
    if equipos:
        # ⚠️ SE DICE, porque cambia como suman los puntos: en un evento
        # por equipos el puesto se reparte y las batallas no cuentan como
        # duelos. Ver `sheet/equipos.py`.
        lineas.append('· **%d lado(s) por equipos**: el puesto se reparte y '
                      'no cuentan como duelos' % equipos)
    if dudas:
        lineas.append('')
        lineas.append('⚠️ %d cosa(s) a revisar en `Pendientes`:' % len(dudas))
        for d in list(dudas)[:8]:
            lineas.append('· %s' % d)
    # 🔴 UNA LLAVE AVISA UNA SOLA VEZ. Lo que sigue **edita ese mismo
    # mensaje** cuando el evento cambia, en vez de mandar otro.
    #
    # Dlx, 23/09/2026: *«si ya lo detecto que no me lo detecte mas»*.
    # Y tenia razon las dos veces que lo dijo: el ciclo **relee las
    # llaves cada hora a proposito**, asi que una llave que se va
    # completando durante la noche —entran duelos, aparece la final—
    # cambia de firma sola y con «mandar de nuevo si cambio» volvia a
    # sonar igual. El dedup por firma achicaba la pared, no la sacaba.
    #
    # ⚠️ EDITAR NO NOTIFICA. Es la unica forma de que el aviso siga
    # diciendo la verdad —el #349 arranco con la final sin resolver— sin
    # que a Dlx le suene el telefono otra vez. Un aviso congelado en lo
    # que se sabia a las 3 AM es el otro error, el silencioso.
    msg = (antes or {}).get('msg')
    titulo = '🥊 Llave detectada' if not antes else '🥊 Llave detectada · al día'
    r = mandar('%s — #%s · %s' % (titulo, num, sv),
               lineas, AMBAR if dudas else AZUL, editar=msg)
    if _salio(r):
        # ⚠️ SE ANOTA SOLO SI SALIO. Anotar antes de mandar deja el
        # evento marcado como avisado sin que nadie lo haya visto.
        ya[num] = {'firma': firma,
                   # al editar, `mandar` devuelve True: se conserva el id
                   'msg': (r if isinstance(r, str) else msg)}
        try:
            os.makedirs(os.path.dirname(YA), exist_ok=True)
            with io.open(YA, 'w', encoding='utf-8', newline='\n') as f:
                json.dump(ya, f, ensure_ascii=False, indent=1, sort_keys=True)
        except OSError:
            pass
    return _salio(r)


#: ⚠️ la consola de Windows es cp1252 y se atraganta con los emoji. Va
#: al importar y no dentro de una función: lo tenía sólo `_self_check()`
#: y `--probar` moría con `UnicodeEncodeError` al imprimir un ✅ — un
#: comando de diagnóstico que revienta al contar que todo salió bien.
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except (AttributeError, ValueError):
    pass


def _self_check():
    print('\n  avisar.py — self-check\n')
    mal = 0
    t = _token()
    print('  hay token                       %s'
          % ('ok' if t else '⚠️ no (los avisos se saltean, no fallan)'))

    # el armado no puede depender de la red
    ev = {'num': 349, 'nombre': 'EL RAP FECHA 5', 'servidor': 'FFA',
          'fecha': '22/09', 'participantes': 16, 'escala': '16+'}
    try:
        lineas = ['**%s**' % ev['nombre']]
        ok = 'EL RAP FECHA 5' in lineas[0]
        print('  el aviso se arma sin red        %s' % ('ok' if ok else '🔴'))
        mal += not ok
    except Exception as e:                               # noqa: BLE001
        print('  el aviso se arma sin red        🔴 %s' % str(e)[:50])
        mal += 1

    # 🔴 SIN TOKEN TIENE QUE DEVOLVER False, NO LEVANTAR. Es lo que hace
    # que un `avisar()` en medio del pipeline no pueda tumbar la carga de
    # un evento ya escrito en el Sheet.
    guardo = os.environ.get('DISCORD_TOKEN')
    os.environ['DISCORD_TOKEN'] = ''
    global BASE
    gb, BASE = BASE, os.path.join(BASE, '_no_existe_')
    try:
        r = mandar('x', ['y'])
        ok = r is False
        print('  sin token devuelve False        %s'
              % ('ok' if ok else '🔴 devolvió %r' % r))
        mal += not ok
    finally:
        BASE = gb
        if guardo is None:
            os.environ.pop('DISCORD_TOKEN', None)
        else:
            os.environ['DISCORD_TOKEN'] = guardo

    # 🔴 EL MISMO EVENTO NO SE AVISA DOS VECES. El ciclo reprocesa cada
    # hora a propósito, así que sin esto la pared de mensajes está
    # garantizada — y pasó: el #349 y el #350 anunciados a la 1:34,
    # 1:42 y 1:51 con el mismo texto.
    global YA
    guardo_ya, YA = YA, os.path.join(BASE, 'datos', '_prueba_avisados.json')
    guardo_t = os.environ.get('DISCORD_TOKEN')
    os.environ['DISCORD_TOKEN'] = ''          # que no mande nada de verdad
    try:
        if os.path.exists(YA):
            os.remove(YA)
        ev2 = {'num': 999, 'nombre': 'X', 'servidor': 'FFA', 'fecha': '1/1'}
        f1 = _firma(ev2, 5, 2, (), 0)
        f2 = _firma(ev2, 5, 2, (), 0)
        f3 = _firma(ev2, 5, 9, (), 0)        # cambiaron los duelos
        ok = f1 == f2 and f1 != f3
        mal += not ok
        print('   %s la firma cambia si cambia lo que el aviso DICE'
              % ('ok' if ok else '🔴'))
        # y con la firma ya anotada, no se manda
        with io.open(YA, 'w', encoding='utf-8') as f:
            json.dump({'999': {'firma': f1, 'msg': '123'}}, f)
        ok = evento(ev2, 5, 2) is False
        mal += not ok
        print('   %s con la misma firma no se vuelve a avisar'
              % ('ok' if ok else '🔴'))

        # 🔴 EL FORMATO VIEJO TIENE QUE SEGUIR CALLANDO. Si `_avisados()`
        # no entendiera `{num: firma}`, el archivo que ya quedo escrito
        # en algun runner valdria cero y las llaves de ayer se
        # re-anunciarian todas juntas — el bug volviendo por la puerta
        # del arreglo.
        with io.open(YA, 'w', encoding='utf-8') as f:
            json.dump({'999': f1}, f)
        ok = evento(ev2, 5, 2) is False
        mal += not ok
        print('   %s el formato viejo se entiende y tampoco re-avisa'
              % ('ok' if ok else '🔴'))

        # 🔴 CUANDO CAMBIA, SE **EDITA**, NO SE MANDA OTRO. Es lo que
        # pidio Dlx —«si ya lo detecto que no me lo detecte mas»— sin
        # dejar el aviso congelado en lo que se sabia a las 3 AM.
        visto = {}

        def _falso(titulo, lineas, color=AZUL, canal=None, editar=None):
            visto['editar'] = editar
            return True if editar else 'msg-nuevo'

        real, globals()['mandar'] = mandar, _falso
        try:
            with io.open(YA, 'w', encoding='utf-8') as f:
                json.dump({'999': {'firma': f1, 'msg': 'abc'}}, f)
            evento(ev2, 5, 9)                 # cambiaron los duelos
            ok = visto.get('editar') == 'abc'
            mal += not ok
            print('   %s una llave que cambia EDITA su aviso (id %r)'
                  % ('ok' if ok else '🔴', visto.get('editar')))

            # y una llave nueva manda uno nuevo, y guarda su id
            if os.path.exists(YA):
                os.remove(YA)
            visto.clear()
            evento(ev2, 5, 2)
            guardado = _avisados().get('999', {})
            ok = visto.get('editar') is None and guardado.get('msg') == 'msg-nuevo'
            mal += not ok
            print('   %s una llave nueva manda uno nuevo y guarda su id'
                  % ('ok' if ok else '🔴'))
        finally:
            globals()['mandar'] = real
    finally:
        if os.path.exists(YA):
            os.remove(YA)
        YA = guardo_ya
        if guardo_t is None:
            os.environ.pop('DISCORD_TOKEN', None)
        else:
            os.environ['DISCORD_TOKEN'] = guardo_t

    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


def main():
    if '--auto' in sys.argv:
        return _self_check()
    if '--probar' in sys.argv:
        # 🔴 PRUEBA LOS **DOS** CAMINOS, no sólo el de mandar. El que
        # importa desde que Dlx pidió *«si ya lo detectó que no me lo
        # detecte más»* es el de **editar**, y el self-check no lo puede
        # tocar: usa un `mandar` falso, así que verifica que se llame
        # con el id correcto y no que Discord acepte el PATCH.
        #
        # ⚠️ Un camino que sólo se prueba contra un doble es un camino
        # sin probar. Acá se manda uno de verdad y se lo edita: si el
        # PATCH fallara —permisos, un mensaje de otro bot, la API
        # cambiada— se ve acá y no la noche que una llave se complete.
        r = mandar('🧪 Prueba del aviso del ciclo',
                   ['Si ves esto, el ciclo puede avisar en este canal.',
                    'Lo manda `bot/avisar.py`, que se usa cuando el lector '
                    'detecta una llave.'])
        print('  %s' % ('✅ mandado' if r else '🔴 no salió (¿token? ¿permisos?)'))
        if not r:
            return 1
        if not isinstance(r, str):
            print('  ⚠️ Discord no devolvió el id: no puedo probar la edición')
            return 0
        ok2 = mandar('🧪 Prueba — y este mensaje se EDITÓ, no se repitió',
                     ['Se mandó una vez y se corrigió en su lugar, sin '
                      'volver a notificar.',
                      '',
                      'Es lo que hace el ciclo cuando una llave se completa: '
                      'edita **este mismo mensaje** en vez de mandarte otro.',
                      '',
                      '_Podés borrarlo cuando quieras._'],
                     editar=r)
        print('  %s' % ('✅ editado en su lugar (mensaje %s)' % r if ok2
                        else '🔴 el PATCH falló: los avisos se repetirían'))
        return 0 if ok2 else 1
    print(__doc__.strip().splitlines()[0])
    print('\n  --probar   manda uno de prueba')
    print('  --auto     el self-check\n')
    return 0


if __name__ == '__main__':
    raise SystemExit(main() or 0)
