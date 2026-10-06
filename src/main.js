import { Game } from './core/Game.js';
import { enterGame } from './account/index.js';
import { Sound } from './audio/Sound.js';
import { bindUiSounds } from './audio/gameSounds.js';
import { MUSIC_FOR } from './data/audio.js';
import './style.css';

// Login → character select → creation (src/account), then the world.
document.body.classList.add('acc-flow');
bindUiSounds();
Sound.music(MUSIC_FOR.entry); // starts with the first click or key press (browser autoplay rules)
await enterGame(document.getElementById('app'));
document.body.classList.remove('acc-flow');
new Game().start();
