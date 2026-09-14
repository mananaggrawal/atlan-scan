import { createHash } from "node:crypto";
import type { FileEntry, SkillDoc, Unreadable } from "./types.ts";

export interface RawFile {
  path: string;
  data: Buffer;
}

const TEXT_EXT = new Set([
  ".md", ".markdown", ".txt", ".json", ".yaml", ".yml", ".toml", ".js", ".mjs", ".cjs",
  ".ts", ".tsx", ".jsx", ".py", ".sh", ".bash", ".zsh", ".rb", ".go", ".rs", ".php",
  ".html", ".css", ".csv", ".xml", ".sql", ".env", ".cfg", ".ini", ".lock", ".gitignore",
]);

export function extname(path: string): string {
  const base = path.slice(path.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  return dot <= 0 ? "" : base.slice(dot).toLowerCase();
}

/** Decode as UTF-8 text, or return null with a reason. "Could not read" is a finding, never a pass. */
export function decode(data: Buffer, path: string): { text: string | null; reason?: string } {
  if (data.length === 0) return { text: "" };
  if (data.length > 2_000_000) return { text: null, reason: "larger than 2 MB" };
  const sample = data.subarray(0, 8192);
  if (sample.includes(0)) return { text: null, reason: "binary (contains null bytes)" };
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    return { text: null, reason: "not valid UTF-8" };
  }
  // Control characters other than tab/newline/carriage return suggest a non-text payload.
  let control = 0;
  for (let i = 0; i < Math.min(text.length, 8192); i++) {
    const c = text.charCodeAt(i);
    if (c < 32 && c !== 9 && c !== 10 && c !== 13) control++;
  }
  if (control > 16) return { text: null, reason: "non-text control characters" };
  const ext = extname(path);
  if (ext && !TEXT_EXT.has(ext) && !/^[\x09\x0a\x0d\x20-\x7e -￿]*$/.test(text.slice(0, 2048))) {
    return { text: null, reason: `unrecognised format (${ext})` };
  }
  return { text };
}

export interface Frontmatter {
  raw: string;
  map: Record<string, string>;
  body: string;
  /** 1-based line on which the body starts in the original file. */
  bodyOffset: number;
}

/** Deliberately permissive: we want to SEE malformed frontmatter, not throw on it. */
export function parseFrontmatter(text: string): Frontmatter {
  const normalised = text.replace(/^﻿/, "");
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(normalised);
  if (!m) return { raw: "", map: {}, body: normalised, bodyOffset: 1 };
  const raw = m[1] ?? "";
  const map: Record<string, string> = {};
  let currentKey: string | null = null;
  for (const rawLine of raw.split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(rawLine);
    if (kv) {
      currentKey = (kv[1] ?? "").toLowerCase();
      map[currentKey] = stripQuotes((kv[2] ?? "").trim());
    } else if (currentKey && /^\s+\S/.test(rawLine)) {
      map[currentKey] = `${map[currentKey] ?? ""} ${rawLine.trim()}`.trim();
    }
  }
  const consumed = m[0] ?? "";
  const bodyOffset = consumed.split(/\r?\n/).length;
  return { raw, map, body: normalised.slice(consumed.length), bodyOffset };
}

function stripQuotes(v: string): string {
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
    return v.slice(1, -1);
  }
  return v;
}

export interface ParsedTree {
  skills: SkillDoc[];
  /** Files we could not read that we would have expected to read. */
  unreadable: Unreadable[];
  /** Images, fonts, PDFs and the like — not text by design, so not a finding. */
  nonTextCount: number;
  fileCount: number;
  orphanFiles: FileEntry[];
  /** Operating-system leftovers dropped before anything looked at them. Counted, not hidden. */
  ignored: number;
}

/** Formats nobody expects to be text. Excluded from "could not read" so that number means something. */
const ASSET_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico", ".bmp", ".tiff",
  ".pdf", ".woff", ".woff2", ".ttf", ".otf", ".eot", ".mp3", ".mp4", ".mov",
  ".wav", ".zip", ".gz", ".tgz", ".webm", ".psd", ".sketch", ".fig",
]);

export function isAsset(path: string): boolean {
  return ASSET_EXT.has(extname(path));
}

function isSkillManifest(path: string): boolean {
  const base = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
  return base === "skill.md";
}

function dirOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? "" : path.slice(0, i);
}

/**
 * Files the operating system left behind, which are not part of anybody's skill.
 *
 * Dropped here rather than in each caller: the CLI, the browser upload and the
 * GitHub ingest each kept their own skip list and none of the three had .DS_Store,
 * so a folder dragged in from Finder reported one more file than it contained and
 * there was nothing on the page to explain the extra. One list, at the only point
 * every path goes through.
 *
 * This is the only thing ever dropped silently, and only because it is not part of
 * the skill. Anything the author wrote stays in, readable or not.
 */
const OS_JUNK = /(^|\/)(\.DS_Store|__MACOSX|Thumbs\.db|desktop\.ini|\.Spotlight-V100|\.Trashes|\.AppleDouble|\._[^/]*)(\/|$)/i;

export function parseTree(files: RawFile[]): ParsedTree {
  const entries: FileEntry[] = [];
  const unreadable: Unreadable[] = [];
  let nonTextCount = 0;
  let ignored = 0;

  for (const f of files) {
    if (OS_JUNK.test(f.path)) {
      ignored++;
      continue;
    }
    const { text, reason } = decode(f.data, f.path);
    const entry: FileEntry = {
      path: f.path,
      bytes: f.data.length,
      text,
      readable: text !== null,
    };
    if (reason) entry.reason = reason;
    entries.push(entry);
    if (text === null) {
      if (isAsset(f.path)) nonTextCount++;
      else unreadable.push({ path: f.path, bytes: f.data.length, reason: reason ?? "unreadable" });
    }
  }

  const manifests = entries.filter((e) => isSkillManifest(e.path) && e.text !== null);
  const skills: SkillDoc[] = [];
  const claimed = new Set<string>();

  for (const manifest of manifests) {
    const dir = dirOf(manifest.path);
    const prefix = dir === "" ? "" : `${dir}/`;
    const owned = entries.filter((e) => (prefix === "" ? true : e.path.startsWith(prefix)));
    for (const o of owned) claimed.add(o.path);
    const text = manifest.text ?? "";
    const fm = parseFrontmatter(text);
    const name = fm.map["name"]?.trim() || (dir === "" ? "(root)" : dir.slice(dir.lastIndexOf("/") + 1));
    skills.push({
      name,
      dir,
      skillPath: manifest.path,
      frontmatterRaw: fm.raw,
      frontmatter: fm.map,
      body: fm.body,
      lines: text.split(/\r?\n/),
      files: owned,
      sha256: createHash("sha256").update(text).digest("hex"),
    });
  }

  const orphanFiles = entries.filter((e) => !claimed.has(e.path));
  return { skills, unreadable, nonTextCount, fileCount: entries.length, orphanFiles, ignored };
}

/** Find the 1-based line number of the first line matching a predicate. */
export function findLine(lines: string[], re: RegExp): { line: number; text: string } | null {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i] ?? "";
    if (re.test(l)) return { line: i + 1, text: l.trim() };
  }
  return null;
}

/** Clip an evidence quote so a report never renders a 4,000-char blob. */
export function quote(s: string, max = 180): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}
