import express, { Request, Response, Application } from "express";
import userRouter from "./user-routes";
import postRouter from "./post-routes";

export function setupApp(app: Application) {
  /**
   * Health check endpoint
   * @summary Check API health
   */
  function healthCheck(req: Request, res: Response) {
    res.json({ status: "ok" });
  }

  /**
   * Get API information
   * @summary Get API info
   */
  function getApiInfo(req: Request, res: Response) {
    res.json({ name: "Complex API", version: "1.0.0" });
  }

  // Root endpoints
  app.get("/health", healthCheck);
  app.get("/info", getApiInfo);

  // Mount user routes
  app.use("/api/users", userRouter);

  // Mount post routes under users (nested)
  app.use("/api/users/:userId/posts", postRouter);
}
