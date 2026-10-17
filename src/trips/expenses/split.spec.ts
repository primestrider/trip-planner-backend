import { Prisma } from "@prisma/client";
import { fromCents, settleBalances, splitEqually, toCents } from "./split";

describe("split helpers", () => {
  it("should convert between decimals and cents exactly", () => {
    expect(toCents(new Prisma.Decimal("150000.55"))).toBe(15000055);
    expect(toCents(0.1)).toBe(10);
    expect(fromCents(15000055)).toBe(150000.55);
  });

  describe("splitEqually", () => {
    it("should give leftover cents to the first users", () => {
      expect(splitEqually(10000, ["c", "a", "b"])).toEqual([
        { userId: "a", cents: 3334 },
        { userId: "b", cents: 3333 },
        { userId: "c", cents: 3333 }
      ]);
    });

    it("should always add up to the amount", () => {
      for (const [amount, users] of [
        [1, 3],
        [99999, 7],
        [12345678, 11]
      ]) {
        const ids = Array.from({ length: users }, (_, i) => `u${i}`);
        const total = splitEqually(amount, ids).reduce(
          (sum, share) => sum + share.cents,
          0
        );
        expect(total).toBe(amount);
      }
    });
  });

  describe("settleBalances", () => {
    it("should settle every balance with few transfers", () => {
      // A paid 90 for A, B, C (30 each); B paid 30 for B, C (15 each)
      // net: A +60, B -15, C -45
      const transfers = settleBalances(
        new Map([
          ["A", 6000],
          ["B", -1500],
          ["C", -4500]
        ])
      );

      expect(transfers).toEqual([
        { from: "C", to: "A", cents: 4500 },
        { from: "B", to: "A", cents: 1500 }
      ]);
    });

    it("should need no transfers when everyone is even", () => {
      expect(
        settleBalances(
          new Map([
            ["A", 0],
            ["B", 0]
          ])
        )
      ).toEqual([]);
    });

    it("should leave nobody owing after the transfers", () => {
      const balances = new Map([
        ["A", 1001],
        ["B", 2002],
        ["C", -500],
        ["D", -2503]
      ]);
      const after = new Map(balances);

      for (const { from, to, cents } of settleBalances(balances)) {
        after.set(from, after.get(from)! + cents);
        after.set(to, after.get(to)! - cents);
      }

      expect([...after.values()].every((net) => net === 0)).toBe(true);
    });
  });
});
