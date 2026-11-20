import express from "express";
import { DeidentificationService } from "../core/DeidentificationService";
import { errorHandler } from "./middleware/errorHandler";
import { createDeidentifyRouter } from "./routes/deidentify.routes";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");

  // 100,000 characters can be 400 KB of UTF-8. The character cap is enforced by the service.
  app.use(express.json({ limit: "512kb" }));
  app.use(createDeidentifyRouter(new DeidentificationService()));

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use(errorHandler);
  return app;
}
