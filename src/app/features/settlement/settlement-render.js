const settlementMemberEmojis = ["👤", "🧳", "📸", "🎒", "🗺️", "☕", "🚕", "🎟️", "🍜"];

function getSettlementMemberEmoji(member, index = 0) {
  if (member?.isLeader) return "👑";
  return settlementMemberEmojis[Math.max(0, index - 1) % settlementMemberEmojis.length];
}

function getCompanionEmoji(index = 0) {
  return settlementMemberEmojis[index % settlementMemberEmojis.length];
}

function getSettlementEntryDayMeta(entry, sourceState) {
  const days = getTripDaysForRange(sourceState?.startDate, sourceState?.endDate);
  return getExpenseDayMeta(entry.date, days);
}

function getSettlementEntryStatus(entry, sourceState) {
  if (entry.mode === "custom" && entry.invalid) {
    const diffAmount = formatSettlementCurrency(Math.abs(entry.diff), sourceState);
    return {
      tone: "warning",
      text: `커스텀 합계가 ${diffAmount} ${entry.diff > 0 ? "부족합니다" : "많습니다"}`,
    };
  }

  if (entry.mode === "custom") {
    return {
      tone: "success",
      text: "사람별 할당 합계가 지출 금액과 일치합니다",
    };
  }

  return {
    tone: "neutral",
    text: "N분의 1 자동 배분 중입니다. 금액을 수정하면 커스텀 분담으로 바뀝니다.",
  };
}

function renderSettlementEditors(totals) {
  const membersListWrap = document.querySelector("#settlementMembersList");
  const individualInputsWrap = document.querySelector("#settlementIndividualSpentInputs");
  const sourceSelect = document.querySelector("#settlementExpenseSourceSelect");
  const sourceSummary = document.querySelector("#settlementSourceSummary");
  const expenseSplitList = document.querySelector("#settlementExpenseSplitList");

  if (!membersListWrap || !individualInputsWrap || !expenseSplitList) return;

  const sources = getSettlementExpenseSources(totals);
  const selectedSource = getSelectedSettlementExpenseSource(sources);
  const sourceState = selectedSource.state || state;
  const companions = state.companions || [];
  const settings = getSettlementSettings();
  const settlementModel = buildSettlementModel(selectedSource);
  const { members, entryRows } = settlementModel;
  const expandedEntryKey = entryRows.some((row) => row.key === settings.expandedEntryKey) ? settings.expandedEntryKey : "";
  if (settings.expandedEntryKey && !expandedEntryKey) settings.expandedEntryKey = "";

  if (sourceSelect) {
    sourceSelect.replaceChildren();
    sources.forEach((source) => {
      const option = document.createElement("option");
      option.value = source.id;
      option.textContent = source.label;
      sourceSelect.appendChild(option);
    });
    sourceSelect.value = selectedSource.id;
    syncCustomSelect(sourceSelect, { rebuild: true });
  }

  if (sourceSummary) {
    const prefix = selectedSource.isCurrent ? "현재 여행" : "저장 기록";
    sourceSummary.textContent = `${prefix}에서 ${entryRows.length}건의 지출을 불러왔습니다.`;
  }

  renderSettlementMemberChips(membersListWrap, companions);
  renderCompanionSpentInputs(individualInputsWrap, companions);
  renderSettlementExpenseLedger(expenseSplitList, entryRows, members, sourceState, expandedEntryKey);
}

function renderSettlementMemberChips(membersListWrap, companions) {
  membersListWrap.replaceChildren();

  const leaderChip = document.createElement("div");
  leaderChip.className = "settlement-member-chip leader";
  leaderChip.innerHTML = `
    <span class="settlement-member-avatar">👑</span>
    <span>${escapeHtml(getSettlementMembers().find(member => member.isLeader)?.name || '여행 대표')}</span>
  `;
  membersListWrap.appendChild(leaderChip);

  companions.forEach((companion, index) => {
    const chip = document.createElement("div");
    chip.className = "settlement-member-chip";
    chip.innerHTML = `
      <span class="settlement-member-avatar">${getCompanionEmoji(index)}</span>
      <span>${escapeHtml(companion.name)}</span>
      <button type="button" class="companion-delete-btn" data-index="${index}" title="정산 멤버 삭제" aria-label="${escapeHtml(companion.name)} 정산 멤버 삭제">&times;</button>
    `;
    chip.querySelector(".companion-delete-btn").addEventListener("click", () => {
      deleteCompanion(index);
    });
    membersListWrap.appendChild(chip);
  });
}

function renderCompanionSpentInputs(individualInputsWrap, companions) {
  individualInputsWrap.replaceChildren();

  if (companions.length === 0) {
    const empty = document.createElement("div");
    empty.className = "settlement-empty-inline";
    empty.textContent = "멤버를 추가하면 개인 지출 입력 칸이 표시됩니다.";
    individualInputsWrap.appendChild(empty);
    return;
  }

  companions.forEach((companion, index) => {
    const row = document.createElement("div");
    row.className = "member-spent-row";
    row.innerHTML = `
      <span><em>${getCompanionEmoji(index)}</em> ${escapeHtml(companion.name)} 님의 개인 지출</span>
      <div class="member-spent-input-wrap">
        <input type="text" inputmode="numeric" class="companion-spent-input" data-index="${index}" value="${formatNumberWithCommas(companion.individualSpent || 0)}" placeholder="0" />
        <span>원</span>
      </div>
    `;
    row.querySelector(".companion-spent-input").addEventListener("change", (event) => {
      updateCompanionSpent(index, parseFormattedNumber(event.target.value));
    });
    individualInputsWrap.appendChild(row);
  });
  setupCommaNumberInputs(individualInputsWrap.querySelectorAll(".companion-spent-input"));
}

function renderSettlementExpenseLedger(expenseSplitList, entryRows, members, sourceState, expandedEntryKey) {
  expenseSplitList.replaceChildren();

  if (entryRows.length === 0) {
    expenseSplitList.innerHTML = `<div class="settlement-empty-expenses">불러온 지출 기록이 없습니다. 지출 기록 탭에서 항목을 추가하거나 다른 저장 기록을 선택하세요.</div>`;
    return;
  }

  const tableWrap = document.createElement("div");
  tableWrap.className = "table-wrap settlement-expense-table-wrap";
  tableWrap.innerHTML = `
    <table class="settlement-expense-table">
      <thead>
        <tr>
          <th>항목</th>
          <th>내용</th>
          <th class="number">금액 / 사람별 할당</th>
          <th class="actions-col">분담</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `;

  const tbody = tableWrap.querySelector("tbody");
  let lastGroupKey = "";
  entryRows.forEach((entry) => {
    const dayMeta = getSettlementEntryDayMeta(entry, sourceState);
    const groupKey = dayMeta.date || entry.date || "";
    if (groupKey !== lastGroupKey) {
      const groupRow = document.createElement("tr");
      groupRow.className = `settlement-day-group-row${isPreTripExpenseDate(dayMeta.date) ? " is-pretrip" : ""}`;
      groupRow.innerHTML = `
        <td colspan="4">
          <span>${escapeHtml(dayMeta.label || "날짜 없음")}</span>
          <em>${escapeHtml(dayMeta.shortDate || "-")}</em>
        </td>
      `;
      tbody.appendChild(groupRow);
      lastGroupKey = groupKey;
    }
    const categoryColor = getCategory(entry.category).color;
    const expanded = entry.key === expandedEntryKey;
    const tr = document.createElement("tr");
    tr.className = ["settlement-entry-row", entry.invalid ? "is-invalid" : "", expanded ? "is-expanded" : ""].filter(Boolean).join(" ");
    tr.innerHTML = `
      <td data-label="항목"><span class="tag" style="--tag-color:${categoryColor}">${escapeHtml(entry.category)}</span></td>
      <td class="settlement-description-cell" data-label="내용">
        <strong>${escapeHtml(entry.description)}</strong>
      </td>
      <td class="number settlement-amount-allocation-cell" data-label="금액">
        <div class="settlement-amount-allocation-content">
          <strong class="settlement-entry-amount">${formatEntryAmountHtml(entry.raw || entry)}</strong>
          <div class="settlement-allocation-preview" aria-label="사람별 할당">
            ${members.map((member, index) => {
              const amount = entry.shares[member.key] || 0;
              return `<span class="allocation-mini-chip" title="${escapeHtml(member.name)}">${getSettlementMemberEmoji(member, index)} ${escapeHtml(formatSettlementCurrency(amount, sourceState))}</span>`;
            }).join("")}
          </div>
        </div>
      </td>
      <td class="actions-col" data-label="분담">
        <button class="settlement-split-action ${expanded ? "active" : ""}" type="button" data-split-toggle="${escapeHtml(entry.key)}" aria-expanded="${expanded}" title="사람별 할당 금액 보기 및 편집">
          <span>👥</span>
          <strong>${expanded ? "닫기" : "분담"}</strong>
        </button>
      </td>
    `;
    tbody.appendChild(tr);

    if (expanded) {
      tbody.appendChild(createSettlementSplitEditorRow(entry, members, sourceState));
    }
  });

  tableWrap.querySelectorAll("[data-split-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleSettlementEntrySplit(button.dataset.splitToggle);
    });
  });

  tableWrap.querySelectorAll("[data-entry-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      setSettlementEntrySplitMode(button.dataset.entryKey, button.dataset.entryMode);
    });
  });

  tableWrap.querySelectorAll("[data-share-input]").forEach((input) => {
    const commitShareInput = (event) => {
      updateSettlementEntryShare(event.target.dataset.entryKey, event.target.dataset.memberKey, parseFormattedNumber(event.target.value));
    };
    input.addEventListener("focus", (event) => event.target.select());
    input.addEventListener("change", commitShareInput);
    input.addEventListener("blur", commitShareInput);
  });
  setupCommaNumberInputs(tableWrap.querySelectorAll("[data-share-input]"));

  expenseSplitList.appendChild(tableWrap);
}

function createSettlementSplitEditorRow(entry, members, sourceState) {
  const row = document.createElement("tr");
  const status = getSettlementEntryStatus(entry, sourceState);
  row.className = `settlement-split-editor-row ${entry.invalid ? "is-invalid" : ""}`;
  row.innerHTML = `
    <td colspan="4">
      <div class="settlement-split-editor">
        <div class="settlement-split-editor-head">
          <div class="settlement-split-editor-title">
            <strong>사람별 할당 금액</strong>
            <span class="settlement-split-editor-meta">할당 합계 ${escapeHtml(formatSettlementCurrency(entry.allocatedTotal, sourceState))} / 지출 ${escapeHtml(formatSettlementCurrency(entry.amount, sourceState))}</span>
          </div>
          <div class="settlement-item-mode-toggle" role="group" aria-label="${escapeHtml(entry.description)} 분담 방식">
            <button type="button" class="${entry.mode === "equal" ? "active" : ""}" data-entry-key="${escapeHtml(entry.key)}" data-entry-mode="equal">N분의 1</button>
            <button type="button" class="${entry.mode === "custom" ? "active" : ""}" data-entry-key="${escapeHtml(entry.key)}" data-entry-mode="custom">직접 입력</button>
          </div>
        </div>
        <div class="settlement-share-grid">
          ${members.map((member, index) => {
            const amount = entry.shares[member.key] || 0;
            return `
              <label class="settlement-share-card">
                <span class="settlement-share-member">
                  <em>${getSettlementMemberEmoji(member, index)}</em>
                  <strong>${escapeHtml(member.name)}</strong>
                </span>
                <span class="settlement-share-input-wrap">
                  <input type="text" inputmode="numeric" value="${formatNumberWithCommas(Math.round(amount))}" data-share-input="true" data-entry-key="${escapeHtml(entry.key)}" data-member-key="${escapeHtml(member.key)}" />
                  <small>원</small>
                </span>
              </label>
            `;
          }).join("")}
        </div>
        <p class="settlement-entry-note" data-tone="${status.tone}">${escapeHtml(status.text)}</p>
      </div>
    </td>
  `;
  return row;
}


window.TripLog.register("features.settlement.render", {
  renderSettlementEditors,
  renderSettlementMemberChips,
  renderCompanionSpentInputs,
  renderSettlementExpenseLedger,
});
