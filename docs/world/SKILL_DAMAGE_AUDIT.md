# Skill damage expectation audit

Scope: all 50 playable kit actives × base/A/B = 150 records. This is a static expectation audit, not proof of live collision or FX callbacks. Passives and legacy skills are excluded.

Shaman damage expected: mage_akom, mage_yant, mage_thunder, mage_kalp, mage_ghostfire, mage_curse, mage_storm, on all three variants. Shaman support-only: mage_shield, mage_holy, mage_meditate, intentionally do no direct damage on all three variants.

Classification: damaging = positive rules mult; support-only = no offensive multiplier and no intended FX hurt callback; heal-hybrid = healing plus offensive multiplier, or heal_vine's documented drain with the current fallback damage path. Healing and party buffs apply at cast release through selfEffects/supportOf. A kit hits timestamp can mark release of support FX and is not evidence of an offensive hit.

Numbers below use learned skill Lv.5, MATK 100, own DEF 100, healing multiplier 1. Mult is the raw rules coefficient, not total damage. Range/splash are castInfo results in metres. Heal is percent of maximum HP before the percentage sign; flat heal is aggregate healPower. Buffs show raw fields; skillStats can scale grow/duration. The kit timestamp count describes animation events; FX may emit additional blows (projectiles, dogs and DOT visuals).

## Expected coverage

| Class | Skill variant | Expected function | Raw mult | Kit events | HP % / flat HP / MP % | Buff | Reach m / shape |
| --- | --- | --- | ---: | ---: | --- | --- | --- |
| muaythai | boxer_jab | damaging | 0.85 | 3 | 0 / 0 / 0 | {} | 2.2 / "single/self" |
| muaythai | boxer_jab@A | damaging | 0.65 | 3 | 0 / 0 / 0 | {} | 2.2 / "single/self" |
| muaythai | boxer_jab@B | damaging | 0.85 | 3 | 0 / 0 / 0 | {} | 2.2 / "single/self" |
| muaythai | boxer_kick | damaging | 2.3 | 1 | 0 / 0 / 0 | {} | 2.2 / "single/self" |
| muaythai | boxer_kick@A | damaging | 2.1 | 1 | 0 / 0 / 0 | {} | 2.2 / "single/self" |
| muaythai | boxer_kick@B | damaging | 1.7 | 1 | 0 / 0 / 0 | {} | 2.2 / {"radius":2.5,"around":"target"} |
| muaythai | boxer_croc | damaging | 1.8 | 2 | 0 / 0 / 0 | {} | 2.2 / {"radius":1.92,"around":"self"} |
| muaythai | boxer_croc@A | damaging | 1.5 | 2 | 0 / 0 / 0 | {} | 2.2 / {"radius":2.88,"around":"self"} |
| muaythai | boxer_croc@B | damaging | 2.2 | 2 | 0 / 0 / 0 | {} | 2.2 / {"radius":1.92,"around":"self"} |
| muaythai | boxer_waikru | support-only | none | 0 | 12.4 / 0 / 0 | {"atkMul":0.25,"aspd":0.1} | 2.2 / "single/self" |
| muaythai | boxer_waikru@A | support-only | none | 0 | 18.6 / 0 / 0 | {"defMul":0.3} | 2.2 / "single/self" |
| muaythai | boxer_waikru@B | support-only | none | 0 | 5 / 0 / 0 | {"aspd":0.22,"atkMul":0.1} | 2.2 / "single/self" |
| muaythai | boxer_ngouy | damaging | 7 | 1 | 0 / 0 / 0 | {} | 3.2 / "single/self" |
| muaythai | boxer_ngouy@A | damaging | 4.8 | 1 | 0 / 0 / 0 | {} | 3.2 / {"radius":3,"around":"target"} |
| muaythai | boxer_ngouy@B | damaging | 7 | 1 | 0 / 0 / 0 | {} | 3.2 / "single/self" |
| muaythai | boxer_drum | support-only | none | 3 | 12.4 / 0 / 0 | {"def":18,"atkMul":0.1} | 2.2 / "single/self" |
| muaythai | boxer_drum@A | support-only | none | 3 | 12.4 / 0 / 0 | {"atkMul":0.1,"def":8} | 2.2 / "single/self" |
| muaythai | boxer_drum@B | support-only | none | 3 | 12.4 / 0 / 0 | {"atkMul":0.18,"aspd":0.2} | 2.2 / "single/self" |
| muaythai | boxer_elbow | damaging | 2.1 | 2 | 0 / 0 / 0 | {} | 2.2 / "single/self" |
| muaythai | boxer_elbow@A | damaging | 2.1 | 2 | 0 / 0 / 0 | {} | 2.2 / "single/self" |
| muaythai | boxer_elbow@B | damaging | 2.1 | 2 | 0 / 0 / 0 | {} | 2.2 / "single/self" |
| muaythai | boxer_knee | damaging | 5 | 1 | 0 / 0 / 0 | {} | 3.8 / {"radius":2.2,"around":"target"} |
| muaythai | boxer_knee@A | damaging | 3.8 | 1 | 0 / 0 / 0 | {} | 3.8 / {"radius":3.4,"around":"target"} |
| muaythai | boxer_knee@B | damaging | 5 | 1 | 0 / 0 / 0 | {} | 3.8 / {"radius":1.4,"around":"target"} |
| muaythai | boxer_iron | support-only | none | 0 | 12.4 / 0 / 0 | {"defMul":0.3,"atkMul":0.4} | 2.2 / "single/self" |
| muaythai | boxer_iron@A | support-only | none | 0 | 22.3 / 0 / 0 | {"defMul":0.5,"atkMul":0.1} | 2.2 / "single/self" |
| muaythai | boxer_iron@B | support-only | none | 0 | 5 / 0 / 0 | {"defMul":0.15,"atkMul":0.4,"aspd":0.15} | 2.2 / "single/self" |
| muaythai | boxer_hanuman | damaging | 2.4 | 8 | 0 / 0 / 0 | {} | 2.2 / {"radius":1.52,"around":"target"} |
| muaythai | boxer_hanuman@A | damaging | 1.8 | 8 | 0 / 0 / 0 | {} | 2.2 / {"radius":3,"around":"target"} |
| muaythai | boxer_hanuman@B | damaging | 2.4 | 8 | 0 / 0 / 0 | {} | 2.2 / "single/self" |
| warrior | sword_twin | damaging | 0.9 | 3 | 0 / 0 / 0 | {} | 2.2 / {"radius":1.84,"around":"target"} |
| warrior | sword_twin@A | damaging | 0.8 | 3 | 0 / 0 / 0 | {} | 2.2 / {"radius":3,"around":"target"} |
| warrior | sword_twin@B | damaging | 1.1 | 3 | 0 / 0 / 0 | {} | 2.2 / {"radius":1.84,"around":"target"} |
| warrior | sword_thrust | damaging | 3 | 1 | 0 / 0 / 0 | {} | 4.4 / "single/self" |
| warrior | sword_thrust@A | damaging | 2.6 | 1 | 0 / 0 / 0 | {} | 4.4 / {"line":true,"length":6,"width":1.1} |
| warrior | sword_thrust@B | damaging | 3 | 1 | 0 / 0 / 0 | {} | 4.4 / "single/self" |
| warrior | sword_wind | damaging | 2.5 | 1 | 0 / 0 / 0 | {} | 9.2 / {"line":true,"length":9.2,"width":1.1} |
| warrior | sword_wind@A | damaging | 1.9 | 1 | 0 / 0 / 0 | {} | 12 / {"line":true,"length":13.2,"width":1.1} |
| warrior | sword_wind@B | damaging | 2.5 | 1 | 0 / 0 / 0 | {} | 6.8 / {"line":true,"length":6.8,"width":1.1} |
| warrior | sword_guard | support-only | none | 1 | 12.4 / 0 / 0 | {"def":25,"atkMul":0.15} | 2.2 / "single/self" |
| warrior | sword_guard@A | support-only | none | 1 | 19.8 / 0 / 0 | {"def":40} | 2.2 / "single/self" |
| warrior | sword_guard@B | support-only | none | 1 | 7.4 / 0 / 0 | {"def":12,"aspd":0.2} | 2.2 / "single/self" |
| warrior | sword_pikat | damaging | 2 | 6 | 0 / 0 / 0 | {} | 2.88 / {"radius":2.48,"around":"target"} |
| warrior | sword_pikat@A | damaging | 1.5 | 6 | 0 / 0 / 0 | {} | 4.4 / {"radius":4,"around":"target"} |
| warrior | sword_pikat@B | damaging | 2 | 6 | 0 / 0 / 0 | {} | 2.2 / {"radius":1.8,"around":"target"} |
| warrior | sword_banner | support-only | none | 1 | 9.9 / 0 / 0 | {"atkMul":0.22,"def":8} | 2.2 / "single/self" |
| warrior | sword_banner@A | support-only | none | 1 | 12.4 / 0 / 0 | {"def":20,"atkMul":0.08} | 2.2 / "single/self" |
| warrior | sword_banner@B | support-only | none | 1 | 5 / 0 / 0 | {"atkMul":0.22,"aspd":0.18} | 2.2 / "single/self" |
| warrior | sword_whirl | damaging | 1.6 | 3 | 0 / 0 / 0 | {} | 2.2 / {"radius":3.12,"around":"self"} |
| warrior | sword_whirl@A | damaging | 1.3 | 3 | 0 / 0 / 0 | {} | 2.2 / {"radius":4.4,"around":"self"} |
| warrior | sword_whirl@B | damaging | 2.1 | 3 | 0 / 0 / 0 | {} | 2.2 / {"radius":3.12,"around":"self"} |
| warrior | sword_leap | damaging | 6.5 | 1 | 0 / 0 / 0 | {} | 5.2 / {"radius":2.8,"around":"target"} |
| warrior | sword_leap@A | damaging | 4.8 | 1 | 0 / 0 / 0 | {} | 5.2 / {"radius":4.2,"around":"target"} |
| warrior | sword_leap@B | damaging | 6.5 | 1 | 0 / 0 / 0 | {} | 5.2 / {"radius":1.8,"around":"target"} |
| warrior | sword_berserk | support-only | none | 1 | 0 / 0 / 0 | {"atkMul":0.35,"critAdd":0.15,"speed":0.15,"aspd":0.15} | 2.2 / "single/self" |
| warrior | sword_berserk@A | support-only | none | 1 | 0 / 0 / 0 | {"atkMul":0.2,"defMul":0.2} | 2.2 / "single/self" |
| warrior | sword_berserk@B | support-only | none | 1 | 0 / 0 / 0 | {"atkMul":0.25,"critAdd":0.1,"aspd":0.25} | 2.2 / "single/self" |
| warrior | sword_execute | damaging | 16 | 1 | 0 / 0 / 0 | {} | 2.64 / {"radius":2.64,"around":"target"} |
| warrior | sword_execute@A | damaging | 11 | 1 | 0 / 0 / 0 | {} | 2.64 / {"radius":3.5,"around":"target"} |
| warrior | sword_execute@B | damaging | 16 | 1 | 0 / 0 / 0 | {} | 2.64 / "single/self" |
| hunter | arch_quick | damaging | 1 | 1 | 0 / 0 / 0 | {} | 11.2 / "single/self" |
| hunter | arch_quick@A | damaging | 0.75 | 1 | 0 / 0 / 0 | {} | 11.2 / "single/self" |
| hunter | arch_quick@B | damaging | 1 | 1 | 0 / 0 / 0 | {} | 11.2 / "single/self" |
| hunter | arch_poison | damaging | 2.2 | 1 | 0 / 0 / 0 | {} | 11.2 / "single/self" |
| hunter | arch_poison@A | damaging | 2.2 | 1 | 0 / 0 / 0 | {} | 11.2 / "single/self" |
| hunter | arch_poison@B | damaging | 1.8 | 1 | 0 / 0 / 0 | {} | 11.2 / {"chain":3,"radius":4} |
| hunter | arch_pierce | damaging | 2 | 1 | 0 / 0 / 0 | {} | 9.2 / {"radius":3.6,"around":"target"} |
| hunter | arch_pierce@A | damaging | 2.8 | 1 | 0 / 0 / 0 | {} | 8 / {"radius":2.4,"around":"target"} |
| hunter | arch_pierce@B | damaging | 1.6 | 1 | 0 / 0 / 0 | {} | 10.8 / {"radius":5.2,"around":"target"} |
| hunter | arch_hawk | support-only | none | 1 | 0 / 0 / 0 | {"atkMul":0.15,"critAdd":0.1,"aspd":0.25} | 2.2 / "single/self" |
| hunter | arch_hawk@A | support-only | none | 1 | 0 / 0 / 0 | {"aspd":0.2,"atkMul":0.08} | 2.2 / "single/self" |
| hunter | arch_hawk@B | support-only | none | 1 | 0 / 0 / 0 | {"critAdd":0.2,"atkMul":0.2} | 2.2 / "single/self" |
| hunter | arch_rain | damaging | 1.8 | 1 | 0 / 0 / 0 | {} | 9.6 / {"radius":4,"around":"target"} |
| hunter | arch_rain@A | damaging | 1.3 | 1 | 0 / 0 / 0 | {} | 11.6 / {"radius":6,"around":"target"} |
| hunter | arch_rain@B | damaging | 1.8 | 1 | 0 / 0 / 0 | {} | 8.4 / {"radius":2.8,"around":"target"} |
| hunter | arch_garuda | damaging | 3.2 | 1 | 0 / 0 / 0 | {} | 2.2 / {"radius":4,"around":"self"} |
| hunter | arch_garuda@A | damaging | 2.4 | 1 | 0 / 0 / 0 | {} | 2.2 / {"radius":6.2,"around":"self"} |
| hunter | arch_garuda@B | damaging | 3.2 | 1 | 0 / 0 / 0 | {} | 2.2 / {"radius":2.6,"around":"self"} |
| hunter | arch_volley | damaging | 4.2 | 1 | 0 / 0 / 0 | {} | 12 / {"line":true,"length":14.4,"width":1.1} |
| hunter | arch_volley@A | damaging | 3.1 | 1 | 0 / 0 / 0 | {} | 12 / {"line":true,"length":18,"width":1.1} |
| hunter | arch_volley@B | damaging | 4.2 | 1 | 0 / 0 / 0 | {} | 10.4 / {"line":true,"length":10.4,"width":1.1} |
| hunter | arch_trap | damaging | 5.5 | 1 | 0 / 0 / 0 | {} | 8.6 / {"radius":3.8,"around":"target"} |
| hunter | arch_trap@A | damaging | 5.5 | 1 | 0 / 0 / 0 | {} | 8.6 / {"radius":3.8,"around":"target"} |
| hunter | arch_trap@B | damaging | 5.5 | 1 | 0 / 0 / 0 | {} | 8.6 / {"radius":3.8,"around":"target"} |
| hunter | arch_snipe | damaging | 14 | 1 | 0 / 0 / 0 | {} | 12 / "single/self" |
| hunter | arch_snipe@A | damaging | 10 | 1 | 0 / 0 / 0 | {} | 12 / "single/self" |
| hunter | arch_snipe@B | damaging | 14 | 1 | 0 / 0 / 0 | {} | 12 / "single/self" |
| hunter | arch_meteor | damaging | 2.8 | 1 | 0 / 0 / 0 | {} | 11.6 / {"radius":6,"around":"target"} |
| hunter | arch_meteor@A | damaging | 2 | 1 | 0 / 0 / 0 | {} | 12 / {"radius":8.4,"around":"target"} |
| hunter | arch_meteor@B | damaging | 2.8 | 1 | 0 / 0 / 0 | {} | 9.6 / {"radius":4,"around":"target"} |
| shaman | mage_akom | damaging | 0.75 | 1 | 0 / 0 / 0 | {} | 9.6 / "single/self" |
| shaman | mage_akom@A | damaging | 0.55 | 1 | 0 / 0 / 0 | {} | 12 / "single/self" |
| shaman | mage_akom@B | damaging | 0.75 | 1 | 0 / 0 / 0 | {} | 7.2 / "single/self" |
| shaman | mage_yant | damaging | 2.9 | 1 | 0 / 0 / 0 | {} | 8.8 / {"line":true,"length":8.8,"width":1.1} |
| shaman | mage_yant@A | damaging | 2.4 | 1 | 0 / 0 / 0 | {} | 8.8 / {"line":true,"length":8.8,"width":1.1} |
| shaman | mage_yant@B | damaging | 3.6 | 1 | 0 / 0 / 0 | {} | 8.8 / {"line":true,"length":8.8,"width":1.1} |
| shaman | mage_shield | support-only | none | 1 | 14.9 / 0 / 0 | {"def":24} | 2.2 / "single/self" |
| shaman | mage_shield@A | support-only | none | 1 | 22.3 / 0 / 0 | {"def":38} | 2.2 / "single/self" |
| shaman | mage_shield@B | support-only | none | 1 | 7.4 / 0 / 0 | {"def":16} | 2.2 / "single/self" |
| shaman | mage_thunder | damaging | 2.75 | 1 | 0 / 0 / 0 | {} | 10.8 / "single/self" |
| shaman | mage_thunder@A | damaging | 2 | 1 | 0 / 0 / 0 | {} | 10.8 / "single/self" |
| shaman | mage_thunder@B | damaging | 2.2 | 1 | 0 / 0 / 0 | {} | 10.8 / {"radius":2.5,"around":"target"} |
| shaman | mage_kalp | damaging | 2.2 | 4 | 0 / 0 / 0 | {} | 12 / {"radius":6.8,"around":"target"} |
| shaman | mage_kalp@A | damaging | 2.8 | 4 | 0 / 0 / 0 | {} | 10.4 / {"radius":4.4,"around":"target"} |
| shaman | mage_kalp@B | damaging | 1.9 | 4 | 0 / 0 / 0 | {} | 12 / {"radius":8.8,"around":"target"} |
| shaman | mage_holy | support-only | none | 1 | 18.6 / 0 / 15 | {"def":12} | 2.2 / "single/self" |
| shaman | mage_holy@A | support-only | none | 1 | 28.5 / 0 / 0 | {"def":16} | 2.2 / "single/self" |
| shaman | mage_holy@B | support-only | none | 1 | 9.9 / 0 / 25 | {"def":6} | 2.2 / "single/self" |
| shaman | mage_ghostfire | damaging | 0.85 | 1 | 0 / 0 / 0 | {} | 9.2 / {"cone":true,"length":9.2,"angle":1.0471975511965976} |
| shaman | mage_ghostfire@A | damaging | 0.65 | 1 | 0 / 0 / 0 | {} | 9.2 / {"cone":true,"length":9.2,"angle":1.5707963267948966} |
| shaman | mage_ghostfire@B | damaging | 0.85 | 1 | 0 / 0 / 0 | {} | 9.2 / {"cone":true,"length":9.2,"angle":0.5235987755982988} |
| shaman | mage_curse | damaging | 2 | 1 | 0 / 0 / 0 | {} | 10.8 / {"radius":6,"around":"target"} |
| shaman | mage_curse@A | damaging | 2 | 1 | 0 / 0 / 0 | {} | 10.8 / {"radius":6,"around":"target"} |
| shaman | mage_curse@B | damaging | 2 | 1 | 0 / 0 / 0 | {} | 10.8 / {"radius":6,"around":"target"} |
| shaman | mage_meditate | support-only | none | 1 | 12.4 / 0 / 0 | {"atkMul":0.35,"critAdd":0.1} | 2.2 / "single/self" |
| shaman | mage_meditate@A | support-only | none | 1 | 24.8 / 0 / 0 | {"atkMul":0.15,"defMul":0.25} | 2.2 / "single/self" |
| shaman | mage_meditate@B | support-only | none | 1 | 5 / 0 / 0 | {"atkMul":0.3,"critAdd":0.1} | 2.2 / "single/self" |
| shaman | mage_storm | damaging | 2.6 | 5 | 0 / 0 / 0 | {} | 2.2 / {"radius":10.4,"around":"self"} |
| shaman | mage_storm@A | damaging | 1.9 | 5 | 0 / 0 / 0 | {} | 2.2 / {"radius":13.2,"around":"self"} |
| shaman | mage_storm@B | damaging | 2.6 | 5 | 0 / 0 / 0 | {} | 2.2 / {"radius":7.2,"around":"self"} |
| herbalist | heal_vine | heal-hybrid (fallback) | none | 1 | 0 / 111 / 0 | {} | 8.8 / "single/self" |
| herbalist | heal_vine@A | heal-hybrid (fallback) | none | 1 | 0 / 157 / 0 | {} | 8.8 / "single/self" |
| herbalist | heal_vine@B | heal-hybrid (fallback) | none | 1 | 0 / 74 / 0 | {} | 8.8 / "single/self" |
| herbalist | heal_pill | heal-hybrid | 1.3 | 1 | 0 / 139 / 0 | {} | 8.8 / "single/self" |
| herbalist | heal_pill@A | heal-hybrid | 0.75 | 1 | 0 / 198 / 0 | {} | 8.8 / "single/self" |
| herbalist | heal_pill@B | heal-hybrid | 1.3 | 1 | 0 / 87 / 0 | {} | 8.8 / "single/self" |
| herbalist | heal_zone | damaging | 1.2 | 1 | 0 / 0 / 0 | {} | 8.8 / {"radius":4.4,"around":"target"} |
| herbalist | heal_zone@A | damaging | 0.85 | 1 | 0 / 0 / 0 | {} | 11 / {"radius":6.6,"around":"target"} |
| herbalist | heal_zone@B | damaging | 1.2 | 1 | 0 / 0 / 0 | {} | 7.4 / {"radius":3,"around":"target"} |
| herbalist | heal_tiger | support-only | none | 1 | 0 / 0 / 0 | {"defMul":0.2,"speed":0.25,"cleanse":true} | 2.2 / "single/self" |
| herbalist | heal_tiger@A | support-only | none | 1 | 0 / 0 / 0 | {"defMul":0.35,"cleanse":true} | 2.2 / "single/self" |
| herbalist | heal_tiger@B | support-only | none | 1 | 0 / 0 / 0 | {"atkMul":0.2,"defMul":0.1,"cleanse":true} | 2.2 / "single/self" |
| herbalist | heal_khwan | support-only | none | 1 | 49.6 / 0 / 0 | {} | 2.2 / "single/self" |
| herbalist | heal_khwan@A | support-only | none | 1 | 34.7 / 0 / 0 | {} | 2.2 / "single/self" |
| herbalist | heal_khwan@B | support-only | none | 1 | 59.5 / 0 / 0 | {} | 2.2 / "single/self" |
| herbalist | heal_mortar | heal-hybrid | 2 | 3 | 0 / 79 / 0 | {} | 8.8 / {"radius":4.4,"around":"target"} |
| herbalist | heal_mortar@A | heal-hybrid | 2.8 | 3 | 0 / 79 / 0 | {} | 8.8 / {"radius":4.4,"around":"target"} |
| herbalist | heal_mortar@B | heal-hybrid | 2 | 3 | 0 / 79 / 0 | {} | 10.4 / {"radius":6,"around":"target"} |
| herbalist | heal_mist | support-only | none | 1 | 22.3 / 0 / 10 | {"def":6} | 2.2 / "single/self" |
| herbalist | heal_mist@A | support-only | none | 1 | 32.2 / 0 / 0 | {"def":6} | 2.2 / "single/self" |
| herbalist | heal_mist@B | support-only | none | 1 | 14.9 / 0 / 25 | {"def":12} | 2.2 / "single/self" |
| herbalist | heal_tonic | support-only | none | 1 | 6.2 / 0 / 0 | {"atkMul":0.18,"defMul":0.15} | 2.2 / "single/self" |
| herbalist | heal_tonic@A | support-only | none | 1 | 9.9 / 0 / 0 | {"defMul":0.25,"atkMul":0.06} | 2.2 / "single/self" |
| herbalist | heal_tonic@B | support-only | none | 1 | 3.7 / 0 / 0 | {"atkMul":0.18,"aspd":0.18} | 2.2 / "single/self" |
| herbalist | heal_mother | support-only | none | 1 | 55.8 / 0 / 20 | {"critAdd":0.1} | 2.2 / "single/self" |
| herbalist | heal_mother@A | support-only | none | 1 | 68.2 / 0 / 0 | {} | 2.2 / "single/self" |
| herbalist | heal_mother@B | support-only | none | 1 | 31 / 0 / 35 | {"critAdd":0.1} | 2.2 / "single/self" |
| herbalist | heal_amrita | support-only | none | 1 | 74.4 / 0 / 0 | {} | 2.2 / "single/self" |
| herbalist | heal_amrita@A | support-only | none | 1 | 52.1 / 0 / 0 | {} | 2.2 / "single/self" |
| herbalist | heal_amrita@B | support-only | none | 1 | 89.3 / 0 / 0 | {} | 2.2 / "single/self" |

Coverage totals: {"damaging":93,"support-only":48,"heal-hybrid (fallback)":3,"heal-hybrid":6}.

## Historical findings before canonical delivery

1. `heal_vine` is the sole offensive intent without an explicit `mult`. Its move description says it drains a target; herbalist FX calls `hurt(40)` on repeated ticks. `rollSkill` returns zero for missing mult, the FX wrapper falls back to its authored amount, and `KitCaster.hurt`/server `rollBlow` can instead use `RULES.kit.fallbackMult` (1). Therefore the training dummy, local monster and authoritative monster can show different damage. The director must decide an explicit rules coefficient for this hybrid; it must not become a damaging skill merely because all support skills have animation timestamps.
2. Shaman `mage_storm` FX checks `near(hp0, 5.2)` around the original caster position. Base radius 260 px is 10.4 m; A is 330 px (13.2 m); B is 180 px (7.2 m). The cast rules and FX acceptance do not visibly share a radius. At a valid target outside the fixed FX radius, the callback may never fire. Trace all three variants against a stationary target at near and far distances.
3. `mage_akom` and `mage_ghostfire` only call hurt after moving projectiles pass a `near(...)` check. `mage_thunder` schedules its callback only if the target remains near the visual hand location. A positive rules multiplier cannot prove those callbacks reach the target. The root runtime audit owns actual hit traces and any correction to geometric acceptance.
4. Shaman `mage_kalp` and `mage_curse` FX have additional explicit hurt callbacks for visual burn/poison ticks; shared rules also apply DOT debuffs. Kit timestamp count alone understates those callbacks. Compare emitted blows, server per-target allowance and rules DOT to identify missing or duplicated damage; do not assume each callback is another intended full direct hit.

## A/B description and support checks

The newly added 35 pairs retain the same function classification across base/A/B. None introduces a missing offensive multiplier or promises damage for a support-only skill. Coverage, control, healing and tempo descriptions have corresponding supported override fields. Entire effect/buff records replace the base, so a removed field is an intended sacrifice.

Physical party buffs (`boxer_drum`, `sword_banner`) and healer tonic remain support-only even where descriptions say attack or attack speed increases. Their `buff.atkMul` raises the recipient's future physical and magic damage; it does not turn the party cast into a direct attack. `aspd` boosts basic attack cadence rather than animation hit count or skill cooldown. `mage_meditate` similarly buffs subsequent attacks and spells without striking the selected monster.

Current `heal_tiger` A/B descriptions correctly describe defense and attack only. Retained raw `cleanse`/`speed` data does not establish implemented effects: `selfEffects` exposes defense, attack, crit and attack speed. The base kit movement-speed claim and unsupported kit armor-break, weakness, knockback and dog-bite-rate claims have been removed from displayed descriptions; numeric fields are preserved.

New `mage_shield` A/B, `mage_holy` A/B and `mage_meditate` A/B descriptions correctly promise defense, healing, resource recovery or buff cadence, with no direct offensive promise. Party support radius comes from `supportOf`; offensive AoE range comes from `castInfo`/`splashOf`. They must be traced independently.

Validation: all 150 static expectation records were generated successfully. Runtime owner subsequently verified 1,200 actual HP cases: all 150 base/A/B variants × two distances × two target sizes × stable/rebound target selection. Zero browser errors and no wrong-target damage were reported. Earlier full suite: 768 tests, 766 passed, zero failed, two optional skips. Final suite after the tether-window regression: 769 tests, 766 passed, one unrelated world-boss daytime clock assertion failed (expected closed, observed dawn), two optional skips. The isolated world-boss integration rerun passed 2/2; final scoped server/runtime/rules tests passed 35/35 and the production build passed. Natural hunting and party balance remain pending playtesting.

## Resolved canonical delivery

The findings above record the previous FX-driven delivery and are historical. KitCaster now delivers direct damage through the canonical shared `src/rules/skillHits.js` schedule rather than accepting FX hurt callbacks. Effective A/B areas come from shared rules, and target selection remains bound to the cast. This resolves shaman projectile geometry, kalp range gating, storm area mismatch and duplicated offensive DOT callbacks. Rules poison/burn remain independent debuffs.

`heal_vine` preserves twelve offensive ticks from duration 6000 ms / tick 500 ms. `heal_pill` preserves three enemy blows from its five alternating hops (enemy, hero, enemy, hero, enemy). `heal_zone` delivers one direct blow plus its rules poison; extra visual pulses do not add full direct damage. Healing remains controlled by selfEffects/supportOf. All buff, party and revive skills are excluded from direct hit schedules. In particular, shaman `mage_shield`, `mage_holy` and `mage_meditate` remain non-damaging by design on base, A and B.
