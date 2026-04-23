// ─── Observer / Event Bus ────────────────────────────────────────────────────
// Implements the Observer pattern.
// Listeners subscribe to named events. On emit, each listener runs independently
// — a failure in one does not affect others.

type EventHandler<T = unknown> = (data: T) => Promise<void> | void;

class EventBus {
  private listeners: Map<string, EventHandler<unknown>[]> = new Map();

  on<T>(event: string, handler: EventHandler<T>): void {
    const handlers = this.listeners.get(event) || [];
    handlers.push(handler as EventHandler<unknown>);
    this.listeners.set(event, handlers);
  }

  async emit<T>(event: string, data: T): Promise<void> {
    const handlers = this.listeners.get(event) || [];
    // All handlers run independently — failure in one does not cancel others
    await Promise.allSettled(
      handlers.map(async (handler) => {
        try {
          await handler(data);
        } catch (err) {
          console.error(`[EventBus] Handler failed for event "${event}":`, err);
        }
      })
    );
  }
}

export const eventBus = new EventBus();

// ─── Domain Events ────────────────────────────────────────────────────────────

export const Events = {
  REQUEST_ACCEPTED: 'request.accepted',
  SESSION_CONFIRMED: 'session.confirmed',
  SESSION_COMPLETED: 'session.completed',
  REQUEST_DECLINED: 'request.declined',
  CONNECTION_FLAGGED: 'connection.flagged',
} as const;

export interface RequestAcceptedPayload {
  requestId: string;
  studentId: string;
  alumniId: string;
  connectionId: string;
}

export interface SessionConfirmedPayload {
  sessionId: string;
  connectionId: string;
  studentId: string;
  alumniId: string;
  slotStart: Date;
  slotEnd: Date;
}
