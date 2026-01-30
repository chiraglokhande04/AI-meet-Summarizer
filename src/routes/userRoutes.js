import { Router } from "express";
import {
  loginUser,
  registerUser,
  getUser,
} from "../controllers/userController.js";
import { authMiddleware } from "../middleware/AuthMiddleware.js";
const router = Router();
router.post("/login", loginUser);
router.post("/register", registerUser);
router.get("/profile", authMiddleware, getUser);
export default router;
