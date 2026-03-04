export interface BookmarkItem {
    text: string;
    filePath: string;
    line: number;
    character: number;
    timestamp: Date;
    notes?: string;
    children?: BookmarkItem[];
    parent?: BookmarkItem;
}