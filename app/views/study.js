import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/*!
 * Chess
 * Copyright (c) Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a19e25-e438-75a3-a372-c9c67de14514
 */
// Intended use: the lesson list, grouped by strategic theme, showing how far through them you are.
import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import { ButtonLink, ScreenHead } from "../components/controls.js";
import { BackIcon, CheckMarkIcon, NextIcon } from "../components/icons.js";
import { Stack } from "../components/layout.js";
import { en } from "../locales/en.js";
import { useStore } from "../state/store.js";
import { useBoardInset } from "./shell.js";
export const StudyView = () => {
  const lessons = useStore(state => state.lessons);
  const done = useStore(state => state.profile.lessonsDone);
  const ref = useRef(null);
  useBoardInset(ref, "left");
  const themes = [...new Set(lessons.map(lesson => lesson.theme))];
  const finished = lessons.filter(lesson => done.includes(lesson.id)).length;
  return _jsx("main", {
    className: "screen",
    ref: ref,
    children: _jsxs("div", {
      className: "screen-scroll",
      children: [_jsx(ScreenHead, {
        title: en.study.heading,
        lead: en.study.intro,
        back: _jsx(ButtonLink, {
          kind: "plain",
          icon: _jsx(BackIcon, {}),
          to: "/",
          children: en.setup.back
        })
      }), _jsxs("div", {
        className: "study-progress",
        role: "progressbar",
        "aria-valuemin": 0,
        "aria-valuemax": lessons.length,
        "aria-valuenow": finished,
        "aria-label": en.study.progress(finished, lessons.length),
        children: [_jsx("span", {
          className: "note",
          children: en.study.progress(finished, lessons.length)
        }), _jsx("span", {
          className: "study-track",
          children: _jsx("span", {
            style: {
              transform: `scaleX(${lessons.length ? finished / lessons.length : 0})`
            }
          })
        })]
      }), themes.map(theme => _jsxs(Stack, {
        as: "section",
        gap: "tight",
        children: [_jsx("h2", {
          className: "section-title",
          children: theme
        }), _jsx("div", {
          className: "rows",
          children: lessons.filter(lesson => lesson.theme === theme).map(lesson => _jsxs(Link, {
            className: "lesson-row",
            to: "/study/$lessonId",
            params: {
              lessonId: lesson.id
            },
            children: [_jsxs("span", {
              className: "lesson-text",
              children: [_jsx("span", {
                className: "lesson-title",
                children: lesson.title
              }), _jsx("span", {
                className: "lesson-idea",
                children: lesson.idea
              })]
            }), _jsx("span", {
              className: "lesson-state",
              children: done.includes(lesson.id) ? _jsxs(_Fragment, {
                children: [_jsx(CheckMarkIcon, {}), _jsx("span", {
                  className: "visually-hidden",
                  children: en.study.done
                })]
              }) : _jsx(NextIcon, {})
            })]
          }, lesson.id))
        })]
      }, theme))]
    })
  });
};