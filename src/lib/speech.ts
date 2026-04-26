// Cross-platform speech helper. Mobile browsers (iOS Safari, some Android
// Chrome variants) require speechSynthesis to be triggered by a user gesture.
// If the first .speak() call happens inside an async setTimeout chain, it is
// silently dropped. To work around this we "unlock" the engine synchronously
// during the user gesture by speaking an empty utterance, then queue the real
// utterance later.

let unlocked = false;

function getSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null;
  return window.speechSynthesis ?? null;
}

/** Call from a user gesture (click/tap) to unlock speech on mobile. */
export function unlockSpeech() {
  const synth = getSynth();
  if (!synth || unlocked) return;
  try {
    // Some iOS versions need resume() after a previous pause/cancel.
    synth.cancel();
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0;
    u.rate = 1;
    synth.speak(u);
    synth.resume();
    unlocked = true;
  } catch {
    // ignore
  }
}

/** Speak a name out loud. Safe to call from async contexts after unlockSpeech(). */
export function speak(text: string, lang = 'zh-CN', rate = 0.9) {
  const synth = getSynth();
  if (!synth || !text) return;
  try {
    // Cancel queued items so a new pick replaces the previous announcement.
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = rate;
    utter.volume = 1;
    // iOS sometimes needs a tick before the next speak() after cancel().
    setTimeout(() => {
      try {
        synth.speak(utter);
        synth.resume();
      } catch {
        // ignore
      }
    }, 30);
  } catch {
    // ignore
  }
}
