import * as vscode from 'vscode';
import { BookmarkItem } from '../types/bookmarkTypes';

export function getDiagramWebviewContent(bookmarks: BookmarkItem[]): string {
    const generateTreeHtml = (items: BookmarkItem[], level: number = 0): string => {
        return items.map(bookmark => {
            const hasChildren = bookmark.children && bookmark.children.length > 0;
            const indent = level * 30;
            const childrenHtml = hasChildren ? generateTreeHtml(bookmark.children!, level + 1) : '';
            
            return `
                <div class="node" style="margin-left: ${indent}px;">
                    <div class="node-content ${hasChildren ? 'has-children' : ''}">
                        <span class="node-icon">${hasChildren ? '📁' : '📄'}</span>
                        <span class="node-text">${bookmark.text}</span>
                        <span class="node-file">${vscode.workspace.asRelativePath(bookmark.filePath)}:${bookmark.line + 1}</span>
                    </div>
                    ${childrenHtml}
                </div>
            `;
        }).join('');
    };

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Bookmark Tree Diagram</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    margin: 20px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                .tree-container {
                    padding: 20px;
                    border: 1px solid var(--vscode-widget-border);
                    border-radius: 6px;
                    background-color: var(--vscode-editor-background);
                }
                .node {
                    margin: 8px 0;
                    position: relative;
                }
                .node::before {
                    content: '';
                    position: absolute;
                    left: -20px;
                    top: 15px;
                    width: 15px;
                    height: 1px;
                    background-color: var(--vscode-widget-border);
                }
                .node-content {
                    display: flex;
                    align-items: center;
                    padding: 6px 12px;
                    background-color: var(--vscode-list-inactiveSelectionBackground);
                    border-radius: 4px;
                    border-left: 3px solid var(--vscode-textLink-foreground);
                    margin-bottom: 4px;
                }
                .node-content.has-children {
                    border-left-color: var(--vscode-symbolIcon-folderForeground);
                    font-weight: bold;
                }
                .node-icon {
                    margin-right: 8px;
                    font-size: 14px;
                }
                .node-text {
                    font-weight: 500;
                    margin-right: 12px;
                    flex: 1;
                }
                .node-file {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                }
                h1 {
                    color: var(--vscode-textLink-foreground);
                    border-bottom: 2px solid var(--vscode-textLink-foreground);
                    padding-bottom: 10px;
                    margin-bottom: 20px;
                }
                .empty-state {
                    text-align: center;
                    color: var(--vscode-descriptionForeground);
                    font-style: italic;
                    padding: 40px;
                }
                .stats {
                    background-color: var(--vscode-textBlockQuote-background);
                    border-left: 4px solid var(--vscode-textBlockQuote-border);
                    padding: 12px 16px;
                    margin-bottom: 20px;
                    border-radius: 4px;
                }
            </style>
        </head>
        <body>
            <h1>📊 Bookmark Tree Diagram</h1>
            ${bookmarks.length > 0 ? `
                <div class="stats">
                    <strong>📈 Statistics:</strong> ${bookmarks.length} root bookmark${bookmarks.length === 1 ? '' : 's'}
                </div>
                <div class="tree-container">
                    ${generateTreeHtml(bookmarks)}
                </div>
            ` : `
                <div class="empty-state">
                    <p>📋 No bookmarks found</p>
                    <p>Create some bookmarks to see the tree diagram!</p>
                </div>
            `}
        </body>
        </html>
    `;
}