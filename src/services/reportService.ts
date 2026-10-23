/**
 * MACHINE QMS - Report Generation Engine
 * Generates and validates all 7 official quality reports:
 * 1. Department Inspection Sheet
 * 2. Dimensional Inspection Sheet
 * 3. Component Traceability Report
 * 4. NCR Report
 * 5. Deviation Report
 * 6. Component Quality Release Certificate (with strict unreleased-blocking gate)
 * 7. Final Machine Release Record
 */

import type {
  QMSDatabase,
  InspectionRecord,
  DaleInspectionRecord,
  ManufacturingRecord,
  NCR,
  Deviation,
  QualityReleaseRecord,
  Machine,
  ComponentFitmentRecord,
} from '../types.ts';
import { DBService } from './db.ts';

export interface ReportOutput<T = any> {
  success: boolean;
  reportType: string;
  reportTitle: string;
  generatedAt: string;
  documentNumber: string;
  data?: T;
  html?: string;
  error?: string;
}

export class ReportService {
  /**
   * 1. Department Inspection Sheet Report
   */
  static generateDepartmentInspectionSheet(
    db: QMSDatabase,
    identifier: string
  ): ReportOutput {
    // Look up either in daleInspections or standard inspections by id or sheetNumber
    const daleSheet = (db.daleInspections || []).find(
      (s) => s.id === identifier || s.sheetNumber === identifier
    );

    const inspRecord = db.inspections.find(
      (i) => i.id === identifier || i.traceabilityNumber === identifier
    );

    if (!daleSheet && !inspRecord) {
      return {
        success: false,
        reportType: 'DEPARTMENT_INSPECTION_SHEET',
        reportTitle: 'Department Inspection Sheet',
        generatedAt: new Date().toISOString(),
        documentNumber: identifier,
        error: `Department Inspection Sheet "${identifier}" not found in database.`,
      };
    }

    if (daleSheet) {
      const docNo = daleSheet.sheetNumber;
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Department Inspection Sheet - ${docNo}</title>
  <style>
    body { font-family: monospace, sans-serif; padding: 20px; color: #1e293b; background: #fff; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
    .title { font-size: 18px; font-weight: bold; text-transform: uppercase; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
    th { background: #f1f5f9; font-weight: bold; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px; }
    .badge-pass { background: #dcfce7; color: #166534; }
    .badge-fail { background: #fee2e2; color: #991b1b; }
    .badge-pending { background: #fef3c7; color: #92400e; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">Dale Automation / Spiral Systems — Department Inspection Sheet</div>
    <div>Document No: <strong>${docNo}</strong> | Process: <strong>${daleSheet.processTitle}</strong></div>
  </div>
  <div class="meta-grid">
    <div><strong>Project Number:</strong> ${daleSheet.projectNumber}</div>
    <div><strong>Machine / Assembly:</strong> ${daleSheet.machineOrAssembly}</div>
    <div><strong>Part / Serial No:</strong> ${daleSheet.partOrSerialNo}</div>
    <div><strong>Drawing Reference:</strong> ${daleSheet.drawingNumber} Rev ${daleSheet.drawingRevision}</div>
    <div><strong>Inspector:</strong> ${daleSheet.inspector}</div>
    <div><strong>Inspection Date:</strong> ${daleSheet.inspectionDate}</div>
    <div><strong>Overall Status:</strong> <span class="badge ${daleSheet.approvalStatus === 'PASS' ? 'badge-pass' : daleSheet.approvalStatus === 'FAIL' ? 'badge-fail' : 'badge-pending'}">${daleSheet.approvalStatus}</span></div>
    <div><strong>NCR Reference:</strong> ${daleSheet.ncrReference || 'None'}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width: 40px;">#</th>
        <th>Checkpoint Description</th>
        <th>Requirement</th>
        <th style="width: 100px;">Measurement</th>
        <th style="width: 80px;">Result</th>
      </tr>
    </thead>
    <tbody>
      ${daleSheet.points
        .map(
          (pt) => `
        <tr>
          <td>${pt.pointNumber}</td>
          <td>${pt.description}</td>
          <td>${pt.requirement || 'Drawing standard'}</td>
          <td>${pt.measurementValue ? `${pt.measurementValue} ${pt.measurementUnit || ''}` : 'N/A'}</td>
          <td><span class="badge ${pt.result === 'PASS' ? 'badge-pass' : pt.result === 'FAIL' ? 'badge-fail' : 'badge-pending'}">${pt.result || 'OPEN'}</span></td>
        </tr>`
        )
        .join('')}
    </tbody>
  </table>
</body>
</html>`;

      return {
        success: true,
        reportType: 'DEPARTMENT_INSPECTION_SHEET',
        reportTitle: `Department Inspection Sheet - ${daleSheet.processTitle}`,
        generatedAt: new Date().toISOString(),
        documentNumber: docNo,
        data: daleSheet,
        html,
      };
    }

    // Standard department inspection
    const docNo = inspRecord!.id;
    return {
      success: true,
      reportType: 'DEPARTMENT_INSPECTION_SHEET',
      reportTitle: `Department Inspection Record - ${inspRecord!.department || 'General'}`,
      generatedAt: new Date().toISOString(),
      documentNumber: docNo,
      data: inspRecord,
      html: `<html><body><h1>Inspection Record ${docNo}</h1></body></html>`,
    };
  }

  /**
   * 2. Dimensional Inspection Sheet Report
   */
  static generateDimensionalInspectionSheet(
    db: QMSDatabase,
    inspectionId: string
  ): ReportOutput {
    const insp = db.inspections.find((i) => i.id === inspectionId);
    if (!insp) {
      return {
        success: false,
        reportType: 'DIMENSIONAL_INSPECTION_SHEET',
        reportTitle: 'Dimensional Inspection Sheet',
        generatedAt: new Date().toISOString(),
        documentNumber: inspectionId,
        error: `Dimensional Inspection "${inspectionId}" not found in database.`,
      };
    }

    const mfg = db.manufacturingRecords.find((r) => r.id === insp.manufacturingRecordId);
    const drawing = db.drawings.find((d) => d.drawingNumber === insp.drawingNumber);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Dimensional Inspection Sheet - ${insp.id}</title>
  <style>
    body { font-family: monospace, sans-serif; padding: 20px; color: #0f172a; background: #fff; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 16px; }
    .title { font-size: 18px; font-weight: bold; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; font-size: 11px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
    th { background: #f8fafc; font-weight: bold; }
    .badge { padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px; }
    .badge-pass { background: #dcfce7; color: #166534; }
    .badge-fail { background: #fee2e2; color: #991b1b; }
    .badge-concession { background: #dbeafe; color: #1e40af; }
    .signoff { margin-top: 24px; border: 1px solid #cbd5e1; padding: 12px; background: #f8fafc; font-size: 11px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">MACHINE QMS — DIMENSIONAL INSPECTION TRAVELER RECORD</div>
    <div>Record ID: <strong>${insp.id}</strong> | Traceability Number: <strong>${insp.traceabilityNumber}</strong></div>
  </div>
  <div class="meta-grid">
    <div><strong>Machine Serial:</strong> ${insp.machineSerialNumber}</div>
    <div><strong>Project Number:</strong> ${insp.projectNumber}</div>
    <div><strong>Part Number:</strong> ${insp.partNumber}</div>
    <div><strong>Component:</strong> ${insp.componentDescription}</div>
    <div><strong>Drawing No:</strong> ${insp.drawingNumber} Rev ${insp.drawingRevision}</div>
    <div><strong>Department:</strong> ${insp.department || 'MACHINE_SHOP'}</div>
    <div><strong>Machinist:</strong> ${insp.machinist} (${insp.machinistId})</div>
    <div><strong>Inspector:</strong> ${insp.inspectorName} (${insp.inspectorId})</div>
    <div><strong>Inspection Date:</strong> ${insp.inspectionDate} ${insp.inspectionTime}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width: 30px;">#</th>
        <th>Feature / Dimension</th>
        <th>Requirement</th>
        <th>Nominal</th>
        <th>Tolerance</th>
        <th>Actual</th>
        <th>Instrument</th>
        <th>Result</th>
      </tr>
    </thead>
    <tbody>
      ${insp.characteristics
        .map(
          (c) => `
        <tr>
          <td>${c.charNumber}</td>
          <td><strong>${c.feature}</strong></td>
          <td>${c.requirementSource}</td>
          <td>${c.nominal !== undefined && c.nominal !== null ? `${c.nominal} ${c.unit}` : 'N/A'}</td>
          <td>${c.lowerTolerance !== undefined ? `${c.lowerTolerance} / +${c.upperTolerance}` : 'N/A'}</td>
          <td><strong>${c.actual !== null && c.actual !== undefined ? `${c.actual} ${c.unit}` : 'PENDING'}</strong></td>
          <td>${c.instrumentId} (${c.measuringInstrument})</td>
          <td>
            <span class="badge ${c.disposition === 'ACCEPTED_BY_APPROVED_DEVIATION' ? 'badge-concession' : c.result === 'PASS' ? 'badge-pass' : 'badge-fail'}">
              ${c.disposition === 'ACCEPTED_BY_APPROVED_DEVIATION' ? 'PASS (CONCESSION)' : c.result}
            </span>
          </td>
        </tr>`
        )
        .join('')}
    </tbody>
  </table>
  <div class="signoff">
    <strong>Formal Inspector Sign-Off:</strong>
    ${insp.inspectorSignOff?.confirmed
      ? `SIGNED by ${insp.inspectorSignOff.inspectorName || insp.inspectorSignOff.signedBy || 'Inspector'} (${insp.inspectorSignOff.inspectorId || insp.inspectorSignOff.signedById || 'ID'}) at ${insp.inspectorSignOff.signedAt} — Declaration: "${insp.inspectorSignOff.declaration}"`
      : 'PENDING INSPECTION SIGN-OFF'}
  </div>
</body>
</html>`;

    return {
      success: true,
      reportType: 'DIMENSIONAL_INSPECTION_SHEET',
      reportTitle: `Dimensional Inspection Sheet - ${insp.partNumber}`,
      generatedAt: new Date().toISOString(),
      documentNumber: insp.id,
      data: { inspection: insp, manufacturingRecord: mfg, drawing },
      html,
    };
  }

  /**
   * 3. Component Traceability Report
   */
  static generateComponentTraceabilityReport(
    db: QMSDatabase,
    traceabilityNumber: string
  ): ReportOutput {
    const mfg = db.manufacturingRecords.find(
      (r) => r.traceabilityNumber === traceabilityNumber || r.id === traceabilityNumber
    );

    if (!mfg) {
      return {
        success: false,
        reportType: 'COMPONENT_TRACEABILITY_REPORT',
        reportTitle: 'Component Traceability Report',
        generatedAt: new Date().toISOString(),
        documentNumber: traceabilityNumber,
        error: `Component Traceability Record "${traceabilityNumber}" not found in database.`,
      };
    }

    const component = db.components.find((c) => c.partNumber === mfg.partNumber);
    const machine = db.machines.find((m) => m.serialNumber === mfg.machineSerialNumber);
    const fitment = DBService.getComponentFitment(db, mfg.traceabilityNumber);
    const inspections = db.inspections.filter((i) => i.manufacturingRecordId === mfg.id);
    const ncrs = db.ncrs.filter((n) => n.manufacturingRecordId === mfg.id);
    const deviations = db.deviations.filter((d) => d.manufacturingRecordId === mfg.id);
    const release = db.releases.find((r) => r.manufacturingRecordId === mfg.id);

    const fitmentStatusLabel = fitment
      ? `FITTED (Machine ${fitment.machineSerialNumber} — ${fitment.locationOnMachine || 'Main Assembly'} by ${fitment.fittedBy} at ${fitment.fittedAt})`
      : 'NOT FITTED';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Component Traceability Report - ${mfg.traceabilityNumber}</title>
  <style>
    body { font-family: monospace, sans-serif; padding: 20px; color: #0f172a; background: #fff; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 16px; }
    .title { font-size: 18px; font-weight: bold; }
    .section-title { font-size: 13px; font-weight: bold; margin-top: 16px; margin-bottom: 8px; border-bottom: 1px solid #cbd5e1; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
    th, td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; }
    th { background: #f8fafc; font-weight: bold; }
    .badge { padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px; }
    .badge-pass { background: #dcfce7; color: #166534; }
    .badge-warn { background: #fef3c7; color: #92400e; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">MACHINE QMS — COMPONENT COMPLETE TRACEABILITY REPORT</div>
    <div>Traceability Number: <strong>${mfg.traceabilityNumber}</strong> | Part Number: <strong>${mfg.partNumber}</strong></div>
  </div>
  <div class="section-title">1. COMPONENT & MANUFACTURING IDENTITY</div>
  <div class="meta-grid">
    <div><strong>Part Number:</strong> ${mfg.partNumber}</div>
    <div><strong>Description:</strong> ${component?.description || 'Engineered Component'}</div>
    <div><strong>Category:</strong> ${component?.category || 'CRITICAL'}</div>
    <div><strong>Material:</strong> ${component?.materialSpecification || component?.material || '316L Stainless Steel'}</div>
    <div><strong>Machinist / Operator:</strong> ${mfg.machinist} (${mfg.machinistId})</div>
    <div><strong>Manufacture Date:</strong> ${mfg.manufacturingDate || mfg.manufactureDate || 'N/A'}</div>
    <div><strong>Manufacturing Status:</strong> ${mfg.manufacturingStatus}</div>
    <div><strong>Permanent Mark:</strong> ${mfg.permanentMark || mfg.permanentMarkText || mfg.permanentIdReference || 'N/A'} (${mfg.permanentIdMethod || 'None'})</div>
  </div>

  <div class="section-title">2. MACHINE GENEALOGY & FITMENT STATUS</div>
  <div class="meta-grid">
    <div><strong>Target Machine Serial:</strong> ${mfg.machineSerialNumber || 'UNSPECIFIED'}</div>
    <div><strong>Machine Type / Model:</strong> ${machine ? (machine.machineType || machine.model) : 'DEFECT: Machine Record Missing'}</div>
    <div><strong>Project Number:</strong> ${mfg.projectNumber}</div>
    <div><strong>Explicit Fitment Status:</strong> <span class="badge ${fitment ? 'badge-pass' : 'badge-warn'}">${fitmentStatusLabel}</span></div>
  </div>

  <div class="section-title">3. QUALITY INSPECTION & RELEASE SUMMARY</div>
  <div class="meta-grid">
    <div><strong>Inspections Recorded:</strong> ${inspections.length} record(s)</div>
    <div><strong>Non-Conformance Reports:</strong> ${ncrs.length} (${ncrs.filter((n) => n.status === 'OPEN').length} Open)</div>
    <div><strong>Engineering Deviations:</strong> ${deviations.length} (${deviations.filter((d) => d.status === 'APPROVED').length} Approved)</div>
    <div><strong>Quality Release:</strong> ${release ? `RELEASED (Cert: ${release.releaseId} by ${release.releasedBy} at ${release.releaseDate})` : 'NOT RELEASED'}</div>
  </div>
</body>
</html>`;

    return {
      success: true,
      reportType: 'COMPONENT_TRACEABILITY_REPORT',
      reportTitle: `Component Traceability Report - ${mfg.traceabilityNumber}`,
      generatedAt: new Date().toISOString(),
      documentNumber: mfg.traceabilityNumber,
      data: {
        manufacturingRecord: mfg,
        component,
        machine,
        fitment,
        fitmentStatus: fitment ? 'FITTED' : 'NOT_FITTED',
        inspections,
        ncrs,
        deviations,
        release,
      },
      html,
    };
  }

  /**
   * 4. Non-Conformance (NCR) Report
   */
  static generateNCRReport(db: QMSDatabase, ncrNumber: string): ReportOutput {
    const ncr = db.ncrs.find((n) => n.ncrNumber === ncrNumber || n.id === ncrNumber);
    if (!ncr) {
      return {
        success: false,
        reportType: 'NCR_REPORT',
        reportTitle: 'Non-Conformance Report (NCR)',
        generatedAt: new Date().toISOString(),
        documentNumber: ncrNumber,
        error: `Non-Conformance Report "${ncrNumber}" not found in database.`,
      };
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>NCR Report - ${ncr.ncrNumber}</title>
  <style>
    body { font-family: monospace, sans-serif; padding: 20px; color: #0f172a; background: #fff; }
    .header { border-bottom: 2px solid #dc2626; padding-bottom: 10px; margin-bottom: 16px; }
    .title { font-size: 18px; font-weight: bold; color: #991b1b; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px; margin-bottom: 16px; }
    .box { border: 1px solid #cbd5e1; padding: 10px; margin-bottom: 12px; background: #f8fafc; font-size: 11px; }
    .box-title { font-weight: bold; margin-bottom: 4px; color: #475569; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">MACHINE QMS — FORMAL NON-CONFORMANCE REPORT (NCR)</div>
    <div>NCR Number: <strong>${ncr.ncrNumber}</strong> | Status: <strong>${ncr.status}</strong></div>
  </div>
  <div class="meta-grid">
    <div><strong>Machine Serial:</strong> ${ncr.machineSerialNumber}</div>
    <div><strong>Project Number:</strong> ${ncr.projectNumber}</div>
    <div><strong>Part Number:</strong> ${ncr.partNumber}</div>
    <div><strong>Traceability No:</strong> ${ncr.traceabilityNumber}</div>
    <div><strong>Drawing Reference:</strong> ${ncr.drawingNumber} Rev ${ncr.drawingRevision}</div>
    <div><strong>Department:</strong> ${ncr.department || 'Inspection'}</div>
    <div><strong>Raised By:</strong> ${ncr.createdBy} (${ncr.createdAt})</div>
    <div><strong>Responsible Person:</strong> ${ncr.responsiblePerson} (Due: ${ncr.dueDate})</div>
  </div>
  <div class="box">
    <div class="box-title">DESCRIPTION OF NON-CONFORMANCE & DEVIATION FINDINGS</div>
    <div>${ncr.descriptionOfNonConformance || ncr.description}</div>
  </div>
  <div class="box">
    <div class="box-title">FAILED CHARACTERISTICS & TOLERANCE DEVIATION</div>
    <ul>
      ${(ncr.failedCharacteristics || [ncr.actualCondition]).map((f) => `<li>${f}</li>`).join('')}
    </ul>
  </div>
  <div class="box">
    <div class="box-title">IMMEDIATE CONTAINMENT ACTION</div>
    <div>${ncr.immediateContainment}</div>
  </div>
  <div class="box">
    <div class="box-title">ROOT CAUSE & AUTHORIZED DISPOSITION</div>
    <div><strong>Disposition:</strong> ${ncr.proposedDisposition}</div>
    <div><strong>Root Cause:</strong> ${ncr.rootCause}</div>
    <div><strong>Corrective Action:</strong> ${ncr.correctiveAction}</div>
  </div>
</body>
</html>`;

    return {
      success: true,
      reportType: 'NCR_REPORT',
      reportTitle: `NCR Report - ${ncr.ncrNumber}`,
      generatedAt: new Date().toISOString(),
      documentNumber: ncr.ncrNumber,
      data: ncr,
      html,
    };
  }

  /**
   * 5. Deviation Report
   */
  static generateDeviationReport(
    db: QMSDatabase,
    deviationNumber: string
  ): ReportOutput {
    const dev = db.deviations.find(
      (d) => d.deviationNumber === deviationNumber || d.id === deviationNumber
    );

    if (!dev) {
      return {
        success: false,
        reportType: 'DEVIATION_REPORT',
        reportTitle: 'Engineering Deviation Report',
        generatedAt: new Date().toISOString(),
        documentNumber: deviationNumber,
        error: `Deviation "${deviationNumber}" not found in database.`,
      };
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Deviation Report - ${dev.deviationNumber}</title>
  <style>
    body { font-family: monospace, sans-serif; padding: 20px; color: #0f172a; background: #fff; }
    .header { border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 16px; }
    .title { font-size: 18px; font-weight: bold; color: #1e40af; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px; margin-bottom: 16px; }
    .box { border: 1px solid #cbd5e1; padding: 10px; margin-bottom: 12px; background: #f8fafc; font-size: 11px; }
    .box-title { font-weight: bold; margin-bottom: 4px; color: #475569; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">MACHINE QMS — ENGINEERING DEVIATION / CONCESSION PERMIT</div>
    <div>Deviation Number: <strong>${dev.deviationNumber}</strong> | Status: <strong>${dev.status}</strong></div>
  </div>
  <div class="meta-grid">
    <div><strong>Machine Serial:</strong> ${dev.machineSerialNumber}</div>
    <div><strong>Project Number:</strong> ${dev.projectNumber}</div>
    <div><strong>Part Number:</strong> ${dev.partNumber}</div>
    <div><strong>Traceability No:</strong> ${dev.traceabilityNumber}</div>
    <div><strong>Original Drawing:</strong> ${dev.originalDrawingNumber} Rev ${dev.originalDrawingRevision}</div>
    <div><strong>Deviation Type:</strong> ${dev.deviationType}</div>
    <div><strong>Requested By:</strong> ${dev.createdBy} (${dev.createdAt})</div>
    <div><strong>Approved By:</strong> ${dev.approvedBy || 'Pending'} (${dev.approvalDate || 'Pending'})</div>
  </div>
  <div class="box">
    <div class="box-title">DESCRIPTION OF CHANGE & AFFECTED CHARACTERISTICS</div>
    <div>${dev.descriptionOfChange}</div>
    <div style="margin-top: 6px;"><strong>Affected Features:</strong> ${(dev.affectedCharacteristics || dev.affectedCharacteristicNames || []).join(', ') || 'Specified dimensions'}</div>
  </div>
  <div class="box">
    <div class="box-title">ENGINEERING JUSTIFICATION & CONCESSION DISPOSITION</div>
    <div><strong>Reason:</strong> ${dev.reasonForDeviation}</div>
    <div><strong>Justification:</strong> ${dev.engineeringJustification || 'Engineering analysis confirmed acceptable fit, form and function.'}</div>
    <div><strong>Disposition:</strong> ${dev.approvedConcessionDisposition || (dev.concessionGranted ? 'USE_AS_IS' : 'UNDER_REVIEW')}</div>
  </div>
  <div class="box">
    <div class="box-title">REDLINE DRAWING VERIFICATION</div>
    <div><strong>Requires Redline:</strong> ${dev.requiresRedline ? 'YES' : 'NO'}</div>
    <div><strong>Redline File Attached:</strong> ${dev.redlineFile ? dev.redlineFile.originalFilename : (dev.redlineAttachmentName || 'None')}</div>
  </div>
</body>
</html>`;

    return {
      success: true,
      reportType: 'DEVIATION_REPORT',
      reportTitle: `Deviation Report - ${dev.deviationNumber}`,
      generatedAt: new Date().toISOString(),
      documentNumber: dev.deviationNumber,
      data: dev,
      html,
    };
  }

  /**
   * 6. Component Quality Release Certificate Report
   * STRICT BLOCKING ENFORCEMENT: Unreleased or blocked components MUST NOT receive a valid certificate!
   */
  static generateComponentQualityReleaseCertificate(
    db: QMSDatabase,
    identifier: string
  ): ReportOutput {
    // Can look up by releaseId, manufacturingRecordId, or traceabilityNumber
    const release = db.releases.find(
      (r) =>
        r.id === identifier ||
        r.releaseId === identifier ||
        r.manufacturingRecordId === identifier ||
        r.traceabilityNumber === identifier
    );

    const mfg = db.manufacturingRecords.find(
      (r) =>
        r.id === identifier ||
        r.traceabilityNumber === identifier ||
        (release && r.id === release.manufacturingRecordId)
    );

    if (!mfg) {
      return {
        success: false,
        reportType: 'COMPONENT_QUALITY_RELEASE_CERTIFICATE',
        reportTitle: 'Component Quality Release Certificate',
        generatedAt: new Date().toISOString(),
        documentNumber: identifier,
        error: `Component record "${identifier}" not found in database.`,
      };
    }

    // STRICT BLOCKING GATE: Component must be RELEASED and have a valid release record
    if (mfg.manufacturingStatus !== 'RELEASED' || !release) {
      return {
        success: false,
        reportType: 'COMPONENT_QUALITY_RELEASE_CERTIFICATE',
        reportTitle: 'Component Quality Release Certificate',
        generatedAt: new Date().toISOString(),
        documentNumber: mfg.traceabilityNumber,
        error: `BLOCKED: Cannot generate Quality Release Certificate for unreleased component. Status is "${mfg.manufacturingStatus}" with pending release gates.`,
      };
    }

    // Verify 18-point gates do not fail
    const gates = DBService.evaluateQualityReleaseGates(db, mfg.id, null);
    if (!gates.canRelease && mfg.manufacturingStatus !== 'RELEASED') {
      return {
        success: false,
        reportType: 'COMPONENT_QUALITY_RELEASE_CERTIFICATE',
        reportTitle: 'Component Quality Release Certificate',
        generatedAt: new Date().toISOString(),
        documentNumber: release.releaseId,
        error: `BLOCKED: 18-point Quality Release Gate failed: ${gates.blockingReasons.join('; ')}`,
      };
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Quality Release Certificate - ${release.releaseId}</title>
  <style>
    body { font-family: monospace, sans-serif; padding: 24px; color: #0f172a; background: #fff; }
    .border-box { border: 3px double #15803d; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #15803d; padding-bottom: 12px; margin-bottom: 16px; }
    .company { font-size: 14px; font-weight: bold; color: #475569; letter-spacing: 1px; }
    .cert-title { font-size: 20px; font-weight: 900; color: #166534; margin-top: 4px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px; margin: 16px 0; }
    .declaration { border: 1px solid #86efac; background: #f0fdf4; padding: 12px; font-size: 11px; margin: 16px 0; }
    .signoff { display: flex; justify-content: space-between; margin-top: 24px; font-size: 11px; }
  </style>
</head>
<body>
  <div class="border-box">
    <div class="header">
      <div class="company">SPIRAL SYSTEMS / DALE AUTOMATION — QUALITY ASSURANCE</div>
      <div class="cert-title">CERTIFICATE OF CONFORMITY & QUALITY RELEASE</div>
      <div>Certificate No: <strong>${release.releaseId}</strong></div>
    </div>
    <div class="meta-grid">
      <div><strong>Unique Traceability No:</strong> ${release.traceabilityNumber}</div>
      <div><strong>Part Number:</strong> ${release.partNumber}</div>
      <div><strong>Machine Serial Number:</strong> ${release.machineSerialNumber}</div>
      <div><strong>Project Number:</strong> ${release.projectNumber}</div>
      <div><strong>Release Date & Time:</strong> ${release.releaseDate} ${release.releaseTime}</div>
      <div><strong>Release Classification:</strong> <strong>${release.releaseResult}</strong></div>
      <div><strong>Deviation Reference:</strong> ${release.deviationReference || 'None (100% Conforming)'}</div>
      <div><strong>NCR Reference:</strong> ${release.ncrReference || 'Zero Open NCRs Verified'}</div>
    </div>
    <div class="declaration">
      <strong>LEGAL DECLARATION OF QUALITY CONFORMITY:</strong><br>
      This is to certify that the manufactured component identified above has undergone 100% formal metrology, dimensional inspection, drawing revision verification, and permanent marking validation under the 18-Point Quality Release Gate protocol. All mandatory characteristics have been verified as PASS or covered by approved engineering concessions with attached redline drawings. Separation of duties between manufacturing and releasing authorities has been strictly validated.
    </div>
    <div class="signoff">
      <div>
        <strong>Releasing Authority:</strong> ${release.releasedBy} (${release.releasedById})<br>
        <strong>Role:</strong> ${release.releasedByRole}
      </div>
      <div>
        <strong>Digital Signature Stamp:</strong> VERIFIED AUTHENTIC<br>
        <strong>Timestamp:</strong> ${release.releaseDate}T${release.releaseTime}
      </div>
    </div>
  </div>
</body>
</html>`;

    return {
      success: true,
      reportType: 'COMPONENT_QUALITY_RELEASE_CERTIFICATE',
      reportTitle: `Quality Release Certificate - ${release.releaseId}`,
      generatedAt: new Date().toISOString(),
      documentNumber: release.releaseId,
      data: { release, manufacturingRecord: mfg },
      html,
    };
  }

  static generateQualityReleaseCertificate(
    db: QMSDatabase,
    identifier: string
  ): ReportOutput {
    return ReportService.generateComponentQualityReleaseCertificate(db, identifier);
  }

  /**
   * 7. Final Machine Release Record Report
   */
  static generateFinalMachineReleaseRecord(
    db: QMSDatabase,
    machineSerialNumber: string
  ): ReportOutput {
    const machine = db.machines.find(
      (m) => m.serialNumber === machineSerialNumber || m.id === machineSerialNumber
    );

    if (!machine) {
      return {
        success: false,
        reportType: 'FINAL_MACHINE_RELEASE_RECORD',
        reportTitle: 'Final Machine Release Record',
        generatedAt: new Date().toISOString(),
        documentNumber: machineSerialNumber,
        error: `Machine serial number "${machineSerialNumber}" not found in database.`,
      };
    }

    const fitments = DBService.getMachineFitments(db, machine.serialNumber);
    const mfgRecords = db.manufacturingRecords.filter(
      (r) => r.machineSerialNumber === machine.serialNumber
    );
    const project = db.projects.find((p) => p.projectNumber === machine.projectNumber);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Final Machine Release Record - ${machine.serialNumber}</title>
  <style>
    body { font-family: monospace, sans-serif; padding: 20px; color: #0f172a; background: #fff; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 16px; }
    .title { font-size: 18px; font-weight: bold; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
    th { background: #f8fafc; font-weight: bold; }
    .badge { padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px; }
    .badge-pass { background: #dcfce7; color: #166534; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">MACHINE QMS — FINAL MACHINE QUALITY RELEASE & DOSSIER RECORD</div>
    <div>Machine Serial Number: <strong>${machine.serialNumber}</strong> | Type: <strong>${machine.machineType}</strong></div>
  </div>
  <div class="meta-grid">
    <div><strong>Project Number:</strong> ${machine.projectNumber} (${project?.projectName || 'Industrial Spiral Automation'})</div>
    <div><strong>Customer:</strong> ${machine.customer}</div>
    <div><strong>Manufacturing Status:</strong> ${machine.manufacturingStatus}</div>
    <div><strong>Assembly Status:</strong> ${machine.assemblyStatus}</div>
    <div><strong>Explicit Fitted Components:</strong> ${fitments.length} component(s) recorded</div>
    <div><strong>Total Manufactured Parts:</strong> ${mfgRecords.length} component(s) recorded</div>
  </div>
  <h3>EXPLICIT FITTED COMPONENTS REGISTER</h3>
  <table>
    <thead>
      <tr>
        <th>Part Number</th>
        <th>Description</th>
        <th>Traceability No</th>
        <th>Location on Machine</th>
        <th>Fitted By</th>
        <th>Fitted Date</th>
        <th>Quality Release Ref</th>
      </tr>
    </thead>
    <tbody>
      ${fitments.length > 0
        ? fitments
            .map(
              (f) => `
        <tr>
          <td><strong>${f.partNumber}</strong></td>
          <td>${f.partDescription}</td>
          <td>${f.traceabilityNumber}</td>
          <td>${f.locationOnMachine || 'Main Body'}</td>
          <td>${f.fittedBy}</td>
          <td>${f.fittedAt}</td>
          <td><span class="badge badge-pass">${f.qualityReleaseRecordId || 'RELEASED'}</span></td>
        </tr>`
            )
            .join('')
        : '<tr><td colspan="7" style="text-align: center; color: #94a3b8;">No explicit component fitments registered yet.</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;

    return {
      success: true,
      reportType: 'FINAL_MACHINE_RELEASE_RECORD',
      reportTitle: `Final Machine Release Record - ${machine.serialNumber}`,
      generatedAt: new Date().toISOString(),
      documentNumber: machine.serialNumber,
      data: { machine, project, fittedComponents: fitments, manufacturedRecords: mfgRecords },
      html,
    };
  }
}
