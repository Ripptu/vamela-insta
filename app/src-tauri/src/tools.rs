use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};

pub fn home() -> PathBuf {
    PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| "/Users/test".into()))
}

/// Programme aus dem Dock starten mit einem kargen PATH. Deshalb alle Werkzeuge mit festem Pfad.
pub fn base_path() -> String {
    let h = home();
    format!(
        "{}:{}:{}:/usr/bin:/bin:/usr/sbin:/sbin",
        h.join(".local/bin").display(),
        h.join(".local/node/bin").display(),
        h.join(".local/ffmpeg/bin").display()
    )
}

pub fn gh() -> PathBuf {
    home().join(".local/bin/gh")
}

pub fn rclone() -> PathBuf {
    home().join(".local/bin/rclone")
}

/// Die Claude-CLI liegt nicht im PATH. Die Desktop-App bringt sie mit, der Ordner trägt die Versionsnummer.
pub fn claude() -> Option<PathBuf> {
    for p in [home().join(".local/bin/claude"), PathBuf::from("/usr/local/bin/claude")] {
        if p.exists() {
            return Some(p);
        }
    }
    let base = home().join("Library/Application Support/Claude/claude-code");
    let mut versions: Vec<(Vec<u64>, PathBuf)> = fs::read_dir(&base)
        .ok()?
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            let key: Vec<u64> = name.split('.').filter_map(|p| p.parse().ok()).collect();
            // Ältere Desktop-App-Versionen legen claude.app direkt in den Versionsordner, neuere eine Hash-Ebene darunter
            let direkt = e.path().join("claude.app/Contents/MacOS/claude");
            let bin = if direkt.exists() {
                Some(direkt)
            } else {
                fs::read_dir(e.path()).ok()?.filter_map(|u| u.ok()).map(|u| u.path().join("claude.app/Contents/MacOS/claude")).find(|p| p.exists())
            };
            if key.is_empty() { None } else { bin.map(|b| (key, b)) }
        })
        .collect();
    versions.sort();
    versions.pop().map(|(_, p)| p)
}

pub fn support_dir() -> PathBuf {
    let d = home().join("Library/Application Support/VAMELA Insta");
    let _ = fs::create_dir_all(&d);
    d
}

pub fn log(msg: &str) {
    let d = home().join("Library/Logs/VAMELA Insta");
    let _ = fs::create_dir_all(&d);
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(d.join("app.log")) {
        let _ = writeln!(f, "{} {}", chrono::Local::now().format("%Y-%m-%d %H:%M:%S"), msg);
    }
}

pub struct Output {
    pub ok: bool,
    pub stdout: String,
    pub stderr: String,
}

/// Führt ein Programm aus. `input` geht über stdin, damit Geheimnisse nie in der Prozessliste stehen.
pub fn run(cmd: &PathBuf, args: &[&str], input: Option<&str>, envs: &[(&str, &str)]) -> Output {
    let mut c = Command::new(cmd);
    c.args(args)
        .env("PATH", base_path())
        .env("GH_PROMPT_DISABLED", "1")
        .stdin(if input.is_some() { Stdio::piped() } else { Stdio::null() })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    for (k, v) in envs {
        c.env(k, v);
    }
    let child = match c.spawn() {
        Ok(ch) => ch,
        Err(e) => {
            return Output { ok: false, stdout: String::new(), stderr: format!("{} nicht startbar: {e}", cmd.display()) };
        }
    };
    let mut child = child;
    if let (Some(text), Some(mut stdin)) = (input, child.stdin.take()) {
        let _ = stdin.write_all(text.as_bytes());
    }
    match child.wait_with_output() {
        Ok(o) => Output {
            ok: o.status.success(),
            stdout: String::from_utf8_lossy(&o.stdout).trim().to_string(),
            stderr: String::from_utf8_lossy(&o.stderr).trim().to_string(),
        },
        Err(e) => Output { ok: false, stdout: String::new(), stderr: e.to_string() },
    }
}

pub fn open_url(url: &str) {
    let _ = Command::new("/usr/bin/open").arg(url).spawn();
}

/// Entfernt Terminal-Steuerzeichen aus der Ausgabe von Programmen, die ein Terminal erwarten.
pub fn strip_ansi(s: &str) -> String {
    let re = regex::Regex::new(r"\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(\x07|\x1b\\)|\x1b[()][A-Z0-9]|\x1b[=>]").unwrap();
    re.replace_all(s, "").to_string()
}
