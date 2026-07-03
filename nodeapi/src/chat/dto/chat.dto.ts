import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class ChatDto {
    @IsString()
    @IsNotEmpty()
    question: string;

    @IsString()
    @IsOptional()
    model: string;

    @IsUUID()
    @IsOptional()
    @Transform(({ value }: { value: unknown }) => {
        if (typeof value !== 'string') return value; // keep non-string values as-is
        const trimmed = value.trim();
        return trimmed === '' ? undefined : trimmed;
    })
    chatId: string;
}

export class ChatTitleDto {
    @IsString()
    title: string;

    @IsUUID()
    chatId: string;
}
