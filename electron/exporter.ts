import archiver from "archiver";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type {
  AttachmentRecord,
  ExportMode,
  PromptSetRecord,
  PromptVersionRecord,
} from "../shared/types";

type ExportArgs = {
  outputDir: string;
  exportName: string;
  mode: ExportMode;
  promptSet: PromptSetRecord;
  version: PromptVersionRecord;
  attachments: AttachmentRecord[];
};

function safeFileName(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function ensureDir(targetPath: string): Promise<void> {
  await fsp.mkdir(targetPath, { recursive: true });
}

function buildMeta(args: ExportArgs) {
  return {
    promptSet: {
      id: args.promptSet.id,
      title: args.promptSet.title,
      description: args.promptSet.description,
      tags: args.promptSet.tags,
    },
    version: {
      id: args.version.id,
      name: args.version.name,
      summary: args.version.summary,
      createdAt: args.version.createdAt,
      updatedAt: args.version.updatedAt,
      isRecommended: args.version.isRecommended,
    },
    attachments: args.attachments.map((a) => ({
      id: a.id,
      kind: a.kind,
      originalName: a.originalName,
      storedName: a.storedName,
      storedPath: a.storedPath,
      createdAt: a.createdAt,
    })),
  };
}

async function exportAsFolder(args: ExportArgs): Promise<string> {
  await ensureDir(args.outputDir);
  const folderPath = path.join(args.outputDir, args.exportName);
  const attachmentsDir = path.join(folderPath, "attachments");
  await ensureDir(attachmentsDir);

  await fsp.writeFile(path.join(folderPath, "prompt.md"), args.version.contentMarkdown, "utf8");
  await fsp.writeFile(path.join(folderPath, "version-meta.json"), JSON.stringify(buildMeta(args), null, 2), "utf8");

  for (const attachment of args.attachments) {
    if (fs.existsSync(attachment.storedPath)) {
      const target = path.join(attachmentsDir, safeFileName(attachment.originalName));
      await fsp.copyFile(attachment.storedPath, target);
    }
  }
  return folderPath;
}

async function exportAsZip(args: ExportArgs): Promise<string> {
  await ensureDir(args.outputDir);
  const zipPath = path.join(args.outputDir, `${args.exportName}.zip`);
  const archive = archiver("zip", { zlib: { level: 9 } });

  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);
    archive.pipe(output);

    archive.append(args.version.contentMarkdown, { name: "prompt.md" });
    archive.append(JSON.stringify(buildMeta(args), null, 2), { name: "version-meta.json" });

    for (const attachment of args.attachments) {
      if (fs.existsSync(attachment.storedPath)) {
        archive.file(attachment.storedPath, {
          name: `attachments/${safeFileName(attachment.originalName)}`,
        });
      }
    }
    void archive.finalize();
  });

  return zipPath;
}

export async function exportVersionBundle(args: ExportArgs): Promise<string> {
  if (args.mode === "folder") {
    return exportAsFolder(args);
  }
  return exportAsZip(args);
}
