import test from 'node:test';
import assert from 'node:assert/strict';

test('Simulated Google Sheets Slot Allocation Logic', () => {
  // Simulate sheet rows where A, G, H have formulas and B:F are initially blank
  const headers = ['Sl No', 'Name', 'USN', 'DOB', 'Questions to Senior', 'Message / Advice to Junior', 'Batch', 'Semester'];
  const mockSheetRows = [
    headers,
    ['=formulaA', '', '', '', '', '', '=formulaG', '=formulaH'], // Row 2: empty
    ['=formulaA', '', '', '', '', '', '=formulaG', '=formulaH'], // Row 3: empty
    ['=formulaA', '', '', '', '', '', '=formulaG', '=formulaH'], // Row 4: empty
  ];

  const positions = { name: 1, usn: 2, dob: 3, questionsSenior: 4, adviceJunior: 5 };

  function allocateNextRow(sheetDataRows, student) {
    const normalUsn = (val) => String(val || '').replace(/\s+/g, '').toUpperCase();
    if (sheetDataRows.some((r) => normalUsn(r[positions.usn]) === student.usn)) {
      return { alreadyExists: true };
    }
    const emptyRowIndex = sheetDataRows.findIndex((r) => !normalUsn(r[positions.usn]));
    const nextRowNumber = emptyRowIndex >= 0 ? emptyRowIndex + 2 : sheetDataRows.length + 2;
    return { nextRowNumber, alreadyExists: false };
  }

  // Submission 1: Should target row 2
  const sub1 = { name: 'Student 1', usn: '4DM24AI001' };
  const res1 = allocateNextRow(mockSheetRows.slice(1), sub1);
  assert.equal(res1.nextRowNumber, 2);
  assert.equal(res1.alreadyExists, false);

  // Apply Submission 1 to row 2 (only cols B:F)
  mockSheetRows[1][1] = sub1.name;
  mockSheetRows[1][2] = sub1.usn;

  // Verify Col A, G, H were not overwritten
  assert.equal(mockSheetRows[1][0], '=formulaA');
  assert.equal(mockSheetRows[1][6], '=formulaG');
  assert.equal(mockSheetRows[1][7], '=formulaH');

  // Submission 2 (duplicate): Should detect existing
  const resDup = allocateNextRow(mockSheetRows.slice(1), sub1);
  assert.equal(resDup.alreadyExists, true);

  // Submission 3: Should target row 3
  const sub2 = { name: 'Student 2', usn: '4DM24AI002' };
  const res2 = allocateNextRow(mockSheetRows.slice(1), sub2);
  assert.equal(res2.nextRowNumber, 3);
  assert.equal(res2.alreadyExists, false);

  // Apply Submission 3 to row 3
  mockSheetRows[2][1] = sub2.name;
  mockSheetRows[2][2] = sub2.usn;

  // Submission 4: Should target row 4
  const sub3 = { name: 'Student 3', usn: '4DM24AI003' };
  const res3 = allocateNextRow(mockSheetRows.slice(1), sub3);
  assert.equal(res3.nextRowNumber, 4);
});
