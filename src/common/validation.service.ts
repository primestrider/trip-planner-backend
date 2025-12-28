import { BadRequestException, Injectable } from "@nestjs/common";
import { ZodError, ZodType } from "zod";

@Injectable()
export class ValidationService {
  validate<T>(schema: ZodType<T>, data: unknown): T {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMap = new Map<string, string[]>();

        for (const issue of error.issues) {
          const field = issue.path.join(".");
          const messages = errorMap.get(field) ?? [];
          messages.push(issue.message);
          errorMap.set(field, messages);
        }

        throw new BadRequestException({
          message: "validation_error",
          errors: Array.from(errorMap.entries()).map(([field, messages]) => ({
            field,
            messages
          }))
        });
      }

      throw error;
    }
  }
}
