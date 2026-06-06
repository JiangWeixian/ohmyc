//! Canonical error type returned by every ohmyc-core operation.
//! Serializes to a stable JSON shape consumed by the frontend
//! transport layer.

use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error, Serialize)]
#[serde(tag = "code", content = "detail")]
pub enum ApiError {
    #[error("not found: {kind} '{name}'")]
    NotFound { kind: &'static str, name: String },

    #[error("invalid input: {0}")]
    InvalidInput(String),

    #[error("io error: {0}")]
    Io(String),

    #[error("parse error: {0}")]
    Parse(String),

    #[error("conflict: {0}")]
    Conflict(String),

    /// Structured Conflict for safe-delete: lists profile names that
    /// reference the component. UI reads `detail.referencedBy` to render
    /// the confirmation dialog and offer force-delete.
    #[error("{kind} '{name}' is referenced by {} profile(s)", profiles.len())]
    ReferencedBy {
        kind: &'static str,
        name: String,
        #[serde(rename = "referencedBy")]
        profiles: Vec<String>,
    },

    #[error("validation error: {0}")]
    Validation(String),

    #[error("internal error: {0}")]
    Internal(String),
}

impl From<std::io::Error> for ApiError {
    fn from(value: std::io::Error) -> Self {
        ApiError::Io(value.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn not_found_serializes_with_code_and_detail() {
        let err = ApiError::NotFound { kind: "profile", name: "missing".to_string() };
        let json = serde_json::to_value(&err).unwrap();
        assert_eq!(json["code"], "NotFound");
        assert_eq!(json["detail"]["kind"], "profile");
        assert_eq!(json["detail"]["name"], "missing");
    }

    #[test]
    fn invalid_input_serializes_with_string_detail() {
        let err = ApiError::InvalidInput("missing field".to_string());
        let json = serde_json::to_value(&err).unwrap();
        assert_eq!(json["code"], "InvalidInput");
        assert_eq!(json["detail"], "missing field");
    }

    #[test]
    fn io_error_converts_via_from() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "no such file");
        let api_err: ApiError = io_err.into();
        match api_err {
            ApiError::Io(msg) => assert!(msg.contains("no such file")),
            _ => panic!("expected ApiError::Io"),
        }
    }

    #[test]
    fn validation_serializes_with_code_and_string_detail() {
        let err = ApiError::Validation("content must be a JSON object".to_string());
        let json = serde_json::to_value(&err).unwrap();
        assert_eq!(json["code"], "Validation");
        assert_eq!(json["detail"], "content must be a JSON object");
    }

    #[test]
    fn display_includes_variant_specific_message() {
        let err = ApiError::Conflict("already active".to_string());
        assert_eq!(format!("{err}"), "conflict: already active");
    }

    #[test]
    fn referenced_by_serializes_with_structured_detail() {
        let err = ApiError::ReferencedBy {
            kind: "agent",
            name: "alpha".to_string(),
            profiles: vec!["dev".to_string(), "prod".to_string()],
        };
        let json = serde_json::to_value(&err).unwrap();
        assert_eq!(json["code"], "ReferencedBy");
        assert_eq!(json["detail"]["kind"], "agent");
        assert_eq!(json["detail"]["name"], "alpha");
        assert_eq!(json["detail"]["referencedBy"], serde_json::json!(["dev", "prod"]));
    }
}
