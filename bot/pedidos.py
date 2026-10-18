# -*- coding: utf-8 -*-
"""🙋 LOS PEDIDOS DE LA GENTE, APLICADOS: lo que se aprobó en el Dashboard de «perdí mi cuenta» y «mi país está mal».

    python bot/pedidos.py            qué haría con lo aprobado (no escribe nada)
    python bot/pedidos.py --aplicar  lo hace: la Lista, la cuenta y avisa al objeto (el ciclo, paso 2b5b)
    python bot/pedidos.py --auto     el self-check, sin red

Dlx, 17/10/2026: *«deberíamos hacer un sistema de reportes… ¿qué pasa si alguien pierde acceso a su cuenta de Discord y
tiene una nueva?»*; a las preguntas: aprueba *«Vos o un Moderador»*, y al aprobar pasa *«Todo»*. Lo pide la persona
desde Mi cuenta con SU Discord (el Worker guarda el pedido con lo que ve el bot de esa cuenta: `pedir()` en
bot/avisos.js), el Dashboard lo muestra y alguien con permiso dice sí o no. Lo de acá es lo que queda:

  · PERDÍ MI CUENTA: la fila del perfil que dijo pasa a la cuenta nueva (`lista_raperos.cuenta_nueva()`: la vieja
    queda en las Notas), y el objeto pasa TODO lo de la vieja a la nueva —Puntos de Tienda, XP, el Pase, a quién sigue,
    la foto, el fondo, el servidor— (`mudarCuenta()`). Si la fila no tenía cuenta, sólo se le pone la nueva.
  · MI PAÍS ESTÁ MAL: la fila de quien lo pidió (por su cuenta) pasa al país que dijo (`lista_raperos.poner_pais()`).
  Los de «ese no soy yo» y «un video que no es mío» los resuelve Dlx a mano: al aprobarlos ya quedan hechos.

⚠️ NUNCA ADIVINA UNA FILA: si el perfil está dos veces en la Lista, o la cuenta nueva ya es de otra fila, no hace nada y
lo dice («no_pude», con por qué). Lo decide Dlx.
⚠️ La cuenta vieja no se pierde: queda en las Notas de la fila, con el número del pedido.
"""
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

WORKER = 'https://liga-global-bot.liga-global-ul.workers.dev'


def plan(pedidos, padron, clave):
    """`[(id, acción, datos | por qué)]`: qué hacer con cada pedido aprobado. Pura.

    acciones: `cuenta` `{raw, viejo, nuevo}`, `poner_id` `{raw, nuevo}`, `pais` `{raw, cc}`, `nada` (ya estaba) y
    `no_pude` (con el motivo)."""
    por_clave, por_id = {}, {}
    for x in padron or []:
        if x.get('raw'):
            por_clave.setdefault(clave(x['raw']), []).append(x)
            if x.get('discord_id'):
                por_id[str(x['discord_id'])] = x
    out = []
    for p in pedidos or []:
        i, nuevo = p.get('id'), str(p.get('quien') or '')
        if p.get('tipo') == 'cuenta':
            fs = por_clave.get(p.get('k') or '') or []
            if len(fs) != 1:
                out.append((i, 'no_pude', 'el perfil «%s» está %d veces en la Lista' % (p.get('k'), len(fs))))
                continue
            f = fs[0]
            viejo = str(f.get('discord_id') or '')
            otro = por_id.get(nuevo)
            if viejo == nuevo:
                out.append((i, 'nada', 'ya tenía esa cuenta'))
            elif otro is not None and otro is not f:
                out.append((i, 'no_pude', 'la cuenta nueva ya es de «%s» en la Lista' % otro.get('raw')))
            elif viejo:
                out.append((i, 'cuenta', {'raw': f['raw'], 'viejo': viejo, 'nuevo': nuevo}))
            else:
                out.append((i, 'poner_id', {'raw': f['raw'], 'nuevo': nuevo}))
        elif p.get('tipo') == 'pais':
            f = por_id.get(nuevo)
            if f is None:
                out.append((i, 'no_pude', 'quien lo pidió no está en la Lista con esa cuenta'))
            else:
                out.append((i, 'pais', {'raw': f['raw'], 'cc': str(p.get('cc') or '').lower()}))
    return out


def _clave_ciclo():
    import clave_ciclo as CC
    import fotos as F
    tok = F.env('DISCORD_TOKEN', obligatorio=False)
    return CC.clave(tok) if tok else ''


def correr(aplicar=False):
    import requests
    k = _clave_ciclo()
    if not k:
        print('   ⚠️ sin DISCORD_TOKEN: no leo los pedidos')
        return 0
    try:
        r = requests.get(WORKER + '/avisos/pedidos-ciclo', headers={'x-lg-ciclo': k}, timeout=25)
        pedidos = (r.json() or {}).get('pedidos') if r.ok else None
    except (OSError, ValueError) as e:
        print('   ⚠️ los pedidos no contestaron (%s)' % str(e)[:60])
        return 0
    if pedidos is None:
        print('   ⚠️ los pedidos no contestaron (%s)' % r.status_code)
        return 0
    if not pedidos:
        print('   🙋 pedidos: nada aprobado para aplicar')
        return 0
    with io.open(os.path.join(BASE, 'datos', 'padron.json'), encoding='utf-8') as f:
        padron = json.load(f) or []
    from comun.claves import clave
    import lista_raperos as LR
    estados = {}
    for i, acc, x in plan(pedidos, padron, clave):
        motivo = 'pedido #%s de la página, aprobado en el Dashboard' % i
        if acc == 'no_pude':
            print('   🙋 #%s: no pude (%s)' % (i, x))
            estados[str(i)] = {'ok': False, 'nota': x}
        elif acc == 'nada':
            estados[str(i)] = {'ok': True, 'nota': x}
        elif acc == 'cuenta':
            print('   🙋 #%s: %s pasa a la cuenta nueva' % (i, x['raw']))
            if not aplicar:
                continue
            ok = LR.cuenta_nueva(x['raw'], x['nuevo'], 'perdió la cuenta; ' + motivo, aplicar=True)
            mu = {}
            if ok:
                try:
                    rm = requests.post(WORKER + '/avisos/mudar-cuenta', headers={'x-lg-ciclo': k}, timeout=25,
                                       json={'viejo': x['viejo'], 'nuevo': x['nuevo']})
                    mu = rm.json() if rm.ok else {'ok': False}
                except (OSError, ValueError):
                    mu = {'ok': False}
            estados[str(i)] = {'ok': bool(ok and mu.get('ok')),
                               'nota': 'la cuenta nueva ya es la del perfil; pasó: %s' % ', '.join(sorted(mu.get('movidas') or {}))
                               if ok and mu.get('ok') else 'no pude pasar todo: avisale a Dlx'}
        elif acc == 'poner_id':
            print('   🙋 #%s: %s recibe su cuenta' % (i, x['raw']))
            if aplicar:
                ok = LR.poner_id(x['raw'], x['nuevo'], aplicar=True)
                estados[str(i)] = {'ok': bool(ok), 'nota': 'la cuenta es la del perfil' if ok else 'no pude ponerle la cuenta'}
        elif acc == 'pais':
            print('   🙋 #%s: %s pasa a %s' % (i, x['raw'], x['cc']))
            if aplicar:
                ok = LR.poner_pais(x['raw'], x['cc'], motivo, aplicar=True)
                estados[str(i)] = {'ok': bool(ok), 'nota': 'el país ya es el nuevo' if ok else 'no pude cambiar el país'}
    if aplicar and estados:
        try:
            requests.post(WORKER + '/avisos/pedidos-estados', headers={'x-lg-ciclo': k}, timeout=25, json={'estados': estados})
        except OSError as e:
            print('   ⚠️ no pude avisar cómo salió (%s): se reintenta' % str(e)[:60])
    return len(estados)


def _self_check():
    print('\n══ LOS PEDIDOS DE LA GENTE ══\n')
    mal = 0

    def ok(c, q, extra=''):
        nonlocal mal
        mal += not c
        print('   %s %s%s' % ('✅' if c else '🔴', q, ('  ' + extra) if extra and not c else ''))

    cl = lambda s: str(s or '').lower().replace(' ', '')  # noqa: E731
    padron = [{'raw': 'Lvel', 'discord_id': '111'}, {'raw': 'Ana', 'discord_id': ''}, {'raw': 'Bea', 'discord_id': '333'},
              {'raw': 'Dos', 'discord_id': ''}, {'raw': 'dos', 'discord_id': ''}]
    pl = plan([{'id': 1, 'tipo': 'cuenta', 'quien': '999', 'k': 'lvel'},
               {'id': 2, 'tipo': 'cuenta', 'quien': '888', 'k': 'ana'},
               {'id': 3, 'tipo': 'cuenta', 'quien': '333', 'k': 'lvel'},
               {'id': 4, 'tipo': 'cuenta', 'quien': '777', 'k': 'dos'},
               {'id': 5, 'tipo': 'pais', 'quien': '333', 'cc': 'CL'},
               {'id': 6, 'tipo': 'pais', 'quien': '555', 'cc': 'cl'},
               {'id': 7, 'tipo': 'cuenta', 'quien': '111', 'k': 'lvel'}], padron, cl)
    acc = {i: (a, x) for i, a, x in pl}
    ok(acc[1] == ('cuenta', {'raw': 'Lvel', 'viejo': '111', 'nuevo': '999'}), 'perdí mi cuenta: la fila pasa a la nueva, y se sabe la vieja')
    ok(acc[2] == ('poner_id', {'raw': 'Ana', 'nuevo': '888'}), 'la fila sin cuenta: sólo se le pone la nueva')
    ok(acc[3][0] == 'no_pude' and 'Bea' in acc[3][1], 'la cuenta nueva ya es de otra fila: no se toca, lo decide Dlx')
    ok(acc[4][0] == 'no_pude', 'el perfil dos veces en la Lista: no se adivina')
    ok(acc[5] == ('pais', {'raw': 'Bea', 'cc': 'cl'}) and acc[6][0] == 'no_pude', 'mi país: la fila de quien lo pidió, por su cuenta')
    ok(acc[7][0] == 'nada', 'ya tenía esa cuenta: no hay nada que hacer')
    print('\n   %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        return 1 if _self_check() else 0
    print('\n══ LOS PEDIDOS DE LA GENTE ══\n')
    correr(aplicar='--aplicar' in sys.argv)
    if '--aplicar' not in sys.argv:
        print('   (simulacro: no escribí nada — `--aplicar`)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
