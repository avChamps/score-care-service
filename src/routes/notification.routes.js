const express = require("express");

const {
  getMyNotifications,
  readAllNotifications,
  readNotification,
  registerDevice,
  sendTestNotification
} = require("../controllers/notification.controller");
const { requireAdmin, requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", requireAuth, getMyNotifications);
router.post("/register-device", requireAuth, registerDevice);
router.post("/test", requireAuth, requireAdmin, sendTestNotification);
router.post("/read-all", requireAuth, readAllNotifications);
router.post("/:notificationId/read", requireAuth, readNotification);

module.exports = router;
