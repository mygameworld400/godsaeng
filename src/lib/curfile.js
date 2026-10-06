/* .cur / .ico 파일 읽기 → PNG data URL + 클릭 지점(핫스팟)
   구조: 6바이트 머리말(종류 2=cur, 1=ico, 개수) + 16바이트 항목들(가로·세로·핫스팟·크기·위치) + 그림 데이터.
   그림은 PNG 그대로이거나 BMP(DIB: 1·4·8·24·32비트 + AND 마스크). 여러 크기가 들어 있으면 32px 에 가장 가까운 것을 쓴다. */

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47]

function toDataUrl(bytes, type) {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  return `data:${type};base64,${btoa(s)}`
}

/** BMP(DIB) → RGBA 픽셀 */
function decodeDib(v, off) {
  const hdr = v.getUint32(off, true), w = v.getInt32(off + 4, true), h2 = v.getInt32(off + 8, true)
  const bpp = v.getUint16(off + 14, true), h = Math.abs(h2) / 2  // 높이는 XOR+AND 두 장이라 반
  const colors = v.getUint32(off + 32, true) || (bpp <= 8 ? 1 << bpp : 0)
  const pal = off + hdr, data = pal + colors * 4
  const xorStride = Math.ceil(w * bpp / 32) * 4, andStride = Math.ceil(w / 32) * 4, andOff = data + xorStride * h
  const px = new Uint8ClampedArray(w * h * 4)
  let anyAlpha = false
  for (let y = 0; y < h; y++) {
    const row = data + (h - 1 - y) * xorStride  // 아래에서 위로 저장됨
    for (let x = 0; x < w; x++) {
      let r, g, b, a = 255
      if (bpp === 32) { b = v.getUint8(row + x * 4); g = v.getUint8(row + x * 4 + 1); r = v.getUint8(row + x * 4 + 2); a = v.getUint8(row + x * 4 + 3); if (a) anyAlpha = true }
      else if (bpp === 24) { b = v.getUint8(row + x * 3); g = v.getUint8(row + x * 3 + 1); r = v.getUint8(row + x * 3 + 2) }
      else {
        const bit = x * bpp, byte = v.getUint8(row + (bit >> 3)), idx = (byte >> (8 - bpp - (bit & 7))) & ((1 << bpp) - 1)
        b = v.getUint8(pal + idx * 4); g = v.getUint8(pal + idx * 4 + 1); r = v.getUint8(pal + idx * 4 + 2)
      }
      const i = (y * w + x) * 4
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a
    }
  }
  // 32비트에 알파가 없거나 그 이하 비트면 AND 마스크(1 = 투명)를 쓴다
  if (bpp < 32 || !anyAlpha) {
    for (let y = 0; y < h; y++) {
      const row = andOff + (h - 1 - y) * andStride
      for (let x = 0; x < w; x++) {
        const m = (v.getUint8(row + (x >> 3)) >> (7 - (x & 7))) & 1
        px[(y * w + x) * 4 + 3] = m ? 0 : 255
      }
    }
  }
  return { w, h, px }
}

/**
 * @param {File} file .cur 또는 .ico
 * @returns {Promise<{ image: string, hx: number, hy: number, w: number, h: number }>}
 */
export async function readCur(file) {
  const buf = await file.arrayBuffer(), v = new DataView(buf), bytes = new Uint8Array(buf)
  const type = v.getUint16(2, true), n = v.getUint16(4, true)
  if (v.getUint16(0, true) !== 0 || (type !== 1 && type !== 2) || !n) throw new Error('커서(.cur) 파일이 아니에요.')
  const entries = []
  for (let i = 0; i < n; i++) {
    const e = 6 + i * 16
    entries.push({ w: v.getUint8(e) || 256, h: v.getUint8(e + 1) || 256, hx: type === 2 ? v.getUint16(e + 4, true) : 0, hy: type === 2 ? v.getUint16(e + 6, true) : 0, size: v.getUint32(e + 8, true), off: v.getUint32(e + 12, true) })
  }
  // 보통 화면 커서 크기(32px)에 가장 가까운 그림을 고른다 (없으면 32 이상 중 가장 작은 것, 그래도 없으면 가장 큰 것)
  const ok = entries.filter(e => e.w <= 128 && e.h <= 128)
  const pool = ok.length ? ok : entries
  const e = pool.find(x => x.w === 32) || pool.filter(x => x.w >= 32).sort((a, b) => a.w - b.w)[0] || pool.sort((a, b) => b.w - a.w)[0]
  const isPng = PNG_SIG.every((x, i) => bytes[e.off + i] === x)
  if (isPng) return { image: toDataUrl(bytes.subarray(e.off, e.off + e.size), 'image/png'), hx: e.hx, hy: e.hy, w: e.w, h: e.h }
  const { w, h, px } = decodeDib(v, e.off)
  const c = document.createElement('canvas'); c.width = w; c.height = h
  c.getContext('2d').putImageData(new ImageData(px, w, h), 0, 0)
  return { image: c.toDataURL('image/png'), hx: Math.min(e.hx, w - 1), hy: Math.min(e.hy, h - 1), w, h }
}
