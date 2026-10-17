import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ConfigService } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { UsersModule } from "./users/users.module";
import { AuthModule } from "./auth/auth.module";
import { CommonModule } from "./common/common.module";
import { TripsModule } from "./trips/trips.module";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [
    /**
     * Global rate limit per client IP: 100 requests per minute.
     * Sensitive routes (e.g. login) set a stricter limit with @Throttle.
     * Off in tests, which sign in far more often than any real client.
     */
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [{ ttl: 60_000, limit: 100 }],
        skipIf: () => config.get<string>("NODE_ENV") === "test"
      })
    }),
    // runs @Cron jobs (token and invite cleanup)
    ScheduleModule.forRoot(),
    // in-process domain events (trip activity feed)
    EventEmitterModule.forRoot(),
    UsersModule,
    AuthModule,
    CommonModule,
    TripsModule,
    HealthModule
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }]
})
export class AppModule {}
