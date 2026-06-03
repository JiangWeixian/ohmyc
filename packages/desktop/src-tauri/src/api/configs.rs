//! Tauri command wrappers for ohmyc-core::configs.

use ohmyc_core::configs::{self, HookEntry, LspEntry, McpEntry};
use ohmyc_core::error::ApiError;
use serde::Serialize;

#[derive(Serialize)]
pub struct McpResponse {
    #[serde(rename = "mcpServers")]
    pub mcp_servers: Vec<McpEntry>,
}

#[derive(Serialize)]
pub struct HooksResponse {
    pub hooks: Vec<HookEntry>,
}

#[derive(Serialize)]
pub struct LspResponse {
    #[serde(rename = "lspServers")]
    pub lsp_servers: Vec<LspEntry>,
}

#[tauri::command]
pub fn configs_mcp() -> Result<McpResponse, ApiError> {
    Ok(McpResponse { mcp_servers: configs::mcp_servers()? })
}

#[tauri::command]
pub fn configs_hooks() -> Result<HooksResponse, ApiError> {
    Ok(HooksResponse { hooks: configs::hooks()? })
}

#[tauri::command]
pub fn configs_lsp() -> Result<LspResponse, ApiError> {
    Ok(LspResponse { lsp_servers: configs::lsp_servers()? })
}
