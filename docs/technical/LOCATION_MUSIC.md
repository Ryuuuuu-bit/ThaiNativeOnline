# Location music

Original soft Thai-fantasy music extends the approved riverside listening
sample into related location moods. Flute-like synthesis, warm strings,
plucked strings and restrained wooden accents share a theme. The direction
supports the vision's peaceful towns and supernatural wilderness while
leaving combat cues audible. These are synthesized instruments, not a
recorded Thai ensemble or historically authentic tuning.

## Moods and real geography

| Mood | BPM | Feeling | Existing locations |
| --- | ---: | --- | --- |
| `calm_river` | 68 | Warm, restful | ท่าเรือหลวง, ชุมชนริมน้ำ, หมู่บ้านชาวประมง, แม่น้ำเจ้าพระยา, ย่านบ้านเรือน and safe-city fallback |
| `calm_market` | 80 | Bright, gently busy | ตลาดกลางเมือง, ถนนพ่อค้า, ตลาดปลา, ย่านช่างเหล็ก |
| `calm_temple` | 60 | Open, serene | เขตวัดสุวรรณเจดีย์ and ศาลหลักเมือง |
| `calm_paddy` | 72 | Hopeful, lightly moving | ทุ่งนาหลวง, สวนผลไม้และสมุนไพร, ถนนสู่ป่า, ทุ่งหญ้าชายป่า; training/hall areas share this hopeful mood |
| `calm_forest` | 64 | Curious, shaded | ชายป่า, ป่าทึบ, ไพรลึกเหนือลำธาร; forest-themed expeditions |
| `calm_ruins` | 58 | Eerie, restrained | ดงวัดร้าง, ศาลร้างกลางไพร, สุสานเก่าแห่งอโยธยา, เรือนหอร้าง; ruin-themed expeditions |
| `calm_marsh` | 62 | Watchful, watery | ดงอ้อริมบึง, หนองน้ำ, คลองใหญ่, บึงชาละวัน; water-themed expeditions |
| `calm_night` | 58 | Quiet, intimate | Peaceful city/field night variation; dangerous locations retain their local identity |

Geography names and region ids come from `src/data/regions.js`; active map
themes and expedition context come from `src/world/maps.js` and
`src/world/expeditions.js`. Reuse those boundaries rather than inventing
parallel positional zones. Expedition themes resolve to forest, ruins or
marsh; unknown map context falls back to `calm_forest`. The selector
`musicAt({ mapId, regionId, phase })` is pure data in `src/data/calmMusic.js`.
Loaded maps take precedence over regional coordinates. Only city and paddy
switch to `calm_night`; forest, abandoned temples and marshes keep their
geographical mood after dark.

`src/audio/LocationMusic.js` accepts `update(dt, location)`. Initial selection
and loaded-map changes take effect immediately. Region/phase candidates must
remain stable for two seconds, with at least eight seconds since the previous
change. A repeated current mood does not restart playback. `Game.js` updates
this controller when the map is ready rather than directly choosing a song
from clock phase.

## Audio constraints

Retain browser gesture unlocking, persisted music/SFX/ambience sliders and
mute behavior. Music transitions should fade gently and avoid restarting
while the requested mood stays unchanged. Region boundaries need a brief
stable-selection interval so walking along an edge does not alternate
tracks repeatedly. Late asynchronous track work must not replace a newer
request; stopping/replacing music must release voices and timers.

The game already supplies wind, birds and crickets on its ambience bus.
Keep musical air subtle and do not duplicate prominent environmental loops.
The standalone WAV sample has an intro/outro fade and is not a seamless game
loop; it is a listening reference rather than proof of runtime continuity.
Live playback uses `CalmMusicPlayer` in `src/audio/CalmMusic.js`, selected by
`style: 'calm'` in the existing Sound engine. It renders the original sixteen
bar score in `src/data/calmScore.js` continuously with overlapping natural
tails, not a downloaded or fade-ended WAV loop. Melody and voiced harmony
are shared across moods; tempo, register, major/minor color, instrumentation
levels and note density vary. Departure stops scheduling, fades over three
seconds and disconnects the output after its audio-time tail. Suspended
contexts skip missed scheduling windows instead of playing a note backlog.

## Validation and scope

Verify the selector against actual town POIs, every map theme, expeditions
and day/night transitions. Verify start after gesture, repeat selection,
crossfade replacement and mute/volume persistence with the existing audio
engine. Run focused tests and the production build; browser review should
record errors and confirm the requested mood across location changes.

No new maps, battle-adaptive orchestration, recorded instrument library or
external soundtrack licensing is part of this change. Musical balance and
long-session fatigue require listening and normal gameplay review. A clean
browser run or valid WAV does not establish that a reviewer listened to it.

The local production Game smoke verified initialization without JavaScript
errors, no AudioContext before a gesture, a running `CalmMusicPlayer` after
the gesture, unchanged mood/player identity, persisted independent volume
sliders, mute/unmute, replacement fade and suspended scheduling recovery
without a note backlog. Evidence is in ignored
`artifacts/location-bgm-game-smoke.png` and its JSON report. This validates
runtime behavior, not an auditory listening review.

Final verification: 788 tests total, 786 passed, zero failed and two existing
optional skips. The production build passed with 294 modules and the existing
bundle-size warning. Focused selector/sequencer tests passed 13/13, including
missed-window recovery and cleanup measured in AudioContext time.

`docs/technical/LOCATION_MUSIC_REVIEW.json` seals eight offline renders and
two-cycle runtime-score checks. The maximum raw live-graph peak was 0.29454,
with no clipping; measured loop-boundary RMS remained above silence
(approximately 0.054–0.060) and adjacent sample steps below 0.069. These
measurements catch clipping and silent gaps but cannot establish perceptual
seam quality or headphone comfort. Listening previews are separately
normalized and faded at their endpoints; they do not replace live-loop checks.
The reproducible review entry points are `tools/location-music-review.html`
and `tools/location-music-capture.mjs` with an existing browser automation
runtime and local dev server.
