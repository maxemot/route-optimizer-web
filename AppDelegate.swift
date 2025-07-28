import Cocoa

@main
class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    var overlayView: OverlayView!
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Создаем окно
        let screenFrame = NSScreen.main?.frame ?? .zero
        let windowSize = NSSize(width: 50, height: 50)
        let windowFrame = NSRect(
            x: screenFrame.maxX - windowSize.width - 20,
            y: screenFrame.maxY - windowSize.height - 20,
            width: windowSize.width,
            height: windowSize.height
        )
        
        window = NSWindow(
            contentRect: windowFrame,
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        
        // Настраиваем окно
        window.level = .floating
        window.backgroundColor = .clear
        window.isOpaque = false
        window.hasShadow = false
        window.ignoresMouseEvents = true
        
        // Создаем и добавляем view
        overlayView = OverlayView(frame: window.contentView!.bounds)
        window.contentView = overlayView
        
        // Показываем окно
        window.makeKeyAndOrderFront(nil)
    }
}

class OverlayView: NSView {
    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        
        // Создаем красный кружок
        let circlePath = NSBezierPath(ovalIn: bounds)
        NSColor.red.setFill()
        circlePath.fill()
    }
} 