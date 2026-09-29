# -*- coding: utf-8 -*-
"""El sitio del remake con los datos DE VERDAD: lo que hoy sirven `/api/lobby` y `/api/muro`.

Dlx, 29/09/2026: *«usa información real y tarjetas reales para ver más
precisamente»*, y *«que la cabecera, la parte de arriba, esté en negro; sólo la
de arriba, no la de los servidores»*.

    from reales import Liga, Rutas
    liga = Liga(lobby, muro, escena, ahora)        # los JSON tal cual los sirve la web
    html = liga.pagina('inicio', pc=False, rutas=Rutas(carta=..., av=...))

⚠️ ESTE ARCHIVO NO GUARDA NINGÚN DATO DE NADIE: los lee del payload público. Las
tarjetas y las caras las baja quien arma la maqueta (`Rutas`), y quedan fuera del
repo: son fotos de gente real (ver «R2 es la fuente y comun/fotos/ el espejo local,
gitignoreado» en CLAUDE.md).

Qué cambia contra `sitio.py` (la maqueta con gente inventada), además de los datos:

- **El en vivo dice lo que el sistema sabe.** La maqueta inventaba «Kairos vs
  Nébula, cuartos, ronda 3 de 4»: la llave recién existe cuando se procesa. En
  vivo se sabe el evento, el servidor y a qué hora empezó; la llave, después.
- **Quien no tiene carta se ve sin carta.** El campeón de anoche puede no estar
  verificado: va con su foto (o su inicial) y la etiqueta, nunca con una carta
  inventada.
- **Nada con números de mentira**: las reacciones van sin contador, las encuestas
  sin porcentajes (no son públicos) y «a quién seguís» es de ejemplo.
- **Esta semana**: los multiplicadores, el evento dorado, la guerra de servidores
  y la meta de comunidad, que ya existen y la portada no mostraba.
- **La Mercancía no tiene prendas** (Dlx: *«aún no hay mercancía»*): una línea.
- **Los que mandan tiene flechas** (Dlx, 29/09 ~6:30 PM): las siete categorías del
  podio de la web de hoy, con cinco en vez de tres. Y **el panel de abajo también**:
  Misiones + el Pase, tus eventos + tu temporada y la Liga en números. Las Misiones y
  el Pase todavía no existen: van **de ejemplo** y lo dicen; el progreso de las
  Misiones sí es el de verdad, sacado de las llaves de la semana.
- **Se busca, los servidores y el pie van en negro**: los afiches pasan a papel sobre
  la pared.
"""
import datetime as dt
import os
import re
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bocetos as B  # noqa: E402
import portada as P  # noqa: E402
import sitio as S  # noqa: E402

ET = dt.timezone(dt.timedelta(hours=-4))          # EDT: Dlx lee todo en hora del este
DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre',
         'noviembre', 'diciembre']
PAIS = {'ar': 'Argentina', 'co': 'Colombia', 'cl': 'Chile', 've': 'Venezuela', 'mx': 'México', 'pe': 'Perú',
        'uy': 'Uruguay', 'ec': 'Ecuador', 'bo': 'Bolivia', 'py': 'Paraguay', 'us': 'Estados Unidos', 'es': 'España',
        'do': 'Rep. Dominicana', 'pa': 'Panamá', 'pr': 'Puerto Rico', 'cr': 'Costa Rica', 'gt': 'Guatemala',
        'hn': 'Honduras', 'sv': 'El Salvador', 'ni': 'Nicaragua', 'cu': 'Cuba', 'br': 'Brasil', 'ae': 'Emiratos',
        'no': 'Noruega'}
_BANDERAS = {}


FUERA = re.compile('[%s-%s%s-%s%s%s%s%s%s-%s%s%s%s]' % tuple(chr(c) for c in (
    0x1F000, 0x1FAFF,          # emojis, banderas incluidas
    0x2600, 0x27BF,            # símbolos y dingbats
    0xFE0F, 0x20E3,            # el selector de emoji y la tecla de «1️⃣»
    0x3164, 0x2800,            # los rellenos invisibles que usan algunos nombres
    0x2070, 0x209F,            # superíndices («⁷⁷⁷»)
    0xB9, 0xB2, 0xB3)))


def limpio(s):
    """Sin emojis ni rellenos invisibles: «RIZAS 🇻🇪» -> «RIZAS», «🗓️ Lunes de la Liga» -> «Lunes de la Liga»."""
    s = FUERA.sub('', s or '')
    return re.sub(r'\s+', ' ', s).strip(' ·-')


def recorte(s, n=120):
    """Un texto que llega cortado del payload se corta en la última palabra entera, con puntos suspensivos."""
    s = limpio(s).replace('*', '')
    if len(s) <= n and not re.search(r'\s\S{1,2}$', s):
        return s
    return s[:n].rsplit(' ', 1)[0].rstrip(' ,.;:') + '…'


def num(n):
    return '{:,}'.format(int(n)).replace(',', '.')


def mult(x):
    return ('×%s' % ('%g' % x)).replace('.', ',')


def bandera(cc):
    if cc not in _BANDERAS:
        ruta = os.path.join(P.PAG, 'banderas', 'g', '%s.webp' % cc)
        _BANDERAS[cc] = P.dato('banderas/g/%s.webp' % cc, 'image/webp') if cc and os.path.exists(ruta) else ''
    return _BANDERAS[cc]


def utc(s):
    s = s.replace('Z', '+00:00')
    t = dt.datetime.fromisoformat(s)
    return t if t.tzinfo else t.replace(tzinfo=dt.timezone.utc)


class Rutas:
    """Dónde están las copias de las tarjetas y de las caras (las baja quien arma la maqueta)."""

    def __init__(self, carta=None, av=None):
        self.carta = carta or (lambda k, cual: None)
        self.av = av or (lambda k: None)


class Liga:
    def __init__(self, lobby, muro, escena, ahora, yo=None, sigue=()):
        self.d, self.muro, self.escena, self.ahora = lobby, muro.get('items', []), escena, ahora
        self.T = {r['k']: r for r in lobby['tabla']}
        self.N = {limpio(r['n']).lower(): r for r in lobby['tabla']}
        self.svs = {s['sv']: s for s in lobby['svs']}
        self.yo = self.T.get(yo) if yo else None
        self.sigue = [k for k in sigue if k in self.T]
        self.r = Rutas()
        self.pedidas = set()        # (k, carta) y (k, 'av'): lo que la página quiso dibujar, para bajarlo

    # ── utilidades de datos ────────────────────────────────────────────────
    def fila(self, nombre):
        return self.N.get(limpio(nombre).lower())

    def oficiales(self):
        return sorted([f for f in self.d['tabla'] if f.get('pos')], key=lambda f: f['pos'])

    def hora(self, t):
        return utc(t).astimezone(ET).strftime('%H:%M')

    def cuando(self, t):
        """«hace 15 min», «anoche», «ayer»… contado en hora del este."""
        t = utc(t)
        seg = (self.ahora - t).total_seconds()
        if seg < 0:
            return self.dia(t)
        if seg < 3600:
            return 'hace %d min' % max(1, seg // 60)
        a, b = self.ahora.astimezone(ET), t.astimezone(ET)
        dias = (a.date() - b.date()).days
        if dias == 0:
            return 'anoche' if b.hour < 6 else 'hace %d h' % (seg // 3600)
        if dias == 1:
            return 'anoche' if b.hour >= 20 else 'ayer'
        return 'el %s' % DIAS[b.weekday()]

    def dia(self, t):
        a, b = self.ahora.astimezone(ET), utc(t).astimezone(ET)
        dias = (b.date() - a.date()).days
        if dias == 0:
            return 'hoy %s' % b.strftime('%H:%M')
        if dias == 1:
            return 'mañana %s' % b.strftime('%H:%M')
        return '%s %d · %s' % (DIAS[b.weekday()], b.day, b.strftime('%H:%M'))

    def vivo(self):
        m = self.d.get('vivo_min', 90)
        return [e for e in self.d['proximos'] if 0 <= (self.ahora - utc(e['cuando'])).total_seconds() <= m * 60]

    def luego(self):
        return [e for e in self.d['proximos'] if utc(e['cuando']) > self.ahora]

    def llaves(self):
        return sorted(self.d['llaves'].values(), key=lambda ll: -int(ll['n']))

    def campeon(self, ll):
        t = ll.get('tabla') or []
        gana = [limpio(x[0]) for x in t if x[1] == 'Campeón']
        return gana or ([limpio(t[0][0])] if t else [])

    def fecha_llave(self, ll):
        for e in self.d['calendario']:
            if e.get('ll') == ll['n']:
                return e['t']
        return ll['dia'] + 'T23:00:00Z'

    def mult_sv(self, sv):
        return (self.d.get('mult') or {}).get('sv', {}).get(sv)

    def dorado(self):
        """El evento dorado de la semana: el primero de ese servidor desde la fecha."""
        g = (self.d.get('mult') or {}).get('dorado')
        if not g:
            return None
        desde = utc(g['desde'])
        cand = [e for e in self.d['calendario'] if e['sv'] == g['sv'] and utc(e['t']) >= desde]
        return min(cand, key=lambda e: e['t']) if cand else None

    def es_dorado(self, nombre, sv):
        g = self.dorado()
        return bool(g and g['sv'] == sv and limpio(g['n']) == limpio(nombre))

    def h2h(self, k):
        """Los cara a cara de alguien, sacados de las llaves que viajan en el payload."""
        yo = limpio(self.T[k]['n']).lower()
        res = {}
        for ll in sorted(self.d['llaves'].values(), key=lambda x: int(x['n'])):
            for r in ll['rondas']:
                for b in r['b']:
                    lados = [x if isinstance(x, str) else ' & '.join(x) for x in b[0]]
                    g = b[1] if isinstance(b[1], str) else ' & '.join(b[1])
                    nom = [limpio(x).lower() for x in lados]
                    if yo in nom and len(lados) == 2:
                        otro = limpio(lados[1 - nom.index(yo)])
                        v = res.setdefault(otro, {'g': 0, 'p': 0, 'ult': ''})
                        gane = limpio(g).lower() == yo
                        v['g' if gane else 'p'] += 1
                        ronda = {'Final': 'en la final', 'Tercer puesto': 'por el tercer puesto'}.get(r['r'], 'en ' + r['r'].lower())
                        v['ult'] = '%s %s de %s' % ('le ganaste' if gane else 'te ganó', ronda, limpio(ll['nombre']))
        return res

    def semana_de(self, k):
        yo = limpio(self.T[k]['n']).lower()
        out = []
        for ll in self.llaves():
            for fila in ll.get('tabla', []):
                if limpio(fila[0]).lower() == yo:
                    out.append((ll, fila[1], fila[2]))
        return out

    def buscado(self, k):
        for b in (self.d.get('mw') or {}).get('b', []):
            if b['k'] == k:
                return b
        return None

    # ── piezas chicas ───────────────────────────────────────────────────────
    def carta(self, k, cual='temporada', cls='ci', alto=None):
        f = self.T.get(k)
        if f and cual in (f.get('c') or []):
            self.pedidas.add((k, cual))
        src = self.r.carta(k, cual) if f and cual in (f.get('c') or []) else None
        if not src:
            return self.sin_carta(f['n'] if f else k, k, f['cc'] if f else '', cls)
        return '<img class="%s" alt="Carta %s de %s" src="%s" loading="lazy">' % (cls, cual, f['n'], src)

    def cara(self, k, nombre, cls='cara'):
        if k and (self.T.get(k) or {}).get('av'):
            self.pedidas.add((k, 'av'))
        src = self.r.av(k) if k else None
        if src:
            return '<span class="%s"><img alt="" src="%s"></span>' % (cls, src)
        return '<span class="%s ini">%s</span>' % (cls, (limpio(nombre)[:1] or '?').upper())

    def sin_carta(self, nombre, k, cc, cls='ci'):
        """Quien no tiene carta (no se verificó todavía): su cara, su nombre y la etiqueta. Nunca una carta inventada."""
        b = bandera(cc)
        return ('<div class="%s sincarta">%s<b>%s</b>%s<small>SIN CARTA</small></div>'
                % (cls, self.cara(k, nombre, 'sc-cara'), limpio(nombre),
                   '<img class="sc-flag" alt="" src="%s">' % b if b else ''))

    def rango(self, rg):
        if not rg:
            return '<span class="rg sinl" title="Sin letra: le faltan eventos">–</span>'
        return '<span class="rg" style="background:%s">%s</span>' % (P.RANGO[rg], rg)

    def logo(self, sv):
        return P.SV.get((sv or '').lower(), '')

    def sec(self, id_, titulo, enlace, cuerpo, extra=''):
        return ('<section class="sec %s" id="%s"><div class="sec-t"><h2>%s</h2><a>%s %s</a></div>%s</section>'
                % (extra, id_, titulo, enlace, P.ico('flecha', 16), cuerpo))

    # ── la cabecera negra, las historias y la barra ─────────────────────────
    def cabecera(self, pc, activa):
        marca = ('<div class="marca"><img alt="" src="%s"><span class="lockup"><b>DISCORD RAP</b> <b>EN ESPAÑOL</b>'
                 '<small class="lg">LIGA GLOBAL · T1</small></span></div>' % P.UL)
        campana = '<span class="btn-ico">%s</span>' % P.ico('campana', 20)
        if pc:
            quien = ('<a class="yo-chip">%s<span>%s</span></a>' % (self.cara(self.yo['k'], self.yo['n'], 'cara'), self.yo['n'])
                     if self.yo else '<a class="btn verde chico">Entrar</a>')
            return ('<header class="cab negra">%s%s<div class="cab-der"><span class="buscar">%s Buscar rapero</span>%s%s</div>'
                    '</header>' % (marca, S.menu(activa), P.ico('buscar', 18), campana, quien))
        return ('<header class="cab negra">%s<div class="cab-der">%s<button class="btn-ico hamb" type="button" aria-label="Menú">%s'
                '</button></div></header>' % (marca, campana, S.ico('menu', 22)))

    def tabbar(self, activa):
        out = []
        for n, k in S.TABS:
            icono = S.ico(k)
            if k == 'yo' and self.yo and self.r.av(self.yo['k']):
                icono = '<img class="tab-av" alt="" src="%s">' % self.r.av(self.yo['k'])
            out.append('<a class="%s">%s<span>%s</span></a>' % ('on' if k == activa else '', icono, n))
        return '<nav class="tabbar">%s</nav>' % ''.join(out)

    def novedades_gente(self):
        """Las caras de la fila de arriba: gente con algo nuevo hoy (carta, letra, título, caza)."""
        vistos, out = set(), []
        yo = self.yo['k'] if self.yo else ''
        for it in self.muro:
            etiqueta = {'tarjeta': 'carta nueva', 'campeon': 'campeón', 'caza': 'cazó', 'rango': 'rango %s' % it.get('rg', '')}.get(it['tipo'])
            if not etiqueta:
                continue
            for q, k in zip(it.get('quien', []), it.get('ks', [])):
                if k in vistos or k == yo:
                    continue
                vistos.add(k)
                out.append((k, limpio(q), etiqueta))
        return out

    def sv_de(self, it):
        """El servidor de una novedad: el suyo, o el de la persona."""
        if it.get('sv'):
            return it['sv']
        for k in it.get('ks', []):
            if k in self.T:
                return self.T[k]['sv']
        return ''

    def muro_limpio(self):
        """El muro sin la carta Competitiva que llega con la primera letra (va adentro de la noticia de la letra)."""
        return [o for o in self.muro if not (o['tipo'] == 'tarjeta' and any(
            p['tipo'] == 'rango' and p.get('ks') == o.get('ks') and p['t'] == o['t'] for p in self.muro))]

    def slide(self, tag, cuerpo, cuando='', cta=''):
        return {'html': '<div class="st"><span class="st-tag">%s</span>%s</div>' % (tag, cuerpo), 'cuando': cuando, 'cta': cta}

    def slides_de(self, items):
        """Una historia por novedad; las cartas que llegan juntas, en una sola."""
        grupos = []
        for it in items:
            if grupos and it['tipo'] == 'tarjeta' and grupos[-1][0]['tipo'] == 'tarjeta' and grupos[-1][0]['t'] == it['t']:
                grupos[-1].append(it)
            else:
                grupos.append([it])
        out = []
        for g in grupos:
            it = g[0]
            q = [limpio(x) for x in it.get('quien', [])]
            ks = it.get('ks', [])
            c = self.cuando(it['t'])
            if it['tipo'] == 'tarjeta' and len(g) > 1:
                quienes = []
                for o in g:
                    if limpio(o['quien'][0]) not in quienes:
                        quienes.append(limpio(o['quien'][0]))
                out.append(self.slide('CARTAS NUEVAS', '<div class="st-minis">%s</div><h3 class="st-h">%s ya tienen sus cartas</h3>'
                                      % (''.join(self.carta(o['ks'][0], o['carta'], 'st-mini-c') for o in g[:4]),
                                         ' y '.join([', '.join(quienes[:-1]), quienes[-1]]) if len(quienes) > 1 else quienes[0]),
                                      c, 'Ver sus perfiles'))
            elif it['tipo'] == 'tarjeta':
                nombre = {'pais': 'de País', 'temporada': 'de Temporada', 'servidor': 'de Servidor', 'competitivo': 'Competitiva'}[it['carta']]
                out.append(self.slide('CARTA NUEVA', '%s<h3 class="st-h">%s ya tiene su carta %s</h3>'
                                      % (self.carta(ks[0], it['carta'], 'st-carta'), q[0], nombre), c, 'Ver su perfil'))
            elif it['tipo'] == 'rango':
                f = self.T.get(ks[0]) if ks else None
                vis = (self.carta(ks[0], 'competitivo', 'st-carta') if f and 'competitivo' in (f.get('c') or [])
                       else '<span class="st-rg" style="background:%s">%s</span>' % (P.RANGO[it['rg']], it['rg']))
                txt = ('%s consigue su primera letra: %s' if it.get('primero') else '%s pasa a rango %s') % (q[0], it['rg'])
                out.append(self.slide('RANGO', '%s<h3 class="st-h">%s</h3>' % (vis, txt), c, 'Ver su perfil'))
            elif it['tipo'] == 'campeon':
                ll = self.d['llaves'].get(str(it.get('ll'))) or {}
                k = ks[0] if ks else ''
                f = self.T.get(k)
                vis = (self.carta(k, 'temporada', 'st-carta') if f and 'temporada' in (f.get('c') or [])
                       else self.cara(k, q[0], 'st-cara'))
                podio = ''.join('<li><b>%d</b>%s</li>' % (i + 1, limpio(z[0])) for i, z in enumerate(ll.get('tabla', [])[:3]))
                out.append(self.slide('CAMPEÓN · %s' % it['sv'], '<h3 class="st-h">%s</h3>%s<b class="st-nom">%s</b>'
                                      '<small class="st-s">%d raperos</small><ol class="st-podio">%s</ol>'
                                      % (limpio(it['ev']), vis, ' y '.join(q), it.get('part', 0), podio), c, 'Ver la llave'))
            elif it['tipo'] == 'caza':
                a = self.fila(it['a'])
                out.append(self.slide('SE BUSCA · CAZADO', '<div class="st-caza">%s<span class="sello">CAZADO</span></div>'
                                      '<h3 class="st-h">%s cazó a %s</h3><small class="st-s">%s · cobra %s</small>'
                                      % (self.cara(a['k'] if a else '', it['a'], 'st-cara'), q[0], it['a'], it['cat'], num(it['pts'])),
                                      c, 'Ver Se busca'))
            elif it['tipo'] == 'anuncio':
                e = next((x for x in self.d['proximos'] if limpio(x['nombre']) == limpio(it['ev'])), None)
                cuando_ev = ''
                if e:
                    cuando_ev = 'en vivo desde las %s' % self.hora(e['cuando']) if e in self.vivo() else self.dia(e['cuando'])
                    if e.get('modalidad'):
                        cuando_ev += ' · ' + e['modalidad']
                dor = '<span class="st-dor">EVENTO DORADO ×3</span>' if self.es_dorado(it['ev'], it['sv']) else ''
                out.append(self.slide('ANUNCIÓ · %s' % it['sv'], '<img class="st-logo" alt="" src="%s"><h3 class="st-h">%s</h3>%s'
                                      '<small class="st-s">%s</small>' % (self.logo(it['sv']), limpio(it['ev']), dor, cuando_ev or c),
                                      c, 'Quiero aviso'))
        return out

    def crew_circulo(self, c, cls='h-c'):
        if c.get('logo') and os.path.exists(os.path.join(P.PAG, c['logo'])):
            return '<span class="%s"><img alt="" src="%s"></span>' % (cls, P.dato(c['logo'], 'image/webp'))
        p = limpio(c['crew']).split()
        mono = (p[0][0] + p[1][0]) if len(p) > 1 else p[0][:2]
        return '<span class="%s mono">%s</span>' % (cls, mono.upper())

    def grupos_historias(self):
        """Lo que se abre al tocar cada círculo de arriba. Todo sale del payload público."""
        if getattr(self, '_grupos', None) is not None:
            return self._grupos
        muro = [it for it in self.muro_limpio() if it['tipo'] in ('campeon', 'anuncio', 'caza', 'tarjeta', 'rango')]
        grupos = []
        for e in self.vivo():
            m = self.mult_sv(e['sv'])
            s1 = self.slide('EN VIVO AHORA · %s' % e['sv'], '<img class="st-logo grande" alt="" src="%s"><h3 class="st-h grande">%s</h3>'
                            '<small class="st-s">Empezó a las %s%s. La llave aparece acá apenas la carguen.</small>'
                            % (self.logo(e['sv']), limpio(e['nombre']), self.hora(e['cuando']),
                               (' · %s esta semana' % mult(m)) if m else ''), 'ahora', 'Mirar en Discord')
            circulo = ('<a class="h en-vivo" data-h="vivo"><span class="h-w"><span class="h-c"><img alt="" src="%s"></span>'
                       '<span class="h-badge">EN VIVO</span></span><small>%s</small></a>' % (self.logo(e['sv']), limpio(e['nombre'])))
            grupos.append({'id': 'vivo', 'tipo': 'vivo', 'nombre': 'En vivo · %s' % e['sv'], 'slides': [s1], 'circulo': circulo})
        mm = self.d.get('mult') or {}
        for s in sorted(self.svs.values(), key=lambda x: -x['n']):
            sv = s['sv']
            slides = []
            m = mm.get('sv', {}).get(sv)
            lineas = []
            g = self.dorado()
            if g and g['sv'] == sv:
                lineas.append('<li><b>DORADO ×3</b>%s, %s</li>' % (limpio(g['n']), self.dia(g['t'])))
            rival = next((p[1] if p[0] == sv else p[0] for p in (mm.get('guerra') or {}).get('pares', []) if sv in p), None)
            if rival:
                lineas.append('<li><b>GUERRA</b>contra %s: gana el que más puntos hace por persona</li>' % rival)
            meta = (mm.get('metas') or {}).get(sv)
            if meta:
                va = (mm.get('meta_va') or {}).get(sv, 0)
                lineas.append('<li><b>META</b>%d de %d personas%s</li>' % (va, meta, ' · cumplida' if va >= meta else ''))
            if m or lineas:
                slides.append(self.slide('ESTA SEMANA · %s' % sv, '<img class="st-logo" alt="" src="%s">%s<ul class="st-l">%s</ul>'
                                         % (self.logo(sv), '<b class="st-mult %s">%s</b>' % ('sube' if m and m > 1 else 'baja', mult(m)) if m else '',
                                            ''.join(lineas)), 'lunes', 'Lunes de la Liga'))
            propios = [it for it in muro if self.sv_de(it) == sv]
            slides += self.slides_de(propios)[:6]
            if not propios:
                slides.append(self.slide(s['nombre'].upper(), '<img class="st-logo grande" alt="" src="%s"><h3 class="st-h">Todavía sin '
                                         'eventos en la T1</h3><small class="st-s">%s</small>' % (self.logo(sv), s.get('tag', '').capitalize()),
                                         '', 'Entrar al servidor'))
            circulo = ('<a class="h sv %s" data-h="sv-%s"><span class="h-c"><img alt="" src="%s"></span><small>%s</small></a>'
                       % ('nuevo' if propios else '', sv.lower(), self.logo(sv), sv))
            grupos.append({'id': 'sv-' + sv.lower(), 'tipo': 'sv', 'nombre': s['nombre'], 'slides': slides, 'circulo': circulo})
        for c in sorted(self.d.get('crews', []), key=lambda x: -x['pts'])[:6]:
            ks = {self.fila(n)['k'] for n in c['gente'] if self.fila(n)}
            gente = ''.join('<li>%s<span>%s</span></li>' % (self.cara(self.fila(n)['k'] if self.fila(n) else '', n, 'st-mini'), limpio(n))
                            for n in c['gente'][:8])
            slides = [self.slide('CREW', '%s<h3 class="st-h">%s</h3><small class="st-s">%d %s · %s pts · el mejor: %s</small><ul class="st-gente">%s</ul>'
                                 % (self.crew_circulo(c, 'st-crew'), limpio(c['crew']).upper(), c['n'], 'raperos' if c['n'] != 1 else 'rapero',
                                    num(c['pts']), limpio(c['mejor']), gente), 'esta temporada', 'Ver la crew')]
            propios = [it for it in muro if set(it.get('ks', [])) & ks]
            slides += self.slides_de(propios)[:3]
            sin_tilde = unicodedata.normalize('NFKD', limpio(c['crew']).lower()).encode('ascii', 'ignore').decode()
            clave = re.sub(r'[^a-z0-9]+', '-', sin_tilde).strip('-')
            circulo = ('<a class="h crew %s" data-h="crew-%s">%s<small>%s</small></a>'
                       % ('nuevo' if propios else '', clave, self.crew_circulo(c), limpio(c['crew'])))
            grupos.append({'id': 'crew-' + clave, 'tipo': 'crew', 'nombre': limpio(c['crew']), 'slides': slides, 'circulo': circulo})
        for k, n, et in self.novedades_gente()[:8]:
            propios = [it for it in muro if k in it.get('ks', [])]
            circulo = ('<a class="h gente nuevo" data-h="p-%s">%s<small>%s</small><em>%s</em></a>' % (k, self.cara(k, n, 'h-c'), n, et))
            grupos.append({'id': 'p-' + k, 'tipo': 'gente', 'nombre': n, 'slides': self.slides_de(propios)[:4], 'circulo': circulo})
        self._grupos = [g for g in grupos if g['slides']]
        return self._grupos

    def historias(self, pc):
        partes, antes = [], None
        for g in self.grupos_historias():
            if antes and g['tipo'] != antes:
                partes.append('<span class="h-sep" aria-hidden="true"></span>')
            antes = g['tipo']
            partes.append(g['circulo'])
        return '<nav class="historias" aria-label="Historias: en vivo, servidores, crews y gente">%s</nav>' % ''.join(partes)

    def historias_json(self):
        """Lo que lee el visor de historias. `</` se escapa para que no cierre el <script>."""
        import json
        datos = [{'id': g['id'], 'nombre': g['nombre'], 'slides': g['slides']} for g in self.grupos_historias()]
        return json.dumps(datos, ensure_ascii=False).replace('</', '<\\/')

    # ── Inicio ─────────────────────────────────────────────────────────────
    def cuadro_mini(self, ll):
        """Los cruces en un cuadro compacto: cuartos, semis, final y el campeón, con líneas. El camino del campeón se
        ilumina; en vivo, el primer cruce sin ganador es el de AHORA y el siguiente, el que SIGUE."""
        rondas = [r for r in ll['rondas'] if r['r'] not in ('Filtros', 'Tercer puesto', 'Clasificatorias', 'Preliminares')][-3:]
        lados = lambda b: [limpio(z if isinstance(z, str) else ' & '.join(z)) for z in b[0][:2]]
        gana = lambda b: limpio(b[1] if isinstance(b[1], str) else ' & '.join(b[1]))
        regular = rondas and all(len(rondas[i + 1]['b']) * 2 == len(rondas[i]['b']) for i in range(len(rondas) - 1))
        if not regular:
            return self.cuadro(ll)
        W, G, R, HB, TOP, CAMP = 94, 18, 30, 46, 22, 92
        n0 = len(rondas[0]['b'])
        campeon = gana(rondas[-1]['b'][0])
        pendientes = [(ci, j) for ci, r in enumerate(rondas) for j, b in enumerate(r['b']) if not gana(b)]
        ahora = pendientes[0] if pendientes else None
        sigue = pendientes[1] if len(pendientes) > 1 else None
        cajas, lineas, etiquetas = [], [], []
        alto = 2 * n0 * R + TOP
        for ci, r in enumerate(rondas):
            x = ci * (W + G)
            etiquetas.append('<b class="cm-r" style="left:%dpx">%s</b>' % (x, r['r'].upper()))
            for j, b in enumerate(r['b']):
                y = TOP + R * (2 ** ci) * (2 * j + 1)
                g = gana(b)
                estado = 'ahora' if (ci, j) == ahora else ('sigue' if (ci, j) == sigue else '')
                filas = ''.join('<span class="%s%s">%s</span>' % ('g' if g and x_ == g else ('x' if g else ''),
                                                                  ' camino' if x_ == campeon and g else '', x_) for x_ in lados(b))
                marca = {'ahora': '<i>AHORA</i>', 'sigue': '<i>SIGUE</i>'}.get(estado, '')
                cajas.append('<div class="cm-m %s" style="left:%dpx;top:%dpx">%s%s</div>' % (estado, x, y - HB // 2, filas, marca))
                x1, x2 = x + W, x + W + G // 2
                if ci < len(rondas) - 1:
                    yp = TOP + R * (2 ** (ci + 1)) * (2 * (j // 2) + 1)
                    x3 = x + W + G
                else:
                    yp, x3 = y, x + W + G
                cls = 'camino' if g and g == campeon else ''
                lineas.append('<path class="%s" d="M%d %dH%dV%dH%d"/>' % (cls, x1, y, x2, yp, x3))
        xc = len(rondas) * (W + G)
        yc = TOP + n0 * R
        f = self.fila(campeon)
        if campeon:
            vis = self.cara(f['k'] if f else '', campeon, 'cm-cara')
            camp = ('<div class="cm-camp" style="left:%dpx;top:%dpx">%s<small>CAMPEÓN</small><b>%s</b></div>'
                    % (xc, yc - 52, vis, campeon))
        else:
            camp = '<div class="cm-camp" style="left:%dpx;top:%dpx"><span class="cm-cara ini">?</span><small>CAMPEÓN</small></div>' % (xc, yc - 52)
        ancho = xc + CAMP
        return ('<div class="cm" style="width:%dpx;height:%dpx"><svg class="cm-l" width="%d" height="%d" aria-hidden="true">%s</svg>%s%s%s</div>'
                % (ancho, alto + 6, ancho, alto + 6, ''.join(lineas), ''.join(etiquetas), ''.join(cajas), camp))

    def falta(self, t):
        seg = int((utc(t) - self.ahora).total_seconds())
        h, m = seg // 3600, (seg % 3600) // 60
        return ('%d H %d MIN' % (h, m)) if h else '%d MIN' % max(1, m)

    def momentos(self):
        """El escenario de arriba, en orden de importancia. Siempre hay algo: la llave de anoche no falta nunca."""
        out = []
        for e in self.vivo()[:1]:
            m = self.mult_sv(e['sv'])
            txt = ('<div class="hero-t"><img class="hv-logo" alt="" src="%s"><span class="tag">EN VIVO AHORA</span>'
                   '<span class="hero-meta">%s · EMPEZÓ %s%s</span></div><h1 class="hero-ev%s">%s</h1>'
                   '<p class="hero-p">La llave aparece acá apenas la carguen, cruce por cruce. Mientras, se mira en Discord.</p>'
                   '<div class="hero-acc"><a class="btn verde">Mirar en Discord ↗</a><a class="btn borde">%sQuiero aviso</a></div>'
                   % (self.logo(e['sv']), e['sv'], self.hora(e['cuando']), (' · %s ESTA SEMANA' % mult(m)) if m else '',
                      ' largo' if len(limpio(e['nombre'])) > 16 else '', limpio(e['nombre']), P.ico('campana', 18)))
            vis = '<div class="mo-logo vivo"><img alt="" src="%s"></div>' % self.logo(e['sv'])
            out.append(('vivo', 'En vivo', txt, vis))
        for e in [x for x in self.luego() if (utc(x['cuando']) - self.ahora).total_seconds() < 36 * 3600][:1]:
            dor = self.es_dorado(e['nombre'], e['sv'])
            det = ' · '.join(x for x in [e['sv'], e.get('modalidad'), ('cupos %s' % e['cupos'].lower()) if e.get('cupos') else '',
                                         ('organiza %s' % e['org']) if e.get('org') else ''] if x)
            txt = ('<div class="hero-t"><img class="hv-logo" alt="" src="%s"><span class="tag prox">PRÓXIMO · %s</span></div>'
                   '<h1 class="hero-ev%s">%s</h1><p class="hero-p">%s%s</p><div class="mo-cuenta"><small>EMPIEZA EN</small><b>%s</b></div>'
                   '<div class="hero-acc"><a class="btn verde">%sQuiero aviso</a><a class="btn borde">+ Calendario</a></div>'
                   % (self.logo(e['sv']), self.dia(e['cuando']).upper(), ' largo' if len(limpio(e['nombre'])) > 16 else '',
                      limpio(e['nombre']), det, ('. Premio: %s' % recorte(e['premios'], 70)) if e.get('premios') else '',
                      self.falta(e['cuando']), P.ico('campana', 18)))
            vis = ('<div class="mo-logo"><img alt="" src="%s">%s</div>'
                   % (self.logo(e['sv']), '<span class="mo-sello">DORADO ×3</span>' if dor else ''))
            out.append(('prox', 'Próximo', txt, vis))
        ll = self.llaves()[0]
        gana = self.campeon(ll)
        cuando = self.cuando(self.fecha_llave(ll))
        txt = ('<div class="hero-t"><span class="tag llave">%s · LA LLAVE</span></div><h1 class="hero-ev largo">%s</h1>'
               '<p class="hero-p">%s · %d raperos. %s %s.</p><div class="hero-acc"><a class="btn verde">Ver la llave entera</a></div>'
               % (cuando.upper(), limpio(ll['nombre']), ll['sv'], ll['participantes'],
                  'Campeones:' if len(gana) > 1 else 'Campeón:', ' y '.join(gana)))
        out.append(('llave', cuando.capitalize(), txt, '<div class="cm-wrap">%s</div>' % self.cuadro_mini(ll)))
        video = next((x for x in self.d.get('feed', []) if x.get('tipo') == 'youtube'), None)
        if video:
            self.pedidas.add(('__yt__', video['vid']))
            src = self.r.carta('__yt__', video['vid'])
            fecha = utc(video['t']).astimezone(ET)
            txt = ('<div class="hero-t"><span class="tag video">ÚLTIMO VIDEO · %s</span></div><h1 class="hero-ev largo">%s</h1>'
                   '<p class="hero-p">Subido el %d de %s.</p><div class="hero-acc"><a class="btn verde">Mirar en YouTube ↗</a></div>'
                   % (limpio(video.get('canal', '')).upper(), limpio(video['tit']), fecha.day, MESES[fecha.month - 1]))
            vis = ('<div class="mo-video">%s<span class="mo-play">▶</span></div>'
                   % ('<img alt="" src="%s">' % src if src else ''))
            out.append(('video', 'Video', txt, vis))
        nov = next((x for x in self.d.get('novedades', [])), None)
        if nov:
            txt = ('<div class="hero-t"><span class="tag liga">LA LIGA · %s</span></div><h1 class="hero-ev largo">%s</h1>'
                   '<p class="hero-p">%s</p><div class="hero-acc"><a class="btn verde">Leer en Discord ↗</a></div>'
                   % (self.cuando(nov['t']).upper(), limpio(nov['tit']), recorte(nov.get('tx', ''), 180)))
            out.append(('liga', 'La Liga', txt, '<div class="mo-logo ul"><img alt="" src="%s"></div>' % P.UL))
        if self.sigue:
            for it in self.muro_limpio():
                ks = set(it.get('ks', [])) & set(self.sigue)
                if not ks or it['tipo'] not in ('campeon', 'caza', 'rango', 'tarjeta') or it.get('ll') == ll['n']:
                    continue
                x = self.item_muro(it)
                if not x:
                    continue
                k = sorted(ks)[0]
                txt = ('<div class="hero-t"><span class="tag seguis">DE LOS QUE SEGUÍS · %s</span></div><h1 class="hero-ev largo">%s</h1>'
                       '<p class="hero-p">%s.</p><div class="hero-acc"><a class="btn verde">Ver su perfil</a></div>'
                       % (x[3].upper(), x[1], x[0].capitalize()))
                out.append(('seguis', 'Seguís', txt, '<div class="mo-cara">%s</div>' % self.cara(k, self.T[k]['n'], 'st-cara')))
                break
        return out

    def hero(self, pc):
        mo = self.momentos()
        pistas = ''.join('<article class="mo mo-%s%s" data-mo="%d"><div class="mo-txt">%s</div><div class="mo-vis">%s</div></article>'
                         % (tipo, ' on' if i == 0 else '', i, txt, vis) for i, (tipo, _, txt, vis) in enumerate(mo))
        pestanas = ''.join('<button type="button" class="%s%s" data-mo="%d">%s</button>'
                           % ('on' if i == 0 else '', ' vivo' if tipo == 'vivo' else '', i, et) for i, (tipo, et, _, _) in enumerate(mo))
        flecha = ('<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" '
                  'stroke-linecap="square" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>')
        flechas = ('<button type="button" class="mo-fl izq" data-dir="-1" aria-label="Momento anterior">%s</button>'
                   '<button type="button" class="mo-fl der" data-dir="1" aria-label="Momento siguiente">%s</button>'
                   % (flecha, flecha)) if len(mo) > 1 else ''
        return ('<section class="hero carrusel" id="envivo" aria-roledescription="carrusel" aria-label="Lo de ahora">'
                '<div class="hero-in">%s</div>%s<nav class="mo-tabs" aria-label="Momentos">%s</nav></section>'
                % (pistas, flechas, pestanas))

    def ir_a(self):
        s = [('envivo', 'Ahora'), ('fechas', 'Fechas'), ('semana', 'Esta semana'), ('noticias', 'Lo último'),
             ('raperos', 'Los que mandan'), ('panel', 'Misiones'), ('sebusca', 'Se busca'), ('tienda', 'Tienda'),
             ('servidores', 'Servidores')]
        return ('<nav class="ir-a" aria-label="Ir a"><span class="ir-t">IR A</span>%s</nav>'
                % ''.join('<a href="#%s">%s</a>' % x for x in s))

    def fechas(self):
        tarjetas = []
        for e in self.vivo():
            tarjetas.append(('vivo', 'HOY', '● EN VIVO · empezó %s' % self.hora(e['cuando']), e['sv'], limpio(e['nombre']),
                             e.get('modalidad') or 'se mira en Discord', ''))
        for e in self.luego():
            dor = self.es_dorado(e['nombre'], e['sv'])
            det = ' · '.join(x for x in [e.get('modalidad'), ('cupos %s' % e['cupos'].lower()) if e.get('cupos') else ''] if x)
            tarjetas.append(('dorado' if dor else '', self.dia(e['cuando']).split(' ')[0].upper(), '%s · tu hora' % self.hora(e['cuando']),
                             e['sv'], limpio(e['nombre']), det, 'DORADO ×3' if dor else ''))
        for ll in self.llaves()[:3]:
            gana = self.campeon(ll)
            tarjetas.append(('hecho', self.cuando(self.fecha_llave(ll)).upper(), 'TERMINÓ · %d raperos' % ll['participantes'],
                             ll['sv'], limpio(ll['nombre']), '%s: %s' % ('Campeones' if len(gana) > 1 else 'Campeón', ' y '.join(gana)), ''))
        return self.sec('fechas', 'Fechas', 'Calendario', '<div class="rail fechas2">%s</div>' % ''.join(
            '<article class="fecha %s"><div class="f-dia"><b>%s</b></div><img alt="" src="%s"><b class="f-ev">%s</b>'
            '<span class="f-hora">%s</span><small>%s</small>%s</article>'
            % (c, dia, self.logo(sv), ev, hora, det, '<span class="f-badge">%s</span>' % badge if badge else '')
            for c, dia, hora, sv, ev, det, badge in tarjetas))

    def semana(self):
        """Esta semana, una fila por servidor: cuánto valen sus puntos, la meta de comunidad, contra quién es la guerra
        y, si le toca, el evento dorado. La misma tabla en la computadora y en el celular."""
        m = self.d.get('mult') or {}
        if not m:
            return ''
        g = self.dorado()
        pares = {}
        for a, b in (m.get('guerra') or {}).get('pares', []):
            pares[a], pares[b] = b, a
        xs, metas, va = m.get('sv', {}), m.get('metas') or {}, m.get('meta_va') or {}
        svs = sorted(set(xs) | set(metas) | set(pares), key=lambda sv: (-(xs.get(sv) or 1), sv))
        filas = []
        for sv in svs:
            x = xs.get(sv)
            meta, v = metas.get(sv), va.get(sv, 0)
            if meta:
                ok = v >= meta
                barra = ('<span class="sm-meta%s"><span class="mb"><i style="width:%d%%"></i></span><b>%d/%d%s</b></span>'
                         % (' ok' if ok else '', min(100, round(100 * v / meta)), v, meta, ' ✓' if ok else ''))
            else:
                barra = '<span class="sm-meta"></span>'
            dor = ('<span class="sm-dor">DORADO ×3 · %s, %s</span>' % (limpio(g['n']), self.dia(g['t']))) if g and g['sv'] == sv else ''
            filas.append('<li class="%s"><img alt="" src="%s"><b class="sm-sv">%s</b><span class="sm-x">%s</span>%s'
                         '<span class="sm-g">%s</span><span class="sm-d">%s</span></li>'
                         % ('sube' if x and x > 1 else ('baja' if x and x < 1 else ''), self.logo(sv), sv, mult(x) if x else '×1',
                            barra, ('vs ' + pares[sv]) if sv in pares else '', dor))
        cab = ('<li class="sm-cab"><span></span><span><span class="solo-pc">SERVIDOR</span></span><span>PUNTOS</span>'
               '<span>META<span class="solo-pc"> DE COMUNIDAD</span></span><span>GUERRA</span><span class="sm-d"></span></li>')
        nota = ('<p class="sm-nota"><b>Meta:</b> si juega esa cantidad de gente distinta en la semana, todos los que jugaron suman un '
                '10 % más. <b>Guerra:</b> gana el que más puntos hace por persona y se lleva ×1,5 la semana que viene.</p>')
        return self.sec('semana', 'Esta semana', 'Lunes de la Liga', '<ul class="sm">%s%s</ul>%s' % (cab, ''.join(filas), nota), 'semana')

    def item_muro(self, it):
        """Una línea de «Lo último» o una tarjeta del feed: (tipo, título, imagen, cuándo)."""
        q = [limpio(x) for x in it.get('quien', [])]
        ks = it.get('ks', [])
        c = self.cuando(it['t'])
        if it['tipo'] == 'tarjeta':
            nombre = {'pais': 'de País', 'temporada': 'de Temporada', 'servidor': 'de Servidor', 'competitivo': 'Competitiva'}[it['carta']]
            return ('CARTA NUEVA', '%s ya tiene su carta %s' % (q[0], nombre), ('carta', ks[0], it['carta']), c)
        if it['tipo'] == 'rango':
            f = self.T.get(ks[0]) if ks else None
            vis = ('carta', ks[0], 'competitivo') if f and 'competitivo' in (f.get('c') or []) else ('rango', it['rg'])
            return ('RANGO', ('%s consigue su primera letra: %s' if it.get('primero') else '%s pasa a rango %s') % (q[0], it['rg']),
                    vis, c)
        if it['tipo'] == 'campeon':
            return ('CAMPEÓN · %s' % it['sv'], '%s %s %s' % (' y '.join(q), 'se quedan con' if len(q) > 1 else 'se queda con',
                                                             limpio(it['ev'])), ('cara', ks[0] if ks else '', q[0]), c)
        if it['tipo'] == 'caza':
            return ('SE BUSCA · CAZA', '%s cazó a %s (%s) y cobra %s' % (q[0], it['a'], it['cat'], num(it['pts'])),
                    ('cara', ks[0] if ks else '', q[0]), c)
        if it['tipo'] == 'anuncio':
            return ('EVENTO · %s' % it['sv'], '%s anunció %s' % (it['sv'], limpio(it['ev'])), ('sv', it['sv']), c)
        if it['tipo'] == 'liga':
            return ('LA LIGA', limpio(it['tit']), ('ul',), c)
        return None

    def vis(self, v, cls='n-vis'):
        if v[0] == 'carta':
            return self.carta(v[1], v[2], cls + ' n-carta')
        if v[0] == 'rango':
            return '<span class="%s rgv" style="background:%s">%s</span>' % (cls, P.RANGO[v[1]], v[1])
        if v[0] == 'cara':
            return self.cara(v[1], v[2], cls + ' n-cara')
        if v[0] == 'sv':
            return '<img class="%s" alt="" src="%s">' % (cls, self.logo(v[1]))
        return '<img class="%s" alt="" src="%s">' % (cls, P.UL)

    def variados(self, n):
        """Lo último sin repetir: la primera de cada clase (carta, letra, título, caza, la Liga), y después el resto."""
        items, vistos = [], set()
        muro = [it for it in self.muro if it['tipo'] != 'anuncio']
        for it in muro:
            if it['tipo'] == 'tarjeta' and any(o['tipo'] == 'rango' and o.get('ks') == it.get('ks') and o['t'] == it['t'] for o in muro):
                continue            # la carta Competitiva que llega con la primera letra va adentro de la noticia de la letra
            x = self.item_muro(it)
            if x:
                items.append((it, x))
        primero = []
        for it, x in items:
            if it['tipo'] not in vistos:
                vistos.add(it['tipo'])
                primero.append(x)
        resto = [x for it, x in items if x not in primero]
        return (primero + resto)[:n]

    def noticias(self):
        items = self.variados(6)
        dest = next((x for x in items if x[2][0] == 'carta'), items[0])
        resto = [x for x in items if x is not dest][:4]
        d = ('<article class="destacada"><div class="d-img">%s<span class="sticker">NUEVA</span></div><div class="d-txt">'
             '<span class="cat">%s</span><h3>%s</h3><small>%s</small></div></article>'
             % (self.vis(dest[2], 'd-vis'), dest[0], dest[1], dest[3].capitalize()))
        li = ''.join('<li>%s<div><span class="cat">%s</span><b>%s</b><small>%s</small></div></li>'
                     % (self.vis(v), cat, tit, c.capitalize()) for cat, tit, v, c in resto)
        return self.sec('noticias', 'Lo último', 'Publicaciones', '<div class="notas-g">%s<ul class="notas">%s</ul></div>' % (d, li))

    def tu_temporada(self):
        f = self.yo
        if not f:
            return ''
        ev = f['ev']
        falta = max(0, 10 - ev)
        bus = self.buscado(f['k'])
        return ('<section class="tu" id="tu"><div class="tu-t">TU TEMPORADA · %s</div>'
                '<div class="tu-fila"><div class="tu-pos"><b>#%d</b><small>OVR %d · %s pts · %d eventos</small></div>%s</div>'
                '<div class="tu-prog"><div class="barra10">%s</div><small>%s</small></div>%s'
                '<a class="btn negro">Ver mi perfil</a></section>'
                % (f['n'].upper(), f['pos'], f['ovr'], num(f['pts']), ev,
                   self.rango(f['rg']) if f['rg'] else '<span class="rg sinletra">?</span>',
                   ''.join('<i class="%s"></i>' % ('si' if i < ev else '') for i in range(10)),
                   ('Todavía sin letra: %d de 10 eventos. Te faltan %d para tu rango.' % (ev, falta)) if falta else 'Ya tenés letra.',
                   ('<div class="te-buscan"><b>HOY TE BUSCAN</b><span>%s por tu cabeza · %s · hasta %s</span></div>'
                    % (num(bus['v']) + ' pts', bus['cn'], self.dia(self.d['mw']['fin'])) if bus else '')))

    # ── secciones con pestañas y flechas (Dlx, 29/09: «añadir las flechas para ir hacia competitivo, países, rachas») ──
    def pest(self, id_, titulo, enlace, items, extra='', titulos=False):
        """Una sección con pestañas y flechas. `items` = [(clave, pestaña, título, html)]: se ve la primera y las
        demás esperan; en el prototipo las cambian las flechas, las pestañas y el dedo. Con `titulos`, el título de
        la sección es el de la pestaña que se ve (el panel de abajo junta cosas distintas)."""
        tabs = ''.join('<button type="button" class="%s" data-t="%s">%s</button>' % ('on' if n == 0 else '', t, et)
                       for n, (_c, et, t, _h) in enumerate(items))
        pistas = ''.join('<div class="pz%s" data-c="%s">%s</div>' % (' on' if n == 0 else '', c, h)
                         for n, (c, _et, _t, h) in enumerate(items))
        fl = ('<span class="pz-fl"><button type="button" class="pz-b izq" data-dir="-1" aria-label="Anterior">%s</button>'
              '<button type="button" class="pz-b der" data-dir="1" aria-label="Siguiente">%s</button></span>'
              % (P.ico('flecha', 18), P.ico('flecha', 18)))
        cuerpo = '<div class="pz-cab"><nav class="pz-tabs" aria-label="%s">%s</nav>%s</div>%s' % (titulo, tabs, fl, pistas)
        sec = self.sec(id_, items[0][2] if titulos else titulo, enlace, cuerpo, ('pest ' + extra).strip())
        return sec.replace('<section ', '<section data-titulos="1" ', 1) if titulos else sec

    def mc_persona(self, f, dato, cual='temporada'):
        return ('<article class="mc">%s<div class="mc-pie"><span class="mc-pais"><img alt="" src="%s">%s</span><b>%s</b>'
                '<small>%s</small></div></article>'
                % (self.carta(f['k'], cual, cls='ci mc-ci'), bandera(f.get('cc', '')), PAIS.get(f.get('cc', ''), (f.get('cc') or '').upper()),
                   limpio(f['n']), dato))

    def mc_grupo(self, n, img, nombre, dato):
        return ('<article class="mc grupo"><div class="mc-tile"><span class="mc-n">#%d</span>%s</div><div class="mc-pie"><b>%s</b>'
                '<small>%s</small></div></article>' % (n, img, nombre, dato))

    def raperos(self, pc):
        """Los que mandan, por categoría: las mismas siete que el podio de la web de hoy (`catsPodio()` de app.js),
        con cinco en vez de tres. Sólo los oficiales: fuera de concurso no tiene número."""
        T = self.oficiales()
        cats = [('temporada', 'Temporada', [self.mc_persona(f, '#%d · OVR %d · %s PTS' % (f['pos'], f['ovr'], num(f['pts'])))
                                            for f in T[:5]])]
        comp = sorted([f for f in T if f.get('rg')], key=lambda f: -(f.get('sc') or 0))[:5]
        cats.append(('competitivo', 'Competitivo', [self.mc_persona(f, 'RANGO %s · SCORE %s' % (f['rg'], f.get('sc')), 'competitivo')
                                                    for f in comp]))
        du = [d for d in self.d.get('duelos', []) if not d.get('fc') and d['k'] in self.T][:5]
        cats.append(('duelos', 'Duelos', [self.mc_persona(self.T[d['k']], '%d DE %d DUELOS GANADOS' % (d['g'], d['t'])) for d in du]))
        med = sorted([f for f in T if (f.get('oro') or 0) + (f.get('seg') or 0) + (f.get('ter') or 0)],
                     key=lambda f: (-(f.get('oro') or 0), -(f.get('seg') or 0), -(f.get('ter') or 0), f['pos']))[:5]
        cats.append(('podios', 'Podios', [self.mc_persona(f, '1.º ×%d · 2.º ×%d · 3.º ×%d' % (f.get('oro') or 0, f.get('seg') or 0,
                                                                                         f.get('ter') or 0)) for f in med]))
        con = [f for f in T if len(f.get('rch') or []) > 1 and f['rch'][1]]
        vivas = [f for f in con if f['rch'][0]]
        ra = sorted(vivas or con, key=lambda f: (-(f['rch'][0] if vivas else f['rch'][1]), f['pos']))[:5]
        cats.append(('rachas', 'Rachas', [self.mc_persona(f, '%d EVENTOS SEGUIDOS' % (f['rch'][0] if vivas else f['rch'][1]))
                                          for f in ra]))
        pa = [p for p in self.d.get('paises', []) if p.get('n')][:5]
        cats.append(('paises', 'Países', [self.mc_grupo(n + 1, '<img class="mc-bandera" alt="" src="%s">' % bandera(p['cc'])
                                                        if bandera(p['cc']) else '', PAIS.get(p['cc'], p['cc'].upper()),
                                                        '%s PTS · %d RAPEROS' % (num(p['pts']), p['n'])) for n, p in enumerate(pa)]))
        cr = [c for c in self.d.get('crews', []) if c.get('rk') != 0][:5]
        cats.append(('crews', 'Crews', [self.mc_grupo(n + 1, self.logo_crew(c), limpio(c['crew']),
                                                      '%s PTS · %d RAPEROS' % (num(c['pts']), c['n'])) for n, c in enumerate(cr)]))
        items = [(c, et, 'Los que mandan', '<div class="rail mcs2">%s</div>' % ''.join(h)) for c, et, h in cats if h]
        return self.pest('raperos', 'Los que mandan', 'Todos los raperos', items, 'negra')

    def logo_crew(self, c):
        ruta = c.get('logo') or ''
        if ruta and os.path.exists(os.path.join(P.PAG, ruta)):
            return '<img class="mc-logo" alt="" src="%s">' % P.dato(ruta, 'image/webp')
        return '<span class="mc-ini">%s</span>' % (limpio(c['crew'])[:2].upper() or '?')

    # ── el panel de abajo (Dlx, 29/09): Misiones + el Pase · Tus eventos + Tu temporada · La Liga en números ──
    def panel(self, pc):
        items = [('misiones', 'Misiones', 'Misiones', '<div class="pz-2">%s%s</div>' % (self.misiones(), self.pase())),
                 ('eventos', 'Tus eventos', 'Tus eventos', '<div class="pz-2">%s%s</div>' % (self.tus_eventos(), self.tu_temporada())),
                 ('liga', 'La Liga', 'La Liga en números', self.numeros())]
        return self.pest('panel', 'Misiones', 'Tu perfil', items, 'panel', titulos=True)

    def desde_lunes(self):
        m = self.d.get('mult') or {}
        return utc(m['ini']) if m.get('ini') else self.ahora - dt.timedelta(days=7)

    def duelos_de(self, k, desde):
        """Los duelos que ganó y jugó alguien desde una fecha, sacados de las llaves del payload."""
        yo = limpio(self.T[k]['n']).lower()
        g = j = 0
        for ll in self.d['llaves'].values():
            if utc(self.fecha_llave(ll)) < desde:
                continue
            for r in ll['rondas']:
                for b in r['b']:
                    lados = [limpio(x if isinstance(x, str) else ' & '.join(x)).lower() for x in b[0]]
                    if yo in lados and len(lados) == 2:
                        j += 1
                        g += limpio(b[1] if isinstance(b[1], str) else ' & '.join(b[1])).lower() == yo
        return g, j

    def misiones(self):
        """Las Misiones son de la Temporada y para todos ([[pase-tareas-misiones]]); todavía no existen, así que las
        cuatro son DE EJEMPLO. El progreso sí es de verdad: sale de las llaves de esta semana de quien mira."""
        f = self.yo
        if not f:
            return ''
        desde = self.desde_lunes()
        mias = [(ll, res) for ll, res, _p in self.semana_de(f['k']) if utc(self.fecha_llave(ll)) >= desde]
        final = any(res in ('Campeón', 'Subcampeón') for _ll, res in mias)
        svs = {ll['sv'] for ll, _r in mias}
        g, _j = self.duelos_de(f['k'], desde)
        filas = [('Jugá 2 eventos', min(len(mias), 2), 2, 300), ('Llegá a una final', int(final), 1, 500),
                 ('Ganá 5 duelos', min(g, 5), 5, 300), ('Jugá en 2 servidores distintos', min(len(svs), 2), 2, 400)]
        li = ''.join('<li class="%s"><span class="mis-ok">%s</span><div class="mis-txt"><b>%s</b><span class="mb"><i style="width:%d%%">'
                     '</i></span><small>%d de %d</small></div><span class="mis-pts">+%s<small>PTS</small></span></li>'
                     % ('hecha' if v >= t else '', '✓' if v >= t else '', q, round(100 * v / t), v, t, num(p)) for q, v, t, p in filas)
        return ('<section class="mis"><div class="mis-cab"><span>MISIONES DE LA SEMANA · SUMAN A TU TEMPORADA</span>'
                '<em>DE EJEMPLO</em></div><ol>%s</ol></section>' % li)

    def pase(self):
        """El Pase es sólo de DRA y se avanza con Tareas ([[pase-tareas-misiones]]). Todavía no existe: el
        recuadro es para ver el lugar, con números de ejemplo."""
        return ('<section class="tu pase"><div class="tu-t">PASE DE TEMPORADA · %s<span class="tag-pronto">PRÓXIMAMENTE</span></div>'
                '<div class="tu-fila"><div class="tu-pos"><b>NIVEL 3</b><small>240 de 500 para el nivel 4</small></div>'
                '<span class="pase-sig">4</span></div><span class="mb pase-b"><i style="width:48%%"></i></span>'
                '<ul class="pase-l"><li><span>Tareas de esta semana</span><b>2 de 5</b></li>'
                '<li><span>Próxima recompensa</span><b>Marco dorado para tu carta</b></li></ul>'
                '<a class="btn negro">Ver el pase</a><small class="pase-nota">Sólo para los miembros de Discord Rap Español. '
                'Los números son de ejemplo.</small></section>' % self.d.get('temporada', 't1').upper())

    def tus_eventos(self):
        """Los últimos eventos de la Liga y cómo le fue a quien mira en cada uno."""
        f = self.yo
        yo = limpio(f['n']).lower() if f else ''
        filas = []
        for ll in self.llaves()[:5]:
            res = next(((fila[1], fila[2]) for fila in ll.get('tabla', []) if limpio(fila[0]).lower() == yo), None)
            gana = self.campeon(ll)
            if res:
                cls = 'campeon' if res[0] == 'Campeón' else ''
                vos = '<span class="te-vos %s">%s<small>+%s</small></span>' % (cls, res[0].upper(), num(res[1]))
            else:
                vos = '<span class="te-vos no">—<small>no jugaste</small></span>'
            filas.append('<li><img alt="" src="%s"><div><b>%s</b><small>%s · %s · %d raperos · %s: %s</small></div>%s</li>'
                         % (self.logo(ll['sv']), limpio(ll['nombre']), ll['sv'], self.cuando(self.fecha_llave(ll)),
                            ll['participantes'], 'campeones' if len(gana) > 1 else 'campeón', ' y '.join(gana), vos))
        return ('<section class="te"><div class="mis-cab"><span>LOS ÚLTIMOS EVENTOS · Y CÓMO TE FUE</span><em>TODOS %s</em></div>'
                '<ol class="te-l">%s</ol></section>' % (P.ico('flecha', 14), ''.join(filas)))

    def numeros(self):
        """La Liga en números, como «La Liga hoy» de la web de hoy: la comunidad, la actividad de dos semanas y los récords."""
        c = self.d.get('comunidad') or {}
        a = self.d.get('actividad') or {}
        grandes = [('PERSONAS', c.get('personas'), 'en %d servidores' % c.get('servidores', 0)),
                   ('EN LA LISTA', c.get('lista'), 'compitieron o se anotaron'),
                   ('CON SU DISCORD', c.get('con_id'), 'el bot sabe quiénes son'),
                   ('VERIFICADAS', c.get('verificados'), 'con las cuatro tarjetas')]
        cuatro = ''.join('<div><span>%s</span><b>%s</b><small>%s</small></div>' % (t, num(v), d) for t, v, d in grandes if v)
        dias = a.get('dias') or []
        tope = max([sum(x.values()) for _d, x in dias] + [1])
        cols = ''
        for d, x in dias:
            dd = dt.date.fromisoformat(d)
            seg = ''.join('<u style="height:%.1f%%;background:%s" title="%s %d"></u>'
                          % (100 * n / tope, (self.svs.get(sv) or {}).get('color', '#A5A5A0'), sv, n) for sv, n in sorted(x.items()))
            cols += '<i><span class="act-b">%s</span><em>%s</em></i>' % (seg, DIAS[dd.weekday()][:1].upper())
        act = ('<section class="act"><div class="mis-cab"><span>LO QUE SE JUGÓ · DOS SEMANAS</span><em>%d EVENTOS ESTA SEMANA</em></div>'
               '<div class="act-g">%s</div><p class="act-n"><b>%s</b> participaciones · <b>%s</b> raperos distintos en 7 días</p></section>'
               % (a.get('ev', 0), cols, num(a.get('part', 0)), num(a.get('gente', 0)))) if dias else ''
        rec = ''.join('<li><span>%s</span><b>%s</b><em>%s</em></li>' % (r['que'], limpio(r['n']), num(r['v']) if isinstance(r['v'], int) else r['v'])
                      for r in (self.d.get('records') or [])[:6])
        return ('<div class="num-g"><div><div class="num-4">%s</div>%s</div><section class="rec"><div class="mis-cab"><span>LOS RÉCORDS DE LA T1'
                '</span></div><ol>%s</ol></section></div>' % (cuatro, act, rec))

    def ranking_top(self):
        top = self.oficiales()[:5]
        filas = ''.join(
            '<li class="p%d"><span class="r-pos">%d</span><img class="r-flag" alt="" src="%s"><span class="r-nom">%s<small>%s pts · %d ev</small></span>%s'
            '<span class="r-pts">%d<small>OVR</small></span></li>'
            % (f['pos'], f['pos'], bandera(f['cc']), f['n'], num(f['pts']), f['ev'], self.rango(f['rg']), f['ovr']) for f in top)
        return self.sec('ranking', 'Ranking', 'Los %d oficiales' % self.d.get('oficiales', 0), '<ol class="top5 r2">%s</ol>' % filas)

    def poster(self, b):
        pie, sello, cls = b.get('m', ''), '', ''
        if b.get('e') == 'cazado':
            por = ' y '.join(p['n'] for p in (b.get('c') or {}).get('por', []))
            sello, cls, pie = '<span class="p-sello">CAZADO</span>', 'hecho', 'por %s · cobró %s' % (por, num(b['v']))
        elif b.get('e') == 'escondio':
            sello, cls, pie = '<span class="p-sello gris">SE ESCONDIÓ</span>', 'hecho', 'no jugó: nadie cobró'
        return ('<article class="poster %s"><span class="p-t">SE BUSCA</span><span class="p-fw">%s%s</span><b>%s</b>'
                '<span class="p-cat">%s</span><span class="p-precio">%s PTS</span><small>%s</small></article>'
                % (cls, self.cara(b['k'], b['n'], 'p-foto'), sello, b['n'], b['cn'].upper(), num(b['v']), pie))

    def buscados(self):
        mw = self.d.get('mw') or {}
        if not mw.get('b'):
            return ''
        diario = mw.get('tipo') == 'dia'
        rail = ''.join(self.poster(b) for b in mw['b'])
        if mw.get('ant'):
            rail += '<div class="mw-div"><span>%s</span></div>' % ('AYER' if diario else 'LA SEMANA PASADA')
            rail += ''.join(self.poster(b) for b in mw['ant'])
        if mw.get('caz'):
            rail += ('<article class="poster cazadores"><span class="p-t">CAZADORES</span><ol>%s</ol><small>lo cobrado en la temporada</small></article>'
                     % ''.join('<li>%s<b>%s</b><em>%s</em></li>' % (self.cara(c['k'], c['n'], 'mono-c'), c['n'], num(c['pts']))
                               for c in mw['caz'][:5]))
        cab = ('<div class="mw-cab"><span>%d buscados %s · vencen %s</span><span class="mw-fl">'
               '<button type="button" class="mw-b" data-dir="-1" aria-label="Anteriores">←</button>'
               '<button type="button" class="mw-b" data-dir="1" aria-label="Siguientes">→</button></span></div>'
               % (len(mw['b']), 'hoy' if diario else 'esta semana', self.dia(mw['fin'])))
        return self.sec('sebusca', 'Se busca', 'Most Wanted', cab + '<div class="mw-rail">%s</div><p class="p-nota">Quien le gane, cobra en '
                        'su Temporada y el 10 %% en Puntos de Tienda.</p>' % rail, 'negra')

    def tienda(self):
        t = self.d.get('tienda') or {}
        saldo = t.get('inicial', 5000)
        precios = 'Todavía nadie puso precio: la primera cabeza la elegís vos.'
        return ('<section class="sec" id="tienda"><div class="sec-t"><h2>Tienda</h2><a>Ir a la tienda %s</a></div>'
                '<div class="tienda-g"><div class="billetera"><span class="b-t">TUS PUNTOS DE TIENDA</span><b>%s PT</b>'
                '<small>Todos arrancan con %s. No son los puntos del ranking.</small></div>'
                '<div class="usos"><article><b>Ponele precio a una cabeza</b><small>De %s a %s PT. Quien le gane, cobra; si nadie '
                'la caza en la semana, te vuelve.</small><small class="fuerte">%s</small><a class="btn negro chico">Poner precio</a></article>'
                '<article class="pronto"><b>Canjes</b><small>Próximamente: lo que se compra con los puntos.</small></article></div>'
                '</div></section>' % (P.ico('flecha', 16), num(saldo), num(t.get('inicial', 5000)), num(t.get('min', 500)),
                                      num(t.get('tope', 20000)), precios))

    def mercancia(self):
        return ('<section class="merch-mini" id="merch"><b>MERCANCÍA</b><span>Todavía no hay. Cuando salga, aparece acá.</span></section>')

    def servidores(self):
        filas = ''.join(
            '<article class="sv2" style="--c:%s"><img alt="" src="%s"><div><b>%s</b><small>%s · %s</small></div>'
            '<span class="sv2-n"><b>%s</b><small>%s</small></span></article>'
            % (s['color'], self.logo(s['sv']), s['sv'], s['nombre'], s.get('tag', '').lower(), num(s['n']) if s['n'] else '—',
               'raperos' if s['n'] else 'sin eventos')
            for s in sorted(self.svs.values(), key=lambda s: -s['n']))
        return self.sec('servidores', 'Los servidores de la Liga', 'Mundo', '<div class="svs2">%s</div>' % filas, 'negra')

    def pie(self):
        c = self.d.get('comunidad') or {}
        return ('<footer class="pie negra"><div class="pie-marca"><img alt="" src="%s"><span>UNDER LEGENDS<small>LIGA GLOBAL · TEMPORADA 1</small></span></div>'
                '<p class="pie-c">%s personas en %d servidores · %s verificados</p>'
                '<nav><a>Guía</a><a>Publicaciones</a><a>Tienda</a><a>Mundo</a><a>Privacidad</a></nav>'
                '<small>Los datos se actualizan solos cada media hora.</small></footer>'
                % (P.UL, num(c.get('personas', 0)), c.get('servidores', 0), num(c.get('verificados', 0))))

    def inicio(self, pc):
        if pc:
            return (self.cabecera(True, 'Inicio') + self.historias(True) + self.hero(True) + self.ir_a() + self.fechas()
                    + self.semana() + self.noticias() + self.raperos(True) + self.panel(True)
                    + self.buscados() + self.tienda() + self.mercancia() + self.servidores() + self.pie())
        return (self.cabecera(False, 'Inicio') + self.historias(False) + self.hero(False) + self.ir_a() + self.fechas()
                + self.semana() + self.noticias() + self.raperos(False) + self.panel(False)
                + self.buscados() + self.tienda() + self.mercancia() + self.servidores() + self.pie() + self.tabbar('inicio'))

    # ── Eventos ─────────────────────────────────────────────────────────────
    def cuadro(self, ll):
        rondas = [r for r in ll['rondas'] if r['r'] not in ('Filtros', 'Tercer puesto')]
        cols = []
        for r in rondas:
            ms = []
            for b in r['b']:
                lados = [limpio(z if isinstance(z, str) else ' & '.join(z)) for z in b[0]]
                g = limpio(b[1] if isinstance(b[1], str) else ' & '.join(b[1]))
                ms.append('<div class="m hecho">%s</div>' % ''.join(
                    '<span class="%s">%s</span>' % ('g' if x == g else 'x', x) for x in lados[:2]))
            cols.append('<div class="ronda"><h4>%s</h4>%s</div>' % (r['r'], ''.join(ms)))
        return ('<div class="llave-cab"><span>CUADRO</span><span class="apag">POR RONDAS</span><span class="apag">PANTALLA COMPLETA</span></div>'
                '<div class="llave-wrap"><div class="llave" style="grid-template-columns:repeat(%d,150px)">%s</div></div>'
                '<small class="desliza">Deslizá hasta la final → · tocá un nombre y se ilumina su camino</small>' % (len(cols), ''.join(cols)))

    def t_ev(self, sv, nombre, detalle, estado, cuerpo='', cls=''):
        return ('<article class="t-ev %s"><header><img alt="" src="%s"><div><b>%s</b><small>%s</small></div><span class="t-est">%s</span>'
                '</header>%s</article>' % (cls, self.logo(sv), nombre, detalle, estado, cuerpo))

    def eventos(self, pc):
        a = self.ahora.astimezone(ET)
        man = a + dt.timedelta(days=1)
        dias = ('<nav class="dias"><a>Ayer</a><a class="on">Hoy · %d</a><a>Mañana · %d</a><a>%s %d</a><a>Mes</a></nav>'
                % (a.day, man.day, DIAS[(man + dt.timedelta(days=1)).weekday()][:3].capitalize(), (man + dt.timedelta(days=1)).day))
        vivo = ''
        for e in self.vivo():
            m = self.mult_sv(e['sv'])
            vivo += self.t_ev(e['sv'], limpio(e['nombre']), '%s · empezó %s%s' % (e['sv'], self.hora(e['cuando']),
                                                                               (' · %s esta semana' % mult(m)) if m else ''),
                              'EN VIVO', '<p class="t-nota">La llave aparece acá apenas la carguen.</p>'
                              '<div class="t-acc"><a class="btn verde chico">Mirar en Discord ↗</a><a>Quiero aviso</a></div>', 'es-vivo')
        if vivo:
            vivo = '<section class="grupo"><h3 class="g-t vivo">● En vivo</h3>%s</section>' % vivo
        tarde = ''
        for e in self.luego():
            dor = self.es_dorado(e['nombre'], e['sv'])
            det = ' · '.join(x for x in [e['sv'], e.get('modalidad'), ('cupos %s' % e['cupos'].lower()) if e.get('cupos') else '',
                                         ('organiza %s' % e['org']) if e.get('org') else ''] if x)
            premio = ('<p class="t-nota">Premio: %s</p>' % recorte(e['premios'], 90)) if e.get('premios') else ''
            tarde += self.t_ev(e['sv'], limpio(e['nombre']), det, self.hora(e['cuando']),
                               ('<span class="dor-b">EVENTO DORADO · VALE ×3</span>' if dor else '') + premio +
                               '<div class="t-acc"><a class="btn verde chico">%s Quiero aviso</a><a>+ Calendario</a><a>Discord ↗</a></div>'
                               % P.ico('campana', 16), 'dorado' if dor else '')
        if tarde:
            tarde = '<section class="grupo"><h3 class="g-t">Más tarde</h3>%s</section>' % tarde
        hechos = ''
        for i, ll in enumerate(self.llaves()[:5]):
            gana = self.campeon(ll)
            det = '%s · %s · %d raperos' % (ll['sv'], self.cuando(self.fecha_llave(ll)), ll['participantes'])
            if i == 0:
                podio = ''.join('<li><b>%d</b>%s<em>+%s</em></li>' % (j + 1, limpio(x[0]), num(x[2])) for j, x in enumerate(ll['tabla'][:4]))
                cuerpo = '<ol class="podio2">%s</ol><div class="t-llave">%s</div>' % (podio, self.cuadro(ll))
                hechos += self.t_ev(ll['sv'], limpio(ll['nombre']), det, 'FINAL', cuerpo)
            else:
                hechos += self.t_ev(ll['sv'], limpio(ll['nombre']), det + ' · %s' % ' y '.join(gana), 'VER LLAVE', '', 'cerrado')
        hechos = '<section class="grupo"><h3 class="g-t">Terminados</h3>%s</section>' % hechos
        if pc:
            svs = ''.join('<a><img alt="" src="%s">%s</a>' % (self.logo(s), s) for s in sorted(self.svs, key=lambda s: -self.svs[s]['n']))
            return (self.cabecera(True, 'Eventos') + '<div class="t3"><aside class="t-izq">%s%s<div class="t-svs"><b>Servidores</b>%s</div></aside>'
                    '<main class="t-centro">%s%s%s</main><aside class="t-der">%s%s</aside></div>'
                    % (dias, self.mes(), svs, vivo, tarde, hechos, self.avisos(), self.campeones()))
        return (self.cabecera(False, 'Eventos') + dias + vivo + tarde + hechos + self.campeones() + self.mes() + self.avisos()
                + self.tabbar('eventos'))

    def campeones(self):
        out = []
        for it in [x for x in self.muro if x['tipo'] == 'campeon'][:8]:
            q = [limpio(x) for x in it['quien']]
            k = it['ks'][0] if it.get('ks') else ''
            f = self.T.get(k)
            if f and 'temporada' in (f.get('c') or []) and self.r.carta(k, 'temporada'):
                vis = self.carta(k, cls='cp-ci')
            else:
                vis = self.cara(k, q[0], 'cp-cara')
            out.append('<article class="cp">%s<small>%s · %s</small><b>%s</b><a>Ver llave</a></article>'
                       % (vis, it['sv'], limpio(it['ev']), ' y '.join(q)))
        return ('<section class="sec"><div class="sec-t"><h2>Últimos campeones</h2><a>Todas las llaves %s</a></div>'
                '<div class="rail camp2">%s</div></section>' % (P.ico('flecha', 16), ''.join(out)))

    def mes(self):
        a = self.ahora.astimezone(ET)
        ini = a.replace(day=1)
        puntos = {}
        for e in self.d['calendario']:
            t = utc(e['t']).astimezone(ET)
            if t.month == a.month:
                puntos.setdefault(t.day, []).append(self.svs.get(e['sv'], {}).get('color', '#888'))
        celdas = ''.join('<span></span>' for _ in range(ini.weekday()))
        sig = (ini.replace(month=ini.month % 12 + 1, year=ini.year + (ini.month == 12)) - dt.timedelta(days=1)).day
        for d in range(1, sig + 1):
            pts = ''.join('<i style="background:%s"></i>' % c for c in puntos.get(d, [])[:4])
            mas = '<u>+%d</u>' % (len(puntos[d]) - 4) if len(puntos.get(d, [])) > 4 else ''
            celdas += '<span class="%s">%d<em>%s%s</em></span>' % ('hoy' if d == a.day else '', d, pts, mas)
        return ('<section class="sec mes"><div class="sec-t"><h2>%s</h2><a>Mes %s</a></div>'
                '<div class="mes-g"><b>L</b><b>M</b><b>M</b><b>J</b><b>V</b><b>S</b><b>D</b>%s</div></section>'
                % (MESES[a.month - 1].capitalize(), P.ico('flecha', 16), celdas))

    def avisos(self):
        chips = ''.join('<span class="%s">%s%s</span>' % ('on' if i == 0 else '', '✓ ' if i == 0 else '', s)
                        for i, s in enumerate(sorted(self.svs, key=lambda s: -self.svs[s]['n'])))
        return ('<section class="sec avisos"><div class="sec-t"><h2>La campana</h2><a>Cómo funciona %s</a></div>'
                '<p class="av-p">Te avisa al minuto de que un servidor anuncia un evento.</p><div class="av-chips">%s<span>Todos</span></div>'
                '<a class="btn negro">%s Activar la campana</a>'
                '<div class="av-cal"><a>+ Google Calendar</a><a>+ Apple · Outlook</a><a>Copiar el link</a></div></section>'
                % (P.ico('flecha', 16), chips, P.ico('campana', 18)))

    # ── Publicaciones ───────────────────────────────────────────────────────
    def reac(self):
        return '<div class="reac"><span>🔥</span><span>👀</span><span>🎤</span><a>Compartir</a></div>'

    def f_card(self, tipo, cuerpo, pie=''):
        return '<article class="f-card"><span class="f-tipo">%s</span>%s%s</article>' % (tipo, cuerpo, pie)

    def publicaciones(self, pc):
        cards = []
        for e in self.vivo():
            cards.append(self.f_card('<b class="rojo">● EN VIVO</b> · %s' % e['sv'],
                                     '<div class="f-fila"><img class="f-logo" alt="" src="%s"><div><h3 class="f-h">%s</h3>'
                                     '<p class="f-p">Empezó a las %s. La llave aparece apenas la carguen.</p></div></div>'
                                     '<div class="f-acc"><a class="btn verde chico">Mirar en Discord ↗</a><a class="btn borde2 chico">Quiero aviso</a></div>'
                                     % (self.logo(e['sv']), limpio(e['nombre']), self.hora(e['cuando']))))
        mezcla = []
        muro = [o for o in self.muro if o['tipo'] != 'anuncio' and not (
            o['tipo'] == 'tarjeta' and any(p['tipo'] == 'rango' and p.get('ks') == o.get('ks') and p['t'] == o['t'] for p in self.muro))]
        grupos = []
        for it in muro:
            if grupos and it['tipo'] == 'tarjeta' and grupos[-1][0]['tipo'] == 'tarjeta' and grupos[-1][0]['t'] == it['t']:
                grupos[-1].append(it)
            else:
                grupos.append([it])
        for g in grupos:
            it = g[0]
            if len(g) > 1:
                quienes = []
                for o in g:
                    if limpio(o['quien'][0]) not in quienes:
                        quienes.append(limpio(o['quien'][0]))
                fila = ''.join(self.carta(o['ks'][0], o['carta'], 'f-mini') for o in g)
                mezcla.append(self.f_card('CARTAS NUEVAS · %s' % self.cuando(it['t']),
                                          '<h3 class="f-h">%s ya tienen sus cartas</h3><div class="f-minis">%s</div>'
                                          % (' y '.join([', '.join(quienes[:-1]), quienes[-1]]) if len(quienes) > 1 else quienes[0], fila),
                                          self.reac()))
                if len(mezcla) >= 8:
                    break
                continue
            x = self.item_muro(it)
            if not x:
                continue
            cat, tit, v, c = x
            if v[0] == 'carta':
                cuerpo = '<div class="f-fila">%s<div><h3 class="f-h">%s</h3></div></div>' % (self.vis(v, 'f-carta'), tit)
            elif it['tipo'] == 'campeon':
                ll = self.d['llaves'].get(str(it.get('ll')))
                podio = ''.join('<li><b>%d</b> %s</li>' % (i + 1, limpio(z[0])) for i, z in enumerate((ll or {}).get('tabla', [])[:3]))
                cuerpo = ('<div class="f-fila">%s<div><h3 class="f-h">%s</h3><p class="f-p">%d raperos.</p><ol class="podio">%s</ol></div></div>'
                          % (self.vis(v, 'f-cara'), tit, it.get('part', 0), podio))
            elif it['tipo'] == 'liga':
                cuerpo = '<h3 class="f-h">%s</h3><p class="f-p">%s</p>' % (tit, limpio(it.get('tx', ''))[:220] + '…')
            else:
                cuerpo = '<div class="f-fila">%s<div><h3 class="f-h">%s</h3></div></div>' % (self.vis(v, 'f-cara' if v[0] == 'cara' else 'rg-g'), tit)
            mezcla.append(self.f_card('%s · %s' % (cat, c), cuerpo, self.reac()))
            if len(mezcla) >= 8:
                break
        extra = {}
        for i, e in zip((2, 6), self.escena[:2]):
            extra[i] = self.f_card('DE LA ESCENA · %s · %s' % (e['fuente'], self.cuando(e['t'])),
                                   '<h3 class="f-h">%s</h3><a class="f-link">Leer en %s %s</a>'
                                   % (e['tit'], e['link'].split('/')[2], P.ico('flecha', 16)))
        enc = next((x for x in self.d.get('enc', []) if x['tipo'] == 'elegido'), None)
        if enc:
            ops = ''.join('<li><span>%s</span></li>' % o for o in enc['op'][:4])
            extra[4] = self.f_card('ENCUESTA · EL ELEGIDO · cierra %s' % self.dia(enc['hasta']),
                                   '<h3 class="f-h">¿A quién ponemos en Se busca mañana?</h3><ul class="opciones">%s</ul>'
                                   '<p class="f-p">Y %d más. Los votos no se muestran hasta que cierra.</p><a class="btn negro chico">Votar</a>'
                                   % (ops, len(enc['op']) - 4))
        video = next((x for x in self.d.get('feed', []) if x.get('tipo') == 'youtube' and 'Under Legends' in x.get('canal', '')), None)
        if video and self.r.carta('__yt__', video['vid']):
            extra[3] = self.f_card('VIDEO · %s' % video['canal'], '<img class="f-yt" alt="" src="%s"><h3 class="f-h">%s</h3>'
                                   % (self.r.carta('__yt__', video['vid']), limpio(video['tit'])), self.reac())
        for i in sorted(extra, reverse=True):
            mezcla.insert(min(i, len(mezcla)), extra[i])
        tarjetas = ''.join(cards + mezcla)
        if pc:
            return (self.cabecera(True, 'Publicaciones') + '<div class="f3"><aside class="f-izq">%s</aside><main class="f-centro">%s%s</main>'
                    '<aside class="f-der">%s%s</aside></div>'
                    % (self.tu_temporada(), self.historias(False), tarjetas,
                       self.fechas().replace('class="rail fechas2"', 'class="rail vertical fechas2"'), self.ranking_top()))
        return self.cabecera(False, 'Publicaciones') + self.historias(False) + '<div class="f-lista">%s</div>' % tarjetas + self.tabbar('publicaciones')

    # ── Yo ─────────────────────────────────────────────────────────────────
    def yo_pagina(self, pc):
        f = self.yo
        ev, falta = f['ev'], max(0, 10 - f['ev'])
        bus = self.buscado(f['k'])
        vivo = self.vivo()
        aviso = ('<a class="aviso-vivo"><span class="tag">EN VIVO</span><b>%s</b>%s</a>' % (limpio(vivo[0]['nombre']), P.ico('flecha', 18))
                 if vivo else '')
        heroe = ('<section class="yo-hero"><div class="yo-carta">%s<span class="sticker2">TU CARTA</span></div>'
                 '<div class="yo-dat"><span class="yo-hola">HOLA, %s</span><b class="yo-pos">#%d</b>'
                 '<small>OVR %d · %s pts · %d eventos</small><div class="yo-prog"><div class="barra10">%s</div>'
                 '<small>%s</small></div>%s'
                 '<div class="yo-acc"><a class="btn verde">Compartir mi carta</a><a class="btn borde2">Mi perfil</a></div></div></section>'
                 % (self.carta(f['k'], cls='ci yo-ci'), f['n'].upper(), f['pos'], f['ovr'], num(f['pts']), ev,
                    ''.join('<i class="%s"></i>' % ('si' if i < ev else '') for i in range(10)),
                    ('Todavía sin letra: te faltan %d eventos.' % falta) if falta else 'Ya tenés letra.',
                    ('<div class="te-buscan"><b>HOY TE BUSCAN</b><span>%s pts · %s · %s</span></div>'
                     % (num(bus['v']), bus['cn'], bus['m'])) if bus else ''))
        req = {r['id']: r for r in self.d.get('requisitos', [])}
        cartas = []
        for cual, nombre in (('temporada', 'Temporada'), ('competitivo', 'Competitiva'), ('servidor', 'Servidor'), ('pais', 'País')):
            tiene = cual in (f.get('c') or [])
            if tiene:
                cartas.append('<a class="mc2 %s"><span class="mc2-img">%s</span><b>%s</b><small>%s</small></a>'
                              % ('on' if cual == 'temporada' else '', self.carta(f['k'], cual, 'mc2-ci'), nombre,
                                 'Tu carta principal' if cual == 'temporada' else 'Ver'))
            else:
                pide = ', '.join((req.get(cual) or {}).get('pide', []))
                prog = ('%d/10 eventos' % ev) if cual == 'competitivo' else pide
                cartas.append('<a class="mc2 bloq"><span class="mc2-img">🔒</span><b>%s</b><small>%s</small></a>' % (nombre, prog))
        selector = ('<section class="sec elegir"><div class="sec-t"><h2>Tus cartas</h2><a>Compartir %s</a></div><div class="mis-cartas">%s</div>'
                    '<small class="el-nota">Tocá una para verla. La que dejes marcada es la que ven los demás en tu perfil.</small></section>'
                    % (P.ico('flecha', 16), ''.join(cartas)))
        sem = self.semana_de(f['k'])
        titulos = sum(1 for _, pto, _p in sem if pto == 'Campeón')
        semana = ('<section class="sec"><div class="sec-t"><h2>Tu semana</h2><a>Tus eventos %s</a></div><div class="casillas3">'
                  '<div class="v"><b>%d</b><small>eventos</small></div><div><b>+%s</b><small>puntos</small></div>'
                  '<div><b>%d</b><small>%s</small></div></div><ul class="sem-l">%s</ul></section>'
                  % (P.ico('flecha', 16), len(sem), num(sum(p for _, _t, p in sem)), titulos, 'título' if titulos == 1 else 'títulos',
                     ''.join('<li><img alt="" src="%s"><span>%s<small>%s</small></span><b>%s</b></li>'
                             % (self.logo(ll['sv']), limpio(ll['nombre']), pto, '+' + num(p)) for ll, pto, p in sem)))
        prox = ''
        for e in self.vivo() + self.luego():
            en = self.vivo() and e is self.vivo()[0]
            prox += ('<article class="prox"><img alt="" src="%s"><div><b>%s</b><small>%s</small></div><span class="prox-c">%s</span></article>'
                     % (self.logo(e['sv']), limpio(e['nombre']), '%s · %s' % (e['sv'], e.get('modalidad') or 'se juega en Discord'),
                        'EN VIVO' if en else self.hora(e['cuando'])))
        prox = ('<section class="sec"><div class="sec-t"><h2>Lo que viene</h2><a>Calendario %s</a></div><div class="prox-l">%s</div></section>'
                % (P.ico('flecha', 16), prox))
        h = self.h2h(f['k'])
        orden = sorted(h.items(), key=lambda x: (-(x[1]['g'] + x[1]['p']), x[1]['g'] - x[1]['p']))
        riv = ''.join('<li>%s<b>%s</b><span class="rec %s">%d - %d</span><small>%s</small></li>'
                      % (self.cara(self.fila(n)['k'] if self.fila(n) else '', n, 'mono-c'), n, 'perd' if v['p'] > v['g'] else '',
                         v['g'], v['p'], v['ult']) for n, v in orden[:4])
        rivales = ('<section class="sec"><div class="sec-t"><h2>Tus rivales</h2><a>Cara a cara %s</a></div><ul class="rivales">%s</ul></section>'
                   % (P.ico('flecha', 16), riv))
        ej = [self.T[k] for k in self.sigue]
        estado = {}
        for it in self.muro:
            for q, k in zip(it.get('quien', []), it.get('ks', [])):
                if k not in estado and it['tipo'] in ('campeon', 'caza', 'rango', 'tarjeta'):
                    estado[k] = {'campeon': 'CAMPEÓN %s' % self.cuando(it['t']).upper(), 'caza': 'CAZÓ A %s' % it.get('a', '').upper(),
                                 'rango': 'RANGO %s' % it.get('rg', ''), 'tarjeta': 'CARTA NUEVA'}[it['tipo']]
        siguen = ''.join('<li>%s<b>%s</b><span>%s</span></li>'
                         % (self.cara(x['k'], x['n'], 'mono-c'), x['n'], estado.get(x['k'], '#%s · OVR %d' % (x['pos'] or '–', x['ovr'])))
                         for x in ej)
        siguen = ('<section class="sec"><div class="sec-t"><h2>Los que seguís</h2><a>Editar %s</a></div><ul class="tus-l">%s</ul>'
                  '<small class="el-nota">De ejemplo: a quién sigue cada uno no es público.</small></section>' % (P.ico('flecha', 16), siguen))
        if pc:
            return (self.cabecera(True, '') + aviso + '<div class="yo2"><div class="yo-izq">%s%s%s</div><div class="yo-der">%s%s%s</div></div>'
                    % (heroe, selector, semana, prox, rivales, siguen))
        return (self.cabecera(False, '') + aviso + heroe + selector + semana + prox + rivales + siguen + self.tabbar('yo'))

    # ── la página entera ────────────────────────────────────────────────────
    def cuerpo(self, que, pc):
        return {'inicio': self.inicio, 'eventos': self.eventos, 'publicaciones': self.publicaciones,
                'yo': self.yo_pagina}[que](pc)

    def css(self, pc, que='inicio'):
        return P.CSS + (P.CSS_PC if (pc and que == 'inicio') else '') + B.CSS_B + S.CSS_SITIO + S.CSS_EVENTOS + S.CSS_TIENDA + CSS_R

    def pagina(self, que, pc, tema='clara', rutas=None):
        self.r = rutas or self.r
        return ('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=%d,initial-scale=1">'
                '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900'
                '&family=Space+Mono:wght@400;700&family=Barlow+Condensed:wght@700;800&display=block">'
                '<style>%s</style></head><body><div class="app %s %s"><div class="barra-ul"></div>%s</div></body></html>'
                % (1280 if pc else 360, self.css(pc, que), tema, 'pc' if pc else 'movil', self.cuerpo(que, pc)))


CSS_R = r"""
/* la cabecera negra (Dlx, 29/09): sólo la barra de arriba; la fila de servidores sigue con el fondo de la página */
.cab.negra{--fondo:#030304;--tinta:#F6F6F6;--linea:#F6F6F6;--suave:#2A2A2E;--gris:#A5A5A0;--inv:#F6F6F6;--inv-tinta:#030304;
  background:#030304;color:#F6F6F6;border-bottom:2px solid #030304}
.noche .cab.negra{border-bottom-color:#3A3A3E}
.cab.negra .btn-ico{border-color:#F6F6F6}
.cab.negra .buscar{border-color:#6E6E6A;color:#A5A5A0}
.cab.negra .menu a{color:#F6F6F6}
.yo-chip{display:flex;align-items:center;gap:8px;border:2px solid #F6F6F6;padding:3px 12px 3px 3px;font:800 14px/1 Archivo,sans-serif}
.yo-chip .cara{width:34px;height:34px}
/* caras */
.cara,.h-c,.sc-cara,.p-foto,.mono-c,.cp-cara,.n-cara,.f-cara{overflow:hidden}
.cara{display:inline-grid;place-items:center;border-radius:50%;background:var(--inv);color:var(--inv-tinta);flex:none}
.cara img,.h-c img,.sc-cara img,.p-foto img,.mono-c img,.cp-cara img,.n-cara img,.f-cara img{width:100%;height:100%;object-fit:cover;display:block}
.ini{font:900 16px/1 Archivo,sans-serif;font-stretch:120%}
.tab-av{width:24px;height:24px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 2px currentColor}
/* las cartas de verdad */
.ci{display:block;height:auto;max-width:100%}
.sincarta{aspect-ratio:900/1314;background:#121214;color:#F6F6F6;border:2px dashed #6E6E6A;border-radius:8px;display:grid;
  justify-items:center;align-content:center;gap:8px;padding:10px;text-align:center}
.sc-cara{width:62%;aspect-ratio:1;border-radius:50%;display:grid;place-items:center;background:#2A2A2E;color:#F6F6F6;
  font:900 34px/1 Archivo,sans-serif;box-shadow:0 0 0 3px #3A3A3E}
.sincarta b{font:900 15px/1 Archivo,sans-serif;font-stretch:115%;text-transform:uppercase}
.sincarta small{font:700 10.5px/1 "Space Mono",monospace;letter-spacing:.12em;color:#A5A5A0;border:1.5px solid #6E6E6A;padding:5px 6px}
.sc-flag{width:24px;height:16px}
/* el en vivo que dice lo que se sabe */
.hv{display:flex;align-items:center;gap:12px;margin:14px 0 10px}
.hv-logo{width:56px;height:56px;border-radius:50%;border:2px solid var(--esc-tinta);flex:none}
.hv .hero-ev{margin:0}
.hero-p{margin:0;color:var(--esc-gris);font-size:14px}
.ult{margin-top:22px;border-top:2px solid var(--esc-linea);padding-top:16px;display:grid;gap:12px}
.ult-t span{display:block;font:700 11px/1 "Space Mono",monospace;letter-spacing:.12em;color:var(--verde)}
.ult-t b{display:block;font:900 20px/1.05 Archivo,sans-serif;font-stretch:115%;text-transform:uppercase;margin-top:6px}
.ult-t small{font:700 11px/1.3 "Space Mono",monospace;color:var(--esc-gris)}
.lado{position:relative;width:132px}
.gano{position:absolute;left:50%;bottom:-10px;transform:translateX(-50%) rotate(-4deg);font:900 12px/1 Archivo,sans-serif;
  font-stretch:120%;background:var(--verde);color:#030304;padding:6px 7px;border:2px solid #030304;white-space:nowrap}
.podio-h{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:4px;font:800 14px/1.2 Archivo,sans-serif}
.podio-h li{display:grid;grid-template-columns:24px 1fr auto;gap:8px;align-items:center}
.podio-h b{display:grid;place-items:center;height:22px;background:var(--esc-tinta);color:#030304;font:700 11px/1 "Space Mono",monospace}
.podio-h li:first-child b{background:var(--verde)}
.podio-h em{font:700 11px/1 "Space Mono",monospace;font-style:normal;color:var(--esc-gris)}
.ult .btn{justify-self:start}
.hero-lista span.g{color:var(--verde)}
.pc .lado{width:200px}
.pc .ult{margin-top:30px}
.pc .hero-ev{font-size:60px}
/* fechas reales */
.fechas2{grid-auto-columns:158px}
.fecha.hecho{background:var(--caja)}
.fecha.hecho .f-hora{color:var(--gris)}
.fecha.dorado{border-color:#E7B622;box-shadow:inset 0 0 0 2px #E7B622}
.f-dia b{font-size:22px}
.f-badge{justify-self:start;font:900 11px/1 Archivo,sans-serif;font-stretch:120%;background:#E7B622;color:#030304;padding:5px 6px}
/* esta semana */
.mult{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px}
.mchip{border:2px solid var(--linea);display:grid;justify-items:center;gap:4px;padding:8px 4px}
.mchip img{width:32px;height:32px;border-radius:50%;border:2px solid var(--linea)}
.mchip b{font:900 20px/1 Archivo,sans-serif;font-stretch:120%}
.mchip small{font:700 11px/1 "Space Mono",monospace}
.mchip.sube{background:var(--verde);border-color:var(--verde);color:#030304}
.mchip.sube img{border-color:#030304}
.sem-fila{border-top:1px solid var(--suave);padding:10px 0;display:grid;gap:4px}
.sem-fila b{font:700 11px/1 "Space Mono",monospace;letter-spacing:.12em;color:var(--magenta)}
.sem-fila>span{font-size:14px;line-height:1.4}
.sem-fila.dor b{color:#9A6B00}
.noche .sem-fila.dor b{color:#E7B622}
.metas{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:6px}
.metas li{display:grid;grid-template-columns:26px 1fr 84px;gap:8px;align-items:center}
.metas img{width:26px;height:26px;border-radius:50%;border:1.5px solid var(--linea)}
.mb{height:12px;border:2px solid var(--linea);display:block}
.mb i{display:block;height:100%;background:var(--tinta)}
.metas li.ok .mb i{background:var(--verde)}
.metas b{font:700 11px/1 "Space Mono",monospace;text-align:right}
.pc .semana .mult{grid-template-columns:repeat(4,160px)}
/* lo último, con cartas de verdad */
.d-vis{width:118px}
.n-vis.n-carta{width:52px;height:auto;border:0}
.n-cara,.f-cara{border-radius:50%;display:grid;place-items:center;background:var(--inv);color:var(--inv-tinta)}
.n-cara{width:52px;height:52px}
.pc .d-vis{width:170px}
/* los que mandan */
.mcs2{grid-auto-columns:138px}
.mc-ci{width:100%}
.pc .mcs2{grid-template-columns:repeat(5,1fr)}
/* ranking */
.r2 li{grid-template-columns:40px 26px 1fr 34px 54px}
.r-nom small{display:block;font:700 10.5px/1.2 "Space Mono",monospace;color:var(--gris);margin-top:2px}
.r-pts{font-size:20px;font-stretch:120%}
.r-pts small{display:block;font:700 10px/1 "Space Mono",monospace;color:var(--gris)}
.rg.sinl{border:1.5px dashed var(--gris);color:var(--gris);background:transparent}
/* tu temporada */
.te-buscan{background:#030304;color:#F6F6F6;border:2px solid var(--magenta);padding:10px 12px;display:grid;gap:4px}
.te-buscan b{font:700 11px/1 "Space Mono",monospace;letter-spacing:.12em;color:var(--magenta)}
.te-buscan span{font:800 14px/1.3 Archivo,sans-serif}
/* se busca */
.p-foto{width:64px;height:64px;display:grid;place-items:center;border:2px solid #F6F6F6;background:#2A2A2E;color:#F6F6F6;font:900 22px/1 Archivo,sans-serif}
.p-cat{font:700 10px/1.2 "Space Mono",monospace;letter-spacing:.06em;color:#A5A5A0}
.p-nota{margin:10px 0 0;font:700 11px/1.4 "Space Mono",monospace;color:var(--gris)}
/* tienda y mercancía */
.usos .fuerte{color:var(--tinta)}
.merch-mini{margin:22px 16px 0;border:2px dashed var(--linea);padding:12px 14px;display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px}
.merch-mini b{font:900 16px/1 Archivo,sans-serif;font-stretch:120%}
.merch-mini span{font:700 11px/1.4 "Space Mono",monospace;color:var(--gris)}
.pc .merch-mini{margin:30px 0 0}
/* servidores de verdad */
.svs2{display:grid;gap:8px}
.sv2{display:grid;grid-template-columns:44px 1fr auto;gap:12px;align-items:center;border:2px solid var(--linea);border-left:8px solid var(--c);padding:10px 12px}
.sv2 img{width:44px;height:44px;border-radius:50%;border:2px solid var(--linea)}
.sv2 b{display:block;font:900 15px/1.1 Archivo,sans-serif;font-stretch:112%;text-transform:uppercase}
.sv2 small{font:700 10.5px/1.3 "Space Mono",monospace;color:var(--gris)}
.sv2-n{text-align:right}
.sv2-n b{font-size:22px}
.pie-c{margin:0;font:700 12px/1.4 "Space Mono",monospace}
.pc .fila3 .sec#servidores{padding-top:30px}
/* eventos */
.t-nota{margin:0;padding:0 12px 10px;color:var(--gris);font-size:14px}
.dor-b{display:inline-block;margin:0 12px 10px;font:900 12px/1 Archivo,sans-serif;font-stretch:120%;background:#E7B622;color:#030304;padding:6px 8px}
.t-ev.dorado{border-color:#E7B622}
.t-ev.cerrado .t-est{border-style:dashed}
.t-llave .llave-wrap{overflow-x:auto}
.m.hecho span.g{font-weight:900}
.camp2{grid-auto-columns:128px}
.cp{justify-items:stretch}
.cp-ci{width:100%}
.cp-cara{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;background:var(--inv);color:var(--inv-tinta);font:900 20px/1 Archivo,sans-serif}
.mes-g i{box-shadow:0 0 0 1.5px var(--fondo)}
.mes-g span.hoy i{box-shadow:0 0 0 1.5px #F6F6F6}
.mes-g u{text-decoration:none;font:700 9px/1 "Space Mono",monospace}
/* publicaciones */
.f-logo{width:52px;height:52px;border-radius:50%;border:2px solid var(--linea)}
.f-carta{width:120px}
.f-cara{width:64px;height:64px;font:900 20px/1 Archivo,sans-serif}
.f-yt{width:100%;aspect-ratio:16/9;object-fit:cover;border:2px solid var(--linea)}
.reac span{font-size:18px}
/* yo */
.yo-ci{width:132px}
.pc .yo-ci{width:200px}
.mc2-img{background:none;border:0}
.mc2-ci{width:100%;display:block}
.mc2.bloq .mc2-img{border:2px dashed var(--gris)}
.mc2.on .mc2-img{outline-offset:2px}
.sem-l{list-style:none;margin:10px 0 0;padding:0}
.sem-l li{display:grid;grid-template-columns:30px 1fr auto;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--suave)}
.sem-l img{width:30px;height:30px;border-radius:50%;border:1.5px solid var(--linea)}
.sem-l span{font:800 14px/1.2 Archivo,sans-serif}
.sem-l small{display:block;font:700 10.5px/1.2 "Space Mono",monospace;color:var(--gris)}
.sem-l b{font:900 15px/1 Archivo,sans-serif;font-stretch:115%}
.prox-l{display:grid;gap:8px}
.mono-c{border-radius:50%}

/* segunda vuelta */
.hero-t .hv-logo{width:40px;height:40px;border-radius:50%;border:2px solid var(--esc-tinta);flex:none}
.hero-ev.largo{font-size:32px;line-height:.95}
.lado{width:112px}
.lado .hero-ci.sincarta b{font-size:13px}
.hero-der .ult{margin-top:0}
.pc .hero-in.dos{grid-template-columns:1fr 430px;gap:48px;align-items:start}
.pc .hero-der .ult{border-top:0;border-left:2px solid var(--esc-linea);padding:6px 0 0 30px;margin-top:0}
.pc .hero-der .lado{width:150px}
.pc .hero-ev{font-size:64px;margin:22px 0 14px}
.pc .hero-ev.largo{font-size:58px}
.n-vis.sincarta{width:52px;height:auto;padding:6px 4px;gap:0;border-width:1.5px;border-radius:5px}
.n-vis.sincarta b,.n-vis.sincarta small,.n-vis.sincarta .sc-flag{display:none}
.n-vis.sincarta .sc-cara{width:100%;font-size:18px;box-shadow:none}
.sv2{grid-template-columns:40px minmax(0,1fr) auto;padding:8px 12px;gap:10px}
.sv2 img{width:40px;height:40px}
.sv2 b{font-size:18px;font-stretch:120%}
.sv2 small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sv2-n b{font-size:20px}
.pc .semana .sec-t+.mult{margin-bottom:0}
.pc #semana{display:grid;grid-template-columns:auto 1fr 1fr;column-gap:28px;align-items:start}
.pc #semana .sec-t{grid-column:1/-1}
.pc #semana .mult{grid-template-columns:repeat(2,120px);grid-row:span 3}
.pc #semana .sem-fila{border-top:0;border-left:1px solid var(--suave);padding:0 0 0 20px}
.pc #semana .sem-fila:last-child{grid-column:2/-1}
.f-minis{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:8px;align-items:end}
.f-mini{width:100%;height:auto;display:block}
.f-minis .sincarta{aspect-ratio:900/1314;padding:4px;gap:2px}
.f-minis .sincarta b,.f-minis .sincarta small,.f-minis .sincarta .sc-flag{display:none}

/* tercera vuelta */
.sincarta small{white-space:nowrap;font-size:9.5px;letter-spacing:.08em;padding:4px 5px}
.gano{top:-12px;bottom:auto}
.pc .hero-der .lado{width:128px}
.pc .hero-der .vs{font-size:44px}
.pc .hero-der .versus{justify-content:flex-start;gap:18px}
.yo-carta .sticker2{top:auto;bottom:-10px;left:-6px}

/* quinta vuelta: historias, el cuadro compacto, Se busca deslizable y la computadora sin huecos */
.historias{align-items:flex-start}
.h{position:relative}
.h-w{position:relative;display:block}
.h.en-vivo .h-c{box-shadow:0 0 0 3px var(--magenta)}
.h-badge{position:absolute;left:50%;bottom:-7px;transform:translateX(-50%);font:900 9px/1 Archivo,sans-serif;font-stretch:115%;
  letter-spacing:.04em;background:var(--magenta);color:#fff;padding:3px 5px;border:2px solid var(--fondo);white-space:nowrap}
.h.en-vivo small{max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:4px}
.h.sv .h-c,.h.crew .h-c{box-shadow:0 0 0 3px var(--suave)}
.h.sv.nuevo .h-c,.h.crew.nuevo .h-c{box-shadow:0 0 0 3px var(--verde)}
.h.crew small{max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.h-c.mono{background:var(--inv);color:var(--inv-tinta);font:900 15px/1 Archivo,sans-serif;font-stretch:120%}
.h.visto .h-c{box-shadow:0 0 0 3px var(--suave)!important}
/* el cuadro compacto */
.cm-wrap{overflow-x:auto;scrollbar-width:none;margin:0 -16px;padding:0 16px}
.cm-wrap::-webkit-scrollbar{display:none}
.cm{position:relative;flex:none}
.cm-l{position:absolute;left:0;top:0;overflow:visible}
.cm-l path{fill:none;stroke:#3A3A3E;stroke-width:2}
.cm-l path.camino{stroke:var(--verde);stroke-width:3}
.cm-r{position:absolute;top:0;font:700 10px/1 "Space Mono",monospace;letter-spacing:.12em;color:var(--esc-gris)}
.cm-m{position:absolute;width:94px;height:46px;display:grid;grid-template-rows:1fr 1fr;background:#121214;border:1.5px solid #3A3A3E}
.cm-m span{display:flex;align-items:center;padding:0 7px;font:800 11.5px/1 Archivo,sans-serif;color:#F6F6F6;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cm-m span+span{border-top:1px solid #2A2A2E}
.cm-m span.x{color:#6E6E6A;text-decoration:line-through}
.cm-m span.g{background:rgba(41,178,152,.16)}
.cm-m span.camino{background:var(--verde);color:#030304}
.cm-m i{position:absolute;right:-2px;top:-9px;font:700 9px/1 "Space Mono",monospace;font-style:normal;background:#F6F6F6;color:#030304;padding:2px 4px}
.cm-m.ahora{border-color:var(--magenta);box-shadow:0 0 0 2px var(--magenta)}
.cm-m.ahora i{background:var(--magenta);color:#fff}
.cm-camp{position:absolute;width:92px;display:grid;justify-items:center;gap:4px;text-align:center}
.cm-cara{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;background:#2A2A2E;color:#F6F6F6;
  font:900 20px/1 Archivo,sans-serif;box-shadow:0 0 0 3px var(--verde);overflow:hidden}
.cm-cara img{width:100%;height:100%;object-fit:cover}
.cm-camp small{font:700 9.5px/1 "Space Mono",monospace;letter-spacing:.12em;color:var(--verde);margin-top:4px}
.cm-camp b{font:900 13px/1.05 Archivo,sans-serif;font-stretch:112%;text-transform:uppercase;max-width:92px;overflow:hidden;text-overflow:ellipsis}
.ult .cm-wrap{margin-top:4px}
.pc .hero-der .cm-wrap{margin:0;padding:0}
/* se busca, deslizable */
.mw-cab{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:-4px 0 10px;font:700 11px/1.3 "Space Mono",monospace;color:var(--gris)}
.mw-fl{display:none;gap:6px}
.mw-b{width:40px;height:40px;border:2px solid var(--linea);background:var(--fondo);color:var(--tinta);font:900 16px/1 Archivo,sans-serif;cursor:pointer}
.mw-rail{display:grid;grid-auto-flow:column;grid-auto-columns:146px;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;
  margin:0 -16px;padding:0 16px 4px}
.mw-rail::-webkit-scrollbar{display:none}
.mw-rail>*{scroll-snap-align:start}
.mw-rail .poster{height:100%}
.p-fw{position:relative;display:block}
.p-sello{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-14deg);font:900 13px/1 Archivo,sans-serif;font-stretch:120%;
  color:var(--magenta);border:2.5px solid var(--magenta);padding:4px 6px;background:rgba(3,3,4,.75);white-space:nowrap}
.p-sello.gris{color:#A5A5A0;border-color:#A5A5A0}
.poster.hecho .p-foto{filter:grayscale(1);opacity:.7}
.poster.hecho .p-precio{background:#3A3A3E}
.mw-div{display:grid;place-items:center;border-left:2px dashed var(--suave);padding:0 4px}
.mw-div span{font:700 11px/1 "Space Mono",monospace;letter-spacing:.14em;color:var(--gris);writing-mode:vertical-rl;transform:rotate(180deg)}
.poster.cazadores{justify-items:stretch;text-align:left}
.poster.cazadores ol{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.poster.cazadores li{display:grid;grid-template-columns:28px 1fr auto;gap:6px;align-items:center;font:800 12px/1.1 Archivo,sans-serif}
.poster.cazadores .mono-c{width:28px;height:28px}
.poster.cazadores em{font:700 10.5px/1 "Space Mono",monospace;font-style:normal;color:var(--magenta)}
.pc .mw-fl{display:flex}
.pc .mw-rail{grid-auto-columns:184px;margin:0;padding:0 0 4px}
/* la computadora, sin huecos */
.pc .fila2.par{display:grid;grid-template-columns:1.25fr 1fr;gap:28px;padding:0 40px;align-items:stretch}
.pc .fila2.par .tu{margin:30px 0 6px}
.pc #tienda .tienda-g{grid-template-columns:1fr 2fr}
.pc .merch-mini{margin:18px 40px 0}
.pc .svs2{grid-template-columns:repeat(5,1fr)}
.pc .sv2{grid-template-columns:40px 1fr;row-gap:8px}
.pc .sv2-n{grid-column:1/-1;text-align:left;display:flex;align-items:baseline;gap:6px}
/* el visor de historias */
.hv-ov{position:fixed;inset:0;z-index:70;background:rgba(3,3,4,.96);display:flex;justify-content:center}
.hv-box{position:relative;width:100%;max-width:430px;height:100%;display:flex;flex-direction:column;background:#030304;color:#F6F6F6;
  padding:calc(env(safe-area-inset-top,0px) + 10px) 14px calc(env(safe-area-inset-bottom,0px) + 16px)}
.hv-bars{display:flex;gap:4px}
.hv-bars i{flex:1;height:3px;background:rgba(246,246,246,.28);overflow:hidden}
.hv-bars i b{display:block;height:100%;width:0;background:#F6F6F6}
.hv-bars i.hecho b{width:100%}
.hv-cab{display:flex;align-items:center;gap:10px;margin-top:12px;position:relative;z-index:2}
.hv-cab .h-c{width:38px;height:38px;padding:0;box-shadow:0 0 0 2px #F6F6F6;background:#121214;color:#F6F6F6;font-size:13px}
.hv-cab b{display:block;font:900 14px/1.1 Archivo,sans-serif;font-stretch:112%;text-transform:uppercase}
.hv-cab small{font:700 11px/1 "Space Mono",monospace;color:#A5A5A0}
.hv-x{margin-left:auto;width:44px;height:44px;display:grid;place-items:center;background:none;border:0;color:#F6F6F6;cursor:pointer}
.hv-cuerpo{flex:1;display:grid;place-items:center;text-align:center;overflow:hidden;padding:12px 0}
.hv-cta{position:relative;z-index:2;width:100%}
.hv-zona{position:absolute;top:80px;bottom:90px;background:none;border:0;cursor:pointer;z-index:1}
.hv-zona.izq{left:0;width:34%}
.hv-zona.der{right:0;width:66%}
.st{display:grid;justify-items:center;gap:12px;max-width:340px}
.st-tag{font:700 11px/1 "Space Mono",monospace;letter-spacing:.14em;color:var(--verde)}
.st-h{font:900 24px/1.05 Archivo,sans-serif;font-stretch:115%;text-transform:uppercase;margin:0;text-wrap:balance}
.st-h.grande{font-size:34px}
.st-carta{width:190px;height:auto;display:block}
.st-cara{width:128px;height:128px;border-radius:50%;display:grid;place-items:center;background:#2A2A2E;color:#F6F6F6;
  font:900 44px/1 Archivo,sans-serif;box-shadow:0 0 0 3px var(--verde);overflow:hidden}
.st-cara img{width:100%;height:100%;object-fit:cover}
.st-logo{width:92px;height:92px;border-radius:50%;border:3px solid #F6F6F6}
.st-logo.grande{width:124px;height:124px}
.st-nom{font:900 22px/1 Archivo,sans-serif;font-stretch:115%;text-transform:uppercase}
.st-s{font:700 12px/1.45 "Space Mono",monospace;color:#A5A5A0}
.st-podio{list-style:none;margin:0;padding:0;display:grid;gap:5px;font:800 15px/1.2 Archivo,sans-serif;text-align:left}
.st-podio b{display:inline-grid;place-items:center;width:22px;height:22px;margin-right:8px;background:#F6F6F6;color:#030304;font:700 11px/1 "Space Mono",monospace}
.st-podio li:first-child b{background:var(--verde)}
.st-mult{font:900 92px/.9 Archivo,sans-serif;font-stretch:125%;color:var(--verde)}
.st-mult.baja{color:#F6F6F6}
.st-l{list-style:none;margin:0;padding:0;display:grid;gap:10px;text-align:left;font:600 15px/1.35 Archivo,sans-serif}
.st-l b{display:block;font:700 11px/1 "Space Mono",monospace;letter-spacing:.12em;color:var(--magenta);margin-bottom:3px}
.st-rg{width:128px;height:128px;display:grid;place-items:center;font:900 70px/1 Archivo,sans-serif;color:#030304;border:3px solid #F6F6F6}
.st-caza{position:relative}
.sello{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-14deg);font:900 24px/1 Archivo,sans-serif;font-stretch:120%;
  color:var(--magenta);border:3px solid var(--magenta);padding:5px 10px;background:rgba(3,3,4,.7)}
.st-minis{display:flex;gap:8px;justify-content:center;align-items:flex-end}
.st-mini-c{width:78px;height:auto;display:block}
.st-dor{font:900 12px/1 Archivo,sans-serif;font-stretch:120%;background:#E7B622;color:#030304;padding:6px 8px}
.st-crew{width:112px;height:112px;border-radius:50%;display:grid;place-items:center;background:#F6F6F6;color:#030304;
  font:900 36px/1 Archivo,sans-serif;overflow:hidden;box-shadow:0 0 0 3px var(--verde)}
.st-crew img{width:100%;height:100%;object-fit:cover}
.st-gente{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;justify-content:center;gap:10px 12px}
.st-gente li{display:grid;justify-items:center;gap:4px;font:700 11px/1 "Space Mono",monospace}
.st-mini{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:#2A2A2E;color:#F6F6F6;font:900 15px/1 Archivo,sans-serif;overflow:hidden}
.st-mini img{width:100%;height:100%;object-fit:cover}

/* sexta vuelta: «Esta semana» como tabla, igual en las dos pantallas */
.pc #semana{display:block}
.sm{list-style:none;margin:0;padding:0;border-top:2px solid var(--linea)}
.sm li{display:grid;grid-template-columns:28px 44px 54px minmax(0,1fr) 62px;column-gap:10px;row-gap:6px;align-items:center;
  padding:10px 0;border-bottom:1px solid var(--suave)}
.sm li.sm-cab{padding:7px 0;font:700 9.5px/1.2 "Space Mono",monospace;letter-spacing:.08em;color:var(--gris)}
.sm img{width:28px;height:28px;border-radius:50%;border:1.5px solid var(--linea)}
.sm-sv{font:900 15px/1 Archivo,sans-serif;font-stretch:115%}
.sm-x{font:900 18px/1 Archivo,sans-serif;font-stretch:120%;text-align:center;padding:6px 0;border:2px solid var(--linea)}
.sm li.sube .sm-x{background:var(--verde);border-color:var(--verde);color:#030304}
.sm-meta{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}
.sm-meta b{font:700 11px/1 "Space Mono",monospace;white-space:nowrap}
.sm-meta.ok .mb i{background:var(--verde)}
.sm-g{font:700 11px/1.2 "Space Mono",monospace;color:var(--gris)}
.sm-d:empty{display:none}
.sm li .sm-d{grid-column:2/-1}
.sm-dor{display:inline-block;font:900 11px/1.2 Archivo,sans-serif;font-stretch:115%;background:#E7B622;color:#030304;padding:5px 7px}
.sm-nota{margin:10px 0 0;font:700 11px/1.45 "Space Mono",monospace;color:var(--gris)}
.sm-nota b{color:var(--tinta)}
.pc .sm li{grid-template-columns:36px 90px 90px minmax(0,1.2fr) 110px minmax(0,1.4fr);column-gap:18px}
.pc .sm img{width:36px;height:36px}
.pc .sm li .sm-d{grid-column:auto;display:block}
.pc .sm-sv{font-size:18px}
.pc .sm-x{font-size:22px}

/* séptima vuelta */
.solo-pc{display:none}
.pc .solo-pc{display:inline}
.pc .hero-in.dos{grid-template-columns:minmax(0,1fr) 470px}
.pc .hero-der .ult{padding-left:24px}

/* octava vuelta: el escenario siempre tiene algo (un carrusel de momentos) */
.hero.carrusel{padding-bottom:0}
.hero.carrusel .hero-in{min-height:0}
.mo{display:none;gap:18px}
.mo.on{display:grid}
.mo-txt{min-width:0}
.mo-vis{min-width:0}
.tag.prox{background:#E7B622;color:#030304}
.tag.prox:before{background:#030304}
.tag.llave,.tag.video,.tag.liga,.tag.seguis{background:#F6F6F6;color:#030304}
.tag.llave:before,.tag.video:before,.tag.liga:before,.tag.seguis:before{background:var(--magenta)}
.mo-cuenta{display:flex;align-items:baseline;gap:10px;margin-top:14px}
.mo-cuenta small{font:700 11px/1 "Space Mono",monospace;letter-spacing:.12em;color:var(--esc-gris)}
.mo-cuenta b{font:900 30px/1 Archivo,sans-serif;font-stretch:125%;color:#E7B622}
.mo-logo{position:relative;display:grid;place-items:center}
.mo-logo img{width:150px;height:150px;border-radius:50%;border:3px solid var(--esc-tinta)}
.mo-logo.vivo img{box-shadow:0 0 0 6px var(--magenta)}
.mo-logo.ul img{border-color:var(--verde)}
.mo-sello{position:absolute;bottom:4px;left:50%;transform:translateX(-50%) rotate(-6deg);font:900 14px/1 Archivo,sans-serif;font-stretch:120%;
  background:#E7B622;color:#030304;padding:6px 9px;border:2px solid #030304;white-space:nowrap}
.mo-video{position:relative;aspect-ratio:16/9;background:#121214;border:2px solid var(--esc-linea);overflow:hidden}
.mo-video img{width:100%;height:100%;object-fit:cover;display:block}
.mo-play{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:56px;height:56px;display:grid;place-items:center;
  background:var(--magenta);color:#fff;font:900 22px/1 Archivo,sans-serif}
.mo-cara{display:grid;place-items:center}
.mo-tabs{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin:20px -16px 0;padding:0 16px 16px;position:relative;z-index:1}
.mo-tabs::-webkit-scrollbar{display:none}
.mo-tabs button{flex:none;font:700 11px/1 "Space Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--esc-tinta);
  background:transparent;border:1.5px solid var(--esc-linea);padding:9px 10px;cursor:pointer}
.mo-tabs button.on{background:var(--esc-tinta);color:#030304;border-color:var(--esc-tinta)}
.mo-tabs button.vivo{border-color:var(--magenta)}
.mo-tabs button.vivo.on{background:var(--magenta);color:#fff}
.pc .hero.carrusel{padding-bottom:34px}
.pc .hero.carrusel .hero-in{display:block}
.pc .mo{grid-template-columns:minmax(0,1fr) 470px;gap:48px;align-items:center;min-height:360px}
.pc .mo-logo img{width:220px;height:220px}
.pc .mo-tabs{margin:18px 0 0;padding:0 0 22px}
.pc .mo-llave .cm-wrap{margin:0;padding:0}

/* novena vuelta: las flechas del escenario, con estilo */
.hero.carrusel{padding-left:48px;padding-right:48px}
.hero.carrusel .mo-tabs{margin-left:-48px;margin-right:-48px;padding-left:16px;padding-right:16px}
.hero.carrusel .cm-wrap{margin:0 -48px;padding:0 48px}
.hero.carrusel .hero-ev.largo{font-size:28px}
.mo-fl{position:absolute;top:calc(50% - 44px);z-index:3;width:38px;height:38px;display:grid;place-items:center;padding:0;
  background:#F6F6F6;color:#030304;border:2px solid #030304;cursor:pointer;transition:transform .12s,box-shadow .12s,background .12s}
.mo-fl.izq{left:5px;box-shadow:-4px 4px 0 var(--verde)}
.mo-fl.izq svg{transform:scaleX(-1)}
.mo-fl.der{right:5px;box-shadow:4px 4px 0 var(--magenta)}
.mo-fl.izq:hover{background:var(--verde)}
.mo-fl.der:hover{background:var(--magenta);color:#fff}
.mo-fl.izq:active{transform:translate(-3px,3px);box-shadow:-1px 1px 0 var(--verde)}
.mo-fl.der:active{transform:translate(3px,3px);box-shadow:1px 1px 0 var(--magenta)}
.mo-fl:focus-visible{outline:3px solid var(--magenta);outline-offset:3px}
.pc .hero.carrusel{padding-left:104px;padding-right:104px}
.pc .hero.carrusel .mo-tabs{margin-left:0;margin-right:0;padding-left:0;padding-right:0}
.pc .hero.carrusel .cm-wrap{margin:0;padding:0}
.pc .hero.carrusel .hero-ev.largo{font-size:54px}
.pc .mo-fl{width:56px;height:56px;top:calc(50% - 50px)}
.pc .mo-fl svg{width:28px;height:28px}
.pc .mo-fl.izq{left:28px;box-shadow:-6px 6px 0 var(--verde)}
.pc .mo-fl.der{right:28px;box-shadow:6px 6px 0 var(--magenta)}
.pc .mo{grid-template-columns:minmax(0,1fr) 430px}
@media (prefers-reduced-motion: reduce){.mo-fl{transition:none}}
.hero.carrusel .mo-cuenta{flex-wrap:wrap;gap:4px 10px}
.hero.carrusel .mo-cuenta b{font-size:24px}
.pc .hero.carrusel .mo-cuenta b{font-size:34px}

/* décima vuelta (Dlx, 29/09 ~6:30 PM): secciones con pestañas y flechas, y bandas negras con los mismos tokens que
   la cabecera negra (así lo de adentro se da vuelta solo). «Los que mandan» deja `oscura`: en la noche era magenta */
.sec.negra,.pie.negra{--fondo:#030304;--tinta:#F6F6F6;--linea:#F6F6F6;--suave:#2A2A2E;--gris:#A5A5A0;--caja:#101012;--inv:#F6F6F6;
  --inv-tinta:#030304;background:var(--fondo);color:var(--tinta)}
.sec.negra{margin-top:18px;padding-bottom:26px}
.pc .sec.negra{padding-bottom:36px}
.noche .sec.negra,.noche .pie.negra{--fondo:#121214}
.sec.negra+.pie.negra{margin-top:0;border-top-color:#2A2A2E}
.pz-cab{display:flex;align-items:center;gap:12px;margin:-2px 0 16px}
.pz-tabs{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;flex:1;min-width:0;padding:2px 0}
.pz-tabs::-webkit-scrollbar{display:none}
.pz-tabs button{flex:none;font:700 11px/1 "Space Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--tinta);
  background:transparent;border:1.5px solid var(--linea);padding:9px 10px;cursor:pointer}
.pz-tabs button.on{background:var(--tinta);color:var(--fondo)}
.pz-fl{display:flex;gap:12px;flex:none;padding:0 4px 4px 4px}
.pz-b{width:38px;height:38px;display:grid;place-items:center;padding:0;background:#F6F6F6;color:#030304;border:2px solid #030304;
  cursor:pointer;transition:transform .12s,box-shadow .12s,background .12s}
.pz-b.izq{box-shadow:-4px 4px 0 var(--verde)}
.pz-b.izq svg{transform:scaleX(-1)}
.pz-b.der{box-shadow:4px 4px 0 var(--magenta)}
.pz-b.izq:hover{background:var(--verde)}
.pz-b.der:hover{background:var(--magenta);color:#fff}
.pz-b.izq:active{transform:translate(-3px,3px);box-shadow:-1px 1px 0 var(--verde)}
.pz-b.der:active{transform:translate(3px,3px);box-shadow:1px 1px 0 var(--magenta)}
.pz-b:focus-visible,.pz-tabs button:focus-visible{outline:3px solid var(--magenta);outline-offset:3px}
.pc .pz-b{width:44px;height:44px}
.pz{display:none}
.pz.on{display:block}
@media (prefers-reduced-motion: reduce){.pz-b{transition:none}}
/* los que mandan: países y crews como afiches del mismo tamaño que las cartas */
.mc-tile{position:relative;aspect-ratio:300/438;border:2px solid var(--linea);background:var(--caja);display:grid;place-items:center;overflow:hidden}
.mc-n{position:absolute;left:10px;top:8px;font:900 30px/1 Archivo,sans-serif;font-stretch:125%}
.mc-bandera{width:76%;aspect-ratio:3/2;object-fit:cover;border:2px solid var(--linea)}
.mc-logo{width:72%;aspect-ratio:1;object-fit:contain}
.mc-ini{font:900 44px/1 Archivo,sans-serif;font-stretch:125%;color:var(--gris)}
.pc .mc-n{font-size:40px}
/* el panel de abajo */
.pz-2{display:grid;gap:16px}
.pc .pz-2{grid-template-columns:1.25fr 1fr;gap:28px;align-items:start}
.pz .tu{margin:0}
.mis,.te,.rec,.act{border:2px solid var(--linea);background:var(--fondo)}
.mis-cab{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:11px 14px;border-bottom:2px solid var(--linea);
  font:700 11px/1.3 "Space Mono",monospace;letter-spacing:.08em}
.mis-cab em{font-style:normal;color:var(--magenta);white-space:nowrap;display:inline-flex;align-items:center;gap:6px}
.mis ol,.te-l,.rec ol{list-style:none;margin:0;padding:0}
.mis li{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px 14px;border-bottom:1px solid var(--suave)}
.mis li:last-child,.te-l li:last-child,.rec li:last-child{border-bottom:0}
.mis-ok{width:28px;height:28px;border:2px solid var(--linea);display:grid;place-items:center;font:900 15px/1 Archivo,sans-serif}
.mis li.hecha .mis-ok{background:var(--verde);border-color:var(--verde);color:#030304}
.mis-txt{display:grid;gap:6px}
.mis-txt b{font:800 15px/1.2 Archivo,sans-serif}
.mis-txt .mb{height:10px}
.mis li.hecha .mb i{background:var(--verde)}
.mis-txt small{font:700 11px/1 "Space Mono",monospace;color:var(--gris)}
.mis-pts{font:900 18px/1 Archivo,sans-serif;font-stretch:120%;text-align:right;white-space:nowrap}
.mis-pts small{display:block;font:700 10px/1.4 "Space Mono",monospace;letter-spacing:.08em;color:var(--gris)}
.mis li.hecha .mis-pts{color:var(--gris)}
.tu.pase .tu-t{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
.tag-pronto{font:700 10px/1 "Space Mono",monospace;letter-spacing:.1em;background:#E7B622;color:#030304;padding:4px 6px}
.pase-sig{width:48px;height:48px;display:grid;place-items:center;border:2px dashed var(--gris);color:var(--gris);font:900 22px/1 Archivo,sans-serif}
.pase-b{height:14px}
.pase-b i{background:var(--magenta)}
.pase-l{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.pase-l li{display:flex;justify-content:space-between;gap:12px;font:400 14px/1.3 Archivo,sans-serif;color:var(--gris);
  border-bottom:1px solid var(--suave);padding-bottom:8px}
.pase-l b{color:var(--tinta);font-weight:800;text-align:right}
.pase-nota{font:700 10.5px/1.4 "Space Mono",monospace;color:var(--gris)}
.te-l li{display:grid;grid-template-columns:40px minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 14px;border-bottom:1px solid var(--suave)}
.te-l img{width:40px;height:40px;border-radius:50%;border:2px solid var(--linea)}
.te-l b{display:block;font:800 14px/1.15 Archivo,sans-serif;font-stretch:112%;text-transform:uppercase}
.te-l small{font:700 10.5px/1.35 "Space Mono",monospace;color:var(--gris)}
.te-vos{text-align:right;font:900 13px/1.1 Archivo,sans-serif;font-stretch:115%;padding:6px 8px;border:2px solid var(--linea);white-space:nowrap}
.te-vos small{display:block;font:700 10px/1.3 "Space Mono",monospace}
.te-vos.campeon{background:var(--verde);border-color:var(--verde);color:#030304}
.te-vos.no{border-color:var(--suave);color:var(--gris)}
.num-g{display:grid;gap:16px}
.pc .num-g{grid-template-columns:1.35fr 1fr;gap:28px;align-items:start}
.num-4{display:grid;grid-template-columns:1fr 1fr;border:2px solid var(--linea);margin-bottom:16px}
.pc .num-4{grid-template-columns:repeat(4,1fr)}
.num-4 div{padding:12px 14px;display:grid;gap:4px;border-right:1px solid var(--suave);border-bottom:1px solid var(--suave)}
.num-4 span{font:700 10px/1.2 "Space Mono",monospace;letter-spacing:.1em;color:var(--gris)}
.num-4 b{font:900 30px/1 Archivo,sans-serif;font-stretch:125%}
.num-4 small{font:400 12px/1.3 Archivo,sans-serif;color:var(--gris)}
.act-g{display:grid;grid-template-columns:repeat(14,1fr);gap:5px;padding:14px 14px 6px}
.act-g i{display:grid;gap:4px;font-style:normal}
.act-b{height:84px;display:flex;flex-direction:column-reverse;border-bottom:2px solid var(--linea)}
.act-b u{display:block;text-decoration:none}
.act-g em{font:700 10px/1 "Space Mono",monospace;font-style:normal;color:var(--gris);text-align:center}
.act-n{margin:0;padding:6px 14px 12px;font:700 11px/1.4 "Space Mono",monospace;color:var(--gris)}
.act-n b{color:var(--tinta)}
.rec li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 12px;padding:10px 14px;border-bottom:1px solid var(--suave)}
.rec li span{grid-column:1/-1;font:700 10px/1.2 "Space Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--gris)}
.rec li b{font:900 15px/1.1 Archivo,sans-serif;font-stretch:115%;text-transform:uppercase}
.rec li em{font:900 17px/1 Archivo,sans-serif;font-stretch:120%;font-style:normal;color:var(--magenta)}
/* Se busca en negro: los afiches pasan a papel, pegados en la pared */
.negra .poster{background:#F6F6F6;color:#030304;border-color:#F6F6F6}
.negra .p-foto{border-color:#030304;background:#E2E2DE;color:#030304}
.negra .p-cat{color:#6E6E6A}
.negra .poster.hecho .p-precio{background:#6E6E6A}
.negra .poster.cazadores li b{color:#030304}
.negra .p-sello.gris{color:#6E6E6A;border-color:#6E6E6A}
/* los cinco servidores entran en la computadora: una grilla `1fr` no achica texto sin cortar */
.pc .svs2{grid-template-columns:repeat(5,minmax(0,1fr))}
.sv2>div{min-width:0}
/* Se busca: la división «AYER» es una línea, no un afiche vacío */
.mw-rail{grid-auto-columns:max-content}
.mw-rail .poster{width:146px}
.pc .mw-rail{grid-auto-columns:max-content}
.pc .mw-rail .poster{width:184px}
.mw-div{width:34px;padding:0}
/* la meta de «Esta semana»: las barras terminan todas en el mismo lugar */
.sm-meta b{min-width:7ch}
"""


# ── para regenerarlas: python docs/remake/reales.py <carpeta> [yo] [a,quién,sigue] ─────────────
def _bajar(url):
    """La web pública. Si el Python de la máquina no confía en el certificado, se lo pide a curl."""
    import subprocess
    import urllib.request
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (maqueta remake)'})
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read()
    except Exception:
        return subprocess.run(['curl', '-sS', '-m', '30', '-A', 'Mozilla/5.0 (maqueta remake)', url],
                              capture_output=True, check=True).stdout


def _escena():
    """Los titulares de Mundo Freestyle y Urban Roosters News: título, fuente, fecha y link. Nunca el texto."""
    import email.utils
    import xml.etree.ElementTree as ET_XML
    out = []
    for url, fuente in (('https://mundofreestyle.com/feed/', 'Mundo Freestyle'), ('https://urbanroosters.news/feed/', 'Urban Roosters News')):
        try:
            raiz = ET_XML.fromstring(_bajar(url))
        except Exception:
            continue
        for it in raiz.iter('item'):
            p = it.findtext('pubDate')
            out.append({'fuente': fuente, 'tit': (it.findtext('title') or '').strip(), 'link': (it.findtext('link') or '').strip(),
                        't': email.utils.parsedate_to_datetime(p).isoformat() if p else ''})
    return sorted(out, key=lambda x: x['t'], reverse=True)


def main():
    """Baja /api/lobby y /api/muro de la web pública y dibuja las páginas. Las cartas y las caras quedan apuntando a
    R2 y al CDN de Discord, así que se ven en un navegador con internet (en un artifact no: ahí van copiadas)."""
    import io
    import json
    base = 'https://underlegends.pages.dev'
    lobby, muro = json.loads(_bajar(base + '/api/lobby')), json.loads(_bajar(base + '/api/muro'))
    salida = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'salida')
    yo = sys.argv[2] if len(sys.argv) > 2 else None
    sigue = sys.argv[3].split(',') if len(sys.argv) > 3 else ()
    liga = Liga(lobby, muro, _escena(), dt.datetime.now(dt.timezone.utc), yo=yo, sigue=sigue)
    orden = lobby['cartas']

    def carta(k, cual):
        if k == '__yt__':
            return 'https://i.ytimg.com/vi/%s/mqdefault.jpg' % cual
        f = liga.T.get(k) or {}
        v = f['cv'].split('.')[orden.index(cual)] if isinstance(f.get('cv'), str) else ''
        return '%s/%s/%s.webp%s' % (lobby['r2'], k, cual, ('?v=' + v) if v else '')

    def av(k):
        f = liga.T.get(k) or {}
        return 'https://cdn.discordapp.com/avatars/%s.webp?size=128' % f['av'] if f.get('av') else None

    rutas = Rutas(carta=carta, av=av)
    os.makedirs(salida, exist_ok=True)
    n = 0
    for que in ('inicio', 'eventos', 'publicaciones', 'yo'):
        if que == 'yo' and not liga.yo:
            continue
        for pc in (False, True):
            for tema in ('clara', 'noche'):
                nombre = 'sitio_%s%s%s.html' % ('noche_' if tema == 'noche' else '', que, '_pc' if pc else '')
                io.open(os.path.join(salida, nombre), 'w', encoding='utf-8', newline='\n').write(liga.pagina(que, pc, tema, rutas))
                n += 1
    print('ok · %d páginas en %s' % (n, salida))


if __name__ == '__main__':
    main()
