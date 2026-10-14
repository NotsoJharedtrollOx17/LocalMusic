# Adapt Sound onboarding revision - 13 October 2026

## Reference and intent

Review the supplied Samsung recording (190 seconds) and Windows recording (89 seconds), including the voiceover. Keep the app's orange/charcoal palette, typography and rounded-square controls. Work on the current `dev.ui-ux-polish` branch; preserve release branches and reference files.

The Samsung recording shows an introductory preparation screen, a stable two-channel graphic, automatic tones, a listening/question state, progress and fixed No/Yes actions, followed by a named profile and preview. Our recording shows long preparation copy, manual playback before most answers, oversized frequency text, technical levels and two large slider banks that force scrolling.

Local voiceover was transcribed with a local speech model. The Windows narration asks for shorter/centered copy and questions repeated attempts after Not heard (about 45–80 seconds). Samsung narration highlights the compact channel diagrams and repeating beeps until Yes/No (about 35–100 seconds). The recording's preferred-ear-for-calls popup is explicitly excluded by the voiceover. Transcripts and review images remain ignored diagnostic artifacts.

## Implementation

- Present preparation as three short steps: headphones, quiet surroundings, comfortable steady volume. Explain that music pauses during setup and the result is a personal music balance.
- Start the first tone after Begin. Advance automatically after both answers and retry, respecting the backend's tone timing and silence interval. Replay remains available; never treat lack of an answer as Not heard.
- Repeat the same bounded tone burst while awaiting a response, with 1.5 seconds silence between bursts. A response during playback is acknowledged immediately and sent when that burst ends; cancellation clears both scheduled answers and repeats. Keep the existing level-based derivation pending clarification of the voiceover's one-attempt preference. A single unheard response cannot establish a gain; do not invent one.
- Keep one compact two-channel gain graphic above the question, real completed-step progress and fixed No/Yes actions. Display actual derived gains with zero baseline, never hearing-quality scores or invented sensitivity values. Keep detailed gain/frequency/level information accessible without dominating the task.
- Replace provisional setup sliders with this compact read-only graphic. Retain the saved-profile EQ sliders and independent channel processing. Make listening, awaiting answer, preparing next tone, retry, interrupted, compare and saved states explicit.
- Comparison uses the existing original sample and matched loudness. Provide a sensible default profile name, clear Save/Done actions and unchanged full-strength personal priority. Describe flat/unknown results truthfully.
- Extract the setup controller and individual screens into focused modules, one component per TSX file. Preserve queue/position, pause-on-exit, bounded tones, lease/blur/visibility/output cancellation, no setup history and backend-owned rules.

Samsung's age presets, hearing-test claims, calls settings, proprietary curves and system volume controls are outside this music-player revision.

## Verification

Check automatic progression for both answers, replay, bounded retries, both ears, save/activation/persistence, interruption and no listening-history entries. Check narrow/short screens, EN/ES, dark/light, keyboard/focus, Back and Reduce Motion. Run frontend/browser checks, rebuild and inspect Windows, and record evidence in `docs/verification.md`. Android runtime and physical-headphone acceptance require separate evidence.
