import { describe, it, expect } from 'vitest';
import { validateResponseBody } from '../src/bugsplat-response';

describe('validateResponseBody', () => {
    it('should return true for valid response bodies', () => {
        const responseBodies = [
            {
                status: 'success',
                current_server_time: 1,
                message: 'BugSplat rocks!',
                url: 'bugsplat.rocks/yes-its-true',
                crash_id: 9,
            },
            {
                status: 'fail',
                current_server_time: 100,
                message: 'Something went wrong',
                crash_id: 100,
            },
            {
                status: 'success',
                current_server_time: 0,
                message: '',
                url: 'https://app.bugsplat.com/browse/crashInfo.php',
                crash_id: 333,
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
                current_server_time: 1,
                message: 'msg',
                crash_id: 9,
            },
            {
                status: 'success',
                message: 'msg',
                crash_id: 9,
            },
            {
                status: 'success',
                current_server_time: 1,
                crash_id: 9,
            },
            {
                status: 'success',
                current_server_time: 1,
                message: 'msg',
            },
            {
                status: 'success',
                current_server_time: 1,
                message: 'msg',
                crash_id: 9,
                url: 42,
            },
        ];

        responseBodies.forEach((body) => {
            expect(validateResponseBody(body)).toBe(false);
        });
    });
});
