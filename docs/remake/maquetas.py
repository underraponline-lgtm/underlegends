# -*- coding: utf-8 -*-
"""Las 12 maquetas del remake: 4 estilos x 3 pantallas, con el MISMO contenido.

    python docs/remake/maquetas.py <carpeta_salida>

Escribe un HTML por pantalla y estilo (`<estilo>_<pantalla>.html`). Las capturas
las saca `maquetas_capturas.py`. El contenido es el de
`direcciones/pantallas.md`, con nombres inventados: nada de personas reales.

⚠️ NO ES CÓDIGO DE LA WEB: es sólo para comparar los cuatro estilos mirando. Lo
que se elija se reconstruye con React, shadcn y los tokens del DESIGN.md.

Stitch iba a hacer esto y no pudo: su clave quedó mal guardada (29/09/2026).
Hacerlo a mano tiene una ventaja: las fuentes son las de verdad (Bungee,
VT323, DM Serif Display…), que Stitch no tiene en su lista.
"""
import io
import os
import sys

# ── el contenido, idéntico para los cuatro ───────────────────────────────────
RANGO = {'SSS': '#C77DFF', 'SS': '#8FE8FF', 'S': '#FFD24A', 'A': '#FF6B7A',
         'B': '#5CE6A5', 'C': '#6B8FE8', 'D': '#D8DEE8', 'E': '#C98A4B'}   # comun/rangos.py

VIVO = {'evento': 'TOKYO VOL 16', 'sv': 'FFA', 'ronda': 'Cuartos de final',
        'cruces': [('Kairos', 'Nébula'), ('Tinta Fina', 'El Profe')]}
PROX = {'evento': 'FRZ FECHA 7', 'sv': 'FRZ', 'formato': '1 vs 1', 'hora': 'Hoy 21:00',
        'cuenta': '2 h 14 min', 'inscriptos': 24}
SEMANA = [('2', 'eventos'), ('+1.250', 'puntos'), ('3', 'semanas de racha')]
BUSCA = [('Nébula', '800'), ('Rima Suelta', '650'), ('Caos MC', '500')]
PASO = [('TOKYO VOL 15', 'Kairos'), ('DRA Nocturna', 'Mística')]
TABLA = [(1, '▲2', 'Kairos', 'Perú', 'A', '12.450'), (2, '▼1', 'Mística', 'Argentina', 'S', '11.980'),
         (3, '▲1', 'Nébula', 'Chile', 'B', '10.300'), (4, '=', 'Tinta Fina', 'Colombia', 'B', '9.870'),
         (5, '▲4', 'El Profe', 'México', 'C', '9.400'), (6, '▼2', 'Rima Suelta', 'Uruguay', 'C', '8.950'),
         (7, '▲1', 'Caos MC', 'Venezuela', 'A', '8.700'), (8, '▼3', 'Lupa', 'Ecuador', 'D', '8.120'),
         (9, '=', 'Brasa', 'Argentina', 'C', '7.900'), (10, '▲6', 'Ojo de Halcón', 'Chile', 'E', '7.640'),
         (11, '▼1', 'Verso Libre', 'Perú', 'D', '7.300'), (12, '=', 'Sombra', 'Colombia', 'C', '7.050')]
YO = {'pos': '#47', 'pts': '3.120', 'cambio': '▲5'}
PERFIL = {'nombre': 'Kairos', 'pais': 'Perú', 'sv': 'FFA', 'crew': 'Los del Barrio', 'seguidores': 128,
          'stats': [('12.450', 'Puntos'), ('14', 'Eventos'), ('5', 'Podios'), ('18-7', 'Duelos')],
          'rango': 'A', 'score': '56,4', 'progreso': (7, 10),
          'eventos': [('TOKYO VOL 16', 'Semifinal'), ('TOKYO VOL 15', 'Campeón'), ('FRZ FECHA 6', 'Cuartos'),
                      ('DRA Nocturna', 'Octavos'), ('FFA Semanal 12', 'Final')]}
CARTAS = [('Temporada', None), ('Competitiva', None), ('Servidor', None), ('País', '2/3 duelos nacionales')]
TABS = ['Temporada', 'Competitivo', 'Duelos', 'Podios', 'Rachas', 'Países', 'Crews']
NAV = [('Hoy', 'hoy'), ('Eventos', 'eventos'), ('Ranking', 'ranking'), ('Yo', 'yo')]


def mono(nombre):
    p = nombre.replace('MC', '').split()
    if nombre == 'Caos MC':
        return 'CM'
    return (p[0][0] + p[1][0]).upper() if len(p) > 1 else nombre[:2].upper()


# ── íconos de trazo, compartidos ─────────────────────────────────────────────
def ico(nombre, t=20):
    d = {
        'hoy': '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
        'eventos': '<rect x="3.5" y="5" width="17" height="15" rx="1"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
        'ranking': '<path d="M5 20V10M12 20V4M19 20v-7"/>',
        'yo': '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
        'campana': '<path d="M6 16V11a6 6 0 1112 0v5l2 2H4z"/><path d="M10 20a2 2 0 004 0"/>',
        'buscar': '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
        'candado': '<rect x="5" y="11" width="14" height="9" rx="1"/><path d="M8 11V8a4 4 0 118 0v3"/>',
        'compartir': '<path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6"/>',
        'trofeo': '<path d="M8 4h8v5a4 4 0 01-8 0zM8 6H4v2a4 4 0 004 4M16 6h4v2a4 4 0 01-4 4M12 13v4M8 20h8"/>',
    }[nombre]
    return ('<svg class="ico" width="%d" height="%d" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">%s</svg>' % (t, t, d))


def rango(letra, clase='rg'):
    return '<span class="%s" style="background:%s">%s</span>' % (clase, RANGO[letra], letra)


# ── la carta de ejemplo: la MISMA en los cuatro (es el afiche, no la pared) ──
CARTA_CSS = '''
.carta-demo{width:200px;height:292px;position:relative;border-radius:10px;overflow:hidden;
  background:linear-gradient(160deg,#2a1422 0%,#120c18 55%,#07070b 100%);
  box-shadow:inset 0 0 0 3px #FF6B7A,inset 0 0 0 5px #120c18,inset 0 0 0 6px rgba(255,107,122,.5);
  font-family:"Barlow Condensed",sans-serif;color:#fff;text-align:center}
.carta-demo .ovr{position:absolute;left:16px;top:12px;font:800 46px/1 "Barlow Condensed",sans-serif}
.carta-demo .rk{position:absolute;left:18px;top:62px;font:800 16px/1 "Archivo",sans-serif;background:#FF6B7A;
  color:#1C1917;padding:3px 7px;border-radius:3px}
.carta-demo .temp{position:absolute;right:14px;top:16px;font:700 11px/1.1 "Barlow Condensed",sans-serif;
  letter-spacing:.12em;text-align:right;opacity:.8}
.carta-demo .cara{position:absolute;left:50%;top:44px;transform:translateX(-50%);width:104px;height:104px;
  border-radius:50%;background:#2d1d2a;box-shadow:0 0 0 3px #FF6B7A;display:grid;place-items:center;
  font:800 40px/1 "Archivo",sans-serif;color:#FF6B7A}
.carta-demo .nom{position:absolute;left:0;right:0;top:162px;font:900 26px/1 "Archivo",sans-serif;
  letter-spacing:.02em;text-transform:uppercase}
.carta-demo .pais{position:absolute;left:0;right:0;top:194px;font:700 12px/1 "Barlow Condensed",sans-serif;
  letter-spacing:.2em;color:#ffb3bb}
.carta-demo .cst{position:absolute;left:14px;right:14px;top:218px;display:grid;grid-template-columns:repeat(3,1fr);
  border-top:1px solid rgba(255,107,122,.45);padding-top:8px}
.carta-demo .cst b{display:block;font:800 22px/1 "Barlow Condensed",sans-serif}
.carta-demo .cst i{font:700 10px/1.4 "Barlow Condensed",sans-serif;font-style:normal;letter-spacing:.14em;opacity:.75}
.carta-demo .pie{position:absolute;left:0;right:0;bottom:10px;font:700 10px/1 "Barlow Condensed",sans-serif;
  letter-spacing:.3em;opacity:.55}
'''


def carta():
    return ('<div class="carta-demo" role="img" aria-label="Carta de temporada de ejemplo">'
            '<div class="ovr">87</div><div class="rk">A</div><div class="temp">TEMPORADA<br>1</div>'
            '<div class="cara">KA</div><div class="nom">Kairos</div><div class="pais">PERÚ · FFA</div>'
            '<div class="cst"><div><b>12.450</b><i>PTS</i></div><div><b>14</b><i>EV</i></div>'
            '<div><b>5</b><i>POD</i></div></div><div class="pie">LIGA GLOBAL</div></div>')


# ── los cuatro estilos: fuentes, CSS y las piezas que cambian de forma ───────
FUENTES = {
    'barda': 'family=Bungee&family=Atkinson+Hyperlegible+Next:wght@400;700;800',
    'fanzine': 'family=Anybody:wdth,wght@50..150,400..900&family=IBM+Plex+Mono:wght@400;600;700',
    'tvpirata': 'family=VT323&family=Silkscreen:wght@400;700&family=Space+Grotesk:wght@400;500;700',
    'diario': 'family=DM+Serif+Display:ital@0;1&family=Inter+Tight:wght@400;500;600;700;800',
}
CARTA_FUENTES = 'family=Archivo:wght@800;900&family=Barlow+Condensed:wght@700;800'

CSS = {}

CSS['barda'] = '''
.sub{display:block;font:700 13px/1.3 "Atkinson Hyperlegible Next",sans-serif;color:var(--tinta2)}
:root{--cal:#F3EEE3;--sup:#E8E0D0;--papel:#fff;--tinta:#1C1917;--tinta2:#4A443D;--anil:#1F3FBF;
  --berm:#C2330F;--cromo:#FFC21A;--verde:#1E8A50;--uva:#6B3FC4}
.app{background:var(--cal);color:var(--tinta);font:16px/1.4 "Atkinson Hyperlegible Next",sans-serif}
.top{display:flex;align-items:center;justify-content:space-between;padding:16px}
.marca{font:22px/1 Bungee,sans-serif;background:var(--anil);color:var(--cal);padding:9px 12px 7px;
  border:2px solid var(--tinta);box-shadow:4px 4px 0 var(--tinta);letter-spacing:.02em}
.btn-ico{width:44px;height:44px;display:grid;place-items:center;background:var(--papel);border:2px solid var(--tinta);
  box-shadow:3px 3px 0 var(--tinta);border-radius:2px}
.bloque{margin:0 16px 18px;background:var(--papel);border:2px solid var(--tinta);box-shadow:4px 4px 0 var(--tinta);
  border-radius:2px;padding:14px}
.st{font:14px/1 Bungee,sans-serif;letter-spacing:.03em;margin:0 0 10px}
.vivo{background:var(--anil);color:var(--cal)}
.tag{display:inline-block;font:12px/1 Bungee,sans-serif;background:var(--berm);color:var(--cal);padding:6px 8px 5px;
  border:2px solid var(--tinta)}
.vivo h2{font:26px/1.05 Bungee,sans-serif;margin:12px 0 4px;text-shadow:3px 3px 0 var(--tinta)}
.meta{font-weight:700;opacity:.92;margin:0 0 10px}
.cruces{list-style:none;margin:0 0 14px;padding:0;display:grid;gap:6px}
.cruces li{display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,.18);
  border:2px solid var(--tinta);padding:8px 10px;font-weight:800}
.cruces em{font:12px/1 Bungee,sans-serif;font-style:normal;color:var(--cromo)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 16px;
  font:15px/1 Bungee,sans-serif;border:2px solid var(--tinta);box-shadow:4px 4px 0 var(--tinta);border-radius:2px;
  background:var(--cromo);color:var(--tinta)}
.btn.accion{background:var(--berm);color:var(--cal)}
.btn.prim{background:var(--anil);color:var(--cal)}
.btn.claro{background:var(--papel);color:var(--tinta)}
.ev-t{font:22px/1.1 Bungee,sans-serif;margin:0 0 8px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}
.chip{border:2px solid var(--tinta);padding:4px 8px;font-weight:800;font-size:14px;background:var(--sup)}
.chip.sv{background:var(--tinta);color:var(--cal)}
.hora{font-weight:800;font-size:17px;margin:0 0 8px}
.hora small{font-weight:400;color:var(--tinta2)}
.cuenta{display:flex;align-items:baseline;gap:10px;background:var(--cromo);border:2px solid var(--tinta);
  padding:10px 12px;margin:0 0 12px}
.cuenta b{font:26px/1 Bungee,sans-serif}
.cuenta small{font-weight:700}
.casillas{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.casillas div{border:2px solid var(--tinta);padding:10px 8px;color:var(--cal)}
.casillas div:nth-child(1){background:var(--anil)}.casillas div:nth-child(2){background:var(--berm)}
.casillas div:nth-child(3){background:var(--verde)}
.casillas b{display:block;font:22px/1 Bungee,sans-serif;margin-bottom:6px}
.casillas small{font-weight:700;font-size:13px;line-height:1.15;display:block}
.lista{list-style:none;margin:0;padding:0}
.lista li{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:2px solid var(--sup)}
.lista li:first-child{border-top:0}
.mono{width:38px;height:30px;border-radius:50%;border:2px solid var(--tinta);display:grid;place-items:center;
  font:12px/1 Bungee,sans-serif;background:var(--sup);flex:none}
.nom{font-weight:800;flex:1}
.precio{font:15px/1 Bungee,sans-serif;background:var(--cromo);border:2px solid var(--tinta);padding:6px 8px 5px}
.lnk{color:var(--anil);font-weight:800;text-decoration:underline;text-underline-offset:3px;font-size:14px}
.nav{display:grid;grid-template-columns:repeat(4,1fr);border-top:2px solid var(--tinta);background:var(--cal);padding:8px 8px 10px;gap:6px}
.nav a{display:grid;justify-items:center;gap:3px;padding:6px 0;font:11px/1 Bungee,sans-serif;border:2px solid transparent}
.nav a.on{background:var(--anil);color:var(--cal);border-color:var(--tinta);box-shadow:3px 3px 0 var(--tinta)}
/* ranking */
.cab{padding:16px 16px 8px}
.cab h1{font:30px/1 Bungee,sans-serif;margin:0;text-shadow:3px 3px 0 var(--cromo)}
.cab p{margin:6px 0 0;font-weight:800;color:var(--tinta2)}
.tabs{display:flex;gap:6px;overflow:hidden;padding:8px 16px 12px}
.tabs span{flex:none;border:2px solid var(--tinta);padding:6px 9px 5px;font:12px/1 Bungee,sans-serif;background:var(--papel)}
.tabs span.on{background:var(--anil);color:var(--cal);box-shadow:3px 3px 0 var(--tinta)}
.buscar{margin:0 16px 10px;display:flex;align-items:center;gap:8px;background:var(--papel);border:2px solid var(--tinta);
  padding:0 12px;min-height:44px;color:var(--tinta2);font-weight:700}
.filtros{display:flex;gap:6px;padding:0 16px 12px}
.filtros span{border:2px solid var(--tinta);padding:5px 10px;font-weight:800;font-size:14px}
.filtros span.on{background:var(--tinta);color:var(--cal)}
.tabla{margin:0 16px 14px;background:var(--papel);border:2px solid var(--tinta);box-shadow:4px 4px 0 var(--tinta)}
.fila{display:grid;grid-template-columns:38px 28px 1fr 30px 62px;align-items:center;gap:6px;padding:7px 8px;border-top:2px solid var(--sup)}
.fila:first-child{border-top:0}
.pos{width:34px;height:32px;display:grid;place-items:center;font:15px/1 Bungee,sans-serif;border:2px solid var(--tinta);background:var(--papel)}
.fila.p1 .pos{background:var(--cromo)}.fila.p2 .pos{background:var(--berm);color:var(--cal)}.fila.p3 .pos{background:var(--anil);color:var(--cal)}
.cam{font-weight:800;font-size:13px;text-align:center}
.sube{color:var(--verde)}.baja{color:var(--berm)}.igual{color:var(--tinta2)}
.rap b{display:block;font-weight:800;line-height:1.1}
.rap small{color:var(--tinta2);font-size:13px}
.rg{display:grid;place-items:center;height:24px;font:12px/1 Bungee,sans-serif;color:#1C1917;border:2px solid var(--tinta)}
.pts{text-align:right;font-weight:800;font-variant-numeric:tabular-nums}
.yo{margin:0 16px 12px;display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--tinta);
  color:var(--cal);border:2px solid var(--tinta);padding:10px 10px 10px 12px}
.yo b{font:15px/1.1 Bungee,sans-serif}
.yo small{display:block;font-weight:700;opacity:.85;margin-top:3px}
.yo .btn{min-height:40px;padding:0 10px;font-size:12px;box-shadow:3px 3px 0 var(--cromo);border-color:var(--cal)}
/* perfil */
.perfil-cab{padding:16px 16px 6px}
.perfil-cab h1{font:40px/1 Bungee,sans-serif;margin:0;text-shadow:3px 3px 0 var(--cromo)}
.perfil-cab .chips{margin:12px 0}
.acciones{display:flex;gap:10px}
.pared{display:grid;place-items:center;padding:22px 0 16px}
.afiche{position:relative;transform:rotate(-2deg);box-shadow:6px 6px 0 var(--tinta)}
.afiche:before,.afiche:after{content:"";position:absolute;top:-10px;width:56px;height:20px;background:rgba(232,224,208,.92);
  border:1px solid rgba(28,25,23,.25);z-index:2}
.afiche:before{left:-14px;transform:rotate(-24deg)}.afiche:after{right:-14px;transform:rotate(22deg)}
.selector{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:0 16px 16px}
.selector span{border:2px solid var(--tinta);padding:7px 4px;text-align:center;font:10px/1.15 Bungee,sans-serif;background:var(--papel)}
.selector span.on{background:var(--anil);color:var(--cal);box-shadow:3px 3px 0 var(--tinta)}
.selector span.bloq{background:var(--sup);color:var(--tinta2)}
.selector small{display:block;font:700 10px/1.2 "Atkinson Hyperlegible Next",sans-serif;margin-top:3px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.stats div{border:2px solid var(--tinta);padding:8px 4px;text-align:center;background:var(--sup)}
.stats b{display:block;font:17px/1 Bungee,sans-serif}
.stats small{font-weight:700;font-size:12px}
.rango-fila{display:flex;align-items:center;gap:12px;margin-top:12px}
.rango-fila .rg{width:44px;height:40px;font-size:20px}
.rango-fila b{font:18px/1 Bungee,sans-serif}
.progreso{display:grid;grid-template-columns:repeat(10,1fr);gap:4px;margin:8px 0 4px}
.progreso i{height:18px;border:2px solid var(--tinta);background:var(--papel)}
.progreso i.si{background:var(--anil)}
.pie-btn{padding:4px 16px 18px}
.pie-btn .btn{width:100%}
'''

CSS['fanzine'] = '''
.sub{display:block;font:400 12px/1.4 "IBM Plex Mono",monospace}
:root{--papel:#F2F2EF;--hoja:#FBFBF8;--tinta:#141414;--rosa:#FF48B0;--azul:#3255A4;--gris:#D6D6D1;--naranja:#FF6C2F}
.app{background:var(--papel);color:var(--tinta);font:15px/1.45 "IBM Plex Mono",monospace;position:relative;overflow:hidden}
.app:before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.10;mix-blend-mode:multiply;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23g)'/%3E%3C/svg%3E")}
.titular{font-family:Anybody,sans-serif;font-stretch:140%;font-weight:900;text-transform:uppercase;letter-spacing:-.01em}
.top{display:flex;align-items:center;justify-content:space-between;padding:18px 16px 10px}
.marca{font:900 23px/.95 Anybody,sans-serif;font-stretch:150%;color:var(--azul);text-shadow:3px 2px 0 rgba(255,72,176,.9);text-transform:uppercase}
.btn-ico{width:44px;height:44px;display:grid;place-items:center;border:1.5px solid var(--tinta);background:var(--hoja);transform:rotate(3deg)}
.bloque{position:relative;margin:0 16px 20px;background:var(--hoja);border:1.5px solid var(--tinta);padding:16px 14px 14px}
.bloque:nth-of-type(odd){transform:rotate(-.7deg)}.bloque:nth-of-type(even){transform:rotate(.6deg)}
.bloque:before{content:"";position:absolute;top:-9px;left:50%;width:70px;height:18px;margin-left:-35px;
  background:rgba(214,200,150,.55);transform:rotate(-3deg)}
.st{font:900 16px/1 Anybody,sans-serif;font-stretch:130%;text-transform:uppercase;margin:0 0 10px;color:var(--azul)}
.tag{display:inline-block;font:900 15px/1 Anybody,sans-serif;font-stretch:120%;color:var(--rosa);border:3px double var(--rosa);
  padding:6px 8px;transform:rotate(-5deg);text-transform:uppercase;letter-spacing:.06em}
.vivo h2{font:900 30px/1 Anybody,sans-serif;font-stretch:145%;margin:12px 0 4px;text-transform:uppercase;color:var(--tinta);
  text-shadow:2px 2px 0 rgba(255,72,176,.75)}
.meta{margin:0 0 10px;font-weight:600}
.cruces{list-style:none;margin:0 0 14px;padding:0}
.cruces li{display:flex;justify-content:space-between;padding:8px 2px;border-bottom:1.5px dashed var(--tinta);font-weight:700}
.cruces em{font-style:normal;color:var(--rosa);font-weight:700}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 16px;
  font:900 15px/1 Anybody,sans-serif;font-stretch:125%;text-transform:uppercase;border:1.5px solid var(--tinta);background:var(--azul);color:var(--papel)}
.btn.accion{background:var(--rosa);color:var(--tinta)}
.btn.prim{background:var(--azul);color:var(--papel)}
.btn.claro{background:var(--hoja);color:var(--tinta)}
.ev-t{font:900 24px/1 Anybody,sans-serif;font-stretch:140%;text-transform:uppercase;margin:0 0 10px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}
.chip{border:1.5px solid var(--tinta);padding:3px 8px;font-weight:600;font-size:13px}
.chip.sv{background:var(--tinta);color:var(--papel)}
.hora{font-weight:700;margin:0 0 8px}
.hora small{font-weight:400}
.cuenta{display:flex;align-items:baseline;gap:10px;margin:0 0 12px;padding:8px 10px;border:1.5px solid var(--tinta);
  background:repeating-linear-gradient(135deg,rgba(50,85,164,.12) 0 2px,transparent 2px 6px)}
.cuenta b{font:900 26px/1 Anybody,sans-serif;font-stretch:115%;color:var(--azul);white-space:nowrap}
.cuenta small{font-weight:600}
.casillas{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border:1.5px solid var(--tinta)}
.casillas div{padding:10px 8px;border-left:1.5px solid var(--tinta)}
.casillas div:first-child{border-left:0}
.casillas b{display:block;font:900 24px/1 Anybody,sans-serif;font-stretch:120%;color:var(--rosa);margin-bottom:6px}
.casillas small{font-size:12px;line-height:1.2;display:block}
.lista{list-style:none;margin:0;padding:0}
.lista li{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1.5px dashed var(--tinta)}
.lista li:first-child{border-top:0}
.mono{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:13px;flex:none;
  border:1.5px solid var(--tinta);background:radial-gradient(circle,rgba(50,85,164,.55) 1.1px,transparent 1.3px) 0 0/5px 5px,var(--hoja)}
.nom{font-weight:700;flex:1}
.precio{font:900 18px/1 Anybody,sans-serif;font-stretch:120%;color:var(--tinta);background:var(--rosa);padding:5px 8px;transform:rotate(-3deg)}
.lnk{color:var(--azul);font-weight:700;text-decoration:underline wavy;text-underline-offset:4px;font-size:13px}
.nav{display:grid;grid-template-columns:repeat(4,1fr);border-top:1.5px solid var(--tinta);background:var(--papel);padding:8px 6px 10px}
.nav a{display:grid;justify-items:center;gap:3px;padding:6px 0;font-weight:700;font-size:12px}
.nav a.on{background:linear-gradient(transparent 55%,rgba(255,72,176,.55) 55%);color:var(--tinta)}
.cab{padding:18px 16px 8px}
.cab h1{font:900 36px/.95 Anybody,sans-serif;font-stretch:150%;margin:0;text-transform:uppercase;color:var(--azul);text-shadow:3px 2px 0 rgba(255,72,176,.85)}
.cab p{margin:8px 0 0;font-weight:600}
.tabs{display:flex;gap:4px;overflow:hidden;padding:8px 16px 12px}
.tabs span{flex:none;border:1.5px solid var(--tinta);padding:4px 8px;font-weight:600;font-size:13px}
.tabs span.on{background:var(--tinta);color:var(--papel)}
.buscar{margin:0 16px 10px;display:flex;align-items:center;gap:8px;border:1.5px solid var(--tinta);background:var(--hoja);padding:0 12px;min-height:44px}
.filtros{display:flex;gap:6px;padding:0 16px 12px}
.filtros span{border:1.5px solid var(--tinta);padding:4px 10px;font-weight:600;font-size:13px}
.filtros span.on{background:var(--rosa)}
.tabla{margin:0 16px 14px;background:var(--hoja);border:1.5px solid var(--tinta)}
.fila{display:grid;grid-template-columns:34px 30px 1fr 32px 64px;align-items:center;gap:6px;padding:7px 8px;border-top:1px solid var(--tinta)}
.fila:first-child{border-top:0}
.pos{font:900 20px/1 Anybody,sans-serif;font-stretch:110%;text-align:center}
.fila.p1 .pos,.fila.p2 .pos,.fila.p3 .pos{color:var(--rosa);font-size:24px}
.cam{font-weight:700;font-size:12px;text-align:center}
.sube{color:var(--azul)}.baja{color:var(--rosa)}.igual{color:#666}
.rap b{display:block;font-weight:700;line-height:1.15}
.rap small{font-size:12px;opacity:.75}
.rg{display:grid;place-items:center;height:26px;font:700 13px/1 "IBM Plex Mono",monospace;color:#141414;border:1.5px solid var(--tinta)}
.pts{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
.yo{margin:0 16px 12px;display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--tinta);color:var(--papel);padding:10px 10px 10px 12px;transform:rotate(-.5deg)}
.yo b{font:900 15px/1.1 Anybody,sans-serif;font-stretch:108%;text-transform:uppercase;white-space:nowrap}
.yo small{display:block;margin-top:3px;font-size:12px}
.yo .btn{min-height:40px;padding:0 10px;font-size:13px;background:var(--rosa);color:var(--tinta);border-color:var(--papel)}
.perfil-cab{padding:18px 16px 6px}
.perfil-cab h1{font:900 46px/.9 Anybody,sans-serif;font-stretch:150%;margin:0;text-transform:uppercase;color:var(--tinta);text-shadow:3px 3px 0 rgba(255,72,176,.8)}
.perfil-cab .chips{margin:12px 0}
.acciones{display:flex;gap:10px}
.pared{display:grid;place-items:center;padding:26px 0 18px}
.afiche{position:relative;transform:rotate(2.5deg);outline:1.5px solid var(--tinta);outline-offset:6px}
.afiche:before{content:"";position:absolute;top:-16px;left:50%;margin-left:-40px;width:80px;height:22px;background:rgba(214,200,150,.6);transform:rotate(-4deg);z-index:2}
.sello{position:absolute;right:-26px;bottom:18px;z-index:3;font:900 14px/1 Anybody,sans-serif;font-stretch:120%;color:var(--rosa);border:3px double var(--rosa);padding:5px 7px;transform:rotate(-14deg);background:rgba(242,242,239,.85)}
.selector{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin:0 16px 16px;border:1.5px solid var(--tinta)}
.selector span{padding:7px 4px;text-align:center;font-weight:700;font-size:11px;border-left:1.5px solid var(--tinta)}
.selector span:first-child{border-left:0}
.selector span.on{background:var(--azul);color:var(--papel)}
.selector span.bloq{color:#777}
.selector small{display:block;font-weight:400;font-size:10px;margin-top:2px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);border:1.5px solid var(--tinta)}
.stats div{padding:8px 4px;text-align:center;border-left:1.5px solid var(--tinta)}
.stats div:first-child{border-left:0}
.stats b{display:block;font:900 18px/1 Anybody,sans-serif;font-stretch:110%;color:var(--azul)}
.stats small{font-size:11px}
.rango-fila{display:flex;align-items:center;gap:12px;margin-top:12px}
.rango-fila .rg{width:44px;height:40px;font-size:20px}
.rango-fila b{font-weight:700}
.progreso{display:grid;grid-template-columns:repeat(10,1fr);gap:4px;margin:8px 0 4px}
.progreso i{height:18px;border:1.5px solid var(--tinta)}
.progreso i.si{background:var(--rosa)}
.pie-btn{padding:4px 16px 18px}
.pie-btn .btn{width:100%}
'''

CSS['tvpirata'] = '''
.sub{display:block;font:500 13px/1.3 "Space Grotesk",sans-serif;color:var(--cian)}
.chip+.chip:before{content:"· ";color:var(--blanco)}
:root{--azul:#1020C8;--negro:#000;--blanco:#fff;--amar:#FFE600;--cian:#00E5FF;--rojo:#FF2B2B}
.app{background:var(--azul);color:var(--blanco);font:15px/1.4 "Space Grotesk",sans-serif;position:relative}
.app:after{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.14) 0 1px,transparent 1px 3px)}
.tele{display:flex;justify-content:space-between;background:var(--negro);color:var(--blanco);font:20px/1 VT323,monospace;padding:6px 12px}
.tele b{color:var(--amar);font-weight:400}
.top{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px}
.marca{font:44px/.85 VT323,monospace;color:var(--amar);letter-spacing:.02em}
.marca small{display:block;font:14px/1 Silkscreen,monospace;color:var(--cian);margin-top:6px}
.btn-ico{width:44px;height:44px;display:grid;place-items:center;border:2px solid var(--blanco)}
.bloque{margin:0 0 16px;padding:12px 16px 14px;border-top:2px solid var(--cian)}
.st{font:26px/1 VT323,monospace;color:var(--cian);margin:0 0 8px;text-transform:uppercase}
.st i{font-style:normal;color:var(--blanco);opacity:.7;margin-right:8px}
.vivo{background:var(--negro);border-top:0;padding-top:14px}
.tag{display:inline-flex;align-items:center;gap:8px;font:22px/1 VT323,monospace;background:var(--blanco);color:var(--negro);padding:3px 8px}
.tag:after{content:"● REC";color:var(--rojo)}
.vivo h2{font:40px/.95 VT323,monospace;color:var(--amar);margin:12px 0 2px}
.meta{margin:0 0 10px;color:var(--cian);font-weight:500}
.cruces{list-style:none;margin:0 0 14px;padding:0}
.cruces li{display:flex;justify-content:space-between;font:26px/1.25 VT323,monospace;border-bottom:1px solid rgba(255,255,255,.25);padding:4px 0}
.cruces em{font-style:normal;color:var(--amar)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 16px;font:24px/1 VT323,monospace;background:var(--amar);color:var(--negro);text-transform:uppercase}
.btn.accion{background:var(--amar);color:var(--negro)}
.btn.prim{background:var(--cian);color:var(--negro)}
.btn.claro{background:transparent;color:var(--blanco);border:2px solid var(--blanco)}
.ev-t{font:36px/1 VT323,monospace;color:var(--amar);margin:0 0 6px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 8px}
.chip{font:20px/1 VT323,monospace;color:var(--cian)}
.chip.sv{background:var(--cian);color:var(--negro);padding:1px 6px}
.hora{font:22px/1.1 VT323,monospace;margin:0 0 8px}
.hora small{color:var(--cian)}
.cuenta{display:flex;align-items:baseline;gap:10px;margin:0 0 12px;background:var(--negro);padding:8px 10px}
.cuenta b{font:40px/1 VT323,monospace;color:var(--amar);white-space:nowrap}
.cuenta small{font:18px/1 VT323,monospace;color:var(--cian)}
.casillas{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.casillas div{background:var(--negro);padding:8px}
.casillas b{display:block;font:36px/1 VT323,monospace;color:var(--amar)}
.casillas small{font:17px/1.05 VT323,monospace;color:var(--cian);display:block}
.lista{list-style:none;margin:0;padding:0}
.lista li{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px dashed rgba(255,255,255,.35)}
.mono{width:34px;height:34px;display:grid;place-items:center;font:20px/1 VT323,monospace;background:var(--cian);color:var(--negro);flex:none}
.nom{font:24px/1 VT323,monospace;flex:1}
.precio{font:26px/1 VT323,monospace;color:var(--negro);background:var(--amar);padding:1px 8px}
.lnk{font:20px/1 VT323,monospace;color:var(--amar);text-decoration:underline}
.nav{display:grid;grid-template-columns:repeat(4,1fr);background:var(--negro);padding:6px 6px 8px;gap:4px}
.nav a{display:grid;justify-items:center;gap:2px;padding:5px 0;font:20px/1 VT323,monospace;color:var(--blanco)}
.nav a.on{background:var(--amar);color:var(--negro)}
.cab{padding:12px 16px 6px}
.cab h1{font:48px/.9 VT323,monospace;margin:0;color:var(--amar)}
.cab p{margin:4px 0 0;font:20px/1 VT323,monospace;color:var(--cian)}
.tabs{display:flex;gap:4px;overflow:hidden;padding:8px 16px 10px}
.tabs span{flex:none;font:20px/1 VT323,monospace;padding:3px 7px;color:var(--cian);border:1px solid var(--cian)}
.tabs span.on{background:var(--cian);color:var(--negro)}
.buscar{margin:0 16px 10px;display:flex;align-items:center;gap:8px;border:2px solid var(--blanco);padding:0 12px;min-height:44px;font:22px/1 VT323,monospace}
.filtros{display:flex;gap:6px;padding:0 16px 10px}
.filtros span{font:20px/1 VT323,monospace;padding:3px 8px;border:1px solid var(--blanco)}
.filtros span.on{background:var(--blanco);color:var(--negro)}
.tabla{margin:0 0 12px;background:var(--negro);padding:6px 0}
.tabla-cab{display:flex;justify-content:space-between;font:20px/1 VT323,monospace;color:var(--negro);background:var(--cian);padding:3px 12px;margin:0 0 4px}
.fila{display:grid;grid-template-columns:30px 30px 1fr 30px 70px;align-items:center;gap:6px;padding:3px 12px}
.pos{font:26px/1 VT323,monospace;color:var(--amar);text-align:right}
.cam{font:20px/1 VT323,monospace;text-align:center}
.sube{color:var(--cian)}.baja{color:#ff8a8a}.igual{color:#aaa}
.rap b{display:block;font:24px/1 VT323,monospace;font-weight:400}
.rap small{font:17px/1 VT323,monospace;color:var(--cian)}
.fila.p1 .rap b,.fila.p2 .rap b,.fila.p3 .rap b{color:var(--amar)}
.rg{display:grid;place-items:center;height:22px;font:18px/1 VT323,monospace;color:#000}
.pts{text-align:right;font:24px/1 VT323,monospace}
.yo{margin:0 0 10px;display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--amar);color:var(--negro);padding:6px 10px 6px 16px}
.yo b{font:26px/1 VT323,monospace;font-weight:400}
.yo small{display:block;font:18px/1 VT323,monospace}
.yo .btn{min-height:40px;padding:0 10px;font-size:22px;background:var(--negro);color:var(--amar)}
.perfil-cab{padding:12px 16px 6px}
.perfil-cab h1{font:64px/.85 VT323,monospace;margin:0;color:var(--amar)}
.perfil-cab .chips{margin:10px 0}
.acciones{display:flex;gap:10px}
.pared{display:grid;place-items:center;padding:18px 0 14px;background:var(--negro);margin:10px 0 14px;position:relative}
.pared:before{content:"CH 03 · REPETICIÓN";position:absolute;left:12px;top:8px;font:18px/1 VT323,monospace;color:var(--cian)}
.pared:after{content:"00:03:17";position:absolute;right:12px;top:8px;font:18px/1 VT323,monospace;color:var(--blanco)}
.afiche{margin-top:18px;outline:2px solid var(--blanco);outline-offset:6px}
.selector{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:0 16px 14px}
.selector span{padding:5px 2px;text-align:center;font:18px/1 VT323,monospace;border:1px solid var(--blanco)}
.selector span.on{background:var(--amar);color:var(--negro);border-color:var(--amar)}
.selector span.bloq{color:#9aa4ff;border-style:dashed}
.selector small{display:block;font:15px/1 VT323,monospace}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}
.stats div{background:var(--negro);padding:6px 4px;text-align:center}
.stats b{display:block;font:28px/1 VT323,monospace;color:var(--amar);font-weight:400}
.stats small{font:16px/1 VT323,monospace;color:var(--cian)}
.rango-fila{display:flex;align-items:center;gap:12px;margin-top:12px}
.rango-fila .rg{width:44px;height:40px;font-size:30px}
.rango-fila b{font:26px/1 VT323,monospace;font-weight:400}
.progreso{display:grid;grid-template-columns:repeat(10,1fr);gap:3px;margin:8px 0 4px}
.progreso i{height:16px;background:rgba(255,255,255,.18)}
.progreso i.si{background:var(--amar)}
.pie-btn{padding:4px 16px 18px}
.pie-btn .btn{width:100%}
'''

CSS['diario'] = '''
.sub{display:block;font:600 13px/1.3 "Inter Tight",sans-serif;color:var(--gris)}
:root{--papel:#EDEAE2;--blanco:#fff;--tinta:#111;--rojo:#D7141A;--amar:#FFE14D;--gris:#6B6860}
.app{background:var(--papel);color:var(--tinta);font:15px/1.45 "Inter Tight",sans-serif}
.cabecera{padding:14px 16px 0;text-align:center}
.cabecera .fecha{display:flex;justify-content:space-between;font:600 11px/1 "Inter Tight",sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--gris);border-bottom:1px solid var(--tinta);padding-bottom:6px}
.marca{font:48px/1 "DM Serif Display",serif;margin:8px 0 6px;letter-spacing:-.01em}
.cabecera .raya{border-top:3px double var(--tinta);border-bottom:1px solid var(--tinta);height:3px;margin-bottom:12px}
.top{display:none}
.btn-ico{display:none}
.bloque{margin:0 16px 16px;padding:0 0 14px;border-bottom:1px solid var(--tinta)}
.st{font:800 12px/1 "Inter Tight",sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--rojo);margin:0 0 8px;border-top:3px solid var(--rojo);padding-top:8px}
.tag{display:inline-block;font:800 12px/1 "Inter Tight",sans-serif;letter-spacing:.12em;text-transform:uppercase;background:var(--rojo);color:var(--blanco);padding:6px 8px}
.vivo h2{font:32px/1.02 "DM Serif Display",serif;margin:10px 0 4px}
.meta{margin:0 0 8px;color:var(--gris);font-weight:600}
.cruces{list-style:none;margin:0 0 12px;padding:0}
.cruces li{display:flex;justify-content:space-between;font:22px/1.3 "DM Serif Display",serif;border-top:1px solid #bcb7ab;padding:4px 0}
.cruces em{font:italic 16px/1 "DM Serif Display",serif;color:var(--rojo)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 16px;font:700 15px/1 "Inter Tight",sans-serif;background:var(--rojo);color:var(--blanco)}
.btn.accion{background:var(--rojo);color:var(--blanco)}
.btn.prim{background:var(--tinta);color:var(--blanco)}
.btn.claro{background:transparent;color:var(--tinta);border:1px solid var(--tinta)}
.ev-t{font:28px/1.05 "DM Serif Display",serif;margin:0 0 8px}
.chips{display:flex;flex-wrap:wrap;gap:0;margin:0 0 8px;font-weight:600;color:var(--gris)}
.chip{padding:0 8px;border-left:1px solid #bcb7ab}
.chip:first-child{padding-left:0;border-left:0}
.chip.sv{color:var(--rojo);font-weight:800}
.hora{font-weight:700;margin:0 0 6px}
.hora small{font-weight:400;color:var(--gris)}
.cuenta{display:flex;align-items:baseline;gap:10px;margin:0 0 12px}
.cuenta b{font:40px/1 "DM Serif Display",serif}
.cuenta small{font-weight:600;color:var(--gris)}
.casillas{display:grid;grid-template-columns:repeat(3,1fr)}
.casillas div{padding:0 8px;border-left:1px solid var(--tinta)}
.casillas div:first-child{padding-left:0;border-left:0}
.casillas b{display:block;font:36px/1 "DM Serif Display",serif}
.casillas small{font-weight:600;font-size:13px;line-height:1.2;display:block;color:var(--gris)}
.lista{list-style:none;margin:0;padding:0}
.lista li{display:flex;align-items:center;gap:12px;padding:8px 0;border-top:1px solid #bcb7ab}
.lista li:first-child{border-top:0}
.mono{width:40px;height:48px;display:grid;place-items:center;font:20px/1 "DM Serif Display",serif;background:#d9d4c7;border:4px solid var(--blanco);outline:1px solid var(--tinta);flex:none}
.nom{font:21px/1.1 "DM Serif Display",serif;flex:1}
.precio{font:800 16px/1 "Inter Tight",sans-serif;background:var(--amar);padding:3px 6px}
.lnk{color:var(--rojo);font-weight:700;font-size:14px}
.nav{display:grid;grid-template-columns:repeat(4,1fr);border-top:3px double var(--tinta);background:var(--papel);padding:8px 6px 10px}
.nav a{display:grid;justify-items:center;gap:3px;padding:6px 0;font-weight:700;font-size:12px;color:var(--gris)}
.nav a.on{color:var(--rojo);box-shadow:inset 0 -3px 0 var(--rojo)}
.cab{padding:14px 16px 8px}
.cab h1{font:40px/1 "DM Serif Display",serif;margin:0}
.cab p{margin:4px 0 0;font:800 12px/1 "Inter Tight",sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--rojo)}
.tabs{display:flex;gap:14px;overflow:hidden;padding:6px 16px 10px;border-bottom:1px solid var(--tinta);margin:0 16px 10px;padding-left:0;padding-right:0}
.tabs span{flex:none;font-weight:700;font-size:14px;color:var(--gris);padding-bottom:4px}
.tabs span.on{color:var(--tinta);box-shadow:inset 0 -3px 0 var(--rojo)}
.buscar{margin:0 16px 10px;display:flex;align-items:center;gap:8px;background:var(--blanco);border:1px solid var(--tinta);padding:0 12px;min-height:44px;color:var(--gris)}
.filtros{display:flex;gap:6px;padding:0 16px 12px}
.filtros span{border:1px solid var(--tinta);padding:4px 10px;font-weight:600;font-size:13px}
.filtros span.on{background:var(--tinta);color:var(--blanco)}
.tabla{margin:0 16px 14px;background:var(--blanco);border-top:3px solid var(--tinta);border-bottom:1px solid var(--tinta)}
.tabla-cab{display:grid;grid-template-columns:34px 30px 1fr 32px 64px;gap:6px;padding:6px 8px;font:800 11px/1 "Inter Tight",sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--gris);border-bottom:1px solid var(--tinta)}
.fila{display:grid;grid-template-columns:34px 30px 1fr 32px 64px;align-items:center;gap:6px;padding:7px 8px;border-top:1px solid #d6d1c5}
.fila:first-child{border-top:0}
.pos{font:24px/1 "DM Serif Display",serif;text-align:center}
.fila.p1 .pos,.fila.p2 .pos,.fila.p3 .pos{color:var(--rojo)}
.cam{font-weight:700;font-size:12px;text-align:center}
.sube{color:#1d7a3f}.baja{color:var(--rojo)}.igual{color:var(--gris)}
.rap b{display:block;font:18px/1.1 "DM Serif Display",serif;font-weight:400}
.rap small{font-size:12px;color:var(--gris)}
.rg{display:grid;place-items:center;height:24px;font:800 12px/1 "Inter Tight",sans-serif;color:#111;border:1px solid var(--tinta)}
.pts{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
.yo{margin:0 16px 12px;display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--tinta);color:var(--blanco);padding:10px 10px 10px 12px}
.yo b{font:22px/1.05 "DM Serif Display",serif;font-weight:400}
.yo small{display:block;font-size:12px;opacity:.85;margin-top:3px}
.yo .btn{min-height:40px;padding:0 12px;font-size:13px}
.perfil-cab{padding:14px 16px 6px}
.perfil-cab .kicker{font:800 12px/1 "Inter Tight",sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--rojo);border-top:3px solid var(--rojo);padding-top:8px}
.perfil-cab h1{font:56px/.95 "DM Serif Display",serif;margin:6px 0 0}
.perfil-cab .chips{margin:10px 0}
.acciones{display:flex;gap:10px}
.pared{display:grid;place-items:center;padding:20px 0 14px}
.afiche{background:var(--blanco);padding:10px 10px 30px;outline:1px solid var(--tinta);transform:rotate(-1.5deg);position:relative}
.afiche:after{content:"Figurita N.º 47";position:absolute;left:0;right:0;bottom:8px;text-align:center;font:italic 13px/1 "DM Serif Display",serif;color:var(--gris)}
.selector{display:flex;gap:14px;margin:0 16px 14px;border-bottom:1px solid var(--tinta)}
.selector span{padding:6px 0;font-weight:700;font-size:13px;color:var(--gris)}
.selector span.on{color:var(--tinta);box-shadow:inset 0 -3px 0 var(--rojo)}
.selector small{display:block;font-weight:500;font-size:10px}
.stats{display:grid;grid-template-columns:repeat(4,1fr)}
.stats div{padding:0 6px;border-left:1px solid var(--tinta)}
.stats div:first-child{border-left:0;padding-left:0}
.stats b{display:block;font:26px/1 "DM Serif Display",serif}
.stats small{font-weight:600;font-size:12px;color:var(--gris)}
.rango-fila{display:flex;align-items:center;gap:12px;margin-top:12px}
.rango-fila .rg{width:40px;height:40px;font-size:18px}
.rango-fila b{font:20px/1 "DM Serif Display",serif;font-weight:400}
.progreso{display:grid;grid-template-columns:repeat(10,1fr);gap:4px;margin:8px 0 4px}
.progreso i{height:14px;border:1px solid var(--tinta);background:var(--blanco)}
.progreso i.si{background:var(--tinta)}
.pie-btn{padding:4px 16px 18px}
.pie-btn .btn{width:100%}
'''

# lo que cambia de NOMBRE según el estilo (el contenido es el mismo)
VOZ = {
    'barda': {'vivo': 'EN VIVO', 'prox': 'Próximo evento', 'semana': 'Tu semana', 'busca': 'Se busca',
              'paso': 'Lo que pasó', 'ev': 'Últimos eventos', 'prog': 'Hacia la carta Competitiva'},
    'fanzine': {'vivo': 'EN VIVO', 'prox': 'Próximo evento', 'semana': 'Tu semana', 'busca': 'Se busca',
                'paso': 'Lo que pasó', 'ev': 'Últimos eventos', 'prog': 'Hacia la carta Competitiva'},
    'tvpirata': {'vivo': 'EN EL AIRE', 'prox': '<i>P.102</i>Próximo evento', 'semana': '<i>P.103</i>Tu semana',
                 'busca': '<i>P.104</i>Se busca', 'paso': '<i>P.105</i>Lo que pasó', 'ev': '<i>P.211</i>Últimos eventos',
                 'prog': '<i>P.212</i>Hacia la Competitiva'},
    'diario': {'vivo': 'Último momento', 'prox': 'Próximo evento', 'semana': 'Tu semana', 'busca': 'Se busca',
               'paso': 'Lo que pasó', 'ev': 'Últimos eventos', 'prog': 'Hacia la carta Competitiva'},
}


def mayus(e, s):
    return s if e == 'diario' or e == 'tvpirata' else s


def cabeza(e, pantalla):
    """La parte de arriba de cada pantalla: cambia de FORMA según el estilo."""
    if e == 'diario':
        return ('<div class="cabecera"><div class="fecha"><span>Martes 29 de septiembre</span><span>Temporada 1</span></div>'
                '<div class="marca">Liga Global</div><div class="raya"></div></div>')
    if e == 'tvpirata':
        return ('<div class="tele"><span>P100 <b>LIGA GLOBAL</b></span><span>29 SEP 21:00:15</span></div>'
                '<div class="top"><div class="marca">LIGA<br>GLOBAL<small>CANAL DEL FREESTYLE</small></div>'
                '<span class="btn-ico">' + ico('campana', 22) + '</span></div>')
    return ('<div class="top"><div class="marca">LIGA GLOBAL</div><span class="btn-ico">' + ico('campana', 22) + '</span></div>')


def nav(activa):
    return '<nav class="nav">' + ''.join(
        '<a class="%s">%s<span>%s</span></a>' % ('on' if k == activa else '', ico(k, 22), n) for n, k in NAV) + '</nav>'


def st(e, clave):
    return '<div class="st">%s</div>' % VOZ[e][clave]


def hoy(e):
    v = VOZ[e]
    h = [cabeza(e, 'hoy')]
    titulo_vivo = VIVO['evento'] if e != 'diario' else 'TOKYO VOL 16 se define en los cuartos de final'
    meta = '%s · %s' % (VIVO['sv'], VIVO['ronda']) if e != 'diario' else '%s · en vivo' % VIVO['sv']
    h.append('<section class="bloque vivo"><span class="tag">%s</span><h2>%s</h2><p class="meta">servidor %s</p>'
             '<ul class="cruces">%s</ul><a class="btn">Ver llave</a></section>' % (
                 v['vivo'], titulo_vivo, meta,
                 ''.join('<li><span>%s</span><em>vs</em><span>%s</span></li>' % c for c in VIVO['cruces'])))
    h.append('<section class="bloque">%s<h3 class="ev-t">%s</h3><div class="chips"><span class="chip sv">%s</span>'
             '<span class="chip">%s</span><span class="chip">%d inscriptos</span></div>'
             '<div class="hora">%s <small>(tu hora)</small></div><div class="cuenta"><b>%s</b><small>para que arranque</small></div>'
             '<a class="btn accion">%sQuiero aviso</a></section>' % (
                 st(e, 'prox'), PROX['evento'], PROX['sv'], PROX['formato'], PROX['inscriptos'], PROX['hora'],
                 PROX['cuenta'], ico('campana', 18)))
    h.append('<section class="bloque">%s<div class="casillas">%s</div></section>' % (
        st(e, 'semana'), ''.join('<div><b>%s</b><small>%s</small></div>' % s for s in SEMANA)))
    h.append('<section class="bloque">%s<ul class="lista">%s</ul></section>' % (
        st(e, 'busca'), ''.join('<li><span class="mono">%s</span><span class="nom">%s</span><span class="precio">%s</span></li>'
                                % (mono(n), n, p) for n, p in BUSCA)))
    h.append('<section class="bloque">%s<ul class="lista">%s</ul></section>' % (
        st(e, 'paso'), ''.join('<li>%s<span class="nom">%s<small class="sub">'
                               'Campeón: %s</small></span><a class="lnk">Ver llave</a></li>' % (ico('trofeo', 20), ev, c)
                               for ev, c in PASO)))
    h.append(nav('hoy'))
    return ''.join(h)


def ranking(e):
    h = ['<div class="tele"><span>P101 <b>LIGA GLOBAL</b></span><span>29 SEP 21:00:15</span></div>' if e == 'tvpirata' else '']
    if e == 'diario':
        h.append(cabeza(e, 'ranking'))
    tit = 'Ranking' if e != 'tvpirata' else 'P.101 RANKING'
    h.append('<div class="cab"><h1>%s</h1><p>Temporada 1</p></div>' % tit)
    h.append('<div class="tabs">%s</div>' % ''.join('<span class="%s">%s</span>' % ('on' if i == 0 else '', t)
                                                    for i, t in enumerate(TABS)))
    h.append('<div class="buscar">%s<span>Buscar rapero</span></div>' % ico('buscar', 20))
    h.append('<div class="filtros"><span class="on">Todos</span><span>Mi servidor</span><span>Mi país</span></div>')
    filas = []
    for p, c, n, pa, r, pts in TABLA:
        cls = 'sube' if c.startswith('▲') else 'baja' if c.startswith('▼') else 'igual'
        filas.append('<div class="fila p%d"><span class="pos">%d</span><span class="cam %s">%s</span>'
                     '<span class="rap"><b>%s</b><small>%s</small></span>%s<span class="pts">%s</span></div>'
                     % (p, p, cls, c, n, pa, rango(r), pts))
    cab_tabla = ''
    if e == 'tvpirata':
        cab_tabla = '<div class="tabla-cab"><span>POS  RAPERO</span><span>RANGO  PUNTOS</span></div>'
    if e == 'diario':
        cab_tabla = ('<div class="tabla-cab"><span>Pos</span><span></span><span>Rapero</span><span>Rg</span>'
                     '<span style="text-align:right">Pts</span></div>')
    h.append('<div class="tabla">%s%s</div>' % (cab_tabla, ''.join(filas)))
    h.append('<div class="yo"><div><b>Tu posición: %s</b><small>%s pts · %s</small></div>'
             '<a class="btn">Encontrarme</a></div>' % (YO['pos'], YO['pts'], YO['cambio']))
    h.append(nav('ranking'))
    return ''.join(h)


def perfil(e):
    P = PERFIL
    h = []
    if e == 'diario':
        h.append(cabeza(e, 'perfil'))
    if e == 'tvpirata':
        h.append('<div class="tele"><span>P210 <b>LIGA GLOBAL</b></span><span>29 SEP 21:00:15</span></div>')
    kicker = '<div class="kicker">La figura</div>' if e == 'diario' else ''
    h.append('<div class="perfil-cab">%s<h1>%s</h1><div class="chips"><span class="chip">%s</span>'
             '<span class="chip sv">%s</span><span class="chip">%s</span></div>'
             '<div class="acciones"><a class="btn prim">Seguir · %d</a><a class="btn claro">%sCompartir</a></div></div>'
             % (kicker, P['nombre'] if e == 'diario' else P['nombre'].upper(), P['pais'], P['sv'], P['crew'],
                P['seguidores'], ico('compartir', 18)))
    sello = '<span class="sello">EN RACHA</span>' if e == 'fanzine' else ''
    h.append('<div class="pared"><div class="afiche">%s%s</div></div>' % (carta(), sello))
    h.append('<div class="selector">%s</div>' % ''.join(
        '<span class="%s">%s%s</span>' % ('on' if i == 0 else ('bloq' if b else ''), n,
                                          '<small>%s %s</small>' % ('🔒', b) if b else '')
        for i, (n, b) in enumerate(CARTAS)))
    h.append('<section class="bloque"><div class="stats">%s</div><div class="rango-fila">%s<b>Score %s</b></div></section>'
             % (''.join('<div><b>%s</b><small>%s</small></div>' % s for s in P['stats']), rango(P['rango']), P['score']))
    n, t = P['progreso']
    h.append('<section class="bloque">%s<div class="progreso">%s</div><small>%d de %d eventos</small></section>'
             % (st(e, 'prog'), ''.join('<i class="%s"></i>' % ('si' if i < n else '') for i in range(t)), n, t))
    h.append('<section class="bloque">%s<ul class="lista">%s</ul></section>' % (
        st(e, 'ev'), ''.join('<li><span class="nom">%s</span><span class="lnk" style="text-decoration:none">%s</span></li>'
                             % x for x in P['eventos'])))
    h.append('<div class="pie-btn"><a class="btn accion">%sCompartir carta</a></div>' % ico('compartir', 18))
    h.append(nav('yo'))
    return ''.join(h)


BASE = '''*{box-sizing:border-box}html,body{margin:0;background:#888}
body{padding:0}.app{width:360px;margin:0}
a{color:inherit;text-decoration:none}h1,h2,h3,p{margin:0}
.ico{flex:none}
.btn{white-space:nowrap}
'''


def pagina(e, pantalla):
    cuerpo = {'hoy': hoy, 'ranking': ranking, 'perfil': perfil}[pantalla](e)
    return ('<!doctype html><html lang="es"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=360,initial-scale=1">'
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?%s&%s&display=block">'
            '<style>%s%s%s</style></head><body><div class="app">%s</div></body></html>'
            % (FUENTES[e], CARTA_FUENTES, BASE, CSS[e], CARTA_CSS, cuerpo))


ESTILOS = ['barda', 'fanzine', 'tvpirata', 'diario']
PANTALLAS = ['hoy', 'ranking', 'perfil']


def main():
    salida = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'salida')
    os.makedirs(salida, exist_ok=True)
    for e in ESTILOS:
        for p in PANTALLAS:
            io.open(os.path.join(salida, '%s_%s.html' % (e, p)), 'w', encoding='utf-8', newline='\n').write(pagina(e, p))
    print('ok ·', len(ESTILOS) * len(PANTALLAS), 'páginas en', salida)


if __name__ == '__main__':
    main()
