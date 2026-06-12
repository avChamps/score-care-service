const { randomUUID } = require("crypto");

const { pool } = require("../config/db");

function mapFaq(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.publicId,
    publicId: row.publicId,
    category: row.category,
    categoryLabel: row.categoryLabel,
    icon: row.icon,
    question: row.question,
    answer: row.answer,
    displayOrder: row.displayOrder,
    isActive:
      row.isActive === undefined || row.isActive === null
        ? undefined
        : Boolean(row.isActive),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function faqSelect() {
  return `SELECT
    public_id AS publicId,
    category,
    category_label AS categoryLabel,
    icon,
    question,
    answer,
    display_order AS displayOrder,
    is_active AS isActive,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM faqs`;
}

function groupFaqsByCategory(faqs) {
  const categoryMap = new Map();

  faqs.forEach((faq) => {
    if (!categoryMap.has(faq.category)) {
      categoryMap.set(faq.category, {
        category: faq.category,
        categoryLabel: faq.categoryLabel,
        icon: faq.icon,
        questions: []
      });
    }

    categoryMap.get(faq.category).questions.push({
      id: faq.id,
      publicId: faq.publicId,
      question: faq.question,
      answer: faq.answer,
      displayOrder: faq.displayOrder,
      isActive: faq.isActive
    });
  });

  return Array.from(categoryMap.values());
}

async function listActiveFaqs() {
  const [rows] = await pool.query(
    `${faqSelect()}
    WHERE is_active = 1
    ORDER BY category ASC, display_order ASC, id ASC`
  );

  return groupFaqsByCategory(rows.map(mapFaq));
}

async function listAllFaqs() {
  const [rows] = await pool.query(
    `${faqSelect()}
    ORDER BY category ASC, display_order ASC, id ASC`
  );

  return groupFaqsByCategory(rows.map(mapFaq));
}

async function replaceFaqs(faqs) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.query("DELETE FROM faqs");

    if (faqs.length > 0) {
      await connection.query(
        `INSERT INTO faqs (
          public_id,
          category,
          category_label,
          icon,
          question,
          answer,
          display_order,
          is_active
        )
        VALUES ?`,
        [
          faqs.map((faq) => [
            faq.publicId || randomUUID(),
            faq.category,
            faq.categoryLabel,
            faq.icon,
            faq.question,
            faq.answer,
            faq.displayOrder,
            faq.isActive
          ])
        ]
      );
    }

    await connection.commit();

    return listAllFaqs();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  listActiveFaqs,
  listAllFaqs,
  replaceFaqs
};
