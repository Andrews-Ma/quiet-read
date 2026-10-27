# QuietRead

English | [简体中文](README.zh-CN.md)

QuietRead is a small, offline teleprompter for reading scripts on macOS and Windows. It scrolls text at an adjustable estimated speed, remembers each script's position locally, and supports English and Simplified Chinese. New installations start in English; use **Settings → Language → 中文** to switch languages.

## See it in action

These short, silent demonstrations show the actual QuietRead interface running in a browser with original example scripts. The desktop apps use the same reading interface.

**English**

![QuietRead scrolling an English sample script](docs/media/demo-en.gif)

**中文**

![轻读提词器滚动中文示例稿件](docs/media/demo-zh.gif)

## Features

- Import UTF-8 TXT or Markdown, or paste text directly.
- Choose a custom range from 1 to 1000 characters per minute. Six buttons include both endpoints at equal intervals; a range such as 100–300 produces 100, 140, 180, 220, 260 and 300.
- Navigate by paragraph, section or progress bar. Configure font size, a silent countdown and a reading-focused view.
- Save recent scripts, reading positions and settings locally; retain a previous valid progress file and report storage errors.
- Run without a network service, account or microphone permission. This is a teleprompter; it does not record audio or follow speech.

The bundled welcome script is a short synthetic example. Imported scripts and reading positions are not included in the source tree.

## Download and install

- **macOS:** [Download for Apple silicon](https://github.com/Andrews-Ma/quiet-read/releases/tag/v3.2.0). Requires macOS 15 or later. Unzip the download and move `QuietRead.app` to Applications.
- **Windows:** [Download for Windows x64](https://github.com/Andrews-Ma/quiet-read/releases/tag/v3.2.0-windows). Requires 64-bit Windows 10 or 11 and the [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/). Extract the entire ZIP into a folder and open `QuietRead.exe` there; keep the accompanying files together. Windows SmartScreen may show a warning for the download.

The downloaded apps run without Xcode, Python or Node.js. The Windows package includes the .NET runtime; it uses WebView2 for the reading interface.

## Building and testing from source

These steps are for developers who want to modify or build the application; they are not needed to use the downloads above. See [BUILDING.md](docs/BUILDING.md) for platform-specific build requirements, commands and tests.

## Using scripts

TXT is split at blank lines and special characters are retained. For Markdown, headings provide section navigation and are not spoken. Fenced block markers are hidden but their contents remain. The interface warns about these transformations. A pair of `<!-- CONTENT START -->` and `<!-- CONTENT END -->` markers limits the imported portion; older Chinese-language content markers are also supported. Check the imported script before recording.

Progress is saved about every two seconds while scrolling, and after navigation or setting changes. A sudden interruption can lose the latest unsaved position. The macOS app keeps its data under `~/Library/Application Support/QuietRead/Data/`; the Windows app uses its WebView2 profile under `%LOCALAPPDATA%/QuietRead/`. The browser version uses that browser’s separate local storage. The app does not encrypt these files itself. Keep your source scripts backed up independently.

## Project layout

- `src/web/`: presentation, translations, parsing, scrolling and browser/native storage bridge.
- `src/mac/`: native macOS window, menus, file picker and local storage.
- `src/windows/`: Windows desktop host using WebView2.
- `assets/icon.png`: application icon.
- `scripts/`: build tools for the shared interface and macOS app.
- `tests/`: synthetic tests with no personal scripts.

The icon was created with an image-generation tool and edited by direction. The repository copy contains only the image data needed for the icon; auxiliary embedded metadata was removed.

## License

QuietRead is available under the [MIT License](LICENSE). See [PUBLISHING.md](PUBLISHING.md) for guidance on privacy and distributing builds.
