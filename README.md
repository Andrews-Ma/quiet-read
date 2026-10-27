# QuietRead

English | [简体中文](README.zh-CN.md)

QuietRead is a small, offline teleprompter for reading scripts from a Mac. It scrolls text at an adjustable estimated speed, remembers each script's position locally, and supports English and Simplified Chinese. New installations start in English; use **Settings → Language → 中文** to switch languages.

## See it in action

These short, silent demonstrations show the actual QuietRead interface running in a browser with original example scripts. The native macOS app uses the same reading interface.

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

## Download for macOS

An [Download for Apple silicon](https://github.com/Andrews-Ma/quiet-read/releases/tag/v3.2.0) is available for macOS 15 or later. Unzip the archive and move `QuietRead.app` to Applications. Gatekeeper may block the downloaded app. See the release notes and [Apple’s guidance](https://support.apple.com/102445). A browser version can be built from source as described below.

## Requirements

- Apple silicon Mac, macOS 15 or later.
- Xcode or the Xcode command-line tools for building the native app.
- Python 3 for the build script; Node.js is needed only for JavaScript tests.

## Build

From this directory, run:

```sh
python3 scripts/build.py
```

The script creates `build/QuietRead.app` and `build/QuietRead.html`; it does not install the application. Open the app from Finder, or open the HTML file in a browser. An existing build directory is replaced only if it contains the tool's generated marker. The app is locally ad-hoc signed; distribution on other Macs may require appropriate Apple signing and notarization.

`python3 scripts/build.py --help` lists optional settings for an isolated build, bundle identifier, application name and storage directory. The defaults use a generic example bundle identifier. Set an identifier you control before distributing your own build.

## Tests

```sh
node tests/engine.test.cjs
node tests/storage.test.cjs
xcrun swiftc src/mac/Store.swift tests/StoreTests.swift -o /tmp/quietread-store-tests
/tmp/quietread-store-tests
```

The scrolling test uses accelerated simulation; it does not claim a real-time 30-minute recording test.

## Using scripts

TXT is split at blank lines and special characters are retained. For Markdown, headings provide section navigation and are not spoken. Fenced block markers are hidden but their contents remain. The interface warns about these transformations. A pair of `<!-- CONTENT START -->` and `<!-- CONTENT END -->` markers limits the imported portion; older Chinese-language content markers are also supported. Check the imported script before recording.

Progress is saved about every two seconds while scrolling, and after navigation or setting changes. A sudden interruption can lose the latest unsaved position. The native app keeps its default local data under `~/Library/Application Support/QuietRead/Data/`; the browser version uses that browser's local storage. The two stores are separate, and the app does not encrypt the files itself. Keep your source scripts backed up independently.

## Project layout

- `src/web/`: presentation, translations, parsing, scrolling and browser/native storage bridge.
- `src/mac/`: native window, menus, file picker and local storage.
- `assets/icon.png`: application icon.
- `scripts/build.py`: offline app builder.
- `tests/`: synthetic tests with no personal scripts.

The icon was created with an image-generation tool and edited by direction. The repository copy contains only the image data needed for the icon; auxiliary embedded metadata was removed.

## License

QuietRead is available under the [MIT License](LICENSE). See [PUBLISHING.md](PUBLISHING.md) for guidance on privacy and distributing builds.
