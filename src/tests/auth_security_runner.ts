import fs from 'fs';
import path from 'path';

const API_BASE = 'http://localhost:3000';

interface TestResult {
  id: string;
  name: string;
  status: 'PASS' | 'FAIL';
  details: string;
  httpStatus?: number;
}

const results: TestResult[] = [];

function record(id: string, name: string, status: 'PASS' | 'FAIL', details: string, httpStatus?: number) {
  results.push({ id, name, status, details, httpStatus });
  console.log(`[${status}] ${id}: ${name} -> ${details} (HTTP ${httpStatus || 'N/A'})`);
}

async function runAuthSecuritySuite() {
  console.log('========================================================================');
  console.log('STARTING MACHINE QMS END-TO-END AUTHENTICATION SECURITY TEST SUITE');
  console.log('========================================================================\n');

  // Sign in as Administrator (Basil De Swardt) to obtain an active session token
  const adminLoginRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'sheq', password: 'BasilDeSwardt#2026QMS' }),
  });
  const adminLoginData = await adminLoginRes.json();
  const adminToken = adminLoginData.session?.token || '';
  if (!adminToken) {
    throw new Error(`Admin login failed: ${adminLoginData.error || adminLoginRes.statusText}`);
  }

  // TEST 1: Known default password rejected for an account that has not completed credential replacement
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'dave.vance', password: 'QMS2026!' }),
    });
    const data = await res.json();
    if (res.status === 403 && data.requiresPasswordReset === true) {
      record('AUTH-01', 'Default Password Rejected for Unmigrated Account', 'PASS', `HTTP 403 Forbidden: ${data.error}`, res.status);
    } else {
      record('AUTH-01', 'Default Password Rejected for Unmigrated Account', 'FAIL', `Expected HTTP 403 with requiresPasswordReset: true, got ${res.status}: ${JSON.stringify(data)}`, res.status);
    }
  } catch (err: any) {
    record('AUTH-01', 'Default Password Rejected for Unmigrated Account', 'FAIL', err.message);
  }

  // TEST 2: Establish a controlled test account with an individual password via Admin and verify login
  const TEST_USER_ID = 'USR-007'; // Johan Kruger (Machinist)
  const TEST_USERNAME = 'johan.kruger';
  const INDIVIDUAL_PASSWORD = 'JohanKrugerSecure2026#';

  try {
    // Admin resets/establishes Johan Kruger's individual credential
    const resetRes = await fetch(`${API_BASE}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        operation: 'RESET_PASSWORD',
        targetUserId: TEST_USER_ID,
        newPassword: INDIVIDUAL_PASSWORD,
      }),
    });
    const resetData = await resetRes.json();
    if (!resetRes.ok || !resetData.success) {
      throw new Error(`Admin reset failed: ${resetData.error || resetRes.statusText}`);
    }

    // Now attempt login with the individually established password
    const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: TEST_USERNAME, password: INDIVIDUAL_PASSWORD }),
    });
    const loginData = await loginRes.json();
    if (loginRes.status === 200 && loginData.success && loginData.session?.token) {
      record('AUTH-02', 'Individually Established Password Accepted', 'PASS', `Logged in successfully as ${loginData.session.user.name} (${loginData.session.user.role})`, loginRes.status);
    } else {
      record('AUTH-02', 'Individually Established Password Accepted', 'FAIL', `Expected HTTP 200, got ${loginRes.status}: ${JSON.stringify(loginData)}`, loginRes.status);
    }
  } catch (err: any) {
    record('AUTH-02', 'Individually Established Password Accepted', 'FAIL', err.message);
  }

  // TEST 3: Incorrect password rejected
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: TEST_USERNAME, password: 'WrongIncorrectPassword999!' }),
    });
    const data = await res.json();
    if (res.status === 401 && !data.success) {
      record('AUTH-03', 'Incorrect Password Rejected', 'PASS', `HTTP 401 Unauthorized: ${data.error}`, res.status);
    } else {
      record('AUTH-03', 'Incorrect Password Rejected', 'FAIL', `Expected HTTP 401, got ${res.status}: ${JSON.stringify(data)}`, res.status);
    }
  } catch (err: any) {
    record('AUTH-03', 'Incorrect Password Rejected', 'FAIL', err.message);
  }

  // TEST 4: Disabled account rejected
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin.qms', password: 'AnyPassword2026!' }),
    });
    const data = await res.json();
    if (res.status === 401 && (data.error?.includes('disabled') || !data.success)) {
      record('AUTH-04', 'Disabled Account Rejected', 'PASS', `HTTP 401 Disabled: ${data.error}`, res.status);
    } else {
      record('AUTH-04', 'Disabled Account Rejected', 'FAIL', `Expected HTTP 401 disabled, got ${res.status}: ${JSON.stringify(data)}`, res.status);
    }
  } catch (err: any) {
    record('AUTH-04', 'Disabled Account Rejected', 'FAIL', err.message);
  }

  // TEST 5: Expired or invalid session token rejected
  try {
    const fakeToken = 'QMS1.eyJ1Ijp7ImlkIjoiVVNSLTAwOCIsInJvbGUiOiJBRE1JTklTVFJBVE9SIn19.FAKESIGNATURE_INVALID_FORGERY';
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${fakeToken}` },
    });
    if (res.status === 401) {
      record('AUTH-05', 'Invalid/Forged Session Token Rejected', 'PASS', 'HTTP 401 Unauthorized on forged token', res.status);
    } else {
      record('AUTH-05', 'Invalid/Forged Session Token Rejected', 'FAIL', `Expected HTTP 401, got ${res.status}`, res.status);
    }
  } catch (err: any) {
    record('AUTH-05', 'Invalid/Forged Session Token Rejected', 'FAIL', err.message);
  }

  // TEST 6: Logout invalidates the active session
  try {
    // 1. Log in as Johan Kruger
    const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: TEST_USERNAME, password: INDIVIDUAL_PASSWORD }),
    });
    const loginData = await loginRes.json();
    const johanToken = loginData.session?.token;

    // 2. Call logout with Johan's token
    const logoutRes = await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${johanToken}` },
    });
    const logoutData = await logoutRes.json();

    // 3. Verify /api/auth/me rejects the invalidated token
    const meRes = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${johanToken}` },
    });
    if (logoutRes.status === 200 && logoutData.success && meRes.status === 401) {
      record('AUTH-06', 'Logout Invalidates Session Token', 'PASS', 'Token successfully revoked and subsequent /me returns HTTP 401', meRes.status);
    } else {
      record('AUTH-06', 'Logout Invalidates Session Token', 'FAIL', `Expected 401 after logout, got ${meRes.status}`, meRes.status);
    }
  } catch (err: any) {
    record('AUTH-06', 'Logout Invalidates Session Token', 'FAIL', err.message);
  }

  // TEST 7: Public registration cannot elevate privileges (ADMINISTRATOR, ENGINEERING, HSEQ, etc.)
  try {
    const attemptElevated = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'hacker.admin',
        name: 'Malicious Attacker',
        email: 'hacker@attacker.com',
        role: 'ADMINISTRATOR',
        department: 'QMS Systems & Governance',
        password: 'AttackPassword2026!',
      }),
    });
    const elevatedData = await attemptElevated.json();
    if (attemptElevated.status === 403 && !elevatedData.success) {
      record('AUTH-07', 'Public Registration Rejects Privileged Roles', 'PASS', `HTTP 403 Forbidden: ${elevatedData.error}`, attemptElevated.status);
    } else {
      record('AUTH-07', 'Public Registration Rejects Privileged Roles', 'FAIL', `Expected HTTP 403, got ${attemptElevated.status}`, attemptElevated.status);
    }
  } catch (err: any) {
    record('AUTH-07', 'Public Registration Rejects Privileged Roles', 'FAIL', err.message);
  }

  // TEST 8: Separation of duties — Machinist cannot inspect or release their own component
  let machinistToken = '';
  try {
    const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: TEST_USERNAME, password: INDIVIDUAL_PASSWORD }),
    });
    const loginData = await loginRes.json();
    machinistToken = loginData.session?.token;

    // Load database to find a component machined by Johan Kruger (USR-007)
    const db = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'qms-db.json'), 'utf8'));
    let machinedByJohan = (db.manufacturingRecords || []).find((r: any) => r.machinistId === TEST_USER_ID);

    // If none exists, create or link one for Johan
    if (!machinedByJohan) {
      machinedByJohan = db.manufacturingRecords[0];
      machinedByJohan.machinistId = TEST_USER_ID;
      machinedByJohan.machinistName = 'Johan Kruger';
      fs.writeFileSync(path.join(process.cwd(), 'data', 'qms-db.json'), JSON.stringify(db, null, 2));
    }

    // Attempt Quality Release by the machinist who manufactured it
    const releaseAttempt = await fetch(`${API_BASE}/api/db`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${machinistToken}`,
      },
      body: JSON.stringify({
        action: 'QUALITY_RELEASE_EXECUTED',
        data: db,
        details: {
          manufacturingRecordId: machinedByJohan.id,
          traceabilityNumber: machinedByJohan.traceabilityNumber,
        },
      }),
    });
    const releaseData = await releaseAttempt.json();
    if (releaseAttempt.status === 403 && (releaseData.error?.includes('SEPARATION OF DUTIES') || releaseData.error?.includes('PERMISSION DENIED'))) {
      record('AUTH-08', 'Machinist Cannot Release Own Component', 'PASS', `HTTP 403 Blocked: ${releaseData.error}`, releaseAttempt.status);
    } else {
      record('AUTH-08', 'Machinist Cannot Release Own Component', 'FAIL', `Expected HTTP 403, got ${releaseAttempt.status}: ${JSON.stringify(releaseData)}`, releaseAttempt.status);
    }
  } catch (err: any) {
    record('AUTH-08', 'Machinist Cannot Release Own Component', 'FAIL', err.message);
  }

  // TEST 9: A user cannot approve an action outside their authorised role (Machinist cannot APPROVE_DRAWING)
  try {
    const drawingApprovalAttempt = await fetch(`${API_BASE}/api/db`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${machinistToken}`,
      },
      body: JSON.stringify({
        action: 'APPROVE_DRAWING',
        data: {},
        details: { recordId: 'DWG-001' },
      }),
    });
    const drawData = await drawingApprovalAttempt.json();
    if (drawingApprovalAttempt.status === 403 && drawData.error?.includes('PERMISSION DENIED')) {
      record('AUTH-09', 'User Blocked from Actions Outside Role', 'PASS', `HTTP 403 Denied: ${drawData.error}`, drawingApprovalAttempt.status);
    } else {
      record('AUTH-09', 'User Blocked from Actions Outside Role', 'FAIL', `Expected HTTP 403, got ${drawingApprovalAttempt.status}`, drawingApprovalAttempt.status);
    }
  } catch (err: any) {
    record('AUTH-09', 'User Blocked from Actions Outside Role', 'FAIL', err.message);
  }

  // TEST 10: Direct API requests cannot bypass server-side permissions (Unauthenticated POST /api/db)
  try {
    const unauthDbPost = await fetch(`${API_BASE}/api/db`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'UPDATE_COMPONENT',
        data: {},
      }),
    });
    const unauthData = await unauthDbPost.json();
    if (unauthDbPost.status === 401 && unauthData.error?.includes('UNAUTHORIZED')) {
      record('AUTH-10', 'Direct Unauthenticated API Modification Blocked', 'PASS', `HTTP 401: ${unauthData.error}`, unauthDbPost.status);
    } else {
      record('AUTH-10', 'Direct Unauthenticated API Modification Blocked', 'FAIL', `Expected HTTP 401, got ${unauthDbPost.status}`, unauthDbPost.status);
    }
  } catch (err: any) {
    record('AUTH-10', 'Direct Unauthenticated API Modification Blocked', 'FAIL', err.message);
  }

  // TEST 11: Account migration cannot be abused to take over another user's account using QMS2026!
  try {
    const hijackAttempt = await fetch(`${API_BASE}/api/auth/migrate-credential`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'dave.vance',
        currentCredential: 'QMS2026!',
        newPassword: 'AttackerNewPassword2026#',
      }),
    });
    const hijackData = await hijackAttempt.json();
    if (hijackAttempt.status === 403 || hijackAttempt.status === 401) {
      record('AUTH-11', 'Default Password Cannot Abuse Migration Workflow', 'PASS', `HTTP ${hijackAttempt.status} Blocked: ${hijackData.error}`, hijackAttempt.status);
    } else {
      record('AUTH-11', 'Default Password Cannot Abuse Migration Workflow', 'FAIL', `Expected HTTP 401/403, got ${hijackAttempt.status}: ${JSON.stringify(hijackData)}`, hijackAttempt.status);
    }
  } catch (err: any) {
    record('AUTH-11', 'Default Password Cannot Abuse Migration Workflow', 'FAIL', err.message);
  }

  // TEST 12: Authorized Migration with Administrator-Issued One-Time Migration Code
  try {
    // 1. Admin generates authorized one-time migration code for Dave Vance
    const codeGenRes = await fetch(`${API_BASE}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        operation: 'GENERATE_MIGRATION_CODE',
        targetUserId: 'USR-001',
      }),
    });
    const codeGenData = await codeGenRes.json();
    if (!codeGenRes.ok || !codeGenData.success || !codeGenData.migrationAuthCode) {
      throw new Error(`Failed to generate migration code: ${codeGenData.error || codeGenRes.statusText}`);
    }

    const issuedCode = codeGenData.migrationAuthCode;

    // 2. User Dave Vance migrates credential using the authorized one-time code
    const DAVE_NEW_PASS = 'DaveVanceMachinist2026#';
    const migrateRes = await fetch(`${API_BASE}/api/auth/migrate-credential`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'dave.vance',
        authorizationCode: issuedCode,
        newPassword: DAVE_NEW_PASS,
      }),
    });
    const migrateData = await migrateRes.json();

    // 3. User Dave Vance now logs in with new password
    const daveLoginRes = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'dave.vance',
        password: DAVE_NEW_PASS,
      }),
    });
    const daveLoginData = await daveLoginRes.json();

    if (migrateRes.status === 200 && migrateData.success && daveLoginRes.status === 200 && daveLoginData.success) {
      record('AUTH-12', 'Authorized Migration via Administrator Code Succeeds', 'PASS', `Successfully migrated and authenticated Dave Vance (${daveLoginData.session.user.name})`, daveLoginRes.status);
    } else {
      record('AUTH-12', 'Authorized Migration via Administrator Code Succeeds', 'FAIL', `Migration or login failed: ${JSON.stringify(migrateData)} / ${JSON.stringify(daveLoginData)}`, daveLoginRes.status);
    }
  } catch (err: any) {
    record('AUTH-12', 'Authorized Migration via Administrator Code Succeeds', 'FAIL', err.message);
  }

  console.log('\n========================================================================');
  console.log('AUTHENTICATION SECURITY SUITE SUMMARY');
  console.log('========================================================================');
  const passCount = results.filter((r) => r.status === 'PASS').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('========================================================================\n');
}

runAuthSecuritySuite().catch(console.error);
