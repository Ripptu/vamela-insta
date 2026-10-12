//! Alle Zugänge liegen ausschließlich im macOS-Schlüsselbund, nie in Dateien.

use security_framework::passwords::{delete_generic_password, get_generic_password, set_generic_password};

const SERVICE: &str = "de.vamela.vamelainsta";

pub fn set(key: &str, value: &str) -> Result<(), String> {
    let _ = delete_generic_password(SERVICE, key);
    set_generic_password(SERVICE, key, value.as_bytes()).map_err(|e| format!("Schlüsselbund: {e}"))
}

pub fn get(key: &str) -> Option<String> {
    get_generic_password(SERVICE, key).ok().and_then(|v| String::from_utf8(v).ok())
}

pub fn has(key: &str) -> bool {
    get(key).is_some()
}
