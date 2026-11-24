# 2D Camera Follow Lab

**English** | [日本語](README.ja.md)

A demo that lets you switch between eight 2D camera follow styles in the same world and compare them.
It implements the SpriteCook article "[2D camera follow: dead zone & look-ahead](https://www.spritecook.ai/blog/2d-camera-follow-dead-zone-look-ahead)".

Every mode has the same shape: each tick, pick a goal, then ease toward it.

```
cam += (goal - cam) * (1 - exp(-rate * dt))   // rate is per second, so it is frame-rate independent
```

## Running it

The code uses ES modules, so open it through a local server. There are no dependencies.

```bash
node serve.mjs
```

Then open http://localhost:8123. Change the port with the `PORT` environment variable or the first argument.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Shift | Run |
| 1–8 | Switch mode |
| IJKL | Move the slime buddy (for two targets) |
| Mouse | Aim |
| G | Toggle debug overlay |
| P | Toggle pixel snapping |
| R | Reset |

The side panel has live sliders for each mode's parameters, a graph of the camera's offset from the player, and a minimap.

## Camera modes

Defaults assume a 128×128 px view at 60 ticks per second. Scale pixel values with your view size.

| # | Mode | How it works | Defaults |
| --- | --- | --- | --- |
| 1 | Locked | `cam = p` | — |
| 2 | Smooth | Exponential ease toward the player | rate 2.6/s |
| 3 | Dead zone | Clamp the camera to a box around the player | half-size x 22 px, y 18 px |
| 4 | Room by room | Smoothstep slide to the current room's centre | room 128 px, 0.55 s |
| 5 | Look-ahead | Lead ahead using movement direction only | 32 px, rate 3.4/s |
| 6 | Points of interest | Pull toward nearby points with a smoothstep weight | 60 px → 24 px, pull 0.6, rate 3.5 |
| 7 | Aim offset | Shift by a share of the cursor's screen offset | 0.45, rate 8 |
| 8 | Two targets | Follow the midpoint and zoom out with distance | padding 104, view 128–240 px |

### Implementation notes

- **A rate of 0 snaps to the goal** instead of freezing the camera.
- **Distances and shares of 0 reproduce the locked camera** in every mode. The tests check this.
- **Aim uses the cursor's screen offset, not its world position.** The world position moves with the camera, so with a still mouse the camera overshoots to about 0.82 of the screen offset. Turn on "naive implementation" in the aim parameters to see this pitfall.
- **Two targets drops the buddy once it is past the cutoff distance.** Without this the view grows without limit.
- **The camera updates after the player moves, in the same tick,** on a fixed 60 Hz timestep.
- **Pixel snapping applies to both the camera and the characters.** Snapping only the camera makes the characters shake.

## Files

| File | Contents |
| --- | --- |
| `camera.js` | The camera: all eight modes, pure logic with no rendering |
| `world.js` | Procedural pixel-art world and ambient effects (fireflies, snow, cloud shadows) |
| `sprites.js` | The hero, the slime, and the points of interest (crystals, chest, campfire, portal, statue) |
| `main.js` | Game loop, input, rendering and UI |
| `test.mjs` | Tests against the article's numbers |
| `serve.mjs` | Dependency-free static file server |

There are no image files. All art is drawn in code.

## Tests

```bash
node test.mjs
```

The tests check the article's numbers, for example:

- Smooth: a 100 px jump is within 1 px after 107 ticks
- Look-ahead: the lead is 30.9 px after 1 s, walking or running
- Points of interest: the settled offset is 14.0 px at 40 px and 14.4 px at 24 px
- Aim: a cursor 100 px away gives 45 px
- Two targets: 100 px apart gives a 204 px view; 200 px apart stops at the 240 px cap

## Debugging

From the browser console, `window.lab` exposes the camera and state.

```js
lab.setMode('poi');     // switch mode
lab.teleport(78, 330);  // jump next to the campfire
lab.cam.params.poi.pull = 1;
```
