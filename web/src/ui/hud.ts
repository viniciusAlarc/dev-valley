import { onWorld, type World } from '../api';

const DAYS = ['Dom.', 'Seg.', 'Ter.', 'Qua.', 'Qui.', 'Sex.', 'Sáb.'];

export function mountHud() {
  const hud = document.getElementById('hud')!;
  hud.innerHTML = `
    <div class="hud-title">Dev Valley</div>
    <div class="hud-clock">
      <div class="hud-date"></div>
      <div class="hud-time"></div>
      <div class="hud-stats"></div>
    </div>
    <div class="hud-help">Arraste ou WASD para andar · roda do mouse para zoom · clique em pessoas, casas e caixas</div>`;
  const date = hud.querySelector('.hud-date')!;
  const time = hud.querySelector('.hud-time')!;
  const stats = hud.querySelector('.hud-stats')!;

  const tick = () => {
    const now = new Date();
    date.textContent = `${DAYS[now.getDay()]} ${now.getDate()}`;
    time.textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };
  tick();
  setInterval(tick, 10_000);

  onWorld((w: World) => {
    const live = w.sessions.filter((s) => s.live).length;
    const changes = w.projects.reduce((n, p) => n + p.changes.length, 0);
    stats.innerHTML = `
      <span title="Projetos">🏠 ${w.projects.length}</span>
      <span title="Sessões trabalhando agora">🧑‍🌾 ${live}/${w.sessions.length}</span>
      <span title="Mudanças sem commit">📦 ${changes}</span>`;
  });
}
