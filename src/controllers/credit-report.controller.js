const { execFile } = require("child_process");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const puppeteer = require("puppeteer");
const { promisify } = require("util");

const {
  fetchCibilCreditReport,
  fetchCrifCreditReport,
  fetchCrifCreditScore,
} = require("../services/surepass.service");
const {
  findCibilReportByUserId,
  findCrifReportByUserId,
  findCrifScoreByUserId,
  findLatestSavedCreditReportByUserId,
  listCreditReportDownloadsByUserId,
  saveCibilReport,
  saveCrifReport,
  saveCrifScore,
  saveCibilReportPdfBase64,
  saveCreditReportDownload
} = require("../models/credit-report.model");
const {
  findUserById
} = require("../models/user.model");

const mobilePattern = /^[6-9]\d{9}$/;
const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const allowedGenders = new Set(["male", "female"]);
const execFileAsync = promisify(execFile);

function getAuthInternalUserId(req) {
  return req.auth.internalUserId || req.auth.userId;
}

function normalizeConsent(consent) {
  if (consent === true) {
    return "Y";
  }

  return String(consent || "").trim().toUpperCase();
}

function validateCibilReportPayload(body) {
  const errors = [];
  const mobile = String(body.mobile || body.mobileNumber || "").trim();
  const pan = String(body.pan || body.panNumber || "").trim().toUpperCase();
  const name = String(body.name || body.fullName || "").trim();
  const gender = String(body.gender || "").trim().toLowerCase();
  const consent = normalizeConsent(body.consent);

  if (!mobilePattern.test(mobile)) {
    errors.push("Valid 10 digit Indian mobile number is required");
  }

  if (!panPattern.test(pan)) {
    errors.push("Valid PAN number is required");
  }

  if (name.length < 2) {
    errors.push("Full name is required");
  }

  if (!allowedGenders.has(gender)) {
    errors.push("Gender must be male or female");
  }

  if (consent !== "Y") {
    errors.push("User consent is required");
  }

  return {
    errors,
    value: {
      mobile,
      pan,
      name,
      gender,
      consent
    }
  };
}

function validateExperianPayload(body) {
  const errors = [];
  const mobile = String(body.mobile || body.mobileNumber || "").trim();
  const pan = String(body.pan || body.panNumber || "").trim().toUpperCase();
  const name = String(body.name || body.fullName || "").trim();
  const consent = normalizeConsent(body.consent);

  if (!mobilePattern.test(mobile)) {
    errors.push("Valid 10 digit Indian mobile number is required");
  }

  if (!panPattern.test(pan)) {
    errors.push("Valid PAN number is required");
  }

  if (name.length < 2) {
    errors.push("Full name is required");
  }

  if (consent !== "Y") {
    errors.push("User consent is required");
  }

  return {
    errors,
    value: {
      mobile,
      pan,
      name,
      consent
    }
  };
}

function buildCrifScorePayloadFromUser(user) {
  const nameParts = String(user.fullName || "").trim().split(/\s+/).filter(Boolean);

  return {
    first_name: nameParts[0] || "",
    last_name: nameParts.slice(1).join(" "),
    mobile: user.mobileNumber,
    consent: "Y",
    pan: user.panNumber
  };
}

function validateCrifScorePayload(body) {
  const errors = [];
  const firstName = String(body.first_name || "").trim();
  const lastName = String(body.last_name || "").trim();
  const mobile = String(body.mobile || "").trim();
  const pan = String(body.pan || "").trim().toUpperCase();
  const consent = normalizeConsent(body.consent);

  if (firstName.length < 2) {
    errors.push("First name is required");
  }

  if (lastName.length < 1) {
    errors.push("Last name is required");
  }

  if (!mobilePattern.test(mobile)) {
    errors.push("Valid 10 digit Indian mobile number is required");
  }

  if (!panPattern.test(pan)) {
    errors.push("Valid PAN number is required");
  }

  if (consent !== "Y") {
    errors.push("User consent is required");
  }

  return {
    errors,
    value: {
      first_name: firstName,
      last_name: lastName,
      mobile,
      consent,
      pan
    }
  };
}

function firstPresent(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function buildExperianPayload(req, user) {
  const body = req.body || {};
  const query = req.query || {};

  return {
    mobile: firstPresent(
      body.mobile,
      body.mobileNumber,
      query.mobile,
      query.mobileNumber,
      user.mobileNumber
    ),
    pan: firstPresent(
      body.pan,
      body.panNumber,
      query.pan,
      query.panNumber,
      user.panNumber
    ),
    name: firstPresent(
      body.name,
      body.fullName,
      query.name,
      query.fullName,
      user.fullName
    ),
    consent: firstPresent(
      body.consent,
      query.consent,
      "Y"
    )
  };
}

function formatSavedCibilReport(savedReport) {
  return {
    client_id: savedReport.clientId,
    name: savedReport.name,
    mobile: savedReport.mobile,
    pan: savedReport.pan,
    gender: savedReport.gender,
    user_email: savedReport.userEmail,
    credit_score: savedReport.creditScore,
    credit_report: savedReport.creditReport,
    credit_report_link: savedReport.creditReportLink,
    credit_report_base64: savedReport.creditReportBase64
  };
}

function formatSavedExperianReport(savedReport) {
  return {
    client_id: savedReport.clientId,
    name: savedReport.name,
    mobile: savedReport.mobile,
    pan: savedReport.pan,
    credit_score: savedReport.creditScore,
    credit_report: savedReport.creditReport
  };
}

function normalizeKey(value) {
  return String(value || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function findDeepValue(value, aliases, visited = new Set()) {
  if (!value || typeof value !== "object" || visited.has(value)) {
    return null;
  }

  visited.add(value);

  const normalizedAliases = aliases.map(normalizeKey);

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findDeepValue(item, aliases, visited);

      if (found !== null && found !== undefined) {
        return found;
      }
    }

    return null;
  }

  for (const [key, item] of Object.entries(value)) {
    if (
      normalizedAliases.includes(normalizeKey(key)) &&
      item !== null &&
      item !== undefined &&
      item !== ""
    ) {
      return item;
    }
  }

  for (const item of Object.values(value)) {
    const found = findDeepValue(item, aliases, visited);

    if (found !== null && found !== undefined) {
      return found;
    }
  }

  return null;
}

function toArray(value) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function normalizeArray(value) {
  if (value === null || value === undefined || value === "") {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function safeValue(value, fallback = "-") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return value;
}

function getLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function getSectionLines(lines, startPattern, endPatterns = []) {
  const startIndex = lines.findIndex((line) => startPattern.test(line));

  if (startIndex === -1) {
    return [];
  }

  const rest = lines.slice(startIndex + 1);
  const endIndex = rest.findIndex((line) =>
    endPatterns.some((pattern) => pattern.test(line))
  );

  return endIndex === -1 ? rest : rest.slice(0, endIndex);
}

function findDetailedAccountsStartIndex(lines) {
  return lines.findIndex((line, index) =>
    /^ACCOUNT\(S\):?$/i.test(line) &&
    /^ACCOUNT$/i.test(lines[index + 1] || "") &&
    /^DATES$/i.test(lines[index + 2] || "")
  );
}

function findLineValue(lines, label) {
  const labelPattern = new RegExp(`^${label}:?\\s*(.*)$`, "i");

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(labelPattern);

    if (!match) {
      continue;
    }

    if (match[1]) {
      return match[1].trim();
    }

    return lines[index + 1] || null;
  }

  return null;
}

function parseKeyValueLines(lines) {
  const data = {};

  for (const line of lines) {
    const match = line.match(/^([^:]+):\s*(.*)$/);

    if (!match) {
      continue;
    }

    const key = match[1].trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
    data[key.replace(/^_+|_+$/g, "")] = match[2].trim() || null;
  }

  return data;
}

function parseConsumerInformation(lines) {
  const section = getSectionLines(lines, /^CONSUMER INFORMATION:?$/i, [
    /^CIBIL TRANSUNION SCORE/i
  ]);

  return {
    name: findLineValue(section, "NAME"),
    date_of_birth: findLineValue(section, "DATE OF BIRTH"),
    gender: findLineValue(section, "GENDER")
  };
}

function parseScoreFromPdf(lines, fallbackScore) {
  const section = getSectionLines(lines, /^CIBIL TRANSUNION SCORE/i, [
    /^IDENTIFICATION\(S\):?$/i
  ]);
  const factorStartIndex = section.findIndex((line) => /^1\.\s+/.test(line));
  const rangeIndex = section.findIndex((line) => /^POSSIBLE RANGE/i.test(line));
  const factors = section
    .slice(factorStartIndex === -1 ? section.length : factorStartIndex, rangeIndex === -1 ? section.length : rangeIndex)
    .map((line) => line.match(/^\d+\.\s+(.+)$/)?.[1])
    .filter(Boolean);
  const scoreName = section.find((line) => /^CIBIL/i.test(line) && !/SCORE/i.test(line));
  const score = section.find((line) => /^\d{3}$/.test(line));
  const rangeLine = section.find((line) => /^\s*:?\s*\d+\s*\(/.test(line));

  return {
    value: fallbackScore || score || null,
    name: scoreName || null,
    factors,
    range: rangeLine ? rangeLine.replace(/^:\s*/, "") : null
  };
}

function parseIdentifications(lines) {
  const section = getSectionLines(lines, /^IDENTIFICATION\(S\):?$/i, [
    /^TELEPHONE\(S\):?$/i
  ]).filter((line) => !/IDENTIFICATION TYPE|IDENTIFICATION NUMBER|ISSUE DATE|EXPIRATION DATE/i.test(line));
  const identifications = [];

  for (let index = 0; index < section.length; index += 1) {
    const current = section[index];
    const next = section[index + 1];

    if (!next) {
      continue;
    }

    if (/^[A-Z ]+\([A-Z]+\)$/.test(current) || /^[A-Z][A-Z ]+$/.test(current)) {
      identifications.push({
        type: current,
        number: next
      });
      index += 1;
    } else if (/^\d{2}$/.test(current)) {
      identifications.push({
        type: current,
        number: next
      });
      index += 1;
    }
  }

  return identifications;
}

function parseTelephones(lines) {
  const section = getSectionLines(lines, /^TELEPHONE\(S\):?$/i, [
    /^EMAIL CONTACT\(S\):?$/i
  ]).filter((line) => !/TELEPHONE TYPE|TELEPHONE NUMBER|TELEPHONE EXTENSION/i.test(line));
  const telephones = [];

  for (let index = 0; index < section.length; index += 1) {
    if (/^[0-9X]{6,}$/.test(section[index + 1] || "")) {
      telephones.push({
        type: section[index],
        number: section[index + 1]
      });
      index += 1;
    }
  }

  return telephones;
}

function parseEmails(lines) {
  return getSectionLines(lines, /^EMAIL CONTACT\(S\):?$/i, [
    /^ADDRESS\(ES\):?$/i
  ])
    .filter((line) => /@/.test(line))
    .map((email) => ({ email }));
}

function parseAddresses(lines) {
  const section = getSectionLines(lines, /^ADDRESS\(ES\):?$/i, [
    /^EMPLOYMENT INFORMATION:?$/i
  ]);
  const addresses = [];
  let current = null;

  for (const line of section) {
    if (/^ADDRESS\s*:/i.test(line)) {
      current = { address: line.replace(/^ADDRESS\s*:\s*/i, "") };
      addresses.push(current);
    } else if (current && /^CATEGORY\s*:/i.test(line)) {
      current.category = line.replace(/^CATEGORY\s*:\s*/i, "");
    } else if (current && /^RESIDENCE CODE\s*:/i.test(line)) {
      current.residence_code = line.replace(/^RESIDENCE CODE\s*:\s*/i, "") || null;
    } else if (current && /^DATE REPORTED\s*:/i.test(line)) {
      current.date_reported = line.replace(/^DATE REPORTED\s*:\s*/i, "");
    }
  }

  return addresses;
}

function parseEmployment(lines) {
  const section = getSectionLines(lines, /^EMPLOYMENT INFORMATION:?$/i, [
    /^SUMMARY:?$/i
  ]);

  return section.length > 0 ? [{ raw_lines: section }] : [];
}

function parseSummary(lines) {
  const startIndex = lines.findIndex((line) => /^SUMMARY:?$/i.test(line));
  const accountStartIndex = findDetailedAccountsStartIndex(lines);
  const section = startIndex === -1
    ? []
    : lines.slice(
      startIndex + 1,
      accountStartIndex === -1 ? lines.length : accountStartIndex
    );

  return {
    raw_lines: section
  };
}

function parseAccounts(lines) {
  const startIndex = findDetailedAccountsStartIndex(lines);
  const rest = startIndex === -1 ? [] : lines.slice(startIndex + 1);
  const endIndex = rest.findIndex((line) => /^ENQUIRIES:$/i.test(line));
  const section = endIndex === -1 ? rest : rest.slice(0, endIndex);
  const accounts = [];
  let current = null;
  let inDpd = false;

  for (const line of section) {
    if (/^MEMBER NAME:/i.test(line)) {
      current = {
        member_name: line.replace(/^MEMBER NAME:\s*/i, "") || null,
        payment_history: []
      };
      accounts.push(current);
      inDpd = false;
      continue;
    }

    if (!current) {
      continue;
    }

    if (/^DAYS PAST DUE\/ASSET CLASSIFICATION/i.test(line)) {
      inDpd = true;
      continue;
    }

    if (inDpd) {
      current.payment_history.push(line);
      continue;
    }

    Object.assign(current, parseKeyValueLines([line]));
  }

  return accounts.map((account) => ({
    ...account,
    amount_overdue: account.amount_overdue || null,
    current_balance: account.current_balance || null,
    high_credit_amount: account.high_credit_amount || null,
    emi: account.emi || null,
    type: account.type || null,
    opened: account.opened || null,
    ownership: account.ownership || null
  }));
}

function parseEnquiries(lines) {
  const section = getSectionLines(lines, /^ENQUIRIES:$/i, [
    /^All information contained/i
  ]).filter((line) => !/MEMBER|ENQUIRY DATE|ENQUIRY PURPOSE|ENQUIRY AMOUNT/i.test(line));
  const enquiries = [];

  for (let index = 0; index < section.length; index += 4) {
    const [member, enquiryDate, enquiryPurpose, enquiryAmount] = section.slice(index, index + 4);

    if (!member) {
      continue;
    }

    enquiries.push({
      member,
      enquiry_date: enquiryDate || null,
      enquiry_purpose: enquiryPurpose || null,
      enquiry_amount: enquiryAmount || null
    });
  }

  return enquiries;
}

function buildDisplayCibilReportFromPdfText(text, savedReport) {
  const lines = getLines(text);

  return {
    consumer_information: parseConsumerInformation(lines),
    score: parseScoreFromPdf(lines, savedReport.creditScore),
    identifications: parseIdentifications(lines),
    telephones: parseTelephones(lines),
    emails: parseEmails(lines),
    addresses: parseAddresses(lines),
    employment: parseEmployment(lines),
    summary: parseSummary(lines),
    accounts: parseAccounts(lines),
    enquiries: parseEnquiries(lines),
    extracted_text_available: lines.length > 0
  };
}

async function extractPdfTextFromBase64(creditReportBase64) {
  if (!creditReportBase64) {
    return null;
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "scorecare-cibil-"));
  const pdfPath = path.join(tempDir, "report.pdf");

  try {
    await fs.writeFile(pdfPath, Buffer.from(creditReportBase64, "base64"));
    const { stdout } = await execFileAsync("pdftotext", [pdfPath, "-"], {
      maxBuffer: 10 * 1024 * 1024
    });

    return stdout;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function getReportSource(savedReport) {
  const providerData = savedReport.providerResponse?.data || {};

  return (
    savedReport.creditReport ||
    providerData.credit_report ||
    providerData.creditReport ||
    {}
  );
}

function buildDisplayCibilReport(savedReport) {
  const report = getReportSource(savedReport);

  return {
    profile: {
      client_id: savedReport.clientId,
      name:
        savedReport.name ||
        findDeepValue(report, ["name", "consumer_name", "consumerName"]),
      mobile:
        savedReport.mobile ||
        findDeepValue(report, ["mobile", "mobile_number", "mobileNumber"]),
      pan:
        savedReport.pan ||
        findDeepValue(report, ["pan", "pan_number", "panNumber"]),
      gender:
        savedReport.gender ||
        findDeepValue(report, ["gender"]),
      email:
        savedReport.userEmail ||
        findDeepValue(report, ["email", "email_address", "emailAddress"]),
      fetched_at: savedReport.fetchedAt
    },
    score: {
      value:
        savedReport.creditScore ||
        findDeepValue(report, [
          "credit_score",
          "creditScore",
          "score",
          "cibil_score",
          "cibilScore"
        ]),
      name: findDeepValue(report, ["score_name", "scoreName"]),
      factors: toArray(
        findDeepValue(report, [
          "scoring_factors",
          "scoringFactors",
          "score_factors",
          "scoreFactors"
        ])
      ),
      range: findDeepValue(report, ["score_range", "scoreRange", "range"])
    },
    consumer_information:
      findDeepValue(report, [
        "consumer_information",
        "consumerInformation",
        "consumer_info",
        "consumerInfo"
      ]) || {},
    identifications: toArray(
      findDeepValue(report, [
        "identifications",
        "identification",
        "ids",
        "id_details",
        "idDetails"
      ])
    ),
    telephones: toArray(
      findDeepValue(report, [
        "telephones",
        "telephone",
        "phones",
        "phone_numbers",
        "phoneNumbers"
      ])
    ),
    emails: toArray(
      findDeepValue(report, ["emails", "email_contacts", "emailContacts"])
    ),
    addresses: toArray(
      findDeepValue(report, ["addresses", "address", "address_details"])
    ),
    employment: toArray(
      findDeepValue(report, [
        "employment",
        "employment_information",
        "employmentInformation"
      ])
    ),
    summary:
      findDeepValue(report, [
        "summary",
        "account_summary",
        "accountSummary",
        "enquiry_summary",
        "enquirySummary"
      ]) || {},
    accounts: toArray(
      findDeepValue(report, [
        "accounts",
        "account",
        "tradelines",
        "tradeLines",
        "credit_accounts",
        "creditAccounts"
      ])
    ),
    enquiries: toArray(
      findDeepValue(report, ["enquiries", "inquiries", "enquiry", "inquiry"])
    )
  };
}

async function formatCibilDisplayPayload(savedReport, options = {}) {
  const formattedReport = formatSavedCibilReport(savedReport);
  let pdfText = null;
  let pdfDisplay = null;
  let pdfExtractionError = null;

  try {
    pdfText = await extractPdfTextFromBase64(savedReport.creditReportBase64);
    pdfDisplay = pdfText
      ? buildDisplayCibilReportFromPdfText(pdfText, savedReport)
      : null;
  } catch (error) {
    pdfExtractionError = error.message;
  }

  const jsonDisplay = buildDisplayCibilReport(savedReport);
  const data = {
    report: {
      ...formattedReport,
      credit_report_base64: options.includePdfBase64
        ? formattedReport.credit_report_base64
        : undefined
    },
    display: {
      ...jsonDisplay,
      ...pdfDisplay,
      profile: jsonDisplay.profile,
      score: {
        ...jsonDisplay.score,
        ...(pdfDisplay?.score || {})
      }
    },
    raw: {
      credit_report: getReportSource(savedReport),
      pdf_text: options.includePdfText ? pdfText : undefined,
      provider_response: savedReport.providerResponse
    },
    extraction: {
      source: pdfDisplay ? "pdf" : "provider_json",
      error: pdfExtractionError
    }
  };

  if (!options.includePdfBase64) {
    data.report.has_pdf = Boolean(savedReport.creditReportBase64);
    data.report.download_url = "/credit-reports/cibil/download-report";
  }

  return data;
}

function getReportFileName(savedReport) {
  const clientId = savedReport.clientId || "cibil-report";

  return `${clientId}.pdf`;
}

function sendPdfBuffer(res, savedReport, pdfBuffer) {
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${getReportFileName(savedReport)}"`,
    "Content-Length": pdfBuffer.length,
    "Access-Control-Expose-Headers": "Content-Disposition, Content-Length",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });

  return res.status(200).send(pdfBuffer);
}

function formatPdfValue(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (Array.isArray(value)) {
    return value.map(formatPdfValue).join(", ");
  }

  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => `${key.replace(/_/g, " ")}: ${formatPdfValue(item)}`)
      .join("\n");
  }

  return String(value);
}

function writePdfSection(doc, title, data) {
  if (
    !data ||
    (Array.isArray(data) && data.length === 0) ||
    (!Array.isArray(data) && typeof data === "object" && Object.keys(data).length === 0)
  ) {
    return;
  }

  doc.moveDown(1).fontSize(14).font("Helvetica-Bold").text(title);
  doc.moveDown(0.4).fontSize(10).font("Helvetica");

  if (Array.isArray(data)) {
    data.forEach((item, index) => {
      doc.font("Helvetica-Bold").text(`${index + 1}.`, { continued: true });
      doc.font("Helvetica").text(` ${formatPdfValue(item)}`);
      doc.moveDown(0.5);
    });
    return;
  }

  Object.entries(data).forEach(([key, value]) => {
    doc.font("Helvetica-Bold").text(`${key.replace(/_/g, " ")}:`, {
      continued: true
    });
    doc.font("Helvetica").text(` ${formatPdfValue(value)}`);
  });
}

function firstValue(...values) {
  return values.find((value) => value !== null && value !== undefined && value !== "") || "-";
}

function valueOrDash(value) {
  return value === null || value === undefined || value === "" ? "-" : value;
}

function formatCreditReportDate(value) {
  const text = String(value || "").trim();

  if (!text || text === "-") {
    return "-";
  }

  if (/^\d{8}$/.test(text)) {
    const date = new Date(`${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}T00:00:00+05:30`);

    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata"
    });
  }

  return text;
}

function formatInr(value) {
  const text = String(value || "").replace(/,/g, "").trim();

  if (!text || Number.isNaN(Number(text))) {
    return valueOrDash(value);
  }

  if (Number(text) === 0) {
    return "0";
  }

  return `Rs. ${Number(text).toLocaleString("en-IN")}`;
}

function formatAmount(value) {
  const text = String(value || "").trim();

  if (!text || text === "-") {
    return "-";
  }

  const normalized = text.replace(/,/g, "");

  if (Number.isNaN(Number(normalized))) {
    return text.startsWith("₹") || /^rs\.?/i.test(text) ? text : `₹${text}`;
  }

  return `₹${Number(normalized).toLocaleString("en-IN")}`;
}

function mapGender(value) {
  const code = String(value || "").trim().toUpperCase();

  if (["1", "M", "MALE"].includes(code)) {
    return "Male";
  }

  if (["2", "F", "FEMALE"].includes(code)) {
    return "Female";
  }

  return code ? "Other" : "-";
}

function getCaisAccounts(report) {
  return toArray(report?.CAIS_Account?.CAIS_Account_DETAILS);
}

function getAccountSource(account) {
  return firstValue(account.Subscriber_Name, account.subscriber_name, account.member_name);
}

function getAccountTypeLabel(account) {
  const accountType = String(account.Account_Type || "").trim();
  const accountTypeMap = {
    "05": "Personal Loan",
    "5": "Personal Loan",
    "10": "Credit Card",
    "06": "Consumer Loan",
    "6": "Consumer Loan"
  };

  if (accountTypeMap[accountType]) {
    return accountTypeMap[accountType];
  }

  if (account.Portfolio_Type === "R") {
    return "Credit Card";
  }

  if (account.Portfolio_Type === "I") {
    return "Personal Loan";
  }

  return firstValue(account.Account_Type, account.Account_Type_Description, account.account_type);
}

function getAccountStatus(account) {
  if (account.Date_Closed || String(account.Account_Status || "") === "13") {
    return "Closed";
  }

  return "Active";
}

function parseCrifDate(value) {
  const text = String(value || "").trim();

  if (!text) {
    return null;
  }

  const ddMmYyyy = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);

  if (ddMmYyyy) {
    return new Date(`${ddMmYyyy[3]}-${ddMmYyyy[2]}-${ddMmYyyy[1]}T00:00:00+05:30`);
  }

  const yyyyMmDd = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (yyyyMmDd) {
    return new Date(`${yyyyMmDd[1]}-${yyyyMmDd[2]}-${yyyyMmDd[3]}T00:00:00+05:30`);
  }

  const parsed = new Date(text);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isWithinLastMonths(value, months) {
  const date = parseCrifDate(value);

  if (!date) {
    return false;
  }

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);

  return date >= cutoff;
}

function getCrifAccountStatus(account) {
  const status = String(account?.["ACCOUNT-STATUS"] || "").trim();

  if (/closed/i.test(status)) {
    return "Closed";
  }

  if (/active/i.test(status)) {
    return "Active";
  }

  return status || "-";
}

function uniqueBy(items, getKey) {
  const seen = new Set();

  return items.filter((item) => {
    const key = String(getKey(item) || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildRawReportPdfData(savedReport) {
  const report = getReportSource(savedReport);
  const responses = normalizeArray(report?.RESPONSES?.RESPONSE);
  const accounts = responses
    .map((response) => response?.["LOAN-DETAILS"])
    .filter(Boolean);
  const enquiries = normalizeArray(report?.["INQUIRY-HISTORY"]?.HISTORY);
  const primarySummary = report?.["ACCOUNTS-SUMMARY"]?.["PRIMARY-ACCOUNTS-SUMMARY"] || {};
  const variations = report?.["PERSONAL-INFO-VARIATION"] || {};
  const firstVariationValue = (variation) => {
    const firstVariation = getVariationItems(variation)[0];

    if (!firstVariation || typeof firstVariation !== "object") {
      return firstVariation;
    }

    return firstVariation.VALUE || firstVariation["VARIATION-VALUE"];
  };
  const inquiryCountLast6Months = enquiries.filter((enquiry) =>
    isWithinLastMonths(enquiry?.["INQUIRY-DATE"], 6)
  ).length;
  const newAccountsLast6Months = accounts.filter((account) =>
    isWithinLastMonths(account?.["DISBURSED-DATE"], 6)
  ).length;
  const newDelinquentAccountsLast6Months = accounts.filter((account) =>
    isWithinLastMonths(account?.["DATE-REPORTED"], 6) &&
    Number(String(account?.["OVERDUE-AMT"] || "0").replace(/,/g, "")) > 0
  ).length;

  return {
    clientId: firstValue(savedReport.clientId, report?.["REPORT-ID"], report?.["CLIENT-ID"]),
    score: firstValue(
      savedReport.creditScore,
      report?.SCORES?.SCORE?.["SCORE-VALUE"],
      report?.SCORE?.BureauScore
    ),
    profile: {
      name: firstValue(savedReport.name, report?.["NAME"], firstVariationValue(variations?.["NAME-VARIATIONS"])),
      mobile: firstValue(savedReport.mobile, report?.["MOBILE"], firstVariationValue(variations?.["PHONE-NUMBER-VARIATIONS"])),
      pan: firstValue(savedReport.pan, report?.["PAN"], firstVariationValue(variations?.["PAN-VARIATIONS"])),
      dob: firstValue(report?.["DOB"], report?.["DATE-OF-BIRTH"], firstVariationValue(variations?.["DATE-OF-BIRTH-VARIATIONS"])),
      email: firstValue(savedReport.userEmail, report?.["EMAIL"], firstVariationValue(variations?.["EMAIL-VARIATIONS"])),
      address: firstValue(report?.["ADDRESS"], firstVariationValue(variations?.["ADDRESS-VARIATIONS"]))
    },
    summary: {
      totalAccounts: firstValue(primarySummary?.["TOTAL-ACCOUNTS"], primarySummary?.["NUMBER-OF-ACCOUNTS"], accounts.length),
      activeAccounts: firstValue(
        primarySummary?.["ACTIVE-ACCOUNTS"],
        accounts.filter((account) => getCrifAccountStatus(account) === "Active").length
      ),
      overdueAccounts: firstValue(
        primarySummary?.["OVERDUE-ACCOUNTS"],
        accounts.filter((account) => Number(String(account?.["OVERDUE-AMT"] || "0").replace(/,/g, "")) > 0).length
      ),
      currentBalance: firstValue(
        primarySummary?.["CURRENT-BALANCE"],
        primarySummary?.["TOTAL-CURRENT-BALANCE"],
        primarySummary?.["TOTAL-OUTSTANDING-BALANCE"],
        primarySummary?.["SECURED-OUTSTANDING-BALANCE"]
      ),
      disbursedAmount: firstValue(primarySummary?.["DISBURSED-AMOUNT"], primarySummary?.["HIGH-CREDIT"], primarySummary?.["HIGH-CREDIT-AMOUNT"]),
      inquiryCountLast6Months,
      newAccountsLast6Months,
      newDelinquentAccountsLast6Months
    },
    variations,
    accounts,
    enquiries
  };
}

function formatReportDate(value = new Date()) {
  const date = new Date(value);
  const datePart = date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata"
  });
  const timePart = date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata"
  }).toUpperCase();

  return `${datePart}, ${timePart}`;
}

function ensurePdfSpace(doc, height) {
  if (doc.y + height <= doc.page.height - doc.page.margins.bottom) {
    return;
  }

  doc.addPage();
}

function drawTemplateSectionTitle(doc, title) {
  ensurePdfSpace(doc, 34);
  doc.moveDown(0.8);
  doc
    .roundedRect(doc.page.margins.left, doc.y, 170, 22, 11)
    .fill("#08aeea");
  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(title.toUpperCase(), doc.page.margins.left + 12, doc.y + 6);
  doc.fillColor("#222222");
  doc.y += 28;
}

function drawInfoGrid(doc, items) {
  const columns = 3;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columnWidth = pageWidth / columns;
  const rowHeight = 52;

  items.forEach((item, index) => {
    const column = index % columns;

    if (column === 0) {
      ensurePdfSpace(doc, rowHeight);
    }

    const x = doc.page.margins.left + column * columnWidth;
    const y = doc.y;

    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor("#0baee4")
      .text(item.label.toUpperCase(), x + 6, y + 8, { width: columnWidth - 12 });
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#222222")
      .text(formatPdfValue(item.value), x + 6, y + 24, { width: columnWidth - 12 });
    doc
      .moveTo(x, y + rowHeight - 1)
      .lineTo(x + columnWidth, y + rowHeight - 1)
      .strokeColor("#dddddd")
      .stroke();

    if (column === columns - 1 || index === items.length - 1) {
      doc.y = y + rowHeight;
    }
  });
}

function drawSimpleTable(doc, headers, rows, columnWidths) {
  const startX = doc.page.margins.left;
  const headerHeight = 28;
  const rowHeight = 44;

  ensurePdfSpace(doc, headerHeight + rowHeight);
  headers.forEach((header, index) => {
    const x = startX + columnWidths.slice(0, index).reduce((sum, width) => sum + width, 0);
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor("#0baee4")
      .text(header.toUpperCase(), x + 4, doc.y + 8, { width: columnWidths[index] - 8 });
  });
  doc.y += headerHeight;

  rows.forEach((row) => {
    const dynamicRowHeight = Math.max(
      rowHeight,
      Math.max(...row.map((cell) => String(formatPdfValue(cell)).split("\n").length)) * 12 + 18
    );

    ensurePdfSpace(doc, dynamicRowHeight);
    const y = doc.y;

    row.forEach((cell, index) => {
      const x = startX + columnWidths.slice(0, index).reduce((sum, width) => sum + width, 0);
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#222222")
        .text(formatPdfValue(cell), x + 4, y + 8, {
          width: columnWidths[index] - 8,
          height: dynamicRowHeight - 12
        });
    });

    doc
      .moveTo(startX, y)
      .lineTo(doc.page.width - doc.page.margins.right, y)
      .strokeColor("#dddddd")
      .stroke();
    doc.y = y + dynamicRowHeight;
  });
}

function drawNoteRow(doc, text) {
  ensurePdfSpace(doc, 40);
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#0baee4")
    .text(text, doc.page.margins.left + 4, doc.y + 8, {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 8,
      lineGap: 3
    });
  doc.y += 40;
}

function drawKeyValue(doc, label, value, x, y, width) {
  doc
    .font("Helvetica-Bold")
    .fontSize(7)
    .fillColor("#0baee4")
    .text(label.toUpperCase(), x, y, { width });
  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor("#222222")
    .text(formatPdfValue(value), x, y + 11, { width });
}

function getPaymentHistoryRows(account) {
  return toArray(account.CAIS_Account_History)
    .map((history) => {
      const month = String(history.Month || "").trim();
      const year = String(history.Year || "").trim();
      const dpd = Number(String(history.Days_Past_Due || "0").trim());

      return {
        label: formatPaymentHistoryMonth(month, year),
        dpd: Number.isNaN(dpd) ? 0 : dpd
      };
    })
    .filter((history) => history.label)
    .map((history, index, rows) => ({
      ...history,
      label: index === 0 || history.label.split(" ").pop() !== rows[index - 1].label.split(" ").pop()
        ? history.label
        : history.label.split(" ")[0]
    }))
    .slice(0, 12);
}

function formatPaymentHistoryMonth(month, year) {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthNumber = Number(month);
  const monthName = monthNames[monthNumber - 1] || month;

  if (!monthName || !year) {
    return "";
  }

  return `${monthName} ${year}`;
}

function drawPaymentHistory(doc, historyRows, x, y, width) {
  doc
    .font("Helvetica-Bold")
    .fontSize(7)
    .fillColor("#0baee4")
    .text("PAYMENT HISTORY", x, y, { width });

  if (historyRows.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor("#222222")
      .text("-", x, y + 12, { width });
    return;
  }

  const itemWidth = width / 6;

  historyRows.forEach((history, index) => {
    const column = index % 6;
    const row = Math.floor(index / 6);
    const itemX = x + column * itemWidth;
    const itemY = y + 14 + row * 26;

    doc
      .font("Helvetica")
      .fontSize(6.5)
      .fillColor("#555555")
      .text(history.label, itemX, itemY, { width: itemWidth - 4, align: "center" });
    doc
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .fillColor("#222222")
      .text(String(history.dpd), itemX, itemY + 10, { width: itemWidth - 4, align: "center" });
  });
}

function drawAccountCard(doc, account, index) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const x = doc.page.margins.left;
  const historyRows = getPaymentHistoryRows(account);
  const cardHeight = 244 + Math.ceil(Math.max(historyRows.length, 1) / 6) * 26;

  ensurePdfSpace(doc, cardHeight + 14);

  const y = doc.y;
  doc
    .roundedRect(x, y, pageWidth, cardHeight, 6)
    .strokeColor("#d8eef5")
    .lineWidth(1)
    .stroke();
  doc
    .rect(x, y, pageWidth, 28)
    .fill("#f3fbfe");
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#222222")
    .text(`${index + 1}. ${firstValue(account.Subscriber_Name)}`, x + 12, y + 9, {
      width: pageWidth - 150
    });
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(getAccountStatus(account) === "Closed" ? "#555555" : "#238500")
    .text(getAccountStatus(account), x + pageWidth - 110, y + 9, {
      width: 95,
      align: "right"
    });

  const columnWidth = (pageWidth - 24) / 3;
  const left = x + 12;
  const top = y + 42;

  drawKeyValue(doc, "Account Number", account.Account_Number, left, top, columnWidth - 8);
  drawKeyValue(doc, "Account Type", getAccountTypeLabel(account), left + columnWidth, top, columnWidth - 8);
  drawKeyValue(doc, "Status", getAccountStatus(account), left + columnWidth * 2, top, columnWidth - 8);
  drawKeyValue(doc, "Opened Date", formatCreditReportDate(account.Open_Date), left, top + 38, columnWidth - 8);
  drawKeyValue(doc, "Closed Date", formatCreditReportDate(account.Date_Closed), left + columnWidth, top + 38, columnWidth - 8);
  drawKeyValue(doc, "Reported Date", formatCreditReportDate(account.Date_Reported), left + columnWidth * 2, top + 38, columnWidth - 8);
  drawKeyValue(doc, "Last Payment", formatCreditReportDate(account.Date_of_Last_Payment), left, top + 76, columnWidth - 8);
  drawKeyValue(doc, "Terms Duration", account.Terms_Duration, left + columnWidth, top + 76, columnWidth - 8);
  drawKeyValue(doc, "Repayment Tenure", account.Repayment_Tenure, left + columnWidth * 2, top + 76, columnWidth - 8);
  drawKeyValue(doc, "Current Balance", formatInr(account.Current_Balance), left, top + 114, columnWidth - 8);
  drawKeyValue(doc, "Credit Limit", formatInr(account.Credit_Limit_Amount), left + columnWidth, top + 114, columnWidth - 8);
  drawKeyValue(doc, "Highest / Original Loan", formatInr(account.Highest_Credit_or_Original_Loan_Amount), left + columnWidth * 2, top + 114, columnWidth - 8);
  drawKeyValue(doc, "Amount Past Due", formatInr(account.Amount_Past_Due), left, top + 152, columnWidth - 8);
  drawKeyValue(doc, "Latest DPD", valueOrDash(historyRows[0]?.dpd), left + columnWidth, top + 152, columnWidth - 8);
  drawPaymentHistory(doc, historyRows, left, top + 190, pageWidth - 24);

  doc.y = y + cardHeight + 10;
}

function escapeHtml(value) {
  return String(valueOrDash(value))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderTokens(template, tokens) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key) =>
    tokens[key] === undefined ? "-" : String(tokens[key])
  );
}

function getVariationItems(variation) {
  if (!variation || typeof variation !== "object") {
    return normalizeArray(variation);
  }

  return normalizeArray(
    variation.VARIATION ||
    variation.VARIATIONS ||
    variation.VALUE ||
    variation
  );
}

function renderVariationRows(variation) {
  const rows = getVariationItems(variation).filter((item) =>
    item !== null && item !== undefined && item !== ""
  );

  if (rows.length === 0) {
    return '<tr><td colspan="3">No records found</td></tr>';
  }

  return rows.map((item) => {
    if (typeof item !== "object") {
      return `<tr><td>${escapeHtml(item)}</td><td>-</td><td>-</td></tr>`;
    }

    return `
      <tr>
        <td>${escapeHtml(firstValue(
          item.VALUE,
          item["VARIATION-VALUE"],
          item.NAME,
          item.ADDRESS,
          item.EMAIL,
          item.PHONE,
          item["PHONE-NUMBER"],
          item.PAN,
          item.ID,
          item["ID-NUMBER"]
        ))}</td>
        <td>${escapeHtml(firstValue(item["REPORTED-DATE"], item["DATE-REPORTED"], item.DATE, item["REPORTING-DATE"]))}</td>
        <td>${escapeHtml(firstValue(item.SOURCE, item["REPORTED-BY"], item["CREDIT-GRANTOR"], item["MEMBER-NAME"]))}</td>
      </tr>
    `;
  }).join("");
}

function renderVariationSection(title, variation) {
  return `
    <div class="variation-block">
      <h4>${escapeHtml(title)}</h4>
      <table class="crif-table">
        <thead>
          <tr>
            <th>Value</th>
            <th>Reported</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>${renderVariationRows(variation)}</tbody>
      </table>
    </div>
  `;
}

function renderAllVariationSections(variations) {
  return [
    ["Name Variations", variations?.["NAME-VARIATIONS"]],
    ["DOB Variations", variations?.["DATE-OF-BIRTH-VARIATIONS"] || variations?.["DOB-VARIATIONS"]],
    ["Address Variations", variations?.["ADDRESS-VARIATIONS"]],
    ["Email Variations", variations?.["EMAIL-VARIATIONS"]],
    ["Phone Number Variations", variations?.["PHONE-NUMBER-VARIATIONS"]],
    ["PAN Variations", variations?.["PAN-VARIATIONS"]],
    ["Other ID Variations", variations?.["ID-VARIATIONS"] || variations?.["OTHER-ID-VARIATIONS"]]
  ].map(([title, variation]) => renderVariationSection(title, variation)).join("");
}

function parseCrifPaymentHistory(historyString) {
  const months = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11
  };
  const parsed = {};

  String(historyString || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      const match = item.match(/^([A-Za-z]+):(\d{4}),(.+)$/);

      if (!match) {
        return;
      }

      const monthIndex = months[match[1].toLowerCase()];

      if (monthIndex === undefined) {
        return;
      }

      parsed[match[2]] = parsed[match[2]] || Array(12).fill("-");
      parsed[match[2]][monthIndex] = match[3].trim();
    });

  return Object.entries(parsed)
    .sort(([yearA], [yearB]) => Number(yearB) - Number(yearA))
    .map(([year, values]) => ({ year, values }));
}

function renderPaymentHistoryTable(historyString) {
  const rows = parseCrifPaymentHistory(historyString);
  const monthHeaders = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];

  if (rows.length === 0) {
    return '<div class="note compact-note">No payment history found</div>';
  }

  return `
    <table class="payment-history-table">
      <thead>
        <tr>
          <th>Year</th>
          ${monthHeaders.map((month) => `<th>${month}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td>${escapeHtml(row.year)}</td>
            ${row.values.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderAccountCards(accounts) {
  if (accounts.length === 0) {
    return '<div class="note">No account details are available in this report.</div>';
  }

  return accounts.map((account, index) => {
    const status = getCrifAccountStatus(account);

    return `
      <div class="account-card">
        <div class="account-head">
          <div>
            <strong>${index + 1}. ${escapeHtml(account["CREDIT-GRANTOR"])}</strong>
            <p>${escapeHtml(firstValue(account["ACCT-TYPE"], account["ACCOUNT-TYPE"]))} &bull; ${escapeHtml(account["ACCT-NUMBER"])}</p>
          </div>
          <span class="status ${status.toLowerCase() === "closed" ? "closed" : "active"}">${escapeHtml(status)}</span>
        </div>

        <div class="account-grid">
          <div><span>Account Number</span><strong>${escapeHtml(account["ACCT-NUMBER"])}</strong></div>
          <div><span>Account Type</span><strong>${escapeHtml(firstValue(account["ACCT-TYPE"], account["ACCOUNT-TYPE"]))}</strong></div>
          <div><span>Credit Grantor</span><strong>${escapeHtml(account["CREDIT-GRANTOR"])}</strong></div>
          <div><span>Info As Of</span><strong>${escapeHtml(account["DATE-REPORTED"])}</strong></div>
          <div><span>Ownership</span><strong>${escapeHtml(account["OWNERSHIP-IND"])}</strong></div>
          <div><span>Credit Limit</span><strong>${escapeHtml(formatAmount(account["CREDIT-LIMIT"]))}</strong></div>
          <div><span>Cash Limit</span><strong>${escapeHtml(formatAmount(account["CASH-LIMIT"]))}</strong></div>
          <div><span>Installment / Frequency</span><strong>${escapeHtml(`${safeValue(formatAmount(account["INSTALLMENT-AMT"]))} / ${safeValue(account["INSTALLMENT-FREQUENCY"])}`)}</strong></div>
          <div><span>Disbursed Date</span><strong>${escapeHtml(account["DISBURSED-DATE"])}</strong></div>
          <div><span>Last Payment Date</span><strong>${escapeHtml(account["LAST-PAYMENT-DATE"])}</strong></div>
          <div><span>Closed Date</span><strong>${escapeHtml(account["CLOSED-DATE"])}</strong></div>
          <div><span>Tenure</span><strong>${escapeHtml(account.TENURE)}</strong></div>
          <div><span>Disbursed / High Credit</span><strong>${escapeHtml(formatAmount(firstValue(account["DISBURSED-AMT"], account["HIGH-CREDIT"])))}</strong></div>
          <div><span>Current Balance</span><strong>${escapeHtml(formatAmount(account["CURRENT-BAL"]))}</strong></div>
          <div><span>Last Paid Amount</span><strong>${escapeHtml(formatAmount(firstValue(account["LAST-PAID-AMOUNT"], account["LAST-PAID-AMT"])))}</strong></div>
          <div><span>Overdue Amount</span><strong>${escapeHtml(formatAmount(account["OVERDUE-AMT"]))}</strong></div>
          <div><span>Account Status</span><strong>${escapeHtml(account["ACCOUNT-STATUS"])}</strong></div>
        </div>

        <div class="payment-history-section">
          <div class="payment-history-title">Payment History</div>
          ${renderPaymentHistoryTable(account["COMBINED-PAYMENT-HISTORY"])}
        </div>
      </div>
    `;
  }).join("");
}

function renderEnquirySection(enquiries) {
  if (enquiries.length === 0) {
    return '<div class="enquiry-card note">No enquiries found</div>';
  }

  return `
    <table class="crif-table enquiry-card">
      <thead>
        <tr>
          <th>Date</th>
          <th>Institution</th>
          <th>Purpose</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${enquiries.map((enquiry) => `
          <tr>
            <td>${escapeHtml(enquiry["INQUIRY-DATE"])}</td>
            <td>${escapeHtml(enquiry["MEMBER-NAME"] || enquiry["CREDIT-GRANTOR"])}</td>
            <td>${escapeHtml(enquiry["INQUIRY-PURPOSE"])}</td>
            <td>${escapeHtml(formatAmount(enquiry["INQUIRY-AMOUNT"]))}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

async function buildCibilReportHtml(savedReport) {
  const templatePath = path.join(__dirname, "../html/cibil-report.html");
  const logoPath = path.join(__dirname, "../../assets/scorecare-logo.PNG");
  const [template, logoBuffer] = await Promise.all([
    fs.readFile(templatePath, "utf8"),
    fs.readFile(logoPath)
  ]);
  const data = buildRawReportPdfData(savedReport);

  return renderTokens(template, {
    logo_src: `data:image/png;base64,${logoBuffer.toString("base64")}`,
    report_generated_at: escapeHtml(formatReportDate(new Date())),
    report_id: escapeHtml(data.clientId),
    credit_score: escapeHtml(data.score),
    name: escapeHtml(data.profile.name),
    mobile: escapeHtml(data.profile.mobile),
    pan: escapeHtml(data.profile.pan),
    date_of_birth: escapeHtml(data.profile.dob),
    email: escapeHtml(data.profile.email),
    address: escapeHtml(data.profile.address),
    credit_account_total: escapeHtml(data.summary.totalAccounts),
    credit_account_active: escapeHtml(data.summary.activeAccounts),
    credit_account_overdue: escapeHtml(data.summary.overdueAccounts),
    current_balance: escapeHtml(formatAmount(data.summary.currentBalance)),
    disbursed_amount: escapeHtml(formatAmount(data.summary.disbursedAmount)),
    enquiries_last_6_months: escapeHtml(data.summary.inquiryCountLast6Months),
    new_accounts_last_6_months: escapeHtml(data.summary.newAccountsLast6Months),
    new_delinquent_accounts_last_6_months: escapeHtml(data.summary.newDelinquentAccountsLast6Months),
    variation_sections: renderAllVariationSections(data.variations),
    account_total: escapeHtml(data.accounts.length),
    account_rows: renderAccountCards(data.accounts),
    enquiry_rows: renderEnquirySection(data.enquiries)
  });
}

async function createCibilReportPdfBuffer(savedReport) {
  const html = await buildCibilReportHtml(savedReport);
  const downloadedAt = escapeHtml(formatReportDate(new Date()));
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: ["load", "networkidle0"]
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: `
        <div style="width:100%;padding:0 12mm;font-family:Arial,sans-serif;font-size:9px;color:#555;display:flex;justify-content:space-between;align-items:center;">
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
          <span>Downloaded: ${downloadedAt}</span>
        </div>
      `,
      margin: {
        top: "18mm",
        right: "12mm",
        bottom: "18mm",
        left: "12mm"
      },
      preferCSSPageSize: true
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

async function downloadPdfBufferFromLink(creditReportLink) {
  let reportResponse;

  try {
    reportResponse = await fetch(creditReportLink);
  } catch (fetchError) {
    const error = new Error("Unable to download CIBIL report PDF");
    error.statusCode = 502;
    error.details = fetchError.cause?.message || fetchError.message;
    throw error;
  }

  if (!reportResponse.ok) {
    const error = new Error(
      reportResponse.status === 403
        ? "CIBIL report download link has expired"
        : "Unable to download CIBIL report PDF"
    );
    error.statusCode = reportResponse.status === 403 ? 410 : 502;
    error.details = `PDF download failed with status ${reportResponse.status}`;
    throw error;
  }

  return Buffer.from(await reportResponse.arrayBuffer());
}

async function cachePdfFromReportLink(internalUserId, savedReport) {
  if (savedReport.creditReportBase64 || !savedReport.creditReportLink) {
    return savedReport;
  }

  const pdfBuffer = await downloadPdfBufferFromLink(savedReport.creditReportLink);

  return saveCibilReportPdfBase64(internalUserId, pdfBuffer.toString("base64"));
}

async function getCibilCreditReport(req, res, next) {
  try {
    const internalUserId = getAuthInternalUserId(req);
    const savedReport = await findCibilReportByUserId(internalUserId);

    if (savedReport) {
      return res.status(200).json({
        status: "success",
        message: "CIBIL report fetched from database",
        source: "database",
        userId: savedReport.userId,
        data: formatSavedCibilReport(savedReport),
        provider: {
          name: savedReport.provider,
          message: savedReport.providerMessage,
          messageCode: savedReport.providerMessageCode,
          statusCode: savedReport.providerStatusCode
        },
        fetchedAt: savedReport.fetchedAt
      });
    }

    const { errors, value } = validateCibilReportPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const report = await fetchCibilCreditReport(value);
    let savedCibilReport = await saveCibilReport(internalUserId, report);

    try {
      savedCibilReport = await cachePdfFromReportLink(
        internalUserId,
        savedCibilReport
      );
    } catch (_error) {
      // The report metadata is still useful even if the temporary PDF link fails.
    }

    return res.status(200).json({
      status: "success",
      message: "CIBIL report fetched successfully",
      source: "surepass",
      userId: savedCibilReport.userId,
      data: formatSavedCibilReport(savedCibilReport),
      provider: {
        name: "surepass",
        message: report.message,
        messageCode: report.message_code,
        statusCode: report.status_code
      },
      fetchedAt: savedCibilReport.fetchedAt
    });
  } catch (error) {
    next(error);
  }
}

async function getCrifCreditScore(req, res, next) {
  try {
    const internalUserId = getAuthInternalUserId(req);
    const savedReport = await findCrifScoreByUserId(internalUserId);

    if (savedReport) {
      return res.status(200).json({
        status: "success",
        message: "CRIF credit score fetched from database",
        source: "database",
        userId: savedReport.userId,
        data: formatSavedExperianReport(savedReport),
        provider: {
          name: savedReport.provider,
          message: savedReport.providerMessage,
          messageCode: savedReport.providerMessageCode,
          statusCode: savedReport.providerStatusCode
        },
        fetchedAt: savedReport.fetchedAt
      });
    }

    const user = await findUserById(internalUserId);

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found"
      });
    }

    const { errors, value } = validateCrifScorePayload(
      buildCrifScorePayloadFromUser(user)
    );

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const report = await fetchCrifCreditScore(value);

    const savedCrifScore = await saveCrifScore(internalUserId, report);

    return res.status(200).json({
      status: "success",
      message: "CRIF credit score fetched successfully",
      source: "surepass",
      userId: savedCrifScore.userId,
      data: formatSavedExperianReport(savedCrifScore),
      provider: {
        name: "surepass",
        message: report.message,
        messageCode: report.message_code,
        statusCode: report.status_code
      },
      fetchedAt: savedCrifScore.fetchedAt
    });
  } catch (error) {
    next(error);
  }
}

async function getCrifCreditReport(req, res, next) {
  try {
    const internalUserId = getAuthInternalUserId(req);
    const user = await findUserById(internalUserId);

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found"
      });
    }

    if (user.accessType !== "paid") {
      return res.status(200).json({
        status: "success",
        message: "No data available",
        source: "subscription",
        data: null,
        accessType: user.accessType
      });
    }

    const savedReport = await findCrifReportByUserId(internalUserId);

    if (savedReport) {
      return res.status(200).json({
        status: "success",
        message: "CRIF credit report fetched from database",
        source: "database",
        userId: savedReport.userId,
        data: formatSavedExperianReport(savedReport),
        provider: {
          name: savedReport.provider,
          message: savedReport.providerMessage,
          messageCode: savedReport.providerMessageCode,
          statusCode: savedReport.providerStatusCode
        },
        fetchedAt: savedReport.fetchedAt
      });
    }

    const { errors, value } = validateCrifScorePayload(
      buildCrifScorePayloadFromUser(user)
    );

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const report = await fetchCrifCreditReport(value);
    const savedCrifReport = await saveCrifReport(internalUserId, report);

    return res.status(200).json({
      status: "success",
      message: "CRIF credit report fetched successfully",
      source: "surepass",
      userId: savedCrifReport.userId,
      data: formatSavedExperianReport(savedCrifReport),
      provider: {
        name: "surepass",
        message: report.message,
        messageCode: report.message_code,
        statusCode: report.status_code
      },
      fetchedAt: savedCrifReport.fetchedAt
    });
  } catch (error) {
    next(error);
  }
}

async function getSavedCibilCreditReport(req, res, next) {
  try {
    const internalUserId = getAuthInternalUserId(req);
    let savedReport = await findCibilReportByUserId(internalUserId);

    if (!savedReport) {
      return res.status(404).json({
        status: "error",
        message: "CRIF report not found"
      });
    }

    const includePdfBase64 =
      String(req.query.includePdfBase64 || "").toLowerCase() === "true";
    const includePdfText =
      String(req.query.includePdfText || "").toLowerCase() === "true";

    if (!savedReport.creditReportBase64 && savedReport.creditReportLink) {
      try {
        savedReport = await cachePdfFromReportLink(internalUserId, savedReport);
      } catch (error) {
        if (error.statusCode !== 410) {
          throw error;
        }
      }
    }

    return res.status(200).json({
      status: "success",
      message: "CIBIL report fetched from database",
      source: "database",
      userId: savedReport.userId,
      data: await formatCibilDisplayPayload(savedReport, {
        includePdfBase64,
        includePdfText
      }),
      provider: {
        name: savedReport.provider,
        message: savedReport.providerMessage,
        messageCode: savedReport.providerMessageCode,
        statusCode: savedReport.providerStatusCode
      },
      fetchedAt: savedReport.fetchedAt
    });
  } catch (error) {
    next(error);
  }
}

async function downloadCibilCreditReport(req, res, next) {
  try {
    const internalUserId = getAuthInternalUserId(req);
    const savedReport = await findLatestSavedCreditReportByUserId(internalUserId);

    if (!savedReport) {
      return res.status(404).json({
        status: "error",
        message: "CRIF report not found"
      });
    }

    const pdfBuffer = await createCibilReportPdfBuffer(savedReport);
    await saveCreditReportDownload(internalUserId, savedReport.id, savedReport.reportType);

    return sendPdfBuffer(res, savedReport, pdfBuffer);
  } catch (error) {
    next(error);
  }
}

async function getCreditReportDownloads(req, res, next) {
  try {
    const internalUserId = getAuthInternalUserId(req);
    const downloads = await listCreditReportDownloadsByUserId(internalUserId);

    return res.status(200).json({
      status: "success",
      message: "Credit report downloads fetched successfully",
      data: downloads
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  downloadCibilCreditReport,
  getCreditReportDownloads,
  getCrifCreditReport,
  getCrifCreditScore,
  getSavedCibilCreditReport,
  getCibilCreditReport
};
