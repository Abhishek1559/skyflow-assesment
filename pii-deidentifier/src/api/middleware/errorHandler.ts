import type { ErrorRequestHandler } from "express";
import { DeidentificationInputError } from "../../core/errors";

// Errors raised by the JSON body parser carry an HTTP status and a type.
interface BodyParserError {
  status?: number;
  type?: string;
}

// No response echoes the submitted text, and the text is never logged.
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof DeidentificationInputError) {
    res.status(400).json({ error: error.message, validEntities: error.validEntities });
    return;
  }

  const { status, type } = error as BodyParserError;

  if (type === "entity.too.large") {
    res.status(413).json({ error: "Request body is too large" });
    return;
  }
  if (type === "entity.parse.failed") {
    res.status(400).json({ error: "Request body must be valid JSON" });
    return;
  }
  // Any other client error from the parser, such as an unsupported charset.
  if (typeof status === "number" && status >= 400 && status < 500) {
    res.status(status).json({ error: "Request could not be read" });
    return;
  }

  console.error(error);
  res.status(500).json({ error: "Internal server error" });
};
