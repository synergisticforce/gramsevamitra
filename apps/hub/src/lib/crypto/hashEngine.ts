export interface HashDigests {
  md5: string;
  sha1: string;
  sha256: string;
  sha512: string;
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function digestSha(algorithm: 'SHA-1' | 'SHA-256' | 'SHA-512', text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest(algorithm, data);
  return bytesToHex(hash);
}

function md5Hex(bytes: Uint8Array): string {
  const state = [1732584193, -271733879, -1732584194, 271733878];
  const tail = new Uint8Array(64);
  const n = bytes.length;
  let offset = 0;

  while (offset + 64 <= n) {
    md5Cycle(state, md5Block(bytes.subarray(offset, offset + 64)));
    offset += 64;
  }

  const remainder = bytes.subarray(offset);
  tail.set(remainder);
  tail[remainder.length] = 0x80;

  if (remainder.length >= 56) {
    md5Cycle(state, md5Block(tail));
    tail.fill(0);
  }

  const bitLen = n * 8;
  const view = new DataView(tail.buffer);
  view.setUint32(56, bitLen >>> 0, true);
  view.setUint32(60, Math.floor(bitLen / 0x100000000), true);
  md5Cycle(state, md5Block(tail));

  return state.map((v) => (v >>> 0).toString(16).padStart(8, '0')).join('');
}

function md5Block(chunk: Uint8Array): number[] {
  const m = new Array<number>(16);
  for (let i = 0; i < 16; i++) {
    m[i] = chunk[i * 4] | (chunk[i * 4 + 1] << 8) | (chunk[i * 4 + 2] << 16) | (chunk[i * 4 + 3] << 24);
  }
  return m;
}

function add32(a: number, b: number): number {
  return (a + b) | 0;
}

function md5Cycle(state: number[], block: number[]): void {
  let a = state[0];
  let b = state[1];
  let c = state[2];
  let d = state[3];

  const cmn = (q: number, ra: number, rb: number, x: number, s: number, t: number) => {
    ra = add32(add32(ra, q), add32(x, t));
    return add32((ra << s) | (ra >>> (32 - s)), rb);
  };

  const ff = (ra: number, rb: number, rc: number, rd: number, x: number, s: number, t: number) =>
    cmn((rb & rc) | (~rb & rd), ra, rb, x, s, t);
  const gg = (ra: number, rb: number, rc: number, rd: number, x: number, s: number, t: number) =>
    cmn((rb & rd) | (rc & ~rd), ra, rb, x, s, t);
  const hh = (ra: number, rb: number, rc: number, rd: number, x: number, s: number, t: number) =>
    cmn(rb ^ rc ^ rd, ra, rb, x, s, t);
  const ii = (ra: number, rb: number, rc: number, rd: number, x: number, s: number, t: number) =>
    cmn(rc ^ (rb | ~rd), ra, rb, x, s, t);

  a = ff(a, b, c, d, block[0], 7, -680876936);
  d = ff(d, a, b, c, block[1], 12, -389564586);
  c = ff(c, d, a, b, block[2], 17, 606105819);
  b = ff(b, c, d, a, block[3], 22, -1044525330);
  a = ff(a, b, c, d, block[4], 7, -176418897);
  d = ff(d, a, b, c, block[5], 12, 1200080426);
  c = ff(c, d, a, b, block[6], 17, -1473231341);
  b = ff(b, c, d, a, block[7], 22, -45705983);
  a = ff(a, b, c, d, block[8], 7, 1770035416);
  d = ff(d, a, b, c, block[9], 12, -1958414417);
  c = ff(c, d, a, b, block[10], 17, -42063);
  b = ff(b, c, d, a, block[11], 22, -1990404162);
  a = ff(a, b, c, d, block[12], 7, 1804603682);
  d = ff(d, a, b, c, block[13], 12, -40341101);
  c = ff(c, d, a, b, block[14], 17, -1502002290);
  b = ff(b, c, d, a, block[15], 22, 1236535329);

  a = gg(a, b, c, d, block[1], 5, -165796510);
  d = gg(d, a, b, c, block[6], 9, -1069501632);
  c = gg(c, d, a, b, block[11], 14, 643717713);
  b = gg(b, c, d, a, block[0], 20, -373897302);
  a = gg(a, b, c, d, block[5], 5, -701558691);
  d = gg(d, a, b, c, block[10], 9, 38016083);
  c = gg(c, d, a, b, block[15], 14, -660478335);
  b = gg(b, c, d, a, block[4], 20, -405537848);
  a = gg(a, b, c, d, block[9], 5, 568446438);
  d = gg(d, a, b, c, block[14], 9, -1019803690);
  c = gg(c, d, a, b, block[3], 14, -187363961);
  b = gg(b, c, d, a, block[8], 20, 1163531501);
  a = gg(a, b, c, d, block[13], 5, -1444681467);
  d = gg(d, a, b, c, block[2], 9, -51403784);
  c = gg(c, d, a, b, block[7], 14, 1735328473);
  b = gg(b, c, d, a, block[12], 20, -1926607734);

  a = hh(a, b, c, d, block[5], 4, -378558);
  d = hh(d, a, b, c, block[8], 11, -2022574463);
  c = hh(c, d, a, b, block[11], 16, 1839030562);
  b = hh(b, c, d, a, block[14], 23, -35309556);
  a = hh(a, b, c, d, block[1], 4, -1530992060);
  d = hh(d, a, b, c, block[4], 11, 1272893353);
  c = hh(c, d, a, b, block[7], 16, -155497632);
  b = hh(b, c, d, a, block[10], 23, -1094730640);
  a = hh(a, b, c, d, block[13], 4, 681279174);
  d = hh(d, a, b, c, block[0], 11, -358537222);
  c = hh(c, d, a, b, block[3], 16, -722521979);
  b = hh(b, c, d, a, block[6], 23, 76029189);
  a = hh(a, b, c, d, block[9], 4, -640364487);
  d = hh(d, a, b, c, block[12], 11, -421815835);
  c = hh(c, d, a, b, block[15], 16, 530742520);
  b = hh(b, c, d, a, block[2], 23, -995338651);

  a = ii(a, b, c, d, block[0], 6, -198630844);
  d = ii(d, a, b, c, block[7], 10, 1126891415);
  c = ii(c, d, a, b, block[14], 15, -1416354905);
  b = ii(b, c, d, a, block[5], 21, -57434055);
  a = ii(a, b, c, d, block[12], 6, 1700485571);
  d = ii(d, a, b, c, block[3], 10, -1894986606);
  c = ii(c, d, a, b, block[10], 15, -1051523);
  b = ii(b, c, d, a, block[1], 21, -2054922799);
  a = ii(a, b, c, d, block[8], 6, 1873313359);
  d = ii(d, a, b, c, block[15], 10, -30611744);
  c = ii(c, d, a, b, block[6], 15, -1560198380);
  b = ii(b, c, d, a, block[13], 21, 1309151649);
  a = ii(a, b, c, d, block[4], 6, -145523070);
  d = ii(d, a, b, c, block[11], 10, -1120210379);
  c = ii(c, d, a, b, block[2], 15, 718787259);
  b = ii(b, c, d, a, block[9], 21, -343485551);

  state[0] = add32(state[0], a);
  state[1] = add32(state[1], b);
  state[2] = add32(state[2], c);
  state[3] = add32(state[3], d);
}

export function md5(text: string): string {
  return md5Hex(new TextEncoder().encode(text));
}

export async function computeAllHashes(text: string): Promise<HashDigests> {
  const [sha1, sha256, sha512] = await Promise.all([
    digestSha('SHA-1', text),
    digestSha('SHA-256', text),
    digestSha('SHA-512', text),
  ]);
  return { md5: md5(text), sha1, sha256, sha512 };
}
