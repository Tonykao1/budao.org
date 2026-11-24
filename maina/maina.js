(async function () {
  const root = document.getElementById('product-list');
  if (!root) return;
  try {
    const response = await fetch('/maina/catalog.json', { cache: 'no-store' });
    if (!response.ok) return;
    const catalog = await response.json();
    if (catalog?.schema_version !== 1 || !Array.isArray(catalog.products)) return;
    const products = catalog.products.filter((product) =>
      product && product.status === 'published' &&
      typeof product.id === 'string' && /^[a-z0-9-]{1,64}$/.test(product.id) &&
      typeof product.name === 'string' && product.name.trim() &&
      typeof product.description === 'string' &&
      typeof product.price_display === 'string'
    );
    if (!products.length) return;
    const nodes = products.map((product) => {
      const card = document.createElement('article');
      card.className = 'product-card';
      if (typeof product.image === 'string' && /^\/maina\/images\/[a-z0-9._-]+\.(?:jpe?g|png|webp)$/i.test(product.image)) {
        const img = document.createElement('img');
        img.className = 'product-image';
        img.src = product.image;
        img.alt = product.name;
        img.loading = 'lazy';
        card.appendChild(img);
      }
      const body = document.createElement('div');
      body.className = 'product-body';
      const heading = document.createElement('h3');
      heading.textContent = product.name;
      const summary = document.createElement('p');
      summary.textContent = product.description;
      const price = document.createElement('div');
      price.className = 'product-price';
      price.textContent = product.price_display;
      const availability = document.createElement('p');
      availability.className = 'product-availability';
      availability.textContent = '展示中 · 购买功能待正式开通';
      body.append(heading, summary, price, availability);
      card.appendChild(body);
      return card;
    });
    root.replaceChildren(...nodes);
  } catch (_) {
    // The curated storefront intentionally retains its informative empty state.
  }
})();