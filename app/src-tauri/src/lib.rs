mod daten;
mod keychain;
mod setup;
mod state;
mod tools;

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::time::Duration;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, WindowEvent};
use tauri_plugin_notification::NotificationExt;

#[derive(Serialize, Deserialize, Default)]
#[serde(default)]
struct Beobachtet {
    veroeffentlicht: HashSet<String>,
    fehler: HashSet<String>,
    puffer_warnung: String,
    gestartet: bool,
}

fn zeige_fenster(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

fn melde(app: &AppHandle, titel: &str, text: &str) {
    tools::log(&format!("Meldung: {titel} {text}"));
    let _ = app.notification().builder().title(titel).body(text).show();
}

/// Fragt regelmäßig den Stand im Repository ab: Menüleisten-Zahl und Benachrichtigungen.
fn beobachte(app: AppHandle, status_item: MenuItem<tauri::Wry>) {
    std::thread::spawn(move || {
        let datei = tools::support_dir().join("beobachtet.json");
        loop {
            if state::load().finished {
                if let Some((bereit, neu, fehler, pubs)) = daten::queue_status() {
                    let mut b: Beobachtet = std::fs::read_to_string(&datei).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default();
                    if let Some(t) = app.tray_by_id("haupt") {
                        let _ = t.set_title(Some(format!("{bereit}")));
                        let _ = t.set_tooltip(Some(format!("VAMELA Insta: {bereit} Beiträge bereit")));
                    }
                    let _ = status_item.set_text(format!("{bereit} bereit, {neu} ungeprüft, {} veröffentlicht", pubs.len()));
                    if b.gestartet {
                        for (id, titel) in &pubs {
                            if !b.veroeffentlicht.contains(id) {
                                melde(&app, "Beitrag veröffentlicht", titel);
                            }
                        }
                        for f in &fehler {
                            if !b.fehler.contains(f) {
                                melde(&app, "Beitrag mit Fehler", f);
                            }
                        }
                        let heute = chrono::Local::now().format("%Y-%m-%d").to_string();
                        if bereit < 5 && b.puffer_warnung != heute {
                            melde(&app, "Vorrat wird knapp", &format!("Nur noch {bereit} geprüfte Beiträge bereit."));
                            b.puffer_warnung = heute;
                        }
                    }
                    b.veroeffentlicht = pubs.into_iter().map(|(id, _)| id).collect();
                    b.fehler = fehler.into_iter().collect();
                    b.gestartet = true;
                    if let Ok(j) = serde_json::to_string(&b) {
                        let _ = std::fs::write(&datei, j);
                    }
                }
            }
            std::thread::sleep(Duration::from_secs(600));
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tools::log("App gestartet");
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .manage(setup::ClaudeSession::default())
        .setup(|app| {
            let status = MenuItem::with_id(app, "status", "Stand wird geladen …", false, None::<&str>)?;
            let oeffnen = MenuItem::with_id(app, "oeffnen", "VAMELA Insta öffnen", true, None::<&str>)?;
            let ende = MenuItem::with_id(app, "ende", "Beenden", true, Some("cmd+q"))?;
            let menu = Menu::with_items(app, &[&status, &PredefinedMenuItem::separator(app)?, &oeffnen, &ende])?;
            let mut tb = TrayIconBuilder::with_id("haupt").menu(&menu).show_menu_on_left_click(true).tooltip("VAMELA Insta");
            if let Some(icon) = app.default_window_icon() {
                tb = tb.icon(icon.clone());
            }
            tb.on_menu_event(|app, ev| match ev.id().as_ref() {
                "oeffnen" => zeige_fenster(app),
                "ende" => app.exit(0),
                _ => {}
            })
            .build(app)?;
            beobachte(app.handle().clone(), status);
            Ok(())
        })
        .on_window_event(|window, event| {
            // Schließen versteckt das Fenster; die Automatik und die Menüleiste bleiben aktiv.
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            setup::get_state,
            setup::open_url,
            setup::github_login,
            setup::github_repos,
            setup::claude_setup,
            setup::claude_send,
            setup::claude_manual,
            setup::drive_connect,
            setup::drive_folders,
            setup::drive_setup,
            setup::instagram_save,
            setup::tiktok_save,
            setup::tiktok_anmelden,
            setup::tiktok_code,
            setup::gmail_save,
            setup::final_check,
            daten::repo_datei,
            daten::repo_bild,
            daten::actions_laeufe,
            daten::pause_status,
            daten::pause_setzen,
            daten::workflow_starten,
            daten::secrets_liste,
            daten::secret_setzen,
            daten::media_token_aus_github,
            daten::fotos_hochladen,
            daten::fotos_zaehlen,
            daten::log_lesen,
        ])
        .build(tauri::generate_context!())
        .expect("VAMELA Insta konnte nicht starten");
    app.run(|app, event| {
        if let tauri::RunEvent::Reopen { .. } = event {
            zeige_fenster(app);
        }
    });
}
