// Shift: a quick dash (พุ่งตัว) along the way you are heading, shared by the client
// (src/entities/Player.js) and the server's move check (server/presence.js).
//   distance  metres covered · time  seconds it takes · cooldown  seconds until the next one
//   clip      the class model's clip (a CC0 ActionForge roll, tools/npc-models/retarget-gait.mjs)
//   clipTime  how long the clip plays (it is sped up to this)
export const DASH = Object.freeze({ distance: 5.5, time: .35, cooldown: 1.5, clip: 'dash', clipTime: .55 });
// the server grants one dash's extra distance at most this often (a little under the
// cooldown, for network jitter), and that much extra once
export const DASH_SERVER = Object.freeze({ every: DASH.cooldown - .2, slack: DASH.distance + 1 });
