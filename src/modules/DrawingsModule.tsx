import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useQMS } from '../context/QMSContext';
import { Drawing, DrawingPartItem, DrawingStatus, FileAttachmentMetadata } from '../types';
import { getDrawingCrossReferences } from '../utils/crossReference';
import { DBService } from '../services/db';
import { parseEngineeringDrawingFile } from '../utils/pdfDrawingParser';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { PhotoEvidenceGallery } from '../components/PhotoEvidenceGallery';
import { MachineBomImportModal } from '../components/MachineBomImportModal';
import {
  parseMachineBomWorkbook,
  buildMachineImportPayloads,
} from '../utils/machineBomExcelParser';
import {
  FileSpreadsheet,
  Plus,
  Search,
  CheckCircle2,
  GitBranch,
  Download,
  Upload,
  History,
  FileText,
  Trash2,
  Layers,
  Edit3,
  Sparkles,
  Archive,
  Eye,
  RotateCcw,
  Camera,
  Image as ImageIcon,
  ZoomIn,
  X,
  AlertTriangle,
  FolderKanban,
  Cpu,
  Hammer,
  ExternalLink,
} from 'lucide-react';

interface ParsedDrawingPartImportRow {
  rowNumber: number;
  itemNumber: string;
  quantity: string;
  partNumber: string;
  description: string;
  material: string;
  designation: string;
  orderNumber: string;
  vendor: string;
  isValid: boolean;
  errors: string[];
}

interface ParsedDrawingRegisterImportRow {
  rowNumber: number;
  drawingNumber: string;
  revision: string;
  drawingTitle: string;
  elementCode: string;
  projectReference: string;
  drawingStatus: DrawingStatus;
  effectiveDate: string;
  itemNumber: string;
  quantity: string;
  partNumber: string;
  partDescription: string;
  material: string;
  designation: string;
  orderNumber: string;
  vendor: string;
  revisionNotes: string;
  isValid: boolean;
  errors: string[];
}

const createEmptyPartRow = (index: number): DrawingPartItem => ({
  id: `PT-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 5)}`,
  itemNumber: String(index),
  quantity: '1',
  partNumber: '',
  description: '',
  material: '',
  designation: '',
  orderNumber: '',
  vendor: '',
});

const isImageAttachment = (att?: FileAttachmentMetadata | null): boolean => {
  if (!att) return false;
  if (att.mimeType && att.mimeType.toLowerCase().startsWith('image/')) return true;
  return /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(att.originalFilename || '');
};

export const DrawingsModule: React.FC = () => {
  const {
    db,
    currentUser,
    addDrawing,
    importDrawings,
    updateDrawing,
    createDrawingRevision,
    uploadAttachmentFile,
    deleteDrawing,
    deleteDrawingPart,
    clearDrawingPartsList,
    clearCollectionList,
    crossNavTarget,
    navigateToCrossRef,
    clearCrossNavTarget,
  } = useQMS();

  const isAdmin = currentUser.role === 'ADMINISTRATOR';
  const [confirmDeleteDrawingId, setConfirmDeleteDrawingId] = useState<string | null>(null);
  const [confirmClearDrawingsList, setConfirmClearDrawingsList] = useState(false);
  const [confirmClearBomDrawingId, setConfirmClearBomDrawingId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  // Version History Toggle: 'CURRENT' | 'ARCHIVED' | 'ALL'
  const [versionViewMode, setVersionViewMode] = useState<'CURRENT' | 'ARCHIVED' | 'ALL'>('ALL');
  // Per-drawing inline version switcher state (maps drawingNumber -> selected drawing.id)
  const [selectedVersionByDwgNo, setSelectedVersionByDwgNo] = useState<Record<string, string>>({});

  useEffect(() => {
    if (crossNavTarget && crossNavTarget.tab === 'drawings') {
      if (crossNavTarget.searchQuery) {
        setSearchTerm(crossNavTarget.searchQuery);
        const matched =
          db.drawings.find((d) => d.id === crossNavTarget.recordId) ||
          db.drawings.find(
            (d) =>
              d.isCurrent &&
              d.drawingNumber.toUpperCase() === crossNavTarget.searchQuery?.toUpperCase()
          ) ||
          db.drawings.find(
            (d) => d.drawingNumber.toUpperCase() === crossNavTarget.searchQuery?.toUpperCase()
          );
        if (matched) {
          setViewingDrawing(matched);
          setShowEmbeddedPdfPreview(true);
        }
      }
      clearCrossNavTarget();
    }
  }, [crossNavTarget, db.drawings, clearCrossNavTarget]);

  const crossRefsByDrawingId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getDrawingCrossReferences>>();
    db.drawings.forEach((d) => {
      map.set(d.id, getDrawingCrossReferences(db, d));
    });
    return map;
  }, [db]);

  // New / Edit Drawing Modal
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingDrawingId, setEditingDrawingId] = useState<string | null>(null);

  const [newDrawingForm, setNewDrawingForm] = useState({
    drawingNumber: '',
    drawingTitle: '',
    revision: '0',
    drawingStatus: 'APPROVED' as DrawingStatus,
    effectiveDate: new Date().toISOString().split('T')[0],
    revisionNotes: 'ISSUED FOR MANUFACTURE.',
    projectReference: '',
    elementCode: '',
    scale: 'A.O.D.',
    sheetSize: 'A3',
    sheetNumber: '1 / 1',
    modelledBy: '',
    modelledDate: '',
    detailedBy: '',
    detailedDate: '',
    referenceDrawings: '',
  });

  // Multiple parts on one drawing (manual text entry only, no dropdown or fixed values)
  const [partsList, setPartsList] = useState<DrawingPartItem[]>([createEmptyPartRow(1)]);

  const [newDrawingFile, setNewDrawingFile] = useState<File | null>(null);
  const [newDrawingImagePreviewUrl, setNewDrawingImagePreviewUrl] = useState<string | null>(null);
  const [newDrawingRevisionPhotos, setNewDrawingRevisionPhotos] = useState<FileAttachmentMetadata[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [fileParseBanner, setFileParseBanner] = useState<{
    type: 'success' | 'info' | 'error';
    message: string;
  } | null>(null);

  // View / Manage Parts & Version History Modal for an existing drawing
  const [viewingDrawing, setViewingDrawing] = useState<Drawing | null>(null);
  const [showEmbeddedPdfPreview, setShowEmbeddedPdfPreview] = useState(false);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<{
    url: string;
    title: string;
  } | null>(null);

  // Issue New Revision Modal (supports PDF AND Image/Photo controlled prints + additional revision photos)
  const [revTargetDrawing, setRevTargetDrawing] = useState<Drawing | null>(null);
  const [newRevisionCode, setNewRevisionCode] = useState('');
  const [revisionChangeNotes, setRevisionChangeNotes] = useState('');
  const [revisionEffectiveDate, setRevisionEffectiveDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [revisionStatus, setRevisionStatus] = useState<DrawingStatus>('APPROVED');
  const [revisionDrawingTitle, setRevisionDrawingTitle] = useState('');
  const [revisionElementCode, setRevisionElementCode] = useState('');
  const [revisionProjectReference, setRevisionProjectReference] = useState('');
  const [revisionScale, setRevisionScale] = useState('');
  const [revisionSheetSize, setRevisionSheetSize] = useState('');
  const [revisionSheetNumber, setRevisionSheetNumber] = useState('');
  const [revisionModelledBy, setRevisionModelledBy] = useState('');
  const [revisionModelledDate, setRevisionModelledDate] = useState('');
  const [revisionDetailedBy, setRevisionDetailedBy] = useState('');
  const [revisionDetailedDate, setRevisionDetailedDate] = useState('');
  const [revisionReferenceDrawings, setRevisionReferenceDrawings] = useState('');
  const [revisionFile, setRevisionFile] = useState<File | null>(null);
  const [revisionFilePreviewUrl, setRevisionFilePreviewUrl] = useState<string | null>(null);
  const [revisionPdfPreviewUrl, setRevisionPdfPreviewUrl] = useState<string | null>(null);
  const [revisionShowPdfPreview, setRevisionShowPdfPreview] = useState(true);
  const [revisionAdditionalPhotos, setRevisionAdditionalPhotos] = useState<FileAttachmentMetadata[]>([]);
  const [revisionPartsList, setRevisionPartsList] = useState<DrawingPartItem[]>([]);
  const [isParsingRevFile, setIsParsingRevFile] = useState(false);
  const [revOcrProgress, setRevOcrProgress] = useState<number | null>(null);
  const [revParseBanner, setRevParseBanner] = useState<{
    type: 'success' | 'info' | 'error';
    message: string;
  } | null>(null);
  const [isRevDraggingOver, setIsRevDraggingOver] = useState(false);
  const [existingDwgMatch, setExistingDwgMatch] = useState<{
    drawing: Drawing;
    newRev: string;
    file: File;
  } | null>(null);
  const [isGlobalRevPdfScanning, setIsGlobalRevPdfScanning] = useState(false);

  const canManageDrawings = ['ENGINEERING', 'HSEQ', 'ADMINISTRATOR', 'MACHINE_MANAGER'].includes(
    currentUser.role
  );

  // Group all versions by drawingNumber so any drawing can switch between Current & Archived revisions
  const versionsByDrawingNumber = useMemo(() => {
    const map: Record<string, Drawing[]> = {};
    for (const d of db.drawings) {
      const key = d.drawingNumber.trim().toUpperCase();
      if (!map[key]) map[key] = [];
      map[key].push(d);
    }
    // Sort each drawing's versions so Current is first, followed by newest effectiveDate/revision
    Object.keys(map).forEach((key) => {
      map[key].sort((a, b) => {
        if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
        return b.revision.localeCompare(a.revision, undefined, { numeric: true });
      });
    });
    return map;
  }, [db.drawings]);

  const currentCount = useMemo(
    () => db.drawings.filter((d) => d.isCurrent && d.drawingStatus !== 'SUPERSEDED').length,
    [db.drawings]
  );
  const archivedCount = useMemo(
    () =>
      db.drawings.filter(
        (d) => !d.isCurrent || d.drawingStatus === 'SUPERSEDED' || d.drawingStatus === 'OBSOLETE'
      ).length,
    [db.drawings]
  );

  const filteredDrawings = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return db.drawings.filter((d) => {
      const partsText = [
        d.partNumber,
        ...(d.partNumbers || []),
        ...(d.partsList || []).map((p) => `${p.partNumber} ${p.description} ${p.material}`),
      ]
        .join(' ')
        .toLowerCase();

      const matchesSearch =
        d.drawingNumber.toLowerCase().includes(q) ||
        d.drawingTitle.toLowerCase().includes(q) ||
        partsText.includes(q) ||
        (d.projectReference || '').toLowerCase().includes(q) ||
        (d.elementCode || '').toLowerCase().includes(q) ||
        d.revision.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'ALL' || d.drawingStatus === statusFilter;

      const isArchived =
        !d.isCurrent || d.drawingStatus === 'SUPERSEDED' || d.drawingStatus === 'OBSOLETE';
      const matchesVersionToggle =
        versionViewMode === 'ALL'
          ? true
          : versionViewMode === 'CURRENT'
          ? !isArchived
          : isArchived;

      return matchesSearch && matchesStatus && matchesVersionToggle;
    });
  }, [db.drawings, searchTerm, statusFilter, versionViewMode]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const attachmentToFile = async (att: FileAttachmentMetadata): Promise<File | null> => {
    try {
      const url = DBService.resolveAttachmentPreviewUrl(att);
      if (!url) return null;
      const res = await fetch(url);
      const blob = await res.blob();
      return new File([blob], att.originalFilename || 'drawing-photo.jpg', {
        type: att.mimeType || blob.type || 'image/jpeg',
      });
    } catch {
      return null;
    }
  };

  const getDrawingPartsArray = (dwg: Drawing): DrawingPartItem[] => {
    if (dwg.partsList && dwg.partsList.length > 0) {
      return dwg.partsList.map((p) => ({ ...p }));
    }
    const rawParts =
      dwg.partNumbers && dwg.partNumbers.length > 0
        ? dwg.partNumbers
        : dwg.partNumber
        ? dwg.partNumber
            .split(/[;,]/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    if (rawParts.length > 0) {
      return rawParts.map((pn, idx) => ({
        id: `${dwg.id}-P-${idx + 1}`,
        itemNumber: String(idx + 1),
        quantity: '1',
        partNumber: pn,
        description: dwg.drawingTitle,
        material: '',
        designation: 'MANUF-INT',
        orderNumber: '',
        vendor: '',
      }));
    }
    return [createEmptyPartRow(1)];
  };

  const resetDrawingModal = () => {
    setEditingDrawingId(null);
    setNewDrawingForm({
      drawingNumber: '',
      drawingTitle: '',
      revision: '0',
      drawingStatus: 'APPROVED',
      effectiveDate: new Date().toISOString().split('T')[0],
      revisionNotes: 'ISSUED FOR MANUFACTURE.',
      projectReference: '',
      elementCode: '',
      scale: 'A.O.D.',
      sheetSize: 'A3',
      sheetNumber: '1 / 1',
      modelledBy: '',
      modelledDate: '',
      detailedBy: '',
      detailedDate: '',
      referenceDrawings: '',
    });
    setPartsList([createEmptyPartRow(1)]);
    setNewDrawingFile(null);
    setNewDrawingImagePreviewUrl(null);
    setNewDrawingRevisionPhotos([]);
    setFileParseBanner(null);
    setOcrProgress(null);
    setExistingDwgMatch(null);
  };

  const handleOpenEditDrawing = (dwg: Drawing) => {
    setEditingDrawingId(dwg.id);
    setNewDrawingForm({
      drawingNumber: dwg.drawingNumber,
      drawingTitle: dwg.drawingTitle,
      revision: dwg.revision,
      drawingStatus: dwg.drawingStatus,
      effectiveDate: dwg.effectiveDate,
      revisionNotes: dwg.revisionNotes || '',
      projectReference: dwg.projectReference || '',
      elementCode: dwg.elementCode || '',
      scale: dwg.scale || 'A.O.D.',
      sheetSize: dwg.sheetSize || 'A3',
      sheetNumber: dwg.sheetNumber || '1 / 1',
      modelledBy: dwg.modelledBy || '',
      modelledDate: dwg.modelledDate || '',
      detailedBy: dwg.detailedBy || '',
      detailedDate: dwg.detailedDate || '',
      referenceDrawings: dwg.referenceDrawings || '',
    });

    setPartsList(getDrawingPartsArray(dwg));
    setNewDrawingFile(null);
    setNewDrawingImagePreviewUrl(
      dwg.drawingFile && isImageAttachment(dwg.drawingFile)
        ? DBService.resolveAttachmentPreviewUrl(dwg.drawingFile)
        : null
    );
    setNewDrawingRevisionPhotos(dwg.revisionPhotos ? [...dwg.revisionPhotos] : []);
    setFileParseBanner(null);
    setOcrProgress(null);
    setIsNewModalOpen(true);
  };

  // Handle PDF or Image/Photo File Selection & Auto-Extract All Drawing Fields + Multi-Part List
  const handleDrawingFileImport = async (file: File | null) => {
    setNewDrawingFile(file);
    setOcrProgress(null);
    if (!file) {
      setNewDrawingImagePreviewUrl(null);
      return;
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage =
      file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);

    if (isImage) {
      try {
        const previewDataUrl = await fileToBase64(file);
        setNewDrawingImagePreviewUrl(previewDataUrl);
      } catch {
        setNewDrawingImagePreviewUrl(null);
      }
    } else {
      setNewDrawingImagePreviewUrl(null);
    }

    if (isPdf || isImage) {
      setIsParsingFile(true);
      setFileParseBanner({
        type: 'info',
        message: isPdf
          ? `Extracting title block, revision table, and parts list from PDF "${file.name}"...`
          : `Running OCR on drawing image/photo "${file.name}" to extract title block and parts list...`,
      });
      try {
        const parsed = await parseEngineeringDrawingFile(file, (pct) => {
          setOcrProgress(pct);
        });
        setNewDrawingForm((prev) => ({
          ...prev,
          drawingNumber: parsed.drawingNumber || prev.drawingNumber,
          revision: parsed.revision || prev.revision,
          drawingTitle: parsed.drawingTitle || prev.drawingTitle,
          drawingStatus: parsed.drawingStatus || prev.drawingStatus,
          effectiveDate: parsed.effectiveDate || prev.effectiveDate,
          revisionNotes: parsed.revisionNotes || prev.revisionNotes,
          projectReference: parsed.projectReference || prev.projectReference,
          elementCode: parsed.elementCode || prev.elementCode,
          scale: parsed.scale || prev.scale,
          sheetSize: parsed.sheetSize || prev.sheetSize,
          sheetNumber: parsed.sheetNumber || prev.sheetNumber,
          modelledBy: parsed.modelledBy || prev.modelledBy,
          modelledDate: parsed.modelledDate || prev.modelledDate,
          detailedBy: parsed.detailedBy || prev.detailedBy,
          detailedDate: parsed.detailedDate || prev.detailedDate,
          referenceDrawings: parsed.referenceDrawings || prev.referenceDrawings,
        }));

        if (parsed.partsList && parsed.partsList.length > 0) {
          setPartsList(parsed.partsList);
          setFileParseBanner({
            type: 'success',
            message: `${isPdf ? 'PDF' : 'Image / Photo'} parsed! Auto-populated Drawing "${parsed.drawingNumber}" (Rev ${parsed.revision}) and ${parsed.partsList.length} part(s) from the Parts List. All fields and parts can be edited manually below.`,
          });
        } else {
          setFileParseBanner({
            type: 'info',
            message: `${isPdf ? 'PDF' : 'Image / Photo'} "${file.name}" attached and title block metadata populated. Please review or manually enter the part(s) in the Parts List below.`,
          });
        }

        // Smart version detection: check if drawing already exists in register
        const detectedDwgNo = (parsed.drawingNumber || '').trim().toUpperCase();
        if (detectedDwgNo && isPdf) {
          const matchExisting =
            db.drawings.find(
              (d) => d.drawingNumber.trim().toUpperCase() === detectedDwgNo && d.isCurrent
            ) ||
            db.drawings.find((d) => d.drawingNumber.trim().toUpperCase() === detectedDwgNo);

          if (matchExisting) {
            setExistingDwgMatch({
              drawing: matchExisting,
              newRev: parsed.revision || '1',
              file,
            });
          } else {
            setExistingDwgMatch(null);
          }
        } else {
          setExistingDwgMatch(null);
        }
      } catch (err: any) {
        setFileParseBanner({
          type: 'error',
          message: `Attached "${file.name}", but could not auto-parse text (${err.message || 'scan'}). Please fill or adjust the fields manually below.`,
        });
      } finally {
        setIsParsingFile(false);
        setOcrProgress(null);
      }
    }
  };

  // Open Issue New Revision Modal and pre-populate parts list from the current drawing
  const handleOpenRevisionModal = (dwg: Drawing, initialFile: File | null = null) => {
    setRevTargetDrawing(dwg);
    // Suggest next revision code automatically (e.g., 0 -> 1, A -> B)
    const currRev = dwg.revision.trim().toUpperCase();
    let suggestedRev = '';
    if (/^\d+$/.test(currRev)) {
      suggestedRev = String(parseInt(currRev, 10) + 1);
    } else if (/^[A-Y]$/.test(currRev)) {
      suggestedRev = String.fromCharCode(currRev.charCodeAt(0) + 1);
    }
    setNewRevisionCode(suggestedRev);
    setRevisionChangeNotes('');
    setRevisionEffectiveDate(new Date().toISOString().split('T')[0]);
    setRevisionStatus('APPROVED');
    setRevisionDrawingTitle(dwg.drawingTitle || '');
    setRevisionElementCode(dwg.elementCode || '');
    setRevisionProjectReference(dwg.projectReference || '');
    setRevisionScale(dwg.scale || 'A.O.D.');
    setRevisionSheetSize(dwg.sheetSize || 'A3');
    setRevisionSheetNumber(dwg.sheetNumber || '1 / 1');
    setRevisionModelledBy(dwg.modelledBy || '');
    setRevisionModelledDate(dwg.modelledDate || '');
    setRevisionDetailedBy(dwg.detailedBy || '');
    setRevisionDetailedDate(dwg.detailedDate || '');
    setRevisionReferenceDrawings(dwg.referenceDrawings || '');
    setRevisionFile(null);
    setRevisionFilePreviewUrl(null);
    if (revisionPdfPreviewUrl) {
      URL.revokeObjectURL(revisionPdfPreviewUrl);
      setRevisionPdfPreviewUrl(null);
    }
    setRevisionShowPdfPreview(true);
    setRevisionAdditionalPhotos([]);
    setRevisionPartsList(getDrawingPartsArray(dwg));
    setIsParsingRevFile(false);
    setRevOcrProgress(null);
    setRevParseBanner(null);

    if (initialFile) {
      handleRevisionFileSelect(initialFile, dwg);
    }
  };

  // Handle direct global "Update Version via PDF" action from DrawingsModule header
  const handleGlobalRevisionPdfUpload = async (file: File | null) => {
    if (!file) return;
    setIsGlobalRevPdfScanning(true);
    try {
      const parsed = await parseEngineeringDrawingFile(file);
      const parsedDwgNo = (parsed.drawingNumber || '').trim().toUpperCase();

      // Look for a matching drawing in the register
      const match =
        db.drawings.find(
          (d) => d.drawingNumber.trim().toUpperCase() === parsedDwgNo && d.isCurrent
        ) ||
        db.drawings.find(
          (d) => d.drawingNumber.trim().toUpperCase() === parsedDwgNo
        );

      if (match) {
        // Automatically open the Issue New Revision flow for this drawing with the PDF loaded
        handleOpenRevisionModal(match, file);
      } else {
        // Drawing not in register yet - offer to register as new drawing
        const proceed = window.confirm(
          `Drawing "${parsed.drawingNumber || file.name}" was not found in the current register.\n\nWould you like to register it as a new drawing via this PDF?`
        );
        if (proceed) {
          resetDrawingModal();
          setIsNewModalOpen(true);
          await handleDrawingFileImport(file);
        }
      }
    } catch (err: any) {
      alert(`Could not parse revision PDF: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsGlobalRevPdfScanning(false);
    }
  };

  // Handle Revision File (PDF or Image/Photo) Selection & Auto-Extraction in the Issue New Revision Modal
  const handleRevisionFileSelect = async (file: File | null, explicitTarget?: Drawing) => {
    const currentTarget = explicitTarget || revTargetDrawing;
    setRevisionFile(file);
    setRevOcrProgress(null);
    if (!file) {
      setRevisionFilePreviewUrl(null);
      if (revisionPdfPreviewUrl) {
        URL.revokeObjectURL(revisionPdfPreviewUrl);
        setRevisionPdfPreviewUrl(null);
      }
      setRevisionShowPdfPreview(false);
      setRevParseBanner(null);
      return;
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage =
      file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);

    if (isImage) {
      try {
        const previewUrl = await fileToBase64(file);
        setRevisionFilePreviewUrl(previewUrl);
      } catch {
        setRevisionFilePreviewUrl(null);
      }
      if (revisionPdfPreviewUrl) {
        URL.revokeObjectURL(revisionPdfPreviewUrl);
        setRevisionPdfPreviewUrl(null);
      }
      setRevisionShowPdfPreview(false);
    } else if (isPdf) {
      setRevisionFilePreviewUrl(null);
      try {
        const pdfUrl = URL.createObjectURL(file);
        setRevisionPdfPreviewUrl(pdfUrl);
        setRevisionShowPdfPreview(true);
      } catch {
        setRevisionPdfPreviewUrl(null);
      }
    } else {
      setRevisionFilePreviewUrl(null);
      if (revisionPdfPreviewUrl) {
        URL.revokeObjectURL(revisionPdfPreviewUrl);
        setRevisionPdfPreviewUrl(null);
      }
      setRevisionShowPdfPreview(false);
    }

    if (isPdf || isImage) {
      setIsParsingRevFile(true);
      setRevParseBanner({
        type: 'info',
        message: isPdf
          ? `Extracting title block, revision table, specifications, and BOM parts list from revision PDF "${file.name}"...`
          : `Running OCR on revision image/photo "${file.name}" to extract revision details and parts list...`,
      });

      try {
        const parsed = await parseEngineeringDrawingFile(file, (pct) => {
          setRevOcrProgress(pct);
        });

        const targetDwgNo = currentTarget?.drawingNumber?.trim().toUpperCase();
        const parsedDwgNo = parsed.drawingNumber?.trim().toUpperCase();
        let dwgNoMismatch = false;
        if (parsedDwgNo && targetDwgNo && parsedDwgNo !== targetDwgNo) {
          dwgNoMismatch = true;
        }

        if (
          parsed.revision &&
          (!currentTarget || parsed.revision.toUpperCase() !== currentTarget.revision.toUpperCase())
        ) {
          setNewRevisionCode(parsed.revision.toUpperCase());
        }
        if (parsed.drawingTitle) {
          setRevisionDrawingTitle(parsed.drawingTitle);
        }
        if (parsed.elementCode) {
          setRevisionElementCode(parsed.elementCode);
        }
        if (parsed.projectReference) {
          setRevisionProjectReference(parsed.projectReference);
        }
        if (parsed.scale) {
          setRevisionScale(parsed.scale);
        }
        if (parsed.sheetSize) {
          setRevisionSheetSize(parsed.sheetSize);
        }
        if (parsed.sheetNumber) {
          setRevisionSheetNumber(parsed.sheetNumber);
        }
        if (parsed.modelledBy) {
          setRevisionModelledBy(parsed.modelledBy);
        }
        if (parsed.modelledDate) {
          setRevisionModelledDate(parsed.modelledDate);
        }
        if (parsed.detailedBy) {
          setRevisionDetailedBy(parsed.detailedBy);
        }
        if (parsed.detailedDate) {
          setRevisionDetailedDate(parsed.detailedDate);
        }
        if (parsed.referenceDrawings) {
          setRevisionReferenceDrawings(parsed.referenceDrawings);
        }
        if (parsed.revisionNotes) {
          setRevisionChangeNotes(parsed.revisionNotes);
        }
        if (parsed.effectiveDate) {
          setRevisionEffectiveDate(parsed.effectiveDate);
        }
        if (parsed.partsList && parsed.partsList.length > 0) {
          setRevisionPartsList(parsed.partsList);
        }

        if (dwgNoMismatch) {
          setRevParseBanner({
            type: 'info',
            message: `PDF parsed: Note that this PDF specifies Drawing No "${parsed.drawingNumber}" (Rev ${parsed.revision || '?'}), but you are issuing a revision for "${currentTarget?.drawingNumber}". Title block, revision notes, and ${parsed.partsList?.length || 0} BOM part(s) have been populated. Please verify this drawing file.`,
          });
        } else if (parsed.partsList && parsed.partsList.length > 0) {
          setRevParseBanner({
            type: 'success',
            message: `Revision CAD PDF "${file.name}" parsed! Drawing "${currentTarget?.drawingNumber || parsed.drawingNumber}" verified. Auto-extracted ${parsed.partsList.length} BOM part(s), revision details (Rev ${parsed.revision || newRevisionCode}), and title block parameters.`,
          });
        } else {
          setRevParseBanner({
            type: 'success',
            message: `Revision CAD PDF "${file.name}" attached. Title block specifications and revision code (${parsed.revision || newRevisionCode}) populated. Ready to issue revision.`,
          });
        }
      } catch (err: any) {
        setRevParseBanner({
          type: 'info',
          message: `Attached revision ${isPdf ? 'CAD PDF' : 'Image / Photo'} "${file.name}". Please verify the revision code and change notes below. (${err?.message || ''})`,
        });
      } finally {
        setIsParsingRevFile(false);
        setRevOcrProgress(null);
      }
    }
  };

  // Quick-fill helper matching the attached Dale Automation drawing T0559-058-719-00-02-012-00
  const handleLoadDaleSampleFormat = () => {
    setNewDrawingForm({
      drawingNumber: 'T0559-058-719-00-02-012-00',
      drawingTitle: 'BULK HOPPER CORNER 4 (T0559-058-719-00-02 CONTROL MECH.)',
      revision: '0',
      drawingStatus: 'APPROVED',
      effectiveDate: '2026-06-12',
      revisionNotes: 'ISSUED FOR MANUFACTURE.',
      projectReference: 'T0559-058 R&D DIVIDER (PROJECT: R&D)',
      elementCode: '719',
      scale: 'A.O.D. (1 : 0.5)',
      sheetSize: 'A3',
      sheetNumber: '1 / 1',
      modelledBy: 'C.JEVON',
      modelledDate: '2026-03-16',
      detailedBy: 'C.JEVON',
      detailedDate: '2026-06-12',
      referenceDrawings: 'T0559-058-719-00-02-007-00 — BULK HOPPER WELDED ASSEMBLY',
    });
    setPartsList([
      {
        id: `PT-${Date.now()}-1`,
        itemNumber: '1',
        quantity: '1',
        partNumber: 'T0559-058-719-00-02-012-01',
        description: '55,2 X 2 THK PLT X 55,6 LG',
        material: 'S/S 304 SATIN',
        designation: 'MANUF-INT',
        orderNumber: '',
        vendor: '',
      },
      {
        id: `PT-${Date.now()}-2`,
        itemNumber: '2',
        quantity: '1',
        partNumber: 'T0559-058-719-00-02-012-02',
        description: '20 X 2 THK PLT X 88,3 LG',
        material: 'S/S 304 SATIN',
        designation: 'MANUF-INT',
        orderNumber: '',
        vendor: '',
      },
    ]);
    setFileParseBanner({
      type: 'success',
      message:
        'Populated from Dale Automation Drawing T0559-058-719-00-02-012-00 (Rev 0) with 2 manual parts from the Parts List.',
    });
  };

  const handleUpdatePartRow = (id: string, field: keyof DrawingPartItem, value: string) => {
    setPartsList((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const handleAddPartRow = () => {
    setPartsList((prev) => [...prev, createEmptyPartRow(prev.length + 1)]);
  };

  const handleRemovePartRow = (id: string) => {
    setPartsList((prev) => {
      const next = prev.filter((r) => r.id !== id);
      return next.length > 0 ? next : [createEmptyPartRow(1)];
    });
  };

  const handleUpdateRevPartRow = (id: string, field: keyof DrawingPartItem, value: string) => {
    setRevisionPartsList((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const handleAddRevPartRow = () => {
    setRevisionPartsList((prev) => [...prev, createEmptyPartRow(prev.length + 1)]);
  };

  const handleRemoveRevPartRow = (id: string) => {
    setRevisionPartsList((prev) => {
      const next = prev.filter((r) => r.id !== id);
      return next.length > 0 ? next : [createEmptyPartRow(1)];
    });
  };

  // Excel / CSV Import Modal state for Controlled Engineering Drawings Register
  const [isDrawingsImportModalOpen, setIsDrawingsImportModalOpen] = useState(false);
  const [isMachineBomModalOpen, setIsMachineBomModalOpen] = useState(false);
  const [drawingsImportText, setDrawingsImportText] = useState('');
  const [drawingsImportFileName, setDrawingsImportFileName] = useState('');
  const [drawingsParsedImportRows, setDrawingsParsedImportRows] = useState<
    ParsedDrawingRegisterImportRow[]
  >([]);
  const [drawingsImportResultBanner, setDrawingsImportResultBanner] = useState<{
    ok: boolean;
    imported: number;
    updated: number;
    skipped: number;
    error?: string;
  } | null>(null);

  // Excel / CSV Import Modal state for single-drawing BOM Parts List inside Drawing/Revision modals
  const [isPartsImportModalOpen, setIsPartsImportModalOpen] = useState(false);
  const [partsImportTarget, setPartsImportTarget] = useState<'NEW_OR_EDIT' | 'REVISION'>('NEW_OR_EDIT');
  const [partsImportText, setPartsImportText] = useState('');
  const [partsImportFileName, setPartsImportFileName] = useState('');
  const [partsParsedImportRows, setPartsParsedImportRows] = useState<ParsedDrawingPartImportRow[]>([]);
  const [partsImportResultBanner, setPartsImportResultBanner] = useState<{
    imported: number;
    skipped: number;
  } | null>(null);

  const handleDownloadDrawingsRegisterTemplate = () => {
    const today = new Date().toISOString().split('T')[0];
    const templateRows = [
      {
        'Drawing Number': 'T0559-058-719-00-02-012-00',
        Revision: '0',
        'Drawing Title': 'MANUF-INT (T0559-058-719-00-02 BULK HOPPER WELDED ASSEMBLY)',
        'Element Code': '719',
        'Project Reference': 'T0559-058 R&D DIVIDER',
        ITEM: '1',
        QTY: '1',
        'DRAWING / PART No': 'T0559-058-719-00-02-012-01',
        DESCRIPTION: '55,2 X 2 THK PLT X 55,6 LG',
        MATERIAL: 'S/S 304 SATIN',
        DESIGNATION: 'MANUF-INT',
        'ORDER #': '',
        VENDOR: '',
        Status: 'APPROVED',
        'Effective Date': today,
      },
      {
        'Drawing Number': 'T0559-058-719-00-02-012-00',
        Revision: '0',
        'Drawing Title': 'MANUF-INT (T0559-058-719-00-02 BULK HOPPER WELDED ASSEMBLY)',
        'Element Code': '719',
        'Project Reference': 'T0559-058 R&D DIVIDER',
        ITEM: '2',
        QTY: '1',
        'DRAWING / PART No': 'T0559-058-719-00-02-012-02',
        DESCRIPTION: '50,4 X 2 THK PLT X 51,6 LG',
        MATERIAL: 'S/S 304 SATIN',
        DESIGNATION: 'MANUF-INT',
        'ORDER #': '',
        VENDOR: '',
        Status: 'APPROVED',
        'Effective Date': today,
      },
      {
        'Drawing Number': 'T0559-058-719-00-02-013-00',
        Revision: '0',
        'Drawing Title': 'MANUF-EXT (T0559-058-719-00-02 CONTROL MECH. F INSPECTED)',
        'Element Code': '719',
        'Project Reference': 'T0559-058 R&D DIVIDER',
        ITEM: '1',
        QTY: '2',
        'DRAWING / PART No': 'T0559-058-719-00-02-013-01',
        DESCRIPTION: '75 X 6 THK PLT X 275,3 LG',
        MATERIAL: 'MILD STEEL',
        DESIGNATION: 'MANUF-EXT',
        'ORDER #': '',
        VENDOR: '',
        Status: 'APPROVED',
        'Effective Date': today,
      },
    ];

    const criteriaRows = [
      {
        Column: 'Drawing Number',
        Required: 'REQUIRED',
        Criteria: 'Controlled Engineering Drawing Number (e.g. T0559-058-719-00-02-012-00). Multiple rows with the same Drawing Number & Revision are grouped into one Drawing with multiple BOM parts.',
      },
      {
        Column: 'Revision',
        Required: 'Optional (defaults to 0)',
        Criteria: 'Drawing revision code (e.g. 0, 1, 2, A, B)',
      },
      {
        Column: 'Drawing Title',
        Required: 'REQUIRED',
        Criteria: 'Controlled Drawing Title / Assembly Description',
      },
      {
        Column: 'Element Code',
        Required: 'Optional',
        Criteria: 'Machine Element Code (e.g. 719)',
      },
      {
        Column: 'Project Reference',
        Required: 'Optional',
        Criteria: 'Project Number or Reference (e.g. T0559-058 R&D DIVIDER)',
      },
      {
        Column: 'ITEM',
        Required: 'Optional (defaults to row #)',
        Criteria: 'BOM item number on the drawing (e.g. 1, 2, 3)',
      },
      {
        Column: 'QTY',
        Required: 'Optional (defaults to 1)',
        Criteria: 'Quantity required per drawing assembly',
      },
      {
        Column: 'DRAWING / PART No',
        Required: 'Optional (defaults to Drawing Number)',
        Criteria: 'Part Number registered on the drawing BOM (e.g. T0559-058-719-00-02-012-01)',
      },
      {
        Column: 'DESCRIPTION',
        Required: 'Optional',
        Criteria: 'Part dimensions / description on the drawing BOM',
      },
      {
        Column: 'MATERIAL',
        Required: 'Optional',
        Criteria: 'Material specification (e.g. S/S 304 SATIN)',
      },
      {
        Column: 'DESIGNATION',
        Required: 'Optional',
        Criteria: 'Manufacturing / procurement designation (e.g. MANUF-INT, MANUF-EXT, BOUGHT-OUT)',
      },
      {
        Column: 'Status',
        Required: 'Optional (defaults to APPROVED)',
        Criteria: 'APPROVED, UNDER_REVIEW, DRAFT, or SUPERSEDED',
      },
      {
        Column: 'Effective Date',
        Required: 'Optional (defaults to today)',
        Criteria: 'YYYY-MM-DD',
      },
    ];

    const wb = XLSX.utils.book_new();
    const wsTemplate = XLSX.utils.json_to_sheet(templateRows);
    wsTemplate['!cols'] = [
      { wch: 28 },
      { wch: 10 },
      { wch: 42 },
      { wch: 14 },
      { wch: 24 },
      { wch: 8 },
      { wch: 8 },
      { wch: 28 },
      { wch: 32 },
      { wch: 18 },
      { wch: 16 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, wsTemplate, 'Drawings_Register_Import');

    const wsCriteria = XLSX.utils.json_to_sheet(criteriaRows);
    wsCriteria['!cols'] = [{ wch: 22 }, { wch: 28 }, { wch: 70 }];
    XLSX.utils.book_append_sheet(wb, wsCriteria, 'Criteria_Guide');

    XLSX.writeFile(wb, 'MACHINE_QMS_Controlled_Drawings_Template.xlsx');
  };

  const handleDownloadDrawingPartsTemplate = () => {
    const templateRows = [
      {
        ITEM: '1',
        QTY: '1',
        'DRAWING / PART No': 'T0559-058-719-00-02-012-01',
        DESCRIPTION: '55,2 X 2 THK PLT X 55,6 LG',
        MATERIAL: 'S/S 304 SATIN',
        DESIGNATION: 'MANUF-INT',
        'ORDER #': '',
        VENDOR: '',
      },
      {
        ITEM: '2',
        QTY: '1',
        'DRAWING / PART No': 'T0559-058-719-00-02-012-02',
        DESCRIPTION: '50,4 X 2 THK PLT X 51,6 LG',
        MATERIAL: 'S/S 304 SATIN',
        DESIGNATION: 'MANUF-INT',
        'ORDER #': '',
        VENDOR: '',
      },
      {
        ITEM: '3',
        QTY: '1',
        'DRAWING / PART No': 'T0559-058-719-00-02-012-03',
        DESCRIPTION: '115,6 X 2 THK PLT X 3230 LG',
        MATERIAL: 'S/S 304 SATIN',
        DESIGNATION: 'MANUF-INT',
        'ORDER #': '',
        VENDOR: '',
      },
    ];

    const criteriaRows = [
      {
        Column: 'ITEM',
        Required: 'Optional (defaults to row #)',
        Criteria: 'BOM item number on the drawing (e.g. 1, 2, 3)',
      },
      {
        Column: 'QTY',
        Required: 'Optional (defaults to 1)',
        Criteria: 'Quantity required per assembly (e.g. 1, 2, 4)',
      },
      {
        Column: 'DRAWING / PART No',
        Required: 'REQUIRED',
        Criteria: 'Unique Part / Drawing Number (e.g. T0559-058-719-00-02-012-01)',
      },
      {
        Column: 'DESCRIPTION',
        Required: 'Optional',
        Criteria: 'Part dimensions / description from the drawing BOM',
      },
      {
        Column: 'MATERIAL',
        Required: 'Optional',
        Criteria: 'Material specification (e.g. S/S 304 SATIN)',
      },
      {
        Column: 'DESIGNATION',
        Required: 'Optional',
        Criteria: 'Manufacturing / procurement designation (e.g. MANUF-INT, BOUGHT-OUT)',
      },
      {
        Column: 'ORDER #',
        Required: 'Optional',
        Criteria: 'Work Order or Purchase Order reference',
      },
      {
        Column: 'VENDOR',
        Required: 'Optional',
        Criteria: 'Supplier or vendor name',
      },
    ];

    const wb = XLSX.utils.book_new();
    const wsTemplate = XLSX.utils.json_to_sheet(templateRows);
    wsTemplate['!cols'] = [
      { wch: 8 },
      { wch: 8 },
      { wch: 30 },
      { wch: 34 },
      { wch: 20 },
      { wch: 16 },
      { wch: 14 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, wsTemplate, 'Parts_List_Import');

    const wsCriteria = XLSX.utils.json_to_sheet(criteriaRows);
    wsCriteria['!cols'] = [{ wch: 22 }, { wch: 26 }, { wch: 62 }];
    XLSX.utils.book_append_sheet(wb, wsCriteria, 'Criteria_Guide');

    XLSX.writeFile(wb, 'MACHINE_QMS_Drawing_Parts_List_Template.xlsx');
  };

  const handleExportSinglePartsListExcel = (parts: DrawingPartItem[], dwgNumber?: string) => {
    const cleanParts = parts.filter((p) => p.partNumber.trim().length > 0);
    const rowsToExport = (cleanParts.length > 0 ? cleanParts : parts).map((p, idx) => ({
      ITEM: p.itemNumber || String(idx + 1),
      QTY: p.quantity || '1',
      'DRAWING / PART No': p.partNumber,
      DESCRIPTION: p.description,
      MATERIAL: p.material,
      DESIGNATION: p.designation,
      'ORDER #': p.orderNumber || '',
      VENDOR: p.vendor || '',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rowsToExport);
    ws['!cols'] = [
      { wch: 8 },
      { wch: 8 },
      { wch: 30 },
      { wch: 34 },
      { wch: 20 },
      { wch: 16 },
      { wch: 14 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Parts_List');
    const safeName = (dwgNumber || 'Drawing_BOM').replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(wb, `MACHINE_QMS_Parts_List_${safeName}.xlsx`);
  };

  const handleExportDrawingsAndPartsExcel = () => {
    const flatRows: Array<Record<string, string>> = [];
    for (const dwg of filteredDrawings) {
      const parts = getDrawingPartsArray(dwg);
      if (parts.length === 0) {
        flatRows.push({
          'Drawing Number': dwg.drawingNumber,
          Revision: dwg.revision,
          'Drawing Title': dwg.drawingTitle,
          'Element Code': dwg.elementCode || '',
          'Project Reference': dwg.projectReference || '',
          ITEM: '1',
          QTY: '1',
          'DRAWING / PART No': dwg.partNumber || '',
          DESCRIPTION: dwg.drawingTitle,
          MATERIAL: '',
          DESIGNATION: '',
          'ORDER #': '',
          VENDOR: '',
          Status: dwg.drawingStatus,
          'Effective Date': dwg.effectiveDate,
        });
      } else {
        for (const pt of parts) {
          flatRows.push({
            'Drawing Number': dwg.drawingNumber,
            Revision: dwg.revision,
            'Drawing Title': dwg.drawingTitle,
            'Element Code': dwg.elementCode || '',
            'Project Reference': dwg.projectReference || '',
            ITEM: pt.itemNumber,
            QTY: pt.quantity,
            'DRAWING / PART No': pt.partNumber,
            DESCRIPTION: pt.description,
            MATERIAL: pt.material,
            DESIGNATION: pt.designation,
            'ORDER #': pt.orderNumber || '',
            VENDOR: pt.vendor || '',
            Status: dwg.drawingStatus,
            'Effective Date': dwg.effectiveDate,
          });
        }
      }
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(flatRows);
    ws['!cols'] = [
      { wch: 28 },
      { wch: 10 },
      { wch: 34 },
      { wch: 14 },
      { wch: 20 },
      { wch: 8 },
      { wch: 8 },
      { wch: 30 },
      { wch: 34 },
      { wch: 20 },
      { wch: 16 },
      { wch: 14 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Drawings_Parts_List');
    const dateStamp = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `MACHINE_QMS_Drawings_Parts_Register_${dateStamp}.xlsx`);
  };

  const parseRawDrawingPartRows = (rawRows: string[][]): ParsedDrawingPartImportRow[] => {
    const nonEmptyRows = rawRows
      .map((r) => r.map((c) => String(c ?? '').trim()))
      .filter((r) => r.some((cell) => cell.length > 0));

    if (nonEmptyRows.length === 0) return [];

    const firstRowLower = nonEmptyRows[0].map((c) => c.toLowerCase());
    const hasHeader = firstRowLower.some(
      (h) =>
        h.includes('part') ||
        h.includes('drawing') ||
        h.includes('item') ||
        h.includes('description') ||
        h.includes('material') ||
        h.includes('qty')
    );

    let colMap = {
      itemNumber: 0,
      quantity: 1,
      partNumber: 2,
      description: 3,
      material: 4,
      designation: 5,
      orderNumber: 6,
      vendor: 7,
    };

    if (hasHeader) {
      const findIdx = (keywords: string[], fallback: number) => {
        const idx = firstRowLower.findIndex((h) => keywords.some((k) => h.includes(k)));
        return idx !== -1 ? idx : fallback;
      };
      colMap = {
        itemNumber: findIdx(['item'], 0),
        quantity: findIdx(['qty', 'quantity'], 1),
        partNumber: findIdx(['part no', 'part number', 'drawing / part', 'part_no', 'part'], 2),
        description: findIdx(['description', 'desc', 'part name'], 3),
        material: findIdx(['material', 'mat'], 4),
        designation: findIdx(['designation', 'desig', 'type'], 5),
        orderNumber: findIdx(['order', 'po'], 6),
        vendor: findIdx(['vendor', 'supplier'], 7),
      };
    }

    const dataRows = hasHeader ? nonEmptyRows.slice(1) : nonEmptyRows;

    return dataRows.map((cols, index) => {
      const itemNumber = (cols[colMap.itemNumber] || String(index + 1)).trim();
      const quantity = (cols[colMap.quantity] || '1').trim();
      const partNumber = (cols[colMap.partNumber] || '').trim().toUpperCase();
      const description = (cols[colMap.description] || '').trim();
      const material = (cols[colMap.material] || '').trim();
      const designation = (cols[colMap.designation] || '').trim().toUpperCase();
      const orderNumber = (cols[colMap.orderNumber] || '').trim();
      const vendor = (cols[colMap.vendor] || '').trim();

      const errors: string[] = [];
      if (!partNumber) errors.push('Missing Drawing / Part No');

      return {
        rowNumber: hasHeader ? index + 2 : index + 1,
        itemNumber: itemNumber || String(index + 1),
        quantity: quantity || '1',
        partNumber,
        description,
        material,
        designation,
        orderNumber,
        vendor,
        isValid: errors.length === 0,
        errors,
      };
    });
  };

  const splitDelimitedLine = (line: string, delimiter: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handlePartsTextImportChange = (text: string) => {
    setPartsImportText(text);
    setPartsImportResultBanner(null);
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      setPartsParsedImportRows([]);
      return;
    }
    const sample = lines[0];
    const delimiter = sample.includes('\t') ? '\t' : sample.includes(';') ? ';' : ',';
    const rawRows = lines.map((line) => splitDelimitedLine(line, delimiter));
    setPartsParsedImportRows(parseRawDrawingPartRows(rawRows));
  };

  const handlePartsExcelOrCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPartsImportFileName(file.name);
    setPartsImportResultBanner(null);

    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    const reader = new FileReader();

    if (isExcel) {
      reader.onload = (evt) => {
        const data = evt.target?.result;
        if (!data) return;
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonMatrix = XLSX.utils.sheet_to_json<string[]>(worksheet, {
          header: 1,
          defval: '',
          raw: false,
        });
        setPartsParsedImportRows(parseRawDrawingPartRows(jsonMatrix));
        const csvPreview = XLSX.utils.sheet_to_csv(worksheet);
        setPartsImportText(csvPreview);
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (evt) => {
        const content = String(evt.target?.result || '');
        handlePartsTextImportChange(content);
      };
      reader.readAsText(file);
    }
  };

  const handleConfirmPartsImport = () => {
    const validRows = partsParsedImportRows.filter((r) => r.isValid);
    const skippedCount = partsParsedImportRows.length - validRows.length;
    if (validRows.length === 0) return;

    const importedPartItems: DrawingPartItem[] = validRows.map((r, idx) => ({
      id: `PT-IMP-${Date.now()}-${idx}`,
      itemNumber: r.itemNumber || String(idx + 1),
      quantity: r.quantity || '1',
      partNumber: r.partNumber,
      description: r.description,
      material: r.material,
      designation: r.designation,
      orderNumber: r.orderNumber,
      vendor: r.vendor,
    }));

    if (partsImportTarget === 'REVISION') {
      setRevisionPartsList(importedPartItems);
    } else {
      setPartsList(importedPartItems);
      if (!isNewModalOpen) {
        setIsNewModalOpen(true);
      }
    }

    setPartsImportResultBanner({
      imported: importedPartItems.length,
      skipped: skippedCount,
    });
  };

  // Parse raw Excel / CSV rows for the Controlled Engineering Drawings Register
  const parseRawDrawingsRegisterRows = (rawRows: string[][]): ParsedDrawingRegisterImportRow[] => {
    const nonEmptyRows = rawRows
      .map((r) => r.map((c) => String(c ?? '').trim()))
      .filter((r) => r.some((cell) => cell.length > 0));

    if (nonEmptyRows.length === 0) return [];

    const firstRowLower = nonEmptyRows[0].map((c) => c.toLowerCase());
    const hasHeader = firstRowLower.some(
      (h) =>
        h.includes('drawing') ||
        h.includes('dwg') ||
        h.includes('rev') ||
        h.includes('title') ||
        h.includes('part') ||
        h.includes('description') ||
        h.includes('element') ||
        h.includes('project')
    );

    const findExactOrPartialIdx = (exactMatches: string[], partialKeywords: string[], fallback: number) => {
      const exactIdx = firstRowLower.findIndex((h) => exactMatches.includes(h.trim()));
      if (exactIdx !== -1) return exactIdx;
      const partialIdx = firstRowLower.findIndex((h) => partialKeywords.some((k) => h.includes(k)));
      return partialIdx !== -1 ? partialIdx : fallback;
    };

    let colMap = {
      drawingNumber: 0,
      revision: 1,
      drawingTitle: 2,
      elementCode: 3,
      projectReference: 4,
      itemNumber: 5,
      quantity: 6,
      partNumber: 7,
      partDescription: 8,
      material: 9,
      designation: 10,
      orderNumber: 11,
      vendor: 12,
      drawingStatus: 13,
      effectiveDate: 14,
      revisionNotes: -1,
    };

    if (hasHeader) {
      const dwgCol = findExactOrPartialIdx(
        ['drawing number', 'drawing no', 'drawing no.', 'dwg no', 'dwg number', 'drawing #'],
        ['drawing number', 'drawing no', 'dwg no', 'dwg #'],
        -1
      );
      const partCol = findExactOrPartialIdx(
        ['drawing / part no', 'part number', 'part no', 'part no.', 'part #'],
        ['drawing / part', 'part no', 'part number', 'part_no'],
        -1
      );
      const titleCol = findExactOrPartialIdx(
        ['drawing title', 'title', 'assembly title', 'drawing name'],
        ['drawing title', 'title', 'drawing desc'],
        -1
      );
      const descCol = findExactOrPartialIdx(
        ['description', 'part description', 'item description', 'desc'],
        ['description', 'desc'],
        -1
      );

      colMap = {
        drawingNumber: dwgCol !== -1 ? dwgCol : partCol !== -1 ? partCol : 0,
        revision: findExactOrPartialIdx(['revision', 'rev', 'rev.'], ['revision', 'rev'], -1),
        drawingTitle: titleCol !== -1 ? titleCol : descCol !== -1 ? descCol : 2,
        elementCode: findExactOrPartialIdx(['element code', 'element', 'elem'], ['element', 'elem'], -1),
        projectReference: findExactOrPartialIdx(
          ['project reference', 'project', 'project number', 'project no'],
          ['project'],
          -1
        ),
        itemNumber: findExactOrPartialIdx(['item', 'item no', 'item #'], ['item'], -1),
        quantity: findExactOrPartialIdx(['qty', 'quantity'], ['qty', 'quantity'], -1),
        partNumber: partCol !== -1 ? partCol : dwgCol !== -1 ? dwgCol : -1,
        partDescription: descCol !== -1 ? descCol : titleCol !== -1 ? titleCol : -1,
        material: findExactOrPartialIdx(['material', 'mat', 'material spec'], ['material', 'mat'], -1),
        designation: findExactOrPartialIdx(['designation', 'desig', 'category', 'type'], ['designation', 'desig'], -1),
        orderNumber: findExactOrPartialIdx(['order #', 'order', 'order no', 'po'], ['order', 'po'], -1),
        vendor: findExactOrPartialIdx(['vendor', 'supplier'], ['vendor', 'supplier'], -1),
        drawingStatus: findExactOrPartialIdx(['status', 'drawing status'], ['status'], -1),
        effectiveDate: findExactOrPartialIdx(['effective date', 'date', 'approval date'], ['effective', 'date'], -1),
        revisionNotes: findExactOrPartialIdx(['revision notes', 'notes', 'remarks'], ['note', 'remark'], -1),
      };
    }

    const dataRows = hasHeader ? nonEmptyRows.slice(1) : nonEmptyRows;
    const today = new Date().toISOString().split('T')[0];

    return dataRows.map((cols, index) => {
      const getCol = (idx: number) => (idx >= 0 && idx < cols.length ? (cols[idx] || '').trim() : '');

      let rawDwgNo = getCol(colMap.drawingNumber).toUpperCase();
      let rawPartNo = getCol(colMap.partNumber).toUpperCase();

      // If Drawing Number column wasn't separate from Part Number (e.g. T0559-058-719-00-02-012-01),
      // derive the parent -00 Drawing Number automatically if it ends with -01..-99
      if (!rawDwgNo && rawPartNo) {
        rawDwgNo = rawPartNo.replace(/-\d{2}$/, '-00');
      } else if (
        colMap.drawingNumber === colMap.partNumber &&
        rawDwgNo &&
        /-\d{2}$/.test(rawDwgNo) &&
        !rawDwgNo.endsWith('-00')
      ) {
        rawPartNo = rawDwgNo;
        rawDwgNo = rawDwgNo.replace(/-\d{2}$/, '-00');
      }

      if (!rawPartNo && rawDwgNo) {
        rawPartNo = rawDwgNo;
      }

      const revision = (getCol(colMap.revision) || '0').toUpperCase();
      const rawTitle = getCol(colMap.drawingTitle) || getCol(colMap.partDescription);
      const partDescription = getCol(colMap.partDescription) || rawTitle;
      const elementCode = getCol(colMap.elementCode);
      const projectReference = getCol(colMap.projectReference);
      const itemNumber = getCol(colMap.itemNumber) || String(index + 1);
      const quantity = getCol(colMap.quantity) || '1';
      const material = getCol(colMap.material) || 'AS PER DRAWING';
      const designation = (getCol(colMap.designation) || 'MANUF-INT').toUpperCase();
      const orderNumber = getCol(colMap.orderNumber);
      const vendor = getCol(colMap.vendor);
      const revisionNotes = getCol(colMap.revisionNotes) || 'ISSUED FOR MANUFACTURE.';

      const rawStatus = getCol(colMap.drawingStatus).toUpperCase().replace(/\s+/g, '_');
      const validStatuses: DrawingStatus[] = ['APPROVED', 'UNDER_REVIEW', 'DRAFT', 'SUPERSEDED', 'OBSOLETE'];
      const drawingStatus: DrawingStatus = validStatuses.includes(rawStatus as DrawingStatus)
        ? (rawStatus as DrawingStatus)
        : 'APPROVED';

      const effectiveDate = getCol(colMap.effectiveDate) || today;

      const errors: string[] = [];
      if (!rawDwgNo) errors.push('Missing Drawing Number');
      if (!rawTitle) errors.push('Missing Drawing Title');

      return {
        rowNumber: hasHeader ? index + 2 : index + 1,
        drawingNumber: rawDwgNo,
        revision,
        drawingTitle: rawTitle,
        elementCode,
        projectReference,
        drawingStatus,
        effectiveDate,
        itemNumber,
        quantity,
        partNumber: rawPartNo,
        partDescription,
        material,
        designation,
        orderNumber,
        vendor,
        revisionNotes,
        isValid: errors.length === 0,
        errors,
      };
    });
  };

  const handleDrawingsTextImportChange = (text: string) => {
    setDrawingsImportText(text);
    setDrawingsImportResultBanner(null);
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      setDrawingsParsedImportRows([]);
      return;
    }
    const sample = lines[0];
    const delimiter = sample.includes('\t') ? '\t' : sample.includes(';') ? ';' : ',';
    const rawRows = lines.map((line) => splitDelimitedLine(line, delimiter));
    setDrawingsParsedImportRows(parseRawDrawingsRegisterRows(rawRows));
  };

  const handleDrawingsExcelOrCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDrawingsImportFileName(file.name);
    setDrawingsImportResultBanner(null);

    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    const reader = new FileReader();

    if (isExcel) {
      reader.onload = (evt) => {
        const data = evt.target?.result;
        if (!data) return;
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonMatrix = XLSX.utils.sheet_to_json<string[]>(worksheet, {
          header: 1,
          defval: '',
          raw: false,
        });

        // Check if this is a multi-level CAD BOM / Progress Excel workbook (e.g. T0559-058-719-00-00-000-00)
        const hasCadBomOrProgressSheet = workbook.SheetNames.some((n) => {
          const lower = n.trim().toLowerCase();
          return lower.includes('cad bom') || lower === 'progress';
        });
        const firstHeaderLower = (jsonMatrix[0] || []).map((c) => String(c || '').trim().toLowerCase());
        const looksLikeCadBom =
          hasCadBomOrProgressSheet ||
          (firstHeaderLower.includes('level') &&
            firstHeaderLower.some((h) => h.includes('part number') || h.includes('part no')) &&
            firstHeaderLower.some((h) => h.includes('file name') || h.includes('grouping') || h.includes('unit mass')));

        if (looksLikeCadBom) {
          const parsedBom = parseMachineBomWorkbook(workbook, file.name);
          if (parsedBom.rows.length > 0) {
            const payloads = buildMachineImportPayloads(parsedBom, {
              machineSerialNumber: db.machines[0]?.serialNumber || 'DIV0001',
              machineType: parsedBom.detectedMachineType || 'DIVIDER',
              projectNumber: parsedBom.detectedProjectNumber || 'T0559-058',
              projectName: parsedBom.detectedProjectName || 'T0559-058 R&D DIVIDER',
              elementCode: parsedBom.detectedElementCode || '719',
              modelledBy: parsedBom.detectedModelledBy || 'C.JEVON',
              detailedBy: parsedBom.detectedDetailedBy || 'C.JEVON',
              includeBoughtOut: true,
              createDetailDrawingsForParts: true,
            });
            const today = new Date().toISOString().split('T')[0];
            const convertedRows: ParsedDrawingRegisterImportRow[] = [];
            let rowCounter = 1;
            payloads.drawings.forEach((dwg) => {
              const parts = dwg.partsList && dwg.partsList.length > 0
                ? dwg.partsList
                : [
                    {
                      itemNumber: '1',
                      quantity: '1',
                      partNumber: dwg.drawingNumber,
                      description: dwg.drawingTitle,
                      material: 'AS PER DRAWING',
                      designation: 'MANUF-INT',
                      orderNumber: '',
                      vendor: '',
                    },
                  ];
              parts.forEach((pt: any) => {
                convertedRows.push({
                  rowNumber: rowCounter++,
                  drawingNumber: dwg.drawingNumber,
                  revision: dwg.revision || '0',
                  drawingTitle: dwg.drawingTitle,
                  elementCode: dwg.elementCode || parsedBom.detectedElementCode || '',
                  projectReference: dwg.projectReference || parsedBom.detectedProjectNumber || '',
                  drawingStatus: dwg.drawingStatus || 'APPROVED',
                  effectiveDate: dwg.effectiveDate || today,
                  itemNumber: pt.itemNumber || '1',
                  quantity: pt.quantity || '1',
                  partNumber: pt.partNumber || dwg.drawingNumber,
                  partDescription: pt.description || dwg.drawingTitle,
                  material: pt.material || 'AS PER DRAWING',
                  designation: pt.designation || 'MANUF-INT',
                  orderNumber: pt.orderNumber || '',
                  vendor: pt.vendor || '',
                  revisionNotes: dwg.revisionNotes || 'ISSUED FOR MANUFACTURE.',
                  isValid: Boolean(dwg.drawingNumber && dwg.drawingTitle),
                  errors: [],
                });
              });
            });
            setDrawingsParsedImportRows(convertedRows);
            setDrawingsImportText(XLSX.utils.sheet_to_csv(worksheet));
            return;
          }
        }

        setDrawingsParsedImportRows(parseRawDrawingsRegisterRows(jsonMatrix));
        const csvPreview = XLSX.utils.sheet_to_csv(worksheet);
        setDrawingsImportText(csvPreview);
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (evt) => {
        const content = String(evt.target?.result || '');
        handleDrawingsTextImportChange(content);
      };
      reader.readAsText(file);
    }
  };

  const handleConfirmDrawingsImport = async () => {
    const validRows = drawingsParsedImportRows.filter((r) => r.isValid);
    const invalidCount = drawingsParsedImportRows.length - validRows.length;
    if (validRows.length === 0) return;

    // Group rows by Drawing Number + Revision so multi-part drawings are combined into one Drawing record with its BOM partsList
    const groupedMap = new Map<
      string,
      {
        drawingNumber: string;
        revision: string;
        drawingTitle: string;
        elementCode: string;
        projectReference: string;
        drawingStatus: DrawingStatus;
        effectiveDate: string;
        revisionNotes: string;
        partsList: DrawingPartItem[];
      }
    >();

    validRows.forEach((row, idx) => {
      const key = `${row.drawingNumber}__REV__${row.revision}`;
      const existingGroup = groupedMap.get(key);
      const partItem: DrawingPartItem = {
        id: `PT-DWGIMP-${Date.now()}-${idx}`,
        itemNumber: row.itemNumber || String((existingGroup?.partsList.length || 0) + 1),
        quantity: row.quantity || '1',
        partNumber: row.partNumber || row.drawingNumber,
        description: row.partDescription || row.drawingTitle,
        material: row.material || 'AS PER DRAWING',
        designation: row.designation || 'MANUF-INT',
        orderNumber: row.orderNumber || '',
        vendor: row.vendor || '',
      };

      if (!existingGroup) {
        groupedMap.set(key, {
          drawingNumber: row.drawingNumber,
          revision: row.revision,
          drawingTitle: row.drawingTitle,
          elementCode: row.elementCode,
          projectReference: row.projectReference,
          drawingStatus: row.drawingStatus,
          effectiveDate: row.effectiveDate,
          revisionNotes: row.revisionNotes,
          partsList: [partItem],
        });
      } else {
        const alreadyHasPart = existingGroup.partsList.some(
          (p) => p.partNumber.trim().toUpperCase() === partItem.partNumber.trim().toUpperCase()
        );
        if (!alreadyHasPart) {
          existingGroup.partsList.push(partItem);
        }
      }
    });

    const groupedDrawings = Array.from(groupedMap.values());
    const res = await importDrawings(groupedDrawings);

    setDrawingsImportResultBanner({
      ok: res.ok,
      imported: res.importedCount,
      updated: res.updatedCount,
      skipped: res.skippedCount + invalidCount,
      error: res.error,
    });
  };

  const handleCreateOrUpdateDrawing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDrawingForm.drawingNumber.trim() || !newDrawingForm.drawingTitle.trim()) {
      alert('Drawing Number and Drawing Title are required.');
      return;
    }

    const validParts = partsList
      .map((p, idx) => ({
        ...p,
        itemNumber: p.itemNumber.trim() || String(idx + 1),
        quantity: p.quantity.trim() || '1',
        partNumber: p.partNumber.trim().toUpperCase(),
        description: p.description.trim(),
        material: p.material.trim(),
        designation: p.designation.trim().toUpperCase(),
        orderNumber: (p.orderNumber || '').trim(),
        vendor: (p.vendor || '').trim(),
      }))
      .filter((p) => p.partNumber.length > 0);

    if (validParts.length === 0) {
      alert('Please enter at least one Part Number manually in the Drawing Parts List.');
      return;
    }

    setIsUploading(true);
    try {
      let uploadedMeta: FileAttachmentMetadata | undefined;
      if (newDrawingFile) {
        const base64Data = await fileToBase64(newDrawingFile);
        const inferredMime =
          newDrawingFile.type ||
          (newDrawingFile.name.toLowerCase().endsWith('.pdf')
            ? 'application/pdf'
            : 'image/jpeg');
        const uploadRes = await uploadAttachmentFile({
          originalFilename: newDrawingFile.name,
          mimeType: inferredMime,
          base64Data,
          category: 'DRAWING',
          drawingNumber: newDrawingForm.drawingNumber.trim().toUpperCase(),
          revision: newDrawingForm.revision.trim().toUpperCase(),
        });
        if (!uploadRes.success) {
          alert(uploadRes.error || 'Failed to upload drawing file.');
          setIsUploading(false);
          return;
        }
        uploadedMeta = uploadRes.attachment;
      } else if (newDrawingRevisionPhotos.length > 0 && !editingDrawingId) {
        uploadedMeta = newDrawingRevisionPhotos[0];
      }

      const partNumbersArray = validParts.map((p) => p.partNumber);
      const summaryPartNumber = partNumbersArray.join('; ');
      const isApproved = newDrawingForm.drawingStatus === 'APPROVED';

      const payload = {
        drawingNumber: newDrawingForm.drawingNumber.trim().toUpperCase(),
        drawingTitle: newDrawingForm.drawingTitle.trim(),
        partNumber: summaryPartNumber,
        partNumbers: partNumbersArray,
        partsList: validParts,
        revision: newDrawingForm.revision.trim().toUpperCase(),
        drawingStatus: newDrawingForm.drawingStatus,
        approvedBy: isApproved ? currentUser.name : undefined,
        approvedById: isApproved ? currentUser.id : undefined,
        approvalDate: isApproved ? new Date().toISOString().split('T')[0] : undefined,
        effectiveDate: newDrawingForm.effectiveDate,
        revisionNotes: newDrawingForm.revisionNotes.trim(),
        projectReference: newDrawingForm.projectReference.trim(),
        elementCode: newDrawingForm.elementCode.trim(),
        scale: newDrawingForm.scale.trim(),
        sheetSize: newDrawingForm.sheetSize.trim(),
        sheetNumber: newDrawingForm.sheetNumber.trim(),
        modelledBy: newDrawingForm.modelledBy.trim(),
        modelledDate: newDrawingForm.modelledDate.trim(),
        detailedBy: newDrawingForm.detailedBy.trim(),
        detailedDate: newDrawingForm.detailedDate.trim(),
        referenceDrawings: newDrawingForm.referenceDrawings.trim(),
        revisionPhotos: newDrawingRevisionPhotos,
        ...(uploadedMeta
          ? {
              fileName: uploadedMeta.originalFilename,
              drawingFile: uploadedMeta,
            }
          : {}),
      };

      let ok = false;
      if (editingDrawingId) {
        ok = await updateDrawing(editingDrawingId, payload);
      } else {
        ok = await addDrawing({
          ...payload,
          isCurrent: true,
        });
      }

      if (ok) {
        setIsNewModalOpen(false);
        resetDrawingModal();
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleApproveDrawing = async (dwg: Drawing) => {
    if (!canManageDrawings) {
      alert('Only Engineering, HSEQ, or Administrator may approve drawings.');
      return;
    }
    await updateDrawing(dwg.id, {
      drawingStatus: 'APPROVED',
      approvedBy: currentUser.name,
      approvedById: currentUser.id,
      approvalDate: new Date().toISOString().split('T')[0],
    });
  };

  // Switch which version of a drawing is marked as Current vs Archived (Superseded)
  const handleActivateDrawingVersion = async (targetVersion: Drawing) => {
    if (!canManageDrawings) {
      alert(
        'Only Engineering, HSEQ, or Administrator may change the active current drawing version.'
      );
      return;
    }
    const siblings =
      versionsByDrawingNumber[targetVersion.drawingNumber.trim().toUpperCase()] || [];

    for (const sib of siblings) {
      if (sib.id === targetVersion.id) {
        await updateDrawing(sib.id, {
          isCurrent: true,
          drawingStatus: 'APPROVED',
          approvedBy: sib.approvedBy || currentUser.name,
          approvedById: sib.approvedById || currentUser.id,
          approvalDate: sib.approvalDate || new Date().toISOString().split('T')[0],
        });
      } else if (sib.isCurrent) {
        await updateDrawing(sib.id, {
          isCurrent: false,
          drawingStatus: sib.drawingStatus === 'APPROVED' ? 'SUPERSEDED' : sib.drawingStatus,
        });
      }
    }

    setSelectedVersionByDwgNo((prev) => ({
      ...prev,
      [targetVersion.drawingNumber.trim().toUpperCase()]: targetVersion.id,
    }));

    if (viewingDrawing && viewingDrawing.drawingNumber === targetVersion.drawingNumber) {
      setViewingDrawing({
        ...targetVersion,
        isCurrent: true,
        drawingStatus: 'APPROVED',
      });
    }
  };

  // Allow replacing or attaching a PDF or Image/Photo directly onto an existing revision from the Version History modal
  const handleReplaceRevisionControlledFile = async (targetDwg: Drawing, file: File | null) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const base64Data = await fileToBase64(file);
      const inferredMime =
        file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
      const uploadRes = await uploadAttachmentFile({
        originalFilename: file.name,
        mimeType: inferredMime,
        base64Data,
        category: 'DRAWING',
        drawingNumber: targetDwg.drawingNumber,
        revision: targetDwg.revision,
      });
      if (!uploadRes.success || !uploadRes.attachment) {
        alert(uploadRes.error || 'Failed to upload controlled drawing print/photo.');
        return;
      }
      const ok = await updateDrawing(targetDwg.id, {
        fileName: uploadRes.attachment.originalFilename,
        drawingFile: uploadRes.attachment,
      });
      if (ok && viewingDrawing && viewingDrawing.id === targetDwg.id) {
        setViewingDrawing({
          ...viewingDrawing,
          fileName: uploadRes.attachment.originalFilename,
          drawingFile: uploadRes.attachment,
        });
        setShowEmbeddedPdfPreview(true);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleIssueNewRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revTargetDrawing || !newRevisionCode.trim() || !revisionChangeNotes.trim()) {
      alert('New Revision code and Engineering Change Notes are required.');
      return;
    }

    const validRevParts = revisionPartsList
      .map((p, idx) => ({
        ...p,
        itemNumber: p.itemNumber.trim() || String(idx + 1),
        quantity: p.quantity.trim() || '1',
        partNumber: p.partNumber.trim().toUpperCase(),
        description: p.description.trim(),
        material: p.material.trim(),
        designation: p.designation.trim().toUpperCase(),
        orderNumber: (p.orderNumber || '').trim(),
        vendor: (p.vendor || '').trim(),
      }))
      .filter((p) => p.partNumber.length > 0);

    setIsUploading(true);
    try {
      let uploadedMeta: FileAttachmentMetadata | undefined;
      if (revisionFile) {
        const base64Data = await fileToBase64(revisionFile);
        const inferredMime =
          revisionFile.type ||
          (revisionFile.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
        const uploadRes = await uploadAttachmentFile({
          originalFilename: revisionFile.name,
          mimeType: inferredMime,
          base64Data,
          category: 'DRAWING',
          drawingNumber: revTargetDrawing.drawingNumber,
          revision: newRevisionCode.trim().toUpperCase(),
        });
        if (!uploadRes.success) {
          alert(uploadRes.error || 'Failed to upload revision drawing file.');
          setIsUploading(false);
          return;
        }
        uploadedMeta = uploadRes.attachment;
      } else if (revisionAdditionalPhotos.length > 0 && !revTargetDrawing.drawingFile) {
        // If user attached revision photos via the photo gallery and no separate PDF was selected, use the first photo as the primary drawingFile too
        uploadedMeta = revisionAdditionalPhotos[0];
      }

      const ok = await createDrawingRevision(
        revTargetDrawing.id,
        newRevisionCode.trim().toUpperCase(),
        revisionChangeNotes.trim(),
        uploadedMeta,
        {
          revisionPhotos: revisionAdditionalPhotos,
          partsList: validRevParts.length > 0 ? validRevParts : undefined,
          effectiveDate: revisionEffectiveDate,
          drawingStatus: revisionStatus,
        }
      );

      if (ok) {
        setRevTargetDrawing(null);
        setNewRevisionCode('');
        setRevisionChangeNotes('');
        setRevisionFile(null);
        setRevisionFilePreviewUrl(null);
        setRevisionAdditionalPhotos([]);
        setRevParseBanner(null);
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            5. Controlled Engineering Drawings &amp; Multi-Part Register
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Import drawings and revisions via PDF or Image / Photo, register multiple manual parts per drawing, and toggle between Current and Archived versions.
          </p>
        </div>

        {canManageDrawings && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadDrawingsRegisterTemplate}
              className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
              title="Download formatted Excel (.xlsx) template for Controlled Engineering Drawings & BOM Register"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              Download Drawings Template (.xlsx)
            </button>

            <button
              type="button"
              onClick={handleExportDrawingsAndPartsExcel}
              className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
              title="Export Controlled Engineering Drawings & BOM Register to Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
              Export Drawings Excel (.xlsx)
            </button>

            <button
              type="button"
              onClick={() => setIsMachineBomModalOpen(true)}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
              title="Upload a multi-sheet Machine CAD BOM & Progress Excel workbook (.xlsx) per machine to extract and populate Project, Machine, Controlled Drawings, and Parts"
            >
              <Upload className="w-3.5 h-3.5" />
              Import Machine CAD BOM (.xlsx)
            </button>

            <button
              type="button"
              onClick={() => {
                setDrawingsImportResultBanner(null);
                setIsDrawingsImportModalOpen(true);
              }}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
              title="Import Controlled Engineering Drawings & Revisions from Excel (.xlsx / .xls) or CSV"
            >
              <Upload className="w-3.5 h-3.5" />
              Import Drawings Excel / CSV
            </button>

            <label className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>Import via PDF</span>
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0] || null;
                  resetDrawingModal();
                  setIsNewModalOpen(true);
                  if (file) {
                    await handleDrawingFileImport(file);
                  }
                  e.target.value = '';
                }}
              />
            </label>

            <label
              className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              title="Select a revised CAD PDF to update an existing drawing version"
            >
              <Upload className="w-4 h-4" />
              <span>{isGlobalRevPdfScanning ? 'Scanning Revision PDF...' : 'Update Version via PDF'}</span>
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                disabled={isGlobalRevPdfScanning}
                onChange={async (e) => {
                  const file = e.target.files?.[0] || null;
                  if (file) {
                    await handleGlobalRevisionPdfUpload(file);
                  }
                  e.target.value = '';
                }}
              />
            </label>

            <label className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer">
              <Camera className="w-4 h-4" />
              <span>Import via Image / Photo</span>
              <input
                type="file"
                accept="image/*,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0] || null;
                  resetDrawingModal();
                  setIsNewModalOpen(true);
                  if (file) {
                    await handleDrawingFileImport(file);
                  }
                  e.target.value = '';
                }}
              />
            </label>

            <button
              onClick={() => {
                resetDrawingModal();
                setIsNewModalOpen(true);
              }}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              Register New Drawing
            </button>

            {isAdmin && db.drawings.length > 0 && (
              <>
                {!confirmClearDrawingsList ? (
                  <button
                    type="button"
                    onClick={() => setConfirmClearDrawingsList(true)}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
                    title="Administrator: Clear entire Drawings List"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear Drawings List ({db.drawings.length})
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-300 px-2.5 py-1 rounded text-xs">
                    <span className="font-bold text-rose-900">Clear all {db.drawings.length} drawings?</span>
                    <button
                      type="button"
                      onClick={async () => {
                        await clearCollectionList('drawings');
                        setConfirmClearDrawingsList(false);
                      }}
                      className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-[11px]"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearDrawingsList(false)}
                      className="px-2 py-0.5 bg-white text-slate-700 border border-slate-300 rounded font-semibold text-[11px]"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Search, Status Filter & Version History Toggle Bar */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by Drawing Number (e.g. T0559-058-719-00-02-012-00), Part Number, Title, Element Code, Revision..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs text-slate-900"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Version History Toggle */}
          <div
            className="inline-flex items-center bg-slate-100 p-1 rounded-md border border-slate-200 text-xs"
            role="group"
            aria-label="Version History Toggle"
          >
            <button
              type="button"
              onClick={() => setVersionViewMode('CURRENT')}
              className={`px-2.5 py-1 rounded font-semibold flex items-center gap-1.5 transition-colors ${
                versionViewMode === 'CURRENT'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Current Versions ({currentCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setVersionViewMode('ARCHIVED')}
              className={`px-2.5 py-1 rounded font-semibold flex items-center gap-1.5 transition-colors ${
                versionViewMode === 'ARCHIVED'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Archived / Superseded ({archivedCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setVersionViewMode('ALL')}
              className={`px-2.5 py-1 rounded font-semibold flex items-center gap-1.5 transition-colors ${
                versionViewMode === 'ALL'
                  ? 'bg-slate-800 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>All Versions ({db.drawings.length})</span>
            </button>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded text-xs text-slate-700 py-1.5 px-3"
          >
            <option value="ALL">All Statuses</option>
            <option value="APPROVED">APPROVED</option>
            <option value="SUPERSEDED">SUPERSEDED (Historical)</option>
            <option value="UNDER_REVIEW">UNDER REVIEW</option>
            <option value="DRAFT">DRAFT</option>
          </select>
        </div>
      </div>

      {/* Drawings Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white uppercase font-mono text-[10px] tracking-wider">
                <th className="py-3 px-4">Drawing Number</th>
                <th className="py-3 px-4">Rev &amp; Version Switcher</th>
                <th className="py-3 px-4">Title &amp; Registered Parts List</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Approval &amp; Effective Date</th>
                <th className="py-3 px-4">Controlled Print (PDF / Photo)</th>
                <th className="py-3 px-4 text-right">Engineering Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredDrawings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-sans">
                    <div className="max-w-md mx-auto space-y-2">
                      <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="font-bold text-slate-700">No Drawings in Register</p>
                      <p className="text-xs text-slate-500">
                        The controlled drawings register is clean (blank slate). Click "+ New Drawing / Revision" or "Import Drawings Register (Excel / CSV)" to upload your engineering drawings and BOM parts lists.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDrawings.map((baseDwg) => {
                const dwgKey = baseDwg.drawingNumber.trim().toUpperCase();
                const allRevsForDwg = versionsByDrawingNumber[dwgKey] || [baseDwg];
                // When in CURRENT mode and a drawing has multiple versions, allow inline switching between Current & Archived right inside the row
                const activeInlineId = selectedVersionByDwgNo[dwgKey];
                const dwg =
                  versionViewMode === 'CURRENT' && activeInlineId
                    ? allRevsForDwg.find((v) => v.id === activeInlineId) || baseDwg
                    : baseDwg;

                const histRecordsCount = db.manufacturingRecords.filter(
                  (r) =>
                    r.drawingNumber.toUpperCase() === dwg.drawingNumber.toUpperCase() &&
                    r.drawingRevision.toUpperCase() === dwg.revision.toUpperCase()
                ).length;

                const registeredParts = getDrawingPartsArray(dwg);
                const isMainFileImage = isImageAttachment(dwg.drawingFile);
                const extraPhotosCount = dwg.revisionPhotos?.length || 0;

                return (
                  <tr
                    key={baseDwg.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      !dwg.isCurrent ? 'bg-amber-50/30' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 align-top">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span>{dwg.drawingNumber}</span>
                        {dwg.isCurrent ? (
                          <span className="px-1.5 py-0.5 text-[9px] bg-blue-100 text-blue-800 border border-blue-300 rounded font-mono">
                            CURRENT
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 text-[9px] bg-amber-100 text-amber-900 border border-amber-300 rounded font-mono">
                            ARCHIVED
                          </span>
                        )}
                      </div>
                      {(dwg.elementCode || dwg.projectReference) && (
                        <div className="text-[10px] text-slate-500 font-mono mt-1">
                          {dwg.elementCode ? `Elem: ${dwg.elementCode}` : ''}
                          {dwg.elementCode && dwg.projectReference ? ' • ' : ''}
                          {dwg.projectReference || ''}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono align-top">
                      <div className="font-black text-blue-700">REV {dwg.revision}</div>

                      {/* Inline Version History Toggle when multiple versions exist for this drawing */}
                      {allRevsForDwg.length > 1 && (
                        <div className="mt-1.5 space-y-1">
                          <div className="text-[9px] text-slate-500 uppercase tracking-wider flex items-center gap-1">
                            <History className="w-2.5 h-2.5 text-slate-400" />
                            <span>Switch Version ({allRevsForDwg.length}):</span>
                          </div>
                          <div className="inline-flex flex-wrap gap-1 bg-slate-100 p-1 rounded border border-slate-200">
                            {allRevsForDwg.map((ver) => {
                              const isSelected = ver.id === dwg.id;
                              return (
                                <button
                                  key={ver.id}
                                  type="button"
                                  onClick={() => {
                                    if (versionViewMode === 'CURRENT') {
                                      setSelectedVersionByDwgNo((prev) => ({
                                        ...prev,
                                        [dwgKey]: ver.id,
                                      }));
                                    } else {
                                      setViewingDrawing(ver);
                                    }
                                  }}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                                    isSelected
                                      ? ver.isCurrent
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-amber-600 text-white'
                                      : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                                  }`}
                                  title={`Rev ${ver.revision} (${
                                    ver.isCurrent ? 'Current' : 'Archived'
                                  }) — ${ver.effectiveDate}`}
                                >
                                  Rev {ver.revision} {ver.isCurrent ? '★' : '(Arch)'}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 align-top">
                      <div className="font-bold text-slate-900">{dwg.drawingTitle}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {dwg.revisionNotes}
                      </div>

                      {/* Multi-Part Badges */}
                      <div className="mt-2 space-y-1.5">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 flex items-center gap-1">
                          <Layers className="w-3 h-3 text-blue-600" />
                          <span>Registered Parts ({registeredParts.length}):</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {registeredParts.map((pt, i) => (
                            <span
                              key={i}
                              onClick={() => navigateToCrossRef('components', pt.partNumber)}
                              className="cursor-pointer inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 hover:bg-amber-50 text-slate-800 border border-slate-300 hover:border-amber-300 font-mono text-[10px]"
                              title={`Click to open ${pt.partNumber} in Component Master | ${pt.description || ''} ${
                                pt.material ? `| ${pt.material}` : ''
                              }`}
                            >
                              <span className="font-bold text-blue-700">{pt.partNumber}</span>
                              {pt.quantity && (
                                <span className="text-slate-500">(Qty: {pt.quantity})</span>
                              )}
                              {pt.description && pt.description !== dwg.drawingTitle && (
                                <span className="text-slate-600 truncate max-w-44">
                                  — {pt.description}
                                </span>
                              )}
                            </span>
                          ))}
                        </div>

                        {/* Cross-Referenced Projects & Machines */}
                        {(() => {
                          const xref =
                            crossRefsByDrawingId.get(dwg.id) ||
                            getDrawingCrossReferences(db, dwg);
                          return (
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              {xref.projects.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() =>
                                    navigateToCrossRef('projects', p.projectNumber, p.id)
                                  }
                                  className="px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded font-mono text-[10px] font-bold inline-flex items-center gap-1"
                                  title={`Allocated to Project ${p.projectNumber}: ${p.projectName} — Click to open in Project Register`}
                                >
                                  <FolderKanban className="w-2.5 h-2.5 text-blue-600" />
                                  <span>Project: {p.projectNumber}</span>
                                </button>
                              ))}
                              {xref.machines.slice(0, 3).map((m) => (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() =>
                                    navigateToCrossRef('machines', m.serialNumber, m.id)
                                  }
                                  className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded font-mono text-[10px] inline-flex items-center gap-1"
                                  title={`Allocated to Machine ${m.serialNumber} (${m.machineType}) — Click to open in Machine Register`}
                                >
                                  <Cpu className="w-2.5 h-2.5 text-slate-600" />
                                  <span>{m.serialNumber}</span>
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                      </div>

                      {histRecordsCount > 0 && (
                        <div className="text-[10px] text-emerald-700 font-mono font-semibold mt-1.5 flex items-center gap-1">
                          <History className="w-3 h-3" />
                          Linked to {histRecordsCount} manufacturing record(s) (Snapshot Protected)
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 align-top">
                      <StatusBadge status={dwg.drawingStatus} />
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-700 align-top">
                      {dwg.approvedBy ? (
                        <>
                          <div className="font-semibold text-slate-900">{dwg.approvedBy}</div>
                          <div className="text-slate-500">
                            Approved: {dwg.approvalDate} | Eff: {dwg.effectiveDate}
                          </div>
                        </>
                      ) : (
                        <span className="text-amber-700 font-semibold">
                          Unapproved ({dwg.drawingStatus})
                        </span>
                      )}
                      {(dwg.detailedBy || dwg.modelledBy) && (
                        <div className="text-[10px] text-slate-500 mt-1">
                          {dwg.modelledBy ? `Modelled: ${dwg.modelledBy}` : ''}
                          {dwg.detailedBy ? ` | Detailed: ${dwg.detailedBy}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 align-top">
                      {dwg.drawingFile?.fileId ? (
                        <div className="flex flex-col gap-1.5">
                          {isMainFileImage && (
                            <div
                              onClick={() =>
                                setLightboxImageUrl({
                                  url: DBService.resolveAttachmentPreviewUrl(dwg.drawingFile!),
                                  title: `${dwg.drawingNumber} (REV ${dwg.revision}) — ${dwg.drawingFile!.originalFilename}`,
                                })
                              }
                              className="relative group w-24 h-16 rounded border border-indigo-200 overflow-hidden bg-slate-100 cursor-pointer shadow-2xs"
                              title="Click to enlarge Revision Drawing Image / Photo"
                            >
                              <img
                                src={DBService.resolveAttachmentPreviewUrl(dwg.drawingFile)}
                                alt={dwg.drawingFile.originalFilename}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              <span className="absolute bottom-0.5 right-0.5 bg-slate-900/80 text-white p-0.5 rounded">
                                <ZoomIn className="w-3 h-3" />
                              </span>
                            </div>
                          )}

                          <div className="flex items-center gap-1 flex-wrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                                isMainFileImage
                                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                                  : 'bg-blue-100 text-blue-800 border border-blue-300'
                              }`}
                            >
                              {isMainFileImage ? 'IMAGE / PHOTO' : 'PDF PRINT'}
                            </span>
                            {extraPhotosCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                +{extraPhotosCount} Photo{extraPhotosCount === 1 ? '' : 's'}
                              </span>
                            )}
                          </div>

                          <a
                            href={DBService.getAttachmentDownloadUrl(dwg.drawingFile)}
                            target="_blank"
                            rel="noreferrer"
                            download={dwg.drawingFile.originalFilename}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded font-mono text-[11px] font-semibold max-w-48 truncate"
                          >
                            <Download className="w-3 h-3 shrink-0" />
                            <span className="truncate">{dwg.drawingFile.originalFilename}</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              setViewingDrawing(dwg);
                              setShowEmbeddedPdfPreview(true);
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 hover:text-blue-700 font-mono"
                          >
                            <Eye className="w-3 h-3" /> Preview &amp; Compare Versions
                          </button>
                        </div>
                      ) : extraPhotosCount > 0 ? (
                        <div className="flex flex-col gap-1">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-indigo-100 text-indigo-800 border border-indigo-300 w-fit">
                            {extraPhotosCount} REVISION PHOTO{extraPhotosCount === 1 ? '' : 'S'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setViewingDrawing(dwg);
                              setShowEmbeddedPdfPreview(true);
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 hover:text-indigo-900 font-mono"
                          >
                            <Eye className="w-3 h-3" /> View Revision Photos
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-mono">
                          No PDF / Photo attached
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 align-top whitespace-nowrap">
                      <button
                        onClick={() => {
                          setViewingDrawing(dwg);
                          setShowEmbeddedPdfPreview(true);
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-[11px] font-semibold inline-flex items-center gap-1"
                        title="Open Version History & Registered Parts"
                      >
                        <History className="w-3 h-3 text-blue-600" /> Versions ({allRevsForDwg.length})
                      </button>

                      {canManageDrawings && (
                        <button
                          onClick={() => handleOpenEditDrawing(dwg)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[11px] font-semibold inline-flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" /> Edit
                        </button>
                      )}

                      {canManageDrawings && !dwg.isCurrent && (
                        <button
                          onClick={() => handleActivateDrawingVersion(dwg)}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold inline-flex items-center gap-1"
                          title="Restore this archived revision as the Current active version"
                        >
                          <RotateCcw className="w-3 h-3" /> Set Current
                        </button>
                      )}

                      {canManageDrawings &&
                        dwg.drawingStatus !== 'APPROVED' &&
                        dwg.drawingStatus !== 'SUPERSEDED' && (
                          <button
                            onClick={() => handleApproveDrawing(dwg)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold inline-flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Approve
                          </button>
                        )}

                      {canManageDrawings && dwg.isCurrent && (
                        <>
                          <button
                            onClick={() => handleOpenRevisionModal(dwg)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-[11px] font-semibold inline-flex items-center gap-1 shadow-2xs"
                            title={`Issue new revision for ${dwg.drawingNumber}`}
                          >
                            <GitBranch className="w-3 h-3" /> New Rev
                          </button>

                          <label
                            className="px-2.5 py-1 bg-blue-700 hover:bg-blue-800 text-white rounded text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                            title={`Update version of ${dwg.drawingNumber} by selecting its revised CAD PDF`}
                          >
                            <Upload className="w-3 h-3" />
                            <span>Update via PDF</span>
                            <input
                              type="file"
                              accept=".pdf,application/pdf"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                if (file) {
                                  handleOpenRevisionModal(dwg, file);
                                }
                                e.target.value = '';
                              }}
                            />
                          </label>
                        </>
                      )}

                      {isAdmin && (
                        <>
                          {confirmDeleteDrawingId !== dwg.id ? (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteDrawingId(dwg.id)}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded text-[11px] font-bold inline-flex items-center gap-1"
                              title={`Delete Drawing ${dwg.drawingNumber} Rev ${dwg.revision}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-rose-50 border border-rose-300 px-2 py-0.5 rounded text-[10px]">
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteDrawing(dwg.id);
                                  setConfirmDeleteDrawingId(null);
                                }}
                                className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold"
                              >
                                Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteDrawingId(null)}
                                className="px-1.5 py-0.5 bg-white text-slate-700 border border-slate-300 rounded font-semibold"
                              >
                                Cancel
                              </button>
                            </span>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Drawing & PDF / Image / Photo Import Modal */}
      <Modal
        isOpen={isNewModalOpen}
        onClose={() => {
          setIsNewModalOpen(false);
          resetDrawingModal();
        }}
        title={
          editingDrawingId
            ? 'Edit Controlled Engineering Drawing & Parts List'
            : 'Register / Import Engineering Drawing via PDF or Image / Photo'
        }
        subtitle="Import a CAD PDF or Image / Photo of a drawing to auto-populate Section 5 fields, and manually enter one or multiple parts on the drawing"
        maxWidth="4xl"
      >
        <form onSubmit={handleCreateOrUpdateDrawing} className="space-y-4 text-xs">
          {/* PDF & Image/Photo Import Bar */}
          <div className="p-3.5 bg-emerald-50/80 border border-emerald-300 rounded-lg space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="font-bold text-emerald-950 flex items-center gap-1.5 text-xs">
                  <Upload className="w-4 h-4 text-emerald-700" />
                  <span>
                    Step 1: Import Engineering Drawing via PDF or Image / Photo (Auto-Populates Fields &amp; Parts)
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  Upload a CAD PDF or a drawing Image / Photo (`.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`, or Camera capture) to extract Drawing No, Rev, Title, Element Code, Project, and Parts List.
                </p>
              </div>

              <button
                type="button"
                onClick={handleLoadDaleSampleFormat}
                className="px-2.5 py-1.5 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-400 rounded text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 shadow-2xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                Load Sample (T0559-058-719-00-02-012-00)
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-2xs">
                <FileText className="w-3.5 h-3.5" />
                <span>Select PDF or Image File</span>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
                  onChange={(e) => handleDrawingFileImport(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>

              <label className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-2xs">
                <Camera className="w-3.5 h-3.5" />
                <span>Take Photo of Drawing (Camera)</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => handleDrawingFileImport(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>

              {newDrawingFile && (
                <span className="font-mono text-[11px] text-emerald-950 bg-white px-2.5 py-1 rounded border border-emerald-300">
                  Selected: <strong>{newDrawingFile.name}</strong> (
                  {Math.round(newDrawingFile.size / 1024)} KB)
                </span>
              )}
            </div>

            {newDrawingImagePreviewUrl && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 bg-white rounded border border-indigo-200">
                <div className="flex items-center gap-3">
                  <img
                    src={newDrawingImagePreviewUrl}
                    alt="Imported Drawing Preview"
                    onClick={() =>
                      setLightboxImageUrl({
                        url: newDrawingImagePreviewUrl,
                        title: newDrawingFile?.name || 'Drawing Image / Photo Preview',
                      })
                    }
                    className="w-28 h-20 object-contain rounded border border-slate-200 bg-slate-50 cursor-pointer"
                  />
                  <div className="space-y-1">
                    <div className="font-bold text-indigo-950 flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Drawing Image / Photo Attached &amp; Scanned</span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Click the thumbnail to inspect full-screen while verifying extracted columns below.
                    </p>
                  </div>
                </div>
                {newDrawingFile && (
                  <button
                    type="button"
                    disabled={isParsingFile}
                    onClick={() => handleDrawingFileImport(newDrawingFile)}
                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 rounded text-[11px] font-semibold inline-flex items-center gap-1.5 shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{isParsingFile ? 'Scanning Photo...' : 'Re-Scan Photo & Populate Columns'}</span>
                  </button>
                )}
              </div>
            )}

            {isParsingFile && (
              <div className="text-[11px] font-mono text-blue-700 font-semibold">
                {ocrProgress !== null
                  ? `Running OCR on drawing photo (${ocrProgress}%)...`
                  : 'Reading drawing text streams and extracting title block + parts list...'}
              </div>
            )}

            {fileParseBanner && (
              <div
                className={`p-2.5 rounded border text-[11px] font-medium ${
                  fileParseBanner.type === 'success'
                    ? 'bg-emerald-100/90 border-emerald-400 text-emerald-950'
                    : fileParseBanner.type === 'error'
                    ? 'bg-rose-100 border-rose-300 text-rose-900'
                    : 'bg-blue-50 border-blue-200 text-blue-900'
                }`}
              >
                {fileParseBanner.message}
              </div>
            )}

            {existingDwgMatch && !editingDrawingId && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <div className="font-bold text-amber-950 flex items-center gap-1.5">
                    <GitBranch className="w-4 h-4 text-amber-700" />
                    <span>Existing Drawing Detected in Register</span>
                  </div>
                  <p className="text-[11px] text-amber-900 mt-0.5">
                    <strong>{existingDwgMatch.drawing.drawingNumber}</strong> already exists (Current: Rev{' '}
                    <strong>{existingDwgMatch.drawing.revision}</strong>). You can issue this PDF directly as an updated Version (Rev{' '}
                    <strong>{existingDwgMatch.newRev}</strong>) and archive the prior revision.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const file = existingDwgMatch.file;
                    const dwg = existingDwgMatch.drawing;
                    setIsNewModalOpen(false);
                    resetDrawingModal();
                    handleOpenRevisionModal(dwg, file);
                  }}
                  className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded font-bold text-xs inline-flex items-center gap-1.5 shrink-0 shadow-2xs"
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>Issue as Version Update (Rev {existingDwgMatch.newRev})</span>
                </button>
              </div>
            )}
          </div>

          {/* Core Drawing Identification & Title Block Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Drawing Number *</label>
              <input
                type="text"
                required
                placeholder="e.g. T0559-058-719-00-02-012-00"
                value={newDrawingForm.drawingNumber}
                onChange={(e) =>
                  setNewDrawingForm({ ...newDrawingForm, drawingNumber: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded font-mono uppercase font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Revision (REV) *</label>
              <input
                type="text"
                required
                placeholder="e.g. 0 or A"
                value={newDrawingForm.revision}
                onChange={(e) =>
                  setNewDrawingForm({ ...newDrawingForm, revision: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded font-mono uppercase font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Element Code</label>
              <input
                type="text"
                placeholder="e.g. 719"
                value={newDrawingForm.elementCode}
                onChange={(e) =>
                  setNewDrawingForm({ ...newDrawingForm, elementCode: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Drawing Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. BULK HOPPER CORNER 4 — T0559-058-719-00-02 CONTROL MECH."
                value={newDrawingForm.drawingTitle}
                onChange={(e) =>
                  setNewDrawingForm({ ...newDrawingForm, drawingTitle: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-bold text-slate-700">
                  Project / Machine Reference
                </label>
                <select
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                      setNewDrawingForm({ ...newDrawingForm, projectReference: val });
                    }
                  }}
                  className="px-1.5 py-0.5 border border-slate-300 rounded bg-slate-50 font-mono text-[10px] text-blue-800"
                >
                  <option value="">+ Select Registered Project...</option>
                  {db.projects.map((p) => (
                    <option
                      key={p.id}
                      value={`${p.projectNumber} — ${p.projectName}`}
                    >
                      {p.projectNumber} — {p.projectName}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                placeholder="e.g. T0559 - BULK HOPPER or PRJ-2026-104"
                value={newDrawingForm.projectReference}
                onChange={(e) =>
                  setNewDrawingForm({ ...newDrawingForm, projectReference: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded"
              />
            </div>
          </div>

          {/* Title Block Engineering Details */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Approval Status *</label>
              <select
                value={newDrawingForm.drawingStatus}
                onChange={(e) =>
                  setNewDrawingForm({
                    ...newDrawingForm,
                    drawingStatus: e.target.value as DrawingStatus,
                  })
                }
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
              >
                <option value="APPROVED">APPROVED</option>
                <option value="UNDER_REVIEW">UNDER REVIEW</option>
                <option value="DRAFT">DRAFT</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Effective / Rev Date *</label>
              <input
                type="date"
                required
                value={newDrawingForm.effectiveDate}
                onChange={(e) =>
                  setNewDrawingForm({ ...newDrawingForm, effectiveDate: e.target.value })
                }
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Modelled / Detailed By</label>
              <input
                type="text"
                placeholder="e.g. C.JEVON"
                value={newDrawingForm.detailedBy || newDrawingForm.modelledBy}
                onChange={(e) =>
                  setNewDrawingForm({
                    ...newDrawingForm,
                    detailedBy: e.target.value,
                    modelledBy: e.target.value,
                  })
                }
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Scale</label>
              <input
                type="text"
                placeholder="e.g. A.O.D. / 1:0.5"
                value={newDrawingForm.scale}
                onChange={(e) =>
                  setNewDrawingForm({ ...newDrawingForm, scale: e.target.value })
                }
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Sheet Size &amp; No</label>
              <input
                type="text"
                placeholder="e.g. A3 (1 / 1)"
                value={
                  newDrawingForm.sheetSize.includes('(')
                    ? newDrawingForm.sheetSize
                    : `${newDrawingForm.sheetSize} (${newDrawingForm.sheetNumber})`
                }
                onChange={(e) => {
                  const val = e.target.value;
                  const m = val.match(/^([^(]+)\(([^)]*)\)/);
                  if (m) {
                    setNewDrawingForm({
                      ...newDrawingForm,
                      sheetSize: m[1].trim(),
                      sheetNumber: m[2].trim(),
                    });
                  } else {
                    setNewDrawingForm({ ...newDrawingForm, sheetSize: val });
                  }
                }}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono"
              />
            </div>
          </div>

          {/* MULTIPLE PARTS ON ONE DRAWING — MANUAL ENTRY TABLE (NO DROPDOWNS OR FIXED VALUES) */}
          <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
            <div className="bg-slate-900 text-white px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-400" />
                  <span>
                    PARTS LIST ON THIS DRAWING ({partsList.length} Part
                    {partsList.length === 1 ? '' : 's'}) — Manual Entry
                  </span>
                </div>
                <p className="text-[10px] text-slate-300">
                  Insert one or multiple parts registered on this drawing manually (free-text fields matching the drawing PARTS LIST; no dropdown restrictions).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={handleDownloadDrawingPartsTemplate}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 rounded text-[11px] font-semibold inline-flex items-center gap-1"
                  title="Download Excel (.xlsx) Template for Drawing Parts List"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  Template (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleExportSinglePartsListExcel(partsList, newDrawingForm.drawingNumber)
                  }
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 rounded text-[11px] font-semibold inline-flex items-center gap-1"
                  title="Export this Drawing's Parts List to Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
                  Export (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPartsImportTarget('NEW_OR_EDIT');
                    setPartsImportResultBanner(null);
                    setIsPartsImportModalOpen(true);
                  }}
                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold inline-flex items-center gap-1"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Import Excel / CSV
                </button>
                <button
                  type="button"
                  onClick={handleAddPartRow}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-bold inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Part Row
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 font-mono text-[10px] uppercase text-slate-700">
                    <th className="py-2 px-2 w-14">ITEM</th>
                    <th className="py-2 px-2 w-16">QTY</th>
                    <th className="py-2 px-2 min-w-48">DRAWING / PART No *</th>
                    <th className="py-2 px-2 min-w-52">DESCRIPTION</th>
                    <th className="py-2 px-2 min-w-36">MATERIAL</th>
                    <th className="py-2 px-2 min-w-32">DESIGNATION</th>
                    <th className="py-2 px-2 w-24">ORDER #</th>
                    <th className="py-2 px-2 w-24">VENDOR</th>
                    <th className="py-2 px-2 w-10 text-center">DEL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {partsList.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/70">
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={row.itemNumber}
                          onChange={(e) =>
                            handleUpdatePartRow(row.id, 'itemNumber', e.target.value)
                          }
                          placeholder="1"
                          className="w-full px-2 py-1 border border-slate-300 rounded font-mono text-center bg-white"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={row.quantity}
                          onChange={(e) =>
                            handleUpdatePartRow(row.id, 'quantity', e.target.value)
                          }
                          placeholder="1"
                          className="w-full px-2 py-1 border border-slate-300 rounded font-mono text-center bg-white"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={row.partNumber}
                          onChange={(e) =>
                            handleUpdatePartRow(row.id, 'partNumber', e.target.value)
                          }
                          placeholder="e.g. T0559-058-719-00-02-012-01"
                          className="w-full px-2 py-1 border border-slate-300 rounded font-mono font-bold uppercase bg-white text-slate-900"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={row.description}
                          onChange={(e) =>
                            handleUpdatePartRow(row.id, 'description', e.target.value)
                          }
                          placeholder="e.g. 55,2 X 2 THK PLT X 55,6 LG"
                          className="w-full px-2 py-1 border border-slate-300 rounded bg-white text-slate-900"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={row.material}
                          onChange={(e) =>
                            handleUpdatePartRow(row.id, 'material', e.target.value)
                          }
                          placeholder="e.g. S/S 304 SATIN"
                          className="w-full px-2 py-1 border border-slate-300 rounded font-mono bg-white text-slate-900"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={row.designation}
                          onChange={(e) =>
                            handleUpdatePartRow(row.id, 'designation', e.target.value)
                          }
                          placeholder="e.g. MANUF-INT"
                          className="w-full px-2 py-1 border border-slate-300 rounded font-mono uppercase bg-white text-slate-900"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={row.orderNumber || ''}
                          onChange={(e) =>
                            handleUpdatePartRow(row.id, 'orderNumber', e.target.value)
                          }
                          placeholder="Optional"
                          className="w-full px-2 py-1 border border-slate-300 rounded font-mono bg-white"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={row.vendor || ''}
                          onChange={(e) =>
                            handleUpdatePartRow(row.id, 'vendor', e.target.value)
                          }
                          placeholder="Optional"
                          className="w-full px-2 py-1 border border-slate-300 rounded bg-white"
                        />
                      </td>
                      <td className="p-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemovePartRow(row.id)}
                          className="p-1 text-rose-500 hover:text-rose-700 rounded hover:bg-rose-50"
                          title="Remove Part Row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Reference Drawings (Drawing No &amp; Description)
              </label>
              <input
                type="text"
                placeholder="e.g. T0559-058-719-00-02-007-00 — BULK HOPPER WELDED ASSEMBLY"
                value={newDrawingForm.referenceDrawings}
                onChange={(e) =>
                  setNewDrawingForm({ ...newDrawingForm, referenceDrawings: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Revision / Engineering Notes
              </label>
              <input
                type="text"
                placeholder="e.g. ISSUED FOR MANUFACTURE."
                value={newDrawingForm.revisionNotes}
                onChange={(e) =>
                  setNewDrawingForm({ ...newDrawingForm, revisionNotes: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded"
              />
            </div>
          </div>

          {/* Optional Additional Drawing / Revision Photos */}
          <PhotoEvidenceGallery
            title="Additional Drawing / Revision Photos & Visual References (Optional)"
            subtitle="Attach supplementary images or photos of physical prints, templates, or shop-floor markups (uploading a drawing photo here also auto-scans empty columns)"
            photos={newDrawingRevisionPhotos}
            onChange={async (updatedPhotos) => {
              const addedNewPhoto =
                updatedPhotos.length > newDrawingRevisionPhotos.length
                  ? updatedPhotos[updatedPhotos.length - 1]
                  : null;
              setNewDrawingRevisionPhotos(updatedPhotos);
              if (addedNewPhoto && (!newDrawingForm.drawingNumber.trim() || !newDrawingFile)) {
                const asFile = await attachmentToFile(addedNewPhoto);
                if (asFile) {
                  await handleDrawingFileImport(asFile);
                }
              }
            }}
            relatedRecordId={newDrawingForm.drawingNumber || 'DRAWING'}
            badgeColor="blue"
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                setIsNewModalOpen(false);
                resetDrawingModal();
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold"
            >
              {isUploading
                ? 'Uploading & Saving...'
                : editingDrawingId
                ? 'Save Drawing & Parts Changes'
                : 'Register Drawing & Parts List'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Drawing Parts List & Interactive Version History Switcher Modal */}
      {viewingDrawing && (
        <Modal
          isOpen={Boolean(viewingDrawing)}
          onClose={() => {
            setViewingDrawing(null);
            setShowEmbeddedPdfPreview(false);
          }}
          title={`Drawing Record & Version History: ${viewingDrawing.drawingNumber} (REV ${viewingDrawing.revision})`}
          subtitle={viewingDrawing.drawingTitle}
          maxWidth="4xl"
        >
          {(() => {
            const allVersions =
              versionsByDrawingNumber[viewingDrawing.drawingNumber.trim().toUpperCase()] || [
                viewingDrawing,
              ];
            const isViewingImage = isImageAttachment(viewingDrawing.drawingFile);
            const revPhotos = viewingDrawing.revisionPhotos || [];

            return (
              <div className="space-y-4 text-xs">
                {/* VERSION HISTORY TOGGLE BAR FOR THIS DRAWING */}
                <div className="p-3 bg-slate-100 border border-slate-300 rounded-lg space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <History className="w-4 h-4 text-blue-600" />
                      <span>
                        Version History Switcher ({allVersions.length} Revision
                        {allVersions.length === 1 ? '' : 's'} Recorded)
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {canManageDrawings && !viewingDrawing.isCurrent && (
                        <button
                          type="button"
                          onClick={() => handleActivateDrawingVersion(viewingDrawing)}
                          className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[11px] inline-flex items-center gap-1.5 shadow-2xs"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Restore REV {viewingDrawing.revision} as Current Active Version
                        </button>
                      )}

                      {canManageDrawings && (
                        <>
                          <label
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[11px] inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                            title={`Update version of ${viewingDrawing.drawingNumber} by selecting its revised CAD PDF`}
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Update Version via PDF</span>
                            <input
                              type="file"
                              accept=".pdf,application/pdf"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                if (file) {
                                  const target = viewingDrawing;
                                  setViewingDrawing(null);
                                  handleOpenRevisionModal(target, file);
                                }
                                e.target.value = '';
                              }}
                            />
                          </label>

                          <button
                            type="button"
                            onClick={() => {
                              const target = viewingDrawing;
                              setViewingDrawing(null);
                              handleOpenRevisionModal(target);
                            }}
                            className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold text-[11px] inline-flex items-center gap-1.5 shadow-2xs"
                          >
                            <GitBranch className="w-3.5 h-3.5" />
                            Issue New Revision (Manual)
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {allVersions.map((ver) => {
                      const isSelected = ver.id === viewingDrawing.id;
                      const verIsImage = isImageAttachment(ver.drawingFile);
                      const verPhotoCount = ver.revisionPhotos?.length || 0;
                      return (
                        <button
                          key={ver.id}
                          type="button"
                          onClick={() => setViewingDrawing(ver)}
                          className={`px-3 py-2 rounded-md border text-left transition-all flex items-center gap-2.5 ${
                            isSelected
                              ? ver.isCurrent
                                ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                                : 'bg-amber-600 text-white border-amber-700 shadow-xs'
                              : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
                          }`}
                        >
                          <div>
                            <div className="font-mono font-black text-xs flex items-center gap-1.5">
                              <span>REV {ver.revision}</span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-mono ${
                                  isSelected
                                    ? 'bg-white/20 text-white'
                                    : ver.isCurrent
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-amber-100 text-amber-900'
                                }`}
                              >
                                {ver.isCurrent ? 'CURRENT' : 'ARCHIVED'}
                              </span>
                              {ver.drawingFile && (
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-mono ${
                                    isSelected
                                      ? 'bg-black/25 text-white'
                                      : verIsImage
                                      ? 'bg-indigo-100 text-indigo-800'
                                      : 'bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  {verIsImage ? 'PHOTO/IMG' : 'PDF'}
                                </span>
                              )}
                              {verPhotoCount > 0 && (
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-mono ${
                                    isSelected
                                      ? 'bg-black/25 text-white'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  +{verPhotoCount} Photo{verPhotoCount === 1 ? '' : 's'}
                                </span>
                              )}
                            </div>
                            <div
                              className={`text-[10px] font-mono ${
                                isSelected ? 'text-white/85' : 'text-slate-500'
                              }`}
                            >
                              Eff: {ver.effectiveDate} • {ver.drawingStatus}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Version Metadata Banner */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900 text-white p-3.5 rounded-lg font-mono text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[9px]">DRAWING No</span>
                    <span className="font-bold text-blue-300">{viewingDrawing.drawingNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px]">SELECTED VERSION</span>
                    <span className="font-bold">
                      REV {viewingDrawing.revision} (
                      {viewingDrawing.isCurrent ? 'CURRENT' : 'ARCHIVED / SUPERSEDED'})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px]">ELEMENT CODE / SCALE</span>
                    <span>
                      {viewingDrawing.elementCode || 'N/A'} | {viewingDrawing.scale || 'A.O.D.'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px]">MODELLED / DETAILED BY</span>
                    <span>{viewingDrawing.detailedBy || viewingDrawing.approvedBy || 'N/A'}</span>
                  </div>
                </div>

                {/* Controlled PDF or Image/Photo Print Viewer for Selected Version */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-bold text-slate-800 flex items-center gap-2">
                      {isViewingImage ? (
                        <ImageIcon className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <FileText className="w-4 h-4 text-blue-600" />
                      )}
                      <span>
                        Controlled Drawing {isViewingImage ? 'Image / Photo' : 'PDF'} for REV{' '}
                        {viewingDrawing.revision} (
                        {viewingDrawing.isCurrent ? 'Current Version' : 'Archived Version'}):
                      </span>
                      <span className="font-mono text-slate-600">
                        {viewingDrawing.drawingFile?.originalFilename ||
                          viewingDrawing.fileName ||
                          'No PDF or Photo attached to this revision'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {viewingDrawing.drawingFile?.fileId && (
                        <>
                          <button
                            type="button"
                            onClick={() => setShowEmbeddedPdfPreview((p) => !p)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded font-semibold text-[11px] inline-flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                            {showEmbeddedPdfPreview
                              ? `Hide ${isViewingImage ? 'Image' : 'PDF'} Viewer`
                              : `Preview ${isViewingImage ? 'Image / Photo' : 'PDF'} Inline`}
                          </button>
                          <a
                            href={DBService.getAttachmentDownloadUrl(viewingDrawing.drawingFile)}
                            target="_blank"
                            rel="noreferrer"
                            download={viewingDrawing.drawingFile.originalFilename}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold text-[11px] inline-flex items-center gap-1"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download REV {viewingDrawing.revision}{' '}
                            {isViewingImage ? 'Image' : 'PDF'}
                          </a>
                        </>
                      )}

                      {canManageDrawings && (
                        <label className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 rounded font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer">
                          <Camera className="w-3.5 h-3.5 text-indigo-600" />
                          <span>
                            {viewingDrawing.drawingFile
                              ? 'Replace Print (PDF / Photo)'
                              : 'Attach PDF / Photo to Rev'}
                          </span>
                          <input
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const f = e.target.files?.[0] || null;
                              await handleReplaceRevisionControlledFile(viewingDrawing, f);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Render Image/Photo Preview or PDF iframe Preview */}
                  {(showEmbeddedPdfPreview || isViewingImage) && viewingDrawing.drawingFile && (
                    <div className="border border-slate-300 rounded overflow-hidden bg-slate-900">
                      {isViewingImage ? (
                        <div className="relative flex flex-col items-center justify-center p-3 bg-slate-900 max-h-[28rem]">
                          <img
                            src={DBService.resolveAttachmentPreviewUrl(viewingDrawing.drawingFile)}
                            alt={`${viewingDrawing.drawingNumber} Rev ${viewingDrawing.revision}`}
                            onClick={() =>
                              setLightboxImageUrl({
                                url: DBService.resolveAttachmentPreviewUrl(
                                  viewingDrawing.drawingFile!
                                ),
                                title: `${viewingDrawing.drawingNumber} (REV ${viewingDrawing.revision}) — ${viewingDrawing.drawingFile!.originalFilename}`,
                              })
                            }
                            className="max-h-96 w-auto object-contain rounded cursor-pointer border border-slate-700 bg-white"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setLightboxImageUrl({
                                url: DBService.resolveAttachmentPreviewUrl(
                                  viewingDrawing.drawingFile!
                                ),
                                title: `${viewingDrawing.drawingNumber} (REV ${viewingDrawing.revision}) — ${viewingDrawing.drawingFile!.originalFilename}`,
                              })
                            }
                            className="mt-2 px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[11px] font-semibold inline-flex items-center gap-1"
                          >
                            <ZoomIn className="w-3.5 h-3.5" /> Open Fullscreen Lightbox
                          </button>
                        </div>
                      ) : (
                        <div className="h-96">
                          <iframe
                            title={`PDF Preview ${viewingDrawing.drawingNumber} Rev ${viewingDrawing.revision}`}
                            src={DBService.resolveAttachmentPreviewUrl(viewingDrawing.drawingFile)}
                            className="w-full h-full bg-white"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Additional Revision Photos Gallery for this Specific Revision */}
                {(revPhotos.length > 0 || canManageDrawings) && (
                  <PhotoEvidenceGallery
                    title={`Revision ${viewingDrawing.revision} — Photos & Visual Markups (${revPhotos.length})`}
                    subtitle={`Images and photos attached to ${viewingDrawing.drawingNumber} REV ${viewingDrawing.revision}`}
                    photos={revPhotos}
                    readOnly={!canManageDrawings}
                    relatedRecordId={`${viewingDrawing.drawingNumber}-REV${viewingDrawing.revision}`}
                    badgeColor="blue"
                    onChange={async (updatedPhotos) => {
                      const ok = await updateDrawing(viewingDrawing.id, {
                        revisionPhotos: updatedPhotos,
                      });
                      if (ok) {
                        setViewingDrawing({
                          ...viewingDrawing,
                          revisionPhotos: updatedPhotos,
                        });
                      }
                    }}
                  />
                )}

                {viewingDrawing.referenceDrawings && (
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded font-mono text-[11px]">
                    <span className="font-bold text-slate-700">REFERENCE DRAWINGS: </span>
                    <span className="text-slate-800">{viewingDrawing.referenceDrawings}</span>
                  </div>
                )}

                {/* Cross-Referenced Projects, Machines & Manufacturing Records for this Drawing */}
                {(() => {
                  const xref =
                    crossRefsByDrawingId.get(viewingDrawing.id) ||
                    getDrawingCrossReferences(db, viewingDrawing);
                  return (
                    <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg space-y-2">
                      <div className="font-bold text-blue-950 text-xs flex items-center gap-1.5">
                        <FolderKanban className="w-4 h-4 text-blue-600" />
                        <span>
                          Cross-Referenced Projects ({xref.projects.length}), Machines (
                          {xref.machines.length}) &amp; Manufacturing Records (
                          {xref.manufacturingRecords.length})
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {xref.projects.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setViewingDrawing(null);
                              navigateToCrossRef('projects', p.projectNumber, p.id);
                            }}
                            className="px-2 py-1 bg-white hover:bg-blue-100 text-blue-900 border border-blue-300 rounded font-mono text-[11px] font-bold inline-flex items-center gap-1"
                          >
                            <FolderKanban className="w-3 h-3 text-blue-600" />
                            <span>
                              {p.projectNumber} — {p.projectName}
                            </span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        ))}
                        {xref.machines.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setViewingDrawing(null);
                              navigateToCrossRef('machines', m.serialNumber, m.id);
                            }}
                            className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded font-mono text-[11px] font-semibold inline-flex items-center gap-1"
                          >
                            <Cpu className="w-3 h-3 text-slate-600" />
                            <span>
                              {m.serialNumber} ({m.machineType})
                            </span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        ))}
                        {xref.manufacturingRecords.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              setViewingDrawing(null);
                              navigateToCrossRef('manufacturing', r.traceabilityNumber, r.id);
                            }}
                            className="px-2 py-1 bg-white hover:bg-indigo-50 text-indigo-900 border border-indigo-300 rounded font-mono text-[11px] font-semibold inline-flex items-center gap-1"
                          >
                            <Hammer className="w-3 h-3 text-indigo-600" />
                            <span>
                              {r.traceabilityNumber} ({r.partNumber})
                            </span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 font-bold text-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      PARTS LIST REGISTERED ON REV {viewingDrawing.revision} (
                      {viewingDrawing.isCurrent ? 'CURRENT' : 'ARCHIVED'})
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isAdmin && (viewingDrawing.partsList?.length || 0) > 0 && (
                        <>
                          {confirmClearBomDrawingId !== viewingDrawing.id ? (
                            <button
                              type="button"
                              onClick={() => setConfirmClearBomDrawingId(viewingDrawing.id)}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded text-[11px] font-bold inline-flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" /> Clear BOM Parts List
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-rose-50 border border-rose-300 px-2 py-0.5 rounded text-[10px]">
                              <button
                                type="button"
                                onClick={async () => {
                                  const res = await clearDrawingPartsList(viewingDrawing.id);
                                  setConfirmClearBomDrawingId(null);
                                  if (res.success) {
                                    setViewingDrawing({
                                      ...viewingDrawing,
                                      partsList: [],
                                      partNumbers: [],
                                      partNumber: '',
                                    });
                                  }
                                }}
                                className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold"
                              >
                                Confirm Clear BOM
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmClearBomDrawingId(null)}
                                className="px-1.5 py-0.5 bg-white text-slate-700 border border-slate-300 rounded font-semibold"
                              >
                                Cancel
                              </button>
                            </span>
                          )}
                        </>
                      )}
                      {canManageDrawings && (
                        <button
                          type="button"
                          onClick={() => {
                            const target = viewingDrawing;
                            setViewingDrawing(null);
                            handleOpenEditDrawing(target);
                          }}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-semibold"
                        >
                          Edit / Add Parts
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 font-mono text-[10px] text-slate-600 uppercase">
                          <th className="py-2 px-3">ITEM</th>
                          <th className="py-2 px-3">QTY</th>
                          <th className="py-2 px-3">DRAWING / PART No</th>
                          <th className="py-2 px-3">DESCRIPTION</th>
                          <th className="py-2 px-3">MATERIAL</th>
                          <th className="py-2 px-3">DESIGNATION</th>
                          <th className="py-2 px-3">ORDER #</th>
                          <th className="py-2 px-3">VENDOR</th>
                          {isAdmin && <th className="py-2 px-3 text-right">ADMIN</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-mono">
                        {getDrawingPartsArray(viewingDrawing).map((pt, idx) => (
                          <tr key={idx}>
                            <td className="py-2 px-3 font-bold">{pt.itemNumber}</td>
                            <td className="py-2 px-3">{pt.quantity}</td>
                            <td className="py-2 px-3 font-bold text-blue-700">{pt.partNumber}</td>
                            <td className="py-2 px-3 font-sans text-slate-900">{pt.description}</td>
                            <td className="py-2 px-3">{pt.material || '-'}</td>
                            <td className="py-2 px-3">{pt.designation || '-'}</td>
                            <td className="py-2 px-3">{pt.orderNumber || '-'}</td>
                            <td className="py-2 px-3">{pt.vendor || '-'}</td>
                            {isAdmin && (
                              <td className="py-2 px-3 text-right">
                                {pt.partNumber && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const res = await deleteDrawingPart(
                                        viewingDrawing.id,
                                        pt.id || pt.partNumber
                                      );
                                      if (res.success) {
                                        const nextParts = (viewingDrawing.partsList || []).filter(
                                          (p) =>
                                            p.id !== pt.id &&
                                            p.partNumber.trim().toUpperCase() !==
                                              pt.partNumber.trim().toUpperCase()
                                        );
                                        const nextPns = nextParts.map((p) =>
                                          p.partNumber.trim().toUpperCase()
                                        );
                                        setViewingDrawing({
                                          ...viewingDrawing,
                                          partsList: nextParts,
                                          partNumbers: nextPns,
                                          partNumber: nextPns.join('; '),
                                        });
                                      }
                                    }}
                                    className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                                    title={`Delete BOM part ${pt.partNumber} from drawing`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setViewingDrawing(null);
                      setShowEmbeddedPdfPreview(false);
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold"
                  >
                    Close
                  </button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

      {/* Issue New Revision Modal (Supports PDF AND Images / Photos + Camera Capture + Multi-Part List) */}
      <Modal
        isOpen={Boolean(revTargetDrawing)}
        onClose={() => setRevTargetDrawing(null)}
        title={`Issue New Revision for ${revTargetDrawing?.drawingNumber}`}
        subtitle={`Archives Rev ${revTargetDrawing?.revision} as SUPERSEDED and creates the new Current revision via PDF or Image / Photo. Existing manufactured components retain their historical Rev ${revTargetDrawing?.revision} approval snapshot.`}
        maxWidth="4xl"
      >
        <form onSubmit={handleIssueNewRevision} className="space-y-4 text-xs">
          {/* Upload & Import Revision Print via CAD PDF or Image / Photo */}
          <div className="p-4 bg-gradient-to-r from-blue-50/90 via-indigo-50/90 to-slate-50 border border-indigo-200 rounded-lg space-y-3">
            <div>
              <div className="font-bold text-indigo-950 flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-sm text-indigo-900 font-extrabold">
                  <Upload className="w-4 h-4 text-indigo-700" />
                  Step 1: Import Revision CAD PDF Drawing (.pdf)
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-indigo-100 text-indigo-800 border border-indigo-300 rounded font-bold">
                  Controlled CAD PDF Import
                </span>
              </div>
              <p className="text-[11px] text-indigo-900 mt-1">
                Importing a revised CAD PDF (`.pdf`) automatically extracts the revision table, title block parameters, updates the Revision Code (Superseding Rev {revTargetDrawing?.revision}), and auto-populates the complete BOM parts list.
              </p>
            </div>

            {/* Drag & Drop Area + Action Buttons */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsRevDraggingOver(true);
              }}
              onDragLeave={() => setIsRevDraggingOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsRevDraggingOver(false);
                const file = e.dataTransfer.files?.[0] || null;
                if (file) {
                  handleRevisionFileSelect(file);
                }
              }}
              className={`border-2 border-dashed rounded-lg p-3 text-center transition-all ${
                isRevDraggingOver
                  ? 'border-indigo-600 bg-indigo-100/60'
                  : 'border-indigo-300 bg-white/70 hover:bg-white'
              }`}
            >
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <label className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors">
                  <FileText className="w-4 h-4" />
                  <span>Select Revision CAD PDF (.pdf)</span>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) => handleRevisionFileSelect(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>

                <label className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300 rounded font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors">
                  <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Upload Image / Scan</span>
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,image/*"
                    onChange={(e) => handleRevisionFileSelect(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>

                <label className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors">
                  <Camera className="w-3.5 h-3.5 text-slate-600" />
                  <span>Take Photo (Camera)</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handleRevisionFileSelect(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>

                {revisionFile && (
                  <button
                    type="button"
                    onClick={() => handleRevisionFileSelect(revisionFile)}
                    disabled={isParsingRevFile}
                    className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-xs font-semibold inline-flex items-center gap-1"
                    title="Re-scan and parse this revision file again"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isParsingRevFile ? 'Parsing...' : 'Re-scan File'}</span>
                  </button>
                )}
              </div>

              <div className="text-[10px] text-slate-500 mt-1.5 font-mono">
                Drag &amp; drop revised CAD PDF here • Automatically parses multi-page engineering prints &amp; BOM tables
              </div>
            </div>

            {/* Selected File Badge */}
            {revisionFile && (
              <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-1.5 rounded border border-indigo-200">
                <div className="flex items-center gap-2 font-mono text-[11px] text-slate-800">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>
                    Attached Print: <strong>{revisionFile.name}</strong> ({Math.round(revisionFile.size / 1024)} KB)
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] bg-blue-100 text-blue-800 border border-blue-200">
                    {revisionFile.name.toLowerCase().endsWith('.pdf') ? 'CAD PDF' : 'IMAGE / PHOTO'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRevisionFileSelect(null)}
                  className="text-rose-600 hover:text-rose-800 font-semibold text-[11px] inline-flex items-center gap-1"
                  title="Remove selected revision file"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Remove File</span>
                </button>
              </div>
            )}

            {/* Interactive PDF Preview for the Revision Controlled Print */}
            {revisionPdfPreviewUrl && (
              <div className="bg-white rounded-lg border border-blue-200 p-3 space-y-2.5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-100 text-blue-700 rounded">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span>Revised CAD Drawing PDF Attached</span>
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 border border-blue-300 rounded font-mono text-[10px]">
                          REV {newRevisionCode || '?'}
                        </span>
                        {revisionPartsList.length > 0 && (
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-mono text-[10px]">
                            {revisionPartsList.length} BOM Parts Loaded
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 font-mono">
                        Inspect the revised drawing alongside the extracted title block and BOM below before confirming.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setRevisionShowPdfPreview((prev) => !prev)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded font-semibold text-[11px] inline-flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      <span>{revisionShowPdfPreview ? 'Hide PDF Preview' : 'Show PDF Preview'}</span>
                    </button>
                    <a
                      href={revisionPdfPreviewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold text-[11px] inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Fullscreen</span>
                    </a>
                  </div>
                </div>

                {revisionShowPdfPreview && (
                  <div className="border border-slate-300 rounded-md overflow-hidden bg-slate-100">
                    <iframe
                      src={revisionPdfPreviewUrl}
                      title={`Revision PDF Preview - ${revTargetDrawing?.drawingNumber} Rev ${newRevisionCode || 'New'}`}
                      className="w-full h-80 sm:h-96 bg-white"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Inline Image / Photo Preview for the Revision Controlled Print */}
            {revisionFilePreviewUrl && (
              <div className="flex items-center gap-3 p-2.5 bg-white rounded border border-indigo-200">
                <img
                  src={revisionFilePreviewUrl}
                  alt="Revision Image Preview"
                  onClick={() =>
                    setLightboxImageUrl({
                      url: revisionFilePreviewUrl,
                      title: `${revTargetDrawing?.drawingNumber} (New Rev ${newRevisionCode || '?'}) — ${revisionFile?.name || 'Photo'}`,
                    })
                  }
                  className="w-32 h-22 object-contain rounded border border-slate-200 bg-slate-50 cursor-pointer"
                />
                <div className="space-y-1">
                  <div className="font-bold text-indigo-950 flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                    <span>New Revision Image / Photo Ready</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    This image/photo will be saved as the controlled drawing print for Revision{' '}
                    <strong>{newRevisionCode || '?'}</strong>. Click thumbnail to view full-screen.
                  </p>
                </div>
              </div>
            )}

            {isParsingRevFile && (
              <div className="text-[11px] font-mono text-indigo-700 font-semibold flex items-center gap-2 bg-indigo-50 p-2 rounded border border-indigo-200">
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-indigo-700" />
                <span>
                  {revOcrProgress !== null
                    ? `Running OCR on revision photo (${revOcrProgress}%)...`
                    : 'Parsing CAD PDF title block, revision table, and BOM parts list...'}
                </span>
              </div>
            )}

            {revParseBanner && (
              <div
                className={`p-2 rounded border text-[11px] font-medium ${
                  revParseBanner.type === 'success'
                    ? 'bg-emerald-100/90 border-emerald-400 text-emerald-950'
                    : revParseBanner.type === 'error'
                    ? 'bg-rose-100 border-rose-300 text-rose-900'
                    : 'bg-blue-50 border-blue-200 text-blue-900'
                }`}
              >
                {revParseBanner.message}
              </div>
            )}
          </div>

          {/* Revision Identification, Effective Date & Approval Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                New Revision Code (Supersedes Rev {revTargetDrawing?.revision}) *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 1 or B"
                value={newRevisionCode}
                onChange={(e) => setNewRevisionCode(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded font-mono uppercase font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Revision Effective Date *
              </label>
              <input
                type="date"
                required
                value={revisionEffectiveDate}
                onChange={(e) => setRevisionEffectiveDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                New Revision Approval Status *
              </label>
              <select
                value={revisionStatus}
                onChange={(e) => setRevisionStatus(e.target.value as DrawingStatus)}
                className="w-full px-3 py-2 border border-slate-300 rounded bg-white font-semibold"
              >
                <option value="APPROVED">APPROVED (Active for Manufacture)</option>
                <option value="UNDER_REVIEW">UNDER REVIEW</option>
                <option value="DRAFT">DRAFT</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Engineering Change / Revision Notes *
            </label>
            <textarea
              rows={2}
              required
              placeholder="Describe dimensional, material, or part changes in this revision..."
              value={revisionChangeNotes}
              onChange={(e) => setRevisionChangeNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded"
            />
          </div>

          {/* Additional Revision Photos / Images Gallery */}
          <PhotoEvidenceGallery
            title="Additional Revision Photos & Shop-Floor Markups (Images / Camera)"
            subtitle="Attach one or multiple images or photos to this drawing revision (uploading a drawing photo here also scans & populates revision details)"
            photos={revisionAdditionalPhotos}
            onChange={async (updatedPhotos) => {
              const addedPhoto =
                updatedPhotos.length > revisionAdditionalPhotos.length
                  ? updatedPhotos[updatedPhotos.length - 1]
                  : null;
              setRevisionAdditionalPhotos(updatedPhotos);
              if (addedPhoto && !revisionFile) {
                const asFile = await attachmentToFile(addedPhoto);
                if (asFile) {
                  await handleRevisionFileSelect(asFile);
                }
              }
            }}
            relatedRecordId={`${revTargetDrawing?.drawingNumber || 'DWG'}-REV${newRevisionCode || 'NEW'}`}
            badgeColor="blue"
          />

          {/* Editable Multi-Part List for the New Revision */}
          <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
            <div className="bg-slate-900 text-white px-3.5 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-400" />
                  <span>
                    PARTS LIST FOR NEW REVISION {newRevisionCode || ''} ({revisionPartsList.length}{' '}
                    Part{revisionPartsList.length === 1 ? '' : 's'})
                  </span>
                </div>
                <p className="text-[10px] text-slate-300">
                  Carried over from Rev {revTargetDrawing?.revision} (or auto-updated from the imported PDF/Photo). Edit or add parts manually if this revision changes any parts.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleDownloadDrawingPartsTemplate}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 rounded text-[11px] font-semibold inline-flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  Template (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPartsImportTarget('REVISION');
                    setPartsImportResultBanner(null);
                    setIsPartsImportModalOpen(true);
                  }}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold inline-flex items-center gap-1"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Import Excel / CSV
                </button>
                <button
                  type="button"
                  onClick={handleAddRevPartRow}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-bold inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Part Row
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-52">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 font-mono text-[10px] uppercase text-slate-700">
                    <th className="py-1.5 px-2 w-12">ITEM</th>
                    <th className="py-1.5 px-2 w-14">QTY</th>
                    <th className="py-1.5 px-2 min-w-44">DRAWING / PART No *</th>
                    <th className="py-1.5 px-2 min-w-48">DESCRIPTION</th>
                    <th className="py-1.5 px-2 min-w-32">MATERIAL</th>
                    <th className="py-1.5 px-2 min-w-28">DESIGNATION</th>
                    <th className="py-1.5 px-2 w-10 text-center">DEL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {revisionPartsList.map((row) => (
                    <tr key={row.id}>
                      <td className="p-1">
                        <input
                          type="text"
                          value={row.itemNumber}
                          onChange={(e) =>
                            handleUpdateRevPartRow(row.id, 'itemNumber', e.target.value)
                          }
                          className="w-full px-1.5 py-1 border border-slate-300 rounded font-mono text-center"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={row.quantity}
                          onChange={(e) =>
                            handleUpdateRevPartRow(row.id, 'quantity', e.target.value)
                          }
                          className="w-full px-1.5 py-1 border border-slate-300 rounded font-mono text-center"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={row.partNumber}
                          onChange={(e) =>
                            handleUpdateRevPartRow(row.id, 'partNumber', e.target.value)
                          }
                          className="w-full px-2 py-1 border border-slate-300 rounded font-mono font-bold uppercase"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={row.description}
                          onChange={(e) =>
                            handleUpdateRevPartRow(row.id, 'description', e.target.value)
                          }
                          className="w-full px-2 py-1 border border-slate-300 rounded"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={row.material}
                          onChange={(e) =>
                            handleUpdateRevPartRow(row.id, 'material', e.target.value)
                          }
                          className="w-full px-2 py-1 border border-slate-300 rounded font-mono"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={row.designation}
                          onChange={(e) =>
                            handleUpdateRevPartRow(row.id, 'designation', e.target.value)
                          }
                          className="w-full px-2 py-1 border border-slate-300 rounded font-mono uppercase"
                        />
                      </td>
                      <td className="p-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveRevPartRow(row.id)}
                          className="p-1 text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setRevTargetDrawing(null)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold"
            >
              {isUploading
                ? 'Uploading & Issuing Revision...'
                : 'Issue Revision & Archive Prior'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Import Controlled Engineering Drawings Register from Excel / CSV Modal */}
      <Modal
        isOpen={isDrawingsImportModalOpen}
        onClose={() => setIsDrawingsImportModalOpen(false)}
        title="Import Controlled Engineering Drawings from Excel (.xlsx / .xls) or CSV"
        subtitle="Upload an Excel workbook (.xlsx / .xls), CSV file, or paste rows from Excel to bulk-register Controlled Engineering Drawings & BOM items"
        maxWidth="4xl"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-bold text-indigo-950">
                Importing a Machine CAD BOM &amp; Progress Workbook (e.g. T0559-058-719-00-00-000-00) per Machine?
              </div>
              <div className="text-[11px] text-indigo-800">
                Allocate the entire CAD BOM &amp; Progress Excel directly to a target Machine Serial, Project, Controlled Drawings &amp; Parts Register.
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsDrawingsImportModalOpen(false);
                setIsMachineBomModalOpen(true);
              }}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold text-xs flex items-center gap-1.5 shrink-0"
            >
              <Cpu className="w-3.5 h-3.5" />
              Import Per Machine (CAD BOM .xlsx)
            </button>
          </div>

          {/* Required Column Criteria Box */}
          <div className="p-3.5 bg-slate-900 text-white rounded-lg space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold flex items-center gap-2 text-emerald-400">
                <FileSpreadsheet className="w-4 h-4" />
                <span>Controlled Engineering Drawings Import Template &amp; Column Criteria</span>
              </div>
              <button
                type="button"
                onClick={handleDownloadDrawingsRegisterTemplate}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold flex items-center gap-1.5"
              >
                <Download className="w-3 h-3" />
                Download Drawings Template (.xlsx)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
              <div className="bg-slate-800/90 p-2 rounded border border-slate-700">
                <div className="text-emerald-300 font-bold">1. Drawing Number &amp; Revision *</div>
                <div className="text-slate-300 text-[10px]">
                  e.g. T0559-058-719-00-02-012-00 | Rev 0. Multiple rows with the same Drawing # &amp; Rev are grouped into one Drawing.
                </div>
              </div>
              <div className="bg-slate-800/90 p-2 rounded border border-slate-700">
                <div className="text-emerald-300 font-bold">2. Drawing Title &amp; Project *</div>
                <div className="text-slate-300 text-[10px]">
                  Drawing Title / Assembly Name, Element Code (e.g. 719), Project Reference, Status &amp; Effective Date.
                </div>
              </div>
              <div className="bg-slate-800/90 p-2 rounded border border-slate-700">
                <div className="text-emerald-300 font-bold">3. Registered BOM Parts (Optional)</div>
                <div className="text-slate-300 text-[10px]">
                  ITEM, QTY, DRAWING / PART No, DESCRIPTION, MATERIAL, DESIGNATION. Automatically links parts to the Drawing.
                </div>
              </div>
            </div>
          </div>

          {/* Upload File or Paste */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 border border-dashed border-slate-300 rounded-lg bg-slate-50 flex flex-col justify-between">
              <div>
                <div className="font-bold text-slate-800 mb-1">
                  Option A: Upload Drawings Excel (.xlsx / .xls) or CSV File
                </div>
                <p className="text-[11px] text-slate-500 mb-2">
                  Select a saved `.xlsx`, `.xls`, or `.csv` file matching the Drawings Register template or export format.
                </p>
              </div>
              <label className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded font-semibold text-xs inline-flex items-center justify-center gap-2 cursor-pointer shadow-2xs">
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>{drawingsImportFileName || 'Choose Drawings .xlsx, .xls, or .csv File...'}</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt,.tsv"
                  onChange={handleDrawingsExcelOrCsvUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
              <div className="font-bold text-slate-800 mb-1">
                Option B: Paste Drawing Rows Directly from Excel / CSV
              </div>
              <textarea
                rows={3}
                value={drawingsImportText}
                onChange={(e) => handleDrawingsTextImportChange(e.target.value)}
                placeholder={
                  'Drawing Number,Revision,Drawing Title,Element Code,Project Reference,ITEM,QTY,DRAWING / PART No,DESCRIPTION,MATERIAL,DESIGNATION,Status\nT0559-058-719-00-02-012-00,0,BULK HOPPER WELDED ASSEMBLY,719,T0559-058,1,1,T0559-058-719-00-02-012-01,55.2 X 2 THK PLT,S/S 304,MANUF-INT,APPROVED'
                }
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono text-[11px] bg-white"
              />
            </div>
          </div>

          {/* Import Result Banner */}
          {drawingsImportResultBanner && (
            <div
              className={`p-3 border rounded-lg flex items-center justify-between ${
                drawingsImportResultBanner.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {drawingsImportResultBanner.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>
                  {drawingsImportResultBanner.ok
                    ? `Successfully imported ${drawingsImportResultBanner.imported} new Controlled Drawing(s)${
                        drawingsImportResultBanner.updated > 0
                          ? ` and updated ${drawingsImportResultBanner.updated} existing Drawing(s)`
                          : ''
                      }${
                        drawingsImportResultBanner.skipped > 0
                          ? ` (${drawingsImportResultBanner.skipped} duplicate/invalid row(s) skipped)`
                          : ''
                      }.`
                    : drawingsImportResultBanner.error || 'Import failed.'}
                </span>
              </div>
              {drawingsImportResultBanner.ok && (
                <button
                  type="button"
                  onClick={() => setIsDrawingsImportModalOpen(false)}
                  className="px-2.5 py-1 bg-emerald-600 text-white rounded text-[11px] font-bold shrink-0"
                >
                  Done
                </button>
              )}
            </div>
          )}

          {/* Live Validation Preview Table */}
          {drawingsParsedImportRows.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-slate-700">
                  Preview ({drawingsParsedImportRows.filter((r) => r.isValid).length} Valid Row(s) across{' '}
                  {
                    new Set(
                      drawingsParsedImportRows
                        .filter((r) => r.isValid)
                        .map((r) => `${r.drawingNumber}__${r.revision}`)
                    ).size
                  }{' '}
                  Unique Drawing(s))
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  Target: Controlled Engineering Drawings Register
                </span>
              </div>
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-mono text-[10px] text-slate-500 uppercase">
                      <th className="py-1.5 px-2.5">Row</th>
                      <th className="py-1.5 px-2.5">Drawing Number</th>
                      <th className="py-1.5 px-2.5">Rev</th>
                      <th className="py-1.5 px-2.5">Drawing Title</th>
                      <th className="py-1.5 px-2.5">BOM Part No</th>
                      <th className="py-1.5 px-2.5">Material / Desig</th>
                      <th className="py-1.5 px-2.5">Status</th>
                      <th className="py-1.5 px-2.5">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {drawingsParsedImportRows.map((r) => (
                      <tr key={r.rowNumber} className={r.isValid ? 'bg-white' : 'bg-rose-50/70'}>
                        <td className="py-1.5 px-2.5 font-mono text-slate-400">#{r.rowNumber}</td>
                        <td className="py-1.5 px-2.5 font-mono font-bold text-slate-900">
                          {r.drawingNumber || '—'}
                        </td>
                        <td className="py-1.5 px-2.5 font-mono font-bold text-blue-700">
                          {r.revision}
                        </td>
                        <td className="py-1.5 px-2.5 text-slate-800 max-w-xs truncate">
                          {r.drawingTitle || '—'}
                        </td>
                        <td className="py-1.5 px-2.5 font-mono text-blue-900">
                          {r.partNumber || '—'} (Qty: {r.quantity})
                        </td>
                        <td className="py-1.5 px-2.5 font-mono text-slate-600">
                          {r.material} • {r.designation}
                        </td>
                        <td className="py-1.5 px-2.5 font-mono">{r.drawingStatus}</td>
                        <td className="py-1.5 px-2.5">
                          {r.isValid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                              <CheckCircle2 className="w-3 h-3" /> Ready
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-700 font-semibold">
                              <AlertTriangle className="w-3 h-3" /> {r.errors.join(', ')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsDrawingsImportModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold"
            >
              Close
            </button>
            <button
              type="button"
              disabled={drawingsParsedImportRows.filter((r) => r.isValid).length === 0}
              onClick={handleConfirmDrawingsImport}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded font-semibold flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Import{' '}
              {
                new Set(
                  drawingsParsedImportRows
                    .filter((r) => r.isValid)
                    .map((r) => `${r.drawingNumber}__${r.revision}`)
                ).size
              }{' '}
              Controlled Drawing(s)
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk Import Drawing Parts List from Excel / CSV Modal */}
      <Modal
        isOpen={isPartsImportModalOpen}
        onClose={() => setIsPartsImportModalOpen(false)}
        title="Import Drawing Parts List from Excel (.xlsx / .xls) or CSV"
        subtitle="Upload an Excel workbook (.xlsx / .xls), CSV file, or paste rows copied from Excel to populate the Drawing Parts List"
        maxWidth="3xl"
      >
        <div className="space-y-4 text-xs">
          {/* Required Column Criteria Box */}
          <div className="p-3.5 bg-slate-900 text-white rounded-lg space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold flex items-center gap-2 text-emerald-400">
                <FileSpreadsheet className="w-4 h-4" />
                <span>Drawing Parts List Import Template &amp; Column Criteria</span>
              </div>
              <button
                type="button"
                onClick={handleDownloadDrawingPartsTemplate}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold flex items-center gap-1.5"
              >
                <Download className="w-3 h-3" />
                Download Excel Template (.xlsx)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
              <div className="bg-slate-800/90 p-2 rounded border border-slate-700">
                <div className="text-emerald-300 font-bold">1. ITEM &amp; QTY</div>
                <div className="text-slate-300 text-[10px]">
                  BOM Item No (e.g. 1, 2, 3) and Quantity per assembly (defaults to 1).
                </div>
              </div>
              <div className="bg-slate-800/90 p-2 rounded border border-slate-700">
                <div className="text-emerald-300 font-bold">2. DRAWING / PART No *</div>
                <div className="text-slate-300 text-[10px]">
                  Required. e.g. T0559-058-719-00-02-012-01
                </div>
              </div>
              <div className="bg-slate-800/90 p-2 rounded border border-slate-700">
                <div className="text-emerald-300 font-bold">3. DESCRIPTION / MATERIAL / DESIGNATION</div>
                <div className="text-slate-300 text-[10px]">
                  e.g. 55,2 X 2 THK PLT X 55,6 LG | S/S 304 SATIN | MANUF-INT
                </div>
              </div>
            </div>
          </div>

          {/* Upload File or Paste */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 border border-dashed border-slate-300 rounded-lg bg-slate-50 flex flex-col justify-between">
              <div>
                <div className="font-bold text-slate-800 mb-1">
                  Option A: Upload Excel (.xlsx / .xls) or CSV File
                </div>
                <p className="text-[11px] text-slate-500 mb-2">
                  Select a saved `.xlsx`, `.xls`, or `.csv` file matching the template columns.
                </p>
              </div>
              <label className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded font-semibold text-xs inline-flex items-center justify-center gap-2 cursor-pointer shadow-2xs">
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>{partsImportFileName || 'Choose .xlsx, .xls, or .csv File...'}</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt,.tsv"
                  onChange={handlePartsExcelOrCsvUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
              <div className="font-bold text-slate-800 mb-1">
                Option B: Paste Rows Directly from Excel / CSV
              </div>
              <textarea
                rows={3}
                value={partsImportText}
                onChange={(e) => handlePartsTextImportChange(e.target.value)}
                placeholder={
                  'ITEM,QTY,DRAWING / PART No,DESCRIPTION,MATERIAL,DESIGNATION\n1,1,T0559-058-719-00-02-012-01,55.2 X 2 THK PLT X 55.6 LG,S/S 304 SATIN,MANUF-INT'
                }
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono text-[11px] bg-white"
              />
            </div>
          </div>

          {/* Import Result Banner */}
          {partsImportResultBanner && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-emerald-900">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>
                  Populated {partsImportResultBanner.imported} part(s) into the Drawing Parts List
                  {partsImportResultBanner.skipped > 0
                    ? ` (${partsImportResultBanner.skipped} invalid row(s) skipped)`
                    : ''}
                  .
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsPartsImportModalOpen(false)}
                className="px-2.5 py-1 bg-emerald-600 text-white rounded text-[11px] font-bold"
              >
                Done
              </button>
            </div>
          )}

          {/* Live Validation Preview Table */}
          {partsParsedImportRows.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                <span className="font-bold text-slate-700">
                  Preview ({partsParsedImportRows.filter((r) => r.isValid).length} Valid /{' '}
                  {partsParsedImportRows.length} Total Rows)
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  Target: {partsImportTarget === 'REVISION' ? 'New Revision Parts List' : 'Drawing Parts List'}
                </span>
              </div>
              <div className="max-h-56 overflow-y-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-mono text-[10px] text-slate-500 uppercase">
                      <th className="py-1.5 px-2.5">Row</th>
                      <th className="py-1.5 px-2.5">ITEM</th>
                      <th className="py-1.5 px-2.5">QTY</th>
                      <th className="py-1.5 px-2.5">DRAWING / PART No</th>
                      <th className="py-1.5 px-2.5">DESCRIPTION</th>
                      <th className="py-1.5 px-2.5">MATERIAL</th>
                      <th className="py-1.5 px-2.5">DESIGNATION</th>
                      <th className="py-1.5 px-2.5">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {partsParsedImportRows.map((r) => (
                      <tr key={r.rowNumber} className={r.isValid ? 'bg-white' : 'bg-rose-50/70'}>
                        <td className="py-1.5 px-2.5 font-mono text-slate-400">#{r.rowNumber}</td>
                        <td className="py-1.5 px-2.5 font-mono">{r.itemNumber}</td>
                        <td className="py-1.5 px-2.5 font-mono">{r.quantity}</td>
                        <td className="py-1.5 px-2.5 font-mono font-bold text-blue-900">
                          {r.partNumber || '—'}
                        </td>
                        <td className="py-1.5 px-2.5 text-slate-800">{r.description || '—'}</td>
                        <td className="py-1.5 px-2.5 font-mono text-slate-700">{r.material || '—'}</td>
                        <td className="py-1.5 px-2.5 font-mono text-slate-700">
                          {r.designation || '—'}
                        </td>
                        <td className="py-1.5 px-2.5">
                          {r.isValid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                              <CheckCircle2 className="w-3 h-3" /> Ready
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-700 font-semibold">
                              <AlertTriangle className="w-3 h-3" /> {r.errors.join(', ')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsPartsImportModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold"
            >
              Close
            </button>
            <button
              type="button"
              disabled={partsParsedImportRows.filter((r) => r.isValid).length === 0}
              onClick={handleConfirmPartsImport}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded font-semibold flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Import {partsParsedImportRows.filter((r) => r.isValid).length} Valid Part(s)
            </button>
          </div>
        </div>
      </Modal>

      {/* Fullscreen Lightbox for Drawing & Revision Images/Photos */}
      {lightboxImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4"
          onClick={() => setLightboxImageUrl(null)}
        >
          <div
            className="bg-white rounded-xl max-w-5xl w-full overflow-hidden shadow-2xl border border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
              <div className="font-mono text-xs font-bold truncate">{lightboxImageUrl.title}</div>
              <button
                type="button"
                onClick={() => setLightboxImageUrl(null)}
                className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-slate-950 flex items-center justify-center max-h-[82vh] overflow-auto">
              <img
                src={lightboxImageUrl.url}
                alt={lightboxImageUrl.title}
                className="max-h-[76vh] w-auto object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
      <MachineBomImportModal
        isOpen={isMachineBomModalOpen}
        onClose={() => setIsMachineBomModalOpen(false)}
      />
    </div>
  );
};
