const { pool } = require("../config/db");

function mapSubscriptionPlan(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.publicId,
    publicId: row.publicId,
    planName: row.planName,
    amount: Number(row.amount),
    currency: row.currency,
    offerTag: row.offerTag,
    recommendedFor: row.recommendedFor,
    displayOrder: row.displayOrder,
    isActive:
      row.isActive === undefined || row.isActive === null
        ? undefined
        : Boolean(row.isActive),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function subscriptionPlanSelect() {
  return `SELECT
    public_id AS publicId,
    plan_name AS planName,
    amount,
    currency,
    offer_tag AS offerTag,
    recommended_for AS recommendedFor,
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
      recommended_for AS recommendedFor
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
  const params = entries.map(([, value]) => value);

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
  findSubscriptionPlanByPublicId,
  listActiveSubscriptionPlans,
  listAllSubscriptionPlans,
  updateSubscriptionPlanByPublicId
};
