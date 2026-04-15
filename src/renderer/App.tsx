import React, { useState, useEffect, useCallback } from 'react';
import { Prompt, Version, Attachment } from './types';
import PromptList from './components/PromptList';
import VersionList from './components/VersionList';
import VersionDetail from './components/VersionDetail';
import SearchBar from './components/SearchBar';
import EmptyState from './components/EmptyState';
import Toast from './components/Toast';

const api = window.electronAPI;

export default function App() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const loadPrompts = useCallback(async () => {
    const data = await api.listPrompts(searchQuery || undefined);
    setPrompts(data);
  }, [searchQuery]);

  const loadVersions = useCallback(async (promptId: string) => {
    const data = await api.listVersions(promptId);
    setVersions(data);
  }, []);

  const loadAttachments = useCallback(async (versionId: string) => {
    const data = await api.listAttachments(versionId);
    setAttachments(data);
  }, []);

  useEffect(() => { loadPrompts(); }, [loadPrompts]);

  useEffect(() => {
    if (selectedPrompt) {
      loadVersions(selectedPrompt.id);
      setSelectedVersion(null);
      setAttachments([]);
    } else {
      setVersions([]);
      setSelectedVersion(null);
      setAttachments([]);
    }
  }, [selectedPrompt, loadVersions]);

  useEffect(() => {
    if (selectedVersion) {
      loadAttachments(selectedVersion.id);
    } else {
      setAttachments([]);
    }
  }, [selectedVersion, loadAttachments]);

  const handleCreatePrompt = async () => {
    const prompt = await api.createPrompt({ title: '新建提示词', description: '', tags: [] });
    await loadPrompts();
    setSelectedPrompt(prompt);
  };

  const handleUpdatePrompt = async (id: string, data: { title?: string; description?: string; tags?: string[] }) => {
    await api.updatePrompt(id, data);
    await loadPrompts();
    if (selectedPrompt?.id === id) {
      const updated = await api.getPrompt(id);
      if (updated) setSelectedPrompt(updated);
    }
  };

  const handleDeletePrompt = async (id: string) => {
    await api.deletePrompt(id);
    if (selectedPrompt?.id === id) {
      setSelectedPrompt(null);
    }
    await loadPrompts();
    showToast('提示词已删除');
  };

  const handleCreateVersion = async () => {
    if (!selectedPrompt) return;
    const versionCount = versions.length;
    const version = await api.createVersion({
      prompt_id: selectedPrompt.id,
      name: `v${versionCount + 1}.0`,
      description: '',
      content: '',
    });
    await loadVersions(selectedPrompt.id);
    setSelectedVersion(version);
    showToast('新版本已创建');
  };

  const handleUpdateVersion = async (id: string, data: { name?: string; description?: string; content?: string; is_recommended?: boolean }) => {
    const updated = await api.updateVersion(id, data);
    if (selectedPrompt) await loadVersions(selectedPrompt.id);
    if (selectedVersion?.id === id && updated) setSelectedVersion(updated);
    if (data.is_recommended) showToast('已设为推荐版本', 'success');
  };

  const handleDeleteVersion = async (id: string) => {
    await api.deleteVersion(id);
    if (selectedVersion?.id === id) setSelectedVersion(null);
    if (selectedPrompt) await loadVersions(selectedPrompt.id);
    showToast('版本已删除');
  };

  const handleAddAttachment = async (type: string) => {
    if (!selectedVersion) return;
    await api.addAttachment(selectedVersion.id, type);
    await loadAttachments(selectedVersion.id);
    showToast('附件已添加');
  };

  const handleDeleteAttachment = async (id: string) => {
    await api.deleteAttachment(id);
    if (selectedVersion) await loadAttachments(selectedVersion.id);
    showToast('附件已删除');
  };

  const handleCopyContent = async () => {
    if (!selectedVersion) return;
    await api.copyContent(selectedVersion.content);
    showToast('提示词已复制到剪贴板', 'info');
  };

  const handleCopyPaths = async () => {
    if (!selectedVersion) return;
    await api.copyAttachmentPaths(selectedVersion.id);
    showToast('附件路径已复制到剪贴板', 'info');
  };

  const handleExport = async () => {
    if (!selectedVersion) return;
    const result = await api.exportVersion(selectedVersion.id);
    if (result) showToast('导出成功', 'success');
  };

  return (
    <div className="flex flex-col h-screen bg-[#0f0f0f]">
      {/* Title bar drag region */}
      <div className="drag-region h-11 flex items-center justify-between px-4 border-b border-[#2a2a2a] bg-[#0f0f0f] shrink-0">
        <div className="flex items-center gap-2 pl-16">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">P</span>
          </div>
          <span className="text-xs font-semibold text-[#a3a3a3] tracking-wide">PROMPT VERSION MANAGER</span>
        </div>
        <div className="no-drag">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Prompt list */}
        <PromptList
          prompts={prompts}
          selectedId={selectedPrompt?.id || null}
          onSelect={(p) => setSelectedPrompt(p)}
          onCreate={handleCreatePrompt}
          onDelete={handleDeletePrompt}
          onUpdate={handleUpdatePrompt}
        />

        {/* Middle: Version list */}
        {selectedPrompt ? (
          <VersionList
            prompt={selectedPrompt}
            versions={versions}
            selectedId={selectedVersion?.id || null}
            onSelect={(v) => setSelectedVersion(v)}
            onCreate={handleCreateVersion}
            onDelete={handleDeleteVersion}
          />
        ) : (
          <div className="w-72 border-r border-[#2a2a2a] flex items-center justify-center">
            <EmptyState message="选择一个提示词查看版本" icon="versions" />
          </div>
        )}

        {/* Right: Version detail */}
        {selectedVersion ? (
          <VersionDetail
            version={selectedVersion}
            prompt={selectedPrompt!}
            attachments={attachments}
            onUpdate={handleUpdateVersion}
            onUpdatePrompt={handleUpdatePrompt}
            onAddAttachment={handleAddAttachment}
            onDeleteAttachment={handleDeleteAttachment}
            onCopyContent={handleCopyContent}
            onCopyPaths={handleCopyPaths}
            onExport={handleExport}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              message={selectedPrompt ? '选择或创建一个版本' : '选择一个提示词开始管理'}
              icon="detail"
            />
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
