import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import {
  INITIAL_DATABASE,
  INITIAL_USERS,
  INITIAL_ATTACHMENTS,
  DBService,
} from './src/services/db.ts';
import { ReportService } from './src/services/reportService.ts';
import {
  reconcileCrossPopulatedDatabase,
  mergeQMSDatabases,
} from './src/utils/crossReference.ts';
import type {
  QMSDatabase,
  User,
  UserRole,
  AuthSession,
  FileAttachmentMetadata,
} from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolvePort(): number {
  const portArgIdx = process.argv.indexOf('--port') !== -1 ? process.argv.indexOf('--port') : process.argv.indexOf('-p');
  if (portArgIdx !== -1 && process.argv[portArgIdx + 1]) {
    const parsed = parseInt(process.argv[portArgIdx + 1], 10);
    if (!isNaN(parsed)) return parsed;
  }
  const isDev =
    process.env.npm_lifecycle_event === 'dev' ||
    process.env.NODE_ENV === 'development';
  if (isDev) {
    return 3000;
  }
  if (process.env.PORT) {
    const parsed = parseInt(process.env.PORT, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return 3000;
}

function resolveHost(): string {
  const hostArgIdx = process.argv.indexOf('--host');
  if (hostArgIdx !== -1 && process.argv[hostArgIdx + 1]) {
    return process.argv[hostArgIdx + 1];
  }
  return process.env.HOST || '0.0.0.0';
}

const PORT = resolvePort();
const HOST = resolveHost();
const app = express();
const DATA_DIR = path.join(__dirname, 'data');
const ATTACHMENTS_DIR = path.join(DATA_DIR, 'attachments');
const DB_FILE = path.join(DATA_DIR, 'qms-db.json');
const AUDIT_FILE = path.join(DATA_DIR, 'qms-audit.json');
const AUTH_FILE = path.join(DATA_DIR, 'qms-users-auth.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'qms-sessions.json');
// Secure Session HMAC Secret: environment variable or randomly generated secret file (never hardcoded in source)
function getSessionSecret(): string {
  if (process.env.QMS_SESSION_SECRET && process.env.QMS_SESSION_SECRET.trim().length >= 16) {
    return process.env.QMS_SESSION_SECRET.trim();
  }
  const secretFile = path.join(DATA_DIR, '.session-secret');
  if (fs.existsSync(secretFile)) {
    try {
      const existing = fs.readFileSync(secretFile, 'utf-8').trim();
      if (existing.length >= 32) return existing;
    } catch {}
  }
  const newSecret = crypto.randomBytes(32).toString('hex');
  try {
    fs.writeFileSync(secretFile, newSecret, { mode: 0o600 });
  } catch {}
  return newSecret;
}
const SESSION_HMAC_SECRET = getSessionSecret();

app.use(express.json({ limit: '50mb' }));

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(ATTACHMENTS_DIR)) {
  fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
}
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// ==========================================
// 1. CRYPTOGRAPHIC PASSWORD HASHING, BOOTSTRAP & SESSIONS
// ==========================================

interface StoredUserAuth {
  userId: string;
  username: string;
  email: string;
  salt: string;
  passwordHash: string;
  isDefaultPassword?: boolean;
  requiresPasswordReset?: boolean;
  credentialStatus?: 'ACTIVE_INDIVIDUAL' | 'REQUIRES_REPLACEMENT' | 'DISABLED';
  migrationAuthCode?: string;
  migrationCodeExpiresAt?: string;
  passwordEstablishedAt?: string;
  updatedAt?: string;
}

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours controlled session expiry
const activeSessions = new Map<string, AuthSession>();
const revokedTokens = new Set<string>();

// Invalidate stale or pre-existing seed sessions on boot
function initializeCleanSessions() {
  if (fs.existsSync(SESSIONS_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
      if (Array.isArray(parsed)) {
        const now = Date.now();
        for (const s of parsed) {
          if (s && s.token && s.user && new Date(s.expiresAt).getTime() > now) {
            activeSessions.set(s.token, s);
          }
        }
      }
    } catch {
      // ignore
    }
  }
}

function savePersistedSessions() {
  try {
    const now = Date.now();
    const list = Array.from(activeSessions.values()).filter(
      (s) => new Date(s.expiresAt).getTime() > now
    );
    const tmpFile = `${SESSIONS_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpFile, JSON.stringify(list, null, 2), 'utf-8');
    fs.renameSync(tmpFile, SESSIONS_FILE);
  } catch {
    // ignore
  }
}

initializeCleanSessions();

// Cookie parser utility
function parseCookies(req: express.Request): Record<string, string> {
  const list: Record<string, string> = {};
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const [name, ...rest] = cookie.split('=');
    if (name) {
      list[name.trim()] = decodeURIComponent(rest.join('=').trim());
    }
  });
  return list;
}

// Login Rate Limiting: 5 failed attempts per IP+User locks out for 5 minutes
interface RateLimitEntry {
  failedAttempts: number;
  lockedUntil: number;
}
const loginRateLimits = new Map<string, RateLimitEntry>();

function getRateLimitKey(req: express.Request, identifier: string): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `${ip}::${String(identifier).trim().toLowerCase()}`;
}

function isRateLimited(key: string): { locked: boolean; waitSeconds?: number } {
  const entry = loginRateLimits.get(key);
  if (!entry) return { locked: false };
  if (entry.lockedUntil > Date.now()) {
    const waitSeconds = Math.ceil((entry.lockedUntil - Date.now()) / 1000);
    return { locked: true, waitSeconds };
  }
  if (entry.lockedUntil <= Date.now() && entry.lockedUntil > 0) {
    loginRateLimits.delete(key);
  }
  return { locked: false };
}

function recordLoginFailure(key: string) {
  const entry = loginRateLimits.get(key) || { failedAttempts: 0, lockedUntil: 0 };
  entry.failedAttempts += 1;
  if (entry.failedAttempts >= 5) {
    entry.lockedUntil = Date.now() + 5 * 60 * 1000; // 5 minute lock
  }
  loginRateLimits.set(key, entry);
}

function recordLoginSuccess(key: string) {
  loginRateLimits.delete(key);
}

// First Administrator Bootstrap Secret
// First Administrator Bootstrap Secret (Permanently disabled once administrators exist)
const BOOTSTRAP_TOKEN_FILE = path.join(DATA_DIR, '.bootstrap-admin-token');
function getOrCreateBootstrapToken(): string | null {
  try {
    const db = loadDatabase();
    const hasActiveAdmin = (db.users || []).some(
      (u) => u.role === 'ADMINISTRATOR' && u.active !== false
    );
    if (hasActiveAdmin) {
      if (fs.existsSync(BOOTSTRAP_TOKEN_FILE)) {
        try {
          fs.unlinkSync(BOOTSTRAP_TOKEN_FILE);
        } catch {}
      }
      return null;
    }
  } catch {}

  if (process.env.QMS_BOOTSTRAP_SECRET && process.env.QMS_BOOTSTRAP_SECRET.trim().length >= 16) {
    return process.env.QMS_BOOTSTRAP_SECRET.trim();
  }
  if (fs.existsSync(BOOTSTRAP_TOKEN_FILE)) {
    try {
      const existing = fs.readFileSync(BOOTSTRAP_TOKEN_FILE, 'utf-8').trim();
      if (existing.length >= 24) return existing;
    } catch {}
  }
  const token = crypto.randomBytes(24).toString('hex');
  try {
    fs.writeFileSync(BOOTSTRAP_TOKEN_FILE, token, { mode: 0o600 });
  } catch {}
  return token;
}

getOrCreateBootstrapToken();

function signSessionToken(user: User, expiresAt: string): string {
  const payloadObj = {
    u: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      department: user.department,
      email: user.email,
      active: user.active !== false,
    },
    exp: expiresAt,
    iat: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex'),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payloadObj), 'utf-8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_HMAC_SECRET)
    .update(payloadB64)
    .digest('base64url');
  return `QMS1.${payloadB64}.${sig}`;
}

function verifySignedSessionToken(token: string): AuthSession | null {
  if (!token.startsWith('QMS1.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, payloadB64, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_HMAC_SECRET)
    .update(payloadB64)
    .digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (!decoded || !decoded.u || !decoded.exp) return null;
    if (new Date(decoded.exp).getTime() < Date.now()) return null;
    return {
      token,
      user: decoded.u as User,
      expiresAt: decoded.exp,
      productionMode: true,
      authMode: 'PRODUCTION',
    };
  } catch {
    return null;
  }
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  try {
    if (!salt || !expectedHash) return false;
    const computed = Buffer.from(hashPassword(password, salt), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    if (computed.length !== expected.length) return false;
    return crypto.timingSafeEqual(computed, expected);
  } catch {
    return false;
  }
}

function verifyUserCredential(password: string, cred: StoredUserAuth): boolean {
  if (!cred.salt || !cred.passwordHash) return false;
  // Account disabled
  if (cred.credentialStatus === 'DISABLED') return false;
  // Account flagged as requiring password reset or holding unmigrated credentials
  if (cred.requiresPasswordReset || cred.isDefaultPassword || cred.credentialStatus === 'REQUIRES_REPLACEMENT') {
    return false;
  }
  // Shared/known default passwords strictly rejected in production
  if (password === 'QMS2026!' || password === 'Password123!') {
    return false;
  }
  return verifyPassword(password, cred.salt, cred.passwordHash);
}

function ensureUserCredentials(): StoredUserAuth[] {
  let existingCreds: StoredUserAuth[] = [];
  if (fs.existsSync(AUTH_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
      if (Array.isArray(parsed) && parsed.length > 0) {
        existingCreds = parsed;
      }
    } catch (e) {
      console.error('Corrupt auth file, re-initializing credentials:', e);
    }
  }

  let changed = existingCreds.length === 0;
  const seenUsernames = new Set(existingCreds.map((c) => (c.username || '').toLowerCase()));
  for (const u of INITIAL_USERS) {
    if (!seenUsernames.has(u.username.toLowerCase())) {
      const salt = crypto.randomBytes(16).toString('hex');
      // DO NOT generate known default password hash. Instead generate unguessable random key
      // and require authorized credential establishment!
      const unguessableKey = crypto.randomBytes(32).toString('hex');
      existingCreds.push({
        userId: u.id,
        username: u.username,
        email: u.email,
        salt,
        passwordHash: hashPassword(unguessableKey, salt),
        isDefaultPassword: false,
        requiresPasswordReset: true,
        credentialStatus: 'REQUIRES_REPLACEMENT',
        updatedAt: '2026-03-19T08:00:00Z',
      });
      seenUsernames.add(u.username.toLowerCase());
      changed = true;
    }
  }

  for (const c of existingCreds) {
    if (c.username?.toLowerCase() === 'admin.qms' || c.userId === 'USR-006') {
      if (c.credentialStatus !== 'DISABLED') {
        c.credentialStatus = 'DISABLED';
        changed = true;
      }
    }
    // Proactive safety check: If any account hash matches a known default password, immediately purge it
    if (
      verifyPassword('QMS2026!', c.salt, c.passwordHash) ||
      verifyPassword('Password123!', c.salt, c.passwordHash) ||
      c.isDefaultPassword
    ) {
      const salt = crypto.randomBytes(16).toString('hex');
      const unguessableKey = crypto.randomBytes(32).toString('hex');
      c.salt = salt;
      c.passwordHash = hashPassword(unguessableKey, salt);
      c.isDefaultPassword = false;
      c.requiresPasswordReset = true;
      c.credentialStatus = 'REQUIRES_REPLACEMENT';
      c.updatedAt = new Date().toISOString();
      changed = true;
    }
  }

  if (changed) {
    saveUserCredentials(existingCreds);
  }
  return existingCreds;
}

function saveUserCredentials(creds: StoredUserAuth[]) {
  const tmpFile = `${AUTH_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tmpFile, JSON.stringify(creds, null, 2), 'utf-8');
  fs.renameSync(tmpFile, AUTH_FILE);
}

ensureUserCredentials();

// ==========================================
// 2. SEED BASELINE ATTACHMENT FILES ON DISK
// ==========================================

function generateValidMinimalPdf(title: string, subtitle: string, docId: string): Buffer {
  const content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 240 >>
stream
BT
/F1 16 Tf
50 720 Td
(MACHINE QMS CONTROLLED TECHNICAL DOCUMENT) Tj
/F1 12 Tf
0 -30 Td
(Document ID: ${docId}) Tj
0 -20 Td
(Title: ${title}) Tj
0 -20 Td
(${subtitle}) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000229 00000 n 
0000000297 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
589
%%EOF`;
  return Buffer.from(content, 'utf-8');
}

function ensureBaselineAttachmentFiles() {
  for (const att of INITIAL_ATTACHMENTS) {
    const filePath = path.join(ATTACHMENTS_DIR, att.storedFilename);
    if (!fs.existsSync(filePath)) {
      const pdfBuf = generateValidMinimalPdf(
        att.originalFilename,
        `Category: ${att.category} | Drawing: ${att.drawingNumber || 'N/A'} Rev ${att.revision || 'N/A'} | Uploaded by: ${att.uploadedBy}`,
        att.fileId
      );
      fs.writeFileSync(filePath, pdfBuf);
    }
  }
}

ensureBaselineAttachmentFiles();

// ==========================================
// 3. DATABASE & AUDIT PERSISTENCE HELPERS
// ==========================================

function loadDatabase(): QMSDatabase {
  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && parsed.machines) {
        // Non-destructively merge persisted DB with INITIAL_DATABASE so app updates never wipe past data
        // and any newly introduced seed records interface seamlessly.
        return mergeQMSDatabases(parsed, INITIAL_DATABASE, INITIAL_DATABASE);
      }
    } catch (e) {
      console.error('Failed reading DB file, falling back to INITIAL_DATABASE', e);
    }
  }
  const initialReconciled = reconcileCrossPopulatedDatabase(INITIAL_DATABASE);
  saveDatabase(initialReconciled);
  return initialReconciled;
}

function saveDatabase(data: QMSDatabase) {
  const reconciled = reconcileCrossPopulatedDatabase(data);
  const sanitized: QMSDatabase = {
    ...reconciled,
    settings: {
      ...reconciled.settings,
      productionMode: true,
      allowDevRoleSwitch: false,
    },
  };
  const tmpFile = `${DB_FILE}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;
  fs.writeFileSync(tmpFile, JSON.stringify(sanitized, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
}

function logAudit(entry: {
  userId?: string;
  user: string;
  role: string;
  action: string;
  recordType: string;
  recordId: string;
  details?: Record<string, any>;
  previousValue?: string;
  newValue?: string;
}) {
  try {
    let auditList: any[] = [];
    if (fs.existsSync(AUDIT_FILE)) {
      try {
        auditList = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf-8'));
      } catch {
        auditList = [];
      }
    }
    const auditRecord = {
      id: `AUD-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    auditList.unshift(auditRecord);
    if (auditList.length > 5000) {
      auditList = auditList.slice(0, 5000);
    }
    const tmp = `${AUDIT_FILE}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;
    fs.writeFileSync(tmp, JSON.stringify(auditList, null, 2), 'utf-8');
    fs.renameSync(tmp, AUDIT_FILE);
    return auditRecord;
  } catch (err) {
    console.error('Failed to write audit log:', err);
    return null;
  }
}

// ==========================================
// 4. SERVER-SIDE AUTHENTICATION MIDDLEWARE
// ==========================================

function getSessionFromRequest(req: express.Request): AuthSession | null {
  let token = '';

  // 1. Read HTTP-Only Cookie
  const cookies = parseCookies(req);
  if (cookies['qms_session']) {
    token = cookies['qms_session'].trim();
  }

  // 2. Authorization Bearer Header fallback
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else if (typeof req.query.token === 'string') {
      token = req.query.token.trim();
    } else if (typeof req.headers['x-qms-session-token'] === 'string') {
      token = (req.headers['x-qms-session-token'] as string).trim();
    }
  }

  if (!token) return null;
  if (revokedTokens.has(token)) return null;

  // 3. Server-side session verification from active cache
  let session = activeSessions.get(token) || null;
  if (session) {
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      activeSessions.delete(token);
      savePersistedSessions();
      return null;
    }
    return session;
  }

  // 4. Cryptographically signed stateless token verification
  const verifiedSigned = verifySignedSessionToken(token);
  if (verifiedSigned) {
    const db = loadDatabase();
    const existingUser = db.users.find(
      (u) =>
        u.id.toLowerCase() === verifiedSigned.user.id.toLowerCase() ||
        u.username.toLowerCase() === verifiedSigned.user.username.toLowerCase()
    );
    if (!existingUser || existingUser.active === false) {
      return null;
    }
    verifiedSigned.user = existingUser;
    activeSessions.set(token, verifiedSigned);
    savePersistedSessions();
    return verifiedSigned;
  }

  return null;
}

// Role permission matrix enforced server-side
const ROLE_ALLOWED_ACTIONS: Record<UserRole, string[]> = {
  MACHINIST: [
    'CREATE_MACHINE',
    'UPDATE_MACHINE',
    'CREATE_PROJECT',
    'UPDATE_PROJECT',
    'CREATE_COMPONENT',
    'UPDATE_COMPONENT',
    'CREATE_DRAWING',
    'UPDATE_DRAWING',
    'REVISE_DRAWING',
    'CREATE_MANUFACTURING_RECORD',
    'UPDATE_MANUFACTURING_RECORD',
    'COMPLETE_PERMANENT_IDENTIFICATION',
    'CREATE_DEVIATION',
    'CREATE_NCR',
    'FILE_UPLOAD',
    'UPDATE_DALE_INSPECTION',
    'SUBMIT_DALE_INSPECTION',
    'BATCH_CREATE_DALE_INSPECTIONS',
    'AUTO_RECORD_NCR_FROM_INSPECTION_POINT',
    'AUTO_RECORD_NCR_FROM_INSPECTION_REJECTION',
    'APPROVE_DALE_INSPECTION',
    'RESET_DALE_INSPECTIONS',
    'HANDOVER_SIGNOFF',
  ],
  INSPECTOR: [
    'CREATE_MACHINE',
    'UPDATE_MACHINE',
    'CREATE_PROJECT',
    'UPDATE_PROJECT',
    'CREATE_COMPONENT',
    'UPDATE_COMPONENT',
    'CREATE_DRAWING',
    'UPDATE_DRAWING',
    'REVISE_DRAWING',
    'CREATE_MANUFACTURING_RECORD',
    'UPDATE_MANUFACTURING_RECORD',
    'START_INSPECTION',
    'UPDATE_INSPECTION',
    'RECORD_MEASUREMENT',
    'MEASUREMENT_CHANGED',
    'AUTOMATIC_HOLD',
    'INSPECTOR_SIGNOFF',
    'HANDOVER_SIGNOFF',
    'COMPLETE_PERMANENT_IDENTIFICATION',
    'CREATE_NCR',
    'UPDATE_NCR',
    'CLOSE_NCR',
    'CREATE_DEVIATION',
    'QUALITY_RELEASE_EXECUTED',
    'QUALITY_RELEASE_BLOCKED',
    'FILE_UPLOAD',
    'UPDATE_DALE_INSPECTION',
    'SUBMIT_DALE_INSPECTION',
    'BATCH_CREATE_DALE_INSPECTIONS',
    'AUTO_RECORD_NCR_FROM_INSPECTION_POINT',
    'AUTO_RECORD_NCR_FROM_INSPECTION_REJECTION',
    'APPROVE_DALE_INSPECTION',
    'RESET_DALE_INSPECTIONS',
    'ASSIGN_INSPECTION_TEMPLATE',
    'UPDATE_INSPECTION_TEMPLATE',
  ],
  MACHINE_MANAGER: [
    'CREATE_MACHINE',
    'UPDATE_MACHINE',
    'CREATE_PROJECT',
    'UPDATE_PROJECT',
    'CREATE_COMPONENT',
    'UPDATE_COMPONENT',
    'CREATE_DRAWING',
    'UPDATE_DRAWING',
    'REVISE_DRAWING',
    'CREATE_MANUFACTURING_RECORD',
    'UPDATE_MANUFACTURING_RECORD',
    'COMPLETE_PERMANENT_IDENTIFICATION',
    'START_INSPECTION',
    'CREATE_NCR',
    'UPDATE_NCR',
    'CLOSE_NCR',
    'CREATE_DEVIATION',
    'QUALITY_RELEASE_EXECUTED',
    'QUALITY_RELEASE_BLOCKED',
    'IMPORT_MACHINE_BOM_EXCEL',
    'FILE_UPLOAD',
    'UPDATE_DALE_INSPECTION',
    'SUBMIT_DALE_INSPECTION',
    'BATCH_CREATE_DALE_INSPECTIONS',
    'AUTO_RECORD_NCR_FROM_INSPECTION_POINT',
    'AUTO_RECORD_NCR_FROM_INSPECTION_REJECTION',
    'APPROVE_DALE_INSPECTION',
    'RESET_DALE_INSPECTIONS',
    'CREATE_INSPECTION_TEMPLATE',
    'UPDATE_INSPECTION_TEMPLATE',
    'ASSIGN_INSPECTION_TEMPLATE',
    'HANDOVER_SIGNOFF',
  ],
  ENGINEERING: [
    'CREATE_MACHINE',
    'UPDATE_MACHINE',
    'CREATE_PROJECT',
    'UPDATE_PROJECT',
    'CREATE_COMPONENT',
    'UPDATE_COMPONENT',
    'CREATE_DRAWING',
    'UPDATE_DRAWING',
    'REVISE_DRAWING',
    'APPROVE_DRAWING',
    'CREATE_MANUFACTURING_RECORD',
    'UPDATE_MANUFACTURING_RECORD',
    'COMPLETE_PERMANENT_IDENTIFICATION',
    'CREATE_DEVIATION',
    'UPDATE_DEVIATION',
    'APPROVE_DEVIATION',
    'IMPORT_MACHINE_BOM_EXCEL',
    'FILE_UPLOAD',
    'UPDATE_DALE_INSPECTION',
    'SUBMIT_DALE_INSPECTION',
    'BATCH_CREATE_DALE_INSPECTIONS',
    'AUTO_RECORD_NCR_FROM_INSPECTION_POINT',
    'AUTO_RECORD_NCR_FROM_INSPECTION_REJECTION',
    'APPROVE_DALE_INSPECTION',
    'RESET_DALE_INSPECTIONS',
    'CREATE_INSPECTION_TEMPLATE',
    'UPDATE_INSPECTION_TEMPLATE',
    'APPROVE_INSPECTION_TEMPLATE',
    'REVISE_INSPECTION_TEMPLATE',
    'OBSOLETE_INSPECTION_TEMPLATE',
    'ASSIGN_INSPECTION_TEMPLATE',
    'HANDOVER_SIGNOFF',
  ],
  HSEQ: [
    'CREATE_MACHINE',
    'UPDATE_MACHINE',
    'CREATE_PROJECT',
    'UPDATE_PROJECT',
    'CREATE_COMPONENT',
    'UPDATE_COMPONENT',
    'CREATE_DRAWING',
    'UPDATE_DRAWING',
    'REVISE_DRAWING',
    'APPROVE_DRAWING',
    'CREATE_MANUFACTURING_RECORD',
    'UPDATE_MANUFACTURING_RECORD',
    'START_INSPECTION',
    'UPDATE_INSPECTION',
    'RECORD_MEASUREMENT',
    'MEASUREMENT_CHANGED',
    'AUTOMATIC_HOLD',
    'INSPECTOR_SIGNOFF',
    'HANDOVER_SIGNOFF',
    'COMPLETE_PERMANENT_IDENTIFICATION',
    'CREATE_NCR',
    'UPDATE_NCR',
    'CLOSE_NCR',
    'CREATE_DEVIATION',
    'UPDATE_DEVIATION',
    'APPROVE_DEVIATION',
    'QUALITY_RELEASE_EXECUTED',
    'QUALITY_RELEASE_BLOCKED',
    'UPDATE_SETTINGS',
    'IMPORT_MACHINE_BOM_EXCEL',
    'FILE_UPLOAD',
    'UPDATE_DALE_INSPECTION',
    'SUBMIT_DALE_INSPECTION',
    'BATCH_CREATE_DALE_INSPECTIONS',
    'AUTO_RECORD_NCR_FROM_INSPECTION_POINT',
    'AUTO_RECORD_NCR_FROM_INSPECTION_REJECTION',
    'APPROVE_DALE_INSPECTION',
    'RESET_DALE_INSPECTIONS',
    'CREATE_INSPECTION_TEMPLATE',
    'UPDATE_INSPECTION_TEMPLATE',
    'APPROVE_INSPECTION_TEMPLATE',
    'REVISE_INSPECTION_TEMPLATE',
    'OBSOLETE_INSPECTION_TEMPLATE',
    'ASSIGN_INSPECTION_TEMPLATE',
    'HANDOVER_SIGNOFF',
  ],
  ADMINISTRATOR: [
    'CREATE_MACHINE',
    'UPDATE_MACHINE',
    'CREATE_PROJECT',
    'UPDATE_PROJECT',
    'CREATE_COMPONENT',
    'UPDATE_COMPONENT',
    'CREATE_DRAWING',
    'UPDATE_DRAWING',
    'REVISE_DRAWING',
    'APPROVE_DRAWING',
    'CREATE_MANUFACTURING_RECORD',
    'UPDATE_MANUFACTURING_RECORD',
    'COMPLETE_PERMANENT_IDENTIFICATION',
    'START_INSPECTION',
    'UPDATE_INSPECTION',
    'RECORD_MEASUREMENT',
    'MEASUREMENT_CHANGED',
    'AUTOMATIC_HOLD',
    'INSPECTOR_SIGNOFF',
    'CREATE_NCR',
    'UPDATE_NCR',
    'CLOSE_NCR',
    'CREATE_DEVIATION',
    'UPDATE_DEVIATION',
    'APPROVE_DEVIATION',
    'QUALITY_RELEASE_EXECUTED',
    'QUALITY_RELEASE_BLOCKED',
    'UPDATE_SETTINGS',
    'MANAGE_USERS',
    'RESET_TO_DEFAULTS',
    'RESTORE_DATABASE_BACKUP',
    'ADMIN_DELETE_RECORD',
    'ADMIN_CLEAR_LIST',
    'ADMIN_CLEAR_ALL_DATA',
    'IMPORT_MACHINE_BOM_EXCEL',
    'FILE_UPLOAD',
    'UPDATE_DALE_INSPECTION',
    'SUBMIT_DALE_INSPECTION',
    'BATCH_CREATE_DALE_INSPECTIONS',
    'AUTO_RECORD_NCR_FROM_INSPECTION_POINT',
    'AUTO_RECORD_NCR_FROM_INSPECTION_REJECTION',
    'APPROVE_DALE_INSPECTION',
    'RESET_DALE_INSPECTIONS',
    'CREATE_INSPECTION_TEMPLATE',
    'UPDATE_INSPECTION_TEMPLATE',
    'APPROVE_INSPECTION_TEMPLATE',
    'REVISE_INSPECTION_TEMPLATE',
    'OBSOLETE_INSPECTION_TEMPLATE',
    'ASSIGN_INSPECTION_TEMPLATE',
    'DELETE_DALE_INSPECTION',
    'HANDOVER_SIGNOFF',
  ],
  MANAGEMENT: [],
};

// ==========================================
// 5. AUTHENTICATION ENDPOINTS
// ==========================================

// ==========================================
// 5. AUTHENTICATION & BOOTSTRAP ENDPOINTS
// ==========================================

// First Administrator Bootstrap Procedure (One-Time Setup Secret)
app.post('/api/auth/bootstrap-admin', (req, res) => {
  const { setupSecret, username, name, email, password } = req.body || {};
  const currentToken = getOrCreateBootstrapToken();

  if (!currentToken) {
    return res.status(403).json({
      success: false,
      error: 'First-administrator bootstrap has already been completed. Contact an existing administrator for access.',
    });
  }

  if (!setupSecret || String(setupSecret).trim() !== currentToken.trim()) {
    logAudit({
      user: String(username || 'ANONYMOUS'),
      role: 'UNAUTHENTICATED',
      action: 'BOOTSTRAP_ADMIN_REJECTED',
      recordType: 'AUTH',
      recordId: 'BOOTSTRAP',
      details: { reason: 'Invalid or missing setup secret' },
    });
    return res.status(401).json({ success: false, error: 'Invalid setup secret.' });
  }

  if (!username || !name || !email || !password || String(password).length < 8) {
    return res.status(400).json({
      success: false,
      error: 'Username, full name, email, and password (minimum 8 characters) are required.',
    });
  }

  const db = loadDatabase();
  const creds = ensureUserCredentials();
  const cleanUname = String(username).trim().toLowerCase();
  const cleanEmail = String(email).trim().toLowerCase();

  let adminUser = db.users.find(
    (u) => u.username.toLowerCase() === cleanUname || u.role === 'ADMINISTRATOR'
  );

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(String(password), salt);

  if (adminUser) {
    adminUser.username = cleanUname;
    adminUser.name = String(name).trim();
    adminUser.email = cleanEmail;
    adminUser.role = 'ADMINISTRATOR';
    adminUser.active = true;

    const credIdx = creds.findIndex((c) => c.userId === adminUser!.id);
    if (credIdx !== -1) {
      creds[credIdx].salt = salt;
      creds[credIdx].passwordHash = passwordHash;
      creds[credIdx].isDefaultPassword = false;
      creds[credIdx].updatedAt = new Date().toISOString();
    } else {
      creds.push({
        userId: adminUser.id,
        username: cleanUname,
        email: cleanEmail,
        salt,
        passwordHash,
        isDefaultPassword: false,
        updatedAt: new Date().toISOString(),
      });
    }
  } else {
    const newId = `USR-ADMIN-${Date.now().toString(36).toUpperCase()}`;
    adminUser = {
      id: newId,
      username: cleanUname,
      name: String(name).trim(),
      role: 'ADMINISTRATOR',
      department: 'QMS Governance & Administration',
      email: cleanEmail,
      active: true,
    };
    db.users.push(adminUser);
    creds.push({
      userId: newId,
      username: cleanUname,
      email: cleanEmail,
      salt,
      passwordHash,
      isDefaultPassword: false,
      updatedAt: new Date().toISOString(),
    });
  }

  saveDatabase(db);
  saveUserCredentials(creds);

  // Invalidate bootstrap token immediately so it cannot be used again
  try {
    if (fs.existsSync(BOOTSTRAP_TOKEN_FILE)) {
      fs.unlinkSync(BOOTSTRAP_TOKEN_FILE);
    }
  } catch {}

  logAudit({
    userId: adminUser.id,
    user: adminUser.name,
    role: 'ADMINISTRATOR',
    action: 'FIRST_ADMINISTRATOR_BOOTSTRAPPED',
    recordType: 'AUTH',
    recordId: adminUser.id,
    details: { username: adminUser.username, email: adminUser.email },
  });

  return res.json({
    success: true,
    message: 'First administrator initialized securely. You may now log in.',
    user: {
      id: adminUser.id,
      username: adminUser.username,
      name: adminUser.name,
      role: adminUser.role,
      department: adminUser.department,
      email: adminUser.email,
    },
  });
});

app.post('/api/auth/login', (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) {
    return res.status(400).json({ success: false, error: 'Username/email and password are required.' });
  }

  const rateKey = getRateLimitKey(req, identifier);
  const rateStatus = isRateLimited(rateKey);
  if (rateStatus.locked) {
    return res.status(429).json({
      success: false,
      error: `Too many failed login attempts. Please wait ${rateStatus.waitSeconds || 300} seconds before trying again.`,
    });
  }

  const db = loadDatabase();
  const creds = ensureUserCredentials();
  const cleanId = String(identifier).trim().toLowerCase();

  let matchedUser = db.users.find(
    (u) =>
      u.username.toLowerCase() === cleanId ||
      u.email.toLowerCase() === cleanId ||
      u.id.toLowerCase() === cleanId
  );
  let matchedCred = creds.find(
    (c) =>
      c.username.toLowerCase() === cleanId ||
      c.email.toLowerCase() === cleanId ||
      (matchedUser && c.userId === matchedUser.id)
  );

  if (!matchedUser || !matchedCred || matchedUser.active === false || matchedCred.credentialStatus === 'DISABLED') {
    recordLoginFailure(rateKey);
    const isDeactivated = matchedUser && (matchedUser.active === false || matchedCred?.credentialStatus === 'DISABLED');
    logAudit({
      user: String(identifier),
      role: matchedUser ? matchedUser.role : 'UNAUTHENTICATED',
      action: isDeactivated ? 'USER_LOGIN_BLOCKED_DISABLED_ACCOUNT' : 'USER_LOGIN_FAILED',
      recordType: 'AUTH',
      recordId: matchedUser ? matchedUser.id : String(identifier),
      details: { reason: isDeactivated ? 'Account is disabled' : 'Unknown user identifier' },
    });
    return res.status(401).json({
      success: false,
      error: isDeactivated
        ? 'Account is disabled. Please contact your QMS Administrator.'
        : 'Invalid username/email or password.',
    });
  }

  // Check if account has not replaced default/initial credentials or is flagged for reset
  if (
    password === 'QMS2026!' ||
    password === 'Password123!' ||
    matchedCred.isDefaultPassword ||
    matchedCred.requiresPasswordReset ||
    matchedCred.credentialStatus === 'REQUIRES_REPLACEMENT'
  ) {
    recordLoginFailure(rateKey);
    logAudit({
      userId: matchedUser.id,
      user: matchedUser.name,
      role: matchedUser.role,
      action: 'USER_LOGIN_BLOCKED_DEFAULT_CREDENTIAL',
      recordType: 'AUTH',
      recordId: matchedUser.id,
      details: { reason: 'Default password or unmigrated account blocked in production' },
    });
    return res.status(403).json({
      success: false,
      error: 'Password reset required: Shared default credentials are not permitted in production. Please complete the authorized credential migration process.',
      requiresPasswordReset: true,
      userId: matchedUser.id,
      username: matchedUser.username,
    });
  }

  const valid = verifyUserCredential(String(password), matchedCred);
  if (!valid) {
    recordLoginFailure(rateKey);
    logAudit({
      userId: matchedUser.id,
      user: matchedUser.name,
      role: matchedUser.role,
      action: 'USER_LOGIN_FAILED',
      recordType: 'AUTH',
      recordId: matchedUser.id,
      details: { reason: 'Invalid password' },
    });
    return res.status(401).json({ success: false, error: 'Invalid username/email or password.' });
  }

  recordLoginSuccess(rateKey);

  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const token = signSessionToken(matchedUser, expiresAt);
  const session: AuthSession = {
    token,
    user: matchedUser,
    expiresAt,
    productionMode: true,
    authMode: 'PRODUCTION',
  };

  activeSessions.set(token, session);
  savePersistedSessions();

  // Set Secure, HTTP-Only Cookie with SameSite=Strict
  res.cookie('qms_session', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    maxAge: SESSION_TTL_MS,
    path: '/',
  });

  const auditEntry = logAudit({
    userId: matchedUser.id,
    user: matchedUser.name,
    role: matchedUser.role,
    action: 'USER_LOGIN',
    recordType: 'AUTH',
    recordId: matchedUser.id,
    details: { username: matchedUser.username, email: matchedUser.email, role: matchedUser.role },
  });

  if (auditEntry) {
    db.auditLogs = [auditEntry as any, ...(db.auditLogs || [])];
    saveDatabase(db);
  }

  res.json({ success: true, session });
});

// Operator Profile Registration (Strictly restricted to non-privileged roles)
app.post('/api/auth/register', (req, res) => {
  const { username, name, email, role, department, password } = req.body || {};
  if (!username || !name || !email || !role || !password) {
    return res.status(400).json({
      success: false,
      error: 'Full name, username, email, role, and password are required to create a login profile.',
    });
  }

  // Stage 1.1: Block public self-registration of privileged roles or quality release authority
  const privilegedRoles: UserRole[] = [
    'ADMINISTRATOR',
    'MANAGEMENT',
    'ENGINEERING',
    'HSEQ',
    'MACHINE_MANAGER',
    'INSPECTOR',
  ];
  if (privilegedRoles.includes(role)) {
    logAudit({
      user: String(username),
      role: 'UNAUTHENTICATED',
      action: 'PUBLIC_ADMIN_REGISTRATION_BLOCKED',
      recordType: 'AUTH',
      recordId: String(username),
      details: { attemptedRole: role },
    });
    return res.status(403).json({
      success: false,
      error: `FORBIDDEN: Public self-registration for role '${role}' (quality/release authority) is disabled. Contact an Administrator.`,
    });
  }

  if (role !== 'MACHINIST') {
    return res.status(400).json({
      success: false,
      error: `Invalid operator role specified: ${role}. Public self-registration is strictly restricted to workshop machinists only.`,
    });
  }

  const cleanPass = String(password).trim();
  if (cleanPass.length < 8) {
    return res.status(400).json({
      success: false,
      error: 'Password must be at least 8 characters long.',
    });
  }
  if (cleanPass === 'QMS2026!' || cleanPass.toLowerCase().includes('qms2026') || cleanPass === 'Password123!') {
    return res.status(400).json({
      success: false,
      error: 'Password cannot be a known default or common password.',
    });
  }

  const db = loadDatabase();
  const creds = ensureUserCredentials();
  const cleanUser = String(username).trim().toLowerCase();
  const cleanEmail = String(email).trim().toLowerCase();

  if (db.users.some((u) => u.username.toLowerCase() === cleanUser)) {
    return res.status(400).json({
      success: false,
      error: `Username "${cleanUser}" is already registered. Please sign in or choose a different username.`,
    });
  }
  if (db.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
    return res.status(400).json({
      success: false,
      error: `Email "${cleanEmail}" is already registered. Please sign in or use a different email.`,
    });
  }

  let nextNum = db.users.length + 1;
  let newId = `USR-${String(nextNum).padStart(3, '0')}`;
  while (db.users.some((u) => u.id === newId)) {
    nextNum++;
    newId = `USR-${String(nextNum).padStart(3, '0')}`;
  }

  const createdUser: User = {
    id: newId,
    username: cleanUser,
    name: String(name).trim(),
    role: role as UserRole,
    department: String(department || 'Machine Shop').trim(),
    email: String(email).trim(),
    active: true,
  };

  const salt = crypto.randomBytes(16).toString('hex');
  creds.push({
    userId: newId,
    username: cleanUser,
    email: createdUser.email,
    salt,
    passwordHash: hashPassword(String(password), salt),
    isDefaultPassword: false,
    updatedAt: new Date().toISOString(),
  });
  saveUserCredentials(creds);

  db.users.push(createdUser);

  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const token = signSessionToken(createdUser, expiresAt);
  const session: AuthSession = {
    token,
    user: createdUser,
    expiresAt,
    productionMode: true,
    authMode: 'PRODUCTION',
  };
  activeSessions.set(token, session);
  savePersistedSessions();

  res.cookie('qms_session', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    maxAge: SESSION_TTL_MS,
    path: '/',
  });

  const auditEntry = logAudit({
    userId: createdUser.id,
    user: createdUser.name,
    role: createdUser.role,
    action: 'USER_ACCOUNT_CREATED',
    recordType: 'AUTH',
    recordId: createdUser.id,
    details: {
      username: createdUser.username,
      email: createdUser.email,
      role: createdUser.role,
      department: createdUser.department,
      registrationType: 'OPERATOR_PROFILE_CREATED',
    },
  });

  if (auditEntry) {
    db.auditLogs = [auditEntry as any, ...(db.auditLogs || [])];
  }
  saveDatabase(db);

  return res.json({ success: true, user: createdUser, session });
});


app.post('/api/auth/logout', (req, res) => {
  const cookies = parseCookies(req);
  let rawToken = cookies['qms_session'] || '';
  if (!rawToken && req.headers.authorization?.startsWith('Bearer ')) {
    rawToken = req.headers.authorization.slice(7).trim();
  }
  if (!rawToken && typeof req.headers['x-qms-session-token'] === 'string') {
    rawToken = (req.headers['x-qms-session-token'] as string).trim();
  }

  const session = getSessionFromRequest(req);
  if (rawToken) {
    revokedTokens.add(rawToken);
    activeSessions.delete(rawToken);
  }
  if (session) {
    revokedTokens.add(session.token);
    activeSessions.delete(session.token);
    savePersistedSessions();
    const db = loadDatabase();
    const auditEntry = logAudit({
      userId: session.user.id,
      user: session.user.name,
      role: session.user.role,
      action: 'USER_LOGOUT',
      recordType: 'AUTH',
      recordId: session.user.id,
    });
    if (auditEntry) {
      db.auditLogs = [auditEntry as any, ...(db.auditLogs || [])];
      saveDatabase(db);
    }
  } else {
    savePersistedSessions();
  }
  res.clearCookie('qms_session', { path: '/' });
  res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ success: false, error: 'No active authenticated session.' });
  }
  res.json({ success: true, session });
});

// Explicit Authorized Credential Migration & Password Replacement Workflow
app.post('/api/auth/migrate-credential', (req, res) => {
  const { identifier, currentCredential, newPassword, authorizationCode } = req.body || {};
  if (!identifier || !newPassword) {
    return res.status(400).json({
      success: false,
      error: 'Identifier and new password are required.',
    });
  }

  const cleanId = String(identifier).trim().toLowerCase();
  const cleanNewPass = String(newPassword).trim();

  if (cleanNewPass.length < 8) {
    return res.status(400).json({
      success: false,
      error: 'New password must be at least 8 characters long.',
    });
  }

  if (
    cleanNewPass === 'QMS2026!' ||
    cleanNewPass.toLowerCase().includes('qms2026') ||
    cleanNewPass === 'Password123!'
  ) {
    return res.status(400).json({
      success: false,
      error: 'New password cannot be a known default or predictable password.',
    });
  }

  const db = loadDatabase();
  const creds = ensureUserCredentials();
  const user = db.users.find(
    (u) =>
      u.username.toLowerCase() === cleanId ||
      u.email.toLowerCase() === cleanId ||
      u.id === cleanId
  );
  const credIdx = creds.findIndex(
    (c) =>
      c.username.toLowerCase() === cleanId ||
      c.email.toLowerCase() === cleanId ||
      (user && c.userId === user.id)
  );

  if (!user || credIdx === -1 || user.active === false || creds[credIdx].credentialStatus === 'DISABLED') {
    return res.status(404).json({ success: false, error: 'User not found or account is disabled.' });
  }

  const targetCred = creds[credIdx];

  // Strictly block any attempt to authenticate or migrate using the known default password
  if (currentCredential === 'QMS2026!' || currentCredential === 'Password123!') {
    logAudit({
      userId: user.id,
      user: user.name,
      role: user.role,
      action: 'CREDENTIAL_MIGRATION_BLOCKED_DEFAULT_PASSWORD',
      recordType: 'AUTH',
      recordId: user.id,
      details: { reason: 'Attempted to use known default password for account migration' },
    });
    return res.status(403).json({
      success: false,
      error: 'SECURITY REJECTION: Known shared default passwords are not accepted for account migration. An administrator-issued migration code or administrator reset is required.',
    });
  }

  let authorized = false;

  // 1. Established accounts: verify current individually established password
  if (targetCred.credentialStatus === 'ACTIVE_INDIVIDUAL' && currentCredential) {
    authorized = verifyPassword(String(currentCredential), targetCred.salt, targetCred.passwordHash);
  }

  // 2. Unmigrated accounts: verify administrator-issued one-time migration code
  if (!authorized && targetCred.migrationAuthCode && authorizationCode) {
    const isCodeMatch = String(authorizationCode).trim() === targetCred.migrationAuthCode.trim();
    const isNotExpired =
      !targetCred.migrationCodeExpiresAt ||
      new Date(targetCred.migrationCodeExpiresAt).getTime() > Date.now();
    if (isCodeMatch && isNotExpired) {
      authorized = true;
    }
  }

  // 3. Alternatively, direct administrative authorization via active Administrator session
  const adminSession = getSessionFromRequest(req);
  if (!authorized && adminSession && adminSession.user.role === 'ADMINISTRATOR') {
    authorized = true;
  }

  if (!authorized) {
    logAudit({
      userId: user.id,
      user: user.name,
      role: user.role,
      action: 'CREDENTIAL_MIGRATION_FAILED',
      recordType: 'AUTH',
      recordId: user.id,
      details: { reason: 'Unauthorized credential migration attempt. Missing or invalid authorization code/current credential.' },
    });
    return res.status(401).json({
      success: false,
      error: 'Credential migration unauthorized: An administrator-issued migration code or valid current password is required.',
    });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(cleanNewPass, salt);
  creds[credIdx].salt = salt;
  creds[credIdx].passwordHash = passwordHash;
  creds[credIdx].isDefaultPassword = false;
  creds[credIdx].requiresPasswordReset = false;
  creds[credIdx].credentialStatus = 'ACTIVE_INDIVIDUAL';
  creds[credIdx].migrationAuthCode = undefined;
  creds[credIdx].migrationCodeExpiresAt = undefined;
  creds[credIdx].passwordEstablishedAt = new Date().toISOString();
  creds[credIdx].updatedAt = new Date().toISOString();
  saveUserCredentials(creds);

  for (const [token, sess] of activeSessions.entries()) {
    if (sess.user.id === user.id) {
      activeSessions.delete(token);
    }
  }
  savePersistedSessions();

  logAudit({
    userId: user.id,
    user: user.name,
    role: user.role,
    action: 'CREDENTIAL_MIGRATION_COMPLETED',
    recordType: 'AUTH',
    recordId: user.id,
    details: { message: 'Individual production credential established successfully' },
  });

  return res.json({
    success: true,
    message: `Individual production credential established for ${user.name}. You may now log in.`,
  });
});

// Production Credential Status Report Endpoint (Authorized Administrators only)
app.get('/api/auth/credential-status', (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session || session.user.role !== 'ADMINISTRATOR') {
    return res.status(403).json({ success: false, error: 'Administrator access required.' });
  }

  const db = loadDatabase();
  const creds = ensureUserCredentials();
  const summary = db.users.map((u) => {
    const c = creds.find((cr) => cr.userId === u.id || cr.username.toLowerCase() === u.username.toLowerCase());
    const status = !u.active
      ? 'DISABLED'
      : c?.credentialStatus || (c?.requiresPasswordReset || c?.isDefaultPassword ? 'REQUIRES_REPLACEMENT' : 'ACTIVE_INDIVIDUAL');
    return {
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      department: u.department,
      active: u.active,
      credentialStatus: status,
      passwordEstablishedAt: c?.passwordEstablishedAt || null,
    };
  });

  return res.json({
    success: true,
    totalAccounts: summary.length,
    activeAccounts: summary.filter((s) => s.active).length,
    disabledAccounts: summary.filter((s) => !s.active).length,
    credentialsReplaced: summary.filter((s) => s.credentialStatus === 'ACTIVE_INDIVIDUAL').length,
    credentialsPendingAction: summary.filter((s) => s.credentialStatus === 'REQUIRES_REPLACEMENT').length,
    accounts: summary,
  });
});

// Direct role switching without credentials is permanently blocked in Production Mode
app.post('/api/auth/switch-role', (req, res) => {
  const session = getSessionFromRequest(req);
  const { targetUserId } = req.body || {};

  logAudit({
    userId: session?.user.id || 'ANONYMOUS',
    user: session?.user.name || 'Anonymous',
    role: session?.user.role || 'NONE',
    action: 'ROLE_SWITCH_BLOCKED',
    recordType: 'AUTH',
    recordId: String(targetUserId || 'UNKNOWN'),
    details: {
      reason: 'Direct role switching is permanently disabled in Production Mode. Credential login required.',
    },
  });

  return res.status(403).json({
    success: false,
    error:
      'SECURITY VIOLATION: Direct role switching is disabled. You must sign in with valid username and password credentials.',
  });
});

// Administrator User & Password Management Endpoint
app.post('/api/users', (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }
  if (session.user.role !== 'ADMINISTRATOR') {
    logAudit({
      userId: session.user.id,
      user: session.user.name,
      role: session.user.role,
      action: 'UNAUTHORIZED_ACTION_BLOCKED',
      recordType: 'AUTH',
      recordId: 'MANAGE_USERS',
      details: { reason: `Role ${session.user.role} attempted to modify user accounts` },
    });
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN: Only ADMINISTRATOR may create or modify user accounts.',
    });
  }

  const { operation, user, targetUserId, newPassword, active } = req.body || {};
  const db = loadDatabase();
  const creds = ensureUserCredentials();

  if (operation === 'CREATE_USER') {
    if (!user?.username || !user?.name || !user?.role || !user?.email || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Username, name, role, email, and password are required.',
      });
    }
    const cleanUser = String(user.username).trim().toLowerCase();
    if (db.users.some((u) => u.username.toLowerCase() === cleanUser)) {
      return res.status(400).json({ success: false, error: 'Username already exists.' });
    }
    const newId = `USR-${String(db.users.length + 1).padStart(3, '0')}`;
    const createdUser: User = {
      id: newId,
      username: cleanUser,
      name: String(user.name).trim(),
      role: user.role,
      department: String(user.department || 'Machine Shop'),
      email: String(user.email).trim(),
      active: true,
    };
    const salt = crypto.randomBytes(16).toString('hex');
    creds.push({
      userId: newId,
      username: createdUser.username,
      email: createdUser.email,
      salt,
      passwordHash: hashPassword(String(newPassword), salt),
      updatedAt: new Date().toISOString(),
    });
    saveUserCredentials(creds);

    db.users.push(createdUser);
    const audit = logAudit({
      userId: session.user.id,
      user: session.user.name,
      role: session.user.role,
      action: 'CREATE_USER',
      recordType: 'AUTH',
      recordId: newId,
      details: { username: createdUser.username, role: createdUser.role },
    });
    if (audit) db.auditLogs = [audit as any, ...(db.auditLogs || [])];
    saveDatabase(db);
    return res.json({ success: true, user: createdUser });
  }

  if (operation === 'RESET_PASSWORD') {
    if (!targetUserId || !newPassword || String(newPassword).length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Valid targetUserId and individual password (min 8 chars) are required.',
      });
    }
    const cleanPass = String(newPassword).trim();
    if (cleanPass === 'QMS2026!' || cleanPass.toLowerCase().includes('qms2026') || cleanPass === 'Password123!') {
      return res.status(400).json({
        success: false,
        error: 'New password cannot be a known default or common password.',
      });
    }
    const credIdx = creds.findIndex((c) => c.userId === targetUserId);
    if (credIdx === -1) {
      return res.status(404).json({ success: false, error: 'User credentials not found.' });
    }
    const salt = crypto.randomBytes(16).toString('hex');
    creds[credIdx].salt = salt;
    creds[credIdx].passwordHash = hashPassword(cleanPass, salt);
    creds[credIdx].isDefaultPassword = false;
    creds[credIdx].requiresPasswordReset = false;
    creds[credIdx].credentialStatus = 'ACTIVE_INDIVIDUAL';
    creds[credIdx].passwordEstablishedAt = new Date().toISOString();
    creds[credIdx].updatedAt = new Date().toISOString();
    saveUserCredentials(creds);

    // Invalidate active sessions for target user
    for (const [token, sess] of activeSessions.entries()) {
      if (sess.user.id === targetUserId) {
        activeSessions.delete(token);
      }
    }
    savePersistedSessions();

    const audit = logAudit({
      userId: session.user.id,
      user: session.user.name,
      role: session.user.role,
      action: 'PASSWORD_RESET',
      recordType: 'AUTH',
      recordId: targetUserId,
    });
    if (audit) {
      db.auditLogs = [audit as any, ...(db.auditLogs || [])];
      saveDatabase(db);
    }
    return res.json({ success: true });
  }

  if (operation === 'GENERATE_MIGRATION_CODE') {
    if (!targetUserId) {
      return res.status(400).json({ success: false, error: 'targetUserId is required.' });
    }
    const credIdx = creds.findIndex((c) => c.userId === targetUserId);
    if (credIdx === -1) {
      return res.status(404).json({ success: false, error: 'User credentials not found.' });
    }
    const code = `MIG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    creds[credIdx].migrationAuthCode = code;
    creds[credIdx].migrationCodeExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    saveUserCredentials(creds);

    const audit = logAudit({
      userId: session.user.id,
      user: session.user.name,
      role: session.user.role,
      action: 'MIGRATION_CODE_GENERATED',
      recordType: 'AUTH',
      recordId: targetUserId,
      details: { targetUserId },
    });
    if (audit) {
      db.auditLogs = [audit as any, ...(db.auditLogs || [])];
      saveDatabase(db);
    }
    return res.json({
      success: true,
      migrationAuthCode: code,
      expiresAt: creds[credIdx].migrationCodeExpiresAt,
    });
  }

  if (operation === 'TOGGLE_ACTIVE') {
    const idx = db.users.findIndex((u) => u.id === targetUserId);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    db.users[idx].active = Boolean(active);
    const audit = logAudit({
      userId: session.user.id,
      user: session.user.name,
      role: session.user.role,
      action: 'UPDATE_USER_STATUS',
      recordType: 'AUTH',
      recordId: targetUserId,
      details: { active: Boolean(active) },
    });
    if (audit) db.auditLogs = [audit as any, ...(db.auditLogs || [])];
    saveDatabase(db);
    return res.json({ success: true, user: db.users[idx] });
  }

  if (operation === 'DELETE_USER') {
    if (!targetUserId) {
      return res.status(400).json({ success: false, error: 'targetUserId is required.' });
    }
    if (targetUserId === session.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete your own currently active Administrator account.',
      });
    }
    const targetUser = db.users.find((u) => u.id === targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    db.users = db.users.filter((u) => u.id !== targetUserId);
    const delKeys = new Set(db.deletedRecordKeys || []);
    delKeys.add(`USER:${targetUser.id.toUpperCase()}`);
    delKeys.add(`USER:${targetUser.username.toUpperCase()}`);
    db.deletedRecordKeys = Array.from(delKeys);

    const remainingCreds = creds.filter(
      (c) =>
        c.userId !== targetUserId &&
        c.username.toLowerCase() !== targetUser.username.toLowerCase()
    );
    saveUserCredentials(remainingCreds);

    const audit = logAudit({
      userId: session.user.id,
      user: session.user.name,
      role: session.user.role,
      action: 'ADMIN_DELETE_RECORD',
      recordType: 'AUTH',
      recordId: targetUserId,
      details: { deletedUsername: targetUser.username, deletedName: targetUser.name },
    });
    if (audit) db.auditLogs = [audit as any, ...(db.auditLogs || [])];
    saveDatabase(db);
    return res.json({ success: true });
  }

  return res.status(400).json({ success: false, error: 'Unsupported user operation.' });
});

// ==========================================
// 6. REAL FILE ATTACHMENT STORAGE ENDPOINTS
// ==========================================

app.post('/api/attachments/upload', (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Authentication required to upload files.' });
  }

  const allowedActions = ROLE_ALLOWED_ACTIONS[session.user.role] || [];
  if (!allowedActions.includes('FILE_UPLOAD')) {
    return res.status(403).json({ success: false, error: 'Role not permitted to upload files.' });
  }

  const { originalFilename, mimeType, base64Data, category, relatedRecordId, drawingNumber, revision } =
    req.body || {};

  if (!originalFilename || !base64Data || !category) {
    return res.status(400).json({
      success: false,
      error: 'originalFilename, base64Data, and category are required for file upload.',
    });
  }

  try {
    const cleanBase64 = String(base64Data).includes(',')
      ? String(base64Data).split(',')[1]
      : String(base64Data);
    const buffer = Buffer.from(cleanBase64, 'base64');

    if (buffer.length === 0) {
      return res.status(400).json({ success: false, error: 'Uploaded file cannot be empty (0 bytes).' });
    }

    const fileId = `ATT-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const safeOrigName = String(originalFilename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedFilename = `${fileId}_${safeOrigName}`;
    const filePath = path.join(ATTACHMENTS_DIR, storedFilename);

    fs.writeFileSync(filePath, buffer);

    const attachment: FileAttachmentMetadata = {
      fileId,
      originalFilename: String(originalFilename),
      storedFilename,
      mimeType: String(mimeType || 'application/octet-stream'),
      fileSize: buffer.length,
      uploadDate: new Date().toISOString(),
      uploadedBy: session.user.name,
      uploadedById: session.user.id,
      category,
      relatedRecordId,
      drawingNumber,
      revision,
      downloadUrl: `/api/attachments/${fileId}`,
    };

    const db = loadDatabase();
    const auditEntry = logAudit({
      userId: session.user.id,
      user: session.user.name,
      role: session.user.role,
      action: 'FILE_UPLOAD',
      recordType: 'ATTACHMENT',
      recordId: fileId,
      details: {
        originalFilename: attachment.originalFilename,
        fileSize: attachment.fileSize,
        category: attachment.category,
        relatedRecordId: attachment.relatedRecordId,
      },
      newValue: JSON.stringify(attachment),
    });

    db.attachments = [attachment, ...(db.attachments || [])];
    if (auditEntry) {
      db.auditLogs = [auditEntry as any, ...(db.auditLogs || [])];
    }
    saveDatabase(db);

    res.json({ success: true, attachment });
  } catch (err: any) {
    console.error('File upload error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to store uploaded file.' });
  }
});

app.get('/api/attachments/:fileId', (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Authentication required to access controlled attachments.' });
  }

  const { fileId } = req.params;
  const db = loadDatabase();
  const att = (db.attachments || []).find((a) => a.fileId === fileId);

  if (!att) {
    return res.status(404).json({ success: false, error: 'Attachment metadata not found.' });
  }

  const safeFilePath = path.resolve(ATTACHMENTS_DIR, att.storedFilename);
  if (!safeFilePath.startsWith(path.resolve(ATTACHMENTS_DIR))) {
    return res.status(400).json({ success: false, error: 'Security violation: Path traversal detected.' });
  }

  if (!fs.existsSync(safeFilePath)) {
    return res.status(404).json({ success: false, error: 'Stored attachment file not found on server disk.' });
  }

  res.setHeader('Content-Type', att.mimeType || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${att.originalFilename.replace(/"/g, '')}"`
  );
  res.sendFile(safeFilePath);
});

app.get('/api/attachments/:fileId/meta', (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }

  const { fileId } = req.params;
  const db = loadDatabase();
  const att = (db.attachments || []).find((a) => a.fileId === fileId);
  if (!att) {
    return res.status(404).json({ success: false, error: 'Attachment not found.' });
  }
  res.json({ success: true, attachment: att });
});

// ==========================================
// 7. DATABASE & AUDIT API ENDPOINTS
// ==========================================

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), service: 'MACHINE QMS Backend' });
});

app.get('/api/db', (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required to access QMS database.',
    });
  }
  const data = loadDatabase();
  res.json({ success: true, data });
});

// ==========================================
// 8. OFFICIAL QUALITY REPORT GENERATION APIS
// ==========================================
app.get('/api/reports/:type/:id', (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Authentication required to generate quality reports.' });
  }

  const { type, id } = req.params;
  const db = loadDatabase();
  let result;

  switch (type) {
    case 'department':
    case 'department-inspection':
      result = ReportService.generateDepartmentInspectionSheet(db, id);
      break;
    case 'dimensional':
    case 'dimensional-inspection':
      result = ReportService.generateDimensionalInspectionSheet(db, id);
      break;
    case 'traceability':
    case 'component-traceability':
      result = ReportService.generateComponentTraceabilityReport(db, id);
      break;
    case 'ncr':
      result = ReportService.generateNCRReport(db, id);
      break;
    case 'deviation':
      result = ReportService.generateDeviationReport(db, id);
      break;
    case 'release-certificate':
    case 'quality-release-certificate':
      result = ReportService.generateComponentQualityReleaseCertificate(db, id);
      break;
    case 'machine':
    case 'machine-release-record':
      result = ReportService.generateFinalMachineReleaseRecord(db, id);
      break;
    default:
      return res.status(400).json({ success: false, error: `Unknown report type "${type}".` });
  }

  if (req.query.format === 'html' && result.html) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(result.html);
  }

  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
});

// Non-destructive bidirectional database, user credentials & attachment sync across app updates and container rollouts
app.post('/api/db/sync-merge', (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required to sync QMS database.',
    });
  }

  if (session.user.role === 'MANAGEMENT') {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN: Read-only Management role cannot sync or modify database.',
    });
  }

  const { clientDb, clientCreds, attachmentBlobs } = req.body || {};
  const existingDb = loadDatabase();
  const merged =
    clientDb && typeof clientDb === 'object'
      ? mergeQMSDatabases(clientDb, existingDb, INITIAL_DATABASE)
      : existingDb;



  // 2. Non-destructively restore any missing attachment files from client IndexedDB vault onto server disk
  if (attachmentBlobs && typeof attachmentBlobs === 'object') {
    for (const [fileId, dataUrl] of Object.entries(attachmentBlobs)) {
      if (!fileId || typeof dataUrl !== 'string') continue;
      const att = (merged.attachments || []).find((a) => a.fileId === fileId);
      if (att && att.storedFilename) {
        const filePath = path.join(ATTACHMENTS_DIR, att.storedFilename);
        if (!fs.existsSync(filePath)) {
          try {
            const cleanBase64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
            const buf = Buffer.from(cleanBase64, 'base64');
            if (buf.length > 0) {
              fs.writeFileSync(filePath, buf);
            }
          } catch {
            // ignore malformed blob
          }
        }
      }
    }
  }

  saveDatabase(merged);
  return res.json({ success: true, data: merged });
});

// Save database with strict server-side authentication, RBAC, collection isolation, and release-gate validation
app.post('/api/db', (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    logAudit({
      user: 'UNAUTHENTICATED',
      role: 'NONE',
      action: 'UNAUTHORIZED_ACTION_BLOCKED',
      recordType: 'DATABASE',
      recordId: 'POST_API_DB',
      details: { reason: 'Unauthenticated attempt to mutate database via POST /api/db' },
    });
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED: Valid server authentication session is required to modify QMS records.',
    });
  }

  const { data, action, details } = req.body || {};
  if (!data || !action) {
    return res.status(400).json({ success: false, error: 'Data payload and action are required.' });
  }

  const sessionUser = session.user;

  // Strict server-side least-privilege barrier for Management role
  if (sessionUser.role === 'MANAGEMENT') {
    logAudit({
      userId: sessionUser.id,
      user: sessionUser.name,
      role: sessionUser.role,
      action: 'UNAUTHORIZED_ACTION_BLOCKED',
      recordType: 'SECURITY',
      recordId: action,
      details: {
        reason: 'Management role has strictly read-only executive privileges. Mutation attempt blocked.',
        attemptedAction: action,
      },
    });
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN: Management accounts have read-only executive access. Record creation, update, or deletion is prohibited.',
    });
  }

  const allowedActions = ROLE_ALLOWED_ACTIONS[sessionUser.role] || [];

  // 1. Check Database Reset / Restore / Admin Deletion strictly restricted to ADMINISTRATOR
  const adminOnlyActions = [
    'RESET_TO_DEFAULTS',
    'RESTORE_DATABASE_BACKUP',
    'ADMIN_DELETE_RECORD',
    'ADMIN_CLEAR_LIST',
    'ADMIN_CLEAR_ALL_DATA',
  ];
  if (adminOnlyActions.includes(action)) {
    if (sessionUser.role !== 'ADMINISTRATOR') {
      logAudit({
        userId: sessionUser.id,
        user: sessionUser.name,
        role: sessionUser.role,
        action: 'UNAUTHORIZED_ACTION_BLOCKED',
        recordType: 'DATABASE',
        recordId: action,
        details: { reason: `Role ${sessionUser.role} attempted restricted database operation ${action}` },
      });
      return res.status(403).json({
        success: false,
        error: `FORBIDDEN: Only ADMINISTRATOR may perform ${action}. Current role: ${sessionUser.role}.`,
      });
    }
  }

  // 2. Check role permission for requested action
  if (!allowedActions.includes(action)) {
    logAudit({
      userId: sessionUser.id,
      user: sessionUser.name,
      role: sessionUser.role,
      action: 'UNAUTHORIZED_ACTION_BLOCKED',
      recordType: details?.recordType || 'SYSTEM',
      recordId: details?.recordId || action,
      details: { attemptedAction: action, userRole: sessionUser.role },
    });
    return res.status(403).json({
      success: false,
      error: `PERMISSION DENIED: Role '${sessionUser.role}' is not authorized to perform '${action}'.`,
    });
  }

  const existingDb = loadDatabase();

  // 3. Server-side Separation of Duties & Quality Release Gate Enforcement
  if (action === 'INSPECTOR_SIGNOFF') {
    const inspId = details?.recordId;
    const updatedInsp = (data.inspections || []).find((i: any) => i.id === inspId);
    if (updatedInsp) {
      if (updatedInsp.machinistId === sessionUser.id) {
        logAudit({
          userId: sessionUser.id,
          user: sessionUser.name,
          role: sessionUser.role,
          action: 'UNAUTHORIZED_ACTION_BLOCKED',
          recordType: 'INSPECTION',
          recordId: inspId,
          details: { reason: 'Separation of duties violation: Machinist attempted to sign off own inspection' },
        });
        return res.status(403).json({
          success: false,
          error: `SEPARATION OF DUTIES VIOLATION: User ${sessionUser.name} (${sessionUser.id}) manufactured this component and cannot sign off its inspection.`,
        });
      }
    }
  }

  if (action === 'QUALITY_RELEASE_EXECUTED') {
    const mfgRecordId = details?.manufacturingRecordId;
    const targetRecord = (existingDb.manufacturingRecords || []).find((r) => r.id === mfgRecordId);
    if (!targetRecord) {
      return res.status(404).json({ success: false, error: 'Target manufacturing record not found for release.' });
    }

    // Check separation of duties by immutable user ID regardless of role
    if (targetRecord.machinistId === sessionUser.id) {
      logAudit({
        userId: sessionUser.id,
        user: sessionUser.name,
        role: sessionUser.role,
        action: 'QUALITY_RELEASE_BLOCKED',
        recordType: 'RELEASE',
        recordId: targetRecord.traceabilityNumber,
        details: { reason: `Machinist (${sessionUser.id}) attempted to release own manufactured component` },
      });
      return res.status(403).json({
        success: false,
        error: `SEPARATION OF DUTIES VIOLATION: User ${sessionUser.name} (${sessionUser.id}) manufactured component ${targetRecord.traceabilityNumber} and is strictly forbidden from releasing it.`,
      });
    }

    // Run full 18-point Quality Release Gate on the server before allowing release
    const gateEval = DBService.evaluateQualityReleaseGates(existingDb, mfgRecordId, sessionUser);
    if (!gateEval.canRelease) {
      logAudit({
        userId: sessionUser.id,
        user: sessionUser.name,
        role: sessionUser.role,
        action: 'QUALITY_RELEASE_BLOCKED',
        recordType: 'RELEASE',
        recordId: targetRecord.traceabilityNumber,
        details: { blockingReasons: gateEval.blockingReasons },
      });
      return res.status(400).json({
        success: false,
        error: `SERVER QUALITY GATE BLOCKED RELEASE: ${gateEval.blockingReasons.join(' | ')}`,
      });
    }
  }

  // Prevent silent status change to RELEASED outside QUALITY_RELEASE_EXECUTED
  if (
    !['QUALITY_RELEASE_EXECUTED', 'RESET_TO_DEFAULTS', 'RESTORE_DATABASE_BACKUP', 'ADMIN_DELETE_RECORD', 'ADMIN_CLEAR_LIST', 'ADMIN_CLEAR_ALL_DATA'].includes(action)
  ) {
    for (const incomingRec of data.manufacturingRecords || []) {
      const prevRec = (existingDb.manufacturingRecords || []).find((r) => r.id === incomingRec.id);
      if (incomingRec.manufacturingStatus === 'RELEASED' && (!prevRec || prevRec.manufacturingStatus !== 'RELEASED')) {
        return res.status(403).json({
          success: false,
          error: 'Direct status transition to RELEASED is blocked. Must use QUALITY_RELEASE_EXECUTED.',
        });
      }
    }
  }

  // 4. Collection-Level Write Isolation based on Action & Role
  let mergedDb: QMSDatabase;
  if (action === 'RESET_TO_DEFAULTS') {
    mergedDb = {
      ...INITIAL_DATABASE,
      users: existingDb.users,
      deletedRecordKeys: [],
    };
  } else if (
    action === 'RESTORE_DATABASE_BACKUP' ||
    action === 'ADMIN_DELETE_RECORD' ||
    action === 'ADMIN_CLEAR_LIST' ||
    action === 'ADMIN_CLEAR_ALL_DATA'
  ) {
    mergedDb = {
      ...existingDb,
      ...data,
      users: sessionUser.role === 'ADMINISTRATOR' && Array.isArray(data.users) ? data.users : existingDb.users,
      deletedRecordKeys: Array.isArray(data.deletedRecordKeys)
        ? data.deletedRecordKeys
        : existingDb.deletedRecordKeys || [],
      lastUpdated: new Date().toISOString(),
    };
  } else {
    const crossPopulateActions = [
      'CREATE_MACHINE',
      'UPDATE_MACHINE',
      'CREATE_PROJECT',
      'UPDATE_PROJECT',
      'CREATE_COMPONENT',
      'UPDATE_COMPONENT',
      'CREATE_DRAWING',
      'UPDATE_DRAWING',
      'REVISE_DRAWING',
      'APPROVE_DRAWING',
      'CREATE_MANUFACTURING_RECORD',
      'UPDATE_MANUFACTURING_RECORD',
      'IMPORT_MACHINE_BOM_EXCEL',
    ];
    const isCrossPopulatedMutation = crossPopulateActions.includes(action);

    mergedDb = {
      ...existingDb,
      // Users collection can never be overwritten via generic /api/db POST
      users: existingDb.users,
      machines: isCrossPopulatedMutation && Array.isArray(data.machines)
        ? data.machines
        : existingDb.machines,
      projects: isCrossPopulatedMutation && Array.isArray(data.projects)
        ? data.projects
        : existingDb.projects,
      components: isCrossPopulatedMutation && Array.isArray(data.components)
        ? data.components
        : existingDb.components,
      drawings: isCrossPopulatedMutation && Array.isArray(data.drawings)
        ? data.drawings
        : existingDb.drawings,
      manufacturingRecords: [
        'CREATE_MANUFACTURING_RECORD',
        'UPDATE_MANUFACTURING_RECORD',
        'COMPLETE_PERMANENT_IDENTIFICATION',
        'START_INSPECTION',
        'RECORD_MEASUREMENT',
        'MEASUREMENT_CHANGED',
        'AUTOMATIC_HOLD',
        'INSPECTOR_SIGNOFF',
        'CREATE_NCR',
        'UPDATE_NCR',
        'CLOSE_NCR',
        'QUALITY_RELEASE_EXECUTED',
        'UPDATE_DALE_INSPECTION',
        'SUBMIT_DALE_INSPECTION',
        'BATCH_CREATE_DALE_INSPECTIONS',
        'AUTO_RECORD_NCR_FROM_INSPECTION_POINT',
        'AUTO_RECORD_NCR_FROM_INSPECTION_REJECTION',
        'APPROVE_DALE_INSPECTION',
        'RESET_DALE_INSPECTIONS',
        'HANDOVER_SIGNOFF',
      ].includes(action) && Array.isArray(data.manufacturingRecords)
        ? data.manufacturingRecords
        : existingDb.manufacturingRecords,
      inspections: [
        'START_INSPECTION',
        'UPDATE_INSPECTION',
        'RECORD_MEASUREMENT',
        'MEASUREMENT_CHANGED',
        'AUTOMATIC_HOLD',
        'INSPECTOR_SIGNOFF',
        'CREATE_NCR',
        'APPROVE_DEVIATION',
        'UPDATE_DEVIATION',
        'HANDOVER_SIGNOFF',
        'AUTO_RECORD_NCR_FROM_INSPECTION_POINT',
        'AUTO_RECORD_NCR_FROM_INSPECTION_REJECTION',
        'CREATE_MANUFACTURING_RECORD',
        'UPDATE_MANUFACTURING_RECORD',
      ].includes(action) && Array.isArray(data.inspections)
        ? data.inspections
        : existingDb.inspections,
      ncrs: [
        'CREATE_NCR',
        'UPDATE_NCR',
        'CLOSE_NCR',
        'UPDATE_DALE_INSPECTION',
        'SUBMIT_DALE_INSPECTION',
        'AUTO_RECORD_NCR_FROM_INSPECTION_POINT',
        'AUTO_RECORD_NCR_FROM_INSPECTION_REJECTION',
        'APPROVE_DALE_INSPECTION',
      ].includes(action) && Array.isArray(data.ncrs)
        ? data.ncrs
        : existingDb.ncrs,
      deviations: ['CREATE_DEVIATION', 'UPDATE_DEVIATION', 'APPROVE_DEVIATION'].includes(action)
        ? data.deviations
        : existingDb.deviations,
      releases: action === 'QUALITY_RELEASE_EXECUTED' ? data.releases : existingDb.releases,
      daleInspections: [
        'UPDATE_DALE_INSPECTION',
        'SUBMIT_DALE_INSPECTION',
        'BATCH_CREATE_DALE_INSPECTIONS',
        'AUTO_RECORD_NCR_FROM_INSPECTION_POINT',
        'AUTO_RECORD_NCR_FROM_INSPECTION_REJECTION',
        'APPROVE_DALE_INSPECTION',
        'RESET_DALE_INSPECTIONS',
      ].includes(action) && Array.isArray(data.daleInspections)
        ? data.daleInspections
        : Array.isArray(data.daleInspections) && data.daleInspections.length > 0
        ? data.daleInspections
        : existingDb.daleInspections || [],
      inspectionTemplates: [
        'CREATE_INSPECTION_TEMPLATE',
        'UPDATE_INSPECTION_TEMPLATE',
        'APPROVE_INSPECTION_TEMPLATE',
        'REVISE_INSPECTION_TEMPLATE',
        'OBSOLETE_INSPECTION_TEMPLATE',
        'ASSIGN_INSPECTION_TEMPLATE',
      ].includes(action) && Array.isArray(data.inspectionTemplates)
        ? data.inspectionTemplates
        : Array.isArray(data.inspectionTemplates) && data.inspectionTemplates.length > 0
        ? data.inspectionTemplates
        : existingDb.inspectionTemplates || INITIAL_DATABASE.inspectionTemplates || [],
      attachments: existingDb.attachments,
      settings: ['UPDATE_SETTINGS', 'CREATE_MANUFACTURING_RECORD'].includes(action)
        ? {
            ...existingDb.settings,
            ...(data.settings || {}),
            productionMode: true,
            allowDevRoleSwitch: false,
          }
        : existingDb.settings,
      auditLogs: data.auditLogs || existingDb.auditLogs,
      deletedRecordKeys: Array.isArray(data.deletedRecordKeys)
        ? data.deletedRecordKeys
        : existingDb.deletedRecordKeys || [],
      lastUpdated: new Date().toISOString(),
    };
  }

  try {
    const auditRecord = logAudit({
      userId: sessionUser.id,
      user: sessionUser.name,
      role: sessionUser.role,
      action,
      recordType: details?.recordType || 'DATABASE',
      recordId: details?.recordId || 'ALL',
      details: details || {},
      previousValue: details?.previousValue,
      newValue: details?.newValue,
    });
    if (auditRecord) {
      mergedDb.auditLogs = [auditRecord as any, ...(mergedDb.auditLogs || [])];
    }
    saveDatabase(mergedDb);
    res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error('Error saving database:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Append single audit log entry (requires authentication)
app.post('/api/audit', (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }
  const entry = req.body || {};
  logAudit({
    ...entry,
    userId: session.user.id,
    user: session.user.name,
    role: session.user.role,
  });
  res.json({ success: true });
});

app.get('/api/audit', (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Authentication required to view audit logs.' });
  }
  if (fs.existsSync(AUDIT_FILE)) {
    try {
      const logs = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf-8'));
      return res.json({ success: true, logs });
    } catch {
      return res.json({ success: true, logs: [] });
    }
  }
  res.json({ success: true, logs: [] });
});

// Scan an uploaded engineering drawing image/photo and extract all required register columns & parts list
app.post('/api/drawings/scan-image', async (req, res) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }
    if (session.user.role === 'MANAGEMENT') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN: Management accounts have read-only executive access. Drawing scan ingestion is blocked.',
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        success: false,
        error: 'Server Gemini API key not configured; falling back to client-side OCR.',
      });
    }

    const { base64Data, crops, mimeType, filename } = req.body || {};
    if (!base64Data || typeof base64Data !== 'string') {
      return res.status(400).json({ success: false, error: 'base64Data is required.' });
    }

    const stripDataUrl = (str: string) => (str.includes(',') ? str.split(',')[1] : str);
    const rawBase64 = stripDataUrl(base64Data);
    const resolvedMime = mimeType && mimeType.startsWith('image/') ? mimeType : 'image/png';

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const imageParts: any[] = [
      {
        inlineData: {
          mimeType: resolvedMime,
          data: rawBase64,
        },
      },
    ];

    if (Array.isArray(crops)) {
      for (const cropDataUrl of crops.slice(0, 2)) {
        if (typeof cropDataUrl === 'string' && cropDataUrl.length > 64) {
          imageParts.push({
            inlineData: {
              mimeType: 'image/png',
              data: stripDataUrl(cropDataUrl),
            },
          });
        }
      }
    }

    const promptText = `You are a precision CAD & Engineering Drawing Inspector for Dale Automation / Spiral Systems.
Carefully inspect this engineering drawing image (and the zoomed high-resolution crops of its Title Block, Parts List, Revision Table, and Reference Drawings table, filename: "${filename || 'drawing.png'}") and extract ALL exact information printed on the drawing to populate the Controlled Engineering Drawings Register.

CRITICAL EXTRACTION RULES (READ ONLY ACTUAL TEXT VISIBLE IN THE IMAGE):
1. drawingNumber: Read the exact main DRAWING No from the bottom-right Title Block box labeled "DRAWING No".
   - Do NOT confuse the Reference Drawing number (on the bottom-left) with the main DRAWING No (on the bottom-right).
   - In Dale Automation drawings (formatted like Txxxx-xxx-xxx-xx-xx-xxx-00), main sheet drawing numbers end with "-00", while individual parts in the PARTS LIST end with "-01", "-02", etc.
2. revision: Read the exact revision code from the bottom-right "REV" box or Revision Table (e.g. "0", "1", "A", "B").
3. drawingTitle: Read the full Title from the "TITLE:" block in the bottom-right corner. If the TITLE block has multiple lines (such as a machine line on top, a sub-assembly line in the middle, and the main component description at the bottom), combine the component description and sub-assembly line into a clear title: "<BOTTOM_COMPONENT_TITLE> (<MIDDLE_SUB_ASSEMBLY_LINE>)".
4. projectReference: Read the Project / Machine reference from the top line of the TITLE block and the "PROJECT:" box.
5. elementCode: Read the "ELEMENT CODE" box in the Title Block (3-digit code). If the box is unclear, for Dale drawings formatted like Txxxx-xxx-EEE-..., the 3rd segment (EEE) is the Element Code.
6. modelledBy & modelledDate: Read the "MODELLED" initials and date from the Title Block (convert date to YYYY-MM-DD format).
7. detailedBy, detailedDate & effectiveDate: Read the "DETAILED" initials and date (or latest Revision Table BY and DATE) from the Title Block (convert date to YYYY-MM-DD format). Set effectiveDate to the latest revision/detailed date in YYYY-MM-DD format.
8. revisionNotes: Read the revision description from the Revision Table (e.g. "ISSUED FOR MANUFACTURE.").
9. scale: Read the "SCALE" box in the Title Block, including any ratio in parentheses (e.g. "A.O.D. (1 : 0.5)" or "1:2").
10. sheetSize & sheetNumber: Read the paper size box (e.g. "A3", "A4", "A2", "A1") and "SHEET No" box (e.g. "1 / 1").
11. referenceDrawings: Read the Reference Drawings table (usually bottom-left/center with columns DRAWING NUMBER and DESCRIPTION), formatted as "<DRAWING_NUMBER> — <DESCRIPTION>".
12. partsList: Extract EVERY row from the "PARTS LIST" table (columns: ITEM, QTY, PART NUMBER, DESCRIPTION, MATERIAL, DESIGNATION, ORDER NUMBER, VENDOR), ordered by ITEM number ascending (1, 2, 3...):
    - Preserve exact commas/decimals and dimensions in DESCRIPTION.
    - Preserve exact MATERIAL (e.g. "S/S 304 SATIN") and DESIGNATION (e.g. "MANUF-INT", "MANUF-EXT", "B/O-INT", "B/O-EXT").
    - If the drawing has no multi-row PARTS LIST table, return 1 row in partsList using the main drawingNumber and drawingTitle.`;

    const candidateModels = [
      'gemini-flash-latest',
      'gemini-3.1-flash-lite',
      'gemini-3.8-flash',
    ];

    let parsedResult: any = null;
    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: {
            parts: [...imageParts, { text: promptText }],
          },
          config: {
            temperature: 0.1,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                drawingNumber: { type: Type.STRING },
                revision: { type: Type.STRING },
                drawingTitle: { type: Type.STRING },
                projectReference: { type: Type.STRING },
                elementCode: { type: Type.STRING },
                effectiveDate: { type: Type.STRING },
                revisionNotes: { type: Type.STRING },
                scale: { type: Type.STRING },
                sheetSize: { type: Type.STRING },
                sheetNumber: { type: Type.STRING },
                modelledBy: { type: Type.STRING },
                modelledDate: { type: Type.STRING },
                detailedBy: { type: Type.STRING },
                detailedDate: { type: Type.STRING },
                referenceDrawings: { type: Type.STRING },
                partsList: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      itemNumber: { type: Type.STRING },
                      quantity: { type: Type.STRING },
                      partNumber: { type: Type.STRING },
                      description: { type: Type.STRING },
                      material: { type: Type.STRING },
                      designation: { type: Type.STRING },
                      orderNumber: { type: Type.STRING },
                      vendor: { type: Type.STRING },
                    },
                    required: [
                      'itemNumber',
                      'quantity',
                      'partNumber',
                      'description',
                      'material',
                      'designation',
                    ],
                  },
                },
              },
              required: [
                'drawingNumber',
                'revision',
                'drawingTitle',
                'projectReference',
                'elementCode',
                'effectiveDate',
                'revisionNotes',
                'scale',
                'sheetSize',
                'sheetNumber',
                'modelledBy',
                'modelledDate',
                'detailedBy',
                'detailedDate',
                'referenceDrawings',
                'partsList',
              ],
            },
          },
        });

        const jsonText = (response.text || '').trim();
        if (jsonText) {
          parsedResult = JSON.parse(jsonText);
          if (parsedResult && parsedResult.drawingNumber) {
            break;
          }
        }
      } catch (modelErr: any) {
        lastError = modelErr;
        console.warn(`Vision scan with model ${modelName} failed, trying next model:`, modelErr?.message);
      }
    }

    if (!parsedResult) {
      return res.status(502).json({
        success: false,
        error: lastError?.message || 'All vision models failed to scan drawing image.',
      });
    }

    return res.json({ success: true, parsed: parsedResult });
  } catch (err: any) {
    console.error('Error in /api/drawings/scan-image:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to scan drawing image on server.',
    });
  }
});

app.get('/api/db/export', (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Authentication required to export database.' });
  }
  const data = loadDatabase();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="machine-qms-backup-${new Date().toISOString().slice(0, 10)}.json"`
  );
  res.send(JSON.stringify(data, null, 2));
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'MACHINE QMS',
    port: PORT,
    timestamp: new Date().toISOString(),
  });
});

async function main() {
  const isDev =
    process.env.npm_lifecycle_event === 'dev' ||
    process.env.NODE_ENV === 'development';
  const distIndex = path.join(__dirname, 'dist', 'index.html');

  if (!isDev && fs.existsSync(distIndex)) {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(distIndex);
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, HOST, () => {
    console.log(`MACHINE QMS Server is running on http://${HOST}:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
