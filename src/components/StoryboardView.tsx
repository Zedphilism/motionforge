import React, { useState } from 'react';
import {
  Plus,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Circle,
  Film,
  Code,
  Play,
} from 'lucide-react';
import {
  AnimationPreset,
  CreativePreset,
  MotionComponentType,
  Project,
  StoryboardScene,
  TransitionType,
  WorkspaceTab,
} from '../types/studio';
import { BUILTIN_CREATIVE_PRESETS } from '../data/creativePresets';
import { computeSceneWindows } from '../engine/timelineMath';
import { syncStoryboardToTimeline } from '../engine/projectFactory';
import { generateSubtitlesFromScenes } from '../engine/subtitleEngine';

interface StoryboardViewProps {
  project: Project;
  customPresets: CreativePreset[];
  onUpdateProject: (updater: (p: Project) => Project) => void;
  onJumpToTime: (t: number) => void;
  onNavigate: (tab: WorkspaceTab) => void;
}

const MOTION_COMPONENTS: MotionComponentType[] = [
  'AnimatedTitle',
  'KineticTypography',
  'BlueprintGrid',
  'TechnicalCallout',
  'AnimatedArrow',
  'TrackingMarker',
  'CircularDiagram',
  'ExplodedView',
  'DataCounter',
  'ComparisonPanel',
  'AnimatedChart',
  'ProgressIndicator',
  'InfographicCard',
  'TimelineGraphic',
  'ImageReveal',
  'VideoFrame',
  'SectionDivider',
  'AnimatedDiagram',
  '3DModelViewer',
  'EndCard',
];

const ANIMATION_PRESETS: AnimationPreset[] = [
  'fade',
  'slide',
  'scale',
  'reveal',
  'typewriter',
  'draw-line',
  'counter',
  'pulse',
  'rotate',
  'orbit',
  'wipe',
  'mask-reveal',
  'morph',
  'parallax',
  'split-transition',
  'blueprint-assembly',
];

const TRANSITIONS: TransitionType[] = [
  'cut',
  'crossfade',
  'technical-wipe',
  'slide-left',
  'split-reveal',
  'zoom-through',
];

export const StoryboardView: React.FC<StoryboardViewProps> = ({
  project,
  customPresets,
  onUpdateProject,
  onJumpToTime,
  onNavigate,
}) => {
  const [showJson, setShowJson] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const allPresets = [...BUILTIN_CREATIVE_PRESETS, ...customPresets];
  const windows = computeSceneWindows(project.storyboard);

  const updateScene = (id: string, partial: Partial<StoryboardScene>) => {
    onUpdateProject((p) => ({
      ...p,
      storyboard: p.storyboard.map((s) => (s.id === id ? { ...s, ...partial } : s)),
    }));
  };

  const addScene = () => {
    const idx = project.storyboard.length + 1;
    const next: StoryboardScene = {
      id: `scene-${Date.now()}`,
      title: `Scene ${idx}`,
      duration: 5,
      narration: 'Describe the key insight for this scene.',
      visualStyle: project.settings.primaryPresetId,
      visualType: 'motion-graphic',
      camera: 'slow-push-in',
      animation: 'slide',
      overlayText: `SCENE ${String(idx).padStart(2, '0')}`,
      subtitleText: 'Describe the key insight for this scene.',
      soundDesign: 'Subtle ambient bed',
      transition: 'crossfade',
      notes: '',
      approved: false,
      suggestedComponent: 'InfographicCard',
      assetIds: [],
    };
    onUpdateProject((p) => ({ ...p, storyboard: [...p.storyboard, next] }));
  };

  const duplicateScene = (scene: StoryboardScene, index: number) => {
    const copy: StoryboardScene = {
      ...scene,
      id: `scene-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      title: `${scene.title} (Copy)`,
      approved: false,
    };
    onUpdateProject((p) => {
      const next = [...p.storyboard];
      next.splice(index + 1, 0, copy);
      return { ...p, storyboard: next };
    });
  };

  const deleteScene = (id: string) => {
    if (project.storyboard.length <= 1) return;
    onUpdateProject((p) => ({
      ...p,
      storyboard: p.storyboard.filter((s) => s.id !== id),
    }));
  };

  const moveScene = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= project.storyboard.length) return;
    onUpdateProject((p) => {
      const next = [...p.storyboard];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return { ...p, storyboard: next };
    });
  };

  const handleSyncToTimeline = () => {
    onUpdateProject((p) => {
      const audioClips = p.clips.filter((c) => c.trackType === 'audio');
      const synced = syncStoryboardToTimeline(p.storyboard, p.settings.primaryPresetId, p.title, audioClips);
      const subtitles = generateSubtitlesFromScenes(p.storyboard);
      return {
        ...p,
        clips: synced,
        subtitles,
      };
    });
    setSyncMessage('Storyboard scenes and subtitles synchronized to timeline.');
    window.setTimeout(() => setSyncMessage(null), 3500);
  };

  const totalDur = project.storyboard.reduce((acc, s) => acc + (s.duration || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Storyboard Engine</h1>
          <p className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">
            {project.storyboard.length} scenes · {totalDur.toFixed(1)}s total ·{' '}
            {project.storyboard.filter((s) => s.approved).length} approved
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowJson((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#161B26] border border-[#2B3346] text-xs text-slate-300 hover:text-white"
          >
            <Code className="w-3.5 h-3.5" />
            <span>{showJson ? 'Hide JSON' : 'Inspect JSON'}</span>
          </button>
          <button
            type="button"
            onClick={addScene}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#161B26] border border-[#2B3346] text-xs text-slate-200 hover:bg-[#1E2534]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Scene</span>
          </button>
          <button
            type="button"
            onClick={handleSyncToTimeline}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400"
          >
            <Film className="w-3.5 h-3.5" />
            <span>Sync to Timeline</span>
          </button>
        </div>
      </div>

      {syncMessage && (
        <div className="px-4 py-2.5 rounded-lg bg-emerald-950/50 border border-emerald-800 text-emerald-200 text-xs flex items-center justify-between">
          <span>{syncMessage}</span>
          <button
            type="button"
            onClick={() => onNavigate('video-editor')}
            className="text-emerald-300 underline font-medium"
          >
            Open Video Editor
          </button>
        </div>
      )}

      {showJson && (
        <pre className="p-4 rounded-lg bg-[#0B0E14] border border-[#242B3B] text-[11px] font-mono text-sky-300 overflow-x-auto max-h-64">
          {JSON.stringify({ projectTitle: project.title, scenes: project.storyboard }, null, 2)}
        </pre>
      )}

      <div className="space-y-4">
        {project.storyboard.map((scene, idx) => {
          const win = windows[idx];
          return (
            <div
              key={scene.id}
              className="p-4 rounded-lg bg-[#11151D] border border-[#222836] space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1D2230]">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-semibold text-amber-400 tabular-nums">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <input
                    type="text"
                    aria-label={`Scene ${idx + 1} title`}
                    value={scene.title}
                    onChange={(e) => updateScene(scene.id, { title: e.target.value })}
                    className="bg-[#0B0E14] border border-[#283044] rounded px-2.5 py-1 text-sm font-semibold text-slate-100"
                  />
                  <span className="text-xs font-mono text-slate-500 tabular-nums">
                    {win ? `${win.startTime.toFixed(1)}s – ${win.endTime.toFixed(1)}s` : ''}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (win) onJumpToTime(win.startTime + 0.4);
                      onNavigate('video-editor');
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#181E2B] text-xs text-slate-200 hover:bg-[#222A3C]"
                  >
                    <Play className="w-3 h-3 text-amber-400" />
                    <span>Preview</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateScene(scene.id, { approved: !scene.approved })}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium ${
                      scene.approved
                        ? 'bg-emerald-950/60 border border-emerald-700/70 text-emerald-300'
                        : 'bg-[#181E2B] border border-[#2A3346] text-slate-400'
                    }`}
                  >
                    {scene.approved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                    <span>{scene.approved ? 'Approved' : 'Draft'}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${scene.title} up`}
                    onClick={() => moveScene(idx, -1)}
                    className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#1E2433]"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${scene.title} down`}
                    onClick={() => moveScene(idx, 1)}
                    className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#1E2433]"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Duplicate ${scene.title}`}
                    onClick={() => duplicateScene(scene, idx)}
                    className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#1E2433]"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {project.storyboard.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Delete ${scene.title}`}
                      onClick={() => deleteScene(scene.id)}
                      className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-950/40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
                <div className="lg:col-span-5 space-y-2.5">
                  <label className="flex flex-col gap-1">
                    <span className="text-slate-400">Narration & Subtitle Copy</span>
                    <textarea
                      rows={3}
                      value={scene.narration}
                      onChange={(e) =>
                        updateScene(scene.id, { narration: e.target.value, subtitleText: e.target.value })
                      }
                      className="bg-[#0B0E14] border border-[#283044] rounded px-2.5 py-1.5 text-slate-100 leading-relaxed"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-slate-400">On-Screen Headline / Overlay Text</span>
                    <input
                      type="text"
                      value={scene.overlayText}
                      onChange={(e) => updateScene(scene.id, { overlayText: e.target.value })}
                      className="bg-[#0B0E14] border border-[#283044] rounded px-2.5 py-1.5 text-slate-100 font-semibold"
                    />
                  </label>
                </div>

                <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-slate-400">Duration (sec)</span>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      step={0.5}
                      value={scene.duration}
                      onChange={(e) => updateScene(scene.id, { duration: Math.max(1, Number(e.target.value) || 4) })}
                      className="bg-[#0B0E14] border border-[#283044] rounded px-2.5 py-1.5 text-slate-100 font-mono"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-slate-400">Motion Component</span>
                    <select
                      value={scene.suggestedComponent}
                      onChange={(e) =>
                        updateScene(scene.id, { suggestedComponent: e.target.value as MotionComponentType })
                      }
                      className="bg-[#0B0E14] border border-[#283044] rounded px-2 py-1.5 text-slate-100"
                    >
                      {MOTION_COMPONENTS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-slate-400">Visual Style</span>
                    <select
                      value={scene.visualStyle}
                      onChange={(e) => updateScene(scene.id, { visualStyle: e.target.value })}
                      className="bg-[#0B0E14] border border-[#283044] rounded px-2 py-1.5 text-slate-100"
                    >
                      {allPresets.map((pr) => (
                        <option key={pr.id} value={pr.id}>
                          {pr.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-slate-400">Animation Preset</span>
                    <select
                      value={scene.animation}
                      onChange={(e) => updateScene(scene.id, { animation: e.target.value as AnimationPreset })}
                      className="bg-[#0B0E14] border border-[#283044] rounded px-2 py-1.5 text-slate-100"
                    >
                      {ANIMATION_PRESETS.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-slate-400">Transition In</span>
                    <select
                      value={scene.transition}
                      onChange={(e) => updateScene(scene.id, { transition: e.target.value as TransitionType })}
                      className="bg-[#0B0E14] border border-[#283044] rounded px-2 py-1.5 text-slate-100"
                    >
                      {TRANSITIONS.map((tr) => (
                        <option key={tr} value={tr}>
                          {tr}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-slate-400">Camera & Sound</span>
                    <input
                      type="text"
                      value={scene.camera}
                      onChange={(e) => updateScene(scene.id, { camera: e.target.value })}
                      className="bg-[#0B0E14] border border-[#283044] rounded px-2.5 py-1.5 text-slate-100"
                    />
                  </label>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
