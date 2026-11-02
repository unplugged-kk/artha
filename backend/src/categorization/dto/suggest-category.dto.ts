import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { SanitizeHtml } from "../../common/decorators/sanitize-html.decorator";

export class SuggestCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @SanitizeHtml()
  payee: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(750)
  @SanitizeHtml()
  memo?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;
}
