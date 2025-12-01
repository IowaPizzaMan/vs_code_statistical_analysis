import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class LinearRegressionProvider implements vscode.TreeDataProvider<LinearRegressionItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<LinearRegressionItem | undefined | null | void> =
        new vscode.EventEmitter<LinearRegressionItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<LinearRegressionItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private csvFiles: string[] = [];
    private selectedFile: string | null = null;
    private columns: string[] = [];
    private selectedXColumns: string[] = [];
    private selectedYColumn: string | null = null;
    private dummyVariables: Map<string, { [key: string]: number[] }> = new Map();

    constructor(private workspaceRoot: string | undefined) {
        this.refresh();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: LinearRegressionItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: LinearRegressionItem): Promise<LinearRegressionItem[]> {
        if (!this.workspaceRoot) {
            return [];
        }

        // Root level: show CSV files
        if (!element) {
            try {
                this.csvFiles = await this.findCsvFiles(this.workspaceRoot);
                return this.csvFiles.map(
                    file =>
                        new LinearRegressionItem(
                            path.basename(file),
                            vscode.TreeItemCollapsibleState.Collapsed,
                            { command: 'db-extension.selectCsvFile', arguments: [file], title: 'Select CSV' },
                            file
                        )
                );
            } catch (err) {
                vscode.window.showErrorMessage('Failed to find CSV files: ' + String(err));
                return [];
            }
        }

        // If element is a CSV file, show its columns
        if (element.filePath && element.label !== 'Columns') {
            try {
                const columns = await this.parseCSVColumns(element.filePath);
                this.selectedFile = element.filePath;
                this.columns = columns;
                return columns.map(
                    col =>
                        new LinearRegressionItem(
                            col,
                            vscode.TreeItemCollapsibleState.None,
                            {
                                command: 'db-extension.selectColumn',
                                arguments: [element.filePath, col],
                                title: 'Select Column'
                            },
                            element.filePath,
                            'column'
                        )
                );
            } catch (err) {
                vscode.window.showErrorMessage('Failed to parse CSV: ' + String(err));
                return [];
            }
        }

        return [];
    }

    private async findCsvFiles(dir: string): Promise<string[]> {
        let csvFiles: string[] = [];
        try {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory() && !file.startsWith('.')) {
                    csvFiles = csvFiles.concat(await this.findCsvFiles(fullPath));
                } else if (file.endsWith('.csv')) {
                    csvFiles.push(fullPath);
                }
            }
        } catch (err) {
            console.error('Error reading directory:', err);
        }
        return csvFiles;
    }

    private async parseCSVColumns(filePath: string): Promise<string[]> {
        return new Promise((resolve, reject) => {
            fs.readFile(filePath, 'utf-8', (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }
                try {
                    // use csvUtils to properly parse quoted headers
                    const { getHeadersFromCSV } = require('../utils/csvUtils');
                    const headers: string[] = getHeadersFromCSV(data);
                    resolve(headers);
                } catch (e) {
                    reject(e);
                }
            });
        });
    }

    getSelectedFile(): string | null {
        return this.selectedFile;
    }

    getColumns(): string[] {
        return this.columns;
    }

    getSelectedXColumns(): string[] {
        return this.selectedXColumns;
    }

    getSelectedYColumn(): string | null {
        return this.selectedYColumn;
    }


    addSelectedXColumn(column: string): void {
        if (!this.selectedXColumns.includes(column)) {
            this.selectedXColumns.push(column);
        }
    }

    removeSelectedXColumn(column: string): void {
        this.selectedXColumns = this.selectedXColumns.filter(c => c !== column);
    }

    clearSelectedXColumns(): void {
        this.selectedXColumns = [];
    }

    clearSelectedFile(): void {
        this.selectedFile = null;
        this.columns = [];
    }

    setSelectedYColumn(column: string | null): void {
        this.selectedYColumn = column;
    }

    getDummyVariables(column: string): { [key: string]: number[] } {
        return this.dummyVariables.get(column) || {};
    }

    setDummyVariables(column: string, dummies: { [key: string]: number[] }): void {
        this.dummyVariables.set(column, dummies);
    }

    clearDummyVariables(): void {
        this.dummyVariables.clear();
    }
}

export class LinearRegressionItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command,
        public readonly filePath?: string,
        public readonly contextValue?: string
    ) {
        super(label, collapsibleState);
        this.tooltip = label;
    }
}

