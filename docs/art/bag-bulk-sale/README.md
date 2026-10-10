# 500-slot bag and bulk sale

The bag now has 500 slots for new and existing characters. Loading pads older saves without dropping item instances, locks, enhancement, cards or flask charges. Weight and stack rules remain unchanged. Server reconciliation and the WebSocket payload budget support a full bag and one atomic bulk sale.

Shop sale actions include **เลือกทั้งหมดในหมวด**: adds full quantities matching the current category and search, skipping locked items. Selection does not sell immediately. The existing review/confirm step and clear action remain. Items locked after selection are removed from the basket.

PC layout: a wider inventory gives the character/status sheet a compact fixed column and the bag the remaining space. The bag grid scrolls independently from filters, capacity and selected-item actions. Sparse bags display a short set of empty decorative cells rather than 500 empty buttons. The shop separates the scrolling item list and basket from the totals and confirmation button.

## Changed files

- `src/character/inventoryCapacity.js`, `Character.js`: shared capacity and lossless migration.
- `server/progress.js`, `server/index.js`: reconciliation and network message budget.
- `src/character/ui/CharacterUI.js`, `inventory-workspace.css`: large-bag presentation and PC proportions.
- `src/ui/ShopPanel.js`, `shop.css`, `src/shop/SaleBasket.js`: filtered bulk selection and locked-item protection.
- Focused capacity, real WebSocket, basket and trade tests; browser QA script and screenshots in this directory.

## Validation

See `verification.json` for browser checks and screenshot dimensions. Focused tests exercise 500-item sales over a real WebSocket, reload persistence, legacy migration, metadata, inventory/trade capacity and basket locking. Production build passed (existing large-bundle advisory). Full suite: 999 passed, 2 skipped, 0 failed. Focused tests: 68 passed. Browser: 21 scenario checks passed at 1366×768, 1920×1080 and 390×844, no browser errors.

## Limits

500 slots do not increase weight allowance or item stack limits. Explicit saved recovery inventories larger than 500 are preserved. This work does not change stash capacity or the rest of the gameplay HUD. Browser fixtures use test items and never sell live-account items.
