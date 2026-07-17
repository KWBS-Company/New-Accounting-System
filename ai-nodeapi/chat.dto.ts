import {
    IsArray,
    IsEmail,
    IsOptional,
    IsString,
    ValidateNested,
    IsEnum,
    IsBoolean,
    IsNotEmpty,
  } from 'class-validator';
  import { Type } from 'class-transformer';
  
  export enum ChatRole {
    SYSTEM = 'system',
    USER = 'user',
    ASSISTANT = 'assistant',
    TOOL = 'tool',
  }
  
  export class ChatMessageDto {
    @IsEnum(ChatRole)
    @IsNotEmpty()
    role: ChatRole;
  
    @IsString()
    content: string;
  }
  
  export class UserInfoDto {
    @IsEmail()
    email: string;
  
    @IsOptional()
    @IsString()
    customerId?: string;
  
    @IsString()
    companyId: string;
  
    @IsString()
    companyName: string;
  
    @IsString()
    fullName: string;
  }
  
  export class ChatDto {
    @IsString()
    model: string;
  
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ChatMessageDto)
    messages: ChatMessageDto[];
  
    @ValidateNested()
    @Type(() => UserInfoDto)
    userInfo: UserInfoDto;
  
    @IsOptional()
    @IsBoolean()
    stream?: boolean;
  }