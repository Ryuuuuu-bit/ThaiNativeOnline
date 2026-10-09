# HUD system audit — 10 October 2026

The target remains the Art Bible's readable Thai fantasy 2.5D game. Screens must
describe current mechanics accurately before visual consolidation. This audit
used source code; visual acceptance requires fresh browser captures.

## Confirmed gaps

| Gap | Evidence | Proposed action |
| --- | --- | --- |
| SP in the live HUD, MP in many older panels | `DynamicHUD.js`, `CharacterUI.js`, skill/potion copy | Use one player-facing resource name, SP, while retaining internal `mp` fields. |
| Bag said cards cannot be removed, though occult extraction exists | `CharacterUI.js`, `ShopPanel.js` | Fixed in the card-journal task: explain extraction fees and destruction risks at all three bag/card prompts. |
| NPC descriptions advertise unfinished repair/crafting/brewing and old skill names | `data/shops.js`, class move registries | Generate services and skill names from the current registries, with explicit future-service labels. |
| Mobile hides the exploration panel containing active quest progress | `mobile-hud.css`, `QuestUI.js` | Add one compact active-objective chip with a quest-journal action. |
| Menu shortcut hints described different actions | `index.html`, `Game.js`, `ActionBar.js` | Fixed: the AUTO menu tile says settings and has no G hint; Settings has no Esc opening hint. |
| Window theme and live HUD use separate blue/jade color systems | `theme.css`, `dynamic-hud.css` | Consolidate shared colors, type, spacing, headings, focus rings and buttons around jade/brass. |
| Some mobile controls are below the 44-pixel target | Skill pager / AUTO configuration in `mobile-hud.css` | Give touch targets 44 pixels while retaining compact visual icons. |

The offhand slot is already retired and the current character sheet exposes the
seven real equipment slots. Keep the existing migration that returns saved
offhand gear and cards; no second removal or item loss is needed.

## Proposed system

The live screen carries compact vitals, a small minimap, one current objective
and the combat controls. Protect the center and lower-middle playfield. Rarely
used details open from the menu and one foreground window receives input.

- Character: equipment, stats, learned skills and equipment presets.
- Knowledge: bestiary, card collection and the player guide.
- Social: party, friends and recruitment.
- World: atlas, walking routes and contextual warp services.
- NPC services: actions actually available at the selected NPC.

Use shared jade panels, restrained brass edges, readable Thai typography and
quiet state-change motion. Reading surfaces can use a parchment-like inset.
Every panel needs a visible close action, focus containment, Escape/backdrop
behavior, safe-area sizing and mobile containment. Movement and camera shortcuts
must not act underneath the foreground journal.

## Rollout

1. Correct facts, service labels, resource names and shortcut hints.
2. Consolidate shared visual tokens and reusable window controls.
3. Group menu destinations and unify panel exclusivity/input rules.
4. Add the mobile objective entry and finish touch target/overlap verification.

The card journal is the first new reading surface using this direction. This
document is a proposed rollout, not a claim that all existing HUD screens have
already been redesigned.
