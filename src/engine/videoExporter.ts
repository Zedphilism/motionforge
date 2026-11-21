import { CreativePreset, ExportConfig, Project } from '../types/studio';
import { LoadedMediaCache, renderCompositionFrame } from './compositor';
import { getTotalDuration } from './timelineMath';

export interface ExportCapabilities {
  webCodecs: boolean;
  mediaRecorder: boolean;
  mp4Supported: boolean;
  webmVp9Supported: boolean;
  webmVp8Supported: boolean;
  preferredMimeType: string;
  preferredExtension: 'mp4' | 'webm';
}

export function detectExportCapabilities(): ExportCapabilities {
  const webCodecs = typeof window !== 'undefined' && typeof (window as unknown as { VideoEncoder?: unknown }).VideoEncoder === 'function';
  const mediaRecorder = typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined';

  const candidates: Array<{ mime: string; ext: 'mp4' | 'webm' }> = [
    { mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' },
    { mime: 'video/mp4;codecs=avc1.42E01E', ext: 'mp4' },
    { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
    { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
    { mime: 'video/webm;codecs=vp9', ext: 'webm' },
    { mime: 'video/webm;codecs=vp8', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' },
  ];

  const isSupported = (m: string) => (mediaRecorder ? MediaRecorder.isTypeSupported(m) : false);
  const mp4Supported =
    isSupported('video/mp4;codecs=avc1.42E01E,mp4a.40.2') || isSupported('video/mp4;codecs=avc1.42E01E');
  const webmVp9Supported = isSupported('video/webm;codecs=vp9,opus') || isSupported('video/webm;codecs=vp9');
  const webmVp8Supported = isSupported('video/webm;codecs=vp8,opus') || isSupported('video/webm;codecs=vp8');

  const chosen = candidates.find((c) => isSupported(c.mime)) || { mime: 'video/webm', ext: 'webm' as const };
  return {
    webCodecs,
    mediaRecorder,
    mp4Supported,
    webmVp9Supported,
    webmVp8Supported,
    preferredMimeType: chosen.mime,
    preferredExtension: chosen.ext,
  };
}

export interface RenderProgress {
  percent: number;
  currentFrame: number;
  totalFrames: number;
  elapsedSec: number;
  estimatedRemainingSec: number;
  phase: 'preparing' | 'rendering' | 'finalizing' | 'verifying';
}

export interface RenderedVideoResult {
  blob: Blob;
  objectUrl: string;
  mimeType: string;
  extension: 'mp4' | 'webm';
  sizeBytes: number;
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  framesRendered: number;
}

export async function renderVideoProject(options: {
  project: Project;
  exportConfig: ExportConfig;
  customPresets: CreativePreset[];
  mediaCache: LoadedMediaCache;
  signal: AbortSignal;
  onProgress: (progress: RenderProgress) => void;
}): Promise<RenderedVideoResult> {
  const { project, exportConfig, customPresets, mediaCache, signal, onProgress } = options;
  const caps = detectExportCapabilities();

  if (!caps.mediaRecorder) {
    throw new Error('This browser does not support MediaRecorder canvas video capture.');
  }

  let chosenMime = caps.preferredMimeType;
  let extension: 'mp4' | 'webm' = caps.preferredExtension;
  if (exportConfig.format === 'mp4' && caps.mp4Supported) {
    chosenMime = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42E01E,mp4a.40.2')
      ? 'video/mp4;codecs=avc1.42E01E,mp4a.40.2'
      : 'video/mp4;codecs=avc1.42E01E';
    extension = 'mp4';
  } else {
    chosenMime = caps.webmVp9Supported
      ? 'video/webm;codecs=vp9'
      : caps.webmVp8Supported
      ? 'video/webm;codecs=vp8'
      : 'video/webm';
    extension = 'webm';
  }

  const width = exportConfig.width;
  const height = exportConfig.height;
  const fps = exportConfig.fps || 30;
  const durationSec = getTotalDuration(project);
  const totalFrames = Math.max(1, Math.ceil(durationSec * fps));

  onProgress({
    percent: 1,
    currentFrame: 0,
    totalFrames,
    elapsedSec: 0,
    estimatedRemainingSec: durationSec,
    phase: 'preparing',
  });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to acquire 2D rendering context for export.');
  }

  // Paint frame 0 before starting captureStream
  renderCompositionFrame(ctx, project, 0, width, height, customPresets, mediaCache, exportConfig.burnSubtitles);

  const canvasStream = canvas.captureStream(fps);
  let audioCtx: AudioContext | null = null;
  const scheduledSources: AudioBufferSourceNode[] = [];

  // Mix project audio clips into MediaRecorder stream if present
  if (exportConfig.includeAudio) {
    const audioClips = project.clips.filter((c) => c.trackType === 'audio' && !c.muted && c.assetId);
    if (audioClips.length > 0 && typeof AudioContext !== 'undefined') {
      try {
        audioCtx = new AudioContext();
        const dest = audioCtx.createMediaStreamDestination();
        const masterGain = audioCtx.createGain();
        masterGain.gain.value = project.audioMix.masterVolume ?? 1;
        masterGain.connect(dest);

        const baseTime = audioCtx.currentTime + 0.08;
        for (const clip of audioClips) {
          const blob = clip.assetId ? mediaCache.blobs.get(clip.assetId) : undefined;
          if (!blob) continue;
          const arrBuf = await blob.arrayBuffer();
          const audioBuf = await audioCtx.decodeAudioData(arrBuf.slice(0));
          const source = audioCtx.createBufferSource();
          source.buffer = audioBuf;

          const gain = audioCtx.createGain();
          const catGain =
            clip.audioCategory === 'music'
              ? project.audioMix.musicVolume
              : clip.audioCategory === 'sfx'
              ? project.audioMix.sfxVolume
              : clip.audioCategory === 'ambient'
              ? project.audioMix.ambientVolume
              : project.audioMix.narrationVolume;
          const targetVol = (clip.volume ?? 1) * (catGain ?? 1);
          gain.gain.setValueAtTime(targetVol, baseTime + clip.startTime);

          source.connect(gain);
          gain.connect(masterGain);
          source.start(baseTime + clip.startTime, 0, clip.duration);
          scheduledSources.push(source);
        }

        const audioTracks = dest.stream.getAudioTracks();
        if (audioTracks.length > 0) {
          canvasStream.addTrack(audioTracks[0]);
        }
      } catch {
        // Proceed with video-only stream if audio decode fails
      }
    }
  }

  const chunks: BlobPart[] = [];
  const recorderOptions: MediaRecorderOptions = {
    videoBitsPerSecond: exportConfig.videoBitsPerSecond || 5_000_000,
  };
  if (chosenMime && MediaRecorder.isTypeSupported(chosenMime)) {
    recorderOptions.mimeType = chosenMime;
  }

  const recorder = new MediaRecorder(canvasStream, recorderOptions);
  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) {
      chunks.push(ev.data);
    }
  };

  const stopPromise = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = () => reject(new Error('MediaRecorder encountered an encoding error.'));
  });

  const startMs = performance.now();
  recorder.start(250);

  const frameDurationMs = 1000 / fps;
  let framesRendered = 0;

  try {
    for (let frame = 0; frame < totalFrames; frame++) {
      if (signal.aborted) {
        recorder.stop();
        throw new DOMException('Render cancelled by user.', 'AbortError');
      }

      const simTime = frame / fps;
      renderCompositionFrame(ctx, project, simTime, width, height, customPresets, mediaCache, exportConfig.burnSubtitles);
      framesRendered = frame + 1;

      const elapsedSec = (performance.now() - startMs) / 1000;
      const pct = Math.min(96, Math.round((framesRendered / totalFrames) * 95));
      const remainingFrames = totalFrames - framesRendered;
      const avgPerFrame = elapsedSec / Math.max(1, framesRendered);
      const estimatedRemainingSec = Math.max(0, Number((remainingFrames * avgPerFrame).toFixed(1)));

      if (frame % Math.max(1, Math.round(fps / 6)) === 0 || frame === totalFrames - 1) {
        onProgress({
          percent: pct,
          currentFrame: framesRendered,
          totalFrames,
          elapsedSec: Number(elapsedSec.toFixed(1)),
          estimatedRemainingSec,
          phase: 'rendering',
        });
      }

      // Pace capture to real frame interval so MediaRecorder timestamps stay smooth and playable
      const targetElapsedMs = (frame + 1) * frameDurationMs;
      const waitMs = targetElapsedMs - (performance.now() - startMs);
      if (waitMs > 2) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, frameDurationMs * 1.5)));
      } else {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    onProgress({
      percent: 98,
      currentFrame: framesRendered,
      totalFrames,
      elapsedSec: Number(((performance.now() - startMs) / 1000).toFixed(1)),
      estimatedRemainingSec: 0,
      phase: 'finalizing',
    });

    recorder.stop();
    await stopPromise;
  } finally {
    scheduledSources.forEach((s) => {
      try {
        s.stop();
      } catch {
        // ignore
      }
    });
    if (audioCtx) {
      await audioCtx.close().catch(() => undefined);
    }
    canvasStream.getTracks().forEach((t) => t.stop());
  }

  onProgress({
    percent: 99,
    currentFrame: framesRendered,
    totalFrames,
    elapsedSec: Number(((performance.now() - startMs) / 1000).toFixed(1)),
    estimatedRemainingSec: 0,
    phase: 'verifying',
  });

  const finalMime = recorder.mimeType || chosenMime || 'video/webm';
  const blob = new Blob(chunks, { type: finalMime });
  if (blob.size === 0) {
    throw new Error('Rendered video blob is empty (0 bytes). Try switching container format or reducing resolution.');
  }

  const objectUrl = URL.createObjectURL(blob);
  return {
    blob,
    objectUrl,
    mimeType: finalMime,
    extension: finalMime.includes('mp4') ? 'mp4' : extension,
    sizeBytes: blob.size,
    durationSec,
    width,
    height,
    fps,
    framesRendered,
  };
}
