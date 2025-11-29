import * as vscode from 'vscode';
import { RegressionHistoryEntry, RegressionHistoryService } from '../services/regressionHistoryService';

export class HistoryProvider implements vscode.TreeDataProvider<HistoryItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<HistoryItem | undefined | null | void> =
        new vscode.EventEmitter<HistoryItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<HistoryItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    constructor(private historyService: RegressionHistoryService) { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: HistoryItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: HistoryItem): Promise<HistoryItem[]> {
        if (!element) {
            // Root: show history entries
            const history = this.historyService.getHistory();
            return history.map(
                entry =>
                    new HistoryItem(
                        `[R² ${entry.rSquared.toFixed(4)}] ${entry.timestamp.toLocaleTimeString()}`,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        'history-entry',
                        entry.id,
                        entry
                    )
            );
        }

        // Show entry details when expanded
        if (element.contextValue === 'history-entry' && element.entry) {
            const entry = element.entry;
            const items: HistoryItem[] = [];

            items.push(
                new HistoryItem(
                    `Y: ${entry.yColumn}`,
                    vscode.TreeItemCollapsibleState.None,
                    'history-detail'
                )
            );

            items.push(
                new HistoryItem(
                    `X: ${entry.xColumns.join(', ')}`,
                    vscode.TreeItemCollapsibleState.None,
                    'history-detail'
                )
            );

            items.push(
                new HistoryItem(
                    `R² = ${entry.rSquared.toFixed(6)}`,
                    vscode.TreeItemCollapsibleState.None,
                    'history-detail'
                )
            );

            items.push(
                new HistoryItem(
                    `Adj. R² = ${entry.adjustedRSquared.toFixed(6)}`,
                    vscode.TreeItemCollapsibleState.None,
                    'history-detail'
                )
            );

            items.push(
                new HistoryItem(
                    `Time: ${entry.timestamp.toLocaleString()}`,
                    vscode.TreeItemCollapsibleState.None,
                    'history-detail'
                )
            );

            items.push(
                new HistoryItem(
                    'Restore Model',
                    vscode.TreeItemCollapsibleState.None,
                    'history-restore',
                    entry.id,
                    entry
                )
            );

            return items;
        }

        return [];
    }

    getEntryById(id: string): RegressionHistoryEntry | undefined {
        return this.historyService.getEntryById(id);
    }
}

export class HistoryItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly entryId?: string,
        public readonly entry?: RegressionHistoryEntry
    ) {
        super(label, collapsibleState);
        this.tooltip = label;

        if (contextValue === 'history-restore') {
            this.command = {
                command: 'db-extension.restoreModel',
                title: 'Restore Model',
                arguments: [entryId]
            };
            this.iconPath = new vscode.ThemeIcon('debug-restart');
        } else if (contextValue === 'history-entry') {
            this.iconPath = new vscode.ThemeIcon('history');
        }
    }
}
