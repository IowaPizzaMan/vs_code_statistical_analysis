export interface RegressionHistoryEntry {
    id: string;
    timestamp: Date;
    xColumns: string[];
    yColumn: string;
    rSquared: number;
    adjustedRSquared: number;
    intercept: number;
    slopes: { [key: string]: number };
    predictions: number[];
}

export class RegressionHistoryService {
    private history: RegressionHistoryEntry[] = [];
    private static readonly MAX_HISTORY = 50;

    addEntry(
        xColumns: string[],
        yColumn: string,
        rSquared: number,
        adjustedRSquared: number,
        intercept: number,
        slopes: { [key: string]: number },
        predictions: number[]
    ): RegressionHistoryEntry {
        const entry: RegressionHistoryEntry = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            timestamp: new Date(),
            xColumns,
            yColumn,
            rSquared,
            adjustedRSquared,
            intercept,
            slopes,
            predictions
        };

        this.history.unshift(entry);

        // Keep only the last MAX_HISTORY entries
        if (this.history.length > RegressionHistoryService.MAX_HISTORY) {
            this.history = this.history.slice(0, RegressionHistoryService.MAX_HISTORY);
        }

        return entry;
    }

    getHistory(): RegressionHistoryEntry[] {
        return this.history;
    }

    getEntryById(id: string): RegressionHistoryEntry | undefined {
        return this.history.find(entry => entry.id === id);
    }

    clearHistory(): void {
        this.history = [];
    }

    getLastEntry(): RegressionHistoryEntry | undefined {
        return this.history[0];
    }
}
