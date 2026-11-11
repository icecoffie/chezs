/*!
 * Chess
 * Copyright (c) Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a19e25-e438-75a3-a372-c9c67de14514
 */
import * as THREE from "three/webgpu";
import { config } from "../config.js";
import { piecesOf } from "../chess/game.js";
import { seeded } from "../lib/utils.js";
const S = config.board.square;
const UP = new THREE.Vector3(0, 1, 0);
const squarePoint = square => new THREE.Vector3((square % 8 - 3.5) * S, 0, (3.5 - Math.floor(square / 8)) * S);
const flatDirection = (from, to) => {
  const direction = to.clone().sub(from).setY(0);
  return direction.lengthSq() < 1e-6 ? new THREE.Vector3(0, 0, -1) : direction.normalize();
};
// -----------------------------------------------------------------------------
// Scene builder
// -----------------------------------------------------------------------------
export const createCutscenes = kit => {
  const {
    fx,
    camera
  } = kit;
  // ---------------------------------------------------------------------------
  // Camera work
  // ---------------------------------------------------------------------------
  const view = {
    target: new THREE.Vector3()
  };
  const shot = (tl, at, seconds, position, target, ease = "power2.inOut") => {
    tl.call(() => {
      view.target.copy(kit.homePose().target);
    }, [], 0);
    tl.to(camera.position, {
      x: position.x,
      y: position.y,
      z: position.z,
      duration: seconds,
      ease,
      onUpdate: () => camera.lookAt(view.target)
    }, at);
    tl.to(view.target, {
      x: target.x,
      y: target.y,
      z: target.z,
      duration: seconds,
      ease
    }, at);
  };
  const closeOn = (focus, along, distance = 1.5, height = 0.62) => {
    const across = new THREE.Vector3().crossVectors(along, UP).normalize();
    const facing = camera.position.clone().sub(focus).setY(0);
    if (across.dot(facing) < 0) across.negate();
    if (along.dot(facing) > 0.6) along.clone().negate();
    return focus.clone().addScaledVector(across, distance).addScaledVector(along, -distance * 0.32).setY(height);
  };
  const returnHome = (tl, at) => {
    const pose = kit.homePose();
    shot(tl, at, config.motion.resetSeconds, pose.position, pose.target);
  };
  const shake = (tl, at, power) => {
    const state = {
      amount: power
    };
    tl.to(state, {
      amount: 0,
      duration: 0.42,
      ease: "power2.out",
      onUpdate: () => {
        camera.position.x += (Math.random() - 0.5) * state.amount;
        camera.position.y += (Math.random() - 0.5) * state.amount;
        camera.lookAt(view.target);
      }
    }, at);
  };
  const slowTime = (tl, at, factor, seconds) => {
    tl.call(() => fx.setSpeed(factor), [], at);
    tl.call(() => fx.setSpeed(1), [], at + seconds);
  };
  // ---------------------------------------------------------------------------
  // Tilting a piece about its base
  // ---------------------------------------------------------------------------
  const tilt = (tl, mesh, axis, angle, seconds, ease, at) => {
    const proxy = mesh.userData.tiltProxy ??= {
      angle: 0,
      yaw: 0
    };
    const base = mesh.userData.baseYaw;
    const yawAxis = UP;
    const qYaw = new THREE.Quaternion();
    const qTilt = new THREE.Quaternion();
    tl.to(proxy, {
      angle,
      duration: seconds,
      ease,
      onUpdate: () => {
        qYaw.setFromAxisAngle(yawAxis, base + proxy.yaw);
        qTilt.setFromAxisAngle(axis, proxy.angle);
        mesh.quaternion.copy(qTilt).multiply(qYaw);
      }
    }, at);
  };
  const spin = (tl, mesh, axis, turns, seconds, ease, at) => {
    const proxy = mesh.userData.tiltProxy ??= {
      angle: 0,
      yaw: 0
    };
    const base = mesh.userData.baseYaw;
    const qYaw = new THREE.Quaternion();
    const qTilt = new THREE.Quaternion();
    tl.to(proxy, {
      yaw: proxy.yaw + turns * Math.PI * 2,
      duration: seconds,
      ease,
      onUpdate: () => {
        qYaw.setFromAxisAngle(UP, base + proxy.yaw);
        qTilt.setFromAxisAngle(axis, proxy.angle);
        mesh.quaternion.copy(qTilt).multiply(qYaw);
      }
    }, at);
  };
  const quiver = (tl, mesh, at, seconds, amount = 0.016) => {
    const home = mesh.position.clone();
    const state = {
      t: 0
    };
    tl.to(state, {
      t: 1,
      duration: seconds,
      ease: "none",
      onUpdate: () => {
        mesh.position.x = home.x + Math.sin(state.t * 95) * amount * state.t;
        mesh.position.z = home.z + Math.cos(state.t * 83) * amount * state.t;
      }
    }, at);
  };
  const hop = (tl, mesh, to, height, seconds, at) => {
    tl.to(mesh.position, {
      x: to.x,
      z: to.z,
      duration: seconds,
      ease: "none"
    }, at);
    tl.to(mesh.position, {
      y: height,
      duration: seconds / 2,
      ease: "sine.out"
    }, at);
    tl.to(mesh.position, {
      y: 0,
      duration: seconds / 2,
      ease: "sine.in"
    }, at + seconds / 2);
  };
  // ---------------------------------------------------------------------------
  // Rings, flashes and the world's way of finishing a piece
  // ---------------------------------------------------------------------------
  const ringOut = (tl, at, where, reach, seconds = 0.6) => {
    const holder = {
      made: null,
      t: 0
    };
    tl.call(() => {
      holder.made = fx.shockwave(where, reach, seconds);
    }, [], at);
    tl.to(holder, {
      t: 1,
      duration: seconds,
      ease: "power2.out",
      onUpdate: () => {
        if (!holder.made) return;
        holder.made.mesh.scale.setScalar(0.1 + holder.t * reach);
        holder.made.fade.value = 1 - holder.t;
      },
      onComplete: () => {
        if (holder.made) holder.made.mesh.visible = false;
      }
    }, at);
  };
  // A surge of the key light: a real flash needs no extra light in every shader.
  const flashAt = (tl, at, _where, power, seconds = 0.45) => {
    const peak = kit.keyPower() * (1 + power * 0.09);
    tl.call(() => {
      kit.key.intensity = peak;
    }, [], at);
    tl.to(kit.key, {
      intensity: kit.keyPower(),
      duration: seconds,
      ease: "power2.out"
    }, at + 0.01);
  };
  const spreadPool = (tl, at, where, reach, growSeconds, holdSeconds) => {
    const holder = {
      made: null,
      t: 0,
      f: 1
    };
    tl.call(() => {
      holder.made = fx.pool(where, reach);
    }, [], at);
    tl.to(holder, {
      t: 1,
      duration: growSeconds,
      ease: "power2.out",
      onUpdate: () => {
        if (holder.made) holder.made.spread.value = holder.t;
      }
    }, at);
    tl.to(holder, {
      f: 0,
      duration: holdSeconds,
      ease: "power1.in",
      onUpdate: () => {
        if (holder.made) holder.made.fade.value = holder.f;
      },
      onComplete: () => holder.made?.hide()
    }, at + growSeconds);
  };
  const demise = (tl, at, victim, role, direction, power, split) => {
    const where = victim.position.clone();
    const style = kit.demise();
    tl.call(() => {
      const center = victim.position.clone().setY(Math.min(victim.position.y, 0.02));
      victim.visible = false;
      const launch = (force, options = {}) => fx.burstShards(role, victim, {
        at: center,
        direction,
        force: force * power,
        split,
        ...options
      });
      if (style === "collapse") {
        launch(0.7, {
          attract: true,
          life: 0.75
        });
        fx.burstSparks(center.clone().setY(0.34), 50, 0.4, {
          gravity: 0,
          life: 0.7
        });
      } else if (style === "inkburst") {
        launch(0.75);
        fx.burstSparks(center.clone().setY(0.1), Math.round(150 * power), 2, {
          gravity: 1.1,
          size: 0.03,
          rise: 0.8
        });
      } else if (style === "pixelate") {
        launch(0.55, {
          gravity: -0.15,
          life: 1.1
        });
        fx.burstSparks(center.clone().setY(0.3), Math.round(170 * power), 1.2, {
          gravity: -0.1,
          size: 0.024,
          life: 1.1
        });
      } else if (style === "splinter") {
        launch(1);
        fx.burstSparks(center.clone().setY(0.25), Math.round(95 * power), 2.3, {
          gravity: 1.2,
          size: 0.016
        });
      } else {
        launch(1.15);
        fx.burstSparks(center.clone().setY(0.3), Math.round(110 * power), 2.6, {
          gravity: 0.9,
          size: 0.014
        });
      }
    }, [], at);
    if (style === "inkburst") spreadPool(tl, at, where, 0.8 * power, 0.4, 0.9);
    if (style === "collapse") {
      flashAt(tl, at + 0.62, where, 18 * power);
      ringOut(tl, at + 0.62, where, 2.1 * power, 0.8);
      tl.call(() => fx.burstSparks(where.clone().setY(0.34), Math.round(140 * power), 3.2, {
        gravity: 0,
        life: 0.7,
        size: 0.012
      }), [], at + 0.62);
    } else {
      flashAt(tl, at, where, 9 * power);
      ringOut(tl, at, where, 1.5 * power);
    }
  };
  // ---------------------------------------------------------------------------
  // How each piece kills
  // ---------------------------------------------------------------------------
  const pawnStrike = (tl, a, v, start, end, along, axis, t) => {
    const gap = start.distanceTo(end) - S * 0.62;
    const firstHop = start.clone().addScaledVector(along, gap * 0.5);
    const secondHop = start.clone().addScaledVector(along, gap);
    hop(tl, a, firstHop, 0.1, 0.17, t);
    hop(tl, a, secondHop, 0.1, 0.17, t + 0.18);
    tilt(tl, a, axis, -0.42, 0.18, "power2.out", t + 0.37);
    quiver(tl, v, t + 0.3, 0.32);
    const lungeAt = t + 0.6;
    tilt(tl, a, axis, 0.62, 0.09, "power4.in", lungeAt);
    const contact = end.clone().addScaledVector(along, -S * 0.28);
    tl.to(a.position, {
      x: contact.x,
      z: contact.z,
      duration: 0.09,
      ease: "power4.in"
    }, lungeAt);
    return {
      impact: lungeAt + 0.09,
      settle: 0.26
    };
  };
  const knightStrike = (tl, a, v, _start, end, _along, axis, t) => {
    tilt(tl, a, axis, -0.62, 0.24, "back.out(1.6)", t);
    quiver(tl, v, t + 0.12, 0.5);
    const leapAt = t + 0.26;
    tl.to(a.position, {
      x: end.x,
      z: end.z,
      duration: 0.42,
      ease: "none"
    }, leapAt);
    tl.to(a.position, {
      y: 1.05,
      duration: 0.22,
      ease: "power2.out"
    }, leapAt);
    tl.to(a.position, {
      y: 0.32,
      duration: 0.2,
      ease: "power3.in"
    }, leapAt + 0.22);
    tilt(tl, a, axis, 0.5, 0.2, "power3.in", leapAt + 0.2);
    return {
      impact: leapAt + 0.42,
      settle: 0.28
    };
  };
  const bishopStrike = (tl, a, v, start, end, along, axis, t) => {
    const stop = end.clone().addScaledVector(along, -S * 0.86);
    const glide = Math.max(0.2, start.distanceTo(stop) * 0.16);
    tl.to(a.position, {
      x: stop.x,
      z: stop.z,
      duration: glide,
      ease: "power2.inOut"
    }, t);
    tilt(tl, a, axis, -0.5, 0.26, "power2.out", t + glide - 0.06);
    spin(tl, a, axis, 1, 0.3, "power2.in", t + glide);
    quiver(tl, v, t + glide, 0.34);
    const swingAt = t + glide + 0.3;
    tilt(tl, a, axis, 1.02, 0.11, "power4.in", swingAt);
    return {
      impact: swingAt + 0.11,
      settle: 0.34
    };
  };
  const rookStrike = (tl, a, v, _start, end, _along, axis, t) => {
    tl.to(a.position, {
      x: end.x,
      z: end.z,
      duration: 0.46,
      ease: "power2.out"
    }, t);
    tl.to(a.position, {
      y: 1.3,
      duration: 0.46,
      ease: "power2.out"
    }, t);
    spin(tl, a, axis, 0.25, 0.46, "power2.out", t);
    quiver(tl, v, t + 0.28, 0.32, 0.024);
    const slamAt = t + 0.56;
    tl.to(a.position, {
      y: 0.16,
      duration: 0.11,
      ease: "power4.in"
    }, slamAt);
    tl.to(v.scale, {
      y: 0.32,
      x: 1.24,
      z: 1.24,
      duration: 0.05,
      ease: "power2.in"
    }, slamAt + 0.07);
    return {
      impact: slamAt + 0.12,
      settle: 0.2
    };
  };
  const queenStrike = (tl, a, v, start, end, along, axis, t) => {
    const stop = end.clone().addScaledVector(along, -Math.min(S * 1.3, start.distanceTo(end) * 0.7));
    tl.to(a.position, {
      x: stop.x,
      z: stop.z,
      y: 0.14,
      duration: 0.3,
      ease: "power2.inOut"
    }, t);
    spin(tl, a, axis, 1.5, 0.62, "power2.in", t + 0.1);
    tilt(tl, a, axis, -0.26, 0.4, "power2.out", t + 0.2);
    tl.to(v.position, {
      y: 0.62,
      duration: 0.46,
      ease: "power2.out"
    }, t + 0.26);
    tilt(tl, v, axis, 0.42, 0.46, "sine.inOut", t + 0.26);
    quiver(tl, v, t + 0.3, 0.42, 0.02);
    tilt(tl, a, axis, 0.34, 0.09, "power4.in", t + 0.72);
    return {
      impact: t + 0.81,
      settle: 0.34
    };
  };
  const kingStrike = (tl, a, v, start, end, along, axis, t) => {
    const stop = start.clone().addScaledVector(along, start.distanceTo(end) - S * 0.74);
    tl.to(a.position, {
      x: stop.x,
      z: stop.z,
      duration: 0.42,
      ease: "power1.inOut"
    }, t);
    tilt(tl, a, axis, 0.42, 0.2, "power2.in", t + 0.44);
    tilt(tl, v, axis, 1.2, 0.3, "power2.in", t + 0.56);
    tl.to(v.position, {
      x: end.x + along.x * 0.22,
      z: end.z + along.z * 0.22,
      duration: 0.3,
      ease: "power2.in"
    }, t + 0.56);
    return {
      impact: t + 0.86,
      settle: 0.4
    };
  };
  const strikes = {
    pawn: pawnStrike,
    knight: knightStrike,
    bishop: bishopStrike,
    rook: rookStrike,
    queen: queenStrike,
    king: kingStrike
  };
  // ---------------------------------------------------------------------------
  // Capture and the queen's fall
  // ---------------------------------------------------------------------------
  const captureScene = (facts, tl, grand) => {
    const a = kit.pieces().get(facts.from);
    const v = facts.captured && kit.pieces().get(facts.captured.square);
    if (!a || !v || !facts.captured) return 0;
    const start = squarePoint(facts.from);
    const victimAt = squarePoint(facts.captured.square);
    const end = squarePoint(facts.to);
    const along = flatDirection(start, victimAt);
    const axis = new THREE.Vector3().crossVectors(UP, along).normalize();
    const across = axis.clone();
    const focus = victimAt.clone().setY(0.36);
    shot(tl, 0, 0.42, closeOn(focus, along, grand ? 2 : 2.45, grand ? 0.55 : 0.85), focus);
    const lead = 0.28;
    const {
      impact,
      settle
    } = strikes[facts.role](tl, a, v, start, victimAt, along, axis, lead);
    const power = grand ? 1.5 : 1;
    const split = facts.role === "bishop" ? across : undefined;
    demise(tl, impact, v, facts.captured.role, along, power, split);
    shake(tl, impact, grand || facts.role === "rook" ? 0.09 : 0.04);
    if (grand) {
      slowTime(tl, impact, 0.32, 0.65);
      ringOut(tl, impact + 0.12, victimAt, 2.6, 0.9);
    }
    tl.to(a.position, {
      x: end.x,
      y: 0,
      z: end.z,
      duration: settle,
      ease: "power2.out"
    }, impact + 0.06);
    tilt(tl, a, axis, 0, settle + 0.1, "power2.out", impact + 0.06);
    return impact + (grand ? 0.98 : 0.62);
  };
  const enPassantScene = (facts, tl) => {
    const a = kit.pieces().get(facts.from);
    const v = facts.captured && kit.pieces().get(facts.captured.square);
    if (!a || !v || !facts.captured) return 0;
    const start = squarePoint(facts.from);
    const end = squarePoint(facts.to);
    const victimAt = squarePoint(facts.captured.square);
    const dash = flatDirection(start, end);
    const back = flatDirection(end, victimAt);
    const axis = new THREE.Vector3().crossVectors(UP, back).normalize();
    const focus = victimAt.clone().lerp(end, 0.5).setY(0.3);
    shot(tl, 0, 0.4, closeOn(focus, dash, 2.1, 0.62), focus);
    tl.to(a.position, {
      x: end.x,
      z: end.z,
      duration: 0.26,
      ease: "power2.out"
    }, 0.22);
    tl.to(a.position, {
      y: 0.1,
      duration: 0.13,
      yoyo: true,
      repeat: 1,
      ease: "sine.out"
    }, 0.22);
    tilt(tl, a, axis, -0.45, 0.22, "power2.out", 0.56);
    tl.to(v.rotation, {
      y: v.userData.baseYaw + 0.6,
      duration: 0.2,
      ease: "power1.out"
    }, 0.56);
    const contact = victimAt.clone().addScaledVector(back, -S * 0.34);
    tilt(tl, a, axis, 0.62, 0.09, "power4.in", 0.82);
    tl.to(a.position, {
      x: contact.x,
      z: contact.z,
      duration: 0.09,
      ease: "power4.in"
    }, 0.82);
    demise(tl, 0.91, v, "pawn", back, 1);
    shake(tl, 0.91, 0.05);
    tl.to(a.position, {
      x: end.x,
      z: end.z,
      y: 0,
      duration: 0.26,
      ease: "power2.out"
    }, 0.98);
    tilt(tl, a, axis, 0, 0.26, "power2.out", 0.98);
    return 1.52;
  };
  // ---------------------------------------------------------------------------
  // Light beams and shafts
  // ---------------------------------------------------------------------------
  const beamBetween = (tl, at, from, to, seconds, thickness = 0.03) => {
    const {
      material,
      fade
    } = kit.beam();
    const state = fade;
    const length = from.distanceTo(to);
    const geometry = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true);
    const beam = new THREE.Mesh(geometry, material);
    beam.position.copy(from).lerp(to, 0.5);
    beam.quaternion.setFromUnitVectors(UP, to.clone().sub(from).normalize());
    beam.scale.set(thickness, length, thickness);
    tl.call(() => {
      kit.fxRoot.add(beam);
    }, [], at);
    tl.fromTo(state, {
      value: 0
    }, {
      value: 1,
      duration: seconds * 0.2,
      ease: "power2.out"
    }, at);
    tl.to(state, {
      value: 0,
      duration: seconds * 0.8,
      ease: "power2.in"
    }, at + seconds * 0.2);
    tl.call(() => {
      kit.fxRoot.remove(beam);
      geometry.dispose();
    }, [], at + seconds);
  };
  const lightShaft = (tl, at, where, seconds, radius, peak) => {
    const {
      material,
      fade
    } = kit.shaft();
    const geometry = new THREE.CylinderGeometry(radius, radius * 1.15, 5, 28, 1, true);
    geometry.translate(0, 2.5, 0);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(where);
    const state = fade;
    tl.call(() => {
      kit.fxRoot.add(mesh);
    }, [], at);
    tl.fromTo(state, {
      value: 0
    }, {
      value: peak,
      duration: seconds * 0.3,
      ease: "power2.out"
    }, at);
    tl.to(state, {
      value: 0,
      duration: seconds * 0.5,
      ease: "power2.in"
    }, at + seconds * 0.5);
    tl.call(() => {
      kit.fxRoot.remove(mesh);
      geometry.dispose();
    }, [], at + seconds);
  };
  const dimKey = (tl, at, amount, seconds) => {
    tl.to(kit.key, {
      intensity: kit.keyPower() * amount,
      duration: seconds,
      ease: "power2.inOut"
    }, at);
  };
  // ---------------------------------------------------------------------------
  // Check, castling, promotion and sacrifice
  // ---------------------------------------------------------------------------
  const checkScene = (facts, tl) => {
    kit.plainMove(facts, tl);
    const kingSquare = facts.kingSquare;
    const king = kit.pieces().get(kingSquare);
    if (!king) return config.motion.moveSeconds;
    const checkerSquare = facts.checkers[0] === facts.from ? facts.to : facts.checkers[0] ?? facts.to;
    const checkerAt = squarePoint(checkerSquare);
    const kingAt = squarePoint(kingSquare);
    const along = flatDirection(checkerAt, kingAt);
    const axis = new THREE.Vector3().crossVectors(UP, along).normalize();
    const t = config.motion.moveSeconds;
    const focus = kingAt.clone().setY(0.5);
    shot(tl, t * 0.5, 0.42, closeOn(focus, along, 2.2, 0.9), focus);
    const checker = kit.pieces().get(facts.from) ?? kit.pieces().get(checkerSquare);
    const swing = t + 0.3;
    if (checker) {
      tilt(tl, checker, axis, 0.24, 0.13, "power3.out", swing);
      tilt(tl, checker, axis, 0, 0.38, "power2.inOut", swing + 0.26);
    }
    beamBetween(tl, swing + 0.05, checkerAt.clone().setY(0.45), kingAt.clone().setY(0.62), 0.55);
    tilt(tl, king, axis, 0.28, 0.1, "power3.out", swing + 0.1);
    tilt(tl, king, axis, -0.08, 0.2, "sine.inOut", swing + 0.28);
    tilt(tl, king, axis, 0.1, 0.16, "sine.inOut", swing + 0.48);
    tilt(tl, king, axis, 0, 0.2, "sine.out", swing + 0.64);
    ringOut(tl, swing + 0.1, kingAt, 1.5);
    tl.call(() => fx.burstSparks(kingAt.clone().setY(0.62), 34, 1.4, {
      gravity: 0.7,
      size: 0.012,
      life: 0.6
    }), [], swing + 0.1);
    return swing + 0.92;
  };
  const castleScene = (facts, tl) => {
    const king = kit.pieces().get(facts.from);
    const rook = facts.rook && kit.pieces().get(facts.rook.from);
    if (!king || !rook || !facts.rook) return 0;
    const kingEnd = squarePoint(facts.to);
    const rookEnd = squarePoint(facts.rook.to);
    const middle = kingEnd.clone().lerp(rookEnd, 0.5).setY(0.42);
    const along = flatDirection(squarePoint(facts.from), kingEnd);
    shot(tl, 0, 0.42, closeOn(middle, along, 3, 1), middle);
    tl.to(king.position, {
      x: kingEnd.x,
      z: kingEnd.z,
      duration: 0.5,
      ease: "power2.inOut"
    }, 0.28);
    tl.to(rook.position, {
      x: rookEnd.x,
      z: rookEnd.z,
      duration: 0.64,
      ease: "power1.inOut"
    }, 0.28);
    tl.to(rook.position, {
      y: 1.15,
      duration: 0.32,
      ease: "power2.out"
    }, 0.28);
    tl.to(rook.position, {
      y: 0,
      duration: 0.32,
      ease: "power2.in"
    }, 0.6);
    spin(tl, rook, new THREE.Vector3(1, 0, 0), 1, 0.64, "power1.inOut", 0.28);
    ringOut(tl, 0.92, rookEnd, 1.2);
    ringOut(tl, 0.8, kingEnd, 1);
    tl.call(() => fx.burstSparks(rookEnd.clone().setY(0.04), 40, 1.3, {
      gravity: 0.9,
      size: 0.012,
      life: 0.7,
      rise: 0.6
    }), [], 0.92);
    shake(tl, 0.92, 0.03);
    return 1.45;
  };
  const promotionScene = (facts, tl, viewerColor) => {
    const pawn = kit.pieces().get(facts.from);
    if (!pawn) return 0;
    const end = squarePoint(facts.to);
    const victim = facts.captured && kit.pieces().get(facts.captured.square);
    kit.plainMove({
      ...facts,
      captured: undefined
    }, tl);
    const focus = end.clone().setY(0.55);
    const along = viewerColor === "white" ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 0, 1);
    shot(tl, 0.1, 0.5, closeOn(focus, along, 2.8, 0.9), focus);
    const t = config.motion.moveSeconds;
    if (victim && facts.captured) demise(tl, t * 0.8, victim, facts.captured.role, along, 1);
    tl.to(pawn.position, {
      y: 0.72,
      duration: 0.65,
      ease: "power2.out"
    }, t + 0.06);
    spin(tl, pawn, new THREE.Vector3(1, 0, 0), 3, 0.72, "power3.in", t + 0.06);
    lightShaft(tl, t + 0.1, end, 1.7, 0.4, 0.6);
    const burstAt = t + 0.78;
    tl.call(() => {
      pawn.visible = false;
      fx.burstShards("pawn", pawn, {
        at: pawn.position.clone(),
        force: 1.05,
        gravity: 0.9,
        life: 1.1
      });
      fx.burstSparks(pawn.position.clone().setY(0.8), 120, 2.4, {
        gravity: 0.7,
        size: 0.014
      });
    }, [], burstAt);
    flashAt(tl, burstAt, end.clone().setY(0.4), 22, 0.65);
    const crowned = {
      mesh: null
    };
    tl.call(() => {
      crowned.mesh = kit.spawn({
        color: facts.color,
        role: facts.promotion
      }, facts.to);
      crowned.mesh.position.y = 0.8;
      crowned.mesh.scale.setScalar(0.05);
      kit.pieces().set(facts.to, crowned.mesh);
    }, [], burstAt + 0.03);
    const state = {
      scale: 0.05,
      y: 0.8
    };
    tl.to(state, {
      scale: 1,
      y: 0,
      duration: 0.58,
      ease: "back.out(1.5)",
      onUpdate: () => {
        if (!crowned.mesh) return;
        crowned.mesh.scale.setScalar(state.scale);
        crowned.mesh.position.y = Math.max(0, state.y);
      }
    }, burstAt + 0.05);
    ringOut(tl, burstAt + 0.58, end, 1.7);
    shake(tl, burstAt + 0.58, 0.035);
    return burstAt + 1.22;
  };
  const sacrificeScene = (facts, tl) => {
    const piece = kit.pieces().get(facts.from);
    if (!piece) return 0;
    const start = squarePoint(facts.from);
    const end = squarePoint(facts.to);
    const along = flatDirection(start, end);
    const axis = new THREE.Vector3().crossVectors(UP, along).normalize();
    const focus = end.clone().setY(0.42);
    shot(tl, 0, 0.55, closeOn(focus, along, 2.1, 0.42), focus);
    dimKey(tl, 0, 0.32, 0.45);
    tl.to(piece.position, {
      x: end.x,
      z: end.z,
      duration: 0.62,
      ease: "power2.inOut"
    }, 0.2);
    tl.to(piece.position, {
      y: 0.14,
      duration: 0.31,
      ease: "sine.out"
    }, 0.2);
    tl.to(piece.position, {
      y: 0,
      duration: 0.31,
      ease: "sine.in"
    }, 0.51);
    const victim = facts.captured && kit.pieces().get(facts.captured.square);
    if (victim && facts.captured) demise(tl, 0.72, victim, facts.captured.role, along, 0.8);
    lightShaft(tl, 0.72, end, 1.3, 0.34, 0.5);
    tilt(tl, piece, axis, 0.4, 0.3, "power2.inOut", 0.9);
    tilt(tl, piece, axis, 0, 0.34, "power2.inOut", 1.28);
    ringOut(tl, 0.82, end, 1.2, 0.8);
    dimKey(tl, 1.5, 1, 0.5);
    return 1.7;
  };
  // ---------------------------------------------------------------------------
  // Endings
  // ---------------------------------------------------------------------------
  const topple = (tl, mesh, away, at, seconds) => {
    const axis = new THREE.Vector3().crossVectors(UP, away).normalize();
    const width = mesh.userData.role === "pawn" ? 0.14 : 0.19;
    tilt(tl, mesh, axis, Math.PI / 2 - 0.05, seconds, "bounce.out", at);
    tl.to(mesh.position, {
      y: width,
      duration: seconds * 0.7,
      ease: "power2.in"
    }, at);
  };
  const kingOf = (game, side) => piecesOf(game).find(piece => piece.color === side && piece.role === "king")?.square;
  const checkmateEnding = (loser, game, facts, tl) => {
    const kingSquare = kingOf(game, loser);
    if (kingSquare === undefined) return;
    const king = kit.pieces().get(kingSquare);
    if (!king) return;
    const kingAt = squarePoint(kingSquare);
    const checkerAt = facts ? squarePoint(facts.checkers[0] ?? facts.to) : kingAt.clone().setZ(0);
    const along = flatDirection(checkerAt, kingAt);
    const axis = new THREE.Vector3().crossVectors(UP, along).normalize();
    const focus = kingAt.clone().setY(0.52);
    shot(tl, 0, 0.7, closeOn(focus, along, 2.4, 0.74), focus);
    dimKey(tl, 0, 0.42, 0.6);
    beamBetween(tl, 0.72, checkerAt.clone().setY(0.42), kingAt.clone().setY(0.7), 0.7, 0.04);
    tilt(tl, king, axis, 0.12, 0.2, "sine.inOut", 0.7);
    tilt(tl, king, axis, -0.1, 0.24, "sine.inOut", 0.92);
    tilt(tl, king, axis, 0.2, 0.26, "sine.inOut", 1.18);
    tilt(tl, king, axis, -0.16, 0.26, "sine.inOut", 1.46);
    topple(tl, king, along, 1.74, 0.85);
    tl.call(() => fx.burstSparks(kingAt.clone().addScaledVector(along, 0.3).setY(0.05), 110, 1.8, {
      gravity: 1,
      size: 0.016,
      rise: 0.8
    }), [], 2.1);
    ringOut(tl, 2.1, kingAt, 3.2, 1.1);
    flashAt(tl, 2.1, kingAt, 14, 0.8);
    shake(tl, 2.1, 0.07);
    const losers = piecesOf(game).filter(piece => piece.color === loser && piece.role !== "king");
    losers.forEach(piece => {
      const mesh = kit.pieces().get(piece.square);
      if (!mesh) return;
      const at = squarePoint(piece.square);
      const distance = at.distanceTo(kingAt);
      const outward = flatDirection(kingAt, at);
      topple(tl, mesh, outward, 2.3 + distance * 0.24, 0.62);
    });
    const winners = piecesOf(game).filter(piece => piece.color !== loser && piece.role !== "king");
    winners.forEach((piece, i) => {
      const mesh = kit.pieces().get(piece.square);
      if (mesh) tl.to(mesh.position, {
        y: 0.16,
        duration: 0.14,
        yoyo: true,
        repeat: 1,
        ease: "sine.out"
      }, 2.45 + seeded(i) * 0.5);
    });
    const pose = kit.homePose();
    shot(tl, 2.6, 1.3, pose.position.clone().multiplyScalar(0.85), pose.target);
    dimKey(tl, 2.6, 1, 0.8);
    tl.to({}, {
      duration: 0.4
    }, 3.9);
  };
  const standDown = (game, tl) => {
    // Officers bow and pawns hold still: thirty-two separately moving pieces cost too many frames.
    const pieces = piecesOf(game).filter(piece => piece.role !== "pawn");
    const pose = kit.homePose();
    shot(tl, 0, 0.8, pose.position.clone().setY(pose.position.y * 1.15), pose.target);
    pieces.forEach(piece => {
      const mesh = kit.pieces().get(piece.square);
      if (!mesh) return;
      const facing = new THREE.Vector3(0, 0, piece.color === "white" ? -1 : 1);
      const axis = new THREE.Vector3().crossVectors(UP, facing).normalize();
      const lag = piece.square % 8 * 0.05 + (piece.color === "white" ? 0 : 0.08);
      const bow = piece.role === "king" ? 0.62 : 0.38;
      tilt(tl, mesh, axis, bow, 0.34, "sine.inOut", 0.5 + lag);
      tilt(tl, mesh, axis, 0, 0.42, "sine.inOut", 1.1 + lag);
    });
    tl.to({}, {
      duration: 0.2
    }, 1.9);
  };
  const concede = (loser, game, tl) => {
    const kingSquare = kingOf(game, loser);
    const king = kingSquare === undefined ? undefined : kit.pieces().get(kingSquare);
    if (!king || kingSquare === undefined) return;
    const kingAt = squarePoint(kingSquare);
    const focus = kingAt.clone().setY(0.45);
    const along = new THREE.Vector3(loser === "white" ? 1 : -1, 0, 0);
    shot(tl, 0, 0.5, closeOn(focus, along, 2.4, 0.74), focus);
    topple(tl, king, along, 0.5, 0.8);
    ringOut(tl, 0.88, kingAt, 1.3, 0.8);
    const pose = kit.homePose();
    shot(tl, 1.5, 0.9, pose.position, pose.target);
  };
  return {
    build: (kind, facts, game, tl) => {
      const finish = duration => returnHome(tl, duration);
      if (kind === "capture") finish(captureScene(facts, tl, false));else if (kind === "queen-falls") finish(captureScene(facts, tl, true));else if (kind === "en-passant") finish(enPassantScene(facts, tl));else if (kind === "check") finish(checkScene(facts, tl));else if (kind === "castle") finish(castleScene(facts, tl));else if (kind === "promotion") finish(promotionScene(facts, tl, facts.color));else if (kind === "sacrifice") finish(sacrificeScene(facts, tl));else if (kind === "checkmate") {
        if (facts.captured) captureScene(facts, tl, false);else kit.plainMove(facts, tl);
      }
      void game;
    },
    ending: (ending, game, facts, tl) => {
      if (ending.kind === "checkmate") checkmateEnding(ending.winner === "white" ? "black" : "white", game, facts, tl);else if ("winner" in ending) concede(ending.winner === "white" ? "black" : "white", game, tl);else standDown(game, tl);
    }
  };
};