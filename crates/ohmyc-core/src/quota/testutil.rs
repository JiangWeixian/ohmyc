//! Hermetic test helpers shared by every quota test: one global env lock,
//! save/restore env guards, and a fixed-response HTTP server built on
//! `std::net::TcpListener` (no mockito-style dependencies).

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::Duration;

/// Serializes every test that touches process environment variables. The
/// per-module locks used elsewhere in this crate are not enough here: quota
/// tests in different modules share the same `OHMYC_QUOTA_*` variables.
pub(crate) static ENV_LOCK: Mutex<()> = Mutex::new(());

/// Sets an env var and restores the previous value on drop.
pub(crate) struct EnvGuard {
    key: &'static str,
    prev: Option<String>,
}

impl EnvGuard {
    pub(crate) fn set(key: &'static str, value: &str) -> Self {
        let prev = std::env::var(key).ok();
        std::env::set_var(key, value);
        Self { key, prev }
    }

    pub(crate) fn unset(key: &'static str) -> Self {
        let prev = std::env::var(key).ok();
        std::env::remove_var(key);
        Self { key, prev }
    }
}

impl Drop for EnvGuard {
    fn drop(&mut self) {
        match &self.prev {
            Some(value) => std::env::set_var(self.key, value),
            None => std::env::remove_var(self.key),
        }
    }
}

/// A throwaway HTTP/1.1 server on 127.0.0.1 that answers every request with
/// the same fixed status/headers/body. Enough to drive provider fetch logic.
pub(crate) struct MiniServer {
    pub(crate) url: String,
    shutdown: Arc<AtomicBool>,
    handle: Option<JoinHandle<()>>,
}

impl MiniServer {
    pub(crate) fn respond(status: u16, extra_headers: &[(&str, &str)], body: &str) -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let addr = listener.local_addr().unwrap();
        let shutdown = Arc::new(AtomicBool::new(false));
        let flag = Arc::clone(&shutdown);
        let extra: Vec<(String, String)> = extra_headers
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect();
        let body = body.to_string();
        let handle = std::thread::spawn(move || loop {
            if flag.load(Ordering::SeqCst) {
                break;
            }
            match listener.accept() {
                Ok((mut stream, _)) => {
                    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
                    read_request(&mut stream);
                    let mut response = format!(
                        "HTTP/1.1 {status} {}\r\ncontent-length: {}\r\nconnection: close\r\n",
                        reason_phrase(status),
                        body.len()
                    );
                    for (name, value) in &extra {
                        response.push_str(&format!("{name}: {value}\r\n"));
                    }
                    response.push_str("\r\n");
                    response.push_str(&body);
                    let _ = stream.write_all(response.as_bytes());
                    let _ = stream.flush();
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(Duration::from_millis(5));
                }
                Err(_) => break,
            }
        });
        Self {
            url: format!("http://{addr}"),
            shutdown,
            handle: Some(handle),
        }
    }
}

impl Drop for MiniServer {
    fn drop(&mut self) {
        self.shutdown.store(true, Ordering::SeqCst);
        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }
    }
}

fn reason_phrase(status: u16) -> &'static str {
    match status {
        200 => "OK",
        401 => "Unauthorized",
        403 => "Forbidden",
        429 => "Too Many Requests",
        500 => "Internal Server Error",
        _ => "Status",
    }
}

/// Consume one request: headers up to `\r\n\r\n`, then the exact
/// `content-length` body, so the client sees a well-formed exchange.
fn read_request(stream: &mut TcpStream) {
    let mut buf = Vec::new();
    let mut chunk = [0u8; 4096];
    let header_end = loop {
        match stream.read(&mut chunk) {
            Ok(0) => return,
            Ok(n) => {
                buf.extend_from_slice(&chunk[..n]);
                if let Some(pos) = find_subslice(&buf, b"\r\n\r\n") {
                    break pos;
                }
            }
            Err(_) => return,
        }
    };
    let headers = String::from_utf8_lossy(&buf[..header_end]);
    let content_length: usize = headers
        .lines()
        .filter_map(|line| line.split_once(':'))
        .find(|(name, _)| name.trim().eq_ignore_ascii_case("content-length"))
        .and_then(|(_, value)| value.trim().parse().ok())
        .unwrap_or(0);
    let mut body_bytes = buf.len() - (header_end + 4);
    while body_bytes < content_length {
        match stream.read(&mut chunk) {
            Ok(0) => break,
            Ok(n) => body_bytes += n,
            Err(_) => break,
        }
    }
}

fn find_subslice(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack.windows(needle.len()).position(|w| w == needle)
}
