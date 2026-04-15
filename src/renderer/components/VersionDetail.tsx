import React, { useState, useEffect, useRef } from 'react';
import { Version, Attachment, Prompt } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Copy, Download, Star, Image, FileText, Video, Trash2,
  Eye, Edit3, Save, X, Paperclip, FolderOpen
} from 'lucide-react';
import AttachmentItem from './AttachmentItem';
import TagEditor from './TagEditor';

interface Props {
  version: Version;
  prompt: Prompt;
  attachments: Attachment[];
  onUpdate: (id: string, data: { name?: string; description?: string; content?: string; is_recommended?: boolean }) => void;
  onUpdatePrompt: (id: string, data: { title?: string; description?: string; tags?: string[] }) => void;
  onAddAttachment: (type: string) => void;
  onDeleteAttachment: (id: string) => void;
  onCopyContent: () => void;
  onCopyPaths: () => void;
  onExport: () => void;
}

export default function VersionDetail({
  version, prompt, attachments, onUpdate, onUpdatePrompt, onAddAttachment,
  onDeleteAttachment, onCopyContent, onCopyPaths, onExport
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(version.name);
  const [editDesc, setEditDesc] = useState(version.description);
  const [editContent, setEditContent] = useState(version.content);
  const [showPreview, setShowPreview] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditName(version.name);
    setEditDesc(version.description);
    setEditContent(version.content);
    setIsEditing(false);
    setShowPreview(true);
  }, [version.id]);

  const handleSave = () => {
    onUpdate(version.id, {
      name: editName,
      description: editDesc,
      content: editContent,
    });
    setIsEditing(false);
    setShowPreview(true);
  };

  const handleCancel = () => {
    setEditName(version.name);
    setEditDesc(version.description);
    setEditContent(version.content);
    setIsEditing(false);
    setShowPreview(true);
  };

  const imageAttachments = attachments.filter(a => a.type === 'image');
  const docAttachments = attachments.filter(a => a.type === 'document');
  const videoAttachments = attachments.filter(a => a.type === 'video');

  return (
    <div className="flex-1 flex flex-col bg-[#0f0f0f] min-w-0">
      {/* Header */}
      <div className="px-6 py-3 border-b border-[#2a2a2a] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {isEditing ? (
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="text-lg font-semibold bg-transparent border-b border-indigo-500 text-[#f5f5f5] outline-none"
            />
          ) : (
            <h2 className="text-lg font-semibold text-[#f5f5f5] truncate">{version.name}</h2>
          )}
          {version.is_recommended === 1 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/20 shrink-0">
              <Star className="w-3 h-3 fill-amber-400" />
              推荐
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {isEditing ? (
            <>
              <button onClick={handleSave} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
                <Save className="w-3.5 h-3.5" /> 保存
              </button>
              <button onClick={handleCancel} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-[#1f1f1f] hover:bg-[#262626] text-[#a3a3a3] border border-[#2a2a2a] transition-colors">
                <X className="w-3.5 h-3.5" /> 取消
              </button>
            </>
          ) : (
            <button onClick={() => { setIsEditing(true); setShowPreview(false); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-[#1f1f1f] hover:bg-[#262626] text-[#a3a3a3] border border-[#2a2a2a] transition-colors">
              <Edit3 className="w-3.5 h-3.5" /> 编辑
            </button>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-4 space-y-5">
          {/* Description */}
          <div>
            <label className="text-xs font-medium text-[#737373] uppercase tracking-wider mb-1.5 block">版本说明</label>
            {isEditing ? (
              <input
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="添加版本说明..."
                className="w-full h-8 px-3 text-sm bg-[#171717] border border-[#2a2a2a] rounded-md text-[#e5e5e5] placeholder-[#525252] focus:outline-none focus:border-indigo-500 transition-colors"
              />
            ) : (
              <p className="text-sm text-[#a3a3a3]">{version.description || '无说明'}</p>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-medium text-[#737373] uppercase tracking-wider mb-1.5 block">标签</label>
            <TagEditor
              tags={(() => { try { return JSON.parse(prompt.tags); } catch { return []; } })()}
              onChange={(tags) => onUpdatePrompt(prompt.id, { tags })}
            />
          </div>

          {/* Prompt content */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-[#737373] uppercase tracking-wider">提示词正文</label>
              {!isEditing && (
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-1 text-[10px] text-[#737373] hover:text-[#a3a3a3] transition-colors"
                >
                  <Eye className="w-3 h-3" />
                  {showPreview ? 'Markdown' : '预览'}
                </button>
              )}
            </div>
            {isEditing ? (
              <textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="输入提示词内容，支持 Markdown..."
                className="w-full min-h-[300px] p-4 text-sm bg-[#171717] border border-[#2a2a2a] rounded-lg text-[#e5e5e5] placeholder-[#525252] focus:outline-none focus:border-indigo-500 transition-colors resize-y font-mono leading-relaxed"
              />
            ) : showPreview ? (
              <div className="markdown-body p-4 bg-[#171717] border border-[#2a2a2a] rounded-lg min-h-[200px] text-[#d4d4d4]">
                {version.content ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{version.content}</ReactMarkdown>
                ) : (
                  <p className="text-[#525252] italic">暂无内容</p>
                )}
              </div>
            ) : (
              <pre className="p-4 bg-[#171717] border border-[#2a2a2a] rounded-lg min-h-[200px] text-sm text-[#d4d4d4] font-mono whitespace-pre-wrap">
                {version.content || '暂无内容'}
              </pre>
            )}
          </div>

          {/* Attachments */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-medium text-[#737373] uppercase tracking-wider flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5" /> 附件
                <span className="text-[10px] text-[#525252]">({attachments.length})</span>
              </label>
              <div className="flex items-center gap-1">
                <button onClick={() => onAddAttachment('image')} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-[#1f1f1f] hover:bg-[#262626] text-[#a3a3a3] border border-[#2a2a2a] transition-colors">
                  <Image className="w-3 h-3" /> 图片
                </button>
                <button onClick={() => onAddAttachment('document')} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-[#1f1f1f] hover:bg-[#262626] text-[#a3a3a3] border border-[#2a2a2a] transition-colors">
                  <FileText className="w-3 h-3" /> 文档
                </button>
                <button onClick={() => onAddAttachment('video')} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-[#1f1f1f] hover:bg-[#262626] text-[#a3a3a3] border border-[#2a2a2a] transition-colors">
                  <Video className="w-3 h-3" /> 视频
                </button>
              </div>
            </div>

            {attachments.length === 0 ? (
              <div className="p-6 bg-[#171717] border border-[#2a2a2a] border-dashed rounded-lg text-center">
                <Paperclip className="w-6 h-6 text-[#333] mx-auto mb-2" />
                <p className="text-xs text-[#525252]">拖放文件或点击上方按钮添加附件</p>
              </div>
            ) : (
              <div className="space-y-4">
                {imageAttachments.length > 0 && (
                  <div>
                    <h4 className="text-[10px] text-[#525252] uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Image className="w-3 h-3" /> 图片 ({imageAttachments.length})
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      {imageAttachments.map(att => (
                        <AttachmentItem key={att.id} attachment={att} onDelete={onDeleteAttachment} />
                      ))}
                    </div>
                  </div>
                )}
                {docAttachments.length > 0 && (
                  <div>
                    <h4 className="text-[10px] text-[#525252] uppercase tracking-wider mb-2 flex items-center gap-1">
                      <FileText className="w-3 h-3" /> 文档 ({docAttachments.length})
                    </h4>
                    <div className="space-y-1">
                      {docAttachments.map(att => (
                        <AttachmentItem key={att.id} attachment={att} onDelete={onDeleteAttachment} />
                      ))}
                    </div>
                  </div>
                )}
                {videoAttachments.length > 0 && (
                  <div>
                    <h4 className="text-[10px] text-[#525252] uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Video className="w-3 h-3" /> 视频 ({videoAttachments.length})
                    </h4>
                    <div className="space-y-1">
                      {videoAttachments.map(att => (
                        <AttachmentItem key={att.id} attachment={att} onDelete={onDeleteAttachment} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="pt-2 border-t border-[#1f1f1f]">
            <div className="flex items-center gap-6 text-[10px] text-[#525252]">
              <span>创建: {new Date(version.created_at).toLocaleString('zh-CN')}</span>
              <span>更新: {new Date(version.updated_at).toLocaleString('zh-CN')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="px-6 py-3 border-t border-[#2a2a2a] flex items-center justify-between shrink-0 bg-[#0f0f0f]">
        <div className="flex items-center gap-2">
          <button
            onClick={onCopyContent}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-[#1f1f1f] hover:bg-[#262626] text-[#a3a3a3] border border-[#2a2a2a] transition-colors"
          >
            <Copy className="w-3.5 h-3.5" /> 复制正文
          </button>
          <button
            onClick={onCopyPaths}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-[#1f1f1f] hover:bg-[#262626] text-[#a3a3a3] border border-[#2a2a2a] transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5" /> 复制路径
          </button>
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-[#1f1f1f] hover:bg-[#262626] text-[#a3a3a3] border border-[#2a2a2a] transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> 导出 ZIP
          </button>
        </div>

        <button
          onClick={() => onUpdate(version.id, { is_recommended: version.is_recommended !== 1 })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors ${
            version.is_recommended === 1
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20 hover:bg-amber-500/25'
              : 'bg-[#1f1f1f] text-[#a3a3a3] border border-[#2a2a2a] hover:bg-[#262626]'
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${version.is_recommended === 1 ? 'fill-amber-400' : ''}`} />
          {version.is_recommended === 1 ? '取消推荐' : '设为推荐'}
        </button>
      </div>
    </div>
  );
}
