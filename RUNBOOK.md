# Atlan Scan — what it takes to run this for real

The product is complete and tested. Everything below is account access I cannot create
for you. Nothing here is code work.

---

## 0. Run it locally right now — no setup at all

```bash
cd ~/Atlan/atlan-scan
npm install          # devDependencies only
npm start            # http://localhost:8787
```

Sign-in falls back to a clearly-labelled dev stub, and scans persist to `./data/scan.db`.
Everything else — scanning, the teaser gate, publishing, badges, history, the CLI — works
with zero configuration.

```bash
npm test             # 38 tests: 22 engine, 16 end-to-end through a live server
npm run scan -- fixtures/demo-library     # the CLI
```

---

## 1. Google sign-in — about 5 minutes, needs your Google account

1. <https://console.cloud.google.com> → **create a project**, call it `atlan-scan`.
2. **APIs & Services → OAuth consent screen**
   - User type **External**
   - App name `Atlan Scan`, your email as support + developer contact
   - Scopes: leave default (`openid`, `email`, `profile` are added automatically)
   - While it is in *Testing*, add your own email under **Test users**. Publishing the
     consent screen is only needed once strangers sign in.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type **Web application**
   - **Authorised JavaScript origins**
     - `http://localhost:8787`
     - `https://<your-production-host>`
   - **Authorised redirect URIs** — these must match character for character
     - `http://localhost:8787/auth/callback`
     - `https://<your-production-host>/auth/callback`
4. Copy the **Client ID** and **Client secret** into `.env` (see `.env.example`).

Restart and the stub is gone — the header will say `google=configured` on boot.

**What I need from you:** the client ID and secret, or just paste them into `.env` yourself.

---

## 2. Hosting — needs your Render (or Fly / Railway) account

The repo already has a `Dockerfile` and a `render.yaml`. `~/Atlan` is already a git repo
pointing at `github.com/mananaggrawal/atlan-agent-registry-challenge`, so the simplest path
needs no new repository:

1. Commit and push `atlan-scan/`.
2. Render → **New → Web Service** → connect that repo.
3. Set **Root Directory** to `atlan-scan`. Runtime **Docker**. Health check `/healthz`.
4. Add a **1 GB disk** mounted at `/data`.
5. Environment variables:

   | Key | Value |
   |---|---|
   | `BASE_URL` | `https://<your-render-host>` |
   | `SESSION_SECRET` | generate a long random string |
   | `SCAN_DB` | `/data/scan.db` |
   | `GOOGLE_CLIENT_ID` | from step 1 |
   | `GOOGLE_CLIENT_SECRET` | from step 1 |

6. Deploy, then add the live host to the Google redirect URIs from step 1.

**Decide:** the hostname. `atlan-scan.onrender.com` works; `scan.atlan.com` would need a
CNAME on the Atlan domain, which is not yours to set.

**What I need from you:** which host, and the Render account connected to the repo.

---

## 3. `npx atlan-scan` — needs an npm account

The CLI works locally today (`npm run scan -- <path>`). For strangers to run
`npx atlan-scan .`, the package has to be published:

```bash
npm login
npm publish --access public
```

The package name `atlan-scan` must be free, or scope it (`@yourname/atlan-scan`). Set
`ATLAN_SCAN_SERVER` in the published build, or people must pass `--server`.

**What I need from you:** an npm login, and whether the name should be scoped.

---

## 4. Decisions that are yours, not mine

- **Is the repo public?** A public repo is worth more than the code here: it is the
  credibility argument for a scanner, and it is how the badge earns trust.
- **Does the consent screen get published?** Required before anyone outside your test-user
  list can sign in with Google.
- **Retention.** Runs are deleted after 90 days (`TTL_MS` in `src/store/runs.ts`).
- **Abuse limits.** There is no rate limiting. Fine for a launch; add it before a Show HN.

---

## Health check

```bash
curl -s localhost:8787/healthz                 # {"ok":true}
npm test                                        # 38 passing
npm run scan -- fixtures/demo-library           # 28 of 50 checks flagged, exit 1
```

On boot the server prints what it is actually using:

```
Atlan Scan on http://localhost:8787  ·  google=configured  ·  store=sqlite(/data/scan.db)
```

`google=stub` means the OAuth variables are missing. `store=memory` means the database
path was not writable and scans will vanish on restart.
