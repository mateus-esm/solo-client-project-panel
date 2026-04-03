import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import webhooksRouter from "./webhooks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(projectsRouter);
router.use(webhooksRouter);

export default router;
