import Foundation
import CoreLocation

/// GPS with a small Kalman-style filter: when standing still it averages fixes (weighted by accuracy),
/// when walking it follows quickly; big jumps (cart rides) reset the estimate.
final class LocationModel: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var position: Coord?
    @Published var accuracy: Double?
    @Published var lastFix: Date?
    @Published var denied = false

    private let manager = CLLocationManager()
    private let origin = Coord(lat: 37.204, lon: 127.785)
    private struct KState { var x: Double; var y: Double; var p: Double; var t: Date }
    private var state: KState?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = kCLDistanceFilterNone
    }

    func start() {
        let status = manager.authorizationStatus
        if status == .notDetermined {
            manager.requestWhenInUseAuthorization()
            return
        }
        begin()
    }

    private func begin() {
        if backgroundAllowed() { manager.allowsBackgroundLocationUpdates = true }
        manager.startUpdatingLocation()
    }

    /// Only enable background updates when the "Location updates" background mode is present,
    /// otherwise CoreLocation would raise an exception.
    private func backgroundAllowed() -> Bool {
        for key in ["WKBackgroundModes", "UIBackgroundModes"] {
            if let modes = Bundle.main.object(forInfoDictionaryKey: key) as? [String], modes.contains("location") {
                return true
            }
        }
        return false
    }

    var isFresh: Bool {
        guard let t = lastFix else { return false }
        return Date().timeIntervalSince(t) < 5
    }

    // MARK: CLLocationManagerDelegate

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse:
            denied = false
            begin()
        case .denied, .restricted:
            denied = true
        default:
            break
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        for l in locations { ingest(l) }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // keep the last good estimate; CoreLocation keeps trying
    }

    private func ingest(_ l: CLLocation) {
        let acc = l.horizontalAccuracy
        guard acc > 0 else { return }
        let ml = Geo.mLat(origin.lat), mo = Geo.mLon(origin.lat)
        let zx = (l.coordinate.longitude - origin.lon) * mo
        let zy = (l.coordinate.latitude - origin.lat) * ml
        let r = pow(max(acc, 2), 2)
        let t = l.timestamp

        if let s = state, t.timeIntervalSince(s.t) < 30 {
            if acc > 80 && s.p < 400 { return } // ignore a very poor fix while we have a good one
            let dt = max(0.2, t.timeIntervalSince(s.t))
            let q = l.speed >= 0 ? max(0.04, l.speed * l.speed) : 1.2
            let p = s.p + q * dt
            let innovation = hypot(zx - s.x, zy - s.y)
            if innovation > 3 * (p + r).squareRoot() + 12 {
                state = KState(x: zx, y: zy, p: r, t: t)
            } else {
                let k = p / (p + r)
                state = KState(x: s.x + k * (zx - s.x), y: s.y + k * (zy - s.y), p: (1 - k) * p, t: t)
            }
        } else {
            state = KState(x: zx, y: zy, p: r, t: t)
        }
        guard let s = state else { return }
        position = Coord(lat: origin.lat + s.y / ml, lon: origin.lon + s.x / mo)
        accuracy = s.p.squareRoot()
        lastFix = Date()
    }
}
