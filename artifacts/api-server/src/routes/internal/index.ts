import { Router, type IRouter } from "express";
import projectsRouter from "./projects";
import servicesRouter from "./services";
import techniciansRouter from "./technicians";
import installersRouter from "./installers";
import procurementRouter from "./procurement";
import financeRouter from "./finance";
import clientsRouter from "./clients";
import plantsRouter from "./plants";
import stockRouter from "./stock";
import { requireAdmin } from "../../lib/adminAuth";

const router: IRouter = Router();

// The internal ERP reuses the existing admin session (cookie solo_admin_session).
router.use(requireAdmin);
router.use(projectsRouter);
router.use(servicesRouter);
router.use(techniciansRouter);
router.use(installersRouter);
router.use(procurementRouter);
router.use(financeRouter);
router.use(clientsRouter);
router.use(plantsRouter);
router.use(stockRouter);

export default router;
