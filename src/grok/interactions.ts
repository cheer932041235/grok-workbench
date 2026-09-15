export interface Question {
  question: string;
  options: { label: string; description: string; preview?: string }[];
  multiSelect?: boolean;
}

export interface Interaction {
  id: number | string;
  kind: "question" | "plan";
  questions?: Question[];
  mode?: string;
  planContent?: string;
}

/** Grok's accepted response uses question text as keys and option labels as values. */
export function questionResponse(questions: Question[], selected: string[][], notes: string[]) {
  const answers: Record<string, string[]> = {};
  const annotations: Record<string, { preview?: string; notes?: string }> = {};
  questions.forEach((question, i) => {
    const labels = selected[i] ?? [];
    const note = notes[i]?.trim();
    if (!labels.length && !note) return;
    answers[question.question] = labels.length ? labels : ["Other"];
    const preview =
      labels.length === 1
        ? question.options.find((option) => option.label === labels[0])?.preview
        : undefined;
    if (note || preview)
      annotations[question.question] = {
        ...(note ? { notes: note } : {}),
        ...(preview ? { preview } : {}),
      };
  });
  return {
    outcome: "accepted",
    answers,
    ...(Object.keys(annotations).length ? { annotations } : {}),
  };
}
