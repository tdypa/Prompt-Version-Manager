import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Attachment, AttachmentCategory, PromptProject, PromptVersion, StorageInfo } from './types';

const emptyProjectDraft = {
  title: '',
  description: '',
  tagsText: '',
};

const emptyVersionDraft = {
  name: '',
  description: '',
  contentMarkdown: '',
};

function formatDateTime(input: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(input));
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseTags(input: string) {
  return [...new Set(input.split(/[,，\n]/).map((tag) => tag.trim()).filter(Boolean))];
}

function groupAttachments(version: PromptVersion | null): Record<AttachmentCategory, Attachment[]> {
  const grouped: Record<AttachmentCategory, Attachment[]> = {
    image: [],
    document: [],
    video: [],
  };

  if (!version) {
    return grouped;
  }

  for (const attachment of version.attachments) {
    grouped[attachment.category].push(attachment);
  }

  return grouped;
}

export default function App() {
  const [projects, setProjects] = useState<PromptProject[]>([]);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [search, setSearch] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [projectDraft, setProjectDraft] = useState(emptyProjectDraft);
  const [versionDraft, setVersionDraft] = useState(emptyVersionDraft);
  const [statusMessage, setStatusMessage] = useState('准备就绪');
  const [isLoading, setIsLoading] = useState(false);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const selectedVersion = useMemo(
    () => selectedProject?.versions.find((version) => version.id === selectedVersionId) ?? null,
    [selectedProject, selectedVersionId],
  );

  const groupedAttachments = useMemo(() => groupAttachments(selectedVersion), [selectedVersion]);

  async function refreshData(
    preferredProjectId: number | null = selectedProjectId,
    preferredVersionId: number | null = selectedVersionId,
    searchTerm: string = search,
  ) {
    setIsLoading(true);
    try {
      const response = await window.promptManagerApi.loadData(searchTerm);
      setProjects(response.projects);
      setStorageInfo(response.storage);

      let nextProject = response.projects.find((project) => project.id === preferredProjectId) ?? null;

      if (!nextProject && preferredVersionId !== null) {
        nextProject = response.projects.find((project) => project.versions.some((version) => version.id === preferredVersionId)) ?? null;
      }

      if (!nextProject) {
        nextProject = response.projects[0] ?? null;
      }

      const nextVersion = nextProject?.versions.find((version) => version.id === preferredVersionId) ?? nextProject?.versions[0] ?? null;

      setSelectedProjectId(nextProject?.id ?? null);
      setSelectedVersionId(nextVersion?.id ?? null);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '数据加载失败。');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshData(selectedProjectId, selectedVersionId, search);
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    void refreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedProject) {
      setProjectDraft(emptyProjectDraft);
      return;
    }

    setProjectDraft({
      title: selectedProject.title,
      description: selectedProject.description,
      tagsText: selectedProject.tags.join(', '),
    });
  }, [selectedProject]);

  useEffect(() => {
    if (!selectedVersion) {
      setVersionDraft(emptyVersionDraft);
      return;
    }

    setVersionDraft({
      name: selectedVersion.name,
      description: selectedVersion.description,
      contentMarkdown: selectedVersion.contentMarkdown,
    });
  }, [selectedVersion]);

  async function handleCreateProject() {
    const response = await window.promptManagerApi.createProject();
    setStatusMessage('已创建新提示词项目。');
    await refreshData(response.projectId, null, search);
  }

  async function handleSaveProject() {
    if (!selectedProject) {
      return;
    }

    await window.promptManagerApi.updateProject({
      id: selectedProject.id,
      title: projectDraft.title,
      description: projectDraft.description,
      tags: parseTags(projectDraft.tagsText),
    });
    setStatusMessage('项目信息已保存。');
    await refreshData(selectedProject.id, selectedVersionId, search);
  }

  async function handleDeleteProject() {
    if (!selectedProject) {
      return;
    }

    if (!window.confirm(`确认删除项目「${selectedProject.title}」及其全部版本吗？`)) {
      return;
    }

    await window.promptManagerApi.deleteProject(selectedProject.id);
    setStatusMessage('项目已删除。');
    await refreshData(null, null, search);
  }

  async function handleCreateVersion() {
    if (!selectedProject) {
      return;
    }

    const response = await window.promptManagerApi.createVersion(selectedProject.id);
    setStatusMessage('已创建新版本。');
    await refreshData(selectedProject.id, response.versionId, search);
  }

  async function handleSaveVersion() {
    if (!selectedVersion) {
      return;
    }

    await window.promptManagerApi.updateVersion({
      id: selectedVersion.id,
      name: versionDraft.name,
      description: versionDraft.description,
      contentMarkdown: versionDraft.contentMarkdown,
    });
    setStatusMessage('版本内容已保存。');
    await refreshData(selectedProjectId, selectedVersion.id, search);
  }

  async function handleDeleteVersion() {
    if (!selectedVersion) {
      return;
    }

    if (!window.confirm(`确认删除版本「${selectedVersion.name}」吗？`)) {
      return;
    }

    const currentProjectId = selectedProjectId;
    await window.promptManagerApi.deleteVersion(selectedVersion.id);
    setStatusMessage('版本已删除。');
    await refreshData(currentProjectId, null, search);
  }

  async function handleSetRecommended() {
    if (!selectedVersion) {
      return;
    }

    await window.promptManagerApi.setRecommendedVersion(selectedVersion.id);
    setStatusMessage('已设为推荐版本。');
    await refreshData(selectedProjectId, selectedVersion.id, search);
  }

  async function handleCopyContent() {
    if (!selectedVersion) {
      return;
    }

    await window.promptManagerApi.copyVersionContent(selectedVersion.id);
    setStatusMessage('提示词正文已复制到剪贴板。');
  }

  async function handleCopyAttachmentPaths() {
    if (!selectedVersion) {
      return;
    }

    const response = await window.promptManagerApi.copyAttachmentPaths(selectedVersion.id);
    setStatusMessage(response.count > 0 ? `已复制 ${response.count} 个附件路径。` : '当前版本暂无附件。');
  }

  async function handleExport(format: 'folder' | 'zip') {
    if (!selectedVersion) {
      return;
    }

    const response = await window.promptManagerApi.exportVersion({
      versionId: selectedVersion.id,
      format,
    });

    if (response.cancelled) {
      setStatusMessage('已取消导出。');
      return;
    }

    setStatusMessage(`${format === 'zip' ? 'ZIP' : '文件夹'} 导出完成：${response.exportPath}`);
  }

  async function handleAddAttachment(category: AttachmentCategory) {
    if (!selectedVersion) {
      return;
    }

    const response = await window.promptManagerApi.addAttachments({
      versionId: selectedVersion.id,
      category,
    });

    if (response.cancelled) {
      setStatusMessage('已取消添加附件。');
      return;
    }

    setStatusMessage('附件已导入本地素材库。');
    await refreshData(selectedProjectId, selectedVersion.id, search);
  }

  async function handleRemoveAttachment(attachmentId: number) {
    await window.promptManagerApi.removeAttachment(attachmentId);
    setStatusMessage('附件已删除。');
    await refreshData(selectedProjectId, selectedVersionId, search);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Prompt Version Manager</p>
          <h1>本地优先的提示词版本工作台</h1>
        </div>
        <div className="topbar-actions">
          <input
            className="search-input"
            placeholder="搜索标题、标签、版本内容..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button className="primary-button" onClick={() => void handleCreateProject()}>
            新建提示词
          </button>
        </div>
      </header>

      <div className="meta-strip">
        <span>{isLoading ? '正在同步本地数据...' : statusMessage}</span>
        {storageInfo ? (
          <span className="storage-text">
            SQLite：{storageInfo.databasePath} ｜ Assets：{storageInfo.assetsPath}
          </span>
        ) : null}
      </div>

      <main className="workspace-grid">
        <aside className="panel sidebar">
          <div className="panel-header">
            <h2>提示词项目</h2>
            <span>{projects.length} 项</span>
          </div>
          <div className="list-stack">
            {projects.length === 0 ? (
              <div className="empty-card">
                <p>暂无提示词项目。</p>
                <button className="secondary-button" onClick={() => void handleCreateProject()}>
                  立即创建
                </button>
              </div>
            ) : (
              projects.map((project) => (
                <button
                  key={project.id}
                  className={`project-card ${project.id === selectedProjectId ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedProjectId(project.id);
                    setSelectedVersionId(project.versions[0]?.id ?? null);
                  }}
                >
                  <div className="card-row">
                    <strong>{project.title}</strong>
                    <span>{project.versionCount} 版</span>
                  </div>
                  <p className="card-subtle">{project.description || '未填写项目说明'}</p>
                  <div className="tag-wrap">
                    {project.tags.length > 0 ? project.tags.map((tag) => <span key={tag} className="tag">{tag}</span>) : <span className="tag ghost">未分类</span>}
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="panel versions-panel">
          <div className="panel-header">
            <div>
              <h2>{selectedProject ? selectedProject.title : '版本历史'}</h2>
              <p className="panel-caption">
                {selectedProject ? '按创建时间倒序排列，最新版本始终位于顶部。' : '请先选择或创建一个提示词项目。'}
              </p>
            </div>
            <button
              className="secondary-button"
              disabled={!selectedProject}
              onClick={() => void handleCreateVersion()}
            >
              新建版本
            </button>
          </div>

          <div className="list-stack">
            {!selectedProject ? (
              <div className="empty-card">
                <p>创建项目后即可管理多个版本。</p>
              </div>
            ) : selectedProject.versions.length === 0 ? (
              <div className="empty-card">
                <p>当前项目还没有版本。</p>
                <button className="secondary-button" onClick={() => void handleCreateVersion()}>
                  新建首个版本
                </button>
              </div>
            ) : (
              selectedProject.versions.map((version) => (
                <button
                  key={version.id}
                  className={`version-card ${version.id === selectedVersionId ? 'selected' : ''}`}
                  onClick={() => setSelectedVersionId(version.id)}
                >
                  <div className="card-row">
                    <strong>{version.name}</strong>
                    <div className="inline-badges">
                      {version.isRecommended ? <span className="badge recommended">推荐</span> : null}
                      <span className="badge">{formatDateTime(version.createdAt)}</span>
                    </div>
                  </div>
                  <p className="card-subtle">{version.description || '未填写版本说明'}</p>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="panel detail-panel">
          <div className="panel-header">
            <div>
              <h2>详情编辑区</h2>
              <p className="panel-caption">结合 Notion 的清爽感与 Raycast/Figma 的版本管理节奏。</p>
            </div>
          </div>

          <div className="detail-scroll">
            <section className="detail-card">
              <div className="section-title-row">
                <h3>项目信息</h3>
                <div className="inline-actions">
                  <button className="secondary-button" disabled={!selectedProject} onClick={() => void handleSaveProject()}>
                    保存项目
                  </button>
                  <button className="danger-button" disabled={!selectedProject} onClick={() => void handleDeleteProject()}>
                    删除项目
                  </button>
                </div>
              </div>

              <label className="field">
                <span>项目名称</span>
                <input
                  value={projectDraft.title}
                  disabled={!selectedProject}
                  onChange={(event) => setProjectDraft((draft) => ({ ...draft, title: event.target.value }))}
                />
              </label>

              <label className="field">
                <span>项目说明</span>
                <textarea
                  rows={3}
                  value={projectDraft.description}
                  disabled={!selectedProject}
                  onChange={(event) => setProjectDraft((draft) => ({ ...draft, description: event.target.value }))}
                />
              </label>

              <label className="field">
                <span>标签（逗号分隔）</span>
                <input
                  value={projectDraft.tagsText}
                  disabled={!selectedProject}
                  onChange={(event) => setProjectDraft((draft) => ({ ...draft, tagsText: event.target.value }))}
                />
              </label>
            </section>

            <section className="detail-card">
              <div className="section-title-row">
                <div>
                  <h3>版本详情</h3>
                  {selectedVersion ? (
                    <p className="section-caption">
                      创建时间：{formatDateTime(selectedVersion.createdAt)} ｜ 最近更新：{formatDateTime(selectedVersion.updatedAt)}
                    </p>
                  ) : (
                    <p className="section-caption">请选择一个版本进行编辑。</p>
                  )}
                </div>
              </div>

              <label className="field">
                <span>版本名称</span>
                <input
                  value={versionDraft.name}
                  disabled={!selectedVersion}
                  onChange={(event) => setVersionDraft((draft) => ({ ...draft, name: event.target.value }))}
                />
              </label>

              <label className="field">
                <span>版本说明</span>
                <textarea
                  rows={3}
                  value={versionDraft.description}
                  disabled={!selectedVersion}
                  onChange={(event) => setVersionDraft((draft) => ({ ...draft, description: event.target.value }))}
                />
              </label>

              <div className="markdown-grid">
                <label className="field">
                  <span>提示词正文（Markdown）</span>
                  <textarea
                    className="markdown-editor"
                    rows={16}
                    value={versionDraft.contentMarkdown}
                    disabled={!selectedVersion}
                    onChange={(event) => setVersionDraft((draft) => ({ ...draft, contentMarkdown: event.target.value }))}
                  />
                </label>

                <div className="preview-pane">
                  <span>Markdown 预览</span>
                  <div className="preview-content">
                    {versionDraft.contentMarkdown ? (
                      <ReactMarkdown>{versionDraft.contentMarkdown}</ReactMarkdown>
                    ) : (
                      <p className="placeholder-text">输入 Markdown 后，这里会实时预览版本正文。</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="attachments-section">
                <div className="section-title-row">
                  <h3>附件素材</h3>
                  <p className="section-caption">附件会自动复制到本地 assets 目录。</p>
                </div>

                {(['image', 'document', 'video'] as AttachmentCategory[]).map((category) => (
                  <div key={category} className="attachment-group">
                    <div className="attachment-group-header">
                      <strong>
                        {category === 'image' ? '图片附件' : category === 'document' ? '文档附件' : '视频附件'}
                      </strong>
                      <button
                        className="secondary-button"
                        disabled={!selectedVersion}
                        onClick={() => void handleAddAttachment(category)}
                      >
                        添加
                      </button>
                    </div>

                    {groupedAttachments[category].length === 0 ? (
                      <div className="attachment-empty">暂无此类附件。</div>
                    ) : (
                      groupedAttachments[category].map((attachment) => (
                        <div key={attachment.id} className="attachment-row">
                          <div>
                            <strong>{attachment.originalName}</strong>
                            <p className="card-subtle">
                              {formatFileSize(attachment.fileSize)} ｜ {attachment.absolutePath}
                            </p>
                          </div>
                          <button
                            className="ghost-button"
                            onClick={() => void handleRemoveAttachment(attachment.id)}
                          >
                            删除
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          <footer className="bottom-bar">
            <div className="bottom-bar-meta">
              {selectedVersion ? (
                <>
                  <strong>{selectedVersion.name}</strong>
                  <span>{selectedVersion.isRecommended ? '当前为推荐版本' : '可设为推荐版本'}</span>
                </>
              ) : (
                <span>请选择版本后可执行复制、导出与推荐操作。</span>
              )}
            </div>
            <div className="bottom-bar-actions">
              <button className="secondary-button" disabled={!selectedVersion} onClick={() => void handleCopyContent()}>
                复制正文
              </button>
              <button className="secondary-button" disabled={!selectedVersion} onClick={() => void handleCopyAttachmentPaths()}>
                复制附件路径
              </button>
              <button className="secondary-button" disabled={!selectedVersion} onClick={() => void handleExport('folder')}>
                导出文件夹
              </button>
              <button className="secondary-button" disabled={!selectedVersion} onClick={() => void handleExport('zip')}>
                导出 ZIP
              </button>
              <button className="primary-button" disabled={!selectedVersion} onClick={() => void handleSetRecommended()}>
                设为推荐版本
              </button>
              <button className="primary-button" disabled={!selectedVersion} onClick={() => void handleSaveVersion()}>
                保存版本
              </button>
              <button className="danger-button" disabled={!selectedVersion} onClick={() => void handleDeleteVersion()}>
                删除版本
              </button>
            </div>
          </footer>
        </section>
      </main>
    </div>
  );
}
