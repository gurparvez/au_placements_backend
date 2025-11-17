import { Router } from "express";
import { homeController } from "../controllers/home.controller";
import studentRoutes from "./student.routes";
import skillRoutes from "./skill.routes";
import courseRoutes from "./course.routes";
import authRoutes from "./auth.routes";


const router = Router();

// Main home route
router.get("/", homeController);

// Mount additional route groups
router.use("/auth", authRoutes);
router.use("/student", studentRoutes);
router.use("/skills", skillRoutes);
router.use("/courses", courseRoutes);

export default router;
