const {
  sendWhatsAppAdminMessage,
  sendWhatsAppSafely,
  sendWhatsAppUserMessage
} = require("./whatsapp.service");
const {
  shouldSendUserWhatsappAlert
} = require("../models/user.model");

function valueOrFallback(value, fallback = "Not available") {
  return value === undefined || value === null || value === "" ? fallback : value;
}

function customerName(user) {
  return valueOrFallback(user?.fullName, "Customer");
}

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata"
  });
}

function formatMoney(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    return "Not available";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(amount);
}

const templates = {
  feedbackReceived(user) {
    return [
      `Hi ${customerName(user)},`,
      "",
      "Thank you for sharing your feedback with ScoreCare.",
      "",
      "Your feedback helps us improve your credit score experience and provide better financial support.",
      "",
      "Regards,",
      "Team ScoreCare"
    ].join("\n");
  },

  firstTimeWelcome(user) {
    return [
      `Hi ${customerName(user)},`,
      "",
      "Welcome to ScoreCare. Your account is ready.",
      "",
      "You can now use ScoreCare to review your credit updates and access financial support.",
      "",
      "Regards,",
      "Team ScoreCare"
    ].join("\n");
  },

  emiDueReminder(user, emi) {
    const bankName = valueOrFallback(emi.bankName || emi.lenderName, "your loan account");
    const amount = formatMoney(emi.emiAmount || emi.amount);

    return [
      `Hi ${customerName(user)},`,
      "",
      `This is a gentle reminder that your EMI for ${bankName} is due on ${formatDate(emi.dueDate)}.`,
      "",
      `Amount Due: ${amount}`,
      "",
      "Please ensure timely payment to avoid late fees and protect your credit score.",
      "",
      "You can proceed to pay from your ScoreCare app.",
      "",
      "Regards,",
      "Team ScoreCare"
    ].join("\n");
  },

  paymentReminder(user, payment) {
    return [
      `Hi ${customerName(user)},`,
      "",
      `This is a gentle reminder that your payment is due on ${formatDate(payment.dueDate)}.`,
      "",
      `Amount Due: ${formatMoney(payment.amount)}`,
      "",
      "Please complete the payment on time to continue enjoying ScoreCare services.",
      "",
      "Regards,",
      "Team ScoreCare"
    ].join("\n");
  },

  subscriptionPaymentSuccess(user, payment) {
    return [
      `Hi ${customerName(user)},`,
      "",
      "Your ScoreCare subscription payment has been received successfully.",
      "",
      `Amount Paid: ${formatMoney(payment.amount)}`,
      "",
      "Thank you for choosing ScoreCare.",
      "",
      "Regards,",
      "Team ScoreCare"
    ].join("\n");
  },

  subscriptionRenewal(user, notification) {
    return [
      `Hi ${customerName(user)},`,
      "",
      `Your ScoreCare subscription renews on ${formatDate(notification.data?.subscriptionDueAt)}.`,
      "",
      "Please keep your payment method ready to avoid interruption.",
      "",
      "Regards,",
      "Team ScoreCare"
    ].join("\n");
  },

  inactiveUser(user) {
    return [
      `Hi ${customerName(user)},`,
      "",
      "It has been a while since your last ScoreCare login.",
      "",
      "Open the app to review your latest credit updates and available support options.",
      "",
      "Regards,",
      "Team ScoreCare"
    ].join("\n");
  },

  disputeStatus(user, request) {
    return [
      `Hi ${customerName(user)},`,
      "",
      `Your ScoreCare credit repair request status has been updated to ${valueOrFallback(request.repairStatus || request.status)}.`,
      "",
      `Remarks: ${valueOrFallback(request.remarks)}`,
      "",
      "Regards,",
      "Team ScoreCare"
    ].join("\n");
  },

  creditImproved(user, request) {
    return [
      `Hi ${customerName(user)},`,
      "",
      "Good news. Your credit improvement status has been updated.",
      "",
      `Points Gained: ${valueOrFallback(request.pointsGained)}`,
      `Remarks: ${valueOrFallback(request.remarks)}`,
      "",
      "Regards,",
      "Team ScoreCare"
    ].join("\n");
  },

  supportAdminAlert(alert) {
    return [
      valueOrFallback(alert.title, "ScoreCare Alert"),
      "",
      valueOrFallback(alert.message, "A support update requires attention.")
    ].join("\n");
  }
};

async function sendUserWhatsappAlert(user, message) {
  const userId = user?.internalId || user?.userId;

  if (userId && !await shouldSendUserWhatsappAlert(userId)) {
    return {
      status: "skipped",
      reason: "User disabled WhatsApp alerts"
    };
  }

  return sendWhatsAppUserMessage(user, message);
}

async function sendFeedbackReceivedWhatsapp(user) {
  return sendUserWhatsappAlert(user, templates.feedbackReceived(user));
}

async function sendFirstTimeWelcomeWhatsapp(user) {
  return sendUserWhatsappAlert(user, templates.firstTimeWelcome(user));
}

async function sendEmiDueReminderWhatsapp(user, emi) {
  return sendUserWhatsappAlert(user, templates.emiDueReminder(user, emi));
}

async function sendPaymentReminderWhatsapp(user, payment) {
  return sendUserWhatsappAlert(user, templates.paymentReminder(user, payment));
}

async function sendSubscriptionPaymentSuccessWhatsapp(user, payment) {
  return sendUserWhatsappAlert(user, templates.subscriptionPaymentSuccess(user, payment));
}

async function sendSubscriptionRenewalWhatsapp(user, notification) {
  return sendUserWhatsappAlert(user, templates.subscriptionRenewal(user, notification));
}

async function sendInactiveUserWhatsapp(user) {
  return sendUserWhatsappAlert(user, templates.inactiveUser(user));
}

async function sendDisputeStatusWhatsapp(user, request) {
  return sendUserWhatsappAlert(user, templates.disputeStatus(user, request));
}

async function sendManualUserWhatsapp(user, message) {
  return sendUserWhatsappAlert(user, message);
}

async function sendCreditImprovedWhatsapp(user, request) {
  return sendUserWhatsappAlert(user, templates.creditImproved(user, request));
}

async function sendSupportAdminWhatsapp(alert) {
  return sendWhatsAppAdminMessage(templates.supportAdminAlert(alert));
}

module.exports = {
  sendCreditImprovedWhatsapp,
  sendDisputeStatusWhatsapp,
  sendEmiDueReminderWhatsapp,
  sendFeedbackReceivedWhatsapp,
  sendFirstTimeWelcomeWhatsapp,
  sendInactiveUserWhatsapp,
  sendManualUserWhatsapp,
  sendPaymentReminderWhatsapp,
  sendSubscriptionPaymentSuccessWhatsapp,
  sendSubscriptionRenewalWhatsapp,
  sendSupportAdminWhatsapp,
  shouldSendUserWhatsappAlert,
  sendWhatsAppSafely,
  templates
};
