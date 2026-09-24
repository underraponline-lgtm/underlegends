"""v11 — marcos con capas de verdad, uno por servidor.

Construido de cero como componente propio, no parcheando el generador: hacia
falta control total del apilado y con overrides sobre la carta vieja no se
llegaba.

LA PILA, de atras hacia adelante (esto es lo que faltaba):
   1  lamas de atras       canto oscuro + cara clara DESFASADA -> volumen
   2  canto metalico       degrade de 7 paradas, no de 2
   3  bisel                filo claro arriba, sombra abajo, 1.5px
   4  panel interior       con SU PROPIO borde oscuro + filo claro
   5  cristal              planos duros facetados, no un degrade liso
   6  vetas                lineas del color acento cruzando el cristal
   7  silueta del servidor de marca de agua
   8  foto
   9  texto
  10  lamas de adelante    tapan el canto -> ata las capas
  11  escudo de arriba     MONTA el canto
  12  gema de abajo        MONTA el canto

Sin las capas 3, 4 y 10 la carta se ve plana. Ese era el problema.

LOS NUEVE ARQUETIPOS, repartidos de los 8 marcos de Mbappe que paso Dlx:
  TFC   placa institucional  marco grueso, doble bisel, sin lamas
  SR    hojas de fuego       lamas largas naranjas en diagonal
  DRA   cristal azul         facetas + lamas plateadas cortas
  FTN   oro TOTY             lamas doradas grandes + cristal azul
  TWR   vidrio roto          lamas irregulares rosas, muchas
  FRZ   hielo                facetas blancas + lamas de hielo finas
  URBF  pegatina             contorno blanco grueso, lamas cortas
  EFA   bronce acunado       marco radial, lamas tipo laurel
  FFA   neon                 canto fino encendido, lamas magenta
"""
import asyncio, base64, json, os
from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
SILD = os.path.join(BASE, 'comun', 'logos_sv')
CUAD = os.path.join(BASE, 'comun', 'escudos_cuad')
EST = json.load(open(os.path.join(BASE, 'datos', 'estrellas.json'), encoding='utf-8'))['estrellas_por_servidor']

ESCUDO = ('polygon(0% 3%, 3% 0%, 97% 0%, 100% 3%, 100% 79%, 97% 86%, 88% 92%, '
          '66% 97.5%, 50% 100%, 34% 97.5%, 12% 92%, 3% 86%, 0% 79%)')


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


UL = b64(os.path.join(BASE, '02_Competitivo', 'ul_blanco.png'))
# el AVATAR, bajado del CDN. Antes apuntaba por error a Valen_servidor.png,
# que es la carta exportada completa: salia una carta dentro de la carta.
FOTO = b64(os.path.join(SCR, 'av_valen.png'))
def sil(sv): return b64(os.path.join(SILD, 'sv_%s.png' % sv.lower()))
def esc(sv): return b64(os.path.join(CUAD, 'sv_%s.png' % sv.lower()))


def t(c, f):
    h = c.lstrip('#'); r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    if f >= 0: r, g, b = (int(x + (255-x)*f) for x in (r, g, b))
    else:      r, g, b = (int(x*(1+f)) for x in (r, g, b))
    return '#%02X%02X%02X' % (r, g, b)


# ══ base · acento · metal del canto (7 paradas) ══
SV = {
 'TFC':  dict(base='#5A0A16', ac='#F2E9E9',
              metal=['#F7EEEE','#B8969A','#4A0810','#E8D8DA','#6B1420','#D8C2C6','#8A5A62'],
              arq='placa'),
 'SR':   dict(base='#8F3A06', ac='#FFB03A',
              metal=['#FFD98A','#E08010','#5A2404','#FFC45E','#7A3606','#FFE0A0','#B05A0C'],
              arq='fuego'),
 'DRA':  dict(base='#2B3FD8', ac='#FFFFFF',
              metal=['#FFFFFF','#B8C4E8','#2A3A8A','#EEF2FF','#3A4AA8','#DCE4FF','#7A88C8'],
              arq='cristal'),
 'FTN':  dict(base='#1E2A66', ac='#E8C86A',
              metal=['#FFF2C4','#E0BE5A','#6B5010','#FFE79A','#8A6A18','#FFEFB8','#B08A28'],
              arq='oro'),
 'TWR':  dict(base='#A00A38', ac='#FF5C8A',
              metal=['#FFD0DE','#E0446E','#5A0418','#FF9CB8','#7A0A24','#FFC0D2','#B02850'],
              arq='vidrio'),
 'FRZ':  dict(base='#0E6E6A', ac='#CFFAF4',
              metal=['#FFFFFF','#A8E8E0','#0A4A48','#E4FFFC','#126A66','#D0F8F2','#5AB8B0'],
              arq='hielo'),
 'URBF': dict(base='#5E2E9E', ac='#FFFFFF',
              metal=['#FFFFFF','#D8C0F0','#3A1866','#FFFFFF','#4A2080','#EEDCFF','#8A5AC0'],
              arq='pegatina'),
 'EFA':  dict(base='#3A2412', ac='#E8A144',
              metal=['#F0C888','#C07A28','#4A2C08','#E8B868','#6B4210','#F8D9A0','#9A6A20'],
              arq='bronce'),
 'FFA':  dict(base='#28084A', ac='#EC48DC',
              metal=['#FFB0F2','#C428B0','#3A0A50','#F888E4','#5A1070','#FFC8F6','#8A2078'],
              arq='neon'),
}

# ══ las lamas: (x%, y%, ancho%, alto%, rotacion, forma) ══
LAMAS = {
 'placa':    [],
 'fuego':    [(-11, 20, 30, 20, -22, 'polygon(0 44%,70% 0,100% 50%,34% 100%)'),
              (-6, 52, 24, 16, -12, 'polygon(0 40%,74% 0,100% 56%,30% 100%)'),
              (89, 12, 28, 18, 22, 'polygon(0 0,100% 40%,72% 100%,10% 58%)'),
              (86, 62, 24, 15, 12, 'polygon(0 30%,100% 0,82% 100%)')],
 'cristal':  [(-7, 26, 18, 22, -8, 'polygon(0 34%,60% 0,100% 44%,42% 100%)'),
              (91, 40, 17, 20, 10, 'polygon(0 0,100% 36%,66% 100%)'),
              (-5, 58, 14, 16, 6, 'polygon(0 46%,100% 0,78% 100%)')],
 'oro':      [(-12, 10, 30, 26, -16, 'polygon(0 30%,66% 0,100% 44%,38% 100%)'),
              (-8, 46, 26, 22, -6, 'polygon(0 38%,72% 0,100% 52%,32% 100%)'),
              (88, 8, 30, 24, 18, 'polygon(0 0,100% 34%,70% 100%,8% 56%)'),
              (86, 48, 26, 22, 8, 'polygon(0 26%,100% 0,78% 100%,14% 72%)'),
              (44, -5, 13, 11, 0, 'polygon(50% 0,100% 100%,0 100%)')],
 'vidrio':   [(-10, 14, 26, 17, -26, 'polygon(0 30%,64% 0,100% 48%,28% 100%)'),
              (-7, 40, 22, 14, -8, 'polygon(0 44%,70% 0,100% 60%,36% 100%)'),
              (-5, 62, 19, 13, 14, 'polygon(0 36%,100% 0,80% 100%)'),
              (90, 20, 24, 16, 24, 'polygon(0 0,100% 38%,68% 100%)'),
              (88, 46, 21, 14, 10, 'polygon(0 30%,100% 0,84% 100%)'),
              (86, 68, 18, 12, -6, 'polygon(0 0,100% 44%,60% 100%)')],
 'hielo':    [(-9, 12, 22, 24, -12, 'polygon(0 32%,56% 0,100% 40%,46% 100%)'),
              (-6, 44, 18, 20, 8, 'polygon(0 40%,66% 0,100% 52%,34% 100%)'),
              (-4, 68, 15, 15, -4, 'polygon(0 44%,100% 0,74% 100%)'),
              (90, 18, 21, 22, 14, 'polygon(0 0,100% 34%,64% 100%,6% 60%)'),
              (88, 50, 18, 18, -10, 'polygon(0 28%,100% 0,80% 100%)'),
              (87, 72, 14, 13, 18, 'polygon(0 0,100% 40%,56% 100%)')],
 'pegatina': [(-6, 30, 17, 15, -14, 'polygon(0 36%,66% 0,100% 50%,32% 100%)'),
              (90, 52, 16, 14, 16, 'polygon(0 0,100% 34%,70% 100%)')],
 'bronce':   [(-5, 14, 15, 18, 0, 'polygon(50% 0,100% 46%,50% 100%,0 46%)'),
              (-5, 44, 15, 18, 0, 'polygon(50% 0,100% 46%,50% 100%,0 46%)'),
              (-5, 68, 13, 15, 0, 'polygon(50% 0,100% 46%,50% 100%,0 46%)'),
              (91, 14, 15, 18, 0, 'polygon(50% 0,100% 46%,50% 100%,0 46%)'),
              (91, 44, 15, 18, 0, 'polygon(50% 0,100% 46%,50% 100%,0 46%)'),
              (92, 68, 13, 15, 0, 'polygon(50% 0,100% 46%,50% 100%,0 46%)')],
 'neon':     [(-8, 24, 22, 20, -14, 'polygon(0 34%,60% 0,100% 46%,40% 100%)'),
              (90, 38, 20, 18, 16, 'polygon(0 0,100% 34%,66% 100%)'),
              (45, -4, 12, 10, 0, 'polygon(50% 0,100% 100%,0 100%)')],
}


def cristal(arq, base, ac):
    """El arte de adentro. Planos duros, no un degrade liso.

    Todo con f-strings a proposito: el formateo con % choca con los
    porcentajes del CSS y ya me hizo perder tiempo tres veces hoy.
    """
    o = t(base, -.45); c = t(base, .22); m = t(base, -.15); a2 = t(ac, -.10)
    if arq == 'placa':
        return (f'background:repeating-linear-gradient(180deg,{base} 0 26px,'
                f'{t(base,-.26)} 26px 52px)')
    if arq == 'fuego':
        return ('background:'
                'linear-gradient(152deg,transparent 0 46%,rgba(0,0,0,.55) 50% 100%),'
                f'linear-gradient(38deg,{c} 0 26%,transparent 26%),'
                f'linear-gradient(-42deg,{o} 0 20%,transparent 20%),'
                f'linear-gradient(168deg,{c},{m})')
    if arq == 'cristal':
        return ('background:'
                'linear-gradient(122deg,rgba(255,255,255,.20) 0 24%,transparent 24%),'
                'linear-gradient(-138deg,rgba(0,0,0,.34) 0 30%,transparent 30%),'
                'linear-gradient(154deg,transparent 0 56%,rgba(255,255,255,.14) 56% 72%,transparent 72%),'
                'linear-gradient(-100deg,transparent 0 68%,rgba(0,0,0,.26) 68% 100%),'
                f'linear-gradient(168deg,{c},{o})')
    if arq == 'oro':
        return ('background:'
                'linear-gradient(118deg,rgba(232,200,106,.22) 0 18%,transparent 18%),'
                'linear-gradient(-126deg,rgba(0,0,0,.42) 0 26%,transparent 26%),'
                'linear-gradient(146deg,transparent 0 50%,rgba(232,200,106,.16) 50% 62%,transparent 62%),'
                'linear-gradient(-92deg,transparent 0 72%,rgba(0,0,0,.30) 72% 100%),'
                f'linear-gradient(168deg,{c},{o})')
    if arq == 'vidrio':
        return ('background:'
                'linear-gradient(112deg,rgba(255,255,255,.18) 0 20%,transparent 20%),'
                'linear-gradient(-148deg,rgba(0,0,0,.40) 0 24%,transparent 24%),'
                'linear-gradient(132deg,transparent 0 44%,rgba(255,255,255,.12) 44% 54%,transparent 54%),'
                'linear-gradient(-118deg,transparent 0 62%,rgba(0,0,0,.28) 62% 78%,transparent 78%),'
                f'linear-gradient(168deg,{c},{o})')
    if arq == 'hielo':
        return ('background:'
                'linear-gradient(126deg,rgba(255,255,255,.34) 0 22%,transparent 22%),'
                'linear-gradient(-134deg,rgba(255,255,255,.20) 0 26%,transparent 26%),'
                'linear-gradient(150deg,transparent 0 48%,rgba(0,0,0,.24) 48% 60%,transparent 60%),'
                'linear-gradient(-104deg,transparent 0 66%,rgba(255,255,255,.16) 66% 100%),'
                f'linear-gradient(180deg,{a2} 0 42%,{o} 42% 100%)')
    if arq == 'pegatina':
        return ('background:'
                'linear-gradient(104deg,rgba(0,0,0,.40) 0 26%,transparent 26%),'
                'linear-gradient(-104deg,rgba(255,255,255,.16) 0 20%,transparent 20%),'
                'repeating-linear-gradient(72deg,rgba(255,255,255,.06) 0 2px,transparent 2px 11px),'
                f'linear-gradient(168deg,{c},{o})')
    if arq == 'bronce':
        return ('background:'
                'repeating-conic-gradient(from 0deg at 50% 32%,rgba(232,161,68,.22) 0deg 4deg,'
                'transparent 4deg 9deg),'
                f'radial-gradient(circle at 50% 32%,{t(ac,-.15)} 0%,{t(base,.18)} 26%,{o} 100%)')
    if arq == 'neon':
        return ('background:'
                'radial-gradient(ellipse at 50% 30%,rgba(236,72,220,.34),transparent 58%),'
                'linear-gradient(122deg,rgba(236,72,220,.16) 0 18%,transparent 18%),'
                'linear-gradient(-130deg,rgba(0,0,0,.44) 0 24%,transparent 24%),'
                f'linear-gradient(168deg,{c},#0C0518)')
    return f'background:linear-gradient(168deg,{c},{o})'


def lamas_html(arq, metal, ac):
    """Cada lama: canto oscuro + cara clara desfasada. Eso da el volumen."""
    out = ''
    for i, (x, y, w, h, rot, forma) in enumerate(LAMAS[arq]):
        canto = ('<i class="lam" style="left:{x}%;top:{y}%;width:{w}%;height:{h}%;'
                 'transform:rotate({r}deg) translate(2px,3px);clip-path:{f};'
                 'background:linear-gradient(140deg,{c1},{c2})"></i>').format(
                     x=x, y=y, w=w, h=h, r=rot, f=forma, c1=metal[2], c2=metal[6])
        cara = ('<i class="lam" style="left:{x}%;top:{y}%;width:{w}%;height:{h}%;'
                'transform:rotate({r}deg);clip-path:{f};'
                'background:linear-gradient(140deg,{c1} 0%,{c2} 34%,{c3} 58%,{c4} 100%)"></i>').format(
                    x=x, y=y, w=w, h=h, r=rot, f=forma,
                    c1=metal[0], c2=metal[1], c3=metal[3], c4=metal[5])
        out += canto + cara
    return out


def carta(sv):
    d = SV[sv]; metal = d['metal']; base = d['base']; ac = d['ac']; arq = d['arq']
    n = EST.get(sv, 0)
    est = ''.join('<i>&#9733;</i>' for _ in range(n))
    lam = lamas_html(arq, metal, ac)
    stops = ','.join('%s %d%%' % (c, int(i*100/(len(metal)-1))) for i, c in enumerate(metal))
    return """
<div class="wrap">
  <div class="lamas atras">@@LAM@@</div>
  <div class="marco" style="background:linear-gradient(146deg,@@STOPS@@)">
    <div class="bisel"></div>
    <div class="panel">
      <div class="cristal" style="@@CRISTAL@@"></div>
      <div class="sombra-sv" style="background-image:url(@@SIL@@)"></div>
      <div class="foto"><img src="@@FOTO@@"></div>
      <div class="izq">
        <div class="num">81</div>
        <div class="rng" style="color:@@AC@@">S</div>
        <img class="ban" src="https://flagcdn.com/w80/ar.png">
        <div class="rk"><span><b>#2</b><u>COMP</u></span><span><b>#4</b><u>TEMP</u></span></div>
      </div>
      <div class="nom">VALEN</div>
      <div class="regla" style="background:linear-gradient(90deg,transparent,@@AC@@,transparent)"></div>
      <div class="stats">
        <div><b>11</b><u>RCH</u></div><div><b>305K</b><u>PTS</u></div>
        <div><b>57.3</b><u>WR%</u></div><div><b>18</b><u>DUE</u></div>
        <div><b>35</b><u>POD</u></div><div><b>80</b><u>EVT</u></div>
      </div>
      <div class="estr">@@EST@@</div>
    </div>
  </div>
  <div class="lamas frente">@@LAM@@</div>
  <img class="ul" src="@@UL@@">
  <div class="gema" style="background:linear-gradient(145deg,@@M0@@,@@M2@@,@@M3@@)">
    <img src="@@ESC@@">
  </div>
</div>""".replace('@@LAM@@', lam).replace('@@STOPS@@', stops) \
         .replace('@@CRISTAL@@', cristal(arq, base, ac)) \
         .replace('@@SIL@@', sil(sv)).replace('@@FOTO@@', FOTO) \
         .replace('@@AC@@', ac).replace('@@EST@@', est) \
         .replace('@@UL@@', UL).replace('@@ESC@@', esc(sv)) \
         .replace('@@M0@@', metal[0]).replace('@@M2@@', metal[2]).replace('@@M3@@', metal[3])


CSS = """
body{background:#0A0A10;margin:0;padding:34px;font-family:system-ui,sans-serif}
.fila{display:flex;gap:46px;flex-wrap:wrap}
.col{text-align:center}
.et{color:#9A9AB0;font-size:12px;letter-spacing:1.4px;margin-bottom:16px;text-transform:uppercase}
.rot{color:#EDEDF5;font-size:15px;font-weight:700;letter-spacing:1.4px;margin:8px 0 18px}
.rot span{color:#8A8AA0;font-weight:400;letter-spacing:0;text-transform:none}

.wrap{position:relative;width:330px;height:482px}

/* 1 y 10 · LAS LAMAS */
.lamas{position:absolute;inset:0;pointer-events:none}
.lamas.atras{z-index:0}
.lamas.frente{z-index:7;clip-path:polygon(0 0,16% 0,16% 100%,0 100%,0 0,100% 0,100% 100%,84% 100%,84% 0,100% 0)}
.lam{position:absolute;display:block;filter:drop-shadow(0 3px 7px rgba(0,0,0,.55))}

/* 2 · CANTO METALICO */
.marco{position:absolute;inset:0;clip-path:CLIP;z-index:2}
/* 3 · BISEL: filo claro arriba, sombra abajo */
.bisel{position:absolute;inset:0;clip-path:CLIP;
  box-shadow:inset 0 1.5px 0 rgba(255,255,255,.55),inset 0 -2px 4px rgba(0,0,0,.5),
             inset 1.5px 0 0 rgba(255,255,255,.22),inset -1.5px 0 0 rgba(0,0,0,.35)}
/* 4 · PANEL con su propio borde */
.panel{position:absolute;inset:13px;clip-path:CLIP;overflow:hidden;
  box-shadow:inset 0 0 0 1.5px rgba(0,0,0,.78),inset 0 0 0 3px rgba(255,255,255,.20),
             inset 0 4px 14px rgba(0,0,0,.45)}
/* 5 · CRISTAL */
.cristal{position:absolute;inset:0;z-index:0}
/* 7 · silueta de marca de agua */
.sombra-sv{position:absolute;inset:0;z-index:1;background-size:104%;
  background-position:center 38%;background-repeat:no-repeat;opacity:.16;mix-blend-mode:overlay}
/* 8 · FOTO */
.foto{position:absolute;top:12%;left:50%;transform:translateX(-50%);
  width:38%;height:24%;border-radius:13px;overflow:hidden;z-index:3;
  border:2.5px solid rgba(255,255,255,.92);box-shadow:0 7px 18px rgba(0,0,0,.8)}
.foto img{width:100%;height:100%;object-fit:cover;object-position:center 16%}

/* 9 · TEXTO */
.izq{position:absolute;top:5.5%;left:7%;z-index:5;display:flex;flex-direction:column;align-items:flex-start}
.num{font-family:'Archivo','LigaEmoji',sans-serif;font-size:2.1rem;font-weight:900;color:#fff;line-height:.82;
  text-shadow:0 2px 5px rgba(0,0,0,.85),0 0 18px rgba(0,0,0,.5)}
.rng{font-family:'Archivo','LigaEmoji',sans-serif;font-size:.8rem;font-weight:900;line-height:1;margin-top:2px;
  text-shadow:0 1px 3px rgba(0,0,0,.9)}
.ban{width:23px;height:17px;border-radius:3px;object-fit:cover;margin-top:6px;
  box-shadow:0 2px 5px rgba(0,0,0,.7),0 0 0 1.5px rgba(255,255,255,.7)}
.rk{display:flex;flex-direction:column;gap:3px;margin-top:6px}
.rk span{display:flex;align-items:baseline;gap:3px;background:rgba(0,0,0,.46);
  border:1px solid rgba(255,255,255,.26);border-radius:5px;padding:1px 5px 2px}
.rk b{font-family:'Archivo','LigaEmoji',sans-serif;font-size:.6rem;font-weight:900;color:#fff}
.rk u{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.25rem;font-weight:900;
  letter-spacing:.6px;opacity:.62;color:#fff}
.nom{position:absolute;top:39%;left:0;right:0;text-align:center;z-index:5;
  font-family:'Archivo','LigaEmoji',sans-serif;font-size:1.36rem;font-weight:900;color:#fff;
  letter-spacing:-.3px;text-shadow:0 2px 4px rgba(0,0,0,.8),0 4px 16px rgba(0,0,0,.6)}
.regla{position:absolute;top:46%;left:14%;right:14%;height:1.5px;z-index:5;opacity:.7}
.stats{position:absolute;top:49.5%;left:9%;right:9%;z-index:5;
  display:grid;grid-template-columns:1fr 1fr;row-gap:5px;column-gap:8px}
.stats div{display:flex;align-items:baseline;gap:4px;justify-content:center}
.stats b{font-family:'Barlow Condensed','LigaEmoji',sans-serif;font-size:1.14rem;font-weight:700;color:#fff;
  text-shadow:0 2px 4px rgba(0,0,0,.8)}
.stats u{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.36rem;font-weight:900;
  letter-spacing:.7px;color:#fff;opacity:.68}
.estr{position:absolute;top:80%;left:0;right:0;text-align:center;z-index:5;line-height:1}
.estr i{font-style:normal;font-size:.98rem;color:#fff;margin:0 2px;
  text-shadow:0 1px 2px rgba(0,0,0,.95),0 0 9px rgba(255,255,255,.85)}

/* 11 · ESCUDO DE ARRIBA, monta el canto */
.ul{position:absolute;left:50%;top:.6%;transform:translateX(-50%);width:11%;z-index:9;
  opacity:.94;filter:drop-shadow(0 2px 5px rgba(0,0,0,.95))}
/* 12 · GEMA, monta el canto */
.gema{position:absolute;left:50%;bottom:.5%;transform:translateX(-50%) rotate(45deg);
  width:19%;height:19%;z-index:9;border-radius:6px;
  box-shadow:0 5px 16px rgba(0,0,0,.9),inset 0 0 0 2px rgba(255,255,255,.45),
             inset 0 0 0 3.5px rgba(0,0,0,.5);
  display:flex;align-items:center;justify-content:center;overflow:hidden}
.gema img{width:74%;transform:rotate(-45deg);border-radius:4px}
""".replace('CLIP', ESCUDO)

ETQ = {'TFC':'placa institucional','SR':'hojas de fuego','DRA':'cristal azul',
       'FTN':'oro TOTY','TWR':'vidrio roto','FRZ':'hielo','URBF':'pegatina',
       'EFA':'bronce acuñado','FFA':'neón'}


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'), encoding='utf-8').read()
    cuerpo = ''
    for sv in ['FTN','SR','FRZ','DRA','TFC','TWR','EFA','URBF','FFA']:
        cuerpo += ('<div class="col"><div class="et">%s · %s · %d&#9733;</div>%s</div>'
                   % (sv, ETQ[sv], EST.get(sv, 0), carta(sv)))
    pag = ("""<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
@@FUENTES@@
@@CSS@@
</style></head><body>
<div class="rot">v11 · MARCOS CON CAPAS <span>— lamas con canto y cara · canto de 7 paradas · bisel · panel con borde propio · cristal facetado · piezas que montan el marco</span></div>
<div class="fila">@@CUERPO@@</div>
</body></html>""".replace('@@FUENTES@@', fuentes)
                 .replace('@@CSS@@', CSS).replace('@@CUERPO@@', cuerpo))
    out = os.path.join(SCR, 'v11.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1560, 'height': 1500}, device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'v11.png'), full_page=True)
        await b.close()
    print('-> v11.png')

asyncio.run(main())
