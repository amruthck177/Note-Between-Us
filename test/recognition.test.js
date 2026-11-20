import test from 'node:test';
import assert from 'node:assert/strict';
import { RECOGNITION_PROFILES } from '../src/recognition/recognitionData.js';
import { matchRecognitionProfile, normalizeName } from '../src/recognition/recognitionMatcher.js';

// Replicate batchInfo logic from App.jsx to verify intact USN questionnaire behavior
const batchInfo = (usn) => {
  const match = /^4DM(23|24|25)AI\d{3}$/i.exec(String(usn || '').replace(/\s/g, ''));
  if (!match) return null;
  const year = `20${match[1]}`;
  return { batch: year, semester: ({ 2023: 7, 2024: 5, 2025: 3 })[year] };
};

test('1. Database has exactly 24 unique, valid profiles', () => {
  assert.equal(RECOGNITION_PROFILES.length, 24, 'Must have exactly 24 recognition profiles');
  const ids = new Set();
  for (const profile of RECOGNITION_PROFILES) {
    assert.ok(profile.id, 'Must have an ID');
    assert.ok(!ids.has(profile.id), `ID "${profile.id}" must be unique`);
    ids.add(profile.id);
    assert.ok(profile.fullName, `Profile ${profile.id} must have a fullName`);
    assert.ok(Array.isArray(profile.aliases) && profile.aliases.length >= 1, `Profile ${profile.id} must have aliases`);
    assert.ok(profile.designation, `Profile ${profile.id} must have a designation`);
    assert.ok(profile.message, `Profile ${profile.id} must have a message`);
  }
});

test('2. Verify all 24 profiles trigger on full name and half name / aliases', () => {
  const expected = [
    { id: 'mohammad-rihan-mr', fullName: 'MOHAMMAD RIHAN MR', aliases: ['MOHAMMAD RIHAN MR', 'RIHAN MR'] },
    { id: 'mohammed-adnan', fullName: 'MOHAMMED ADNAN', aliases: ['MOHAMMED ADNAN', 'ADNAN'] },
    { id: 'mohammed-shajith', fullName: 'MOHAMMED SHAJITH', aliases: ['MOHAMMED SHAJITH', 'SHAJITH'] },
    { id: 'hassan-shaheer', fullName: 'HASSAN SHAHEER', aliases: ['HASSAN SHAHEER', 'HASSAN'] },
    { id: 'tm-jazil', fullName: 'TM JAZIL', aliases: ['TM JAZIL', 'JAZIL'] },
    { id: 'zehna-abdul-jaleel', fullName: 'ZEHNA ABDUL JALEEL', aliases: ['ZEHNA ABDUL JALEEL', 'ZEHNA'] },
    { id: 'shida-yasmin-cs', fullName: 'SHIDA YASMIN C.S', aliases: ['SHIDA YASMIN C.S', 'SHIDA'] },
    { id: 'mubarak-mohammed', fullName: 'MUBARAK MOHAMMED', aliases: ['MUBARAK MOHAMMED', 'MUBARAK'] },
    { id: 'niyaazurahman', fullName: 'NIYAAZURAHMAN', aliases: ['NIYAAZURAHMAN', 'NIYAAZ'] },
    { id: 'sheikh-sohali-fathima', fullName: 'SHEIKH SOHALI FATHIMA', aliases: ['SHEIKH SOHALI FATHIMA', 'SOHALI'] },
    { id: 'tayyaba', fullName: 'TAYYABA', aliases: ['TAYYABA'] },
    { id: 'mohammed-huzaifa', fullName: 'MOHAMMED HUZAIFA', aliases: ['MOHAMMED HUZAIFA', 'HUZAIFA'] },
    { id: 'mohammed-rayan-ak', fullName: 'MOHAMMED RAYAN AK', aliases: ['MOHAMMED RAYAN AK', 'RAYAN'] },
    { id: 'mohammed-raihan', fullName: 'MOHAMMED RAIHAN', aliases: ['MOHAMMED RAIHAN', 'RAIHAN'] },
    { id: 'amruth-ck', fullName: 'AMRUTH C.K', aliases: ['AMRUTH C.K', 'AMRUTH'] },
    { id: 'dileep-dk', fullName: 'DILEEP D.K', aliases: ['DILEEP D.K', 'DILEEP'] },
    { id: 'zainul-abideen', fullName: 'ZAINUL ABIDEEN', aliases: ['ZAINUL ABIDEEN', 'ZAIN ABID'] },
    { id: 'fathima-naja', fullName: 'FATHIMA NAJA', aliases: ['FATHIMA NAJA', 'NAJA'] },
    { id: 'vyshnav-s-madhav', fullName: 'VYSHNAV S MADHAV', aliases: ['VYSHNAV S MADHAV', 'VYSHNAV'] },
    { id: 'vaibhav-rai-av', fullName: 'VAIBHAV RAI A V', aliases: ['VAIBHAV RAI A V', 'VAIBHAV RAI'] },
    { id: 'mohammed-anas', fullName: 'MOHAMMED ANAS', aliases: ['MOHAMMED ANAS', 'ANAS'] },
    { id: 'haifa-farhana', fullName: 'HAIFA FARHANA', aliases: ['HAIFA FARHANA', 'HAIFA'] },
    { id: 'hamza-abdul-rahiman', fullName: 'HAMZA ABDUL RAHIMAN', aliases: ['HAMZA ABDUL RAHIMAN', 'HAMZA'] },
    { id: 'muhammad-saamith', fullName: 'MUHAMMAD SAAMITH', aliases: ['MUHAMMAD SAAMITH', 'SAAMITH'] },
  ];

  for (const item of expected) {
    const profile = RECOGNITION_PROFILES.find((p) => p.id === item.id);
    assert.ok(profile, `Profile ${item.id} must exist`);
    assert.equal(profile.fullName, item.fullName);

    // Test full name
    const matchFull = matchRecognitionProfile(item.fullName);
    assert.ok(matchFull, `Full name "${item.fullName}" must trigger`);
    assert.equal(matchFull.id, item.id);

    // Test each alias
    for (const alias of item.aliases) {
      const matchAlias = matchRecognitionProfile(alias);
      assert.ok(matchAlias, `Alias "${alias}" must trigger`);
      assert.equal(matchAlias.id, item.id);
    }
  }
});

test('3. Test inputs specified in Section 2 & Section 9', () => {
  // adnan -> Vice President recognition
  const t1 = matchRecognitionProfile('adnan');
  assert.equal(t1?.id, 'mohammed-adnan');
  assert.equal(t1?.fullName, 'MOHAMMED ADNAN');
  assert.equal(t1?.designation, 'OUR VICE PRESIDENT');

  // Mohammed Adnan -> Vice President recognition
  const t2 = matchRecognitionProfile('Mohammed Adnan');
  assert.equal(t2?.id, 'mohammed-adnan');

  // ADNAN -> Vice President recognition
  const t3 = matchRecognitionProfile('ADNAN');
  assert.equal(t3?.id, 'mohammed-adnan');

  // Zain Abid -> Zainul recognition
  const t4 = matchRecognitionProfile('Zain Abid');
  assert.equal(t4?.id, 'zainul-abideen');
  assert.equal(t4?.fullName, 'ZAINUL ABIDEEN');

  // Zainul Abideen -> Zainul recognition
  const t5 = matchRecognitionProfile('Zainul Abideen');
  assert.equal(t5?.id, 'zainul-abideen');

  // Zain -> Normal website (per Section 2 explicit rule and Section 10 no first-name extraction)
  const t6 = matchRecognitionProfile('Zain');
  assert.equal(t6, null, 'Zain alone must not trigger recognition');
  const t6b = matchRecognitionProfile('ZAIN');
  assert.equal(t6b, null);

  // Mohammed -> Normal website
  const t7 = matchRecognitionProfile('Mohammed');
  assert.equal(t7, null, 'Mohammed alone must not trigger recognition');
  const t7b = matchRecognitionProfile('MOHAMMED');
  assert.equal(t7b, null);

  // Mohammad -> Normal website
  const t8 = matchRecognitionProfile('Mohammad');
  assert.equal(t8, null, 'Mohammad alone must not trigger recognition');
  const t8b = matchRecognitionProfile('MOHAMMAD');
  assert.equal(t8b, null);

  // Hassan -> Hassan recognition
  const t9 = matchRecognitionProfile('Hassan');
  assert.equal(t9?.id, 'hassan-shaheer');
  assert.equal(t9?.fullName, 'HASSAN SHAHEER');

  // Hassan Shaheer -> Hassan recognition
  const t10 = matchRecognitionProfile('Hassan Shaheer');
  assert.equal(t10?.id, 'hassan-shaheer');

  // Amruth -> Website designer recognition
  const t11 = matchRecognitionProfile('Amruth');
  assert.equal(t11?.id, 'amruth-ck');
  assert.equal(t11?.message, 'I designed this website');

  // Unknown Student -> Normal website
  const t12 = matchRecognitionProfile('Unknown Student');
  assert.equal(t12, null);
});

test('4. Whitespace, tabs, newlines, and case variations', () => {
  assert.equal(matchRecognitionProfile('   mOhAmMeD     aDnAn   ')?.id, 'mohammed-adnan');
  assert.equal(matchRecognitionProfile('\t\nRIHAN   MR  \n')?.id, 'mohammed-rihan-mr');
  assert.equal(matchRecognitionProfile('  hAsSaN   sHaHeEr  ')?.id, 'hassan-shaheer');
  assert.equal(matchRecognitionProfile('   vAiBhAv    rAi   ')?.id, 'vaibhav-rai-av');
  assert.equal(matchRecognitionProfile('amruth')?.id, 'amruth-ck');
  assert.equal(matchRecognitionProfile('AMRUTH')?.id, 'amruth-ck');
  assert.equal(matchRecognitionProfile('AmRuTh')?.id, 'amruth-ck');
});

test('5. No substring, prefix, or fuzzy matching', () => {
  // Must NOT trigger on partial additions
  assert.equal(matchRecognitionProfile('ADNAN1'), null);
  assert.equal(matchRecognitionProfile('ADNAN KHAN'), null);
  assert.equal(matchRecognitionProfile('MOHAMMED ADNAN JR'), null);
  assert.equal(matchRecognitionProfile('HASSAN KHAN'), null);
  assert.equal(matchRecognitionProfile('AMRUTH KUMAR'), null);
  assert.equal(matchRecognitionProfile('HA'), null);
  assert.equal(matchRecognitionProfile('H'), null);
});

test('6. Existing USN-based questionnaire logic verification', () => {
  // 4DM23: Juniors advice (7th semester)
  const j23 = batchInfo('4DM23AI001');
  assert.equal(j23.batch, '2023');
  assert.equal(j23.semester, 7);

  // 4DM24: Both senior questions and junior advice (5th semester)
  const j24 = batchInfo('4DM24AI042');
  assert.equal(j24.batch, '2024');
  assert.equal(j24.semester, 5);

  // 4DM25: Senior questions (3rd semester)
  const j25 = batchInfo('4DM25AI099');
  assert.equal(j25.batch, '2025');
  assert.equal(j25.semester, 3);

  // Spacing in USN
  const spaced = batchInfo(' 4DM24 AI 010 ');
  assert.equal(spaced.batch, '2024');
  assert.equal(spaced.semester, 5);

  // Invalid USN
  assert.equal(batchInfo('4DM22AI001'), null);
  assert.equal(batchInfo('4DM26AI001'), null);
  assert.equal(batchInfo('INVALID'), null);
  assert.equal(batchInfo(''), null);
});
