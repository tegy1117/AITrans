import type { DictionaryEntry } from "./shared/types";

export interface DictionaryApp {
  setEntries(entries: DictionaryEntry[]): void;
  getEntries(): DictionaryEntry[];
}

export interface DictionaryAppCallbacks {
  onDelete(id: string): Promise<DictionaryEntry[]>;
}

interface DictionaryGroup {
  dateKey: string;
  dateLabel: string;
  entries: DictionaryEntry[];
}

export function mountDictionaryApp(root: HTMLElement, initialEntries: DictionaryEntry[], callbacks: DictionaryAppCallbacks): DictionaryApp {
  let entries = sortEntries(initialEntries);
  let query = "";
  const expandedIds = new Set<string>();
  let statusMessage = "";

  const app: DictionaryApp = {
    setEntries(nextEntries) {
      entries = sortEntries(nextEntries);
      render();
    },
    getEntries() {
      return entries;
    }
  };

  render();
  return app;

  function render(): void {
    const filteredEntries = filterEntries(entries, query);
    root.replaceChildren();

    const shell = element("section", "dictionary-shell");
    shell.append(renderHeader(), renderSearch(), renderStatus());

    if (entries.length === 0) {
      shell.append(emptyText("아직 저장된 사전 항목이 없습니다."));
    } else if (filteredEntries.length === 0) {
      shell.append(emptyText("검색 결과가 없습니다."));
    } else {
      for (const group of groupEntriesByLocalDate(filteredEntries)) {
        shell.append(renderGroup(group));
      }
    }

    root.append(shell);
  }

  function renderHeader(): HTMLElement {
    const header = element("header", "dictionary-header");
    const title = document.createElement("h1");
    title.textContent = "저장된 사전";
    const description = document.createElement("p");
    description.className = "muted";
    description.textContent = "번역 결과에서 저장한 단어와 AI 설명을 검색하고 확인합니다.";
    header.append(title, description);
    return header;
  }

  function renderSearch(): HTMLElement {
    const label = document.createElement("label");
    label.className = "dictionary-search";
    label.textContent = "검색";
    const input = document.createElement("input");
    input.type = "search";
    input.placeholder = "단어, 설명, 원문 문맥 검색";
    input.value = query;
    input.dataset.role = "dictionary-search";
    input.addEventListener("input", () => {
      query = input.value;
      render();
    });
    label.append(input);
    return label;
  }

  function renderStatus(): HTMLElement {
    const status = document.createElement("p");
    status.id = "dictionaryStatus";
    status.role = "status";
    status.className = "muted";
    status.textContent = statusMessage;
    return status;
  }

  function renderGroup(group: DictionaryGroup): HTMLElement {
    const section = element("section", "dictionary-date-group");
    section.dataset.role = "dictionary-date-group";
    section.dataset.dateKey = group.dateKey;

    const heading = document.createElement("h2");
    heading.textContent = group.dateLabel;

    const list = element("div", "dictionary-entry-list");
    for (const entry of group.entries) {
      list.append(renderEntry(entry));
    }

    section.append(heading, list);
    return section;
  }

  function renderEntry(entry: DictionaryEntry): HTMLElement {
    const isExpanded = expandedIds.has(entry.id);
    const article = element("article", "dictionary-entry-card");
    article.dataset.entryId = entry.id;
    article.dataset.expanded = String(isExpanded);
    article.addEventListener("click", () => toggleEntry(entry.id));

    const header = element("div", "dictionary-entry-header");
    const term = document.createElement("h3");
    term.textContent = entry.term;
    const time = document.createElement("time");
    time.dateTime = entry.createdAt;
    time.textContent = formatTime(entry.createdAt);
    header.append(term, time);

    const explanation = document.createElement("p");
    explanation.dataset.role = "dictionary-explanation";
    explanation.dataset.expanded = String(isExpanded);
    explanation.className = isExpanded ? "dictionary-explanation" : "dictionary-explanation collapsed";
    explanation.style.whiteSpace = "pre-wrap";
    explanation.textContent = entry.explanation;

    const sourceDetails = document.createElement("details");
    sourceDetails.addEventListener("click", (event) => event.stopPropagation());
    const summary = document.createElement("summary");
    summary.textContent = "원문 보기";
    const source = document.createElement("p");
    source.dataset.role = "dictionary-source";
    source.style.whiteSpace = "pre-wrap";
    source.textContent = entry.sourceText;
    sourceDetails.append(summary, source);

    const actions = element("div", "dictionary-actions");
    const toggleButton = button(isExpanded ? "접기" : "펼치기", "toggle-dictionary-entry", () => toggleEntry(entry.id));
    const deleteButton = button("삭제", "delete-dictionary-entry", async () => {
      statusMessage = "삭제 중...";
      render();
      try {
        entries = sortEntries(await callbacks.onDelete(entry.id));
        expandedIds.delete(entry.id);
        statusMessage = "삭제했습니다.";
      } catch (error) {
        statusMessage = error instanceof Error ? error.message : String(error);
      }
      render();
    });
    deleteButton.classList.add("danger");
    actions.append(toggleButton, deleteButton);

    article.append(header, explanation, sourceDetails, actions);
    return article;
  }

  function toggleEntry(id: string): void {
    if (expandedIds.has(id)) {
      expandedIds.delete(id);
    } else {
      expandedIds.add(id);
    }
    render();
  }
}

export function groupEntriesByLocalDate(entries: DictionaryEntry[]): DictionaryGroup[] {
  const groups = new Map<string, DictionaryEntry[]>();

  for (const entry of sortEntries(entries)) {
    const key = localDateKey(entry.createdAt);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([dateKey, groupEntries]) => ({
      dateKey,
      dateLabel: formatDateLabel(groupEntries[0]?.createdAt ?? dateKey),
      entries: groupEntries
    }));
}

function filterEntries(entries: DictionaryEntry[], query: string): DictionaryEntry[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return sortEntries(entries);

  return sortEntries(entries).filter((entry) =>
    [entry.term, entry.explanation, entry.sourceText].some((value) => value.toLocaleLowerCase().includes(normalizedQuery))
  );
}

function sortEntries(entries: DictionaryEntry[]): DictionaryEntry[] {
  return [...entries].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

function localDateKey(value: string): string {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(value: string): string {
  return new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short"
  });
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function emptyText(text: string): HTMLElement {
  const paragraph = document.createElement("p");
  paragraph.className = "dictionary-empty";
  paragraph.textContent = text;
  return paragraph;
}

function button(label: string, action: string, onClick: (event: MouseEvent) => void | Promise<void>): HTMLButtonElement {
  const buttonElement = document.createElement("button");
  buttonElement.type = "button";
  buttonElement.textContent = label;
  buttonElement.dataset.action = action;
  buttonElement.addEventListener("click", (event) => {
    event.stopPropagation();
    void onClick(event);
  });
  return buttonElement;
}

function element(tag: keyof HTMLElementTagNameMap, className: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
