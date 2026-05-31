const settlementMemberEmojis = ["👤", "🧳", "📸", "🎒", "🗺️", "☕", "🚕", "🎟️", "🍜"];

function getSettlementMemberEmoji(member, index = 0) {
  if (member?.isLeader) return "👑";
  return settlementMemberEmojis[Math.max(0, index - 1) % settlementMemberEmojis.length];
}

function getCompanionEmoji(index = 0) {
  return settlementMemberEmojis[index % settlementMemberEmojis.length];
}

function getSettlementEntryDayMeta(entry, sourceState) {
  const entryDate = parseDate(entry.date);
  const startDate = parseDate(sourceState?.startDate);
  const dayIndex = entryDate && startDate ? Math.round((entryDate - startDate) / 86400000) + 1 : 0;
  return {
    label: dayIndex > 0 ? `${dayIndex}일차` : "-",
    shortDate: entryDate ? formatShortDate(entryDate) : "-",
  };
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

function renderSettlementPage(totals) {
  const membersListWrap = document.querySelector("#settlementMembersList");
  const individualInputsWrap = document.querySelector("#settlementIndividualSpentInputs");
  const sourceSelect = document.querySelector("#settlementExpenseSourceSelect");
  const sourceSummary = document.querySelector("#settlementSourceSummary");
  const expenseSplitSummary = document.querySelector("#settlementExpenseSplitSummary");
  const expenseSplitList = document.querySelector("#settlementExpenseSplitList");
  const settlementLoadedTripName = document.querySelector("#settlementLoadedTripName");
  const settlementLoadedExpenseCount = document.querySelector("#settlementLoadedExpenseCount");
  const settlementTotalAmount = document.querySelector("#settlementTotalAmount");
  const settlementMemberCount = document.querySelector("#settlementMemberCount");
  const settlementPerPersonAmount = document.querySelector("#settlementPerPersonAmount");
  const settlementMemberBreakdown = document.querySelector("#settlementMemberBreakdown");
  const settlementGuideList = document.querySelector("#settlementGuideList");

  if (!membersListWrap || !individualInputsWrap || !expenseSplitList) return;

  const sources = getSettlementExpenseSources(totals);
  const selectedSource = getSelectedSettlementExpenseSource(sources);
  const sourceState = selectedSource.state || state;
  const companions = state.companions || [];
  const settings = getSettlementSettings();
  const settlementModel = buildSettlementModel(selectedSource);
  const { members, entryRows, totalTripSpent, memberSummaries, invalidEntries, transactions } = settlementModel;
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
    sourceSummary.textContent = `${prefix}에서 ${entryRows.length}건의 지출을 불러왔습니다. 각 행의 👥 분담 버튼으로 사람별 할당 금액을 확인하고 편집합니다.`;
  }

  if (settlementLoadedTripName) settlementLoadedTripName.textContent = selectedSource.name;
  if (settlementLoadedExpenseCount) settlementLoadedExpenseCount.textContent = `${entryRows.length.toLocaleString("ko-KR")}건`;
  if (settlementTotalAmount) settlementTotalAmount.textContent = formatSettlementCurrency(totalTripSpent, sourceState);
  if (expenseSplitSummary) {
    const customCount = entryRows.filter((row) => row.mode === "custom").length;
    const invalidText = invalidEntries.length > 0 ? ` · 확인 필요 ${invalidEntries.length}건` : "";
    expenseSplitSummary.textContent = `${entryRows.length}건 · 직접 편집 ${customCount}건${invalidText}`;
  }

  renderSettlementMemberChips(membersListWrap, companions);
  renderCompanionSpentInputs(individualInputsWrap, companions);
  renderSettlementExpenseLedger(expenseSplitList, entryRows, members, sourceState, expandedEntryKey);
  renderSettlementSummary({
    settlementMemberCount,
    settlementPerPersonAmount,
    settlementMemberBreakdown,
    settlementGuideList,
    companions,
    members,
    memberSummaries,
    invalidEntries,
    transactions,
    entryRows,
    sourceState,
  });
}

function renderSettlementMemberChips(membersListWrap, companions) {
  membersListWrap.replaceChildren();

  const leaderChip = document.createElement("div");
  leaderChip.className = "settlement-member-chip leader";
  leaderChip.innerHTML = `
    <span class="settlement-member-avatar">👑</span>
    <span>방장 (나)</span>
  `;
  membersListWrap.appendChild(leaderChip);

  companions.forEach((companion, index) => {
    const chip = document.createElement("div");
    chip.className = "settlement-member-chip";
    chip.innerHTML = `
      <span class="settlement-member-avatar">${getCompanionEmoji(index)}</span>
      <span>${escapeHtml(companion.name)}</span>
      <button type="button" class="companion-delete-btn" data-index="${index}" title="멤버 삭제">&times;</button>
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
        <input type="number" min="0" step="100" class="companion-spent-input" data-index="${index}" value="${companion.individualSpent || 0}" placeholder="0" />
        <span>원</span>
      </div>
    `;
    row.querySelector(".companion-spent-input").addEventListener("change", (event) => {
      updateCompanionSpent(index, Number(event.target.value) || 0);
    });
    individualInputsWrap.appendChild(row);
  });
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
          <th>일차</th>
          <th>날짜</th>
          <th>항목</th>
          <th>내용</th>
          <th class="number">금액</th>
          <th class="number">사람별 할당</th>
          <th class="actions-col">분담</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `;

  const tbody = tableWrap.querySelector("tbody");
  entryRows.forEach((entry) => {
    const dayMeta = getSettlementEntryDayMeta(entry, sourceState);
    const categoryColor = getCategory(entry.category).color;
    const expanded = entry.key === expandedEntryKey;
    const tr = document.createElement("tr");
    tr.className = `${entry.invalid ? "is-invalid" : ""} ${expanded ? "is-expanded" : ""}`.trim();
    tr.innerHTML = `
      <td data-label="일차">${escapeHtml(dayMeta.label)}</td>
      <td data-label="날짜">${escapeHtml(dayMeta.shortDate)}</td>
      <td data-label="항목"><span class="tag" style="--tag-color:${categoryColor}">${escapeHtml(entry.category)}</span></td>
      <td class="settlement-description-cell" data-label="내용">
        <strong>${escapeHtml(entry.description)}</strong>
      </td>
      <td class="number" data-label="금액">${formatEntryAmountHtml(entry.raw || entry)}</td>
      <td class="number" data-label="사람별 할당">
        <div class="settlement-allocation-preview">
          ${members.map((member, index) => {
            const amount = entry.shares[member.key] || 0;
            return `<span class="allocation-mini-chip" title="${escapeHtml(member.name)}">${getSettlementMemberEmoji(member, index)} ${escapeHtml(formatSettlementCurrency(amount, sourceState))}</span>`;
          }).join("")}
        </div>
      </td>
      <td class="actions-col" data-label="분담">
        <button class="settlement-split-action ${expanded ? "active" : ""}" type="button" data-split-toggle="${escapeHtml(entry.key)}" title="사람별 할당 금액 보기 및 편집">
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
      updateSettlementEntryShare(event.target.dataset.entryKey, event.target.dataset.memberKey, Number(event.target.value) || 0);
    };
    input.addEventListener("focus", (event) => event.target.select());
    input.addEventListener("change", commitShareInput);
    input.addEventListener("blur", commitShareInput);
  });

  expenseSplitList.appendChild(tableWrap);
}

function createSettlementSplitEditorRow(entry, members, sourceState) {
  const row = document.createElement("tr");
  const status = getSettlementEntryStatus(entry, sourceState);
  row.className = `settlement-split-editor-row ${entry.invalid ? "is-invalid" : ""}`;
  row.innerHTML = `
    <td colspan="7">
      <div class="settlement-split-editor">
        <div class="settlement-split-editor-head">
          <div>
            <strong>사람별 할당 금액</strong>
            <span>할당 합계 ${escapeHtml(formatSettlementCurrency(entry.allocatedTotal, sourceState))} / 지출 ${escapeHtml(formatSettlementCurrency(entry.amount, sourceState))}</span>
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
                  <input type="number" min="0" step="100" value="${Math.round(amount)}" data-share-input="true" data-entry-key="${escapeHtml(entry.key)}" data-member-key="${escapeHtml(member.key)}" />
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

function renderSettlementSummary({
  settlementMemberCount,
  settlementPerPersonAmount,
  settlementMemberBreakdown,
  settlementGuideList,
  companions,
  members,
  memberSummaries,
  invalidEntries,
  transactions,
  entryRows,
  sourceState,
}) {
  const memberLabel = companions.length > 0 ? `방장 + ${companions.map((companion) => companion.name).join(", ")}` : "나홀로";
  if (settlementMemberCount) settlementMemberCount.textContent = `${members.length}명 (${memberLabel})`;
  if (settlementPerPersonAmount) {
    settlementPerPersonAmount.textContent = invalidEntries.length > 0
      ? `${invalidEntries.length}건 금액 확인 필요`
      : `${entryRows.length}건 할당 완료`;
  }

  if (settlementMemberBreakdown) {
    settlementMemberBreakdown.replaceChildren();
    memberSummaries.forEach((member, index) => {
      const row = document.createElement("div");
      row.className = "settlement-member-total-row";
      row.innerHTML = `
        <div>
          <strong>${getSettlementMemberEmoji(member, index)} ${escapeHtml(member.name)}</strong>
          <span>낸 돈 ${formatSettlementCurrency(member.paid, sourceState)} · 부담 ${formatSettlementCurrency(member.owed, sourceState)}</span>
        </div>
        <em class="${member.balance >= 0 ? "receive" : "pay"}">${member.balance >= 0 ? "+" : "-"}${formatSettlementCurrency(Math.abs(member.balance), sourceState)}</em>
      `;
      settlementMemberBreakdown.appendChild(row);
    });
  }

  if (!settlementGuideList) return;
  settlementGuideList.replaceChildren();

  if (companions.length === 0) {
    settlementGuideList.innerHTML = `<div class="settlement-guide-empty">정산 인원을 추가하면 송금 가이드가 활성화됩니다.</div>`;
    return;
  }

  if (invalidEntries.length > 0) {
    settlementGuideList.innerHTML = `<div class="settlement-guide-warning">커스텀 항목 ${invalidEntries.length}건의 멤버별 합계가 지출 금액과 맞아야 송금 가이드를 계산할 수 있습니다.</div>`;
    return;
  }

  if (transactions.length === 0) {
    settlementGuideList.innerHTML = `<div class="settlement-guide-success">모두 정확히 분담 완료했습니다. 주고받을 돈이 없습니다.</div>`;
    return;
  }

  transactions.forEach((transaction) => {
    const guideRow = document.createElement("div");
    guideRow.className = "settlement-guide-row";
    guideRow.innerHTML = `
      <span><strong>${escapeHtml(transaction.from)}</strong> 👉 <strong>${escapeHtml(transaction.to)}</strong></span>
      <strong>${formatSettlementCurrency(transaction.amount, sourceState)} 송금</strong>
    `;
    settlementGuideList.appendChild(guideRow);
  });
}

window.TripLog.register("features.settlement.render", {
  renderSettlementPage,
  renderSettlementMemberChips,
  renderCompanionSpentInputs,
  renderSettlementExpenseLedger,
});
