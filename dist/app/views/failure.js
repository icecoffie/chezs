import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/*!
 * Chess
 * Copyright (c) Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a19e25-e438-75a3-a372-c9c67de14514
 */
// Intended use: the one failure sheet, shown by the status boundary and by the router when a view can't render.
import { Button } from "../components/controls.js";
import { en } from "../locales/en.js";
export const Failure = ({
  error,
  reset
}) => _jsxs("div", {
  className: "sheet failure",
  role: "alert",
  children: [_jsx("h1", {
    children: en.errors.title
  }), _jsx("p", {
    className: "note",
    children: error.message
  }), _jsx(Button, {
    kind: "primary",
    onClick: reset,
    children: en.errors.retry
  })]
});