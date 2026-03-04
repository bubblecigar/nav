import * as vscode from 'vscode';
import { BookmarkTreeItem } from '../class/bookmarkClasses';
import { BookmarkHistory } from '../class/bookmarkClasses';

/**
 * Update VS Code context variables for bookmark operations
 */
export function updateContextVariables(bookmarkHistory: BookmarkHistory, selectedItem: BookmarkTreeItem | null): void {
    if (selectedItem) {
        const canMoveUp = bookmarkHistory.canMoveUp(selectedItem.bookmark);
        const canMoveDown = bookmarkHistory.canMoveDown(selectedItem.bookmark);
        
        vscode.commands.executeCommand('setContext', 'nav-extension.canMoveUp', canMoveUp);
        vscode.commands.executeCommand('setContext', 'nav-extension.canMoveDown', canMoveDown);
    } else {
        // No selection, disable both buttons
        vscode.commands.executeCommand('setContext', 'nav-extension.canMoveUp', false);
        vscode.commands.executeCommand('setContext', 'nav-extension.canMoveDown', false);
    }
}

/**
 * Update bookmark details panel with selected item information
 */
export function updateBookmarkDetailsPanel(
    bookmarkDetailsPanel: vscode.WebviewPanel | undefined, 
    selectedItem: BookmarkTreeItem | null,
    getWebviewContent: (bookmark: any) => string
): void {
    if (bookmarkDetailsPanel && selectedItem) {
        bookmarkDetailsPanel.webview.html = getWebviewContent(selectedItem.bookmark);
    }
}