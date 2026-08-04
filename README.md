# Soccer RPG channel bot

Lets any server member run `/create name:<something>` to get their own text channel
and a matching role. Only they can see it at first. They then use `/add` and `/remove`
to grant or take away that role (and with it, access to the channel) from other members.
`/close` deletes their channel and role and frees them up to `/create` a new one.

## How it works

- `/create` sanitizes the name, creates a role, creates a channel that's hidden from
  `@everyone` but visible to that role, and gives the creator the role.
- `/add` / `/remove` look up which channel *you* own and add/remove that role on the
  target user. Nobody can manage a channel they don't own.
- Ownership is tracked in `channels.json` (created automatically next to `index.js`
  the first time someone runs `/create`). This is local file storage, not a database —
  see "Persistence" below before you deploy.

## Setup (whoever is hosting it)

1. **Create the app + bot** — go to https://discord.com/developers/applications →
   New Application → Bot tab → Reset Token and copy it. Under
   "Privileged Gateway Intents", turn on **Server Members Intent**.
2. **Invite the bot** — OAuth2 → URL Generator. Scopes: `bot`, `applications.commands`.
   Bot permissions: `Manage Roles`, `Manage Channels`, `View Channels`, `Send Messages`.
   Open the generated URL and add the bot to your server.
3. **Fill in `.env`** — copy `.env.example` to `.env` and fill in `DISCORD_TOKEN`,
   `CLIENT_ID` (the Application ID, same page as the bot token), and `GUILD_ID`
   (your server's ID — enable Developer Mode in Discord settings to copy it).
4. **Run it with Docker** (only prerequisite is Docker Desktop / Docker Engine —
   no Node.js install needed):
   ```
   docker compose run --rm bot node deploy-commands.js   # one-time: register the slash commands
   docker compose up -d                                  # start the bot in the background
   ```
   Re-run the `deploy-commands.js` line any time a command's name/description/options change.
5. **Check logs / stop it**:
   ```
   docker compose logs -f      # tail logs
   docker compose down         # stop (ownership data is kept — it's in a volume)
   ```
6. **Check the bot's role position** — Server Settings → Roles. Drag the bot's own
   role above where you want the new per-user roles to sit, otherwise it won't be
   able to assign/manage them.

Prefer running it without Docker? `npm install`, `npm run deploy-commands`, then
`npm start` works the same way — just note `channels.json` will save next to the
code instead of in a volume.

## Hosting

The bot holds a websocket open to Discord 24/7, so whoever runs the container
needs *something* that stays on — a home PC/NAS, a spare machine, a free-tier VM
(e.g. Oracle Cloud's Always Free ARM instance), or a cheap VPS. `docker compose up -d`
plus `restart: unless-stopped` (already set) means it comes back up automatically
after a reboot or crash.

## Persistence note

`channels.json` (who owns which channel/role) lives in the `bot-data` Docker volume,
so it survives `docker compose down` and container rebuilds. It's only lost if
someone runs `docker compose down -v` (the `-v` deletes volumes too) or removes the
volume directly. If you ever want this centralized instead of living on whoever's
machine runs the container, it's a small table to move into your existing Supabase
project — happy to help with that migration if you get there.

## Easy extensions (not included)

- `/mine` to show which channel you own without needing to remember.
- Letting a mod role always see every created channel.
- Allowing more than one channel per owner.
