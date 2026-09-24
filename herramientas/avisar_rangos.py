# -*- coding: utf-8 -*-
"""AVISAR EN DISCORD CUANDO ALGUIEN CAMBIA DE RANGO.

    python herramientas/avisar_rangos.py             muestra que avisaria
    python herramientas/avisar_rangos.py --aplicar   lo manda de verdad
    python herramientas/avisar_rangos.py --marcar    guarda el estado SIN avisar

Dlx eligio esto en `/settings`: un canal donde anunciar los cambios de rango.
El canal lo elige cada servidor desde el panel y vive en `cfg:<guild>.avisos`;
este script —local, con el token— compara y postea.

🔴 EL ESTADO ANTERIOR ES UN ARCHIVO, NO KV. Comparar «hoy contra ayer» necesita
guardar el ayer, y son ~138 valores que cambian juntos: en KV serian 138
escrituras por corrida sobre un limite de 1.000 diarias, para un dato que
**solo este script lee**. Va a `datos/rangos_previos.json`, que ademas queda
versionado y se puede mirar.

🔴 LA PRIMERA CORRIDA NO AVISA NADA, Y ESO NO ES UN BUG. Sin un «ayer», los 138
rangos son cambios y el canal se llenaria de 138 mensajes anunciando que la
gente tiene el rango que siempre tuvo. La primera vez se guarda la foto y se
dice que se guardo.

⚠️ SOLO SE AVISA DE QUIEN ESTA EN ESE SERVIDOR. Anunciar en DRA que subio
alguien que no esta en DRA es ruido para todos y una notificacion inutil para
quien no puede ni verlo. Sale de `datos/servidores_de.json`.

⚠️ SUBIR Y BAJAR SE VEN DISTINTO, y bajar se dice sin festejo. El rango sale
del Score competitivo, que se reinicia por temporada: bajar es normal y
anunciarlo con la misma fanfarria que subir convierte una mecanica del juego en
una humillacion publica.

⚠️ SE MENCIONA SIN PINGUEAR. `allowed_mentions: {parse: []}` deja la mencion
clickeable y no notifica: un anuncio automatico que le vibra el telefono a
veinte personas se apaga en una semana.
"""
import io
import json
import os
import re
import sys
import time

import requests

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, BASE)
sys.path.insert(0, os.path.join(BASE, 'sheet'))

from comun.rangos import UMBRAL, de_score  # noqa: E402

API = 'https://discord.com/api/v10'
CUENTA = 'a85733396fd158a8e9660b02e20f33c8'
KV = 'a87399a3a0b647b0803aa90509ccce56'
KV_API = ('https://api.cloudflare.com/client/v4/accounts/%s/storage/kv/namespaces/%s'
          % (CUENTA, KV))
PREVIOS = os.path.join(BASE, 'datos', 'rangos_previos.json')

# ⚠️ EL ORDEN ES EL DE `comun/rangos.py` Y SE LEE DE AHI, no se copia. Con la
# lista escrita a mano, el dia que entre un rango nuevo este script diria
# «bajo» donde subio y nadie lo notaria hasta que alguien se queje.
# `UMBRAL` va de mayor a menor y no incluye E, que es «el resto». De abajo
# hacia arriba queda: E, D, C, B, A, S, SS, SSS.
ESCALERA = ['E'] + [n for n, _ in UMBRAL][::-1]
SIGNO = re.compile(r'[+-]$')


def env(clave):
    for l in io.open(os.path.join(BASE, '.env'), encoding='utf-8'):
        if l.strip().startswith(clave + '='):
            return l.split('=', 1)[1].strip().strip('"\'')
    sys.exit('falta %s en .env' % clave)


def _tramo(r):
    """«A+» -> «A». El signo no es un rango: es un tercio adentro del rango."""
    return SIGNO.sub('', str(r or '')).strip()


def nivel(r):
    t = _tramo(r)
    return ESCALERA.index(t) if t in ESCALERA else -1


def rangos_de_hoy():
    """{nombre normalizado: (rango, nombre como se escribe)} del pool de hoy."""
    import construir_padron as PAD
    with io.open(os.path.join(BASE, 'datos', 'competitivo_pool.json'),
                 encoding='utf-8') as f:
        pool = json.load(f)
    out = {}
    for x in pool:
        sc = x.get('score')
        if sc is None:
            continue
        out[PAD.norm(x['raw'])] = (de_score(float(sc)), x['raw'])
    return out


def previos():
    if not os.path.exists(PREVIOS):
        return None
    with io.open(PREVIOS, encoding='utf-8') as f:
        return json.load(f)


def guardar(hoy):
    json.dump({'cuando': time.strftime('%Y-%m-%d %H:%M'),
               'rangos': {k: v[0] for k, v in hoy.items()}},
              io.open(PREVIOS, 'w', encoding='utf-8', newline='\n'),
              ensure_ascii=False, indent=1, sort_keys=True)


def canales_de_aviso(tok):
    """{guild: canal} de los servidores que configuraron uno en /settings."""
    s = requests.Session()
    s.headers['Authorization'] = 'Bearer ' + tok
    j = s.get(KV_API + '/keys', params={'prefix': 'cfg:', 'limit': 1000},
              timeout=30).json()
    if not j.get('success'):
        print('  ⚠️ no pude leer los ajustes de KV: %s' % j.get('errors'))
        return {}
    claves = [k['name'] for k in j.get('result', [])]
    if not claves:
        return {}
    r = s.post(KV_API + '/bulk/get', json={'keys': claves}, timeout=30)
    vals = ((r.json().get('result') or {}).get('values') or {}) if r.ok else {}
    out = {}
    for k, v in vals.items():
        try:
            canal = (json.loads(v) or {}).get('avisos')
        except Exception:
            canal = None
        if canal:
            out[k.split(':', 1)[1]] = canal
    return out


# ⚠️ SUBIR Y BAJAR NO SE ESCRIBEN IGUAL. Ver el encabezado.
def linea(nombre, did, antes, ahora, subio):
    quien = '<@%s>' % did if did else '**%s**' % nombre
    if subio:
        return '📈 %s subió de **%s** a **%s**' % (quien, antes, ahora)
    return '📉 %s pasó de **%s** a **%s**' % (quien, antes, ahora)


def main():
    import construir_padron as PAD

    hoy = rangos_de_hoy()
    print('\n%d personas con rango en el pool' % len(hoy))
    ayer = previos()

    if ayer is None:
        guardar(hoy)
        print('\n🔵 PRIMERA CORRIDA: no habia con que comparar, asi que guardé la')
        print('   foto de hoy y no avisé nada. Desde la proxima, avisa los cambios.')
        print('   -> %s\n' % os.path.relpath(PREVIOS, BASE))
        return

    marcar = '--marcar' in sys.argv
    aplicar = '--aplicar' in sys.argv

    antes = ayer.get('rangos', {})
    cambios = []
    for k, (r, raw) in sorted(hoy.items()):
        v = antes.get(k)
        # ⚠️ QUIEN NO ESTABA AYER NO «CAMBIÓ». Entro al ranking, que es otra
        # cosa: anunciarlo como un ascenso de E a B seria inventarle un pasado.
        if v is None or _tramo(v) == _tramo(r):
            continue
        cambios.append((k, raw, v, r, nivel(r) > nivel(v)))

    print('comparando contra la foto del %s' % ayer.get('cuando', '?'))
    print('   cambios de rango: %d' % len(cambios))
    if not cambios:
        if aplicar or marcar:
            guardar(hoy)
            print('   (foto actualizada igual)\n')
        return

    # a quien avisarle y donde
    idx = PAD.por_nombre()
    donde = {}
    p = os.path.join(BASE, 'datos', 'servidores_de.json')
    if os.path.exists(p):
        with io.open(p, encoding='utf-8') as f:
            porid = json.load(f)
        donde = porid
    else:
        print('  ⚠️ falta datos/servidores_de.json: no puedo saber quien esta donde')

    tok_cf = env('CLOUDFLARE_API_TOKEN')
    canales = canales_de_aviso(tok_cf)
    if not canales:
        print('\n  🔵 ningun servidor configuró un canal de avisos en /settings.')
        print('     Nada que mandar. (El panel: /settings -> «Avisos de cambio de rango»)')
        if marcar:
            guardar(hoy)
        return

    NOMBRE_SV = {'841017460341604382': 'DRA', '1468472442925092958': 'FFA'}
    s = requests.Session()
    s.headers['Authorization'] = 'Bot ' + env('DISCORD_TOKEN')

    for gid, canal in sorted(canales.items()):
        sv = NOMBRE_SV.get(gid, gid)
        mios = []
        for k, raw, v, r, subio in cambios:
            did = (idx.get(k) or {}).get('discord_id')
            if did and sv in (donde.get(did) or []):
                mios.append(linea(raw, did, v, r, subio))
            elif not donde:
                mios.append(linea(raw, did, v, r, subio))
        if not mios:
            print('\n  %s (<#%s>): ninguno de los que cambió está en ese servidor'
                  % (sv, canal))
            continue

        # ⚠️ DISCORD CORTA EN 2.000 CARACTERES. Se parte por lineas enteras: un
        # mensaje cortado al medio de una mencion deja un `<@123` suelto.
        cabeza = '## 📊 Cambios de rango\n'
        tandas, actual = [], cabeza
        for l in mios:
            if len(actual) + len(l) + 1 > 1900:
                tandas.append(actual)
                actual = ''
            actual += l + '\n'
        tandas.append(actual)

        print('\n  %s (<#%s>): %d aviso(s) en %d mensaje(s)'
              % (sv, canal, len(mios), len(tandas)))
        for t in tandas:
            if not aplicar:
                print('\n'.join('      ' + x for x in t.strip().split('\n')))
                continue
            r = s.post('%s/channels/%s/messages' % (API, canal),
                       json={'content': t, 'allowed_mentions': {'parse': []}},
                       timeout=30)
            print('      %s %d caracteres' % ('✅' if r.ok else '❌%d' % r.status_code,
                                              len(t)))
            time.sleep(1.2)

    if aplicar or marcar:
        guardar(hoy)
        print('\n  foto actualizada -> %s' % os.path.relpath(PREVIOS, BASE))
    else:
        print('\n  (ensayo: no mandé nada ni moví la foto — usá --aplicar)')
    print('')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
