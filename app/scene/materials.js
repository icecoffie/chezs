/*!
 * Chess
 * Copyright (c) Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a19e25-e438-75a3-a372-c9c67de14514
 */
// Intended use: how finishes reach the screen: real stone sampling, baking a style's recipes into the scanned set's textures, and the marker, spark, pool and light materials.
import * as THREE from "three/webgpu";
import { abs, color, dot, float, floor, fract, hash, mix, mx_fractal_noise_float, mx_noise_float, cameraPosition, normalLocal, normalView, normalWorld, positionWorld, refract, positionLocal, positionViewDirection, pow, smoothstep, step, uniform, texture, uv, vec2, vec3, vec4 } from "three/tsl";
import { config } from "../config.js";
import { fretwork, starChart } from "./engravings.js";
import { recipes } from "./recipes.js";
// -----------------------------------------------------------------------------
// Shared helpers
// -----------------------------------------------------------------------------
const tint = hex => color(hex);
const asCoord = node => node;
const fresnel = power => pow(float(1).sub(abs(normalView.dot(positionViewDirection))), float(power));
// -----------------------------------------------------------------------------
// Real stone: a clean patch of the scanned marble, folded so it never shows a seam,
// read as brightness so each style can recolor it
// -----------------------------------------------------------------------------
const stoneAt = (map, coordinate) => {
  const {
    min,
    size,
    low,
    high
  } = config.assets.stone;
  const folded = abs(fract(coordinate.mul(0.5)).mul(2).sub(1));
  const sample = texture(map, folded.mul(size).add(vec2(min[0], min[1])));
  return smoothstep(low, high, dot(sample.rgb, vec3(0.2126, 0.7152, 0.0722)));
};
// Projected from three sides and blended, because a piece has no flat side to lay it on.
const stoneAround = (map, at) => scale => {
  const facing = abs(normalLocal);
  const weights = facing.div(facing.x.add(facing.y).add(facing.z));
  return stoneAt(map, vec2(at.y, at.z).mul(scale)).mul(weights.x).add(stoneAt(map, vec2(at.x, at.z).mul(scale)).mul(weights.y)).add(stoneAt(map, vec2(at.x, at.y).mul(scale)).mul(weights.z));
};
const woodAcross = (map, at) => scale => {
  const {
    low,
    high
  } = config.assets.wood;
  const sample = texture(map, vec2(at.x, at.z).mul(scale));
  return smoothstep(low, high, dot(sample.rgb, vec3(0.2126, 0.7152, 0.0722)));
};
const stoneAcross = (map, at) => scale => stoneAt(map, vec2(at.x, at.z).mul(scale));
// A square cut from one place in the slab, so it can't show the fold's mirrored ink-blot.
const stoneOfSquare = (map, cell, within) => scale => {
  const span = Math.min(squareSize * scale, 1);
  const place = cell;
  const offset = vec2(hash(place.x.add(place.y.mul(8)).add(11)), hash(place.x.add(place.y.mul(8)).add(23))).mul(1 - span);
  return stoneAt(map, offset.add(within.mul(span)));
};
const asNode = value => typeof value === "number" || value === undefined ? float(value ?? 0) : value;
const squareSize = config.board.square;
const squaresFinish = (recipe, point, stone, mask) => {
  const wander = (recipe.wobble ?? 0) * squareSize;
  const drifted = wander ? point.add(vec3(mx_noise_float(point.mul(5)).mul(wander), 0, mx_noise_float(point.mul(5).add(9)).mul(wander))) : point;
  const fileRank = vec2(drifted.x.div(squareSize).add(4), float(4).sub(drifted.z.div(squareSize)));
  const cell = floor(fileRank);
  const within = fract(fileRank);
  const edge = within.x.min(float(1).sub(within.x)).min(within.y.min(float(1).sub(within.y)));
  const isLight = fract(cell.x.add(cell.y).mul(0.5)).mul(2);
  // Each square gets its own patch of the pattern, like inlay cut from different stock.
  const offset = vec3(cell.x.mul(3.17), cell.y.mul(1.73), cell.x.add(cell.y).mul(2.31));
  const at = asCoord(point.add(offset));
  const surface = {
    at,
    crevice: float(0),
    stone: stoneOfSquare(stone, cell, within),
    edge,
    cell: cell,
    mask
  };
  const light = recipe.square(surface, "light");
  const dark = recipe.square(surface, "dark");
  const pickValue = (a, b) => mix(asNode(b), asNode(a), isLight);
  return {
    color: mix(dark.color, light.color, isLight),
    roughness: pickValue(light.roughness, dark.roughness),
    metalness: pickValue(light.metalness, dark.metalness),
    emissive: mix(dark.emissive ?? vec3(0), light.emissive ?? vec3(0), isLight),
    clearcoat: Math.max(light.clearcoat ?? 0, dark.clearcoat ?? 0)
  };
};
// -----------------------------------------------------------------------------
// Baking: a surface that never changes is drawn into textures once, so the noise
// behind it costs nothing per frame
// -----------------------------------------------------------------------------
export const bakeInto = (renderer, node, resolution, wrap = THREE.ClampToEdgeWrapping) => {
  const target = new THREE.RenderTarget(resolution, resolution, {
    wrapS: wrap,
    wrapT: wrap,
    type: THREE.HalfFloatType,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter
  });
  // Blending off and "transparent" on, or the alpha holding roughness gets forced to 1.
  const material = new THREE.MeshBasicNodeMaterial({
    toneMapped: false,
    transparent: true,
    blending: THREE.NoBlending
  });
  material.colorNode = node;
  renderer.setRenderTarget(target);
  new THREE.QuadMesh(material).render(renderer);
  renderer.setRenderTarget(null);
  material.dispose();
  return target;
};
// Textures and buffers belong to the material that shows them, and leave with it.
export const ownedBy = (material, resources) => {
  material.userData.owned = resources;
  return material;
};
export const releaseMaterial = material => {
  (material.userData.owned ?? []).forEach(resource => resource.dispose());
  material.dispose();
};
const paintTarget = resolution => new THREE.RenderTarget(resolution, resolution, {
  type: THREE.HalfFloatType,
  generateMipmaps: true,
  minFilter: THREE.LinearMipmapLinearFilter,
  magFilter: THREE.LinearFilter
});
const paintLayer = (renderer, geometries, node, resolution, fill) => {
  const target = paintTarget(resolution);
  // Unwrapped: each triangle is drawn where its UVs say, so the layout matches the scan.
  const nudge = uniform(new THREE.Vector2());
  const material = new THREE.MeshBasicNodeMaterial({
    toneMapped: false,
    transparent: true,
    blending: THREE.NoBlending,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false
  });
  // Render targets are sampled with V flipped on WebGL, so V is flipped here to meet it.
  material.vertexNode = vec4(uv().x.mul(2).sub(1).add(nudge.x), float(1).sub(uv().y).mul(2).sub(1).add(nudge.y), 0, 1);
  material.colorNode = node;
  const scene = new THREE.Scene();
  geometries.forEach(geometry => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
  });
  const camera = new THREE.PerspectiveCamera();
  const previous = renderer.getClearColor(new THREE.Color());
  const previousAlpha = renderer.getClearAlpha();
  const previousClear = renderer.autoClear;
  // The space between UV islands takes the material's color, so mipmaps can't bleed in a seam.
  renderer.setClearColor(fill, 0.5);
  renderer.setRenderTarget(target);
  renderer.clear();
  renderer.autoClear = false;
  // Painting a little past each island's edge, then the island itself on top.
  const reach = config.paint.bleedPixels * 2 / resolution;
  [[-1, -1], [1, -1], [-1, 1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1], [0, 0]].forEach(([x, y]) => {
    nudge.value.set(x * reach, y * reach);
    renderer.render(scene, camera);
  });
  renderer.autoClear = previousClear;
  renderer.setRenderTarget(null);
  renderer.setClearColor(previous, previousAlpha);
  material.dispose();
  return target;
};
const paint = (renderer, geometries, finishAt, carving, resolution, fillHex) => {
  const carved = texture(carving.surface, uv());
  const finish = finishAt(float(1).sub(smoothstep(config.paint.grooveLow, config.paint.grooveHigh, carved.r)));
  const shaded = asNode(finish.roughness).add(carved.g.sub(0.5).mul(config.paint.carvedRoughness));
  const crevices = mix(float(1), carved.r, config.paint.crevices);
  const base = paintLayer(renderer, geometries, vec4(finish.color.mul(crevices), shaded), resolution, new THREE.Color(fillHex));
  const hasExtra = finish.emissive !== undefined || finish.metalness !== undefined && finish.metalness !== 0;
  const extra = hasExtra ? paintLayer(renderer, geometries, vec4(finish.emissive ?? vec3(0), asNode(finish.metalness)), resolution, new THREE.Color(0x000000)) : null;
  base.texture.anisotropy = config.scan.anisotropy;
  if (extra) extra.texture.anisotropy = config.scan.anisotropy;
  return {
    base: base.texture,
    extra: extra?.texture ?? null,
    clearcoat: finish.clearcoat ?? 0,
    dispose: () => {
      base.dispose();
      extra?.dispose();
    }
  };
};
const rims = {
  ice: {
    light: {
      hex: "#bfe8ff",
      strength: 0.08
    },
    dark: {
      hex: "#3fa8e0",
      strength: 0.12
    }
  },
  arcade: {
    light: {
      hex: "#23e8ff",
      strength: 0.06
    },
    dark: {
      hex: "#ff6fd2",
      strength: 0.12
    }
  },
  jade: {
    light: {
      hex: "#8fd8ae",
      strength: 0.1
    }
  },
  observatory: {
    dark: {
      hex: "#8fa4ff",
      strength: 0.14
    }
  }
};
// Clear material: what's behind the piece, bent by the surface and tinted by its depth.
const seenThrough = (panorama, tone) => {
  const incoming = positionWorld.sub(cameraPosition).normalize();
  const bent = refract(incoming, normalWorld, 0.76);
  const room = texture(panorama, vec2(bent.x.atan(bent.z).div(Math.PI * 2).add(0.5), bent.y.asin().div(Math.PI).add(0.5))).level(float(1)).rgb;
  // Rays heading down meet the board and table, which the panorama doesn't hold.
  const below = smoothstep(0.05, -0.5, bent.y);
  const ground = tint(tone === "light" ? "#53768a" : "#0a2534").mul(0.5);
  const body = tint(tone === "light" ? "#d4f0fb" : "#1f6f9e");
  return mix(room, ground, below).mul(body).mul(tone === "light" ? 0.2 : 0.3);
};
// A piece darkens toward the board it stands on, as anything does in a room, so the head of
// one piece stands clear of the foot of the piece behind it.
export const footShade = () => mix(float(config.paint.footDark), float(1), smoothstep(0, config.paint.footReach, positionLocal.y));
const fromPaint = (made, normal, rim, clear) => {
  const material = new THREE.MeshPhysicalNodeMaterial({
    normalMap: normal
  });
  const base = texture(made.base, uv());
  material.colorNode = (clear ? base.rgb.mul(0.85) : base.rgb).mul(footShade());
  material.roughnessNode = base.a;
  const extra = made.extra ? texture(made.extra, uv()) : null;
  material.metalnessNode = extra ? extra.a : float(0);
  const glow = clear ? asCoord(seenThrough(clear.panorama, clear.tone)) : extra ? extra.rgb : vec3(0);
  material.emissiveNode = rim ? glow.add(tint(rim.hex).mul(fresnel(2.8)).mul(rim.strength)) : glow;
  material.clearcoat = made.clearcoat;
  material.clearcoatRoughness = config.paint.clearcoatRoughness;
  return ownedBy(material, [made]);
};
export const paintPieces = (renderer, set, tone, geometries, carving, stone, panorama) => {
  const recipe = recipes[set.recipe];
  const at = asCoord(positionLocal);
  const made = paint(renderer, geometries, crevice => recipe.piece({
    at,
    crevice,
    stone: stoneAround(stone, at)
  }, tone), carving, config.paint.pieces, tone === "light" ? set.scan.shardLight : set.scan.shardDark);
  const material = fromPaint(made, carving.normal, rims[set.recipe]?.[tone], recipe.clear ? {
    panorama,
    tone
  } : undefined);
  // Dark surfaces show every reflection, and a flat face turned to the lamps reads as a pale patch.
  if (tone === "dark") material.specularIntensity = config.paint.darkSpecular;
  return {
    material,
    made
  };
};
// The scan reuses and scatters its board islands, so a board is painted from directly above
// and looked up by position; the scan still supplies its carved normals and crevices.
export const paintBoard = (renderer, board, span, carving, stone, wood) => {
  const recipe = recipes[board.recipe];
  const artwork = recipe.engraving === "star-chart" ? starChart(span) : recipe.engraving === "fretwork" ? fretwork(span) : null;
  const mask = artwork ? texture(artwork, uv()).rgb : vec3(0);
  const point = asCoord(vec3(uv().x.sub(0.5).mul(span), 0, uv().y.sub(0.5).mul(span)));
  const edge = abs(point.x).max(abs(point.z));
  const reach = 4 * squareSize;
  const squares = squaresFinish(recipe, point, stone, mask);
  const frame = recipe.frame({
    at: point,
    crevice: float(0),
    stone: stoneAcross(stone, point),
    wood: woodAcross(wood, point),
    mask
  });
  const inside = float(1).sub(step(reach, edge));
  const line = step(reach, edge).mul(float(1).sub(step(reach + config.paint.inlayWidth, edge)));
  const blend = (a, b) => mix(asNode(b), asNode(a), inside);
  const baseTarget = bakeInto(renderer, vec4(mix(mix(frame.color, squares.color, inside), tint(recipe.inlay), line), mix(blend(squares.roughness, frame.roughness), float(0.5), line)), config.paint.board);
  // The line around the squares runs hot in styles that have one.
  const inlay = tint(recipe.inlay).mul(board.scan.glow.inlay ?? 0);
  const extraTarget = bakeInto(renderer, vec4(mix(mix(frame.emissive ?? vec3(0), squares.emissive ?? vec3(0), inside), inlay, line), mix(blend(squares.metalness, frame.metalness), float(0.5), line)), config.paint.board);
  artwork?.dispose();
  const base = baseTarget.texture;
  const extra = extraTarget.texture;
  base.anisotropy = config.scan.anisotropy;
  extra.anisotropy = config.scan.anisotropy;
  // Local position, negated because the stage turns the scanned board around.
  const lookup = vec2(positionLocal.x.negate(), positionLocal.z.negate()).div(span).add(0.5);
  const baseMap = texture(base, lookup);
  const extraMap = texture(extra, lookup);
  const crevices = mix(float(1), texture(carving.surface, uv()).r, config.paint.crevices);
  const material = new THREE.MeshPhysicalNodeMaterial({
    normalMap: carving.normal
  });
  material.normalScale.setScalar(recipe.relief ?? 1);
  // The bevel around the squares faces the key light, so it stays matte or it draws a white streak.
  const fromCenter = abs(positionLocal.x).max(abs(positionLocal.z));
  const bevel = smoothstep(reach - 0.09, reach - 0.05, fromCenter).mul(float(1).sub(smoothstep(reach + 0.08, reach + 0.16, fromCenter)));
  // The slab's sides have no painting of their own, and catching the key light they'd read as a bright strip.
  const top = smoothstep(0.5, 0.9, abs(normalLocal.y));
  material.colorNode = baseMap.rgb.mul(crevices).mul(mix(float(0.22), float(1), top));
  material.roughnessNode = mix(float(0.7), baseMap.a, top.mul(float(1).sub(bevel)));
  material.metalnessNode = extraMap.a.mul(top).mul(float(1).sub(bevel));
  material.emissiveNode = extraMap.rgb.mul(top);
  material.clearcoatNode = float(Math.max(squares.clearcoat ?? 0, frame.clearcoat ?? 0)).mul(float(1).sub(bevel));
  material.clearcoatRoughness = config.paint.clearcoatRoughness;
  return ownedBy(material, [baseTarget, extraTarget]);
};
// A floor painted for the style, one tile baked and repeated, fading out like the scanned ones.
export const paintTable = (renderer, world, stone) => {
  const look = recipes[world.recipe]?.table;
  if (!look) return null;
  const point = asCoord(vec3(uv().x.mul(look.tile), 0, uv().y.mul(look.tile)));
  const finish = look.finish({
    at: point,
    crevice: float(0),
    stone: stoneAcross(stone, point)
  });
  const size = config.paint.board;
  const base = bakeInto(renderer, vec4(finish.color, asNode(finish.roughness)), size, THREE.RepeatWrapping);
  const extra = bakeInto(renderer, vec4(finish.emissive ?? vec3(0), asNode(finish.metalness)), size, THREE.RepeatWrapping);
  [base, extra].forEach(target => {
    target.texture.anisotropy = config.scan.anisotropy;
  });
  const tiled = vec2(positionWorld.x, positionWorld.z).div(look.tile);
  const baseMap = texture(base.texture, tiled);
  const extraMap = texture(extra.texture, tiled);
  const material = new THREE.MeshStandardNodeMaterial();
  material.colorNode = baseMap.rgb;
  material.roughnessNode = baseMap.a;
  material.metalnessNode = extraMap.a;
  material.emissiveNode = extraMap.rgb;
  material.transparent = true;
  material.opacityNode = float(1).sub(smoothstep(6, 14, vec2(positionWorld.x, positionWorld.z).length()));
  return ownedBy(material, [base, extra]);
};
export const markerMaterial = (hex, shape, strength = 1) => {
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false
  });
  const centered = uv().sub(0.5);
  const radial = centered.length();
  const edge = abs(centered).max(abs(centered.yx)).x;
  const shapes = {
    dot: float(1).sub(smoothstep(0.115, 0.14, radial)),
    ring: smoothstep(0.405, 0.425, radial).mul(float(1).sub(smoothstep(0.465, 0.485, radial))),
    outline: smoothstep(0.45, 0.465, edge).mul(float(1).sub(smoothstep(0.49, 0.5, edge))),
    wash: float(0.55)
  };
  material.colorNode = tint(hex);
  material.opacityNode = shapes[shape].mul(strength);
  return material;
};
// A spark: a soft hot point, a wet round drop, or one square pixel.
export const sparkMaterial = look => {
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending: look === "drop" || look === "dust" ? THREE.NormalBlending : THREE.AdditiveBlending
  });
  const radial = uv().sub(0.5).length().mul(2);
  const falloff = float(1).sub(radial).max(0);
  material.colorNode = vec3(look === "drop" || look === "dust" ? 1 : look === "pixel" ? 1.3 : 3);
  material.opacityNode = look === "glow" ? pow(falloff, float(4)) : look === "dust" ? falloff.mul(falloff).mul(0.4) : look === "drop" ? float(1).sub(smoothstep(0.72, 0.9, radial)) : float(1);
  return material;
};
// What an ink death leaves on the board: wet ink creeping outward.
export const poolMaterial = hex => {
  const spread = uniform(0);
  const fade = uniform(1);
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false
  });
  const centered = uv().sub(0.5).mul(2);
  const wander = mx_fractal_noise_float(vec3(centered.mul(3.4), 1.7), 3, 2, 0.5).mul(0.5).add(0.5);
  const reach = centered.length().add(wander.mul(0.42));
  const edge = spread.mul(1.3);
  const body = float(1).sub(smoothstep(edge.sub(0.07), edge, reach));
  material.colorNode = tint(hex);
  material.opacityNode = body.mul(fade).mul(0.94);
  return {
    material,
    spread,
    fade
  };
};
export const shockwaveMaterial = hex => {
  const fade = uniform(0);
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending
  });
  const radial = uv().sub(0.5).length().mul(2);
  const band = smoothstep(0.8, 0.95, radial).mul(float(1).sub(smoothstep(0.92, 1, radial)));
  material.colorNode = tint(hex).mul(0.45);
  material.opacityNode = band.mul(fade);
  return {
    material,
    fade
  };
};
export const beamMaterial = hex => {
  const fade = uniform(0);
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending
  });
  const core = pow(abs(normalView.dot(positionViewDirection)), float(3));
  const ends = smoothstep(0, 0.12, uv().y).mul(float(1).sub(smoothstep(0.88, 1, uv().y)));
  material.colorNode = tint(hex).mul(2.4);
  material.opacityNode = core.mul(ends).mul(fade);
  return {
    material,
    fade
  };
};
export const shaftMaterial = hex => {
  const fade = uniform(0);
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    blending: THREE.AdditiveBlending
  });
  const rise = float(1).sub(uv().y);
  const edge = pow(abs(normalView.dot(positionViewDirection)), float(5));
  material.colorNode = tint(hex).mul(1.5);
  material.opacityNode = rise.mul(edge).mul(fade);
  return {
    material,
    fade
  };
};