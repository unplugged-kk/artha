import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  PayloadTooLargeException,
} from "@nestjs/common";
import { Observable, catchError, throwError } from "rxjs";
import { tr } from "../i18n/translate";

/**
 * The one localized "file too large" error for the xlsx importer, mirroring
 * `mny-upload-error.interceptor.ts`. Shared by this interceptor and the
 * handler's own bound check so a user sees the same sentence whichever
 * rejects the upload.
 */
export function xlsxFileTooLargeException(
  limitMb: number,
): PayloadTooLargeException {
  return new PayloadTooLargeException({
    message: tr(
      "errors.import.xlsxFileTooLarge",
      `That Excel file is larger than the ${limitMb} MB import limit.`,
      { limit: limitMb },
    ),
    errorCode: "xlsxFileTooLarge",
  });
}

/**
 * Replaces multer's untranslated size error with a localized one that names
 * the limit. Registered outside the FileInterceptor so it can observe the
 * error the inner interceptor throws.
 */
@Injectable()
export class XlsxUploadErrorInterceptor implements NestInterceptor {
  constructor(private readonly limitMb: number) {}

  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next
      .handle()
      .pipe(
        catchError((error: unknown) =>
          throwError(() =>
            error instanceof PayloadTooLargeException
              ? xlsxFileTooLargeException(this.limitMb)
              : error,
          ),
        ),
      );
  }
}
