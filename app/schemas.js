/*!
 * Chess
 * Copyright (c) Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a19e25-e438-75a3-a372-c9c67de14514
 */
// Intended use: every runtime shape entering the pen (data files and saved progress), with the types inferred from them and readable failure messages.
import { z } from "zod";
// -----------------------------------------------------------------------------
// Worlds
// -----------------------------------------------------------------------------
const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
export const worldSchema = z.object({
  id: z.string(),
  name: z.string(),
  tagline: z.string(),
  swatch: z.object({
    light: hex,
    dark: hex,
    frame: hex
  }),
  recipe: z.enum(["wood", "ink", "ice", "courtyard", "arcade", "jade", "observatory", "marble"]),
  demise: z.enum(["splinter", "inkburst", "shatter", "crumble", "pixelate", "collapse"]),
  palette: z.object({
    ground: hex,
    panel: hex,
    ink: hex,
    muted: hex,
    accent: hex,
    alert: hex,
    move: hex
  }),
  light: z.object({
    // Where the key light stands; raking light models the pieces, frontal light flattens them.
    from: z.tuple([z.number(), z.number(), z.number()]).optional(),
    key: hex,
    keyPower: z.number(),
    rim: hex,
    rimPower: z.number(),
    fill: z.number()
  }),
  sky: z.object({
    top: hex,
    horizon: hex
  }),
  motes: z.object({
    kind: z.enum(["dust", "petal", "snow", "ember", "pixel", "star"]),
    color: hex,
    count: z.number().int(),
    size: z.number()
  }),
  debris: hex,
  scan: z.object({
    dir: z.string(),
    hdri: z.string(),
    tableRepeat: z.number(),
    backdrop: z.number(),
    clearcoat: z.number(),
    shardLight: hex,
    shardDark: hex,
    tableTint: hex,
    reflection: z.number(),
    paint: z.boolean(),
    // The coordinates, inlaid in the frame: their material and the fine dark cut around them.
    label: z.object({
      color: hex,
      edge: hex,
      metal: z.number(),
      rough: z.number()
    }),
    labelAt: z.number().optional(),
    brokenGlow: hex.optional(),
    glow: z.object({
      bloom: z.number(),
      threshold: z.number(),
      inlay: z.number().optional()
    })
  })
});
// -----------------------------------------------------------------------------
// Opponents
// -----------------------------------------------------------------------------
const roleSchema = z.enum(["pawn", "knight", "bishop", "rook", "queen", "king"]);
export const opponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string(),
  rating: z.number(),
  world: z.string(),
  figure: roleSchema,
  style: z.string(),
  greeting: z.string(),
  onWin: z.string(),
  onLoss: z.string(),
  play: z.discriminatedUnion("kind", [z.object({
    kind: z.literal("human"),
    depth: z.number().int(),
    lines: z.number().int(),
    temper: z.number(),
    blunder: z.number(),
    aggression: z.number()
  }), z.object({
    kind: z.literal("elo"),
    elo: z.number().int(),
    movetime: z.number().int()
  }), z.object({
    kind: z.literal("full"),
    movetime: z.number().int()
  })])
});
// -----------------------------------------------------------------------------
// Lessons
// -----------------------------------------------------------------------------
export const lessonStepSchema = z.object({
  prompt: z.string(),
  accept: z.array(z.string()).min(1),
  reply: z.string().optional(),
  praise: z.string(),
  wrong: z.string()
});
export const lessonSchema = z.object({
  id: z.string(),
  theme: z.string(),
  title: z.string(),
  idea: z.string(),
  fen: z.string(),
  world: z.string(),
  steps: z.array(lessonStepSchema).min(1),
  takeaway: z.string()
});
// -----------------------------------------------------------------------------
// Saved progress
// -----------------------------------------------------------------------------
export const rulesSchema = z.object({
  start: z.enum(["standard", "chess960"]),
  odds: z.enum(["none", "they-knight", "they-rook", "they-queen", "you-knight", "you-rook", "you-queen"]),
  clock: z.enum(["none", "5+3", "10+0", "15+10", "30+0"]),
  takebacks: z.boolean(),
  hints: z.boolean(),
  repetition: z.enum(["threefold", "fivefold"]),
  moveLimit: z.enum(["fifty", "seventy-five"]),
  promotion: z.enum(["choose", "auto-queen"])
});
export const settingsSchema = z.object({
  cutscenes: z.enum(["off", "big", "captures"]),
  coordinates: z.boolean(),
  moveHints: z.boolean()
});
export const MATCH_GAME = "match";
// Saves from when board, world and pieces were chosen apart become the one style they pinned.
const oneStyle = saved => {
  if (typeof saved === "string") return saved;
  const {
    world,
    pieces,
    board
  } = saved ?? {};
  const pinned = [world, pieces, board].find(id => typeof id === "string" && id !== MATCH_GAME);
  return pinned ?? MATCH_GAME;
};
export const styleSchema = z.preprocess(oneStyle, z.string());
export const profileSchema = z.object({
  version: z.literal(1),
  rung: z.number().int().min(0).max(8),
  points: z.number().min(0),
  games: z.number().int().min(0),
  lessonsDone: z.array(z.string()),
  lastWorld: z.string().nullable(),
  rules: rulesSchema,
  settings: settingsSchema,
  // Older saves have no style, and a missing field must never cost someone their progress.
  style: styleSchema
});
// -----------------------------------------------------------------------------
// URL parameters
// -----------------------------------------------------------------------------
const flag = z.literal(true);
export const cheatSchema = z.object({
  panel: flag,
  fresh: flag,
  hotseat: flag,
  pushover: flag,
  rank: z.coerce.number().int().min(1).max(9),
  speed: z.coerce.number().min(0.05).max(20),
  clock: z.coerce.number().min(1).max(36000),
  style: z.string().min(1),
  fen: z.string().min(1),
  cutscenes: z.enum(["off", "big", "captures"]),
  gpu: z.enum(["high", "low"])
});
export const rootSearchSchema = z.object({
  cheat: z.string().optional().catch(undefined)
});
export const casualSearchSchema = z.object({
  side: z.enum(["white", "black", "lots"]).catch("lots"),
  style: z.string().catch("shuffle")
});
// -----------------------------------------------------------------------------
// Failure messages
// -----------------------------------------------------------------------------
const describe = value => `${JSON.stringify(value)?.slice(0, 40) ?? "nothing"} (${value === null ? "null" : typeof value})`;
const dig = (source, path) => path.reduce((at, key) => at === null || typeof at !== "object" ? undefined : at[key], source);
export const parseOrThrow = (schema, value, source) => {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const [record, ...field] = issue.path;
  throw new Error(`${source} [${String(record)}] ${field.map(String).join(".")}: ${issue.message}, got ${describe(dig(value, issue.path))}`);
};