import * as vscode from 'vscode';
import { BookmarkItem } from '../types/bookmarkTypes';
import { getWebviewContent, getEmptyWebviewContent } from './webviewUtils';

export class BookmarkDetailsViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _currentBookmark?: BookmarkItem;

    constructor(private readonly extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };

        // Set initial content
        if (this._currentBookmark) {
            webviewView.webview.html = getWebviewContent(this._currentBookmark);
        } else {
            webviewView.webview.html = getEmptyWebviewContent();
        }

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'saveNotes':
                    // Emit event to let extension handle saving
                    this._onDidSaveNotes.fire({
                        bookmarkKey: message.bookmarkKey,
                        notes: message.notes
                    });
                    return;
            }
        });
    }

    private _onDidSaveNotes: vscode.EventEmitter<{bookmarkKey: string, notes: string}> = new vscode.EventEmitter();
    public readonly onDidSaveNotes: vscode.Event<{bookmarkKey: string, notes: string}> = this._onDidSaveNotes.event;

    public updateContent(bookmark: BookmarkItem) {
        this._currentBookmark = bookmark;
        if (this._view) {
            this._view.webview.html = getWebviewContent(bookmark);
        }
    }

    public clearContent() {
        this._currentBookmark = undefined;
        if (this._view) {
            this._view.webview.html = getEmptyWebviewContent();
        }
    }
}