/*!
 * Chess
 * Copyright (c) Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a19e25-e438-75a3-a372-c9c67de14514
 */
// Intended use: one query per resource: key, source, loader and schema. The piece models go through local storage so they download only once.
import { z } from "zod";
import * as THREE from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { config } from "../config.js";
import { cachedBlob } from "../lib/utils.js";
import { lessonSchema, opponentSchema, parseOrThrow, worldSchema } from "../schemas.js";
const loadJson = async (url, schema) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return parseOrThrow(schema, await response.json(), url);
};
export const worldsQuery = {
  queryKey: ["worlds"],
  queryFn: () => loadJson(config.data.worlds, z.array(worldSchema))
};
export const opponentsQuery = {
  queryKey: ["opponents"],
  queryFn: () => loadJson(config.data.opponents, z.array(opponentSchema))
};
export const lessonsQuery = {
  queryKey: ["lessons"],
  queryFn: () => loadJson(config.data.lessons, z.array(lessonSchema))
};
const loadPieces = async () => {
  const blob = await cachedBlob(new URL(config.data.pieces, location.href).href);
  const gltf = await new GLTFLoader().parseAsync(await blob.arrayBuffer(), "");
  const roles = ["pawn", "knight", "bishop", "rook", "queen", "king"];
  const names = ["board", ...roles.flatMap(role => [`white_${role}`, `black_${role}`])];
  return Object.fromEntries(names.map(name => {
    const mesh = gltf.scene.getObjectByName(name);
    if (!mesh) throw new Error(`${config.data.pieces} [${name}] mesh: expected a mesh, got nothing`);
    return [name, mesh.geometry];
  }));
};
export const piecesQuery = {
  queryKey: ["pieces"],
  queryFn: loadPieces
};