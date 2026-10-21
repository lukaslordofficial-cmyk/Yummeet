/** Ścieżka otwartego formularza pinu, żeby udostępniony link nie wyrzucał z edycji. */
let path: string | null = null;

export function setActivePinForm(next: string | null) {
  path = next;
}

export function activePinForm(): string | null {
  return path;
}
