import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/*!
 * Chess
 * Copyright (c) Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a19e25-e438-75a3-a372-c9c67de14514
 */
// Intended use: the controls the game repeats: command buttons, segmented choices, steppers for long option lists, and switches.
import { createLink } from "@tanstack/react-router";
import { en } from "../locales/en.js";
import { NextIcon, BackIcon } from "./icons.js";
export const Button = ({
  kind = "quiet",
  icon,
  children,
  onClick,
  disabled,
  label
}) => _jsxs("button", {
  type: "button",
  className: `button button-${kind}`,
  onClick: onClick,
  disabled: disabled,
  "aria-label": label,
  "data-tip": label,
  children: [icon, children ? _jsx("span", {
    children: children
  }) : null]
});
const Anchor = ({
  kind = "quiet",
  icon,
  children,
  ref,
  ...rest
}) => _jsxs("a", {
  ref: ref,
  className: `button button-${kind}`,
  ...rest,
  children: [icon, children ? _jsx("span", {
    children: children
  }) : null]
});
export const ButtonLink = createLink(Anchor);
// A few short options, all visible at once.
export const Choice = ({
  legend,
  value,
  options,
  onChange
}) => _jsxs("fieldset", {
  className: "choice",
  children: [_jsx("legend", {
    children: legend
  }), _jsx("div", {
    className: "segments",
    children: options.map(option => _jsxs("label", {
      className: option.value === value ? "segment is-on" : "segment",
      children: [_jsx("input", {
        type: "radio",
        name: legend,
        checked: option.value === value,
        onChange: () => onChange(option.value)
      }), _jsx("span", {
        children: option.label
      })]
    }, option.value))
  })]
});
// A setting with many values, stepped through in place, as game menus do.
export const Stepper = ({
  label,
  value,
  options,
  onChange
}) => {
  const index = options.findIndex(option => option.value === value);
  const step = by => onChange(options[(index + by + options.length) % options.length].value);
  return _jsxs("div", {
    className: "row",
    role: "group",
    "aria-label": label,
    children: [_jsx("span", {
      className: "row-label",
      children: label
    }), _jsxs("span", {
      className: "stepper",
      children: [_jsx("button", {
        type: "button",
        "aria-label": en.controls.previous(label),
        onClick: () => step(-1),
        children: _jsx(BackIcon, {})
      }), _jsx("output", {
        "aria-live": "polite",
        children: options[index]?.label
      }), _jsx("button", {
        type: "button",
        "aria-label": en.controls.next(label),
        onClick: () => step(1),
        children: _jsx(NextIcon, {})
      })]
    })]
  });
};
export const Toggle = ({
  label,
  checked,
  onChange
}) => _jsxs("label", {
  className: "row row-switch",
  children: [_jsx("span", {
    className: "row-label",
    children: label
  }), _jsx("input", {
    type: "checkbox",
    role: "switch",
    checked: checked,
    onChange: event => onChange(event.target.checked)
  }), _jsx("span", {
    className: "switch",
    "aria-hidden": "true"
  })]
});
// A view's opening: what it is, in large type, with the way back above it.
export const ScreenHead = ({
  title,
  lead,
  back
}) => _jsxs("header", {
  className: "screen-head",
  children: [back, _jsx("h1", {
    children: title
  }), lead ? _jsx("p", {
    className: "lead",
    children: lead
  }) : null]
});