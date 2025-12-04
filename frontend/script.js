// ...existing code...
/*
  Updated script.js
  - Safe DOM queries (guards if elements missing)
  - Smooth scrolling for top nav links
  - Robust event binding for extraction UI
  - Clear comments and small UX improvements
*/

const API_ENDPOINT = 'http://localhost:8000/predict';
const MAX_CHARACTERS = 5000;

const SAMPLE_TEXT = `Apple Inc. announced record quarterly earnings of $89.5 billion on January 15, 2025.
CEO Tim Cook stated that the company plans to invest $50 million in AI research.
The stock price rose by 12% following the announcement. Goldman Sachs maintained
its Buy rating with a target price of $250.`;

const ENTITY_COLORS = {
  'ORG': 'entity-type-org',
  'PERSON': 'entity-type-person',
  'MONEY': 'entity-type-money',
  'DATE': 'entity-type-date',
  'LOCATION': 'entity-type-location',
  'GPE': 'entity-type-location',
  'PRODUCT': 'entity-type-org'
};

// ----- DOM ELEMENTS (guarded) -----
const extractionForm = document.getElementById('extractionForm');
const textInput = document.getElementById('textInput');
const charCount = document.getElementById('charCount');
const clearBtn = document.getElementById('clearBtn');
const sampleBtn = document.getElementById('sampleBtn');

const loadingState = document.getElementById('loadingState');
const emptyState = document.getElementById('emptyState');
const resultsContent = document.getElementById('resultsContent');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const retryBtn = document.getElementById('retryBtn');

const entitiesDisplay = document.getElementById('entitiesDisplay');
const entityCount = document.getElementById('entityCount');
const totalEntities = document.getElementById('totalEntities');

const filterBtns = document.querySelectorAll('.filter-btn');
const navLinks = document.querySelectorAll('.nav-link');

let currentEntities = [];
let currentFilter = 'all';

// ----- Helper: safe addEventListener -----
function safeListen(el, event, fn) {
  if (!el) return;
  el.addEventListener(event, fn);
}

// ----- Form submission: send to backend -----
if (extractionForm) {
  extractionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputText = (textInput?.value || '').trim();
    if (!inputText) return showError('Please enter some text to extract entities from.');
    await extractEntities(inputText);
  });
}

// ----- Character counter -----
if (textInput && charCount) {
  textInput.addEventListener('input', () => {
    const len = textInput.value.length;
    charCount.textContent = len;
    const counter = charCount.parentElement;
    counter?.classList.remove('warning', 'critical');
    if (len > MAX_CHARACTERS * 0.9) counter?.classList.add('critical');
    else if (len > MAX_CHARACTERS * 0.7) counter?.classList.add('warning');
  });
}

// ----- Clear and sample buttons -----
safeListen(clearBtn, 'click', () => {
  extractionForm?.reset();
  if (charCount) charCount.textContent = '0';
  clearResults();
  textInput?.focus();
});

safeListen(sampleBtn, 'click', () => {
  if (textInput) {
    textInput.value = SAMPLE_TEXT;
    charCount && (charCount.textContent = SAMPLE_TEXT.length);
    textInput.focus();
  }
});

// ----- Filters ----- (bind only existing buttons)
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter || 'all';
    displayEntities(currentEntities);
  });
});

// Retry button
safeListen(retryBtn, 'click', () => {
  const text = (textInput?.value || '').trim();
  if (text) extractEntities(text);
});

// ----- Smooth nav scroll -----
navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const href = link.getAttribute('href');
    if (!href || !href.startsWith('#')) return;
    const target = document.querySelector(href);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    navLinks.forEach(l => l.classList.remove('active'));
    link.classList.add('active');
  });
});

// ----- API interaction -----
async function extractEntities(text) {
  clearResults();
  showLoading();
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(errBody || `HTTP ${res.status}`);
    }
    const data = await res.json();
    processAndDisplayEntities(data);
  } catch (err) {
    showError(String(err.message || err));
  }
}

// ----- Response processing -----
function processAndDisplayEntities(data) {
  hideLoading();
  let entities = [];
  if (Array.isArray(data.entities)) entities = data.entities;
  else if (Array.isArray(data.predictions)) entities = data.predictions;
  else if (Array.isArray(data.ents)) entities = data.ents;
  else if (Array.isArray(data)) entities = data;

  if (!entities.length) return showEmpty('No entities found in the provided text.');

  entities.sort((a, b) => (a.start || 0) - (b.start || 0));
  currentEntities = entities;
  // reset filter UI if present
  filterBtns.forEach(b => b.classList.remove('active'));
  filterBtns[0]?.classList.add('active');
  currentFilter = 'all';
  displayEntities(entities);
}

function displayEntities(entities) {
  if (!entitiesDisplay) return;
  let filtered = entities;
  if (currentFilter !== 'all') {
    filtered = entities.filter(e => (e.entity === currentFilter) || (e.label === currentFilter));
  }

  emptyState?.classList.add('hidden');
  resultsContent?.classList.remove('hidden');
  entitiesDisplay.innerHTML = '';

  if (entityCount) entityCount.textContent = String(entities.length || 0);
  if (totalEntities) totalEntities.textContent = String(filtered.length || 0);

  if (!filtered.length) {
    entitiesDisplay.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:#9ca3af;">No entities match the selected filter.</p>`;
    return;
  }

  filtered.forEach((ent) => {
    entitiesDisplay.appendChild(createEntityCard(ent));
  });
}

function createEntityCard(entity) {
  const card = document.createElement('div');
  card.className = 'entity-card';

  const text = entity.text || entity.word || '';
  const type = entity.entity || entity.label || 'UNKNOWN';
  const conf = entity.confidence || entity.score || null;
  const start = entity.start ?? 0;
  const end = entity.end ?? 0;
  const colorClass = ENTITY_COLORS[type] || 'entity-type-default';

  card.innerHTML = `
    <div class="entity-header">
      <span class="entity-type-badge ${colorClass}">${escapeHtml(type)}</span>
    </div>
    <div class="entity-text">${escapeHtml(text)}</div>
    <div class="entity-info">
      <div class="info-item">
        <span class="info-label">Position</span>
        <span class="info-value">${start}-${end}</span>
      </div>
      ${conf ? `
      <div class="info-item">
        <span class="info-label">Confidence</span>
        <span class="info-value">${(conf * 100).toFixed(1)}%</span>
      </div>` : ''}
    </div>`;
  return card;
}

// ----- Utilities -----
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ----- UI State handlers -----
function showLoading() {
  emptyState?.classList.add('hidden');
  resultsContent?.classList.add('hidden');
  errorState?.classList.add('hidden');
  loadingState?.classList.remove('hidden');
}
function hideLoading() { loadingState?.classList.add('hidden'); }

function showError(msg) {
  hideLoading();
  errorState?.classList.remove('hidden');
  resultsContent?.classList.add('hidden');
  emptyState?.classList.add('hidden');

  let display = String(msg || 'An error occurred');
  if (display.includes('Failed') || display.includes('Network')) {
    display = 'Cannot connect to API. Ensure FastAPI is running at http://localhost:8000';
  }
  errorMessage && (errorMessage.textContent = display);
}

function showEmpty(msg) {
  hideLoading();
  emptyState?.classList.remove('hidden');
  resultsContent?.classList.add('hidden');
  errorState?.classList.add('hidden');
  const el = emptyState?.querySelector('.state-message');
  if (el) el.textContent = msg;
}

function clearResults() {
  emptyState?.classList.remove('hidden');
  resultsContent?.classList.add('hidden');
  errorState?.classList.add('hidden');
  loadingState?.classList.add('hidden');
  if (entitiesDisplay) entitiesDisplay.innerHTML = '';
  if (entityCount) entityCount.textContent = '0';
  if (totalEntities) totalEntities.textContent = '0';
}

// ----- Initialization -----
function init() {
  console.log('Financial News Entity Extract Tool Loaded');
  if (textInput) textInput.focus();

  // set active nav based on location hash
  if (location.hash) {
    navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === location.hash));
  }
}

document.addEventListener('DOMContentLoaded', init);
// ...existing code...