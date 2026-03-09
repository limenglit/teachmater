/**
 * Throttled Realtime handler for high-concurrency scenarios.
 * Batches rapid-fire Postgres changes into periodic UI updates
 * to prevent render storms (e.g., 100 cards arriving in 2 seconds).
 */

import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type ChangePayload = RealtimePostgresChangesPayload<Record<string, any>>;
type BatchHandler = (events: ChangePayload[]) => void;

export class RealtimeThrottle {
  private buffer: ChangePayload[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private handler: BatchHandler;
  private intervalMs: number;

  /**
   * @param handler  Called with accumulated events
   * @param intervalMs  Flush interval (default 500ms — ~2 updates/sec)
   */
  constructor(handler: BatchHandler, intervalMs = 500) {
    this.handler = handler;
    this.intervalMs = intervalMs;
  }

  /** Push a single realtime event into the buffer */
  push(event: ChangePayload) {
    this.buffer.push(event);

    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.intervalMs);
    }
  }

  /** Immediately flush all buffered events */
  flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.buffer.length === 0) return;
    const batch = this.buffer;
    this.buffer = [];
    this.handler(batch);
  }

  /** Clean up */
  destroy() {
    if (this.timer) clearTimeout(this.timer);
    this.buffer = [];
  }
}
