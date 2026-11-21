import test from 'node:test';
import assert from 'node:assert/strict';
import { exportToSRT, exportToVTT, generateSubtitlesFromScenes, getActiveSubtitleCue } from './subtitleEngine';
import { StoryboardScene } from '../types/studio';

const sampleScenes: StoryboardScene[] = [
  {
    id: 's1',
    title: 'Hook',
    duration: 5,
    narration: 'Modern solar microgrids balance supply across neighborhoods automatically every single second.',
    visualStyle: 'technical-blueprint',
    visualType: 'title',
    camera: 'push',
    animation: 'fade',
    overlayText: 'MICROGRIDS',
    subtitleText: 'Modern solar microgrids balance supply across neighborhoods automatically every single second.',
    soundDesign: '',
    transition: 'cut',
    notes: '',
    approved: true,
    suggestedComponent: 'AnimatedTitle',
    assetIds: [],
  },
];

test('generateSubtitlesFromScenes creates ordered cues with keyword highlights', () => {
  const cues = generateSubtitlesFromScenes(sampleScenes);
  assert.ok(cues.length >= 1);
  assert.equal(cues[0].startTime, 0);
  assert.ok(cues[cues.length - 1].endTime <= 5.01);
  assert.ok(cues[0].highlightedWords.length > 0);
  assert.equal(getActiveSubtitleCue(cues, 0.5)?.id, cues[0].id);
});

test('exportToSRT and exportToVTT produce valid subtitle formats', () => {
  const cues = [
    { id: '1', startTime: 0, endTime: 2.5, text: 'Hello world', highlightedWords: [] },
    { id: '2', startTime: 2.5, endTime: 5.0, text: 'Second line', highlightedWords: [] },
  ];
  const srt = exportToSRT(cues);
  assert.match(srt, /00:00:00,000 --> 00:00:02,500/);
  assert.match(srt, /2\n00:00:02,500 --> 00:00:05,000/);

  const vtt = exportToVTT(cues);
  assert.ok(vtt.startsWith('WEBVTT\n\n'));
  assert.match(vtt, /00:00:00\.000 --> 00:00:02\.500/);
});
