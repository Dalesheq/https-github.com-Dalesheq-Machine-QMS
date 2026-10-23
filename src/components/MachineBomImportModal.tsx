import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useQMS } from '../context/QMSContext';
import { Modal } from './Modal';
import {
  parseMachineBomWorkbook,
  buildMachineImportPayloads,
  ExtractedWorkbookMetadata,
} from '../utils/machineBomExcelParser';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Layers,
  FolderKanban,
  Search,
  Sparkles,
} from 'lucide-react';

interface MachineBomImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedMachineSerial?: string;
}

export const MachineBomImportModal: React.FC<MachineBomImportModalProps> = ({
  isOpen,
  onClose,
  preselectedMachineSerial,
}) => {
  const { db, importMachineBomPackage } = useQMS();

  const [selectedMachineMode, setSelectedMachineMode] = useState<'EXISTING' | 'NEW_OR_AUTO'>(
    preselectedMachineSerial ? 'EXISTING' : 'NEW_OR_AUTO'
  );
  const [selectedExistingSerial, setSelectedExistingSerial] = useState<string>(
    preselectedMachineSerial || db.machines[0]?.serialNumber || ''
  );

  // Editable Machine & Project Metadata fields (auto-populated when Excel is uploaded)
  const [machineSerialNumber, setMachineSerialNumber] = useState(
    preselectedMachineSerial || ''
  );
  const [machineType, setMachineType] = useState('DIVIDER');
  const [customer, setCustomer] = useState('Spiral Systems / Dale Automation');
  const [projectNumber, setProjectNumber] = useState('');
  const [projectName, setProjectName] = useState('');
  const [elementCode, setElementCode] = useState('719');
  const [modelledBy, setModelledBy] = useState('');
  const [detailedBy, setDetailedBy] = useState('');

  // Import Scope Toggles
  const [includeBoughtOut, setIncludeBoughtOut] = useState(false);
  const [createDetailDrawingsForParts, setCreateDetailDrawingsForParts] = useState(true);

  // Parsed Workbook State
  const [extractedData, setExtractedData] = useState<ExtractedWorkbookMetadata | null>(null);
  const [previewSearch, setPreviewSearch] = useState('');
  const [previewFilter, setPreviewFilter] = useState<'ALL' | 'ASSY' | 'MANUF_PART' | 'BOUGHT_OUT'>(
    'ALL'
  );
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    ok: boolean;
    drawingsImported: number;
    drawingsUpdated: number;
    componentsImported: number;
    componentsUpdated: number;
    machineSerialNumber: string;
    projectNumber: string;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (preselectedMachineSerial) {
      setSelectedMachineMode('EXISTING');
      setSelectedExistingSerial(preselectedMachineSerial);
      const found = db.machines.find(
        (m) => m.serialNumber.toUpperCase() === preselectedMachineSerial.toUpperCase()
      );
      if (found) {
        setMachineSerialNumber(found.serialNumber);
        setMachineType(found.machineType || 'DIVIDER');
        setCustomer(found.customer || 'Spiral Systems / Dale Automation');
        setProjectNumber(found.projectNumber || '');
        setProjectName(found.projectName || '');
      }
    }
  }, [preselectedMachineSerial, db.machines, isOpen]);

  const handleExistingMachineSelect = (serial: string) => {
    setSelectedExistingSerial(serial);
    const found = db.machines.find(
      (m) => m.serialNumber.toUpperCase() === serial.toUpperCase()
    );
    if (found) {
      setMachineSerialNumber(found.serialNumber);
      setMachineType(found.machineType || 'DIVIDER');
      setCustomer(found.customer || 'Spiral Systems / Dale Automation');
      if (found.projectNumber && found.projectNumber !== 'PRJ-UNASSIGNED') {
        setProjectNumber(found.projectNumber);
      }
      if (found.projectName) {
        setProjectName(found.projectName);
      }
    }
  };

  const handleExcelFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      if (!data) return;
      const workbook = XLSX.read(data, { type: 'array' });
      const parsed = parseMachineBomWorkbook(workbook, file.name);
      setExtractedData(parsed);

      // Auto-populate metadata fields
      const autoProjNo = parsed.detectedProjectNumber || 'T0559-058';
      const autoElem = parsed.detectedElementCode || '719';
      const autoSerial =
        preselectedMachineSerial ||
        (selectedMachineMode === 'EXISTING' && selectedExistingSerial
          ? selectedExistingSerial
          : `${autoProjNo}-${autoElem}`);

      if (!preselectedMachineSerial && selectedMachineMode === 'NEW_OR_AUTO') {
        setMachineSerialNumber(autoSerial);
      }
      if (parsed.detectedMachineType) setMachineType(parsed.detectedMachineType);
      if (parsed.detectedProjectNumber) setProjectNumber(parsed.detectedProjectNumber);
      if (parsed.detectedProjectName) setProjectName(parsed.detectedProjectName);
      if (parsed.detectedElementCode) setElementCode(parsed.detectedElementCode);
      if (parsed.detectedModelledBy) setModelledBy(parsed.detectedModelledBy);
      if (parsed.detectedDetailedBy) setDetailedBy(parsed.detectedDetailedBy);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleDownloadMachineBomTemplate = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Inventor_BOM (matches Pages 1-89 of attached document)
    const sheet1Rows = [
      {
        Item: '0',
        Filename: 'T0559-058-719-00-00-000-00.iam',
        'Part Number': 'T0559-058-719-00-00-000-00',
        'Component Type': 'Assembly',
        Material: '',
        Description: 'DIVIDER G.A.',
        'Cost Center': '719',
        'Stock Number': 'MANUF-INT',
        'Item QTY': '1',
        REV: '0',
        'File Path':
          'C:\\DSS WORKING FOLDER\\DALE PROJECTS\\T-JOBS\\T0559 - DIVIDER\\ACCURIST\\T0559-058-719-00-00-000-00.iam',
      },
      {
        Item: '3',
        Filename: 'T0559-058-719-00-00-001-00-A.iam',
        'Part Number': 'T0559-058-719-00-00-001-00-A',
        'Component Type': 'Assembly',
        Material: '',
        Description: 'COVER 5',
        'Cost Center': '719',
        'Stock Number': 'MANUF-INT',
        'Item QTY': '1',
        REV: '0',
        'File Path':
          'C:\\DSS WORKING FOLDER\\DALE PROJECTS\\T-JOBS\\T0559 - DIVIDER\\ACCURIST\\T0559-058-719-00-00-001-00-A.iam',
      },
      {
        Item: '3.1',
        Filename: 'T0559-058-719-00-00-002-00.iam',
        'Part Number': 'T0559-058-719-00-00-002-00',
        'Component Type': 'Assembly',
        Material: '',
        Description: 'COVER PIVOT MOUNT 1',
        'Cost Center': '719',
        'Stock Number': 'MANUF-INT',
        'Item QTY': '1',
        REV: '0',
        'File Path':
          'C:\\DSS WORKING FOLDER\\DALE PROJECTS\\T-JOBS\\T0559 - DIVIDER\\ACCURIST\\T0559-058-719-00-00-002-00.iam',
      },
      {
        Item: '3.1.1',
        Filename: 'T0559-058-719-00-00-002-01.ipt',
        'Part Number': 'T0559-058-719-00-00-002-01',
        'Component Type': 'Part',
        Material: 'S/S 304',
        Description: 'Ø8 R/BAR X 36 LG',
        'Cost Center': '719',
        'Stock Number': 'MANUF-EXT',
        'Item QTY': '1',
        REV: '0',
        'File Path':
          'C:\\DSS WORKING FOLDER\\DALE PROJECTS\\T-JOBS\\T0559 - DIVIDER\\ACCURIST\\T0559-058-719-00-00-002-01.ipt',
      },
      {
        Item: '3.1.2',
        Filename: 'T0559-058-719-00-00-002-02.ipt',
        'Part Number': 'T0559-058-719-00-00-002-02',
        'Component Type': 'Part',
        Material: 'S/S 304 SATIN',
        Description: '11 X 1,5 THK PLT X 15 LG',
        'Cost Center': '719',
        'Stock Number': 'MANUF-INT',
        'Item QTY': '1',
        REV: '0',
        'File Path':
          'C:\\DSS WORKING FOLDER\\DALE PROJECTS\\T-JOBS\\T0559 - DIVIDER\\ACCURIST\\T0559-058-719-00-00-002-02.ipt',
      },
      {
        Item: '3.2',
        Filename: 'SS HEX NUT M8.ipt',
        'Part Number': '030',
        'Component Type': 'Part',
        Material: 'S/S 304',
        Description: 'M8 HEX NUT',
        'Cost Center': '030',
        'Stock Number': 'B/O-EXT',
        'Item QTY': '2',
        REV: 'A',
        'File Path':
          'C:\\DSS WORKING FOLDER\\CONTENT CENTRE FILES\\en-US\\HEX NUT SS\\SS HEX NUT M8.ipt',
      },
    ];
    const ws1 = XLSX.utils.json_to_sheet(sheet1Rows);
    ws1['!cols'] = [
      { wch: 10 },
      { wch: 34 },
      { wch: 30 },
      { wch: 16 },
      { wch: 18 },
      { wch: 34 },
      { wch: 12 },
      { wch: 14 },
      { wch: 10 },
      { wch: 8 },
      { wch: 70 },
    ];
    XLSX.utils.book_append_sheet(wb, ws1, 'Inventor_BOM');

    // Sheet 2: Manufactured_Filter (matches Pages 90-173)
    const sheet2Rows = [
      {
        'No.': '1',
        Item: '0',
        Filename: 'T0559-058-719-00-00-000-00',
        'Part Number': 'T0559-058-719-00-00-000-00',
        Classification: 'Manufactured Comp. Int',
        'Filename Matches Part Number': '=',
        'Component Type': 'Assembly',
        Material: '',
        Description: 'DIVIDER G.A.',
        Grouping: 'ASSY',
        'Cost Center': '719',
        'Stock Number': 'MANUF-INT',
        'Total QTY': '1',
        REV: '0',
      },
      {
        'No.': '9',
        Item: '3',
        Filename: 'T0559-058-719-00-00-001-00-A',
        'Part Number': 'T0559-058-719-00-00-001-00-A',
        Classification: 'Manufactured Comp. Int',
        'Filename Matches Part Number': '=',
        'Component Type': 'Assembly',
        Material: '',
        Description: 'COVER 5',
        Grouping: 'ASSY',
        'Cost Center': '719',
        'Stock Number': 'MANUF-INT',
        'Total QTY': '1',
        REV: '0',
      },
      {
        'No.': '10',
        Item: '3.1',
        Filename: 'T0559-058-719-00-00-002-00',
        'Part Number': 'T0559-058-719-00-00-002-00',
        Classification: 'Manufactured Comp. Int',
        'Filename Matches Part Number': '=',
        'Component Type': 'Assembly',
        Material: '',
        Description: 'COVER PIVOT MOUNT 1',
        Grouping: 'ASSY',
        'Cost Center': '719',
        'Stock Number': 'MANUF-INT',
        'Total QTY': '2',
        REV: '0',
      },
      {
        'No.': '11',
        Item: '3.1.1',
        Filename: 'T0559-058-719-00-00-002-01',
        'Part Number': 'T0559-058-719-00-00-002-01',
        Classification: 'Manufactured Comp. Ext',
        'Filename Matches Part Number': '=',
        'Component Type': 'Part',
        Material: 'S/S 304',
        Description: 'Ø8 R/BAR X 36 LG',
        Grouping: 'R/BAR',
        'Cost Center': '719',
        'Stock Number': 'MANUF-EXT',
        'Total QTY': '3',
        REV: '0',
      },
      {
        'No.': '12',
        Item: '3.1.2',
        Filename: 'T0559-058-719-00-00-002-02',
        'Part Number': 'T0559-058-719-00-00-002-02',
        Classification: 'Manufactured Comp. Int',
        'Filename Matches Part Number': '=',
        'Component Type': 'Part',
        Material: 'S/S 304 SATIN',
        Description: '11 X 1,5 THK PLT X 15 LG',
        Grouping: 'SHEET',
        'Cost Center': '719',
        'Stock Number': 'MANUF-INT',
        'Total QTY': '3',
        REV: '0',
      },
    ];
    const ws2 = XLSX.utils.json_to_sheet(sheet2Rows);
    XLSX.utils.book_append_sheet(wb, ws2, 'Manufactured_Filter');

    // Sheet 3: Progress_Tracking (matches Pages 174-206)
    const ws3AoA = [
      ['PROGRESS', '0.00%', '', 'TITLE:', 'DIVIDER G.A.'],
      ['0 OF 350 PARTS & 0 OF 122 ASSEMBLIES', '', '', 'SUBJECT:', 'ACCURIST DIVIDER'],
      ['ELEMENT:', '719', '', 'PROJECT:', 'T0559-058'],
      ['', '', '', 'MODDLER:', 'C. DU PLESSIS'],
      ['', '', '', 'DETAILER:', 'C. DU PLESSIS'],
      [],
      [
        'Au No.',
        'No.',
        'HIER:',
        'PROGRESS:',
        'PART NUMBER:',
        'DESCRIPTION:',
        'REV:',
        'QTY:',
        'SHT QTY:',
        'DESIG.',
        'TYPE:',
        'MATERIAL:',
        'GROUP:',
        'OPEN:',
        'NOTES:',
      ],
      [
        '1',
        '1',
        'M',
        'START',
        'T0559-058-719-00-00-000-00',
        'DIVIDER G.A.',
        '0',
        '1',
        '',
        'MANUF-INT',
        'Assy',
        '',
        'ASSY',
        'Open',
        '',
      ],
      [
        '9',
        '2',
        '0',
        '',
        'T0559-058-719-00-00-001-00-A',
        'COVER 5',
        '0',
        '1',
        '',
        'MANUF-INT',
        'Assy',
        '',
        'ASSY',
        'Open',
        '',
      ],
      [
        '10',
        '3',
        '0',
        '',
        'T0559-058-719-00-00-002-00',
        'COVER PIVOT MOUNT 1',
        '0',
        '2',
        '',
        'MANUF-INT',
        'Assy',
        '',
        'ASSY',
        'Open',
        '',
      ],
      [
        '11',
        '4',
        '2',
        '',
        'T0559-058-719-00-00-002-01',
        'Ø8 R/BAR X 36 LG',
        '0',
        '3',
        '',
        'MANUF-EXT',
        'Part',
        'S/S 304',
        'R/BAR',
        'Open',
        '',
      ],
      [
        '12',
        '5',
        '2',
        '',
        'T0559-058-719-00-00-002-02',
        '11 X 1,5 THK PLT X 15 LG',
        '0',
        '3',
        '',
        'MANUF-INT',
        'Part',
        'S/S 304 SATIN',
        'SHEET',
        'Open',
        '',
      ],
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(ws3AoA);
    XLSX.utils.book_append_sheet(wb, ws3, 'Progress_Tracking');

    XLSX.writeFile(wb, 'MACHINE_QMS_Inventor_BOM_And_Progress_Template.xlsx');
  };

  const filteredPreviewRows = useMemo(() => {
    if (!extractedData) return [];
    return extractedData.rows.filter((r) => {
      if (!includeBoughtOut && !r.isManufactured) return false;
      if (previewFilter === 'ASSY' && r.componentType !== 'Assembly') return false;
      if (previewFilter === 'MANUF_PART' && (!r.isManufactured || r.componentType !== 'Part')) {
        return false;
      }
      if (previewFilter === 'BOUGHT_OUT' && r.isManufactured) return false;

      if (previewSearch.trim()) {
        const q = previewSearch.toLowerCase();
        return (
          r.partNumber.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.material.toLowerCase().includes(q) ||
          r.grouping.toLowerCase().includes(q) ||
          r.designation.toLowerCase().includes(q) ||
          r.itemNumber.toLowerCase().includes(q) ||
          r.parentDrawingNumber.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [extractedData, includeBoughtOut, previewFilter, previewSearch]);

  const computedPayloads = useMemo(() => {
    if (!extractedData) return null;
    const targetSn =
      selectedMachineMode === 'EXISTING' && selectedExistingSerial
        ? selectedExistingSerial
        : machineSerialNumber.trim() || `${projectNumber || 'T0559-058'}-${elementCode || '719'}`;

    return buildMachineImportPayloads(extractedData, {
      machineSerialNumber: targetSn.toUpperCase(),
      machineType: machineType.trim() || 'DIVIDER',
      projectNumber: projectNumber.trim() || 'T0559-058',
      projectName: projectName.trim() || 'T0559 - DIVIDER',
      elementCode: elementCode.trim() || '719',
      modelledBy: modelledBy.trim(),
      detailedBy: detailedBy.trim(),
      includeBoughtOut,
      createDetailDrawingsForParts,
    });
  }, [
    extractedData,
    selectedMachineMode,
    selectedExistingSerial,
    machineSerialNumber,
    machineType,
    projectNumber,
    projectName,
    elementCode,
    modelledBy,
    detailedBy,
    includeBoughtOut,
    createDetailDrawingsForParts,
  ]);

  const handleExecuteImport = async () => {
    if (!extractedData || !computedPayloads) return;
    const targetSn =
      selectedMachineMode === 'EXISTING' && selectedExistingSerial
        ? selectedExistingSerial
        : machineSerialNumber.trim();

    if (!targetSn) return;

    setIsImporting(true);
    setImportResult(null);
    try {
      const res = await importMachineBomPackage({
        machineSerialNumber: targetSn.toUpperCase(),
        machineType: machineType.trim().toUpperCase() || 'DIVIDER',
        customer: customer.trim() || 'Spiral Systems / Dale Automation',
        projectNumber: projectNumber.trim().toUpperCase() || 'T0559-058',
        projectName: projectName.trim() || `${projectNumber} ${machineType}`,
        elementCode: elementCode.trim() || '719',
        modelledBy: modelledBy.trim(),
        detailedBy: detailedBy.trim(),
        drawings: computedPayloads.drawings,
        components: computedPayloads.components,
      });
      setImportResult(res);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Machine CAD BOM, Drawings & Parts Workbook via Excel (.xlsx / .xls)"
      subtitle="Extracts hierarchical Assemblies, Manufactured Parts, Materials, Groupings (ASSY, SHEET, R/BAR, CHS, RHS), Cost Centers, Revisions, Modeller/Detailer, and Total Quantities per Machine"
      maxWidth="4xl"
    >
      <div className="space-y-4 text-xs">
        {/* Top Banner & Template Download */}
        <div className="p-3.5 bg-slate-900 text-white rounded-lg space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-bold flex items-center gap-2 text-emerald-400 text-sm">
              <FileSpreadsheet className="w-4 h-4" />
              <span>Multi-Sheet CAD / Inventor Machine BOM &amp; Progress Excel Importer</span>
            </div>
            <button
              type="button"
              onClick={handleDownloadMachineBomTemplate}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold flex items-center gap-1.5 shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              Download Multi-Sheet Machine BOM Template (.xlsx)
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px]">
            <div className="bg-slate-800/90 p-2.5 rounded border border-slate-700">
              <div className="text-emerald-300 font-bold">1. Inventor BOM Sheet</div>
              <div className="text-slate-300 text-[10px] mt-0.5">
                Extracts <code className="text-white">Item</code> (0, 3, 3.1, 3.1.1),{' '}
                <code className="text-white">Filename</code> (.iam/.ipt),{' '}
                <code className="text-white">Part Number</code>,{' '}
                <code className="text-white">Component Type</code>,{' '}
                <code className="text-white">Material</code>,{' '}
                <code className="text-white">Description</code>,{' '}
                <code className="text-white">Cost Center</code> (719/030),{' '}
                <code className="text-white">Stock Number</code> (MANUF-INT/EXT),{' '}
                <code className="text-white">Item QTY</code>, <code className="text-white">REV</code>, &amp;{' '}
                <code className="text-white">File Path</code>.
              </div>
            </div>
            <div className="bg-slate-800/90 p-2.5 rounded border border-slate-700">
              <div className="text-emerald-300 font-bold">2. Manufactured &amp; Grouping Sheet</div>
              <div className="text-slate-300 text-[10px] mt-0.5">
                Extracts <code className="text-white">Classification</code> (Manufactured Comp. Int / Ext),{' '}
                <code className="text-white">Grouping</code> (ASSY, SHEET, R/BAR, CHS, RHS, HEX BAR, WEAR), and{' '}
                <code className="text-white">Total QTY</code> per machine.
              </div>
            </div>
            <div className="bg-slate-800/90 p-2.5 rounded border border-slate-700">
              <div className="text-emerald-300 font-bold">3. Progress &amp; Header Metadata</div>
              <div className="text-slate-300 text-[10px] mt-0.5">
                Extracts <code className="text-white">HIER:</code> depth level,{' '}
                <code className="text-white">ELEMENT:</code> (719),{' '}
                <code className="text-white">PROJECT:</code> (T0559-058),{' '}
                <code className="text-white">MODDLER:</code> &amp;{' '}
                <code className="text-white">DETAILER:</code> (e.g. C. DU PLESSIS).
              </div>
            </div>
          </div>
        </div>

        {/* Step 1: Upload Excel File */}
        <div className="p-4 border-2 border-dashed border-emerald-400 bg-emerald-50/50 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Step 1: Upload Machine BOM / Drawings Excel Workbook (.xlsx / .xls / .csv)</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Upload the exported CAD / Inventor BOM Excel workbook for the machine. All sheets in the workbook are automatically scanned and cross-linked.
            </p>
          </div>

          <label className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-bold text-xs inline-flex items-center gap-2 cursor-pointer shadow-xs shrink-0 transition-colors">
            <Upload className="w-4 h-4" />
            <span>{extractedData ? `Change File (${extractedData.fileName})` : 'Select Excel Workbook (.xlsx / .xls)...'}</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleExcelFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Step 2: Target Machine & Extracted Metadata Configuration */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-blue-600" />
              <span>Step 2: Target Machine &amp; Extracted Engineering Metadata</span>
            </div>

            <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedMachineMode('EXISTING');
                  if (selectedExistingSerial) handleExistingMachineSelect(selectedExistingSerial);
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                  selectedMachineMode === 'EXISTING'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Import into Existing Machine ({db.machines.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedMachineMode('NEW_OR_AUTO')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                  selectedMachineMode === 'NEW_OR_AUTO'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Create / Auto-Detect Machine from Excel
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {selectedMachineMode === 'EXISTING' && db.machines.length > 0 ? (
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">
                  Select Target Machine *
                </label>
                <select
                  value={selectedExistingSerial}
                  onChange={(e) => handleExistingMachineSelect(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono font-bold text-xs"
                >
                  {db.machines.map((m) => (
                    <option key={m.id} value={m.serialNumber}>
                      {m.serialNumber} — {m.machineType} ({m.projectNumber || 'No Project'})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Machine Serial Number *
                </label>
                <input
                  type="text"
                  value={machineSerialNumber}
                  onChange={(e) => setMachineSerialNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. T0559-058-719"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono font-bold uppercase"
                />
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Machine Type *
              </label>
              <input
                type="text"
                value={machineType}
                onChange={(e) => setMachineType(e.target.value.toUpperCase())}
                placeholder="e.g. DIVIDER"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono uppercase"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Element / Cost Center
              </label>
              <input
                type="text"
                value={elementCode}
                onChange={(e) => setElementCode(e.target.value)}
                placeholder="e.g. 719"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Project Number *
              </label>
              <input
                type="text"
                value={projectNumber}
                onChange={(e) => setProjectNumber(e.target.value.toUpperCase())}
                placeholder="e.g. T0559-058"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono font-bold uppercase"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                Project Name / Description *
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. T0559 - DIVIDER (ACCURIST)"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Modeller / Detailer
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  value={modelledBy}
                  onChange={(e) => setModelledBy(e.target.value)}
                  placeholder="Modeller"
                  title="Modelled By (extracted from MODDLER: cell)"
                  className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white font-mono text-[11px]"
                />
                <input
                  type="text"
                  value={detailedBy}
                  onChange={(e) => setDetailedBy(e.target.value)}
                  placeholder="Detailer"
                  title="Detailed By (extracted from DETAILER: cell)"
                  className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white font-mono text-[11px]"
                />
              </div>
            </div>
          </div>

          {/* Import Scope Checkboxes */}
          <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={createDetailDrawingsForParts}
                onChange={(e) => setCreateDetailDrawingsForParts(e.target.checked)}
                className="rounded border-slate-300 text-blue-600"
              />
              <span>
                Register Controlled Drawings for both Assemblies AND Manufactured Detail Parts (links each part to its parent Assembly Drawing)
              </span>
            </label>

            <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={includeBoughtOut}
                onChange={(e) => setIncludeBoughtOut(e.target.checked)}
                className="rounded border-slate-300 text-blue-600"
              />
              <span>
                Include Bought-Out &amp; Content Centre Fasteners (B/O-EXT, B/O-MOD, Cost Center 030)
              </span>
            </label>
          </div>
        </div>

        {/* Import Result Banner */}
        {importResult && (
          <div
            className={`p-3.5 rounded-lg border flex items-center justify-between ${
              importResult.ok
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-rose-50 border-rose-300 text-rose-950'
            }`}
          >
            <div className="flex items-start gap-2.5 font-semibold">
              {importResult.ok ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div>
                {importResult.ok ? (
                  <>
                    <div className="font-bold text-sm">
                      Machine BOM Excel Imported Successfully for Machine{' '}
                      <span className="font-mono underline">{importResult.machineSerialNumber}</span>{' '}
                      (Project <span className="font-mono">{importResult.projectNumber}</span>)
                    </div>
                    <div className="text-xs mt-0.5 font-mono">
                      • Controlled Drawings: {importResult.drawingsImported} New,{' '}
                      {importResult.drawingsUpdated} Updated | • Parts / Components:{' '}
                      {importResult.componentsImported} New, {importResult.componentsUpdated}{' '}
                      Updated
                    </div>
                  </>
                ) : (
                  <span>{importResult.error || 'Failed to import Machine BOM Excel.'}</span>
                )}
              </div>
            </div>
            {importResult.ok && (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs shrink-0"
              >
                Done
              </button>
            )}
          </div>
        )}

        {/* Extracted Workbook Summary & Preview Table */}
        {extractedData && computedPayloads && (
          <div className="space-y-3">
            {/* Summary KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-[10px] font-mono uppercase text-blue-700 font-bold">
                  ROOT ASSEMBLY
                </div>
                <div className="font-mono font-black text-slate-900 truncate mt-0.5">
                  {extractedData.detectedRootAssemblyNumber || '—'}
                </div>
                <div className="text-[10px] text-slate-600 truncate">
                  {extractedData.detectedRootAssemblyTitle}
                </div>
              </div>

              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="text-[10px] font-mono uppercase text-emerald-700 font-bold">
                  MANUFACTURED ITEMS
                </div>
                <div className="text-base font-black font-mono text-emerald-950">
                  {extractedData.manufacturedCount}
                </div>
                <div className="text-[10px] font-mono text-emerald-800">
                  {extractedData.assembliesCount} Assys + {extractedData.manufacturedPartsCount} Parts
                </div>
              </div>

              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="text-[10px] font-mono uppercase text-amber-800 font-bold">
                  BOUGHT-OUT / 030
                </div>
                <div className="text-base font-black font-mono text-amber-950">
                  {extractedData.boughtOutCount}
                </div>
                <div className="text-[10px] font-mono text-amber-800">
                  {includeBoughtOut ? 'Included in import' : 'Filtered out (Manuf only)'}
                </div>
              </div>

              <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg">
                <div className="text-[10px] font-mono uppercase text-indigo-700 font-bold">
                  DRAWINGS TO REGISTER
                </div>
                <div className="text-base font-black font-mono text-indigo-950">
                  {computedPayloads.drawings.length}
                </div>
                <div className="text-[10px] font-mono text-indigo-800">
                  With multi-part BOM lists
                </div>
              </div>

              <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="text-[10px] font-mono uppercase text-purple-700 font-bold">
                  UNIQUE PARTS TO SYNC
                </div>
                <div className="text-base font-black font-mono text-purple-950">
                  {computedPayloads.components.length}
                </div>
                <div className="text-[10px] font-mono text-purple-800">
                  Linked to Machine &amp; Project
                </div>
              </div>
            </div>

            {/* Preview Filter Bar */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-slate-800">
                    Extracted Machine BOM &amp; Drawing Hierarchy ({filteredPreviewRows.length} rows shown)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      value={previewSearch}
                      onChange={(e) => setPreviewSearch(e.target.value)}
                      placeholder="Filter part #, material, group..."
                      className="pl-7 pr-2.5 py-1 bg-white border border-slate-300 rounded text-[11px] w-48"
                    />
                  </div>

                  <select
                    value={previewFilter}
                    onChange={(e) => setPreviewFilter(e.target.value as any)}
                    className="px-2 py-1 bg-white border border-slate-300 rounded text-[11px] font-semibold"
                  >
                    <option value="ALL">All Included Rows</option>
                    <option value="ASSY">Assemblies Only ({extractedData.assembliesCount})</option>
                    <option value="MANUF_PART">
                      Manufactured Parts Only ({extractedData.manufacturedPartsCount})
                    </option>
                    {includeBoughtOut && (
                      <option value="BOUGHT_OUT">
                        Bought-Out / Fasteners ({extractedData.boughtOutCount})
                      </option>
                    )}
                  </select>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-mono text-[10px] text-slate-600 uppercase">
                      <th className="py-1.5 px-2">Item</th>
                      <th className="py-1.5 px-2">HIER</th>
                      <th className="py-1.5 px-2">Part / Drawing Number</th>
                      <th className="py-1.5 px-2">Type</th>
                      <th className="py-1.5 px-2">Description</th>
                      <th className="py-1.5 px-2">Material</th>
                      <th className="py-1.5 px-2">Group</th>
                      <th className="py-1.5 px-2">Desig / CC</th>
                      <th className="py-1.5 px-2 text-center">Total QTY</th>
                      <th className="py-1.5 px-2 text-center">REV</th>
                      <th className="py-1.5 px-2">Parent Assembly</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {filteredPreviewRows.slice(0, 250).map((r) => (
                      <tr
                        key={`${r.rowIndex}-${r.itemNumber}-${r.partNumber}`}
                        className={
                          r.componentType === 'Assembly'
                            ? 'bg-amber-50/50 hover:bg-amber-50'
                            : 'bg-white hover:bg-slate-50'
                        }
                      >
                        <td className="py-1.5 px-2 font-bold text-slate-700">{r.itemNumber}</td>
                        <td className="py-1.5 px-2 text-slate-500">{r.hierarchyLevel}</td>
                        <td className="py-1.5 px-2 font-bold text-blue-900">{r.partNumber}</td>
                        <td className="py-1.5 px-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              r.componentType === 'Assembly'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            }`}
                          >
                            {r.componentType}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 font-sans text-slate-900 max-w-xs truncate">
                          {r.description}
                        </td>
                        <td className="py-1.5 px-2 text-slate-700">{r.material}</td>
                        <td className="py-1.5 px-2 font-bold text-slate-700">{r.grouping}</td>
                        <td className="py-1.5 px-2">
                          <span className="text-slate-800 font-bold">{r.designation}</span>
                          {r.costCenter && (
                            <span className="text-slate-400 ml-1">({r.costCenter})</span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold text-slate-900">
                          {r.totalQty}
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold text-blue-700">
                          {r.revision}
                        </td>
                        <td className="py-1.5 px-2 text-slate-500 truncate max-w-[170px]">
                          {r.parentDrawingNumber !== r.partNumber ? r.parentDrawingNumber : 'ROOT'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <div className="text-[11px] text-slate-500 font-mono">
            {extractedData
              ? `Sheets scanned: ${extractedData.sheetNames.join(', ')}`
              : 'Upload a Machine BOM / Progress Excel (.xlsx) file to preview and import.'}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold"
            >
              Close
            </button>
            <button
              type="button"
              disabled={!extractedData || !computedPayloads || isImporting}
              onClick={handleExecuteImport}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded font-bold flex items-center gap-1.5 shadow-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>
                {isImporting
                  ? 'Importing Machine BOM Package...'
                  : computedPayloads
                  ? `Import ${computedPayloads.drawings.length} Drawings & ${computedPayloads.components.length} Parts to Machine`
                  : 'Import Machine BOM Excel'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
