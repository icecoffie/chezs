/*!
 * Chess
 * Copyright (c) Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a19e25-e438-75a3-a372-c9c67de14514
 */
// Intended use: worlds built from scanned materials: loads color, normal and surface maps and an HDRI once, keeps them in local storage, and makes the TSL-capable materials that show them.
import * as THREE from "three/webgpu";
import { abs, uv, vec3, color, mx_noise_float, equirectUV, float, positionLocal, pmremTexture, positionWorld, smoothstep, step, texture, vec2 } from "three/tsl";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { config } from "../config.js";
import { cachedBlob } from "../lib/utils.js";
import { backdropPainter } from "./backdrops.js";
import { bakeInto, footShade, ownedBy } from "./materials.js";
// -----------------------------------------------------------------------------
// Loading: decoded off the main thread, so a large image never stalls a frame
// -----------------------------------------------------------------------------
const assetUrl = (dir, file) => location.hostname.endsWith("localhost") || !config.assets.hosted ? new URL(`${config.assets.local}${dir}/${file}`, location.href).href : `${config.assets.hosted}${config.assets.prefix}${dir}--${file}`;
const urlFor = (scan, file) => assetUrl(scan.dir, file);
const loadMap = async (url, isColor) => {
  const blob = await cachedBlob(url);
  const bitmap = await createImageBitmap(blob, {
    premultiplyAlpha: "none",
    colorSpaceConversion: "none"
  });
  const map = new THREE.Texture(bitmap);
  map.addEventListener("dispose", () => bitmap.close());
  map.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  map.flipY = false;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = config.scan.anisotropy;
  map.needsUpdate = true;
  return map;
};
const loadMaps = async (scan, name) => {
  const [color, normal, surface] = await Promise.all([loadMap(urlFor(scan, `${name}-color.jpg`), true), loadMap(urlFor(scan, `${name}-normal.jpg`), false), loadMap(urlFor(scan, `${name}-surface.jpg`), false)]);
  return {
    color,
    normal,
    surface
  };
};
// The set's carved detail, shared by every painted finish and fetched only once.
const carvings = new Map();
export const loadCarving = name => {
  const cached = carvings.get(name);
  if (cached) return cached;
  const dir = config.assets.carving;
  const made = Promise.all([loadMap(assetUrl(dir, `${name}-normal.jpg`), false), loadMap(assetUrl(dir, `${name}-surface.jpg`), false)]).then(([normal, surface]) => ({
    normal,
    surface
  }));
  carvings.set(name, made);
  return made;
};
let stone = null;
let wood = null;
// The scanned wood frames take their grain from, fetched only once.
export const loadWood = () => {
  wood ??= loadMap(assetUrl(config.assets.carving, "table-color.jpg"), true);
  return wood;
};
// The scanned marble every painted style cuts its stone from, fetched only once.
export const loadStone = () => {
  stone ??= loadMap(assetUrl(config.assets.carving, "board-color.jpg"), true);
  return stone;
};
export const loadRoomLight = async scan => {
  const blob = await cachedBlob(urlFor(scan, scan.hdri));
  const local = URL.createObjectURL(blob);
  const light = await new HDRLoader().loadAsync(local);
  URL.revokeObjectURL(local);
  light.mapping = THREE.EquirectangularReflectionMapping;
  return light;
};
// -----------------------------------------------------------------------------
// Materials
// -----------------------------------------------------------------------------
const finished = (maps, clearcoat) => ownedBy(new THREE.MeshPhysicalNodeMaterial({
  map: maps.color,
  normalMap: maps.normal,
  roughnessMap: maps.surface,
  metalnessMap: maps.surface,
  aoMap: maps.surface,
  roughness: 1,
  metalness: 1,
  clearcoat,
  clearcoatRoughness: config.scan.clearcoatRoughness
}), [maps.color, maps.normal, maps.surface]);
// The inside of a broken piece: its own stone, rougher than the polished surface.
export const brokenStone = (tint, glow) => {
  const material = new THREE.MeshStandardNodeMaterial({
    roughness: config.scan.brokenRoughness
  });
  // UV, not position: a chunk carries its grain with it as it tumbles.
  const grain = mx_noise_float(vec3(uv().mul(config.scan.brokenGrain), 0)).mul(0.3).add(0.85);
  material.colorNode = color(tint).mul(grain);
  if (glow) material.emissiveNode = color(glow).mul(grain).mul(2.2);
  return material;
};
// What a polished board reflects: the piece, unlit and fading with depth. Drawn only over the squares.
export const mirrorMaterial = (map, strength) => {
  const material = new THREE.MeshBasicNodeMaterial({
    map,
    transparent: true,
    depthWrite: false
  });
  const reach = 4 * config.board.square;
  const inside = step(abs(positionWorld.x), reach).mul(step(abs(positionWorld.z), reach));
  const depth = float(1).sub(smoothstep(0, config.scan.reflectionDepth, positionWorld.y.negate()));
  material.opacityNode = depth.mul(depth).mul(inside).mul(strength);
  return material;
};
const shadedFoot = (material, map) => {
  material.colorNode = texture(map, uv()).rgb.mul(footShade());
  return material;
};
export const loadPieceMaterials = async scan => {
  const [white, black] = await Promise.all([loadMaps(scan, "white"), loadMaps(scan, "black")]);
  return {
    light: shadedFoot(finished(white, scan.clearcoat), white.color),
    dark: shadedFoot(finished(black, scan.clearcoat), black.color),
    shardLight: brokenStone(scan.shardLight, scan.brokenGlow),
    shardDark: brokenStone(scan.shardDark, scan.brokenGlow),
    mirrorLight: mirrorMaterial(white.color, scan.reflection),
    mirrorDark: mirrorMaterial(black.color, scan.reflection)
  };
};
// The scanned frame is lifted a little, so dark pieces on the back rank stand clear of it.
const liftedFrame = (maps, clearcoat) => {
  const material = finished(maps, clearcoat);
  const reach = 4 * config.board.square;
  const outside = smoothstep(reach + 0.03, reach + 0.06, abs(positionLocal.x).max(abs(positionLocal.z)));
  material.colorNode = texture(maps.color, uv()).rgb.mul(float(1).add(outside.mul(config.scan.frameLift)));
  return material;
};
export const loadBoardMaterial = async scan => liftedFrame(await loadMaps(scan, "board"), scan.clearcoat);
export const loadTableMaterial = async scan => {
  const maps = await loadMaps(scan, "table");
  [maps.color, maps.normal, maps.surface].forEach(map => map.repeat.set(scan.tableRepeat, scan.tableRepeat));
  const material = new THREE.MeshStandardNodeMaterial({
    color: scan.tableTint,
    map: maps.color,
    normalMap: maps.normal,
    roughnessMap: maps.surface,
    metalnessMap: maps.surface,
    roughness: 1,
    metalness: 1
  });
  const radius = vec2(positionWorld.x, positionWorld.z).length();
  material.transparent = true;
  material.opacityNode = float(1).sub(smoothstep(6, 14, radius));
  return ownedBy(material, [maps.color, maps.normal, maps.surface]);
};
// The room's light, softly out of focus and baked once into a panorama: a sharp 1k HDRI shows
// its pixels in close-ups, and blurring it per pixel every frame costs a visible slowdown.
export const roomBackdrop = (renderer, prefiltered, power, recipe) => {
  const longitude = uv().x.sub(0.5).mul(Math.PI * 2);
  const latitude = uv().y.sub(0.5).mul(Math.PI);
  const direction = vec3(longitude.sin().mul(latitude.cos()), latitude.sin(), longitude.cos().mul(latitude.cos()));
  const painter = backdropPainter(recipe);
  const roomSeen = seen => {
    const light = pmremTexture(prefiltered, seen, float(config.scan.backdropFocus));
    return painter ? light.rgb.mul(power * painter.keep).min(vec3(config.scan.backdropLimit)).add(painter.paint(seen)) : light.mul(power);
  };
  const panorama = bakeInto(renderer, roomSeen(direction), config.scan.backdropSize, THREE.RepeatWrapping);
  // Render targets read back flipped, so reflections get their own copy the right way up.
  const reflected = painter ? bakeInto(renderer, roomSeen(vec3(direction.x, direction.y.negate(), direction.z)), config.scan.backdropSize) : null;
  const material = ownedBy(new THREE.MeshBasicNodeMaterial({
    side: THREE.BackSide,
    depthWrite: false
  }), [panorama]);
  // The sphere's own coordinates: no trigonometry per pixel, and no seam where longitude wraps.
  material.colorNode = texture(panorama.texture, uv().add(vec2(0.25, 0)));
  return {
    material,
    panorama: panorama.texture,
    reflected
  };
};