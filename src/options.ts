import "./styles.css";
import { normalizeState } from "./shared/storage";
import { validatePromptMessages } from "./options/promptValidation";
import { mountOptionsApp } from "./options/dom";
import type { BackgroundResponse } from "./shared/types";

void initialize();

async function initialize(): Promise<void> {
  const root = document.querySelector<HTMLElement>("#optionsApp");
  if (!root) throw new Error("Options root element is missing.");
  const response = (await chrome.runtime.sendMessage({ type: "getState" })) as BackgroundResponse;
  const app = mountOptionsApp(root, response.ok && response.state ? response.state : normalizeState(), {
    async onSave(state) {
      for (const profile of state.promptProfiles) {
        const validation = validatePromptMessages(profile.purpose, profile.messages);
        if (validation) throw new Error(`${profile.name}: ${validation}`);
      }
      const saveResponse = (await chrome.runtime.sendMessage({ type: "saveState", state })) as BackgroundResponse;
      if (!saveResponse.ok) throw new Error(saveResponse.error);
      return saveResponse.state;
    },
    async onDeleteDictionaryEntry(id, state) {
      const deleteResponse = (await chrome.runtime.sendMessage({ type: "deleteDictionaryEntry", id })) as BackgroundResponse;
      if (!deleteResponse.ok) throw new Error(deleteResponse.error);
      return deleteResponse.state ?? { ...state, dictionaryEntries: state.dictionaryEntries.filter((entry) => entry.id !== id) };
    }
  });
}
