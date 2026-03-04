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
            // Convert BookmarkItems to serializable objects with nested structure
            const serializedHistory = this.serializeBookmarks(this.history);
            
            await this.context.globalState.update(this.storageKey, serializedHistory);
        } catch (error) {
            console.error('Failed to save bookmark history:', error);
        }
    }

    private serializeBookmarks(bookmarks: BookmarkItem[]): any[] {
        return bookmarks.map(item => ({
            text: item.text,
            filePath: item.filePath,
            line: item.line,
            character: item.character,
            timestamp: item.timestamp.toISOString(),
            children: item.children ? this.serializeBookmarks(item.children) : undefined
        }));
    }

    private loadFromStorage(): void {
        try {
            const stored = this.context.globalState.get<any[]>(this.storageKey, []);
            
            // Convert serialized objects back to BookmarkItems with nested structure
            this.history = this.deserializeBookmarks(stored, null);
            
            // Ensure we don't exceed max size (count only top-level items)
            if (this.history.length > this.maxSize) {
                this.history = this.history.slice(0, this.maxSize);
            }
            
            this._onDidChangeTreeData.fire();
        } catch (error) {
            console.error('Failed to load bookmark history:', error);
            this.history = [];
        }
    }

    private deserializeBookmarks(serialized: any[], parent: BookmarkItem | null): BookmarkItem[] {
        return serialized.map(item => {
            if (!this.isValidBookmarkData(item)) return null;
            
            const bookmark: BookmarkItem = {
                text: item.text,
                filePath: item.filePath,
                line: item.line,
                character: item.character,
                timestamp: new Date(item.timestamp),
                parent: parent || undefined,
                children: undefined
            };
            
            // Recursively deserialize children
            if (item.children && Array.isArray(item.children)) {
                bookmark.children = this.deserializeBookmarks(item.children, bookmark);
            }
            
            return bookmark;
        }).filter((item): item is BookmarkItem => item !== null);
    }

    private isValidBookmarkData(item: any): boolean {
        return item.text && item.filePath && 
               typeof item.line === 'number' && 
               typeof item.character === 'number' && 
               item.timestamp && !isNaN(new Date(item.timestamp).getTime());
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

    addChildBookmark(parentBookmark: BookmarkItem, childBookmark: BookmarkItem): void {
        if (!parentBookmark.children) {
            parentBookmark.children = [];
        }
        
        childBookmark.parent = parentBookmark;
        
        // Remove duplicate child if exists
        parentBookmark.children = parentBookmark.children.filter(child =>
            !(child.text === childBookmark.text && 
              child.filePath === childBookmark.filePath && 
              child.line === childBookmark.line)
        );
        
        parentBookmark.children.unshift(childBookmark);
        
        this._onDidChangeTreeData.fire();
        this.saveToStorage();
    }

    getAllBookmarks(): BookmarkItem[] {
        const allBookmarks: BookmarkItem[] = [];
        
        const addBookmarkAndChildren = (bookmark: BookmarkItem) => {
            allBookmarks.push(bookmark);
            if (bookmark.children) {
                bookmark.children.forEach(addBookmarkAndChildren);
            }
        };
        
        this.history.forEach(addBookmarkAndChildren);
        return allBookmarks;
    }

    findBookmark(text: string, filePath: string, line: number): BookmarkItem | null {
        const search = (bookmarks: BookmarkItem[]): BookmarkItem | null => {
            for (const bookmark of bookmarks) {
                if (bookmark.text === text && bookmark.filePath === filePath && bookmark.line === line) {
                    return bookmark;
                }
                if (bookmark.children) {
                    const found = search(bookmark.children);
                    if (found) return found;
                }
            }
            return null;
        };
        
        return search(this.history);
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
        
        // Set context value for context menu - distinguish parent vs child
        this.contextValue = bookmark.children && bookmark.children.length > 0 ? 'bookmarkParent' : 'bookmarkItem';
        
        // Set icon based on whether it has children
        if (bookmark.children && bookmark.children.length > 0) {
            this.iconPath = new vscode.ThemeIcon('folder');
        } else if (bookmark.parent) {
            this.iconPath = new vscode.ThemeIcon('bookmark-filled');
        } else {
            this.iconPath = new vscode.ThemeIcon('bookmark');
        }
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
            // Root level - return all top-level bookmarks
            const bookmarks = this.bookmarkHistory.getHistory();
            return Promise.resolve(
                bookmarks.map(bookmark => {
                    const collapsibleState = bookmark.children && bookmark.children.length > 0
                        ? vscode.TreeItemCollapsibleState.Collapsed
                        : vscode.TreeItemCollapsibleState.None;
                    return new BookmarkTreeItem(bookmark, collapsibleState);
                })
            );
        } else {
            // Child level - return children of the selected bookmark
            const children = element.bookmark.children || [];
            return Promise.resolve(
                children.map(bookmark => {
                    const collapsibleState = bookmark.children && bookmark.children.length > 0
                        ? vscode.TreeItemCollapsibleState.Collapsed
                        : vscode.TreeItemCollapsibleState.None;
                    return new BookmarkTreeItem(bookmark, collapsibleState);
                })
            );
        }
    }
}