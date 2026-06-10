const express = require("express");
const {
  exportAdminUsersCsv,
  getAdminDashboardCounts,
  getAdminUsers,
  updateAdminUserSubscription
} = require("../controllers/admin.controller");
const {
  requireAdmin,
  requireAuth
} = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/dashboard-counts", requireAuth, requireAdmin, getAdminDashboardCounts);
router.get("/users/export", requireAuth, requireAdmin, exportAdminUsersCsv);
router.get("/users", requireAuth, requireAdmin, getAdminUsers);
router.post(
  "/users/:publicId/subscription",
  requireAuth,
  requireAdmin,
  updateAdminUserSubscription
);

module.exports = router;
