import { Global, Module } from "@nestjs/common";
import { WinstonModule } from "nest-winston";
import winston from "winston";
import { ConfigModule } from "@nestjs/config";
import { PrismaService } from "./prisma.service";
import { ValidationService } from "./validation.service";

@Global()
@Module({
  imports: [
    WinstonModule.forRoot({
      level: "debug",
      format: winston.format.json(),
      transports: [new winston.transports.Console()]
    }),
    ConfigModule.forRoot({
      isGlobal: true
    })
  ],
  providers: [PrismaService, ValidationService],
  exports: [PrismaService, ValidationService]
})
export class CommonModule {}
