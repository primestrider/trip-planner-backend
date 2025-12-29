import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import { LoggerService } from "@nestjs/common";
import { DeviceIdInterceptor } from "./common/interceptor/device.interceptor";
import { ResponseInterceptor } from "./common/interceptor/response.interceptor";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const logger = app.get<LoggerService>(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(logger);
  app.useGlobalInterceptors(new DeviceIdInterceptor());

  app.useGlobalInterceptors(new ResponseInterceptor());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
