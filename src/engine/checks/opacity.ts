import type { Check, Finding } from "../types.ts";
import { mk } from "./util.ts";
import { isAsset } from "../parse.ts";

const B64_BLOB = /(?:[A-Za-z0-9+/]{60,}={0,2})/;
const HEX_BLOB = /(?:[0-9a-fA-F]{120,})/;
const DECODE_CALL = /\b(atob\s*\(|base64\s+(-d|--decode|-D)|Buffer\.from\s*\([^)]*['"]base64|b64decode\s*\(|String\.fromCharCode\s*\(|codecs\.decode\s*\()/;
const SKIPPED_DIR = /(^|\/)(\.[^/]+|node_modules|__pycache__|dist|build|vendor|\.git)\//;
const EXECUTABLE_TEXT = /\.(sh|bash|zsh|py|js|mjs|cjs|rb|pl|ps1)$/i;

export const opacityChecks: Check[] = [
  ({ skill }) => {
    const out: Finding[] = [];
    for (const f of skill.files) {
      if (f.text === null) continue;
      const lines = f.text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const text = lines[i] ?? "";
        if (text.length < 60) continue;
        // Calibrated against anthropics/skills: long CamelCase SDK identifiers match the
        // base64 alphabet. A real blob is a string literal, or a line that is nothing else.
        const run = (/[A-Za-z0-9+/=]{60,}/.exec(text) ?? [""])[0];
        if (!run) continue;
        const quoted = new RegExp(`["'\`]\\s*${run.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(text);
        const standalone = text.trim() === run;
        if (!quoted && !standalone) continue;
        const isB64 = B64_BLOB.test(run) && !/https?:\/\//.test(text);
        const isHex = HEX_BLOB.test(run);
        if (!isB64 && !isHex) continue;
        out.push(
          mk({
            checkId: "opacity-encoded-blob",
            categoryId: "opacity",
            severity: "high",
            skill,
            file: f.path,
            line: i + 1,
            title: isB64 ? "Base64 blob in the skill text" : "Long hex blob in the skill text",
            evidence: `${run.slice(0, 80)}… (${run.length} encoded chars)`,
            why: "You cannot read this, and neither can any reviewer who approved it. Encoded content inside instruction files is the packing technique SkillCloak used to walk past every scanner it was tested against.",
            fix: "Decode it and commit the plain text, or delete it. If it is genuinely data, move it to a named data file and say what it is.",
            ast: ["AST08", "AST01"],
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
        if (!DECODE_CALL.test(text)) continue;
        out.push(
          mk({
            checkId: "opacity-runtime-decode",
            categoryId: "opacity",
            severity: "high",
            skill,
            file: f.path,
            line: i + 1,
            title: "Decodes content at run time",
            evidence: text.trim(),
            why: "Whatever this produces was never reviewable in source form. Decoding at run time is how a payload stays invisible until the moment it runs.",
            fix: "Inline the decoded content so it can be read and diffed.",
            ast: ["AST08"],
          }),
        );
        if (out.length >= 4) return out;
      }
    }
    return out;
  },
  ({ skill }) => {
    const out: Finding[] = [];
    for (const f of skill.files) {
      const rel = f.path.slice(skill.dir.length ? skill.dir.length + 1 : 0);
      if (!SKIPPED_DIR.test(`/${rel}`)) continue;
      if (!EXECUTABLE_TEXT.test(f.path) && f.readable) continue;
      out.push(
        mk({
          checkId: "opacity-skipped-directory",
          categoryId: "opacity",
          severity: "high",
          skill,
          file: f.path,
          line: null,
          title: "Executable content in a directory reviewers skip",
          evidence: `${f.path} (${f.bytes.toLocaleString()} bytes)`,
          why: "Dot-directories and build folders are scrolled past in review and skipped by most scanners. Placing runnable code there is a deliberate way to be present but unseen.",
          fix: "Move it next to the SKILL.md where it will be read, or remove it.",
          ast: ["AST08"],
        }),
      );
      if (out.length >= 5) break;
    }
    return out;
  },
  ({ skill }) => {
    const out: Finding[] = [];
    for (const f of skill.files) {
      if (f.text === null) continue;
      if (f.path === skill.skillPath) continue;
      const lines = f.text.split(/\r?\n/).length;
      if (lines < 800) continue;
      out.push(
        mk({
          checkId: "opacity-bulk-reference",
          categoryId: "opacity",
          severity: "low",
          skill,
          file: f.path,
          line: null,
          title: `Reference file of ${lines.toLocaleString()} lines`,
          evidence: `${f.path} — ${lines.toLocaleString()} lines, ${f.bytes.toLocaleString()} bytes`,
          why: "A file this size was almost certainly never read end to end by the author, the reviewer, or you. It is a good place for something to sit unnoticed.",
          fix: "Split it, or state in the SKILL.md what the file contains and when the agent should load it.",
          ast: ["AST08"],
        }),
      );
      if (out.length >= 4) break;
    }
    return out;
  },
  ({ skill }) => {
    const out: Finding[] = [];
    for (const f of skill.files) {
      if (f.readable) continue;
      if (isAsset(f.path)) continue;
      out.push(
        mk({
          checkId: "opacity-unreadable-file",
          categoryId: "opacity",
          severity: "medium",
          skill,
          file: f.path,
          line: null,
          title: "We could not read this file",
          evidence: `${f.path} — ${f.reason ?? "unreadable"}, ${f.bytes.toLocaleString()} bytes`,
          why: "This is reported rather than passed over. Anything we cannot read, we cannot clear — and a scanner that silently skips files is how a packed payload gets a clean report.",
          fix: "If it needs to be here, say what it is in the SKILL.md. If not, remove it.",
          ast: ["AST08"],
        }),
      );
      if (out.length >= 6) break;
    }
    return out;
  },
];
