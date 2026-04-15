import React from 'react';
import { Search } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: Props) {
  return (
    <div className="relative flex items-center">
      <Search className="absolute left-2.5 w-3.5 h-3.5 text-[#737373]" />
      <input
        type="text"
        placeholder="搜索提示词..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-56 h-7 pl-8 pr-3 text-xs bg-[#1f1f1f] border border-[#2a2a2a] rounded-md text-[#f5f5f5] placeholder-[#737373] focus:outline-none focus:border-[#6366f1] transition-colors"
      />
    </div>
  );
}
