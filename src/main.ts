import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import { LoggerService } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import helmet from "helmet";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
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

  // API docs at /docs (UI) and /docs-json (OpenAPI), not exposed in production
  if (config.get<string>("NODE_ENV") !== "production") {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("Trip Planner API")
        .setDescription(
          "Plan trips with friends: itinerary, stays, transports, budget and expenses."
        )
        .setVersion("1.0")
        .setOpenAPIVersion("3.1.0")
        .addBearerAuth()
        .addGlobalParameters({
          name: "x-device-id",
          in: "header",
          required: false,
          description:
            "Identifies the client device; required on every route except /health and /shared",
          schema: { type: "string" }
        })
        .build()
    );
    SwaggerModule.setup("docs", app, document);
  }

  // run onModuleDestroy hooks (e.g. close DB connections) on SIGTERM / SIGINT
  app.enableShutdownHooks();

  await app.listen(config.get<number>("PORT") ?? 3000);
}
void bootstrap();
