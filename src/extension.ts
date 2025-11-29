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
	console.log('Congratulations, your extension "db-extension" is now active!');

	// Register the Hello World command from the commands module
	const helloDisposable = registerHelloWorld();
	context.subscriptions.push(helloDisposable);

	// Register the Show Active File command from the commands module
	const showFileDisposable = registerShowActiveFile();
	context.subscriptions.push(showFileDisposable);

	// Initialize regression history and model config services
	const historyService = new RegressionHistoryService();
	const modelConfigProvider = new ModelConfigProvider();
	const historyProvider = new HistoryProvider(historyService);

	// Set up Linear Regression Tree View
	const workspaceRoot =
		vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
			? vscode.workspace.workspaceFolders[0].uri.fsPath
			: undefined;
	const linearRegressionProvider = new LinearRegressionProvider(workspaceRoot);

	const csvFileTreeView = vscode.window.createTreeView('csvFileExplorer', {
		treeDataProvider: linearRegressionProvider
	});
	context.subscriptions.push(csvFileTreeView);

	// Set up Model Configuration Tree View
	const modelConfigTreeView = vscode.window.createTreeView('modelConfig', {
		treeDataProvider: modelConfigProvider
	});
	context.subscriptions.push(modelConfigTreeView);

	// Set up Regression History Tree View
	const historyTreeView = vscode.window.createTreeView('regressionHistory', {
		treeDataProvider: historyProvider
	});
	context.subscriptions.push(historyTreeView);

	// Register Linear Regression commands
	const linearRegressionDisposables = registerLinearRegression(
		linearRegressionProvider,
		context.extensionUri,
		historyService,
		modelConfigProvider,
		historyProvider
	);
	linearRegressionDisposables.forEach(d => context.subscriptions.push(d));

	// Register model config remove commands
	context.subscriptions.push(
		vscode.commands.registerCommand('db-extension.removeXColumn', (item: any) => {
			const columnName = item.columnName || item.label;
			linearRegressionProvider.removeSelectedXColumn(columnName);
			modelConfigProvider.removeXColumn(columnName);
			vscode.window.showInformationMessage(`Removed X column: ${columnName}`);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('db-extension.removeYColumn', () => {
			linearRegressionProvider.setSelectedYColumn(null);
			modelConfigProvider.removeYColumn();
			vscode.window.showInformationMessage('Removed Y column');
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('db-extension.removeDummyColumn', (item: any) => {
			const columnName = item.columnName || item.label;
			// Remove from selected X columns
			linearRegressionProvider.removeSelectedXColumn(columnName);
			modelConfigProvider.removeDummyColumn(columnName);
			vscode.window.showInformationMessage(`Removed dummy column: ${columnName}`);
		})
	);
}

// This method is called when your extension is deactivated
export function deactivate() { }
