/**
 * MACHINE QMS - Manufacturing Quality & Component Traceability System
 * Core Data Models and Types
 */

export type UserRole =
  | 'MACHINIST'
  | 'INSPECTOR'
  | 'MACHINE_MANAGER'
  | 'ENGINEERING'
  | 'HSEQ'
  | 'ADMINISTRATOR'
  | 'MANAGEMENT';

export type WorkshopDepartment =
  | 'ALL'
  | 'GRINDING_BAY'
  | 'SHEET_METAL'
  | 'ELECTRICAL'
  | 'MACHINE_SHOP'
  | 'BLASTING_BAY'
  | 'WELDING'
  | 'FITTING'
  | 'GRINDING_POLISH_FINISH'
  // Existing system departments maintained for complete backwards compatibility:
  | 'CNC_MACHINING'
  | 'FABRICATION_WELDING'
  | 'CONVEYOR_SYSTEMS'
  | 'SPIRAL_SYSTEMS'
  | 'MECHANICAL_ASSEMBLY'
  | 'ELECTRICAL_PANELS'
  | 'ROBOTICS_AUTOMATION'
  | 'REFRIGERATION_COOLING'
  | 'QUALITY_METROLOGY'
  | 'ENGINEERING_DESIGN'
  | 'HSEQ_COMPLIANCE'
  | 'MACHINE_SHOP_MGMT'
  | 'EXECUTIVE_ADMIN';

export type InspectionStage =
  | 'FIRST_OFF'
  | 'IN_PROCESS'
  | 'FINAL_INSPECTION'
  | 'QUALITY_RELEASE';

export type TemplateStatus =
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'SUPERSEDED'
  | 'OBSOLETE';

export type CharacteristicType =
  | 'DIMENSIONAL'
  | 'VISUAL'
  | 'FUNCTIONAL'
  | 'FIT'
  | 'ALIGNMENT'
  | 'WORKMANSHIP'
  | 'IDENTIFICATION'
  | 'DOCUMENTATION';

export type RequirementSource =
  | 'APPROVED_DRAWING'
  | 'APPROVED_SPECIFICATION'
  | 'ENGINEERING_REQUIREMENT'
  | 'VISUAL_STANDARD'
  | 'CUSTOMER_REQUIREMENT';

export interface InspectionTemplateCharacteristic {
  id: string;
  characteristicNumber: number;
  feature: string;
  description: string;
  characteristicType: CharacteristicType;
  mandatory: boolean;
  requirementSource: RequirementSource;
  nominal?: number | null; // null indicates "FROM APPROVED DRAWING" until loaded
  lowerTolerance?: number | null;
  upperTolerance?: number | null;
  unit?: string;
  actualMeasurement?: number | null | string;
  result?: CharacteristicResult;
  measuringInstrument?: string;
  instrumentId?: string;
  inspectorComment?: string;
  disposition?: CharacteristicDisposition;
  deviationReference?: string;
  deviationApprovedBy?: string;
  deviationApprovalDate?: string;
}

export interface InspectionTemplateQualityCheck {
  id: string;
  checkNumber: number;
  description: string;
  mandatory: boolean;
  result?: 'PASS' | 'FAIL' | 'NA' | 'PENDING' | null;
  comment?: string;
  ncrReference?: string;
}

export interface TemplateRevisionHistory {
  revision: string;
  effectiveDate: string;
  approvedBy: string;
  approvalDate: string;
  changeNotes: string;
}

export interface InspectionTemplate {
  id: string;
  code: string;
  name: string;
  machineType: string;
  componentType: string;
  inspectionStage: InspectionStage;
  description: string;
  revision: string;
  status: TemplateStatus;
  effectiveDate: string;
  approvedBy: string;
  approvalDate: string;
  active: boolean;
  characteristics: InspectionTemplateCharacteristic[];
  qualityChecks: InspectionTemplateQualityCheck[];
  department?: WorkshopDepartment | string;
  history?: TemplateRevisionHistory[];
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentInfo {
  id: WorkshopDepartment;
  name: string;
  code: string;
  color: string;
  iconName: string;
  description: string;
  linkedProcesses: DaleProcessType[];
  primaryRoles: UserRole[];
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  department: string;
  email: string;
  active?: boolean;
}

export interface AuthSession {
  token: string;
  user: User;
  expiresAt: string;
  productionMode?: boolean;
  authMode?: 'DEV_TEST' | 'PRODUCTION';
}

export interface FileAttachmentMetadata {
  fileId: string;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  fileSize: number;
  uploadDate: string;
  uploadedBy: string;
  uploadedById: string;
  category: 'REDLINE' | 'DRAWING' | 'EVIDENCE';
  relatedRecordId?: string;
  drawingNumber?: string;
  revision?: string;
  downloadUrl?: string;
  dataUrl?: string;
  caption?: string;
}

export type MachineManufacturingStatus =
  | 'PLANNED'
  | 'IN_PRODUCTION'
  | 'QUALITY_HOLD'
  | 'COMPLETED'
  | 'DELIVERED';

export type MachineAssemblyStatus =
  | 'NOT_STARTED'
  | 'SUB_ASSEMBLY'
  | 'FINAL_ASSEMBLY'
  | 'TESTING'
  | 'RELEASED';

export interface ComponentFitmentRecord {
  id: string;
  machineId: string;
  machineSerialNumber: string;
  machineType: string;
  projectNumber: string;
  componentId?: string;
  partNumber: string;
  partDescription: string;
  traceabilityNumber: string;
  manufacturingRecordId: string;
  quantityFitted: number;
  fittedAt: string; // ISO date-time
  fittedBy: string; // Name of operator or inspector
  fittedById: string; // User ID
  inspectionRecordId?: string;
  qualityReleaseRecordId?: string;
  fitmentStatus: 'FITTED' | 'REMOVED' | 'REPLACED';
  locationOnMachine?: string;
  verificationNotes?: string;
}

export interface Machine {
  id: string;
  machineType: string;
  serialNumber: string;
  customer: string;
  projectNumber: string;
  projectName: string;
  manufacturingStatus: MachineManufacturingStatus;
  assemblyStatus: MachineAssemblyStatus;
  dateCreated: string;
  createdBy: string;
  allocatedDrawingNumbers?: string[];
  allocatedPartNumbers?: string[];
  model?: string;
  fittedComponents?: ComponentFitmentRecord[];
  notes?: string;
}

export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED';

export interface Project {
  id: string;
  projectNumber: string;
  projectName: string;
  customer: string;
  machineType: string;
  associatedSerialNumbers: string[];
  machineSerialNumbers: string[];
  allocatedDrawingNumbers?: string[];
  allocatedPartNumbers?: string[];
  projectStatus: ProjectStatus;
  startDate: string;
  targetCompletionDate: string;
  createdBy: string;
  notes?: string;
}

export type ComponentCategory =
  | 'SHAFT'
  | 'DRUM'
  | 'ROLLER'
  | 'SPROCKET'
  | 'HOUSING'
  | 'BEARING_BLOCK'
  | 'FRAME'
  | 'GEAR'
  | 'MOUNT'
  | 'FASTENER_SPECIAL'
  | 'OTHER';

export interface ManufacturingRouteStep {
  sequence: number;
  department: WorkshopDepartment;
  operationName: string;
  templateCode?: string;
  templateId?: string;
  mandatoryInspection?: boolean;
  requiresDimensionalInspection?: boolean;
  requiresVisualChecklist?: boolean;
}

export interface Component {
  id: string;
  partNumber: string;
  description: string;
  category: ComponentCategory | string;
  machineTypes: string[];
  criticalComponent: boolean;
  defaultDrawingNumber: string;
  currentDrawingRevision: string;
  drawingNumber?: string;
  materialSpecification: string;
  material?: string;
  traceabilityRequired: boolean;
  permanentIdRequired: boolean;
  active: boolean;
  createdDate: string;
  projectNumbers?: string[];
  machineSerialNumbers?: string[];
  quantityPerAssembly?: string;
  notes?: string;
  primaryInspectionTemplateId?: string;
  primaryInspectionTemplateCode?: string;
  primaryInspectionTemplateRevision?: string;
  inspectionStage?: InspectionStage;
  manufacturingRoute?: ManufacturingRouteStep[];
}

export type DrawingStatus =
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'SUPERSEDED'
  | 'OBSOLETE';

export interface DrawingPartItem {
  id: string;
  itemNumber: string;
  quantity: string;
  partNumber: string;
  description: string;
  material: string;
  designation: string;
  orderNumber?: string;
  vendor?: string;
}

export interface Drawing {
  id: string;
  drawingNumber: string;
  drawingTitle: string;
  partNumber: string;
  partNumbers?: string[];
  partsList?: DrawingPartItem[];
  revision: string;
  drawingStatus: DrawingStatus;
  approvedBy?: string;
  approvedById?: string;
  approvalDate?: string;
  effectiveDate: string;
  revisionNotes: string;
  previousRevision?: string;
  projectReference?: string;
  projectNumbers?: string[];
  machineSerialNumbers?: string[];
  elementCode?: string;
  scale?: string;
  sheetSize?: string;
  sheetNumber?: string;
  modelledBy?: string;
  modelledDate?: string;
  detailedBy?: string;
  detailedDate?: string;
  referenceDrawings?: string;
  fileName?: string;
  drawingFile?: FileAttachmentMetadata;
  revisionPhotos?: FileAttachmentMetadata[];
  isCurrent: boolean;
}

export interface DrawingSnapshotAtManufacture {
  drawingId: string;
  drawingNumber: string;
  drawingRevision: string;
  approvalStatusAtManufacture: DrawingStatus;
  drawingApprovalDate?: string;
  drawingEffectiveDate?: string;
  drawingApprovedBy?: string;
  drawingFileId?: string;
  capturedAt: string;
}

export type PermanentIdMethod =
  | 'ENGRAVED'
  | 'STAMPED'
  | 'LASER MARKED'
  | 'SERIAL NUMBER'
  | 'PART NUMBER'
  | 'QR CODE'
  | 'LABEL'
  | 'OTHER'
  | 'NONE';

export type ManufacturingRecordStatus =
  | 'IN_PRODUCTION'
  | 'MANUFACTURED'
  | 'AWAITING_IDENTIFICATION'
  | 'AWAITING_INSPECTION'
  | 'UNDER_INSPECTION'
  | 'INSPECTION_PASSED'
  | 'HOLD'
  | 'FAIL'
  | 'NCR_HOLD'
  | 'DEVIATION_REVIEW'
  | 'RELEASED'
  | 'SCRAPPED';

export interface ManufacturingRecord {
  id: string;
  traceabilityNumber: string;
  machineSerialNumber: string;
  projectNumber: string;
  partNumber: string;
  componentDescription: string;
  drawingNumber: string;
  drawingRevision: string;
  drawingSnapshot?: DrawingSnapshotAtManufacture;
  quantity: number;
  manufacturingDate: string;
  machinist: string;
  machinistId: string;
  workstation: string;
  batchMaterialRef: string;
  permanentIdMethod: PermanentIdMethod;
  permanentIdReference: string;
  permanentIdCompleted: boolean;
  permanentIdDate?: string;
  permanentIdBy?: string;
  permanentIdById?: string;
  manufactureDate?: string;
  permanentMarkText?: string;
  permanentMark?: string;
  manufacturingStatus: ManufacturingRecordStatus;
  notes?: string;
  department?: WorkshopDepartment;
  departmentOperation?: string;
  operations?: Array<{
    operationId: string;
    sequence: number;
    department: WorkshopDepartment;
    operationName: string;
    templateCode?: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'HOLD';
    operatorId?: string;
    operatorName?: string;
    completedAt?: string;
    inspectionRecordId?: string;
    handoverConfirmed?: boolean;
    handoverToDepartment?: WorkshopDepartment;
    handoverSignOff?: {
      signedBy: string;
      signedById: string;
      signedAt: string;
      comments?: string;
    };
  }>;
  createdBy: string;
  createdById?: string;
  createdDate: string;
}

export type CharacteristicResult = 'PENDING' | 'PASS' | 'FAIL';

export type CharacteristicDisposition =
  | 'STANDARD'
  | 'ACCEPTED_BY_APPROVED_DEVIATION';

export interface InspectionCharacteristic {
  id: string;
  charNumber: number;
  feature: string;
  nominal?: number | null;
  upperTolerance?: number | null;
  lowerTolerance?: number | null;
  unit: string;
  actual: number | null;
  measuringInstrument: string;
  instrumentId: string;
  result: CharacteristicResult;
  disposition?: CharacteristicDisposition;
  deviationId?: string;
  deviationNumber?: string;
  deviationApprovedBy?: string;
  deviationApprovalDate?: string;
  comment?: string;
  requirementSource?: RequirementSource;
  mandatory?: boolean;
  drawingNumber?: string;
  drawingRevision?: string;
  drawingNominalConfigured?: boolean;
  photos?: FileAttachmentMetadata[];
}

export interface CalibrationInstrument {
  id: string;
  instrumentId: string;
  name: string;
  serialNumber: string;
  equipmentType:
    | 'MICROMETER'
    | 'CALIPER'
    | 'HEIGHT_GAUGE'
    | 'BORE_GAUGE'
    | 'DIAL_INDICATOR'
    | 'TORQUE_WRENCH'
    | 'OTHER';
  certificateNumber: string;
  calibrationDate: string;
  expiryDate: string;
  status: 'VALID' | 'EXPIRED' | 'OUT_OF_SERVICE';
  range?: string;
  resolution?: string;
  calibratedBy: string;
  location?: string;
}

export interface DrawingVerificationChecklist {
  correctDrawingNumber: boolean;
  correctDrawingRevision: boolean;
  drawingApproved: boolean;
  componentCorrespondsToDrawing: boolean;
  associationCorrect: boolean;
}

export interface InspectorSignOff {
  confirmed: boolean;
  declaration: string;
  signedAt: string;
  inspectorId: string;
  inspectorName: string;
  inspectorRole: UserRole;
  signedBy?: string;
  signedById?: string;
  acceptedWithDeviation?: boolean;
  deviationReferences?: string[];
}

export interface InspectionRecord {
  id: string;
  manufacturingRecordId: string;
  traceabilityNumber: string;
  machineSerialNumber: string;
  projectNumber: string;
  partNumber: string;
  componentDescription: string;
  quantity: number;
  drawingNumber: string;
  drawingRevision: string;
  machinist: string;
  machinistId: string;
  manufacturingDate: string;
  inspectorId: string;
  inspectorName: string;
  inspectionDate: string;
  inspectionTime: string;
  status: 'IN_PROGRESS' | 'PASS' | 'FAIL' | 'HOLD';
  department?: WorkshopDepartment;
  departmentOperation?: string;
  operatorId?: string;
  operatorName?: string;
  handoverConfirmed?: boolean;
  handoverToDepartment?: WorkshopDepartment;
  handoverSignOff?: {
    signedBy: string;
    signedById: string;
    signedAt: string;
    comments?: string;
  };
  drawingVerification: DrawingVerificationChecklist;
  characteristics: InspectionCharacteristic[];
  templateId?: string;
  templateCode?: string;
  templateRevision?: string;
  inspectionStage?: InspectionStage;
  templateCharacteristics?: InspectionTemplateCharacteristic[];
  templateQualityChecks?: InspectionTemplateQualityCheck[];
  inspectorSignOff?: InspectorSignOff;
  ncrId?: string;
  deviationId?: string;
  evidencePhotos?: FileAttachmentMetadata[];
  attachments?: FileAttachmentMetadata[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// DALE AUTOMATION MANUFACTURING QUALITY INSPECTION SHEETS
// ==========================================

export type DaleProcessType =
  | 'FABRICATION_WELDING'
  | 'MACHINED_COMPONENTS'
  | 'MACHINED_PARTS' // backwards compatibility alias
  | 'CONVEYOR_COMPONENTS'
  | 'SPIRAL_SYSTEMS'
  | 'MECHANICAL_ASSEMBLY'
  | 'ASSEMBLY' // backwards compatibility alias
  | 'ELECTRICAL_CONTROL_PANEL'
  | 'ELECTRICAL_PANELS' // backwards compatibility alias
  | 'ROBOTIC_AUTOMATION_ASSEMBLY'
  | 'REFRIGERATION_COOLING_ASSEMBLY'
  | 'FINAL_MANUFACTURING_FAT'
  | 'FINAL_MANUFACTURING'; // backwards compatibility alias

export type DaleChecklistResult = 'PASS' | 'FAIL' | 'NA' | 'PENDING' | null;

export interface DaleInspectionPoint {
  id: string;
  pointNumber: number;
  description: string;
  requirement?: string; // Requirement / Specification
  mandatory: boolean;
  requiresMeasurement: boolean;
  measurementUnit?: string;
  measurementValue?: string; // Actual Measurement where applicable
  result?: DaleChecklistResult | null; // PASS / FAIL / N/A / null
  comment?: string; // Comments / Observations
  deviationNotes?: string; // Specific recorded deviation description
  ncrReference?: string; // Dedicated NCR number raised for this specific failed point
  photos?: FileAttachmentMetadata[]; // Photo evidence (from camera or device upload)
}

export interface DaleInspectionRecord {
  id: string; // e.g. DALE-INSP-2026-001
  sheetNumber: string; // e.g. DALE-INSP-001
  processType: DaleProcessType;
  processTitle: string; // e.g. "1. Fabrication & Welding", "2. Machined Components", etc.
  projectNumber: string; // Project / Job No.
  machineOrAssembly: string; // Machine / Assembly
  partName?: string; // Part Name
  partOrSerialNo: string; // Part / Serial No.
  drawingNumber: string; // Drawing No.
  drawingRevision: string; // Revision
  partDescription?: string;
  inspector: string; // Inspector Name
  inspectorId?: string;
  inspectionDate: string; // YYYY-MM-DD
  points: DaleInspectionPoint[];
  comments: string;
  ncrReference: string; // NCR / Deviation No.
  deviationReference?: string;
  correctiveAction: string;
  approvalStatus: 'PASS' | 'FAIL' | 'PENDING' | 'HOLD';
  inspectorSignOff?: string; // Inspector Sign-off
  qualityApproval?: string; // Quality Approval
  approvedBy?: string;
  approvalDate?: string;
  signatureRole?: string;
  photos?: FileAttachmentMetadata[]; // Photo / evidence attachment
  createdAt: string;
  updatedAt: string;
}

export type NCRStatus = 'OPEN' | 'CONTAINED' | 'DISPOSITIONED' | 'CLOSED';

export type NCRDisposition =
  | 'REWORK'
  | 'SCRAP'
  | 'USE_AS_IS_DEVIATION_REQUIRED'
  | 'RETURN_TO_SUPPLIER';

export interface NCR {
  id: string;
  ncrNumber: string;
  manufacturingRecordId: string;
  inspectionRecordId?: string;
  daleInspectionId?: string;
  deviationId?: string;
  traceabilityNumber: string;
  machineSerialNumber: string;
  projectNumber: string;
  partNumber: string;
  componentDescription?: string;
  drawingNumber: string;
  drawingRevision: string;
  department?: WorkshopDepartment | string;
  characteristicId?: string;
  characteristicName?: string;
  failedCharacteristics?: string[];
  description: string;
  descriptionOfNonConformance?: string;
  requirement: string;
  actualCondition: string;
  immediateContainment: string;
  proposedDisposition: NCRDisposition;
  rootCause: string;
  correctiveAction: string;
  issuePhotoEvidence?: FileAttachmentMetadata[];
  correctiveActionPhotoEvidence?: FileAttachmentMetadata[];
  responsiblePerson: string;
  dueDate: string;
  status: NCRStatus;
  approvedBy?: string;
  approvedById?: string;
  closedAt?: string;
  closureDate?: string;
  createdAt: string;
  createdBy: string;
  createdById?: string;
}

export type DeviationType =
  | 'INTENTIONAL_MANUFACTURING_CHANGE'
  | 'POST_INSPECTION_CONCESSION'
  | 'MATERIAL_SUBSTITUTION';

export type DeviationStatus =
  | 'DRAFT'
  | 'INCOMPLETE'
  | 'AWAITING_APPROVAL'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED';

export interface Deviation {
  id: string;
  deviationNumber: string;
  manufacturingRecordId: string;
  inspectionRecordId?: string;
  ncrId?: string;
  traceabilityNumber: string;
  machineSerialNumber: string;
  projectNumber: string;
  partNumber: string;
  drawingNumber?: string;
  drawingRevision?: string;
  originalDrawingNumber: string;
  originalDrawingRevision: string;
  deviationType: DeviationType;
  affectedCharacteristicIds?: string[];
  affectedCharacteristicNames?: string[];
  affectedCharacteristics?: string[];
  concessionGranted?: boolean;
  redlineFileId?: string;
  approvedConcessionDisposition?: 'USE_AS_IS' | 'CONCESSION_ACCEPTED' | 'REWORK_TO_REDLINE';
  descriptionOfChange: string;
  reasonForDeviation: string;
  engineeringJustification?: string;
  requiresRedline: boolean;
  redlineFileRequired?: boolean;
  redlineAttachmentName?: string;
  redlineFile?: FileAttachmentMetadata;
  redlineNotes?: string;
  reviewedBy?: string;
  reviewedById?: string;
  reviewDate?: string;
  approvedBy?: string;
  approvedById?: string;
  approvalDate?: string;
  engineeringApproved: boolean;
  status: DeviationStatus;
  createdAt: string;
  createdBy: string;
  createdById?: string;
}

export interface QualityReleaseRecord {
  id: string;
  releaseId: string;
  manufacturingRecordId: string;
  inspectionRecordId?: string;
  traceabilityNumber: string;
  machineSerialNumber: string;
  projectNumber: string;
  partNumber: string;
  releasedBy: string;
  releasedById: string;
  releasedByRole: UserRole;
  releaseDate: string;
  releaseTime: string;
  releaseResult: 'PASS - RELEASED' | 'PASS WITH APPROVED DEVIATION - RELEASED';
  ncrReference?: string;
  deviationReference?: string;
  notes?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId?: string;
  user: string;
  role: UserRole | string;
  action: string;
  recordType:
    | 'MACHINE'
    | 'PROJECT'
    | 'COMPONENT'
    | 'DRAWING'
    | 'MANUFACTURING_RECORD'
    | 'INSPECTION'
    | 'NCR'
    | 'DEVIATION'
    | 'RELEASE'
    | 'FITMENT'
    | 'ATTACHMENT'
    | 'AUTH'
    | 'SYSTEM'
    | 'DATABASE';
  recordId: string;
  details?: Record<string, any>;
  previousValue?: string;
  newValue?: string;
}

export interface SystemSettings {
  companyName: string;
  departmentName: string;
  systemVersion: string;
  strictDrawingApproval: boolean;
  autoGenerateTraceability: boolean;
  requirePermanentIdForCritical: boolean;
  productionMode: boolean;
  allowDevRoleSwitch?: boolean;
  traceabilityCounter: number;
  machineTypes: string[];
}

export interface QMSDatabase {
  users: User[];
  machines: Machine[];
  projects: Project[];
  components: Component[];
  drawings: Drawing[];
  manufacturingRecords: ManufacturingRecord[];
  inspections: InspectionRecord[];
  daleInspections?: DaleInspectionRecord[];
  inspectionTemplates?: InspectionTemplate[];
  calibrationInstruments?: CalibrationInstrument[];
  ncrs: NCR[];
  deviations: Deviation[];
  releases: QualityReleaseRecord[];
  componentFitments?: ComponentFitmentRecord[];
  attachments: FileAttachmentMetadata[];
  auditLogs: AuditLog[];
  settings: SystemSettings;
  lastUpdated: string;
  deletedRecordKeys?: string[];
}
