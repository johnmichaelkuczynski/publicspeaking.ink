import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import storageRouter from "./storage";
import speakingRouter from "./speaking";
import speakingCourseRouter from "./speakingCourse";
import speakingAssessmentsRouter from "./speakingAssessments";
import speakingDiagnosticsRouter from "./speakingDiagnostics";
import adminRouter from "./admin";
import { requireAuth } from "../lib/authSession";

const router: IRouter = Router();

// Public: health checks and the Google sign-in flow itself.
router.use(healthRouter);
router.use(authRouter);

// Everything else requires a signed-in session.
router.use(requireAuth);
router.use(storageRouter);
router.use(speakingRouter);
router.use(speakingCourseRouter);
router.use(speakingAssessmentsRouter);
router.use(speakingDiagnosticsRouter);
router.use(adminRouter);

export default router;
