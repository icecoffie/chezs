/*!
 * Chess
 * Copyright (c) Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a19e25-e438-75a3-a372-c9c67de14514
 */
// Intended use: fine artwork drawn once with the 2D canvas and engraved into a board: the Observatory's star chart and the Jade Temple's fretwork. Red and green hold lines and stars; blue holds marks on the frame.
import * as THREE from "three/webgpu";
import { config } from "../config.js";
import { seeded } from "../lib/utils.js";
const SIZE = 2048;
const penFor = span => {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext("2d");
  context.fillStyle = "#000";
  context.fillRect(0, 0, SIZE, SIZE);
  context.globalCompositeOperation = "lighter";
  const unit = SIZE / span;
  return {
    context,
    unit,
    center: SIZE / 2,
    reach: 4 * config.board.square * unit
  };
};
const textureFrom = ({
  context
}) => {
  const texture = new THREE.CanvasTexture(context.canvas);
  texture.anisotropy = 8;
  return texture;
};
// -----------------------------------------------------------------------------
// The star chart: a polar projection across the squares, with a degree scale on the frame
// -----------------------------------------------------------------------------
const constellations = [
// The Plough
{
  stars: [[-0.62, -0.5], [-0.5, -0.46], [-0.4, -0.42], [-0.28, -0.42], [-0.22, -0.28], [-0.08, -0.32], [-0.1, -0.46]],
  lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]]
},
// Cassiopeia
{
  stars: [[0.22, -0.62], [0.32, -0.5], [0.42, -0.58], [0.54, -0.46], [0.66, -0.56]],
  lines: [[0, 1], [1, 2], [2, 3], [3, 4]]
},
// Orion
{
  stars: [[-0.6, 0.28], [-0.4, 0.3], [-0.52, 0.46], [-0.48, 0.48], [-0.44, 0.5], [-0.62, 0.68], [-0.36, 0.7]],
  lines: [[0, 1], [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [5, 6]]
},
// The Swan
{
  stars: [[0.42, 0.12], [0.44, 0.26], [0.46, 0.4], [0.48, 0.56], [0.28, 0.2], [0.62, 0.34]],
  lines: [[0, 1], [1, 2], [2, 3], [4, 1], [1, 5]]
},
// The Lion
{
  stars: [[-0.14, 0.16], [-0.05, 0.08], [0.06, 0.1], [0.1, 0.2], [0.02, 0.28], [-0.08, 0.32], [0.2, 0.34]],
  lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [3, 6]]
},
// The Scorpion
{
  stars: [[0.02, 0.5], [0.08, 0.56], [0.1, 0.64], [0.06, 0.72], [-0.04, 0.78], [-0.14, 0.74], [-0.18, 0.66], [-0.1, 0.62]],
  lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]]
}];
export const starChart = span => {
  const pen = penFor(span);
  const {
    context,
    center,
    reach,
    unit
  } = pen;
  const line = width => {
    context.strokeStyle = "#f00";
    context.lineWidth = width;
  };
  // Declination circles.
  [0.2, 0.4, 0.6, 0.8, 1, 1.2].forEach(ring => {
    line(ring === 0.6 || ring === 1.2 ? 2.4 : 1.3);
    context.beginPath();
    context.arc(center, center, reach * ring, 0, Math.PI * 2);
    context.stroke();
  });
  // Hour lines from the pole.
  Array.from({
    length: 24
  }).forEach((_, hour) => {
    const angle = hour / 24 * Math.PI * 2;
    const from = hour % 6 === 0 ? 0 : 0.2;
    line(hour % 6 === 0 ? 2.2 : 1.1);
    context.beginPath();
    context.moveTo(center + Math.cos(angle) * reach * from, center + Math.sin(angle) * reach * from);
    context.lineTo(center + Math.cos(angle) * reach * 1.42, center + Math.sin(angle) * reach * 1.42);
    context.stroke();
  });
  // Fine ticks along the circle of the ecliptic.
  Array.from({
    length: 360
  }).forEach((_, degree) => {
    const angle = degree / 360 * Math.PI * 2;
    const inner = reach * (degree % 10 === 0 ? 0.57 : 0.585);
    line(1);
    context.beginPath();
    context.moveTo(center + Math.cos(angle) * inner, center + Math.sin(angle) * inner);
    context.lineTo(center + Math.cos(angle) * reach * 0.6, center + Math.sin(angle) * reach * 0.6);
    context.stroke();
  });
  // Constellations: figures in fine line, stars on the green channel.
  constellations.forEach(({
    stars,
    lines
  }) => {
    line(1.8);
    lines.forEach(([from, to]) => {
      context.beginPath();
      context.moveTo(center + stars[from][0] * reach, center + stars[from][1] * reach);
      context.lineTo(center + stars[to][0] * reach, center + stars[to][1] * reach);
      context.stroke();
    });
    context.fillStyle = "#0f0";
    stars.forEach(([x, y], index) => {
      context.beginPath();
      context.arc(center + x * reach, center + y * reach, 4.5 + seeded(index) * 3.5, 0, Math.PI * 2);
      context.fill();
    });
  });
  // A scatter of faint background stars.
  context.fillStyle = "#0a0";
  Array.from({
    length: 900
  }).forEach((_, index) => {
    const x = (seeded(index * 3 + 1) - 0.5) * 2 * reach;
    const y = (seeded(index * 5 + 2) - 0.5) * 2 * reach;
    context.beginPath();
    context.arc(center + x, center + y, 0.8 + seeded(index * 7 + 3) * 1.5, 0, Math.PI * 2);
    context.fill();
  });
  // The frame: a degree scale cut into the brass all the way round.
  const frameIn = reach + config.board.frame * unit * 0.56;
  const frameOut = reach + config.board.frame * unit * 0.86;
  context.strokeStyle = "#00f";
  [frameIn, frameOut].forEach(edge => {
    context.lineWidth = 2;
    context.strokeRect(center - edge, center - edge, edge * 2, edge * 2);
  });
  const marks = 16 * 5;
  Array.from({
    length: marks
  }).forEach((_, index) => {
    const along = (index + 0.5) / marks;
    const major = index % 5 === 2;
    const length = (frameOut - frameIn) * (major ? 1 : 0.42);
    context.lineWidth = major ? 2.6 : 1.4;
    const place = (x0, y0, dx, dy) => {
      context.beginPath();
      context.moveTo(center + x0, center + y0);
      context.lineTo(center + x0 + dx * length, center + y0 + dy * length);
      context.stroke();
    };
    const offset = (along - 0.5) * 2 * frameIn;
    place(offset, -frameIn, 0, -1);
    place(offset, frameIn, 0, 1);
    place(-frameIn, offset, -1, 0);
    place(frameIn, offset, 1, 0);
  });
  return textureFrom(pen);
};
// -----------------------------------------------------------------------------
// The fretwork: a square-spiral key running round the frame, laid in gold
// -----------------------------------------------------------------------------
export const fretwork = span => {
  const pen = penFor(span);
  const {
    context,
    center,
    reach,
    unit
  } = pen;
  const inner = reach + config.board.frame * unit * 0.5;
  const outer = reach + config.board.frame * unit * 0.92;
  const band = outer - inner;
  context.strokeStyle = "#f00";
  context.lineJoin = "miter";
  const repeats = 28;
  const pitch = inner * 2 / repeats;
  const key = [[0, 1], [0, 0], [1, 0], [1, 0.75], [0.3, 0.75], [0.3, 0.3], [0.68, 0.3], [0.68, 0.52]];
  context.lineWidth = band * 0.07;
  // One unit of the key, drawn on each of the four sides by turning the canvas.
  [0, 1, 2, 3].forEach(turn => {
    context.save();
    context.translate(center, center);
    context.rotate(turn * Math.PI / 2);
    Array.from({
      length: repeats
    }).forEach((_, index) => {
      const left = -inner + index * pitch;
      context.beginPath();
      key.forEach(([x, y], point) => {
        const px = left + x * pitch * 0.86;
        const py = -outer + band * 0.1 + y * band * 0.8;
        if (point === 0) context.moveTo(px, py);else context.lineTo(px, py);
      });
      context.stroke();
    });
    context.restore();
    context.lineWidth = band * 0.05;
    context.strokeRect(center - inner, center - inner, inner * 2, inner * 2);
    context.strokeRect(center - outer, center - outer, outer * 2, outer * 2);
    context.lineWidth = band * 0.07;
  });
  return textureFrom(pen);
};