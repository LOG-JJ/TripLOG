function renderDaySelect(days) {
  els.daySelect.replaceChildren();
  const options = getExpenseDayOptions(days);

  options.forEach((day) => {
    const option = document.createElement("option");
    option.value = day.date;
    option.textContent = formatExpenseDayOptionLabel(day);
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

function formatExpenseDayOptionLabel(day) {
  if (day.isPreTrip) return day.label;
  const dayNumber = day.index || String(day.label || "").replace(/[^0-9]/g, "");
  const weekday = day.weekday ? ` [${day.weekday}]` : "";
  return `Day${dayNumber} · ${day.shortDate}${weekday}`;
}

function renderTable(entries, days) {
  els.expenseTableBody.replaceChildren();

  entries.forEach((entry) => {
    const day = getExpenseDayMeta(entry.date, days);
    const tr = document.createElement("tr");
    const color = getCategory(entry.category).color;
    const dayCellText = formatExpenseTableDayCell(day);
    const paymentMethodLabel = getPaymentMethodLabel(entry.paymentMethod);
    tr.className = "expense-record-card";
    tr.style.setProperty("--entry-color", color);
    tr.innerHTML = `
      <td class="expense-date-cell" data-label="일자">
        <span class="expense-day-pill">${escapeHtml(dayCellText)}</span>
      </td>
      <td class="expense-category-cell" data-label="항목">
        <span class="expense-category-chip" style="--tag-color:${color}">
          <span class="expense-category-dot" aria-hidden="true"></span>
          <span>${escapeHtml(entry.category)}</span>
        </span>
      </td>
      <td class="expense-description-cell" data-label="내용">
        <span class="expense-field-label">내용</span>
        <strong class="expense-entry-title">${escapeHtml(entry.description)}</strong>
      </td>
      <td class="number expense-amount-cell" data-label="금액">
        ${paymentMethodLabel ? `
        <div class="expense-amount-meta">
          <span class="expense-payment-method-badge">${escapeHtml(paymentMethodLabel)}</span>
        </div>` : ""}
        <span class="expense-entry-amount">${formatEntryAmountHtml(entry)}</span>
      </td>
      <td class="expense-note-cell${entry.note ? "" : " is-empty"}" data-label="비고">
        <span class="expense-field-label">비고</span>
        <span class="expense-entry-note">${entry.note ? escapeHtml(entry.note) : "비고 없음"}</span>
      </td>
      <td class="actions-col expense-row-actions-cell">
        <div class="row-actions">
          <button class="row-action edit" type="button" data-action="edit" data-id="${entry.id}" title="수정" aria-label="지출 기록 수정">
            <svg viewBox="0 0 24 24" focusable="false"><path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></svg>
          </button>
          <button class="row-action delete" type="button" data-action="delete" data-id="${entry.id}" title="삭제" aria-label="지출 기록 삭제">
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

function formatExpenseTableDayCell(day) {
  if (day.isPreTrip) return day.label;
  const dayNumber = day.index || String(day.label || "").replace(/[^0-9]/g, "");
  return `Day${dayNumber}`;
}

window.TripLog.register("features.expenses.table", {
  renderDaySelect,
  renderTable,
});
