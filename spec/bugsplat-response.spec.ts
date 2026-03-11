import { describe, it, expect } from 'vitest';
import { validateResponseBody } from '../src/bugsplat-response';

describe('validateResponseBody', () => {
    it('should return true for valid response bodies', () => {
        const responseBodies = [
            {
                status: 'success',
                crashId: 9,
                stackKeyId: 1,
                messageId: 1,
                infoUrl: 'https://app.bugsplat.com/browse/crashInfo.php',
            },
            {
                status: 'fail',
                crashId: 100,
                stackKeyId: 55,
                messageId: 200,
                infoUrl: 'https://app.bugsplat.com/browse/crashInfo.php?id=100',
            },
            {
                status: 'success',
                crashId: 333,
                stackKeyId: 0,
                messageId: 0,
                infoUrl: 'https://app.bugsplat.com/browse/crashInfo.php?id=333',
            },
            {
                status: 'success',
                crashId: 21417,
                stackKeyId: -1,
                messageId: -1,
            },
        ];

        responseBodies.forEach((body) => {
            expect(validateResponseBody(body)).toBe(true);
        });
    });

    it('should return false for invalid response bodies', () => {
        const responseBodies = [
            null,
            undefined,
            '',
            2013,
            {},
            {
                status: 'succes',
                crashId: 9,
                stackKeyId: 1,
                messageId: 1,
                infoUrl: 'https://app.bugsplat.com',
            },
            {
                status: 'success',
                stackKeyId: 1,
                messageId: 1,
                infoUrl: 'https://app.bugsplat.com',
            },
            {
                status: 'success',
                crashId: 9,
                messageId: 1,
                infoUrl: 'https://app.bugsplat.com',
            },
            {
                status: 'success',
                crashId: 9,
                stackKeyId: 1,
                infoUrl: 'https://app.bugsplat.com',
            },
            {
                status: 'success',
                crashId: 9,
                stackKeyId: 1,
                messageId: 1,
                infoUrl: 42,
            },
        ];

        responseBodies.forEach((body) => {
            expect(validateResponseBody(body)).toBe(false);
        });
    });
});
