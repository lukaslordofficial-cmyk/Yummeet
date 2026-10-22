import { PlanEditor } from "@/src/components/meetings/PlanEditor";
import type { PlanItem } from "@/src/lib/meetingPlan";

export type DraftAttraction = PlanItem;

/** Plan spotkania przy tworzeniu wydarzenia, zanim powstanie wiersz w bazie. */
export function AttractionPicker({
  picked,
  onChange,
  testID = "attraction-picker",
}: {
  picked: DraftAttraction[];
  onChange: (next: DraftAttraction[]) => void;
  testID?: string;
}) {
  return <PlanEditor testID={testID} items={picked} onChange={onChange} canEdit play={false} noteCommit="instant" />;
}
