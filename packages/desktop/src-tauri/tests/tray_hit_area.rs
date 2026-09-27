// AppKit must be tested on the process main thread, not libtest's worker threads.
#[cfg(target_os = "macos")]
fn main() {
    use objc2::MainThreadMarker;
    use objc2_foundation::{NSPoint, NSRect, NSSize};
    use ohmyc_desktop_lib::tray_stats::macos::resize_hit_targets;

    let mtm = MainThreadMarker::new().expect("AppKit main thread");
    let tray = tray_icon::TrayIconBuilder::new().build().unwrap();
    let item = tray.ns_status_item().unwrap();
    let button = item.button(mtm).unwrap();
    let target = button
        .subviews()
        .into_iter()
        .find(|view| view.class().name().to_bytes() == b"TaoTrayTarget")
        .expect("tray-icon click receiver");
    // Reproduce the original small-icon hit area before the metrics widen it.
    target.setFrame(NSRect::new(NSPoint::ZERO, NSSize::new(22.0, 22.0)));
    item.setLength(128.0);
    button.setFrameSize(NSSize::new(128.0, 22.0));
    let sessions_point = NSPoint::new(96.0, 11.0);
    assert!(target.hitTest(sessions_point).is_none(), "reproduce old dead area");
    resize_hit_targets(&button);
    for x in [4.0, 32.0, 64.0, 96.0, 124.0] {
        assert!(
            target.hitTest(NSPoint::new(x, 11.0)).is_some(),
            "unhandled click at {x}"
        );
    }
    // A later native layout change must not recreate the dead area.
    button.setFrameSize(NSSize::new(144.0, 24.0));
    assert!(target.hitTest(NSPoint::new(140.0, 12.0)).is_some());
    println!("Native tray hit-area regression passed across both metric columns.");
}

#[cfg(not(target_os = "macos"))]
fn main() {}
