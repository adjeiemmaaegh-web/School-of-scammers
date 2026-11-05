# Physical device and browser acceptance — OPEN
Date: 5 November 2026

Automated GitHub CI tests Linux Chrome/Firefox/WebKit, mobile-sized viewports and no-WebGL fallback. Those runs do **not** mean physical low-spec Windows, installed Edge, genuine Safari or actual phones have been verified.

## Execute on actual hardware and record evidence
- **Low-spec Windows:** Record Windows version/build, CPU model, physical 8 GB memory or less, iGPU/no-GPU status, storage free space, browser versions. Launch the hosted application online and then offline. Record first load, cached reload, memory consumption, CPU load, startup time, simulation scan rate and browser console errors; test hardware throttling/long sessions and recovery. The budget and pass threshold require owner/instructor approval.
- **Microsoft Edge:** On an actual Windows device, test ladder editor, controller scan loop, imported projects, wiring, DC meter, four 3D scenes, force table, reference CSV and recovery from damaged local storage. Collect screenshots, console output and a signed result.
- **Safari:** Test macOS Safari and iPhone/iPad Safari separately; verify service worker support, direct route navigation, editor inputs, canvas fallback, zoom, keyboard/VoiceOver and offline reload. Linux WebKit automation is not a substitute.
- **Mobile:** At least a real Android and iOS device; exercise 390px equivalent layouts, touch/drag alternatives, local files, offline shell, browser storage quotas and export/reimport.

## Evidence manifest
For each distinct tested machine/device, record date/time, observer, browser build, exact Git SHA/version URL, device/hardware, test steps, measured numbers, screenshots and pass/fail/issue links. A simulated/emulated viewport must be clearly labeled as such.

**Gate stays OPEN** until actual physical-device evidence exists. A green GitHub runner is not owner-owned 8 GB hardware.
