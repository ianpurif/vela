import { concernLabels } from "@/features/catalog/filter";
import {
  fragranceLabels,
  lengthLabels,
  sensitivityLabels,
  skinTypeLabels,
  type RoutineDraft,
} from "@/features/routine/matching";

type QuizQuestion = {
  field: keyof RoutineDraft;
  short: string;
  title: string;
  description: string;
  options: { value: string; label: string; description: string }[];
};
export const quizQuestions: QuizQuestion[] = [
  {
    field: "skinType",
    short: "Skin type",
    title: "How does your skin usually feel?",
    description: "Choose the description that feels closest to your everyday skin.",
    options: [
      {
        value: "dry",
        label: skinTypeLabels.dry,
        description: "Often feels tight or wants more moisture.",
      },
      {
        value: "oily",
        label: skinTypeLabels.oily,
        description: "Often looks shiny across the face.",
      },
      {
        value: "combination",
        label: skinTypeLabels.combination,
        description: "A little shine in some places, dryness in others.",
      },
      {
        value: "balanced",
        label: skinTypeLabels.balanced,
        description: "Usually feels comfortable and fairly even.",
      },
    ],
  },
  {
    field: "concerns",
    short: "Your focus",
    title: "What would you like to focus on?",
    description: "Choose any that matter to you, or no particular focus.",
    options: [
      {
        value: "dryness",
        label: concernLabels.dryness,
        description: "A little more moisture and softness.",
      },
      {
        value: "dullness",
        label: concernLabels.dullness,
        description: "A fresh, dewy-looking finish.",
      },
      {
        value: "texture",
        label: concernLabels.texture,
        description: "A smoother-feeling everyday ritual.",
      },
      {
        value: "comfort",
        label: concernLabels.comfort,
        description: "Care that centers on a comfortable feel.",
      },
      {
        value: "none",
        label: "No particular focus",
        description: "Just a thoughtful daily routine.",
      },
    ],
  },
  {
    field: "sensitivity",
    short: "Sensitivity",
    title: "How often does your skin feel sensitive?",
    description:
      "Sometimes or often keeps your edit fragrance-free and gives skin comfort a little more weight. This reflects a preference, not a skin assessment.",
    options: [
      {
        value: "rarely",
        label: sensitivityLabels.rarely,
        description: "Sensitivity is not usually on my mind.",
      },
      {
        value: "sometimes",
        label: sensitivityLabels.sometimes,
        description: "I prefer a more considered approach to new products.",
      },
      {
        value: "often",
        label: sensitivityLabels.often,
        description: "Comfort is an important part of my choices.",
      },
    ],
  },
  {
    field: "length",
    short: "Your rhythm",
    title: "How much room is there in your ritual?",
    description: "We’ll suggest one product for each step, where compatible choices are available.",
    options: [
      {
        value: "minimal",
        label: lengthLabels.minimal,
        description: "Cleanse and moisturize. Keep it beautifully simple.",
      },
      {
        value: "balanced",
        label: lengthLabels.balanced,
        description: "Cleanse, add a serum or essence, then moisturize.",
      },
      {
        value: "full",
        label: lengthLabels.full,
        description: "The balanced ritual, plus a face oil for an evening finish.",
      },
    ],
  },
  {
    field: "fragrance",
    short: "Preferences",
    title: "One last detail. Your fragrance preference?",
    description:
      "A fragrance-free preference is always respected. Sensitivity choices can also narrow your edit to fragrance-free products.",
    options: [
      {
        value: "fragrance-free",
        label: fragranceLabels["fragrance-free"],
        description: "Keep every recommendation fragrance-free.",
      },
      {
        value: "no-preference",
        label: fragranceLabels["no-preference"],
        description: "Let my other answers guide the edit.",
      },
    ],
  },
];
