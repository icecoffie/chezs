/*!
 * Chess
 * Copyright (c) Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a19e25-e438-75a3-a372-c9c67de14514
 */
// Intended use: the debris of cutscenes: chunks cut from the real piece, simple falling physics, glowing sparks, spreading pools, shockwave rings and flashes, all pooled and reused.
import * as THREE from "three/webgpu";
import { seeded } from "../lib/utils.js";
import { fractureMesh } from "./fracture.js";
import { poolMaterial, shockwaveMaterial, sparkMaterial } from "./materials.js";
// -----------------------------------------------------------------------------
// Fracture: one batch per color and surface, so all debris together is two or four draws
// -----------------------------------------------------------------------------
const CHUNKS = {
  pawn: 14,
  knight: 20,
  bishop: 20,
  rook: 22,
  queen: 22,
  king: 24
};
const SHARD_LIMIT = 72;
const SPARK_LIMIT = 420;
const RING_LIMIT = 6;
const POOL_LIMIT = 3;
const GRAVITY = 5.4;
const SPARK_SPREAD = {
  glow: 3.2,
  drop: 2.2,
  pixel: 2,
  dust: 3.2
};
// -----------------------------------------------------------------------------
// The effects kit
// -----------------------------------------------------------------------------
export const createFx = (root, camera) => {
  let shards = [];
  const fractured = new Map();
  let chunksOf = new Map();
  let batches = null;
  const makeBatches = () => {
    const totals = (color, part) => [...fractured.entries()].filter(([key]) => key.startsWith(color)).flatMap(([, chunks]) => chunks).reduce((sum, chunk) => sum + chunk[part].getAttribute("position").count, 0);
    const placeholder = new THREE.MeshBasicNodeMaterial();
    const batchOf = (color, part) => {
      const mesh = new THREE.BatchedMesh(SHARD_LIMIT, totals(color, part), undefined, placeholder);
      mesh.frustumCulled = false;
      mesh.perObjectFrustumCulled = false;
      mesh.sortObjects = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
      return mesh;
    };
    const build = color => {
      const outer = batchOf(color, "outer");
      const inner = batchOf(color, "inner");
      [...fractured.entries()].filter(([key]) => key.startsWith(color)).forEach(([key, chunks]) => {
        chunksOf.set(key, chunks.map(chunk => ({
          ...chunk,
          id: {
            outer: outer.addGeometry(chunk.outer),
            inner: inner.addGeometry(chunk.inner)
          }
        })));
      });
      Array.from({
        length: SHARD_LIMIT
      }).forEach(() => {
        [outer, inner].forEach(mesh => mesh.setVisibleAt(mesh.addInstance(0), false));
      });
      return {
        outer,
        inner,
        free: Array.from({
          length: SHARD_LIMIT
        }, (_, index) => index)
      };
    };
    chunksOf = new Map();
    batches = {
      white: build("white"),
      black: build("black")
    };
  };
  const setShards = set => {
    if (!batches) return;
    ["white", "black"].forEach(color => {
      batches[color].outer.material = set[color].outer;
      batches[color].inner.material = set[color].inner;
    });
  };
  let sparks = [];
  let speed = 1;
  const sparkGeometry = new THREE.PlaneGeometry(1, 1);
  const sparkMaterials = {
    glow: sparkMaterial("glow"),
    drop: sparkMaterial("drop"),
    pixel: sparkMaterial("pixel"),
    dust: sparkMaterial("dust")
  };
  const sparkMesh = new THREE.InstancedMesh(sparkGeometry, sparkMaterials.glow, SPARK_LIMIT);
  sparkMesh.frustumCulled = false;
  sparkMesh.count = 0;
  root.add(sparkMesh);
  let sparkLook = "glow";
  const poolGeometry = new THREE.PlaneGeometry(1, 1);
  poolGeometry.rotateX(-Math.PI / 2);
  const poolKits = new Map();
  let poolKit = [];
  let poolIndex = 0;
  const ringGeometry = new THREE.PlaneGeometry(1, 1);
  ringGeometry.rotateX(-Math.PI / 2);
  let ringKit = [];
  let ringIndex = 0;
  const ringKits = new Map();
  const dummy = new THREE.Object3D();
  const turn = new THREE.Vector3();
  const spinStep = new THREE.Quaternion();
  const shardMatrix = new THREE.Matrix4();
  const shardScale = new THREE.Vector3();
  const tinted = new THREE.Color();
  let world = null;
  const setWorld = (next, debris) => {
    world = next;
    ringKit.forEach(({
      mesh
    }) => root.remove(mesh));
    poolKit.forEach(({
      mesh
    }) => root.remove(mesh));
    sparkLook = next.demise === "inkburst" ? "drop" : next.demise === "pixelate" ? "pixel" : next.demise === "collapse" ? "glow" : "dust";
    sparkMesh.material = sparkMaterials[sparkLook];
    const poolKey = `${next.demise}|${debris}`;
    const pools = poolKits.get(poolKey) ?? Array.from({
      length: POOL_LIMIT
    }, () => {
      const {
        material,
        spread,
        fade
      } = poolMaterial(debris);
      const mesh = new THREE.Mesh(poolGeometry, material);
      mesh.visible = false;
      mesh.renderOrder = 1;
      return {
        mesh,
        spread: spread,
        fade: fade
      };
    });
    poolKits.set(poolKey, pools);
    poolKit = pools;
    poolKit.forEach(({
      mesh
    }) => root.add(mesh));
    const accent = next.palette.accent;
    const kit = ringKits.get(accent) ?? Array.from({
      length: RING_LIMIT
    }, () => {
      const {
        material,
        fade
      } = shockwaveMaterial(accent);
      const mesh = new THREE.Mesh(ringGeometry, material);
      mesh.visible = false;
      return {
        mesh,
        fade: fade
      };
    });
    ringKits.set(accent, kit);
    ringKit = kit;
    ringKit.forEach(({
      mesh
    }) => root.add(mesh));
    tinted.set(debris);
    Array.from({
      length: SPARK_LIMIT
    }).forEach((_, i) => sparkMesh.setColorAt(i, tinted));
    if (sparkMesh.instanceColor) sparkMesh.instanceColor.needsUpdate = true;
  };
  const releaseShard = ({
    batch,
    slot
  }) => {
    batch.outer.setVisibleAt(slot, false);
    batch.inner.setVisibleAt(slot, false);
    batch.free.push(slot);
  };
  const clear = () => {
    shards.forEach(releaseShard);
    shards = [];
    poolKit.forEach(({
      mesh
    }) => {
      mesh.visible = false;
    });
    sparks = [];
    sparkMesh.count = 0;
    ringKit.forEach(({
      mesh
    }) => {
      mesh.visible = false;
    });
    speed = 1;
  };
  const burstShards = (role, source, options) => {
    const {
      at,
      direction = new THREE.Vector3(),
      force = 1,
      split,
      gravity = 1,
      attract = false,
      life = 1.7
    } = options;
    const color = source.userData.color;
    const chunks = chunksOf.get(`${color}_${role}`);
    if (!batches || !chunks) return;
    const batch = batches[color];
    const pose = source.quaternion.clone();
    const made = chunks.flatMap((chunk, index) => {
      const slot = batch.free.pop();
      if (slot === undefined) return [];
      batch.outer.setGeometryIdAt(slot, chunk.id.outer);
      batch.inner.setGeometryIdAt(slot, chunk.id.inner);
      batch.outer.setVisibleAt(slot, true);
      batch.inner.setVisibleAt(slot, true);
      const center = chunk.center.clone().multiply(source.scale).applyQuaternion(pose);
      const outward = center.clone().setY(center.y * 0.25).normalize();
      const scatter = new THREE.Vector3(seeded(index + 13) - 0.5, seeded(index + 17), seeded(index + 19) - 0.5);
      const velocity = outward.multiplyScalar(0.9 * force).add(scatter.multiplyScalar(1.5 * force)).add(direction.clone().multiplyScalar(1.4 * force));
      if (split) {
        const side = center.clone().dot(split) >= 0 ? 1 : -1;
        velocity.add(split.clone().multiplyScalar(side * 1.7 * force));
      }
      return [{
        batch,
        slot,
        scale: source.scale.clone(),
        rest: Math.min(chunk.size.x, chunk.size.y, chunk.size.z) * 0.5,
        // The break runs through the piece from the side that was struck.
        delay: THREE.MathUtils.clamp((center.dot(direction) + 0.2) * 0.16, 0, 0.07),
        position: at.clone().add(center),
        rotation: pose.clone(),
        velocity,
        spin: new THREE.Vector3(seeded(index + 23) - 0.5, seeded(index + 29) - 0.5, seeded(index + 31) - 0.5).multiplyScalar(11),
        life: life + seeded(index + 37) * 0.5,
        age: 0,
        gravity: GRAVITY * gravity,
        attract: attract ? at.clone().add(new THREE.Vector3(0, 0.34, 0)) : null
      }];
    });
    shards = [...shards, ...made];
  };
  const burstSparks = (at, count, power, options = {}) => {
    const {
      gravity = 1,
      size = 0.018,
      rise = 1,
      life = 0.95
    } = options;
    const fresh = Array.from({
      length: count
    }, (_, i) => {
      const angle = seeded(i + sparks.length) * Math.PI * 2;
      const lift = seeded(i * 3 + 5) * rise;
      const reach = seeded(i * 5 + 11);
      return {
        position: at.clone(),
        velocity: new THREE.Vector3(Math.cos(angle) * reach, lift, Math.sin(angle) * reach).multiplyScalar(power),
        life: life * (0.55 + seeded(i * 7 + 13)),
        age: 0,
        size: size * (0.5 + seeded(i * 11 + 17)),
        gravity: GRAVITY * gravity,
        drag: 0.6
      };
    });
    sparks = [...sparks, ...fresh].slice(-SPARK_LIMIT);
  };
  const pool = (at, reach) => {
    const kit = poolKit[poolIndex % POOL_LIMIT];
    poolIndex += 1;
    kit.mesh.position.copy(at).setY(0.014);
    kit.mesh.scale.setScalar(reach);
    kit.mesh.visible = true;
    kit.spread.value = 0;
    kit.fade.value = 1;
    return {
      spread: kit.spread,
      fade: kit.fade,
      hide: () => {
        kit.mesh.visible = false;
      }
    };
  };
  const shockwave = (at, reach, duration) => {
    const ring = ringKit[ringIndex % RING_LIMIT];
    ringIndex += 1;
    ring.mesh.position.copy(at).setY(at.y + 0.012);
    ring.mesh.scale.setScalar(0.1);
    ring.mesh.visible = true;
    ring.fade.value = 1;
    return {
      ...ring,
      reach,
      duration
    };
  };
  const tick = rawDelta => {
    const delta = rawDelta * speed;
    shards = shards.filter(shard => {
      const {
        position,
        velocity,
        spin,
        rotation
      } = shard;
      shard.age += delta;
      if (shard.age > shard.delay) {
        if (shard.attract) {
          const pull = shard.attract.clone().sub(position);
          velocity.addScaledVector(pull, delta * 34).multiplyScalar(0.94);
        } else {
          velocity.y -= shard.gravity * delta;
        }
        position.addScaledVector(velocity, delta);
        if (position.y < shard.rest && !shard.attract) {
          position.y = shard.rest;
          velocity.y *= -0.36;
          velocity.x *= 0.62;
          velocity.z *= 0.62;
          spin.multiplyScalar(0.55);
        }
        turn.set(spin.x * delta, spin.y * delta, spin.z * delta).normalize();
        rotation.premultiply(spinStep.setFromAxisAngle(turn, spin.length() * delta));
      }
      if (shard.age >= shard.life) {
        releaseShard(shard);
        return false;
      }
      const shrink = Math.min(1, Math.max(0.001, (shard.life - shard.age) / 0.35));
      shardMatrix.compose(position, rotation, shardScale.copy(shard.scale).multiplyScalar(shrink));
      shard.batch.outer.setMatrixAt(shard.slot, shardMatrix);
      shard.batch.inner.setMatrixAt(shard.slot, shardMatrix);
      return true;
    });
    sparks = sparks.filter(spark => {
      spark.age += delta;
      spark.velocity.y -= spark.gravity * delta;
      spark.velocity.multiplyScalar(1 - spark.drag * delta);
      spark.position.addScaledVector(spark.velocity, delta);
      if (spark.position.y < 0.01) {
        spark.position.y = 0.01;
        spark.velocity.y *= -0.3;
      }
      return spark.age < spark.life;
    });
    sparks.forEach((spark, i) => {
      dummy.position.copy(spark.position);
      // Each spark is a small sheet facing the camera, drawn with its own soft glow around it.
      dummy.scale.setScalar(spark.size * SPARK_SPREAD[sparkLook] * Math.max(0, 1 - spark.age / spark.life));
      dummy.quaternion.copy(camera.quaternion);
      dummy.updateMatrix();
      sparkMesh.setMatrixAt(i, dummy.matrix);
    });
    sparkMesh.count = sparks.length;
    sparkMesh.instanceMatrix.needsUpdate = true;
  };
  // Shows every effect once, so its shaders exist before the first cutscene needs them.
  const warmOn = () => {
    ringKit.forEach(({
      mesh,
      fade
    }) => {
      mesh.visible = true;
      fade.value = 1;
    });
    poolKit.forEach(({
      mesh,
      fade
    }) => {
      mesh.visible = true;
      fade.value = 1;
    });
    dummy.position.set(0, 0.5, 0);
    dummy.scale.setScalar(0.01);
    dummy.updateMatrix();
    sparkMesh.setMatrixAt(0, dummy.matrix);
    sparkMesh.count = 1;
  };
  const warmOff = () => {
    ringKit.forEach(({
      mesh
    }) => {
      mesh.visible = false;
    });
    poolKit.forEach(({
      mesh
    }) => {
      mesh.visible = false;
    });
    sparkMesh.count = 0;
  };
  return {
    setShards,
    warmOn,
    warmOff,
    prepareFracture: (color, role, source) => {
      fractured.set(`${color}_${role}`, fractureMesh(source, CHUNKS[role]));
    },
    makeBatches,
    // Draws each set's chunks once, so their shaders exist before the first capture.
    warmShards: (set, draw) => {
      if (!batches) return;
      setShards(set);
      const ready = batches;
      const meshes = ["white", "black"].flatMap(color => [ready[color].outer, ready[color].inner]);
      dummy.position.set(0, 0.2, 0);
      dummy.quaternion.identity();
      dummy.scale.setScalar(0.02);
      dummy.updateMatrix();
      meshes.forEach(mesh => {
        mesh.setMatrixAt(0, dummy.matrix);
        mesh.setVisibleAt(0, true);
      });
      draw();
      meshes.forEach(mesh => mesh.setVisibleAt(0, false));
    },
    setWorld,
    clear,
    tick,
    burstShards,
    burstSparks,
    pool,
    shockwave,
    setSpeed: value => {
      speed = value;
    },
    get world() {
      return world;
    }
  };
};