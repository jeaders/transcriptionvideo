fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            use std::process::{Command, Stdio};
            use std::thread;
            use std::time::Duration;

            let app_dir = app
                .path()
                .resource_dir()
                .expect("resource dir")
                .to_path_buf();

            // Avvia il server Next.js come processo figlio.
            let mut child = Command::new("node")
                .arg(app_dir.join("node_modules").join(".bin").join("next"))
                .arg("start")
                .current_dir(&app_dir)
                .env("NODE_ENV", "production")
                .env("PORT", "3000")
                .env("NEXT_TELEMETRY_DISABLED", "1")
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .expect("avvio next fallito");

            // Attendi che il server sia pronto.
            thread::sleep(Duration::from_secs(4));

            // Naviga la finestra principale all'URL del server.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.navigate("http://127.0.0.1:3000".parse().unwrap());
            }

            // Mantieni il processo figlio vivo per tutta la durata dell'app.
            thread::spawn(move || {
                let _ = child.wait();
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("errore esecuzione tauri");
}