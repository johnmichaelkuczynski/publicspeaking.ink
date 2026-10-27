import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storageRouter from "./storage";
import speakingRouter from "./speaking";
import speakingCourseRouter from "./speakingCourse";
import speakingAssessmentsRouter from "./speakingAssessments";
import speakingDiagnosticsRouter from "./speakingDiagnostics";
import adminRouter from "./admin";
import { studentContext } from "../lib/studentContext";

const router: IRouter = Router();

// All application functionality is available without an account.
router.use(healthRouter);
router.use(studentContext);
router.use(storageRouter);
router.use(speakingRouter);
router.use(speakingCourseRouter);
router.use(speakingAssessmentsRouter);
router.use(speakingDiagnosticsRouter);
router.use(adminRouter);

export default router;
