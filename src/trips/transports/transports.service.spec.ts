import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { TransportsService } from "./transports.service";
import { TransportsRepository } from "./transports.repository";
import { TripAccessService } from "../trip-access.service";
import { toLocationColumns } from "../location";
import { CreateTransportSchema } from "./transports.validation";

const mockTripAccess = { getTrip: jest.fn() };

const mockRepository = {
  create: jest.fn(),
  findByIdAndTrip: jest.fn(),
  findManyByTrip: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
};

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

const trip = { id: "t1", userId: "owner" };

const transport = {
  id: "x1",
  tripId: "t1",
  type: "FLIGHT",
  carrier: "Garuda",
  number: "GA 404",
  ...toLocationColumns({ name: "CGK" }, "origin"),
  ...toLocationColumns({ name: "DPS" }, "destination"),
  departureAt: new Date("2026-11-30T09:00:00.000Z"),
  arrivalAt: new Date("2026-11-30T12:00:00.000Z"),
  bookingCode: null,
  notes: null,
  createdAt: new Date("2026-10-01T00:00:00.000Z"),
  updatedAt: new Date("2026-10-01T00:00:00.000Z")
};

const validInput = {
  type: "FLIGHT" as const,
  origin: { name: "CGK" },
  destination: { name: "DPS" },
  departureAt: "2026-11-30T09:00"
};

describe("TransportsService", () => {
  let service: TransportsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransportsService,
        { provide: TripAccessService, useValue: mockTripAccess },
        { provide: TransportsRepository, useValue: mockRepository },
        { provide: WINSTON_MODULE_PROVIDER, useValue: mockLogger }
      ]
    }).compile();

    service = module.get<TransportsService>(TransportsService);
    mockTripAccess.getTrip.mockResolvedValue({ trip, role: "OWNER" });
  });

  it("should return local times and both locations", async () => {
    mockRepository.findManyByTrip.mockResolvedValue([transport]);

    const [result] = await service.list("u1", "t1");

    expect(result).toMatchObject({
      type: "FLIGHT",
      departureAt: "2026-11-30T09:00",
      arrivalAt: "2026-11-30T12:00",
      origin: { name: "CGK" },
      destination: { name: "DPS" }
    });
  });

  it("should store origin and destination in their own columns", async () => {
    mockRepository.create.mockResolvedValue(transport);

    await service.create("u1", "t1", validInput);

    expect(mockTripAccess.getTrip).toHaveBeenCalledWith("u1", "t1", "EDITOR");
    expect(mockRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        originName: "CGK",
        destinationName: "DPS",
        departureAt: transport.departureAt,
        arrivalAt: null
      })
    );
  });

  it("should allow clearing arrival time", async () => {
    mockRepository.findByIdAndTrip.mockResolvedValue(transport);
    mockRepository.update.mockResolvedValue({ ...transport, arrivalAt: null });

    const result = await service.update("u1", "t1", "x1", { arrivalAt: null });

    expect(mockRepository.update).toHaveBeenCalledWith("x1", {
      arrivalAt: null
    });
    expect(result.arrivalAt).toBeNull();
  });

  it("should not change transport when user is only a viewer", async () => {
    mockTripAccess.getTrip.mockRejectedValue(new ForbiddenException());

    await expect(service.remove("u2", "t1", "x1")).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(mockRepository.delete).not.toHaveBeenCalled();
  });

  it("should throw NotFoundException for transport of another trip", async () => {
    mockRepository.findByIdAndTrip.mockResolvedValue(null);

    await expect(service.findOne("u1", "t1", "x9")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});

describe("CreateTransportSchema", () => {
  it("should accept arrival earlier in local time (time zones)", () => {
    expect(
      CreateTransportSchema.safeParse({
        ...validInput,
        departureAt: "2026-11-30T10:00",
        arrivalAt: "2026-11-30T08:00"
      }).success
    ).toBe(true);
  });

  it.each([
    { ...validInput, type: "ROCKET" },
    { ...validInput, origin: undefined },
    { ...validInput, departureAt: "2026-11-30 09:00" },
    { ...validInput, departureAt: "2026-02-30T09:00" },
    { ...validInput, departureAt: "2026-11-30T24:00" },
    { ...validInput, departureAt: "2026-11-30T09:00:00Z" }
  ])("should reject %j", (input) => {
    expect(CreateTransportSchema.safeParse(input).success).toBe(false);
  });
});
