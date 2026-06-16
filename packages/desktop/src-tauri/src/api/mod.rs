pub mod agents;
pub mod commands;
pub mod configs;
pub mod plugins;
pub mod settings;
pub mod skills;
pub mod store;
pub mod timeline;

/// The frontend Source Switcher may pass `origins` as either a comma-separated
/// string (e.g. `"claude,opencode"`, matching the legacy fetch URL shape) or
/// as an array of strings. `None` means "all sources" — return everything.
/// Other JSON shapes fall through to permissive (true) — we'd rather show
/// data than silently hide it on a frontend mistake.
pub fn include_origin(filter: &Option<serde_json::Value>, target: &str) -> bool {
    let Some(v) = filter.as_ref() else {
        return true;
    };
    match v {
        serde_json::Value::String(s) => s.split(',').any(|p| p.trim() == target),
        serde_json::Value::Array(items) => items.iter().any(|i| i.as_str() == Some(target)),
        _ => true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value};

    fn check(v: Option<Value>, target: &str) -> bool {
        include_origin(&v, target)
    }

    #[test]
    fn none_includes_everything() {
        assert!(check(None, "claude"));
        assert!(check(None, "opencode"));
    }

    #[test]
    fn comma_string_matches_when_target_listed() {
        assert!(check(Some(json!("claude,opencode")), "claude"));
        assert!(check(Some(json!("claude,opencode")), "opencode"));
        assert!(!check(Some(json!("opencode")), "claude"));
        assert!(check(Some(json!("claude, opencode")), "opencode")); // whitespace
    }

    #[test]
    fn array_matches_when_target_listed() {
        assert!(check(Some(json!(["claude", "opencode"])), "claude"));
        assert!(check(Some(json!(["claude", "opencode"])), "opencode"));
        assert!(!check(Some(json!(["opencode"])), "claude"));
    }

    #[test]
    fn empty_collections_match_nothing() {
        assert!(!check(Some(json!("")), "claude"));
        assert!(!check(Some(json!([])), "claude"));
    }

    #[test]
    fn other_json_shapes_fall_through_to_permissive() {
        // Hard fail would silently hide data on a frontend mistake — prefer
        // permissive so the user at least sees something.
        assert!(check(Some(json!({})), "claude"));
        assert!(check(Some(json!(42)), "claude"));
        assert!(check(Some(json!(null)), "claude"));
    }
}
