import { EasingType, Project, StoryboardScene, TimelineClip } from '../types/studio';

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function applyEasing(t: number, easing: EasingType = 'easeOutCubic'): number {
  const x = clamp(t, 0, 1);
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  switch (easing) {
    case 'linear':
      return x;
    case 'easeOutCubic':
      return 1 - Math.pow(1 - x, 3);
    case 'easeInOutCubic':
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    case 'easeOutExpo':
      return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
    case 'easeOutBack': {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    }
    case 'easeInOutQuad':
      return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    default:
      return x;
  }
}

export function frameToTime(frame: number, fps: number): number {
  if (fps <= 0) return 0;
  return Math.max(0, frame) / fps;
}

export function timeToFrame(timeSec: number, fps: number): number {
  if (fps <= 0) return 0;
  return Math.max(0, Math.round(timeSec * fps));
}

export function formatTimecode(timeSec: number, fps = 30): string {
  const safeTime = Math.max(0, timeSec);
  const mins = Math.floor(safeTime / 60);
  const secs = Math.floor(safeTime % 60);
  const frames = Math.floor((safeTime % 1) * fps);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
}

export interface SceneWindow {
  scene: StoryboardScene;
  index: number;
  startTime: number;
  endTime: number;
}

export function computeSceneWindows(scenes: StoryboardScene[]): SceneWindow[] {
  let cursor = 0;
  return scenes.map((scene, index) => {
    const duration = Math.max(0.5, scene.duration || 4);
    const startTime = cursor;
    const endTime = cursor + duration;
    cursor = endTime;
    return { scene, index, startTime, endTime };
  });
}

export function getTotalDuration(project: Pick<Project, 'storyboard' | 'clips'>): number {
  const storyboardEnd = project.storyboard.reduce((acc, s) => acc + Math.max(0.5, s.duration || 0), 0);
  const clipEnd = project.clips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0);
  return Math.max(4, Math.ceil(Math.max(storyboardEnd, clipEnd) * 10) / 10);
}

export function getActiveSceneWindow(scenes: StoryboardScene[], timeSec: number): SceneWindow | null {
  const windows = computeSceneWindows(scenes);
  if (windows.length === 0) return null;
  const clampedTime = Math.max(0, timeSec);
  const match = windows.find((w) => clampedTime >= w.startTime && clampedTime < w.endTime);
  return match || windows[windows.length - 1];
}

export interface EvaluatedClipState {
  clip: TimelineClip;
  localTime: number;
  normalizedTime: number;
  enterProgress: number;
  easedProgress: number;
  exitProgress: number;
  effectiveOpacity: number;
}

export function evaluateClipAtTime(clip: TimelineClip, timeSec: number): EvaluatedClipState | null {
  if (timeSec < clip.startTime || timeSec >= clip.startTime + clip.duration) {
    return null;
  }
  const localTime = timeSec - clip.startTime;
  const normalizedTime = clip.duration > 0 ? clamp(localTime / clip.duration, 0, 1) : 1;
  const delay = Math.max(0, clip.animationDelay || 0);
  const animDur = Math.max(0.05, clip.animationDuration || 0.8);
  const enterProgress = clamp((localTime - delay) / animDur, 0, 1);
  const easedProgress = applyEasing(enterProgress, clip.easing);

  const fadeOutWindow = Math.min(0.35, clip.duration * 0.2);
  const timeRemaining = clip.duration - localTime;
  const exitProgress = fadeOutWindow > 0 ? clamp(timeRemaining / fadeOutWindow, 0, 1) : 1;

  const baseOpacity = clamp(clip.opacity ?? 1, 0, 1);
  const effectiveOpacity =
    clip.animation === 'fade' ? baseOpacity * easedProgress * exitProgress : baseOpacity * Math.min(1, exitProgress * 1.4);

  return {
    clip,
    localTime,
    normalizedTime,
    enterProgress,
    easedProgress,
    exitProgress,
    effectiveOpacity,
  };
}

export function getActiveVisualClips(clips: TimelineClip[], timeSec: number): EvaluatedClipState[] {
  return clips
    .filter((c) => c.trackType !== 'audio')
    .map((c) => evaluateClipAtTime(c, timeSec))
    .filter((state): state is EvaluatedClipState => state !== null)
    .sort((a, b) => a.clip.layerOrder - b.clip.layerOrder);
}

export function splitClipAtTime(clip: TimelineClip, splitTime: number, nextId: string): [TimelineClip, TimelineClip] | null {
  const minSegment = 0.25;
  if (splitTime <= clip.startTime + minSegment || splitTime >= clip.startTime + clip.duration - minSegment) {
    return null;
  }
  const firstDuration = Number((splitTime - clip.startTime).toFixed(2));
  const secondDuration = Number((clip.duration - firstDuration).toFixed(2));
  const first: TimelineClip = {
    ...clip,
    duration: firstDuration,
  };
  const second: TimelineClip = {
    ...clip,
    id: nextId,
    name: `${clip.name} (Part 2)`,
    startTime: Number(splitTime.toFixed(2)),
    duration: secondDuration,
  };
  return [first, second];
}

export function snapTime(rawTime: number, snapPoints: number[], threshold = 0.2): number {
  let best = Math.max(0, rawTime);
  let bestDist = threshold;
  for (const pt of snapPoints) {
    const dist = Math.abs(rawTime - pt);
    if (dist < bestDist) {
      bestDist = dist;
      best = pt;
    }
  }
  return Number(best.toFixed(2));
}
