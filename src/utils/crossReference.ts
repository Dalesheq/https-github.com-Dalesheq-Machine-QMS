import type {
  QMSDatabase,
  Project,
  Machine,
  Component,
  Drawing,
  DrawingPartItem,
  ManufacturingRecord,
} from '../types.ts';

export interface AllocatedPartDetail {
  partNumber: string;
  description: string;
  drawingNumber: string;
  revision: string;
  material: string;
  designation: string;
  quantity: string;
  criticalComponent: boolean;
  component?: Component;
  drawingPart?: DrawingPartItem;
  drawing?: Drawing;
}

export interface ProjectCrossReferences {
  project: Project;
  machines: Machine[];
  drawings: Drawing[];
  parts: AllocatedPartDetail[];
  manufacturingRecords: ManufacturingRecord[];
}

export interface MachineCrossReferences {
  machine: Machine;
  project?: Project;
  drawings: Drawing[];
  parts: AllocatedPartDetail[];
  manufacturingRecords: ManufacturingRecord[];
}

export interface ComponentCrossReferences {
  component: Component;
  drawings: Drawing[];
  projects: Project[];
  machines: Machine[];
  manufacturingRecords: ManufacturingRecord[];
}

export interface DrawingCrossReferences {
  drawing: Drawing;
  projects: Project[];
  machines: Machine[];
  components: Component[];
  partsList: DrawingPartItem[];
  manufacturingRecords: ManufacturingRecord[];
}

const norm = (val?: string | null): string => (val || '').trim().toUpperCase();

/**
 * Extracts a clean project code & project name from a free-text drawing projectReference
 * such as "T0559 - BULK HOPPER", "PRJ-2026-104 — Apex Divider", or from a Dale drawing number prefix "T0559-..."
 */
export function parseProjectRefString(
  projectReference?: string,
  drawingNumber?: string
): { projectNumber: string; projectName: string } | null {
  const rawRef = (projectReference || '').trim();
  if (rawRef) {
    // Match "PRJ-2026-104 - Name" or "T0559 - BULK HOPPER"
    const splitMatch = rawRef.match(/^([A-Z0-9]+(?:-[A-Z0-9]+)*)\s*[-—:]\s*(.+)$/i);
    if (splitMatch) {
      return {
        projectNumber: splitMatch[1].trim().toUpperCase(),
        projectName: splitMatch[2].trim(),
      };
    }
    // Check if rawRef itself is a project number like PRJ-2026-104 or T0559
    if (/^(?:PRJ-[A-Z0-9-]+|T\d{4,5})$/i.test(rawRef)) {
      return {
        projectNumber: rawRef.toUpperCase(),
        projectName: rawRef.toUpperCase(),
      };
    }
  }

  // Check if drawingNumber starts with Dale project code e.g. T0559-058-719...
  const dwg = (drawingNumber || '').trim().toUpperCase();
  const daleMatch = dwg.match(/^(T\d{4,5})-(\d{2,4}-\d{2,4})/);
  if (daleMatch) {
    const code = daleMatch[1];
    const nameFromRef = rawRef
      ? rawRef.replace(new RegExp(`^${code}\\s*[-—:]?\\s*`, 'i'), '').trim()
      : '';
    return {
      projectNumber: code,
      projectName: nameFromRef || `Project ${code} (${daleMatch[2]})`,
    };
  }

  return null;
}

/**
 * Checks whether a Drawing matches a Project by projectReference, projectNumbers, drawing prefix, etc.
 */
export function doesDrawingMatchProject(drawing: Drawing, project: Project): boolean {
  const pNum = norm(project.projectNumber);
  const pName = norm(project.projectName);
  if (!pNum) return false;

  if ((drawing.projectNumbers || []).some((pn) => norm(pn) === pNum)) return true;
  if ((project.allocatedDrawingNumbers || []).some((dn) => norm(dn) === norm(drawing.drawingNumber))) {
    return true;
  }

  const dRef = norm(drawing.projectReference);
  if (dRef) {
    if (dRef === pNum || dRef.includes(pNum)) return true;
    if (pName && pName.length > 3 && dRef.includes(pName)) return true;
  }

  const parsed = parseProjectRefString(drawing.projectReference, drawing.drawingNumber);
  if (parsed && norm(parsed.projectNumber) === pNum) return true;

  // Prefix match e.g. projectNumber = "T0559" and drawingNumber = "T0559-058-719-00-02-012-00"
  if (pNum.length >= 4 && norm(drawing.drawingNumber).startsWith(`${pNum}-`)) {
    return true;
  }

  return false;
}

/**
 * Helper to get all BOM parts from a Drawing record
 */
export function extractPartsFromDrawing(drawing: Drawing): DrawingPartItem[] {
  if (drawing.partsList && drawing.partsList.length > 0) {
    return drawing.partsList.filter((p) => Boolean((p.partNumber || '').trim()));
  }
  const rawList =
    drawing.partNumbers && drawing.partNumbers.length > 0
      ? drawing.partNumbers
      : drawing.partNumber
      ? drawing.partNumber
          .split(/[;,]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  return rawList.map((pn, idx) => ({
    id: `${drawing.id}-PT-${idx + 1}`,
    itemNumber: String(idx + 1),
    quantity: '1',
    partNumber: pn.toUpperCase(),
    description: drawing.drawingTitle,
    material: 'As per Drawing',
    designation: 'MANUF-INT',
    orderNumber: '',
    vendor: '',
  }));
}

/**
 * Bi-directionally reconciles and cross-populates all 5 core QMS registers:
 * 1. Projects <-> Machines
 * 2. Drawings <-> Projects & Machines
 * 3. Drawings <-> Parts / Components
 * 4. Manufacturing Records <-> Projects, Machines, Drawings & Parts
 */
export function reconcileCrossPopulatedDatabase(db: QMSDatabase): QMSDatabase {
  const deletedSet = new Set((db.deletedRecordKeys || []).map(norm));

  const isProjectDeleted = (id?: string, pNum?: string) =>
    deletedSet.has('LIST_CLEARED:PROJECTS') ||
    (Boolean(id) && deletedSet.has(`PROJECT:${norm(id)}`)) ||
    (Boolean(pNum) && deletedSet.has(`PROJECT:${norm(pNum)}`));

  const isMachineDeleted = (id?: string, sn?: string) =>
    deletedSet.has('LIST_CLEARED:MACHINES') ||
    (Boolean(id) && deletedSet.has(`MACHINE:${norm(id)}`)) ||
    (Boolean(sn) && deletedSet.has(`MACHINE:${norm(sn)}`));

  const isComponentDeleted = (id?: string, pn?: string) =>
    deletedSet.has('LIST_CLEARED:COMPONENTS') ||
    (Boolean(id) && deletedSet.has(`COMPONENT:${norm(id)}`)) ||
    (Boolean(pn) && deletedSet.has(`COMPONENT:${norm(pn)}`));

  const isDrawingDeleted = (id?: string, dwgNo?: string, rev?: string) =>
    deletedSet.has('LIST_CLEARED:DRAWINGS') ||
    (Boolean(id) && deletedSet.has(`DRAWING:${norm(id)}`)) ||
    (Boolean(dwgNo) && deletedSet.has(`DRAWING:${norm(dwgNo)}`)) ||
    (Boolean(dwgNo) && Boolean(rev) && deletedSet.has(`DRAWING:${norm(dwgNo)}::${norm(rev)}`));

  const projects: Project[] = (db.projects || [])
    .filter((p) => p && !isProjectDeleted(p.id, p.projectNumber))
    .map((p) => ({
      ...p,
      associatedSerialNumbers: Array.from(
        new Set(
          [...(p.associatedSerialNumbers || []), ...(p.machineSerialNumbers || [])]
            .map(norm)
            .filter((sn) => Boolean(sn) && !isMachineDeleted(undefined, sn))
        )
      ),
      machineSerialNumbers: Array.from(
        new Set(
          [...(p.associatedSerialNumbers || []), ...(p.machineSerialNumbers || [])]
            .map(norm)
            .filter((sn) => Boolean(sn) && !isMachineDeleted(undefined, sn))
        )
      ),
      allocatedDrawingNumbers: Array.from(
        new Set(
          (p.allocatedDrawingNumbers || [])
            .map(norm)
            .filter((dn) => Boolean(dn) && !isDrawingDeleted(undefined, dn))
        )
      ),
      allocatedPartNumbers: Array.from(
        new Set(
          (p.allocatedPartNumbers || [])
            .map(norm)
            .filter((pn) => Boolean(pn) && !isComponentDeleted(undefined, pn))
        )
      ),
    }));

  const machines: Machine[] = (db.machines || [])
    .filter((m) => m && !isMachineDeleted(m.id, m.serialNumber))
    .map((m) => ({
      ...m,
      serialNumber: norm(m.serialNumber),
      projectNumber: isProjectDeleted(undefined, m.projectNumber) ? '' : norm(m.projectNumber),
      allocatedDrawingNumbers: Array.from(
        new Set(
          (m.allocatedDrawingNumbers || [])
            .map(norm)
            .filter((dn) => Boolean(dn) && !isDrawingDeleted(undefined, dn))
        )
      ),
      allocatedPartNumbers: Array.from(
        new Set(
          (m.allocatedPartNumbers || [])
            .map(norm)
            .filter((pn) => Boolean(pn) && !isComponentDeleted(undefined, pn))
        )
      ),
    }));

  const components: Component[] = (db.components || [])
    .filter((c) => c && !isComponentDeleted(c.id, c.partNumber))
    .map((c) => ({
      ...c,
      partNumber: norm(c.partNumber),
      defaultDrawingNumber: norm(c.defaultDrawingNumber || c.drawingNumber),
      drawingNumber: norm(c.drawingNumber || c.defaultDrawingNumber),
      currentDrawingRevision: norm(c.currentDrawingRevision || '0'),
      projectNumbers: Array.from(
        new Set(
          (c.projectNumbers || [])
            .map(norm)
            .filter((pn) => Boolean(pn) && !isProjectDeleted(undefined, pn))
        )
      ),
      machineSerialNumbers: Array.from(
        new Set(
          (c.machineSerialNumbers || [])
            .map(norm)
            .filter((sn) => Boolean(sn) && !isMachineDeleted(undefined, sn))
        )
      ),
    }));

  const drawings: Drawing[] = (db.drawings || [])
    .filter((d) => d && !isDrawingDeleted(d.id, d.drawingNumber, d.revision))
    .map((d) => ({
      ...d,
      drawingNumber: norm(d.drawingNumber),
      revision: norm(d.revision || '0'),
      projectNumbers: Array.from(
        new Set(
          (d.projectNumbers || [])
            .map(norm)
            .filter((pn) => Boolean(pn) && !isProjectDeleted(undefined, pn))
        )
      ),
      machineSerialNumbers: Array.from(
        new Set(
          (d.machineSerialNumbers || [])
            .map(norm)
            .filter((sn) => Boolean(sn) && !isMachineDeleted(undefined, sn))
        )
      ),
    }));

  const projectByNumber = new Map<string, Project>();
  projects.forEach((p) => projectByNumber.set(norm(p.projectNumber), p));

  const machineBySerial = new Map<string, Machine>();
  machines.forEach((m) => machineBySerial.set(norm(m.serialNumber), m));

  const componentByPartNo = new Map<string, Component>();
  components.forEach((c) => componentByPartNo.set(norm(c.partNumber), c));

  // 1. Ensure Projects exist for any Machine projectNumber, Drawing projectReference, or ManufacturingRecord projectNumber
  machines.forEach((m) => {
    const pNum = norm(m.projectNumber);
    if (
      pNum &&
      pNum !== 'PRJ-UNASSIGNED' &&
      !projectByNumber.has(pNum) &&
      !isProjectDeleted(undefined, pNum)
    ) {
      const newProj: Project = {
        id: `PRJ-AUTO-${pNum.replace(/[^A-Z0-9]/g, '')}`,
        projectNumber: pNum,
        projectName: m.projectName || `${m.machineType} Project ${pNum}`,
        customer: m.customer || 'Spiral Systems / Dale Automation',
        machineType: m.machineType || 'DIVIDER',
        associatedSerialNumbers: [m.serialNumber],
        machineSerialNumbers: [m.serialNumber],
        allocatedDrawingNumbers: [],
        allocatedPartNumbers: [],
        projectStatus: 'ACTIVE',
        startDate: (m.dateCreated || new Date().toISOString()).split('T')[0],
        targetCompletionDate: '2026-12-31',
        createdBy: m.createdBy || 'System Auto-Link',
        notes: `Auto-linked from Machine ${m.serialNumber}`,
      };
      projects.push(newProj);
      projectByNumber.set(pNum, newProj);
    }
  });

  drawings.forEach((d) => {
    const parsedProj = parseProjectRefString(d.projectReference, d.drawingNumber);
    if (
      parsedProj &&
      parsedProj.projectNumber &&
      !projectByNumber.has(norm(parsedProj.projectNumber)) &&
      !isProjectDeleted(undefined, parsedProj.projectNumber)
    ) {
      // Check if any existing project name matches before creating
      const existingByName = projects.find(
        (p) =>
          norm(p.projectName).includes(norm(parsedProj.projectName)) ||
          (d.projectReference && norm(d.projectReference).includes(norm(p.projectNumber)))
      );
      if (existingByName) {
        if (!d.projectNumbers?.includes(norm(existingByName.projectNumber))) {
          d.projectNumbers = [...(d.projectNumbers || []), norm(existingByName.projectNumber)];
        }
      } else {
        const pNum = norm(parsedProj.projectNumber);
        const autoMachineSerial = d.elementCode
          ? `${pNum}-${norm(d.elementCode)}`
          : `${pNum}-UNIT-01`;
        const validSerials = isMachineDeleted(undefined, autoMachineSerial)
          ? []
          : [autoMachineSerial];
        const newProj: Project = {
          id: `PRJ-AUTO-${pNum.replace(/[^A-Z0-9]/g, '')}`,
          projectNumber: pNum,
          projectName: parsedProj.projectName || d.drawingTitle || pNum,
          customer: 'Dale Automation / Spiral Systems',
          machineType: 'CUSTOM_SYSTEM',
          associatedSerialNumbers: [...validSerials],
          machineSerialNumbers: [...validSerials],
          allocatedDrawingNumbers: [d.drawingNumber],
          allocatedPartNumbers: extractPartsFromDrawing(d)
            .map((pt) => norm(pt.partNumber))
            .filter((pn) => !isComponentDeleted(undefined, pn)),
          projectStatus: 'ACTIVE',
          startDate: d.effectiveDate || new Date().toISOString().split('T')[0],
          targetCompletionDate: '2026-12-31',
          createdBy: d.detailedBy || d.approvedBy || 'Engineering Drawing Import',
          notes: `Cross-populated from Engineering Drawing ${d.drawingNumber} (${d.drawingTitle})`,
        };
        projects.push(newProj);
        projectByNumber.set(pNum, newProj);
      }
    }
  });

  // 2. Bi-directionally sync Projects <-> Machines
  projects.forEach((p) => {
    const pNum = norm(p.projectNumber);
    // Find all machines pointing to this project
    machines.forEach((m) => {
      if (norm(m.projectNumber) === pNum) {
        if (!p.associatedSerialNumbers.includes(m.serialNumber)) {
          p.associatedSerialNumbers.push(m.serialNumber);
        }
        if (!p.machineSerialNumbers.includes(m.serialNumber)) {
          p.machineSerialNumbers.push(m.serialNumber);
        }
      }
    });

    // Ensure every serial number in p.associatedSerialNumbers exists in machines (unless deleted)
    p.associatedSerialNumbers.forEach((sn) => {
      const cleanSn = norm(sn);
      if (!cleanSn || isMachineDeleted(undefined, cleanSn)) return;
      const existingMachine = machineBySerial.get(cleanSn);
      if (existingMachine) {
        if (!existingMachine.projectNumber || existingMachine.projectNumber === 'PRJ-UNASSIGNED') {
          existingMachine.projectNumber = p.projectNumber;
          existingMachine.projectName = p.projectName;
        }
      } else {
        const newMachine: Machine = {
          id: `MCH-AUTO-${cleanSn.replace(/[^A-Z0-9]/g, '')}`,
          serialNumber: cleanSn,
          machineType: p.machineType || 'DIVIDER',
          customer: p.customer || 'Dale Automation / Spiral Systems',
          projectNumber: p.projectNumber,
          projectName: p.projectName,
          manufacturingStatus: 'IN_PRODUCTION',
          assemblyStatus: 'SUB_ASSEMBLY',
          dateCreated: p.startDate || new Date().toISOString().split('T')[0],
          createdBy: p.createdBy || 'System Auto-Link',
          allocatedDrawingNumbers: [...(p.allocatedDrawingNumbers || [])],
          allocatedPartNumbers: [...(p.allocatedPartNumbers || [])],
          notes: `Auto-linked to Project ${p.projectNumber} (${p.projectName})`,
        };
        machines.push(newMachine);
        machineBySerial.set(cleanSn, newMachine);
      }
    });
  });

  // 3. Bi-directionally sync Drawings <-> Components (Parts)
  drawings.forEach((d) => {
    const dParts = extractPartsFromDrawing(d).filter(
      (pt) =>
        !deletedSet.has(`DRAWING_BOM_CLEARED:${d.drawingNumber}`) &&
        !deletedSet.has(`DRAWING_PART:${d.drawingNumber}::${norm(pt.partNumber)}`)
    );
    d.partsList = dParts;
    d.partNumbers = dParts.map((pt) => norm(pt.partNumber));
    d.partNumber = d.partNumbers.join('; ');

    dParts.forEach((pt, idx) => {
      const cleanPn = norm(pt.partNumber);
      if (!cleanPn || isComponentDeleted(undefined, cleanPn)) return;
      const existingComp = componentByPartNo.get(cleanPn);
      if (!existingComp) {
        const newComp: Component = {
          id: `CMP-AUTO-${cleanPn.replace(/[^A-Z0-9]/g, '').slice(-8)}-${idx + 1}`,
          partNumber: cleanPn,
          description: (pt.description || d.drawingTitle || cleanPn).trim(),
          category: (pt.designation || 'OTHER').trim(),
          machineTypes: ['DIVIDER'],
          criticalComponent: true,
          defaultDrawingNumber: d.drawingNumber,
          currentDrawingRevision: d.revision,
          drawingNumber: d.drawingNumber,
          materialSpecification: (pt.material || 'As per Drawing').trim(),
          traceabilityRequired: true,
          permanentIdRequired: true,
          active: true,
          createdDate: d.effectiveDate || new Date().toISOString().split('T')[0],
          projectNumbers: [...(d.projectNumbers || [])],
          machineSerialNumbers: [...(d.machineSerialNumbers || [])],
          quantityPerAssembly: pt.quantity || '1',
          notes: `Cross-populated from Drawing ${d.drawingNumber} Rev ${d.revision}`,
        };
        components.push(newComp);
        componentByPartNo.set(cleanPn, newComp);
      } else {
        if (!existingComp.defaultDrawingNumber) {
          existingComp.defaultDrawingNumber = d.drawingNumber;
          existingComp.drawingNumber = d.drawingNumber;
        }
        if (
          d.isCurrent &&
          norm(existingComp.defaultDrawingNumber) === d.drawingNumber
        ) {
          existingComp.currentDrawingRevision = d.revision;
        }
        if (
          (!existingComp.materialSpecification ||
            existingComp.materialSpecification === 'As per Drawing') &&
          pt.material
        ) {
          existingComp.materialSpecification = pt.material;
        }
        if (!existingComp.quantityPerAssembly && pt.quantity) {
          existingComp.quantityPerAssembly = pt.quantity;
        }
      }
    });
  });

  // Ensure every Component's defaultDrawingNumber exists in Drawings and includes the Component in its partsList
  components.forEach((c) => {
    const dwgNo = norm(c.defaultDrawingNumber || c.drawingNumber);
    if (!dwgNo || isDrawingDeleted(undefined, dwgNo)) return;
    const matchingDrawings = drawings.filter((d) => norm(d.drawingNumber) === dwgNo);
    if (matchingDrawings.length > 0) {
      matchingDrawings.forEach((d) => {
        if (
          deletedSet.has(`DRAWING_BOM_CLEARED:${d.drawingNumber}`) ||
          deletedSet.has(`DRAWING_PART:${d.drawingNumber}::${c.partNumber}`)
        ) {
          return;
        }
        const currentParts = extractPartsFromDrawing(d);
        const alreadyInList = currentParts.some((pt) => norm(pt.partNumber) === c.partNumber);
        if (!alreadyInList) {
          currentParts.push({
            id: `${d.id}-PT-${currentParts.length + 1}`,
            itemNumber: String(currentParts.length + 1),
            quantity: c.quantityPerAssembly || '1',
            partNumber: c.partNumber,
            description: c.description,
            material: c.materialSpecification || 'As per Drawing',
            designation: String(c.category || 'MANUF-INT'),
            orderNumber: '',
            vendor: '',
          });
          d.partsList = currentParts;
          d.partNumbers = currentParts.map((pt) => norm(pt.partNumber));
          d.partNumber = d.partNumbers.join('; ');
        }
      });
    } else {
      // Auto-create Drawing record if a Component references a Drawing Number not yet in db.drawings
      const newDwg: Drawing = {
        id: `DWG-AUTO-${dwgNo.replace(/[^A-Z0-9]/g, '').slice(-8)}`,
        drawingNumber: dwgNo,
        drawingTitle: `${c.description} — Production Drawing`,
        partNumber: c.partNumber,
        partNumbers: [c.partNumber],
        partsList: [
          {
            id: `PT-AUTO-1`,
            itemNumber: '1',
            quantity: c.quantityPerAssembly || '1',
            partNumber: c.partNumber,
            description: c.description,
            material: c.materialSpecification || 'As per Drawing',
            designation: String(c.category || 'MANUF-INT'),
          },
        ],
        revision: c.currentDrawingRevision || 'A',
        drawingStatus: 'APPROVED',
        approvedBy: 'Dr. Elena Rostova',
        approvedById: 'USR-004',
        approvalDate: (c.createdDate || new Date().toISOString()).split('T')[0],
        effectiveDate: (c.createdDate || new Date().toISOString()).split('T')[0],
        revisionNotes: 'Auto-linked from Component Master registration.',
        projectNumbers: [...(c.projectNumbers || [])],
        machineSerialNumbers: [...(c.machineSerialNumbers || [])],
        isCurrent: true,
      };
      drawings.push(newDwg);
    }
  });

  // 4. Cross-link Projects <-> Drawings <-> Components <-> Machines <-> Manufacturing Records
  // First link from ManufacturingRecords (hard evidence of allocation)
  db.manufacturingRecords.forEach((mr) => {
    const pNum = norm(mr.projectNumber);
    const mSn = norm(mr.machineSerialNumber);
    const dwgNo = norm(mr.drawingNumber);
    const partNo = norm(mr.partNumber);

    const proj = projectByNumber.get(pNum);
    if (proj) {
      if (mSn && !proj.associatedSerialNumbers.includes(mSn)) {
        proj.associatedSerialNumbers.push(mSn);
        proj.machineSerialNumbers.push(mSn);
      }
      if (dwgNo && !proj.allocatedDrawingNumbers?.includes(dwgNo)) {
        proj.allocatedDrawingNumbers = [...(proj.allocatedDrawingNumbers || []), dwgNo];
      }
      if (partNo && !proj.allocatedPartNumbers?.includes(partNo)) {
        proj.allocatedPartNumbers = [...(proj.allocatedPartNumbers || []), partNo];
      }
    }

    const mach = machineBySerial.get(mSn);
    if (mach) {
      if (dwgNo && !mach.allocatedDrawingNumbers?.includes(dwgNo)) {
        mach.allocatedDrawingNumbers = [...(mach.allocatedDrawingNumbers || []), dwgNo];
      }
      if (partNo && !mach.allocatedPartNumbers?.includes(partNo)) {
        mach.allocatedPartNumbers = [...(mach.allocatedPartNumbers || []), partNo];
      }
    }
  });

  // Next, link Drawings <-> Projects by explicit reference, prefix, or machineType of its parts
  projects.forEach((proj) => {
    const pNum = norm(proj.projectNumber);
    const projMachines = machines.filter(
      (m) => norm(m.projectNumber) === pNum || proj.associatedSerialNumbers.includes(norm(m.serialNumber))
    );
    const projMachineTypes = new Set(
      [proj.machineType, ...projMachines.map((m) => m.machineType)].map(norm).filter(Boolean)
    );

    drawings.forEach((d) => {
      const dParts = extractPartsFromDrawing(d);
      const dCompTypes = new Set<string>();
      dParts.forEach((pt) => {
        const comp = componentByPartNo.get(norm(pt.partNumber));
        if (comp) {
          (comp.machineTypes || []).forEach((mt) => dCompTypes.add(norm(mt)));
        }
      });

      const directMatch = doesDrawingMatchProject(d, proj);
      // If drawing has no explicit project tied to another unrelated project, and its components match this project's machineType
      const hasOtherExplicitProject =
        Boolean(d.projectReference && d.projectReference.trim()) && !directMatch;
      const matchesByMachineType =
        !hasOtherExplicitProject &&
        Array.from(projMachineTypes).some((mt) => dCompTypes.has(mt));

      if (directMatch || matchesByMachineType) {
        if (!proj.allocatedDrawingNumbers?.includes(d.drawingNumber)) {
          proj.allocatedDrawingNumbers = [...(proj.allocatedDrawingNumbers || []), d.drawingNumber];
        }
        if (!d.projectNumbers?.includes(pNum)) {
          d.projectNumbers = [...(d.projectNumbers || []), pNum];
        }
        if (!d.projectReference) {
          d.projectReference = `${proj.projectNumber} — ${proj.projectName}`;
        }
        projMachines.forEach((m) => {
          if (!d.machineSerialNumbers?.includes(m.serialNumber)) {
            d.machineSerialNumbers = [...(d.machineSerialNumbers || []), m.serialNumber];
          }
          if (!m.allocatedDrawingNumbers?.includes(d.drawingNumber)) {
            m.allocatedDrawingNumbers = [...(m.allocatedDrawingNumbers || []), d.drawingNumber];
          }
        });

        // Also allocate all parts on this drawing to the project & its machines
        dParts.forEach((pt) => {
          const cleanPn = norm(pt.partNumber);
          if (!cleanPn) return;
          if (!proj.allocatedPartNumbers?.includes(cleanPn)) {
            proj.allocatedPartNumbers = [...(proj.allocatedPartNumbers || []), cleanPn];
          }
          projMachines.forEach((m) => {
            if (!m.allocatedPartNumbers?.includes(cleanPn)) {
              m.allocatedPartNumbers = [...(m.allocatedPartNumbers || []), cleanPn];
            }
          });
          const comp = componentByPartNo.get(cleanPn);
          if (comp) {
            if (!comp.projectNumbers?.includes(pNum)) {
              comp.projectNumbers = [...(comp.projectNumbers || []), pNum];
            }
            projMachines.forEach((m) => {
              if (!comp.machineSerialNumbers?.includes(m.serialNumber)) {
                comp.machineSerialNumbers = [...(comp.machineSerialNumbers || []), m.serialNumber];
              }
            });
          }
        });
      }
    });
  });

  // Finally, if a Project has allocatedPartNumbers, ensure their parent drawings are also in allocatedDrawingNumbers
  projects.forEach((proj) => {
    const pNum = norm(proj.projectNumber);
    (proj.allocatedPartNumbers || []).forEach((partNo) => {
      const comp = componentByPartNo.get(norm(partNo));
      if (comp) {
        if (!comp.projectNumbers?.includes(pNum)) {
          comp.projectNumbers = [...(comp.projectNumbers || []), pNum];
        }
        const dwgNo = norm(comp.defaultDrawingNumber || comp.drawingNumber);
        if (dwgNo && !proj.allocatedDrawingNumbers?.includes(dwgNo)) {
          proj.allocatedDrawingNumbers = [...(proj.allocatedDrawingNumbers || []), dwgNo];
        }
      }
    });
  });

  return {
    ...db,
    projects,
    machines,
    components,
    drawings,
  };
}

/**
 * Resolve all Cross-References for a specific Project
 */
export function getProjectCrossReferences(
  db: QMSDatabase,
  project: Project
): ProjectCrossReferences {
  const pNum = norm(project.projectNumber);

  // 1. Machines allocated to this project
  const machines = db.machines.filter(
    (m) =>
      norm(m.projectNumber) === pNum ||
      (project.associatedSerialNumbers || []).some((sn) => norm(sn) === norm(m.serialNumber)) ||
      (project.machineSerialNumbers || []).some((sn) => norm(sn) === norm(m.serialNumber))
  );
  const machineSerials = new Set(machines.map((m) => norm(m.serialNumber)));

  // 2. Manufacturing records for this project or its machines
  const manufacturingRecords = db.manufacturingRecords.filter(
    (r) => norm(r.projectNumber) === pNum || machineSerials.has(norm(r.machineSerialNumber))
  );

  // 3. Drawings allocated to this project
  const mfgDrawingNumbers = new Set(manufacturingRecords.map((r) => norm(r.drawingNumber)));
  const explicitDrawingNumbers = new Set((project.allocatedDrawingNumbers || []).map(norm));

  const drawings = db.drawings.filter((d) => {
    const dNo = norm(d.drawingNumber);
    if (explicitDrawingNumbers.has(dNo)) return true;
    if (mfgDrawingNumbers.has(dNo)) return true;
    if (doesDrawingMatchProject(d, project)) return true;
    if ((d.machineSerialNumbers || []).some((sn) => machineSerials.has(norm(sn)))) return true;
    return false;
  });

  // Prefer current revisions when building the unique Parts allocation list
  const currentDrawings = drawings.filter((d) => d.isCurrent);
  const activeDrawingsToInspect = currentDrawings.length > 0 ? currentDrawings : drawings;

  // 4. Parts / Components allocated to this project
  const partsMap = new Map<string, AllocatedPartDetail>();

  // From allocated drawings' BOM partsList
  activeDrawingsToInspect.forEach((d) => {
    const dParts = extractPartsFromDrawing(d);
    dParts.forEach((pt) => {
      const cleanPn = norm(pt.partNumber);
      if (!cleanPn) return;
      const comp = db.components.find((c) => norm(c.partNumber) === cleanPn);
      if (!partsMap.has(cleanPn)) {
        partsMap.set(cleanPn, {
          partNumber: cleanPn,
          description: pt.description || comp?.description || d.drawingTitle,
          drawingNumber: d.drawingNumber,
          revision: d.revision,
          material: pt.material || comp?.materialSpecification || 'As per Drawing',
          designation: pt.designation || String(comp?.category || 'MANUF-INT'),
          quantity: pt.quantity || comp?.quantityPerAssembly || '1',
          criticalComponent: comp ? comp.criticalComponent : true,
          component: comp,
          drawingPart: pt,
          drawing: d,
        });
      }
    });
  });

  // From explicit project.allocatedPartNumbers or component.projectNumbers
  db.components.forEach((comp) => {
    const cleanPn = norm(comp.partNumber);
    const isExplicit =
      (project.allocatedPartNumbers || []).some((pn) => norm(pn) === cleanPn) ||
      (comp.projectNumbers || []).some((pn) => norm(pn) === pNum) ||
      manufacturingRecords.some((r) => norm(r.partNumber) === cleanPn);

    if (isExplicit && !partsMap.has(cleanPn)) {
      const parentDwg =
        db.drawings.find(
          (d) => d.isCurrent && norm(d.drawingNumber) === norm(comp.defaultDrawingNumber)
        ) ||
        db.drawings.find((d) => norm(d.drawingNumber) === norm(comp.defaultDrawingNumber));

      partsMap.set(cleanPn, {
        partNumber: cleanPn,
        description: comp.description,
        drawingNumber: comp.defaultDrawingNumber || comp.drawingNumber || '—',
        revision: parentDwg?.revision || comp.currentDrawingRevision || '0',
        material: comp.materialSpecification || 'As per Drawing',
        designation: String(comp.category || 'MANUF-INT'),
        quantity: comp.quantityPerAssembly || '1',
        criticalComponent: comp.criticalComponent,
        component: comp,
        drawing: parentDwg,
      });
    }
  });

  return {
    project,
    machines,
    drawings,
    parts: Array.from(partsMap.values()),
    manufacturingRecords,
  };
}

/**
 * Resolve all Cross-References for a specific Machine
 */
export function getMachineCrossReferences(
  db: QMSDatabase,
  machine: Machine
): MachineCrossReferences {
  const mSn = norm(machine.serialNumber);
  const pNum = norm(machine.projectNumber);

  const project = db.projects.find(
    (p) =>
      norm(p.projectNumber) === pNum ||
      (p.associatedSerialNumbers || []).some((sn) => norm(sn) === mSn)
  );

  const manufacturingRecords = db.manufacturingRecords.filter(
    (r) => norm(r.machineSerialNumber) === mSn
  );

  const projRefs = project ? getProjectCrossReferences(db, project) : null;

  const mfgDwgNos = new Set(manufacturingRecords.map((r) => norm(r.drawingNumber)));
  const explicitDwgNos = new Set((machine.allocatedDrawingNumbers || []).map(norm));

  const drawings = db.drawings.filter((d) => {
    const dNo = norm(d.drawingNumber);
    if (explicitDwgNos.has(dNo) || mfgDwgNos.has(dNo)) return true;
    if ((d.machineSerialNumbers || []).some((sn) => norm(sn) === mSn)) return true;
    if (projRefs && projRefs.drawings.some((pd) => pd.id === d.id)) return true;
    return false;
  });

  const partsMap = new Map<string, AllocatedPartDetail>();
  if (projRefs) {
    projRefs.parts.forEach((pt) => partsMap.set(norm(pt.partNumber), pt));
  }

  manufacturingRecords.forEach((r) => {
    const cleanPn = norm(r.partNumber);
    if (!partsMap.has(cleanPn)) {
      const comp = db.components.find((c) => norm(c.partNumber) === cleanPn);
      const dwg = db.drawings.find((d) => norm(d.drawingNumber) === norm(r.drawingNumber));
      partsMap.set(cleanPn, {
        partNumber: cleanPn,
        description: r.componentDescription || comp?.description || '',
        drawingNumber: r.drawingNumber,
        revision: r.drawingRevision,
        material: comp?.materialSpecification || r.batchMaterialRef || '',
        designation: String(comp?.category || 'MANUF-INT'),
        quantity: String(r.quantity),
        criticalComponent: comp ? comp.criticalComponent : true,
        component: comp,
        drawing: dwg,
      });
    }
  });

  return {
    machine,
    project,
    drawings,
    parts: Array.from(partsMap.values()),
    manufacturingRecords,
  };
}

/**
 * Resolve all Cross-References for a specific Component (Part)
 */
export function getComponentCrossReferences(
  db: QMSDatabase,
  component: Component
): ComponentCrossReferences {
  const cPn = norm(component.partNumber);
  const cDwg = norm(component.defaultDrawingNumber || component.drawingNumber);

  const drawings = db.drawings.filter((d) => {
    if (norm(d.drawingNumber) === cDwg) return true;
    const dParts = extractPartsFromDrawing(d);
    return dParts.some((pt) => norm(pt.partNumber) === cPn);
  });

  const drawingNumbers = new Set(drawings.map((d) => norm(d.drawingNumber)));

  const manufacturingRecords = db.manufacturingRecords.filter(
    (r) => norm(r.partNumber) === cPn
  );

  const projects = db.projects.filter((p) => {
    const pNum = norm(p.projectNumber);
    if ((component.projectNumbers || []).some((pn) => norm(pn) === pNum)) return true;
    if ((p.allocatedPartNumbers || []).some((pn) => norm(pn) === cPn)) return true;
    if ((p.allocatedDrawingNumbers || []).some((dn) => drawingNumbers.has(norm(dn)))) return true;
    if (drawings.some((d) => doesDrawingMatchProject(d, p))) return true;
    if (manufacturingRecords.some((r) => norm(r.projectNumber) === pNum)) return true;
    return false;
  });

  const projectNumbers = new Set(projects.map((p) => norm(p.projectNumber)));

  const machines = db.machines.filter((m) => {
    const mSn = norm(m.serialNumber);
    if ((component.machineSerialNumbers || []).some((sn) => norm(sn) === mSn)) return true;
    if ((m.allocatedPartNumbers || []).some((pn) => norm(pn) === cPn)) return true;
    if (projectNumbers.has(norm(m.projectNumber))) return true;
    if (manufacturingRecords.some((r) => norm(r.machineSerialNumber) === mSn)) return true;
    return false;
  });

  return {
    component,
    drawings,
    projects,
    machines,
    manufacturingRecords,
  };
}

/**
 * Resolve all Cross-References for a specific Drawing
 */
export function getDrawingCrossReferences(
  db: QMSDatabase,
  drawing: Drawing
): DrawingCrossReferences {
  const dNo = norm(drawing.drawingNumber);
  const partsList = extractPartsFromDrawing(drawing);
  const partNumbersSet = new Set(partsList.map((pt) => norm(pt.partNumber)));

  const components = db.components.filter(
    (c) =>
      partNumbersSet.has(norm(c.partNumber)) ||
      norm(c.defaultDrawingNumber || c.drawingNumber) === dNo
  );

  const manufacturingRecords = db.manufacturingRecords.filter(
    (r) => norm(r.drawingNumber) === dNo || partNumbersSet.has(norm(r.partNumber))
  );

  const projects = db.projects.filter((p) => {
    const pNum = norm(p.projectNumber);
    if (doesDrawingMatchProject(drawing, p)) return true;
    if ((p.allocatedDrawingNumbers || []).some((dn) => norm(dn) === dNo)) return true;
    if (manufacturingRecords.some((r) => norm(r.projectNumber) === pNum)) return true;
    if (components.some((c) => (c.projectNumbers || []).some((pn) => norm(pn) === pNum))) {
      return true;
    }
    return false;
  });

  const projectNumbers = new Set(projects.map((p) => norm(p.projectNumber)));

  const machines = db.machines.filter((m) => {
    const mSn = norm(m.serialNumber);
    if ((drawing.machineSerialNumbers || []).some((sn) => norm(sn) === mSn)) return true;
    if ((m.allocatedDrawingNumbers || []).some((dn) => norm(dn) === dNo)) return true;
    if (projectNumbers.has(norm(m.projectNumber))) return true;
    if (manufacturingRecords.some((r) => norm(r.machineSerialNumber) === mSn)) return true;
    return false;
  });

  return {
    drawing,
    projects,
    machines,
    components,
    partsList,
    manufacturingRecords,
  };
}

/**
 * Non-destructively merges multiple QMSDatabase snapshots (e.g. server DB, browser IndexedDB/localStorage DB,
 * and INITIAL_DATABASE seed updates) so that:
 * 1. User login profiles and custom accounts are NEVER lost.
 * 2. Past data (machines, projects, parts, drawings, BOM lists, manufacturing records, inspections, NCRs,
 *    deviations, releases, attachments, audit logs) is NEVER lost across app updates or GitHub pushes.
 * 3. Newly introduced seed records from code updates interface seamlessly with existing data.
 */
export function mergeQMSDatabases(
  dbA?: Partial<QMSDatabase> | null,
  dbB?: Partial<QMSDatabase> | null,
  seedDb?: Partial<QMSDatabase> | null
): QMSDatabase {
  const timeA = dbA?.lastUpdated ? new Date(dbA.lastUpdated).getTime() : 0;
  const timeB = dbB?.lastUpdated ? new Date(dbB.lastUpdated).getTime() : 0;
  const countA =
    (dbA?.machines?.length || 0) +
    (dbA?.projects?.length || 0) +
    (dbA?.components?.length || 0) +
    (dbA?.drawings?.length || 0) +
    (dbA?.manufacturingRecords?.length || 0) +
    (dbA?.users?.length || 0);
  const countB =
    (dbB?.machines?.length || 0) +
    (dbB?.projects?.length || 0) +
    (dbB?.components?.length || 0) +
    (dbB?.drawings?.length || 0) +
    (dbB?.manufacturingRecords?.length || 0) +
    (dbB?.users?.length || 0);

  // Determine which snapshot has the newer edits while preserving all unique records from both
  const primary = timeA >= timeB ? dbA : dbB;
  const secondary = primary === dbA ? dbB : dbA;

  const uniqStr = (arrA?: string[], arrB?: string[]): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of [...(arrA || []), ...(arrB || [])]) {
      const clean = (item || '').trim();
      if (!clean) continue;
      const k = clean.toUpperCase();
      if (!seen.has(k)) {
        seen.add(k);
        out.push(clean);
      }
    }
    return out;
  };

  // Combine deletedRecordKeys from both snapshots, removing any key that was explicitly re-added in the newer primary DB
  const primaryActiveKeys = new Set<string>();
  if (timeA !== timeB && primary) {
    (primary.users || []).forEach((u) => {
      if (u?.id) primaryActiveKeys.add(`USER:${norm(u.id)}`);
      if (u?.username) primaryActiveKeys.add(`USER:${norm(u.username)}`);
    });
    (primary.projects || []).forEach((p) => {
      if (p?.id) primaryActiveKeys.add(`PROJECT:${norm(p.id)}`);
      if (p?.projectNumber) primaryActiveKeys.add(`PROJECT:${norm(p.projectNumber)}`);
      primaryActiveKeys.add('LIST_CLEARED:PROJECTS');
    });
    (primary.machines || []).forEach((m) => {
      if (m?.id) primaryActiveKeys.add(`MACHINE:${norm(m.id)}`);
      if (m?.serialNumber) primaryActiveKeys.add(`MACHINE:${norm(m.serialNumber)}`);
      primaryActiveKeys.add('LIST_CLEARED:MACHINES');
    });
    (primary.components || []).forEach((c) => {
      if (c?.id) primaryActiveKeys.add(`COMPONENT:${norm(c.id)}`);
      if (c?.partNumber) primaryActiveKeys.add(`COMPONENT:${norm(c.partNumber)}`);
      primaryActiveKeys.add('LIST_CLEARED:COMPONENTS');
    });
    (primary.drawings || []).forEach((d) => {
      if (d?.id) primaryActiveKeys.add(`DRAWING:${norm(d.id)}`);
      if (d?.drawingNumber) {
        primaryActiveKeys.add(`DRAWING:${norm(d.drawingNumber)}`);
        primaryActiveKeys.add(`DRAWING:${norm(d.drawingNumber)}::${norm(d.revision || '0')}`);
      }
      primaryActiveKeys.add('LIST_CLEARED:DRAWINGS');
    });
    (primary.manufacturingRecords || []).forEach((r) => {
      if (r?.id) primaryActiveKeys.add(`MFG:${norm(r.id)}`);
      if (r?.traceabilityNumber) primaryActiveKeys.add(`MFG:${norm(r.traceabilityNumber)}`);
      primaryActiveKeys.add('LIST_CLEARED:MFG');
    });
    (primary.inspections || []).forEach((i) => {
      if (i?.id) primaryActiveKeys.add(`INSP:${norm(i.id)}`);
      primaryActiveKeys.add('LIST_CLEARED:INSPECTIONS');
    });
    (primary.ncrs || []).forEach((n) => {
      if (n?.id) primaryActiveKeys.add(`NCR:${norm(n.id)}`);
      if (n?.ncrNumber) primaryActiveKeys.add(`NCR:${norm(n.ncrNumber)}`);
      primaryActiveKeys.add('LIST_CLEARED:NCRS');
    });
    (primary.deviations || []).forEach((dv) => {
      if (dv?.id) primaryActiveKeys.add(`DEV:${norm(dv.id)}`);
      if (dv?.deviationNumber) primaryActiveKeys.add(`DEV:${norm(dv.deviationNumber)}`);
      primaryActiveKeys.add('LIST_CLEARED:DEVIATIONS');
    });
    (primary.releases || []).forEach((rl) => {
      if (rl?.id) primaryActiveKeys.add(`REL:${norm(rl.id)}`);
      if (rl?.releaseId) primaryActiveKeys.add(`REL:${norm(rl.releaseId)}`);
      primaryActiveKeys.add('LIST_CLEARED:RELEASES');
    });
  }

  const primaryDelSet = new Set((primary?.deletedRecordKeys || []).map(norm));
  const combinedDeletedKeys = uniqStr(primary?.deletedRecordKeys, secondary?.deletedRecordKeys).filter(
    (k) => {
      const nk = norm(k);
      if (primaryDelSet.has(nk)) return true;
      return !primaryActiveKeys.has(nk);
    }
  );
  const deletedSet = new Set(combinedDeletedKeys.map(norm));

  const sources = [primary, secondary, seedDb].filter(Boolean) as Partial<QMSDatabase>[];

  // 1. Merge Users (by id, username, or email)
  const users: QMSDatabase['users'] = [];
  const seenUserIds = new Set<string>();
  const seenUsernames = new Set<string>();
  const seenEmails = new Set<string>();
  for (const src of sources) {
    for (const u of src.users || []) {
      if (!u || !u.username) continue;
      const uid = norm(u.id);
      const uname = norm(u.username);
      const uemail = norm(u.email);
      if (deletedSet.has(`USER:${uid}`) || deletedSet.has(`USER:${uname}`)) continue;
      if (seenUserIds.has(uid) || seenUsernames.has(uname) || (uemail && seenEmails.has(uemail))) {
        continue;
      }
      seenUserIds.add(uid);
      seenUsernames.add(uname);
      if (uemail) seenEmails.add(uemail);
      users.push({ ...u });
    }
  }

  // 2. Merge Machines (by serialNumber or id)
  const machines: QMSDatabase['machines'] = [];
  const machineBySn = new Map<string, QMSDatabase['machines'][number]>();
  if (!deletedSet.has('LIST_CLEARED:MACHINES')) {
    for (const src of sources) {
      for (const m of src.machines || []) {
        if (!m || !m.serialNumber) continue;
        const snKey = norm(m.serialNumber);
        if (deletedSet.has(`MACHINE:${norm(m.id)}`) || deletedSet.has(`MACHINE:${snKey}`)) continue;
        const existing = machineBySn.get(snKey);
        if (!existing) {
          const cloned = {
            ...m,
            allocatedDrawingNumbers: [...(m.allocatedDrawingNumbers || [])],
            allocatedPartNumbers: [...(m.allocatedPartNumbers || [])],
          };
          machineBySn.set(snKey, cloned);
          machines.push(cloned);
        } else {
          existing.allocatedDrawingNumbers = uniqStr(
            existing.allocatedDrawingNumbers,
            m.allocatedDrawingNumbers
          );
          existing.allocatedPartNumbers = uniqStr(
            existing.allocatedPartNumbers,
            m.allocatedPartNumbers
          );
          if (!existing.notes && m.notes) existing.notes = m.notes;
        }
      }
    }
  }

  // 3. Merge Projects (by projectNumber or id)
  const projects: QMSDatabase['projects'] = [];
  const projectByNum = new Map<string, QMSDatabase['projects'][number]>();
  if (!deletedSet.has('LIST_CLEARED:PROJECTS')) {
    for (const src of sources) {
      for (const p of src.projects || []) {
        if (!p || !p.projectNumber) continue;
        const pKey = norm(p.projectNumber);
        if (deletedSet.has(`PROJECT:${norm(p.id)}`) || deletedSet.has(`PROJECT:${pKey}`)) continue;
        const existing = projectByNum.get(pKey);
        if (!existing) {
          const mergedSerials = uniqStr(p.associatedSerialNumbers, p.machineSerialNumbers);
          const cloned = {
            ...p,
            associatedSerialNumbers: mergedSerials,
            machineSerialNumbers: [...mergedSerials],
            allocatedDrawingNumbers: [...(p.allocatedDrawingNumbers || [])],
            allocatedPartNumbers: [...(p.allocatedPartNumbers || [])],
          };
          projectByNum.set(pKey, cloned);
          projects.push(cloned);
        } else {
          const mergedSerials = uniqStr(
            uniqStr(existing.associatedSerialNumbers, existing.machineSerialNumbers),
            uniqStr(p.associatedSerialNumbers, p.machineSerialNumbers)
          );
          existing.associatedSerialNumbers = mergedSerials;
          existing.machineSerialNumbers = [...mergedSerials];
          existing.allocatedDrawingNumbers = uniqStr(
            existing.allocatedDrawingNumbers,
            p.allocatedDrawingNumbers
          );
          existing.allocatedPartNumbers = uniqStr(
            existing.allocatedPartNumbers,
            p.allocatedPartNumbers
          );
          if (!existing.notes && p.notes) existing.notes = p.notes;
        }
      }
    }
  }

  // 4. Merge Components (by partNumber or id)
  const components: QMSDatabase['components'] = [];
  const compByPart = new Map<string, QMSDatabase['components'][number]>();
  if (!deletedSet.has('LIST_CLEARED:COMPONENTS')) {
    for (const src of sources) {
      for (const c of src.components || []) {
        if (!c || !c.partNumber) continue;
        const cKey = norm(c.partNumber);
        if (deletedSet.has(`COMPONENT:${norm(c.id)}`) || deletedSet.has(`COMPONENT:${cKey}`)) continue;
        const existing = compByPart.get(cKey);
        if (!existing) {
          const cloned = {
            ...c,
            machineTypes: [...(c.machineTypes || [])],
            projectNumbers: [...(c.projectNumbers || [])],
            machineSerialNumbers: [...(c.machineSerialNumbers || [])],
          };
          compByPart.set(cKey, cloned);
          components.push(cloned);
        } else {
          existing.machineTypes = uniqStr(existing.machineTypes, c.machineTypes);
          existing.projectNumbers = uniqStr(existing.projectNumbers, c.projectNumbers);
          existing.machineSerialNumbers = uniqStr(
            existing.machineSerialNumbers,
            c.machineSerialNumbers
          );
          if (!existing.notes && c.notes) existing.notes = c.notes;
        }
      }
    }
  }

  // 5. Merge Drawings (by drawingNumber + revision)
  const drawings: QMSDatabase['drawings'] = [];
  const dwgByKey = new Map<string, QMSDatabase['drawings'][number]>();
  if (!deletedSet.has('LIST_CLEARED:DRAWINGS')) {
    for (const src of sources) {
      for (const d of src.drawings || []) {
        if (!d || !d.drawingNumber) continue;
        const dNo = norm(d.drawingNumber);
        const dRev = norm(d.revision || '0');
        const dKey = `${dNo}::${dRev}`;
        if (
          deletedSet.has(`DRAWING:${norm(d.id)}`) ||
          deletedSet.has(`DRAWING:${dNo}`) ||
          deletedSet.has(`DRAWING:${dKey}`)
        ) {
          continue;
        }
        const existing = dwgByKey.get(dKey);
        if (!existing) {
          const cloned = {
            ...d,
            partNumbers: [...(d.partNumbers || [])],
            partsList: d.partsList ? d.partsList.map((pt) => ({ ...pt })) : undefined,
            projectNumbers: [...(d.projectNumbers || [])],
            machineSerialNumbers: [...(d.machineSerialNumbers || [])],
            revisionPhotos: d.revisionPhotos ? [...d.revisionPhotos] : undefined,
          };
          dwgByKey.set(dKey, cloned);
          drawings.push(cloned);
        } else {
          if (
            !deletedSet.has(`DRAWING_BOM_CLEARED:${dNo}`) &&
            (d.partsList?.length || 0) > (existing.partsList?.length || 0)
          ) {
            existing.partsList = d.partsList!.map((pt) => ({ ...pt }));
          }
          if (!existing.drawingFile && d.drawingFile) {
            existing.drawingFile = d.drawingFile;
            existing.fileName = existing.fileName || d.fileName;
          }
          if ((!existing.revisionPhotos || existing.revisionPhotos.length === 0) && d.revisionPhotos?.length) {
            existing.revisionPhotos = [...d.revisionPhotos];
          }
          if (existing.drawingStatus !== 'APPROVED' && d.drawingStatus === 'APPROVED') {
            existing.drawingStatus = 'APPROVED';
            existing.approvedBy = existing.approvedBy || d.approvedBy;
            existing.approvalDate = existing.approvalDate || d.approvalDate;
          }
          existing.partNumbers = uniqStr(existing.partNumbers, d.partNumbers);
          existing.projectNumbers = uniqStr(existing.projectNumbers, d.projectNumbers);
          existing.machineSerialNumbers = uniqStr(
            existing.machineSerialNumbers,
            d.machineSerialNumbers
          );
        }
      }
    }
  }

  // 6. Merge Manufacturing Records (by id or traceabilityNumber)
  const mfgStatusRank: Record<string, number> = {
    DRAFT: 1,
    IN_MANUFACTURE: 2,
    AWAITING_INSPECTION: 3,
    UNDER_INSPECTION: 4,
    HOLD: 5,
    REJECTED: 5,
    INSPECTION_PASSED: 6,
    READY_FOR_RELEASE: 6,
    RELEASED: 7,
    NCR_HOLD: 8,
  };
  const manufacturingRecords: QMSDatabase['manufacturingRecords'] = [];
  const mfgById = new Map<string, QMSDatabase['manufacturingRecords'][number]>();
  const mfgByTrace = new Map<string, QMSDatabase['manufacturingRecords'][number]>();
  if (!deletedSet.has('LIST_CLEARED:MFG')) {
    for (const src of sources) {
      for (const r of src.manufacturingRecords || []) {
        if (!r || !r.traceabilityNumber) continue;
        const idKey = norm(r.id);
        const trKey = norm(r.traceabilityNumber);
        if (deletedSet.has(`MFG:${idKey}`) || deletedSet.has(`MFG:${trKey}`)) continue;
        const existing = mfgById.get(idKey) || mfgByTrace.get(trKey);
        if (!existing) {
          const cloned = { ...r };
          mfgById.set(idKey, cloned);
          mfgByTrace.set(trKey, cloned);
          manufacturingRecords.push(cloned);
        } else {
          if (!existing.permanentIdCompleted && r.permanentIdCompleted) {
            existing.permanentIdCompleted = true;
            existing.permanentIdMethod = r.permanentIdMethod;
            existing.permanentIdReference = r.permanentIdReference;
            existing.permanentIdDate = r.permanentIdDate;
            existing.permanentIdBy = r.permanentIdBy;
            existing.permanentIdById = r.permanentIdById;
          }
          if (
            (mfgStatusRank[r.manufacturingStatus] || 0) >
            (mfgStatusRank[existing.manufacturingStatus] || 0)
          ) {
            existing.manufacturingStatus = r.manufacturingStatus;
          }
        }
      }
    }
  }

  // 7. Merge Inspections (by id, keeping newer updatedAt or signed-off state)
  const inspections: QMSDatabase['inspections'] = [];
  const inspById = new Map<string, QMSDatabase['inspections'][number]>();
  if (!deletedSet.has('LIST_CLEARED:INSPECTIONS')) {
    for (const src of sources) {
      for (const i of src.inspections || []) {
        if (!i || !i.id) continue;
        const k = norm(i.id);
        if (deletedSet.has(`INSP:${k}`)) continue;
        const existing = inspById.get(k);
        if (!existing) {
          const cloned = { ...i };
          inspById.set(k, cloned);
          inspections.push(cloned);
        } else {
          const tExist = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
          const tNew = i.updatedAt ? new Date(i.updatedAt).getTime() : 0;
          if (
            tNew > tExist ||
            (!existing.inspectorSignOff?.confirmed && i.inspectorSignOff?.confirmed)
          ) {
            Object.assign(existing, i);
          }
        }
      }
    }
  }

  // 7.1 Merge Dale Manufacturing Quality Inspections (by id)
  const daleInspections: NonNullable<QMSDatabase['daleInspections']> = [];
  const daleById = new Map<string, any>();
  for (const src of sources) {
    for (const d of src.daleInspections || []) {
      if (!d || !d.id) continue;
      const k = norm(d.id);
      if (deletedSet.has(`DALE_INSP:${k}`)) continue;
      const existing = daleById.get(k);
      if (!existing) {
        const cloned = { ...d, points: (d.points || []).map((pt: any) => ({ ...pt })) };
        daleById.set(k, cloned);
        daleInspections.push(cloned);
      } else {
        const tExist = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
        const tNew = d.updatedAt ? new Date(d.updatedAt).getTime() : 0;

        if (tNew > tExist) {
          existing.approvalStatus = d.approvalStatus || existing.approvalStatus;
          existing.comments = d.comments !== undefined ? d.comments : existing.comments;
          existing.correctiveAction = d.correctiveAction !== undefined ? d.correctiveAction : existing.correctiveAction;
          existing.approvedBy = d.approvedBy || existing.approvedBy;
          existing.approvalDate = d.approvalDate || existing.approvalDate;
          existing.signatureRole = d.signatureRole || existing.signatureRole;
          existing.ncrReference = d.ncrReference || existing.ncrReference;
          if (d.updatedAt) existing.updatedAt = d.updatedAt;
        }

        // Point-level merge: ensure user's evaluations (FAIL, NA, PASS, measurements) are preserved!
        if (Array.isArray(d.points) && Array.isArray(existing.points)) {
          existing.points = existing.points.map((exPt: any) => {
            const matchedInNew = d.points.find(
              (p: any) => p.id === exPt.id || p.pointNumber === exPt.pointNumber
            );
            if (!matchedInNew) return exPt;

            if (tNew > tExist) {
              return { ...exPt, ...matchedInNew };
            }

            // If existing point has no evaluation yet (null or undefined), adopt incoming evaluation
            if ((exPt.result === undefined || exPt.result === null) && matchedInNew.result !== undefined && matchedInNew.result !== null) {
              return { ...exPt, result: matchedInNew.result };
            }

            // Merge comments, measurements, or evidence only if existing does not have them
            return {
              ...exPt,
              measurementValue: exPt.measurementValue || matchedInNew.measurementValue || '',
              comment: exPt.comment || matchedInNew.comment || '',
              deviationNotes: exPt.deviationNotes || matchedInNew.deviationNotes || '',
              ncrReference: exPt.ncrReference || matchedInNew.ncrReference,
              photos: exPt.photos && exPt.photos.length > 0 ? exPt.photos : matchedInNew.photos || [],
            };
          });
        }

        if (d.ncrReference && d.ncrReference !== 'None' && (!existing.ncrReference || existing.ncrReference === 'None')) {
          existing.ncrReference = d.ncrReference;
        }
      }
    }
  }

  // Enforce Open-Ended Inspection Rule: Points without an active evaluation default to null (no value) or NA.
  // If any point is FAIL, approvalStatus must be FAIL.
  for (const sheet of daleInspections) {
    if (Array.isArray(sheet.points)) {
      sheet.points = sheet.points.map((pt: any) => {
        if (pt.result === undefined) return { ...pt, result: null };
        if (pt.result === 'PENDING') return { ...pt, result: null };
        return pt;
      });

      const hasFail = sheet.points.some((pt: any) => pt.result === 'FAIL');
      const allEvaluated = sheet.points.every((pt: any) => pt.result === 'PASS' || pt.result === 'NA');
      if (hasFail) {
        sheet.approvalStatus = 'FAIL';
      } else if (!allEvaluated) {
        if (sheet.approvalStatus === 'PASS') {
          sheet.approvalStatus = 'PENDING';
        }
      }
    }
  }

  // 7.2 Merge Inspection Templates (by id or code + revision)
  const inspectionTemplates: NonNullable<QMSDatabase['inspectionTemplates']> = [];
  const tmplByKey = new Map<string, any>();
  if (!deletedSet.has('LIST_CLEARED:TEMPLATES')) {
    for (const src of sources) {
      for (const t of src.inspectionTemplates || []) {
        if (!t || (!t.id && !t.code)) continue;
        const idKey = norm(t.id || t.code);
        const codeRevKey = `${norm(t.code)}::${norm(t.revision || 'Rev 01')}`;
        if (
          deletedSet.has(`TEMPLATE:${idKey}`) ||
          deletedSet.has(`TEMPLATE:${norm(t.code)}`) ||
          deletedSet.has(`TEMPLATE:${codeRevKey}`)
        ) {
          continue;
        }
        const existing = tmplByKey.get(idKey) || tmplByKey.get(codeRevKey);
        if (!existing) {
          const cloned = {
            ...t,
            characteristics: (t.characteristics || []).map((c: any) => ({ ...c })),
            qualityChecks: (t.qualityChecks || []).map((qc: any) => ({ ...qc })),
          };
          tmplByKey.set(idKey, cloned);
          tmplByKey.set(codeRevKey, cloned);
          inspectionTemplates.push(cloned);
        } else {
          const tExist = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
          const tNew = t.updatedAt ? new Date(t.updatedAt).getTime() : 0;
          if (tNew > tExist) {
            Object.assign(existing, t);
          }
        }
      }
    }
  }

  // 8. Merge NCRs (by id or ncrNumber)
  const ncrs: QMSDatabase['ncrs'] = [];
  const ncrByKey = new Map<string, QMSDatabase['ncrs'][number]>();
  if (!deletedSet.has('LIST_CLEARED:NCRS')) {
    for (const src of sources) {
      for (const n of src.ncrs || []) {
        if (!n || !n.ncrNumber) continue;
        const idKey = norm(n.id);
        const numKey = norm(n.ncrNumber);
        if (deletedSet.has(`NCR:${idKey}`) || deletedSet.has(`NCR:${numKey}`)) continue;
        const existing = ncrByKey.get(idKey) || ncrByKey.get(numKey);
        if (!existing) {
          const cloned = { ...n };
          ncrByKey.set(idKey, cloned);
          ncrByKey.set(numKey, cloned);
          ncrs.push(cloned);
        } else {
          if (existing.status !== 'CLOSED' && n.status === 'CLOSED') {
            Object.assign(existing, n);
          }
          if ((!existing.issuePhotoEvidence || existing.issuePhotoEvidence.length === 0) && n.issuePhotoEvidence?.length) {
            existing.issuePhotoEvidence = [...n.issuePhotoEvidence];
          }
          if (
            (!existing.correctiveActionPhotoEvidence || existing.correctiveActionPhotoEvidence.length === 0) &&
            n.correctiveActionPhotoEvidence?.length
          ) {
            existing.correctiveActionPhotoEvidence = [...n.correctiveActionPhotoEvidence];
          }
        }
      }
    }
  }

  // 9. Merge Deviations (by id or deviationNumber)
  const deviations: QMSDatabase['deviations'] = [];
  const devByKey = new Map<string, QMSDatabase['deviations'][number]>();
  if (!deletedSet.has('LIST_CLEARED:DEVIATIONS')) {
    for (const src of sources) {
      for (const dv of src.deviations || []) {
        if (!dv || !dv.deviationNumber) continue;
        const idKey = norm(dv.id);
        const numKey = norm(dv.deviationNumber);
        if (deletedSet.has(`DEV:${idKey}`) || deletedSet.has(`DEV:${numKey}`)) continue;
        const existing = devByKey.get(idKey) || devByKey.get(numKey);
        if (!existing) {
          const cloned = { ...dv };
          devByKey.set(idKey, cloned);
          devByKey.set(numKey, cloned);
          deviations.push(cloned);
        } else {
          if (!existing.engineeringApproved && dv.engineeringApproved) {
            Object.assign(existing, dv);
          }
          if (!existing.redlineFile && dv.redlineFile) {
            existing.redlineFile = dv.redlineFile;
            existing.redlineAttachmentName = existing.redlineAttachmentName || dv.redlineAttachmentName;
          }
        }
      }
    }
  }

  // 10. Merge Releases (by id or releaseId)
  const releases: QMSDatabase['releases'] = [];
  const seenRelIds = new Set<string>();
  const seenRelCodes = new Set<string>();
  if (!deletedSet.has('LIST_CLEARED:RELEASES')) {
    for (const src of sources) {
      for (const rl of src.releases || []) {
        if (!rl || !rl.releaseId) continue;
        const idKey = norm(rl.id);
        const codeKey = norm(rl.releaseId);
        if (deletedSet.has(`REL:${idKey}`) || deletedSet.has(`REL:${codeKey}`)) continue;
        if (seenRelIds.has(idKey) || seenRelCodes.has(codeKey)) continue;
        seenRelIds.add(idKey);
        seenRelCodes.add(codeKey);
        releases.push({ ...rl });
      }
    }
  }

  // 10b. Merge Calibration Instruments (by instrumentId)
  const calibrationInstruments: NonNullable<QMSDatabase['calibrationInstruments']> = [];
  const seenInstrumentIds = new Set<string>();
  for (const src of sources) {
    for (const inst of src.calibrationInstruments || []) {
      if (!inst || !inst.instrumentId) continue;
      const key = norm(inst.instrumentId);
      if (seenInstrumentIds.has(key)) continue;
      seenInstrumentIds.add(key);
      calibrationInstruments.push({ ...inst });
    }
  }

  // 11. Merge Attachments (by fileId)
  const attachments: QMSDatabase['attachments'] = [];
  const seenFileIds = new Set<string>();
  for (const src of sources) {
    for (const att of src.attachments || []) {
      if (!att || !att.fileId) continue;
      const fKey = norm(att.fileId);
      if (seenFileIds.has(fKey)) continue;
      seenFileIds.add(fKey);
      attachments.push({ ...att });
    }
  }

  // 12. Merge Audit Logs (by id, sorted newest first, capped at 5000)
  const auditLogs: QMSDatabase['auditLogs'] = [];
  const seenAuditIds = new Set<string>();
  for (const src of sources) {
    for (const log of src.auditLogs || []) {
      if (!log || !log.id) continue;
      if (seenAuditIds.has(log.id)) continue;
      seenAuditIds.add(log.id);
      auditLogs.push({ ...log });
    }
  }
  auditLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // 13. Merge Settings (taking maximum counters & union of machineTypes so IDs never collide)
  const baseSettings =
    primary?.settings || secondary?.settings || seedDb?.settings || ({} as QMSDatabase['settings']);
  const maxTraceCounter = Math.max(
    dbA?.settings?.traceabilityCounter || 0,
    dbB?.settings?.traceabilityCounter || 0,
    seedDb?.settings?.traceabilityCounter || 0,
    manufacturingRecords.length + 10
  );
  const mergedMachineTypes = uniqStr(
    uniqStr(dbA?.settings?.machineTypes, dbB?.settings?.machineTypes),
    seedDb?.settings?.machineTypes || ['DIVIDER', 'ROUNDER', 'PROOFER', 'MOULDER', 'CONVEYOR']
  );

  const settings: QMSDatabase['settings'] = {
    ...baseSettings,
    companyName: baseSettings.companyName || 'Spiral Systems — Machine Building Quality Management',
    departmentName: baseSettings.departmentName || 'Machine Building & Precision Engineering',
    systemVersion: baseSettings.systemVersion || 'v2.4.0-PROD',
    strictDrawingApproval:
      baseSettings.strictDrawingApproval !== undefined ? baseSettings.strictDrawingApproval : true,
    autoGenerateTraceability:
      baseSettings.autoGenerateTraceability !== undefined
        ? baseSettings.autoGenerateTraceability
        : true,
    requirePermanentIdForCritical:
      baseSettings.requirePermanentIdForCritical !== undefined
        ? baseSettings.requirePermanentIdForCritical
        : true,
    productionMode: true,
    allowDevRoleSwitch: false,
    traceabilityCounter: maxTraceCounter,
    machineTypes: mergedMachineTypes,
  };

  const latestTimestamp =
    timeA >= timeB
      ? dbA?.lastUpdated || new Date().toISOString()
      : dbB?.lastUpdated || new Date().toISOString();

  return reconcileCrossPopulatedDatabase({
    users,
    machines,
    projects,
    components,
    drawings,
    manufacturingRecords,
    inspections,
    daleInspections,
    inspectionTemplates,
    calibrationInstruments,
    ncrs,
    deviations,
    releases,
    attachments,
    auditLogs: auditLogs.slice(0, 5000),
    settings,
    lastUpdated: latestTimestamp,
    deletedRecordKeys: combinedDeletedKeys,
  });
}
