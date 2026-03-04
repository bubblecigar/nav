import * as vscode from 'vscode';

interface BookmarkItem {
    text: string;
    filePath: string;
    line: number;
    character: number;
    timestamp: Date;
}

class BookmarkHistory {
    private history: BookmarkItem[] = [];
    private maxSize: number = 100;

    add(item: BookmarkItem) {
        // Remove duplicate if exists
        this.history = this.history.filter(h => 
            !(h.text === item.text && h.filePath === item.filePath && h.line === item.line)
        );
        
        // Add to front of history
        this.history.unshift(item);
        
        // Maintain max size
        if (this.history.length > this.maxSize) {
            this.history = this.history.slice(0, this.maxSize);
        }
    }

    getHistory(): BookmarkItem[] {
        return [...this.history];
    }

    clear() {
        this.history = [];
    }

    size(): number {
        return this.history.length;
    }
}

let bookmarkHistory: BookmarkHistory;

export function activate(context: vscode.ExtensionContext) {
    console.log('Navigation extension is now active!');
    
    bookmarkHistory = new BookmarkHistory();
    
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
        
        bookmarkHistory.add(bookmark);
        
        vscode.window.showInformationMessage(
            `Bookmarked: "${text}" (${bookmarkHistory.size()} bookmarks total)`
        );
    });
    
    // Show bookmark history command
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
            const uri = vscode.Uri.file(selected.bookmark.filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(document);
            
            const position = new vscode.Position(
                selected.bookmark.line,
                selected.bookmark.character
            );
            
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position));
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
    
    context.subscriptions.push(
        helloWorldDisposable,
        bookmarkWordDisposable,
        showHistoryDisposable,
        clearHistoryDisposable
    );
}

export function deactivate() {}