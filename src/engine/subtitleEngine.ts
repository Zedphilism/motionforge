import { StoryboardScene, SubtitleCue } from '../types/studio';
import { computeSceneWindows } from './timelineMath';

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'and', 'for', 'that', 'this', 'with', 'from', 'into', 'your', 'about',
    'what', 'when', 'where', 'which', 'while', 'have', 'been', 'will', 'would',
    'could', 'should', 'their', 'there', 'they', 'them', 'than', 'then', 'every',
  ]);
  const words = text
    .replace(/[^\w\s-]/g, '')
    .split(/\s+/)
    .filter((w) => w.length >= 6 && !stopWords.has(w.toLowerCase()));
  return Array.from(new Set(words)).slice(0, 2);
}

export function generateSubtitlesFromScenes(scenes: StoryboardScene[]): SubtitleCue[] {
  const windows = computeSceneWindows(scenes);
  const cues: SubtitleCue[] = [];
  let cueCounter = 1;

  for (const w of windows) {
    const raw = (w.scene.subtitleText || w.scene.narration || '').trim();
    if (!raw) continue;

    // Split long narration into crisp 8-12 word readable caption chunks
    const words = raw.split(/\s+/);
    const maxWordsPerCue = 10;
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += maxWordsPerCue) {
      chunks.push(words.slice(i, i + maxWordsPerCue).join(' '));
    }

    const totalChars = chunks.reduce((sum, c) => sum + c.length, 0) || 1;
    let cursor = w.startTime;
    const sceneDur = w.endTime - w.startTime;

    chunks.forEach((chunk, idx) => {
      const proportion = chunk.length / totalChars;
      const chunkDur = idx === chunks.length - 1 ? w.endTime - cursor : Math.max(0.8, sceneDur * proportion);
      const startTime = Number(cursor.toFixed(2));
      const endTime = Number(Math.min(w.endTime, cursor + chunkDur).toFixed(2));
      cues.push({
        id: `sub-${String(cueCounter++).padStart(3, '0')}`,
        startTime,
        endTime: Math.max(startTime + 0.3, endTime),
        text: chunk,
        highlightedWords: extractKeywords(chunk),
      });
      cursor = endTime;
    });
  }

  return cues;
}

export function getActiveSubtitleCue(cues: SubtitleCue[], timeSec: number): SubtitleCue | null {
  return cues.find((c) => timeSec >= c.startTime && timeSec < c.endTime) || null;
}

function formatSrtTimestamp(sec: number): string {
  const safe = Math.max(0, sec);
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const ms = Math.round((safe % 1) * 1000);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function formatVttTimestamp(sec: number): string {
  return formatSrtTimestamp(sec).replace(',', '.');
}

export function exportToSRT(cues: SubtitleCue[]): string {
  return cues
    .map((cue, index) => `${index + 1}\n${formatSrtTimestamp(cue.startTime)} --> ${formatSrtTimestamp(cue.endTime)}\n${cue.text}`)
    .join('\n\n');
}

export function exportToVTT(cues: SubtitleCue[]): string {
  const body = cues
    .map((cue) => `${formatVttTimestamp(cue.startTime)} --> ${formatVttTimestamp(cue.endTime)}\n${cue.text}`)
    .join('\n\n');
  return `WEBVTT\n\n${body}`;
}
