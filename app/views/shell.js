import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/*!
 * Chess
 * Copyright (c) Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a19e25-e438-75a3-a372-c9c67de14514
 */
// Intended use: composes the canvas and whichever view is open, loads the catalog, and applies the current world's palette to the interface.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Outlet } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef } from "react";
import { lessonsQuery, opponentsQuery, worldsQuery } from "../api/queries.js";
import { en } from "../locales/en.js";
import { BoardCanvas, stageHandle } from "../scene/board-canvas.js";
import { cheats } from "../state/cheats.js";
import { homeWorld, setCatalog, useStore, warmEngine, worldById } from "../state/store.js";
// -----------------------------------------------------------------------------
// Telling the camera how much of the screen the interface covers
// -----------------------------------------------------------------------------
export const useBoardInset = (ref, side) => {
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const measure = () => {
      const narrow = window.innerWidth < 860;
      const box = element.getBoundingClientRect();
      const insets = {
        left: 0,
        right: 0,
        bottom: 0,
        top: 0
      };
      if (narrow) insets.bottom = Math.min(box.height + 12, window.innerHeight * 0.5);else insets[side === "bottom" ? "right" : side] = box.width + 24;
      stageHandle.current?.setInsets(insets);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    const retry = setInterval(measure, 600);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      clearInterval(retry);
      window.removeEventListener("resize", measure);
    };
  }, [ref, side]);
};
// -----------------------------------------------------------------------------
// The veil over the board while a scene is prepared
// -----------------------------------------------------------------------------
const BoardVeil = () => {
  const {
    busy,
    label,
    done,
    total
  } = useStore(state => state.stage);
  const worlds = useStore(state => state.worlds);
  const percent = total ? Math.round(done / total * 100) : 0;
  // The words stay put while the veil fades away, rather than flicking back to the default.
  const lastLabel = useRef("");
  if (label) lastLabel.current = label;
  const world = worlds.find(entry => entry.name === lastLabel.current);
  const text = lastLabel.current ? en.loading.preparing(lastLabel.current) : en.loading.board;
  return _jsx("div", {
    className: busy ? "veil is-up" : "veil",
    "aria-hidden": !busy,
    children: _jsxs("div", {
      className: "veil-card",
      role: "status",
      "aria-busy": busy,
      children: [_jsx("p", {
        className: "veil-title",
        children: lastLabel.current || en.pageTitle
      }), world ? _jsx("p", {
        className: "veil-tagline",
        children: world.tagline
      }) : null, _jsx("div", {
        className: total ? "veil-track" : "veil-track is-waiting",
        role: "progressbar",
        "aria-label": text,
        "aria-valuemin": 0,
        "aria-valuemax": 100,
        "aria-valuenow": total ? percent : undefined,
        children: _jsx("span", {
          className: "veil-fill",
          style: {
            transform: `scaleX(${percent / 100})`
          }
        })
      })]
    })
  });
};
// -----------------------------------------------------------------------------
// Cheat notice
// -----------------------------------------------------------------------------
const CheatNotice = () => {
  const worlds = useStore(state => state.worlds);
  if (!cheats.active) return null;
  const unknown = cheats.style && !worlds.some(world => world.id === cheats.style) ? [`style:${cheats.style}`] : [];
  const rejected = [...cheats.rejected, ...unknown];
  return _jsxs("p", {
    className: "cheat-notice",
    role: "status",
    children: [en.cheats.notice(cheats.labels.join(", ")), rejected.length ? _jsx("strong", {
      children: en.cheats.rejected(rejected.join(", "))
    }) : null]
  });
};
// -----------------------------------------------------------------------------
// Shell
// -----------------------------------------------------------------------------
export const Shell = () => {
  const {
    data: worlds
  } = useSuspenseQuery(worldsQuery);
  const {
    data: opponents
  } = useSuspenseQuery(opponentsQuery);
  const {
    data: lessons
  } = useSuspenseQuery(lessonsQuery);
  setCatalog(worlds, opponents, lessons);
  const sessionWorld = useStore(state => state.session?.world.id ?? null);
  // Reading the profile keeps the palette in step when the rank or a pinned style changes.
  useStore(state => state.profile);
  const worldId = sessionWorld ?? homeWorld().id;
  useLayoutEffect(() => {
    const {
      palette
    } = worldById(worldId);
    const root = document.documentElement;
    Object.entries(palette).forEach(([name, value]) => root.style.setProperty(`--world-${name}`, value));
    root.style.colorScheme = worldId === "ink-garden" ? "light" : "dark";
  }, [worldId]);
  useEffect(() => warmEngine(), []);
  return _jsxs(_Fragment, {
    children: [_jsx(BoardCanvas, {}), _jsx("div", {
      className: "vignette",
      "aria-hidden": "true"
    }), _jsx(BoardVeil, {}), _jsx(Outlet, {}), _jsx(CheatNotice, {})]
  });
};