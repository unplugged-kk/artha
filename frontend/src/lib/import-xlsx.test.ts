import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient from './api';
import { xlsxImportApi } from './import-xlsx';

vi.mock('./api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedClient = vi.mocked(apiClient);

describe('xlsxImportApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedClient.post.mockResolvedValue({ data: {} } as never);
  });

  describe('sheets', () => {
    it('uploads the file as multipart', async () => {
      const file = new File(['bytes'], 'Budget.xlsx');

      await xlsxImportApi.sheets(file);

      const [url, body, config] = mockedClient.post.mock.calls[0];
      expect(url).toBe('/import/xlsx/sheets');
      expect(body).toBeInstanceOf(FormData);
      expect((body as FormData).get('file')).toBe(file);
      expect(config?.headers?.['Content-Type']).toBe('multipart/form-data');
    });

    it('returns the sheets the server reports', async () => {
      const sheets = [
        { name: 'Transactions', rowCount: 41, guessedHeaderRow: 4, previewRows: [] },
      ];
      mockedClient.post.mockResolvedValueOnce({ data: { sheets } } as never);

      const result = await xlsxImportApi.sheets(new File(['bytes'], 'Budget.xlsx'));

      expect(result).toEqual({ sheets });
    });
  });

  describe('toCsv', () => {
    it('uploads the file plus sheetName and headerRow as multipart form fields', async () => {
      const file = new File(['bytes'], 'Budget.xlsx');

      await xlsxImportApi.toCsv(file, 'Transactions', 4);

      const [url, body, config] = mockedClient.post.mock.calls[0];
      expect(url).toBe('/import/xlsx/to-csv');
      expect(body).toBeInstanceOf(FormData);
      const formData = body as FormData;
      expect(formData.get('file')).toBe(file);
      expect(formData.get('sheetName')).toBe('Transactions');
      expect(formData.get('headerRow')).toBe('4');
      expect(config?.headers?.['Content-Type']).toBe('multipart/form-data');
    });

    it('returns the CSV content the server reports', async () => {
      mockedClient.post.mockResolvedValueOnce({
        data: { content: 'Date,Amount\n2026-01-01,10' },
      } as never);

      const result = await xlsxImportApi.toCsv(
        new File(['bytes'], 'Budget.xlsx'),
        'Transactions',
        4,
      );

      expect(result).toEqual({ content: 'Date,Amount\n2026-01-01,10' });
    });
  });
});
