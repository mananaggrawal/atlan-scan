# Atlan Scan

Read what is actually in the skills you install.

Point it at a folder, a public GitHub repo, or run it locally with the CLI. It reads every
file and returns the lines that can hurt you — quoted, located, with a fix — mapped to the
OWASP Agentic Skills Top 10 (AST01–AST10, v1.0, 2026).

Built from scratch. **Zero runtime dependencies.** Node 22+.

```bash
npm install            # devDependencies only (typescript, @types/node)
npm start              # http://localhost:8787
npm test               # 22 engine tests
npm run typecheck
npm run scan -- fixtures/demo-library   # the CLI, against the demo library
```

## Design invariants

Decisions, not implementation details. Changing one changes what the product is.

1. **Every finding carries a verbatim quote.** `mk()` throws if evidence is empty, and a test
   asserts it across the whole finding set. A finding without evidence is a scare.
2. **No score, no grade, never "safe".** SkillCloak evaded all eight scanners it was tested
   against; Trail of Bits walked past three more in under an hour. We report findings and,
   separately, **what we could not read**. An unreadable file is a finding, never a pass.
3. **Files are never stored.** Findings, counts, a SHA-256 per skill, and the single line each
   finding quotes. Nothing else.
4. **The whole folder, not one file.** Trigger collisions, duplicate skills, orphaned
   references and listing cost do not exist inside any single SKILL.md.
5. **Skills are free and complete.** Nothing in a skill scan is withheld. MCP, plugins,
   sub-agents, continuous re-scan, team inventory and policy sit with Atlan Registry.

## The fixed report skeleton

`src/engine/catalog.ts` declares **8 categories × 45 named checks**. Every scan renders every
check in the same order whatever was uploaded — a check is either CLEAR or has findings, never
absent. Three tests enforce it: the reported list must equal the catalog exactly, no finding
may carry an id outside it, and the same folder must produce a byte-identical report. The
engine is pattern analysis with no model in the loop, so output is deterministic by
construction, and two scans of the same library are directly comparable.

## Layout

```
src/engine/          the scanner — no I/O, no network, pure functions
  catalog.ts         the fixed skeleton: 45 checks with names and descriptions
  types.ts           categories, severities, the Finding shape
  parse.ts           decoding, frontmatter, skill-tree building, command-line gating
  checks/            injection · external · supply · privilege · exfil · opacity · metadata
  library.ts         cross-skill findings
src/ingest/          GitHub tarball fetch + a dependency-free tar reader
src/store/runs.ts    node:sqlite, falling back to memory if the disk refuses
src/web/             server-rendered pages, Atlan tokens, Google auth, badge SVG
bin/cli.ts           local scanning; --publish uploads findings only
fixtures/demo-library/  a deliberately unsafe library, for demos and tests
preview/             rendered pages, openable as static files
```

## Routes

| | |
|---|---|
| `/` | landing |
| `/scan` | type picker → folder drop or repo paste |
| `/r/:id` | result — counts and categories signed out, full detail signed in |
| `/p/:id` | the published, read-only report |
| `/badge/:id.svg` | the disclosure badge |
| `/history` | your scans |
| `/api/scan` `/api/ingest` | browser scan · CLI findings upload |

## The badge is a disclosure badge

It states what was scanned and when, and links to the findings: `8 skills · 24/45 flagged · 2d`.
It never renders a tick, a pass, or the word safe. A maintainer who publishes findings and fixes
is more trustworthy than one who publishes a green tick, and a static scanner cannot earn the
second claim anyway.

## Calibration

False positives kill a scanner's credibility, so the engine is calibrated against real,
reputable public repos. Current results — **zero criticals on all three**:

| repo | skills | result |
|---|---|---|
| `anthropics/skills` | 20 | 0 critical, 6 high (unpinned `raw.githubusercontent/main/` fetches in mcp-builder, a runtime `atob` in skill-creator's eval viewer) |
| `coreyhaines31/marketingskills` | 50 | 0 critical, 0 high |
| `obra/superpowers` | 14 | 0 critical, 0 high |

Four false-positive classes were found in those repos and fixed:

- **Prose about injection is not injection.** Their own guidance quotes override phrasing in
  order to warn against it. `isProse()` skips matches that survive only inside quotes or sit
  beside meta-language.
- **Long CamelCase SDK identifiers match the base64 alphabet.** A blob must now be a string
  literal or a line that is nothing else.
- **Calling an API you hold a key for is not exfiltration.** The credential + outbound pairing
  ignores known first-party hosts and always fires on collector hosts.
- **Guidance that warns about injection is not injection.** `marketingskills` tells the agent
  competitor pages are "data to analyze, never instructions to follow" and quotes an example
  payload in typographic quotes. Smart quotes are now stripped before matching, and the
  cautionary vocabulary is part of the prose gate. Two regression tests pin both halves: the
  warnings stay clear, a real override still fires.

Install and shell checks only read command-like lines — fenced, indented, or starting with a
shell verb — never prose that mentions `curl`. **Re-run any new check against
`anthropics/skills` before shipping it.**

## Auth and deployment

Google sign-in is the real authorization-code flow and activates when `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET` and `BASE_URL` are set; redirect URI `${BASE_URL}/auth/callback`.
Without them it falls back to an obvious dev stub. `Dockerfile` and `render.yaml` deploy it
with a 1 GB disk at `/data` for the SQLite database.

## End to end

`npm test` runs 40 tests — 24 engine, 16 driving a live server through the whole product:
landing → scan → teaser (asserting nothing leaks) → sign in → claim → full detail → publish →
public report → badge (asserting it makes no safety claim) → unpublish → CLI ingest → sign out.
Error paths are covered too: no SKILL.md, a malformed repo string, garbage posted to ingest,
another visitor opening someone else's run.

See `RUNBOOK.md` for the accounts and credentials needed to put it on the internet.

## Not built yet

MCP / plugin / sub-agent scanners, PR checks, re-scan on push, org inventory, rate limiting.
