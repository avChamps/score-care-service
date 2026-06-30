const { randomUUID } = require("crypto");
const { pool } = require("../config/db");

function mapUser(row) {
  if (!row) {
    return null;
  }

  const user = {
    id: row.publicId,
    publicId: row.publicId,
    mobileNumber: row.mobileNumber,
    panNumber: row.panNumber,
    fullName: row.fullName,
    email: row.email,
    dateOfBirth: row.dateOfBirth,
    selectedLanguage: row.selectedLanguage || "English",
    whatsappAlertsEnabled: row.whatsappAlertsEnabled === undefined
      ? true
      : Boolean(row.whatsappAlertsEnabled),
    isAdmin: Boolean(row.isAdmin),
    accessType: row.accessType,
    subscriptionStatus: row.subscriptionStatus,
    subscriptionStartedAt: row.subscriptionStartedAt,
    subscriptionDueAt: row.subscriptionDueAt,
    subscriptionEndsAt: row.subscriptionEndsAt,
    status: row.status,
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };

  Object.defineProperty(user, "internalId", {
    value: row.internalId,
    enumerable: false
  });

  return user;
}

async function findUserById(id) {
  const [rows] = await pool.query(
    `SELECT
      id AS internalId,
      public_id AS publicId,
      mobile_number AS mobileNumber,
      pan_number AS panNumber,
      full_name AS fullName,
      email,
      date_of_birth AS dateOfBirth,
      selected_language AS selectedLanguage,
      whatsapp_alerts_enabled AS whatsappAlertsEnabled,
      is_admin AS isAdmin,
      CASE
        WHEN subscription_status IN ('active', 'cancelled')
          AND (subscription_due_at IS NULL OR subscription_due_at >= NOW())
        THEN 'paid'
        ELSE 'free'
      END AS accessType,
      subscription_status AS subscriptionStatus,
      subscription_started_at AS subscriptionStartedAt,
      subscription_due_at AS subscriptionDueAt,
      subscription_ends_at AS subscriptionEndsAt,
      status,
      last_login_at AS lastLoginAt,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM users
    WHERE id = ?`,
    [id]
  );

  return mapUser(rows[0]);
}

async function findUserByPublicId(publicId) {
  const [rows] = await pool.query(
    `SELECT
      id AS internalId,
      public_id AS publicId,
      mobile_number AS mobileNumber,
      pan_number AS panNumber,
      full_name AS fullName,
      email,
      date_of_birth AS dateOfBirth,
      selected_language AS selectedLanguage,
      whatsapp_alerts_enabled AS whatsappAlertsEnabled,
      is_admin AS isAdmin,
      CASE
        WHEN subscription_status IN ('active', 'cancelled')
          AND (subscription_due_at IS NULL OR subscription_due_at >= NOW())
        THEN 'paid'
        ELSE 'free'
      END AS accessType,
      subscription_status AS subscriptionStatus,
      subscription_started_at AS subscriptionStartedAt,
      subscription_due_at AS subscriptionDueAt,
      subscription_ends_at AS subscriptionEndsAt,
      status,
      last_login_at AS lastLoginAt,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM users
    WHERE public_id = ?`,
    [publicId]
  );

  return mapUser(rows[0]);
}

async function deleteUserById(userId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      "DELETE FROM credit_disputes WHERE user_id = ?",
      [userId]
    );
    await connection.query(
      "UPDATE loan_applications SET updated_by_user_id = NULL WHERE updated_by_user_id = ?",
      [userId]
    );
    await connection.query(
      "UPDATE subscription_payments SET updated_by_user_id = NULL WHERE updated_by_user_id = ?",
      [userId]
    );

    const [result] = await connection.query(
      "DELETE FROM users WHERE id = ?",
      [userId]
    );

    await connection.commit();

    return result.affectedRows > 0;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function findUserByMobileNumber(mobileNumber) {
  const [rows] = await pool.query(
    `SELECT
      id AS internalId,
      public_id AS publicId,
      mobile_number AS mobileNumber,
      pan_number AS panNumber,
      full_name AS fullName,
      email,
      date_of_birth AS dateOfBirth,
      selected_language AS selectedLanguage,
      whatsapp_alerts_enabled AS whatsappAlertsEnabled,
      is_admin AS isAdmin,
      CASE
        WHEN subscription_status IN ('active', 'cancelled')
          AND (subscription_due_at IS NULL OR subscription_due_at >= NOW())
        THEN 'paid'
        ELSE 'free'
      END AS accessType,
      subscription_status AS subscriptionStatus,
      subscription_started_at AS subscriptionStartedAt,
      subscription_due_at AS subscriptionDueAt,
      subscription_ends_at AS subscriptionEndsAt,
      status,
      last_login_at AS lastLoginAt,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM users
    WHERE mobile_number = ?`,
    [mobileNumber]
  );

  return mapUser(rows[0]);
}

async function upsertUserForLogin(user) {
  const normalizedPan = user.panNumber.toUpperCase();

  const [result] = await pool.query(
    `INSERT INTO users (
      mobile_number,
      public_id,
      pan_number,
      full_name,
      email,
      date_of_birth,
      last_login_at
    )
    VALUES (?, ?, ?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      full_name = VALUES(full_name),
      email = VALUES(email),
      date_of_birth = VALUES(date_of_birth),
      last_login_at = NOW(),
      updated_at = NOW()`,
    [
      user.mobileNumber,
      randomUUID(),
      normalizedPan,
      user.fullName,
      user.email || null,
      user.dateOfBirth || null
    ]
  );

  const userId = result.insertId || await findUserIdByMobileNumberOrPan(
    user.mobileNumber,
    normalizedPan
  );

  const savedUser = await findUserById(userId);

  return {
    user: savedUser,
    isNewUser: result.affectedRows === 1
  };
}

async function upsertUserForOtpLogin(mobileNumber) {
  const [result] = await pool.query(
    `INSERT INTO users (
      mobile_number,
      public_id,
      last_login_at
    )
    VALUES (?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      last_login_at = NOW(),
      updated_at = NOW()`,
    [mobileNumber, randomUUID()]
  );

  const userId = result.insertId || await findUserIdByMobileNumber(mobileNumber);
  const savedUser = await findUserById(userId);

  return {
    user: savedUser,
    isNewUser: result.affectedRows === 1
  };
}

async function updateUserProfile(userId, profile) {
  const [result] = await pool.query(
    `UPDATE users
    SET
      pan_number = ?,
      full_name = ?,
      email = COALESCE(?, email),
      date_of_birth = COALESCE(?, date_of_birth),
      selected_language = COALESCE(?, selected_language),
      updated_at = NOW()
    WHERE id = ?`,
    [
      profile.panNumber.toUpperCase(),
      profile.fullName,
      profile.email || null,
      profile.dateOfBirth || null,
      profile.selectedLanguage || null,
      userId
    ]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return findUserById(userId);
}

async function updateUserSelectedLanguage(userId, selectedLanguage) {
  const [result] = await pool.query(
    `UPDATE users
    SET
      selected_language = ?,
      updated_at = NOW()
    WHERE id = ?`,
    [selectedLanguage, userId]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return findUserById(userId);
}

async function getUserNotificationPreferences(userId) {
  try {
    const [rows] = await pool.query(
      `SELECT whatsapp_alerts_enabled AS whatsappAlertsEnabled
      FROM users
      WHERE id = ?`,
      [userId]
    );

    return {
      whatsappAlertsEnabled: rows[0]?.whatsappAlertsEnabled === undefined ||
        rows[0]?.whatsappAlertsEnabled === null
        ? true
        : Boolean(rows[0].whatsappAlertsEnabled)
    };
  } catch (error) {
    if (error.code === "ER_BAD_FIELD_ERROR") {
      return {
        whatsappAlertsEnabled: true
      };
    }

    throw error;
  }
}

async function updateUserNotificationPreferences(userId, preferences) {
  const [result] = await pool.query(
    `UPDATE users
    SET
      whatsapp_alerts_enabled = ?,
      updated_at = NOW()
    WHERE id = ?`,
    [preferences.whatsappAlertsEnabled ? 1 : 0, userId]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return getUserNotificationPreferences(userId);
}

async function shouldSendUserWhatsappAlert(userId) {
  const preferences = await getUserNotificationPreferences(userId);

  return preferences.whatsappAlertsEnabled;
}

async function hasWelcomeEmailBeenSent(userId) {
  try {
    const [rows] = await pool.query(
      `SELECT welcome_email_sent_at AS welcomeEmailSentAt
      FROM users
      WHERE id = ?`,
      [userId]
    );

    return Boolean(rows[0]?.welcomeEmailSentAt);
  } catch (error) {
    if (error.code === "ER_BAD_FIELD_ERROR") {
      return false;
    }

    throw error;
  }
}

async function markWelcomeEmailSent(userId) {
  try {
    const [result] = await pool.query(
      `UPDATE users
      SET
        welcome_email_sent_at = NOW(),
        updated_at = NOW()
      WHERE id = ?
        AND welcome_email_sent_at IS NULL`,
      [userId]
    );

    return result.affectedRows > 0;
  } catch (error) {
    if (error.code === "ER_BAD_FIELD_ERROR") {
      return false;
    }

    throw error;
  }
}

async function findUserIdByMobileNumber(mobileNumber) {
  const [rows] = await pool.query(
    "SELECT id FROM users WHERE mobile_number = ?",
    [mobileNumber]
  );

  return rows[0]?.id;
}

async function findUserIdByMobileNumberOrPan(mobileNumber, panNumber) {
  const [rows] = await pool.query(
    "SELECT id FROM users WHERE mobile_number = ? OR pan_number = ?",
    [mobileNumber, panNumber]
  );

  return rows[0]?.id;
}

async function createLoginEvent(user, login) {
  const [result] = await pool.query(
    `INSERT INTO user_login_events (
      user_id,
      mobile_number,
      pan_number,
      login_method,
      login_status,
      ip_address,
      user_agent,
      device_id,
      metadata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.internalId,
      user.mobileNumber,
      user.panNumber || null,
      login.loginMethod || "otp",
      login.loginStatus || "success",
      login.ipAddress || null,
      login.userAgent || null,
      login.deviceId || null,
      login.metadata ? JSON.stringify(login.metadata) : null
    ]
  );

  return result.insertId;
}

async function listLoginEventsByUserId(userId, limit = 20) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const [rows] = await pool.query(
    `SELECT
      ule.id,
      u.public_id AS userId,
      mobile_number AS mobileNumber,
      pan_number AS panNumber,
      login_method AS loginMethod,
      login_status AS loginStatus,
      ip_address AS ipAddress,
      user_agent AS userAgent,
      device_id AS deviceId,
      metadata,
      logged_in_at AS loggedInAt
    FROM user_login_events ule
    INNER JOIN users u ON u.id = ule.user_id
    WHERE ule.user_id = ?
    ORDER BY logged_in_at DESC
    LIMIT ?`,
    [userId, safeLimit]
  );

  return rows;
}

module.exports = {
  createLoginEvent,
  deleteUserById,
  findUserById,
  findUserByMobileNumber,
  findUserByPublicId,
  getUserNotificationPreferences,
  hasWelcomeEmailBeenSent,
  listLoginEventsByUserId,
  markWelcomeEmailSent,
  shouldSendUserWhatsappAlert,
  updateUserNotificationPreferences,
  updateUserSelectedLanguage,
  updateUserProfile,
  upsertUserForOtpLogin,
  upsertUserForLogin
};
