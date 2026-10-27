# Building QuietRead from source

These instructions are for contributors. End users can download prebuilt apps from the [README](../README.md).

## macOS

On an Apple silicon Mac with macOS 15 or later, install the Xcode command-line tools or Xcode, and Python 3. From the project root:

```sh
python3 scripts/build.py
```

This produces `build/QuietRead.app` and `build/QuietRead.html`. `python3 scripts/build.py --help` lists build options, including the application name, bundle identifier, output and storage directories. The default bundle identifier is a placeholder; use an identifier you control for your own distribution.

## Windows

On 64-bit Windows, install Python 3 and the .NET 8 SDK. Generate the shared interface and publish the Windows app from the project root:

```powershell
python scripts/make_web.py
dotnet publish src/windows/QuietRead.csproj -c Release -r win-x64 --self-contained true -o build/windows
```

Open `build/windows/QuietRead.exe`. Keep the published files together. The Windows app requires the WebView2 Runtime, and the self-contained output includes .NET. On first build the SDK restores the WebView2 NuGet package.

## Tests

JavaScript tests require Node.js. Swift storage tests run on macOS with Xcode command-line tools:

```sh
node tests/engine.test.cjs
node tests/storage.test.cjs
python3 tests/theme_contrast.test.py
xcrun swiftc src/mac/Store.swift tests/StoreTests.swift -o /tmp/quietread-store-tests
/tmp/quietread-store-tests
```

The scrolling test uses accelerated simulation; it is not a real-time 30-minute recording test. The Windows GitHub Actions workflow also builds the application and runs a startup and WebView storage smoke test.
