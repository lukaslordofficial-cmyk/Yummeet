import { PlanEditor } from "@/src/components/meetings/PlanEditor";
import type { PlanItem } from "@/src/lib/meetingPlan";

export type DraftAttraction = PlanItem;

/** Plan spotkania przy tworzeniu wydarzenia, zanim powstanie wiersz w bazie. */
export function AttractionPicker({
  picked,
  onChange,
  seats,
  scrollRef,
  scrollOffsetRef,
  testID = "attraction-picker",
}: {
  picked: DraftAttraction[];
  onChange: (next: DraftAttraction[]) => void;
  seats?: number;
  scrollRef?: { current: { scrollTo: (options: { y: number; animated?: boolean }) => void } | null };
  scrollOffsetRef?: { current: number };
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
      scrollRef={scrollRef}
      scrollOffsetRef={scrollOffsetRef}
    />
  );
}
