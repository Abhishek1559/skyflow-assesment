import type { NextFunction, Request, Response } from "express";
import type { DeidentificationService } from "../../core/DeidentificationService";

export function deidentify(service: DeidentificationService) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = service.deidentify(req.body.text, { entities: req.body.entities });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
