import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('Navigation extension is now active!');
    
    let disposable = vscode.commands.registerCommand('nav-extension.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from Navigation Extension???!');
    });
    
    context.subscriptions.push(disposable);
}

export function deactivate() {}