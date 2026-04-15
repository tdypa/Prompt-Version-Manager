import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Prompts
  listPrompts: (searchQuery?: string) => ipcRenderer.invoke('prompts:list', searchQuery),
  getPrompt: (id: string) => ipcRenderer.invoke('prompts:get', id),
  createPrompt: (data: { title: string; description?: string; tags?: string[] }) =>
    ipcRenderer.invoke('prompts:create', data),
  updatePrompt: (id: string, data: { title?: string; description?: string; tags?: string[] }) =>
    ipcRenderer.invoke('prompts:update', id, data),
  deletePrompt: (id: string) => ipcRenderer.invoke('prompts:delete', id),

  // Versions
  listVersions: (promptId: string) => ipcRenderer.invoke('versions:list', promptId),
  getVersion: (id: string) => ipcRenderer.invoke('versions:get', id),
  createVersion: (data: { prompt_id: string; name: string; description?: string; content?: string }) =>
    ipcRenderer.invoke('versions:create', data),
  updateVersion: (id: string, data: { name?: string; description?: string; content?: string; is_recommended?: boolean }) =>
    ipcRenderer.invoke('versions:update', id, data),
  deleteVersion: (id: string) => ipcRenderer.invoke('versions:delete', id),

  // Attachments
  listAttachments: (versionId: string) => ipcRenderer.invoke('attachments:list', versionId),
  addAttachment: (versionId: string, type: string) => ipcRenderer.invoke('attachments:add', versionId, type),
  deleteAttachment: (id: string) => ipcRenderer.invoke('attachments:delete', id),
  getAttachmentPath: (id: string) => ipcRenderer.invoke('attachments:get-path', id),

  // Actions
  copyContent: (text: string) => ipcRenderer.invoke('actions:copy-content', text),
  openFile: (filePath: string) => ipcRenderer.invoke('actions:open-file', filePath),
  exportVersion: (versionId: string) => ipcRenderer.invoke('actions:export-version', versionId),
  copyAttachmentPaths: (versionId: string) => ipcRenderer.invoke('actions:copy-attachment-paths', versionId),
});
