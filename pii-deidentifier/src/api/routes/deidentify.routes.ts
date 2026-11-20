import { Router } from "express";
import type { DeidentificationService } from "../../core/DeidentificationService";
import { deidentify } from "../controllers/deidentify.controller";
import { requireJsonBody } from "../middleware/validateRequest";

export function createDeidentifyRouter(service: DeidentificationService): Router {
  const router = Router();

  router.post("/deidentify", requireJsonBody, deidentify(service));

  return router;
}
