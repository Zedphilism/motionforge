import React, { useState } from 'react';
import {
  Scissors,
  Copy,
  Trash2,
  Plus,
  ZoomIn,
  ZoomOut,
  Magnet,
  Subtitles,
  Sliders,
} from 'lucide-react';
import {
  AnimationDirection,
  AnimationPreset,
  AspectRatioPreset,
  CreativePreset,
  EasingType,
  MediaAsset,
  MotionComponentType,
  Project,
  TimelineClip,
  TrackType,
  TransitionType,
} from '../types/studio';
import { LoadedMediaCache } from '../engine/compositor';
import {
  computeSceneWindows,
  formatTimecode,
  getTotalDuration,
  snapTime,
  splitClipAtTime,
} from '../engine/timelineMath';
import { generateSubtitlesFromScenes } from '../engine/subtitleEngine';
import { buildClipForMotionComponent, resolveDimensions } from '../engine/projectFactory';
import { CompositionPreview } from './CompositionPreview';

interface VideoEditorViewProps {
  project: Project;
  assets: MediaAsset[];
  customPresets: CreativePreset[];
  mediaCache: LoadedMediaCache;
  currentTime: number;
  isPlaying: boolean;
  selectedClipId: string | null;
  onSelectClip: (id: string | null) => void;
  onTimeChange: (t: number) => void;
  onTogglePlay: () => void;
  onUpdateProject: (updater: (p: Project) => Project) => void;
}

const TRACK_LANES: Array<{ type: TrackType; label: string; colorClass: string }> = [
  { type: 'text', label: 'Text', colorClass: 'bg-amber-500/20 border-amber-500/60 text-amber-200' },
  { type: 'graphics', label: 'Graphics', colorClass: 'bg-indigo-500/20 border-indigo-500/60 text-indigo-200' },
  { type: 'image', label: 'Image', colorClass: 'bg-sky-500/20 border-sky-500/60 text-sky-200' },
  { type: 'video', label: 'Video / 3D', colorClass: 'bg-violet-500/20 border-violet-500/60 text-violet-200' },
  { type: 'audio', label: 'Audio', colorClass: 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200' },
];

const ANIMATIONS: AnimationPreset[] = [
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

const EASINGS: EasingType[] = [
  'linear',
  'easeOutCubic',
  'easeInOutCubic',
  'easeOutExpo',
  'easeOutBack',
  'easeInOutQuad',
];

const TRANSITIONS: TransitionType[] = [
  'cut',
  'crossfade',
  'technical-wipe',
  'slide-left',
  'split-reveal',
  'zoom-through',
];

function packTrackRows(laneClips: TimelineClip[]): {
  placed: Array<{ clip: TimelineClip; row: number }>;
  rowCount: number;
} {
  const sorted = [...laneClips].sort(
    (a, b) => a.startTime - b.startTime || a.layerOrder - b.layerOrder
  );
  const rowEndTimes: number[] = [];
  const placed: Array<{ clip: TimelineClip; row: number }> = [];
  for (const clip of sorted) {
    let assignedRow = rowEndTimes.findIndex((end) => end <= clip.startTime + 0.01);
    if (assignedRow === -1) {
      assignedRow = rowEndTimes.length;
      rowEndTimes.push(clip.startTime + clip.duration);
    } else {
      rowEndTimes[assignedRow] = clip.startTime + clip.duration;
    }
    placed.push({ clip, row: assignedRow });
  }
  return { placed, rowCount: Math.max(1, rowEndTimes.length) };
}

export const VideoEditorView: React.FC<VideoEditorViewProps> = ({
  project,
  assets,
  customPresets,
  mediaCache,
  currentTime,
  isPlaying,
  selectedClipId,
  onSelectClip,
  onTimeChange,
  onTogglePlay,
  onUpdateProject,
}) => {
  const [zoomPxPerSec, setZoomPxPerSec] = useState(46);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [inspectorTab, setInspectorTab] = useState<'properties' | 'subtitles'>('properties');
  const [quickAddType, setQuickAddType] = useState<MotionComponentType>('TechnicalCallout');

  const totalDuration = getTotalDuration(project);
  const timelineWidthPx = Math.max(760, Math.ceil((totalDuration + 2) * zoomPxPerSec));
  const sceneWindows = computeSceneWindows(project.storyboard);
  const selectedClip = project.clips.find((c) => c.id === selectedClipId) || project.clips[0] || null;

  const updateClip = (id: string, partial: Partial<TimelineClip>) => {
    onUpdateProject((p) => ({
      ...p,
      clips: p.clips.map((c) => (c.id === id ? { ...c, ...partial } : c)),
    }));
  };

  const updateMotionProps = (id: string, partial: Partial<NonNullable<TimelineClip['motionProps']>>) => {
    onUpdateProject((p) => ({
      ...p,
      clips: p.clips.map((c) =>
        c.id === id ? { ...c, motionProps: { ...(c.motionProps || {}), ...partial } } : c
      ),
    }));
  };

  const handleSplitSelected = () => {
    if (!selectedClip) return;
    const split = splitClipAtTime(selectedClip, currentTime, `clip-split-${Date.now()}`);
    if (!split) return;
    onUpdateProject((p) => ({
      ...p,
      clips: p.clips.flatMap((c) => (c.id === selectedClip.id ? split : [c])),
    }));
    onSelectClip(split[1].id);
  };

  const handleDuplicateSelected = () => {
    if (!selectedClip) return;
    const copy: TimelineClip = {
      ...selectedClip,
      id: `clip-dup-${Date.now()}`,
      name: `${selectedClip.name} (Copy)`,
      startTime: Number((selectedClip.startTime + selectedClip.duration).toFixed(2)),
    };
    onUpdateProject((p) => ({ ...p, clips: [...p.clips, copy] }));
    onSelectClip(copy.id);
  };

  const handleDeleteSelected = () => {
    if (!selectedClip) return;
    onUpdateProject((p) => ({ ...p, clips: p.clips.filter((c) => c.id !== selectedClip.id) }));
    onSelectClip(null);
  };

  const handleQuickAddClip = () => {
    const baseScene = project.storyboard[0] || {
      id: 'scene-add',
      title: quickAddType,
      duration: 4,
      narration: project.subject,
      visualStyle: project.settings.primaryPresetId,
      visualType: quickAddType,
      camera: 'static',
      animation: 'slide' as const,
      overlayText: project.title,
      subtitleText: '',
      soundDesign: '',
      transition: 'crossfade' as const,
      notes: '',
      approved: true,
      suggestedComponent: quickAddType,
      assetIds: [],
    };
    const next = buildClipForMotionComponent(
      quickAddType,
      { ...baseScene, title: quickAddType },
      currentTime,
      4,
      project.settings.primaryPresetId,
      project.title
    );
    next.layerOrder = Math.max(10, ...project.clips.map((c) => c.layerOrder)) + 1;
    onUpdateProject((p) => ({ ...p, clips: [...p.clips, next] }));
    onSelectClip(next.id);
  };

  const handleAspectRatioChange = (ratio: AspectRatioPreset) => {
    const dims = resolveDimensions(ratio, project.settings.resolution);
    onUpdateProject((p) => ({
      ...p,
      settings: { ...p.settings, aspectRatio: ratio, width: dims.width, height: dims.height },
      exportConfig: { ...p.exportConfig, aspectRatio: ratio, width: dims.width, height: dims.height },
    }));
  };

  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rawTime = Math.max(0, (e.clientX - rect.left) / zoomPxPerSec);
    const snapPts = [0, ...sceneWindows.map((w) => w.startTime), ...sceneWindows.map((w) => w.endTime)];
    const t = snapEnabled ? snapTime(rawTime, snapPts, 0.25) : Number(rawTime.toFixed(2));
    onTimeChange(Math.min(totalDuration, t));
  };

  return (
    <div className="space-y-4">
      {/* Top Row: Stage + Right Properties Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <div className="xl:col-span-8 space-y-3">
          {/* Compact Workspace Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#11151D] border border-[#222836] text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Aspect</span>
              {(['16:9', '9:16', '1:1'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleAspectRatioChange(r)}
                  className={`px-2 py-1 rounded font-mono text-[11px] ${
                    project.settings.aspectRatio === r
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'bg-[#181E2B] text-slate-300 hover:text-white'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto">
              <span className="text-slate-500">Scenes:</span>
              {sceneWindows.map((w) => (
                <button
                  key={w.scene.id}
                  type="button"
                  onClick={() => {
                    onTimeChange(w.startTime + 0.5);
                    const sceneClips = project.clips.filter(
                      (c) =>
                        c.trackType !== 'audio' &&
                        c.startTime <= w.startTime + 0.5 &&
                        c.startTime + c.duration > w.startTime + 0.5
                    );
                    const primary =
                      sceneClips.find(
                        (c) => c.componentType !== 'BlueprintGrid' && c.componentType !== 'ProgressIndicator'
                      ) || sceneClips[0];
                    if (primary) onSelectClip(primary.id);
                  }}
                  className={`px-2 py-1 rounded text-[11px] whitespace-nowrap ${
                    currentTime >= w.startTime && currentTime < w.endTime
                      ? 'bg-[#242D40] text-amber-300 border border-amber-500/50'
                      : 'bg-[#161B26] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {String(w.index + 1).padStart(2, '0')} · {w.scene.title}
                </button>
              ))}
            </div>
          </div>

          <CompositionPreview
            project={project}
            customPresets={customPresets}
            mediaCache={mediaCache}
            currentTime={currentTime}
            isPlaying={isPlaying}
            onTimeChange={onTimeChange}
            onTogglePlay={onTogglePlay}
            onQualityChange={(q) =>
              onUpdateProject((p) => ({ ...p, exportConfig: { ...p.exportConfig, previewQuality: q } }))
            }
          />
        </div>

        {/* Right Properties & Subtitle Inspector */}
        <div className="xl:col-span-4 rounded-lg bg-[#11151D] border border-[#222836] overflow-hidden flex flex-col max-h-[520px]">
          <div className="flex items-center border-b border-[#222836] bg-[#151A24]">
            <button
              type="button"
              onClick={() => setInspectorTab('properties')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold ${
                inspectorTab === 'properties'
                  ? 'text-amber-400 border-b-2 border-amber-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Inspector</span>
            </button>
            <button
              type="button"
              onClick={() => setInspectorTab('subtitles')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold ${
                inspectorTab === 'subtitles'
                  ? 'text-amber-400 border-b-2 border-amber-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Subtitles className="w-3.5 h-3.5" />
              <span>Subtitles ({project.subtitles.length})</span>
            </button>
          </div>

          <div className="p-4 overflow-y-auto space-y-4 text-xs flex-1">
            {inspectorTab === 'properties' ? (
              selectedClip ? (
                <>
                  <div className="space-y-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-slate-400">Layer Name</span>
                      <input
                        type="text"
                        value={selectedClip.name}
                        onChange={(e) => updateClip(selectedClip.id, { name: e.target.value })}
                        className="bg-[#0B0E14] border border-[#283044] rounded px-2.5 py-1.5 text-slate-100"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <label className="flex flex-col gap-1">
                        <span className="text-slate-400">Start (sec)</span>
                        <input
                          type="number"
                          min={0}
                          step={0.25}
                          value={selectedClip.startTime}
                          onChange={(e) =>
                            updateClip(selectedClip.id, { startTime: Math.max(0, Number(e.target.value) || 0) })
                          }
                          className="bg-[#0B0E14] border border-[#283044] rounded px-2.5 py-1 text-slate-100 font-mono"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-slate-400">Duration (sec)</span>
                        <input
                          type="number"
                          min={0.5}
                          step={0.25}
                          value={selectedClip.duration}
                          onChange={(e) =>
                            updateClip(selectedClip.id, { duration: Math.max(0.5, Number(e.target.value) || 1) })
                          }
                          className="bg-[#0B0E14] border border-[#283044] rounded px-2.5 py-1 text-slate-100 font-mono"
                        />
                      </label>
                    </div>
                  </div>

                  {selectedClip.trackType !== 'audio' ? (
                    <>
                      {/* Content & Text Controls */}
                      <div className="pt-3 border-t border-[#1E2330] space-y-2.5">
                        <h3 className="font-semibold text-slate-300">Content & Colour</h3>
                        <label className="flex flex-col gap-1">
                          <span className="text-slate-400">Headline / Title</span>
                          <input
                            type="text"
                            value={selectedClip.motionProps?.title || ''}
                            onChange={(e) => updateMotionProps(selectedClip.id, { title: e.target.value })}
                            className="bg-[#0B0E14] border border-[#283044] rounded px-2.5 py-1.5 text-slate-100"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-slate-400">Subtitle / Label</span>
                          <input
                            type="text"
                            value={selectedClip.motionProps?.subtitle || ''}
                            onChange={(e) => updateMotionProps(selectedClip.id, { subtitle: e.target.value })}
                            className="bg-[#0B0E14] border border-[#283044] rounded px-2.5 py-1.5 text-slate-100"
                          />
                        </label>
                        {(selectedClip.componentType === 'ImageReveal' ||
                          selectedClip.componentType === 'VideoFrame') && (
                          <label className="flex flex-col gap-1">
                            <span className="text-slate-400">Attached Media Asset</span>
                            <select
                              value={selectedClip.assetId || ''}
                              onChange={(e) => updateClip(selectedClip.id, { assetId: e.target.value || undefined })}
                              className="bg-[#0B0E14] border border-[#283044] rounded px-2 py-1.5 text-slate-100"
                            >
                              <option value="">None</option>
                              {assets
                                .filter((a) =>
                                  selectedClip.componentType === 'VideoFrame'
                                    ? a.kind === 'video'
                                    : a.kind === 'image' || a.kind === 'svg' || a.kind === 'gif'
                                )
                                .map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.name}
                                  </option>
                                ))}
                            </select>
                          </label>
                        )}
                        <div className="grid grid-cols-2 gap-2.5">
                          <label className="flex items-center justify-between bg-[#0B0E14] border border-[#283044] rounded px-2.5 py-1">
                            <span className="text-slate-400">Accent</span>
                            <input
                              type="color"
                              value={selectedClip.motionProps?.accentColor || '#F59E0B'}
                              onChange={(e) => updateMotionProps(selectedClip.id, { accentColor: e.target.value })}
                              className="w-6 h-5 bg-transparent border-0"
                            />
                          </label>
                          <label className="flex items-center justify-between bg-[#0B0E14] border border-[#283044] rounded px-2.5 py-1">
                            <span className="text-slate-400">Text</span>
                            <input
                              type="color"
                              value={selectedClip.motionProps?.textColor || '#F8FAFC'}
                              onChange={(e) => updateMotionProps(selectedClip.id, { textColor: e.target.value })}
                              className="w-6 h-5 bg-transparent border-0"
                            />
                          </label>
                        </div>
                      </div>

                      {/* Transform & Opacity */}
                      <div className="pt-3 border-t border-[#1E2330] space-y-2.5">
                        <h3 className="font-semibold text-slate-300">Transform & Layer</h3>
                        <div className="grid grid-cols-2 gap-2.5">
                          <label className="flex flex-col gap-1">
                            <span className="text-slate-400">X (%)</span>
                            <input
                              type="number"
                              value={selectedClip.x}
                              onChange={(e) => updateClip(selectedClip.id, { x: Number(e.target.value) })}
                              className="bg-[#0B0E14] border border-[#283044] rounded px-2 py-1 font-mono text-slate-100"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-slate-400">Y (%)</span>
                            <input
                              type="number"
                              value={selectedClip.y}
                              onChange={(e) => updateClip(selectedClip.id, { y: Number(e.target.value) })}
                              className="bg-[#0B0E14] border border-[#283044] rounded px-2 py-1 font-mono text-slate-100"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-slate-400">Scale ({selectedClip.scale.toFixed(2)}x)</span>
                            <input
                              type="range"
                              min={0.3}
                              max={2}
                              step={0.05}
                              value={selectedClip.scale}
                              onChange={(e) => updateClip(selectedClip.id, { scale: Number(e.target.value) })}
                              className="accent-amber-500"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-slate-400">Opacity ({Math.round(selectedClip.opacity * 100)}%)</span>
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.05}
                              value={selectedClip.opacity}
                              onChange={(e) => updateClip(selectedClip.id, { opacity: Number(e.target.value) })}
                              className="accent-amber-500"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-slate-400">Rotation ({selectedClip.rotation}°)</span>
                            <input
                              type="range"
                              min={-45}
                              max={45}
                              step={1}
                              value={selectedClip.rotation}
                              onChange={(e) => updateClip(selectedClip.id, { rotation: Number(e.target.value) })}
                              className="accent-amber-500"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-slate-400">Layer Z-Order</span>
                            <input
                              type="number"
                              value={selectedClip.layerOrder}
                              onChange={(e) => updateClip(selectedClip.id, { layerOrder: Number(e.target.value) })}
                              className="bg-[#0B0E14] border border-[#283044] rounded px-2 py-1 font-mono text-slate-100"
                            />
                          </label>
                        </div>
                      </div>

                      {/* Animation Controls */}
                      <div className="pt-3 border-t border-[#1E2330] space-y-2.5">
                        <h3 className="font-semibold text-slate-300">Animation & Transition</h3>
                        <div className="grid grid-cols-2 gap-2.5">
                          <label className="flex flex-col gap-1">
                            <span className="text-slate-400">Preset</span>
                            <select
                              value={selectedClip.animation}
                              onChange={(e) =>
                                updateClip(selectedClip.id, { animation: e.target.value as AnimationPreset })
                              }
                              className="bg-[#0B0E14] border border-[#283044] rounded px-2 py-1 text-slate-100"
                            >
                              {ANIMATIONS.map((a) => (
                                <option key={a} value={a}>
                                  {a}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-slate-400">Easing</span>
                            <select
                              value={selectedClip.easing}
                              onChange={(e) => updateClip(selectedClip.id, { easing: e.target.value as EasingType })}
                              className="bg-[#0B0E14] border border-[#283044] rounded px-2 py-1 text-slate-100"
                            >
                              {EASINGS.map((es) => (
                                <option key={es} value={es}>
                                  {es}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-slate-400">Direction</span>
                            <select
                              value={selectedClip.direction}
                              onChange={(e) =>
                                updateClip(selectedClip.id, { direction: e.target.value as AnimationDirection })
                              }
                              className="bg-[#0B0E14] border border-[#283044] rounded px-2 py-1 text-slate-100"
                            >
                              <option value="up">Up</option>
                              <option value="down">Down</option>
                              <option value="left">Left</option>
                              <option value="right">Right</option>
                              <option value="center">Center</option>
                            </select>
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-slate-400">Transition</span>
                            <select
                              value={selectedClip.transitionIn || 'crossfade'}
                              onChange={(e) =>
                                updateClip(selectedClip.id, { transitionIn: e.target.value as TransitionType })
                              }
                              className="bg-[#0B0E14] border border-[#283044] rounded px-2 py-1 text-slate-100"
                            >
                              {TRANSITIONS.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="pt-3 border-t border-[#1E2330] space-y-3">
                      <h3 className="font-semibold text-slate-300">Audio Clip Settings</h3>
                      <label className="flex flex-col gap-1">
                        <span className="text-slate-400">
                          Clip Volume ({Math.round((selectedClip.volume ?? 1) * 100)}%)
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={1.5}
                          step={0.05}
                          value={selectedClip.volume ?? 1}
                          onChange={(e) => updateClip(selectedClip.id, { volume: Number(e.target.value) })}
                          className="accent-emerald-500"
                        />
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedClip.muted)}
                          onChange={(e) => updateClip(selectedClip.id, { muted: e.target.checked })}
                          className="accent-amber-500"
                        />
                        <span className="text-slate-300">Mute clip</span>
                      </label>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-slate-500 py-8 text-center">Select a clip on the timeline to inspect properties.</p>
              )
            ) : (
              /* Subtitles Tab */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={project.subtitleStyle.enabled}
                      onChange={(e) =>
                        onUpdateProject((p) => ({
                          ...p,
                          subtitleStyle: { ...p.subtitleStyle, enabled: e.target.checked },
                        }))
                      }
                      className="accent-amber-500"
                    />
                    <span className="text-slate-200 font-medium">Show Subtitles</span>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateProject((p) => ({
                        ...p,
                        subtitles: generateSubtitlesFromScenes(p.storyboard),
                      }))
                    }
                    className="px-2.5 py-1 rounded bg-[#1A202D] border border-[#2B3448] text-[11px] text-amber-300 hover:bg-[#232B3D]"
                  >
                    Auto-Segment
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-slate-400">Position</span>
                    <select
                      value={project.subtitleStyle.position}
                      onChange={(e) =>
                        onUpdateProject((p) => ({
                          ...p,
                          subtitleStyle: {
                            ...p.subtitleStyle,
                            position: e.target.value as Project['subtitleStyle']['position'],
                          },
                        }))
                      }
                      className="bg-[#0B0E14] border border-[#283044] rounded px-2 py-1 text-slate-100"
                    >
                      <option value="bottom">Bottom</option>
                      <option value="center">Center</option>
                      <option value="top">Top</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-slate-400">Font Size ({project.subtitleStyle.fontSize}px)</span>
                    <input
                      type="number"
                      min={18}
                      max={64}
                      value={project.subtitleStyle.fontSize}
                      onChange={(e) =>
                        onUpdateProject((p) => ({
                          ...p,
                          subtitleStyle: { ...p.subtitleStyle, fontSize: Number(e.target.value) || 30 },
                        }))
                      }
                      className="bg-[#0B0E14] border border-[#283044] rounded px-2 py-1 font-mono text-slate-100"
                    />
                  </label>
                </div>

                <div className="space-y-2 pt-2 border-t border-[#1E2330]">
                  {project.subtitles.map((cue) => (
                    <div key={cue.id} className="p-2 rounded bg-[#0B0E14] border border-[#222836] space-y-1.5">
                      <div className="flex items-center justify-between font-mono text-[10px] text-slate-500 tabular-nums">
                        <span>
                          {cue.startTime.toFixed(1)}s → {cue.endTime.toFixed(1)}s
                        </span>
                        <button
                          type="button"
                          onClick={() => onTimeChange(cue.startTime + 0.1)}
                          className="text-amber-400 hover:underline"
                        >
                          Jump
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={cue.text}
                        onChange={(e) =>
                          onUpdateProject((p) => ({
                            ...p,
                            subtitles: p.subtitles.map((s) => (s.id === cue.id ? { ...s, text: e.target.value } : s)),
                          }))
                        }
                        className="w-full bg-[#11151D] border border-[#252D3E] rounded px-2 py-1 text-xs text-slate-100"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Multitrack Timeline */}
      <div className="rounded-lg bg-[#11151D] border border-[#222836] overflow-hidden">
        {/* Timeline Controls Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#151922] border-b border-[#222836] text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Choose motion component to add"
              value={quickAddType}
              onChange={(e) => setQuickAddType(e.target.value as MotionComponentType)}
              className="bg-[#0B0E14] border border-[#283044] rounded px-2 py-1 text-slate-200"
            >
              <option value="AnimatedTitle">AnimatedTitle</option>
              <option value="TechnicalCallout">TechnicalCallout</option>
              <option value="AnimatedChart">AnimatedChart</option>
              <option value="CircularDiagram">CircularDiagram</option>
              <option value="DataCounter">DataCounter</option>
              <option value="ComparisonPanel">ComparisonPanel</option>
              <option value="ExplodedView">ExplodedView</option>
              <option value="TrackingMarker">TrackingMarker</option>
              <option value="3DModelViewer">3DModelViewer</option>
              <option value="ImageReveal">ImageReveal</option>
            </select>
            <button
              type="button"
              onClick={handleQuickAddClip}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-semibold hover:bg-amber-400"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Clip</span>
            </button>
            <button
              type="button"
              disabled={!selectedClip}
              onClick={handleSplitSelected}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1B2231] border border-[#2B3448] text-slate-200 hover:bg-[#242D40] disabled:opacity-40"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Split</span>
            </button>
            <button
              type="button"
              disabled={!selectedClip}
              onClick={handleDuplicateSelected}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1B2231] border border-[#2B3448] text-slate-200 hover:bg-[#242D40] disabled:opacity-40"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Duplicate</span>
            </button>
            <button
              type="button"
              disabled={!selectedClip}
              onClick={handleDeleteSelected}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1B2231] border border-[#2B3448] text-red-300 hover:bg-red-950/50 disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSnapEnabled((s) => !s)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded border text-[11px] ${
                snapEnabled
                  ? 'bg-amber-500/15 border-amber-500/60 text-amber-300'
                  : 'bg-[#181E2B] border-[#2A3346] text-slate-400'
              }`}
            >
              <Magnet className="w-3 h-3" />
              <span>Snap {snapEnabled ? 'On' : 'Off'}</span>
            </button>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Zoom out timeline"
                onClick={() => setZoomPxPerSec((z) => Math.max(24, z - 10))}
                className="p-1 text-slate-400 hover:text-white"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] text-slate-400 w-12 text-center tabular-nums">
                {zoomPxPerSec}px/s
              </span>
              <button
                type="button"
                aria-label="Zoom in timeline"
                onClick={() => setZoomPxPerSec((z) => Math.min(110, z + 10))}
                className="p-1 text-slate-400 hover:text-white"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Tracks Grid */}
        {(() => {
          const laneLayouts = TRACK_LANES.map((lane) => {
            const laneClips = project.clips.filter((c) => c.trackType === lane.type);
            const { placed, rowCount } = packTrackRows(laneClips);
            const laneHeightPx = Math.max(40, rowCount * 32 + 8);
            return { lane, placed, rowCount, laneHeightPx };
          });

          return (
            <div className="flex overflow-x-auto">
              {/* Track Labels Column */}
              <div className="w-28 shrink-0 bg-[#131720] border-r border-[#222836] select-none">
                <div className="h-7 border-b border-[#222836] px-2.5 flex items-center text-[10px] font-mono text-slate-500">
                  {formatTimecode(currentTime, project.settings.fps)}
                </div>
                {laneLayouts.map(({ lane, rowCount, laneHeightPx }) => (
                  <div
                    key={lane.type}
                    style={{ height: `${laneHeightPx}px` }}
                    className="border-b border-[#1C212E] px-2.5 flex flex-col justify-center text-xs font-medium text-slate-300"
                  >
                    <span>{lane.label}</span>
                    {rowCount > 1 && (
                      <span className="text-[10px] font-mono text-slate-500">{rowCount} layers</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Time Ruler + Clips Canvas */}
              <div className="relative flex-1 min-w-0" style={{ minWidth: `${timelineWidthPx}px` }}>
                {/* Clickable Time Ruler */}
                <div
                  role="slider"
                  aria-label="Timeline playhead ruler"
                  aria-valuemin={0}
                  aria-valuemax={totalDuration}
                  aria-valuenow={Number(currentTime.toFixed(2))}
                  tabIndex={0}
                  onClick={handleRulerClick}
                  className="h-7 bg-[#0E1118] border-b border-[#222836] relative cursor-pointer select-none"
                >
                  {Array.from({ length: Math.ceil(totalDuration) + 1 }, (_, sec) => (
                    <div
                      key={sec}
                      className="absolute top-0 bottom-0 border-l border-[#222836] pl-1 text-[10px] font-mono text-slate-500 tabular-nums"
                      style={{ left: `${sec * zoomPxPerSec}px` }}
                    >
                      {sec % 2 === 0 ? `${sec}s` : ''}
                    </div>
                  ))}
                </div>

                {/* Track Lanes */}
                {laneLayouts.map(({ lane, placed, laneHeightPx }) => (
                  <div
                    key={lane.type}
                    style={{ height: `${laneHeightPx}px` }}
                    className="border-b border-[#1C212E] relative bg-[#0B0E14]"
                  >
                    {placed.map(({ clip, row }) => {
                      const isSel = selectedClip?.id === clip.id;
                      return (
                        <button
                          key={clip.id}
                          type="button"
                          onClick={() => onSelectClip(clip.id)}
                          className={`absolute h-7 rounded border px-2 text-left text-[11px] font-medium truncate transition-colors ${
                            lane.colorClass
                          } ${isSel ? 'ring-2 ring-amber-400 z-10' : 'hover:brightness-110'}`}
                          style={{
                            top: `${row * 32 + 4}px`,
                            left: `${clip.startTime * zoomPxPerSec}px`,
                            width: `${Math.max(40, clip.duration * zoomPxPerSec - 2)}px`,
                          }}
                        >
                          {clip.name}
                        </button>
                      );
                    })}
                  </div>
                ))}

                {/* Playhead Indicator Line */}
                <div
                  className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-amber-400 z-20"
                  style={{ left: `${currentTime * zoomPxPerSec}px` }}
                >
                  <div className="w-2.5 h-2.5 -ml-1 bg-amber-400 rotate-45 -mt-1" />
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
