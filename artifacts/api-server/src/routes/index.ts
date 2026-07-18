import { Router, type IRouter } from "express";
import healthRouter from "./health";
import instancesRouter from "./instances";
import memoriesRouter from "./memories";
import searchRouter from "./search";
import askRouter from "./ask";
import timelineRouter from "./timeline";
import graphRouter from "./graph";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(instancesRouter);
router.use(memoriesRouter);
router.use(searchRouter);
router.use(askRouter);
router.use(timelineRouter);
router.use(graphRouter);
router.use(dashboardRouter);

export default router;
