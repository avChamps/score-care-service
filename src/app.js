const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");

const env = require("./config/env");
const authRoutes = require("./routes/auth.routes");
const creditReportRoutes = require("./routes/credit-report.routes");
const healthRoutes = require("./routes/health.routes");
const userRoutes = require("./routes/user.routes");
const {
  errorHandler,
  notFoundHandler
} = require("./middleware/error.middleware");

const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin, credentials: true }));
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
app.use("/credit-reports", creditReportRoutes);
app.use("/health", healthRoutes);
app.use("/users", userRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
