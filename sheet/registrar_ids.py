# -*- coding: utf-8 -*-
"""VOLCAR AL OPERATIVO LOS IDS QUE EL BOT ANOTO.

    python sheet/registrar_ids.py             muestra que haria (no toca nada)
    python sheet/registrar_ids.py --aplicar   escribe

Cuando alguien corre /card y el bot no lo tiene, el Worker le deja el Discord
ID en la cola `reg:<id>` de KV (ver `anotar()` en bot/worker.js). Este script
la vacia hacia el Sheet Operativo. Es el segundo escritor del Sheet, junto con
`arreglar_operativo.py`, y por eso pide lo mismo: `--aplicar`, y guarda
respaldo antes de tocar.

⚠️ POR QUE NO LO HACE EL WORKER. Escribir el Sheet pide la clave de la cuenta
de servicio, que es privada; meterla en el Worker pondria una llave con acceso
al Sheet en el borde y tira abajo el «cero secretos» del bot. El Worker escribe
en su propio KV y este script —local, con creds— lo pasa al Sheet.

QUE HACE CON CADA ANOTADO
-------------------------
1. **Calza exacto y unico con alguien SIN id** -> le rellena el Discord ID en
   «Lista de Raperos». Es el unico caso que se escribe solo.
2. **Calza con alguien que YA tiene id**:
   - el mismo id  -> ya estaba; se saca de la cola y listo.
   - otro id      -> CONFLICTO; va a «Pendientes», no se pisa.
3. **Ese id ya esta en otra fila** -> CONFLICTO; a «Pendientes».
4. **No calza, o calza con varios** -> a «Pendientes» para que Dlx resuelva.

⚠️ NUNCA ESCRIBE UN ID ENCIMA DE OTRO NI ADIVINA UN MATCH AMBIGUO. Es la
leccion de toda esta etapa: el nombre de Discord coincide con el de OTRO
competidor mas seguido de lo que parece (9 sospechas, 6 falsas). Lo dudoso va a
Pendientes, con un humano decidiendo.

⚠️ EL ID SE ESCRIBE COMO TEXTO (raw=True). Un snowflake tiene 19 digitos y una
celda de numero lo redondea a 16 —el bug de `aze gian`—. RAW lo guarda tal cual
sin que Sheets lo interprete.
"""
import io
import json
import os
import sys
import time

import requests

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)

CUENTA = 'a85733396fd158a8e9660b02e20f33c8'
KV = 'a87399a3a0b647b0803aa90509ccce56'
KV_API = ('https://api.cloudflare.com/client/v4/accounts/%s/storage/kv/namespaces/%s'
          % (CUENTA, KV))
PENDIENTES = 'Pendientes'
SEP = None  # se compila abajo


def env(clave):
    for l in io.open(os.path.join(BASE, '.env'), encoding='utf-8'):
        if l.strip().startswith(clave + '='):
            return l.split('=', 1)[1].strip().strip('"\'')
    sys.exit('falta %s en .env' % clave)


def letra(i):
    """Indice de columna (0-based) a letra de columna A1."""
    s = ''
    i += 1
    while i:
        i, r = divmod(i - 1, 26)
        s = chr(65 + r) + s
    return s


def cola_kv(s):
    """Lee todas las claves `reg:` de KV con su valor. No borra."""
    claves, cursor = [], None
    while True:
        pars = {'limit': 1000, 'prefix': 'reg:'}
        if cursor:
            pars['cursor'] = cursor
        j = s.get(KV_API + '/keys', params=pars).json()
        if not j.get('success'):
            sys.exit('no pude listar KV: %s' % j.get('errors'))
        claves += [k['name'] for k in j.get('result') or []]
        cursor = (j.get('result_info') or {}).get('cursor')
        if not cursor:
            break
    out = []
    for k in claves:
        r = s.get('%s/values/%s' % (KV_API, k), timeout=30)
        if r.status_code == 200:
            try:
                out.append((k, json.loads(r.text)))
            except Exception:
                pass
    return out


def borrar_kv(s, clave):
    s.delete('%s/values/%s' % (KV_API, clave), timeout=30)


def candidatos(reg, norm):
    """Las formas normalizadas con las que intentar el match, de mejor a peor.

    El apodo del servidor es el que mas sirve —lo pone el staff— pero suele
    venir decorado («🐉 | Lil Drako», «#5 | Gus»), asi que se parte por los
    separadores que la gente usa, ademas del apodo entero. El username y el
    global_name van al final.
    """
    import re
    piezas = []
    for txt in (reg.get('nick'), reg.get('glob'), reg.get('user')):
        if not txt:
            continue
        piezas.append(norm(txt))
        for t in re.split(r'[|/·,#-]+', txt):
            n = norm(t)
            if n:
                piezas.append(n)
    # sin repetir, conservando el orden
    visto, out = set(), []
    for p in piezas:
        if p and p not in visto:
            visto.add(p)
            out.append(p)
    return out


def main():
    import gspread
    from google.oauth2.service_account import Credentials
    import construir_padron as PAD
    try:
        import construir_akas as AK
        akas = AK.cargar()
    except Exception:
        akas = {}

    aplicar = '--aplicar' in sys.argv

    s = requests.Session()
    s.headers['Authorization'] = 'Bearer ' + env('CLOUDFLARE_API_TOKEN')
    anotados = cola_kv(s)
    print('\n%d ID en la cola del bot (`reg:`)' % len(anotados))
    if not anotados:
        print('  nada que volcar\n')
        return

    cred = os.path.join(BASE, 'creds.json')
    if not os.path.exists(cred):
        sys.exit('falta creds.json en la raiz del proyecto')
    scope = (['https://www.googleapis.com/auth/spreadsheets'] if aplicar
             else ['https://www.googleapis.com/auth/spreadsheets.readonly'])
    gc = gspread.authorize(Credentials.from_service_account_file(cred, scopes=scope))
    ws = gc.open_by_key(PAD.OPERATIVO).worksheet(PAD.HOJA)
    val = ws.get_all_values()
    cab = PAD._cabecera(val)
    H = [x.strip() for x in val[cab]]
    iR = H.index('Rapero')
    iID = H.index('Discord ID')

    # nombre normalizado -> (fila 1-based, id actual). Con alias resueltos.
    porn, id_en_uso = {}, {}
    alias = (akas.get('alias') or {})
    for f in range(cab + 1, len(val)):
        fila = val[f]
        raw = (fila[iR] if len(fila) > iR else '').strip()
        if not raw:
            continue
        did = (fila[iID] if len(fila) > iID else '').strip()
        clave = PAD.norm(alias.get(PAD.norm(raw), raw))
        porn[clave] = (f + 1, did)
        if did:
            id_en_uso[did] = raw

    rellenar = []     # (fila, id, nombre, reg_key)
    pendientes = []   # (tipo, detalle, match, reg_key)
    ya_estaba = []    # reg_key (mismo id, nada que hacer)

    for k, reg in anotados:
        did = str(reg.get('id') or '').strip()
        if not did:
            continue
        etiqueta = reg.get('nick') or reg.get('glob') or reg.get('user') or did
        # ¿ese id ya está puesto en alguna fila?
        if did in id_en_uso:
            ya_estaba.append(k)
            continue
        matches = []
        for c in candidatos(reg, PAD.norm):
            if c in porn and porn[c] not in [m[1] for m in matches]:
                matches.append((c, porn[c]))
        if len(matches) == 1:
            fila, id_actual = matches[0][1]
            if id_actual and id_actual != did:
                pendientes.append(('conflicto', '%s = %s' % (etiqueta, did),
                                   'la fila ya tiene %s' % id_actual, k))
            elif id_actual == did:
                ya_estaba.append(k)
            else:
                nombre = val[fila - 1][iR].strip()
                rellenar.append((fila, did, nombre, k))
        elif len(matches) > 1:
            quienes = ', '.join(val[m[1][0] - 1][iR].strip() for m in matches)
            pendientes.append(('ambiguo', '%s = %s' % (etiqueta, did),
                               'calza con: %s' % quienes, k))
        else:
            pendientes.append(('alta', '%s = %s' % (etiqueta, did),
                               'sv %s' % (reg.get('sv') or '?'), k))

    print('  %d se rellenan solos (match exacto, sin id)' % len(rellenar))
    for _, did, nombre, _ in rellenar:
        print('     %-20s <- %s' % (nombre, did))
    print('  %d ya estaban (mismo id) — se sacan de la cola' % len(ya_estaba))
    print('  %d van a «Pendientes» para que decidas' % len(pendientes))
    for tipo, det, match, _ in pendientes:
        print('     [%-9s] %-28s %s' % (tipo, det, match))

    if not aplicar:
        print('\n  (nada escrito — corré con --aplicar)\n')
        return

    # ── respaldo de la columna de IDs antes de tocar ──────────────────────
    resp = {'cuando': time.strftime('%Y-%m-%d %H:%M'), 'hoja': PAD.HOJA,
            'ids': [(val[f][iR], val[f][iID] if len(val[f]) > iID else '')
                    for f in range(cab + 1, len(val)) if len(val[f]) > iR and val[f][iR].strip()]}
    rp = os.path.join(BASE, 'docs', 'respaldo_ids_%s.json' % time.strftime('%Y%m%d_%H%M'))
    with io.open(rp, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(resp, f, ensure_ascii=False, indent=1)
    print('\n  respaldo -> %s' % os.path.relpath(rp, BASE))

    # ── 1. rellenar ids (RAW: como texto, para no perder digitos) ─────────
    for fila, did, nombre, k in rellenar:
        ws.update([[str(did)]], '%s%d' % (letra(iID), fila), raw=True)
        borrar_kv(s, k)
        print('  escrito %s en %s' % (did, nombre))

    # ── 2. los que ya estaban: fuera de la cola ───────────────────────────
    for k in ya_estaba:
        borrar_kv(s, k)

    # ── 3. pendientes: una fila por cada uno, sin pisar nada ──────────────
    if pendientes:
        try:
            wp = gc.open_by_key(PAD.OPERATIVO).worksheet(PENDIENTES)
            for tipo, det, match, k in pendientes:
                wp.append_row(['', tipo, 'bot /card', det, match, 'pendiente'],
                              value_input_option='RAW')
                borrar_kv(s, k)
            print('  %d fila(s) agregadas a «%s»' % (len(pendientes), PENDIENTES))
        except Exception as e:
            print('  ⚠️ no pude escribir en «%s»: %s' % (PENDIENTES, e))
            print('     (los `reg:` de esos quedan en la cola para el próximo intento)')

    print('\n  listo. Después conviene:  python sheet/construir_padron.py\n')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
