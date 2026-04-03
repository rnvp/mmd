# MMD

- `MMD` currently stands for `Micro md editor`.

- This project exists because I could not find a Markdown editor that felt right to me. So I decided to build another wheel.

- I want it to be simple.
- I want it to be fast.
- I want it to avoid complex features.
- I want it to use a two-pane layout by default.
- I want it to handle text cleanly, without encoding issues.

## Preview

![MMD editor screenshot](preview.png)

## Features

- Fast desktop startup with a lightweight workflow
- Split view by default for simultaneous editing and preview
- Built around local files with direct open and save support for Markdown and text documents
- UTF-8 read and write support to avoid encoding problems
- Common Markdown formatting actions to reduce repetitive typing
- Supports drag-and-drop opening and opening associated files by double-clicking
- Light and dark themes for long editing sessions

## Use Cases

- Markdown notes and documentation writing
- Prompt, system prompt, and agent configuration editing
- Command snippets, scripts, and development notes
- Local knowledge bases and lightweight drafting

## Tech Stack

- `Tauri`
- `React`
- `TypeScript`
- `Vite`

## Development

```powershell
npm install
npm run tauri dev
```

## Build

```powershell
npm run build
```

## License

Licensed under the Apache License, Version 2.0. See `LICENSE` for details.
