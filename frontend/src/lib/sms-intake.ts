import { apiClient } from './api';
import {
  ParseSmsDto,
  ParsedSmsResponse,
  ImportSmsDto,
  SmsImportResult,
  KnownBankSender,
} from '@/types/sms-intake';
import { invalidateBalanceCaches } from './apiCache';

export const smsIntakeApi = {
  parse: async (dto: ParseSmsDto): Promise<ParsedSmsResponse> => {
    const response = await apiClient.post<ParsedSmsResponse>(
      '/import/sms/parse',
      dto,
    );
    return response.data;
  },

  import: async (dto: ImportSmsDto): Promise<SmsImportResult> => {
    const response = await apiClient.post<SmsImportResult>(
      '/import/sms/import',
      dto,
    );
    if (response.data.status === 'imported') {
      invalidateBalanceCaches();
    }
    return response.data;
  },

  getKnownSenders: async (): Promise<KnownBankSender[]> => {
    const response = await apiClient.get<KnownBankSender[]>(
      '/import/sms/senders/known',
    );
    return response.data;
  },
};
