/**
 * MACHINE QMS - Application State & Quality Governance Context
 * Provides server-authenticated session state, role-based access enforcement,
 * 18-point Quality Release Gate validation, drawing snapshot preservation,
 * automatic quality holds, file attachment storage, and full audit logging.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  QMSDatabase,
  User,
  UserRole,
  Machine,
  Project,
  Component,
  Drawing,
  DrawingPartItem,
  DrawingStatus,
  ManufacturingRecord,
  InspectionRecord,
  InspectionCharacteristic,
  CharacteristicResult,
  CharacteristicDisposition,
  InspectionTemplate,
  InspectionTemplateCharacteristic,
  InspectionTemplateQualityCheck,
  TemplateStatus,
  InspectionStage,
  DaleInspectionRecord,
  DaleInspectionPoint,
  NCR,
  Deviation,
  QualityReleaseRecord,
  AuditLog,
  SystemSettings,
  PermanentIdMethod,
  FileAttachmentMetadata,
  AuthSession,
  WorkshopDepartment,
  ComponentFitmentRecord,
} from '../types';
import {
  DBService,
  INITIAL_DATABASE,
  DEFAULT_PART_CHARACTERISTICS,
  QualityReleaseCheck,
  QualityReleaseEvaluation,
} from '../services/db';
import {
  reconcileCrossPopulatedDatabase,
  mergeQMSDatabases,
} from '../utils/crossReference';
import {
  INITIAL_INSPECTION_TEMPLATES,
  matchApprovedInspectionTemplate,
} from '../data/inspectionTemplatesData';

export type { QualityReleaseCheck, QualityReleaseEvaluation };

export interface CrossNavigationTarget {
  tab:
    | 'machines'
    | 'projects'
    | 'components'
    | 'drawings'
    | 'manufacturing'
    | 'traceability-search'
    | 'dale-inspections'
    | 'ncr'
    | 'deviations'
    | 'quality-release'
    | 'reports';
  searchQuery?: string;
  recordId?: string;
  timestamp: number;
}

interface QMSContextType {
  db: QMSDatabase;
  currentUser: User;
  authSession: AuthSession | null;
  isAuthenticated: boolean;
  activeWorkshopDepartment: WorkshopDepartment;
  setActiveWorkshopDepartment: (dept: WorkshopDepartment) => void;
  login: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  registerProfile: (params: {
    username: string;
    name: string;
    email: string;
    role: UserRole;
    department: string;
    password: string;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  setCurrentUser: (user: User) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
  isSyncing: boolean;
  lastSynced: Date | null;
  error: string | null;

  // Attachment Upload
  uploadAttachmentFile: (params: {
    originalFilename: string;
    mimeType: string;
    base64Data: string;
    category: 'REDLINE' | 'DRAWING' | 'EVIDENCE';
    relatedRecordId?: string;
    drawingNumber?: string;
    revision?: string;
    caption?: string;
  }) => Promise<{ success: boolean; attachment?: FileAttachmentMetadata; error?: string }>;

  // Machine Actions
  addMachine: (machine: Omit<Machine, 'id' | 'dateCreated' | 'createdBy'>) => Promise<boolean>;
  importMachines: (
    machines: Array<{
      serialNumber: string;
      machineType: string;
      customer: string;
      projectNumber: string;
      projectName: string;
      manufacturingStatus: Machine['manufacturingStatus'];
      assemblyStatus: Machine['assemblyStatus'];
      notes?: string;
    }>
  ) => Promise<{ ok: boolean; importedCount: number; skippedCount: number; error?: string }>;
  updateMachine: (id: string, updates: Partial<Machine>) => Promise<boolean>;

  // Project Actions
  addProject: (
    project: Omit<Project, 'id' | 'createdBy' | 'associatedSerialNumbers' | 'machineSerialNumbers'> & {
      associatedSerialNumbers?: string[];
      machineSerialNumbers?: string[];
    }
  ) => Promise<boolean>;
  importProjects: (
    projects: Array<{
      projectNumber: string;
      projectName: string;
      customer: string;
      machineType: string;
      machineSerialNumbers: string[];
      projectStatus: Project['projectStatus'];
      startDate: string;
      targetCompletionDate: string;
      notes?: string;
    }>
  ) => Promise<{ ok: boolean; importedCount: number; skippedCount: number; error?: string }>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<boolean>;

  // Component Actions
  addComponent: (component: Omit<Component, 'id' | 'createdDate'>) => Promise<boolean>;
  importComponents: (
    components: Array<{
      partNumber: string;
      description: string;
      category: Component['category'];
      machineTypes: string[];
      defaultDrawingNumber: string;
      currentDrawingRevision: string;
      materialSpecification: string;
      criticalComponent: boolean;
      traceabilityRequired: boolean;
      permanentIdRequired: boolean;
      active?: boolean;
      notes?: string;
    }>
  ) => Promise<{ ok: boolean; importedCount: number; skippedCount: number; error?: string }>;
  updateComponent: (id: string, updates: Partial<Component>) => Promise<boolean>;

  // Drawing Actions
  addDrawing: (drawing: Omit<Drawing, 'id'>) => Promise<boolean>;
  importDrawings: (
    drawings: Array<{
      drawingNumber: string;
      revision: string;
      drawingTitle: string;
      elementCode?: string;
      projectReference?: string;
      projectNumbers?: string[];
      machineSerialNumbers?: string[];
      drawingStatus?: DrawingStatus;
      effectiveDate?: string;
      revisionNotes?: string;
      scale?: string;
      sheetSize?: string;
      sheetNumber?: string;
      modelledBy?: string;
      detailedBy?: string;
      referenceDrawings?: string;
      partsList?: DrawingPartItem[];
    }>
  ) => Promise<{
    ok: boolean;
    importedCount: number;
    updatedCount: number;
    skippedCount: number;
    error?: string;
  }>;
  importMachineBomPackage: (payload: {
    machineSerialNumber: string;
    machineType: string;
    customer?: string;
    projectNumber: string;
    projectName: string;
    elementCode?: string;
    modelledBy?: string;
    detailedBy?: string;
    drawings: Array<{
      drawingNumber: string;
      revision: string;
      drawingTitle: string;
      elementCode?: string;
      projectReference?: string;
      projectNumbers?: string[];
      machineSerialNumbers?: string[];
      drawingStatus?: DrawingStatus;
      effectiveDate?: string;
      revisionNotes?: string;
      modelledBy?: string;
      detailedBy?: string;
      referenceDrawings?: string;
      partsList?: DrawingPartItem[];
    }>;
    components: Array<{
      partNumber: string;
      description: string;
      category: string;
      machineTypes: string[];
      defaultDrawingNumber: string;
      currentDrawingRevision: string;
      materialSpecification: string;
      criticalComponent: boolean;
      traceabilityRequired: boolean;
      permanentIdRequired: boolean;
      active?: boolean;
      projectNumbers?: string[];
      machineSerialNumbers?: string[];
      quantityPerAssembly?: string;
      notes?: string;
    }>;
  }) => Promise<{
    ok: boolean;
    drawingsImported: number;
    drawingsUpdated: number;
    componentsImported: number;
    componentsUpdated: number;
    machineSerialNumber: string;
    projectNumber: string;
    error?: string;
  }>;
  updateDrawing: (id: string, updates: Partial<Drawing>) => Promise<boolean>;
  createDrawingRevision: (
    existingDrawingId: string,
    newRevision: string,
    changeNotes: string,
    drawingFile?: FileAttachmentMetadata,
    revisionOverrides?: {
      revisionPhotos?: FileAttachmentMetadata[];
      partsList?: DrawingPartItem[];
      effectiveDate?: string;
      drawingStatus?: DrawingStatus;
      drawingTitle?: string;
      elementCode?: string;
      projectReference?: string;
      scale?: string;
      sheetSize?: string;
      sheetNumber?: string;
      modelledBy?: string;
      modelledDate?: string;
      detailedBy?: string;
      detailedDate?: string;
      referenceDrawings?: string;
    }
  ) => Promise<boolean>;

  // Manufacturing Record & Permanent Identification Actions
  addManufacturingRecord: (
    record: Omit<ManufacturingRecord, 'id' | 'traceabilityNumber' | 'createdBy' | 'createdDate' | 'manufacturingStatus'>
  ) => Promise<{ success: boolean; traceabilityNumber?: string; error?: string }>;
  updateManufacturingRecord: (id: string, updates: Partial<ManufacturingRecord>) => Promise<boolean>;
  completePermanentIdentification: (
    manufacturingRecordId: string,
    params: {
      method: PermanentIdMethod;
      reference: string;
      date?: string;
      completedBy?: string;
    }
  ) => Promise<{ success: boolean; error?: string }>;

  // Phase 2 Inspection Actions
  startInspection: (
    manufacturingRecordId: string,
    options?: {
      templateId?: string;
      stage?: InspectionStage;
      department?: WorkshopDepartment;
      departmentOperation?: string;
      operatorId?: string;
      operatorName?: string;
    }
  ) => Promise<{ success: boolean; inspectionId?: string; error?: string }>;
  recordDepartmentHandover: (
    inspectionId: string,
    handover: {
      toDepartment: WorkshopDepartment;
      signedBy: string;
      signedById: string;
      signedAt?: string;
      comments?: string;
    }
  ) => Promise<{ success: boolean; error?: string }>;
  updateInspection: (id: string, updates: Partial<InspectionRecord>) => Promise<boolean>;
  addInspectionCharacteristic: (
    inspectionId: string,
    charInput: Omit<InspectionCharacteristic, 'id' | 'charNumber' | 'actual' | 'result'>
  ) => Promise<{ success: boolean; error?: string }>;
  recordCharacteristicReading: (
    inspectionId: string,
    characteristicId: string,
    actual: number | null,
    measuringInstrument?: string,
    instrumentId?: string,
    comment?: string
  ) => Promise<boolean>;
  updateInspectionQualityCheck: (
    inspectionId: string,
    checkId: string,
    result: 'PASS' | 'FAIL' | 'NA' | null,
    comment?: string
  ) => Promise<{ success: boolean; ncrNumber?: string; error?: string }>;
  updateCharacteristicDrawingNominal: (
    inspectionId: string,
    charId: string,
    nominal: number,
    upperTolerance: number,
    lowerTolerance: number,
    unit?: string,
    measuringInstrument?: string,
    instrumentId?: string
  ) => Promise<{ success: boolean; error?: string }>;
  signOffInspection: (inspectionId: string, declaration: string) => Promise<{ success: boolean; error?: string }>;

  // Controlled Inspection Template / Inspection Plan Library Actions
  createInspectionTemplate: (
    template: Omit<InspectionTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<{ success: boolean; templateId?: string; error?: string }>;
  updateInspectionTemplate: (
    id: string,
    updates: Partial<InspectionTemplate>
  ) => Promise<{ success: boolean; error?: string }>;
  approveInspectionTemplate: (
    id: string,
    approverName?: string
  ) => Promise<{ success: boolean; error?: string }>;
  reviseInspectionTemplate: (
    id: string,
    changeNotes: string
  ) => Promise<{ success: boolean; newTemplateId?: string; error?: string }>;
  obsoleteInspectionTemplate: (
    id: string,
    reason?: string
  ) => Promise<{ success: boolean; error?: string }>;
  assignTemplateToComponent: (
    componentId: string,
    templateId: string
  ) => Promise<{ success: boolean; error?: string }>;

  // Dale Automation Manufacturing Quality Inspection Actions
  createDaleInspection: (
    record: Omit<DaleInspectionRecord, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<{ success: boolean; id?: string; error?: string }>;
  createDaleInspectionsBatch: (
    records: Omit<DaleInspectionRecord, 'id' | 'createdAt' | 'updatedAt'>[]
  ) => Promise<{ success: boolean; createdCount: number; error?: string }>;
  updateDaleInspection: (
    id: string,
    updates: Partial<DaleInspectionRecord>
  ) => Promise<{ success: boolean; error?: string }>;
  updateDaleInspectionPoint: (
    inspectionId: string,
    pointId: string,
    updates: Partial<DaleInspectionPoint>
  ) => Promise<{ success: boolean; ncrNumber?: string; error?: string }>;
  setAllDaleInspectionPointsPass: (
    inspectionId: string
  ) => Promise<{ success: boolean; error?: string }>;
  setAllDaleInspectionPointsNA: (
    inspectionId: string
  ) => Promise<{ success: boolean; error?: string }>;
  resetDaleInspectionPointsToOpen: (
    inspectionId: string
  ) => Promise<{ success: boolean; error?: string }>;
  approveDaleInspection: (
    inspectionId: string,
    status: 'PASS' | 'FAIL',
    comments?: string
  ) => Promise<{ success: boolean; ncrNumber?: string; error?: string }>;
  submitDaleInspection: (
    inspectionId: string,
    options?: {
      targetStatus?: 'PASS' | 'FAIL' | 'PENDING' | 'HOLD';
      inspectorComments?: string;
      correctiveAction?: string;
    }
  ) => Promise<{ success: boolean; ncrNumbers?: string[]; error?: string }>;
  deleteDaleInspection: (
    id: string
  ) => Promise<{ success: boolean; error?: string }>;

  // Phase 2 NCR Actions
  createNCR: (ncr: Omit<NCR, 'id' | 'ncrNumber' | 'createdAt' | 'createdBy' | 'status'>) => Promise<{ success: boolean; ncrNumber?: string; error?: string }>;
  updateNCR: (id: string, updates: Partial<NCR>) => Promise<boolean>;

  // Phase 2 Deviation Actions
  createDeviation: (
    deviation: Omit<Deviation, 'id' | 'deviationNumber' | 'createdAt' | 'createdBy' | 'engineeringApproved'>
  ) => Promise<{ success: boolean; deviationNumber?: string; ncrNumber?: string; error?: string }>;
  updateDeviation: (id: string, updates: Partial<Deviation>) => Promise<{ success: boolean; error?: string }>;

  // Phase 2 Quality Release Gate
  evaluateQualityRelease: (manufacturingRecordId: string) => QualityReleaseEvaluation;
  executeQualityRelease: (manufacturingRecordId: string, notes?: string) => Promise<{ success: boolean; releaseId?: string; error?: string }>;

  // Explicit Component Fitment Traceability
  recordComponentFitment: (
    fitment: Omit<ComponentFitmentRecord, 'id' | 'fittedAt'>
  ) => Promise<{ success: boolean; fitment?: ComponentFitmentRecord; error?: string }>;
  removeComponentFitment: (fitmentId: string) => Promise<{ success: boolean; error?: string }>;

  // Settings & DB Management
  updateSettings: (newSettings: Partial<SystemSettings>) => Promise<boolean>;
  resetToDefaultData: () => Promise<{ success: boolean; error?: string }>;
  importDatabaseJson: (jsonString: string) => Promise<{ success: boolean; error?: string }>;
  refreshDatabase: () => Promise<void>;

  // Administrator Deletion & List Clearing Actions
  deleteMachine: (id: string) => Promise<{ success: boolean; error?: string }>;
  deleteProject: (id: string) => Promise<{ success: boolean; error?: string }>;
  deleteComponent: (id: string) => Promise<{ success: boolean; error?: string }>;
  deleteDrawing: (id: string) => Promise<{ success: boolean; error?: string }>;
  deleteDrawingPart: (
    drawingId: string,
    partItemIdOrPartNo: string
  ) => Promise<{ success: boolean; error?: string }>;
  clearDrawingPartsList: (drawingId: string) => Promise<{ success: boolean; error?: string }>;
  deleteManufacturingRecord: (id: string) => Promise<{ success: boolean; error?: string }>;
  deleteInspection: (id: string) => Promise<{ success: boolean; error?: string }>;
  deleteInspectionCharacteristic: (
    inspectionId: string,
    characteristicId: string
  ) => Promise<{ success: boolean; error?: string }>;
  deleteNCR: (id: string) => Promise<{ success: boolean; error?: string }>;
  deleteDeviation: (id: string) => Promise<{ success: boolean; error?: string }>;
  deleteRelease: (id: string) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (id: string) => Promise<{ success: boolean; error?: string }>;
  clearCollectionList: (
    collection:
      | 'projects'
      | 'machines'
      | 'components'
      | 'drawings'
      | 'manufacturingRecords'
      | 'inspections'
      | 'ncrs'
      | 'deviations'
      | 'releases'
      | 'auditLogs'
      | 'ALL_DATA'
  ) => Promise<{ success: boolean; error?: string }>;

  // Cross-Reference Navigation between Registers
  crossNavTarget: CrossNavigationTarget | null;
  navigateToCrossRef: (
    tab: CrossNavigationTarget['tab'],
    searchQuery?: string,
    recordId?: string
  ) => void;
  clearCrossNavTarget: () => void;
}

const QMSContext = createContext<QMSContextType | undefined>(undefined);

export const QMSProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [db, setDb] = useState<QMSDatabase>(() =>
    reconcileCrossPopulatedDatabase(INITIAL_DATABASE)
  );
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [currentUser, setCurrentUserState] = useState<User>(INITIAL_DATABASE.users[1]); // Sarah Connor (Inspector)
  const [activeWorkshopDepartment, setActiveWorkshopDepartment] = useState<WorkshopDepartment>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [crossNavTarget, setCrossNavTarget] = useState<CrossNavigationTarget | null>(null);

  const navigateToCrossRef = (
    tab: CrossNavigationTarget['tab'],
    searchQuery?: string,
    recordId?: string
  ) => {
    setCrossNavTarget({
      tab,
      searchQuery,
      recordId,
      timestamp: Date.now(),
    });
  };

  const clearCrossNavTarget = () => {
    setCrossNavTarget(null);
  };

  // Initial load & session verification
  useEffect(() => {
    async function loadInit() {
      setIsLoading(true);
      try {
        // 1. Verify existing session (no automatic login bypass)
        const session = await DBService.verifySession();
        if (session) {
          setAuthSession(session);
          setCurrentUserState(session.user);
          const loadedDb = await DBService.load();
          setDb(reconcileCrossPopulatedDatabase(loadedDb));
          setLastSynced(new Date());
        } else {
          setAuthSession(null);
        }
      } catch (err: any) {
        console.error('Initial DB load error:', err);
        setError('Failed to load database.');
      } finally {
        setIsLoading(false);
      }
    }
    loadInit();
  }, []);

  // Login with username/email & password
  const login = async (
    identifier: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    const res = await DBService.login(identifier, password);
    if (res.success && res.session) {
      setAuthSession(res.session);
      setCurrentUserState(res.session.user);
      setError(null);
      const freshDb = await DBService.load();
      setDb(reconcileCrossPopulatedDatabase(freshDb));
      return { success: true };
    }
    return { success: false, error: res.error || 'Invalid credentials' };
  };

  // Register a new operator login profile and sign in immediately
  const registerProfile = async (params: {
    username: string;
    name: string;
    email: string;
    role: UserRole;
    department: string;
    password: string;
  }): Promise<{ success: boolean; error?: string }> => {
    const res = await DBService.registerUserProfile(params);
    if (res.success && res.session) {
      setAuthSession(res.session);
      setCurrentUserState(res.session.user);
      setError(null);
      const freshDb = await DBService.load();
      setDb(reconcileCrossPopulatedDatabase(freshDb));
      return { success: true };
    }
    return { success: false, error: res.error || 'Failed to create login profile.' };
  };

  // Logout
  const logout = async (): Promise<void> => {
    await DBService.logout();
    setAuthSession(null);
    const freshDb = await DBService.load();
    setDb(reconcileCrossPopulatedDatabase(freshDb));
  };

  // Attempt to switch user without credentials — blocked in Production Mode
  const setCurrentUser = async (targetUser: User): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/switch-role', {
        method: 'POST',
        headers: DBService.getAuthHeaders(),
        body: JSON.stringify({ targetUserId: targetUser.id }),
      });
      const json = await res.json();
      if (res.ok && json.success && json.session) {
        DBService.setAuthSession(json.session);
        setAuthSession(json.session);
        setCurrentUserState(json.session.user);
        return { success: true };
      }
      return {
        success: false,
        error:
          json.error ||
          'Role switching is blocked in Production Mode. Please sign in with username and password.',
      };
    } catch (e: any) {
      return { success: false, error: e.message || 'Role switch failed' };
    }
  };

  // Helper to commit state change and sync to server with RBAC check
  const commitDbChange = async (
    newDb: QMSDatabase,
    action: string,
    details: {
      recordType: AuditLog['recordType'];
      recordId: string;
      previousValue?: string;
      newValue?: string;
      [key: string]: any;
    }
  ): Promise<{ ok: boolean; error?: string }> => {
    setIsSyncing(true);
    const prevDb = db;

    const auditEntry: AuditLog = {
      id: `AUD-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      userId: currentUser.id,
      user: currentUser.name,
      role: currentUser.role,
      action,
      recordType: details.recordType,
      recordId: details.recordId,
      details,
      previousValue: details.previousValue,
      newValue: details.newValue,
    };

    // If creating or updating records, clear any prior deletion tombstones for active records in newDb
    let nextDeletedKeys = [...(newDb.deletedRecordKeys || [])];
    if (action === 'RESET_TO_DEFAULTS') {
      nextDeletedKeys = [];
    } else if (!['ADMIN_DELETE_RECORD', 'ADMIN_CLEAR_LIST', 'ADMIN_CLEAR_ALL_DATA'].includes(action)) {
      const activeTombstonesToRemove = new Set<string>();
      if (action === 'CREATE_PROJECT' || action === 'UPDATE_PROJECT' || action === 'IMPORT_MACHINE_BOM_EXCEL') {
        activeTombstonesToRemove.add('LIST_CLEARED:PROJECTS');
        (newDb.projects || []).forEach((p) => {
          activeTombstonesToRemove.add(`PROJECT:${(p.id || '').trim().toUpperCase()}`);
          activeTombstonesToRemove.add(`PROJECT:${(p.projectNumber || '').trim().toUpperCase()}`);
        });
      }
      if (action === 'CREATE_MACHINE' || action === 'UPDATE_MACHINE' || action === 'IMPORT_MACHINE_BOM_EXCEL') {
        activeTombstonesToRemove.add('LIST_CLEARED:MACHINES');
        (newDb.machines || []).forEach((m) => {
          activeTombstonesToRemove.add(`MACHINE:${(m.id || '').trim().toUpperCase()}`);
          activeTombstonesToRemove.add(`MACHINE:${(m.serialNumber || '').trim().toUpperCase()}`);
        });
      }
      if (action === 'CREATE_COMPONENT' || action === 'UPDATE_COMPONENT' || action === 'IMPORT_MACHINE_BOM_EXCEL') {
        activeTombstonesToRemove.add('LIST_CLEARED:COMPONENTS');
        (newDb.components || []).forEach((c) => {
          activeTombstonesToRemove.add(`COMPONENT:${(c.id || '').trim().toUpperCase()}`);
          activeTombstonesToRemove.add(`COMPONENT:${(c.partNumber || '').trim().toUpperCase()}`);
        });
      }
      if (['CREATE_DRAWING', 'UPDATE_DRAWING', 'REVISE_DRAWING', 'APPROVE_DRAWING', 'IMPORT_MACHINE_BOM_EXCEL'].includes(action)) {
        activeTombstonesToRemove.add('LIST_CLEARED:DRAWINGS');
        (newDb.drawings || []).forEach((d) => {
          const dNo = (d.drawingNumber || '').trim().toUpperCase();
          const dRev = (d.revision || '0').trim().toUpperCase();
          activeTombstonesToRemove.add(`DRAWING:${(d.id || '').trim().toUpperCase()}`);
          activeTombstonesToRemove.add(`DRAWING:${dNo}`);
          activeTombstonesToRemove.add(`DRAWING:${dNo}::${dRev}`);
          if (d.partsList && d.partsList.length > 0) {
            activeTombstonesToRemove.add(`DRAWING_BOM_CLEARED:${dNo}`);
            d.partsList.forEach((pt) => {
              activeTombstonesToRemove.add(
                `DRAWING_PART:${dNo}::${(pt.partNumber || '').trim().toUpperCase()}`
              );
            });
          }
        });
      }
      if (action === 'CREATE_MANUFACTURING_RECORD') {
        activeTombstonesToRemove.add('LIST_CLEARED:MFG');
        (newDb.manufacturingRecords || []).forEach((r) => {
          activeTombstonesToRemove.add(`MFG:${(r.id || '').trim().toUpperCase()}`);
          activeTombstonesToRemove.add(`MFG:${(r.traceabilityNumber || '').trim().toUpperCase()}`);
        });
      }
      if (action === 'START_INSPECTION') {
        activeTombstonesToRemove.add('LIST_CLEARED:INSPECTIONS');
      }
      if (action === 'CREATE_NCR') {
        activeTombstonesToRemove.add('LIST_CLEARED:NCRS');
      }
      if (action === 'CREATE_DEVIATION') {
        activeTombstonesToRemove.add('LIST_CLEARED:DEVIATIONS');
      }
      if (action === 'QUALITY_RELEASE_EXECUTED') {
        activeTombstonesToRemove.add('LIST_CLEARED:RELEASES');
      }
      if (activeTombstonesToRemove.size > 0) {
        nextDeletedKeys = nextDeletedKeys.filter(
          (k) => !activeTombstonesToRemove.has((k || '').trim().toUpperCase())
        );
      }
    }

    const reconciledNewDb = reconcileCrossPopulatedDatabase({
      ...newDb,
      deletedRecordKeys: nextDeletedKeys,
    });

    const updatedDb: QMSDatabase = {
      ...reconciledNewDb,
      deletedRecordKeys: nextDeletedKeys,
      auditLogs: [auditEntry, ...(reconciledNewDb.auditLogs || [])],
      lastUpdated: new Date().toISOString(),
    };

    setDb(updatedDb);

    try {
      const result = await DBService.save(updatedDb, currentUser, action, details);
      if (result.ok) {
        setLastSynced(new Date());
        setError(null);
        return { ok: true };
      } else {
        // Revert optimistic update if server rejected due to RBAC / authorization
        setDb(prevDb);
        setError(result.error || 'Operation rejected by server');
        return { ok: false, error: result.error };
      }
    } catch (e: any) {
      setDb(prevDb);
      setError(e.message || 'Database sync error');
      return { ok: false, error: e.message };
    } finally {
      setIsSyncing(false);
    }
  };

  // Upload real attachment file to server
  const uploadAttachmentFile = async (params: {
    originalFilename: string;
    mimeType: string;
    base64Data: string;
    category: 'REDLINE' | 'DRAWING' | 'EVIDENCE';
    relatedRecordId?: string;
    drawingNumber?: string;
    revision?: string;
    caption?: string;
  }): Promise<{ success: boolean; attachment?: FileAttachmentMetadata; error?: string }> => {
    const res = await DBService.uploadAttachment(params);
    if (res.success && res.attachment) {
      setDb((prev) => ({
        ...prev,
        attachments: [
          res.attachment!,
          ...(prev.attachments || []).filter((a) => a.fileId !== res.attachment!.fileId),
        ],
      }));
    }
    return res;
  };

  // 1. Add Machine
  const addMachine = async (machineData: Omit<Machine, 'id' | 'dateCreated' | 'createdBy'>): Promise<boolean> => {
    if (db.machines.some((m) => m.serialNumber.trim().toUpperCase() === machineData.serialNumber.trim().toUpperCase())) {
      alert(`Machine Serial Number "${machineData.serialNumber}" already exists in the register!`);
      return false;
    }

    const newMachine: Machine = {
      ...machineData,
      id: `MCH-${Date.now().toString().slice(-6)}`,
      dateCreated: new Date().toISOString(),
      createdBy: currentUser.name,
    };

    const newDb: QMSDatabase = {
      ...db,
      machines: [newMachine, ...db.machines],
    };

    const res = await commitDbChange(newDb, 'CREATE_MACHINE', {
      recordType: 'MACHINE',
      recordId: newMachine.serialNumber,
      newValue: JSON.stringify(newMachine),
    });
    if (!res.ok && res.error) alert(res.error);
    return res.ok;
  };

  // 1b. Bulk Import Machines (from Excel / CSV)
  const importMachines = async (
    rows: Array<{
      serialNumber: string;
      machineType: string;
      customer: string;
      projectNumber: string;
      projectName: string;
      manufacturingStatus: Machine['manufacturingStatus'];
      assemblyStatus: Machine['assemblyStatus'];
      notes?: string;
    }>
  ): Promise<{ ok: boolean; importedCount: number; skippedCount: number; error?: string }> => {
    const existingSerials = new Set(db.machines.map((m) => m.serialNumber.trim().toUpperCase()));
    const added: Machine[] = [];
    let skippedCount = 0;

    rows.forEach((row, idx) => {
      const cleanSerial = (row.serialNumber || '').trim().toUpperCase();
      const cleanCustomer = (row.customer || '').trim();
      if (!cleanSerial || !cleanCustomer) {
        skippedCount++;
        return;
      }
      if (existingSerials.has(cleanSerial)) {
        skippedCount++;
        return;
      }
      existingSerials.add(cleanSerial);
      const mType = (row.machineType || 'DIVIDER').trim().toUpperCase();
      added.push({
        id: `MCH-${Date.now().toString().slice(-5)}-${String(idx + 1).padStart(2, '0')}`,
        serialNumber: cleanSerial,
        machineType: mType,
        customer: cleanCustomer,
        projectNumber: (row.projectNumber || 'PRJ-UNASSIGNED').trim().toUpperCase(),
        projectName: (row.projectName || `${mType} Build`).trim(),
        manufacturingStatus: row.manufacturingStatus || 'IN_PRODUCTION',
        assemblyStatus: row.assemblyStatus || 'NOT_STARTED',
        dateCreated: new Date().toISOString(),
        createdBy: currentUser.name,
        notes: row.notes?.trim() || '',
      });
    });

    if (added.length === 0) {
      return {
        ok: false,
        importedCount: 0,
        skippedCount,
        error: 'No new valid machines to import (all rows were either duplicate Serial Numbers or missing required fields).',
      };
    }

    const newDb: QMSDatabase = {
      ...db,
      machines: [...added, ...db.machines],
    };

    const res = await commitDbChange(newDb, 'CREATE_MACHINE', {
      recordType: 'MACHINE',
      recordId: added.map((m) => m.serialNumber).join(', '),
      newValue: JSON.stringify({ importedCount: added.length, machines: added.map((m) => m.serialNumber) }),
    });

    if (!res.ok) {
      return { ok: false, importedCount: 0, skippedCount, error: res.error };
    }
    return { ok: true, importedCount: added.length, skippedCount };
  };

  // 2. Update Machine
  const updateMachine = async (id: string, updates: Partial<Machine>): Promise<boolean> => {
    const existing = db.machines.find((m) => m.id === id);
    if (!existing) return false;

    const updatedMachine = { ...existing, ...updates };
    const newDb: QMSDatabase = {
      ...db,
      machines: db.machines.map((m) => (m.id === id ? updatedMachine : m)),
    };

    const res = await commitDbChange(newDb, 'UPDATE_MACHINE', {
      recordType: 'MACHINE',
      recordId: existing.serialNumber,
      previousValue: JSON.stringify(existing),
      newValue: JSON.stringify(updatedMachine),
    });
    if (!res.ok && res.error) alert(res.error);
    return res.ok;
  };

  // 3. Add Project
  const addProject = async (
    projectData: Omit<Project, 'id' | 'createdBy' | 'associatedSerialNumbers' | 'machineSerialNumbers'> & {
      associatedSerialNumbers?: string[];
      machineSerialNumbers?: string[];
    }
  ): Promise<boolean> => {
    if (db.projects.some((p) => p.projectNumber.trim().toUpperCase() === projectData.projectNumber.trim().toUpperCase())) {
      alert(`Project Number "${projectData.projectNumber}" already exists!`);
      return false;
    }

    const serials = projectData.machineSerialNumbers || projectData.associatedSerialNumbers || [];
    const newProject: Project = {
      ...projectData,
      associatedSerialNumbers: serials,
      machineSerialNumbers: serials,
      id: `PRJ-${Date.now().toString().slice(-6)}`,
      createdBy: currentUser.name,
    };

    const newDb: QMSDatabase = {
      ...db,
      projects: [newProject, ...db.projects],
    };

    const res = await commitDbChange(newDb, 'CREATE_PROJECT', {
      recordType: 'PROJECT',
      recordId: newProject.projectNumber,
      newValue: JSON.stringify(newProject),
    });
    if (!res.ok && res.error) alert(res.error);
    return res.ok;
  };

  // 3b. Bulk Import Projects (from Excel / CSV)
  const importProjects = async (
    rows: Array<{
      projectNumber: string;
      projectName: string;
      customer: string;
      machineType: string;
      machineSerialNumbers: string[];
      projectStatus: Project['projectStatus'];
      startDate: string;
      targetCompletionDate: string;
      notes?: string;
    }>
  ): Promise<{ ok: boolean; importedCount: number; skippedCount: number; error?: string }> => {
    const existingNums = new Set(db.projects.map((p) => p.projectNumber.trim().toUpperCase()));
    const added: Project[] = [];
    let skippedCount = 0;

    rows.forEach((row, idx) => {
      const cleanNum = row.projectNumber.trim().toUpperCase();
      if (!cleanNum || !row.projectName.trim() || !row.customer.trim()) {
        skippedCount++;
        return;
      }
      if (existingNums.has(cleanNum)) {
        skippedCount++;
        return;
      }
      existingNums.add(cleanNum);
      const serials = (row.machineSerialNumbers || []).map((s) => s.trim().toUpperCase()).filter(Boolean);
      added.push({
        id: `PRJ-${Date.now().toString().slice(-5)}-${String(idx + 1).padStart(2, '0')}`,
        projectNumber: cleanNum,
        projectName: row.projectName.trim(),
        customer: row.customer.trim(),
        machineType: (row.machineType || 'DIVIDER').trim().toUpperCase(),
        associatedSerialNumbers: serials,
        machineSerialNumbers: serials,
        projectStatus: row.projectStatus || 'ACTIVE',
        startDate: row.startDate || new Date().toISOString().split('T')[0],
        targetCompletionDate: row.targetCompletionDate || '2026-12-31',
        createdBy: currentUser.name,
        notes: row.notes?.trim() || '',
      });
    });

    if (added.length === 0) {
      return {
        ok: false,
        importedCount: 0,
        skippedCount,
        error: 'No new valid projects to import (all rows were either duplicate Project Numbers or missing required fields).',
      };
    }

    const newDb: QMSDatabase = {
      ...db,
      projects: [...added, ...db.projects],
    };

    const res = await commitDbChange(newDb, 'CREATE_PROJECT', {
      recordType: 'PROJECT',
      recordId: added.map((p) => p.projectNumber).join(', '),
      newValue: JSON.stringify({ importedCount: added.length, projects: added.map((p) => p.projectNumber) }),
    });

    if (!res.ok) {
      return { ok: false, importedCount: 0, skippedCount, error: res.error };
    }
    return { ok: true, importedCount: added.length, skippedCount };
  };

  // 4. Update Project
  const updateProject = async (id: string, updates: Partial<Project>): Promise<boolean> => {
    const existing = db.projects.find((p) => p.id === id);
    if (!existing) return false;

    const updatedProject = { ...existing, ...updates };
    const newDb: QMSDatabase = {
      ...db,
      projects: db.projects.map((p) => (p.id === id ? updatedProject : p)),
    };

    const res = await commitDbChange(newDb, 'UPDATE_PROJECT', {
      recordType: 'PROJECT',
      recordId: existing.projectNumber,
      previousValue: JSON.stringify(existing),
      newValue: JSON.stringify(updatedProject),
    });
    if (!res.ok && res.error) alert(res.error);
    return res.ok;
  };

  // 5. Add Component
  const addComponent = async (compData: Omit<Component, 'id' | 'createdDate'>): Promise<boolean> => {
    if (db.components.some((c) => c.partNumber.trim().toUpperCase() === compData.partNumber.trim().toUpperCase())) {
      alert(`Part Number "${compData.partNumber}" already exists in the Component Register!`);
      return false;
    }

    const newComp: Component = {
      ...compData,
      id: `CMP-${Date.now().toString().slice(-6)}`,
      createdDate: new Date().toISOString(),
    };

    const newDb: QMSDatabase = {
      ...db,
      components: [newComp, ...db.components],
    };

    const res = await commitDbChange(newDb, 'CREATE_COMPONENT', {
      recordType: 'COMPONENT',
      recordId: newComp.partNumber,
      isCritical: newComp.criticalComponent,
      drawing: newComp.drawingNumber,
      newValue: JSON.stringify(newComp),
    });
    if (!res.ok && res.error) alert(res.error);
    return res.ok;
  };

  // 5b. Bulk Import Components / Parts (from Excel / CSV)
  const importComponents = async (
    rows: Array<{
      partNumber: string;
      description: string;
      category: Component['category'];
      machineTypes: string[];
      defaultDrawingNumber: string;
      currentDrawingRevision: string;
      materialSpecification: string;
      criticalComponent: boolean;
      traceabilityRequired: boolean;
      permanentIdRequired: boolean;
      active?: boolean;
      notes?: string;
    }>
  ): Promise<{ ok: boolean; importedCount: number; skippedCount: number; error?: string }> => {
    const existingParts = new Set(db.components.map((c) => c.partNumber.trim().toUpperCase()));
    const added: Component[] = [];
    let skippedCount = 0;

    rows.forEach((row, idx) => {
      const cleanPart = (row.partNumber || '').trim().toUpperCase();
      const cleanDesc = (row.description || '').trim();
      if (!cleanPart || !cleanDesc) {
        skippedCount++;
        return;
      }
      if (existingParts.has(cleanPart)) {
        skippedCount++;
        return;
      }
      existingParts.add(cleanPart);
      const dwgNo = (row.defaultDrawingNumber || cleanPart).trim().toUpperCase();
      const rev = (row.currentDrawingRevision || '0').trim().toUpperCase();
      const mTypes =
        row.machineTypes && row.machineTypes.length > 0
          ? row.machineTypes.map((m) => m.trim().toUpperCase()).filter(Boolean)
          : ['DIVIDER'];

      added.push({
        id: `CMP-${Date.now().toString().slice(-5)}-${String(idx + 1).padStart(2, '0')}`,
        partNumber: cleanPart,
        description: cleanDesc,
        category: row.category || 'OTHER',
        machineTypes: mTypes,
        criticalComponent: Boolean(row.criticalComponent),
        defaultDrawingNumber: dwgNo,
        currentDrawingRevision: rev,
        drawingNumber: dwgNo,
        materialSpecification: (row.materialSpecification || 'AS PER DRAWING').trim(),
        traceabilityRequired: Boolean(row.traceabilityRequired),
        permanentIdRequired: Boolean(row.permanentIdRequired),
        active: row.active !== undefined ? row.active : true,
        createdDate: new Date().toISOString(),
        notes: row.notes?.trim() || '',
      });
    });

    if (added.length === 0) {
      return {
        ok: false,
        importedCount: 0,
        skippedCount,
        error: 'No new valid parts/components to import (all rows were either duplicate Part Numbers or missing required fields).',
      };
    }

    const newDb: QMSDatabase = {
      ...db,
      components: [...added, ...db.components],
    };

    const res = await commitDbChange(newDb, 'CREATE_COMPONENT', {
      recordType: 'COMPONENT',
      recordId: added.map((c) => c.partNumber).join(', '),
      newValue: JSON.stringify({ importedCount: added.length, parts: added.map((c) => c.partNumber) }),
    });

    if (!res.ok) {
      return { ok: false, importedCount: 0, skippedCount, error: res.error };
    }
    return { ok: true, importedCount: added.length, skippedCount };
  };

  // 6. Update Component
  const updateComponent = async (id: string, updates: Partial<Component>): Promise<boolean> => {
    const existing = db.components.find((c) => c.id === id);
    if (!existing) return false;

    const updatedComp = { ...existing, ...updates };
    const newDb: QMSDatabase = {
      ...db,
      components: db.components.map((c) => (c.id === id ? updatedComp : c)),
    };

    const res = await commitDbChange(newDb, 'UPDATE_COMPONENT', {
      recordType: 'COMPONENT',
      recordId: existing.partNumber,
      previousValue: JSON.stringify(existing),
      newValue: JSON.stringify(updatedComp),
    });
    if (!res.ok && res.error) alert(res.error);
    return res.ok;
  };

  // 7. Add Drawing
  const addDrawing = async (drawingData: Omit<Drawing, 'id'>): Promise<boolean> => {
    const duplicate = db.drawings.some(
      (d) =>
        d.drawingNumber.trim().toUpperCase() === drawingData.drawingNumber.trim().toUpperCase() &&
        d.revision.trim().toUpperCase() === drawingData.revision.trim().toUpperCase()
    );
    if (duplicate) {
      alert(`Drawing ${drawingData.drawingNumber} Revision ${drawingData.revision} already exists in register!`);
      return false;
    }

    const newDrawing: Drawing = {
      ...drawingData,
      id: `DWG-${Date.now().toString().slice(-6)}`,
    };

    let updatedDrawings = db.drawings;
    if (newDrawing.isCurrent) {
      updatedDrawings = updatedDrawings.map((d) =>
        d.drawingNumber.trim().toUpperCase() === newDrawing.drawingNumber.trim().toUpperCase()
          ? { ...d, isCurrent: false }
          : d
      );
    }

    // Automatically ensure all manually entered parts on the drawing exist in db.components
    const existingPartSet = new Set(db.components.map((c) => c.partNumber.trim().toUpperCase()));
    const newComponents: Component[] = [];
    const partsToSync =
      newDrawing.partsList && newDrawing.partsList.length > 0
        ? newDrawing.partsList
        : newDrawing.partNumber
        ? [
            {
              id: '1',
              itemNumber: '1',
              quantity: '1',
              partNumber: newDrawing.partNumber,
              description: newDrawing.drawingTitle,
              material: 'As per Drawing',
              designation: 'MANUF-INT',
            },
          ]
        : [];

    partsToSync.forEach((p, idx) => {
      const cleanPart = (p.partNumber || '').trim().toUpperCase();
      if (cleanPart && !existingPartSet.has(cleanPart)) {
        existingPartSet.add(cleanPart);
        newComponents.push({
          id: `CMP-${Date.now().toString().slice(-5)}-${idx + 1}`,
          partNumber: cleanPart,
          description: (p.description || newDrawing.drawingTitle || cleanPart).trim(),
          category: (p.designation || 'OTHER').trim(),
          machineTypes: ['DIVIDER'],
          criticalComponent: true,
          defaultDrawingNumber: newDrawing.drawingNumber.trim().toUpperCase(),
          currentDrawingRevision: newDrawing.revision.trim().toUpperCase(),
          drawingNumber: newDrawing.drawingNumber.trim().toUpperCase(),
          materialSpecification: (p.material || 'As per Drawing').trim(),
          traceabilityRequired: true,
          permanentIdRequired: true,
          active: true,
          createdDate: new Date().toISOString().split('T')[0],
          notes: `Registered via Drawing ${newDrawing.drawingNumber} Rev ${newDrawing.revision}`,
        });
      }
    });

    const newDb: QMSDatabase = {
      ...db,
      drawings: [newDrawing, ...updatedDrawings],
      components: [...newComponents, ...db.components],
    };

    const res = await commitDbChange(newDb, 'CREATE_DRAWING', {
      recordType: 'DRAWING',
      recordId: `${newDrawing.drawingNumber}-REV${newDrawing.revision}`,
      status: newDrawing.drawingStatus,
      newValue: JSON.stringify(newDrawing),
    });
    if (!res.ok && res.error) alert(res.error);
    return res.ok;
  };

  // 7b. Bulk Import Controlled Drawings (from Excel / CSV)
  const importDrawings = async (
    rows: Array<{
      drawingNumber: string;
      revision: string;
      drawingTitle: string;
      elementCode?: string;
      projectReference?: string;
      projectNumbers?: string[];
      machineSerialNumbers?: string[];
      drawingStatus?: DrawingStatus;
      effectiveDate?: string;
      revisionNotes?: string;
      scale?: string;
      sheetSize?: string;
      sheetNumber?: string;
      modelledBy?: string;
      detailedBy?: string;
      referenceDrawings?: string;
      partsList?: DrawingPartItem[];
    }>
  ): Promise<{
    ok: boolean;
    importedCount: number;
    updatedCount: number;
    skippedCount: number;
    error?: string;
  }> => {
    let workingDrawings = [...db.drawings];
    const existingPartSet = new Set(db.components.map((c) => c.partNumber.trim().toUpperCase()));
    const newComponents: Component[] = [];

    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    rows.forEach((row, idx) => {
      const cleanDwgNo = (row.drawingNumber || '').trim().toUpperCase();
      const cleanRev = (row.revision || '0').trim().toUpperCase();
      const cleanTitle = (row.drawingTitle || '').trim();

      if (!cleanDwgNo || !cleanTitle) {
        skippedCount++;
        return;
      }

      const incomingParts: DrawingPartItem[] =
        row.partsList && row.partsList.length > 0
          ? row.partsList
              .filter((p) => (p.partNumber || '').trim().length > 0)
              .map((p, pIdx) => ({
                id: p.id || `PT-IMP-${Date.now()}-${idx}-${pIdx}`,
                itemNumber: (p.itemNumber || String(pIdx + 1)).trim(),
                quantity: (p.quantity || '1').trim(),
                partNumber: p.partNumber.trim().toUpperCase(),
                description: (p.description || cleanTitle).trim(),
                material: (p.material || 'AS PER DRAWING').trim(),
                designation: (p.designation || 'MANUF-INT').trim().toUpperCase(),
                orderNumber: (p.orderNumber || '').trim(),
                vendor: (p.vendor || '').trim(),
              }))
          : [
              {
                id: `PT-IMP-${Date.now()}-${idx}-0`,
                itemNumber: '1',
                quantity: '1',
                partNumber: cleanDwgNo,
                description: cleanTitle,
                material: 'AS PER DRAWING',
                designation: 'MANUF-INT',
                orderNumber: '',
                vendor: '',
              },
            ];

      const existingIdx = workingDrawings.findIndex(
        (d) =>
          d.drawingNumber.trim().toUpperCase() === cleanDwgNo &&
          d.revision.trim().toUpperCase() === cleanRev
      );

      if (existingIdx !== -1) {
        const existingDwg = workingDrawings[existingIdx];
        const currentParts = existingDwg.partsList || [];
        const existingDwgPartNums = new Set(
          currentParts.map((p) => p.partNumber.trim().toUpperCase())
        );
        const additionalParts = incomingParts.filter(
          (p) => !existingDwgPartNums.has(p.partNumber.trim().toUpperCase())
        );

        const mergedProjNums = Array.from(
          new Set([...(existingDwg.projectNumbers || []), ...(row.projectNumbers || [])])
        );
        const mergedMachSns = Array.from(
          new Set([...(existingDwg.machineSerialNumbers || []), ...(row.machineSerialNumbers || [])])
        );

        if (
          additionalParts.length > 0 ||
          mergedProjNums.length > (existingDwg.projectNumbers || []).length ||
          mergedMachSns.length > (existingDwg.machineSerialNumbers || []).length
        ) {
          const mergedParts = [...currentParts, ...additionalParts].map((p, mIdx) => ({
            ...p,
            itemNumber: p.itemNumber || String(mIdx + 1),
          }));
          const mergedPartNums = mergedParts.map((p) => p.partNumber.trim().toUpperCase());
          workingDrawings[existingIdx] = {
            ...existingDwg,
            drawingTitle: cleanTitle || existingDwg.drawingTitle,
            elementCode: row.elementCode?.trim() || existingDwg.elementCode,
            projectReference: row.projectReference?.trim() || existingDwg.projectReference,
            projectNumbers: mergedProjNums,
            machineSerialNumbers: mergedMachSns,
            modelledBy: row.modelledBy?.trim() || existingDwg.modelledBy,
            detailedBy: row.detailedBy?.trim() || existingDwg.detailedBy,
            referenceDrawings: row.referenceDrawings?.trim() || existingDwg.referenceDrawings,
            partsList: mergedParts,
            partNumbers: mergedPartNums,
            partNumber: mergedPartNums.join('; '),
          };
          updatedCount++;
        } else {
          skippedCount++;
        }
      } else {
        // Demote previous current revisions of the same drawingNumber
        workingDrawings = workingDrawings.map((d) =>
          d.drawingNumber.trim().toUpperCase() === cleanDwgNo ? { ...d, isCurrent: false } : d
        );

        const partNums = incomingParts.map((p) => p.partNumber.trim().toUpperCase());
        const status: DrawingStatus = row.drawingStatus || 'APPROVED';
        const isApproved = status === 'APPROVED';
        const today = new Date().toISOString().split('T')[0];

        const newDwg: Drawing = {
          id: `DWG-${Date.now().toString().slice(-5)}-${String(idx + 1).padStart(3, '0')}`,
          drawingNumber: cleanDwgNo,
          drawingTitle: cleanTitle,
          partNumber: partNums.join('; '),
          partNumbers: partNums,
          partsList: incomingParts,
          revision: cleanRev,
          drawingStatus: status,
          isCurrent: status !== 'SUPERSEDED',
          approvedBy: isApproved ? currentUser.name : undefined,
          approvedById: isApproved ? currentUser.id : undefined,
          approvalDate: isApproved ? today : undefined,
          effectiveDate: row.effectiveDate || today,
          revisionNotes: row.revisionNotes?.trim() || 'ISSUED FOR MANUFACTURE.',
          projectReference: row.projectReference?.trim() || '',
          projectNumbers: row.projectNumbers || [],
          machineSerialNumbers: row.machineSerialNumbers || [],
          elementCode: row.elementCode?.trim() || '',
          scale: row.scale?.trim() || 'A.O.D.',
          sheetSize: row.sheetSize?.trim() || 'A3',
          sheetNumber: row.sheetNumber?.trim() || '1 / 1',
          modelledBy: row.modelledBy?.trim() || '',
          detailedBy: row.detailedBy?.trim() || '',
          referenceDrawings: row.referenceDrawings?.trim() || '',
        };

        workingDrawings = [newDwg, ...workingDrawings];
        importedCount++;
      }

      // Sync BOM parts into db.components if not present
      incomingParts.forEach((p, pIdx) => {
        const cleanPart = (p.partNumber || '').trim().toUpperCase();
        if (cleanPart && !existingPartSet.has(cleanPart)) {
          existingPartSet.add(cleanPart);
          newComponents.push({
            id: `CMP-${Date.now().toString().slice(-5)}-${idx + 1}-${pIdx + 1}`,
            partNumber: cleanPart,
            description: (p.description || cleanTitle || cleanPart).trim(),
            category: (p.designation || 'OTHER').trim() as Component['category'],
            machineTypes: ['DIVIDER'],
            criticalComponent: true,
            defaultDrawingNumber: cleanDwgNo,
            currentDrawingRevision: cleanRev,
            drawingNumber: cleanDwgNo,
            materialSpecification: (p.material || 'AS PER DRAWING').trim(),
            traceabilityRequired: true,
            permanentIdRequired: true,
            active: true,
            createdDate: new Date().toISOString().split('T')[0],
            projectNumbers: row.projectNumbers || [],
            machineSerialNumbers: row.machineSerialNumbers || [],
            quantityPerAssembly: p.quantity || '1',
            notes: `Registered via Drawing Import ${cleanDwgNo} Rev ${cleanRev}`,
          });
        }
      });
    });

    if (importedCount === 0 && updatedCount === 0) {
      return {
        ok: false,
        importedCount: 0,
        updatedCount: 0,
        skippedCount,
        error:
          'No new drawings or BOM parts to import (all rows were either duplicate Drawing + Revision records or missing required Drawing Number / Title).',
      };
    }

    const newDb: QMSDatabase = {
      ...db,
      drawings: workingDrawings,
      components: [...newComponents, ...db.components],
    };

    const res = await commitDbChange(newDb, 'CREATE_DRAWING', {
      recordType: 'DRAWING',
      recordId: `BULK-IMPORT-${importedCount}-NEW-${updatedCount}-UPDATED`,
      newValue: JSON.stringify({ importedCount, updatedCount, skippedCount }),
    });

    if (!res.ok) {
      return { ok: false, importedCount: 0, updatedCount: 0, skippedCount, error: res.error };
    }
    return { ok: true, importedCount, updatedCount, skippedCount };
  };

  // 7c. Atomic Per-Machine Full BOM, Drawings & Components Package Import (from CAD / Inventor Excel)
  const importMachineBomPackage = async (payload: {
    machineSerialNumber: string;
    machineType: string;
    customer?: string;
    projectNumber: string;
    projectName: string;
    elementCode?: string;
    modelledBy?: string;
    detailedBy?: string;
    drawings: Array<{
      drawingNumber: string;
      revision: string;
      drawingTitle: string;
      elementCode?: string;
      projectReference?: string;
      projectNumbers?: string[];
      machineSerialNumbers?: string[];
      drawingStatus?: DrawingStatus;
      effectiveDate?: string;
      revisionNotes?: string;
      modelledBy?: string;
      detailedBy?: string;
      referenceDrawings?: string;
      partsList?: DrawingPartItem[];
    }>;
    components: Array<{
      partNumber: string;
      description: string;
      category: string;
      machineTypes: string[];
      defaultDrawingNumber: string;
      currentDrawingRevision: string;
      materialSpecification: string;
      criticalComponent: boolean;
      traceabilityRequired: boolean;
      permanentIdRequired: boolean;
      active?: boolean;
      projectNumbers?: string[];
      machineSerialNumbers?: string[];
      quantityPerAssembly?: string;
      notes?: string;
    }>;
  }) => {
    const cleanSn = (payload.machineSerialNumber || '').trim().toUpperCase();
    const cleanMType = (payload.machineType || 'DIVIDER').trim().toUpperCase();
    const cleanPNum = (payload.projectNumber || 'T0559-058').trim().toUpperCase();
    const cleanPName = (payload.projectName || `${cleanPNum} ${cleanMType}`).trim();
    const cleanCustomer = (payload.customer || 'Spiral Systems / Dale Automation').trim();
    const today = new Date().toISOString().split('T')[0];

    if (!cleanSn) {
      return {
        ok: false,
        drawingsImported: 0,
        drawingsUpdated: 0,
        componentsImported: 0,
        componentsUpdated: 0,
        machineSerialNumber: '',
        projectNumber: cleanPNum,
        error: 'Machine Serial Number is required to import a Machine BOM Excel package.',
      };
    }

    const allDrawingNums = Array.from(
      new Set(payload.drawings.map((d) => d.drawingNumber.trim().toUpperCase()).filter(Boolean))
    );
    const allPartNums = Array.from(
      new Set(payload.components.map((c) => c.partNumber.trim().toUpperCase()).filter(Boolean))
    );

    // 1. Upsert Machine
    let workingMachines = [...db.machines];
    const machIdx = workingMachines.findIndex(
      (m) => m.serialNumber.trim().toUpperCase() === cleanSn
    );
    if (machIdx !== -1) {
      const existingM = workingMachines[machIdx];
      workingMachines[machIdx] = {
        ...existingM,
        machineType: cleanMType || existingM.machineType,
        projectNumber: cleanPNum || existingM.projectNumber,
        projectName: cleanPName || existingM.projectName,
        allocatedDrawingNumbers: Array.from(
          new Set([...(existingM.allocatedDrawingNumbers || []), ...allDrawingNums])
        ),
        allocatedPartNumbers: Array.from(
          new Set([...(existingM.allocatedPartNumbers || []), ...allPartNums])
        ),
      };
    } else {
      workingMachines = [
        {
          id: `MCH-${Date.now().toString().slice(-6)}`,
          serialNumber: cleanSn,
          machineType: cleanMType,
          customer: cleanCustomer,
          projectNumber: cleanPNum,
          projectName: cleanPName,
          manufacturingStatus: 'IN_PRODUCTION',
          assemblyStatus: 'SUB_ASSEMBLY',
          dateCreated: new Date().toISOString(),
          createdBy: currentUser.name,
          allocatedDrawingNumbers: allDrawingNums,
          allocatedPartNumbers: allPartNums,
          notes: `Imported from Machine BOM Excel (${allDrawingNums.length} drawings, ${allPartNums.length} parts)`,
        },
        ...workingMachines,
      ];
    }

    // 2. Upsert Project
    let workingProjects = [...db.projects];
    const projIdx = workingProjects.findIndex(
      (p) => p.projectNumber.trim().toUpperCase() === cleanPNum
    );
    if (projIdx !== -1) {
      const existingP = workingProjects[projIdx];
      const mergedSns = Array.from(
        new Set([
          ...(existingP.associatedSerialNumbers || []),
          ...(existingP.machineSerialNumbers || []),
          cleanSn,
        ])
      );
      workingProjects[projIdx] = {
        ...existingP,
        projectName: cleanPName || existingP.projectName,
        associatedSerialNumbers: mergedSns,
        machineSerialNumbers: mergedSns,
        allocatedDrawingNumbers: Array.from(
          new Set([...(existingP.allocatedDrawingNumbers || []), ...allDrawingNums])
        ),
        allocatedPartNumbers: Array.from(
          new Set([...(existingP.allocatedPartNumbers || []), ...allPartNums])
        ),
      };
    } else {
      workingProjects = [
        {
          id: `PRJ-${Date.now().toString().slice(-6)}`,
          projectNumber: cleanPNum,
          projectName: cleanPName,
          customer: cleanCustomer,
          machineType: cleanMType,
          associatedSerialNumbers: [cleanSn],
          machineSerialNumbers: [cleanSn],
          allocatedDrawingNumbers: allDrawingNums,
          allocatedPartNumbers: allPartNums,
          projectStatus: 'ACTIVE',
          startDate: today,
          targetCompletionDate: '2026-12-31',
          createdBy: currentUser.name,
          notes: `Created from Machine BOM Excel Import (${cleanSn})`,
        },
        ...workingProjects,
      ];
    }

    // 3. Upsert Drawings
    let workingDrawings = [...db.drawings];
    const dwgIndexByKey = new Map<string, number>();
    workingDrawings.forEach((d, idx) => {
      dwgIndexByKey.set(
        `${d.drawingNumber.trim().toUpperCase()}::${d.revision.trim().toUpperCase()}`,
        idx
      );
    });

    let drawingsImported = 0;
    let drawingsUpdated = 0;

    payload.drawings.forEach((row, idx) => {
      const cleanDwgNo = (row.drawingNumber || '').trim().toUpperCase();
      const cleanRev = (row.revision || '0').trim().toUpperCase();
      const cleanTitle = (row.drawingTitle || cleanDwgNo).trim();
      if (!cleanDwgNo) return;

      const incomingParts: DrawingPartItem[] = (row.partsList || []).map((p, pIdx) => ({
        id: p.id || `PT-MBOM-${idx}-${pIdx}`,
        itemNumber: (p.itemNumber || String(pIdx + 1)).trim(),
        quantity: (p.quantity || '1').trim(),
        partNumber: (p.partNumber || cleanDwgNo).trim().toUpperCase(),
        description: (p.description || cleanTitle).trim(),
        material: (p.material || 'AS PER DRAWING').trim(),
        designation: (p.designation || 'MANUF-INT').trim().toUpperCase(),
        orderNumber: (p.orderNumber || '').trim(),
        vendor: (p.vendor || '').trim(),
      }));

      const key = `${cleanDwgNo}::${cleanRev}`;
      const existingIdx = dwgIndexByKey.get(key);

      if (existingIdx !== undefined) {
        const existingDwg = workingDrawings[existingIdx];
        const currentParts = existingDwg.partsList || [];
        const seenPartNums = new Set(currentParts.map((p) => p.partNumber.trim().toUpperCase()));
        const mergedParts = [...currentParts];
        incomingParts.forEach((pt) => {
          if (!seenPartNums.has(pt.partNumber)) {
            seenPartNums.add(pt.partNumber);
            mergedParts.push(pt);
          }
        });
        const mergedPartNums = mergedParts.map((p) => p.partNumber.trim().toUpperCase());

        workingDrawings[existingIdx] = {
          ...existingDwg,
          drawingTitle: cleanTitle || existingDwg.drawingTitle,
          elementCode: row.elementCode || payload.elementCode || existingDwg.elementCode,
          projectReference:
            row.projectReference || `${cleanPNum} — ${cleanPName}` || existingDwg.projectReference,
          projectNumbers: Array.from(
            new Set([...(existingDwg.projectNumbers || []), cleanPNum])
          ),
          machineSerialNumbers: Array.from(
            new Set([...(existingDwg.machineSerialNumbers || []), cleanSn])
          ),
          modelledBy: row.modelledBy || payload.modelledBy || existingDwg.modelledBy,
          detailedBy: row.detailedBy || payload.detailedBy || existingDwg.detailedBy,
          referenceDrawings: row.referenceDrawings || existingDwg.referenceDrawings,
          revisionNotes: row.revisionNotes || existingDwg.revisionNotes,
          partsList: mergedParts,
          partNumbers: mergedPartNums,
          partNumber: mergedPartNums.join('; '),
        };
        drawingsUpdated++;
      } else {
        const partNums = incomingParts.map((p) => p.partNumber.trim().toUpperCase());
        const status: DrawingStatus = row.drawingStatus || 'APPROVED';
        const newDwg: Drawing = {
          id: `DWG-MBOM-${Date.now().toString().slice(-4)}-${String(idx + 1).padStart(4, '0')}`,
          drawingNumber: cleanDwgNo,
          drawingTitle: cleanTitle,
          partNumber: partNums.join('; '),
          partNumbers: partNums,
          partsList: incomingParts,
          revision: cleanRev,
          drawingStatus: status,
          isCurrent: true,
          approvedBy: currentUser.name,
          approvedById: currentUser.id,
          approvalDate: today,
          effectiveDate: row.effectiveDate || today,
          revisionNotes: row.revisionNotes || 'ISSUED FOR MANUFACTURE.',
          projectReference: row.projectReference || `${cleanPNum} — ${cleanPName}`,
          projectNumbers: [cleanPNum],
          machineSerialNumbers: [cleanSn],
          elementCode: row.elementCode || payload.elementCode || '719',
          scale: 'A.O.D.',
          sheetSize: 'A3',
          sheetNumber: '1 / 1',
          modelledBy: row.modelledBy || payload.modelledBy || '',
          detailedBy: row.detailedBy || payload.detailedBy || '',
          referenceDrawings: row.referenceDrawings || '',
        };
        dwgIndexByKey.set(key, workingDrawings.length);
        workingDrawings.push(newDwg);
        drawingsImported++;
      }
    });

    // 4. Upsert Components
    let workingComponents = [...db.components];
    const compIndexByPart = new Map<string, number>();
    workingComponents.forEach((c, idx) => {
      compIndexByPart.set(c.partNumber.trim().toUpperCase(), idx);
    });

    let componentsImported = 0;
    let componentsUpdated = 0;

    payload.components.forEach((row, idx) => {
      const cleanPart = (row.partNumber || '').trim().toUpperCase();
      if (!cleanPart) return;

      const existingIdx = compIndexByPart.get(cleanPart);
      if (existingIdx !== undefined) {
        const existingComp = workingComponents[existingIdx];
        workingComponents[existingIdx] = {
          ...existingComp,
          description: row.description || existingComp.description,
          category: row.category || existingComp.category,
          materialSpecification:
            row.materialSpecification || existingComp.materialSpecification,
          defaultDrawingNumber:
            row.defaultDrawingNumber || existingComp.defaultDrawingNumber,
          drawingNumber: row.defaultDrawingNumber || existingComp.drawingNumber,
          currentDrawingRevision:
            row.currentDrawingRevision || existingComp.currentDrawingRevision,
          quantityPerAssembly:
            row.quantityPerAssembly || existingComp.quantityPerAssembly,
          machineTypes: Array.from(
            new Set([...(existingComp.machineTypes || []), cleanMType])
          ),
          projectNumbers: Array.from(
            new Set([...(existingComp.projectNumbers || []), cleanPNum])
          ),
          machineSerialNumbers: Array.from(
            new Set([...(existingComp.machineSerialNumbers || []), cleanSn])
          ),
          notes: row.notes || existingComp.notes,
        };
        componentsUpdated++;
      } else {
        const newComp: Component = {
          id: `CMP-MBOM-${Date.now().toString().slice(-4)}-${String(idx + 1).padStart(4, '0')}`,
          partNumber: cleanPart,
          description: (row.description || cleanPart).trim(),
          category: row.category || 'MANUF-INT',
          machineTypes: [cleanMType],
          criticalComponent: row.criticalComponent,
          defaultDrawingNumber: (row.defaultDrawingNumber || cleanPart).trim().toUpperCase(),
          currentDrawingRevision: (row.currentDrawingRevision || '0').trim().toUpperCase(),
          drawingNumber: (row.defaultDrawingNumber || cleanPart).trim().toUpperCase(),
          materialSpecification: (row.materialSpecification || 'AS PER DRAWING').trim(),
          traceabilityRequired: row.traceabilityRequired,
          permanentIdRequired: row.permanentIdRequired,
          active: true,
          createdDate: today,
          projectNumbers: [cleanPNum],
          machineSerialNumbers: [cleanSn],
          quantityPerAssembly: row.quantityPerAssembly || '1',
          notes: row.notes || '',
        };
        compIndexByPart.set(cleanPart, workingComponents.length);
        workingComponents.push(newComp);
        componentsImported++;
      }
    });

    const newDb: QMSDatabase = {
      ...db,
      machines: workingMachines,
      projects: workingProjects,
      drawings: workingDrawings,
      components: workingComponents,
    };

    const res = await commitDbChange(newDb, 'IMPORT_MACHINE_BOM_EXCEL', {
      recordType: 'MACHINE',
      recordId: cleanSn,
      newValue: JSON.stringify({
        machineSerialNumber: cleanSn,
        projectNumber: cleanPNum,
        drawingsImported,
        drawingsUpdated,
        componentsImported,
        componentsUpdated,
      }),
    });

    if (!res.ok) {
      return {
        ok: false,
        drawingsImported: 0,
        drawingsUpdated: 0,
        componentsImported: 0,
        componentsUpdated: 0,
        machineSerialNumber: cleanSn,
        projectNumber: cleanPNum,
        error: res.error,
      };
    }

    return {
      ok: true,
      drawingsImported,
      drawingsUpdated,
      componentsImported,
      componentsUpdated,
      machineSerialNumber: cleanSn,
      projectNumber: cleanPNum,
    };
  };

  // 8. Update Drawing
  const updateDrawing = async (id: string, updates: Partial<Drawing>): Promise<boolean> => {
    const existing = db.drawings.find((d) => d.id === id);
    if (!existing) return false;

    const updated = { ...existing, ...updates };

    const existingPartSet = new Set(db.components.map((c) => c.partNumber.trim().toUpperCase()));
    const newComponents: Component[] = [];
    (updated.partsList || []).forEach((p, idx) => {
      const cleanPart = (p.partNumber || '').trim().toUpperCase();
      if (cleanPart && !existingPartSet.has(cleanPart)) {
        existingPartSet.add(cleanPart);
        newComponents.push({
          id: `CMP-${Date.now().toString().slice(-5)}-${idx + 1}`,
          partNumber: cleanPart,
          description: (p.description || updated.drawingTitle || cleanPart).trim(),
          category: (p.designation || 'OTHER').trim(),
          machineTypes: ['DIVIDER'],
          criticalComponent: true,
          defaultDrawingNumber: updated.drawingNumber.trim().toUpperCase(),
          currentDrawingRevision: updated.revision.trim().toUpperCase(),
          drawingNumber: updated.drawingNumber.trim().toUpperCase(),
          materialSpecification: (p.material || 'As per Drawing').trim(),
          traceabilityRequired: true,
          permanentIdRequired: true,
          active: true,
          createdDate: new Date().toISOString().split('T')[0],
          notes: `Registered via Drawing ${updated.drawingNumber} Rev ${updated.revision}`,
        });
      }
    });

    const newDb: QMSDatabase = {
      ...db,
      drawings: db.drawings.map((d) => (d.id === id ? updated : d)),
      components: [...newComponents, ...db.components],
    };

    const action = updates.drawingStatus === 'APPROVED' ? 'APPROVE_DRAWING' : 'UPDATE_DRAWING';
    const res = await commitDbChange(newDb, action, {
      recordType: 'DRAWING',
      recordId: `${existing.drawingNumber}-REV${existing.revision}`,
      previousValue: JSON.stringify(existing),
      newValue: JSON.stringify(updated),
    });
    if (!res.ok && res.error) alert(res.error);
    return res.ok;
  };

  // 9. Create New Drawing Revision (Preserves historical records & snapshots, supports PDF and Image/Photo prints & revisionPhotos)
  const createDrawingRevision = async (
    existingDrawingId: string,
    newRevision: string,
    changeNotes: string,
    drawingFile?: FileAttachmentMetadata,
    revisionOverrides?: {
      revisionPhotos?: FileAttachmentMetadata[];
      partsList?: DrawingPartItem[];
      effectiveDate?: string;
      drawingStatus?: DrawingStatus;
      drawingTitle?: string;
      elementCode?: string;
      projectReference?: string;
      scale?: string;
      sheetSize?: string;
      sheetNumber?: string;
      modelledBy?: string;
      modelledDate?: string;
      detailedBy?: string;
      detailedDate?: string;
      referenceDrawings?: string;
    }
  ): Promise<boolean> => {
    const baseDrawing = db.drawings.find((d) => d.id === existingDrawingId);
    if (!baseDrawing) return false;

    const exists = db.drawings.some(
      (d) =>
        d.drawingNumber.toUpperCase() === baseDrawing.drawingNumber.toUpperCase() &&
        d.revision.toUpperCase() === newRevision.toUpperCase()
    );
    if (exists) {
      alert(`Revision "${newRevision}" already exists for drawing ${baseDrawing.drawingNumber}!`);
      return false;
    }

    // Mark previous drawing revision as SUPERSEDED (historical manufacturing records retain their drawingSnapshot)
    const updatedDrawings = db.drawings.map((d) => {
      if (d.drawingNumber.toUpperCase() === baseDrawing.drawingNumber.toUpperCase()) {
        return {
          ...d,
          isCurrent: false,
          drawingStatus: d.drawingStatus === 'APPROVED' ? ('SUPERSEDED' as const) : d.drawingStatus,
        };
      }
      return d;
    });

    const nextPartsList =
      revisionOverrides?.partsList && revisionOverrides.partsList.length > 0
        ? revisionOverrides.partsList
        : baseDrawing.partsList;
    const nextPartNumbers =
      nextPartsList && nextPartsList.length > 0
        ? nextPartsList.map((p) => p.partNumber.trim().toUpperCase()).filter(Boolean)
        : baseDrawing.partNumbers;
    const nextPartNumber =
      nextPartNumbers && nextPartNumbers.length > 0
        ? nextPartNumbers.join('; ')
        : baseDrawing.partNumber;

    const targetStatus: DrawingStatus = revisionOverrides?.drawingStatus || 'APPROVED';
    const isApproved = targetStatus === 'APPROVED';

    const newRevDrawing: Drawing = {
      ...baseDrawing,
      id: `DWG-${Date.now().toString().slice(-6)}`,
      drawingNumber: baseDrawing.drawingNumber,
      drawingTitle: revisionOverrides?.drawingTitle?.trim() || baseDrawing.drawingTitle,
      elementCode: revisionOverrides?.elementCode !== undefined ? revisionOverrides.elementCode : baseDrawing.elementCode,
      projectReference: revisionOverrides?.projectReference !== undefined ? revisionOverrides.projectReference : baseDrawing.projectReference,
      scale: revisionOverrides?.scale || baseDrawing.scale,
      sheetSize: revisionOverrides?.sheetSize || baseDrawing.sheetSize,
      sheetNumber: revisionOverrides?.sheetNumber || baseDrawing.sheetNumber,
      modelledBy: revisionOverrides?.modelledBy || baseDrawing.modelledBy,
      modelledDate: revisionOverrides?.modelledDate || baseDrawing.modelledDate,
      detailedBy: revisionOverrides?.detailedBy || baseDrawing.detailedBy,
      detailedDate: revisionOverrides?.detailedDate || baseDrawing.detailedDate,
      referenceDrawings: revisionOverrides?.referenceDrawings || baseDrawing.referenceDrawings,
      partNumber: nextPartNumber,
      partNumbers: nextPartNumbers,
      partsList: nextPartsList,
      revision: newRevision.toUpperCase(),
      drawingStatus: targetStatus,
      approvedBy: isApproved ? currentUser.name : undefined,
      approvedById: isApproved ? currentUser.id : undefined,
      approvalDate: isApproved ? new Date().toISOString().split('T')[0] : undefined,
      effectiveDate: revisionOverrides?.effectiveDate || new Date().toISOString().split('T')[0],
      revisionNotes: changeNotes,
      previousRevision: baseDrawing.revision,
      fileName: drawingFile?.originalFilename || baseDrawing.fileName,
      drawingFile: drawingFile || baseDrawing.drawingFile,
      revisionPhotos: revisionOverrides?.revisionPhotos || [],
      isCurrent: true,
    };

    // Sync any newly added manual parts on this revision into db.components
    const existingPartSet = new Set(db.components.map((c) => c.partNumber.trim().toUpperCase()));
    const newComponents: Component[] = [];
    (nextPartsList || []).forEach((p, idx) => {
      const cleanPn = p.partNumber.trim().toUpperCase();
      if (cleanPn && !existingPartSet.has(cleanPn)) {
        existingPartSet.add(cleanPn);
        newComponents.push({
          id: `CMP-${Date.now().toString().slice(-5)}-${idx + 1}`,
          partNumber: cleanPn,
          description: p.description?.trim() || newRevDrawing.drawingTitle,
          category: (p.designation || 'OTHER').trim(),
          machineTypes: ['DIVIDER'],
          criticalComponent: true,
          defaultDrawingNumber: newRevDrawing.drawingNumber.trim().toUpperCase(),
          currentDrawingRevision: newRevDrawing.revision.trim().toUpperCase(),
          drawingNumber: newRevDrawing.drawingNumber.trim().toUpperCase(),
          materialSpecification: (p.material || 'As per Drawing').trim(),
          traceabilityRequired: true,
          permanentIdRequired: true,
          active: true,
          createdDate: new Date().toISOString().split('T')[0],
          notes: `Registered via Drawing ${newRevDrawing.drawingNumber} Rev ${newRevDrawing.revision}`,
        });
      }
    });

    const newDb: QMSDatabase = {
      ...db,
      drawings: [newRevDrawing, ...updatedDrawings],
      components: [...newComponents, ...db.components],
    };

    const res = await commitDbChange(newDb, 'REVISE_DRAWING', {
      recordType: 'DRAWING',
      recordId: `${baseDrawing.drawingNumber}-REV${newRevision}`,
      previousRevision: baseDrawing.revision,
      newRevision: newRevision,
      changeNotes,
      previousValue: JSON.stringify(baseDrawing),
      newValue: JSON.stringify(newRevDrawing),
    });
    if (!res.ok && res.error) alert(res.error);
    return res.ok;
  };

  // 10. Add Manufacturing Record
  // Enforces:
  // - Part Number exists & is active in Component Register (Requirement 6)
  // - Quantity > 0 (Requirement 7)
  // - Drawing is APPROVED at manufacture and stores DrawingSnapshotAtManufacture (Requirement 3)
  // - Supports AWAITING_IDENTIFICATION -> AWAITING_INSPECTION workflow (Requirement 4)
  const addManufacturingRecord = async (
    recordData: Omit<ManufacturingRecord, 'id' | 'traceabilityNumber' | 'createdBy' | 'createdDate' | 'manufacturingStatus'>
  ): Promise<{ success: boolean; traceabilityNumber?: string; error?: string }> => {
    // 1. Validate Part Number against Component Register
    const matchedComponent = db.components.find(
      (c) => c.partNumber.trim().toUpperCase() === recordData.partNumber.trim().toUpperCase()
    );
    if (!matchedComponent) {
      return {
        success: false,
        error: `INVALID PART NUMBER: Part '${recordData.partNumber}' does not exist in the Component Register.`,
      };
    }
    if (!matchedComponent.active) {
      return {
        success: false,
        error: `INACTIVE PART NUMBER: Part '${recordData.partNumber}' is marked inactive in the Component Register.`,
      };
    }

    // 2. Validate Quantity > 0
    if (
      typeof recordData.quantity !== 'number' ||
      isNaN(recordData.quantity) ||
      !Number.isFinite(recordData.quantity) ||
      recordData.quantity <= 0
    ) {
      return {
        success: false,
        error: `INVALID QUANTITY (${recordData.quantity}): Quantity must be a valid positive number (> 0).`,
      };
    }

    // 3. Verify APPROVED drawing at time of manufacture
    const matchedDrawing = db.drawings.find(
      (d) =>
        d.drawingNumber.trim().toUpperCase() === recordData.drawingNumber.trim().toUpperCase() &&
        d.revision.trim().toUpperCase() === recordData.drawingRevision.trim().toUpperCase()
    );

    if (db.settings.strictDrawingApproval || matchedComponent.criticalComponent) {
      const validation = DBService.validateDrawingForManufacturing(matchedDrawing);
      if (!validation.valid) {
        return { success: false, error: validation.reason };
      }
    }

    // 4. Generate unique traceability number
    const machine = db.machines.find((m) => m.serialNumber === recordData.machineSerialNumber);
    const machineType = machine ? machine.machineType : 'DIVIDER';
    const { number: traceabilityNumber, nextCounter } = DBService.generateTraceabilityNumber(db, machineType);

    // 5. Capture immutable Drawing Snapshot at time of manufacture
    const drawingSnapshot = matchedDrawing
      ? {
          drawingId: matchedDrawing.id,
          drawingNumber: matchedDrawing.drawingNumber,
          drawingRevision: matchedDrawing.revision,
          approvalStatusAtManufacture: matchedDrawing.drawingStatus,
          drawingApprovalDate: matchedDrawing.approvalDate,
          drawingEffectiveDate: matchedDrawing.effectiveDate,
          drawingApprovedBy: matchedDrawing.approvedBy,
          drawingFileId: matchedDrawing.drawingFile?.fileId,
          capturedAt: new Date().toISOString(),
        }
      : undefined;

    // 6. Determine initial status based on permanentIdRequired and permanentIdCompleted
    const initialStatus =
      matchedComponent.permanentIdRequired && !recordData.permanentIdCompleted
        ? 'AWAITING_IDENTIFICATION'
        : 'AWAITING_INSPECTION';

    const resolvedMachinistUser =
      currentUser.role === 'MACHINIST'
        ? currentUser
        : db.users.find((u) => u.id === recordData.machinistId) || currentUser;

    const newRecord: ManufacturingRecord = {
      ...recordData,
      id: `MR-${Date.now().toString().slice(-6)}`,
      traceabilityNumber,
      componentDescription: matchedComponent.description,
      machinist: resolvedMachinistUser.name,
      machinistId: resolvedMachinistUser.id,
      drawingSnapshot,
      manufacturingStatus: initialStatus,
      createdBy: currentUser.name,
      createdById: currentUser.id,
      createdDate: new Date().toISOString(),
    };

    const newDb: QMSDatabase = {
      ...db,
      manufacturingRecords: [newRecord, ...db.manufacturingRecords],
      settings: {
        ...db.settings,
        traceabilityCounter: nextCounter,
      },
    };

    const res = await commitDbChange(newDb, 'CREATE_MANUFACTURING_RECORD', {
      recordType: 'MANUFACTURING_RECORD',
      recordId: traceabilityNumber,
      machineSerial: newRecord.machineSerialNumber,
      partNumber: newRecord.partNumber,
      drawing: `${newRecord.drawingNumber} Rev ${newRecord.drawingRevision}`,
      status: initialStatus,
      newValue: JSON.stringify(newRecord),
    });

    if (res.ok) {
      return { success: true, traceabilityNumber };
    }
    return { success: false, error: res.error || 'Database commit failed.' };
  };

  // 11. Update Manufacturing Record
  const updateManufacturingRecord = async (id: string, updates: Partial<ManufacturingRecord>): Promise<boolean> => {
    const existing = db.manufacturingRecords.find((r) => r.id === id);
    if (!existing) return false;

    if (updates.manufacturingStatus === 'RELEASED') {
      alert(
        'RELEASE FORBIDDEN: Direct status change to "RELEASED" is blocked. Components may only be released via the 18-point Quality Release Gate.'
      );
      return false;
    }

    const updatedRecord = { ...existing, ...updates };
    const newDb: QMSDatabase = {
      ...db,
      manufacturingRecords: db.manufacturingRecords.map((r) => (r.id === id ? updatedRecord : r)),
    };

    const res = await commitDbChange(newDb, 'UPDATE_MANUFACTURING_RECORD', {
      recordType: 'MANUFACTURING_RECORD',
      recordId: existing.traceabilityNumber,
      previousValue: JSON.stringify(existing),
      newValue: JSON.stringify(updatedRecord),
    });
    if (!res.ok && res.error) alert(res.error);
    return res.ok;
  };

  // Requirement 4: Complete Component Permanent Identification Workflow
  const completePermanentIdentification = async (
    manufacturingRecordId: string,
    params: {
      method: PermanentIdMethod;
      reference: string;
      date?: string;
      completedBy?: string;
    }
  ): Promise<{ success: boolean; error?: string }> => {
    const existing = db.manufacturingRecords.find((r) => r.id === manufacturingRecordId);
    if (!existing) {
      return { success: false, error: 'Manufacturing record not found.' };
    }
    if (!params.reference || !params.reference.trim()) {
      return { success: false, error: 'Identification Reference (marking string) is required.' };
    }

    const nextStatus =
      existing.manufacturingStatus === 'AWAITING_IDENTIFICATION'
        ? ('AWAITING_INSPECTION' as const)
        : existing.manufacturingStatus;

    const updatedRecord: ManufacturingRecord = {
      ...existing,
      permanentIdMethod: params.method,
      permanentIdReference: params.reference.trim(),
      permanentIdCompleted: true,
      permanentIdDate: params.date || new Date().toISOString().split('T')[0],
      permanentIdBy: params.completedBy || currentUser.name,
      permanentIdById: currentUser.id,
      manufacturingStatus: nextStatus,
    };

    const newDb: QMSDatabase = {
      ...db,
      manufacturingRecords: db.manufacturingRecords.map((r) =>
        r.id === manufacturingRecordId ? updatedRecord : r
      ),
    };

    const res = await commitDbChange(newDb, 'COMPLETE_PERMANENT_IDENTIFICATION', {
      recordType: 'MANUFACTURING_RECORD',
      recordId: existing.traceabilityNumber,
      method: params.method,
      reference: params.reference.trim(),
      previousValue: JSON.stringify(existing),
      newValue: JSON.stringify(updatedRecord),
    });

    if (res.ok) {
      return { success: true };
    }
    return { success: false, error: res.error || 'Failed to record permanent identification.' };
  };

  // 12. Settings update
  const updateSettings = async (newSettings: Partial<SystemSettings>): Promise<boolean> => {
    const updatedSettings: SystemSettings = {
      ...db.settings,
      ...newSettings,
      productionMode: true,
      allowDevRoleSwitch: false,
    };
    const newDb: QMSDatabase = {
      ...db,
      settings: updatedSettings,
    };
    const res = await commitDbChange(newDb, 'UPDATE_SETTINGS', {
      recordType: 'SYSTEM',
      recordId: 'SETTINGS',
      previousValue: JSON.stringify(db.settings),
      newValue: JSON.stringify(updatedSettings),
    });
    if (!res.ok && res.error) alert(res.error);
    return res.ok;
  };

  // 13. Reset to default initial seed data (Strictly ADMINISTRATOR only; always preserves registered user login profiles)
  const resetToDefaultData = async (): Promise<{ success: boolean; error?: string }> => {
    if (currentUser.role !== 'ADMINISTRATOR') {
      const msg = `FORBIDDEN: Only ADMINISTRATOR may reset the database (Current role: ${currentUser.role}).`;
      alert(msg);
      return { success: false, error: msg };
    }
    const preservedUsers = mergeQMSDatabases(db, INITIAL_DATABASE, INITIAL_DATABASE).users;
    const baselineWithUsers: QMSDatabase = {
      ...INITIAL_DATABASE,
      users: preservedUsers,
      deletedRecordKeys: [],
    };
    const res = await commitDbChange(baselineWithUsers, 'RESET_TO_DEFAULTS', {
      recordType: 'DATABASE',
      recordId: 'FULL_RESET',
      details: { reason: 'Administrator initiated database reset to initial seed baseline' },
    });
    return { success: res.ok, error: res.error };
  };

  // ==========================================
  // ADMINISTRATOR RECORD & LIST DELETION
  // ==========================================

  const ensureAdminPermission = (): { ok: boolean; error?: string } => {
    if (currentUser.role !== 'ADMINISTRATOR') {
      return {
        ok: false,
        error: `FORBIDDEN: Only ADMINISTRATOR may delete records or clear lists (Current role: ${currentUser.role}).`,
      };
    }
    return { ok: true };
  };

  const deleteProject = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const check = ensureAdminPermission();
    if (!check.ok) return { success: false, error: check.error };
    const target = db.projects.find((p) => p.id === id);
    if (!target) return { success: false, error: 'Project not found.' };

    const pNum = target.projectNumber.trim().toUpperCase();
    const delSet = new Set(db.deletedRecordKeys || []);
    delSet.add(`PROJECT:${target.id.toUpperCase()}`);
    delSet.add(`PROJECT:${pNum}`);

    const newDb: QMSDatabase = {
      ...db,
      projects: db.projects.filter((p) => p.id !== id),
      deletedRecordKeys: Array.from(delSet),
    };
    const res = await commitDbChange(newDb, 'ADMIN_DELETE_RECORD', {
      recordType: 'PROJECT',
      recordId: target.projectNumber,
      previousValue: JSON.stringify(target),
    });
    return { success: res.ok, error: res.error };
  };

  const deleteMachine = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const check = ensureAdminPermission();
    if (!check.ok) return { success: false, error: check.error };
    const target = db.machines.find((m) => m.id === id);
    if (!target) return { success: false, error: 'Machine not found.' };

    const sn = target.serialNumber.trim().toUpperCase();
    const delSet = new Set(db.deletedRecordKeys || []);
    delSet.add(`MACHINE:${target.id.toUpperCase()}`);
    delSet.add(`MACHINE:${sn}`);

    const newDb: QMSDatabase = {
      ...db,
      machines: db.machines.filter((m) => m.id !== id),
      deletedRecordKeys: Array.from(delSet),
    };
    const res = await commitDbChange(newDb, 'ADMIN_DELETE_RECORD', {
      recordType: 'MACHINE',
      recordId: target.serialNumber,
      previousValue: JSON.stringify(target),
    });
    return { success: res.ok, error: res.error };
  };

  const deleteComponent = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const check = ensureAdminPermission();
    if (!check.ok) return { success: false, error: check.error };
    const target = db.components.find((c) => c.id === id);
    if (!target) return { success: false, error: 'Component / Part not found.' };

    const pn = target.partNumber.trim().toUpperCase();
    const delSet = new Set(db.deletedRecordKeys || []);
    delSet.add(`COMPONENT:${target.id.toUpperCase()}`);
    delSet.add(`COMPONENT:${pn}`);

    const newDb: QMSDatabase = {
      ...db,
      components: db.components.filter((c) => c.id !== id),
      deletedRecordKeys: Array.from(delSet),
    };
    const res = await commitDbChange(newDb, 'ADMIN_DELETE_RECORD', {
      recordType: 'COMPONENT',
      recordId: target.partNumber,
      previousValue: JSON.stringify(target),
    });
    return { success: res.ok, error: res.error };
  };

  const deleteDrawing = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const check = ensureAdminPermission();
    if (!check.ok) return { success: false, error: check.error };
    const target = db.drawings.find((d) => d.id === id);
    if (!target) return { success: false, error: 'Drawing not found.' };

    const dNo = target.drawingNumber.trim().toUpperCase();
    const dRev = (target.revision || '0').trim().toUpperCase();
    const remainingForDwg = db.drawings.filter(
      (d) => d.id !== id && d.drawingNumber.trim().toUpperCase() === dNo
    );
    const delSet = new Set(db.deletedRecordKeys || []);
    delSet.add(`DRAWING:${target.id.toUpperCase()}`);
    delSet.add(`DRAWING:${dNo}::${dRev}`);
    if (remainingForDwg.length === 0) {
      delSet.add(`DRAWING:${dNo}`);
    }

    const newDb: QMSDatabase = {
      ...db,
      drawings: db.drawings.filter((d) => d.id !== id),
      deletedRecordKeys: Array.from(delSet),
    };
    const res = await commitDbChange(newDb, 'ADMIN_DELETE_RECORD', {
      recordType: 'DRAWING',
      recordId: `${target.drawingNumber} Rev ${target.revision}`,
      previousValue: JSON.stringify(target),
    });
    return { success: res.ok, error: res.error };
  };

  const deleteDrawingPart = async (
    drawingId: string,
    partItemIdOrPartNo: string
  ): Promise<{ success: boolean; error?: string }> => {
    const check = ensureAdminPermission();
    if (!check.ok) return { success: false, error: check.error };
    const targetDwg = db.drawings.find((d) => d.id === drawingId);
    if (!targetDwg) return { success: false, error: 'Drawing not found.' };

    const dNo = targetDwg.drawingNumber.trim().toUpperCase();
    const cleanTarget = partItemIdOrPartNo.trim().toUpperCase();
    const currentParts = targetDwg.partsList || [];
    const removedPart = currentParts.find(
      (pt) => pt.id === partItemIdOrPartNo || pt.partNumber.trim().toUpperCase() === cleanTarget
    );
    const nextParts = currentParts.filter(
      (pt) => pt.id !== partItemIdOrPartNo && pt.partNumber.trim().toUpperCase() !== cleanTarget
    );
    const nextPartNumbers = nextParts.map((pt) => pt.partNumber.trim().toUpperCase());

    const delSet = new Set(db.deletedRecordKeys || []);
    const partNoToTombstone = removedPart
      ? removedPart.partNumber.trim().toUpperCase()
      : cleanTarget;
    delSet.add(`DRAWING_PART:${dNo}::${partNoToTombstone}`);

    const updatedDwg: Drawing = {
      ...targetDwg,
      partsList: nextParts,
      partNumbers: nextPartNumbers,
      partNumber: nextPartNumbers.join('; '),
    };

    const newDb: QMSDatabase = {
      ...db,
      drawings: db.drawings.map((d) => (d.id === drawingId ? updatedDwg : d)),
      deletedRecordKeys: Array.from(delSet),
    };
    const res = await commitDbChange(newDb, 'ADMIN_DELETE_RECORD', {
      recordType: 'DRAWING',
      recordId: `${targetDwg.drawingNumber} BOM Part ${partNoToTombstone}`,
      previousValue: JSON.stringify(removedPart || partItemIdOrPartNo),
    });
    return { success: res.ok, error: res.error };
  };

  const clearDrawingPartsList = async (
    drawingId: string
  ): Promise<{ success: boolean; error?: string }> => {
    const check = ensureAdminPermission();
    if (!check.ok) return { success: false, error: check.error };
    const targetDwg = db.drawings.find((d) => d.id === drawingId);
    if (!targetDwg) return { success: false, error: 'Drawing not found.' };

    const dNo = targetDwg.drawingNumber.trim().toUpperCase();
    const delSet = new Set(db.deletedRecordKeys || []);
    delSet.add(`DRAWING_BOM_CLEARED:${dNo}`);

    const updatedDwg: Drawing = {
      ...targetDwg,
      partsList: [],
      partNumbers: [],
      partNumber: '',
    };

    const newDb: QMSDatabase = {
      ...db,
      drawings: db.drawings.map((d) => (d.id === drawingId ? updatedDwg : d)),
      deletedRecordKeys: Array.from(delSet),
    };
    const res = await commitDbChange(newDb, 'ADMIN_CLEAR_LIST', {
      recordType: 'DRAWING',
      recordId: `${targetDwg.drawingNumber} BOM Parts List`,
    });
    return { success: res.ok, error: res.error };
  };

  const deleteManufacturingRecord = async (
    id: string
  ): Promise<{ success: boolean; error?: string }> => {
    const check = ensureAdminPermission();
    if (!check.ok) return { success: false, error: check.error };
    const target = db.manufacturingRecords.find((r) => r.id === id);
    if (!target) return { success: false, error: 'Manufacturing record not found.' };

    const delSet = new Set(db.deletedRecordKeys || []);
    delSet.add(`MFG:${target.id.toUpperCase()}`);
    delSet.add(`MFG:${target.traceabilityNumber.trim().toUpperCase()}`);

    const newDb: QMSDatabase = {
      ...db,
      manufacturingRecords: db.manufacturingRecords.filter((r) => r.id !== id),
      deletedRecordKeys: Array.from(delSet),
    };
    const res = await commitDbChange(newDb, 'ADMIN_DELETE_RECORD', {
      recordType: 'MANUFACTURING_RECORD',
      recordId: target.traceabilityNumber,
      previousValue: JSON.stringify(target),
    });
    return { success: res.ok, error: res.error };
  };

  const deleteInspection = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const check = ensureAdminPermission();
    if (!check.ok) return { success: false, error: check.error };
    const target = db.inspections.find((i) => i.id === id);
    if (!target) return { success: false, error: 'Inspection record not found.' };

    const delSet = new Set(db.deletedRecordKeys || []);
    delSet.add(`INSP:${target.id.toUpperCase()}`);

    const newDb: QMSDatabase = {
      ...db,
      inspections: db.inspections.filter((i) => i.id !== id),
      deletedRecordKeys: Array.from(delSet),
    };
    const res = await commitDbChange(newDb, 'ADMIN_DELETE_RECORD', {
      recordType: 'INSPECTION',
      recordId: target.id,
      previousValue: JSON.stringify(target),
    });
    return { success: res.ok, error: res.error };
  };

  const deleteInspectionCharacteristic = async (
    inspectionId: string,
    characteristicId: string
  ): Promise<{ success: boolean; error?: string }> => {
    const check = ensureAdminPermission();
    if (!check.ok) return { success: false, error: check.error };
    const target = db.inspections.find((i) => i.id === inspectionId);
    if (!target) return { success: false, error: 'Inspection record not found.' };

    const nextChars = target.characteristics
      .filter((c) => c.id !== characteristicId)
      .map((c, idx) => ({ ...c, charNumber: idx + 1 }));

    const updatedInsp: InspectionRecord = {
      ...target,
      characteristics: nextChars,
      updatedAt: new Date().toISOString(),
    };
    const newDb: QMSDatabase = {
      ...db,
      inspections: db.inspections.map((i) => (i.id === inspectionId ? updatedInsp : i)),
    };
    const res = await commitDbChange(newDb, 'ADMIN_DELETE_RECORD', {
      recordType: 'INSPECTION',
      recordId: `${inspectionId} Char ${characteristicId}`,
    });
    return { success: res.ok, error: res.error };
  };

  const deleteNCR = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const check = ensureAdminPermission();
    if (!check.ok) return { success: false, error: check.error };
    const target = db.ncrs.find((n) => n.id === id);
    if (!target) return { success: false, error: 'NCR not found.' };

    const delSet = new Set(db.deletedRecordKeys || []);
    delSet.add(`NCR:${target.id.toUpperCase()}`);
    delSet.add(`NCR:${target.ncrNumber.trim().toUpperCase()}`);

    const newDb: QMSDatabase = {
      ...db,
      ncrs: db.ncrs.filter((n) => n.id !== id),
      deletedRecordKeys: Array.from(delSet),
    };
    const res = await commitDbChange(newDb, 'ADMIN_DELETE_RECORD', {
      recordType: 'NCR',
      recordId: target.ncrNumber,
      previousValue: JSON.stringify(target),
    });
    return { success: res.ok, error: res.error };
  };

  const deleteDeviation = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const check = ensureAdminPermission();
    if (!check.ok) return { success: false, error: check.error };
    const target = db.deviations.find((d) => d.id === id);
    if (!target) return { success: false, error: 'Deviation not found.' };

    const delSet = new Set(db.deletedRecordKeys || []);
    delSet.add(`DEV:${target.id.toUpperCase()}`);
    delSet.add(`DEV:${target.deviationNumber.trim().toUpperCase()}`);

    const newDb: QMSDatabase = {
      ...db,
      deviations: db.deviations.filter((d) => d.id !== id),
      deletedRecordKeys: Array.from(delSet),
    };
    const res = await commitDbChange(newDb, 'ADMIN_DELETE_RECORD', {
      recordType: 'DEVIATION',
      recordId: target.deviationNumber,
      previousValue: JSON.stringify(target),
    });
    return { success: res.ok, error: res.error };
  };

  const deleteRelease = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const check = ensureAdminPermission();
    if (!check.ok) return { success: false, error: check.error };
    const target = db.releases.find((r) => r.id === id);
    if (!target) return { success: false, error: 'Release record not found.' };

    const delSet = new Set(db.deletedRecordKeys || []);
    delSet.add(`REL:${target.id.toUpperCase()}`);
    delSet.add(`REL:${target.releaseId.trim().toUpperCase()}`);

    const newDb: QMSDatabase = {
      ...db,
      releases: db.releases.filter((r) => r.id !== id),
      deletedRecordKeys: Array.from(delSet),
    };
    const res = await commitDbChange(newDb, 'ADMIN_DELETE_RECORD', {
      recordType: 'RELEASE',
      recordId: target.releaseId,
      previousValue: JSON.stringify(target),
    });
    return { success: res.ok, error: res.error };
  };

  const deleteUser = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const check = ensureAdminPermission();
    if (!check.ok) return { success: false, error: check.error };
    if (id === currentUser.id) {
      return {
        success: false,
        error: 'Cannot delete your own currently active Administrator account.',
      };
    }
    const res = await DBService.deleteUserAccount(id);
    if (!res.success) {
      return { success: false, error: res.error };
    }
    await refreshDatabase();
    return { success: true };
  };

  const clearCollectionList = async (
    collection:
      | 'projects'
      | 'machines'
      | 'components'
      | 'drawings'
      | 'manufacturingRecords'
      | 'inspections'
      | 'ncrs'
      | 'deviations'
      | 'releases'
      | 'auditLogs'
      | 'ALL_DATA'
  ): Promise<{ success: boolean; error?: string }> => {
    const check = ensureAdminPermission();
    if (!check.ok) return { success: false, error: check.error };

    const delSet = new Set(db.deletedRecordKeys || []);
    const nextDb: QMSDatabase = { ...db };

    if (collection === 'projects' || collection === 'ALL_DATA') {
      delSet.add('LIST_CLEARED:PROJECTS');
      db.projects.forEach((p) => {
        delSet.add(`PROJECT:${p.id.toUpperCase()}`);
        delSet.add(`PROJECT:${p.projectNumber.trim().toUpperCase()}`);
      });
      nextDb.projects = [];
    }
    if (collection === 'machines' || collection === 'ALL_DATA') {
      delSet.add('LIST_CLEARED:MACHINES');
      db.machines.forEach((m) => {
        delSet.add(`MACHINE:${m.id.toUpperCase()}`);
        delSet.add(`MACHINE:${m.serialNumber.trim().toUpperCase()}`);
      });
      nextDb.machines = [];
    }
    if (collection === 'components' || collection === 'ALL_DATA') {
      delSet.add('LIST_CLEARED:COMPONENTS');
      db.components.forEach((c) => {
        delSet.add(`COMPONENT:${c.id.toUpperCase()}`);
        delSet.add(`COMPONENT:${c.partNumber.trim().toUpperCase()}`);
      });
      nextDb.components = [];
    }
    if (collection === 'drawings' || collection === 'ALL_DATA') {
      delSet.add('LIST_CLEARED:DRAWINGS');
      db.drawings.forEach((d) => {
        const dNo = d.drawingNumber.trim().toUpperCase();
        const dRev = (d.revision || '0').trim().toUpperCase();
        delSet.add(`DRAWING:${d.id.toUpperCase()}`);
        delSet.add(`DRAWING:${dNo}`);
        delSet.add(`DRAWING:${dNo}::${dRev}`);
      });
      nextDb.drawings = [];
    }
    if (collection === 'manufacturingRecords' || collection === 'ALL_DATA') {
      delSet.add('LIST_CLEARED:MFG');
      db.manufacturingRecords.forEach((r) => {
        delSet.add(`MFG:${r.id.toUpperCase()}`);
        delSet.add(`MFG:${r.traceabilityNumber.trim().toUpperCase()}`);
      });
      nextDb.manufacturingRecords = [];
    }
    if (collection === 'inspections' || collection === 'ALL_DATA') {
      delSet.add('LIST_CLEARED:INSPECTIONS');
      db.inspections.forEach((i) => {
        delSet.add(`INSP:${i.id.toUpperCase()}`);
      });
      nextDb.inspections = [];
    }
    if (collection === 'ncrs' || collection === 'ALL_DATA') {
      delSet.add('LIST_CLEARED:NCRS');
      db.ncrs.forEach((n) => {
        delSet.add(`NCR:${n.id.toUpperCase()}`);
        delSet.add(`NCR:${n.ncrNumber.trim().toUpperCase()}`);
      });
      nextDb.ncrs = [];
    }
    if (collection === 'deviations' || collection === 'ALL_DATA') {
      delSet.add('LIST_CLEARED:DEVIATIONS');
      db.deviations.forEach((dv) => {
        delSet.add(`DEV:${dv.id.toUpperCase()}`);
        delSet.add(`DEV:${dv.deviationNumber.trim().toUpperCase()}`);
      });
      nextDb.deviations = [];
    }
    if (collection === 'releases' || collection === 'ALL_DATA') {
      delSet.add('LIST_CLEARED:RELEASES');
      db.releases.forEach((rl) => {
        delSet.add(`REL:${rl.id.toUpperCase()}`);
        delSet.add(`REL:${rl.releaseId.trim().toUpperCase()}`);
      });
      nextDb.releases = [];
    }
    if (collection === 'auditLogs') {
      nextDb.auditLogs = [];
    }

    nextDb.deletedRecordKeys = Array.from(delSet);

    const action = collection === 'ALL_DATA' ? 'ADMIN_CLEAR_ALL_DATA' : 'ADMIN_CLEAR_LIST';
    const res = await commitDbChange(nextDb, action, {
      recordType: 'DATABASE',
      recordId: collection,
      details: { clearedCollection: collection },
    });
    return { success: res.ok, error: res.error };
  };

  // 14. Import Database JSON (Strictly ADMINISTRATOR only; non-destructively merges so zero users or past records are lost)
  const importDatabaseJson = async (jsonString: string): Promise<{ success: boolean; error?: string }> => {
    if (currentUser.role !== 'ADMINISTRATOR') {
      const msg = `FORBIDDEN: Only ADMINISTRATOR may import/overwrite the database (Current role: ${currentUser.role}).`;
      alert(msg);
      return { success: false, error: msg };
    }
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.machines || !parsed.components || !parsed.drawings || !parsed.manufacturingRecords) {
        return { success: false, error: 'Invalid MACHINE QMS database backup file format.' };
      }
      const mergedBackup = mergeQMSDatabases(parsed, db, INITIAL_DATABASE);
      const res = await commitDbChange(mergedBackup, 'RESTORE_DATABASE_BACKUP', {
        recordType: 'DATABASE',
        recordId: 'RESTORE',
      });
      return { success: res.ok, error: res.error };
    } catch (e: any) {
      return { success: false, error: 'Failed to parse JSON file: ' + e.message };
    }
  };

  // 15. Refresh from server
  const refreshDatabase = async (): Promise<void> => {
    setIsSyncing(true);
    try {
      const fresh = await DBService.load();
      setDb(reconcileCrossPopulatedDatabase(fresh));
      setLastSynced(new Date());
    } finally {
      setIsSyncing(false);
    }
  };

  // ==========================================
  // PHASE 2: INSPECTION ACTIONS
  // ==========================================

  const startInspection = async (
    manufacturingRecordId: string,
    options?: {
      templateId?: string;
      stage?: InspectionStage;
      department?: WorkshopDepartment;
      departmentOperation?: string;
      operatorId?: string;
      operatorName?: string;
    }
  ): Promise<{ success: boolean; inspectionId?: string; error?: string }> => {
    const record = db.manufacturingRecords.find((r) => r.id === manufacturingRecordId);
    if (!record) {
      return { success: false, error: `Manufacturing record ${manufacturingRecordId} not found.` };
    }

    const allowedRoles: User['role'][] = ['INSPECTOR', 'HSEQ', 'ADMINISTRATOR', 'MACHINE_MANAGER'];
    if (!allowedRoles.includes(currentUser.role)) {
      return {
        success: false,
        error: `Only authorized quality inspectors or management may initiate formal inspections (Current role: ${currentUser.role}).`,
      };
    }

    const existing = db.inspections.find((i) => i.manufacturingRecordId === manufacturingRecordId);
    if (existing) {
      return { success: true, inspectionId: existing.id };
    }

    const comp = db.components.find((c) => c.partNumber === record.partNumber);
    const mach = db.machines.find((m) => m.serialNumber === record.machineSerialNumber);
    const stage: InspectionStage = options?.stage || 'IN_PROCESS';

    const templatesPool = db.inspectionTemplates && db.inspectionTemplates.length > 0
      ? db.inspectionTemplates
      : INITIAL_INSPECTION_TEMPLATES;

    // Look for chosen template or match automatically
    let matchedTemplate: InspectionTemplate | undefined;
    if (options?.templateId) {
      matchedTemplate = templatesPool.find((t) => t.id === options.templateId);
    }
    if (!matchedTemplate) {
      matchedTemplate = matchApprovedInspectionTemplate(templatesPool, {
        machineType: mach?.machineType,
        partNumber: record.partNumber,
        componentCategory: comp?.category,
        stage,
        preferredCode: comp?.primaryInspectionTemplateCode,
        departmentOperation: options?.departmentOperation || record.departmentOperation,
        department: options?.department || record.department,
      });
    }

    // Stage 3.3 & Stage 4.1: Strictly enforce approved template assignment and NO invented values
    if (!matchedTemplate) {
      return {
        success: false,
        error: `TEMPLATE ASSIGNMENT REQUIRED: No approved inspection template is assigned or matches component ${record.partNumber} (${comp?.category || 'part'}). Critical components cannot be inspected without an approved controlled template. Please assign an approved template from the Template Library.`,
      };
    }

    // Only APPROVED templates may be used for production inspections.
    if (matchedTemplate.status !== 'APPROVED') {
      return {
        success: false,
        error: `RESTRICTED: Inspection Template "${matchedTemplate.code}" is in ${matchedTemplate.status} status. Only APPROVED templates may be used for production inspections.`,
      };
    }

    let characteristics: InspectionCharacteristic[] = [];
    let templateQualityChecks: InspectionTemplateQualityCheck[] = [];

    if (matchedTemplate.characteristics && matchedTemplate.characteristics.length > 0) {
      characteristics = matchedTemplate.characteristics.map((tc, idx) => ({
        id: `CHAR-${Date.now()}-${idx + 1}`,
        charNumber: tc.characteristicNumber || idx + 1,
        feature: tc.feature,
        description: tc.description,
        characteristicType: tc.characteristicType,
        mandatory: tc.mandatory,
        requirementSource: tc.requirementSource,
        nominal: tc.nominal !== undefined && tc.nominal !== null ? tc.nominal : null,
        upperTolerance: tc.upperTolerance !== undefined && tc.upperTolerance !== null ? tc.upperTolerance : null,
        lowerTolerance: tc.lowerTolerance !== undefined && tc.lowerTolerance !== null ? tc.lowerTolerance : null,
        unit: tc.unit || 'mm',
        actual: null,
        measuringInstrument: tc.measuringInstrument || '',
        instrumentId: tc.instrumentId || '',
        result: 'PENDING' as CharacteristicResult,
        disposition: 'STANDARD' as CharacteristicDisposition,
        comment: tc.description,
        drawingNominalConfigured: tc.nominal !== null && tc.nominal !== undefined,
      }));

      templateQualityChecks = (matchedTemplate.qualityChecks || []).map((qc) => ({
        ...qc,
        result: null,
        comment: '',
      }));
    }

    const inspectionId = `INSP-2026-${String(db.inspections.length + 1).padStart(4, '0')}`;
    const newInspection: InspectionRecord = {
      id: inspectionId,
      manufacturingRecordId: record.id,
      traceabilityNumber: record.traceabilityNumber,
      machineSerialNumber: record.machineSerialNumber,
      projectNumber: record.projectNumber,
      partNumber: record.partNumber,
      componentDescription: record.componentDescription,
      quantity: record.quantity,
      drawingNumber: record.drawingNumber,
      drawingRevision: record.drawingRevision,
      machinist: record.machinist,
      machinistId: record.machinistId,
      manufacturingDate: record.manufacturingDate,
      inspectorId: currentUser.id,
      inspectorName: currentUser.name,
      inspectionDate: new Date().toISOString().split('T')[0],
      inspectionTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'IN_PROGRESS',
      department: options?.department || record.department,
      departmentOperation: options?.departmentOperation || record.departmentOperation,
      operatorId: options?.operatorId || record.machinistId,
      operatorName: options?.operatorName || record.machinist,
      drawingVerification: {
        correctDrawingNumber: false,
        correctDrawingRevision: false,
        drawingApproved: false,
        componentCorrespondsToDrawing: false,
        associationCorrect: false,
      },
      characteristics,
      templateId: matchedTemplate?.id,
      templateCode: matchedTemplate?.code,
      templateRevision: matchedTemplate?.revision,
      inspectionStage: (options?.stage as any) || matchedTemplate?.inspectionStage || 'IN_PROCESS',
      templateCharacteristics: matchedTemplate?.characteristics,
      templateQualityChecks: templateQualityChecks.length > 0 ? templateQualityChecks : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedRecords = db.manufacturingRecords.map((r) =>
      r.id === record.id ? { ...r, manufacturingStatus: 'UNDER_INSPECTION' as const } : r
    );

    const newDb: QMSDatabase = {
      ...db,
      inspections: [newInspection, ...db.inspections],
      manufacturingRecords: updatedRecords,
    };

    const res = await commitDbChange(newDb, 'START_INSPECTION', {
      recordType: 'INSPECTION',
      recordId: inspectionId,
      traceabilityNumber: record.traceabilityNumber,
      machineSerialNumber: record.machineSerialNumber,
      partNumber: record.partNumber,
      templateCode: matchedTemplate?.code,
      templateRevision: matchedTemplate?.revision,
      newValue: JSON.stringify(newInspection),
    });

    if (res.ok) {
      return { success: true, inspectionId };
    }
    return { success: false, error: res.error || 'Database commit failed.' };
  };

  const recordDepartmentHandover = async (
    inspectionId: string,
    handover: {
      toDepartment: WorkshopDepartment;
      signedBy: string;
      signedById: string;
      signedAt?: string;
      comments?: string;
    }
  ): Promise<{ success: boolean; error?: string }> => {
    const insp = db.inspections.find((i) => i.id === inspectionId);
    if (!insp) return { success: false, error: 'Inspection record not found.' };

    const updatedInsp: InspectionRecord = {
      ...insp,
      handoverConfirmed: true,
      handoverToDepartment: handover.toDepartment,
      handoverSignOff: {
        signedBy: handover.signedBy,
        signedById: handover.signedById,
        signedAt: handover.signedAt || new Date().toISOString(),
        comments: handover.comments,
      },
      updatedAt: new Date().toISOString(),
    };

    const updatedMfg = db.manufacturingRecords.map((r) => {
      if (r.id === insp.manufacturingRecordId) {
        const nextOps = (r.operations || []).map((op) => {
          if (op.department === insp.department) {
            return {
              ...op,
              status: 'COMPLETED' as const,
              completedAt: new Date().toISOString(),
              handoverConfirmed: true,
              handoverToDepartment: handover.toDepartment,
              handoverSignOff: {
                signedBy: handover.signedBy,
                signedById: handover.signedById,
                signedAt: handover.signedAt || new Date().toISOString(),
                comments: handover.comments,
              },
            };
          }
          return op;
        });
        return { ...r, operations: nextOps };
      }
      return r;
    });

    const newDb: QMSDatabase = {
      ...db,
      inspections: db.inspections.map((i) => (i.id === inspectionId ? updatedInsp : i)),
      manufacturingRecords: updatedMfg,
    };

    const res = await commitDbChange(newDb, 'HANDOVER_SIGNOFF', {
      recordType: 'INSPECTION',
      recordId: inspectionId,
      handoverToDepartment: handover.toDepartment,
      signedById: handover.signedById,
    });

    return { success: res.ok, error: res.error };
  };

  const updateInspection = async (id: string, updates: Partial<InspectionRecord>): Promise<boolean> => {
    const existing = db.inspections.find((i) => i.id === id);
    if (!existing) return false;

    const updatedInspection: InspectionRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const newDb: QMSDatabase = {
      ...db,
      inspections: db.inspections.map((i) => (i.id === id ? updatedInspection : i)),
    };

    const res = await commitDbChange(newDb, 'UPDATE_INSPECTION', {
      recordType: 'INSPECTION',
      recordId: existing.id,
      previousValue: JSON.stringify(existing),
      newValue: JSON.stringify(updatedInspection),
    });
    if (!res.ok && res.error) alert(res.error);
    return res.ok;
  };

  // Requirement 8: Validate Lower & Upper Tolerance before adding characteristic
  const addInspectionCharacteristic = async (
    inspectionId: string,
    charInput: Omit<InspectionCharacteristic, 'id' | 'charNumber' | 'actual' | 'result'>
  ): Promise<{ success: boolean; error?: string }> => {
    const inspection = db.inspections.find((i) => i.id === inspectionId);
    if (!inspection) {
      return { success: false, error: 'Inspection record not found.' };
    }

    if (
      charInput.nominal !== null &&
      charInput.nominal !== undefined &&
      charInput.lowerTolerance !== null &&
      charInput.lowerTolerance !== undefined &&
      charInput.upperTolerance !== null &&
      charInput.upperTolerance !== undefined
    ) {
      const tolValidation = DBService.validateToleranceLimits({
        nominal: Number(charInput.nominal),
        lowerTolerance: Number(charInput.lowerTolerance),
        upperTolerance: Number(charInput.upperTolerance),
      });
      if (!tolValidation.valid) {
        return { success: false, error: tolValidation.error };
      }
    } else if (charInput.mandatory || charInput.drawingNominalConfigured) {
      return {
        success: false,
        error: 'Nominal and upper/lower tolerances are mandatory from the engineering drawing.',
      };
    }

    const charToAdd: InspectionCharacteristic = {
      ...charInput,
      id: `CHAR-${Date.now()}`,
      charNumber: inspection.characteristics.length + 1,
      actual: null,
      result: 'PENDING',
      disposition: 'STANDARD',
    };

    const updatedChars = [...inspection.characteristics, charToAdd];
    const ok = await updateInspection(inspectionId, { characteristics: updatedChars });
    return { success: ok };
  };

  // Requirement 2: Failed Measurement MUST Immediately Place Record on HOLD
  // Requirement 1 & 17: Preserves result = 'FAIL' and syncs ACCEPTED_BY_APPROVED_DEVIATION where covered
  const recordCharacteristicReading = async (
    inspectionId: string,
    characteristicId: string,
    actual: number | null,
    measuringInstrument?: string,
    instrumentId?: string,
    comment?: string
  ): Promise<boolean> => {
    const inspection = db.inspections.find((i) => i.id === inspectionId);
    if (!inspection) return false;

    const existingChar = inspection.characteristics.find((c) => c.id === characteristicId);
    const wasPreviouslyMeasured = existingChar && existingChar.actual !== null && existingChar.actual !== undefined;

    const rawUpdatedChars = inspection.characteristics.map((char) => {
      if (char.id === characteristicId) {
        const result = DBService.calculateCharacteristicResult({
          nominal: char.nominal,
          upperTolerance: char.upperTolerance,
          lowerTolerance: char.lowerTolerance,
          actual,
        });

        return {
          ...char,
          actual,
          result,
          measuringInstrument: measuringInstrument || char.measuringInstrument,
          instrumentId: instrumentId || char.instrumentId,
          comment: comment !== undefined ? comment : char.comment,
        };
      }
      return char;
    });

    const deviationsForRecord = db.deviations.filter(
      (d) => d.manufacturingRecordId === inspection.manufacturingRecordId
    );
    const syncedChars = DBService.syncCharacteristicsWithDeviations(rawUpdatedChars, deviationsForRecord);
    const evalRes = DBService.evaluateInspection(syncedChars, deviationsForRecord);

    let newInspectionStatus: InspectionRecord['status'] = inspection.status;
    let triggerAutomaticHold = false;

    if (evalRes.uncoveredFailedChars.length > 0) {
      newInspectionStatus = 'FAIL';
      triggerAutomaticHold = true;
    } else if (evalRes.overallResult === 'PASS' && inspection.inspectorSignOff?.confirmed) {
      newInspectionStatus = 'PASS';
    } else {
      newInspectionStatus = 'IN_PROGRESS';
    }

    // Auto-record an NCR if out-of-tolerance findings exist and no open NCR exists yet
    let nextNcrs = db.ncrs;
    let ncrNumberToAssign = inspection.ncrId;

    if (triggerAutomaticHold) {
      const existingOpenNcr = db.ncrs.find(
        (n) =>
          ((inspection.ncrId && n.ncrNumber === inspection.ncrId) ||
            n.inspectionRecordId === inspection.id ||
            n.manufacturingRecordId === inspection.manufacturingRecordId) &&
          n.status === 'OPEN'
      );

      const failedDescriptions = evalRes.uncoveredFailedChars.map(
        (c) =>
          `Char #${c.charNumber} ${c.feature}: Actual ${c.actual}${c.unit} vs Nominal ${c.nominal ?? 'N/A'} (${c.lowerTolerance ?? '0'}/${(c.upperTolerance ?? 0) >= 0 ? `+${c.upperTolerance ?? 0}` : c.upperTolerance ?? 0})`
      );

      if (!existingOpenNcr) {
        const existingNumbers = new Set(db.ncrs.map((n) => n.ncrNumber));
        let counter = db.ncrs.length + 1;
        let candidate = `NCR-2026-${String(counter).padStart(4, '0')}`;
        while (existingNumbers.has(candidate)) {
          counter++;
          candidate = `NCR-2026-${String(counter).padStart(4, '0')}`;
        }
        ncrNumberToAssign = candidate;

        const autoNcr: NCR = {
          id: candidate,
          ncrNumber: candidate,
          manufacturingRecordId: inspection.manufacturingRecordId,
          inspectionRecordId: inspection.id,
          traceabilityNumber: inspection.traceabilityNumber,
          machineSerialNumber: inspection.machineSerialNumber,
          projectNumber: inspection.projectNumber,
          partNumber: inspection.partNumber,
          componentDescription: inspection.componentDescription,
          drawingNumber: inspection.drawingNumber,
          drawingRevision: inspection.drawingRevision,
          department: inspection.department,
          characteristicId: characteristicId,
          characteristicName: existingChar?.feature,
          failedCharacteristics: failedDescriptions,
          description: `Automatic NCR raised for out-of-tolerance measurement(s): ${failedDescriptions.join('; ')}`,
          descriptionOfNonConformance: `Out-of-tolerance measurement(s) recorded during dimensional inspection in ${inspection.department || 'Inspection'}: ${failedDescriptions.join('; ')}`,
          requirement: `Conform to drawing ${inspection.drawingNumber} Rev ${inspection.drawingRevision} tolerances`,
          actualCondition: failedDescriptions.join('; '),
          immediateContainment: 'Component placed on Quality Hold. Quarantined in QA Hold Area.',
          proposedDisposition: 'REWORK',
          rootCause: 'Out-of-tolerance machining or dimensional variance detected during inspection.',
          correctiveAction: 'Rework part to drawing tolerance or raise formal concession deviation.',
          responsiblePerson: currentUser.name,
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          status: 'OPEN',
          createdAt: new Date().toISOString(),
          createdBy: currentUser.name,
          createdById: currentUser.id,
        };

        nextNcrs = [autoNcr, ...db.ncrs];
      } else {
        // Idempotent: Update existing open NCR rather than spawning duplicate
        ncrNumberToAssign = existingOpenNcr.ncrNumber;
        nextNcrs = db.ncrs.map((n) => {
          if (n.id === existingOpenNcr.id) {
            return {
              ...n,
              failedCharacteristics: failedDescriptions,
              department: inspection.department || n.department,
              description: `Automatic NCR raised for out-of-tolerance measurement(s): ${failedDescriptions.join('; ')}`,
              descriptionOfNonConformance: `Out-of-tolerance measurement(s) recorded during dimensional inspection in ${inspection.department || 'Inspection'}: ${failedDescriptions.join('; ')}`,
              actualCondition: failedDescriptions.join('; '),
            };
          }
          return n;
        });
      }
    }

    const updatedInspection: InspectionRecord = {
      ...inspection,
      characteristics: syncedChars,
      status: newInspectionStatus,
      ncrId: ncrNumberToAssign || inspection.ncrId,
      // If a new uncovered failure occurs, invalidate any prior sign-off
      inspectorSignOff: triggerAutomaticHold ? undefined : inspection.inspectorSignOff,
      updatedAt: new Date().toISOString(),
    };

    // Immediately place Manufacturing Record on NCR_HOLD if any mandatory characteristic failed without an approved deviation
    const updatedManufacturingRecords = db.manufacturingRecords.map((r) => {
      if (r.id === inspection.manufacturingRecordId) {
        if (triggerAutomaticHold) {
          return { ...r, manufacturingStatus: 'NCR_HOLD' as const };
        } else if (r.manufacturingStatus === 'HOLD' && evalRes.uncoveredFailedChars.length === 0) {
          // If all failed dimensions were re-measured within tolerance or covered by deviation, return to UNDER_INSPECTION
          const hasOpenNcr = nextNcrs.some(
            (n) => n.manufacturingRecordId === r.id && n.status !== 'CLOSED'
          );
          if (!hasOpenNcr) {
            return { ...r, manufacturingStatus: 'UNDER_INSPECTION' as const };
          }
        }
      }
      return r;
    });

    const newDb: QMSDatabase = {
      ...db,
      ncrs: nextNcrs,
      inspections: db.inspections.map((i) => (i.id === inspectionId ? updatedInspection : i)),
      manufacturingRecords: updatedManufacturingRecords,
    };

    const auditAction = triggerAutomaticHold
      ? 'AUTOMATIC_HOLD'
      : wasPreviouslyMeasured
      ? 'MEASUREMENT_CHANGED'
      : 'RECORD_MEASUREMENT';

    const res = await commitDbChange(newDb, auditAction, {
      recordType: 'INSPECTION',
      recordId: inspectionId,
      characteristicId,
      previousReading: existingChar?.actual,
      actualReading: actual,
      automaticHoldTriggered: triggerAutomaticHold,
      previousValue: JSON.stringify(inspection),
      newValue: JSON.stringify(updatedInspection),
    });

    if (!res.ok && res.error) alert(res.error);
    return res.ok;
  };

  // Requirement 1, 9, 17: Formal Inspector Electronic Sign-Off
  // Enforces immutable User ID Separation of Duties (currentUser.id !== machinistId)
  // Permits sign-off when failed characteristics are covered by a complete, Engineering-APPROVED deviation
  const signOffInspection = async (
    inspectionId: string,
    declaration: string
  ): Promise<{ success: boolean; error?: string }> => {
    const inspection = db.inspections.find((i) => i.id === inspectionId);
    if (!inspection) {
      return { success: false, error: 'Inspection record not found.' };
    }

    const mfgRecord = db.manufacturingRecords.find((r) => r.id === inspection.manufacturingRecordId);

    // Role check
    const allowedRoles: User['role'][] = ['INSPECTOR', 'HSEQ', 'ADMINISTRATOR'];
    if (!allowedRoles.includes(currentUser.role)) {
      return {
        success: false,
        error: `Only authorized Inspectors or HSEQ may execute final sign-off (Your role: ${currentUser.role}).`,
      };
    }

    // Requirement 9: Separation of duties using immutable User IDs (unconditional)
    if (
      currentUser.id === inspection.machinistId ||
      (mfgRecord && currentUser.id === mfgRecord.machinistId)
    ) {
      return {
        success: false,
        error: `SEPARATION OF DUTIES VIOLATION: User ${currentUser.name} (${currentUser.id}) is the Machinist who manufactured this component and is strictly forbidden from signing off its quality inspection.`,
      };
    }

    // 1. Drawing Verification must be 100% complete
    const dv = inspection.drawingVerification;
    const allDvPassed =
      dv.correctDrawingNumber &&
      dv.correctDrawingRevision &&
      dv.drawingApproved &&
      dv.componentCorrespondsToDrawing &&
      dv.associationCorrect;

    if (!allDvPassed) {
      return {
        success: false,
        error:
          'INSPECTION CANNOT BE COMPLETED: All 5 Drawing Verification checklist items must be confirmed before sign-off.',
      };
    }

    // 2. All characteristics must be measured
    if (inspection.characteristics.length === 0) {
      return {
        success: false,
        error: 'INSPECTION CANNOT BE COMPLETED: At least one characteristic must be inspected.',
      };
    }

    const deviationsForRecord = db.deviations.filter(
      (d) => d.manufacturingRecordId === inspection.manufacturingRecordId
    );
    const syncedChars = DBService.syncCharacteristicsWithDeviations(
      inspection.characteristics,
      deviationsForRecord
    );
    const evalRes = DBService.evaluateInspection(syncedChars, deviationsForRecord);

    const hasUnconfiguredChars = syncedChars.some(
      (c) =>
        c.nominal === null ||
        c.nominal === undefined ||
        c.upperTolerance === null ||
        c.upperTolerance === undefined ||
        c.lowerTolerance === null ||
        c.lowerTolerance === undefined
    );
    if (hasUnconfiguredChars) {
      return {
        success: false,
        error:
          'INSPECTION CANNOT BE COMPLETED: DRAWING REQUIREMENT NOT CONFIGURED. One or more mandatory characteristics lack drawing nominal and tolerance values.',
      };
    }

    if (!evalRes.allRecorded) {
      return {
        success: false,
        error: 'INSPECTION CANNOT BE COMPLETED: All mandatory characteristic dimensions must have measured readings recorded.',
      };
    }

    // 3. Check for uncovered failed characteristics (Deadlock fix: allow sign-off if covered by APPROVED deviation)
    if (evalRes.uncoveredFailedChars.length > 0) {
      return {
        success: false,
        error: `FAILED INSPECTION: ${evalRes.uncoveredFailedChars.length} characteristic(s) [${evalRes.uncoveredFailedChars
          .map((c) => `Char #${c.charNumber}: ${c.feature}`)
          .join(', ')}] failed tolerance limits and are NOT covered by a complete, Engineering-APPROVED deviation. Inspector cannot sign off until reworked or covered by an approved deviation.`,
      };
    }

    // 4. Mandatory non-dimensional quality checks must be completed (PASS or NA, not PENDING)
    if (inspection.templateQualityChecks && inspection.templateQualityChecks.length > 0) {
      const pendingMandatoryChecks = inspection.templateQualityChecks.filter(
        (qc) => qc.mandatory && (!qc.result || qc.result === 'PENDING')
      );
      if (pendingMandatoryChecks.length > 0) {
        return {
          success: false,
          error: `INSPECTION CANNOT BE COMPLETED: ${pendingMandatoryChecks.length} mandatory quality check(s) remain PENDING. Mandatory checks cannot remain pending before sign-off (${pendingMandatoryChecks.map(c => `Item #${c.checkNumber} ${c.description}`).join('; ')}).`,
        };
      }
      const failedQualityChecks = inspection.templateQualityChecks.filter(
        (qc) => qc.result === 'FAIL'
      );
      if (failedQualityChecks.length > 0) {
        return {
          success: false,
          error: `INSPECTION CANNOT BE COMPLETED: ${failedQualityChecks.length} non-dimensional quality check(s) marked FAIL (${failedQualityChecks.map(c => `Item #${c.checkNumber} ${c.description}`).join('; ')}). Non-conformances must be corrected before sign-off.`,
        };
      }
    }

    const acceptedWithDeviation = evalRes.deviationAcceptedChars.length > 0;
    const deviationReferences = Array.from(
      new Set(evalRes.deviationAcceptedChars.map((c) => c.deviationNumber).filter(Boolean) as string[])
    );

    const inspectorSignOff = {
      confirmed: true,
      declaration,
      signedAt: new Date().toISOString(),
      inspectorId: currentUser.id,
      inspectorName: currentUser.name,
      inspectorRole: currentUser.role,
      acceptedWithDeviation,
      deviationReferences: deviationReferences.length > 0 ? deviationReferences : undefined,
    };

    const updatedInspection: InspectionRecord = {
      ...inspection,
      characteristics: syncedChars,
      status: 'PASS',
      inspectorId: currentUser.id,
      inspectorName: currentUser.name,
      inspectorSignOff,
      deviationId: deviationReferences[0] || inspection.deviationId,
      updatedAt: new Date().toISOString(),
    };

    // Update manufacturing record to INSPECTION_PASSED (unless an open NCR still holds it)
    const hasOpenNcr = db.ncrs.some(
      (n) => n.manufacturingRecordId === inspection.manufacturingRecordId && n.status !== 'CLOSED'
    );
    const updatedRecords = db.manufacturingRecords.map((r) =>
      r.id === inspection.manufacturingRecordId
        ? {
            ...r,
            manufacturingStatus: hasOpenNcr ? ('NCR_HOLD' as const) : ('INSPECTION_PASSED' as const),
          }
        : r
    );

    const newDb: QMSDatabase = {
      ...db,
      inspections: db.inspections.map((i) => (i.id === inspectionId ? updatedInspection : i)),
      manufacturingRecords: updatedRecords,
    };

    const res = await commitDbChange(newDb, 'INSPECTOR_SIGNOFF', {
      recordType: 'INSPECTION',
      recordId: inspectionId,
      inspectorId: currentUser.id,
      inspector: currentUser.name,
      acceptedWithDeviation,
      deviationReferences,
      status: 'PASS',
      previousValue: JSON.stringify(inspection),
      newValue: JSON.stringify(updatedInspection),
    });

    if (res.ok) {
      return { success: true };
    }
    return { success: false, error: res.error || 'Database update failed.' };
  };

  const updateInspectionQualityCheck = async (
    inspectionId: string,
    checkId: string,
    result: 'PASS' | 'FAIL' | 'NA' | null,
    comment?: string
  ): Promise<{ success: boolean; ncrNumber?: string; error?: string }> => {
    const inspection = db.inspections.find((i) => i.id === inspectionId);
    if (!inspection) return { success: false, error: 'Inspection record not found.' };

    const checks = inspection.templateQualityChecks || [];
    const targetCheck = checks.find((c) => c.id === checkId);
    if (!targetCheck) return { success: false, error: 'Quality check item not found.' };

    let ncrNumberToAssign = targetCheck.ncrReference;
    let nextNcrs = [...(db.ncrs || [])];

    if (result === 'FAIL') {
      if (!ncrNumberToAssign) {
        ncrNumberToAssign = `NCR-2026-${String(nextNcrs.length + 1).padStart(4, '0')}`;
        const autoNcr: NCR = {
          id: ncrNumberToAssign,
          ncrNumber: ncrNumberToAssign,
          manufacturingRecordId: inspection.manufacturingRecordId,
          inspectionRecordId: inspection.id,
          traceabilityNumber: inspection.traceabilityNumber,
          machineSerialNumber: inspection.machineSerialNumber,
          projectNumber: inspection.projectNumber,
          partNumber: inspection.partNumber,
          componentDescription: inspection.componentDescription,
          drawingNumber: inspection.drawingNumber,
          drawingRevision: inspection.drawingRevision,
          failedCharacteristics: [`Quality Check #${targetCheck.checkNumber}: ${targetCheck.description}`],
          description: `Quality check failed: ${targetCheck.description}. ${comment || ''}`,
          descriptionOfNonConformance: `Mandatory quality check non-conformance: ${targetCheck.description}`,
          requirement: `Conform to quality check requirement: ${targetCheck.description}`,
          actualCondition: comment || 'Check failed during inspection.',
          immediateContainment: 'Component placed on Quality Hold. Quarantined in Bay QA area.',
          proposedDisposition: 'REWORK',
          rootCause: 'Quality workmanship, burr, thread, or orientation non-conformance.',
          correctiveAction: 'Rework or deburr component to meet standard.',
          responsiblePerson: currentUser.name,
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          status: 'OPEN',
          createdAt: new Date().toISOString(),
          createdBy: currentUser.name,
          createdById: currentUser.id,
        };
        nextNcrs = [autoNcr, ...nextNcrs];
      }
    }

    const updatedChecks = checks.map((c) =>
      c.id === checkId
        ? {
            ...c,
            result,
            comment: comment !== undefined ? comment : c.comment,
            ncrReference: ncrNumberToAssign,
          }
        : c
    );

    const hasAnyFailed = updatedChecks.some((c) => c.result === 'FAIL') || inspection.characteristics.some((c) => c.result === 'FAIL');

    const updatedInspection: InspectionRecord = {
      ...inspection,
      templateQualityChecks: updatedChecks,
      status: hasAnyFailed ? 'FAIL' : inspection.status === 'FAIL' ? 'IN_PROGRESS' : inspection.status,
      updatedAt: new Date().toISOString(),
    };

    const updatedRecords = db.manufacturingRecords.map((r) =>
      r.id === inspection.manufacturingRecordId
        ? {
            ...r,
            manufacturingStatus: (hasAnyFailed ? 'NCR_HOLD' : r.manufacturingStatus) as any,
          }
        : r
    );

    const newDb: QMSDatabase = {
      ...db,
      inspections: db.inspections.map((i) => (i.id === inspectionId ? updatedInspection : i)),
      ncrs: nextNcrs,
      manufacturingRecords: updatedRecords,
    };

    const res = await commitDbChange(newDb, 'UPDATE_INSPECTION', {
      recordType: 'INSPECTION',
      recordId: inspectionId,
      checkId,
      result,
      ncrNumber: ncrNumberToAssign,
    });

    return { success: res.ok, ncrNumber: ncrNumberToAssign, error: res.error };
  };

  const updateCharacteristicDrawingNominal = async (
    inspectionId: string,
    charId: string,
    nominal: number,
    upperTolerance: number,
    lowerTolerance: number,
    unit?: string,
    measuringInstrument?: string,
    instrumentId?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const inspection = db.inspections.find((i) => i.id === inspectionId);
    if (!inspection) return { success: false, error: 'Inspection record not found.' };

    const tolRes = DBService.validateToleranceLimits({ nominal, upperTolerance, lowerTolerance });
    if (!tolRes.valid) {
      return { success: false, error: tolRes.error };
    }

    const updatedChars = inspection.characteristics.map((c) => {
      if (c.id === charId) {
        const newNominal = Number(nominal);
        const newUpper = Number(upperTolerance);
        const newLower = Number(lowerTolerance);
        const result = DBService.calculateCharacteristicResult({
          nominal: newNominal,
          upperTolerance: newUpper,
          lowerTolerance: newLower,
          actual: c.actual,
        });
        return {
          ...c,
          nominal: newNominal,
          upperTolerance: newUpper,
          lowerTolerance: newLower,
          unit: unit || c.unit,
          measuringInstrument: measuringInstrument !== undefined ? measuringInstrument : c.measuringInstrument,
          instrumentId: instrumentId !== undefined ? instrumentId : c.instrumentId,
          result,
          drawingNominalConfigured: true,
        };
      }
      return c;
    });

    const ok = await updateInspection(inspectionId, { characteristics: updatedChars });
    return { success: ok };
  };

  // ==========================================
  // CONTROLLED INSPECTION TEMPLATES / PLANS LIBRARY
  // ==========================================

  const createInspectionTemplate = async (
    template: Omit<InspectionTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<{ success: boolean; templateId?: string; error?: string }> => {
    const id = `TMPL-${(template.code || 'INSP').trim().toUpperCase()}-${Date.now().toString(36)}`;
    const newTemplate: InspectionTemplate = {
      ...template,
      id,
      revision: template.revision || 'Rev 01',
      status: template.status || 'DRAFT',
      effectiveDate: template.effectiveDate || new Date().toISOString().split('T')[0],
      approvedBy: template.status === 'APPROVED' ? template.approvedBy || currentUser.name : '',
      approvalDate: template.status === 'APPROVED' ? template.approvalDate || new Date().toISOString().split('T')[0] : '',
      active: template.active !== undefined ? template.active : true,
      characteristics: template.characteristics || [],
      qualityChecks: template.qualityChecks || [],
      history: [
        {
          revision: template.revision || 'Rev 01',
          effectiveDate: template.effectiveDate || new Date().toISOString().split('T')[0],
          approvedBy: template.status === 'APPROVED' ? template.approvedBy || currentUser.name : 'Pending Approval',
          approvalDate: template.status === 'APPROVED' ? template.approvalDate || new Date().toISOString().split('T')[0] : '',
          changeNotes: 'Initial template creation',
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const templates = db.inspectionTemplates && db.inspectionTemplates.length > 0
      ? db.inspectionTemplates
      : INITIAL_INSPECTION_TEMPLATES;

    const newDb: QMSDatabase = {
      ...db,
      inspectionTemplates: [newTemplate, ...templates],
    };

    const res = await commitDbChange(newDb, 'CREATE_INSPECTION_TEMPLATE', {
      recordType: 'INSPECTION',
      recordId: id,
      templateCode: template.code,
      name: template.name,
    });

    return { success: res.ok, templateId: id, error: res.error };
  };

  const updateInspectionTemplate = async (
    id: string,
    updates: Partial<InspectionTemplate>
  ): Promise<{ success: boolean; error?: string }> => {
    const templates = db.inspectionTemplates && db.inspectionTemplates.length > 0
      ? db.inspectionTemplates
      : INITIAL_INSPECTION_TEMPLATES;

    const existing = templates.find((t) => t.id === id);
    if (!existing) return { success: false, error: 'Inspection template not found.' };

    if (existing.status === 'APPROVED' && updates.status !== 'SUPERSEDED' && updates.status !== 'OBSOLETE' && updates.active === undefined) {
      if (currentUser.role !== 'ADMINISTRATOR') {
        return {
          success: false,
          error: 'CONTROLLED DOCUMENT INTEGRITY: Approved templates cannot be directly modified. Create a new revision to preserve historical inspection traceability.',
        };
      }
    }

    const updatedTemplate: InspectionTemplate = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const newDb: QMSDatabase = {
      ...db,
      inspectionTemplates: templates.map((t) => (t.id === id ? updatedTemplate : t)),
    };

    const res = await commitDbChange(newDb, 'UPDATE_INSPECTION_TEMPLATE', {
      recordType: 'INSPECTION',
      recordId: id,
      templateCode: existing.code,
      previousValue: JSON.stringify(existing),
      newValue: JSON.stringify(updatedTemplate),
    });

    return { success: res.ok, error: res.error };
  };

  const approveInspectionTemplate = async (
    id: string,
    approverName?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const templates = db.inspectionTemplates && db.inspectionTemplates.length > 0
      ? db.inspectionTemplates
      : INITIAL_INSPECTION_TEMPLATES;

    const existing = templates.find((t) => t.id === id);
    if (!existing) return { success: false, error: 'Inspection template not found.' };

    const allowedRoles: UserRole[] = ['ENGINEERING', 'HSEQ', 'ADMINISTRATOR'];
    if (!allowedRoles.includes(currentUser.role)) {
      return {
        success: false,
        error: `Only Engineering, HSEQ, or Administrator may approve inspection templates (Current role: ${currentUser.role}).`,
      };
    }

    const approvedDate = new Date().toISOString().split('T')[0];
    const approver = approverName || currentUser.name;

    const updatedTemplate: InspectionTemplate = {
      ...existing,
      status: 'APPROVED',
      approvedBy: `${approver} (${currentUser.role})`,
      approvalDate: approvedDate,
      effectiveDate: approvedDate,
      active: true,
      history: [
        ...(existing.history || []),
        {
          revision: existing.revision,
          effectiveDate: approvedDate,
          approvedBy: approver,
          approvalDate: approvedDate,
          changeNotes: 'Formal Quality / Engineering Approval for Production Use',
        },
      ],
      updatedAt: new Date().toISOString(),
    };

    const newDb: QMSDatabase = {
      ...db,
      inspectionTemplates: templates.map((t) => (t.id === id ? updatedTemplate : t)),
    };

    const res = await commitDbChange(newDb, 'APPROVE_INSPECTION_TEMPLATE', {
      recordType: 'INSPECTION',
      recordId: id,
      templateCode: existing.code,
      approvedBy: approver,
    });

    return { success: res.ok, error: res.error };
  };

  const reviseInspectionTemplate = async (
    id: string,
    changeNotes: string
  ): Promise<{ success: boolean; newTemplateId?: string; error?: string }> => {
    const templates = db.inspectionTemplates && db.inspectionTemplates.length > 0
      ? db.inspectionTemplates
      : INITIAL_INSPECTION_TEMPLATES;

    const existing = templates.find((t) => t.id === id);
    if (!existing) return { success: false, error: 'Inspection template not found.' };

    // Parse current revision number
    const revMatch = existing.revision.match(/\d+/);
    const nextNum = revMatch ? parseInt(revMatch[0], 10) + 1 : 2;
    const nextRev = `Rev ${String(nextNum).padStart(2, '0')}`;
    const newId = `TMPL-${existing.code}-${Date.now().toString(36)}`;
    const effectiveDate = new Date().toISOString().split('T')[0];

    // Mark current revision as SUPERSEDED (Historical inspections keep their exact template revision!)
    const supersededExisting: InspectionTemplate = {
      ...existing,
      status: 'SUPERSEDED',
      updatedAt: new Date().toISOString(),
    };

    const nextTemplate: InspectionTemplate = {
      ...existing,
      id: newId,
      revision: nextRev,
      status: 'UNDER_REVIEW',
      effectiveDate,
      approvedBy: '',
      approvalDate: '',
      active: true,
      history: [
        ...(existing.history || []),
        {
          revision: nextRev,
          effectiveDate,
          approvedBy: currentUser.name,
          approvalDate: effectiveDate,
          changeNotes: changeNotes || `Revision incremented to ${nextRev}`,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedTemplatesList = templates.map((t) => (t.id === id ? supersededExisting : t));
    updatedTemplatesList.unshift(nextTemplate);

    const newDb: QMSDatabase = {
      ...db,
      inspectionTemplates: updatedTemplatesList,
    };

    const res = await commitDbChange(newDb, 'REVISE_INSPECTION_TEMPLATE', {
      recordType: 'INSPECTION',
      recordId: newId,
      supersededTemplateId: id,
      templateCode: existing.code,
      newRevision: nextRev,
      changeNotes,
    });

    return { success: res.ok, newTemplateId: newId, error: res.error };
  };

  const obsoleteInspectionTemplate = async (
    id: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const templates = db.inspectionTemplates && db.inspectionTemplates.length > 0
      ? db.inspectionTemplates
      : INITIAL_INSPECTION_TEMPLATES;

    const existing = templates.find((t) => t.id === id);
    if (!existing) return { success: false, error: 'Inspection template not found.' };

    const updatedTemplate: InspectionTemplate = {
      ...existing,
      status: 'OBSOLETE',
      active: false,
      history: [
        ...(existing.history || []),
        {
          revision: existing.revision,
          effectiveDate: new Date().toISOString().split('T')[0],
          approvedBy: currentUser.name,
          approvalDate: new Date().toISOString().split('T')[0],
          changeNotes: `Template made OBSOLETE: ${reason || 'Superseded or decommissioned'}`,
        },
      ],
      updatedAt: new Date().toISOString(),
    };

    const newDb: QMSDatabase = {
      ...db,
      inspectionTemplates: templates.map((t) => (t.id === id ? updatedTemplate : t)),
    };

    const res = await commitDbChange(newDb, 'OBSOLETE_INSPECTION_TEMPLATE', {
      recordType: 'INSPECTION',
      recordId: id,
      templateCode: existing.code,
      reason,
    });

    return { success: res.ok, error: res.error };
  };

  const assignTemplateToComponent = async (
    componentId: string,
    templateId: string
  ): Promise<{ success: boolean; error?: string }> => {
    const comp = db.components.find((c) => c.id === componentId || c.partNumber === componentId);
    if (!comp) return { success: false, error: 'Component not found.' };

    const templates = db.inspectionTemplates && db.inspectionTemplates.length > 0
      ? db.inspectionTemplates
      : INITIAL_INSPECTION_TEMPLATES;

    const tmpl = templates.find((t) => t.id === templateId || t.code === templateId);
    if (!tmpl) return { success: false, error: 'Template not found.' };

    const updatedComp: Component = {
      ...comp,
      primaryInspectionTemplateId: tmpl.id,
      primaryInspectionTemplateCode: tmpl.code,
      primaryInspectionTemplateRevision: tmpl.revision,
    };

    const newDb: QMSDatabase = {
      ...db,
      components: db.components.map((c) => (c.id === comp.id ? updatedComp : c)),
    };

    const res = await commitDbChange(newDb, 'ASSIGN_INSPECTION_TEMPLATE', {
      recordType: 'COMPONENT',
      recordId: comp.id,
      partNumber: comp.partNumber,
      templateCode: tmpl.code,
      templateRevision: tmpl.revision,
    });

    return { success: res.ok, error: res.error };
  };

  // ==========================================
  // DALE AUTOMATION MANUFACTURING INSPECTION ACTIONS
  // ==========================================

  const createDaleInspection = async (
    record: Omit<DaleInspectionRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<{ success: boolean; id?: string; error?: string }> => {
    const list = db.daleInspections || [];
    const nextCount = list.length + 1;
    const newId = `DALE-INSP-2026-${String(nextCount).padStart(3, '0')}`;
    const newSheetNo = record.sheetNumber || `DALE-INSP-${String(nextCount).padStart(3, '0')}`;
    const now = new Date().toISOString();

    const newRecord: DaleInspectionRecord = {
      ...record,
      id: newId,
      sheetNumber: newSheetNo,
      inspector: record.inspector || currentUser.name,
      inspectorId: record.inspectorId || currentUser.id,
      inspectionDate: record.inspectionDate || now.split('T')[0],
      createdAt: now,
      updatedAt: now,
    };

    const nextList = [newRecord, ...list];
    const res = await commitDbChange(
      { ...db, daleInspections: nextList },
      'CREATE_DALE_INSPECTION',
      {
        recordType: 'INSPECTION',
        recordId: newId,
        sheetNumber: newSheetNo,
        processType: record.processType,
        projectNumber: record.projectNumber,
        partOrSerialNo: record.partOrSerialNo,
      }
    );

    if (res.ok) {
      return { success: true, id: newId };
    }
    return { success: false, error: res.error || 'Failed to save Dale inspection.' };
  };

  const createDaleInspectionsBatch = async (
    records: Omit<DaleInspectionRecord, 'id' | 'createdAt' | 'updatedAt'>[]
  ): Promise<{ success: boolean; createdCount: number; error?: string }> => {
    if (!records || records.length === 0) {
      return { success: true, createdCount: 0 };
    }
    const list = db.daleInspections || [];
    const now = new Date().toISOString();
    let currentCount = list.length;

    const newRecords: DaleInspectionRecord[] = records.map((record) => {
      currentCount += 1;
      const newId = `DALE-INSP-2026-${String(currentCount).padStart(3, '0')}`;
      const newSheetNo = record.sheetNumber || `DALE-INSP-${String(currentCount).padStart(3, '0')}`;
      return {
        ...record,
        id: newId,
        sheetNumber: newSheetNo,
        inspector: record.inspector || currentUser.name,
        inspectorId: record.inspectorId || currentUser.id,
        inspectionDate: record.inspectionDate || now.split('T')[0],
        createdAt: now,
        updatedAt: now,
      };
    });

    const nextList = [...newRecords, ...list];
    const res = await commitDbChange(
      { ...db, daleInspections: nextList },
      'BATCH_CREATE_DALE_INSPECTIONS',
      {
        recordType: 'INSPECTION',
        recordId: `BATCH-${newRecords[0]?.id || 'POOL'}`,
        count: newRecords.length,
      }
    );

    if (res.ok) {
      return { success: true, createdCount: newRecords.length };
    }
    return { success: false, createdCount: 0, error: res.error || 'Failed to batch create inspection sheets.' };
  };

  const updateDaleInspection = async (
    id: string,
    updates: Partial<DaleInspectionRecord>
  ): Promise<{ success: boolean; error?: string }> => {
    const list = db.daleInspections || [];
    const index = list.findIndex((d) => d.id === id);
    if (index === -1) {
      return { success: false, error: 'Inspection sheet not found.' };
    }

    const updated = {
      ...list[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const nextList = [...list];
    nextList[index] = updated;

    const res = await commitDbChange(
      { ...db, daleInspections: nextList },
      'UPDATE_DALE_INSPECTION',
      {
        recordType: 'INSPECTION',
        recordId: id,
        sheetNumber: updated.sheetNumber,
        processType: updated.processType,
      }
    );

    return { success: res.ok, error: res.error };
  };

  const updateDaleInspectionPoint = async (
    inspectionId: string,
    pointId: string,
    updates: Partial<DaleInspectionPoint>
  ): Promise<{ success: boolean; ncrNumber?: string; error?: string }> => {
    const list = db.daleInspections || [];
    const record = list.find((d) => d.id === inspectionId);
    if (!record) return { success: false, error: 'Inspection sheet not found.' };

    const targetPoint = record.points.find((pt) => pt.id === pointId);
    if (!targetPoint) return { success: false, error: 'Inspection point not found.' };

    const updatedPoint: DaleInspectionPoint = {
      ...targetPoint,
      ...updates,
    };

    let nextNcrs = [...(db.ncrs || [])];
    let createdNcrNumber: string | undefined;

    // Check if this point is marked FAIL
    if (updatedPoint.result === 'FAIL') {
      // Each failed point must raise its own distinct NCR (multiple NCRs per checklist)
      let ncrNumber = updatedPoint.ncrReference;

      // Extract specific deviation details
      const deviationText =
        updatedPoint.deviationNotes?.trim() ||
        updatedPoint.comment?.trim() ||
        (updatedPoint.measurementValue ? `Measurement reading: ${updatedPoint.measurementValue}` : '') ||
        `Deviation recorded: Checkpoint "${updatedPoint.description}" failed quality acceptance.`;

      const pointPhotos = updatedPoint.photos && updatedPoint.photos.length > 0
        ? updatedPoint.photos
        : targetPoint.photos || [];

      if (!ncrNumber) {
        // Generate a new unique NCR number
        const existingNcrNumbers = new Set(nextNcrs.map((n) => n.ncrNumber));
        let counter = nextNcrs.length + 1;
        ncrNumber = `NCR-2026-${String(counter).padStart(4, '0')}`;
        while (existingNcrNumbers.has(ncrNumber)) {
          counter += 1;
          ncrNumber = `NCR-2026-${String(counter).padStart(4, '0')}`;
        }

        updatedPoint.ncrReference = ncrNumber;
        createdNcrNumber = ncrNumber;

        const linkedMfg = (db.manufacturingRecords || []).find(
          (m) =>
            m.partNumber === record.partOrSerialNo ||
            m.traceabilityNumber === record.partOrSerialNo ||
            (m.projectNumber === record.projectNumber &&
              (record.machineOrAssembly.includes(m.machineSerialNumber) || m.machineSerialNumber.includes(record.machineOrAssembly)))
        );
        const mfgId = linkedMfg ? linkedMfg.id : `MR-${record.projectNumber}-${(record.partOrSerialNo || 'GEN').replace(/[^A-Za-z0-9]/g, '')}`;

        const autoNcr: NCR = {
          id: ncrNumber,
          ncrNumber,
          manufacturingRecordId: mfgId,
          daleInspectionId: record.id,
          traceabilityNumber: record.partOrSerialNo,
          machineSerialNumber: record.machineOrAssembly,
          projectNumber: record.projectNumber,
          partNumber: record.partOrSerialNo,
          componentDescription: `${record.partName || record.processTitle} — Drawing ${record.drawingNumber}`,
          drawingNumber: record.drawingNumber,
          drawingRevision: record.drawingRevision,
          failedCharacteristics: [
            `Item #${updatedPoint.pointNumber}: ${updatedPoint.description}`,
            ...(updatedPoint.requirement ? [`Requirement: ${updatedPoint.requirement}`] : []),
            ...(updatedPoint.measurementValue ? [`Actual Measurement: ${updatedPoint.measurementValue}`] : []),
            ...(deviationText ? [`Deviation Finding: ${deviationText}`] : []),
          ],
          description: `Deviation on Item #${updatedPoint.pointNumber} (${updatedPoint.description}): ${deviationText}`,
          descriptionOfNonConformance: `Process: ${record.processTitle} — Drawing ${record.drawingNumber} Rev ${record.drawingRevision}.\nChecklist Item #${updatedPoint.pointNumber}: "${updatedPoint.description}".\nRequirement: "${updatedPoint.requirement || 'Conform to drawing specifications'}".\nRecorded Deviation: "${deviationText}".`,
          requirement: updatedPoint.requirement || `Conform to approved Dale engineering drawing ${record.drawingNumber} Rev ${record.drawingRevision}`,
          actualCondition: deviationText,
          immediateContainment: 'Component flagged in QMS checklist Bay Hold. Quarantined pending quality disposition.',
          proposedDisposition: 'REWORK',
          rootCause: `Quality deviation detected on checklist item #${updatedPoint.pointNumber} (${updatedPoint.description}) during ${record.processTitle}.`,
          correctiveAction: 'Rework part/assembly to drawing specification or raise engineering concession deviation.',
          issuePhotoEvidence: pointPhotos,
          responsiblePerson: currentUser.name,
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          status: 'OPEN',
          createdAt: new Date().toISOString(),
          createdBy: currentUser.name,
          createdById: currentUser.id,
        };

        nextNcrs = [autoNcr, ...nextNcrs];
      } else {
        // Update existing NCR with fresh deviation details and photos
        createdNcrNumber = ncrNumber;
        nextNcrs = nextNcrs.map((n) => {
          if (n.ncrNumber === ncrNumber) {
            return {
              ...n,
              issuePhotoEvidence: pointPhotos.length > 0 ? pointPhotos : n.issuePhotoEvidence,
              description: `Deviation on Item #${updatedPoint.pointNumber} (${updatedPoint.description}): ${deviationText}`,
              descriptionOfNonConformance: `Process: ${record.processTitle} — Drawing ${record.drawingNumber} Rev ${record.drawingRevision}.\nChecklist Item #${updatedPoint.pointNumber}: "${updatedPoint.description}".\nRequirement: "${updatedPoint.requirement || 'Conform to drawing specifications'}".\nRecorded Deviation: "${deviationText}".`,
              actualCondition: deviationText,
            };
          }
          return n;
        });
      }
    } else {
      // If photo or comment was added to a point with an existing NCR, sync evidence to the NCR
      if (updatedPoint.ncrReference) {
        const pointPhotos = updatedPoint.photos || targetPoint.photos || [];
        if (pointPhotos.length > 0 || updates.comment || updates.deviationNotes) {
          nextNcrs = nextNcrs.map((n) => {
            if (n.ncrNumber === updatedPoint.ncrReference) {
              return {
                ...n,
                issuePhotoEvidence: pointPhotos.length > 0 ? pointPhotos : n.issuePhotoEvidence,
                actualCondition: updatedPoint.deviationNotes || updatedPoint.comment || n.actualCondition,
              };
            }
            return n;
          });
        }
      }
    }

    const nextPoints = record.points.map((pt) => (pt.id === pointId ? updatedPoint : pt));
    const hasAnyFailedPoints = nextPoints.some((p) => p.result === 'FAIL');
    const allEvaluated = nextPoints.every((p) => p.result === 'PASS' || p.result === 'NA');

    // Aggregate all active NCR numbers on this sheet
    const activePointNcrs = nextPoints
      .filter((p) => p.result === 'FAIL' && p.ncrReference)
      .map((p) => p.ncrReference!);
    const sheetNcrSummary = Array.from(new Set(activePointNcrs)).join(', ');

    let newStatus: DaleInspectionRecord['approvalStatus'] = record.approvalStatus;
    if (hasAnyFailedPoints) {
      newStatus = 'FAIL';
    } else if (!allEvaluated) {
      newStatus = 'PENDING';
    } else {
      newStatus = record.approvalStatus === 'FAIL' ? 'PENDING' : (record.approvalStatus === 'PASS' ? 'PASS' : 'PENDING');
    }

    const updatedSheet: DaleInspectionRecord = {
      ...record,
      points: nextPoints,
      approvalStatus: newStatus,
      ncrReference: sheetNcrSummary || (hasAnyFailedPoints ? createdNcrNumber || 'Pending' : 'None'),
      correctiveAction: hasAnyFailedPoints
        ? `Multiple NCRs raised (${sheetNcrSummary || createdNcrNumber}): components quarantined on Bay Hold.`
        : record.correctiveAction,
      updatedAt: new Date().toISOString(),
    };

    let nextMfgRecords = [...(db.manufacturingRecords || [])];
    const targetMfgIdx = nextMfgRecords.findIndex(
      (m) =>
        m.partNumber === record.partOrSerialNo ||
        m.traceabilityNumber === record.partOrSerialNo ||
        (m.projectNumber === record.projectNumber &&
          (record.machineOrAssembly.includes(m.machineSerialNumber) || m.machineSerialNumber.includes(record.machineOrAssembly)))
    );

    if (targetMfgIdx >= 0) {
      nextMfgRecords[targetMfgIdx] = {
        ...nextMfgRecords[targetMfgIdx],
        manufacturingStatus: (hasAnyFailedPoints
          ? 'NCR_HOLD'
          : nextMfgRecords[targetMfgIdx].manufacturingStatus === 'NCR_HOLD'
          ? 'INSPECTION_PASSED'
          : nextMfgRecords[targetMfgIdx].manufacturingStatus) as any,
      };
    } else {
      const generatedMfgId = `MR-${record.projectNumber}-${(record.partOrSerialNo || 'GEN').replace(/[^A-Za-z0-9]/g, '')}`;
      const dwg = (db.drawings || []).find((d) => d.drawingNumber === record.drawingNumber && d.revision === record.drawingRevision) || (db.drawings || []).find((d) => d.drawingNumber === record.drawingNumber);
      nextMfgRecords.push({
        id: generatedMfgId,
        traceabilityNumber: record.partOrSerialNo,
        machineSerialNumber: record.machineOrAssembly,
        projectNumber: record.projectNumber,
        partNumber: record.partOrSerialNo,
        componentDescription: `${record.partName || record.processTitle} — Drawing ${record.drawingNumber}`,
        drawingNumber: record.drawingNumber,
        drawingRevision: record.drawingRevision,
        drawingSnapshot: dwg ? {
          drawingId: dwg.id,
          drawingNumber: dwg.drawingNumber,
          drawingRevision: dwg.revision,
          approvalStatusAtManufacture: 'APPROVED',
          drawingApprovalDate: dwg.approvalDate || new Date().toISOString().split('T')[0],
          drawingEffectiveDate: dwg.effectiveDate || new Date().toISOString().split('T')[0],
          drawingApprovedBy: dwg.approvedBy || 'Engineering Approval',
          capturedAt: new Date().toISOString(),
        } : undefined,
        quantity: 1,
        manufacturingDate: record.inspectionDate || new Date().toISOString().split('T')[0],
        machinist: record.inspector || currentUser.name,
        machinistId: record.inspectorId || currentUser.id,
        workstation: record.processTitle,
        batchMaterialRef: 'LOT-2026-MFG',
        permanentIdMethod: 'LASER MARKED',
        permanentIdReference: record.partOrSerialNo,
        permanentIdCompleted: true,
        manufacturingStatus: (hasAnyFailedPoints ? 'NCR_HOLD' : 'INSPECTION_PASSED') as any,
        createdBy: currentUser.name,
        createdById: currentUser.id,
        createdDate: new Date().toISOString(),
      });
    }

    const nextList = list.map((s) => (s.id === inspectionId ? updatedSheet : s));

    const newDb: QMSDatabase = {
      ...db,
      daleInspections: nextList,
      ncrs: nextNcrs,
      manufacturingRecords: nextMfgRecords,
    };

    const action = hasAnyFailedPoints
      ? 'AUTO_RECORD_NCR_FROM_INSPECTION_POINT'
      : 'UPDATE_DALE_INSPECTION';

    const res = await commitDbChange(newDb, action, {
      recordType: 'INSPECTION',
      recordId: inspectionId,
      pointId,
      ncrNumber: createdNcrNumber,
      sheetNumber: record.sheetNumber,
      processType: record.processType,
      nonConformance: updatedPoint.description,
    });

    return { success: res.ok, ncrNumber: createdNcrNumber, error: res.error };
  };

  const setAllDaleInspectionPointsPass = async (
    inspectionId: string
  ): Promise<{ success: boolean; error?: string }> => {
    const list = db.daleInspections || [];
    const record = list.find((d) => d.id === inspectionId);
    if (!record) return { success: false, error: 'Inspection sheet not found.' };

    const nextPoints = record.points.map((pt) => ({
      ...pt,
      result: 'PASS' as const,
      comment: pt.comment || 'Verified and conforms to minimum quality standard.',
    }));

    return updateDaleInspection(inspectionId, {
      points: nextPoints,
      approvalStatus: 'PASS',
      approvedBy: `${currentUser.name} (${currentUser.role})`,
      approvalDate: new Date().toISOString().split('T')[0],
      signatureRole: currentUser.role,
    });
  };

  const setAllDaleInspectionPointsNA = async (
    inspectionId: string
  ): Promise<{ success: boolean; error?: string }> => {
    const list = db.daleInspections || [];
    const record = list.find((d) => d.id === inspectionId);
    if (!record) return { success: false, error: 'Inspection sheet not found.' };

    const nextPoints = record.points.map((pt) => ({
      ...pt,
      result: 'NA' as const,
      comment: pt.comment || 'N/A — Not applicable to this machine variant.',
    }));

    return updateDaleInspection(inspectionId, {
      points: nextPoints,
      approvalStatus: 'PENDING',
    });
  };

  const resetDaleInspectionPointsToOpen = async (
    inspectionId: string
  ): Promise<{ success: boolean; error?: string }> => {
    const list = db.daleInspections || [];
    const record = list.find((d) => d.id === inspectionId);
    if (!record) return { success: false, error: 'Inspection sheet not found.' };

    const nextPoints = record.points.map((pt) => ({
      ...pt,
      result: null,
      comment: '',
      deviationNotes: '',
      measurementValue: '',
      ncrReference: undefined,
      photos: [],
    }));

    return updateDaleInspection(inspectionId, {
      points: nextPoints,
      approvalStatus: 'PENDING',
      approvedBy: undefined,
      approvalDate: undefined,
      signatureRole: undefined,
      ncrReference: 'None',
    });
  };

  const submitDaleInspection = async (
    inspectionId: string,
    options?: {
      targetStatus?: 'PASS' | 'FAIL' | 'PENDING' | 'HOLD';
      inspectorComments?: string;
      correctiveAction?: string;
    }
  ): Promise<{ success: boolean; ncrNumbers?: string[]; error?: string }> => {
    const list = db.daleInspections || [];
    const record = list.find((d) => d.id === inspectionId);
    if (!record) return { success: false, error: 'Inspection sheet not found.' };

    const failedPoints = record.points.filter((p) => p.result === 'FAIL');
    let nextNcrs = [...(db.ncrs || [])];
    const createdNcrNumbers: string[] = [];

    // If any points failed, raise dedicated NCRs for each failed point that does not have one yet
    const nextPoints = record.points.map((pt) => {
      if (pt.result === 'FAIL') {
        let ncrNumber = pt.ncrReference;
        const deviationText =
          pt.deviationNotes?.trim() ||
          pt.comment?.trim() ||
          (pt.measurementValue ? `Measurement: ${pt.measurementValue}` : '') ||
          `Checklist item #${pt.pointNumber} (${pt.description}) marked non-conforming.`;

        const pointPhotos = pt.photos && pt.photos.length > 0 ? pt.photos : [];

        if (!ncrNumber) {
          const existingNcrNumbers = new Set(nextNcrs.map((n) => n.ncrNumber));
          let counter = nextNcrs.length + 1;
          ncrNumber = `NCR-2026-${String(counter).padStart(4, '0')}`;
          while (existingNcrNumbers.has(ncrNumber)) {
            counter += 1;
            ncrNumber = `NCR-2026-${String(counter).padStart(4, '0')}`;
          }

          createdNcrNumbers.push(ncrNumber);

          const linkedMfg = (db.manufacturingRecords || []).find(
            (m) =>
              m.partNumber === record.partOrSerialNo ||
              m.traceabilityNumber === record.partOrSerialNo ||
              (m.projectNumber === record.projectNumber &&
                (record.machineOrAssembly.includes(m.machineSerialNumber) || m.machineSerialNumber.includes(record.machineOrAssembly)))
          );
          const generatedMfgId = `MR-${record.projectNumber}-${(record.partOrSerialNo || 'GEN').replace(/[^A-Za-z0-9]/g, '')}`;
          const mfgId = linkedMfg ? linkedMfg.id : generatedMfgId;

          const autoNcr: NCR = {
            id: ncrNumber,
            ncrNumber,
            manufacturingRecordId: mfgId,
            daleInspectionId: record.id,
            traceabilityNumber: record.partOrSerialNo,
            machineSerialNumber: record.machineOrAssembly,
            projectNumber: record.projectNumber,
            partNumber: record.partOrSerialNo,
            componentDescription: `${record.partName || record.processTitle} — Drawing ${record.drawingNumber}`,
            drawingNumber: record.drawingNumber,
            drawingRevision: record.drawingRevision,
            failedCharacteristics: [
              `Item #${pt.pointNumber}: ${pt.description}`,
              ...(pt.requirement ? [`Requirement: ${pt.requirement}`] : []),
              ...(pt.measurementValue ? [`Actual Measurement: ${pt.measurementValue}`] : []),
              ...(deviationText ? [`Deviation Finding: ${deviationText}`] : []),
            ],
            description: `Deviation on Item #${pt.pointNumber} (${pt.description}): ${deviationText}`,
            descriptionOfNonConformance: `Process: ${record.processTitle} — Drawing ${record.drawingNumber} Rev ${record.drawingRevision}.\nChecklist Item #${pt.pointNumber}: "${pt.description}".\nRequirement: "${pt.requirement || 'Conform to drawing specifications'}".\nRecorded Deviation: "${deviationText}".`,
            requirement: pt.requirement || `Conform to approved Dale engineering drawing ${record.drawingNumber} Rev ${record.drawingRevision}`,
            actualCondition: deviationText,
            immediateContainment: 'Component placed on Quality Bay Hold. Quarantined pending disposition.',
            proposedDisposition: 'REWORK',
            rootCause: `Quality deviation detected on checklist item #${pt.pointNumber} (${pt.description}) during ${record.processTitle}.`,
            correctiveAction: 'Rework part/assembly to drawing specification or raise concession deviation.',
            issuePhotoEvidence: pointPhotos,
            responsiblePerson: currentUser.name,
            dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
            status: 'OPEN',
            createdAt: new Date().toISOString(),
            createdBy: currentUser.name,
            createdById: currentUser.id,
          };

          nextNcrs = [autoNcr, ...nextNcrs];
          return { ...pt, ncrReference: ncrNumber };
        } else {
          createdNcrNumbers.push(ncrNumber);
          return pt;
        }
      }
      return pt;
    });

    const hasFailedPoints = nextPoints.some((p) => p.result === 'FAIL');
    const openCount = nextPoints.filter((p) => !p.result || p.result === 'PENDING').length;

    let finalStatus: DaleInspectionRecord['approvalStatus'] = options?.targetStatus || record.approvalStatus;

    if (hasFailedPoints) {
      finalStatus = 'FAIL';
    } else if (openCount === 0 && (!options?.targetStatus || options.targetStatus === 'PASS')) {
      finalStatus = 'PASS';
    } else if (openCount > 0 && options?.targetStatus === 'PASS') {
      return {
        success: false,
        error: `CANNOT SIGN OFF AS PASS: ${openCount} checklist item(s) have NO value recorded. Every point must be evaluated as PASS or N/A before signing off.`,
      };
    } else {
      finalStatus = options?.targetStatus || 'PENDING';
    }

    const allSheetNcrs = nextPoints
      .filter((p) => p.result === 'FAIL' && p.ncrReference)
      .map((p) => p.ncrReference!);
    const sheetNcrSummary = Array.from(new Set(allSheetNcrs)).join(', ');

    const updatedSheet: DaleInspectionRecord = {
      ...record,
      points: nextPoints,
      approvalStatus: finalStatus,
      comments: options?.inspectorComments !== undefined ? options.inspectorComments : record.comments,
      correctiveAction: options?.correctiveAction !== undefined ? options.correctiveAction : record.correctiveAction,
      ncrReference: sheetNcrSummary || (hasFailedPoints ? 'Pending' : 'None'),
      approvedBy: `${currentUser.name} (${currentUser.role})`,
      approvalDate: new Date().toISOString().split('T')[0],
      signatureRole: currentUser.role,
      updatedAt: new Date().toISOString(),
    };

    let nextMfgRecords = [...(db.manufacturingRecords || [])];
    const targetMfgIdx = nextMfgRecords.findIndex(
      (m) =>
        m.partNumber === record.partOrSerialNo ||
        m.traceabilityNumber === record.partOrSerialNo ||
        (m.projectNumber === record.projectNumber &&
          (record.machineOrAssembly.includes(m.machineSerialNumber) || m.machineSerialNumber.includes(record.machineOrAssembly)))
    );

    if (targetMfgIdx >= 0) {
      nextMfgRecords[targetMfgIdx] = {
        ...nextMfgRecords[targetMfgIdx],
        manufacturingStatus: (hasFailedPoints
          ? 'NCR_HOLD'
          : nextMfgRecords[targetMfgIdx].manufacturingStatus === 'NCR_HOLD'
          ? (finalStatus === 'PASS' ? 'INSPECTION_PASSED' : 'UNDER_INSPECTION')
          : nextMfgRecords[targetMfgIdx].manufacturingStatus) as any,
      };
    } else {
      const generatedMfgId = `MR-${record.projectNumber}-${(record.partOrSerialNo || 'GEN').replace(/[^A-Za-z0-9]/g, '')}`;
      nextMfgRecords.push({
        id: generatedMfgId,
        traceabilityNumber: record.partOrSerialNo,
        machineSerialNumber: record.machineOrAssembly,
        projectNumber: record.projectNumber,
        partNumber: record.partOrSerialNo,
        componentDescription: `${record.partName || record.processTitle} — Drawing ${record.drawingNumber}`,
        drawingNumber: record.drawingNumber,
        drawingRevision: record.drawingRevision,
        quantity: 1,
        manufacturingDate: record.inspectionDate || new Date().toISOString().split('T')[0],
        machinist: record.inspector || currentUser.name,
        machinistId: record.inspectorId || currentUser.id,
        workstation: record.processTitle,
        batchMaterialRef: 'LOT-2026-MFG',
        permanentIdMethod: 'LASER MARKED',
        permanentIdReference: record.partOrSerialNo,
        permanentIdCompleted: true,
        manufacturingStatus: (hasFailedPoints ? 'NCR_HOLD' : finalStatus === 'PASS' ? 'INSPECTION_PASSED' : 'UNDER_INSPECTION') as any,
        createdBy: currentUser.name,
        createdById: currentUser.id,
        createdDate: new Date().toISOString(),
      });
    }

    const nextList = list.map((s) => (s.id === inspectionId ? updatedSheet : s));

    const newDb: QMSDatabase = {
      ...db,
      daleInspections: nextList,
      ncrs: nextNcrs,
      manufacturingRecords: nextMfgRecords,
    };

    const res = await commitDbChange(newDb, 'SUBMIT_DALE_INSPECTION', {
      recordType: 'INSPECTION',
      recordId: inspectionId,
      sheetNumber: record.sheetNumber,
      processType: record.processType,
      status: finalStatus,
      ncrsRaised: allSheetNcrs,
    });

    return {
      success: res.ok,
      ncrNumbers: allSheetNcrs,
      error: res.error,
    };
  };

  const approveDaleInspection = async (
    inspectionId: string,
    status: 'PASS' | 'FAIL',
    comments?: string
  ): Promise<{ success: boolean; ncrNumber?: string; error?: string }> => {
    return submitDaleInspection(inspectionId, {
      targetStatus: status,
      inspectorComments: comments,
    }).then((res) => ({
      success: res.success,
      ncrNumber: res.ncrNumbers?.[0],
      error: res.error,
    }));
  };

  const deleteDaleInspection = async (
    id: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (currentUser.role !== 'ADMINISTRATOR') {
      return { success: false, error: 'Only Administrators may delete inspection records.' };
    }
    const nextList = (db.daleInspections || []).filter((d) => d.id !== id);
    const res = await commitDbChange(
      { ...db, daleInspections: nextList },
      'DELETE_DALE_INSPECTION',
      { recordType: 'INSPECTION', recordId: id }
    );
    return { success: res.ok, error: res.error };
  };

  // ==========================================
  // PHASE 2: NCR ACTIONS
  // ==========================================

  const createNCR = async (
    ncrData: Omit<NCR, 'id' | 'ncrNumber' | 'createdAt' | 'createdBy' | 'status'>
  ): Promise<{ success: boolean; ncrNumber?: string; error?: string }> => {
    const ncrNumber = `NCR-2026-${String(db.ncrs.length + 1).padStart(4, '0')}`;
    const newNCR: NCR = {
      ...ncrData,
      id: ncrNumber,
      ncrNumber,
      description: ncrData.description || ncrData.descriptionOfNonConformance || '',
      descriptionOfNonConformance: ncrData.descriptionOfNonConformance || ncrData.description || '',
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      createdBy: currentUser.name,
      createdById: currentUser.id,
    };

    const updatedRecords = db.manufacturingRecords.map((r) =>
      r.id === ncrData.manufacturingRecordId
        ? { ...r, manufacturingStatus: 'NCR_HOLD' as const }
        : r
    );

    const updatedInspections = db.inspections.map((i) =>
      i.id === ncrData.inspectionRecordId ? { ...i, status: 'FAIL' as const, ncrId: ncrNumber } : i
    );

    const newDb: QMSDatabase = {
      ...db,
      ncrs: [newNCR, ...db.ncrs],
      manufacturingRecords: updatedRecords,
      inspections: updatedInspections,
    };

    const res = await commitDbChange(newDb, 'CREATE_NCR', {
      recordType: 'NCR',
      recordId: ncrNumber,
      traceabilityNumber: ncrData.traceabilityNumber,
      machineSerial: ncrData.machineSerialNumber,
      partNumber: ncrData.partNumber,
      disposition: ncrData.proposedDisposition,
      newValue: JSON.stringify(newNCR),
    });

    if (res.ok) {
      return { success: true, ncrNumber };
    }
    return { success: false, error: res.error || 'Failed to create NCR record.' };
  };

  const updateNCR = async (id: string, updates: Partial<NCR>): Promise<boolean> => {
    const existing = db.ncrs.find((n) => n.id === id);
    if (!existing) return false;

    const updatedNCR: NCR = {
      ...existing,
      ...updates,
      approvedById: updates.status === 'CLOSED' ? currentUser.id : existing.approvedById,
    };

    let updatedRecords = db.manufacturingRecords;
    if (updates.status === 'CLOSED') {
      if (updatedNCR.proposedDisposition === 'REWORK') {
        updatedRecords = db.manufacturingRecords.map((r) =>
          r.id === updatedNCR.manufacturingRecordId
            ? { ...r, manufacturingStatus: 'AWAITING_INSPECTION' as const }
            : r
        );
      } else if (updatedNCR.proposedDisposition === 'SCRAP') {
        updatedRecords = db.manufacturingRecords.map((r) =>
          r.id === updatedNCR.manufacturingRecordId
            ? { ...r, manufacturingStatus: 'SCRAPPED' as const }
            : r
        );
      } else if (updatedNCR.proposedDisposition === 'USE_AS_IS_DEVIATION_REQUIRED') {
        updatedRecords = db.manufacturingRecords.map((r) =>
          r.id === updatedNCR.manufacturingRecordId
            ? { ...r, manufacturingStatus: 'DEVIATION_REVIEW' as const }
            : r
        );
      }
    }

    const newDb: QMSDatabase = {
      ...db,
      ncrs: db.ncrs.map((n) => (n.id === id ? updatedNCR : n)),
      manufacturingRecords: updatedRecords,
    };

    const action = updates.status === 'CLOSED' ? 'CLOSE_NCR' : 'UPDATE_NCR';
    const res = await commitDbChange(newDb, action, {
      recordType: 'NCR',
      recordId: existing.ncrNumber,
      previousValue: JSON.stringify(existing),
      newValue: JSON.stringify(updatedNCR),
    });
    if (!res.ok && res.error) alert(res.error);
    return res.ok;
  };

  // ==========================================
  // PHASE 2: DEVIATION & REDLINE FILE CONTROL
  // ==========================================

  const createDeviation = async (
    devData: Omit<Deviation, 'id' | 'deviationNumber' | 'createdAt' | 'createdBy' | 'engineeringApproved'>
  ): Promise<{ success: boolean; deviationNumber?: string; ncrNumber?: string; error?: string }> => {
    const deviationNumber = `DEV-2026-${String(db.deviations.length + 1).padStart(4, '0')}`;
    const ncrNumber = `NCR-2026-${String(db.ncrs.length + 1).padStart(4, '0')}`;

    // Requirement 13: Do NOT auto-create a fake filename when no file was uploaded.
    // If redlined drawing is required and no real file is attached, status is INCOMPLETE.
    const hasRedlineFile = Boolean(devData.redlineFile && devData.redlineFile.fileId);
    const initialStatus =
      devData.requiresRedline && !hasRedlineFile
        ? 'INCOMPLETE'
        : 'AWAITING_APPROVAL';

    const newDev: Deviation = {
      ...devData,
      id: deviationNumber,
      deviationNumber,
      ncrId: ncrNumber,
      redlineAttachmentName: devData.redlineFile ? devData.redlineFile.originalFilename : undefined,
      engineeringApproved: false,
      status: initialStatus,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.name,
      createdById: currentUser.id,
    };

    // Auto-record an NCR for this deviation or engineering change
    const autoNCR: NCR = {
      id: ncrNumber,
      ncrNumber,
      manufacturingRecordId: devData.manufacturingRecordId,
      inspectionRecordId: devData.inspectionRecordId,
      deviationId: deviationNumber,
      traceabilityNumber: devData.traceabilityNumber,
      machineSerialNumber: devData.machineSerialNumber,
      projectNumber: devData.projectNumber,
      partNumber: devData.partNumber,
      componentDescription: devData.partNumber,
      drawingNumber: devData.originalDrawingNumber,
      drawingRevision: devData.originalDrawingRevision,
      failedCharacteristics: devData.affectedCharacteristicNames?.length
        ? devData.affectedCharacteristicNames
        : ['Engineering Departure / Drawing Deviation'],
      description: `Automatic NCR raised for Deviation ${deviationNumber}: ${devData.descriptionOfChange}`,
      descriptionOfNonConformance: `Manufacturing deviation / change departing from approved drawing ${devData.originalDrawingNumber} Rev ${devData.originalDrawingRevision}. Reason: ${devData.reasonForDeviation}`,
      requirement: `Conform to original approved engineering drawing ${devData.originalDrawingNumber} Rev ${devData.originalDrawingRevision}`,
      actualCondition: `Departure requested under Deviation ${deviationNumber}: ${devData.descriptionOfChange}`,
      immediateContainment:
        'Component placed on Quality Hold / Deviation Review pending authorized Engineering & HSEQ sign-off.',
      proposedDisposition:
        devData.approvedConcessionDisposition === 'REWORK_TO_REDLINE'
          ? 'REWORK'
          : 'USE_AS_IS_DEVIATION_REQUIRED',
      rootCause: `Engineering or workshop deviation: ${devData.reasonForDeviation}`,
      correctiveAction: `Review and formalize deviation ${deviationNumber} with redlined drawing control prior to Quality Release.`,
      responsiblePerson: currentUser.name,
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      createdBy: currentUser.name,
      createdById: currentUser.id,
    };

    const updatedManufacturingRecords = db.manufacturingRecords.map((r) =>
      r.id === devData.manufacturingRecordId
        ? { ...r, manufacturingStatus: 'NCR_HOLD' as const }
        : r
    );

    const newDb: QMSDatabase = {
      ...db,
      deviations: [newDev, ...db.deviations],
      ncrs: [autoNCR, ...db.ncrs],
      manufacturingRecords: updatedManufacturingRecords,
    };

    const res = await commitDbChange(newDb, 'CREATE_DEVIATION_AND_AUTO_NCR', {
      recordType: 'DEVIATION',
      recordId: deviationNumber,
      ncrNumber,
      traceabilityNumber: devData.traceabilityNumber,
      machineSerial: devData.machineSerialNumber,
      partNumber: devData.partNumber,
      hasRedlineFile,
      status: initialStatus,
      newValue: JSON.stringify(newDev),
    });

    if (res.ok) {
      return { success: true, deviationNumber, ncrNumber };
    }
    return { success: false, error: res.error || 'Failed to create Deviation record.' };
  };

  const updateDeviation = async (
    id: string,
    updates: Partial<Deviation>
  ): Promise<{ success: boolean; error?: string }> => {
    const existing = db.deviations.find((d) => d.id === id);
    if (!existing) return { success: false, error: 'Deviation record not found.' };

    const mergedRedlineFile = updates.redlineFile || existing.redlineFile;
    const requiresRedline =
      updates.requiresRedline !== undefined ? updates.requiresRedline : existing.requiresRedline;

    // Requirement 13: NO FILE = DEVIATION INCOMPLETE -> Cannot approve without real redline file
    if (updates.status === 'APPROVED' || updates.engineeringApproved === true) {
      const canApprove = ['ENGINEERING', 'HSEQ', 'ADMINISTRATOR'].includes(currentUser.role);
      if (!canApprove) {
        return {
          success: false,
          error: `PERMISSION DENIED: Only Engineering, HSEQ, or Administrator roles may approve deviations (Your role: ${currentUser.role}).`,
        };
      }

      if (requiresRedline && (!mergedRedlineFile || !mergedRedlineFile.fileId)) {
        return {
          success: false,
          error:
            'DEVIATION INCOMPLETE (NO REDLINE FILE): A real redlined drawing file must be uploaded and attached before this deviation can be approved.',
        };
      }

      updates.approvedBy = currentUser.name;
      updates.approvedById = currentUser.id;
      updates.approvalDate = new Date().toISOString().split('T')[0];
      updates.engineeringApproved = true;
      updates.status = 'APPROVED';
    } else if (mergedRedlineFile && existing.status === 'INCOMPLETE') {
      updates.status = 'AWAITING_APPROVAL';
    }

    if (mergedRedlineFile) {
      updates.redlineAttachmentName = mergedRedlineFile.originalFilename;
    }

    const updatedDev: Deviation = { ...existing, ...updates };
    const updatedDeviations = db.deviations.map((d) => (d.id === id ? updatedDev : d));

    // Sync any linked inspection characteristics so ACCEPTED_BY_APPROVED_DEVIATION updates immediately
    const updatedInspections = db.inspections.map((insp) => {
      if (insp.manufacturingRecordId === updatedDev.manufacturingRecordId) {
        const devsForMfg = updatedDeviations.filter(
          (d) => d.manufacturingRecordId === insp.manufacturingRecordId
        );
        const syncedChars = DBService.syncCharacteristicsWithDeviations(insp.characteristics, devsForMfg);
        return {
          ...insp,
          characteristics: syncedChars,
          deviationId: updatedDev.deviationNumber,
          updatedAt: new Date().toISOString(),
        };
      }
      return insp;
    });

    const newDb: QMSDatabase = {
      ...db,
      deviations: updatedDeviations,
      inspections: updatedInspections,
    };

    const action = updatedDev.engineeringApproved && !existing.engineeringApproved
      ? 'APPROVE_DEVIATION'
      : 'UPDATE_DEVIATION';

    const res = await commitDbChange(newDb, action, {
      recordType: 'DEVIATION',
      recordId: existing.deviationNumber,
      previousValue: JSON.stringify(existing),
      newValue: JSON.stringify(updatedDev),
    });

    if (!res.ok) {
      return { success: false, error: res.error };
    }
    return { success: true };
  };

  // ==========================================
  // PHASE 2: 18-POINT QUALITY RELEASE GATE
  // ==========================================

  const evaluateQualityRelease = (manufacturingRecordId: string): QualityReleaseEvaluation => {
    return DBService.evaluateQualityReleaseGates(db, manufacturingRecordId, authSession ? currentUser : null);
  };

  const executeQualityRelease = async (
    manufacturingRecordId: string,
    notes?: string
  ): Promise<{ success: boolean; releaseId?: string; error?: string }> => {
    const evaluation = evaluateQualityRelease(manufacturingRecordId);
    if (!evaluation.canRelease) {
      // Log blocked attempt
      await fetch('/api/audit', {
        method: 'POST',
        headers: DBService.getAuthHeaders(),
        body: JSON.stringify({
          action: 'QUALITY_RELEASE_BLOCKED',
          recordType: 'RELEASE',
          recordId: evaluation.manufacturingRecord?.traceabilityNumber || manufacturingRecordId,
          details: { blockingReasons: evaluation.blockingReasons },
        }),
      }).catch(() => {});

      return {
        success: false,
        error: `QUALITY RELEASE BLOCKED: ${evaluation.blockingReasons.join(' | ')}`,
      };
    }

    const record = evaluation.manufacturingRecord!;
    const inspection = evaluation.inspection;

    const usedDeviation = evaluation.approvedDeviations.length > 0;
    const releaseId = `REL-2026-${String(db.releases.length + 1).padStart(4, '0')}`;
    const newRelease: QualityReleaseRecord = {
      id: releaseId,
      releaseId,
      manufacturingRecordId: record.id,
      inspectionRecordId: inspection?.id,
      traceabilityNumber: record.traceabilityNumber,
      machineSerialNumber: record.machineSerialNumber,
      projectNumber: record.projectNumber,
      partNumber: record.partNumber,
      releasedBy: currentUser.name,
      releasedById: currentUser.id,
      releasedByRole: currentUser.role,
      releaseDate: new Date().toISOString().split('T')[0],
      releaseTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      releaseResult: usedDeviation
        ? 'PASS WITH APPROVED DEVIATION - RELEASED'
        : 'PASS - RELEASED',
      ncrReference: evaluation.openNcrs.length > 0 ? evaluation.openNcrs[0].ncrNumber : undefined,
      deviationReference: usedDeviation
        ? evaluation.approvedDeviations.map((d) => d.deviationNumber).join(', ')
        : undefined,
      notes:
        notes ||
        (usedDeviation
          ? `Released with Approved Deviation (${evaluation.approvedDeviations
              .map((d) => d.deviationNumber)
              .join(', ')}). All 18 quality release gates verified.`
          : 'All 18 quality release gate criteria verified and compliant.'),
    };

    const updatedRecords = db.manufacturingRecords.map((r) =>
      r.id === record.id ? { ...r, manufacturingStatus: 'RELEASED' as const } : r
    );

    const newDb: QMSDatabase = {
      ...db,
      releases: [newRelease, ...db.releases],
      manufacturingRecords: updatedRecords,
    };

    const res = await commitDbChange(newDb, 'QUALITY_RELEASE_EXECUTED', {
      recordType: 'RELEASE',
      recordId: releaseId,
      manufacturingRecordId: record.id,
      traceabilityNumber: record.traceabilityNumber,
      machineSerialNumber: record.machineSerialNumber,
      partNumber: record.partNumber,
      releasingOfficer: currentUser.name,
      releasingOfficerId: currentUser.id,
      releasingRole: currentUser.role,
      deviationReference: newRelease.deviationReference,
      newValue: JSON.stringify(newRelease),
    });

    if (res.ok) {
      return { success: true, releaseId };
    }
    return { success: false, error: res.error || 'Database commit failed during Quality Release.' };
  };

  const recordComponentFitment = async (
    fitmentData: Omit<ComponentFitmentRecord, 'id' | 'fittedAt'>
  ): Promise<{ success: boolean; fitment?: ComponentFitmentRecord; error?: string }> => {
    const res = DBService.recordComponentFitment(db, fitmentData);
    if (!res.success || !res.updatedDb) {
      return { success: false, error: res.error || 'Failed to record component fitment.' };
    }

    const commitRes = await commitDbChange(res.updatedDb, 'RECORD_COMPONENT_FITMENT', {
      recordType: 'FITMENT',
      recordId: res.fitment?.id || fitmentData.traceabilityNumber,
      machineSerialNumber: fitmentData.machineSerialNumber,
      traceabilityNumber: fitmentData.traceabilityNumber,
      partNumber: fitmentData.partNumber,
      fittedBy: fitmentData.fittedBy,
      fittedById: fitmentData.fittedById,
    });

    if (commitRes.ok) {
      return { success: true, fitment: res.fitment };
    }
    return { success: false, error: commitRes.error || 'Database commit failed during component fitment.' };
  };

  const removeComponentFitment = async (
    fitmentId: string
  ): Promise<{ success: boolean; error?: string }> => {
    const existingFitments = db.componentFitments || [];
    const target = existingFitments.find((f) => f.id === fitmentId);
    if (!target) return { success: false, error: 'Fitment record not found.' };

    const updatedFitments = existingFitments.filter((f) => f.id !== fitmentId);
    const updatedMachines = db.machines.map((m) => {
      if (m.serialNumber === target.machineSerialNumber && m.fittedComponents) {
        return {
          ...m,
          fittedComponents: m.fittedComponents.filter((f) => f.id !== fitmentId),
        };
      }
      return m;
    });

    const newDb: QMSDatabase = {
      ...db,
      componentFitments: updatedFitments,
      machines: updatedMachines,
    };

    const commitRes = await commitDbChange(newDb, 'REMOVE_COMPONENT_FITMENT', {
      recordType: 'FITMENT',
      recordId: fitmentId,
      machineSerialNumber: target.machineSerialNumber,
      traceabilityNumber: target.traceabilityNumber,
    });

    return { success: commitRes.ok, error: commitRes.error };
  };

  return (
    <QMSContext.Provider
      value={{
        db,
        currentUser,
        authSession,
        isAuthenticated: Boolean(authSession),
        activeWorkshopDepartment,
        setActiveWorkshopDepartment,
        login,
        registerProfile,
        logout,
        setCurrentUser,
        isLoading,
        isSyncing,
        lastSynced,
        error,
        uploadAttachmentFile,
        addMachine,
        importMachines,
        updateMachine,
        addProject,
        importProjects,
        updateProject,
        addComponent,
        importComponents,
        updateComponent,
        addDrawing,
        importDrawings,
        importMachineBomPackage,
        updateDrawing,
        createDrawingRevision,
        addManufacturingRecord,
        updateManufacturingRecord,
        completePermanentIdentification,
        startInspection,
        recordDepartmentHandover,
        updateInspection,
        addInspectionCharacteristic,
        recordCharacteristicReading,
        updateInspectionQualityCheck,
        updateCharacteristicDrawingNominal,
        signOffInspection,
        createInspectionTemplate,
        updateInspectionTemplate,
        approveInspectionTemplate,
        reviseInspectionTemplate,
        obsoleteInspectionTemplate,
        assignTemplateToComponent,
        createNCR,
        updateNCR,
        createDeviation,
        updateDeviation,
        evaluateQualityRelease,
        executeQualityRelease,
        recordComponentFitment,
        removeComponentFitment,
        updateSettings,
        resetToDefaultData,
        importDatabaseJson,
        refreshDatabase,
        deleteMachine,
        deleteProject,
        deleteComponent,
        deleteDrawing,
        deleteDrawingPart,
        clearDrawingPartsList,
        createDaleInspection,
        createDaleInspectionsBatch,
        updateDaleInspection,
        updateDaleInspectionPoint,
        setAllDaleInspectionPointsPass,
        setAllDaleInspectionPointsNA,
        resetDaleInspectionPointsToOpen,
        approveDaleInspection,
        submitDaleInspection,
        deleteDaleInspection,
        deleteManufacturingRecord,
        deleteInspection,
        deleteInspectionCharacteristic,
        deleteNCR,
        deleteDeviation,
        deleteRelease,
        deleteUser,
        clearCollectionList,
        crossNavTarget,
        navigateToCrossRef,
        clearCrossNavTarget,
      }}
    >
      {children}
    </QMSContext.Provider>
  );
};

export const useQMS = () => {
  const context = useContext(QMSContext);
  if (!context) {
    throw new Error('useQMS must be used within a QMSProvider');
  }
  return context;
};
