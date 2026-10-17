import { Prisma } from "@prisma/client";

/**
 * Money is handled in integer cents here so splits and balances
 * always add up exactly.
 */
export function toCents(value: Prisma.Decimal | number): number {
  return new Prisma.Decimal(value).mul(100).toNumber();
}

export function fromCents(cents: number): number {
  return new Prisma.Decimal(cents).div(100).toNumber();
}

/**
 * Split an amount equally. Leftover cents go one each to the first users
 * (ordered by id, so the result is stable).
 *
 * @example splitEqually(10000, ["a", "b", "c"]) // 3334, 3333, 3333
 */
export function splitEqually(
  amountCents: number,
  userIds: string[]
): { userId: string; cents: number }[] {
  const ids = [...new Set(userIds)].sort();
  const base = Math.floor(amountCents / ids.length);
  const remainder = amountCents - base * ids.length;

  return ids.map((userId, index) => ({
    userId,
    cents: base + (index < remainder ? 1 : 0)
  }));
}

/**
 * Turn net balances (paid - owed, in cents) into a short list of transfers
 * from debtors to creditors. Greedy: the largest debtor pays the largest
 * creditor first, which needs at most (participants - 1) transfers.
 */
export function settleBalances(
  balances: Map<string, number>
): { from: string; to: string; cents: number }[] {
  const byAmount = (a: [string, number], b: [string, number]) =>
    Math.abs(b[1]) - Math.abs(a[1]) || a[0].localeCompare(b[0]);

  const creditors = [...balances].filter(([, net]) => net > 0).sort(byAmount);
  const debtors = [...balances].filter(([, net]) => net < 0).sort(byAmount);

  const transfers: { from: string; to: string; cents: number }[] = [];
  let c = 0;
  let d = 0;

  while (c < creditors.length && d < debtors.length) {
    const [creditor, credit] = creditors[c];
    const [debtor, debt] = debtors[d];
    const cents = Math.min(credit, -debt);

    transfers.push({ from: debtor, to: creditor, cents });

    creditors[c] = [creditor, credit - cents];
    debtors[d] = [debtor, debt + cents];

    if (creditors[c][1] === 0) c++;
    if (debtors[d][1] === 0) d++;
  }

  return transfers;
}
