import express from "express";
import {
  checkIn,
  checkOut,
  getMonthlyAttendance,
  getTodayStatus,
  reverseGeocode,
} from "../controllers/attendanceController.js";

const router = express.Router();

router.get("/reverse-geocode", reverseGeocode); // must come before /:employeeId routes
router.post("/checkin", checkIn);
router.post("/checkout", checkOut);
router.get("/:employeeId/today", getTodayStatus); // must come before /:employeeId
router.get("/:employeeId", getMonthlyAttendance);

export default router;