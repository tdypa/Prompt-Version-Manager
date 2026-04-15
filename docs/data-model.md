# Prompt Version Manager 数据模型（SQLite）

## 1. 设计原则

- 本地优先：所有核心数据存 SQLite。
- 附件实体与元数据分离：数据库存元数据，文件系统存真实文件。
- 可检索：针对标题、标签、版本正文建立索引策略。
- 可扩展：为后续协作/同步保留字段（如 `updated_at`）。

## 2. 实体关系总览

- `prompt_sets`（提示词项目）1 - N `versions`（版本）
- `versions` 1 - N `attachments`（附件）
- `prompt_sets` N - N `tags`，通过 `prompt_set_tags` 关联

## 3. 表结构定义（MVP）

### 3.1 `prompt_sets`

用于存储一套提示词的主信息。

字段：

- `id` TEXT PRIMARY KEY（UUID）
- `title` TEXT NOT NULL
- `description` TEXT DEFAULT ''
- `created_at` INTEGER NOT NULL（Unix ms）
- `updated_at` INTEGER NOT NULL（Unix ms）

索引：

- `idx_prompt_sets_title` on `title`
- `idx_prompt_sets_updated_at` on `updated_at DESC`

### 3.2 `versions`

用于存储某提示词项目下的具体版本。

字段：

- `id` TEXT PRIMARY KEY（UUID）
- `prompt_set_id` TEXT NOT NULL REFERENCES `prompt_sets(id)` ON DELETE CASCADE
- `name` TEXT NOT NULL
- `summary` TEXT DEFAULT ''
- `content_markdown` TEXT NOT NULL DEFAULT ''
- `is_recommended` INTEGER NOT NULL DEFAULT 0（0/1）
- `created_at` INTEGER NOT NULL（Unix ms）
- `updated_at` INTEGER NOT NULL（Unix ms）

索引：

- `idx_versions_prompt_set_created_at` on (`prompt_set_id`, `created_at DESC`)
- `idx_versions_prompt_set_recommended` on (`prompt_set_id`, `is_recommended`)

约束：

- 同一 `prompt_set_id` 下仅允许一个推荐版本：
  - 逻辑层保证：设置推荐时先将同项目其他版本置为 0，再置当前版本为 1。

### 3.3 `attachments`

用于存储版本附件元数据。

字段：

- `id` TEXT PRIMARY KEY（UUID）
- `version_id` TEXT NOT NULL REFERENCES `versions(id)` ON DELETE CASCADE
- `kind` TEXT NOT NULL CHECK (`kind` IN ('image','document','video'))
- `original_name` TEXT NOT NULL
- `stored_name` TEXT NOT NULL
- `stored_path` TEXT NOT NULL（绝对路径）
- `created_at` INTEGER NOT NULL（Unix ms）

索引：

- `idx_attachments_version_id` on `version_id`
- `idx_attachments_kind` on `kind`

### 3.4 `tags`

用于存储标签字典，避免重复。

字段：

- `id` TEXT PRIMARY KEY（UUID）
- `name` TEXT NOT NULL UNIQUE
- `created_at` INTEGER NOT NULL

索引：

- `idx_tags_name` on `name`

### 3.5 `prompt_set_tags`

用于存储项目与标签关联。

字段：

- `prompt_set_id` TEXT NOT NULL REFERENCES `prompt_sets(id)` ON DELETE CASCADE
- `tag_id` TEXT NOT NULL REFERENCES `tags(id)` ON DELETE CASCADE
- PRIMARY KEY (`prompt_set_id`, `tag_id`)

## 4. 搜索策略

MVP 使用 `LIKE` 实现模糊搜索，覆盖：

- 项目标题 `prompt_sets.title`
- 标签名 `tags.name`
- 版本名称、版本说明、版本正文

查询逻辑：

1. 先查命中项目 ID 集合（标题/标签/版本内容任一命中）。
2. 左侧项目列表展示该集合。
3. 中间版本列表仅展示当前选中项目下全部版本（倒序）。

## 5. 附件路径策略

- 附件文件真实路径：`assets/{promptSetId}/{versionId}/{timestamp}_{safeFileName}`
- 数据库存：
  - `original_name`：原始文件名
  - `stored_name`：归档后文件名
  - `stored_path`：绝对路径（用于复制路径与导出）

## 6. 导出数据结构

每次导出一个版本，导出目录结构：

- `version-meta.json`（版本元数据与附件清单）
- `prompt.md`（Markdown 正文）
- `attachments/`（复制后的附件）

如果选择 zip 导出，则对上述目录打包为 zip。
