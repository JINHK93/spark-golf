import Foundation
import SwiftUI

struct Coord: Codable, Equatable {
    var lat: Double
    var lon: Double
}

enum Geo {
    static func mLat(_ lat: Double) -> Double {
        let p = lat * Double.pi / 180
        return 111132.954 - 559.822 * cos(2 * p) + 1.175 * cos(4 * p)
    }
    static func mLon(_ lat: Double) -> Double {
        let p = lat * Double.pi / 180
        return 111412.84 * cos(p) - 93.5 * cos(3 * p) + 0.118 * cos(5 * p)
    }
    static func distance(_ a: Coord, _ b: Coord) -> Double {
        let mid = (a.lat + b.lat) / 2
        let dx = (b.lon - a.lon) * mLon(mid)
        let dy = (b.lat - a.lat) * mLat(mid)
        return (dx * dx + dy * dy).squareRoot()
    }
}

struct Club: Codable, Identifiable, Equatable {
    var id = UUID()
    var name: String
    var min: Double
    var max: Double
    var mid: Double { (min + max) / 2 }
}

let defaultClubs: [Club] = [
    Club(name: "드라이버", min: 200, max: 220), Club(name: "유틸", min: 170, max: 180),
    Club(name: "4번", min: 160, max: 170), Club(name: "5번", min: 150, max: 160),
    Club(name: "6번", min: 140, max: 150), Club(name: "7번", min: 130, max: 140),
    Club(name: "8번", min: 120, max: 130), Club(name: "9번", min: 110, max: 120),
    Club(name: "P", min: 90, max: 110), Club(name: "A", min: 70, max: 90), Club(name: "S", min: 0, max: 70),
]

struct HoleScore: Codable {
    var shots: Int = 0
    var putts: Int = 0
    /// nil = playing, "in" = holed, "ok" = conceded (+1)
    var done: String? = nil
    /// nil/"C" = centre, "F" = front pin, "B" = back pin
    var pin: String? = nil
    var positions: [Coord] = []
    var strokes: Int { shots + putts + (done == "ok" ? 1 : 0) }
}

struct RoundState: Codable {
    var start: String
    var back: String?
    var current: String
    var holes: [String: HoleScore]
}

struct Advice {
    var club: String
    var range: String
    var after: Int?
}

final class Store: ObservableObject {
    @Published var clubs: [Club] { didSet { save() } }
    @Published var round: RoundState? { didSet { save() } }

    private let kClubs = "spk.clubs"
    private let kRound = "spk.round"

    init() {
        let ud = UserDefaults.standard
        if let d = ud.data(forKey: kClubs), let c = try? JSONDecoder().decode([Club].self, from: d) {
            clubs = c
        } else {
            clubs = defaultClubs
        }
        if let d = ud.data(forKey: kRound), let r = try? JSONDecoder().decode(RoundState.self, from: d) {
            round = r
        } else {
            round = nil
        }
    }

    private func save() {
        let ud = UserDefaults.standard
        if let d = try? JSONEncoder().encode(clubs) { ud.set(d, forKey: kClubs) }
        if let r = round, let d = try? JSONEncoder().encode(r) { ud.set(d, forKey: kRound) } else { ud.removeObject(forKey: kRound) }
    }

    // MARK: round

    var currentId: String { round?.current ?? "" }
    var currentHole: HoleInfo? { CourseData.byId[currentId] }

    func newRound(start: String) {
        round = RoundState(start: start, back: nil, current: start + "1", holes: [:])
    }
    func endRound() { round = nil }

    func score(_ id: String) -> HoleScore { round?.holes[id] ?? HoleScore() }

    func update(_ id: String, _ change: (inout HoleScore) -> Void) {
        guard var r = round else { return }
        var s = r.holes[id] ?? HoleScore()
        change(&s)
        r.holes[id] = s
        round = r
    }

    func go(_ id: String) {
        guard var r = round, let h = CourseData.byId[id] else { return }
        if h.course != r.start && r.back == nil { r.back = h.course }
        r.current = id
        round = r
    }

    func chooseBack(_ course: String) {
        guard var r = round else { return }
        r.back = course
        r.current = course + "1"
        round = r
    }

    func order() -> [String] {
        guard let r = round else { return [] }
        var o = (1...9).map { r.start + String($0) }
        if let b = r.back { o += (1...9).map { b + String($0) } }
        return o
    }

    func nextId(after id: String) -> String? {
        let o = order()
        guard let i = o.firstIndex(of: id), i + 1 < o.count else { return nil }
        return o[i + 1]
    }

    func prevId(before id: String) -> String? {
        let o = order()
        guard let i = o.firstIndex(of: id), i > 0 else { return nil }
        return o[i - 1]
    }

    func totals() -> (strokes: Int, par: Int, holes: Int) {
        var st = 0, par = 0, n = 0
        for (id, s) in round?.holes ?? [:] where s.done != nil {
            st += s.strokes
            par += CourseData.byId[id]?.par ?? 0
            n += 1
        }
        return (st, par, n)
    }

    // MARK: distances & clubs

    /// Target point: green centre, or a front/back pin moved along the green→tee axis.
    func target(_ h: HoleInfo, pin: String?) -> Coord {
        let g = h.green
        guard let m = pin, m != "C" else { return g }
        let ml = Geo.mLat(g.lat), mo = Geo.mLon(g.lat)
        let tx = (h.tee.lon - g.lon) * mo, ty = (h.tee.lat - g.lat) * ml
        let len = Swift.max((tx * tx + ty * ty).squareRoot(), 1)
        let off = m == "F" ? 0.6 * h.front : -0.6 * h.back
        return Coord(lat: g.lat + ty / len * off / ml, lon: g.lon + tx / len * off / mo)
    }

    private func clubScore(_ c: Club, _ d: Double) -> Double {
        let out = d < c.min ? c.min - d : (d > c.max ? d - c.max : 0)
        return out * 10 + abs(d - c.mid)
    }

    func pickClub(_ d: Double, allowDriver: Bool) -> Club? {
        var cs = clubs.filter { $0.max > 0 }
        guard let longest = cs.max(by: { $0.max < $1.max }) else { return nil }
        if !allowDriver && cs.count > 1 { cs.removeAll { $0.id == longest.id } }
        return cs.min(by: { clubScore($0, d) < clubScore($1, d) })
    }

    func longClub(allowDriver: Bool, cap: Double?) -> Club? {
        var cs = clubs.filter { $0.max > 0 }.sorted { $0.max > $1.max }
        if !allowDriver && cs.count > 1 { cs.removeFirst() }
        if let cap = cap {
            let ok = cs.filter { $0.mid <= cap }
            if !ok.isEmpty { cs = ok }
        }
        return cs.first
    }

    func advice(_ h: HoleInfo, toTarget d: Double, toCentre dc: Double, isTee: Bool) -> Advice {
        if d <= 8 || dc <= Swift.max(h.front, h.back) + 2 { return Advice(club: "퍼터", range: "", after: nil) }
        let reach = longClub(allowDriver: false, cap: nil)?.max ?? 0
        if d <= reach || (h.par == 3 && isTee) {
            let c = pickClub(d, allowDriver: isTee && d > reach)
            return Advice(club: c?.name ?? "-", range: c.map { "\(Int($0.min))–\(Int($0.max))m" } ?? "", after: nil)
        }
        let driver = isTee && h.par >= 4
        let c = longClub(allowDriver: driver, cap: driver ? h.teeMax : nil)
        let after = c.map { Int((d - $0.mid).rounded()) }
        return Advice(club: c?.name ?? "-", range: c.map { "\(Int($0.min))–\(Int($0.max))m" } ?? "", after: after)
    }
}

func scoreName(strokes: Int, par: Int) -> String {
    if strokes == 1 { return "홀인원" }
    if strokes >= par * 2 { return "더블파" }
    switch strokes - par {
    case -3: return "알바트로스"
    case -2: return "이글"
    case -1: return "버디"
    case 0: return "파"
    case 1: return "보기"
    case 2: return "더블보기"
    case 3: return "트리플보기"
    case 4: return "쿼드러플"
    default: return "+\(strokes - par)"
    }
}

func diffText(_ d: Int) -> String { d == 0 ? "E" : (d > 0 ? "+\(d)" : "\(d)") }

func scoreColor(_ d: Int) -> Color {
    if d <= -1 { return .green }
    if d == 0 { return .white }
    if d == 1 { return .yellow }
    return .orange
}
