import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/*!
 * Chess
 * Copyright (c) Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a19e25-e438-75a3-a372-c9c67de14514
 */
// Intended use: the entry point: provides the query data, reports every error in one place, and renders the game.
import { createRoot } from "react-dom/client";
import { ApiProvider } from "./api/client.js";
import { StatusBoundary } from "./components/utilities.js";
import { config } from "./config.js";
import { useCacheNamed } from "./lib/utils.js";
import { en } from "./locales/en.js";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./routes.js";
import { Failure } from "./views/failure.js";
// -----------------------------------------------------------------------------
// Errors
// -----------------------------------------------------------------------------
export const reportError = error => {
  console.error(error);
};
window.addEventListener("error", event => reportError(event.error ?? event.message));
window.addEventListener("unhandledrejection", event => reportError(event.reason));
// -----------------------------------------------------------------------------
// Start
// -----------------------------------------------------------------------------
useCacheNamed(config.assetCache);
document.title = en.pageTitle;
createRoot(document.getElementById("root")).render(_jsx(ApiProvider, {
  children: _jsx(StatusBoundary, {
    loading: _jsx("div", {
      className: "veil is-up",
      children: _jsxs("div", {
        className: "veil-card",
        role: "status",
        children: [_jsx("p", {
          className: "veil-label",
          children: en.loading.board
        }), _jsx("div", {
          className: "veil-track is-waiting",
          children: _jsx("span", {
            className: "veil-fill"
          })
        })]
      })
    }),
    fallback: (error, reset) => _jsx(Failure, {
      error: error,
      reset: reset
    }),
    onError: reportError,
    children: _jsx(RouterProvider, {
      router: router
    })
  })
}));