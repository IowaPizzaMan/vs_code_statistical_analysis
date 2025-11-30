import * as vscode from 'vscode';

export class ModelConfigProvider implements vscode.TreeDataProvider<ConfigItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ConfigItem | undefined | null | void> =
        new vscode.EventEmitter<ConfigItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ConfigItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private xColumns: string[] = [];
    private yColumn: string | null = null;
    private dummyColumns: string[] = [];
    private baseCaseDummy: string | null = null;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ConfigItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ConfigItem): Promise<ConfigItem[]> {
        if (!element) {
            // Root items
            const items: ConfigItem[] = [];

            // Y Column section
            items.push(
                new ConfigItem(
                    'Y Column (Dependent)',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'ycol-header'
                )
            );

            // X Columns section
            items.push(
                new ConfigItem(
                    'X Columns (Independent)',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'xcol-header'
                )
            );

            // Dummy Variables section
            if (this.dummyColumns.length > 0) {
                items.push(
                    new ConfigItem(
                        'Dummy Variables',
                        vscode.TreeItemCollapsibleState.Collapsed,
                        'dummy-header'
                    )
                );
            }

            return items;
        }

        // Children based on parent type
        if (element.contextValue === 'ycol-header') {
            return this.yColumn
                ? [
                    new ConfigItem(
                        this.yColumn,
                        vscode.TreeItemCollapsibleState.None,
                        'ycol-item',
                        this.yColumn
                    )
                ]
                : [
                    new ConfigItem(
                        'No Y column selected',
                        vscode.TreeItemCollapsibleState.None,
                        'ycol-empty'
                    )
                ];
        }

        if (element.contextValue === 'xcol-header') {
            return this.xColumns.length > 0
                ? this.xColumns.map(
                    col =>
                        new ConfigItem(
                            col,
                            vscode.TreeItemCollapsibleState.None,
                            'xcol-item',
                            col
                        )
                )
                : [
                    new ConfigItem(
                        'No X columns selected',
                        vscode.TreeItemCollapsibleState.None,
                        'xcol-empty'
                    )
                ];
        }

        if (element.contextValue === 'dummy-header') {
            return this.dummyColumns.map(
                col =>
                    new ConfigItem(
                        col,
                        vscode.TreeItemCollapsibleState.None,
                        'dummy-item',
                        col,
                        col === this.baseCaseDummy
                    )
            );
        }

        return [];
    }

    setXColumns(columns: string[]): void {
        this.xColumns = columns;
        this.refresh();
    }

    setYColumn(column: string | null): void {
        this.yColumn = column;
        this.refresh();
    }

    setDummyColumns(columns: string[]): void {
        this.dummyColumns = columns;
        this.refresh();
    }

    getXColumns(): string[] {
        return this.xColumns;
    }

    getYColumn(): string | null {
        return this.yColumn;
    }

    getDummyColumns(): string[] {
        return this.dummyColumns;
    }

    removeXColumn(column: string): void {
        this.xColumns = this.xColumns.filter(col => col !== column);
        this.refresh();
    }

    removeYColumn(): void {
        this.yColumn = null;
        this.refresh();
    }

    removeDummyColumn(column: string): void {
        this.dummyColumns = this.dummyColumns.filter(col => col !== column);
        // If removed column was base case, clear it
        if (this.baseCaseDummy === column) {
            this.baseCaseDummy = null;
        }
        this.refresh();
    }

    setBaseCaseDummy(column: string | null): void {
        this.baseCaseDummy = column;
        this.refresh();
    }

    getBaseCaseDummy(): string | null {
        return this.baseCaseDummy;
    }
}

export class ConfigItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly columnName?: string,
        public readonly isBaseCaseItem?: boolean
    ) {
        let displayLabel = label;
        // Add star icon if this is the base case
        if (isBaseCaseItem) {
            displayLabel = `★ ${label} (base case)`;
        }
        super(displayLabel, collapsibleState);
        this.tooltip = label;

        // Add icons based on type
        if (contextValue === 'ycol-item') {
            this.iconPath = new vscode.ThemeIcon('symbol-variable');
        } else if (contextValue === 'xcol-item') {
            this.iconPath = new vscode.ThemeIcon('symbol-number');
        } else if (contextValue === 'dummy-item') {
            this.iconPath = new vscode.ThemeIcon('symbol-boolean');
        }
    }
}
