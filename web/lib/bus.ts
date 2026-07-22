import { EventEmitter } from "node:events";
import type { ReadingEvent } from "./types";

export type { ReadingEvent };

const READING_EVENT = "reading";

// Survive Next.js dev-mode module reloads by stashing the singleton on globalThis,
// same pattern as the Prisma-client trick - otherwise every hot reload creates a
// new emitter and SSE clients stop receiving events from the live poller.
const globalForBus = globalThis as unknown as { lennoxBus?: EventEmitter };

export const bus: EventEmitter = globalForBus.lennoxBus ?? new EventEmitter().setMaxListeners(0);
globalForBus.lennoxBus = bus;

export function publish(event: ReadingEvent): void {
  bus.emit(READING_EVENT, event);
}

export function subscribe(listener: (event: ReadingEvent) => void): () => void {
  bus.on(READING_EVENT, listener);
  return () => bus.off(READING_EVENT, listener);
}
