import type { FormatId, SavedMnemonic } from "./mnemonics";

export type PremadeItem = {
  format: FormatId;
  title: string;
  body: string;
  steps: string[];
  practiceTip: string;
};

export type PremadeSet = {
  id: string;
  subject: string;
  topic: string;
  items: PremadeItem[];
};

export const TOPICS = ["Science", "Maths", "Geography", "History", "English", "Music"] as const;

export const PREMADE: PremadeSet[] = [
  {
    id: "planets",
    subject: "Planets in order",
    topic: "Science",
    items: [
      {
        format: "acronym",
        title: "My Very Easy Method",
        body: "My Very Easy Method Just Speeds Up Naming",
        steps: ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"],
        practiceTip: "Say the sentence, then say each planet after its word.",
      },
      {
        format: "story",
        title: "The trip from the Sun",
        body: "A messenger (Mercury) runs to a lovely lady (Venus). They stand on the earth (Earth), eat a Mars bar, meet a giant (Jupiter) wearing a ring (Saturn), who sneezes 'You-ran-us!' (Uranus) into the sea (Neptune).",
        steps: ["Messenger", "Lady", "Earth", "Mars bar", "Giant", "Ring", "Sneeze", "Sea"],
        practiceTip: "Close your eyes and walk through the story once.",
      },
    ],
  },
  {
    id: "photosynthesis",
    subject: "Photosynthesis",
    topic: "Science",
    items: [
      {
        format: "rhyme",
        title: "Leaf kitchen",
        body: "Sun and water, air come in,\nSugar made, the plant grows thin—\nNo! It grows tall, the oxygen flows,\nThat's how every green thing grows.",
        steps: ["Light", "Water", "Carbon dioxide", "Makes sugar", "Gives oxygen"],
        practiceTip: "Clap the beat as you say it.",
      },
      {
        format: "analogy",
        title: "A leaf is a kitchen",
        body: "Sunlight is the oven. Water and air are the ingredients. Sugar is the cake. Oxygen is the smell coming out.",
        steps: ["Oven = sunlight", "Ingredients = water + CO2", "Cake = sugar", "Smell = oxygen"],
        practiceTip: "Point at each part of a real kitchen and name it.",
      },
    ],
  },
  {
    id: "bodmas",
    subject: "Order of operations",
    topic: "Maths",
    items: [
      {
        format: "acronym",
        title: "BODMAS",
        body: "Brackets, Orders, Divide, Multiply, Add, Subtract",
        steps: ["Brackets", "Orders (powers)", "Divide / Multiply", "Add / Subtract"],
        practiceTip: "Write BODMAS at the top of every sum.",
      },
      {
        format: "chunk",
        title: "Three steps",
        body: "1. Inside first (brackets, powers)\n2. Times and share\n3. Plus and take away",
        steps: ["Inside", "Times & share", "Plus & minus"],
        practiceTip: "Circle each chunk on your sum in a different colour.",
      },
    ],
  },
  {
    id: "area-circle",
    subject: "Area of a circle",
    topic: "Maths",
    items: [
      {
        format: "rhyme",
        title: "Pie are squared",
        body: "Pie are squared, it's only fair —\nradius times radius, times pi up there.",
        steps: ["Find the radius", "Times itself", "Times pi (3.14)"],
        practiceTip: "Say it while drawing a circle.",
      },
      {
        format: "sketch",
        title: "Pizza square",
        body: "Draw a pizza. Draw a small square on its radius. Write π beside it.",
        steps: ["Circle", "Line from middle to edge", "Square on the line", "π"],
        practiceTip: "Draw it from memory before a test.",
      },
    ],
  },
  {
    id: "compass",
    subject: "Compass points",
    topic: "Geography",
    items: [
      {
        format: "acronym",
        title: "Never Eat Soggy Waffles",
        body: "North, East, South, West — going clockwise.",
        steps: ["North", "East", "South", "West"],
        practiceTip: "Turn your body as you say each word.",
      },
      {
        format: "movement",
        title: "Point and turn",
        body: "Arm up for North, right for East, down for South, left for West.",
        steps: ["Up", "Right", "Down", "Left"],
        practiceTip: "Do it standing up three times.",
      },
    ],
  },
  {
    id: "continents",
    subject: "The seven continents",
    topic: "Geography",
    items: [
      {
        format: "palace",
        title: "Around your bedroom",
        body: "Door: an African drum. Bed: an Asian panda. Desk: a European clock. Window: a North American eagle. Wardrobe: a South American parrot. Rug: an Australian kangaroo. Freezer: an Antarctic penguin.",
        steps: ["Door – Africa", "Bed – Asia", "Desk – Europe", "Window – N. America", "Wardrobe – S. America", "Rug – Australia", "Freezer – Antarctica"],
        practiceTip: "Walk around the room and touch each spot.",
      },
    ],
  },
  {
    id: "henry8",
    subject: "Henry VIII's wives",
    topic: "History",
    items: [
      {
        format: "rhyme",
        title: "Divorced, beheaded, died",
        body: "Divorced, beheaded, died,\nDivorced, beheaded, survived.",
        steps: ["Catherine of Aragon", "Anne Boleyn", "Jane Seymour", "Anne of Cleves", "Catherine Howard", "Catherine Parr"],
        practiceTip: "Chant it like a skipping rhyme.",
      },
    ],
  },
  {
    id: "because",
    subject: "Spelling 'because'",
    topic: "English",
    items: [
      {
        format: "acronym",
        title: "Big Elephants",
        body: "Big Elephants Can Always Understand Small Elephants",
        steps: ["B", "E", "C", "A", "U", "S", "E"],
        practiceTip: "Trace each letter in the air as you say the word.",
      },
      {
        format: "visual",
        title: "Elephant parade",
        body: "Picture a big elephant leading a tiny elephant by the trunk, with letters painted on their sides.",
        steps: ["Big elephant", "Small elephant", "Letters on sides"],
        practiceTip: "Draw the parade once.",
      },
    ],
  },
  {
    id: "notes-treble",
    subject: "Treble clef lines",
    topic: "Music",
    items: [
      {
        format: "acronym",
        title: "Every Good Boy Deserves Football",
        body: "E G B D F — bottom line to top line.",
        steps: ["E", "G", "B", "D", "F"],
        practiceTip: "Touch each line on the stave as you say it.",
      },
    ],
  },
];

export function premadeToSaved(set: PremadeSet): SavedMnemonic[] {
  const setId = `set-${Date.now()}-${set.id}`;
  const now = new Date().toISOString();
  return set.items.map((item, i) => ({
    id: `${setId}-${i}`,
    setId,
    format: item.format,
    title: item.title,
    body: item.body,
    steps: item.steps,
    practiceTip: item.practiceTip,
    sourceLabel: set.subject,
    createdAt: now,
    liked: null,
    favourite: false,
    box: 0,
    dueAt: now,
    reviews: 0,
  }));
}
