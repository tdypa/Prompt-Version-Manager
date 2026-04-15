export interface Prompt {
  id: string;
  title: string;
  description: string;
  tags: string; // JSON array string
  created_at: string;
  updated_at: string;
}

export interface Version {
  id: string;
  prompt_id: string;
  name: string;
  description: string;
  content: string;
  is_recommended: number;
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: string;
  version_id: string;
  type: 'image' | 'document' | 'video';
  filename: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

export interface ElectronAPI {
  listPrompts: (searchQuery?: string) => Promise<Prompt[]>;
  getPrompt: (id: string) => Promise<Prompt | null>;
  createPrompt: (data: { title: string; description?: string; tags?: string[] }) => Promise<Prompt>;
  updatePrompt: (id: string, data: { title?: string; description?: string; tags?: string[] }) => Promise<Prompt>;
  deletePrompt: (id: string) => Promise<boolean>;
  listVersions: (promptId: string) => Promise<Version[]>;
  getVersion: (id: string) => Promise<Version | null>;
  createVersion: (data: { prompt_id: string; name: string; description?: string; content?: string }) => Promise<Version>;
  updateVersion: (id: string, data: { name?: string; description?: string; content?: string; is_recommended?: boolean }) => Promise<Version>;
  deleteVersion: (id: string) => Promise<boolean>;
  listAttachments: (versionId: string) => Promise<Attachment[]>;
  addAttachment: (versionId: string, type: string) => Promise<Attachment[]>;
  deleteAttachment: (id: string) => Promise<boolean>;
  getAttachmentPath: (id: string) => Promise<string | null>;
  copyContent: (text: string) => Promise<boolean>;
  openFile: (filePath: string) => Promise<boolean>;
  exportVersion: (versionId: string) => Promise<string | null>;
  copyAttachmentPaths: (versionId: string) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
