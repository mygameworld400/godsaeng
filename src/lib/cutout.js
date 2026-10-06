/* 이미지 → 정사각 PNG 아이콘 (선택적으로 배경 제거)
   배경 제거는 라이브러리 없이 캔버스로 한다: 테두리 픽셀에서 배경색을 잡고,
   가장자리에서부터 그 색과 비슷한 픽셀을 이어서(flood fill) 투명하게 만든다.
   단색·단순한 배경에 잘 맞는다. 사진처럼 복잡한 배경은 강도를 조절하거나 끄고 쓴다. */

const SIZE = 256

function loadImage(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); res(img) }
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('이미지를 읽지 못했어요.')) }
    img.src = url
  })
}

/** 테두리 픽셀 중 가장 흔한 색(양자화)을 배경색으로 본다. 이미 투명하면 null */
function borderColor(d, w, h) {
  const counts = new Map(), pick = (x, y) => {
    const i = (y * w + x) * 4
    if (d[i + 3] < 16) return
    const k = (d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4)
    const c = counts.get(k) || { n: 0, r: 0, g: 0, b: 0 }
    c.n++; c.r += d[i]; c.g += d[i + 1]; c.b += d[i + 2]; counts.set(k, c)
  }
  for (let x = 0; x < w; x++) { pick(x, 0); pick(x, h - 1) }
  for (let y = 0; y < h; y++) { pick(0, y); pick(w - 1, y) }
  let best = null
  for (const c of counts.values()) if (!best || c.n > best.n) best = c
  return best && best.n > (w + h) * 0.3 ? [best.r / best.n, best.g / best.n, best.b / best.n] : null
}

function removeBg(ctx, w, h, tolerance) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data
  const bg = borderColor(d, w, h)
  if (!bg) return
  const tol = tolerance * tolerance * 3, soft = (tolerance * 1.6) ** 2 * 3
  const dist = i => (d[i] - bg[0]) ** 2 + (d[i + 1] - bg[1]) ** 2 + (d[i + 2] - bg[2]) ** 2
  const seen = new Uint8Array(w * h), stack = []
  const push = (x, y) => { const p = y * w + x; if (!seen[p]) { seen[p] = 1; stack.push(p) } }
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1) }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y) }
  while (stack.length) {
    const p = stack.pop(), i = p * 4, dd = dist(i)
    if (dd > soft) continue
    // 배경색에 가까울수록 투명, 경계 부근은 반투명으로 부드럽게
    d[i + 3] = dd <= tol ? 0 : Math.min(d[i + 3], Math.round(255 * (dd - tol) / (soft - tol)))
    if (dd > tol) continue
    const x = p % w, y = (p - x) / w
    if (x > 0) push(x - 1, y)
    if (x < w - 1) push(x + 1, y)
    if (y > 0) push(x, y - 1)
    if (y < h - 1) push(x, y + 1)
  }
  ctx.putImageData(img, 0, 0)
}

/** 투명 여백을 잘라 내용이 가운데 꽉 차게 한다 */
function trimToSquare(src) {
  const w = src.width, h = src.height, d = src.getContext('2d').getImageData(0, 0, w, h).data
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 12) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
  }
  const out = document.createElement('canvas'); out.width = out.height = SIZE
  if (x1 < 0) return out
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, s = (SIZE * 0.92) / Math.max(bw, bh)
  const ctx = out.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, x0, y0, bw, bh, (SIZE - bw * s) / 2, (SIZE - bh * s) / 2, bw * s, bh * s)
  return out
}

/**
 * @param {File} file
 * @param {{cutout?: boolean, tolerance?: number}} opt  tolerance 5~80 (기본 28)
 * @returns {Promise<string>} PNG data URL (256x256)
 */
export async function makeIcon(file, { cutout = true, tolerance = 28 } = {}) {
  const img = await loadImage(file)
  // 작업 해상도는 최대 512 로 줄여서 빠르게
  const k = Math.min(1, 512 / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k))
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, c.width, c.height)
  if (cutout) removeBg(ctx, c.width, c.height, tolerance)
  return trimToSquare(c).toDataURL('image/png')
}

/** 프로필 사진: 가운데를 정사각으로 잘라 256px JPEG data URL (배경 제거 없음) */
export async function makeAvatar(file) {
  const img = await loadImage(file)
  const side = Math.min(img.width, img.height)
  const c = document.createElement('canvas'); c.width = c.height = SIZE
  const ctx = c.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, SIZE, SIZE)
  return c.toDataURL('image/jpeg', 0.85)
}

/** 배경 이미지: 긴 쪽 1600px 이하 JPEG data URL */
export async function makeBackground(file) {
  const img = await loadImage(file)
  const k = Math.min(1, 1600 / Math.max(img.width, img.height))
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
  const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.8)
}

/** 책 표지: 400x600 안에 맞춘 JPEG data URL */
export async function makeCover(file) {
  const img = await loadImage(file)
  const k = Math.min(1, 400 / img.width, 600 / img.height)
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
  const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.82)
}

/** 커서 이미지: (선택) 배경 제거 후 40px PNG. 브라우저 커서는 128px 이하만 받는다 */
export async function makeCursor(file, { cutout = true, tolerance = 28 } = {}) {
  const img = await loadImage(file)
  const k = Math.min(1, 512 / Math.max(img.width, img.height))
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k))
  const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0, c.width, c.height)
  if (cutout) removeBg(ctx, c.width, c.height, tolerance)
  const sq = trimToSquare(c), out = document.createElement('canvas'); out.width = out.height = 40
  const o = out.getContext('2d'); o.imageSmoothingQuality = 'high'; o.drawImage(sq, 0, 0, 40, 40)
  return out.toDataURL('image/png')
}

/**
 * 스티커 시트 나누기: 한 장에 여러 스티커가 있는 이미지 → 배경을 지우고 떨어진 그림 덩어리마다 하나씩 (PNG, 긴 쪽 ≤160px).
 * 작은 틈(몇 px)은 이어진 것으로 본다(글자·점이 한 스티커에 붙어 있게). 너무 작은 조각은 버린다.
 */
export async function splitStickers(file, { tolerance = 28, cutout = true } = {}) {
  const img = await loadImage(file)
  const k = Math.min(1, 1600 / Math.max(img.width, img.height))
  const W = Math.max(1, Math.round(img.width * k)), H = Math.max(1, Math.round(img.height * k))
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0, W, H)
  if (cutout) removeBg(ctx, W, H, tolerance)
  const d = ctx.getImageData(0, 0, W, H).data
  // 4px 칸 격자로 줄여서(작은 틈 메우기) 덩어리를 찾는다
  const B = 4, gw = Math.ceil(W / B), gh = Math.ceil(H / B), grid = new Uint8Array(gw * gh)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 24) grid[((y / B) | 0) * gw + ((x / B) | 0)] = 1
  const dil = new Uint8Array(gw * gh)  // 한 칸 넓히기
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) if (grid[y * gw + x])
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < gh && xx >= 0 && xx < gw) dil[yy * gw + xx] = 1 }
  const seen = new Uint8Array(gw * gh), boxes = []
  for (let i = 0; i < gw * gh; i++) {
    if (!dil[i] || seen[i]) continue
    let x0 = gw, y0 = gh, x1 = 0, y1 = 0, n = 0
    const st = [i]; seen[i] = 1
    while (st.length) {
      const p = st.pop(), x = p % gw, y = (p - x) / gw
      if (grid[p]) n++
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
      for (const q of [p - 1, p + 1, p - gw, p + gw]) {
        if (q < 0 || q >= gw * gh || seen[q] || !dil[q]) continue
        if ((q === p - 1 && x === 0) || (q === p + 1 && x === gw - 1)) continue
        seen[q] = 1; st.push(q)
      }
    }
    if (n >= Math.max(20, gw * gh * 0.0008)) boxes.push({ x: x0 * B, y: y0 * B, w: (x1 - x0 + 1) * B, h: (y1 - y0 + 1) * B })
  }
  boxes.sort((a, b) => (a.y - b.y) || (a.x - b.x))
  return boxes.map(b => {
    const s = Math.min(1, 160 / Math.max(b.w, b.h)), out = document.createElement('canvas')
    out.width = Math.max(1, Math.round(b.w * s)); out.height = Math.max(1, Math.round(b.h * s))
    const o = out.getContext('2d'); o.imageSmoothingQuality = 'high'
    o.drawImage(c, b.x, b.y, b.w, b.h, 0, 0, out.width, out.height)
    return out.toDataURL('image/png')
  })
}
