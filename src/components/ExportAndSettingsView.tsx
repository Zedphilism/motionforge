import React, { useMemo, useRef, useState } from 'react';
import { Download, Film, Square, CheckCircle2, FileText, FileJson, Plus, Palette, Cpu, HardDrive } from 'lucide-react';
import {
  AspectRatioPreset,
  CreativePreset,
  FrameRate,
  Project,
  ResolutionPreset,
} from '../types/studio';
import { LoadedMediaCache } from '../engine/compositor';
import {
  detectExportCapabilities,
  RenderedVideoResult,
  RenderProgress,
  renderVideoProject,
} from '../engine/videoExporter';
import { exportToSRT, exportToVTT } from '../engine/subtitleEngine';
import { resolveDimensions } from '../engine/projectFactory';
import { formatTimecode, getTotalDuration } from '../engine/timelineMath';
import { BUILTIN_CREATIVE_PRESETS } from '../data/creativePresets';
import { ModelRegistryResponse } from '../services/aiClient';

interface ExportStudioViewProps {
  project: Project;
  customPresets: CreativePreset[];
  mediaCache: LoadedMediaCache;
  onUpdateProject: (updater: (p: Project) => Project) => void;
  onExportJson: (project: Project) => void;
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export const ExportStudioView: React.FC<ExportStudioViewProps> = ({
  project,
  customPresets,
  mediaCache,
  onUpdateProject,
  onExportJson,
}) => {
  const caps = useMemo(() => detectExportCapabilities(), []);
  const abortRef = useRef<AbortController | null>(null);
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState<RenderProgress | null>(null);
  const [result, setResult] = useState<RenderedVideoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalDur = getTotalDuration(project);
  const cfg = project.exportConfig;

  const updateExportConfig = (partial: Partial<Project['exportConfig']>) => {
    onUpdateProject((p) => {
      const merged = { ...p.exportConfig, ...partial };
      if (partial.aspectRatio || partial.resolution) {
        const dims = resolveDimensions(merged.aspectRatio, merged.resolution, merged.width, merged.height);
        merged.width = dims.width;
        merged.height = dims.height;
      }
      return { ...p, exportConfig: merged };
    });
  };

  const handleStartRender = async () => {
    if (result?.objectUrl) {
      URL.revokeObjectURL(result.objectUrl);
      setResult(null);
    }
    setError(null);
    setRendering(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const rendered = await renderVideoProject({
        project,
        exportConfig: project.exportConfig,
        customPresets,
        mediaCache,
        signal: controller.signal,
        onProgress: (p) => setProgress(p),
      });
      setResult(rendered);
      setProgress({
        percent: 100,
        currentFrame: rendered.framesRendered,
        totalFrames: rendered.framesRendered,
        elapsedSec: progress?.elapsedSec || 0,
        estimatedRemainingSec: 0,
        phase: 'verifying',
      });
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') {
        setError('Render was cancelled before completion.');
      } else {
        setError(err instanceof Error ? err.message : 'Video rendering failed.');
      }
    } finally {
      setRendering(false);
      abortRef.current = null;
    }
  };

  const handleCancelRender = () => {
    abortRef.current?.abort();
  };

  const safeSlug = project.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'motionforge-video';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Export Studio</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Render deterministic, frame-accurate playable video directly in your browser using the unified Canvas + WebGL compositor.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => downloadTextFile(`${safeSlug}.srt`, exportToSRT(project.subtitles), 'text/plain')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#161B26] border border-[#2B3346] text-slate-200 hover:bg-[#1E2534]"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export SRT</span>
          </button>
          <button
            type="button"
            onClick={() => downloadTextFile(`${safeSlug}.vtt`, exportToVTT(project.subtitles), 'text/vtt')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#161B26] border border-[#2B3346] text-slate-200 hover:bg-[#1E2534]"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export VTT</span>
          </button>
          <button
            type="button"
            onClick={() => onExportJson(project)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#161B26] border border-[#2B3346] text-slate-200 hover:bg-[#1E2534]"
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>Project JSON</span>
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="px-4 py-3 rounded-lg bg-red-950/60 border border-red-800 text-red-200 text-xs">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left: Render Configuration */}
        <div className="xl:col-span-5 p-5 rounded-lg bg-[#11151D] border border-[#222836] space-y-4 text-xs">
          <h2 className="text-sm font-semibold text-slate-200">Output Configuration</h2>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-slate-400">Aspect Ratio</span>
              <select
                value={cfg.aspectRatio}
                onChange={(e) => updateExportConfig({ aspectRatio: e.target.value as AspectRatioPreset })}
                className="bg-[#0B0E14] border border-[#283044] rounded px-2.5 py-1.5 text-slate-100"
              >
                <option value="16:9">16:9 Landscape</option>
                <option value="9:16">9:16 Vertical</option>
                <option value="1:1">1:1 Square</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-slate-400">Resolution</span>
              <select
                value={cfg.resolution}
                onChange={(e) => updateExportConfig({ resolution: e.target.value as ResolutionPreset })}
                className="bg-[#0B0E14] border border-[#283044] rounded px-2.5 py-1.5 text-slate-100"
              >
                <option value="720p">720p HD</option>
                <option value="1080p">1080p Full HD</option>
                <option value="1440p">1440p QHD</option>
                <option value="4k">4K UHD</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-slate-400">Frame Rate</span>
              <select
                value={cfg.fps}
                onChange={(e) => updateExportConfig({ fps: Number(e.target.value) as FrameRate })}
                className="bg-[#0B0E14] border border-[#283044] rounded px-2.5 py-1.5 text-slate-100"
              >
                <option value={24}>24 FPS</option>
                <option value={25}>25 FPS</option>
                <option value={30}>30 FPS</option>
                <option value={60}>60 FPS</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-slate-400">Container Format</span>
              <select
                value={cfg.format}
                onChange={(e) => updateExportConfig({ format: e.target.value as Project['exportConfig']['format'] })}
                className="bg-[#0B0E14] border border-[#283044] rounded px-2.5 py-1.5 text-slate-100"
              >
                <option value="auto">Auto ({caps.preferredExtension.toUpperCase()})</option>
                <option value="webm">WebM (VP9 / VP8)</option>
                <option value="mp4" disabled={!caps.mp4Supported}>
                  MP4 H.264 {!caps.mp4Supported ? '(Unsupported in this browser)' : ''}
                </option>
              </select>
            </label>
          </div>

          <div className="space-y-2 pt-2 border-t border-[#1E2330]">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={cfg.burnSubtitles}
                onChange={(e) => updateExportConfig({ burnSubtitles: e.target.checked })}
                className="accent-amber-500"
              />
              <span>Burn subtitles into rendered video frames</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={cfg.includeAudio}
                onChange={(e) => updateExportConfig({ includeAudio: e.target.checked })}
                className="accent-amber-500"
              />
              <span>Mix audio tracks into output container</span>
            </label>
          </div>

          <div className="p-3 rounded-md bg-[#0B0E14] border border-[#1E2433] font-mono text-[11px] text-slate-400 space-y-1 tabular-nums">
            <p>
              Target: {cfg.width}×{cfg.height} @ {cfg.fps}fps · {formatTimecode(totalDur, cfg.fps)}
            </p>
            <p>
              Browser Codecs: MediaRecorder {caps.mediaRecorder ? 'Ready' : 'Missing'} · WebCodecs{' '}
              {caps.webCodecs ? 'Detected' : 'Fallback'} · MP4 {caps.mp4Supported ? 'Native' : 'WebM Fallback'}
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            {!rendering ? (
              <button
                type="button"
                onClick={handleStartRender}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400 transition-colors"
              >
                <Film className="w-4 h-4" />
                <span>Render Playable Video</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCancelRender}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-red-600 text-white font-semibold text-xs hover:bg-red-500"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Cancel Render</span>
              </button>
            )}
          </div>
        </div>

        {/* Right: Render Progress & Verified Playable Output */}
        <div className="xl:col-span-7 p-5 rounded-lg bg-[#11151D] border border-[#222836] space-y-4">
          <h2 className="text-sm font-semibold text-slate-200">Render Output & Verification</h2>

          {rendering && progress && (
            <div className="p-4 rounded-lg bg-[#0B0E14] border border-[#242C3E] space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                <span className="text-amber-400 capitalize">{progress.phase}...</span>
                <span className="text-slate-200">{progress.percent}%</span>
              </div>
              <div className="w-full h-2 bg-[#1A202E] rounded overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-150"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 tabular-nums">
                <span>
                  Frame {progress.currentFrame} / {progress.totalFrames}
                </span>
                <span>
                  Elapsed {progress.elapsedSec.toFixed(1)}s · Est. remaining {progress.estimatedRemainingSec.toFixed(1)}s
                </span>
              </div>
            </div>
          )}

          {result ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-md bg-emerald-950/50 border border-emerald-800/70 text-xs text-emerald-200">
                <span className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Verified Playable Output Generated</span>
                </span>
                <span className="font-mono tabular-nums text-[11px]">
                  {(result.sizeBytes / (1024 * 1024)).toFixed(2)} MB · {result.width}×{result.height} ·{' '}
                  {result.extension.toUpperCase()}
                </span>
              </div>

              <video
                data-testid="exported-video-player"
                controls
                playsInline
                src={result.objectUrl}
                className="w-full max-h-[340px] rounded-lg bg-black border border-[#273044]"
              />

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-mono text-slate-400">MIME: {result.mimeType}</span>
                <a
                  href={result.objectUrl}
                  download={`${safeSlug}.${result.extension}`}
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400"
                >
                  <Download className="w-4 h-4" />
                  <span>Download .{result.extension.toUpperCase()} Video</span>
                </a>
              </div>
            </div>
          ) : (
            !rendering && (
              <div className="h-[260px] flex flex-col items-center justify-center rounded-lg border border-dashed border-[#262E40] bg-[#0B0E14] text-center p-6">
                <Film className="w-8 h-8 text-slate-500 mb-2" />
                <p className="text-sm text-slate-300">No rendered output yet</p>
                <p className="text-xs text-slate-500 mt-1 max-w-md">
                  Click Render Playable Video to synthesize every frame deterministically and verify the resulting video file before downloading.
                </p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

interface SettingsViewProps {
  project: Project;
  customPresets: CreativePreset[];
  modelRegistry: ModelRegistryResponse | null;
  storageInfo: { usageBytes: number; quotaBytes: number; percent: number; opfsSupported: boolean };
  onSaveCustomPreset: (preset: CreativePreset) => Promise<void>;
  onDeleteCustomPreset: (id: string) => Promise<void>;
  onApplyPresetToProject: (presetId: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  project,
  customPresets,
  modelRegistry,
  storageInfo,
  onSaveCustomPreset,
  onDeleteCustomPreset,
  onApplyPresetToProject,
}) => {
  const [name, setName] = useState('');
  const [bgColor, setBgColor] = useState('#0D111A');
  const [primaryColor, setPrimaryColor] = useState('#38BDF8');
  const [accentColor, setAccentColor] = useState('#F59E0B');
  const [textColor, setTextColor] = useState('#F8FAFC');
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const handleCreatePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const base = BUILTIN_CREATIVE_PRESETS[0];
    const preset: CreativePreset = {
      ...base,
      id: `custom-${Date.now()}`,
      name: name.trim(),
      description: 'User-defined custom visual identity preset.',
      isCustom: true,
      palette: {
        ...base.palette,
        background: bgColor,
        surface: bgColor,
        primary: primaryColor,
        accent: accentColor,
        text: textColor,
      },
    };
    await onSaveCustomPreset(preset);
    setName('');
    setSavedMsg(`Saved custom preset "${preset.name}" to IndexedDB.`);
    window.setTimeout(() => setSavedMsg(null), 3000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Studio Settings & Model Registry</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Manage custom creative direction presets, inspect server-side Gemini models, and monitor local browser storage.
        </p>
      </div>

      {/* Creative Preset Builder */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleCreatePreset}
          className="lg:col-span-5 p-5 rounded-lg bg-[#11151D] border border-[#222836] space-y-4 text-xs"
        >
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Palette className="w-4 h-4 text-amber-400" />
            <span>Create Custom Visual Preset</span>
          </h2>
          {savedMsg && <p className="text-emerald-400">{savedMsg}</p>}
          <label className="flex flex-col gap-1">
            <span className="text-slate-400">Preset Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Studio Editorial Slate"
              className="bg-[#0B0E14] border border-[#283044] rounded px-3 py-1.5 text-slate-100"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center justify-between bg-[#0B0E14] border border-[#283044] rounded px-3 py-1.5">
              <span className="text-slate-400">Background</span>
              <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-6 h-5" />
            </label>
            <label className="flex items-center justify-between bg-[#0B0E14] border border-[#283044] rounded px-3 py-1.5">
              <span className="text-slate-400">Primary</span>
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-6 h-5"
              />
            </label>
            <label className="flex items-center justify-between bg-[#0B0E14] border border-[#283044] rounded px-3 py-1.5">
              <span className="text-slate-400">Accent</span>
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="w-6 h-5"
              />
            </label>
            <label className="flex items-center justify-between bg-[#0B0E14] border border-[#283044] rounded px-3 py-1.5">
              <span className="text-slate-400">Text</span>
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="w-6 h-5"
              />
            </label>
          </div>
          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-amber-500 text-slate-950 font-semibold hover:bg-amber-400"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Save Custom Preset</span>
          </button>

          {customPresets.length > 0 && (
            <div className="pt-3 border-t border-[#1E2330] space-y-2">
              <span className="text-slate-400 font-medium">Saved Custom Presets</span>
              {customPresets.map((cp) => (
                <div key={cp.id} className="flex items-center justify-between gap-2 py-1">
                  <span className="text-slate-200">{cp.name}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onApplyPresetToProject(cp.id)}
                      className="text-amber-400 hover:underline"
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteCustomPreset(cp.id)}
                      className="text-slate-500 hover:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </form>

        {/* Server-Side AI Model Registry */}
        <div className="lg:col-span-7 p-5 rounded-lg bg-[#11151D] border border-[#222836] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-sky-400" />
              <span>Server-Side AI Model Registry</span>
            </h2>
            <span className="text-xs font-mono text-slate-400">
              API Credential: {modelRegistry?.configured ? 'Managed on server' : 'Not set (Offline studio mode active)'}
            </span>
          </div>

          <div className="divide-y divide-[#1E2330] border border-[#1E2330] rounded-lg overflow-hidden">
            {(modelRegistry?.models || []).map((m) => (
              <div key={m.id} className="px-3.5 py-2.5 bg-[#0D1017] flex items-start justify-between gap-3 text-xs">
                <div>
                  <p className="font-semibold text-slate-100">
                    {m.label} <span className="font-mono text-[11px] text-slate-500">({m.id})</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{m.recommendedFor}</p>
                </div>
                <span
                  className={`font-mono text-[11px] whitespace-nowrap shrink-0 ${
                    m.tier === 'paid-tier' ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {m.tier === 'paid-tier' ? 'Paid Tier' : 'Standard'}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-2 flex items-center justify-between text-xs text-slate-400 font-mono tabular-nums">
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5" />
              <span>
                Storage: {(storageInfo.usageBytes / (1024 * 1024)).toFixed(2)} MB used · Active Project:{' '}
                {project.title}
              </span>
            </span>
            <span>OPFS: {storageInfo.opfsSupported ? 'Supported' : 'IndexedDB'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
