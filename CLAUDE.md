# CLAUDE.md — Project Rules for Escape from the Solid Labyrinth

## First Principle of Thinking

1. **Never assume the user is clear about what he needs**: stop and discuss when things are unclear.
2. **When the target is clear but the path is sub-optimal**: directly suggest the optimal path.
3. **Aim for fundamental reasons when questions arise**: don't make things up afterwards, and make sure to be able to answer "why" for every question.
4. **Be concise when outputting**: don't output information that doesn't affect the decision-making.

## Branch Policy

- Do NOT start new branches without confirming with user first.

## Code File Standards

### Headers
Every code file must begin with a header block that covers:
- What the file does (one-line summary)
- Key definitions, types, or formats it owns
- Any non-obvious constraints or invariants

Example (TypeScript):
```typescript
/**
 * gaze.ts — Gaze calculation engine
 *
 * Definitions:
 *   GazePattern: union of cardinal-ray | cone | rotating | boss-global
 *   GazeTile: { x, y, source: EnemyId, intensity: number }
 *
 * Invariants:
 *   - Gaze is recalculated fresh each turn after all moves resolve.
 *   - Walls and StatueEntity with isOpaque=true block all ray patterns.
 */
```

### File Scanning
When doing a first pass over the repo, read only the header block of each code file. Full file reads are reserved for files actively being modified or debugged.

---

## Game Design Reference

### Core Loop
Turn-based grid roguelike. Each player action costs petrification. Reach the exit before reaching 100%.

### Petrification Rate
- Normal: +1 per action
- After soft turn limit: +2 per action
- Inside enemy gaze at end of turn: +extra (per enemy type)

### Enemy Gaze Patterns (initial set, extensible)
| Type | Pattern | Notes |
|---|---|---|
| Lesser Gorgon | Cardinal ray, fixed facing | Blocked by walls and statues |
| Watcher | Long-range cardinal ray | Same blocking rules, longer reach |
| Gaze Trap | Short-range cone (3-tile, 90°) | Fixed, triggered each turn |
| Sentinel | Rotating cardinal | Rotates CW each turn |
| Boss | Varies | May see through obstacles or apply global petrification |

### Statue System
Every StatueEntity has:
- `name`, `material`, `pose`, `backstory`
- `memoryStages: MemoryStage[]` — stage 0 always shows how she was petrified (trap/mechanic hint); deeper stages unlock via conditions
- `mechanicalRole`: blocks gaze, pressure plate, pushable obstacle, restorable ally, etc.
- `restorationCondition?: string`
- `isPushable: boolean`
- `isOpaque: boolean` — whether she blocks gaze rays

### Memory Stage Unlock Conditions (candidates, to be confirmed)
- Stage 0: always available on inspect
- Stage 1: inspect again after restoration, OR spend N turns adjacent
- Stage 2: use a specific item (resonance scroll, etc.) — not in initial scope

### Materials (initial: marble only; extensible)
- Marble: standard, pushable
- Future: obsidian (fragile), reflective (bounces gaze), transparent (gaze passes through)

### Restoration Effects
Open-ended. Usually beneficial (unlock path, grant item, remove gaze source).
Rare negative outcomes are valid (awakens enemy, blocks future path).
Each level's author decides per-statue.

### Level Structure
- 3 hand-authored levels for initial build
- Level select screen planned (level count variable)
- Each level: compact puzzle, one new mechanic introduced

| Level | Introduces |
|---|---|
| 1: The Antechamber | Basic movement, single cardinal gaze, exit |
| 2: The Gallery | Pushable statues to block gaze |
| 3: The Sanctuary | Softening Oil, restoration, soft turn limit pressure |

### UI Requirements
- Floor name, turns, petrification meter, stage, inventory
- Message log: explains why petrification changed, which tiles are dangerous, what inspection reveals
- Dangerous tiles highlighted (gaze overlay)

### Petrification Threshold Descriptions (flavor only, no mechanical effect yet)
- 0–40%: Normal
- 40–70%: "Your limbs feel heavy"
- 70–90%: Message log tone shifts to urgent
- 90–100%: Final warning turn
