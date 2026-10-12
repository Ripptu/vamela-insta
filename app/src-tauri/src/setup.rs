//! Einrichtungsassistent: jede Verbindung einmal herstellen, im Schlüsselbund ablegen
//! und als Actions-Secret ins private Repository übertragen.

use serde::Serialize;
use std::io::{BufRead, BufReader, Read, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

use crate::keychain;
use crate::state::{self, SetupState, DRIVE_SUBFOLDERS, IG_USERNAME, IG_USER_ID, MAIL, REPO_MAIN, REPO_MEDIA};
use crate::tools::{self, log, run};

/// Laufende `claude setup-token`-Sitzung, damit der Assistent Eingaben durchreichen kann.
#[derive(Default)]
pub struct ClaudeSession {
    pub stdin: Mutex<Option<ChildStdin>>,
    pub child: Mutex<Option<Child>>,
}

#[derive(Serialize, Clone)]
struct Done {
    ok: bool,
    detail: String,
}

fn done(app: &AppHandle, event: &str, ok: bool, detail: impl Into<String>) {
    let detail = detail.into();
    log(&format!("{event}: {} {detail}", if ok { "ok" } else { "Fehler" }));
    let _ = app.emit(event, Done { ok, detail });
}

fn owner() -> Result<String, String> {
    state::load().github_login.ok_or_else(|| "Zuerst GitHub verbinden.".to_string())
}

fn set_secret(name: &str, value: &str) -> Result<(), String> {
    let repo = format!("{}/{}", owner()?, REPO_MAIN);
    let token = keychain::get("github_token").unwrap_or_default();
    let o = run(&tools::gh(), &["secret", "set", name, "-R", &repo], Some(value), &[("GH_TOKEN", &token)]);
    if o.ok { Ok(()) } else { Err(format!("Secret {name}: {}", o.stderr)) }
}

#[tauri::command]
pub fn get_state() -> SetupState {
    state::load()
}

#[tauri::command]
pub fn open_url(url: String) {
    if url.starts_with("https://") {
        tools::open_url(&url);
    }
}

// ---------- GitHub ----------

/// Anmeldung über den Device-Flow der GitHub CLI: Code anzeigen, Browser öffnen, fertig.
#[tauri::command]
pub fn github_login(app: AppHandle) {
    std::thread::spawn(move || {
        let mut child = match Command::new(tools::gh())
            .args(["auth", "login", "--hostname", "github.com", "--git-protocol", "https", "--web", "--scopes", "repo,workflow"])
            .env("PATH", tools::base_path())
            .env("BROWSER", "true")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
        {
            Ok(c) => c,
            Err(e) => return done(&app, "github:done", false, format!("GitHub CLI nicht startbar: {e}")),
        };
        if let Some(mut stdin) = child.stdin.take() {
            let _ = stdin.write_all(b"\n");
        }
        let code_re = regex::Regex::new(r"([A-Z0-9]{4}-[A-Z0-9]{4})").unwrap();
        if let Some(err) = child.stderr.take() {
            for line in BufReader::new(err).lines().map_while(Result::ok) {
                if let Some(c) = code_re.captures(&line) {
                    let _ = app.emit("github:code", c[1].to_string());
                    tools::open_url("https://github.com/login/device");
                }
            }
        }
        let status = child.wait();
        if !status.map(|s| s.success()).unwrap_or(false) {
            return done(&app, "github:done", false, "Anmeldung abgebrochen oder fehlgeschlagen.");
        }
        let token = run(&tools::gh(), &["auth", "token"], None, &[]);
        if !token.ok {
            return done(&app, "github:done", false, token.stderr);
        }
        if let Err(e) = keychain::set("github_token", &token.stdout) {
            return done(&app, "github:done", false, e);
        }
        let user = run(&tools::gh(), &["api", "user", "--jq", ".login"], None, &[("GH_TOKEN", &token.stdout)]);
        if !user.ok {
            return done(&app, "github:done", false, user.stderr);
        }
        state::update(|s| s.github_login = Some(user.stdout.clone()));
        done(&app, "github:done", true, user.stdout);
    });
}

/// Legt das private Haupt- und das öffentliche Medien-Repository an, falls sie fehlen.
#[tauri::command]
pub async fn github_repos() -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let owner = owner()?;
        let token = keychain::get("github_token").ok_or("GitHub-Zugang fehlt im Schlüsselbund.")?;
        let env = [("GH_TOKEN", token.as_str())];
        let mut out = vec![];
        for (name, vis, desc) in [
            (REPO_MAIN, "--private", "Instagram-Automatik für @vamela.de"),
            (REPO_MEDIA, "--public", "Nur fertige Beitragsdateien, werden nach dem Veröffentlichen gelöscht"),
        ] {
            let full = format!("{owner}/{name}");
            if run(&tools::gh(), &["repo", "view", &full, "--json", "name"], None, &env).ok {
                out.push(format!("{full} war schon da"));
                continue;
            }
            let args = ["repo", "create", full.as_str(), vis, "--description", desc, "--add-readme"];
            let o = run(&tools::gh(), &args, None, &env);
            if !o.ok {
                return Err(format!("{full}: {}", o.stderr));
            }
            out.push(format!("{full} angelegt"));
        }
        state::update(|s| s.repos_ok = true);
        log(&format!("Repositories: {}", out.join(", ")));
        Ok(out)
    })
    .await
    .map_err(|e| e.to_string())?
}

// ---------- Claude-Abo ----------

fn find_token(text: &str) -> Option<String> {
    let clean = tools::strip_ansi(text);
    let start = clean.find("sk-ant-oat")?;
    let mut token = String::new();
    let mut chars = clean[start..].chars().peekable();
    while let Some(c) = chars.next() {
        if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
            token.push(c);
        } else if (c == '\r' || c == '\n') && token.len() < 100 {
            // Umbruch mitten im Token: Leerraum überspringen und weiterlesen.
            while chars.peek().is_some_and(|n| n.is_whitespace()) {
                chars.next();
            }
        } else {
            break;
        }
    }
    (token.len() > 60).then_some(token)
}

fn store_claude_token(token: &str) -> Result<(), String> {
    keychain::set("claude_oauth_token", token)?;
    set_secret("CLAUDE_CODE_OAUTH_TOKEN", token)?;
    state::update(|s| s.claude_ok = true);
    Ok(())
}

/// Startet `claude setup-token` in einem Pseudo-Terminal und fängt den Token aus der Ausgabe.
#[tauri::command]
pub fn claude_setup(app: AppHandle, session: State<'_, ClaudeSession>) -> Result<(), String> {
    let bin = tools::claude().ok_or("Claude CLI nicht gefunden. Ist die Claude-Desktop-App installiert?")?;
    if let Some(mut old) = session.child.lock().unwrap().take() {
        let _ = old.kill();
    }
    let mut child = Command::new("/usr/bin/script")
        .args(["-q", "/dev/null", "/bin/sh", "-c", "stty cols 400 rows 60; exec \"$0\" setup-token"])
        .arg(&bin)
        .env("PATH", tools::base_path())
        .env("TERM", "xterm-256color")
        .env("COLUMNS", "400")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Claude CLI nicht startbar: {e}"))?;
    let mut stdout = child.stdout.take().ok_or("keine Ausgabe")?;
    *session.stdin.lock().unwrap() = child.stdin.take();
    *session.child.lock().unwrap() = Some(child);
    log("claude setup-token gestartet");
    std::thread::spawn(move || {
        let mut all = String::new();
        let mut buf = [0u8; 4096];
        let url_re = regex::Regex::new(r"https://[^\s\x1b]+").unwrap();
        let mut opened = false;
        loop {
            let n = match stdout.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => n,
            };
            all.push_str(&String::from_utf8_lossy(&buf[..n]));
            let clean = tools::strip_ansi(&all);
            if !opened && let Some(m) = url_re.find(&clean) && m.as_str().contains("oauth") {
                opened = true;
                let _ = app.emit("claude:url", m.as_str().to_string());
            }
            let tail: String = clean.chars().rev().take(700).collect::<Vec<_>>().into_iter().rev().collect();
            let _ = app.emit("claude:output", tail.replace(|c: char| c.is_control() && c != '\n', ""));
            if let Some(token) = find_token(&all) {
                let result = store_claude_token(&token);
                return match result {
                    Ok(()) => done(&app, "claude:done", true, "Token gespeichert"),
                    Err(e) => done(&app, "claude:done", false, e),
                };
            }
        }
        done(&app, "claude:done", false, "Kein Token in der Ausgabe gefunden. Du kannst ihn unten einfügen.");
    });
    Ok(())
}

/// Reicht eine Eingabe (z. B. den Code aus dem Browser) an `claude setup-token` weiter.
#[tauri::command]
pub fn claude_send(text: String, session: State<'_, ClaudeSession>) -> Result<(), String> {
    let mut guard = session.stdin.lock().unwrap();
    let stdin = guard.as_mut().ok_or("Die Anmeldung läuft nicht mehr.")?;
    stdin.write_all(format!("{text}\r").as_bytes()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn claude_manual(token: String) -> Result<(), String> {
    let token = token.trim().to_string();
    if !token.starts_with("sk-ant-oat") {
        return Err("Das sieht nicht wie ein Claude-Abo-Token aus (beginnt mit sk-ant-oat).".into());
    }
    tauri::async_runtime::spawn_blocking(move || store_claude_token(&token)).await.map_err(|e| e.to_string())?
}

// ---------- Google Drive ----------

fn drive_env(token: &str) -> [(&'static str, String); 4] {
    [
        ("RCLONE_CONFIG", "/dev/null".into()),
        ("RCLONE_CONFIG_VAMELA_TYPE", "drive".into()),
        ("RCLONE_CONFIG_VAMELA_SCOPE", "drive".into()),
        ("RCLONE_CONFIG_VAMELA_TOKEN", token.to_string()),
    ]
}

pub fn rclone(args: &[&str]) -> tools::Output {
    let token = keychain::get("drive_token").unwrap_or_default();
    let env = drive_env(&token);
    let env: Vec<(&str, &str)> = env.iter().map(|(k, v)| (*k, v.as_str())).collect();
    // Kurze Fristen, damit ein hängender Aufruf als Fehler im Fenster landet statt endlos zu warten.
    let mut full: Vec<&str> = args.to_vec();
    full.extend(["--timeout", "20s", "--contimeout", "15s", "--low-level-retries", "2", "--retries", "1", "--log-level", "ERROR"]);
    // rclones gemeinsames Google-Projekt ist oft ausgelastet (403 rateLimitExceeded). Das geht nach Sekunden vorbei: warten und neu versuchen.
    let mut o = run(&tools::rclone(), &full, None, &env);
    for wait in [5u64, 10, 20] {
        if o.ok || !(o.stderr.contains("rateLimitExceeded") || o.stderr.contains("RATE_LIMIT_EXCEEDED")) {
            break;
        }
        log(&format!("rclone {}: Google-Limit erreicht, neuer Versuch in {wait} s", args.first().unwrap_or(&"")));
        std::thread::sleep(std::time::Duration::from_secs(wait));
        o = run(&tools::rclone(), &full, None, &env);
    }
    if !o.ok {
        log(&format!("rclone {} fehlgeschlagen: {}", args.first().unwrap_or(&""), o.stderr.lines().last().unwrap_or("")));
    }
    o
}

/// Google-Anmeldung über rclone (kostenlos, ohne eigenes Cloud-Projekt). rclone öffnet den Browser selbst.
#[tauri::command]
pub fn drive_connect(app: AppHandle) {
    std::thread::spawn(move || {
        let o = run(&tools::rclone(), &["authorize", "drive", "--auth-no-open-browser=false"], None, &[("RCLONE_CONFIG", "/dev/null")]);
        let text = format!("{}\n{}", o.stdout, o.stderr);
        let re = regex::Regex::new(r#"(?s)(\{"access_token".*?\})\s*(<---|$)"#).unwrap();
        let Some(token) = re.captures(&text).map(|c| c[1].replace(['\n', '\r'], "")) else {
            return done(&app, "drive:done", false, "Keine Anmeldung erhalten. Bitte erneut versuchen.");
        };
        if let Err(e) = keychain::set("drive_token", &token) {
            return done(&app, "drive:done", false, e);
        }
        if let Err(e) = set_secret("RCLONE_DRIVE_TOKEN", &token) {
            return done(&app, "drive:done", false, e);
        }
        done(&app, "drive:done", true, "verbunden");
    });
}

#[tauri::command]
pub async fn drive_folders() -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        if keychain::get("drive_token").unwrap_or_default().is_empty() {
            return Err("Noch nicht angemeldet.".to_string());
        }
        let o = rclone(&["lsf", "vamela:", "--dirs-only", "--max-depth", "1"]);
        if !o.ok {
            let last = o.stderr.lines().last().unwrap_or("keine Antwort");
            if last.contains("rateLimitExceeded") || last.contains("RATE_LIMIT") {
                return Err("Google ist gerade überlastet (gemeinsames Limit). Bitte in einer Minute noch einmal versuchen.".to_string());
            }
            return Err(format!("Drive antwortet nicht: {last}"));
        }
        log(&format!("Drive: {} Ordner gefunden", o.stdout.lines().count()));
        Ok(o.stdout.lines().map(|l| l.trim_end_matches('/').to_string()).filter(|l| !l.is_empty()).collect())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Prüft den gewählten Ordner und legt fehlende Unterordner an.
#[tauri::command]
pub async fn drive_setup(folder: String) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let folder = folder.trim().trim_matches('/').to_string();
        if folder.is_empty() || folder.contains("..") {
            return Err("Ungültiger Ordnername.".into());
        }
        let existing = rclone(&["lsf", &format!("vamela:{folder}"), "--dirs-only"]);
        let have: Vec<String> = existing.stdout.lines().map(|l| l.trim_end_matches('/').to_string()).collect();
        let mut out = vec![];
        for sub in DRIVE_SUBFOLDERS {
            if have.iter().any(|h| h == sub) {
                out.push(format!("{sub} vorhanden"));
                continue;
            }
            let o = rclone(&["mkdir", &format!("vamela:{folder}/{sub}")]);
            if !o.ok {
                return Err(format!("{sub}: {}", o.stderr));
            }
            out.push(format!("{sub} angelegt"));
        }
        set_secret("DRIVE_FOLDER", &folder)?;
        state::update(|s| s.drive_folder = Some(folder.clone()));
        log(&format!("Drive {folder}: {}", out.join(", ")));
        Ok(out)
    })
    .await
    .map_err(|e| e.to_string())?
}

// ---------- Instagram ----------

async fn instagram_me(token: &str) -> Result<(String, String), String> {
    let resp = reqwest::Client::new()
        .get("https://graph.instagram.com/me")
        .query(&[("fields", "user_id,username,account_type"), ("access_token", token)])
        .send()
        .await
        .map_err(|e| format!("Instagram nicht erreichbar: {e}"))?;
    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    if let Some(err) = json.get("error") {
        return Err(format!("Instagram lehnt den Token ab: {}", err["message"].as_str().unwrap_or("unbekannt")));
    }
    let id = json["user_id"].as_str().map(String::from).or_else(|| json["id"].as_str().map(String::from)).unwrap_or_default();
    let name = json["username"].as_str().unwrap_or_default().to_string();
    Ok((id, name))
}

#[tauri::command]
pub async fn instagram_save(token: String) -> Result<String, String> {
    let token = token.trim().to_string();
    let (id, name) = instagram_me(&token).await?;
    if name != IG_USERNAME {
        return Err(format!("Der Token gehört zu @{name}, nicht zu @{IG_USERNAME}."));
    }
    if id != IG_USER_ID {
        log(&format!("Hinweis: Instagram meldet user_id {id}, erwartet {IG_USER_ID}"));
    }
    let id2 = id.clone();
    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        keychain::set("instagram_token", &token)?;
        set_secret("IG_ACCESS_TOKEN", &token)?;
        set_secret("IG_USER_ID", &id2)?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())??;
    state::update(|s| s.instagram_username = Some(name.clone()));
    log(&format!("Instagram verbunden: @{name} ({id})"));
    Ok(format!("@{name}"))
}

// ---------- Gmail ----------

fn smtp(password: &str) -> Result<lettre::SmtpTransport, String> {
    use lettre::transport::smtp::authentication::Credentials;
    Ok(lettre::SmtpTransport::relay("smtp.gmail.com")
        .map_err(|e| e.to_string())?
        .credentials(Credentials::new(MAIL.into(), password.replace(' ', "")))
        .build())
}

#[tauri::command]
pub async fn gmail_save(password: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        use lettre::{Message, Transport};
        let password = password.replace(' ', "");
        let mail = Message::builder()
            .from(format!("VAMELA Insta <{MAIL}>").parse().map_err(|e| format!("{e}"))?)
            .to(MAIL.parse().map_err(|e| format!("{e}"))?)
            .subject("VAMELA Insta: Testmail")
            .body("Die Verbindung für die Wochenberichte steht. Diese Mail braucht keine Antwort.".to_string())
            .map_err(|e| e.to_string())?;
        smtp(&password)?.send(&mail).map_err(|e| format!("Gmail lehnt die Anmeldung ab: {e}"))?;
        keychain::set("gmail_app_password", &password)?;
        set_secret("GMAIL_USER", MAIL)?;
        set_secret("GMAIL_APP_PASSWORD", &password)?;
        set_secret("REPORT_TO", MAIL)?;
        state::update(|s| s.gmail_ok = true);
        log("Gmail verbunden, Testmail gesendet");
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

// ---------- Abschlusstest ----------

#[derive(Serialize)]
pub struct Check {
    name: String,
    ok: bool,
    detail: String,
}

fn check(name: &str, r: Result<String, String>) -> Check {
    match r {
        Ok(d) => Check { name: name.into(), ok: true, detail: d },
        Err(d) => Check { name: name.into(), ok: false, detail: d },
    }
}

/// Prüft alle Verbindungen nur lesend.
#[tauri::command]
pub async fn final_check() -> Vec<Check> {
    let ig_token = keychain::get("instagram_token");
    let ig = match ig_token {
        Some(t) => instagram_me(&t).await.map(|(_, n)| format!("@{n}")),
        None => Err("nicht verbunden".into()),
    };
    let mut checks = tauri::async_runtime::spawn_blocking(|| {
        let mut v = vec![];
        let token = keychain::get("github_token").unwrap_or_default();
        let env = [("GH_TOKEN", token.as_str())];
        v.push(check("GitHub", {
            let o = run(&tools::gh(), &["api", "user", "--jq", ".login"], None, &env);
            if o.ok { Ok(o.stdout) } else { Err(o.stderr) }
        }));
        let owner = state::load().github_login.unwrap_or_default();
        v.push(check("Repositories", {
            let a = run(&tools::gh(), &["repo", "view", &format!("{owner}/{REPO_MAIN}"), "--json", "visibility", "--jq", ".visibility"], None, &env);
            let b = run(&tools::gh(), &["repo", "view", &format!("{owner}/{REPO_MEDIA}"), "--json", "visibility", "--jq", ".visibility"], None, &env);
            if a.ok && b.ok { Ok(format!("{REPO_MAIN} {}, {REPO_MEDIA} {}", a.stdout.to_lowercase(), b.stdout.to_lowercase())) } else { Err("fehlt".into()) }
        }));
        v.push(check("Claude-Abo", {
            let o = run(&tools::gh(), &["secret", "list", "-R", &format!("{owner}/{REPO_MAIN}")], None, &env);
            if keychain::has("claude_oauth_token") && o.stdout.contains("CLAUDE_CODE_OAUTH_TOKEN") {
                Ok("Token im Schlüsselbund und als Secret".into())
            } else {
                Err("Token fehlt".into())
            }
        }));
        v.push(check("Google Drive", {
            match state::load().drive_folder {
                Some(f) => {
                    let o = rclone(&["lsf", &format!("vamela:{f}"), "--dirs-only"]);
                    let n = o.stdout.lines().count();
                    if o.ok { Ok(format!("{f} mit {n} Unterordnern")) } else { Err(o.stderr) }
                }
                None => Err("kein Ordner gewählt".into()),
            }
        }));
        v.push(check("Gmail", {
            match keychain::get("gmail_app_password") {
                Some(p) => match smtp(&p).and_then(|t| t.test_connection().map_err(|e| e.to_string())) {
                    Ok(true) => Ok("Anmeldung klappt".into()),
                    Ok(false) => Err("keine Verbindung".into()),
                    Err(e) => Err(e),
                },
                None => Err("nicht verbunden".into()),
            }
        }));
        v
    })
    .await
    .unwrap_or_default();
    checks.insert(3, check("Instagram", ig));
    let all_ok = checks.iter().all(|c| c.ok);
    state::update(|s| s.finished = all_ok);
    log(&format!("Abschlusstest: {}", if all_ok { "alles grün" } else { "Fehler" }));
    checks
}
