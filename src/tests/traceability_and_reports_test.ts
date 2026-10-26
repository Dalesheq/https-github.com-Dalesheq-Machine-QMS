import fs from 'fs';
import path from 'path';
import { ReportService } from '../services/reportService.js';
import { DBService } from '../services/db.js';

const API_BASE = 'http://localhost:3000';

interface StepResult {
  step: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

const steps: StepResult[] = [];
function record(step: string, status: 'PASS' | 'FAIL', details: string) {
  steps.push({ step, status, details });
  console.log(`[${status}] ${step}: ${details}`);
}

async function runTraceabilityAndReportsTest() {
  console.log('========================================================================');
  console.log('CONFIRMING FITMENT TRACEABILITY AND REPORT GENERATION');
  console.log('========================================================================\n');

  // Login as admin
  const adminRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'sheq', password: 'BasilDeSwardt#2026QMS' }),
  });
  const adminData = await adminRes.json();
  const token = adminData.session?.token;

  // 1. Fetch live DB
  const dbRes = await fetch(`${API_BASE}/api/db`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await dbRes.json();
  const db = json.data || json;

  // Controlled test entities
  const TEST_MACHINE_SN = 'DIV-SN-2026-001';
  const COMPONENT_1_TAG = 'DIV-2026-0001';
  const COMPONENT_2_TAG = 'DIV-2026-0002';
  const UNINSTALLED_TAG = 'DIV-2026-0004';

  // 5.1 Fit at least two test components to a test machine
  const fitments = (db.machineComponentFitments || []).filter(
    (f: any) => f.machineSerialNumber === TEST_MACHINE_SN
  );
  const passTwoFitted = fitments.length >= 2;
  const fittedTags = fitments.map((f: any) => f.traceabilityNumber);
  record('5.1 Two Test Components Fitted to Machine', passTwoFitted ? 'PASS' : 'FAIL',
    `Fitted count: ${fitments.length} on machine ${TEST_MACHINE_SN}. Tags: ${fittedTags.join(', ')}`);

  // 5.2 Verify machine dossier lists both fitted components
  const dossier = ReportService.generateFinalMachineReleaseRecord(db, TEST_MACHINE_SN);
  const dossierHtml = dossier.html || '';
  const containsBothInDossier =
    dossier.success &&
    dossierHtml.includes(COMPONENT_1_TAG) &&
    dossierHtml.includes(COMPONENT_2_TAG);
  record('5.2 Machine Dossier Lists Both Fitted Components', containsBothInDossier ? 'PASS' : 'FAIL',
    `Dossier doc: ${dossier.documentNumber}, contains ${COMPONENT_1_TAG}: ${dossierHtml.includes(COMPONENT_1_TAG)}, contains ${COMPONENT_2_TAG}: ${dossierHtml.includes(COMPONENT_2_TAG)}`);

  // 5.3 Reverse traceability returns the correct machine and project for each component
  let passReverseTrace = true;
  for (const tag of [COMPONENT_1_TAG, COMPONENT_2_TAG]) {
    const traceRecord = db.manufacturingRecords.find((r: any) => r.traceabilityNumber === tag);
    const fitment = db.machineComponentFitments.find((f: any) => f.traceabilityNumber === tag);
    const correctMach = fitment?.machineSerialNumber === TEST_MACHINE_SN || traceRecord?.machineSerialNumber === TEST_MACHINE_SN;
    const correctProj = traceRecord?.projectNumber === 'PRJ-2026-104';
    if (!correctMach || !correctProj) {
      passReverseTrace = false;
    }
  }
  record('5.3 Reverse Traceability Validates Machine and Project', passReverseTrace ? 'PASS' : 'FAIL',
    `Both ${COMPONENT_1_TAG} and ${COMPONENT_2_TAG} correctly resolve to Machine ${TEST_MACHINE_SN} and Project PRJ-2026-104`);

  // 5.4 Verify a manufactured but uninstalled component displays NOT FITTED
  const uninstalledRecord = db.manufacturingRecords.find((r: any) => r.traceabilityNumber === UNINSTALLED_TAG);
  const uninstalledFitments = (db.machineComponentFitments || []).filter((f: any) => f.traceabilityNumber === UNINSTALLED_TAG);
  const uninstalledRep = ReportService.generateComponentTraceabilityReport(db, UNINSTALLED_TAG);
  const uninstalledHtml = uninstalledRep.html || '';
  const passNotFitted = uninstalledFitments.length === 0 && uninstalledHtml.includes('NOT FITTED');
  record('5.4 Uninstalled Component Displays NOT FITTED', passNotFitted ? 'PASS' : 'FAIL',
    `Tag ${UNINSTALLED_TAG}: fitment count = ${uninstalledFitments.length}, Report output contains 'NOT FITTED': ${uninstalledHtml.includes('NOT FITTED')}`);

  // 5.5 Generate and open the seven supported report types
  // Report 1: Department Inspection Sheet
  const rep1 = ReportService.generateDepartmentInspectionSheet(db, 'DALE-INSP-001');
  // Report 2: Dimensional Inspection Sheet
  const rep2 = ReportService.generateDimensionalInspectionSheet(db, 'INSP-2026-0001');
  // Report 3: Component Traceability Report
  const rep3 = ReportService.generateComponentTraceabilityReport(db, 'DIV-2026-0001');
  // Report 4: Non-Conformance Report
  const rep4 = ReportService.generateNCRReport(db, 'NCR-2026-0001');
  // Report 5: Deviation Concession Report
  const rep5 = ReportService.generateDeviationReport(db, 'DEV-2026-0001');
  // Report 6: Component Quality Release Certificate (for released record)
  const rep6 = ReportService.generateQualityReleaseCertificate(db, 'DIV-2026-0001');
  // Report 7: Final Machine Release Record
  const rep7 = ReportService.generateFinalMachineReleaseRecord(db, TEST_MACHINE_SN);

  const allSevenSuccess =
    rep1.success && rep2.success && rep3.success && rep4.success &&
    rep5.success && rep6.success && rep7.success;
  record('5.5 All Seven Supported Report Types Generated Successfully', allSevenSuccess ? 'PASS' : 'FAIL',
    `Rep1: ${rep1.documentNumber} (${(rep1.html || '').length}B), Rep2: ${rep2.documentNumber} (${(rep2.html || '').length}B), Rep3: ${rep3.documentNumber} (${(rep3.html || '').length}B), Rep4: ${rep4.documentNumber} (${(rep4.html || '').length}B), Rep5: ${rep5.documentNumber} (${(rep5.html || '').length}B), Rep6: ${rep6.documentNumber} (${(rep6.html || '').length}B), Rep7: ${rep7.documentNumber} (${(rep7.html || '').length}B)`);

  // 5.6 Confirm release certificate CANNOT be generated for a component on HOLD
  const holdRecord = db.manufacturingRecords.find((r: any) => r.manufacturingStatus === 'NCR_HOLD') || db.manufacturingRecords[0];
  // Temporarily ensure status is NCR_HOLD for test check
  const originalStatus = holdRecord.manufacturingStatus;
  holdRecord.manufacturingStatus = 'NCR_HOLD';

  const holdCert = ReportService.generateQualityReleaseCertificate(db, holdRecord.traceabilityNumber);
  const holdCertHtml = holdCert.html || '';
  const passHoldCertBlocked =
    !holdCert.success &&
    holdCert.error?.includes('BLOCKED') &&
    holdCertHtml.includes('RELEASE CERTIFICATE BLOCKED');

  holdRecord.manufacturingStatus = originalStatus; // restore

  record('5.6 Release Certificate Strictly Blocked for Component on HOLD', passHoldCertBlocked ? 'PASS' : 'FAIL',
    `Success = ${holdCert.success}, Error: "${holdCert.error}"`);

  console.log('\n========================================================================');
  console.log('TRACEABILITY & REPORTS TEST SUMMARY');
  console.log('========================================================================');
  const passCount = steps.filter((s) => s.status === 'PASS').length;
  console.log(`TOTAL CHECKS: ${steps.length} | PASSED: ${passCount} | FAILED: ${steps.length - passCount}`);
  console.log('========================================================================\n');
}

runTraceabilityAndReportsTest().catch(console.error);
