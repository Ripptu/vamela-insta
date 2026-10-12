//! Datenzugriff für die Ansichten: liest den Stand aus dem privaten Repository (über die GitHub CLI),
//! steuert Pause und Workflows, lädt Fotos nach Drive und überwacht im Hintergrund Veröffentlichungen.

use serde_json::Value;
use std::fs;

use crate::keychain;
use crate::setup;
use crate::state::{self, REPO_MAIN};
use crate::tools::{self, log, run};

fn repo() -> Result<String, String> {
    let owner = state::load().github_login.ok_or_else(|| "GitHub ist noch nicht verbunden.".to_string())?;
    Ok(format!("{owner}/{REPO_MAIN}"))
}

fn gh(args: &[&str], input: Option<&str>) -> tools::Output {
    let token = keychain::get("github_token").unwrap_or_default();
    run(&tools::gh(), args, input, &[("GH_TOKEN", &token)])
}

/// Textdatei aus dem Repository (Hauptzweig).
#[tauri::command]
pub async fn repo_datei(pfad: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let r = repo()?;
        let o = gh(&["api", &format!("repos/{r}/contents/{pfad}"), "-H", "Accept: application/vnd.github.raw"], None);
        if o.ok { Ok(o.stdout) } else if o.stderr.contains("404") { Err("nicht vorhanden".into()) } else { Err(o.stderr) }
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Bild aus dem Repository als data-URL (bis 1 MB).
#[tauri::command]
pub async fn repo_bild(pfad: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let r = repo()?;
        let o = gh(&["api", &format!("repos/{r}/contents/{pfad}"), "--jq", ".content"], None);
        if !o.ok {
            return Err(o.stderr);
        }
        let b64: String = o.stdout.chars().filter(|c| !c.is_whitespace()).collect();
        let mime = if pfad.ends_with(".png") { "image/png" } else { "image/jpeg" };
        Ok(format!("data:{mime};base64,{b64}"))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Letzte Workflow-Läufe als JSON.
#[tauri::command]
pub async fn actions_laeufe() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let r = repo()?;
        let o = gh(&["run", "list", "-R", &r, "--limit", "40", "--json", "name,status,conclusion,createdAt,displayTitle,url,event"], None);
        if o.ok { Ok(o.stdout) } else { Err(o.stderr) }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn pause_status() -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let r = repo()?;
        let o = gh(&["api", &format!("repos/{r}/contents/PAUSE"), "--jq", ".sha"], None);
        Ok(o.ok)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn pause_setzen(an: bool) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let r = repo()?;
        let url = format!("repos/{r}/contents/PAUSE");
        let cur = gh(&["api", &url, "--jq", ".sha"], None);
        if an && !cur.ok {
            let o = gh(&["api", "-X", "PUT", &url, "-f", "message=Pause über die App", "-f", "content=UEFVU0U="], None);
            if !o.ok { return Err(o.stderr); }
        } else if !an && cur.ok {
            let sha = cur.stdout.trim().to_string();
            let msg = "message=Pause beendet";
            let sha_arg = format!("sha={sha}");
            let o = gh(&["api", "-X", "DELETE", &url, "-f", msg, "-f", &sha_arg], None);
            if !o.ok { return Err(o.stderr); }
        }
        log(&format!("Pause {}", if an { "an" } else { "aus" }));
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

const WORKFLOWS: [&str; 6] = ["produzieren.yml", "veroeffentlichen.yml", "messen.yml", "denken.yml", "bericht.yml", "qa-test.yml"];

#[tauri::command]
pub async fn workflow_starten(datei: String, trocken: Option<bool>) -> Result<(), String> {
    if !WORKFLOWS.contains(&datei.as_str()) {
        return Err("Unbekannter Ablauf.".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let r = repo()?;
        let mut a: Vec<String> = vec!["workflow".into(), "run".into(), datei.clone(), "-R".into(), r];
        if let (Some(t), "veroeffentlichen.yml") = (trocken, datei.as_str()) {
            a.push("-f".into());
            a.push(format!("trocken={t}"));
        }
        let refs: Vec<&str> = a.iter().map(|s| s.as_str()).collect();
        let o = gh(&refs, None);
        log(&format!("Workflow {datei} gestartet: {}", if o.ok { "ok" } else { &o.stderr }));
        if o.ok { Ok(()) } else { Err(o.stderr) }
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Namen der vorhandenen Actions-Secrets.
#[tauri::command]
pub async fn secrets_liste() -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let r = repo()?;
        let o = gh(&["secret", "list", "-R", &r], None);
        if !o.ok { return Err(o.stderr); }
        Ok(o.stdout.lines().filter_map(|l| l.split_whitespace().next()).map(|s| s.to_string()).collect())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Nur wenige Secrets dürfen über die Ansicht gesetzt werden.
#[tauri::command]
pub fn secret_setzen(name: String, wert: String) -> Result<(), String> {
    if !["MEDIA_TOKEN"].contains(&name.as_str()) {
        return Err("Dieses Secret wird nicht hier gesetzt.".into());
    }
    let wert = wert.trim().to_string();
    if wert.len() < 20 {
        return Err("Das sieht nicht nach einem Token aus.".into());
    }
    let r = repo()?;
    let o = gh(&["secret", "set", &name, "-R", &r], Some(&wert));
    if !o.ok { return Err(o.stderr); }
    keychain::set(&name.to_lowercase(), &wert)?;
    log(&format!("Secret {name} gesetzt"));
    Ok(())
}

/// Nimmt den vorhandenen GitHub-Zugang der App als MEDIA_TOKEN (einfacher Start, weiter gefasst als ein Fein-Token).
#[tauri::command]
pub fn media_token_aus_github() -> Result<(), String> {
    let token = keychain::get("github_token").ok_or_else(|| "Kein GitHub-Zugang im Schlüsselbund.".to_string())?;
    let r = repo()?;
    let o = gh(&["secret", "set", "MEDIA_TOKEN", "-R", &r], Some(&token));
    if !o.ok { return Err(o.stderr); }
    log("MEDIA_TOKEN aus dem GitHub-Zugang der App gesetzt");
    Ok(())
}

/// Bilder aus einem lokalen Ordner (Standard ~/VAMELA) nach Drive `<Ordner>/Fotos` kopieren, ohne Vorhandenes zu überschreiben.
#[tauri::command]
pub async fn fotos_hochladen(quelle: Option<String>) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let ordner = state::load().drive_folder.ok_or_else(|| "Drive ist noch nicht eingerichtet.".to_string())?;
        let q = quelle.unwrap_or_else(|| tools::home().join("VAMELA").to_string_lossy().to_string());
        if !std::path::Path::new(&q).is_dir() {
            return Err(format!("Ordner {q} gibt es nicht."));
        }
        let ziel = format!("vamela:{ordner}/Fotos");
        let o = setup::rclone(&["copy", &q, &ziel, "--include", "*.jpeg", "--include", "*.jpg", "--include", "*.png", "--include", "*.JPG", "--include", "*.JPEG", "--ignore-existing", "--transfers", "4", "--timeout", "60s"]);
        if !o.ok {
            return Err(format!("Hochladen fehlgeschlagen: {}", o.stderr.lines().last().unwrap_or("")));
        }
        let l = setup::rclone(&["lsf", &ziel, "--files-only"]);
        let n = l.stdout.lines().count();
        log(&format!("Fotos hochgeladen, {n} in Drive"));
        Ok(format!("{n} Fotos liegen jetzt in Drive."))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn fotos_zaehlen() -> Result<usize, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let ordner = state::load().drive_folder.ok_or_else(|| "Drive ist noch nicht eingerichtet.".to_string())?;
        let l = setup::rclone(&["lsf", &format!("vamela:{ordner}/Fotos"), "--files-only"]);
        if !l.ok { return Err(l.stderr.lines().last().unwrap_or("Drive antwortet nicht").to_string()); }
        Ok(l.stdout.lines().count())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn log_lesen(zeilen: usize) -> String {
    let p = tools::home().join("Library/Logs/VAMELA Insta/app.log");
    let t = fs::read_to_string(p).unwrap_or_default();
    let l: Vec<&str> = t.lines().collect();
    l[l.len().saturating_sub(zeilen)..].join("\n")
}

/// Kurzstatus für Menüleiste und Benachrichtigungen: (bereit, ungeprueft, fehler, veroeffentlicht-Liste).
pub fn queue_status() -> Option<(usize, usize, Vec<String>, Vec<(String, String)>)> {
    let r = repo().ok()?;
    let o = gh(&["api", &format!("repos/{r}/contents/plan/queue.json"), "-H", "Accept: application/vnd.github.raw"], None);
    if !o.ok { return None; }
    let v: Value = serde_json::from_str(&o.stdout).ok()?;
    let arr = v.as_array()?;
    let mut bereit = 0;
    let mut neu = 0;
    let mut fehler = vec![];
    let mut pub_ = vec![];
    for x in arr {
        let st = x["status"].as_str().unwrap_or("");
        let id = x["id"].as_str().unwrap_or("").to_string();
        let titel = x["titel"].as_str().unwrap_or("").to_string();
        match st {
            "geprueft" if x["typ"] != "story" => bereit += 1,
            "neu" => neu += 1,
            "fehler" => fehler.push(format!("{id} {titel}")),
            "veroeffentlicht" => pub_.push((id, titel)),
            _ => {}
        }
    }
    Some((bereit, neu, fehler, pub_))
}
