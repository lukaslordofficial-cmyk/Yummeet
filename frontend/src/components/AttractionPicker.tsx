import { PlanEditor } from "@/src/components/meetings/PlanEditor";
import type { PlanItem } from "@/src/lib/meetingPlan";

export type DraftAttraction = PlanItem;

/** Plan spotkania przy tworzeniu wydarzenia, zanim powstanie wiersz w bazie. */
export function AttractionPicker({
  picked,
  onChange,
  seats,
  onScrollHold,
  onScrollShift,
  testID = "attraction-picker",
}: {
  picked: DraftAttraction[];
  onChange: (next: DraftAttraction[]) => void;
  seats?: number;
  onScrollHold?: () => void;
  onScrollShift?: (delta: number) => void;
  testID?: string;
}) {
  return (
    <PlanEditor
      testID={testID}
      items={picked}
      onChange={onChange}
      canEdit
      play={false}
      seats={seats}
      onScrollHold={onScrollHold}
      onScrollShift={onScrollShift}
    />
  );
}
