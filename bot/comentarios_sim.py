"""Los comentarios simulados de Publicaciones (12/11/2026).

🔑 Dlx, a la maqueta de los comentarios: «Sí, constrúyelo». Debajo de cada publicación del muro salen unos comentarios
cortos para que no se vea vacío y la gente se anime a contestar. Los arma el ciclo, acá, con frases armadas y los
datos de cada publicación —nunca una IA que escribe lo que quiera—, y viajan adentro del muro (`cm` de cada
publicación, `bot/muro.py`).

⚠️ CON LA CARA DE ALGUIEN REAL SÓLO SEGÚN SU PERMISO (`cm:permisos` en KV, lo deja `espejarPermisos()` de
bot/avisos.js). Dlx le pregunta a cada uno y lo marca en su Dashboard; la persona lo apaga en Mi cuenta:

    «si»          su cara y su nombre, sin etiqueta
    sin preguntar con la etiqueta «simulado», pegada al nombre
    «no»          no aparece nunca

Y no aparecen nunca: quien ocultó su foto, el dueño de la publicación, quien jugó ese evento (nada contra quien le
ganó ese día) ni nadie más de dos veces el mismo día. Las frases son picantes pero de joda: ni insultos, ni la vida
privada de nadie.

🎲 LA VERSIÓN 2 (15/11/2026, Dlx: «más aleatoriedad y más variedad en los comentarios y quizás más de 1 persona
dependiendo de la publicación»). Medido en el muro de ese día: 45 frases distintas en 85 comentarios, «me anoto»
seis veces, y nunca más de 3 por publicación. Ahora:

- **cuántos depende de la publicación**: una final con mucha gente, una noche con muchos eventos, una letra alta o un
  nivel redondo del Pase traen más (hasta `TOPE`); y no salen parejos, a veces uno y a veces muchos.
- **cada persona escribe a su manera**, siempre igual (`_estilo()`): en minúscula o no, con emoji o sin, cómo se ríe,
  y a veces con una palabra de su país.
- **más frases**, más las cortas de festejo (`GENERICO`), y ninguna se repite el mismo día mientras haya otra.
- **se contestan entre ellos** (`RESPUESTA`): la tupla trae un séptimo valor, a quién le contesta, y la página lo
  muestra como «↪ a …». A una pregunta le contesta a veces la Liga.

⚠️ LO QUE YA SALIÓ NO CAMBIA: las publicaciones de antes de `V2_DESDE` se arman con la versión 1, igual que siempre.
Un comentario que alguien ya vio no cambia de texto ni de persona — y el 14/11 alguien ya le había contestado
«gracias» a uno. La versión 1 se puede borrar cuando la última de esas publicaciones salga del muro (`muro.DIAS`).

⚠️ DETERMINISTA: la misma publicación da los mismos comentarios en cada corrida (la semilla es su `id`), así el
muro no cambia solo y no gasta escrituras de KV. Los que tienen la hora en el futuro los esconde la página hasta
que llega. Todo lo que cuenta repeticiones va **por día**: si contara el muro entero, que la publicación más vieja
salga del muro cambiaría los comentarios de todas las demás.

🗣️ LA VERSIÓN 3 (17/11/2026, de los chats generales: bot/chats.py). Dlx: *«hacemos los comentarios más realistas y
vemos el comportamiento de cada uno»*, y a qué se aprende, *«Ambos»*:

- **la jerga de cada servidor**: quien comenta usa a veces las palabras que más usa la gente de SU servidor
  (`chats.JERGA`, una lista cerrada: nunca un insulto ni algo que alguien escribió), se ríe como se ríe ahí y pone sus
  emoji (`chats.SANOS`, sólo de reacción).
- **la voz de cada uno, SÓLO de quien dijo que sí**: sus palabras, su risa, sus emoji y si escribe en minúscula o
  gritando, medidos en su chat. Los demás siguen con el estilo que sale de su clave (`_estilo()`).
- ⚠️ DETERMINISTA IGUAL: una publicación del día D usa los días de chat D-15 a D-2 (`VENTANA`), que ya no cambian. Sin
  datos de los chats, la versión 2 tal cual (la huella `HUELLA_V2` del self-check). Lo de antes de `V3_DESDE`, también.

    python bot/comentarios_sim.py     el self-check
"""
import datetime as dt
import hashlib
import io
import json
import os
import random

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)

#: la copia de los permisos para correr sin red. ⚠️ GITIGNOREADA, como la de las fotos ocultas: quién dijo que no es
#: un dato de esa persona y no va al repo
COPIA = os.path.join(BASE, 'comun', 'fotos', 'cm_permisos.json')
CLAVE_KV = 'cm:permisos'

#: los personajes de la Liga (llevan la pastilla «Liga»): clave, nombre
PERSONAJES = [('eh', 'El Hype'), ('ul', 'ULAYA'), ('ej', 'El Jurado')]
#: 📣 LAS BARRAS DE CADA SERVIDOR (21/11/2026, Dlx: «sí» a los fans de la Liga, bots a la vista): en una publicación de
#: un servidor, la vez que habla la Liga es `P_BARRA` de las veces «La barra de <sigla>» (`b:<servidor>`, con la pastilla
#: «Liga», como los personajes). Sólo desde `BARRAS_DESDE`: un comentario que ya se vio no cambia
BARRAS_DESDE = '2026-11-21T11:00:00Z'
P_BARRA = 0.5
#: cuántas veces puede aparecer la misma persona el mismo día
POR_DIA = 2
#: quién cuenta como activo: jugó en los últimos días
ACTIVO_DIAS = 14

#: 🗣️ desde cuándo vale la versión 3 (la jerga y la voz de los chats generales): las 3 AM ET del 18/11/2026, cuando el
#: ciclo para. Lo de antes, con la 2
V3_DESDE = '2026-11-18T08:00:00Z'
#: qué días de chat usa una publicación del día D: de D-15 a D-2, ya cerrados (`chats.DIAS` los guarda 40 días)
VENTANA = (15, 2)
#: la chance de una palabra de la jerga: del servidor, o de la suya si dijo que sí y la tiene medida
P_JERGA, P_JERGA_VOZ = 0.28, 0.5
#: de la jerga de un servidor, sólo la que dijo al menos tanta gente (personas por día, sumadas) en al menos 2 días
JERGA_GENTE = 4
#: con cuántos mensajes en la ventana se mide la voz de alguien
VOZ_MSGS = 8
#: cómo se escribe cada risa (`chats.RISAS_RX`): cada uno elige una, siempre la misma
RISA_TXT = {'jaja': ['jaja', 'jajaja', 'jajajaja'], 'JAJA': ['JAJAJA', 'JAJAJAJA'], 'jsjs': ['jsjs', 'jsjsjs'],
            'jajsj': ['jajsj', 'jajsjsj'], 'xd': ['xd', 'xD', 'XD'], 'jeje': ['jeje', 'jejeje'], 'jiji': ['jiji'],
            'lol': ['lol'], 'kkk': ['kkkk']}

#: 🗓️ desde cuándo vale la versión 2: las 3 AM ET del 15/11/2026, cuando el ciclo para hasta las 11 (lo de antes, con
#: la 1). En el futuro al publicarla, así ninguna publicación cambia de versión después de haberse visto
V2_DESDE = '2026-11-15T08:00:00Z'


# ══ LA VERSIÓN 1 (hasta el 15/11/2026) ════════════════════════════════════
# ⚠️ No se toca: arma lo que ya se vio. Se borra entera cuando lo de antes de `V2_DESDE` salga del muro

#: cuántos comentarios como mucho por publicación, según qué es
CUANTOS_V1 = {'campeon': (2, 3), 'ligahito': (1, 3), 'caza': (1, 2), 'rango': (1, 2), 'pase': (0, 2), 'elegido': (1, 2),
              'premios': (1, 3), 'resnoche': (1, 2), 'anuncio': (1, 2), 'sobrevivio': (1, 2), 'mesaward': (1, 3)}
#: ⚠️ las cartas nuevas no: van en un grupo de a muchas y no llevan hilo en la página
#: en cuáles comenta también un personaje
CON_PERSONAJE_V1 = {'campeon', 'anuncio', 'resnoche', 'premios', 'caza', 'mesaward'}

# {q} el dueño de la publicación, {ev} el evento, {a} el cazado, {rg} el rango, {ln} la liga, {n} un número
GENTE_V1 = {
    'campeon': ['esa final estuvo pesadísima 🔥', '{q} vino con todo hoy', 'lo vi venir desde octavos',
                'la próxima {ev} los quiero ver contra nosotros 👀', 'qué nivel, felicidades {q}',
                'se lo merecía, venía entrenando fuerte', 'ese cierre en la final no lo vi venir',
                'nadie frena a {q} esta semana', 'me perdí la final, ¿alguien la grabó?', 'a esto le decimos nivel'],
    'ligahito': ['{q} se adueñó de {ln}', 'merecidísimo, la liga entera lo vio venir', 'qué temporada de {q} 🔥',
                 'el que quiera la corona de {ln} que la venga a buscar'],
    'caza': ['cazar a {a} no es para cualquiera', 'eso fue una cacería 🎯', '{a} va a querer revancha',
             'buen botín, {q}', 'la próxima cabeza grande es la tuya, ojo'],
    'rango': ['merecido, venía subiendo hace rato', 'rango {rg} y va por más', 'se nota el cambio, felicidades',
              'ahora a cuidar esa letra', 'subiendo como espuma 📈'],
    'pase': ['nivel {n} ya, qué ritmo', 'el Pase no se completa solo, bien ahí', 'voy atrás tuyo, espérame'],
    'elegido': ['la gente habló', 'buena elección, a ver si sobrevive 👀', 'esto se pone bueno'],
    'premios': ['bien merecido lo de {q}', 'semana de {q}, nadie discute', 'a ver quién se lo lleva la que viene'],
    'resnoche': ['qué noche, {n} eventos', 'me quedé con ganas de más', 'la de anoche estuvo buenísima'],
    'anuncio': ['me anoto', '¿alguien arma equipo conmigo?', 'ahí estaré', 'esta no me la pierdo',
                '¿a qué hora arranca de verdad?', 'vamos con todo hoy'],
    'tarjeta': ['qué buena quedó esa carta', 'la carta te queda bien', 'ya era hora de esa carta'],
    'sobrevivio': ['sobrevivir al Most Wanted tiene mérito', 'nadie lo pudo cazar', 'escurridizo 👀'],
    'precio': ['buen precio el de esa cabeza', 'cobró como corresponde'],
    'mesaward': ['bien merecido', 'el mes fue de {q}', 'nadie discute este premio'],
}
LIGA_V1 = {
    'campeon': ['{q} suma otro título. ¿Quién la frena?', 'Felicita al campeón: le llega al teléfono.',
                'Ya está la llave completa de {ev}: tócala arriba.'],
    'anuncio': ['Recuerda activar la campana para que te avise cuando arranque.',
                'Los que juegan esta suben puntos para la Temporada.', '¿Quién se anota primero?'],
    'resnoche': ['Noche movida en la Liga. Hoy hay más.', 'Los resultados ya están en el Ranking.'],
    'premios': ['Los premios de la semana ya están en el Salón.', 'La semana que viene, ¿quién?'],
    'caza': ['Cabeza cobrada. El Most Wanted se mueve.', 'Ojo: los buscados cambian cada semana.'],
    'mesaward': ['Los MES AWARDS se votan en la página.', 'Ya está en el Salón de la fama.'],
}


# ══ LA VERSIÓN 2 (desde el 15/11/2026) ════════════════════════════════════

#: cuántos según qué es: `(menos, más)`, y `_cuantos()` le suma según lo que trae adentro. ⚠️ Las cartas nuevas no:
#: van en un grupo de a muchas y no llevan hilo en la página. Las promos y los anuncios de la Liga tampoco: una promo
#: es pagada, y un anuncio de la Liga puede ser una sanción
CUANTOS = {'campeon': (2, 4), 'ligahito': (2, 4), 'mesaward': (2, 5), 'premios': (2, 4), 'resnoche': (2, 4),
           'caza': (1, 3), 'rango': (1, 3), 'elegido': (1, 3), 'sobrevivio': (1, 3), 'anuncio': (1, 3),
           'crewtier': (1, 3), 'pase': (1, 2), 'precio': (1, 2), 'flyer': (1, 2), 'sorteo': (1, 2),
           # 💬 el día fuerte de un chat (bot/chats.py): la polémica, con frases que no acusan a nadie
           'svchat': (1, 3), 'svchat_pol': (1, 2),
           # 🗞️ tanda 3 de los chats (21/11/2026): las historias con nombre
           'svchat_reto': (2, 4), 'svchat_cara': (1, 3), 'svchat_retiro': (2, 4), 'svchat_regreso': (2, 4),
           'svchat_elogio': (2, 4), 'svchat_favorito': (1, 3), 'svchat_raid': (1, 3)}
#: nunca más que esto en una publicación
TOPE = 6
#: en cuáles comenta también un personaje de la Liga, y con qué chance
CON_PERSONAJE = {'campeon', 'anuncio', 'resnoche', 'premios', 'caza', 'mesaward', 'ligahito', 'flyer'}
P_PERSONAJE = 0.45
#: la chance de que un comentario le conteste a uno de antes (desde el segundo)
P_RESPONDE = 0.38
#: la de que una palabra de su país arranque la frase, y la de una muletilla cualquiera
P_PAIS, P_MULETILLA = 0.14, 0.16

# {q} el dueño, {ev} el evento, {a} el cazado, {rg} la letra, {ln} la liga, {n} un número, {cr} la crew, {tn} su tier,
# {sv} el servidor. Una frase que pide un dato que la publicación no tiene no sale. Las que empiezan con «~» son de
# joda: ahí la persona puede reírse a su manera
GENTE = {
    'campeon': ['esa final estuvo pesadísima', '{q} vino con todo hoy', 'lo vi venir desde octavos',
                '~la próxima {ev} los quiero ver contra nosotros', 'qué nivel, felicidades {q}',
                'se lo merecía, venía entrenando fuerte', 'ese cierre en la final no lo vi venir',
                'nadie frena a {q} esta semana', '~me perdí la final, ¿alguien la grabó?', 'a esto le decimos nivel',
                'otro título para la colección de {q}', '~{q} ya se está acostumbrando a ganar',
                'qué rimas en la final, de otro planeta', 'la {ev} ya tiene dueño',
                '~yo le tenía fe desde que se inscribió', 'el flow de {q} en esa final fue otra cosa',
                'campeón merecido, sin discusión', '~ya quiero la revancha en la próxima', 'qué manera de cerrar la noche',
                'cada vez más fino {q}', '~mañana todos se quieren cruzar con {q}', '¿cuántos títulos lleva ya {q}?',
                'esa llave estaba durísima y la sacó igual', 'respeto total, {q}',
                '~a {q} hay que ponerle un jurado aparte', 'la técnica estuvo impecable', 'qué nivel tuvo la {ev}',
                'se notó la preparación', '~yo caí en octavos pero valió la pena verla', 'buenas batallas toda la noche'],
    'ligahito': ['{q} se adueñó de {ln}', 'merecidísimo, la liga entera lo vio venir', 'qué temporada de {q}',
                 'el que quiera la corona de {ln} que la venga a buscar', 'fecha tras fecha, {q} no aflojó',
                 '~{ln} ya tiene nombre y apellido', 'campeón de liga, eso es constancia', 'ganar una liga entera es otra cosa',
                 '~¿alguien le gana a {q} la próxima temporada?', 'la regularidad paga', 'se lo ganó jornada por jornada',
                 'qué liga se armó en {ln}'],
    'caza': ['cazar a {a} no es para cualquiera', 'eso fue una cacería', '{a} va a querer revancha',
             'buen botín, {q}', '~la próxima cabeza grande es la tuya, ojo', 'el Most Wanted se mueve',
             '~{a} ya está planeando la venganza', 'qué puntería, {q}', 'cabeza cobrada y con estilo',
             '~ahora el cazador es la presa', '¿quién sigue en la lista?', 'buena cacería, la semana viene picante'],
    'rango': ['merecido, venía subiendo hace rato', 'rango {rg} y va por más', 'se nota el cambio, felicidades',
              'ahora a cuidar esa letra', 'subiendo como espuma', '~la {rg} te queda chica',
              'el Competitivo no regala nada, bien ahí', 'esa subida se veía venir', 'subir de rango cuesta, felicidades',
              'con esa constancia se sube rápido', '~ahora todos te van a querer cruzar', 'letra nueva, nivel nuevo',
              'buen salto de rango', 'la {rg} se gana batalla por batalla'],
    'pase': ['nivel {n} ya, qué ritmo', 'el Pase no se completa solo, bien ahí', '~voy atrás tuyo, espérame',
             'qué rápido sube ese Pase', '~¿cómo haces para subir tan rápido?', 'nivel {n}, bien jugado',
             'constancia pura', '~yo sigo trabado en las diarias', 'ese Pase va volando', 'buen ritmo con las Tareas'],
    'elegido': ['la gente habló', 'buena elección, a ver si sobrevive', 'esto se pone bueno',
                '~ahora todos lo van a buscar', 'votado por la gente, eso pesa', '~que empiece la cacería',
                'a ver cuánto dura', 'interesante la elección'],
    'sobrevivio': ['sobrevivir al Most Wanted tiene mérito', 'nadie lo pudo cazar', 'escurridizo',
                   '~se les escapó a todos', 'una semana entera con la cabeza en juego', 'aguantó toda la semana',
                   '~la próxima no se salva', 'qué semana para aguantar'],
    'precio': ['buen precio el de esa cabeza', 'cobró como corresponde', '~ese botín va directo a la Tienda',
               'cabeza cobrada', '{q} sabe a quién cazar', 'buen negocio'],
    'premios': ['bien merecido lo de {q}', 'semana de {q}, nadie discute', 'a ver quién se lo lleva la que viene',
                '~la semana que viene es mía', 'premios justos', 'qué semana tuvo {q}', 'figura de la semana sin dudas',
                'se lo ganó en la tarima', '~ya estoy entrenando para la próxima', 'buena semana para la Liga'],
    'resnoche': ['qué noche, {n} eventos', 'me quedé con ganas de más', 'la de anoche estuvo buenísima',
                 'noche larga y buenísima', '~hoy quiero revancha', '~me dormí tarde por culpa de las llaves',
                 '{n} eventos en una noche, qué locura', 'buen nivel en todos los servidores', 'la Liga no para',
                 '~¿hoy de nuevo?'],
    'anuncio': ['me anoto', '~¿alguien arma equipo conmigo?', 'ahí estaré', 'esta no me la pierdo',
                '~¿a qué hora arranca de verdad?', 'vamos con todo hoy', 'listo para {ev}', 'esta pinta buena',
                '~hoy sí la gano', 'calentando la voz para {ev}', '~¿quién más va?', 'nos vemos en la llave',
                'ya me inscribí', '~a ver quién me toca en octavos', 'que se arme una buena llave', 'confirmado, voy',
                'nos vemos en {sv}'],
    'flyer': ['qué buen flyer', 'esa fecha de {ln} pinta buena', '~ya quiero ver esas batallas', '{ln} viene fuerte',
              'buenos cruces esta fecha', '~¿a qué hora es?', 'ahí estaré mirando', 'se viene buena jornada'],
    'sorteo': ['qué suerte, {q}', '~la próxima me toca a mí', 'bien ahí con el sorteo', '~yo nunca gano nada',
               'felicidades por el premio', 'la suerte también juega'],
    'crewtier': ['{cr} sube de tier, bien ahí', 'esa crew viene fuerte', 'buen trabajo en equipo', '~¿quién para a {cr}?',
                 'se nota el esfuerzo de la crew', '{cr} ya está en {tn}', 'a seguir sumando', 'crew en ascenso'],
    'mesaward': ['bien merecido', 'el mes fue de {q}', 'nadie discute este premio', '~el mes que viene voy por ese premio',
                 'qué mes tuvo {q}', 'premio justo', 'se lo ganó todo el mes', 'un mes entero de nivel',
                 '~voté por {q} y gané', 'merecidísimo'],
}
#: los cortos de festejo, para cualquier logro de alguien
# 💬 el día fuerte de un chat. ⚠️ La polémica no acusa ni toma partido: nadie dice quién tiene razón
GENTE['svchat'] = ['el chat de {sv} no paraba', '{m} mensajes, qué locura', 'yo estuve ahí, estuvo movidísimo',
                   '~me fui un rato y volví a 300 mensajes', 'así da gusto el chat de {sv}', '¿qué pasó que se prendió así?',
                   '~el chat más vivo que el evento', 'esto es la Liga', 'mañana otra vez', '~necesito un resumen urgente']
# 🗞️ las historias con nombre (tanda 3). ⚠️ Nadie toma partido ni insulta: se festeja, se pide la batalla, se despide
GENTE['svchat_reto'] = ['que se dé esa batalla', 'yo pago por ver eso', '~{q} contra {b}, ya quiero verla', 'esa la quiero en vivo',
                        '~¿cuándo y dónde?', 'que la organicen ya', '~esto se pone bueno', '~ahora le toca responder a {b}']
GENTE['svchat_cara'] = ['esos dos no paraban de contestarse', 'que lo arreglen en la llave', '~ya quiero verlos en una batalla',
                        'el chat estaba que ardía', '~{q} y {b}, la batalla que todos quieren']
GENTE['svchat_retiro'] = ['no te vayas, {q}', '~nooo, ¿en serio?', 'gracias por todo, {q}', '~seguro vuelve', 'va a hacer falta',
                          'que sea un hasta luego']
GENTE['svchat_regreso'] = ['volvió {q}', '~bienvenido de vuelta', 'se viene algo grande', 'la liga lo extrañaba',
                           '~a ver si vuelve con el mismo nivel', '~{q} volvió, cuidado']
GENTE['svchat_elogio'] = ['merecido, {q}', 'todos hablando de {q}', 'qué nivel', 'nadie lo discute', '~{q} se lo ganó',
                          'el chat no miente']
GENTE['svchat_favorito'] = ['yo también voy con {q}', '~no sé, yo veo a otro', 'favorito no es campeón', '~{q} tiene todo para ganarla',
                            'veremos en la llave']
# 🚨 el raid (tanda 4): nadie nombra a nadie (quien manda el spam suele ser una cuenta robada)
GENTE['svchat_raid'] = ['no toquen ningún link', '~¿otra vez?', 'baneen a esos bots', '~justo cuando estaba bueno el chat',
                        'reporten esas cuentas', '~cuidado con el nitro gratis', 'qué ganas de molestar']
GENTE['svchat_pol'] = ['¿qué pasó anoche en {sv}?', '~me perdí todo, alguien que me explique', 'tranquilos todos',
                       'que lo vea el staff y listo', '~yo sólo vine por las batallas', 'ojalá se arregle']

GENERICO = ['tremendo', 'grande', 'qué nivel', 'GG', 'merecido', 'eso', 'imparable', 'bestial', 'crack', 'brutal',
            'enorme', 'se viene se viene', 'qué bien', 'felicidades', 'bien ahí', 'nivelazo']
#: dónde entran los de festejo, y en qué proporción
P_GENERICO = 0.3
CON_GENERICO = {'campeon', 'ligahito', 'caza', 'rango', 'pase', 'premios', 'sobrevivio', 'mesaward', 'crewtier',
                'sorteo', 'precio'}

#: a quién le contesta: `'?'` si lo de antes es una pregunta, `''` si no. Por tipo y para todos (`'*'`)
RESPUESTA = {
    'campeon': {'?': ['está en la llave, arriba', 'yo la vi, estuvo buenísima', 'búscala en el canal del servidor',
                      'la tengo grabada, después la paso'],
                '': ['~tal cual', 'x2', 'eso mismo dije yo', '~nah, la próxima gana otro', 'pienso igual', 'confirmo',
                     '~ya veremos en la revancha', 'la final fue lo mejor de la noche']},
    'anuncio': {'?': ['yo me sumo', '~cuenta conmigo', 'a la hora del anuncio, mira la cuenta atrás',
                      'ahí te veo', 'yo voy'],
                '': ['~yo también', 'nos vemos ahí', '~a ver si nos toca juntos', 'vamos', 'x2']},
    '*': {'?': ['buena pregunta', '~yo tampoco sé', 'creo que sí', 'mira la página, ahí sale'],
          '': ['~tal cual', 'x2', 'literal', 'pienso igual', 'la verdad sí', 'confirmo', 'eso', '~jamás pensé decir esto, pero sí']},
}
# 💬 y en una polémica, contestar tampoco toma partido
RESPUESTA['svchat_pol'] = {'?': ['ni idea, recién llego', 'yo tampoco entendí nada'], '': ['x2', 'eso', 'tal cual']}
#: lo que dice un personaje de la Liga: suelto, o contestando una pregunta (`?`)
LIGA = {
    'campeon': ['{q} suma otro título. ¿Quién la frena?', 'Felicita al campeón: le llega al teléfono.',
                'Ya está la llave completa de {ev}: tócala arriba.', 'Campeón nuevo en {sv}. ¿Quién va por la revancha?',
                'Esa final ya está en el Ranking.'],
    'anuncio': ['Recuerda activar la campana para que te avise cuando arranque.',
                'Los que juegan esta suben puntos para la Temporada.', '¿Quién se anota primero?',
                'Se juega en {sv}: la llave sale en vivo en la página.', 'La cuenta atrás está en Eventos.'],
    'resnoche': ['Noche movida en la Liga. Hoy hay más.', 'Los resultados ya están en el Ranking.',
                 'Mira quién subió de puesto en el Ranking.'],
    'premios': ['Los premios de la semana ya están en el Salón.', 'La semana que viene, ¿quién?',
                'Se cierra cada lunes: todavía hay tiempo.'],
    'caza': ['Cabeza cobrada. El Most Wanted se mueve.', 'Ojo: los buscados cambian cada semana.',
             'Quedan buscados libres esta semana.'],
    'mesaward': ['Los MES AWARDS se votan en la página.', 'Ya está en el Salón de la fama.'],
    'ligahito': ['{q}, campeón de {ln}. Ya está en el Salón.', 'La próxima temporada de {ln} arranca de cero.'],
    'flyer': ['La fecha de {ln} se sigue en vivo en la página.', 'Sus batallas suman a tus duelos.'],
    '?': ['Está en la página: tócala arriba.', 'Lo ves en vivo en la página, con la llave.',
          'Todo sale en Eventos, con la cuenta atrás.'],
}
#: con qué emoji puede cerrar cada uno, según qué es
EMOJI = {'campeon': ['🔥', '👑', '🏆', '👏', '💪'], 'ligahito': ['👑', '🏆', '🔥'], 'caza': ['🎯', '👀', '🔥'],
         'rango': ['📈', '🔥', '💪'], 'pase': ['📈', '💪', '🔥'], 'elegido': ['👀', '🎯'], 'sobrevivio': ['👀', '🔥'],
         'precio': ['💰', '🎯'], 'premios': ['🏅', '👏', '🔥'], 'resnoche': ['🌙', '🔥', '🎤'],
         'anuncio': ['🎤', '🔥', '💪', '🙌'], 'flyer': ['👀', '🔥', '🎤'], 'sorteo': ['🍀', '🎉'],
         'crewtier': ['💪', '🔥', '🛡️'], 'mesaward': ['🏆', '👑', '👏'], 'svchat': ['🔥', '👀', '💬'], 'svchat_pol': ['👀'], 'svchat_raid': ['🚨', '👀'],
         'svchat_reto': ['👀', '🔥', '🎤'], 'svchat_cara': ['👀', '😳'], 'svchat_retiro': ['😭', '🙏', '👏'], 'svchat_regreso': ['🔥', '👀', '💪'],
         'svchat_elogio': ['👏', '🔥', '👑'], 'svchat_favorito': ['👀', '🎯']}
#: cómo se ríe cada uno
RISAS = ['jaja', 'jajaja', 'jsjs', 'jajsj', 'xd', 'JAJAJA', 'jajajaja']
#: con qué puede arrancar cualquiera
MULETILLAS = ['uff', 'nooo', 'bueno', 'ojo', 'wow', 'oye', 'uy', 'ya', 'aah', 'eso', 'mira']
#: y una palabra de su país, de vez en cuando (sólo lo que se entiende en toda la Liga, y nada de voseo)
DE_PAIS = {'mx': ['no manches', 'qué onda'], 'co': ['parce', 'uy parce'], 'pe': ['causa', 'asu'],
           've': ['chamo', 'epa'], 'ar': ['che', 'uh'], 'cl': ['oye', 'pucha'], 'uy': ['bo', 'che'],
           'ec': ['ñaño'], 'es': ['tío', 'madre mía']}


def _norm(s):
    import unicodedata
    s = unicodedata.normalize('NFKD', str(s or ''))
    return ''.join(c for c in s if c.isalnum()).lower()


def _de_iso(s):
    try:
        return dt.datetime.fromisoformat(str(s).replace('Z', '+00:00'))
    except (TypeError, ValueError):
        return None


def _iso(t):
    return t.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def permisos(s=None):
    """`{'si': set(claves), 'no': set(claves)}`. Con `s` (una sesión de Cloudflare) se lee KV y se guarda la copia; sin
    `s`, la copia. ⚠️ SIN COPIA Y SIN KV, NADIE: todos «sin preguntar», o sea con la etiqueta. Es lo seguro."""
    d = None
    if s is not None:
        try:
            import subir_datos as SD
            r = s.get('%s/values/%s' % (SD.API, CLAVE_KV), timeout=30)
            if r.status_code == 404:
                d = {}
            elif r.status_code == 200:
                d = r.json() or {}
            if d is not None:
                os.makedirs(os.path.dirname(COPIA), exist_ok=True)
                with io.open(COPIA, 'w', encoding='utf-8') as f:
                    json.dump({'si': sorted(d.get('si') or []), 'no': sorted(d.get('no') or [])}, f)
        except Exception:                                # noqa: BLE001
            d = None
    if d is None:
        try:
            with io.open(COPIA, encoding='utf-8') as f:
                d = json.load(f) or {}
        except (OSError, ValueError):
            d = {}
    return {'si': {str(k) for k in d.get('si') or []}, 'no': {str(k) for k in d.get('no') or []}}


def _participantes(llaves):
    """`{número de llave: {nombres normalizados}}`: quien jugó cada evento."""
    out = {}
    for num, ll in (llaves or {}).items():
        ns = set()
        for r in (ll or {}).get('rondas') or []:
            for b in r.get('b') or []:
                for n in (b[0] if b and isinstance(b[0], list) else []):
                    ns.add(_norm(n))
        try:
            out[int(num)] = ns
        except (TypeError, ValueError):
            pass
    return out


def _quien_a(x):
    q = [str(n) for n in (x.get('quien') or [])]
    if x.get('tipo') == 'premios' and x.get('figura'):
        q = [str(x['figura'][0])]
    return q


def _relleno(x):
    q = _quien_a(x)
    n = x.get('nivel') or x.get('eventos') or x.get('votos') or ''
    return {'q': (q[0] if q else '').strip(), 'ev': str(x.get('ev') or '').strip(), 'a': str(x.get('a') or '').strip(),
            'rg': str(x.get('rg') or ''), 'ln': str(x.get('ln') or 'la liga'), 'n': str(n)}


def _frase(lista, x, rng, usadas):
    """⚠️ De la versión 1: no se toca."""
    r = _relleno(x)
    ok = []
    for f in lista:
        # una frase que pide un dato que esta publicación no tiene no sale
        if any('{%s}' % c in f and not r[c] for c in r):
            continue
        if f in usadas:
            continue
        ok.append(f)
    if not ok:
        return ''
    f = rng.choice(ok)
    usadas.add(f)
    return f.format(**r)


def _cms_v1(x, tipo, t0, rng, cands, pesos, perm, por_dia, dia):
    """Los de una publicación con la versión 1, tal cual se armaban hasta el 15/11/2026."""
    lo, hi = CUANTOS_V1[tipo]
    cuantos = rng.randint(lo, hi)
    if not cuantos:
        return []
    cms, usadas = [], set()
    personaje = tipo in CON_PERSONAJE_V1 and rng.random() < 0.4
    t = t0
    for j in range(cuantos):
        t = t + dt.timedelta(minutes=rng.randint(12, 90) if j == 0 else rng.randint(30, 300))
        if personaje and j == cuantos - 1:
            pk, pn = PERSONAJES[rng.randrange(len(PERSONAJES))]
            tx = _frase(LIGA_V1.get(tipo) or [], x, rng, usadas)
            if tx:
                cms.append([j, pk, pn, tx, _iso(t), 'l'])
            continue
        if not cands:
            break
        f = rng.choices(cands, weights=pesos, k=1)[0]
        ix = cands.index(f)
        cands.pop(ix)
        pesos.pop(ix)
        tx = _frase(GENTE_V1.get(tipo) or [], x, rng, usadas)
        if not tx:
            continue
        por_dia[(dia, f['k'])] = por_dia.get((dia, f['k']), 0) + 1
        cms.append([j, f['k'], f['n'], tx, _iso(t), '' if f['k'] in perm['si'] else 's'])
    return [[n] + c[1:] for n, c in enumerate(cms)]


# ── la versión 2 ─────────────────────────────────────────────────────────
_SIGLAS = None


def _sigla(sv):
    """La sigla que se lee de un servidor (`datos/servidores.json`): «SR» se lee «SNK», «ACAD» se lee «LCW»."""
    global _SIGLAS
    if _SIGLAS is None:
        try:
            with io.open(os.path.join(BASE, 'datos', 'servidores.json'), encoding='utf-8') as f:
                _SIGLAS = {k: (v or {}).get('sigla') or k for k, v in (json.load(f).get('servidores') or {}).items()}
        except (OSError, ValueError, AttributeError):
            _SIGLAS = {}
    return _SIGLAS.get(sv, sv)


def _relleno2(x):
    r = _relleno(x)
    r['ln'] = str(x.get('ln') or '').strip()
    r['cr'] = str(x.get('nombre') or '').strip() if x.get('tipo') == 'crewtier' else ''
    r['tn'] = str(x.get('tn') or '').strip()
    r['sv'] = _sigla(str(x.get('sv') or '').strip())
    if x.get('tipo') == 'svchat':
        r['m'] = str(x.get('msgs') or '')
        # 🗞️ el segundo nombre de un reto o un cara a cara
        q = _quien_a(x)
        r['b'] = q[1].strip() if len(q) > 1 else ''
    return r


def _cuantos(x, tipo, rng):
    """🎚️ Cuántos comentarios, según lo que trae la publicación: una final con más gente, una noche con más eventos, una
    letra alta o un nivel redondo del Pase traen más. Y no parejo: a veces pocos y a veces muchos."""
    lo, hi = CUANTOS[tipo]
    mas = 0
    if tipo == 'campeon':
        mas = min(2, int(x.get('part') or 0) // 12)
    elif tipo == 'resnoche':
        mas = min(2, int(x.get('eventos') or 0) // 3)
    elif tipo == 'rango':
        mas = 1 if str(x.get('rg') or '').startswith('S') else 0
    elif tipo == 'pase':
        try:
            mas = 1 if int(x.get('nivel') or 0) % 10 == 0 else 0
        except (TypeError, ValueError):
            mas = 0
    elif tipo == 'premios':
        mas = 1 if sum(1 for c in ('figura', 'revelacion', 'cazador', 'servidor') if x.get(c)) >= 3 else 0
    hi += mas
    n = int(round(rng.triangular(lo - 0.49, hi + 0.49, (lo + hi) / 2)))
    return max(lo, min(TOPE, hi, n))


def _estilo(k):
    """✍️ Cómo escribe cada uno, siempre igual: sale de su clave, no de la publicación."""
    h = int(hashlib.sha256(('estilo:' + str(k)).encode()).hexdigest()[:12], 16)
    return {'minus': h % 3 != 0,                       # dos de cada tres, todo en minúscula
            'emoji': (0.0, 0.25, 0.5, 0.85)[(h >> 2) % 4],   # cuánto cierra con un emoji
            'risa': RISAS[(h >> 4) % len(RISAS)],
            'grita': (h >> 8) % 6 == 0,                # uno de cada seis escribe lo corto en mayúsculas
            'signos': ('', '', '!!', '...')[(h >> 11) % 4]}


def _pesada(pares, rng):
    """Una de `[(cosa, peso)]`, por su peso."""
    return rng.choices([a for a, _ in pares], weights=[max(1, b) for _, b in pares], k=1)[0]


def _dia_menos(dia, n):
    return (dt.date.fromisoformat(dia) - dt.timedelta(days=n)).isoformat()


def _voces(chats, dia, cache):
    """🗣️ `{'sv': {sv: {jerga, risa, emoji}}, 'voz': {clave: {...}}}` de los días de chat de la `VENTANA` de una
    publicación del día `dia`: la jerga que usa la gente de cada servidor y la voz de quien dijo que sí."""
    if dia in cache:
        return cache[dia]
    import chats as CH
    desde, hasta = _dia_menos(dia, VENTANA[0]), _dia_menos(dia, VENTANA[1])
    svs, voz = {}, {}
    for d, por in sorted(((chats or {}).get('dias') or {}).items()):
        if not (desde <= d <= hasta):
            continue
        for sv, x in sorted((por or {}).items()):
            s = svs.setdefault(sv, {'j': {}, 'jd': {}, 'r': {}, 'e': {}})
            for j, n in (x.get('jerga') or {}).items():
                if j in CH.JERGA:
                    s['j'][j] = s['j'].get(j, 0) + n
                    s['jd'][j] = s['jd'].get(j, 0) + 1
            for c, de in (('r', 'risa'), ('e', 'emoji')):
                for k, n in (x.get(de) or {}).items():
                    if c == 'r' and k not in RISA_TXT or c == 'e' and k not in CH.SANOS:
                        continue
                    s[c][k] = s[c].get(k, 0) + n
            for k, v in (x.get('voz') or {}).items():
                w = voz.setdefault(k, {'m': 0, 'mi': 0, 'ma': 0, 'j': {}, 'r': {}, 'e': {}})
                for c in ('m', 'mi', 'ma'):
                    w[c] += int(v.get(c) or 0)
                for c in ('j', 'r', 'e'):
                    for kk, n in (v.get(c) or {}).items():
                        w[c][kk] = w[c].get(kk, 0) + n
    top = lambda d, n: sorted(d.items(), key=lambda kv: (-kv[1], kv[0]))[:n]  # noqa: E731
    out = {'sv': {}, 'voz': {}}
    for sv, s in svs.items():
        out['sv'][sv] = {'jerga': [(j, n) for j, n in top(s['j'], 30) if n >= JERGA_GENTE and s['jd'][j] >= 2][:12],
                         'risa': top(s['r'], 4), 'emoji': top(s['e'], 5)}
    for k, w in voz.items():
        if w['m'] < VOZ_MSGS:
            continue
        out['voz'][k] = {'minus': w['mi'] / w['m'] >= 0.6, 'grita': w['ma'] / w['m'] >= 0.3,
                         'risa': [(r, n) for r, n in top(w['r'], 2) if r in RISA_TXT],
                         'emoji': [(e, n) for e, n in top(w['e'], 3) if e in CH.SANOS],
                         'jerga': [(j, n) for j, n in top(w['j'], 5) if j in CH.JERGA and n >= 2]}
    cache[dia] = out
    return out


def _hash_de(k, que):
    return random.Random(int(hashlib.sha256((que + ':' + str(k)).encode()).hexdigest()[:12], 16))


def _estilo3(k, sv, v3, si):
    """✍️ El estilo de la versión 3: el de su clave, con la risa y la jerga de su servidor; y si dijo que sí y su voz
    está medida, la suya. Siempre igual para la misma persona y la misma ventana."""
    est = dict(_estilo(k))
    s = v3['sv'].get(sv) or {}
    v = v3['voz'].get(k) if k in si else None
    if v:
        est['minus'] = v['minus']
        est['grita'] = v['grita']
    risas = (v and v['risa']) or s.get('risa')
    if risas:
        fam = _pesada(risas, _hash_de(k, 'risa3'))
        est['risa'] = _hash_de(k, 'risa3t').choice(RISA_TXT[fam])
    est['jerga'] = (v and v['jerga']) or []
    est['svj'] = s.get('jerga') or []
    est['emojis'] = (v and v['emoji']) or s.get('emoji') or []
    return est


def _armar(base, r, est, tipo, cc, rng, contesta=False, v3=False):
    """La frase como la escribiría esa persona. Una respuesta no arranca con muletilla: «oye, x2» no se dice."""
    joda = base.startswith('~')
    f = base.lstrip('~')
    corta = len(f) <= 14 and '{' not in f
    # 🗣️ versión 3: a veces una palabra de la jerga (la suya, o la de su servidor), adelante, atrás o sola
    cola = ''
    jerga = v3 and not f.startswith('¿') and (est.get('jerga') or est.get('svj'))
    if jerga and rng.random() < (P_JERGA_VOZ if est.get('jerga') else P_JERGA):
        import chats as CH
        j = _pesada(est.get('jerga') or est['svj'], rng)
        txt, donde = CH.MOSTRAR.get(j, j), CH.JERGA[j]
        if 's' in donde and (corta or 'a' not in donde and 'd' not in donde):
            f = txt if corta and rng.random() < 0.5 else txt + ', ' + f
        elif 'a' in donde and not contesta and ('d' not in donde or rng.random() < 0.5):
            f = txt + ', ' + f
        elif 'd' in donde:
            cola = ' ' + txt
        else:
            f = txt + ', ' + f
    # la muletilla o la palabra de su país, sólo delante de lo que no es una pregunta
    elif not f.startswith('¿'):
        u = rng.random()
        if u < P_PAIS and DE_PAIS.get(cc):
            f = rng.choice(DE_PAIS[cc]) + ', ' + f
        elif u < P_PAIS + P_MULETILLA and len(f) > 12 and not contesta:
            f = rng.choice(MULETILLAS) + ', ' + f
    if est['minus']:
        f = f.lower()
    else:
        f = f[:1].upper() + f[1:]
    if est['grita'] and corta:
        f = f.upper()
    tx = f.format(**r) + cola
    if joda and rng.random() < 0.6:
        tx += ' ' + est['risa']
    elif est['signos'] and not tx.endswith('?') and rng.random() < 0.5:
        tx += est['signos']
    if rng.random() < est['emoji'] and EMOJI.get(tipo):
        # 🗣️ versión 3: la mitad de las veces, un emoji de los que se usan en su servidor (o de los suyos)
        if v3 and est.get('emojis') and rng.random() < 0.5:
            tx += ' ' + _pesada(est['emojis'], rng)
        else:
            tx += ' ' + rng.choice(EMOJI[tipo])
    return tx


def _elegir(lista, r, rng, usadas, del_dia):
    """Una frase que la publicación pueda llenar, que no se haya dicho acá y, si hay otra, tampoco hoy."""
    ok = [f for f in lista if not any('{%s}' % c in f and not r[c] for c in r) and f not in usadas]
    if not ok:
        return ''
    frescas = [f for f in ok if f not in del_dia]
    f = rng.choice(frescas or ok)
    usadas.add(f)
    del_dia.add(f)
    return f


_SIGLAS = None


def _barra(sv):
    """`('b:<servidor>', 'La barra de <sigla>')`, con la sigla que la página muestra (ACAD es LCW, SR es SNK)"""
    global _SIGLAS
    if _SIGLAS is None:
        try:
            with io.open(os.path.join(BASE, 'datos', 'servidores.json'), encoding='utf-8') as f:
                d = json.load(f)
            _SIGLAS = {k: (v or {}).get('sigla') or k for k, v in ((d.get('servidores') or d) if isinstance(d, dict) else {}).items()}
        except (OSError, ValueError):
            _SIGLAS = {}
    return ('b:' + sv, 'La barra de ' + str(_SIGLAS.get(sv) or sv))


def _cms_v2(x, tipo, t0, rng, cands, pesos, perm, por_dia, dia, frases_dia, paises, v3=None, svs=None, barra=None):
    cuantos = _cuantos(x, tipo, rng)
    r = _relleno2(x)
    usadas = set()
    del_dia = frases_dia.setdefault(dia, set())
    # 🎙️ el personaje va ADEMÁS de la gente, no en su lugar: con uno solo, la publicación quedaba con la Liga hablando sola
    personaje = tipo in CON_PERSONAJE and rng.random() < P_PERSONAJE
    total = min(TOPE, cuantos + (1 if personaje else 0))
    hecho_pj = False
    cms = []
    # 🕐 un anuncio se comenta antes de que arranque (la publicación sale una hora antes); lo demás, después
    t = t0 - dt.timedelta(minutes=rng.randint(30, 55)) if tipo == 'anuncio' else t0
    for j in range(total):
        gente = [c for c in cms if c[5] != 'l']
        # 💬 a veces le contesta a uno de antes; si era una pregunta, a veces contesta la Liga
        resp = None
        if gente and rng.random() < P_RESPONDE:
            resp = rng.choice(gente)
        ultima = personaje and not hecho_pj and j == total - 1 and gente
        if (ultima or (resp is not None and personaje and not hecho_pj and resp[3].endswith('?') and rng.random() < 0.5)):
            if resp is not None and resp[3].endswith('?'):
                tx = _elegir(LIGA['?'], r, rng, usadas, set())
            else:
                tx = _elegir(LIGA.get(tipo) or [], r, rng, usadas, set())
                resp = None
            if tx:
                t = t + dt.timedelta(minutes=rng.randint(4, 40) if resp is not None else rng.randint(20, 180))
                # 📣 en una publicación de un servidor, a veces habla su barra (sólo desde `BARRAS_DESDE`: `barra`)
                pk, pn = barra if barra and rng.random() < P_BARRA else PERSONAJES[rng.randrange(len(PERSONAJES))]
                cms.append([len(cms), pk, pn, tx.format(**r), _iso(t), 'l', resp[0] if resp is not None else None])
                hecho_pj = True
                continue
        if not cands:
            break
        f = rng.choices(cands, weights=pesos, k=1)[0]
        ix = cands.index(f)
        cands.pop(ix)
        pesos.pop(ix)
        if resp is not None:
            banco = RESPUESTA.get(tipo) or RESPUESTA['*']
            base = _elegir(banco['?' if resp[3].endswith('?') else ''], r, rng, usadas, set())
            t = t + dt.timedelta(minutes=rng.randint(3, 45))
        else:
            lista = GENTE.get(tipo) or []
            if tipo in CON_GENERICO and rng.random() < P_GENERICO:
                lista = GENERICO
            base = _elegir(lista, r, rng, usadas, del_dia) or _elegir(GENTE.get(tipo) or [], r, rng, usadas, del_dia)
            t = t + dt.timedelta(minutes=rng.randint(8, 120) if not cms else rng.randint(15, 240))
        if not base:
            continue
        est = _estilo3(f['k'], (svs or {}).get(f['k'], ''), v3, perm['si']) if v3 else _estilo(f['k'])
        tx = _armar(base, r, est, tipo, paises.get(f['k'], ''), rng, resp is not None, bool(v3))
        por_dia[(dia, f['k'])] = por_dia.get((dia, f['k']), 0) + 1
        cms.append([len(cms), f['k'], f['n'], tx, _iso(t), '' if f['k'] in perm['si'] else 's',
                    resp[0] if resp is not None else None])
    # ⚠️ el séptimo valor sólo si contesta: los que no, quedan con seis, como en la versión 1
    return [c if c[6] is not None else c[:6] for c in cms]


def poner(items, tabla, perm=None, ahora=None, llaves=None, ocultas=None, chats=None, barras=True):
    """Le pone a cada publicación sus comentarios simulados (`cm`): `[[i, clave, nombre, texto, hora, etiqueta, a
    quién le contesta]]`, con la etiqueta `''` (dijo que sí), `'s'` (simulado: sin preguntar) o `'l'` (personaje de la
    Liga), y el último valor sólo si le contesta a otro (su `i`). Devuelve la lista nueva; no toca la de entrada."""
    perm = perm or {'si': set(), 'no': set()}
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    ocultas = {_norm(n) for n in (ocultas or [])}
    jugaron = _participantes(llaves)
    gente = [f for f in tabla or [] if f.get('k') and f.get('av') and f.get('ult') and f['k'] not in perm['no']
             and _norm(f.get('n')) not in ocultas]
    paises = {f['k']: str(f.get('cc') or '') for f in gente}
    svs = {f['k']: str(f.get('sv') or '') for f in gente}
    v2 = _de_iso(V2_DESDE)
    v3_desde = _de_iso(V3_DESDE)
    barras_desde = _de_iso(BARRAS_DESDE) if barras else None
    hay_chats = bool(isinstance(chats, dict) and isinstance(chats.get('dias'), dict) and chats['dias'])
    voces = {}
    por_dia, frases_dia = {}, {}
    out = []
    # de la más vieja a la más nueva, así el tope por día no cambia cuando entra una publicación nueva
    orden = sorted(range(len(items)), key=lambda i: str(items[i].get('t') or ''))
    nuevos = {}
    for i in orden:
        x = items[i]
        tipo = x.get('tipo')
        t0 = _de_iso(x.get('t'))
        if not t0 or not x.get('id'):
            continue
        vieja = t0 < v2
        if tipo not in (CUANTOS_V1 if vieja else CUANTOS):
            continue
        rng = random.Random(int(hashlib.sha256(('cm:' + x['id']).encode()).hexdigest()[:12], 16))
        fuera = {k for k in (x.get('ks') or []) if isinstance(x.get('ks'), list) and k}
        if isinstance(x.get('ks'), dict):
            fuera |= set(x['ks'].values())
        nombres_fuera = {_norm(n) for n in _quien_a(x)} | {_norm(n) for n in x.get('podio') or []}
        if x.get('ll') in jugaron:
            nombres_fuera |= jugaron[x['ll']]
        if x.get('a'):
            nombres_fuera.add(_norm(x['a']))
        dia = t0.strftime('%Y-%m-%d')
        # ⚠️ ACTIVO CONTRA LA FECHA DE LA PUBLICACIÓN, no contra hoy: contra hoy, los comentarios de una publicación
        # vieja cambiarían de un día para el otro. `ult` sólo avanza, así que quien entró no sale
        desde = (t0 - dt.timedelta(days=ACTIVO_DIAS)).strftime('%Y-%m-%d')
        cands = [f for f in gente if str(f['ult'][0]) >= desde and f['k'] not in fuera
                 and _norm(f.get('n')) not in nombres_fuera and por_dia.get((dia, f['k']), 0) < POR_DIA]
        # 🎯 primero los de su mismo servidor, y los que más juegan
        sv = x.get('sv')
        pesos = [(3 if sv and f.get('sv') == sv else 1) * (1 + min(int(f.get('ev') or 0), 60) / 20) for f in cands]
        if vieja:
            cms = _cms_v1(x, tipo, t0, rng, cands, pesos, perm, por_dia, dia)
        else:
            # 🗣️ la versión 3 sólo con los chats, y sólo desde su arranque: si no, la 2 tal cual
            v3 = _voces(chats, dia, voces) if hay_chats and t0 >= v3_desde else None
            # 🗞️ cada historia del chat con sus frases (tanda 3); las que no tienen, las del día fuerte
            tg = (('svchat_pol' if x.get('que') == 'polemica' else 'svchat_' + str(x.get('que')) if 'svchat_' + str(x.get('que')) in GENTE
                   else 'svchat') if tipo == 'svchat' else tipo)
            cms = _cms_v2(x, tg, t0, rng, cands, pesos, perm, por_dia, dia, frases_dia, paises, v3, svs,
                          _barra(sv) if sv and barras_desde and t0 >= barras_desde else None)
        if cms:
            nuevos[i] = cms
    for i, x in enumerate(items):
        if i in nuevos:
            y = dict(x)
            y['cm'] = nuevos[i]
            out.append(y)
        else:
            out.append(x)
    return out


# ── self-check ───────────────────────────────────────────────────────────
def _self_check():
    print('\n══ LOS COMENTARIOS SIMULADOS ══\n')
    fallas = 0

    def ok(c, m):
        nonlocal fallas
        print(('   ✓ ' if c else '   🔴 ') + m)
        fallas += 0 if c else 1

    ahora = dt.datetime(2026, 11, 12, 12, tzinfo=dt.timezone.utc)
    tabla = [{'n': n, 'k': n.lower(), 'av': '1/a', 'sv': 'FFA' if i % 2 else 'DDF', 'ev': 10 + i, 'cc': ('ar', 'mx', 'co')[i % 3],
              'ult': ['2026-11-10', 'Octavos']} for i, n in enumerate(
        ['Oasis', 'Makmah', 'Snow', 'Panchok', 'Erian', 'Verc', 'Tam', 'Kminant', 'Agus', 'Vandu'])]
    tabla.append({'n': 'Viejo', 'k': 'viejo', 'av': '1/a', 'sv': 'FFA', 'ev': 50, 'ult': ['2026-09-01', 'Final']})
    tabla.append({'n': 'SinFoto', 'k': 'sinfoto', 'av': '', 'sv': 'FFA', 'ev': 50, 'ult': ['2026-11-11', 'Final']})
    items = [{'tipo': 'campeon', 'id': '%012x' % i, 't': '2026-11-%02dT04:00:00Z' % (2 + i % 9), 'quien': ['Tam'],
              'ks': ['tam'], 'ev': 'COPA %d' % i, 'sv': 'FFA', 'll': 900 + i} for i in range(30)]
    items += [{'tipo': 'anuncio', 'id': 'a%011x' % i, 't': '2026-11-11T20:00:00Z', 'ev': 'VOL %d' % i, 'sv': 'FFA'}
              for i in range(5)]
    llaves = {str(900 + i): {'rondas': [{'b': [[['Tam', 'Kminant'], 'Tam', '']]}]} for i in range(30)}
    perm = {'si': {'oasis'}, 'no': {'makmah'}}

    # 🔒 la versión 1 da lo mismo que antes: la huella de lo que armaba el 14/11/2026 sobre esta misma entrada
    a = poner(items, tabla, perm, ahora, llaves, ocultas=['Agus'])
    huella = hashlib.sha256(json.dumps([x.get('cm') for x in a], ensure_ascii=False).encode()).hexdigest()[:16]
    ok(huella == HUELLA_V1, 'lo de antes del %s sale igual que siempre (%s)' % (V2_DESDE[:10], huella))
    # 🔒 y la versión 2, sin los chats, también (medida con el código del 17/11/2026, antes de la versión 3)
    its30 = [dict(x, t=_iso(_de_iso(x['t']) + dt.timedelta(days=30))) for x in items]
    tb30 = [dict(f, ult=[_iso(_de_iso(f['ult'][0] + 'T00:00:00Z') + dt.timedelta(days=30))[:10]] + f['ult'][1:]) for f in tabla]
    # (sin las barras: la huella se midió antes de ellas, y estas publicaciones de prueba caen después de `BARRAS_DESDE`)
    a30 = poner(its30, tb30, perm, ahora + dt.timedelta(days=30), llaves, ocultas=['Agus'], barras=False)
    h2 = hashlib.sha256(json.dumps([x.get('cm') for x in a30], ensure_ascii=False).encode()).hexdigest()[:16]
    ok(h2 == HUELLA_V2, 'sin los chats, la versión 2 sale igual que siempre (%s)' % h2)
    # 📣 las barras: en publicaciones de un servidor desde `BARRAS_DESDE`, a veces habla «La barra de …», con la pastilla
    # «Liga»; antes de esa fecha, nunca (lo que ya se vio no cambia)
    b30 = poner(its30, tb30, perm, ahora + dt.timedelta(days=30), llaves, ocultas=['Agus'])
    bs = [c for x in b30 for c in (x.get('cm') or []) if str(c[1]).startswith('b:')]
    antes = [c for x in poner(items, tabla, perm, ahora, llaves, ocultas=['Agus']) for c in (x.get('cm') or []) if str(c[1]).startswith('b:')]
    ok(bs and all(c[1] == 'b:FFA' and c[2] == 'La barra de FFA' and c[5] == 'l' for c in bs) and not antes,
       'las barras: «La barra de FFA» habla en las de FFA desde su fecha (%d veces), con la pastilla «Liga»; antes, nunca' % len(bs))

    # 🗣️ la versión 3: la jerga de FFA es «papu» y «nashe», Oasis (dijo que sí) escribe «bro» y ríe «jsjs»; Snow no dijo
    # que sí y también tiene voz medida: no se usa
    ch = {'dias': {}}
    for d in range(1, 30):
        dd = '2026-12-%02d' % d
        ch['dias'][dd] = {'FFA': {'jerga': {'papu': 3, 'nashe': 2, 'bro': 1}, 'risa': {'xd': 9}, 'emoji': {'💀': 5, '🖕': 50},
                                  'voz': {'oasis': {'m': 3, 'mi': 3, 'ma': 0, 'j': {'bro': 2}, 'r': {'jsjs': 2}, 'e': {'😎': 1}},
                                          'snow': {'m': 3, 'mi': 0, 'ma': 3, 'j': {'wey': 3}, 'r': {'JAJA': 3}, 'e': {}}}}}
    a3 = poner(its30, tb30, perm, ahora + dt.timedelta(days=30), llaves, ocultas=['Agus'], chats=ch)
    b3 = poner(its30, tb30, perm, ahora + dt.timedelta(days=30), llaves, ocultas=['Agus'], chats=ch)
    c3 = [c for x in a3 for c in x.get('cm') or [] if c[5] != 'l']
    ffa = {f['k'] for f in tb30 if f['sv'] == 'FFA'}
    ok(a3 == b3 and a3 != a30, 'la versión 3: la misma entrada da lo mismo, y no es la 2')
    ok(any(('papu' in c[3] or 'nashe' in c[3]) for c in c3 if c[1] in ffa) and not any(('papu' in c[3] or 'nashe' in c[3]) for c in c3 if c[1] not in ffa),
       'la jerga de FFA la usa la gente de FFA, y nadie más')
    ok(any('bro' in c[3] for c in c3 if c[1] == 'oasis') and not any('wey' in c[3] for c in c3),
       'la voz de quien dijo que sí (Oasis: «bro»); la de quien no, nunca (Snow: «wey»)')
    ok(not any('🖕' in c[3] for c in c3), 'un emoji grosero no sale nunca, aunque sea el que más se usa')
    ok(all('{' not in c[3] and '~' not in c[3] and len(c[3]) <= 120 for c in c3), 'sin huecos, sin marcas y cortos')
    sc = {'tipo': 'svchat', 'id': 'c00000000001', 't': '2026-12-20T03:30:00Z', 'sv': 'FFA', 'dia': '2026-12-19', 'que': 'polemica', 'msgs': 640}
    pol = poner([sc], tb30, perm, ahora + dt.timedelta(days=40), {}, chats=ch)[0].get('cm') or []
    frases = [g.lstrip('~').format(sv=_sigla('FFA')).lower() for g in GENTE['svchat_pol'] + RESPUESTA['svchat_pol']['?'] + RESPUESTA['svchat_pol']['']]
    ok(pol and all(any(p in c[3].lower() for p in frases) for c in pol),
       'en una polémica, sólo las frases que no acusan a nadie (%d)' % len(pol))

    # y lo mismo, con la versión 2: las mismas publicaciones, un mes después
    def correr(dias):
        def mover(s):
            return _iso(_de_iso(s) + dt.timedelta(days=dias))
        its = [dict(x, t=mover(x['t'])) for x in items]
        tb = [dict(f, ult=[mover(f['ult'][0] + 'T00:00:00Z')[:10]] + f['ult'][1:]) for f in tabla]
        return its, tb, ahora + dt.timedelta(days=dias)

    for version, dias in (('versión 1', 0), ('versión 2', 30)):
        its, tb, ah = correr(dias)
        a = poner(its, tb, perm, ah, llaves, ocultas=['Agus'])
        b = poner(its, tb, perm, ah, llaves, ocultas=['Agus'])
        print('   ── %s' % version)
        ok(a == b, 'la misma entrada da los mismos comentarios (el muro no cambia solo)')
        cms = [c for x in a for c in x.get('cm') or []]
        ok(len(cms) > 30, 'salen comentarios (%d en %d publicaciones)' % (len(cms), len(its)))
        ok(all(c[1] != 'makmah' for c in cms), 'quien dijo que no no aparece nunca')
        ok(all(c[1] != 'agus' for c in cms), 'quien ocultó su foto no aparece')
        ok(all(c[1] not in ('viejo', 'sinfoto') for c in cms), 'ni quien no juega hace semanas ni quien no tiene foto')
        ok(all(c[1] not in ('tam', 'kminant') for x in a if x['tipo'] == 'campeon' for c in x.get('cm') or []),
           'ni el dueño ni quien jugó ese evento')
        ok(all((c[5] == '') == (c[1] == 'oasis') for c in cms if c[5] != 'l'), 'sin etiqueta sólo quien dijo que sí')
        ok(all(c[5] == 's' for c in cms if c[5] != 'l' and c[1] != 'oasis'), 'los demás llevan «simulado»')
        ok(any(c[5] == 'l' for c in cms), 'y comentan los personajes de la Liga')
        cuenta = {}
        for x in a:
            for c in x.get('cm') or []:
                if c[5] != 'l':
                    k = (x['t'][:10], c[1])
                    cuenta[k] = cuenta.get(k, 0) + 1
        ok(max(cuenta.values()) <= POR_DIA, 'nadie más de %d veces por día' % POR_DIA)
        ok(all('{' not in c[3] and '~' not in c[3] for c in cms), 'ninguna frase queda con un hueco o una marca sin sacar')
        ok(all(x.get('cm') is None for x in its), 'no toca la lista de entrada')
        sin = poner(its, tb, None, ah, llaves)
        ok(all(c[5] in ('s', 'l') for x in sin for c in x.get('cm') or []),
           'sin permisos (sin red y sin copia), todos con la etiqueta')
        if dias:
            # 🎲 lo nuevo de la versión 2
            textos = [c[3] for c in cms]
            ok(len(set(textos)) / len(textos) > 0.8, 'casi ninguna frase se repite (%d distintas de %d)' % (len(set(textos)), len(textos)))
            por_pub = [len(x.get('cm') or []) for x in a if x['tipo'] == 'campeon']
            ok(max(por_pub) > 3 and min(por_pub) < max(por_pub), 'cuántos depende de la publicación (de %d a %d en una final)' % (min(por_pub), max(por_pub)))
            ok(all(len(x.get('cm') or []) <= TOPE for x in a), 'nunca más de %d en una publicación' % TOPE)
            resp = [c for c in cms if len(c) > 6]
            ok(resp, 'y se contestan entre ellos (%d respuestas)' % len(resp))
            ok(all(any(d[0] == c[6] for d in x['cm']) and c[6] < c[0] for x in a for c in x.get('cm') or [] if len(c) > 6),
               'cada respuesta apunta a uno de antes en la misma publicación')
            ok(all(c[4] >= x['cm'][c[6]][4] for x in a for c in x.get('cm') or [] if len(c) > 6),
               'y llega después que aquel al que le contesta')
            ok(all(_estilo(k) == _estilo(k) for k in ('oasis', 'snow')) and len({json.dumps(_estilo(f['k']), sort_keys=True) for f in tabla}) > 3,
               'cada uno escribe a su manera, y siempre igual')
            an = [c for x in a if x['tipo'] == 'anuncio' for c in x.get('cm') or []]
            ok(an and min(c[4] for c in an) < its[-1]['t'], 'un anuncio se comenta antes de que arranque')
            # 🧪 un séptimo valor sólo si contesta: lo de la página lee los seis de siempre
            ok(all(len(c) in (6, 7) for c in cms), 'las tuplas tienen seis valores, o siete si contestan')
            # 📏 y las palabras de festejo no se comen el texto de nadie
            ok(all(len(c[3]) <= 120 for c in cms), 'ninguna pasa de 120 letras')
            ej = [(x['tipo'], c[2], c[3], c[6] if len(c) > 6 else '') for x in a[:3] + a[-5:] for c in x.get('cm') or []]
            print('\n   unos de muestra:')
            for t_, n_, tx_, r_ in ej[:14]:
                print('     %-8s %-8s %s%s' % (t_, n_, ('↪%s ' % r_) if r_ != '' else '', tx_))
            print()
    print('\n%s\n' % ('✅ todo bien' if not fallas else '🔴 %d fallas' % fallas))
    return fallas


#: la huella de lo que la versión 1 armaba sobre la entrada del self-check (medida con el código del 14/11/2026)
HUELLA_V1 = '38b6f92a2f52ed2e'
#: y la de la versión 2, con las mismas publicaciones 30 días después y sin los chats (medida el 17/11/2026)
HUELLA_V2 = 'c634ebd1900285b8'


if __name__ == '__main__':
    import sys
    sys.exit(1 if _self_check() else 0)
