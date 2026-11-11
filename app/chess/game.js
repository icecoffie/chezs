/*!
 * Chess
 * Copyright (c) Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a19e25-e438-75a3-a372-c9c67de14514
 */
// Intended use: the rules of play, as glue around chessops: legal moves, applying a move, describing what happened, draws under the chosen rules, and start positions.
import { Chess, castlingSide, normalizeMove } from "chessops/chess";
import { chessgroundDests } from "chessops/compat";
import { makeFen, parseFen } from "chessops/fen";
import { makeSan, parseSan } from "chessops/san";
import { parseSquare, makeSquare, parseUci, makeUci } from "chessops/util";
import { config } from "../config.js";
// -----------------------------------------------------------------------------
// Start positions
// -----------------------------------------------------------------------------
const STANDARD = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const pick = (items, index) => [items[index], items.filter((_, i) => i !== index)];
const backRank960 = () => {
  const random = n => Math.floor(Math.random() * n);
  const rank = Array(8).fill("");
  rank[random(4) * 2] = "b";
  rank[random(4) * 2 + 1] = "b";
  const open = () => rank.flatMap((piece, i) => piece ? [] : [i]);
  ["q", "n", "n"].forEach(piece => {
    const squares = open();
    const [square] = pick(squares, random(squares.length));
    rank[square] = piece;
  });
  const [a, k, b] = open();
  rank[a] = "r";
  rank[k] = "k";
  rank[b] = "r";
  return rank;
};
const startPlacement = start => {
  if (start === "standard") return {
    fen: STANDARD,
    chess960: false
  };
  const rank = backRank960().join("");
  const rights = [...rank].flatMap((piece, i) => piece === "r" ? ["abcdefgh"[i]] : []);
  const castling = rights.map(f => f.toUpperCase()).join("") + rights.join("");
  return {
    fen: `${rank}/pppppppp/8/8/8/8/PPPPPPPP/${rank.toUpperCase()} w ${castling} - 0 1`,
    chess960: true
  };
};
const oddsRemoved = {
  knight: "n",
  rook: "r",
  queen: "q"
};
const applyOdds = (fen, odds, you) => {
  if (odds === "none") return fen;
  const [giver, piece] = odds.split("-");
  const color = giver === "you" ? you : you === "white" ? "black" : "white";
  const letter = oddsRemoved[piece];
  const target = color === "white" ? letter.toUpperCase() : letter;
  const ranks = fen.split(" ")[0].split("/");
  const backIndex = color === "white" ? 7 : 0;
  // Queenside piece goes first, the way odds are traditionally given.
  const expanded = ranks[backIndex].replace(/\d/g, n => "1".repeat(Number(n)));
  const at = expanded.indexOf(target);
  const removed = `${expanded.slice(0, at)}1${expanded.slice(at + 1)}`.replace(/1+/g, run => String(run.length));
  ranks[backIndex] = removed;
  const parts = fen.split(" ");
  const rookFile = expanded[at] === target && piece === "rook" ? "abcdefgh"[at] : "";
  const castling = piece === "rook" ? stripCastling(parts[2], color, rookFile, at) : parts[2];
  return [ranks.join("/"), parts[1], castling || "-", ...parts.slice(3)].join(" ");
};
const stripCastling = (rights, color, file, at) => {
  const standardLetter = at === 0 ? "q" : "k";
  const letters = color === "white" ? [standardLetter.toUpperCase(), file.toUpperCase()] : [standardLetter, file];
  return [...rights].filter(r => !letters.includes(r)).join("");
};
const load = fen => Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
const repetitionKey = position => makeFen(position.toSetup()).split(" ").slice(0, 4).join(" ");
export const newGame = (rules, you) => {
  const {
    fen,
    chess960
  } = startPlacement(rules.start);
  const startFen = applyOdds(fen, rules.odds, you);
  const position = load(startFen);
  return {
    startFen,
    chess960,
    history: [],
    position,
    keys: [repetitionKey(position)]
  };
};
export const gameFromFen = fen => {
  const position = load(fen);
  return {
    startFen: fen,
    chess960: false,
    history: [],
    position,
    keys: [repetitionKey(position)]
  };
};
// -----------------------------------------------------------------------------
// Reading a position
// -----------------------------------------------------------------------------
export const turnOf = game => game.position.turn;
export const piecesOf = game => [...game.position.board].map(([square, piece]) => ({
  square,
  color: piece.color,
  role: piece.role
}));
export const pieceAt = (game, square) => {
  const piece = game.position.board.get(square);
  return piece ? {
    square,
    color: piece.color,
    role: piece.role
  } : null;
};
export const legalTargets = game => chessgroundDests(game.position, {
  chess960: game.chess960
});
export const targetsFrom = (game, square) => (legalTargets(game).get(makeSquare(square)) ?? []).map(name => parseSquare(name));
export const squareName = square => makeSquare(square);
export const squareFromName = name => parseSquare(name);
export const fileOf = square => square % 8;
export const rankOf = square => Math.floor(square / 8);
export const opposite = side => side === "white" ? "black" : "white";
export const currentFen = game => makeFen(game.position.toSetup());
export const needsPromotion = (game, from, to) => {
  const piece = game.position.board.get(from);
  return piece?.role === "pawn" && (rankOf(to) === 0 || rankOf(to) === 7);
};
export const kingInCheck = game => game.position.isCheck() ? game.position.board.kingOf(game.position.turn) : undefined;
// -----------------------------------------------------------------------------
// Sacrifices
// -----------------------------------------------------------------------------
const valueOf = role => config.ladder.pieceValue[role];
const isSacrifice = (next, to, role, gain) => {
  if (valueOf(role) < 3 || valueOf(role) <= gain) return false;
  const enemies = next.kingAttackers(to, next.turn, next.board.occupied);
  const enemyCaptures = [...enemies].some(from => {
    const attacker = next.board.get(from);
    return attacker !== undefined && attacker.role !== "king" && valueOf(attacker.role) < valueOf(role);
  });
  return enemyCaptures;
};
// -----------------------------------------------------------------------------
// Playing
// -----------------------------------------------------------------------------
const toEngineUci = (move, game, side) => {
  if (game.chess960 || !side) return makeUci(move);
  const kingFile = side === "h" ? 6 : 2;
  return makeSquare(move.from) + makeSquare(rankOf(move.from) * 8 + kingFile);
};
export const play = (game, uci) => {
  const parsed = parseUci(uci);
  if (!parsed || !("from" in parsed)) return null;
  const before = game.position;
  const move = normalizeMove(before, parsed);
  if (!before.isLegal(move)) return null;
  const moving = before.board.get(move.from);
  if (!moving) return null;
  const side = castlingSide(before, move);
  const rank = rankOf(move.from);
  const rook = side ? {
    from: move.to,
    to: rank * 8 + (side === "h" ? 5 : 3)
  } : undefined;
  const to = side ? rank * 8 + (side === "h" ? 6 : 2) : move.to;
  const enPassant = moving.role === "pawn" && before.epSquare === move.to && fileOf(move.from) !== fileOf(move.to);
  const capturedSquare = enPassant ? move.to + (moving.color === "white" ? -8 : 8) : move.to;
  const capturedPiece = side ? undefined : before.board.get(capturedSquare);
  const san = makeSan(before, move);
  const after = before.clone();
  after.play(move);
  const gain = capturedPiece ? valueOf(capturedPiece.role) : 0;
  const movedRole = move.promotion ?? moving.role;
  const facts = {
    uci: makeUci(move),
    engineUci: toEngineUci(move, game, side ? side === "h" ? "h" : "a" : undefined),
    san,
    from: move.from,
    to,
    color: moving.color,
    role: moving.role,
    promotion: move.promotion,
    captured: capturedPiece ? {
      square: capturedSquare,
      role: capturedPiece.role
    } : undefined,
    rook,
    enPassant,
    check: after.isCheck(),
    checkmate: after.isCheckmate(),
    kingSquare: after.isCheck() ? after.board.kingOf(after.turn) : undefined,
    checkers: after.isCheck() ? [...after.ctx().checkers] : [],
    sacrifice: !side && isSacrifice(after, to, movedRole, gain),
    fen: makeFen(after.toSetup())
  };
  return {
    game: {
      ...game,
      position: after,
      history: [...game.history, facts],
      keys: [...game.keys, repetitionKey(after)]
    },
    facts
  };
};
export const replayTo = (game, length) => {
  const fresh = {
    ...gameFromFen(game.startFen),
    chess960: game.chess960
  };
  return game.history.slice(0, length).reduce((at, facts) => play(at, facts.uci)?.game ?? at, fresh);
};
export const parseTyped = (game, text) => {
  const clean = text.trim();
  const san = parseSan(game.position, clean);
  if (san) return makeUci(san);
  const uci = parseUci(clean.toLowerCase());
  return uci && game.position.isLegal(normalizeMove(game.position, uci)) ? makeUci(uci) : null;
};
export const randomLegalMove = game => {
  const moves = [...legalTargets(game).entries()].flatMap(([from, targets]) => targets.map(to => `${from}${to}`));
  const move = moves[Math.floor(Math.random() * moves.length)];
  const from = parseSquare(move.slice(0, 2));
  const to = parseSquare(move.slice(2, 4));
  return needsPromotion(game, from, to) ? `${move}q` : move;
};
export const engineMoves = game => game.history.map(facts => facts.engineUci);
// -----------------------------------------------------------------------------
// Endings
// -----------------------------------------------------------------------------
const repeats = game => {
  const latest = game.keys[game.keys.length - 1];
  return game.keys.filter(key => key === latest).length;
};
export const endingOf = (game, rules) => {
  const {
    position
  } = game;
  if (position.isCheckmate()) return {
    kind: "checkmate",
    winner: opposite(position.turn)
  };
  if (position.isStalemate()) return {
    kind: "stalemate"
  };
  if (position.isInsufficientMaterial()) return {
    kind: "insufficient"
  };
  if (repeats(game) >= (rules.repetition === "threefold" ? 3 : 5)) return {
    kind: "repetition"
  };
  if (position.halfmoves >= (rules.moveLimit === "fifty" ? 100 : 150)) return {
    kind: "move-limit"
  };
  return null;
};