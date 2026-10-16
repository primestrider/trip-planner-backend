import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { PrismaService } from "src/common/prisma.service";
import { SkipDeviceId } from "src/common/decorator/skip-device-id.decorator";

/**
 * Liveness / readiness check for load balancers and monitoring.
 * Public: no access token, device id, or rate limit.
 */
@Controller("health")
@SkipDeviceId()
@SkipThrottle()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /health
   *
   * @throws ServiceUnavailableException (503) when the database is unreachable
   */
  @Get()
  async check(): Promise<{ status: "ok"; database: "up" }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        status: "error",
        database: "down"
      });
    }

    return { status: "ok", database: "up" };
  }
}
