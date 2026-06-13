const { execFile } = require("child_process");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const puppeteer = require("puppeteer");
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
  findLatestSavedCreditReportByUserId,
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

function firstValue(...values) {
  return values.find((value) => value !== null && value !== undefined && value !== "") || "-";
}

function valueOrDash(value) {
  return value === null || value === undefined || value === "" ? "-" : value;
}

function formatCreditReportDate(value) {
  const text = String(value || "").trim();

  if (!text) {
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
  const accounts = getCaisAccounts(report);
  const firstHolder = toArray(accounts[0]?.CAIS_Holder_Details)[0] || {};
  const ids = accounts.flatMap((account) =>
    toArray(account.CAIS_Holder_ID_Details).map((id) => ({
      ...id,
      source: getAccountSource(account)
    }))
  );
  const panId = ids.find((id) => /PAN|INCOME TAX/i.test(`${id.ID_Type || ""} ${id.Income_TAX_PAN || ""}`));
  const addresses = uniqueBy(
    accounts.flatMap((account) =>
      toArray(account.CAIS_Holder_Address_Details).map((address) => ({
        address: [
          address.First_Line_Of_Address_non_normalized,
          address.Second_Line_Of_Address_non_normalized,
          address.Third_Line_Of_Address_non_normalized,
          address.City_non_normalized
        ].filter(Boolean).join(", "),
        zip: address.ZIP_Postal_Code_non_normalized,
        state: address.State_non_normalized,
        category: address.Address_indicator_non_normalized,
        source: getAccountSource(account),
        dateReported: address.Date_of_Address_Reported
      }))
    ),
    (address) => `${address.address}|${address.zip}|${address.state}`
  ).filter((address) => address.address || address.zip || address.state).slice(0, 8);
  const telephones = uniqueBy(
    accounts.flatMap((account) => {
      const source = getAccountSource(account);
      const phones = toArray(account.CAIS_Holder_Phone_Details).map((phone) => ({
        number: phone.Mobile_Telephone_Number || phone.Telephone_Number,
        type: phone.Telephone_Type,
        email: phone.EMailId,
        source
      }));
      const idEmails = toArray(account.CAIS_Holder_ID_Details).map((id) => ({
        number: "-",
        type: "-",
        email: id.EMailId,
        source
      }));

      return [...phones, ...idEmails];
    }),
    (item) => `${item.number || ""}|${item.email || ""}`
  ).filter((item) => item.number || item.email);
  const summary = report?.CAIS_Account?.CAIS_Summary || {};
  const enquiry = report?.CAPS?.CAPS_Summary || {};

  return {
    score: firstValue(savedReport.creditScore, report?.SCORE?.BureauScore),
    personal: [
      { label: "Name", value: firstValue(savedReport.name, report?.name) },
      { label: "Mobile", value: firstValue(savedReport.mobile, report?.mobile) },
      { label: "PAN", value: firstValue(panId?.Income_TAX_PAN, panId?.ID_Number, savedReport.pan, report?.pan) },
      { label: "Date of Birth", value: formatCreditReportDate(firstHolder.Date_of_birth) },
      { label: "Gender", value: mapGender(firstHolder.Gender_Code || savedReport.gender) },
      { label: "Identification Type", value: "Income Tax ID Number (PAN)" }
    ],
    accountSummary: summary,
    addresses,
    telephones,
    accounts,
    enquiry
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
    .map((history) => ({
      label: [history.Month, history.Year].filter((value) => value !== undefined && value !== null && value !== "").join("-"),
      dpd: valueOrDash(history.Days_Past_Due)
    }))
    .filter((history) => history.label && history.dpd !== "-")
    .slice(0, 12);
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

function renderAddressCards(addresses) {
  if (addresses.length === 0) {
    return '<div class="contact-card">-</div>';
  }

  return addresses.map((address, index) => `
    <div class="contact-card">
      <strong>${index + 1}. ${escapeHtml(address.address)}</strong><br />
      <span>ZIP: ${escapeHtml(address.zip)}</span><br />
      <span>State: ${escapeHtml(address.state)}</span><br />
      <span>Category: ${escapeHtml(address.category)}</span><br />
      <span>Origin: ${escapeHtml(address.source)}</span><br />
      <span>Reported: ${escapeHtml(formatCreditReportDate(address.dateReported))}</span>
    </div>
  `).join("");
}

function renderTelephoneRows(telephones) {
  if (telephones.length === 0) {
    return '<div class="compact-row"><span>-</span><span>-</span><span>-</span></div>';
  }

  return telephones.map((telephone) => `
    <div class="compact-row">
      <span>${escapeHtml(telephone.type)}</span>
      <span>${escapeHtml(telephone.number || telephone.email)}</span>
      <span>${escapeHtml(telephone.source)}</span>
    </div>
  `).join("");
}

function renderAccountCards(accounts) {
  if (accounts.length === 0) {
    return '<div class="note">No account details are available in this report.</div>';
  }

  return accounts.map((account, index) => {
    const status = getAccountStatus(account);
    const historyRows = getPaymentHistoryRows(account);
    const historyHtml = historyRows.length
      ? historyRows.map((history) => `<span>${escapeHtml(history.label)}: ${escapeHtml(history.dpd)}</span>`).join("")
      : "<span>-</span>";

    return `
      <div class="account-card">
        <div class="account-head">
          <div>
            <strong>${index + 1}. ${escapeHtml(account.Subscriber_Name)}</strong>
            <p>${escapeHtml(getAccountTypeLabel(account))} &bull; ${escapeHtml(account.Account_Number)}</p>
          </div>
          <span class="status ${status.toLowerCase()}">${escapeHtml(status)}</span>
        </div>

        <div class="account-grid">
          <div><span>Opened</span><strong>${escapeHtml(formatCreditReportDate(account.Open_Date))}</strong></div>
          <div><span>Closed</span><strong>${escapeHtml(formatCreditReportDate(account.Date_Closed))}</strong></div>
          <div><span>Reported</span><strong>${escapeHtml(formatCreditReportDate(account.Date_Reported))}</strong></div>
          <div><span>Last Payment</span><strong>${escapeHtml(formatCreditReportDate(account.Date_of_Last_Payment))}</strong></div>
          <div><span>Current Balance</span><strong>${escapeHtml(formatInr(account.Current_Balance))}</strong></div>
          <div><span>Credit Limit</span><strong>${escapeHtml(formatInr(account.Credit_Limit_Amount))}</strong></div>
          <div><span>High Credit / Loan</span><strong>${escapeHtml(formatInr(account.Highest_Credit_or_Original_Loan_Amount))}</strong></div>
          <div><span>Past Due</span><strong>${escapeHtml(formatInr(account.Amount_Past_Due))}</strong></div>
          <div><span>Latest DPD</span><strong>${escapeHtml(valueOrDash(historyRows[0]?.dpd))}</strong></div>
        </div>

        <div class="payment-history">
          ${historyHtml}
        </div>
      </div>
    `;
  }).join("");
}

function renderEnquirySection(enquiry) {
  const enquiryCounts = [
    enquiry.CAPSLast7Days,
    enquiry.CAPSLast30Days,
    enquiry.CAPSLast90Days,
    enquiry.CAPSLast180Days
  ].map((value) => Number(value || 0));

  if (enquiryCounts.every((count) => count === 0)) {
    return '<div class="enquiry-card note">No recent enquiries found</div>';
  }

  return `
    <div class="info-grid enquiry-card">
      <div><span class="label">Last 7 Days</span>${escapeHtml(enquiry.CAPSLast7Days)}</div>
      <div><span class="label">Last 30 Days</span>${escapeHtml(enquiry.CAPSLast30Days)}</div>
      <div><span class="label">Last 90 Days</span>${escapeHtml(enquiry.CAPSLast90Days)}</div>
      <div><span class="label">Last 180 Days</span>${escapeHtml(enquiry.CAPSLast180Days)}</div>
    </div>
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
  const creditAccount = data.accountSummary.Credit_Account || {};
  const outstandingBalance = data.accountSummary.Total_Outstanding_Balance || {};

  return renderTokens(template, {
    logo_src: `data:image/png;base64,${logoBuffer.toString("base64")}`,
    report_generated_at: escapeHtml(formatReportDate(new Date())),
    credit_score: escapeHtml(data.score),
    name: escapeHtml(data.personal[0]?.value),
    date_of_birth: escapeHtml(data.personal[3]?.value),
    gender: escapeHtml(data.personal[4]?.value),
    identification_type: escapeHtml("Income Tax ID Number (PAN)"),
    pan: escapeHtml(data.personal[2]?.value),
    issue_date: "-",
    credit_account_total: escapeHtml(creditAccount.CreditAccountTotal),
    credit_account_active: escapeHtml(creditAccount.CreditAccountActive),
    credit_account_closed: escapeHtml(creditAccount.CreditAccountClosed),
    credit_account_default: escapeHtml(creditAccount.CreditAccountDefault),
    outstanding_balance_all: escapeHtml(formatInr(outstandingBalance.Outstanding_Balance_All)),
    outstanding_balance_secured: escapeHtml(formatInr(outstandingBalance.Outstanding_Balance_Secured)),
    outstanding_balance_unsecured: escapeHtml(formatInr(outstandingBalance.Outstanding_Balance_UnSecured)),
    address_rows: renderAddressCards(data.addresses),
    telephone_rows: renderTelephoneRows(data.telephones),
    account_total: escapeHtml(data.accounts.length),
    account_rows: renderAccountCards(data.accounts),
    enquiry_rows: renderEnquirySection(data.enquiry)
  });
}

async function createCibilReportPdfBuffer(savedReport) {
  const html = await buildCibilReportHtml(savedReport);
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

    const report = await fetchExperianCreditScore(value);

    const savedExperianScore = await saveExperianScore(internalUserId, report);

    return res.status(200).json({
      status: "success",
      message: "Experian credit score fetched successfully",
      source: "surepass",
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

    const { errors, value } = validateExperianPayload(
      buildExperianPayload(req, user)
    );

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
    const savedReport = await findLatestSavedCreditReportByUserId(internalUserId);

    if (!savedReport) {
      return res.status(404).json({
        status: "error",
        message: "CIBIL report not found"
      });
    }

    const pdfBuffer = await createCibilReportPdfBuffer(savedReport);

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
