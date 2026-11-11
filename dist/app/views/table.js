import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/*!
 * Chess
 * Copyright (c) Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a19e25-e438-75a3-a372-c9c67de14514
 */
// Intended use: the table during play: player plates and clocks, the scoresheet, commands, coach, cutscene caption, result slip, promotion choice and the keyboard board.
import gsap from "gsap";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button, ButtonLink } from "../components/controls.js";
import { BackIcon, HintIcon, PieceIcon, ResignIcon, ScoresheetIcon, SkipIcon, StyleIcon, TakeBackIcon } from "../components/icons.js";
import { Stack } from "../components/layout.js";
import { opposite, parseTyped, pieceAt, squareName, turnOf } from "../chess/game.js";
import { en } from "../locales/en.js";
import { cheats } from "../state/cheats.js";
import { formatClock, prefersReducedMotion } from "../lib/utils.js";
import { askHint, cheatBestMove, cheatEnd, choosePromotion, focusSquare, lessonNext, lessonPlayOut, lessonRetry, playTyped, rematch, resign, retryEngine, skipScene, startClimb, takeBack, tapSquare, updateGameStyle, useStore } from "../state/store.js";
import { config } from "../config.js";
import { stageHandle } from "../scene/board-canvas.js";
import { StylePicker } from "./style-panel.js";
// -----------------------------------------------------------------------------
// Plates: who is sitting where, what they've taken, and whose move it is
// -----------------------------------------------------------------------------
const pieceValue = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 0
};
const takenBy = (history, side) => history.filter(facts => facts.color === side && facts.captured).map(facts => facts.captured.role).sort((a, b) => pieceValue[b] - pieceValue[a]);
const worth = roles => roles.reduce((sum, role) => sum + pieceValue[role], 0);
const Plate = ({
  name,
  detail,
  role,
  seconds,
  active,
  line,
  place,
  taken,
  lead
}) => _jsxs("div", {
  className: `corner ${place} plate${active ? " is-active" : ""}`,
  children: [_jsx("span", {
    className: "plate-medal",
    "aria-hidden": "true",
    children: _jsx(PieceIcon, {
      role: role,
      size: 20
    })
  }), _jsxs("span", {
    className: "plate-text",
    children: [_jsx("span", {
      className: "plate-name",
      children: name
    }), _jsx("span", {
      className: "plate-detail",
      children: detail
    }), taken.length ? _jsxs("span", {
      className: "plate-taken",
      "aria-label": en.table.taken,
      children: [taken.map((piece, index) => _jsx(PieceIcon, {
        role: piece,
        size: 12
      }, index)), lead > 0 ? _jsxs("span", {
        className: "plate-lead",
        children: ["+", lead]
      }) : null]
    }) : null, _jsx("span", {
      className: "plate-line",
      role: "status",
      children: line
    })]
  }), seconds !== null ? _jsx("span", {
    className: seconds < 30 ? "plate-clock is-low" : "plate-clock",
    children: formatClock(seconds)
  }) : null]
});
// -----------------------------------------------------------------------------
// Scoresheet
// -----------------------------------------------------------------------------
const Scoresheet = ({
  history
}) => {
  const end = useRef(null);
  useEffect(() => {
    if (end.current) end.current.scrollTop = end.current.scrollHeight;
  }, [history.length]);
  const blackFirst = history[0]?.color === "black";
  const paired = blackFirst ? [null, ...history] : history;
  const rows = paired.flatMap((_, i) => i % 2 === 0 ? [[paired[i], paired[i + 1]]] : []);
  if (!history.length) return _jsx("p", {
    className: "note",
    children: en.table.noMoves
  });
  return _jsx("ol", {
    className: "scoresheet",
    ref: end,
    "aria-label": en.table.scoresheet,
    children: rows.map(([white, black], i) => _jsxs("li", {
      className: "score-row",
      children: [_jsx("span", {
        className: "score-number",
        children: i + 1
      }), _jsx("span", {
        className: "score-move",
        children: white?.san ?? "…"
      }), _jsx("span", {
        className: "score-move",
        children: black?.san ?? ""
      })]
    }, i))
  });
};
// -----------------------------------------------------------------------------
// Typed moves
// -----------------------------------------------------------------------------
const TypedMove = ({
  session
}) => {
  const [text, setText] = useState("");
  const [rejected, setRejected] = useState(null);
  const submit = event => {
    event.preventDefault();
    const uci = parseTyped(session.game, text);
    if (uci && playTyped(uci)) {
      setText("");
      setRejected(null);
    } else if (text.trim()) {
      setRejected(en.table.typeRejected(text.trim()));
    }
  };
  return _jsxs("form", {
    className: "typed",
    onSubmit: submit,
    children: [_jsxs("label", {
      children: [_jsx("span", {
        children: en.table.typeMove
      }), _jsx("input", {
        value: text,
        onChange: event => setText(event.target.value),
        placeholder: en.table.typePlaceholder,
        autoComplete: "off",
        autoCapitalize: "off",
        spellCheck: false
      })]
    }), rejected ? _jsx("p", {
      className: "note note-alert",
      role: "alert",
      children: rejected
    }) : null]
  });
};
// -----------------------------------------------------------------------------
// Keyboard board
// -----------------------------------------------------------------------------
const KeyboardBoard = ({
  session
}) => {
  const [cursor, setCursor] = useState(session.you === "white" ? 4 : 60);
  const refs = useRef(new Map());
  const rankOrder = session.you === "white" ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const fileOrder = session.you === "white" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const onKey = (event, square) => {
    const sign = session.you === "white" ? 1 : -1;
    const delta = {
      ArrowUp: 8 * sign,
      ArrowDown: -8 * sign,
      ArrowLeft: -1 * sign,
      ArrowRight: 1 * sign
    };
    const step = delta[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const next = square + step;
    const sameRow = Math.abs(step) !== 1 || Math.floor(next / 8) === Math.floor(square / 8);
    if (next >= 0 && next < 64 && sameRow) {
      setCursor(next);
      refs.current.get(next)?.focus();
    }
  };
  const describe = square => {
    const piece = pieceAt(session.game, square);
    return `${squareName(square)}, ${piece ? en.table.pieceName(piece.color, en.table.roles[piece.role]) : en.table.empty}`;
  };
  return _jsx("div", {
    className: "keyboard-board",
    role: "grid",
    "aria-label": en.table.boardLabel,
    children: rankOrder.map(rank => _jsx("div", {
      role: "row",
      children: fileOrder.map(file => {
        const square = rank * 8 + file;
        return _jsx("span", {
          role: "gridcell",
          children: _jsx("button", {
            type: "button",
            ref: element => {
              if (element) refs.current.set(square, element);
            },
            tabIndex: square === cursor ? 0 : -1,
            "aria-label": describe(square),
            "aria-pressed": session.selected === square,
            onFocus: () => {
              setCursor(square);
              focusSquare(square);
            },
            onBlur: () => focusSquare(null),
            onClick: () => tapSquare(square),
            onKeyDown: event => onKey(event, square)
          })
        }, square);
      })
    }, rank))
  });
};
// -----------------------------------------------------------------------------
// Promotion
// -----------------------------------------------------------------------------
const promotions = ["queen", "rook", "bishop", "knight"];
const PromotionChoice = () => _jsx("div", {
  className: "dialog-scrim",
  children: _jsxs("div", {
    className: "dialog",
    role: "dialog",
    "aria-label": en.table.promote,
    children: [_jsx("h2", {
      className: "dialog-title",
      children: en.table.promote
    }), _jsx("div", {
      className: "promotion-pieces",
      children: promotions.map(role => _jsxs("button", {
        type: "button",
        className: "promotion-piece",
        onClick: () => choosePromotion(role),
        children: [_jsx(PieceIcon, {
          role: role,
          size: 34
        }), _jsx("span", {
          children: en.table.roles[role]
        })]
      }, role))
    }), _jsx(Button, {
      kind: "plain",
      onClick: () => choosePromotion(null),
      children: en.table.cancel
    })]
  })
});
// -----------------------------------------------------------------------------
// Cutscene caption
// -----------------------------------------------------------------------------
const Caption = ({
  session
}) => {
  const ref = useRef(null);
  const last = session.game.history[session.game.history.length - 1];
  const {
    scene
  } = session;
  useLayoutEffect(() => {
    if (!ref.current || prefersReducedMotion()) return;
    gsap.fromTo(ref.current, {
      y: 14,
      opacity: 0
    }, {
      y: 0,
      opacity: 1,
      duration: 0.3,
      ease: "power2.out"
    });
  }, [scene]);
  useEffect(() => {
    if (scene === "none") return undefined;
    const onKey = () => skipScene();
    const onPointer = event => {
      if (event.target instanceof HTMLCanvasElement) skipScene();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [scene]);
  if (scene === "none" || !last) return null;
  const attacker = en.table.roles[last.role];
  const victim = last.captured ? en.table.roles[last.captured.role] : "";
  return _jsxs(_Fragment, {
    children: [_jsx("div", {
      className: "letterbox letterbox-top",
      "aria-hidden": "true"
    }), _jsx("div", {
      className: "letterbox letterbox-bottom",
      "aria-hidden": "true"
    }), _jsxs("div", {
      className: "caption",
      ref: ref,
      children: [_jsx("p", {
        children: en.scenes[scene](attacker, victim)
      }), _jsx(Button, {
        kind: "plain",
        icon: _jsx(SkipIcon, {}),
        onClick: skipScene,
        children: en.table.skip
      })]
    })]
  });
};
// -----------------------------------------------------------------------------
// Coach
// -----------------------------------------------------------------------------
const Coach = ({
  session
}) => {
  const {
    lesson,
    phase,
    stepIndex,
    coachLine
  } = session;
  if (!lesson) return null;
  const isLast = stepIndex + 1 >= lesson.steps.length;
  return _jsxs(Stack, {
    as: "section",
    className: "coach",
    gap: "tight",
    "aria-live": "polite",
    children: [_jsxs("span", {
      className: "coach-kicker",
      children: [en.coach.kicker, " \u00B7", " ", en.coach.stepOf(Math.min(stepIndex + 1, lesson.steps.length), lesson.steps.length)]
    }), _jsx("h2", {
      className: "coach-title",
      children: lesson.title
    }), _jsx("p", {
      className: phase === "coach-wrong" ? "coach-line is-wrong" : "coach-line",
      children: coachLine
    }), phase === "coach-right" ? _jsx(Button, {
      kind: "primary",
      onClick: () => void lessonNext(),
      children: isLast ? en.coach.finish : en.coach.next
    }) : null, phase === "coach-wrong" ? _jsx(Button, {
      kind: "primary",
      icon: _jsx(TakeBackIcon, {}),
      onClick: lessonRetry,
      children: en.coach.retry
    }) : null, phase === "coach-done" ? _jsxs(Stack, {
      direction: "row",
      gap: "tight",
      wrap: true,
      children: [_jsx(Button, {
        kind: "primary",
        onClick: lessonPlayOut,
        children: en.coach.playOut
      }), _jsx(ButtonLink, {
        to: "/study",
        children: en.coach.allLessons
      })]
    }) : null]
  });
};
// -----------------------------------------------------------------------------
// Result slip with the evaluation line
// -----------------------------------------------------------------------------
const CHART = {
  width: 300,
  height: 76,
  cap: 600
};
const EvalChart = ({
  session
}) => {
  const evals = session.evals.flatMap((value, ply) => typeof value === "number" ? [{
    value,
    ply
  }] : []);
  if (evals.length < 2) return null;
  const last = session.game.history.length - 1;
  const x = ply => ply / Math.max(1, last) * CHART.width;
  const y = value => CHART.height / 2 - Math.max(-CHART.cap, Math.min(CHART.cap, value)) / CHART.cap * (CHART.height / 2 - 3);
  const line = evals.map(({
    value,
    ply
  }) => `${x(ply).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
  const swings = evals.slice(1).map((entry, i) => ({
    ...entry,
    swing: Math.abs(entry.value - evals[i].value)
  }));
  const biggest = swings.reduce((best, entry) => entry.swing > best.swing ? entry : best, swings[0]);
  const flat = biggest.swing < 120;
  const facts = session.game.history[biggest.ply];
  const moveLabel = facts ? `${Math.floor(biggest.ply / 2) + 1}${facts.color === "white" ? "." : "…"} ${facts.san}` : "";
  const summary = flat ? en.result.chartFlat : en.result.chartSummary(moveLabel);
  return _jsxs("figure", {
    className: "eval",
    children: [_jsx("figcaption", {
      children: en.result.chartTitle
    }), _jsxs("svg", {
      viewBox: `0 0 ${CHART.width} ${CHART.height}`,
      role: "img",
      "aria-label": summary,
      children: [_jsx("line", {
        className: "eval-zero",
        x1: "0",
        x2: CHART.width,
        y1: CHART.height / 2,
        y2: CHART.height / 2
      }), _jsx("polyline", {
        className: "eval-line",
        points: line
      }), flat ? null : _jsx("circle", {
        className: "eval-mark",
        cx: x(biggest.ply),
        cy: y(biggest.value),
        r: "3.5"
      })]
    }), _jsx("p", {
      className: "note",
      children: summary
    })]
  });
};
const RematchLink = ({
  session
}) => session.mode === "casual" && session.opponent ? _jsx(ButtonLink, {
  kind: "primary",
  to: "/casual/$opponentId",
  params: {
    opponentId: session.opponent.id
  },
  search: {
    side: opposite(session.you),
    style: "shuffle"
  },
  children: en.result.rematch
}) : _jsx(Button, {
  kind: "primary",
  onClick: rematch,
  children: en.result.rematch
});
const ResultSlip = ({
  session
}) => {
  const {
    outcome,
    ending,
    mode,
    opponent,
    promoted
  } = session;
  const rung = useStore(state => state.profile.rung);
  const points = useStore(state => state.profile.points);
  if (!ending || !outcome) return null;
  const heading = en.result[outcome];
  const quote = opponent ? outcome === "won" ? opponent.onLoss : outcome === "lost" ? opponent.onWin : null : null;
  return _jsxs(Stack, {
    as: "section",
    className: "result",
    gap: "line",
    "aria-live": "polite",
    children: [_jsx("h2", {
      className: "result-title",
      children: heading
    }), _jsx("p", {
      className: "result-how",
      children: en.result.how[ending.kind]
    }), quote && opponent ? _jsxs("blockquote", {
      className: "result-quote",
      children: ["\u201C", quote, "\u201D", _jsx("cite", {
        children: opponent.name
      })]
    }) : null, mode === "climb" && promoted ? _jsx("p", {
      className: "result-rank",
      children: rung >= 8 ? en.result.promotedAll : en.result.advanced(rung + 1)
    }) : null, mode === "climb" && !promoted && points > 0 ? _jsx("p", {
      className: "note",
      children: en.result.halfNote
    }) : null, _jsx(EvalChart, {
      session: session
    }), _jsxs(Stack, {
      direction: "row",
      gap: "tight",
      wrap: true,
      children: [mode === "climb" && promoted && rung < 8 ? _jsx(Button, {
        kind: "primary",
        onClick: startClimb,
        children: en.result.nextOpponent
      }) : _jsx(RematchLink, {
        session: session
      }), _jsx(ButtonLink, {
        to: "/",
        children: en.result.ladder
      })]
    })]
  });
};
// -----------------------------------------------------------------------------
// Test panel, shown only while the ?cheat= parameter is in use
// -----------------------------------------------------------------------------
const CheatPanel = ({
  session
}) => {
  const over = session.phase === "over" || session.ending !== null;
  return _jsxs(Stack, {
    as: "section",
    className: "cheat-panel",
    gap: "hair",
    "aria-label": en.cheats.panel,
    children: [_jsx("span", {
      className: "coach-kicker",
      children: en.cheats.panel
    }), _jsxs(Stack, {
      direction: "row",
      gap: "hair",
      wrap: true,
      children: [_jsx(Button, {
        disabled: session.phase !== "yours",
        onClick: () => void cheatBestMove(),
        children: en.cheats.best
      }), _jsx(Button, {
        disabled: over,
        onClick: () => cheatEnd("win"),
        children: en.cheats.win
      }), _jsx(Button, {
        disabled: over,
        onClick: () => cheatEnd("lose"),
        children: en.cheats.lose
      }), _jsx(Button, {
        disabled: over,
        onClick: () => cheatEnd("draw"),
        children: en.cheats.draw
      })]
    })]
  });
};
// -----------------------------------------------------------------------------
// The table
// -----------------------------------------------------------------------------
const statusLine = session => {
  if (session.hintPending) return en.table.findingHint;
  if (session.phase === "yours") return session.game.history.length ? en.table.yourMove : en.table.openingMove;
  return "";
};
const clockFor = (session, side) => session.clocks?.[side] ?? null;
// -----------------------------------------------------------------------------
// Keeping the board clear of whatever is on screen
// -----------------------------------------------------------------------------
const useTableInsets = (card, hasCard) => {
  useEffect(() => {
    const measure = () => {
      const narrow = window.innerWidth < config.layout.narrow;
      const height = card.current?.getBoundingClientRect().height ?? 0;
      const width = card.current?.getBoundingClientRect().width ?? 0;
      const roomy = window.innerWidth >= config.layout.roomy;
      stageHandle.current?.setInsets({
        top: narrow ? config.layout.phoneTop : 0,
        bottom: narrow ? config.layout.phoneBottom + (hasCard ? height : 0) : 0,
        left: !narrow && hasCard && !roomy ? width + config.layout.cardGap : 0,
        right: 0
      });
    };
    measure();
    const retry = setInterval(measure, 500);
    window.addEventListener("resize", measure);
    return () => {
      clearInterval(retry);
      window.removeEventListener("resize", measure);
    };
  }, [card, hasCard]);
};
const lastMoveText = history => {
  const last = history[history.length - 1];
  if (!last) return "";
  const number = Math.ceil(history.length / 2);
  return last.color === "white" ? `${number}. ${last.san}` : `${number}… ${last.san}`;
};
export const TableView = () => {
  const session = useStore(state => state.session);
  // A route starts its game just after mounting, and the table needs that game to draw.
  return session ? _jsx(Table, {
    session: session
  }) : null;
};
const Table = ({
  session
}) => {
  const engine = useStore(state => state.engine);
  const stageBusy = useStore(state => state.stage.busy);
  const [panel, setPanel] = useState(null);
  const card = useRef(null);
  const {
    opponent,
    you,
    game,
    phase,
    mode,
    rules
  } = session;
  const them = you === "white" ? "black" : "white";
  const turn = turnOf(game);
  const inScene = session.scene !== "none";
  const playing = mode !== "lesson" && phase !== "over" && !session.ending;
  const hasCard = mode === "lesson" || phase === "over";
  useTableInsets(card, hasCard);
  useEffect(() => {
    const onKey = event => {
      if (event.key === "Escape") setPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const toggle = next => setPanel(panel === next ? null : next);
  const percent = engine.total ? Math.round(engine.loaded / engine.total * 100) : 0;
  const engineLine = engine.state === "loading" && percent < 100 ? en.loading.engine(percent) : "";
  const theirLine = engineLine || (phase === "thinking" && opponent ? en.table.thinking(opponent.name.split(" ")[0]) : game.history.length === 0 && opponent ? `“${opponent.greeting}”` : "");
  const theyTook = takenBy(game.history, them);
  const youTook = takenBy(game.history, you);
  const lead = worth(youTook) - worth(theyTook);
  return _jsxs(_Fragment, {
    children: [_jsxs("div", {
      className: inScene ? "perimeter is-scene" : "perimeter",
      children: [opponent ? _jsx(Plate, {
        place: "corner-top-left",
        name: opponent.name,
        detail: `${opponent.title} · ${opponent.rating}`,
        role: opponent.figure,
        seconds: clockFor(session, them),
        active: turn === them && phase !== "over",
        line: theirLine,
        taken: theyTook,
        lead: -lead
      }) : null, opponent ? _jsx(Plate, {
        place: "corner-bottom-left",
        name: en.table.you,
        detail: session.world.name,
        role: "king",
        seconds: clockFor(session, you),
        active: turn === you && phase !== "over",
        line: statusLine(session),
        taken: youTook,
        lead: lead
      }) : null, hasCard ? _jsxs(Stack, {
        as: "section",
        ref: card,
        className: "side-card",
        gap: "line",
        pad: "block",
        children: [session.coachThinking ? _jsx("p", {
          className: "seat-line",
          role: "status",
          children: en.table.coachThinking
        }) : null, phase === "over" ? _jsx(ResultSlip, {
          session: session
        }) : null, _jsx(Coach, {
          session: session
        })]
      }) : null, _jsxs("nav", {
        className: "rail",
        "aria-label": en.table.scoresheet,
        children: [mode !== "lesson" ? _jsx(Button, {
          icon: _jsx(ScoresheetIcon, {}),
          label: en.table.scoresheet,
          onClick: () => toggle("scoresheet")
        }) : null, _jsx(Button, {
          icon: _jsx(StyleIcon, {}),
          label: en.table.style,
          disabled: stageBusy,
          onClick: () => toggle("style")
        }), playing && rules.hints ? _jsx(Button, {
          icon: _jsx(HintIcon, {}),
          label: en.table.hint,
          disabled: phase !== "yours" || session.hintPending,
          onClick: () => void askHint()
        }) : null, playing && rules.takebacks ? _jsx(Button, {
          icon: _jsx(TakeBackIcon, {}),
          label: en.table.takeBack,
          disabled: phase !== "yours" || game.history.length < 2,
          onClick: takeBack
        }) : null, playing ? _jsx(Button, {
          icon: _jsx(ResignIcon, {}),
          label: en.table.resign,
          onClick: () => toggle("resign")
        }) : null, mode === "lesson" ? _jsx(ButtonLink, {
          icon: _jsx(BackIcon, {}),
          to: "/study",
          "aria-label": en.table.leave,
          title: en.table.leave
        }) : null]
      }), panel === "scoresheet" ? _jsxs(Stack, {
        as: "aside",
        className: "drawer",
        gap: "line",
        pad: "line",
        "aria-label": en.table.scoresheet,
        children: [_jsx("h2", {
          className: "section-title",
          children: en.table.scoresheet
        }), _jsx(Scoresheet, {
          history: game.history
        }), playing ? _jsx(TypedMove, {
          session: session
        }) : null]
      }) : null, panel === "style" ? _jsxs(Stack, {
        as: "aside",
        className: "drawer",
        gap: "line",
        pad: "line",
        "aria-label": en.table.style,
        children: [_jsx("h2", {
          className: "section-title",
          children: en.table.style
        }), _jsx("p", {
          className: "note",
          children: en.table.styleNote
        }), _jsx(StylePicker, {
          value: session.world.id,
          onChange: updateGameStyle
        })]
      }) : null, _jsxs("div", {
        className: "corner corner-bottom-right edge-notes",
        children: [engine.state === "failed" ? _jsxs(Stack, {
          gap: "hair",
          align: "flex-end",
          children: [_jsx("p", {
            className: "note note-alert",
            role: "alert",
            children: en.loading.engineFailed
          }), _jsx(Button, {
            onClick: retryEngine,
            children: en.errors.retry
          })]
        }) : null, cheats.active ? _jsx(CheatPanel, {
          session: session
        }) : null, mode !== "lesson" && game.history.length ? _jsx("button", {
          type: "button",
          className: "last-move",
          onClick: () => toggle("scoresheet"),
          children: lastMoveText(game.history)
        }) : null]
      })]
    }), panel === "resign" && playing ? _jsx("div", {
      className: "dialog-scrim",
      children: _jsxs("div", {
        className: "dialog",
        role: "dialog",
        "aria-label": en.table.resign,
        children: [_jsx("h2", {
          className: "dialog-title",
          children: en.table.resignConfirm
        }), _jsx("p", {
          className: "note",
          children: en.table.resignNote
        }), _jsxs(Stack, {
          gap: "tight",
          children: [_jsx(Button, {
            kind: "primary",
            onClick: () => {
              setPanel(null);
              resign();
            },
            children: en.table.resign
          }), _jsx(Button, {
            onClick: () => setPanel(null),
            children: en.table.keepPlaying
          })]
        })]
      })
    }) : null, phase === "promoting" ? _jsx(PromotionChoice, {}) : null, inScene ? _jsx(Caption, {
      session: session
    }) : null, _jsx(KeyboardBoard, {
      session: session
    }), _jsx("p", {
      className: "visually-hidden",
      "aria-live": "polite",
      children: session.announcement
    })]
  });
};