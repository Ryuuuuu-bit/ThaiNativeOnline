// Points of interest in the glade. Positions also drive where the
// architecture is built, the side paths and the clearings around them.
// `obstacleRadius` is the walk-blocking footprint of the building itself;
// `radius` is the interaction/clearing radius used by gameplay and layout.
export const landmarks = [
  {
    id: 'old-chedi', kind: 'chedi', name: 'เจดีย์เก่า',
    x: -5.4, z: -7.4, radius: 2.5, obstacleRadius: 2.65,
    exploreText: 'เจดีย์เก่า · รากไม้โอบล้อมอิฐที่ผ่านกาลเวลา สถานที่แห่งนี้จะเป็นจุดเริ่มต้นของเรื่องราวในบทต่อไป',
    questText: 'ค้นพบเจดีย์กลางป่าแล้ว',
  },
  {
    id: 'canal-pavilion', kind: 'pavilion', name: 'ศาลาริมคลอง',
    x: 9, z: -7, radius: 2.6, obstacleRadius: 2.4,
    exploreText: 'ศาลาริมคลอง · สายลมพัดผ่านหลังคาไม้ และบัวค่อย ๆ ลอยตามผิวน้ำ',
  },
  {
    id: 'forest-shrine', kind: 'shrine', name: 'ศาลเจ้าป่า',
    x: -12, z: 6, radius: 1.5, obstacleRadius: 1.1,
    exploreText: 'ศาลเจ้าป่า · พวงมาลัยเก่าบอกว่ามีผู้เดินทางมาที่นี่ก่อนคุณ',
  },
];

export function landmarkById(id) { return landmarks.find(l => l.id === id); }
