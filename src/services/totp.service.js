const {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual
} = require("crypto");

const env = require("../config/env");

const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const digits = 6;
const period = 30;

function encodeBase32(buffer) {
  let bits = "";
  let result = "";

  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, "0");
  }

  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5).padEnd(5, "0");
    result += base32Alphabet[Number.parseInt(chunk, 2)];
  }

  return result;
}

function decodeBase32(value) {
  const normalized = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, "");
  let bits = "";

  for (const character of normalized) {
    const index = base32Alphabet.indexOf(character);

    if (index === -1) {
      throw new Error("Invalid TOTP secret");
    }

    bits += index.toString(2).padStart(5, "0");
  }

  const bytes = [];

  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }

  return Buffer.from(bytes);
}

function getEncryptionKey() {
  return createHash("sha256").update(env.jwt.secret).digest();
}

function encryptTotpSecret(secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, encrypted]
    .map((value) => value.toString("base64url"))
    .join(".");
}

function decryptTotpSecret(encryptedSecret) {
  const [ivValue, authTagValue, encryptedValue] = String(encryptedSecret || "").split(".");

  if (!ivValue || !authTagValue || !encryptedValue) {
    throw new Error("Invalid encrypted TOTP secret");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivValue, "base64url")
  );
  decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

function generateTotpSecret() {
  return encodeBase32(randomBytes(20));
}

function generateTotpCode(secret, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", decodeBase32(secret))
    .update(counter)
    .digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);

  return String(binary % (10 ** digits)).padStart(digits, "0");
}

function findMatchingTotpStep(secret, code, now = Date.now()) {
  const normalizedCode = String(code || "").trim();

  if (!/^\d{6}$/.test(normalizedCode)) {
    return null;
  }

  const currentStep = Math.floor(now / 1000 / period);
  const provided = Buffer.from(normalizedCode);

  for (const offset of [-1, 0, 1]) {
    const step = currentStep + offset;
    const expected = Buffer.from(generateTotpCode(secret, step));

    if (provided.length === expected.length && timingSafeEqual(provided, expected)) {
      return step;
    }
  }

  return null;
}

function createTotpAuthUrl(secret, accountName) {
  const issuer = "ScoreCare";
  const label = encodeURIComponent(`${issuer}:${accountName}`);

  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${digits}&period=${period}`;
}

module.exports = {
  createTotpAuthUrl,
  decryptTotpSecret,
  encryptTotpSecret,
  findMatchingTotpStep,
  generateTotpSecret
};
