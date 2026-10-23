import React from 'react';
import { Modal } from './Modal';
import { ManufacturingRecord } from '../types';
import { Printer, CheckCircle, ShieldAlert, Cpu, Tag } from 'lucide-react';

interface TraceabilityTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: ManufacturingRecord | null;
}

export const TraceabilityTagModal: React.FC<TraceabilityTagModalProps> = ({
  isOpen,
  onClose,
  record,
}) => {
  if (!record) return null;

  const handlePrint = () => {
    window.print();
  };

  // Generate SVG QR code pattern deterministically based on traceability number
  const renderSvgQr = (code: string) => {
    // Generate a structured SVG QR visual matrix
    const size = 120;
    const cells = 15;
    const cellSize = size / cells;
    
    // Hash string to pseudo bits
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
      hash = (hash << 5) - hash + code.charCodeAt(i);
      hash |= 0;
    }

    const rects: React.ReactElement[] = [];

    // Corner finder patterns (mandatory for realistic QR code appearance)
    const renderFinder = (x: number, y: number) => {
      return (
        <g key={`finder-${x}-${y}`}>
          <rect x={x * cellSize} y={y * cellSize} width={4 * cellSize} height={4 * cellSize} fill="#0f172a" />
          <rect x={(x + 1) * cellSize} y={(y + 1) * cellSize} width={2 * cellSize} height={2 * cellSize} fill="#ffffff" />
        </g>
      );
    };

    rects.push(renderFinder(1, 1));
    rects.push(renderFinder(10, 1));
    rects.push(renderFinder(1, 10));

    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        // Skip corner finder zones
        if ((r < 5 && c < 5) || (r < 5 && c > 9) || (r > 9 && c < 5)) continue;
        const bit = ((hash * (r + 1) * (c + 3)) ^ (r * 17 + c * 31)) % 3 === 0;
        if (bit) {
          rects.push(
            <rect
              key={`cell-${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize}
              height={cellSize}
              fill="#0f172a"
            />
          );
        }
      }
    }

    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="bg-white p-1 rounded border border-slate-300">
        {rects}
      </svg>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Component Traceability Tag & QR Verification"
      subtitle={`Permanent Shop-Floor Identifier Reference: ${record.traceabilityNumber}`}
      maxWidth="xl"
    >
      <div className="space-y-6">
        {/* Printable Physical Tag Card */}
        <div
          id="printable-tag"
          className="border-2 border-slate-900 rounded-lg p-5 bg-white shadow-sm space-y-4 font-mono text-slate-900"
        >
          {/* Tag Header */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
                <Cpu className="w-4 h-4 text-slate-900" />
                MACHINE QMS • TRACEABILITY IDENTIFIER
              </div>
              <h2 className="text-2xl font-black tracking-tight text-slate-950 mt-1">
                {record.traceabilityNumber}
              </h2>
            </div>
            <div className="text-right">
              {renderSvgQr(record.traceabilityNumber)}
              <div className="text-[10px] text-slate-500 mt-1">SCAN FOR AUDIT</div>
            </div>
          </div>

          {/* Core Traceability Grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div>
              <span className="text-slate-500 block text-[10px]">PART NUMBER</span>
              <span className="font-bold text-sm text-slate-900">{record.partNumber}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">MACHINE SERIAL NO.</span>
              <span className="font-bold text-sm text-blue-700">{record.machineSerialNumber}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">DESCRIPTION</span>
              <span className="font-semibold text-slate-800">{record.componentDescription}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">PROJECT NUMBER</span>
              <span className="font-semibold text-slate-800">{record.projectNumber}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">APPROVED DRAWING / REVISION</span>
              <span className="font-bold text-slate-950 bg-slate-100 px-1 py-0.5 rounded">
                {record.drawingNumber} REV {record.drawingRevision}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">MANUFACTURE QUANTITY</span>
              <span className="font-bold text-slate-900">{record.quantity} UNIT(S)</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">MACHINIST / DATE</span>
              <span className="font-medium text-slate-800">
                {record.machinist} ({record.manufacturingDate})
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">PERMANENT MARKING REF</span>
              <span className="font-medium text-slate-800">
                {record.permanentIdMethod || 'LASER'} • {record.permanentIdReference || record.traceabilityNumber}
              </span>
            </div>
          </div>

          {/* Quality Release Enforcement Warning */}
          <div className="border-t border-slate-300 pt-3 flex items-center justify-between text-xs bg-amber-50/60 p-2.5 rounded border">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-bold text-amber-900">QUALITY HOLD - MANDATORY INSPECTION REQUIRED</p>
                <p className="text-[11px] text-amber-800">
                  Do not fit or dispatch without authorized QMS sign-off & Quality Release certificate.
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="px-2 py-1 bg-amber-200 text-amber-900 text-[10px] font-bold rounded uppercase">
                {record.manufacturingStatus.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-slate-500">
            Physical label must be applied via engraving, laser mark, or oil-resistant tag.
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-100 font-medium"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-sm font-medium flex items-center gap-2 shadow-xs"
            >
              <Printer className="w-4 h-4" />
              Print Physical Tag
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
