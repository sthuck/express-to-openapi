import express, { Request, Response } from "express";
import { setupApp } from "./setupApp";

const app = express();
app.use(express.json());
setupApp(app);
export default app;
