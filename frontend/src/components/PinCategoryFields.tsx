import { useState } from "react";
import { View } from "react-native";

import { Body, Button, Chip, ChipRow, Field, Title } from "@/src/components/ui";
import { CUISINES, customCuisineKey } from "@/src/lib/cuisines";
import { spacing } from "@/src/theme";

/** Kategoria kuchni (w tym własna) + zakres cen dań w PLN. */
export function PinCategoryFields({
  cuisine,
  onCuisine,
  priceMin,
  priceMax,
  onPriceMin,
  onPriceMax,
}: {
  cuisine: string | null;
  onCuisine: (key: string | null) => void;
  priceMin: string;
  priceMax: string;
  onPriceMin: (v: string) => void;
  onPriceMax: (v: string) => void;
}) {
  const [custom, setCustom] = useState("");
  const preset = CUISINES.filter((c) => c.key);
  const isCustom = cuisine != null && !preset.some((c) => c.key === cuisine);

  return (
    <View style={{ gap: spacing.sm }} testID="pin-category-fields">
      <Title size={16}>Kategoria kuchni</Title>
      <Body muted>Wybierz typ lokalu albo dodaj własną kategorię.</Body>
      <ChipRow>
        {preset.map((c) => (
          <Chip
            key={c.key!}
            testID={`new-pin-cuisine-${c.key}`}
            label={c.label}
            selected={cuisine === c.key}
            onPress={() => onCuisine(cuisine === c.key ? null : c.key)}
          />
        ))}
      </ChipRow>
      <Field
        testID="new-pin-cuisine-custom"
        label="Własna kategoria (jeśli brak na liście)"
        value={isCustom ? cuisine ?? custom : custom}
        onChangeText={(t) => {
          setCustom(t);
          if (t.trim().length >= 2) onCuisine(customCuisineKey(t));
        }}
        placeholder="np. gruzińska, ramen, brunch…"
      />
      {isCustom ? <Body muted>Zapisane jako: {cuisine}</Body> : null}

      <Title size={16}>Zakres cen dań (PLN)</Title>
      <Body muted>Od najtańszej pozycji w menu do najdroższej.</Body>
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Field testID="new-pin-price-min" label="Od (zł)" value={priceMin} onChangeText={onPriceMin} keyboardType="number-pad" placeholder="np. 18" />
        </View>
        <View style={{ flex: 1 }}>
          <Field testID="new-pin-price-max" label="Do (zł)" value={priceMax} onChangeText={onPriceMax} keyboardType="number-pad" placeholder="np. 89" />
        </View>
      </View>
      {priceMin && priceMax ? (
        <Button
          testID="new-pin-price-clear"
          title="Wyczyść ceny"
          variant="ghost"
          onPress={() => { onPriceMin(""); onPriceMax(""); }}
        />
      ) : null}
    </View>
  );
}
