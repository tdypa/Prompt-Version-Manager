export type AttachmentKind = "image" | "document" | "video";

export type ExportMode = "folder" | "zip";

export type PromptSetRecord = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  versionCount: number;
  createdAt: number;
  updatedAt: number;
};

export type VersionRecord = {
  id: string;
  promptSetId: string;
  name: string;
  summary: string;
  contentMarkdown: string;
  isRecommended: boolean;
  createdAt: number;
  updatedAt: number;
};

export type PromptVersionRecord = VersionRecord;

export type AttachmentRecord = {
  id: string;
  versionId: string;
  kind: AttachmentKind;
  originalName: string;
  storedName: string;
  storedPath: string;
  createdAt: number;
};

export type VersionWithAttachments = VersionRecord & {
  attachments: AttachmentRecord[];
};

export type PromptSetInput = {
  title: string;
  description: string;
  tags: string[];
};

export type PromptSetUpdateInput = PromptSetInput & {
  id: string;
};
export type UpdatePromptSetInput = PromptSetUpdateInput;

export type CreateVersionInput = {
  promptSetId: string;
  name: string;
  summary: string;
  contentMarkdown: string;
};

export type UpdateVersionInput = {
  id: string;
  name: string;
  summary: string;
  contentMarkdown: string;
};
