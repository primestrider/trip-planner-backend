import { BadRequestException } from "@nestjs/common";

/**
 * Read the version a client expects from an `If-Match` header.
 *
 * Accepts `3`, `"3"` and weak `W/"3"`; a missing or empty header means the
 * client does not ask for a version check.
 *
 * @throws BadRequestException if the header is not a version number
 */
export function parseIfMatch(header: string | undefined): number | undefined {
  if (header === undefined || header.trim() === "") {
    return undefined;
  }

  const match = /^\s*(?:W\/)?"?(\d{1,9})"?\s*$/.exec(header);

  if (!match) {
    throw new BadRequestException(
      'If-Match must be the item version, e.g. If-Match: "3"'
    );
  }

  return Number(match[1]);
}
