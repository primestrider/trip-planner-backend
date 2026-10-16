import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { UsersModule } from "./users/users.module";
import { AuthModule } from "./auth/auth.module";
import { CommonModule } from "./common/common.module";
import { TripsModule } from "./trips/trips.module";

@Module({
  imports: [UsersModule, AuthModule, CommonModule, TripsModule],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
