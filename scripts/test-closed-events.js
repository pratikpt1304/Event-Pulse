/**
 * Closed Events & Participant Roster Verification Script
 * Validates:
 * 1. Normalization of emails and trimming of data
 * 2. SheetJS parsing of Excel/CSV datasets
 * 3. Validation logic: valid, invalid (missing name, bad email, missing prn), duplicates
 * 4. Allowance checks: listed student vs unlisted student
 * 5. Registration blocking for unlisted students on closed events
 */

import * as XLSX from 'xlsx';

// Mock in-memory test runner
let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

console.log('\n======================================================');
console.log('🧪 EVENTPULSE: CLOSED EVENTS & PARTICIPANTS TEST SUITE');
console.log('======================================================\n');

// ---------------------------------------------------------------------------
// TEST 1: Normalization & Regex Checks
// ---------------------------------------------------------------------------
console.log('Test Suite 1: Email Normalization & Validation');
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const rawEmails = [
  { raw: '  Aditya.CS24@College.Edu  ', expected: 'aditya.cs24@college.edu', valid: true },
  { raw: 'riya.sharma@domain.co.in', expected: 'riya.sharma@domain.co.in', valid: true },
  { raw: 'invalid-email-without-at', valid: false },
  { raw: 'user@nodomain', valid: false },
  { raw: '', valid: false }
];

rawEmails.forEach(testCase => {
  const normalized = testCase.raw.trim().toLowerCase();
  const isValid = emailRegex.test(normalized);
  if (testCase.valid) {
    assert(normalized === testCase.expected, `Normalized "${testCase.raw}" to "${testCase.expected}"`);
    assert(isValid, `Email "${normalized}" matches standard email pattern`);
  } else {
    assert(!isValid, `Invalid email "${testCase.raw}" rejected`);
  }
});

// ---------------------------------------------------------------------------
// TEST 2: SheetJS Parsing of Excel & CSV Data
// ---------------------------------------------------------------------------
console.log('\nTest Suite 2: SheetJS Excel Parsing & Header Normalization');

const sampleRows = [
  { 'Student Name': 'Aarav Patel', 'Email Address': 'AARAV.P@COLLEGE.EDU', 'PRN Number': 'PRN2024001' },
  { 'Name': 'Diya Joshi', 'Email': 'diya.j@college.edu', 'PRN': 'PRN2024002' },
  { 'Name': '', 'Email': 'bad.row@college.edu', 'PRN': 'PRN2024003' }, // Missing name
  { 'Name': 'Kavya Rao', 'Email': 'invalid_email', 'PRN': 'PRN2024004' }, // Bad email
  { 'Name': 'Rohan Nair', 'Email': 'rohan.n@college.edu', 'PRN': '' }, // Missing PRN
  { 'Name': 'Aarav Patel Duplicate', 'Email': 'aarav.p@college.edu', 'PRN': 'PRN2024001' }, // Duplicate in file
];

// Create workbook in memory
const ws = XLSX.utils.json_to_sheet(sampleRows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Roster');
const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

// Parse buffer back
const parsedWb = XLSX.read(buffer, { type: 'buffer' });
const sheetData = XLSX.utils.sheet_to_json(parsedWb.Sheets[parsedWb.SheetNames[0]]);

assert(sheetData.length === sampleRows.length, `Correctly parsed ${sheetData.length} rows from Excel buffer`);

// Validation engine simulation
const seenEmails = new Set();
const valid = [];
const invalid = [];
const duplicates = [];

sheetData.forEach((row, i) => {
  let name = '';
  let email = '';
  let prn = '';

  Object.keys(row).forEach(k => {
    const cleanK = k.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const v = String(row[k] || '').trim();
    if (cleanK.includes('email') || cleanK.includes('mail')) email = v;
    else if (cleanK.includes('name') || cleanK.includes('student')) name = v;
    else if (cleanK.includes('prn') || cleanK.includes('roll')) prn = v;
  });

  const emailLower = email.toLowerCase().trim();
  const errors = [];
  if (!name) errors.push('Missing Name');
  if (!email || !emailRegex.test(emailLower)) errors.push('Invalid/Missing Email');
  if (!prn) errors.push('Missing PRN');

  if (errors.length > 0) {
    invalid.push({ row: i + 2, email: emailLower, errors });
  } else if (seenEmails.has(emailLower)) {
    duplicates.push({ row: i + 2, email: emailLower });
  } else {
    seenEmails.add(emailLower);
    valid.push({ name, email: emailLower, prn });
  }
});

assert(valid.length === 2, `Identified 2 valid rows (Aarav & Diya) out of ${sheetData.length}`);
assert(invalid.length === 3, `Identified 3 invalid rows (missing name, bad email, missing PRN)`);
assert(duplicates.length === 1, `Identified 1 duplicate row (Aarav second occurrence)`);

// ---------------------------------------------------------------------------
// TEST 3: Access Control & Registration Simulation for Closed Events
// ---------------------------------------------------------------------------
console.log('\nTest Suite 3: Closed Event Registration Guard Simulation');

const closedEvent = {
  id: 'evt_hackathon_closed',
  title: 'Elite Closed Hackathon',
  visibility: 'closed',
  department: 'Computer Science'
};

const openEvent = {
  id: 'evt_tech_open',
  title: 'Open Tech Exhibition',
  visibility: 'open',
  department: 'Information Technology'
};

// Mock allowedParticipants subcollection in memory
const allowedParticipantsDB = new Set([
  'aarav.p@college.edu',
  'diya.j@college.edu'
]);

function mockRegisterForEvent(event, studentEmail) {
  const normEmail = (studentEmail || '').trim().toLowerCase();
  
  if (event.visibility === 'closed') {
    if (!allowedParticipantsDB.has(normEmail)) {
      return {
        success: false,
        code: 'CLOSED_EVENT_RESTRICTED',
        message: '🔒 Registration Restricted: This is a closed, invite-only event.'
      };
    }
  }

  return {
    success: true,
    registrationId: `${event.id}_${normEmail}`
  };
}

// Case A: Listed student registers for closed event -> Should SUCCEED
const resA = mockRegisterForEvent(closedEvent, 'aarav.p@college.edu');
assert(resA.success === true, 'Listed student (aarav.p@college.edu) successfully registered for closed event');

// Case B: Unlisted student attempts to register for closed event -> Should FAIL
const resB = mockRegisterForEvent(closedEvent, 'uninvited.student@college.edu');
assert(resB.success === false, 'Unlisted student (uninvited.student@college.edu) was BLOCKED from closed event');
assert(resB.code === 'CLOSED_EVENT_RESTRICTED', 'Received CLOSED_EVENT_RESTRICTED error code');

// Case C: Unlisted student registers for open event -> Should SUCCEED
const resC = mockRegisterForEvent(openEvent, 'uninvited.student@college.edu');
assert(resC.success === true, 'Unlisted student can freely register for open event');

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n======================================================');
console.log(`Results: ${passedTests} / ${totalTests} tests passed successfully!`);
console.log('======================================================\n');
