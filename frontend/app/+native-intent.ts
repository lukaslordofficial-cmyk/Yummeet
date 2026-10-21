/** Przekieruj share intent z systemu na formularz nowego pinu. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const url = path.includes("://") ? new URL(path) : new URL(path, "yummeet://");
    if (url.hostname === "expo-sharing" || path.includes("expo-sharing")) {
      return "/pin/new?fromShare=1";
    }
  } catch {
    /* leave path as-is */
  }
  return path;
}
