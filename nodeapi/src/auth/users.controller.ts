import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from 'src/auth/entities/user.entity';
import { UserService } from './users.service';
import {
    InviteUserDto,
    ListUserQuery,
    ProfileCustomerUserDto,
} from './dto/user.dto';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { RoleType } from './entities/user_roles.entity';
import { RolesGuard } from './guards/roles.guard';

@ApiTags('User')
@Controller('users')
@UseGuards(RolesGuard)
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Get()
    @Roles(RoleType.CUSTOMER_ADMIN, RoleType.SUPER_ADMIN)
    async listUsers(
        @Query() listUserQuery: ListUserQuery,
        @CurrentUser() user: User,
    ) {
        return await this.userService.listUsers(user, listUserQuery);
    }

    @Post('invite-user')
    @Roles(RoleType.CUSTOMER_ADMIN)
    async inviteUser(
        @Body() inviteUserDto: InviteUserDto,
        @CurrentUser() user: User,
    ) {
        return await this.userService.inviteUser(user, inviteUserDto);
    }

    @Post('verify-invite-user')
    @Public()
    async verifyProfileDetails(@Body() inviteDetails: ProfileCustomerUserDto) {
        return await this.userService.updateProfileForCustomerUser(
            inviteDetails,
        );
    }

    @Delete(':id')
    @Roles(RoleType.CUSTOMER_ADMIN, RoleType.SUPER_ADMIN)
    async deleteUser(@Param('id') id: string) {
        return await this.userService.deleteUser(id);
    }

    @Patch(':id/activate')
    @Roles(RoleType.SUPER_ADMIN)
    async activateUser(@Param('id') id: string) {
        return await this.userService.activateUser(id);
    }

    @Patch(':id/deactivate')
    @Roles(RoleType.SUPER_ADMIN)
    async deactivateUser(@Param('id') id: string) {
        return await this.userService.deactivateUser(id);
    }
}
