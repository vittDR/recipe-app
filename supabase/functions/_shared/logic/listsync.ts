// Changes to the grocery list made on the phone, waiting to reach the server.
// The list on screen is the server's rows with these applied on top, so every
// tap shows at once; the app sends them in order and retries
// (web/src/lib/listQueue.ts). Ids are made on the phone, so a change sent twice
// lands once.

import type { Aisle } from './ingredients.ts';

/** Fields of a list item the phone changes after adding it. */
export interface ItemPatch {
  quantity?: number | null;
  unit?: string | null;
  checked_at?: string | null;
  checked_by?: string | null;
  cleared_at?: string | null;
}

export type ListOp =
  /** A new household catalogue item (New catalog item sheet). */
  | { kind: 'product'; id: string; name: string; aisle: Aisle; unit: string | null; store_id: string | null }
  | {
    kind: 'add';
    id: string;
    product_id: string | null;
    /** Product name, used by the server when the product isn't there. */
    name: string;
    quantity: number | null;
    unit: string | null;
    aisle: Aisle;
    store_id: string | null;
    added_by: string;
    at: string;
  }
  | { kind: 'patch'; id: string; fields: ItemPatch }
  | { kind: 'remove'; id: string };

export interface QueuedOp {
  seq: number;
  op: ListOp;
  /** Being sent right now: not merged into any more. */
  sending?: boolean;
}

const QTY_FIELDS: (keyof ItemPatch)[] = ['quantity', 'unit'];

/**
 * Adds a change to the queue, folding it into what's still waiting for the
 * same item: edits merge, and removing an item that never reached the server
 * drops it altogether.
 */
export function enqueue(queue: QueuedOp[], op: ListOp, seq: number): QueuedOp[] {
  const waiting = queue.filter((q) => !q.sending && q.op.id === op.id);
  const last = waiting[waiting.length - 1];

  if (op.kind === 'patch' && last) {
    if (last.op.kind === 'patch') {
      const merged: QueuedOp = { ...last, op: { ...last.op, fields: { ...last.op.fields, ...op.fields } } };
      return queue.map((q) => (q === last ? merged : q));
    }
    const onlyQty = Object.keys(op.fields).every((k) => QTY_FIELDS.includes(k as keyof ItemPatch));
    if (last.op.kind === 'add' && onlyQty) {
      const merged: QueuedOp = { ...last, op: { ...last.op, ...op.fields } as ListOp };
      return queue.map((q) => (q === last ? merged : q));
    }
  }

  if (op.kind === 'remove') {
    const neverSent = waiting.some((q) => q.op.kind === 'add');
    const rest = queue.filter((q) => !waiting.includes(q));
    return neverSent ? rest : [...rest, { seq, op }];
  }

  return [...queue, { seq, op }];
}

/** The list row shape the overlay works on. */
export interface SyncedRow {
  id: string;
  quantity: number | null;
  unit: string | null;
  checked_at: string | null;
  checked_by: string | null;
  cleared_at: string | null;
}

/**
 * The server's rows with the waiting changes applied, in order. `fromAdd`
 * builds a row for an item the server doesn't have yet. Rows with a change
 * still waiting are listed in `pending`.
 */
export function applyQueue<T extends SyncedRow>(
  rows: T[],
  ops: ListOp[],
  fromAdd: (op: Extract<ListOp, { kind: 'add' }>) => T,
): { rows: T[]; pending: Set<string> } {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const order = rows.map((r) => r.id);
  const pending = new Set<string>();
  for (const op of ops) {
    if (op.kind === 'product') continue;
    pending.add(op.id);
    const row = byId.get(op.id);
    if (op.kind === 'add') {
      if (!row) {
        byId.set(op.id, fromAdd(op));
        order.push(op.id);
      }
    } else if (op.kind === 'patch') {
      if (row) byId.set(op.id, { ...row, ...op.fields });
    } else {
      byId.delete(op.id);
    }
  }
  return {
    rows: order.filter((id) => byId.has(id) && !byId.get(id)!.cleared_at).map((id) => byId.get(id)!),
    pending,
  };
}

/** Waits before retry 1, 2 and 3, then the last try. */
export const RETRY_DELAYS_MS = [1_000, 3_000, 10_000, 10 * 60_000];

/**
 * Milliseconds to wait before the next try after `failures` failed tries, or
 * null when it's time to give up and ask the person.
 */
export function retryDelay(failures: number): number | null {
  return failures >= 1 && failures <= RETRY_DELAYS_MS.length ? RETRY_DELAYS_MS[failures - 1] : null;
}

/** After this many failed tries the change is shown as not saved (the 10-minute try still comes). */
export const SHOW_ERROR_AFTER = 4;
