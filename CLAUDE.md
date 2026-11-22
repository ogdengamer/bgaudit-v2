# bgaudit-v2

Board game shelf audit app. Pulls my BGG collection, filters to a location
(e.g. SHELF), lets me tick games off during a physical audit, and reports
found / missing / new. State lives in Redis so I can switch between phone and PC.

## Stack
- server/: Node 22, Express, Redis (ES modules)
- web/: plain HTML/CSS/JS, no build step, served as static files by Express
- Docker: Dockerfile + docker-compose.yml (app + redis)

## Gotchas learned the hard way
- BGG login: POST https://boardgamegeek.com/login/api/v1, keep only non-expired
  Set-Cookie values, then call /xmlapi2/collection with showprivate=1&own=1
- The private location field is `inventorylocation` in the XML (privateinfo attrs),
  `invlocation` in the CSV export
- Use `collid` as the game ID, not `objectid` (same game, different editions share objectid)
- Locations are normalized to UPPERCASE everywhere
- Live BGG import is the main path; CSV import is a backup only
- CSV exports can contain multi-line quoted fields, so the parser is character-based
- WEB_PATH env var points the container at /app/web; default is ../web for dev
- Clipboard API needs HTTPS or localhost; there's a modal fallback

## Development (palantir)
- Code lives on palantir; Node and Redis are NOT installed on the host, use Docker
- Run the dev stack (live reload: server/ and web/ are bind-mounted, `node --watch`):
  `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d`
- Open http://localhost:4000 (or http://palantir:4000); logs: `docker compose logs -f app`
- Stop: `docker compose down` (add `-v` to wipe the Redis volume)
- Single user, one device at a time: concurrent multi-device edits are not a concern

## Git workflow
- Work on a feature branch, open a PR on GitHub (ogdengamer/bgaudit-v2), merge to main
- Don't commit straight to main

## Deploy (not set up yet)
- Likely target: eregion as a container (same docker-compose.yml, app + redis)
- Expected flow once set up: merge PR, then on the host `git pull && docker compose up --build -d`
- HTTPS via Caddy using the internal step-ca ACME endpoint
- Hostnames used previously: bgaudit.shire.spurlocks.org (prod), bgaudit-dev.shire.spurlocks.org

## Backlog ideas
- Remember BGG username
- Progress indicator during BGG import
- UPC barcode scanning for moving games into totes (scan, store UPC per game, assign box)