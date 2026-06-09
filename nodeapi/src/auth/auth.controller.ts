import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import {
  LoginDto,
  ResendVerificationDto,
  VerifyEmailDto,
} from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from 'src/auth/entities/user.entity';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/forgot_password.dto';
import { ChangePasswordDto } from './dto/change_password.dto';
import { ProfileDto } from './dto/profile.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { diskStorage } from 'multer';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return { message: result.message, data: { userId: result.userId } };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in and receive an access token' })
  @ApiResponse({ status: 200, description: 'Logged in successfully' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    return { message: 'Login successful', data: result };
  }

  @Public()
  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email using token from email link' })
  async verifyEmail(@Query() dto: VerifyEmailDto) {
    const result = await this.authService.verifyEmail(dto.token);
    return { message: result.message, data: null };
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend email verification link' })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    const result = await this.authService.resendVerification(dto.email);
    return { message: result.message, data: null };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current authenticated user' })
  async me(@CurrentUser() user: User) {
    const { password, ...safe } = user as any;
    return { message: 'Current user', data: safe };
  }

  @Post('/forgot-password')
  @Public()
  @ApiBody({ type: ForgotPasswordDto })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return await this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('/reset-password')
  @Public()
  @ApiBody({ type: ResetPasswordDto })
  async resetPasswordDto(@Body() resetPasswordDto: ResetPasswordDto) {
    return await this.authService.resetPassword(resetPasswordDto);
  }


  @Post('/change-password')
  @ApiBody({ type: ChangePasswordDto })
  async updatePassword(@Body() changePasswordDto: ChangePasswordDto, @CurrentUser() user: User) {
    return await this.authService.changePassword(user, changePasswordDto);
  }

  @Patch('/profile')
  @ApiBody({ type: ProfileDto })
  async updateProfile(@Body() profileDto: ProfileDto, @CurrentUser() user: User) {
    return await this.authService.updateProfile(user, profileDto);
  }

  @UseInterceptors(FileInterceptor('file',{
    storage: diskStorage({
      destination: './uploads/profile-pic',
      filename: (req, file, cb) => {
        const uniqueSuffix =
          Date.now() + '-' + Math.round(Math.random() * 1e9);

        cb(
          null,
          `profile-${uniqueSuffix}${extname(file.originalname)}`,
        );
      },
    }),
  }))
  @Post('avatar')
  @ApiConsumes('multipart/form-data') // <— tells Swagger it's multipart
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  uploadProfilePicture(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    return this.authService.uploadProfilePicture(file, user);
  }


}
