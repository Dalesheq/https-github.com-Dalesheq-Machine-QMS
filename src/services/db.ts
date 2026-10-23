/**
 * MACHINE QMS - Database Service & Core Quality Validation Engine
 * Standalone server-backed persistence, cryptographic session tokens,
 * tolerance validation, approved deviation deadlock resolution,
 * drawing revision snapshot validation, and 18-point Quality Release Gate.
 */

import type {
  QMSDatabase,
  User,
  Drawing,
  ManufacturingRecord,
  InspectionRecord,
  InspectionCharacteristic,
  DaleInspectionRecord,
  NCR,
  Deviation,
  CharacteristicResult,
  FileAttachmentMetadata,
  AuthSession,
  InspectionTemplate,
  InspectionTemplateCharacteristic,
  InspectionTemplateQualityCheck,
  CalibrationInstrument,
  ComponentFitmentRecord,
} from '../types.ts';
import {
  reconcileCrossPopulatedDatabase,
  mergeQMSDatabases,
} from '../utils/crossReference.ts';
import { INITIAL_INSPECTION_TEMPLATES } from '../data/inspectionTemplatesData.ts';

const LOCAL_STORAGE_KEY = 'SPIRAL_MACHINE_QMS_DB_V2';
const AUTH_SESSION_STORAGE_KEY = 'SPIRAL_MACHINE_QMS_AUTH_SESSION_V1';

export interface QualityReleaseCheck {
  id: string;
  gateNumber: number;
  category: string;
  requirement: string;
  passed: boolean;
  details: string;
}

export interface QualityReleaseEvaluation {
  manufacturingRecordId: string;
  manufacturingRecord?: ManufacturingRecord;
  inspection?: InspectionRecord;
  drawing?: Drawing;
  openNcrs: NCR[];
  closedNcrs: NCR[];
  allNcrs?: NCR[];
  matchingDaleSheets?: DaleInspectionRecord[];
  unapprovedDeviations: Deviation[];
  approvedDeviations: Deviation[];
  checks: QualityReleaseCheck[];
  canRelease: boolean;
  blockingReasons: string[];
  supersededNotice?: string;
}

// ==========================================
// 1. INITIAL SEED USERS (WITH IMMUTABLE USER IDs & USERNAMES)
// ==========================================

export const INITIAL_USERS: User[] = [
  {
    id: 'USR-001',
    username: 'dave.vance',
    name: 'Dave Vance',
    role: 'MACHINIST',
    department: 'CNC Machining & Turning',
    email: 'dave.vance@spiralsystems.co.za',
    active: true,
  },
  {
    id: 'USR-002',
    username: 'sarah.connor',
    name: 'Sarah Connor',
    role: 'INSPECTOR',
    department: 'Quality Metrology & Inspection',
    email: 'sarah.connor@spiralsystems.co.za',
    active: true,
  },
  {
    id: 'USR-003',
    username: 'peter.ndlovu',
    name: 'Peter Ndlovu',
    role: 'MACHINE_MANAGER',
    department: 'Machine Shop Management',
    email: 'peter.ndlovu@spiralsystems.co.za',
    active: true,
  },
  {
    id: 'USR-004',
    username: 'elena.rostova',
    name: 'Dr. Elena Rostova',
    role: 'ENGINEERING',
    department: 'Mechanical Design & Engineering',
    email: 'elena.rostova@spiralsystems.co.za',
    active: true,
  },
  {
    id: 'USR-005',
    username: 'marcus.chen',
    name: 'Marcus Chen',
    role: 'HSEQ',
    department: 'Quality Assurance & Compliance',
    email: 'marcus.chen@spiralsystems.co.za',
    active: true,
  },
  {
    id: 'USR-006',
    username: 'admin.qms',
    name: 'System Administrator',
    role: 'ADMINISTRATOR',
    department: 'QMS Governance & IT',
    email: 'qms.admin@spiralsystems.co.za',
    active: true,
  },
  {
    id: 'USR-007',
    username: 'johan.kruger',
    name: 'Johan Kruger',
    role: 'MACHINIST',
    department: 'Heavy Milling & Boring',
    email: 'johan.kruger@spiralsystems.co.za',
    active: true,
  },
  {
    id: 'USR-008',
    username: 'sheq',
    name: 'Basil De Swardt',
    role: 'ADMINISTRATOR',
    department: 'QMS Systems & Governance',
    email: 'sheq@spiralsystems.co.za',
    active: true,
  },
  {
    id: 'USR-009',
    username: 'kobus.vanwyk',
    name: 'Kobus van Wyk',
    role: 'MACHINIST',
    department: 'Fabrication & Welding',
    email: 'kobus.vanwyk@spiralsystems.co.za',
    active: true,
  },
  {
    id: 'USR-010',
    username: 'sipho.dlamini',
    name: 'Sipho Dlamini',
    role: 'MACHINIST',
    department: 'Conveyor Systems & Transfers',
    email: 'sipho.dlamini@spiralsystems.co.za',
    active: true,
  },
  {
    id: 'USR-011',
    username: 'andre.fourie',
    name: 'André Fourie',
    role: 'MACHINIST',
    department: 'Spiral Systems & Towers',
    email: 'andre.fourie@spiralsystems.co.za',
    active: true,
  },
  {
    id: 'USR-012',
    username: 'thabo.molefe',
    name: 'Thabo Molefe',
    role: 'MACHINIST',
    department: 'Mechanical Sub-Assembly',
    email: 'thabo.molefe@spiralsystems.co.za',
    active: true,
  },
  {
    id: 'USR-013',
    username: 'heinrich.meyer',
    name: 'Heinrich Meyer',
    role: 'ENGINEERING',
    department: 'Electrical & Control Panels',
    email: 'heinrich.meyer@spiralsystems.co.za',
    active: true,
  },
  {
    id: 'USR-014',
    username: 'liam.pretorius',
    name: 'Liam Pretorius',
    role: 'ENGINEERING',
    department: 'Robotics & Automation Handling',
    email: 'liam.pretorius@spiralsystems.co.za',
    active: true,
  },
  {
    id: 'USR-015',
    username: 'jacques.botha',
    name: 'Jacques Botha',
    role: 'MACHINE_MANAGER',
    department: 'Refrigeration & Cooling Assemblies',
    email: 'jacques.botha@spiralsystems.co.za',
    active: true,
  },
];

// ==========================================
// 2. INITIAL REAL FILE ATTACHMENTS
// ==========================================

export const INITIAL_ATTACHMENTS: FileAttachmentMetadata[] = [
  {
    fileId: 'ATT-2026-0001',
    originalFilename: 'DWG-DIV-101_RevC_MainDriveShaft.pdf',
    storedFilename: 'ATT-2026-0001_DWG-DIV-101_RevC_MainDriveShaft.pdf',
    mimeType: 'application/pdf',
    fileSize: 612,
    uploadDate: '2026-01-12T08:00:00Z',
    uploadedBy: 'Dr. Elena Rostova',
    uploadedById: 'USR-004',
    category: 'DRAWING',
    relatedRecordId: 'DWG-001',
    drawingNumber: 'DWG-DIV-101',
    revision: 'C',
    downloadUrl: '/api/attachments/ATT-2026-0001',
  },
  {
    fileId: 'ATT-2026-0002',
    originalFilename: 'DWG-DIV-102_RevB_HeadDrum.pdf',
    storedFilename: 'ATT-2026-0002_DWG-DIV-102_RevB_HeadDrum.pdf',
    mimeType: 'application/pdf',
    fileSize: 612,
    uploadDate: '2026-01-15T09:30:00Z',
    uploadedBy: 'Dr. Elena Rostova',
    uploadedById: 'USR-004',
    category: 'DRAWING',
    relatedRecordId: 'DWG-003',
    drawingNumber: 'DWG-DIV-102',
    revision: 'B',
    downloadUrl: '/api/attachments/ATT-2026-0002',
  },
  {
    fileId: 'ATT-2026-0003',
    originalFilename: 'DWG-DIV-104_RevA_BearingHousing.pdf',
    storedFilename: 'ATT-2026-0003_DWG-DIV-104_RevA_BearingHousing.pdf',
    mimeType: 'application/pdf',
    fileSize: 612,
    uploadDate: '2026-01-18T10:15:00Z',
    uploadedBy: 'Dr. Elena Rostova',
    uploadedById: 'USR-004',
    category: 'DRAWING',
    relatedRecordId: 'DWG-005',
    drawingNumber: 'DWG-DIV-104',
    revision: 'A',
    downloadUrl: '/api/attachments/ATT-2026-0003',
  },
  {
    fileId: 'ATT-2026-0004',
    originalFilename: 'REDLINE_DWG-DIV-104_RevA_DEV-2026-0001.pdf',
    storedFilename: 'ATT-2026-0004_REDLINE_DWG-DIV-104_RevA_DEV-2026-0001.pdf',
    mimeType: 'application/pdf',
    fileSize: 612,
    uploadDate: '2026-02-19T14:20:00Z',
    uploadedBy: 'Dr. Elena Rostova',
    uploadedById: 'USR-004',
    category: 'REDLINE',
    relatedRecordId: 'DEV-2026-0001',
    drawingNumber: 'DWG-DIV-104',
    revision: 'A',
    downloadUrl: '/api/attachments/ATT-2026-0004',
  },
];

// ==========================================
// 3. DEFAULT PART INSPECTION CHARACTERISTICS
// ==========================================

export const DEFAULT_PART_CHARACTERISTICS: Record<
  string,
  Omit<InspectionCharacteristic, 'id' | 'actual' | 'result'>[]
> = {
  'PART-DIV-001': [
    {
      charNumber: 1,
      feature: 'Drive Journal Bearing Seat OD (Ø50 g6)',
      nominal: 50.0,
      upperTolerance: 0.02,
      lowerTolerance: -0.02,
      unit: 'mm',
      measuringInstrument: 'Mitutoyo Outside Micrometer 25-50mm',
      instrumentId: 'MIC-042',
    },
    {
      charNumber: 2,
      feature: 'Keyway Width (14mm N9)',
      nominal: 14.0,
      upperTolerance: 0.0,
      lowerTolerance: -0.043,
      unit: 'mm',
      measuringInstrument: 'Precision Gage Block & Digital Caliper',
      instrumentId: 'CAL-018',
    },
    {
      charNumber: 3,
      feature: 'Overall Shaft Length',
      nominal: 1240.0,
      upperTolerance: 0.5,
      lowerTolerance: -0.5,
      unit: 'mm',
      measuringInstrument: 'Calibrated Vernier Height/Length Bar',
      instrumentId: 'LEN-004',
    },
  ],
  'PART-DIV-002': [
    {
      charNumber: 1,
      feature: 'Drum Outer Crown Diameter',
      nominal: 320.0,
      upperTolerance: 0.15,
      lowerTolerance: -0.15,
      unit: 'mm',
      measuringInstrument: 'Outside Micrometer 300-400mm',
      instrumentId: 'MIC-112',
    },
    {
      charNumber: 2,
      feature: 'Internal Hub Bore ID (Ø85 H7)',
      nominal: 85.0,
      upperTolerance: 0.035,
      lowerTolerance: 0.0,
      unit: 'mm',
      measuringInstrument: '3-Point Internal Bore Micrometer',
      instrumentId: 'BORE-009',
    },
  ],
  'PART-DIV-003': [
    {
      charNumber: 1,
      feature: 'Roller Outer Diameter',
      nominal: 88.9,
      upperTolerance: 0.1,
      lowerTolerance: -0.1,
      unit: 'mm',
      measuringInstrument: 'Digital Outside Micrometer 75-100mm',
      instrumentId: 'MIC-055',
    },
    {
      charNumber: 2,
      feature: 'Bearing Bore Concentricity',
      nominal: 47.0,
      upperTolerance: 0.025,
      lowerTolerance: 0.0,
      unit: 'mm',
      measuringInstrument: 'Internal Bore Gauge',
      instrumentId: 'BORE-014',
    },
  ],
  'PART-DIV-004': [
    {
      charNumber: 1,
      feature: 'Spherical Bearing Housing Bore ID (Ø110 H7)',
      nominal: 110.0,
      upperTolerance: 0.035,
      lowerTolerance: 0.0,
      unit: 'mm',
      measuringInstrument: 'Mitutoyo Bore Gauge 100-160mm',
      instrumentId: 'BORE-021',
    },
    {
      charNumber: 2,
      feature: 'Base to Centerline Height',
      nominal: 95.0,
      upperTolerance: 0.05,
      lowerTolerance: -0.05,
      unit: 'mm',
      measuringInstrument: 'CMM / Digital Height Gauge',
      instrumentId: 'HGT-003',
    },
  ],
  'PART-DIV-005': [
    {
      charNumber: 1,
      feature: 'Pitch Circle Diameter (PCD)',
      nominal: 215.9,
      upperTolerance: 0.08,
      lowerTolerance: -0.08,
      unit: 'mm',
      measuringInstrument: 'Coordinate Measuring Machine (CMM)',
      instrumentId: 'CMM-001',
    },
    {
      charNumber: 2,
      feature: 'Center Bore Diameter (Ø50 H7)',
      nominal: 50.0,
      upperTolerance: 0.025,
      lowerTolerance: 0.0,
      unit: 'mm',
      measuringInstrument: 'Internal Bore Micrometer',
      instrumentId: 'BORE-007',
    },
  ],
};

// ==========================================
// 4. CONTROLLED CALIBRATION INSTRUMENTS REGISTER
// ==========================================

export const INITIAL_CALIBRATION_INSTRUMENTS: CalibrationInstrument[] = [
  {
    id: 'INST-CAL-001',
    instrumentId: 'CAL-001',
    name: 'Mitutoyo 0-150mm Digital Vernier Caliper',
    serialNumber: 'MIT-500-196-30-A14',
    equipmentType: 'CALIPER',
    certificateNumber: 'SANAS-CAL-2026-0891',
    calibrationDate: '2026-01-10',
    expiryDate: '2027-01-09',
    status: 'VALID',
    range: '0 - 150 mm',
    resolution: '0.01 mm',
    calibratedBy: 'SANAS Accredited Lab #042',
    location: 'Metrology Lab — Inspection Bay 1',
  },
  {
    id: 'INST-MIC-042',
    instrumentId: 'MIC-042',
    name: 'Mitutoyo 0-25mm Precision Digital Micrometer',
    serialNumber: 'MIT-293-240-30-B88',
    equipmentType: 'MICROMETER',
    certificateNumber: 'SANAS-CAL-2026-1102',
    calibrationDate: '2026-01-15',
    expiryDate: '2027-01-14',
    status: 'VALID',
    range: '0 - 25 mm',
    resolution: '0.001 mm',
    calibratedBy: 'SANAS Calibration Services Ltd',
    location: 'Metrology Lab — Cabinet A',
  },
  {
    id: 'INST-MIC-043',
    instrumentId: 'MIC-043',
    name: 'Mitutoyo 25-50mm External Micrometer',
    serialNumber: 'MIT-103-138-C12',
    equipmentType: 'MICROMETER',
    certificateNumber: 'SANAS-CAL-2026-1103',
    calibrationDate: '2026-01-15',
    expiryDate: '2027-01-14',
    status: 'VALID',
    range: '25 - 50 mm',
    resolution: '0.001 mm',
    calibratedBy: 'SANAS Calibration Services Ltd',
    location: 'Metrology Lab — Cabinet A',
  },
  {
    id: 'INST-CAL-014',
    instrumentId: 'CAL-014',
    name: 'Mitutoyo 0-300mm Digimatic Height Gauge',
    serialNumber: 'MIT-192-630-H05',
    equipmentType: 'HEIGHT_GAUGE',
    certificateNumber: 'SANAS-CAL-2026-0944',
    calibrationDate: '2026-02-01',
    expiryDate: '2027-01-31',
    status: 'VALID',
    range: '0 - 300 mm',
    resolution: '0.01 mm',
    calibratedBy: 'Precision Metrology South Africa',
    location: 'Surface Plate 1 — Machine Shop',
  },
  {
    id: 'INST-BORE-007',
    instrumentId: 'BORE-007',
    name: 'Mitutoyo 50-150mm Dial Bore Gauge',
    serialNumber: 'MIT-511-703-D44',
    equipmentType: 'BORE_GAUGE',
    certificateNumber: 'SANAS-CAL-2026-1419',
    calibrationDate: '2026-01-20',
    expiryDate: '2027-01-19',
    status: 'VALID',
    range: '50 - 150 mm',
    resolution: '0.001 mm',
    calibratedBy: 'SANAS Calibration Services Ltd',
    location: 'Metrology Lab — Cabinet B',
  },
  {
    id: 'INST-DIAL-005',
    instrumentId: 'DIAL-005',
    name: 'Mitutoyo 0-10mm Plunger Dial Indicator',
    serialNumber: 'MIT-2046S-P19',
    equipmentType: 'DIAL_INDICATOR',
    certificateNumber: 'SANAS-CAL-2026-1510',
    calibrationDate: '2026-02-15',
    expiryDate: '2027-02-14',
    status: 'VALID',
    range: '0 - 10 mm',
    resolution: '0.01 mm',
    calibratedBy: 'Precision Metrology South Africa',
    location: 'Machine Shop — Lathe Station 1',
  },
  {
    id: 'INST-TORQ-012',
    instrumentId: 'TORQ-012',
    name: 'Norbar 20-100 N·m Precision Clicker Torque Wrench',
    serialNumber: 'NOR-130103-W91',
    equipmentType: 'TORQUE_WRENCH',
    certificateNumber: 'SANAS-CAL-2026-1788',
    calibrationDate: '2026-01-20',
    expiryDate: '2027-01-19',
    status: 'VALID',
    range: '20 - 100 N·m',
    resolution: '1 N·m',
    calibratedBy: 'Torque Calibrations SA',
    location: 'Assembly Bay 2',
  },
];

// ==========================================
// 5. INITIAL SEED DATABASE
// ==========================================

export const INITIAL_DATABASE: QMSDatabase = {
  users: INITIAL_USERS,
  attachments: INITIAL_ATTACHMENTS,
  calibrationInstruments: INITIAL_CALIBRATION_INSTRUMENTS,
  machines: [
    {
      id: 'MCH-001',
      machineType: 'DIVIDER',
      serialNumber: 'DIV-SN-2026-001',
      customer: 'Apex Industrial Bakeries',
      projectNumber: 'PRJ-2026-104',
      projectName: 'Apex High-Speed Dough Divider Line #1',
      manufacturingStatus: 'IN_PRODUCTION',
      assemblyStatus: 'FINAL_ASSEMBLY',
      dateCreated: '2026-01-10T08:00:00Z',
      createdBy: 'Peter Ndlovu',
      notes: 'Primary Divider unit. Requires full critical component QMS release dossier before factory acceptance test (FAT).',
    },
    {
      id: 'MCH-002',
      machineType: 'DIVIDER',
      serialNumber: 'DIV-SN-2026-002',
      customer: 'Premier Foods Automation',
      projectNumber: 'PRJ-2026-108',
      projectName: 'Premier Automated Divider Upgrade',
      manufacturingStatus: 'QUALITY_HOLD',
      assemblyStatus: 'SUB_ASSEMBLY',
      dateCreated: '2026-01-22T09:30:00Z',
      createdBy: 'Peter Ndlovu',
      notes: 'Bearing housing on Quality Hold pending NCR-2026-0001 / DEV-2026-0001 resolution.',
    },
    {
      id: 'MCH-003',
      machineType: 'ROUNDER',
      serialNumber: 'RND-SN-2026-001',
      customer: 'Apex Industrial Bakeries',
      projectNumber: 'PRJ-2026-104',
      projectName: 'Apex High-Speed Dough Divider Line #1',
      manufacturingStatus: 'PLANNED',
      assemblyStatus: 'NOT_STARTED',
      dateCreated: '2026-02-01T10:00:00Z',
      createdBy: 'Peter Ndlovu',
      notes: 'Conical rounder paired with DIV-SN-2026-001.',
    },
    {
      id: 'MCH-004',
      machineType: 'VIBRATORY INFEED',
      serialNumber: 'T0559-SN-001',
      customer: 'Dale Automation / Spiral Systems',
      projectNumber: 'T0559',
      projectName: 'BULK HOPPER — VIBRATORY INFEED SUB-ASSY',
      manufacturingStatus: 'IN_PRODUCTION',
      assemblyStatus: 'SUB_ASSEMBLY',
      dateCreated: '2026-02-24T08:00:00Z',
      createdBy: 'DM',
      notes: 'Bulk Hopper Vibratory Infeed Sub-Assembly (Element Code 719).',
    },
    {
      id: 'MCH-005',
      machineType: 'SPIRAL FREEZER',
      serialNumber: 'SPF-SN-2026-001',
      customer: 'Dale Automation / CoolStream Foods',
      projectNumber: 'PRJ-2026-112',
      projectName: '24-Tier Twin-Drum Spiral Freezing System',
      manufacturingStatus: 'IN_PRODUCTION',
      assemblyStatus: 'SUB_ASSEMBLY',
      dateCreated: '2026-02-28T08:30:00Z',
      createdBy: 'Peter Ndlovu',
      notes: 'Manufactured 24-tier spiral drum with stainless cooling assembly and hygienic belt.',
    },
    {
      id: 'MCH-006',
      machineType: 'ROBOTIC CELL',
      serialNumber: 'ROB-SN-2026-001',
      customer: 'Dale Automation / Apex Bakery Systems',
      projectNumber: 'PRJ-2026-115',
      projectName: 'Automated Robotic Pan & Lid Handling Cell',
      manufacturingStatus: 'IN_PRODUCTION',
      assemblyStatus: 'SUB_ASSEMBLY',
      dateCreated: '2026-03-01T09:00:00Z',
      createdBy: 'Peter Ndlovu',
      notes: 'Gantry robot cell with magnetic/vacuum head and infeed conveyor handling.',
    },
  ],
  projects: [
    {
      id: 'PRJ-001',
      projectNumber: 'PRJ-2026-104',
      projectName: 'Apex High-Speed Dough Divider Line #1',
      customer: 'Apex Industrial Bakeries',
      machineType: 'DIVIDER',
      associatedSerialNumbers: ['DIV-SN-2026-001', 'RND-SN-2026-001'],
      machineSerialNumbers: ['DIV-SN-2026-001', 'RND-SN-2026-001'],
      projectStatus: 'ACTIVE',
      startDate: '2026-01-08',
      targetCompletionDate: '2026-04-30',
      createdBy: 'Peter Ndlovu',
      notes: 'Turnkey Divider + Rounder system with 100% component traceability.',
    },
    {
      id: 'PRJ-002',
      projectNumber: 'PRJ-2026-108',
      projectName: 'Premier Automated Divider Upgrade',
      customer: 'Premier Foods Automation',
      machineType: 'DIVIDER',
      associatedSerialNumbers: ['DIV-SN-2026-002'],
      machineSerialNumbers: ['DIV-SN-2026-002'],
      projectStatus: 'ON_HOLD',
      startDate: '2026-01-20',
      targetCompletionDate: '2026-05-15',
      createdBy: 'Peter Ndlovu',
      notes: 'Heavy-duty stainless steel Divider build.',
    },
    {
      id: 'PRJ-003',
      projectNumber: 'T0559',
      projectName: 'Bulk Hopper Vibratory Infeed Sub-Assy',
      customer: 'Dale Automation / Spiral Systems',
      machineType: 'VIBRATORY INFEED',
      associatedSerialNumbers: ['T0559-SN-001'],
      machineSerialNumbers: ['T0559-SN-001'],
      projectStatus: 'ACTIVE',
      startDate: '2026-02-15',
      targetCompletionDate: '2026-05-20',
      createdBy: 'Peter Ndlovu',
      notes: 'Bulk hopper infeed and vibratory chute manufactured assembly.',
    },
    {
      id: 'PRJ-004',
      projectNumber: 'PRJ-2026-112',
      projectName: '24-Tier Twin-Drum Spiral Freezing & Cooling System',
      customer: 'CoolStream Industrial Foods',
      machineType: 'SPIRAL FREEZER',
      associatedSerialNumbers: ['SPF-SN-2026-001'],
      machineSerialNumbers: ['SPF-SN-2026-001'],
      projectStatus: 'ACTIVE',
      startDate: '2026-02-28',
      targetCompletionDate: '2026-06-30',
      createdBy: 'Peter Ndlovu',
      notes: 'Heavy-duty spiral freezer drum, modular conveyor and cooling assemblies.',
    },
    {
      id: 'PRJ-005',
      projectNumber: 'PRJ-2026-115',
      projectName: 'Automated Robotic Pan & Lid Handling Cell',
      customer: 'Apex Bakery Automation',
      machineType: 'ROBOTIC CELL',
      associatedSerialNumbers: ['ROB-SN-2026-001'],
      machineSerialNumbers: ['ROB-SN-2026-001'],
      projectStatus: 'ACTIVE',
      startDate: '2026-03-01',
      targetCompletionDate: '2026-07-15',
      createdBy: 'Peter Ndlovu',
      notes: 'High-speed robotic pan destacking gantry with magnetic/vacuum tooling.',
    },
  ],
  components: [
    {
      id: 'CMP-001',
      partNumber: 'PART-DIV-001',
      description: 'Main Drive Shaft (Divider)',
      category: 'SHAFT',
      machineTypes: ['DIVIDER'],
      criticalComponent: true,
      defaultDrawingNumber: 'DWG-DIV-101',
      currentDrawingRevision: 'C',
      drawingNumber: 'DWG-DIV-101',
      materialSpecification: 'EN24T High-Tensile Alloy Steel',
      traceabilityRequired: true,
      permanentIdRequired: true,
      active: true,
      createdDate: '2026-01-05T08:00:00Z',
      notes: 'Critical load-bearing drive shaft. Laser marking on non-mating shoulder mandatory.',
    },
    {
      id: 'CMP-002',
      partNumber: 'PART-DIV-002',
      description: 'Precision Head Drum Assembly',
      category: 'DRUM',
      machineTypes: ['DIVIDER'],
      criticalComponent: true,
      defaultDrawingNumber: 'DWG-DIV-102',
      currentDrawingRevision: 'B',
      drawingNumber: 'DWG-DIV-102',
      materialSpecification: 'AISI 316L Food-Grade Stainless Steel',
      traceabilityRequired: true,
      permanentIdRequired: true,
      active: true,
      createdDate: '2026-01-05T08:15:00Z',
      notes: 'Concentricity and internal bore H7 tolerance strictly enforced.',
    },
    {
      id: 'CMP-003',
      partNumber: 'PART-DIV-003',
      description: 'Idler Tension Roller',
      category: 'ROLLER',
      machineTypes: ['DIVIDER', 'CONVEYOR'],
      criticalComponent: true,
      defaultDrawingNumber: 'DWG-DIV-103',
      currentDrawingRevision: 'A',
      drawingNumber: 'DWG-DIV-103',
      materialSpecification: 'AISI 304 Stainless Steel',
      traceabilityRequired: true,
      permanentIdRequired: false,
      active: true,
      createdDate: '2026-01-06T09:00:00Z',
      notes: 'Critical dimensional fit; permanent engraving optional as tagged by batch carrier.',
    },
    {
      id: 'CMP-004',
      partNumber: 'PART-DIV-004',
      description: 'Main Spherical Bearing Housing',
      category: 'BEARING_BLOCK',
      machineTypes: ['DIVIDER'],
      criticalComponent: true,
      defaultDrawingNumber: 'DWG-DIV-104',
      currentDrawingRevision: 'A',
      drawingNumber: 'DWG-DIV-104',
      materialSpecification: 'SG42 Ductile Cast Iron / Machined',
      traceabilityRequired: true,
      permanentIdRequired: true,
      active: true,
      createdDate: '2026-01-07T10:00:00Z',
      notes: 'H7 bearing housing bore. Hard-stamped or laser-marked serial reference required.',
    },
    {
      id: 'CMP-005',
      partNumber: 'PART-DIV-005',
      description: 'Index Drive Sprocket 28T',
      category: 'SPROCKET',
      machineTypes: ['DIVIDER'],
      criticalComponent: true,
      defaultDrawingNumber: 'DWG-DIV-105',
      currentDrawingRevision: 'B',
      drawingNumber: 'DWG-DIV-105',
      materialSpecification: 'EN19 Induction Hardened Tooth Profile',
      traceabilityRequired: true,
      permanentIdRequired: true,
      active: true,
      createdDate: '2026-01-08T11:00:00Z',
      notes: 'Pitch circle diameter and bore H7 checked on CMM.',
    },
    {
      id: 'CMP-006',
      partNumber: 'PART-DIV-099',
      description: 'Non-Critical Acrylic Guard Spacer',
      category: 'OTHER',
      machineTypes: ['DIVIDER'],
      criticalComponent: false,
      defaultDrawingNumber: 'DWG-DIV-101',
      currentDrawingRevision: 'C',
      drawingNumber: 'DWG-DIV-101',
      materialSpecification: 'Polycarbonate Clear 10mm',
      traceabilityRequired: false,
      permanentIdRequired: false,
      active: true,
      createdDate: '2026-01-09T12:00:00Z',
      notes: 'Standard non-critical guard spacer (demonstrates Component Master flag behavior).',
    },
  ],
  drawings: [
    {
      id: 'DWG-001',
      drawingNumber: 'DWG-DIV-101',
      drawingTitle: 'Main Drive Shaft Machining & Grinding Print',
      partNumber: 'PART-DIV-001',
      revision: 'C',
      drawingStatus: 'APPROVED',
      approvedBy: 'Dr. Elena Rostova',
      approvedById: 'USR-004',
      approvalDate: '2026-01-12',
      effectiveDate: '2026-01-12',
      revisionNotes: 'Updated bearing seat surface finish to Ra 0.4 and journal tolerance ±0.02mm.',
      previousRevision: 'B',
      fileName: 'DWG-DIV-101_RevC_MainDriveShaft.pdf',
      drawingFile: INITIAL_ATTACHMENTS[0],
      isCurrent: true,
    },
    {
      id: 'DWG-002',
      drawingNumber: 'DWG-DIV-101',
      drawingTitle: 'Main Drive Shaft Machining & Grinding Print (Prior Rev B)',
      partNumber: 'PART-DIV-001',
      revision: 'B',
      drawingStatus: 'SUPERSEDED',
      approvedBy: 'Dr. Elena Rostova',
      approvedById: 'USR-004',
      approvalDate: '2025-09-10',
      effectiveDate: '2025-09-10',
      revisionNotes: 'Superseded by Rev C on 2026-01-12. Historical builds prior to Rev C remain valid.',
      previousRevision: 'A',
      isCurrent: false,
    },
    {
      id: 'DWG-003',
      drawingNumber: 'DWG-DIV-102',
      drawingTitle: 'Precision Head Drum Finish Machining',
      partNumber: 'PART-DIV-002',
      revision: 'B',
      drawingStatus: 'APPROVED',
      approvedBy: 'Dr. Elena Rostova',
      approvedById: 'USR-004',
      approvalDate: '2026-01-15',
      effectiveDate: '2026-01-15',
      revisionNotes: 'Approved production print for 316L drum.',
      previousRevision: 'A',
      fileName: 'DWG-DIV-102_RevB_HeadDrum.pdf',
      drawingFile: INITIAL_ATTACHMENTS[1],
      isCurrent: true,
    },
    {
      id: 'DWG-004',
      drawingNumber: 'DWG-DIV-103',
      drawingTitle: 'Idler Tension Roller Detail',
      partNumber: 'PART-DIV-003',
      revision: 'A',
      drawingStatus: 'APPROVED',
      approvedBy: 'Dr. Elena Rostova',
      approvedById: 'USR-004',
      approvalDate: '2026-01-16',
      effectiveDate: '2026-01-16',
      revisionNotes: 'Initial approved production release.',
      isCurrent: true,
    },
    {
      id: 'DWG-005',
      drawingNumber: 'DWG-DIV-104',
      drawingTitle: 'Main Spherical Bearing Housing Machining',
      partNumber: 'PART-DIV-004',
      revision: 'A',
      drawingStatus: 'APPROVED',
      approvedBy: 'Dr. Elena Rostova',
      approvedById: 'USR-004',
      approvalDate: '2026-01-18',
      effectiveDate: '2026-01-18',
      revisionNotes: 'Approved bearing housing print.',
      fileName: 'DWG-DIV-104_RevA_BearingHousing.pdf',
      drawingFile: INITIAL_ATTACHMENTS[2],
      isCurrent: true,
    },
    {
      id: 'DWG-006',
      drawingNumber: 'DWG-DIV-105',
      drawingTitle: 'Index Drive Sprocket 28T Detail',
      partNumber: 'PART-DIV-005',
      revision: 'B',
      drawingStatus: 'APPROVED',
      approvedBy: 'Dr. Elena Rostova',
      approvedById: 'USR-004',
      approvalDate: '2026-01-20',
      effectiveDate: '2026-01-20',
      revisionNotes: 'Approved tooth hardening specification.',
      previousRevision: 'A',
      isCurrent: true,
    },
    {
      id: 'DWG-007',
      drawingNumber: 'DWG-DIV-199',
      drawingTitle: 'Experimental High-Speed Knife Carrier (UNAPPROVED DRAFT)',
      partNumber: 'PART-DIV-001',
      revision: 'A',
      drawingStatus: 'DRAFT',
      effectiveDate: '2026-03-01',
      revisionNotes: 'Unapproved engineering draft — blocked from manufacturing.',
      isCurrent: true,
    },
    {
      id: 'DWG-008',
      drawingNumber: 'T0559-058-719-00-02-00',
      drawingTitle: 'INFEED CHUTE (VIBRATORY INFEED SUB-ASSY)',
      partNumber:
        '719-00-02-012-01; 719-00-02-011-01; 719-00-02-010-01; 719-00-02-009-01; 719-00-02-008-01; 719-00-02-007-01; 719-00-02-006-01',
      partNumbers: [
        '719-00-02-012-01',
        '719-00-02-011-01',
        '719-00-02-010-01',
        '719-00-02-009-01',
        '719-00-02-008-01',
        '719-00-02-007-01',
        '719-00-02-006-01',
      ],
      partsList: [
        {
          id: 'PT-719-1',
          itemNumber: '1',
          quantity: '1',
          partNumber: '719-00-02-006-01',
          description: 'INFEED CHUTE PLATE, 1,5mm x 507,1mm x 557,3mm',
          material: 'S/S 304 SATIN',
          designation: 'MANUF-INT',
        },
        {
          id: 'PT-719-2',
          itemNumber: '2',
          quantity: '1',
          partNumber: '719-00-02-007-01',
          description: 'FIXED GUIDE, 2mm x 91,6mm x 371mm',
          material: 'S/S 304 SATIN',
          designation: 'MANUF-INT',
        },
        {
          id: 'PT-719-3',
          itemNumber: '3',
          quantity: '2',
          partNumber: '719-00-02-008-01',
          description: 'MOUNTING BRACKET, FIXED GUIDE, 3mm x 42mm x 141,6mm',
          material: 'S/S 304 SATIN',
          designation: 'MANUF-INT',
        },
        {
          id: 'PT-719-4',
          itemNumber: '4',
          quantity: '1',
          partNumber: '719-00-02-009-01',
          description: 'FIXED GUIDE PLATE, 2mm x 71mm x 369,8mm',
          material: 'S/S 304 SATIN',
          designation: 'MANUF-INT',
        },
        {
          id: 'PT-719-5',
          itemNumber: '5',
          quantity: '2',
          partNumber: '719-00-02-010-01',
          description: 'FIXED GUIDE LOCKING PLATE, 2mm x 35mm x 56,5mm',
          material: 'S/S 304 SATIN',
          designation: 'MANUF-INT',
        },
        {
          id: 'PT-719-6',
          itemNumber: '6',
          quantity: '1',
          partNumber: '719-00-02-011-01',
          description: 'FIXED GUIDE SUPPORT ARMS P1, 2mm x 39,2mm x 622,8mm',
          material: 'S/S 304 SATIN',
          designation: 'MANUF-INT',
        },
        {
          id: 'PT-719-7',
          itemNumber: '7',
          quantity: '1',
          partNumber: '719-00-02-012-01',
          description: 'FIXED GUIDE SUPPORT ARMS P2, 2mm x 39,2mm x 622,8mm',
          material: 'S/S 304 SATIN',
          designation: 'MANUF-INT',
        },
      ],
      revision: '0',
      drawingStatus: 'APPROVED',
      approvedBy: 'DM',
      approvedById: 'USR-004',
      approvalDate: '2026-02-24',
      effectiveDate: '2026-02-24',
      revisionNotes: 'ISSUED FOR MANUFACTURE.',
      projectReference: 'T0559 - BULK HOPPER (VIBRATORY INFEED SUB-ASSY)',
      elementCode: '719',
      scale: 'A.O.D. (1 : 0.5)',
      sheetSize: 'A3',
      sheetNumber: '1 / 1',
      modelledBy: 'DM',
      modelledDate: '2023-10-11',
      detailedBy: 'DM',
      detailedDate: '2026-02-24',
      referenceDrawings: 'T0559-058-719-00-00-00 — GA, VIBRATORY INFEED',
      isCurrent: true,
    },
  ],
  manufacturingRecords: [
    {
      id: 'MR-1001',
      traceabilityNumber: 'DIV-2026-0001',
      machineSerialNumber: 'DIV-SN-2026-001',
      projectNumber: 'PRJ-2026-104',
      partNumber: 'PART-DIV-001',
      componentDescription: 'Main Drive Shaft (Divider)',
      drawingNumber: 'DWG-DIV-101',
      drawingRevision: 'C',
      drawingSnapshot: {
        drawingId: 'DWG-001',
        drawingNumber: 'DWG-DIV-101',
        drawingRevision: 'C',
        approvalStatusAtManufacture: 'APPROVED',
        drawingApprovalDate: '2026-01-12',
        drawingEffectiveDate: '2026-01-12',
        drawingApprovedBy: 'Dr. Elena Rostova',
        drawingFileId: 'ATT-2026-0001',
        capturedAt: '2026-02-10T08:00:00Z',
      },
      quantity: 1,
      manufacturingDate: '2026-02-10',
      machinist: 'Dave Vance',
      machinistId: 'USR-001',
      workstation: 'CNC Turning Center #2 (Mazak QTN-250)',
      batchMaterialRef: 'HEAT-EN24T-8841',
      permanentIdMethod: 'LASER MARKED',
      permanentIdReference: 'DIV-2026-0001 / PART-DIV-001 REV C',
      permanentIdCompleted: true,
      permanentIdDate: '2026-02-10',
      permanentIdBy: 'Dave Vance',
      permanentIdById: 'USR-001',
      manufacturingStatus: 'RELEASED',
      notes: 'Machined and ground to Rev C specification. Full QMS release completed.',
      createdBy: 'Dave Vance',
      createdById: 'USR-001',
      createdDate: '2026-02-10T08:00:00Z',
    },
    {
      id: 'MR-1002',
      traceabilityNumber: 'DIV-2026-0002',
      machineSerialNumber: 'DIV-SN-2026-001',
      projectNumber: 'PRJ-2026-104',
      partNumber: 'PART-DIV-002',
      componentDescription: 'Precision Head Drum Assembly',
      drawingNumber: 'DWG-DIV-102',
      drawingRevision: 'B',
      drawingSnapshot: {
        drawingId: 'DWG-003',
        drawingNumber: 'DWG-DIV-102',
        drawingRevision: 'B',
        approvalStatusAtManufacture: 'APPROVED',
        drawingApprovalDate: '2026-01-15',
        drawingEffectiveDate: '2026-01-15',
        drawingApprovedBy: 'Dr. Elena Rostova',
        drawingFileId: 'ATT-2026-0002',
        capturedAt: '2026-02-14T09:15:00Z',
      },
      quantity: 1,
      manufacturingDate: '2026-02-14',
      machinist: 'Johan Kruger',
      machinistId: 'USR-007',
      workstation: 'Horizontal Boring Mill #1',
      batchMaterialRef: 'HEAT-316L-4410',
      permanentIdMethod: 'ENGRAVED',
      permanentIdReference: 'DIV-2026-0002 / DRUM-01',
      permanentIdCompleted: true,
      permanentIdDate: '2026-02-14',
      permanentIdBy: 'Johan Kruger',
      permanentIdById: 'USR-007',
      manufacturingStatus: 'INSPECTION_PASSED',
      notes: 'Inspection signed off by Sarah Connor. Ready for final Quality Release Gate.',
      createdBy: 'Johan Kruger',
      createdById: 'USR-007',
      createdDate: '2026-02-14T09:15:00Z',
    },
    {
      id: 'MR-1003',
      traceabilityNumber: 'DIV-2026-0003',
      machineSerialNumber: 'DIV-SN-2026-002',
      projectNumber: 'PRJ-2026-108',
      partNumber: 'PART-DIV-004',
      componentDescription: 'Main Spherical Bearing Housing',
      drawingNumber: 'DWG-DIV-104',
      drawingRevision: 'A',
      drawingSnapshot: {
        drawingId: 'DWG-005',
        drawingNumber: 'DWG-DIV-104',
        drawingRevision: 'A',
        approvalStatusAtManufacture: 'APPROVED',
        drawingApprovalDate: '2026-01-18',
        drawingEffectiveDate: '2026-01-18',
        drawingApprovedBy: 'Dr. Elena Rostova',
        drawingFileId: 'ATT-2026-0003',
        capturedAt: '2026-02-18T11:00:00Z',
      },
      quantity: 2,
      manufacturingDate: '2026-02-18',
      machinist: 'Dave Vance',
      machinistId: 'USR-001',
      workstation: 'Vertical Machining Center #3',
      batchMaterialRef: 'CAST-SG42-902',
      permanentIdMethod: 'STAMPED',
      permanentIdReference: 'DIV-2026-0003-BH',
      permanentIdCompleted: true,
      permanentIdDate: '2026-02-18',
      permanentIdBy: 'Dave Vance',
      permanentIdById: 'USR-001',
      manufacturingStatus: 'HOLD',
      notes: 'Placed on immediate QUALITY HOLD due to Char #1 bore oversize (110.048mm vs max 110.035mm).',
      createdBy: 'Dave Vance',
      createdById: 'USR-001',
      createdDate: '2026-02-18T11:00:00Z',
    },
    {
      id: 'MR-1004',
      traceabilityNumber: 'DIV-2026-0004',
      machineSerialNumber: 'DIV-SN-2026-001',
      projectNumber: 'PRJ-2026-104',
      partNumber: 'PART-DIV-005',
      componentDescription: 'Index Drive Sprocket 28T',
      drawingNumber: 'DWG-DIV-105',
      drawingRevision: 'B',
      drawingSnapshot: {
        drawingId: 'DWG-006',
        drawingNumber: 'DWG-DIV-105',
        drawingRevision: 'B',
        approvalStatusAtManufacture: 'APPROVED',
        drawingApprovalDate: '2026-01-20',
        drawingEffectiveDate: '2026-01-20',
        drawingApprovedBy: 'Dr. Elena Rostova',
        capturedAt: '2026-02-20T13:30:00Z',
      },
      quantity: 1,
      manufacturingDate: '2026-02-20',
      machinist: 'Dave Vance',
      machinistId: 'USR-001',
      workstation: 'Gear Hobbing & CNC Cell #4',
      batchMaterialRef: 'HEAT-EN19-7731',
      permanentIdMethod: 'NONE',
      permanentIdReference: '',
      permanentIdCompleted: false,
      manufacturingStatus: 'AWAITING_IDENTIFICATION',
      notes: 'Machining complete. Awaiting permanent laser marking before QMS inspection.',
      createdBy: 'Dave Vance',
      createdById: 'USR-001',
      createdDate: '2026-02-20T13:30:00Z',
    },
  ],
  inspections: [
    {
      id: 'INSP-2026-0001',
      manufacturingRecordId: 'MR-1001',
      traceabilityNumber: 'DIV-2026-0001',
      machineSerialNumber: 'DIV-SN-2026-001',
      projectNumber: 'PRJ-2026-104',
      partNumber: 'PART-DIV-001',
      componentDescription: 'Main Drive Shaft (Divider)',
      quantity: 1,
      drawingNumber: 'DWG-DIV-101',
      drawingRevision: 'C',
      machinist: 'Dave Vance',
      machinistId: 'USR-001',
      manufacturingDate: '2026-02-10',
      inspectorId: 'USR-002',
      inspectorName: 'Sarah Connor',
      inspectionDate: '2026-02-11',
      inspectionTime: '10:30',
      status: 'PASS',
      drawingVerification: {
        correctDrawingNumber: true,
        correctDrawingRevision: true,
        drawingApproved: true,
        componentCorrespondsToDrawing: true,
        associationCorrect: true,
      },
      characteristics: [
        {
          id: 'CHAR-1001-1',
          charNumber: 1,
          feature: 'Drive Journal Bearing Seat OD (Ø50 g6)',
          nominal: 50.0,
          upperTolerance: 0.02,
          lowerTolerance: -0.02,
          unit: 'mm',
          actual: 50.01,
          measuringInstrument: 'Mitutoyo Outside Micrometer 25-50mm',
          instrumentId: 'MIC-042',
          result: 'PASS',
          disposition: 'STANDARD',
        },
        {
          id: 'CHAR-1001-2',
          charNumber: 2,
          feature: 'Keyway Width (14mm N9)',
          nominal: 14.0,
          upperTolerance: 0.0,
          lowerTolerance: -0.043,
          unit: 'mm',
          actual: 13.98,
          measuringInstrument: 'Precision Gage Block & Digital Caliper',
          instrumentId: 'CAL-018',
          result: 'PASS',
          disposition: 'STANDARD',
        },
        {
          id: 'CHAR-1001-3',
          charNumber: 3,
          feature: 'Overall Shaft Length',
          nominal: 1240.0,
          upperTolerance: 0.5,
          lowerTolerance: -0.5,
          unit: 'mm',
          actual: 1240.1,
          measuringInstrument: 'Calibrated Vernier Height/Length Bar',
          instrumentId: 'LEN-004',
          result: 'PASS',
          disposition: 'STANDARD',
        },
      ],
      inspectorSignOff: {
        confirmed: true,
        declaration:
          'I certify that component DIV-2026-0001 has been inspected against Approved Drawing DWG-DIV-101 Rev C and all critical dimensions conform.',
        signedAt: '2026-02-11T10:45:00Z',
        inspectorId: 'USR-002',
        inspectorName: 'Sarah Connor',
        inspectorRole: 'INSPECTOR',
      },
      createdAt: '2026-02-11T09:30:00Z',
      updatedAt: '2026-02-11T10:45:00Z',
    },
    {
      id: 'INSP-2026-0002',
      manufacturingRecordId: 'MR-1002',
      traceabilityNumber: 'DIV-2026-0002',
      machineSerialNumber: 'DIV-SN-2026-001',
      projectNumber: 'PRJ-2026-104',
      partNumber: 'PART-DIV-002',
      componentDescription: 'Precision Head Drum Assembly',
      quantity: 1,
      drawingNumber: 'DWG-DIV-102',
      drawingRevision: 'B',
      machinist: 'Johan Kruger',
      machinistId: 'USR-007',
      manufacturingDate: '2026-02-14',
      inspectorId: 'USR-002',
      inspectorName: 'Sarah Connor',
      inspectionDate: '2026-02-15',
      inspectionTime: '14:15',
      status: 'PASS',
      drawingVerification: {
        correctDrawingNumber: true,
        correctDrawingRevision: true,
        drawingApproved: true,
        componentCorrespondsToDrawing: true,
        associationCorrect: true,
      },
      characteristics: [
        {
          id: 'CHAR-1002-1',
          charNumber: 1,
          feature: 'Drum Outer Crown Diameter',
          nominal: 320.0,
          upperTolerance: 0.15,
          lowerTolerance: -0.15,
          unit: 'mm',
          actual: 320.04,
          measuringInstrument: 'Outside Micrometer 300-400mm',
          instrumentId: 'MIC-112',
          result: 'PASS',
          disposition: 'STANDARD',
        },
        {
          id: 'CHAR-1002-2',
          charNumber: 2,
          feature: 'Internal Hub Bore ID (Ø85 H7)',
          nominal: 85.0,
          upperTolerance: 0.035,
          lowerTolerance: 0.0,
          unit: 'mm',
          actual: 85.018,
          measuringInstrument: '3-Point Internal Bore Micrometer',
          instrumentId: 'BORE-009',
          result: 'PASS',
          disposition: 'STANDARD',
        },
      ],
      inspectorSignOff: {
        confirmed: true,
        declaration:
          'I certify that component DIV-2026-0002 has been inspected against Approved Drawing DWG-DIV-102 Rev B and conforms to all tolerances.',
        signedAt: '2026-02-15T14:30:00Z',
        inspectorId: 'USR-002',
        inspectorName: 'Sarah Connor',
        inspectorRole: 'INSPECTOR',
      },
      createdAt: '2026-02-15T13:50:00Z',
      updatedAt: '2026-02-15T14:30:00Z',
    },
    {
      id: 'INSP-2026-0003',
      manufacturingRecordId: 'MR-1003',
      traceabilityNumber: 'DIV-2026-0003',
      machineSerialNumber: 'DIV-SN-2026-002',
      projectNumber: 'PRJ-2026-108',
      partNumber: 'PART-DIV-004',
      componentDescription: 'Main Spherical Bearing Housing',
      quantity: 2,
      drawingNumber: 'DWG-DIV-104',
      drawingRevision: 'A',
      machinist: 'Dave Vance',
      machinistId: 'USR-001',
      manufacturingDate: '2026-02-18',
      inspectorId: 'USR-002',
      inspectorName: 'Sarah Connor',
      inspectionDate: '2026-02-19',
      inspectionTime: '11:20',
      status: 'FAIL',
      drawingVerification: {
        correctDrawingNumber: true,
        correctDrawingRevision: true,
        drawingApproved: true,
        componentCorrespondsToDrawing: true,
        associationCorrect: true,
      },
      characteristics: [
        {
          id: 'CHAR-1003-1',
          charNumber: 1,
          feature: 'Spherical Bearing Housing Bore ID (Ø110 H7)',
          nominal: 110.0,
          upperTolerance: 0.035,
          lowerTolerance: 0.0,
          unit: 'mm',
          actual: 110.048,
          measuringInstrument: 'Mitutoyo Bore Gauge 100-160mm',
          instrumentId: 'BORE-021',
          result: 'FAIL',
          disposition: 'STANDARD',
          comment: 'Oversize by +0.013mm over upper limit 110.035mm. Placed on QUALITY HOLD.',
        },
        {
          id: 'CHAR-1003-2',
          charNumber: 2,
          feature: 'Base to Centerline Height',
          nominal: 95.0,
          upperTolerance: 0.05,
          lowerTolerance: -0.05,
          unit: 'mm',
          actual: 95.01,
          measuringInstrument: 'CMM / Digital Height Gauge',
          instrumentId: 'HGT-003',
          result: 'PASS',
          disposition: 'STANDARD',
        },
      ],
      ncrId: 'NCR-2026-0001',
      deviationId: 'DEV-2026-0001',
      createdAt: '2026-02-19T11:00:00Z',
      updatedAt: '2026-02-19T11:25:00Z',
    },
  ],
  daleInspections: [
    {
      id: 'DALE-INSP-2026-001',
      sheetNumber: 'DALE-INSP-001',
      processType: 'FABRICATION_WELDING',
      processTitle: '1. Fabrication & Welding',
      projectNumber: 'T0559',
      machineOrAssembly: 'BULK HOPPER — VIBRATORY INFEED SUB-ASSY (T0559-SN-001)',
      drawingNumber: 'T0559-058-719-00-02-00',
      drawingRevision: '0',
      partOrSerialNo: '719-00-02-006-01',
      partDescription: 'INFEED CHUTE PLATE, 1,5mm x 507,1mm x 557,3mm (S/S 304 SATIN)',
      inspector: 'Sarah Connor',
      inspectorId: 'USR-002',
      inspectionDate: '2026-02-25',
      points: [
        {
          id: 'PT-1',
          pointNumber: 1,
          description: 'Material verified (certificate / grade / thickness checked)',
          mandatory: true,
          requiresMeasurement: true,
          measurementUnit: 'Thickness & Grade',
          measurementValue: '',
          result: null,
          comment: '',
        },
        {
          id: 'PT-2',
          pointNumber: 2,
          description: 'Dimensions (cut length, width, hole pitch & flange centers)',
          mandatory: true,
          requiresMeasurement: true,
          measurementUnit: 'mm',
          measurementValue: '',
          result: null,
          comment: '',
        },
        {
          id: 'PT-3',
          pointNumber: 3,
          description: 'Weld quality / continuity (uniform bead, full penetration, no cracks/porosity)',
          mandatory: true,
          requiresMeasurement: false,
          result: null,
          comment: '',
        },
        {
          id: 'PT-4',
          pointNumber: 4,
          description: 'Distortion (frame squareness, heat distortion within tolerance)',
          mandatory: true,
          requiresMeasurement: true,
          measurementUnit: 'mm deviation',
          measurementValue: '',
          result: null,
          comment: '',
        },
        {
          id: 'PT-5',
          pointNumber: 5,
          description: 'Sharp edges (deburred, laser dross removed, safe handling)',
          mandatory: true,
          requiresMeasurement: false,
          result: null,
          comment: '',
        },
        {
          id: 'PT-6',
          pointNumber: 6,
          description: 'Finish (weld pickling / passivation or linishing acceptable)',
          mandatory: true,
          requiresMeasurement: false,
          result: null,
          comment: '',
        },
        {
          id: 'PT-7',
          pointNumber: 7,
          description: 'Identification (part number, drawing rev & job marked)',
          mandatory: true,
          requiresMeasurement: false,
          result: null,
          comment: '',
        },
      ],
      comments: 'Workshop manufacturing inspection sheet generated for Job T0559. Factory scope only.',
      ncrReference: 'None',
      correctiveAction: '',
      approvalStatus: 'PENDING',
      createdAt: '2026-02-25T11:00:00Z',
      updatedAt: '2026-02-25T11:20:00Z',
    },
    {
      id: 'DALE-INSP-2026-002',
      sheetNumber: 'DALE-INSP-002',
      processType: 'MACHINED_PARTS',
      processTitle: '2. Machined Parts',
      projectNumber: 'PRJ-2026-104',
      machineOrAssembly: 'Apex High-Speed Dough Divider Line #1 (DIV-SN-2026-001)',
      drawingNumber: 'DWG-DIV-101',
      drawingRevision: 'C',
      partOrSerialNo: 'PART-DIV-001',
      partDescription: 'Main Drive Shaft (Divider)',
      inspector: 'Sarah Connor',
      inspectorId: 'USR-002',
      inspectionDate: '2026-02-11',
      points: [
        {
          id: 'PT-1',
          pointNumber: 1,
          description: 'Material verified (grade & raw material test certificate)',
          mandatory: true,
          requiresMeasurement: true,
          measurementUnit: 'Material Grade',
          measurementValue: '',
          result: null,
          comment: '',
        },
        {
          id: 'PT-2',
          pointNumber: 2,
          description: 'Drawing / revision verified (latest approved production print)',
          mandatory: true,
          requiresMeasurement: false,
          result: null,
          comment: '',
        },
        {
          id: 'PT-3',
          pointNumber: 3,
          description: 'Key dimensions / tolerances (critical journals, bearing seats, lengths)',
          mandatory: true,
          requiresMeasurement: true,
          measurementUnit: 'mm',
          measurementValue: '',
          result: null,
          comment: '',
        },
        {
          id: 'PT-4',
          pointNumber: 4,
          description: 'Holes / threads (thread depth, keyway width & pitch circle)',
          mandatory: true,
          requiresMeasurement: true,
          measurementUnit: 'Keyway mm',
          measurementValue: '',
          result: null,
          comment: '',
        },
        {
          id: 'PT-5',
          pointNumber: 5,
          description: 'Surface condition (bearing journal finish, no chatter/tool marks)',
          mandatory: true,
          requiresMeasurement: true,
          measurementUnit: 'Ra µm',
          measurementValue: '',
          result: null,
          comment: '',
        },
        {
          id: 'PT-6',
          pointNumber: 6,
          description: 'Part identification (permanent marking & drawing revision)',
          mandatory: true,
          requiresMeasurement: false,
          result: null,
          comment: '',
        },
      ],
      comments: 'Workshop manufacturing inspection sheet generated for Job PRJ-2026-104. Factory scope only.',
      ncrReference: 'None',
      correctiveAction: '',
      approvalStatus: 'PENDING',
      createdAt: '2026-02-11T10:30:00Z',
      updatedAt: '2026-02-11T10:45:00Z',
    },
    {
      id: 'DALE-INSP-2026-003',
      sheetNumber: 'DALE-INSP-003',
      processType: 'CONVEYOR_COMPONENTS',
      processTitle: '3. Conveyor Components',
      projectNumber: 'T0559',
      machineOrAssembly: 'Vibratory Infeed Sub-Assy (T0559-SN-001)',
      drawingNumber: 'T0559-058-719-00-02-00',
      drawingRevision: '0',
      partOrSerialNo: '719-00-02-011-01',
      partDescription: 'FIXED GUIDE SUPPORT ARMS P1 & IDLER CONVEYOR BED',
      inspector: 'Sarah Connor',
      inspectorId: 'USR-002',
      inspectionDate: '2026-02-26',
      points: [
        {
          id: 'PT-1',
          pointNumber: 1,
          description: 'Frame dimensions (width, guide centers, mounting face flatness)',
          mandatory: true,
          requiresMeasurement: true,
          measurementUnit: 'mm',
          measurementValue: '',
          result: null,
          comment: '',
        },
        {
          id: 'PT-2',
          pointNumber: 2,
          description: 'Belt tracking (bed alignment, tracking guide clearances)',
          mandatory: true,
          requiresMeasurement: true,
          measurementUnit: 'Clearance mm',
          measurementValue: '',
          result: null,
          comment: '',
        },
        {
          id: 'PT-3',
          pointNumber: 3,
          description: 'Sprocket / shaft alignment (squareness to bed, axial end float)',
          mandatory: true,
          requiresMeasurement: true,
          measurementUnit: 'Runout mm',
          measurementValue: '',
          result: null,
          comment: '',
        },
        {
          id: 'PT-4',
          pointNumber: 4,
          description: 'Bearings (seating depth, locking collar torque, smooth spin)',
          mandatory: true,
          requiresMeasurement: false,
          result: null,
          comment: '',
        },
        {
          id: 'PT-5',
          pointNumber: 5,
          description: 'Fasteners (torqued, spring washers/nylocs in place)',
          mandatory: true,
          requiresMeasurement: false,
          result: null,
          comment: '',
        },
        {
          id: 'PT-6',
          pointNumber: 6,
          description: 'Guards (clearance, secure fixing, no pinch points)',
          mandatory: true,
          requiresMeasurement: true,
          measurementUnit: 'Safety Gap mm',
          measurementValue: '',
          result: null,
          comment: '',
        },
        {
          id: 'PT-7',
          pointNumber: 7,
          description: 'Smooth movement (manual rotation, free spin, no binding)',
          mandatory: true,
          requiresMeasurement: false,
          result: null,
          comment: '',
        },
      ],
      comments: '',
      ncrReference: 'None',
      correctiveAction: '',
      approvalStatus: 'PENDING',
      createdAt: '2026-02-26T09:15:00Z',
      updatedAt: '2026-02-26T09:15:00Z',
    },
    {
      id: 'DALE-INSP-2026-004',
      sheetNumber: 'DALE-INSP-004',
      processType: 'SPIRAL_SYSTEMS',
      processTitle: '4. Spiral Systems',
      projectNumber: 'PRJ-2026-112',
      machineOrAssembly: '24-Tier Twin-Drum Spiral Freezing System (SPF-SN-2026-001)',
      drawingNumber: 'DWG-SPF-112-01',
      drawingRevision: 'A',
      partOrSerialNo: 'SPF-SN-2026-001',
      partDescription: 'Spiral Systems Drum Structure & Guide Cage',
      inspector: 'Sarah Connor',
      inspectorId: 'USR-002',
      inspectionDate: '2026-02-27',
      points: [
        {
          id: 'PT-1',
          pointNumber: 1,
          description: 'Drum / structure dimensions (diameter, tier height & pitch spacing)',
          mandatory: true,
          requiresMeasurement: true,
          measurementUnit: 'Diameter mm',
          measurementValue: '',
          result: null,
          comment: '',
        },
        {
          id: 'PT-2',
          pointNumber: 2,
          description: 'Levels / alignment (vertical plumb of mast, base levelness)',
          mandatory: true,
          requiresMeasurement: true,
          measurementUnit: 'Plumb mm/m',
          measurementValue: '',
          result: null,
          comment: '',
        },
        {
          id: 'PT-3',
          pointNumber: 3,
          description: 'Belt path (infeed transition, radius guides & wearstrips)',
          mandatory: true,
          requiresMeasurement: false,
          result: null,
          comment: '',
        },
        {
          id: 'PT-4',
          pointNumber: 4,
          description: 'Supports (bracing rigidity, floor mount plates & structural ties)',
          mandatory: true,
          requiresMeasurement: false,
          result: null,
          comment: '',
        },
        {
          id: 'PT-5',
          pointNumber: 5,
          description: 'Drive alignment (drum drive motor/gearbox coupling & torque limiter)',
          mandatory: true,
          requiresMeasurement: true,
          measurementUnit: 'TIR mm',
          measurementValue: '',
          result: null,
          comment: '',
        },
        {
          id: 'PT-6',
          pointNumber: 6,
          description: 'Fasteners (torque verified, lock wire / locking washers checked)',
          mandatory: true,
          requiresMeasurement: false,
          result: null,
          comment: '',
        },
        {
          id: 'PT-7',
          pointNumber: 7,
          description: 'Welds (hygienic food-grade welds, full penetration, passivated)',
          mandatory: true,
          requiresMeasurement: false,
          result: null,
          comment: '',
        },
        {
          id: 'PT-8',
          pointNumber: 8,
          description: 'Rotation test (drum free rotation, uniform cage clearance, no rubbing)',
          mandatory: true,
          requiresMeasurement: true,
          measurementUnit: 'Clearance mm',
          measurementValue: '',
          result: null,
          comment: '',
        },
      ],
      comments: '',
      ncrReference: 'None',
      correctiveAction: '',
      approvalStatus: 'PENDING',
      createdAt: '2026-02-27T14:00:00Z',
      updatedAt: '2026-02-27T14:00:00Z',
    },
    {
      id: 'DALE-INSP-2026-005',
      sheetNumber: 'DALE-INSP-005',
      processType: 'ASSEMBLY',
      processTitle: '5. Assembly',
      projectNumber: 'T0559',
      machineOrAssembly: 'BULK HOPPER — VIBRATORY INFEED SUB-ASSY (T0559-SN-001)',
      drawingNumber: 'T0559-058-719-00-02-00',
      drawingRevision: '0',
      partOrSerialNo: 'T0559-058-719-00-02',
      partDescription: 'Vibratory Infeed Chute Assembly (Element Code 719)',
      inspector: 'Sarah Connor',
      inspectorId: 'USR-002',
      inspectionDate: '2026-02-26',
      points: [
        {
          id: 'PT-1',
          pointNumber: 1,
          description: 'Correct components (verified against approved BOM parts list)',
          mandatory: true,
          requiresMeasurement: false,
          result: null,
          comment: '',
        },
        {
          id: 'PT-2',
          pointNumber: 2,
          description: 'Drawing revision (assembly conforms strictly to drawing revision)',
          mandatory: true,
          requiresMeasurement: false,
          result: null,
          comment: '',
        },
        {
          id: 'PT-3',
          pointNumber: 3,
          description: 'Alignment (sub-assemblies square, true, mounting centers checked)',
          mandatory: true,
          requiresMeasurement: true,
          measurementUnit: 'Alignment mm',
          measurementValue: '',
          result: null,
          comment: '',
        },
        {
          id: 'PT-4',
          pointNumber: 4,
          description: 'Torque / fasteners (all mechanical fixings torqued, washers verified)',
          mandatory: true,
          requiresMeasurement: true,
          measurementUnit: 'Torque Nm',
          measurementValue: '',
          result: null,
          comment: '',
        },
        {
          id: 'PT-5',
          pointNumber: 5,
          description: 'Lubrication where required (food-grade lubricants applied where specified)',
          mandatory: true,
          requiresMeasurement: false,
          result: null,
          comment: '',
        },
        {
          id: 'PT-6',
          pointNumber: 6,
          description: 'Movement / function (smooth mechanical action, no interference)',
          mandatory: true,
          requiresMeasurement: false,
          result: null,
          comment: '',
        },
        {
          id: 'PT-7',
          pointNumber: 7,
          description: 'Identification (sub-assembly tag / traceability label attached)',
          mandatory: true,
          requiresMeasurement: false,
          result: null,
          comment: '',
        },
      ],
      comments: '',
      ncrReference: 'None',
      correctiveAction: '',
      approvalStatus: 'PENDING',
      createdAt: '2026-02-26T15:00:00Z',
      updatedAt: '2026-02-26T15:00:00Z',
    },
    {
      id: 'DALE-INSP-2026-006',
      sheetNumber: 'DALE-INSP-006',
      processType: 'ELECTRICAL_PANELS',
      processTitle: '6. Electrical Control Panels',
      projectNumber: 'T0559',
      machineOrAssembly: 'Infeed Vibratory Drive & Inverter Control Panel (T0559-SN-001)',
      drawingNumber: 'ELEC-T0559-01',
      drawingRevision: '0',
      partOrSerialNo: 'CP-T0559-01',
      partDescription: 'Vibratory Infeed Inverter & Safety Relay Enclosure IP66',
      inspector: 'Sarah Connor',
      inspectorId: 'USR-002',
      inspectionDate: '2026-02-27',
      points: [
        {
          id: 'PT-1',
          pointNumber: 1,
          description: 'Component verification (switchgear, inverter, PLC match schematic & BOM)',
          mandatory: true,
          requiresMeasurement: false,
          result: null,
          comment: '',
        },
        {
          id: 'PT-2',
          pointNumber: 2,
          description: 'Wiring / termination (ferruled, crimped, tug test, routing neat)',
          mandatory: true,
          requiresMeasurement: false,
          result: null,
          comment: '',
        },
        {
          id: 'PT-3',
          pointNumber: 3,
          description: 'Labels (wire numbers, terminal tags, component legend plates)',
          mandatory: true,
          requiresMeasurement: false,
          result: null,
          comment: '',
        },
        {
          id: 'PT-4',
          pointNumber: 4,
          description: 'Enclosure condition (IP gasket clean, gland plate, earth studs, paint)',
          mandatory: true,
          requiresMeasurement: false,
          result: null,
          comment: '',
        },
        {
          id: 'PT-5',
          pointNumber: 5,
          description: 'Continuity / insulation checks (protective earth bonding & insulation)',
          mandatory: true,
          requiresMeasurement: true,
          measurementUnit: 'Earth Ω / Megohms',
          measurementValue: '',
          result: null,
          comment: '',
        },
        {
          id: 'PT-6',
          pointNumber: 6,
          description: 'Basic functional test (power-up, I/O indicators, safety loop operational)',
          mandatory: true,
          requiresMeasurement: false,
          result: null,
          comment: '',
        },
      ],
      comments: '',
      ncrReference: 'None',
      correctiveAction: '',
      approvalStatus: 'PENDING',
      createdAt: '2026-02-27T16:00:00Z',
      updatedAt: '2026-02-27T16:00:00Z',
    },
    {
      id: 'DALE-INSP-2026-007',
      sheetNumber: 'DALE-INSP-007',
      processType: 'FINAL_MANUFACTURING',
      processTitle: '7. Final Manufacturing Inspection',
      projectNumber: 'T0559',
      machineOrAssembly: 'BULK HOPPER — VIBRATORY INFEED SUB-ASSY',
      drawingNumber: 'T0559-058-719-00-00-00',
      drawingRevision: '0',
      partOrSerialNo: 'T0559-SN-001',
      partDescription: 'Bulk Hopper Vibratory Infeed Complete Machine Build (Element Code 719)',
      inspector: 'Sarah Connor',
      inspectorId: 'USR-002',
      inspectionDate: '2026-02-28',
      points: [
        {
          id: 'PT-1',
          pointNumber: 1,
          description: 'Drawing / revision (built equipment corresponds to final approved GA print)',
          mandatory: true,
          requiresMeasurement: false,
          result: null,
          comment: '',
        },
        {
          id: 'PT-2',
          pointNumber: 2,
          description: 'Dimensions (overall footprint, interface centers, discharge heights)',
          mandatory: true,
          requiresMeasurement: true,
          measurementUnit: 'Footprint mm',
          measurementValue: '',
          result: null,
          comment: '',
        },
        {
          id: 'PT-3',
          pointNumber: 3,
          description: 'Workmanship (weld linishing, flush panels, no scratches, burr-free)',
          mandatory: true,
          requiresMeasurement: false,
          result: null,
          comment: '',
        },
        {
          id: 'PT-4',
          pointNumber: 4,
          description: 'Component completeness (100% fasteners, covers, safety labels fitted)',
          mandatory: true,
          requiresMeasurement: false,
          result: null,
          comment: '',
        },
        {
          id: 'PT-5',
          pointNumber: 5,
          description: 'Cleanliness (degreased, swarf removed, sanitary food-grade clean)',
          mandatory: true,
          requiresMeasurement: false,
          result: null,
          comment: '',
        },
        {
          id: 'PT-6',
          pointNumber: 6,
          description: 'Identification / traceability (nameplate riveted with serial & job)',
          mandatory: true,
          requiresMeasurement: false,
          result: null,
          comment: '',
        },
        {
          id: 'PT-7',
          pointNumber: 7,
          description: 'Final pass / fail (overall workshop quality release sign-off)',
          mandatory: true,
          requiresMeasurement: false,
          result: null,
          comment: '',
        },
      ],
      comments: '',
      ncrReference: 'None',
      correctiveAction: '',
      approvalStatus: 'PENDING',
      createdAt: '2026-02-28T16:00:00Z',
      updatedAt: '2026-02-28T16:00:00Z',
    },
  ],
  ncrs: [
    {
      id: 'NCR-2026-0001',
      ncrNumber: 'NCR-2026-0001',
      manufacturingRecordId: 'MR-1003',
      inspectionRecordId: 'INSP-2026-0003',
      traceabilityNumber: 'DIV-2026-0003',
      machineSerialNumber: 'DIV-SN-2026-002',
      projectNumber: 'PRJ-2026-108',
      partNumber: 'PART-DIV-004',
      componentDescription: 'Main Spherical Bearing Housing',
      drawingNumber: 'DWG-DIV-104',
      drawingRevision: 'A',
      failedCharacteristics: ['Char #1: Spherical Bearing Housing Bore ID (Ø110 H7) = 110.048 mm'],
      description:
        'Char #1 Spherical Bearing Housing Bore ID measured 110.048 mm vs drawing specification 110.000 +0.035/-0.000 mm (+0.013 mm oversize).',
      descriptionOfNonConformance:
        'Char #1 Spherical Bearing Housing Bore ID measured 110.048 mm vs drawing specification 110.000 +0.035/-0.000 mm (+0.013 mm oversize).',
      requirement: 'Ø110.000 +0.035 / -0.000 mm (Limits: 110.000 to 110.035 mm)',
      actualCondition: 'Measured Ø110.048 mm on Bore Gauge BORE-021',
      immediateContainment: 'Component placed on immediate QUALITY HOLD and quarantined in QA Cage.',
      proposedDisposition: 'USE_AS_IS_DEVIATION_REQUIRED',
      rootCause: 'Thermal expansion during final boring pass without coolant stabilization.',
      correctiveAction: 'Engineering concession DEV-2026-0001 raised for Loctite 638 retaining compound & selective bearing outer ring fit.',
      responsiblePerson: 'Dr. Elena Rostova',
      dueDate: '2026-03-10',
      status: 'OPEN',
      createdAt: '2026-02-19T11:30:00Z',
      createdBy: 'Sarah Connor',
      createdById: 'USR-002',
    },
  ],
  deviations: [
    {
      id: 'DEV-2026-0001',
      deviationNumber: 'DEV-2026-0001',
      manufacturingRecordId: 'MR-1003',
      inspectionRecordId: 'INSP-2026-0003',
      ncrId: 'NCR-2026-0001',
      traceabilityNumber: 'DIV-2026-0003',
      machineSerialNumber: 'DIV-SN-2026-002',
      projectNumber: 'PRJ-2026-108',
      partNumber: 'PART-DIV-004',
      originalDrawingNumber: 'DWG-DIV-104',
      originalDrawingRevision: 'A',
      deviationType: 'POST_INSPECTION_CONCESSION',
      affectedCharacteristicIds: ['CHAR-1003-1'],
      affectedCharacteristicNames: ['Spherical Bearing Housing Bore ID (Ø110 H7)'],
      approvedConcessionDisposition: 'USE_AS_IS',
      descriptionOfChange:
        'Accept Spherical Bearing Housing Bore ID at 110.048 mm (vs 110.035 mm max) using selective-fit outer ring and Loctite 638 cylindrical retaining compound.',
      reasonForDeviation:
        'Avoids 3-week casting replacement lead time while maintaining full radial load capacity.',
      requiresRedline: true,
      redlineAttachmentName: 'REDLINE_DWG-DIV-104_RevA_DEV-2026-0001.pdf',
      redlineFile: INITIAL_ATTACHMENTS[3],
      redlineNotes: 'Redline markup specifies Loctite 638 assembly cure protocol on Zone B3.',
      reviewedBy: 'Peter Ndlovu',
      reviewedById: 'USR-003',
      reviewDate: '2026-02-19',
      engineeringApproved: false,
      status: 'AWAITING_APPROVAL',
      createdAt: '2026-02-19T14:20:00Z',
      createdBy: 'Sarah Connor',
      createdById: 'USR-002',
    },
  ],
  releases: [
    {
      id: 'REL-2026-0001',
      releaseId: 'REL-2026-0001',
      manufacturingRecordId: 'MR-1001',
      inspectionRecordId: 'INSP-2026-0001',
      traceabilityNumber: 'DIV-2026-0001',
      machineSerialNumber: 'DIV-SN-2026-001',
      projectNumber: 'PRJ-2026-104',
      partNumber: 'PART-DIV-001',
      releasedBy: 'Sarah Connor',
      releasedById: 'USR-002',
      releasedByRole: 'INSPECTOR',
      releaseDate: '2026-02-11',
      releaseTime: '11:00',
      releaseResult: 'PASS - RELEASED',
      notes: 'All 18 quality release gates verified and passed.',
    },
  ],
  inspectionTemplates: INITIAL_INSPECTION_TEMPLATES,
  auditLogs: [
    {
      id: 'AUD-2026-0001',
      timestamp: '2026-02-10T08:00:00Z',
      userId: 'USR-001',
      user: 'Dave Vance',
      role: 'MACHINIST',
      action: 'CREATE_MANUFACTURING_RECORD',
      recordType: 'MANUFACTURING_RECORD',
      recordId: 'DIV-2026-0001',
      details: {
        partNumber: 'PART-DIV-001',
        drawing: 'DWG-DIV-101 Rev C (APPROVED)',
        machineSerial: 'DIV-SN-2026-001',
      },
    },
    {
      id: 'AUD-2026-0002',
      timestamp: '2026-02-11T10:45:00Z',
      userId: 'USR-002',
      user: 'Sarah Connor',
      role: 'INSPECTOR',
      action: 'INSPECTOR_SIGNOFF',
      recordType: 'INSPECTION',
      recordId: 'INSP-2026-0001',
      details: {
        traceabilityNumber: 'DIV-2026-0001',
        status: 'PASS',
      },
    },
    {
      id: 'AUD-2026-0003',
      timestamp: '2026-02-11T11:00:00Z',
      userId: 'USR-002',
      user: 'Sarah Connor',
      role: 'INSPECTOR',
      action: 'QUALITY_RELEASE_EXECUTED',
      recordType: 'RELEASE',
      recordId: 'REL-2026-0001',
      details: {
        traceabilityNumber: 'DIV-2026-0001',
        machineSerialNumber: 'DIV-SN-2026-001',
      },
    },
    {
      id: 'AUD-2026-0004',
      timestamp: '2026-02-19T11:20:00Z',
      userId: 'USR-002',
      user: 'Sarah Connor',
      role: 'INSPECTOR',
      action: 'AUTOMATIC_HOLD',
      recordType: 'INSPECTION',
      recordId: 'INSP-2026-0003',
      details: {
        traceabilityNumber: 'DIV-2026-0003',
        reason: 'Char #1 measured 110.048mm (exceeds upper limit 110.035mm). Record placed on HOLD.',
      },
    },
  ],
  settings: {
    companyName: 'Spiral Systems Mechanical Manufacturing',
    departmentName: 'Machine Department — Standalone QMS',
    systemVersion: '2.2.0-COMPLIANCE',
    strictDrawingApproval: true,
    autoGenerateTraceability: true,
    requirePermanentIdForCritical: true,
    productionMode: true,
    allowDevRoleSwitch: false,
    traceabilityCounter: 4,
    machineTypes: ['DIVIDER', 'ROUNDER', 'PROOFER', 'MOULDER', 'CONVEYOR', 'OTHER'],
  },
  lastUpdated: '2026-02-20T14:00:00Z',
};

// ==========================================
// 5. STANDALONE DB & VALIDATION SERVICE (SERVER + ZERO-BILLING STATIC FALLBACK)
// ==========================================

const LOCAL_AUTH_CREDS_KEY = 'SPIRAL_MACHINE_QMS_LOCAL_CREDS_V1';
const LOCAL_ATTACHMENTS_DATA_KEY = 'SPIRAL_MACHINE_QMS_ATTACHMENT_BLOBS_V1';

const CLIENT_ROLE_ALLOWED_ACTIONS: Record<User['role'], string[]> = {
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
  ],
  MANAGEMENT: [],
};

async function sha256Hex(input: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const data = new TextEncoder().encode(input);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Simple fallback hash if subtle crypto unavailable
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16);
}

// ==========================================
// INDEXED-DB + MEMORY ATTACHMENT BLOB STORE
// Prevents localStorage 5MB QuotaExceededError on PDFs & Photos
// ==========================================
const IDB_NAME = 'SPIRAL_MACHINE_QMS_IDB_V1';
const IDB_STORE = 'attachment_blobs';
const IDB_META_STORE = 'qms_meta_vault';
const memoryAttachmentBlobs = new Map<string, string>();
let memoryDbSnapshot: QMSDatabase | null = null;

function openAttachmentIdb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
        if (!db.objectStoreNames.contains(IDB_META_STORE)) {
          db.createObjectStore(IDB_META_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function saveMetaToIdb(key: string, val: any): Promise<void> {
  const idb = await openAttachmentIdb();
  if (!idb) return;
  return new Promise((resolve) => {
    try {
      if (!idb.objectStoreNames.contains(IDB_META_STORE)) {
        resolve();
        return;
      }
      const tx = idb.transaction(IDB_META_STORE, 'readwrite');
      tx.objectStore(IDB_META_STORE).put(val, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function loadMetaFromIdb<T = any>(key: string): Promise<T | null> {
  const idb = await openAttachmentIdb();
  if (!idb) return null;
  return new Promise((resolve) => {
    try {
      if (!idb.objectStoreNames.contains(IDB_META_STORE)) {
        resolve(null);
        return;
      }
      const tx = idb.transaction(IDB_META_STORE, 'readonly');
      const req = tx.objectStore(IDB_META_STORE).get(key);
      req.onsuccess = () => resolve((req.result as T) || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function saveAttachmentBlobToIdb(fileId: string, dataUrl: string): Promise<void> {
  if (!fileId || !dataUrl) return;
  memoryAttachmentBlobs.set(fileId, dataUrl);
  const idb = await openAttachmentIdb();
  if (!idb) return;
  return new Promise((resolve) => {
    try {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(dataUrl, fileId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function preloadAttachmentBlobsFromIdb(): Promise<void> {
  if (typeof window === 'undefined') return;
  // 1. Migrate & remove legacy localStorage key that caused QuotaExceededError
  try {
    const legacyRaw = localStorage.getItem(LOCAL_ATTACHMENTS_DATA_KEY);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw) as Record<string, string>;
      for (const [k, v] of Object.entries(parsed)) {
        if (k && typeof v === 'string') {
          memoryAttachmentBlobs.set(k, v);
          void saveAttachmentBlobToIdb(k, v);
        }
      }
      localStorage.removeItem(LOCAL_ATTACHMENTS_DATA_KEY);
    }
  } catch {
    try {
      localStorage.removeItem(LOCAL_ATTACHMENTS_DATA_KEY);
    } catch {
      // ignore
    }
  }

  // 2. Preload all blobs from IndexedDB into memory map for synchronous URL resolution
  const idb = await openAttachmentIdb();
  if (!idb) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = idb.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          if (typeof cursor.key === 'string' && typeof cursor.value === 'string') {
            memoryAttachmentBlobs.set(cursor.key, cursor.value);
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      cursorReq.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

// Kick off migration & preload immediately on module load
void preloadAttachmentBlobsFromIdb();

function stripFileMetadataInlineBlobs(att?: FileAttachmentMetadata): FileAttachmentMetadata | undefined {
  if (!att) return undefined;
  if (att.dataUrl && att.dataUrl.startsWith('data:')) {
    void saveAttachmentBlobToIdb(att.fileId, att.dataUrl);
  }
  if (att.downloadUrl && att.downloadUrl.startsWith('data:')) {
    void saveAttachmentBlobToIdb(att.fileId, att.downloadUrl);
  }
  return {
    ...att,
    dataUrl: undefined,
    downloadUrl:
      att.downloadUrl && att.downloadUrl.startsWith('data:')
        ? `/api/attachments/${att.fileId}`
        : att.downloadUrl,
  };
}

function safePersistDbToLocalStorage(db: QMSDatabase): void {
  try {
    // Ensure legacy attachment blob key is removed to maximize available localStorage space
    localStorage.removeItem(LOCAL_ATTACHMENTS_DATA_KEY);
  } catch {
    // ignore
  }

  // Strip heavy base64 dataUrl strings from db before writing to localStorage (they live in IndexedDB + memoryAttachmentBlobs)
  const lightweightDb: QMSDatabase = {
    ...db,
    attachments: (db.attachments || []).map((a) => stripFileMetadataInlineBlobs(a)!),
    drawings: (db.drawings || []).map((d) => ({
      ...d,
      drawingFile: stripFileMetadataInlineBlobs(d.drawingFile),
    })),
    deviations: (db.deviations || []).map((dev) => ({
      ...dev,
      redlineFile: stripFileMetadataInlineBlobs(dev.redlineFile),
    })),
    ncrs: (db.ncrs || []).map((ncr) => ({
      ...ncr,
      issuePhotoEvidence: (ncr.issuePhotoEvidence || []).map(
        (p) => stripFileMetadataInlineBlobs(p)!
      ),
      correctiveActionPhotoEvidence: (ncr.correctiveActionPhotoEvidence || []).map(
        (p) => stripFileMetadataInlineBlobs(p)!
      ),
    })),
    auditLogs: (db.auditLogs || []).slice(0, 200).map((log) => ({
      ...log,
      previousValue:
        log.previousValue && log.previousValue.length > 4000
          ? log.previousValue.slice(0, 4000)
          : log.previousValue,
      newValue:
        log.newValue && log.newValue.length > 4000
          ? log.newValue.slice(0, 4000)
          : log.newValue,
    })),
  };

  memoryDbSnapshot = lightweightDb;
  void saveMetaToIdb('FULL_DB_SNAPSHOT', lightweightDb);

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(lightweightDb));
  } catch {
    // Fallback if still near quota: trim auditLogs further
    try {
      const minimalDb: QMSDatabase = {
        ...lightweightDb,
        auditLogs: (lightweightDb.auditLogs || []).slice(0, 30).map((log) => ({
          ...log,
          previousValue: undefined,
          newValue: undefined,
        })),
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(minimalDb));
    } catch (e) {
      console.warn('Browser localStorage quota reached; state kept in memory & IndexedDB.', e);
    }
  }
}

export class DBService {
  static getStoredSession(): AuthSession | null {
    try {
      const raw = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as AuthSession;
      if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() < Date.now()) {
        localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  static setAuthSession(session: AuthSession | null): void {
    try {
      if (!session) {
        localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
        void saveMetaToIdb('ACTIVE_AUTH_SESSION', null);
      } else {
        localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
        void saveMetaToIdb('ACTIVE_AUTH_SESSION', session);
      }
    } catch (e) {
      console.error('Failed saving auth session:', e);
    }
  }

  static getAuthHeaders(): Record<string, string> {
    const session = this.getStoredSession();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (session?.token) {
      headers['Authorization'] = `Bearer ${session.token}`;
    }
    if (session?.user) {
      headers['X-QMS-Session-User'] = JSON.stringify(session.user);
    }
    return headers;
  }

  static getAttachmentDownloadUrl(att?: FileAttachmentMetadata): string {
    if (!att) return '#';
    if (att.dataUrl && att.dataUrl.startsWith('data:')) {
      return att.dataUrl;
    }
    if (att.downloadUrl && att.downloadUrl.startsWith('data:')) {
      return att.downloadUrl;
    }
    const cached = memoryAttachmentBlobs.get(att.fileId);
    if (cached) {
      return cached;
    }
    const session = this.getStoredSession();
    const tokenParam = session?.token ? `?token=${encodeURIComponent(session.token)}` : '';
    return `/api/attachments/${att.fileId}${tokenParam}`;
  }

  private static async ensureLocalBrowserCreds(users: User[]) {
    let existing: any[] = [];
    try {
      const raw = localStorage.getItem(LOCAL_AUTH_CREDS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) existing = parsed;
      }
    } catch {
      // ignore
    }
    if (existing.length === 0) {
      const idbCreds = await loadMetaFromIdb<any[]>('USER_CREDS_VAULT');
      if (Array.isArray(idbCreds) && idbCreds.length > 0) {
        existing = idbCreds;
      }
    }

    const seenUsernames = new Set(existing.map((c) => (c.username || '').toLowerCase()));
    for (const u of users) {
      if (!seenUsernames.has(u.username.toLowerCase())) {
        const salt = `SALT_${u.id}_${Date.now()}`;
        const unguessable = await sha256Hex(`${salt}:${u.id}_${Date.now()}_UNCONFIGURED`);
        existing.push({
          userId: u.id,
          username: u.username,
          email: u.email,
          salt,
          passwordHash: unguessable,
          requiresPasswordReset: true,
          credentialStatus: 'REQUIRES_REPLACEMENT',
        });
        seenUsernames.add(u.username.toLowerCase());
      }
    }

    try {
      localStorage.setItem(LOCAL_AUTH_CREDS_KEY, JSON.stringify(existing));
    } catch {
      // ignore
    }
    void saveMetaToIdb('USER_CREDS_VAULT', existing);
    return existing;
  }

  private static async saveSingleUserCredToVault(user: User, plainPassword: string): Promise<void> {
    const localDb = this.loadFromLocalStorageOnly();
    const creds = await this.ensureLocalBrowserCreds(localDb.users);
    const salt = `SALT_${user.id}_2026`;
    const passwordHash = await sha256Hex(`${salt}:${plainPassword}`);
    const idx = creds.findIndex(
      (c: any) =>
        c.userId === user.id ||
        (c.username || '').toLowerCase() === user.username.toLowerCase()
    );
    const entry = {
      userId: user.id,
      username: user.username,
      email: user.email,
      salt,
      passwordHash,
      updatedAt: new Date().toISOString(),
    };
    if (idx >= 0) {
      creds[idx] = entry;
    } else {
      creds.push(entry);
    }
    try {
      localStorage.setItem(LOCAL_AUTH_CREDS_KEY, JSON.stringify(creds));
    } catch {
      // ignore
    }
    void saveMetaToIdb('USER_CREDS_VAULT', creds);
  }

  static async verifySession(): Promise<AuthSession | null> {
    let stored = this.getStoredSession();
    if (!stored) {
      const idbSession = await loadMetaFromIdb<AuthSession>('ACTIVE_AUTH_SESSION');
      if (idbSession && idbSession.token && new Date(idbSession.expiresAt).getTime() > Date.now()) {
        stored = idbSession;
        this.setAuthSession(idbSession);
      }
    }
    if (!stored?.token) return null;
    try {
      const res = await fetch('/api/auth/me', {
        headers: this.getAuthHeaders(),
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return stored;
      }
      if (!res.ok) {
        // Keep stored session if it has valid user & non-expired timestamp
        if (stored.user && new Date(stored.expiresAt).getTime() > Date.now()) {
          return stored;
        }
        this.setAuthSession(null);
        return null;
      }
      const json = await res.json();
      if (json.success && json.session) {
        this.setAuthSession(json.session);
        return json.session;
      }
      return stored;
    } catch {
      // Offline / static hosting fallback
      return stored;
    }
  }

  static async login(
    identifier: string,
    password: string
  ): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
    // 1. Check local browser vault first so custom profiles or updated passwords survive container redeployments
    const localDb = await this.loadFromLocalVaultAsync();
    const creds = await this.ensureLocalBrowserCreds(localDb.users);
    const cleanId = identifier.trim().toLowerCase();
    const localMatchedUser = localDb.users.find(
      (u) =>
        u.username.toLowerCase() === cleanId ||
        u.email.toLowerCase() === cleanId ||
        u.id.toLowerCase() === cleanId
    );
    const localMatchedCred = creds.find(
      (c: any) =>
        (c.username || '').toLowerCase() === cleanId ||
        (c.email || '').toLowerCase() === cleanId ||
        (localMatchedUser && c.userId === localMatchedUser.id)
    );
    let clientVerified = false;
    if (localMatchedUser && localMatchedCred && localMatchedUser.active !== false) {
      const computedHash = await sha256Hex(`${localMatchedCred.salt}:${password}`);
      if (computedHash === localMatchedCred.passwordHash) {
        clientVerified = true;
      }
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier,
          password,
          clientUser: localMatchedUser,
          clientVerified,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await res.json();
        if (res.ok && json.success && json.session) {
          this.setAuthSession(json.session);
          await this.saveSingleUserCredToVault(json.session.user, password);
          return { success: true, session: json.session };
        }
        if (!clientVerified) {
          return { success: false, error: json.error || 'Authentication failed.' };
        }
      }
    } catch {
      // Fall through to local standalone Web Crypto verification if hosted statically
    }

    if (!localMatchedUser || !localMatchedCred || localMatchedUser.active === false || !clientVerified) {
      return { success: false, error: 'Invalid username/email or password.' };
    }
    const session: AuthSession = {
      token: `LOCAL-TOKEN-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      user: localMatchedUser,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      productionMode: true,
      authMode: 'PRODUCTION',
    };
    this.setAuthSession(session);
    return { success: true, session };
  }

  static async registerUserProfile(params: {
    username: string;
    name: string;
    email: string;
    role: User['role'];
    department: string;
    password: string;
    preserveCurrentSession?: boolean;
  }): Promise<{ success: boolean; session?: AuthSession; user?: User; error?: string }> {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await res.json();
        if (res.ok && json.success && json.session) {
          if (!params.preserveCurrentSession) {
            this.setAuthSession(json.session);
          }
          if (json.user) {
            await this.saveSingleUserCredToVault(json.user, params.password);
            const curLocal = await this.loadFromLocalVaultAsync();
            const merged = mergeQMSDatabases(
              { ...curLocal, users: [...curLocal.users, json.user] },
              curLocal,
              INITIAL_DATABASE
            );
            safePersistDbToLocalStorage(merged);
          }
          return { success: true, session: json.session, user: json.user };
        }
        return { success: false, error: json.error || 'Failed to create login profile.' };
      }
    } catch {
      // Static / serverless fallback
    }

    if (!params.username || !params.name || !params.email || !params.role || !params.password) {
      return {
        success: false,
        error: 'Full name, username, email, role, and password are required.',
      };
    }
    if (params.password.length < 6) {
      return {
        success: false,
        error: 'Password must be at least 6 characters long.',
      };
    }

    const localDb = this.loadFromLocalStorageOnly();
    const creds = await this.ensureLocalBrowserCreds(localDb.users);
    const cleanUser = params.username.trim().toLowerCase();
    const cleanEmail = params.email.trim().toLowerCase();

    if (localDb.users.some((u) => u.username.toLowerCase() === cleanUser)) {
      return {
        success: false,
        error: `Username "${cleanUser}" is already registered.`,
      };
    }
    if (localDb.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      return {
        success: false,
        error: `Email "${cleanEmail}" is already registered.`,
      };
    }

    let nextNum = localDb.users.length + 1;
    let newId = `USR-${String(nextNum).padStart(3, '0')}`;
    while (localDb.users.some((u) => u.id === newId)) {
      nextNum++;
      newId = `USR-${String(nextNum).padStart(3, '0')}`;
    }

    const createdUser: User = {
      id: newId,
      username: cleanUser,
      name: params.name.trim(),
      role: params.role,
      department: (params.department || 'Machine Shop').trim(),
      email: params.email.trim(),
      active: true,
    };

    const salt = `SALT_${newId}_${Date.now()}`;
    const passwordHash = await sha256Hex(`${salt}:${params.password}`);
    creds.push({
      userId: newId,
      username: cleanUser,
      email: createdUser.email,
      salt,
      passwordHash,
    });
    try {
      localStorage.setItem(LOCAL_AUTH_CREDS_KEY, JSON.stringify(creds));
    } catch {
      // ignore
    }

    localDb.users.push(createdUser);
    localDb.auditLogs = [
      {
        id: `AUD-${Date.now()}`,
        timestamp: new Date().toISOString(),
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
        },
      },
      ...(localDb.auditLogs || []),
    ];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localDb));

    const session: AuthSession = {
      token: `LOCAL-TOKEN-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      user: createdUser,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      productionMode: true,
      authMode: 'PRODUCTION',
    };
    if (!params.preserveCurrentSession) {
      this.setAuthSession(session);
    }
    return { success: true, session, user: createdUser };
  }

  static async createUserAccount(params: {
    user: {
      username: string;
      name: string;
      email: string;
      role: User['role'];
      department: string;
    };
    newPassword: string;
  }): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          operation: 'CREATE_USER',
          user: params.user,
          newPassword: params.newPassword,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await res.json();
        if (res.ok && json.success && json.user) {
          await this.saveSingleUserCredToVault(json.user, params.newPassword);
          const curLocal = await this.loadFromLocalVaultAsync();
          const merged = mergeQMSDatabases(
            { ...curLocal, users: [...curLocal.users, json.user] },
            curLocal,
            INITIAL_DATABASE
          );
          safePersistDbToLocalStorage(merged);
          return { success: true, user: json.user };
        }
        return { success: false, error: json.error || 'Failed to create user.' };
      }
    } catch {
      // Static fallback
    }

    const session = this.getStoredSession();
    if (!session || session.user.role !== 'ADMINISTRATOR') {
      return {
        success: false,
        error: 'FORBIDDEN: Only ADMINISTRATOR may create accounts from Admin Management.',
      };
    }

    const localDb = this.loadFromLocalStorageOnly();
    const creds = await this.ensureLocalBrowserCreds(localDb.users);
    const cleanUser = params.user.username.trim().toLowerCase();
    if (localDb.users.some((u) => u.username.toLowerCase() === cleanUser)) {
      return { success: false, error: 'Username already exists.' };
    }
    let nextNum = localDb.users.length + 1;
    let newId = `USR-${String(nextNum).padStart(3, '0')}`;
    while (localDb.users.some((u) => u.id === newId)) {
      nextNum++;
      newId = `USR-${String(nextNum).padStart(3, '0')}`;
    }
    const createdUser: User = {
      id: newId,
      username: cleanUser,
      name: params.user.name.trim(),
      role: params.user.role,
      department: (params.user.department || 'Machine Shop').trim(),
      email: params.user.email.trim(),
      active: true,
    };
    const salt = `SALT_${newId}_${Date.now()}`;
    const passwordHash = await sha256Hex(`${salt}:${params.newPassword}`);
    creds.push({
      userId: newId,
      username: cleanUser,
      email: createdUser.email,
      salt,
      passwordHash,
    });
    localStorage.setItem(LOCAL_AUTH_CREDS_KEY, JSON.stringify(creds));
    localDb.users.push(createdUser);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localDb));
    return { success: true, user: createdUser };
  }

  static async resetUserPassword(
    targetUserId: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          operation: 'RESET_PASSWORD',
          targetUserId,
          newPassword,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await res.json();
        if (res.ok && json.success) {
          const curLocal = await this.loadFromLocalVaultAsync();
          const targetUser = curLocal.users.find((u) => u.id === targetUserId);
          if (targetUser) {
            await this.saveSingleUserCredToVault(targetUser, newPassword);
          }
          return { success: true };
        }
        return { success: false, error: json.error || 'Failed to reset password.' };
      }
    } catch {
      // Static fallback
    }

    const session = this.getStoredSession();
    if (!session || session.user.role !== 'ADMINISTRATOR') {
      return {
        success: false,
        error: 'FORBIDDEN: Only ADMINISTRATOR may reset passwords.',
      };
    }
    const localDb = this.loadFromLocalStorageOnly();
    const creds = await this.ensureLocalBrowserCreds(localDb.users);
    const idx = creds.findIndex((c: any) => c.userId === targetUserId);
    if (idx < 0) {
      return { success: false, error: 'Target user not found.' };
    }
    const salt = `SALT_${targetUserId}_${Date.now()}`;
    creds[idx].salt = salt;
    creds[idx].passwordHash = await sha256Hex(`${salt}:${newPassword}`);
    localStorage.setItem(LOCAL_AUTH_CREDS_KEY, JSON.stringify(creds));
    return { success: true };
  }

  static async deleteUserAccount(targetUserId: string): Promise<{ success: boolean; error?: string }> {
    const session = this.getStoredSession();
    if (!session || session.user.role !== 'ADMINISTRATOR') {
      return {
        success: false,
        error: 'FORBIDDEN: Only ADMINISTRATOR may delete user accounts.',
      };
    }
    if (session.user.id === targetUserId) {
      return {
        success: false,
        error: 'Cannot delete your own currently active Administrator account.',
      };
    }

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          operation: 'DELETE_USER',
          targetUserId,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await res.json();
        if (!res.ok || !json.success) {
          return { success: false, error: json.error || 'Failed to delete user.' };
        }
      }
    } catch {
      // Static fallback
    }

    const curLocal = await this.loadFromLocalVaultAsync();
    const targetUser = curLocal.users.find((u) => u.id === targetUserId);
    if (targetUser) {
      const delSet = new Set(curLocal.deletedRecordKeys || []);
      delSet.add(`USER:${targetUser.id.toUpperCase()}`);
      delSet.add(`USER:${targetUser.username.toUpperCase()}`);
      const updatedDb: QMSDatabase = {
        ...curLocal,
        users: curLocal.users.filter((u) => u.id !== targetUserId),
        deletedRecordKeys: Array.from(delSet),
        lastUpdated: new Date().toISOString(),
      };
      safePersistDbToLocalStorage(updatedDb);

      const creds = await this.ensureLocalBrowserCreds(updatedDb.users);
      const filteredCreds = creds.filter(
        (c: any) =>
          c.userId !== targetUserId &&
          (c.username || '').toLowerCase() !== targetUser.username.toLowerCase()
      );
      try {
        localStorage.setItem(LOCAL_AUTH_CREDS_KEY, JSON.stringify(filteredCreds));
      } catch {
        // ignore
      }
      void saveMetaToIdb('USER_CREDS_VAULT', filteredCreds);
    }

    return { success: true };
  }

  static async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });
    } catch {
      // ignore network error
    } finally {
      this.setAuthSession(null);
    }
  }

  private static loadFromLocalStorageOnly(): QMSDatabase {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.machines && parsed.manufacturingRecords) {
          return mergeQMSDatabases(parsed, memoryDbSnapshot, INITIAL_DATABASE);
        }
      }
    } catch {
      // ignore
    }
    if (memoryDbSnapshot) {
      return mergeQMSDatabases(memoryDbSnapshot, INITIAL_DATABASE, INITIAL_DATABASE);
    }
    return reconcileCrossPopulatedDatabase(INITIAL_DATABASE);
  }

  private static async loadFromLocalVaultAsync(): Promise<QMSDatabase> {
    const lsDb = this.loadFromLocalStorageOnly();
    const idbDb = await loadMetaFromIdb<QMSDatabase>('FULL_DB_SNAPSHOT');
    return mergeQMSDatabases(lsDb, idbDb, INITIAL_DATABASE);
  }

  static async load(): Promise<QMSDatabase> {
    await preloadAttachmentBlobsFromIdb();
    const localVaultDb = await this.loadFromLocalVaultAsync();

    try {
      const res = await fetch('/api/db', {
        headers: this.getAuthHeaders(),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const json = await res.json();
        const serverData = (json.data || json) as QMSDatabase;
        if (serverData && serverData.machines && serverData.manufacturingRecords) {
          // Non-destructively merge Server DB + Browser Vault DB + Seed DB so zero past data or users are ever lost!
          const mergedDb = mergeQMSDatabases(serverData, localVaultDb, INITIAL_DATABASE);
          safePersistDbToLocalStorage(mergedDb);

          // Also gather local credential vault & custom attachment blobs so server has full parity after any update
          const clientCreds = await this.ensureLocalBrowserCreds(mergedDb.users);
          const attachmentBlobs: Record<string, string> = {};
          let totalBlobBytes = 0;
          for (const [fId, blobUrl] of memoryAttachmentBlobs.entries()) {
            if (totalBlobBytes + blobUrl.length < 25 * 1024 * 1024) {
              attachmentBlobs[fId] = blobUrl;
              totalBlobBytes += blobUrl.length;
            }
          }

          // Sync merged state, credentials, and attachment blobs back to server
          void fetch('/api/db/sync-merge', {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({
              clientDb: mergedDb,
              clientCreds,
              attachmentBlobs,
            }),
          }).catch(() => {});

          return mergedDb;
        }
      }
    } catch {
      // fallback to local vault if static / offline
    }

    safePersistDbToLocalStorage(localVaultDb);
    return localVaultDb;
  }

  static async save(
    db: QMSDatabase,
    user: User,
    action: string,
    details?: Record<string, any>
  ): Promise<{ ok: boolean; error?: string }> {
    if (user.role === 'MANAGEMENT') {
      return {
        ok: false,
        error: 'FORBIDDEN: Management accounts have read-only executive access. All create, update, and delete actions are blocked.',
      };
    }

    // Validate RBAC and Separation of Duties before saving in any mode
    const allowedActions = CLIENT_ROLE_ALLOWED_ACTIONS[user.role] || [];
    if (
      [
        'RESET_TO_DEFAULTS',
        'RESTORE_DATABASE_BACKUP',
        'ADMIN_DELETE_RECORD',
        'ADMIN_CLEAR_LIST',
        'ADMIN_CLEAR_ALL_DATA',
      ].includes(action)
    ) {
      if (user.role !== 'ADMINISTRATOR') {
        return {
          ok: false,
          error: `FORBIDDEN: Only ADMINISTRATOR may perform ${action}. Current role: ${user.role}.`,
        };
      }
    }
    if (!allowedActions.includes(action)) {
      return {
        ok: false,
        error: `PERMISSION DENIED: Role '${user.role}' is not authorized to perform '${action}'.`,
      };
    }

    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          data: db,
          action,
          details,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false) {
          return {
            ok: false,
            error: json.error || `Server rejected action ${action} (HTTP ${res.status})`,
          };
        }
        safePersistDbToLocalStorage(db);
        return { ok: true };
      }
    } catch {
      // Static / serverless deployment fallback: persist directly to localStorage after passing RBAC
    }

    safePersistDbToLocalStorage(db);
    return { ok: true };
  }

  static resolveAttachmentPreviewUrl(att: FileAttachmentMetadata): string {
    if (att.dataUrl && att.dataUrl.startsWith('data:')) {
      return att.dataUrl;
    }
    if (att.downloadUrl && att.downloadUrl.startsWith('data:')) {
      return att.downloadUrl;
    }
    const cached = memoryAttachmentBlobs.get(att.fileId);
    if (cached) {
      return cached;
    }
    const session = this.getStoredSession();
    const tokenParam = session?.token ? `?token=${encodeURIComponent(session.token)}` : '';
    return `/api/attachments/${att.fileId}${tokenParam}`;
  }

  static async uploadAttachment(params: {
    originalFilename: string;
    mimeType: string;
    base64Data: string;
    category: 'REDLINE' | 'DRAWING' | 'EVIDENCE';
    relatedRecordId?: string;
    drawingNumber?: string;
    revision?: string;
    caption?: string;
  }): Promise<{ success: boolean; attachment?: FileAttachmentMetadata; error?: string }> {
    const session = this.getStoredSession();
    if (!session) {
      return { success: false, error: 'Authentication required to upload files.' };
    }

    const normalizedDataUrl = String(params.base64Data).startsWith('data:')
      ? String(params.base64Data)
      : `data:${params.mimeType || 'image/jpeg'};base64,${params.base64Data}`;

    try {
      const res = await fetch('/api/attachments/upload', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(params),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await res.json();
        if (res.ok && json.success && json.attachment) {
          await saveAttachmentBlobToIdb(json.attachment.fileId, normalizedDataUrl);
          return {
            success: true,
            attachment: {
              ...json.attachment,
              caption: params.caption,
              downloadUrl: `/api/attachments/${json.attachment.fileId}`,
            },
          };
        }
        return { success: false, error: json.error || 'File upload failed.' };
      }
    } catch {
      // Static / serverless fallback: store attachment Data URI in IndexedDB + memory cache
    }

    try {
      const fileId = `ATT-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const safeOrigName = String(params.originalFilename).replace(/[^a-zA-Z0-9._-]/g, '_');

      // Store in IndexedDB + memoryAttachmentBlobs (never in 5MB localStorage!)
      await saveAttachmentBlobToIdb(fileId, normalizedDataUrl);

      const attachment: FileAttachmentMetadata = {
        fileId,
        originalFilename: params.originalFilename,
        storedFilename: `${fileId}_${safeOrigName}`,
        mimeType: params.mimeType || 'image/jpeg',
        fileSize: Math.round((params.base64Data.length * 3) / 4),
        uploadDate: new Date().toISOString(),
        uploadedBy: session.user.name,
        uploadedById: session.user.id,
        category: params.category,
        relatedRecordId: params.relatedRecordId,
        drawingNumber: params.drawingNumber,
        revision: params.revision,
        caption: params.caption,
        downloadUrl: `/api/attachments/${fileId}`,
      };
      return { success: true, attachment };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed storing attachment.' };
    }
  }

  /**
   * Requirement 3: Drawing Validation at Time of Manufacture
   */
  static validateDrawingForManufacturing(drawing?: Drawing): { valid: boolean; reason?: string } {
    if (!drawing) {
      return {
        valid: false,
        reason: 'DRAWING NOT FOUND: Selected drawing/revision does not exist in the Controlled Drawing Register.',
      };
    }
    if (drawing.drawingStatus !== 'APPROVED') {
      return {
        valid: false,
        reason: `UNAPPROVED DRAWING BLOCKED: Drawing ${drawing.drawingNumber} Rev ${drawing.revision} has status "${drawing.drawingStatus}". Components may only be manufactured to APPROVED drawings.`,
      };
    }
    return { valid: true };
  }

  /**
   * Generates unique shop-floor traceability reference
   */
  static generateTraceabilityNumber(
    db: QMSDatabase,
    machineType: string = 'DIVIDER'
  ): { number: string; nextCounter: number } {
    const prefix = machineType.slice(0, 3).toUpperCase() || 'DIV';
    const year = new Date().getFullYear();
    let counter = (db.settings?.traceabilityCounter || db.manufacturingRecords.length) + 1;
    let candidate = `${prefix}-${year}-${String(counter).padStart(4, '0')}`;

    const existingSet = new Set(
      db.manufacturingRecords.map((r) => r.traceabilityNumber.toUpperCase())
    );
    while (existingSet.has(candidate.toUpperCase())) {
      counter++;
      candidate = `${prefix}-${year}-${String(counter).padStart(4, '0')}`;
    }

    return { number: candidate, nextCounter: counter };
  }

  /**
   * Requirement 8: Tolerance Limit Validation
   * - Lower Tolerance must be <= 0 for signed offset
   * - Upper Tolerance must be >= 0
   * - Upper Tolerance must be strictly > Lower Tolerance (or at least >= with non-inverted range)
   * - Rejects inverted tolerances (e.g. Lower = +0.02, Upper = -0.02) and positive lower offsets (Lower = +0.02, Upper = +0.02)
   */
  static validateToleranceLimits(params: {
    nominal: number;
    lowerTolerance: number;
    upperTolerance: number;
  }): { valid: boolean; error?: string; minLimit?: number; maxLimit?: number } {
    const { nominal, lowerTolerance, upperTolerance } = params;
    if (!Number.isFinite(nominal) || !Number.isFinite(lowerTolerance) || !Number.isFinite(upperTolerance)) {
      return { valid: false, error: 'Nominal, Lower Tolerance, and Upper Tolerance must be valid numbers.' };
    }
    if (lowerTolerance > 0) {
      return {
        valid: false,
        error: `INVALID TOLERANCE: Lower Tolerance (+${lowerTolerance}) cannot be positive. Lower Tolerance must be <= 0 (e.g. -0.02 or 0.00).`,
      };
    }
    if (upperTolerance < 0) {
      return {
        valid: false,
        error: `INVALID TOLERANCE: Upper Tolerance (${upperTolerance}) cannot be negative. Upper Tolerance must be >= 0 (e.g. +0.02 or 0.00).`,
      };
    }
    if (lowerTolerance > upperTolerance) {
      return {
        valid: false,
        error: `INVERTED TOLERANCE BLOCKED: Lower Tolerance (${lowerTolerance}) is greater than Upper Tolerance (${upperTolerance}).`,
      };
    }
    const minLimit = Number((nominal + lowerTolerance).toFixed(4));
    const maxLimit = Number((nominal + upperTolerance).toFixed(4));
    if (minLimit > maxLimit) {
      return {
        valid: false,
        error: `INVALID TOLERANCE RANGE: Minimum limit (${minLimit}) exceeds Maximum limit (${maxLimit}).`,
      };
    }
    return { valid: true, minLimit, maxLimit };
  }

  /**
   * Calculates PASS/FAIL strictly from Nominal + Lower Tolerance and Nominal + Upper Tolerance
   */
  static calculateCharacteristicResult(params: {
    nominal?: number | null;
    upperTolerance?: number | null;
    lowerTolerance?: number | null;
    actual: number | null;
  }): CharacteristicResult {
    const { nominal, upperTolerance, lowerTolerance, actual } = params;
    if (actual === null || actual === undefined || Number.isNaN(actual)) {
      return 'PENDING';
    }
    // If measurement is recorded but nominal or tolerances are missing, fail configuration check
    if (
      nominal === null ||
      nominal === undefined ||
      Number.isNaN(nominal) ||
      upperTolerance === null ||
      upperTolerance === undefined ||
      Number.isNaN(upperTolerance) ||
      lowerTolerance === null ||
      lowerTolerance === undefined ||
      Number.isNaN(lowerTolerance)
    ) {
      return 'FAIL';
    }
    const minLimit = Number((nominal + lowerTolerance).toFixed(6));
    const maxLimit = Number((nominal + upperTolerance).toFixed(6));
    const val = Number(actual.toFixed(6));
    if (val >= minLimit && val <= maxLimit) {
      return 'PASS';
    }
    return 'FAIL';
  }

  /**
   * Requirement 1 & 17: Approved Deviation Deadlock Fix
   * - Never alters the measured value (`actual`)
   * - Never converts original `result: 'FAIL'` into a false `'PASS'`
   * - Sets `disposition = 'ACCEPTED_BY_APPROVED_DEVIATION'` ONLY when:
   *   1. Deviation exists for the manufacturing record
   *   2. Deviation status === 'APPROVED' and engineeringApproved === true
   *   3. Approved identity (`approvedBy`) and date (`approvalDate`) are recorded
   *   4. If `requiresRedline` is true, a real `redlineFile` (`fileId`) is attached
   *   5. Approved concession disposition is `USE_AS_IS` / `CONCESSION_ACCEPTED` / `REWORK_TO_REDLINE`
   *   6. Deviation explicitly identifies the affected characteristic (by ID or name)
   */
  static syncCharacteristicsWithDeviations(
    characteristics: InspectionCharacteristic[],
    deviationsForRecord: Deviation[]
  ): InspectionCharacteristic[] {
    return characteristics.map((char) => {
      const calcResult = this.calculateCharacteristicResult({
        nominal: char.nominal,
        upperTolerance: char.upperTolerance,
        lowerTolerance: char.lowerTolerance,
        actual: char.actual,
      });

      if (calcResult !== 'FAIL') {
        return {
          ...char,
          result: calcResult,
          disposition: 'STANDARD',
          deviationId: undefined,
          deviationNumber: undefined,
          deviationApprovedBy: undefined,
          deviationApprovalDate: undefined,
        };
      }

      // Characteristic calculated as FAIL -> look for qualifying APPROVED deviation
      const coveringDev = deviationsForRecord.find((d) => {
        if (d.status !== 'APPROVED' || !d.engineeringApproved) return false;
        if (!d.approvedBy || !d.approvalDate) return false;
        if (d.requiresRedline && (!d.redlineFile || !d.redlineFile.fileId)) return false;

        const validConcession =
          !d.approvedConcessionDisposition ||
          ['USE_AS_IS', 'CONCESSION_ACCEPTED', 'REWORK_TO_REDLINE'].includes(
            d.approvedConcessionDisposition
          );
        if (!validConcession) return false;

        const matchesId =
          Array.isArray(d.affectedCharacteristicIds) &&
          d.affectedCharacteristicIds.includes(char.id);
        const matchesName =
          Array.isArray(d.affectedCharacteristicNames) &&
          d.affectedCharacteristicNames.some(
            (n) =>
              n && (n.toLowerCase().includes(char.feature.toLowerCase()) ||
              char.feature.toLowerCase().includes(n.toLowerCase()))
          );
        const matchesAffected =
          Array.isArray(d.affectedCharacteristics) &&
          d.affectedCharacteristics.some(
            (n) =>
              n && (n.toLowerCase().includes(char.feature.toLowerCase()) ||
              char.feature.toLowerCase().includes(n.toLowerCase()))
          );
        const matchesDescription =
          Boolean(d.descriptionOfChange && d.descriptionOfChange.toLowerCase().includes(char.feature.toLowerCase()));

        return Boolean(matchesId || matchesName || matchesAffected || matchesDescription);
      });

      if (coveringDev) {
        return {
          ...char,
          result: 'FAIL', // Original FAIL preserved!
          disposition: 'ACCEPTED_BY_APPROVED_DEVIATION',
          deviationId: coveringDev.id,
          deviationNumber: coveringDev.deviationNumber,
          deviationApprovedBy: coveringDev.approvedBy,
          deviationApprovalDate: coveringDev.approvalDate,
        };
      }

      return {
        ...char,
        result: 'FAIL',
        disposition: 'STANDARD',
        deviationId: undefined,
        deviationNumber: undefined,
        deviationApprovedBy: undefined,
        deviationApprovalDate: undefined,
      };
    });
  }

  static evaluateInspection(
    characteristics: InspectionCharacteristic[],
    deviationsForRecord: Deviation[] = []
  ): {
    allRecorded: boolean;
    uncoveredFailedChars: InspectionCharacteristic[];
    deviationAcceptedChars: InspectionCharacteristic[];
    overallResult: 'PENDING' | 'PASS' | 'FAIL';
  } {
    const synced = this.syncCharacteristicsWithDeviations(characteristics, deviationsForRecord);
    const allRecorded =
      synced.length > 0 &&
      synced.every((c) => c.actual !== null && c.actual !== undefined && c.result !== 'PENDING');

    const uncoveredFailedChars = synced.filter(
      (c) => c.result === 'FAIL' && c.disposition !== 'ACCEPTED_BY_APPROVED_DEVIATION'
    );
    const deviationAcceptedChars = synced.filter(
      (c) => c.result === 'FAIL' && c.disposition === 'ACCEPTED_BY_APPROVED_DEVIATION'
    );

    let overallResult: 'PENDING' | 'PASS' | 'FAIL' = 'PENDING';
    if (uncoveredFailedChars.length > 0) {
      overallResult = 'FAIL';
    } else if (allRecorded) {
      overallResult = 'PASS';
    }

    return {
      allRecorded,
      uncoveredFailedChars,
      deviationAcceptedChars,
      overallResult,
    };
  }

  /**
   * Requirement 16: 18-Point Quality Release Gate Evaluation (QG-01 through QG-18)
   */
  static evaluateQualityReleaseGates(
    db: QMSDatabase,
    manufacturingRecordId: string,
    releasingUser?: User | null
  ): QualityReleaseEvaluation {
    const record = db.manufacturingRecords.find((r) => r.id === manufacturingRecordId);
    const component = record
      ? db.components.find(
          (c) => c.partNumber.trim().toUpperCase() === record.partNumber.trim().toUpperCase()
        )
      : undefined;
    const drawing = record
      ? db.drawings.find(
          (d) =>
            d.drawingNumber.trim().toUpperCase() === record.drawingNumber.trim().toUpperCase() &&
            d.revision.trim().toUpperCase() === record.drawingRevision.trim().toUpperCase()
        )
      : undefined;
    const currentDrawingRev = record
      ? db.drawings.find(
          (d) =>
            d.drawingNumber.trim().toUpperCase() === record.drawingNumber.trim().toUpperCase() &&
            d.isCurrent &&
            d.drawingStatus === 'APPROVED'
        )
      : undefined;

    const inspection = record
      ? db.inspections.find((i) => i.manufacturingRecordId === record.id)
      : undefined;

    // Detect Dale Automation Manufacturing Inspection Sheets linked to this component
    const matchingDaleSheets = record && Array.isArray(db.daleInspections)
      ? db.daleInspections.filter((d) => {
          if (!d) return false;
          const pNo = (record.partNumber || '').trim().toUpperCase();
          const tNo = (record.traceabilityNumber || '').trim().toUpperCase();
          const dPart = (d.partOrSerialNo || '').trim().toUpperCase();
          const dProj = (d.projectNumber || '').trim().toUpperCase();
          const rProj = (record.projectNumber || '').trim().toUpperCase();
          const rMach = (record.machineSerialNumber || '').trim().toUpperCase();
          const dMach = (d.machineOrAssembly || '').trim().toUpperCase();

          if (pNo && dPart === pNo) return true;
          if (tNo && dPart === tNo) return true;
          if (dProj && rProj && dProj === rProj) {
            if (rMach && (dMach.includes(rMach) || rMach.includes(dMach) || dPart.includes(rMach))) {
              return true;
            }
            if (d.drawingNumber && record.drawingNumber && d.drawingNumber.trim().toUpperCase() === record.drawingNumber.trim().toUpperCase()) {
              return true;
            }
          }
          return false;
        })
      : [];

    const daleSheetIds = new Set(matchingDaleSheets.map((d) => (d.id || '').trim().toUpperCase()));
    const daleSheetNumbers = new Set(matchingDaleSheets.map((d) => (d.sheetNumber || '').trim().toUpperCase()));

    // Link all NCRs matching by ID, Part Number, Traceability, Machine, Project Drawing, or Dale Inspection
    const recordNcrs = record
      ? (db.ncrs || []).filter((n) => {
          if (!n) return false;
          if (n.manufacturingRecordId === record.id) return true;
          const nTrace = (n.traceabilityNumber || '').trim().toUpperCase();
          const rTrace = (record.traceabilityNumber || '').trim().toUpperCase();
          if (nTrace && rTrace && (nTrace === rTrace || nTrace.includes(rTrace) || rTrace.includes(nTrace))) return true;

          const nPart = (n.partNumber || '').trim().toUpperCase();
          const rPart = (record.partNumber || '').trim().toUpperCase();
          if (nPart && rPart && (nPart === rPart || nPart.includes(rPart) || rPart.includes(nPart))) return true;

          const nProj = (n.projectNumber || '').trim().toUpperCase();
          const rProj = (record.projectNumber || '').trim().toUpperCase();
          const nMach = (n.machineSerialNumber || '').trim().toUpperCase();
          const rMach = (record.machineSerialNumber || '').trim().toUpperCase();
          if (nProj && rProj && nProj === rProj) {
            if (nMach && rMach && (nMach.includes(rMach) || rMach.includes(nMach))) return true;
            if (n.drawingNumber && record.drawingNumber && n.drawingNumber.trim().toUpperCase() === record.drawingNumber.trim().toUpperCase()) return true;
          }

          const nDaleId = (n.daleInspectionId || '').trim().toUpperCase();
          if (nDaleId && (daleSheetIds.has(nDaleId) || daleSheetNumbers.has(nDaleId))) {
            return true;
          }
          return false;
        })
      : [];
    const openNcrs = recordNcrs.filter((n) => n.status !== 'CLOSED');
    const closedNcrs = recordNcrs.filter((n) => n.status === 'CLOSED');

    const recordDeviations = record
      ? db.deviations.filter((d) => d.manufacturingRecordId === record.id)
      : [];
    const approvedDeviations = recordDeviations.filter(
      (d) =>
        d.status === 'APPROVED' &&
        d.engineeringApproved &&
        (!d.requiresRedline || Boolean(d.redlineFile && d.redlineFile.fileId))
    );
    const unapprovedDeviations = recordDeviations.filter(
      (d) =>
        d.status !== 'APPROVED' ||
        !d.engineeringApproved ||
        (d.requiresRedline && (!d.redlineFile || !d.redlineFile.fileId))
    );

    if (!record) {
      return {
        manufacturingRecordId,
        openNcrs: [],
        closedNcrs: [],
        unapprovedDeviations: [],
        approvedDeviations: [],
        checks: [],
        canRelease: false,
        blockingReasons: ['Manufacturing record not found.'],
      };
    }

    // Component Master flags (Requirement 5)
    const isCritical = component ? component.criticalComponent : true;
    const isTraceabilityReq = component ? component.traceabilityRequired || isCritical : true;
    const isPermIdReq = component ? component.permanentIdRequired : true;

    // QG-01: Traceability Number
    const qg01 = !isTraceabilityReq
      ? true
      : Boolean(record.traceabilityNumber && record.traceabilityNumber.trim().length > 0);

    // QG-02: Machine Serial Linkage
    const qg02 = Boolean(record.machineSerialNumber && record.machineSerialNumber.trim().length > 0);

    // QG-03: Project Linkage
    const qg03 = Boolean(record.projectNumber && record.projectNumber.trim().length > 0);

    // QG-04: Valid Drawing Revision At Time Of Manufacture (Requirement 3)
    const approvedAtMfgSnapshot =
      record.drawingSnapshot?.approvalStatusAtManufacture === 'APPROVED';
    const currentlyApproved = drawing?.drawingStatus === 'APPROVED';
    const supersededButApprovedAtMfg =
      drawing?.drawingStatus === 'SUPERSEDED' && approvedAtMfgSnapshot;
    const qg04 = Boolean(
      record.drawingNumber &&
        record.drawingRevision &&
        (currentlyApproved || supersededButApprovedAtMfg || approvedAtMfgSnapshot)
    );

    const supersededNotice =
      drawing?.drawingStatus === 'SUPERSEDED' && approvedAtMfgSnapshot
        ? `Drawing ${record.drawingNumber} Rev ${record.drawingRevision} was APPROVED at manufacture (${
            record.drawingSnapshot?.drawingApprovalDate || 'verified'
          }); later superseded by Rev ${
            currentDrawingRev?.revision || 'newer'
          } — historical record remains valid.`
        : undefined;

    // QG-05: Machinist Identification
    const qg05 = Boolean(
      record.machinist &&
        record.machinist.trim().length > 0 &&
        record.machinistId &&
        record.machinistId.trim().length > 0
    );

    // QG-06: Permanent Identification IF Required (Requirement 4 & 5)
    const qg06 = !isPermIdReq
      ? true
      : Boolean(
          record.permanentIdCompleted &&
            record.permanentIdMethod &&
            record.permanentIdMethod !== 'NONE' &&
            record.permanentIdReference &&
            record.permanentIdReference.trim().length > 0
        );

    // QG-07: Real Dimensional Inspection Record (Generic checklist cannot substitute for critical components)
    const hasDaleInspection = matchingDaleSheets.length > 0;
    const qg07 = isCritical
      ? Boolean(inspection)
      : Boolean(inspection || hasDaleInspection);

    // QG-08: 5-Point Drawing Verification Checklist
    const dv = inspection?.drawingVerification;
    const hasDaleDwgVerified = matchingDaleSheets.some((d) => d.drawingNumber && d.drawingRevision);
    const qg08 = isCritical
      ? Boolean(
          dv &&
            dv.correctDrawingNumber &&
            dv.correctDrawingRevision &&
            dv.drawingApproved &&
            dv.componentCorrespondsToDrawing &&
            dv.associationCorrect
        )
      : inspection
      ? Boolean(
          dv &&
            dv.correctDrawingNumber &&
            dv.correctDrawingRevision &&
            dv.drawingApproved &&
            dv.componentCorrespondsToDrawing &&
            dv.associationCorrect
        )
      : hasDaleInspection && hasDaleDwgVerified;

    // QG-09: Inspector Formal Sign-Off
    const hasDaleSignedOff = matchingDaleSheets.some(
      (d) => (d.approvedBy && d.approvedBy.trim().length > 0) || d.approvalStatus === 'PASS'
    );
    const qg09 = isCritical
      ? Boolean(
          inspection?.inspectorSignOff?.confirmed &&
            inspection.inspectorSignOff.inspectorId &&
            inspection.inspectorSignOff.signedAt
        )
      : inspection
      ? Boolean(
          inspection?.inspectorSignOff?.confirmed &&
            inspection.inspectorSignOff.inspectorId &&
            inspection.inspectorSignOff.signedAt
        )
      : hasDaleSignedOff;

    // QG-10: Measurement Requirements, Calibrated Instruments & Configured Drawing Values
    const syncedChars = inspection
      ? this.syncCharacteristicsWithDeviations(inspection.characteristics, recordDeviations)
      : [];
    const hasUnconfiguredChars = syncedChars.some(
      (c) =>
        c.nominal === null ||
        c.nominal === undefined ||
        c.upperTolerance === null ||
        c.upperTolerance === undefined ||
        c.lowerTolerance === null ||
        c.lowerTolerance === undefined
    );
    const hasValidInstruments =
      syncedChars.length > 0 &&
      syncedChars.every(
        (c) =>
          Boolean(c.measuringInstrument && c.measuringInstrument.trim().length > 0) &&
          Boolean(c.instrumentId && c.instrumentId.trim().length > 0)
      );

    const qg10 = isCritical
      ? Boolean(inspection && !hasUnconfiguredChars && hasValidInstruments)
      : inspection
      ? Boolean(!hasUnconfiguredChars && hasValidInstruments)
      : hasDaleInspection;

    // QG-11: Measurement Results / Approved Deviation Logic (All PASS or Covered by APPROVED Deviation)
    const inspEval = this.evaluateInspection(syncedChars, recordDeviations);
    const hasFailedDaleSheet = matchingDaleSheets.some(
      (d) => d.approvalStatus === 'FAIL' || d.approvalStatus === 'HOLD'
    );
    const qg11 = isCritical
      ? Boolean(
          inspection &&
            !hasUnconfiguredChars &&
            inspEval.allRecorded &&
            inspEval.uncoveredFailedChars.length === 0
        )
      : inspection
      ? Boolean(
          !hasUnconfiguredChars &&
            inspEval.allRecorded &&
            inspEval.uncoveredFailedChars.length === 0
        )
      : !hasFailedDaleSheet;

    // QG-12: Open NCR Control
    const hasScrapNcr = closedNcrs.some((n) => n.proposedDisposition === 'SCRAP');
    const hasUnresolvedConcessionNcr = closedNcrs.some(
      (n) =>
        n.proposedDisposition === 'USE_AS_IS_DEVIATION_REQUIRED' &&
        approvedDeviations.length === 0
    );
    const qg12 = openNcrs.length === 0 && !hasScrapNcr && !hasUnresolvedConcessionNcr;

    // QG-13: Deviation Control (Including Mandatory Redline File Verification)
    const qg13 = unapprovedDeviations.length === 0;

    // QG-14: Inspector Separation Of Duties (Immutable User ID check)
    const qg14 = !inspection
      ? true
      : Boolean(
          inspection.inspectorId &&
            record.machinistId &&
            inspection.inspectorId !== record.machinistId
        );

    // QG-15: Release Authority (Authenticated user, authorized role, releasingUser.id !== record.machinistId)
    const allowedReleaseRoles: User['role'][] = [
      'INSPECTOR',
      'MACHINE_MANAGER',
      'HSEQ',
      'ADMINISTRATOR',
    ];
    const hasValidReleaseRole = releasingUser
      ? allowedReleaseRoles.includes(releasingUser.role)
      : false;
    const releaserDifferentFromMachinist = releasingUser
      ? releasingUser.id !== record.machinistId
      : false;
    const qg15 = Boolean(releasingUser && hasValidReleaseRole && releaserDifferentFromMachinist);

    // QG-16: Part Number Validity (Active in Component Master)
    const qg16 = Boolean(component && component.active);

    // QG-17: Quantity > 0
    const qg17 =
      typeof record.quantity === 'number' &&
      !Number.isNaN(record.quantity) &&
      Number.isFinite(record.quantity) &&
      record.quantity > 0;

    // QG-18: Critical Component / QMS Applicability & Not On Quality Hold
    const hasFailedPointsOrSheet = matchingDaleSheets.some(
      (d) => d.approvalStatus === 'FAIL' || (d.points || []).some((p) => p.result === 'FAIL')
    );
    const notOnHoldOrScrapped =
      record.manufacturingStatus !== 'HOLD' &&
      record.manufacturingStatus !== 'FAIL' &&
      record.manufacturingStatus !== 'NCR_HOLD' &&
      record.manufacturingStatus !== 'SCRAPPED' &&
      !hasFailedPointsOrSheet &&
      openNcrs.length === 0;
    const qg18 = Boolean(component && notOnHoldOrScrapped);

    const checks: QualityReleaseCheck[] = [
      {
        id: 'QG-01',
        gateNumber: 1,
        category: 'Traceability',
        requirement: 'Unique Traceability Number Assigned',
        passed: qg01,
        details: qg01
          ? `Traceability Reference: ${record.traceabilityNumber}`
          : 'BLOCKED: Missing Traceability Number.',
      },
      {
        id: 'QG-02',
        gateNumber: 2,
        category: 'Genealogy',
        requirement: 'Machine Serial Number Linkage',
        passed: qg02,
        details: qg02
          ? `Linked to Machine Serial: ${record.machineSerialNumber}`
          : 'BLOCKED: Missing Machine Serial Number linkage.',
      },
      {
        id: 'QG-03',
        gateNumber: 3,
        category: 'Genealogy',
        requirement: 'Project Number Linkage',
        passed: qg03,
        details: qg03
          ? `Linked to Project: ${record.projectNumber}`
          : 'BLOCKED: Missing Project Number linkage.',
      },
      {
        id: 'QG-04',
        gateNumber: 4,
        category: 'Drawing Control',
        requirement: 'Valid Approved Drawing Revision at Manufacture',
        passed: qg04,
        details: qg04
          ? supersededNotice ||
            `Manufactured to Approved Drawing ${record.drawingNumber} Rev ${record.drawingRevision} (Approved ${
              record.drawingSnapshot?.drawingApprovalDate || drawing?.approvalDate || 'verified'
            })`
          : `BLOCKED: Drawing ${record.drawingNumber} Rev ${record.drawingRevision} was not APPROVED at time of manufacture.`,
      },
      {
        id: 'QG-05',
        gateNumber: 5,
        category: 'Manufacturing',
        requirement: 'Machinist Identity Recorded',
        passed: qg05,
        details: qg05
          ? `Machinist: ${record.machinist} (ID: ${record.machinistId})`
          : 'BLOCKED: Machinist User ID or Name missing.',
      },
      {
        id: 'QG-06',
        gateNumber: 6,
        category: 'Identification',
        requirement: 'Permanent Identification Completed (If Required)',
        passed: qg06,
        details: !isPermIdReq
          ? 'Not required by Component Master (permanentIdRequired = false).'
          : qg06
          ? `Completed (${record.permanentIdMethod}): "${record.permanentIdReference}" on ${
              record.permanentIdDate || record.manufacturingDate
            }`
          : 'BLOCKED: Component Master requires Permanent Identification, which has not been completed.',
      },
      {
        id: 'QG-07',
        gateNumber: 7,
        category: 'Inspection',
        requirement: 'Real Dimensional Inspection Sheet Created',
        passed: qg07,
        details: qg07
          ? inspection
            ? `Dimensional Inspection Sheet: ${inspection.id} (${inspection.templateCode || 'Template Linked'})`
            : matchingDaleSheets.length > 0
            ? `Dale Inspection Sheet: ${matchingDaleSheets[0].sheetNumber} (${matchingDaleSheets[0].processTitle})`
            : 'Non-critical component inspection satisfied.'
          : isCritical && !inspection
          ? 'BLOCKED: Critical component requires formal dimensional InspectionRecord. Generic checklist cannot substitute.'
          : 'BLOCKED: Mandatory QMS Inspection Sheet has not been created.',
      },
      {
        id: 'QG-08',
        gateNumber: 8,
        category: 'Inspection',
        requirement: '5-Point Drawing Verification Checklist',
        passed: qg08,
        details: qg08
          ? inspection
            ? 'All 5 Drawing & Revision verification checks confirmed by Inspector.'
            : matchingDaleSheets.length > 0
            ? `Drawing & Revision verified (${matchingDaleSheets[0].drawingNumber} Rev ${matchingDaleSheets[0].drawingRevision})`
            : 'Non-critical component.'
          : 'BLOCKED: Inspector has not confirmed 5-point Drawing Verification checklist items.',
      },
      {
        id: 'QG-09',
        gateNumber: 9,
        category: 'Sign-Off',
        requirement: 'Formal Inspector Sign-Off',
        passed: qg09,
        details: qg09
          ? inspection?.inspectorSignOff
            ? `Signed off by ${inspection.inspectorSignOff.inspectorName} (${inspection.inspectorSignOff.inspectorId}) at ${inspection.inspectorSignOff.signedAt}`
            : matchingDaleSheets.length > 0 && matchingDaleSheets[0].approvedBy
            ? `Signed off on Dale sheet by ${matchingDaleSheets[0].approvedBy} (${matchingDaleSheets[0].approvalDate})`
            : 'Inspection signed off.'
          : 'BLOCKED: Inspection Sheet has not been formally signed off by an authorized Inspector.',
      },
      {
        id: 'QG-10',
        gateNumber: 10,
        category: 'Metrology',
        requirement: 'Calibrated Measuring Instruments & Approved Drawing Dimensions Configured',
        passed: qg10,
        details: qg10
          ? `All ${syncedChars.length} characteristics have configured drawing tolerances and calibrated instrument IDs recorded.`
          : hasUnconfiguredChars
          ? 'BLOCKED: DRAWING REQUIREMENT NOT CONFIGURED. One or more mandatory characteristics lack drawing nominal or tolerances.'
          : !hasValidInstruments
          ? 'BLOCKED: Missing measuring instrument or calibration ID on one or more characteristics.'
          : 'BLOCKED: Dimensional requirements or instrument calibration incomplete.',
      },
      {
        id: 'QG-11',
        gateNumber: 11,
        category: 'Dimensional Compliance',
        requirement: 'All Characteristics PASS or Covered by APPROVED Deviation',
        passed: qg11,
        details: qg11
          ? inspEval.deviationAcceptedChars.length > 0
            ? `${
                syncedChars.length - inspEval.deviationAcceptedChars.length
              } PASS + ${inspEval.deviationAcceptedChars.length} FAIL (Disposition = ACCEPTED_BY_APPROVED_DEVIATION: ${inspEval.deviationAcceptedChars
                .map((c) => c.deviationNumber)
                .join(', ')})`
            : `All ${syncedChars.length} mandatory characteristics calculated as PASS within tolerance.`
          : hasFailedDaleSheet
          ? `BLOCKED: Active Dale Quality Checklist Failure. Non-conforming checklist items detected.`
          : hasUnconfiguredChars
          ? 'BLOCKED: DRAWING REQUIREMENT NOT CONFIGURED. Measurements cannot be verified without drawing limits.'
          : !inspEval.allRecorded
          ? 'BLOCKED: Not all mandatory characteristics have actual measurements recorded.'
          : `BLOCKED: ${inspEval.uncoveredFailedChars.length} characteristic(s) calculated as FAIL without an APPROVED Engineering Deviation (${inspEval.uncoveredFailedChars
              .map((c) => c.feature)
              .join(', ')}).`,
      },
      {
        id: 'QG-12',
        gateNumber: 12,
        category: 'Non-Conformance',
        requirement: 'Zero Open or Blocking NCRs',
        passed: qg12,
        details: qg12
          ? recordNcrs.length === 0
            ? 'No NCRs raised against this component.'
            : `${closedNcrs.length} NCR(s) formally closed with valid disposition.`
          : openNcrs.length > 0
          ? `BLOCKED: ${openNcrs.length} Open NCR(s) (${openNcrs.map((n) => n.ncrNumber).join(', ')}) must be dispositioned and closed.`
          : 'BLOCKED: Closed NCR has SCRAP disposition or lacks required approved deviation.',
      },
      {
        id: 'QG-13',
        gateNumber: 13,
        category: 'Deviation & Redline',
        requirement: 'All Deviations Approved with Real Redline File Attached',
        passed: qg13,
        details: qg13
          ? recordDeviations.length === 0
            ? 'No deviations requested.'
            : `${approvedDeviations.length} Deviation(s) Engineering APPROVED with verified Redline Drawing attachment.`
          : `BLOCKED: ${unapprovedDeviations.length} Deviation(s) unapproved or missing mandatory Redline Drawing file (${unapprovedDeviations
              .map((d) => `${d.deviationNumber} [${d.status}]`)
              .join(', ')}).`,
      },
      {
        id: 'QG-14',
        gateNumber: 14,
        category: 'Separation of Duties',
        requirement: 'Inspector !== Machinist (Immutable User ID)',
        passed: qg14,
        details: qg14
          ? `Verified: Machinist (${record.machinistId}) !== Inspector (${
              inspection?.inspectorId || 'N/A'
            })`
          : `BLOCKED: Separation of Duties Violation — Machinist (${record.machinistId}) cannot inspect their own work.`,
      },
      {
        id: 'QG-15',
        gateNumber: 15,
        category: 'Release Authority',
        requirement: 'Authorized Releaser !== Machinist (Immutable User ID)',
        passed: qg15,
        details: !releasingUser
          ? 'BLOCKED: No authenticated user session.'
          : !hasValidReleaseRole
          ? `BLOCKED: Role ${releasingUser.role} is not authorized to execute Quality Release.`
          : !releaserDifferentFromMachinist
          ? `BLOCKED: Separation of Duties Violation — User ${releasingUser.name} (${releasingUser.id}) manufactured this component (${record.machinistId}) and cannot release it.`
          : `Verified: Releaser ${releasingUser.name} (${releasingUser.id} / ${releasingUser.role}) !== Machinist (${record.machinistId})`,
      },
      {
        id: 'QG-16',
        gateNumber: 16,
        category: 'Component Master',
        requirement: 'Valid & Active Part Number in Component Master',
        passed: qg16,
        details: qg16
          ? `Part ${record.partNumber} is ACTIVE in Component Master (${component?.description}).`
          : `BLOCKED: Part Number "${record.partNumber}" is missing or inactive in Component Master.`,
      },
      {
        id: 'QG-17',
        gateNumber: 17,
        category: 'Quantity Validation',
        requirement: 'Manufactured Quantity > 0',
        passed: qg17,
        details: qg17
          ? `Valid Quantity: ${record.quantity} unit(s)`
          : `BLOCKED: Invalid Quantity (${record.quantity}). Quantity must be > 0.`,
      },
      {
        id: 'QG-18',
        gateNumber: 18,
        category: 'Quality Hold & QMS Governance',
        requirement: 'Component Not on Quality Hold & QMS Flags Enforced',
        passed: qg18,
        details: qg18
          ? `Status: ${record.manufacturingStatus} (Critical=${isCritical}, Traceability=${isTraceabilityReq}, PermID=${isPermIdReq})`
          : openNcrs.length > 0 || hasFailedDaleSheet || record.manufacturingStatus === 'NCR_HOLD'
          ? `BLOCKED: Active Non-Conformance / Quality Bay Hold — ${openNcrs.length} Open NCR(s) (${openNcrs.map((n) => n.ncrNumber).join(', ') || 'Pending'}). Component quarantined from release.`
          : `BLOCKED: Component is currently in ${record.manufacturingStatus} state (Quality Hold / Scrapped).`,
      },
    ];

    const blockingReasons = checks.filter((c) => !c.passed).map((c) => `${c.id}: ${c.details}`);

    return {
      manufacturingRecordId,
      manufacturingRecord: record,
      inspection,
      drawing,
      openNcrs,
      closedNcrs,
      allNcrs: recordNcrs,
      matchingDaleSheets,
      unapprovedDeviations,
      approvedDeviations,
      checks,
      canRelease: blockingReasons.length === 0,
      blockingReasons,
      supersededNotice,
    };
  }

  /**
   * Explicit Component Fitment Management
   * Links manufactured and released components to machine serial numbers.
   */
  static recordComponentFitment(
    db: QMSDatabase,
    fitmentData: Omit<ComponentFitmentRecord, 'id' | 'fittedAt'>
  ): { success: boolean; fitment?: ComponentFitmentRecord; updatedDb?: QMSDatabase; error?: string } {
    const machine = db.machines.find((m) => m.serialNumber === fitmentData.machineSerialNumber);
    if (!machine) {
      return { success: false, error: `Machine serial number "${fitmentData.machineSerialNumber}" not found in register.` };
    }

    const mfg = db.manufacturingRecords.find(
      (r) => r.id === fitmentData.manufacturingRecordId || r.traceabilityNumber === fitmentData.traceabilityNumber
    );
    if (!mfg) {
      return { success: false, error: `Manufacturing record with traceability number "${fitmentData.traceabilityNumber}" not found.` };
    }

    // Verify component is not on hold or scrapped
    if (mfg.manufacturingStatus === 'NCR_HOLD' || mfg.manufacturingStatus === 'HOLD') {
      return { success: false, error: `Cannot fit component on Quality Hold (${mfg.manufacturingStatus}). Unresolved NCRs must be dispositioned.` };
    }

    const fitmentId = `FIT-${fitmentData.machineSerialNumber}-${fitmentData.traceabilityNumber}`;
    const fitmentRecord: ComponentFitmentRecord = {
      ...fitmentData,
      id: fitmentId,
      machineId: machine.id,
      machineType: machine.machineType || machine.model || 'Machine',
      projectNumber: fitmentData.projectNumber || machine.projectNumber,
      fittedAt: new Date().toISOString(),
      fitmentStatus: 'FITTED',
    };

    const existingFitments = db.componentFitments || [];
    const updatedFitments = [
      fitmentRecord,
      ...existingFitments.filter((f) => f.id !== fitmentId && f.traceabilityNumber !== fitmentData.traceabilityNumber),
    ];

    const updatedMachines = db.machines.map((m) => {
      if (m.serialNumber === fitmentData.machineSerialNumber) {
        const mFitted = m.fittedComponents || [];
        return {
          ...m,
          fittedComponents: [
            fitmentRecord,
            ...mFitted.filter((f) => f.traceabilityNumber !== fitmentData.traceabilityNumber),
          ],
        };
      }
      return m;
    });

    const updatedDb: QMSDatabase = {
      ...db,
      componentFitments: updatedFitments,
      machines: updatedMachines,
    };

    return { success: true, fitment: fitmentRecord, updatedDb };
  }

  static getMachineFitments(db: QMSDatabase, machineSerialNumber: string): ComponentFitmentRecord[] {
    const list = db.componentFitments || [];
    const fromList = list.filter((f) => f.machineSerialNumber === machineSerialNumber && f.fitmentStatus === 'FITTED');
    if (fromList.length > 0) return fromList;
    const mach = (db.machines || []).find((m) => m.serialNumber === machineSerialNumber);
    return (mach?.fittedComponents || []).filter((f) => f.fitmentStatus === 'FITTED');
  }

  static getComponentFitment(db: QMSDatabase, traceabilityNumber: string): ComponentFitmentRecord | undefined {
    const list = db.componentFitments || [];
    const fromList = list.find((f) => f.traceabilityNumber === traceabilityNumber && f.fitmentStatus === 'FITTED');
    if (fromList) return fromList;
    for (const m of db.machines || []) {
      const found = (m.fittedComponents || []).find(
        (f) => f.traceabilityNumber === traceabilityNumber && f.fitmentStatus === 'FITTED'
      );
      if (found) return found;
    }
    return undefined;
  }
}

// Named helper exports for any module importing utility functions directly
export const validateCharacteristicTolerance = (
  name: string,
  nominalValue: number,
  upperTolerance: number,
  lowerTolerance: number
) => {
  const res = DBService.validateToleranceLimits({
    nominal: nominalValue,
    upperTolerance,
    lowerTolerance,
  });
  return {
    valid: res.valid,
    error: res.error ? `${name ? `[${name}] ` : ''}${res.error}` : undefined,
  };
};

export const calculateCharacteristicLimits = (
  nominalValue: number,
  upperTolerance: number,
  lowerTolerance: number
) => ({
  minTolerance: Number((nominalValue + lowerTolerance).toFixed(4)),
  maxTolerance: Number((nominalValue + upperTolerance).toFixed(4)),
});
