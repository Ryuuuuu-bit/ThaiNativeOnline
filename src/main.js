import { Game } from './core/Game.js';
import { enterGame } from './account/index.js';
import { Sound } from './audio/Sound.js';
import { bindUiSounds } from './audio/gameSounds.js';
import { MUSIC_FOR } from './data/audio.js';
import './style.css';
import './ui/theme.css';   // the shared look for every in-game box (loaded last)
import './ui/layout.css';  // the design's window layouts, shared by both skins
import './ui/skin-classic.css';   // carved-wood skin, on when body.skin-classic (src/ui/skin.js)

// Login → character select → creation (src/account), then the world.
document.body.classList.add('acc-flow');
bindUiSounds();
Sound.music(MUSIC_FOR.entry); // starts with the first click or key press (browser autoplay rules)
await enterGame(document.getElementById('app'));
document.body.classList.remove('acc-flow');
new Game().start();
