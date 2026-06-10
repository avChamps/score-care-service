const { pool } = require("../config/db");

function mapSubscriptionPlan(row) {
  return {
    id: row.publicId,
    publicId: row.publicId,
    planName: row.planName,
    amount: Number(row.amount),
    currency: row.currency,
    offerTag: row.offerTag,
    recommendedFor: row.recommendedFor
  };
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

module.exports = {
  listActiveSubscriptionPlans
};
