import React, { useState } from 'react';
import { Prompt } from '../types';
import { Plus, Trash2, FileText, Tag } from 'lucide-react';

interface Props {
  prompts: Prompt[];
  selectedId: string | null;
  onSelect: (prompt: Prompt) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: { title?: string; description?: string; tags?: string[] }) => void;
}

export default function PromptList({ prompts, selectedId, onSelect, onCreate, onDelete, onUpdate }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const startEditing = (prompt: Prompt) => {
    setEditingId(prompt.id);
    setEditTitle(prompt.title);
  };

  const finishEditing = () => {
    if (editingId && editTitle.trim()) {
      onUpdate(editingId, { title: editTitle.trim() });
    }
    setEditingId(null);
  };

  return (
    <div className="w-64 border-r border-[#2a2a2a] flex flex-col bg-[#0f0f0f] shrink-0">
      <div className="p-3 border-b border-[#2a2a2a] flex items-center justify-between">
        <span className="text-xs font-medium text-[#a3a3a3] uppercase tracking-wider">提示词</span>
        <button
          onClick={onCreate}
          className="w-6 h-6 rounded-md bg-[#1f1f1f] hover:bg-[#6366f1] border border-[#2a2a2a] hover:border-[#6366f1] flex items-center justify-center transition-all"
          title="新建提示词"
        >
          <Plus className="w-3.5 h-3.5 text-[#a3a3a3] hover:text-white" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {prompts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="w-8 h-8 text-[#333] mb-3" />
            <p className="text-xs text-[#737373]">暂无提示词</p>
            <button
              onClick={onCreate}
              className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              创建第一个
            </button>
          </div>
        )}
        {prompts.map((prompt) => {
          const tags: string[] = (() => {
            try { return JSON.parse(prompt.tags); } catch { return []; }
          })();
          const isSelected = selectedId === prompt.id;
          const isHovered = hoveredId === prompt.id;

          return (
            <div
              key={prompt.id}
              className={`group relative rounded-lg px-3 py-2.5 cursor-pointer transition-all ${
                isSelected
                  ? 'bg-[#1f1f1f] border border-[#2a2a2a]'
                  : 'border border-transparent hover:bg-[#171717]'
              }`}
              onClick={() => onSelect(prompt)}
              onMouseEnter={() => setHoveredId(prompt.id)}
              onMouseLeave={() => setHoveredId(null)}
              onDoubleClick={() => startEditing(prompt)}
            >
              {editingId === prompt.id ? (
                <input
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={finishEditing}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') finishEditing();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="w-full bg-transparent text-sm text-[#f5f5f5] outline-none border-b border-indigo-500"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <div className="text-sm font-medium text-[#e5e5e5] truncate pr-6">{prompt.title}</div>
                  {tags.length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {tags.slice(0, 3).map((tag, i) => (
                        <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-[#262626] text-[#a3a3a3]">
                          <Tag className="w-2.5 h-2.5" />
                          {tag}
                        </span>
                      ))}
                      {tags.length > 3 && (
                        <span className="text-[10px] text-[#737373]">+{tags.length - 3}</span>
                      )}
                    </div>
                  )}
                  <div className="text-[10px] text-[#737373] mt-1">
                    {new Date(prompt.updated_at).toLocaleDateString('zh-CN')}
                  </div>
                </>
              )}

              {(isHovered || isSelected) && editingId !== prompt.id && (
                <button
                  className="absolute top-2.5 right-2 w-5 h-5 rounded flex items-center justify-center text-[#737373] hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); onDelete(prompt.id); }}
                  title="删除"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
