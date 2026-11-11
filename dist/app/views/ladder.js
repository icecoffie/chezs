import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/*!
 * Chess
 * Copyright (c) Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a19e25-e438-75a3-a372-c9c67de14514
 */
// Intended use: the home view: the opponent you face next as the hero of the screen, the eight ranks as a track along the bottom edge, and the ways out at the top.
import { useRef, useState } from "react";
import { ButtonLink } from "../components/controls.js";
import { CasualIcon, CheckMarkIcon, PieceIcon, SettingsIcon, StudyIcon } from "../components/icons.js";
import { en } from "../locales/en.js";
import { useStore } from "../state/store.js";
import { useBoardInset } from "./shell.js";
const EngineLine = () => {
  const engine = useStore(state => state.engine);
  if (engine.state === "failed") return _jsx("p", {
    className: "note note-alert",
    role: "status",
    children: en.loading.engineFailed
  });
  if (engine.state !== "loading") return null;
  const percent = engine.total ? Math.round(engine.loaded / engine.total * 100) : 0;
  return _jsx("p", {
    className: "note",
    role: "status",
    children: percent ? en.loading.engine(percent) : en.loading.engineFirst
  });
};
export const LadderView = () => {
  const opponents = useStore(state => state.opponents);
  const worlds = useStore(state => state.worlds);
  const {
    rung,
    points
  } = useStore(state => state.profile);
  const [picked, setPicked] = useState(null);
  const ref = useRef(null);
  useBoardInset(ref, "left");
  const shownIndex = picked ?? Math.min(rung, opponents.length - 1);
  const shown = opponents[shownIndex];
  const isNext = shownIndex === rung;
  const place = worlds.find(world => world.id === shown.world);
  return _jsxs(_Fragment, {
    children: [_jsxs("nav", {
      className: "top-nav",
      "aria-label": en.ladder.heading,
      children: [_jsx(ButtonLink, {
        kind: "plain",
        icon: _jsx(CasualIcon, {}),
        to: "/casual",
        children: en.ladder.casual
      }), _jsx(ButtonLink, {
        kind: "plain",
        icon: _jsx(StudyIcon, {}),
        to: "/study",
        children: en.ladder.study
      }), _jsx(ButtonLink, {
        kind: "plain",
        icon: _jsx(SettingsIcon, {}),
        to: "/settings",
        children: en.ladder.settings
      })]
    }), _jsx("main", {
      className: "hero",
      ref: ref,
      children: rung >= opponents.length && picked === null ? _jsxs("div", {
        className: "hero-body",
        children: [_jsx("p", {
          className: "kicker",
          children: en.ladder.heading
        }), _jsx("h1", {
          className: "hero-name",
          children: en.ladder.promoted
        }), _jsx("p", {
          className: "hero-style",
          children: en.ladder.championLine
        })]
      }, "champion") : _jsxs("div", {
        className: "hero-body",
        children: [_jsx("p", {
          className: "kicker",
          children: en.ladder.rankOf(shownIndex + 1)
        }), _jsx("h1", {
          className: "hero-name",
          children: shown.name
        }), _jsxs("p", {
          className: "hero-title",
          children: [shown.title, _jsx("span", {
            className: "hero-rating",
            children: shown.rating
          })]
        }), _jsx("p", {
          className: "hero-style",
          children: shown.style
        }), place ? _jsx("p", {
          className: "hero-place",
          children: place.name
        }) : null, isNext ? _jsx(ButtonLink, {
          kind: "primary",
          to: "/climb",
          children: en.ladder.challenge(shown.name.split(" ")[0])
        }) : _jsx(ButtonLink, {
          kind: "primary",
          to: "/casual/$opponentId",
          params: {
            opponentId: shown.id
          },
          search: {
            side: "lots",
            style: shown.world
          },
          children: en.ladder.casualWith(shown.name.split(" ")[0])
        }), isNext && points > 0 ? _jsx("p", {
          className: "note",
          children: en.ladder.halfPoint
        }) : null, _jsx(EngineLine, {})]
      }, shown.id)
    }), _jsx("ol", {
      className: "rank-track",
      "aria-label": en.ladder.heading,
      children: opponents.map((opponent, index) => {
        const state = index < rung ? "beaten" : index === rung ? "next" : "ahead";
        return _jsx("li", {
          className: `rank-stop rank-${state}${index === shownIndex ? " is-shown" : ""}`,
          "aria-current": state === "next" ? "step" : undefined,
          children: _jsxs("button", {
            type: "button",
            onClick: () => setPicked(index === rung ? null : index),
            children: [_jsx("span", {
              className: "rank-medal",
              children: state === "beaten" ? _jsx(CheckMarkIcon, {}) : _jsx(PieceIcon, {
                role: opponent.figure
              })
            }), _jsx("span", {
              className: "rank-number",
              children: index + 1
            }), _jsx("span", {
              className: "rank-name",
              children: opponent.name.split(" ").slice(-1)[0]
            }), _jsx("span", {
              className: "visually-hidden",
              children: en.ladder[state === "beaten" ? "beaten" : state]
            })]
          })
        }, opponent.id);
      })
    })]
  });
};