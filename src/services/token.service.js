const jwt = require("jsonwebtoken");

const env = require("../config/env");

function createAuthToken(payload) {
  return jwt.sign(payload, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn
  });
}

function verifyAuthToken(token) {
  return jwt.verify(token, env.jwt.secret);
}

module.exports = {
  createAuthToken,
  verifyAuthToken
};
