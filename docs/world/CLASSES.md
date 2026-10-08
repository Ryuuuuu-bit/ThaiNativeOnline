# Classes

Legacy class identities currently retained:

## Khun Suek
Melee tank / fighter. Sword, optional shield.

## Chom Khamang Wet
Magic / crowd control. Starts with ยันต์ฝึกอาคม in the weapon slot and casts with hand gestures. The starter talisman retains the saved `reed_wand` ID, stats, weight, card slots and refinement; existing characters keep their equipment. Uses the existing character model, animation clips and skill effects unchanged. Higher-tier loot weapons are unchanged.

## Phran Pa
Ranged DPS. Bow, poison, traps, mobility.

## Nak Muay Khad Chueak
Melee bruiser. Fast combos, elbows, knees, counters, stun.

## Mo Ya
Support / healer. Healing, buffs, resurrection, herbal identity.

Any redesign must preserve role clarity and gameplay-camera readability.

## Equipment simplification

The offhand equipment slot is retired. Shields now use either charm slot; the ritual knife uses the main weapon slot. Former offhand cards now fit charms. Loading an old character returns offhand gear to the bag with refinement and compatible cards, and returns incompatible cards separately. A full bag receives recovery slots rather than losing items; migration is idempotent on save/reload. Character models, animations and skill effects are unchanged.

## Retired offhand content

Rattan shield, buffalo shield and ritual knife (`rattan_shield`, `buffalo_shield`, `mo_knife`) are retired after removal of the offhand system. Their definitions remain only for save compatibility. They cannot be acquired and are removed from vendor stock; no current loot or quest rewards produce them. Materials, cards and active class weapons remain available.

On character load, each retired item in the bag, charm slots or legacy offhand is redeemed for its full listed price plus 100 × n(n+1)/2 gold in successful refinement fees and n ores at listed price, where n is its current refinement level. Socketed cards are returned even with a full bag. Saving the migrated character prevents repeated compensation. Historic failed refinement costs cannot be reconstructed. Animations are unchanged.

## Existing-character starter backfill

Saved characters without starterEquipmentVersion 1 receive missing starter weapon/cloth armor once on load. Occupied equipment slots and starter items already in the bag are preserved. Full bags receive recovery capacity; alive characters equip newly granted items into empty slots. Consumables are not refilled. New characters start with the marker. Server migrations mark the character dirty for queued persistence. Applies on next login after deployment, including each saved slot independently.

