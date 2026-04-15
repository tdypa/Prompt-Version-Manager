import React from 'react';
import { Prompt, Version } from '../types';
import { Plus, Trash2, Star, GitBranch, Clock } from 'lucide-react';

interface Props {
  prompt: Prompt;
  versions: Version[];
  selectedId: string | null;
  onSelect: (version: Version) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

export default function VersionList({ prompt, versions, selectedId, onSelect, onCreate, onDelete }: Props) {
  return (
    <div className="w-72 border-r border-[#2a2a2a] flex flex-col bg-[#0f0f0f] shrink-0">
      <div className="p-3 border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-[#a3a3a3] uppercase tracking-wider">版本历史</span>
          <button
            onClick={onCreate}
            className="w-6 h-6 rounded-md bg-[#1f1f1f] hover:bg-[#6366f1] border border-[#2a2a2a] hover:border-[#6366f1] flex items-center justify-center transition-all"
            title="新建版本"
          >
            <Plus className="w-3.5 h-3.5 text-[#a3a3a3]" />
          </button>
        </div>
        <p className="text-xs text-[#737373] truncate">{prompt.title}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {versions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <GitBranch className="w-8 h-8 text-[#333] mb-3" />
            <p className="text-xs text-[#737373]">暂无版本</p>
            <button
              onClick={onCreate}
              className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              创建第一个版本
            </button>
          </div>
        )}
        {versions.map((version, index) => {
          const isSelected = selectedId === version.id;
          const isLatest = index === 0;

          return (
            <div
              key={version.id}
              className={`group relative rounded-lg px-3 py-2.5 cursor-pointer transition-all ${
                isSelected
                  ? 'bg-[#1f1f1f] border border-[#2a2a2a]'
                  : 'border border-transparent hover:bg-[#171717]'
              }`}
              onClick={() => onSelect(version)}
            >
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  version.is_recommended ? 'bg-amber-400' : isLatest ? 'bg-indigo-400' : 'bg-[#404040]'
                }`} />
                <span className="text-sm font-medium text-[#e5e5e5] truncate">{version.name}</span>
                {version.is_recommended === 1 && (
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                )}
                {isLatest && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 shrink-0">最新</span>
                )}
              </div>

              {version.description && (
                <p className="text-xs text-[#737373] mt-1 truncate pl-3.5">{version.description}</p>
              )}

              <div className="flex items-center gap-1 mt-1 pl-3.5">
                <Clock className="w-2.5 h-2.5 text-[#525252]" />
                <span className="text-[10px] text-[#525252]">
                  {new Date(version.created_at).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <button
                className="absolute top-2.5 right-2 w-5 h-5 rounded flex items-center justify-center text-[#737373] hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); onDelete(version.id); }}
                title="删除版本"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
