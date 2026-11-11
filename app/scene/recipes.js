/*!
 * Chess
 * Copyright (c) Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a19e25-e438-75a3-a372-c9c67de14514
 */
// Intended use: what each style's surfaces are made of: one finish recipe per style for pieces, squares, frame and floor, built on real scanned stone and the set's own carving. Judged at the play view, beside the Club Room: quiet floors, believable materials, nothing that glows without a reason.
import { abs, color, float, fract, hash, mix, mx_fractal_noise_float, mx_noise_float, mx_worley_noise_float, smoothstep, step, vec2, vec3 } from "three/tsl";
import { config } from "../config.js";
// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
const tint = hex => color(hex);
const blend = (a, b, t) => mix(a, b, t);
const asCoord = node => node;
const noise = (at, scale) => mx_noise_float(at.mul(scale)).mul(0.5).add(0.5);
const fractal = (at, scale, octaves = 4) => mx_fractal_noise_float(at.mul(scale), octaves, 2, 0.5).mul(0.5).add(0.5);
const crackle = (at, scale, width) => {
  const a = mx_worley_noise_float(at.mul(scale));
  const b = mx_worley_noise_float(at.mul(scale).add(vec3(3.7, 1.3, 9.1)));
  return float(1).sub(smoothstep(0, width, abs(a.sub(b))));
};
const squareSize = config.board.square;
const oldGold = wear => blend(tint("#7d5a24"), tint("#c9a25c"), wear);
// A floor with almost nothing on it: broad, slow tone and a little grain, so the board stands out.
const quietFloor = (dark, lift, roughness) => ({
  at
}) => ({
  color: blend(tint(dark), tint(lift), fractal(at, 1.1, 3)),
  roughness: blend(float(roughness), float(roughness + 0.12), fractal(at, 7, 2))
});
// -----------------------------------------------------------------------------
// The Ink Garden: glazed porcelain standing in ink, black lacquer, washes of ink on paper
// -----------------------------------------------------------------------------
const ink = {
  wobble: 0.01,
  inlay: "#4a1c14",
  piece: ({
    at,
    crevice
  }, tone) => {
    if (tone === "light") {
      const crazing = crackle(at, 14, 0.01);
      // Ink has crept up the foot of each piece and settled in its carving.
      const reach = at.y.add(fractal(at, 8).sub(0.5).mul(0.08));
      const foot = float(1).sub(smoothstep(0.01, 0.07, reach));
      const glaze = blend(tint("#e2ddcf"), tint("#8f8a7c"), crazing.mul(0.35));
      return {
        color: blend(glaze, tint("#141414"), foot.max(crevice.mul(0.3))),
        roughness: 0.34,
        clearcoat: 0.3
      };
    }
    return {
      color: blend(tint("#26262a"), tint("#38383d"), fractal(asCoord(at.mul(vec3(2, 0.4, 2))), 3)),
      roughness: 0.34,
      clearcoat: 0.3
    };
  },
  square: ({
    at,
    edge,
    cell
  }, tone) => {
    const fibres = fractal(asCoord(at.mul(vec3(1, 1, 16))), 9, 3);
    const paper = blend(tint("#a39a84"), tint("#b8ae98"), fibres);
    if (tone === "light") return {
      color: paper,
      roughness: 0.96
    };
    // A wash, not a scratch: slow, wet tone with the brush only just visible in it.
    const angle = hash(cell.x.add(cell.y.mul(8))).mul(0.5).sub(0.25);
    const along = at.x.mul(angle.cos()).add(at.z.mul(angle.sin()));
    const across = at.z.mul(angle.cos()).sub(at.x.mul(angle.sin()));
    const bristles = fractal(asCoord(vec3(along.mul(1.2), cell.x.add(cell.y), across.mul(11))), 1, 3);
    const load = fractal(at, 3.4, 4);
    const wash = blend(tint("#6e6a61"), tint("#4b4842"), bristles.mul(0.3).add(load.mul(0.7)));
    // Wet ink pools against the edge of a stroke as it dries.
    const pooled = float(1).sub(smoothstep(0, 0.045, edge));
    return {
      color: blend(wash, tint("#35332e"), pooled.mul(0.7)),
      roughness: 0.78
    };
  },
  frame: ({
    wood
  }) => ({
    color: blend(tint("#4a3b2d"), tint("#5c4a38"), wood(1.4)),
    roughness: 0.62
  })
};
// -----------------------------------------------------------------------------
// The Glacier: clear and blue-black ice with fracture planes hung inside, frozen on rock
// -----------------------------------------------------------------------------
const ice = {
  clear: true,
  inlay: "#7f9cac",
  relief: 0.6,
  table: {
    tile: 5,
    finish: quietFloor("#4e5256", "#5e6266", 0.78)
  },
  piece: ({
    at,
    stone
  }, tone) => {
    const planes = smoothstep(0.3, 0.85, stone(2.4));
    return tone === "light" ? {
      color: blend(tint("#c6dce6"), tint("#eef6f9"), planes),
      roughness: 0.22,
      clearcoat: 0.3
    } : {
      color: blend(blend(tint("#0e2433"), tint("#163a52"), fractal(at, 4, 3)), tint("#5f97b0"), planes.mul(0.4)),
      roughness: 0.22,
      clearcoat: 0.3
    };
  },
  square: ({
    at,
    stone
  }, tone) => {
    const planes = smoothstep(0.35, 1, stone(0.9));
    const haze = fractal(at, 2.2, 4);
    return tone === "light" ? {
      color: blend(blend(tint("#7392a2"), tint("#8fabb8"), haze), tint("#bcd2dc"), planes.mul(0.5)),
      roughness: blend(float(0.36), float(0.2), haze)
    } : {
      color: blend(blend(tint("#3a5a6c"), tint("#4a6c7e"), haze), tint("#8fb0c0"), planes.mul(0.22)),
      roughness: 0.3,
      clearcoat: 0.25
    };
  },
  frame: ({
    at
  }) => ({
    color: blend(tint("#3a3f44"), tint("#4c5258"), fractal(at, 3, 3)),
    roughness: 0.8
  })
};
// -----------------------------------------------------------------------------
// The Courtyard: pale travertine and old bronze on terracotta, in low afternoon sun
// -----------------------------------------------------------------------------
const courtyard = {
  relief: 0.8,
  inlay: "#4a3524",
  piece: ({
    at,
    crevice,
    stone
  }, tone) => {
    if (tone === "light") {
      const bedding = fractal(asCoord(at.mul(vec3(2, 22, 2))), 1, 3);
      const pits = smoothstep(0.68, 0.82, fractal(at, 46, 2)).mul(0.22);
      return {
        color: blend(blend(blend(tint("#b3a386"), tint("#d6c9ae"), bedding), tint("#7d6e56"), pits), tint("#5e5240"), crevice.mul(0.6)),
        roughness: 0.74
      };
    }
    // Old bronze: dark where handled, and green only where rain has sat in the carving.
    const handled = fractal(at, 6, 3);
    const verdigris = smoothstep(0.45, 0.95, crevice).mul(smoothstep(0.35, 0.7, fractal(at, 16, 3)).mul(0.65)).min(1);
    const body = blend(tint("#2c1d10"), tint("#6b4a28"), handled.mul(stone(2).mul(0.3).add(0.7)));
    return {
      color: blend(body, tint("#6f8a78"), verdigris),
      roughness: blend(blend(float(0.52), float(0.64), handled), float(0.86), verdigris),
      metalness: float(0.22).mul(float(1).sub(verdigris))
    };
  },
  square: ({
    at,
    edge,
    cell,
    stone
  }, tone) => {
    const worn = float(1).sub(smoothstep(0, 0.035, edge));
    if (tone === "light") {
      const bedding = fractal(asCoord(at.mul(vec3(1, 1, 9))), 2.4, 3);
      const pits = smoothstep(0.66, 0.8, fractal(at, 30, 2)).mul(0.35);
      return {
        color: blend(blend(blend(tint("#a99a7e"), tint("#c9bda3"), bedding), tint("#7a6d58"), pits), tint("#6e6250"), worn.mul(0.5)),
        roughness: 0.82
      };
    }
    // Each tile fired a little differently.
    const firing = hash(cell.x.add(cell.y.mul(8)).add(40));
    const clay = blend(tint("#6e4128"), tint("#865436"), firing);
    return {
      color: blend(blend(clay, tint("#55311d"), fractal(at, 5, 3).mul(0.5)), tint("#3c1c0f"), worn.mul(0.5).add(stone(1).mul(0.12))),
      roughness: 0.84
    };
  },
  frame: ({
    wood
  }) => ({
    color: blend(tint("#5e4630"), tint("#73583d"), wood(1.4)),
    roughness: 0.6
  })
};
// -----------------------------------------------------------------------------
// The Arcade: black and pearl lacquer lit by the screens, on a phosphor screen of its own
// -----------------------------------------------------------------------------
const phosphor = at => {
  const grid = vec2(at.x, at.z).mul(16 / squareSize);
  const dot = fract(grid).sub(0.5).length();
  return float(1).sub(smoothstep(0.22, 0.42, dot));
};
const arcade = {
  relief: 0.25,
  inlay: "#6d2a60",
  // A dark polished floor: the color comes from the room, not from a pattern.
  table: {
    tile: 5,
    finish: quietFloor("#2c2b34", "#37363f", 0.82)
  },
  piece: ({
    crevice
  }, tone) => tone === "light" ? {
    color: blend(tint("#e2e5e8"), tint("#5a6c78"), crevice.mul(0.3)),
    roughness: 0.34,
    clearcoat: 0.3
  } : {
    color: blend(tint("#4e1f46"), tint("#6a2c5e"), crevice),
    roughness: 0.34,
    clearcoat: 0.3
  },
  square: ({
    at,
    edge
  }, tone) => {
    const dots = phosphor(at);
    const panel = smoothstep(0, 0.3, edge).mul(0.45).add(0.55);
    return tone === "light" ? {
      color: tint("#1f6470"),
      roughness: 0.34,
      clearcoat: 0.2,
      emissive: tint("#2f9fb0").mul(dots.mul(0.46).add(0.05).mul(panel))
    } : {
      color: blend(tint("#463f70"), tint("#524a80"), edge.mul(2)),
      roughness: 0.42,
      clearcoat: 0.2
    };
  },
  frame: ({
    at
  }) => ({
    color: blend(tint("#3a3844"), tint("#44424e"), fractal(at, 3, 2)),
    roughness: 0.46,
    clearcoat: 0.2
  })
};
// -----------------------------------------------------------------------------
// The Jade Temple: nephrite and deep jade, cinnabar lacquer, gold only in the carving
// -----------------------------------------------------------------------------
const jade = {
  engraving: "fretwork",
  relief: 0.5,
  inlay: "#8a6a30",
  table: {
    tile: 5,
    finish: quietFloor("#3c3f38", "#4c4f46", 0.72)
  },
  piece: ({
    at,
    crevice,
    stone
  }, tone) => {
    const leaf = smoothstep(0.35, 0.8, crevice);
    if (tone === "light") {
      const cloud = stone(1.5).mul(0.55).add(fractal(at, 5, 4).mul(0.45));
      return {
        color: blend(blend(tint("#c5d0b4"), tint("#e6ead6"), cloud), oldGold(fractal(at, 40, 2)), leaf),
        roughness: blend(float(0.34), float(0.36), leaf),
        metalness: leaf,
        clearcoat: 0.2
      };
    }
    return {
      color: blend(blend(tint("#4a0d10"), tint("#6e1a1a"), fractal(at, 3, 3).mul(0.7).add(stone(2).mul(0.2))), oldGold(fractal(at, 40, 2)), leaf),
      roughness: blend(float(0.32), float(0.42), leaf),
      metalness: leaf,
      clearcoat: 0.25
    };
  },
  square: ({
    at,
    edge,
    stone
  }, tone) => {
    const keyline = float(1).sub(smoothstep(0.004, 0.009, edge));
    const cloud = stone(1).mul(0.6).add(fractal(at, 3, 4).mul(0.4));
    const body = tone === "light" ? blend(tint("#8ea48c"), tint("#a6b89e"), cloud) : blend(tint("#2c5c4a"), tint("#3a6c5a"), cloud);
    return {
      color: blend(body, oldGold(0.6), keyline),
      roughness: blend(float(tone === "light" ? 0.28 : 0.2), float(0.36), keyline),
      metalness: keyline,
      clearcoat: 0.25
    };
  },
  // The fret is cut into the lacquer and only touched with gold, so it stays in the frame's tone.
  frame: ({
    wood,
    mask
  }) => ({
    color: blend(blend(tint("#3a2a1c"), tint("#4a3726"), wood(1.4)), tint("#8a6c38"), mask.x.mul(0.6)),
    roughness: blend(float(0.26), float(0.4), mask.x),
    metalness: mask.x.mul(0.5),
    clearcoat: 0.15
  })
};
// -----------------------------------------------------------------------------
// The Observatory: a star chart engraved across brass and enamel, brass instruments as pieces
// -----------------------------------------------------------------------------
const aventurine = (at, scale) => {
  const cell = mx_worley_noise_float(at.mul(scale));
  return float(1).sub(smoothstep(0, 0.08, cell)).mul(step(0.68, noise(at, scale * 0.3)));
};
const observatory = {
  engraving: "star-chart",
  relief: 0.3,
  inlay: "#3f2e14",
  table: {
    tile: 5,
    finish: quietFloor("#262b42", "#333955", 0.72)
  },
  piece: ({
    at,
    crevice
  }, tone) => {
    if (tone === "light") {
      const brushed = fractal(asCoord(vec3(at.x.mul(4), at.y.mul(70), at.z.mul(4))), 2, 2);
      return {
        color: blend(blend(tint("#b58a3e"), tint("#d0a553"), brushed), tint("#4a3616"), crevice.mul(0.4)),
        roughness: 0.42,
        metalness: 0.75,
        emissive: tint("#6f5222").mul(float(1).sub(crevice).mul(0.26))
      };
    }
    const flecks = aventurine(at, 90);
    return {
      color: blend(blend(blend(tint("#0b0e2a"), tint("#111538"), fractal(at, 4, 3)), tint("#c9a860"), flecks.mul(0.6)), tint("#9c7a3c"), crevice),
      roughness: blend(float(0.44), float(0.48), crevice),
      metalness: flecks.mul(0.4).max(crevice.mul(0.8)),
      clearcoat: 0.12
    };
  },
  square: ({
    at,
    mask
  }, tone) => {
    if (tone === "light") {
      const aged = fractal(at, 3.5, 3);
      return {
        color: blend(blend(tint("#cfc3a4"), tint("#dcd2b6"), aged), tint("#4a3c26"), mask.x.max(mask.y).mul(0.7)),
        roughness: 0.74
      };
    }
    const flecks = aventurine(at, 40);
    return {
      color: blend(blend(blend(tint("#28305a"), tint("#323a68"), fractal(at, 4, 3)), tint("#b89a5c"), flecks.mul(0.25)), tint("#c9ad70"), mask.x.max(mask.y)),
      roughness: blend(float(0.36), float(0.42), mask.x),
      metalness: mask.x.max(mask.y),
      clearcoat: 0.7,
      emissive: tint("#fff0c8").mul(mask.y.mul(0.4))
    };
  },
  frame: ({
    at,
    mask
  }) => ({
    color: blend(blend(tint("#7e6838"), tint("#8c7640"), fractal(at, 4, 2)), tint("#3a2a12"), mask.z.mul(0.7)),
    roughness: 0.46,
    metalness: 0.5
  })
};
// -----------------------------------------------------------------------------
// The Grand Hall: Carrara and black marble with a rare thread of gold, in a dark bronze frame
// -----------------------------------------------------------------------------
const carrara = stone => blend(tint("#b4b0a7"), tint("#74747a"), stone.mul(0.08).add(smoothstep(0.5, 1, stone).mul(0.4)));
const nero = stone => blend(blend(tint("#37373d"), tint("#44444b"), stone.mul(1.8).min(1)), tint("#83837f"), smoothstep(0.72, 1, stone).mul(0.4));
const marble = {
  relief: 0.3,
  inlay: "#7a6236",
  table: {
    tile: 5,
    finish: quietFloor("#34302c", "#433e39", 0.6)
  },
  piece: ({
    stone,
    crevice
  }, tone) => {
    const veined = stone(0.8);
    return {
      color: blend(tone === "light" ? carrara(veined) : blend(tint("#0f0f12"), tint("#a08a5e"), smoothstep(0.75, 1, veined).mul(0.5)), tint(tone === "light" ? "#5a564e" : "#000000"), crevice.mul(0.5)),
      roughness: 0.3,
      clearcoat: 0.25
    };
  },
  square: ({
    stone
  }, tone) => {
    const veined = stone(0.9);
    return {
      color: tone === "light" ? carrara(veined) : nero(veined),
      roughness: tone === "light" ? 0.28 : 0.32,
      clearcoat: 0.2
    };
  },
  frame: ({
    at
  }) => ({
    color: blend(tint("#6e5e42"), tint("#7a6a4c"), fractal(at, 2.5, 2)),
    roughness: 0.4,
    metalness: 0.75
  })
};
export const recipes = {
  ink,
  ice,
  courtyard,
  arcade,
  jade,
  observatory,
  marble
};