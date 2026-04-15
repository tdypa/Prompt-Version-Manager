const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('promptManagerApi', {
  loadData: (searchTerm) => ipcRenderer.invoke('data:load', searchTerm),
  createProject: () => ipcRenderer.invoke('projects:create'),
  updateProject: (payload) => ipcRenderer.invoke('projects:update', payload),
  deleteProject: (projectId) => ipcRenderer.invoke('projects:delete', projectId),
  createVersion: (projectId) => ipcRenderer.invoke('versions:create', projectId),
  updateVersion: (payload) => ipcRenderer.invoke('versions:update', payload),
  deleteVersion: (versionId) => ipcRenderer.invoke('versions:delete', versionId),
  setRecommendedVersion: (versionId) => ipcRenderer.invoke('versions:setRecommended', versionId),
  copyVersionContent: (versionId) => ipcRenderer.invoke('versions:copyContent', versionId),
  copyAttachmentPaths: (versionId) => ipcRenderer.invoke('versions:copyAttachmentPaths', versionId),
  exportVersion: (payload) => ipcRenderer.invoke('versions:export', payload),
  addAttachments: (payload) => ipcRenderer.invoke('attachments:add', payload),
  removeAttachment: (attachmentId) => ipcRenderer.invoke('attachments:remove', attachmentId),
  writeDebugLog: (payload) => ipcRenderer.invoke('debug:log', payload),
});
