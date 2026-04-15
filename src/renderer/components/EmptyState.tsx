import React from 'react';
import { FileText, GitBranch, PenLine } from 'lucide-react';

interface Props {
  message: string;
  icon?: 'prompts' | 'versions' | 'detail';
}

export default function EmptyState({ message, icon = 'prompts' }: Props) {
  const Icon = icon === 'prompts' ? FileText : icon === 'versions' ? GitBranch : PenLine;

  return (
    <div className="flex flex-col items-center gap-3 text-center p-8">
      <div className="w-12 h-12 rounded-xl bg-[#1f1f1f] border border-[#2a2a2a] flex items-center justify-center">
        <Icon className="w-5 h-5 text-[#737373]" />
      </div>
      <p className="text-sm text-[#737373]">{message}</p>
    </div>
  );
}
