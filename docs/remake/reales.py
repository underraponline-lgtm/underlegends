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
"""
import datetime as dt
import os
import re
import sys

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
        fase = self.fase()
        if pc:
            quien = ('<a class="yo-chip">%s<span>%s</span></a>' % (self.cara(self.yo['k'], self.yo['n'], 'cara'), self.yo['n'])
                     if self.yo else '<a class="btn verde chico">Entrar</a>')
            return ('<header class="cab negra">%s%s<div class="cab-der"><span class="buscar">%s Buscar rapero</span>%s%s</div>'
                    '</header>%s' % (marca, S.menu(activa), P.ico('buscar', 18), campana, quien, fase))
        return ('<header class="cab negra">%s<div class="cab-der">%s<button class="btn-ico hamb" type="button" aria-label="Menú">%s'
                '</button></div></header>%s' % (marca, campana, S.ico('menu', 22), fase))

    def fase(self):
        f = self.d.get('fase') or {}
        if not f.get('arranca'):
            return ''
        a = dt.date.fromisoformat(f['arranca'])
        falta = (a - self.ahora.astimezone(ET).date()).days
        if falta <= 0:
            return ''
        return ('<div class="fase"><b>FASE DE PRUEBA</b><span>La Temporada 1 arranca el %s %d/%d · faltan %d días</span></div>'
                % (DIAS[a.weekday()], a.day, a.month, falta))

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

    def historias(self, pc):
        vivos = {e['sv'] for e in self.vivo()}
        orden = sorted(self.svs.values(), key=lambda s: -s['n'])
        h = ''.join('<a class="h %s"><span class="h-c"><img alt="" src="%s"></span><small>%s</small>%s</a>'
                    % ('vivo' if s['sv'] in vivos else '', self.logo(s['sv']), s['sv'],
                       '<em class="rojo">EN VIVO</em>' if s['sv'] in vivos else '')
                    for s in orden)
        h += '<span class="h-sep" aria-hidden="true"></span>'
        h += ''.join('<a class="h gente nuevo">%s<small>%s</small><em>%s</em></a>' % (self.cara(k, n, 'h-c'), n, et)
                     for k, n, et in self.novedades_gente()[:8 if pc else 6])
        return '<nav class="historias" aria-label="Servidores y gente">%s</nav>' % h

    # ── Inicio ─────────────────────────────────────────────────────────────
    def hero(self, pc):
        ll = self.llaves()[0]
        fin = next((r for r in ll['rondas'] if r['r'] == 'Final'), ll['rondas'][-1])['b'][0]
        a, b = [limpio(x if isinstance(x, str) else ' & '.join(x)) for x in fin[0][:2]]
        g = limpio(fin[1] if isinstance(fin[1], str) else ' & '.join(fin[1]))
        fa, fb = self.fila(a), self.fila(b)
        lados = []
        for nombre, f in ((a, fa), (b, fb)):
            pieza = self.carta(f['k'], cls='ci hero-ci') if f else self.sin_carta(nombre, '', '', 'ci hero-ci')
            lados.append('<div class="lado">%s%s</div>' % (pieza, '<span class="gano">CAMPEÓN</span>' if nombre == g else ''))
        podio = ''.join('<li><b>%d</b>%s<em>+%s</em></li>' % (i + 1, limpio(x[0]), num(x[2])) for i, x in enumerate(ll['tabla'][:3]))
        ult = ('<div class="ult"><div class="ult-t"><span>%s · LA FINAL</span><b>%s</b><small>%s · %d raperos</small></div>'
               '<div class="versus">%s<b class="vs">VS</b>%s</div><ol class="podio-h">%s</ol>'
               '<a class="btn borde chico">Ver la llave</a></div>'
               % (self.cuando(self.fecha_llave(ll)).upper(), limpio(ll['nombre']), ll['sv'], ll['participantes'],
                  lados[0], lados[1], podio))
        vivo = self.vivo()
        if vivo:
            e = vivo[0]
            m = self.mult_sv(e['sv'])
            meta = '%s · EMPEZÓ %s%s' % (e['sv'], self.hora(e['cuando']), (' · %s ESTA SEMANA' % mult(m)) if m else '')
            titulo = limpio(e['nombre'])
            arriba = ('<div class="hero-t"><img class="hv-logo" alt="" src="%s"><span class="tag">EN VIVO AHORA</span>'
                      '<span class="hero-meta">%s</span></div><h1 class="hero-ev%s">%s</h1>'
                      '<p class="hero-p">La llave aparece acá apenas la carguen. Mientras, se mira en Discord.</p>'
                      '<div class="hero-acc"><a class="btn verde">Mirar en Discord ↗</a><a class="btn borde">%sQuiero aviso</a></div>'
                      % (self.logo(e['sv']), meta, ' largo' if len(titulo) > 16 else '', titulo, P.ico('campana', 18)))
        else:
            arriba = ''
        lista = ''
        if False:
            filas = []
            for r in reversed(ll['rondas']):
                if r['r'] in ('Filtros',):
                    continue
                for bb in r['b']:
                    x, y = [limpio(z if isinstance(z, str) else ' & '.join(z)) for z in bb[0][:2]]
                    gg = limpio(bb[1] if isinstance(bb[1], str) else ' & '.join(bb[1]))
                    filas.append('<li class="%s"><span class="%s">%s</span><em>vs</em><span class="%s">%s</span><b>%s</b></li>'
                                 % ('on' if r['r'] == 'Final' else 'hecho', 'g' if gg == x else '', x, 'g' if gg == y else '', y,
                                    r['r'][:5].upper()))
            lista = ('<aside class="hero-lista"><div class="hl-t">LA LLAVE · %s</div><ol>%s</ol>'
                     '<div class="hl-pie">%d raperos · la llave se cargó sola al terminar</div></aside>'
                     % (limpio(ll['nombre']), ''.join(filas[:9]), ll['participantes']))
        if pc and arriba:
            return ('<section class="hero" id="envivo"><div class="hero-in dos"><div class="hero-main">%s</div>'
                    '<div class="hero-der">%s</div></div></section>' % (arriba, ult))
        return ('<section class="hero" id="envivo"><div class="hero-in"><div class="hero-main">%s%s</div>%s</div></section>'
                % (arriba, ult, lista))

    def ir_a(self):
        s = [('envivo', 'En vivo'), ('fechas', 'Fechas'), ('semana', 'Esta semana'), ('noticias', 'Lo último'),
             ('raperos', 'Los que mandan'), ('ranking', 'Ranking'), ('sebusca', 'Se busca'), ('tienda', 'Tienda'),
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
        m = self.d.get('mult') or {}
        if not m:
            return ''
        chips = ''.join('<span class="mchip %s"><img alt="" src="%s"><b>%s</b><small>%s</small></span>'
                        % ('sube' if x > 1 else 'baja', self.logo(sv), mult(x), sv)
                        for sv, x in sorted(m.get('sv', {}).items(), key=lambda z: -z[1]))
        g = self.dorado()
        dorado = ''
        if g:
            dorado = ('<div class="sem-fila dor"><b>EVENTO DORADO ×3</b><span>El primer evento de %s desde el %s: <strong>%s</strong>, %s.</span></div>'
                      % (g['sv'], DIAS[utc(m['dorado']['desde']).astimezone(ET).weekday()], limpio(g['n']), self.dia(g['t'])))
        guerra = ''
        if m.get('guerra'):
            guerra = ('<div class="sem-fila"><b>GUERRA DE SERVIDORES</b><span>%s. Gana el que más puntos hace por persona y se lleva ×1,5 la semana que viene.</span></div>'
                      % ' · '.join('%s vs %s' % tuple(p) for p in m['guerra']['pares']))
        metas = ''
        if m.get('metas'):
            barras = ''
            for sv, meta in sorted(m['metas'].items(), key=lambda z: -(m['meta_va'].get(z[0], 0) / z[1])):
                va = m['meta_va'].get(sv, 0)
                ok = va >= meta
                barras += ('<li class="%s"><img alt="" src="%s"><span class="mb"><i style="width:%d%%"></i></span><b>%s</b></li>'
                           % ('ok' if ok else '', self.logo(sv), min(100, round(100 * va / meta)),
                              '%d de %d ✓' % (va, meta) if ok else '%d de %d' % (va, meta)))
            metas = ('<div class="sem-fila"><b>META DE COMUNIDAD</b><span>Si juega esa cantidad de gente distinta en la semana, '
                     'todos los que jugaron suman un 10 %% más.</span><ul class="metas">%s</ul></div>' % barras)
        return self.sec('semana', 'Esta semana', 'Lunes de la Liga',
                        '<div class="mult">%s</div>%s%s%s' % (chips, dorado, guerra, metas), 'semana')

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

    def raperos(self, pc):
        top = self.oficiales()[:5]
        return self.sec('raperos', 'Los que mandan', 'Todos los raperos', '<div class="rail mcs2">%s</div>' % ''.join(
            '<article class="mc">%s<div class="mc-pie"><span class="mc-pais"><img alt="" src="%s">%s</span><b>%s</b>'
            '<small>#%d · OVR %d · %s PTS</small></div></article>'
            % (self.carta(f['k'], cls='ci mc-ci'), bandera(f['cc']), PAIS.get(f['cc'], f['cc'].upper()), f['n'], f['pos'], f['ovr'],
               num(f['pts'])) for f in top), 'oscura')

    def ranking_top(self):
        top = self.oficiales()[:5]
        filas = ''.join(
            '<li class="p%d"><span class="r-pos">%d</span><img class="r-flag" alt="" src="%s"><span class="r-nom">%s<small>%s pts · %d ev</small></span>%s'
            '<span class="r-pts">%d<small>OVR</small></span></li>'
            % (f['pos'], f['pos'], bandera(f['cc']), f['n'], num(f['pts']), f['ev'], self.rango(f['rg']), f['ovr']) for f in top)
        return self.sec('ranking', 'Ranking', 'Los %d oficiales' % self.d.get('oficiales', 0), '<ol class="top5 r2">%s</ol>' % filas)

    def buscados(self):
        mw = self.d.get('mw') or {}
        if not mw.get('b'):
            return ''
        hasta = self.dia(mw['fin'])
        return self.sec('sebusca', 'Se busca', 'Most Wanted', '<div class="posters">%s</div><p class="p-nota">Quien le gane, cobra en su '
                        'Temporada y el 10 %% en Puntos de Tienda. Vencen %s.</p>' % (''.join(
                            '<article class="poster"><span class="p-t">SE BUSCA</span>%s<b>%s</b><span class="p-cat">%s</span>'
                            '<span class="p-precio">%s PTS</span><small>%s</small></article>'
                            % (self.cara(b['k'], b['n'], 'p-foto'), b['n'], b['cn'].upper(), num(b['v']), b['m'])
                            for b in mw['b']), hasta))

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
        return self.sec('servidores', 'Los servidores de la Liga', 'Mundo', '<div class="svs2">%s</div>' % filas)

    def pie(self):
        c = self.d.get('comunidad') or {}
        return ('<footer class="pie"><div class="pie-marca"><img alt="" src="%s"><span>UNDER LEGENDS<small>LIGA GLOBAL · TEMPORADA 1</small></span></div>'
                '<p class="pie-c">%s personas en %d servidores · %s verificados</p>'
                '<nav><a>Guía</a><a>Publicaciones</a><a>Tienda</a><a>Mundo</a><a>Privacidad</a></nav>'
                '<small>Los datos se actualizan solos cada media hora.</small></footer>'
                % (P.UL, num(c.get('personas', 0)), c.get('servidores', 0), num(c.get('verificados', 0))))

    def inicio(self, pc):
        if pc:
            return (self.cabecera(True, 'Inicio') + self.historias(True) + self.hero(True) + self.ir_a() + self.fechas()
                    + self.semana() + self.noticias() + self.raperos(True)
                    + '<div class="fila2"><div>%s</div><div>%s%s</div></div>' % (self.ranking_top(), self.tu_temporada(), self.buscados())
                    + '<div class="fila3"><div>%s</div><div>%s%s</div></div>' % (self.tienda(), self.mercancia(), self.servidores())
                    + self.pie())
        return (self.cabecera(False, 'Inicio') + self.historias(False) + self.hero(False) + self.ir_a() + self.fechas()
                + self.semana() + self.noticias() + self.tu_temporada() + self.raperos(False) + self.ranking_top()
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
.fase{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;padding:8px 16px;background:var(--verde);color:#030304;
  font:700 11px/1.35 "Space Mono",monospace;letter-spacing:.04em}
.fase b{letter-spacing:.12em}
.pc .fase{padding:8px 40px}
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
