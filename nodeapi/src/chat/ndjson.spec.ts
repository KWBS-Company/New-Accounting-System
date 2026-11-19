import { splitNdjson } from './ndjson';

describe('splitNdjson', () => {
    it('returns complete lines and keeps the partial remainder', () => {
        expect(splitNdjson('{"a":1}\n{"b":2}\n{"c"')).toEqual({
            lines: ['{"a":1}', '{"b":2}'],
            rest: '{"c"',
        });
    });
    it('skips blank lines', () => {
        expect(splitNdjson('\n{"a":1}\n\n')).toEqual({ lines: ['{"a":1}'], rest: '' });
    });
});
