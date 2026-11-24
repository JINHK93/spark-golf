import SwiftUI
import WatchKit

private func haptic(_ type: WKHapticType = .click) { WKInterfaceDevice.current().play(type) }

struct RootView: View {
    @EnvironmentObject var store: Store
    var body: some View {
        if store.round == nil {
            StartView()
        } else {
            HoleView()
        }
    }
}

// MARK: - Start

struct StartView: View {
    @EnvironmentObject var store: Store
    var body: some View {
        List {
            Section {
                Text("남한강 에스파크").font(.headline)
            }
            Section("티업 시작") {
                ForEach(CourseData.courseOrder, id: \.self) { c in
                    Button("\(CourseData.courseNames[c] ?? c) 1번홀부터") {
                        store.newRound(start: c)
                        haptic(.start)
                    }
                }
            }
            Section {
                NavigationLink("클럽 거리") { ClubsView() }
            }
        }
    }
}

// MARK: - Hole (3 vertical pages)

struct HoleView: View {
    @EnvironmentObject var store: Store
    @State private var page = 0
    var body: some View {
        TabView(selection: $page) {
            DistancePage().tag(0)
            ScorePage().tag(1)
            MenuPage().tag(2)
        }
        .tabViewStyle(.verticalPage)
        .onChange(of: store.currentId) { page = 0 }
    }
}

struct DistancePage: View {
    @EnvironmentObject var store: Store
    @EnvironmentObject var loc: LocationModel

    var body: some View {
        if let h = store.currentHole {
            let s = store.score(h.id)
            let target = store.target(h, pin: s.pin)
            VStack(spacing: 2) {
                HStack {
                    Text("\(h.id) · PAR \(h.par)").font(.footnote.weight(.semibold))
                    Spacer()
                    Text(gpsText).font(.caption2).foregroundStyle(gpsColor)
                }
                if let me = loc.position {
                    let d = Geo.distance(me, target)
                    let dc = Geo.distance(me, h.green)
                    let adv = store.advice(h, toTarget: d, toCentre: dc, isTee: s.shots == 0)
                    Text(d < 2000 ? "\(Int(d.rounded()))" : "--")
                        .font(.system(size: 50, weight: .heavy, design: .rounded))
                        .monospacedDigit()
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                    Text("앞 \(Int(max(0, dc - h.front).rounded())) · 뒤 \(Int((dc + h.back).rounded()))\(pinLabel(s.pin))")
                        .font(.caption2).foregroundStyle(.secondary).monospacedDigit()
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text(adv.club).font(.title3.weight(.bold)).foregroundStyle(.yellow)
                        if let after = adv.after, after > 0 {
                            Text("→ 남은 \(after)m").font(.caption2).foregroundStyle(.secondary)
                        } else if !adv.range.isEmpty {
                            Text(adv.range).font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                    lastShotText(me: me, s: s)
                } else {
                    Spacer()
                    Text(loc.denied ? "위치 권한을 허용해 주세요" : "위치 확인 중…")
                        .font(.footnote).multilineTextAlignment(.center)
                    Spacer()
                }
                Button {
                    recordShot(h)
                } label: {
                    Text("샷 기록 · \(s.shots + 1)번째").font(.footnote.weight(.bold))
                }
                .tint(.white)
                .disabled(loc.position == nil)
            }
        } else {
            Text("홀 정보 없음")
        }
    }

    private var gpsText: String {
        guard let a = loc.accuracy else { return "GPS…" }
        return loc.isFresh ? "±\(Int(a.rounded()))m" : "±\(Int(a.rounded()))m·"
    }
    private var gpsColor: Color {
        guard let a = loc.accuracy, loc.isFresh else { return .orange }
        return a <= 6 ? .green : (a <= 15 ? .yellow : .orange)
    }
    private func pinLabel(_ p: String?) -> String {
        switch p {
        case "F": return " · 앞핀"
        case "B": return " · 뒷핀"
        default: return ""
        }
    }

    @ViewBuilder
    private func lastShotText(me: Coord, s: HoleScore) -> some View {
        if let last = s.positions.last {
            let d = Geo.distance(last, me)
            if d > 8 {
                Text("직전 샷 \(Int(d.rounded()))m").font(.caption2).foregroundStyle(.secondary)
            }
        }
    }

    private func recordShot(_ h: HoleInfo) {
        guard let me = loc.position else { return }
        store.update(h.id) { s in
            s.shots += 1
            s.positions.append(me)
            if s.done != nil { s.done = nil }
        }
        haptic(.success)
    }
}

struct ResultInfo: Identifiable {
    let id = UUID()
    let holeId: String
    let title: String
    let detail: String
    let diff: Int
}

struct ScorePage: View {
    @EnvironmentObject var store: Store
    @State private var result: ResultInfo?

    var body: some View {
        if let h = store.currentHole {
            let s = store.score(h.id)
            VStack(spacing: 6) {
                HStack {
                    Text("\(h.id) · PAR \(h.par)").font(.footnote.weight(.semibold))
                    Spacer()
                    Text(s.strokes > 0 ? "\(s.strokes)타" : "-").font(.footnote.weight(.bold))
                }
                StepRow(label: "샷", value: s.shots) { delta in
                    store.update(h.id) { x in
                        if delta < 0 && x.shots > 0 {
                            x.shots -= 1
                            if x.positions.count > x.shots { x.positions.removeLast() }
                        } else if delta > 0 {
                            x.shots += 1
                        }
                        x.done = nil
                    }
                }
                StepRow(label: "퍼트", value: s.putts) { delta in
                    store.update(h.id) { x in
                        x.putts = max(0, x.putts + delta)
                        x.done = nil
                    }
                }
                HStack(spacing: 6) {
                    Button("홀인") { finish(h, kind: "in") }.tint(.green)
                    Button("OK") { finish(h, kind: "ok") }.tint(.blue)
                }
                .font(.body.weight(.bold))
            }
            .sheet(item: $result) { r in ResultView(info: r) }
        }
    }

    private func finish(_ h: HoleInfo, kind: String) {
        let s0 = store.score(h.id)
        if kind == "in" && s0.shots + s0.putts == 0 { haptic(.failure); return }
        store.update(h.id) { $0.done = kind }
        let s = store.score(h.id)
        let t = store.totals()
        haptic(.success)
        result = ResultInfo(
            holeId: h.id,
            title: scoreName(strokes: s.strokes, par: h.par),
            detail: "\(s.strokes)타 · 퍼트 \(s.putts)\(kind == "ok" ? " · OK" : "")\n누적 \(diffText(t.strokes - t.par)) / \(t.holes)홀",
            diff: s.strokes - h.par
        )
    }
}

struct StepRow: View {
    let label: String
    let value: Int
    let change: (Int) -> Void
    var body: some View {
        HStack {
            Button { change(-1); haptic() } label: { Image(systemName: "minus") }
                .frame(width: 44)
            Spacer()
            VStack(spacing: 0) {
                Text("\(value)").font(.title3.weight(.heavy)).monospacedDigit()
                Text(label).font(.caption2).foregroundStyle(.secondary)
            }
            Spacer()
            Button { change(1); haptic() } label: { Image(systemName: "plus") }
                .frame(width: 44)
        }
    }
}

struct ResultView: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) private var dismiss
    let info: ResultInfo

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Text(info.title).font(.title2.weight(.heavy)).foregroundStyle(scoreColor(info.diff))
                Text(info.detail).font(.footnote).multilineTextAlignment(.center).foregroundStyle(.secondary)
                if isTurn {
                    Text("후반 코스").font(.caption2).foregroundStyle(.secondary)
                    ForEach(CourseData.courseOrder.filter { $0 != store.round?.start }, id: \.self) { c in
                        Button(CourseData.courseNames[c] ?? c) {
                            store.chooseBack(c)
                            dismiss()
                        }
                    }
                } else if let next = store.nextId(after: info.holeId) {
                    Button("다음 홀 · \(next)") {
                        store.go(next)
                        dismiss()
                    }
                    .tint(.white)
                } else {
                    let t = store.totals()
                    Text("라운드 종료 · \(t.strokes)타 (\(diffText(t.strokes - t.par)))").font(.footnote.weight(.bold))
                }
                Button("닫기") { dismiss() }
            }
        }
    }

    private var isTurn: Bool {
        guard let r = store.round else { return false }
        return r.back == nil && info.holeId == r.start + "9"
    }
}

// MARK: - Menu

struct MenuPage: View {
    @EnvironmentObject var store: Store
    @State private var confirmEnd = false

    var body: some View {
        if let h = store.currentHole {
            let s = store.score(h.id)
            List {
                Section("오늘 핀 위치") {
                    HStack(spacing: 4) {
                        pinButton(h, "F", "앞", s.pin)
                        pinButton(h, "C", "중", s.pin)
                        pinButton(h, "B", "뒤", s.pin)
                    }
                }
                Section {
                    HStack {
                        Button {
                            if let p = store.prevId(before: h.id) { store.go(p) }
                        } label: { Image(systemName: "chevron.left") }
                        .buttonStyle(.bordered)
                        .disabled(store.prevId(before: h.id) == nil)
                        Spacer()
                        Text(h.id).font(.headline)
                        Spacer()
                        Button {
                            if let n = store.nextId(after: h.id) { store.go(n) }
                        } label: { Image(systemName: "chevron.right") }
                        .buttonStyle(.bordered)
                        .disabled(store.nextId(after: h.id) == nil)
                    }
                    NavigationLink("홀 선택") { HolePicker() }
                    NavigationLink("스코어카드") { ScorecardView() }
                    NavigationLink("클럽 거리") { ClubsView() }
                }
                if h.estimated {
                    Text("이 홀 좌표는 추정값이라 오차가 있을 수 있습니다.").font(.caption2).foregroundStyle(.secondary)
                }
                Section {
                    Button("라운드 종료", role: .destructive) { confirmEnd = true }
                }
            }
            .confirmationDialog("라운드를 종료할까요? 기록이 지워집니다.", isPresented: $confirmEnd) {
                Button("종료", role: .destructive) { store.endRound() }
                Button("취소", role: .cancel) {}
            }
        }
    }

    private func pinButton(_ h: HoleInfo, _ mode: String, _ label: String, _ current: String?) -> some View {
        let on = (current ?? "C") == mode
        return Button {
            store.update(h.id) { $0.pin = (mode == "C") ? nil : mode }
            haptic()
        } label: {
            Text(label).font(.footnote.weight(.bold)).frame(maxWidth: .infinity)
        }
        .buttonStyle(.bordered)
        .tint(on ? .red : .gray)
    }
}

struct HolePicker: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        List {
            ForEach(CourseData.courseOrder, id: \.self) { c in
                Section(CourseData.courseNames[c] ?? c) {
                    ForEach(CourseData.holes.filter { $0.course == c }, id: \.id) { h in
                        Button {
                            store.go(h.id)
                            dismiss()
                        } label: {
                            HStack {
                                Text("\(h.number)번").font(.body.weight(.semibold))
                                Spacer()
                                Text("P\(h.par) · \(h.tees[2])m").font(.caption2).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("홀 선택")
    }
}

struct ScorecardView: View {
    @EnvironmentObject var store: Store
    var body: some View {
        let t = store.totals()
        List {
            Section {
                Text("\(t.strokes)타 · \(diffText(t.strokes - t.par)) · \(t.holes)홀").font(.headline)
            }
            ForEach(store.order(), id: \.self) { id in
                if let h = CourseData.byId[id] {
                    let s = store.score(id)
                    HStack {
                        Text(id).font(.body.weight(.semibold))
                        Text("P\(h.par)").font(.caption2).foregroundStyle(.secondary)
                        Spacer()
                        if s.done != nil {
                            Text("\(s.strokes)").font(.body.weight(.bold)).foregroundStyle(scoreColor(s.strokes - h.par))
                            Text("(\(s.putts))").font(.caption2).foregroundStyle(.secondary)
                        } else {
                            Text("·").foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle("스코어카드")
    }
}

// MARK: - Clubs

struct ClubsView: View {
    @EnvironmentObject var store: Store
    var body: some View {
        List {
            ForEach($store.clubs) { $club in
                NavigationLink {
                    ClubEditView(club: $club)
                } label: {
                    HStack {
                        Text(club.name).font(.body.weight(.semibold))
                        Spacer()
                        Text("\(Int(club.min))–\(Int(club.max))").font(.caption2).foregroundStyle(.secondary).monospacedDigit()
                    }
                }
            }
            Button("기본값으로") { store.clubs = defaultClubs }
        }
        .navigationTitle("클럽 거리")
    }
}

struct ClubEditView: View {
    @Binding var club: Club
    var body: some View {
        VStack(spacing: 6) {
            Text(club.name).font(.headline)
            Stepper(value: $club.min, in: 0...300, step: 5) {
                Text("최소 \(Int(club.min))m").monospacedDigit()
            }
            Stepper(value: $club.max, in: 0...320, step: 5) {
                Text("최대 \(Int(club.max))m").monospacedDigit()
            }
        }
    }
}
