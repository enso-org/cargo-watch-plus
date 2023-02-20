use std::env;
use home::home_dir;
use std::process::Command;

fn main() {
    println!("cargo:rerun-if-changed=js");
    println!("cargo:rerun-if-changed=build.rs");

    let home_path = home_dir().unwrap();
    let bin_path = home_path.join(".cargo").join("bin");
    let crate_bin_js_path = bin_path.join("cargo-watch-plus-js");
    let root_path_str = env::var("CARGO_MANIFEST_DIR").unwrap();
    let root_path = std::path::Path::new(&root_path_str);
    let js_sources = root_path.join("js");
    let options = fs_extra::dir::CopyOptions{
        content_only: true,
        ..Default::default()
    };
    std::fs::remove_dir_all(&crate_bin_js_path).ok();
    std::fs::create_dir(&crate_bin_js_path).unwrap();
    fs_extra::dir::copy(&js_sources, &crate_bin_js_path, &options).unwrap();

    env::set_current_dir(&crate_bin_js_path).unwrap();
    Command::new("npm")
        .arg("install")
        .output()
        .expect("Failed to execute 'npm' command.");
}