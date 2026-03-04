import * as vscode from 'vscode';
import { BookmarkItem } from './types/bookmarkTypes';
import { BookmarkHistory, BookmarkTreeItem, BookmarkTreeDataProvider } from './class/bookmarkClasses';

let bookmarkHistory: BookmarkHistory;
let bookmarkTreeDataProvider: BookmarkTreeDataProvider;
let selectedParentBookmark: BookmarkItem | null = null;

export function activate(context: vscode.ExtensionContext) {
    console.log('Navigation extension is now active!');
    
    bookmarkHistory = new BookmarkHistory(context);
    bookmarkTreeDataProvider = new BookmarkTreeDataProvider(bookmarkHistory);
    
    // Register tree data provider
    const treeView = vscode.window.createTreeView('bookmarkExplorer', {
        treeDataProvider: bookmarkTreeDataProvider,
        showCollapseAll: true,
        dragAndDropController: bookmarkTreeDataProvider
    });
    
    // Hello World command
    let helloWorldDisposable = vscode.commands.registerCommand('nav-extension.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from Navigation Extension!');
    });
    
    // Bookmark current word command
    let bookmarkWordDisposable = vscode.commands.registerCommand('nav-extension.bookmarkWord', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor found');
            return;
        }

        const document = editor.document;
        const selection = editor.selection;
        
        let text: string;
        let position: vscode.Position;
        
        if (selection.isEmpty) {
            // No selection, get the word at cursor
            position = selection.active;
            const wordRange = document.getWordRangeAtPosition(position);
            
            if (!wordRange) {
                vscode.window.showWarningMessage('No word found at cursor position');
                return;
            }
            
            text = document.getText(wordRange);
            position = wordRange.start;
        } else {
            // Use selected text
            text = document.getText(selection);
            position = selection.start;
        }
        
        const bookmark: BookmarkItem = {
            text: text,
            filePath: document.fileName,
            line: position.line,
            character: position.character,
            timestamp: new Date()
        };
        
        if (selectedParentBookmark) {
            // Add as child to selected parent
            bookmarkHistory.addChildBookmark(selectedParentBookmark, bookmark);
            vscode.window.showInformationMessage(
                `Added "${text}" as child of "${selectedParentBookmark.text}"`
            );
            selectedParentBookmark = null; // Clear selection after use
        } else {
            // Add as top-level bookmark
            bookmarkHistory.add(bookmark);
            vscode.window.showInformationMessage(
                `Bookmarked: "${text}" (${bookmarkHistory.size()} bookmarks total)`
            );
        }
    });
    
    // Navigate to bookmark command
    let navigateToBookmarkDisposable = vscode.commands.registerCommand('nav-extension.navigateToBookmark', async (bookmark: BookmarkItem) => {
        try {
            const uri = vscode.Uri.file(bookmark.filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(document);
            
            const position = new vscode.Position(
                bookmark.line,
                bookmark.character
            );
            
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position));
            
            // Focus back to editor
            vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to navigate to bookmark: ${error}`);
        }
    });
    
    // Show bookmark history command (still available for command palette)
    let showHistoryDisposable = vscode.commands.registerCommand('nav-extension.showBookmarkHistory', async () => {
        const history = bookmarkHistory.getHistory();
        
        if (history.length === 0) {
            vscode.window.showInformationMessage('No bookmarks found');
            return;
        }
        
        const items = history.map((bookmark, index) => ({
            label: bookmark.text,
            description: `${vscode.workspace.asRelativePath(bookmark.filePath)}:${bookmark.line + 1}`,
            detail: `${bookmark.timestamp.toLocaleString()}`,
            bookmark: bookmark
        }));
        
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a bookmark to navigate to'
        });
        
        if (selected) {
            vscode.commands.executeCommand('nav-extension.navigateToBookmark', selected.bookmark);
        }
    });
    
    // Clear bookmark history command
    let clearHistoryDisposable = vscode.commands.registerCommand('nav-extension.clearBookmarkHistory', async () => {
        const answer = await vscode.window.showWarningMessage(
            'Are you sure you want to clear all bookmarks?',
            'Yes',
            'No'
        );
        
        if (answer === 'Yes') {
            bookmarkHistory.clear();
            vscode.window.showInformationMessage('Bookmark history cleared');
        }
    });
    
    // Remove single bookmark command
    let removeBookmarkDisposable = vscode.commands.registerCommand('nav-extension.removeBookmark', (treeItem: BookmarkTreeItem) => {
        bookmarkHistory.remove(treeItem.bookmark);
        vscode.window.showInformationMessage(`Removed bookmark: "${treeItem.bookmark.text}"`);
    });
    
    // Refresh tree view command
    let refreshTreeDisposable = vscode.commands.registerCommand('nav-extension.refreshBookmarkTree', () => {
        bookmarkTreeDataProvider.refresh();
    });
    
    // Focus bookmark explorer command
    let focusBookmarkExplorerDisposable = vscode.commands.registerCommand('nav-extension.focusBookmarkExplorer', () => {
        vscode.commands.executeCommand('bookmarkExplorer.focus');
    });
    
    // Set bookmark as parent command
    let setAsParentDisposable = vscode.commands.registerCommand('nav-extension.setAsParent', (treeItem: BookmarkTreeItem) => {
        selectedParentBookmark = treeItem.bookmark;
        vscode.window.showInformationMessage(
            `"${treeItem.bookmark.text}" selected as parent. Next bookmark will be added as its child.`
        );
    });
    
    // Add child bookmark command
    let addChildBookmarkDisposable = vscode.commands.registerCommand('nav-extension.addChildBookmark', async (treeItem: BookmarkTreeItem) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor found');
            return;
        }

        const document = editor.document;
        const selection = editor.selection;
        
        let text: string;
        let position: vscode.Position;
        
        if (selection.isEmpty) {
            // No selection, get the word at cursor
            position = selection.active;
            const wordRange = document.getWordRangeAtPosition(position);
            
            if (!wordRange) {
                vscode.window.showWarningMessage('No word found at cursor position');
                return;
            }
            
            text = document.getText(wordRange);
            position = wordRange.start;
        } else {
            // Use selected text
            text = document.getText(selection);
            position = selection.start;
        }
        
        const childBookmark: BookmarkItem = {
            text: text,
            filePath: document.fileName,
            line: position.line,
            character: position.character,
            timestamp: new Date()
        };
        
        bookmarkHistory.addChildBookmark(treeItem.bookmark, childBookmark);
        vscode.window.showInformationMessage(
            `Added "${text}" as child of "${treeItem.bookmark.text}"`
        );
    });
    
    context.subscriptions.push(
        treeView,
        helloWorldDisposable,
        bookmarkWordDisposable,
        navigateToBookmarkDisposable,
        showHistoryDisposable,
        clearHistoryDisposable,
        removeBookmarkDisposable,
        refreshTreeDisposable,
        focusBookmarkExplorerDisposable,
        setAsParentDisposable,
        addChildBookmarkDisposable
    );
}

export function deactivate() {}