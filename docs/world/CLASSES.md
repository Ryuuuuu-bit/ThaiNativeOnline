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
