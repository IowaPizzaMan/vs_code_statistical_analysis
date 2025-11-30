import * as vscode from 'vscode';
import { LinearRegressionProvider } from '../providers/linearRegressionProvider';
import { RegressionResultsPanel } from '../providers/regressionResultsPanel';
import { performLinearRegression } from '../utils/regressionUtils';
import { detectCategoricalColumns, createDummyVariables } from '../utils/dummyVariableUtils';
import { RegressionHistoryService } from '../services/regressionHistoryService';
import { ModelConfigProvider } from '../providers/modelConfigProvider';
import { HistoryProvider } from '../providers/historyProvider';
import { CsvPreviewPanel } from '../providers/csvPreviewPanel';

export function registerLinearRegression(
    provider: LinearRegressionProvider,
    extensionUri: vscode.Uri,
    historyService: RegressionHistoryService,
    modelConfigProvider: ModelConfigProvider,
    historyProvider: HistoryProvider
): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];

    // Decoration types to reuse for highlighting
    const headerDecorationType = vscode.window.createTextEditorDecorationType({});
    const cellDecorationType = vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(135,206,250,0.12)' });

    // Command to select a CSV file (also open it in the editor)
    disposables.push(
        vscode.commands.registerCommand('db-extension.selectCsvFile', async (filePath: string) => {
            provider.clearSelectedXColumns();
            provider.setSelectedYColumn(null);
            modelConfigProvider.setXColumns([]);
            modelConfigProvider.setYColumn(null);
            modelConfigProvider.setDummyColumns([]);

            // Try to open the CSV in an editor so the user can see the file
            try {
                const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
                await vscode.window.showTextDocument(doc, { preview: true });
            } catch (err) {
                console.warn('Could not open CSV file in editor:', err);
            }

            vscode.window.showInformationMessage(`Selected CSV: ${filePath}`);
            provider.refresh();
            // Refresh decorations in case we have dummies for this file
            try {
                await vscode.commands.executeCommand('db-extension.refreshCsvEditorDecorations');
            } catch (e) {
                // ignore
            }
        })
    );

    // Command to select X or Y column
    disposables.push(
        vscode.commands.registerCommand(
            'db-extension.selectColumn',
            async (filePath: string, column: string) => {
                const file = provider.getSelectedFile();
                if (!file) {
                    vscode.window.showErrorMessage('No CSV file selected.');
                    return;
                }

                // Open the file and highlight the entire column cells to the user
                try {
                    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
                    const editor = await vscode.window.showTextDocument(doc, { preview: true });

                    // Determine column index by splitting header
                    const header = doc.lineAt(0).text;
                    const headers = header.split(',').map(h => h.trim());
                    const colIdx = headers.indexOf(column);

                    if (colIdx >= 0) {
                        // Build selections for each data row for the target column
                        const selections: vscode.Selection[] = [];
                        const cellRanges: vscode.Range[] = [];
                        for (let line = 1; line < doc.lineCount; line++) {
                            const lineText = doc.lineAt(line).text;
                            if (!lineText) continue;
                            const parts = lineText.split(',');
                            if (colIdx >= parts.length) continue;
                            // compute start index of this column in the line
                            let start = 0;
                            for (let k = 0; k < colIdx; k++) {
                                start += parts[k].length + 1; // include comma
                            }
                            const cellText = parts[colIdx];
                            const end = start + cellText.length;
                            const range = new vscode.Range(line, start, line, end);
                            selections.push(new vscode.Selection(range.start, range.end));
                            cellRanges.push(range);
                        }

                        if (selections.length > 0) {
                            editor.selections = selections;
                            editor.revealRange(cellRanges[0], vscode.TextEditorRevealType.InCenter);

                            // Also apply a subtle background decoration to all cells in this column
                            editor.setDecorations(cellDecorationType, cellRanges);
                        }
                    }
                } catch (err) {
                    console.warn('Could not open CSV file in editor for column reveal:', err);
                }

                const columnType = await vscode.window.showQuickPick(
                    ['X (Independent)', 'Y (Dependent)', 'Create Dummy Variables'],
                    {
                        placeHolder: `Select action for column "${column}"`,
                        canPickMany: false
                    }
                );

                if (!columnType) {
                    return;
                }

                if (columnType === 'X (Independent)') {
                    provider.addSelectedXColumn(column);
                    modelConfigProvider.setXColumns(provider.getSelectedXColumns());
                    vscode.window.showInformationMessage(`Added X column: ${column}`);
                } else if (columnType === 'Y (Dependent)') {
                    provider.setSelectedYColumn(column);
                    modelConfigProvider.setYColumn(column);
                    vscode.window.showInformationMessage(`Y column set to: ${column}`);
                } else if (columnType === 'Create Dummy Variables') {
                    try {
                        const dummies = await createDummyVariables(file, column, true);
                        const dummyNames = Object.keys(dummies);

                        // Add all dummy variables as X columns
                        dummyNames.forEach(name => provider.addSelectedXColumn(name));
                        provider.setDummyVariables(column, dummies as any);

                        // Update config display with dummy variables
                        const allXCols = provider.getSelectedXColumns();
                        modelConfigProvider.setXColumns(allXCols);

                        modelConfigProvider.setDummyColumns(
                            allXCols.filter(col => col.includes('_') && !provider.getColumns().includes(col))
                        );

                        // Refresh editor decorations so the user sees the created dummies
                        try {
                            await vscode.commands.executeCommand('db-extension.refreshCsvEditorDecorations');
                        } catch (e) {
                            // ignore
                        }

                        vscode.window.showInformationMessage(
                            `Created ${dummyNames.length} dummy variables from "${column}"`
                        );
                    } catch (err) {
                        vscode.window.showErrorMessage('Error creating dummy variables: ' + String(err));
                    }
                }
            }
        )
    );

    // Command to run linear regression
    disposables.push(
        vscode.commands.registerCommand('db-extension.runLinearRegression', async () => {
            await runRegressionLogic(provider, extensionUri, historyService, modelConfigProvider, historyProvider);
        })
    );

    // Command to show the CSV preview webview
    disposables.push(
        vscode.commands.registerCommand('db-extension.showCsvPreview', async () => {
            const file = provider.getSelectedFile();
            if (!file) {
                vscode.window.showErrorMessage('No CSV file selected for preview.');
                return;
            }
            CsvPreviewPanel.createOrShow(extensionUri, file, provider);
        })
    );

    // Command to refresh preview
    disposables.push(
        vscode.commands.registerCommand('db-extension.refreshCsvPreview', async () => {
            const file = provider.getSelectedFile();
            CsvPreviewPanel.refresh(file, provider);
        })
    );

    // Command to restore a previous model
    disposables.push(
        vscode.commands.registerCommand('db-extension.restoreModel', async (entryId: string) => {
            const entry = historyProvider.getEntryById(entryId);
            if (!entry) {
                vscode.window.showErrorMessage('Model not found in history.');
                return;
            }

            // Restore the model configuration
            provider.clearSelectedXColumns();
            entry.xColumns.forEach(col => provider.addSelectedXColumn(col));
            provider.setSelectedYColumn(entry.yColumn);

            // Update the model config display
            modelConfigProvider.setXColumns(entry.xColumns);
            modelConfigProvider.setYColumn(entry.yColumn);

            // Show the results
            RegressionResultsPanel.createOrShow(extensionUri);
            if (RegressionResultsPanel.currentPanel) {
                const results = {
                    slopes: entry.slopes,
                    intercept: entry.intercept,
                    rSquared: entry.rSquared,
                    adjustedRSquared: entry.adjustedRSquared,
                    predictions: entry.predictions,
                    xColumns: entry.xColumns
                };
                RegressionResultsPanel.currentPanel.showResults(entry.xColumns, entry.yColumn, results);
            }

            vscode.window.showInformationMessage('Model restored from history!');
        })
    );

    // Command to clear CSV file selection (clears all sections)
    disposables.push(
        vscode.commands.registerCommand('db-extension.clearCsvFile', async () => {
            provider.clearSelectedFile();
            provider.clearSelectedXColumns();
            provider.setSelectedYColumn(null);
            provider.clearDummyVariables();
            modelConfigProvider.setXColumns([]);
            modelConfigProvider.setYColumn(null);
            modelConfigProvider.setDummyColumns([]);
            vscode.window.showInformationMessage('Cleared CSV file and all configuration.');
            provider.refresh();
        })
    );

    // Command to clear X columns only
    disposables.push(
        vscode.commands.registerCommand('db-extension.clearXColumns', async () => {
            provider.clearSelectedXColumns();
            modelConfigProvider.setXColumns([]);
            modelConfigProvider.setDummyColumns([]);
            vscode.window.showInformationMessage('Cleared X columns.');
            provider.refresh();
        })
    );

    // Command to clear Y column only
    disposables.push(
        vscode.commands.registerCommand('db-extension.clearYColumn', async () => {
            provider.setSelectedYColumn(null);
            modelConfigProvider.setYColumn(null);
            vscode.window.showInformationMessage('Cleared Y column.');
            provider.refresh();
        })
    );

    // Command to clear dummy variables only
    disposables.push(
        vscode.commands.registerCommand('db-extension.clearDummyVariables', async () => {
            provider.clearDummyVariables();
            provider.clearSelectedXColumns();
            modelConfigProvider.setXColumns([]);
            modelConfigProvider.setDummyColumns([]);
            vscode.window.showInformationMessage('Cleared dummy variables.');
            provider.refresh();
        })
    );

    // Command to refresh CSV editor decorations so the open editor reflects created/removed dummies
    disposables.push(
        vscode.commands.registerCommand('db-extension.refreshCsvEditorDecorations', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            const doc = editor.document;
            const docPath = doc.uri.fsPath;
            const selectedFile = provider.getSelectedFile();
            if (!selectedFile || selectedFile !== docPath) return;

            // Clear previous decorations
            editor.setDecorations(headerDecorationType, []);
            editor.setDecorations(cellDecorationType, []);

            const headerText = doc.lineAt(0).text;
            const headers = headerText.split(',').map(h => h.trim());

            const headerOptions: vscode.DecorationOptions[] = [];
            const allCellRanges: vscode.Range[] = [];

            for (const col of provider.getColumns()) {
                const dmap = provider.getDummyVariables(col);
                const dummyNames = Object.keys(dmap);
                if (dummyNames.length === 0) continue;

                const colIdx = headers.indexOf(col);
                if (colIdx < 0) continue;

                const ranges = buildColumnRangesForDocument(doc, colIdx);
                if (ranges.length === 0) continue;

                const headerRange = ranges[0];
                const cellRanges = ranges.slice(1);

                headerOptions.push({
                    range: headerRange,
                    hoverMessage: `Dummy variables for ${col}: ${dummyNames.join(', ')}`,
                    renderOptions: {
                        after: {
                            contentText: `  Dummies: ${dummyNames.join(', ')}`,
                            color: 'gray',
                            fontStyle: 'italic'
                        }
                    }
                });

                allCellRanges.push(...cellRanges);
            }

            if (headerOptions.length > 0) {
                editor.setDecorations(headerDecorationType, headerOptions as any);
            }
            if (allCellRanges.length > 0) {
                editor.setDecorations(cellDecorationType, allCellRanges);
            }
        })
    );

    return disposables;
}

// Helper: build ranges for a given column index in a TextDocument
function buildColumnRangesForDocument(doc: vscode.TextDocument, colIdx: number): vscode.Range[] {
    const ranges: vscode.Range[] = [];
    if (colIdx < 0) return ranges;
    for (let line = 0; line < doc.lineCount; line++) {
        const lineText = doc.lineAt(line).text;
        if (line === 0) {
            // header
            const parts = lineText.split(',');
            if (colIdx >= parts.length) continue;
            let start = 0;
            for (let k = 0; k < colIdx; k++) start += parts[k].length + 1;
            const end = start + parts[colIdx].length;
            ranges.push(new vscode.Range(0, start, 0, end));
            continue;
        }

        if (!lineText) continue;
        const parts = lineText.split(',');
        if (colIdx >= parts.length) continue;
        let start = 0;
        for (let k = 0; k < colIdx; k++) start += parts[k].length + 1;
        const end = start + parts[colIdx].length;
        ranges.push(new vscode.Range(line, start, line, end));
    }
    return ranges;
}

// Command to refresh editor decorations based on current provider/model config
// registered via a closure above; we need access to provider and modelConfigProvider
// We'll register this command inside the function to capture the closures.

async function runRegressionLogic(
    provider: LinearRegressionProvider,
    extensionUri: vscode.Uri,
    historyService: RegressionHistoryService,
    modelConfigProvider: ModelConfigProvider,
    historyProvider: HistoryProvider
) {
    const file = provider.getSelectedFile();
    const xColumns = provider.getSelectedXColumns();
    const yColumn = provider.getSelectedYColumn();

    console.log('=== REGRESSION COMMAND EXECUTION ===');
    console.log('File:', file);
    console.log('X Columns:', xColumns);
    console.log('Y Column:', yColumn);

    if (!file) {
        vscode.window.showErrorMessage('No CSV file selected. Please select a file first.');
        return;
    }

    if (!xColumns || xColumns.length === 0) {
        vscode.window.showErrorMessage('Please select at least one X column before running regression.');
        return;
    }

    if (!yColumn) {
        vscode.window.showErrorMessage('Please select a Y column before running regression.');
        return;
    }

    try {
        vscode.window.showInformationMessage('Running linear regression with ' + xColumns.length + ' predictor(s)...');

        // Build dummy variables object (if any were created)
        const dummyVariablesData: { [columnName: string]: { [key: string]: number[] } } = {};
        for (const col of provider.getColumns()) {
            const dummies = provider.getDummyVariables(col);
            if (Object.keys(dummies).length > 0) {
                dummyVariablesData[col] = dummies;
            }
        }
        console.log('Dummy variables data:', dummyVariablesData);

        const results = await performLinearRegression(file, xColumns, yColumn, dummyVariablesData);
        console.log('Results from performLinearRegression:', results);

        // Record in history
        historyService.addEntry(
            xColumns,
            yColumn,
            results.rSquared,
            results.adjustedRSquared,
            results.intercept,
            results.slopes,
            results.predictions
        );

        // Update config display
        modelConfigProvider.setXColumns(xColumns);
        modelConfigProvider.setYColumn(yColumn);
        modelConfigProvider.setDummyColumns(
            xColumns.filter(col => col.includes('_') && !provider.getColumns().includes(col))
        );

        // Refresh history provider
        historyProvider.refresh();

        // Create or show the results panel
        RegressionResultsPanel.createOrShow(extensionUri);
        if (RegressionResultsPanel.currentPanel) {
            console.log('About to show results with:', { xColumns, yColumn, results });
            RegressionResultsPanel.currentPanel.showResults(xColumns, yColumn, results);
        }

        vscode.window.showInformationMessage('Regression complete! Check the results panel.');
    } catch (err) {
        vscode.window.showErrorMessage('Error running regression: ' + String(err));
        console.error(err);
    }
}
