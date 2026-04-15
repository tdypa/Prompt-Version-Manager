export type AttachmentCategory = 'image' | 'document' | 'video';

export interface Attachment {
  id: number;
  versionId: number;
  category: AttachmentCategory;
  originalName: string;
  storedName: string;
  relativePath: string;
  absolutePath: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}

export interface PromptVersion {
  id: number;
  projectId: number;
  name: string;
  description: string;
  contentMarkdown: string;
  createdAt: string;
  updatedAt: string;
  isRecommended: boolean;
  attachments: Attachment[];
}

export interface PromptProject {
  id: number;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  versionCount: number;
  tags: string[];
  versions: PromptVersion[];
}

export interface StorageInfo {
  databasePath: string;
  assetsPath: string;
}

export interface AppDataResponse {
  projects: PromptProject[];
  storage: StorageInfo;
}

export interface ProjectPayload {
  id: number;
  title: string;
  description: string;
  tags: string[];
}

export interface VersionPayload {
  id: number;
  name: string;
  description: string;
  contentMarkdown: string;
}

export interface PromptManagerApi {
  loadData: (searchTerm: string) => Promise<AppDataResponse>;
  createProject: () => Promise<{ projectId: number }>;
  updateProject: (payload: ProjectPayload) => Promise<{ projectId: number }>;
  deleteProject: (projectId: number) => Promise<{ ok: boolean }>;
  createVersion: (projectId: number) => Promise<{ versionId: number }>;
  updateVersion: (payload: VersionPayload) => Promise<{ versionId: number }>;
  deleteVersion: (versionId: number) => Promise<{ ok: boolean }>;
  setRecommendedVersion: (versionId: number) => Promise<{ ok: boolean }>;
  copyVersionContent: (versionId: number) => Promise<{ ok: boolean }>;
  copyAttachmentPaths: (versionId: number) => Promise<{ count: number }>;
  exportVersion: (payload: { versionId: number; format: 'folder' | 'zip' }) => Promise<{ cancelled: boolean; exportPath?: string }>;
  addAttachments: (payload: { versionId: number; category: AttachmentCategory }) => Promise<{ cancelled: boolean }>;
  removeAttachment: (attachmentId: number) => Promise<{ ok: boolean }>;
}

declare global {
  interface Window {
    promptManagerApi: PromptManagerApi;
  }
}
