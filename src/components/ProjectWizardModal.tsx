import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import {
  AspectRatioPreset,
  CreativePreset,
  CreativePresetId,
  DurationCategory,
  FrameRate,
  ResearchMode,
  ResolutionPreset,
} from '../types/studio';
import { BUILTIN_CREATIVE_PRESETS } from '../data/creativePresets';
import { NewProjectInput } from '../engine/projectFactory';

interface ProjectWizardModalProps {
  open: boolean;
  customPresets: CreativePreset[];
  onClose: () => void;
  onCreate: (input: NewProjectInput) => void;
}

export const ProjectWizardModal: React.FC<ProjectWizardModalProps> = ({
  open,
  customPresets,
  onClose,
  onCreate,
}) => {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState('Informed general audience');
  const [language, setLanguage] = useState('English');
  const [purpose, setPurpose] = useState('Educational explainer');
  const [targetPlatform, setTargetPlatform] = useState('YouTube / Web');
  const [aspectRatio, setAspectRatio] = useState<AspectRatioPreset>('16:9');
  const [resolution, setResolution] = useState<ResolutionPreset>('1080p');
  const [customWidth, setCustomWidth] = useState(1920);
  const [customHeight, setCustomHeight] = useState(1080);
  const [fps, setFps] = useState<FrameRate>(30);
  const [durationCategory, setDurationCategory] = useState<DurationCategory>('short');
  const [targetDurationSec, setTargetDurationSec] = useState(45);
  const [selectedPresets, setSelectedPresets] = useState<CreativePresetId[]>(['technical-blueprint']);
  const [researchMode, setResearchMode] = useState<ResearchMode>('research-assisted');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const allPresets = [...BUILTIN_CREATIVE_PRESETS, ...customPresets];

  const togglePreset = (id: CreativePresetId) => {
    setSelectedPresets((prev) => {
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter((x) => x !== id) : prev;
      }
      return [...prev, id];
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a project title.');
      return;
    }
    if (!subject.trim()) {
      setError('Please describe the main subject or topic for this video.');
      return;
    }
    setError(null);
    onCreate({
      title: title.trim(),
      subject: subject.trim(),
      description: description.trim(),
      targetAudience: targetAudience.trim(),
      language: language.trim(),
      purpose: purpose.trim(),
      targetPlatform: targetPlatform.trim(),
      aspectRatio,
      resolution,
      customWidth,
      customHeight,
      fps,
      durationCategory,
      targetDurationSec,
      creativePresets: selectedPresets,
      researchMode,
    });
    setTitle('');
    setSubject('');
    setDescription('');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto"
    >
      <div className="w-full max-w-3xl bg-[#131720] border border-[#283044] rounded-xl shadow-2xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#232836]">
          <div>
            <h2 id="wizard-title" className="text-lg font-bold text-slate-100">
              Create New Video Project
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Define any subject, format, duration, and visual style configuration.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close project wizard"
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#1E2433]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[78vh] overflow-y-auto">
          {error && (
            <div role="alert" className="px-4 py-2.5 rounded-lg bg-red-950/60 border border-red-800 text-red-200 text-xs">
              {error}
            </div>
          )}

          {/* Section 1: Project Information */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-200">1. Project Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5 text-xs">
                <span className="text-slate-300 font-medium">Project Title *</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Autonomous Ocean Mapping"
                  className="bg-[#0B0E14] border border-[#283044] rounded-md px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs">
                <span className="text-slate-300 font-medium">Main Subject / Topic *</span>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., How multibeam sonar charts the seafloor"
                  className="bg-[#0B0E14] border border-[#283044] rounded-md px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-xs">
              <span className="text-slate-300 font-medium">Description</span>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe goals, key takeaways, or reference angle..."
                className="bg-[#0B0E14] border border-[#283044] rounded-md px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              />
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">Target Audience</span>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="bg-[#0B0E14] border border-[#283044] rounded-md px-2.5 py-1.5 text-slate-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">Language</span>
                <input
                  type="text"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-[#0B0E14] border border-[#283044] rounded-md px-2.5 py-1.5 text-slate-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">Video Purpose</span>
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="bg-[#0B0E14] border border-[#283044] rounded-md px-2.5 py-1.5 text-slate-100"
                >
                  <option>Educational explainer</option>
                  <option>Technical walkthrough</option>
                  <option>Product demonstration</option>
                  <option>Documentary essay</option>
                  <option>Data storytelling</option>
                  <option>Marketing & launch</option>
                  <option>Software tutorial</option>
                  <option>Business presentation</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">Target Platform</span>
                <input
                  type="text"
                  value={targetPlatform}
                  onChange={(e) => setTargetPlatform(e.target.value)}
                  className="bg-[#0B0E14] border border-[#283044] rounded-md px-2.5 py-1.5 text-slate-100"
                />
              </label>
            </div>
          </div>

          {/* Section 2: Video & Duration Settings */}
          <div className="space-y-3 pt-4 border-t border-[#232836]">
            <h3 className="text-sm font-semibold text-slate-200">2. Format, Frame Rate & Duration</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">Aspect Ratio</span>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as AspectRatioPreset)}
                  className="bg-[#0B0E14] border border-[#283044] rounded-md px-2.5 py-1.5 text-slate-100"
                >
                  <option value="16:9">16:9 Landscape</option>
                  <option value="9:16">9:16 Vertical</option>
                  <option value="1:1">1:1 Square</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">Resolution</span>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as ResolutionPreset)}
                  className="bg-[#0B0E14] border border-[#283044] rounded-md px-2.5 py-1.5 text-slate-100"
                >
                  <option value="720p">720p HD</option>
                  <option value="1080p">1080p Full HD</option>
                  <option value="1440p">1440p QHD</option>
                  <option value="4k">4K UHD</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">Frame Rate</span>
                <select
                  value={fps}
                  onChange={(e) => setFps(Number(e.target.value) as FrameRate)}
                  className="bg-[#0B0E14] border border-[#283044] rounded-md px-2.5 py-1.5 text-slate-100"
                >
                  <option value={24}>24 FPS (Cinema)</option>
                  <option value={25}>25 FPS (PAL)</option>
                  <option value={30}>30 FPS (Standard)</option>
                  <option value={60}>60 FPS (Smooth)</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">Research Mode</span>
                <select
                  value={researchMode}
                  onChange={(e) => setResearchMode(e.target.value as ResearchMode)}
                  className="bg-[#0B0E14] border border-[#283044] rounded-md px-2.5 py-1.5 text-slate-100"
                >
                  <option value="research-assisted">Research-assisted</option>
                  <option value="user-material">User material only</option>
                  <option value="creative">Creative mode</option>
                  <option value="mixed">Mixed mode</option>
                </select>
              </label>
            </div>

            {aspectRatio === 'custom' && (
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-slate-400">Custom Width (px)</span>
                  <input
                    type="number"
                    min={320}
                    max={3840}
                    value={customWidth}
                    onChange={(e) => setCustomWidth(Number(e.target.value))}
                    className="bg-[#0B0E14] border border-[#283044] rounded-md px-2.5 py-1.5 text-slate-100 font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-slate-400">Custom Height (px)</span>
                  <input
                    type="number"
                    min={320}
                    max={3840}
                    value={customHeight}
                    onChange={(e) => setCustomHeight(Number(e.target.value))}
                    className="bg-[#0B0E14] border border-[#283044] rounded-md px-2.5 py-1.5 text-slate-100 font-mono"
                  />
                </label>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">Duration Profile</span>
                <select
                  value={durationCategory}
                  onChange={(e) => {
                    const cat = e.target.value as DurationCategory;
                    setDurationCategory(cat);
                    if (cat === 'short') setTargetDurationSec(45);
                    else if (cat === 'medium') setTargetDurationSec(180);
                    else if (cat === 'long') setTargetDurationSec(480);
                  }}
                  className="bg-[#0B0E14] border border-[#283044] rounded-md px-2.5 py-1.5 text-slate-100"
                >
                  <option value="short">Short-form (15–60s)</option>
                  <option value="medium">Medium-form (1–5 min)</option>
                  <option value="long">Long-form (5–20 min)</option>
                  <option value="custom">Custom duration</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">Target Duration (seconds)</span>
                <input
                  type="number"
                  min={10}
                  max={1200}
                  value={targetDurationSec}
                  onChange={(e) => setTargetDurationSec(Number(e.target.value))}
                  className="bg-[#0B0E14] border border-[#283044] rounded-md px-2.5 py-1.5 text-slate-100 font-mono"
                />
              </label>
            </div>
          </div>

          {/* Section 3: Creative Direction (Multi-select styles) */}
          <div className="space-y-3 pt-4 border-t border-[#232836]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">3. Creative Direction (Combine one or more styles)</h3>
              <span className="text-xs text-slate-400 font-mono">{selectedPresets.length} selected</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {allPresets.map((preset) => {
                const active = selectedPresets.includes(preset.id);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => togglePreset(preset.id)}
                    className={`text-left p-3 rounded-lg border transition-colors ${
                      active
                        ? 'bg-[#1A202E] border-amber-500/80 text-slate-100'
                        : 'bg-[#0D1017] border-[#232836] text-slate-300 hover:border-[#374158]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-sm shrink-0 border border-white/15"
                          style={{ backgroundColor: preset.palette.accent }}
                        />
                        <span className="text-xs font-semibold">{preset.name}</span>
                      </div>
                      {active && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{preset.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#232836]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-[#2A3142] text-xs font-medium text-slate-300 hover:bg-[#1B202C]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-md bg-amber-500 text-slate-950 text-xs font-semibold hover:bg-amber-400 transition-colors"
            >
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
