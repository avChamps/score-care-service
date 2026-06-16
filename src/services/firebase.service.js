const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getMessaging: getFirebaseMessaging } = require("firebase-admin/messaging");

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
  const apps = getApps();

  if (apps.length) {
    return apps[0];
  }

  return initializeApp({
    credential: cert(getServiceAccount())
  });
}

function getMessaging() {
  return getFirebaseMessaging(getFirebaseApp());
}

module.exports = {
  getMessaging
};
