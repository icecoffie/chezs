/*!
 * Chess
 * Copyright (c) Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a19e25-e438-75a3-a372-c9c67de14514
 */
export const cutsceneFor = (facts, setting) => {
  if (setting === "off") return "none";
  if (facts.checkmate) return "checkmate";
  if (facts.promotion) return "promotion";
  if (facts.captured?.role === "queen") return "queen-falls";
  if (facts.sacrifice) return "sacrifice";
  if (facts.enPassant) return "en-passant";
  if (facts.captured && (facts.captured.role !== "pawn" || setting === "captures")) return "capture";
  if (facts.rook) return "castle";
  if (facts.check) return "check";
  return "none";
};