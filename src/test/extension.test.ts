import * as assert from 'assert';
import * as path from 'path';
import { performLinearRegression } from '../utils/regressionUtils';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});
});

suite('Linear Regression Tests', () => {
	vscode.window.showInformationMessage('Start regression tests.');

	test('Simple linear regression with test_data.csv', async () => {
		// Get the test data file path
		const testDataPath = path.join(__dirname, '../../test_data.csv');
		console.log('Test data path:', testDataPath);

		// Run regression: Score (Y) = f(Hours (X))
		const results = await performLinearRegression(testDataPath, ['Hours'], 'Score');

		console.log('Regression Results:');
		console.log('  Intercept:', results.intercept);
		console.log('  Slope (Hours):', results.slopes['Hours']);
		console.log('  R²:', results.rSquared);
		console.log('  Adjusted R²:', results.adjustedRSquared);
		console.log('  Predictions:', results.predictions);
		console.log('  X Columns:', results.xColumns);

		// Validate results exist and are numbers
		assert.strictEqual(typeof results.intercept, 'number', 'Intercept should be a number');
		assert.ok(!isNaN(results.intercept), 'Intercept should not be NaN');
		assert.strictEqual(typeof results.rSquared, 'number', 'R² should be a number');
		assert.ok(!isNaN(results.rSquared), 'R² should not be NaN');
		assert.strictEqual(typeof results.adjustedRSquared, 'number', 'Adjusted R² should be a number');
		assert.ok(!isNaN(results.adjustedRSquared), 'Adjusted R² should not be NaN');

		// Validate R² is between 0 and 1 (or close for edge cases)
		assert.ok(results.rSquared >= -0.1 && results.rSquared <= 1.1, `R² should be approximately between 0 and 1, got ${results.rSquared}`);

		// Validate predictions array
		assert.strictEqual(results.predictions.length, 10, 'Should have 10 predictions for 10 data points');

		// Calculate expected values manually
		// Data points: (2,65), (3,75), (4,85), (5,95), (6,105), (7,115), (8,125), (1,50), (9,130), (10,140)
		// Y values: [65, 75, 85, 95, 105, 115, 125, 50, 130, 140]
		// X values: [2, 3, 4, 5, 6, 7, 8, 1, 9, 10]
		
		const yValues = [65, 75, 85, 95, 105, 115, 125, 50, 130, 140];
		const xValues = [2, 3, 4, 5, 6, 7, 8, 1, 9, 10];
		
		// Calculate expected Y mean
		const yMean = yValues.reduce((a, b) => a + b, 0) / yValues.length;
		console.log('Y mean:', yMean);
		
		// Calculate expected SS Total
		const ssTotal = yValues.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
		console.log('SS Total:', ssTotal);
		
		// Calculate expected SS Residual
		const ssResidual = yValues.reduce((sum, y, idx) => sum + Math.pow(y - results.predictions[idx], 2), 0);
		console.log('SS Residual:', ssResidual);
		
		// Calculate expected R²
		const expectedRSquared = 1 - (ssResidual / ssTotal);
		console.log('Expected R²:', expectedRSquared);
		
		// Calculate expected Adjusted R²
		const n = yValues.length;
		const p = results.xColumns.length;
		const expectedAdjustedRSquared = 1 - (1 - expectedRSquared) * ((n - 1) / (n - p - 1));
		console.log('Expected Adjusted R²:', expectedAdjustedRSquared);
		
		// Validate R² matches expected value (with small tolerance for floating point)
		assert.ok(Math.abs(results.rSquared - expectedRSquared) < 0.0001, 
			`R² mismatch: expected ${expectedRSquared}, got ${results.rSquared}`);
		
		// Validate Adjusted R² matches expected value
		assert.ok(Math.abs(results.adjustedRSquared - expectedAdjustedRSquared) < 0.0001, 
			`Adjusted R² mismatch: expected ${expectedAdjustedRSquared}, got ${results.adjustedRSquared}`);

		console.log('✓ Simple linear regression test passed');
	});

	test('Multivariate regression with test_data.csv', async () => {
		// Get the test data file path
		const testDataPath = path.join(__dirname, '../../test_data.csv');

		// Run regression: Score (Y) = f(Hours (X))
		// Note: Using only Hours as X since Category is categorical and we're not creating dummies in this test
		const results = await performLinearRegression(testDataPath, ['Hours'], 'Score');

		console.log('Multivariate Regression Results:');
		console.log('  Intercept:', results.intercept);
		console.log('  R²:', results.rSquared);
		console.log('  Adjusted R²:', results.adjustedRSquared);

		// Validate results
		assert.ok(results.xColumns.includes('Hours'), 'Hours should be in X columns');
		assert.strictEqual(typeof results.rSquared, 'number');
		assert.ok(!isNaN(results.rSquared));
		assert.strictEqual(typeof results.adjustedRSquared, 'number');
		assert.ok(!isNaN(results.adjustedRSquared));

		console.log('✓ Multivariate regression test passed');
	});

	test('Regression with dummy variables', async () => {
		// Get the test data file path
		const testDataPath = path.join(__dirname, '../../test_data.csv');

		// Create dummy variables for Category column
		// Category has values: A, B (creating dummy for B since A is reference)
		const dummyVariables = {
			Category: {
				A: [], // reference category
				B: [0, 1, 0, 1, 0, 1, 0, 0, 0, 1] // 1 where Category=B, 0 otherwise
			}
		};

		// Run regression: Score (Y) = f(Hours (X), Category_B (dummy))
		const results = await performLinearRegression(
			testDataPath,
			['Hours', 'Category_B'],
			'Score',
			dummyVariables
		);

		console.log('Dummy Variable Regression Results:');
		console.log('  Intercept:', results.intercept);
		console.log('  Slopes:', results.slopes);
		console.log('  R²:', results.rSquared);
		console.log('  Adjusted R²:', results.adjustedRSquared);
		console.log('  X Columns:', results.xColumns);

		// Validate results
		assert.ok(results.xColumns.includes('Hours'), 'Hours should be in X columns');
		assert.strictEqual(typeof results.rSquared, 'number');
		assert.ok(!isNaN(results.rSquared));
		assert.strictEqual(typeof results.adjustedRSquared, 'number');
		assert.ok(!isNaN(results.adjustedRSquared));

		// Adjusted R² can be negative, but should be close to R²
		assert.ok(results.adjustedRSquared <= results.rSquared + 0.1,
			'Adjusted R² should be less than or equal to R²');

		console.log('✓ Dummy variable regression test passed');
	});
});
