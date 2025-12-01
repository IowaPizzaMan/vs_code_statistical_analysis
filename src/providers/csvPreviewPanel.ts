import * as vscode from 'vscode';
import * as fs from 'fs';

export class CsvPreviewPanel {
    public static currentPanel: CsvPreviewPanel | null = null;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    public static createOrShow(extensionUri: vscode.Uri, filePath?: string | null, provider?: any) {
        const column = vscode.ViewColumn.Beside;

        // If we already have a panel, reveal
        if (CsvPreviewPanel.currentPanel) {
            CsvPreviewPanel.currentPanel._update(filePath, provider);
            CsvPreviewPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'csvPreview',
            'CSV Preview (with Dummies)',
            column,
            {
                enableScripts: true
            }
        );

        CsvPreviewPanel.currentPanel = new CsvPreviewPanel(panel, extensionUri);
        CsvPreviewPanel.currentPanel._update(filePath, provider);
    }

    public static refresh(filePath?: string | null, provider?: any) {
        if (CsvPreviewPanel.currentPanel) {
            CsvPreviewPanel.currentPanel._update(filePath, provider);
        }
    }

    public dispose() {
        CsvPreviewPanel.currentPanel = null;
        this._panel.dispose();
        while (this._disposables.length) {
            const d = this._disposables.pop();
            if (d) d.dispose();
        }
    }

    private _update(filePath?: string | null, provider?: any) {
        if (!filePath) {
            this._panel.webview.html = `<p>No CSV selected</p>`;
            return;
        }

        let html = '<h3>CSV Preview</h3>';
        try {
            const data = fs.readFileSync(filePath, 'utf-8');
            const parseCSV = require('../utils/csvUtils').parseCSV;
            const rows: string[][] = parseCSV(data);
            if (rows.length === 0) {
                this._panel.webview.html = '<p>Empty CSV</p>';
                return;
            }

            const headers = rows[0];

            // If provider has dummy variables, create additional header columns
            const dummyCols: string[] = [];
            if (provider) {
                for (const col of provider.getColumns()) {
                    const dmap = provider.getDummyVariables(col);
                    const dnames = Object.keys(dmap);
                    for (const dn of dnames) dummyCols.push(dn);
                }
            }

            html += '<table border="1" cellpadding="4" style="border-collapse:collapse">';
            html += '<thead><tr>';
            for (const h of headers) html += `<th>${escapeHtml(h)}</th>`;
            for (const dh of dummyCols) html += `<th>${escapeHtml(dh)}</th>`;
            html += '</tr></thead>';

            html += '<tbody>';
            for (let i = 1; i < rows.length; i++) {
                const r = rows[i];
                html += '<tr>';
                for (const c of r) html += `<td>${escapeHtml(c)}</td>`;
                // append dummy values if available
                if (provider) {
                    for (const col of provider.getColumns()) {
                        const dmap = provider.getDummyVariables(col);
                        const dnames = Object.keys(dmap);
                        for (const dn of dnames) {
                            const arr = dmap[dn] || [];
                            const val = arr[i - 1] !== undefined ? arr[i - 1] : '';
                            html += `<td>${escapeHtml(String(val))}</td>`;
                        }
                    }
                }
                html += '</tr>';
            }
            html += '</tbody></table>';
        } catch (e) {
            html += `<p>Error loading CSV: ${escapeHtml(String(e))}</p>`;
        }

        this._panel.webview.html = html;
    }
}

function escapeHtml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
