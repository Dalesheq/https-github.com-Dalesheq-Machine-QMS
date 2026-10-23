import React, { useState } from 'react';
import { FileAttachmentMetadata } from '../types';
import { DBService } from '../services/db';
import { useQMS } from '../context/QMSContext';
import { Camera, Upload, Trash2, ZoomIn, X, Image as ImageIcon } from 'lucide-react';

interface PhotoEvidenceGalleryProps {
  title: string;
  subtitle?: string;
  photos: FileAttachmentMetadata[];
  onChange?: (updatedPhotos: FileAttachmentMetadata[]) => void;
  relatedRecordId?: string;
  readOnly?: boolean;
  badgeColor?: 'rose' | 'emerald' | 'blue' | 'amber';
}

export const PhotoEvidenceGallery: React.FC<PhotoEvidenceGalleryProps> = ({
  title,
  subtitle,
  photos = [],
  onChange,
  relatedRecordId,
  readOnly = false,
  badgeColor = 'rose',
}) => {
  const { uploadAttachmentFile } = useQMS();
  const [isUploading, setIsUploading] = useState(false);
  const [captionInput, setCaptionInput] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<FileAttachmentMetadata | null>(null);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0 || !onChange) return;

    setIsUploading(true);
    setUploadError(null);
    const newlyUploaded: FileAttachmentMetadata[] = [];

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const base64Data = await fileToBase64(file);
        const res = await uploadAttachmentFile({
          originalFilename: file.name,
          mimeType: file.type || 'image/jpeg',
          base64Data,
          category: 'EVIDENCE',
          relatedRecordId,
          caption: captionInput.trim() || undefined,
        });
        if (res.success && res.attachment) {
          newlyUploaded.push({
            ...res.attachment,
            caption: captionInput.trim() || res.attachment.caption,
          });
        } else {
          setUploadError(res.error || `Failed to upload ${file.name}`);
        }
      }

      if (newlyUploaded.length > 0) {
        onChange([...photos, ...newlyUploaded]);
        setCaptionInput('');
      }
    } catch (err: any) {
      setUploadError(err.message || 'Failed to process photo file.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = (fileId: string) => {
    if (!onChange) return;
    onChange(photos.filter((p) => p.fileId !== fileId));
  };

  const colorMap = {
    rose: {
      border: 'border-rose-200',
      bg: 'bg-rose-50/50',
      badge: 'bg-rose-100 text-rose-800 border-rose-300',
      btn: 'bg-rose-600 hover:bg-rose-700 text-white',
    },
    emerald: {
      border: 'border-emerald-200',
      bg: 'bg-emerald-50/50',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      btn: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    },
    blue: {
      border: 'border-blue-200',
      bg: 'bg-blue-50/50',
      badge: 'bg-blue-100 text-blue-800 border-blue-300',
      btn: 'bg-blue-600 hover:bg-blue-700 text-white',
    },
    amber: {
      border: 'border-amber-200',
      bg: 'bg-amber-50/50',
      badge: 'bg-amber-100 text-amber-800 border-amber-300',
      btn: 'bg-amber-600 hover:bg-amber-700 text-white',
    },
  }[badgeColor];

  return (
    <div className={`p-3.5 rounded-lg border ${colorMap.border} ${colorMap.bg} space-y-3`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-slate-700" />
            <span className="font-bold text-slate-900 text-xs">{title}</span>
            <span
              className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded border ${colorMap.badge}`}
            >
              {photos.length} Photo{photos.length === 1 ? '' : 's'}
            </span>
          </div>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>

        {!readOnly && onChange && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={captionInput}
              onChange={(e) => setCaptionInput(e.target.value)}
              placeholder="Optional photo note / caption..."
              className="px-2.5 py-1 bg-white border border-slate-300 rounded text-[11px] text-slate-800 w-44"
            />
            <label
              className={`px-3 py-1.5 rounded text-[11px] font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-xs transition-colors ${
                isUploading ? 'opacity-60 pointer-events-none' : colorMap.btn
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{isUploading ? 'Uploading...' : 'Add Photo Evidence'}</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFilesSelected}
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>

      {uploadError && (
        <div className="p-2 bg-rose-100 border border-rose-300 rounded text-[11px] text-rose-800 font-medium">
          {uploadError}
        </div>
      )}

      {photos.length === 0 ? (
        <div className="bg-white/80 border border-dashed border-slate-300 rounded p-4 text-center text-slate-400 text-[11px] flex flex-col items-center gap-1">
          <ImageIcon className="w-5 h-5 text-slate-300" />
          <span>No photo evidence attached yet.</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {photos.map((photo) => {
            const previewUrl = DBService.resolveAttachmentPreviewUrl(photo);
            return (
              <div
                key={photo.fileId}
                className="bg-white border border-slate-200 rounded-md overflow-hidden shadow-2xs flex flex-col justify-between group"
              >
                <div
                  onClick={() => setLightboxPhoto(photo)}
                  className="relative h-28 bg-slate-100 cursor-pointer overflow-hidden flex items-center justify-center"
                >
                  <img
                    src={previewUrl}
                    alt={photo.caption || photo.originalFilename}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/30 transition-colors flex items-center justify-center">
                    <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                  </div>
                </div>
                <div className="p-2 text-[10px] space-y-1">
                  {photo.caption && (
                    <div className="font-semibold text-slate-800 line-clamp-1" title={photo.caption}>
                      {photo.caption}
                    </div>
                  )}
                  <div
                    className="font-mono text-slate-500 truncate"
                    title={photo.originalFilename}
                  >
                    {photo.originalFilename}
                  </div>
                  <div className="flex items-center justify-between text-slate-400 pt-0.5 border-t border-slate-100">
                    <span className="truncate">{photo.uploadedBy}</span>
                    {!readOnly && onChange && (
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(photo.fileId)}
                        className="text-rose-500 hover:text-rose-700 p-0.5"
                        title="Remove photo"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="bg-white rounded-lg max-w-3xl w-full overflow-hidden shadow-2xl border border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
              <div>
                <div className="font-bold text-xs">
                  {lightboxPhoto.caption || lightboxPhoto.originalFilename}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Uploaded by {lightboxPhoto.uploadedBy} on{' '}
                  {lightboxPhoto.uploadDate.split('T')[0]} ({lightboxPhoto.originalFilename})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-slate-950 flex items-center justify-center max-h-[75vh] overflow-auto">
              <img
                src={DBService.resolveAttachmentPreviewUrl(lightboxPhoto)}
                alt={lightboxPhoto.originalFilename}
                className="max-h-[70vh] w-auto object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
