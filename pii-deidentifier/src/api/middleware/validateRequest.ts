import type { NextFunction, Request, Response } from "express";

// Field checks (text is a string, entities is a list of names) live on the service.
// This only rejects what the service never sees: a non-JSON content type, or a JSON body
// that is not an object. express.json has already parsed the body by this point.
export function requireJsonBody(req: Request, res: Response, next: NextFunction): void {
  if (req.headers["content-type"] && !req.is("json")) {
    res.status(415).json({ error: "Content-Type must be application/json" });
    return;
  }
  if (typeof req.body !== "object" || req.body === null || Array.isArray(req.body)) {
    res.status(400).json({ error: "Request body must be a JSON object" });
    return;
  }
  next();
}
