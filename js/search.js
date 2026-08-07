import { normalizeText } from './utils.js';

export function setupGlobalSearch(dataSources) {
  const searchInput = document.getElementById('globalSearch');
  if (!searchInput) return;

  const resultContainer = document.getElementById('searchResults') || createSearchResultsContainer();
  if (!resultContainer) return;

  const hideResults = () => {
    resultContainer.classList.add('hidden');
  };

  const showResults = () => {
    resultContainer.classList.remove('hidden');
  };

  const renderResults = () => {
    const query = normalizeText(searchInput.value);
    resultContainer.innerHTML = '';
    resultContainer.classList.add('hidden');

    if (!query) return;

    const results = [];
    dataSources.forEach((source) => {
      source.items.forEach((item) => {
        const fields = source.fields.map((field) => normalizeText(item[field] || ''));
        if (fields.some((value) => value.includes(query))) {
          results.push({
            type: source.type,
            title: source.titleExtractor(item),
            subtitle: source.subtitleExtractor(item),
            link: source.link(item),
          });
        }
      });
    });

    if (results.length === 0) {
      resultContainer.innerHTML = '<div class="empty-state"><p>No results found.</p></div>';
      showResults();
      return;
    }

    results.slice(0, 10).forEach((result) => {
      const card = document.createElement('a');
      card.href = result.link;
      card.className = 'search-results-card';
      card.innerHTML = `<strong>${result.title}</strong><p>${result.subtitle}</p><span>${result.type}</span>`;
      resultContainer.appendChild(card);
    });

    showResults();
  };

  searchInput.addEventListener('input', renderResults);

  document.addEventListener('click', (event) => {
    if (!resultContainer.contains(event.target) && event.target !== searchInput) {
      hideResults();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hideResults();
    }
  });
}

function createSearchResultsContainer() {
  const container = document.createElement('section');
  container.id = 'searchResults';
  container.className = 'search-results-panel hidden';
  document.body.appendChild(container);
  return container;
}
