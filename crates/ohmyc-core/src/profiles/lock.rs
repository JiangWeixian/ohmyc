//! Cross-process file-lock for profile activation. Mirrors the TS
//! `LockService` (proper-lockfile), but uses `fs2::FileExt` for
//! POSIX `flock` semantics. The guard releases on drop.

use std::fs::{File, OpenOptions};
use std::path::Path;

use fs2::FileExt;

use crate::error::ApiError;

const LOCK_FILENAME: &str = ".activation.lock";

/// RAII handle that holds an exclusive advisory lock on the activation
/// lock file. Released when the guard is dropped (or explicitly via
/// `release()`). Drop is best-effort — fs2 will release on process
/// exit even if we panic before drop runs.
#[derive(Debug)]
pub struct LockGuard {
    file: Option<File>,
}

impl LockGuard {
    /// Attempt to acquire the activation lock non-blockingly. Returns
    /// `ApiError::Conflict("Another activation is in progress...")` if
    /// another process or thread already holds it.
    pub fn try_acquire(profiles_dir: &Path) -> Result<Self, ApiError> {
        std::fs::create_dir_all(profiles_dir)
            .map_err(|e| ApiError::Io(format!("mkdir {}: {e}", profiles_dir.display())))?;
        let lock_path = profiles_dir.join(LOCK_FILENAME);
        let file = OpenOptions::new()
            .create(true)
            .write(true)
            .read(true)
            .open(&lock_path)
            .map_err(|e| ApiError::Io(format!("open lock {}: {e}", lock_path.display())))?;
        match file.try_lock_exclusive() {
            Ok(()) => Ok(Self { file: Some(file) }),
            Err(_) => Err(ApiError::Conflict(
                "Another activation is in progress. Wait a moment and try again.".to_string(),
            )),
        }
    }

    /// Explicit release. Drop also releases, but calling this surfaces
    /// any unlock errors (which Drop silently swallows).
    pub fn release(mut self) -> Result<(), ApiError> {
        if let Some(file) = self.file.take() {
            FileExt::unlock(&file)
                .map_err(|e| ApiError::Io(format!("unlock: {e}")))?;
        }
        Ok(())
    }
}

impl Drop for LockGuard {
    fn drop(&mut self) {
        if let Some(file) = self.file.take() {
            let _ = FileExt::unlock(&file);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn acquire_creates_lock_file_and_holds_until_drop() {
        let dir = tempfile::tempdir().unwrap();
        let guard = LockGuard::try_acquire(dir.path()).unwrap();
        assert!(dir.path().join(LOCK_FILENAME).exists());
        drop(guard);
        let g2 = LockGuard::try_acquire(dir.path()).unwrap();
        drop(g2);
    }

    #[test]
    fn second_acquire_returns_conflict_when_first_still_held() {
        let dir = tempfile::tempdir().unwrap();
        let _g1 = LockGuard::try_acquire(dir.path()).unwrap();
        let err = LockGuard::try_acquire(dir.path()).unwrap_err();
        match err {
            ApiError::Conflict(msg) => {
                assert!(msg.contains("Another activation is in progress"));
            }
            other => panic!("expected Conflict, got {other:?}"),
        }
    }

    #[test]
    fn explicit_release_succeeds_and_allows_reacquire() {
        let dir = tempfile::tempdir().unwrap();
        let g1 = LockGuard::try_acquire(dir.path()).unwrap();
        g1.release().unwrap();
        let _g2 = LockGuard::try_acquire(dir.path()).unwrap();
    }
}
