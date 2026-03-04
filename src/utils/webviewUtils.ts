import * as vscode from 'vscode';
import { BookmarkItem } from '../types/bookmarkTypes';

/**
 * Generate webview content for bookmark details
 */
export function getWebviewContent(bookmark: BookmarkItem): string {
    const relativePath = vscode.workspace.asRelativePath(bookmark.filePath);
    const hasChildren = bookmark.children && bookmark.children.length > 0;
    const hasParent = bookmark.parent !== undefined;
    
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