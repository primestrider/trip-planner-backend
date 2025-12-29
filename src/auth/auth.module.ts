import { Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { UsersModule } from "src/users/users.module";
import { AuthRepository } from "./auth.repository";
import { JwtModule } from "@nestjs/jwt";
import { JwtAccessStrategy } from "./strategies/jwt.strategy";

@Module({
  imports: [UsersModule, JwtModule.register({})],
  providers: [AuthService, AuthRepository, JwtAccessStrategy],
  controllers: [AuthController]
})
export class AuthModule {}
