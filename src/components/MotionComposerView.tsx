import React, { useState } from 'react';
import { Plus, Box, Sparkles } from 'lucide-react';
import { CreativePreset, MediaAsset, MotionComponentType, Project, TimelineClip } from '../types/studio';
import { LoadedMediaCache } from '../engine/compositor';
import { CompositionPreview } from './CompositionPreview';
import { ThreeStudioCanvas } from './ThreeStudioCanvas';
import { buildClipForMotionComponent } from '../engine/projectFactory';

interface MotionComposerViewProps {
  project: Project;
  customPresets: CreativePreset[];
  modelAssets: MediaAsset[];
  mediaCache: LoadedMediaCache;
  currentTime: number;
  isPlaying: boolean;
  onTimeChange: (t: number) => void;
  onTogglePlay: () => void;
  onUpdateProject: (updater: (p: Project) => Project) => void;
  onSelectClipAndEdit: (clipId: string) => void;
}

const COMPONENT_CATALOG: Array<{
  type: MotionComponentType;
  category: 'Typography' | 'Technical' | 'Data' | 'Media & 3D';
  description: string;
}> = [
  { type: 'AnimatedTitle', category: 'Typography', description: 'Primary headline with rule reveal & subtitle.' },
  { type: 'KineticTypography', category: 'Typography', description: 'Staggered word-by-word emphasis typography.' },
  { type: 'SectionDivider', category: 'Typography', description: 'Chapter divider with animated rule.' },
  { type: 'EndCard', category: 'Typography', description: 'Closing summary and call-to-action slate.' },
  { type: 'BlueprintGrid', category: 'Technical', description: 'Engineering drafting frame with corner markers.' },
  { type: 'TechnicalCallout', category: 'Technical', description: 'Leader-line schematic callout box.' },
  { type: 'AnimatedArrow', category: 'Technical', description: 'Directional vector flow arrow.' },
  { type: 'TrackingMarker', category: 'Technical', description: 'Animated reticle and coordinate lock.' },
  { type: 'ExplodedView', category: 'Technical', description: 'Isometric stacked assembly separation.' },
  { type: 'AnimatedDiagram', category: 'Technical', description: 'Connected multi-node architecture schematic.' },
  { type: 'CircularDiagram', category: 'Data', description: 'Radial arc gauge with animated counter.' },
  { type: 'DataCounter', category: 'Data', description: 'Large tabular metric counter with unit.' },
  { type: 'ComparisonPanel', category: 'Data', description: 'Two-column baseline vs improved breakdown.' },
  { type: 'AnimatedChart', category: 'Data', description: 'Staggered animated column comparison chart.' },
  { type: 'ProgressIndicator', category: 'Data', description: 'Scene/chapter progress bar indicator.' },
  { type: 'InfographicCard', category: 'Data', description: 'Structured editorial insight card.' },
  { type: 'TimelineGraphic', category: 'Data', description: 'Horizontal milestone progression line.' },
  { type: 'ImageReveal', category: 'Media & 3D', description: 'Masked media frame with smooth zoom.' },
  { type: 'VideoFrame', category: 'Media & 3D', description: 'Composited uploaded footage frame.' },
  { type: '3DModelViewer', category: 'Media & 3D', description: 'Interactive & renderable Three.js 3D stage.' },
];

export const MotionComposerView: React.FC<MotionComposerViewProps> = ({
  project,
  customPresets,
  modelAssets,
  mediaCache,
  currentTime,
  isPlaying,
  onTimeChange,
  onTogglePlay,
  onUpdateProject,
  onSelectClipAndEdit,
}) => {
  const [stageMode, setStageMode] = useState<'2d' | '3d'>('2d');
  const [catFilter, setCatFilter] = useState<'All' | 'Typography' | 'Technical' | 'Data' | 'Media & 3D'>('All');

  const insertComponent = (type: MotionComponentType) => {
    const dummyScene = project.storyboard[0] || {
      id: 'scene-manual',
      title: type,
      duration: 5,
      narration: project.subject,
      visualStyle: project.settings.primaryPresetId,
      visualType: type,
      camera: 'static',
      animation: 'slide' as const,
      overlayText: project.title,
      subtitleText: '',
      soundDesign: '',
      transition: 'crossfade' as const,
      notes: '',
      approved: true,
      suggestedComponent: type,
      assetIds: [],
    };
    const clip: TimelineClip = buildClipForMotionComponent(
      type,
      { ...dummyScene, title: type, overlayText: type === '3DModelViewer' ? project.title : dummyScene.overlayText },
      currentTime,
      4.5,
      project.settings.primaryPresetId,
      project.title
    );
    if (type === '3DModelViewer' && clip.motionProps) {
      clip.motionProps.scene3D = { ...project.scene3D };
    }
    clip.layerOrder = Math.max(10, ...project.clips.map((c) => c.layerOrder)) + 1;

    onUpdateProject((p) => ({
      ...p,
      clips: [...p.clips, clip],
    }));
    onSelectClipAndEdit(clip.id);
  };

  const filtered = COMPONENT_CATALOG.filter((c) => catFilter === 'All' || c.category === catFilter);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Motion Composer & 3D Stage</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            20 deterministic programmatic motion graphics modules and an interactive Three.js PBR 3D stage.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#11151D] border border-[#222836] rounded-lg">
          <button
            type="button"
            onClick={() => setStageMode('2d')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium ${
              stageMode === '2d' ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Composition Stage</span>
          </button>
          <button
            type="button"
            onClick={() => setStageMode('3d')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium ${
              stageMode === '3d' ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>Interactive 3D Stage</span>
          </button>
        </div>
      </div>

      {/* Stage Viewport */}
      {stageMode === '2d' ? (
        <CompositionPreview
          project={project}
          customPresets={customPresets}
          mediaCache={mediaCache}
          currentTime={currentTime}
          isPlaying={isPlaying}
          onTimeChange={onTimeChange}
          onTogglePlay={onTogglePlay}
        />
      ) : (
        <ThreeStudioCanvas
          config={project.scene3D}
          modelAssets={modelAssets}
          mediaCache={mediaCache}
          onChange={(next) =>
            onUpdateProject((p) => ({
              ...p,
              scene3D: next,
              clips: p.clips.map((c) =>
                c.componentType === '3DModelViewer'
                  ? { ...c, motionProps: { ...c.motionProps, scene3D: next } }
                  : c
              ),
            }))
          }
          onInsertToTimeline={() => insertComponent('3DModelViewer')}
        />
      )}

      {/* 20 Reusable Motion Graphics Components */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-200">
            Motion Graphics Library ({COMPONENT_CATALOG.length} Components)
          </h2>
          <div className="flex items-center gap-1 p-1 bg-[#11151D] border border-[#222836] rounded-lg">
            {(['All', 'Typography', 'Technical', 'Data', 'Media & 3D'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCatFilter(cat)}
                className={`px-2.5 py-1 rounded text-xs font-medium ${
                  catFilter === cat ? 'bg-[#222A3C] text-slate-100' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {filtered.map((item) => (
            <div
              key={item.type}
              className="p-3.5 rounded-lg bg-[#11151D] border border-[#222836] flex flex-col justify-between gap-3 hover:border-[#37425B] transition-colors"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-100">{item.type}</span>
                  <span className="text-[10px] font-mono text-slate-500">{item.category}</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{item.description}</p>
              </div>
              <button
                type="button"
                onClick={() => insertComponent(item.type)}
                className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded bg-[#181E2B] border border-[#2A3346] text-xs font-medium text-slate-200 hover:bg-amber-500 hover:text-slate-950 hover:border-amber-500 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Insert at Playhead</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
