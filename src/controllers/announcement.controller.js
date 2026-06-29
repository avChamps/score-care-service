const {
  createAnnouncement,
  deleteAnnouncementByPublicId,
  listAnnouncements,
  updateAnnouncementByPublicId
} = require("../models/announcement.model");

function normalizeString(value) {
  return String(value || "").trim();
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return date.toISOString().slice(0, 10) === value;
}

function validateAnnouncementPayload(body) {
  const errors = [];
  const title = normalizeString(body.title);
  const startDate = normalizeString(body.startDate);
  const endDate = normalizeString(body.endDate);

  if (!title) {
    errors.push("title is required");
  }

  if (!isValidDate(startDate)) {
    errors.push("startDate must be a valid date in YYYY-MM-DD format");
  }

  if (!isValidDate(endDate)) {
    errors.push("endDate must be a valid date in YYYY-MM-DD format");
  }

  if (isValidDate(startDate) && isValidDate(endDate) && endDate < startDate) {
    errors.push("endDate must be greater than or equal to startDate");
  }

  return {
    errors,
    value: {
      title,
      startDate,
      endDate
    }
  };
}

async function getAdminAnnouncements(req, res, next) {
  try {
    const data = await listAnnouncements({
      page: req.query.page,
      limit: req.query.limit
    });

    return res.status(200).json({
      status: "success",
      data
    });
  } catch (error) {
    next(error);
  }
}

async function createAdminAnnouncement(req, res, next) {
  try {
    const { errors, value } = validateAnnouncementPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const announcement = await createAnnouncement(value);

    return res.status(201).json({
      status: "success",
      message: "Announcement created successfully",
      data: announcement
    });
  } catch (error) {
    next(error);
  }
}

async function updateAdminAnnouncement(req, res, next) {
  try {
    const { errors, value } = validateAnnouncementPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const announcement = await updateAnnouncementByPublicId(req.params.publicId, value);

    if (!announcement) {
      return res.status(404).json({
        status: "error",
        message: "Announcement not found"
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Announcement updated successfully",
      data: announcement
    });
  } catch (error) {
    next(error);
  }
}

async function deleteAdminAnnouncement(req, res, next) {
  try {
    const deleted = await deleteAnnouncementByPublicId(req.params.publicId);

    if (!deleted) {
      return res.status(404).json({
        status: "error",
        message: "Announcement not found"
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Announcement deleted successfully"
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createAdminAnnouncement,
  deleteAdminAnnouncement,
  getAdminAnnouncements,
  updateAdminAnnouncement
};
