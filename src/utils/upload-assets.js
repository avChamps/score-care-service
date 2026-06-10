const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const multer = require("multer");
const SftpClient = require("ssh2-sftp-client");

const env = require("../config/env");

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const uploadFields = [
  { name: "salarySlips", maxCount: 8 },
  { name: "bankStatements", maxCount: 3 },
  { name: "aadhaarCard", maxCount: 2 },
  { name: "aadharCard", maxCount: 2 },
  { name: "addharCard", maxCount: 2 },
  { name: "panCard", maxCount: 2 },
  { name: "pancard", maxCount: 2 }
];

function sanitizePathSegment(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "");
}

function sanitizeFileBaseName(fileName) {
  const parsed = path.parse(fileName || "file");
  const baseName = parsed.name
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return baseName || "file";
}

function getPublicIdFromRequest(req) {
  return sanitizePathSegment(req.auth?.userId || req.auth?.publicId);
}

function buildFileName(file) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(8).toString("hex");
  const safeBaseName = sanitizeFileBaseName(file.originalname);

  return `${timestamp}-${randomSuffix}-${safeBaseName}${ext}`;
}

function getRelativePath(publicId, fileName) {
  return path.posix.join(publicId, "files", fileName);
}

function getPublicUrl(relativePath) {
  const baseUrl = env.assets.publicBaseUrl.replace(/\/+$/, "");

  return `${baseUrl}/${relativePath}`;
}

function getLocalPath(relativePath) {
  return path.join(env.assets.rootDir, relativePath);
}

function getSftpRemotePath(relativePath) {
  const rootDir = env.assets.sftp.rootDir.replace(/\/+$/, "");

  return path.posix.join(rootDir, relativePath);
}

function mapSavedFile(file, fileName, relativePath) {
  return {
    fieldName: file.fieldname,
    originalName: file.originalname,
    fileName,
    mimeType: file.mimetype,
    size: file.size,
    relativePath,
    url: getPublicUrl(relativePath)
  };
}

function flattenUploadedFiles(filesByField = {}) {
  return Object.values(filesByField).flat();
}

function flattenSavedDocuments(documents = {}) {
  return Object.values(documents).flat();
}

async function getSftpConfig() {
  const config = {
    host: env.assets.sftp.host,
    port: env.assets.sftp.port,
    username: env.assets.sftp.username
  };

  if (!config.host || !config.username) {
    const error = new Error("SFTP host and username are required for asset uploads");
    error.statusCode = 503;
    throw error;
  }

  if (env.assets.sftp.privateKeyPath) {
    config.privateKey = await fs.readFile(env.assets.sftp.privateKeyPath);
  } else if (env.assets.sftp.password) {
    config.password = env.assets.sftp.password;
  } else {
    const error = new Error("SFTP password or private key is required for asset uploads");
    error.statusCode = 503;
    throw error;
  }

  return config;
}

async function withSftp(callback) {
  const sftp = new SftpClient();

  try {
    await sftp.connect(await getSftpConfig());
    return await callback(sftp);
  } finally {
    await sftp.end().catch(() => null);
  }
}

async function saveFileLocally(publicId, file) {
  const fileName = buildFileName(file);
  const relativePath = getRelativePath(publicId, fileName);
  const fullPath = getLocalPath(relativePath);

  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, file.buffer);

  return mapSavedFile(file, fileName, relativePath);
}

async function saveFilesLocally(publicId, files) {
  const savedFiles = [];

  try {
    for (const file of files) {
      savedFiles.push(await saveFileLocally(publicId, file));
    }
  } catch (error) {
    await Promise.all(
      savedFiles.map((file) => fs.unlink(getLocalPath(file.relativePath)).catch(() => null))
    );
    throw error;
  }

  return savedFiles;
}

async function saveFilesToSftp(publicId, files) {
  return withSftp(async (sftp) => {
    const savedFiles = [];
    const remoteDir = getSftpRemotePath(path.posix.join(publicId, "files"));

    await sftp.mkdir(remoteDir, true);

    try {
      for (const file of files) {
        const fileName = buildFileName(file);
        const relativePath = getRelativePath(publicId, fileName);
        const remotePath = getSftpRemotePath(relativePath);

        await sftp.put(file.buffer, remotePath);
        savedFiles.push(mapSavedFile(file, fileName, relativePath));
      }
    } catch (error) {
      await Promise.all(
        savedFiles.map((file) => sftp.delete(getSftpRemotePath(file.relativePath)).catch(() => null))
      );
      throw error;
    }

    return savedFiles;
  });
}

async function saveUploadedFiles(publicId, filesByField = {}) {
  const files = flattenUploadedFiles(filesByField);

  if (env.assets.storageDriver === "sftp") {
    return saveFilesToSftp(publicId, files);
  }

  return saveFilesLocally(publicId, files);
}

async function deleteSavedFiles(documents = {}) {
  const files = flattenSavedDocuments(documents);

  if (files.length === 0) {
    return;
  }

  if (env.assets.storageDriver === "sftp") {
    await withSftp(async (sftp) => {
      await Promise.all(
        files.map((file) => sftp.delete(getSftpRemotePath(file.relativePath)).catch(() => null))
      );
    });
    return;
  }

  await Promise.all(
    files.map((file) => fs.unlink(getLocalPath(file.relativePath)).catch(() => null))
  );
}

async function readSavedFile(relativePath) {
  if (env.assets.storageDriver === "sftp") {
    return withSftp((sftp) => sftp.get(getSftpRemotePath(relativePath)));
  }

  return fs.readFile(getLocalPath(relativePath));
}

const assetUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter(_req, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      const error = new Error("Only image and PDF uploads are allowed");
      error.statusCode = 400;
      callback(error);
      return;
    }

    callback(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 15
  }
});

function handleMulterError(error, _req, res, next) {
  if (!error) {
    return next();
  }

  if (error instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: "Each uploaded file must be 10MB or smaller",
      LIMIT_FILE_COUNT: "Too many uploaded files",
      LIMIT_UNEXPECTED_FILE: "Unexpected upload field or too many files for a field"
    };

    return res.status(400).json({
      status: "error",
      message: messages[error.code] || error.message
    });
  }

  return res.status(error.statusCode || 500).json({
    status: "error",
    message: error.statusCode ? error.message : "File upload failed",
    details:
      process.env.NODE_ENV === "production"
        ? undefined
        : error.message
  });
}

function loanApplicationUpload(req, res, next) {
  assetUpload.fields(uploadFields)(req, res, (error) => {
    if (error) {
      return handleMulterError(error, req, res, next);
    }

    return next();
  });
}

module.exports = {
  deleteSavedFiles,
  getPublicIdFromRequest,
  loanApplicationUpload,
  readSavedFile,
  saveUploadedFiles,
  uploadFields
};
