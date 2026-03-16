import * as vscode from 'vscode';
import * as path from 'path';
import { BookmarkItem } from './types/bookmarkTypes';
import { BookmarkHistory, BookmarkTreeItem, BookmarkTreeDataProvider } from './class/bookmarkClasses';
import { updateContextVariables } from './utils/panelUtils';
import { getDiagramWebviewContent } from './utils/diagramUtils';
import { generateId } from './utils/idUtils';
import { BookmarkDetailsViewProvider } from './utils/BookmarkDetailsViewProvider';

let bookmarkHistory: BookmarkHistory;
let bookmarkTreeDataProvider: BookmarkTreeDataProvider;
let bookmarkDetailsProvider: BookmarkDetailsViewProvider;
const lastImportExportDirectoryKey = 'lastImportExportDirectory';

export function activate(context: vscode.ExtensionContext) {
    console.log('Navigation extension is now active!');
    
    bookmarkHistory = new BookmarkHistory(context);
    bookmarkTreeDataProvider = new BookmarkTreeDataProvider(bookmarkHistory);

    const getLastImportExportDirectory = (): string | undefined => {
        return context.globalState.get<string>(lastImportExportDirectoryKey);
    };

    const getDefaultExportUri = (fileName: string): vscode.Uri => {
        const lastDirectory = getLastImportExportDirectory();
        return lastDirectory
            ? vscode.Uri.file(path.join(lastDirectory, fileName))
            : vscode.Uri.file(fileName);
    };

    const getDefaultImportUri = (): vscode.Uri | undefined => {
        const lastDirectory = getLastImportExportDirectory();
        return lastDirectory ? vscode.Uri.file(lastDirectory) : undefined;
    };

    const saveImportExportDirectory = async (uri: vscode.Uri): Promise<void> => {
        await context.globalState.update(lastImportExportDirectoryKey, path.dirname(uri.fsPath));
    };

    const setImportExportDirectory = async (directoryUri: vscode.Uri): Promise<void> => {
        await context.globalState.update(lastImportExportDirectoryKey, directoryUri.fsPath);
    };
    
    // Register tree data provider
    const treeView = vscode.window.createTreeView('bookmarkExplorer', {
        treeDataProvider: bookmarkTreeDataProvider,
        showCollapseAll: true,
        dragAndDropController: bookmarkTreeDataProvider
    });
    
    // Register webview view provider for bookmark details
    bookmarkDetailsProvider = new BookmarkDetailsViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('bookmarkDetailsView', bookmarkDetailsProvider)
    );
    
    // Handle notes saving from webview
    bookmarkDetailsProvider.onDidSaveNotes((data) => {
        bookmarkHistory.updateBookmarkNotes(data.bookmarkKey, data.notes);
    });
    
    // Update context variables when selection changes
    treeView.onDidChangeSelection((e) => {
        const selectedItem = e.selection.length > 0 ? e.selection[0] : null;
        updateContextVariables(bookmarkHistory, selectedItem);
        // Update the webview view with selected bookmark
        if (selectedItem) {
            bookmarkDetailsProvider.updateContent(selectedItem.bookmark);
        } else {
            bookmarkDetailsProvider.clearContent();
        }
    });
    
    // Update context variables when tree data changes
    bookmarkTreeDataProvider.onDidChangeTreeData(() => {
        // Get current selection and update context
        if (treeView.selection.length > 0) {
            updateContextVariables(bookmarkHistory, treeView.selection[0]);
        } else {
            updateContextVariables(bookmarkHistory, null);
        }
    });
    
    // Hello World command
    let helloWorldDisposable = vscode.commands.registerCommand('nav-extension.helloWorld', () => {
        // Hello world command
    });
    
    // Bookmark current word command
    let bookmarkWordDisposable = vscode.commands.registerCommand('nav-extension.bookmarkWord', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
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
            id: generateId(),
            text: text,
            filePath: document.fileName,
            line: position.line,
            character: position.character,
            timestamp: new Date()
        };
        
        // Add as top-level bookmark
        bookmarkHistory.add(bookmark);
    });
    
    // Navigate to bookmark command
    let navigateToBookmarkDisposable = vscode.commands.registerCommand('nav-extension.navigateToBookmark', async (bookmarkOrTreeItem: BookmarkItem | BookmarkTreeItem) => {
        try {
            // Handle both BookmarkItem and BookmarkTreeItem
            const bookmark = 'bookmark' in bookmarkOrTreeItem ? bookmarkOrTreeItem.bookmark : bookmarkOrTreeItem;
            
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
            // Navigation failed
        }
    });
    
    // Show bookmark history command (still available for command palette)
    let showHistoryDisposable = vscode.commands.registerCommand('nav-extension.showBookmarkHistory', async () => {
        const history = bookmarkHistory.getHistory();
        
        if (history.length === 0) {
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
        bookmarkHistory.clear();
    });
    
    // Remove single bookmark command
    let removeBookmarkDisposable = vscode.commands.registerCommand('nav-extension.removeBookmark', (treeItem: BookmarkTreeItem) => {
        bookmarkHistory.remove(treeItem.bookmark);
    });
    
    // Focus bookmark explorer command
    let focusBookmarkExplorerDisposable = vscode.commands.registerCommand('nav-extension.focusBookmarkExplorer', () => {
        vscode.commands.executeCommand('bookmarkExplorer.focus');
    });
    
    // Move bookmark up command
    let moveBookmarkUpDisposable = vscode.commands.registerCommand('nav-extension.moveBookmarkUp', (treeItem?: BookmarkTreeItem) => {
        // If no treeItem provided (keyboard shortcut), get current selection
        const targetItem = treeItem || (treeView.selection.length > 0 ? treeView.selection[0] : null);
        
        if (!targetItem) {
            return;
        }
        
        bookmarkHistory.moveBookmarkUp(targetItem.bookmark);
    });
    
    // Move bookmark down command
    let moveBookmarkDownDisposable = vscode.commands.registerCommand('nav-extension.moveBookmarkDown', (treeItem?: BookmarkTreeItem) => {
        // If no treeItem provided (keyboard shortcut), get current selection
        const targetItem = treeItem || (treeView.selection.length > 0 ? treeView.selection[0] : null);
        
        if (!targetItem) {
            return;
        }
        
        bookmarkHistory.moveBookmarkDown(targetItem.bookmark);
    });

    // Expand all bookmarks command
    let expandAllDisposable = vscode.commands.registerCommand('nav-extension.expandAllBookmarks', async () => {
        // Recursively expand all tree items
        const expandAllItems = async (items: BookmarkTreeItem[]) => {
            for (const item of items) {
                if (item.bookmark.children && item.bookmark.children.length > 0) {
                    await treeView.reveal(item, { expand: true });
                    // Get children and recursively expand them
                    const childItems = item.bookmark.children.map(child => {
                        const collapsibleState = child.children && child.children.length > 0
                            ? vscode.TreeItemCollapsibleState.Collapsed
                            : vscode.TreeItemCollapsibleState.None;
                        return new BookmarkTreeItem(child, collapsibleState);
                    });
                    await expandAllItems(childItems);
                }
            }
        };
        
        // Get root items and expand them all
        const rootItems = bookmarkTreeDataProvider.getRootItems();
        await expandAllItems(rootItems);
    });

    // Show bookmark details command
    let showBookmarkDetailsDisposable = vscode.commands.registerCommand('nav-extension.showBookmarkDetails', (treeItem?: BookmarkTreeItem) => {
        let selectedItem: BookmarkTreeItem | undefined;
        
        if (treeItem) {
            // Called from inline button
            selectedItem = treeItem;
        } else {
            // Called from command palette or keyboard shortcut
            if (treeView.selection && treeView.selection.length > 0) {
                selectedItem = treeView.selection[0];
            }
        }
        
        // Update the webview content with selected bookmark
        if (selectedItem) {
            bookmarkDetailsProvider.updateContent(selectedItem.bookmark);
        }
        
        // Focus the bookmark details panel
        vscode.commands.executeCommand('bookmarkDetailsView.focus');
    });

    // Export bookmarks command
    let exportBookmarksDisposable = vscode.commands.registerCommand('nav-extension.exportBookmarks', async () => {
        try {
            const jsonData = bookmarkHistory.exportToJson();
            const defaultFileName = `bookmarks-${new Date().toISOString().split('T')[0]}.json`;
            
            const uri = await vscode.window.showSaveDialog({
                filters: {
                    'JSON Files': ['json'],
                    'All Files': ['*']
                },
                defaultUri: getDefaultExportUri(defaultFileName)
            });

            if (uri) {
                await vscode.workspace.fs.writeFile(uri, Buffer.from(jsonData, 'utf8'));
                await saveImportExportDirectory(uri);
            }
        } catch (error) {
            // Export failed silently
        }
    });

    // Import bookmarks command
    let importBookmarksDisposable = vscode.commands.registerCommand('nav-extension.importBookmarks', async () => {
        try {
            const uris = await vscode.window.showOpenDialog({
                filters: {
                    'JSON Files': ['json'],
                    'All Files': ['*']
                },
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                openLabel: 'Import Bookmarks',
                defaultUri: getDefaultImportUri()
            });

            if (uris && uris.length > 0) {
                const fileUri = uris[0];
                const fileContent = await vscode.workspace.fs.readFile(fileUri);
                const jsonString = Buffer.from(fileContent).toString('utf8');
                
                // Ask user whether to replace or merge
                const action = await vscode.window.showQuickPick([
                    {
                        label: 'Replace All',
                        description: 'Replace all existing bookmarks with imported ones',
                        detail: 'This will delete your current bookmarks'
                    },
                    {
                        label: 'Merge',
                        description: 'Add imported bookmarks to existing ones',
                        detail: 'This will keep your current bookmarks and add the new ones'
                    }
                ], {
                    placeHolder: 'How would you like to import the bookmarks?'
                });

                if (action) {
                    if (action.label === 'Replace All') {
                        bookmarkHistory.importFromJson(jsonString);
                    } else {
                        bookmarkHistory.mergeFromJson(jsonString);
                    }

                    await saveImportExportDirectory(fileUri);
                }
            }
        } catch (error) {
            // Import failed silently
        }
    });

    let showSavedDirectoryFilesDisposable = vscode.commands.registerCommand('nav-extension.showSavedDirectoryFiles', async () => {
        try {
            type SavedDirectoryFileItem = vscode.QuickPickItem & {
                itemType: 'file';
                uri: vscode.Uri;
            };

            type ChangeDirectoryItem = vscode.QuickPickItem & {
                itemType: 'changeDirectory';
            };

            let savedDirectory = getLastImportExportDirectory();
            if (!savedDirectory) {
                const uris = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    openLabel: 'Select Saved Directory'
                });

                if (!uris || uris.length === 0) {
                    return;
                }

                await setImportExportDirectory(uris[0]);
                savedDirectory = uris[0].fsPath;
            }

            const buildFileItems = async (directory: string) => {
                const directoryUri = vscode.Uri.file(directory);
                const entries = await vscode.workspace.fs.readDirectory(directoryUri);
                return entries
                    .filter(([, fileType]) => fileType === vscode.FileType.File)
                    .sort(([left], [right]) => left.localeCompare(right))
                    .map(([name]): SavedDirectoryFileItem => ({
                        itemType: 'file',
                        label: name,
                        description: directory,
                        uri: vscode.Uri.file(path.join(directory, name))
                    }));
            };

            let files = await buildFileItems(savedDirectory);
            const selected = await vscode.window.showQuickPick<SavedDirectoryFileItem | ChangeDirectoryItem>([
                {
                    itemType: 'changeDirectory',
                    label: '$(folder-library) Change Saved Directory...',
                    description: savedDirectory
                },
                ...files
            ], {
                placeHolder: 'Select a file from the saved import/export directory'
            });

            if (selected) {
                let selectedUri: vscode.Uri | undefined;

                if (selected.itemType === 'changeDirectory') {
                    const uris = await vscode.window.showOpenDialog({
                        canSelectFiles: false,
                        canSelectFolders: true,
                        canSelectMany: false,
                        openLabel: 'Select Saved Directory',
                        defaultUri: vscode.Uri.file(savedDirectory)
                    });

                    if (!uris || uris.length === 0) {
                        return;
                    }

                    await setImportExportDirectory(uris[0]);
                    savedDirectory = uris[0].fsPath;
                    files = await buildFileItems(savedDirectory);

                    if (files.length === 0) {
                        vscode.window.showInformationMessage(`No files found in ${savedDirectory}.`);
                        return;
                    }

                    const fileSelection = await vscode.window.showQuickPick<SavedDirectoryFileItem>(files, {
                        placeHolder: 'Select a file from the saved import/export directory'
                    });

                    if (!fileSelection) {
                        return;
                    }

                    selectedUri = fileSelection.uri;
                } else {
                    selectedUri = selected.uri;
                }

                if (!selectedUri) {
                    return;
                }

                const fileContent = await vscode.workspace.fs.readFile(selectedUri);
                const jsonString = Buffer.from(fileContent).toString('utf8');

                const action = await vscode.window.showQuickPick([
                    {
                        label: 'Replace All',
                        description: 'Replace all existing bookmarks with imported ones',
                        detail: 'This will delete your current bookmarks'
                    },
                    {
                        label: 'Merge',
                        description: 'Add imported bookmarks to existing ones',
                        detail: 'This will keep your current bookmarks and add the new ones'
                    }
                ], {
                    placeHolder: 'How would you like to import the bookmarks?'
                });

                if (action) {
                    if (action.label === 'Replace All') {
                        bookmarkHistory.importFromJson(jsonString);
                    } else {
                        bookmarkHistory.mergeFromJson(jsonString);
                    }

                    await saveImportExportDirectory(selectedUri);
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage('Failed to load files from the saved import/export directory.');
        }
    });
    
    // Draw diagram command
    let drawDiagramDisposable = vscode.commands.registerCommand('nav-extension.drawDiagram', async () => {
        const panel = vscode.window.createWebviewPanel(
            'bookmarkDiagram',
            'Bookmark Tree Diagram',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );
        
        panel.webview.html = getDiagramWebviewContent(bookmarkHistory.getHistory());
    });
    
    context.subscriptions.push(
        treeView,
        helloWorldDisposable,
        bookmarkWordDisposable,
        navigateToBookmarkDisposable,
        showHistoryDisposable,
        clearHistoryDisposable,
        removeBookmarkDisposable,
        focusBookmarkExplorerDisposable,
        moveBookmarkUpDisposable,
        moveBookmarkDownDisposable,
        expandAllDisposable,
        showBookmarkDetailsDisposable,
        exportBookmarksDisposable,
        importBookmarksDisposable,
        showSavedDirectoryFilesDisposable,
        drawDiagramDisposable
    );
}

export function deactivate() {}
