// Course/unit/word search with filter chips. No dependencies, no build step.
// item shape: { id, title, language: 'de'|'it', level: 'A1'|'A2'|..., status: 'locked'|'active'|'done', keywords?: string[] }

import { t } from '../i18n.js';

export const LANGUAGES = ['de', 'it', 'es'];
export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export const STATUSES = ['active', 'done', 'locked'];

// Case- and accent-insensitive: "Straße" ~ "strasse", "città" ~ "citta", "İstanbul" ~ "istanbul".
export function normalize(text) {
  return String(text ?? '')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .trim();
}

function matchesQuery(item, terms) {
  const haystack = normalize([item.title, ...(item.keywords ?? [])].join(' '));
  return terms.every((term) => haystack.includes(term));
}

// Pure: returns a new array, never mutates `items`. Empty filter value = no restriction.
export function filterItems(items, { query = '', language = '', level = '', status = '' } = {}) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return items.filter(
    (item) =>
      (!language || item.language === language) &&
      (!level || item.level === level) &&
      (!status || item.status === status) &&
      matchesQuery(item, terms),
  );
}

function chipGroup(name, label, options) {
  const buttons = [['', t('filter.all')], ...options]
    .map(([value, text]) => `<button type="button" class="chip" data-group="${name}" data-value="${value}" aria-pressed="${value === ''}">${text}</button>`)
    .join('');
  return `<div class="chips" role="group" aria-label="${label}">${buttons}</div>`;
}

// Renders the controls into `root`; calls onChange(filteredItems, filters) on every change.
// groups: which chip rows to show (e.g. drop 'language' when the page already picks one).
export function mountSearchFilter(root, items, onChange, { groups = ['language', 'level', 'status'] } = {}) {
  let filters = { query: '', language: '', level: '', status: '' };
  const GROUPS = {
    language: () => chipGroup('language', t('filter.language'), LANGUAGES.map((l) => [l, t(`lang.${l}`)])),
    level: () => chipGroup('level', t('filter.level'), LEVELS.map((l) => [l, l])),
    status: () => chipGroup('status', t('filter.status'), STATUSES.map((s) => [s, t(`status.${s}`)])),
  };

  root.innerHTML = `
    <input type="search" class="search" placeholder="${t('filter.search')}" aria-label="${t('filter.searchLabel')}" autocomplete="off">
    ${groups.map((g) => GROUPS[g]()).join('')}
    <p class="result-count" aria-live="polite"></p>`;

  const counter = root.querySelector('.result-count');
  const update = (patch) => {
    filters = { ...filters, ...patch };
    const result = filterItems(items, filters);
    counter.textContent = t('filter.count', { n: result.length });
    onChange(result, filters);
  };

  root.querySelector('.search').addEventListener('input', (e) => update({ query: e.target.value }));
  root.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    root.querySelectorAll(`.chip[data-group="${chip.dataset.group}"]`)
      .forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    update({ [chip.dataset.group]: chip.dataset.value });
  });

  update({});
  return { setItems: (next) => { items = next; update({}); } };
}
