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
  getAllFeedback
} = require("../controllers/feedback.controller");
const {
  getAdminContactRequests
} = require("../controllers/contact.controller");
const {
  getAdminSentAppNotifications,
  sendAdminAppNotification
} = require("../controllers/notification.controller");
const {
  getAdminGeneralDetails,
  saveAdminGeneralDetails
} = require("../controllers/general.controller");
const {
  getAdminLegalContentDetails,
  saveAdminLegalContentDetails
} = require("../controllers/legal-content.controller");
const {
  createAdminCibilRepairTimeline,
  deleteAdminCibilRepairTimeline,
  getAdminCibilRepairContent,
  getAdminCibilRepairRequests,
  updateAdminCibilRepairTimeline,
  updateAdminCibilRepairRequest,
  saveAdminCibilRepairContent
} = require("../controllers/cibil-repair-content.controller");
const {
  getAdminLoanOptions,
  saveAdminLoanOptions
} = require("../controllers/loan.controller");
const {
  requireAdmin,
  requireAuth
} = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/dashboard-counts", requireAuth, requireAdmin, getAdminDashboardCounts);
router.get("/subscription-plans", requireAuth, requireAdmin, getAllSubscriptionPlans);
router.post("/subscription-plans", requireAuth, requireAdmin, createPlan);
router.get("/feedback", requireAuth, requireAdmin, getAllFeedback);
router.get("/contact-requests", requireAuth, requireAdmin, getAdminContactRequests);
router.get("/app-notifications", requireAuth, requireAdmin, getAdminSentAppNotifications);
router.post("/app-notifications", requireAuth, requireAdmin, sendAdminAppNotification);
router.get("/faqs", requireAuth, requireAdmin, getAllFaqs);
router.post("/faqs", requireAuth, requireAdmin, saveFaqs);
router.get("/general", requireAuth, requireAdmin, getAdminGeneralDetails);
router.post("/general", requireAuth, requireAdmin, saveAdminGeneralDetails);
router.patch("/general", requireAuth, requireAdmin, saveAdminGeneralDetails);
router.get("/legal-content", requireAuth, requireAdmin, getAdminLegalContentDetails);
router.post("/legal-content", requireAuth, requireAdmin, saveAdminLegalContentDetails);
router.patch("/legal-content", requireAuth, requireAdmin, saveAdminLegalContentDetails);
router.get("/cibil-repair-content", requireAuth, requireAdmin, getAdminCibilRepairContent);
router.post("/cibil-repair-content", requireAuth, requireAdmin, saveAdminCibilRepairContent);
router.patch("/cibil-repair-content", requireAuth, requireAdmin, saveAdminCibilRepairContent);
router.post("/cibil-repair-content/timelines", requireAuth, requireAdmin, createAdminCibilRepairTimeline);
router.patch("/cibil-repair-content/timelines/:publicId", requireAuth, requireAdmin, updateAdminCibilRepairTimeline);
router.delete("/cibil-repair-content/timelines/:publicId", requireAuth, requireAdmin, deleteAdminCibilRepairTimeline);
router.get("/cibil-repair-requests", requireAuth, requireAdmin, getAdminCibilRepairRequests);
router.patch(
  "/cibil-repair-requests/:publicId",
  requireAuth,
  requireAdmin,
  updateAdminCibilRepairRequest
);
router.get("/loan-options", requireAuth, requireAdmin, getAdminLoanOptions);
router.post("/loan-options", requireAuth, requireAdmin, saveAdminLoanOptions);
router.patch("/loan-options", requireAuth, requireAdmin, saveAdminLoanOptions);
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
