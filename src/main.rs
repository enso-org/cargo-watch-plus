use std::env;
use home::home_dir;
use std::process::Command;
use std::process::Child;


// ==================
// === ChildGuard ===
// ==================

struct ChildGuard(Child);

impl Drop for ChildGuard {
    fn drop(&mut self) {
        self.0.kill().ok();
    }
}



// ============
// === Main ===
// ============

fn main() {
    let argv:Vec<_> = std::env::args().collect();
    let home_path = home_dir().unwrap();
    let bin_path = home_path.join(".cargo").join("bin");
    let crate_bin_js_path = bin_path.join("cargo-watch-plus-js");
    let cwd = std::env::current_dir().unwrap();
    let cwd_str = cwd.display().to_string();
    env::set_current_dir(&crate_bin_js_path).unwrap();
    let mut args = vec!["run", "start", "--silent", "--", &cwd_str];
    args.extend(argv.iter().map(|t| t.as_str()).skip(2));
    let child = Command::new("npm").args(&args).spawn().expect("Failed to execute 'npm' command.");
    let mut guard = ChildGuard(child);
    guard.0.wait().unwrap();
}