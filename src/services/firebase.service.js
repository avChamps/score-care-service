const admin = require("firebase-admin");

const env = require("../config/env");

function getServiceAccount() {
  if (env.firebase.serviceAccountBase64) {
    return JSON.parse(
      Buffer.from(env.firebase.serviceAccountBase64, "base64").toString("utf8")
    );
  }

  if (
    env.firebase.projectId &&
    env.firebase.clientEmail &&
    env.firebase.privateKey
  ) {
    return {
      project_id: env.firebase.projectId,
      client_email: env.firebase.clientEmail,
      private_key: env.firebase.privateKey
    };
  }

  const error = new Error("Firebase service account environment variables are required");
  error.statusCode = 500;
  throw error;
}

function getFirebaseApp() {
  if (admin.apps.length) {
    return admin.app();
  }

  return admin.initializeApp({
    credential: admin.credential.cert(getServiceAccount())
  });
}

function getMessaging() {
  return getFirebaseApp().messaging();
}

module.exports = {
  getMessaging
};
