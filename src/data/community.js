// Community links and the news feed (server/news.js, src/ui/NewsPanel.js).
// GMs post news in chat: /gm news <kind> <หัวข้อ> | <เนื้อหา> · /gm news list · /gm news del <id>

export const COMMUNITY = Object.freeze({
  discord: 'https://discord.gg/x9schPHqqX',
  discordPromptLevel: 5,   // the one-time "join our Discord" card appears on reaching this level
});

// kind → label shown on the news tag; `banner` kinds sit above the list (maintenance notices)
export const NEWS_KINDS = Object.freeze({
  update: Object.freeze({ label: 'อัปเดต' }),
  event: Object.freeze({ label: 'อีเวนต์' }),
  notice: Object.freeze({ label: 'ประกาศ' }),
  maint: Object.freeze({ label: 'ปิดปรับปรุง', banner: true }),
});

export const NEWS = Object.freeze({ titleMax: 80, bodyMax: 600, listMax: 20 });
