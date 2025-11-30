import * as vscode from 'vscode';
import { LinearRegressionProvider } from '../providers/linearRegressionProvider';
import { RegressionResultsPanel } from '../providers/regressionResultsPanel';
import { performLinearRegression } from '../utils/regressionUtils';
import { detectCategoricalColumns, createDummyVariables } from '../utils/dummyVariableUtils';
import { RegressionHistoryService } from '../services/regressionHistoryService';
import { ModelConfigProvider } from '../providers/modelConfigProvider';
import { HistoryProvider } from '../providers/historyProvider';

export function registerLinearRegression(
    provider: LinearRegressionProvider,
    extensionUri: vscode.Uri,
    historyService: RegressionHistoryService,
    modelConfigProvider: ModelConfigProvider,
    historyProvider: HistoryProvider
): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];

    // Command to select a CSV file
    disposables.push(
        vscode.commands.registerCommand('db-extension.selectCsvFile', async (filePath: string) => {
            provider.clearSelectedXColumns();
            provider.setSelectedYColumn(null);
            modelConfigProvider.setXColumns([]);
            modelConfigProvider.setYColumn(null);
            modelConfigProvider.setDummyColumns([]);
            vscode.window.showInformationMessage(`Selected CSV: ${filePath}`);
            provider.refresh();
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

    return disposables;
}

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
