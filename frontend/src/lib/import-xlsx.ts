import apiClient from './api';

/**
 * Client for the two .xlsx import endpoints.
 *
 * The file goes up as multipart, like the MS Money importer -- a workbook is
 * binary and reading it with `File.text()` would corrupt it. `toCsv` converts
 * one sheet into plain CSV, which the wizard then hands to the EXISTING
 * `importApi.parseCsvHeaders` / `importApi.parseCsv` / `importApi.importCsv`
 * unmodified: this client's only job is turning a workbook into CSV text.
 */

const XLSX_TIMEOUT_MS = 60_000;

export interface XlsxSheetSummary {
  name: string;
  rowCount: number;
  guessedHeaderRow: number;
  previewRows: string[][];
}

export interface XlsxSheetsResponse {
  sheets: XlsxSheetSummary[];
}

export interface XlsxToCsvResponse {
  content: string;
}

export const xlsxImportApi = {
  sheets: async (file: File): Promise<XlsxSheetsResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<XlsxSheetsResponse>(
      '/import/xlsx/sheets',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: XLSX_TIMEOUT_MS,
      },
    );
    return response.data;
  },

  toCsv: async (
    file: File,
    sheetName: string,
    headerRow: number,
  ): Promise<XlsxToCsvResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sheetName', sheetName);
    formData.append('headerRow', String(headerRow));
    const response = await apiClient.post<XlsxToCsvResponse>(
      '/import/xlsx/to-csv',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: XLSX_TIMEOUT_MS,
      },
    );
    return response.data;
  },
};
