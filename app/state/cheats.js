/*!
 * Chess
 * Copyright (c) Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a19e25-e438-75a3-a372-c9c67de14514
 */
// Intended use: reads the testing cheats from the ?cheat= query parameter once at startup. While any cheat is on, progress stays in memory and real saved data is never touched.
import { z } from "zod";
import { gameFromFen } from "../chess/game.js";
import { cheatSchema } from "../schemas.js";
// -----------------------------------------------------------------------------
// Reading the URL
// -----------------------------------------------------------------------------
const rawFromUrl = () => {
  const fromQuery = new URLSearchParams(location.search).get("cheat");
  if (fromQuery) return fromQuery;
  const hashQuery = location.hash.split("?")[1] ?? "";
  const value = new URLSearchParams(hashQuery).get("cheat") ?? "";
  // TanStack Router stores a search value as JSON, so a plain string can arrive quoted.
  // With a query on the page URL too, the router appends it to the hash's last value.
  return value.replace(/\?.*$/, "").replace(/^"|"$/g, "");
};
const validFen = fen => {
  try {
    gameFromFen(fen);
    return true;
  } catch {
    return false;
  }
};
const parseToken = token => {
  const at = token.indexOf(":");
  const name = at < 0 ? token : token.slice(0, at);
  const value = at < 0 ? true : token.slice(at + 1).replace(/_/g, " ");
  const field = cheatSchema.shape[name];
  if (!field) return null;
  const result = field.safeParse(value);
  if (!result.success) return null;
  if (name === "fen" && !validFen(result.data)) return null;
  return {
    [name]: result.data
  };
};
const parse = raw => {
  const tokens = raw.split(",").map(token => token.trim()).filter(Boolean);
  const parsed = tokens.map(token => ({
    token,
    value: parseToken(token)
  }));
  const merged = Object.assign({}, ...parsed.map(({
    value
  }) => value ?? {}));
  return {
    active: tokens.length > 0,
    raw,
    labels: parsed.flatMap(({
      token,
      value
    }) => value ? [token.split(":")[0]] : []),
    rejected: parsed.flatMap(({
      token,
      value
    }) => value ? [] : [token]),
    fresh: merged.fresh === true,
    hotseat: merged.hotseat === true,
    pushover: merged.pushover === true,
    rank: merged.rank ?? null,
    speed: merged.speed ?? null,
    clock: merged.clock ?? null,
    gpu: merged.gpu ?? null,
    style: merged.style ?? null,
    fen: merged.fen ?? null,
    cutscenes: merged.cutscenes ?? null
  };
};
export const cheats = parse(rawFromUrl());
// Cheats apply at startup, so editing them in the address bar reloads the game.
window.addEventListener("hashchange", () => {
  if (rawFromUrl() !== cheats.raw) location.reload();
});