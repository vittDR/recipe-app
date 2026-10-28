// "Your usuals": what the household buys, from the items checked off and
// cleared on past shops. Each shop day counts for a product, halving every
// month, so the most-bought rise to the top and one-offs fade out. The last
// shop is always there, so after one trip Usuals is that list.

export interface Purchase {
  product_id: string;
  quantity: number | null;
  unit: string | null;
  /** When the cart was cleared. */
  bought_at: string;
}

export type Frequency = 'weekly' | 'biweekly' | 'monthly';

export interface Usual {
  product_id: string;
  score: number;
  last_bought: string;
  days_since: number;
  /** Separate shop days it was bought on. */
  times: number;
  /** Median days between those shops; null when bought once. */
  gap_days: number | null;
  frequency: Frequency | null;
  /** Bought at least `gap_days` ago. */
  due: boolean;
  /** The last purchase's amount, to prefill. */
  quantity: number | null;
  unit: string | null;
}

export const USUALS_HALF_LIFE_DAYS = 30;
/** Below this a product drops off: one purchase about a month old. */
export const USUALS_MIN_SCORE = 0.5;

const DAY = 86_400_000;
const dayOf = (iso: string) => Math.floor(Date.parse(iso) / DAY);

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function frequencyOf(gapDays: number): Frequency {
  return gapDays <= 10 ? 'weekly' : gapDays <= 21 ? 'biweekly' : 'monthly';
}

/** Usuals, best first. */
export function usuals(purchases: Purchase[], now: Date = new Date()): Usual[] {
  if (purchases.length === 0) return [];
  const today = Math.floor(now.getTime() / DAY);
  const lastShop = Math.max(...purchases.map((p) => dayOf(p.bought_at)));
  const byProduct = new Map<string, Purchase[]>();
  for (const p of purchases) byProduct.set(p.product_id, [...(byProduct.get(p.product_id) ?? []), p]);

  const out: Usual[] = [];
  for (const [product_id, list] of byProduct) {
    const days = [...new Set(list.map((p) => dayOf(p.bought_at)))].sort((a, b) => a - b);
    const score = days.reduce((s, d) => s + 0.5 ** (Math.max(0, today - d) / USUALS_HALF_LIFE_DAYS), 0);
    const last = days[days.length - 1];
    if (score < USUALS_MIN_SCORE && last !== lastShop) continue;
    const gaps = days.slice(1).map((d, i) => d - days[i]);
    const gap = gaps.length ? median(gaps) : null;
    const latest = list.reduce((a, b) => (Date.parse(b.bought_at) > Date.parse(a.bought_at) ? b : a));
    out.push({
      product_id,
      score,
      last_bought: latest.bought_at,
      days_since: today - last,
      times: days.length,
      gap_days: gap,
      frequency: gap === null ? null : frequencyOf(gap),
      due: gap !== null && today - last >= gap,
      quantity: latest.quantity,
      unit: latest.unit,
    });
  }
  return out.sort((a, b) => b.score - a.score || a.days_since - b.days_since);
}

/** Due again, most overdue first (days past the usual gap). */
export function dueAgain(list: Usual[], onList: Set<string>): Usual[] {
  return list
    .filter((u) => u.due && !onList.has(u.product_id))
    .sort((a, b) => (b.days_since - (b.gap_days ?? 0)) - (a.days_since - (a.gap_days ?? 0)));
}
