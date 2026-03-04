import * as vscode from 'vscode';
import { BookmarkItem } from '../types/bookmarkTypes';

/**
 * Generate webview content for bookmark details
 */
export function getWebviewContent(bookmark: BookmarkItem): string {
    const relativePath = vscode.workspace.asRelativePath(bookmark.filePath);
    const hasChildren = bookmark.children && bookmark.children.length > 0;
    const hasParent = bookmark.parent !== undefined;
    const notes = bookmark.notes || '';
    
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bookmark Details</title>
        <style>
            body { 
                font-family: var(--vscode-font-family);
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
                padding: 20px;
                margin: 0;
                line-height: 1.5;
            }
            .bookmark-title {
                font-size: 12px;
                font-weight: bold;
                color: var(--vscode-textLink-foreground);
                margin-bottom: 5px;
                padding-left: 5px;
                border-left: 4px solid var(--vscode-textLink-foreground);
                border-radius: 4px;
                font-family: var(--vscode-editor-font-family);
                word-break: break-word;
            }
            .notes-section {
                margin-bottom: 30px;
            }
            .notes-header {
                font-size: 12px;
                font-weight: bold;
                color: var(--vscode-textLink-foreground);
                margin-bottom: 10px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .notes-textarea {
                width: 100%;
                min-height: 200px;
                padding: 15px;
                background-color: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 2px solid var(--vscode-input-border);
                border-radius: 4px;
                font-family: var(--vscode-editor-font-family);
                font-size: 12px;
                resize: vertical;
                box-sizing: border-box;
                line-height: 1.6;
            }
            .notes-textarea:focus {
                outline: none;
                border-color: var(--vscode-focusBorder);
                box-shadow: 0 0 0 1px var(--vscode-focusBorder);
            }
            .notes-textarea::placeholder {
                color: var(--vscode-input-placeholderForeground);
                font-style: italic;
            }
            .notes-controls {
                margin-top: 12px;
                display: flex;
                align-items: center;
                gap: 15px;
            }
            .save-button {
                padding: 8px 16px;
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                border-radius: 3px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 500;
            }
            .save-button:hover {
                background-color: var(--vscode-button-hoverBackground);
            }
            .save-button:disabled {
                background-color: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
                cursor: not-allowed;
            }
            .status-message {
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
            }
            .metadata-section {
                padding-top: 20px;
                border-top: 1px solid var(--vscode-panel-border);
            }
            .metadata-header {
                font-size: 12px;
                font-weight: 500;
                color: var(--vscode-textLink-foreground);
                margin-bottom: 10px;
            }
            .meta-item {
                margin-bottom: 6px;
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
            }
            .meta-label {
                font-weight: 500;
                color: var(--vscode-foreground);
                margin-right: 8px;
                min-width: 70px;
                display: inline-block;
            }
            .meta-value {
                font-family: var(--vscode-editor-font-family);
                padding: 1px 4px;
                border-radius: 2px;
                font-size: 12px;
            }
        </style>
    </head>
    <body>
        <div class="bookmark-title">${bookmark.text}</div>
        
        <div class="notes-section">
            <textarea 
                id="notesTextarea" 
                class="notes-textarea" 
                placeholder="Add your personal notes, thoughts, or context about this bookmark..."
                data-bookmark-key="${bookmark.filePath}:${bookmark.line}:${bookmark.character}:${bookmark.timestamp.getTime()}"
            >${notes}</textarea>
        </div>
        
        <div class="metadata-section">
            <div class="meta-item">
                <span class="meta-label">File:</span>
                <span class="meta-value">${bookmark.filePath}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Relative:</span>
                <span class="meta-value">${relativePath}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Location:</span>
                <span class="meta-value">Line ${bookmark.line + 1}, Column ${bookmark.character + 1}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Created:</span>
                <span class="meta-value">${bookmark.timestamp.toLocaleString()}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Hierarchy:</span>
                <span class="meta-value">
                    ${hasParent ? '📁 Has Parent: ' + (bookmark.parent?.text || 'Unknown') : '🏠 Root Level'}
                    ${hasChildren ? ', 📂 Children: ' + bookmark.children!.length : ', 📄 No Children'}
                </span>
            </div>
        </div>
        
        <script>
            const vscode = acquireVsCodeApi();
            const textarea = document.getElementById('notesTextarea');
            const saveBtn = document.getElementById('saveNotesBtn');
            const statusMsg = document.getElementById('statusMessage');
            const bookmarkKey = textarea.dataset.bookmarkKey;
            
            let originalNotes = textarea.value;
            let saveTimeout;
            let statusTimeout;
            
            // Auto-save on typing with debouncing
            textarea.addEventListener('input', function() {
                const hasChanges = textarea.value !== originalNotes;
                
                if (hasChanges) {
                    statusMsg.textContent = 'Typing...';
                    statusMsg.style.color = 'var(--vscode-descriptionForeground)';
                    
                    // Clear any existing timeouts
                    clearTimeout(saveTimeout);
                    clearTimeout(statusTimeout);
                    
                    // Auto-save after 1 second of no typing
                    saveTimeout = setTimeout(() => {
                        saveNotes();
                    }, 1000);
                } else {
                    statusMsg.textContent = '';
                }
                
                // Hide save button since auto-save is enabled
                saveBtn.style.display = 'none';
            });
            
            // Also save on blur for immediate feedback
            textarea.addEventListener('blur', function() {
                if (textarea.value !== originalNotes) {
                    clearTimeout(saveTimeout);
                    saveNotes();
                }
            });
            
            function saveNotes() {
                const notes = textarea.value;
                
                vscode.postMessage({
                    command: 'saveNotes',
                    bookmarkKey: bookmarkKey,
                    notes: notes
                });
                
                originalNotes = notes;
                statusMsg.textContent = 'Saved ✓';
                statusMsg.style.color = 'var(--vscode-charts-green)';
                
                // Clear status message after 2 seconds
                clearTimeout(statusTimeout);
                statusTimeout = setTimeout(() => {
                    statusMsg.textContent = '';
                }, 2000);
            }
            
            // Handle keyboard shortcuts
            textarea.addEventListener('keydown', function(e) {
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    clearTimeout(saveTimeout);
                    saveNotes();
                }
            });
            
            // Initialize - hide save button since auto-save is enabled
            saveBtn.style.display = 'none';
        </script>
    </body>
    </html>`;
}

/**
 * Generate empty webview content when no bookmark is selected
 */
export function getEmptyWebviewContent(): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bookmark Details</title>
        <style>
            body { 
                font-family: var(--vscode-font-family);
                color: var(--vscode-descriptionForeground);
                background-color: var(--vscode-editor-background);
                padding: 15px;
                margin: 0;
                text-align: center;
                padding-top: 50px;
            }
            .no-selection {
                font-style: italic;
                font-size: 12px;
            }
            .instructions {
                margin-top: 20px;
                color: var(--vscode-foreground);
                font-size: 12px;
            }
        </style>
    </head>
    <body>
        <div class="no-selection">No bookmark selected</div>
        <div class="instructions">Select a bookmark from the explorer to view its details</div>
    </body>
    </html>`;
}