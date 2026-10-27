import Foundation

@main struct StoreTests {
    static func main() throws {
        let fm = FileManager.default
        let root = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("quietread-tests-" + UUID().uuidString)
        defer { try? fm.removeItem(at: root) }
        let store = QuietStore(root: root)
        let id = "12-abcd"
        let book: [String: Any] = ["id": id, "title": "example.txt", "rows": [["text": "Sample", "section": "Body"]]]
        func state(_ cursor: Double) -> [String: Any] {
            ["version": 3, "currentId": id, "prefs": ["speed": 180], "positions": [id: ["cursor": cursor]], "recent": [["id": id, "title": "example.txt"]]]
        }
        func check(_ result: @autoclosure () throws -> Bool, _ message: String) throws {
            if try !result() { throw NSError(domain: "QuietReadTests", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
        }
        try store.writeBook(book)
        try check((try store.readBook(id))["title"] as? String == "example.txt", "script round trip")
        try store.writeState(state(10)); try store.writeState(state(50))
        let main = root.appendingPathComponent("state.json")
        try Data("{broken".utf8).write(to: main)
        let previous = try store.readState()
        try check(previous.recovered, "restore previous state")
        let positions = previous.state?["positions"] as? [String: [String: Double]]
        try check(positions?[id]?["cursor"] == 10, "restore previous cursor")
        try Data("broken".utf8).write(to: root.appendingPathComponent("state.previous.json"))
        do { try store.writeState(state(99)); throw NSError(domain: "QuietReadTests", code: 2) }
        catch QuietStoreError.corruptState { }
        try check(try Data(contentsOf: main) == Data("{broken".utf8), "preserve corrupt original")
        let collision: [String: Any] = ["id": id, "title": "other.txt", "rows": [["text": "Different", "section": "Body"]]]
        do { try store.writeBook(collision); throw NSError(domain: "QuietReadTests", code: 3) }
        catch QuietStoreError.invalidBook { }
        try check((try store.readBook(id))["title"] as? String == "example.txt", "preserve colliding script")
        do { _ = try store.readBook("../../etc/passwd"); throw NSError(domain: "QuietReadTests", code: 4) }
        catch QuietStoreError.invalidID { }
        print("Passed: local storage, backup recovery, corruption protection and collision checks.")
    }
}
