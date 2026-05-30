function renderCategorySummary(totals) {
  els.categoryList.replaceChildren();
  renderDonutChart(totals);

  categories.forEach((category) => {
    const amount = totals.byCategory[category.name] || 0;
    const ratio = totals.total ? Math.round((amount / totals.total) * 100) : 0;
    const node = els.categoryRowTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.category = category.name;
    node.style.setProperty("--dot", category.color);
    node.style.setProperty("--bar-width", `${ratio}%`);
    node.classList.toggle("active", activeFilter === category.name);
    node.querySelector(".category-name").textContent = category.name;
    node.querySelector(".category-amount").textContent = formatWon(amount);
    node.querySelector(".category-ratio").textContent = `${ratio}%`;
    node.addEventListener("mouseenter", () => highlightCategory(category.name));
    node.addEventListener("mouseleave", () => highlightCategory(activeFilter === "전체" ? null : activeFilter));
    node.addEventListener("click", () => {
      if (amount > 0) setFilter(activeFilter === category.name ? "전체" : category.name);
    });
    els.categoryList.appendChild(node);
  });

  highlightCategory(activeFilter === "전체" ? null : activeFilter);
}

function renderDonutChart(totals) {
  if (!totals.total) {
    els.categoryDonut.innerHTML = `
      <svg class="donut-svg" viewBox="0 0 160 128" aria-hidden="true" focusable="false">
        <ellipse class="donut-empty-shadow" cx="80" cy="72" rx="58" ry="35"></ellipse>
        <ellipse class="donut-empty-top" cx="80" cy="60" rx="58" ry="35"></ellipse>
        <ellipse class="donut-hole" cx="80" cy="60" rx="30" ry="18"></ellipse>
      </svg>
    `;
    updateChartDetail(null, 0, 0, "가장 많이 쓴 항목");
    return;
  }

  let cursor = -90;
  const gradientDefs = categories
    .map((category, index) => `
      <linearGradient id="donutTopGradient${index}" x1="38%" y1="0%" x2="70%" y2="100%">
        <stop offset="0%" stop-color="${shadeColor(category.color, 38)}"></stop>
        <stop offset="50%" stop-color="${category.color}"></stop>
        <stop offset="100%" stop-color="${shadeColor(category.color, -10)}"></stop>
      </linearGradient>
      <linearGradient id="donutDepthGradient${index}" x1="38%" y1="0%" x2="70%" y2="100%">
        <stop offset="0%" stop-color="${shadeColor(category.color, -14)}"></stop>
        <stop offset="100%" stop-color="${shadeColor(category.color, -36)}"></stop>
      </linearGradient>
    `)
    .join("");
  const slices = categories
    .map((category, index) => {
      const amount = totals.byCategory[category.name] || 0;
      if (!amount) return "";
      const angle = (amount / totals.total) * 360;
      const start = cursor;
      const end = cursor + Math.max(angle, 0.8);
      cursor += angle;
      const path = describeDonutSlice(80, 54, 58, 29, 32, 16, start, Math.min(end, 269.99));
      const depthPath = describeDonutSlice(80, 63, 58, 29, 32, 16, start, Math.min(end, 269.99));
      const hitPath = describePieSlice(80, 54, 64, 35, start, Math.min(end, 269.99));
      const ratio = Math.round((amount / totals.total) * 100);
      return `
        <g class="donut-slice${activeFilter === category.name ? " active" : ""}"
           data-category="${category.name}"
           data-amount="${amount}"
           data-ratio="${ratio}"
           tabindex="0"
           role="button"
           aria-label="${category.name} ${formatWon(amount)} ${ratio}%">
          <path class="donut-depth" d="${depthPath}" fill="url(#donutDepthGradient${index})"></path>
          <path class="donut-top" d="${path}" fill="url(#donutTopGradient${index})"></path>
          <path class="donut-gloss" d="${path}"></path>
          <path class="donut-hit" d="${hitPath}"></path>
        </g>
      `;
    })
    .join("");

  els.categoryDonut.innerHTML = `
    <svg class="donut-svg" viewBox="0 0 160 128" aria-hidden="false" focusable="false">
      <defs>
        ${gradientDefs}
        <radialGradient id="donutFloorGradient" cx="50%" cy="44%" r="64%">
          <stop offset="0%" stop-color="#0f172a" stop-opacity="0.18"></stop>
          <stop offset="62%" stop-color="#0f172a" stop-opacity="0.10"></stop>
          <stop offset="100%" stop-color="#0f172a" stop-opacity="0"></stop>
        </radialGradient>
        <linearGradient id="donutHoleSurface" x1="35%" y1="0%" x2="65%" y2="100%">
          <stop offset="0%" stop-color="#ffffff"></stop>
          <stop offset="100%" stop-color="#edf4f8"></stop>
        </linearGradient>
        <linearGradient id="donutInnerWall" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stop-color="#f8fafc"></stop>
          <stop offset="100%" stop-color="#cbd5e1"></stop>
        </linearGradient>
      </defs>
      <ellipse class="donut-base-shadow" cx="82" cy="75" rx="56" ry="23" fill="url(#donutFloorGradient)"></ellipse>
      <ellipse class="donut-soft-rim" cx="80" cy="63" rx="59" ry="29"></ellipse>
      ${slices}
      <ellipse class="donut-inner-wall" cx="80" cy="63" rx="33" ry="17"></ellipse>
      <ellipse class="donut-hole-shadow" cx="80" cy="62" rx="31" ry="16"></ellipse>
      <ellipse class="donut-hole" cx="80" cy="54" rx="29" ry="14" fill="url(#donutHoleSurface)"></ellipse>
      <ellipse class="donut-hole-glow" cx="80" cy="50" rx="20" ry="7"></ellipse>
      <ellipse class="donut-rim-light" cx="80" cy="54" rx="58" ry="29"></ellipse>
    </svg>
  `;

  els.categoryDonut.querySelectorAll(".donut-slice").forEach((slice) => {
    const category = slice.dataset.category;
    const selectSlice = (event) => {
      event.stopPropagation();
      setFilter(activeFilter === category ? "전체" : category);
    };
    slice.addEventListener("mouseenter", () => highlightCategory(category));
    slice.addEventListener("focus", () => highlightCategory(category));
    slice.addEventListener("mouseleave", () => highlightCategory(activeFilter === "전체" ? null : activeFilter));
    slice.addEventListener("blur", () => highlightCategory(activeFilter === "전체" ? null : activeFilter));
    slice.addEventListener("click", selectSlice);
    slice.querySelectorAll("path").forEach((path) => path.addEventListener("click", selectSlice));
    slice.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setFilter(activeFilter === category ? "전체" : category);
      }
    });
  });

  if (!totals.total) {
    return;
  }
}

function highlightCategory(categoryName) {
  const totals = calculateTotals();
  const category = categoryName ? getCategory(categoryName) : totals.topCategory;
  const amount = category ? totals.byCategory[category.name] || 0 : 0;
  const ratio = totals.total && amount ? Math.round((amount / totals.total) * 100) : 0;
  const label = categoryName ? "선택한 항목" : "가장 많이 쓴 항목";

  els.categoryDonut.querySelectorAll(".donut-slice").forEach((slice) => {
    slice.classList.toggle("is-hovered", slice.dataset.category === category?.name);
    slice.classList.toggle("is-muted", Boolean(category?.name) && slice.dataset.category !== category.name);
    slice.classList.toggle("active", activeFilter === slice.dataset.category);
  });
  els.categoryList.querySelectorAll(".category-row").forEach((row) => {
    row.classList.toggle("is-hovered", row.dataset.category === category?.name);
    row.classList.toggle("active", activeFilter === row.dataset.category);
  });

  updateChartDetail(category, amount, ratio, label);
}

function updateChartDetail(category, amount, ratio, label) {
  els.chartCaption.textContent = label;
  els.dominantCategory.textContent = category ? category.name : "-";
  els.chartAmount.textContent = category && amount ? `${formatWon(amount)} · ${ratio}%` : "0원";
}

function categoryFromDonutPointer(event) {
  const totals = calculateTotals();
  if (!totals.total) return null;

  const rect = els.categoryDonut.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 160;
  const y = ((event.clientY - rect.top) / rect.height) * 128;
  const dx = x - 80;
  const dy = y - 54;
  const outer = (dx / 64) ** 2 + (dy / 35) ** 2;
  const inner = (dx / 29) ** 2 + (dy / 14) ** 2;
  if (outer > 1.15 || inner < 1) return null;

  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angle < -90) angle += 360;
  const progress = angle + 90;

  let cursor = 0;
  for (const category of categories) {
    const amount = totals.byCategory[category.name] || 0;
    if (!amount) continue;
    const next = cursor + (amount / totals.total) * 360;
    if (progress >= cursor && progress <= next) return category.name;
    cursor = next;
  }

  return categories.find((category) => totals.byCategory[category.name])?.name || null;
}

window.TripLog.register("features.reports.categorySummary", {
  renderCategorySummary,
  renderDonutChart,
  highlightCategory,
  updateChartDetail,
  categoryFromDonutPointer,
});
