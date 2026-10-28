// Gets the save file out of the app through the browser: the share sheet
// (a download where files can't be shared, e.g. desktop or Android Chrome,
// which won't share .json). Import is a plain file input in AppMenu. These
// are the parts to swap for Capacitor's Share/Filesystem plugins in the
// native app; the file itself is built and applied in store/saveFile.

import { buildSaveFile, saveFileName } from '../store/saveFile';

/** Exports the save. False if the player closed the share sheet without sharing. */
export async function exportSaveFile(): Promise<boolean> {
  const file = new File([buildSaveFile()], saveFileName(), { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (error) {
      if ((error as DOMException).name === 'AbortError') return false;
      // Any other share failure falls through to a plain download.
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
