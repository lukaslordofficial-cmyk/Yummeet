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
