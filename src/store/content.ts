/**
 * Questions, answers and images come from the server on every request (no
 * copy is kept on the device), so a fix to a question bank reaches every
 * student as soon as it is deployed. The app needs a connection to practise.
 */
import { create } from "zustand";
import type { Catalog, CheckResponse, QuestionsResponse } from "../content/api";
import type { AnyResponse, ClientQuestion, SubjectId } from "../content/schema";
import { ROUND_SIZE } from "../engine/scoring";
import { api } from "./auth";

interface ContentState {
  catalog: Catalog | null;
  /** `failed`: the catalog could not be loaded (usually offline). */
  status: "loading" | "ready" | "failed";
  load: () => Promise<void>;
}

export const useContent = create<ContentState>()((set, get) => ({
  catalog: null,
  status: "loading",
  load: async () => {
    // A reload once the chapters are showing (e.g. when the connection comes back) keeps them on screen.
    if (!get().catalog) set({ status: "loading" });
    try {
      set({ catalog: await api<Catalog>("/api/catalog"), status: "ready" });
    } catch {
      if (!get().catalog) set({ status: "failed" });
    }
  },
}));

/** Where a new round's questions come from. */
export type RoundSource =
  | { chapter: string }
  | { subjects: SubjectId[]; grades: number[] }
  /** These exact questions (retry, challenge); `fallback` if any were removed since. */
  | { ids: string[]; fallback?: RoundSource };

/** Questions by ID, in order. `reveal`: IDs already answered in round `roundId`, sent with their answer keys. */
export function fetchQuestions(ids: string[], reveal: string[] = [], roundId?: string): Promise<QuestionsResponse> {
  const q = new URLSearchParams({ ids: ids.join(",") });
  if (reveal.length) q.set("reveal", reveal.join(","));
  if (roundId) q.set("round", roundId);
  return api<QuestionsResponse>(`/api/questions?${q}`);
}

/** A new round's questions, drawn at random on the server. */
export async function fetchRound(source: RoundSource, count = ROUND_SIZE): Promise<ClientQuestion[]> {
  if ("ids" in source) {
    const { questions, missing } = await fetchQuestions(source.ids);
    return missing.length && source.fallback ? fetchRound(source.fallback, source.ids.length) : questions;
  }
  const q = new URLSearchParams({ count: String(count) });
  if ("chapter" in source) q.set("chapter", source.chapter);
  if ("subjects" in source) {
    if (source.subjects.length) q.set("subjects", source.subjects.join(","));
    if (source.grades.length) q.set("grades", source.grades.join(","));
  }
  return (await api<QuestionsResponse>(`/api/questions?${q}`)).questions;
}

/** Grades an answer on the server; `undefined` is a skip. Returns the answer key either way. */
export function checkAnswer(roundId: string, questionId: string, response: AnyResponse | undefined): Promise<CheckResponse> {
  return api<CheckResponse>("/api/answers/check", { roundId, questionId, response: response ?? null });
}
