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
          datos/bloqueadas_selladas.json datos/web_sello.json \n          datos/bot_en.json"
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
if git diff --quiet -- $ARCHIVOS; then
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
mkdir -p /tmp/gen
# ⚠️ `if [ -f ]` Y NO `cp` A SECAS: un archivo de la lista que
# todavia no existe —recien agregado, o que el paso que lo
# escribe no llego a correr— mataba el paso entero con
# «No such file or directory», y con el se perdia el sello de
# TODAS las demas. Un archivo que falta no tiene nada que
# preservar; `git diff` y `git add` ya saben tratar la ausencia.
for f in $ARCHIVOS; do if [ -f "$f" ]; then cp "$f" "/tmp/gen/$(basename $f)"; fi; done
# la BASE de los sellos: como estaban en el checkout. Ver unir_sellos.py
for f in cartas_selladas bloqueadas_selladas; do
  git show "HEAD:datos/$f.json" > "/tmp/gen/base_$f.json" 2>/dev/null || true
done
git fetch -q origin "${GITHUB_REF_NAME}"
git reset -q --hard "origin/${GITHUB_REF_NAME}"
# 🔴 EL SELLO SE **UNE**, NO SE ELIGE. Para los pools, el
# padron y el inventario de R2 «gana el mio» es correcto: son
# mediciones y la mia es la de recien. El sello no: el mio sale
# del checkout, que puede ser mas VIEJO que el de origin —fue
# el caso, checkout de las 18:57 contra un sello de las 19:35—.
# Quedarme con el mio tira los sellos de la corrida anterior y
# la siguiente redibuja todo, que es el bucle de 120 min por
# hora que `always()` existe para cortar.
for f in cartas_selladas bloqueadas_selladas; do
  if [ -f "/tmp/gen/$f.json" ]; then
    python herramientas/unir_sellos.py \
      "/tmp/gen/$f.json" "datos/$f.json" "/tmp/gen/$f.json" \
      "/tmp/gen/base_$f.json"
  fi
done
for f in $ARCHIVOS; do B="/tmp/gen/$(basename $f)"; if [ -f "$B" ]; then cp "$B" "$f"; fi; done
if git diff --quiet -- $ARCHIVOS; then
  echo "despues de sincronizar no queda nada nuevo"
  exit 0
fi
git add $ARCHIVOS
git commit -q -m "ciclo: $(date -u +%Y-%m-%d\ %H:%M) UTC"
# ⚠️ EL REINTENTO SIGUE, PERO AHORA PUEDE GANAR: lo unico que
# puede fallar es que alguien haya empujado entre el fetch y el
# push, y ahi volver a sincronizar SI cambia el resultado.
for i in 1 2 3; do
  git push -q origin "HEAD:${GITHUB_REF_NAME}" && exit 0
  echo "push rechazado, reintento $i"
  git fetch -q origin "${GITHUB_REF_NAME}"
  for f in $ARCHIVOS; do if [ -f "$f" ]; then cp "$f" "/tmp/gen/$(basename $f)"; fi; done
  git reset -q --hard "origin/${GITHUB_REF_NAME}"
  python herramientas/unir_sellos.py \
    /tmp/gen/cartas_selladas.json datos/cartas_selladas.json \
    /tmp/gen/cartas_selladas.json
  for f in $ARCHIVOS; do B="/tmp/gen/$(basename $f)"; if [ -f "$B" ]; then cp "$B" "$f"; fi; done
  git add $ARCHIVOS
  git commit -q -m "ciclo: $(date -u +%Y-%m-%d\ %H:%M) UTC" || true
  sleep 5
done
echo "no pude empujar el sello despues de 3 intentos"
exit 1
