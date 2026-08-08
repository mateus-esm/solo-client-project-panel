import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import projectsRouter from "./projects";
import webhooksRouter from "./webhooks";
import storageRouter from "./storage";
import chatRouter from "./chat";
import schedulingRouter from "./scheduling";
import adminRouter from "./admin";
import internalRouter from "./internal";
import homologacaoRouter from "./homologacao";
import installerRouter from "./installer";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(projectsRouter);
router.use(webhooksRouter);
router.use(storageRouter);
router.use(chatRouter);
router.use(schedulingRouter);
router.use(adminRouter);
router.use("/internal", internalRouter);
router.use(homologacaoRouter);
router.use(installerRouter);

export default router;
