import { beforeEach, describe, expect, it } from 'vitest';
import { evaluateFormula } from '../src/scoring/formula';

function setScore(id: number, value: number | string): void {
  const existing = document.getElementById(`score${id}`);
  if (existing) existing.remove();
  const select = document.createElement('select');
  select.id = `score${id}`;
  const opt = document.createElement('option');
  opt.value = String(value);
  select.appendChild(opt);
  select.value = String(value);
  document.body.appendChild(select);
}

describe('evaluateFormula', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns 0 for an empty formula', () => {
    expect(evaluateFormula('', {})).toBe(0);
  });

  it('evaluates a single integer', () => {
    expect(evaluateFormula('42', {})).toBe(42);
  });

  it('evaluates a decimal', () => {
    expect(evaluateFormula('3.25', {})).toBe(3.25);
  });

  it('evaluates addition and subtraction left-to-right', () => {
    expect(evaluateFormula('10 - 3 + 2', {})).toBe(9);
  });

  it('evaluates multiplication and division left-to-right', () => {
    expect(evaluateFormula('12 / 4 * 2', {})).toBe(6);
  });

  it('applies standard operator precedence', () => {
    expect(evaluateFormula('1 + 2 * 3', {})).toBe(7);
    expect(evaluateFormula('(1 + 2) * 3', {})).toBe(9);
  });

  it('resolves context variables', () => {
    expect(evaluateFormula('x + y', { x: 5, y: 7 })).toBe(12);
  });

  it('returns 0 for unknown context variables', () => {
    expect(evaluateFormula('z', {})).toBe(0);
  });

  it('reads score(n) from the DOM', () => {
    setScore(1, 4);
    setScore(2, 3);
    expect(evaluateFormula('score(1) + score(2)', {})).toBe(7);
  });

  it('returns 0 for a score element that does not exist', () => {
    expect(evaluateFormula('score(99)', {})).toBe(0);
  });

  it('evaluates a preseed-style weighted total', () => {
    // Drawn from public/conf/preseed.json UnlostScore.total
    const context = { Product: 5, Market: 3, Progress: 4, Team: 5 };
    const total = 'Product * 3/10 + Market * 1/5 + Progress * 1/5 + Team * 3/10';
    expect(evaluateFormula(total, context)).toBeCloseTo(4.4, 5);
  });

  it('treats unknown function calls as 0', () => {
    expect(evaluateFormula('unknown(1) + 5', {})).toBe(5);
  });
});
