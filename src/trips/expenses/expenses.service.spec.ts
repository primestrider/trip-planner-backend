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
  update: jest.fn(),
  delete: jest.fn()
};

const mockMembersRepository = { findByTripAndUser: jest.fn() };

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
      expect(mockExpensesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ paidByUserId: "owner", amount: 150000.5 })
      );
      expect(result).toMatchObject({
        amount: 150000.5,
        spentDate: "2026-11-30",
        paidBy: { userId: "owner", username: "john" }
      });
    });

    it("should accept a member as payer", async () => {
      mockMembersRepository.findByTripAndUser.mockResolvedValue({ id: "m1" });
      mockExpensesRepository.create.mockResolvedValue(expense);

      await service.create("owner", "t1", {
        category: "FOOD",
        title: "Dinner",
        amount: 10,
        paidByUserId: "f7b3c1a2-0000-4000-8000-000000000001"
      });

      expect(mockMembersRepository.findByTripAndUser).toHaveBeenCalledWith(
        "t1",
        "f7b3c1a2-0000-4000-8000-000000000001"
      );
    });

    it("should reject payer outside the trip", async () => {
      mockMembersRepository.findByTripAndUser.mockResolvedValue(null);

      await expect(
        service.create("owner", "t1", {
          category: "FOOD",
          title: "Dinner",
          amount: 10,
          paidByUserId: "f7b3c1a2-0000-4000-8000-000000000009"
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
