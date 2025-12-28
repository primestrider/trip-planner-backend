import { Global, Module } from "@nestjs/common";
import { WinstonModule } from "nest-winston";
import winston from "winston";
import { ConfigModule } from "@nestjs/config";
import { PrismaService } from "./prisma.service";
import { ValidationService } from "./validation/validation.service";

/**
 * CommonModule provides globally shared infrastructure services
 * used across the entire application.
 *
 * This module centralizes cross-cutting concerns such as:
 * - Application configuration
 * - Logging
 * - Database access
 * - Input validation utilities
 *
 * By being marked as @Global(), its providers are available
 * throughout the application without requiring explicit imports.
 */
@Global()
@Module({
  imports: [
    /**
     * Global Winston logger configuration.
     * Logs are formatted as JSON and written to stdout.
     */
    WinstonModule.forRoot({
      level: "debug",
      format: winston.format.json(),
      transports: [new winston.transports.Console()]
    }),

    /**
     * Global configuration module for loading environment variables.
     */
    ConfigModule.forRoot({
      isGlobal: true
    })
  ],

  /**
   * Infrastructure-level providers shared across all modules.
   */
  providers: [PrismaService, ValidationService],

  /**
   * Exported providers that can be injected into feature modules.
   */
  exports: [PrismaService, ValidationService]
})
export class CommonModule {}
