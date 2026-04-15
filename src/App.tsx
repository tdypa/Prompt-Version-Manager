import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import { marked } from "marked";
import type {
  Attachment,
  CreatePromptSetInput,
  CreateVersionInput,
  PromptSetWithTags,
  UpdatePromptSetInput,
  UpdateVersionInput,
  VersionWithAttachments,
} from "./types";

type PromptSetForm = {
  title: string;
  description: string;
  tags: string;
};

type VersionForm = {
  name: string;
  summary: string;
  contentMarkdown: string;
};

const emptyPromptSetForm: PromptSetForm = {
  title: "",
  description: "",
  tags: "",
};

const emptyVersionForm: VersionForm = {
  name: "",
  summary: "",
  contentMarkdown: "",
};

function formatTs(ts: number): string {
  return new Date(ts).toLocaleString();
}

function attachmentLabel(kind: Attachment["kind"]): string {
  if (kind === "image") return "图片";
  if (kind === "video") return "视频";
  return "文档";
}

export default function App(): ReactElement {
  const [promptSets, setPromptSets] = useState<PromptSetWithTags[]>([]);
  const [versions, setVersions] = useState<VersionWithAttachments[]>([]);
  const [selectedPromptSetId, setSelectedPromptSetId] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("准备就绪");
  const [promptSetMode, setPromptSetMode] = useState<"create" | "edit" | null>(null);
  const [versionMode, setVersionMode] = useState<"create" | "edit" | null>(null);
  const [promptSetForm, setPromptSetForm] = useState<PromptSetForm>(emptyPromptSetForm);
  const [versionForm, setVersionForm] = useState<VersionForm>(emptyVersionForm);

  const selectedPromptSet = useMemo(
    () => promptSets.find((item) => item.id === selectedPromptSetId) ?? null,
    [promptSets, selectedPromptSetId]
  );
  const selectedVersion = useMemo(
    () => versions.find((item) => item.id === selectedVersionId) ?? null,
    [versions, selectedVersionId]
  );

  async function loadPromptSets(query?: string): Promise<void> {
    const list = await window.pvmApi.listPromptSets(query);
    setPromptSets(list);
    if (list.length === 0) {
      setSelectedPromptSetId(null);
      setSelectedVersionId(null);
      setVersions([]);
      return;
    }
    const keep = list.some((item) => item.id === selectedPromptSetId);
    setSelectedPromptSetId(keep ? selectedPromptSetId : list[0].id);
  }

  async function loadVersions(promptSetId: string): Promise<void> {
    const list = await window.pvmApi.listVersions(promptSetId);
    setVersions(list);
    if (list.length === 0) {
      setSelectedVersionId(null);
      return;
    }
    const keep = list.some((item) => item.id === selectedVersionId);
    setSelectedVersionId(keep ? selectedVersionId : list[0].id);
  }

  useEffect(() => {
    void loadPromptSets();
  }, []);

  useEffect(() => {
    if (selectedPromptSetId) {
      void loadVersions(selectedPromptSetId);
    }
  }, [selectedPromptSetId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPromptSets(search.trim() || undefined);
    }, 200);
    return () => clearTimeout(timer);
  }, [search]);

  function openCreatePromptSet(): void {
    setPromptSetMode("create");
    setPromptSetForm(emptyPromptSetForm);
  }

  function openEditPromptSet(): void {
    if (!selectedPromptSet) {
      setStatus("请先选择一个提示词项目");
      return;
    }
    setPromptSetMode("edit");
    setPromptSetForm({
      title: selectedPromptSet.title,
      description: selectedPromptSet.description,
      tags: selectedPromptSet.tags.join(", "),
    });
  }

  async function savePromptSet(): Promise<void> {
    const title = promptSetForm.title.trim();
    if (!title) {
      setStatus("项目标题不能为空");
      return;
    }
    const tags = promptSetForm.tags
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (promptSetMode === "create") {
      const payload: CreatePromptSetInput = {
        title,
        description: promptSetForm.description.trim(),
        tags,
      };
      const created = await window.pvmApi.createPromptSet(payload);
      setSelectedPromptSetId(created.id);
      setStatus(`已创建项目：${created.title}`);
    } else if (promptSetMode === "edit" && selectedPromptSetId) {
      const payload: UpdatePromptSetInput = {
        id: selectedPromptSetId,
        title,
        description: promptSetForm.description.trim(),
        tags,
      };
      await window.pvmApi.updatePromptSet(payload.id, {
        title: payload.title,
        description: payload.description,
        tags: payload.tags,
      });
      setStatus("项目已更新");
    }
    setPromptSetMode(null);
    await loadPromptSets(search.trim() || undefined);
  }

  async function removePromptSet(id: string): Promise<void> {
    if (!window.confirm("确认删除该提示词项目？其全部版本和附件将被删除。")) {
      return;
    }
    await window.pvmApi.deletePromptSet(id);
    setStatus("项目已删除");
    await loadPromptSets(search.trim() || undefined);
  }

  function openCreateVersion(): void {
    if (!selectedPromptSetId) {
      setStatus("请先创建或选择一个提示词项目");
      return;
    }
    setVersionMode("create");
    setVersionForm({
      name: `版本 ${new Date().toLocaleString()}`,
      summary: "",
      contentMarkdown: "",
    });
  }

  function openEditVersion(): void {
    if (!selectedVersion) {
      setStatus("请先选择一个版本");
      return;
    }
    setVersionMode("edit");
    setVersionForm({
      name: selectedVersion.name,
      summary: selectedVersion.summary,
      contentMarkdown: selectedVersion.contentMarkdown,
    });
  }

  async function saveVersion(): Promise<void> {
    if (!selectedPromptSetId) {
      setStatus("请先选择一个提示词项目");
      return;
    }
    const name = versionForm.name.trim();
    if (!name) {
      setStatus("版本名称不能为空");
      return;
    }

    if (versionMode === "create") {
      const payload: CreateVersionInput = {
        promptSetId: selectedPromptSetId,
        name,
        summary: versionForm.summary.trim(),
        contentMarkdown: versionForm.contentMarkdown,
      };
      const created = await window.pvmApi.createVersion(payload);
      setSelectedVersionId(created.id);
      setStatus(`已创建版本：${created.name}`);
    } else if (versionMode === "edit" && selectedVersionId) {
      const payload: UpdateVersionInput = {
        id: selectedVersionId,
        name,
        summary: versionForm.summary.trim(),
        contentMarkdown: versionForm.contentMarkdown,
      };
      await window.pvmApi.updateVersion(payload);
      setStatus("版本已更新");
    }
    setVersionMode(null);
    await loadVersions(selectedPromptSetId);
  }

  async function removeVersion(id: string): Promise<void> {
    if (!selectedPromptSetId) {
      return;
    }
    if (!window.confirm("确认删除该版本及其附件？")) {
      return;
    }
    await window.pvmApi.deleteVersion(id);
    setStatus("版本已删除");
    await loadVersions(selectedPromptSetId);
  }

  async function addAttachments(): Promise<void> {
    if (!selectedVersionId) {
      setStatus("请先选择一个版本");
      return;
    }
    const added = await window.pvmApi.addAttachments(selectedVersionId);
    if (added.length === 0) {
      setStatus("未导入附件");
      return;
    }
    setStatus(`已导入 ${added.length} 个附件`);
    if (selectedPromptSetId) {
      await loadVersions(selectedPromptSetId);
    }
  }

  async function removeAttachment(attachmentId: string): Promise<void> {
    if (!selectedPromptSetId) return;
    await window.pvmApi.removeAttachment(attachmentId);
    setStatus("附件已删除");
    await loadVersions(selectedPromptSetId);
  }

  async function copyContent(): Promise<void> {
    if (!selectedVersionId) {
      setStatus("请先选择一个版本");
      return;
    }
    await window.pvmApi.copyVersionContent(selectedVersionId);
    setStatus("已复制版本正文");
  }

  async function copyPaths(): Promise<void> {
    if (!selectedVersionId) {
      setStatus("请先选择一个版本");
      return;
    }
    await window.pvmApi.copyAttachmentPaths(selectedVersionId);
    setStatus("已复制附件路径");
  }

  async function exportPackage(mode: "folder" | "zip"): Promise<void> {
    if (!selectedVersionId) {
      setStatus("请先选择一个版本");
      return;
    }
    const result = await window.pvmApi.exportVersionPackage(selectedVersionId, mode);
    if (!result) {
      setStatus("已取消导出");
      return;
    }
    setStatus(`导出完成：${result}`);
  }

  async function setRecommended(): Promise<void> {
    if (!selectedVersionId || !selectedPromptSetId) return;
    await window.pvmApi.setRecommendedVersion(selectedVersionId);
    setStatus("推荐版本已更新");
    await loadVersions(selectedPromptSetId);
  }

  const preview = useMemo(
    () => marked.parse(selectedVersion?.contentMarkdown ?? ""),
    [selectedVersion?.contentMarkdown]
  );

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand-block">
          <h1>Prompt Version Manager</h1>
          <p>本地优先提示词版本管理</p>
        </div>
        <input
          className="search-input"
          placeholder="搜索标题、标签、版本内容..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button className="primary-button" onClick={openCreatePromptSet}>
          新建项目
        </button>
        <button className="primary-button" disabled={!selectedPromptSetId} onClick={openCreateVersion}>
          新建版本
        </button>
      </header>

      <main className="main-layout">
        <aside className="pane">
          <div className="pane-header">
            <h2>提示词项目</h2>
          </div>
          <div className="pane-scroll">
            {promptSets.map((item) => (
              <button
                key={item.id}
                className={`list-card ${item.id === selectedPromptSetId ? "active" : ""}`}
                onClick={() => setSelectedPromptSetId(item.id)}
              >
                <div className="card-title-row">
                  <strong>{item.title}</strong>
                  <span>{item.versionCount} 版</span>
                </div>
                <div className="tag-row">
                  {item.tags.length === 0 ? <span className="tag">无标签</span> : null}
                  {item.tags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
          <div className="pane-footer">
            <button onClick={openEditPromptSet} disabled={!selectedPromptSetId}>
              编辑项目
            </button>
            <button onClick={() => selectedPromptSetId && void removePromptSet(selectedPromptSetId)} disabled={!selectedPromptSetId}>
              删除项目
            </button>
          </div>
        </aside>

        <section className="pane">
          <div className="pane-header">
            <h2>版本历史（最新在上）</h2>
          </div>
          <div className="pane-scroll">
            {versions.map((item) => (
              <button
                key={item.id}
                className={`list-card ${item.id === selectedVersionId ? "active" : ""}`}
                onClick={() => setSelectedVersionId(item.id)}
              >
                <div className="card-title-row">
                  <strong>{item.name}</strong>
                  {item.isRecommended ? <span className="recommended-badge">推荐</span> : null}
                </div>
                <p className="summary-line">{item.summary || "无版本说明"}</p>
                <div className="meta-line">{formatTs(item.createdAt)}</div>
              </button>
            ))}
          </div>
          <div className="pane-footer">
            <button onClick={openEditVersion} disabled={!selectedVersionId}>
              编辑版本
            </button>
            <button onClick={() => selectedVersionId && void removeVersion(selectedVersionId)} disabled={!selectedVersionId}>
              删除版本
            </button>
          </div>
        </section>

        <section className="pane">
          <div className="pane-header">
            <h2>版本详情</h2>
          </div>
          {selectedVersion ? (
            <div className="detail-scroll">
              <div className="detail-grid">
                <label>版本名称</label>
                <input value={selectedVersion.name} readOnly />
                <label>版本说明</label>
                <textarea value={selectedVersion.summary} readOnly rows={3} />
                <label>创建时间</label>
                <input value={formatTs(selectedVersion.createdAt)} readOnly />
                <label>推荐版本</label>
                <input value={selectedVersion.isRecommended ? "是" : "否"} readOnly />
              </div>

              <div className="markdown-block">
                <h3>Markdown 正文</h3>
                <pre className="markdown-source">{selectedVersion.contentMarkdown || "（空）"}</pre>
                <h3>预览</h3>
                <article className="markdown-preview" dangerouslySetInnerHTML={{ __html: String(preview) }} />
              </div>

              <div className="attachment-block">
                <div className="attachment-header">
                  <h3>附件</h3>
                  <button onClick={() => void addAttachments()}>添加附件</button>
                </div>
                <ul className="attachment-list">
                  {selectedVersion.attachments.map((attachment) => (
                    <li key={attachment.id}>
                      <div>
                        <strong>{attachment.originalName}</strong>
                        <p>
                          {attachmentLabel(attachment.kind)} · {attachment.storedPath}
                        </p>
                      </div>
                      <button onClick={() => void removeAttachment(attachment.id)}>删除</button>
                    </li>
                  ))}
                  {selectedVersion.attachments.length === 0 ? (
                    <li className="empty-attachment">暂无附件</li>
                  ) : null}
                </ul>
              </div>
            </div>
          ) : (
            <div className="empty-state">请在中间栏选择一个版本进行查看与编辑。</div>
          )}
        </section>
      </main>

      <footer className="bottom-bar">
        <div className="status-text">{status}</div>
        <div className="bottom-actions">
          <button onClick={() => void copyContent()} disabled={!selectedVersionId}>
            复制提示词正文
          </button>
          <button onClick={() => void copyPaths()} disabled={!selectedVersionId}>
            复制附件路径
          </button>
          <button onClick={() => void exportPackage("folder")} disabled={!selectedVersionId}>
            导出文件夹
          </button>
          <button onClick={() => void exportPackage("zip")} disabled={!selectedVersionId}>
            导出 ZIP
          </button>
          <button onClick={() => void setRecommended()} disabled={!selectedVersionId}>
            设为推荐版本
          </button>
        </div>
      </footer>

      {promptSetMode ? (
        <div className="modal-mask">
          <div className="modal">
            <h3>{promptSetMode === "create" ? "新建提示词项目" : "编辑提示词项目"}</h3>
            <label>标题</label>
            <input
              value={promptSetForm.title}
              onChange={(event) => setPromptSetForm((prev) => ({ ...prev, title: event.target.value }))}
            />
            <label>描述</label>
            <textarea
              rows={3}
              value={promptSetForm.description}
              onChange={(event) => setPromptSetForm((prev) => ({ ...prev, description: event.target.value }))}
            />
            <label>标签（逗号分隔）</label>
            <input
              value={promptSetForm.tags}
              onChange={(event) => setPromptSetForm((prev) => ({ ...prev, tags: event.target.value }))}
            />
            <div className="modal-actions">
              <button onClick={() => setPromptSetMode(null)}>取消</button>
              <button className="primary-button" onClick={() => void savePromptSet()}>
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {versionMode ? (
        <div className="modal-mask">
          <div className="modal large">
            <h3>{versionMode === "create" ? "新建版本" : "编辑版本"}</h3>
            <label>版本名称</label>
            <input
              value={versionForm.name}
              onChange={(event) => setVersionForm((prev) => ({ ...prev, name: event.target.value }))}
            />
            <label>版本说明</label>
            <textarea
              rows={3}
              value={versionForm.summary}
              onChange={(event) => setVersionForm((prev) => ({ ...prev, summary: event.target.value }))}
            />
            <label>提示词正文（Markdown）</label>
            <textarea
              rows={12}
              value={versionForm.contentMarkdown}
              onChange={(event) => setVersionForm((prev) => ({ ...prev, contentMarkdown: event.target.value }))}
            />
            <div className="modal-actions">
              <button onClick={() => setVersionMode(null)}>取消</button>
              <button className="primary-button" onClick={() => void saveVersion()}>
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
