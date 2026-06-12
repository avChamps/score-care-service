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
  createPlan,
  getAllSubscriptionPlans,
  updateSubscriptionPlan
} = require("../controllers/subscription-plan.controller");
const {
  getAllFaqs,
  saveFaqs
} = require("../controllers/faq.controller");
const {
  getAdminGeneralDetails,
  saveAdminGeneralDetails
} = require("../controllers/general.controller");
const {
  requireAdmin,
  requireAuth
} = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/dashboard-counts", requireAuth, requireAdmin, getAdminDashboardCounts);
router.get("/subscription-plans", requireAuth, requireAdmin, getAllSubscriptionPlans);
router.post("/subscription-plans", requireAuth, requireAdmin, createPlan);
router.get("/faqs", requireAuth, requireAdmin, getAllFaqs);
router.post("/faqs", requireAuth, requireAdmin, saveFaqs);
router.get("/general", requireAuth, requireAdmin, getAdminGeneralDetails);
router.post("/general", requireAuth, requireAdmin, saveAdminGeneralDetails);
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
