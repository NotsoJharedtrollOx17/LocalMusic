pub mod acoustic;
pub mod automatic_playlists;
pub mod catalog_query;
pub mod groups;
pub mod identity;
pub mod playlist;
pub mod recap;
pub mod recommendation;
mod recommendation_store;
pub mod search;
pub mod store;
pub mod types;
pub use store::Store;
pub use types::*;
pub fn normalize(value: &str) -> String {
    use unicode_normalization::UnicodeNormalization;
    value.trim().nfkc().collect::<String>().to_lowercase()
}
