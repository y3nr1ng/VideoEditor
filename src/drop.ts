export const RESOURCE_DRAG_TYPE = "application/localcut-resource";
export function droppedFiles(
  transfer: Pick<DataTransfer, "files" | "items">,
): File[] {
  const files = Array.from(transfer.files ?? []);
  if (files.length) return files;
  return Array.from(transfer.items ?? [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
}
export function acceptsDrop(types: readonly string[]) {
  return types.includes("Files") || types.includes(RESOURCE_DRAG_TYPE);
}
export function waitForMedia(
  media: HTMLMediaElement,
  event: "loadedmetadata" | "loadeddata" | "seeked",
  start: () => void,
  timeout = 15000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const clean = () => {
      clearTimeout(timer);
      media.removeEventListener(event, done);
      media.removeEventListener("error", fail);
    };
    const done = () => {
      clean();
      resolve();
    };
    const fail = () => {
      clean();
      reject(new Error("Unsupported browser codec"));
    };
    media.addEventListener(event, done, { once: true });
    media.addEventListener("error", fail, { once: true });
    timer = setTimeout(() => {
      clean();
      reject(new Error("Media loading timed out"));
    }, timeout);
    try {
      start();
    } catch (e) {
      clean();
      reject(e);
    }
  });
}
