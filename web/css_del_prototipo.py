# -*- coding: utf-8 -*-
"""El CSS del Inicio nuevo sale del prototipo (`docs/remake/reales.py`), que ya se miró con Dlx.

    python web/css_del_prototipo.py        # escribe web/src/estilo.css

El prototipo dibuja dos páginas de ancho fijo: `.pc` (1280) y `.movil` (360). La página de verdad es una sola y se
adapta, así que acá:

- lo de `.pc` pasa a `@media (min-width: 900px)` y lo de `.movil` a `@media (max-width: 899.98px)`, cambiando la
  clase por `.app` (misma especificidad, así que la cascada no cambia);
- los anchos fijos de `.pc` y `.movil` se sacan;
- los márgenes laterales de la computadora (40 px) pasan a `var(--gut)`, que en pantallas de más de 1280 crece para
  que el contenido quede centrado y las bandas negras sigan de borde a borde.

⚠️ NADA DE REGEX SOBRE LAS REGLAS: el CSS se parte con un lector que respeta llaves, comentarios y comillas (la regla
de CLAUDE.md, que ya se rompió dos veces con `.card`). Las regex de abajo sólo miran UN selector por vez.
"""
import io
import os
import re
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(AQUI), 'docs', 'remake'))
import reales as R  # noqa: E402

PC = '@media (min-width: 900px)'
CEL = '@media (max-width: 899.98px)'


def bloques(css):
    """[(preludio, cuerpo)] de primer nivel. Un at-rule con bloques adentro vuelve entero en `preludio` y cuerpo None."""
    out, i, n = [], 0, len(css)
    while i < n:
        # comentarios y espacios
        while i < n and css[i].isspace():
            i += 1
        if css.startswith('/*', i):
            j = css.find('*/', i + 2)
            i = n if j < 0 else j + 2
            continue
        if i >= n:
            break
        j, prof, com = i, 0, None
        ini_cuerpo = -1
        while j < n:
            c = css[j]
            if com:
                if c == com and css[j - 1] != '\\':
                    com = None
            elif css.startswith('/*', j):
                k = css.find('*/', j + 2)
                j = n if k < 0 else k + 1
            elif c in '"\'':
                com = c
            elif c == '{':
                if prof == 0:
                    ini_cuerpo = j
                prof += 1
            elif c == '}':
                prof -= 1
                if prof == 0:
                    break
            j += 1
        preludio = css[i:ini_cuerpo].strip()
        cuerpo = css[ini_cuerpo + 1:j]
        if preludio.startswith('@'):
            out.append((css[i:j + 1].strip(), None))
        else:
            out.append((preludio, cuerpo.strip()))
        i = j + 1
    return out


def selectores(preludio):
    """Parte la lista de selectores por las comas de primer nivel (no las de adentro de :is(), :not(), etc.)."""
    out, prof, ini = [], 0, 0
    for k, c in enumerate(preludio):
        if c == '(':
            prof += 1
        elif c == ')':
            prof -= 1
        elif c == ',' and prof == 0:
            out.append(preludio[ini:k].strip())
            ini = k + 1
    out.append(preludio[ini:].strip())
    return [s for s in out if s]


ES_PC = re.compile(r'\.pc(?![\w-])')
ES_CEL = re.compile(r'\.movil(?![\w-])')


def gutter(cuerpo):
    """Los 40 px de costado de la computadora pasan a `var(--gut)`; las flechas del escenario, relativas a eso."""
    cuerpo = re.sub(r'(padding|margin):(\d+(?:px)?) 40px (\d+(?:px)?)', r'\1:\2 var(--gut) \3', cuerpo)
    cuerpo = re.sub(r'padding:(\d+px) 40px\b(?! \d)', r'padding:\1 var(--gut)', cuerpo)
    cuerpo = cuerpo.replace('padding:0 40px', 'padding:0 var(--gut)')
    cuerpo = cuerpo.replace('padding-left:104px;padding-right:104px', 'padding-left:calc(var(--gut) + 64px);padding-right:calc(var(--gut) + 64px)')
    cuerpo = cuerpo.replace('left:28px;box-shadow', 'left:calc(var(--gut) - 12px);box-shadow')
    cuerpo = cuerpo.replace('right:28px;box-shadow', 'right:calc(var(--gut) - 12px);box-shadow')
    return cuerpo


def convertir(css):
    salida = []
    for preludio, cuerpo in bloques(css):
        if cuerpo is None:
            salida.append(preludio)
            continue
        base, pc, cel = [], [], []
        for s in selectores(preludio):
            if s in ('.pc', '.movil'):
                continue                      # los anchos fijos del prototipo
            if ES_PC.search(s):
                pc.append(ES_PC.sub('.app', s))
            elif ES_CEL.search(s):
                cel.append(ES_CEL.sub('.app', s))
            else:
                base.append(s)
        if base:
            salida.append('%s{%s}' % (','.join(base), cuerpo))
        if pc:
            salida.append('%s{%s{%s}}' % (PC, ','.join(pc), gutter(cuerpo)))
        if cel:
            salida.append('%s{%s{%s}}' % (CEL, ','.join(cel), cuerpo))
    return '\n'.join(salida)


def main():
    # 🔒 DESDE EL 30/09/2026 estilo.css SE EDITA A MANO: el Inicio está en línea y el prototipo quedó congelado.
    # Generarlo de nuevo pisaría esos cambios (la llave, el dorado en rosa, las flechas del celular…), así que sólo
    # corre con --pisar, y sabiendo que después hay que volver a poner lo que se pierda.
    ruta = os.path.join(AQUI, 'src', 'estilo.css')
    if os.path.exists(ruta) and '--pisar' not in sys.argv:
        raise SystemExit('🔴 src/estilo.css se edita a mano desde el 30/09/2026: generarlo pisaría los cambios. '
                         'Si de verdad hace falta, `--pisar`.')
    css = R.Liga.css(None, True, 'inicio')
    out = convertir(css)
    cab = ('/* GENERADO por web/css_del_prototipo.py desde docs/remake/reales.py: no se edita a mano.\n'
           '   Lo que es sólo de la página de verdad va en src/vivo.css. */\n'
           ':host{display:block}\n'
           '.app{--gut:40px}\n'
           '@media (min-width: 1281px){.app{--gut:calc((100vw - 1200px) / 2)}}\n')
    io.open(ruta, 'w', encoding='utf-8', newline='\n').write(cab + out + '\n')
    quedan = [ln for ln in out.split('\n') if ln.startswith(PC) and '40px' in ln]
    print('ok · %d KB · %d reglas de computadora siguen con 40px (revisar si son de costado)' % (len(out) // 1024, len(quedan)))
    for ln in quedan[:30]:
        print('   ', ln[:170])


if __name__ == '__main__':
    main()
