const { pool } = require("../config/db");

function mapSubscriptionPlan(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.publicId,
    publicId: row.publicId,
    planName: row.planName,
    billingCycle: getBillingCycle(row.publicId),
    razorpayPlanId: row.razorpayPlanId,
    amount: Number(row.amount),
    gstPercentage: Number(row.gstPercentage),
    currency: row.currency,
    offerTag: row.offerTag,
    recommendedFor: row.recommendedFor,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    imageUrl: row.imageUrl,
    benefits: parseJsonArray(row.benefits),
    comparisonBenefits: parseJsonArray(row.comparisonBenefits),
    features: parseJsonArray(row.features),
    buttonLabel: row.buttonLabel,
    skipLabel: row.skipLabel,
    displayOrder: row.displayOrder,
    isActive:
      row.isActive === undefined || row.isActive === null
        ? undefined
        : Boolean(row.isActive),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function getBillingCycle(publicId) {
  const value = String(publicId || "").toLowerCase();

  if (value.includes("yearly") || value.includes("annual")) {
    return "yearly";
  }

  if (value.includes("monthly")) {
    return "monthly";
  }

  return null;
}

function parseJsonArray(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  try {
    const parsed = JSON.parse(value);

    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function subscriptionPlanSelect() {
  return `SELECT
    public_id AS publicId,
    plan_name AS planName,
    razorpay_plan_id AS razorpayPlanId,
    amount,
    gst_percentage AS gstPercentage,
    currency,
    offer_tag AS offerTag,
    recommended_for AS recommendedFor,
    title,
    subtitle,
    description,
    image_url AS imageUrl,
    benefits,
    comparison_benefits AS comparisonBenefits,
    features,
    button_label AS buttonLabel,
    skip_label AS skipLabel,
    display_order AS displayOrder,
    is_active AS isActive,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM subscription_plans`;
}

async function listActiveSubscriptionPlans() {
  const [rows] = await pool.query(
    `SELECT
      public_id AS publicId,
      plan_name AS planName,
      razorpay_plan_id AS razorpayPlanId,
      amount,
      gst_percentage AS gstPercentage,
      currency,
      offer_tag AS offerTag,
      recommended_for AS recommendedFor,
      title,
      subtitle,
      description,
      image_url AS imageUrl,
      benefits,
      comparison_benefits AS comparisonBenefits,
      features,
      button_label AS buttonLabel,
      skip_label AS skipLabel
    FROM subscription_plans
    WHERE is_active = 1
    ORDER BY display_order ASC, amount ASC, id ASC`
  );

  return rows.map(mapSubscriptionPlan);
}

async function listAllSubscriptionPlans() {
  const [rows] = await pool.query(
    `${subscriptionPlanSelect()}
    ORDER BY display_order ASC, amount ASC, id ASC`
  );

  return rows.map(mapSubscriptionPlan);
}

async function createSubscriptionPlan(values) {
  const [result] = await pool.query(
    `INSERT INTO subscription_plans (
      public_id,
      plan_name,
      razorpay_plan_id,
      amount,
      gst_percentage,
      currency,
      offer_tag,
      recommended_for,
      title,
      subtitle,
      description,
      image_url,
      benefits,
      comparison_benefits,
      features,
      button_label,
      skip_label,
      display_order,
      is_active
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      values.publicId,
      values.planName,
      values.razorpayPlanId ?? null,
      values.amount,
      values.gstPercentage,
      values.currency,
      values.offerTag ?? null,
      values.recommendedFor ?? null,
      values.title ?? null,
      values.subtitle ?? null,
      values.description ?? null,
      values.imageUrl ?? null,
      JSON.stringify(values.benefits || []),
      JSON.stringify(values.comparisonBenefits || []),
      JSON.stringify(values.features || []),
      values.buttonLabel ?? null,
      values.skipLabel ?? null,
      values.displayOrder,
      values.isActive
    ]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return findSubscriptionPlanByPublicId(values.publicId);
}

async function findSubscriptionPlanByPublicId(publicId) {
  const [rows] = await pool.query(
    `${subscriptionPlanSelect()}
    WHERE public_id = ?`,
    [publicId]
  );

  return mapSubscriptionPlan(rows[0]);
}

async function updateSubscriptionPlanByPublicId(publicId, values) {
  const columnMap = {
    planName: "plan_name",
    amount: "amount",
    gstPercentage: "gst_percentage",
    razorpayPlanId: "razorpay_plan_id",
    currency: "currency",
    offerTag: "offer_tag",
    recommendedFor: "recommended_for",
    title: "title",
    subtitle: "subtitle",
    description: "description",
    imageUrl: "image_url",
    benefits: "benefits",
    comparisonBenefits: "comparison_benefits",
    features: "features",
    buttonLabel: "button_label",
    skipLabel: "skip_label",
    displayOrder: "display_order",
    isActive: "is_active"
  };
  const entries = Object.entries(values).filter(
    ([, value]) => value !== undefined
  );

  if (entries.length === 0) {
    return findSubscriptionPlanByPublicId(publicId);
  }

  const setClause = entries
    .map(([key]) => `${columnMap[key]} = ?`)
    .join(", ");
  const params = entries.map(([key, value]) =>
    key === "benefits" || key === "comparisonBenefits" || key === "features"
      ? JSON.stringify(value)
      : value
  );

  const [result] = await pool.query(
    `UPDATE subscription_plans
    SET ${setClause},
      updated_at = NOW()
    WHERE public_id = ?`,
    [...params, publicId]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return findSubscriptionPlanByPublicId(publicId);
}

function getDateFromUnix(value) {
  const timestamp = Number(value || 0);

  return timestamp > 0 ? new Date(timestamp * 1000) : null;
}

function addBillingCycle(date, billingCycle) {
  const dueAt = new Date(date);

  if (billingCycle === "yearly") {
    dueAt.setFullYear(dueAt.getFullYear() + 1);
  } else {
    dueAt.setMonth(dueAt.getMonth() + 1);
  }

  return dueAt;
}

async function setPendingGatewaySubscription({
  userId,
  planPublicId,
  razorpaySubscriptionId
}) {
  const [planRows] = await pool.query(
    "SELECT id FROM subscription_plans WHERE public_id = ? AND is_active = 1 LIMIT 1",
    [planPublicId]
  );

  if (planRows.length === 0) {
    return null;
  }

  if (razorpaySubscriptionId) {
    await pool.query(
      `UPDATE users
      SET
        subscription_plan_id = ?,
        razorpay_subscription_id = ?,
        subscription_status = 'past_due',
        updated_at = NOW()
      WHERE id = ?`,
      [planRows[0].id, razorpaySubscriptionId, userId]
    );
  } else {
    await pool.query(
      `UPDATE users
      SET
        subscription_plan_id = ?,
        subscription_status = 'past_due',
        updated_at = NOW()
      WHERE id = ?`,
      [planRows[0].id, userId]
    );
  }

  return findSubscriptionPlanByPublicId(planPublicId);
}

async function updateGatewaySubscriptionPayment({
  userId,
  razorpaySubscriptionId,
  razorpayPaymentId,
  amount,
  currency,
  paymentStatus,
  paidAt,
  currentEnd,
  notes
}) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const userQuery = userId
      ? "SELECT id, subscription_plan_id FROM users WHERE id = ? LIMIT 1 FOR UPDATE"
      : "SELECT id, subscription_plan_id FROM users WHERE razorpay_subscription_id = ? LIMIT 1 FOR UPDATE";
    const [userRows] = await connection.query(userQuery, [
      userId || razorpaySubscriptionId
    ]);

    if (userRows.length === 0) {
      await connection.rollback();
      return null;
    }

    const user = userRows[0];
    const [planRows] = await connection.query(
      "SELECT public_id AS publicId FROM subscription_plans WHERE id = ? LIMIT 1",
      [user.subscription_plan_id]
    );
    const billingCycle = getBillingCycle(planRows[0]?.publicId);
    const subscriptionStartedAt = paidAt || new Date();
    const subscriptionDueAt = currentEnd || addBillingCycle(subscriptionStartedAt, billingCycle);
    const subscriptionStatus = paymentStatus === "paid" ? "active" : "past_due";

    if (razorpaySubscriptionId) {
      await connection.query(
        `UPDATE users
        SET
          razorpay_subscription_id = ?,
          subscription_status = ?,
          subscription_started_at = COALESCE(subscription_started_at, ?),
          subscription_due_at = ?,
          subscription_ends_at = ?,
          updated_at = NOW()
        WHERE id = ?`,
        [
          razorpaySubscriptionId,
          subscriptionStatus,
          subscriptionStartedAt,
          subscriptionDueAt,
          subscriptionDueAt,
          user.id
        ]
      );
    } else {
      await connection.query(
        `UPDATE users
        SET
          subscription_status = ?,
          subscription_started_at = COALESCE(subscription_started_at, ?),
          subscription_due_at = ?,
          subscription_ends_at = ?,
          updated_at = NOW()
        WHERE id = ?`,
        [
          subscriptionStatus,
          subscriptionStartedAt,
          subscriptionDueAt,
          subscriptionDueAt,
          user.id
        ]
      );
    }

    if (razorpaySubscriptionId) {
      await connection.query(
        `INSERT INTO subscription_payments (
          user_id,
          subscription_plan_id,
          amount,
          currency,
          payment_status,
          payment_gateway,
          razorpay_subscription_id,
          razorpay_payment_id,
          paid_at,
          gateway_payload
        )
        VALUES (?, ?, ?, ?, ?, 'razorpay', ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          amount = VALUES(amount),
          currency = VALUES(currency),
          payment_status = VALUES(payment_status),
          paid_at = VALUES(paid_at),
          gateway_payload = VALUES(gateway_payload),
          updated_at = NOW()`,
        [
          user.id,
          user.subscription_plan_id,
          amount,
          currency,
          paymentStatus,
          razorpaySubscriptionId,
          razorpayPaymentId,
          paidAt,
          JSON.stringify(notes || {})
        ]
      );
    } else {
      await connection.query(
        `INSERT INTO subscription_payments (
          user_id,
          subscription_plan_id,
          amount,
          currency,
          payment_status,
          payment_gateway,
          razorpay_payment_id,
          paid_at,
          gateway_payload
        )
        VALUES (?, ?, ?, ?, ?, 'razorpay', ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          amount = VALUES(amount),
          currency = VALUES(currency),
          payment_status = VALUES(payment_status),
          paid_at = VALUES(paid_at),
          gateway_payload = VALUES(gateway_payload),
          updated_at = NOW()`,
        [
          user.id,
          user.subscription_plan_id,
          amount,
          currency,
          paymentStatus,
          razorpayPaymentId,
          paidAt,
          JSON.stringify(notes || {})
        ]
      );
    }

    await connection.commit();

    return findSubscriptionPlanByPublicId(planRows[0]?.publicId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateGatewaySubscriptionStatus({
  razorpaySubscriptionId,
  subscriptionStatus,
  currentEnd
}) {
  const [result] = await pool.query(
    `UPDATE users
    SET
      subscription_status = ?,
      subscription_due_at = COALESCE(?, subscription_due_at),
      subscription_ends_at = COALESCE(?, subscription_ends_at),
      updated_at = NOW()
    WHERE razorpay_subscription_id = ?`,
    [subscriptionStatus, currentEnd, currentEnd, razorpaySubscriptionId]
  );

  return result.affectedRows > 0;
}

module.exports = {
  createSubscriptionPlan,
  findSubscriptionPlanByPublicId,
  getDateFromUnix,
  listActiveSubscriptionPlans,
  listAllSubscriptionPlans,
  setPendingGatewaySubscription,
  updateGatewaySubscriptionPayment,
  updateGatewaySubscriptionStatus,
  updateSubscriptionPlanByPublicId
};
