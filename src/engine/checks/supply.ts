import type { Check, Finding } from "../types.ts";
import { mk } from "./util.ts";
import { extname } from "../parse.ts";

const NPM_INSTALL = /\b(npm|pnpm|yarn|bun)\s+(i|install|add)\s+([^\s;|&]+)/i;
const PIP_INSTALL = /\b(pip3?|uv pip|pipx)\s+install\s+([^\s;|&]+)/i;
const OFF_REGISTRY =
  /\b(npm|pnpm|yarn|bun|pip3?|uv pip|pipx)\s+(i|install|add)\s+(git\+|https?:\/\/|git@|github:|file:|\.\/|\/)/i;
const GLOBAL_INSTALL = /\b(npm|pnpm|yarn|bun)\s+(i|install|add)\s+(-g|--global)\b/i;
const CURL_DOWNLOAD_EXEC = /\b(chmod\s+\+x|sudo\s+install)\b/i;

const POPULAR = [
  "lodash", "express", "react", "axios", "chalk", "commander", "dotenv", "typescript",
  "requests", "numpy", "pandas", "flask", "django", "pytest", "urllib3", "colorama",
  "openai", "anthropic", "zod", "vite", "eslint", "prettier",
];

// Damerau-Levenshtein: typosquats are usually a transposition (lodash -> lodahs),
// which plain Levenshtein scores as 2 and would miss.
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const n = a.length;
  const m = b.length;
  const d: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i]![0] = i;
  for (let j = 0; j <= m; j++) d[0]![j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, d[i - 2]![j - 2]! + 1);
      }
      d[i]![j] = best;
    }
  }
  return d[n]![m]!;
}

function bareName(spec: string): string {
  return spec.replace(/^["']|["']$/g, "").split(/[@=<>~!\[]/)[0] ?? spec;
}

const BINARY_EXT = new Set([".so", ".dylib", ".dll", ".exe", ".bin", ".pyc", ".o", ".a", ".wasm", ".jar", ".class"]);

export const supplyChecks: Check[] = [
  ({ skill, commandLines }) => {
    const out: Finding[] = [];
    for (const c of commandLines) {
      if (!OFF_REGISTRY.test(c.text)) continue;
      out.push(
        mk({
          checkId: "supply-off-registry-install",
          categoryId: "supply-chain",
          severity: "high",
          skill,
          line: c.line,
          title: "Installs from outside the package registry",
          evidence: c.text,
          why: "Registry packages are versioned, signed and revocable. A git URL or tarball is none of those — it can be rewritten in place after you install it.",
          fix: "Publish to the registry and install by version, or pin the git reference to a full commit SHA.",
          ast: ["AST02"],
        }),
      );
      if (out.length >= 4) break;
    }
    return out;
  },
  ({ skill, commandLines }) => {
    const out: Finding[] = [];
    const seen = new Set<string>();
    for (const c of commandLines) {
      if (OFF_REGISTRY.test(c.text)) continue;
      const npm = NPM_INSTALL.exec(c.text);
      const pip = PIP_INSTALL.exec(c.text);
      const spec = npm ? (npm[3] ?? "") : pip ? (pip[2] ?? "") : "";
      if (!spec || spec.startsWith("-")) continue;
      const pinned = /@[\dv]|==|@[0-9a-f]{40}/.test(spec);
      if (pinned) continue;
      if (seen.has(spec)) continue;
      seen.add(spec);
      out.push(
        mk({
          checkId: "supply-unpinned-install",
          categoryId: "supply-chain",
          severity: "medium",
          skill,
          line: c.line,
          title: `Unpinned dependency: ${bareName(spec)}`,
          evidence: c.text,
          why: "Without a version, you get whatever is newest when the command runs. A package taken over tomorrow lands on your machine tomorrow.",
          fix: `Pin it — ${bareName(spec)}@<version> for npm, ${bareName(spec)}==<version> for pip.`,
          ast: ["AST02", "AST07"],
        }),
      );
      if (out.length >= 8) break;
    }
    return out;
  },
  ({ skill, commandLines }) => {
    const out: Finding[] = [];
    const seen = new Set<string>();
    for (const c of commandLines) {
      const npm = NPM_INSTALL.exec(c.text);
      const pip = PIP_INSTALL.exec(c.text);
      const spec = npm ? (npm[3] ?? "") : pip ? (pip[2] ?? "") : "";
      const name = bareName(spec).toLowerCase();
      if (!name || name.startsWith("-") || name.startsWith("@") || name.includes("/")) continue;
      if (name.length < 5 || POPULAR.includes(name) || seen.has(name)) continue;
      for (const p of POPULAR) {
        if (editDistance(name, p) === 1) {
          seen.add(name);
          out.push(
            mk({
              checkId: "supply-typosquat-shape",
              categoryId: "supply-chain",
              severity: "high",
              skill,
              line: c.line,
              title: `"${name}" is one character from "${p}"`,
              evidence: c.text,
              why: "Typosquatting is the most common way a poisoned package reaches a machine. This may be legitimate, but it has the exact shape of the attack.",
              fix: `Confirm the package is the one you mean. If you meant ${p}, correct the spelling; if not, link the package page in the skill.`,
              ast: ["AST02"],
            }),
          );
          break;
        }
      }
      if (out.length >= 3) break;
    }
    return out;
  },
  ({ skill, commandLines }) => {
    const hit = commandLines.find((c) => GLOBAL_INSTALL.test(c.text));
    if (!hit) return [];
    return [
      mk({
        checkId: "supply-global-install",
        categoryId: "supply-chain",
        severity: "low",
        skill,
        line: hit.line,
        title: "Installs globally",
        evidence: hit.text,
        why: "A global install changes the machine, not just the project, and outlives the skill that asked for it.",
        fix: "Prefer npx / a project-local dependency so the blast radius ends with the project.",
        ast: ["AST02", "AST03"],
      }),
    ];
  },
  ({ skill, commandLines }) => {
    const hit = commandLines.find((c) => CURL_DOWNLOAD_EXEC.test(c.text));
    if (!hit) return [];
    return [
      mk({
        checkId: "supply-make-executable",
        categoryId: "supply-chain",
        severity: "medium",
        skill,
        line: hit.line,
        title: "Marks a downloaded file executable",
        evidence: hit.text,
        why: "Combined with any download step in this skill, this is the last move before arbitrary code runs on your machine.",
        fix: "Verify a published checksum before the chmod, and say in the skill what the binary is.",
        ast: ["AST02"],
      }),
    ];
  },
  ({ skill }) => {
    const out: Finding[] = [];
    for (const f of skill.files) {
      if (!BINARY_EXT.has(extname(f.path))) continue;
      out.push(
        mk({
          checkId: "supply-binary-artifact",
          categoryId: "supply-chain",
          severity: "high",
          skill,
          file: f.path,
          line: null,
          title: "Compiled binary shipped inside the skill",
          evidence: `${f.path} (${f.bytes.toLocaleString()} bytes, ${extname(f.path)})`,
          why: "Nobody reviews a binary in a pull request. A skill folder is instructions and scripts; a compiled artifact here cannot be read by you or by us.",
          fix: "Remove it and install the tool from its registry, or publish the source that builds it.",
          ast: ["AST02", "AST08"],
        }),
      );
      if (out.length >= 5) break;
    }
    return out;
  },
];
