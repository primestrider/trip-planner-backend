import { Injectable, PipeTransform, Type, mixin } from "@nestjs/common";
import { ZodType } from "zod";
import { ValidationService } from "./validation.service";

/**
 * Factory function that creates a NestJS pipe for validating incoming data
 * using a provided Zod schema.
 *
 * This pipe integrates with NestJS Dependency Injection while still allowing
 * the schema to be defined per usage site (e.g. per controller method).
 *
 * Internally, this function uses NestJS `mixin()` to generate a unique,
 * DI-aware pipe class for each schema instance.
 *
 * @template T - The inferred type of the validated data
 * @param schema - Zod schema used to validate the incoming value
 * @returns A NestJS PipeTransform class that validates input using the schema
 *
 * @example
 * ```ts
 * @Post("register")
 * async register(
 *   @Body(ValidationPipe(RegisterSchema)) body: RegisterDto
 * ) {
 *   return this.authService.register(body);
 * }
 * ```
 */
export function ValidationPipe<T>(schema: ZodType<T>): Type<PipeTransform> {
  /**
   * Concrete pipe implementation generated per schema.
   *
   * This class is marked as `@Injectable()` so that NestJS can inject
   * shared services (such as ValidationService) into the pipe.
   *
   * The schema itself is captured via closure from the factory function.
   */
  @Injectable()
  class ValidationPipeMixin implements PipeTransform {
    /**
     * Creates a new instance of the validation pipe.
     *
     * @param validationService - Shared validation service responsible for
     *                            executing schema validation and formatting
     *                            validation errors
     */
    constructor(private readonly validationService: ValidationService) {}

    /**
     * Transforms and validates the incoming value.
     *
     * If the value does not conform to the provided Zod schema, a
     * BadRequestException will be thrown by the ValidationService.
     *
     * @param value - Raw input value from the request
     * @returns The validated and parsed value
     */
    transform(value: unknown): T {
      const normalizedValue = value ?? {};

      return this.validationService.validate(schema, normalizedValue);
    }
  }

  // Wrap the generated class with NestJS `mixin` to ensure
  // proper metadata handling and DI compatibility.
  return mixin(ValidationPipeMixin);
}
