import * as vscode from 'vscode';
import { BookmarkItem } from '../types/bookmarkTypes';

export class BookmarkHistory {
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

export class BookmarkTreeItem extends vscode.TreeItem {
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

export class BookmarkTreeDataProvider implements vscode.TreeDataProvider<BookmarkTreeItem> {
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