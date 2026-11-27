import type { TextFitStyle } from "@andornaut/game-kit/runtime/text/textFit";

import type { DogId } from "../data/ids.ts";
import type { GameData } from "../data/index.ts";
import { type NameData, type NameMark, pilled } from "../presentation/index.ts";

interface NameSpan {
  readonly at: number;
  readonly length: number;
}

// Names and the heart values that immediately follow them wrap as one phrase.
export interface NoticeText {
  readonly marks?: readonly NameSpan[];
  readonly text: string;
}

export function ownerNameText(data: Pick<GameData, "dogs">, dog: DogId): NoticeText {
  const text = data.dogs[dog].owner.name;
  return { marks: [{ at: 0, length: text.length }], text };
}

// Fill authored fields and move any owner name marks with their text.
export function fillNoticeText(
  line: string,
  values: Readonly<Record<string, NoticeText | string>>,
): NoticeText {
  const marks: NameSpan[] = [];
  let text = "";
  let from = 0;
  for (const match of line.matchAll(/\{(\w+)\}/g)) {
    const value = values[match[1] ?? ""];
    if (value === undefined) {
      continue;
    }
    text += line.slice(from, match.index);
    const filled = typeof value === "string" ? { text: value } : value;
    marks.push(...(filled.marks ?? []).map((mark) => ({ ...mark, at: mark.at + text.length })));
    text += filled.text;
    from = match.index + match[0].length;
  }
  text += line.slice(from);
  return marks.length === 0 ? { text } : { marks, text };
}

export interface NoticeRow {
  readonly text: string;
  readonly width: number;
}

const NAME_CHANGE = /^ [+\-−]\d+♥/u;

function words(line: NoticeText): string[] {
  const spans = (line.marks ?? []).map(({ at, length }) => {
    const end = at + length;
    const change = NAME_CHANGE.exec(line.text.slice(end))?.[0].length ?? 0;
    return { at, end: end + change };
  });
  const result: string[] = [];
  let start = 0;
  for (const space of line.text.matchAll(/\s/gu)) {
    const at = space.index;
    if (spans.some((span) => at >= span.at && at < span.end)) {
      continue;
    }
    if (at > start) {
      result.push(line.text.slice(start, at));
    }
    start = at + space[0].length;
  }
  if (start < line.text.length) {
    result.push(line.text.slice(start));
  }
  return result;
}

// Fill each row to the measured width. An indivisible phrase may take a row of its own.
export function noticeRows(
  width: (text: string) => number,
  room: number,
  line: NoticeText,
): NoticeRow[] {
  const rows: NoticeRow[] = [];
  let row: NoticeRow | undefined;
  for (const word of words(line)) {
    const text = row === undefined ? word : `${row.text} ${word}`;
    const measured = width(text);
    if (row !== undefined && measured > room) {
      rows.push(row);
      row = { text: word, width: width(word) };
    } else {
      row = { text, width: measured };
    }
  }
  if (row !== undefined) {
    rows.push(row);
  }
  return rows;
}

export function styledNoticeRows(
  style: TextFitStyle,
  width: (style: TextFitStyle, text: string) => number,
  room: number,
  line: NoticeText,
): NoticeRow[] {
  return noticeRows((text) => width(style, text), (style.lines ?? 1) === 1 ? Infinity : room, line);
}

// Set effect names in their existing pills and keep the owner spans on the modified line.
export function noticeTextWithNamePills(
  data: NameData,
  line: NoticeText & { readonly names?: readonly NameMark[] },
): NoticeText {
  const { moved, text } = pilled(data, line.text, line.names ?? []);
  const marks = line.marks?.map(({ at, length }) => ({
    at: moved(at),
    length: moved(at + length) - moved(at),
  }));
  return marks === undefined ? { text } : { marks, text };
}
