import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { ExpensesService } from "./expenses.service";
import { ExpensesRepository } from "./expenses.repository";
import { MembersRepository } from "../members/members.repository";
import { TripAccessService } from "../trip-access.service";
import { CreateExpenseSchema } from "./expenses.validation";

const mockTripAccess = { getTrip: jest.fn() };

const mockExpensesRepository = {
  create: jest.fn(),
  findByIdAndTrip: jest.fn(),
  findManyByTrip: jest.fn(),
  summarize: jest.fn(),
  findUsers: jest.fn(),
  findForSettlement: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
};

const mockMembersRepository = { findParticipantIds: jest.fn() };

// trip members besides the owner
const MEMBER = "f7b3c1a2-0000-4000-8000-000000000001";
const OUTSIDER = "f7b3c1a2-0000-4000-8000-000000000009";

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

const D = (value: string | number) => new Prisma.Decimal(value);

const trip = {
  id: "t1",
  userId: "owner",
  currency: "IDR",
  budgetAmount: D("1000000.00")
};

const expense = {
  id: "e1",
  tripId: "t1",
  category: "FOOD",
  title: "Dinner",
  amount: D("150000.50"),
  spentDate: new Date("2026-11-30T00:00:00.000Z"),
  paidByUserId: "owner",
  paidBy: { id: "owner", username: "john", name: null },
  shares: [
    {
      expenseId: "e1",
      userId: "owner",
      amount: D("150000.50"),
      user: { id: "owner", username: "john", name: null }
    }
  ],
  notes: null,
  createdAt: new Date("2026-10-01T00:00:00.000Z"),
  updatedAt: new Date("2026-10-01T00:00:00.000Z")
};

describe("ExpensesService", () => {
  let service: ExpensesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: TripAccessService, useValue: mockTripAccess },
        { provide: ExpensesRepository, useValue: mockExpensesRepository },
        { provide: MembersRepository, useValue: mockMembersRepository },
        { provide: WINSTON_MODULE_PROVIDER, useValue: mockLogger }
      ]
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
    mockTripAccess.getTrip.mockResolvedValue({ trip, role: "OWNER" });
    mockMembersRepository.findParticipantIds.mockResolvedValue([
      "owner",
      MEMBER
    ]);
  });

  describe("create", () => {
    it("should default payer to the user recording it", async () => {
      mockExpensesRepository.create.mockResolvedValue(expense);

      const result = await service.create("owner", "t1", {
        category: "FOOD",
        title: "Dinner",
        amount: 150000.5,
        spentDate: "2026-11-30"
      });

      expect(mockTripAccess.getTrip).toHaveBeenCalledWith(
        "owner",
        "t1",
        "EDITOR"
      );
      // split equally between owner and member by default
      expect(mockExpensesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ paidByUserId: "owner", amount: 150000.5 }),
        [
          { userId: MEMBER, amount: 75000.25 },
          { userId: "owner", amount: 75000.25 }
        ]
      );
      expect(result).toMatchObject({
        amount: 150000.5,
        spentDate: "2026-11-30",
        paidBy: { userId: "owner", username: "john" },
        splits: [{ user: { userId: "owner" }, amount: 150000.5 }]
      });
    });

    it("should split among chosen members with leftover cents", async () => {
      mockExpensesRepository.create.mockResolvedValue(expense);

      await service.create("owner", "t1", {
        category: "FOOD",
        title: "Snacks",
        amount: 0.05,
        paidByUserId: MEMBER,
        splitAmong: [MEMBER, "owner"]
      });

      const [[, shares]] = mockExpensesRepository.create.mock.calls as [
        [unknown, { userId: string; amount: number }[]]
      ];
      expect(shares).toEqual([
        { userId: MEMBER, amount: 0.03 },
        { userId: "owner", amount: 0.02 }
      ]);
    });

    it.each([
      ["payer", { paidByUserId: OUTSIDER }],
      ["split member", { splitAmong: ["owner", OUTSIDER] }]
    ])("should reject %s outside the trip", async (_, extra) => {
      await expect(
        service.create("owner", "t1", {
          category: "FOOD",
          title: "Dinner",
          amount: 10,
          ...extra
        })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockExpensesRepository.create).not.toHaveBeenCalled();
    });

    it("should not record expense when user is only a viewer", async () => {
      mockTripAccess.getTrip.mockRejectedValue(new ForbiddenException());

      await expect(
        service.create("u2", "t1", {
          category: "FOOD",
          title: "x",
          amount: 1
        })
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe("update", () => {
    it("should re-split among the same members when amount changes", async () => {
      mockExpensesRepository.findByIdAndTrip.mockResolvedValue(expense);
      mockExpensesRepository.update.mockResolvedValue(expense);

      await service.update("owner", "t1", "e1", { amount: 99 });

      expect(mockExpensesRepository.update).toHaveBeenCalledWith(
        "e1",
        { amount: 99 },
        [{ userId: "owner", amount: 99 }]
      );
      expect(mockMembersRepository.findParticipantIds).not.toHaveBeenCalled();
    });

    it("should keep the split when only the title changes", async () => {
      mockExpensesRepository.findByIdAndTrip.mockResolvedValue(expense);
      mockExpensesRepository.update.mockResolvedValue(expense);

      await service.update("owner", "t1", "e1", { title: "Lunch" });

      expect(mockExpensesRepository.update).toHaveBeenCalledWith(
        "e1",
        { title: "Lunch" },
        undefined
      );
    });
  });

  describe("getSettlement", () => {
    it("should compute balances and transfers", async () => {
      // owner paid 90 split owner/member; member paid 10 for member only;
      // a legacy expense of 20 paid by member without shares (split by all)
      mockExpensesRepository.findForSettlement.mockResolvedValue([
        {
          amount: D("90"),
          paidByUserId: "owner",
          shares: [
            { userId: "owner", amount: D("45") },
            { userId: MEMBER, amount: D("45") }
          ]
        },
        {
          amount: D("10"),
          paidByUserId: MEMBER,
          shares: [{ userId: MEMBER, amount: D("10") }]
        },
        { amount: D("20"), paidByUserId: MEMBER, shares: [] },
        { amount: D("5"), paidByUserId: null, shares: [] }
      ]);
      mockExpensesRepository.findUsers.mockResolvedValue([
        { id: "owner", username: "john", name: null },
        { id: MEMBER, username: "jane", name: null }
      ]);

      const result = await service.getSettlement("owner", "t1");

      // owner: paid 90, share 45 + 10 = 55 -> +35
      // member: paid 30, share 45 + 10 + 10 = 65 -> -35
      expect(result.balances).toEqual([
        {
          user: { userId: "owner", username: "john", name: null },
          paid: 90,
          share: 55,
          net: 35
        },
        {
          user: { userId: MEMBER, username: "jane", name: null },
          paid: 30,
          share: 65,
          net: -35
        }
      ]);
      expect(result.transfers).toEqual([
        {
          from: { userId: MEMBER, username: "jane", name: null },
          to: { userId: "owner", username: "john", name: null },
          amount: 35
        }
      ]);
      expect(result.unassignedTotal).toBe(5);
    });
  });

  it("should throw NotFoundException for expense of another trip", async () => {
    mockExpensesRepository.findByIdAndTrip.mockResolvedValue(null);

    await expect(
      service.update("owner", "t1", "e9", { amount: 5 })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  describe("getBudgetSummary", () => {
    beforeEach(() => {
      mockExpensesRepository.summarize.mockResolvedValue({
        byCategory: [
          {
            category: "FOOD",
            _sum: { amount: D("0.10") },
            _count: { _all: 1 }
          },
          {
            category: "TRANSPORT",
            _sum: { amount: D("0.20") },
            _count: { _all: 2 }
          }
        ],
        byPayer: [
          { paidByUserId: "owner", _sum: { amount: D("0.10") } },
          { paidByUserId: null, _sum: { amount: D("0.20") } }
        ]
      });
      mockExpensesRepository.findUsers.mockResolvedValue([
        { id: "owner", username: "john", name: null }
      ]);
    });

    it("should sum exactly in decimal and compute remaining", async () => {
      const result = await service.getBudgetSummary("u2", "t1");

      expect(mockTripAccess.getTrip).toHaveBeenCalledWith("u2", "t1");
      // 0.1 + 0.2 in floating point would be 0.30000000000000004
      expect(result.totalSpent).toBe(0.3);
      expect(result.remaining).toBe(999999.7);
      expect(result.byCategory).toEqual([
        { category: "FOOD", total: 0.1, count: 1 },
        { category: "TRANSPORT", total: 0.2, count: 2 }
      ]);
      expect(result.byPayer).toEqual([
        { paidBy: null, total: 0.2 },
        {
          paidBy: { userId: "owner", username: "john", name: null },
          total: 0.1
        }
      ]);
    });

    it("should report null remaining without budget", async () => {
      mockTripAccess.getTrip.mockResolvedValue({
        trip: { ...trip, budgetAmount: null },
        role: "VIEWER"
      });

      const result = await service.getBudgetSummary("u2", "t1");

      expect(result.budgetAmount).toBeNull();
      expect(result.remaining).toBeNull();
    });
  });
});

describe("CreateExpenseSchema", () => {
  const valid = { category: "FOOD", title: "Dinner", amount: 150000.5 };

  it("should accept a valid expense", () => {
    expect(CreateExpenseSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    { ...valid, amount: 0 },
    { ...valid, amount: -1 },
    { ...valid, amount: 1.234 },
    { ...valid, amount: "100" },
    { ...valid, amount: 1e13 },
    { ...valid, category: "GIFT" },
    { ...valid, paidByUserId: "not-a-uuid" }
  ])("should reject %j", (input) => {
    expect(CreateExpenseSchema.safeParse(input).success).toBe(false);
  });
});
