const STORAGE_KEY = "transferencia-estoque-relatorios";
const ACTIONS = [
  { value: "transferido", label: "Transferido" },
  { value: "em analise", label: "Em análise" },
  { value: "recusado", label: "Recusado" },
];

const input = document.querySelector("#spreadsheet-input");
const processButton = document.querySelector("#process-button");
const importMessage = document.querySelector("#import-message");
const itemsSection = document.querySelector("#items-section");
const itemsList = document.querySelector("#items-list");
const itemCount = document.querySelector("#item-count");
const finishButton = document.querySelector("#finish-button");
const finishMessage = document.querySelector("#finish-message");
const reportsList = document.querySelector("#reports-list");
const reportsEmpty = document.querySelector("#reports-empty");

const startConferenceButton = document.getElementById("start-conference-button");
const previewModal = document.getElementById("preview-modal");
const previewList = document.getElementById("preview-list");
const modalStartConference = document.getElementById("modal-start-conference");
const modalClose = document.getElementById("modal-close");
const resetModal = document.getElementById("reset-modal");
const cancelReset = document.getElementById("cancel-reset");
const confirmReset = document.getElementById("confirm-reset");

let items = [];
let conferenceStarted = false;

finishButton.hidden = true;


const copySapButton = document.getElementById("copy-sap-button");

/* ---------- Copiar para o SAP ---------- */

function cleanCell(value) {
  return String(value).replace(/[\t\r\n]+/g, " ").trim();
}

function buildSapTable() {
  // A: código | B: descrição | C: DP018 | D: vazio | E: DP001 | F, G: vazios | H: quantidade
  return items
    .map((item) => {
      const quantity = String(item.transferredQuantity ?? item.quantity).replace(".", ",");
      return [
        cleanCell(item.code),
        cleanCell(item.description),
        "DP018",
        "",
        "DP001",
        "",
        "",
        quantity,
      ].join("\t");
    })
    .join("\r\n");
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  if (!ok) throw new Error("Cópia não permitida pelo navegador.");
}

copySapButton.addEventListener("click", async () => {
  try {
    await copyText(buildSapTable());
    setMessage(importMessage, "Copiado! Cole na planilha do Excel com Ctrl+V.");
  } catch (error) {
    setMessage(importMessage, `Não foi possível copiar: ${error.message}`, true);
  }
});

/* ---------- Modais ---------- */

cancelReset.addEventListener("click", () => {
  resetModal.close();
});

confirmReset.addEventListener("click", () => {
  resetModal.close();

  items = [];
  conferenceStarted = false;
  input.value = "";
  itemsList.replaceChildren();
  itemsSection.hidden = true;
  finishButton.hidden = true;
  copySapButton.hidden = true;
  setMessage(importMessage, "");
  setMessage(finishMessage, "");
  processButton.textContent = "Processar planilha";
});

modalClose.addEventListener("click", () => {
  previewModal.close();
});

modalStartConference.addEventListener("click", () => {
  const selectedItems = items.filter((item) => item.selected);

  if (selectedItems.length === 0) {
    alert("Selecione pelo menos um item.");
    return;
  }

  items = selectedItems;
  conferenceStarted = true;

  previewModal.close();
  renderItems();

  itemsSection.hidden = false;
  finishButton.hidden = false;
  copySapButton.hidden = false;
  processButton.textContent = "Limpar e Recomeçar";
});

startConferenceButton.addEventListener("click", () => {
  conferenceStarted = true;
  startConferenceButton.hidden = true;
  finishButton.hidden = false;
  copySapButton.hidden = false;
  renderItems();
});

/* ---------- Pré-visualização (modal "Itens encontrados") ---------- */

function renderPreview() {
  previewList.replaceChildren();

  const table = document.createElement("table");
  table.className = "preview-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");

  const thCheck = document.createElement("th");
  const checkAll = document.createElement("input");
  checkAll.id = "check-all-items";
  checkAll.type = "checkbox";
  checkAll.checked = items.length > 0 && items.every((item) => item.selected);
  thCheck.append(checkAll);
  headRow.append(thCheck);

  ["Código", "Descrição", "Quantidade"].forEach((title) => {
    const th = document.createElement("th");
    th.textContent = title;
    headRow.append(th);
  });
  thead.append(headRow);

  const tbody = document.createElement("tbody");

  items.forEach((item) => {
    const row = document.createElement("tr");

    const tdCheck = document.createElement("td");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = item.selected;
    checkbox.addEventListener("change", () => {
      item.selected = checkbox.checked;
      checkAll.checked = items.every((current) => current.selected);
      updateSelectedCounter();
    });
    tdCheck.append(checkbox);

    const tdCode = document.createElement("td");
    tdCode.textContent = item.code;

    const tdDescription = document.createElement("td");
    tdDescription.textContent = item.description;

    const tdQuantity = document.createElement("td");
    tdQuantity.textContent = formatQuantity(item.quantity);

    row.append(tdCheck, tdCode, tdDescription, tdQuantity);
    tbody.append(row);
  });

  table.append(thead, tbody);
  previewList.append(table);

  checkAll.addEventListener("change", () => {
    items.forEach((item) => {
      item.selected = checkAll.checked;
    });
    renderPreview();
  });

  updateSelectedCounter();
}

function updateSelectedCounter() {
  let counter = document.getElementById("selected-counter");

  if (!counter) {
    counter = document.createElement("p");
    counter.id = "selected-counter";
    previewList.append(counter);
  }

  const total = items.filter((item) => item.selected).length;
  counter.textContent = `Selecionados: ${total} de ${items.length}`;
}

/* ---------- Leitura da planilha ---------- */

function parseQuantity(value) {
  let normalized = value.trim().replace(/\s/g, "");
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "");
  }
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const quantity = Number(normalized);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : null;
}

function isHeaderRow(row) {
  const firstCells = row.slice(0, 3).map((cell) =>
    cell
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR"),
  );
  return (
    /codigo|sku|n[º°o]?\s*do\s*item/.test(firstCells[0] ?? "") ||
    /descricao/.test(firstCells[1] ?? "") ||
    /estoque|quantidade|disponivel/.test(firstCells[2] ?? "")
  );
}

function detectDelimiter(line) {
  const candidates = ["\t", ";", ","];
  return candidates
    .map((delimiter) => ({
      delimiter,
      count: line.split(delimiter).length - 1,
    }))
    .sort((left, right) => right.count - left.count)[0].delimiter;
}

function splitRow(line, delimiter) {
  const values = [];
  let value = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (insideQuotes && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (character === delimiter && !insideQuotes) {
      values.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }

  values.push(value.trim());
  return values;
}

function parseSpreadsheet(text) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error("Cole os dados da planilha antes de processar.");
  }

  const delimiter = detectDelimiter(lines[0]);
  const parsedRows = lines.map((line) => splitRow(line, delimiter));
  const hasHeader = isHeaderRow(parsedRows[0]);
  const dataRows = hasHeader
    ? parsedRows.slice(1).map((row, index) => ({ row, lineNumber: index + 2 }))
    : parsedRows.map((row, index) => ({ row, lineNumber: index + 1 }));

  if (dataRows.length === 0) {
    throw new Error("A planilha tem cabeçalho, mas não contém itens.");
  }

  const result = [];
  for (const { row } of dataRows) {
    const code = (row[0] || "").trim().toUpperCase();
    const description = (row[1] || "").trim();
    const quantity = parseQuantity(row[2] ?? "");

    // Só itens MP com quantidade válida entram na conferência
    if (!code.startsWith("MP")) continue;
    if (!quantity || quantity <= 0) continue;
    if (!description) continue;

    result.push({
      code,
      description,
      quantity,
      sourceDepot: "DP018",
      destinationDepot: "DP001",
      selected: true,
      action: "",
      transferredQuantity: quantity,
    });
  }

  if (result.length === 0) {
    throw new Error("Nenhum item MP com quantidade disponível foi encontrado na planilha.");
  }

  return result;
}

/* ---------- Lista de conferência ---------- */

function createActionOption(item, action, index) {
  const label = document.createElement("label");
  label.className = "action-option";

  const radio = document.createElement("input");
  radio.type = "radio";
  radio.name = `item-action-${index}`;
  radio.value = action.value;
  radio.checked = item.action === action.value;
  radio.addEventListener("change", () => {
    item.action = action.value;
    renderItems();
  });

  const text = document.createElement("span");
  text.textContent = action.label;
  label.append(radio, text);
  return label;
}

function renderItems() {
  itemsList.replaceChildren();
  itemCount.textContent = `${items.length} ${items.length === 1 ? "item" : "itens"}`;

  items.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "item-card";

    const topline = document.createElement("div");
    topline.className = "item-topline";

    const details = document.createElement("div");
    const number = document.createElement("span");
    number.className = "item-number";
    number.textContent = `Item ${index + 1}`;
    const code = document.createElement("p");
    code.className = "item-code";
    code.textContent = item.code;
    const description = document.createElement("p");
    description.className = "item-description";
    description.textContent = item.description;
    const route = document.createElement("p");
    route.className = "item-route";
    route.textContent = `${item.sourceDepot} → ${item.destinationDepot}`;
    details.append(number, description, code, route);

    const quantity = document.createElement("div");
    quantity.className = "item-quantity";
    quantity.append("Quantidade disponível");
    const quantityValue = document.createElement("strong");
    quantityValue.textContent = formatQuantity(item.quantity);
    quantity.append(quantityValue);
    topline.append(details, quantity);

    const actions = document.createElement("div");
    actions.className = "action-row";
    actions.setAttribute("aria-label", `Ação para o item ${item.code}`);
    ACTIONS.forEach((action) => actions.append(createActionOption(item, action, index)));

    const transferRow = document.createElement("label");
    transferRow.className = `transfer-quantity${item.action === "transferido" ? " is-visible" : ""}`;
    transferRow.append("Quantidade transferida");
    const transferInput = document.createElement("input");
    transferInput.className = "quantity-input";
    transferInput.type = "number";
    transferInput.min = "0.01";
    transferInput.max = String(item.quantity);
    transferInput.step = "any";
    transferInput.value = String(item.transferredQuantity);
    transferInput.setAttribute("aria-label", `Quantidade transferida do item ${item.code}`);
    transferInput.addEventListener("input", () => {
      item.transferredQuantity = Number(transferInput.value);
      finishMessage.textContent = "";
    });
    transferRow.append(transferInput);

    card.append(topline);

    if (conferenceStarted) {
      card.append(actions, transferRow);
    }

    itemsList.append(card);
  });
}

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

function formatQuantity(quantity) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6 }).format(quantity);
}

/* ---------- Relatórios ---------- */

function loadReports() {
  try {
    const savedReports = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(savedReports)) throw new Error("Formato de histórico inválido.");
    return savedReports;
  } catch (error) {
    throw new Error("Não foi possível ler o histórico local de relatórios.", { cause: error });
  }
}

function downloadReport(report) {
  const blob = new Blob([report.content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = report.filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderReports() {
  const reports = loadReports();
  reportsList.replaceChildren();
  reportsEmpty.hidden = reports.length > 0;

  reports
    .slice()
    .reverse()
    .forEach((report) => {
      const row = document.createElement("div");
      row.className = "report-row";
      const info = document.createElement("div");
      const date = document.createElement("p");
      date.className = "report-date";
      date.textContent = report.completedAt;
      const detail = document.createElement("p");
      detail.className = "report-detail";
      detail.textContent = `${report.itemCount} ${report.itemCount === 1 ? "item" : "itens"}`;
      info.append(date, detail);

      const link = document.createElement("a");
      link.className = "download-link";
      link.href = "#";
      link.textContent = "Baixar .txt";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        downloadReport(report);
      });

      row.append(info, link);
      reportsList.append(row);
    });
}

function formatReport(completedAt, reportItems) {
  const lines = [
    "RELATÓRIO DE TRANSFERÊNCIA DE ESTOQUE",
    `Finalizado em: ${completedAt}`,
    `Total de itens: ${reportItems.length}`,
    "",
    ...reportItems.flatMap((item, index) => [
      `Item ${index + 1}`,
      `Código: ${item.code}`,
      `Descrição: ${item.description}`,
      `Quantidade disponível: ${formatQuantity(item.quantity)}`,
      `Depósito de origem: ${item.sourceDepot}`,
      `Depósito de destino: ${item.destinationDepot}`,
      `Quantidade transferida: ${formatQuantity(item.action === "transferido" ? item.transferredQuantity : 0)}`,
      `Ação: ${ACTIONS.find((action) => action.value === item.action).label}`,
      "",
    ]),
  ];
  return lines.join("\r\n");
}

/* ---------- Botões principais ---------- */

processButton.addEventListener("click", () => {
  if (conferenceStarted) {
    resetModal.showModal();
    return;
  }

  try {
    items = parseSpreadsheet(input.value);

    items.sort((a, b) =>
    a.description.localeCompare(b.description, "pt-BR", {
      sensitivity: "base"
    })
  );

    renderPreview();
    previewModal.showModal();

    itemsSection.hidden = true;
    finishButton.hidden = true;
    copySapButton.hidden = true;

    setMessage(
      importMessage,
      `${items.length} ${
        items.length === 1
          ? "item encontrado para conferência"
          : "itens encontrados para conferência"
      }.`,
    );
    setMessage(finishMessage, "");
  } catch (error) {
    console.error("ERRO:", error);
    items = [];

    itemsSection.hidden = true;
    startConferenceButton.hidden = true;
    finishButton.hidden = true;
    copySapButton.hidden = true;

    setMessage(importMessage, error.message, true);
  }
});

finishButton.addEventListener("click", () => {
  const unclassifiedIndex = items.findIndex((item) => !item.action);
  if (unclassifiedIndex !== -1) {
    setMessage(finishMessage, `Escolha uma ação para o item ${unclassifiedIndex + 1}.`, true);
    return;
  }

  const invalidTransfer = items.findIndex(
    (item) =>
      item.action === "transferido" &&
      (!Number.isFinite(item.transferredQuantity) ||
        item.transferredQuantity <= 0 ||
        item.transferredQuantity > item.quantity),
  );
  if (invalidTransfer !== -1) {
    setMessage(
      finishMessage,
      `Informe uma quantidade transferida maior que zero e até ${items[invalidTransfer].quantity} para o item ${invalidTransfer + 1}.`,
      true,
    );
    return;
  }

  const completedAt = new Date().toLocaleString("pt-BR");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `relatorio-transferencia-${timestamp}.txt`;
  const reportItems = items.map((item) => ({ ...item }));
  const report = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    completedAt,
    itemCount: reportItems.length,
    filename,
    content: formatReport(completedAt, reportItems),
  };

  try {
    const reports = loadReports();
    reports.push(report);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
    renderReports();
    setMessage(finishMessage, "Relatório salvo neste navegador. Você pode baixá-lo pelo histórico quando quiser.");
  } catch (error) {
    setMessage(finishMessage, `Não foi possível salvar o relatório: ${error.message}`, true);
  }
});

try {
  renderReports();
} catch (error) {
  reportsEmpty.textContent = error.message;
}
