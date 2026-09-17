// Re-mux the beginning of a browser recording. MediaRecorder's stop timer can
// run late; select encoded blocks by their actual timestamps, without changing
// the server's independent preview validation or exposing the original file.
import { timedPreviewIsShort } from './preview-validation';

type Element = { id: number; start: number; data: number; end: number; unknown: boolean };
const SEGMENT = 0x18538067, INFO = 0x1549a966, TRACKS = 0x1654ae6b, CLUSTER = 0x1f43b675;
const levelOne = new Set([0x114d9b74, INFO, TRACKS, CLUSTER, 0x1c53bb6b, 0x1941a469, 0x1043a770, 0x1254c367]);
const invalid = () => new Error('No se pudo preparar un adelanto válido de este video. Prueba exportarlo como MP4 con video H.264 y audio AAC.');

export function trimWebmPreview(bytes: Uint8Array, seconds = 9): Uint8Array {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 9 || bytes.length > 20 * 1024 * 1024) throw invalid();
  let operations = 0;
  function vint(pos: number, end: number, marker = false) {
    let mask = 128, length = 1;
    if (pos >= end) throw invalid();
    while (length <= 8 && !(bytes[pos] & mask)) { mask >>= 1; length++; }
    if (length > (marker ? 4 : 8) || pos + length > end) throw invalid();
    let value = marker ? bytes[pos] : bytes[pos] & (mask - 1);
    let unknown = !marker && value === mask - 1;
    for (let i = 1; i < length; i++) { value = value * 256 + bytes[pos + i]; unknown = unknown && bytes[pos + i] === 255; }
    if (!unknown && !Number.isSafeInteger(value)) throw invalid();
    return { value, length, unknown };
  }
  function header(start: number, end: number): Element {
    if (++operations > 100000) throw invalid();
    const id = vint(start, end, true), size = vint(start + id.length, end);
    const data = start + id.length + size.length, stop = size.unknown ? end : data + size.value;
    if (stop > end || stop < data) throw invalid();
    return { id: id.value, start, data, end: stop, unknown: size.unknown };
  }
  function children(start: number, end: number, segment = false): Element[] {
    const result: Element[] = [];
    for (let pos = start; pos < end;) {
      const item = header(pos, end);
      if (item.unknown) {
        if (!segment || item.id !== CLUSTER) throw invalid();
        // In streaming WebM an unknown-size Cluster ends at the next level-one
        // element. Do not mistake its sibling Clusters for nested containers.
        let boundary = item.data;
        while (boundary < end) {
          const child = header(boundary, end);
          if (levelOne.has(child.id)) break;
          if (child.unknown) throw invalid();
          boundary = child.end;
        }
        item.end = boundary;
      }
      result.push(item); pos = item.end;
    }
    return result;
  }
  const integer = (item: Element) => {
    if (item.unknown || item.end - item.data > 7) throw invalid();
    let n = 0; for (let p = item.data; p < item.end; p++) n = n * 256 + bytes[p];
    if (!Number.isSafeInteger(n)) throw invalid(); return n;
  };
  const raw = (item: Element) => bytes.subarray(item.start, item.end);
  const concat = (parts: Uint8Array[]) => {
    const output = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
    let pos = 0; for (const part of parts) { output.set(part, pos); pos += part.length; } return output;
  };
  const uint = (n: number) => {
    const parts = [n % 256]; while ((n = Math.floor(n / 256))) parts.unshift(n % 256); return new Uint8Array(parts);
  };
  const encode = (id: number, parts: Uint8Array[]) => {
    const body = concat(parts); let length = 1;
    while (body.length >= 2 ** (7 * length) - 1) length++;
    const size = new Uint8Array(length); let n = body.length;
    for (let i = length - 1; i >= 0; i--) { size[i] = n % 256; n = Math.floor(n / 256); }
    size[0] |= 1 << (8 - length);
    return concat([uint(id), size, body]);
  };

  const ebml = header(0, bytes.length);
  if (ebml.id !== 0x1a45dfa3 || ebml.unknown) throw invalid();
  const segment = header(ebml.end, bytes.length);
  if (segment.id !== SEGMENT || segment.end !== bytes.length) throw invalid();
  const items = children(segment.data, segment.end, true);
  const infos = items.filter(x => x.id === INFO), tracks = items.filter(x => x.id === TRACKS);
  if (infos.length !== 1 || tracks.length !== 1) throw invalid();
  const info = children(infos[0].data, infos[0].end);
  const scales = info.filter(x => x.id === 0x2ad7b1);
  if (scales.length > 1) throw invalid();
  const scale = scales.length ? integer(scales[0]) : 1000000;
  if (scale <= 0) throw invalid();
  let origin: number | undefined, blocks = 0, maximum = 0;
  const clusters: Uint8Array[] = [];
  for (const cluster of items.filter(x => x.id === CLUSTER)) {
    const entries = children(cluster.data, cluster.end);
    const stamps = entries.filter(x => x.id === 0xe7);
    if (stamps.length !== 1) throw invalid();
    const timestamp = integer(stamps[0]); origin ??= timestamp;
    const relative = timestamp - origin;
    if (relative < 0) throw invalid();
    const selected: Uint8Array[] = [];
    const keepBlock = (block: Element) => {
      const track = vint(block.data, block.end);
      const offset = block.data + track.length;
      if (track.unknown || !track.value || offset + 3 >= block.end || (bytes[offset + 2] & 6)) throw invalid();
      let time = bytes[offset] * 256 + bytes[offset + 1]; if (time >= 32768) time -= 65536;
      const at = (relative + time) * scale / 1e9;
      if (at < -.12) throw invalid();
      if (at >= seconds) return false;
      maximum = Math.max(maximum, at); blocks++; return true;
    };
    for (const item of entries) {
      if (item.id === 0xa3) { if (keepBlock(item)) selected.push(raw(item)); }
      else if (item.id === 0xa0) {
        const group = children(item.data, item.end), block = group.filter(x => x.id === 0xa1);
        if (block.length !== 1) throw invalid();
        if (keepBlock(block[0])) selected.push(encode(0xa0, group.filter(x => x.id !== 0xbf && x.id !== 0x9b).map(raw)));
      }
    }
    if (selected.length) clusters.push(encode(CLUSTER, [encode(0xe7, [uint(relative)]), ...selected]));
  }
  if (!blocks) throw invalid();
  const duration = new Uint8Array(8);
  new DataView(duration.buffer).setFloat64(0, Math.min(seconds, maximum + .05) * 1e9 / scale);
  // SeekHead/Cues refer to old byte offsets. The short preview is sequential;
  // rebuild Info and Clusters, retain codec tracks, and omit stale indexes.
  const output = concat([raw(ebml), encode(SEGMENT, [
    encode(INFO, [...info.filter(x => x.id !== 0x4489 && x.id !== 0xbf).map(raw), encode(0x4489, [duration])]),
    raw(tracks[0]), ...clusters,
  ])]);
  if (!timedPreviewIsShort(output, 'video/webm')) throw invalid();
  return output;
}
