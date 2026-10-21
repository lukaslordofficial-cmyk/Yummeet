import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { DishBoard } from "@/src/components/meetings/DishBoard";
import { DishRateForm } from "@/src/components/meetings/DishRateForm";
import { Body, Button, Card, Field, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import type { DishScores } from "@/src/lib/dishMath";
import { eventAddDish, eventDishBoard, saveDishRating, type DishSummary } from "@/src/lib/meetingData";
import { spacing } from "@/src/theme";

export function EventDishSection({ eventId, canRate, canEdit }: { eventId: string; canRate: boolean; canEdit: boolean }) {
  const toast = useToast();
  const [rows, setRows] = useState<DishSummary[]>([]);
  const [rating, setRating] = useState<DishSummary | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setRows(await eventDishBoard(eventId)); } catch { setRows([]); }
  }, [eventId]);
  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    if (name.trim().length < 1) return toast("Podaj nazwę dania", "error");
    setBusy(true);
    try {
      await eventAddDish(eventId, name.trim(), description.trim());
      setName(""); setDescription("");
      toast("Danie dodane", "success");
      await load();
    } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };

  const save = async (scores: DishScores, note: string) => {
    if (!rating?.dish_id) return;
    setBusy(true);
    try {
      await saveDishRating(rating.dish_id, scores, note);
      toast("Karta dania zapisana", "success");
      setRating(null);
      await load();
    } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };

  return (
    <Card testID="event-dishes">
      <Title size={18}>Ocenione potrawy</Title>
      <Body muted>Średnia dania jest z kart uczestników. Zwykła ocena lokalu na pinie zostaje osobno.</Body>
      <DishBoard rows={rows} onRate={canRate ? setRating : undefined} />
      {rating ? (
        <DishRateForm
          dishName={rating.name}
          busy={busy}
          initial={{
            taste: rating.my_taste, look: rating.my_look, texture: rating.my_texture, aroma: rating.my_aroma,
            composition: rating.my_composition, technique: rating.my_technique, value: rating.my_value, note: rating.my_note,
          }}
          onSave={(scores, note) => void save(scores, note)}
        />
      ) : null}
      {canEdit ? (
        <View style={{ gap: spacing.sm }}>
          <Field testID="event-dish-name" label="Nowe danie" value={name} onChangeText={setName} placeholder="np. tatar z łososia" />
          <Field testID="event-dish-desc" label="Opis dania" value={description} onChangeText={setDescription} placeholder="Skład, porcja, cena jeśli znacie" />
          <Button testID="event-dish-add" title="Dodaj danie do karty" variant="secondary" loading={busy} onPress={() => void add()} />
        </View>
      ) : null}
    </Card>
  );
}
