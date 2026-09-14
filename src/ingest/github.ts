import { untarGz } from "./tar.ts";
import type { RawFile } from "../engine/parse.ts";

export const LIMITS = {
  maxFiles: 600,
  maxTotalBytes: 25 * 1024 * 1024,
  maxFileBytes: 2 * 1024 * 1024,
};

const SKIP_DIR = /(^|\/)(node_modules|\.git|\.venv|venv|__pycache__|\.next|\.cache|target|\.pnpm-store)\//;

export interface RepoRef {
  owner: string;
  repo: string;
  ref?: string;
  subpath?: string;
}

/**
 * Says what is wrong with an input we could not parse, rather than repeating the format.
 * Pasting an org URL is the common mistake — github.com/langgenius is an account, not a repo.
 */
export function repoInputError(input: string): string {
  const s = input.trim().replace(/\.git$/, "").replace(/\/+$/, "");
  if (!s) return "Paste a public GitHub repository to scan.";

  const gh = /^(?:https?:\/\/)?(?:www\.)?github\.com(?:\/(.*))?$/i.exec(s);
  if (gh) {
    const parts = (gh[1] ?? "").split("?")[0]!.split("/").filter(Boolean);
    if (parts.length === 0) return "That is GitHub's home page. Add the owner and repository, e.g. github.com/anthropics/skills.";
    if (parts.length === 1) {
      return `github.com/${parts[0]} is an account, not a repository. Add the repository name — for example github.com/${parts[0]}/<repo>.`;
    }
    return "We could not read a repository out of that URL. The shape we need is github.com/owner/repo.";
  }

  if (/^(?:https?:\/\/)?gist\.github\.com/i.test(s)) {
    return "Gists are not repositories. Paste a github.com/owner/repo URL, or upload the files instead.";
  }
  // Anything with a hostname in front of the path is some other forge.
  if (/^(?:https?:\/\/)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/|$)/i.test(s)) {
    return "Atlan Scan reads public repositories on github.com. Paste a github.com URL, or upload the folder instead.";
  }
  if (s.includes(" ")) return "That has a space in it. Paste a URL like github.com/anthropics/skills, or just anthropics/skills.";
  return "That does not look like a repository. Try github.com/owner/repo, or owner/repo.";
}

export function parseRepoInput(input: string): RepoRef | null {
  const s = input.trim().replace(/\.git$/, "").replace(/\/+$/, "");

  // Protocol is optional: people paste "github.com/owner/repo" as often as the full URL.
  const url = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+)(?:\/(.*))?)?$/i.exec(s);
  if (url) {
    const ref: RepoRef = { owner: url[1]!, repo: url[2]! };
    if (url[3]) ref.ref = url[3];
    if (url[4]) ref.subpath = url[4];
    return ref;
  }

  // Bare owner/repo. GitHub account names are alphanumeric and hyphens only — no dots —
  // so this cannot swallow a hostname like "github.com/langgenius".
  const short = /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9_.-]+)$/.exec(s);
  if (short) return { owner: short[1]!, repo: short[2]! };
  return null;
}

async function fetchTarball(ref: RepoRef): Promise<{ buf: Buffer; usedRef: string }> {
  const candidates = ref.ref ? [ref.ref] : ["HEAD", "main", "master"];
  let lastStatus = 0;
  for (const candidate of candidates) {
    const url =
      candidate === "HEAD"
        ? `https://codeload.github.com/${ref.owner}/${ref.repo}/tar.gz/HEAD`
        : `https://codeload.github.com/${ref.owner}/${ref.repo}/tar.gz/refs/heads/${candidate}`;
    const res = await fetch(url, {
      headers: { "user-agent": "atlan-scan", accept: "application/x-gzip" },
      redirect: "follow",
    });
    if (res.ok) {
      const ab = await res.arrayBuffer();
      if (ab.byteLength > 80 * 1024 * 1024) throw new Error("That repository is too large to scan here — try a subdirectory.");
      return { buf: Buffer.from(ab), usedRef: candidate };
    }
    lastStatus = res.status;
  }
  if (lastStatus === 404) throw new Error("Repository not found, or it is private. Atlan Scan only reads public repositories.");
  throw new Error(`GitHub returned ${lastStatus || "no response"} for that repository.`);
}

export async function fetchRepoFiles(ref: RepoRef): Promise<{ files: RawFile[]; label: string; truncated: boolean }> {
  const { buf, usedRef } = await fetchTarball(ref);
  const entries = untarGz(buf);

  const files: RawFile[] = [];
  let total = 0;
  let truncated = false;
  const wanted = ref.subpath ? `${ref.subpath.replace(/\/+$/, "")}/` : "";

  for (const e of entries) {
    // Strip the single top-level directory GitHub adds.
    const rel = e.name.replace(/^[^/]+\//, "");
    if (!rel || rel.endsWith("/")) continue;
    if (SKIP_DIR.test(`/${rel}`)) continue;
    if (wanted && !rel.startsWith(wanted)) continue;
    if (e.data.length > LIMITS.maxFileBytes) {
      truncated = true;
      continue;
    }
    if (files.length >= LIMITS.maxFiles || total + e.data.length > LIMITS.maxTotalBytes) {
      truncated = true;
      break;
    }
    total += e.data.length;
    files.push({ path: wanted ? rel.slice(wanted.length) : rel, data: e.data });
  }

  const label = `${ref.owner}/${ref.repo}${ref.subpath ? `/${ref.subpath}` : ""}${usedRef !== "HEAD" ? `@${usedRef}` : ""}`;
  return { files, label, truncated };
}
