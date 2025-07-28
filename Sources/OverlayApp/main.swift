import Cocoa
import SwiftUI
import ApplicationServices

// Кастомное окно с поддержкой клавиатурных событий
class CustomWindow: NSWindow {
    override var canBecomeKey: Bool { return true }
    override var canBecomeMain: Bool { return true }
}

// Кастомный NSHostingView с поддержкой перетаскивания
class DraggableHostingView<Content: View>: NSHostingView<Content> {
    override func mouseDown(with event: NSEvent) {
        // Делаем окно активным для получения событий клавиатуры
        window?.makeKey()
        
        // Двойной клик - переключаем состояние сворачивания
        if event.clickCount == 2 {
            NotificationCenter.default.post(name: NSNotification.Name("ToggleCollapse"), object: nil)
            return
        }
        
        // Если зажата клавиша Command - перетаскиваем
        if event.modifierFlags.contains(.command) {
            window?.performDrag(with: event)
        } else {
            // Все остальные клики передаем кнопкам
            super.mouseDown(with: event)
        }
    }
    
    override func rightMouseDown(with event: NSEvent) {
        // Правый клик - перетаскиваем окно
        window?.performDrag(with: event)
    }
}

@main
struct OverlayApp {
    static func main() {
        let app = NSApplication.shared
        let delegate = AppDelegate()
        app.delegate = delegate
        app.run()
    }
}

class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Проверяем и запрашиваем разрешения доступности
        checkAndRequestAccessibilityPermissions()
        
        // Создаем окно без рамки в левом верхнем углу
        let screenFrame = NSScreen.main?.frame ?? .zero
        let windowSize = NSSize(width: 280, height: 150) // Увеличена высота для неактивных таймеров
        let windowFrame = NSRect(
            x: 0, // Прижимаем к левому краю экрана
            y: screenFrame.maxY - windowSize.height - 20,
            width: windowSize.width,
            height: windowSize.height
        )
        
        window = CustomWindow(
            contentRect: windowFrame,
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        
        // Настраиваем окно как виджет
        window.level = .floating
        window.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        window.backgroundColor = .clear
        window.isOpaque = false
        window.hasShadow = false
        window.ignoresMouseEvents = false
        window.acceptsMouseMovedEvents = true
        
        // Создаем SwiftUI view
        let timersView = TimersView()
        let hostingView = DraggableHostingView(rootView: timersView)
        hostingView.frame = window.contentView!.bounds
        window.contentView = hostingView
        
        // Показываем окно
        window.makeKeyAndOrderFront(nil)
        
        // Настраиваем мониторинг событий клавиатуры
        setupKeyboardMonitoring()
        
        // Делаем приложение активным
        NSApp.activate(ignoringOtherApps: true)
    }
    
    private func setupKeyboardMonitoring() {
        // Проверяем разрешения перед настройкой мониторинга
        let trusted = AXIsProcessTrusted()
        print("Accessibility permissions trusted: \(trusted)")
        
        if trusted {
            print("Setting up global keyboard monitoring...")
            // Добавляем мониторинг глобальных событий клавиатуры
            NSEvent.addGlobalMonitorForEvents(matching: .keyDown) { event in
                print("Global key event: \(event.charactersIgnoringModifiers ?? "nil"), keyCode: \(event.keyCode), modifiers: \(event.modifierFlags)")
                if event.modifierFlags.contains(.command) && event.keyCode == 99 { // F3 key code
                    print("Cmd+F3 detected globally!")
                    NotificationCenter.default.post(name: NSNotification.Name("ToggleCollapse"), object: nil)
                }
            }
        } else {
            print("No accessibility permissions, global monitoring disabled")
        }
        
        print("Setting up local keyboard monitoring...")
        // Также добавляем локальный мониторинг на случай если окно в фокусе
        NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
            print("Local key event: \(event.charactersIgnoringModifiers ?? "nil"), keyCode: \(event.keyCode), modifiers: \(event.modifierFlags)")
            if event.modifierFlags.contains(.command) && event.keyCode == 99 { // F3 key code
                print("Cmd+F3 detected locally!")
                NotificationCenter.default.post(name: NSNotification.Name("ToggleCollapse"), object: nil)
                return nil // Потребляем событие
            }
            return event
        }
    }
    
    private func checkAndRequestAccessibilityPermissions() {
        let trusted = AXIsProcessTrusted()
        if !trusted {
            // Если разрешения не получены, показываем диалог
            let alert = NSAlert()
            alert.messageText = "Разрешения доступности"
            alert.informativeText = "Для работы горячих клавиш (Cmd+F3) необходимо предоставить разрешения доступности.\n\nПосле нажатия OK откроются Системные настройки. Найдите OverlayApp в списке и включите разрешение."
            alert.addButton(withTitle: "OK")
            alert.addButton(withTitle: "Отмена")
            
            let response = alert.runModal()
            if response == .alertFirstButtonReturn {
                // Открываем системные настройки
                let prefpaneUrl = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")!
                NSWorkspace.shared.open(prefpaneUrl)
            }
        }
    }
}

struct SubTimer {
    let name: String
    var time: TimeInterval = 0
    var isRunning: Bool = false
    var lastStart: Date? = nil
}

struct TimerData: Identifiable {
    let id = UUID()
    let icon: String
    let color: Color
    var subTimers: [SubTimer]
    var currentSubTimerIndex: Int = 0
    
    var currentSubTimer: SubTimer {
        get { subTimers[currentSubTimerIndex] }
        set { subTimers[currentSubTimerIndex] = newValue }
    }
    
    var isRunning: Bool {
        get { currentSubTimer.isRunning }
        set { subTimers[currentSubTimerIndex].isRunning = newValue }
    }
    
    var time: TimeInterval {
        get { currentSubTimer.time }
        set { subTimers[currentSubTimerIndex].time = newValue }
    }
    
    var lastStart: Date? {
        get { currentSubTimer.lastStart }
        set { subTimers[currentSubTimerIndex].lastStart = newValue }
    }
}

class TimersViewModel: ObservableObject {
    @Published var timers: [TimerData] = [
        TimerData(icon: "💎", color: .blue, subTimers: [
            SubTimer(name: "main"), 
            SubTimer(name: "wb"), 
            SubTimer(name: "other")
        ]),
        TimerData(icon: "🎭", color: .purple, subTimers: [
            SubTimer(name: "music"), 
            SubTimer(name: "tt"), 
            SubTimer(name: "game")
        ]),
        TimerData(icon: "🍏", color: .green, subTimers: [
            SubTimer(name: "sport"), 
            SubTimer(name: "health"), 
            SubTimer(name: "walk")
        ]),
        TimerData(icon: "⚙️", color: .orange, subTimers: [
            SubTimer(name: "book"), 
            SubTimer(name: "table"), 
            SubTimer(name: "home")
        ])
    ]
    @Published var activeIndex: Int? = nil
    @Published var isCollapsed: Bool = false
    private var lastActiveIndex: Int = 0
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
            lastActiveIndex = index
        }
    }
    
    func toggleCollapsed() {
        isCollapsed.toggle()
    }
    
    func getDisplayedTimerIndex() -> Int {
        return activeIndex ?? lastActiveIndex
    }
    
    func switchSubTimer(_ timerIndex: Int) {
        // Останавливаем текущий таймер если он работает
        if timers[timerIndex].isRunning {
            timers[timerIndex].isRunning = false
            if let last = timers[timerIndex].lastStart {
                timers[timerIndex].time += Date().timeIntervalSince(last)
            }
            timers[timerIndex].lastStart = nil
            activeIndex = nil
        }
        
        // Переключаем на следующую подкатегорию по кругу
        timers[timerIndex].currentSubTimerIndex = (timers[timerIndex].currentSubTimerIndex + 1) % timers[timerIndex].subTimers.count
        
        // Принудительно обновляем интерфейс
        objectWillChange.send()
    }
    
    func switchToSpecificSubTimer(_ timerIndex: Int, _ subTimerIndex: Int) {
        // Останавливаем текущий таймер если он работает
        if timers[timerIndex].isRunning {
            timers[timerIndex].isRunning = false
            if let last = timers[timerIndex].lastStart {
                timers[timerIndex].time += Date().timeIntervalSince(last)
            }
            timers[timerIndex].lastStart = nil
            activeIndex = nil
        }
        
        // Переключаем на конкретную подкатегорию
        timers[timerIndex].currentSubTimerIndex = subTimerIndex
        
        // Принудительно обновляем интерфейс
        objectWillChange.send()
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
    @State private var pulseScale: CGFloat = 1.0
    @State private var animationTimer: Timer?
    @State private var rotationAngles: [Double] = [0, 0, 0, 0]
    
    var body: some View {
        VStack(spacing: 0) {
            if model.isCollapsed {
                // Свернутое состояние - показываем только один таймер
                let displayedIndex = model.getDisplayedTimerIndex()
                CollapsedTimerView(
                    timer: model.timers[displayedIndex],
                    timerIndex: displayedIndex,
                    isActive: model.activeIndex == displayedIndex,
                    pulseScale: pulseScale,
                    rotationAngle: rotationAngles[displayedIndex],
                    onToggle: {
                        model.toggleTimer(displayedIndex)
                        updatePulseAnimation()
                    },
                    onSwitchSubTimer: {
                        withAnimation(.easeInOut(duration: 0.5)) {
                            rotationAngles[displayedIndex] += 360
                        }
                        model.switchSubTimer(displayedIndex)
                        updatePulseAnimation()
                    }
                )
                .padding(1.6)
            } else {
                // Развернутое состояние - показываем все таймеры
                HStack(spacing: 12) {
                    ForEach(model.timers.indices, id: \.self) { i in
                        TimerColumnView(
                            timer: model.timers[i],
                            timerIndex: i,
                            isActive: model.activeIndex == i,
                            pulseScale: pulseScale,
                            rotationAngle: rotationAngles[i],
                            onToggle: {
                                model.toggleTimer(i)
                                updatePulseAnimation()
                            },
                            onSwitchSubTimer: {
                                withAnimation(.easeInOut(duration: 0.5)) {
                                    rotationAngles[i] += 360
                                }
                                model.switchSubTimer(i)
                                updatePulseAnimation()
                            },
                            onSwitchToSpecific: { subIndex in
                                withAnimation(.easeInOut(duration: 0.5)) {
                                    rotationAngles[i] += 360
                                }
                                model.switchSubTimer(i)
                                updatePulseAnimation()
                            }
                        )
                    }
                }
            }
            
            Spacer()
                .frame(height: 8)
        }
        .padding(model.isCollapsed ? 1.6 : 16)  // Уменьшенные отступы для свернутого состояния
        .background(Color.black.opacity(0.8))
        .cornerRadius(8)
        .onAppear {
            startPulseAnimation()
        }
        .onDisappear {
            stopPulseAnimation()
        }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("ToggleCollapse"))) { _ in
            print("ToggleCollapse notification received!")
            handleToggleCollapse()
        }
    }
    
    private func handleToggleCollapse() {
        withAnimation(.easeInOut(duration: 0.3)) {
            model.toggleCollapsed()
            print("Toggled collapsed state to: \(model.isCollapsed)")
            // Изменяем размер окна
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                updateWindowSize()
            }
        }
    }
    
    private func updatePulseAnimation() {
        if model.activeIndex != nil {
            startPulseAnimation()
        } else {
            stopPulseAnimation()
        }
    }
    
    private func startPulseAnimation() {
        stopPulseAnimation() // Останавливаем предыдущую анимацию
        
        guard model.activeIndex != nil else { return }
        
        animationTimer = Timer.scheduledTimer(withTimeInterval: 6.0, repeats: true) { _ in
            guard model.activeIndex != nil else {
                stopPulseAnimation()
                return
            }
            
            // Последовательность биения сердца: увеличение-уменьшение-увеличение-уменьшение-пауза
            DispatchQueue.main.async {
                // Первое биение
                pulseScale = 1.3
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    pulseScale = 1.0
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                        // Второе биение
                        pulseScale = 1.3
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                            pulseScale = 1.0
                            // Пауза 2 секунды до следующего цикла
                        }
                    }
                }
            }
        }
        
        // Запускаем первый цикл сразу
        animationTimer?.fire()
    }
    
    private func stopPulseAnimation() {
        animationTimer?.invalidate()
        animationTimer = nil
        pulseScale = 1.0
    }
    
    private func updateWindowSize() {
        guard let window = NSApplication.shared.windows.first else { return }
        
        let newWidth: CGFloat = model.isCollapsed ? 56 : 280  // Уменьшено для свернутого состояния
        let newHeight: CGFloat = model.isCollapsed ? 80 : 150
        
        var frame = window.frame
        frame.size = NSSize(width: newWidth, height: newHeight)
        window.setFrame(frame, display: true, animate: true)
    }
}

struct CollapsedTimerView: View {
    let timer: TimerData
    let timerIndex: Int
    let isActive: Bool
    let pulseScale: CGFloat
    let rotationAngle: Double
    let onToggle: () -> Void
    let onSwitchSubTimer: () -> Void
    
    @State private var localRotationAngle: Double = 0
    
    var body: some View {
        VStack(spacing: 0) {
            Button(action: onToggle) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(isActive ? Color.green : timer.color.opacity(0.6), lineWidth: 2)
                        .background(RoundedRectangle(cornerRadius: 10).fill(timer.color.opacity(0.2)))
                        .frame(width: 52, height: 52)
                    
                    VStack(spacing: 2) {
                        Text(timer.icon)
                            .font(.system(size: 18))
                            .scaleEffect(isActive ? pulseScale : 1.0)
                            .animation(.easeInOut(duration: 1.0), value: pulseScale)
                            .rotationEffect(.degrees(rotationAngle + localRotationAngle))
                            .animation(.easeInOut(duration: 0.5), value: localRotationAngle)
                        
                        Text(timer.currentSubTimer.name)
                            .font(.system(size: 10, weight: .medium, design: .rounded))
                            .foregroundColor(isActive ? .green : timer.color)
                    }
                }
            }
            .buttonStyle(PlainButtonStyle())
            .allowsHitTesting(true)
            
            Spacer()
                .frame(height: 4)
            
            // Только основное время и переключение подкатегорий по клику
            VStack(spacing: 0) {
                ZStack {
                    Text(timeString(for: timer, isActive: isActive))
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                        .foregroundColor(isActive ? .green : .white)
                    
                    if isActive, let seconds = secondsString(for: timer, isActive: true) {
                        Text(seconds)
                            .font(.system(size: 12, weight: .regular, design: .rounded))
                            .foregroundColor(.green)
                            .offset(x: 28)
                    }
                }
                .frame(width: 52)
            }
            .contentShape(Rectangle())
            .onTapGesture {
                performSwitchAnimation()
                onSwitchSubTimer()
            }
        }
    }
    
    func timeString(for timer: TimerData, isActive: Bool) -> String {
        let total = Int(timer.time)
        let hours = total / 3600
        let minutes = (total % 3600) / 60
        return String(format: "%d:%02d", hours, minutes)
    }
    
    func secondsString(for timer: TimerData, isActive: Bool) -> String? {
        if isActive {
            let total = Int(timer.time)
            let seconds = total % 60
            return String(format: ":%02d", seconds)
        }
        return nil
    }
    
    private func performSwitchAnimation() {
        withAnimation(.easeInOut(duration: 0.5)) {
            localRotationAngle += 360
        }
    }
}

struct TimerColumnView: View {
    let timer: TimerData
    let timerIndex: Int
    let isActive: Bool
    let pulseScale: CGFloat
    let rotationAngle: Double
    let onToggle: () -> Void
    let onSwitchSubTimer: () -> Void
    let onSwitchToSpecific: (Int) -> Void
    
    @State private var isAnimating = false
    @State private var localRotationAngle: Double = 0
    
    var body: some View {
        VStack(spacing: 0) {
            Button(action: onToggle) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(isActive ? Color.green : timer.color.opacity(0.6), lineWidth: 2)
                        .background(RoundedRectangle(cornerRadius: 10).fill(timer.color.opacity(0.2)))
                        .frame(width: 52, height: 52)
                    
                    VStack(spacing: 2) {
                        Text(timer.icon)
                            .font(.system(size: 18))
                            .scaleEffect(isActive ? pulseScale : 1.0)
                            .animation(.easeInOut(duration: 1.0), value: pulseScale)
                            .rotationEffect(.degrees(rotationAngle + localRotationAngle))
                            .animation(.easeInOut(duration: 0.5), value: localRotationAngle)
                        
                        Text(timer.currentSubTimer.name)
                            .font(.system(size: 10, weight: .medium, design: .rounded))
                            .foregroundColor(isActive ? .green : timer.color)
                    }
                }
            }
            .buttonStyle(PlainButtonStyle())
            .allowsHitTesting(true)
            
            Spacer()
                .frame(height: 4)
            
            // Кликабельная область для времени и неактивных подкатегорий
            VStack(spacing: -2) {
                ZStack {
                    Text(timeString(for: timer, isActive: isActive))
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                        .foregroundColor(isActive ? .green : .white)
                    
                    if isActive, let seconds = secondsString(for: timer, isActive: true) {
                        Text(seconds)
                            .font(.system(size: 12, weight: .regular, design: .rounded))
                            .foregroundColor(.green)
                            .offset(x: 28)
                    }
                }
                .frame(width: 52)
                
                VStack(spacing: 1) {
                    // Показываем следующие подкатегории в круговом порядке
                    let nextIndex1 = (timer.currentSubTimerIndex + 1) % timer.subTimers.count
                    let nextIndex2 = (timer.currentSubTimerIndex + 2) % timer.subTimers.count
                    
                    // Первая следующая подкатегория
                    HStack(spacing: 4) {
                        Text(timer.subTimers[nextIndex1].name)
                            .font(.system(size: 8, weight: .medium, design: .rounded))
                            .foregroundColor(timer.color.opacity(0.7))
                            .lineLimit(1)
                        
                        Text(subTimerTimeString(for: timer.subTimers[nextIndex1]))
                            .font(.system(size: 8, weight: .medium, design: .rounded))
                            .foregroundColor(.gray)
                    }
                    .frame(width: 70, height: 10)
                    
                    // Вторая следующая подкатегория
                    HStack(spacing: 4) {
                        Text(timer.subTimers[nextIndex2].name)
                            .font(.system(size: 8, weight: .medium, design: .rounded))
                            .foregroundColor(timer.color.opacity(0.7))
                            .lineLimit(1)
                        
                        Text(subTimerTimeString(for: timer.subTimers[nextIndex2]))
                            .font(.system(size: 8, weight: .medium, design: .rounded))
                            .foregroundColor(.gray)
                    }
                    .frame(width: 70, height: 10)
                }
            }
            .contentShape(Rectangle())
            .onTapGesture {
                performSwitchAnimation()
                onSwitchSubTimer()
            }
        }
    }
    
    func timeString(for timer: TimerData, isActive: Bool) -> String {
        let total = Int(timer.time)
        let hours = total / 3600
        let minutes = (total % 3600) / 60
        return String(format: "%d:%02d", hours, minutes)
    }
    
    func secondsString(for timer: TimerData, isActive: Bool) -> String? {
        if isActive {
            let total = Int(timer.time)
            let seconds = total % 60
            return String(format: ":%02d", seconds)
        }
        return nil
    }
    
    func subTimerTimeString(for subTimer: SubTimer) -> String {
        let total = Int(subTimer.time)
        let hours = total / 3600
        let minutes = (total % 3600) / 60
        return String(format: "%d:%02d", hours, minutes)
    }
    
    private func performSwitchAnimation() {
        withAnimation(.easeInOut(duration: 0.5)) {
            localRotationAngle += 360
        }
    }
} 