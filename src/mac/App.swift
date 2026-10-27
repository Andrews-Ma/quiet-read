import Cocoa
import WebKit
import UniformTypeIdentifiers

final class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler, NSWindowDelegate {
    private var window: NSWindow!
    private var web: WKWebView!
    private var store: QuietStore!
    private var language = "en"

    private func tr(_ english: String, _ chinese: String) -> String {
        language == "zh" ? chinese : english
    }
    private func errorMessage(_ error: Error) -> String {
        (error as? QuietStoreError)?.message(language: language) ?? error.localizedDescription
    }
    func applicationDidFinishLaunching(_ notification: Notification) {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let configured = Bundle.main.object(forInfoDictionaryKey: "QuietReadStorageDirectory") as? String ?? "QuietRead/Data"
        let parts = configured.split(separator: "/")
        let safe = !configured.hasPrefix("/") && !parts.isEmpty && !parts.contains("..") && !parts.contains(".")
        let root = support.appendingPathComponent(safe ? configured : "QuietRead/Data", isDirectory: true)
        let legacy = Bundle.main.object(forInfoDictionaryKey: "QuietReadLegacyStorageLayout") as? Bool ?? false
        store = QuietStore(root: root, legacyLayout: legacy)
        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "native")
        web = WKWebView(frame: .zero, configuration: config)
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1120, height: 800),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "QuietRead"
        window.minSize = NSSize(width: 680, height: 460)
        window.contentView = web
        window.delegate = self
        window.center()
        window.setFrameAutosaveName("QuietPromptMainWindow")
        createMenu()
        if let file = Bundle.main.url(forResource: "index", withExtension: "html") {
            web.loadFileURL(file, allowingReadAccessTo: file.deletingLastPathComponent())
        }
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
    private func createMenu() {
        let menu = NSMenu()
        let application = NSMenuItem(); menu.addItem(application)
        let appMenu = NSMenu(); application.submenu = appMenu
        appMenu.addItem(withTitle: tr("About QuietRead", "关于轻读提词器"), action: #selector(about), keyEquivalent: "").target = self
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: tr("Quit QuietRead", "退出轻读提词器"), action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let file = NSMenuItem(title: tr("File", "文件"), action: nil, keyEquivalent: ""); menu.addItem(file)
        let fileMenu = NSMenu(title: file.title); file.submenu = fileMenu
        fileMenu.addItem(withTitle: tr("Open script…", "打开稿件…"), action: #selector(openScript), keyEquivalent: "o").target = self
        let edit = NSMenuItem(title: tr("Edit", "编辑"), action: nil, keyEquivalent: ""); menu.addItem(edit)
        let editMenu = NSMenu(title: edit.title); edit.submenu = editMenu
        editMenu.addItem(withTitle: tr("Undo", "撤销"), action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: tr("Cut", "剪切"), action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: tr("Copy", "复制"), action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: tr("Paste", "粘贴"), action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: tr("Select All", "全选"), action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        let view = NSMenuItem(title: tr("View", "显示"), action: nil, keyEquivalent: ""); menu.addItem(view)
        let viewMenu = NSMenu(title: view.title); view.submenu = viewMenu
        let full = viewMenu.addItem(withTitle: tr("Toggle Full Screen", "切换全屏"), action: #selector(fullscreen), keyEquivalent: "f")
        full.keyEquivalentModifierMask = [.command, .control]; full.target = self
        NSApp.mainMenu = menu
    }
    @objc private func about() {
        NSApp.orderFrontStandardAboutPanel(options: [.applicationName: tr("QuietRead", "轻读提词器"),
            .credits: NSAttributedString(string: tr("Offline teleprompter · TXT and Markdown · No recording or uploads", "本机离线提词 · 支持TXT与Markdown · 不录音，不上传"))])
    }
    @objc private func fullscreen() { window.toggleFullScreen(nil) }
    @objc private func openScript() {
        web.evaluateJavaScript("window.pauseForDialog && window.pauseForDialog()")
        let panel = NSOpenPanel()
        panel.title = tr("Choose a TXT or Markdown script", "选择TXT或Markdown稿件")
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.allowedContentTypes = [.plainText, .text, UTType(filenameExtension: "md") ?? .text]
        panel.beginSheetModal(for: window) { response in
            guard response == .OK, let url = panel.url else { return }
            do {
                let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                guard size <= 6_000_000 else { throw NSError(domain: "QuietRead", code: 1, userInfo: [NSLocalizedDescriptionKey: self.tr("The file is too large. Split it into smaller files.", "文件过大，请先按卷拆分。")]) }
                let data = try Data(contentsOf: url)
                guard data.count <= 6_000_000 else { throw NSError(domain: "QuietRead", code: 1, userInfo: [NSLocalizedDescriptionKey: self.tr("The file is too large. Split it into smaller files.", "文件过大，请先按卷拆分。")]) }
                guard let text = String(data: data, encoding: .utf8) else { throw NSError(domain: "QuietRead", code: 2, userInfo: [NSLocalizedDescriptionKey: self.tr("Save the file as UTF-8 and try again.", "请将文件另存为UTF-8编码后导入。")]) }
                let args = try JSONSerialization.data(withJSONObject: [text, url.lastPathComponent])
                self.web.evaluateJavaScript("window.importNovel(...\(String(data: args, encoding: .utf8)!))")
            } catch {
                let alert = NSAlert(); alert.messageText = self.tr("Could not import script", "无法导入稿件")
                alert.informativeText = self.errorMessage(error); alert.beginSheetModal(for: self.window)
            }
        }
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if let action = message.body as? String {
            if action == "open" { openScript() }
            if action == "fullscreen" { fullscreen() }
            return
        }
        guard let request = message.body as? [String: Any], let op = request["op"] as? String else { return }
        if op == "setLanguage" {
            language = request["language"] as? String == "zh" ? "zh" : "en"
            window.title = tr("QuietRead", "轻读提词器")
            createMenu()
            return
        }
        guard let id = request["id"] as? Int else { return }
        do {
            var value: Any = NSNull()
            switch op {
            case "loadState":
                let result = try store.readState()
                value = ["state": (result.state as Any?) ?? NSNull(), "recovered": result.recovered]
            case "saveState":
                guard let state = request["value"] as? [String: Any] else { throw QuietStoreError.invalidState }
                try store.writeState(state); value = true
            case "saveBook":
                guard let book = request["value"] as? [String: Any] else { throw QuietStoreError.invalidBook }
                try store.writeBook(book); value = true
            case "loadBook":
                guard let bookID = request["value"] as? String else { throw QuietStoreError.invalidID }
                value = try store.readBook(bookID)
            default: throw QuietStoreError.invalidState
            }
            reply(id: id, ok: true, value: value, error: nil)
        } catch { reply(id: id, ok: false, value: NSNull(), error: errorMessage(error)) }
    }
    private func reply(id: Int, ok: Bool, value: Any, error: String?) {
        let response: [String: Any] = ["id": id, "ok": ok, "value": value, "error": error ?? ""]
        guard let data = try? JSONSerialization.data(withJSONObject: response), let json = String(data: data, encoding: .utf8) else { return }
        web.evaluateJavaScript("window.__nativeResult && window.__nativeResult(\(json))")
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

@main struct QuietReadApplication {
    static func main() {
        let app = NSApplication.shared
        let delegate = AppDelegate()
        app.delegate = delegate
        app.setActivationPolicy(.regular)
        app.run()
    }
}
