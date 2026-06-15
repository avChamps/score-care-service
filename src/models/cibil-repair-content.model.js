const { randomUUID } = require("crypto");

const { pool } = require("../config/db");

function mapPlan(row) {
  return {
    id: row.publicId,
    publicId: row.publicId,
    planName: row.planName,
    amount: Number(row.amount),
    currency: row.currency,
    gstPercentage: Number(row.gstPercentage),
    offerTag: row.offerTag,
    buttonLabel: row.buttonLabel,
    displayOrder: row.displayOrder,
    isActive: Boolean(row.isActive),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapTimeline(row) {
  return {
    id: row.publicId,
    publicId: row.publicId,
    title: row.title,
    description: row.description,
    displayOrder: row.displayOrder,
    isActive: Boolean(row.isActive),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function planSelect() {
  return `SELECT
    public_id AS publicId,
    plan_name AS planName,
    amount,
    currency,
    gst_percentage AS gstPercentage,
    offer_tag AS offerTag,
    button_label AS buttonLabel,
    display_order AS displayOrder,
    is_active AS isActive,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM cibil_repair_plans`;
}

function timelineSelect() {
  return `SELECT
    public_id AS publicId,
    title,
    description,
    display_order AS displayOrder,
    is_active AS isActive,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM cibil_repair_timelines`;
}

async function listActiveCibilRepairContent() {
  const [[plans], [timelines]] = await Promise.all([
    pool.query(
      `${planSelect()}
      WHERE is_active = 1
      ORDER BY display_order ASC, amount ASC, id ASC`
    ),
    pool.query(
      `${timelineSelect()}
      WHERE is_active = 1
      ORDER BY display_order ASC, id ASC`
    )
  ]);

  return {
    plans: plans.map(mapPlan),
    timelines: timelines.map(mapTimeline)
  };
}

async function listAllCibilRepairContent() {
  const [[plans], [timelines]] = await Promise.all([
    pool.query(
      `${planSelect()}
      ORDER BY display_order ASC, amount ASC, id ASC`
    ),
    pool.query(
      `${timelineSelect()}
      ORDER BY display_order ASC, id ASC`
    )
  ]);

  return {
    plans: plans.map(mapPlan),
    timelines: timelines.map(mapTimeline)
  };
}

async function replaceCibilRepairContent({ plans, timelines }) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.query("DELETE FROM cibil_repair_plans");
    await connection.query("DELETE FROM cibil_repair_timelines");

    if (plans.length > 0) {
      await connection.query(
        `INSERT INTO cibil_repair_plans (
          public_id,
          plan_name,
          amount,
          currency,
          gst_percentage,
          offer_tag,
          button_label,
          display_order,
          is_active
        )
        VALUES ?`,
        [
          plans.map((plan) => [
            plan.publicId || randomUUID(),
            plan.planName,
            plan.amount,
            plan.currency,
            plan.gstPercentage,
            plan.offerTag,
            plan.buttonLabel,
            plan.displayOrder,
            plan.isActive
          ])
        ]
      );
    }

    if (timelines.length > 0) {
      await connection.query(
        `INSERT INTO cibil_repair_timelines (
          public_id,
          title,
          description,
          display_order,
          is_active
        )
        VALUES ?`,
        [
          timelines.map((timeline) => [
            timeline.publicId || randomUUID(),
            timeline.title,
            timeline.description,
            timeline.displayOrder,
            timeline.isActive
          ])
        ]
      );
    }

    await connection.commit();

    return listAllCibilRepairContent();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  listActiveCibilRepairContent,
  listAllCibilRepairContent,
  replaceCibilRepairContent
};
