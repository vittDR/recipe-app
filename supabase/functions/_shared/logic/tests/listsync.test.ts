import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyQueue, enqueue, retryDelay, SHOW_ERROR_AFTER, type ListOp, type QueuedOp, type SyncedRow } from '../listsync.ts';

const add = (id: string, quantity: number | null = 1): ListOp => ({
  kind: 'add', id, product_id: 'p', name: 'lait', quantity, unit: 'l', aisle: 'dairy_eggs', store_id: null, added_by: 'u', at: '2026-01-01T00:00:00Z',
});
const queueOf = (...ops: ListOp[]) => ops.reduce<QueuedOp[]>((q, op, i) => enqueue(q, op, i), []);

test('edits to an item still waiting merge into it', () => {
  const q = queueOf(add('a'), { kind: 'patch', id: 'a', fields: { quantity: 3 } }, { kind: 'patch', id: 'a', fields: { unit: 'bottle' } });
  assert.equal(q.length, 1);
  assert.deepEqual([q[0].op.kind, (q[0].op as { quantity: number }).quantity, (q[0].op as { unit: string }).unit], ['add', 3, 'bottle']);
  const checks = queueOf({ kind: 'patch', id: 'b', fields: { checked_at: 'x' } }, { kind: 'patch', id: 'b', fields: { checked_at: null } });
  assert.deepEqual(checks.map((x) => x.op), [{ kind: 'patch', id: 'b', fields: { checked_at: null } }]);
});

test('removing an item that never left the phone drops it', () => {
  assert.deepEqual(queueOf(add('a'), { kind: 'patch', id: 'a', fields: { checked_at: 'x' } }, { kind: 'remove', id: 'a' }), []);
  const saved = queueOf({ kind: 'patch', id: 'a', fields: { quantity: 2 } }, { kind: 'remove', id: 'a' });
  assert.deepEqual(saved.map((x) => x.op.kind), ['remove']);
});

test('nothing merges into a change being sent', () => {
  const q = enqueue([{ seq: 0, op: add('a'), sending: true }], { kind: 'patch', id: 'a', fields: { quantity: 5 } }, 1);
  assert.deepEqual(q.map((x) => x.op.kind), ['add', 'patch']);
  const r = enqueue([{ seq: 0, op: add('a'), sending: true }], { kind: 'remove', id: 'a' }, 1);
  assert.deepEqual(r.map((x) => x.op.kind), ['add', 'remove']);
});

test('the list on screen is the server plus what is waiting', () => {
  const row = (id: string, over: Partial<SyncedRow> = {}): SyncedRow =>
    ({ id, quantity: 1, unit: null, checked_at: null, checked_by: null, cleared_at: null, ...over });
  const { rows, pending } = applyQueue(
    [row('a'), row('b'), row('c')],
    [add('d', 2), { kind: 'patch', id: 'a', fields: { checked_at: 't', checked_by: 'u' } }, { kind: 'remove', id: 'b' },
      { kind: 'patch', id: 'c', fields: { cleared_at: 't' } }],
    (op) => row(op.id, { quantity: op.quantity }),
  );
  assert.deepEqual(rows.map((r) => [r.id, r.quantity, r.checked_at]), [['a', 1, 't'], ['d', 2, null]]);
  assert.deepEqual([...pending].sort(), ['a', 'b', 'c', 'd']);
});

test('retries after 1 s, 3 s, 10 s, then 10 minutes, then the person decides', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(retryDelay), [1_000, 3_000, 10_000, 600_000, null]);
  assert.equal(SHOW_ERROR_AFTER, 4);
});
