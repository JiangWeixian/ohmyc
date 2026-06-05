use gray_matter::engine::YAML;
use gray_matter::Matter;
use serde_json::Value;

use crate::error::ApiError;

pub fn parse(raw: &str) -> Result<(Value, String), ApiError> {
    let matter = Matter::<YAML>::new();
    let parsed = matter.parse(raw);
    let frontmatter = match parsed.data {
        Some(pod) => {
            let value = pod
                .deserialize::<Value>()
                .map_err(|e| ApiError::Parse(format!("frontmatter: {e}")))?;
            // gray_matter is lenient — malformed YAML between `---` delimiters
            // can deserialize to `Null`. Every caller assumes the frontmatter
            // is a JSON object (uses `.get("name")` etc.), so reject here so
            // the failure is loud at the boundary instead of silently treating
            // every field as missing.
            if value.is_null() {
                return Err(ApiError::Parse(
                    "frontmatter: empty or unparseable YAML between --- delimiters".to_string(),
                ));
            }
            if !value.is_object() {
                return Err(ApiError::Parse(format!(
                    "frontmatter: expected YAML mapping, got {value}"
                )));
            }
            value
        }
        None => Value::Object(serde_json::Map::new()),
    };
    Ok((frontmatter, parsed.content.trim().to_string()))
}

pub fn stringify(frontmatter: &Value, content: &str) -> Result<String, ApiError> {
    if !frontmatter.is_object() {
        return Err(ApiError::Validation(
            "frontmatter must be a JSON object".to_string(),
        ));
    }
    let yaml = serde_yaml::to_string(frontmatter)
        .map_err(|e| ApiError::Internal(format!("serialize yaml: {e}")))?;
    let trimmed = yaml.trim_start_matches("---\n").trim_end();
    let body = content.trim_end();
    Ok(format!("---\n{trimmed}\n---\n{body}\n"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_yaml_frontmatter_and_body() {
        let raw = "---\nname: my-agent\ndescription: does stuff\n---\n\nBody text here.\n";
        let (front, body) = parse(raw).unwrap();
        assert_eq!(front["name"], "my-agent");
        assert_eq!(front["description"], "does stuff");
        assert_eq!(body, "Body text here.");
    }

    #[test]
    fn returns_empty_object_when_no_frontmatter() {
        let raw = "Just plain markdown.\n";
        let (front, body) = parse(raw).unwrap();
        assert!(front.is_object());
        assert_eq!(front.as_object().unwrap().len(), 0);
        assert_eq!(body, "Just plain markdown.");
    }

    #[test]
    fn preserves_arbitrary_frontmatter_fields() {
        let raw = "---\nname: x\ndescription: y\ncustom: [1, 2, 3]\nnested:\n  a: b\n---\nbody\n";
        let (front, _) = parse(raw).unwrap();
        assert_eq!(front["custom"], serde_json::json!([1, 2, 3]));
        assert_eq!(front["nested"]["a"], "b");
    }

    #[test]
    fn errors_on_malformed_yaml() {
        // Unterminated double-quoted scalar — YAML grammar requires the
        // closing quote, so gray_matter's underlying yaml-rust parser
        // rejects this with a scanner error.
        let raw = "---\nname: \"unterminated\n---\nbody\n";
        let err = parse(raw).expect_err("expected Err for unterminated quote");
        match err {
            ApiError::Parse(msg) => assert!(msg.contains("frontmatter"), "got: {msg}"),
            other => panic!("expected ApiError::Parse, got {other:?}"),
        }
    }

    #[test]
    fn stringify_writes_yaml_frontmatter_and_body() {
        let front = serde_json::json!({"name": "a", "description": "d"});
        let raw = stringify(&front, "Hello world").unwrap();
        assert!(raw.starts_with("---\n"));
        assert!(raw.contains("name: a"));
        assert!(raw.contains("description: d"));
        assert!(raw.ends_with("Hello world\n"));
        // Roundtrip
        let (parsed_front, body) = parse(&raw).unwrap();
        assert_eq!(parsed_front["name"], "a");
        assert_eq!(parsed_front["description"], "d");
        assert_eq!(body, "Hello world");
    }

    #[test]
    fn stringify_rejects_non_object_frontmatter() {
        let err = stringify(&serde_json::json!([1, 2]), "x").unwrap_err();
        assert!(matches!(err, ApiError::Validation(_)));
    }

    #[test]
    fn stringify_preserves_arbitrary_yaml_typed_values() {
        let front = serde_json::json!({"name": "x", "description": "y", "tools": ["A", "B"], "maxTurns": 5});
        let raw = stringify(&front, "body").unwrap();
        let (back, _) = parse(&raw).unwrap();
        assert_eq!(back["tools"], serde_json::json!(["A", "B"]));
        assert_eq!(back["maxTurns"], 5);
    }
}
