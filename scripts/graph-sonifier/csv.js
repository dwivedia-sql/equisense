/**
 * csv.js — Papa Parse wrapper
 * Returns a Promise<DataPoint[]> where DataPoint = { x: number, y: number }
 */

/**
 * @param {File} file
 * @returns {Promise<{x:number,y:number}[]>}
 */
export function parseCSV(file) {
  return parseTabularCSV(file, false);
}

/**
 * @param {string} url  relative path to a local CSV file
 * @returns {Promise<{x:number,y:number}[]>}
 */
export function parseCSVFromURL(url) {
  return parseTabularCSV(url, true);
}

function parseTabularCSV(input, download) {
  return new Promise((resolve, reject) => {
    const parseOptions = {
      download,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete(results) {
        const withHeaders = extractPoints(results.data, results.meta.fields);
        if (withHeaders.length) {
          resolve(withHeaders);
          return;
        }

        if (results.meta?.fields?.length) {
          Papa.parse(input, {
            download,
            header: false,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete(fallbackResults) {
              const fallbackPoints = extractPoints(fallbackResults.data, []);
              if (!fallbackPoints.length) {
                reject(new Error('CSV must contain at least two numeric columns'));
                return;
              }
              resolve(fallbackPoints);
            },
            error(err) { reject(err); }
          });
          return;
        }

        reject(new Error('CSV must contain at least two numeric columns'));
      },
      error(err) { reject(err); }
    };

    Papa.parse(input, { ...parseOptions, header: true });
  });
}

function extractPoints(rows, fields) {
  if (!rows?.length) return [];

  if (fields?.length) {
    const normalizedFields = fields.map(field => String(field).trim());
    const xField = findColumn(normalizedFields, ['x', 'time', 't']);
    const yField = findColumn(normalizedFields, ['y', 'value', 'values', 'amplitude']);
    const [fallbackX, fallbackY] = normalizedFields;
    const xKey = xField ?? fallbackX;
    const yKey = yField ?? fallbackY;

    return rows
      .map(row => ({ x: Number(row[xKey]), y: Number(row[yKey]) }))
      .filter(point => isFinite(point.x) && isFinite(point.y));
  }

  return rows
    .map(row => ({ x: Number(row?.[0]), y: Number(row?.[1]) }))
    .filter(point => isFinite(point.x) && isFinite(point.y));
}

function findColumn(fields, names) {
  const match = fields.find(field => names.includes(field.toLowerCase()));
  return match ?? null;
}
