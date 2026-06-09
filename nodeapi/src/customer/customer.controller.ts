import { Body, Controller, Get, Param, Patch, Put, Query, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { ListCustomerQuery, UpdateCustomerDto } from "./dto/customers.dto";
import { ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { RolesGuard } from "src/auth/guards/roles.guard";
import { Roles } from "src/auth/decorators/roles.decorator";
import { RoleType } from "src/auth/entities/user_roles.entity";
import { CustomerService } from "./customer.service";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
import { CurrentUser } from "src/auth/decorators/current-user.decorator";
import { User } from "src/auth/entities/user.entity";

@Controller('customers')
@ApiTags('Customers')
@UseGuards(RolesGuard)

export class CustomerController {
    constructor(private readonly customerService: CustomerService) { }

    @Get('')
    @Roles(RoleType.SUPER_ADMIN)
    async listCustomers(@Query() q: ListCustomerQuery) {
        return await this.customerService.listCustomers(q);
    }

    @Put(':id')
    @Roles(RoleType.SUPER_ADMIN)
    async updateCustomer(@Body() b: UpdateCustomerDto, @Param('id') id: string) {
        return await this.customerService.updateCustomer(b, id);
    }

    @Patch('update-current-user-company')
    @Roles(RoleType.CUSTOMER_ADMIN)
    async updateOwnDetailOnly(@Body() b: UpdateCustomerDto, @CurrentUser() user: User) {
        return await this.customerService.updateOwnDetail(b, user);
    }

    @Get(':id')
    @Roles(RoleType.SUPER_ADMIN, RoleType.CUSTOMER_ADMIN)
    async getCustomer(@Param('id') id: string) {
        return await this.customerService.getCustomer(id);
    }

    @Roles(RoleType.CUSTOMER_ADMIN, RoleType.SUPER_ADMIN)
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: './uploads/logo',
            filename: (req, file, cb) => {
                const uniqueSuffix =
                    Date.now() + '-' + Math.round(Math.random() * 1e9);

                cb(
                    null,
                    `logo-${uniqueSuffix}${extname(file.originalname)}`,
                );
            },
        }),
    }))
    @Patch(':id/upload-company-logo')
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
    uploadCompanyLogo(
        @UploadedFile() file: Express.Multer.File,
        @Param('id') id: string,
    ) {
        return this.customerService.uploadCompanyLogo(file, id);
    }

}