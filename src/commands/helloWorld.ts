import * as vscode from 'vscode';

export function registerHelloWorld(): vscode.Disposable {
    return vscode.commands.registerCommand('db-extension.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from db-extension!');
    });
}
