import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import { requireAuth } from "../lib/auth";
import instancesRouter from "./instances";
import memoriesRouter from "./memories";
import searchRouter from "./search";
import askRouter from "./ask";
import timelineRouter from "./timeline";
import graphRouter from "./graph";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

// Public routes: health check and auth (register/login/logout/me)
router.use(healthRouter);
router.use(authRouter);

// Everything below requires an authenticated session
router.use(requireAuth);
router.use(instancesRouter);
router.use(memoriesRouter);
router.use(searchRouter);
router.use(askRouter);
router.use(timelineRouter);
router.use(graphRouter);
router.use(dashboardRouter);

export default router;
