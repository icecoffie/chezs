import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/*!
 * Chess
 * Copyright (c) Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a19e25-e438-75a3-a372-c9c67de14514
 */
// Intended use: the settings view: how the game plays, the style, house rules, and the one destructive action, restarting the climb, behind a confirmation.
import { useRef, useState } from "react";
import { Button, ButtonLink, Choice, ScreenHead, Toggle } from "../components/controls.js";
import { BackIcon } from "../components/icons.js";
import { Stack } from "../components/layout.js";
import { en } from "../locales/en.js";
import { resetLadder, updateSettings, useStore } from "../state/store.js";
import { RulesPanel } from "./rules-panel.js";
import { StylePanel } from "./style-panel.js";
import { useBoardInset } from "./shell.js";
const levels = ["off", "big", "captures"];
export const SettingsView = () => {
  const settings = useStore(state => state.profile.settings);
  const rung = useStore(state => state.profile.rung);
  const [resetting, setResetting] = useState("idle");
  const ref = useRef(null);
  useBoardInset(ref, "left");
  return _jsx("main", {
    className: "screen",
    ref: ref,
    children: _jsxs("div", {
      className: "screen-scroll",
      children: [_jsx(ScreenHead, {
        title: en.settings.heading,
        back: _jsx(ButtonLink, {
          kind: "plain",
          icon: _jsx(BackIcon, {}),
          to: "/",
          children: en.setup.back
        })
      }), _jsxs(Stack, {
        as: "section",
        gap: "tight",
        children: [_jsx(Choice, {
          legend: en.settings.cutscenes.label,
          value: settings.cutscenes,
          options: levels.map(value => ({
            value,
            label: en.settings.cutscenes.options[value]
          })),
          onChange: cutscenes => updateSettings({
            cutscenes
          })
        }), _jsx("p", {
          className: "note",
          children: en.settings.cutscenes.note
        }), _jsxs("div", {
          className: "rows",
          children: [_jsx(Toggle, {
            label: en.settings.coordinates,
            checked: settings.coordinates,
            onChange: coordinates => updateSettings({
              coordinates
            })
          }), _jsx(Toggle, {
            label: en.settings.moveHints,
            checked: settings.moveHints,
            onChange: moveHints => updateSettings({
              moveHints
            })
          })]
        })]
      }), _jsx(StylePanel, {}), _jsx(RulesPanel, {
        forClimb: true
      }), rung > 0 || resetting === "done" ? _jsxs(Stack, {
        as: "section",
        gap: "tight",
        children: [_jsx("h2", {
          className: "section-title",
          children: en.settings.progress
        }), resetting === "done" ? _jsx("p", {
          className: "note",
          role: "status",
          children: en.settings.resetDone
        }) : null, resetting === "idle" ? _jsx(Button, {
          onClick: () => setResetting("asking"),
          children: en.settings.reset
        }) : null, resetting === "asking" ? _jsxs(Stack, {
          direction: "row",
          gap: "tight",
          wrap: true,
          children: [_jsx(Button, {
            onClick: () => {
              resetLadder();
              setResetting("done");
            },
            children: en.settings.resetConfirm
          }), _jsx(Button, {
            kind: "plain",
            onClick: () => setResetting("idle"),
            children: en.settings.resetCancel
          })]
        }) : null]
      }) : null]
    })
  });
};