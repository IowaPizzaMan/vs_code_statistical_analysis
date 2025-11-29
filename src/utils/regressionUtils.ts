import * as fs from 'fs';
import * as stats from 'simple-statistics';

export interface RegressionResult {
    slopes: { [key: string]: number };
    intercept: number;
    rSquared: number;
    adjustedRSquared: number;
    predictions: number[];
    xColumns: string[];
}

export async function performLinearRegression(
    filePath: string,
    xColumns: string[],
    yColumn: string,
    dummyVariables?: { [columnName: string]: { [key: string]: number[] } }
): Promise<RegressionResult> {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf-8', (err, data) => {
            if (err) {
                reject(err);
                return;
            }

            try {
                const lines = data.split('\n').filter(line => line.trim());
                if (lines.length < 2) {
                    throw new Error('CSV file must have at least 2 rows (header + data)');
                }

                const headers = lines[0].split(',').map(h => h.trim());
                const yIndex = headers.indexOf(yColumn);

                if (yIndex === -1) {
                    throw new Error(`Column "${yColumn}" not found in CSV`);
                }

                // Separate actual CSV columns from dummy variable names
                const actualCsvColumns = xColumns.filter(col => headers.includes(col));

                // Extract dummy variable categories for each column
                const dummyCategoryMap: { [colName: string]: string[] } = {};
                const dummyColumnNames: string[] = [];

                if (dummyVariables) {
                    for (const colName in dummyVariables) {
                        // dummyVariables[colName] is { [categoryName]: number[] }
                        const categories = Object.keys(dummyVariables[colName]);
                        dummyCategoryMap[colName] = categories;

                        // Add dummy names (skip first category as reference)
                        for (let i = 1; i < categories.length; i++) {
                            dummyColumnNames.push(`${colName}_${categories[i]}`);
                        }
                    }
                }

                // Validate all actual CSV X columns exist
                const xIndices: { [key: string]: number } = {};
                for (const xCol of actualCsvColumns) {
                    const idx = headers.indexOf(xCol);
                    if (idx === -1) {
                        throw new Error(`Column "${xCol}" not found in CSV`);
                    }
                    xIndices[xCol] = idx;
                }

                // Get indices for dummy variable source columns
                const dummySourceIndices: { [colName: string]: number } = {};
                for (const colName in dummyCategoryMap) {
                    const idx = headers.indexOf(colName);
                    if (idx === -1) {
                        console.warn(`Dummy variable source column "${colName}" not found in CSV`);
                    } else {
                        dummySourceIndices[colName] = idx;
                    }
                }

                // Build regression data: [x1, x2, ..., dummy1, dummy2, ..., y]
                const regressionData: number[][] = [];
                const yValues: number[] = [];

                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',').map(v => v.trim());

                    // Parse Y value
                    const yVal = parseFloat(values[yIndex]);
                    if (isNaN(yVal)) {
                        console.warn(`Row ${i}: Y value "${values[yIndex]}" is not numeric, skipping row`);
                        continue;
                    }

                    const dataRow: number[] = [];
                    let skipRow = false;

                    // Add actual X column values (convert to numeric)
                    for (const xCol of actualCsvColumns) {
                        const xIdx = xIndices[xCol];
                        const xVal = parseFloat(values[xIdx]);
                        if (isNaN(xVal)) {
                            console.warn(`Row ${i}: X value "${values[xIdx]}" in column "${xCol}" is not numeric, skipping row`);
                            skipRow = true;
                            break;
                        }
                        dataRow.push(xVal);
                    }

                    if (skipRow) {
                        continue;
                    }

                    // Add dummy variables as 0/1 values based on category match
                    if (dummyVariables) {
                        for (const colName in dummyCategoryMap) {
                            const categories = dummyCategoryMap[colName];
                            const sourceIdx = dummySourceIndices[colName];

                            if (sourceIdx === undefined) {
                                continue;
                            }

                            const cellValue = values[sourceIdx];

                            // Add dummy for each category except the first (reference)
                            for (let catIdx = 1; catIdx < categories.length; catIdx++) {
                                const isDummy = cellValue === categories[catIdx] ? 1 : 0;
                                dataRow.push(isDummy);
                            }
                        }
                    }

                    regressionData.push(dataRow);
                    yValues.push(yVal);
                }

                if (regressionData.length < 2) {
                    throw new Error('Not enough valid rows with numeric data for regression');
                }

                // Build regression points: [...xValues, yValue]
                const regressionPoints = regressionData.map((row, idx) => [...row, yValues[idx]]);
                const regression = stats.linearRegression(regressionPoints as any);

                if (!regression) {
                    throw new Error('Failed to calculate linear regression');
                }

                // Build all X columns in order
                const allXCols = [...actualCsvColumns, ...dummyColumnNames];
                
                console.log('=== REGRESSION CALCULATION ===');
                console.log('Data loaded:', {
                    rows: regressionData.length,
                    yColumn,
                    xColumns: allXCols,
                    actualCsvColumns,
                    dummyColumnNames
                });
                console.log('Y values sample (first 5):', yValues.slice(0, 5));
                console.log('Regression data sample (first row):', regressionData.length > 0 ? regressionData[0] : 'no data');

                // Extract coefficients
                const slopes: { [key: string]: number } = {};
                console.log('Regression object:', { m: (regression.m as any).slice(0, 5), b: regression.b });
                for (let i = 0; i < allXCols.length; i++) {
                    slopes[allXCols[i]] = (regression.m as any)[i];
                }
                console.log('Slopes:', slopes);

                const intercept = regression.b;
                console.log('Intercept:', intercept, 'type:', typeof intercept);

                // Calculate predictions
                const predictions = regressionData.map(row => {
                    let pred = intercept;
                    for (let i = 0; i < row.length; i++) {
                        pred += slopes[allXCols[i]] * row[i];
                    }
                    return pred;
                });
                console.log('Predictions sample (first 5):', predictions.slice(0, 5));

                // Calculate R² and Adjusted R²
                const yMean = stats.mean(yValues);
                console.log('Y mean:', yMean);
                
                const ssTotal = yValues.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
                console.log('SS Total:', ssTotal);
                
                const ssResidual = yValues.reduce(
                    (sum, y, idx) => sum + Math.pow(y - predictions[idx], 2),
                    0
                );
                console.log('SS Residual:', ssResidual);

                // Handle edge case where all y values are identical
                let rSquared = ssTotal === 0 ? 0 : 1 - ssResidual / ssTotal;
                console.log('R² (before NaN check):', rSquared, 'type:', typeof rSquared);
                
                const n = yValues.length;
                const p = allXCols.length;
                console.log('Sample size (n):', n, 'Parameters (p):', p);

                // Ensure valid adjusted R² calculation
                let adjustedRSquared = rSquared;
                if (n > p + 1) {
                    adjustedRSquared = 1 - (1 - rSquared) * ((n - 1) / (n - p - 1));
                    console.log('Adjusted R² calculated:', adjustedRSquared);
                } else {
                    console.log('Adjusted R² skipped (n <= p+1)');
                }
                console.log('Adjusted R² (before NaN check):', adjustedRSquared, 'type:', typeof adjustedRSquared);

                // Validate no NaN values
                if (isNaN(rSquared)) {
                    console.error('NaN detected in rSquared calculation', {
                        ssTotal,
                        ssResidual,
                        yMean,
                        yValues: yValues.slice(0, 5),
                        predictions: predictions.slice(0, 5)
                    });
                    rSquared = 0;
                }

                if (isNaN(adjustedRSquared)) {
                    console.error('NaN detected in adjustedRSquared calculation', {
                        rSquared,
                        n,
                        p
                    });
                    adjustedRSquared = 0;
                }

                console.log('Final result:', {
                    rSquared,
                    adjustedRSquared,
                    intercept,
                    slopesCount: Object.keys(slopes).length
                });

                resolve({
                    slopes,
                    intercept,
                    rSquared,
                    adjustedRSquared,
                    predictions,
                    xColumns: allXCols
                });
            } catch (err) {
                reject(err);
            }
        });
    });
}
