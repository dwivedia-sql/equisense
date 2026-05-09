/**
 * csv.js — Papa Parse wrapper
 * Returns a Promise<DataPoint[]> where DataPoint = { x: number, y: number }
 */

/**
 * @param {File} file
 * @returns {Promise<{x:number,y:number}[]>}
 */
export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete(results) {
        const cols = results.meta.fields ?? [];
        const [xCol, yCol] = cols;
        if (!xCol || !yCol) {
          reject(new Error('CSV must have at least two columns (x, y)'));
          return;
        }
        const points = results.data
          .map(row => ({ x: Number(row[xCol]), y: Number(row[yCol]) }))
          .filter(p => isFinite(p.x) && isFinite(p.y));
        if (!points.length) { reject(new Error('No valid numeric rows found')); return; }
        resolve(points);
      },
      error(err) { reject(err); }
    });
  });
}

/**
 * @param {string} url  relative path to a local CSV file
 * @returns {Promise<{x:number,y:number}[]>}
 */
export function parseCSVFromURL(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete(results) {
        const cols = results.meta.fields ?? [];
        const [xCol, yCol] = cols;
        const points = results.data
          .map(row => ({ x: Number(row[xCol]), y: Number(row[yCol]) }))
          .filter(p => isFinite(p.x) && isFinite(p.y));
        resolve(points);
      },
      error(err) { reject(err); }
    });
  });
}
