// When a project plays its part of the reel. This stays small: the film itself only loads if a clip runs.
import { reduce, session, small } from "../core.js";

export const FLOW = ["scoutline", "recoup", "pointer", "multibagger", "flaggo", "coachmate"];
const LAST = FLOW[FLOW.length - 1];

async function run(play) {
  try { await play(await import("./player.js")); } catch (e) { console.error(e); }
}
function once(key, play) {
  if (reduce || small() || session.get(key)) return Promise.resolve();
  session.set(key, "1");
  return run(play);
}
export const playClip = (id) => once("clip-" + id, (f) => f.playClip(id));
// the last project hands off to the end card, which stays available
export const playNext = (id) => (id === LAST ? run((f) => f.playNext(id, true)) : once("next-" + id, (f) => f.playNext(id)));
