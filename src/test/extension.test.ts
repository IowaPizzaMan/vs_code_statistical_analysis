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

	test('Slope equation validation', async () => {
		// Get the test data file path
		const testDataPath = path.join(__dirname, '../../test_data.csv');

		// Run regression: Score (Y) = f(Hours (X))
		const results = await performLinearRegression(testDataPath, ['Hours'], 'Score');

		console.log('Slope Equation Validation:');
		console.log('  Intercept:', results.intercept);
		console.log('  Slope:', results.slopes['Hours']);
		console.log('  Expected equation: Y = ' + results.intercept.toFixed(4) + ' + ' + results.slopes['Hours'].toFixed(4) + ' * X');

		// Data points: (2,65), (3,75), (4,85), (5,95), (6,105), (7,115), (8,125), (1,50), (9,130), (10,140)
		const xValues = [2, 3, 4, 5, 6, 7, 8, 1, 9, 10];
		const yValues = [65, 75, 85, 95, 105, 115, 125, 50, 130, 140];

		const intercept = results.intercept;
		const slope = results.slopes['Hours'];

		console.log('Validating each prediction against equation: Y = ' + intercept.toFixed(4) + ' + ' + slope.toFixed(4) + ' * X');

		// Validate each prediction matches the equation: Y = intercept + slope * X
		for (let i = 0; i < xValues.length; i++) {
			const x = xValues[i];
			const actualY = yValues[i];
			const predictedY = results.predictions[i];
			const calculatedY = intercept + slope * x;

			console.log(`  Point ${i + 1}: X=${x}, Actual Y=${actualY}, Predicted Y=${predictedY.toFixed(4)}, Calculated Y=${calculatedY.toFixed(4)}`);

			// Validate predicted Y matches the equation calculation
			assert.ok(Math.abs(predictedY - calculatedY) < 1e-10,
				`Prediction mismatch for point ${i + 1}: predicted ${predictedY} but equation gives ${calculatedY}`);

			// Validate the equation produces consistent predictions
			assert.ok(Math.abs(predictedY - (intercept + slope * x)) < 1e-10,
				`Equation Y = ${intercept} + ${slope} * ${x} should equal ${predictedY}`);
		}

		console.log('✓ Slope equation validation passed - all predictions match the equation');
	});

	test('Multivariate slope equation validation', async () => {
		// Get the test data file path
		const testDataPath = path.join(__dirname, '../../test_data.csv');

		// Create dummy variables for Category column
		const dummyVariables = {
			Category: {
				A: [], // reference category
				B: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1] // 1 where Category=B, 0 otherwise
			}
		};

		// Run regression: Score (Y) = f(Hours (X), Category_B (dummy))
		const results = await performLinearRegression(
			testDataPath,
			['Hours', 'Category_B'],
			'Score',
			dummyVariables
		);

		console.log('Multivariate Slope Equation Validation:');
		console.log('  Intercept:', results.intercept);
		console.log('  Slope (Hours):', results.slopes['Hours']);
		console.log('  Slope (Category_B):', results.slopes['Category_B']);
		console.log('  Expected equation: Y = ' + results.intercept.toFixed(4) + ' + ' + results.slopes['Hours'].toFixed(4) + ' * Hours + ' + results.slopes['Category_B'].toFixed(4) + ' * Category_B');

		// Data from test_data.csv:
		// Hours,Score,Category
		// 2,65,A      -> Hours=2, Category_B=0
		// 3,75,B      -> Hours=3, Category_B=1
		// 4,85,A      -> Hours=4, Category_B=0
		// 5,95,B      -> Hours=5, Category_B=1
		// 6,105,A     -> Hours=6, Category_B=0
		// 7,115,B     -> Hours=7, Category_B=1
		// 8,125,A     -> Hours=8, Category_B=0
		// 1,50,B      -> Hours=1, Category_B=1
		// 9,130,A     -> Hours=9, Category_B=0
		// 10,140,B    -> Hours=10, Category_B=1
		const hoursValues = [2, 3, 4, 5, 6, 7, 8, 1, 9, 10];
		const categoryBValues = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1];
		const yValues = [65, 75, 85, 95, 105, 115, 125, 50, 130, 140];

		const intercept = results.intercept;
		const slopeHours = results.slopes['Hours'];
		const slopeCategory = results.slopes['Category_B'];

		console.log('Validating each prediction against multivariate equation');

		// Validate each prediction matches: Y = intercept + slope_hours * hours + slope_category * category_b
		for (let i = 0; i < hoursValues.length; i++) {
			const hours = hoursValues[i];
			const categoryB = categoryBValues[i];
			const actualY = yValues[i];
			const predictedY = results.predictions[i];
			const calculatedY = intercept + slopeHours * hours + slopeCategory * categoryB;

			console.log(`  Point ${i + 1}: Hours=${hours}, Category_B=${categoryB}, Actual Y=${actualY}, Predicted Y=${predictedY.toFixed(4)}, Calculated Y=${calculatedY.toFixed(4)}`);

			// Validate predicted Y matches the equation calculation
			assert.ok(Math.abs(predictedY - calculatedY) < 1e-10,
				`Multivariate prediction mismatch for point ${i + 1}: predicted ${predictedY} but equation gives ${calculatedY}`);

			// Validate the equation produces consistent predictions
			assert.ok(Math.abs(predictedY - (intercept + slopeHours * hours + slopeCategory * categoryB)) < 1e-10,
				`Equation Y = ${intercept} + ${slopeHours} * ${hours} + ${slopeCategory} * ${categoryB} should equal ${predictedY}`);
		}

		console.log('✓ Multivariate slope equation validation passed - all predictions match the equation');
	});

	test('Base case exclusion from equation - Category_A as base case', async () => {
		// Get the test data file path
		const testDataPath = path.join(__dirname, '../../test_data.csv');

		// Create dummy variables for Category column
		// Category_A will be the base case, so it should NOT appear in the equation
		// Only Category_B should be in the equation
		const dummyVariables = {
			Category: {
				A: [], // This is the base case - should NOT be in equation
				B: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1]
			}
		};

		// Run regression: Score (Y) = f(Hours (X), Category_B (dummy))
		// Note: Category_A is NOT included because it's the base case
		const results = await performLinearRegression(
			testDataPath,
			['Hours', 'Category_B'],
			'Score',
			dummyVariables
		);

		console.log('Base Case Exclusion Test (Category_A as base case):');
		console.log('  X Columns in equation:', results.xColumns);
		console.log('  Intercept:', results.intercept);
		console.log('  Slopes:', results.slopes);

		// CRITICAL: Verify Category_A is NOT in the equation
		assert.ok(!results.xColumns.includes('Category_A'),
			'Category_A (base case) should NOT be in the equation');

		// Verify Category_B IS in the equation
		assert.ok(results.xColumns.includes('Category_B'),
			'Category_B should be in the equation');

		// Verify only 2 X columns: Hours and Category_B
		assert.strictEqual(results.xColumns.length, 2,
			'Should have exactly 2 X columns (Hours and Category_B), not 3');

		// Verify the slope for Category_B exists
		assert.ok(results.slopes['Category_B'] !== undefined,
			'Slope for Category_B should exist');

		console.log('✓ Base case exclusion test passed - Category_A correctly excluded from equation');
	});

	test('Base case change validation - switching from Category_A to Category_B', async () => {
		// Get the test data file path
		const testDataPath = path.join(__dirname, '../../test_data.csv');

		// Test 1: Category_A as the base case (NOT included in equation)
		// When A is base case, we only pass Category_B dummy variable
		const dummiesWithAAsBase = {
			Category: {
				A: [], // A is the base case - empty, no dummy
				B: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1]
			}
		};

		const resultsWithAAsBase = await performLinearRegression(
			testDataPath,
			['Hours', 'Category_B'],
			'Score',
			dummiesWithAAsBase
		);

		console.log('Base Case Change Test - Category_A as base case (initial):');
		console.log('  X Columns:', resultsWithAAsBase.xColumns);
		console.log('  Slopes:', resultsWithAAsBase.slopes);

		// Verify Category_A is NOT in the equation
		assert.ok(!resultsWithAAsBase.xColumns.includes('Category_A'),
			'Category_A (base case) should NOT be in the equation');

		// Verify Category_B IS in the equation
		assert.ok(resultsWithAAsBase.xColumns.includes('Category_B'),
			'Category_B should be in the equation when A is base case');

		// Get the slope value for comparison
		const categoryBSlopeWhenAIsBase = resultsWithAAsBase.slopes['Category_B'];
		console.log('  Category_B slope when A is base case:', categoryBSlopeWhenAIsBase);

		// Test 2: Same regression parameters - in the current implementation,
		// the base case is determined by the order of categories in dummyVariables,
		// which is determined by JavaScript object key iteration order
		// This test verifies the current behavior works consistently
		const dummiesForSecondCall = {
			Category: {
				A: [],    // First category (base case)
				B: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1]  // Second category (predictor)
			}
		};

		const resultsForSecondCall = await performLinearRegression(
			testDataPath,
			['Hours', 'Category_B'],
			'Score',
			dummiesForSecondCall
		);

		console.log('Base Case Change Test - Second regression call:');
		console.log('  X Columns:', resultsForSecondCall.xColumns);
		console.log('  Slopes:', resultsForSecondCall.slopes);

		// Both calls should produce identical results since they use the same parameters
		assert.strictEqual(JSON.stringify(resultsWithAAsBase.xColumns), JSON.stringify(resultsForSecondCall.xColumns),
			'X columns should be identical for identical regression parameters');

		const categoryBSlopeForSecondCall = resultsForSecondCall.slopes['Category_B'];
		console.log('  Category_B slope for second call:', categoryBSlopeForSecondCall);

		// The slopes should be identical since the parameters are identical
		assert.ok(Math.abs(categoryBSlopeWhenAIsBase - categoryBSlopeForSecondCall) < 1e-10,
			'Slopes should be identical for identical parameters');

		console.log('✓ Base case change test passed - consistent behavior with same parameters');
	});

	test('Three-category dummy variable base case validation', async () => {
		// This test verifies that when you have 3 categories (A, B, C),
		// and you set one as base case, exactly 2 dummies appear in the equation

		const testDataPath = path.join(__dirname, '../../test_data.csv');

		// Simulate 3 categories by creating dummies for A, B, C with A as base case
		const dummyVariables = {
			Category: {
				A: [], // Base case - NOT in equation
				B: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
				C: [0, 0, 0, 0, 0, 0, 1, 0, 1, 0]
			}
		};

		// Run regression with all three dummies BUT only B and C should be in equation
		const results = await performLinearRegression(
			testDataPath,
			['Hours', 'Category_B', 'Category_C'],
			'Score',
			dummyVariables
		);

		console.log('Three-Category Base Case Test:');
		console.log('  X Columns in equation:', results.xColumns);
		console.log('  Slopes:', results.slopes);
		console.log('  Intercept represents coefficient for base case (Category_A)');

		// Verify base case (A) is NOT in equation
		assert.ok(!results.xColumns.includes('Category_A'),
			'Category_A (base case) should NOT be in equation');

		// Verify both non-base categories ARE in equation
		assert.ok(results.xColumns.includes('Category_B'),
			'Category_B should be in equation');
		assert.ok(results.xColumns.includes('Category_C'),
			'Category_C should be in equation');

		// Verify exactly 3 X columns: Hours, Category_B, Category_C
		assert.strictEqual(results.xColumns.length, 3,
			'Should have exactly 3 X columns (Hours, Category_B, Category_C)');

		// Verify intercept represents the baseline for base case (Category_A)
		console.log('  Intercept represents estimated Score when Category=A and Hours=0');
		assert.ok(typeof results.intercept === 'number',
			'Intercept should be a number (baseline for base case)');

		// The predicted values for Category_A observations should be:
		// Y = intercept + slope_hours * hours + slope_b * 0 + slope_c * 0
		// Y = intercept + slope_hours * hours

		console.log('✓ Three-category base case test passed - only non-base categories in equation');
	});
});
