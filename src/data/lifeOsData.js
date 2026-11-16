export const KAABA_COORDS = { lat: 21.422487, lng: 39.826206 };

// JAKIM e-Solat zones for mainland Johor.
// JHR02: Johor Bahru, Kota Tinggi, Mersing, Kulai · JHR03: Kluang, Pontian
// JHR04: Batu Pahat, Muar, Segamat, Tangkak
export const JOHOR_DISTRICTS = [
  { name: 'Ulu Tiram', zone: 'JHR02', lat: 1.6, lng: 103.8167 },
  { name: 'Johor Bahru', zone: 'JHR02', lat: 1.4927, lng: 103.7414 },
  { name: 'Iskandar Puteri', zone: 'JHR02', lat: 1.4236, lng: 103.6358 },
  { name: 'Pasir Gudang', zone: 'JHR02', lat: 1.4726, lng: 103.878 },
  { name: 'Kulai', zone: 'JHR02', lat: 1.6561, lng: 103.6032 },
  { name: 'Kota Tinggi', zone: 'JHR02', lat: 1.7381, lng: 103.8999 },
  { name: 'Mersing', zone: 'JHR02', lat: 2.4312, lng: 103.8405 },
  { name: 'Kluang', zone: 'JHR03', lat: 2.0301, lng: 103.3185 },
  { name: 'Pontian', zone: 'JHR03', lat: 1.4866, lng: 103.3896 },
  { name: 'Batu Pahat', zone: 'JHR04', lat: 1.8548, lng: 102.9325 },
  { name: 'Muar', zone: 'JHR04', lat: 2.0442, lng: 102.5689 },
  { name: 'Segamat', zone: 'JHR04', lat: 2.5148, lng: 102.8158 },
  { name: 'Tangkak', zone: 'JHR04', lat: 2.2673, lng: 102.5453 },
];

export const findDistrict = (name) =>
  JOHOR_DISTRICTS.find((d) => d.name === name) || JOHOR_DISTRICTS[0];

/** Great-circle bearing (from true north) and distance from a point to the Kaabah. */
export function calculateQibla(lat, lng) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;

  const phi1 = toRad(lat);
  const phi2 = toRad(KAABA_COORDS.lat);
  const dLambda = toRad(KAABA_COORDS.lng - lng);

  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;

  const R = 6371;
  const dPhi = phi2 - phi1;
  const a =
    Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  const distanceKm = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));

  return { bearing: Number(bearing.toFixed(1)), distanceKm };
}

const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const compassPoint = (bearing) => COMPASS_POINTS[Math.round(bearing / 45) % 8];

// A personal character framework for daily self-review. The qualities themselves
// are well established in Islamic teaching; grouping them as "seven pillars" is
// this app's own arrangement, not a classification from the scholars.
export const AL_MURU_AH_PILLARS = [
  { pillar: 'Taqwa', arabic: 'تقوى', meaning: 'Consciousness of Allah', daily: 'Remember Allah in private and public.' },
  { pillar: "Muru'ah", arabic: 'مروءة', meaning: 'Dignity & Noble Conduct', daily: 'Maintain integrity, hygiene, and self-respect.' },
  { pillar: 'Hilm', arabic: 'حلم', meaning: 'Emotional Restraint', daily: 'Respond with composure; never let anger dictate action.' },
  { pillar: 'Hikmah', arabic: 'حكمة', meaning: 'Wisdom', daily: 'Think carefully before speaking or deciding.' },
  { pillar: 'Amanah', arabic: 'أمانة', meaning: 'Responsibility & Trust', daily: 'Honour every commitment to Allah, family, and work.' },
  { pillar: 'Izzah', arabic: 'عزة', meaning: 'Honour & Dignity', daily: 'Never humiliate yourself for validation or belittle others.' },
  { pillar: 'Ihsan', arabic: 'إحسان', meaning: 'Spiritual & Practical Excellence', daily: 'Give your finest effort as though Allah sees you.' },
];

// Rule for this file: never add a hadith without checking its text, collection
// and number against a reliable source (e.g. sunnah.com). No fabricated references.
export const CORE_HADITHS = [
  {
    id: 'bukhari-1',
    arabic: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى',
    transliteration: "Innamal-a'malu bin-niyyat, wa innama likullimri'in ma nawa.",
    english: 'Actions are judged only by intentions, and every person shall have only what they intended.',
    malay: 'Sesungguhnya setiap amalan itu bergantung kepada niat, dan setiap orang hanya mendapat apa yang diniatkannya.',
    source: 'Sahih al-Bukhari 1',
    grading: 'Sahih (Muttafaqun Alayh)',
    lesson: 'Sincerity (Ikhlas)',
    application: 'Audit your intention before training, studying, or working today — aim for excellence for Allah’s sake, not ego.',
    reflection: 'Would I still put in this same effort if nobody ever noticed?',
  },
  {
    id: 'muslim-2609',
    arabic: 'لَيْسَ الشَّدِيدُ بِالصُّرَعَةِ، إِنَّمَا الشَّدِيدُ الَّذِي يَمْلِكُ نَفْسَهُ عِنْدَ الْغَضَبِ',
    transliteration: "Laysash-shadidu bis-sura'ah, innamash-shadidul-ladhi yamliku nafsahu 'indal-ghadab.",
    english: 'The strong person is not the one who overcomes others by physical strength, but the one who controls himself when angry.',
    malay: 'Bukanlah orang yang kuat itu orang yang menang bergusti, tetapi orang yang kuat ialah orang yang mampu mengawal dirinya ketika marah.',
    source: 'Sahih Muslim 2609a',
    grading: 'Sahih',
    lesson: 'Emotional Mastery (Hilm)',
    application: 'When provoked in traffic or disagreement, pause for 5 seconds, seek refuge in Allah, and choose a measured reply.',
    reflection: 'What triggered my frustration recently, and how did I respond?',
  },
  {
    id: 'bukhari-7138',
    arabic: 'كُلُّكُمْ رَاعٍ وَكُلُّكُمْ مَسْئُولٌ عَنْ رَعِيَّتِهِ',
    transliteration: "Kullukum ra'in wa kullukum mas'ulun 'an ra'iyyatihi.",
    english: 'Every one of you is a shepherd and is responsible for his flock.',
    malay: 'Setiap daripada kamu adalah pemimpin, dan setiap daripada kamu bertanggungjawab terhadap apa yang dipimpinnya.',
    source: 'Sahih al-Bukhari 7138',
    grading: 'Sahih',
    lesson: 'Accountability & Qawwamah',
    application: 'Take ownership of your health, finances, studies, and family duties without blaming external circumstances.',
    reflection: 'Which area of my responsibility needs disciplined attention this week?',
  },
];
