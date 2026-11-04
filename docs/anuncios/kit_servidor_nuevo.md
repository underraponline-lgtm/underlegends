# El kit para un servidor nuevo (Tier 3)

Dlx, 04/11/2026: *«un mensaje para enviar a nuevas personas con un link para agregar el bot a sus servidores… ahí explica
lo de tiers, cómo subir de tier, el link de su dashboard, breve explicación de lo que es todo, el comando de settings»*, y
*«también que tienen promoción de sus redes sociales, competencias… dan puntos para el ranking de temporada y tienen su
propio ranking, tiene anti raid, y tienen la capacidad de hacer su propio ranking de ascenso con ayuda del bot»*.

Son tres mensajes porque Discord corta en 2.000 caracteres. Se copian tal cual. Si cambia un requisito, un beneficio o un
comando, se cambia acá. De dónde sale cada cosa: `PRESET`, `MIN_SOLO_TEMPORADA`, `medir()` y `recomendar()` de
`bot/tiers.py`; el ascenso, de `bot/ascenso.py` y `/settings`; las competencias, de `bot/competencias.py` (medido: 12 de los
15 que sólo jugaron en FDS y los 6 de LKR están adentro); los comandos, de la ayuda de `bot/worker.js`; lo que el bot nunca
hace, de `web/src/socios2.jsx`.

⚠️ **Tier 2 y Tier 3 dan hoy lo mismo** (`PRESET`): por eso Tier 2 se explica como el paso hacia Tier 1.

## Mensaje 1

```text
**Bienvenido a la Liga Global de Freestyle** 🎤
Tu servidor entra como **Tier 3**: tus eventos salen en la página de la Liga y dan puntos para el ranking de Temporada.

**1. Agrega el bot**
<https://discord.com/oauth2/authorize?client_id=1550026808404217926&permissions=66561&integration_type=0&scope=bot+applications.commands>
Sólo pide ver canales, leer el historial y crear invitaciones. No es administrador. Lee tus anuncios y tus llaves para cargar cada evento solo, así que tiene que poder ver esos canales.

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
· **Tier 2:** lo mismo, y es el paso hacia Tier 1.
· **Tier 1:** además, tus eventos cuentan para el Competitivo y los Duelos, tu gente tiene la carta de tu servidor y tienes tus propios MES AWARDS.

**Cómo subir**
El dashboard te da un puntaje de 0 a 100 con tus últimas 4 semanas:
· **Actividad (35):** eventos por semana. Con 2 llegas al tope.
· **Alcance (25):** raperos por evento y gente nueva.
· **Calidad (25):** llaves que el bot lee solo, anuncios que dicen quién organiza y pocos cancelados.
· **Comunidad (15):** los nuevos que vuelven, las promos y las ligas.

**De Tier 3 a Tier 2:** anunciar 2 eventos o más en 4 semanas.
**De Tier 2 a Tier 1:** 60 puntos o más, 4 eventos o más en 4 semanas, que el bot lea tus llaves casi solo y 300 miembros (se recomiendan 500).
El sistema lo mide y yo confirmo el cambio.

**Los comandos**
· `/settings` (admins): en qué canal cuenta el bot tus eventos en vivo, dónde avisa los cambios de rango, tu ranking de ascenso, dónde se puede usar `/card` y el #N del ranking en los apodos. Los canales vienen apagados, y el bot tiene que poder escribir ahí.
· `/antiraid` (sólo el dueño): escudo contra spam, alarma si entra mucha gente de golpe y botón de pánico.
· `/agendar` (staff y organizadores): pone un evento en el calendario con tiempo.
· `/help`: todos los comandos.

Para cualquier duda, escríbeme.
```
