import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyEasing,
  computeSceneWindows,
  evaluateClipAtTime,
  formatTimecode,
  frameToTime,
  getActiveSceneWindow,
  snapTime,
  splitClipAtTime,
  timeToFrame,
} from './timelineMath';
import { StoryboardScene, TimelineClip } from '../types/studio';

test('easing functions bound properly at endpoints', () => {
  const easings = ['linear', 'easeOutCubic', 'easeInOutCubic', 'easeOutExpo', 'easeOutBack', 'easeInOutQuad'] as const;
  for (const e of easings) {
    assert.equal(applyEasing(0, e), 0);
    assert.equal(Number(applyEasing(1, e).toFixed(4)), 1);
  }
  assert.ok(applyEasing(0.5, 'easeOutCubic') > 0.5);
});

test('frame and timecode math are consistent', () => {
  assert.equal(frameToTime(30, 30), 1);
  assert.equal(timeToFrame(2.5, 24), 60);
  assert.equal(formatTimecode(65.5, 30), '01:05:15');
});

test('scene windows and active scene lookup match sequential timing', () => {
  const scenes: StoryboardScene[] = [
    {
      id: 's1',
      title: 'Intro',
      duration: 4,
      narration: 'First',
      visualStyle: 'technical-blueprint',
      visualType: 'title',
      camera: 'static',
      animation: 'fade',
      overlayText: 'A',
      subtitleText: 'First',
      soundDesign: '',
      transition: 'cut',
      notes: '',
      approved: true,
      suggestedComponent: 'AnimatedTitle',
      assetIds: [],
    },
    {
      id: 's2',
      title: 'Body',
      duration: 6,
      narration: 'Second',
      visualStyle: 'technical-blueprint',
      visualType: 'chart',
      camera: 'static',
      animation: 'slide',
      overlayText: 'B',
      subtitleText: 'Second',
      soundDesign: '',
      transition: 'crossfade',
      notes: '',
      approved: true,
      suggestedComponent: 'AnimatedChart',
      assetIds: [],
    },
  ];
  const windows = computeSceneWindows(scenes);
  assert.equal(windows[0].startTime, 0);
  assert.equal(windows[0].endTime, 4);
  assert.equal(windows[1].startTime, 4);
  assert.equal(windows[1].endTime, 10);
  assert.equal(getActiveSceneWindow(scenes, 2.5)?.scene.id, 's1');
  assert.equal(getActiveSceneWindow(scenes, 4.0)?.scene.id, 's2');
});

test('evaluateClipAtTime computes deterministic progress and splitClipAtTime divides cleanly', () => {
  const clip: TimelineClip = {
    id: 'c1',
    trackType: 'graphics',
    name: 'Diagram',
    startTime: 2,
    duration: 4,
    layerOrder: 10,
    opacity: 1,
    x: 50,
    y: 50,
    width: 80,
    height: 70,
    scale: 1,
    rotation: 0,
    animation: 'fade',
    animationDuration: 1,
    animationDelay: 0,
    easing: 'linear',
    direction: 'up',
    componentType: 'AnimatedDiagram',
  };

  assert.equal(evaluateClipAtTime(clip, 1.5), null);
  const mid = evaluateClipAtTime(clip, 2.5);
  assert.ok(mid);
  assert.equal(mid.enterProgress, 0.5);
  assert.equal(mid.easedProgress, 0.5);

  const split = splitClipAtTime(clip, 3.5, 'c2');
  assert.ok(split);
  assert.equal(split[0].duration, 1.5);
  assert.equal(split[1].startTime, 3.5);
  assert.equal(split[1].duration, 2.5);
  assert.equal(splitClipAtTime(clip, 2.1, 'c3'), null);
});

test('snapTime snaps within threshold', () => {
  assert.equal(snapTime(4.12, [0, 4, 8], 0.2), 4);
  assert.equal(snapTime(4.45, [0, 4, 8], 0.2), 4.45);
});
