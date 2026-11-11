/*!
 * Chess
 * Copyright (c) Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a19e25-e438-75a3-a372-c9c67de14514
 */
// Intended use: the store: every action in the game, the turn loop tying rules, engine, clocks and the stage together, ladder results and persisted progress.
import { useSyncExternalStore } from "react";
import { config } from "../config.js";
import { cutsceneFor } from "../chess/events.js";
import { currentFen, endingOf, engineMoves, gameFromFen, needsPromotion, randomLegalMove, newGame, opposite, pieceAt, play, replayTo, targetsFrom, turnOf } from "../chess/game.js";
import { chooseMove, evaluate, startEngine } from "../chess/stockfish.js";
import { parseOrThrow, profileSchema } from "../schemas.js";
import { pause, prefersReducedMotion, readSaved, writeSaved } from "../lib/utils.js";
import { cheats } from "./cheats.js";
// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------
const readProfile = () => {
  const saved = cheats.fresh ? undefined : readSaved(config.storageKey);
  if (saved === undefined) return config.defaults;
  try {
    return parseOrThrow(profileSchema, saved, "saved progress");
  } catch (error) {
    console.warn(error);
    return config.defaults;
  }
};
const loadProfile = () => {
  const profile = readProfile();
  return {
    ...profile,
    rung: cheats.rank === null ? profile.rung : cheats.rank - 1,
    settings: {
      ...profile.settings,
      cutscenes: cheats.cutscenes ?? profile.settings.cutscenes
    }
  };
};
let state = {
  profile: loadProfile(),
  worlds: [],
  opponents: [],
  lessons: [],
  session: null,
  engine: {
    state: "idle",
    loaded: 0,
    total: 0
  },
  // The board is being set up from the moment the page opens.
  stage: {
    busy: true,
    label: "",
    done: 0,
    total: 0
  }
};
const listeners = new Set();
let stage = null;
let sessionCounter = 0;
const setState = patch => {
  state = {
    ...state,
    ...patch
  };
  listeners.forEach(listener => listener());
};
export const getState = () => state;
export const setStageStatus = stage => setState({
  stage
});
export const subscribe = listener => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const useStore = selector => useSyncExternalStore(subscribe, () => selector(state));
const patchSession = patch => {
  if (state.session) setState({
    session: {
      ...state.session,
      ...patch
    }
  });
};
const saveProfile = patch => {
  const profile = {
    ...state.profile,
    ...patch
  };
  // Cheating sessions stay in memory, so testing can never alter real progress.
  if (!cheats.active) writeSaved(config.storageKey, profile);
  setState({
    profile
  });
};
const isCurrent = id => state.session?.id === id;
// -----------------------------------------------------------------------------
// Catalog and the stage
// -----------------------------------------------------------------------------
export const worldById = id => state.worlds.find(world => world.id === id) ?? state.worlds[0];
const forcedWorld = () => state.worlds.find(world => world.id === cheats.style);
const pinnedWorld = () => forcedWorld() ?? state.worlds.find(world => world.id === state.profile.style);
export const homeWorld = () => {
  const {
    rung
  } = state.profile;
  const opponent = state.opponents[Math.min(rung, state.opponents.length - 1)];
  return pinnedWorld() ?? worldById(opponent.world);
};
const showLadderOnStage = () => {
  void stage?.showLadder(homeWorld(), state.profile.rung, state.opponents.map(opponent => opponent.figure));
};
const showSessionOnStage = () => {
  const {
    session
  } = state;
  return session && stage?.showGame(session.game, session.you, session.world) || Promise.resolve();
};
export const setCatalog = (worlds, opponents, lessons) => {
  if (state.worlds.length) return;
  state = {
    ...state,
    worlds,
    opponents,
    lessons
  };
  if (stage) showLadderOnStage();
};
export const bindStage = api => {
  stage = api;
  if (!api || !state.worlds.length) return;
  if (state.session) void showSessionOnStage();else showLadderOnStage();
};
export const warmEngine = () => {
  if (state.engine.state === "loading" || state.engine.state === "ready") return;
  setState({
    engine: {
      state: "loading",
      loaded: 0,
      total: 0
    }
  });
  startEngine((loaded, total) => setState({
    engine: {
      state: "loading",
      loaded,
      total
    }
  })).then(() => setState({
    engine: {
      ...state.engine,
      state: "ready"
    }
  })).catch(error => {
    console.error(error);
    setState({
      engine: {
        ...state.engine,
        state: "failed"
      }
    });
  });
};
// -----------------------------------------------------------------------------
// Navigation
// -----------------------------------------------------------------------------
export const leaveTable = () => {
  if (!state.session) return;
  stage?.skip();
  setState({
    session: null
  });
  showLadderOnStage();
};
export const updateRules = patch => saveProfile({
  rules: {
    ...state.profile.rules,
    ...patch
  }
});
export const updateStyle = id => {
  saveProfile({
    style: id
  });
  if (!state.session) showLadderOnStage();
};
// Shows a style on the table while it's being considered, before any game exists.
export const previewStyle = id => {
  if (state.session || !state.worlds.length) return;
  void stage?.showLadder(id ? worldById(id) : homeWorld(), state.profile.rung, state.opponents.map(opponent => opponent.figure));
};
export const updateGameStyle = id => {
  if (!state.session) return;
  const world = worldById(id);
  patchSession({
    world
  });
  void stage?.restyle(world);
};
export const updateSettings = patch => saveProfile({
  settings: {
    ...state.profile.settings,
    ...patch
  }
});
export const resetLadder = () => {
  saveProfile({
    rung: 0,
    points: 0
  });
  showLadderOnStage();
};
// -----------------------------------------------------------------------------
// Starting play
// -----------------------------------------------------------------------------
const clocksFor = rules => {
  if (cheats.clock) return {
    white: cheats.clock,
    black: cheats.clock
  };
  if (rules.clock === "none") return null;
  const {
    base
  } = config.clocks[rules.clock];
  return {
    white: base,
    black: base
  };
};
const positionOf = game => ({
  fen: game.startFen,
  moves: engineMoves(game),
  chess960: game.chess960
});
const shuffledWorld = () => {
  const options = state.worlds.filter(world => world.id !== state.profile.lastWorld);
  return options[Math.floor(Math.random() * options.length)];
};
const begin = session => {
  sessionCounter += 1;
  const opening = cheats.fen && session.mode !== "lesson" ? gameFromFen(cheats.fen) : session.game;
  const next = {
    ...session,
    game: opening,
    you: cheats.hotseat ? turnOf(opening) : session.you,
    world: forcedWorld() ?? session.world,
    id: sessionCounter,
    phase: "yours",
    selected: null,
    focus: null,
    promoting: null,
    hint: null,
    ending: null,
    outcome: null,
    promoted: false,
    evals: [],
    wrongPlies: 0,
    hintPending: false,
    coachThinking: false,
    scene: "none",
    announcement: ""
  };
  setState({
    session: next
  });
  saveProfile({
    lastWorld: next.world.id
  });
  warmEngine();
  void showSessionOnStage().then(() => {
    if (isCurrent(next.id) && turnOf(next.game) !== next.you) void engineTurn(next.id);
  });
};
export const startClimb = () => {
  const {
    rung,
    rules
  } = state.profile;
  const opponent = state.opponents[Math.min(rung, state.opponents.length - 1)];
  const you = "white";
  const climbRules = {
    ...rules,
    start: "standard",
    odds: "none"
  };
  begin({
    mode: "climb",
    opponent,
    world: pinnedWorld() ?? worldById(opponent.world),
    you,
    rules: climbRules,
    game: newGame(climbRules, you),
    clocks: clocksFor(climbRules),
    lesson: null,
    stepIndex: 0,
    coachLine: null
  });
};
export const startCasual = (opponent, side, style) => {
  const {
    rules
  } = state.profile;
  const you = side === "lots" ? Math.random() < 0.5 ? "white" : "black" : side;
  begin({
    mode: "casual",
    opponent,
    world: style === "shuffle" ? pinnedWorld() ?? shuffledWorld() : worldById(style),
    you,
    rules,
    game: newGame(rules, you),
    clocks: clocksFor(rules),
    lesson: null,
    stepIndex: 0,
    coachLine: null
  });
};
export const startLesson = lesson => {
  const game = gameFromFen(lesson.fen);
  begin({
    mode: "lesson",
    opponent: null,
    world: pinnedWorld() ?? worldById(lesson.world),
    you: turnOf(game),
    rules: {
      ...config.defaults.rules
    },
    game,
    clocks: null,
    lesson,
    stepIndex: 0,
    coachLine: lesson.steps[0].prompt
  });
};
export const rematch = () => {
  const {
    session
  } = state;
  if (!session) return;
  if (session.mode === "climb") startClimb();else if (session.mode === "lesson" && session.lesson) startLesson(session.lesson);else if (session.opponent) startCasual(session.opponent, opposite(session.you), "shuffle");
};
// -----------------------------------------------------------------------------
// Selecting and moving
// -----------------------------------------------------------------------------
export const selectSquare = square => patchSession({
  selected: square,
  hint: null
});
export const focusSquare = square => patchSession({
  focus: square
});
export const canMoveNow = session => session !== null && session.phase === "yours" && turnOf(session.game) === session.you;
export const tapSquare = square => {
  const {
    session
  } = state;
  if (!canMoveNow(session)) return;
  const here = pieceAt(session.game, square);
  if (session.selected !== null && session.selected !== square) {
    if (targetsFrom(session.game, session.selected).includes(square)) {
      attemptMove(session.selected, square);
      return;
    }
  }
  if (session.selected === square) selectSquare(null);else selectSquare(here && here.color === session.you ? square : null);
};
const uciOf = (from, to, promotion) => {
  const files = "abcdefgh";
  const name = square => `${files[square % 8]}${Math.floor(square / 8) + 1}`;
  const letter = promotion ? {
    queen: "q",
    rook: "r",
    bishop: "b",
    knight: "n",
    pawn: "",
    king: ""
  }[promotion] : "";
  return `${name(from)}${name(to)}${letter}`;
};
export const attemptMove = (from, to) => {
  const {
    session
  } = state;
  if (!canMoveNow(session) || !targetsFrom(session.game, from).includes(to)) return;
  if (needsPromotion(session.game, from, to) && session.rules.promotion === "choose") {
    patchSession({
      phase: "promoting",
      promoting: {
        from,
        to
      },
      selected: null
    });
    return;
  }
  const promotion = needsPromotion(session.game, from, to) ? "queen" : undefined;
  void playerMoves(uciOf(from, to, promotion));
};
export const choosePromotion = role => {
  const {
    session
  } = state;
  if (!session?.promoting) return;
  const {
    from,
    to
  } = session.promoting;
  patchSession({
    phase: "yours",
    promoting: null
  });
  if (role) void playerMoves(uciOf(from, to, role));
};
export const playTyped = uci => {
  const {
    session
  } = state;
  if (!canMoveNow(session) || !play(session.game, uci)) return false;
  void playerMoves(uci);
  return true;
};
// -----------------------------------------------------------------------------
// The turn loop
// -----------------------------------------------------------------------------
const whiteEval = (game, cp) => turnOf(game) === "white" ? cp : -cp;
const commit = async (id, uci) => {
  const session = state.session;
  if (!session || !isCurrent(id)) return null;
  const result = play(session.game, uci);
  if (!result) return null;
  const {
    game,
    facts
  } = result;
  const {
    rules
  } = session;
  const increment = rules.clock === "none" ? 0 : config.clocks[rules.clock].increment;
  const clocks = session.clocks ? {
    ...session.clocks,
    [facts.color]: session.clocks[facts.color] + increment
  } : null;
  const reduced = prefersReducedMotion();
  const scene = reduced ? "none" : cutsceneFor(facts, state.profile.settings.cutscenes);
  patchSession({
    game,
    clocks,
    phase: "moving",
    selected: null,
    hint: null,
    scene,
    announcement: `${facts.color === session.you ? "You played" : "The computer played"} ${facts.san}`
  });
  const evalSlot = game.history.length - 1;
  void evaluate(positionOf(game), config.engine.analysisMs).then(line => {
    const current = state.session;
    if (!current || current.id !== id) return;
    const evals = [...current.evals];
    evals[evalSlot] = line ? whiteEval(game, line.cp) : null;
    patchSession({
      evals
    });
  }).catch(() => undefined);
  await stage?.playMove(facts, game, scene);
  if (!isCurrent(id)) return null;
  patchSession({
    scene: "none"
  });
  return facts;
};
const resultOf = (ending, you) => {
  if ("winner" in ending) return ending.winner === you ? "won" : "lost";
  return "drawn";
};
const finish = async (id, ending, facts) => {
  const session = state.session;
  if (!session || !isCurrent(id)) return;
  const outcome = resultOf(ending, session.you);
  patchSession({
    phase: "moving",
    ending,
    outcome
  });
  const reduced = prefersReducedMotion() || state.profile.settings.cutscenes === "off";
  if (!reduced) await stage?.playEnding(ending, session.game, facts);
  if (!isCurrent(id)) return;
  const earned = outcome === "won" ? 1 : outcome === "drawn" ? 0.5 : 0;
  const {
    rung,
    points,
    games
  } = state.profile;
  if (session.mode === "climb") {
    const total = points + earned;
    const advance = total >= config.ladder.pointsToAdvance;
    saveProfile({
      games: games + 1,
      points: advance ? 0 : total,
      rung: advance ? Math.min(rung + 1, 8) : rung
    });
    patchSession({
      phase: "over",
      promoted: advance
    });
  } else {
    saveProfile({
      games: games + 1
    });
    patchSession({
      phase: "over"
    });
  }
};
const afterMove = async (id, facts) => {
  const session = state.session;
  if (!session || !isCurrent(id)) return false;
  const ending = endingOf(session.game, session.rules);
  if (ending) {
    await finish(id, ending, facts);
    return false;
  }
  return true;
};
async function engineTurn(id) {
  const session = state.session;
  if (!session || !isCurrent(id) || !session.opponent) return;
  patchSession({
    phase: "thinking"
  });
  const started = performance.now();
  const uci = await (cheats.pushover ? Promise.resolve(randomLegalMove(session.game)) : chooseMove(positionOf(session.game), session.opponent.play)).catch(error => {
    console.error(error);
    setState({
      engine: {
        ...state.engine,
        state: "failed"
      }
    });
    return null;
  });
  if (!uci) return;
  const wait = config.engine.minThinkMs - (performance.now() - started);
  if (wait > 0) await pause(wait);
  if (!isCurrent(id)) return;
  const facts = await commit(id, uci);
  if (facts && (await afterMove(id, facts))) patchSession({
    phase: "yours"
  });
}
const lessonAnswer = async (id, uci) => {
  const session = state.session;
  if (!session?.lesson) return;
  const step = session.lesson.steps[session.stepIndex];
  const right = step.accept.includes(uci);
  const facts = await commit(id, uci);
  if (!facts || !isCurrent(id)) return;
  if (!right) {
    // The engine answers the wrong try, so the mistake shows its consequence.
    patchSession({
      coachThinking: true
    });
    const current = state.session;
    const line = current && !endingOf(current.game, current.rules) ? await evaluate(positionOf(current.game), config.engine.hintMs) : null;
    if (!isCurrent(id)) return;
    const answered = line ? await commit(id, line.uci) : null;
    if (!isCurrent(id)) return;
    patchSession({
      phase: "coach-wrong",
      coachThinking: false,
      coachLine: step.wrong,
      wrongPlies: answered ? 2 : 1
    });
    return;
  }
  patchSession({
    phase: "coach-right",
    coachLine: step.praise
  });
};
export const lessonNext = async () => {
  const session = state.session;
  if (!session?.lesson || session.phase !== "coach-right") return;
  const {
    id,
    lesson,
    stepIndex
  } = session;
  const step = lesson.steps[stepIndex];
  if (step.reply) {
    patchSession({
      phase: "moving"
    });
    await commit(id, step.reply);
    if (!isCurrent(id)) return;
  }
  const nextIndex = stepIndex + 1;
  if (nextIndex >= lesson.steps.length) {
    const lessonsDone = [...new Set([...state.profile.lessonsDone, lesson.id])];
    saveProfile({
      lessonsDone
    });
    patchSession({
      phase: "coach-done",
      coachLine: lesson.takeaway
    });
    return;
  }
  patchSession({
    phase: "yours",
    stepIndex: nextIndex,
    coachLine: lesson.steps[nextIndex].prompt
  });
};
export const lessonRetry = () => {
  const session = state.session;
  if (!session?.lesson || session.phase !== "coach-wrong") return;
  const game = replayTo(session.game, session.game.history.length - session.wrongPlies);
  const step = session.lesson.steps[session.stepIndex];
  patchSession({
    game,
    phase: "yours",
    coachLine: step.prompt
  });
  showSessionOnStage();
};
export const lessonPlayOut = () => {
  const session = state.session;
  if (!session?.lesson) return;
  const opponent = state.opponents[Math.min(4, state.opponents.length - 1)];
  patchSession({
    mode: "casual",
    opponent,
    lesson: null,
    coachLine: null,
    phase: "yours"
  });
  if (turnOf(session.game) !== session.you) void engineTurn(session.id);
};
async function playerMoves(uci) {
  const session = state.session;
  if (!session) return;
  const {
    id
  } = session;
  if (session.mode === "lesson") {
    await lessonAnswer(id, uci);
    return;
  }
  const facts = await commit(id, uci);
  if (!facts || !(await afterMove(id, facts))) return;
  if (cheats.hotseat) {
    const current = state.session;
    if (current) patchSession({
      you: turnOf(current.game),
      phase: "yours"
    });
    return;
  }
  await engineTurn(id);
}
// -----------------------------------------------------------------------------
// Help, takebacks and resignation
// -----------------------------------------------------------------------------
export const askHint = async () => {
  const session = state.session;
  if (!canMoveNow(session) || !session.rules.hints) return;
  const {
    id,
    game
  } = session;
  patchSession({
    hintPending: true
  });
  const line = await evaluate(positionOf(game), config.engine.hintMs);
  if (isCurrent(id) && !line) patchSession({
    hintPending: false
  });
  if (!line || !isCurrent(id)) return;
  const names = "abcdefgh";
  const square = text => names.indexOf(text[0]) + (Number(text[1]) - 1) * 8;
  patchSession({
    hintPending: false,
    hint: {
      from: square(line.uci.slice(0, 2)),
      to: square(line.uci.slice(2, 4))
    }
  });
};
export const takeBack = () => {
  const session = state.session;
  if (!canMoveNow(session) || !session.rules.takebacks || session.game.history.length < 2) return;
  const length = session.game.history.length - 2;
  patchSession({
    game: replayTo(session.game, length),
    evals: session.evals.slice(0, length),
    selected: null,
    hint: null,
    announcement: "Took back your last move."
  });
  showSessionOnStage();
};
export const resign = () => {
  const session = state.session;
  if (!session || session.phase === "over") return;
  stage?.skip();
  void finish(session.id, {
    kind: "resignation",
    winner: opposite(session.you)
  });
};
export const skipScene = () => stage?.skip();
// -----------------------------------------------------------------------------
// Test panel
// -----------------------------------------------------------------------------
export const cheatEnd = result => {
  const {
    session
  } = state;
  if (!session || session.phase === "over") return;
  stage?.skip();
  const ending = result === "draw" ? {
    kind: "agreement"
  } : {
    kind: "resignation",
    winner: result === "win" ? session.you : opposite(session.you)
  };
  void finish(session.id, ending);
};
export const cheatBestMove = async () => {
  const {
    session
  } = state;
  if (!canMoveNow(session)) return;
  const answer = session.lesson?.steps[session.stepIndex].accept[0];
  const uci = answer ?? (await evaluate(positionOf(session.game), config.engine.hintMs))?.uci;
  if (uci && isCurrent(session.id)) void playerMoves(uci);
};
export const retryEngine = () => {
  const {
    session
  } = state;
  setState({
    engine: {
      state: "idle",
      loaded: 0,
      total: 0
    }
  });
  warmEngine();
  if (session?.phase === "thinking") void engineTurn(session.id);
};
// -----------------------------------------------------------------------------
// Clocks
// -----------------------------------------------------------------------------
const CLOCK_STEP = 0.25;
setInterval(() => {
  const session = state.session;
  if (state.stage.busy || !session?.clocks || !["yours", "thinking", "promoting"].includes(session.phase)) return;
  const side = turnOf(session.game);
  const left = session.clocks[side] - CLOCK_STEP;
  patchSession({
    clocks: {
      ...session.clocks,
      [side]: Math.max(0, left)
    }
  });
  if (left <= 0) void finish(session.id, {
    kind: "timeout",
    winner: opposite(side)
  });
}, CLOCK_STEP * 1000);
export { currentFen };