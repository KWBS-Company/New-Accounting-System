import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { compare, hash } from 'bcrypt';
import { v4, validate, version } from 'uuid';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { compile } from 'handlebars';
import * as Handlebars from 'handlebars';
// import { launch } from 'puppeteer';

@Injectable()
export class CommonService {
    private encryptionAlgorithm: string;
    private secretKey: Buffer;
    private iv: Buffer;
    private logger = new Logger(CommonService.name);
    constructor(private readonly configService: ConfigService) {
        this.encryptionAlgorithm =
            this.configService.getOrThrow<string>('encryption.encryptionAlgorithm');
        const encryptionKey = this.configService.getOrThrow<string>('encryption.encryptionKey');
        const encryptionIv = this.configService.getOrThrow<string>('encryption.encryptionInitializationVector');
        this.secretKey = createHash('sha256').update(encryptionKey, 'utf8').digest();
        this.iv = createHash('sha256').update(encryptionIv, 'utf8').digest().subarray(0, 16);
    }

    encrypt(body: string) {
        const cipher = createCipheriv(
            this.encryptionAlgorithm,
            this.secretKey,
            this.iv,
        );
        let encrypted = cipher.update(body, 'utf-8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }

    decrypt(encryptedData: string) {
        const decipher = createDecipheriv(
            this.encryptionAlgorithm,
            this.secretKey,
            this.iv,
        );
        let decrypted = decipher.update(encryptedData, 'hex', 'utf-8');
        decrypted += decipher.final('utf-8');
        return decrypted;
    }

    async compareHash(data: string, hashedData: string): Promise<boolean> {
        return await compare(data, hashedData);
    }

    async hash(data: string, saltRound: number): Promise<string> {
        const hashedData = await hash(data, saltRound);
        return hashedData;
    }

    genUUID() {
        return v4();
    }

    validateUUID(id: string) {
        return validate(id) && version(id) === 4;
    }

    sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    formatDateInMMDDYYYY(date: Date): string {
        const d = new Date(date);
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const year = d.getFullYear();
        return `${month}/${day}/${year}`;
    }

    capitalize(word: string) {
        if (!word) return '';
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }

    async generateTemplate(templatePath: string, context: Record<string, any>) {
        try {
            const fullPath = join(__dirname, 'templates', templatePath);
            const data = await readFile(fullPath, 'utf8');
            // Register once at module/service level — outside the method
            Handlebars.registerHelper('formatDate', (val) =>
                val ? new Date(val).toLocaleDateString() : '-',
            );

            Handlebars.registerHelper('formatAmount', (val) =>
                Number(val || 0).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                }),
            );

            Handlebars.registerHelper('ifZero', function (val, options) {
                return Number(val) === 0
                    ? options.fn(this)
                    : options.inverse(this);
            });

            const template = compile(data);
            const html = template(context);
            return html;
        } catch (error) {
            this.logger.error(`Failed to generate template: ${templatePath}`, error);
            throw error;
        }
    }

    // async pdfGenerateByHtml(content: string) {
    //     const browser = await launch({
    //         executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    //         args: [
    //             '--no-sandbox',
    //             '--disable-setuid-sandbox',
    //             '--disable-dev-shm-usage',
    //             '--disable-gpu',
    //         ],
    //         headless: true,
    //     });

    //     const page = await browser.newPage();
    //     await page.setContent(content);
    //     await page.emulateMediaType('screen');
    //     const pdf = await page.pdf({
    //         format: 'a4',
    //         printBackground: true,
    //         margin: {
    //             top: '50px',
    //             right: '30px',
    //             bottom: '50px',
    //             left: '30px',
    //         },
    //     });
    //     await browser.close();
    //     return pdf;
    // }

    getFiscalYearDates(fiscalStartDate: Date) {
        const startDate = new Date(fiscalStartDate);
        // End date = 1 year
        const endDate = new Date(startDate);
        endDate.setFullYear(endDate.getFullYear() + 1);
        endDate.setDate(endDate.getDate());

        return {
            startDate,
            endDate,
            name: `FY ${startDate.getFullYear()}/${String(endDate.getFullYear()).slice(-2)}`
        };
    }

    getStartDateForNextFiscalYr(fiscalYrEndDate: Date) {
        const startDate = new Date(fiscalYrEndDate);
        startDate.setDate(startDate.getDate() + 1);

        return startDate;
    }

    generateSalt() {
        return Math.floor(Math.random() * 20) + 1;
    }

    isWithinFiscalYear(
        transactionDate: Date,
        fiscalStartDate: Date,
        fiscalEndDate: Date,
    ): boolean {
        const tx = new Date(transactionDate);
        const start = new Date(fiscalStartDate);
        const end = new Date(fiscalEndDate);

        // normalize time (important to avoid edge issues)
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return tx >= start && tx <= end;
    }
}
