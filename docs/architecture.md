# Prompt Version Manager MVP 设计说明

## 1. 产品目标

Prompt Version Manager 是一个本地优先的桌面端提示词管理工具，用于管理「提示词项目」及其多个历史版本。MVP 聚焦以下能力：

- 维护提示词项目及标签分类。
- 为每个项目管理多个版本，并按创建时间倒序展示。
- 为版本保存 Markdown 正文、图片/文档/视频附件、版本说明与推荐状态。
- 支持搜索标题、标签、版本内容。
- 支持复制提示词正文、复制附件绝对路径、导出完整版本素材包。
- 将结构化数据保存在 SQLite，本地附件保存在 `assets` 目录。

## 2. 信息架构

### 2.1 页面结构

- 顶部工具栏
  - 全局搜索框
  - 新建提示词项目按钮
  - 当前本地数据库与附件目录说明
- 左侧：提示词项目列表
  - 项目标题
  - 标签
  - 版本数量
  - 当前项目高亮
- 中间：版本历史列表
  - 当前项目标题与摘要
  - 新建版本按钮
  - 版本卡片（按创建时间倒序）
    - 版本名称
    - 创建时间
    - 版本说明
    - 推荐状态
- 右侧：详情编辑区
  - 项目基础信息
    - 项目名称
    - 项目说明
    - 标签
    - 保存 / 删除项目
  - 版本详情编辑
    - 版本名称
    - 版本说明
    - Markdown 正文编辑区
    - Markdown 预览
    - 图片/文档/视频附件分组
    - 底部操作栏：复制正文、复制附件路径、导出文件夹、导出 ZIP、设为推荐版本、保存、删除

### 2.2 导航原则

- 顶部搜索始终作用于全局，返回匹配项目。
- 选中项目后，中间区域仅展示该项目的版本历史。
- 选中版本后，右侧区域进入该版本的编辑与导出上下文。
- 所有写操作在本地完成，无需联网。

## 3. 数据模型

### 3.1 实体关系

- `projects`
  - 一套提示词项目的容器。
- `tags`
  - 标签字典，便于复用与搜索。
- `project_tags`
  - 项目与标签的多对多映射。
- `versions`
  - 属于某个项目的历史版本。
- `attachments`
  - 属于某个版本的附件，按图片/文档/视频分类。

关系如下：

- 一个 `project` 拥有多个 `version`。
- 一个 `project` 拥有多个 `tag`。
- 一个 `version` 拥有多个 `attachment`。
- 一个项目在任意时刻最多有一个推荐版本。

### 3.2 SQLite 表设计

#### projects

- `id INTEGER PRIMARY KEY`
- `title TEXT NOT NULL`
- `description TEXT DEFAULT ''`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

#### tags

- `id INTEGER PRIMARY KEY`
- `name TEXT NOT NULL UNIQUE`

#### project_tags

- `project_id INTEGER NOT NULL`
- `tag_id INTEGER NOT NULL`
- 唯一索引：`(project_id, tag_id)`

#### versions

- `id INTEGER PRIMARY KEY`
- `project_id INTEGER NOT NULL`
- `name TEXT NOT NULL`
- `description TEXT DEFAULT ''`
- `content_markdown TEXT DEFAULT ''`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- `is_recommended INTEGER DEFAULT 0`

#### attachments

- `id INTEGER PRIMARY KEY`
- `version_id INTEGER NOT NULL`
- `category TEXT NOT NULL`
- `original_name TEXT NOT NULL`
- `stored_name TEXT NOT NULL`
- `relative_path TEXT NOT NULL`
- `mime_type TEXT DEFAULT ''`
- `file_size INTEGER DEFAULT 0`
- `created_at TEXT NOT NULL`

### 3.3 查询策略

- 版本列表查询：`ORDER BY datetime(created_at) DESC, id DESC`
- 搜索：
  - `projects.title`
  - `tags.name`
  - `versions.name`
  - `versions.description`
  - `versions.content_markdown`
- 推荐版本：
  - 通过事务将同一项目下其他版本的 `is_recommended` 置为 `0`，目标版本置为 `1`

## 4. 本地文件策略

- SQLite 文件位于 Electron `userData` 目录下。
- 附件统一复制到 `userData/assets/<projectId>/<versionId>/`。
- 导出版本时生成：
  - `prompt.md`
  - `metadata.json`
  - `attachments/images`
  - `attachments/documents`
  - `attachments/videos`

## 5. 核心交互流程

### 5.1 新建项目

1. 用户点击顶部「新建提示词」。
2. 系统创建默认标题项目并自动选中。
3. 右侧填写项目名称、说明、标签并保存。

### 5.2 新建版本

1. 用户在中间栏点击「新建版本」。
2. 系统创建新的空白版本并写入当前时间。
3. 列表自动将该版本置顶并选中。
4. 用户在右侧填写版本详情与正文。

### 5.3 管理附件

1. 用户在对应分类点击添加附件。
2. 系统打开本地文件选择器。
3. 选中的文件被复制进本地 `assets` 目录。
4. SQLite 中记录附件元数据，右侧即时刷新。

### 5.4 复制与导出

1. 复制正文：将 Markdown 正文写入系统剪贴板。
2. 复制附件路径：将当前版本全部附件的绝对路径按行写入剪贴板。
3. 导出文件夹：选择目录后生成版本素材包文件夹。
4. 导出 ZIP：选择保存位置后压缩导出版本素材包。

### 5.5 搜索

1. 用户在顶部输入关键词。
2. 系统查询标题、标签和版本内容。
3. 左侧仅显示匹配项目。
4. 若当前选中项已不在结果中，则自动切换到第一项。

## 6. MVP 范围与非目标

### 6.1 MVP 已覆盖

- 本地 SQLite 持久化
- 附件本地存储
- 三栏布局桌面端原型
- 项目 / 版本 / 附件 CRUD
- 推荐版本
- 搜索与标签
- 复制与导出

### 6.2 暂不覆盖

- 云同步
- 富文本 Markdown 编辑器插件生态
- 拖拽上传
- 多窗口协作
- 自动版本 diff
- 用户权限与团队空间
