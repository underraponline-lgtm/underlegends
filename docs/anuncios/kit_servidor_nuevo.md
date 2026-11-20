# El kit para un servidor nuevo (Tier 3)

Dlx, 04/11/2026: *«un mensaje para enviar a nuevas personas con un link para agregar el bot a sus servidores… ahí explica
lo de tiers, cómo subir de tier, el link de su dashboard, breve explicación de lo que es todo, el comando de settings»*, y
*«también que tienen promoción de sus redes sociales, competencias… dan puntos para el ranking de temporada y tienen su
propio ranking, tiene anti raid, y tienen la capacidad de hacer su propio ranking de ascenso con ayuda del bot»*.

⚠️ **Desde el 17/11/2026 cada servidor tiene además su kit privado en la página** (`bot/kits.py` → `/freestyle-rap/kit/<código>`):
lo mismo que estos mensajes y cómo está el bot ahí, al día. El link de cada uno lo da `python bot/kits.py --links`.
El bot se agrega como **Administrador** (Dlx, 17/11: *«el link con permiso de admin en su rol propio para evitar problemas así»*):
con los permisos justos le faltaban «Gestionar apodos» y «Gestionar servidor» en seis servidores, y en FVS leer el historial.

Son tres mensajes porque Discord corta en 2.000 caracteres. Se copian tal cual. Si cambia un requisito, un beneficio o un
comando, se cambia acá. De dónde sale cada cosa: `PRESET`, `MIN_SOLO_TEMPORADA`, `medir()` y `recomendar()` de
`bot/tiers.py`; el ascenso, de `bot/ascenso.py` y `/settings`; las competencias, de `bot/competencias.py` (medido: 12 de los
15 que sólo jugaron en FDS y los 6 de LKR están adentro); los comandos, de la ayuda de `bot/worker.js`; lo que el bot nunca
hace, de `web/src/socios2.jsx`.

⚠️ **Desde el 19/11/2026 el Tier 2 da lo mismo que el Tier 1** (`PRESET`), menos «Unirme a los Tier 1» (Dlx: «Tier 2 que cuenten sus eventos para competitivo y tener su tarjeta de servidor aun así»). Hasta ese día daba lo mismo que el Tier 3.

## Mensaje 1

```text
**Bienvenido a la Liga Global de Freestyle** 🎤
Tu servidor entra como **Tier 3**: tus eventos salen en la página de la Liga y dan puntos para el ranking de Temporada.

**1. Agrega el bot**
<https://discord.com/oauth2/authorize?client_id=1550026808404217926&permissions=8&integration_type=0&scope=bot+applications.commands>
Entra como **administrador, con su propio rol**: así no le falta ningún permiso (el #N en los apodos, contar quién entra por tu invitación, leer tus llaves y veredictos). Después sube su rol por encima de los roles de tu gente. Lo que nunca hace está abajo.

**2. Avísame cuando esté adentro** y activo tu servidor.

**3. Entra a tu dashboard** con la cuenta de Discord del dueño del servidor:
<https://underlegends.pages.dev/freestyle-rap/socio>
Ahí ves tu puntaje, qué días juntan más gente, cuántos vuelven a jugar, a quién invitar y los ajustes del bot.

**Lo que el bot nunca hace:** expulsar, banear, borrar mensajes de tu gente ni mandarle privados.
```

## Mensaje 2

```text
**Lo que tienes en Tier 3**
· **Puntos:** tus eventos de 8 personas o más suman al ranking de Temporada de toda la Liga.
· **Tu propio ranking:** quién hace más puntos en tu servidor, en tu página y en tu dashboard.
· **Tu ranking de ascenso:** pásame tu tabla y tus rangos, y el bot lo mantiene al día en el canal que elijas.
· **Promoción:** tu página con tu invitación y tus redes, tus posts en las redes de Under Legends, y lo que tu gente comparte en tu canal de promoción sale en Publicaciones.
· **Tus eventos:** en el calendario de la Liga y en los avisos al celular, con la llave en vivo.
· **Competencias:** tu gente entra a las ligas por niveles, la Copa, las Rapid y los mini eventos.
· **Tus ligas:** con su lugar en la sección Ligas.
· **Cada semana:** multiplicador de puntos y guerra contra otro servidor.
· **Anti-raid:** opcional, con `/antiraid`.
```

## Mensaje 3

```text
**Cómo funcionan los tiers**
· **Tier 3:** lo que ya tienes.
· **Tier 2:** además, tus eventos cuentan para el Competitivo y los Duelos, tu gente tiene la carta de tu servidor y tienes tus propios MES AWARDS.
· **Tier 1:** lo mismo, y tu servidor sale en «Unirme a los Tier 1», el botón que suma gente a tu Discord con un toque.

**Cómo subir**
El dashboard te da un puntaje de 0 a 100 con tus últimas 4 semanas:
· **Actividad (35):** eventos por semana. Con 2 llegas al tope.
· **Alcance (25):** raperos por evento y gente nueva.
· **Calidad (25):** llaves que el bot lee solo, anuncios que dicen quién organiza y pocos cancelados.
· **Comunidad (15):** los nuevos que vuelven, las promos y las ligas.

**De Tier 3 a Tier 2:** anunciar 2 eventos o más en 4 semanas.
**De Tier 2 a Tier 1:** 60 puntos o más, 4 eventos o más en 4 semanas y que el bot lea tus llaves casi solo.
**Los miembros de tu Discord no son requisito.** Se recomiendan 100 en Tier 3, 500 en Tier 2 y 1.000 en Tier 1.
El sistema lo mide y yo confirmo el cambio.

**Los comandos**
· `/settings` (admins): en qué canal cuenta el bot tus eventos en vivo, dónde avisa los cambios de rango, tu ranking de ascenso, dónde se puede usar `/card` y el #N del ranking en los apodos. Los canales vienen apagados, y el bot tiene que poder escribir ahí.
· `/antiraid` (sólo el dueño): escudo contra spam, alarma si entra mucha gente de golpe y botón de pánico.
· `/agendar` (staff y organizadores): pone un evento en el calendario con tiempo.
· `/help`: todos los comandos.

Para cualquier duda, escríbeme.
```
