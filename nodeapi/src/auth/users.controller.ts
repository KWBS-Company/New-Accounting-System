import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import {
    ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from 'src/auth/entities/user.entity';
import { UsersService } from './users.service';
import { InviteUserDto, ListUserQuery, ProfileCustomerUserDto } from './dto/user.dto';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { RoleType } from './entities/user_roles.entity';
import { RolesGuard } from './guards/roles.guard';

@ApiTags('User')
@Controller('users')
@UseGuards(RolesGuard)
@Roles(RoleType.CUSTOMER_ADMIN, RoleType.SUPER_ADMIN)
export class UserController {
    constructor(private readonly userService: UsersService) { }

    @Get()
    async listUsers(@Query() listUserQuery: ListUserQuery, @CurrentUser() user: User) {
        return await this.userService.listUsers(user, listUserQuery);
    }

    @Post('invite-user')
    async inviteUser(@Body() inviteUserDto: InviteUserDto, @CurrentUser() user: User) {
        return await this.userService.inviteUser(user, inviteUserDto);
    }

    @Post('verify-invite-user')
    @Public()
    async verifyProfileDetails(@Body() inviteDetails: ProfileCustomerUserDto) {
        return await this.userService.updateProfileForCustomerUser(inviteDetails);
    }

    @Delete(':id')
    async deleteUser(@Param('id') id: string) {
        return await this.userService.deleteUser(id);
    }

}
