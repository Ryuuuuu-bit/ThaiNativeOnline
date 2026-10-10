# Equipment reference UI assets

User reference: `user-reference.png`, supplied in chat on 2026-10-11.
The target is the reference's portrait 2:3 jade-and-gold Thai equipment panel.
Actual item art, character identity, socket counts, refinement and flask charges
are rendered by the UI, independently of the decorative background.

`panel-master-v1.png` was generated with the built-in ImageGen tool as an edit
of that reference. The production `public/ui/equipment/reference-panel-v1.webp`
is 1024x1536, 123,078 bytes. Its hashes and encoder are recorded in
`production-manifest.json`. No controls or text are baked into this plate.

Re-export with an existing Sharp tooling installation:

```powershell
node tools/export-equipment-panel.mjs C:/Users/panup/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp
```

## Final ImageGen prompt

Use case: precise-object-edit. Edit target is the supplied Thai fantasy equipment UI reference. Produce a CLEAN BACKGROUND PLATE for this exact UI, portrait 1024x1536 aspect 2:3. Preserve the dark jade green hand-painted texture, thin gold outer perimeter frame, ornate sculpted Thai kanok gold ornaments at four outer corners, wide empty gold-edged jade title cartouche at top center, and very faint central Thai temple/guardian silhouette motif. Preserve their exact positions and material style. REMOVE every inner equipment slot and its frame/label plaque, all equipment and flask illustrations, all typography including title/name/UID/slot labels/footer, every badge/lock/socket/refinement/key button, both bottom flask cards and charge bars. Fill all removed inner content with continuous subtly textured dark jade matching surrounding interior. Thus the result has only outer perimeter ornamentation, an EMPTY header cartouche, and a faint central Thai motif over jade. The whole inner area is empty and can receive actual HTML interactive slots and text. No text anywhere, no icons anywhere, no inner rectangles anywhere. Do not invent new layout or new ornaments. Preserve outer frame geometry and look as faithfully as possible.
