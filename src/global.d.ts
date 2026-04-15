import type {
  PromptSetInput,
  PromptSetUpdateInput,
  CreateVersionInput,
  UpdateVersionInput,
  PromptSetRecord,
  PromptVersionRecord,
  AttachmentRecord,
  VersionWithAttachments,
  ExportMode,
} from "../shared/types";

interface PvmApi {
  listPromptSets: (query?: string) => Promise<PromptSetRecord[]>;
  createPromptSet: (payload: PromptSetInput) => Promise<PromptSetRecord>;
  updatePromptSet: (id: string, payload: PromptSetInput) => Promise<PromptSetRecord>;
  deletePromptSet: (id: string) => Promise<void>;
  listVersions: (promptSetId: string) => Promise<VersionWithAttachments[]>;
  createVersion: (payload: CreateVersionInput) => Promise<PromptVersionRecord>;
  updateVersion: (payload: UpdateVersionInput) => Promise<PromptVersionRecord>;
  deleteVersion: (id: string) => Promise<void>;
  setRecommendedVersion: (versionId: string) => Promise<void>;
  addAttachments: (versionId: string) => Promise<AttachmentRecord[]>;
  removeAttachment: (attachmentId: string) => Promise<void>;
  copyVersionContent: (versionId: string) => Promise<void>;
  copyAttachmentPaths: (versionId: string) => Promise<void>;
  exportVersionPackage: (versionId: string, format: ExportMode) => Promise<string | null>;
}

declare global {
  interface Window {
    pvmApi: PvmApi;
  }
}
