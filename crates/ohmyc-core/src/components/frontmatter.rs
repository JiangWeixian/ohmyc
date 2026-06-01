use gray_matter::engine::YAML;
use gray_matter::Matter;
use serde_json::Value;

use crate::error::ApiError;

pub fn parse(raw: &str) -> Result<(Value, String), ApiError> {
    let matter = Matter::<YAML>::new();
    let parsed = matter.parse(raw);
    let frontmatter = match parsed.data {
        Some(pod) => pod
            .deserialize::<Value>()
            .map_err(|e| ApiError::Parse(format!("frontmatter: {e}")))?,
        None => Value::Object(serde_json::Map::new()),
    };
    Ok((frontmatter, parsed.content.trim().to_string()))
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
        let raw = "---\nkey:\n  - a\n - b\n---\nbody\n";
        let result = parse(raw);
        if let Err(ApiError::Parse(msg)) = &result {
            assert!(msg.contains("frontmatter"));
        }
    }
}
