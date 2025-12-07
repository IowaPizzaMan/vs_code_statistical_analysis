import * as fs from 'fs';

export async function detectCategoricalColumns(filePath: string): Promise<{ [key: string]: string[] }> {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf-8', (err, data) => {
            if (err) {
                reject(err);
                return;
            }

            try {
                const { parseCSV } = require('./csvUtils');
                const rows: string[][] = parseCSV(data);
                if (rows.length < 2) {
                    resolve({});
                    return;
                }

                const headers = rows[0].map(h => h.trim());
                const columnCategories: { [key: string]: Set<string> } = {};

                headers.forEach(header => {
                    columnCategories[header] = new Set();
                });

                // Sample first 100 rows to detect categories
                const sampleSize = Math.min(100, rows.length - 1);
                for (let i = 1; i <= sampleSize; i++) {
                    const values = rows[i];
                    values.forEach((value, idx) => {
                        const header = headers[idx];
                        if (header && value) {
                            columnCategories[header].add(value);
                        }
                    });
                }

                // Detect categorical: columns with < 10 unique values and not numeric
                const categoricalCols: { [key: string]: string[] } = {};
                headers.forEach(header => {
                    const uniqueValues = Array.from(columnCategories[header] || []);
                    const isNumeric = uniqueValues.every(v => !isNaN(parseFloat(v)));

                    if (!isNumeric && uniqueValues.length > 1 && uniqueValues.length < 10) {
                        categoricalCols[header] = uniqueValues;
                    }
                });

                resolve(categoricalCols);
            } catch (err) {
                reject(err);
            }
        });
    });
}

export async function createDummyVariables(
    filePath: string,
    categoricalColumn: string,
    baseCaseCategory?: string
): Promise<{ [key: string]: number[] }> {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf-8', (err, data) => {
            if (err) {
                reject(err);
                return;
            }
            try {
                const { parseCSV } = require('./csvUtils');
                const rows: string[][] = parseCSV(data);
                if (rows.length < 2) {
                    throw new Error('CSV file must have at least 2 rows');
                }

                const headers = rows[0].map(h => h.trim());
                const colIndex = headers.indexOf(categoricalColumn);

                if (colIndex === -1) {
                    throw new Error(`Column "${categoricalColumn}" not found`);
                }

                // Get unique categories
                const categories = new Set<string>();
                for (let i = 1; i < rows.length; i++) {
                    const values = rows[i];
                    if (values[colIndex]) {
                        categories.add(values[colIndex]);
                    }
                }

                const categoryList = Array.from(categories).sort();
                const dummies: { [key: string]: number[] } = {};

                // Create dummy variable for each category (exclude base case if specified)

                for (let i = 0; i < categoryList.length; i++) {
                    const category = categoryList[i];

                    // Skip the base case category
                    if (baseCaseCategory && category === baseCaseCategory) {
                        continue;
                    }

                    dummies[`${categoricalColumn}_${category}`] = [];

                    for (let j = 1; j < rows.length; j++) {
                        const values = rows[j];
                        dummies[`${categoricalColumn}_${category}`].push(
                            values[colIndex] === category ? 1 : 0
                        );
                    }
                }

                resolve(dummies);
            } catch (err) {
                reject(err);
            }
        });
    });
}
