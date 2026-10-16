import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import { LoggerService } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import helmet from "helmet";
import { DeviceIdInterceptor } from "./common/interceptor/device.interceptor";
import { ResponseInterceptor } from "./common/interceptor/response.interceptor";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const logger = app.get<LoggerService>(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(logger);

  // security headers (HSTS, no MIME sniffing, frame protection, ...)
  app.use(helmet());

  // browsers may only call the API from these origins; empty = CORS off
  const corsOrigins = config.get<string[]>("CORS_ORIGINS") ?? [];
  if (corsOrigins.length > 0) {
    app.enableCors({
      origin: corsOrigins,
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "x-device-id",
        "x-request-id"
      ],
      exposedHeaders: ["x-request-id"]
    });
  }

  app.useGlobalInterceptors(new DeviceIdInterceptor(app.get(Reflector)));
  app.useGlobalInterceptors(new ResponseInterceptor());

  // run onModuleDestroy hooks (e.g. close DB connections) on SIGTERM / SIGINT
  app.enableShutdownHooks();

  await app.listen(config.get<number>("PORT") ?? 3000);
}
void bootstrap();
