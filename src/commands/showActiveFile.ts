import * as vscode from 'vscode';

export function registerShowActiveFile(): vscode.Disposable {
    return vscode.commands.registerCommand('db-extension.showActiveFile', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('No active editor open.');
            return;
        }

        try {
            // Read text from the active editor
            const text = editor.document.getText();
            const fileName = editor.document.fileName;

            // Show a message with file info
            vscode.window.showInformationMessage(
                `Active file: ${fileName} (${text.length} characters)`
            );

            // Open the file contents in a new untitled editor for review
            const doc = await vscode.workspace.openTextDocument({
                content: text,
                language: editor.document.languageId
            });
            await vscode.window.showTextDocument(doc, { preview: false });

        } catch (err) {
            vscode.window.showErrorMessage('Failed to read active file: ' + String(err));
        }
    });
}
