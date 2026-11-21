import React, { useRef, useState } from 'react';
import {
  Plus,
  FolderOpen,
  Copy,
  Trash2,
  Download,
  Upload,
  ArrowRight,
  Film,
  FileText,
  Layers,
  Sparkles,
  Check,
  Edit3,
} from 'lucide-react';
import { CreativePreset, Project, WorkspaceTab } from '../types/studio';
import { getPresetById } from '../data/creativePresets';
import { formatTimecode, getTotalDuration } from '../engine/timelineMath';
import { LoadedMediaCache } from '../engine/compositor';
import { CompositionPreview } from './CompositionPreview';

interface DashboardViewProps {
  activeProject: Project;
  projects: Project[];
  customPresets: CreativePreset[];
  mediaCache: LoadedMediaCache;
  currentTime: number;
  isPlaying: boolean;
  storageInfo: { usageBytes: number; quotaBytes: number; percent: number; opfsSupported: boolean };
  onTimeChange: (t: number) => void;
  onTogglePlay: () => void;
  onNavigate: (tab: WorkspaceTab) => void;
  onSelectProject: (id: string) => void;
  onOpenWizard: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  activeProject,
  projects,
  customPresets,
  mediaCache,
  currentTime,
  isPlaying,
  storageInfo,
  onTimeChange,
  onTogglePlay,
  onNavigate,
  onSelectProject,
  onOpenWizard,
}) => {
  const duration = getTotalDuration(activeProject);
  const preset = getPresetById(activeProject.settings.primaryPresetId, customPresets);
  const approvedCount = activeProject.storyboard.filter((s) => s.approved).length;
  const mbUsed = (storageInfo.usageBytes / (1024 * 1024)).toFixed(1);

  const stages: Array<{ label: string; metric: string; tab: WorkspaceTab; icon: React.ReactNode }> = [
    {
      label: 'AI Creator & Research',
      metric: `${activeProject.research.length} findings · ${activeProject.settings.researchMode}`,
      tab: 'ai-creator',
      icon: <Sparkles className="w-4 h-4 text-amber-400" />,
    },
    {
      label: 'Script Lab',
      metric: `${activeProject.script.length} sections`,
      tab: 'script-lab',
      icon: <FileText className="w-4 h-4 text-sky-400" />,
    },
    {
      label: 'Storyboard',
      metric: `${approvedCount}/${activeProject.storyboard.length} approved`,
      tab: 'storyboard',
      icon: <Layers className="w-4 h-4 text-indigo-400" />,
    },
    {
      label: 'Timeline & Export',
      metric: `${activeProject.clips.length} clips · ${formatTimecode(duration, activeProject.settings.fps)}`,
      tab: 'video-editor',
      icon: <Film className="w-4 h-4 text-emerald-400" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Hero Row: Active Project Overview + Live Stage Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-5 space-y-5">
          <div>
            <p className="text-xs font-mono text-amber-400">Active Production</p>
            <h1 className="text-2xl font-bold text-slate-100 mt-1">{activeProject.title}</h1>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">{activeProject.description}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-3 font-mono tabular-nums">
              <span>{preset.name}</span>
              <span aria-hidden="true">·</span>
              <span>{activeProject.settings.aspectRatio}</span>
              <span aria-hidden="true">·</span>
              <span>
                {activeProject.settings.width}×{activeProject.settings.height}
              </span>
              <span aria-hidden="true">·</span>
              <span>{activeProject.settings.fps} FPS</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('video-editor')}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400 transition-colors"
            >
              <span>Open Video Editor</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('export-studio')}
              className="px-4 py-2 rounded-md bg-[#191E2A] border border-[#2B3346] text-slate-200 font-medium text-xs hover:bg-[#222838] transition-colors"
            >
              Render Video
            </button>
            <button
              type="button"
              onClick={onOpenWizard}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-[#2B3346] text-slate-300 text-xs hover:text-white hover:bg-[#191E2A] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>
          </div>

          {/* Pipeline Quick Jumps */}
          <div className="border-t border-[#202532] pt-4 space-y-2">
            <h2 className="text-xs font-semibold text-slate-400">Production Workflow</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {stages.map((st) => (
                <button
                  key={st.label}
                  type="button"
                  onClick={() => onNavigate(st.tab)}
                  className="text-left p-3 rounded-lg bg-[#12161F] border border-[#222836] hover:border-[#39445E] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-100">{st.label}</span>
                    {st.icon}
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono mt-1 tabular-nums">{st.metric}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="xl:col-span-7">
          <CompositionPreview
            project={activeProject}
            customPresets={customPresets}
            mediaCache={mediaCache}
            currentTime={currentTime}
            isPlaying={isPlaying}
            onTimeChange={onTimeChange}
            onTogglePlay={onTogglePlay}
          />
        </div>
      </div>

      {/* Bottom Row: Recent Projects & Local Storage Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4 border-t border-[#1F2430]">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Studio Projects ({projects.length})</h2>
            <button
              type="button"
              onClick={() => onNavigate('projects')}
              className="text-xs text-amber-400 hover:text-amber-300"
            >
              Manage all projects
            </button>
          </div>
          <div className="divide-y divide-[#1E2330] border border-[#222836] rounded-lg bg-[#11151D]">
            {projects.slice(0, 5).map((p) => {
              const isActive = p.id === activeProject.id;
              return (
                <div key={p.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-100 truncate">{p.title}</span>
                      {isActive && <span className="text-[11px] font-mono text-amber-400">Active</span>}
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {p.subject} · {p.settings.aspectRatio} · {p.storyboard.length} scenes
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectProject(p.id)}
                    className="px-3 py-1.5 rounded bg-[#1A202D] border border-[#2B3346] text-xs text-slate-200 hover:bg-[#232B3D] whitespace-nowrap shrink-0"
                  >
                    {isActive ? 'Loaded' : 'Open'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-200">Local Workspace Storage</h2>
          <div className="p-4 rounded-lg bg-[#11151D] border border-[#222836] space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-400">IndexedDB Usage</span>
              <span className="text-sm font-mono text-slate-100 tabular-nums">{mbUsed} MB</span>
            </div>
            <div className="w-full h-1.5 bg-[#1F2533] rounded overflow-hidden">
              <div
                className="h-full bg-amber-500"
                style={{ width: `${Math.max(2, Math.min(100, storageInfo.percent))}%` }}
              />
            </div>
            <div className="text-xs text-slate-400 space-y-1">
              <p>Persistence: IndexedDB Auto-Save</p>
              <p>OPFS Support: {storageInfo.opfsSupported ? 'Available' : 'IndexedDB Fallback'}</p>
              <p>Portability: Full JSON export & import enabled</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ProjectsManagerViewProps {
  projects: Project[];
  activeProjectId: string;
  customPresets: CreativePreset[];
  onSelectProject: (id: string) => void;
  onOpenWizard: () => void;
  onRenameProject: (id: string, newTitle: string) => void;
  onDuplicateProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onExportJson: (project: Project) => void;
  onImportJson: (jsonText: string) => Promise<void>;
}

export const ProjectsManagerView: React.FC<ProjectsManagerViewProps> = ({
  projects,
  activeProjectId,
  customPresets,
  onSelectProject,
  onOpenWizard,
  onRenameProject,
  onDuplicateProject,
  onDeleteProject,
  onExportJson,
  onImportJson,
}) => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = projects.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.subject.toLowerCase().includes(search.toLowerCase())
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImportError(null);
      const text = await file.text();
      await onImportJson(text);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Unable to import project JSON.');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Projects</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Create, duplicate, rename, delete, or import/export portable JSON video projects.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter projects..."
            aria-label="Filter projects"
            className="bg-[#11151D] border border-[#283044] rounded-md px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500"
          />
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleFileChange} className="hidden" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#2B3346] bg-[#141822] text-xs text-slate-200 hover:bg-[#1C2230]"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import JSON</span>
          </button>
          <button
            type="button"
            onClick={onOpenWizard}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {importError && (
        <div role="alert" className="px-4 py-2.5 rounded-lg bg-red-950/60 border border-red-800 text-red-200 text-xs">
          {importError}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="p-10 text-center rounded-lg border border-[#222836] bg-[#11151D]">
          <p className="text-sm text-slate-300">No matching projects found.</p>
          <button
            type="button"
            onClick={onOpenWizard}
            className="mt-3 px-4 py-2 rounded-md bg-amber-500 text-slate-950 font-semibold text-xs"
          >
            Create Your First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const preset = getPresetById(p.settings.primaryPresetId, customPresets);
            const isCurrent = p.id === activeProjectId;
            const totalDur = getTotalDuration(p);

            return (
              <div
                key={p.id}
                className={`p-4 rounded-lg border bg-[#11151D] flex flex-col justify-between gap-4 ${
                  isCurrent ? 'border-amber-500/70' : 'border-[#222836]'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    {editingId === p.id ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          aria-label="Rename project title"
                          className="flex-1 bg-[#0B0E14] border border-amber-500 rounded px-2 py-1 text-xs text-slate-100"
                        />
                        <button
                          type="button"
                          aria-label="Save project rename"
                          onClick={() => {
                            if (editTitle.trim()) onRenameProject(p.id, editTitle.trim());
                            setEditingId(null);
                          }}
                          className="p-1 rounded bg-amber-500 text-slate-950"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <h3 className="text-sm font-bold text-slate-100">{p.title}</h3>
                    )}
                    <span className="text-[11px] font-mono text-slate-400 shrink-0">
                      {p.settings.aspectRatio}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2">{p.subject}</p>
                  <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                    {preset.name} · {p.storyboard.length} scenes · {formatTimecode(totalDur, p.settings.fps)}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#1D2230]">
                  <button
                    type="button"
                    onClick={() => onSelectProject(p.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium ${
                      isCurrent
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40'
                        : 'bg-[#1A202D] text-slate-200 hover:bg-[#232B3D]'
                    }`}
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>{isCurrent ? 'Active' : 'Open'}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Rename ${p.title}`}
                      onClick={() => {
                        setEditingId(p.id);
                        setEditTitle(p.title);
                      }}
                      className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#1E2433]"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Duplicate ${p.title}`}
                      onClick={() => onDuplicateProject(p.id)}
                      className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#1E2433]"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Export JSON for ${p.title}`}
                      onClick={() => onExportJson(p)}
                      className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#1E2433]"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    {projects.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Delete ${p.title}`}
                        onClick={() => onDeleteProject(p.id)}
                        className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-950/40"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
