import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dueAgain, usuals, type Purchase } from '../usuals.ts';

const now = new Date('2026-03-01T12:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();
const buy = (product_id: string, ago: number, quantity: number | null = 1, unit: string | null = null): Purchase =>
  ({ product_id, quantity, unit, bought_at: daysAgo(ago) });

test('after one shop, usuals are that shop', () => {
  const u = usuals([buy('milk', 2), buy('eggs', 2)], now);
  assert.deepEqual(u.map((x) => x.product_id).sort(), ['eggs', 'milk']);
  assert.ok(u.every((x) => x.frequency === null && !x.due));
});

test('the most bought rise to the top, one-offs fade out', () => {
  const u = usuals([
    buy('milk', 1), buy('milk', 8), buy('milk', 15), buy('milk', 22),
    buy('candles', 70), buy('candles', 75), // two old buys: gone
    buy('cake', 40), // one buy over a month ago: gone
    buy('bread', 1), buy('bread', 30),
    buy('jam', 1),
  ], now);
  assert.deepEqual(u.map((x) => x.product_id), ['milk', 'bread', 'jam']);
});

test('the same day counts once; the last purchase sets the amount', () => {
  const [u] = usuals([buy('milk', 20, 1, 'l'), buy('milk', 20, 1, 'l'), buy('milk', 6, 2, 'l')], now);
  assert.deepEqual([u.times, u.gap_days, u.frequency, u.quantity, u.unit, u.days_since], [2, 14, 'biweekly', 2, 'l', 6]);
});

test('due again: past the usual gap and not on the list, most overdue first', () => {
  const u = usuals([
    buy('milk', 8), buy('milk', 15), buy('milk', 22), // weekly, 8 days ago: due
    buy('rice', 35), buy('rice', 65), // monthly, 35 days ago: due
    buy('eggs', 3), buy('eggs', 10), // weekly, 3 days ago: not due
    buy('soap', 8), buy('soap', 15),
  ], now);
  assert.deepEqual(dueAgain(u, new Set(['soap'])).map((x) => [x.product_id, x.frequency]),
    [['rice', 'monthly'], ['milk', 'weekly']]);
});
