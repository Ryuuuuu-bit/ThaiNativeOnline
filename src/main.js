import { Game } from './core/Game.js';
import { enterGame } from './account/index.js';
import './style.css';

// Login → character select → creation (src/account), then the world.
document.body.classList.add('acc-flow');
await enterGame(document.getElementById('app'));
document.body.classList.remove('acc-flow');
new Game().start();
