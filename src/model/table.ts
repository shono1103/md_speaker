import { getTableCellText } from '../dom/extract';
import { splitShort } from '../text/split';
import type { HeadingEntry } from './headings';
import { makeUnit, type ReadUnit } from './unit';

/**
 * 表を読み上げ単位へ変換する。
 *
 * 表全体を先に文字列化するのではなく、generator で
 * 必要になった 1 行だけ変換する（先読みを軽く保つため）。
 */
export function* readTableUnits(
  table: HTMLTableElement,
  section: HeadingEntry | null,
): Generator<ReadUnit> {
  const rows = [...table.querySelectorAll<HTMLTableRowElement>('tr')];

  if (rows.length === 0) {
    return;
  }

  yield makeUnit('表を読み上げます。', section);

  const firstRow = rows[0]!;
  const firstCells = [...firstRow.querySelectorAll<HTMLElement>('th, td')];

  const hasHeader = firstRow.querySelectorAll('th').length > 0;
  const headers = firstCells.map(getTableCellText);

  // ヘッダー行はデータ行としては読まない
  const startIndex = hasHeader ? 1 : 0;

  for (let rowIndex = startIndex; rowIndex < rows.length; rowIndex++) {
    const cells = [...rows[rowIndex]!.querySelectorAll<HTMLElement>('th, td')].map(
      getTableCellText,
    );

    if (cells.length === 0) {
      continue;
    }

    const parts: string[] = [];

    for (let columnIndex = 0; columnIndex < cells.length; columnIndex++) {
      const value = cells[columnIndex]!;

      if (!value) {
        continue;
      }

      const header = headers[columnIndex];

      if (hasHeader && header && header !== value) {
        parts.push(`${header}は、${value}`);
      } else {
        parts.push(value);
      }
    }

    if (parts.length === 0) {
      continue;
    }

    const rowText = `${parts.join('。')}。`;

    // 1 行が長すぎる場合はその行だけさらに分割
    for (const chunk of splitShort(rowText)) {
      yield makeUnit(chunk, section);
    }
  }

  yield makeUnit('表は以上です。', section);
}
