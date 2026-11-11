/*!
 * Chess
 * Copyright (c) Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a19e25-e438-75a3-a372-c9c67de14514
 */
// Intended use: the imperative scene React drives through the store: board, pieces, world dressing, camera rig, pointer input, markers and the plain animation of each move.
import gsap from "gsap";
import * as THREE from "three/webgpu";
import { hash, instanceIndex, mix, sin, time, vec3, float, fract, color as tslColor, positionLocal, screenUV, smoothstep, texture as textureNode, uv, vec4 } from "three/tsl";
import { config } from "../config.js";
import { fileOf, kingInCheck, piecesOf, rankOf, squareName, targetsFrom, turnOf } from "../chess/game.js";
import { prefersReducedMotion } from "../lib/utils.js";
import { cheats } from "../state/cheats.js";
import { attemptMove, setStageStatus, bindStage, canMoveNow, getState, selectSquare, subscribe, tapSquare } from "../state/store.js";
import { createCutscenes } from "./cutscenes.js";
import { createFx } from "./fx.js";
import { createBloom } from "./glow.js";
import { brokenStone, loadBoardMaterial, loadCarving, loadPieceMaterials, loadRoomLight, loadStone, loadWood, loadTableMaterial, mirrorMaterial, roomBackdrop } from "./scanned.js";
import { beamMaterial, markerMaterial, paintBoard, paintPieces, paintTable, releaseMaterial, shaftMaterial } from "./materials.js";
// -----------------------------------------------------------------------------
// Board geometry
// -----------------------------------------------------------------------------
const S = config.board.square;
const DEFAULT_KEY = [3.2, 6.4, 3.4];
const HALF_BOARD = 8 * S / 2 + config.board.frame;
export const squarePosition = (square, target = new THREE.Vector3()) => target.set((fileOf(square) - 3.5) * S, 0, (3.5 - rankOf(square)) * S);
const squareAt = (x, z) => {
  const file = Math.floor(x / S + 4);
  const rank = Math.floor(4 - z / S);
  return file >= 0 && file < 8 && rank >= 0 && rank < 8 ? rank * 8 + file : null;
};
// The coordinates are inlaid: a lit surface in the style's own material, with a fine dark cut
// around each character, so they catch the room's light as the board does.
const coordinateTexture = (world, viewer) => {
  const size = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const unit = size / (2 * HALF_BOARD);
  const center = size / 2;
  const {
    color,
    edge
  } = world.scan.label;
  context.font = `500 ${Math.round(0.125 * unit)}px "Fraunces", Georgia, serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  const label = (text, x, y) => {
    context.save();
    context.translate(center + x * unit, center + y * unit);
    if (viewer === "black") context.rotate(Math.PI);
    context.strokeStyle = edge;
    context.lineWidth = 0.006 * unit;
    context.strokeText(text, 0, 0);
    context.fillStyle = color;
    context.fillText(text, 0, 0);
    context.restore();
  };
  const margin = 4 * S + config.board.frame * (world.scan.labelAt ?? 0.5);
  "abcdefgh".split("").forEach((letter, i) => {
    const x = (i - 3.5) * S;
    // Near edge and left edge only, as seen from the player's seat.
    label(letter, x, viewer === "white" ? margin : -margin);
  });
  "12345678".split("").forEach((digit, i) => {
    const y = (3.5 - i) * S;
    label(digit, viewer === "white" ? -margin : margin, y);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
};
// -----------------------------------------------------------------------------
// Ambient motes, drawn entirely in the shader
// -----------------------------------------------------------------------------
const motesFor = world => {
  const {
    kind,
    color,
    count,
    size
  } = world.motes;
  const material = new THREE.SpriteNodeMaterial({
    transparent: true,
    depthWrite: false
  });
  material.blending = kind === "petal" ? THREE.NormalBlending : THREE.AdditiveBlending;
  const a = hash(instanceIndex);
  const b = hash(instanceIndex.add(1000));
  const c = hash(instanceIndex.add(2000));
  const d = hash(instanceIndex.add(3000));
  const speeds = {
    dust: 0.012,
    petal: -0.03,
    snow: -0.06,
    ember: 0.09,
    pixel: 0.05,
    star: 0
  };
  const climb = fract(c.add(time.mul(speeds[kind]).mul(d.mul(0.7).add(0.6))));
  const height = kind === "star" ? c.mul(0.8).add(0.1) : climb;
  const spread = kind === "star" ? 28 : 8.5;
  const sway = sin(time.mul(d.add(0.35)).add(a.mul(30))).mul(kind === "star" ? 0 : 0.22);
  material.positionNode = vec3(a.sub(0.5).mul(spread).add(sway), height.mul(kind === "star" ? 14 : 4.2).add(kind === "star" ? 2 : -0.1), b.sub(0.5).mul(spread).add(sway.mul(0.6)).sub(kind === "star" ? 10 : 0));
  const round = float(1).sub(smoothstep(0.1, 0.5, uv().sub(0.5).length()));
  const twinkle = sin(time.mul(d.mul(3).add(0.6)).add(a.mul(40))).mul(0.4).add(0.6);
  const fadeEnds = kind === "star" ? float(1) : smoothstep(0, 0.12, height).mul(float(1).sub(smoothstep(0.82, 1, height)));
  material.colorNode = mix(tslColor(color), tslColor("#ffffff"), a.mul(0.2));
  const presence = kind === "dust" ? 0.3 : kind === "star" ? 0.9 : 0.8;
  material.opacityNode = (kind === "pixel" ? float(1) : round).mul(twinkle).mul(fadeEnds).mul(presence);
  material.scaleNode = float(size).mul(d.mul(1.2).add(0.6));
  const sprite = new THREE.Sprite(material);
  sprite.count = count;
  sprite.frustumCulled = false;
  return sprite;
};
export const createStage = ({
  scene,
  camera,
  renderer,
  geometry,
  renderFrame
}) => {
  const dom = renderer.domElement;
  const worldRoot = new THREE.Group();
  const pieceRoot = new THREE.Group();
  const markerRoot = new THREE.Group();
  const fxRoot = new THREE.Group();
  scene.add(worldRoot, pieceRoot, markerRoot, fxRoot);
  const fx = createFx(fxRoot, camera);
  const shardSet = kit => ({
    white: {
      outer: kit.light,
      inner: kit.shardLight
    },
    black: {
      outer: kit.dark,
      inner: kit.shardDark
    }
  });
  const key = new THREE.DirectionalLight(0xffffff, 3);
  key.position.set(...DEFAULT_KEY);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  // Redrawn only when something moves; a still board needs one shadow map, not sixty a second.
  key.shadow.autoUpdate = false;
  key.shadow.needsUpdate = true;
  key.shadow.radius = 5;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.012;
  Object.assign(key.shadow.camera, {
    left: -4,
    right: 4,
    top: 4,
    bottom: -4,
    near: 1,
    far: 16
  });
  const rim = new THREE.DirectionalLight(0xffffff, 1);
  rim.position.set(-4, 3.4, -5);
  const fill = new THREE.HemisphereLight(0xffffff, 0x000000, 0.4);
  scene.add(key, rim, fill);
  const worldKits = new Map();
  const boardKits = new Map();
  const pieceKits = new Map();
  let fractureReady = false;
  let holding = false;
  let presentToken = 0;
  let presenting = Promise.resolve();
  const pmrem = new THREE.PMREMGenerator(renderer);
  let worldKit = null;
  let boardKit = null;
  let pieceKit = null;
  let world = null;
  let viewer = "white";
  let coordinates = null;
  let pieces = new Map();
  let activeScene = null;
  let keyPower = 3;
  let insets = {
    left: 0,
    right: 0,
    bottom: 0,
    top: 0
  };
  let lastSize = "";
  let dressingKey = "";
  let ladderView = false;
  // ---------------------------------------------------------------------------
  // World dressing
  // ---------------------------------------------------------------------------
  const nextPaint = () => new Promise(resolve => {
    // A timer backs up the frame so preparation still finishes in a background tab.
    const timer = setTimeout(resolve, 120);
    requestAnimationFrame(() => {
      clearTimeout(timer);
      resolve();
    });
  });
  // Draws objects once through the real pipeline, behind the veil, so their shaders are
  // compiled and their pipelines exist before anyone can see them.
  const warm = (objects, withEffects = false) => {
    const holder = new THREE.Group();
    if (objects.length) holder.add(...objects);
    scene.add(holder);
    [worldRoot, pieceRoot, markerRoot].forEach(root => {
      root.visible = false;
    });
    fxRoot.visible = withEffects;
    if (withEffects) fx.warmOn();
    camera.position.copy(homePose().position);
    camera.lookAt(homeTarget);
    key.shadow.needsUpdate = true;
    renderFrame();
    if (withEffects) fx.warmOff();
    [worldRoot, pieceRoot, markerRoot, fxRoot].forEach(root => {
      root.visible = true;
    });
    holder.clear();
    scene.remove(holder);
  };
  const flatPlane = size => {
    const plane = new THREE.PlaneGeometry(size, size);
    plane.rotateX(-Math.PI / 2);
    return plane;
  };
  const applyLighting = (next, environment) => {
    scene.environment = environment;
    scene.environmentIntensity = next.light.fill * 1.6;
    key.position.set(...(next.light.from ?? DEFAULT_KEY));
    keyPower = next.light.keyPower;
    key.color.set(next.light.key);
    key.intensity = keyPower;
    rim.color.set(next.light.rim);
    rim.intensity = next.light.rimPower;
    fill.color.set(next.light.key);
    fill.groundColor.set(next.sky.horizon);
    fill.intensity = next.light.fill;
  };
  // ---------------------------------------------------------------------------
  // The pre-rendered room: the camera never moves in play, so a scanned world's room
  // is drawn once at full quality and shown as an image, leaving the frame for pieces
  // ---------------------------------------------------------------------------
  const roomTexture = textureNode(new THREE.Texture(), screenUV);
  const roomMaterial = new THREE.MeshBasicNodeMaterial({
    depthTest: false,
    depthWrite: false
  });
  roomMaterial.colorNode = roomTexture;
  roomMaterial.vertexNode = vec4(positionLocal.xy, 0, 1);
  const roomImage = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), roomMaterial);
  roomImage.frustumCulled = false;
  roomImage.renderOrder = -100;
  roomImage.visible = false;
  scene.add(roomImage);
  // In the room image nothing receives a live shadow, so one invisible plane catches them.
  const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(2 * HALF_BOARD, 2 * HALF_BOARD), new THREE.ShadowNodeMaterial({
    opacity: config.scan.shadowOpacity
  }));
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.position.y = 0.002;
  shadowCatcher.receiveShadow = true;
  shadowCatcher.visible = false;
  scene.add(shadowCatcher);
  // ---------------------------------------------------------------------------
  // Live frames draw into an antialiased buffer and scale up, so quality can change
  // without ever resizing the canvas, which would stall a frame
  // ---------------------------------------------------------------------------
  const liveTexture = textureNode(new THREE.Texture(), screenUV);
  const bloom = createBloom(renderer);
  const liveBlit = new THREE.MeshBasicNodeMaterial({
    depthTest: false,
    depthWrite: false
  });
  liveBlit.colorNode = liveTexture.rgb.add(bloom.added);
  const liveQuad = new THREE.QuadMesh(liveBlit);
  let liveTarget = null;
  let liveScale = 1;
  const drawLive = () => {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const width = Math.max(2, Math.round(size.x * liveScale));
    const height = Math.max(2, Math.round(size.y * liveScale));
    if (!liveTarget || liveTarget.width !== width || liveTarget.height !== height) {
      liveTarget?.dispose();
      liveTarget = new THREE.RenderTarget(width, height, {
        type: THREE.HalfFloatType,
        samples: 4,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter
      });
      liveTexture.value = liveTarget.texture;
    }
    renderer.setRenderTarget(liveTarget);
    renderFrame();
    bloom.run(liveTarget.texture, size.x, size.y);
    liveQuad.render(renderer);
  };
  const roomCopy = textureNode(new THREE.Texture(), screenUV);
  const roomCopyMaterial = new THREE.MeshBasicNodeMaterial({
    toneMapped: false,
    depthTest: false,
    depthWrite: false
  });
  roomCopyMaterial.colorNode = roomCopy.rgb.add(bloom.added);
  const roomCopyQuad = new THREE.QuadMesh(roomCopyMaterial);
  const roomTargets = new Map();
  let roomWanted = false;
  let roomShown = false;
  const roomId = () => {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    return [dressingKey, viewer, ladderView, size.x, size.y, insets.left, insets.bottom, insets.top, getState().profile.settings.coordinates].join("|");
  };
  const showRoomImage = on => {
    roomShown = on;
    roomImage.visible = on;
    shadowCatcher.visible = on;
    worldKit?.group.children.forEach(child => {
      child.visible = !on || child === worldKit?.motes;
    });
    if (boardKit) boardKit.group.visible = !on;
  };
  const drawRoom = () => {
    const id = roomId();
    const existing = roomTargets.get(id);
    if (existing) return existing;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.RenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: 4,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter
    });
    showRoomImage(false);
    if (worldKit) worldKit.motes.visible = false;
    pieceRoot.visible = false;
    markerRoot.visible = false;
    fxRoot.visible = false;
    contacts.visible = false;
    mirrorRoot.visible = false;
    camera.position.copy(homePose().position);
    camera.lookAt(homeTarget);
    camera.updateMatrixWorld();
    key.shadow.needsUpdate = true;
    renderer.setRenderTarget(target);
    renderFrame();
    bloom.run(target.texture, size.x, size.y);
    // Keep only the resolved image: the multisampled buffer alone would cost about 170 MB per room.
    const image = new THREE.RenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter
    });
    roomCopy.value = target.texture;
    renderer.setRenderTarget(image);
    roomCopyQuad.render(renderer);
    renderer.setRenderTarget(null);
    target.dispose();
    pieceRoot.visible = true;
    markerRoot.visible = true;
    fxRoot.visible = true;
    contacts.visible = true;
    if (worldKit) worldKit.motes.visible = true;
    if (roomTargets.size >= config.scan.roomTargets) {
      const [oldest] = roomTargets.keys();
      roomTargets.get(oldest)?.dispose();
      roomTargets.delete(oldest);
    }
    roomTargets.set(id, image);
    key.shadow.needsUpdate = true;
    return image;
  };
  const settleRoom = () => {
    if (!roomWanted) {
      showRoomImage(false);
      return;
    }
    roomTexture.value = drawRoom().texture;
    showRoomImage(true);
    syncDecor();
  };
  // A new window shape needs a new room image, which takes a moment, so the veil covers it.
  const redrawRoom = async () => {
    if (roomTargets.has(roomId())) {
      settleRoom();
      return;
    }
    setStageStatus({
      busy: true,
      label: world?.name ?? "",
      done: 0,
      total: 0
    });
    await nextPaint();
    await nextPaint();
    settleRoom();
    await nextPaint();
    setStageStatus({
      busy: false,
      label: "",
      done: 0,
      total: 0
    });
  };
  // ---------------------------------------------------------------------------
  // What ties a piece to the board: a soft contact shadow and, on polished boards, a reflection
  // ---------------------------------------------------------------------------
  const contactGeometry = new THREE.PlaneGeometry(1, 1);
  contactGeometry.rotateX(-Math.PI / 2);
  const contactMaterial = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false
  });
  contactMaterial.colorNode = vec3(0);
  const contactFalloff = float(1).sub(smoothstep(0.1, 0.5, uv().sub(0.5).length()));
  contactMaterial.opacityNode = contactFalloff.mul(contactFalloff).mul(config.contact.strength);
  const contacts = new THREE.InstancedMesh(contactGeometry, contactMaterial, 40);
  contacts.frustumCulled = false;
  contacts.count = 0;
  contacts.renderOrder = 1;
  scene.add(contacts);
  const mirrorRoot = new THREE.Group();
  mirrorRoot.scale.y = -1;
  mirrorRoot.updateMatrixWorld();
  scene.add(mirrorRoot);
  const mirrors = new Map();
  const contactPose = new THREE.Object3D();
  const syncDecor = () => {
    pieceRoot.updateMatrixWorld();
    const meshes = pieceRoot.children;
    contacts.count = Math.min(meshes.length, 40);
    meshes.slice(0, 40).forEach((mesh, index) => {
      const role = mesh.userData.role;
      const lift = Math.max(0, 1 - mesh.position.y / config.contact.liftFade);
      const size = config.contact[role] * mesh.scale.x * (mesh.visible ? lift : 0);
      contactPose.position.set(mesh.position.x, 0.004, mesh.position.z);
      contactPose.scale.set(Math.max(size, 0.0001), 1, Math.max(size, 0.0001));
      contactPose.updateMatrix();
      contacts.setMatrixAt(index, contactPose.matrix);
    });
    contacts.instanceMatrix.needsUpdate = true;
    const mirrorMaterials = pieceKit?.mirrorLight && pieceKit.mirrorDark;
    mirrors.forEach((mirror, mesh) => {
      if (mesh.parent) return;
      mirrorRoot.remove(mirror);
      mirrors.delete(mesh);
    });
    mirrorRoot.visible = Boolean(mirrorMaterials) && roomShown;
    if (!mirrorMaterials || !roomShown) return;
    meshes.forEach(mesh => {
      const material = mesh.userData.color === "white" ? pieceKit?.mirrorLight : pieceKit?.mirrorDark;
      const existing = mirrors.get(mesh);
      const mirror = existing ?? new THREE.Mesh(mesh.geometry, material);
      if (!existing) {
        mirror.matrixAutoUpdate = false;
        mirrors.set(mesh, mirror);
        mirrorRoot.add(mirror);
      }
      mirror.material = material;
      mirror.visible = mesh.visible;
      mirror.matrix.copy(mesh.matrix);
    });
    mirrorRoot.updateMatrixWorld(true);
  };
  // ---------------------------------------------------------------------------
  // Preparation: one small step per paint, each reported on the veil
  // ---------------------------------------------------------------------------
  Object.values(geometry).forEach(shape => shape.computeBoundingBox());
  const worldSteps = (next, drafts) => {
    const group = new THREE.Group();
    const made = {
      group
    };
    drafts.push(() => releaseWorldKit(made));
    const accent = next.palette.accent;
    const shape = markerMaterial;
    const {
      scan
    } = next;
    return [async () => {
      const light = await loadRoomLight(scan);
      made.environmentTarget = pmrem.fromEquirectangular(light);
      light.dispose();
      made.environment = made.environmentTarget.texture;
      applyLighting(next, made.environment);
    }, () => {
      const backdrop = roomBackdrop(renderer, made.environment, scan.backdrop, next.recipe);
      made.panorama = backdrop.panorama;
      // Where the room is painted, pieces reflect that room and not the scan behind it.
      if (backdrop.reflected) {
        const painted = backdrop.reflected.texture;
        painted.mapping = THREE.EquirectangularReflectionMapping;
        const reflected = pmrem.fromEquirectangular(painted);
        backdrop.reflected.dispose();
        made.environmentTarget.dispose();
        made.environmentTarget = reflected;
        made.environment = reflected.texture;
        applyLighting(next, made.environment);
      }
      const sky = new THREE.Mesh(new THREE.SphereGeometry(34, 48, 32), backdrop.material);
      sky.renderOrder = -10;
      warm([sky]);
      group.add(sky);
    }, async () => {
      const table = new THREE.Mesh(new THREE.CircleGeometry(14, 64), paintTable(renderer, next, await loadStone()) ?? (await loadTableMaterial(scan)));
      table.rotation.x = -Math.PI / 2;
      table.position.y = -geometry.board.boundingBox.getSize(new THREE.Vector3()).y;
      table.receiveShadow = true;
      warm([table]);
      group.add(table);
    }, () => {
      const motes = motesFor(next);
      warm([motes]);
      group.add(motes);
      made.motes = motes;
    }, () => {
      made.markers = {
        selected: shape(next.palette.move, "outline", 0.85),
        selectedWash: shape(next.palette.move, "wash", 0.3),
        quiet: shape(next.palette.move, "dot", 0.75),
        take: shape(next.palette.move, "ring", 0.85),
        last: shape(next.palette.move, "wash", 0.26),
        danger: shape(next.palette.alert, "wash", 0.85),
        hint: shape(next.palette.alert, "outline"),
        focus: shape(next.palette.ink, "outline"),
        rung: shape(accent, "ring")
      };
      warm([...Object.values(made.markers).map(material => new THREE.Mesh(markerGeometry, material)), new THREE.Mesh(contactGeometry, contactMaterial)]);
    }, () => {
      made.shaft = shaftMaterial(accent);
      made.beam = beamMaterial(next.palette.alert);
      fx.setWorld(next, next.debris);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1, 8, 1, true), made.beam.material);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2, 8, 1, true), made.shaft.material);
      warm([beam, shaft], true);
      worldKits.set(next.id, made);
    }];
  };
  const boardSteps = (board, drafts) => {
    const group = new THREE.Group();
    const made = {
      group,
      coordinates: {}
    };
    drafts.push(() => releaseBoardKit(made));
    const {
      scan
    } = board;
    let carving = null;
    return [async () => {
      if (scan.paint) carving = await loadCarving("board");
    }, async () => {
      await document.fonts.load('500 40px "Fraunces"');
      const material = carving ? paintBoard(renderer, board, 2 * HALF_BOARD + 0.02, carving, await loadStone(), await loadWood()) : await loadBoardMaterial(scan);
      const slab = new THREE.Mesh(geometry.board, material);
      // The set is modeled with White on the far side.
      slab.rotation.y = Math.PI;
      slab.castShadow = true;
      slab.receiveShadow = true;
      warm([slab]);
      group.add(slab);
      boardKits.set(board.id, made);
    }];
  };
  const piecesOfColor = color => ["pawn", "knight", "bishop", "rook", "queen", "king"].map(role => geometry[`${color}_${role}`]);
  const pieceSteps = (set, drafts) => {
    const {
      scan
    } = set;
    const made = {};
    drafts.push(() => releasePieceKit(made));
    const setMaps = (light, dark) => {
      made.light = light;
      made.dark = dark;
      made.shardLight = brokenStone(scan.shardLight, scan.brokenGlow);
      made.shardDark = brokenStone(scan.shardDark, scan.brokenGlow);
    };
    const paintSteps = scan.paint ? [async () => {
      const white = await loadCarving("white");
      const light = paintPieces(renderer, set, "light", piecesOfColor("white"), white, await loadStone(), worldKits.get(set.id).panorama);
      made.light = light.material;
      made.mirrorLight = mirrorMaterial(light.made.base, scan.reflection);
    }, async () => {
      const black = await loadCarving("black");
      const dark = paintPieces(renderer, set, "dark", piecesOfColor("black"), black, await loadStone(), worldKits.get(set.id).panorama);
      made.dark = dark.material;
      made.mirrorDark = mirrorMaterial(dark.made.base, scan.reflection);
      setMaps(made.light, made.dark);
    }] : [async () => {
      const loaded = await loadPieceMaterials(scan);
      Object.assign(made, loaded);
    }];
    return [...paintSteps, () => {
      const sample = material => {
        const mesh = new THREE.Mesh(geometry.white_pawn, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
      };
      warm([sample(made.light), sample(made.dark), new THREE.Mesh(geometry.white_pawn, made.mirrorLight), new THREE.Mesh(geometry.white_pawn, made.mirrorDark)]);
    }, () => {
      fx.warmShards(shardSet(made), () => warm([], true));
      pieceKits.set(set.id, made);
    }];
  };
  const fractureSteps = () => [...["white", "black"].flatMap(color => ["pawn", "knight", "bishop", "rook", "queen", "king"].map(role => () => fx.prepareFracture(color, role, geometry[`${color}_${role}`]))), () => {
    fx.makeBatches();
    fractureReady = true;
  }];
  const ensureReady = async (next, token, label) => {
    const drafts = [];
    const steps = [...(fractureReady ? [] : fractureSteps()), ...(worldKits.has(next.id) ? [] : worldSteps(next, drafts)), ...(boardKits.has(next.id) ? [] : boardSteps(next, drafts)), ...(pieceKits.has(next.id) ? [] : pieceSteps(next, drafts))];
    if (!steps.length) return true;
    setStageStatus({
      busy: true,
      label,
      done: 0,
      total: steps.length
    });
    await nextPaint();
    await nextPaint();
    holding = true;
    const finished = await steps.reduce(async (previous, step, index) => {
      if (!(await previous)) return false;
      if (token !== presentToken) return false;
      await step();
      setStageStatus({
        busy: true,
        label,
        done: index + 1,
        total: steps.length
      });
      await nextPaint();
      return true;
    }, Promise.resolve(true));
    holding = false;
    // Abandoned for a newer choice: what was half built must not linger in memory.
    if (!finished) {
      drafts.forEach(release => release());
      worldKits.delete(next.id);
      boardKits.delete(next.id);
      pieceKits.delete(next.id);
    }
    return finished;
  };
  // ---------------------------------------------------------------------------
  // Letting go: one style holds about 300 MB of textures, so only the latest few stay
  // ---------------------------------------------------------------------------
  const releaseWorldKit = kit => {
    kit.group.traverse(child => {
      if (child.isMesh) child.geometry.dispose();
      const {
        material
      } = child;
      if (material) releaseMaterial(material);
    });
    Object.values(kit.markers ?? {}).forEach(releaseMaterial);
    if (kit.shaft) releaseMaterial(kit.shaft.material);
    if (kit.beam) releaseMaterial(kit.beam.material);
    kit.environmentTarget?.dispose();
  };
  const releaseBoardKit = kit => {
    kit.group.children.forEach(child => {
      const material = child.material;
      material.map?.dispose();
      releaseMaterial(material);
    });
  };
  const releasePieceKit = kit => {
    Object.values(kit).forEach(releaseMaterial);
  };
  const rehearsalBeam = new THREE.CylinderGeometry(0.01, 0.01, 0.01, 4, 1, true);
  let recentStyles = [];
  const keepRecent = current => {
    const ordered = [current, ...recentStyles.filter(id => id !== current)];
    recentStyles = ordered.slice(0, config.scan.stylesKept);
    ordered.slice(config.scan.stylesKept).forEach(id => {
      const kits = {
        world: worldKits.get(id),
        board: boardKits.get(id),
        pieces: pieceKits.get(id)
      };
      if (kits.world) releaseWorldKit(kits.world);
      if (kits.board) releaseBoardKit(kits.board);
      if (kits.pieces) releasePieceKit(kits.pieces);
      worldKits.delete(id);
      boardKits.delete(id);
      pieceKits.delete(id);
      [...roomTargets.keys()].filter(room => room.startsWith(`${id}|`)).forEach(room => {
        roomTargets.get(room)?.dispose();
        roomTargets.delete(room);
      });
    });
  };
  const setCoordinates = (board, side) => {
    const kit = boardKits.get(board.id);
    if (coordinates) coordinates.visible = false;
    const existing = kit.coordinates[side];
    const mesh = existing ?? new THREE.Mesh(flatPlane(2 * HALF_BOARD), new THREE.MeshStandardMaterial({
      map: coordinateTexture(board, side),
      transparent: true,
      depthWrite: false,
      metalness: board.scan.label.metal,
      roughness: board.scan.label.rough
    }));
    mesh.position.y = 0.006;
    if (!existing) {
      kit.coordinates[side] = mesh;
      kit.group.add(mesh);
    }
    coordinates = mesh;
    coordinates.visible = getState().profile.settings.coordinates;
  };
  const activate = (next, side) => {
    showRoomImage(false);
    dressingKey = next.id;
    roomWanted = true;
    if (worldKit) worldRoot.remove(worldKit.group);
    if (boardKit) worldRoot.remove(boardKit.group);
    worldKit = worldKits.get(next.id);
    boardKit = boardKits.get(next.id);
    pieceKit = pieceKits.get(next.id) ?? null;
    worldRoot.add(worldKit.group, boardKit.group);
    world = next;
    viewer = side;
    applyLighting(next, worldKit.environment);
    bloom.setLook(next.scan.glow.bloom, next.scan.glow.threshold);
    fx.setWorld(next, next.debris);
    setCoordinates(next, side);
    fx.setShards(shardSet(pieceKit));
    const {
      light,
      dark
    } = pieceKit;
    pieces.forEach(mesh => {
      mesh.material = mesh.userData.color === "white" ? light : dark;
    });
  };
  // Reading one pixel waits for everything queued, so the veil never lifts on a GPU still catching up.
  const finishGpuWork = () => {
    const gl = renderer.getContext();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  };
  const rehearseEffects = () => {
    const kits = worldKit;
    const beam = new THREE.Mesh(rehearsalBeam, kits.beam.material);
    const shaft = new THREE.Mesh(rehearsalBeam, kits.shaft.material);
    fxRoot.add(beam, shaft);
    fx.warmOn();
    key.shadow.needsUpdate = true;
    fx.warmShards(shardSet(pieceKit), drawLive);
    fx.warmOff();
    fxRoot.remove(beam, shaft);
    key.shadow.needsUpdate = true;
  };
  // Everything that changes what's on the board goes through here: wait for any
  // running scene, prepare what's new behind the veil, then swap in a single frame.
  const present = (next, side, swap, label = next.name) => {
    presentToken += 1;
    const token = presentToken;
    const job = (async () => {
      const ready = await ensureReady(next, token, label);
      if (!ready || token !== presentToken) return;
      dressingKey = next.id;
      viewer = side;
      if (!roomTargets.has(roomId()) && !getState().stage.busy) {
        setStageStatus({
          busy: true,
          label,
          done: 0,
          total: 0
        });
        await nextPaint();
        await nextPaint();
      }
      activate(next, side);
      keepRecent(next.id);
      swap();
      liveScale = config.quality.cutsceneScale;
      if (roomWanted) goHome(true);
      // One rehearsal through the live path, debris and light included, so a cutscene's
      // first frame and first break are already prepared.
      showRoomImage(false);
      rehearseEffects();
      settleRoom();
      key.shadow.needsUpdate = true;
      syncDecor();
      // And one through the play path, so the veil lifts on a frame that is already prepared.
      renderFrame();
      finishGpuWork();
      setStageStatus({
        busy: false,
        label: "",
        done: 0,
        total: 0
      });
    })();
    presenting = job;
    return job;
  };
  // ---------------------------------------------------------------------------
  // Pieces
  // ---------------------------------------------------------------------------
  const yawFor = (role, color) => {
    if (role === "knight") return color === "white" ? Math.PI : 0;
    if (role === "bishop") return color === "white" ? Math.PI * 0.75 : -Math.PI * 0.25;
    return 0;
  };
  const spawn = (piece, square) => {
    const material = piece.color === "white" ? pieceKit?.light : pieceKit?.dark;
    const mesh = new THREE.Mesh(geometry[`${piece.color}_${piece.role}`], material);
    squarePosition(square, mesh.position);
    mesh.rotation.y = yawFor(piece.role, piece.color);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = {
      role: piece.role,
      color: piece.color,
      baseYaw: mesh.rotation.y
    };
    pieceRoot.add(mesh);
    return mesh;
  };
  const clearPieces = () => {
    pieces.forEach(mesh => pieceRoot.remove(mesh));
    pieces = new Map();
  };
  const syncBoard = game => {
    const wanted = piecesOf(game);
    const next = new Map();
    const used = new Set();
    wanted.forEach(piece => {
      const existing = pieces.get(piece.square);
      if (existing && existing.userData.role === piece.role && existing.userData.color === piece.color) {
        used.add(existing);
        next.set(piece.square, existing);
      }
    });
    wanted.forEach(piece => {
      if (next.has(piece.square)) return;
      next.set(piece.square, spawn(piece, piece.square));
    });
    pieces.forEach(mesh => {
      if (!used.has(mesh)) pieceRoot.remove(mesh);
    });
    next.forEach((mesh, square) => {
      gsap.killTweensOf(mesh.position);
      squarePosition(square, mesh.position);
      mesh.quaternion.identity();
      mesh.rotation.set(0, mesh.userData.baseYaw, 0);
      mesh.scale.setScalar(1);
      mesh.visible = true;
      delete mesh.userData.tiltProxy;
    });
    pieces = next;
  };
  // ---------------------------------------------------------------------------
  // Camera rig
  // ---------------------------------------------------------------------------
  const homeTarget = new THREE.Vector3(0, 0.1, 0);
  const fittedDistance = polar => {
    const {
      clientWidth,
      clientHeight
    } = dom;
    const width = Math.max(1, clientWidth - insets.right - insets.left);
    const height = Math.max(1, clientHeight - insets.bottom - insets.top);
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const aspect = width / height;
    const span = HALF_BOARD * 2 * config.camera.fitMargin;
    const scale = clientHeight / height;
    const needWidth = span / (2 * Math.tan(verticalFov / 2) * aspect);
    const needHeight = span * (Math.cos(polar) * 0.72 + 0.48) / (2 * Math.tan(verticalFov / 2));
    return Math.max(needWidth, needHeight) * scale;
  };
  const homePose = () => {
    const polar = ladderView ? config.camera.polarLadder : config.camera.polarPlay;
    // The ladder view looks across the board corner to corner, which needs more room.
    const distance = fittedDistance(polar) * (ladderView ? config.camera.ladderRoom : 1);
    const facing = viewer === "white" ? 1 : -1;
    const azimuth = ladderView ? config.camera.azimuthLadder : 0;
    return {
      position: new THREE.Vector3(Math.sin(polar) * Math.sin(azimuth), Math.cos(polar), Math.sin(polar) * Math.cos(azimuth) * facing).multiplyScalar(distance).add(homeTarget),
      target: homeTarget.clone()
    };
  };
  const applyViewOffset = () => {
    const {
      clientWidth: w,
      clientHeight: h
    } = dom;
    if (!w || !h) return;
    const shiftX = (insets.right - insets.left) / 2;
    const shiftY = (insets.bottom - insets.top) / 2;
    camera.setViewOffset(w, h, shiftX, shiftY, w, h);
  };
  const goHome = instant => {
    const pose = homePose();
    gsap.killTweensOf(camera.position);
    if (instant || prefersReducedMotion() || document.hidden) {
      camera.position.copy(pose.position);
      return;
    }
    gsap.to(camera.position, {
      x: pose.position.x,
      y: pose.position.y,
      z: pose.position.z,
      duration: config.motion.resetSeconds,
      ease: "power2.inOut"
    });
  };
  let press = null;
  // ---------------------------------------------------------------------------
  // Markers
  // ---------------------------------------------------------------------------
  const markerGeometry = new THREE.PlaneGeometry(S, S);
  markerGeometry.rotateX(-Math.PI / 2);
  const placeMarker = (kind, square, lift = 0.012) => {
    if (!worldKit) return;
    const mesh = new THREE.Mesh(markerGeometry, worldKit.markers[kind]);
    squarePosition(square, mesh.position);
    mesh.position.y = lift;
    mesh.renderOrder = 2;
    markerRoot.add(mesh);
  };
  let liftedPiece = null;
  const liftSelected = square => {
    const mesh = square === null ? null : pieces.get(square) ?? null;
    if (mesh === liftedPiece) return;
    const previous = liftedPiece;
    if (previous && !activeScene) gsap.to(previous.position, {
      y: 0,
      duration: 0.12,
      ease: "power2.out"
    });
    if (mesh && !activeScene) gsap.to(mesh.position, {
      y: 0.06,
      duration: 0.14,
      ease: "power2.out"
    });
    liftedPiece = mesh;
  };
  const refreshMarkers = () => {
    markerRoot.clear();
    const {
      session,
      profile
    } = getState();
    if (!press?.dragging) liftSelected(session?.selected ?? null);
    if (coordinates) coordinates.visible = profile.settings.coordinates;
    if (!session) return;
    const {
      game,
      selected,
      hint,
      focus,
      phase
    } = session;
    const last = game.history[game.history.length - 1];
    if (last && phase !== "moving") {
      placeMarker("last", last.from, 0.008);
      placeMarker("last", last.to, 0.008);
    }
    const inCheck = kingInCheck(game);
    if (inCheck !== undefined && phase !== "moving") placeMarker("danger", inCheck, 0.01);
    if (selected !== null) {
      placeMarker("selectedWash", selected, 0.009);
      placeMarker("selected", selected);
      if (profile.settings.moveHints) {
        targetsFrom(game, selected).forEach(square => {
          const occupied = game.position.board.get(square);
          placeMarker(occupied ? "take" : "quiet", square);
        });
      }
    }
    if (hint) {
      placeMarker("hint", hint.from);
      placeMarker("hint", hint.to);
    }
    if (focus !== null) placeMarker("focus", focus, 0.014);
  };
  // ---------------------------------------------------------------------------
  // Pointer input: drag a piece, tap a piece then a square, or orbit from elsewhere
  // ---------------------------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const floorHit = new THREE.Vector3();
  const aim = event => {
    const box = dom.getBoundingClientRect();
    pointer.set((event.clientX - box.left) / box.width * 2 - 1, -((event.clientY - box.top) / box.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
  };
  const pickSquare = event => {
    aim(event);
    const hits = raycaster.intersectObjects([...pieces.values()], false);
    const squares = hits.flatMap(hit => [...pieces.entries()].filter(([, mesh]) => mesh === hit.object).map(([square]) => square));
    const {
      session
    } = getState();
    // Pieces overlap in perspective, so a grab prefers one that can actually move.
    const movable = canMoveNow(session) ? squares.find(square => {
      const piece = session.game.position.board.get(square);
      if (session.selected !== null && targetsFrom(session.game, session.selected).includes(square)) return true;
      return piece?.color === session.you && targetsFrom(session.game, square).length > 0;
    }) : undefined;
    if (movable !== undefined) return movable;
    if (squares.length) return squares[0];
    return raycaster.ray.intersectPlane(floorPlane, floorHit) ? squareAt(floorHit.x, floorHit.z) : null;
  };
  const floorSquare = event => {
    aim(event);
    return raycaster.ray.intersectPlane(floorPlane, floorHit) ? squareAt(floorHit.x, floorHit.z) : null;
  };
  const DRAG_THRESHOLD = 6;
  const onDown = event => {
    if (event.button !== 0) return;
    const {
      session
    } = getState();
    if (activeScene || getState().stage.busy) return;
    const square = pickSquare(event);
    press = {
      x: event.clientX,
      y: event.clientY,
      square,
      dragging: null,
      moved: false
    };
    if (!canMoveNow(session) || square === null) return;
    const piece = session.game.position.board.get(square);
    const isTarget = session.selected !== null && targetsFrom(session.game, session.selected).includes(square);
    if (piece?.color === session.you && !isTarget) {
      press.dragging = pieces.get(square) ?? null;
      dom.setPointerCapture(event.pointerId);
    }
  };
  const onMove = event => {
    if (!press) return;
    const distance = Math.hypot(event.clientX - press.x, event.clientY - press.y);
    if (distance > DRAG_THRESHOLD) press.moved = true;
    if (press.dragging && press.moved) {
      const {
        session
      } = getState();
      if (session?.selected !== press.square && press.square !== null) selectSquare(press.square);
      aim(event);
      if (raycaster.ray.intersectPlane(floorPlane, floorHit)) {
        press.dragging.position.set(THREE.MathUtils.clamp(floorHit.x, -HALF_BOARD, HALF_BOARD), 0.16, THREE.MathUtils.clamp(floorHit.z, -HALF_BOARD, HALF_BOARD));
      }
    }
  };
  const onUp = event => {
    const current = press;
    press = null;
    if (!current) return;
    if (current.dragging && current.moved && current.square !== null) {
      const target = floorSquare(event);
      const from = current.square;
      squarePosition(from, current.dragging.position);
      liftedPiece = null;
      if (target !== null && target !== from) attemptMove(from, target);else selectSquare(from);
      return;
    }
    if (!current.moved && current.square !== null) tapSquare(current.square);
  };
  dom.addEventListener("pointerdown", onDown, {
    capture: true
  });
  dom.addEventListener("pointermove", onMove);
  dom.addEventListener("pointerup", onUp);
  dom.addEventListener("pointercancel", () => {
    press = null;
  });
  // ---------------------------------------------------------------------------
  // Running timelines
  // ---------------------------------------------------------------------------
  let sceneEnded = Promise.resolve();
  const idle = () => sceneEnded;
  const run = timeline => {
    sceneEnded = new Promise(resolve => {
      activeScene = timeline;
      timeline.eventCallback("onComplete", () => {
        activeScene = null;
        resolve();
      });
      const debug = window.__chessWatch;
      if (prefersReducedMotion() || document.hidden && !debug) timeline.progress(1);
    });
    return sceneEnded;
  };
  // ---------------------------------------------------------------------------
  // Plain animation of a move: the piece goes where it goes, nothing more
  // ---------------------------------------------------------------------------
  const plainMove = (facts, timeline, at = 0) => {
    const mesh = pieces.get(facts.from);
    if (!mesh) return;
    const destination = squarePosition(facts.to);
    const seconds = facts.role === "knight" ? config.motion.knightHop : config.motion.moveSeconds;
    timeline.to(mesh.position, {
      x: destination.x,
      z: destination.z,
      duration: seconds,
      ease: "power2.inOut"
    }, at);
    const lift = facts.role === "knight" ? 0.42 : 0.07;
    timeline.to(mesh.position, {
      y: lift,
      duration: seconds / 2,
      ease: "sine.out"
    }, at);
    timeline.to(mesh.position, {
      y: 0,
      duration: seconds / 2,
      ease: "sine.in"
    }, at + seconds / 2);
    if (facts.captured) {
      const victim = pieces.get(facts.captured.square);
      if (victim) {
        timeline.to(victim.scale, {
          x: 0.01,
          y: 0.01,
          z: 0.01,
          duration: 0.16,
          ease: "back.in(2)"
        }, at + seconds * 0.62);
      }
    }
    if (facts.rook) {
      const rook = pieces.get(facts.rook.from);
      const rookTo = squarePosition(facts.rook.to);
      if (rook) timeline.to(rook.position, {
        x: rookTo.x,
        z: rookTo.z,
        duration: seconds,
        ease: "power2.inOut"
      }, at + 0.04);
    }
  };
  // ---------------------------------------------------------------------------
  // Cutscene kit
  // ---------------------------------------------------------------------------
  const kit = {
    fx,
    camera,
    key,
    pieces: () => pieces,
    world: () => world,
    demise: () => world.demise,
    shaft: () => worldKit.shaft,
    beam: () => worldKit.beam,
    homePose,
    spawn,
    plainMove,
    fxRoot,
    keyPower: () => keyPower
  };
  const cutscenes = createCutscenes(kit);
  // ---------------------------------------------------------------------------
  // The API the store calls
  // ---------------------------------------------------------------------------
  const api = {
    showLadder: (next, rung, figures) => {
      activeScene?.progress(1);
      fx.clear();
      ladderView = true;
      viewer = "white";
      return present(next, "white", () => {
        clearPieces();
        figures.forEach((role, index) => {
          if (rung >= 8 && role === "king") return;
          const mesh = spawn({
            color: "black",
            role
          }, index * 8 + 3);
          if (index < rung) {
            mesh.rotation.set(Math.PI / 2 - 0.02, mesh.userData.baseYaw, 0.6 + index);
            mesh.position.y = 0.2;
            mesh.position.x -= 0.2;
          }
          pieces.set(index * 8 + 3, mesh);
        });
        const pawnSquare = Math.min(rung, 7) * 8 + 4;
        pieces.set(pawnSquare, spawn({
          color: "white",
          role: rung >= 8 ? "queen" : "pawn"
        }, pawnSquare));
        markerRoot.clear();
        if (rung < 8) placeMarker("rung", rung * 8 + 3);
        goHome(false);
      });
    },
    showGame: (game, you, next) => {
      activeScene?.progress(1);
      fx.clear();
      ladderView = false;
      viewer = you;
      return present(next, you, () => {
        clearPieces();
        syncBoard(game);
        refreshMarkers();
        goHome(false);
      });
    },
    restyle: async next => {
      await idle();
      const side = viewer;
      // A style chosen while the first game was still loading replaces that load, so it places the pieces.
      await present(next, side, () => {
        const {
          session
        } = getState();
        if (session && !pieces.size) syncBoard(session.game);
        // Markers are drawn in a style's own colors, so they're remade with it.
        refreshMarkers();
      });
    },
    playMove: async (facts, game, kind) => {
      await presenting;
      const timeline = gsap.timeline();
      if (kind === "none") plainMove(facts, timeline);else {
        // The camera moves in a cutscene, so the real room takes over from its image.
        showRoomImage(false);
        cutscenes.build(kind, facts, game, timeline);
      }
      await run(timeline);
      fx.tick(0);
      syncBoard(game);
      refreshMarkers();
      if (kind !== "none") settleRoom();
      syncDecor();
    },
    playEnding: async (ending, game, facts) => {
      await presenting;
      showRoomImage(false);
      const timeline = gsap.timeline();
      cutscenes.ending(ending, game, facts, timeline);
      await run(timeline);
    },
    skip: () => {
      if (activeScene) {
        activeScene.progress(1);
        fx.clear();
        goHome(false);
      }
    }
  };
  // ---------------------------------------------------------------------------
  // Frame loop and store wiring
  // ---------------------------------------------------------------------------
  let markerKey = "";
  let wasMoving = false;
  let layerStale = false;
  const unsubscribe = subscribe(() => {
    const {
      session,
      profile
    } = getState();
    if (!session) return;
    // Clocks update the store four times a second; markers only care about these.
    const nextKey = [session.game.history.length, session.selected, session.focus, session.phase, session.hint?.from, session.hint?.to, profile.settings.coordinates, profile.settings.moveHints].join();
    if (nextKey === markerKey) return;
    markerKey = nextKey;
    refreshMarkers();
  });
  gsap.ticker.lagSmoothing(0);
  if (cheats.speed) gsap.globalTimeline.timeScale(cheats.speed);
  bindStage(api);
  return {
    isHolding: () => holding,
    draw: () => {
      if (roomShown) renderFrame();else drawLive();
    },
    lowerQuality: () => {
      liveScale = Math.max(config.quality.minLiveScale, liveScale * config.quality.stepDown);
    },
    // Resizing the canvas takes a moment, so it waits for a moment nothing is moving.
    isStill: () => activeScene === null && press === null,
    tick: delta => {
      if (holding) return;
      const size = `${dom.clientWidth}x${dom.clientHeight}:${insets.left}:${insets.right}:${insets.bottom}:${insets.top}`;
      if (size !== lastSize) {
        lastSize = size;
        applyViewOffset();
        if (!activeScene) goHome(true);
        layerStale = true;
      }
      if (layerStale && !activeScene && roomShown) {
        layerStale = false;
        void redrawRoom();
      }
      fx.tick(delta * (cheats.speed ?? 1));
      if (!activeScene) camera.lookAt(homeTarget);
      const moving = activeScene !== null || press !== null || gsap.globalTimeline.getChildren(false, true, true).length > 0;
      if (moving || wasMoving) {
        key.shadow.needsUpdate = true;
        syncDecor();
      }
      wasMoving = moving;
    },
    setInsets: next => {
      insets = next;
    },
    dispose: () => {
      unsubscribe();
      bindStage(null);
    },
    debug: {
      api,
      timeline: () => activeScene,
      squareName,
      turnOf
    }
  };
};