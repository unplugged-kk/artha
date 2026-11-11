'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { NumericInput } from '@/components/ui/NumericInput';
import { XlsxSheetSummary } from '@/lib/import-xlsx';

interface SelectXlsxSheetStepProps {
  fileName: string;
  sheets: XlsxSheetSummary[];
  sheetName: string;
  headerRow: number;
  isLoading: boolean;
  onSheetChange: (sheetName: string) => void;
  onHeaderRowChange: (headerRow: number) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function SelectXlsxSheetStep({
  fileName,
  sheets,
  sheetName,
  headerRow,
  isLoading,
  onSheetChange,
  onHeaderRowChange,
  onCancel,
  onConfirm,
}: SelectXlsxSheetStepProps) {
  const t = useTranslations('import');

  const selectedSheet = sheets.find((s) => s.name === sheetName);
  const previewRows = selectedSheet?.previewRows ?? [];
  const headerCells = previewRows[0] ?? [];
  const dataRows = previewRows.slice(1);

  const sheetOptions = sheets.map((s) => ({
    value: s.name,
    label:
      s.rowCount > 0
        ? `${s.name} (${t('xlsxSelectSheet.rowsCount', { count: s.rowCount })})`
        : `${s.name} ${t('xlsxSelectSheet.emptySheet')}`,
  }));

  return (
    <div className="max-w-3xl mx-auto">
      <Card padding="md">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
          {t('xlsxSelectSheet.heading')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {fileName}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          {t('xlsxSelectSheet.description')}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <Select
            label={t('xlsxSelectSheet.sheetLabel')}
            options={sheetOptions}
            value={sheetName}
            onChange={(e) => onSheetChange(e.target.value)}
            disabled={isLoading}
          />
          <NumericInput
            label={t('xlsxSelectSheet.headerRowLabel')}
            value={headerRow}
            onChange={(value) => onHeaderRowChange(value ?? 1)}
            decimalPlaces={0}
            min={1}
            max={Math.max(selectedSheet?.rowCount ?? 1, 1)}
            disabled={isLoading}
          />
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6 overflow-x-auto">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('xlsxSelectSheet.previewHeading')}
          </h3>
          {headerCells.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('xlsxSelectSheet.noPreview')}
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  {headerCells.map((cell, i) => (
                    <th
                      key={i}
                      className="text-left font-medium text-gray-700 dark:text-gray-300 px-2 py-1 border-b border-gray-200 dark:border-gray-600 whitespace-nowrap"
                    >
                      {cell || '—'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td
                        key={cellIndex}
                        className="px-2 py-1 text-gray-600 dark:text-gray-400 whitespace-nowrap"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-between">
          <Button variant="secondary" onClick={onCancel} disabled={isLoading}>
            {t('xlsxSelectSheet.cancel')}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading || !sheetName}
            isLoading={isLoading}
          >
            {t('xlsxSelectSheet.confirm')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
