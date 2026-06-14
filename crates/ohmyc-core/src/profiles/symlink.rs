//! Symlink helpers used by activation to expose store components inside
//! the profile dir. Unix-only for now: `std::os::unix::fs::symlink`
//! handles both file and directory targets. Windows compilation returns
//! `ApiError::Internal` — Windows symlinks require admin or Developer
//! Mode and are a separate portability slice.

use std::path::Path;

use crate::error::ApiError;

/// Create a symbolic link `dest -> source`. If `dest` already exists
/// (file, dir, or broken symlink), it is removed first. Mirrors the TS
/// `try { await lstat(destination); await unlink(destination) } catch
/// {} await symlink(source, destination)` pattern.
///
/// On Unix, a single `symlink` syscall handles both file and dir
/// targets — pass the same target type the caller expects.
pub fn create_symlink(source: &Path, dest: &Path) -> Result<(), ApiError> {
    #[cfg(unix)]
    {
        if dest.symlink_metadata().is_ok() {
            if dest.is_dir() && !dest.is_symlink() {
                std::fs::remove_dir_all(dest).map_err(|e| ApiError::Io(format!("remove {}: {e}", dest.display())))?;
            } else {
                std::fs::remove_file(dest).map_err(|e| ApiError::Io(format!("remove {}: {e}", dest.display())))?;
            }
        }
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent).map_err(|e| ApiError::Io(format!("mkdir {}: {e}", parent.display())))?;
        }
        std::os::unix::fs::symlink(source, dest)
            .map_err(|e| ApiError::Io(format!("symlink {} -> {}: {e}", dest.display(), source.display())))?;
        Ok(())
    }
    #[cfg(not(unix))]
    {
        let _ = (source, dest);
        Err(ApiError::Internal(
            "symlinks not supported on this platform yet (slice 7b is Unix-only)".to_string(),
        ))
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    #[test]
    fn creates_file_symlink() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("source.md");
        std::fs::write(&source, "hello").unwrap();
        let dest = dir.path().join("sub").join("link.md");
        create_symlink(&source, &dest).unwrap();
        assert!(dest.symlink_metadata().unwrap().file_type().is_symlink());
        assert_eq!(std::fs::read_to_string(&dest).unwrap(), "hello");
    }

    #[test]
    fn creates_dir_symlink() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("source-dir");
        std::fs::create_dir_all(source.join("nested")).unwrap();
        std::fs::write(source.join("nested").join("inner.txt"), "x").unwrap();
        let dest = dir.path().join("link-dir");
        create_symlink(&source, &dest).unwrap();
        assert!(dest.symlink_metadata().unwrap().file_type().is_symlink());
        assert!(dest.join("nested").join("inner.txt").exists());
    }

    #[test]
    fn replaces_existing_destination_file() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("source.md");
        std::fs::write(&source, "new").unwrap();
        let dest = dir.path().join("dest.md");
        std::fs::write(&dest, "old").unwrap();
        create_symlink(&source, &dest).unwrap();
        assert!(dest.symlink_metadata().unwrap().file_type().is_symlink());
        assert_eq!(std::fs::read_to_string(&dest).unwrap(), "new");
    }

    #[test]
    fn replaces_existing_dir_destination() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("source-dir");
        std::fs::create_dir_all(&source).unwrap();
        std::fs::write(source.join("a.txt"), "from-source").unwrap();
        let dest = dir.path().join("dest-dir");
        std::fs::create_dir_all(&dest).unwrap();
        std::fs::write(dest.join("b.txt"), "from-old-dest").unwrap();
        create_symlink(&source, &dest).unwrap();
        assert!(dest.symlink_metadata().unwrap().file_type().is_symlink());
        assert!(dest.join("a.txt").exists());
        assert!(!dest.join("b.txt").exists());
    }
}
