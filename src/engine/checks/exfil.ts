import type { Check, Finding } from "../types.ts";
import { mk, firstMatch, allMatches } from "./util.ts";

const CREDENTIAL_READ =
  /(\.env\b|\.ssh\/|id_rsa|id_ed25519|\.aws\/credentials|\.config\/gh\/hosts|\.netrc|\.npmrc|\.pypirc|kubeconfig|security\s+find-generic-password|printenv|\benv\s*\||process\.env\b|os\.environ\b|\$\{?(OPENAI|ANTHROPIC|AWS|GITHUB|GH|SLACK|STRIPE)_[A-Z_]*(KEY|TOKEN|SECRET))/;
const OUTBOUND =
  /(webhook\.site|requestbin|pipedream\.net|ngrok\.io|ngrok-free\.app|discord\.com\/api\/webhooks|api\.telegram\.org\/bot|hooks\.slack\.com|\bcurl\b[^\n]{0,120}(-X\s*POST|--data|-d\s|--upload-file|-F\s)|\bwget\b[^\n]{0,80}--post|nc\s+-\w*\s+\d|\bmail\s+-s\b)/i;
const CODEBASE_PACK = /\b(tar\s+-?c\w*|zip\s+-r|git\s+bundle|git\s+archive)\b/i;
const HARDCODED_SECRET =
  /\b(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z\-_]{30,})\b/;

/** Calling an API you hold a key for is the normal case; it is not a route out. */
const FIRST_PARTY =
  /https?:\/\/(api\.anthropic\.com|api\.openai\.com|api\.github\.com|github\.com|api\.stripe\.com|api\.notion\.com|slack\.com\/api|graph\.microsoft\.com|googleapis\.com|amazonaws\.com|api\.linear\.app|api\.hubapi\.com)/i;
const COLLECTOR = /(webhook\.site|requestbin|pipedream\.net|ngrok\.io|ngrok-free\.app|discord\.com\/api\/webhooks|api\.telegram\.org\/bot|hooks\.slack\.com|0x0\.st|transfer\.sh|file\.io)/i;

function isRouteOut(line: string): boolean {
  if (COLLECTOR.test(line)) return true;
  if (FIRST_PARTY.test(line)) return false;
  return true;
}

function redact(text: string): string {
  return text.replace(HARDCODED_SECRET, (m) => `${m.slice(0, 6)}…${"•".repeat(8)}`);
}

export const exfilChecks: Check[] = [
  ({ skill }) => {
    const cred = firstMatch(skill, CREDENTIAL_READ);
    const outboundHits = allMatches(skill, OUTBOUND, 12);
    const out2 = outboundHits.find((h) => isRouteOut(h.text)) ?? null;
    const out: Finding[] = [];

    // The pairing is the finding. Either half alone is ordinary; together it is a route.
    if (cred && out2) {
      out.push(
        mk({
          checkId: "exfil-pair",
          categoryId: "exfiltration",
          severity: "critical",
          skill,
          file: cred.path,
          line: cred.line,
          title: "Reads credentials and has a way to send them out",
          evidence: `${redact(cred.text)}  ·  and ${out2.path}:${out2.line} → ${redact(out2.text)}`,
          why: "Reading secrets is normal. Posting to an outside endpoint is normal. In the same skill they are a complete exfiltration path, and this is the shape ClawHavoc used at scale.",
          fix: "Separate them: if the skill needs a secret, never let the same skill hold an outbound POST. If it needs to send data, never let it read credential paths.",
          ast: ["AST05"],
        }),
      );
    } else if (cred) {
      out.push(
        mk({
          checkId: "exfil-credential-read",
          categoryId: "exfiltration",
          severity: "medium",
          skill,
          file: cred.path,
          line: cred.line,
          title: "Touches credential material",
          evidence: redact(cred.text),
          why: "On its own this may be exactly what the skill is for. It is listed so you know this skill sees secrets, and so a later change that adds an outbound call is a change you notice.",
          fix: "Confirm the skill needs it. If it does, keep network access out of this skill.",
          ast: ["AST05"],
        }),
      );
    }
    return out;
  },
  ({ skill, commandLines }) => {
    const packed = commandLines.find((c) => CODEBASE_PACK.test(c.text));
    if (!packed) return [];
    const send = allMatches(skill, OUTBOUND, 12).find((h) => isRouteOut(h.text));
    if (!send) return [];
    return [
      mk({
        checkId: "exfil-codebase-upload",
        categoryId: "exfiltration",
        severity: "critical",
        skill,
        line: packed.line,
        title: "Packs the project and sends it somewhere",
        evidence: `${packed.text}  ·  and ${send.path}:${send.line} → ${send.text}`,
        why: "An archive step followed by an upload step is how a whole codebase leaves a machine in one command.",
        fix: "Remove the upload. If the skill produces an archive, leave it on disk for the user to send deliberately.",
        ast: ["AST05"],
      }),
    ];
  },
  ({ skill }) => {
    const hits = allMatches(skill, HARDCODED_SECRET, 4);
    return hits.map((h) =>
      mk({
        checkId: "exfil-hardcoded-secret",
        categoryId: "exfiltration",
        severity: "critical",
        skill,
        file: h.path,
        line: h.line,
        title: "Live credential committed in the skill",
        evidence: redact(h.text),
        why: "A key in a published skill is a key in everybody's hands. Treat it as compromised from the moment it was pushed, not from the moment it is used.",
        fix: "Revoke and rotate the key now, then read it from an environment variable. Removing the line does not remove it from git history.",
        ast: ["AST05", "AST04"],
      }),
    );
  },
  ({ skill }) => {
    const hits = allMatches(skill, /(webhook\.site|requestbin|pipedream\.net|ngrok\.io|ngrok-free\.app)/i, 3);
    return hits.map((h) =>
      mk({
        checkId: "exfil-collector-endpoint",
        categoryId: "exfiltration",
        severity: "high",
        skill,
        file: h.path,
        line: h.line,
        title: "Points at a data-collection endpoint",
        evidence: h.text,
        why: "These hosts exist to receive arbitrary data from anywhere and show it to whoever set up the bucket. They belong in a debugging session, not in a published skill.",
        fix: "Remove the endpoint. If telemetry is intended, say so in the description and name the destination.",
        ast: ["AST05"],
      }),
    );
  },
];
