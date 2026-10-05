# Thai Native Online — Agent Instructions

## Source of Truth
1. docs/GAME_VISION.md
2. docs/world/*
3. docs/art/*
4. docs/technical/*

## Legacy Policy
The old ThaiNative project is a gameplay/design reference only: classes, monsters, progression, quests, economy, lore, server ideas.
It is NOT the visual authority.

ThaiNativeOnline is a visual reboot. If legacy visuals conflict with docs/art/ART_BIBLE.md, ART_BIBLE.md wins.

## Workflow
Game Director -> specialist agent -> Art/Tech review -> QA -> PR.

Before editing:
- inspect current implementation
- read role-relevant docs
- avoid unrelated rewrites
- preserve modularity
- run `npm run build`

Every task report must include summary, changed files, validation, screenshots for visual work, and known limitations.

## Git
Do not work directly on main. Use task branches and PRs.
