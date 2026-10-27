import Foundation

enum QuietStoreError: LocalizedError {
    case invalidState, invalidBook, invalidID, missingBook, corruptState
    var errorDescription: String? {
        message(language: "en")
    }
    func message(language: String) -> String {
        if language == "zh" {
            switch self {
            case .invalidState: return "保存的阅读状态格式无效。"
            case .invalidBook: return "稿件数据不完整，未覆盖已有稿件。"
            case .invalidID: return "稿件标识无效。"
            case .missingBook: return "找不到保存的稿件，原文件和旧备份未改变。"
            case .corruptState: return "阅读状态和上一次备份都无法读取，原文件已保留。"
            }
        }
        switch self {
        case .invalidState: return "The saved progress has an invalid format."
        case .invalidBook: return "The script is invalid; the existing script was preserved."
        case .invalidID: return "The script identifier is invalid."
        case .missingBook: return "The saved script could not be found; existing files were preserved."
        case .corruptState: return "Progress and its previous backup are unreadable; both files were preserved."
        }
    }
}

final class QuietStore {
    let root: URL
    private let legacyLayout: Bool
    private let fm = FileManager.default
    private var stateURL: URL { root.appendingPathComponent(legacyLayout ? "阅读状态.json" : "state.json") }
    private var previousURL: URL { root.appendingPathComponent(legacyLayout ? "阅读状态_上一次有效版本.json" : "state.previous.json") }
    private var booksURL: URL { root.appendingPathComponent(legacyLayout ? "稿件" : "scripts", isDirectory: true) }
    init(root: URL, legacyLayout: Bool = false) { self.root = root; self.legacyLayout = legacyLayout }

    private func ensure() throws {
        try fm.createDirectory(at: booksURL, withIntermediateDirectories: true)
    }
    private func validID(_ id: String) -> Bool {
        id.range(of: #"^\d{1,8}-[0-9a-f]{1,8}$"#, options: .regularExpression) != nil
    }
    private func object(at url: URL) -> [String: Any]? {
        guard let data = try? Data(contentsOf: url),
              let object = try? JSONSerialization.jsonObject(with: data),
              let value = object as? [String: Any] else { return nil }
        return value
    }
    private func validState(_ state: [String: Any]) -> Bool {
        guard let version = state["version"] as? Int, version == 3,
              let current = state["currentId"] as? String, validID(current),
              state["prefs"] is [String: Any], state["positions"] is [String: Any],
              let recent = state["recent"] as? [[String: Any]], recent.count <= 100 else { return false }
        return recent.allSatisfy { item in
            guard let id = item["id"] as? String, validID(id), let title = item["title"] as? String else { return false }
            return !title.isEmpty && title.count <= 512
        }
    }
    private func validBook(_ book: [String: Any]) -> Bool {
        guard let id = book["id"] as? String, validID(id),
              let title = book["title"] as? String, !title.isEmpty, title.count <= 512,
              let rows = book["rows"] as? [[String: Any]], !rows.isEmpty, rows.count <= 100_000 else { return false }
        var length = 0
        for row in rows {
            guard let text = row["text"] as? String, !text.isEmpty,
                  let section = row["section"] as? String, section.count <= 512 else { return false }
            length += text.utf16.count
            if length > 2_000_000 { return false }
        }
        return true
    }
    private func encoded(_ object: [String: Any]) throws -> Data {
        guard JSONSerialization.isValidJSONObject(object) else { throw QuietStoreError.invalidState }
        return try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
    }
    func readState() throws -> (state: [String: Any]?, recovered: Bool) {
        let hasMain = fm.fileExists(atPath: stateURL.path), hasPrevious = fm.fileExists(atPath: previousURL.path)
        if !hasMain && !hasPrevious { return (nil, false) }
        if let state = object(at: stateURL), validState(state) { return (state, false) }
        if let state = object(at: previousURL), validState(state) { return (state, true) }
        throw QuietStoreError.corruptState
    }
    func writeState(_ state: [String: Any]) throws {
        guard validState(state) else { throw QuietStoreError.invalidState }
        let data = try encoded(state)
        guard data.count <= 2_000_000 else { throw QuietStoreError.invalidState }
        try ensure()
        // Do not destroy unreadable state when neither generation is valid.
        _ = try readState()
        if let previous = object(at: stateURL), validState(previous) {
            try encoded(previous).write(to: previousURL, options: .atomic)
        }
        try data.write(to: stateURL, options: .atomic)
    }
    func writeBook(_ book: [String: Any]) throws {
        guard validBook(book), let id = book["id"] as? String else { throw QuietStoreError.invalidBook }
        let data = try encoded(book)
        guard data.count <= 8_000_000 else { throw QuietStoreError.invalidBook }
        try ensure()
        let target = booksURL.appendingPathComponent(id + ".json")
        if let existing = object(at: target), validBook(existing),
           let oldRows = existing["rows"] as? [[String: Any]],
           let newRows = book["rows"] as? [[String: Any]] {
            let oldText = oldRows.map { ($0["text"] as? String ?? "") + "\u{0}" + ($0["section"] as? String ?? "") }.joined(separator: "\n")
            let newText = newRows.map { ($0["text"] as? String ?? "") + "\u{0}" + ($0["section"] as? String ?? "") }.joined(separator: "\n")
            guard oldText == newText else { throw QuietStoreError.invalidBook }
        } else if fm.fileExists(atPath: target.path) {
            // A corrupt original is never silently replaced.
            throw QuietStoreError.invalidBook
        }
        try data.write(to: target, options: .atomic)
    }
    func readBook(_ id: String) throws -> [String: Any] {
        guard validID(id) else { throw QuietStoreError.invalidID }
        guard let book = object(at: booksURL.appendingPathComponent(id + ".json")), validBook(book) else { throw QuietStoreError.missingBook }
        return book
    }
}
