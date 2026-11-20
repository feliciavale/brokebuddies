/**
 * Pure split logic. All amounts are whole Rupiah (integers).
 * No floats are ever stored: every split goes through `allocate`,
 * which guarantees the parts add up exactly to the total.
 */

export type SplitType = "EQUAL" | "EXACT" | "PERCENT" | "SHARES" | "ITEMIZED";

/**
 * Split `total` into integer parts proportional to `weights`
 * (largest-remainder method). Parts always sum to `total`.
 * Works for negative totals (e.g. a discount) too.
 */
export function allocate(total: number, weights: number[]): number[] {
  if (!Number.isInteger(total)) throw new Error("total must be an integer");
  if (weights.length === 0) return [];
  if (total < 0) return allocate(-total, weights).map((n) => (n === 0 ? 0 : -n));
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    // nobody has any weight: split evenly
    return allocate(total, weights.map(() => 1));
  }
  const raw = weights.map((w) => (total * w) / sum);
  const parts = raw.map(Math.floor);
  let leftover = total - parts.reduce((a, b) => a + b, 0);
  // hand out leftover rupiah to the biggest fractional remainders first
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; leftover > 0; k = (k + 1) % order.length) {
    parts[order[k].i] += 1;
    leftover -= 1;
  }
  return parts;
}

export interface ItemInput {
  name: string;
  quantity: number;
  /** line total (unit price x quantity) */
  price: number;
  /** member ids who shared this item; split evenly between them */
  assignees: string[];
}

export interface ItemizedInput {
  items: ItemInput[];
  tax: number;
  service: number;
  discount: number;
}

export interface ItemizedResult {
  subtotal: number;
  total: number;
  /** memberId -> breakdown */
  perMember: Record<
    string,
    { items: { name: string; amount: number }[]; subtotal: number; extras: number; total: number }
  >;
}

/**
 * Receipt split: each item is split evenly between the people who ate it,
 * then tax + service - discount is spread in proportion to each
 * person's subtotal (how PB1 / service charge is normally shared).
 */
export function splitItemized(input: ItemizedInput): ItemizedResult {
  const perMember: ItemizedResult["perMember"] = {};
  const ensure = (id: string) =>
    (perMember[id] ??= { items: [], subtotal: 0, extras: 0, total: 0 });

  let subtotal = 0;
  for (const item of input.items) {
    if (item.assignees.length === 0) {
      throw new Error(`"${item.name}" has nobody assigned`);
    }
    subtotal += item.price;
    const parts = allocate(item.price, item.assignees.map(() => 1));
    item.assignees.forEach((id, i) => {
      const m = ensure(id);
      m.items.push({
        name: item.assignees.length > 1 ? `${item.name} (1/${item.assignees.length})` : item.name,
        amount: parts[i],
      });
      m.subtotal += parts[i];
    });
  }

  const ids = Object.keys(perMember);
  const extras = input.tax + input.service - input.discount;
  const extraParts = allocate(extras, ids.map((id) => perMember[id].subtotal));
  ids.forEach((id, i) => {
    perMember[id].extras = extraParts[i];
    perMember[id].total = perMember[id].subtotal + extraParts[i];
  });

  return { subtotal, total: subtotal + extras, perMember };
}

export interface SimpleSplitInput {
  type: Exclude<SplitType, "ITEMIZED">;
  total: number;
  /** memberId -> raw input (ignored for EQUAL; rupiah for EXACT; percent for PERCENT; shares for SHARES) */
  participants: { memberId: string; value?: number }[];
}

export function splitSimple(input: SimpleSplitInput): Record<string, number> {
  const { type, total, participants } = input;
  if (participants.length === 0) throw new Error("Pick at least one person");
  const ids = participants.map((p) => p.memberId);
  const values = participants.map((p) => p.value ?? 0);
  let parts: number[];

  switch (type) {
    case "EQUAL":
      parts = allocate(total, ids.map(() => 1));
      break;
    case "EXACT": {
      const sum = values.reduce((a, b) => a + b, 0);
      if (sum !== total) {
        throw new Error(`Amounts add up to ${sum}, but the total is ${total}`);
      }
      parts = values;
      break;
    }
    case "PERCENT": {
      const sum = values.reduce((a, b) => a + b, 0);
      if (sum !== 100) throw new Error(`Percentages add up to ${sum}%, not 100%`);
      parts = allocate(total, values);
      break;
    }
    case "SHARES": {
      if (values.some((v) => v < 0) || values.reduce((a, b) => a + b, 0) === 0) {
        throw new Error("Give at least one person a share");
      }
      parts = allocate(total, values);
      break;
    }
  }
  return Object.fromEntries(ids.map((id, i) => [id, parts[i]]));
}

/** Net balance per member: positive = is owed money, negative = owes. */
export function netBalances(
  memberIds: string[],
  expenses: { paidById: string; total: number; shares: { memberId: string; amount: number }[] }[],
  settlements: { fromId: string; toId: string; amount: number }[],
): Record<string, number> {
  const bal: Record<string, number> = Object.fromEntries(memberIds.map((id) => [id, 0]));
  for (const e of expenses) {
    bal[e.paidById] = (bal[e.paidById] ?? 0) + e.total;
    for (const s of e.shares) bal[s.memberId] = (bal[s.memberId] ?? 0) - s.amount;
  }
  for (const s of settlements) {
    bal[s.fromId] = (bal[s.fromId] ?? 0) + s.amount;
    bal[s.toId] = (bal[s.toId] ?? 0) - s.amount;
  }
  return bal;
}

/** Fewest-ish transfers to settle everyone (greedy: biggest debtor pays biggest creditor). */
export function suggestTransfers(balances: Record<string, number>) {
  const debtors = Object.entries(balances)
    .filter(([, v]) => v < 0)
    .map(([id, v]) => ({ id, amt: -v }))
    .sort((a, b) => b.amt - a.amt);
  const creditors = Object.entries(balances)
    .filter(([, v]) => v > 0)
    .map(([id, v]) => ({ id, amt: v }))
    .sort((a, b) => b.amt - a.amt);

  const transfers: { fromId: string; toId: string; amount: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amt, creditors[j].amt);
    if (amount > 0) transfers.push({ fromId: debtors[i].id, toId: creditors[j].id, amount });
    debtors[i].amt -= amount;
    creditors[j].amt -= amount;
    if (debtors[i].amt === 0) i++;
    if (creditors[j].amt === 0) j++;
  }
  return transfers;
}
