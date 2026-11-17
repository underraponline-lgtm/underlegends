# -*- coding: utf-8 -*-
"""🕵️ ¿QUIÉN ES ESTE NOMBRE? Todo lo que se sabe, en una pasada, sin escribir nada.

    python herramientas/quien_es.py LOKILLO                 el nombre
    python herramientas/quien_es.py LOKILLO --evento 654    y el servidor y la noche de ese evento
    python herramientas/quien_es.py --cuenta 1548906948307451906   una cuenta de Discord

Dlx, 17/11/2026, con LOKILLO del #654: *«take ur time and lets dig on this… Also create something so we avoid having to
dig under this again»*. Para contestar quién era hubo que juntar a mano siete cosas, y cada una cambiaba la respuesta:

  1. qué cuentas lo anotaron con ese nombre, y DE QUIÉN son (también las «otras cuentas» de `akas_a_mano.json`);
  2. a qué OTROS nombres anotó cada una de esas cuentas —la otra cuenta de Shadow anotó a SKONE, ZASKO, NAVAS y a
     Drexx 🇵🇪, que tiene su cuenta: anota a sus amigos, así que «la anotó Shadow» no dice «es Shadow»—;
  3. si el dueño de esa cuenta y este nombre jugaron alguna vez la misma llave (entonces son dos);
  4. qué cuentas de Discord se llaman así, si ya están en la Lista con otro nombre y si están en el servidor del evento
     —«lokillo_18» es YACO 🇧🇴 y no está en LKR, donde se jugó—;
  5. en qué servidores está cada cuenta y con qué apodo («DJ 🐉 (SHADOW)»);
  6. los eventos donde aparece ese nombre;
  7. lo que Dlx ya decidió que nombra la cuenta o el nombre.

⚠️ ES UNA INVESTIGACIÓN, NO UNA RESPUESTA. La identidad no se interpreta (CLAUDE.md, [[identidad-no-se-interpreta]]):
esto pone la evidencia a la vista para que Dlx elija. Lo mismo, resumido, sale solo en las Pistas de ✅ Decidir
(`decidir._pistas()`: `_otros_de_cuenta()`, `_jugaron_juntos()`, `_dueno_de_cuenta()`, `_en_discord(sv)`).

Sólo LEE: `datos/` y, para los puntos 4 y 5, Discord con el bot (GET). No escribe en ningún lado.
"""
import io
import json
import os
import re
import sys
import time
import unicodedata

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, 'bot'))
sys.path.insert(0, os.path.join(BASE, 'sheet'))


def norm(s):
    s = re.sub('[\U0001F1E6-\U0001F1FF]', '', re.sub(r'<a?:\w+:\d+>', '', str(s or '')))
    s = unicodedata.normalize('NFKD', s.lower())
    return re.sub(r'[^a-z0-9]', '', ''.join(c for c in s if not unicodedata.combining(c)))


def _json(nombre):
    try:
        with io.open(os.path.join(BASE, 'datos', nombre), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def _filas(nombre):
    d = _json(nombre)
    if isinstance(d, list):
        return d
    return d.get('filas') or next((v for v in d.values() if isinstance(v, list)), [])


def nombres_de(texto):
    """los nombres de una inscripción, sin bandera ni la nota de atrás («ÚLTIMA», «primera»)"""
    t = re.sub(r'\(.*?\)|\(.*$', ' ', str(texto or ''))
    t = re.sub(r'(?i)\b(ultima|última|primera|segunda)\b', ' ', t)
    return [x for x in (norm(p) for p in re.split(r'\s*(?:\+|&|,|/)\s*', t)) if len(x) >= 2]


class Datos:
    def __init__(self):
        self.lista = [f for f in _filas('t1_lista.json') if isinstance(f, list) and f]
        self.por_id = {str(f[4]): f[0] for f in self.lista if len(f) > 4 and f[4]}
        self.cuentas = (_json('akas_a_mano.json') or {}).get('cuentas') or {}
        self.insc = (_json('anuncios.json') or {}).get('inscripciones') or []
        self.res = [f for f in (_json('t1_resultados.json') or {}).get('filas') or [] if len(f) > 4]
        self.eventos = {str(f[0]): f for f in _filas('t1_eventos.json') if isinstance(f, list) and f}

    def dueno(self, did):
        """de quién es la cuenta: su fila de la Lista, o la persona que la tiene como «otra cuenta»"""
        did = str(did)
        if did in self.por_id:
            return self.por_id[did], 'su fila de la Lista'
        for p, ids in self.cuentas.items():
            if did in [str(x) for x in ids or []]:
                return p, 'otra cuenta de %s (akas_a_mano.json)' % p
        return None, ''

    def eventos_de(self, nombre):
        k = norm(nombre)
        return sorted({str(f[0]) for f in self.res if norm(f[4]) == k}, key=lambda x: int(x) if x.isdigit() else 0)

    def juntos(self, a, b):
        ev = {}
        for f in self.res:
            ev.setdefault(str(f[0]), set()).add(norm(f[4]))
        return sorted((n for n, s in ev.items() if norm(a) in s and norm(b) in s), key=lambda x: int(x) if x.isdigit() else 0)


def _sesion():
    try:
        import anuncios as A
        return A._sesion()
    except Exception as e:                                   # noqa: BLE001
        print('   (sin Discord: %s)' % str(e)[:80])
        return None


def _pedir(s, url, **kw):
    for _ in range(3):
        r = s.get(url, **kw)
        if r.status_code != 429:
            return r
        time.sleep(float(r.json().get('retry_after', 1)) + .3)
    return r


def cuenta(did, D, s=None, guilds=None, sv_evento=''):
    p, como = D.dueno(did)
    print('   🪪 cuenta %s · %s' % (did, ('es %s — %s' % (p, como)) if p else 'no está en la Lista'))
    otros = {}
    for i in D.insc:
        if str(i.get('discord_id')) == str(did):
            for n in nombres_de(i.get('texto')):
                otros.setdefault(n, (i.get('texto'), i.get('servidor'), (i.get('cuando') or '')[:10]))
    if otros:
        print('      anotó %d nombre(s): %s' % (len(otros), ', '.join('%s (%s %s)' % (re.sub('[\U0001F1E6-\U0001F1FF]', '', t).strip(), sv, c)
                                                                       for t, sv, c in list(otros.values())[:12])))
    if s and guilds:
        en = []
        for gid, (gn, sv) in guilds.items():
            r = _pedir(s, 'https://discord.com/api/v10/guilds/%s/members/%s' % (gid, did))
            if r.ok:
                m = r.json()
                u = m.get('user') or {}
                en.append(sv or gn[:20])
                print('      en %-22s «%s» · apodo «%s» · entró %s' % ((sv or gn)[:22], u.get('global_name') or u.get('username'),
                                                                     m.get('nick') or '—', (m.get('joined_at') or '')[:10]))
            time.sleep(.2)
        if sv_evento:
            print('      %s en el servidor del evento (%s)' % ('✅ está' if sv_evento in en else '❌ NO está', sv_evento))
    return p


def _guilds(s):
    """{guild_id: (nombre, sigla de la Liga si se sabe)}"""
    sv_de = {}
    # `servidores.json`: {"servidores": {sigla: {guild_id, …}}}
    for sigla, x in ((_json('servidores.json') or {}).get('servidores') or {}).items():
        if isinstance(x, dict) and x.get('guild_id'):
            sv_de[str(x['guild_id'])] = sigla
    out = {}
    r = _pedir(s, 'https://discord.com/api/v10/users/@me/guilds')
    for g in (r.json() if r.ok else []):
        out[g['id']] = (g['name'], sv_de.get(g['id'], ''))
    return out


def nombre(nom, D, evento=''):
    k = norm(nom)
    ev = D.eventos.get(str(evento)) if evento else None
    sv = ev[2] if ev and len(ev) > 2 else ''
    print('\n══ 🕵️ ¿QUIÉN ES «%s»?%s ══\n' % (nom, (' · evento #%s (%s, %s)' % (evento, sv, ev[3])) if ev else ''))
    lis = [f for f in D.lista if norm(f[0]) == k or (len(f) > 7 and norm(f[7]) == k)]
    print('1·  en la Lista: %s' % ('; '.join('%s (%s)' % (f[0], f[4] or 'sin cuenta') for f in lis) if lis else 'no'))
    evs = D.eventos_de(nom)
    print('2·  eventos con ese nombre: %d %s' % (len(evs), ('#' + ', #'.join(evs[-10:])) if evs else ''))
    print('3·  quién lo anotó:')
    cuentas = {}
    for i in D.insc:
        if k in nombres_de(i.get('texto')):
            cuentas.setdefault(str(i.get('discord_id')), []).append(i)
    if not cuentas:
        print('      nadie: no hay inscripción con ese nombre')
    s = _sesion()
    guilds = _guilds(s) if s else {}
    for did, xs in cuentas.items():
        print('      «%s» %d vez/veces, la última %s en %s, desde @%s' % (xs[0].get('texto'), len(xs), (xs[-1].get('cuando') or '')[:16],
                                                                      xs[-1].get('servidor'), xs[0].get('quien')))
        dueno = cuenta(did, D, s, guilds, sv)
        if dueno:
            jj = D.juntos(dueno, nom)
            print('      ⚔️ %s y «%s» %s' % (dueno, nom, ('jugaron la misma llave: #%s → son dos personas' % ', #'.join(jj)) if jj
                                                  else 'nunca jugaron la misma llave'))
    print('4·  cuentas de Discord que se llaman así:')
    if s and guilds:
        vistos = set()
        for gid, (gn, gsv) in guilds.items():
            r = _pedir(s, 'https://discord.com/api/v10/guilds/%s/members/search' % gid, params={'query': nom[:20], 'limit': 10})
            for m in (r.json() if r.ok else []):
                u = m.get('user') or {}
                if u.get('id') in vistos:
                    continue
                todos = [u.get('username'), u.get('global_name'), m.get('nick')]
                if not any(norm(x).startswith(k) for x in todos if x):
                    continue
                vistos.add(u.get('id'))
                print('      @%s («%s», apodo «%s»)' % (u.get('username'), u.get('global_name'), m.get('nick') or '—'))
                cuenta(u.get('id'), D, s, guilds, sv)
            time.sleep(.2)
        if not vistos:
            print('      ninguna en los servidores donde está el bot')
    dec = json.dumps(_json('decisiones.json'), ensure_ascii=False) + json.dumps(_json('akas_a_mano.json'), ensure_ascii=False)
    hits = [m.group(0) for m in re.finditer(r'.{0,140}%s.{0,160}' % re.escape(nom), dec, re.I)][:4]
    print('5·  lo que ya decidió Dlx que lo nombra: %s' % ('' if hits else 'nada'))
    for h in hits:
        print('      …%s…' % h.replace('\\n', ' '))
    print('\n⚠️ Es evidencia, no una respuesta: la identidad la decide Dlx (✅ Decidir).')


def main():
    args = [a for a in sys.argv[1:]]
    if not args or args[0] in ('-h', '--help'):
        print(__doc__)
        return
    D = Datos()
    if args[0] == '--cuenta' and len(args) > 1:
        s = _sesion()
        cuenta(args[1], D, s, _guilds(s) if s else {})
        return
    ev = ''
    if '--evento' in args:
        i = args.index('--evento')
        ev = args[i + 1] if i + 1 < len(args) else ''
        args = args[:i] + args[i + 2:]
    nombre(' '.join(args), D, ev)


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:                                        # noqa: BLE001
        pass
    main()
