# SWATFALL

**One hand steers. One hand fires. Both hands swat.**
A seated, hands-first WebXR arcade shooter for Meta Quest (passthrough AR, with an optional VR mode), built for the Meta VR Start Developer Competition 2026.

▶ Play: https://banksythequantlab.github.io/swatfall/ (open in the Quest Browser, tap **Enter AR** or **Enter VR**)

A glowing swarm of procedural crystal creatures (glowmoths, urchins, lumens) drifts across a tilted glass playfield hovering in your room. Slide one hand to steer your emitter along the bottom rail; pinch the other to fire. The twist: glowmoths break formation, rise **out of the playfield** and hover right in front of you — swat them with your bare hand before they dive-bomb your emitter.

## Controls

### Hands (Quest hand tracking, seated) — no controller needed
| Action | Gesture |
|---|---|
| Steer the emitter | Move your **move hand** (left by default) left/right over the amber rail; the knob follows your palm |
| Fire | **Pinch** thumb + index on your **fire hand** (right by default), or make a finger-gun and **drop your thumb**. Hold to auto-fire |
| Swat a diver | Touch / slap the hovering creature with any part of either hand (index tip or palm) |
| Pause | Hold either **palm up**, fingers open, for ~0.6 s — or poke the floating ❚❚ tile |
| Menus | **Poke** the floating panel buttons with a fingertip (Start, Resume, Restart, Move hand: Left/Right, Sound, Exit XR) |

Swap which hand steers with **MOVE HAND** on any menu panel (saved for next time).

### Fallbacks
* **Controllers:** move the steering controller left/right, trigger on the other fires, poke panels with the controller tip, Y/B pauses.
* **Desktop:** mouse or ←/→ steer, click or Space fires, click a diver to swat it, P pauses, Enter starts.

## Rules
* Formation creatures: lumen 40, urchin 20, glowmoth 10. Shooting a falling spark: 5.
* Diver swatted by hand: **250**. Shot down while rising: 100. Unswatted divers dive at your emitter — if it hits you lose a shield.
* 3 shields. The swarm speeds up as it thins and steps closer at each wall. If it reaches the red line, or you lose all shields, the run ends.
* Each wave is faster, drops more sparks, and sends divers more often.

## Tech
three.js r186 + Vite, raw WebXR (`immersive-ar` / `immersive-vr`, `local` reference space, optional `hand-tracking`). Gestures are computed from raw XRHand joints in `src/gestures.js` (pinch with hysteresis, finger-gun thumb drop, palm-up via palm normal + dwell, poke hit testing) and unit-tested with synthetic joint data. All art is procedural low-poly geometry generated in code; all sound is synthesized live with WebAudio. Everything is instanced: ~15–20 draw calls and under 5k triangles in the headless measurement.

```bash
npm install
npm test        # gesture + game-rule unit tests
npm run dev     # https needed for XR on device; use `vite --host` + a tunnel, or deploy
npm run build
```

## Status
Thresholds (pinch distances, palm-up angle, poke depth) are initial values and have **not** yet been tuned on a physical Quest.
