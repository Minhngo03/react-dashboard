import Papa from "papaparse";

export const loadCSV = (file) =>
  new Promise((resolve) => {
    Papa.parse(`/data/${file}`, {
      download: true,
      header: true,
      dynamicTyping: true,
      complete: (result) => resolve(result.data),
    });
  });
