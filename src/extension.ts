import * as vscode from 'vscode';
import { BookmarkItem } from './types/bookmarkTypes';
import { BookmarkHistory, BookmarkTreeItem, BookmarkTreeDataProvider } from './class/bookmarkClasses';
import { getWebviewContent, getEmptyWebviewContent } from './utils/webviewUtils';
import { updateContextVariables, updateBookmarkDetailsPanel } from './utils/panelUtils';

let bookmarkHistory: BookmarkHistory;
let bookmarkTreeDataProvider: BookmarkTreeDataProvider;
let selectedParentBookmark: BookmarkItem | null = null;
let bookmarkDetailsPanel: vscode.WebviewPanel | undefined;

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
    
    // Update context variables when selection changes
    treeView.onDidChangeSelection((e) => {
        const selectedItem = e.selection.length > 0 ? e.selection[0] : null;
        updateContextVariables(bookmarkHistory, selectedItem);
        updateBookmarkDetailsPanel(bookmarkDetailsPanel, selectedItem, getWebviewContent);
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
    
    // Move bookmark up command
    let moveBookmarkUpDisposable = vscode.commands.registerCommand('nav-extension.moveBookmarkUp', (treeItem?: BookmarkTreeItem) => {
        // If no treeItem provided (keyboard shortcut), get current selection
        const targetItem = treeItem || (treeView.selection.length > 0 ? treeView.selection[0] : null);
        
        if (!targetItem) {
            vscode.window.showWarningMessage('No bookmark selected');
            return;
        }
        
        const success = bookmarkHistory.moveBookmarkUp(targetItem.bookmark);
        if (success) {
            vscode.window.showInformationMessage(`Moved "${targetItem.bookmark.text}" up`);
        } else {
            vscode.window.showInformationMessage(`"${targetItem.bookmark.text}" is already at the top`);
        }
    });
    
    // Move bookmark down command
    let moveBookmarkDownDisposable = vscode.commands.registerCommand('nav-extension.moveBookmarkDown', (treeItem?: BookmarkTreeItem) => {
        // If no treeItem provided (keyboard shortcut), get current selection
        const targetItem = treeItem || (treeView.selection.length > 0 ? treeView.selection[0] : null);
        
        if (!targetItem) {
            vscode.window.showWarningMessage('No bookmark selected');
            return;
        }
        
        const success = bookmarkHistory.moveBookmarkDown(targetItem.bookmark);
        if (success) {
            vscode.window.showInformationMessage(`Moved "${targetItem.bookmark.text}" down`);
        } else {
            vscode.window.showInformationMessage(`"${targetItem.bookmark.text}" is already at the bottom`);
        }
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
        
        vscode.window.showInformationMessage('Expanded all bookmarks');
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
        
        if (bookmarkDetailsPanel) {
            bookmarkDetailsPanel.reveal(vscode.ViewColumn.Two);
            // Update with the specific bookmark if provided
            if (selectedItem) {
                updateBookmarkDetailsPanel(bookmarkDetailsPanel, selectedItem, getWebviewContent);
            }
        } else {
            bookmarkDetailsPanel = vscode.window.createWebviewPanel(
                'bookmarkDetails',
                'Bookmark Details',
                {
                    viewColumn: vscode.ViewColumn.Two,
                    preserveFocus: true
                },
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            // Set initial content based on the specific item or current selection
            if (selectedItem) {
                bookmarkDetailsPanel.webview.html = getWebviewContent(selectedItem.bookmark);
            } else if (treeView.selection.length > 0) {
                updateBookmarkDetailsPanel(bookmarkDetailsPanel, treeView.selection[0], getWebviewContent);
            } else {
                bookmarkDetailsPanel.webview.html = getEmptyWebviewContent();
            }

            // Handle when panel is disposed
            bookmarkDetailsPanel.onDidDispose(() => {
                bookmarkDetailsPanel = undefined;
            }, null, context.subscriptions);

            // Handle messages from the webview
            bookmarkDetailsPanel.webview.onDidReceiveMessage(
                message => {
                    switch (message.command) {
                        case 'saveNotes':
                            const success = bookmarkHistory.updateBookmarkNotes(message.bookmarkKey, message.notes);
                            if (success) {
                                // Optionally show success message
                                vscode.window.showInformationMessage('Notes saved successfully');
                            } else {
                                vscode.window.showErrorMessage('Failed to save notes');
                            }
                            return;
                    }
                },
                undefined,
                context.subscriptions
            );
        }
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
                defaultUri: vscode.Uri.file(defaultFileName)
            });

            if (uri) {
                await vscode.workspace.fs.writeFile(uri, Buffer.from(jsonData, 'utf8'));
                vscode.window.showInformationMessage(`Bookmarks exported to ${uri.fsPath}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to export bookmarks: ${error}`);
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
                openLabel: 'Import Bookmarks'
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
                    let success = false;
                    if (action.label === 'Replace All') {
                        success = bookmarkHistory.importFromJson(jsonString);
                    } else {
                        success = bookmarkHistory.mergeFromJson(jsonString);
                    }

                    if (success) {
                        vscode.window.showInformationMessage(`Bookmarks ${action.label === 'Replace All' ? 'imported' : 'merged'} successfully from ${fileUri.fsPath}`);
                    } else {
                        vscode.window.showErrorMessage('Failed to import bookmarks. Please check the file format.');
                    }
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to import bookmarks: ${error}`);
        }
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
        setAsParentDisposable,
        addChildBookmarkDisposable,
        moveBookmarkUpDisposable,
        moveBookmarkDownDisposable,
        expandAllDisposable,
        showBookmarkDetailsDisposable,
        exportBookmarksDisposable,
        importBookmarksDisposable
    );
}

export function deactivate() {}