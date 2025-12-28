import { Logger } from "winston";
import { Inject, Injectable } from "@nestjs/common";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";

/**
 * PrismaService is a centralized Prisma client wrapper used across the application.
 *
 * It extends the generated PrismaClient and configures:
 * - MariaDB adapter connection
 * - Database credentials from environment variables
 * - Prisma query and error logging integration with Winston
 *
 * This service is designed to be a singleton and injected wherever
 * database access is required.
 */
@Injectable()
export class PrismaService extends PrismaClient {
  /**
   * Creates a new PrismaService instance.
   *
   * Database connection configuration is resolved from ConfigService
   * and passed to the Prisma MariaDB adapter. Prisma log events are
   * configured to be emitted and can be forwarded to the application
   * logger if needed.
   *
   * @param configService - Provides database configuration values
   * @param logger - Winston logger used for Prisma log integration
   */
  constructor(
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
  ) {
    const host = configService.get<string>("DATABASE_HOST");
    const user = configService.get<string>("DATABASE_USER");
    const password = configService.get<string>("DATABASE_PASSWORD");
    const database = configService.get<string>("DATABASE_NAME");

    const adapter = new PrismaMariaDb({
      host: host!,
      user: user!,
      password: password!,
      database: database!,
      connectionLimit: 5
    });

    super({
      log: [
        { emit: "event", level: "info" },
        { emit: "event", level: "warn" },
        { emit: "event", level: "error" },
        { emit: "event", level: "query" }
      ],
      adapter
    });
  }

  /**
   * Optional lifecycle hook for forwarding Prisma log events
   * to the application logger.
   *
   * This can be enabled if detailed query or error logging
   * is required for debugging or monitoring purposes.
   */
  // onModuleInit() {
  //   this.$on("info", (e) => this.logger.info(e));
  //   this.$on("warn", (e) => this.logger.warn(e));
  //   this.$on("error", (e) => this.logger.error(e));
  //   this.$on("query", (e) => this.logger.info(e));
  // }
}
