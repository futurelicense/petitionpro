export type MilestoneCost = {
  estimatedCents: number | null;
  actualCents: number | null;
  paidCents: number | null;
  responsible: string;
  payee: string;
  reference: string;
  paymentDate: string;
  notes: string;
  updatedAt: string;
};

export type CostInput = {
  estimated: string;
  actual: string;
  paid: string;
  responsible: string;
  payee: string;
  reference: string;
  paymentDate: string;
  notes: string;
};

const MAX_CENTS = 99_999_999_999;

/** Empty means unknown; an explicit zero means no charge. */
export function moneyCents(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    throw new Error("Enter a non-negative amount with up to two decimal places.");
  }
  const [whole, fraction = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > MAX_CENTS) {
    throw new Error("The amount is too large.");
  }
  return cents;
}

export function moneyInput(cents: number | null | undefined): string {
  return cents == null ? "" : (cents / 100).toFixed(2);
}

export function usd(cents: number | null | undefined): string {
  return cents == null ? "Not entered" : new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
  }).format(cents / 100);
}

export function createCost(input: CostInput): MilestoneCost {
  const estimatedCents = moneyCents(input.estimated);
  const actualCents = moneyCents(input.actual);
  const paidCents = moneyCents(input.paid);
  if ([estimatedCents, actualCents, paidCents].every((amount) => amount === null)) {
    throw new Error("Enter an estimate, actual cost, or payment amount. Use 0 for no charge.");
  }
  if (!input.responsible.trim()) throw new Error("Name the person responsible for this cost.");
  if ((paidCents ?? 0) > 0) {
    if (!input.payee.trim()) throw new Error("Enter who was paid.");
    const date = input.paymentDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date) {
      throw new Error("Enter the date of the latest payment.");
    }
  }
  return {
    estimatedCents, actualCents, paidCents,
    responsible: input.responsible.trim(),
    payee: input.payee.trim(),
    reference: input.reference.trim(),
    paymentDate: input.paymentDate,
    notes: input.notes.trim(),
    updatedAt: new Date().toISOString(),
  };
}

export function costTotals(items: { cost?: MilestoneCost }[]) {
  const totals = { estimated: 0, actual: 0, paid: 0, outstanding: 0, advance: 0, recorded: 0, actualUnknown: 0 };
  for (const { cost } of items) {
    if (!cost) continue;
    totals.recorded++;
    totals.estimated += cost.estimatedCents ?? 0;
    totals.actual += cost.actualCents ?? 0;
    totals.paid += cost.paidCents ?? 0;
    if (cost.actualCents === null) totals.actualUnknown++;
    // A deposit is an advance until an actual cost is recorded. Credit on one
    // milestone must not hide money still owed on another milestone.
    totals.outstanding += Math.max((cost.actualCents ?? 0) - (cost.paidCents ?? 0), 0);
    totals.advance += Math.max((cost.paidCents ?? 0) - (cost.actualCents ?? 0), 0);
  }
  return totals;
}
