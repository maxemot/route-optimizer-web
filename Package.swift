// swift-tools-version:5.5
import PackageDescription

let package = Package(
    name: "OverlayApp",
    platforms: [
        .macOS(.v11)
    ],
    targets: [
        .executableTarget(
            name: "OverlayApp",
            path: "Sources/OverlayApp"
        )
    ]
) 