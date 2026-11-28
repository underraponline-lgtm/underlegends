# -*- coding: utf-8 -*-
"""LOS CUATRO FOROS DEL STAFF DE DRA, COMO LOS DE THE COSMIC RAP (Dlx, 28/11/2026).

    python herramientas/dra_staff_foros.py --ver               el plan, mirando DRA (sólo lee)
    python herramientas/dra_staff_foros.py --vista <carpeta>   íconos + cómo se vería cada foro (html y png), sin tocar Discord
    python herramientas/dra_staff_foros.py --aplicar           lo hace (de 11 AM a 3 AM ET; nunca borra nada)
    python herramientas/dra_staff_foros.py --auto              el self-check, sin red

🔑 Dlx, 28/11/2026: *«Mira la categoría de staff [de The Cosmic Rap], cómo están los canales de registros, recursos,
reportes, archivos. Quisiera que hagas exactamente lo mismo, y si mejor si puedes.»*

LO QUE TIENE COSMIC (medido el 28/11/2026, sólo lectura)
---------------------------------------------------------
· «✦ STAFF ✦», cuatro foros: 「📑」registros (MENSAJES fijado, EVENTOS, USUARIOS, MODERACION, CANALES VOZ; vista en
  LISTA y orden por FECHA DE CREACIÓN), 「📦」recursos (REGLAMENTO STAFF fijado, PLANTILLAS TEXTOS/DISEÑO, TUTORIALES,
  GENERADORES, HORA GENERAL, PLAYLISTS), 「🚨」reportes (TICKETS fijado, CHECK IN/OUTS, TRANSCRIPCIONES, APELACIONES,
  POSTULACIONES, EVENTOS, NOTAS, PUNTOS) y 「🗂️」archivos (MANDATOS fijado, IMÁGENES, ALIADOS, CUENTAS, SOCIOS, EXTRA,
  PAGINAS WEBS). Cada post: un «.» y un ícono neón de discotools.xyz (fondo negro, degradé magenta→turquesa→magenta,
  brillo turquesa) de «Under Legends Oficial». Ninguna etiqueta (la única que hubo se borró), ninguna pauta.
· Los registros de Cosmic están VACÍOS: el bot de logs (Koya) escribe en un canal de texto «registros» aparte. Los
  hilos que sí se llenan son los de reportes, por YAGPDB (check-ins, tickets, notas, transcripciones).

LO QUE YA TIENE DRA, Y POR ESO ESTO ADOPTA EN VEZ DE CREAR
----------------------------------------------------------
· Los cuatro foros ya existen en «👔 ╣ CENTRAL», y registros ya tiene MENSAJES, MODERACIÓN, USUARIOS, CANALES DE VOZ y
  EVENTOS con los mismos íconos — vacíos, como en Cosmic.
· 🔴 TRES HILOS LOS USA EL CÓDIGO POR ID y no se tocan más que de nombre y etiqueta: LIGA GLOBAL (`avisar.CANAL`,
  `CANAL_LOGS` de avisos.js), LIGA GLOBAL ID (`HILO_VERIF` de verificar_dc.js) e INVITADOS (`HILO_INVITES`). Crearlos de
  nuevo dejaría al bot escribiendo en un hilo que ya nadie mira.
· Un post adoptado conserva su primer mensaje (es de quien lo creó: el bot no lo puede editar). Si estaba vacío, el bot
  deja abajo la ficha de qué va ahí; si ya tiene registros, no se le escribe nada.

LO QUE SUMA («y si mejor»)
--------------------------
· Un post fijado por foro que es el ÍNDICE: cada hilo con su link, qué va ahí y qué bot lo escribe (Discord deja fijar
  UNO por foro: Cosmic fija MENSAJES, TICKETS, REGLAMENTO y MANDATOS).
· Etiquetas para filtrar y una pauta en cada foro; en reportes, estados (Pendiente → En revisión → Resuelto / Sanción /
  Descartado), la plantilla para reportar y la etiqueta obligatoria.
· Los posts que faltaban (SERVIDOR, APELACIONES, NOTAS DE STAFF, GUÍAS, COMANDOS, BEATS, TEMPORADAS, LIGAS…), con el
  ícono de Cosmic cuando existe (es arte de Dlx) y uno nuevo en el mismo estilo cuando no (`ICONOS_SVG`).

⚠️ NUNCA BORRA: lo que sobra (el EVENTOS vacío repetido en registros) queda listado para que lo borre Dlx.
⚠️ IDEMPOTENTE: cada hilo se busca por el id guardado (`datos/dra_staff_foros.json`), por el id adoptado o por el
   título; sólo se crea si no está. Correrlo dos veces no duplica nada; si el texto de una ficha del bot cambia, se edita.
⚠️ El orden: registros, recursos y archivos ordenan por FECHA DE CREACIÓN (lo nuevo arriba), así que los posts nuevos se
   crean de abajo hacia arriba. Los adoptados son más viejos y quedan debajo; el índice fijado da el orden de verdad.
"""
import hashlib
import html
import io
import json
import os
import re
import sys
import time
import unicodedata
from urllib.parse import quote

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

GUILD = '841017460341604382'
COSMIC = '1340833594033311786'
API = 'https://discord.com/api/v10'
SALIDA = os.path.join(BASE, 'datos', 'dra_staff_foros.json')
ICONOS_DIR = os.path.join(SCR, 'dra_staff_iconos')
MOTIVO = 'Liga Global: foros del staff como los de Cosmic Rap (Dlx, 28/11/2026)'
FIJADO, REQUIERE_TAG = 2, 16
ARCHIVO_7D = 10080
TAGS_MAX, TAGS_POST = 20, 5

# ── los íconos ─────────────────────────────────────────────────────────────────────────────────────────────────────
#: los de Cosmic: el hilo de Cosmic de donde sale (el primer mensaje de un hilo de foro tiene el mismo id que el hilo)
ICONOS_COSMIC = {
    'mensajes': '1343413243103940648', 'moderacion': '1343413699892740146', 'voz': '1343413524701122582',
    'usuarios': '1343413853626699930', 'eventos': '1343414072116248706',
    'tickets': '1343417438603317358', 'apelaciones': '1343417696427180125', 'notas': '1346972821066092625',
    'transcripciones': '1343417526180380672', 'postulaciones': '1343417745517187082',
    'reglamento': '1343426281189937204', 'tutoriales': '1343420698789412946', 'hora': '1343425668456906822',
    'playlists': '1343425945830424618', 'generadores': '1343422866699321394', 'plantillas_diseno': '1343427069782003743',
    'mandatos': '1343419027665719370', 'imagenes': '1343418298649280603', 'aliados': '1343418579613122561',
    'cuentas': '1343419465504653384', 'socios': '1343419763984171008', 'extra': '1343420070679941192',
    'paginas': '1343420499195203626',
}
#: los nuevos, mismo estilo (Material, viewBox 24): `render_iconos()` los dibuja con Playwright
ICONOS_SVG = {
    'guia': 'M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z',
    'reportar': 'M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z',
    'servidor': ('M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h'
                 '4V5h-4V3h-2v6z'),
    'comandos': 'M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z',
    'arte': ('M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 '
             '6H5l3.5-4.5z'),
    'trofeo': ('M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c'
               '1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 '
               '0c0 1.3-.84 2.4-2 2.82V7h2v1z'),
    'estrella': 'M12 17.27L18.18 21l-1.64-7.19L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.57L5.82 21z',
    'video': 'M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z',
    'verificado': ('M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-'
                   '7.59L19 8l-9 9z'),
    'invitacion': ('M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM'
                   '8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-'
                   '5-5z'),
    'aka': ('M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 '
            '1.63-.84L22 12l-4.37-6.16z'),
}
#: el estilo de Cosmic, medido sobre sus PNG (319 px): fondo #010404, esquina ~34 px, glifo en ~72 % del lado, degradé
#: magenta #EC218F → turquesa #29DED6 → magenta #FF0099, borde y brillo turquesa #02C7BA
ESTILO = {'fondo': '#010404', 'mag': '#EC218F', 'tur': '#29DED6', 'mag2': '#FF0099', 'borde': '#02C7BA'}

# ── el plan ────────────────────────────────────────────────────────────────────────────────────────────────────────
#: un post: clave, título, ícono, etiquetas, texto (la ficha), `adopta` (id de un hilo que ya existe), `bot` (quién escribe
#: ahí: va al índice y a las instrucciones de Dlx), `fijo` (el índice del foro). En el ORDEN en que se lee, de arriba abajo.
FOROS = {
    'registros': {
        'id': '1469848811194286091',
        'ajustes': {'default_sort_order': 1, 'default_forum_layout': 1, 'default_auto_archive_duration': ARCHIVO_7D,
                    'topic': 'Los registros de DRA: un hilo por tipo. Acá escriben los bots, no la gente. '
                             'El índice fijado dice qué va en cada hilo y qué bot lo escribe.'},
        'tags': [('Guía', '📌', True), ('Seguridad', '🛡️', True), ('Comunidad', '👥', True), ('Liga Global', '🏆', True),
                 ('Eventos', '🎪', True), ('ULAYA', '🐉', True), ('Bot de logs', '🤖', True)],
        'posts': [
            {'clave': 'indice', 'titulo': '📌 CÓMO FUNCIONAN LOS REGISTROS', 'icono': 'guia', 'tags': ['Guía'], 'fijo': True},
            {'clave': 'mensajes', 'titulo': 'MENSAJES', 'adopta': '1484018163946618900', 'icono': 'mensajes',
             'tags': ['Seguridad', 'Bot de logs'], 'bot': 'LEGENDS',
             'texto': 'Mensajes **borrados y editados**, purgas (borrado masivo) y mensajes fijados o desfijados.'},
            {'clave': 'moderacion', 'titulo': 'MODERACIÓN', 'adopta': '1485121836634345472', 'icono': 'moderacion',
             'tags': ['Seguridad', 'Bot de logs'], 'bot': 'Dyno o Carl-bot (el que sancione) + AutoMod',
             'texto': '**Sanciones**: baneos y desbaneos, expulsiones, aislamientos (timeout), advertencias, lo que '
                      'frena el AutoMod y las alertas de antiraid.'},
            {'clave': 'usuarios', 'titulo': 'USUARIOS', 'adopta': '1485121946042765322', 'icono': 'usuarios',
             'tags': ['Comunidad', 'Bot de logs'], 'bot': 'Koya (como en Cosmic) o Sapphire',
             'texto': '**La gente**: quién entra y quién sale, cambios de apodo y de nombre, roles que se ponen y se '
                      'sacan, cambios de avatar.'},
            {'clave': 'voz', 'titulo': 'CANALES DE VOZ', 'adopta': '1485121625719574628', 'icono': 'voz',
             'tags': ['Comunidad', 'Bot de logs'], 'bot': 'Koya o LogiBot',
             'texto': '**La voz**: quién entra, sale o se cambia de sala, quién silencia o ensordece a otro y quién '
                      'mueve a alguien de sala. Sirve para revisar una batalla o un cypher después.'},
            {'clave': 'servidor', 'titulo': 'SERVIDOR', 'icono': 'servidor', 'tags': ['Seguridad', 'Bot de logs'],
             'bot': 'Carl-bot o Dyno (registro del servidor) + Cakey (webhooks)',
             'texto': '**El servidor en sí**: canales y categorías creados, borrados o cambiados, permisos, roles, '
                      'emojis y stickers, webhooks e integraciones, invitaciones creadas o borradas y cambios de '
                      'ajustes. Lo que más importa si alguien entra con permisos de más.'},
            {'clave': 'eventos', 'titulo': 'EVENTOS', 'adopta': '1485122088405700771', 'icono': 'eventos',
             'tags': ['Eventos', 'Bot de logs'], 'bot': 'YAGPDB (ya escribe acá) + eventos programados de Discord',
             'texto': 'Las **competencias** del sistema de eventos (crear, editar, cerrar) y los eventos programados '
                      'de Discord.'},
            {'clave': 'liga', 'titulo': 'LIGA GLOBAL', 'adopta': '1504110449535483924', 'icono': 'trofeo',
             'tags': ['Liga Global', 'ULAYA'], 'bot': 'ULAYA (ya escribe acá: no tocar)',
             'texto': 'Lo de rutina del bot de la Liga: avisos del ciclo, llaves que no se pudieron leer y alertas.'},
            {'clave': 'verificaciones', 'titulo': 'VERIFICACIONES', 'adopta': '1512342566488768542', 'icono': 'verificado',
             'tags': ['Liga Global', 'Comunidad', 'ULAYA'], 'bot': 'ULAYA (ya escribe acá: no tocar)',
             'texto': 'Cada persona que se verifica: AKA, país y si compite (la línea `||LIGAID|…||` es para leerla a '
                      'máquina: no se borra).'},
            {'clave': 'invitaciones', 'titulo': 'INVITACIONES', 'adopta': '1528989133492719686', 'icono': 'invitacion',
             'tags': ['Comunidad', 'ULAYA'], 'bot': 'ULAYA (ya escribe acá: no tocar)',
             'texto': 'Quién invitó a quién al verificarse, y cuántas lleva cada uno.'},
            {'clave': 'akas', 'titulo': 'AKAs', 'adopta': '1529352346256150609', 'icono': 'aka',
             'tags': ['Liga Global'], 'bot': '— (vacío: ¿para qué lo querías, Dlx?)'},
        ],
        #: lo que sobra y no se borra: lo borra Dlx si quiere
        'sobra': {'1484018269248819476': 'EVENTOS repetido y vacío (el que tiene registros es el otro)'},
    },
    'reportes': {
        'id': '1469848801362579529',
        'ajustes': {'default_sort_order': 0, 'default_forum_layout': 1, 'default_auto_archive_duration': ARCHIVO_7D,
                    'flags': REQUIERE_TAG,
                    'topic': 'Un post por reporte, con la plantilla del fijado. Etiqueta obligatoria: el tipo y el '
                             'estado (🟡 Pendiente al abrir). Los hilos 📌 son registros fijos de los bots.'},
        'tags': [('Guía', '📌', True), ('Registro fijo', '🗃️', True),
                 ('Pendiente', '🟡', False), ('En revisión', '🔵', False), ('Resuelto', '✅', False),
                 ('Sanción aplicada', '⛔', False), ('Descartado', '⚪', False),
                 ('Usuario', '👤', False), ('Staff', '🪽', False), ('Evento / batalla', '🎤', False),
                 ('Bot / página', '🤖', False), ('Apelación', '⚖️', False)],
        'posts': [
            {'clave': 'indice', 'titulo': '📌 CÓMO REPORTAR', 'icono': 'reportar', 'tags': ['Guía'], 'fijo': True},
            {'clave': 'tickets', 'titulo': 'TICKETS', 'adopta': '1516391377787818114', 'icono': 'tickets',
             'tags': ['Registro fijo'], 'bot': 'YAGPDB (ya escribe acá)',
             'texto': 'Cada ticket que se abre: quién, de qué tipo y qué escribió.'},
            {'clave': 'transcripciones', 'titulo': 'TRANSCRIPCIONES', 'adopta': '1516391764523483206',
             'icono': 'transcripciones', 'tags': ['Registro fijo'], 'bot': 'YAGPDB (ya escribe acá)',
             'texto': 'La transcripción de cada ticket al cerrarse.'},
            {'clave': 'apelaciones', 'titulo': 'APELACIONES', 'icono': 'apelaciones', 'tags': ['Registro fijo', 'Apelación'],
             'bot': 'el staff, a mano',
             'texto': 'Cada **apelación** de una sanción, en un mensaje: quién apela, qué sanción, el link al reporte, '
                      'por qué pide revisarla y qué se decidió.'},
            {'clave': 'notas', 'titulo': 'NOTAS DE STAFF', 'icono': 'notas', 'tags': ['Registro fijo'],
             'bot': 'el staff, a mano',
             'texto': 'Notas sobre una persona que no son un reporte: un aviso de palabra, contexto para el próximo que '
                      'la atienda. `@persona (ID) — la nota — quién la deja`.'},
            {'clave': 'logs_staff', 'titulo': 'LOGS STAFF', 'adopta': '1521566904639295528', 'icono': 'tickets',
             'tags': ['Registro fijo'], 'bot': 'LEGENDS + Cakey (hoy: mensajes borrados y webhooks → mudarlos a registros)'},
            {'clave': 'logs_eventos', 'titulo': 'LOGS SISTEMA DE EVENTOS', 'adopta': '1533235462838419506',
             'icono': 'eventos', 'tags': ['Registro fijo'], 'bot': 'YAGPDB (depuración del sistema de eventos)'},
        ],
    },
    'recursos': {
        'id': '1170906844001206302',
        'ajustes': {'default_sort_order': 1, 'default_forum_layout': 2, 'default_auto_archive_duration': ARCHIVO_7D,
                    'topic': 'Lo que el staff usa para trabajar: reglas, guías, plantillas, arte, beats y herramientas. '
                             'Un post por tema; lo nuevo se suma adentro del post que corresponde.'},
        'tags': [('Reglas', '👊', False), ('Guías', '📑', False), ('Herramientas', '🛠️', False),
                 ('Plantillas', '🧩', False), ('Arte', '🎨', False), ('Beats', '🎹', False), ('Bots', '🤖', False),
                 ('Ideas', '💡', False)],
        'posts': [
            {'clave': 'reglamento', 'titulo': '📌 REGLAMENTO STAFF', 'icono': 'reglamento', 'tags': ['Reglas'], 'fijo': True,
             'texto': 'Las **reglas del staff de DRA**, en un solo lugar. Las escribe Dirección: una regla por mensaje, '
                      'así se puede citar con su link.'},
            {'clave': 'guias', 'titulo': 'GUÍAS DEL STAFF', 'icono': 'tutoriales', 'tags': ['Guías'],
             'texto': '**Cómo se hace**, paso a paso: organizar una competencia, abrir y llevar un cypher, cargar una '
                      'llave para que la Liga la lea, atender un ticket. Una guía por mensaje, con título en `#`.'},
            {'clave': 'comandos', 'titulo': 'COMANDOS DE LOS BOTS', 'icono': 'comandos', 'tags': ['Bots', 'Guías'],
             'texto': '**Los comandos que usa el staff.** ULAYA: `/help` los muestra todos; para el staff, `/llave`, '
                      '`/agendar`, `/afiche`, `/settings`, `/antiraid` y `/dashboard`. Música: en el canal de beats, '
                      'con el prefijo de cada bot. Si un bot cambia sus comandos, se corrige acá.'},
            {'clave': 'hora', 'titulo': 'HORA Y MARCA DE TIEMPO', 'icono': 'hora', 'tags': ['Herramientas'],
             'texto': '**Toda hora de DRA va en hora del este (ET).** Para que cada uno la vea en la suya, se escribe '
                      'como marca de tiempo: `<t:UNIX:F>` (fecha y hora), `<t:UNIX:t>` (sólo hora) o `<t:UNIX:R>` '
                      '(«en 2 horas»). El número UNIX se saca en https://hammertime.cyou'},
            {'clave': 'arte', 'titulo': 'LOGOS Y ARTE', 'icono': 'arte', 'tags': ['Arte'],
             'texto': '**Logos de UL y DRA, banners, fondos y los íconos de los foros**, en buena calidad. Los íconos '
                      'neón están en archivos › ICONOS PARA LOS FOROS; el editor es https://discotools.xyz/icons-editor'},
            {'clave': 'beats', 'titulo': 'BEATS', 'icono': 'playlists', 'tags': ['Beats'],
             'texto': '**Beats para cyphers y competencias**, por estilo: boom bap, doble tempo, trap, rápidos. Sólo '
                      'beats con permiso de su productor, con el nombre del productor al lado.'},
            {'clave': 'herramientas', 'titulo': 'HERRAMIENTAS WEB', 'icono': 'generadores', 'tags': ['Herramientas'],
             'texto': '**Páginas que sirven**: el Dashboard de la Liga (`/dashboard`), editores de imagen '
                      '(https://pixlr.com/es/express), íconos (https://discotools.xyz) y marcas de tiempo '
                      '(https://hammertime.cyou). Una por mensaje, con para qué sirve.'},
            {'clave': 'pl_basicas', 'titulo': 'Plantillas Básicas 🌬️', 'adopta': '1511926935704441014', 'tags': ['Plantillas']},
            {'clave': 'pl_nitro', 'titulo': 'Plantillas Nitro 💎', 'adopta': '1511927233319669830', 'tags': ['Plantillas']},
            {'clave': 'pl_pc', 'titulo': 'PLANTILLAS PC 🖥', 'adopta': '1254364546228031519', 'tags': ['Plantillas']},
            {'clave': 'pl_cel', 'titulo': 'PLANTILLAS CEL 📱', 'adopta': '1254364634228461629', 'tags': ['Plantillas']},
            {'clave': 'sv_staff', 'titulo': 'SERVIDOR STAFF 📢', 'adopta': '1254363542132621394', 'tags': ['Guías']},
            {'clave': 'ideas', 'titulo': 'Ideas | Sugerencias', 'adopta': '1513639128305107077', 'tags': ['Ideas']},
            {'clave': 'ideas_trueno', 'titulo': 'Ideas Trueno', 'adopta': '1502584867076968468', 'tags': ['Ideas']},
            {'clave': 'ideas_drako', 'titulo': 'drako ideas', 'adopta': '1502701122673184818', 'tags': ['Ideas']},
            {'clave': 'extra', 'titulo': 'EXTRA 🚬', 'adopta': '1172759567634026577', 'tags': []},
        ],
    },
    'archivos': {
        'id': '1469848795322908703',
        'ajustes': {'default_sort_order': 1, 'default_forum_layout': 2, 'default_auto_archive_duration': ARCHIVO_7D,
                    'topic': 'Lo que se guarda: decisiones, temporadas, ligas, socios, imágenes y links. '
                             'Nunca contraseñas ni códigos.'},
        'tags': [('Decisiones', '📜', True), ('Liga Global', '🏆', False), ('Ligas', '⭐', False), ('Eventos', '🎪', False),
                 ('Socios', '🤝', False), ('Arte', '🎨', False), ('Redes', '📱', False)],
        'posts': [
            {'clave': 'mandatos', 'titulo': '📌 MANDATOS', 'icono': 'mandatos', 'tags': ['Decisiones'], 'fijo': True,
             'texto': '**Lo que decide Dirección**, con fecha: una decisión por mensaje, para poder citarla. Lo que se '
                      'cambia después se responde al mensaje viejo, no se borra.'},
            {'clave': 'temporadas', 'titulo': 'TEMPORADAS', 'icono': 'trofeo', 'tags': ['Liga Global'],
             'texto': '**Cada temporada de la Liga Global**: fechas, campeones, la gala y lo que cambió. La T1 va del '
                      '22/09 al 31/12/2026; los rankings, en https://underlegends.pages.dev/freestyle-rap'},
            {'clave': 'ligas', 'titulo': 'LIGAS', 'icono': 'estrella', 'tags': ['Ligas'],
             'texto': '**Las ligas**: reglamento, temporadas, campeones y sistemas de ascenso. Una liga por mensaje.'},
            {'clave': 'grabados', 'titulo': 'EVENTOS GRABADOS', 'icono': 'video', 'tags': ['Eventos'],
             'texto': 'Los videos de cada evento viven en <#1575848965503721523> (un post por servidor). Acá va lo que no '
                      'es de un evento: clips sueltos, entrevistas, material para redes.'},
            {'clave': 'socios', 'titulo': 'SOCIOS', 'icono': 'socios', 'tags': ['Socios'],
             'texto': '**Los servidores socios de la Liga**: invitación permanente, con quién se habla y su tier.'},
            {'clave': 'aliados', 'titulo': 'ALIADOS', 'icono': 'aliados', 'tags': ['Socios'],
             'texto': '**Aliados que no son socios**: comunidades, medios y organizadores, con su invitación o red.'},
            {'clave': 'imagenes', 'titulo': 'IMÁGENES', 'icono': 'imagenes', 'tags': ['Arte'],
             'texto': '**Imágenes para guardar**: afiches de eventos ya jugados, capturas, fotos de premiaciones.'},
            {'clave': 'redes', 'titulo': 'REDES', 'icono': 'cuentas', 'tags': ['Redes'],
             'texto': '**Las redes de UL y DRA** (links, no claves). ⚠️ Nunca contraseñas, códigos ni tokens en '
                      'Discord: esos los guarda Dlx.'},
            {'clave': 'paginas', 'titulo': 'PÁGINAS WEB', 'icono': 'paginas', 'tags': ['Liga Global'],
             'texto': '**Las páginas de la Liga**: https://underlegends.pages.dev (rankings, tarjetas, eventos) y lo que '
                      'se sume.'},
            {'clave': 'extra', 'titulo': 'EXTRA', 'icono': 'extra', 'tags': [],
             'texto': 'Lo que no entra en otro post.'},
            {'clave': 'iconos', 'titulo': 'ICONOS PARA LOS FOROS', 'adopta': '1484808663511076875', 'tags': ['Arte']},
            {'clave': 'reino_hielo', 'titulo': '❄️🐉REINO DE HIELO🐉❄️', 'adopta': '1515200536641798255', 'tags': ['Ligas']},
        ],
    },
}

PLANTILLA_REPORTE = (
    '**Cómo abrir un reporte**\n'
    '1. «Nueva publicación» en este foro.\n'
    '2. Título: `[Tipo] quién o qué — fecha`, por ejemplo `[Usuario] Fulano — 28/11`.\n'
    '3. Etiquetas: el **tipo** y 🟡 **Pendiente**.\n'
    '4. Copia esto y complétalo:\n'
    '```\n'
    '**Quién:** @persona (ID)\n'
    '**Dónde:** #canal o link del mensaje\n'
    '**Cuándo:** fecha y hora ET\n'
    '**Qué pasó:** \n'
    '**Pruebas:** capturas, links, clips\n'
    '**Reporta:** @quien\n'
    '```\n'
    '**Después**\n'
    '· Quien lo toma cambia a 🔵 **En revisión** y lo dice en el hilo.\n'
    '· Al cerrar: ✅ **Resuelto**, ⛔ **Sanción aplicada** (cuál y hasta cuándo) o ⚪ **Descartado** (por qué).\n'
    '· Si apelan, se anota en APELACIONES con el link a este reporte.'
)


# ── helpers ────────────────────────────────────────────────────────────────────────────────────────────────────────
def plano(s):
    """El título comparable: sin emojis, acentos ni mayúsculas («📌 MODERACIÓN» = «moderacion»)."""
    s = unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()


def _token():
    t = (os.environ.get('DISCORD_TOKEN') or '').strip()
    if t:
        return t
    try:
        for l in io.open(os.path.join(BASE, '.env'), encoding='utf-8'):
            if l.strip().startswith('DISCORD_TOKEN='):
                return l.split('=', 1)[1].strip().strip('"\'')
    except OSError:
        pass
    return ''


def huella(*cosas):
    return hashlib.sha1(json.dumps(cosas, ensure_ascii=False, sort_keys=True).encode('utf-8')).hexdigest()[:12]


def cargar():
    try:
        with io.open(SALIDA, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def guardar(hecho):
    hecho['_leeme'] = ('Los hilos de los cuatro foros del staff de DRA (registros, reportes, recursos, archivos): '
                       'los escribe herramientas/dra_staff_foros.py --aplicar. Con esto no vuelve a crear lo que ya está.')
    hecho['t'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    with io.open(SALIDA, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(hecho, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write('\n')


class Discord:
    """GET siempre; lo que cambia, sólo con `aplicar=True` (si no, lo anota y lo muestra)."""

    def __init__(self, aplicar):
        import requests
        self.r = requests
        self.aplicar = aplicar
        self.h = {'Authorization': 'Bot ' + _token(), 'User-Agent': 'DiscordBot (https://underlegends.pages.dev, 1)',
                  'X-Audit-Log-Reason': quote(MOTIVO)}
        self.hechos = []

    def _pedir(self, metodo, ruta, **kw):
        for _ in range(5):
            x = self.r.request(metodo, API + ruta, headers=self.h, timeout=60, **kw)
            if x.status_code == 429:
                time.sleep(float((x.json() or {}).get('retry_after') or 2) + 0.5)
                continue
            return x
        return x

    def get(self, ruta, **params):
        x = self._pedir('GET', ruta, params=params)
        x.raise_for_status()
        return x.json()

    def cambio(self, que, metodo, ruta, cuerpo=None, archivo=None):
        """`archivo` = (nombre, bytes): va como multipart, con `cuerpo` en payload_json."""
        self.hechos.append(que)
        if not self.aplicar:
            print('  · ' + que)
            return None
        if archivo:
            x = self._pedir(metodo, ruta, data={'payload_json': json.dumps(cuerpo)},
                            files={'files[0]': (archivo[0], archivo[1], 'image/png')})
        else:
            x = self._pedir(metodo, ruta, json=cuerpo)
        if x.status_code >= 400:
            print('  ✗ %s → %s %s' % (que, x.status_code, x.text[:200]))
            return None
        print('  ✓ ' + que)
        time.sleep(0.5)
        return x.json() if x.content else {}


# ── los íconos ─────────────────────────────────────────────────────────────────────────────────────────────────────
def _html_icono(path):
    e = ESTILO
    return ('<html><body style="margin:0;background:transparent">'
            '<div id="i" style="width:320px;height:320px;border-radius:34px;background:%s;display:flex;'
            'align-items:center;justify-content:center">'
            '<svg width="230" height="230" viewBox="0 0 24 24" style="overflow:visible;filter:drop-shadow(0 0 3px %s) '
            'drop-shadow(0 0 9px %s)"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">'
            '<stop offset="0" stop-color="%s"/><stop offset=".28" stop-color="%s"/><stop offset=".52" stop-color="%s"/>'
            '<stop offset=".76" stop-color="%s"/><stop offset="1" stop-color="%s"/></linearGradient></defs>'
            '<path d="%s" fill="url(#g)" stroke="%s" stroke-width=".32" stroke-linejoin="round"/></svg></div>'
            '</body></html>') % (e['fondo'], e['borde'], e['borde'], e['mag'], e['mag'], e['tur'], e['mag2'], e['mag2'],
                                 path, e['borde'])


def render_iconos(claves, carpeta):
    """Dibuja los íconos nuevos (`ICONOS_SVG`) con Playwright, PNG con esquinas transparentes."""
    from playwright.sync_api import sync_playwright
    hechos = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 340, 'height': 340})
        for k in claves:
            pg.set_content(_html_icono(ICONOS_SVG[k]))
            pg.locator('#i').screenshot(path=os.path.join(carpeta, k + '.png'), omit_background=True)
            hechos.append(k)
        b.close()
    return hechos


def traer_cosmic(d, claves, carpeta):
    """Los íconos de Cosmic: se piden por la API (el link de la imagen vence; el mensaje no)."""
    hechos = []
    for k in claves:
        hilo = ICONOS_COSMIC[k]
        m = d.get('/channels/%s/messages/%s' % (hilo, hilo))
        at = [a for a in m.get('attachments') or [] if (a.get('content_type') or '').startswith('image')]
        if not at:
            print('  ⚠️ el post de Cosmic de «%s» ya no tiene imagen' % k)
            continue
        x = d.r.get(at[0]['url'], timeout=60)
        x.raise_for_status()
        with open(os.path.join(carpeta, k + '.png'), 'wb') as f:
            f.write(x.content)
        hechos.append(k)
    return hechos


def iconos_usados():
    return sorted({p['icono'] for F in FOROS.values() for p in F['posts'] if p.get('icono')})


def asegurar_iconos(d):
    """Llena `herramientas/dra_staff_iconos/` con lo que falte. Lo que ya está no se vuelve a bajar ni a dibujar."""
    os.makedirs(ICONOS_DIR, exist_ok=True)
    faltan = [k for k in iconos_usados() if not os.path.exists(os.path.join(ICONOS_DIR, k + '.png'))]
    cos = [k for k in faltan if k in ICONOS_COSMIC]
    svg = [k for k in faltan if k in ICONOS_SVG]
    if cos:
        print('  íconos de Cosmic: %s' % ', '.join(traer_cosmic(d, cos, ICONOS_DIR)))
    if svg:
        print('  íconos nuevos: %s' % ', '.join(render_iconos(svg, ICONOS_DIR)))


def icono_bytes(k):
    with open(os.path.join(ICONOS_DIR, k + '.png'), 'rb') as f:
        return f.read()


# ── los textos ─────────────────────────────────────────────────────────────────────────────────────────────────────
def ficha(p):
    """El texto del primer mensaje de un post nuevo (o la ficha que se deja en un adoptado vacío)."""
    t = '## %s\n%s' % (re.sub(r'^📌\s*', '', p['titulo']), p.get('texto') or '')
    if p.get('bot'):
        t += '\n\n-# Escribe acá: %s' % p['bot']
    return t.strip()


def enlace(hilo, p):
    return '<#%s>' % hilo if hilo else '**%s** (nuevo)' % p['titulo']


def indice(nombre, ids):
    """El post fijado de cada foro: el índice de todos sus hilos, con el link de cada uno."""
    F = FOROS[nombre]
    if nombre == 'reportes':
        cuerpo = [PLANTILLA_REPORTE, '', '**Registros fijos de este foro**']
    elif nombre == 'registros':
        cuerpo = ['Un hilo por tipo de registro. **Acá escriben los bots**: si hay que comentar algo de un registro, '
                  'se abre un reporte y se pega el link del mensaje.', '', '**Los hilos**']
    else:
        cuerpo = [F['ajustes']['topic'], '', '**Los posts**']
    for p in F['posts']:
        if p.get('fijo'):
            continue
        if nombre == 'reportes' and 'Registro fijo' not in p.get('tags', []):
            continue
        linea = '· %s' % enlace(ids.get(p['clave']), p)
        if p.get('texto'):
            corto = re.sub(r'\*\*', '', p['texto']).split('. ')[0].rstrip('.')
            linea += ' — ' + (corto if len(corto) <= 110 else corto[:108].rsplit(' ', 1)[0] + '…')
        if nombre in ('registros', 'reportes') and p.get('bot'):
            linea += '  `%s`' % p['bot'].split(' (')[0]
        cuerpo.append(linea)
    return '## %s\n%s' % (re.sub(r'^📌\s*', '', next(p for p in F['posts'] if p.get('fijo'))['titulo']),
                          '\n'.join(cuerpo))


def texto_de(nombre, p, ids):
    return indice(nombre, ids) if p.get('fijo') and nombre in ('registros', 'reportes') else ficha(p)


# ── mirar DRA ──────────────────────────────────────────────────────────────────────────────────────────────────────
def hilos_del_foro(d, foro, activos):
    out = {t['id']: t for t in activos if t.get('parent_id') == foro}
    antes = None
    while True:
        q = {'limit': 100}
        if antes:
            q['before'] = antes
        a = d.get('/channels/%s/threads/archived/public' % foro, **q)
        for t in a.get('threads') or []:
            out[t['id']] = t
        if not a.get('has_more') or not a.get('threads'):
            break
        antes = a['threads'][-1]['thread_metadata']['archive_timestamp']
    return out


def buscar(p, hilos, hecho_foro):
    """El hilo de un post: el guardado, el adoptado o uno con el mismo título. None = hay que crearlo."""
    for hid in (hecho_foro.get(p['clave']), p.get('adopta')):
        if hid and hid in hilos:
            return hilos[hid]
    por_titulo = [t for t in hilos.values() if plano(t['name']) == plano(p['titulo'])]
    return sorted(por_titulo, key=lambda t: int(t['id']))[0] if por_titulo else None


# ── el plan, en Discord o en seco ──────────────────────────────────────────────────────────────────────────────────
def tags_del_foro(d, nombre, canal):
    """Suma las etiquetas que faltan (las que hay se quedan, con su id). Devuelve `{nombre: id}`."""
    hay = canal.get('available_tags') or []
    nombres = {plano(t['name']) for t in hay}
    faltan = [t for t in FOROS[nombre]['tags'] if plano(t[0]) not in nombres]
    if faltan:
        lista = [{'id': t['id'], 'name': t['name'], 'moderated': t.get('moderated', False),
                  'emoji_id': t.get('emoji_id'), 'emoji_name': t.get('emoji_name')} for t in hay]
        lista += [{'name': n[:20], 'emoji_name': e, 'moderated': m} for n, e, m in faltan][:max(0, TAGS_MAX - len(lista))]
        r = d.cambio('%s: etiquetas nuevas %s' % (nombre, ', '.join(e + ' ' + n for n, e, _ in faltan)),
                     'PATCH', '/channels/%s' % canal['id'], {'available_tags': lista})
        if r:
            hay = r.get('available_tags') or hay
        elif not d.aplicar:                                   # en seco: ids de mentira, para que el plan las muestre
            return dict({plano(t['name']): t['id'] for t in hay}, **{plano(n): 'nueva:' + n for n, _, _ in faltan})
    return {plano(t['name']): t['id'] for t in hay}


def ajustes_del_foro(d, nombre, canal):
    quiero = dict(FOROS[nombre]['ajustes'])
    cambia = {}
    for k, v in quiero.items():
        if k == 'flags':
            v = int(canal.get('flags') or 0) | v
        if canal.get(k) != v:
            cambia[k] = v
    if cambia:
        d.cambio('%s: ajustes %s' % (nombre, ', '.join('%s=%s' % (k, (str(v)[:40] + '…') if len(str(v)) > 40 else v)
                                                        for k, v in cambia.items())),
                 'PATCH', '/channels/%s' % canal['id'], cambia)


def plan(d):
    hecho = cargar()
    chs = {c['id']: c for c in d.get('/guilds/%s/channels' % GUILD)}
    activos = d.get('/guilds/%s/threads/active' % GUILD).get('threads') or []
    if d.aplicar:
        asegurar_iconos(d)
    resumen = {}
    for nombre, F in FOROS.items():
        canal = chs.get(F['id'])
        print('\n══ %s (%s)' % (nombre, canal['name'] if canal else 'NO ESTÁ'))
        if not canal or canal.get('type') != 15:
            print('  🔴 el foro no está o no es un foro: no se toca')
            continue
        hf = hecho.setdefault(nombre, {})
        ajustes_del_foro(d, nombre, canal)
        tid = tags_del_foro(d, nombre, canal)
        hilos = hilos_del_foro(d, F['id'], activos)
        fijados = [t for t in hilos.values() if int(t.get('flags') or 0) & FIJADO]
        ids, filas = {}, []
        # los que existen: adoptar (nombre, etiquetas, ficha si está vacío)
        for p in F['posts']:
            t = buscar(p, hilos, hf)
            if not t:
                continue
            ids[p['clave']] = t['id']
            hf[p['clave']] = t['id']
            quiero_tags = [tid[plano(x)] for x in p.get('tags', []) if plano(x) in tid]
            tags = list(dict.fromkeys((t.get('applied_tags') or []) + quiero_tags))[:TAGS_POST]
            cambio = {}
            if t['name'] != p['titulo'] and p.get('adopta') and plano(t['name']) != plano(p['titulo']):
                cambio['name'] = p['titulo']
            if set(tags) != set(t.get('applied_tags') or []):
                cambio['applied_tags'] = tags
            if cambio:
                if (t.get('thread_metadata') or {}).get('archived'):
                    cambio['archived'] = False
                d.cambio('%s › %s: %s' % (nombre, t['name'], ' · '.join(
                    ('«%s» → «%s»' % (t['name'], cambio['name'])) if k == 'name' else
                    ('etiquetas %s' % ', '.join(x for x in p.get('tags', []))) if k == 'applied_tags' else 'se desarchiva'
                    for k in cambio)), 'PATCH', '/channels/%s' % t['id'], cambio)
            # la ficha del bot: en un adoptado vacío (sin un solo mensaje después del primero)
            if p.get('adopta') and p.get('texto') and not int(t.get('message_count') or 0):
                h = huella(ficha(p))
                if hf.get(p['clave'] + ':ficha') != h:
                    r = d.cambio('%s › %s: la ficha de qué va acá (está vacío)' % (nombre, p['titulo']), 'POST',
                                 '/channels/%s/messages' % t['id'], {'content': ficha(p), 'allowed_mentions': {'parse': []}})
                    if r is not None:
                        hf[p['clave'] + ':ficha'] = h
            filas.append((p, t['id'], 'adopta' if p.get('adopta') else 'está'))
        # los que faltan: se crean de abajo hacia arriba (el orden es por fecha de creación); el índice, al final
        nuevos = [p for p in F['posts'] if p['clave'] not in ids]
        for p in sorted(nuevos, key=lambda p: (bool(p.get('fijo')), -F['posts'].index(p))):
            tags = [tid[plano(x)] for x in p.get('tags', []) if plano(x) in tid][:TAGS_POST]
            texto = texto_de(nombre, p, ids)
            cuerpo = {'name': p['titulo'], 'applied_tags': tags, 'auto_archive_duration': ARCHIVO_7D,
                      'message': {'content': texto[:2000], 'allowed_mentions': {'parse': []},
                                  'attachments': [{'id': 0, 'filename': p['icono'] + '.png'}]}}
            arch = (p['icono'] + '.png', icono_bytes(p['icono'])) if d.aplicar else None
            r = d.cambio('%s: crear «%s» con su ícono (%s)%s' % (nombre, p['titulo'], p['icono'],
                                                                  ' y fijarlo' if p.get('fijo') else ''),
                         'POST', '/channels/%s/threads' % F['id'], cuerpo, archivo=arch)
            if r:
                ids[p['clave']] = hf[p['clave']] = r['id']
                hf[p['clave'] + ':ficha'] = huella(texto)
            filas.append((p, ids.get(p['clave']), 'nuevo'))
        # el índice: se fija (si no hay otro fijado) y se edita si cambió algún link
        fijo = next((p for p in F['posts'] if p.get('fijo')), None)
        if fijo and ids.get(fijo['clave']):
            hid = ids[fijo['clave']]
            otros = [t for t in fijados if t['id'] != hid]
            ya = any(t['id'] == hid for t in fijados)
            if otros:
                print('  ⚠️ ya hay otro post fijado (%s): no se desfija lo de otro; que lo cambie Dlx' % otros[0]['name'])
            elif not ya:
                d.cambio('%s: fijar «%s»' % (nombre, fijo['titulo']), 'PATCH', '/channels/%s' % hid,
                         {'flags': FIJADO, 'archived': False})
            texto = texto_de(nombre, fijo, ids)
            if hf.get(fijo['clave'] + ':ficha') != huella(texto) and hilos.get(hid, {}).get('owner_id') in (None, _yo(d)):
                d.cambio('%s: el índice, con los links de hoy' % nombre, 'PATCH', '/channels/%s/messages/%s' % (hid, hid),
                         {'content': texto[:2000]})
                hf[fijo['clave'] + ':ficha'] = huella(texto)
        for hid, por_que in (F.get('sobra') or {}).items():
            if hid in hilos:
                print('  🗑️ sobra (lo borra Dlx si quiere): %s — %s' % (hilos[hid]['name'], por_que))
        resumen[nombre] = filas
    if d.aplicar:
        guardar(hecho)
    print('\n%d cambio(s) %s' % (len(d.hechos), 'hechos' if d.aplicar else 'por hacer (sin tocar nada: --aplicar)'))
    print(instrucciones(hecho))
    return resumen


_YO = {}


def _yo(d):
    if 'id' not in _YO:
        _YO['id'] = d.get('/users/@me')['id']
    return _YO['id']


def instrucciones(hecho):
    """Lo que Dlx configura en los bots de registros: qué va a qué hilo, con su id."""
    out = ['\n── PARA DLX: dónde escribe cada bot de registros ──']
    for nombre in ('registros', 'reportes'):
        for p in FOROS[nombre]['posts']:
            if not p.get('bot') or p.get('fijo'):
                continue
            hid = (hecho.get(nombre) or {}).get(p['clave']) or p.get('adopta') or '(se crea con --aplicar)'
            out.append('  %-10s › %-24s %-20s %s' % (nombre, p['titulo'], hid, p['bot']))
    out.append('  Si el panel de un bot no deja elegir un hilo de foro, se usa un webhook del foro con ?thread_id=<id>.')
    return '\n'.join(out)


# ── la vista ───────────────────────────────────────────────────────────────────────────────────────────────────────
def _md(t):
    t = html.escape(t)
    t = re.sub(r'```\n?(.*?)```', lambda m: '<pre>%s</pre>' % m.group(1), t, flags=re.S)
    t = re.sub(r'`([^`]+)`', r'<code>\1</code>', t)
    t = re.sub(r'^## (.*)$', r'<h2>\1</h2>', t, flags=re.M)
    t = re.sub(r'^-# (.*)$', r'<small>\1</small>', t, flags=re.M)
    t = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', t)
    t = re.sub(r'&lt;#(\d+)&gt;', r'<span class="ch">#hilo</span>', t)
    t = re.sub(r'(https?://[^\s<]+)', r'<a>\1</a>', t)
    return t.replace('\n', '<br>')


CSS = ('body{margin:0;background:#313338;color:#dbdee1;font:14px/1.45 "gg sans","Segoe UI",sans-serif;padding:18px}'
       'h1{color:#f2f3f5;font-size:20px;margin:0 0 4px}.pauta{color:#b5bac1;margin:0 0 10px;font-size:13px}'
       '.tags span,.pt span{display:inline-block;margin:0 5px 6px 0;padding:1px 8px;border-radius:10px;background:#404249;'
       'font-size:12px}.foro{max-width:760px;margin:0 auto 36px}.post{display:flex;gap:14px;background:#2b2d31;'
       'border-radius:8px;padding:12px;margin:8px 0}.post img{width:84px;height:84px;border-radius:8px}'
       '.post .t{font-weight:700;color:#f2f3f5;font-size:15px}.post .x{color:#b5bac1;font-size:13px}'
       '.fijo{outline:1px solid #E5157A}.est{font-size:11px;color:#949ba4}.ch{color:#c9cdfb;background:#3c4270;'
       'border-radius:3px;padding:0 2px}pre{background:#1e1f22;padding:8px;border-radius:4px;white-space:pre-wrap}'
       'code{background:#1e1f22;padding:0 3px;border-radius:3px}h2{font-size:16px;margin:0 0 4px;color:#f2f3f5}'
       'small{color:#949ba4}a{color:#00a8fc}.galeria{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}'
       '.galeria .post{flex-direction:column}.galeria .post img{width:100%;height:auto}'
       '.msg{background:#2b2d31;border-radius:8px;padding:12px;margin:8px 0}')


def vista(carpeta, d=None):
    """Íconos + una página por foro como se vería en Discord (lista o galería), y su PNG. Sin cambiar nada."""
    os.makedirs(carpeta, exist_ok=True)
    ic = os.path.join(carpeta, 'iconos')
    os.makedirs(ic, exist_ok=True)
    if d is not None:
        asegurar_iconos(d)
    for k in iconos_usados():
        src = os.path.join(ICONOS_DIR, k + '.png')
        if os.path.exists(src):
            with open(src, 'rb') as a, open(os.path.join(ic, k + '.png'), 'wb') as b:
                b.write(a.read())
        elif k in ICONOS_SVG:
            render_iconos([k], ic)
    hecho = cargar()
    paginas = []
    for nombre, F in FOROS.items():
        ids = {p['clave']: (hecho.get(nombre) or {}).get(p['clave']) or p.get('adopta') for p in F['posts']}
        gal = F['ajustes'].get('default_forum_layout') == 2
        h = ['<div class="foro"><h1>%s</h1><p class="pauta">%s</p><div class="tags">%s</div>' % (
            nombre, html.escape(F['ajustes']['topic']), ''.join('<span>%s %s</span>' % (e, html.escape(n))
                                                                  for n, e, _ in F['tags']))]
        h.append('<p class="est">vista: %s · orden: %s · %s</p>' % (
            'galería' if gal else 'lista', 'por creación' if F['ajustes']['default_sort_order'] == 1 else 'por actividad',
            'etiqueta obligatoria' if F['ajustes'].get('flags', 0) & REQUIERE_TAG else 'etiqueta opcional'))
        h.append('<div class="%s">' % ('galeria' if gal else 'lista'))
        orden = [p for p in F['posts'] if p.get('fijo')] + [p for p in F['posts'] if not p.get('fijo')]
        for p in orden:
            img = ('<img src="iconos/%s.png">' % p['icono']) if p.get('icono') and not p.get('adopta') else \
                ('<img src="iconos/%s.png" style="opacity:.45" title="adoptado: su ícono es el de quien lo creó">' % p['icono']
                 if p.get('icono') else '<div style="width:84px;height:84px"></div>')
            est = 'adoptado (%s)' % p['adopta'] if p.get('adopta') else 'nuevo'
            h.append('<div class="post%s">%s<div><div class="t">%s</div><div class="pt">%s</div><div class="x">%s</div>'
                     '<div class="est">%s%s</div></div></div>' % (
                         ' fijo' if p.get('fijo') else '', img, html.escape(p['titulo']),
                         ''.join('<span>%s</span>' % html.escape(x) for x in p.get('tags', [])),
                         html.escape(re.sub(r'\*\*', '', p.get('texto') or ''))[:160],
                         est, (' · escribe: ' + html.escape(p['bot'])) if p.get('bot') else ''))
        h.append('</div><h1 style="margin-top:18px;font-size:16px">El primer mensaje de cada post nuevo</h1>')
        for p in orden:
            if p.get('adopta') and not (p.get('texto')):
                continue
            h.append('<div class="msg">%s%s</div>' % (_md(texto_de(nombre, p, ids)),
                     ('<br><img src="iconos/%s.png" style="width:160px;border-radius:8px;margin-top:6px">' % p['icono'])
                     if p.get('icono') and not p.get('adopta') else '<br><small>(ficha que deja el bot: el post ya existe)</small>'))
        h.append('</div>')
        fn = os.path.join(carpeta, nombre + '.html')
        with io.open(fn, 'w', encoding='utf-8') as f:
            f.write('<!doctype html><meta charset="utf-8"><title>%s</title><style>%s</style>%s' % (nombre, CSS, ''.join(h)))
        paginas.append(fn)
    with io.open(os.path.join(carpeta, 'plan.json'), 'w', encoding='utf-8') as f:
        json.dump({k: {'id': F['id'], 'ajustes': F['ajustes'], 'tags': F['tags'],
                       'posts': [dict(p, primer_mensaje=texto_de(k, p, {})) for p in F['posts']]}
                   for k, F in FOROS.items()}, f, ensure_ascii=False, indent=1)
    with io.open(os.path.join(carpeta, 'instrucciones_dlx.txt'), 'w', encoding='utf-8') as f:
        f.write(instrucciones(hecho))
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as pw:
            b = pw.chromium.launch()
            pg = b.new_page(viewport={'width': 800, 'height': 900})
            for fn in paginas:
                pg.goto('file:///' + fn.replace('\\', '/'))
                pg.screenshot(path=fn[:-5] + '.png', full_page=True)
            # la hoja de íconos
            pg.set_content('<body style="margin:0;background:#313338;font:12px sans-serif;color:#ddd">'
                           '<div id="h" style="display:grid;grid-template-columns:repeat(6,130px);gap:10px;padding:12px">%s'
                           '</div></body>' % ''.join(
                               '<div><img src="file:///%s" style="width:120px"><br>%s%s</div>' % (
                                   os.path.join(ic, k + '.png').replace('\\', '/'), k,
                                   ' · nuevo' if k in ICONOS_SVG else ' · Cosmic') for k in iconos_usados()))
            pg.locator('#h').screenshot(path=os.path.join(carpeta, 'iconos.png'))
            b.close()
    except Exception as e:                                # noqa: BLE001
        print('  (sin PNG de la vista: %s)' % str(e)[:120])
    print('vista en %s: %s' % (carpeta, ', '.join(os.path.basename(x) for x in paginas)))
    return 0


# ── el resto ───────────────────────────────────────────────────────────────────────────────────────────────────────
def madrugada():
    """De 3 a 11 AM ET no se toca DRA."""
    import datetime as dt
    try:
        from zoneinfo import ZoneInfo
        h = dt.datetime.now(ZoneInfo('America/New_York')).hour
    except Exception:                                    # noqa: BLE001
        h = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=5)).hour
    return 3 <= h < 11


#: los hilos que el código usa por id: si un día cambian acá, se rompen allá
POR_ID_EN_EL_CODIGO = {'1504110449535483924': 'avisar.CANAL / CANAL_LOGS', '1512342566488768542': 'HILO_VERIF',
                       '1528989133492719686': 'HILO_INVITES'}


def _self_check():
    mal = 0

    def ok(c, que):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('ok' if c else '🔴', que))

    print('\n  dra_staff_foros.py — self-check, sin red\n')
    for nombre, F in FOROS.items():
        nt = {plano(n) for n, _, _ in F['tags']}
        ok(len(F['tags']) <= TAGS_MAX, '%s: %d etiquetas (Discord deja 20)' % (nombre, len(F['tags'])))
        ok(all(len(n) <= 20 for n, _, _ in F['tags']), '%s: ningún nombre de etiqueta pasa de 20' % nombre)
        ok(all(plano(x) in nt for p in F['posts'] for x in p.get('tags', [])), '%s: cada post usa etiquetas del foro' % nombre)
        ok(all(len(p.get('tags', [])) <= TAGS_POST for p in F['posts']), '%s: ningún post lleva más de 5' % nombre)
        ok(sum(bool(p.get('fijo')) for p in F['posts']) == 1, '%s: un solo fijado (Discord deja uno)' % nombre)
        claves = [p['clave'] for p in F['posts']]
        ok(len(claves) == len(set(claves)), '%s: claves sin repetir' % nombre)
        tit = [plano(p['titulo']) for p in F['posts']]
        ok(len(tit) == len(set(tit)), '%s: títulos sin repetir (se buscan por título)' % nombre)
        ok(all(p.get('adopta') or p.get('icono') for p in F['posts']), '%s: todo post nuevo tiene ícono' % nombre)
        ok(all(len(texto_de(nombre, p, {})) <= 2000 for p in F['posts']), '%s: cada primer mensaje entra en 2.000' % nombre)
    usados = iconos_usados()
    ok(all(k in ICONOS_COSMIC or k in ICONOS_SVG for k in usados), 'cada ícono sale de Cosmic o de un SVG')
    ok(not set(ICONOS_COSMIC) & set(ICONOS_SVG), 'ningún ícono está en los dos lados')
    adopt = {p.get('adopta') for F in FOROS.values() for p in F['posts']}
    ok(set(POR_ID_EN_EL_CODIGO) <= adopt, 'los tres hilos que usa el código se adoptan, no se crean de nuevo')
    try:
        src = io.open(os.path.join(BASE, 'bot', 'verificar_dc.js'), encoding='utf-8').read()
        ok("HILO_VERIF = '1512342566488768542'" in src and "HILO_INVITES = '1528989133492719686'" in src,
           'verificar_dc.js sigue apuntando a los mismos hilos')
        src = io.open(os.path.join(BASE, 'bot', 'avisar.py'), encoding='utf-8').read()
        ok("CANAL = '1504110449535483924'" in src, 'avisar.py sigue apuntando a LIGA GLOBAL')
    except OSError:
        ok(False, 'no pude leer bot/verificar_dc.js o bot/avisar.py')
    ok(plano('📌 MODERACIÓN') == 'moderacion' and plano('LIGA GLOBAL ID') != plano('LIGA GLOBAL'),
       'plano(): sin emoji ni acento, y no junta títulos distintos')
    # en seco no se crea nada que ya esté: un hilo con el título ya existe → se adopta
    hilos = {'9': {'id': '9', 'name': '📌 Moderación'}}
    ok(buscar({'clave': 'x', 'titulo': 'MODERACIÓN'}, hilos, {})['id'] == '9', 'un post con el mismo título se reusa')
    ok(buscar({'clave': 'x', 'titulo': 'OTRO'}, hilos, {}) is None, 'uno que no está se crea')
    print('\n   %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return 1 if mal else 0


def main():
    a = sys.argv[1:]
    if '--auto' in a:
        return _self_check()
    if '--vista' in a:
        i = a.index('--vista')
        carpeta = a[i + 1] if i + 1 < len(a) else os.path.join(BASE, 'salida', 'dra_staff_foros')
        return vista(os.path.abspath(carpeta), Discord(False) if _token() else None)
    if not _token():
        print('Falta el token del bot (.env o DISCORD_TOKEN).')
        return 1
    aplicar = '--aplicar' in a
    if aplicar and madrugada():
        print('De 3 a 11 AM ET no se toca DRA (la madrugada). Córrelo después de las 11.')
        return 1
    if not aplicar and '--ver' not in a:
        print(__doc__.split('\n\n')[1])
        return 0
    plan(Discord(aplicar))
    return 0


if __name__ == '__main__':
    sys.exit(main())
