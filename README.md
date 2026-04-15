# Prompt Version Manager

A desktop application for managing prompts and their version history. Built with Electron, React, TypeScript, and SQLite.

## Features

- **Prompt Management**: Create, edit, delete prompt sets with tags
- **Version History**: Multiple versions per prompt, sorted by creation time (newest first)
- **Rich Content**: Markdown support for prompt content with live preview
- **Attachments**: Image, document, and video attachments per version
- **One-click Copy**: Copy prompt content or attachment file paths to clipboard
- **Export**: Export version as a complete ZIP package (content + metadata + attachments)
- **Search**: Full-text search across prompt titles, tags, and version content
- **Tags**: Tag-based classification for prompts
- **Recommended Versions**: Mark any version as "recommended"
- **Local Storage**: All data stored locally using SQLite, attachments in local filesystem

## Tech Stack

- **Electron** - Desktop application framework
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS v4** - Styling
- **better-sqlite3** - SQLite database
- **Lucide React** - Icons
- **react-markdown** - Markdown rendering
- **archiver** - ZIP export

## Getting Started

```bash
# Install dependencies
npm install

# Rebuild native modules for Electron
npm run rebuild

# Start development
npm run dev

# Build for production
npm run build
```

## Project Structure

```
src/
├── main/              # Electron main process
│   ├── index.ts       # App entry, window creation
│   ├── database.ts    # SQLite database setup
│   └── ipc-handlers.ts # IPC handlers for all CRUD operations
├── preload/           # Preload scripts
│   └── preload.ts     # Context bridge API
└── renderer/          # React frontend
    ├── App.tsx        # Main application component
    ├── types.ts       # TypeScript type definitions
    ├── components/    # UI components
    │   ├── PromptList.tsx
    │   ├── VersionList.tsx
    │   ├── VersionDetail.tsx
    │   ├── AttachmentItem.tsx
    │   ├── TagEditor.tsx
    │   ├── SearchBar.tsx
    │   ├── EmptyState.tsx
    │   └── Toast.tsx
    └── styles/
        └── index.css  # Global styles + Tailwind
```

## Data Model

- **Prompts**: Title, description, tags, timestamps
- **Versions**: Name, description, content (Markdown), recommended flag, timestamps
- **Attachments**: Type (image/document/video), file metadata, local file path

## UI Layout

- **Left Panel**: Prompt list with search and tag display
- **Middle Panel**: Version history timeline (newest first)
- **Right Panel**: Version detail editor with Markdown preview, attachments, and actions
- **Top Bar**: Search and app branding
- **Bottom Bar**: Copy, export, and recommend actions
