import { CreativePreset, Project, TimelineClip } from '../types/studio';
import { getPresetById } from '../data/creativePresets';
import {
  clamp,
  EvaluatedClipState,
  getActiveSceneWindow,
  getActiveVisualClips,
} from './timelineMath';
import { getActiveSubtitleCue } from './subtitleEngine';
import { render3DSnapshot } from './threeSceneManager';

export interface LoadedMediaCache {
  images: Map<string, HTMLImageElement>;
  videos: Map<string, HTMLVideoElement>;
  blobs: Map<string, Blob>;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = (text || '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

function drawPresetBackdrop(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  preset: CreativePreset,
  timeSec: number
) {
  ctx.fillStyle = preset.palette.background;
  ctx.fillRect(0, 0, w, h);

  if (preset.backgroundTreatment === 'radial-studio' || preset.backgroundTreatment === 'gradient-depth') {
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.42, w * 0.05, w * 0.5, h * 0.5, w * 0.72);
    grad.addColorStop(0, preset.palette.surface);
    grad.addColorStop(1, preset.palette.background);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  } else if (preset.backgroundTreatment === 'blueprint-grid') {
    const step = Math.max(36, Math.round(w / 32));
    ctx.strokeStyle = preset.palette.gridLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= w; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = 0; y <= h; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
  } else if (preset.backgroundTreatment === 'editorial-grain') {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, preset.palette.background);
    grad.addColorStop(1, preset.palette.surface);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    // Subtle corner crop marks
    const m = Math.round(Math.min(w, h) * 0.045);
    const len = Math.round(Math.min(w, h) * 0.025);
    ctx.strokeStyle = preset.palette.gridLine;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(m, m + len);
    ctx.lineTo(m, m);
    ctx.lineTo(m + len, m);
    ctx.moveTo(w - m - len, h - m);
    ctx.lineTo(w - m, h - m);
    ctx.lineTo(w - m, h - m - len);
    ctx.stroke();
  } else if (preset.backgroundTreatment === 'dark-tech') {
    const shift = (timeSec * 12) % 60;
    ctx.strokeStyle = preset.palette.gridLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = -60 + shift; y < h; y += 60) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
  }
}

function applyAnimationTransform(
  ctx: CanvasRenderingContext2D,
  state: EvaluatedClipState,
  w: number,
  h: number
) {
  const { clip, easedProgress, localTime } = state;
  const inv = 1 - easedProgress;
  let tx = 0;
  let ty = 0;
  let sx = clip.scale || 1;
  let sy = clip.scale || 1;
  let rot = (clip.rotation || 0) * (Math.PI / 180);

  const slideDist = Math.min(w, h) * 0.08;
  switch (clip.animation) {
    case 'slide':
    case 'reveal':
      if (clip.direction === 'up') ty = inv * slideDist;
      else if (clip.direction === 'down') ty = -inv * slideDist;
      else if (clip.direction === 'left') tx = inv * slideDist;
      else if (clip.direction === 'right') tx = -inv * slideDist;
      break;
    case 'scale':
      sx *= 0.82 + 0.18 * easedProgress;
      sy *= 0.82 + 0.18 * easedProgress;
      break;
    case 'pulse': {
      const pulse = 1 + Math.sin(localTime * 3.5) * 0.025;
      sx *= pulse;
      sy *= pulse;
      break;
    }
    case 'rotate':
      rot += inv * 0.18;
      break;
    case 'parallax':
      tx = Math.sin(localTime * 0.8) * w * 0.012;
      ty = Math.cos(localTime * 0.6) * h * 0.008;
      break;
    case 'blueprint-assembly':
      ty = inv * slideDist * 0.5;
      sx *= 0.94 + 0.06 * easedProgress;
      sy *= 0.94 + 0.06 * easedProgress;
      break;
    default:
      break;
  }

  ctx.translate(tx, ty);
  ctx.rotate(rot);
  ctx.scale(sx, sy);
}

function renderMotionComponent(
  ctx: CanvasRenderingContext2D,
  state: EvaluatedClipState,
  canvasW: number,
  canvasH: number,
  preset: CreativePreset,
  project: Project,
  mediaCache?: LoadedMediaCache
) {
  const { clip, easedProgress, localTime, normalizedTime } = state;
  const props = clip.motionProps || {};
  const cx = (clip.x / 100) * canvasW;
  const cy = (clip.y / 100) * canvasH;
  const boxW = (clip.width / 100) * canvasW;
  const boxH = (clip.height / 100) * canvasH;
  const accent = props.accentColor || preset.palette.accent;
  const primary = preset.palette.primary;
  const textColor = props.textColor || preset.palette.text;
  const muted = preset.palette.mutedText;
  const surface = props.bgColor || preset.palette.surface;
  const scaleUnit = Math.min(canvasW, canvasH) / 720;

  ctx.save();
  ctx.globalAlpha = clamp(state.effectiveOpacity, 0, 1);
  ctx.translate(cx, cy);
  applyAnimationTransform(ctx, state, canvasW, canvasH);

  // Wipe / Mask reveal clip path
  if (clip.animation === 'wipe' || clip.animation === 'mask-reveal' || clip.animation === 'split-transition') {
    ctx.beginPath();
    if (clip.animation === 'split-transition') {
      const halfW = (boxW / 2) * easedProgress;
      ctx.rect(-halfW, -boxH / 2 - 20, halfW * 2, boxH + 40);
    } else {
      ctx.rect(-boxW / 2 - 20, -boxH / 2 - 20, (boxW + 40) * easedProgress, boxH + 40);
    }
    ctx.clip();
  }

  const component = clip.componentType || 'AnimatedTitle';

  switch (component) {
    case 'BlueprintGrid': {
      // Subtle frame border & index coordinate header
      const pad = 28 * scaleUnit;
      ctx.strokeStyle = preset.palette.gridLine;
      ctx.lineWidth = 1.5 * scaleUnit;
      ctx.strokeRect(-canvasW / 2 + pad, -canvasH / 2 + pad, canvasW - pad * 2, canvasH - pad * 2);

      // Corner ticks
      ctx.strokeStyle = primary;
      ctx.lineWidth = 2 * scaleUnit;
      const tick = 14 * scaleUnit;
      const corners = [
        [-canvasW / 2 + pad, -canvasH / 2 + pad, 1, 1],
        [canvasW / 2 - pad, -canvasH / 2 + pad, -1, 1],
        [-canvasW / 2 + pad, canvasH / 2 - pad, 1, -1],
        [canvasW / 2 - pad, canvasH / 2 - pad, -1, -1],
      ];
      for (const [x, y, dx, dy] of corners) {
        ctx.beginPath();
        ctx.moveTo(x, y + dy * tick);
        ctx.lineTo(x, y);
        ctx.lineTo(x + dx * tick, y);
        ctx.stroke();
      }

      if (props.label) {
        ctx.font = `500 ${Math.round(13 * scaleUnit)}px "${preset.typography.monoFont}", monospace`;
        ctx.fillStyle = muted;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(props.label, -canvasW / 2 + pad + 14 * scaleUnit, canvasH / 2 - pad - 12 * scaleUnit);
      }
      break;
    }

    case 'AnimatedTitle': {
      const title = props.title || clip.name;
      const subtitle = props.subtitle || '';
      const rawChars =
        clip.animation === 'typewriter' ? title.slice(0, Math.max(1, Math.ceil(title.length * easedProgress))) : title;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (props.label) {
        ctx.font = `600 ${Math.round(14 * scaleUnit)}px "${preset.typography.monoFont}", monospace`;
        ctx.fillStyle = accent;
        ctx.fillText(props.label, 0, -68 * scaleUnit);
      }

      const fontSize = Math.round((props.fontSize || 58) * scaleUnit);
      ctx.font = `${preset.typography.headingWeight} ${fontSize}px "${preset.typography.headingFont}", sans-serif`;
      ctx.fillStyle = textColor;
      const lines = wrapTextLines(ctx, rawChars, boxW * 0.9);
      const lh = fontSize * 1.15;
      const startY = -((lines.length - 1) * lh) / 2;
      lines.forEach((line, idx) => {
        ctx.fillText(line, 0, startY + idx * lh);
      });

      // Accent underline rule
      const ruleW = 140 * scaleUnit * easedProgress;
      ctx.fillStyle = accent;
      ctx.fillRect(-ruleW / 2, startY + lines.length * lh * 0.65 + 14 * scaleUnit, ruleW, 3.5 * scaleUnit);

      if (subtitle) {
        ctx.font = `500 ${Math.round(20 * scaleUnit)}px "${preset.typography.bodyFont}", sans-serif`;
        ctx.fillStyle = muted;
        ctx.fillText(subtitle, 0, startY + lines.length * lh * 0.65 + 46 * scaleUnit);
      }
      break;
    }

    case 'KineticTypography': {
      const words = (props.title || props.body || clip.name).split(/\s+/).filter(Boolean);
      const visibleCount = Math.max(1, Math.ceil(words.length * clamp(easedProgress * 1.15, 0, 1)));
      const fontSize = Math.round((props.fontSize || 66) * scaleUnit);
      ctx.font = `800 ${fontSize}px "${preset.typography.headingFont}", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const shown = words.slice(0, visibleCount);
      const lineText = shown.join(' ');
      const lines = wrapTextLines(ctx, lineText, boxW * 0.88);
      const lh = fontSize * 1.12;
      const startY = -((lines.length - 1) * lh) / 2;

      lines.forEach((line, idx) => {
        const isLast = idx === lines.length - 1;
        ctx.fillStyle = isLast ? accent : textColor;
        ctx.fillText(line, 0, startY + idx * lh);
      });
      break;
    }

    case 'TechnicalCallout': {
      const cardW = Math.min(boxW * 0.56, 460 * scaleUnit);
      const cardH = 140 * scaleUnit;
      const anchorX = -boxW * 0.28;
      const anchorY = boxH * 0.14;
      const elbowX = -boxW * 0.08;
      const elbowY = -boxH * 0.08;

      // Target crosshair
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2 * scaleUnit;
      ctx.beginPath();
      ctx.arc(anchorX, anchorY, 10 * scaleUnit, 0, Math.PI * 2);
      ctx.stroke();

      // Progressive leader line
      ctx.beginPath();
      ctx.moveTo(anchorX, anchorY);
      const p1 = clamp(easedProgress * 2, 0, 1);
      const p2 = clamp(easedProgress * 2 - 1, 0, 1);
      ctx.lineTo(anchorX + (elbowX - anchorX) * p1, anchorY + (elbowY - anchorY) * p1);
      if (p2 > 0) {
        ctx.lineTo(elbowX + 42 * scaleUnit * p2, elbowY);
      }
      ctx.stroke();

      // Info box
      const bx = elbowX + 42 * scaleUnit;
      const by = elbowY - cardH / 2;
      ctx.globalAlpha = clamp(state.effectiveOpacity * p2, 0, 1);
      drawRoundedRect(ctx, bx, by, cardW, cardH, 8 * scaleUnit);
      ctx.fillStyle = surface;
      ctx.fill();
      ctx.strokeStyle = primary;
      ctx.lineWidth = 1.5 * scaleUnit;
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = `600 ${Math.round(13 * scaleUnit)}px "${preset.typography.monoFont}", monospace`;
      ctx.fillStyle = accent;
      ctx.fillText(props.label || 'SPECIFICATION', bx + 18 * scaleUnit, by + 16 * scaleUnit);

      ctx.font = `700 ${Math.round(24 * scaleUnit)}px "${preset.typography.headingFont}", sans-serif`;
      ctx.fillStyle = textColor;
      ctx.fillText(props.title || 'Component Node', bx + 18 * scaleUnit, by + 40 * scaleUnit);

      ctx.font = `400 ${Math.round(15 * scaleUnit)}px "${preset.typography.bodyFont}", sans-serif`;
      ctx.fillStyle = muted;
      const bodyLines = wrapTextLines(ctx, props.body || 'Calibrated technical parameter.', cardW - 36 * scaleUnit).slice(0, 2);
      bodyLines.forEach((l, i) => {
        ctx.fillText(l, bx + 18 * scaleUnit, by + 76 * scaleUnit + i * 22 * scaleUnit);
      });
      break;
    }

    case 'AnimatedArrow': {
      const len = boxW * 0.55 * easedProgress;
      const startX = -boxW * 0.28;
      ctx.strokeStyle = accent;
      ctx.fillStyle = accent;
      ctx.lineWidth = 4 * scaleUnit;
      ctx.beginPath();
      ctx.moveTo(startX, 0);
      ctx.lineTo(startX + len, 0);
      ctx.stroke();

      if (easedProgress > 0.25) {
        const tipX = startX + len;
        const head = 16 * scaleUnit;
        ctx.beginPath();
        ctx.moveTo(tipX, 0);
        ctx.lineTo(tipX - head, -head * 0.65);
        ctx.lineTo(tipX - head, head * 0.65);
        ctx.closePath();
        ctx.fill();
      }
      if (props.title) {
        ctx.font = `600 ${Math.round(18 * scaleUnit)}px "${preset.typography.monoFont}", monospace`;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.fillText(props.title, 0, -24 * scaleUnit);
      }
      break;
    }

    case 'TrackingMarker': {
      const r = 42 * scaleUnit;
      const pulseR = r + Math.sin(localTime * 4) * 5 * scaleUnit;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.5 * scaleUnit;
      ctx.beginPath();
      ctx.arc(0, 0, pulseR, 0, Math.PI * 2 * easedProgress);
      ctx.stroke();

      // Reticle brackets
      const b = 56 * scaleUnit;
      ctx.strokeStyle = primary;
      ctx.lineWidth = 2 * scaleUnit;
      ctx.beginPath();
      ctx.moveTo(-b, -b * 0.4);
      ctx.lineTo(-b, -b);
      ctx.lineTo(-b * 0.4, -b);
      ctx.moveTo(b, b * 0.4);
      ctx.lineTo(b, b);
      ctx.lineTo(b * 0.4, b);
      ctx.stroke();

      ctx.font = `600 ${Math.round(15 * scaleUnit)}px "${preset.typography.monoFont}", monospace`;
      ctx.fillStyle = textColor;
      ctx.textAlign = 'left';
      ctx.fillText(props.title || 'TRACKING LOCK', b + 16 * scaleUnit, -8 * scaleUnit);
      ctx.fillStyle = accent;
      ctx.fillText(
        `X:${Math.round(clip.x)} Y:${Math.round(clip.y)}`,
        b + 16 * scaleUnit,
        14 * scaleUnit
      );
      break;
    }

    case 'CircularDiagram': {
      const radius = Math.min(boxW, boxH) * 0.3;
      const value = clamp(props.value ?? 85, 0, 100);
      const currentVal = value * easedProgress;

      // Track ring
      ctx.strokeStyle = preset.palette.gridLine;
      ctx.lineWidth = 18 * scaleUnit;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Active arc
      ctx.strokeStyle = accent;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * currentVal) / 100);
      ctx.stroke();

      // Inner tick ring
      ctx.strokeStyle = primary;
      ctx.lineWidth = 2 * scaleUnit;
      ctx.beginPath();
      ctx.arc(0, 0, radius - 26 * scaleUnit, 0, Math.PI * 2);
      ctx.stroke();

      // Center metric
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.round(52 * scaleUnit)}px "${preset.typography.monoFont}", monospace`;
      ctx.fillStyle = textColor;
      ctx.fillText(`${Math.round(currentVal)}${props.unit || '%'}`, 0, -6 * scaleUnit);

      ctx.font = `600 ${Math.round(14 * scaleUnit)}px "${preset.typography.monoFont}", monospace`;
      ctx.fillStyle = muted;
      ctx.fillText(props.label || 'EFFICIENCY', 0, 38 * scaleUnit);

      if (props.title) {
        ctx.font = `700 ${Math.round(28 * scaleUnit)}px "${preset.typography.headingFont}", sans-serif`;
        ctx.fillStyle = textColor;
        ctx.fillText(props.title, 0, -radius - 42 * scaleUnit);
      }
      break;
    }

    case 'ExplodedView': {
      const layers = [
        { name: 'Outer Housing', color: primary },
        { name: 'Thermal Barrier', color: accent },
        { name: 'Core Assembly', color: textColor },
        { name: 'Base Interface', color: muted },
      ];
      const spread = 56 * scaleUnit * easedProgress;
      const startY = -((layers.length - 1) * spread) / 2;

      if (props.title) {
        ctx.font = `700 ${Math.round(28 * scaleUnit)}px "${preset.typography.headingFont}", sans-serif`;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.fillText(props.title, 0, -boxH * 0.4);
      }

      layers.forEach((layer, idx) => {
        const y = startY + idx * spread;
        const pw = 180 * scaleUnit;
        const ph = 42 * scaleUnit;
        ctx.beginPath();
        ctx.moveTo(0, y - ph);
        ctx.lineTo(pw, y);
        ctx.lineTo(0, y + ph);
        ctx.lineTo(-pw, y);
        ctx.closePath();
        ctx.fillStyle = surface;
        ctx.fill();
        ctx.strokeStyle = layer.color;
        ctx.lineWidth = 2.5 * scaleUnit;
        ctx.stroke();

        // Callout line to right
        ctx.beginPath();
        ctx.moveTo(pw * 0.85, y);
        ctx.lineTo(pw + 54 * scaleUnit, y);
        ctx.stroke();

        ctx.font = `600 ${Math.round(15 * scaleUnit)}px "${preset.typography.monoFont}", monospace`;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`0${idx + 1} · ${layer.name}`, pw + 66 * scaleUnit, y);
      });
      break;
    }

    case 'DataCounter': {
      const target = props.value ?? 1250;
      const val = Math.round(target * easedProgress);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (props.label) {
        ctx.font = `600 ${Math.round(15 * scaleUnit)}px "${preset.typography.monoFont}", monospace`;
        ctx.fillStyle = accent;
        ctx.fillText(props.label, 0, -76 * scaleUnit);
      }
      ctx.font = `800 ${Math.round(96 * scaleUnit)}px "${preset.typography.monoFont}", monospace`;
      ctx.fillStyle = textColor;
      ctx.fillText(`${props.prefix || ''}${val.toLocaleString()}${props.unit || ''}`, 0, 0);

      if (props.title) {
        ctx.font = `500 ${Math.round(24 * scaleUnit)}px "${preset.typography.bodyFont}", sans-serif`;
        ctx.fillStyle = muted;
        ctx.fillText(props.title, 0, 74 * scaleUnit);
      }
      break;
    }

    case 'ComparisonPanel': {
      const gap = 24 * scaleUnit;
      const colW = (boxW - gap) / 2;
      const colH = boxH * 0.68;
      const topY = -colH / 2 + 24 * scaleUnit;

      if (props.title) {
        ctx.font = `700 ${Math.round(30 * scaleUnit)}px "${preset.typography.headingFont}", sans-serif`;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.fillText(props.title, 0, -colH / 2 - 22 * scaleUnit);
      }

      const drawCol = (x: number, title: string, points: string[], highlight: boolean) => {
        drawRoundedRect(ctx, x, topY, colW, colH, 10 * scaleUnit);
        ctx.fillStyle = surface;
        ctx.fill();
        ctx.strokeStyle = highlight ? accent : preset.palette.gridLine;
        ctx.lineWidth = (highlight ? 2.5 : 1.5) * scaleUnit;
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = `700 ${Math.round(22 * scaleUnit)}px "${preset.typography.headingFont}", sans-serif`;
        ctx.fillStyle = highlight ? accent : textColor;
        ctx.fillText(title, x + 26 * scaleUnit, topY + 26 * scaleUnit);

        ctx.font = `500 ${Math.round(17 * scaleUnit)}px "${preset.typography.bodyFont}", sans-serif`;
        ctx.fillStyle = textColor;
        points.forEach((pt, idx) => {
          const itemProg = clamp((easedProgress - idx * 0.14) / 0.55, 0, 1);
          ctx.save();
          ctx.globalAlpha = state.effectiveOpacity * itemProg;
          ctx.fillText(`—  ${pt}`, x + 26 * scaleUnit, topY + 76 * scaleUnit + idx * 42 * scaleUnit);
          ctx.restore();
        });
      };

      drawCol(-boxW / 2, props.leftTitle || 'Baseline', props.leftPoints || ['Legacy approach', 'Higher friction'], false);
      drawCol(gap / 2, props.rightTitle || 'Improved System', props.rightPoints || ['Modular precision', 'Measurable clarity'], true);
      break;
    }

    case 'AnimatedChart': {
      const items = props.items?.length
        ? props.items
        : [
            { label: 'Option A', value: 65, color: primary },
            { label: 'Option B', value: 88, color: accent },
            { label: 'Option C', value: 74, color: primary },
          ];
      const maxVal = Math.max(100, ...items.map((i) => i.value));
      const chartW = boxW * 0.86;
      const chartH = boxH * 0.54;
      const leftX = -chartW / 2;
      const baseY = chartH / 2 + 20 * scaleUnit;

      if (props.title) {
        ctx.font = `700 ${Math.round(30 * scaleUnit)}px "${preset.typography.headingFont}", sans-serif`;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.fillText(props.title, 0, -chartH / 2 - 42 * scaleUnit);
      }

      // Baseline grid lines
      ctx.strokeStyle = preset.palette.gridLine;
      ctx.lineWidth = 1.2 * scaleUnit;
      for (let g = 0; g <= 4; g++) {
        const gy = baseY - (chartH * g) / 4;
        ctx.beginPath();
        ctx.moveTo(leftX, gy);
        ctx.lineTo(leftX + chartW, gy);
        ctx.stroke();
      }

      const slotW = chartW / items.length;
      const barW = Math.min(86 * scaleUnit, slotW * 0.54);

      items.forEach((item, idx) => {
        const stagger = clamp((easedProgress - idx * 0.08) / 0.72, 0, 1);
        const hBar = (item.value / maxVal) * chartH * stagger;
        const bx = leftX + idx * slotW + (slotW - barW) / 2;
        const by = baseY - hBar;

        drawRoundedRect(ctx, bx, by, barW, Math.max(4, hBar), 6 * scaleUnit);
        ctx.fillStyle = item.color || (idx % 2 === 0 ? primary : accent);
        ctx.fill();

        ctx.textAlign = 'center';
        ctx.font = `700 ${Math.round(18 * scaleUnit)}px "${preset.typography.monoFont}", monospace`;
        ctx.fillStyle = textColor;
        ctx.fillText(`${Math.round(item.value * stagger)}`, bx + barW / 2, by - 14 * scaleUnit);

        ctx.font = `500 ${Math.round(15 * scaleUnit)}px "${preset.typography.bodyFont}", sans-serif`;
        ctx.fillStyle = muted;
        ctx.fillText(item.label, bx + barW / 2, baseY + 24 * scaleUnit);
      });
      break;
    }

    case 'ProgressIndicator': {
      const barW = boxW;
      const barH = Math.max(4, 5 * scaleUnit);
      const prog = clamp(props.progress ?? normalizedTime, 0, 1);
      ctx.fillStyle = preset.palette.gridLine;
      ctx.fillRect(-barW / 2, -barH / 2, barW, barH);
      ctx.fillStyle = accent;
      ctx.fillRect(-barW / 2, -barH / 2, barW * prog, barH);

      if (props.label) {
        ctx.font = `500 ${Math.round(12 * scaleUnit)}px "${preset.typography.monoFont}", monospace`;
        ctx.fillStyle = muted;
        ctx.textAlign = 'right';
        ctx.fillText(props.label, barW / 2, barH + 14 * scaleUnit);
      }
      break;
    }

    case 'InfographicCard': {
      const cardW = Math.min(boxW * 0.75, 680 * scaleUnit);
      const cardH = Math.min(boxH * 0.65, 340 * scaleUnit);
      drawRoundedRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 12 * scaleUnit);
      ctx.fillStyle = surface;
      ctx.fill();
      ctx.strokeStyle = primary;
      ctx.lineWidth = 1.5 * scaleUnit;
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = `600 ${Math.round(14 * scaleUnit)}px "${preset.typography.monoFont}", monospace`;
      ctx.fillStyle = accent;
      ctx.fillText(props.label || 'KEY INSIGHT', -cardW / 2 + 32 * scaleUnit, -cardH / 2 + 28 * scaleUnit);

      ctx.font = `700 ${Math.round(32 * scaleUnit)}px "${preset.typography.headingFont}", sans-serif`;
      ctx.fillStyle = textColor;
      ctx.fillText(props.title || clip.name, -cardW / 2 + 32 * scaleUnit, -cardH / 2 + 56 * scaleUnit);

      ctx.font = `400 ${Math.round(19 * scaleUnit)}px "${preset.typography.bodyFont}", sans-serif`;
      ctx.fillStyle = muted;
      const lines = wrapTextLines(ctx, props.body || '', cardW - 64 * scaleUnit).slice(0, 4);
      lines.forEach((line, idx) => {
        ctx.fillText(line, -cardW / 2 + 32 * scaleUnit, -cardH / 2 + 114 * scaleUnit + idx * 30 * scaleUnit);
      });
      break;
    }

    case 'TimelineGraphic': {
      const milestones = props.milestones?.length
        ? props.milestones
        : [
            { year: '01', title: 'Concept', detail: 'Define scope' },
            { year: '02', title: 'Production', detail: 'Assemble scenes' },
            { year: '03', title: 'Delivery', detail: 'Render output' },
          ];
      const lineW = boxW * 0.82;
      const leftX = -lineW / 2;

      if (props.title) {
        ctx.font = `700 ${Math.round(30 * scaleUnit)}px "${preset.typography.headingFont}", sans-serif`;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.fillText(props.title, 0, -110 * scaleUnit);
      }

      ctx.strokeStyle = primary;
      ctx.lineWidth = 3 * scaleUnit;
      ctx.beginPath();
      ctx.moveTo(leftX, 0);
      ctx.lineTo(leftX + lineW * easedProgress, 0);
      ctx.stroke();

      milestones.forEach((m, idx) => {
        const frac = milestones.length === 1 ? 0.5 : idx / (milestones.length - 1);
        const mx = leftX + lineW * frac;
        const visible = easedProgress >= frac * 0.85;
        ctx.save();
        ctx.globalAlpha = visible ? state.effectiveOpacity : 0.15;

        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(mx, 0, 9 * scaleUnit, 0, Math.PI * 2);
        ctx.fill();

        ctx.textAlign = 'center';
        ctx.font = `700 ${Math.round(16 * scaleUnit)}px "${preset.typography.monoFont}", monospace`;
        ctx.fillStyle = accent;
        ctx.fillText(m.year, mx, -28 * scaleUnit);

        ctx.font = `700 ${Math.round(20 * scaleUnit)}px "${preset.typography.headingFont}", sans-serif`;
        ctx.fillStyle = textColor;
        ctx.fillText(m.title, mx, 34 * scaleUnit);

        ctx.font = `400 ${Math.round(14 * scaleUnit)}px "${preset.typography.bodyFont}", sans-serif`;
        ctx.fillStyle = muted;
        ctx.fillText(m.detail, mx, 60 * scaleUnit);
        ctx.restore();
      });
      break;
    }

    case 'ImageReveal': {
      const assetId = clip.assetId || props.assetId;
      const img = assetId ? mediaCache?.images.get(assetId) : undefined;
      drawRoundedRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, 10 * scaleUnit);
      ctx.save();
      ctx.clip();
      if (img && img.complete && img.naturalWidth > 0) {
        const imgAspect = img.naturalWidth / img.naturalHeight;
        const boxAspect = boxW / boxH;
        let dw = boxW;
        let dh = boxH;
        if (imgAspect > boxAspect) {
          dw = boxH * imgAspect;
        } else {
          dh = boxW / imgAspect;
        }
        const zoom = 1 + normalizedTime * 0.06;
        ctx.drawImage(img, (-dw * zoom) / 2, (-dh * zoom) / 2, dw * zoom, dh * zoom);
      } else {
        ctx.fillStyle = surface;
        ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);
        ctx.textAlign = 'center';
        ctx.font = `600 ${Math.round(20 * scaleUnit)}px "${preset.typography.headingFont}", sans-serif`;
        ctx.fillStyle = muted;
        ctx.fillText(props.title || 'Attach an image asset in Inspector', 0, 0);
      }
      ctx.restore();
      ctx.strokeStyle = preset.palette.gridLine;
      ctx.lineWidth = 1.5 * scaleUnit;
      drawRoundedRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, 10 * scaleUnit);
      ctx.stroke();
      break;
    }

    case 'VideoFrame': {
      const assetId = clip.assetId || props.assetId;
      const vid = assetId ? mediaCache?.videos.get(assetId) : undefined;
      drawRoundedRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, 10 * scaleUnit);
      ctx.save();
      ctx.clip();
      if (vid && vid.readyState >= 2) {
        const targetT = localTime % Math.max(0.5, vid.duration || 10);
        if (Math.abs(vid.currentTime - targetT) > 0.25) {
          vid.currentTime = targetT;
        }
        ctx.drawImage(vid, -boxW / 2, -boxH / 2, boxW, boxH);
      } else {
        ctx.fillStyle = surface;
        ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);
        ctx.textAlign = 'center';
        ctx.font = `600 ${Math.round(20 * scaleUnit)}px "${preset.typography.headingFont}", sans-serif`;
        ctx.fillStyle = muted;
        ctx.fillText(props.title || 'Attach a video asset in Inspector', 0, 0);
      }
      ctx.restore();
      ctx.strokeStyle = primary;
      ctx.lineWidth = 1.5 * scaleUnit;
      drawRoundedRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, 10 * scaleUnit);
      ctx.stroke();
      break;
    }

    case 'SectionDivider': {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3 * scaleUnit;
      const half = (boxW * 0.42) * easedProgress;
      ctx.beginPath();
      ctx.moveTo(-half, -22 * scaleUnit);
      ctx.lineTo(half, -22 * scaleUnit);
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.font = `700 ${Math.round(44 * scaleUnit)}px "${preset.typography.headingFont}", sans-serif`;
      ctx.fillStyle = textColor;
      ctx.fillText(props.title || 'CHAPTER', 0, 26 * scaleUnit);
      break;
    }

    case 'AnimatedDiagram': {
      const nodes = [
        { x: -boxW * 0.28, y: 0, label: 'INPUT' },
        { x: 0, y: -boxH * 0.16, label: 'PROCESS' },
        { x: 0, y: boxH * 0.18, label: 'CONTROL' },
        { x: boxW * 0.28, y: 0, label: 'OUTPUT' },
      ];
      if (props.title) {
        ctx.font = `700 ${Math.round(28 * scaleUnit)}px "${preset.typography.headingFont}", sans-serif`;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.fillText(props.title, 0, -boxH * 0.38);
      }
      const edges = [
        [0, 1],
        [0, 2],
        [1, 3],
        [2, 3],
        [1, 2],
      ];
      ctx.strokeStyle = primary;
      ctx.lineWidth = 2.5 * scaleUnit;
      edges.forEach(([a, b]) => {
        const na = nodes[a];
        const nb = nodes[b];
        ctx.beginPath();
        ctx.moveTo(na.x, na.y);
        ctx.lineTo(na.x + (nb.x - na.x) * easedProgress, na.y + (nb.y - na.y) * easedProgress);
        ctx.stroke();
      });

      const nodeW = 140 * scaleUnit;
      const nodeH = 54 * scaleUnit;
      nodes.forEach((n, idx) => {
        drawRoundedRect(ctx, n.x - nodeW / 2, n.y - nodeH / 2, nodeW, nodeH, 8 * scaleUnit);
        ctx.fillStyle = surface;
        ctx.fill();
        ctx.strokeStyle = idx === 3 ? accent : primary;
        ctx.lineWidth = 2 * scaleUnit;
        ctx.stroke();

        ctx.font = `600 ${Math.round(14 * scaleUnit)}px "${preset.typography.monoFont}", monospace`;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(n.label, n.x, n.y);
      });
      break;
    }

    case '3DModelViewer': {
      const cfg = props.scene3D || project.scene3D;
      const glbBlob = cfg.modelAssetId ? mediaCache?.blobs.get(cfg.modelAssetId) : undefined;
      const snap = render3DSnapshot(cfg, localTime, boxW, boxH, glbBlob);
      if (snap) {
        ctx.drawImage(snap, -boxW / 2, -boxH / 2, boxW, boxH);
      }
      if (props.title) {
        ctx.textAlign = 'left';
        ctx.font = `600 ${Math.round(13 * scaleUnit)}px "${preset.typography.monoFont}", monospace`;
        ctx.fillStyle = accent;
        ctx.fillText('3D VISUALISATION', -boxW / 2 + 16 * scaleUnit, -boxH / 2 + 20 * scaleUnit);
        ctx.font = `700 ${Math.round(24 * scaleUnit)}px "${preset.typography.headingFont}", sans-serif`;
        ctx.fillStyle = textColor;
        ctx.fillText(props.title, -boxW / 2 + 16 * scaleUnit, -boxH / 2 + 44 * scaleUnit);
      }
      break;
    }

    case 'EndCard': {
      const panelW = Math.min(boxW * 0.78, 720 * scaleUnit);
      const panelH = Math.min(boxH * 0.56, 300 * scaleUnit);
      drawRoundedRect(ctx, -panelW / 2, -panelH / 2, panelW, panelH, 12 * scaleUnit);
      ctx.fillStyle = surface;
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2 * scaleUnit;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `600 ${Math.round(14 * scaleUnit)}px "${preset.typography.monoFont}", monospace`;
      ctx.fillStyle = accent;
      ctx.fillText('SUMMARY', 0, -68 * scaleUnit);

      ctx.font = `700 ${Math.round(38 * scaleUnit)}px "${preset.typography.headingFont}", sans-serif`;
      ctx.fillStyle = textColor;
      const lines = wrapTextLines(ctx, props.title || project.title, panelW - 60 * scaleUnit).slice(0, 2);
      lines.forEach((l, i) => ctx.fillText(l, 0, -16 * scaleUnit + i * 44 * scaleUnit));

      if (props.ctaText) {
        ctx.font = `500 ${Math.round(18 * scaleUnit)}px "${preset.typography.bodyFont}", sans-serif`;
        ctx.fillStyle = muted;
        ctx.fillText(props.ctaText, 0, 74 * scaleUnit);
      }
      break;
    }

    default:
      break;
  }

  ctx.restore();
}

function drawSubtitles(
  ctx: CanvasRenderingContext2D,
  project: Project,
  timeSec: number,
  w: number,
  h: number
) {
  if (!project.subtitleStyle.enabled) return;
  const cue = getActiveSubtitleCue(project.subtitles, timeSec);
  if (!cue) return;

  const scaleUnit = Math.min(w, h) / 720;
  const fontSize = Math.round((project.subtitleStyle.fontSize || 30) * scaleUnit);
  ctx.save();
  ctx.font = `600 ${fontSize}px "${project.subtitleStyle.fontFamily || 'DM Sans'}", sans-serif`;
  const maxWidth = w * 0.82;
  const lines = wrapTextLines(ctx, cue.text, maxWidth);
  const lh = fontSize * 1.32;
  const padX = 22 * scaleUnit;
  const padY = 12 * scaleUnit;
  const maxLineW = Math.max(...lines.map((l) => ctx.measureText(l).width), 100);
  const boxW = maxLineW + padX * 2;
  const boxH = lines.length * lh + padY * 2;

  const posY =
    project.subtitleStyle.position === 'top'
      ? h * 0.12
      : project.subtitleStyle.position === 'center'
      ? h * 0.5 - boxH / 2
      : h - boxH - h * 0.105;

  drawRoundedRect(ctx, (w - boxW) / 2, posY, boxW, boxH, 8 * scaleUnit);
  ctx.fillStyle = project.subtitleStyle.backgroundColor || 'rgba(10, 14, 22, 0.8)';
  ctx.fill();

  const highlights = new Set((cue.highlightedWords || []).map((hw) => hw.toLowerCase()));
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  lines.forEach((line, idx) => {
    const words = line.split(' ');
    const lineW = ctx.measureText(line).width;
    let cursorX = (w - lineW) / 2;
    const y = posY + padY + idx * lh;
    words.forEach((word, wi) => {
      const clean = word.replace(/[^\w-]/g, '').toLowerCase();
      ctx.fillStyle = highlights.has(clean)
        ? project.subtitleStyle.highlightColor
        : project.subtitleStyle.textColor;
      const token = wi < words.length - 1 ? `${word} ` : word;
      ctx.fillText(token, cursorX, y);
      cursorX += ctx.measureText(token).width;
    });
  });

  ctx.restore();
}

export function renderCompositionFrame(
  ctx: CanvasRenderingContext2D,
  project: Project,
  timeSec: number,
  width: number,
  height: number,
  customPresets: CreativePreset[] = [],
  mediaCache?: LoadedMediaCache,
  includeSubtitles = true
) {
  const activeSceneWin = getActiveSceneWindow(project.storyboard, timeSec);
  const scenePresetId = activeSceneWin?.scene.visualStyle || project.settings.primaryPresetId;
  const preset = getPresetById(scenePresetId, customPresets);

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  drawPresetBackdrop(ctx, width, height, preset, timeSec);

  // Scene entrance transition overlay effect
  if (activeSceneWin && activeSceneWin.index > 0) {
    const transDur = 0.45;
    const elapsed = timeSec - activeSceneWin.startTime;
    if (elapsed >= 0 && elapsed < transDur) {
      const t = clamp(elapsed / transDur, 0, 1);
      const trans = activeSceneWin.scene.transition;
      if (trans === 'technical-wipe') {
        ctx.beginPath();
        ctx.rect(0, 0, width * t, height);
        ctx.clip();
      } else if (trans === 'split-reveal') {
        const half = (width / 2) * t;
        ctx.beginPath();
        ctx.rect(width / 2 - half, 0, half * 2, height);
        ctx.clip();
      } else if (trans === 'slide-left') {
        ctx.translate((1 - t) * width * 0.14, 0);
      } else if (trans === 'zoom-through') {
        const s = 0.94 + 0.06 * t;
        ctx.translate(width / 2, height / 2);
        ctx.scale(s, s);
        ctx.translate(-width / 2, -height / 2);
      } else if (trans === 'crossfade') {
        ctx.globalAlpha = t;
      }
    }
  }

  const activeClips = getActiveVisualClips(project.clips, timeSec);
  for (const state of activeClips) {
    renderMotionComponent(ctx, state, width, height, preset, project, mediaCache);
  }

  ctx.restore();

  if (includeSubtitles) {
    drawSubtitles(ctx, project, timeSec, width, height);
  }
}
