// Curated existing areas plus clear approaches; generated once, not at runtime.
import { MONSTERS } from '../combat/data/monsters.js';
export const REGIONAL_HUNTS = [
  {
    "id": "orchard_boars",
    "map": "paddy",
    "name": "หมูป่า · วงล่า",
    "x": 56,
    "z": -172,
    "radius": 13,
    "levels": [
      1,
      1
    ],
    "approach": {
      "x": 69,
      "z": -172
    },
    "roster": [
      {
        "type": "boar",
        "count": 3,
        "active": [
          "morning",
          "day",
          "evening"
        ]
      }
    ]
  },
  {
    "id": "orchard_monkeys",
    "map": "paddy",
    "name": "ลิงกัง · วงล่า",
    "x": 86,
    "z": -214,
    "radius": 14,
    "levels": [
      2,
      2
    ],
    "approach": {
      "x": 99,
      "z": -214
    },
    "roster": [
      {
        "type": "monkey",
        "count": 3,
        "active": [
          "morning",
          "day",
          "evening"
        ]
      }
    ]
  },
  {
    "id": "grassland",
    "map": "paddy",
    "name": "หมูป่า · วงล่า",
    "x": -40,
    "z": -268,
    "radius": 16,
    "levels": [
      1,
      3
    ],
    "approach": {
      "x": -27,
      "z": -268
    },
    "roster": [
      {
        "type": "boar",
        "count": 2,
        "active": [
          "morning",
          "day",
          "evening"
        ]
      },
      {
        "type": "monkey",
        "count": 2,
        "active": [
          "morning",
          "day",
          "evening"
        ]
      },
      {
        "type": "phibpa",
        "count": 2,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      }
    ]
  },
  {
    "id": "rice_fowl",
    "map": "paddy",
    "name": "ไก่ป่า · วงล่า",
    "x": -60,
    "z": -176,
    "radius": 16,
    "levels": [
      1,
      1
    ],
    "approach": {
      "x": -47,
      "z": -176
    },
    "roster": [
      {
        "type": "fowl",
        "count": 3,
        "active": [
          "morning",
          "day",
          "evening"
        ]
      }
    ]
  },
  {
    "id": "paddy_channels",
    "map": "paddy",
    "name": "งูเห่านา · วงล่า",
    "x": -92,
    "z": -226,
    "radius": 14,
    "levels": [
      2,
      2
    ],
    "approach": {
      "x": -79,
      "z": -226
    },
    "roster": [
      {
        "type": "cobra",
        "count": 2,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      },
      {
        "type": "crab",
        "count": 2,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      }
    ]
  },
  {
    "id": "hunt_paddy_loop_7",
    "map": "paddy",
    "name": "วงล่า ทุ่งนาข้าว 8",
    "x": 26,
    "z": -249.5,
    "radius": 8,
    "levels": [
      2,
      2
    ],
    "approach": {
      "x": 37,
      "z": -249.5
    },
    "roster": [
      {
        "type": "crab",
        "count": 2
      }
    ]
  },
  {
    "id": "forest_edge",
    "map": "deep_forest",
    "name": "ลิงกัง · วงล่า",
    "x": 26,
    "z": -336,
    "radius": 15,
    "levels": [
      2,
      4
    ],
    "approach": {
      "x": 39,
      "z": -336
    },
    "roster": [
      {
        "type": "monkey",
        "count": 2,
        "active": [
          "morning",
          "day",
          "evening"
        ]
      },
      {
        "type": "phibpa",
        "count": 2,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      },
      {
        "type": "pray",
        "count": 2,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      }
    ]
  },
  {
    "id": "dense_forest",
    "map": "deep_forest",
    "name": "ลิงกัง · วงล่า",
    "x": -28,
    "z": -372,
    "radius": 18,
    "levels": [
      2,
      4
    ],
    "approach": {
      "x": -18.80761184457488,
      "z": -362.80761184457486
    },
    "roster": [
      {
        "type": "monkey",
        "count": 2,
        "active": [
          "morning",
          "day",
          "evening"
        ]
      },
      {
        "type": "phibpa",
        "count": 2,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      },
      {
        "type": "pray",
        "count": 2,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      },
      {
        "type": "kongkoi",
        "count": 2,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      }
    ]
  },
  {
    "id": "deep_forest",
    "map": "deep_forest",
    "name": "ผีพราย · วงล่า",
    "x": 48,
    "z": -423,
    "radius": 12,
    "levels": [
      4,
      5
    ],
    "approach": {
      "x": 61,
      "z": -423
    },
    "roster": [
      {
        "type": "pray",
        "count": 2,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      },
      {
        "type": "winyan",
        "count": 2,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      }
    ]
  },
  {
    "id": "deep_west",
    "map": "deep_forest",
    "name": "ผีป่า · วงล่า",
    "x": -52,
    "z": -428,
    "radius": 13,
    "levels": [
      3,
      5
    ],
    "approach": {
      "x": -39,
      "z": -428
    },
    "roster": [
      {
        "type": "phibpa",
        "count": 2,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      },
      {
        "type": "pray",
        "count": 2,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      },
      {
        "type": "winyan",
        "count": 2,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      }
    ]
  },
  {
    "id": "dhole_trail",
    "map": "deep_forest",
    "name": "หมาไน · วงล่า",
    "x": 62,
    "z": -368,
    "radius": 14,
    "levels": [
      3,
      3
    ],
    "approach": {
      "x": 75,
      "z": -368
    },
    "roster": [
      {
        "type": "dhole",
        "count": 3,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      }
    ]
  },
  {
    "id": "monitor_stream",
    "map": "deep_forest",
    "name": "เหี้ย · วงล่า",
    "x": -86,
    "z": -396,
    "radius": 12,
    "levels": [
      4,
      4
    ],
    "approach": {
      "x": -73,
      "z": -396
    },
    "roster": [
      {
        "type": "monitor",
        "count": 3,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      }
    ]
  },
  {
    "id": "wisp_hollow",
    "map": "deep_forest",
    "name": "ผีโขมด · วงล่า",
    "x": 76,
    "z": -402,
    "radius": 12,
    "levels": [
      4,
      5
    ],
    "approach": {
      "x": 89,
      "z": -402
    },
    "roster": [
      {
        "type": "khamot",
        "count": 2,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      },
      {
        "type": "kongkoi",
        "count": 2,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      }
    ]
  },
  {
    "id": "hunt_deep_forest_loop_9",
    "map": "deep_forest",
    "name": "วงล่า ป่าลึก 10",
    "x": -94,
    "z": -338.5,
    "radius": 8,
    "levels": [
      4,
      4
    ],
    "approach": {
      "x": -83,
      "z": -338.5
    },
    "roster": [
      {
        "type": "pray",
        "count": 4
      }
    ]
  },
  {
    "id": "wat_grove",
    "map": "wat_rang",
    "name": "ผีพราย · วงล่า",
    "x": 46,
    "z": -480,
    "radius": 16,
    "levels": [
      4,
      5
    ],
    "approach": {
      "x": 59,
      "z": -480
    },
    "roster": [
      {
        "type": "pray",
        "count": 2,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      },
      {
        "type": "winyan",
        "count": 2,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      }
    ]
  },
  {
    "id": "abandoned_shrine",
    "map": "wat_rang",
    "name": "วิญญาณเร่ร่อน · วงล่า",
    "x": -36,
    "z": -470,
    "radius": 9,
    "levels": [
      5,
      5
    ],
    "approach": {
      "x": -24,
      "z": -470
    },
    "roster": [
      {
        "type": "winyan",
        "count": 3,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      }
    ]
  },
  {
    "id": "cemetery_path",
    "map": "wat_rang",
    "name": "วิญญาณเร่ร่อน · วงล่า",
    "x": 4,
    "z": -492,
    "radius": 11,
    "levels": [
      5,
      5
    ],
    "approach": {
      "x": 17,
      "z": -492
    },
    "roster": [
      {
        "type": "winyan",
        "count": 3,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      }
    ]
  },
  {
    "id": "cemetery_graves",
    "map": "wat_rang",
    "name": "ผีตายโหง · วงล่า",
    "x": 14,
    "z": -548,
    "radius": 10,
    "levels": [
      5,
      7
    ],
    "approach": {
      "x": 27,
      "z": -548
    },
    "roster": [
      {
        "type": "phitaihong",
        "count": 2,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      },
      {
        "type": "winyan",
        "count": 2,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      }
    ]
  },
  {
    "id": "wat_courtyard",
    "map": "wat_rang",
    "name": "ผีตายโหง · วงล่า",
    "x": 68,
    "z": -540,
    "radius": 14,
    "levels": [
      5,
      8
    ],
    "approach": {
      "x": 81,
      "z": -540
    },
    "roster": [
      {
        "type": "phitaihong",
        "count": 2,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      },
      {
        "type": "winyan",
        "count": 2,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      },
      {
        "type": "soldier",
        "count": 2,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      }
    ]
  },
  {
    "id": "wat_ruins",
    "map": "wat_rang",
    "name": "ผีหัวขาด · วงล่า",
    "x": -62,
    "z": -522,
    "radius": 14,
    "levels": [
      6,
      6
    ],
    "approach": {
      "x": -49,
      "z": -522
    },
    "roster": [
      {
        "type": "headless",
        "count": 2,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      },
      {
        "type": "pret",
        "count": 2,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      }
    ]
  },
  {
    "id": "wat_sky",
    "map": "wat_rang",
    "name": "ผีกระหัง · วงล่า",
    "x": 32,
    "z": -500,
    "radius": 10,
    "levels": [
      7,
      7
    ],
    "approach": {
      "x": 45,
      "z": -500
    },
    "roster": [
      {
        "type": "krahang",
        "count": 3,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      }
    ]
  },
  {
    "id": "hunt_wat_rang_loop_9",
    "map": "wat_rang",
    "name": "วงล่า วัดร้าง 10",
    "x": -94,
    "z": -559,
    "radius": 8,
    "levels": [
      8,
      8
    ],
    "approach": {
      "x": -83,
      "z": -559
    },
    "roster": [
      {
        "type": "soldier",
        "count": 4
      }
    ]
  },
  {
    "id": "leech_reeds",
    "map": "klong",
    "name": "ปลิงควาย · วงล่า",
    "x": -78,
    "z": -656,
    "radius": 8,
    "levels": [
      11,
      11
    ],
    "approach": {
      "x": -67,
      "z": -656
    },
    "roster": [
      {
        "type": "leech",
        "count": 3,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      }
    ]
  },
  {
    "id": "wraith_pool",
    "map": "klong",
    "name": "ผีพรายน้ำ · วงล่า",
    "x": 74,
    "z": -640,
    "radius": 8,
    "levels": [
      12,
      12
    ],
    "approach": {
      "x": 84.16267485762415,
      "z": -635.790482243984
    },
    "roster": [
      {
        "type": "wraith",
        "count": 3,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      }
    ]
  },
  {
    "id": "croc_bank",
    "map": "klong",
    "name": "จระเข้บึง · วงล่า",
    "x": -62,
    "z": -676,
    "radius": 10,
    "levels": [
      13,
      13
    ],
    "approach": {
      "x": -49,
      "z": -676
    },
    "roster": [
      {
        "type": "croc",
        "count": 3,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      }
    ]
  },
  {
    "id": "python_grass",
    "map": "klong",
    "name": "งูเหลือมดงอ้อ · วงล่า",
    "x": 52,
    "z": -666,
    "radius": 10,
    "levels": [
      14,
      14
    ],
    "approach": {
      "x": 65,
      "z": -666
    },
    "roster": [
      {
        "type": "python",
        "count": 3,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      }
    ]
  },
  {
    "id": "phong_marsh",
    "map": "klong",
    "name": "ผีโพง · วงล่า",
    "x": 62,
    "z": -722,
    "radius": 12,
    "levels": [
      15,
      15
    ],
    "approach": {
      "x": 75,
      "z": -722
    },
    "roster": [
      {
        "type": "phong",
        "count": 3,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      }
    ]
  },
  {
    "id": "kumphi_bank",
    "map": "klong",
    "name": "กุมภีล์ · วงล่า",
    "x": 96,
    "z": -710,
    "radius": 10,
    "levels": [
      19,
      19
    ],
    "approach": {
      "x": 109,
      "z": -710
    },
    "roster": [
      {
        "type": "kumphi",
        "count": 3,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      }
    ]
  },
  {
    "id": "nangram_field",
    "map": "klong",
    "name": "ผีนางรำ · วงล่า",
    "x": -20,
    "z": -778,
    "radius": 12,
    "levels": [
      22,
      22
    ],
    "approach": {
      "x": -7,
      "z": -778
    },
    "roster": [
      {
        "type": "nangram",
        "count": 3,
        "active": [
          "morning",
          "day",
          "evening",
          "night"
        ]
      }
    ]
  },
  {
    "id": "hunt_klong_loop_9",
    "map": "klong",
    "name": "วงล่า คลองหนองบึง 10",
    "x": -22,
    "z": -715.5,
    "radius": 8,
    "levels": [
      22,
      22
    ],
    "approach": {
      "x": -11,
      "z": -715.5
    },
    "roster": [
      {
        "type": "nangram",
        "count": 4
      }
    ]
  },
  {
    "id": "hunt_klong_loop_10",
    "map": "klong",
    "name": "วงล่า คลองหนองบึง 11",
    "x": 2,
    "z": -643.5,
    "radius": 8,
    "levels": [
      22,
      22
    ],
    "approach": {
      "x": 13,
      "z": -643.5
    },
    "roster": [
      {
        "type": "nangram",
        "count": 4
      }
    ]
  },
  {
    "id": "hunt_klong_loop_11",
    "map": "klong",
    "name": "วงล่า คลองหนองบึง 12",
    "x": 98,
    "z": -763.5,
    "radius": 8,
    "levels": [
      22,
      22
    ],
    "approach": {
      "x": 109,
      "z": -763.5
    },
    "roster": [
      {
        "type": "nangram",
        "count": 4
      }
    ]
  }
];

for(const c of REGIONAL_HUNTS) {
  if(!c.roster.some(r=>!r.active||r.active.includes('night'))) c.roster.push({type:c.map==='paddy'?'crab':'phibpa',count:1,active:['morning','day','evening','night']});
  const levels = c.roster.map(r => MONSTERS[r.type].level);
  c.levels = [Math.min(...levels), Math.max(...levels)];
}
