import { normalizeText, escapeHtml, getQueryParam } from './utils.js';

const MAX_RESULTS = 12;

export function setupGlobalSearch(dataSources) {
  const searchInput = document.getElementById('globalSearch');
  if (!searchInput) return;

  const searchWidget = searchInput.closest('.search-widget');
  const clearButton = searchWidget ? searchWidget.querySelector('.search-clear') : null;
  const searchButton = searchWidget ? searchWidget.querySelector('.search-btn, button[aria-label="Search"]') : null;

  const resultContainer = document.getElementById('searchResults') || createSearchResultsContainer();
  if (!resultContainer) return;

  let activeIndex = -1;
  let currentResults = [];
  let debounceTimer = null;

  /* ------------------------- rendering ------------------------- */

  const hideResults = () => {
    resultContainer.classList.add('hidden');
    activeIndex = -1;
  };

  const showResults = () => {
    resultContainer.classList.remove('hidden');
  };

  const toggleClear = () => {
    if (clearButton) clearButton.hidden = !searchInput.value.trim();
  };

  function highlight(value, tokens) {
    const escaped = escapeHtml(value);
    if (!tokens.length) return escaped;
    const pattern = new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'gi');
    return escaped.replace(pattern, '<mark>$1</mark>');
  }

  function buildResults(query) {
    const tokens = query.split(/\s+/).filter(Boolean);
    const results = [];

    dataSources.forEach((source) => {
      source.items.forEach((item) => {
        const title = normalizeText(source.titleExtractor(item));
        const fields = source.fields.map((field) => item[field]);
        const fieldText = flattenFields(fields);
        const score = scoreItem(title, fieldText, tokens);
        if (score > 0) {
          results.push({
            type: source.type,
            title: source.titleExtractor(item),
            subtitle: source.subtitleExtractor(item),
            link: source.link(item),
            score,
          });
        }
      });
    });

    results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
    return results;
  }

  const renderResults = () => {
    const query = normalizeText(searchInput.value);
    resultContainer.innerHTML = '';
    hideResults();

    if (!query) return;

    currentResults = buildResults(query);
    if (currentResults.length === 0) {
      resultContainer.innerHTML = '<div class="empty-state"><p>No results found for that search. Try a building name, room, subject, or keyword.</p></div>';
      showResults();
      return;
    }

    const tokens = query.split(/\s+/);
    const shown = currentResults.slice(0, MAX_RESULTS);
    const meta = document.createElement('div');
    meta.className = 'search-results-meta';
    meta.textContent = `${currentResults.length} result${currentResults.length === 1 ? '' : 's'} for "${searchInput.value.trim()}"`;
    resultContainer.appendChild(meta);

    shown.forEach((result, index) => {
      const card = document.createElement('a');
      card.href = result.link;
      card.className = 'search-results-card';
      card.innerHTML = `<strong class="search-result-title">${highlight(result.title, tokens)}</strong><p>${highlight(result.subtitle || '', tokens)}</p><span>${result.type}</span>`;
      card.addEventListener('mouseenter', () => setActive(index));
      resultContainer.appendChild(card);
    });

    if (currentResults.length > MAX_RESULTS) {
      const more = document.createElement('div');
      more.className = 'search-results-more';
      more.textContent = `+${currentResults.length - MAX_RESULTS} more results — refine your search`;
      resultContainer.appendChild(more);
    }

    showResults();
    setActive(0);
  };

  const setActive = (index) => {
    const cards = resultContainer.querySelectorAll('.search-results-card');
    if (cards.length === 0) return;
    activeIndex = (index + cards.length) % cards.length;
    cards.forEach((card, i) => card.classList.toggle('is-active', i === activeIndex));
    cards[activeIndex].scrollIntoView({ block: 'nearest' });
  };

  const openActive = () => {
    const cards = resultContainer.querySelectorAll('.search-results-card');
    if (cards.length === 0) return;
    const target = activeIndex >= 0 ? cards[activeIndex] : cards[0];
    window.location.href = target.href;
  };

  /* ------------------------- widget wiring ------------------------- */

  searchInput.addEventListener('input', () => {
    toggleClear();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(renderResults, 120);
  });

  searchInput.addEventListener('focus', () => {
    if (window.innerWidth > 980) searchWidget?.classList.add('focus-expand');
    if (searchInput.value.trim()) renderResults();
  });

  searchInput.addEventListener('blur', () => {
    if (window.innerWidth > 980 && !searchInput.value) searchWidget?.classList.remove('focus-expand');
  });

  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hideResults();
      searchInput.blur();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (resultContainer.classList.contains('hidden') || activeIndex < 0) renderResults();
      if (currentResults.length) openActive();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (resultContainer.classList.contains('hidden')) renderResults();
      else setActive(activeIndex + 1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(activeIndex - 1);
    }
  });

  if (searchButton) {
    searchButton.addEventListener('click', (event) => {
      event.preventDefault();
      searchInput.focus();
      if (searchInput.value.trim()) renderResults();
    });
  }

  if (clearButton) {
    clearButton.addEventListener('click', (event) => {
      event.preventDefault();
      searchInput.value = '';
      toggleClear();
      hideResults();
      searchInput.focus();
    });
  }

  document.addEventListener('click', (event) => {
    if (!resultContainer.contains(event.target) && event.target !== searchInput && !searchWidget?.contains(event.target)) {
      hideResults();
    }
  });

  toggleClear();

  /* ------------------------- deep link (?q=) support ------------------------- */

  const deepQuery = getQueryParam('q');
  if (deepQuery) {
    searchInput.value = deepQuery;
    toggleClear();
    renderResults();
  }
}

/* ------------------------- helpers ------------------------- */

function scoreItem(title, fieldText, tokens) {
  if (!tokens.length) return 0;

  const phrase = tokens.join(' ');
  let score = 0;

  for (const token of tokens) {
    if (title.includes(token)) score += 45;
    else if (fieldText.includes(token)) score += 30;
    else return 0;
  }

  if (title === phrase) score += 60;
  else if (title.startsWith(phrase)) score += 30;
  else if (title.includes(phrase)) score += 15;
  else if (fieldText.includes(phrase)) score += 10;

  return score;
}

function flattenFields(fields) {
  const values = [];
  fields.forEach((field) => {
    if (Array.isArray(field)) field.forEach((entry) => values.push(normalizeText(entry)));
    else values.push(normalizeText(field || ''));
  });
  return values.join(' ');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createSearchResultsContainer() {
  const container = document.createElement('section');
  container.id = 'searchResults';
  container.className = 'search-results-panel hidden';
  document.body.appendChild(container);
  return container;
}
