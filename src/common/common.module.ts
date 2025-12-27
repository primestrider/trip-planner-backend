import { Global, Module } from "@nestjs/common";
import { WinstonModule } from "nest-winston";
import winston from "winston";
import { ConfigModule } from "@nestjs/config";

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
  ]
})
export class CommonModule {}
