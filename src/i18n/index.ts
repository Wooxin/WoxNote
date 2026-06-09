import type { Language } from "../types";
import zh from "./zh";
import en from "./en";

const messages = { zh, en } satisfies Record<Language, Record<string, string>>;

export { messages };
export type Messages = (typeof messages)[Language];