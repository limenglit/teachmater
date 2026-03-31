/**
 * Image inpainting algorithms for browser-side content-aware fill.
 *
 * 1. Telea-style fast marching inpainting (pure Canvas, zero dependencies)
 * 2. LaMa ONNX browser inference (optional, ~20MB model download)
 */

// ─── Telea-style Inpainting (Canvas-based) ───────────────────────────────────

interface Point { x: number; y: number; }

/**
 * Fast-marching Telea inpainting.
 * Fills masked pixels by propagating colour from the boundary inward,
 * weighted by inverse distance and gradient direction.
 */
export function inpaintTelea(
  imageData: ImageData,
  mask: Uint8Array, // 1 = inpaint, 0 = keep
  radius: number = 5,
): ImageData {
  const { width: W, height: H, data: d } = imageData;
  const out = new Uint8ClampedArray(d);
  const total = W * H;

  // Distance map (Infinity = unknown)
  const dist = new Float32Array(total).fill(Infinity);
  // Flag: 0=known, 1=band, 2=unknown
  const flag = new Uint8Array(total);

  // Initialise
  for (let i = 0; i < total; i++) {
    if (mask[i]) {
      flag[i] = 2; // unknown (to inpaint)
    } else {
      flag[i] = 0; // known
      dist[i] = 0;
    }
  }

  // Find initial band (boundary of mask)
  const band: Point[] = [];
  const dx = [-1, 1, 0, 0];
  const dy = [0, 0, -1, 1];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (flag[idx] !== 0) continue;
      for (let k = 0; k < 4; k++) {
        const nx = x + dx[k], ny = y + dy[k];
        if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
          const ni = ny * W + nx;
          if (flag[ni] === 2) {
            flag[idx] = 1;
            dist[idx] = 0;
            band.push({ x, y });
            break;
          }
        }
      }
    }
  }

  // Simple priority queue (sort by distance)
  // For performance, use a flat array sorted periodically
  const queue = [...band];
  const inQueue = new Uint8Array(total);
  for (const p of queue) inQueue[p.y * W + p.x] = 1;

  // Process band outward
  let iterations = 0;
  const maxIter = total * 2;

  while (queue.length > 0 && iterations++ < maxIter) {
    // Find minimum distance in queue
    let minIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < queue.length; i++) {
      const d2 = dist[queue[i].y * W + queue[i].x];
      if (d2 < minDist) { minDist = d2; minIdx = i; }
    }

    const p = queue.splice(minIdx, 1)[0];
    const pidx = p.y * W + p.x;
    inQueue[pidx] = 0;
    flag[pidx] = 0; // now known

    // Inpaint this pixel if it was unknown
    if (mask[pidx]) {
      let sumR = 0, sumG = 0, sumB = 0, sumA = 0, sumW = 0;
      for (let dy2 = -radius; dy2 <= radius; dy2++) {
        for (let dx2 = -radius; dx2 <= radius; dx2++) {
          const nx = p.x + dx2, ny = p.y + dy2;
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
          const ni = ny * W + nx;
          if (flag[ni] !== 0) continue; // only use known pixels
          if (mask[ni] && dist[ni] > 0) continue; // skip recently inpainted far pixels

          const d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          if (d2 > radius || d2 === 0) continue;

          const w = 1 / (d2 * d2 + 0.01);
          const si = ni * 4;
          sumR += out[si] * w;
          sumG += out[si + 1] * w;
          sumB += out[si + 2] * w;
          sumA += out[si + 3] * w;
          sumW += w;
        }
      }
      if (sumW > 0) {
        const oi = pidx * 4;
        out[oi] = Math.round(sumR / sumW);
        out[oi + 1] = Math.round(sumG / sumW);
        out[oi + 2] = Math.round(sumB / sumW);
        out[oi + 3] = Math.round(sumA / sumW);
      }
    }

    // Expand to neighbours
    for (let k = 0; k < 4; k++) {
      const nx = p.x + dx[k], ny = p.y + dy[k];
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const ni = ny * W + nx;
      if (flag[ni] !== 2) continue;
      const newDist = dist[pidx] + 1;
      if (newDist < dist[ni]) {
        dist[ni] = newDist;
        flag[ni] = 1;
        if (!inQueue[ni]) {
          queue.push({ x: nx, y: ny });
          inQueue[ni] = 1;
        }
      }
    }
  }

  return new ImageData(out, W, H);
}


// ─── Magic Eraser (flood-fill by colour similarity) ──────────────────────────

/**
 * Flood-fill erase: starting from (sx, sy), erase all connected pixels
 * whose colour is within `tolerance` of the seed pixel.
 * Returns the modified ImageData.
 */
export function magicErase(
  imageData: ImageData,
  sx: number,
  sy: number,
  tolerance: number = 30,
  feather: number = 5,
): ImageData {
  const { width: W, height: H, data: d } = imageData;
  const out = new Uint8ClampedArray(d);
  const visited = new Uint8Array(W * H);
  const si = (Math.floor(sy) * W + Math.floor(sx)) * 4;
  const seedR = d[si], seedG = d[si + 1], seedB = d[si + 2];

  const stack: [number, number][] = [[Math.floor(sx), Math.floor(sy)]];
  const erased = new Uint8Array(W * H);

  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const idx = y * W + x;
    if (visited[idx]) continue;
    visited[idx] = 1;

    const pi = idx * 4;
    const dist = Math.sqrt(
      (d[pi] - seedR) ** 2 + (d[pi + 1] - seedG) ** 2 + (d[pi + 2] - seedB) ** 2
    );

    if (dist <= tolerance) {
      erased[idx] = 1;
      out[pi + 3] = 0; // transparent
      stack.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
    }
  }

  // Feather edges
  if (feather > 0) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        if (erased[idx]) continue;
        // Check distance to nearest erased pixel
        let minDist = feather + 1;
        for (let dy = -feather; dy <= feather; dy++) {
          for (let dx = -feather; dx <= feather; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
            if (erased[ny * W + nx]) {
              const d2 = Math.sqrt(dx * dx + dy * dy);
              if (d2 < minDist) minDist = d2;
            }
          }
        }
        if (minDist <= feather) {
          const pi = idx * 4;
          const alpha = Math.round(out[pi + 3] * (minDist / feather));
          out[pi + 3] = alpha;
        }
      }
    }
  }

  return new ImageData(out, W, H);
}


// ─── Soft Eraser (Gaussian alpha falloff) ────────────────────────────────────

/**
 * Create a soft eraser brush stamp: a circular alpha mask with gaussian falloff.
 */
export function createSoftBrush(size: number, hardness: number = 0.5): ImageData {
  const s = Math.ceil(size);
  const canvas = new OffscreenCanvas(s * 2, s * 2);
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(s * 2, s * 2);
  const d = imgData.data;
  const cx = s, cy = s;
  const innerR = s * hardness;

  for (let y = 0; y < s * 2; y++) {
    for (let x = 0; x < s * 2; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      let alpha = 0;
      if (dist <= innerR) {
        alpha = 255;
      } else if (dist <= s) {
        // Gaussian falloff
        const t = (dist - innerR) / (s - innerR);
        alpha = Math.round(255 * Math.exp(-t * t * 3));
      }
      const i = (y * s * 2 + x) * 4;
      d[i] = 0;
      d[i + 1] = 0;
      d[i + 2] = 0;
      d[i + 3] = alpha;
    }
  }
  return imgData;
}


// ─── LaMa ONNX Inpainting ───────────────────────────────────────────────────

let lamaSession: any = null;
let lamaLoading = false;
let lamaLoadError: string | null = null;

const LAMA_MODEL_URL = 'https://huggingface.co/smartcow/lama-onnx/resolve/main/lama_fp32.onnx';

/**
 * Load the LaMa ONNX model into the browser.
 * Returns true if loaded successfully.
 */
export async function loadLamaModel(
  onProgress?: (pct: number) => void,
): Promise<boolean> {
  if (lamaSession) return true;
  if (lamaLoading) return false;
  lamaLoading = true;
  lamaLoadError = null;

  try {
    const ort = await import('onnxruntime-web');

    // Configure ONNX Runtime for browser
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/';

    // Try to load model
    const response = await fetch(LAMA_MODEL_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const contentLength = Number(response.headers.get('content-length') || 0);
    const reader = response.body!.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (contentLength > 0 && onProgress) {
        onProgress(Math.min(99, Math.round((received / contentLength) * 100)));
      }
    }

    const modelBuffer = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      modelBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    lamaSession = await ort.InferenceSession.create(modelBuffer.buffer, {
      executionProviders: ['wasm'],
    });

    onProgress?.(100);
    lamaLoading = false;
    return true;
  } catch (err: any) {
    console.error('Failed to load LaMa model:', err);
    lamaLoadError = err.message;
    lamaLoading = false;
    return false;
  }
}

export function getLamaStatus(): { loaded: boolean; loading: boolean; error: string | null } {
  return { loaded: !!lamaSession, loading: lamaLoading, error: lamaLoadError };
}

/**
 * Run LaMa inpainting on the given image with a binary mask.
 * Image and mask should be the same dimensions.
 */
export async function inpaintLama(
  imageData: ImageData,
  mask: Uint8Array,
): Promise<ImageData | null> {
  if (!lamaSession) {
    const loaded = await loadLamaModel();
    if (!loaded) return null;
  }

  try {
    const ort = await import('onnxruntime-web');
    const { width: W, height: H, data: d } = imageData;

    // LaMa expects 512x512 input
    const SIZE = 512;

    // Resize image to 512x512
    const resizeCanvas = new OffscreenCanvas(SIZE, SIZE);
    const rCtx = resizeCanvas.getContext('2d')!;
    const tmpCanvas = new OffscreenCanvas(W, H);
    const tmpCtx = tmpCanvas.getContext('2d')!;
    tmpCtx.putImageData(imageData, 0, 0);
    rCtx.drawImage(tmpCanvas, 0, 0, SIZE, SIZE);
    const resizedData = rCtx.getImageData(0, 0, SIZE, SIZE);

    // Resize mask to 512x512
    const maskCanvas = new OffscreenCanvas(W, H);
    const mCtx = maskCanvas.getContext('2d')!;
    const maskImgData = mCtx.createImageData(W, H);
    for (let i = 0; i < mask.length; i++) {
      const pi = i * 4;
      const v = mask[i] ? 255 : 0;
      maskImgData.data[pi] = v;
      maskImgData.data[pi + 1] = v;
      maskImgData.data[pi + 2] = v;
      maskImgData.data[pi + 3] = 255;
    }
    mCtx.putImageData(maskImgData, 0, 0);
    const maskResized = new OffscreenCanvas(SIZE, SIZE);
    const mrCtx = maskResized.getContext('2d')!;
    mrCtx.drawImage(maskCanvas, 0, 0, SIZE, SIZE);
    const maskResizedData = mrCtx.getImageData(0, 0, SIZE, SIZE);

    // Prepare tensors: image [1, 3, 512, 512] float32 (0-1), mask [1, 1, 512, 512] float32
    const imgTensor = new Float32Array(3 * SIZE * SIZE);
    const maskTensor = new Float32Array(1 * SIZE * SIZE);

    for (let i = 0; i < SIZE * SIZE; i++) {
      const pi = i * 4;
      imgTensor[i] = resizedData.data[pi] / 255; // R
      imgTensor[SIZE * SIZE + i] = resizedData.data[pi + 1] / 255; // G
      imgTensor[2 * SIZE * SIZE + i] = resizedData.data[pi + 2] / 255; // B
      maskTensor[i] = maskResizedData.data[pi] > 128 ? 1 : 0;
    }

    const imgInput = new ort.Tensor('float32', imgTensor, [1, 3, SIZE, SIZE]);
    const maskInput = new ort.Tensor('float32', maskTensor, [1, 1, SIZE, SIZE]);

    const feeds: Record<string, any> = {};
    const inputNames = lamaSession.inputNames as string[];
    feeds[inputNames[0]] = imgInput;
    feeds[inputNames[1]] = maskInput;

    const results = await lamaSession.run(feeds);
    const outputName = lamaSession.outputNames[0] as string;
    const output = results[outputName].data as Float32Array;

    // Convert output back to ImageData at 512x512
    const outCanvas = new OffscreenCanvas(SIZE, SIZE);
    const oCtx = outCanvas.getContext('2d')!;
    const outImgData = oCtx.createImageData(SIZE, SIZE);

    for (let i = 0; i < SIZE * SIZE; i++) {
      const pi = i * 4;
      outImgData.data[pi] = Math.round(Math.min(1, Math.max(0, output[i])) * 255);
      outImgData.data[pi + 1] = Math.round(Math.min(1, Math.max(0, output[SIZE * SIZE + i])) * 255);
      outImgData.data[pi + 2] = Math.round(Math.min(1, Math.max(0, output[2 * SIZE * SIZE + i])) * 255);
      outImgData.data[pi + 3] = 255;
    }
    oCtx.putImageData(outImgData, 0, 0);

    // Resize back to original dimensions
    const finalCanvas = new OffscreenCanvas(W, H);
    const fCtx = finalCanvas.getContext('2d')!;
    fCtx.drawImage(outCanvas, 0, 0, W, H);
    return fCtx.getImageData(0, 0, W, H);
  } catch (err: any) {
    console.error('LaMa inpainting failed:', err);
    return null;
  }
}
