import type { AnyResponse, Question } from "../content/schema";
import { AssertionReasonQuestion, McqQuestion, MultiQuestion } from "./ChoiceQuestions";
import { HotspotQuestion } from "./HotspotQuestion";
import { MatchQuestion } from "./MatchQuestion";
import { NumericQuestion } from "./NumericQuestion";
import { OrderQuestion } from "./OrderQuestion";

/** Picks the interactive renderer for a question's type. */
export function QuestionBody({
  q,
  response,
  onChange,
  reveal,
}: {
  q: Question;
  response: AnyResponse | undefined;
  onChange: (r: AnyResponse) => void;
  reveal: boolean;
}) {
  const p = { onChange, reveal } as const;
  switch (q.type) {
    case "mcq":
      return <McqQuestion q={q} response={response as string | undefined} {...p} />;
    case "multi":
      return <MultiQuestion q={q} response={response as string[] | undefined} {...p} />;
    case "numeric":
      return <NumericQuestion q={q} response={response as string | undefined} {...p} />;
    case "assertion_reason":
      return <AssertionReasonQuestion q={q} response={response as string | undefined} {...p} />;
    case "match":
      return <MatchQuestion q={q} response={response as Record<string, string> | undefined} {...p} />;
    case "order":
      return <OrderQuestion q={q} response={response as string[] | undefined} {...p} />;
    case "hotspot":
      return <HotspotQuestion q={q} response={response as string | undefined} {...p} />;
  }
}

export const TYPE_LABEL: Record<Question["type"], string> = {
  mcq: "Multiple choice",
  multi: "Multiple select",
  numeric: "Numerical",
  assertion_reason: "Assertion & Reason",
  match: "Match the following",
  order: "Arrange in order",
  hotspot: "Tap the diagram",
};
