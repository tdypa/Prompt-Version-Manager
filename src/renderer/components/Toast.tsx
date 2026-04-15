import React from 'react';
import { Check, AlertCircle, Info } from 'lucide-react';

interface Props {
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function Toast({ message, type }: Props) {
  const Icon = type === 'success' ? Check : type === 'error' ? AlertCircle : Info;
  const colors = {
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    error: 'bg-red-500/10 border-red-500/30 text-red-400',
    info: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
  };

  return (
    <div className={`fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2.5 rounded-lg border ${colors[type]} shadow-lg animate-[fadeIn_0.2s_ease-out]`}>
      <Icon className="w-4 h-4 shrink-0" />
      <span className="text-sm">{message}</span>
    </div>
  );
}
