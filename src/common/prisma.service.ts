import { Logger } from "winston";
import { Inject, Injectable } from "@nestjs/common";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { PrismaClient } from "generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class PrismaService extends PrismaClient {
  constructor(
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
  ) {
    const host = configService.get<string>("DATABASE_HOST");
    const user = configService.get<string>("DATABASE_USER");
    const password = configService.get<string>("DATABASE_PASSWORD");
    const database = configService.get<string>("DATABASE_NAME");

    const adapter = new PrismaMariaDb({
      host: host!,
      user: user!,
      password: password!,
      database: database!,
      connectionLimit: 5
    });
    super({
      log: [
        {
          emit: "event",
          level: "info"
        },
        {
          emit: "event",
          level: "warn"
        },
        {
          emit: "event",
          level: "error"
        },
        {
          emit: "event",
          level: "query"
        }
      ],

      adapter: adapter
    });
  }
  // onModuleInit() {
  //   this.$on("info", (e) => {
  //     this.logger.info(e);
  //   });
  //   this.$on("warn", (e) => {
  //     this.logger.warn(e);
  //   });
  //   this.$on("error", (e) => {
  //     this.logger.error(e);
  //   });
  //   this.$on("query", (e) => {
  //     this.logger.info(e);
  //   });
  // }
}
