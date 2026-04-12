const cardlist = document.getElementById('cardlist');
const fetchBtn = document.getElementById('fetchBtn');
const downloadBtn = document.getElementById('downloadBtn');
const oldBorderBtn = document.getElementById('oldBorderBtn');
const clearBtn = document.getElementById('clearBtn');
const copyDeckBtn = document.getElementById('copyDeckBtn');
const grid = document.getElementById('grid');
const fetchErrorsEl = document.getElementById('fetchErrors');
const status = document.getElementById('status');
const modal = document.getElementById('modal');
const modalClose = document.getElementById('modalClose');
const modalSub = document.getElementById('modalSub');
const variantGrid = document.getElementById('variantGrid');
const oldBorderConfirm = document.getElementById('oldBorderConfirm');
const oldBorderConfirmCancel = document.getElementById('oldBorderConfirmCancel');
const oldBorderConfirmOk = document.getElementById('oldBorderConfirmOk');
const removeConfirm = document.getElementById('removeConfirm');
const removeConfirmCancel = document.getElementById('removeConfirmCancel');
const removeConfirmOk = document.getElementById('removeConfirmOk');
const removeConfirmSub = document.getElementById('removeConfirmSub');

let cards = [];
let removeConfirmIdx = null;
let activeIdx = null;

let statusDotsTimer = null;
let switchingDotsFrame = 0;
const oldBorderStatusProgress = { i: 0, total: 0 };
const OLD_BORDER_LINK_LABEL = 'Switch to old card frames';
const COPY_DECK_LABEL = 'Copy deck list';
const CLEAR_LABEL = 'Clear';
const CLEAR_CONFIRM_LABEL = 'Are you sure?';

let copyDeckFeedbackTimer = null;
let clearConfirmTimer = null;

function stopStatusDots() {
if (statusDotsTimer != null) {
  clearInterval(statusDotsTimer);
  statusDotsTimer = null;
}
oldBorderStatusProgress.total = 0;
status.classList.remove('busy');
oldBorderBtn.textContent = OLD_BORDER_LINK_LABEL;
}

function tickSwitchingStatus() {
const d = ['', '.', '..', '...'][switchingDotsFrame % 4];
const { i, total } = oldBorderStatusProgress;
const progress = total ? ` (${i + 1} / ${total})` : '';
status.textContent = `Switching${d}${progress}`;
status.classList.remove('error');
status.classList.add('busy');
switchingDotsFrame++;
}

function startSwitchingStatus(total) {
stopStatusDots();
oldBorderStatusProgress.total = total;
oldBorderStatusProgress.i = 0;
switchingDotsFrame = 0;
oldBorderBtn.textContent = 'Switching…';
tickSwitchingStatus();
statusDotsTimer = setInterval(tickSwitchingStatus, 420);
}

const SCRYFALL = 'https://api.scryfall.com';

function parseLine(raw) {
  let line = raw.trim();
  if (!line || line.startsWith('//')) return null;
  let lineSuffix = '';
  const hashTail = line.match(/^(.*?)(\s*(?:#[\w-]+(?:\s+#[\w-]+)*))\s*$/);
  if (hashTail) {
    line = hashTail[1].trim();
    const tail = hashTail[2].trim();
    if (tail) lineSuffix = ' ' + tail;
  }
  line = line.replace(/\*[A-Z]\*/g, '').trim();
  if (!line) return null;
  const m = line.match(/^(?:(\d+)x?\s+)?(.+?)(?:\s+\(([A-Za-z0-9]+)\)(?:\s+(\S+))?)?\s*$/);
  if (!m) return null;
  const qty = parseInt(m[1] || '1', 10);
  let name = m[2].trim();
  name = name.replace(/\s+\/\s+/g, ' // ');
  const set = m[3] ? m[3].toLowerCase() : null;
  const number = m[4] ? m[4].trim() : null;
  if (!name) return null;
  return { qty, name, set, number, lineSuffix };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function scryfallLookup(name, set, number) {
  if (set && number) {
    const res = await fetch(`${SCRYFALL}/cards/${set}/${encodeURIComponent(number)}`);
    if (res.ok) return { card: await res.json(), fuzzyGuess: false };
  }
  const params = new URLSearchParams({ exact: name });
  if (set) params.set('set', set);
  const res = await fetch(`${SCRYFALL}/cards/named?${params}`);
  if (!res.ok) {
    if (res.status === 404) {
      const fuzzyRes = await fetch(`${SCRYFALL}/cards/named?fuzzy=${encodeURIComponent(name)}`);
      if (fuzzyRes.ok) return { card: await fuzzyRes.json(), fuzzyGuess: true };
      throw new Error(`Not found: ${name}`);
    }
    throw new Error(`API error: ${res.status}`);
  }
  return { card: await res.json(), fuzzyGuess: false };
}

async function scryfallPrints(card) {
const url = `${SCRYFALL}/cards/search?order=released&unique=prints&q=oracleid%3A${card.oracle_id}`;
const res = await fetch(url);
if (!res.ok) throw new Error('Could not fetch printings');
const data = await res.json();
let all = data.data || [];
let next = data.next_page;
while (next) {
  await sleep(100);
  const r = await fetch(next);
  if (!r.ok) break;
  const d = await r.json();
  all = all.concat(d.data || []);
  next = d.next_page;
}
return all;
}

function getImageUrl(card, size = 'png') {
if (card.image_uris) return card.image_uris[size] || card.image_uris.large;
if (card.card_faces && card.card_faces[0].image_uris) {
  return card.card_faces[0].image_uris[size] || card.card_faces[0].image_uris.large;
}
return null;
}

function variantTags(card) {
const tags = [];
if (card.frame_effects) tags.push(...card.frame_effects);
if (card.border_color && card.border_color !== 'black') tags.push(card.border_color + ' border');
if (card.full_art) tags.push('full art');
if (card.textless) tags.push('textless');
if (card.promo) tags.push('promo');
if (card.finishes && card.finishes.includes('etched')) tags.push('etched');
return tags;
}

function appendFetchAlertSection(container, headingText, items, lineForItem) {
  const section = document.createElement('div');
  section.className = 'fetch-errors-section';
  const heading = document.createElement('div');
  heading.className = 'fetch-errors-heading';
  heading.textContent = headingText;
  const ul = document.createElement('ul');
  ul.className = 'fetch-errors-list';
  items.forEach(c => {
    const li = document.createElement('li');
    li.textContent = lineForItem(c);
    ul.appendChild(li);
  });
  section.append(heading, ul);
  container.appendChild(section);
}

function render() {
  const failed = cards.filter(c => c.error);
  const guessed = cards.filter(c => c.card && c.fuzzyGuess);
  if (failed.length || guessed.length) {
    fetchErrorsEl.hidden = false;
    fetchErrorsEl.replaceChildren();
    if (failed.length) {
      appendFetchAlertSection(
        fetchErrorsEl,
        'Could not load:',
        failed,
        c => `${c.qty > 1 ? `${c.qty}× ` : ''}${c.name}`,
      );
    }
    if (guessed.length) {
      appendFetchAlertSection(
        fetchErrorsEl,
        'The following cards were guessed (no exact Scryfall match) and might be incorrect:',
        guessed,
        c => {
          const q = `${c.qty > 1 ? `${c.qty}× ` : ''}${c.name}`;
          return `${q} → ${c.card.name}`;
        },
      );
    }
  } else {
    fetchErrorsEl.hidden = true;
    fetchErrorsEl.replaceChildren();
  }

  grid.innerHTML = '';
  cards.forEach((c, i) => {
    if (c.error) return;

    const item = document.createElement('div');
    item.className = 'card-item';
    if (c.oldBorderGrey) item.classList.add('card-item--old-border-pending');
    const imgWrap = document.createElement('div');
    imgWrap.className = 'card-img-wrap';

    if (!c.card) {
      imgWrap.innerHTML = `<div class="placeholder">Loading…</div>`;
    } else {
      const url = getImageUrl(c.card, 'normal');
      if (url) {
        const img = document.createElement('img');
        img.src = url;
        img.alt = c.card.name;
        img.loading = 'lazy';
        imgWrap.appendChild(img);
        imgWrap.classList.add('card-img-wrap--interactive');
        imgWrap.setAttribute('role', 'button');
        imgWrap.setAttribute('tabindex', '0');
        imgWrap.setAttribute('aria-label', `Change printing: ${c.card.name}`);
        imgWrap.addEventListener('click', () => openModal(i));
        imgWrap.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openModal(i);
          }
        });
      } else {
        imgWrap.innerHTML = `<div class="placeholder">No image</div>`;
      }
    }

    const info = document.createElement('div');
    info.className = 'card-info';
    const name = document.createElement('div');
    name.className = 'card-name';
    name.textContent = (c.qty > 1 ? `${c.qty}× ` : '') + (c.card?.name || c.name);
    const setLine = document.createElement('div');
    setLine.className = 'card-set';
    if (c.card) {
      const tags = variantTags(c.card);
      setLine.textContent = `${c.card.set.toUpperCase()} · ${c.card.set_name}${tags.length ? ' · ' + tags.join(', ') : ''}`;
    } else {
      setLine.textContent = '—';
    }
    info.appendChild(name);
    info.appendChild(setLine);

    const acts = document.createElement('div');
    acts.className = 'card-actions';
    const swapBtn = document.createElement('button');
    swapBtn.type = 'button';
    swapBtn.className = 'change-printing';
    swapBtn.textContent = 'Change printing';
    swapBtn.disabled = !c.card;
    swapBtn.onclick = () => openModal(i);
    const rmBtn = document.createElement('button');
    rmBtn.type = 'button';
    rmBtn.textContent = 'Remove';
    rmBtn.className = 'text-link remove';
    rmBtn.onclick = () => openRemoveConfirm(i);
    acts.appendChild(swapBtn);
    acts.appendChild(rmBtn);

    item.appendChild(imgWrap);
    item.appendChild(info);
    item.appendChild(acts);
    grid.appendChild(item);
  });
}

function syncTextarea() {
  const lines = cards.map(c => {
    let core;
    if (!c.card) {
      core = `${c.qty > 1 ? c.qty + ' ' : '1 '}${c.name}`;
    } else {
      core = `${c.qty} ${c.card.name} (${c.card.set.toUpperCase()}) ${c.card.collector_number}`;
    }
    return core + (c.lineSuffix || '');
  });
  cardlist.value = lines.join('\n');
  updateDeckTextActions();
}

function updateDeckTextActions() {
  const hasText = !!cardlist.value.trim();
  clearBtn.hidden = !hasText;
  copyDeckBtn.hidden = !hasText;
  if (!hasText) {
    if (copyDeckFeedbackTimer) {
      clearTimeout(copyDeckFeedbackTimer);
      copyDeckFeedbackTimer = null;
    }
    copyDeckBtn.textContent = COPY_DECK_LABEL;
    if (clearConfirmTimer) {
      clearTimeout(clearConfirmTimer);
      clearConfirmTimer = null;
    }
    clearBtn.textContent = CLEAR_LABEL;
  }
}

async function copyDeckList() {
  if (copyDeckFeedbackTimer) {
    clearTimeout(copyDeckFeedbackTimer);
    copyDeckFeedbackTimer = null;
  }
  const text = cardlist.value;
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    cardlist.focus();
    cardlist.select();
    try {
      document.execCommand('copy');
    } catch (e2) { /* ignore */ }
  }
  copyDeckBtn.textContent = 'Copied!';
  copyDeckFeedbackTimer = setTimeout(() => {
    copyDeckBtn.textContent = COPY_DECK_LABEL;
    copyDeckFeedbackTimer = null;
  }, 1000);
}

function updateDownloadBtn() {
const hasCards = cards.some(c => c.card);
downloadBtn.disabled = !hasCards;
oldBorderBtn.disabled = !hasCards;
}

async function fetchCards() {
const lines = cardlist.value.split('\n').map(parseLine).filter(Boolean);
if (!lines.length) { setStatus('Paste at least one card', true); return; }

fetchBtn.disabled = true;
const fetchTotal = lines.length;

cards = lines.map((l, i) => ({
  id: i,
  name: l.name,
  qty: l.qty,
  set: l.set,
  number: l.number,
  lineSuffix: l.lineSuffix || '',
  card: null,
  variants: null,
  error: null,
  fuzzyGuess: false,
}));
render();

for (let i = 0; i < cards.length; i++) {
  const n = fetchTotal > 1 ? 's' : '';
  status.textContent = `Fetching ${fetchTotal} card${n} (${i + 1} / ${fetchTotal})`;
  status.classList.add('busy');
  status.classList.remove('error');
  try {
    const { card, fuzzyGuess } = await scryfallLookup(cards[i].name, cards[i].set, cards[i].number);
    cards[i].card = card;
    cards[i].fuzzyGuess = fuzzyGuess;
  } catch (e) {
    cards[i].error = e.message;
  }
  render();
  await sleep(100);
}

const ok = cards.filter(c => c.card).length;
const fail = cards.length - ok;
setStatus(`${ok} loaded${fail ? ` · ${fail} failed` : ''}`, fail > 0 && ok === 0);
fetchBtn.disabled = false;
updateDownloadBtn();
syncTextarea();
}

async function switchToOldBorder() {
const targets = cards.filter(c => c.card);
if (!targets.length) return;
oldBorderBtn.disabled = true;
let switched = 0;
startSwitchingStatus(targets.length);
targets.forEach(t => { t.oldBorderGrey = true; });
render();
try {
  for (let i = 0; i < targets.length; i++) {
    oldBorderStatusProgress.i = i;
    const c = targets[i];
    if (!c.variants) {
      try {
        c.variants = await scryfallPrints(c.card);
        await sleep(100);
      } catch (e) {
        c.oldBorderGrey = false;
        render();
        continue;
      }
    }
    // Prefer 1993 frame, then 1997, else earliest printing
    const sorted = [...c.variants].sort((a, b) => (a.released_at || '').localeCompare(b.released_at || ''));
    const oldFrame = sorted.find(v => v.frame === '1993')
                  || sorted.find(v => v.frame === '1997')
                  || sorted[0];
    if (oldFrame && oldFrame.id !== c.card.id) {
      c.card = oldFrame;
      switched++;
    }
    c.oldBorderGrey = false;
    render();
  }
  setStatus(`Switched ${switched} card${switched === 1 ? '' : 's'} to old card frames`);
  syncTextarea();
} finally {
  stopStatusDots();
  targets.forEach(t => { delete t.oldBorderGrey; });
  oldBorderBtn.disabled = false;
  render();
}
}

async function openModal(idx) {
activeIdx = idx;
const c = cards[idx];
modalSub.textContent = `${c.card.name}, loading printings…`;
variantGrid.innerHTML = '';
modal.classList.add('open');

if (!c.variants) {
  try {
    c.variants = await scryfallPrints(c.card);
  } catch (e) {
    modalSub.textContent = 'Failed to load printings';
    return;
  }
}
modalSub.textContent = `${c.card.name} — ${c.variants.length} printing${c.variants.length > 1 ? 's' : ''}`;
renderVariants();
}

function renderVariants() {
const c = cards[activeIdx];
variantGrid.innerHTML = '';
c.variants.forEach(v => {
  const el = document.createElement('div');
  el.className = 'variant';
  if (v.id === c.card.id) el.classList.add('selected');
  const imgWrap = document.createElement('div');
  imgWrap.className = 'variant-img';
  const url = getImageUrl(v, 'large') || getImageUrl(v, 'normal');
  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.loading = 'lazy';
    img.decoding = 'async';
    imgWrap.appendChild(img);
  }
  const meta = document.createElement('div');
  meta.className = 'variant-meta';
  const tags = variantTags(v);
  const setCode = document.createElement('span');
  setCode.className = 'set-code';
  setCode.textContent = v.set.toUpperCase();
  meta.appendChild(setCode);
  meta.appendChild(document.createTextNode(` ${v.set_name}`));
  if (tags.length) {
    const tagSpan = document.createElement('span');
    tagSpan.className = 'tags';
    tagSpan.textContent = tags.join(', ');
    meta.appendChild(tagSpan);
  }
  el.appendChild(imgWrap);
  el.appendChild(meta);
  el.onclick = () => {
    c.card = v;
    modal.classList.remove('open');
    render();
    syncTextarea();
  };
  variantGrid.appendChild(el);
});
}

modalClose.onclick = () => modal.classList.remove('open');
modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('open'); };

function closeOldBorderConfirm() {
oldBorderConfirm.classList.remove('open');
}

function openOldBorderConfirm() {
if (!cards.some(c => c.card)) return;
oldBorderConfirm.classList.add('open');
oldBorderConfirmOk.focus();
}

oldBorderConfirmCancel.onclick = closeOldBorderConfirm;
oldBorderConfirm.onclick = (e) => { if (e.target === oldBorderConfirm) closeOldBorderConfirm(); };
oldBorderConfirmOk.onclick = async () => {
oldBorderConfirmOk.disabled = true;
oldBorderConfirmCancel.disabled = true;
closeOldBorderConfirm();
await switchToOldBorder();
oldBorderConfirmOk.disabled = false;
oldBorderConfirmCancel.disabled = false;
};

function performClear() {
  cards = [];
  cardlist.value = '';
  render();
  setStatus('');
  updateDownloadBtn();
  updateDeckTextActions();
}

function handleClearClick() {
  if (!cardlist.value.trim()) return;
  if (clearBtn.textContent === CLEAR_CONFIRM_LABEL) {
    if (clearConfirmTimer) {
      clearTimeout(clearConfirmTimer);
      clearConfirmTimer = null;
    }
    clearBtn.textContent = CLEAR_LABEL;
    performClear();
    return;
  }
  clearBtn.textContent = CLEAR_CONFIRM_LABEL;
  if (clearConfirmTimer) clearTimeout(clearConfirmTimer);
  clearConfirmTimer = setTimeout(() => {
    clearConfirmTimer = null;
    if (clearBtn.textContent === CLEAR_CONFIRM_LABEL) clearBtn.textContent = CLEAR_LABEL;
  }, 3000);
}

function closeRemoveConfirm() {
removeConfirm.classList.remove('open');
removeConfirmIdx = null;
}

function openRemoveConfirm(idx) {
const c = cards[idx];
if (!c) return;
removeConfirmIdx = idx;
const name = (c.card && c.card.name) || c.name || 'This card';
removeConfirmSub.textContent = `${name} will be removed from your list.`;
removeConfirm.classList.add('open');
removeConfirmOk.focus();
}

removeConfirmCancel.onclick = closeRemoveConfirm;
removeConfirm.onclick = (e) => { if (e.target === removeConfirm) closeRemoveConfirm(); };
removeConfirmOk.onclick = () => {
const idx = removeConfirmIdx;
if (idx === null) return;
removeConfirmOk.disabled = true;
removeConfirmCancel.disabled = true;
closeRemoveConfirm();
cards.splice(idx, 1);
render();
updateDownloadBtn();
syncTextarea();
removeConfirmOk.disabled = false;
removeConfirmCancel.disabled = false;
};

function sanitize(s) { return s.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, ''); }

async function downloadAll() {
const ready = cards.filter(c => c.card);
if (!ready.length) return;
downloadBtn.disabled = true;
const zip = new JSZip();
let done = 0;

for (const c of ready) {
  setStatus(`Downloading ${++done} / ${ready.length}…`);
  const url = getImageUrl(c.card, 'png');
  if (!url) continue;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const fname = `${sanitize(c.card.name)}_${c.card.set.toUpperCase()}_${c.card.collector_number}.png`;
    zip.file(fname, blob);
  } catch (e) {
    console.warn('Failed:', c.card.name, e);
  }
  await sleep(100);
}

setStatus('Building zip…');
const blob = await zip.generateAsync({ type: 'blob' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `cardfetcher-${Date.now()}.zip`;
a.click();
URL.revokeObjectURL(url);
setStatus(`Downloaded ${done} card${done > 1 ? 's' : ''}`);
downloadBtn.disabled = false;
}

function setStatus(msg, isError = false) {
stopStatusDots();
status.textContent = msg;
status.classList.toggle('error', isError);
}

fetchBtn.onclick = fetchCards;
downloadBtn.onclick = downloadAll;
oldBorderBtn.onclick = openOldBorderConfirm;
cardlist.addEventListener('input', updateDeckTextActions);

clearBtn.onclick = handleClearClick;
copyDeckBtn.onclick = copyDeckList;

updateDeckTextActions();
