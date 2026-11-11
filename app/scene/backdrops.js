/*!
 * Chess
 * Copyright (c) Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a19e25-e438-75a3-a372-c9c67de14514
 */
// Intended use: what lies out of focus beyond the table in styles whose concept no scanned room shows: arcade cabinets, a furnace, temple candles, the observatory dome. Drawn once into the panorama, so its cost is paid behind the veil.
import { abs, atan, color, float, floor, fract, hash, mix, mx_worley_noise_float, pow, smoothstep, step, vec2, vec3 } from "three/tsl";
const tint = hex => color(hex);
const longitude = seen => atan(seen.x, seen.z);
const box = (distance, size, soft) => float(1).sub(smoothstep(size - soft, size + soft, distance));
// The room's lamps, up above anything the camera frames: what polished surfaces catch and shape themselves by.
const lamps = (seen, hex, power) => {
  const around = longitude(seen);
  const overhead = smoothstep(0.5, 0.82, seen.y);
  const strips = smoothstep(0.36, 0.5, seen.y).mul(smoothstep(0.8, 0.62, seen.y)).mul(smoothstep(0.16, 0.06, abs(fract(around.mul(3 / 6.2832)).sub(0.5))));
  return tint(hex).mul(overhead.add(strips.mul(0.5)).mul(power));
};
// Rows of cabinets in a dark room, their screens burning through the blur.
const arcade = {
  keep: 0.015,
  paint: seen => {
    const around = longitude(seen).mul(7.5);
    const cabinet = floor(around);
    const across = abs(fract(around).sub(0.5));
    const shade = hash(cabinet.add(3));
    const hue = mix(mix(tint("#22d8ff"), tint("#ff2fb4"), step(0.4, shade)), tint("#ffc23d"), step(0.8, shade));
    const screen = box(across, 0.2, 0.09).mul(box(abs(seen.y.sub(0.13)), 0.055, 0.04));
    const marquee = box(across, 0.26, 0.07).mul(box(abs(seen.y.sub(0.27)), 0.018, 0.022));
    const spill = box(across, 0.3, 0.2).mul(smoothstep(0.34, 0, abs(seen.y.sub(0.06)))).mul(0.05);
    return hue.mul(screen.mul(0.95).add(marquee.mul(1.5)).add(spill)).add(lamps(seen, "#c9d4ff", 0.26));
  }
};
// Sunlit plaster and shaded arches, cypress against a clear sky, the sun high behind the viewer.
const courtyard = {
  keep: 0.05,
  paint: seen => {
    const around = longitude(seen);
    const sky = mix(tint("#c3d8ea"), tint("#5f93c6"), smoothstep(0.1, 0.7, seen.y));
    const arch = fract(around.mul(6 / 6.2832));
    const opening = box(abs(arch.sub(0.5)), 0.28, 0.06).mul(box(seen.y.sub(0.02).max(0), 0.2, 0.05));
    const plaster = mix(tint("#d9b48a"), tint("#3c2a1e"), opening);
    const wall = smoothstep(0.44, 0.38, seen.y);
    const trees = box(abs(fract(around.mul(11 / 6.2832)).sub(0.5)), 0.1, 0.06).mul(step(0.6, hash(floor(around.mul(11 / 6.2832)).add(2)))).mul(smoothstep(0.66, 0.5, seen.y)).mul(0.85);
    const ground = mix(sky, plaster, wall);
    return mix(ground, tint("#26331f"), trees).add(lamps(seen, "#fff0d4", 0.4));
  }
};
// Dark columns, warm walls and banks of candles gone soft in the distance.
const jade = {
  keep: 0.015,
  paint: seen => {
    const around = longitude(seen).mul(5);
    const column = smoothstep(0.1, 0.3, abs(fract(around).sub(0.5)));
    const wall = mix(tint("#120806"), tint("#3a1a0c"), column);
    // Two banks at different depths, each flame displaced and sized by chance.
    const bank = (scale, shift, reach) => {
      const grid = vec2(longitude(seen).mul(scale).add(shift), seen.y.mul(scale));
      const cell = floor(grid);
      const seed = hash(cell.x.add(cell.y.mul(37)).add(shift));
      const drift = vec2(hash(seed.add(1)), hash(seed.add(2))).sub(0.5).mul(0.6);
      const size = seed.mul(0.18).add(0.1);
      return float(1).sub(smoothstep(size.mul(0.6), size, fract(grid).sub(0.5).add(drift).length())).mul(step(0.55, hash(seed.add(3)))).mul(hash(seed.add(4)).mul(0.7).add(0.3)).mul(smoothstep(reach, 0.02, abs(seen.y.sub(0.05))));
    };
    return wall.add(tint("#ffae55").mul(bank(13, 0.3, 0.3).mul(2.6).add(bank(27, 4.1, 0.18).mul(1.6)))).add(lamps(seen, "#ffe0b0", 0.45));
  }
};
// The inside of the dome: ribs, a night full of stars, and the slit open to the sky.
const observatory = {
  keep: 0.04,
  paint: seen => {
    const around = longitude(seen);
    const height = seen.y.max(0);
    const ribs = smoothstep(0.02, 0.05, abs(fract(around.mul(16 / 6.2832)).sub(0.5)));
    const rings = smoothstep(0.01, 0.03, abs(fract(height.mul(5)).sub(0.5)));
    const shell = mix(tint("#0a0d24"), tint("#1a2048"), height);
    const brass = tint("#a0782e").mul(float(1).sub(ribs.mul(rings)).mul(smoothstep(0, 0.2, height)).mul(0.5));
    const stars = pow(float(1).sub(mx_worley_noise_float(seen.mul(38))).max(0), float(22)).mul(6);
    const slit = smoothstep(0.2, 0.14, abs(around.sub(0.4))).mul(smoothstep(0.1, 0.25, height));
    const sky = tint("#0b1440").add(tint("#fff4d8").mul(stars));
    return mix(shell.add(brass), sky, slit).add(tint("#d8c8a8").mul(stars.mul(0.25))).add(lamps(seen, "#ffe8c4", 0.3));
  }
};
const painters = {
  arcade,
  courtyard,
  jade,
  observatory
};
export const backdropPainter = recipe => painters[recipe];