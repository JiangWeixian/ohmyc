//! Profile activation — the transactional state machine. Built up
//! across Tasks 5-9: helpers first (deep merge, env injection), then
//! forward path, then undo stack, then auto-restore-previous.

use serde_json::{json, Map, Value};

/// Recursive merge: object → object recurses, arrays/primitives in
/// `source` overwrite `target`. Mirrors TS `deepMerge` exactly.
pub(crate) fn deep_merge(target: &Value, source: &Value) -> Value {
    match (target, source) {
        (Value::Object(t), Value::Object(s)) => {
            let mut out = t.clone();
            for (k, v) in s {
                let merged = match out.get(k) {
                    Some(existing) => deep_merge(existing, v),
                    None => v.clone(),
                };
                out.insert(k.clone(), merged);
            }
            Value::Object(out)
        }
        _ => source.clone(),
    }
}

/// Build the 4-or-5 env var map for a model config. Mirrors the TS
/// `environmentVariables` literal in `activate` Step 10.
pub(crate) fn build_env_vars(
    api_key: &str,
    base_url: &str,
    model_name: Option<&str>,
) -> Map<String, Value> {
    let mut env = Map::new();
    env.insert("ANTHROPIC_AUTH_TOKEN".to_string(), Value::String(api_key.to_string()));
    env.insert("ANTHROPIC_BASE_URL".to_string(), Value::String(base_url.to_string()));
    env.insert("API_TIMEOUT_MS".to_string(), Value::String("3000000".to_string()));
    env.insert(
        "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC".to_string(),
        Value::String("1".to_string()),
    );
    if let Some(m) = model_name {
        if !m.is_empty() {
            env.insert("ANTHROPIC_MODEL".to_string(), Value::String(m.to_string()));
        }
    }
    env
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deep_merge_recurses_into_objects() {
        let t = json!({ "a": { "b": 1, "c": 2 }, "d": 3 });
        let s = json!({ "a": { "c": 99, "e": 4 } });
        let out = deep_merge(&t, &s);
        assert_eq!(out, json!({ "a": { "b": 1, "c": 99, "e": 4 }, "d": 3 }));
    }

    #[test]
    fn deep_merge_array_in_source_overwrites_target_array() {
        let t = json!({ "list": [1, 2, 3] });
        let s = json!({ "list": [4] });
        let out = deep_merge(&t, &s);
        assert_eq!(out, json!({ "list": [4] }));
    }

    #[test]
    fn deep_merge_source_primitive_replaces_target_object() {
        let t = json!({ "a": { "b": 1 } });
        let s = json!({ "a": "scalar" });
        let out = deep_merge(&t, &s);
        assert_eq!(out, json!({ "a": "scalar" }));
    }

    #[test]
    fn build_env_vars_includes_anthropic_model_when_set() {
        let env = build_env_vars("sk-x", "https://api", Some("claude-sonnet-4"));
        assert_eq!(env.get("ANTHROPIC_MODEL").unwrap(), "claude-sonnet-4");
        assert_eq!(env.get("API_TIMEOUT_MS").unwrap(), "3000000");
    }

    #[test]
    fn build_env_vars_omits_anthropic_model_when_empty_or_none() {
        let env = build_env_vars("sk-x", "https://api", None);
        assert!(env.get("ANTHROPIC_MODEL").is_none());
        let env_empty = build_env_vars("sk-x", "https://api", Some(""));
        assert!(env_empty.get("ANTHROPIC_MODEL").is_none());
    }
}
