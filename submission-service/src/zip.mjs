// Inspect ZIP structure without extracting files or running contributor code.
// ZIP64, encryption, and nonstandard compression are intentionally unsupported.
export function validateZip(bytes) {
  const fail = message => { throw new Error(message); };
  if (bytes.length < 22) fail('The upload is not a complete ZIP file.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = p => view.getUint16(p, true);
  const u32 = p => view.getUint32(p, true);
  let end = -1;
  for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 65557); p--) {
    if (u32(p) === 0x06054b50 && p + 22 + u16(p + 20) === bytes.length) { end = p; break; }
  }
  if (end < 0) fail('The ZIP directory is missing or incomplete.');
  const count = u16(end + 10), directorySize = u32(end + 12), directoryStart = u32(end + 16);
  if (u16(end + 4) || u16(end + 6) || u16(end + 8) !== count || count === 65535 || directoryStart === 0xffffffff) fail('Use a single standard ZIP archive; split archives and ZIP64 are not supported.');
  if (!count || count > 5000 || directoryStart + directorySize !== end) fail('The ZIP directory is invalid or contains more than 5,000 entries.');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const names = new Set(), files = new Set(), ranges = [];
  let cursor = directoryStart, expanded = 0;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || u32(cursor) !== 0x02014b50) fail('The ZIP directory is malformed.');
    const flags = u16(cursor + 8), method = u16(cursor + 10);
    const compressed = u32(cursor + 20), uncompressed = u32(cursor + 24);
    const nameLength = u16(cursor + 28), extra = u16(cursor + 30), comment = u16(cursor + 32);
    const local = u32(cursor + 42), mode = u32(cursor + 38) >>> 16;
    const entryEnd = cursor + 46 + nameLength + extra + comment;
    if (entryEnd > end || !nameLength || nameLength > 512 || u16(cursor + 34)) fail('The ZIP contains an invalid entry.');
    if (flags & 0x41 || ![0, 8].includes(method) || compressed === 0xffffffff || uncompressed === 0xffffffff) fail('Use an unencrypted ZIP with standard compression.');
    const type = mode & 0xf000;
    if (type && ![0x4000, 0x8000].includes(type)) fail('ZIP entries must be ordinary files or directories; links are not allowed.');
    let name;
    try { name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength)); }
    catch { fail('ZIP filenames must use UTF-8.'); }
    const parts = name.replace(/\/$/, '').split('/');
    if (name.startsWith('/') || /[\\:\x00-\x1f\x7f]/.test(name) || parts.some(p => !p || p === '.' || p === '..')) fail('ZIP entries must use safe relative paths.');
    if ((type === 0x4000 && !name.endsWith('/')) || (type === 0x8000 && name.endsWith('/'))) fail('ZIP file and directory types do not match their paths.');
    if (name.endsWith('/') && uncompressed) fail('ZIP directory entries must be empty.');
    const canonical = name.replace(/\/$/, '');
    if (names.has(canonical)) fail('The ZIP contains duplicate paths.');
    names.add(canonical);
    if (!name.endsWith('/')) files.add(name);
    expanded += uncompressed;
    if (expanded > 500 * 1024 * 1024) fail('The expanded ZIP must be no larger than 500 MiB.');
    if (local + 30 > directoryStart || u32(local) !== 0x04034b50) fail('A ZIP file header is missing.');
    const localNameLength = u16(local + 26), localExtra = u16(local + 28);
    const dataStart = local + 30 + localNameLength + localExtra;
    if (dataStart + compressed > directoryStart || localNameLength !== nameLength || u16(local + 6) !== flags || u16(local + 8) !== method) fail('ZIP file headers do not match the directory.');
    const localName = bytes.subarray(local + 30, local + 30 + localNameLength);
    if (!localName.every((byte, j) => byte === bytes[cursor + 46 + j])) fail('ZIP file paths do not match the directory.');
    ranges.push([local, dataStart + compressed]);
    cursor = entryEnd;
  }
  if (cursor !== end) fail('The ZIP directory length is invalid.');
  ranges.sort((a, b) => a[0] - b[0]);
  if (ranges[0][0] !== 0 || ranges.some((range, i) => i && range[0] < ranges[i - 1][1])) fail('The ZIP contains overlapping or nonstandard file entries.');
  for (const name of files) {
    const parts = name.split('/');
    parts.pop();
    while (parts.length) {
      if (files.has(parts.join('/'))) fail('A ZIP path is both a file and a directory.');
      parts.pop();
    }
  }
  const required = ['README.md', 'AUTHOR_GUIDE.md', 'SUBMISSION.md', 'task/task.toml', 'task/instruction.md', 'task/environment/Dockerfile', 'task/tests/Dockerfile', 'task/tests/test.sh'];
  const missing = required.filter(name => !files.has(name));
  if (!Array.from(files).some(name => name.startsWith('author_checks/'))) missing.push('author_checks/');
  if (missing.length) fail(`Missing required files at the ZIP root: ${missing.join(', ')}.`);
  return { entries: count, expandedBytes: expanded };
}
