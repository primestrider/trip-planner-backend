import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import { LoggerService } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { configureApp } from "./app.setup";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useLogger(app.get<LoggerService>(WINSTON_MODULE_NEST_PROVIDER));
  configureApp(app);

  await app.listen(app.get(ConfigService).get<number>("PORT") ?? 3000);
}
void bootstrap();
