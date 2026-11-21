import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  Sparkles,
  FileText,
  Layers,
  Images,
  Mic,
  Shapes,
  Film,
  Download,
  Settings,
  Menu,
  X,
  Plus,
} from 'lucide-react';
import {
  AssetKind,
  CreativePreset,
  MediaAsset,
  Project,
  TimelineClip,
  WorkspaceTab,
} from './types/studio';
import { ProjectStorage } from './storage/projectDb';
import { createSeedProjects } from './data/seedProjects';
import { createBlankProject, NewProjectInput, parseImportedProject } from './engine/projectFactory';
import { getTotalDuration } from './engine/timelineMath';
import { LoadedMediaCache } from './engine/compositor';
import { AiClient, ModelRegistryResponse } from './services/aiClient';
import { DashboardView, ProjectsManagerView } from './components/DashboardAndProjectsView';
import { AICreatorView } from './components/AICreatorView';
import { ScriptLabView } from './components/ScriptLabView';
import { StoryboardView } from './components/StoryboardView';
import { AssetLibraryView } from './components/AssetLibraryView';
import { VoiceStudioView } from './components/VoiceStudioView';
import { MotionComposerView } from './components/MotionComposerView';
import { VideoEditorView } from './components/VideoEditorView';
import { ExportStudioView, SettingsView } from './components/ExportAndSettingsView';
import { ProjectWizardModal } from './components/ProjectWizardModal';

const NAV_ITEMS: Array<{ id: WorkspaceTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'ai-creator', label: 'AI Creator', icon: Sparkles },
  { id: 'script-lab', label: 'Script Lab', icon: FileText },
  { id: 'storyboard', label: 'Storyboard', icon: Layers },
  { id: 'assets', label: 'Asset Library', icon: Images },
  { id: 'voice-studio', label: 'Voice Studio', icon: Mic },
  { id: 'motion-composer', label: 'Motion Composer', icon: Shapes },
  { id: 'video-editor', label: 'Video Editor', icon: Film },
  { id: 'export-studio', label: 'Export Studio', icon: Download },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function detectAssetKind(file: File): AssetKind {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  if (name.endsWith('.glb') || name.endsWith('.gltf')) return 'model3d';
  if (name.endsWith('.svg') || type === 'image/svg+xml') return 'svg';
  if (name.endsWith('.gif') || type === 'image/gif') return 'gif';
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (name.endsWith('.ttf') || name.endsWith('.otf') || name.endsWith('.woff2')) return 'font';
  return 'document';
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [customPresets, setCustomPresets] = useState<CreativePreset[]>([]);
  const [modelRegistry, setModelRegistry] = useState<ModelRegistryResponse | null>(null);
  const [storageInfo, setStorageInfo] = useState({
    usageBytes: 0,
    quotaBytes: 0,
    percent: 0,
    opfsSupported: false,
  });

  const [currentTime, setCurrentTime] = useState(0.8);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveNotice, setSaveNotice] = useState<string>('');

  const mediaCacheRef = useRef<LoadedMediaCache>({
    images: new Map(),
    videos: new Map(),
    blobs: new Map(),
  });
  const [mediaVersion, setMediaVersion] = useState(0);
  const saveTimerRef = useRef<number | null>(null);

  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0] || null;

  const refreshStorageInfo = useCallback(async () => {
    const info = await ProjectStorage.estimateStorage();
    setStorageInfo(info);
  }, []);

  // Hydrate binary blobs for active project assets into memory cache
  const hydrateProjectAssets = useCallback(async (projectId: string) => {
    const list = await ProjectStorage.listAssets(projectId);
    setAssets(list);
    for (const asset of list) {
      if (!asset.hasBlob || mediaCacheRef.current.blobs.has(asset.id)) continue;
      const blob = await ProjectStorage.getAssetBlob(asset.id);
      if (!blob) continue;
      mediaCacheRef.current.blobs.set(asset.id, blob);
      const url = URL.createObjectURL(blob);
      if (asset.kind === 'image' || asset.kind === 'svg' || asset.kind === 'gif' || asset.kind === 'background') {
        const img = new Image();
        img.src = url;
        img.onload = () => setMediaVersion((v) => v + 1);
        mediaCacheRef.current.images.set(asset.id, img);
      } else if (asset.kind === 'video') {
        const vid = document.createElement('video');
        vid.src = url;
        vid.muted = true;
        vid.playsInline = true;
        vid.preload = 'auto';
        vid.onloadeddata = () => setMediaVersion((v) => v + 1);
        mediaCacheRef.current.videos.set(asset.id, vid);
      }
    }
    setMediaVersion((v) => v + 1);
  }, []);

  // Initial load from IndexedDB + server AI model registry
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        let loaded = await ProjectStorage.listProjects();
        if (loaded.length === 0) {
          const seeded = createSeedProjects();
          for (const p of seeded) {
            await ProjectStorage.saveProject(p);
          }
          loaded = seeded;
        }
        const savedPresets = await ProjectStorage.listCustomPresets();
        if (!cancelled) {
          setProjects(loaded);
          const storedActiveId = window.localStorage.getItem('motionforge_active_project');
          const initialId = loaded.some((p) => p.id === storedActiveId) ? storedActiveId! : loaded[0].id;
          setActiveProjectId(initialId);
          setCustomPresets(savedPresets);
          await hydrateProjectAssets(initialId);
          await refreshStorageInfo();
        }
      } catch {
        const fallback = createSeedProjects();
        if (!cancelled) {
          setProjects(fallback);
          setActiveProjectId(fallback[0].id);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void init();
    AiClient.fetchModels()
      .then((reg) => {
        if (!cancelled) setModelRegistry(reg);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [hydrateProjectAssets, refreshStorageInfo]);

  // Reload project assets when switching projects
  useEffect(() => {
    if (!activeProjectId) return;
    window.localStorage.setItem('motionforge_active_project', activeProjectId);
    setCurrentTime(0.8);
    setIsPlaying(false);
    setSelectedClipId(null);
    void hydrateProjectAssets(activeProjectId);
  }, [activeProjectId, hydrateProjectAssets]);

  // Real-time playback animation loop
  useEffect(() => {
    if (!isPlaying || !activeProject) return;
    const total = getTotalDuration(activeProject);
    let lastTs = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - lastTs) / 1000);
      lastTs = now;
      setCurrentTime((prev) => {
        const next = prev + dt;
        if (next >= total) {
          return 0;
        }
        return next;
      });
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, activeProject]);

  // Debounced auto-save helper
  const updateActiveProject = useCallback(
    (updater: (p: Project) => Project) => {
      setProjects((prev) => {
        const nextList = prev.map((p) => {
          if (p.id !== activeProjectId) return p;
          const updated = { ...updater(p), updatedAt: new Date().toISOString() };
          if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
          saveTimerRef.current = window.setTimeout(() => {
            void ProjectStorage.saveProject(updated)
              .then(() => {
                setSaveNotice('Saved');
                void refreshStorageInfo();
                window.setTimeout(() => setSaveNotice(''), 1800);
              })
              .catch(() => undefined);
          }, 220);
          return updated;
        });
        return nextList;
      });
    },
    [activeProjectId, refreshStorageInfo]
  );

  const handleCreateProject = async (input: NewProjectInput) => {
    const next = createBlankProject(input);
    await ProjectStorage.saveProject(next).catch(() => undefined);
    setProjects((prev) => [next, ...prev]);
    setActiveProjectId(next.id);
    setActiveTab('video-editor');
    void refreshStorageInfo();
  };

  const handleRenameProject = async (id: string, newTitle: string) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const updated = { ...p, title: newTitle, updatedAt: new Date().toISOString() };
        void ProjectStorage.saveProject(updated).catch(() => undefined);
        return updated;
      })
    );
  };

  const handleDuplicateProject = async (id: string) => {
    const source = projects.find((p) => p.id === id);
    if (!source) return;
    const now = new Date().toISOString();
    const copy: Project = {
      ...JSON.parse(JSON.stringify(source)),
      id: `proj-copy-${Date.now()}`,
      title: `${source.title} (Copy)`,
      createdAt: now,
      updatedAt: now,
    };
    await ProjectStorage.saveProject(copy).catch(() => undefined);
    setProjects((prev) => [copy, ...prev]);
    setActiveProjectId(copy.id);
    void refreshStorageInfo();
  };

  const handleDeleteProject = async (id: string) => {
    if (projects.length <= 1) return;
    await ProjectStorage.deleteProject(id).catch(() => undefined);
    setProjects((prev) => {
      const remaining = prev.filter((p) => p.id !== id);
      if (activeProjectId === id && remaining[0]) {
        setActiveProjectId(remaining[0].id);
      }
      return remaining;
    });
    void refreshStorageInfo();
  };

  const handleExportProjectJson = (proj: Project) => {
    const slug = proj.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'motionforge-project';
    const blob = new Blob([JSON.stringify(proj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}.motionforge.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const handleImportProjectJson = async (jsonText: string) => {
    const imported = parseImportedProject(jsonText);
    await ProjectStorage.saveProject(imported).catch(() => undefined);
    setProjects((prev) => [imported, ...prev]);
    setActiveProjectId(imported.id);
    void refreshStorageInfo();
  };

  const handleUploadFiles = async (fileList: FileList) => {
    if (!activeProject) return;
    const files = Array.from(fileList);
    for (const file of files) {
      const kind = detectAssetKind(file);
      const asset: MediaAsset = {
        id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        projectId: activeProject.id,
        name: file.name,
        kind,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        createdAt: new Date().toISOString(),
        tags: [kind, 'uploaded'],
        license: 'User supplied',
        attribution: 'Local upload',
        source: 'uploaded',
        audioCategory: kind === 'audio' ? 'narration' : undefined,
        hasBlob: true,
      };
      await ProjectStorage.saveAsset(asset, file).catch(() => undefined);
      mediaCacheRef.current.blobs.set(asset.id, file);
      const url = URL.createObjectURL(file);
      if (kind === 'image' || kind === 'svg' || kind === 'gif') {
        const img = new Image();
        img.src = url;
        img.onload = () => setMediaVersion((v) => v + 1);
        mediaCacheRef.current.images.set(asset.id, img);
      } else if (kind === 'video') {
        const vid = document.createElement('video');
        vid.src = url;
        vid.muted = true;
        vid.playsInline = true;
        vid.onloadeddata = () => setMediaVersion((v) => v + 1);
        mediaCacheRef.current.videos.set(asset.id, vid);
      }
      setAssets((prev) => [asset, ...prev]);
    }
    setMediaVersion((v) => v + 1);
    void refreshStorageInfo();
  };

  const handleAddGeneratedAsset = async (asset: MediaAsset, blob: Blob, sceneStartTime?: number) => {
    await ProjectStorage.saveAsset(asset, blob).catch(() => undefined);
    mediaCacheRef.current.blobs.set(asset.id, blob);
    const url = URL.createObjectURL(blob);
    if (asset.kind === 'image') {
      const img = new Image();
      img.src = url;
      img.onload = () => setMediaVersion((v) => v + 1);
      mediaCacheRef.current.images.set(asset.id, img);
    }
    setAssets((prev) => [asset, ...prev]);

    if (asset.kind === 'audio' && sceneStartTime !== undefined) {
      const clip: TimelineClip = {
        id: `clip-audio-${Date.now()}`,
        trackType: 'audio',
        name: asset.name,
        startTime: Number(sceneStartTime.toFixed(2)),
        duration: 5.5,
        layerOrder: 1,
        opacity: 1,
        x: 50,
        y: 50,
        width: 100,
        height: 100,
        scale: 1,
        rotation: 0,
        animation: 'fade',
        animationDuration: 0.3,
        animationDelay: 0,
        easing: 'linear',
        direction: 'center',
        assetId: asset.id,
        audioCategory: asset.audioCategory || 'narration',
        volume: 1,
        fadeIn: 0.1,
        fadeOut: 0.2,
      };
      updateActiveProject((p) => ({ ...p, clips: [...p.clips, clip] }));
      setSelectedClipId(clip.id);
    }
    setMediaVersion((v) => v + 1);
    void refreshStorageInfo();
  };

  const handleDeleteAsset = async (assetId: string) => {
    await ProjectStorage.deleteAsset(assetId).catch(() => undefined);
    mediaCacheRef.current.blobs.delete(assetId);
    mediaCacheRef.current.images.delete(assetId);
    mediaCacheRef.current.videos.delete(assetId);
    setAssets((prev) => prev.filter((a) => a.id !== assetId));
    setMediaVersion((v) => v + 1);
    void refreshStorageInfo();
  };

  const handleInsertAssetToTimeline = (asset: MediaAsset) => {
    if (!activeProject) return;
    if (asset.kind === 'model3d') {
      const next3D = { ...activeProject.scene3D, modelAssetId: asset.id };
      const clip: TimelineClip = {
        id: `clip-3d-${Date.now()}`,
        trackType: 'video',
        name: `3D · ${asset.name}`,
        startTime: Number(currentTime.toFixed(2)),
        duration: 5,
        layerOrder: 25,
        opacity: 1,
        x: 50,
        y: 50,
        width: 82,
        height: 76,
        scale: 1,
        rotation: 0,
        animation: 'orbit',
        animationDuration: 0.8,
        animationDelay: 0,
        easing: 'easeOutCubic',
        direction: 'center',
        componentType: '3DModelViewer',
        assetId: asset.id,
        motionProps: { title: asset.name, scene3D: next3D },
      };
      updateActiveProject((p) => ({ ...p, scene3D: next3D, clips: [...p.clips, clip] }));
      setSelectedClipId(clip.id);
      setActiveTab('video-editor');
      return;
    }

    const trackType =
      asset.kind === 'audio' ? 'audio' : asset.kind === 'video' ? 'video' : 'image';
    const clip: TimelineClip = {
      id: `clip-asset-${Date.now()}`,
      trackType,
      name: asset.name,
      startTime: Number(currentTime.toFixed(2)),
      duration: 5,
      layerOrder: trackType === 'audio' ? 1 : 22,
      opacity: 1,
      x: 50,
      y: 50,
      width: 78,
      height: 70,
      scale: 1,
      rotation: 0,
      animation: 'fade',
      animationDuration: 0.7,
      animationDelay: 0,
      easing: 'easeOutCubic',
      direction: 'center',
      componentType: trackType === 'video' ? 'VideoFrame' : trackType === 'image' ? 'ImageReveal' : undefined,
      assetId: asset.id,
      audioCategory: trackType === 'audio' ? asset.audioCategory || 'narration' : undefined,
      volume: trackType === 'audio' ? 1 : undefined,
      motionProps: { title: asset.name, assetId: asset.id },
    };
    updateActiveProject((p) => ({ ...p, clips: [...p.clips, clip] }));
    setSelectedClipId(clip.id);
    setActiveTab('video-editor');
  };

  if (loading || !activeProject) {
    return (
      <div className="min-h-screen bg-[#0B0D11] text-slate-200 flex items-center justify-center">
        <p className="text-sm font-mono text-slate-400">Initializing MOTIONFORGE studio workspace...</p>
      </div>
    );
  }

  // Trigger memoized mediaCache object reference when blobs hydrate
  const liveMediaCache: LoadedMediaCache = mediaVersion >= 0 ? mediaCacheRef.current : mediaCacheRef.current;

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0D11] text-[#E6E9F0]">
      {/* Studio Top Bar (Clean 3-Zone Contract) */}
      <header className="h-14 px-4 lg:px-6 bg-[#10131A] border-b border-[#202533] flex items-center justify-between gap-6 shrink-0 z-30">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            aria-label="Toggle studio navigation menu"
            onClick={() => setMobileNavOpen((v) => !v)}
            className="lg:hidden p-1.5 rounded text-slate-300 hover:bg-[#1C212E]"
          >
            {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="text-base font-extrabold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
          >
            MOTIONFORGE
          </button>
        </div>

        {/* Zone 2: Active Project Switcher & Breadcrumb Context */}
        <div className="flex items-center gap-3 min-w-0">
          <label className="sr-only" htmlFor="active-project-select">
            Switch active project
          </label>
          <select
            id="active-project-select"
            value={activeProject.id}
            onChange={(e) => setActiveProjectId(e.target.value)}
            className="bg-[#161B25] border border-[#283044] rounded-md px-3 py-1.5 text-xs font-medium text-slate-100 max-w-[240px] sm:max-w-[320px] truncate"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.settings.aspectRatio})
              </option>
            ))}
          </select>
          <span className="hidden md:inline text-xs text-slate-500 font-mono whitespace-nowrap">
            {NAV_ITEMS.find((n) => n.id === activeTab)?.label}
            {saveNotice ? ` · ${saveNotice}` : ''}
          </span>
        </div>

        {/* Zone 3: Single Primary Studio CTA */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Project</span>
          </button>
        </div>
      </header>

      {/* Main Studio Shell: Left Rail + Workspace Canvas */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Desktop Sidebar & Mobile Drawer */}
        <aside
          aria-label="Studio navigation"
          className={`${
            mobileNavOpen ? 'fixed inset-y-14 left-0 z-40 block w-60 shadow-2xl' : 'hidden'
          } lg:block lg:static lg:w-56 shrink-0 bg-[#0F1219] border-r border-[#1F2432] overflow-y-auto`}
        >
          <nav className="p-3 space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileNavOpen(false);
                  }}
                  aria-current={active ? 'page' : undefined}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#1B2231] text-amber-400'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-[#151A25]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-4 mx-3 pt-4 border-t border-[#1D2230] text-[11px] text-slate-500 space-y-1 font-mono tabular-nums">
            <p className="text-slate-400 font-sans font-medium truncate">{activeProject.title}</p>
            <p>
              {activeProject.settings.width}×{activeProject.settings.height} · {activeProject.settings.fps}fps
            </p>
            <p>{activeProject.storyboard.length} scenes · {activeProject.clips.length} clips</p>
          </div>
        </aside>

        {/* Active Workspace Main Viewport */}
        <main className="flex-1 min-w-0 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-[1440px] mx-auto">
            {activeTab === 'dashboard' && (
              <DashboardView
                activeProject={activeProject}
                projects={projects}
                customPresets={customPresets}
                mediaCache={liveMediaCache}
                currentTime={currentTime}
                isPlaying={isPlaying}
                storageInfo={storageInfo}
                onTimeChange={setCurrentTime}
                onTogglePlay={() => setIsPlaying((p) => !p)}
                onNavigate={setActiveTab}
                onSelectProject={(id) => setActiveProjectId(id)}
                onOpenWizard={() => setWizardOpen(true)}
              />
            )}

            {activeTab === 'projects' && (
              <ProjectsManagerView
                projects={projects}
                activeProjectId={activeProject.id}
                customPresets={customPresets}
                onSelectProject={(id) => {
                  setActiveProjectId(id);
                  setActiveTab('video-editor');
                }}
                onOpenWizard={() => setWizardOpen(true)}
                onRenameProject={handleRenameProject}
                onDuplicateProject={handleDuplicateProject}
                onDeleteProject={handleDeleteProject}
                onExportJson={handleExportProjectJson}
                onImportJson={handleImportProjectJson}
              />
            )}

            {activeTab === 'ai-creator' && (
              <AICreatorView
                project={activeProject}
                customPresets={customPresets}
                modelRegistry={modelRegistry}
                onUpdateProject={updateActiveProject}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === 'script-lab' && (
              <ScriptLabView
                project={activeProject}
                onUpdateProject={updateActiveProject}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === 'storyboard' && (
              <StoryboardView
                project={activeProject}
                customPresets={customPresets}
                onUpdateProject={updateActiveProject}
                onJumpToTime={(t) => setCurrentTime(t)}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === 'assets' && (
              <AssetLibraryView
                project={activeProject}
                assets={assets}
                mediaCache={liveMediaCache}
                onUploadFiles={handleUploadFiles}
                onAddGeneratedAsset={(asset, blob) => handleAddGeneratedAsset(asset, blob)}
                onDeleteAsset={handleDeleteAsset}
                onInsertAssetToTimeline={handleInsertAssetToTimeline}
              />
            )}

            {activeTab === 'voice-studio' && (
              <VoiceStudioView
                project={activeProject}
                audioAssets={assets.filter((a) => a.kind === 'audio')}
                onUpdateProject={updateActiveProject}
                onAddGeneratedAudio={(asset, blob, startT) => handleAddGeneratedAsset(asset, blob, startT)}
              />
            )}

            {activeTab === 'motion-composer' && (
              <MotionComposerView
                project={activeProject}
                customPresets={customPresets}
                modelAssets={assets.filter((a) => a.kind === 'model3d')}
                mediaCache={liveMediaCache}
                currentTime={currentTime}
                isPlaying={isPlaying}
                onTimeChange={setCurrentTime}
                onTogglePlay={() => setIsPlaying((p) => !p)}
                onUpdateProject={updateActiveProject}
                onSelectClipAndEdit={(clipId) => {
                  setSelectedClipId(clipId);
                  setActiveTab('video-editor');
                }}
              />
            )}

            {activeTab === 'video-editor' && (
              <VideoEditorView
                project={activeProject}
                assets={assets}
                customPresets={customPresets}
                mediaCache={liveMediaCache}
                currentTime={currentTime}
                isPlaying={isPlaying}
                selectedClipId={selectedClipId}
                onSelectClip={setSelectedClipId}
                onTimeChange={setCurrentTime}
                onTogglePlay={() => setIsPlaying((p) => !p)}
                onUpdateProject={updateActiveProject}
              />
            )}

            {activeTab === 'export-studio' && (
              <ExportStudioView
                project={activeProject}
                customPresets={customPresets}
                mediaCache={liveMediaCache}
                onUpdateProject={updateActiveProject}
                onExportJson={handleExportProjectJson}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                project={activeProject}
                customPresets={customPresets}
                modelRegistry={modelRegistry}
                storageInfo={storageInfo}
                onSaveCustomPreset={async (preset) => {
                  await ProjectStorage.saveCustomPreset(preset).catch(() => undefined);
                  setCustomPresets((prev) => [preset, ...prev.filter((x) => x.id !== preset.id)]);
                }}
                onDeleteCustomPreset={async (id) => {
                  await ProjectStorage.deleteCustomPreset(id).catch(() => undefined);
                  setCustomPresets((prev) => prev.filter((x) => x.id !== id));
                }}
                onApplyPresetToProject={(presetId) => {
                  updateActiveProject((p) => ({
                    ...p,
                    settings: {
                      ...p.settings,
                      primaryPresetId: presetId,
                      creativePresets: Array.from(new Set([presetId, ...p.settings.creativePresets])),
                    },
                  }));
                }}
              />
            )}
          </div>
        </main>
      </div>

      {/* Project Creation Wizard Modal */}
      <ProjectWizardModal
        open={wizardOpen}
        customPresets={customPresets}
        onClose={() => setWizardOpen(false)}
        onCreate={handleCreateProject}
      />
    </div>
  );
}
