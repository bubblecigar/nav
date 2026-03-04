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
                padding: 15px;
                margin: 0;
            }
            .detail-row { 
                margin-bottom: 10px; 
                display: flex;
                flex-direction: column;
            }
            .detail-label { 
                font-weight: bold; 
                color: var(--vscode-textLink-foreground);
                margin-bottom: 3px;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .detail-value { 
                background-color: var(--vscode-editor-selectionBackground);
                padding: 5px 8px;
                border-radius: 3px;
                font-family: var(--vscode-editor-font-family);
                word-break: break-all;
            }
            .code-text {
                font-family: var(--vscode-editor-font-family);
                background-color: var(--vscode-textBlockQuote-background);
                padding: 3px 6px;
                border-radius: 2px;
                border-left: 3px solid var(--vscode-textLink-foreground);
            }
            .hierarchy-info {
                background-color: var(--vscode-editor-inactiveSelectionBackground);
                padding: 8px;
                border-radius: 4px;
                margin-top: 10px;
            }
            .notes-section {
                margin-top: 15px;
                padding: 10px;
                background-color: var(--vscode-editor-inactiveSelectionBackground);
                border-radius: 4px;
                border-left: 3px solid var(--vscode-textLink-foreground);
            }
            .notes-textarea {
                width: 100%;
                min-height: 100px;
                padding: 8px;
                background-color: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                border-radius: 2px;
                font-family: var(--vscode-editor-font-family);
                font-size: 14px;
                resize: vertical;
                box-sizing: border-box;
            }
            .notes-textarea:focus {
                outline: none;
                border-color: var(--vscode-focusBorder);
            }
            .save-button {
                margin-top: 8px;
                padding: 6px 12px;
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                border-radius: 2px;
                cursor: pointer;
                font-size: 12px;
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
                margin-top: 5px;
                font-size: 11px;
                color: var(--vscode-descriptionForeground);
            }
            .no-selection {
                text-align: center;
                color: var(--vscode-descriptionForeground);
                font-style: italic;
                margin-top: 50px;
            }
        </style>
    </head>
    <body>
        <div class="detail-row">
            <div class="detail-label">Text</div>
            <div class="detail-value code-text">${bookmark.text}</div>
        </div>
        
        <div class="detail-row">
            <div class="detail-label">File Path</div>
            <div class="detail-value">${bookmark.filePath}</div>
        </div>
        
        <div class="detail-row">
            <div class="detail-label">Relative Path</div>
            <div class="detail-value">${relativePath}</div>
        </div>
        
        <div class="detail-row">
            <div class="detail-label">Location</div>
            <div class="detail-value">Line ${bookmark.line + 1}, Column ${bookmark.character + 1}</div>
        </div>
        
        <div class="detail-row">
            <div class="detail-label">Created</div>
            <div class="detail-value">${bookmark.timestamp.toLocaleString()}</div>
        </div>
        
        <div class="hierarchy-info">
            <div class="detail-label">Hierarchy</div>
            <div class="detail-value">
                ${hasParent ? '📁 Has Parent: ' + (bookmark.parent?.text || 'Unknown') : '🏠 Root Level'}
                <br>
                ${hasChildren ? '📂 Children: ' + bookmark.children!.length : '📄 No Children'}
            </div>
        </div>
        
        <div class="notes-section">
            <div class="detail-label">📝 Notes</div>
            <textarea 
                id="notesTextarea" 
                class="notes-textarea" 
                placeholder="Add your notes here..."
                data-bookmark-key="${bookmark.filePath}:${bookmark.line}:${bookmark.character}:${bookmark.timestamp.getTime()}"
            >${notes}</textarea>
            <button id="saveNotesBtn" class="save-button">Save Notes</button>
            <div id="statusMessage" class="status-message"></div>
        </div>
        
        <script>
            const vscode = acquireVsCodeApi();
            const textarea = document.getElementById('notesTextarea');
            const saveBtn = document.getElementById('saveNotesBtn');
            const statusMsg = document.getElementById('statusMessage');
            const bookmarkKey = textarea.dataset.bookmarkKey;
            
            let originalNotes = textarea.value;
            let saveTimeout;
            
            // Track changes
            textarea.addEventListener('input', function() {
                const hasChanges = textarea.value !== originalNotes;
                saveBtn.disabled = !hasChanges;
                
                if (hasChanges) {
                    statusMsg.textContent = 'Unsaved changes';
                    statusMsg.style.color = 'var(--vscode-errorForeground)';
                } else {
                    statusMsg.textContent = '';
                }
                
                // Clear any existing timeout
                clearTimeout(saveTimeout);
            });
            
            // Save button click
            saveBtn.addEventListener('click', function() {
                saveNotes();
            });
            
            // Auto-save on blur (when user clicks away)
            textarea.addEventListener('blur', function() {
                if (textarea.value !== originalNotes) {
                    saveTimeout = setTimeout(() => {
                        saveNotes();
                    }, 500);
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
                saveBtn.disabled = true;
                statusMsg.textContent = 'Saved';
                statusMsg.style.color = 'var(--vscode-charts-green)';
                
                // Clear status message after 2 seconds
                setTimeout(() => {
                    statusMsg.textContent = '';
                }, 2000);
            }
            
            // Handle keyboard shortcuts
            textarea.addEventListener('keydown', function(e) {
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    if (textarea.value !== originalNotes) {
                        saveNotes();
                    }
                }
            });
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
                font-size: 16px;
            }
            .instructions {
                margin-top: 20px;
                color: var(--vscode-foreground);
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="no-selection">No bookmark selected</div>
        <div class="instructions">Select a bookmark from the explorer to view its details</div>
    </body>
    </html>`;
}