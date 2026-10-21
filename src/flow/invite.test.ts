import { describe, expect, it } from 'vitest';
import { inviteUrl, parseRoomParam } from './invite';
import { CODE_LETTERS, CODE_LENGTH } from '../net/protocol';

const good = CODE_LETTERS.slice(0, CODE_LENGTH);

describe('invite links', () => {
  it('reads ?room=CODE, any case', () => {
    expect(parseRoomParam(`?room=${good}`)).toBe(good);
    expect(parseRoomParam(`?x=1&room=${good.toLowerCase()}`)).toBe(good);
  });
  it('ignores missing or malformed codes', () => {
    expect(parseRoomParam('')).toBeNull();
    expect(parseRoomParam('?room=')).toBeNull();
    expect(parseRoomParam('?room=AB')).toBeNull();
    expect(parseRoomParam('?room=<script>')).toBeNull();
    expect(parseRoomParam(`?room=${good}Z9`)).toBeNull();
  });
  it('builds the link from the page address', () => {
    expect(inviteUrl(good, 'https://game.example/play/?room=OLD#dev')).toBe(`https://game.example/play/?room=${good}`);
  });
});
