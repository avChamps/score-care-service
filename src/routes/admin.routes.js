const express = require("express");
const {
  downloadAdminLoanDetails,
  exportAdminLoansCsv,
  exportAdminUsersCsv,
  getAdminBasicSubscriptions,
  getAdminChats,
  getAdminDashboardCounts,
  getAdminLoans,
  getAdminUserDetail,
  getAdminUsers,
  updateAdminLoan,
  updateAdminUserSubscription
} = require("../controllers/admin.controller");
const {
  createPlan,
  getAdminBasicPlan,
  getAllSubscriptionPlans,
  saveAdminBasicPlan,
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
  createAdminEmployee,
  deleteAdminEmployee,
  getAdminEmployee,
  getAdminEmployees,
  updateAdminEmployee
} = require("../controllers/employee.controller");
const {
  createAdminEmployeeRole,
  deleteAdminEmployeeRole,
  getAdminEmployeeRole,
  getAdminEmployeeRoles,
  getEmployeeMenuAccess,
  updateAdminEmployeeRole
} = require("../controllers/employee-role.controller");
const {
  getAdminContactRequests
} = require("../controllers/contact.controller");
const {
  getAdminDisputes,
  updateAdminDispute
} = require("../controllers/dispute.controller");
const {
  getAdminNotifications,
  getAdminSentAppNotifications,
  readAdminNotification,
  readAllAdminNotifications,
  sendAdminAppNotification
} = require("../controllers/notification.controller");
const {
  getAdminLoginEvents: getEmployeeLoginEvents
} = require("../controllers/auth.controller");
const {
  getAdminGeneralDetails,
  saveAdminGeneralDetails
} = require("../controllers/general.controller");
const {
  getAdminLegalContentDetails,
  saveAdminLegalContentDetails
} = require("../controllers/legal-content.controller");
const {
  getAdminWebsiteSettingsDetails,
  saveAdminWebsiteSettingsDetails
} = require("../controllers/website-setting.controller");
const {
  assignAdminCibilRepairRequestEmployee,
  createAdminCibilRepairTimeline,
  deleteAdminCibilRepairTimeline,
  fileAdminCibilRepairAccountDispute,
  getAdminCibilRepairContent,
  getAdminCibilRepairRequestDetail,
  getAdminCibilRepairRequests,
  sendAdminCibilRepairWhatsapp,
  updateAdminCibilRepairTimeline,
  updateAdminCibilRepairRequest,
  uploadAdminCibilRepairRequestDocument,
  saveAdminCibilRepairContent
} = require("../controllers/cibil-repair-content.controller");
const {
  getAdminLoanOptions,
  saveAdminLoanOptions
} = require("../controllers/loan.controller");
const {
  downloadAdminCibilReportByUserId,
  downloadManualCibilReport,
  getAdminCreditBureauApiHits,
  getAdminCreditReportDownloads,
  getAdminManualCreditReportDownloads
} = require("../controllers/credit-report.controller");
const {
  requireAdmin,
  requireAuth
} = require("../middleware/auth.middleware");
const {
  adminCreditRepairDocumentUpload,
  websiteSettingsDocumentUpload
} = require("../utils/upload-assets");

const router = express.Router();

router.get("/dashboard-counts", requireAuth, requireAdmin, getAdminDashboardCounts);
router.get(
  "/credit-bureau-api-hits",
  requireAuth,
  requireAdmin,
  getAdminCreditBureauApiHits
);
router.get("/cibil-report-downloads", requireAuth, requireAdmin, getAdminCreditReportDownloads);
router.get(
  "/manual-credit-report-downloads",
  requireAuth,
  requireAdmin,
  getAdminManualCreditReportDownloads
);
router.get(
  "/cibil-report-download/:userId",
  requireAuth,
  requireAdmin,
  downloadAdminCibilReportByUserId
);
router.post(
  "/download-manual-cibil-report",
  requireAuth,
  requireAdmin,
  downloadManualCibilReport
);
router.get("/subscription-plans", requireAuth, requireAdmin, getAllSubscriptionPlans);
router.post("/subscription-plans", requireAuth, requireAdmin, createPlan);
router.get("/basic-plan", requireAuth, requireAdmin, getAdminBasicPlan);
router.post("/basic-plan", requireAuth, requireAdmin, saveAdminBasicPlan);
router.get("/basic-subscriptions", requireAuth, requireAdmin, getAdminBasicSubscriptions);
router.get("/feedback", requireAuth, requireAdmin, getAllFeedback);
router.get("/contact-requests", requireAuth, requireAdmin, getAdminContactRequests);
router.get("/disputes", requireAuth, requireAdmin, getAdminDisputes);
router.patch("/disputes/:publicId", requireAuth, requireAdmin, updateAdminDispute);
router.get("/app-notifications", requireAuth, requireAdmin, getAdminSentAppNotifications);
router.post("/app-notifications", requireAuth, requireAdmin, sendAdminAppNotification);
router.get("/notifications", requireAuth, requireAdmin, getAdminNotifications);
router.patch("/notifications/read-all", requireAuth, requireAdmin, readAllAdminNotifications);
router.patch("/notifications/:publicId/read", requireAuth, requireAdmin, readAdminNotification);
router.get("/login-events", requireAuth, requireAdmin, getEmployeeLoginEvents);
router.get("/employees", requireAuth, requireAdmin, getAdminEmployees);
router.post("/employees", requireAuth, requireAdmin, createAdminEmployee);
router.get("/employee-menu-access", requireAuth, requireAdmin, getEmployeeMenuAccess);
router.get("/employee-roles", requireAuth, requireAdmin, getAdminEmployeeRoles);
router.post("/employee-roles", requireAuth, requireAdmin, createAdminEmployeeRole);
router.get("/employee-roles/:publicId", requireAuth, requireAdmin, getAdminEmployeeRole);
router.patch("/employee-roles/:publicId", requireAuth, requireAdmin, updateAdminEmployeeRole);
router.delete("/employee-roles/:publicId", requireAuth, requireAdmin, deleteAdminEmployeeRole);
router.get("/employees/:publicId", requireAuth, requireAdmin, getAdminEmployee);
router.patch("/employees/:publicId", requireAuth, requireAdmin, updateAdminEmployee);
router.delete("/employees/:publicId", requireAuth, requireAdmin, deleteAdminEmployee);
router.get("/faqs", requireAuth, requireAdmin, getAllFaqs);
router.post("/faqs", requireAuth, requireAdmin, saveFaqs);
router.get("/general", requireAuth, requireAdmin, getAdminGeneralDetails);
router.post("/general", requireAuth, requireAdmin, saveAdminGeneralDetails);
router.patch("/general", requireAuth, requireAdmin, saveAdminGeneralDetails);
router.get("/website-settings", requireAuth, requireAdmin, getAdminWebsiteSettingsDetails);
router.post(
  "/website-settings",
  requireAuth,
  requireAdmin,
  websiteSettingsDocumentUpload,
  saveAdminWebsiteSettingsDetails
);
router.patch(
  "/website-settings",
  requireAuth,
  requireAdmin,
  websiteSettingsDocumentUpload,
  saveAdminWebsiteSettingsDetails
);
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
router.get("/cibil-repair-requests/:publicId", requireAuth, requireAdmin, getAdminCibilRepairRequestDetail);
router.patch(
  "/cibil-repair-requests/:publicId",
  requireAuth,
  requireAdmin,
  updateAdminCibilRepairRequest
);
router.patch(
  "/cibil-repair-requests/:publicId/assign",
  requireAuth,
  requireAdmin,
  assignAdminCibilRepairRequestEmployee
);
router.post(
  "/cibil-repair-requests/:publicId/documents",
  requireAuth,
  requireAdmin,
  adminCreditRepairDocumentUpload,
  uploadAdminCibilRepairRequestDocument
);
router.post(
  "/cibil-repair-requests/:publicId/accounts/:accountId/dispute",
  requireAuth,
  requireAdmin,
  fileAdminCibilRepairAccountDispute
);
router.post(
  "/cibil-repair-requests/:publicId/notify/whatsapp",
  requireAuth,
  requireAdmin,
  sendAdminCibilRepairWhatsapp
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
router.get("/users/:publicId", requireAuth, requireAdmin, getAdminUserDetail);
router.post(
  "/users/:publicId/subscription",
  requireAuth,
  requireAdmin,
  updateAdminUserSubscription
);

module.exports = router;
