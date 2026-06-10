const { execFile } = require("child_process");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const PDFDocument = require("pdfkit");
const { promisify } = require("util");

const {
  fetchCibilCreditReport,
  fetchExperianCreditReport,
  fetchExperianCreditScore
} = require("../services/surepass.service");
const {
  findCibilReportByUserId,
  findExperianReportByUserId,
  findExperianScoreByUserId,
  saveCibilReport,
  saveExperianReport,
  saveExperianScore,
  saveCibilReportPdfBase64
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

function buildExperianScoreFallbackResponse(value) {
  return {
    data: {
      client_id: "experian_credit_score_BLffggUeWtqOpHTjugpw",
      name: value.name.toUpperCase(),
      mobile: value.mobile,
      pan: value.pan,
      credit_score: "796"
    },
    status_code: 200,
    success: true,
    message: "Success",
    message_code: "success"
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
    "Content-Length": pdfBuffer.length
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

function createCibilReportPdfBuffer(savedReport, displayPayload) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks = [];
    const logoPath = path.join(__dirname, "../../assets/scorecare-logo.PNG");
    const display = displayPayload.display || {};

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.image(logoPath, 40, 35, { width: 110 });
    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .text("CIBIL Credit Report", 170, 45, { align: "right" });
    doc
      .fontSize(9)
      .font("Helvetica")
      .text(`Generated: ${new Date().toLocaleDateString("en-IN")}`, {
        align: "right"
      });
    doc.moveDown(3);

    writePdfSection(doc, "Profile", display.profile);
    writePdfSection(doc, "Score", display.score);
    writePdfSection(doc, "Consumer Information", display.consumer_information);
    writePdfSection(doc, "Identifications", display.identifications);
    writePdfSection(doc, "Telephones", display.telephones);
    writePdfSection(doc, "Emails", display.emails);
    writePdfSection(doc, "Addresses", display.addresses);
    writePdfSection(doc, "Employment", display.employment);
    writePdfSection(doc, "Summary", display.summary);
    writePdfSection(doc, "Accounts", display.accounts);
    writePdfSection(doc, "Enquiries", display.enquiries);

    doc.end();
  });
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

async function getExperianCreditScore(req, res, next) {
  try {
    const internalUserId = getAuthInternalUserId(req);
    const savedReport = await findExperianScoreByUserId(internalUserId);

    if (savedReport) {
      return res.status(200).json({
        status: "success",
        message: "Experian credit score fetched from database",
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

    const { errors, value } = validateExperianPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    let report;
    let source = "surepass";

    try {
      report = await fetchExperianCreditScore(value);
    } catch (error) {
      if (error.details?.message_code !== "balance_exhausted") {
        throw error;
      }

      report = buildExperianScoreFallbackResponse(value);
      source = "fallback";
    }

    const savedExperianScore = await saveExperianScore(internalUserId, report);

    return res.status(200).json({
      status: "success",
      message: "Experian credit score fetched successfully",
      source,
      userId: savedExperianScore.userId,
      data: formatSavedExperianReport(savedExperianScore),
      provider: {
        name: "surepass",
        message: report.message,
        messageCode: report.message_code,
        statusCode: report.status_code
      },
      fetchedAt: savedExperianScore.fetchedAt
    });
  } catch (error) {
    next(error);
  }
}

async function getExperianCreditReport(req, res, next) {
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

    const savedReport = await findExperianReportByUserId(internalUserId);

    if (savedReport) {
      return res.status(200).json({
        status: "success",
        message: "Experian credit report fetched from database",
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

    const { errors, value } = validateExperianPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const report = await fetchExperianCreditReport(value);
    const savedExperianReport = await saveExperianReport(internalUserId, report);

    return res.status(200).json({
      status: "success",
      message: "Experian credit report fetched successfully",
      source: "surepass",
      userId: savedExperianReport.userId,
      data: formatSavedExperianReport(savedExperianReport),
      provider: {
        name: "surepass",
        message: report.message,
        messageCode: report.message_code,
        statusCode: report.status_code
      },
      fetchedAt: savedExperianReport.fetchedAt
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
        message: "CIBIL report not found"
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
    const savedReport =
      await findCibilReportByUserId(internalUserId) ||
      await findExperianReportByUserId(internalUserId);

    if (!savedReport) {
      return res.status(404).json({
        status: "error",
        message: "CIBIL report not found"
      });
    }

    const displayPayload = savedReport.reportType === "cibil_pdf"
      ? await formatCibilDisplayPayload(savedReport)
      : { display: buildDisplayCibilReport(savedReport) };
    const pdfBuffer = await createCibilReportPdfBuffer(savedReport, displayPayload);

    return sendPdfBuffer(res, savedReport, pdfBuffer);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  downloadCibilCreditReport,
  getExperianCreditReport,
  getExperianCreditScore,
  getSavedCibilCreditReport,
  getCibilCreditReport
};
