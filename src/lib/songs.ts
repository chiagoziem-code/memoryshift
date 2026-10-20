import type { SavedMnemonic } from "./mnemonics";

/**
 * Pre-made memory songs. Each track was generated once and ships with the app
 * (public/music), so learners can play them instantly at no cost.
 */
export type SongTrack = {
  id: string;
  title: string;
  subject: string;
  topic: string;
  style: string;
  /** Exact words sung in the track, one line per row. */
  lyrics: string;
  /** What each line helps you remember, in order. */
  steps: string[];
  practiceTip: string;
  src: string;
};

export const SONG_TOPICS = ["Science", "Maths", "Geography", "History", "English"] as const;

export const SONGS: SongTrack[] = [
  {
    id: "planets",
    title: "The Planet Parade",
    subject: "Planets in order",
    topic: "Science",
    style: "Bouncy pop",
    lyrics:
      "Mercury, Venus, Earth and Mars,\nJupiter, Saturn, out past the stars,\nUranus, Neptune, last in line,\nEight planets circling, one at a time.",
    steps: ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"],
    practiceTip: "Hold up one finger for each planet as you sing.",
    src: "/music/planets.mp3",
  },
  {
    id: "rainbow",
    title: "Richard's Rainbow",
    subject: "Colours of the rainbow",
    topic: "Science",
    style: "Gentle folk",
    lyrics:
      "Red and orange, yellow too,\nGreen comes next, and then comes blue,\nIndigo and violet glow,\nThat's the colours of the rainbow.",
    steps: ["Red", "Orange", "Yellow", "Green", "Blue", "Indigo", "Violet"],
    practiceTip: "Draw a rainbow arc for each colour while you sing.",
    src: "/music/rainbow.mp3",
  },
  {
    id: "continents",
    title: "Seven Big Lands",
    subject: "The seven continents",
    topic: "Geography",
    style: "Marching band",
    lyrics:
      "Africa and Asia, Europe too,\nNorth America, South America, two!\nAustralia hopping, down below,\nAntarctica covered in ice and snow.",
    steps: ["Africa", "Asia", "Europe", "North America", "South America", "Australia", "Antarctica"],
    practiceTip: "Point to each continent on a map as you sing it.",
    src: "/music/continents.mp3",
  },
  {
    id: "bodmas",
    title: "BODMAS Boogie",
    subject: "Order of operations",
    topic: "Maths",
    style: "Funky groove",
    lyrics:
      "Brackets first, then orders next,\nDivide, multiply, you're doing your best,\nAdd and subtract to finish the sum,\nB-O-D-M-A-S, now you're done!",
    steps: ["Brackets", "Orders (powers)", "Divide", "Multiply", "Add", "Subtract"],
    practiceTip: "Write BODMAS down the side of your page, then hum the tune.",
    src: "/music/bodmas.mp3",
  },
  {
    id: "henry8",
    title: "Six Wives Song",
    subject: "Henry VIII's wives",
    topic: "History",
    style: "Old English folk",
    lyrics:
      "King Henry had six wives, you see,\nDivorced, beheaded, died, one, two, three,\nDivorced, beheaded, survived the end,\nSix queens of England, sing it again!",
    steps: ["Divorced", "Beheaded", "Died", "Divorced", "Beheaded", "Survived"],
    practiceTip: "Clap on each 'divorced, beheaded' to keep the beat.",
    src: "/music/henry8.mp3",
  },
  {
    id: "months",
    title: "Thirty Days",
    subject: "Days in each month",
    topic: "English",
    style: "Soft lullaby",
    lyrics:
      "Thirty days has September,\nApril, June and November,\nAll the rest have thirty-one,\nFebruary's twenty-eight, then we're done.",
    steps: ["30: September, April, June, November", "31: all the others", "28: February (29 in a leap year)"],
    practiceTip: "Count on your knuckles: knuckles have 31 days, dips have 30 or fewer.",
    src: "/music/months.mp3",
  },
];

/** Turn a track into one rhyme memory aid, so it joins reviews and plays its song. */
export function songToSaved(track: SongTrack): SavedMnemonic[] {
  const setId = `set-${Date.now()}-song-${track.id}`;
  const now = new Date().toISOString();
  return [
    {
      id: `${setId}-0`,
      setId,
      format: "rhyme",
      title: track.title,
      body: track.lyrics,
      steps: track.steps,
      practiceTip: track.practiceTip,
      sourceLabel: `${track.subject} (song)`,
      createdAt: now,
      liked: null,
      favourite: false,
      box: 0,
      dueAt: now,
      reviews: 0,
    },
  ];
}
