//! Nicht geheimer Einrichtungsstand, liegt in ~/Library/Application Support/VAMELA Insta/setup.json.

use serde::{Deserialize, Serialize};
use std::fs;

use crate::tools::support_dir;

pub const REPO_MAIN: &str = "vamela-insta";
pub const REPO_MEDIA: &str = "vamela-insta-media";
pub const IG_USER_ID: &str = "17841472270201994";
pub const IG_USERNAME: &str = "vamela.de";
pub const MAIL: &str = "stockmeier.ch@gmail.com";
pub const DRIVE_SUBFOLDERS: [&str; 8] = ["Fotos", "Marke", "Entwuerfe", "Aufnahmen", "Referenz", "Musik", "Vorlagen", "Archiv"];

#[derive(Serialize, Deserialize, Default, Clone)]
#[serde(default)]
pub struct SetupState {
    pub github_login: Option<String>,
    pub repos_ok: bool,
    pub claude_ok: bool,
    pub drive_folder: Option<String>,
    pub instagram_username: Option<String>,
    pub gmail_ok: bool,
    pub tiktok_keys: bool,
    pub tiktok_ok: bool,
    pub finished: bool,
}

pub fn load() -> SetupState {
    fs::read_to_string(support_dir().join("setup.json"))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save(s: &SetupState) {
    if let Ok(json) = serde_json::to_string_pretty(s) {
        let _ = fs::write(support_dir().join("setup.json"), json);
    }
}

pub fn update(f: impl FnOnce(&mut SetupState)) -> SetupState {
    let mut s = load();
    f(&mut s);
    save(&s);
    s
}
