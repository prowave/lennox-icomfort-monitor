"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { ReadingEvent } from "./types";

const STALE_AFTER_MS = 30_000;

export interface StreamStatus {
  connected: boolean;
  lastEventAt: number | null;
  stale: boolean;
}

type Listener = (event: ReadingEvent) => void;
type StatusListener = (status: StreamStatus) => void;

/**
 * One EventSource shared by every hook consumer, stashed on globalThis so a
 * Next.js dev-mode module reload doesn't open a second connection.
 */
class LennoxStream {
  private listeners = new Set<Listener>();
  private statusListeners = new Set<StatusListener>();
  private status: StreamStatus = { connected: false, lastEventAt: null, stale: true };
  private source: EventSource | null = null;

  ensureStarted(): void {
    if (this.source) return;
    const source = new EventSource("/api/stream");
    this.source = source;

    source.onmessage = (msg) => {
      const event = JSON.parse(msg.data) as ReadingEvent;
      this.setStatus({
        connected: event.type === "heartbeat" ? event.connected : true,
        lastEventAt: Date.now(),
        stale: false,
      });
      for (const listener of this.listeners) listener(event);
    };

    source.onerror = () => {
      this.setStatus({ ...this.status, connected: false });
    };

    setInterval(() => {
      const { lastEventAt, stale } = this.status;
      if (lastEventAt !== null && !stale && Date.now() - lastEventAt > STALE_AFTER_MS) {
        this.setStatus({ ...this.status, stale: true });
      }
    }, 5000);
  }

  private setStatus(next: StreamStatus): void {
    this.status = next;
    for (const listener of this.statusListeners) listener(next);
  }

  getStatus(): StreamStatus {
    return this.status;
  }

  subscribeEvents(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }
}

const globalForStream = globalThis as unknown as { lennoxStream?: LennoxStream };
const stream = globalForStream.lennoxStream ?? new LennoxStream();
globalForStream.lennoxStream = stream;

export function useLennoxStreamStatus(): StreamStatus {
  return useSyncExternalStore(
    (onStoreChange) => {
      stream.ensureStarted();
      return stream.subscribeStatus(() => onStoreChange());
    },
    () => stream.getStatus(),
    () => stream.getStatus()
  );
}

/** Subscribes to every SSE event for the lifetime of the component. */
export function useLennoxEvent(onEvent: Listener): void {
  useEffect(() => {
    stream.ensureStarted();
    return stream.subscribeEvents(onEvent);
  }, [onEvent]);
}
