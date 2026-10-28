// The grocery list's write queue: every change shows at once and is saved in
// the background, in order. Kept in storage so it survives the app closing.
// A failed save is retried after 1 s, 3 s and 10 s (time offline doesn't
// count), then shown as not saved, then tried once more after 10 minutes;
// after that it waits for the person to tap retry. Coming back online or to
// the foreground tries again straight away.

import { useSyncExternalStore } from 'react';
import { enqueue, retryDelay, SHOW_ERROR_AFTER, type ListOp, type QueuedOp } from '@logic/listsync.ts';
import { supabase } from './supabase.ts';

export type SyncStatus = 'idle' | 'syncing' | 'error';

export interface QueueSnapshot {
  /** Waiting to be saved, oldest first. */
  ops: ListOp[];
  /** Saved recently, with when: shown until a list load that started after them lands. */
  recent: { op: ListOp; at: number }[];
  status: SyncStatus;
}

const STORAGE_PREFIX = 'dineamite.listQueue.v1:';
const RECENT_MS = 30_000;

async function send(op: ListOp): Promise<void> {
  let error: { message: string } | null = null;
  if (op.kind === 'product') {
    ({ error } = await supabase.rpc('create_household_product', {
      p_id: op.id, p_name: op.name, p_aisle: op.aisle, p_unit: op.unit, p_store: op.store_id,
    }));
  } else if (op.kind === 'add') {
    ({ error } = await supabase.rpc('put_grocery_item', {
      p_id: op.id,
      p_item: { product_id: op.product_id, name: op.name, quantity: op.quantity, unit: op.unit, aisle: op.aisle },
    }));
  } else if (op.kind === 'patch') {
    ({ error } = await supabase.from('grocery_items').update(op.fields).eq('id', op.id));
  } else {
    ({ error } = await supabase.from('grocery_items').delete().eq('id', op.id));
  }
  if (error) throw new Error(error.message);
}

class ListQueue {
  private queue: QueuedOp[];
  private recent: QueueSnapshot['recent'] = [];
  private failures = 0;
  private seq = 0;
  private running = false;
  private timer: number | undefined;
  private listeners = new Set<() => void>();
  private snapshot: QueueSnapshot;
  private key: string;

  constructor(key: string) {
    this.key = key;
    this.queue = this.read();
    this.seq = Math.max(0, ...this.queue.map((q) => q.seq)) + 1;
    this.snapshot = this.build();
    window.addEventListener('online', () => this.kick());
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && this.kick());
    this.kick();
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = () => this.snapshot;

  push(op: ListOp) {
    this.queue = enqueue(this.queue, op, this.seq++);
    this.changed();
    this.kick();
  }

  /** Takes back a change that hasn't been sent yet. True when there was one. */
  cancel(match: (op: ListOp) => boolean): boolean {
    const before = this.queue.length;
    this.queue = this.queue.filter((q) => q.sending || !match(q.op));
    if (this.queue.length === before) return false;
    this.changed();
    return true;
  }

  /** "Try again": a fresh round of retries, now. */
  retry() {
    this.failures = 0;
    this.changed();
    this.kick();
  }

  private kick() {
    window.clearTimeout(this.timer);
    this.timer = undefined;
    void this.run();
  }

  private async run() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length) {
        if (!navigator.onLine) return; // the 'online' event picks it up
        const head = { ...this.queue[0], sending: true };
        this.queue = [head, ...this.queue.slice(1)];
        this.persist();
        try {
          await send(head.op);
        } catch {
          this.queue = this.queue.map((q) => (q.seq === head.seq ? { ...q, sending: false } : q));
          if (navigator.onLine) this.failures += 1;
          this.changed();
          const delay = navigator.onLine ? retryDelay(this.failures) : null;
          if (delay !== null) this.timer = window.setTimeout(() => this.kick(), delay);
          return;
        }
        this.queue = this.queue.filter((q) => q.seq !== head.seq);
        this.recent = [...this.recent.filter((r) => Date.now() - r.at < RECENT_MS), { op: head.op, at: Date.now() }];
        this.failures = 0;
        this.changed();
      }
    } finally {
      this.running = false;
    }
  }

  private build(): QueueSnapshot {
    return {
      ops: this.queue.map((q) => q.op),
      recent: this.recent,
      status: this.queue.length === 0 ? 'idle' : this.failures >= SHOW_ERROR_AFTER ? 'error' : 'syncing',
    };
  }

  private changed() {
    this.persist();
    this.snapshot = this.build();
    for (const fn of this.listeners) fn();
  }

  private read(): QueuedOp[] {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? (JSON.parse(raw) as QueuedOp[]).map((q) => ({ ...q, sending: false })) : [];
    } catch {
      return [];
    }
  }

  private persist() {
    try {
      if (this.queue.length) localStorage.setItem(this.key, JSON.stringify(this.queue));
      else localStorage.removeItem(this.key);
    } catch {
      // storage full or unavailable: the queue still runs in memory
    }
  }
}

const queues = new Map<string, ListQueue>();

/** The household's queue (one per household, shared by every screen). */
export function listQueue(householdId: string): ListQueue {
  let q = queues.get(householdId);
  if (!q) {
    q = new ListQueue(STORAGE_PREFIX + householdId);
    queues.set(householdId, q);
  }
  return q;
}

export function useListQueue(householdId: string): QueueSnapshot {
  const q = listQueue(householdId);
  return useSyncExternalStore(q.subscribe, q.getSnapshot);
}
