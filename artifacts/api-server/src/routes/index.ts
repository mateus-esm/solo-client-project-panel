import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import projectsRouter from "./projects";
import webhooksRouter from "./webhooks";
import storageRouter from "./storage";
import chatRouter from "./chat";
import schedulingRouter from "./scheduling";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(projectsRouter);
router.use(webhooksRouter);
router.use(storageRouter);
router.use(chatRouter);
router.use(schedulingRouter);

export default router;
