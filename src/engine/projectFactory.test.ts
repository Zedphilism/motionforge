import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBlankProject,
  estimateNarrationDuration,
  parseImportedProject,
  resolveDimensions,
} from './projectFactory';

test('resolveDimensions supports 16:9, 9:16, 1:1 and custom dimensions', () => {
  assert.deepEqual(resolveDimensions('16:9', '1080p'), { width: 1920, height: 1080 });
  assert.deepEqual(resolveDimensions('9:16', '720p'), { width: 720, height: 1280 });
  assert.deepEqual(resolveDimensions('1:1', '1080p'), { width: 1080, height: 1080 });
  assert.deepEqual(resolveDimensions('custom', 'custom', 1201, 601), { width: 1202, height: 602 });
});

test('createBlankProject adapts to arbitrary topics and round-trips through JSON import', () => {
  const proj = createBlankProject({
    title: 'Autonomous Ocean Mapping',
    subject: 'Multibeam Sonar Bathymetry',
    aspectRatio: '16:9',
    resolution: '720p',
    fps: 24,
    creativePresets: ['scientific-visualisation'],
  });
  assert.equal(proj.title, 'Autonomous Ocean Mapping');
  assert.equal(proj.settings.width, 1280);
  assert.equal(proj.settings.height, 720);
  assert.equal(proj.settings.fps, 24);
  assert.ok(proj.script.length >= 4);
  assert.ok(proj.storyboard.length >= 4);
  assert.ok(proj.clips.length >= 4);
  assert.ok(proj.subtitles.length >= 4);

  const imported = parseImportedProject(JSON.stringify(proj));
  assert.equal(imported.title, proj.title);
  assert.notEqual(imported.id, proj.id);
  assert.equal(imported.storyboard.length, proj.storyboard.length);
});

test('estimateNarrationDuration scales with word count', () => {
  const shortDur = estimateNarrationDuration('Hello world');
  const longDur = estimateNarrationDuration('word '.repeat(145));
  assert.ok(shortDur >= 2.5);
  assert.ok(longDur >= 55 && longDur <= 65);
});
