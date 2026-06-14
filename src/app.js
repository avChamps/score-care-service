const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");

const env = require("./config/env");
const adminRoutes = require("./routes/admin.routes");
const aiRoutes = require("./routes/ai.routes");
const authRoutes = require("./routes/auth.routes");
const cibilRepairContentRoutes = require("./routes/cibil-repair-content.routes");
const creditReportRoutes = require("./routes/credit-report.routes");
const faqRoutes = require("./routes/faq.routes");
const feedbackRoutes = require("./routes/feedback.routes");
const generalRoutes = require("./routes/general.routes");
const healthRoutes = require("./routes/health.routes");
const improveToolAnalyticsRoutes = require("./routes/improve-tool-analytics.routes");
const legalContentRoutes = require("./routes/legal-content.routes");
const loanRoutes = require("./routes/loan.routes");
const notificationRoutes = require("./routes/notification.routes");
const subscriptionPlanRoutes = require("./routes/subscription-plan.routes");
const userRoutes = require("./routes/user.routes");
const {
  errorHandler,
  notFoundHandler
} = require("./middleware/error.middleware");

const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

if (env.nodeEnv !== "test") {
  app.use(morgan("dev"));
}

app.get("/", (_req, res) => {
  res.status(200).json({
    name: "score-care-service",
    status: "running"
  });
});

app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/ai", aiRoutes);
app.use("/cibil-repair-content", cibilRepairContentRoutes);
app.use("/credit-reports", creditReportRoutes);
app.use("/faqs", faqRoutes);
app.use("/feedback", feedbackRoutes);
app.use("/general", generalRoutes);
app.use("/health", healthRoutes);
app.use("/improve-tool-analytics", improveToolAnalyticsRoutes);
app.use("/legal-content", legalContentRoutes);
app.use("/loans", loanRoutes);
app.use("/notifications", notificationRoutes);
app.use("/subscription-plans", subscriptionPlanRoutes);
app.use("/users", userRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
