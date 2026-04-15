import { contextBridge, ipcRenderer } from "electron";
import type {
  AttachmentRecord,
  CreateVersionInput,
  ExportMode,
  PromptVersionRecord,
  PromptSetRecord,
  PromptSetInput,
  UpdateVersionInput,
  VersionWithAttachments,
} from "../shared/types";

type PvmApi = {
  listPromptSets: (query?: string) => Promise<PromptSetRecord[]>;
  createPromptSet: (payload: PromptSetInput) => Promise<PromptSetRecord>;
  updatePromptSet: (id: string, payload: PromptSetInput) => Promise<PromptSetRecord>;
  deletePromptSet: (id: string) => Promise<void>;
  listVersions: (promptSetId: string) => Promise<VersionWithAttachments[]>;
  createVersion: (payload: CreateVersionInput) => Promise<PromptVersionRecord>;
  updateVersion: (payload: UpdateVersionInput) => Promise<PromptVersionRecord>;
  deleteVersion: (id: string) => Promise<void>;
  addAttachments: (versionId: string) => Promise<AttachmentRecord[]>;
  removeAttachment: (id: string) => Promise<void>;
  copyVersionContent: (versionId: string) => Promise<void>;
  copyAttachmentPaths: (versionId: string) => Promise<string>;
  setRecommendedVersion: (versionId: string) => Promise<void>;
  exportVersionPackage: (versionId: string, format: ExportMode) => Promise<string | null>;
};

const api: PvmApi = {
  listPromptSets: (query?: string) => ipcRenderer.invoke("pvm:listPromptSets", query ?? ""),
  createPromptSet: (payload: PromptSetInput) => ipcRenderer.invoke("pvm:createPromptSet", payload),
  updatePromptSet: (id: string, payload: PromptSetInput) =>
    ipcRenderer.invoke("pvm:updatePromptSet", id, payload),
  deletePromptSet: (id: string) => ipcRenderer.invoke("pvm:deletePromptSet", id),
  listVersions: (promptSetId: string) => ipcRenderer.invoke("pvm:listVersions", promptSetId),
  createVersion: (payload: CreateVersionInput) => ipcRenderer.invoke("pvm:createVersion", payload),
  updateVersion: (payload: UpdateVersionInput) => ipcRenderer.invoke("pvm:updateVersion", payload.id, payload),
  deleteVersion: (id: string) => ipcRenderer.invoke("pvm:deleteVersion", id),
  addAttachments: (versionId: string) => ipcRenderer.invoke("pvm:addAttachments", versionId),
  removeAttachment: (id: string) => ipcRenderer.invoke("pvm:removeAttachment", id),
  copyVersionContent: (versionId: string) => ipcRenderer.invoke("pvm:copyVersionContent", versionId),
  copyAttachmentPaths: (versionId: string) => ipcRenderer.invoke("pvm:copyAttachmentPaths", versionId),
  setRecommendedVersion: (versionId: string) =>
    ipcRenderer.invoke("pvm:setRecommendedVersion", versionId),
  exportVersionPackage: (versionId: string, format: ExportMode) =>
    ipcRenderer.invoke("pvm:exportVersionPackage", versionId, format),
};

contextBridge.exposeInMainWorld("pvmApi", api);
