const express = require("express");

const {
  getMyNotifications,
  readAllNotifications,
  readNotification
} = require("../controllers/notification.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", requireAuth, getMyNotifications);
router.post("/read-all", requireAuth, readAllNotifications);
router.post("/:notificationId/read", requireAuth, readNotification);

module.exports = router;
