import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/*!
 * Chess
 * Copyright (c) Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a19e25-e438-75a3-a372-c9c67de14514
 */
// Intended use: the style chooser: one choice that sets the board, the pieces and the room together, shown as tiles of the materials themselves. Shared by the settings view, the casual setup and the table.
import { Stack } from "../components/layout.js";
import { en } from "../locales/en.js";
import { MATCH_GAME } from "../schemas.js";
import { updateStyle, useStore } from "../state/store.js";
const Tile = ({
  name,
  on,
  onPick,
  swatch
}) => _jsxs("button", {
  type: "button",
  className: on ? "style-tile is-on" : "style-tile",
  "aria-pressed": on,
  onClick: onPick,
  children: [_jsx("span", {
    className: swatch ? "style-swatch" : "style-swatch is-open",
    "aria-hidden": "true",
    style: swatch ? {
      background: `conic-gradient(${swatch.dark} 25%, ${swatch.light} 0 50%, ${swatch.dark} 0 75%, ${swatch.light} 0) 0 0 / 50% 50%`,
      borderColor: swatch.frame
    } : undefined
  }), _jsx("span", {
    className: "style-name",
    children: name
  })]
});
export const StylePicker = ({
  value,
  onChange,
  lead
}) => {
  const worlds = useStore(state => state.worlds);
  const concept = worlds.find(world => world.id === value)?.tagline;
  return _jsxs(Stack, {
    gap: "line",
    children: [_jsxs("div", {
      className: "style-grid",
      children: [lead ? _jsx(Tile, {
        name: lead.label,
        on: value === lead.value,
        onPick: () => onChange(lead.value)
      }) : null, worlds.map(world => _jsx(Tile, {
        name: world.name.replace(/^The /, ""),
        on: value === world.id,
        swatch: world.swatch,
        onPick: () => onChange(world.id)
      }, world.id))]
    }), _jsx("p", {
      className: "style-concept",
      "aria-live": "polite",
      children: concept ?? en.style.note
    })]
  });
};
export const StylePanel = () => {
  const style = useStore(state => state.profile.style);
  return _jsxs(Stack, {
    as: "section",
    gap: "line",
    children: [_jsx("h2", {
      className: "section-title",
      children: en.style.heading
    }), _jsx(StylePicker, {
      value: style,
      lead: {
        value: MATCH_GAME,
        label: en.style.match
      },
      onChange: updateStyle
    })]
  });
};