import { gunzipSync } from "node:zlib";

export interface TarEntry {
  name: string;
  data: Buffer;
}

/** Minimal ustar/GNU reader. Enough for a GitHub source tarball, no dependency. */
export function untarGz(gz: Buffer): TarEntry[] {
  return untar(gunzipSync(gz));
}

export function untar(buf: Buffer): TarEntry[] {
  const out: TarEntry[] = [];
  let offset = 0;
  let longName: string | null = null;

  while (offset + 512 <= buf.length) {
    const header = buf.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;

    const name = cstr(header.subarray(0, 100));
    const sizeField = cstr(header.subarray(124, 136)).trim();
    const size = parseInt(sizeField || "0", 8) || 0;
    const typeflag = String.fromCharCode(header[156] ?? 0);
    const prefix = cstr(header.subarray(345, 500));
    offset += 512;

    const dataLen = size;
    const data = buf.subarray(offset, offset + dataLen);
    offset += Math.ceil(dataLen / 512) * 512;

    if (typeflag === "L") {
      longName = cstr(data);
      continue;
    }
    if (typeflag !== "0" && typeflag !== "\0" && typeflag !== "") continue;

    const full = longName ?? (prefix ? `${prefix}/${name}` : name);
    longName = null;
    out.push({ name: full, data: Buffer.from(data) });
  }
  return out;
}

function cstr(b: Buffer): string {
  const end = b.indexOf(0);
  return b.subarray(0, end === -1 ? b.length : end).toString("utf8");
}
