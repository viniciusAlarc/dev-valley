import { onWorld, type World } from '../api';
import { villagerName } from '../game/names';
import { ui } from './actions';

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

  const toasts = document.createElement('div');
  toasts.className = 'toasts';
  document.body.append(toasts);
  let previous = new Map<string, string>();

  onWorld((w: World) => {
    const live = w.sessions.filter((s) => s.live).length;
    const waiting = w.sessions.filter((s) => s.status === 'permission');
    const changes = w.projects.reduce((n, p) => n + p.changes.length, 0);
    stats.innerHTML = `
      <span title="Projetos">🏠 ${w.projects.length}</span>
      <span title="Sessões ativas / total">🧑‍🌾 ${live}/${w.sessions.length}</span>
      <span title="Mudanças sem commit">📦 ${changes}</span>
      ${waiting.length ? `<span class="hud-alert" title="Sessões pedindo permissão">❗ ${waiting.length}</span>` : ''}`;
    document.title = waiting.length ? `(${waiting.length}) ❗ Dev Valley` : 'Dev Valley';

    // Avisa só na transição para "permissão" — não a cada atualização.
    for (const s of waiting) {
      if (previous.get(s.id) === 'permission') continue;
      const where = w.projects.find((p) => p.id === s.projectId)?.name ?? 'praça';
      toast(toasts, `❗ ${villagerName(s.id)} precisa da sua permissão — ${where}`, () => ui.openSession(s));
    }
    previous = new Map(w.sessions.map((s) => [s.id, s.status ?? '']));
  });
}

function toast(container: HTMLElement, text: string, onClick: () => void) {
  const el = document.createElement('button');
  el.className = 'toast';
  el.textContent = text;
  el.addEventListener('click', () => {
    el.remove();
    onClick();
  });
  container.append(el);
  setTimeout(() => el.remove(), 12_000);
}
