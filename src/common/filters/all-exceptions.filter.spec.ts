import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Logger } from "winston";
import { AllExceptionsFilter } from "./all-exceptions.filter";

const logger = { error: jest.fn() };

function run(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ requestId: "req-1", method: "GET", path: "/trips" }),
      getResponse: () => ({ status })
    })
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter(logger as unknown as Logger).catch(exception, host);

  const [[code]] = status.mock.calls as unknown as [[number]];
  const [[body]] = json.mock.calls as unknown as [[Record<string, unknown>]];
  return { code, body };
}

describe("AllExceptionsFilter", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should shape HTTP errors with request id and path", () => {
    const { code, body } = run(new NotFoundException("Trip not found"));

    expect(code).toBe(404);
    expect(body).toEqual({
      statusCode: 404,
      message: "Trip not found",
      error: "NOT_FOUND",
      requestId: "req-1",
      path: "/trips"
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("should keep validation field errors", () => {
    const errors = [{ field: "title", messages: ["Required"] }];
    const { body } = run(
      new BadRequestException({
        statusCode: 400,
        message: "validation_failed",
        errors
      })
    );

    expect(body).toMatchObject({
      statusCode: 400,
      message: "validation_failed",
      error: "BAD_REQUEST",
      errors
    });
  });

  it("should join array messages from built-in pipes", () => {
    const { body } = run(
      new HttpException({ message: ["a is wrong", "b is wrong"] }, 400)
    );

    expect(body.message).toBe("a is wrong, b is wrong");
  });

  it.each([
    ["P2025", 404, "NOT_FOUND"],
    ["P2002", 409, "CONFLICT"]
  ])("should map Prisma %s to %d", (prismaCode, status, error) => {
    const { code, body } = run(
      new Prisma.PrismaClientKnownRequestError("db detail", {
        code: prismaCode,
        clientVersion: "test"
      })
    );

    expect(code).toBe(status);
    expect(body.error).toBe(error);
    expect(JSON.stringify(body)).not.toContain("db detail");
  });

  it("should hide unexpected errors behind a generic 500 and log them", () => {
    const { code, body } = run(new Error("connection string leaked"));

    expect(code).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body).toMatchObject({
      message: "Internal server error",
      error: "INTERNAL_SERVER_ERROR"
    });
    expect(JSON.stringify(body)).not.toContain("leaked");
    expect(logger.error).toHaveBeenCalledWith(
      "Unhandled error",
      expect.objectContaining({ requestId: "req-1" })
    );
  });
});
