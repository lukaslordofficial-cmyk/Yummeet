import { rpc } from "@/src/lib/api";

export type StoryLine = {
  id: string;
  body: string;
  author_id: string;
  author: string;
  created_at: string;
};

export type StoryBoard = {
  closed: boolean;
  your_turn: boolean;
  turn_user_id: string | null;
  turn_name: string | null;
  left?: boolean;
  left_count?: number;
  member_count?: number;
  majority_left?: boolean;
  end_yes?: number;
  end_no?: number;
  my_end_vote?: boolean | null;
  restart_yes?: number;
  restart_no?: number;
  my_restart_vote?: boolean | null;
  lines: StoryLine[];
};

export const eventStoryBoard = (eventId: string) => rpc<StoryBoard>("event_story_board", { p_event: eventId });
export const eventStoryAdd = (eventId: string, body: string) => rpc<string>("event_story_add", { p_event: eventId, p_body: body });

/** Organizator dokłada kolejne zdanie startowe także wtedy, gdy tura należy do kogoś innego. */
export async function eventStoryDrawLine(eventId: string, body: string) {
  try {
    return await rpc<string>("event_story_draw_line", { p_event: eventId, p_body: body });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!/event_story_draw_line|schema cache|could not find/i.test(message)) throw error;
    return eventStoryAdd(eventId, body);
  }
}
export const eventStoryClose = (eventId: string) => rpc<void>("event_story_close", { p_event: eventId });
export const eventStoryLeave = (eventId: string) => rpc<StoryBoard>("event_story_leave", { p_event: eventId });
export const eventStoryVote = (eventId: string, kind: "end" | "restart", want: boolean) =>
  rpc<StoryBoard>("event_story_vote", { p_event: eventId, p_kind: kind, p_want: want });
export const eventStoryRestart = (eventId: string) => rpc<StoryBoard>("event_story_restart", { p_event: eventId });
