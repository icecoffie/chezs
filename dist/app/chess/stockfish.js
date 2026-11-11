/*!
 * Chess
 * Copyright (c) Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a19e25-e438-75a3-a372-c9c67de14514
 */
// Intended use: the computer's mind: starts Stockfish once in a worker, keeps its large file in local storage, and answers move, hint and evaluation requests one at a time.
import { config } from "../config.js";
import { cachedBlob, resolveImport } from "../lib/utils.js";
// -----------------------------------------------------------------------------
// Worker startup
// -----------------------------------------------------------------------------
const listeners = new Set();
let booting = null;
let queue = Promise.resolve();
const waitFor = (worker, command, done) => new Promise(resolve => {
  const lines = [];
  const listener = line => {
    lines.push(line);
    if (done(line)) {
      listeners.delete(listener);
      resolve(lines);
    }
  };
  listeners.add(listener);
  if (command) worker.postMessage(command);
});
const boot = async onProgress => {
  const wasmUrl = resolveImport(config.engine.wasm);
  const scriptUrl = `${resolveImport(config.engine.script)}?raw`;
  const [wasm, script] = await Promise.all([cachedBlob(wasmUrl, onProgress), cachedBlob(scriptUrl)]);
  const wasmLocal = URL.createObjectURL(new Blob([wasm], {
    type: "application/wasm"
  }));
  const scriptLocal = URL.createObjectURL(new Blob([script], {
    type: "text/javascript"
  }));
  const worker = new Worker(`${scriptLocal}#${encodeURIComponent(wasmLocal)}`);
  worker.onmessage = event => [...listeners].forEach(listener => listener(String(event.data)));
  await waitFor(worker, "uci", line => line === "uciok");
  worker.postMessage(`setoption name Hash value ${config.engine.hashMb}`);
  await waitFor(worker, "isready", line => line === "readyok");
  return worker;
};
export const startEngine = (onProgress = () => undefined) => {
  booting ??= boot(onProgress).catch(error => {
    booting = null;
    throw error;
  });
  return booting;
};
const inTurn = task => {
  const run = queue.then(async () => task(await startEngine()));
  queue = run.catch(() => undefined);
  return run;
};
// -----------------------------------------------------------------------------
// Searching
// -----------------------------------------------------------------------------
const positionCommand = ({
  fen,
  moves
}) => `position fen ${fen}${moves.length ? ` moves ${moves.join(" ")}` : ""}`;
const prepare = async (worker, position, strength, lines) => {
  [`setoption name UCI_Chess960 value ${position.chess960}`, `setoption name MultiPV value ${lines}`, ...strength, positionCommand(position)].forEach(command => worker.postMessage(command));
  await waitFor(worker, "isready", line => line === "readyok");
};
const parseLines = output => {
  const best = new Map();
  output.forEach(line => {
    const found = line.match(/ multipv (\d+) .*score (cp|mate) (-?\d+).* pv (\S+)/);
    if (!found) return;
    const isMate = found[2] === "mate";
    const value = Number(found[3]);
    const cp = isMate ? Math.sign(value || -1) * (config.engine.mateScore - Math.abs(value)) : value;
    best.set(Number(found[1]), {
      uci: found[4],
      cp,
      mate: isMate ? value : null
    });
  });
  return [...best.entries()].sort(([a], [b]) => a - b).map(([, line]) => line);
};
const search = async (worker, go) => {
  const output = await waitFor(worker, go, line => line.startsWith("bestmove"));
  return {
    lines: parseLines(output),
    best: output[output.length - 1].split(" ")[1]
  };
};
const FULL_STRENGTH = ["setoption name UCI_LimitStrength value false", "setoption name Skill Level value 20"];
// -----------------------------------------------------------------------------
// Human-feeling mistakes for the lowest ranks
// -----------------------------------------------------------------------------
const chooseHumanly = (lines, best, temper, blunder, aggression) => {
  if (!lines.length) return best;
  if (Math.random() < blunder) return lines[lines.length - 1].uci;
  const top = lines[0].cp;
  const weights = lines.map((line, index) => {
    const loss = Math.max(0, top - line.cp) - (index % 2 === 1 ? aggression * 0.2 : 0);
    return Math.exp(-loss / Math.max(temper, 1));
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const roll = Math.random() * total;
  const chosen = weights.reduce((state, weight, index) => state.at > 0 ? {
    at: state.at - weight,
    index
  } : state, {
    at: roll,
    index: 0
  });
  return lines[chosen.index].uci;
};
// -----------------------------------------------------------------------------
// Public requests
// -----------------------------------------------------------------------------
export const chooseMove = (position, play) => inTurn(async worker => {
  if (play.kind === "human") {
    await prepare(worker, position, FULL_STRENGTH, play.lines);
    const {
      lines,
      best
    } = await search(worker, `go depth ${play.depth}`);
    return chooseHumanly(lines, best, play.temper, play.blunder, play.aggression);
  }
  if (play.kind === "elo") {
    const limit = ["setoption name UCI_LimitStrength value true", `setoption name UCI_Elo value ${play.elo}`];
    await prepare(worker, position, limit, 1);
    return (await search(worker, `go movetime ${play.movetime}`)).best;
  }
  await prepare(worker, position, FULL_STRENGTH, 1);
  return (await search(worker, `go movetime ${play.movetime}`)).best;
});
export const evaluate = (position, movetime) => inTurn(async worker => {
  await prepare(worker, position, FULL_STRENGTH, 1);
  const {
    lines
  } = await search(worker, `go movetime ${movetime}`);
  return lines[0] ?? null;
});