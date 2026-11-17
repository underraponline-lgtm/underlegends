"""🎤 LOS NOMBRES DE RAPEROS FAMOSOS, en un solo lugar: para que el alta automática no le ponga uno a alguien de la Liga,
y para que un video con el nombre de un famoso no entre solo al perfil de nadie (`bot/videos_propios.py`).

Dlx, 16/11/2026: *«si alguien se llama como un famoso o algo parecido, que realmente averigües quién es la persona,
porque es muy poco probable que realmente sea uno famoso acá de momento»*. La lista nació en `videos_propios.py`
(«se puede poner aka chuty en Discord, y chuty es famoso»); se mudó acá para que las dos cosas usen la misma.

Medido ese día sobre la Lista: cinco personas con nombre de famoso, y ninguna era el famoso.

| en la Lista | quién es en Discord |
|---|---|
| VALLES-T | «ALEXXXOL», y «#69 \\| DJ 🐉 (SHADOW)» en DRA, FFA, FFS y URBF: la cuenta que Dlx ya había dicho el 10/11 que es OTRA CUENTA DE SHADOW. El ciclo la dio de alta igual el 12/11, por su apodo en la llamada de LKR |
| Sweet pain | «Sweet pain(venezolano)», y «Andy mc» en Ceuta: el Andy MC de FMS Ceuta |
| Trueno | «KairøX» en todos lados; se anotó «Trueno» en una inscripción |
| Teorema | «Rafael JR.», y «Teorema» de apodo en LKR |
| WOS | «wos» (usuario wosito_2017) en DDF, DDS, FDS y FFA |

O sea que un nombre de famoso es un apodo. Por eso el alta automática NO crea a nadie con uno
(`decidir.por_discord()`, `lista_raperos.agregar_varios()`): la pregunta «¿quién es X?» queda en ✅ Decidir, con los
nombres de esa cuenta en Discord al lado. Un alias a alguien que YA está en la Lista sí se hace: «VALLES-T» escrito en
una llave, con la cuenta de Shadow, es Shadow.

⚠️ «O algo parecido»: el nombre entero o uno parecido (`PARECIDO`, y una letra cambiada: «Chuti» por «Chuty»), sin
bandera, mayúsculas ni signos, y sin un número al final («Aczino2»). Los de la Liga que se llaman como alguien conocido
pero son ellos —Force, de FVS— NO van en la lista. Si mañana aparece otro famoso, se agrega acá.

    python sheet/famosos.py          # el self-check y quién de la Lista se llama así
"""
import difflib
import io
import json
import os
import re
import sys
import unicodedata

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

#: qué tan parecido a un famoso ya es «famoso» (difflib, sobre el nombre en minúsculas y sin símbolos)
PARECIDO = 0.84

#: la élite del freestyle (la lista de videos_propios.py) y los músicos que más se usan de apodo, con nombres que no se
#: confunden con uno común. ⚠️ Sin los de la Liga que se llaman como alguien conocido —Force, de FVS—
FAMOSOS = (
    'chuty', 'aczino', 'skone', 'bnet', 'gazir', 'mnak', 'jaze', 'wos', 'trueno', 'dtoke', 'papo', 'zasko', 'arkano',
    'vallest', 'rapder', 'lokillo', 'teorema', 'kaiser', 'hander', 'stigma', 'nitro', 'blon', 'yartzi', 'kodigo',
    'larrix', 'elekipo', 'sweetpain', 'mecha', 'tirpa', 'exodolirical', 'jota', 'bta', 'choque', 'kensuke',
    'sarasocas', 'gold', 'klan', 'titomc', 'basek', 'dozer', 'chang', 'replik', 'reverse', 'loboestepario', 'nekro',
    'pepegrillo', 'tata', 'joqer', 'cayro', 'ghost', 'litzen', 'jonybeltran', 'cacha', 'strike', 'raptor', 'tom crowley',
    'invert', 'letra', 'acertijo', 'fat n', 'mkd', 'jony', 'babi', 'rc', 'yoiker', 'el tanque', 'misionero',
    # 16/11/2026: los que faltaban de las batallas, y músicos
    'zticma', 'lancerlirical', 'bekaa', 'azuky', 'nekroos', 'hazhe', 'errechhe', 'muphasa', 'ricto', 'jokker',
    'litkillah', 'duki', 'ysya', 'khea', 'paulolondon', 'bhavi', 'neopistea', 'cazzu', 'canserbero', 'akapellah',
    'residente', 'anuel', 'mykeTowers', 'badbunny', 'eladiocarrion', 'kaseo', 'eminem', 'kendrick', 'tupac', '2pac',
    'xxxtentacion', 'bizarrap', 'pesopluma', 'daddyyankee', 'arcangel', 'santafeklan', 'lilsupa', 'microtdh',
    'neutroshorty', 'juicewrld', 'popsmoke',
)


def plano(s):
    """Sin bandera, sin tildes, sin signos ni espacios, en minúsculas."""
    s = unicodedata.normalize('NFKD', str(s or ''))
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]', '', s.lower())


_PLANOS = tuple(dict.fromkeys(plano(f) for f in FAMOSOS))


def famoso(nombre):
    """¿El nombre es de un famoso, o se le parece? «VALLES-T 🇨🇴», «Chutyy», «Chuti» y «Aczino2» sí; «Trueno Jr» y
    «Makmah» no."""
    n = plano(nombre)
    if not n:
        return False
    for cand in dict.fromkeys((n, re.sub(r'\d+$', '', n))):
        if not cand:
            continue
        for f in _PLANOS:
            if cand == f or (len(cand) >= 3 and difflib.SequenceMatcher(None, cand, f).ratio() >= PARECIDO):
                return True
            # «Chuti» por «Chuty»: una letra cambiada en un nombre de cuatro o más, que el parecido no ve
            if len(cand) >= 4 and len(cand) == len(f) and sum(1 for x, y in zip(cand, f) if x != y) == 1:
                return True
    return False


def _sin_adornos(n):
    """Las formas de un nombre sin sus adornos de siempre: el número del final, las letras repetidas («Chutyy»), y un
    «MC», «el», «real» u «oficial» pegado adelante o atrás."""
    out = set()
    for x in (n, re.sub(r'\d+$', '', n)):
        for y in (x, re.sub(r'(.)\1+', r'\1', x)):
            for z in (y, re.sub(r'^(?:mc|el|the|real|elreal)', '', y), re.sub(r'(?:mc|oficial|official|real|rap)$', '', y)):
                if len(z) >= 2:
                    out.add(z)
    return out


#: de la lista, los que también son palabras o apodos de cualquiera: un video que se llama «Ghost» va a revisión, pero un
#: «Ghost» nuevo en una llave es casi seguro alguien que se llama así (ya hay uno en la Lista, de Venezuela)
COMUNES = {'ghost', 'gold', 'strike', 'raptor', 'letra', 'tata', 'babi', 'rc', 'jota', 'jony', 'choque', 'eltanque',
           'acertijo', 'misionero', 'reverse', 'kaiser', 'nitro', 'invert', 'cacha', 'mecha', 'klan', 'chang'}
_CON_ADORNOS = {z for f in _PLANOS if f not in COMUNES for z in _sin_adornos(f)}


def es_famoso(nombre):
    """🆔 Para el ALTA: el nombre de un famoso, entero o con sus adornos («VALLES-T», «Vallest», «Chutyy», «MC Aczino»,
    «Trueno2»). Más estricto que `famoso()`: el parecido de difflib marcaba a 20 de la Lista el 16/11/2026, entre ellos
    Jona, Pipo y DUI, que son ellos; para el alta, eso mandaría a ✅ Decidir a gente que no hace falta preguntar."""
    n = plano(nombre)
    return bool(n) and bool(_sin_adornos(n) & _CON_ADORNOS)


def _self_check():
    fallas = []

    def ok(c, que):
        print('   %s %s' % ('✅' if c else '❌', que))
        if not c:
            fallas.append(que)
    ok(famoso('Chutyy') and famoso('Chuti') and not famoso('Makmah') and not famoso('Force') and not famoso('Six'),
       'videos: el famoso o uno parecido, y los de la Liga que se llaman como alguien conocido no')
    ok(es_famoso('VALLES-T 🇨🇴') and es_famoso('valles t') and es_famoso('Vallest'), 'alta: Valles-T, escrito de tres maneras')
    ok(es_famoso('Trueno') and es_famoso('Aczino2') and es_famoso('Sweet pain') and es_famoso('Chutyy')
       and es_famoso('MC Aczino') and es_famoso('Teorema'), 'alta: el nombre entero o con sus adornos')
    ok(not any(es_famoso(x) for x in ('Trueno Jr', 'Shadow', '', 'Andy MC', 'Jona', 'Pipo', 'DUI', 'Basik', 'Angel',
                                      'Nitrox', 'Ghost 🇻🇪', 'letrao', 'Force')),
       'alta: un parecido no frena a nadie (Jona, Pipo, DUI, Basik… son ellos)')
    try:
        g = json.load(io.open(os.path.join(BASE, 'datos', 't1_lista.json'), encoding='utf-8'))['grilla']
        hoy = sorted({str(f[7] or f[0]) for f in g[1:] if len(f) > 7 and es_famoso(f[7] or f[0])})
        print('   ℹ️ en la Lista hoy (%d): %s' % (len(hoy), ', '.join(hoy) or 'nadie'))
    except (OSError, ValueError, KeyError, IndexError):
        print('   ℹ️ sin la Lista para mirar')
    print('\n  %s' % ('todo ok' if not fallas else '%d fallas' % len(fallas)))
    return not fallas


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.exit(0 if _self_check() else 1)
