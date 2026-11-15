fn main() {
    println!("cargo:rerun-if-env-changed=CELESTIAL_BUILD_NUMBER");
    tauri_build::build()
}
