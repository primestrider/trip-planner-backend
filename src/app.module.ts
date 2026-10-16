import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
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
     */
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    // runs @Cron jobs (token and invite cleanup)
    ScheduleModule.forRoot(),
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
