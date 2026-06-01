function renderDaySelect(days) {
  els.daySelect.replaceChildren();
  const options = getExpenseDayOptions(days);

  options.forEach((day) => {
    const option = document.createElement("option");
    option.value = day.date;
    option.textContent = day.isPreTrip ? day.label : `${day.label} · ${day.shortDate}`;
    els.daySelect.appendChild(option);
  });

  if (options.length === 0) {
    const option = document.createElement("option");
    option.textContent = "일정 없음";
    option.value = "";
    els.daySelect.appendChild(option);
  }

  const hasSelectedDate = options.some((day) => day.date === state.selectedDate);
  els.daySelect.value = hasSelectedDate ? state.selectedDate : days[0]?.date || PRE_TRIP_EXPENSE_DATE;
  els.daySelect.disabled = options.length === 0;
  syncCustomSelect(els.daySelect, { rebuild: true });
}

function renderTable(entries, days) {
  els.expenseTableBody.replaceChildren();

  entries.forEach((entry) => {
    const day = getExpenseDayMeta(entry.date, days);
    const tr = document.createElement("tr");
    const color = getCategory(entry.category).color;
    tr.innerHTML = `
      <td data-label="구분">${escapeHtml(day.label)}</td>
      <td data-label="날짜">${escapeHtml(day.shortDate)}</td>
      <td data-label="항목"><span class="tag" style="--tag-color:${color}">${escapeHtml(entry.category)}</span></td>
      <td data-label="내용">${escapeHtml(entry.description)}</td>
      <td class="number" data-label="금액">${formatEntryAmountHtml(entry)}</td>
      <td data-label="비고">${entry.note ? escapeHtml(entry.note) : "-"}</td>
      <td class="actions-col" data-label="관리">
        <div class="row-actions">
          <button class="row-action edit" type="button" data-action="edit" data-id="${entry.id}" title="수정">
            <svg viewBox="0 0 24 24" focusable="false"><path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></svg>
          </button>
          <button class="row-action delete" type="button" data-action="delete" data-id="${entry.id}" title="삭제">
            <svg viewBox="0 0 24 24" focusable="false"><path d="M3 6h18M8 6V4h8v2M10 11v6M14 11v6M6 6l1 14h10l1-14" /></svg>
          </button>
        </div>
      </td>
    `;
    els.expenseTableBody.appendChild(tr);
  });

  els.expenseTableBody.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      const entry = findEntry(button.dataset.id);
      if (!entry) return;
      if (button.dataset.action === "edit") startEdit(entry);
      if (button.dataset.action === "delete") deleteEntry(entry.id);
    });
  });

  els.emptyState.hidden = entries.length > 0;
}

window.TripLog.register("features.expenses.table", {
  renderDaySelect,
  renderTable,
});
