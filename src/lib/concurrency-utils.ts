/**
 * Rate limiter using Token Bucket algorithm.
 * Controls burst traffic for storage uploads at scale.
 */
export class TokenBucketLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number; // tokens per second
  private lastRefill: number;
  private waitQueue: Array<() => void> = [];

  /**
   * @param maxTokens  Max burst capacity
   * @param refillRate Tokens added per second
   */
  constructor(maxTokens: number, refillRate: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  /** Acquire a token, waiting if necessary */
  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    // Wait for token availability
    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
      const waitMs = ((1 - this.tokens) / this.refillRate) * 1000;
      setTimeout(() => {
        this.refill();
        if (this.tokens >= 1) {
          this.tokens -= 1;
        }
        const idx = this.waitQueue.indexOf(resolve);
        if (idx >= 0) this.waitQueue.splice(idx, 1);
        resolve();
      }, Math.max(waitMs, 50));
    });
  }

  /** Check if a token is available without consuming */
  canAcquire(): boolean {
    this.refill();
    return this.tokens >= 1;
  }
}

/**
 * Request batcher: accumulates operations and flushes them in bulk.
 * Reduces DB connection overhead for high-frequency inserts.
 */
export class RequestBatcher<T> {
  private buffer: T[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushFn: (items: T[]) => Promise<void>;
  private maxBatchSize: number;
  private flushIntervalMs: number;

  constructor(
    flushFn: (items: T[]) => Promise<void>,
    maxBatchSize = 50,
    flushIntervalMs = 200,
  ) {
    this.flushFn = flushFn;
    this.maxBatchSize = maxBatchSize;
    this.flushIntervalMs = flushIntervalMs;
  }

  add(item: T) {
    this.buffer.push(item);
    if (this.buffer.length >= this.maxBatchSize) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushIntervalMs);
    }
  }

  async flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.buffer.length === 0) return;
    const batch = this.buffer;
    this.buffer = [];
    await this.flushFn(batch);
  }

  destroy() {
    if (this.timer) clearTimeout(this.timer);
    this.buffer = [];
  }
}

/**
 * Connection-aware Supabase wrapper with smart retry.
 * Implements exponential backoff with jitter for resilience.
 */
export async function resilientQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  maxRetries = 3,
): Promise<{ data: T | null; error: any }> {
  let lastError: any = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff with jitter
      const baseDelay = 500 * Math.pow(2, attempt - 1);
      const jitter = Math.random() * baseDelay * 0.5;
      await new Promise(r => setTimeout(r, baseDelay + jitter));
    }
    try {
      const result = await queryFn();
      if (!result.error) return result;
      lastError = result.error;
      // Don't retry on client errors (4xx)
      if (result.error?.code && String(result.error.code).startsWith('4')) {
        return result;
      }
    } catch (err) {
      lastError = err;
    }
  }
  return { data: null, error: lastError };
}
