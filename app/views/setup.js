import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/*!
 * Chess
 * Copyright (c) Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a19e25-e438-75a3-a372-c9c67de14514
 */
// Intended use: the casual game setup: who you face, which side you take, the style, and the house rules tucked away until wanted.
import { useEffect, useRef, useState } from "react";
import { ButtonLink, Choice, ScreenHead } from "../components/controls.js";
import { BackIcon, PieceIcon } from "../components/icons.js";
import { Stack } from "../components/layout.js";
import { en } from "../locales/en.js";
import { MATCH_GAME } from "../schemas.js";
import { previewStyle, useStore } from "../state/store.js";
import { RulesPanel } from "./rules-panel.js";
import { StylePicker } from "./style-panel.js";
import { useBoardInset } from "./shell.js";
export const SetupView = () => {
  const opponents = useStore(state => state.opponents);
  const saved = useStore(state => state.profile.style);
  const [opponentId, setOpponentId] = useState(opponents[2].id);
  const [side, setSide] = useState("lots");
  const [style, setStyle] = useState(saved === MATCH_GAME ? "shuffle" : saved);
  const ref = useRef(null);
  useBoardInset(ref, "left");
  useEffect(() => () => previewStyle(null), []);
  const opponent = opponents.find(entry => entry.id === opponentId) ?? opponents[0];
  const pickStyle = id => {
    setStyle(id);
    previewStyle(id === "shuffle" ? null : id);
  };
  return _jsxs("main", {
    className: "screen",
    ref: ref,
    children: [_jsxs("div", {
      className: "screen-scroll",
      children: [_jsx(ScreenHead, {
        title: en.setup.heading,
        back: _jsx(ButtonLink, {
          kind: "plain",
          icon: _jsx(BackIcon, {}),
          to: "/",
          children: en.setup.back
        })
      }), _jsxs(Stack, {
        as: "section",
        gap: "tight",
        children: [_jsx("h2", {
          className: "section-title",
          children: en.setup.opponent
        }), _jsx("div", {
          className: "opponent-list",
          role: "radiogroup",
          children: opponents.map(entry => _jsxs("label", {
            className: entry.id === opponentId ? "opponent-row is-on" : "opponent-row",
            children: [_jsx("input", {
              type: "radio",
              name: en.setup.opponent,
              checked: entry.id === opponentId,
              onChange: () => setOpponentId(entry.id)
            }), _jsx(PieceIcon, {
              role: entry.figure
            }), _jsx("span", {
              className: "opponent-name",
              children: entry.name
            }), _jsx("span", {
              className: "opponent-rating",
              children: entry.rating
            })]
          }, entry.id))
        }), _jsx("p", {
          className: "style-concept",
          children: opponent.style
        })]
      }), _jsx(Choice, {
        legend: en.setup.side,
        value: side,
        options: ["white", "lots", "black"].map(value => ({
          value,
          label: en.setup.sides[value]
        })),
        onChange: setSide
      }), _jsxs(Stack, {
        as: "section",
        gap: "line",
        children: [_jsx("h2", {
          className: "section-title",
          children: en.setup.style
        }), _jsx(StylePicker, {
          value: style,
          lead: {
            value: "shuffle",
            label: en.setup.shuffle
          },
          onChange: pickStyle
        })]
      }), _jsxs("details", {
        className: "more",
        children: [_jsx("summary", {
          children: en.rules.heading
        }), _jsx(RulesPanel, {})]
      })]
    }), _jsx("div", {
      className: "screen-foot",
      children: _jsx(ButtonLink, {
        kind: "primary",
        to: "/casual/$opponentId",
        params: {
          opponentId
        },
        search: {
          side,
          style
        },
        children: en.setup.start
      })
    })]
  });
};