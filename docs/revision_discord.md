# La revisión de permisos de Discord — las respuestas del formulario

Discord pidió revisar los *privileged intents* de LIGA GLOBAL al pasar los 10.000 usuarios.
**Plazo: 24/12/2026.** Si no se envía, se quitan los permisos. Estado y decisiones, en
`NOVEDADES.md` («🔑 La revisión de permisos»).

Antes de enviar:

- En *General Information*: Privacy Policy URL `https://underlegends.pages.dev/privacidad` y
  Terms of Service URL `https://underlegends.pages.dev/terminos`.
- En *Bot*: «Public Bot» y «Presence Intent» apagados.
- En el formulario: **Server Members** y **Message Content** marcados; **Presence no**.

Las respuestas van en inglés porque las lee gente de Discord.

---

## Application Details

> LIGA GLOBAL is the private bot of Liga Global de Freestyle en Español, a Spanish-language freestyle
> rap league run across a small group of partner Discord servers (Discord Rap Español, Freestyle For
> All, Snake Rap and Urban Freestyle). It turns the results of the league's events into rankings and
> player cards. Members use it only through slash commands: /card (a player's card), /versus (compare
> two players), /verificar (what a player still needs to get a card), /notify (turn on event
> notifications on our website), /website and /borrar-mis-datos (delete your data). It has no prefix
> commands and works over HTTP interactions and the REST API. Results, rankings, profiles and
> tournament brackets are shown on https://underlegends.pages.dev

**Do you have a public Privacy Policy?** Yes — https://underlegends.pages.dev/privacidad

## Server Members Intent

**Why do you need it?**

> We use the member list of our own partner servers to run the league's player registry:
> (1) Verification: a player can have a card only if they have the league's Member role in Discord Rap
> Español, so we check that role for the players in our registry on a schedule. (2) Country: a player's
> country comes from the country roles they chose in the partner servers, and is shown on their card and
> in the country rankings. (3) Home servers: we record which partner servers each registered player
> belongs to, so /card shows the card for the server where it is used. (4) Card photo: the player card
> uses the player's Discord avatar. The bot is private and only added to the league's partner servers;
> member data is not used outside the league.

**Are you storing any API Data off-platform?** Yes.

> Discord user IDs, display names, avatars, league roles and partner-server membership of registered
> players, stored on Cloudflare (Workers KV, R2), in the organization's Google Sheets and in our GitHub
> repository. Used only for the league. Players can delete their data with /borrar-mis-datos.

## Message Content Intent

**Can users opt out of having their message content data tracked?** Yes.

> With /borrar-mis-datos a player deletes their profile, cards, photo and linked data, and the bot stops
> creating them again. Tournament results stay in the league's public history; on request an admin
> replaces the player's name.

**Are you storing message content data off-platform?** Yes.

> Only derived data: event name and date, placements and points, a short summary of each announcement
> for the calendar, and the user ID and display name of each sign-up. We don't store conversations.

**Will it be used to train machine learning or AI models?** No.

**Why do you need it?**

> The bot has no prefix commands. We read a fixed list of event channels in the partner servers, where
> organizers, players and other bots post content that is not addressed to our bot: (1) Tournament
> brackets, often posted by other bots, which we parse to record who played, advanced and won, updating
> rankings and cards automatically. (2) Event announcements (some are YAGPDB cards), which build the
> league's public calendar and opt-in web push notifications for people who subscribed on our website;
> the bot never DMs users. (3) Sign-ups, which link a player's Discord account to their league profile.
> Only the configured channels are read, via GET /channels/{id}/messages; never DMs or other channels.
> Slash commands can't replace this: the data already exists in those channels, and other bots' embeds
> can't reach us through interactions.

## Capturas

El formulario pide, para cada permiso, un link a capturas o un video que lo muestren funcionando en un
servidor. **Pendiente.** Para Message Content: una llave publicada en un canal de eventos al lado de la
misma llave en la página. Para Server Members: `/card` y `/verificar` en DRA.
