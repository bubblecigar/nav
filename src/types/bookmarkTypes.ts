export interface BookmarkItem {
    text: string;
    filePath: string;
    line: number;
    character: number;
    timestamp: Date;
    children?: BookmarkItem[];
    parent?: BookmarkItem;
}