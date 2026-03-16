export interface BookmarkItem {
    id?: string;
    text: string;
    filePath: string;
    line: number;
    character: number;
    timestamp: Date;
    contextBefore?: string[];
    contextAfter?: string[];
    notes?: string;
    children?: BookmarkItem[];
    parent?: BookmarkItem;
}
