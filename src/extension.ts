import * as vscode from 'vscode';
import { BookmarkItem } from './types/bookmarkTypes';

class BookmarkHistory {
    private history: BookmarkItem[] = [];
    private maxSize: number = 100;
    private _onDidChangeTreeData: vscode.EventEmitter<BookmarkTreeItem | undefined | null | void> = new vscode.EventEmitter<BookmarkTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<BookmarkTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private context: vscode.ExtensionContext;
    private readonly storageKey = 'bookmarkHistory';

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.loadFromStorage();
    }

    private async saveToStorage(): Promise<void> {
        try {
            // Convert BookmarkItems to serializable objects
            const serializedHistory = this.history.map(item => ({
                text: item.text,
                filePath: item.filePath,
                line: item.line,
                character: item.character,
                timestamp: item.timestamp.toISOString() // Convert Date to string
            }));
            
            await this.context.globalState.update(this.storageKey, serializedHistory);
        } catch (error) {
            console.error('Failed to save bookmark history:', error);
        }
    }

    private loadFromStorage(): void {
        try {
            const stored = this.context.globalState.get<any[]>(this.storageKey, []);
            
            // Convert serialized objects back to BookmarkItems
            this.history = stored.map(item => ({
                text: item.text,
                filePath: item.filePath,
                line: item.line,
                character: item.character,
                timestamp: new Date(item.timestamp) // Convert string back to Date
            })).filter(item => {
                // Filter out invalid entries
                return item.text && item.filePath && 
                       typeof item.line === 'number' && 
                       typeof item.character === 'number' && 
                       item.timestamp instanceof Date && !isNaN(item.timestamp.getTime());
            });
            
            // Ensure we don't exceed max size
            if (this.history.length > this.maxSize) {
                this.history = this.history.slice(0, this.maxSize);
            }
            
            this._onDidChangeTreeData.fire();
        } catch (error) {
            console.error('Failed to load bookmark history:', error);
            this.history = [];
        }
    }

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
        
        this._onDidChangeTreeData.fire();
        this.saveToStorage(); // Persist changes
    }

    remove(item: BookmarkItem) {
        this.history = this.history.filter(h => 
            !(h.text === item.text && h.filePath === item.filePath && h.line === item.line && h.timestamp === item.timestamp)
        );
        this._onDidChangeTreeData.fire();
        this.saveToStorage(); // Persist changes
    }

    getHistory(): BookmarkItem[] {
        return [...this.history];
    }

    clear() {
        this.history = [];
        this._onDidChangeTreeData.fire();
        this.saveToStorage(); // Persist changes
    }

    size(): number {
        return this.history.length;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
}

class BookmarkTreeItem extends vscode.TreeItem {
    constructor(
        public readonly bookmark: BookmarkItem,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(bookmark.text, collapsibleState);
        
        this.tooltip = `${bookmark.text}\nFile: ${vscode.workspace.asRelativePath(bookmark.filePath)}\nLine: ${bookmark.line + 1}\nTime: ${bookmark.timestamp.toLocaleString()}`;
        this.description = `${vscode.workspace.asRelativePath(bookmark.filePath)}:${bookmark.line + 1}`;
        
        // Set the command to navigate to bookmark when clicked
        this.command = {
            command: 'nav-extension.navigateToBookmark',
            title: 'Navigate to Bookmark',
            arguments: [bookmark]
        };
        
        // Set context value for context menu
        this.contextValue = 'bookmarkItem';
        
        // Set icon
        this.iconPath = new vscode.ThemeIcon('bookmark');
    }
}

class BookmarkTreeDataProvider implements vscode.TreeDataProvider<BookmarkTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<BookmarkTreeItem | undefined | null | void> = new vscode.EventEmitter<BookmarkTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<BookmarkTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private bookmarkHistory: BookmarkHistory) {
        // Listen to bookmark history changes
        bookmarkHistory.onDidChangeTreeData(() => {
            this._onDidChangeTreeData.fire();
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: BookmarkTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: BookmarkTreeItem): Thenable<BookmarkTreeItem[]> {
        if (!element) {
            // Root level - return all bookmarks
            const bookmarks = this.bookmarkHistory.getHistory();
            return Promise.resolve(
                bookmarks.map(bookmark => 
                    new BookmarkTreeItem(bookmark, vscode.TreeItemCollapsibleState.None)
                )
            );
        }
        return Promise.resolve([]);
    }
}

let bookmarkHistory: BookmarkHistory;
let bookmarkTreeDataProvider: BookmarkTreeDataProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log('Navigation extension is now active!');
    
    bookmarkHistory = new BookmarkHistory(context);
    bookmarkTreeDataProvider = new BookmarkTreeDataProvider(bookmarkHistory);
    
    // Register tree data provider
    const treeView = vscode.window.createTreeView('bookmarkExplorer', {
        treeDataProvider: bookmarkTreeDataProvider,
        showCollapseAll: true
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
        
        bookmarkHistory.add(bookmark);
        
        vscode.window.showInformationMessage(
            `Bookmarked: "${text}" (${bookmarkHistory.size()} bookmarks total)`
        );
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
    
    context.subscriptions.push(
        treeView,
        helloWorldDisposable,
        bookmarkWordDisposable,
        navigateToBookmarkDisposable,
        showHistoryDisposable,
        clearHistoryDisposable,
        removeBookmarkDisposable,
        refreshTreeDisposable,
        focusBookmarkExplorerDisposable
    );
}

export function deactivate() {}