import { createStore } from './store.js';

const store = createStore();
const TABS = ['today', 'log', 'guide'];

export function activateTab(name) {
  const target = TABS.includes(name) ? name : 'today';
  for (const t of TABS) {
    document.getElementById(`tab-${t}`).classList.toggle('hidden', t !== target);
  }
  document.querySelectorAll('.tabbar button').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === target);
  });
  store.set('lastTab', target);
}

document.querySelectorAll('.tabbar button').forEach((b) => {
  b.addEventListener('click', () => activateTab(b.dataset.tab));
});

activateTab(store.get('lastTab', 'today'));

window.__rr = { store };
