import React, { useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react';
import { CreativePreset, Project } from '../types/studio';
import { LoadedMediaCache, renderCompositionFrame } from '../engine/compositor';
import { formatTimecode, getTotalDuration } from '../engine/timelineMath';

interface CompositionPreviewProps {
  project: Project;
  customPresets: CreativePreset[];
  mediaCache: LoadedMediaCache;
  currentTime: number;
  isPlaying: boolean;
  onTimeChange: (t: number) => void;
  onTogglePlay: () => void;
  onQualityChange?: (q: 0.5 | 0.75 | 1) => void;
  compact?: boolean;
}

export const CompositionPreview: React.FC<CompositionPreviewProps> = ({
  project,
  customPresets,
  mediaCache,
  currentTime,
  isPlaying,
  onTimeChange,
  onTogglePlay,
  onQualityChange,
  compact = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const totalDuration = getTotalDuration(project);
  const quality = project.exportConfig.previewQuality || 0.75;
  const renderWidth = Math.max(320, Math.round(project.settings.width * quality));
  const renderHeight = Math.max(240, Math.round(project.settings.height * quality));
  const aspectRatio = project.settings.width / Math.max(1, project.settings.height);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
      canvas.width = renderWidth;
      canvas.height = renderHeight;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderCompositionFrame(
      ctx,
      project,
      currentTime,
      renderWidth,
      renderHeight,
      customPresets,
      mediaCache,
      project.subtitleStyle.enabled
    );
  }, [project, currentTime, renderWidth, renderHeight, customPresets, mediaCache]);

  const stepFrame = (deltaFrames: number) => {
    const fps = project.settings.fps || 30;
    const next = Math.max(0, Math.min(totalDuration, currentTime + deltaFrames / fps));
    onTimeChange(Number(next.toFixed(3)));
  };

  return (
    <div className="flex flex-col bg-[#11141B] border border-[#232836] rounded-lg overflow-hidden">
      {/* Stage Canvas */}
      <div
        className={`relative flex items-center justify-center bg-[#080A0E] overflow-hidden ${
          compact ? 'h-[260px] p-3' : 'h-[340px] xl:h-[400px] p-4'
        }`}
      >
        <div
          className="relative shadow-2xl border border-[#252B3B] overflow-hidden bg-black"
          style={{
            aspectRatio: `${aspectRatio}`,
            height: aspectRatio < 1 ? '100%' : 'auto',
            width: aspectRatio >= 1 ? '100%' : 'auto',
            maxHeight: '100%',
            maxWidth: '100%',
          }}
        >
          <canvas
            ref={canvasRef}
            data-testid="composition-canvas"
            data-time={currentTime.toFixed(2)}
            className="w-full h-full block"
          />
        </div>
      </div>

      {/* Transport Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#151922] border-t border-[#232836]">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onTimeChange(0)}
            aria-label="Jump to start"
            className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-[#1F2430] transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => stepFrame(-1)}
            aria-label="Step back one frame"
            className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-[#1F2430] transition-colors"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause composition' : 'Play composition'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>
          <button
            type="button"
            onClick={() => stepFrame(1)}
            aria-label="Step forward one frame"
            className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-[#1F2430] transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-w-[140px] flex items-center gap-3">
          <span className="font-mono text-xs text-amber-400 tabular-nums whitespace-nowrap">
            {formatTimecode(currentTime, project.settings.fps)}
          </span>
          <input
            type="range"
            aria-label="Composition timeline scrubber"
            min={0}
            max={totalDuration}
            step={1 / (project.settings.fps || 30)}
            value={Math.min(currentTime, totalDuration)}
            onChange={(e) => onTimeChange(Number(e.target.value))}
            className="w-full accent-amber-500 h-1.5 bg-[#262C3A] rounded-lg cursor-pointer"
          />
          <span className="font-mono text-xs text-slate-400 tabular-nums whitespace-nowrap">
            {formatTimecode(totalDuration, project.settings.fps)}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="font-mono tabular-nums whitespace-nowrap">
            {project.settings.width}×{project.settings.height} · {project.settings.fps}fps
          </span>
          {onQualityChange && (
            <select
              aria-label="Preview quality"
              value={quality}
              onChange={(e) => onQualityChange(Number(e.target.value) as 0.5 | 0.75 | 1)}
              className="bg-[#0D1016] border border-[#2A3142] text-slate-200 text-xs rounded px-2 py-1"
            >
              <option value={0.5}>Proxy 50%</option>
              <option value={0.75}>Preview 75%</option>
              <option value={1}>Full 100%</option>
            </select>
          )}
        </div>
      </div>
    </div>
  );
};
