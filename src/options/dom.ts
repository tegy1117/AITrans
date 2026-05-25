import type {
  DictionaryEntry,
  ExtensionState,
  GenerationParameters,
  MessageRole,
  ProfilePurpose,
  PromptMessage,
  PromptProfile,
  ProviderConfig,
  ProviderType,
  SelectionResultDisplayMode,
  ReasoningEffort
} from "../shared/types";
import { validatePromptMessages } from "./promptValidation";
import {
  addProfile,
  addProvider,
  createId,
  deleteProfile,
  deleteProvider,
  duplicateProfile,
  setActiveProfile,
  updateProfile,
  updateProvider
} from "./stateEditor";

const providerTypes: ProviderType[] = ["openai", "claude", "gemini", "ollama-local", "ollama-cloud", "custom-openai-compatible"];
const purposes: ProfilePurpose[] = ["page", "selection", "image", "dictionary"];
const roles: MessageRole[] = ["system", "user", "assistant"];
const reasoningEfforts: ReasoningEffort[] = ["minimal", "low", "medium", "high"];

export interface OptionsApp {
  setState(state: ExtensionState): void;
  getState(): ExtensionState;
  setStatus(message: string): void;
}

export interface OptionsAppCallbacks {
  onSave(state: ExtensionState): Promise<void>;
  onDeleteDictionaryEntry?(id: string, state: ExtensionState): Promise<ExtensionState>;
}

export function mountOptionsApp(root: HTMLElement, initialState: ExtensionState, callbacks: OptionsAppCallbacks): OptionsApp {
  let state = initialState;
  let selectedProviderId = state.providerConfigs[0]?.id ?? "";
  let selectedPurpose: ProfilePurpose = "page";
  let selectedProfileId = state.activeProfileByPurpose[selectedPurpose] || state.promptProfiles.find((profile) => profile.purpose === selectedPurpose)?.id || "";
  let statusMessage = "";

  const app: OptionsApp = {
    setState(next) {
      state = next;
      selectedProviderId = state.providerConfigs.some((provider) => provider.id === selectedProviderId)
        ? selectedProviderId
        : state.providerConfigs[0]?.id ?? "";
      selectedProfileId = resolveSelectedProfileId(state, selectedPurpose, selectedProfileId);
      render();
    },
    getState() {
      return state;
    },
    setStatus(message) {
      statusMessage = message;
      render();
    }
  };

  render();
  return app;

  function render(): void {
    root.replaceChildren();
    const layout = element("div", "settings-layout");
    layout.append(renderSidebar(), renderEditor());
    root.append(layout, renderStatus(statusMessage));
  }

  function renderSidebar(): HTMLElement {
    const sidebar = element("aside", "settings-sidebar");
    sidebar.append(sectionTitle("프로바이더"), renderProviderList(), actionButton("프로바이더 추가", () => {
      const provider = {
        id: createId("provider"),
        name: "새 프로바이더",
        type: "custom-openai-compatible" as ProviderType,
        baseUrl: "https://api.example.com/v1"
      };
      state = addProvider(state, provider);
      selectedProviderId = provider.id;
      statusMessage = "프로바이더를 추가했습니다.";
      render();
    }));

    sidebar.append(sectionTitle("프롬프트 프로필"), renderPurposeTabs(), renderProfileList(), actionButton("프로필 추가", () => {
      const providerId = selectedProviderId || state.providerConfigs[0]?.id || "";
      const profile = {
        id: createId(`${selectedPurpose}-profile`),
        purpose: selectedPurpose,
        name: `새 ${purposeLabel(selectedPurpose)} 프로필`,
        providerId,
        model: ""
      };
      state = addProfile(state, profile);
      selectedProfileId = profile.id;
      statusMessage = "프로필을 추가했습니다.";
      render();
    }));
    return sidebar;
  }

  function renderProviderList(): HTMLElement {
    const list = element("div", "stack");
    for (const provider of state.providerConfigs) {
      const button = actionButton(provider.name, () => {
        selectedProviderId = provider.id;
        statusMessage = "";
        render();
      });
      button.classList.toggle("selected", provider.id === selectedProviderId);
      list.append(button);
    }
    return list;
  }

  function renderPurposeTabs(): HTMLElement {
    const wrapper = element("div", "segmented");
    for (const purpose of purposes) {
      const button = actionButton(purposeLabel(purpose), () => {
        selectedPurpose = purpose;
        selectedProfileId = resolveSelectedProfileId(state, purpose, state.activeProfileByPurpose[purpose]);
        statusMessage = "";
        render();
      });
      button.classList.toggle("selected", purpose === selectedPurpose);
      wrapper.append(button);
    }
    return wrapper;
  }

  function renderProfileList(): HTMLElement {
    const list = element("div", "stack");
    const profiles = state.promptProfiles.filter((profile) => profile.purpose === selectedPurpose);
    for (const profile of profiles) {
      const label = profile.id === state.activeProfileByPurpose[selectedPurpose] ? `${profile.name} *` : profile.name;
      const button = actionButton(label, () => {
        selectedProfileId = profile.id;
        statusMessage = "";
        render();
      });
      button.classList.toggle("selected", profile.id === selectedProfileId);
      list.append(button);
    }
    return list;
  }

  function renderEditor(): HTMLElement {
    const editor = element("section", "settings-editor");
    editor.append(renderDisplaySettings(), renderProviderEditor(), renderProfileEditor(), renderDictionaryEntries(), actionButton("전체 설정 저장", async () => {
      try {
        await callbacks.onSave(state);
        statusMessage = "저장했습니다.";
      } catch (error) {
        statusMessage = error instanceof Error ? error.message : String(error);
      }
      render();
    }));
    return editor;
  }

  function renderDisplaySettings(): HTMLElement {
    const panel = element("div", "settings-panel");
    panel.append(
      sectionTitle("표시 설정"),
      selectRow(
        "선택 번역 결과 표시 방식",
        state.selectionResultDisplayMode,
        ["drawer", "bubble"],
        (value) => {
          void saveDisplayMode(value as SelectionResultDisplayMode);
        },
        selectionResultDisplayModeLabel
      ),
      helpText("사이드바는 원문과 번역문을 함께 보여주고, 하단 번역창은 선택 위치 근처에 작은 결과창을 띄웁니다.")
    );
    return panel;
  }

  async function saveDisplayMode(selectionResultDisplayMode: SelectionResultDisplayMode): Promise<void> {
    const nextState = { ...state, selectionResultDisplayMode };
    state = nextState;
    try {
      await callbacks.onSave(nextState);
      statusMessage = "표시 방식을 저장했습니다.";
    } catch (error) {
      statusMessage = error instanceof Error ? error.message : String(error);
    }
    render();
  }

  function renderProviderEditor(): HTMLElement {
    const provider = state.providerConfigs.find((candidate) => candidate.id === selectedProviderId);
    const panel = element("div", "settings-panel");
    panel.append(sectionTitle("프로바이더"));
    if (!provider) {
      panel.append(muted("선택된 프로바이더가 없습니다."));
      return panel;
    }

    panel.append(
      inputRow("이름", provider.name, (value) => updateSelectedProvider({ name: value })),
      selectRow("종류", provider.type, providerTypes, (value) => updateSelectedProvider({ type: value as ProviderType }), providerTypeLabel),
      inputRow("API 키", provider.apiKey ?? "", (value) => updateSelectedProvider({ apiKey: value || undefined }), "password"),
      inputRow("기본 URL", provider.baseUrl ?? "", (value) => updateSelectedProvider({ baseUrl: value || undefined })),
      helpText("OpenAI 호환 API는 기본 URL 뒤에 /chat/completions를 붙여 요청합니다. 예: https://api.example.com/v1"),
      dangerButton("프로바이더 삭제", () => {
        try {
          state = deleteProvider(state, provider.id);
          selectedProviderId = state.providerConfigs[0]?.id ?? "";
          statusMessage = "프로바이더를 삭제했습니다.";
        } catch (error) {
          statusMessage = error instanceof Error ? error.message : String(error);
        }
        render();
      })
    );
    return panel;
  }

  function renderDictionaryEntries(): HTMLElement {
    const panel = element("div", "settings-panel");
    panel.append(sectionTitle("저장된 사전"));

    if (state.dictionaryEntries.length === 0) {
      panel.append(muted("아직 저장된 사전 항목이 없습니다."));
      return panel;
    }

    const list = element("div", "dictionary-list");
    for (const entry of state.dictionaryEntries) {
      list.append(renderDictionaryEntry(entry));
    }
    panel.append(list);
    return panel;
  }

  function renderDictionaryEntry(entry: DictionaryEntry): HTMLElement {
    const item = element("article", "dictionary-entry");
    const title = document.createElement("h3");
    title.textContent = entry.term;

    const explanation = document.createElement("p");
    explanation.textContent = entry.explanation;

    const meta = document.createElement("p");
    meta.className = "muted";
    meta.textContent = new Date(entry.createdAt).toLocaleString();

    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "원문 보기";
    const source = document.createElement("p");
    source.textContent = entry.sourceText;
    details.append(summary, source);

    const deleteButton = dangerButton("삭제", async () => {
      if (callbacks.onDeleteDictionaryEntry) {
        state = await callbacks.onDeleteDictionaryEntry(entry.id, state);
      } else {
        state = { ...state, dictionaryEntries: state.dictionaryEntries.filter((candidate) => candidate.id !== entry.id) };
      }
      statusMessage = "사전 항목을 삭제했습니다.";
      render();
    });
    deleteButton.dataset.action = "delete-dictionary-entry";

    item.append(title, explanation, meta, details, row([deleteButton]));
    return item;
  }

  function renderProfileEditor(): HTMLElement {
    const profile = state.promptProfiles.find((candidate) => candidate.id === selectedProfileId);
    const panel = element("div", "settings-panel");
    panel.append(sectionTitle("프롬프트 프로필"));
    if (!profile) {
      panel.append(muted("선택된 프로필이 없습니다."));
      return panel;
    }

    panel.append(
      inputRow("이름", profile.name, (value) => updateSelectedProfile({ name: value })),
      selectRow("프로바이더", profile.providerId, state.providerConfigs.map((provider) => provider.id), (value) =>
        updateSelectedProfile({ providerId: value })
      ),
      inputRow("모델", profile.model, (value) => updateSelectedProfile({ model: value })),
      helpText(`이 프로필은 ${purposeLabel(profile.purpose)} 기능에서 사용할 프롬프트와 모델 설정입니다.`),
      renderParameters(profile.parameters),
      renderMessages(profile),
      actionButton("이 기능의 기본 프로필로 설정", () => {
        state = setActiveProfile(state, profile.purpose, profile.id);
        statusMessage = `${profile.name} 프로필을 ${purposeLabel(profile.purpose)} 기본값으로 설정했습니다.`;
        render();
      }),
      actionButton("프로필 복제", () => {
        const id = createId(`${profile.purpose}-profile`);
        state = duplicateProfile(state, profile.id, id);
        selectedProfileId = id;
        statusMessage = "프로필을 복제했습니다.";
        render();
      }),
      dangerButton("프로필 삭제", () => {
        try {
          state = deleteProfile(state, profile.id);
          selectedProfileId = resolveSelectedProfileId(state, selectedPurpose, state.activeProfileByPurpose[selectedPurpose]);
          statusMessage = "프로필을 삭제했습니다.";
        } catch (error) {
          statusMessage = error instanceof Error ? error.message : String(error);
        }
        render();
      })
    );
    return panel;
  }

  function renderParameters(parameters: GenerationParameters): HTMLElement {
    const wrapper = element("div", "settings-grid");
    wrapper.append(
      inputRow("온도", stringValue(parameters.temperature), (value) => updateParameter("temperature", numberOrUndefined(value)), "number"),
      inputRow("Top P", stringValue(parameters.topP), (value) => updateParameter("topP", numberOrUndefined(value)), "number"),
      inputRow("최대 입력 토큰", stringValue(parameters.maxTokens), (value) => updateParameter("maxTokens", numberOrUndefined(value)), "number"),
      inputRow(
        "최대 출력 토큰",
        stringValue(parameters.maxOutputTokens),
        (value) => updateParameter("maxOutputTokens", numberOrUndefined(value)),
        "number"
      ),
      selectRow("추론 강도", parameters.reasoningEffort ?? "low", reasoningEfforts, (value) =>
        updateParameter("reasoningEffort", value as ReasoningEffort), reasoningEffortLabel
      )
    );
    return wrapper;
  }

  function renderMessages(profile: PromptProfile): HTMLElement {
    const wrapper = element("div", "message-editor");
    wrapper.append(sectionTitle("메시지"));
    wrapper.append(helpText("메시지는 위에서 아래 순서대로 AI에게 전달됩니다. {{content}}에는 번역할 원문이 들어갑니다."));
    profile.messages.forEach((message, index) => {
      const item = element("div", "message-item");
      item.append(
        selectRow("역할", message.role, roles, (value) => updateMessage(index, { ...message, role: value as MessageRole }), roleLabel),
        textareaRow("내용", message.content, (value) => updateMessage(index, { ...message, content: value })),
        row([
          actionButton("위로", () => moveMessage(index, -1), index === 0),
          actionButton("아래로", () => moveMessage(index, 1), index === profile.messages.length - 1),
          dangerButton("삭제", () => deleteMessage(index), profile.messages.length === 1)
        ])
      );
      wrapper.append(item);
    });
    wrapper.append(
      actionButton("메시지 추가", () => {
        updateSelectedProfile({ messages: [...profile.messages, { role: "user", content: "" }] });
      })
    );
    const validation = validatePromptMessages(profile.purpose, profile.messages);
    if (validation) wrapper.append(errorText(validation));
    return wrapper;
  }

  function updateSelectedProvider(patch: Partial<ProviderConfig>): void {
    state = updateProvider(state, selectedProviderId, patch);
    render();
  }

  function updateSelectedProfile(patch: Partial<PromptProfile>): void {
    state = updateProfile(state, selectedProfileId, patch);
    render();
  }

  function updateParameter(key: keyof GenerationParameters, value: GenerationParameters[keyof GenerationParameters]): void {
    const profile = state.promptProfiles.find((candidate) => candidate.id === selectedProfileId);
    if (!profile) return;
    updateSelectedProfile({ parameters: { ...profile.parameters, [key]: value } });
  }

  function updateMessage(index: number, message: PromptMessage): void {
    const profile = state.promptProfiles.find((candidate) => candidate.id === selectedProfileId);
    if (!profile) return;
    updateSelectedProfile({ messages: profile.messages.map((candidate, candidateIndex) => (candidateIndex === index ? message : candidate)) });
  }

  function moveMessage(index: number, direction: -1 | 1): void {
    const profile = state.promptProfiles.find((candidate) => candidate.id === selectedProfileId);
    if (!profile) return;
    const next = [...profile.messages];
    const target = index + direction;
    [next[index], next[target]] = [next[target], next[index]];
    updateSelectedProfile({ messages: next });
  }

  function deleteMessage(index: number): void {
    const profile = state.promptProfiles.find((candidate) => candidate.id === selectedProfileId);
    if (!profile || profile.messages.length === 1) return;
    updateSelectedProfile({ messages: profile.messages.filter((_message, candidateIndex) => candidateIndex !== index) });
  }
}

function resolveSelectedProfileId(state: ExtensionState, purpose: ProfilePurpose, requestedId: string): string {
  const requested = state.promptProfiles.find((profile) => profile.id === requestedId && profile.purpose === purpose);
  return requested?.id ?? state.activeProfileByPurpose[purpose] ?? state.promptProfiles.find((profile) => profile.purpose === purpose)?.id ?? "";
}

function inputRow(labelText: string, value: string, onInput: (value: string) => void, type = "text"): HTMLElement {
  const label = document.createElement("label");
  label.textContent = labelText;
  const input = document.createElement("input");
  input.type = type;
  input.value = value;
  input.addEventListener("input", () => onInput(input.value));
  label.append(input);
  return label;
}

function selectRow(
  labelText: string,
  value: string,
  values: string[],
  onChange: (value: string) => void,
  labelForValue: (value: string) => string = (option) => option
): HTMLElement {
  const label = document.createElement("label");
  label.textContent = labelText;
  const select = document.createElement("select");
  select.replaceChildren(...values.map((option) => new Option(labelForValue(option), option)));
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  label.append(select);
  return label;
}

function textareaRow(labelText: string, value: string, onInput: (value: string) => void): HTMLElement {
  const label = document.createElement("label");
  label.textContent = labelText;
  const textarea = document.createElement("textarea");
  textarea.rows = 5;
  textarea.value = value;
  textarea.addEventListener("input", () => onInput(textarea.value));
  label.append(textarea);
  return label;
}

function actionButton(label: string, onClick: () => void, disabled = false): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener("click", onClick);
  return button;
}

function dangerButton(label: string, onClick: () => void, disabled = false): HTMLButtonElement {
  const button = actionButton(label, onClick, disabled);
  button.classList.add("danger");
  return button;
}

function row(children: HTMLElement[]): HTMLElement {
  const wrapper = element("div", "button-row");
  wrapper.append(...children);
  return wrapper;
}

function renderStatus(statusMessage: string): HTMLElement {
  const status = document.createElement("p");
  status.id = "status";
  status.role = "status";
  status.textContent = statusMessage;
  return status;
}

function sectionTitle(text: string): HTMLElement {
  const title = document.createElement("h2");
  title.textContent = text;
  return title;
}

function muted(text: string): HTMLElement {
  const paragraph = document.createElement("p");
  paragraph.className = "muted";
  paragraph.textContent = text;
  return paragraph;
}

function helpText(text: string): HTMLElement {
  const paragraph = document.createElement("p");
  paragraph.className = "muted";
  paragraph.textContent = text;
  return paragraph;
}

function errorText(text: string): HTMLElement {
  const paragraph = document.createElement("p");
  paragraph.className = "error";
  paragraph.textContent = text;
  return paragraph;
}

function element(tag: keyof HTMLElementTagNameMap, className: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function numberOrUndefined(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringValue(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

function purposeLabel(purpose: ProfilePurpose): string {
  if (purpose === "page") return "페이지 번역";
  if (purpose === "selection") return "선택 영역 번역";
  if (purpose === "image") return "이미지 번역";
  return "사전";
}

function roleLabel(role: string): string {
  if (role === "system") return "시스템";
  if (role === "user") return "사용자";
  return "어시스턴트";
}

function providerTypeLabel(type: string): string {
  if (type === "openai") return "OpenAI";
  if (type === "claude") return "Claude";
  if (type === "gemini") return "Gemini";
  if (type === "ollama-local") return "Ollama 로컬";
  if (type === "ollama-cloud") return "Ollama 클라우드 API";
  return "Custom OpenAI 호환";
}

function reasoningEffortLabel(value: string): string {
  if (value === "minimal") return "최소";
  if (value === "low") return "낮음";
  if (value === "medium") return "보통";
  return "높음";
}

function selectionResultDisplayModeLabel(value: string): string {
  return value === "bubble" ? "하단 번역창" : "사이드바";
}
