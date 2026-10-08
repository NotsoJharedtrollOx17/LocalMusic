# Third-party notices

Application code is MIT. Reference mockups remain design inputs and are not redistributed as application album art. Sample audio and geometric artwork are original code-generated assets.

Direct runtime dependencies:

- React / React DOM: MIT
- Tauri / Tauri dialog: MIT or Apache-2.0
- Lucide icons: ISC
- music-metadata: MIT
- Inter and Space Grotesk fonts: SIL Open Font License 1.1
- serde / serde_json / chrono / uuid / image / base64 / blake3: see their locked crate license metadata
- rusqlite: MIT; bundled SQLite is public domain
- chrono-tz and unicode-normalization: MIT or Apache-2.0
- Rodio and Lofty: MIT or Apache-2.0
- walkdir: MIT or Unlicense
- AndroidX Media3, Core and DocumentFile: Apache-2.0

Build tools include Rust, npm/Vite/TypeScript, Vitest, Playwright, the Android SDK/NDK and a Java development kit. Their development licenses are separate from the application's MIT license.

No GPL/AGPL source from the guide's reference applications has been transplanted. Preserve dependency notices when packaging. The package-lock.json and Cargo.lock files identify exact resolved versions; review their transitive license metadata before public distribution.

- TanStack Virtual: MIT.
