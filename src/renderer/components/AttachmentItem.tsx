import React from 'react';
import { Attachment } from '../types';
import { Trash2, ExternalLink, Image, FileText, Video } from 'lucide-react';

interface Props {
  attachment: Attachment;
  onDelete: (id: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const api = window.electronAPI;

export default function AttachmentItem({ attachment, onDelete }: Props) {
  const handleOpen = () => {
    api.openFile(attachment.file_path);
  };

  if (attachment.type === 'image') {
    return (
      <div className="group relative rounded-lg overflow-hidden border border-[#2a2a2a] bg-[#171717] hover:border-[#333] transition-colors">
        <div className="aspect-square bg-[#1a1a1a] flex items-center justify-center overflow-hidden">
          <img
            src={`local-asset://${encodeURIComponent(attachment.file_path)}`}
            alt={attachment.original_name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="flex items-center justify-center w-full h-full"><svg class="w-6 h-6 text-[#333]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>';
            }}
          />
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <button onClick={handleOpen} className="w-7 h-7 rounded-md bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors">
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(attachment.id)} className="w-7 h-7 rounded-md bg-black/60 flex items-center justify-center text-red-400 hover:bg-red-600/80 hover:text-white transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-[#737373] truncate px-2 py-1">{attachment.original_name}</p>
      </div>
    );
  }

  const Icon = attachment.type === 'video' ? Video : FileText;

  return (
    <div className="group flex items-center gap-3 px-3 py-2 rounded-lg bg-[#171717] border border-[#2a2a2a] hover:border-[#333] transition-colors">
      <div className="w-8 h-8 rounded-md bg-[#262626] flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-[#737373]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[#e5e5e5] truncate">{attachment.original_name}</p>
        <p className="text-[10px] text-[#525252]">{formatFileSize(attachment.file_size)}</p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={handleOpen} className="w-6 h-6 rounded flex items-center justify-center text-[#737373] hover:text-[#a3a3a3] hover:bg-[#262626] transition-colors">
          <ExternalLink className="w-3 h-3" />
        </button>
        <button onClick={() => onDelete(attachment.id)} className="w-6 h-6 rounded flex items-center justify-center text-[#737373] hover:text-red-400 hover:bg-red-500/10 transition-colors">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
