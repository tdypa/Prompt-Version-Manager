import React, { useState } from 'react';
import { X, Plus, Tag } from 'lucide-react';

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
  readonly?: boolean;
}

export default function TagEditor({ tags, onChange, readonly = false }: Props) {
  const [inputValue, setInputValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const addTag = () => {
    const tag = inputValue.trim();
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag]);
    }
    setInputValue('');
    setIsAdding(false);
  };

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag, i) => (
        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-[#262626] text-[#a3a3a3] border border-[#333]">
          <Tag className="w-2.5 h-2.5 text-indigo-400" />
          {tag}
          {!readonly && (
            <button
              onClick={() => removeTag(i)}
              className="ml-0.5 text-[#525252] hover:text-red-400 transition-colors"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </span>
      ))}
      {!readonly && (
        isAdding ? (
          <input
            autoFocus
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={addTag}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addTag();
              if (e.key === 'Escape') { setIsAdding(false); setInputValue(''); }
            }}
            placeholder="标签名..."
            className="w-20 h-5 px-1.5 text-[11px] bg-[#1f1f1f] border border-indigo-500 rounded text-[#e5e5e5] placeholder-[#525252] outline-none"
          />
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] text-[#525252] hover:text-[#a3a3a3] border border-dashed border-[#333] hover:border-[#525252] transition-colors"
          >
            <Plus className="w-2.5 h-2.5" /> 添加
          </button>
        )
      )}
    </div>
  );
}
