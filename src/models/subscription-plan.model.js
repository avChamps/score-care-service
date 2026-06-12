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
    amount: Number(row.amount),
    currency: row.currency,
    offerTag: row.offerTag,
    recommendedFor: row.recommendedFor,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    imageUrl: row.imageUrl,
    benefits: parseJsonArray(row.benefits),
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
    amount,
    currency,
    offer_tag AS offerTag,
    recommended_for AS recommendedFor,
    title,
    subtitle,
    description,
    image_url AS imageUrl,
    benefits,
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
      amount,
      currency,
      offer_tag AS offerTag,
      recommended_for AS recommendedFor,
      title,
      subtitle,
      description,
      image_url AS imageUrl,
      benefits,
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
      amount,
      currency,
      offer_tag,
      recommended_for,
      title,
      subtitle,
      description,
      image_url,
      benefits,
      features,
      button_label,
      skip_label,
      display_order,
      is_active
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      values.publicId,
      values.planName,
      values.amount,
      values.currency,
      values.offerTag,
      values.recommendedFor,
      values.title,
      values.subtitle,
      values.description,
      values.imageUrl,
      JSON.stringify(values.benefits || []),
      JSON.stringify(values.features || []),
      values.buttonLabel,
      values.skipLabel,
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
    currency: "currency",
    offerTag: "offer_tag",
    recommendedFor: "recommended_for",
    title: "title",
    subtitle: "subtitle",
    description: "description",
    imageUrl: "image_url",
    benefits: "benefits",
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
    key === "benefits" || key === "features" ? JSON.stringify(value) : value
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

module.exports = {
  createSubscriptionPlan,
  findSubscriptionPlanByPublicId,
  listActiveSubscriptionPlans,
  listAllSubscriptionPlans,
  updateSubscriptionPlanByPublicId
};
