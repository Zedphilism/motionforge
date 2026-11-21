import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Box } from 'lucide-react';
import { MediaAsset, Scene3DConfig } from '../types/studio';
import { ThreeSceneController } from '../engine/threeSceneManager';
import { LoadedMediaCache } from '../engine/compositor';

interface ThreeStudioCanvasProps {
  config: Scene3DConfig;
  modelAssets: MediaAsset[];
  mediaCache: LoadedMediaCache;
  onChange: (next: Scene3DConfig) => void;
  onInsertToTimeline: () => void;
}

export const ThreeStudioCanvas: React.FC<ThreeStudioCanvasProps> = ({
  config,
  modelAssets,
  mediaCache,
  onChange,
  onInsertToTimeline,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<ThreeSceneController | null>(null);
  const [dockOpen, setDockOpen] = useState(true);
  const [webglError, setWebglError] = useState<string | null>(null);

  // Initialize Three.js WebGLRenderer once per mount
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    try {
      const rect = mount.getBoundingClientRect();
      const ctrl = new ThreeSceneController({
        width: Math.max(320, Math.round(rect.width || 640)),
        height: Math.max(240, Math.round(rect.height || 360)),
        interactive: true,
        container: mount,
      });
      controllerRef.current = ctrl;
      ctrl.applyConfig(config, 0, true);
      ctrl.requestRender();

      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 10 && height > 10) {
            ctrl.resize(Math.round(width), Math.round(height));
          }
        }
      });
      observer.observe(mount);

      return () => {
        observer.disconnect();
        ctrl.dispose();
        controllerRef.current = null;
      };
    } catch (err) {
      setWebglError(err instanceof Error ? err.message : 'WebGL context could not be initialized.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync config & uploaded GLB models on demand
  useEffect(() => {
    const ctrl = controllerRef.current;
    if (!ctrl) return;
    const sync = async () => {
      if (config.modelAssetId) {
        const blob = mediaCache.blobs.get(config.modelAssetId);
        if (blob) {
          await ctrl.loadGltfFromBlob(blob, config.modelAssetId).catch(() => undefined);
        }
      }
      ctrl.applyConfig(config, 0, true);
      ctrl.requestRender();
    };
    void sync();
  }, [config, mediaCache]);

  const update = (partial: Partial<Scene3DConfig>) => {
    onChange({ ...config, ...partial });
  };

  return (
    <div className="relative bg-[#090C11] border border-[#232836] rounded-lg overflow-hidden h-[480px]">
      {/* Isolated WebGL Mount Container */}
      <div
        ref={mountRef}
        data-testid="three-3d-viewport"
        className="w-full h-full"
      />

      {webglError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0D1017] p-6 text-center">
          <Box className="w-8 h-8 text-slate-400 mb-2" />
          <p className="text-sm font-medium text-slate-200">3D WebGL Viewport Unavailable</p>
          <p className="text-xs text-slate-400 mt-1 max-w-md">{webglError}</p>
        </div>
      )}

      {/* Minimal Top-Left Viewport Label */}
      <div className="absolute top-3 left-3 z-10 pointer-events-none px-2.5 py-1 rounded bg-[#0B0E14]/90 border border-[#252B3B] text-xs text-slate-300 font-mono">
        3D Stage · {config.cameraType === 'perspective' ? 'Perspective' : 'Orthographic'} · Drag to orbit
      </div>

      {/* Top-Right Insert Action */}
      <div className="absolute top-3 right-3 z-10">
        <button
          type="button"
          onClick={onInsertToTimeline}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400 transition-colors whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add 3D Clip to Timeline</span>
        </button>
      </div>

      {/* Collapsible Unified Bottom Control Dock (solid dark surface, no backdrop-filter over WebGL) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 w-[min(94%,760px)] flex flex-col items-center">
        <button
          type="button"
          onClick={() => setDockOpen((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1 rounded-t-md bg-[#151924] border border-b-0 border-[#283044] text-[11px] font-medium text-slate-300 hover:text-white"
        >
          {dockOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          <span>{dockOpen ? 'Hide 3D Controls' : 'Show 3D Controls'}</span>
        </button>

        {dockOpen && (
          <div className="w-full bg-[#131722] border border-[#283044] rounded-lg px-3.5 py-2.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <label className="flex flex-col gap-1">
              <span className="text-slate-400">3D Subject / GLB</span>
              <select
                value={config.modelAssetId ? `asset:${config.modelAssetId}` : config.proceduralArchetype}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.startsWith('asset:')) {
                    update({ modelAssetId: val.slice(6) });
                  } else {
                    update({
                      modelAssetId: undefined,
                      proceduralArchetype: val as Scene3DConfig['proceduralArchetype'],
                    });
                  }
                }}
                className="bg-[#0B0E14] border border-[#2A3244] rounded px-2 py-1 text-slate-200"
              >
                <option value="modular-core">Modular Core</option>
                <option value="turbine-rotor">Turbine Rotor</option>
                <option value="orbital-array">Orbital Array</option>
                <option value="layered-chassis">Layered Chassis</option>
                {modelAssets.map((a) => (
                  <option key={a.id} value={`asset:${a.id}`}>
                    GLB: {a.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-slate-400">Exploded View ({Math.round(config.explodedFactor * 100)}%)</span>
              <input
                type="range"
                min={0}
                max={1.2}
                step={0.05}
                value={config.explodedFactor}
                onChange={(e) => update({ explodedFactor: Number(e.target.value) })}
                className="accent-amber-500 mt-1"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-slate-400">Camera & Shading</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    update({ cameraType: config.cameraType === 'perspective' ? 'orthographic' : 'perspective' })
                  }
                  className="px-2 py-1 rounded bg-[#1E2433] border border-[#2E364A] text-slate-200 hover:bg-[#272E42] whitespace-nowrap"
                >
                  {config.cameraType === 'perspective' ? 'Persp' : 'Ortho'}
                </button>
                <button
                  type="button"
                  onClick={() => update({ wireframe: !config.wireframe })}
                  className={`px-2 py-1 rounded border whitespace-nowrap ${
                    config.wireframe
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-[#1E2433] border-[#2E364A] text-slate-200'
                  }`}
                >
                  Wireframe
                </button>
              </div>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-slate-400">Material & Metalness</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Primary 3D material color"
                  value={config.materialColor}
                  onChange={(e) => update({ materialColor: e.target.value })}
                  className="w-7 h-6 bg-transparent border-0 cursor-pointer"
                />
                <input
                  type="range"
                  aria-label="Material metalness"
                  min={0}
                  max={1}
                  step={0.05}
                  value={config.metalness}
                  onChange={(e) => update({ metalness: Number(e.target.value) })}
                  className="accent-amber-500 flex-1"
                />
              </div>
            </label>
          </div>
        )}
      </div>
    </div>
  );
};
