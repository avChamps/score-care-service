const {
  listActiveFaqs,
  listAllFaqs,
  replaceFaqs
} = require("../models/faq.model");

async function getFaqs(_req, res, next) {
  try {
    const categories = await listActiveFaqs();

    return res.status(200).json({
      status: "success",
      data: {
        categories
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getAllFaqs(_req, res, next) {
  try {
    const categories = await listAllFaqs();

    return res.status(200).json({
      status: "success",
      data: {
        categories
      }
    });
  } catch (error) {
    next(error);
  }
}

function normalizeString(value) {
  return String(value || "").trim();
}

function parseOptionalBoolean(value) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (value === 1 || value === "1" || value === "true") {
    return true;
  }

  if (value === 0 || value === "0" || value === "false") {
    return false;
  }

  return null;
}

function validateFaqsPayload(body) {
  const errors = [];

  if (!Array.isArray(body.categories)) {
    return {
      errors: ["categories must be an array"],
      value: []
    };
  }

  const value = body.categories.flatMap((category, categoryIndex) => {
    const categoryKey = normalizeString(category.category);
    const categoryLabel = normalizeString(category.categoryLabel);
    const icon = normalizeString(category.icon);

    if (!categoryKey) {
      errors.push(`categories[${categoryIndex}].category is required`);
    }

    if (!categoryLabel) {
      errors.push(`categories[${categoryIndex}].categoryLabel is required`);
    }

    if (!Array.isArray(category.questions)) {
      errors.push(`categories[${categoryIndex}].questions must be an array`);
      return [];
    }

    return category.questions.map((faq, faqIndex) => {
      const question = normalizeString(faq.question);
      const answer = normalizeString(faq.answer);
      const displayOrder =
        faq.displayOrder === undefined ? faqIndex + 1 : Number(faq.displayOrder);
      const isActive =
        faq.isActive === undefined ? true : parseOptionalBoolean(faq.isActive);

      if (!question) {
        errors.push(
          `categories[${categoryIndex}].questions[${faqIndex}].question is required`
        );
      }

      if (!answer) {
        errors.push(
          `categories[${categoryIndex}].questions[${faqIndex}].answer is required`
        );
      }

      if (!Number.isInteger(displayOrder) || displayOrder < 0) {
        errors.push(
          `categories[${categoryIndex}].questions[${faqIndex}].displayOrder must be a non-negative integer`
        );
      }

      if (isActive === null) {
        errors.push(
          `categories[${categoryIndex}].questions[${faqIndex}].isActive must be a boolean`
        );
      }

      return {
        publicId: normalizeString(faq.publicId || faq.id) || undefined,
        category: categoryKey,
        categoryLabel,
        icon,
        question,
        answer,
        displayOrder,
        isActive
      };
    });
  });

  return { errors, value };
}

async function saveFaqs(req, res, next) {
  try {
    const { errors, value } = validateFaqsPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const categories = await replaceFaqs(value);

    return res.status(200).json({
      status: "success",
      message: "FAQs updated successfully",
      data: {
        categories
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllFaqs,
  getFaqs,
  saveFaqs
};
