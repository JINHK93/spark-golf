// Generated from data.js (spark-golf web app). Do not edit by hand.
import Foundation

struct HoleInfo {
    let id: String
    let course: String
    let number: Int
    let par: Int
    let hdcp: Int
    /// black, blue, white, yellow, red (m)
    let tees: [Int]
    let green: Coord
    let tee: Coord
    /// green depth from centre to front / back edge (m, approx.)
    let front: Double
    let back: Double
    /// cap for the tee-shot club (m), e.g. hazard at the landing zone
    let teeMax: Double?
    let estimated: Bool
}

enum CourseData {
    static let courseNames: [String: String] = ["P": "피크", "A": "아쿠아", "K": "키네틱"]
    static let courseOrder = ["P", "A", "K"]
    static let holes: [HoleInfo] = [
        HoleInfo(id: "P1", course: "P", number: 1, par: 4, hdcp: 9, tees: [350, 328, 308, 285, 237], green: Coord(lat: 37.2061, lon: 127.7828), tee: Coord(lat: 37.2087, lon: 127.7845), front: 23.0, back: 22.7, teeMax: nil, estimated: false),
        HoleInfo(id: "P2", course: "P", number: 2, par: 5, hdcp: 3, tees: [540, 520, 498, 479, 423], green: Coord(lat: 37.2093, lon: 127.7792), tee: Coord(lat: 37.2058, lon: 127.782), front: 22.7, back: 24.9, teeMax: nil, estimated: false),
        HoleInfo(id: "P3", course: "P", number: 3, par: 4, hdcp: 6, tees: [364, 347, 318, 297, 249], green: Coord(lat: 37.2066, lon: 127.7806), tee: Coord(lat: 37.2095, lon: 127.7786), front: 17.0, back: 15.8, teeMax: nil, estimated: false),
        HoleInfo(id: "P4", course: "P", number: 4, par: 3, hdcp: 4, tees: [193, 177, 159, 144, 115], green: Coord(lat: 37.2016, lon: 127.7827), tee: Coord(lat: 37.2031, lon: 127.7826), front: 23.8, back: 24.8, teeMax: nil, estimated: false),
        HoleInfo(id: "P5", course: "P", number: 5, par: 4, hdcp: 1, tees: [321, 300, 281, 257, 229], green: Coord(lat: 37.1993, lon: 127.7806), tee: Coord(lat: 37.1999, lon: 127.783), front: 17.8, back: 15.9, teeMax: nil, estimated: false),
        HoleInfo(id: "P6", course: "P", number: 6, par: 4, hdcp: 2, tees: [375, 355, 336, 315, 255], green: Coord(lat: 37.1987, lon: 127.7848), tee: Coord(lat: 37.1991, lon: 127.7811), front: 15.7, back: 17.4, teeMax: nil, estimated: false),
        HoleInfo(id: "P7", course: "P", number: 7, par: 4, hdcp: 8, tees: [360, 342, 324, 305, 274], green: Coord(lat: 37.2028, lon: 127.7843), tee: Coord(lat: 37.2003, lon: 127.785), front: 20.6, back: 21.6, teeMax: nil, estimated: false),
        HoleInfo(id: "P8", course: "P", number: 8, par: 3, hdcp: 7, tees: [162, 143, 122, 102, 102], green: Coord(lat: 37.2033, lon: 127.7838), tee: Coord(lat: 37.2021, lon: 127.7832), front: 20.1, back: 19.9, teeMax: nil, estimated: false),
        HoleInfo(id: "P9", course: "P", number: 9, par: 5, hdcp: 5, tees: [507, 486, 466, 444, 339], green: Coord(lat: 37.2076, lon: 127.7849), tee: Coord(lat: 37.204, lon: 127.7827), front: 18.7, back: 20.0, teeMax: nil, estimated: false),
        HoleInfo(id: "A1", course: "A", number: 1, par: 4, hdcp: 2, tees: [386, 364, 345, 327, 267], green: Coord(lat: 37.2048, lon: 127.7864), tee: Coord(lat: 37.208, lon: 127.7866), front: 20.3, back: 18.8, teeMax: nil, estimated: true),
        HoleInfo(id: "A2", course: "A", number: 2, par: 5, hdcp: 4, tees: [515, 493, 461, 430, 399], green: Coord(lat: 37.1997, lon: 127.7857), tee: Coord(lat: 37.2035, lon: 127.7856), front: 20.3, back: 18.1, teeMax: nil, estimated: true),
        HoleInfo(id: "A3", course: "A", number: 3, par: 4, hdcp: 3, tees: [350, 330, 309, 288, 228], green: Coord(lat: 37.1979, lon: 127.7831), tee: Coord(lat: 37.1993, lon: 127.7864), front: 19.0, back: 20.4, teeMax: nil, estimated: true),
        HoleInfo(id: "A4", course: "A", number: 4, par: 3, hdcp: 5, tees: [165, 146, 123, 102, 102], green: Coord(lat: 37.1984, lon: 127.7817), tee: Coord(lat: 37.1985, lon: 127.7831), front: 22.6, back: 23.4, teeMax: nil, estimated: false),
        HoleInfo(id: "A5", course: "A", number: 5, par: 4, hdcp: 6, tees: [372, 348, 328, 309, 251], green: Coord(lat: 37.1964, lon: 127.7843), tee: Coord(lat: 37.1981, lon: 127.7814), front: 19.7, back: 21.0, teeMax: nil, estimated: false),
        HoleInfo(id: "A6", course: "A", number: 6, par: 4, hdcp: 9, tees: [335, 311, 294, 272, 272], green: Coord(lat: 37.1983, lon: 127.7864), tee: Coord(lat: 37.1962, lon: 127.7838), front: 19.9, back: 19.4, teeMax: nil, estimated: false),
        HoleInfo(id: "A7", course: "A", number: 7, par: 5, hdcp: 7, tees: [493, 478, 457, 435, 386], green: Coord(lat: 37.2029, lon: 127.7863), tee: Coord(lat: 37.1987, lon: 127.7862), front: 23.9, back: 21.3, teeMax: nil, estimated: false),
        HoleInfo(id: "A8", course: "A", number: 8, par: 3, hdcp: 8, tees: [146, 124, 106, 84, 84], green: Coord(lat: 37.2039, lon: 127.7852), tee: Coord(lat: 37.2031, lon: 127.7862), front: 22.6, back: 20.1, teeMax: nil, estimated: false),
        HoleInfo(id: "A9", course: "A", number: 9, par: 4, hdcp: 1, tees: [415, 401, 387, 359, 295], green: Coord(lat: 37.2072, lon: 127.7861), tee: Coord(lat: 37.204, lon: 127.7838), front: 16.9, back: 15.6, teeMax: nil, estimated: false),
        HoleInfo(id: "K1", course: "K", number: 1, par: 4, hdcp: 3, tees: [377, 357, 336, 315, 277], green: Coord(lat: 37.2119, lon: 127.7822), tee: Coord(lat: 37.2093, lon: 127.7841), front: 18.1, back: 17.7, teeMax: 185.0, estimated: false),
        HoleInfo(id: "K2", course: "K", number: 2, par: 4, hdcp: 6, tees: [363, 336, 314, 299, 242], green: Coord(lat: 37.2116, lon: 127.7851), tee: Coord(lat: 37.2117, lon: 127.7812), front: 20.6, back: 20.3, teeMax: 195.0, estimated: false),
        HoleInfo(id: "K3", course: "K", number: 3, par: 4, hdcp: 7, tees: [328, 310, 276, 239, 211], green: Coord(lat: 37.2057, lon: 127.7888), tee: Coord(lat: 37.208, lon: 127.7884), front: 17.4, back: 15.1, teeMax: nil, estimated: false),
        HoleInfo(id: "K4", course: "K", number: 4, par: 4, hdcp: 1, tees: [382, 364, 346, 333, 281], green: Coord(lat: 37.2089, lon: 127.7889), tee: Coord(lat: 37.2058, lon: 127.7893), front: 21.2, back: 20.7, teeMax: nil, estimated: false),
        HoleInfo(id: "K5", course: "K", number: 5, par: 3, hdcp: 9, tees: [155, 155, 132, 117, 117], green: Coord(lat: 37.2074, lon: 127.7904), tee: Coord(lat: 37.2087, lon: 127.7895), front: 21.9, back: 19.8, teeMax: nil, estimated: false),
        HoleInfo(id: "K6", course: "K", number: 6, par: 5, hdcp: 4, tees: [490, 461, 438, 405, 365], green: Coord(lat: 37.2037, lon: 127.7885), tee: Coord(lat: 37.2066, lon: 127.7918), front: 21.9, back: 18.2, teeMax: nil, estimated: false),
        HoleInfo(id: "K7", course: "K", number: 7, par: 3, hdcp: 8, tees: [130, 130, 114, 75, 75], green: Coord(lat: 37.2007, lon: 127.7891), tee: Coord(lat: 37.2018, lon: 127.7888), front: 20.6, back: 20.4, teeMax: nil, estimated: false),
        HoleInfo(id: "K8", course: "K", number: 8, par: 4, hdcp: 5, tees: [372, 348, 335, 293, 259], green: Coord(lat: 37.2034, lon: 127.7873), tee: Coord(lat: 37.2003, lon: 127.7878), front: 22.2, back: 21.9, teeMax: nil, estimated: false),
        HoleInfo(id: "K9", course: "K", number: 9, par: 5, hdcp: 2, tees: [510, 486, 466, 447, 390], green: Coord(lat: 37.2078, lon: 127.7875), tee: Coord(lat: 37.2037, lon: 127.7871), front: 19.4, back: 20.7, teeMax: nil, estimated: false)
    ]
    static let byId: [String: HoleInfo] = Dictionary(uniqueKeysWithValues: holes.map { ($0.id, $0) })
}
