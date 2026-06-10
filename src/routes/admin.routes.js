const express = require("express");
const {
  downloadAdminLoanDetails,
  exportAdminLoansCsv,
  exportAdminUsersCsv,
  getAdminChats,
  getAdminDashboardCounts,
  getAdminLoans,
  getAdminUsers,
  updateAdminLoan,
  updateAdminUserSubscription
} = require("../controllers/admin.controller");
const {
  getAllSubscriptionPlans,
  updateSubscriptionPlan
} = require("../controllers/subscription-plan.controller");
const {
  requireAdmin,
  requireAuth
} = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/dashboard-counts", requireAuth, requireAdmin, getAdminDashboardCounts);
router.get("/subscription-plans", requireAuth, requireAdmin, getAllSubscriptionPlans);
router.patch(
  "/subscription-plans/:publicId",
  requireAuth,
  requireAdmin,
  updateSubscriptionPlan
);
router.get("/chats", requireAuth, requireAdmin, getAdminChats);
router.get("/loans/export", requireAuth, requireAdmin, exportAdminLoansCsv);
router.get("/loans", requireAuth, requireAdmin, getAdminLoans);
router.patch("/loans/:loanId", requireAuth, requireAdmin, updateAdminLoan);
router.get("/loans/:loanId/download-details", requireAuth, requireAdmin, downloadAdminLoanDetails);
router.get("/users/export", requireAuth, requireAdmin, exportAdminUsersCsv);
router.get("/users", requireAuth, requireAdmin, getAdminUsers);
router.post(
  "/users/:publicId/subscription",
  requireAuth,
  requireAdmin,
  updateAdminUserSubscription
);

module.exports = router;
