# 🌌 Celestial Bloom

> **Caelestia-inspired Dynamic Island & Shell for Windows 10/11**, powered by Tauri v2, Rust and React.

Celestial Bloom brings the fluid, modern Linux desktop experience (inspired by [Caelestia KDE](https://github.com/ladybug-me/caelestia-kde)) to Windows without the bloat.

---

## ✨ Features

- **3-Zone Modular Bar**:
  - **Left**: Reactive workspaces with elastic indicators (synchronized via GlazeWM IPC).
  - **Center**: Dynamic media island, volume HUD, and WASAPI audio spectrum visualizer.
  - **Right**: System status, battery percentage, and live clock.
- **Material You Dynamic Colors**: Automatically extracts color schemes from your desktop wallpaper in real time via the `material-colors` engine.
- **Smart Click-Through**: Empty space between capsules lets clicks pass through directly to windows and desktop behind it.
- **Ultra Lightweight**: Built on native Windows WebView2 and Rust (`windows-rs`). No heavy Electron or Python runtimes (~13 MB binary, <35 MB RAM).

---

## 🚀 Quick Download

1. Download the latest pre-compiled binary from [Releases](https://github.com/TheJDan/celestial-bloom/releases/latest).
2. Run `celestial-bloom.exe` (or `bloom.exe`) directly. No installation required.

---

## 🛠️ Development

### Prerequisites

- [Bun](https://bun.sh/) (latest)
- [Rust](https://www.rust-lang.org/) (stable)
- Windows 10/11 with MSVC Build Tools

```bash
# Clone the repository
git clone https://github.com/TheJDan/celestial-bloom.git
cd celestial-bloom

# Install dependencies
bun install

# Run in live development mode with Hot Reload
bun run tauri dev

# Build release executable
bun run tauri build --no-bundle
```

---

## 📜 License & Credits

- Licensed under **GPL-3.0**.
- Visual design inspired by **[Caelestia KDE](https://github.com/ladybug-me/caelestia-kde)**.
- Foundation based on **[Bloom](https://github.com/little-systems/bloom)**.
