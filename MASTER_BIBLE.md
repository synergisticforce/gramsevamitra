# GramSevaMitra Master Execution Bible
A Deterministic, Phased Blueprint for Cursor Development

## Part I: Core Architecture
- **Framework:** React / Astro / Tailwind CSS
- **Native Mobile Shell:** Capacitor (Android focus)
- **Document Engine:** `@capacitor-mlkit/document-scanner`
- **Image Engine:** Canvas API + `@capacitor-community/image-manipulator` + `@capawesome/capacitor-photo-manipulator`
- **Video Engine:** `@whiteguru/capacitor-plugin-video-editor`
- **Local Storage:** IndexedDB / OPFS (Desktop PWA) + Capacitor Filesystem (Mobile Native)

## Part II: Folder Structure (Platform Isolation)
```text
src/
├── shared/
│   ├── components/      (buttons, cards, inputs)
│   ├── hooks/           (usePlatform.ts)
│   ├── services/        (LocalVaultService.ts)
│   └── types/
├── desktop/
│   ├── layouts/         (sidebar, top nav, wide tables)
│   └── views/           (PWA dashboard)
└── mobile/
    ├── layouts/         (bottom nav, fullscreen camera)
    └── views/
        ├── DocumentStudio/
        ├── ImageStudio/
        └── VideoStudio/