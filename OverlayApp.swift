import SwiftUI

@main
struct OverlayApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    var body: some Scene {
        WindowGroup {
            TimersView()
                .frame(width: 600, height: 220)
                .background(Color.gray.opacity(0.1))
        }
        .windowStyle(HiddenTitleBarWindowStyle())
    }
}

class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        if let window = NSApplication.shared.windows.first {
            window.level = .screenSaver
            window.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
            window.isOpaque = false
            window.backgroundColor = .clear
            window.ignoresMouseEvents = false
        }
    }
}

struct TimerData: Identifiable {
    let id = UUID()
    let icon: String
    let color: Color
    var time: TimeInterval = 0
    var isRunning: Bool = false
    var lastStart: Date? = nil
}

class TimersViewModel: ObservableObject {
    @Published var timers: [TimerData] = [
        TimerData(icon: "💎", color: .blue),
        TimerData(icon: "🎭", color: .purple),
        TimerData(icon: "🍏", color: .green),
        TimerData(icon: "⚙️", color: .orange)
    ]
    @Published var activeIndex: Int? = nil
    var timer: Timer?
    
    init() {
        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            self?.updateTimers()
        }
    }
    
    func toggleTimer(_ index: Int) {
        if timers[index].isRunning {
            timers[index].isRunning = false
            if let last = timers[index].lastStart {
                timers[index].time += Date().timeIntervalSince(last)
            }
            timers[index].lastStart = nil
            activeIndex = nil
        } else {
            timers[index].isRunning = true
            timers[index].lastStart = Date()
            activeIndex = index
        }
    }
    
    func updateTimers() {
        for i in timers.indices {
            if timers[i].isRunning, let last = timers[i].lastStart {
                timers[i].time += Date().timeIntervalSince(last)
                timers[i].lastStart = Date()
            }
        }
        objectWillChange.send()
    }
}

struct TimersView: View {
    @StateObject var model = TimersViewModel()
    var body: some View {
        HStack(spacing: 24) {
            ForEach(model.timers.indices, id: \.self) { i in
                let timer = model.timers[i]
                VStack(spacing: 8) {
                    Button(action: { model.toggleTimer(i) }) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 24)
                                .stroke(model.activeIndex == i ? Color.green : timer.color.opacity(0.4), lineWidth: 4)
                                .background(RoundedRectangle(cornerRadius: 24).fill(timer.color.opacity(0.12)))
                                .frame(width: 120, height: 120)
                            Text(timer.icon)
                                .font(.system(size: 56))
                        }
                    }
                    .buttonStyle(PlainButtonStyle())
                    Text(timeString(for: timer, isActive: model.activeIndex == i))
                        .font(.system(size: 32, weight: .bold, design: .rounded))
                        .foregroundColor(model.activeIndex == i ? .green : timer.color)
                }
            }
        }
        .padding(32)
    }
    func timeString(for timer: TimerData, isActive: Bool) -> String {
        let total = Int(timer.time)
        let hours = total / 3600
        let minutes = (total % 3600) / 60
        let seconds = total % 60
        if isActive {
            let fraction = Int((timer.time - Double(total)) * 100)
            return String(format: "%d:%02d:%02d.%02d", hours, minutes, seconds, fraction)
        } else {
            return String(format: "%d:%02d", hours, minutes)
        }
    }
} 