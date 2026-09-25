#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# GUARDAR LO QUE SOBREVIVE ENTRE CORRIDAS: el sello, los pools y los
# respaldos de identidad.
#
# 🔴 VIVE EN UN ARCHIVO Y NO EN EL `.yml` PORQUE LO LLAMAN DOS TRABAJOS.
# Desde el 24/09/2026 el ciclo está partido en `escuchar` (cada media
# hora, barato) y `dibujar` (sólo cuando hay algo, caro), y los dos
# tienen que commitear. Copiar estas 130 líneas en los dos lugares es
# exactamente la forma que este repo documenta cinco veces —el rango en
# cinco sitios, `escudo()` escrito tres— y que siempre termina igual:
# una copia se queda vieja y nadie se entera.
#
# Se llama así, desde el workflow:
#     bash bot/ci/guardar.sh
# ════════════════════════════════════════════════════════════════════
set -euo pipefail

# 🔴 LOS POOLS TAMBIEN, Y NO ES OPCIONAL. El paso 1 los
# **reescribe** desde el Sheet en cada corrida y estan
# trackeados, asi que dejarlos sin commitear tiene dos costos:
#
#  · `git pull --rebase --autostash` tiene que hacer stash y
#    pop de archivos de 200 KB. Si el pop conflictua, el pull
#    falla, el push no ocurre y **el sello se pierde despues de
#    haber subido las cartas** — trabajo hecho que la proxima
#    corrida repite entera.
#  · el repo empieza a mentir. `CLAUDE.md` dice que `datos/` es
#    la unica fuente de verdad; con los pools viejos ahi, quien
#    clone y corra algo local dibuja con datos de otro dia.
#
# Commitearlos hace el rebase limpio y mantiene el repo cierto.
# El diff es grande sólo cuando el Sheet cambió, que es
# exactamente cuando queremos que quede registrado.
#
# 🔴 `canales_llaves.json` TAMBIEN, Y SIN EL LA OPTIMIZACION NO
# EXISTE. Es la memoria de en que canales aparecen llaves: sin
# commitearla, cada corrida arranca sin memoria, cae al barrido
# completo —48 s en vez de 1— y el ciclo por hora vuelve a no
# entrar en la cuota. No falla: sale mas caro, en silencio.
#
# 🔴 `padron.json` DESDE EL 22/09: el paso 2 lo reescribe y es
# la fuente de identidad. Sin commitearlo, el repo se queda
# con el de la última vez que alguien corrió el script a mano
# — que fue lo que pasó: el archivo era del 19/09 y le
# faltaban 5 personas y 330 marcas de verificado.
#
# 🔴 Y LOS TRES RESPALDOS DE IDENTIDAD, DESDE EL 22/09/2026.
# `verificados.json`, `servidores_de.json` y `fotos_etag.json`
# los **reescribe** el ciclo y no los commiteaba nadie: solo
# entraban al repo cuando alguien lo hacia a mano. Medido ese
# dia: el del porton era de hace 15 horas y el de servidores de
# hace 17, mientras el ciclo los refrescaba cada hora.
#
# 🔴 `avisados.json` DESDE EL 23/09/2026, Y ES EL QUE DLX VIO.
# Es la memoria de que llaves ya se anunciaron en Discord. Sin
# commitearla el runner arranca **sin memoria** y vuelve a
# anunciar las mismas llaves cada hora: el #349 y el #350 a la
# 1:34, 1:42, 1:51… que es exactamente lo que Dlx reporto con
# seis capturas de `#registros`.
#
# ⚠️ EL DEDUP YA ESTABA Y NO ALCANZABA, que es lo que hay que
# aprender de este: `bot/avisar.py` deduplicaba bien desde el
# commit anterior, andaba perfecto en esta PC, y el archivo
# donde anota **se borraba con el runner**. Un dedup cuyo
# estado no sobrevive no es un dedup — es la misma forma que
# `mapa_viejo()` mirando `mtime`.
#
# ⚠️ NO ROMPE MIENTRAS TODO ANDE, y por eso no se habia visto:
# los tres se refrescan al empezar la corrida, asi que dentro de
# la corrida son de ahora. Lo que son es **el respaldo de cuando
# el servicio no contesta** —`verificados.cargar()` esta escrito
# para eso—, y un respaldo de hace 17 horas en un runner limpio
# le saca la carta a quien se verifico en el medio. El respaldo
# que nadie actualiza es el caso que este proyecto ya se comio
# con `servidores_de.json` a los 3 dias: 19 entraban, 11 salian
# y 5 habian cambiado de servidor.
ARCHIVOS="datos/cartas_selladas.json datos/cartas_r2.json \
          datos/competitivo_pool.json datos/temporada_pool.json \
          datos/bloqueados.json datos/canales_llaves.json \
          datos/padron.json datos/verificados.json \
          datos/servidores_de.json datos/fotos_etag.json \
          datos/anuncios.json datos/avisados.json \
          datos/akas.json datos/decisiones.json \
          datos/bloqueadas_selladas.json datos/web_sello.json \
          datos/bot_en.json datos/alertas.json \
          datos/llaves_t1.json datos/llaves_links.json \
          datos/autoverificar.json datos/escala.json \
          datos/iconos_sv.json datos/comunidad.json"
# 🔴 CADA PALABRA DE LA LISTA TIENE QUE SER UN `datos/*.json`, Y SE MIRA.
# El 24/09/2026 a las 5:22 PM ET entró un `\n` literal —una edición con
# heredoc se comió la barra— y `bash -n` dio bien, porque es sintaxis
# válida: `git add` lo tomó como archivo, murió con «pathspec '\n' did
# not match», el trabajo quedó en rojo, `dibujar` se salteó y la corrida
# no guardó nada. Mejor morir acá, diciendo por qué, que ahí.
for f in $ARCHIVOS; do
  case "$f" in
    datos/*.json) ;;
    *) echo "🔴 ARCHIVOS tiene algo que no es un archivo de datos: «$f»"; exit 1 ;;
  esac
done
# 🔴 LOS DOS ULTIMOS FALTARON DOS DIAS, Y COSTABAN 48 VECES POR DIA.
# Medido el 24/09/2026 en cuatro corridas seguidas: las mismas 186
# Bloqueadas se redibujaban y se subian a R2 en CADA corrida —con la
# bajada de Chromium y de 427 fotos para eso— y el hub se volvia a
# desplegar en Cloudflare Pages en cada corrida, «el sitio cambió». Los
# dos pasos tenian su sello y los dos lo escribian bien: el archivo
# moria con el runner. Es la octava vez que esta lista se queda corta;
# por eso ahora, mas abajo, el guardado AVISA lo que no guarda.
# ⚠️ `bot_en.json` DESDE `--solo-dibujar`: el trabajo `dibujar` ya no
# vuelve a preguntarle a Discord en qué servidores está el bot, así
# que lo lee del commit de `escuchar` — y sin esto leía el del 24/09
# a la madrugada, con DRA y FFA, y lo escribía en KV al final.
# 🔴 LO QUE EL CICLO CAMBIO Y ESTA LISTA NO GUARDA, DICHO EN VOZ ALTA.
# Una lista escrita a mano se queda corta sola —pasó ocho veces— y
# no falla: el estado se pierde con el runner y la corrida siguiente
# repite el trabajo. Esto no decide nada; sólo lo pone en el log.
# ⚠️ Los `entrada_*.json` no son estado: son la copia del día de lo
# que ya está en `Resultados`, y se rehacen de Discord.
SUELTOS=""
for f in $(git diff --name-only -- datos/; \
           git ls-files --others --exclude-standard -- datos/); do
  case " $ARCHIVOS " in
    *" $f "*) ;;
    *) case "$f" in datos/entrada_*.json) ;; *) SUELTOS="$SUELTOS $f" ;; esac ;;
  esac
done
if [ -n "$SUELTOS" ]; then
  echo "🔴 el ciclo cambió y NO se guarda:$SUELTOS"
  echo "   la corrida siguiente no lo va a ver — ¿falta en ARCHIVOS?"
fi
# 🔴 `git diff` NO VE UN ARCHIVO QUE GIT TODAVÍA NO CONOCE. Un estado que
# el ciclo crea por primera vez —`autoverificar.json` el 25/09/2026— daba
# «nada cambió» y no se guardaba nunca: la corrida siguiente arrancaba sin
# él, lo volvía a crear y tampoco. Y `git add` de un archivo de la lista
# que no existe muere. Se pregunta de a uno (auditoría del 25/09/2026).
cambio() {
  [ -f "$1" ] || return 1
  if git ls-files --error-unmatch -- "$1" >/dev/null 2>&1; then
    ! git diff --quiet -- "$1"
  else
    return 0
  fi
}
hay_cambios() {
  for f in $ARCHIVOS; do cambio "$f" && return 0; done
  return 1
}
existentes() {
  for f in $ARCHIVOS; do [ -f "$f" ] && printf '%s ' "$f"; done
  return 0
}
if ! hay_cambios; then
  echo "nada cambió: no hay nada que commitear"
  exit 0
fi
git config user.name  "liga-global-ciclo"
git config user.email "ciclo@users.noreply.github.com"
# 🔴 SE SINCRONIZA ANTES DE COMMITEAR, NO DESPUES, Y ESTO
# CAMBIO EL 22/09/2026 PORQUE SE PERDIO UN SELLO.
#
# Antes era: commitear, `git pull --rebase`, push, y hasta tres
# reintentos. Falla de dos maneras a la vez:
#
#  · Un rebase que conflictua deja el repo **con archivos sin
#    resolver**, asi que el `git pull` del reintento 2 muere en
#    «Pulling is not possible because you have unmerged files»
#    y el 3 tambien. Tres intentos de los cuales solo uno podia
#    andar. Medido: los tres fallaron con el mismo mensaje.
#  · Y reintentar no servia igual: el conflicto es
#    **determinista** —los commits del otro siguen ahi—, asi
#    que lo unico que cambiaba entre intentos era el reloj.
#
# Ahora: guardar lo generado aparte, poner el arbol EXACTAMENTE
# en origin, volver a poner lo generado, commitear y empujar.
# Sin rebase no hay conflicto posible.
#
# 🔴 Y SÓLO LO QUE ESTA CORRIDA CAMBIÓ SE PONE ENCIMA DE ORIGIN.
# Antes se volvía a poner la lista ENTERA, también lo que la
# corrida no tocó y traía tal cual del checkout. Mientras cada
# trabajo reescribía todo daba igual; desde `--solo-dibujar`, el
# trabajo `dibujar` no reescribe los pools ni `avisados.json`, y
# si dura más que media hora —un redibujo de dos horas— al
# terminar DEVOLVÍA A SU VERSIÓN VIEJA lo que `escuchar` había
# commiteado mientras tanto. Con `avisados.json`, eso es la
# memoria de qué llaves ya se anunciaron: avisos repetidos en
# Discord. Visto el 24/09/2026 leyendo este archivo, antes de
# que pasara.
#
# ⚠️ Y SE PARTE SIEMPRE DE LO QUE LA CORRIDA GENERÓ, también en
# los reintentos. El reintento de antes copiaba el árbol ya
# unido, así que lo que había traído de origin la primera vez
# pasaba a contar como «mío» en la segunda.
CAMBIADOS=""
for f in $ARCHIVOS; do
  if cambio "$f"; then
    CAMBIADOS="$CAMBIADOS $f"
  fi
done
echo "cambió en esta corrida:${CAMBIADOS:- nada}"
mkdir -p /tmp/gen/orig
for f in $CAMBIADOS; do cp "$f" "/tmp/gen/orig/$(basename "$f")"; done
# la BASE de los sellos: como estaban en el checkout. Ver unir_sellos.py
for f in cartas_selladas bloqueadas_selladas; do
  git show "HEAD:datos/$f.json" > "/tmp/gen/base_$f.json" 2>/dev/null || true
done

# 🔴 EL SELLO SE **UNE**, NO SE ELIGE. Para los pools, el
# padron y el inventario de R2 «gana el mio» es correcto: son
# mediciones y la mia es la de recien. El sello no: el mio sale
# del checkout, que puede ser mas VIEJO que el de origin —fue
# el caso, checkout de las 18:57 contra un sello de las 19:35—.
# Quedarme con el mio tira los sellos de la corrida anterior y
# la siguiente redibuja todo, que es el bucle de 120 min por
# hora que `always()` existe para cortar.
sincronizar() {
  git fetch -q origin "${GITHUB_REF_NAME}"
  git reset -q --hard "origin/${GITHUB_REF_NAME}"
  for f in $CAMBIADOS; do
    b="$(basename "$f" .json)"
    if [ "$b" = "cartas_selladas" ] || [ "$b" = "bloqueadas_selladas" ]; then
      python herramientas/unir_sellos.py "/tmp/gen/orig/$b.json" "$f" "$f" "/tmp/gen/base_$b.json"
    else
      cp "/tmp/gen/orig/$b.json" "$f"
    fi
  done
}

sincronizar
if ! hay_cambios; then
  echo "despues de sincronizar no queda nada nuevo"
  exit 0
fi
git add -- $(existentes)
# ⚠️ EN HORA DEL ESTE, que es la que lee Dlx: «I told you to refer
# everything as my local time zone EST» (24/09/2026). Decía «UTC».
# ⚠️ POR PYTHON Y NO POR `TZ=… date`: sin la base de husos, `date` no
# falla — devuelve UTC y le pone «ET» igual. Medido en esta PC: dijo
# «12:09 AM ET» a las 8:09 PM. Si Python no puede, se dice UTC, que es
# la verdad.
MENSAJE="ciclo: $(python -c "import datetime as d, zoneinfo as z; t = d.datetime.now(z.ZoneInfo('America/New_York')); print(t.strftime('%Y-%m-%d ') + t.strftime('%I:%M %p').lstrip('0') + ' ET')" 2>/dev/null || date -u '+%Y-%m-%d %H:%M UTC')"
git commit -q -m "$MENSAJE"
# ⚠️ EL REINTENTO SIGUE, PERO AHORA PUEDE GANAR: lo unico que
# puede fallar es que alguien haya empujado entre el fetch y el
# push, y ahi volver a sincronizar SI cambia el resultado.
for i in 1 2 3; do
  git push -q origin "HEAD:${GITHUB_REF_NAME}" && exit 0
  echo "push rechazado, reintento $i"
  sincronizar
  git add -- $(existentes)
  git commit -q -m "$MENSAJE" || true
  sleep 5
done
echo "no pude empujar el sello despues de 3 intentos"
exit 1
