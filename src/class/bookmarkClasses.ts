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
            notes: item.notes,
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
                notes: item.notes,
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
        
        // Add to end of history (oldest to newest)
        this.history.push(item);
        
        // Maintain max size
        if (this.history.length > this.maxSize) {
            this.history = this.history.slice(-this.maxSize);
        }
        
        this._onDidChangeTreeData.fire();
        this.saveToStorage(); // Persist changes
    }

    remove(item: BookmarkItem) {
        // Remove from top-level history
        this.history = this.history.filter(h => 
            !(h.text === item.text && h.filePath === item.filePath && h.line === item.line && h.timestamp === item.timestamp)
        );
        
        // Recursively remove from children of all bookmarks
        this.removeFromChildren(this.history, item);
        
        this._onDidChangeTreeData.fire();
        this.saveToStorage(); // Persist changes
    }

    private removeFromChildren(bookmarks: BookmarkItem[], itemToRemove: BookmarkItem): void {
        bookmarks.forEach(bookmark => {
            if (bookmark.children) {
                // Remove from this bookmark's children
                bookmark.children = bookmark.children.filter(child =>
                    !(child.text === itemToRemove.text && 
                      child.filePath === itemToRemove.filePath && 
                      child.line === itemToRemove.line && 
                      child.timestamp === itemToRemove.timestamp)
                );
                
                // Recursively check children's children
                this.removeFromChildren(bookmark.children, itemToRemove);
            }
        });
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
        
        // Add to end of children (oldest to newest)
        parentBookmark.children.push(childBookmark);
        
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

    save(): void {
        this.saveToStorage();
    }

    updateBookmarkNotes(bookmarkKey: string, notes: string): boolean {
        // Parse the bookmark key (format: filePath:line:character:timestamp)
        const keyParts = bookmarkKey.split(':');
        if (keyParts.length < 4) return false;
        
        const filePath = keyParts.slice(0, -3).join(':'); // Handle file paths with colons
        const line = parseInt(keyParts[keyParts.length - 3]);
        const character = parseInt(keyParts[keyParts.length - 2]);
        const timestamp = parseInt(keyParts[keyParts.length - 1]);
        
        // Find the bookmark using all identifiers
        const findAndUpdate = (bookmarks: BookmarkItem[]): boolean => {
            for (const bookmark of bookmarks) {
                if (bookmark.filePath === filePath && 
                    bookmark.line === line && 
                    bookmark.character === character && 
                    bookmark.timestamp.getTime() === timestamp) {
                    
                    bookmark.notes = notes;
                    this._onDidChangeTreeData.fire();
                    this.saveToStorage();
                    return true;
                }
                if (bookmark.children && findAndUpdate(bookmark.children)) {
                    return true;
                }
            }
            return false;
        };
        
        return findAndUpdate(this.history);
    }

    exportToJson(): string {
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            bookmarks: this.serializeBookmarks(this.history)
        };
        return JSON.stringify(exportData, null, 2);
    }

    importFromJson(jsonString: string): boolean {
        try {
            const importData = JSON.parse(jsonString);
            
            // Validate the import data structure
            if (!importData.bookmarks || !Array.isArray(importData.bookmarks)) {
                throw new Error('Invalid bookmark data format');
            }
            
            // Deserialize the bookmarks
            const importedBookmarks = this.deserializeBookmarks(importData.bookmarks, null);
            
            // Replace current history with imported bookmarks
            this.history = importedBookmarks;
            
            // Save to storage and update UI
            this._onDidChangeTreeData.fire();
            this.saveToStorage();
            
            return true;
        } catch (error) {
            console.error('Failed to import bookmarks:', error);
            return false;
        }
    }

    mergeFromJson(jsonString: string): boolean {
        try {
            const importData = JSON.parse(jsonString);
            
            // Validate the import data structure
            if (!importData.bookmarks || !Array.isArray(importData.bookmarks)) {
                throw new Error('Invalid bookmark data format');
            }
            
            // Deserialize the bookmarks
            const importedBookmarks = this.deserializeBookmarks(importData.bookmarks, null);
            
            // Merge with existing history (add to end)
            this.history.push(...importedBookmarks);
            
            // Ensure we don't exceed max size
            if (this.history.length > this.maxSize) {
                this.history = this.history.slice(-this.maxSize);
            }
            
            // Save to storage and update UI
            this._onDidChangeTreeData.fire();
            this.saveToStorage();
            
            return true;
        } catch (error) {
            console.error('Failed to merge bookmarks:', error);
            return false;
        }
    }

    moveBookmarkUp(bookmark: BookmarkItem): boolean {
        if (bookmark.parent) {
            // Move within parent's children
            const siblings = bookmark.parent.children;
            if (!siblings) return false;

            const currentIndex = siblings.findIndex(child => 
                child.text === bookmark.text && 
                child.filePath === bookmark.filePath && 
                child.line === bookmark.line &&
                child.timestamp.getTime() === bookmark.timestamp.getTime()
            );

            if (currentIndex > 0) {
                // Swap with previous sibling
                [siblings[currentIndex - 1], siblings[currentIndex]] = [siblings[currentIndex], siblings[currentIndex - 1]];
                this._onDidChangeTreeData.fire();
                this.saveToStorage();
                return true;
            }
        } else {
            // Move within top-level history
            const currentIndex = this.history.findIndex(item => 
                item.text === bookmark.text && 
                item.filePath === bookmark.filePath && 
                item.line === bookmark.line &&
                item.timestamp.getTime() === bookmark.timestamp.getTime()
            );

            if (currentIndex > 0) {
                // Swap with previous item
                [this.history[currentIndex - 1], this.history[currentIndex]] = [this.history[currentIndex], this.history[currentIndex - 1]];
                this._onDidChangeTreeData.fire();
                this.saveToStorage();
                return true;
            }
        }
        return false;
    }

    moveBookmarkDown(bookmark: BookmarkItem): boolean {
        if (bookmark.parent) {
            // Move within parent's children
            const siblings = bookmark.parent.children;
            if (!siblings) return false;

            const currentIndex = siblings.findIndex(child => 
                child.text === bookmark.text && 
                child.filePath === bookmark.filePath && 
                child.line === bookmark.line &&
                child.timestamp.getTime() === bookmark.timestamp.getTime()
            );

            if (currentIndex >= 0 && currentIndex < siblings.length - 1) {
                // Swap with next sibling
                [siblings[currentIndex], siblings[currentIndex + 1]] = [siblings[currentIndex + 1], siblings[currentIndex]];
                this._onDidChangeTreeData.fire();
                this.saveToStorage();
                return true;
            }
        } else {
            // Move within top-level history
            const currentIndex = this.history.findIndex(item => 
                item.text === bookmark.text && 
                item.filePath === bookmark.filePath && 
                item.line === bookmark.line &&
                item.timestamp.getTime() === bookmark.timestamp.getTime()
            );

            if (currentIndex >= 0 && currentIndex < this.history.length - 1) {
                // Swap with next item
                [this.history[currentIndex], this.history[currentIndex + 1]] = [this.history[currentIndex + 1], this.history[currentIndex]];
                this._onDidChangeTreeData.fire();
                this.saveToStorage();
                return true;
            }
        }
        return false;
    }

    canMoveUp(bookmark: BookmarkItem): boolean {
        if (bookmark.parent) {
            // Check within parent's children
            const siblings = bookmark.parent.children;
            if (!siblings || siblings.length <= 1) return false;

            const currentIndex = siblings.findIndex(child => 
                child.text === bookmark.text && 
                child.filePath === bookmark.filePath && 
                child.line === bookmark.line &&
                child.timestamp.getTime() === bookmark.timestamp.getTime()
            );

            return currentIndex > 0;
        } else {
            // Check within top-level history
            if (this.history.length <= 1) return false;

            const currentIndex = this.history.findIndex(item => 
                item.text === bookmark.text && 
                item.filePath === bookmark.filePath && 
                item.line === bookmark.line &&
                item.timestamp.getTime() === bookmark.timestamp.getTime()
            );

            return currentIndex > 0;
        }
    }

    canMoveDown(bookmark: BookmarkItem): boolean {
        if (bookmark.parent) {
            // Check within parent's children
            const siblings = bookmark.parent.children;
            if (!siblings || siblings.length <= 1) return false;

            const currentIndex = siblings.findIndex(child => 
                child.text === bookmark.text && 
                child.filePath === bookmark.filePath && 
                child.line === bookmark.line &&
                child.timestamp.getTime() === bookmark.timestamp.getTime()
            );

            return currentIndex >= 0 && currentIndex < siblings.length - 1;
        } else {
            // Check within top-level history
            if (this.history.length <= 1) return false;

            const currentIndex = this.history.findIndex(item => 
                item.text === bookmark.text && 
                item.filePath === bookmark.filePath && 
                item.line === bookmark.line &&
                item.timestamp.getTime() === bookmark.timestamp.getTime()
            );

            return currentIndex >= 0 && currentIndex < this.history.length - 1;
        }
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
        
        // Set context value for context menu - distinguish parent vs child
        this.contextValue = bookmark.children && bookmark.children.length > 0 ? 'bookmarkParent' : 'bookmarkItem';
        
        this.iconPath = new vscode.ThemeIcon('bookmark');
    }
}

export class BookmarkTreeDataProvider implements vscode.TreeDataProvider<BookmarkTreeItem>, vscode.TreeDragAndDropController<BookmarkTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<BookmarkTreeItem | undefined | null | void> = new vscode.EventEmitter<BookmarkTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<BookmarkTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    dropMimeTypes = ['application/vnd.code.tree.bookmarkExplorer'];
    dragMimeTypes = ['application/vnd.code.tree.bookmarkExplorer'];

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

    getParent(element: BookmarkTreeItem): vscode.ProviderResult<BookmarkTreeItem> {
        // If the bookmark has a parent, find and return the parent TreeItem
        if (element.bookmark.parent) {
            const parent = element.bookmark.parent;
            const collapsibleState = parent.children && parent.children.length > 0
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None;
            return new BookmarkTreeItem(parent, collapsibleState);
        }
        // Root level items have no parent
        return undefined;
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

    async handleDrag(source: BookmarkTreeItem[], dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
        const transferItem = new vscode.DataTransferItem(source.map(item => ({
            text: item.bookmark.text,
            filePath: item.bookmark.filePath,
            line: item.bookmark.line,
            character: item.bookmark.character,
            timestamp: item.bookmark.timestamp.toISOString(),
            children: item.bookmark.children ? this.serializeBookmarks(item.bookmark.children) : undefined
        })));
        dataTransfer.set(this.dragMimeTypes[0], transferItem);
    }

    async handleDrop(target: BookmarkTreeItem | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
        const transferItem = dataTransfer.get(this.dropMimeTypes[0]);
        if (!transferItem) return;

        const draggedItems = transferItem.value as any[];
        if (!draggedItems || draggedItems.length === 0) return;

        for (const draggedData of draggedItems) {
            // Remove the dragged bookmark from its current location
            const draggedBookmark = this.findBookmarkInHistory(draggedData);
            if (!draggedBookmark) continue;

            // Check if target is a descendant of the dragged bookmark to prevent circular references
            if (target && this.isDescendantOf(target.bookmark, draggedBookmark)) {
                continue; // Skip this drop operation
            }

            this.bookmarkHistory.remove(draggedBookmark);

            // Recreate the bookmark with proper structure
            const newBookmark: BookmarkItem = {
                text: draggedData.text,
                filePath: draggedData.filePath,
                line: draggedData.line,
                character: draggedData.character,
                timestamp: new Date(draggedData.timestamp),
                children: draggedData.children ? this.deserializeBookmarks(draggedData.children, null) : undefined
            };

            if (target) {
                // Dropped on another bookmark - make it a child
                this.bookmarkHistory.addChildBookmark(target.bookmark, newBookmark);
            } else {
                // Dropped on empty space - make it a top-level bookmark
                this.bookmarkHistory.add(newBookmark);
            }
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

    private deserializeBookmarks(serialized: any[], parent: BookmarkItem | null): BookmarkItem[] {
        return serialized.map(item => {
            const bookmark: BookmarkItem = {
                text: item.text,
                filePath: item.filePath,
                line: item.line,
                character: item.character,
                timestamp: new Date(item.timestamp),
                notes: item.notes,
                parent: parent || undefined,
                children: undefined
            };
            
            if (item.children && Array.isArray(item.children)) {
                bookmark.children = this.deserializeBookmarks(item.children, bookmark);
            }
            
            return bookmark;
        });
    }

    private isDescendantOf(potential: BookmarkItem, ancestor: BookmarkItem): boolean {
        // Check if potential is a descendant of ancestor
        if (!ancestor.children) return false;
        
        for (const child of ancestor.children) {
            // Direct child match
            if (this.bookmarksEqual(child, potential)) {
                return true;
            }
            // Recursive check in child's descendants
            if (this.isDescendantOf(potential, child)) {
                return true;
            }
        }
        return false;
    }

    private bookmarksEqual(a: BookmarkItem, b: BookmarkItem): boolean {
        return a.text === b.text && 
               a.filePath === b.filePath && 
               a.line === b.line && 
               a.timestamp.getTime() === b.timestamp.getTime();
    }

    private findBookmarkInHistory(data: any): BookmarkItem | null {
        return this.bookmarkHistory.findBookmark(data.text, data.filePath, data.line);
    }

    getRootItems(): BookmarkTreeItem[] {
        const bookmarks = this.bookmarkHistory.getHistory();
        return bookmarks.map(bookmark => {
            const collapsibleState = bookmark.children && bookmark.children.length > 0
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None;
            return new BookmarkTreeItem(bookmark, collapsibleState);
        });
    }
}