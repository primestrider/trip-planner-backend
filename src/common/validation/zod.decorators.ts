import { Body, Query } from "@nestjs/common";
import { ApiBody, ApiQuery } from "@nestjs/swagger";
import { z, ZodObject, ZodType } from "zod";
import { ValidationPipe } from "./validation.pipe";

type JsonSchema = { [key: string]: unknown };

// OpenAPI schema object (not exported from the package root)
type SchemaObject = Extract<
  Parameters<typeof ApiBody>[0],
  { schema: unknown }
>["schema"];

/**
 * Make a Zod-generated JSON Schema easier to read in the docs:
 * drop `$schema`, regex patterns already described by `format`
 * (date, uuid, ...) and the "max safe integer" bound Zod adds to ints.
 */
function tidy(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(tidy);
  }
  if (node === null || typeof node !== "object") {
    return node;
  }

  const result: JsonSchema = {};
  for (const [key, value] of Object.entries(node as JsonSchema)) {
    if (key === "$schema") continue;
    if (key === "pattern" && "format" in (node as JsonSchema)) continue;
    if (key === "maximum" && value === Number.MAX_SAFE_INTEGER) continue;
    result[key] = tidy(value);
  }
  return result;
}

/**
 * JSON Schema of what a client may send (input side of transforms
 * and defaults), as used by OpenAPI 3.1.
 */
export function toOpenApiSchema(schema: ZodType): SchemaObject {
  return tidy(
    z.toJSONSchema(schema, { io: "input", unrepresentable: "any" })
  ) as SchemaObject;
}

/**
 * Validates the request body with a Zod schema and documents the same
 * schema in OpenAPI, so validation and docs cannot drift apart.
 *
 * @example
 * async create(@ZodBody(CreateTripSchema) body: CreateTripDto) {}
 */
export function ZodBody(schema: ZodType): ParameterDecorator {
  return (target, propertyKey, index) => {
    Body(ValidationPipe(schema))(target, propertyKey, index);

    if (propertyKey !== undefined) {
      const descriptor = Object.getOwnPropertyDescriptor(target, propertyKey)!;
      ApiBody({ schema: toOpenApiSchema(schema) })(
        target,
        propertyKey,
        descriptor
      );
    }
  };
}

/**
 * Validates the query string with a Zod object schema and documents
 * each field as a query parameter.
 */
export function ZodQuery(schema: ZodObject): ParameterDecorator {
  return (target, propertyKey, index) => {
    Query(ValidationPipe(schema))(target, propertyKey, index);

    if (propertyKey === undefined) return;

    const descriptor = Object.getOwnPropertyDescriptor(target, propertyKey)!;
    const json = toOpenApiSchema(schema) as {
      properties?: Record<string, SchemaObject>;
      required?: string[];
    };

    for (const [name, property] of Object.entries(json.properties ?? {})) {
      ApiQuery({
        name,
        required: json.required?.includes(name) ?? false,
        schema: property
      })(target, propertyKey, descriptor);
    }
  };
}
