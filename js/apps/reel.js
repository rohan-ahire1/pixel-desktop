// Watch the reel: the One Cut film over the whole screen. It only ever starts from a click.
import { small } from "../core.js";
import { msgbox } from "../wm.js";

export async function open() {
  if (small()) return msgbox({ title: "Watch the reel", text: "The reel plays on a bigger screen." });
  return (await import("../film/player.js")).playReel();
}
