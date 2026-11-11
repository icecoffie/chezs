import { jsx as _jsx } from "react/jsx-runtime";
/*!
 * Chess
 * Copyright (c) Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a19e25-e438-75a3-a372-c9c67de14514
 */
// Intended use: the react-three-fiber canvas: starts the WebGPU renderer, builds the TSL materials, and hosts the imperative stage on its frame loop.
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import * as THREE from "three/webgpu";
import { piecesQuery } from "../api/queries.js";
import { config } from "../config.js";
import { cheats } from "../state/cheats.js";
import * as store from "../state/store.js";
import { createStage } from "./stage.js";
export const stageHandle = {
  current: null
};
const Host = () => {
  const {
    gl,
    scene,
    camera
  } = useThree();
  const samplesRef = useRef([]);
  const lastStep = useRef(performance.now());
  const {
    data: geometry
  } = useSuspenseQuery(piecesQuery);
  const renderer = gl;
  const stageRef = useRef(null);
  useEffect(() => {
    const stage = createStage({
      scene,
      camera: camera,
      renderer,
      geometry,
      renderFrame: () => renderer.render(scene, camera)
    });
    stageRef.current = stage;
    stageHandle.current = stage;
    if (location.hostname.endsWith("localhost")) {
      window.__chess = {
        stage,
        THREE,
        store,
        renderer,
        scene,
        camera
      };
    }
    return () => {
      stage.dispose();
      stageHandle.current = null;
      stageRef.current = null;
    };
  }, [renderer, scene, camera, geometry]);
  useFrame((_, delta) => {
    const stage = stageRef.current;
    if (stage?.isHolding()) return;
    stage?.tick(Math.min(delta, 0.1));
    stage?.draw();
    // If frames stay slow, trade a little sharpness for smoothness.
    const samples = samplesRef.current;
    samples.push(delta * 1000);
    if (samples.length < config.quality.sampleFrames) return;
    const middle = [...samples].sort((a, b) => a - b)[samples.length >> 1];
    samplesRef.current = [];
    const now = performance.now();
    if (middle > config.quality.slowFrameMs && now - lastStep.current > config.quality.cooldownMs && stage?.isStill()) {
      lastStep.current = now;
      stage.lowerQuality();
    }
  }, 1);
  return null;
};
export const BoardCanvas = () => _jsx(Canvas, {
  className: "board-canvas",
  shadows: "percentage",
  dpr: Math.min(devicePixelRatio, config.quality.maxDpr),
  camera: {
    fov: config.camera.fov,
    position: [0, 6, 6],
    near: 0.1,
    far: 120
  },
  gl: async props => {
    const renderer = new THREE.WebGPURenderer({
      canvas: props.canvas,
      // Opaque and without canvas multisampling: those two cost about 15 ms a frame at 2x.
      // The room image is antialiased when it's drawn, and live frames go through a buffer that is.
      context: props.canvas.getContext("webgl2", {
        alpha: false,
        antialias: false,
        powerPreference: cheats.gpu === "low" ? "low-power" : "high-performance"
      }),
      // TSL runs on either backend. On the Macs tested, WebGPU took over 6 s to start
      // and 83 ms a frame just to clear the screen, so WebGL 2 is the reliable path.
      forceWebGL: true
    });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    await renderer.init();
    return renderer;
  },
  children: _jsx(Host, {})
});