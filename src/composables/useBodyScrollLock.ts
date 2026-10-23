// Stops the page behind an open Modal from scrolling. Ref-counted because
// modals can stack (e.g. an item drop over another popup); the body is only
// unlocked once the last one releases.

let locks = 0;
let previousOverflow = '';

/** Locks body scroll and returns a release function (safe to call twice). */
export function lockBodyScroll(): () => void {
  if (locks === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  locks++;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks--;
    if (locks === 0) document.body.style.overflow = previousOverflow;
  };
}
