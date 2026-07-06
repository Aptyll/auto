import { Game } from './game.js';
import { UI } from './ui.js';
import { botPlan, makePersonality } from './bot.js';

// debug/testing hooks
window.__botPlan = botPlan;
window.__makePersonality = makePersonality;

const startScreen = document.getElementById('startScreen');
document.getElementById('playBtn').addEventListener('click', () => {
  startScreen.classList.add('hide');
  boot();
});

function boot() {
  const game = new Game();
  const ui = new UI(game);
  window.__ui = ui; // debug/testing hook
  ui.r.resize();

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ui.frame(dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
