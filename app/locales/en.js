/*!
 * Chess
 * Copyright (c) Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a19e25-e438-75a3-a372-c9c67de14514
 */
export const en = {
  pageTitle: "Chess",
  loading: {
    preparing: place => `Setting up ${place}`,
    board: "Setting up the board…",
    engine: percent => `Bringing in the engine, ${percent}%. This happens only once.`,
    engineFirst: "Bringing in the engine. This happens only once.",
    engineReady: "Engine ready.",
    engineFailed: "The engine couldn't load. Check your connection and try again."
  },
  controls: {
    previous: label => `Previous ${label}`,
    next: label => `Next ${label}`
  },
  errors: {
    title: "The board was knocked over",
    retry: "Set it up again"
  },
  ladder: {
    heading: "The Ranks",
    rankWord: "Rank",
    rankOf: rank => `Rank ${rank} of 8`,
    casualWith: name => `Play ${name} for fun`,
    challenge: name => `Sit down with ${name}`,
    promoted: "You hold the eighth rank",
    championLine: "Your pawn has promoted. Every opponent is still yours to play in a casual game.",
    casual: "Casual game",
    study: "Study",
    settings: "Settings",
    halfPoint: "½ point banked from a draw. One more draw or a win advances you.",
    beaten: "Beaten",
    next: "Next",
    ahead: "Ahead"
  },
  setup: {
    heading: "Casual game",
    opponent: "Across the board",
    side: "You play",
    sides: {
      white: "White",
      lots: "Draw lots",
      black: "Black"
    },
    style: "Style",
    shuffle: "Somewhere new",
    start: "Sit down",
    back: "Back to the ranks"
  },
  style: {
    heading: "Style",
    note: "A style sets the board, the pieces and the room together. Left on Match the game, every game brings its own. Pick one to keep it.",
    match: "Match the game",
    pick: "Play in"
  },
  rules: {
    heading: "House rules",
    start: {
      label: "Starting position",
      options: {
        standard: "Standard",
        chess960: "Chess960"
      }
    },
    odds: {
      label: "Piece odds",
      options: {
        none: "Even",
        "they-knight": "They give a knight",
        "they-rook": "They give a rook",
        "they-queen": "They give a queen",
        "you-knight": "You give a knight",
        "you-rook": "You give a rook",
        "you-queen": "You give a queen"
      }
    },
    clock: {
      label: "Clock",
      none: "No clock"
    },
    takebacks: "Takebacks",
    hints: "Hints",
    repetition: {
      label: "Draw by repetition",
      options: {
        threefold: "Threefold",
        fivefold: "Fivefold"
      }
    },
    moveLimit: {
      label: "Draw without progress",
      options: {
        fifty: "50 moves",
        "seventy-five": "75 moves"
      }
    },
    promotion: {
      label: "Promotion",
      options: {
        choose: "Ask me",
        "auto-queen": "Always a queen"
      }
    },
    climbNote: "Climbing the ranks always starts from the standard position, at even odds."
  },
  settings: {
    heading: "Settings",
    cutscenes: {
      label: "Cutscenes",
      note: "Short scenes after major events. Any scene can be skipped with a click or a key.",
      options: {
        off: "Off",
        big: "Big moments",
        captures: "Every capture"
      }
    },
    coordinates: "Coordinates on the board",
    moveHints: "Show legal moves",
    progress: "Your climb",
    reset: "Start the climb over",
    resetConfirm: "Yes, back to rank 1",
    resetCancel: "Keep my rank",
    resetDone: "Your pawn is back on rank 1.",
    on: "On",
    off: "Off"
  },
  study: {
    heading: "Study",
    intro: "Strategy, played out on the board. Find the plan; a wrong try gets answered by the engine so you can see why.",
    done: "Studied",
    progress: (done, total) => `${done} of ${total} studied`,
    moves: count => count === 1 ? "1 move to find" : `${count} moves to find`
  },
  table: {
    you: "You",
    thinking: name => `${name} is thinking`,
    taken: "Captured",
    yourMove: "Your move",
    openingMove: "Your move. Drag a piece, or tap it and then a square.",
    scoresheet: "Scoresheet",
    noMoves: "No moves yet.",
    hint: "Hint",
    takeBack: "Take back",
    resign: "Resign",
    style: "Style",
    styleNote: "For this game only.",
    findingHint: "Looking for a good move…",
    coachThinking: "Let's see how that plays out…",
    resignConfirm: "Tip your king?",
    resignNote: "This ends the game as a loss.",
    keepPlaying: "Keep playing",
    leave: "Leave table",
    typeMove: "Type a move",
    typePlaceholder: "Nf3",
    typeRejected: text => `${text} isn't a legal move here.`,
    skip: "Skip",
    promote: "Promote to",
    cancel: "Cancel",
    boardLabel: "Chessboard. Arrow keys move between squares; Enter picks up or places a piece.",
    empty: "empty",
    pieceName: (color, role) => `${color} ${role}`,
    roles: {
      pawn: "pawn",
      knight: "knight",
      bishop: "bishop",
      rook: "rook",
      queen: "queen",
      king: "king"
    }
  },
  coach: {
    kicker: "Coach",
    next: "Continue",
    finish: "See the idea",
    retry: "Take it back",
    playOut: "Play it out from here",
    allLessons: "All lessons",
    stepOf: (step, total) => `Move ${step} of ${total}`
  },
  routes: {
    lost: "No such table",
    lostNote: "That opponent or lesson isn't in the hall.",
    home: "Back to the ranks"
  },
  cheats: {
    notice: labels => `Cheats on: ${labels || "none"}. Progress isn't being saved.`,
    rejected: tokens => ` Ignored: ${tokens}.`,
    panel: "Test panel",
    best: "Best move",
    win: "Win",
    lose: "Lose",
    draw: "Draw"
  },
  scenes: {
    checkmate: () => "Checkmate",
    promotion: () => "Promotion",
    "queen-falls": attacker => `The queen falls to the ${attacker}`,
    sacrifice: attacker => `The ${attacker} gives itself up`,
    "en-passant": () => "En passant",
    capture: (attacker, victim) => `The ${attacker} takes the ${victim}`,
    castle: () => "Castled",
    check: () => "Check"
  },
  result: {
    won: "You won",
    lost: "You lost",
    drawn: "A draw",
    how: {
      checkmate: "by checkmate",
      timeout: "on time",
      resignation: "by resignation",
      stalemate: "by stalemate",
      insufficient: "with too little left to mate",
      repetition: "by repetition",
      "move-limit": "with no progress made",
      agreement: "by agreement"
    },
    advanced: rank => `Your pawn advances to rank ${rank}.`,
    promotedAll: "Your pawn reaches the eighth rank and promotes.",
    halfNote: "Half a point banked toward the next rank.",
    nextOpponent: "Next opponent",
    rematch: "Play again",
    ladder: "Back to the ranks",
    another: "New casual game",
    chartTitle: "How the game turned",
    chartSummary: turn => `The biggest swing came at ${turn}.`,
    chartFlat: "The game stayed level throughout.",
    white: "White better",
    black: "Black better"
  }
};