/**
 * Utility functions for generating unique IDs
 */

/**
 * Generates a unique ID for bookmarks
 * Format: bookmark_${timestamp}_${randomString}
 */
export function generateId(): string {
    return 'bookmark_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}