/**
 * Enhanced Realtime manager for 10K-user scale.
 * - Channel grouping (one channel per board, not per card)
 * - Event compression (deduplicate rapid updates to same entity)
 * - Graceful degradation (fall back to polling if Realtime disconnects)
 * - Memory-efficient buffer management
 */

import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type ChangePayload = RealtimePostgresChangesPayload<Record<string, any>>;

interface RealtimeManagerOptions {
  /** Flush interval for batched events (ms) */
  flushIntervalMs?: number;
  /** Max events to buffer before force-flush */
  maxBufferSize?: number;
  /** Enable polling fallback if realtime disconnects */
  enablePollingFallback?: boolean;
  /** Polling interval when in fallback mode (ms) */
  pollingIntervalMs?: number;
}

export class ScalableRealtimeManager {
  private channel: RealtimeChannel | null = null;
  private buffer: Map<string, ChangePayload> = new Map(); // keyed by entity ID for dedup
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private isPolling = false;
  private handler: (events: ChangePayload[]) => void;
  private options: Required<RealtimeManagerOptions>;
  private table: string;
  private filter: string;
  private channelName: string;

  constructor(
    channelName: string,
    table: string,
    filter: string,
    handler: (events: ChangePayload[]) => void,
    options: RealtimeManagerOptions = {},
  ) {
    this.channelName = channelName;
    this.table = table;
    this.filter = filter;
    this.handler = handler;
    this.options = {
      flushIntervalMs: options.flushIntervalMs ?? 500,
      maxBufferSize: options.maxBufferSize ?? 100,
      enablePollingFallback: options.enablePollingFallback ?? true,
      pollingIntervalMs: options.pollingIntervalMs ?? 3000,
    };
  }

  /** Subscribe to realtime changes */
  subscribe() {
    this.channel = supabase
      .channel(this.channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: this.table, filter: this.filter },
        (payload) => this.onEvent(payload),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.stopPolling();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (this.options.enablePollingFallback) {
            this.startPolling();
          }
        }
      });
    return this;
  }

  private onEvent(payload: ChangePayload) {
    // Deduplicate: for UPDATE events, keep only the latest for each entity
    const id = (payload.new as any)?.id || (payload.old as any)?.id || crypto.randomUUID();
    const key = `${payload.eventType}-${id}`;

    if (payload.eventType === 'UPDATE') {
      // Overwrite previous update for same entity
      this.buffer.set(key, payload);
    } else {
      this.buffer.set(`${key}-${Date.now()}`, payload);
    }

    // Force flush if buffer is full
    if (this.buffer.size >= this.options.maxBufferSize) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.options.flushIntervalMs);
    }
  }

  private flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.buffer.size === 0) return;

    const events = Array.from(this.buffer.values());
    this.buffer.clear();
    this.handler(events);
  }

  private startPolling() {
    if (this.isPolling) return;
    this.isPolling = true;
    console.warn(`[RealtimeManager] Falling back to polling for ${this.channelName}`);
    // Polling fallback - caller should handle via the handler
    // We emit a special "poll" signal
    this.pollingTimer = setInterval(() => {
      this.handler([]); // Empty array signals "please re-fetch"
    }, this.options.pollingIntervalMs);
  }

  private stopPolling() {
    if (!this.isPolling) return;
    this.isPolling = false;
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  /** Clean up all resources */
  destroy() {
    if (this.timer) clearTimeout(this.timer);
    this.stopPolling();
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.buffer.clear();
  }
}
