import type { Check, Finding } from "../types.ts";
import { mk } from "./util.ts";

const PIPE_EXEC = /\b(curl|wget)\b[^|\n]{0,200}\|\s*(sudo\s+)?(ba|z|d)?sh\b/i;
const EVAL_FETCH = /\b(eval|exec|source|\.)\s*[("`$]{1,3}[^)\n]{0,120}\b(curl|wget|fetch)\b/i;
const UNPINNED_RAW =
  /https?:\/\/(raw\.githubusercontent\.com|gist\.githubusercontent\.com|gitlab\.com\/[^\s"')]+\/raw)\/[^\s"')]+/i;
const PASTE_HOST = /https?:\/\/(pastebin\.com|paste\.ee|hastebin\.com|termbin\.com|0x0\.st|transfer\.sh|file\.io)\/\S+/i;
const REMOTE_SKILL = /\b(fetch|download|curl|wget|read)\b[^.\n]{0,60}(https?:\/\/\S+\/(SKILL\.md|instructions?\.(md|txt)|prompt\.(md|txt)))/i;
const SHORTENER = /https?:\/\/(bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|rb\.gy|cutt\.ly)\/\S+/i;

export const externalChecks: Check[] = [
  ({ skill, commandLines }) => {
    const out: Finding[] = [];
    for (const c of commandLines) {
      if (!PIPE_EXEC.test(c.text)) continue;
      out.push(
        mk({
          checkId: "external-fetch-and-execute",
          categoryId: "external-instructions",
          severity: "critical",
          skill,
          line: c.line,
          title: "Downloads and executes code in one step",
          evidence: c.text,
          why: "Nobody reviews what this downloads, including you. The content at that URL can differ from the content the author tested, at any time, for any single machine.",
          fix: "Download to a file, show the user the checksum, and run it as a separate reviewable step — or vendor the script into the repo.",
          ast: ["AST05", "AST02"],
        }),
      );
      if (out.length >= 4) break;
    }
    return out;
  },
  ({ skill, commandLines }) => {
    const out: Finding[] = [];
    for (const c of commandLines) {
      if (!EVAL_FETCH.test(c.text)) continue;
      out.push(
        mk({
          checkId: "external-eval-fetch",
          categoryId: "external-instructions",
          severity: "critical",
          skill,
          line: c.line,
          title: "Evaluates remotely fetched content",
          evidence: c.text,
          why: "Remote text is being handed to an interpreter. This is remote code execution with the author's permission and without yours.",
          fix: "Remove the eval. Fetch to disk, pin a checksum, execute deliberately.",
          ast: ["AST05"],
        }),
      );
      if (out.length >= 3) break;
    }
    return out;
  },
  ({ skill }) => {
    const out: Finding[] = [];
    for (const f of skill.files) {
      if (f.text === null) continue;
      const lines = f.text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const text = lines[i] ?? "";
        const m = UNPINNED_RAW.exec(text);
        if (!m) continue;
        const url = m[0];
        // A 40-char hex ref in the path means it is pinned to an immutable commit.
        if (/\/[0-9a-f]{40}\//i.test(url)) continue;
        out.push(
          mk({
            checkId: "external-unpinned-source",
            categoryId: "external-instructions",
            severity: "high",
            skill,
            file: f.path,
            line: i + 1,
            title: "Pulls from a mutable raw source",
            evidence: text.trim(),
            why: "A branch or tag URL returns whatever is there today. The version you reviewed and the version you run are not guaranteed to be the same file.",
            fix: "Pin the URL to a full commit SHA, or vendor the file into this repo.",
            ast: ["AST02", "AST07"],
          }),
        );
        if (out.length >= 6) return out;
      }
    }
    return out;
  },
  ({ skill }) => {
    const out: Finding[] = [];
    for (const f of skill.files) {
      if (f.text === null) continue;
      const lines = f.text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const text = lines[i] ?? "";
        if (!PASTE_HOST.test(text) && !SHORTENER.test(text)) continue;
        out.push(
          mk({
            checkId: "external-opaque-host",
            categoryId: "external-instructions",
            severity: PASTE_HOST.test(text) ? "high" : "medium",
            skill,
            file: f.path,
            line: i + 1,
            title: PASTE_HOST.test(text) ? "Content pulled from a paste host" : "Shortened URL hides its destination",
            evidence: text.trim(),
            why: "You cannot tell from this repo what that address serves, and the owner can change it after you install without changing a byte here.",
            fix: "Replace with the real, versioned source, or vendor the content.",
            ast: ["AST05"],
          }),
        );
        if (out.length >= 5) return out;
      }
    }
    return out;
  },
  ({ skill }) => {
    const out: Finding[] = [];
    for (const f of skill.files) {
      if (f.text === null) continue;
      const lines = f.text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const text = lines[i] ?? "";
        if (!REMOTE_SKILL.test(text)) continue;
        out.push(
          mk({
            checkId: "external-remote-instruction-file",
            categoryId: "external-instructions",
            severity: "critical",
            skill,
            file: f.path,
            line: i + 1,
            title: "Loads its own instructions from a remote file",
            evidence: text.trim(),
            why: "The skill you audited is not the skill that runs. Its real behaviour lives at a URL somebody else controls.",
            fix: "Bring the instructions into this repo so they can be reviewed and diffed.",
            ast: ["AST05", "AST07"],
          }),
        );
        if (out.length >= 3) return out;
      }
    }
    return out;
  },
];
