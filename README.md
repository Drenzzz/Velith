# Velith

Velith is a Discord collection game. One server gets one waifu per cycle. Members tap the claim button. First tap wins. The database is the source of truth.

Female character pool only. Pool sourced from AniList, normalized, deduplicated, content-filtered.

## Requirements

- Bun 1.3.14 or higher
- PostgreSQL 16
- Discord application + bot token

## Quick Start

```bash
# 1. Install dependencies
bun install

# 2. Configure environment
cp .env.example .env
# Edit .env with your DISCORD_TOKEN, DISCORD_CLIENT_ID, DATABASE_URL

# 3. Apply database migrations
bun run db:migrate

# 4. Import character pool (one-time, fetches from AniList)
bun run import:characters --pages=3

# 5. Deploy slash commands to your test guild
COMMAND_SCOPE=guild TEST_GUILD_ID=<your_guild_snowflake> bun run deploy:commands

# 6. Run the bot
bun run start
```

Run `/setup` in your Discord server to register the waifu channel and cycle duration.

## Public Installation

Velith supports multiple Discord servers. Each server gets its own waifu channel, cycle, collection, and claim history.

One-time setup in the Discord Developer Portal:

1. Enable **Public Bot** for the application.
2. Keep `DISCORD_CLIENT_ID` and `DISCORD_TOKEN` in `.env`.

Deploy commands globally for public use:

```bash
COMMAND_SCOPE=global bun run deploy:commands
```

Global command updates can take time to appear. Run `/invite` in a server where Velith is already installed, then share the generated link. A person installing Velith must have **Manage Server** or **Administrator** permission in the target server. After installation, run `/setup` in that server.

## Architecture

```
Discord
  ↓
discord.js (REST + WebSocket)
  ↓
Bot services (waifu, claim, collection, scheduler)
  ↓
Drizzle ORM
  ↓
PostgreSQL
```

External data pipeline:
```
AniList GraphQL
  ↓
Importer CLI (one-shot or scheduled)
  ↓
Normalizer + Deduplicator + Content Filter
  ↓
PostgreSQL pool
```

No HTTP server. No web dashboard. All interaction happens through Discord.

## Discord Commands

| Command | Function | Access |
|---------|----------|--------|
| `/waifu` | Show the active waifu | All members |
| `/claim` | Fallback to the claim button | All members |
| `/harem` | Show your collection, paginated | All members |
| `/profile` | Show your stats | All members |
| `/leaderboard` | Show top collectors, paginated | All members |
| `/history` | Show recent claims, paginated | All members |
| `/invite` | Generate a link to add Velith to another server | All members |
| `/setup` | Configure waifu channel and cycle duration | Administrator |
| `/admin reroll` | Replace the active waifu | Administrator |
| `/admin spawn` | Force spawn a new waifu | Administrator |
| `/admin reset` | Mark active as expired and spawn a new one | Administrator |

## Development

```bash
bun run typecheck        # Run TypeScript checker
bun run start            # Run bot in foreground
bun run dev              # Run with auto-reload
bun run db:generate      # Generate migration from schema changes
bun run db:migrate       # Apply pending migrations
bun run db:studio        # Open Drizzle Studio
bun run import:characters --pages=3  # Fetch characters from AniList
COMMAND_SCOPE=guild TEST_GUILD_ID=<guild_id> bun run deploy:commands  # Development
COMMAND_SCOPE=global bun run deploy:commands                         # Public deployment
```

Scripts:

- `scripts/deploy-commands.ts` — REST push guild- or global-scoped commands
- `scripts/import-characters.ts` — Character pool importer
- `scripts/cleanup-gender.ts` — One-time cleanup of non-female characters
- `scripts/stress-claim.ts` — Concurrent claim race-safety test
- `scripts/backup.sh` — pg_dump with rotation

## Deployment

### Docker Compose

```bash
# 1. Set environment in .env (DISCORD_TOKEN, POSTGRES_PASSWORD, etc.)
# 2. Start services
docker compose up -d

# 3. Apply migrations (first run)
docker compose exec bot bun run db:migrate

# 4. Import characters (first run)
docker compose exec bot bun run import:characters --pages=3

# 5. View logs
docker compose logs -f bot
```

### VPS (Ubuntu 24.04 LTS)

Recommended minimum: 2 vCPU, 2 GB RAM, 20 GB SSD. Region: Singapore.

```bash
# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# Clone repo and configure
git clone <repo-url> /opt/velith
cd /opt/velith
cp .env.example .env
# Edit .env with production values

# Build and start
docker compose up -d
docker compose exec bot bun run db:migrate
docker compose exec bot bun run import:characters --pages=5
```

### Backup

PostgreSQL needs regular backups. The included script uses `pg_dump` with 7-day retention.

```bash
# Edit crontab
crontab -e

# Add daily backup at 03:00 server time
0 3 * * * /opt/velith/scripts/backup.sh >> /var/log/waifu-backup.log 2>&1
```

Backup files are stored in `./backups/` with timestamp filenames. Restore:

```bash
pg_restore --host=<host> --username=<user> --dbname=<db> --clean backups/discord_waifu_2026-08-17_03-00.sql.gz
```

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DISCORD_TOKEN` | Yes | Bot token from Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Yes | Application ID from Discord Developer Portal |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `ANILIST_API_URL` | No | Defaults to `https://graphql.anilist.co` |
| `JIKAN_API_URL` | No | Defaults to `https://api.jikan.moe/v4` |
| `LOG_LEVEL` | No | `fatal` / `error` / `warn` / `info` / `debug` / `trace`. Default `info` |
| `APP_ENV` | No | `development` / `production` / `test`. Default `production` |
| `TEST_GUILD_ID` | Only for `deploy:commands` | Discord guild snowflake ID |

## Project Structure

```
bot/
├── src/
│   ├── bot/          # discord.js client, commands, interactions
│   ├── character/    # rarity tier, content filter
│   ├── claim/        # atomic claim service
│   ├── commands/     # pagination utility
│   ├── config/       # env loader
│   ├── db/           # Drizzle schema, client, migrations
│   ├── importer/     # AniList client + service
│   ├── logger/       # pino structured logger
│   ├── scheduler/    # tick loop, spawn
│   └── waifu/        # embed builder, spawn, post, edit
├── scripts/          # CLI utilities
├── Dockerfile         # multi-stage build
└── docker-compose.yml # bot + postgres services
```

## License

MIT
