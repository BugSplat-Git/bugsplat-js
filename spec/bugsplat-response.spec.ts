import { validateResponseBody } from '../src/bugsplat-response';

describe('validateResponseBody', () => {
    it('should return true for valid response bodies', () => {
        const responseBodies = [
            {
                status: 'success',
                current_server_time: 12,
                message: 'message 1',
                url: 'osaiujdhfihfju',
                crash_id: 9,
            },
            {
                status: 'fail',
                current_server_time: 24,
                message: 'message 2',
                url: 'http://example.com',
                crash_id: 100,
            },
            {
                status: 'success',
                current_server_time: -100,
                message: 'message 3',
                url: 'http://bugsplat.com/rocks',
                crash_id: 333,
            },
        ];

        responseBodies.forEach((body) => {
            expect(validateResponseBody(body)).toBeTrue();
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
                current_server_time: 12,
                message: 'message 1',
                url: 'osaiujdhfihfju',
                crash_id: 9,
            },
            {
                status: 'fail',
                current_server_time: 24,
                message: 'message 2',
                url: new Date(),
                crash_id: 100,
            },
            {
                current_server_time: -100,
                message: 'message 3',
                url: 'http://bugsplat.com/rocks',
                crash_id: 333,
            },
            {
                status: 'success',
                message: 'message 3',
                url: 'http://bugsplat.com/rocks',
                crash_id: 333,
            },
            {
                status: 'success',
                current_server_time: -100,
                url: 'http://bugsplat.com/rocks',
                crash_id: 333,
            },
            {
                status: 'success',
                current_server_time: -100,
                message: 'message 3',
                crash_id: 333,
            },
            {
                status: 'success',
                current_server_time: -100,
                message: 'message 3',
                url: 'http://bugsplat.com/rocks',
            },
        ];

        responseBodies.forEach((body) => {
            expect(validateResponseBody(body)).toBeFalse();
        });
    });
});
