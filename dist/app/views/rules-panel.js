import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/*!
 * Chess
 * Copyright (c) Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a19e25-e438-75a3-a372-c9c67de14514
 */
// Intended use: the house rules form, shared by the casual setup and the settings view.
import { Stepper, Toggle } from "../components/controls.js";
import { Stack } from "../components/layout.js";
import { config } from "../config.js";
import { en } from "../locales/en.js";
import { updateRules, useStore } from "../state/store.js";
const entries = options => Object.keys(options).map(value => ({
  value,
  label: options[value]
}));
export const RulesPanel = ({
  forClimb = false
}) => {
  const rules = useStore(state => state.profile.rules);
  const clockOptions = [{
    value: "none",
    label: en.rules.clock.none
  }, ...Object.keys(config.clocks).map(value => ({
    value,
    label: value
  }))];
  return _jsxs(Stack, {
    as: "section",
    gap: "tight",
    className: "rules",
    children: [_jsx("h2", {
      className: "section-title",
      children: en.rules.heading
    }), forClimb ? _jsx("p", {
      className: "note",
      children: en.rules.climbNote
    }) : null, _jsxs("div", {
      className: "rows",
      children: [_jsx(Stepper, {
        label: en.rules.clock.label,
        value: rules.clock,
        options: clockOptions,
        onChange: clock => updateRules({
          clock
        })
      }), _jsx(Stepper, {
        label: en.rules.start.label,
        value: rules.start,
        options: entries(en.rules.start.options),
        onChange: start => updateRules({
          start
        })
      }), _jsx(Stepper, {
        label: en.rules.odds.label,
        value: rules.odds,
        options: entries(en.rules.odds.options),
        onChange: odds => updateRules({
          odds
        })
      }), _jsx(Stepper, {
        label: en.rules.promotion.label,
        value: rules.promotion,
        options: entries(en.rules.promotion.options),
        onChange: promotion => updateRules({
          promotion
        })
      }), _jsx(Stepper, {
        label: en.rules.repetition.label,
        value: rules.repetition,
        options: entries(en.rules.repetition.options),
        onChange: repetition => updateRules({
          repetition
        })
      }), _jsx(Stepper, {
        label: en.rules.moveLimit.label,
        value: rules.moveLimit,
        options: entries(en.rules.moveLimit.options),
        onChange: moveLimit => updateRules({
          moveLimit
        })
      }), _jsx(Toggle, {
        label: en.rules.takebacks,
        checked: rules.takebacks,
        onChange: takebacks => updateRules({
          takebacks
        })
      }), _jsx(Toggle, {
        label: en.rules.hints,
        checked: rules.hints,
        onChange: hints => updateRules({
          hints
        })
      })]
    })]
  });
};