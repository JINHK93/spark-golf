import SwiftUI

@main
struct SparkWatchApp: App {
    @StateObject private var store = Store()
    @StateObject private var loc = LocationModel()

    var body: some Scene {
        WindowGroup {
            NavigationStack {
                RootView()
            }
            .environmentObject(store)
            .environmentObject(loc)
            .onAppear { loc.start() }
        }
    }
}
