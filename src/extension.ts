// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { registerHelloWorld } from './commands/helloWorld';
import { registerShowActiveFile } from './commands/showActiveFile';
import { registerLinearRegression } from './commands/linearRegression';
import { LinearRegressionProvider } from './providers/linearRegressionProvider';
import { ModelConfigProvider } from './providers/modelConfigProvider';
import { HistoryProvider } from './providers/historyProvider';
import { RegressionHistoryService } from './services/regressionHistoryService';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('=== DB Extension Activation Started ===');
	console.log('Congratulations, your extension "db-extension" is now active!');

	// Register the Hello World command from the commands module
	console.log('Registering Hello World command...');
	const helloDisposable = registerHelloWorld();
	context.subscriptions.push(helloDisposable);

	// Register the Show Active File command from the commands module
	console.log('Registering Show Active File command...');
	const showFileDisposable = registerShowActiveFile();
	context.subscriptions.push(showFileDisposable);

	// Initialize regression history and model config services
	console.log('Initializing services and providers...');
	const historyService = new RegressionHistoryService();
	const modelConfigProvider = new ModelConfigProvider();
	const historyProvider = new HistoryProvider(historyService);
	console.log('Services initialized successfully');

	// Set up Linear Regression Tree View
	const workspaceRoot =
		vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
			? vscode.workspace.workspaceFolders[0].uri.fsPath
			: undefined;
	const linearRegressionProvider = new LinearRegressionProvider(workspaceRoot);

	console.log('Creating tree views...');
	const csvFileTreeView = vscode.window.createTreeView('csvFileExplorer', {
		treeDataProvider: linearRegressionProvider
	});
	context.subscriptions.push(csvFileTreeView);
	console.log('CSV File Explorer tree view created');

	// Set up Model Configuration Tree View
	const modelConfigTreeView = vscode.window.createTreeView('modelConfig', {
		treeDataProvider: modelConfigProvider
	});
	context.subscriptions.push(modelConfigTreeView);
	console.log('Model Config tree view created');

	// Set up Regression History Tree View
	const historyTreeView = vscode.window.createTreeView('regressionHistory', {
		treeDataProvider: historyProvider
	});
	context.subscriptions.push(historyTreeView);
	console.log('Regression History tree view created');

	// Register Linear Regression commands
	console.log('Registering Linear Regression commands...');
	const linearRegressionDisposables = registerLinearRegression(
		linearRegressionProvider,
		context.extensionUri,
		historyService,
		modelConfigProvider,
		historyProvider
	);
	linearRegressionDisposables.forEach(d => context.subscriptions.push(d));
	console.log(`Registered ${linearRegressionDisposables.length} Linear Regression commands`);

	// Register model config remove commands
	console.log('Registering model config commands...');
	context.subscriptions.push(
		vscode.commands.registerCommand('db-extension.removeXColumn', (item: any) => {
			const columnName = item.columnName || item.label;
			linearRegressionProvider.removeSelectedXColumn(columnName);
			modelConfigProvider.removeXColumn(columnName);
			vscode.window.showInformationMessage(`Removed X column: ${columnName}`);
		})
	);
	console.log('Registered removeXColumn command');

	context.subscriptions.push(
		vscode.commands.registerCommand('db-extension.removeYColumn', () => {
			linearRegressionProvider.setSelectedYColumn(null);
			modelConfigProvider.removeYColumn();
			vscode.window.showInformationMessage('Removed Y column');
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('db-extension.removeDummyColumn', async (item: any) => {
			const columnName = item.columnName || item.label;
			// Remove from selected X columns
			linearRegressionProvider.removeSelectedXColumn(columnName);
			modelConfigProvider.removeDummyColumn(columnName);
			vscode.window.showInformationMessage(`Removed dummy column: ${columnName}`);

			// Refresh decorations in the active CSV editor to reflect removal
			try {
				await vscode.commands.executeCommand('db-extension.refreshCsvEditorDecorations');
			} catch (e) {
				// ignore
			}
		})
	);

	// Command to open a column from the Model Config view
	context.subscriptions.push(
		vscode.commands.registerCommand('db-extension.openColumnFromModelConfig', async (columnName: string) => {
			const file = linearRegressionProvider.getSelectedFile();
			if (!file) {
				vscode.window.showErrorMessage('No CSV selected. Select a CSV in the CSV explorer first.');
				return;
			}
			// Reuse existing selectColumn flow to open and reveal
			await vscode.commands.executeCommand('db-extension.selectColumn', file, columnName);
		})
	);

	// Command to show preview panel (registered here so it's available globally)
	context.subscriptions.push(
		vscode.commands.registerCommand('db-extension.showCsvPreview', async () => {
			const file = linearRegressionProvider.getSelectedFile();
			if (!file) {
				vscode.window.showErrorMessage('No CSV selected.');
				return;
			}
			const CsvPreviewPanel = require('./providers/csvPreviewPanel').CsvPreviewPanel;
			CsvPreviewPanel.createOrShow(context.extensionUri, file, linearRegressionProvider);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('db-extension.refreshCsvPreview', async () => {
			const file = linearRegressionProvider.getSelectedFile();
			const CsvPreviewPanel = require('./providers/csvPreviewPanel').CsvPreviewPanel;
			CsvPreviewPanel.refresh(file, linearRegressionProvider);
		})
	);

	console.log('Registering setDummyVariableBaseCase command...');
	context.subscriptions.push(
		vscode.commands.registerCommand('db-extension.setDummyVariableBaseCase', async (item: any) => {
			console.log('setDummyVariableBaseCase command called with item:', item);
			const columnName = item.columnName || item.label;
			modelConfigProvider.setBaseCaseDummy(columnName);
			vscode.window.showInformationMessage(`"${columnName}" is now the base case`);
		})
	);
	console.log('setDummyVariableBaseCase command registered successfully');
	console.log('=== DB Extension Activation Complete ===');
	console.log(`Total subscriptions: ${context.subscriptions.length}`);
}
