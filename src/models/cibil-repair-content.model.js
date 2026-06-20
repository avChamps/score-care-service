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

async function patchCibilRepairContent({ plans = [], timelines = [] }) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    for (const plan of plans) {
      const canRenamePlan =
        plan.publicId || plan.currentPlanName || plan.currentDisplayOrder !== undefined;
      const entries = Object.entries({
        plan_name: canRenamePlan ? plan.planName : undefined,
        amount: plan.amount,
        currency: plan.currency,
        gst_percentage: plan.gstPercentage,
        offer_tag: plan.offerTag,
        button_label: plan.buttonLabel,
        display_order: plan.displayOrder,
        is_active: plan.isActive
      }).filter(([, value]) => value !== undefined);

      if (entries.length === 0) {
        continue;
      }

      const whereClause = plan.publicId
        ? "public_id = ?"
        : plan.currentPlanName
          ? "plan_name = ?"
          : plan.currentDisplayOrder !== undefined
            ? "display_order = ?"
            : "plan_name = ?";
      const whereValue = plan.publicId
        || plan.currentPlanName
        || (plan.currentDisplayOrder !== undefined
          ? plan.currentDisplayOrder
          : plan.planName);
      const setClause = entries.map(([column]) => `${column} = ?`).join(", ");

      await connection.query(
        `UPDATE cibil_repair_plans
        SET ${setClause},
          updated_at = NOW()
        WHERE ${whereClause}`,
        [...entries.map(([, value]) => value), whereValue]
      );
    }

    for (const timeline of timelines) {
      const entries = Object.entries({
        title: timeline.title,
        description: timeline.description,
        display_order: timeline.displayOrder,
        is_active: timeline.isActive
      }).filter(([, value]) => value !== undefined);

      if (entries.length === 0) {
        continue;
      }

      const whereClause = timeline.publicId ? "public_id = ?" : "display_order = ?";
      const whereValue = timeline.publicId || timeline.currentDisplayOrder;
      const setClause = entries.map(([column]) => `${column} = ?`).join(", ");

      await connection.query(
        `UPDATE cibil_repair_timelines
        SET ${setClause},
          updated_at = NOW()
        WHERE ${whereClause}`,
        [...entries.map(([, value]) => value), whereValue]
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

async function createCibilRepairTimeline(timeline) {
  const publicId = timeline.publicId || randomUUID();

  await pool.query(
    `INSERT INTO cibil_repair_timelines (
      public_id,
      title,
      description,
      display_order,
      is_active
    )
    VALUES (?, ?, ?, ?, ?)`,
    [
      publicId,
      timeline.title,
      timeline.description,
      timeline.displayOrder,
      timeline.isActive
    ]
  );

  return listAllCibilRepairContent();
}

async function updateCibilRepairTimeline(publicId, timeline) {
  const entries = Object.entries({
    title: timeline.title,
    description: timeline.description,
    display_order: timeline.displayOrder,
    is_active: timeline.isActive
  }).filter(([, value]) => value !== undefined);

  if (entries.length === 0) {
    return listAllCibilRepairContent();
  }

  const setClause = entries.map(([column]) => `${column} = ?`).join(", ");
  const [result] = await pool.query(
    `UPDATE cibil_repair_timelines
    SET ${setClause},
      updated_at = NOW()
    WHERE public_id = ?`,
    [...entries.map(([, value]) => value), publicId]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return listAllCibilRepairContent();
}

async function deleteCibilRepairTimeline(publicId) {
  const [result] = await pool.query(
    "DELETE FROM cibil_repair_timelines WHERE public_id = ?",
    [publicId]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return listAllCibilRepairContent();
}

module.exports = {
  createCibilRepairTimeline,
  deleteCibilRepairTimeline,
  listActiveCibilRepairContent,
  listAllCibilRepairContent,
  patchCibilRepairContent,
  replaceCibilRepairContent,
  updateCibilRepairTimeline
};
