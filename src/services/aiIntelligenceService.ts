/**
 * MACHINE QMS - Client AI Intelligence Service
 * Interacts with server-side AI endpoints (/api/ai/*)
 * Note: Never imports @google/genai on the client.
 */

import type { DaleInspectionPoint, DaleProcessType, DrawingPartItem } from '../types';

export interface AILogEntry {
  id: string;
  timestamp: string;
  action: string;
  title: string;
  projectNumber?: string;
  machineSerial?: string;
  partNumber?: string;
  drawingNumber?: string;
  itemsProcessed: number;
  details: string;
  source: string;
  success: boolean;
}

export interface AIStatusSummary {
  engineStatus: 'ACTIVE' | 'IDLE' | 'PROCESSING';
  model: string;
  hasApiKey: boolean;
  backgroundWorkerActive: boolean;
  autoPopulateOnCreation: boolean;
  lastBackgroundSweepAt: string | null;
  statistics: {
    totalDrawingsIdentified: number;
    totalPartsCategorized: number;
    totalChecklistsPopulated: number;
    totalInspectionPointsVerified: number;
    backgroundSweepsCompleted: number;
  };
  recentLogs: AILogEntry[];
}

export interface ComplianceAuditResult {
  timestamp: string;
  totalMachinesAudited: number;
  openHoldingPoints: number;
  openNcrs: number;
  unapprovedDeviations: number;
  criticalReadinessScore: number;
  findings: Array<{
    severity: 'CRITICAL_HOLD' | 'HIGH_RISK' | 'CONFORMANCE_NOTICE';
    machineSerial: string;
    projectNumber: string;
    title: string;
    details: string;
    recommendedAction: string;
  }>;
}

export const AIIntelligenceService = {
  /**
   * Get real-time AI background service status (Admin only)
   */
  async getStatus(): Promise<{ success: boolean; data?: AIStatusSummary; error?: string }> {
    try {
      const res = await fetch('/api/ai/status');
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      const data = await res.json();
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to fetch AI status' };
    }
  },

  /**
   * Trigger plant-wide background auto-population sweep (Admin only)
   */
  async runAutoPopulateAll(): Promise<{
    success: boolean;
    populatedSheets?: number;
    processedDrawings?: number;
    enrichedComponents?: number;
    totalChecklistPoints?: number;
    summary?: string;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/ai/auto-populate-all-missing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to execute auto-population sweep' };
      }
      return data;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error while triggering AI sweep' };
    }
  },

  /**
   * Identify Drawing & Decompose Parts (BOM)
   */
  async identifyDrawingParts(params: {
    drawingTitle?: string;
    drawingNumber?: string;
    projectReference?: string;
    machineType?: string;
    drawingText?: string;
    rawFilename?: string;
  }): Promise<{
    success: boolean;
    data?: {
      drawingNumber: string;
      drawingTitle: string;
      revision: string;
      elementCode: string;
      projectReference: string;
      partsList: DrawingPartItem[];
      criticalComponentsIdentified: string[];
      manufacturingProcessSummary: string;
      source: string;
    };
    error?: string;
  }> {
    try {
      const res = await fetch('/api/ai/identify-drawing-parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Failed to identify drawing' };
      }
      return { success: true, data: json.data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Drawing identification request failed' };
    }
  },

  /**
   * Populate Smart, Unskippable Checklist for Part / Machine / Project
   */
  async populateChecklistForPart(params: {
    projectNumber: string;
    projectName?: string;
    customer?: string;
    machineType?: string;
    machineSerial: string;
    partNumber: string;
    partDescription: string;
    processType: DaleProcessType;
    drawingNumber: string;
    drawingRevision: string;
    material?: string;
    category?: string;
  }): Promise<{
    success: boolean;
    points?: DaleInspectionPoint[];
    processTitle?: string;
    guidanceNotes?: string;
    source?: string;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/ai/populate-checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Failed to populate checklist' };
      }
      return {
        success: true,
        points: json.points,
        processTitle: json.processTitle,
        guidanceNotes: json.guidanceNotes,
        source: json.source,
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Checklist population request failed' };
    }
  },

  /**
   * Run Compliance & Quality Release Gate Audit
   */
  async runComplianceAudit(): Promise<{
    success: boolean;
    data?: ComplianceAuditResult;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/ai/audit-manufacturing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to run manufacturing audit' };
      }
      return { success: true, data: data.audit };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Audit request failed' };
    }
  },

  /**
   * Update AI Automation Settings
   */
  async setAutomationPolicy(policy: { autoPopulateOnCreation?: boolean }): Promise<boolean> {
    try {
      const res = await fetch('/api/ai/toggle-automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy),
      });
      const json = await res.json();
      return Boolean(json.success);
    } catch {
      return false;
    }
  },
};
