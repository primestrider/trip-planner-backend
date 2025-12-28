import { BadRequestException, Injectable } from "@nestjs/common";
import { ZodError, ZodType } from "zod";

/**
 * ValidationService provides a centralized utility for validating data
 * using Zod schemas and converting validation errors into a consistent
 * HTTP-friendly error format.
 *
 * This service is framework-agnostic in usage and can be reused across
 * different entry points such as HTTP pipes, background jobs, cron tasks,
 * or CLI commands.
 */
@Injectable()
export class ValidationService {
  /**
   * Validates the given data against a Zod schema.
   *
   * On validation failure, this method throws a BadRequestException with
   * a normalized error structure, grouping multiple error messages
   * by their corresponding field paths.
   *
   * @param schema - Zod schema used to validate the input data
   * @param data - Raw input data to be validated
   * @returns The validated and parsed data
   * @throws BadRequestException When validation fails
   */
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
          statusCode: 400,
          message: "validation_failed",
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
