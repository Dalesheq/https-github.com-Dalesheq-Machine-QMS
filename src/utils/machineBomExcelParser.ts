import * as XLSX from 'xlsx';
import { DrawingPartItem, DrawingStatus } from '../types';

export interface ExtractedBomRow {
  rowIndex: number;
  itemNumber: string; // e.g. "0", "3", "3.1", "3.1.1"
  hierarchyLevel: string; // e.g. "M", "0", "1", "2", "3"
  filename: string; // e.g. "T0559-058-719-00-00-002-01.ipt"
  partNumber: string; // e.g. "T0559-058-719-00-00-002-01"
  rawPartNumber: string; // raw cell value e.g. "030" or "**"
  componentType: 'Assembly' | 'Part';
  material: string; // e.g. "S/S 304 SATIN"
  description: string; // e.g. "Ø8 R/BAR X 36 LG"
  costCenter: string; // e.g. "719", "030"
  designation: string; // Stock Number / DESIG.: "MANUF-INT", "MANUF-EXT", "B/O-EXT", "B/O-MOD", "INFO"
  grouping: string; // "ASSY", "R/BAR", "SHEET", "CHS", "RHS", "HEX BAR", "WEAR", "SHT KEY", "VAST"
  classification: string; // e.g. "Manufactured Comp. Int", "Manufactured Comp. Ext", "Bought Out", "Informational"
  itemQty: string; // Quantity per immediate parent assembly
  totalQty: string; // Total quantity on machine
  revision: string; // e.g. "0", "1", "3", "A"
  filePath: string; // e.g. "C:\DSS WORKING FOLDER\DALE PROJECTS\T-JOBS\T0559 - DIVIDER\ACCURIST\..."
  parentItemNumber: string; // e.g. "3.1" for "3.1.1"
  parentDrawingNumber: string; // e.g. "T0559-058-719-00-00-002-00"
  parentDrawingTitle: string; // e.g. "COVER PIVOT MOUNT 1"
  isManufactured: boolean; // true for MANUF-INT, MANUF-EXT, INFO; false for B/O-EXT, 030 fasteners
  notes: string;
}

export interface ExtractedWorkbookMetadata {
  fileName: string;
  sheetNames: string[];
  detectedProjectNumber: string;
  detectedProjectName: string;
  detectedMachineType: string;
  detectedElementCode: string;
  detectedRootAssemblyNumber: string;
  detectedRootAssemblyTitle: string;
  detectedModelledBy: string;
  detectedDetailedBy: string;
  totalRowsParsed: number;
  manufacturedCount: number;
  assembliesCount: number;
  manufacturedPartsCount: number;
  boughtOutCount: number;
  rows: ExtractedBomRow[];
}

function cleanFileExtension(filename: string): string {
  return filename
    .trim()
    .replace(/\.(iam|ipt|idw|dwg|sldprt|sldasm|step|stp)$/i, '')
    .trim();
}

/**
 * Infers material/shape grouping (ASSY, R/BAR, SHEET, CHS, RHS, HEX BAR, WEAR, SHT KEY, VAST)
 * when not explicitly provided in a Grouping/GROUP column.
 */
function inferGrouping(
  componentType: 'Assembly' | 'Part',
  description: string,
  material: string,
  existingGrouping?: string
): string {
  const cleanGroup = (existingGrouping || '').trim().toUpperCase();
  if (
    cleanGroup &&
    cleanGroup !== 'NO MATCH' &&
    cleanGroup !== 'NO DESC.' &&
    cleanGroup !== 'OPEN'
  ) {
    return cleanGroup;
  }
  if (componentType === 'Assembly') return 'ASSY';
  const d = description.toUpperCase();
  const m = material.toUpperCase();
  if (d.includes('R/BAR') || d.includes('ROUND BAR')) return 'R/BAR';
  if (d.includes('HEX BAR') || d.includes('HEXAGON BAR')) return 'HEX BAR';
  if (d.includes('RHS') || d.includes('SHS')) return 'RHS';
  if (d.includes('CHS') || d.includes('PIPE') || d.includes('TUBE')) return 'CHS';
  if (d.includes('VASTRAP') || d.includes('VAST')) return 'VAST';
  if (d.includes('KEY') || m.includes('KEY')) return 'SHT KEY';
  if (
    m.includes('ACETAL') ||
    m.includes('VESCONITE') ||
    m.includes('UHMW') ||
    m.includes('POLYESTER') ||
    m.includes('EPDM') ||
    m.includes('RUBBER')
  ) {
    if (d.includes('FLT') || d.includes('WEAR')) return 'WEAR';
  }
  if (d.includes('THK PLT') || d.includes('PLT') || d.includes('SHEET') || d.includes('SQ/BAR')) {
    return 'SHEET';
  }
  return 'PART';
}

/**
 * Infers classification string from designation/stock number and component type
 */
function inferClassification(designation: string, isManufactured: boolean): string {
  const d = designation.toUpperCase();
  if (d.includes('MANUF-INT')) return 'Manufactured Comp. Int';
  if (d.includes('MANUF-EXT')) return 'Manufactured Comp. Ext';
  if (d === 'INFO' || d.includes('INFO')) return 'Informational';
  if (d.includes('B/O') || d.includes('BO-EXT')) return 'Bought Out';
  return isManufactured ? 'Manufactured Comp. Int' : 'Bought Out';
}

/**
 * Normalizes a Dale / Spiral Systems drawing or part number stem so that e.g.
 * "T0559-058-719-00-00-001-01-A" can match its "-00" assembly "T0559-058-719-00-00-001-00-A"
 */
export function deriveAssemblyStem(partOrDwgNo: string): string | null {
  const clean = partOrDwgNo.trim().toUpperCase().replace(/_MIR$/i, '');
  // Match e.g. T0559-058-719-00-00-001-01-A or T0559-058-719-00-02-013-01
  const m = clean.match(/^(T\d{3,5}-\d{2,4}-\d{2,4}-\d{2}-\d{2}-\d{3})-(\d{2}|EPDM)(?:-[A-Z0-9]+)?$/i);
  if (m) {
    return m[1]; // e.g. "T0559-058-719-00-00-001"
  }
  return null;
}

/**
 * Parses any multi-sheet or single-sheet Excel workbook (.xlsx / .xls) or CSV matrix
 * matching the Spiral Systems / Dale Automation Inventor CAD BOM & Progress Workbook
 * (as well as standard Drawings / Parts templates).
 */
export function parseMachineBomWorkbook(
  workbook: XLSX.WorkBook,
  fileName = 'Machine_BOM.xlsx'
): ExtractedWorkbookMetadata {
  const sheetNames = workbook.SheetNames || [];

  let detectedProjectNumber = '';
  let detectedProjectName = '';
  let detectedMachineType = '';
  let detectedElementCode = '';
  let detectedRootAssemblyNumber = '';
  let detectedRootAssemblyTitle = '';
  let detectedModelledBy = '';
  let detectedDetailedBy = '';

  // Maps to merge data across multiple sheets in the same workbook:
  // 1) By hierarchical Item number (e.g. "3.1.1")
  // 2) By normalized Part Number (e.g. "T0559-058-719-00-00-002-01")
  const rowsByItemNo = new Map<string, Partial<ExtractedBomRow>>();
  const extraByPartNo = new Map<
    string,
    {
      totalQty?: string;
      grouping?: string;
      hierarchyLevel?: string;
      classification?: string;
      description?: string;
      material?: string;
      designation?: string;
      costCenter?: string;
      revision?: string;
      componentType?: 'Assembly' | 'Part';
      filePath?: string;
    }
  >();
  const orderedRawItems: Partial<ExtractedBomRow>[] = [];
  const filePathsList: string[] = [];

  for (const sheetName of sheetNames) {
    const ws = workbook.Sheets[sheetName];
    if (!ws) continue;

    const matrix = XLSX.utils.sheet_to_json<string[]>(ws, {
      header: 1,
      defval: '',
      raw: false,
    });

    if (!matrix || matrix.length === 0) continue;

    // Scan top 15 rows for Progress Sheet metadata cells (TITLE:, SUBJECT:, ELEMENT:, PROJECT:, MODDLER:, DETAILER:)
    for (let r = 0; r < Math.min(15, matrix.length); r++) {
      const row = matrix[r].map((c) => String(c ?? '').trim());
      for (let c = 0; c < row.length; c++) {
        const cellUpper = row[c].toUpperCase();
        const nextVal = (row[c + 1] || row[c + 2] || '').trim();
        if ((cellUpper === 'MODDLER:' || cellUpper === 'MODELLER:' || cellUpper === 'MODELLED BY:') && nextVal) {
          if (!detectedModelledBy) detectedModelledBy = nextVal;
        } else if ((cellUpper === 'DETAILER:' || cellUpper === 'DETAILED BY:') && nextVal) {
          if (!detectedDetailedBy) detectedDetailedBy = nextVal;
        } else if (cellUpper === 'PROJECT:' && nextVal && !nextVal.includes('PLEASE ENTER')) {
          if (!detectedProjectName) detectedProjectName = nextVal;
        } else if (cellUpper === 'TITLE:' && nextVal && !nextVal.includes('PLEASE ENTER')) {
          if (!detectedRootAssemblyTitle) detectedRootAssemblyTitle = nextVal;
        } else if (cellUpper === 'ELEMENT:' && nextVal && nextVal !== '0' && !nextVal.includes('PLEASE ENTER')) {
          if (!detectedElementCode) detectedElementCode = nextVal;
        }
      }
    }

    // Locate header row in this sheet
    let headerRowIdx = -1;
    let headerCols: string[] = [];

    for (let r = 0; r < Math.min(25, matrix.length); r++) {
      const candidate = matrix[r].map((c) =>
        String(c ?? '')
          .trim()
          .toLowerCase()
          .replace(/\s+/g, ' ')
      );
      const nonEmptyCount = candidate.filter(Boolean).length;
      if (nonEmptyCount < 2) continue;

      const hasPartOrDwg = candidate.some(
        (h) =>
          h.includes('part number') ||
          h.includes('part numb') ||
          h.includes('part no') ||
          h.includes('drawing number') ||
          h.includes('drawing / part') ||
          h === 'filename'
      );
      const hasDescOrTypeOrItem = candidate.some(
        (h) =>
          h.includes('description') ||
          h.includes('drawing title') ||
          h.includes('component type') ||
          h.includes('componen') ||
          h === 'item' ||
          h === 'hier:' ||
          h === 'desig.'
      );

      if (hasPartOrDwg && hasDescOrTypeOrItem) {
        headerRowIdx = r;
        headerCols = candidate;
        break;
      }

      // Check if it's a single-column or File Path sheet
      if (candidate[0] === 'file path') {
        for (let fr = r + 1; fr < matrix.length; fr++) {
          const fp = String(matrix[fr][0] ?? '').trim();
          if (fp) filePathsList.push(fp);
        }
        break;
      }
    }

    if (headerRowIdx === -1) continue;

    const findCol = (exactList: string[], partialList: string[]): number => {
      const exactIdx = headerCols.findIndex((h) => exactList.includes(h.replace(/:$/, '').trim()));
      if (exactIdx !== -1) return exactIdx;
      return headerCols.findIndex((h) => partialList.some((p) => h.includes(p)));
    };

    const colItem = findCol(['item', 'item no'], ['item']);
    const colFilename = findCol(['filename', 'file name'], ['filename', 'file name']);
    const colPartNumber = findCol(
      ['part number', 'part numb', 'part no', 'drawing / part no', 'part number:'],
      ['part number', 'part numb', 'part no', 'drawing / part']
    );
    const colDrawingNumber = findCol(['drawing number', 'drawing no'], ['drawing number', 'drawing no']);
    const colCompType = findCol(['component type', 'type', 'type:'], ['component type', 'componen', 'type']);
    const colMaterial = findCol(['material', 'material:'], ['material']);
    const colDescription = findCol(
      ['description', 'description:', 'drawing title'],
      ['description', 'descriptior', 'drawing title']
    );
    const colCostCenter = findCol(['cost center', 'cost cente', 'element code', 'element'], ['cost cent', 'element']);
    const colStockNumber = findCol(
      ['stock number', 'stock num', 'desig.', 'desig', 'designation'],
      ['stock num', 'desig']
    );
    const colItemQty = findCol(['item qty', 'qty', 'qty:'], ['item qty']);
    const colTotalQty = findCol(['total qty', 'qty:', 'qty'], ['total qty', 'qty']);
    const colRev = findCol(['rev', 'rev:', 'revision'], ['rev']);
    const colFilePath = findCol(['file path', 'filepath'], ['file path', 'filepath']);
    const colGrouping = findCol(['grouping', 'group', 'group:'], ['group']);
    const colClassification = findCol(['classification'], ['classification']);
    const colHier = findCol(['hier', 'hier:'], ['hier']);

    // Note: in Sheet 1, "Item" is col 0 and "Item QTY" is another column containing "item qty"
    const actualColItem =
      colItem !== -1 && headerCols[colItem] !== 'item qty'
        ? colItem
        : headerCols.findIndex((h) => h === 'item' || h === 'item no');

    // Parse rows in this sheet
    for (let r = headerRowIdx + 1; r < matrix.length; r++) {
      const row = matrix[r];
      if (!row || row.every((c) => !String(c ?? '').trim())) continue;

      const getVal = (idx: number): string => (idx >= 0 && idx < row.length ? String(row[idx] ?? '').trim() : '');

      const itemNo = getVal(actualColItem);
      const filename = getVal(colFilename);
      const rawPartNo = getVal(colPartNumber) || getVal(colDrawingNumber);
      const explicitDwgNo = getVal(colDrawingNumber);
      const rawCompType = getVal(colCompType);
      const material = getVal(colMaterial);
      const description = getVal(colDescription);
      const costCenter = getVal(colCostCenter);
      const stockNumber = getVal(colStockNumber);
      const itemQty = getVal(colItemQty);
      const totalQty = getVal(colTotalQty);
      const rev = getVal(colRev);
      const filePath = getVal(colFilePath);
      const grouping = getVal(colGrouping);
      const classification = getVal(colClassification);
      const hier = getVal(colHier);

      // Skip summary/total rows or blank filler rows
      if (!filename && !rawPartNo && !description) continue;
      if (
        rawPartNo.toUpperCase().startsWith('TEXT JOIN') ||
        description.toUpperCase() === 'DESCRIPTION' ||
        rawPartNo.toUpperCase() === 'PART NUMBER'
      ) {
        continue;
      }

      // Determine clean Part Number:
      // In Inventor BOMs, Content Centre fasteners have Part Number = "030" and Bought-Out parts may have "**"
      const cleanFn = cleanFileExtension(filename);
      let resolvedPartNumber = rawPartNo.trim();
      if (!resolvedPartNumber || resolvedPartNumber === '**' || resolvedPartNumber === '030') {
        resolvedPartNumber = cleanFn || rawPartNo.trim();
      }
      resolvedPartNumber = resolvedPartNumber.toUpperCase();

      if (!resolvedPartNumber) continue;

      // Determine Component Type ('Assembly' | 'Part')
      const typeUpper = rawCompType.toUpperCase();
      const isAssy =
        typeUpper.includes('ASSY') ||
        typeUpper.includes('ASSEMBLY') ||
        /\.iam$/i.test(filename) ||
        grouping.toUpperCase() === 'ASSY' ||
        /-00(?:-[A-Z0-9]+)?(?:_MIR)?$/i.test(resolvedPartNumber);
      const componentType: 'Assembly' | 'Part' = isAssy ? 'Assembly' : 'Part';

      // Extract project/machine info from File Path if available
      if (filePath) {
        filePathsList.push(filePath);
      }

      // Check if this sheet is a supplementary sheet (Sheet 2 Classification or Sheet 3 Progress)
      const isPrimarySheetRow = Boolean(itemNo && (filename || colFilename !== -1));

      if (isPrimarySheetRow) {
        const existing = rowsByItemNo.get(itemNo);
        const rowObj: Partial<ExtractedBomRow> = {
          ...existing,
          rowIndex: r + 1,
          itemNumber: itemNo,
          hierarchyLevel: hier || existing?.hierarchyLevel || String(itemNo.split('.').length - 1),
          filename: filename || existing?.filename || '',
          partNumber: resolvedPartNumber,
          rawPartNumber: rawPartNo || existing?.rawPartNumber || resolvedPartNumber,
          componentType,
          material: material || existing?.material || '',
          description:
            description && description !== 'NO DESCRIPTION'
              ? description
              : existing?.description || cleanFn || resolvedPartNumber,
          costCenter: costCenter || existing?.costCenter || '',
          designation: stockNumber || existing?.designation || '',
          grouping: grouping || existing?.grouping || '',
          classification: classification || existing?.classification || '',
          itemQty: itemQty || existing?.itemQty || totalQty || '1',
          totalQty: totalQty || existing?.totalQty || itemQty || '1',
          revision: rev !== '' ? rev : existing?.revision ?? '0',
          filePath: filePath || existing?.filePath || '',
          parentDrawingNumber: explicitDwgNo ? explicitDwgNo.toUpperCase() : existing?.parentDrawingNumber || '',
        };
        rowsByItemNo.set(itemNo, rowObj);
        if (!existing) {
          orderedRawItems.push(rowObj);
        }
      } else {
        // Supplementary sheet (like Sheet 3 Progress sheet or a flat table without Item column)
        const prevExtra = extraByPartNo.get(resolvedPartNumber) || {};
        extraByPartNo.set(resolvedPartNumber, {
          totalQty: totalQty || itemQty || prevExtra.totalQty,
          grouping:
            grouping && grouping !== 'No Match' && grouping !== 'No Desc.'
              ? grouping
              : prevExtra.grouping,
          hierarchyLevel: hier || prevExtra.hierarchyLevel,
          classification: classification || prevExtra.classification,
          description:
            description && description !== 'NO DESCRIPTION' ? description : prevExtra.description,
          material: material || prevExtra.material,
          designation: stockNumber || prevExtra.designation,
          costCenter: costCenter || prevExtra.costCenter,
          revision: rev !== '' ? rev : prevExtra.revision,
          componentType: rawCompType ? componentType : prevExtra.componentType,
          filePath: filePath || prevExtra.filePath,
        });

        // Also if orderedRawItems is empty (e.g., user uploaded ONLY the Progress sheet or a flat sheet),
        // add it to orderedRawItems so single-sheet uploads work identically!
        if (rowsByItemNo.size === 0) {
          orderedRawItems.push({
            rowIndex: r + 1,
            itemNumber: itemNo || String(orderedRawItems.length + 1),
            hierarchyLevel: hier || '0',
            filename: filename || '',
            partNumber: resolvedPartNumber,
            rawPartNumber: rawPartNo || resolvedPartNumber,
            componentType,
            material,
            description:
              description && description !== 'NO DESCRIPTION'
                ? description
                : cleanFn || resolvedPartNumber,
            costCenter,
            designation: stockNumber,
            grouping,
            classification,
            itemQty: itemQty || totalQty || '1',
            totalQty: totalQty || itemQty || '1',
            revision: rev !== '' ? rev : '0',
            filePath,
            parentDrawingNumber: explicitDwgNo ? explicitDwgNo.toUpperCase() : '',
          });
        }
      }
    }
  }

  // Attach filePaths if they were in a separate column/sheet
  if (filePathsList.length > 0) {
    for (let i = 0; i < Math.min(orderedRawItems.length, filePathsList.length); i++) {
      if (!orderedRawItems[i].filePath) {
        orderedRawItems[i].filePath = filePathsList[i];
      }
    }
    // Extract project & machine type from File Path like:
    // "C:\DSS WORKING FOLDER\DALE PROJECTS\T-JOBS\T0559 - DIVIDER\ACCURIST\T0559-058-719-00-00-000-00.iam"
    for (const fp of filePathsList) {
      const jobMatch = fp.match(/\\T-JOBS\\([^\\]+)\\([^\\]+)\\/i);
      if (jobMatch) {
        const jobFolder = jobMatch[1].trim(); // e.g. "T0559 - DIVIDER"
        const subFolder = jobMatch[2].trim(); // e.g. "ACCURIST"
        if (!detectedProjectName) {
          detectedProjectName =
            subFolder && !/^(BUY-OUT|COMMON)/i.test(subFolder)
              ? `${jobFolder} (${subFolder})`
              : jobFolder;
        }
        if (!detectedMachineType) {
          if (jobFolder.toUpperCase().includes('DIVIDER')) detectedMachineType = 'DIVIDER';
          else if (jobFolder.toUpperCase().includes('ROUNDER')) detectedMachineType = 'ROUNDER';
          else if (jobFolder.toUpperCase().includes('MOULDER')) detectedMachineType = 'MOULDER';
          else if (jobFolder.toUpperCase().includes('PROOFER')) detectedMachineType = 'PROOFER';
          else if (!/^(BUY-OUT|COMMON)/i.test(subFolder)) detectedMachineType = subFolder.toUpperCase();
        }
        break;
      }
    }
  }

  // Build lookup of Assemblies by Item Number and by Assembly Stem
  const itemMap = new Map<string, Partial<ExtractedBomRow>>();
  const assemblyByStem = new Map<string, { partNumber: string; description: string }>();

  for (const item of orderedRawItems) {
    const pNo = (item.partNumber || '').toUpperCase();
    const extra = extraByPartNo.get(pNo);
    if (extra) {
      if (extra.totalQty) item.totalQty = extra.totalQty;
      if (extra.grouping && !item.grouping) item.grouping = extra.grouping;
      if (extra.hierarchyLevel && (!item.hierarchyLevel || item.hierarchyLevel === '0')) {
        item.hierarchyLevel = extra.hierarchyLevel;
      }
      if (extra.classification && !item.classification) item.classification = extra.classification;
      if (extra.description && (!item.description || item.description === pNo)) {
        item.description = extra.description;
      }
      if (extra.material && !item.material) item.material = extra.material;
      if (extra.designation && !item.designation) item.designation = extra.designation;
      if (extra.costCenter && !item.costCenter) item.costCenter = extra.costCenter;
      if (extra.revision && (!item.revision || item.revision === '0')) item.revision = extra.revision;
    }

    if (item.itemNumber) {
      itemMap.set(item.itemNumber, item);
    }

    if (item.componentType === 'Assembly') {
      const stem = deriveAssemblyStem(pNo);
      if (stem && !pNo.endsWith('_MIR')) {
        assemblyByStem.set(stem, {
          partNumber: pNo,
          description: item.description || pNo,
        });
      }
      if (item.itemNumber === '0' || item.hierarchyLevel === 'M' || !detectedRootAssemblyNumber) {
        if (item.itemNumber === '0' || item.hierarchyLevel === 'M' || pNo.endsWith('-00-00-000-00')) {
          detectedRootAssemblyNumber = pNo;
          detectedRootAssemblyTitle = item.description || detectedRootAssemblyTitle || pNo;
        }
      }
    }

    // Detect Project Number & Element Code from Dale/Spiral Numbering e.g. T0559-058-719-00-00-000-00
    const daleMatch = pNo.match(/^(T\d{3,5}-\d{2,4})-(\d{2,4})-/);
    if (daleMatch) {
      if (!detectedProjectNumber) detectedProjectNumber = daleMatch[1]; // e.g. "T0559-058"
      if (!detectedElementCode) detectedElementCode = daleMatch[2]; // e.g. "719"
    }
    if (!detectedElementCode && item.costCenter && item.costCenter !== '030') {
      detectedElementCode = item.costCenter;
    }
  }

  if (!detectedRootAssemblyNumber && orderedRawItems.length > 0) {
    detectedRootAssemblyNumber = orderedRawItems[0].partNumber || '';
    detectedRootAssemblyTitle = orderedRawItems[0].description || '';
  }

  if (!detectedProjectNumber && detectedRootAssemblyNumber) {
    const m = detectedRootAssemblyNumber.match(/^(T\d{3,5}(?:-\d{2,4})?)/);
    if (m) detectedProjectNumber = m[1];
  }

  if (!detectedMachineType) {
    const titleUpper = (detectedRootAssemblyTitle || '').toUpperCase();
    if (titleUpper.includes('DIVIDER')) detectedMachineType = 'DIVIDER';
    else if (titleUpper.includes('ROUNDER')) detectedMachineType = 'ROUNDER';
    else if (titleUpper.includes('PROOFER')) detectedMachineType = 'PROOFER';
    else if (titleUpper.includes('MOULDER')) detectedMachineType = 'MOULDER';
    else detectedMachineType = 'DIVIDER';
  }

  if (!detectedProjectName) {
    detectedProjectName = detectedRootAssemblyTitle
      ? `${detectedProjectNumber || 'PROJECT'} — ${detectedRootAssemblyTitle}`
      : `${detectedProjectNumber || 'MACHINE'} ${detectedMachineType}`;
  }

  // Final pass: resolve parent assembly drawing & total quantities for every row
  const finalRows: ExtractedBomRow[] = [];
  let manufacturedCount = 0;
  let assembliesCount = 0;
  let manufacturedPartsCount = 0;
  let boughtOutCount = 0;

  for (let i = 0; i < orderedRawItems.length; i++) {
    const raw = orderedRawItems[i];
    const itemNo = raw.itemNumber || String(i + 1);
    const pNo = (raw.partNumber || '').toUpperCase();
    const compType: 'Assembly' | 'Part' = raw.componentType || 'Part';

    // Find parent item via dot-hierarchy (e.g. "3.1.1" -> "3.1", "3.1" -> "3", "3" -> "0")
    let parentItemNo = '';
    if (itemNo.includes('.')) {
      parentItemNo = itemNo.slice(0, itemNo.lastIndexOf('.'));
    } else if (itemNo !== '0' && itemMap.has('0')) {
      parentItemNo = '0';
    }

    const parentRow = parentItemNo ? itemMap.get(parentItemNo) : undefined;

    // Also check stem match (e.g. T0559-058-719-00-00-001-01-A -> T0559-058-719-00-00-001-00-A)
    const stem = deriveAssemblyStem(pNo);
    const stemAssy = stem ? assemblyByStem.get(stem) : undefined;

    let parentDrawingNumber = raw.parentDrawingNumber || '';
    let parentDrawingTitle = '';

    if (!parentDrawingNumber) {
      if (compType === 'Part' && stemAssy && stemAssy.partNumber !== pNo) {
        parentDrawingNumber = stemAssy.partNumber;
        parentDrawingTitle = stemAssy.description;
      } else if (parentRow && parentRow.partNumber) {
        parentDrawingNumber = parentRow.partNumber;
        parentDrawingTitle = parentRow.description || parentRow.partNumber;
      } else if (detectedRootAssemblyNumber && pNo !== detectedRootAssemblyNumber) {
        parentDrawingNumber = detectedRootAssemblyNumber;
        parentDrawingTitle = detectedRootAssemblyTitle;
      } else {
        parentDrawingNumber = pNo;
        parentDrawingTitle = raw.description || pNo;
      }
    }

    const designation = (
      raw.designation ||
      (raw.costCenter === '030' ? 'B/O-EXT' : /^T\d{3,5}/i.test(pNo) ? 'MANUF-INT' : 'B/O-EXT')
    )
      .trim()
      .toUpperCase();

    const isManufactured =
      designation.includes('MANUF') ||
      designation === 'INFO' ||
      (raw.classification || '').toLowerCase().includes('manufactured') ||
      (raw.classification || '').toLowerCase().includes('informational') ||
      (/^T\d{3,5}/i.test(pNo) && !designation.includes('B/O') && !designation.includes('BO-EXT'));

    const material = (
      raw.material || (compType === 'Assembly' ? 'ASSEMBLY / AS PER BOM' : 'AS PER DRAWING')
    ).trim();

    const description = (raw.description || pNo).trim();
    const grouping = inferGrouping(compType, description, material, raw.grouping);
    const classification = raw.classification || inferClassification(designation, isManufactured);
    const costCenter = (
      raw.costCenter || (isManufactured ? detectedElementCode || '719' : '030')
    ).trim();
    const itemQty = (raw.itemQty || '1').trim();

    // Compute totalQty by multiplying down parent chain if not explicitly provided
    let totalQty = (raw.totalQty || '').trim();
    if (!totalQty || totalQty === itemQty) {
      let mult = parseFloat(itemQty) || 1;
      let currParent = parentItemNo;
      let safety = 0;
      while (currParent && currParent !== '0' && safety < 12) {
        const pObj = itemMap.get(currParent);
        if (pObj) {
          const pq = parseFloat(pObj.itemQty || '1');
          if (!isNaN(pq) && pq > 0) mult *= pq;
        }
        currParent = currParent.includes('.')
          ? currParent.slice(0, currParent.lastIndexOf('.'))
          : '';
        safety++;
      }
      totalQty = String(mult);
    }

    const revision = (raw.revision !== undefined && raw.revision !== '' ? raw.revision : '0')
      .trim()
      .toUpperCase();

    if (isManufactured) {
      manufacturedCount++;
      if (compType === 'Assembly') assembliesCount++;
      else manufacturedPartsCount++;
    } else {
      boughtOutCount++;
    }

    const notesParts = [
      `Item: ${itemNo}`,
      raw.hierarchyLevel ? `HIER: ${raw.hierarchyLevel}` : '',
      `Type: ${compType}`,
      `Group: ${grouping}`,
      `Desig: ${designation}`,
      costCenter ? `Cost Center: ${costCenter}` : '',
      `Item QTY: ${itemQty}`,
      `Total QTY: ${totalQty}`,
      parentDrawingNumber && parentDrawingNumber !== pNo
        ? `Parent Assy: ${parentDrawingNumber}`
        : '',
    ].filter(Boolean);

    finalRows.push({
      rowIndex: raw.rowIndex || i + 1,
      itemNumber: itemNo,
      hierarchyLevel: raw.hierarchyLevel || '0',
      filename: raw.filename || '',
      partNumber: pNo,
      rawPartNumber: raw.rawPartNumber || pNo,
      componentType: compType,
      material,
      description,
      costCenter,
      designation,
      grouping,
      classification,
      itemQty,
      totalQty,
      revision,
      filePath: raw.filePath || '',
      parentItemNumber: parentItemNo,
      parentDrawingNumber,
      parentDrawingTitle,
      isManufactured,
      notes: notesParts.join(' | '),
    });
  }

  return {
    fileName,
    sheetNames,
    detectedProjectNumber: detectedProjectNumber || 'T0559-058',
    detectedProjectName: detectedProjectName || 'T0559 - DIVIDER (ACCURIST)',
    detectedMachineType: detectedMachineType || 'DIVIDER',
    detectedElementCode: detectedElementCode || '719',
    detectedRootAssemblyNumber,
    detectedRootAssemblyTitle,
    detectedModelledBy,
    detectedDetailedBy,
    totalRowsParsed: finalRows.length,
    manufacturedCount,
    assembliesCount,
    manufacturedPartsCount,
    boughtOutCount,
    rows: finalRows,
  };
}

/**
 * Converts the extracted BOM rows into structured Controlled Drawings and Components payloads
 * ready to be committed for a specific Machine & Project.
 */
export function buildMachineImportPayloads(
  extracted: ExtractedWorkbookMetadata,
  options: {
    machineSerialNumber: string;
    machineType: string;
    projectNumber: string;
    projectName: string;
    elementCode: string;
    modelledBy: string;
    detailedBy: string;
    includeBoughtOut: boolean;
    createDetailDrawingsForParts: boolean;
    drawingStatus?: DrawingStatus;
  }
) {
  const today = new Date().toISOString().split('T')[0];
  const status: DrawingStatus = options.drawingStatus || 'APPROVED';

  const rowsToProcess = options.includeBoughtOut
    ? extracted.rows
    : extracted.rows.filter((r) => r.isManufactured);

  // 1. Build Drawings map (keyed by DrawingNumber__Revision)
  const drawingsMap = new Map<
    string,
    {
      drawingNumber: string;
      revision: string;
      drawingTitle: string;
      elementCode: string;
      projectReference: string;
      projectNumbers: string[];
      machineSerialNumbers: string[];
      drawingStatus: DrawingStatus;
      effectiveDate: string;
      revisionNotes: string;
      modelledBy: string;
      detailedBy: string;
      referenceDrawings: string;
      partsList: DrawingPartItem[];
    }
  >();

  const ensureDrawingEntry = (
    dwgNo: string,
    rev: string,
    title: string,
    refDwg: string,
    notes: string
  ) => {
    const cleanDwgNo = dwgNo.trim().toUpperCase();
    const cleanRev = (rev || '0').trim().toUpperCase();
    const key = `${cleanDwgNo}__${cleanRev}`;
    let entry = drawingsMap.get(key);
    if (!entry) {
      entry = {
        drawingNumber: cleanDwgNo,
        revision: cleanRev,
        drawingTitle: title || cleanDwgNo,
        elementCode: options.elementCode || extracted.detectedElementCode || '719',
        projectReference: `${options.projectNumber} — ${options.projectName}`,
        projectNumbers: [options.projectNumber],
        machineSerialNumbers: [options.machineSerialNumber],
        drawingStatus: status,
        effectiveDate: today,
        revisionNotes: notes || 'ISSUED FOR MANUFACTURE.',
        modelledBy: options.modelledBy || extracted.detectedModelledBy || '',
        detailedBy: options.detailedBy || extracted.detectedDetailedBy || '',
        referenceDrawings: refDwg || '',
        partsList: [],
      };
      drawingsMap.set(key, entry);
    }
    return entry;
  };

  // First register all Assemblies as Controlled Drawings
  for (const row of rowsToProcess) {
    if (row.componentType === 'Assembly') {
      const refDwg =
        row.parentDrawingNumber && row.parentDrawingNumber !== row.partNumber
          ? `${row.parentDrawingNumber}${
              row.parentDrawingTitle ? ` — ${row.parentDrawingTitle}` : ''
            }`
          : '';
      const entry = ensureDrawingEntry(
        row.partNumber,
        row.revision,
        `${row.designation ? `${row.designation} — ` : ''}${row.description}`,
        refDwg,
        `Assembly BOM Item ${row.itemNumber} (HIER ${row.hierarchyLevel}) • Total QTY: ${row.totalQty}`
      );
      // Ensure the assembly itself is listed in its partsList
      if (!entry.partsList.some((p) => p.partNumber === row.partNumber)) {
        entry.partsList.push({
          id: `PT-ASSY-${row.rowIndex}`,
          itemNumber: row.itemNumber || '1',
          quantity: row.totalQty || row.itemQty || '1',
          partNumber: row.partNumber,
          description: row.description,
          material: row.material || 'ASSEMBLY',
          designation: row.designation || 'MANUF-INT',
          orderNumber: row.grouping || 'ASSY',
          vendor: row.costCenter || '719',
        });
      }
    }
  }

  // Next, attach all Parts (and child Sub-Assemblies) to their Parent Assembly Drawing's partsList,
  // and optionally create detail drawings for Manufactured Parts
  for (const row of rowsToProcess) {
    const parentDwgNo = row.parentDrawingNumber || row.partNumber;
    // Find parent assembly entry (matching parentDwgNo across any revision, or create it)
    const existingParentEntry = Array.from(drawingsMap.values()).find(
      (d) => d.drawingNumber === parentDwgNo
    );

    const parentEntry =
      existingParentEntry ||
      ensureDrawingEntry(
        parentDwgNo,
        row.revision,
        row.parentDrawingTitle || row.description,
        '',
        `Controlled Drawing imported from Machine BOM (${options.machineSerialNumber})`
      );

    if (!parentEntry.partsList.some((p) => p.partNumber === row.partNumber)) {
      parentEntry.partsList.push({
        id: `PT-BOM-${row.rowIndex}`,
        itemNumber: row.itemNumber || String(parentEntry.partsList.length + 1),
        quantity: row.totalQty || row.itemQty || '1',
        partNumber: row.partNumber,
        description: row.description,
        material: row.material,
        designation: row.designation,
        orderNumber: row.grouping,
        vendor: row.costCenter,
      });
    }

    // If createDetailDrawingsForParts is enabled and this is a Manufactured Part, also ensure a Drawing record exists for the part number itself
    if (options.createDetailDrawingsForParts && row.isManufactured && row.componentType === 'Part') {
      const refDwg =
        parentDwgNo && parentDwgNo !== row.partNumber
          ? `${parentDwgNo}${row.parentDrawingTitle ? ` — ${row.parentDrawingTitle}` : ''}`
          : '';
      const detailEntry = ensureDrawingEntry(
        row.partNumber,
        row.revision,
        `${row.designation} (${row.grouping}) — ${row.description}`,
        refDwg,
        `Detail Part Drawing • Item ${row.itemNumber} (HIER ${row.hierarchyLevel}) • Material: ${row.material} • Total QTY: ${row.totalQty}`
      );
      if (!detailEntry.partsList.some((p) => p.partNumber === row.partNumber)) {
        detailEntry.partsList.push({
          id: `PT-DET-${row.rowIndex}`,
          itemNumber: row.itemNumber || '1',
          quantity: row.totalQty || row.itemQty || '1',
          partNumber: row.partNumber,
          description: row.description,
          material: row.material,
          designation: row.designation,
          orderNumber: row.grouping,
          vendor: row.costCenter,
        });
      }
    }
  }

  // 2. Build Components list (deduplicated by partNumber, summing quantities or keeping max Total QTY)
  const componentsMap = new Map<
    string,
    {
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
      active: boolean;
      projectNumbers: string[];
      machineSerialNumbers: string[];
      quantityPerAssembly: string;
      notes: string;
    }
  >();

  for (const row of rowsToProcess) {
    const existing = componentsMap.get(row.partNumber);
    const targetDwgNo = options.createDetailDrawingsForParts
      ? row.partNumber
      : row.parentDrawingNumber || row.partNumber;

    const categoryLabel =
      row.grouping && row.grouping !== 'PART'
        ? `${row.designation} (${row.grouping})`
        : row.designation || 'MANUF-INT';

    const isCritical =
      row.isManufactured &&
      row.designation !== 'INFO' &&
      (row.designation.includes('MANUF') || row.componentType === 'Assembly');

    if (!existing) {
      componentsMap.set(row.partNumber, {
        partNumber: row.partNumber,
        description: row.description,
        category: categoryLabel,
        machineTypes: [options.machineType],
        defaultDrawingNumber: targetDwgNo,
        currentDrawingRevision: row.revision || '0',
        materialSpecification: row.material,
        criticalComponent: isCritical,
        traceabilityRequired: row.isManufactured,
        permanentIdRequired: isCritical,
        active: true,
        projectNumbers: [options.projectNumber],
        machineSerialNumbers: [options.machineSerialNumber],
        quantityPerAssembly: row.totalQty || row.itemQty || '1',
        notes: row.notes,
      });
    }
  }

  return {
    drawings: Array.from(drawingsMap.values()),
    components: Array.from(componentsMap.values()),
  };
}
