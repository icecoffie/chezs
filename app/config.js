/*!
 * Chess
 * Copyright (c) Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a19e25-e438-75a3-a372-c9c67de14514
 */
export const config = {
  storageKey: "chess.profile.v1",
  // Raise the version whenever a stored file changes; older caches are deleted at startup.
  assetCache: "chess-assets-v2",
  data: {
    worlds: "./data/worlds.json",
    opponents: "./data/opponents.json",
    lessons: "./data/lessons.json",
    pieces: "./data/art/staunton.glb"
  },
  engine: {
    wasm: "stockfish/bin/stockfish-19-lite-single.wasm",
    script: "stockfish/bin/stockfish-19-lite-single.js",
    hashMb: 32,
    minThinkMs: 650,
    analysisMs: 110,
    hintMs: 500,
    mateScore: 3000
  },
  // Files live in Asset Hosting away from localhost; /pen-assets sync chess uploads them.
  assets: {
    local: "/pens/chess/assets/",
    hosted: "https://assets.codepen.io/6234/",
    prefix: "chess--",
    carving: "club-room",
    // The Club Room's dark wood scan, read as grain for frames.
    wood: {
      low: 0.004,
      high: 0.06
    },
    // A clean, seamless patch of the scanned marble in the Club Room's board map.
    stone: {
      min: [0.125, 0.37],
      size: 0.505,
      low: 0.006,
      high: 0.055
    }
  },
  paint: {
    pieces: 1536,
    board: 2048,
    carvedRoughness: 0.5,
    crevices: 0.85,
    clearcoatRoughness: 0.42,
    darkSpecular: 0.4,
    footDark: 0.42,
    footReach: 0.3,
    grooveLow: 0.45,
    grooveHigh: 0.82,
    inlayWidth: 0.014,
    bleedPixels: 4
  },
  scan: {
    anisotropy: 8,
    clearcoatRoughness: 0.22,
    roomTargets: 4,
    shadowOpacity: 0.38,
    reflectionDepth: 0.75,
    backdropFocus: 0.14,
    backdropSize: 1024,
    backdropLimit: 0.3,
    brokenGrain: 9,
    frameLift: 1.1,
    stylesKept: 2,
    brokenRoughness: 0.5
  },
  contact: {
    pawn: 0.5,
    knight: 0.62,
    bishop: 0.56,
    rook: 0.62,
    queen: 0.66,
    king: 0.68,
    strength: 0.72,
    liftFade: 0.5
  },
  layout: {
    narrow: 860,
    roomy: 1100,
    phoneTop: 58,
    phoneBottom: 112,
    cardGap: 24
  },
  bake: {
    tableSpan: 28
  },
  glow: {
    divide: 8,
    gatherReach: 3,
    limit: 4
  },
  quality: {
    pixelBudget: 1400000,
    maxDpr: 2,
    minLiveScale: 0.25,
    cutsceneScale: 0.5,
    slowFrameMs: 48,
    sampleFrames: 60,
    cooldownMs: 10000,
    stepDown: 0.85
  },
  board: {
    square: 0.6093,
    frame: 0.474,
    thickness: 0.2,
    tableDrop: 0.2
  },
  camera: {
    fov: 32,
    polarPlay: 0.44,
    polarLadder: 0.88,
    azimuthLadder: 0.62,
    ladderRoom: 1.28,
    fitMargin: 1
  },
  motion: {
    moveSeconds: 0.36,
    knightHop: 0.42,
    settleSeconds: 0.12,
    resetSeconds: 0.7
  },
  ladder: {
    pointsToAdvance: 1,
    pieceValue: {
      pawn: 1,
      knight: 3,
      bishop: 3,
      rook: 5,
      queen: 9,
      king: 0
    }
  },
  clocks: {
    "5+3": {
      base: 300,
      increment: 3
    },
    "10+0": {
      base: 600,
      increment: 0
    },
    "15+10": {
      base: 900,
      increment: 10
    },
    "30+0": {
      base: 1800,
      increment: 0
    }
  },
  defaults: {
    version: 1,
    rung: 0,
    points: 0,
    games: 0,
    lessonsDone: [],
    lastWorld: null,
    rules: {
      start: "standard",
      odds: "none",
      clock: "none",
      takebacks: true,
      hints: true,
      repetition: "threefold",
      moveLimit: "fifty",
      promotion: "choose"
    },
    settings: {
      cutscenes: "big",
      coordinates: true,
      moveHints: true
    },
    style: "match"
  }
};